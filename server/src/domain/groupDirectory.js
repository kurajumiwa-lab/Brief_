// Groups are the existing circle primitive, not a second membership system.
// Directory rows contain only explicitly published discovery metadata.
import { store } from '../store.js';
import { standingOf } from './verification.js';

export const GROUP_PURPOSES = [
  { id: 'coordination', label: 'Projects & coordination' },
  { id: 'table_banking', label: 'Table banking' },
  { id: 'group_buy', label: 'Group buys' },
  { id: 'events', label: 'Event coordination' }
];

export function creatorEligibility(userId) {
  const identityVerified = Boolean(userId && standingOf(userId).identity === 'verified');
  const shops = userId ? store.filter('spaces', s => s.ownerId === userId && s.status === 'active'
    && ['business', 'side_hustle', 'creator'].includes(s.type)
    && store.find('vendors', v => v.id === s.vendorId && v.ownerId === userId))
    .map(s => ({ id: s.id, name: s.name })) : [];
  return { eligible: identityVerified && shops.length > 0, identityVerified, shops,
    reason: !userId ? 'Sign in to create a group.' : !identityVerified
      ? 'Your identity must be approved before you can create a group.'
      : !shops.length ? 'An active shop you own is required to host a group.' : null };
}

export function requireCreator(userId, spaceId = null) {
  const eligibility = creatorEligibility(userId);
  if (!eligibility.eligible || (spaceId && !eligibility.shops.some(s => s.id === spaceId))) {
    const e = new Error(eligibility.reason ?? 'Choose an active shop you own.');
    e.status = 403; throw e;
  }
  return spaceId || eligibility.shops[0].id;
}

export function cleanDirectory(input = {}) {
  const purposes = input.purposes ?? ['coordination'];
  if (!Array.isArray(purposes) || purposes.length < 1 || purposes.length > GROUP_PURPOSES.length
    || purposes.some(p => !GROUP_PURPOSES.some(k => k.id === p))) throw new Error('Choose a supported group purpose.');
  if (input.listed !== undefined && typeof input.listed !== 'boolean') throw new Error('Directory opt-in must be true or false.');
  const text = (key) => {
    if (input[key] != null && typeof input[key] !== 'string') throw new Error(`${key} must be text`);
    return String(input[key] ?? '').trim().slice(0, 100);
  };
  return { listed: input.listed === true, location: text('location'), industry: text('industry'), purposes: [...new Set(purposes)] };
}

export function isMember(circleId, userId) {
  return Boolean(userId && store.find('members', m => m.circleId === circleId && m.userId === userId && m.status !== 'ended'));
}

export function directory({ location = '', industry = '', purpose = '' } = {}, viewerId = null) {
  const eq = (a, b) => !b || String(a).toLocaleLowerCase() === String(b).trim().toLocaleLowerCase();
  const listed = store.filter('circles', c => c.directory?.listed === true
    && ['discoverable', 'open'].includes(c.visibility) && !['completed', 'dormant'].includes(c.status));
  const groups = listed.filter(c => eq(c.directory.location, location) && eq(c.directory.industry, industry)
    && (!purpose || c.directory.purposes.includes(purpose))).map(c => ({
      id: c.id, name: c.name, description: c.description || '',
      location: c.directory.location, industry: c.directory.industry, purposes: c.directory.purposes,
      isMember: isMember(c.id, viewerId), canJoin: c.visibility === 'open', canRequest: c.visibility === 'discoverable',
      hostName: store.find('spaces', s => s.id === c.hostSpaceId)?.name ?? null
    }));
  const values = key => [...new Set(listed.map(c => c.directory[key]).filter(Boolean))].sort();
  return { groups, locations: values('location'), industries: values('industry'), purposes: GROUP_PURPOSES };
}
