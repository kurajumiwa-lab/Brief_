// ---------------------------------------------------------------------------
// INTASEND CONNECTOR — collection (M-Pesa STK Push) and disbursement (B2C).
//
// WHY THIS RAIL AND NOT DARAJA. Daraja needs a registered business, a paybill
// or till, and a B2C activation; IntaSend publishes an "Unregistered" account
// type for exactly the situation Brief is in (intasend.com, "Payment Gateway
// without Company Registration"). That is their statement about their own
// onboarding, and this file repeats it as such — it is not a claim that Brief
// has an account.
//
// WHAT IS AND IS NOT VERIFIED HERE, stated because a connector that reads
// confidently about an API it has never called is how a payment bug ships:
//
//   * VERIFIED (their docs / official SDKs, read 2026-09-19): the endpoint
//     shapes below — POST /api/v2/collections/collection for STK push,
//     GET /api/v2/collections/status/<invoice_id>, POST /api/v2/transfers/ for
//     M-Pesa B2C with a `requires_approval` flag, and Bearer-style
//     `Authorization: Token <secret key>`.
//   * NOT VERIFIED: the sandbox host, the exact callback envelope, and the fee
//     schedule. `status()` therefore reports
//     `wireContract: 'documented_not_exercised'`, and no surface of Brief may
//     describe payments as working until a sandbox key has round-tripped one
//     real STK push and one real B2C.
//   * DISBURSEMENT CAVEAT, and it is the one that matters for paying riders:
//     IntaSend's own FAQ says the documents it requires "range from business
//     registration to KRA Tax Certificates" depending on account type, and a
//     payout needs a wallet created with `can_disburse = true`. Collection for
//     an unregistered account is documented; disbursement for an unregistered
//     account is NOT documented either way. Ask in the onboarding call, and do
//     not build the rider payout loop on the assumption.
//
// Until then the honest path is what it already is: a human pays out of M-Pesa
// (or Pochi la Biashara) and finance confirms the ledger row. Nothing in Brief
// invents a "paid" state, and this connector refusing is a normal event.
// ---------------------------------------------------------------------------

import { normalisePhone } from './phone.js';

const env = (k) => (process.env[k] ? String(process.env[k]).trim() : '');

export const PROVIDER = 'intasend';

export const capabilities = {
  collection: ['mpesa_stk_push', 'checkout_link'],
  disbursement: ['mpesa_b2c'],
  requiresApprovalForPayout: true,
  supportsWebhook: true,
  // No token exchange: a static secret key per request. One fewer failure mode
  // than an OAuth-style rail, and no cache to go stale.
  signedCallbacks: false,
  feeSchedule: 'not_published_in_reviewed_material'
};

export function isTestMode() {
  // Default to sandbox: a missing flag must never mean "move real money".
  const v = env('INTASEND_TEST').toLowerCase();
  if (v === 'false' || v === '0') return false;
  return true;
}

export function baseUrl() {
  // Their production API host. The sandbox host is NOT confirmed from the
  // material reviewed, so an override is mandatory for test keys rather than a
  // guessed default.
  const override = env('INTASEND_BASE_URL');
  if (override) return override.replace(/\/+$/, '');
  if (isTestMode() && !env('INTASEND_SANDBOX_ACK')) {
    return '';
  }
  return 'https://api.intasend.com';
}

const SECRET = 'INTASEND_SECRET_KEY';

export function credentialState() {
  const base = baseUrl();
  return {
    secretKey: Boolean(env(SECRET)),
    publishableKey: Boolean(env('INTASEND_PUBLISHABLE_KEY')),
    walletId: env('INTASEND_WALLET_ID') || null,
    baseUrl: base || null,
    testMode: isTestMode(),
    webhookSecret: Boolean(env('INTASEND_WEBHOOK_SECRET')),
    publicCallbackBase: env('BRIEF_PUBLIC_ORIGIN') || env('BRIEF_CALLBACK_BASE_URL') || ''
  };
}

export function missingCredentials() {
  const s = credentialState();
  const out = [];
  if (!s.secretKey) out.push('INTASEND_SECRET_KEY');
  if (!s.baseUrl) out.push('INTASEND_BASE_URL');
  if (!s.webhookSecret) out.push('INTASEND_WEBHOOK_SECRET');
  if (!s.publicCallbackBase) out.push('BRIEF_PUBLIC_ORIGIN (for the M-Pesa callback URL)');
  return out;
}

export function isConfigured() {
  const s = credentialState();
  return Boolean(s.secretKey && s.baseUrl && s.webhookSecret);
}

export function status() {
  const s = credentialState();
  return {
    provider: PROVIDER,
    configured: isConfigured(),
    testMode: s.testMode,
    baseUrl: s.baseUrl,
    callbackConfigured: Boolean(s.webhookSecret),
    walletId: s.walletId,
    missing: missingCredentials(),
    wireContract: 'documented_not_exercised',
    capabilities,
    reason: isConfigured()
      ? 'Credentials are present. No live call has been made from this deployment, so "configured" is not "verified working".'
      : 'IntaSend is not configured. Brief cannot collect or disburse money.'
  };
}

/** Where IntaSend should post payment state. The secret is a path segment. */
export function callbackUrl() {
  const base = env('BRIEF_PUBLIC_ORIGIN') || env('BRIEF_CALLBACK_BASE_URL');
  const secret = env('INTASEND_WEBHOOK_SECRET');
  if (!base || !secret) return undefined;
  return `${base.replace(/\/+$/, '')}/api/webhooks/intasend/${encodeURIComponent(secret)}`;
}

/**
 * Callbacks are authenticated by a deployment-controlled secret path segment
 * (INTASEND_WEBHOOK_SECRET) — OUR device, not their signature, because nothing
 * reviewed documents a signed envelope. FAILS CLOSED: no secret, no acceptance.
 * Real authenticity still comes from the domain: the reference must be one
 * Brief issued, with a matching amount.
 */
export function verifyCallbackSecret(secret) {
  const expected = env('INTASEND_WEBHOOK_SECRET');
  if (!expected) return { ok: false, reason: 'callback_secret_not_configured' };
  if (String(secret ?? '') !== expected) return { ok: false, reason: 'bad_secret' };
  return { ok: true };
}

function authHeaders() {
  return {
    'content-type': 'application/json',
    authorization: `Token ${env(SECRET)}`
  };
}

async function post(path, body, fetchImpl) {
  const base = baseUrl();
  if (!base) return { ok: false, reason: 'no_base_url' };
  try {
    const res = await fetchImpl(`${base}${path}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body)
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, reason: 'rejected', status: res.status, detail: json };
    return { ok: true, data: json ?? {} };
  } catch (err) {
    return { ok: false, reason: 'network_error', detail: String(err?.message ?? err) };
  }
}

async function get(path, fetchImpl) {
  const base = baseUrl();
  if (!base) return { ok: false, reason: 'no_base_url' };
  try {
    const res = await fetchImpl(`${base}${path}`, { method: 'GET', headers: authHeaders() });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, reason: 'rejected', status: res.status, detail: json };
    return { ok: true, data: json ?? {} };
  } catch (err) {
    return { ok: false, reason: 'network_error', detail: String(err?.message ?? err) };
  }
}

/**
 * Ask the payer's phone to authorise an M-Pesa payment.
 *
 * `amount` comes from the SERVER's order row, never from a client body. Whole
 * shillings only. `apiRef` is ours, and it is what the callback is matched on.
 */
export async function collect({
  amount, phone, email = null, names = null, description = 'Brief payment',
  apiRef = null, fetchImpl = fetch
} = {}) {
  if (!isConfigured()) return { ok: false, reason: 'not_configured', missing: missingCredentials() };
  const msisdn = normalisePhone(phone);
  if (!msisdn) return { ok: false, reason: 'invalid_phone' };
  const whole = Math.round(Number(amount));
  if (!Number.isFinite(whole) || whole <= 0) return { ok: false, reason: 'invalid_amount' };

  const body = {
    amount: whole,
    currency: 'KES',
    phone_number: msisdn,
    description: String(description).slice(0, 255),
    api_ref: String(apiRef ?? `brief-${Date.now()}`).slice(0, 100)
  };
  if (email) body.email = String(email).slice(0, 160);
  if (names) body.names = String(names).slice(0, 120);
  const wallet = env('INTASEND_WALLET_ID');
  if (wallet) body.wallet_id = wallet;
  const cb = callbackUrl();
  if (cb) body.callback_url = cb;

  const r = await post('/api/v2/collections/collection', body, fetchImpl);
  if (!r.ok) return { ok: false, reason: r.reason === 'rejected' ? 'push_rejected' : r.reason, detail: r.detail ?? null };
  const inv = r.data?.invoice ?? r.data ?? {};
  const ref = inv.invoice_id ?? inv.InvoiceID ?? null;
  if (!ref) return { ok: false, reason: 'no_provider_reference', detail: r.data };
  return {
    ok: true,
    provider: PROVIDER,
    // `checkoutRequestId` is the field name the payment domains already key on.
    // Renaming it here would touch six modules for cosmetics; the mapping is
    // stated instead of hidden.
    checkoutRequestId: String(ref),
    providerRef: String(ref),
    merchantRequestId: String(inv.merchant_request_id ?? ref),
    state: inv.state ?? null,
    checkoutUrl: inv.checkout_url ?? null,
    amountKes: whole
  };
}

/** Explicit status read, because a callback can be missed. */
export async function paymentStatus(invoiceId, { fetchImpl = fetch } = {}) {
  if (!isConfigured()) return { ok: false, reason: 'not_configured' };
  if (!invoiceId) return { ok: false, reason: 'missing_reference' };
  const r = await get(`/api/v2/collections/status/${encodeURIComponent(String(invoiceId))}`, fetchImpl);
  if (!r.ok) return r;
  return { ok: true, invoice: r.data?.invoice ?? r.data, raw: r.data };
}

/**
 * A payout: one M-Pesa B2C transfer to one person.
 *
 * `requires_approval` defaults to TRUE deliberately: a payout that fires on a
 * code path alone, with no second human in the loop, is how a bug becomes a
 * loss. Brief's finance confirmation step and IntaSend's approval step are the
 * same control, and neither is bypassed here.
 */
export async function disburse({ name, phone, amount, remarks = null, narrative = null, requiresApproval = true, fetchImpl = fetch } = {}) {
  if (!isConfigured()) return { ok: false, reason: 'not_configured', missing: missingCredentials() };
  if (!env('INTASEND_WALLET_ID')) {
    return {
      ok: false,
      reason: 'disbursement_wallet_missing',
      detail: 'IntaSend pays out from a wallet created with can_disburse=true. None is set (INTASEND_WALLET_ID), and a payout attempted without one fails at their API.'
    };
  }
  const msisdn = normalisePhone(phone);
  if (!msisdn) return { ok: false, reason: 'invalid_phone' };
  const whole = Math.round(Number(amount));
  if (!Number.isFinite(whole) || whole <= 0) return { ok: false, reason: 'invalid_amount' };
  const r = await post('/api/v2/transfers/', {
    currency: 'KES',
    wallet_id: env('INTASEND_WALLET_ID'),
    // Approval defaults to ON: a payout that fires from a code path alone, with
    // no second human, is how a bug becomes an irreversible loss.
    requires_approval: requiresApproval ? 'YES' : 'NO',
    transactions: [{
      name: String(name || 'Recipient').slice(0, 80),
      account: msisdn,
      amount: whole,
      narrative: String(narrative ?? remarks ?? 'Brief payout').slice(0, 120)
    }]
  }, fetchImpl);
  if (!r.ok) return { ok: false, reason: r.reason === 'rejected' ? 'transfer_rejected' : r.reason, detail: r.detail ?? null };
  const tracking = r.data?.tracking_id ?? r.data?.transactions?.[0]?.tracking_id ?? null;
  const ref = tracking ? String(tracking) : null;
  // A payout with nothing to track is a FAILURE, not a success with a blank
  // column: an unreconcilable payout is exactly what the ledger exists to avoid.
  if (!ref) return { ok: false, reason: 'no_provider_reference', detail: r.data };
  return { ok: true, provider: PROVIDER, providerRef: ref, awaitingApproval: Boolean(requiresApproval), trackingId: ref, amountKes: whole };
}

export async function approveTransfer(trackingId, { fetchImpl = fetch } = {}) {
  if (!isConfigured()) return { ok: false, reason: 'not_configured' };
  if (!trackingId) return { ok: false, reason: 'missing_reference' };
  return post('/api/v2/transfers/approval/', { tracking_id: String(trackingId) }, fetchImpl);
}

/**
 * The fee Brief would pass on as a "cash-out fee".
 *
 * Returns null on purpose. IntaSend's per-transaction B2C fee is not published
 * in the material reviewed, and a fee printed to a rider before it is known is
 * a number invented about somebody's money. Until the schedule is confirmed,
 * the surface must say "fee not yet published", not "KES 0" and not a guess.
 */
export function payoutFee() {
  return null;
}

/** The caveat, as words. `settlement.disbursementFee()` reads a null fee as
 *  "no fee" and subtracts nothing, so this note is what must sit beside any
 *  payout figure until the schedule is confirmed in writing. */
export function payoutFeeNote() {
  return 'IntaSend has not published a B2C fee schedule in the material reviewed. Brief books this rail as no fee, which is an assumption to confirm before a cash-out fee is ever shown to a member.';
}

/**
 * Map IntaSend's invoice callback onto Brief's payment shape.
 *
 * Only a recognised terminal state is an answer. `Pending`, an unknown word or
 * a payload with no reference is `ok:false`, which makes the route 400 and
 * leaves the intent untouched — a payment is never marked settled because a
 * webhook looked friendly.
 */
const STATE_OK = new Set(['successful', 'success', 'completed', 'paid']);
const STATE_FAIL = new Set(['failed', 'error', 'cancelled', 'canceled', 'timeout', 'expired']);
const STATE_CANCELLED = new Set(['cancelled', 'canceled', 'timeout', 'expired']);

export function parseCallback(body) {
  const inv = body?.invoice ?? body ?? {};
  const ref = inv.invoice_id ?? inv.invoiceId ?? inv.InvoiceID ?? null;
  const stateRaw = inv.state ?? inv.Status ?? inv.status ?? null;
  const state = String(stateRaw ?? '').trim().toLowerCase();
  const amountRaw = inv.amount ?? body?.amount ?? null;
  const amount = amountRaw === null || amountRaw === '' ? null : Math.round(Number(amountRaw));
  if (!ref || !state) return { ok: false, reason: 'unrecognised_payload' };
  if (amount !== null && !Number.isFinite(amount)) return { ok: false, reason: 'unrecognised_payload' };
  const succeeded = STATE_OK.has(state);
  const failed = STATE_FAIL.has(state);
  if (!succeeded && !failed) return { ok: false, reason: 'non_terminal_state', state: stateRaw ?? null };
  return {
    ok: true,
    succeeded,
    cancelled: STATE_CANCELLED.has(state),
    checkoutRequestId: String(ref),
    providerRef: String(ref),
    amount: Number.isFinite(amount) ? amount : null,
    receipt: inv.receipt_number ?? inv.mpesa_receipt_number ?? null,
    failureReason: succeeded ? null : `provider_state:${state}`,
    rawState: stateRaw ?? null
  };
}

export function isPayoutConfigured() {
  return isConfigured() && Boolean(env('INTASEND_WALLET_ID'));
}
