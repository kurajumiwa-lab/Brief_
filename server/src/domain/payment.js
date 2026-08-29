// ---------------------------------------------------------------------------
// PAYMENTS
//
// The bridge between an order and the ONE economic layer (ledgerTransactions).
// There is no second money store here: a payment intent is a record of an
// attempt, and the authoritative money event is still a ledger transaction.
//
// LIFECYCLE
//
//   intent      -- Brief decided what should be paid, server-side amount
//     |
//   authorized  -- the provider accepted the request (STK push sent)
//     |
//   confirmed   -- the provider CONFIRMED the customer paid (callback)
//     |
//   ledger tx   -- a settled transaction is created, once
//     |
//   settlement  -- the order becomes settled
//     |
//   payout      -- the seller is paid, minus derived commission
//
// A failure at any stage is an explicit terminal state, not a silent stall.
//
// WHAT PROTECTS THE MONEY
//
//   * amounts come from the ORDER ROW, never from the client or the callback
//   * one intent per (order, idempotency key)
//   * a provider reference is unique -- a replayed callback cannot pay twice
//   * a confirmed intent cannot be re-confirmed
//   * the callback amount is CHECKED against the intent and a mismatch fails
//     loudly rather than settling the wrong number
//   * settlement still requires a settled ledger row (unchanged rule)
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import {
  activeCollectionProvider,
  collectionProvider,
  providerStatus as providerStatusView
} from '../providers.js';
import { normalisePhone } from '../connectors/tuma.js';
import * as ledger from './ledger.js';

export const INTENT_STATUS = [
  'intent',
  'authorized',
  'confirmed',
  'failed',
  'cancelled',
  'reversed'
];

const TERMINAL = new Set(['confirmed', 'failed', 'cancelled', 'reversed']);

/**
 * Which provider is active for COLLECTION. Resolved through the provider
 * registry (see ../providers.js) -- Tuma is the gateway. Only a genuinely
 * configured provider counts; there is no "mock" provider, by design.
 */
export function activeProvider() {
  return activeCollectionProvider();
}

export function providerStatus() {
  return providerStatusView();
}

// ---------------------------------------------------------------------------
// INTENTS
// ---------------------------------------------------------------------------

/**
 * Create a payment intent for an order.
 *
 * THE AMOUNT IS READ FROM THE ORDER. A caller cannot pass one in. This is the
 * same rule that governs order totals, applied one layer further down where
 * the money actually moves.
 */
export function createIntent({ orderId, payerId, phone = null, idempotencyKey = null }) {
  const order = store.find('orders', (o) => o.id === orderId);
  if (!order) throw new Error('order not found');
  if (order.buyerId !== payerId) throw new Error('only the buyer may pay for this order');
  if (order.status === 'cancelled') throw new Error('this order was cancelled');
  if (order.status === 'settled') throw new Error('this order is already settled');

  const amount = order.total;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('this order has no payable amount');
  }

  // Idempotency, scoped to the payer as everywhere else in Brief.
  if (idempotencyKey) {
    const prior = store.find(
      'paymentIntents',
      (p) => p.idempotencyKey === idempotencyKey && p.payerId === payerId
    );
    if (prior) return { intent: prior, reused: true };
  }

  // An order must not accumulate parallel live intents -- two STK pushes for
  // one order is how a customer pays twice.
  const live = store.find(
    'paymentIntents',
    (p) => p.orderId === orderId && !TERMINAL.has(p.status)
  );
  if (live) return { intent: live, reused: true };

  const now = new Date().toISOString();
  const intent = store.insert('paymentIntents', {
    id: newId('pay'),
    orderId,
    payerId,
    vendorId: order.vendorId ?? null,
    amount,
    currency: order.currency ?? 'KES',
    phone: phone ? normalisePhone(phone) : null,
    status: 'intent',
    provider: activeProvider(),
    providerRef: null,
    receipt: null,
    transactionId: null,
    failureReason: null,
    idempotencyKey: idempotencyKey ?? null,
    createdAt: now,
    updatedAt: now
  });
  return { intent, reused: false };
}

export function getIntent(id) {
  return store.find('paymentIntents', (p) => p.id === id);
}

export function listIntentsForOrder(orderId) {
  return store.filter('paymentIntents', (p) => p.orderId === orderId);
}

/**
 * Ask the provider to collect. Refuses cleanly when nothing is configured --
 * this is the boundary that must never pretend.
 */
export async function requestPayment(intentId, { fetchImpl = fetch } = {}) {
  const intent = getIntent(intentId);
  if (!intent) throw new Error('payment intent not found');
  if (intent.status !== 'intent') {
    throw new Error(`this payment is already ${intent.status}`);
  }
  if (!intent.phone) throw new Error('a valid phone number is required');

  const providerName = activeCollectionProvider();
  if (!providerName) {
    return {
      ok: false,
      reason: 'no_provider',
      message: providerStatus().reason,
      status: providerStatus()
    };
  }
  const provider = collectionProvider(providerName);

  const res = await provider.collect({
    amount: Math.round(intent.amount),
    phone: intent.phone,
    description: `Brief order ${intent.orderId.slice(-12)}`,
    fetchImpl
  });

  if (!res.ok) {
    store.update('paymentIntents', intent.id, {
      status: 'failed',
      failureReason: res.reason
    });
    return { ok: false, reason: res.reason, detail: res };
  }

  store.update('paymentIntents', intent.id, {
    status: 'authorized',
    providerRef: res.checkoutRequestId,
    providerMerchantRef: res.merchantRequestId ?? null,
    providerPaymentId: res.paymentId ?? null
  });
  return {
    ok: true,
    providerRef: res.checkoutRequestId,
    // Hosted-checkout providers (Paystack) hand the payer a URL; STK
    // providers (Tuma) do not. Additive either way.
    authorizationUrl: res.authorizationUrl ?? null,
    customerMessage: res.customerMessage
  };
}

// ---------------------------------------------------------------------------
// CONFIRMATION
// ---------------------------------------------------------------------------

/**
 * Apply a provider callback.
 *
 * Every defence lives here because this is the one place an attacker (or a
 * confused provider retry) can try to create money:
 *
 *   1. the intent must exist and be awaiting confirmation
 *   2. a REPLAYED receipt is refused -- receipts are unique across all intents
 *   3. a re-delivered callback for an already-confirmed intent is a NO-OP that
 *      returns the original transaction, not an error and not a second payment
 *   4. the amount is checked against the intent; a mismatch FAILS the payment
 *   5. exactly one ledger transaction is created, and it is the authority
 */
export function confirmPayment({ providerRef, succeeded, amount, receipt, failureReason = null, cancelled = false }) {
  const intent = store.find('paymentIntents', (p) => p.providerRef === providerRef);
  if (!intent) return { ok: false, reason: 'unknown_reference' };

  // (3) Duplicate callback for a settled payment: idempotent no-op.
  if (intent.status === 'confirmed') {
    return {
      ok: true,
      duplicate: true,
      intent,
      transactionId: intent.transactionId
    };
  }
  if (TERMINAL.has(intent.status)) {
    return { ok: false, reason: `payment already ${intent.status}`, intent };
  }

  if (!succeeded) {
    // A customer cancelling on their handset is a DIFFERENT terminal state
    // from a provider-side failure -- the UI states them separately, and an
    // operator reconciling later can tell the two apart.
    const status = cancelled ? 'cancelled' : 'failed';
    const updated = store.update('paymentIntents', intent.id, {
      status,
      failureReason: failureReason ?? (cancelled ? 'payment cancelled by customer' : 'provider reported failure'),
      failedAt: new Date().toISOString()
    });
    return { ok: true, failed: true, cancelled, intent: updated };
  }

  // (2) Replay protection: a receipt may back exactly one payment, ever.
  if (receipt) {
    const seen = store.find(
      'paymentIntents',
      (p) => p.receipt === receipt && p.id !== intent.id
    );
    if (seen) return { ok: false, reason: 'replayed_receipt', intent };
  }

  // (4) The provider's amount must match what Brief asked for. A mismatch is
  // never quietly accepted -- underpayment would settle an order that was not
  // paid for, and overpayment indicates a bug worth stopping on.
  const paid = Number(amount);
  if (Number.isFinite(paid) && Math.round(paid) !== Math.round(intent.amount)) {
    const updated = store.update('paymentIntents', intent.id, {
      status: 'failed',
      failureReason: `amount mismatch: expected ${intent.amount}, provider reported ${paid}`
    });
    return { ok: false, reason: 'amount_mismatch', intent: updated };
  }

  // (5) ONE ledger transaction. This is the authoritative money event; the
  // intent is only the story of how it came to exist.
  const tx = ledger.createTransaction({
    amount: intent.amount,
    currency: intent.currency,
    type: 'sale',
    description: `Order ${intent.orderId}`,
    counterparty: intent.payerId,
    metadata: {
      orderId: intent.orderId,
      provider: intent.provider,
      providerRef: intent.providerRef,
      receipt: receipt ?? null
    }
  });
  // Walk the ledger's real transition path rather than jumping to settled.
  // Each hop is recorded in the transaction's history, so the money has an
  // audit trail showing exactly when the provider accepted and confirmed it.
  ledger.transitionTransaction(tx.id, 'pending', 'sent to payment provider');
  ledger.transitionTransaction(tx.id, 'confirmed', `provider confirmed${receipt ? ` (${receipt})` : ''}`);
  ledger.transitionTransaction(tx.id, 'settled', 'funds received');

  const updated = store.update('paymentIntents', intent.id, {
    status: 'confirmed',
    receipt: receipt ?? null,
    transactionId: tx.id,
    confirmedAt: new Date().toISOString()
  });

  return { ok: true, intent: updated, transactionId: tx.id, transaction: tx };
}

/**
 * Reconcile Brief's intents against provider references.
 *
 * Answers "is there anything we think happened that the provider has no
 * record of, or vice versa" -- the question that matters after an outage.
 */
export function reconcileIntents() {
  const intents = store.all('paymentIntents');
  const discrepancies = [];

  for (const p of intents) {
    if (p.status === 'confirmed') {
      if (!p.transactionId) {
        discrepancies.push({ kind: 'confirmed_without_transaction', intentId: p.id });
        continue;
      }
      const tx = store.find('ledgerTransactions', (t) => t.id === p.transactionId);
      if (!tx) {
        discrepancies.push({ kind: 'missing_transaction', intentId: p.id, transactionId: p.transactionId });
      } else if (tx.status !== 'settled') {
        discrepancies.push({ kind: 'transaction_not_settled', intentId: p.id, status: tx.status });
      } else if (Math.round(tx.amount) !== Math.round(p.amount)) {
        discrepancies.push({ kind: 'amount_drift', intentId: p.id, intent: p.amount, ledger: tx.amount });
      }
      if (!p.providerRef) {
        discrepancies.push({ kind: 'confirmed_without_provider_reference', intentId: p.id });
      }
    }
    // A stalled authorization is not an error, but it IS something an
    // operator needs to see rather than discover from a customer.
    if (p.status === 'authorized') {
      const ageMs = Date.now() - Date.parse(p.createdAt);
      if (ageMs > 15 * 60 * 1000) {
        discrepancies.push({ kind: 'authorization_stalled', intentId: p.id, ageMinutes: Math.round(ageMs / 60000) });
      }
    }
  }

  // Receipts must be unique. A duplicate means replay protection was bypassed.
  const receipts = intents.filter((p) => p.receipt).map((p) => p.receipt);
  const dupes = receipts.filter((r, i) => receipts.indexOf(r) !== i);
  for (const r of new Set(dupes)) {
    discrepancies.push({ kind: 'duplicate_receipt', receipt: r });
  }

  return {
    intentCount: intents.length,
    confirmed: intents.filter((p) => p.status === 'confirmed').length,
    failed: intents.filter((p) => p.status === 'failed').length,
    balanced: discrepancies.length === 0,
    discrepancies
  };
}
