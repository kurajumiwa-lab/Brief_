// ---------------------------------------------------------------------------
// FIELD AGENTS — riders and door-to-door agents who onboard vendors and earn
// a territory override on the merchant's future orders.
//
// The second layer of the distribution flywheel. An agent claims a vendor two
// ways:
//
//   menu_upload        a light, one-off act (photos + basic info) -> a flat,
//                      deterministic bounty, paid once per vendor, ever.
//   full_registration  a deeper KYC onboarding -> a 24-month override on the
//                      merchant's SETTLED orders.
//
// HONESTY (unchanged rules, restated):
//   * first-touch-wins: only ONE active full_registration claim per vendor.
//     A second agent cannot overwrite the first — attribution is a fact, not
//     a prize to be re-raced.
//   * depth stays at ONE: an agent earns only from the merchant they
//     personally claimed, never from agents they recruited. There is no
//     upline anywhere in this module.
//   * the override is DERIVED from settled orders only — floor(rate x settled
//     value) inside the claim's 24-month window. No settled orders, no
//     override. Nothing is stored as a balance.
//   * money moves only through a finance-confirmed settlement that writes a
//     real ledger transaction (type field_agent_override), mirroring the
//     partner share exactly.
//   * a vendor owner cannot claim their own shop (self-dealing refusal), and
//     neither can the buyer's lead agent be the vendor (already guarded in
//     order.js).
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { getUser } from './auth.js';
import { createTransaction, transitionTransaction } from './ledger.js';
import * as referrals from './referrals.js';

export const CLAIM_TYPES = ['menu_upload', 'full_registration'];
export const CLAIM_STATUS = ['active', 'expired', 'revoked'];
export const SETTLEMENT_STATUS = ['pending', 'confirmed', 'refused'];

// The override: a fraction of the merchant's settled orders, paid for 24
// months. Clamped 0.5%–1.0%; the default sits inside the distribution budget
// (the 6.5% cap in referrals.js) alongside the lead reward and partner share.
export const OVERRIDE_RATE = 0.0075; // 0.75%
export const OVERRIDE_MONTHS = 24;
export const MENU_UPLOAD_BOUNTY = 100; // flat points, one-off, on the claim

function fail(message, status = 400, code = 'validation_error') {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  throw e;
}

function expiresAtOf(nowMs) {
  return new Date(nowMs + OVERRIDE_MONTHS * 30 * 86400000).toISOString();
}

/** Settled orders for a vendor inside a window. `settled` is only ever reached
 *  when a real settled ledger transaction backs the order, so this is real
 *  money, never optimism. */
function settledOrdersFor(vendorId, since, until) {
  return store.filter('orders', (o) => {
    if (o.vendorId !== vendorId || o.status !== 'settled') return false;
    const at = o.settledAt;
    if (!at) return false;
    if (since && at < since) return false;
    if (until && at > until) return false;
    return true;
  });
}

/**
 * Claim a vendor. First-touch-wins within each claim type; self-dealing is
 * refused. A menu_upload claim mints the one-off bounty; a full_registration
 * claim opens the 24-month override window.
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
  const claim = store.insert('vendorClaims', {
    id: newId('vcl'),
    vendorId,
    agentId,
    claimType,
    territoryKey: territoryKey ? String(territoryKey).slice(0, 96) : null,
    status: 'active',
    claimedAt: now,
    expiresAt: claimType === 'full_registration' ? expiresAtOf(Date.now()) : null,
    createdAt: now
  });

  if (claimType === 'menu_upload') {
    try { referrals.recordFieldBounty(agentId, vendorId, MENU_UPLOAD_BOUNTY); }
    catch { /* the bounty must never break the claim */ }
  }
  return claim;
}

/** The active territory holder for a vendor, or null when nobody holds it. */
export function vendorClaim(vendorId) {
  return store.find('vendorClaims', (c) =>
    c.vendorId === vendorId && c.claimType === 'full_registration' && c.status === 'active') ?? null;
}

export function myClaims(agentId) {
  return store.filter('vendorClaims', (c) => c.agentId === agentId)
    .slice().sort((a, b) => (a.claimedAt < b.claimedAt ? 1 : -1));
}

export function listClaims() {
  return store.all('vendorClaims').slice().sort((a, b) => (a.claimedAt < b.claimedAt ? 1 : -1));
}

/**
 * The agent's DERIVED override: per active full_registration claim, the sum of
 * settled orders inside its window times the rate. Nothing stored; zero when
 * there are no settled orders. The per-claim rows are included so the agent
 * sees exactly which merchant produced what.
 */
export function overrideObligation(agentId) {
  const claims = store.filter('vendorClaims', (c) =>
    c.agentId === agentId && c.claimType === 'full_registration' && c.status === 'active');

  const rows = claims.map((claim) => {
    const vendor = store.find('vendors', (v) => v.id === claim.vendorId);
    const orders = settledOrdersFor(claim.vendorId, claim.claimedAt, claim.expiresAt);
    const grossKes = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const overrideKes = Math.floor(OVERRIDE_RATE * grossKes);
    return {
      claimId: claim.id,
      vendorId: claim.vendorId,
      vendorName: vendor?.displayName ?? null,
      claimedAt: claim.claimedAt,
      expiresAt: claim.expiresAt,
      settledOrders: orders.length,
      grossKes,
      overrideKes
    };
  });

  return {
    agentId,
    rate: OVERRIDE_RATE,
    months: OVERRIDE_MONTHS,
    claims: rows,
    grossKes: rows.reduce((s, r) => s + r.grossKes, 0),
    overrideKes: rows.reduce((s, r) => s + r.overrideKes, 0),
    currency: 'KES',
    note: 'The override is a derived obligation against settled orders only. It is not money until a settlement is recorded and confirmed by finance.'
  };
}

// ---------------------------------------------------------------------------
// SETTLEMENT — the only place the override becomes money.
// ---------------------------------------------------------------------------
export function requestOverrideSettlement(agentId, { from = null, to = null } = {}) {
  if (!getUser(agentId)) fail('agent not found', 404, 'not_found');
  const obl = overrideObligation(agentId);
  if (obl.overrideKes <= 0) fail('no settled override to settle against', 409, 'no_activity');

  const periodKey = `${agentId}:${from ?? 'all'}:${to ?? 'all'}`;
  if (store.find('fieldAgentSettlements', (s) => s.periodKey === periodKey && s.status !== 'refused')) {
    fail('a settlement for this period already exists', 409, 'duplicate_settlement');
  }

  const tx = createTransaction({
    amount: obl.overrideKes,
    type: 'field_agent_override',
    description: `Field agent override — ${OVERRIDE_RATE * 100}% of settled orders`,
    counterparty: agentId,
    metadata: { agentId, rate: OVERRIDE_RATE, grossKes: obl.grossKes, periodFrom: from, periodTo: to }
  });
  transitionTransaction(tx.id, 'pending', 'awaiting finance confirmation of agent override');
  const now = new Date().toISOString();
  return store.insert('fieldAgentSettlements', {
    id: newId('fas'),
    agentId,
    periodKey,
    periodFrom: from,
    periodTo: to,
    grossKes: obl.grossKes,
    rate: OVERRIDE_RATE,
    overrideKes: obl.overrideKes,
    ledgerId: tx.id,
    status: 'pending',
    confirmedBy: null,
    confirmedAt: null,
    refusedReason: null,
    createdAt: now,
    updatedAt: now
  });
}

export function confirmOverrideSettlement(settlementId, { accept = true, note = '' } = {}) {
  const row = store.find('fieldAgentSettlements', (s) => s.id === settlementId);
  if (!row) fail('settlement not found', 404, 'not_found');
  if (row.status !== 'pending') fail(`this settlement is already ${row.status}`, 409, 'invalid_state');
  const reason = String(note ?? '').trim();
  if (!accept) {
    if (reason.length < 4) fail('say why the settlement is refused');
    transitionTransaction(row.ledgerId, 'failed', reason.slice(0, 200));
    return store.update('fieldAgentSettlements', row.id, {
      status: 'refused', refusedReason: reason.slice(0, 300), updatedAt: new Date().toISOString()
    });
  }
  transitionTransaction(row.ledgerId, 'confirmed', 'agent override payout confirmed by finance');
  return store.update('fieldAgentSettlements', row.id, {
    status: 'confirmed', confirmedAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
}

export function listSettlements(agentId) {
  return store.filter('fieldAgentSettlements', (s) => s.agentId === agentId)
    .slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
