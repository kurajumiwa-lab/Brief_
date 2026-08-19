# Brief Payment Provider Migration — Migration Report

**Remove Safaricom Daraja / M-PESA Express entirely; make Tuma the sole
collection provider, settling to the LOOP BIZ business/till.**

---

## 1. Files changed

| File | Change |
|---|---|
| `server/src/providers.js` | Rewritten: `COLLECTION_PROVIDERS = { tuma }`, `DISBURSEMENT_PROVIDERS = {}` (empty — no payout rail). Provider seam is the only place providers are registered. |
| `server/src/connectors/tuma.js` | Tuma provider: method renamed `stkPush` → `collect`; env var `TUMA_CALLBACK_SECRET` → `TUMA_WEBHOOK_SECRET`; Daraja references in comments removed. |
| `server/src/domain/payment.js` | Calls `provider.collect()`; Daraja comment removed. |
| `server/src/domain/settlement.js` | `sendPayout` no longer calls a Daraja B2C method — it now refuses honestly (`payout_not_configured`) until a provider is registered in `DISBURSEMENT_PROVIDERS`. |
| `server/src/domain/ledger.js` | (already provider-neutral) comment updated. |
| `server/src/index.js` | Removed `import mpesa` and the entire `POST /api/webhooks/mpesa/:secret` route. Tuma webhook comment updated. |
| `server/src/ops.js` | Startup diagnostic now checks `TUMA_WEBHOOK_SECRET`. |
| `server/test/run.js` | Removed the Daraja connector test block; the HTTP-surface + payout tests now exercise Tuma and the provider seam (a test-only disbursement provider proves the registry works). |
| `live/4-full-chain.mjs` | Webhook smoke test now hits `/api/webhooks/tuma`. |
| `src/api/{types,validate,briefApi}.ts`, `src/components/marketplace/PayOrder.tsx`, `src/components/Marketplace.tsx` | Payment type/validators/client + checkout (already added last pass); checkout made provider-neutral (removed "via Tuma" badge). |
| `server/.env.example`, `server/CONNECTORS.md`, `BRIEF-COVERAGE-MATRIX.md`, `BRIEF-FINAL-REPORT.md`, `TUMA-INTEGRATION-REPORT.md` | Docs aligned with Tuma; Daraja mentions replaced/removed. |

## 2. Files deleted

- **`server/src/connectors/mpesa.js`** — the entire Safaricom Daraja connector
  (OAuth token, STK Push `processrequest`, `parseStkCallback`,
  `verifyCallbackSecret`, B2C payout). No other file references it.

## 3. Daraja references removed

- Daraja OAuth (`oauth/v1/generate`), STK Push (`/mpesa/stkpush/v1/processrequest`),
  `BusinessShortCode`, `CustomerPayBillOnline`, `PartyA`/`PartyB`, `Passkey`,
  `ConsumerKey`/`ConsumerSecret`, `InitiatorName`/`SecurityCredential`,
  `sandbox.safaricom.co.ke` / `api.safaricom.co.ke`, `MpesaReceiptNumber`
  parsing, and `MPESA_*` environment variables — all gone from runtime code.
- **No Daraja npm package** existed (only `express`); nothing to remove there.

## 4. Tuma integration points

- `POST https://api.tuma.co.ke/auth/token` — JWT auth (`email` + `api_key`).
- `POST https://api.tuma.co.ke/payment/stk-push` — collection (`collect()`).
- `POST <origin>/api/webhooks/tuma/<secret>` — verified, idempotent webhook.
- Provider seam (`providers.js`) isolates Tuma; domain code calls
  `createIntent` / `requestPayment` / `confirmPayment` / `getIntent` —
  never Tuma's endpoints directly.

## 5. Environment variables required

```
TUMA_EMAIL=
TUMA_API_KEY=
TUMA_WEBHOOK_SECRET=
# TUMA_BASE_URL=https://api.tuma.co.ke   (optional override)
# BRIEF_PUBLIC_ORIGIN=                   (required to build the webhook URL)
```

All server-side. No credentials in source, tests, or the client bundle.

## 6. Database changes

None. `paymentIntents` already carried provider-neutral fields (`provider`,
`providerRef`, `amount`, `currency`, `status`, timestamps). Historical records
retain their stored `provider` value (e.g. `"mpesa"` / `"daraja"`) and remain
readable; **new** intents are written with `provider: "tuma"`. No ownership
rewrite, no destructive migration.

## 7. Tests performed

| Check | Result |
|---|---|
| `server/test/run.js` (full, incl. live 3rd-party) | **1247 passed / 0 failed / 1 skipped** |
| `server/test/run.js` (OFFLINE) | **1234 passed / 0 failed / 3 skipped** |
| Client suites (`./run-suites.sh`, 23 suites) | **1105 passed / 0 failed** |
| Strict typecheck (`tc`) | **exit 0** |
| Production build (`vite build`) | **succeeds** |

Covered: payment creation, initiation, pending/success/failed/cancelled,
webhook reception, duplicate webhook (idempotent), invalid webhook, invalid
amount, transaction lookup, and the existing order/marketplace/settlement
flows. A post-migration repo-wide sweep found **zero active Daraja/Safaricom-API
references** — the only remaining "Safaricom" strings are reward-catalog brand
names (airtime/data/gift cards) and "M-Pesa" the customer-facing payment label,
neither of which is the Daraja API.

## 8. Remaining manual configuration

1. Set `TUMA_EMAIL` + `TUMA_API_KEY` (from the Tuma merchant/developer portal;
   requires IPRS identity verification) and `TUMA_WEBHOOK_SECRET`.
2. Configure a public `BRIEF_PUBLIC_ORIGIN` so Tuma can reach
   `https://<origin>/api/webhooks/tuma/<secret>` (must be https + reachable).
3. Confirm the LOOP BIZ business/till is the settlement account on the Tuma
   business profile (Tuma-side, not Brief-side).

## 9. Blockers

- **No live Tuma request/webhook has been executed yet** — Tuma publishes no
  sandbox, so this requires the real credentials above. The integration is
  therefore **not claimed live-ready** until a real STK push + callback round
  trip succeeds.
- Merchant payouts remain **unavailable** (no disbursement provider): Tuma
  documents no payout endpoint, and Daraja B2C was removed. Registering a
  provider in `DISBURSEMENT_PROVIDERS` re-enables them.
