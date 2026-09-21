// ---------------------------------------------------------------------------
// FIELD AGENTS — riders and door-to-door agents who bring shops into Brief and
// are paid a flat fee for each visit an approver accepts.
//
// PAY — the operator's Decision 5, 2026-09-21 (docs/DECISIONS.md):
//
//     KES 150 flat per APPROVED visit. Weekly payout. Nothing else.
//
// No bonus. No volume tier. No speed incentive. No quality multiplier. One
// number replaces the four this module used to carry: the 0.75% override rate,
// its 24-month window, the 100-point menu-upload bounty, and the 0.5%–1.0%
// clamp those were tuned inside. The operator's reason is about behaviour, not
// budget — a share of a merchant's settled orders pays an agent for throughput,
// and throughput is precisely what a flat per-visit fee refuses to reward. A
// rejected visit pays nothing.
//
// HONESTY (the standing laws, unchanged):
//   * first-touch-wins: only ONE active full_registration claim per vendor.
//     A second agent cannot overwrite the first — attribution is a fact, not
//     a prize to be re-raced.
//   * depth stays at ONE: an agent earns only from shops they personally
//     visited and onboarded, never from agents they recruited. There is no
//     upline anywhere in this module.
//   * one paid visit per agent, per shop, per purpose — ever. The fee is not a
//     meter that can be run twice on the same door.
//   * NOTHING IS STORED AS A BALANCE. Earnings are `KES 150 x approved visits`,
//     recomputed from rows on every read. A rejected or still-pending visit
//     contributes zero, and the arithmetic is printed beside the number.
//   * money moves only through a finance-confirmed settlement that writes a
//     real ledger transaction (type `field_agent_visit_fee`), pending until
//     finance accepts — mirroring the partner share exactly.
//   * self-dealing is refused: a vendor owner is not paid to visit a shop they
//     already own. The one exception is the onboarding act itself, and it is
//     the same exception `claimVendor`/`onboardVendor` have always carried:
//     under the current 1:1 person<->vendor model the agent owns the vendor
//     they just created, and refusing that would refuse the agent's whole job.
//   * a visit carries the agent's own words about what they saw. An approver
//     who cannot read what happened cannot approve it, and a rejection without
//     a reason is refused — both minimums are printed, never hidden.
//
// Rows written before Decision 5 (`fieldAgentSettlements` with `rate`,
// `grossKes` and a from/to `periodKey`) are left exactly as they are: they are
// history, they are readable, and their period key can never collide with the
// `agentId:YYYY-Www` key this module now writes, so none of them can be paid
// twice. Nothing is migrated and nothing is deleted.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { getUser } from './auth.js';
import { createTransaction, transitionTransaction } from './ledger.js';
import * as vendors from './vendor.js';
import { BUSINESS_TYPES } from './supply.js';

export const CLAIM_TYPES = ['menu_upload', 'full_registration'];
export const CLAIM_STATUS = ['active', 'expired', 'revoked'];
export const SETTLEMENT_STATUS = ['pending', 'confirmed', 'refused'];
export const VISIT_STATUS = ['pending', 'approved', 'rejected'];

// Decision 5: the one number. Everything payable in this module is a multiple
// of it, and the multiple is a count of approved visit rows — never a share of
// anybody's trade.
export const VISIT_FEE_KES = 150;

// Printed, not hidden: the shortest note an agent can submit (an approver has
// to be able to read what happened) and the shortest reason a rejection can
// carry (the same rule the settlement refusal has always followed).
export const VISIT_NOTE_MIN = 8;
export const REJECT_REASON_MIN = 4;

function fail(message, status = 400, code = 'validation_error') {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  throw e;
}

/**
 * The ISO-8601 week an instant falls in, as `YYYY-Www` (UTC). This is the
 * payout period: a visit belongs to the week it was APPROVED in, because that
 * is the moment it became payable — not the week it was submitted, which would
 * let a slow approval silently move money between two weeks.
 */
export function isoWeekOf(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return null;
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7; // Monday=1 … Sunday=7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum); // nearest Thursday
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Claim a vendor. First-touch-wins within each claim type; self-dealing is
 * refused. A claim is ATTRIBUTION — it records who brought the shop in. It is
 * not, by itself, payable: pay follows an approved visit (Decision 5).
 */
export function claimVendor({ agentId, vendorId, claimType, territoryKey = null }) {
  if (!agentId) fail('an agent is required');
  if (!CLAIM_TYPES.includes(claimType)) fail(`claimType must be one of ${CLAIM_TYPES.join(', ')}`);
  const vendor = store.find('vendors', (v) => v.id === vendorId);
  if (!vendor) fail('vendor not found', 404, 'not_found');
  if (vendor.ownerId === agentId) fail('a vendor owner cannot claim their own shop', 409, 'self_claim');

  if (claimType === 'full_registration') {
    const existing = store.find('vendorClaims', (c) =>
      c.vendorId === vendorId && c.claimType === 'full_registration' && c.status === 'active');
    if (existing) fail('this vendor already has an active territory claim', 409, 'already_claimed');
  } else {
    const existing = store.find('vendorClaims', (c) =>
      c.vendorId === vendorId && c.claimType === 'menu_upload');
    if (existing) fail('this vendor was already onboarded for its menu', 409, 'already_claimed');
  }

  const now = new Date().toISOString();
  return store.insert('vendorClaims', {
    id: newId('vcl'),
    vendorId,
    agentId,
    claimType,
    territoryKey: territoryKey ? String(territoryKey).slice(0, 96) : null,
    status: 'active',
    claimedAt: now,
    // No window is minted any more. The 24-month override it used to open is
    // gone with Decision 5, so the field stays null and says so rather than
    // carrying a date nothing honours.
    expiresAt: null,
    createdAt: now
  });
}

/** The active territory holder for a vendor, or null when nobody holds it. */
export function vendorClaim(vendorId) {
  return store.find('vendorClaims', (c) =>
    c.vendorId === vendorId && c.claimType === 'full_registration' && c.status === 'active') ?? null;
}

// The visit row, written in one place so the public and the onboarding paths
// cannot drift apart. Deliberately stores NO fee and NO week: both are derived
// on read, because a stored number is a number that can disagree with the rows.
function insertVisitRow({ agentId, vendorId, purpose, notes }) {
  const now = new Date().toISOString();
  return store.insert('fieldVisits', {
    id: newId('fvt'),
    agentId,
    vendorId,
    purpose,
    status: 'pending',
    notes: String(notes).trim().slice(0, 600),
    submittedAt: now,
    decidedBy: null,
    decidedAt: null,
    rejectReason: null,
    createdAt: now
  });
}

/**
 * RECORD A VISIT — the payable act. One per agent, per shop, per purpose; a
 * rejected visit may be submitted again (the rejection is an answer about that
 * attempt, not a ban on the door), a pending or approved one may not.
 */
export function recordVisit({ agentId, vendorId, purpose = 'full_registration', notes = '' }) {
  if (!agentId) fail('an agent is required');
  if (!getUser(agentId)) fail('agent not found', 404, 'not_found');
  if (!CLAIM_TYPES.includes(purpose)) fail(`purpose must be one of ${CLAIM_TYPES.join(', ')}`);
  const vendor = store.find('vendors', (v) => v.id === vendorId);
  if (!vendor) fail('vendor not found', 404, 'not_found');
  if (vendor.ownerId === agentId) fail('a vendor owner is not paid to visit their own shop', 409, 'self_visit');
  if (String(notes ?? '').trim().length < VISIT_NOTE_MIN) {
    fail(`say what you saw at the shop — at least ${VISIT_NOTE_MIN} characters, because that is what the approver reads`);
  }
  const existing = store.find('fieldVisits', (v) =>
    v.agentId === agentId && v.vendorId === vendorId && v.purpose === purpose && v.status !== 'rejected');
  if (existing) fail('this shop was already visited for that purpose', 409, 'already_visited');

  return insertVisitRow({ agentId, vendorId, purpose, notes });
}

/**
 * APPROVE OR REJECT A VISIT — the only place a visit becomes payable, and it
 * is a human act. Terminal states are final: a decided visit cannot be
 * re-decided, so a week's count can never move after its settlement is written.
 */
export function decideVisit(visitId, { accept = true, note = '', decidedBy = null } = {}) {
  const row = store.find('fieldVisits', (v) => v.id === visitId);
  if (!row) fail('visit not found', 404, 'not_found');
  if (row.status !== 'pending') fail(`this visit is already ${row.status}`, 409, 'invalid_state');
  const now = new Date().toISOString();
  if (!accept) {
    const reason = String(note ?? '').trim();
    if (reason.length < REJECT_REASON_MIN) fail(`say why the visit is rejected — at least ${REJECT_REASON_MIN} characters`);
    return store.update('fieldVisits', row.id, {
      status: 'rejected',
      rejectReason: reason.slice(0, 300),
      decidedBy: decidedBy ?? null,
      decidedAt: now
    });
  }
  return store.update('fieldVisits', row.id, {
    status: 'approved',
    rejectReason: null,
    decidedBy: decidedBy ?? null,
    decidedAt: now
  });
}

export function myVisits(agentId) {
  return store.filter('fieldVisits', (v) => v.agentId === agentId)
    .slice().sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
}

export function listVisits() {
  return store.all('fieldVisits').slice().sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
}

/**
 * The agent's DERIVED earnings: KES 150 for every approved visit, grouped into
 * the weeks they were approved in. Nothing is stored; the counts are printed
 * beside the money so the number can always be checked against the rows.
 */
export function visitEarnings(agentId) {
  const visits = myVisits(agentId);
  const settlements = store.filter('fieldAgentSettlements', (s) => s.agentId === agentId);

  const rows = visits.map((v) => {
    const vendor = store.find('vendors', (x) => x.id === v.vendorId);
    const approved = v.status === 'approved';
    return {
      visitId: v.id,
      vendorId: v.vendorId,
      vendorName: vendor?.displayName ?? null,
      purpose: v.purpose,
      status: v.status,
      notes: v.notes,
      submittedAt: v.submittedAt,
      decidedAt: v.decidedAt,
      decidedBy: v.decidedBy ?? null,
      rejectReason: v.rejectReason ?? null,
      week: approved ? isoWeekOf(v.decidedAt) : null,
      feeKes: approved ? VISIT_FEE_KES : 0,
      // The direct contact the agent captured at onboarding — the person you
      // actually reach at the shop (name + phone), so the agent can call or
      // WhatsApp a shop they brought in.
      contactName: vendor?.contactName ?? null,
      contactMethod: vendor?.contactMethod ?? null,
      businessType: vendor?.businessType ?? null,
      location: vendor?.location ?? null
    };
  });

  const byWeek = new Map();
  for (const r of rows) {
    if (r.status !== 'approved' || !r.week) continue;
    const w = byWeek.get(r.week) ?? { week: r.week, visits: 0, kes: 0 };
    w.visits += 1;
    w.kes += VISIT_FEE_KES;
    byWeek.set(r.week, w);
  }
  const weeks = [...byWeek.values()]
    .sort((a, b) => (a.week < b.week ? 1 : -1))
    .map((w) => {
      const s = settlements.find((x) => x.week === w.week && x.status !== 'refused');
      return {
        ...w,
        feeKes: VISIT_FEE_KES,
        currency: 'KES',
        settlementId: s?.id ?? null,
        settlementStatus: s?.status ?? null
      };
    });

  const approved = rows.filter((r) => r.status === 'approved').length;
  return {
    agentId,
    feeKes: VISIT_FEE_KES,
    currency: 'KES',
    visits: rows,
    approved,
    pending: rows.filter((r) => r.status === 'pending').length,
    rejected: rows.filter((r) => r.status === 'rejected').length,
    approvedKes: approved * VISIT_FEE_KES,
    unsettledKes: weeks.filter((w) => !w.settlementId).reduce((s, w) => s + w.kes, 0),
    weeks,
    note: `KES ${VISIT_FEE_KES} per approved visit, paid weekly; a rejected or waiting visit pays nothing. Derived from the visit rows on every read — nothing is stored as a balance, and none of it is money until a settlement is recorded and confirmed by finance.`
  };
}

/**
 * ONBOARD A VENDOR — the agent brings a shop INTO Brief and records their
 * territory claim in one atomic step.
 *
 * `claimVendor` only claims a vendor that already exists and is owned by
 * someone else (and refuses the vendor's own owner). But a door-to-door agent
 * walks a market and onboards a shop that has no profile yet — there was no
 * primitive for that, so "onboard a vendor" was a dead end. This is it.
 *
 * The vendor is created under the agent's identity (the current 1:1
 * person<->vendor model: one person, one seller identity), then the claim is
 * recorded DIRECTLY — NOT through claimVendor, whose self-claim guard exists
 * to stop an owner double-dipping their own existing shop, not to stop the
 * onboarding that is the agent's whole job. The visit row is written the same
 * way and for the same reason: the onboarding IS the visit, it arrives
 * pending like any other, and it is paid only if an approver accepts it.
 *
 * Honesty (unchanged): first-touch-wins per claim type; nothing here stores a
 * balance; the fee is the one flat number.
 */
export function onboardVendor({ agentId, displayName, contactMethod = null, contactName = null, businessType = null, location = null, description = '', claimType = 'full_registration', notes = '' }) {
  if (!agentId) fail('an agent is required');
  if (!CLAIM_TYPES.includes(claimType)) fail(`claimType must be one of ${CLAIM_TYPES.join(', ')}`);
  if (!displayName || !String(displayName).trim()) fail('a vendor name is required');
  // ANTI-FRAUD GATE: an onboarded shop must say what it IS and where it
  // physically is, before it is created. A shell shop with no type or no
  // location would otherwise slip into the public vendor list — and under
  // Decision 5 a shell shop is now also a KES 150 claim, so the gate carries
  // the whole weight of the fee's honesty.
  if (!businessType || !BUSINESS_TYPES.includes(businessType)) {
    fail(`businessType must be one of ${BUSINESS_TYPES.join(', ')}`);
  }
  if (!location || !String(location).trim()) fail('a physical store location is required');

  // Create (or reuse, in the one-vendor-per-person model) the vendor the agent
  // is onboarding.
  const vendor = vendors.createVendor({
    ownerId: agentId,
    displayName: String(displayName).trim(),
    contactMethod: contactMethod ?? null,
    contactName: contactName ?? null,
    businessType,
    location: String(location).trim(),
    description: String(description ?? '')
  });

  // First-touch-wins, same as the existing claim path.
  if (claimType === 'full_registration') {
    const existing = store.find('vendorClaims', (c) =>
      c.vendorId === vendor.id && c.claimType === 'full_registration' && c.status === 'active');
    if (existing) fail('this vendor already has an active territory claim', 409, 'already_claimed');
  } else {
    const existing = store.find('vendorClaims', (c) =>
      c.vendorId === vendor.id && c.claimType === 'menu_upload');
    if (existing) fail('this vendor was already onboarded for its menu', 409, 'already_claimed');
  }

  const now = new Date().toISOString();
  const claim = store.insert('vendorClaims', {
    id: newId('vcl'),
    vendorId: vendor.id,
    agentId,
    claimType,
    territoryKey: null,
    status: 'active',
    claimedAt: now,
    expiresAt: null,
    createdAt: now
  });

  // The visit the onboarding act is. The agent's own words go with it when
  // they sent any; otherwise the row says what the shop row already proves —
  // a name, a type and a physical location the agent captured in person.
  const visit = insertVisitRow({
    agentId,
    vendorId: vendor.id,
    purpose: claimType,
    notes: String(notes ?? '').trim() ||
      `Onboarded ${vendor.displayName} in person — ${vendor.businessType} at ${vendor.location}.`
  });

  return { vendor, claim, visit };
}

export function myClaims(agentId) {
  return store.filter('vendorClaims', (c) => c.agentId === agentId)
    .slice().sort((a, b) => (a.claimedAt < b.claimedAt ? 1 : -1));
}

export function listClaims() {
  return store.all('vendorClaims').slice().sort((a, b) => (a.claimedAt < b.claimedAt ? 1 : -1));
}

// ---------------------------------------------------------------------------
// SETTLEMENT — the only place a visit fee becomes money. One settlement per
// agent per week, written against that week's approved rows and pending until
// finance confirms it.
// ---------------------------------------------------------------------------
export function requestWeeklySettlement(agentId, week) {
  if (!getUser(agentId)) fail('agent not found', 404, 'not_found');
  const key = String(week ?? '').trim();
  if (!/^\d{4}-W\d{2}$/.test(key)) fail('a week is required, as YYYY-Www (for example 2026-W38)');

  const earn = visitEarnings(agentId);
  const row = earn.weeks.find((w) => w.week === key);
  if (!row) fail('no approved visits in that week', 409, 'no_activity');
  if (row.settlementId) fail('a settlement for that week already exists', 409, 'duplicate_settlement');

  const tx = createTransaction({
    amount: row.kes,
    type: 'field_agent_visit_fee',
    description: `Field agent — ${row.visits} approved visit${row.visits === 1 ? '' : 's'} × KES ${VISIT_FEE_KES} (week ${key})`,
    counterparty: agentId,
    metadata: { agentId, week: key, visits: row.visits, feeKes: VISIT_FEE_KES }
  });
  transitionTransaction(tx.id, 'pending', 'awaiting finance confirmation of agent visit fees');

  const now = new Date().toISOString();
  return store.insert('fieldAgentSettlements', {
    id: newId('fas'),
    agentId,
    week: key,
    periodKey: `${agentId}:${key}`,
    visits: row.visits,
    feeKes: VISIT_FEE_KES,
    amountKes: row.kes,
    ledgerId: tx.id,
    status: 'pending',
    confirmedBy: null,
    confirmedAt: null,
    refusedReason: null,
    createdAt: now,
    updatedAt: now
  });
}

export function confirmVisitSettlement(settlementId, { accept = true, note = '', confirmedBy = null } = {}) {
  const row = store.find('fieldAgentSettlements', (s) => s.id === settlementId);
  if (!row) fail('settlement not found', 404, 'not_found');
  if (row.status !== 'pending') fail(`this settlement is already ${row.status}`, 409, 'invalid_state');
  const reason = String(note ?? '').trim();
  if (!accept) {
    if (reason.length < REJECT_REASON_MIN) fail('say why the settlement is refused');
    transitionTransaction(row.ledgerId, 'failed', reason.slice(0, 200));
    return store.update('fieldAgentSettlements', row.id, {
      status: 'refused', refusedReason: reason.slice(0, 300), updatedAt: new Date().toISOString()
    });
  }
  transitionTransaction(row.ledgerId, 'confirmed', 'agent visit fees confirmed by finance');
  return store.update('fieldAgentSettlements', row.id, {
    status: 'confirmed',
    confirmedBy: confirmedBy ?? null,
    confirmedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export function listSettlements(agentId) {
  return store.filter('fieldAgentSettlements', (s) => s.agentId === agentId)
    .slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
