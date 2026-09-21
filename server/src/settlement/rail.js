// ---------------------------------------------------------------------------
// SETTLEMENT RAIL — the interface
//
// A rail moves money. It is not the ledger, not the domain split, not the
// surface. It takes a request ("move KES 4,500 from A to B") and either does
// it or refuses honestly.
//
// RELATIONSHIP TO WHAT ALREADY EXISTS (read before calling):
//   * `providers.js` is the VENDOR CONNECTOR seam — one rail per direction,
//     provider-neutral operations, fail-closed. This directory is the
//     generic MOVEMENT seam for flows that have no payout machinery of their
//     own yet. When Buni's transfer contract lands, the buni rail here WRAPS
//     `connectors/buni.js` — one connector implementation, never a copy.
//   * `domain/settlement.js` owns VENDOR payouts, and its law stands: the
//     payout amount is DERIVED from settled orders, never supplied. Do not
//     route vendor payouts through this generic rail to sneak an amount past
//     that law — the rail refuses to become the second way to do that.
//   * The tree's own sentence this whole directory implements:
//     "a person moves the money, finance confirms the ledger row."
//
// Every rail implements the same five methods. Rails differ in the middle;
// they never differ in the shape.
//
//   isConfigured()                — can this rail move money right now?
//   disburse(params)              — move money OUT to a recipient
//   collect(params)               — collect money IN from a payer
//   getAttempt(attemptId)         — read one attempt's state
//   reconcile({ from, to })       — find stuck attempts / provider mismatches
//
// Rails that support manual confirmation additionally implement:
//
//   markSent(attemptId, { providerRef, note })     — money left
//   markReceived(attemptId, { providerRef, note }) — money arrived
//   markFailed(attemptId, { reason })              — money did not move
//
// -- ATTEMPT STATES (and how they map to the tree's payout vocabulary) ------
//
//   pending     — accepted, not started. Most rails skip this.
//   in_flight   — money is moving. For the manual rail: a human is doing it.
//                 (domain/settlement.js calls this requested/processing.)
//   settled     — money moved. Terminal. (domain/settlement.js: paid.)
//   failed      — money did not move. Terminal.
//   reversed    — money moved, then came back. Terminal for the original.
//
// -- IDEMPOTENCY ------------------------------------------------------------
//
// Every disburse()/collect() carries an idempotencyKey chosen by the caller:
//
//   payout:{ledgerEntryId}
//   collection:{orderId}
//
// The rail refuses duplicate keys at the API, not in the business logic.
//
// -- HONESTY ----------------------------------------------------------------
//
// A rail that is not configured refuses. It does not fall back silently and
// it does not fake success:
//
//   { status: 'refused', reason: 'no provider configured' }
//
// The caller handles that honestly — usually by telling the user this can't
// move right now.
// ---------------------------------------------------------------------------

export const RAIL_STATES = Object.freeze({
  PENDING:   'pending',
  IN_FLIGHT: 'in_flight',
  SETTLED:   'settled',
  FAILED:    'failed',
  REVERSED:  'reversed',
});

export const RAIL_DIRECTIONS = Object.freeze({
  OUT: 'out',
  IN:  'in',
});

// ---------------------------------------------------------------------------
// SHARED HELPERS
// ---------------------------------------------------------------------------

/** Find an existing attempt by idempotency key. Rails dedupe through this. */
export function findByIdempotencyKey(store, idempotencyKey) {
  return store.find('settlementAttempts', (a) => a.idempotencyKey === idempotencyKey);
}

/** The envelope every rail method returns: { status, attemptId?, ... }. */
export function accepted(attemptId, extra = {}) {
  return { status: RAIL_STATES.IN_FLIGHT, attemptId, ...extra };
}

export function settled(attemptId, extra = {}) {
  return { status: RAIL_STATES.SETTLED, attemptId, ...extra };
}

export function refused(reason) {
  return { status: 'refused', reason };
}

export function failed(attemptId, reason) {
  return { status: RAIL_STATES.FAILED, attemptId, reason };
}
