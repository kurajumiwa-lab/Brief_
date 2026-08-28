# Brief

An information layer for what is happening around you. Brief structures what
communities already post — on Telegram, on the web, in feeds — into objects you
can find, verify and act on. It is deliberately **not** a marketplace: commerce
happens inside context, reached through discovery.

---

## Repository layout

```
App.tsx              Client application shell (React + TS)
src/api/             Typed API client -- the ONLY place fetch() is called
src/components/      Extracted client surfaces (Circles, Marketplace, Pulse, ...)
server/              Backend: connectors, pipeline, domain modules, HTTP API
  src/domain/        16 domain modules (auth, payment, settlement, ledger,
                     arena, fantasy, auction, order, listing, campaign, ...)
  src/ops.js         Structured logging, readiness, diagnostics, backup
  test/run.js        Server suite (1217 assertions)
preview/             Vite dev server + the jsdom client suites (23 suites)
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
```

**Current state: 3282 assertions, 0 failing** — measured 2026-08-28 against a
production build over HTTP, not inherited from an earlier report.

| Suite | Result |
|---|---|
| `server/test/run.js` | 1750 passed / 0 failed / 3 skipped |
| `server/test/livecamp.mjs` | 111 passed / 0 failed |
| `./run-suites.sh` (33 client suites) | 1218 passed / 0 failed |
| `tc` strict typecheck | exit 0 |
| `live/` against the production build | 43 + 27 + 91 + 16 + 26 = 203 / 0 |

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
