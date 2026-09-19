# Getting money moving without a company registration — what is verified, what is not

Written 2026-09-19. Sources are the providers' own pages, read today, and each
claim below says who said it. Anything I could not confirm is listed as
unconfirmed rather than smoothed into a recommendation.

## The four rails, checked

| Rail | Collect | Disburse (pay riders) | What it costs to be unregistered | Source |
|---|---|---|---|---|
| **IntaSend** | Yes — M-Pesa STK push, checkout links, cards | Documented as a product (M-Pesa B2C, bank transfer, bulk CSV, API for "supplier payments, salaries, refunds, commissions") | Their signup page: choose business type **“Unregistered”**, supply national ID + passport + a verification call. Their FAQ: “No company registration is required for getting a payment gateway account.” | intasend.com — `payments/payment-gateway-without-company-registration`, `payments/merchant-payment-solutions-for-businesses-in-kenya`, `business-payments/` FAQ |
| **Paystack Starter** | Yes | **No.** “Only Registered Businesses can use the Transfers feature” — stated on the Kenya transfers announcement | Kenya Starter lifetime collection ceiling is **KES 600,000** on Paystack's current docs (their older pages show KES 250,000; a widely-quoted third-party post shows KES 80,000). Requirements: government ID + a **personal** bank or mobile-money account | support.paystack.com `business-types`, `Getting your money`, `Transfers`; paystack.com/blog `transfers-in-ke` |
| **Flutterwave** | Yes | Yes, once verified | **KRA PIN is required even when unregistered.** Their own onboarding page lists, for “Unregistered Businesses”: business profile + **“KRA PIN and certificate”**. Sole-proprietorship asks for an “Individual Pin Certificate of the Business”. So a *personal* PIN may satisfy it as a sole proprietor — but that is a question for their review team, not a documented “yes” | developer.flutterwave.com `/docs/kenya`; flutterwave.com onboarding-requirements |
| **Pochi la Biashara** | Yes, manually, minutes on `*334#`, no documents | No API at all for third parties | Nothing to integrate. Reconcile and pay out by hand | Safaricom product; no developer surface exists |

### Two corrections to the brief I was given

1. **Paystack's Kenya Starter ceiling is not KES 80,000.** Paystack's current
   docs say **KES 600,000** lifetime collections for a Kenya Starter Business
   (KES 250,000 in a 2024 revision of the same page). The 80k figure is a
   South-African number that appears in third-party writeups. The difference is
   not academic: at 80k the rail is a demo; at 600k it is a launch ceiling worth
   building against.
2. **Paystack's “no transfers” is right, and it also prices the thing you would
   need later:** for a Registered Business in Kenya, transfers to M-Pesa wallets
   cost KES 40 (≤1,500), KES 80 (1,501–10,000), KES 140 (10,001–40,000), min
   KES 1, max KES 150,000 per transfer. That is the number a rider's “cash-out
   fee” would have to be stated against — and a fee that small on a KES 300 job
   is 13–27% of the job, which is why per-payout fees need to be batched, not
   passed through one at a time.

### What remains genuinely unconfirmed about IntaSend, and it is the part that matters

* Their pages sell collection to unregistered accounts in plain words. **They do
  not say, anywhere I could read, that an *unregistered* account may open the
  disbursement/B2C path.** Their own KYC FAQ says required documents “range from
  business registration to KRA Tax Certificates” *depending on account type*.
  A payout also needs a wallet created with `can_disburse = true`. Ask this in
  the onboarding call and get it in writing before Brief promises a rider a
  same-day cash-out.
* Their per-transaction fees were not published in the material reviewed. So
  `payoutFee()` in the connector returns **`null`** — “unknown” — and Brief books
  the rail as *no fee* with a written caveat (`payoutFeeNote()`), rather than
  printing a number or silently treating it as free.
* “Approved within 24 hours” is their marketing claim on a page dated 2022 (the
  collection page is current; the 24-hour line is not dated recently). Treat it
  as a same-week task, not a today.

## What changed in the code today

* **Tuma is deleted, not deprecated.** Its documented prerequisite is an
  active Kenyan bank account or a Lipa na M-Pesa paybill/till — the exact thing
  Brief does not have. Keeping it in the registry as “supported” was a promise
  the deployment could not keep, which is the category of thing this product
  bans.
* **IntaSend now sits behind the same provider seam** (`server/src/providers.js`
  → `connectors/intasend.js`): `collect()` (STK push), `paymentStatus()`,
  `disburse()` + `approveTransfer()` (B2C, **approval required by default**),
  `parseCallback()`, `verifyCallbackSecret()`. `payment.js`, `workPayment.js`,
  `settlement.js` and `lipaMdogo.js` were already provider-neutral through
  `collectionProvider()/disbursementProvider()`; the last coupling — four
  domains importing `normalisePhone` **from the payment connector** — is gone,
  it lives in `connectors/phone.js` now, because a Kenyan MSISDN rule is a fact
  about Kenya and not about whoever holds the money this month.
* **`/api/webhooks/tuma/:secret` → `/api/webhooks/intasend/:secret`**, and the
  route now calls the seam (`providers.verifyCallbackSecret`, `providers.parseCallback`)
  instead of a named vendor, so a future rail does not need a new route.
* **Callbacks fail closed, twice over.** No webhook secret configured → every
  callback is 403. A non-terminal state (`Pending`) is 400, not a payment. Only
  `Successful` settles anything, and only when the reference is one Brief issued
  with a matching amount. A mismatch against an already-settled intent reads as
  a duplicate and books nothing — asserted in `test/run.js`.
* **No status surface may say “working”.** `status()` carries
  `wireContract: 'documented_not_exercised'`: the endpoints come from IntaSend's
  docs and official SDKs, and **no call has ever been made from this deployment**.
  The word “configured” here means *credentials exist*, and the string says so.
* Tests: `test/run.js` gained an IntaSend connector block (credential state, phone
  rules, the collection round-trip against a stub, no-hidden-token-exchange,
  rejection paths, payout-wallet and approval rules, callback states) and
  `workPayment.mjs` / `lipaMdogo.mjs` now stub the same contract. Main run:
  **2,089 passed / 0 failed**.

## The gap that is not a payment-rail gap

`outbound.status()` reports **both** `sms` and `whatsapp` as unconfigured, and
`workPayment.activeProvider()` is null until IntaSend credentials exist. So the
thing Brief cannot do today is not “take money” — a KSH 500 order can be recorded
and reconciled by hand — it is **“notify a rider that work exists, and put money
in their hand without a human in the loop.” Consequences worth naming:

* The rider board and the guardian credit stay **pull-based**: a person opens the
  app and sees real rows. That is honest, and it is also why “no push” is a
  product limit, not a detail.
* Manual is a real design, not a placeholder: `referrals.requestConversion`
  already creates a pending ledger row, a human pays M-Pesa (or Pochi), and
  `respondConversion` confirms or refuses **with a reason that must be at least
  four words**, and the member is notified either way. That loop works with zero
  rails and is the loop to run for the first hundred payouts.
* Any fee passed on to a member must be printed **where they earn**, before they
  accept the job. “KES 340 for the trip” plus “KES 80 to send it to you” is a
  different offer from “KES 340”, and a rider discovering that at payout is how a
  marketplace loses its supply.

## Telegram and WhatsApp: what I did not do, and why

**Telegram is not deleted, but it is killable today without a code change.** It
is a registry feature (`features.js` → `key: 'telegram'`), so
`BRIEF_DISABLED_FEATURES=telegram` turns the routes off at the edge with one env
var — no risk, no diff. A real deletion is bigger than it looks and should be
its own pass: 47 files reference it, 12 server suites assert on it, and
`GET /api/media/telegram/:fileId` is the byte proxy that renders **images on
already-published feed cards** — the same public pages `PUBLIC-FACE.md` covers.
Deleting the connector is right; deleting that proxy takes existing content's
pictures with it. The clean cut is: remove inbound ingest, the mini-app init,
`/api/connectors/telegram/*` and the ingestion desk UI; keep the media proxy as a
read-only sunset path; then drop it once no live row references it. Say the word
and I'll do that pass.

**WhatsApp stays, and it is not “for notifications only” in this codebase yet —
because it is not for anything yet.** `whatsapp.isConfigured()` is false in
production, so both directions are dark. The inbound path
(`/api/spaces/:id/whatsapp/inbound`) is what turns a customer's reply into a
space conversation and, on a price quote, into an order — that is the shop's
inbox, not a chat gimmick, so I would not spend it for a notification channel.
The outbound rail is the one worth wiring first (job alerts, order updates),
and it needs Meta credentials before any surface may say “riders will be
notified”.

## The order I would actually run

1. IntaSend account as *Unregistered*, and in the same call ask, in writing: B2C
   access for that account type, the fee per payout, and the sandbox host.
2. Sandbox keys in the deployment behind a feature flag; one real STK push and
   one real B2C to a staff number. Only after that round-trip does any user-facing
   text get to say payments work.
3. Payouts stay manual + finance-confirmed until volume justifies more.
4. Sole-proprietor registration (e.g. via eCitizen) in parallel — it unlocks
   Daraja directly later, which is cheaper than any aggregator.
5. Batch payouts (one B2C file per day per rider pool) before any per-job fee is
   shown to a member, so the fee is small enough to state honestly.
