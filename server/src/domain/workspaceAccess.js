// A group link is context, never a grant to its native financial/operational domain.
import { store } from '../store.js';
export function linkedWorkspace(purpose, resourceId) {
  return store.find('groupWorkspaces', w => w.purpose === purpose && w.resourceId === resourceId);
}
export function workspaceParticipant(workspaceId, userId) {
  return store.find('workspaceParticipants', p => p.workspaceId === workspaceId && p.userId === userId && p.status === 'active');
}
export function assertLinkedParticipant(purpose, resourceId, userId, ownerId) {
  const w = linkedWorkspace(purpose, resourceId);
  if (w && userId !== ownerId && !workspaceParticipant(w.id, userId)) {
    throw Object.assign(new Error('Separate workspace participation is required; group membership does not grant access.'), { status: 403 });
  }
}
export function canReadWorkspaceSignal(signal, userId) {
  const m = signal.metadata ?? {};
  const w = m.groupBuyId ? linkedWorkspace('group_buy', m.groupBuyId) : m.campaignId ? linkedWorkspace('events', m.campaignId) : null;
  // Financial/organizer signals are not community announcements.
  return !w || w.ownerId === userId;
}
