// ---------------------------------------------------------------------------
// FEATURE REGISTRY
//
// The single authority on "is this feature on, and can it actually run?".
//
//   key         stable name (also the deploy-toggle key)
//   domain      which route module owns it
//   label       human-readable, for the capabilities table
//   configured  a FUNCTION over live state -- provider credentials, never a
//               stored flag -- so it can never drift from reality
//
// Three states compose:
//   enabled      deploy-time switch: BRIEF_DISABLED_FEATURES=a,b,c turns a
//                feature off without a code change (routes 503 at the edge).
//   configured   runtime availability: does it have what it needs to run?
//   available    enabled && configured
//
// "Shelf space" (report §4.2): an unwired feature sits in this table, visible
// and toggleable, and its `configured` is false until its credentials exist.
// The requireFeature() guard removes a DISABLED feature from the request path;
// the provider-backed features keep their richer, tested domain-level 503s for
// "not configured" -- this registry reports that state, it does not duplicate
// it.
// ---------------------------------------------------------------------------

import * as providers from './providers.js';
import * as outbound from './outbound.js';
import * as telegram from './connectors/telegram.js';
import * as whatsapp from './connectors/whatsapp.js';

const DEFINITIONS = [
  // Always-configured: these run on the local store and need no credential.
  { key: 'auth',      domain: 'auth',       label: 'Accounts & sessions',             configured: () => true },
  { key: 'sources',   domain: 'sources',    label: 'Sources',                         configured: () => true },
  { key: 'connectors',domain: 'connectors', label: 'Ingest connectors (web/RSS)',     configured: () => true },
  { key: 'briefit',   domain: 'briefit',    label: 'Capture ("Brief It")',            configured: () => true },
  { key: 'objects',   domain: 'objects',    label: 'Objects, discovery & trust',      configured: () => true },
  { key: 'circles',   domain: 'circles',    label: 'Circles, blocks & signals',       configured: () => true },
  { key: 'economic',  domain: 'economic',   label: 'Ledger & transactions',           configured: () => true },
  { key: 'commerce',  domain: 'commerce',   label: 'Commerce (vendors/listings/orders)', configured: () => true },
  { key: 'campaigns', domain: 'campaigns',  label: 'Campaigns, registration & gate',  configured: () => true },
  { key: 'vaults',    domain: 'vaults',     label: 'The Vault (context layer)',       configured: () => true },
  { key: 'arena',     domain: 'arena',      label: 'Arena',                           configured: () => true },
  { key: 'auction',   domain: 'auction',    label: 'Auctions',                        configured: () => true },
  { key: 'fantasy',   domain: 'fantasy',    label: 'Fantasy 11',                      configured: () => true },
  { key: 'command',   domain: 'command',    label: 'Host command centre',             configured: () => true },
  { key: 'people',    domain: 'people',     label: 'Person entity (timeline & identity)', configured: () => true },
  { key: 'tea',       domain: 'tea',        label: 'Tea editorial system',              configured: () => true },
  // Provider-backed: configured derives from LIVE credentials, never a stored flag.
  { key: 'payments',  domain: 'commerce',   label: 'Payment collection (Tuma STK)',   configured: () => providers.providerStatus().configured },
  { key: 'payouts',   domain: 'commerce',   label: 'Merchant payouts (disbursement)', configured: () => providers.providerStatus().payoutConfigured },
  { key: 'outbound',  domain: 'connectors', label: 'Outbound messaging',              configured: () => outbound.status().anyConfigured },
  { key: 'telegram',  domain: 'connectors', label: 'Telegram ingest',                 configured: () => telegram.isConfigured() },
  { key: 'whatsapp',  domain: 'connectors', label: 'WhatsApp ingest',                 configured: () => whatsapp.isConfigured() }
];

const byKey = new Map(DEFINITIONS.map((d) => [d.key, d]));

/** The deploy-time disable list, read fresh so tests and ops can change it live. */
function disabledList() {
  const raw = process.env.BRIEF_DISABLED_FEATURES || '';
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

export function isEnabled(key) {
  return byKey.has(key) && !disabledList().has(key);
}

export function isConfigured(key) {
  const def = byKey.get(key);
  if (!def) return false;
  try { return Boolean(def.configured()); } catch { return false; }
}

/** enabled && configured -- the one answer "can a user use this right now?". */
export function available(key) {
  return isEnabled(key) && isConfigured(key);
}

/** One feature's public state, for the capabilities table. */
export function featureState(key) {
  const def = byKey.get(key);
  return {
    key,
    label: def.label,
    domain: def.domain,
    enabled: isEnabled(key),
    configured: isConfigured(key),
    available: available(key)
  };
}

export function list() {
  return [...byKey.keys()].map(featureState);
}

/** The whole table plus the disabled keys, for /api/capabilities. */
export function status() {
  const features = list();
  return {
    features,
    disabled: features.filter((f) => !f.enabled).map((f) => f.key)
  };
}

/**
 * Express guard for a deploy-time-disabled feature. A disabled feature 503s at
 * the edge so it leaves the request path without a code change. It deliberately
 * does NOT gate on `configured`: provider-backed features keep their richer,
 * tested domain-level "not configured" responses -- this guard is only the
 * deploy switch.
 */
export function requireFeature(key) {
  return (req, res, next) => {
    if (!isEnabled(key)) {
      return res.status(503).json({ error: `feature disabled: ${key}`, feature: key, disabled: true });
    }
    next();
  };
}
