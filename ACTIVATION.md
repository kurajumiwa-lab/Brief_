# Brief — Real-World Activation Runbook

> The economic engine is built and tested. The railway exists. This is how to
> put a train on it.

This is the single checklist for turning Brief from a test-backed product core
into a live, money-moving, city-companion platform. Everything on this list
requires **credentials or infrastructure that only you can supply** — the code
is already written, tested, and merged to `main`.

Reading order: the four doors are roughly in dependency order, but each is
independent and can be done in any sequence.

---

## Door 0 — Deploy & make data durable (do this first)

**Why:** Brief runs on Railway with an ephemeral filesystem. Until a volume is
attached, every redeploy wipes the store (which is why the discovery surface
reset to empty after fresh deploys).

**Steps**
1. Railway → your service → **Volumes** → add a volume (e.g. `brief-data`),
   mount path `/data`.
2. Set the environment variable `BRIEF_DATA_DIR=/data`.
3. Redeploy. The store and its `backups/` snapshots now survive redeploys.

**Already built in code (defense in depth):**
- Rolling snapshots (`BRIEF_BACKUP_INTERVAL_MS`, default 15 min, kept 14).
- Boot restore — if the data file is missing but a snapshot exists, it comes back.
- Graceful-shutdown backup.
- Corrupt-file recovery (moved aside, never fatal).

**Verify:** `GET /api/ready` returns 200; redeploy twice and confirm records persist.

**Demo content (optional, for seeing the product behave before real ingestion):**
```
npm run seed          # realistic Nairobi demo content, through the real pipeline
npm run seed:clear    # remove exactly that content (it's tagged seedBatch)
npm run smoke:seeded  # trace the HTTP journey end-to-end
```

---

## Door 1 — Payments: connect the real rail (💰)

**Goal:** `payments.configured` flips to `true`, and a real
`order → payment intent → Tuma → webhook → ledger → settlement` completes.

**Why it's not done:** Tuma publishes no sandbox, and no credentials are mounted.
The payment code is fully written and idempotency/amount/verification-tested;
it stops honestly at `503 / provider_unavailable` until configured.

**Steps**
1. Tuma merchant portal → **Developer → Generate API Key** (requires IPRS
   identity verification).
2. Set server-side env vars (never in the client bundle):
   ```
   TUMA_EMAIL=           # the business email used for /auth/token
   TUMA_API_KEY=         # the api_key from the portal
   TUMA_WEBHOOK_SECRET=  # a secret you invent: openssl rand -hex 24
   BRIEF_PUBLIC_ORIGIN=  # e.g. https://brief.example.com (no trailing slash)
   ```
3. Confirm the **LOOP BIZ / LOOP business** account is the settlement
   destination on the Tuma profile. Brief never needs or sees the LOOP number.
4. First real round-trip: place a real order, pay via the STK push, and watch
   `/api/orders/:id/payments` transition to `confirmed` and the ledger settle.

**The contract Brief already implements:**
- `POST https://api.tuma.co.ke/auth/token` → JWT
- `POST https://api.tuma.co.ke/payment/stk-push` → STK push
- Tuma POSTs the result to `{BRIEF_PUBLIC_ORIGIN}/api/webhooks/tuma/{TUMA_WEBHOOK_SECRET}`

**Verify:** `GET /api/capabilities` → `payments.configured: true`.

**Payouts / disbursement:** deliberately `DISBURSEMENT_PROVIDERS = {}`. Tuma
documents no payout endpoint, and no other rail is selected. A payout request
returns an honest `503 / provider_unavailable`. Re-enable by registering a
disbursement provider in `server/src/providers.js` — do **not** invent one.

---

## Door 2 — Telegram: connect a real bot (🔌)

**Why it matters:** Telegram is the one connector already proven at the HTTP
layer. It's the cheapest first live channel.

**Steps**
1. Create a bot with @BotFather → copy the token.
2. Set `TELEGRAM_BOT_TOKEN=<token>` (and optionally `TELEGRAM_WEBHOOK_SECRET`,
   which the server can also generate at webhook-config time).
3. Choose webhook or pull mode:
   - **Webhook:** `POST /api/connectors/telegram/webhook-config` with
     `{ "url": "https://<origin>/api/webhooks/telegram" }`.
   - **Pull (no public URL):** `POST /api/connectors/telegram/sync`.

**What happens after:** inbound messages → raw items → extract → canonical
objects → provenance. The connector dashboard reflects real state ("Needs
authorization" → "connected").

**Known limit (not fixable):** a bot cannot backfill group history — it sees
only messages sent *after* it joins.

**Verify:** send a message in a group the bot is in; it appears as a raw item,
then an object (with provenance) in the pipeline.

---

## Door 3 — WhatsApp: finish the connector (🔌)

**Steps**
1. Meta App Dashboard → app secret → `WHATSAPP_APP_SECRET`.
2. Invent a verify token → `WHATSAPP_VERIFY_TOKEN`.
3. Set the webhook in Meta to `https://<origin>/api/webhooks/whatsapp`.

**What works:** inbound DMs, signature-verified (`X-Hub-Signature-256`),
normalized into the same object/campaign architecture.

**Known limit (correctly refused):** group ingestion is impossible via the Cloud
API — Brief returns "unsupported" rather than faking it.

**Verify:** the Meta handshake succeeds (`GET /api/webhooks/whatsapp` with the
verify token), then a DM produces a raw item.

---

## Door 4 — Distribution: turn links into surfaces (🏙️)

**No new backend needed.** The campaign/public-link machinery is live. This door
is about *using* it at real scale:

- **events / popups / drops / services / auctions / local offers** are all
  campaign types or listings that already produce a public page at
  `{BRIEF_PUBLIC_ORIGIN}/c/{slug}` with Open Graph previews.
- Every object is shareable: the public page renders WhatsApp/Telegram/copy
  actions, and `/c/:slug` returns real `og:*` meta so link previews show the
  gathering, not a blank shell.

**The activation move:** when a real host creates a gathering, send that link
through their existing channels. The distribution engine *is* the link.

**Verify:** `GET /c/<slug>` shows `og:title`, and the page shows the social
proof ("N people registered") and a working register/ticket flow.

---

## What is *deliberately* not opened yet (do not rush these)

| Surface | Status | Why |
|---|---|---|
| Arena real-money contests | 🔴 hard server-side compliance gate | No licence/KYC/payment rail; the boundary is working as designed |
| Fantasy paid entry | 🔴 same gate | Non-economic core works |
| Payouts | 🟡 architecture complete, no provider | No disbursement rail selected |
| Push notifications | 🟡 in-app inbox real, push not connected | Needs FCM/APNs |
| Postgres | 🟡 JSON store fine at this scale | Swap is a contained change (store seam exists); needs a provider |
| Maps / media / email | 🔴 not connected | No connector; nothing faked |

---

## The quickest path to "a real person can use this today"

1. Door 0 (volume) — so data survives.
2. Door 1 (Tuma) — so money moves.
3. Door 2 (Telegram) — so the city feeds itself.
4. `npm run seed` — so the first open isn't empty.
5. Send a real `/c/{slug}` link through WhatsApp.

That is the entire activation, and every line of it is code that already exists
on `main`.
