// ---------------------------------------------------------------------------
// LEDGER
//
// HONEST SCOPE. Brief has no payment provider connected. There is no M-Pesa
// / Daraja credential, no card processor, no bank rail. Therefore this module
// deliberately does NOT:
//
//   - move money
//   - simulate a settlement
//   - invent a balance
//
// What it DOES do is maintain a real double-entry-style record of transactions
// that the app itself creates, and compute balances from those rows by
// arithmetic. If no transactions exist, the balance is 0 -- not a placeholder.
//
// `providerConfigured` is reported on every response so the client can state
// plainly that payouts are unavailable rather than implying they work.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import * as mpesa from '../connectors/mpesa.js';

export const TX_STATUS = [
  'created',
  'pending',
  'confirmed',
  'held',
  'settled',
  'failed',
  'refunded'
];

// Which statuses count toward which bucket.
const AVAILABLE = new Set(['settled']);
const PENDING = new Set(['created', 'pending', 'confirmed', 'held']);

/**
 * Is a real payment provider connected?
 *
 * This is now a genuine credential check, delegated to the connector: it is
 * true only when M-Pesa Daraja has every credential it needs. There is no
 * override and no mock branch -- the single source of truth for "can Brief
 * move money" lives with the connector that would actually move it.
 */
export function providerConfigured() {
  return mpesa.isConfigured();
}

export function providerStatus() {
  const configured = providerConfigured();
  return {
    configured,
    provider: configured ? 'mpesa' : null,
    payoutConfigured: mpesa.isPayoutConfigured(),
    detail: mpesa.status(),
    reason: configured
      ? null
      : 'No payment provider is connected. Balances reflect recorded ' +
        'transactions only; Brief cannot send or receive money.'
  };
}

export function createTransaction({ amount, currency = 'KES', type, description = '', counterparty = null, circleId = null, objectId = null, campaignId = null, registrationId = null, metadata = {} }) {
  if (!Number.isFinite(amount)) throw new Error('amount must be a number');
  // A transaction moves a positive quantity of money. A negative amount was
  // previously accepted and flowed straight into derived economics: it could
  // drive campaign revenue and the wallet balance negative, and push a Circle
  // target to a negative percentage. Refunds are represented by the `refunded`
  // STATUS, never by a negative amount.
  if (amount <= 0) throw new Error('amount must be greater than zero');
  if (!type) throw new Error('type is required');
  // A transaction may be attached to a Circle so TARGET progress can be
  // derived from real settled money. Validated so a client cannot invent a link.
  if (circleId && !store.find('circles', (c) => c.id === circleId)) {
    throw new Error('circle not found');
  }
  // Campaign revenue derives from settled transactions carrying this link.
  if (campaignId && !store.find('campaigns', (c) => c.id === campaignId)) {
    throw new Error('campaign not found');
  }
  // A payment may be tied to a specific registration, which is what lets a
  // settlement promote a held spot to a real one. Validated both ways: the
  // registration must exist AND belong to the campaign being paid for, so a
  // caller cannot use a payment on their own campaign to move somebody
  // else's registration.
  if (registrationId) {
    const reg = store.find('registrations', (r) => r.id === registrationId);
    if (!reg) throw new Error('registration not found');
    if (!campaignId || reg.campaignId !== campaignId) {
      throw new Error('registration does not belong to this campaign');
    }
  }
  const now = new Date().toISOString();
  const tx = {
    id: newId('txn'),
    amount,
    currency,
    type,
    status: 'created',
    description,
    counterparty,
    circleId,
    objectId,
    campaignId,
    registrationId,
    metadata,
    history: [{ status: 'created', at: now }],
    createdAt: now,
    updatedAt: now
  };
  store.insert('ledgerTransactions', tx);
  return tx;
}

const VALID_TRANSITIONS = {
  created: ['pending', 'failed'],
  pending: ['confirmed', 'failed'],
  confirmed: ['held', 'settled', 'refunded'],
  held: ['settled', 'refunded', 'failed'],
  settled: ['refunded'],
  failed: [],
  refunded: []
};

export function transitionTransaction(id, next, note = '') {
  const tx = store.find('ledgerTransactions', (t) => t.id === id);
  if (!tx) throw new Error('transaction not found');
  const allowed = VALID_TRANSITIONS[tx.status] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`invalid transition: ${tx.status} -> ${next}`);
  }
  const now = new Date().toISOString();
  tx.history.push({ status: next, at: now, note });
  store.update('ledgerTransactions', id, { status: next, history: tx.history });
  return store.find('ledgerTransactions', (t) => t.id === id);
}

export function listTransactions({ limit = 50 } = {}) {
  return store
    .all('ledgerTransactions')
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
}

/**
 * Balance is COMPUTED, never stored. Inflows are positive amounts, outflows
 * negative, exactly as recorded.
 */
export function walletBalance(currency = 'KES') {
  const rows = store.filter('ledgerTransactions', (t) => t.currency === currency);
  let balance = 0;
  let pending = 0;
  for (const t of rows) {
    if (AVAILABLE.has(t.status)) balance += t.amount;
    else if (PENDING.has(t.status)) pending += t.amount;
  }
  return {
    balance,
    pending,
    currency,
    transactionCount: rows.length,
    provider: providerStatus()
  };
}
