// ---------------------------------------------------------------------------
// PAYSTACK CONNECTOR (COLLECTION)
//
// The white-label collection rail chosen for Brief (see docs/WHITE-LABEL.md):
// Paystack is live for ALL merchants in Kenya (CBK Payment Service Provider
// authorisation, Aug 2023), collects over M-PESA and cards, settles in KES,
// charges no setup or monthly fees -- only a per-transaction percentage once
// real money moves. Signup and the sandbox (test keys) are free.
//
// WHAT BRIEF USES
//   POST /transaction/initialize   -- hosted checkout (M-PESA + card channels)
//   webhook  charge.success/failed -- x-paystack-signature = HEX HMAC-SHA512
//                                     of the RAW request body, keyed with the
//                                     SECRET KEY. Verified timing-safe.
//
// AMOUNT UNITS (one canonical unit everywhere): Brief speaks WHOLE KES.
// Paystack speaks subunits (pesewas/cents). initialize() multiplies by 100;
// parseCallback() divides back, and ONLY when the result is a whole number --
// a subunit amount that does not divide cleanly is surfaced as-is so the
// intent's amount re-check in confirmPayment() fails LOUDLY rather than
// quietly rounding money.
//
// CURRENCY: this connector collects KES only. A callback in any other
// currency is parsed as NOT succeeded -- a NGN payment against a KES intent
// is a mismatch, not money.
//
// THE CUSTOMER EMAIL: transaction/initialize requires an email as the
// customer identifier. Brief holds no email on an intent, so a per-intent
// relay address is derived from the configured public origin
// (brief-order-<intentRef>@<origin host>). It is a checkout session
// identifier -- Brief never presents it as a contact fact about the payer.
//
// CREDENTIALS (server-side only; never in the client bundle):
//   PAYSTACK_SECRET_KEY          -- sk_test_... (sandbox) or sk_live_... (live)
//   PAYSTACK_BASE_URL            -- optional override (default https://api.paystack.co)
//   BRIEF_PUBLIC_ORIGIN          -- used only to derive the checkout email host
//
// WHAT PAYSTACK DOES NOT GIVE THIS CONNECTOR (stated, never invented):
//   * split payments / subaccounts are NOT wired here. Paystack supports
//     them, but Brief's commission rule is settled-ledger-first: attach,
//     settle, then payout from derived earnings (settlement.js). Registering
//     a disbursement connector is a separate, deliberate act.
//   * payouts: Paystack transfers are a documented future disbursement
//     provider, not this connector's job.
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';

export const capabilities = {
  connector: 'paystack',
  rail: 'Hosted checkout over M-PESA + cards (Paystack Kenya, PSP-authorised)',
  authenticate: 'Bearer SECRET_KEY',
  collect: 'transaction/initialize (authorization_url handed to the payer)',
  disburse: null, // transfers exist at Paystack; not registered as a payout provider
  callbacks: 'HTTPS webhook, HMAC-SHA512 signature over the raw body'
};

function env(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
}

function baseUrl() {
  return env('PAYSTACK_BASE_URL') || 'https://api.paystack.co';
}

function secretKey() {
  return env('PAYSTACK_SECRET_KEY');
}

export function credentialState() {
  const key = secretKey();
  return {
    secretKey: Boolean(key),
    // Reported, derived from the key itself -- never a claim we make up.
    mode: key ? (key.startsWith('sk_live') ? 'live' : 'sandbox') : null
  };
}

export function isConfigured() {
  return credentialState().secretKey;
}

export function missingCredentials() {
  const c = credentialState();
  return Object.entries(c).filter(([k, present]) => k !== 'mode' && !present).map(([k]) => k);
}

export function status() {
  const c = credentialState();
  return {
    provider: 'paystack',
    baseUrl: baseUrl(),
    configured: c.secretKey,
    mode: c.mode,
    missing: missingCredentials(),
    reason: c.secretKey
      ? null
      : 'Paystack is not configured. Missing: PAYSTACK_SECRET_KEY.'
  };
}

// ---------------------------------------------------------------------------
// SIGNATURE
// ---------------------------------------------------------------------------

/**
 * The webhook signature Paystack sends as x-paystack-signature:
 * hex HMAC-SHA512 of the raw request body, keyed with the secret key.
 * Exported pure so tests can verify the exact documented construction.
 */
export function computeSignature(rawBody, key = secretKey()) {
  if (!key || typeof rawBody !== 'string') return null;
  return crypto.createHmac('sha512', key).update(rawBody, 'utf8').digest('hex');
}

/**
 * Verify a webhook really came from Paystack. FAILS CLOSED: no configured
 * key means nothing is accepted. Timing-safe comparison; no early exit on
 * length mismatch beyond the unequal-length refusal timingSafeEqual requires.
 *
 * Mirrors the connector interface used by the tuma route, plus the raw body
 * Paystack (unlike tuma) actually signs.
 */
export function verifyCallbackSecret(providedSignature, rawBody) {
  const key = secretKey();
  if (!key) return { ok: false, reason: 'secret_key_not_configured' };
  const expected = computeSignature(String(rawBody ?? ''), key);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(providedSignature ?? ''), 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// COLLECTION
// ---------------------------------------------------------------------------

function originHost() {
  const o = env('BRIEF_PUBLIC_ORIGIN');
  if (!o) return null;
  try {
    return new URL(o).host;
  } catch {
    return null;
  }
}

/** The checkout-session email Paystack requires. An identifier, not a fact. */
function checkoutEmail(reference) {
  const host = originHost() ?? 'brief.local';
  return `brief-order-${String(reference).toLowerCase().replace(/[^a-z0-9-]/g, '')}@${host}`;
}

/**
 * Start a collection: initialize a hosted checkout the payer completes
 * (M-PESA STK or card on the Paystack page). Returns the provider reference
 * Brief reconciles against later, plus the authorization_url the payer needs.
 */
export async function collect({ amount, phone, description = 'Brief order', reference = null, fetchImpl = fetch }) {
  if (!isConfigured()) {
    return { ok: false, reason: 'not_configured', missing: missingCredentials() };
  }
  const whole = Math.round(Number(amount));
  if (!Number.isFinite(whole) || whole <= 0) return { ok: false, reason: 'invalid_amount' };

  // Brief's own provider reference. Generated here (not trusted from the
  // caller unless it is already a server-issued intent reference shape) so
  // confirmPayment() can match the callback to the intent.
  const ref = reference ?? `brief-${crypto.randomUUID()}`;
  const payload = {
    email: checkoutEmail(ref),
    amount: whole * 100, // whole KES -> subunits
    currency: 'KES',
    reference: ref,
    // Passed through so the payer sees what they are paying for.
    description: String(description).slice(0, 255)
  };
  if (phone) payload.metadata = { phone: String(phone).slice(0, 20) };

  try {
    const res = await fetchImpl(`${baseUrl()}/transaction/initialize`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secretKey()}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.status !== true || !body?.data?.authorization_url) {
      return { ok: false, reason: 'initialize_rejected', status: res.status, body };
    }
    const d = body.data;
    return {
      ok: true,
      checkoutRequestId: d.reference ?? ref, // THE reconciliation key
      authorizationUrl: d.authorization_url,
      accessCode: d.access_code ?? null,
      paymentId: String(d.id ?? '') || null,
      customerMessage: 'Checkout opened. Complete the M-PESA or card prompt to pay.'
    };
  } catch (e) {
    return { ok: false, reason: 'network_error', message: String(e.message ?? e) };
  }
}

// ---------------------------------------------------------------------------
// CALLBACK PARSING
// ---------------------------------------------------------------------------

/**
 * Parse a Paystack webhook into the flat, checkable shape the payment domain
 * applies. Only extracts; confirmPayment() re-checks amount and reference
 * against the stored intent. Events other than charge.* are surfaced as
 * `ignored` so the route can still answer 200 (Paystack retries non-2xx).
 */
export function parseCallback(body) {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'unrecognised_payload' };
  const event = String(body.event ?? '');
  const d = body.data ?? {};

  if (event !== 'charge.success' && event !== 'charge.failed') {
    return { ok: true, ignored: true, event };
  }

  const reference = d.reference ?? null;
  if (!reference) return { ok: false, reason: 'unrecognised_payload' };

  const currency = String(d.currency ?? '').toUpperCase();
  // Subunits -> whole KES, only when it divides exactly. A non-integral
  // result is passed through untouched so the amount re-check fails loudly.
  const subunits = Number(d.amount);
  let amount = Number.isFinite(subunits) ? subunits : null;
  if (amount !== null && currency === 'KES') {
    const whole = subunits / 100;
    if (Number.isInteger(whole)) amount = whole;
  }

  const succeeded = event === 'charge.success'
    && String(d.status ?? '') === 'success'
    && currency === 'KES';

  return {
    ok: true,
    ignored: false,
    event,
    checkoutRequestId: reference,
    status: String(d.status ?? ''),
    succeeded,
    amount,
    currency,
    receipt: d.id !== undefined && d.id !== null ? String(d.id) : (d.authorization?.authorization_code ?? null),
    failureReason: succeeded ? null : (d.gateway_response ?? `paystack ${event}`),
    timestamp: d.paid_at ?? d.created_at ?? null,
    cancelled: false
  };
}
