# Tuma + LOOP BIZ Payment Integration — Implementation Report

Replaces the abandoned Safaricom Daraja / M-PESA Express (STK Push) collection
flow with **Tuma** as Brief's payment gateway, settling to the **LOOP BIZ**
business/till configured on the Tuma merchant profile.

---

## 1. Existing Brief payment architecture discovered

- **Stack:** React + TypeScript client (`App.tsx` + `src/components`), Node.js
  + Express server (`server/`), a synchronous JSON document store
  (`server/src/store.js`, collections not tables).
- **Money model:** a single economic layer — `ledgerTransactions` — with no
  wallet/balance column. Payment *intents* (`paymentIntents`) are a record of
  an attempt; the authoritative money event is always a ledger transaction.
- **Collection (customer → merchant):** `connectors/mpesa.js` (Daraja OAuth +
  STK Push), driven by `domain/payment.js` (`createIntent` / `requestPayment`
  / `confirmPayment`), exposed via `POST /api/orders/:id/pay` and
  `POST /api/webhooks/mpesa/:secret`.
- **Disbursement (merchant → customer):** Daraja B2C in the same connector,
  driven by `domain/settlement.js`.
- **Key invariants already enforced:** amount read from the order row (never
  client or callback), one live intent per order, unique provider reference
  (replay-safe), amount re-checked on callback, settlement requires a settled
  ledger row, honest 503/`charged:false` with no provider, no fake-success path.
- **Frontend:** no checkout wired — orders showed "Not paid yet" with no pay
  button. The server pay route existed; no client called it.

## 2. Daraja components removed / deprecated

- `connectors/mpesa.js` — STK Push **collection** (`stkPush`,
  `parseStkCallback`) marked **DEPRECATED**; retained only for reference and
  for unmigrated deployments. The Daraja **B2C payout** is *kept* — Tuma
  documents no disbursement endpoint, so payouts remain on the B2C rail.
- `POST /api/webhooks/mpesa/:secret` — marked **DEPRECATED** (still fails
  closed; no longer reachable from the pay path).
- `activeProvider()` no longer returns `'mpesa'` for collection.
- No PayBill/Till, passkey, shortcode, `PartyA/B`, or Daraja production
  credentials are required or referenced by the collection path anymore.

## 3. Tuma components added

- **`server/src/connectors/tuma.js`** — the isolated Tuma provider:
  - `accessToken()` → `POST {base}/auth/token` with `{email, api_key}`, JWT
    cached until near expiry (reads the JWT's own `exp` when parseable).
  - `stkPush()` → `POST {base}/payment/stk-push` (Bearer token) with
    `{amount, phone, description, callback_url}`.
  - `parseCallback()` → the flat callback bodies Tuma documents (success /
    failed / cancelled), extracting `checkout_request_id`,
    `mpesa_receipt_number`, `amount`, `result_code`, `failure_reason`.
  - `verifyCallbackSecret()` → timing-safe, fail-closed.
  - `normalisePhone()` → `2547XXXXXXXX` Kenyan normalisation.
- **`server/src/providers.js`** — the provider seam. `COLLECTION_PROVIDERS =
  { tuma }`, `DISBURSEMENT_PROVIDERS = { mpesa }`. Adding Paystack/SasaPay/
  Flutterwave = one connector file + one registry line.
- `domain/payment.js`, `domain/ledger.js`, `domain/settlement.js`,
  `index.js`, `ops.js` — all now resolve providers through the registry.
- **`POST /api/webhooks/tuma/:secret`** — the Tuma callback route (validates
  the secret, parses, calls `confirmPayment`, attaches the transaction, emits
  `order_paid`).
- Frontend: `PaymentIntent` type + validators, `payOrder()` and
  `getOrderPayments()` in the API client, and a new
  `components/marketplace/PayOrder.tsx` checkout wired into the Marketplace.

## 4. LOOP BIZ integration point

The LOOP destination is **not configured in Brief at all** — by design. Tuma
settles collected funds to the bank/till on the business profile (the LOOP
BIZ / LOOP business account) the moment the customer authorises the prompt.
Brief owns its transaction state; Tuma owns the rail and the destination. No
LOOP number is exposed to customers, and none is required by the Tuma API.

## 5. API endpoints actually used (the real Tuma contract)

| Purpose | Endpoint |
|---|---|
| Authenticate | `POST https://api.tuma.co.ke/auth/token` |
| Collect (STK Push) | `POST https://api.tuma.co.ke/payment/stk-push` |
| Callback | Tuma POSTs to `<BRIEF_PUBLIC_ORIGIN>/api/webhooks/tuma/<secret>` |

## 6. Authentication mechanism actually used

`POST /auth/token` with `{ email, api_key }` → a JWT in `data.token`, sent as
`Authorization: Bearer <token>` on `/payment/stk-push`. The 403
`IPRS_VERIFICATION_REQUIRED` case is surfaced distinctly (`iprs_verification_required`),
not faked around.

## 7. Webhook / callback implementation

`POST /api/webhooks/tuma/:secret`:
1. Persists the raw callback to `paymentCallbacks` (audit + duplicate detection).
2. Verifies the path secret — **fail-closed** (no secret → 403).
3. Parses the body; unrecognised payload → 400.
4. `confirmPayment` finds the intent by `checkout_request_id`, re-checks the
   amount against the stored intent, refuses replays (unique receipt), and
   creates exactly one settled ledger transaction on success.
5. Attaches the transaction to the order and emits `order_paid` — only when a
   *new* transaction was created (never on a duplicate).

Tuma does not sign callbacks; authenticity is the secret path segment **plus**
server-side re-verification of the reference and amount. This is stated
plainly in the code rather than claiming a signature check that does not exist.

## 8. Database changes

No new collections. `paymentIntents` gained optional fields: `providerMerchantRef`,
`providerPaymentId` (Tuma's `merchant_request_id` / `payment_id`), `confirmedAt`,
`failedAt` (completion time). `paymentCallbacks` already persisted raw webhooks.
`providerRef` remains the unique key for replay protection; Brief's own
transaction id stays in `transactionId` (the two are never conflated).

## 9. Environment variables required (all server-side, placeholders only)

```
TUMA_EMAIL=
TUMA_API_KEY=
TUMA_CALLBACK_SECRET=
# TUMA_BASE_URL=https://api.tuma.co.ke   (optional override)
# BRIEF_PUBLIC_ORIGIN=                   (required to build the callback URL)
```

No real credentials are committed anywhere.

## 10. Tests run and results

| Suite | Result |
|---|---|
| `server/test/run.js` (full, incl. live) | **1263 passed / 0 failed / 1 skipped** |
| `server/test/run.js` (OFFLINE) | **1250 passed / 0 failed / 3 skipped** |
| `tc` strict typecheck | **exit 0** |
| `./run-suites.sh` (23 client suites) | **1105 passed / 0 failed** |
| `npm --workspace=preview run build` | **succeeds** |

New tests cover the full matrix: valid init, invalid/unauthorised transaction,
amount mismatch, Tuma auth failure (401 + IPRS 403), Tuma API failure, pending,
success, failed, cancelled (distinct terminal state), invalid callback,
duplicate callback (idempotent), already-paid, unknown reference, and the
end-to-end state transition (order → intent → authorized → webhook → settled
ledger tx → order reads paid).

## 11. Build result

Production build succeeds (`vite build`, 1536 modules). Typecheck exit 0.

## 12. Still required before live transactions

- **Real Tuma credentials** — `TUMA_EMAIL` + `TUMA_API_KEY` from the merchant
  portal (requires IPRS identity verification on the Tuma side), plus a
  `TUMA_CALLBACK_SECRET` and a public `BRIEF_PUBLIC_ORIGIN`.
- **Callback reachability** — `https://<origin>/api/webhooks/tuma/<secret>`
  must be publicly reachable (Tuma requires an https `callback_url`).
- **LOOP confirmation** — the LOOP BIZ business/till must be the configured
  settlement account on the Tuma business profile (Tuma-side, not Brief-side).
- **End-to-end live test** — a real STK push against a real M-Pesa number,
  because Tuma publishes no sandbox host.

**Not claimed production-ready** until the actual credentials, callback
configuration and deployment environment have been verified against a live
Tuma account.
