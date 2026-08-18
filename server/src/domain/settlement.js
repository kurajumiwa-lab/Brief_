// ---------------------------------------------------------------------------
// SETTLEMENT & COMMISSION
//
// HONEST SCOPE. This module computes how a settled order's money DIVIDES. It
// does not move money, and it cannot: no payment provider is connected (see
// domain/ledger.js). What it does is make the arithmetic real and derivable so
// that when a provider is attached, the numbers it disburses already exist and
// have been tested.
//
// THREE RULES.
//
//   1. THE SPLIT IS DERIVED, NEVER STORED. There is no `commissionEarned`
//      column and no platform balance row. Every figure here is computed by
//      scanning settled orders. A stored counter would be a second source of
//      truth that drifts from the ledger the first time anything fails
//      halfway.
//
//   2. ONLY SETTLED MONEY COUNTS. An order that is merely placed, accepted or
//      even fulfilled contributes nothing. Revenue that has not settled is
//      not revenue; counting it is how a marketplace reports earnings that
//      do not exist.
//
//   3. ROUNDING FAVOURS THE SELLER. Commission is rounded DOWN to the whole
//      shilling and the seller receives the remainder, so the two parts always
//      sum exactly to the total. Rounding both independently would leak or
//      invent fractions of a shilling on every transaction.
// ---------------------------------------------------------------------------

import * as mpesa from '../connectors/mpesa.js';
import { store, newId } from '../store.js';

/**
 * Platform commission rate, as a fraction.
 *
 * Configurable so a deployment can set its own, but validated on read: a
 * malformed or out-of-range environment value falls back to the default
 * rather than silently charging 4000%.
 */
export const DEFAULT_COMMISSION_RATE = 0.05;

export function commissionRate() {
  const raw = process.env.BRIEF_COMMISSION_RATE;
  if (raw === undefined || raw === '') return DEFAULT_COMMISSION_RATE;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 0.5) return DEFAULT_COMMISSION_RATE;
  return n;
}

/**
 * Split one amount into platform commission and seller proceeds.
 *
 * Pure arithmetic -- no store access, no side effects -- so it is trivially
 * testable and cannot accidentally record anything.
 */
export function splitAmount(total, rate = commissionRate()) {
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('amount must be a positive number');
  }
  // Floor the commission so the platform never takes a fraction it is not
  // owed, and give the remainder to the seller. commission + seller === total
  // exactly, by construction.
  const commission = Math.floor(total * rate);
  const sellerAmount = total - commission;
  return { total, rate, commission, sellerAmount };
}

/**
 * The split for a specific order. Returns null for an order that has not
 * settled -- the honest answer, rather than a zeroed row that reads like a
 * settled order worth nothing.
 */
export function orderSettlement(orderId) {
  const order = store.find('orders', (o) => o.id === orderId);
  if (!order) return null;
  if (order.status !== 'settled') return null;

  const tx = order.transactionId
    ? store.find('ledgerTransactions', (t) => t.id === order.transactionId)
    : null;
  // A settled order must be backed by a settled transaction. transitionOrder()
  // enforces this, so reaching here without one means the data was written
  // around the domain layer.
  if (!tx || tx.status !== 'settled') return null;

  const split = splitAmount(order.total);
  return {
    orderId: order.id,
    transactionId: tx.id,
    vendorId: order.vendorId,
    currency: order.currency,
    ...split,
    settledAt: order.settledAt
  };
}

/**
 * Everything a vendor has actually earned, derived by scanning their settled
 * orders. Never a stored balance.
 *
 * `payoutAvailable` is deliberately false while no provider is configured:
 * the money is computable but not movable, and the client is told which.
 */
export function vendorEarnings(vendorId, currency = 'KES') {
  const settled = store.filter(
    'orders',
    (o) => o.vendorId === vendorId && o.status === 'settled' && o.currency === currency
  );

  let gross = 0;
  let commission = 0;
  let net = 0;
  const lines = [];

  for (const o of settled) {
    const s = orderSettlement(o.id);
    // Skip anything not genuinely backed by settled money rather than
    // counting it optimistically.
    if (!s) continue;
    gross += s.total;
    commission += s.commission;
    net += s.sellerAmount;
    lines.push(s);
  }

  // Payouts already sent or in flight, read from the ledger -- there is no
  // separate vendor balance to drift out of step.
  const payouts = store.filter(
    'payouts',
    (p) => p.vendorId === vendorId && p.currency === currency
  );
  const paidOut = payouts
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);
  const pendingPayout = payouts
    .filter((p) => p.status === 'requested' || p.status === 'processing')
    .reduce((sum, p) => sum + p.amount, 0);
  const withdrawable = net - paidOut - pendingPayout;
  const payoutConfigured = mpesa.isPayoutConfigured();
  const canPayout = payoutConfigured;

  return {
    vendorId,
    currency,
    gross,
    commission,
    net,
    orderCount: lines.length,
    rate: commissionRate(),
    lines,
    // Money already sent to this seller. Subtracting it is what stops a
    // vendor being paid the same earnings twice.
    paidOut,
    pendingPayout,
    withdrawable,
    // The difference between "you have earned X" and "you can withdraw X".
    // Conflating them would be a lie about money.
    payoutAvailable: canPayout && withdrawable > 0,
    payoutReason: !payoutConfigured
      ? 'No payment provider is connected. Earnings are computed from settled ' +
        'orders and are accurate, but Brief cannot disburse them.'
      : withdrawable <= 0
        ? (pendingPayout > 0
            ? 'A payout is already in progress.'
            : 'Nothing is currently withdrawable.')
        : null
  };
}

/**
 * Platform-wide commission, derived the same way. Used for reconciliation:
 * the sum of every vendor's commission must equal this figure.
 */
export function platformCommission(currency = 'KES') {
  const settled = store.filter(
    'orders',
    (o) => o.status === 'settled' && o.currency === currency
  );
  let gross = 0;
  let commission = 0;
  let count = 0;
  for (const o of settled) {
    const s = orderSettlement(o.id);
    if (!s) continue;
    gross += s.total;
    commission += s.commission;
    count += 1;
  }
  return { currency, gross, commission, sellerTotal: gross - commission, orderCount: count, rate: commissionRate() };
}

/**
 * Reconciliation. Recomputes the economic picture from scratch and reports
 * any disagreement instead of assuming consistency.
 *
 * This is what makes "derived, never stored" verifiable rather than merely
 * asserted: if a settled order is not backed by a settled transaction, or the
 * amounts disagree, it is reported as a discrepancy rather than absorbed.
 */
export function reconcile(currency = 'KES') {
  const discrepancies = [];
  const settledOrders = store.filter(
    'orders',
    (o) => o.status === 'settled' && o.currency === currency
  );

  for (const o of settledOrders) {
    const tx = o.transactionId
      ? store.find('ledgerTransactions', (t) => t.id === o.transactionId)
      : null;
    if (!tx) {
      discrepancies.push({ orderId: o.id, kind: 'settled_without_transaction' });
      continue;
    }
    if (tx.status !== 'settled') {
      discrepancies.push({ orderId: o.id, kind: 'transaction_not_settled', txStatus: tx.status });
    }
    if (tx.amount !== o.total) {
      discrepancies.push({
        orderId: o.id, kind: 'amount_mismatch', orderTotal: o.total, txAmount: tx.amount
      });
    }
  }

  // A transaction may legitimately exist without an order (a circle
  // contribution, a campaign payment). Only order-linked ones are checked.
  const platform = platformCommission(currency);
  const vendorIds = Array.from(new Set(settledOrders.map((o) => o.vendorId)));
  const summed = vendorIds.reduce((acc, id) => acc + vendorEarnings(id, currency).commission, 0);

  if (summed !== platform.commission) {
    discrepancies.push({
      kind: 'commission_sum_mismatch', perVendor: summed, platform: platform.commission
    });
  }

  return {
    currency,
    settledOrderCount: settledOrders.length,
    platform,
    balanced: discrepancies.length === 0,
    discrepancies
  };
}


// ---------------------------------------------------------------------------
// PAYOUT
//
// The last hop: settled earnings -> money in the seller's hand.
//
// There is deliberately NO vendor wallet. "Withdrawable" is derived on every
// read as (settled net - already paid - in flight), so a payout row can never
// disagree with the orders that justify it.
// ---------------------------------------------------------------------------

export const PAYOUT_STATUS = ['requested', 'processing', 'paid', 'failed'];

/**
 * Request a payout for a vendor.
 *
 * The AMOUNT IS DERIVED, never supplied. A caller asking for "all of it" is
 * the only supported request, because any other number invites a client to
 * ask for more than it earned.
 */
export function requestPayout({ vendorId, requestedBy, phone = null, idempotencyKey = null }) {
  const vendor = store.find('vendors', (v) => v.id === vendorId);
  if (!vendor) throw new Error('vendor not found');
  if (vendor.ownerId !== requestedBy) {
    throw new Error('only the vendor may request their own payout');
  }

  if (idempotencyKey) {
    const prior = store.find(
      'payouts',
      (p) => p.idempotencyKey === idempotencyKey && p.vendorId === vendorId
    );
    if (prior) return { payout: prior, reused: true };
  }

  // One payout in flight at a time. Two concurrent requests are the classic
  // way to be paid twice.
  const live = store.find(
    'payouts',
    (p) => p.vendorId === vendorId && (p.status === 'requested' || p.status === 'processing')
  );
  if (live) return { payout: live, reused: true };

  const earnings = vendorEarnings(vendorId);
  if (earnings.withdrawable <= 0) {
    throw new Error(
      earnings.net <= 0
        ? 'there are no settled earnings to pay out'
        : 'everything earned has already been paid out or is in flight'
    );
  }
  if (!mpesa.isPayoutConfigured()) {
    // Refuse rather than queue a payout Brief has no way to fulfil.
    const err = new Error(
      'payouts are unavailable: no payment provider is configured to disburse funds'
    );
    err.code = 'payout_not_configured';
    throw err;
  }

  const now = new Date().toISOString();
  const payout = store.insert('payouts', {
    id: newId('pout'),
    vendorId,
    ownerId: vendor.ownerId,
    // Derived from settled orders. Not a client-supplied figure.
    amount: earnings.withdrawable,
    currency: earnings.currency,
    phone: phone ? mpesa.normalisePhone(phone) : null,
    status: 'requested',
    provider: 'mpesa',
    providerRef: null,
    failureReason: null,
    idempotencyKey: idempotencyKey ?? null,
    createdAt: now,
    updatedAt: now
  });
  return { payout, reused: false };
}

/** Send a requested payout through the provider. */
export async function sendPayout(payoutId, { fetchImpl = fetch } = {}) {
  const payout = store.find('payouts', (p) => p.id === payoutId);
  if (!payout) throw new Error('payout not found');
  if (payout.status !== 'requested') {
    throw new Error(`this payout is already ${payout.status}`);
  }
  if (!payout.phone) throw new Error('a valid phone number is required');

  store.update('payouts', payout.id, { status: 'processing' });
  const res = await mpesa.b2cPayout({
    amount: Math.round(payout.amount),
    phone: payout.phone,
    remarks: `Brief payout ${payout.id}`,
    fetchImpl
  });

  if (!res.ok) {
    store.update('payouts', payout.id, { status: 'failed', failureReason: res.reason });
    return { ok: false, reason: res.reason, detail: res };
  }
  store.update('payouts', payout.id, { providerRef: res.conversationId });
  return { ok: true, providerRef: res.conversationId };
}

/**
 * Apply the provider's payout result. Idempotent: a re-delivered result for
 * an already-paid payout is a no-op, not a second disbursement.
 */
export function confirmPayout({ providerRef, succeeded, failureReason = null }) {
  const payout = store.find('payouts', (p) => p.providerRef === providerRef);
  if (!payout) return { ok: false, reason: 'unknown_reference' };
  if (payout.status === 'paid') return { ok: true, duplicate: true, payout };
  if (payout.status === 'failed') return { ok: false, reason: 'already failed', payout };

  const updated = store.update('payouts', payout.id, {
    status: succeeded ? 'paid' : 'failed',
    failureReason: succeeded ? null : (failureReason ?? 'provider reported failure'),
    paidAt: succeeded ? new Date().toISOString() : null
  });
  return { ok: true, payout: updated };
}

export function listPayouts(vendorId) {
  return store.filter('payouts', (p) => p.vendorId === vendorId);
}
