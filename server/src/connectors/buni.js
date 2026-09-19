// ---------------------------------------------------------------------------
// KCB BUNI CONNECTOR — the rail Brief moves money through, both directions.
//
// WHY BUNI. It is KCB's API gateway (WSO2-based). Collection is an M-Pesa STK
// push against KCB's shared paybill/till, so Brief does not need its own Safaricom
// paybill, its own Daraja registration, or a Safaricom-side approval. Payout is
// a transfer from the KCB account. The trade-off is that KCB, not Safaricom,
// holds the relationship — which is what a bank account is for.
//
// WHAT IS VERIFIED, AND WHAT IS NOT — read this before trusting a status line.
//
//   VERIFIED against KCB's own portal material / multiple independent writeups:
//     * auth: POST {base}/token?grant_type=client_credentials, HTTP Basic
//       `consumerKey:consumerSecret`, returns an OAuth `access_token`;
//     * collection: POST {base}/mm/api/request/1.0.0/stkpush with
//       {phoneNumber, amount, invoiceNumber, sharedShortCode, orgShortCode,
//       orgPassKey, callbackUrl, transactionDescription}; the UAT sandbox short
//       code is 522522; invoiceNumber for a KCB till is `{TILL}-{YOUR REF}`;
//     * sandbox host: https://uat.buni.kcbgroup.com (published by KCB);
//     * go-live: a signed request letter to buni@kcbgroup.com, after they review
//       the sandbox implementation.
//   NOT VERIFIED, and therefore refused rather than guessed:
//     * the PRODUCTION host. KCB does not publish it; third parties report
//       `https://api.buni.kcbgroup.com` from probing the gateway. A guessed host
//       on a money call is unacceptable, so the default production base URL
//       requires BUNI_PROD_HOST_ACK=1 and otherwise refuses with the reason.
//     * the B2C / transfer REQUEST BODY. `POST /fundstransfer/1.0.0/api/v1/transfer`
//       appears in KCB's catalogue, but the field names for a payout to an
//       M-Pesa MSISDN are not published in anything I could read. `disburse()`
//       therefore REFUSES unless BUNI_ALLOW_UNVERIFIED_TRANSFERS=1 is set, and
//       says so. Payouts stay: a human sends the money, finance confirms the
//       ledger row (which is how Brief already works).
//     * the callback signature. KCB relays Safaricom's own STK result
//       (`Body.stkCallback`) to the callbackUrl we send, and it is UNSIGNED —
//       there is no header to verify. So the secret path segment on
//       /api/webhooks/buni/:secret is OUR device (it stops drive-by POSTs), and
//       the real authenticity check is in the domain: the reference must be one
//       Brief issued and the amount must match the stored intent. KCB's signed
//       "IPN" product is a different API on different routes and is not wired
//       here; if it is ever enabled, that becomes the authoritative feed.
//
// Every failure path returns a named reason and writes nothing. A payment is
// never marked settled because a webhook looked friendly, and a push is never
// reported as sent if no provider reference came back to chase.
// ---------------------------------------------------------------------------

import { normalisePhone } from './phone.js';

const env = (k) => (process.env[k] ? String(process.env[k]).trim() : '');

export const PROVIDER = 'buni';

export const HOSTS = {
  uat: 'https://uat.buni.kcbgroup.com',
  // Reported by third parties probing the live gateway; NOT published by KCB.
  production: 'https://api.buni.kcbgroup.com'
};

export const PATHS = {
  token: '/token?grant_type=client_credentials',
  stkPush: '/mm/api/request/1.0.0/stkpush',
  transfer: '/fundstransfer/1.0.0/api/v1/transfer',
  query: '/kcb/transaction/query/1.0.0/api/v1/payment/query/'
};

export const capabilities = {
  collection: ['mpesa_stk_push'],
  disbursement: ['kcb_transfer'],
  // The STK result is relayed by KCB and carries no signature. Anything that
  // claims otherwise is lying about the security model.
  signedCallbacks: false,
  signedIpnAvailableButNotWired: true,
  sandboxShortCode: '522522',
  feeSchedule: 'not_published_in_reviewed_material'
};

export function currentEnv() {
  return env('BUNI_ENV').toLowerCase() === 'production' ? 'production' : 'uat';
}

/** Refuses to default to a production host nobody published. */
export function baseUrl() {
  const override = env('BUNI_BASE_URL');
  if (override) return override.replace(/\/+$/, '');
  const which = currentEnv();
  if (which === 'production' && env('BUNI_PROD_HOST_ACK') !== '1') return '';
  return HOSTS[which];
}

export function productionHostUnacked() {
  return currentEnv() === 'production' && !env('BUNI_BASE_URL') && env('BUNI_PROD_HOST_ACK') !== '1';
}

export function credentialState() {
  return {
    consumerKey: Boolean(env('BUNI_CONSUMER_KEY')),
    consumerSecret: Boolean(env('BUNI_CONSUMER_SECRET')),
    orgShortCode: env('BUNI_ORG_SHORT_CODE') || null,
    orgPassKey: Boolean(env('BUNI_ORG_PASS_KEY')),
    tillNo: env('BUNI_TILL_NO') || null,
    webhookSecret: Boolean(env('BUNI_WEBHOOK_SECRET')),
    baseUrl: baseUrl() || null,
    env: currentEnv(),
    publicCallbackBase: env('BRIEF_PUBLIC_ORIGIN') || env('BRIEF_CALLBACK_BASE_URL') || ''
  };
}

export function missingCredentials() {
  const s = credentialState();
  const out = [];
  if (!s.consumerKey) out.push('BUNI_CONSUMER_KEY');
  if (!s.consumerSecret) out.push('BUNI_CONSUMER_SECRET');
  if (!s.baseUrl) {
    out.push(productionHostUnacked()
      ? 'BUNI_BASE_URL (or BUNI_PROD_HOST_ACK=1): KCB does not publish the production host, so it must be stated, not assumed'
      : 'BUNI_BASE_URL');
  }
  if (!s.webhookSecret) out.push('BUNI_WEBHOOK_SECRET');
  if (!s.publicCallbackBase) out.push('BRIEF_PUBLIC_ORIGIN (KCB requires an HTTPS callback URL)');
  return out;
}

export function isConfigured() {
  const s = credentialState();
  return Boolean(s.consumerKey && s.consumerSecret && s.baseUrl && s.webhookSecret);
}

/**
 * What KCB-side enablement each direction needs. `disbursement: false` is not a
 * code TODO — it is the gate described at the top of this file.
 */
export function enablementState() {
  return {
    collection: isConfigured(),
    disbursement: isConfigured() && env('BUNI_ALLOW_UNVERIFIED_TRANSFERS') === '1',
    disbursementNote: 'The transfer endpoint is in KCB\u2019s catalogue; its request body is not published in the material reviewed. Brief will not move money out with a guessed payload, so payouts remain manual + finance-confirmed until the contract is confirmed in writing (or IPN/transfer docs are supplied).'
  };
}

export function status() {
  const s = credentialState();
  const en = enablementState();
  return {
    provider: PROVIDER,
    configured: en.collection,
    env: s.env,
    baseUrl: s.baseUrl,
    orgShortCode: s.orgShortCode ?? (s.env === 'uat' ? HOSTS && '522522 (sandbox default)' : null),
    callbackConfigured: Boolean(s.webhookSecret),
    missing: missingCredentials(),
    // Stated in every status read, because "configured" is not "verified
    // working" and a payment bug is the one class of bug this product cannot
    // hide behind a nice interface.
    wireContract: 'documented_not_exercised',
    productionHostPublishedByKcb: false,
    callbacksSigned: capabilities.signedCallbacks,
    enablement: en,
    reason: en.collection
      ? 'Credentials are present. No live call has been made from this deployment: configured is not the same as working.'
      : 'KCB Buni is not configured. Brief cannot collect or disburse money.'
  };
}

/** Where KCB should post the STK result. Secret path segment: ours, not theirs. */
export function callbackUrl() {
  const base = env('BRIEF_PUBLIC_ORIGIN') || env('BRIEF_CALLBACK_BASE_URL');
  const secret = env('BUNI_WEBHOOK_SECRET');
  if (!base || !secret) return undefined;
  return `${base.replace(/\/+$/, '')}/api/webhooks/buni/${encodeURIComponent(secret)}`;
}

export function verifyCallbackSecret(secret) {
  const expected = env('BUNI_WEBHOOK_SECRET');
  if (!expected) return { ok: false, reason: 'callback_secret_not_configured' };
  if (String(secret ?? '') !== expected) return { ok: false, reason: 'bad_secret' };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// TOKEN — cached, and honestly re-minted when it expires
// ---------------------------------------------------------------------------

let TOKEN = null; // { value, expiresAtMs }

export function _resetTokenCache() { TOKEN = null; }

function basicAuth() {
  return Buffer.from(`${env('BUNI_CONSUMER_KEY')}:${env('BUNI_CONSUMER_SECRET')}`).toString('base64');
}

export async function accessToken({ fetchImpl = fetch, nowMs = Date.now() } = {}) {
  if (!env('BUNI_CONSUMER_KEY') || !env('BUNI_CONSUMER_SECRET')) {
    return { ok: false, reason: 'not_configured' };
  }
  const base = baseUrl();
  if (!base) return { ok: false, reason: productionHostUnacked() ? 'production_host_unacked' : 'no_base_url' };
  if (TOKEN && TOKEN.expiresAtMs > nowMs + 20_000) return { ok: true, token: TOKEN.value, cached: true };
  try {
    const res = await fetchImpl(`${base}${PATHS.token}`, {
      method: 'POST',
      headers: { authorization: `Basic ${basicAuth()}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: ''
    });
    const json = await res.json().catch(() => null);
    const value = json?.access_token ?? json?.AccessToken ?? null;
    if (!res.ok || !value) {
      return { ok: false, reason: res.ok ? 'no_access_token' : 'token_rejected', status: res.status, detail: json };
    }
    const seconds = Number(json.expires_in ?? json.expiresIn ?? 3600);
    TOKEN = { value: String(value), expiresAtMs: nowMs + (Number.isFinite(seconds) ? seconds : 3600) * 1000 };
    return { ok: true, token: TOKEN.value, cached: false };
  } catch (err) {
    return { ok: false, reason: 'network_error', detail: String(err?.message ?? err) };
  }
}

// ---------------------------------------------------------------------------
// COLLECT — M-Pesa STK push
// ---------------------------------------------------------------------------

/** KCB wants a string amount and a till-scoped invoice reference. */
function invoiceNumberFor(ourRef) {
  const till = env('BUNI_TILL_NO');
  const ref = String(ourRef ?? `brief-${Date.now()}`).replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
  return till ? `${till}-${ref}` : ref;
}

export async function collect({
  amount, phone, description = 'Brief payment', apiRef = null, callbackOverride = null, fetchImpl = fetch
} = {}) {
  if (!isConfigured()) return { ok: false, reason: 'not_configured', missing: missingCredentials() };
  const msisdn = normalisePhone(phone);
  if (!msisdn) return { ok: false, reason: 'invalid_phone' };
  const whole = Math.round(Number(amount));
  if (!Number.isFinite(whole) || whole <= 0) return { ok: false, reason: 'invalid_amount' };

  const tok = await accessToken({ fetchImpl });
  if (!tok.ok) return { ok: false, reason: tok.reason, detail: tok };

  const base = baseUrl();
  const cb = callbackOverride ?? callbackUrl();
  if (!cb) return { ok: false, reason: 'callback_url_required' };

  const body = {
    phoneNumber: msisdn,
    amount: String(whole),
    invoiceNumber: invoiceNumberFor(apiRef),
    // true = KCB's shared paybill/till receives the money. Brief has no paybill
    // of its own; that is the whole reason this rail was chosen.
    sharedShortCode: true,
    orgShortCode: env('BUNI_ORG_SHORT_CODE') || (currentEnv() === 'uat' ? '522522' : ''),
    orgPassKey: env('BUNI_ORG_PASS_KEY') || '',
    callbackUrl: cb,
    transactionDescription: String(description).slice(0, 100)
  };
  if (!body.orgShortCode) return { ok: false, reason: 'org_short_code_required' };

  let res;
  try {
    res = await fetchImpl(`${base}${PATHS.stkPush}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${tok.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) {
    return { ok: false, reason: 'network_error', detail: String(err?.message ?? err) };
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, reason: 'push_rejected', status: res.status, detail: json };

  // KCB answers with Daraja's envelope inside its own: Body.stkPushResponseCode.
  // Accept the nested form, the flat form, and camelCase, because the material
  // reviewed documents the request precisely and the response only by example.
  const outer = json?.Body ?? json ?? {};
  const b = outer.stkPushResponseCode ?? outer;
  const ref = b.CheckoutRequestID ?? b.checkout_request_id ?? b.checkoutRequestId ?? null;
  // No reference means nothing to match a later callback against, and an
  // unmatched intent is how a payer's KES 600 becomes a support ticket. Refuse.
  if (!ref) return { ok: false, reason: 'no_provider_reference', detail: json };
  const code = b.ResponseCode ?? b.response_code ?? b.ResultCode ?? null;
  if (code !== null && Number(code) !== 0 && Number(code) !== 204 && Number(code) !== 0.0) {
    return {
      ok: false,
      reason: 'push_refused',
      detail: { responseCode: code, description: b.ResponseDescription ?? b.ResultDesc ?? null }
    };
  }
  return {
    ok: true,
    provider: PROVIDER,
    // The payment domains already key on this name; the mapping is stated
    // rather than hidden in a rename across six modules.
    checkoutRequestId: String(ref),
    providerRef: String(ref),
    merchantRequestId: String(b.MerchantRequestID ?? json?.MerchantRequestID ?? ref),
    message: b.CustomerMessage ?? b.ResponseDescription ?? b.ResultDesc ?? null,
    amountKes: whole,
    invoiceNumber: body.invoiceNumber
  };
}

/** Explicit status read, because a callback can be missed. */
export async function paymentStatus(identifier, { fetchImpl = fetch } = {}) {
  if (!isConfigured()) return { ok: false, reason: 'not_configured' };
  if (!identifier) return { ok: false, reason: 'missing_reference' };
  const tok = await accessToken({ fetchImpl });
  if (!tok.ok) return { ok: false, reason: tok.reason };
  try {
    const res = await fetchImpl(`${baseUrl()}${PATHS.query}${encodeURIComponent(String(identifier))}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${tok.token}` }
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, reason: 'query_unavailable', status: res.status, detail: json };
    }
    return { ok: true, raw: json };
  } catch (err) {
    return { ok: false, reason: 'query_unavailable', detail: String(err?.message ?? err) };
  }
}

/**
 * PAYOUT — deliberately refused until KCB's transfer contract is in hand.
 *
 * This is not laziness. A guessed body against a live transfer endpoint is how
 * money leaves the wrong account. The catalogue says the endpoint exists; the
 * reviewed material never says what it takes, so the honest implementation is
 * a refusal with a reason plus the manual path that already exists in Brief
 * (a human sends it, finance confirms the ledger row).
 */
export async function disburse() {
  const gated = enablementState();
  if (!gated.disbursement) {
    return { ok: false, reason: 'transfer_contract_unverified', detail: gated.disbursementNote };
  }
  return {
    ok: false,
    reason: 'not_implemented',
    detail: 'The unverified-payout switch is on, but this build has no transfer payload to send. Supply KCB\u2019s documented request body and this becomes a real call.'
  };
}

export function isPayoutConfigured() {
  return enablementState().disbursement;
}

/** A fee nobody published is null, never 0. */
export function payoutFee() { return null; }
export function payoutFeeNote() {
  return 'KCB has not published a B2C/transfer fee schedule in the material reviewed. Brief books no fee, which is an assumption to confirm with the bank before any cash-out fee is shown to a member.';
}

// ---------------------------------------------------------------------------
// CALLBACK
// ---------------------------------------------------------------------------

const metadataItem = (cb, name) => {
  const items = cb?.CallBackMetadata?.Item;
  const list = Array.isArray(items) ? items : (items ? [items] : []);
  const hit = list.find((x) => String(x?.Name ?? '').toLowerCase() === name.toLowerCase());
  return hit?.Value ?? null;
};

/**
 * Parse the STK result KCB relays (Safaricom's own `Body.stkCallback` shape).
 *
 * Only a known terminal ResultCode is an answer. Anything else is
 * `ok:false`, which makes the route 400 and leaves the intent untouched —
 * because this callback is UNSIGNED, being believed is a privilege the payload
 * has to earn from its own shape plus the domain's reference-and-amount check.
 */
export function parseCallback(body) {
  const cb = body?.Body?.stkCallback ?? body?.stkCallback ?? body?.Body ?? body ?? {};
  const ref = cb.CheckoutRequestID ?? cb.checkout_request_id ?? null;
  const rawCode = cb.ResultCode ?? cb.result_code ?? null;
  const code = Number(rawCode);
  if (!ref || rawCode === undefined || rawCode === null || !Number.isFinite(code)) {
    return { ok: false, reason: 'unrecognised_payload' };
  }
  const amountRaw = cb.Amount ?? metadataItem(cb, 'Amount') ?? cb.TotalAmountCompleted ?? null;
  const amount = amountRaw === null || amountRaw === '' ? null : Math.round(Number(amountRaw));
  if (amount !== null && !Number.isFinite(amount)) return { ok: false, reason: 'unrecognised_payload' };
  const desc = String(cb.ResultDesc ?? cb.result_desc ?? '').toLowerCase();
  const cancelled = code === 1032 || /cancel/.test(desc);
  const succeeded = code === 0;
  if (!succeeded && !cancelled && code !== 1) {
    // Unknown code: not applied. The route answers 200 so KCB stops retrying,
    // and the intent is left alone for reconciliation.
    return { ok: false, reason: 'non_terminal_state', state: rawCode };
  }
  return {
    ok: true,
    succeeded,
    cancelled,
    checkoutRequestId: String(ref),
    providerRef: String(ref),
    amount: Number.isFinite(amount) ? amount : null,
    receipt: metadataItem(cb, 'MpesaReceiptNumber') ?? cb.ReceiptNumber ?? null,
    failureReason: succeeded ? null : (cb.ResultDesc ? `provider_result:${code} ${String(cb.ResultDesc).slice(0, 80)}` : `provider_result:${code}`),
    rawCode
  };
}
