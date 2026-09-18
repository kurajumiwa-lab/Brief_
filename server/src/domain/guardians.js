// ---------------------------------------------------------------------------
// GUARDIANS — shop-level attribution: "you registered this shop, so you have a
// reason to care".
//
// The model the owner asked for: a business brought to Brief stays tied to the
// person who brought it; when it does well they earn; when it starts collecting
// complaints they are told, because they are the only party with a relationship
// to lose. A network of guardians, each watching one shop, out of self-interest
// rather than altruism.
//
// That model is a machine for producing invented money and invented trust, so
// every rule below exists to stop it doing either:
//
//   1. THE SHOP CONFIRMS, OR IT IS WORTH NOTHING. Anyone may say "I registered
//      that shop". The claim is stored as `pending_owner` and credits nothing
//      until the space's own owner confirms it. That single gate is what stops
//      the whole scheme being a farming tool: register a hundred shops in other
//      people's names, then bill the platform.
//   2. ONE GUARDIAN PER SHOP, NO SELF-CLAIM, NO QUEUE. The first claim holds the
//      slot; the owner can never attribute their own shop; a second claimant is
//      refused with the reason rather than queued. Pending claims are capped per
//      member, because every one of them is a notification to somebody else.
//   3. A DISPUTE IS A WALL. If the shop says no, nobody may re-claim it. Brief
//      has no mediator, so it does not host the argument a second time — and
//      "claim, get disputed, claim again" would otherwise be a free way to
//      notify a shop owner forever.
//   4. THE GUARDIAN IS PAID FROM THE REWARDS POOL, NOT OUT OF THE SHOP. Brief
//      charges no percentage fee on an order, so "1% of our 5%" has no source row
//      to come from, and a share defined against it would be money printed at
//      night. A guardian instead earns POINTS on the shop's settled orders;
//      points become cash only inside `referrals.rewardPool()` — a fraction of
//      CONFIRMED service-fee revenue, capped per order by DISTRIBUTION_CAP, and
//      paid only after finance confirms the payout. The shop is shown the exact
//      sentence, including that nothing is deducted from what it earns.
//   5. THE POINTS ARE THE REFERRAL MODULE'S ROWS. This file does not open a
//      second ledger, a second settlement table or a second payout path. One
//      book, one queue, one human confirming money.
//   6. NO STACKING ON THE FIELD-AGENT RAILS. A vendor already held by an active
//      `full_registration` territory claim earns its guardian nothing — two
//      overlapping shares on one order is how a 6.5% budget quietly becomes 1.25%
//      twice.
//   7. COMPLAINTS COUNT ONLY FROM SIGNED-IN ROWS, ONE PER PERSON. Anonymous form
//      reports are recorded and readable; they cannot touch a guardian's credit.
//      Otherwise three taps on a public form would freeze somebody's earnings,
//      and the cheapest attack on this product would be its own report button.
//   8. NO RATINGS, NO RATE, NO STANDING SCORE. Brief holds no review rows for a
//      shop's orders, so there is no average to show; and a complaint *rate* needs
//      a denominator of transactions nobody counts. A guardian sees counts of
//      rows that exist, plus the shop's own answer-freshness state.
//   9. BRIEF DOES NOT REMOVE SHOPS HERE. Past the suspension threshold the credit
//      freezes and the facts are escalated to an operator. The shop stays up,
//      because there is no reviewer in this product, and "we will take it down"
//      would be a policy nobody enforces.
//
// Not to be confused with `domain/attribution.js`, which is about how a MEMBER
// arrived (partner → program → cohort → invite) and what their cohort went on to
// do. This module is one shop, one guardian, and that shop's own confirmation.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { notify } from './notifications.js';
import { emitSignal } from './signal.js';
import { getUser } from './auth.js';
import * as profile from './spaceProfile.js';

/** What one settled KES 100 credits the guardian, in points. Conversion, the
 *  pool and the cap all belong to `referrals.js`, deliberately. */
export const GUARDIAN_POINTS_PER_HUNDRED_KES = 1;
export const GUARDIAN_MONTHS = 24;
export const FLAG_AFTER_REPORTS = 3;      // credit pauses, guardian is told
export const SUSPEND_AFTER_REPORTS = 6;   // credit freezes, operators are told
export const PENDING_CLAIM_CAP = 10;
export const GUARDIAN_STATUS = ['pending_owner', 'active', 'disputed', 'revoked', 'expired'];

const DAY = 86400000;
const now = () => new Date().toISOString();
const clean = (v, max) => String(v ?? '').trim().slice(0, max);

function fail(message, status = 400, code = 'validation_error') {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  throw e;
}

/**
 * The status a link has RIGHT NOW, derived on read. `flagged` and `suspended`
 * are never stored: they are what the current count of signed-in reports means,
 * so a report handled yesterday stops costing the guardian today.
 */
export function effectiveStatus(link, { nowMs = Date.now(), reports = null } = {}) {
  if (!link) return null;
  const base = link.status;
  if (base !== 'active') return { status: base, reason: null, reports: 0 };
  const expires = Date.parse(link.expiresAt ?? '');
  if (Number.isFinite(expires) && nowMs > expires) {
    return { status: 'expired', reason: `the ${GUARDIAN_MONTHS}-month window closed`, reports: 0 };
  }
  const n = reports ?? reportCount(link.spaceId);
  if (n >= SUSPEND_AFTER_REPORTS) {
    return { status: 'suspended', reason: `${n} signed-in reports on this shop are open`, reports: n };
  }
  if (n >= FLAG_AFTER_REPORTS) {
    return { status: 'flagged', reason: `${n} signed-in reports on this shop are open`, reports: n };
  }
  return { status: 'active', reason: null, reports: n };
}

/** Report rows that can affect a guardian: signed-in, one per person, open. */
export function reportCount(spaceId) {
  const seen = new Set();
  let n = 0;
  for (const r of store.filter('spaceAbuseReports', (x) => x.spaceId === spaceId && !x.handledAt)) {
    if (!r.reporterId) continue;              // an anonymous form row is read, not counted
    if (seen.has(r.reporterId)) continue;     // one person, one open report
    seen.add(r.reporterId);
    n += 1;
  }
  return n;
}

/** A vendor held by an active field-agent territory claim: no second share. */
function agentHoldsVendor(vendorId) {
  if (!vendorId) return false;
  return Boolean(store.find('vendorClaims', (c) =>
    c.vendorId === vendorId && c.claimType === 'full_registration' && c.status === 'active'));
}

/**
 * Claim a shop you introduced. Refused: no session, the shop's own owner, an
 * unknown or private shop, a shop that already has a guardian, a shop that
 * already said no, a member past the pending cap, and a vendor an agent holds.
 */
export function claimSpace({ actorId, spaceId, note = null } = {}) {
  if (!actorId) fail('sign in to attribute a business', 401, 'no_session');
  if (!getUser(actorId)) fail('no such member', 404, 'not_found');
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) fail('no such space', 404, 'not_found');
  if (space.ownerId === actorId) {
    fail('this is your own space — a guardian is somebody else who brought it in', 403, 'self_claim');
  }
  if (space.visibility !== 'public' || space.status !== 'active') {
    fail('only a public, active space can be attributed', 409, 'not_public');
  }
  const existing = store.find('attributions', (a) =>
    a.spaceId === space.id && ['pending_owner', 'active'].includes(a.status));
  if (existing) {
    fail(existing.actorId === actorId
      ? 'you already hold this business'
      : 'somebody else already claimed this business, and Brief does not queue guardians', 409, 'already_claimed');
  }
  if (store.find('attributions', (a) => a.spaceId === space.id && a.status === 'disputed')) {
    fail('this shop disputed an introduction before, and Brief does not re-open one the shop said no to', 409, 'previously_disputed');
  }
  const openPending = store.filter('attributions', (a) => a.actorId === actorId && a.status === 'pending_owner').length;
  if (openPending >= PENDING_CLAIM_CAP) {
    fail(`you have ${openPending} claims waiting for an answer — the cap is ${PENDING_CLAIM_CAP}, so shops get asked at a rate they can answer`, 429, 'pending_cap');
  }
  if (agentHoldsVendor(space.vendorId)) {
    fail('a field agent already holds this vendor, so a second share on the same orders is refused', 409, 'agent_held');
  }

  const at = now();
  const row = store.insert('attributions', {
    id: newId('att'),
    spaceId: space.id,
    vendorId: space.vendorId ?? null,
    actorId,
    ownerId: space.ownerId,
    note: clean(note, 240) || null,
    status: 'pending_owner',
    claimedAt: at,
    confirmedAt: null,
    confirmedBy: null,
    disputedAt: null,
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
    // The window opens at CONFIRMATION, not at the claim: a claim that accrues
    // time while unconfirmed is a claim that accrues nothing but the ability to
    // say "I was here first" for two years.
    startsAt: null,
    expiresAt: null,
    lastReviewedReports: 0,
    lastReviewedAt: null,
    createdAt: at,
    updatedAt: at
  });
  emitSignal({ type: 'guardian_claimed', actorId, metadata: { attributionId: row.id, spaceId: space.id, ownerId: space.ownerId } });
  notifyQuiet(space.ownerId, {
    type: 'system',
    title: 'Somebody says they brought you to Brief',
    body: `${nameOf(actorId)} claims they registered ${space.name}. Nothing is paid to anyone and nothing changes until you confirm or dispute it.`,
    dedupeKey: `guardian:claim:${row.id}`
  });
  return {
    attribution: row,
    note: 'Recorded as pending. It credits nothing until the shop confirms it.',
    pointsPerHundredKes: GUARDIAN_POINTS_PER_HUNDRED_KES,
    months: GUARDIAN_MONTHS
  };
}

/** The shop's owner confirms the introduction. The only gate on any money. */
export function confirmClaim({ actorId, attributionId } = {}) {
  const row = mustFind(attributionId);
  if (actorId !== row.ownerId) fail('only the shop owner can confirm this', 403, 'not_owner');
  if (row.status !== 'pending_owner') fail(`this claim is already ${row.status}`, 409, 'invalid_state');
  const at = now();
  const updated = store.update('attributions', row.id, {
    status: 'active',
    confirmedAt: at,
    confirmedBy: actorId,
    startsAt: at,
    expiresAt: new Date(Date.now() + GUARDIAN_MONTHS * 30 * DAY).toISOString(),
    updatedAt: at
  });
  emitSignal({ type: 'guardian_confirmed', actorId, metadata: { attributionId: row.id, spaceId: row.spaceId, guardianId: row.actorId } });
  notifyQuiet(row.actorId, {
    type: 'system',
    title: 'Your introduction was confirmed',
    body: `${spaceName(row.spaceId)} confirmed you introduced them. You now earn ${GUARDIAN_POINTS_PER_HUNDRED_KES} point per KES 100 that settles through that shop, for ${GUARDIAN_MONTHS} months.`,
    dedupeKey: `guardian:confirm:${row.id}`
  });
  return { attribution: updated, pointsPerHundredKes: GUARDIAN_POINTS_PER_HUNDRED_KES, months: GUARDIAN_MONTHS };
}

/** The shop says it did not happen. The link ends; the record stays. */
export function disputeClaim({ actorId, attributionId, reason = '' } = {}) {
  const row = mustFind(attributionId);
  if (actorId !== row.ownerId) fail('only the shop owner can dispute this', 403, 'not_owner');
  if (!['pending_owner', 'active'].includes(row.status)) fail(`this claim is already ${row.status}`, 409, 'invalid_state');
  const why = clean(reason, 300);
  const at = now();
  const updated = store.update('attributions', row.id, {
    status: 'disputed',
    disputedAt: at,
    revokedAt: at,
    revokedBy: actorId,
    revokeReason: why || 'the shop owner said they were not registered by this person',
    updatedAt: at
  });
  emitSignal({ type: 'guardian_disputed', actorId, metadata: { attributionId: row.id, spaceId: row.spaceId } });
  notifyQuiet(row.actorId, {
    type: 'system',
    title: 'The shop disputed your claim',
    body: why ? `Their words: ${why.slice(0, 160)}` : 'They said they were not registered by you. The link is closed and credits nothing.',
    dedupeKey: `guardian:dispute:${row.id}`
  });
  return { attribution: updated, note: 'A disputed shop cannot be claimed again. Brief has no mediator, so it does not host the argument twice.' };
}

/** Either party can end it, with a reason. Nothing is deleted. */
export function revokeClaim({ actorId, attributionId, reason } = {}) {
  const row = mustFind(attributionId);
  if (actorId !== row.actorId && actorId !== row.ownerId) fail('not yours to revoke', 403, 'not_party');
  const why = clean(reason, 300);
  if (why.length < 6) fail('say why the attribution is ending — a reason is the record', 400, 'reason_required');
  if (!['pending_owner', 'active'].includes(row.status)) fail(`this claim is already ${row.status}`, 409, 'invalid_state');
  const at = now();
  const updated = store.update('attributions', row.id, { status: 'revoked', revokedAt: at, revokedBy: actorId, revokeReason: why, updatedAt: at });
  emitSignal({ type: 'guardian_revoked', actorId, metadata: { attributionId: row.id, spaceId: row.spaceId, by: actorId } });
  for (const other of [row.actorId, row.ownerId].filter((u) => u && u !== actorId)) {
    notifyQuiet(other, {
      type: 'system',
      title: 'An attribution ended',
      body: `${nameOf(actorId)} revoked the link to ${spaceName(row.spaceId)}: ${why.slice(0, 160)}`,
      dedupeKey: `guardian:revoke:${row.id}:${other}`
    });
  }
  return { attribution: updated };
}

/** Settled orders for the shop, inside the link's window. */
function settledOrdersFor(link, { since = null, until = null } = {}) {
  const space = store.find('spaces', (s) => s.id === link.spaceId);
  if (!space) return [];
  return store.filter('orders', (o) =>
    (o.spaceId === space.id || (space.vendorId && o.vendorId === space.vendorId)) && o.status === 'settled'
  ).filter((o) => {
    const at = o.settledAt ?? o.updatedAt ?? o.createdAt;
    const ms = Date.parse(at ?? '');
    if (!Number.isFinite(ms)) return false;
    if (since && ms < Date.parse(since)) return false;
    if (until && ms > Date.parse(until)) return false;
    return true;
  });
}

/**
 * What one link is worth right now, derived on read: the status, the shop's own
 * freshness, how many of its orders settled, and the points actually credited.
 * There is no balance column to fudge and no accrual to audit — the points are
 * the referral rows the settled orders produced.
 */
export function standingFor(link, { nowMs = Date.now() } = {}) {
  if (!link) return null;
  const space = store.find('spaces', (s) => s.id === link.spaceId);
  const status = effectiveStatus(link, { nowMs });
  const since = link.startsAt ?? link.claimedAt;
  const until = link.expiresAt ?? null;
  const settled = settledOrdersFor(link, { since, until });
  const points = store.filter('referralEvents', (e) =>
    e.kind === 'guardian_order' && e.referrerId === link.actorId && e.spaceId === link.spaceId
  ).reduce((n, e) => n + (Number(e.points) || 0), 0);
  return {
    attributionId: link.id,
    spaceId: link.spaceId,
    spaceName: space?.name ?? null,
    status: status.status,
    statusReason: status.reason,
    pointsPerHundredKes: GUARDIAN_POINTS_PER_HUNDRED_KES,
    since,
    until,
    settledOrders: settled.length,
    // The shop's turnover is NOT shown to the guardian. Their own points are,
    // because that is the only figure they have a right to.
    points,
    reports: status.reports,
    freshness: space ? profile.maintenanceFor(space, { now: nowMs }).state : null,
    note: status.status === 'active'
      ? 'Points on orders that settled through Brief. They become cash only inside the rewards pool, and only once finance confirms the payout.'
      : `Nothing accrues while the link is ${status.status}.`
  };
}

/**
 * The credit hook, called from `referrals.recordOrder`. Idempotent per order,
 * flat per KES 100, and REFUSED while the link is not active — a pause has to
 * have a consequence or it is a badge.
 */
export function creditForOrder(order) {
  if (!order) return null;
  const spaceId = order.spaceId ?? store.find('spaces', (s) => s.vendorId === order.vendorId)?.id ?? null;
  if (!spaceId) return null;
  const link = store.find('attributions', (a) => a.spaceId === spaceId && a.status === 'active');
  if (!link) return null;
  if (effectiveStatus(link).status !== 'active') return null;
  const key = `guardian_order:${order.id}`;
  if (store.find('referralEvents', (e) => e.key === key)) return null;
  const total = Number(order.total ?? order.totals?.total ?? 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  const points = Math.floor(total / 100) * GUARDIAN_POINTS_PER_HUNDRED_KES;
  if (points <= 0) return null;
  return store.insert('referralEvents', {
    id: newId('refv'),
    kind: 'guardian_order',
    key,
    day: null,
    actorId: order.buyerId ?? null,
    referrerId: link.actorId,
    spaceId,
    points,
    valueKes: total,
    at: now()
  });
}

/** Everything a guardian holds: their shops, the facts, their credit. */
export function networkFor(userId, { nowMs = Date.now() } = {}) {
  if (!userId) return null;
  const rows = store.filter('attributions', (a) => a.actorId === userId)
    .slice()
    .sort((a, b) => (a.claimedAt < b.claimedAt ? 1 : -1));
  const items = rows.map((a) => standingFor(a, { nowMs })).filter(Boolean);
  const pending = items.filter((i) => i.status === 'pending_owner').length;
  return {
    guardianId: userId,
    pointsPerHundredKes: GUARDIAN_POINTS_PER_HUNDRED_KES,
    months: GUARDIAN_MONTHS,
    pendingCap: PENDING_CLAIM_CAP,
    businesses: items,
    totals: {
      claimed: items.length,
      active: items.filter((i) => i.status === 'active').length,
      pending,
      paused: items.filter((i) => i.status === 'flagged' || i.status === 'suspended').length,
      settledOrders: items.reduce((s, i) => s + i.settledOrders, 0),
      points: items.reduce((s, i) => s + (i.points || 0), 0)
    },
    // Named rather than left as an absence a reader has to interpret.
    unavailable: [
      'ratings or stars — Brief holds no review rows for a shop, so there is nothing to average',
      'a complaint rate — there is no denominator of transactions to divide by',
      "the shop's order values, customers or ledger — you are credited points, you are not shown their book",
      'a percentage cut of an order — Brief charges no such fee, so there is no cut to take',
      'an automatic takedown — reports escalate to an operator; nobody removes a shop for you'
    ],
    note: pending > 0
      ? `${pending} of ${items.length} ${pending === 1 ? 'link is' : 'links are'} waiting for the shop to confirm. Nothing accrues until one does.`
      : 'Every figure here is a count of rows, or points those rows produced.',
    channels: { inApp: 'created', sms: 'not_configured', whatsapp: 'not_configured' }
  };
}

/** What the shop's owner sees about their own guardian. */
export function forSpace(spaceId) {
  const row = store.find('attributions', (a) =>
    a.spaceId === spaceId && ['pending_owner', 'active'].includes(a.status));
  if (!row) {
    return {
      attribution: null,
      note: 'Nobody has claimed to have introduced this shop. There is nothing to confirm.'
    };
  }
  const status = effectiveStatus(row);
  return {
    attribution: {
      id: row.id,
      status: status.status,
      guardianName: nameOf(row.actorId),
      note: row.note,
      claimedAt: row.claimedAt,
      confirmedAt: row.confirmedAt,
      expiresAt: row.expiresAt
    },
    pointsPerHundredKes: GUARDIAN_POINTS_PER_HUNDRED_KES,
    months: GUARDIAN_MONTHS,
    canConfirm: row.status === 'pending_owner',
    canDispute: ['pending_owner', 'active'].includes(row.status),
    // The terms are shown whether the link is pending or live: a shop should
    // never have to remember what it agreed to, and "you agreed to this" is only
    // honest next to what this actually costs you — which is nothing.
    terms: `${nameOf(row.actorId)} earns ${GUARDIAN_POINTS_PER_HUNDRED_KES} point per KES 100 that settles through this shop, until ${row.expiresAt ? row.expiresAt.slice(0, 10) : `${GUARDIAN_MONTHS} months after you confirm`}. The points come from Brief's rewards pool, never out of what you earn.`,
    note: row.status === 'pending_owner'
      ? 'Confirm to accept that, or dispute to close it and keep the record. Nothing accrues while this is unanswered.'
      : `The link is ${status.status}. Brief has no mediator: a dispute is not reviewed, it simply ends the claim and stops the credit.`
  };
}

/**
 * The complaint loop: a guardian is TOLD when a shop they introduced starts
 * collecting reports, because that is the moment their interest and the shop's
 * quality visibly part. Past the suspension threshold the credit freezes and an
 * operator is told. The shop is not touched.
 */
export function reviewLinks({ nowMs = Date.now() } = {}) {
  const out = [];
  for (const link of store.filter('attributions', (x) => x.status === 'active')) {
    const before = link.lastReviewedReports ?? 0;
    const n = reportCount(link.spaceId);
    if (n === before) continue;
    const space = store.find('spaces', (s) => s.id === link.spaceId);
    const state = n >= SUSPEND_AFTER_REPORTS ? 'suspended' : n >= FLAG_AFTER_REPORTS ? 'flagged' : 'clear';
    store.update('attributions', link.id, { lastReviewedReports: n, lastReviewedAt: now() });
    if (state !== 'clear') {
      notifyQuiet(link.actorId, {
        type: 'system',
        title: state === 'suspended' ? 'A shop you introduced has its credit frozen' : 'A shop you introduced has reports open',
        body: `${space?.name ?? 'A shop'} has ${n} open report${n === 1 ? '' : 's'} from signed-in people. ${state === 'suspended' ? 'Your credit stops while they stand.' : 'A shop collecting complaints without a reply earns nobody anything.'}`,
        dedupeKey: `guardian:review:${link.id}:${n}`
      });
      emitSignal({ type: 'guardian_reviewed', actorId: null, metadata: { attributionId: link.id, spaceId: link.spaceId, reports: n, state } });
    }
    out.push({ attributionId: link.id, spaceId: link.spaceId, reports: n, state });
  }
  return { reviewed: out.length, items: out, note: 'This notifies and freezes a credit. It does not remove a shop: Brief has no reviewer for that, and would be lying to say otherwise.' };
}

function mustFind(id) {
  const row = store.find('attributions', (a) => a.id === id);
  if (!row) fail('no such attribution', 404, 'not_found');
  return row;
}

function spaceName(id) {
  return store.find('spaces', (s) => s.id === id)?.name ?? 'a space';
}

function nameOf(userId) {
  const u = getUser(userId);
  return u ? (u.displayName || u.handle || null) : null;
}

function notifyQuiet(userId, opts) {
  try { return notify(userId, opts); } catch { return null; }
}
