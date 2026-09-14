// ---------------------------------------------------------------------------
// PICKUPS — rider routing to onboarded shops.
//
// The missing half of the field-agent loop: an agent ONBOARDS a shop (and
// earns the 0.75% settled-order override + the menu bounty), but nothing
// routes OTHER riders to pick up from it. This is that routing.
//
//   * a pickup is a LOCAL delivery task, assigned to a rider, originating from
//     a shop that has an ACTIVE full_registration claim (an onboarding agent).
//   * when a pickup is completed, the shop's ONBOARDING AGENT earns a flat
//     per-pickup origin fee — the "minimal fee" for having brought the shop in,
//     even when a different rider does the actual delivery.
//   * the fee is DERIVED (sum of completed pickups from the agent's claimed
//     shops) and is NOT money until a finance-confirmed settlement — the same
//     honesty rule the 0.75% override already obeys.
//
// Honesty:
//   * a pickup must originate from a shop someone actually claimed — no claim,
//     no origin fee, no routing target.
//   * first-touch-wins is preserved: the origin fee goes to whoever holds the
//     ACTIVE claim, not whoever shows up later.
//   * the rider and the onboarding agent can be the same person; they did two
//     jobs (delivered + brought the shop in) and earn for both, derived.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';

export const PICKUP_STATUS = ['assigned', 'picked_up', 'delivered', 'cancelled'];

// The flat, deterministic per-pickup fee the onboarding agent earns when a
// rider completes a pickup from their shop. Minimal by design; stated here so
// it is never guessed at runtime.
export const PICKUP_ORIGIN_FEE_KES = 20;

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
 * The onboarding agent's DERIVED per-pickup origin fee: for every DELIVERED
 * pickup originating from a shop they actively claim, PICKUP_ORIGIN_FEE_KES.
 * Derived on read; not money until a finance-confirmed settlement.
 */
export function pickupOriginObligation(agentId) {
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
    feePerPickupKes: PICKUP_ORIGIN_FEE_KES,
    originFeeKes: pickups.length * PICKUP_ORIGIN_FEE_KES,
    note: 'Derived from delivered pickups at shops you onboarded. Not money until a finance-confirmed settlement.'
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
