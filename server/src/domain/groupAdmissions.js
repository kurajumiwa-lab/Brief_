import { store, newId } from '../store.js';
import * as members from './member.js';
const fail = (text, status = 403) => { throw Object.assign(new Error(text), { status }); };
function coordinator(groupId, actorId) {
  if (!store.find('members', m => m.circleId === groupId && m.userId === actorId && m.status !== 'ended' && m.role === 'coordinator')) fail('Only this group’s coordinator manages admission requests.');
}
export function request(groupId, actorId) {
  const g = store.lookup('circles', groupId);
  if (!g?.directory?.listed || !['discoverable', 'open'].includes(g.visibility) || ['completed', 'dormant'].includes(g.status)) fail('This group is not accepting directory requests.', 404);
  const old = store.find('groupJoinRequests', r => r.groupId === groupId && r.userId === actorId && r.status === 'pending');
  if (old) return { requested: true };
  store.insert('groupJoinRequests', { id: newId('gjr'), groupId, userId: actorId, status: 'pending', createdAt: new Date().toISOString() });
  return { requested: true };
}
export function list(groupId, actorId) {
  coordinator(groupId, actorId);
  return store.filter('groupJoinRequests', r => r.groupId === groupId && r.status === 'pending').map(r => ({ id: r.id, handle: store.lookup('users', r.userId)?.handle ?? 'Member', createdAt: r.createdAt }));
}
export function decide(groupId, actorId, { id, approve, reason }) {
  coordinator(groupId, actorId);
  if (typeof approve !== 'boolean' || typeof reason !== 'string' || !reason.trim()) fail('Choose an outcome and supply a reason.', 400);
  const r = store.lookup('groupJoinRequests', id);
  if (!r || r.groupId !== groupId || r.status !== 'pending') fail('No pending request.', 409);
  return store.transaction(() => {
    if (approve) members.addMember(groupId, r.userId);
    store.update('groupJoinRequests', r.id, { status: approve ? 'approved' : 'declined', handledBy: actorId, handledAt: new Date().toISOString() });
    store.insert('auditLog', { id: newId('gja'), action: 'group.admission', objectType: 'circle', objectId: groupId, actorId, reason: reason.trim().slice(0,1000), at: new Date().toISOString(), after: { requestId: id, approve } });
    return { requests: list(groupId, actorId) };
  });
}
