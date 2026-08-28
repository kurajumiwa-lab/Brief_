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
  if (existing) return hydrate(existing);

  const now = new Date().toISOString();
  const member = {
    id: newId('memb'),
    circleId,
    userId,
    role,
    // Verifications start empty. A member is unverified until a real check
    // has been recorded -- Brief never assumes.
    verifications: [],
    joinedAt: now,
    updatedAt: now
  };
  store.insert('members', member);
  return hydrate(member);
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

  return {
    ...member,
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

export function listMembers(circleId) {
  return store.filter('members', (m) => m.circleId === circleId).map(hydrate);
}

export function getMember(circleId, userId) {
  const m = store.find('members', (x) => x.circleId === circleId && x.userId === userId);
  return m ? hydrate(m) : null;
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
export function removeMember(circleId, userId) {
  const member = store.find('members', (m) => m.circleId === circleId && m.userId === userId);
  if (!member) return { left: false, reason: 'not a member' };
  store.remove('members', member.id);
  return { left: true, circleId, userId };
}

export function setRole(circleId, userId, role) {
  if (!MEMBER_ROLES.includes(role)) {
    throw new Error(`role must be one of ${MEMBER_ROLES.join(', ')}`);
  }
  const member = store.find('members', (m) => m.circleId === circleId && m.userId === userId);
  if (!member) throw new Error('member not found');
  store.update('members', member.id, { role });
  return hydrate(store.find('members', (m) => m.id === member.id));
}
