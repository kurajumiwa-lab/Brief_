// ---------------------------------------------------------------------------
// PAYMENT PROVIDER SEAM
//
// The single place that decides which provider moves money, for both
// directions:
//
//   COLLECTION     customer -> merchant   (STK Push). Tuma is the gateway.
//   DISBURSEMENT   merchant -> customer   (B2C/payout). Still Daraja B2C,
//                  because Tuma documents no payout endpoint.
//
// Each provider is a connector module exposing a common shape:
//   capabilities, isConfigured(), isPayoutConfigured?(), status(),
//   stkPush()/collect, parseCallback(), verifyCallbackSecret()
//
// Adding another provider (Paystack, SasaPay, Flutterwave, ...) is: write a
// connector file + add ONE line to the map below. Nothing else changes,
// because every domain module and route reaches providers through this file.
// ---------------------------------------------------------------------------

import * as tuma from './connectors/tuma.js';
import * as mpesa from './connectors/mpesa.js';

export const COLLECTION_PROVIDERS = { tuma };
export const DISBURSEMENT_PROVIDERS = { mpesa };

/** The active collection provider's name, or null when none is configured. */
export function activeCollectionProvider() {
  for (const [name, p] of Object.entries(COLLECTION_PROVIDERS)) {
    if (p.isConfigured()) return name;
  }
  return null;
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
