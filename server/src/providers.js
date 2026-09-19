// ---------------------------------------------------------------------------
// PAYMENT PROVIDER SEAM — KCB Buni, one rail, both directions.
//
//   COLLECTION     customer -> merchant   (M-Pesa STK push on KCB's shared till)
//   DISBURSEMENT   merchant -> customer   (refused until KCB's transfer contract
//                                          is in hand; see connectors/buni.js)
//
// One rail per direction, deliberately. Tuma (needs a paybill/bank relationship
// Brief does not have) and IntaSend (integrated, never exercised, and its payout
// tier for unregistered accounts undocumented) were both deleted rather than kept
// as "supported" options: every extra entry in this map is a second fee schedule,
// a second callback shape and a second failure mode the domains must reason about,
// and only one of them can ever be active. Pochi la Biashara survives as a
// PRACTICE, not a connector — it has no API for third parties, so it is the manual
// path this repo already implements: a person moves the money, finance confirms
// the ledger row.
//
// A connector module exposes: capabilities, isConfigured(), status(),
// credentialState/missingCredentials, collect(), parseCallback(),
// verifyCallbackSecret(), callbackUrl(); for payout rails also disburse(),
// isPayoutConfigured() and payoutFee().
//
// Domain code calls the provider-neutral operations here and NEVER a vendor's
// endpoint or payload shape. That is why the commerce webhook route can be
// rewritten for a new rail without touching a domain file.
// ---------------------------------------------------------------------------

import * as buni from './connectors/buni.js';

export const COLLECTION_PROVIDERS = { buni };
export const DISBURSEMENT_PROVIDERS = { buni };

/** The active collection provider's name, or null when no rail is usable. */
export function activeCollectionProvider() {
  return buni.isConfigured() ? 'buni' : null;
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

/**
 * The active disbursement provider, or null. Buni reports not-configured until
 * KCB's transfer contract is confirmed, so this is null today and every payout
 * stays manual + finance-confirmed — which is a decision, not a gap.
 */
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
    // Where the money would land, stated rather than implied, so an operator can
    // see the sandbox/production line from the API instead of from a README.
    rail: collectionName ? {
      env: collectionProvider(collectionName).currentEnv?.() ?? null,
      enablement: collectionProvider(collectionName).enablementState?.() ?? null
    } : null,
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
