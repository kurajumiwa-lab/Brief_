# Brief

An information layer for what is happening around you. Brief structures what
communities already post — on Telegram, on the web, in feeds — into objects you
can find, verify and act on. It is deliberately **not** a marketplace: commerce
happens inside context, reached through discovery. And through **Mshikano**,
members cooperate directly — stating what they have, need, can help with or
are looking for — building a record of confirmed cooperation rather than a
wall of ratings.

---

## Repository layout

```
App.tsx              Client application shell (React + TS)
src/api/             Typed API client -- the ONLY place fetch() is called
src/components/      Extracted client surfaces (Circles, Marketplace, Pulse, ...)
server/              Backend: connectors, pipeline, domain modules, HTTP API
  src/domain/        17 domain modules (auth, payment, settlement, ledger,
                     arena, fantasy, auction, order, listing, campaign,
                     coop, ...)
  src/ops.js         Structured logging, readiness, diagnostics, backup
  test/run.js        Server suite (1907 assertions)
preview/             Vite dev server + the jsdom client suites (38 suites)
tc/                  Strict TypeScript typecheck harness
live/                Smoke tests against the PRODUCTION build over HTTP
uploads/             Screenshots of the deployed app
```

`App.tsx` at the root is the source of truth. `preview/src/App.tsx` and
`tc/src/App.tsx` are working copies that the dev server and typechecker read;
both are refreshed by copying the root file over them.

---

## Running it

### The app

```bash
cd preview
npm install
npm run dev            # http://localhost:5173
```

The dev server proxies `/ingest/*` to the ingestion API on port 8787, so the
browser never talks to the backend directly.

### The ingestion server

```bash
cd server
npm install
cp .env.example .env   # fill in tokens for live connectors
npm start              # http://localhost:8787
```

It runs without any credentials. Web, RSS and manual ingestion work
immediately; Telegram and WhatsApp report **"Needs authorization"** in the
connector dashboard until their tokens are set. Brief keeps working either way
— a dead connector never breaks the app.

### Temporary release-test content

When a new deployment needs a welcoming first page, run `npm run seed` (or use
the authenticated Demo action). The seed is server-side, marked as demo data,
and gets a seven-day expiry from its first creation. Once expired, public
objects are withdrawn, stories expire, campaigns close, listings archive, and
the marker remains so a later boot cannot silently resurrect the cohort. Use
`npm run seed:clear` only for an explicit reset.

The browser can run a release smoke check through the same `/ingest` proxy used
in production:

```bash
node live/5-release-smoke.mjs
RELEASE_SMOKE_WRITES=1 node live/5-release-smoke.mjs
```

The check verifies the release handshake, current home-feed timestamp, news
wire shape, Arena entry point, and (with writes enabled) a real registration,
challenge, campaign, WhatsApp-share/banner, and archive cycle.

---

## Tests

```bash
./run-suites.sh              # all client suites (syncs App.tsx first)
./run-suites.sh commerce     # or a single named suite

cd server && node test/run.js         # server suite
cd server && OFFLINE=1 node test/run.js   # skip anything needing the network
cd server && node test/livecamp.mjs   # live campaign integration

cd tc && npx tsc -p tsconfig.json     # strict typecheck (expects exit 0)
npm run test:yard              # Yard Engine HTTP completion loop
```

Against a running production build (`cd preview && npx vite preview`, plus the
API on :8787):

```bash
node live/2-commerce-over-http.mjs    # buyer journey, two real actors
node live/3-public-campaign.mjs       # public distribution
node live/4-full-chain.mjs            # identity -> ... -> payout, Arena,
                                      # Fantasy, Auction, ops
node live/5-release-smoke.mjs         # release handshake & feed shape
node live/6-completion-walk.mjs       # walk every loop end to end
node live/7-android-bug-replay.mjs    # replay the reported bugs
node live/8-mshikano.mjs              # cooperation network: intents, matches,
                                      # two-sided confirmation, trust evidence
node live/9-pochi-fees.mjs            # service fees via Pochi la Biashara:
                                      # M-PESA code, pending -> finance confirms
node live/10-referrals.mjs            # referrals: one level, no entry fee,
                                      # cash only from the revenue-backed pool
node live/11-arena-progression.mjs    # Arena retention layer: XP/Coins/missions/
                                      # season/rivals/rating replay, over HTTP
node live/12-whatsapp-shop.mjs        # WhatsApp shop: formatting, wa.me link,
                                      # publish gated on a confirmed Pochi fee
node live/13-duka-book.mjs            # the SME layer: logged sales + derived
                                      # book, idempotent offline replays, pooled
                                      # restocks, escrow records — over HTTP
node live/14-members-desk.mjs         # the members desk: directory, rungs,
                                      # funnel, immediate audited suspension
```

**Current state: 4045 assertions, 0 failing** — measured 2026-08-30 against a
production build over HTTP, not inherited from an earlier report.

| Suite | Result |
|---|---|
| `server/test/run.js` | 2072 passed / 0 failed / 1 skipped |
| `server/test/livecamp.mjs` | 111 passed / 0 failed |
| `./run-suites.sh` (45 client suites) | 1420 passed / 0 failed |
| `tc` strict typecheck | exit 0 |
| `live/` against the production build | 43+27+82+18+35+26+34+16+17+14+17+13+11 = 353 / 0 |

The server suite hits real third parties (BBC's RSS feed, GitHub's robots.txt,
Telegram's API). Those tests **skip** rather than pass when the network is
unavailable, so a green run always means something real happened.

These numbers were produced by re-running everything from a clean install, not
copied forward. [`VERIFICATION-REPORT.md`](VERIFICATION-REPORT.md) records what
that sweep found and fixed — three write routes that accepted an anonymous
caller, a manual capture that claimed extraction confidence it had not earned —
and what is still weak.

---

## Architecture notes

**Five primary destinations** — Nearby, Arena, My Layer, Workflows, Pulse.
There is no router: navigation is conceptual, driven by state. Do not add a
sixth destination; put new surfaces under an existing one's secondary nav.

**Two desks are filed into bundles, and the Inbox opens on a queue.** The
Inbox (Workflows) used to open on a list of 18 tools; it now opens on one
*waiting-on-you* queue (`GET /api/triage`), and the tools sit in four bundles
behind it — Create · Sell · Run · Records. My Layer's 11 options became three:
Kept · Groups · Creator. Every screen still exists at the same section id and
the same URL; the bundles only decide which sub-tabs are shown next to each
other. See `src/ui/names.ts` (`WORKFLOW_BUNDLES`, `SAVED_BUNDLES`) — that is
the single place the filing lives.

**A loop is not finished until somebody can walk it.** Three of them were
half-built and are now whole: a circle can be started, joined and left
(`POST /api/circles` makes the creator its coordinator; `POST/DELETE
/api/circles/:id/members[/me]`); a public plan can be joined and left
(`/api/subscriptions?browse=1`, `POST /api/subscriptions/:id/subscribe`); and
the queue answers "is anything waiting for me?" in one list instead of leaving
a badge on eighteen screens.

**Onboarding is a ladder.** A new person passes through five rungs — account,
intent, keep your first thing (the aha), contribute something, put it in front
of people — and each rung opens the secondary services above it. Progress is
DERIVED from real rows plus an append-only event stream, never stored as a step
counter, and the lock shapes what is *offered*, never what is permitted. Saved
and Actions deliberately show no ladder chrome. Google sign-in leads the first
screen and Telegram is never required. See
[`ONBOARDING.md`](ONBOARDING.md).

**Ligi runs itself.** The Arena's African fantasy football game opens, locks,
prices and settles every gameweek on a clock with no human in the loop — house
lines are DERIVED from each player's own settled history, not set by a
commissioner, and a week whose match stats have not arrived stays unsettled
rather than being guessed. It holds the priority listing on the main shelf. The
free seat is the whole game, staked in units that have no cash value; the cash
seat is listed, priced, and refused with the five requirements it is missing.
See [`LIGI.md`](LIGI.md).

**Mshikano: the unit is the relationship.** The cooperation network lives
under Nearby (the five-destination rule holds — it is a secondary surface, the
seventh door on the main shelf). Members post in one of four intents — have,
need, can help, looking for — and matching joins only complements
(HAVE↔NEED, CAN_HELP↔LOOKING_FOR), every match explaining itself with reasons
in words. A cooperation exists only when **both sides confirm it**: the
proposer cannot self-confirm, nobody outside the pair can respond, and only
confirmed rows reach the graph. Trust is counted evidence — confirmed
cooperations, repeat partners, recommendations, a verified identity — never a
star rating, and the level says what it means in words. "Who can help?"
answers with real people, active businesses, published guides and **real
circles** that match the question (with their true member count) — and stays
empty, saying so, when nothing matches. A member who says a cooperation did
not go as written can **dispute** it: the credit is withdrawn from both
records, the reason is kept, and the row stays listed. Nothing under
`/api/mshikano/*` is reachable without an account. See
[`MSHIKANO-INTEGRATION-REPORT.md`](MSHIKANO-INTEGRATION-REPORT.md).

**No fabricated data.** The rule the ingestion pipeline exists to enforce is
that a field which was not stated stays unstated. "Saturday popup" yields a
day, never a calendar date. Messages with nothing concrete in them produce no
object at all. Every extracted value stores the substring it came from so the
parser can be audited rather than trusted.

**Images are files, not links.** The editorial surfaces upload a real image
(`POST /api/media/upload`, multipart) rather than pasting a URL, because a
photo Brief does not hold can rot, hotlink-block or change under a published
story. The server decides what a file really is from its **magic bytes** — a
declared type, a filename and an extension prove nothing — accepts only JPEG,
PNG, WebP and GIF (never SVG, which is a document that can carry script), caps
the size on the wire, stores the file under a name it generates itself, and
serves the bytes with `nosniff` and a CSP that allows nothing. Bytes live on
the deployment's local disk, so they survive a restart and **not** a redeploy,
and the scheduled backup copies the store's rows but not the bytes;
`/api/media/status` says so, and a request for bytes that are gone answers 404
with that reason rather than serving a broken image. Point `BRIEF_UPLOAD_DIR`
at a mounted volume to keep them. See `server/src/domain/upload.js`.

**Provenance is first-class.** One real-world thing is one canonical object
with many attached sources. Seeing the same event on Telegram and in a WhatsApp
export escalates it to `cross_source_confirmed` — it does not create two
events.

**Privacy.** Objects derived from a private source default to `source_members`,
not `public`. "From your groups" renders only when a real membership record
exists; membership is never inferred.

**One economic layer.** `ledgerTransactions` is the single source of economic
truth. There is no wallet, no balance column and no per-feature economy --
not for vendors, campaigns, Circles, Arena, Fantasy or Auctions. Every figure
the UI shows (earnings, commission, withdrawable, auction price) is **derived**
by scanning rows, because a stored total is a second source of truth waiting to
disagree with the first.

**Money is server-authoritative.** Prices come from the listing row and
auction amounts from the winning bid row; a client posting `{price: 1}` against
a 2500 listing gets an order for 2500. Settlement is refused unless a genuinely
settled ledger transaction backs it.

**Referrals are rewards, not a pyramid.** Members earn points for bringing
people, products, services and real traffic: a code is derived from the
handle, signups credit the direct referrer once, fulfilled orders credit the
buyer and the referrer, event links (`?via=code`) count unique visits —
deduped per visitor per day and capped daily — and event registrations earn
once per attendee. Three structural rules keep it honest, and the tests pin
them: **depth is hard-capped at one level** (a referral of a referral credits
nobody above), **there is no entry fee anywhere**, and points convert to
cash **only from a pool backed by a fixed fraction of confirmed service-fee
revenue** — floor(10%) minus what is already paid or promised, refused with
the reason when empty. Payouts are manual M-Pesa sends confirmed by finance,
carried in the one economic layer. See `domain/referrals.js`.

**Brief's own services are paid by Pochi la Biashara, manually.** Pochi has
no developer API, so nothing pretends otherwise: the price lives in one
server-side catalog (`domain/fees.js`), the member pays Brief's Pochi number
in their M-PESA app and submits the confirmation code, and the fee stays
**pending** — a service never activates on trust alone — until a
finance-capable operator confirms the code. One M-PESA code is one payment,
ever; a refused code stays locked with its reason on the row; and revenue is
derived by scanning confirmed rows in the one economic layer.

**Honest refusal over fake success.** No payment provider is connected, so
paying returns **503 with `charged:false`** and a stated reason -- it never
fabricates a payment. Real-money Arena and paid Fantasy return **403
`compliance_gate`** naming the five unmet requirements. `/api/capabilities`
reports all of this truthfully.

See [`BRIEF-FINAL-REPORT.md`](BRIEF-FINAL-REPORT.md) for what is built, partial
and missing, and [`BRIEF-COVERAGE-MATRIX.md`](BRIEF-COVERAGE-MATRIX.md) for
evidence-cited coverage per area.

The anonymous, read-only feed contract is documented in
[`PUBLIC-FEED-API.md`](PUBLIC-FEED-API.md). Use `GET /api/public/feed` for
external integrations; `GET /api/feed` remains the first-party alias.

See [`server/CONNECTORS.md`](server/CONNECTORS.md) for exactly what each
connector can and cannot do, including the things that are genuinely impossible
(WhatsApp group ingestion, Telegram history backfill) and why.

---

## Deployment

The client is a static Vite build:

```
Build command:     npm run build
Output directory:  dist
Install command:   npm install
```

Environment variables for the client need the `VITE_` prefix to be exposed to
the browser. The ingestion server's secrets must **never** carry that prefix —
they stay server-side.

## Arena progression (retention layer)

XP and Arena Coins are **points, not money** — they buy nothing, cash out nowhere, and never touch the ledger. Every number is **derived**: ratings/streaks are a single-pass chronological replay of confirmed matches; totals come from idempotent grant events (`arena:match:<mid>:<uid>`) and once-daily mission claims (`arena:mission:<day>:<key>:<uid>`).

- `GET /api/arena/progress/me` — level (500 XP/level), season XP, coins, daily missions, rivals (≥2 confirmed matches), season rank, per-player stats.
- `GET /api/arena/live` — real counts only: active in last hour, awaiting confirmation, open challenges, Season 01 clock.
- `POST /api/arena/missions/:key/claim` — once per day; incomplete missions refuse with the reason.
- `GET /api/arena/season/leaderboard` — ranked XP rows plus the caller's `you` row.
- `confirm` responses include `yourRewards` for the confirming player's toast.
- Client: `ArenaPulse` in the lobby (tagline "Play. Compete. Build your record.", honest quiet states) and `SeasonStrip` above the per-game leaderboard. No new navigation.


## WhatsApp shop (build on Brief, sell in WhatsApp)

The architecture is stated in the product, not hidden: **Brief builds the shop, WhatsApp IS the shop.** A member writes a name, a one-liner, an order number and a price list; Brief derives the exact WhatsApp message (real formatting — `*bold*`, `_italic_` — that survives a screenshot, a status post and a broadcast) plus a `wa.me` deep link that opens a chat with the catalog pre-filled. The conversation is where selling happens; Brief does not sit in the middle.

- No WhatsApp payments, by design. Buyers and sellers arrange money the way they already do (Pochi la Biashara, till, send money).
- Drafting is free. **Publishing is gated** on the `store_monthly` service (KES 250/month) — paid through the same manual Pochi flow as every Brief fee and activated only when a finance-capable operator confirms the M-Pesa code. A pending code opens nothing.
- One shop per member; up to 40 items so a forwarded list stays readable; the share output is derived, never stored.
- Photos belong in the free WhatsApp Business catalog (500 items, 10 images) — this builder makes the price list people actually forward. The panel says so.
- Routes: `GET/PUT /api/shop/mine`, `POST /api/shop/mine/publish|unpublish`; the publish refusal is machine-readable (`requiresService`) and the client deep-links to the fee desk.
- Client: `WhatsAppShopBuilder` under Workflows → Sell → WhatsApp Shop, and a door in the redesigned Menu.

## Menu, redesigned as part of the same app

The Menu was rebuilt to the Arena screen's visual system instead of a dark modal: lavender page, white cards, deep-purple actions, and gold reserved for membership status alone. It is a full navigation surface beneath the dock (the bottom nav stays visible), with exactly one close control. The account is one compact card (standing derived on demand), Explore is a four-door icon grid — no photography, since Menu navigates while the home screen explores — Quick Actions are compact rows in one card, and coming-later items are a single quiet line. `preview/menusheet.jsx` holds the rules (one `×`, no neon, no `img`).


## The Duka layer: book, pools, escrow records, offline shell

The SME-digitization build (see `MARKET-GAPS-ADVISORY.md`), all on existing seams:

- **The Duka book** — the paper-ledger replacement. Brief never claims to see inside WhatsApp: the shopkeeper LOGS a sale in 3 fields (item, qty, price) and everything is derived — today/yesterday/7-day totals, top items, low stock (price-list stock minus the week). `GET /api/shop/mine/book`, `POST /api/shop/mine/sales`. Sales carry a `clientKey`; a replay of the same key returns the original row (`replayed: true`), never a second sale.
- **Pooled restocks** — "pool this item" opens a real Group Buy (`POST /api/shop/mine/pool`): the shopkeeper declares the bulk unit cost and a goal, pledges their own units, and the engine's funding → escrow → dispatched → delivered stepper takes over. Other shops contribute; the share text is a forwardable WhatsApp call (`*RESTOCK POOL*`).
- **Escrow-as-records** — `GET /api/escrows/mine` derives what is HELD and what is RELEASED for one member across every escrow pattern (group buys, ticket resale orders; HudumaLink citizen escrow stays phone-keyed at the operator desk). Records only: Brief moves no money.
- **The offline shell** — PWA manifest + service worker (`preview/public/`): hashed assets cache-first, navigations network-first with a cached-shell fallback, and the API is NEVER cached (a cached read pretending to be live is a lie). Writes survive a dead signal through `src/api/offlineQueue.ts`: a failed POST is parked in localStorage with its clientKey, the surface says "queued", and the browser's `online` event drains the queue oldest-first; server-side idempotency makes a double-send harmless. Refusals on replay land in `deadLetters`, visible — never silently deleted.


## The members desk (onboarding real people)

The admin side of onboarding, in the Operate desk's first tab:

- **Directory** — `GET /api/ops/members?q=` (admin-only): handle, name, joined date, status, platform roles, verification, whether they run a shop, and the rung they actually climbed — all derived per request. The rung mapping is honest: `reach` has no named activation event yet, so nobody is shown as having reached it.
- **Onboarding funnel** — `GET /api/ops/onboarding`: counts of real activation events, members with any event, finished onboarding. "A member with no events has genuinely not started."
- **Suspension** — `POST /api/ops/members/:id/status`: a suspension **revokes every live session immediately** (locked out on the next request, not the next login), refuses new logins, requires an audited reason, and lands in the audit log with before/after. Reinstatement is the same route.
- **Roles** — grant/revoke operator/reviewer/finance/admin chips in the member panel, riding the existing audited `/api/ops/roles`.
- The first admin of a deployment is named by the `BRIEF_ADMINS` bootstrap env (the same mechanism as `BRIEF_OPERATORS`).

## Menu: a two-thirds sheet

The Menu owns the lower **2/3** of the screen; the top 1/3 stays the live app behind a light scrim (tap it to close). One close control remains (the header ×), the dock stays visible above the sheet, and the lavender/card/purple visual system is unchanged — the Menu is part of the same product, not a screen that replaces it.


## Make it run: deploy, preflight, legal

- **`.env.example`** — every environment variable the deployment understands, grouped and commented (core, roles, money, auth, connectors, sports, uploads).
- **Docker** — `Dockerfile` + `docker-compose.yml`: one container (API serving the compiled client), state in a named volume, `/api/health` healthcheck. `docker compose up -d --build` and it runs.
- **`scripts/preflight.mjs`** — the go-live checklist executed against a live deployment (REQUIRED/WARN/OFF tiers; exit 0 = ready). `node scripts/preflight.mjs https://host --admin-token <jwt>`.
- **Legal** — `GET /api/legal/terms` and `GET /api/legal/privacy`: public (readable before an account exists), versioned and dated, and written to match what the product actually does — points are not money, fees confirmed by an operator, Brief not a party to WhatsApp shop sales, stakes off without a licence, no identity documents stored (Kenya DPA 2019). The app footer links both.
- **`DEPLOYMENT.md`** — the full runbook: Docker / Railway / bare VPS, data durability, the complete env table, and the go-live checklist.


## TG onboarding + WhatsApp basic (the connector essentials)

- **The START handshake** — a private `/start` or `/help` in the bot is answered, not ingested: the webhook replies with one button, **"Open Brief"**, which launches the Mini App at `BRIEF_PUBLIC_ORIGIN`; `initData` then signs the person in (`/api/telegram/init`, already existing) and onboarding runs inside Telegram. With no bot token or public origin the handshake is honestly reported as not sent. Group traffic through the same webhook still ingests as discovery content.
- **`scripts/telegram-setup.mjs`** — the one-time wiring: proves the token (`getMe`), sets the webhook + secret header, makes the chat menu button the Mini App, sets `/start` + `/help`, reads back `getWebhookInfo`.
- **WhatsApp basic** — inbound messages to the business number now earn a one-line ack ("Received. Your message is saved in Brief.") through the Cloud API when `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` are set; unconfigured, the webhook response *says* the ack was skipped. `sendText` fails closed with the reason.
- **The webhook namespace is exempt from the session gate** — machine callbacks (Telegram, WhatsApp, Tuma, Paystack) carry their own credentials (secret header / HMAC), so the account gate must not stop them. Found by the new tests: the gate had been 401-ing real provider callbacks while old tests passed only because they carried a member token. Each webhook still fails closed on its own credential.
- **`CONNECTORS.md`** — the map: which file does what, which env vars each seam needs, where to get them (BotFather, Meta app dashboard), the webhook URLs to register, curl tests, and the honest limits (WhatsApp groups are not ingestable; Pochi has no API).
