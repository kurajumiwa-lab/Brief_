# Payments: KCB Buni is the rail — what's wired, what's gated, what you must do

Updated 2026-09-19. Buni is now the only payment rail in Brief. IntaSend, Tuma,
Paystack and Flutterwave are gone (reasons at the bottom). Pochi la Biashara
survives — not as a connector, because it has no third-party API, but as the
manual path Brief already implements and reconciles.

## First, the credential thing, because it will bite you otherwise

You wrote *"here is my buni access token … I don't understand its purpose"*. Two
answers:

1. **Nothing arrived.** Your message contained no token. I did not silently
   receive a secret, and I did not add one anywhere.
2. **An access token is the wrong thing to hand a server anyway.** Buni is
   WSO2-style: you hold a **Consumer Key** and a **Consumer Secret**, and you mint
   a short-lived **access token** from them (`POST /token`, typically
   `expires_in: 3600`). The token is a receipt, not a credential. Brief mints its
   own, caches it for its lifetime, and re-mints on expiry — a test pins that a
   rejected token request stops before any push is sent.

So: **give the deployment the key and the secret, never the access token.** And
treat anything pasted into a chat window (or an email, or a screenshot) as
published — if what you have is live, rotate it in the KCB portal before go-live.
Repo rule, unchanged: secrets live in the server's environment and nowhere else;
nothing in this repository may contain a credential, and `.gitignore` keeps
`.env.local` out.

## What is wired (and honestly labelled)

`server/src/connectors/buni.js`, behind the provider seam in
`server/src/providers.js`:

| Operation | Endpoint | Status here |
|---|---|---|
| Token | `POST {base}/token?grant_type=client_credentials`, HTTP Basic `key:secret` | implemented, cached, re-minted on expiry |
| Collect (M-Pesa STK push) | `POST {base}/mm/api/request/1.0.0/stkpush` | implemented; response unwrapped from `Body.stkPushResponseCode`; **refuses** if no `CheckoutRequestID` comes back |
| Callback | `POST /api/webhooks/buni/:secret` → parses `Body.stkCallback` | implemented; **KCB's relayed callback is unsigned**, so the secret segment only stops drive-by POSTs — the authority is "reference Brief issued + amount matches the intent" |
| Status query | `GET {base}/kcb/transaction/query/1.0.0/api/v1/payment/query/{id}` | implemented best-effort; a non-OK answer surfaces as `query_unavailable`, never as a guess |
| Payout (transfer to phone) | `POST {base}/fundstransfer/1.0.0/api/v1/transfer` | **deliberately refused.** The endpoint is in KCB's catalogue; the request body for a payout to an MSISDN is not published in anything I could read. `disburse()` returns `transfer_contract_unverified` |

Three refusals are the point of this file, not its weakness:

* **The production host is not published by KCB.** Sandbox is
  `https://uat.buni.kcbgroup.com` (KCB's own portal). Production is reported by
  third parties as `https://api.buni.kcbgroup.com`, from probing the gateway.
  With `BUNI_ENV=production` and no `BUNI_BASE_URL`, the connector returns **no
  base URL** and a token request fails with `production_host_unacked`. A guessed
  host on a money call is not acceptable; you either set the host explicitly or
  acknowledge the reported one with `BUNI_PROD_HOST_ACK=1`.
* **No invented payout.** Moving money out with a guessed payload is how a
  transfer lands in the wrong account. There is an explicit, ugly opt-in switch
  (`BUNI_ALLOW_UNVERIFIED_TRANSFERS=1`) and even with it on, this build has no
  body to send, so it still refuses. Get KCB's transfer spec and it becomes one
  function.
* **No invented fee.** `payoutFee()` returns `null` — KCB has not published a
  B2C/transfer fee schedule in the material reviewed — and `payoutFeeNote()`
  carries that as words. Brief therefore books no fee, visibly, rather than
  printing "KES 0" or a guess where a rider would see it.

Every status read carries `wireContract: 'documented_not_exercised'`. **No call
has been made from this deployment.** "Configured" means credentials exist; it
does not mean payments work, and no surface is allowed to imply otherwise.

## What you do, in order

**A. Sandbox first (today, ~30 min).**
1. `developer.kcbgroup.com` → your app → copy the **Consumer Key** and **Consumer
   Secret**. Do not copy an access token.
2. In Railway (the new account's service) → Variables:
   ```
   BUNI_CONSUMER_KEY=…          BUNI_CONSUMER_SECRET=…
   BUNI_ENV=uat                 # sandbox; the default if unset
   BUNI_WEBHOOK_SECRET=<a long random string you generate>
   BRIEF_PUBLIC_ORIGIN=https://<your-new-railway-host>
   BUNI_ORG_SHORT_CODE=522522   # KCB's sandbox shared short code
   BUNI_TILL_NO=<your sandbox account/till ref, if KCB gave you one>
   ```
   `BRIEF_PUBLIC_ORIGIN` is required because KCB demands an **HTTPS** callback
   URL, and it is also what makes the public-space pages and canonical links
   correct. Note it feeds *both* — don't split it.
3. Redeploy. Then confirm the honest state: `GET /api/capabilities` →
   `payments.configured` becomes true, `payments.detail.wireContract` still says
   `documented_not_exercised`, and `enablement.disbursement` is false with the
   note attached.
4. One real test push against your own number for **KES 1**, watch the intent go
   `authorized`, then the callback arrive. `/api/media/…`-style audit rows:
   every callback — accepted or rejected — is stored in `paymentCallbacks` so a
   mismatch is reconstructible after the fact.

**B. Go live (days, not months).** KCB's documented process is a **signed request
letter to buni@kcbgroup.com** after they review the sandbox implementation. What
entity documents KCB wants on *your* account is not published in the material I
could read, so treat it as a question in that email rather than an assumption —
the widely-repeated "banks need your registration certificate" line is true of
some rails and unverified for this one, and I will not put an unverified
eligibility claim in your go-live plan. Ask them, in the
same email, for: (i) the **production base URL in writing**, (ii) the
**transfer/B2C request specification** and whether your account type may use it,
(iii) the **fee per payout**, (iv) whether **signed IPN** can be enabled for you
(it's a separate KCB product; if enabled, it becomes the authoritative payment
feed and the unsigned relay becomes a convenience).

**C. Only then:** set `BUNI_ENV=production` plus `BUNI_BASE_URL=<the host they
confirmed>`, swap the credentials, re-run the KES 1 test.

**D. The payout loop, today.** Do not wait on B2C. A rider/guardian conversion
already creates a **pending ledger row**; a person pays from the KCB/Pochi
balance; finance confirms or refuses **with a reason of at least four words**;
the member is notified either way. That loop is complete and auditable with zero
API. When (iii) above lands, add `disburse()` and the ledger row gains a provider
reference — nothing else changes.

**E. Website/domain.** Order of operations that avoids breakage:
1. Buy the domain wherever you like; no DNS records that point anywhere yet.
2. Railway → your service → Settings → **Custom Domain** → add `brief.<yourdomain>`
   or the apex. Railway provisions TLS itself; that satisfies KCB's HTTPS-callback
   requirement, which a `*.up.railway.app` host also satisfies today.
3. Change **only** `BRIEF_PUBLIC_ORIGIN` to the new origin and redeploy. That single
   variable moves the callback URL, canonical links and `og:url`; the `/s/<slug>`
   public pages follow it. `GET /sitemap-spaces.xml` stops answering 503 the moment
   the origin is declared.
4. Then, and only then, publish the domain on stickers/WhatsApp bios.

## Two things you should know are still open

* **Production is currently unreachable** — the old host answers
  `404 "Application not found"` from Railway's edge on every path including
  `/api/health`, across four pushes. That is consistent with your new
  account/deployment: the old service is gone or stopped, and I have no token for
  the new one. **Send me the new Railway URL** (or a token + service id) and I'll
  verify the deploy the way I did before: bundle-hash change **and** uptime reset,
  plus string greps in the served JS/CSS. Nothing here is untested — I booted the
  exact commit locally with the production start command and the API answered
  correctly — it is just unverified *in the place it runs*.
* **The GitHub token is still live and has been pasted into this chat several
  times.** Rotate it. It grants write access to the repo your payments code will
  soon talk to a bank about.

## Rails considered and rejected (so nobody re-litigates them)

| Rail | Why not |
|---|---|
| Safaricom Daraja direct | Cheapest per transaction, but needs a registered paybill/till + B2C activation. It is the right destination *after* registration; today it is a form you cannot submit. |
| Tuma | Its own prerequisite is an active Kenyan bank account or a Lipa na M-Pesa paybill/till. Kept in the registry it would read as "supported" — a promise the deployment cannot keep. Deleted. |
| IntaSend | A full connector was written, wired behind the seam, tested — and then **deleted unused**, because Buni is your choice and one rail per direction is what keeps the domains honest (one fee schedule, one callback shape, one failure mode). Their pages claim no company registration is needed for a gateway account; their payout tier for unregistered accounts is undocumented. History, not code. |
| Paystack Starter | Collect-only. Transfers are Registered-Business-only on their own docs. Their **Kenya** Starter ceiling is **KES 600,000** lifetime on current docs (not the KES 80,000 that circulates in third-party writeups — that figure is South Africa's; Paystack's own 2024 page said 250,000). Rejected as primary. |
| Flutterwave | Their Kenya onboarding requires, even for an *unregistered* business, a **KRA PIN and certificate**. Not "maybe" — documented. |
| Pochi la Biashara | No third-party API exists. Kept as the manual practice: money by hand, ledger row confirmed by a human. |

## Where the verification numbers are

Server: main run **2,100 passed / 0 failed / 1 skipped**, plus the full chained
suite set (exit 0, every summary `FAILED 0`) — including a Buni connector block
(token caching, no-call-on-unacked-host, amount-as-string, till-prefixed
`invoiceNumber`, `sharedShortCode`, unsigned-callback states, the payout and fee
refusals, secret never leaked in any status read) and an end-to-end order →
push → callback → replay → mismatch → cancellation block. Client: **2,070 / 0**.
`tsc` clean, `vite build` clean.
