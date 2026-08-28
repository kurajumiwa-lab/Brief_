// ---------------------------------------------------------------------------
// SUBSCRIPTION — recurring memberships (CCS §3.4)
//
// A creator's recurring offering (membership, club, tier). The SUBSCRIPTION
// tracks the schedule and the commitment; the MONEY still flows through the
// one ledger, one settled transaction per cycle — a subscription never invents
// a balance, and it never auto-charges (collection is credential-gated).
//
// Honest scope: the schedule is real and derived; the payment rail is the same
// Tuma/ledger path as everything else, so with no provider, a cycle simply
// cannot be charged and says so.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { createTransaction } from './ledger.js';

export const SUB_INTERVALS = ['weekly', 'monthly', 'yearly'];
export const SUB_STATUS = ['active', 'paused', 'cancelled'];

/**
 * The subscriber count is DERIVED, never stored.
 *
 * The plan row used to carry a `subscriberCount: 0` field that nothing ever
 * incremented. It would have been a permanent, confident zero next to a list
 * of real members. Counting the rows is the only version that can be right.
 */
function withCounts(sub, viewerId = null) {
  const subscribers = store.filter(
    'subscribers',
    (s) => s.subscriptionId === sub.id && s.status === 'active'
  );

  // Money is counted from the ledger, where it actually lives. `settled` is
  // the only status that means money moved.
  const settled = store.filter(
    'ledgerTransactions',
    (t) => t.metadata?.subscriptionId === sub.id && t.status === 'settled'
  );

  return {
    ...sub,
    subscriberCount: subscribers.length,
    settledCycles: settled.length,
    collected: settled.reduce((sum, t) => sum + t.amount, 0),
    // Whether the viewer themselves is subscribed, so a client can render
    // "Subscribed" instead of a button that would create a duplicate.
    viewerIsSubscriber: viewerId
      ? subscribers.some((s) => s.memberId === viewerId)
      : null
  };
}

export function createSubscription({ creatorId, title, price, currency = 'KES', interval = 'monthly', description = '' }) {
  if (!creatorId) throw new Error('a creator is required');
  if (!title || !String(title).trim()) throw new Error('title is required');
  if (!Number.isFinite(price) || price <= 0) throw new Error('price must be positive');
  if (!SUB_INTERVALS.includes(interval)) throw new Error(`interval must be one of ${SUB_INTERVALS.join(', ')}`);
  const now = new Date().toISOString();
  return store.insert('subscriptions', {
    id: newId('sub'),
    creatorId,
    title: String(title).trim(),
    description: String(description ?? ''),
    price,
    currency,
    interval,
    status: 'active',
    createdAt: now,
    updatedAt: now
  });
}

export function listSubscriptions({ creatorId = null, viewerId = null } = {}) {
  let rows = store.all('subscriptions');
  if (creatorId) rows = rows.filter((s) => s.creatorId === creatorId);
  return rows
    .slice()
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .map((s) => withCounts(s, viewerId));
}

export function listSubscribers({ subscriptionId = null, memberId = null } = {}) {
  let rows = store.all('subscribers');
  if (subscriptionId) rows = rows.filter((s) => s.subscriptionId === subscriptionId);
  if (memberId) rows = rows.filter((s) => s.memberId === memberId);
  return rows.map((s) => ({ ...s }));
}

export function getSubscription(id, viewerId = null) {
  const sub = store.find('subscriptions', (s) => s.id === id);
  return sub ? withCounts(sub, viewerId) : null;
}

/**
 * SUBSCRIBE — the half of the loop that did not exist.
 *
 * A creator could publish a plan and could even record a billing cycle for
 * THEMSELVES, but nobody else could ever join: there was no subscribe call,
 * so a follower reading a plan had nothing to press. This is that call.
 *
 * Honesty, stated rather than implied:
 *
 *   * The membership is real: a subscriber row is written, so the plan's
 *     count and the follower's "you are subscribed" state are both derived
 *     from data rather than from a flag the client asserted.
 *   * THE MONEY IS NOT COLLECTED. The first cycle is recorded as a ledger
 *     transaction, which with no payment provider stays 'created'. The
 *     response says `charged: false`, and the transaction's own status is
 *     returned so the client can show "recorded, not paid".
 *   * Subscribing twice is idempotent. A second call returns the existing
 *     membership instead of a duplicate row (and a duplicate would inflate
 *     the derived count).
 */
export function subscribe(subscriptionId, memberId) {
  if (!memberId) throw new Error('a member is required');
  const sub = getSubscription(subscriptionId);
  if (!sub) throw new Error('subscription not found');
  if (sub.status !== 'active') throw new Error('this plan is not open');

  const existing = store.find(
    'subscribers',
    (s) => s.subscriptionId === subscriptionId && s.memberId === memberId
  );

  if (existing) {
    const revived = existing.status === 'active'
      ? existing
      : store.update('subscribers', existing.id, { status: 'active', endedAt: null, updatedAt: new Date().toISOString() });
    return {
      subscriber: { ...revived },
      transaction: null,
      duplicate: true,
      charged: false
    };
  }

  const now = new Date().toISOString();
  const subscriber = store.insert('subscribers', {
    id: newId('subm'),
    subscriptionId,
    memberId,
    status: 'active',
    startedAt: now,
    endedAt: null,
    createdAt: now,
    updatedAt: now
  });

  // The membership is instant; the payment is not. Recording the cycle is
  // honest about the commitment without pretending money moved.
  const transaction = recordCycle(subscriptionId, memberId);

  return { subscriber: { ...subscriber }, transaction, duplicate: false, charged: transaction.status === 'settled' };
}

/**
 * Unsubscribe. The row keeps its history (startedAt/endedAt) rather than being
 * deleted: the count drops because the status changed, not because the fact
 * that they were ever a member was erased.
 */
export function unsubscribe(subscriptionId, memberId) {
  const existing = store.find(
    'subscribers',
    (s) => s.subscriptionId === subscriptionId && s.memberId === memberId
  );
  if (!existing) throw new Error('you are not subscribed to this plan');
  if (existing.status === 'cancelled') {
    return { subscriber: { ...existing }, changed: false };
  }
  const now = new Date().toISOString();
  const row = store.update('subscribers', existing.id, { status: 'cancelled', endedAt: now, updatedAt: now });
  return { subscriber: { ...row }, changed: true };
}

export function transitionSubscription(id, action) {
  const sub = getSubscription(id);
  if (!sub) throw new Error('subscription not found');
  const map = { pause: { from: ['active'], to: 'paused' }, resume: { from: ['paused'], to: 'active' }, cancel: { from: ['active', 'paused'], to: 'cancelled' } };
  const m = map[action];
  if (!m) throw new Error(`unknown action: ${action}`);
  if (!m.from.includes(sub.status)) throw new Error(`cannot ${action} from ${sub.status}`);
  return store.update('subscriptions', id, { status: m.to, updatedAt: new Date().toISOString() });
}

/**
 * Record one billing cycle as a REAL ledger transaction. The subscription
 * tracks the schedule; the ledger is the money. With no payment provider, the
 * transaction stays 'created' (honest: recorded, not settled).
 */
export function recordCycle(subscriptionId, memberId, amount = null) {
  const sub = getSubscription(subscriptionId);
  if (!sub) throw new Error('subscription not found');
  if (sub.status !== 'active') throw new Error('subscription is not active');
  const amt = amount ?? sub.price;
  if (!Number.isFinite(amt) || amt <= 0) throw new Error('amount must be positive');
  return createTransaction({
    amount: amt,
    currency: sub.currency,
    type: 'subscription',
    description: `${sub.title} — ${sub.interval} membership`,
    counterparty: memberId,
    metadata: { subscriptionId: sub.id, memberId }
  });
}
