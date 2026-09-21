// ---------------------------------------------------------------------------
// PICKUPS — rider routing to onboarded shops.
//
// The missing half of the field-agent loop: an agent ONBOARDS a shop, but
// nothing routes OTHER riders to pick up from it. This is that routing.
//
//   * a pickup is a LOCAL delivery task, assigned to a rider, originating from
//     a shop that has an ACTIVE full_registration claim (an onboarding agent).
//   * completing a pickup used to pay the shop's ONBOARDING AGENT a flat
//     per-pickup origin fee (KES 20), settled through its own finance-gated
//     rail. Decision 5 (docs/DECISIONS.md) ended that: a field agent is paid
//     KES 150 for an APPROVED VISIT and nothing else — no bonus, no volume
//     tier. A per-delivery fee to the agent who brought the shop in is a
//     volume tier by another name, and it paid for the shop's trade rather
//     than for the agent's work. So the money is gone and the LOGISTICS stay:
//     routing, assignment, completion and the dispatchable origins are all
//     exactly as they were.
//   * what remains is a COUNT — how many delivered pickups originated at shops
//     you onboarded. A count is information, not pay, and it is printed as a
//     count so nobody reads KES into it.
//
// Honesty:
//   * a pickup must originate from a shop someone actually claimed — no claim,
//     no routing target.
//   * first-touch-wins is preserved: attribution follows whoever holds the
//     ACTIVE claim, not whoever shows up later.
//   * the rider and the onboarding agent can be the same person; they did two
//     jobs (delivered + brought the shop in). The delivery is the rider's work
//     and the visit is the agent's — only the visit is payable, once, flat.
//   * `pickupFeeSettlements` rows written before Decision 5 are still readable
//     as history. Nothing writes a new one, and no week of them can be re-paid.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';

export const PICKUP_STATUS = ['assigned', 'picked_up', 'delivered', 'cancelled'];

// There is deliberately NO fee constant here any more. PICKUP_ORIGIN_FEE_KES
// was KES 20 per delivered pickup, paid to the onboarding agent; Decision 5
// replaced field-agent pay with one flat number (KES 150 per approved visit,
// in domain/fieldAgent.js) and refused every volume tier. A constant left
// behind "for reference" is a constant somebody eventually re-wires.

function fail(message, status = 400, code = 'validation_error') {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  throw e;
}

/** The ACTIVE full_registration claim on a vendor, or null. */
function onboardingAgentOf(vendorId) {
  return store.find('vendorClaims', (c) =>
    c.vendorId === vendorId && c.claimType === 'full_registration' && c.status === 'active') ?? null;
}

/**
 * Assign a rider to pick up from an onboarded shop. The shop MUST have an
 * active onboarding agent — otherwise there is no routing target and no fee to
 * honour, so the pickup is refused.
 */
export function assignPickup({
  originVendorId,
  riderId,
  destinationTown,
  receiverName,
  receiverPhone,
  notes = '',
  assignedBy = null
}) {
  if (!originVendorId) fail('an origin shop is required');
  if (!riderId) fail('a rider is required');
  if (!store.find('users', (u) => u.id === riderId)) fail('rider not found', 404, 'not_found');
  const vendor = store.find('vendors', (v) => v.id === originVendorId);
  if (!vendor) fail('origin shop not found', 404, 'not_found');
  // No onboarding agent -> no routing target. A shop nobody claimed cannot be
  // a pickup origin, because there is no one to earn the origin fee.
  if (!onboardingAgentOf(originVendorId)) {
    fail('this shop has no onboarding agent to route to', 409, 'unclaimed_origin');
  }
  if (!destinationTown || !String(destinationTown).trim()) fail('a destination town is required');
  if (!receiverName || !String(receiverName).trim()) fail('a receiver name is required');
  if (!receiverPhone || !String(receiverPhone).trim()) fail('a receiver phone is required');

  const now = new Date().toISOString();
  return store.insert('pickups', {
    id: newId('pkp'),
    originVendorId,
    riderId,
    assignedBy: assignedBy ?? null,
    destinationTown: String(destinationTown).trim(),
    receiverName: String(receiverName).trim(),
    receiverPhone: String(receiverPhone).trim(),
    notes: String(notes ?? '').trim(),
    status: 'assigned',
    createdAt: now,
    completedAt: null
  });
}

/** A rider (or the assigner) marks a pickup delivered. */
export function completePickup(pickupId, actorId) {
  const pickup = store.find('pickups', (p) => p.id === pickupId);
  if (!pickup) fail('pickup not found', 404, 'not_found');
  if (pickup.status === 'delivered') return pickup; // idempotent
  if (pickup.status === 'cancelled') fail('a cancelled pickup cannot be completed', 409, 'invalid_state');
  if (actorId && actorId !== pickup.riderId && actorId !== pickup.assignedBy) {
    fail('only the assigned rider or assigner may complete this pickup', 403, 'forbidden');
  }
  return store.update('pickups', pickupId, { status: 'delivered', completedAt: new Date().toISOString() });
}

/** A rider's own pickups, newest first. */
export function listPickups({ riderId = null, status = null } = {}) {
  let rows = store.all('pickups');
  if (riderId) rows = rows.filter((p) => p.riderId === riderId);
  if (status) rows = rows.filter((p) => p.status === status);
  return rows.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/**
 * The onboarding agent's DERIVED pickup COUNT: every DELIVERED pickup that
 * originated from a shop they actively claim. Derived on read.
 *
 * This is information, not an obligation — the function no longer owes anyone
 * anything, which is why it is no longer called one. Pay for bringing the shop
 * in is the flat approved-visit fee (Decision 5, domain/fieldAgent.js).
 */
export function pickupOriginStats(agentId) {
  const claimedVendorIds = new Set(
    store.filter('vendorClaims', (c) =>
      c.agentId === agentId && c.claimType === 'full_registration' && c.status === 'active')
      .map((c) => c.vendorId)
  );
  const pickups = store.filter('pickups', (p) =>
    claimedVendorIds.has(p.originVendorId) && p.status === 'delivered');

  return {
    agentId,
    pickupCount: pickups.length,
    shops: claimedVendorIds.size,
    currency: null,
    note: 'Delivered pickups that started at shops you onboarded — a count of real rows. This is not pay: an agent is paid KES 150 per approved visit (Decision 5), and a per-delivery fee was a volume tier.'
  };
}

/**
 * The DISPATCHABLE ORIGINS — every shop that has an ACTIVE onboarding claim,
 * i.e. every place a rider can be routed to pick up from. Derived by joining
 * active full_registration claims to their vendors. No claim, no origin.
 */
export function listOrigins() {
  const claims = store.filter('vendorClaims', (c) =>
    c.claimType === 'full_registration' && c.status === 'active');
  return claims.map((c) => {
    const vendor = store.find('vendors', (v) => v.id === c.vendorId);
    return {
      vendorId: c.vendorId,
      shopName: vendor?.displayName ?? 'Shop',
      businessType: vendor?.businessType ?? null,
      location: vendor?.location ?? null,
      onboardingAgentId: c.agentId
    };
  });
}

/**
 * The DISPATCHABLE RIDERS — the people a dispatcher can route a pickup TO.
 * Derived, never fabricated; every entry is a real user, listed for a real
 * reason:
 *   * every onboarding agent who actively claims a shop (they are out in the
 *     field onboarding AND delivering),
 *   * every rider who has already been assigned a pickup (a known rider),
 *   * you (selfId), so self-dispatch stays available.
 * An id with no user row is dropped — it is not a real person you can route to.
 */
export function listRiders({ selfId = null } = {}) {
  const reasons = new Map(); // userId -> Set(reason)
  const add = (id, reason) => {
    if (!id) return;
    if (!reasons.has(id)) reasons.set(id, new Set());
    reasons.get(id).add(reason);
  };

  for (const c of store.filter('vendorClaims', (c) =>
    c.claimType === 'full_registration' && c.status === 'active')) {
    add(c.agentId, 'onboarding_agent');
  }
  for (const p of store.all('pickups')) add(p.riderId, 'rider');
  if (selfId) add(selfId, 'you');

  const riders = [];
  for (const [id, rs] of reasons) {
    const u = store.find('users', (x) => x.id === id);
    if (!u) continue;
    riders.push({
      id,
      handle: u.handle ?? null,
      displayName: u.displayName ?? u.handle ?? 'Rider',
      isSelf: id === selfId,
      reasons: [...rs]
    });
  }
  // Self first, then by display name.
  return riders.sort((a, b) =>
    (b.isSelf ? 1 : 0) - (a.isSelf ? 1 : 0) ||
    String(a.displayName).localeCompare(String(b.displayName)));
}

// ---------------------------------------------------------------------------
// SETTLEMENT — REMOVED, not hidden. This section used to hold
// `requestPickupFeeSettlement` and `confirmPickupFeeSettlement`: a
// finance-gated rail that turned the per-pickup origin fee into a real ledger
// transaction (type `pickup_origin_fee`). Decision 5 ended the fee, so there is
// nothing for a settlement to settle and no honest way to keep a writer that
// would mint money the operator refused. What survives is the READ below, so
// rows written before the decision remain visible as the history they are.
// ---------------------------------------------------------------------------

/** HISTORY ONLY. Rows written before Decision 5. Nothing adds to this list. */
export function listPickupFeeSettlements(agentId) {
  return store.filter('pickupFeeSettlements', (s) => s.agentId === agentId)
    .slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
