// ---------------------------------------------------------------------------
// M-PESA DARAJA CONNECTOR (COLLECTION / STK PUSH)
//
// The blueprint specifies Safaricom's own Daraja API for the escrow STK loop.
// This is the direct Daraja integration (distinct from the Tuma gateway used
// elsewhere in the repo) so HudumaLink can run on a merchant's own Daraja app.
//
// THE REAL DARAJA CONTRACT (https://developer.safaricom.co.ke):
//
//   Base URL      sandbox:  https://sandbox.safaricom.co.ke
//                 production: https://api.safaricom.co.ke   (MPESA_ENV=production)
//   Auth          GET /oauth/v1/generate?grant_type=client_credentials
//                 Authorization: Basic base64(consumer_key:consumer_secret)
//                 -> access_token (valid ~1h)
//   STK Push      POST /mpesa/stkpush/v1/process
//                 Authorization: Bearer <access_token>
//                 Password = base64(Shortcode + Passkey + Timestamp)
//                 Timestamp = YYYYMMDDHHmmss
//   Callback      Daraja POSTs to CallBackURL (no signature) with
//                 Body.stkCallback.{ResultCode, ResultDesc, CheckoutRequestID,
//                 CallbackMetadata.Item[]}
//
// AUTHENTICITY OF A CALLBACK:
//   Daraja does not sign callbacks. The deployment-controlled defence is a
//   secret path segment in the CallBackURL (the only part we fully control),
//   AND the real check: the callback must carry a CheckoutRequestID we issued,
//   for an amount that matches the order total. We state this plainly rather
//   than claim a signature Daraja does not perform.
//
// CREDENTIALS (server-side only; never in any client bundle):
//   MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET  -- Daraja app credentials
//   MPESA_PASSKEY          -- the Lipa Na M-Pesa Online passkey
//   MPESA_SHORTCODE        -- the paybill/till (e.g. 174379 sandbox)
//   MPESA_CALLBACK_SECRET  -- a secret we invent for the callback path segment
//   MPESA_ENV              -- 'sandbox' (default) or 'production'
//   BRIEF_PUBLIC_ORIGIN    -- the public origin, to build the callback URL
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';

export const capabilities = {
  connector: 'mpesa-daraja',
  rail: 'Safaricom M-Pesa Daraja STK Push (C2B)',
  authenticate: 'OAuth2 client_credentials (Basic)',
  collect: 'STK Push',
  disburse: null, // Daraja B2B/B2C payout is a separate, unplugged rail
  callbacks: 'HTTPS callback with server-side amount + CheckoutRequestID re-verification'
};

function env(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
}

function baseUrl() {
  return env('MPESA_ENV') === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

function publicOrigin() {
  const o = env('BRIEF_PUBLIC_ORIGIN');
  return o ? o.replace(/\/+$/, '') : null;
}

/** The callback URL handed to Daraja. Built server-side; the secret never leaves here. */
export function callbackUrl() {
  const origin = publicOrigin();
  const secret = env('MPESA_CALLBACK_SECRET');
  if (!origin || !secret) return null;
  return `${origin}/api/huduma/webhooks/mpesa/${encodeURIComponent(secret)}`;
}

export function credentialState() {
  return {
    consumerKey: Boolean(env('MPESA_CONSUMER_KEY')),
    consumerSecret: Boolean(env('MPESA_CONSUMER_SECRET')),
    passkey: Boolean(env('MPESA_PASSKEY')),
    shortcode: Boolean(env('MPESA_SHORTCODE')),
    callbackSecret: Boolean(env('MPESA_CALLBACK_SECRET')),
    publicOrigin: Boolean(publicOrigin())
  };
}

/**
 * Can we run the FULL STK loop? Requires the end-to-end chain, not just the
 * auth pair: without a callback URL we could push a PIN prompt we could never
 * confirm — a payment request that never resolves. Fail-closed, like Tuma.
 */
export function isConfigured() {
  return Object.values(credentialState()).every(Boolean);
}

export function missingCredentials() {
  return Object.entries(credentialState()).filter(([, p]) => !p).map(([k]) => k);
}

export function status() {
  return {
    provider: 'mpesa-daraja',
    baseUrl: baseUrl(),
    env: env('MPESA_ENV') === 'production' ? 'production' : 'sandbox',
    callbackUrl: callbackUrl(),
    configured: isConfigured(),
    missing: missingCredentials(),
    reason: isConfigured() ? null
      : `M-Pesa is not configured. Missing: ${missingCredentials().join(', ')}.`
  };
}

// ---------------------------------------------------------------------------
// PHONE NORMALISATION (self-contained so the connector stays swappable)
// ---------------------------------------------------------------------------

export function normalisePhone(input) {
  const digits = String(input ?? '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  let n = digits;
  if (n.startsWith('254')) { /* already correct */ }
  else if (n.startsWith('0')) n = `254${n.slice(1)}`;
  else if (n.length === 9 && (n.startsWith('7') || n.startsWith('1'))) n = `254${n}`;
  else return null;
  if (!/^254[17][0-9]{8}$/.test(n)) return null;
  return n;
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

let cachedToken = null;

/** Daraja access token, cached until shortly before expiry. */
export async function accessToken({ fetchImpl = fetch } = {}) {
  const key = env('MPESA_CONSUMER_KEY');
  const secret = env('MPESA_CONSUMER_SECRET');
  if (!key || !secret) {
    return { ok: false, reason: 'not_configured', missing: missingCredentials() };
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return { ok: true, token: cachedToken.token, cached: true };
  }
  try {
    const basic = Buffer.from(`${key}:${secret}`).toString('base64');
    const res = await fetchImpl(
      `${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { authorization: `Basic ${basic}` } }
    );
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.access_token) {
      return { ok: false, reason: 'auth_failed', status: res.status };
    }
    cachedToken = {
      token: body.access_token,
      // Daraja tokens live ~3600s; be conservative.
      expiresAt: Date.now() + Math.min(Number(body.expires_in ?? 3540), 3540) * 1000
    };
    return { ok: true, token: cachedToken.token, cached: false };
  } catch (e) {
    return { ok: false, reason: 'network_error', message: String(e.message ?? e) };
  }
}

/** Test seam only. */
export function _resetTokenCache() { cachedToken = null; }

// ---------------------------------------------------------------------------
// STK PUSH
// ---------------------------------------------------------------------------

/** The Daraja password: base64(Shortcode + Passkey + Timestamp). */
export function stkPassword(shortcode, passkey, timestamp) {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

/** YYYYMMDDHHmmss in Africa/Nairobi-equivalent server local time. */
export function stkTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/**
 * Ask the citizen's phone to authorise a payment. `amount` is supplied by the
 * SERVER from the order row — never by the client.
 */
export async function stkPush({ amount, phone, accountReference = 'HudumaLink', description = 'Service', fetchImpl = fetch }) {
  if (!isConfigured()) {
    return { ok: false, reason: 'not_configured', missing: missingCredentials() };
  }
  const msisdn = normalisePhone(phone);
  if (!msisdn) return { ok: false, reason: 'invalid_phone' };
  const whole = Math.round(Number(amount));
  if (!Number.isFinite(whole) || whole <= 0) return { ok: false, reason: 'invalid_amount' };

  const shortcode = env('MPESA_SHORTCODE');
  const timestamp = stkTimestamp();
  const tok = await accessToken({ fetchImpl });
  if (!tok.ok) return { ok: false, reason: tok.reason, detail: tok };

  const payload = {
    BusinessShortCode: shortcode,
    Password: stkPassword(shortcode, env('MPESA_PASSKEY'), timestamp),
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: whole,
    PartyA: msisdn,
    PartyB: shortcode,
    PhoneNumber: msisdn,
    CallBackURL: callbackUrl(),
    AccountReference: String(accountReference).slice(0, 12),
    TransactionDesc: String(description).slice(0, 13)
  };

  try {
    const res = await fetchImpl(`${baseUrl()}/mpesa/stkpush/v1/process`, {
      method: 'POST',
      headers: { authorization: `Bearer ${tok.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || String(body?.ResponseCode) !== '0') {
      return { ok: false, reason: 'push_rejected', status: res.status, body };
    }
    return {
      ok: true,
      // The CheckoutRequestID is the reference we reconcile the callback against.
      checkoutRequestId: body.CheckoutRequestID ?? null,
      merchantRequestId: body.MerchantRequestID ?? null,
      customerMessage: body.CustomerMessage ?? body.ResponseDescription ?? null
    };
  } catch (e) {
    return { ok: false, reason: 'network_error', message: String(e.message ?? e) };
  }
}

// ---------------------------------------------------------------------------
// CALLBACK PARSING + AUTHENTICITY
// ---------------------------------------------------------------------------

/**
 * Parse a Daraja STK callback into a flat, checkable result. Extracts only;
 * the caller re-verifies the amount + CheckoutRequestID against the stored
 * order — a callback amount is never trusted as authoritative on its own.
 *
 * ResultCode 0 => success; anything else (1032 cancelled, 1037 timeout, 1
 * insufficient balance, ...) => failure, and there is no CallbackMetadata.
 */
export function parseCallback(body) {
  const cb = body?.Body?.stkCallback;
  if (!cb || typeof cb !== 'object') return { ok: false, reason: 'unrecognised_payload' };

  const resultCode = cb.ResultCode === undefined || cb.ResultCode === null
    ? null : Number(cb.ResultCode);
  const succeeded = resultCode === 0;

  // Flatten the CallbackMetadata Item[] into a name->value map when present.
  const meta = {};
  const items = cb.CallbackMetadata?.Item;
  if (Array.isArray(items)) {
    for (const it of items) {
      if (it && it.Name) meta[it.Name] = it.Value ?? null;
    }
  }

  return {
    ok: true,
    checkoutRequestId: cb.CheckoutRequestID ?? null,
    merchantRequestId: cb.MerchantRequestID ?? null,
    resultCode,
    resultDesc: cb.ResultDesc ?? null,
    succeeded,
    cancelled: resultCode === 1032,
    // Amount arrives as a float (1.0); normalise to whole shillings for the
    // escrow comparison, the same unit orders store.
    amount: meta.Amount === undefined || meta.Amount === null
      ? null : Math.round(Number(meta.Amount)),
    receipt: meta.MpesaReceiptNumber ?? null,
    phone: meta.PhoneNumber ? String(meta.PhoneNumber) : null,
    failureReason: succeeded ? null : (cb.ResultDesc ?? null)
  };
}

/**
 * Verify the callback path segment. Daraja does not sign callbacks; the
 * deployment-controlled defence is the secret in the URL we gave Daraja.
 */
export function verifyCallbackSecret(providedSecret) {
  const expected = env('MPESA_CALLBACK_SECRET');
  if (!expected) return { ok: false, reason: 'callback_secret_not_configured' }; // FAIL CLOSED
  const a = Buffer.from(String(providedSecret ?? ''));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return { ok: false, reason: 'bad_secret' };
  return crypto.timingSafeEqual(a, b) ? { ok: true } : { ok: false, reason: 'bad_secret' };
}
