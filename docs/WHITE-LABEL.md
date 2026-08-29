# White-Label Rail Decision — Brief

Date: 2026-08-29. Question: which free-entry, pay-as-you-grow white-label and
infrastructure services does Brief adopt to quicken the journey without
violating its own rules (honest refusal, no fake success, credentials via env
only, the ledger as the single economic truth)?

## The decision

| Layer | Choice | Why this one | Cost today |
|---|---|---|---|
| Collections (M-Pesa + cards) | **Paystack** (chosen primary), Tuma kept as gateway/alternate | Live for ALL merchants in Kenya since Aug 2023 with a Central Bank of Kenya PSP authorisation; collects over M-PESA and cards; settles in KES; no setup or monthly fee — per-transaction pricing only; free sandbox (test keys). Split payments exist for the platform cut, deliberately NOT wired yet (see below) | **0 KES/mo** until real money moves |
| KYC / verification assist | **Smile ID** | Nairobi-built; Kenyan national ID / passport / alien-card lookups against official registers; free developer sandbox; pay-per-check in production. It ASSISTS the human reviewer — it never auto-approves, and it never stores the ID number (DPA minimisation) | **0 KES/mo** in sandbox |
| Ledger & wallets | **Brief's own `ledgerTransactions`** (unchanged) | Already self-hosted, double-entry-disciplined, the sole economic truth, tested by 1900+ assertions. A hosted/FaaS ledger would add a monthly cost and split the truth in two | **0** |
| Vouchers / gift cards / airtime (Reloadly et al.) | **Deferred — deliberately** | Real and free-to-integrate, but Brief has no voucher surface in the product spec. The repo's own audit (F5) removed orphan server-only features; nothing gets a connector until a real surface needs it | **0** |
| Hosting | Not a code decision | Any Node host + disk works (the store is atomic-write JSON with rotating backups). Pick by ops need, not by vendor lock-in | from ~KES 300–600/mo VPS class |

Flutterwave remains an equally viable KE alternate (same free-entry shape) and
would be a second connector in `COLLECTION_PROVIDERS` if ever needed; Korapay
is Nigeria-centric — excluded. No percentage-of-anything is claimed about any
provider's pricing beyond "you pay per transaction when live" — exact rates
are on the provider's own pricing page.

## What was wired (this batch)

* `server/src/connectors/paystack.js` — collections connector behind the
  existing provider seam (`providers.js` names it as the designed next rail):
  `transaction/initialize` hosted checkout (whole-KES → subunits on the wire,
  KES only), `parseCallback` with subunits→whole-KES conversion that passes
  non-integral amounts through so the intent's amount re-check fails LOUDLY,
  non-KES payments never parse as success, and a timing-safe **hex HMAC-SHA512
  webhook signature** verification over the raw body (`x-paystack-signature`).
* `server/src/routes/commerce.js` — `POST /api/webhooks/paystack`, persisted
  before processing like every callback, applying the SAME money rules as the
  Tuma route: reference must match an issued intent, amount must match,
  replays are idempotent no-ops, one ledger row ever.
* `server/src/connectors/smileid.js` + the verification route assist — a
  configured Smile ID runs an ID/phone lookup at submission and attaches ONLY
  the provider's outcome codes to the record for the reviewer. No documents,
  no stored ID numbers, no auto-approval; the decision stays on the audited
  route. `/api/capabilities` exposes the KYC rail's honest status; the
  operator desk (Attention → verification queue) renders the provider
  evidence marked "evidence, not a verdict".
* `providers.js` — registry now `{ tuma, paystack }` with an explicit
  `BRIEF_COLLECTION_PROVIDER` override that must name a CONFIGURED provider
  or is ignored. The `/pay` route now also returns `authorizationUrl` for
  hosted-checkout providers (additive; STK providers send null).

## Environment (all optional; absent = today's honest refusal)

    # Collections (Paystack) — sk_test_... is the free sandbox
    PAYSTACK_SECRET_KEY=
    PAYSTACK_BASE_URL=            # optional override
    BRIEF_COLLECTION_PROVIDER=    # 'tuma' | 'paystack' (must be configured)

    # KYC assist (Smile ID) — sandbox is free
    SMILE_PARTNER_ID=
    SMILE_API_KEY=
    SMILE_ENV=                    # 'sandbox' (default) | 'production'

Nothing else changes. With no keys set, every surface behaves exactly as
before: payments answer 503 `charged:false` with the missing credentials
named, verification is manual review, and no provider is implied.

## Deliberately NOT done (and why)

* **No split-payment/subaccount wiring.** Paystack can take the platform cut
  at collection time, but Brief's commission rule is settled-ledger-first:
  attach, settle on a genuinely settled ledger row, then pay out from derived
  earnings. Routing money around the ledger would create a second economic
  truth — the exact thing §16 forbids.
* **No payouts registered.** `DISBURSEMENT_PROVIDERS` stays empty until a
  payout rail is chosen deliberately (Paystack transfers are a candidate).
* **No Reloadly connector.** No voucher surface exists; connectors without
  callers are how F5 happened.

## Verification

`run.js` **1914/0/1**: signature constructions verified against independently
computed HMACs, fail-closed behaviour, whole-KES/subunit conversion, non-KES
refusal, ignored-event acknowledgement, registry override semantics, request
shapes against a stubbed wire, the Smile ID header-auth invariant, the
stored-assist-never-carries-the-ID-number invariant, and a signed
`charge.success` walked end to end over HTTP through the same ledger rules as
Tuma (confirm + exactly one settled row + replay no-op).
