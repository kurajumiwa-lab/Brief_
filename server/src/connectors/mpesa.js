// ---------------------------------------------------------------------------
// M-PESA DARAJA CONNECTOR (COLLECTION / STK PUSH  +  DISBURSEMENT / B2C)
//
// The direct Daraja integration (distinct from the Tuma gateway used for
// marketplace collection). Two rails live here:
//
//   COLLECTION    STK Push (C2B)  -- escrow/order payment for HudumaLink.
//   DISBURSEMENT  B2C BusinessPayment  -- merchant/seller payouts. Chosen
//                 because it is the CHEAPEST payout rail in Kenya: a flat
//                 M-Pesa "send money" tariff capped at KES 108, with no
//                 aggregator markup and a free API. The flat fee is passed
//                 through to the recipient at exact cost (see b2cFee()).
//
// THE REAL DARAJA CONTRACT (https://developer.safaricom.co.ke):
//
//   Base URL      sandbox:  https://sandbox.safaricom.co.ke
//                 production: https://api.safaricom.co.ke   (MPESA_ENV=production)
//   Auth          GET /oauth/v1/generate?grant_type=client_credentials
//                 Authorization: Basic base64(consumer_key:consumer_secret)
//                 -> access_token (valid ~1h)
//   STK Push      POST /mpesa/stkpush/v1/process
//                 Password = base64(Shortcode + Passkey + Timestamp)
//   B2C Payout    POST /mpesa/b2c/v3/paymentrequest
//                 { InitiatorName, SecurityCredential, CommandID:'BusinessPayment',
//                   Amount, PartyA (shortcode), PartyB (recipient phone),
//                   QueueTimeOutURL, ResultURL, Occasion }
//                 -> { ConversationID, OriginatorConversationID, ResponseCode }
//   B2C Result    Daraja POSTs asynchronously to ResultURL with
//                 Result.{ResultCode, ConversationID, TransactionID, ...}
//
// AUTHENTICITY OF A CALLBACK:
//   Daraja does not sign callbacks. The deployment-controlled defence is a
//   secret path segment in the callback URL (the only part we fully control),
//   AND the real check: the callback must carry a reference we issued (STK
//   CheckoutRequestID / B2C ConversationID) for an amount that matches what we
//   stored. We state this plainly rather than claim a signature Daraja does
//   not perform.
//
// CREDENTIALS (server-side only; never in any client bundle):
//   MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET  -- Daraja app credentials
//   MPESA_PASSKEY          -- the Lipa Na M-Pesa Online passkey (STK only)
//   MPESA_SHORTCODE        -- the paybill/till / org shortcode (PartyA for B2C)
//   MPESA_CALLBACK_SECRET  -- a secret we invent for the callback path segment
//   MPESA_B2C_INITIATOR            -- the B2C API initiator username
//   MPESA_B2C_SECURITY_CREDENTIAL  -- that initiator's password, RSA-encrypted
//                                    against the Daraja cert and base64'd (see
//                                    Safaricom's B2C setup; generated once).
//   MPESA_ENV              -- 'sandbox' (default) or 'production'
//   BRIEF_PUBLIC_ORIGIN    -- the public origin, to build the callback URL
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';

export const capabilities = {
  connector: 'mpesa-daraja',
  rail: 'Safaricom M-Pesa Daraja',
  authenticate: 'OAuth2 client_credentials (Basic)',
  collect: 'STK Push (C2B)',
  disburse: 'B2C BusinessPayment (merchant -> customer payout)',
  callbacks: 'HTTPS callback with server-side reference + amount re-verification'
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
    payoutConfigured: isPayoutConfigured(),
    payoutMissing: payoutMissingCredentials(),
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

// ---------------------------------------------------------------------------
// B2C DISBURSEMENT (PAYOUT)
// ---------------------------------------------------------------------------

/**
 * The flat M-Pesa B2C ("send money to a mobile number") tariff, in whole
 * KES. Source: Safaricom's published M-Pesa transfer charges — the column
 * "Transfer to M-PESA Users / Pochi la Biashara / Business till to Customer".
 * Capped at KES 108 for any amount. Being a FLAT fee (not a percentage), it
 * can be passed through to a recipient at exact cost — no rounding, no markup.
 */
const B2C_TARIFF = [
  { upTo: 49, fee: 0 },
  { upTo: 100, fee: 0 },
  { upTo: 500, fee: 7 },
  { upTo: 1000, fee: 13 },
  { upTo: 1500, fee: 23 },
  { upTo: 2500, fee: 33 },
  { upTo: 3500, fee: 53 },
  { upTo: 5000, fee: 57 },
  { upTo: 7500, fee: 78 },
  { upTo: 10000, fee: 90 },
  { upTo: 15000, fee: 100 },
  { upTo: 20000, fee: 105 },
  { upTo: 35000, fee: 108 },
  { upTo: 50000, fee: 108 },
  { upTo: 250000, fee: 108 }
];

/** The B2C fee for a payout amount, in whole KES. Null for a nonsense amount. */
export function b2cFee(amount) {
  const a = Math.round(Number(amount));
  if (!Number.isFinite(a) || a <= 0) return null;
  for (const band of B2C_TARIFF) {
    if (a <= band.upTo) return band.fee;
  }
  return 108; // above the highest published band: stay at the cap
}

/** Provider-neutral alias so settlement.js can quote a fee without knowing the rail. */
export function payoutFee(amount) {
  return b2cFee(amount) ?? 0;
}

/** The URL Daraja POSTs the asynchronous B2C result to. */
export function b2cResultUrl() {
  const origin = publicOrigin();
  const secret = env('MPESA_CALLBACK_SECRET');
  if (!origin || !secret) return null;
  return `${origin}/api/webhooks/mpesa-b2c/${encodeURIComponent(secret)}`;
}

/** Everything B2C needs to actually disburse. Fail-closed, like the STK loop. */
export function payoutCredentialState() {
  return {
    consumerKey: Boolean(env('MPESA_CONSUMER_KEY')),
    consumerSecret: Boolean(env('MPESA_CONSUMER_SECRET')),
    shortcode: Boolean(env('MPESA_SHORTCODE')),
    callbackSecret: Boolean(env('MPESA_CALLBACK_SECRET')),
    publicOrigin: Boolean(publicOrigin()),
    b2cInitiator: Boolean(env('MPESA_B2C_INITIATOR')),
    b2cSecurityCredential: Boolean(env('MPESA_B2C_SECURITY_CREDENTIAL'))
  };
}

/** Can Brief actually send a payout? Requires the full end-to-end B2C chain. */
export function isPayoutConfigured() {
  return Object.values(payoutCredentialState()).every(Boolean);
}

export function payoutMissingCredentials() {
  return Object.entries(payoutCredentialState()).filter(([, p]) => !p).map(([k]) => k);
}

/**
 * Send money to a customer (B2C). The amount is supplied by the SERVER from a
 * stored payout row — never by the client. Returns the ConversationID as
 * providerRef; the actual success/failure arrives later on the ResultURL and
 * is applied by settlement.confirmPayout().
 */
export async function disburse({ amount, phone, remarks = 'Brief payout', fetchImpl = fetch }) {
  if (!isPayoutConfigured()) {
    return { ok: false, reason: 'not_configured', missing: payoutMissingCredentials() };
  }
  const msisdn = normalisePhone(phone);
  if (!msisdn) return { ok: false, reason: 'invalid_phone' };
  const whole = Math.round(Number(amount));
  if (!Number.isFinite(whole) || whole <= 0) return { ok: false, reason: 'invalid_amount' };

  const tok = await accessToken({ fetchImpl });
  if (!tok.ok) return { ok: false, reason: tok.reason, detail: tok };

  const note = String(remarks).slice(0, 100);
  const payload = {
    InitiatorName: env('MPESA_B2C_INITIATOR'),
    SecurityCredential: env('MPESA_B2C_SECURITY_CREDENTIAL'),
    CommandID: 'BusinessPayment',
    Amount: whole,
    PartyA: env('MPESA_SHORTCODE'),
    PartyB: msisdn,
    Remarks: note,
    QueueTimeOutURL: b2cResultUrl(),
    ResultURL: b2cResultUrl(),
    Occasion: note
  };

  try {
    const res = await fetchImpl(`${baseUrl()}/mpesa/b2c/v3/paymentrequest`, {
      method: 'POST',
      headers: { authorization: `Bearer ${tok.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || String(body?.ResponseCode) !== '0') {
      return { ok: false, reason: 'disburse_rejected', status: res.status, body };
    }
    return {
      ok: true,
      providerRef: body.ConversationID ?? null,
      originatorConversationId: body.OriginatorConversationID ?? null
    };
  } catch (e) {
    return { ok: false, reason: 'network_error', message: String(e.message ?? e) };
  }
}

/**
 * Parse the asynchronous B2C result Daraja POSTs to the ResultURL. Extracts
 * only; the caller (settlement.confirmPayout) reconciles the ConversationID
 * against a stored payout. ResultCode 0 => success.
 */
export function parseB2CResult(body) {
  const result = body?.Result;
  if (!result || typeof result !== 'object') return { ok: false, reason: 'unrecognised_payload' };

  const resultCode = result.ResultCode === undefined || result.ResultCode === null
    ? null : Number(result.ResultCode);
  const succeeded = resultCode === 0;

  return {
    ok: true,
    conversationId: result.ConversationID ?? null,
    originatorConversationId: result.OriginatorConversationID ?? null,
    transactionId: result.TransactionID ?? null,
    resultCode,
    resultDesc: result.ResultDesc ?? null,
    succeeded,
    failureReason: succeeded ? null : (result.ResultDesc ?? null)
  };
}
