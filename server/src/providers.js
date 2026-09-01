// ---------------------------------------------------------------------------
// PAYMENT PROVIDER SEAM
//
// The single place that decides which provider moves money, for both
// directions:
//
//   COLLECTION     customer -> merchant   (STK Push). Tuma is the gateway.
//   DISBURSEMENT   merchant -> customer   (payout). No provider is connected
//                  -- Tuma documents no payout endpoint, and no other payout
//                  rail has been selected.
//
// Each provider is a connector module exposing a common shape:
//   capabilities, isConfigured(), status(),
//   collect, parseCallback(), verifyCallbackSecret()
//   ...and for disbursement providers, disburse() + isPayoutConfigured()
//
// Adding another provider later (if one is ever chosen) is: write a connector
// file + add it to the map below. Today the map is Tuma-only by deliberate
// choice — one rail, fully integrated, nothing to guess.
//
// The rest of Brief NEVER depends on Tuma API details directly. Domain code
// calls the provider-neutral operations here; the connector files are the only
// place that know a provider's endpoints, auth and payload shapes.
// ---------------------------------------------------------------------------

import * as tuma from './connectors/tuma.js';

// TUMA IS THE SOLE PAYMENT PROVIDER. One rail, one contract, no fallback
// guessing: if Tuma is not configured, Brief honestly reports "no provider"
// rather than silently trying another rail.
export const COLLECTION_PROVIDERS = { tuma };
// Intentionally empty. No disbursement provider has been selected; register
// one here to enable merchant payouts. Do not add one unless instructed.
export const DISBURSEMENT_PROVIDERS = {};

/** The active collection provider's name, or null when Tuma is unconfigured. */
export function activeCollectionProvider() {
  return tuma.isConfigured() ? 'tuma' : null;
}

/** The active disbursement provider's name, or null when none is configured. */
export function activeDisbursementProvider() {
  for (const [name, p] of Object.entries(DISBURSEMENT_PROVIDERS)) {
    if (p.isPayoutConfigured && p.isPayoutConfigured()) return name;
  }
  return null;
}

export function collectionProvider(name) {
  return COLLECTION_PROVIDERS[name] ?? null;
}

export function disbursementProvider(name) {
  return DISBURSEMENT_PROVIDERS[name] ?? null;
}

/**
 * One answer to "can Brief collect money, and can it disburse it", drawn from
 * the registry rather than any single connector. Reported on /api/capabilities
 * so the client states the truth instead of implying payments work.
 */
export function providerStatus() {
  const active = activeCollectionProvider();
  const payout = activeDisbursementProvider();
  // Always report the collection provider's status (not null) so an operator
  // can see exactly which credentials are missing even before anything is
  // configured -- the same information the old connector status exposed.
  const collectionName = active ?? Object.keys(COLLECTION_PROVIDERS)[0] ?? null;
  return {
    configured: Boolean(active),
    provider: active,
    payoutConfigured: Boolean(payout),
    collection: collectionName ? collectionProvider(collectionName).status() : null,
    payout: payout ? disbursementProvider(payout).status() : null,
    providers: {
      ...Object.fromEntries(
        Object.entries(COLLECTION_PROVIDERS).map(([k, v]) => [k, v.status()])
      ),
      ...Object.fromEntries(
        Object.entries(DISBURSEMENT_PROVIDERS).map(([k, v]) => [k, v.status()])
      )
    },
    reason: active
      ? null
      : 'No payment provider is connected. Brief can record money that moved ' +
        'elsewhere, but cannot collect or disburse it.'
  };
}
