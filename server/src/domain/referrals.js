// ---------------------------------------------------------------------------
// REFERRALS — rewards for bringing people, products, services and traffic.
// The ANTI-PYRAMID, stated as code:
//
//   1. Depth is hard-capped at ONE level. A referral credits the direct
//      referrer only; there is no chain upward, and no event kind exists
//      that could pay a level above the first.
//   2. There is no entry fee anywhere in the product, so no member's money
//      ever funds an earlier member's reward.
//   3. Points become cash ONLY from a derived pool backed by real confirmed
//      revenue: floor(POOL_RATE x confirmed service-fee revenue) minus what
//      has already been paid or is pending payout. When the pool is empty,
//      conversion is REFUSED with the reason — a reward is marketing spend
//      the business actually earned, never tomorrow's recruit.
//
// Points are earned from real, deduplicated events (signups, purchases,
// referred activity, genuine link traffic) and every total below is DERIVED
// by scanning rows. A pyramid pays members with members; this pays members
// with margin, and says which is which.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { getUser } from './auth.js';
import { confirmedServiceRevenue } from './fees.js';
import { createTransaction, transitionTransaction } from './ledger.js';
import { notify } from './notifications.js';

/** The single structural anti-pyramid constant. Assertions in the test suite
 *  pin it at 1; if anyone raises it, a test fails and asks why. */
export const MAX_REFERRAL_DEPTH = 1;

export const POINTS = {
  signup: 100,          // a real new member, once, ever
  perHundredKes: 5,     // purchase + referral_order: 5 pts per KES 100
  eventSignup: 25,      // a public event registration through your link
  traffic: 1,           // one unique visit through your link
  trafficPerDay: 50     // daily cap — traffic points cannot be farmed
};
export const CONVERSION = { ptsToKes: 0.10, minPoints: 500 };
export const POOL_RATE = 0.10; // of confirmed service-fee revenue

/** A member's referral code is DERIVED from their handle — nothing to guess,
 *  nothing extra to store, stable for the life of the account. */
export function referralCodeOf(userId) {
  const u = getUser(userId);
  if (!u?.handle) return null;
  return String(u.handle).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || null;
}

export function userIdForCode(code) {
  const want = String(code ?? '').trim().toUpperCase();
  if (!want) return null;
  return store.find('users', (u) => referralCodeOf(u.id) === want)?.id ?? null;
}

function eventExists(key) {
  return Boolean(store.find('referralEvents', (e) => e.key === key));
}

/** Someone joined with a referrer's code. Credits the DIRECT referrer only,
 *  once per new member, never the referrer's referrer. */
export function recordSignup(newUserId, code) {
  if (!newUserId) return null;
  const referrerId = userIdForCode(code);
  if (!referrerId || referrerId === newUserId) return null;
  const key = `signup:${newUserId}`;
  if (eventExists(key)) return null; // once, ever
  return store.insert('referralEvents', {
    id: newId('refv'), kind: 'signup', key,
    actorId: newUserId, referrerId,
    points: POINTS.signup, valueKes: 0,
    at: new Date().toISOString()
  });
}

/** An order reached FULFILLED: the buyer earns purchase points and, if a
 *  referrer brought the buyer, the referrer earns the same once per order.
 *  Idempotent per order — replaying fulfilment cannot mint points. */
export function recordOrder(orderId) {
  const order = store.find('orders', (o) => o.id === orderId);
  if (!order || order.status !== 'fulfilled') return null;
  const total = Number(order.totals?.total ?? order.total ?? 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  const points = Math.floor(total / 100) * POINTS.perHundredKes;
  if (points <= 0) return null;

  const rows = [];
  if (!eventExists(`purchase:${orderId}`)) {
    rows.push(store.insert('referralEvents', {
      id: newId('refv'), kind: 'purchase', key: `purchase:${orderId}`,
      actorId: order.buyerId, referrerId: null, points, valueKes: total,
      at: new Date().toISOString()
    }));
  }
  const refEvent = store.find('referralEvents', (e) => e.key === `signup:${order.buyerId}`);
  if (refEvent && !eventExists(`referral_order:${orderId}`)) {
    rows.push(store.insert('referralEvents', {
      id: newId('refv'), kind: 'referral_order', key: `referral_order:${orderId}`,
      actorId: order.buyerId, referrerId: refEvent.referrerId, points, valueKes: total,
      at: new Date().toISOString()
    }));
  }
  return rows;
}

/** One unique visit through a referral link: deduped by day+visitor, and
 *  capped per referrer per day so traffic points cannot be farmed. */
export function recordTraffic(code, visitorKey, day = new Date().toISOString().slice(0, 10)) {
  const referrerId = userIdForCode(code);
  if (!referrerId) return null;
  const key = `traffic:${referrerId}:${day}:${String(visitorKey ?? '').slice(0, 64)}`;
  if (eventExists(key)) return null;
  const today = store.filter('referralEvents', (e) => e.kind === 'traffic' && e.referrerId === referrerId && e.day === day);
  if (today.length >= POINTS.trafficPerDay) return null; // daily cap
  return store.insert('referralEvents', {
    id: newId('refv'), kind: 'traffic', key, day,
    actorId: null, referrerId, points: POINTS.traffic, valueKes: 0,
    at: new Date().toISOString()
  });
}

/** A public event registration through a member's link. */
export function recordEventSignup(code, campaignId, attendeeRef) {
  const referrerId = userIdForCode(code);
  if (!referrerId) return null;
  const key = `event_signup:${campaignId}:${String(attendeeRef ?? Math.random()).slice(0, 80)}`;
  if (eventExists(key)) return null;
  return store.insert('referralEvents', {
    id: newId('refv'), kind: 'event_signup', key, day: null,
    actorId: null, referrerId, points: POINTS.eventSignup, valueKes: 0,
    at: new Date().toISOString()
  });
}

/** Points balance: earned minus what is locked in pending/confirmed
 *  conversions. Derived, never stored. */
export function pointsBalance(userId) {
  const earned = store.all('referralEvents')
    .filter((e) => e.referrerId === userId || (e.kind === 'purchase' && e.actorId === userId))
    .reduce((s, e) => s + e.points, 0);
  const locked = store.all('referralConversions')
    .filter((c) => c.userId === userId && (c.status === 'pending' || c.status === 'confirmed'))
    .reduce((s, c) => s + c.points, 0);
  return { earned, locked, available: Math.max(0, earned - locked) };
}

/** The honest pool: a fixed fraction of CONFIRMED service-fee revenue, minus
 *  everything already paid or promised. It can be zero, and the surface says
 *  so instead of printing money. */
export function rewardPool() {
  const backing = Math.floor(POOL_RATE * confirmedServiceRevenue());
  const paidOrPromised = store.all('referralConversions')
    .filter((c) => c.status === 'pending' || c.status === 'confirmed')
    .reduce((s, c) => s + c.kes, 0);
  return { backingKes: backing, paidOrPromisedKes: paidOrPromised, availableKes: Math.max(0, backing - paidOrPromised) };
}

/** Convert points to cash — allowed only inside the pool. Payout itself is
 *  manual (M-Pesa to the member's number), confirmed by finance, exactly
 *  like the Pochi service-fee flow. */
export function requestConversion(userId, points) {
  if (!userId) throw new Error('sign in to convert points');
  const pts = Math.floor(Number(points));
  if (!Number.isFinite(pts) || pts < CONVERSION.minPoints) {
    throw new Error(`convert at least ${CONVERSION.minPoints} points (KES ${CONVERSION.minPoints * CONVERSION.ptsToKes})`);
  }
  const bal = pointsBalance(userId);
  if (pts > bal.available) throw new Error(`you have ${bal.available} points available`);
  const kes = Math.floor(pts * CONVERSION.ptsToKes);
  const pool = rewardPool();
  if (kes > pool.availableKes) {
    const e = new Error(`the rewards pool holds KES ${pool.availableKes} right now — conversions are backed by real confirmed revenue only`);
    e.status = 409;
    throw e;
  }
  const tx = createTransaction({
    amount: kes, type: 'referral_payout',
    description: `Referral payout (${pts} points)`, counterparty: userId,
    metadata: { points: pts }
  });
  transitionTransaction(tx.id, 'pending', 'awaiting manual M-Pesa payout');
  return store.insert('referralConversions', {
    id: newId('refc'), userId, points: pts, kes,
    ledgerId: tx.id, status: 'pending',
    confirmedBy: null, confirmedAt: null, refusedReason: null,
    createdAt: new Date().toISOString()
  });
}

/** Finance confirms the payout happened (or refuses with a reason). */
export function respondConversion(operatorId, conversionId, { accept, note = '' } = {}) {
  const row = store.find('referralConversions', (c) => c.id === conversionId);
  if (!row) throw new Error('conversion not found');
  if (row.status !== 'pending') throw new Error(`this conversion is already ${row.status}`);
  const reason = String(note ?? '').trim();
  if (!accept) {
    if (reason.length < 4) throw new Error('say why the payout is refused');
    transitionTransaction(row.ledgerId, 'failed', reason.slice(0, 200));
    const refused = store.update('referralConversions', row.id, { status: 'refused', refusedReason: reason.slice(0, 300) });
    notify(row.userId, { kind: 'system', title: 'Your points conversion could not be paid', body: `${reason.slice(0, 140)}. Your points are back in your balance.` });
    return refused;
  }
  transitionTransaction(row.ledgerId, 'confirmed', 'M-Pesa payout confirmed by finance');
  const confirmed = store.update('referralConversions', row.id, {
    status: 'confirmed', confirmedBy: operatorId, confirmedAt: new Date().toISOString()
  });
  notify(row.userId, { kind: 'system', title: 'Your referral payout is sent', body: `KES ${row.kes} for ${row.points} points has been paid to your number.` });
  return confirmed;
}

export function myConversions(userId) {
  return store.all('referralConversions')
    .filter((c) => c.userId === userId)
    .slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** The referrer's earned events, for the balance breakdown. */
export function myEvents(userId) {
  return store.all('referralEvents')
    .filter((e) => e.referrerId === userId || (e.kind === 'purchase' && e.actorId === userId))
    .slice().sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 30);
}
