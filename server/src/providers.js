// ---------------------------------------------------------------------------
// PAYMENT PROVIDER SEAM
//
// The single place that decides which provider moves money, for both
// directions:
//
//   COLLECTION     customer -> merchant   (M-Pesa STK Push).
//   DISBURSEMENT   merchant -> customer   (M-Pesa B2C). Both rails are
//                  configured-off until credentials exist, so the answer today
//                  is "Brief cannot move money", and every surface says so.
//
// Each provider is a connector module exposing a common shape:
//   capabilities, isConfigured(), status(),
//   collect, parseCallback(), verifyCallbackSecret()
//   ...and for disbursement providers, disburse(), isPayoutConfigured(),
//   payoutFee(amount) and a result parser.
//
// Adding a provider is: write a connector exposing the common shape, add it to
// the map below. One rail per direction by deliberate choice — Tuma was deleted
// rather than kept beside IntaSend, because two rails means two fee schedules,
// two callback shapes and two failure modes in every domain, and only one of
// them can be active anyway.
//
// The rest of Brief NEVER depends on a provider's API details directly. Domain code
// calls the provider-neutral operations here; the connector files are the only
// place that know a provider's endpoints, auth and payload shapes.
// ---------------------------------------------------------------------------

import * as intasend from './connectors/intasend.js';
import * as mpesa from './connectors/mpesa.js';

// INTASEND IS THE SOLE COLLECTION PROVIDER. One rail, one contract, no fallback
// guessing: if it is not configured, Brief honestly reports "no provider"
// rather than silently trying another rail. Tuma was removed outright (2026-09-19)
// rather than left as a second entry, because its prerequisite is a paybill/till
// or a registered bank account — the exact thing Brief does not have, so a
// "supported" rail there would be a promise the deployment cannot keep.
export const COLLECTION_PROVIDERS = { intasend };
// M-PESA DARAJA B2C is the disbursement provider: the cheapest payout rail in
// Kenya (flat M-Pesa "send money" tariff, capped KES 108, free API, no
// aggregator markup). Unconfigured until the B2C credentials are set, in
// which case activeDisbursementProvider() honestly returns null.
// Both rails are kept for payout: Daraja B2C (cheapest, needs registration)
// and IntaSend B2C (needs a can_disburse wallet). Neither is configured today,
// so activeDisbursementProvider() returns null and every payout stays manual.
export const DISBURSEMENT_PROVIDERS = { intasend, mpesa };

/** The active collection provider's name, or null when no rail is configured. */
export function activeCollectionProvider() {
  return intasend.isConfigured() ? 'intasend' : null;
}

/**
 * Provider-neutral callback handling, so the commerce route never learns a
 * vendor's payload shape or secret mechanism. It resolves the ACTIVE
 * collection rail first and falls back to the only registered one, which keeps
 * the endpoint honest about "no provider" when nothing is configured.
 */
function callbackProvider() {
  const name = activeCollectionProvider() ?? Object.keys(COLLECTION_PROVIDERS)[0] ?? null;
  return name ? { name, provider: COLLECTION_PROVIDERS[name] } : null;
}

export function verifyCallbackSecret(secret) {
  const c = callbackProvider();
  if (!c) return { ok: false, reason: 'no_provider' };
  return c.provider.verifyCallbackSecret(secret);
}

export function parseCallback(body) {
  const c = callbackProvider();
  if (!c) return { ok: false, reason: 'no_provider' };
  return { ...c.provider.parseCallback(body), provider: c.name };
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
