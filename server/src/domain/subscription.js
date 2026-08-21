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
    subscriberCount: 0,
    createdAt: now,
    updatedAt: now
  });
}

export function listSubscriptions({ creatorId = null } = {}) {
  let rows = store.all('subscriptions');
  if (creatorId) rows = rows.filter((s) => s.creatorId === creatorId);
  return rows.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function getSubscription(id) {
  return store.find('subscriptions', (s) => s.id === id) ?? null;
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
