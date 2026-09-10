# Brief — Economic coordination for Kenyan women, workers and micro-enterprises

**Brief is a distribution-and-economic infrastructure layer for organizations that already have trusted groups of women, workers, traders, suppliers and entrepreneurs — not a bank, and not another consumer app.**

A member requests something they source, a supplier quotes it, the two agree on
terms and run the work to completion, the completion is remembered so the same
sourcing is one tap next time, both parties build a **derived, explainable**
track record, and payment is collected and settled through real rails — with
every figure derived from real rows, never stored as a second source of truth.

---

## What Brief is, and what it is not

**The positioning.** Brief does not try to become a bigger consumer app. It is
a *distribution and economic-coordination layer* for organizations that already
hold a trusted group — women-focused banks, SACCOs, chamas, coops, employers,
NGOs, KNCCI-type networks, corporate supplier-diversity programs. They bring
the cohort; Brief supplies the shop, the records, the verification and the
money rails; the ledger proves what the cohort actually did.

**Not a bank, not a lender.** Brief does not hold user funds, does not lend,
does not score credit, does not insure, and does not touch crypto. "Brief is
not a bank" is a hard constraint, not a slogan.

**Honesty is the product.** Every number the UI shows — earnings, commission,
withdrawable, trust history, partner revenue share — is **derived** by scanning
real rows. A stored total is a second source of truth waiting to disagree with
the first. When something is unavailable, Brief says so instead of fabricating
success: an unconfigured payment rail returns `503` with a reason, not a fake
"paid".

---

## The product surface

Production serves a **four-tab dock** (see `src/app/Navigation.tsx`):

| Tab | What it is |
|---|---|
| **Home** | The owner-scoped home surface (`src/features/home/HomeSurface.tsx`). |
| **Spaces** | The pipeline — your requests, work and supply (`src/features/spaces/PipelineView.tsx`). |
| **Discover** | The city feed — what is being sourced and supplied around you (`src/features/city/CityFeedView.tsx`). |
| **Activity** | Your own real counts: requests, work, payments, procurement (`src/features/activity/ActivitySurface.tsx`). |

---

## The core economic loop

One chain, all derived, all honest:

1. **Request** — a member posts structured demand (`domain/requests.js`): quantity, unit, category, budget, deadline, specs.
2. **Match** — demand is matched to participant capabilities, every match explaining itself in words (`domain/matching.js`).
3. **Quote** — the participant proposes integer-minor-unit terms; totals are BigInt-exact (`domain/quotes.js`, `quoteValidation.js`).
4. **Work order** — accepting a quote freezes an agreement and runs a two-party fulfillment state machine (`domain/workOrders.js`).
5. **Repeat procurement** — completing a work order records a repeatable pattern, so "request again" is one tap (`domain/procurement.js`).
6. **Trust** — economic history is derived per participant/capability with explainable signals, never a secret score (`domain/participantTrust.js`).
7. **Payment** — collection via Tuma STK push, disbursement via M-Pesa B2C, each attempt recorded and reconciled (`domain/workPayment.js`).

The **supply layer** (`domain/supply.js`, `supplyVerification.js`) models
enterprises and their capabilities (production / stock / service / logistics /
sourcing access), with scoped verification records (identity, business type,
sourcing role, capability, capacity, authorization) — never an aggregate
"fully verified" badge.

---

## The distribution layer (attribution + partners)

The strategic core of the product. Two first-class domains:

**Attribution** (`domain/attribution.js`) — the provenance chain. When a member
arrives, Brief captures *once* (first-touch-wins) how they got here:

```
partner=WEF → program=women-enterprise-2026 → cohort=nairobi-west
  → invite=ABC123 → member=USER456 → work order → KES 12,500
```

Economic activity per member and per partner/cohort is **derived** from real
rows (fulfilled orders, completed work, repeat patterns) — never stored. A
partner with no members shows zero, plainly.

**Partner** (`domain/partner.js`) — first-class distribution partners. A
partner is a *stored, contracted* record (organisation → programs → cohorts)
keyed against the attribution keys. Its revenue share is a **derived
obligation** (`floor(shareRate × verifiedCommercialKes)`) that becomes money
only through a settlement that finance confirms, writing a real ledger
transaction (`partner_revenue_share`). The transparent ledger reads:

```
Partner generated KES 482,300 → Partner share KES 48,230 → Brief KES 38,584 → costs KES 9,646
```

These are operator-created records, not member claims; revenue share is a
derived number, never fabricated money.

---

## One economic layer

`ledgerTransactions` is the single source of economic truth. There is no
wallet, no balance column and no per-feature economy. Money is
server-authoritative: a client posting `{price: 1}` against a KES 2,500 listing
gets an order for 2,500. Settlement is refused unless a genuinely settled
ledger transaction backs it.

- **Collection:** Tuma STK push (`connectors/tuma.js`) — fails closed when unconfigured.
- **Disbursement:** M-Pesa B2C (`connectors/mpesa.js`) — payouts refuse with `503 provider_unavailable` until credentials are set.
- **Referrals** (`domain/referrals.js`): depth hard-capped at **one level**, no entry fee anywhere, points convert to cash only from a pool backed by a fixed fraction of confirmed service-fee revenue.

---

## Repository layout

```
preview/src/main.jsx    The ONLY entry point. Renders src/app/AppShell.tsx for
                        app routes and PublicCampaignPage for /c/:slug.
App.tsx                 Root client shell (React + TS).
src/app/                AppShell + Navigation (the production shell).
src/features/           Modular surfaces: home, city, spaces, activity,
                        matching, quotes, requests, supply, work, procurement.
src/api/                Typed API client — the ONLY place fetch() is called.
src/model/              Core types, scoring, destinations.
server/                 Backend: connectors, domain modules, HTTP routes.
  src/domain/           The domain logic (auth, requests, matching, quotes,
                        workOrders, procurement, participantTrust, workPayment,
                        supply, attribution, partner, ledger, settlement, ...).
  src/routes/           Express route modules, one per domain.
  src/store.js          File-backed JSON store; EMPTY enumerates every
                        collection; additive migrations only.
  test/                 Server suite (run.js + per-domain *.mjs).
preview/                Vite build + the jsdom client suites.
tc/                     Strict TypeScript typecheck harness.
```

`preview/src/` is the single canonical client source tree — built by Vite and
read directly by the typechecker (`tc/tsconfig.json` includes
`../preview/src`). The legacy `App.tsx` shell remains only as the test harness
for the older feature suites (Circles, Marketplace, events, tickets, …); the
production entry (`preview/src/main.jsx`) renders `AppShell` and never imports
it.

---

## Running it

### The app

```bash
npm run install:all        # installs root + preview + server + tc workspaces
npm run dev                # Vite dev server (proxies /ingest/* to :8787)
```

### The server

```bash
cd server
cp .env.example .env       # fill in tokens for live connectors
npm start                  # http://localhost:8787 (binds 0.0.0.0:PORT)
```

It runs with no credentials. Local domains work immediately; connectors that
need a token report "not configured" and fail closed — a dead connector never
breaks the app.

---

## Tests

Run from the repo root after `npm run install:all`:

```bash
npm run build:client       # Vite production build (preview/src is the source)
./run-suites.sh            # client suites (jsdom)
cd server && npm test      # server suite (run.js + per-domain files)
npx tsc -p tc/tsconfig.json  # strict typecheck (expects exit 0)
```

**Current state — measured 2026-09-10 from a clean install, not copied forward:**

| Suite | Result |
|---|---|
| Server (`cd server && npm test`, 21 suites) | **2892 passed / 0 failed / 1 skipped** |
| Client (`./run-suites.sh`) | **1861 passed / 0 failed** |
| Strict typecheck (`tc`) | exit 0 |

The server suite skips (rather than passes) network-dependent assertions when
the network is unavailable, so a green run always means something real
happened.

---

## Deployment

`railway.json` builds the client with `npm run build:client` and starts
`NODE_ENV=production node server/src/index.js`, serving the compiled frontend
from `preview/dist`. The server binds `0.0.0.0:$PORT` (default 8787) and
exposes `/api/health` and `/api/ready`.

Environment variables: server secrets must **never** carry the `VITE_` prefix —
that prefix is what exposes a value to the browser. See `.env.example` and
`server/.env.example`.

---

## Deliberately out of scope

No star ratings, no review walls, no credit scoring, no lending, no BNPL, no
insurance, no crypto, no opaque AI scoring, no M-Pesa onboarding that pretends
a payment happened. Keep Brief "not a bank".

---

## Further reading

- `PUBLIC-FEED-API.md` — the anonymous, read-only feed contract (`GET /api/public/feed`).
- `ONBOARDING.md` — the service ladder (progress derived from real rows, never a stored counter).
- `server/CONNECTORS.md` — what each connector can and cannot do, and why.
