// ---------------------------------------------------------------------------
// SMILE ID CONNECTOR (VERIFICATION ASSIST)
//
// The KYC rail chosen for Brief's verification records (docs/WHITE-LABEL.md):
// Smile ID is Nairobi-built, covers Kenyan national ID / passport / alien
// card lookups, its developer sandbox is free, and production pricing is
// pay-per-check. It ASSISTS review; it never replaces it.
//
// WHAT BRIEF USES (Services API v2, header auth)
//   signature = base64(HMAC-SHA256(key = API_KEY,
//                                  msg = timestamp + partner_id + "sid_request"))
//   headers   : smileid-partner-id, smileid-request-signature, smileid-timestamp
//   POST /v2/id_verification      -- national ID / passport lookups (kind: identity)
//   POST /v2/verify-phone-number  -- phone ownership checks (kind: phone)
//
// GOVERNANCE (this is the part that matters):
//   * Assist only. A provider result is RECORDED on the verification record
//     for the reviewer; it never auto-approves anything. The human decision
//     stays on the audited /api/ops/verification/:id/decision route.
//   * PII MINIMIMISATION: Brief stores ONLY outcome codes and text returned
//     by the provider. The ID number / phone number itself is sent to the
//     provider for the check and is NEVER persisted on the record (DPA).
//   * Honest failure: a network error, a bad credential, or an unrecognised
//     response is recorded as exactly that. Nothing is inferred.
//
// CREDENTIALS (server-side only):
//   SMILE_PARTNER_ID  -- the partner id from the Smile ID dashboard
//   SMILE_API_KEY     -- the API key from the dashboard
//   SMILE_ENV         -- 'sandbox' (default) | 'production'
//   SMILE_BASE_URL    -- optional override (default https://api.smileidentity.com)
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';

export const capabilities = {
  connector: 'smileid',
  rail: 'Kenyan ID / phone lookups against official registers (Smile ID)',
  authenticate: 'HMAC-SHA256 request signature (partner id + API key)',
  assists: 'verification records (identity, phone) — review stays human',
  collectsDocuments: false, // lookups only; Brief never stores ID images
  callbacks: null
};

function env(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
}

function baseUrl() {
  return env('SMILE_BASE_URL') || 'https://api.smileidentity.com';
}

function smileEnv() {
  const e = env('SMILE_ENV');
  return e === 'production' ? 'production' : 'sandbox';
}

export function credentialState() {
  return {
    partnerId: Boolean(env('SMILE_PARTNER_ID')),
    apiKey: Boolean(env('SMILE_API_KEY'))
  };
}

export function isConfigured() {
  const c = credentialState();
  return c.partnerId && c.apiKey;
}

export function missingCredentials() {
  return Object.entries(credentialState()).filter(([, p]) => !p).map(([k]) => k);
}

export function status() {
  const configured = isConfigured();
  return {
    provider: 'smileid',
    baseUrl: baseUrl(),
    env: smileEnv(),
    configured,
    missing: missingCredentials(),
    reason: configured
      ? null
      : `Smile ID is not configured. Missing: ${missingCredentials().join(', ')}.`
  };
}

/**
 * The documented request signature: base64 HMAC-SHA256 of
 * timestamp + partner_id + "sid_request", keyed with the API key.
 * Pure and exported so tests can verify the exact construction.
 */
export function computeSignature(timestamp, partnerId = env('SMILE_PARTNER_ID'), apiKey = env('SMILE_API_KEY')) {
  if (!timestamp || !partnerId || !apiKey) return null;
  return crypto
    .createHmac('sha256', apiKey)
    .update(timestamp, 'utf8')
    .update(partnerId, 'utf8')
    .update('sid_request', 'utf8')
    .digest('base64');
}

function authHeaders(timestamp) {
  return {
    'smileid-partner-id': env('SMILE_PARTNER_ID'),
    'smileid-request-signature': computeSignature(timestamp),
    'smileid-timestamp': timestamp,
    'smileid-source-sdk': 'brief-server',
    'content-type': 'application/json'
  };
}

/**
 * One provider call shared by both lookups. Never throws for a provider
 * failure -- an honest {ok:false, reason} is the contract.
 */
async function call(path, payload, fetchImpl) {
  if (!isConfigured()) return { ok: false, reason: 'not_configured', missing: missingCredentials() };
  const timestamp = new Date().toISOString();
  try {
    const res = await fetchImpl(`${baseUrl()}${path}`, {
      method: 'POST',
      headers: authHeaders(timestamp),
      body: JSON.stringify({ ...payload, partner_id: env('SMILE_PARTNER_ID'), environment: smileEnv() })
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, reason: 'provider_rejected', status: res.status, body };
    }
    return { ok: true, body };
  } catch (e) {
    return { ok: false, reason: 'network_error', message: String(e.message ?? e) };
  }
}

/** Result code/text normalisation. Codes are Smile ID's; text is theirs. */
function outcome(body) {
  return {
    resultCode: body?.ResultCode !== undefined ? String(body.ResultCode) : (body?.result_code !== undefined ? String(body.result_code) : null),
    resultText: body?.ResultText ?? body?.result_text ?? null
  };
}

/**
 * Look up a Kenyan national ID (or passport/alien card) against the
 * register. The idNumber is used for THIS call and then dropped; only the
 * outcome is returned for storage.
 */
export async function lookupId({ idType = 'KE_NATIONAL_ID', idNumber, firstName = null, lastName = null, country = 'KE', fetchImpl = fetch }) {
  if (!idNumber || !String(idNumber).trim()) return { ok: false, reason: 'id_number_required' };
  const payload = {
    id_type: String(idType),
    id_number: String(idNumber).trim(),
    country: String(country)
  };
  if (firstName) payload.first_name = String(firstName).slice(0, 60);
  if (lastName) payload.last_name = String(lastName).slice(0, 60);
  const r = await call('/v2/id_verification', payload, fetchImpl);
  if (!r.ok) return r;
  return { ok: true, ...outcome(r.body), raw: r.body };
}

/**
 * Check that a phone number is registered and (when names given) matches.
 * Used for kind: 'phone'. Same PII rule: the number is not persisted.
 */
export async function lookupPhone({ phoneNumber, country = 'KE', firstName = null, lastName = null, fetchImpl = fetch }) {
  if (!phoneNumber || !String(phoneNumber).trim()) return { ok: false, reason: 'phone_number_required' };
  const payload = {
    phone_number: String(phoneNumber).trim(),
    country: String(country)
  };
  const match = {};
  if (firstName) match.first_name = String(firstName).slice(0, 60);
  if (lastName) match.last_name = String(lastName).slice(0, 60);
  if (Object.keys(match).length) payload.match_fields = match;
  const r = await call('/v2/verify-phone-number', payload, fetchImpl);
  if (!r.ok) return r;
  return { ok: true, ...outcome(r.body), raw: r.body };
}
