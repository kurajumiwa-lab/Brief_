# Production Reality Pass — report

Baseline: the deployed Brief build (Railway, `npm start` → `node server/src/index.js`,
serves the Vite build). No redesign, no new features.

---

## The headline finding

**The shelves were empty, not disconnected** — with one exception (Arena).

`Nearby → getObjects() → GET /api/objects → store.all('objects') → objectFromServer() → rendered`
is fully wired and verified. The same is true for Marketplace, Campaigns,
Tickets/check-in, Vault, the Command Centre, and auth. Objects were zero because
nothing had ever been ingested and nothing captured — the machine was assembled,
the storeroom was connected, and the shelves simply held nothing.

**Arena is the one genuinely disconnected shelf**: the server has a real, tested
Arena domain (`GET/POST /api/arena/games`, `/api/arena/challenges`, accept/report/
confirm, server-side persistence — exercised by the test suite and `live/4-full-chain.mjs`),
but the frontend renders **hardcoded static fixtures** (`ARENA_GAMES`, `ARENA_CHALLENGES`
in client `useState`). Its only real fetch is `getArenaMoneyStatus`. Left unwired
this pass (see "Still broken").

---

## 1. Fixed

- **Empty discovery surface** — added `scripts/seed-demo.mjs`: populates Nearby,
  Marketplace and public campaign pages with realistic Nairobi-local content
  (popups, markets, yoga sessions, tech meetups, a book fair, Wakulima Market,
  a grant opportunity, a streetwear vendor + products, two live ticketed
  campaigns). It runs through the **real extraction pipeline**
  (`storeRawItem → processRawItem`) and the real `campaigns/vendors/listings`
  domain services — no hand-rolled fake rows.
- **Seed safety** — every seeded row carries `seedBatch: 'nairobi-demo-v1'`;
  `--clear` removes exactly those rows and their links. It creates **zero**
  ledger transactions, payment intents or orders — nothing that could be
  mistaken for real money.
- **Listing visibility** — seeded listings are transitioned to `active` (draft
  listings are correctly invisible to the public marketplace).
- **Honest empty state** — the Nearby "Nothing here yet" state now tells a
  first-time user the real next step ("connect a source or capture something in
  Workflows → Sources") instead of a dead end.
- **Runnable commands** — `npm run seed`, `npm run seed:clear`, `npm run smoke:seeded`.

## 2. Still broken

- **Arena frontend is disconnected from its backend.** The server Arena is real
  and tested; the UI shows static fixtures that don't persist and don't reflect
  the server's state. This is the one surface where the "shelves" are cardboard.
  Fixing it means wiring the Arena UI to `/api/arena/*` (games, list/create/
  accept/report/confirm challenges) — a focused but non-trivial change I
  deliberately left out of this surgical pass.
- **Workflows (journeys) are client-only.** `INITIAL_JOURNEYS = []` in `useState`,
  no server route — journeys don't persist across reloads. This is a smaller
  version of the same gap. (The comment in the code acknowledges "there is no
  server journey.")
- **No persistent database.** The JSON store lives on the Railway filesystem,
  which is ephemeral — data (and a seed) resets on redeploy. This is the
  architectural reason "0 Objects" recurs after a fresh deploy.

## 3. Blocked by external credentials / integration

- **Live payments** — Tuma has no sandbox and no credentials are mounted;
  `/api/capabilities` honestly reports `payments.configured: false`. A payment
  correctly stops at `503 / provider_unavailable` (never faked).
- **Telegram / WhatsApp ingestion** — no tokens set; connectors report
  "not configured", which is why nothing arrives automatically.
- **Outbound messaging** — no send connector exists at all.

## 4. Misleading UI removed

- The Nearby empty state no longer reads as a bare dead end.
- No fake "connected" states were found elsewhere: connector surfaces already
  report `not configured` honestly, and payments report `provider_unavailable`.
- (Arena's static fixtures remain — flagged, not removed, to avoid shipping a
  half-rewired surface this pass.)

## 5. End-to-end journey result

`scripts/smoke-seeded.mjs` boots the production server and traces the real HTTP
path. **9/9 passed:**

```
GET /                                        → 200 SPA shell
GET /api/health                              → 200 ok
GET /api/objects                             → seeded objects (Nearby non-empty)
GET /api/objects/:id                         → opens one object
GET /api/listings                            → seeded marketplace listings
GET /api/public/campaigns/:slug              → public page projection
POST register                                → 201 + real ticketCode
GET /api/tickets/:code (non-owner)           → 404 (host-scoped, honest)
GET /api/capabilities                        → payments.configured: false
```

Plus the earlier `scripts/demo-vault.mjs` (6/6 invariants) and `scripts/verify-og.mjs`
(9/9) already cover the Vault timeline and the public-page OG previews. Payment
stops at the honest provider state — no success manufactured.

## 6. Exact files changed

- `scripts/seed-demo.mjs` (new) — demo seed via the real pipeline + `--clear`
- `scripts/smoke-seeded.mjs` (new) — seeded HTTP journey smoke test
- `App.tsx` + `preview/src/App.tsx` + `tc/src/App.tsx` — honest Nearby empty state
- `package.json` — `seed`, `seed:clear`, `smoke:seeded` scripts

## 7. Tests run and results

| Check | Result |
|---|---|
| Server suite (`node test/run.js`, full incl. live) | **1347 passed / 0 failed / 1 skipped** |
| Client suites (`./run-suites.sh`, 23 suites) | **1105 passed / 0 failed** |
| Strict typecheck (`tc`) | **exit 0** |
| Production build (`vite build`) | **succeeds** |
| Seeded smoke (`node scripts/smoke-seeded.mjs`) | **9/9** |
| Seed + clear round-trip | **10 objects → 0 after clear, links cleaned** |

---

## What I did NOT do (and why)

- **Did not rewire Arena** — it is the single most valuable next fix, but it is
  a surface-level change to a large existing component, and your instruction
  was to dissect before touching another major feature. The evidence is here for
  that decision.
- **Did not fake payments, fabricate money, or add "connected" states.**
- **Did not add a database** — the ephemeral-store reality is reported, not
  papered over, because swapping the persistence layer is its own decision.
