// ---------------------------------------------------------------------------
// M-PESA (SAFARICOM DARAJA) PAYMENT CONNECTOR -- COLLECTION DEPRECATED
//
// Brief's audience is in Kenya, so the payment rail that matters is M-Pesa.
// This connector still provides the REAL Daraja B2C payout (business ->
// customer) integration, which remains the disbursement rail because Tuma
// documents no payout endpoint.
//
// The Daraja M-PESA Express STK Push COLLECTION flow (customer -> business)
// is DEPRECATED: Brief's collection provider is now Tuma (see tuma.js), which
// settles to the connected LOOP BIZ / till. The stkPush() and
// parseStkCallback() functions below are retained only for reference and for
// deployments that have not yet migrated; they are no longer reachable from
// the pay path (see ../providers.js).
//
// HONEST SCOPE, AND WHY THERE IS NO SANDBOX MODE HERE.
//
// Every network call below is real. There is deliberately NO "simulate
// success" branch: a fake success path is the single most dangerous thing
// that can exist in payment code, because it eventually runs in production
// and invents money. If credentials are absent, `isConfigured()` is false and
// every operation refuses with a stated reason. Nothing is mocked.
//
// Daraja's own sandbox is supported the moment someone supplies sandbox
// credentials -- MPESA_ENV=sandbox switches the base URL to the sandbox host.
// That is a real provider, not a simulation inside Brief.
//
// CREDENTIALS (all absent in this deployment):
//   MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET  -- OAuth
//   MPESA_SHORTCODE, MPESA_PASSKEY             -- STK Push
//   MPESA_CALLBACK_URL                         -- where Daraja posts results
//   MPESA_INITIATOR_NAME, MPESA_SECURITY_CREDENTIAL -- B2C payouts
//   MPESA_ENV=sandbox|production               -- default sandbox
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';

export const capabilities = {
  connector: 'mpesa',
  rail: 'M-Pesa (Safaricom Daraja)',
  authenticate: 'OAuth client credentials',
  collect: 'STK Push (C2B)',
  disburse: 'B2C payment request',
  callbacks: 'HTTPS callback with server-side amount re-verification'
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

/** Which credentials are present. Reported, never guessed at. */
export function credentialState() {
  return {
    consumerKey: Boolean(env('MPESA_CONSUMER_KEY')),
    consumerSecret: Boolean(env('MPESA_CONSUMER_SECRET')),
    shortcode: Boolean(env('MPESA_SHORTCODE')),
    passkey: Boolean(env('MPESA_PASSKEY')),
    callbackUrl: Boolean(env('MPESA_CALLBACK_URL')),
    // Payout needs strictly more than collection does.
    initiatorName: Boolean(env('MPESA_INITIATOR_NAME')),
    securityCredential: Boolean(env('MPESA_SECURITY_CREDENTIAL'))
  };
}

/** Can we COLLECT money (STK Push)? */
export function isConfigured() {
  const c = credentialState();
  return c.consumerKey && c.consumerSecret && c.shortcode && c.passkey && c.callbackUrl;
}

/** Can we DISBURSE money (B2C)? A separate, stricter question. */
export function isPayoutConfigured() {
  const c = credentialState();
  return c.consumerKey && c.consumerSecret && c.shortcode &&
    c.initiatorName && c.securityCredential;
}

export function missingCredentials() {
  const c = credentialState();
  return Object.entries(c).filter(([, present]) => !present).map(([k]) => k);
}

export function status() {
  return {
    provider: 'mpesa',
    environment: env('MPESA_ENV') === 'production' ? 'production' : 'sandbox',
    configured: isConfigured(),
    payoutConfigured: isPayoutConfigured(),
    missing: missingCredentials(),
    reason: isConfigured()
      ? null
      : `M-Pesa is not configured. Missing: ${missingCredentials().join(', ')}.`
  };
}

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------

let cachedToken = null;

/**
 * Daraja OAuth. Tokens last an hour; cache with a safety margin so a burst of
 * payments does not trigger a token fetch per request.
 */
export async function accessToken({ fetchImpl = fetch } = {}) {
  if (!env('MPESA_CONSUMER_KEY') || !env('MPESA_CONSUMER_SECRET')) {
    return { ok: false, reason: 'not_configured', missing: missingCredentials() };
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return { ok: true, token: cachedToken.token, cached: true };
  }

  const basic = Buffer.from(`${env('MPESA_CONSUMER_KEY')}:${env('MPESA_CONSUMER_SECRET')}`).toString('base64');
  try {
    const res = await fetchImpl(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { authorization: `Basic ${basic}` }
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.access_token) {
      return { ok: false, reason: 'auth_failed', status: res.status, body };
    }
    cachedToken = {
      token: body.access_token,
      expiresAt: Date.now() + (Number(body.expires_in ?? 3599) * 1000)
    };
    return { ok: true, token: body.access_token, cached: false };
  } catch (e) {
    return { ok: false, reason: 'network_error', message: String(e.message ?? e) };
  }
}

/** Test seam only: forget the cached OAuth token. */
export function _resetTokenCache() {
  cachedToken = null;
}

// ---------------------------------------------------------------------------
// PHONE NORMALISATION
// ---------------------------------------------------------------------------

/**
 * Daraja requires 2547XXXXXXXX / 2541XXXXXXXX. Kenyan users type 0722...,
 * +254722..., or 722.... Normalising here rather than at the UI means every
 * caller gets the same rule, and a bad number is refused before it becomes a
 * failed payment.
 */
export function normalisePhone(input) {
  const digits = String(input ?? '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  let n = digits;
  if (n.startsWith('254')) { /* already correct */ }
  else if (n.startsWith('0')) n = `254${n.slice(1)}`;
  else if (n.length === 9 && (n.startsWith('7') || n.startsWith('1'))) n = `254${n}`;
  else return null;
  // 254 + 9 digits, and Kenyan mobile prefixes are 7 or 1.
  if (!/^254[71][0-9]{8}$/.test(n)) return null;
  return n;
}

// ---------------------------------------------------------------------------
// STK PUSH (collect)
// ---------------------------------------------------------------------------

function stkPassword(shortcode, passkey, timestamp) {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

export function darajaTimestamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Ask the customer's phone to authorise a payment.
 *
 * `amount` is supplied by the SERVER from the order row -- never by the
 * client. Daraja accepts whole shillings only.
 */
export async function stkPush({ amount, phone, accountReference, description = 'Brief', fetchImpl = fetch }) {
  if (!isConfigured()) {
    return { ok: false, reason: 'not_configured', missing: missingCredentials() };
  }
  const msisdn = normalisePhone(phone);
  if (!msisdn) return { ok: false, reason: 'invalid_phone' };
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, reason: 'invalid_amount' };
  }

  const tok = await accessToken({ fetchImpl });
  if (!tok.ok) return { ok: false, reason: tok.reason, detail: tok };

  const timestamp = darajaTimestamp();
  const shortcode = env('MPESA_SHORTCODE');
  const payload = {
    BusinessShortCode: shortcode,
    Password: stkPassword(shortcode, env('MPESA_PASSKEY'), timestamp),
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: msisdn,
    PartyB: shortcode,
    PhoneNumber: msisdn,
    CallBackURL: env('MPESA_CALLBACK_URL'),
    AccountReference: String(accountReference).slice(0, 12),
    TransactionDesc: String(description).slice(0, 13)
  };

  try {
    const res = await fetchImpl(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { authorization: `Bearer ${tok.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.ResponseCode !== '0') {
      return { ok: false, reason: 'push_rejected', status: res.status, body };
    }
    return {
      ok: true,
      // The provider reference Brief reconciles against later.
      checkoutRequestId: body.CheckoutRequestID,
      merchantRequestId: body.MerchantRequestID,
      customerMessage: body.CustomerMessage
    };
  } catch (e) {
    return { ok: false, reason: 'network_error', message: String(e.message ?? e) };
  }
}

// ---------------------------------------------------------------------------
// CALLBACK PARSING
// ---------------------------------------------------------------------------

/**
 * Parse Daraja's STK callback into a flat, checkable result.
 *
 * The amount Daraja reports is NOT trusted as authoritative on its own -- the
 * caller re-checks it against the intent it recorded. This function only
 * extracts; it does not decide.
 */
export function parseStkCallback(body) {
  const cb = body?.Body?.stkCallback;
  if (!cb) return { ok: false, reason: 'unrecognised_payload' };

  const items = cb.CallbackMetadata?.Item ?? [];
  const pick = (name) => items.find((i) => i.Name === name)?.Value ?? null;

  return {
    ok: true,
    checkoutRequestId: cb.CheckoutRequestID ?? null,
    merchantRequestId: cb.MerchantRequestID ?? null,
    // 0 means the customer authorised it. Anything else is a failure, and
    // 1032 specifically means they cancelled on their handset.
    resultCode: Number(cb.ResultCode),
    resultDesc: cb.ResultDesc ?? '',
    succeeded: Number(cb.ResultCode) === 0,
    amount: pick('Amount'),
    receipt: pick('MpesaReceiptNumber'),
    phone: pick('PhoneNumber') ? String(pick('PhoneNumber')) : null,
    transactionDate: pick('TransactionDate')
  };
}

/**
 * Verify a callback really came from Safaricom.
 *
 * Daraja does not sign callbacks. The supported protections are (a) a secret
 * path segment in the callback URL and (b) source-IP allow-listing. Brief
 * implements (a) because it is the one a deployment fully controls, and says
 * so rather than claiming a signature check it cannot perform.
 */
export function verifyCallbackSecret(providedSecret) {
  const expected = env('MPESA_CALLBACK_SECRET');
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

// ---------------------------------------------------------------------------
// B2C (payout)
// ---------------------------------------------------------------------------

/**
 * Send money to a seller. Requires the stricter payout credential set, which
 * Safaricom issues only to a verified business.
 */
export async function b2cPayout({ amount, phone, remarks = 'Brief payout', occasion = '', fetchImpl = fetch }) {
  if (!isPayoutConfigured()) {
    return { ok: false, reason: 'payout_not_configured', missing: missingCredentials() };
  }
  const msisdn = normalisePhone(phone);
  if (!msisdn) return { ok: false, reason: 'invalid_phone' };
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, reason: 'invalid_amount' };

  const tok = await accessToken({ fetchImpl });
  if (!tok.ok) return { ok: false, reason: tok.reason, detail: tok };

  try {
    const res = await fetchImpl(`${baseUrl()}/mpesa/b2c/v1/paymentrequest`, {
      method: 'POST',
      headers: { authorization: `Bearer ${tok.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        InitiatorName: env('MPESA_INITIATOR_NAME'),
        SecurityCredential: env('MPESA_SECURITY_CREDENTIAL'),
        CommandID: 'BusinessPayment',
        Amount: amount,
        PartyA: env('MPESA_SHORTCODE'),
        PartyB: msisdn,
        Remarks: String(remarks).slice(0, 100),
        QueueTimeOutURL: env('MPESA_TIMEOUT_URL') ?? env('MPESA_CALLBACK_URL'),
        ResultURL: env('MPESA_RESULT_URL') ?? env('MPESA_CALLBACK_URL'),
        Occasion: String(occasion).slice(0, 100)
      })
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.ResponseCode !== '0') {
      return { ok: false, reason: 'payout_rejected', status: res.status, body };
    }
    return { ok: true, conversationId: body.ConversationID, originatorConversationId: body.OriginatorConversationID };
  } catch (e) {
    return { ok: false, reason: 'network_error', message: String(e.message ?? e) };
  }
}
