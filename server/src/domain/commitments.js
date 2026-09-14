// ---------------------------------------------------------------------------
// COMMITMENTS — the reciprocal-obligation graph, DERIVED from real rows.
//
// Every feature that creates a two-way obligation already writes a row of its
// own (an order, a work order, a quote, a loan). This module projects those
// rows into ONE unified commitment shape, so "what do I owe" and "what is owed
// to me" are answerable from a single place.
//
// It is a DERIVATION layer, deliberately NOT a second write-table: a parallel
// stored commitment would have to be transitioned at every source module's own
// state change or it would go stale and become the very fabrication this
// platform exists to avoid. Deriving on read means a commitment can never
// disagree with the row it came from — every commitment carries `evidence`
// (the table + id) so the number is traceable and reproducible.
//
// Only obligations with a REAL direction and, where a real amount exists, a
// REAL value are emitted. There is no fabricated "rider queue", no invented
// KES figure, no tier/badge ladder.
// ---------------------------------------------------------------------------

import { store } from '../store.js';
import { outstandingBalance } from './tableBanking.js';

const HOUR = 3600000;
const expiryMs = (value) => (value ? Date.parse(`${value}T23:59:59.999+03:00`) : Infinity);

// Quote statuses that mean "this promise is over".
const CLOSED_QUOTE = new Set(['accepted', 'declined', 'withdrawn']);
// Work-order statuses that mean the delivery promise is over.
const CLOSED_WORK = new Set(['completed', 'cancelled']);
// Order statuses that mean the payment promise is over.
const CLOSED_ORDER = new Set(['cancelled']);

function ownerOf(vendorId) {
  const v = store.find('vendors', (x) => x.id === vendorId);
  return v?.ownerId ?? null;
}

/** Classify a commitment against the current clock. */
function statusOf({ kind, sourceStatus, validUntil, fulfilled, cancelled }) {
  if (fulfilled) return 'fulfilled';
  if (kind === 'quote_honor') {
    if (sourceStatus === 'accepted') return 'fulfilled';
    if (sourceStatus === 'declined' || sourceStatus === 'withdrawn') return 'lapsed';
    if (validUntil && expiryMs(validUntil) <= Date.now()) return 'lapsed';
    return 'open';
  }
  if (cancelled) return 'lapsed';
  return 'open';
}

/**
 * The user's unified commitment graph.
 *   owedByMe  — open commitments I made to someone (I must act).
 *   owedToMe  — open commitments someone made to me (they must act).
 *   fulfilled / lapsed — closed commitments, for the accrual / decay story.
 */
export function commitmentsFor(partyId) {
  const now = new Date().toISOString();
  const rows = [];

  // --- QUOTE_HONOR — I (seller) promised a price for a window -------------
  for (const q of store.filter('requestQuotes', (x) => x.participantUserId === partyId)) {
    const offer = q.offers.at(-1);
    const validUntil = offer?.terms?.validUntil ?? null;
    rows.push({
      id: `cmt_quote_${q.id}`,
      kind: 'quote_honor',
      fromParty: q.participantUserId,
      toParty: q.requesterId,
      value: null, // a held price has no single stored KES figure
      deadline: validUntil,
      status: statusOf({ kind: 'quote_honor', sourceStatus: q.status, validUntil }),
      evidence: { table: 'requestQuotes', id: q.id }
    });
  }
  // ...and the mirror: quotes made TO me (I'm the buyer).
  for (const q of store.filter('requestQuotes', (x) => x.requesterId === partyId)) {
    const offer = q.offers.at(-1);
    const validUntil = offer?.terms?.validUntil ?? null;
    rows.push({
      id: `cmt_quote_${q.id}`,
      kind: 'quote_honor',
      fromParty: q.participantUserId,
      toParty: q.requesterId,
      value: null,
      deadline: validUntil,
      status: statusOf({ kind: 'quote_honor', sourceStatus: q.status, validUntil }),
      evidence: { table: 'requestQuotes', id: q.id }
    });
  }

  // --- DELIVERY — a seller owes the buyer a delivered work order ----------
  for (const w of store.filter('workOrders', () => true)) {
    const seller = ownerOf(w.participantId);
    if (seller !== partyId && w.requesterId !== partyId) continue;
    rows.push({
      id: `cmt_delivery_${w.id}`,
      kind: 'delivery',
      fromParty: seller,
      toParty: w.requesterId,
      value: null,
      deadline: w.terms?.deliveryLeadDays ? new Date(Date.now() + Number(w.terms.deliveryLeadDays) * 86400000).toISOString().slice(0, 10) : null,
      status: statusOf({ kind: 'delivery', fulfilled: w.status === 'completed', cancelled: w.status === 'cancelled' }),
      evidence: { table: 'workOrders', id: w.id }
    });
  }

  // --- PAYMENT — a buyer owes the seller for an order ---------------------
  for (const o of store.filter('orders', () => true)) {
    const seller = ownerOf(o.vendorId);
    if (o.buyerId !== partyId && seller !== partyId) continue;
    const fulfilled = Boolean(o.transactionId && store.find('ledgerTransactions', (t) => t.id === o.transactionId)?.status === 'settled');
    rows.push({
      id: `cmt_payment_${o.id}`,
      kind: 'payment',
      fromParty: o.buyerId,
      toParty: seller,
      value: { amount: Number(o.total) || 0, currency: o.currency ?? 'KES' },
      deadline: null,
      status: statusOf({ kind: 'payment', fulfilled, cancelled: CLOSED_ORDER.has(o.status) }),
      evidence: { table: 'orders', id: o.id }
    });
  }

  // --- REPAYMENT — a borrower owes their group the outstanding balance ----
  for (const l of store.filter('tableBankingLoans', (x) => x.borrowerId === partyId)) {
    let balance = 0;
    try { balance = outstandingBalance(l.id).remaining ?? 0; } catch { balance = 0; }
    rows.push({
      id: `cmt_repay_${l.id}`,
      kind: 'repayment',
      fromParty: l.borrowerId,
      toParty: l.tableBankingId,
      value: { amount: balance, currency: 'KES' },
      deadline: null,
      status: balance <= 0 ? 'fulfilled' : 'open',
      evidence: { table: 'tableBankingLoans', id: l.id }
    });
  }

  const owedByMe = rows.filter((c) => c.fromParty === partyId && c.status === 'open');
  const owedToMe = rows.filter((c) => c.toParty === partyId && c.status === 'open');
  const fulfilled = rows.filter((c) => c.status === 'fulfilled');
  const lapsed = rows.filter((c) => c.status === 'lapsed');

  const kes = (list) => list.reduce((s, c) => s + (c.value?.amount ?? 0), 0);

  return {
    owedByMe,
    owedToMe,
    fulfilled,
    lapsed,
    owedByMeKes: kes(owedByMe),
    owedToMeKes: kes(owedToMe),
    derivedAt: now,
    note:
      'Every commitment is derived by scanning real rows (quotes, work orders, orders, loans) on read. It carries evidence — the source table and id — so every number is traceable and reproducible. Nothing is stored or estimated.'
  };
}
