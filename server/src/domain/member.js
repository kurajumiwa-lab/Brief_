// ---------------------------------------------------------------------------
// MEMBER + TRUST
//
// TRUST IS EVIDENCE, NOT A SCORE.
//
// There is deliberately no `trustScore` field anywhere in this file. A number
// like "Trust: 87" is unexplainable, trivially gamed, and impossible for a
// user to contest. Instead a member carries a list of verifications, each of
// which is either true or false and each of which names what was checked.
//
// Counts derived from real records (completed fulfilments, circles
// coordinated) are returned as plain facts, not folded into a rating.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import * as history from './circleHistory.js';

export const MEMBER_ROLES = ['coordinator', 'contributor', 'scout', 'logistics', 'observer'];

// Every verification a member can hold. Each is evidence of a specific check
// that actually happened -- nothing here is inferred or estimated.
export const VERIFICATION_KINDS = [
  'phone_verified',
  'identity_verified',
  'business_verified',
  'moderator_verified'
];

const LABELS = {
  phone_verified: 'Phone verified',
  identity_verified: 'Identity verified',
  business_verified: 'Business document verified',
  moderator_verified: 'Verified by a moderator'
};

export function addMember(circleId, userId, role = 'contributor') {
  if (!store.find('circles', (c) => c.id === circleId)) throw new Error('circle not found');
  if (!MEMBER_ROLES.includes(role)) {
    throw new Error(`role must be one of ${MEMBER_ROLES.join(', ')}`);
  }
  const existing = store.find('members', (m) => m.circleId === circleId && m.userId === userId);
  // A person who left may come back. The row is reactivated rather than
  // duplicated: two rows for one relationship is how "who was a member in
  // March" becomes unanswerable.
  if (existing && existing.status !== 'ended') return hydrate(existing);

  const now = new Date().toISOString();
  if (existing) {
    store.update('members', existing.id, {
      status: 'active', role, endedAt: null, endReason: null, endKind: null,
      rejoinedAt: now, updatedAt: now
    });
    history.append({ circleId, subject: existing.id, subjectKind: 'member', kind: 'member_rejoined', after: role, actorId: userId });
    return hydrate(store.find('members', (m) => m.id === existing.id));
  }

  const member = {
    id: newId('memb'),
    circleId,
    userId,
    role,
    // Verifications start empty. A member is unverified until a real check
    // has been recorded -- Brief never assumes.
    verifications: [],
    // 'active' | 'ended'. Leaving or being removed ENDS the relationship; it is
    // never deleted, so the work and ballots that name this person still mean
    // something afterwards.
    status: 'active',
    joinedAt: now,
    endedAt: null,
    endReason: null,
    endKind: null,
    updatedAt: now
  };
  store.insert('members', member);
  history.append({ circleId, subject: member.id, subjectKind: 'member', kind: 'member_joined', after: role, actorId: userId });
  return hydrate(member);
}

/**
 * Who a member is, for a human reader. A member list that shows `usr_mt1y...`
 * is a database dumped into UI: nobody can tell their neighbour apart, and the
 * group's own record becomes unreadable to the group. Names first, initials for
 * the avatar, and never an id as a label.
 */
function who(userId) {
  const u = store.find('users', (x) => x.id === userId);
  const name = String(u?.displayName ?? '').trim() || String(u?.handle ?? '').trim();
  return {
    displayName: name || null,
    handle: u?.handle ?? null,
    initials: name
      ? name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
      : '?'
  };
}

/**
 * Trust presented as an evidence list. Returns the checks that PASSED plus
 * plain factual counts. Never returns a rating.
 */
function hydrate(member) {
  const evidence = (member.verifications ?? [])
    .filter((v) => VERIFICATION_KINDS.includes(v))
    .map((v) => ({ kind: v, label: LABELS[v] }));

  // Factual history, counted from real rows.
  const settled = store.filter(
    'ledgerTransactions',
    (t) => t.counterparty === member.userId && t.status === 'settled'
  ).length;
  const coordinates = store.filter(
    'members',
    (m) => m.userId === member.userId && m.role === 'coordinator'
  ).length;

  const person = who(member.userId);
  return {
    ...member,
    displayName: person.displayName,
    handle: person.handle,
    initials: person.initials,
    // A raw id is a database key. It is kept on the row for the API and never
    // used as a label; the client that did so was showing users their own
    // neighbours as strings like usr_mt1ypigodny0a3.
    isActive: member.status !== 'ended',
    trust: {
      // Explicitly no numeric score. Consumers render the evidence list.
      evidence,
      verifiedCount: evidence.length,
      facts: [
        ...(settled > 0 ? [{ kind: 'settled_transactions', label: `${settled} settled transaction${settled === 1 ? '' : 's'}` }] : []),
        ...(coordinates > 0 ? [{ kind: 'coordinator_of', label: `Coordinator of ${coordinates} circle${coordinates === 1 ? '' : 's'}` }] : []),
        { kind: 'member_since', label: `Member since ${new Date(member.joinedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}` }
      ]
    }
  };
}

/** Active members, unless `includeEnded` — history is opt-in, never the default. */
export function listMembers(circleId, { includeEnded = false } = {}) {
  return store
    .filter('members', (m) => m.circleId === circleId && (includeEnded || m.status !== 'ended'))
    .map(hydrate);
}

export function getMember(circleId, userId) {
  const m = store.find('members', (x) => x.circleId === circleId && x.userId === userId && x.status !== 'ended');
  return m ? hydrate(m) : null;
}

/** How many live members there are — the number a vote's quorum is measured
 *  against, and the number an invitation must not be able to inflate. */
export function countActiveMembers(circleId) {
  return store.filter('members', (m) => m.circleId === circleId && m.status !== 'ended').length;
}

/**
 * Record a verification that genuinely happened. This is the only way
 * evidence enters the system -- it cannot be set at member creation.
 */
export function recordVerification(circleId, userId, kind) {
  if (!VERIFICATION_KINDS.includes(kind)) {
    throw new Error(`kind must be one of ${VERIFICATION_KINDS.join(', ')}`);
  }
  const member = store.find('members', (m) => m.circleId === circleId && m.userId === userId);
  if (!member) throw new Error('member not found');
  const verifications = Array.from(new Set([...(member.verifications ?? []), kind]));
  store.update('members', member.id, { verifications });
  return hydrate(store.find('members', (m) => m.id === member.id));
}

/**
 * Leave a circle.
 *
 * The loop was half-built: a user could be added (and an open circle could be
 * self-joined) with no way out. Closing it here rather than in the client
 * matters because leaving is a data change, not a display preference.
 *
 * What leaving does and does not do, stated so nothing is implied:
 *
 *   * The membership ROW IS REMOVED. Role, verifications and join date go
 *     with it -- they described a membership that no longer exists.
 *   * WORK IS NOT DELETED. A task assigned to the leaver keeps its assignee:
 *     erasing the assignment would rewrite who did what. The task becomes
 *     unclaimable-by-them in the client, and a coordinator can release it.
 *   * MONEY IS UNTOUCHED. Settled ledger rows are history; leaving a circle
 *     cannot un-contribute.
 *
 * A sole coordinator may leave. The alternative -- trapping the last
 * coordinator to keep the row valid -- is worse than a circle with no
 * coordinator, and `canJoin` already reopens such a circle to a new joiner.
 */
/**
 * End a membership — for leaving or for removal.
 *
 * What changed from the previous version of this function: the ROW IS NOT
 * DELETED. It is marked ended, with a kind and (for a removal) a reason. The
 * consequence the group cares about is that "who did this work, who voted for
 * that, who held the money" stays answerable after someone walks out or is
 * thrown out — which is exactly when a group most wants to know.
 *
 * A sole coordinator may still leave; the alternative (trapping them to keep a
 * row valid) is worse than a circle with no coordinator, and `canJoin` already
 * reopens such a circle. Removal is a different act: a coordinator cannot delete
 * the last coordinator to leave nobody to answer to.
 */
export function removeMember(circleId, userId, { actorId = null, reason = null, kind = 'member_removed' } = {}) {
  const member = store.find('members', (m) => m.circleId === circleId && m.userId === userId && m.status !== 'ended');
  if (!member) return { left: false, reason: 'not a member of this circle' };
  const removing = kind === 'member_removed';
  const clean = String(reason ?? '').trim();
  if (removing && !clean) {
    throw new Error('removing a member needs a reason — an unexplained expulsion is a silencing');
  }
  if (member.role === 'coordinator') {
    const coordinators = store.filter('members', (m) => m.circleId === circleId && m.role === 'coordinator' && m.status !== 'ended');
    if (removing && coordinators.length === 1) {
      throw new Error('the only coordinator cannot be removed — hand the role over first');
    }
  }
  store.update('members', member.id, {
    status: 'ended',
    endedAt: new Date().toISOString(),
    endKind: kind,
    endReason: clean || null,
    endedBy: removing ? (actorId ?? null) : null,
    updatedAt: new Date().toISOString()
  });
  history.append({
    circleId, subject: member.id, subjectKind: 'member', kind,
    field: 'status', before: 'active', after: 'ended',
    actorId: removing ? (actorId ?? null) : userId,
    reason: clean || null
  });
  return { left: true, circleId, userId, endedAt: new Date().toISOString() };
}

/** Leave a circle. Optional reason; no one is forced to explain themselves. */
export function leaveCircle(circleId, userId, { reason = null } = {}) {
  return removeMember(circleId, userId, { actorId: userId, reason, kind: 'member_left' });
}

/**
 * Change a member's role. A reason is mandatory: a silent promotion is how a
 * circle gets captured, and a silent demotion is how dissent gets tidied away.
 * The old role is not overwritten anywhere — this row and the history entry are
 * what a member can point at afterwards.
 */
export function setRole(circleId, userId, role, { actorId = null, reason = null, silent = false } = {}) {
  if (!MEMBER_ROLES.includes(role)) {
    throw new Error(`role must be one of ${MEMBER_ROLES.join(', ')}`);
  }
  const member = store.find('members', (m) => m.circleId === circleId && m.userId === userId && m.status !== 'ended');
  if (!member) throw new Error('member not found');
  const clean = String(reason ?? '').trim();
  if (!silent && !clean) throw new Error('changing a role needs a reason — the group is told why, in writing');
  if (member.role === role) return hydrate(member);
  // Read the pre-image out of the row BEFORE writing it. store rows are live
  // objects, so `member.role` after an update would report the NEW value and
  // the history entry would say nothing ever changed.
  const from = member.role;
  store.update('members', member.id, { role, updatedAt: new Date().toISOString() });
  history.append({
    circleId, subject: member.id, subjectKind: 'member', kind: 'member_role_changed',
    field: 'role', before: from, after: role, actorId, reason: clean,
    // `silent` exists for the atomic transfer below, which writes its own pair
    // of rows; it is never reachable from a route.
    ...(silent ? { kind: 'member_role_changed' } : {})
  });
  return hydrate(store.find('members', (m) => m.id === member.id));
}

/**
 * Hand the circle over. Exactly one coordinator, always: both halves are
 * decided BEFORE anything is written, so a failure mid-way cannot leave the
 * circle with two, or none.
 */
export function transferCoordinator(circleId, toUserId, { actorId = null, reason = null } = {}) {
  const from = store.find('members', (m) => m.circleId === circleId && m.userId === actorId && m.role === 'coordinator' && m.status !== 'ended');
  if (!from) throw new Error('only the current coordinator may hand over');
  const to = store.find('members', (m) => m.circleId === circleId && m.userId === toUserId && m.status !== 'ended');
  if (!to) throw new Error('the new coordinator must be a member of this circle');
  if (to.id === from.id) throw new Error('you already hold the role');
  const clean = String(reason ?? '').trim() || 'handed over';

  const toFrom = to.role;
  store.update('members', to.id, { role: 'coordinator', updatedAt: new Date().toISOString() });
  store.update('members', from.id, { role: 'contributor', updatedAt: new Date().toISOString() });
  const at = new Date().toISOString();
  history.append({ circleId, subject: to.id, subjectKind: 'member', kind: 'member_role_changed', field: 'role', before: toFrom, after: 'coordinator', actorId, reason: clean, at });
  history.append({ circleId, subject: from.id, subjectKind: 'member', kind: 'member_role_changed', field: 'role', before: 'coordinator', after: 'contributor', actorId, reason: clean, at });
  return {
    to: hydrate(store.find('members', (m) => m.id === to.id)),
    from: hydrate(store.find('members', (m) => m.id === from.id)),
    coordinators: store.filter('members', (m) => m.circleId === circleId && m.role === 'coordinator' && m.status !== 'ended').length
  };
}
