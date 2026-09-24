// Shop-scoped staff authority using the existing roleAssignments collection.
// Owner: existing full workspace + team administration. Manager: brand editing
// and catalog read. Staff: catalog read. No delegated money, ownership or
// verification authority. Broader operational delegation is deliberately absent.
import { store, newId } from '../store.js';
import { getUserByHandle } from './auth.js';
import { recordSpaceActivity } from './space.js';

const ROLE = { manager: 'shop_manager', staff: 'shop_staff' };
const fail = (message, status = 403) => { throw Object.assign(new Error(message), { status }); };
export function roleFor(space, userId) {
  if (!space || !userId) return null;
  if (space.ownerId === userId) return 'owner';
  const roles = store.filter('roleAssignments', r => r.userId === userId && r.scopeKind === 'space' && r.scopeId === space.id && !r.revokedAt);
  return roles.some(r => r.role === ROLE.manager) ? 'manager' : roles.some(r => r.role === ROLE.staff) ? 'staff' : null;
}
function scoped(spaceId, userId, allowed = ['owner', 'manager', 'staff']) {
  const space = store.find('spaces', s => s.id === spaceId);
  if (!space) fail('Shop not found', 404);
  if (!allowed.includes(roleFor(space, userId))) fail('This shop role does not allow that action.');
  return space;
}
export function myTeams(userId) {
  return store.filter('spaces', s => s.ownerId !== userId && s.status === 'active' && roleFor(s, userId))
    .map(s => ({ id: s.id, name: s.name, image: s.image ?? null, role: roleFor(s, userId) }));
}
export function view(spaceId, userId) {
  const s = scoped(spaceId, userId);
  const person = id => { const u = store.find('users', u => u.id === id); return { userId: id, name: u?.displayName || u?.handle || 'Shop member', handle: u?.handle ?? null }; };
  const roster = [{ ...person(s.ownerId), role: 'owner' }, ...store.filter('roleAssignments', r => r.scopeKind === 'space' && r.scopeId === s.id && !r.revokedAt && Object.values(ROLE).includes(r.role)).map(r => ({ ...person(r.userId), role: r.role === ROLE.manager ? 'manager' : 'staff' }))];
  // Scope by spaceId, never by the vendor alone (one vendor can have two shops).
  const offers = store.filter('listings', l => l.spaceId === s.id && l.status !== 'archived')
    .map(l => ({ id: l.id, title: l.title, price: l.price, currency: l.currency, status: l.status }));
  return { permissions: { readCatalog: true, editBrand: ['owner', 'manager'].includes(roleFor(s, userId)), manageTeam: roleFor(s, userId) === 'owner', manageMoney: roleFor(s, userId) === 'owner' }, shop: { id: s.id, name: s.name, goal: s.goal, image: s.image ?? null }, role: roleFor(s, userId), roster, offers };
}
export function setMember(spaceId, actorId, { handle, role }) {
  const s = scoped(spaceId, actorId, ['owner']);
  if (![...Object.keys(ROLE), 'remove'].includes(role)) fail('Choose manager, staff or remove.', 400);
  const user = getUserByHandle(String(handle ?? '').replace(/^@/, ''));
  if (!user) fail('No account with that handle.', 404);
  if (user.id === s.ownerId) fail('Shop ownership cannot be changed through team roles.');
  const before = roleFor(s, user.id);
  if (before === role || (!before && role === 'remove')) return view(spaceId, actorId);
  const now = new Date().toISOString();
  for (const r of store.filter('roleAssignments', r => r.userId === user.id && r.scopeKind === 'space' && r.scopeId === s.id && !r.revokedAt && Object.values(ROLE).includes(r.role))) store.update('roleAssignments', r.id, { revokedAt: now });
  if (role !== 'remove') store.insert('roleAssignments', { id: newId('rol'), userId: user.id, role: ROLE[role], scopeKind: 'space', scopeId: s.id, assignedBy: actorId, createdAt: now, revokedAt: null });
  recordSpaceActivity({ spaceId, actorId, kind: 'team_role_changed', title: 'Shop team updated', metadata: { userId: user.id, before, after: role === 'remove' ? null : role } });
  return view(spaceId, actorId);
}
export function editBrand(spaceId, actorId, input) {
  const s = scoped(spaceId, actorId, ['owner', 'manager']);
  if (s.status !== 'active') fail('Restore the shop before editing its brand.', 409);
  const allowed = ['name', 'goal', 'image'];
  if (Object.keys(input).some(k => !allowed.includes(k))) fail('This action only edits the shop name, description and brand cover.', 400);
  const patch = {};
  if ('name' in input) { if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 120) fail('Shop name must be 1–120 characters.', 400); patch.name = input.name.trim(); }
  if ('goal' in input) { if (typeof input.goal !== 'string' || input.goal.length > 1000) fail('Description must be text up to 1000 characters.', 400); patch.goal = input.goal.trim(); }
  if ('image' in input) {
    if (input.image !== null && (typeof input.image !== 'string' || !/^\/api\/media\/file\/[a-zA-Z0-9_-]+$|^https:\/\//.test(input.image))) fail('Use an uploaded cover or an HTTPS image URL.', 400);
    patch.image = input.image;
  }
  const before = Object.fromEntries(allowed.map(k => [k, s[k] ?? null]));
  store.update('spaces', s.id, { ...patch, updatedAt: new Date().toISOString() });
  recordSpaceActivity({ spaceId, actorId, kind: 'brand_updated', title: 'Shop brand updated', metadata: { before, after: patch } });
  return view(spaceId, actorId);
}
