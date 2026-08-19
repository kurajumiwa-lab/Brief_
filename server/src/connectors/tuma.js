// ---------------------------------------------------------------------------
// TUMA PAYMENT CONNECTOR (COLLECTION)
//
// Brief's payment gateway for customer -> merchant money, replacing the
// abandoned Safaricom Daraja M-PESA Express (STK Push) integration.
//
// The ACTUAL Tuma contract (https://github.com/matatashadrack/tuma-mpesa-stk-push,
// linked from https://tuma.co.ke/faqs/ as the official docs) is:
//
//   Base URL     https://api.tuma.co.ke
//   Auth         POST /auth/token        { email, api_key } -> data.token (JWT)
//   Collect      POST /payment/stk-push  { amount, phone, description, callback_url }
//                (Authorization: Bearer <token>)
//   Callback     Tuma POSTs to `callback_url` (User-Agent: Tuma-Webhook/1.0) a
//                flat JSON body -- see parseCallback() for the exact shapes.
//
// The DESTINATION is not configured here. Tuma settles collected funds to the
// bank account / till registered on the Tuma business profile (here: the LOOP
// BIZ / LOOP business account). Brief never sees or needs the LOOP number --
// that is a Tuma-side merchant relationship. This is deliberate: Brief owns
// its transaction state; Tuma owns the rail and the destination.
//
// WHAT TUMA DOES NOT DOCUMENT (stated honestly, never invented):
//   * no HMAC/signature on webhooks -- authenticity is (a) a secret path
//     segment in the callback URL and (b) matching the checkout_request_id +
//     amount against a stored intent, exactly like the old Daraja callback.
//   * no disbursement (B2C/payout) endpoint -- payouts stay on a separate
//     rail (see settlement.js); Tuma is collection-only here.
//   * no sandbox host -- the base URL is overridable via TUMA_BASE_URL, but
//     Tuma publishes no sandbox; testing uses real accounts.
//
// CREDENTIALS (server-side only; never in the client bundle):
//   TUMA_EMAIL            -- the business email used for /auth/token
//   TUMA_API_KEY          -- the `api_key` generated in the Tuma merchant portal
//   TUMA_CALLBACK_SECRET  -- a secret we invent for the callback path segment
//   BRIEF_PUBLIC_ORIGIN   -- the public origin, to build the callback URL
//   TUMA_BASE_URL         -- optional override (default https://api.tuma.co.ke)
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';

export const capabilities = {
  connector: 'tuma',
  rail: 'M-Pesa STK Push via Tuma (settles to the connected LOOP BIZ / till)',
  authenticate: 'JWT via email + api_key',
  collect: 'STK Push (C2B)',
  disburse: null, // Tuma documents no payout endpoint
  callbacks: 'HTTPS callback with server-side amount + reference re-verification'
};

function env(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
}

function baseUrl() {
  return env('TUMA_BASE_URL') || 'https://api.tuma.co.ke';
}

/**
 * The public origin Tuma must POST callbacks to. Never invented from the
 * request host -- only the configured BRIEF_PUBLIC_ORIGIN counts, so a
 * deployment without a real public URL reports callbacks as unavailable
 * rather than pointing the payment rail at localhost.
 */
function publicOrigin() {
  const o = env('BRIEF_PUBLIC_ORIGIN');
  return o ? o.replace(/\/+$/, '') : null;
}

/** The callback URL we hand to Tuma. Built server-side; the secret never leaves here. */
export function callbackUrl() {
  const origin = publicOrigin();
  const secret = env('TUMA_CALLBACK_SECRET');
  if (!origin || !secret) return null;
  return `${origin}/api/webhooks/tuma/${encodeURIComponent(secret)}`;
}

/** Which credentials are present. Reported, never guessed at. */
export function credentialState() {
  return {
    email: Boolean(env('TUMA_EMAIL')),
    apiKey: Boolean(env('TUMA_API_KEY')),
    callbackSecret: Boolean(env('TUMA_CALLBACK_SECRET')),
    publicOrigin: Boolean(publicOrigin())
  };
}

/**
 * Can Brief COLLECT money through Tuma?
 *
 * Requires the full end-to-end loop, not merely the auth pair: without a
 * callback URL Brief could push an STK prompt it could never confirm, which
 * would be a payment request that can never resolve. Fail-closed, like the
 * old Daraja connector.
 */
export function isConfigured() {
  const c = credentialState();
  return c.email && c.apiKey && c.callbackSecret && c.publicOrigin;
}

export function missingCredentials() {
  const c = credentialState();
  return Object.entries(c).filter(([, present]) => !present).map(([k]) => k);
}

export function status() {
  return {
    provider: 'tuma',
    baseUrl: baseUrl(),
    callbackUrl: callbackUrl(),
    configured: isConfigured(),
    missing: missingCredentials(),
    reason: isConfigured()
      ? null
      : `Tuma is not configured. Missing: ${missingCredentials().join(', ')}.`
  };
}

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------

let cachedToken = null;

/**
 * Tuma JWT. Obtain one with the business email + api_key, cache it until
 * shortly before expiry so a burst of payments does not fetch a token each.
 */
export async function accessToken({ fetchImpl = fetch } = {}) {
  if (!env('TUMA_EMAIL') || !env('TUMA_API_KEY')) {
    return { ok: false, reason: 'not_configured', missing: missingCredentials() };
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return { ok: true, token: cachedToken.token, cached: true };
  }

  try {
    const res = await fetchImpl(`${baseUrl()}/auth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: env('TUMA_EMAIL'), api_key: env('TUMA_API_KEY') })
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.data?.token) {
      return {
        ok: false,
        reason: body?.error_code === 'IPRS_VERIFICATION_REQUIRED' ? 'iprs_verification_required' : 'auth_failed',
        status: res.status,
        message: body?.message ?? null
      };
    }
    cachedToken = {
      token: body.data.token,
      // Prefer the JWT's own `exp`; fall back to a conservative 23h.
      expiresAt: Date.now() + tokenTtlMs(body.data.token)
    };
    return { ok: true, token: body.data.token, cached: false };
  } catch (e) {
    return { ok: false, reason: 'network_error', message: String(e.message ?? e) };
  }
}

function tokenTtlMs(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    const exp = Number(payload?.exp);
    if (Number.isFinite(exp) && exp * 1000 > Date.now()) return exp * 1000 - Date.now();
  } catch { /* not a parseable JWT; use the fallback */ }
  return 23 * 60 * 60 * 1000;
}

/** Test seam only: forget the cached JWT. */
export function _resetTokenCache() {
  cachedToken = null;
}

// ---------------------------------------------------------------------------
// PHONE NORMALISATION
// ---------------------------------------------------------------------------

/**
 * Tuma requires 2547XXXXXXXX / 2541XXXXXXXX (international format). Kenyan
 * users type 0722..., +254722..., or 722.... Normalising here means every
 * caller gets the same rule and a bad number is refused before it becomes a
 * failed payment. (Same rule the Daraja connector used; duplicated so the
 * provider stays self-contained.)
 */
export function normalisePhone(input) {
  const digits = String(input ?? '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  let n = digits;
  if (n.startsWith('254')) { /* already correct */ }
  else if (n.startsWith('0')) n = `254${n.slice(1)}`;
  else if (n.length === 9 && (n.startsWith('7') || n.startsWith('1'))) n = `254${n}`;
  else return null;
  if (!/^254[71][0-9]{8}$/.test(n)) return null;
  return n;
}

// ---------------------------------------------------------------------------
// STK PUSH (collect)
// ---------------------------------------------------------------------------

/**
 * Ask the customer's phone to authorise a payment, via Tuma.
 *
 * `amount` is supplied by the SERVER from the order row -- never by the
 * client. Tuma accepts whole shillings for our purposes.
 */
export async function stkPush({ amount, phone, description = 'Brief order', fetchImpl = fetch }) {
  if (!isConfigured()) {
    return { ok: false, reason: 'not_configured', missing: missingCredentials() };
  }
  const msisdn = normalisePhone(phone);
  if (!msisdn) return { ok: false, reason: 'invalid_phone' };
  const whole = Math.round(Number(amount));
  if (!Number.isFinite(whole) || whole <= 0) return { ok: false, reason: 'invalid_amount' };

  const tok = await accessToken({ fetchImpl });
  if (!tok.ok) return { ok: false, reason: tok.reason, detail: tok };

  const payload = {
    amount: whole,
    phone: msisdn,
    description: String(description).slice(0, 255),
    callback_url: callbackUrl()
  };

  try {
    const res = await fetchImpl(`${baseUrl()}/payment/stk-push`, {
      method: 'POST',
      headers: { authorization: `Bearer ${tok.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) {
      return { ok: false, reason: 'push_rejected', status: res.status, body };
    }
    const d = body.data ?? {};
    return {
      ok: true,
      // The provider reference Brief reconciles against later.
      checkoutRequestId: d.checkout_request_id ?? null,
      merchantRequestId: d.merchant_request_id ?? null,
      paymentId: d.payment_id ?? null,
      customerMessage: d.customer_message ?? body.message ?? null
    };
  } catch (e) {
    return { ok: false, reason: 'network_error', message: String(e.message ?? e) };
  }
}

// ---------------------------------------------------------------------------
// CALLBACK PARSING
// ---------------------------------------------------------------------------

/**
 * Parse Tuma's webhook into a flat, checkable result.
 *
 * Two documented success/failure shapes (LOOP tutorial + main README), both
 * flat JSON. This function only EXTRACTS; the caller re-checks the amount and
 * reference against the stored intent -- a callback amount is never trusted
 * as authoritative on its own.
 */
export function parseCallback(body) {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'unrecognised_payload' };

  const checkoutRequestId = body.checkout_request_id ?? body.payment_id ?? null;
  if (!checkoutRequestId) return { ok: false, reason: 'unrecognised_payload' };

  const status = String(body.status ?? '').toLowerCase();
  // Success is signalled two ways that must agree: status "completed" and
  // result_code 0. A "completed" with a non-zero code is treated as failed.
  const resultCode = body.result_code === undefined || body.result_code === null
    ? null
    : Number(body.result_code);
  const succeeded = status === 'completed' && (resultCode === null || resultCode === 0);

  return {
    ok: true,
    checkoutRequestId,
    merchantRequestId: body.merchant_request_id ?? null,
    status,
    resultCode,
    resultDesc: body.result_desc ?? null,
    succeeded,
    amount: body.amount === undefined ? null : Number(body.amount),
    receipt: body.mpesa_receipt_number ?? null,
    failureReason: body.failure_reason ?? (succeeded ? null : (body.result_desc ?? null)),
    timestamp: body.timestamp ?? null,
    cancelled: status === 'cancelled'
  };
}

/**
 * Verify a callback really came from Tuma.
 *
 * Tuma does not sign callbacks. The deployment-controlled defence is a secret
 * path segment in the callback URL (the only part a deployment fully
 * controls), and the REAL authenticity check happens in confirmPayment(): a
 * callback must carry a checkout_request_id we issued, for an amount we asked
 * for. We state this plainly rather than claiming a signature check Tuma does
 * not perform.
 */
export function verifyCallbackSecret(providedSecret) {
  const expected = env('TUMA_CALLBACK_SECRET');
  if (!expected) {
    // FAIL CLOSED. An unset secret must not mean "accept everything".
    return { ok: false, reason: 'callback_secret_not_configured' };
  }
  const a = Buffer.from(String(providedSecret ?? ''));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return { ok: false, reason: 'bad_secret' };
  return crypto.timingSafeEqual(a, b)
    ? { ok: true }
    : { ok: false, reason: 'bad_secret' };
}
