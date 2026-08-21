# Brief — Four-Screen Coalition Audit & Integration Blueprint

**Date:** 2026-08-21 · **Method:** every status below was verified against the live
codebase (`server/src/domain/*`, `server/src/connectors/*`, `server/src/routes/*`,
`App.tsx`), not inferred from the blueprint. Nothing here claims a capability
that does not exist.

---

## 0. Verdict up front

The four-screen blueprint asks Brief to become an **Economic & Civic OS** for
Black US metros + Kenya/Nigeria/South Africa, with financial cooperatives as
the retention engine. Against that bar, Brief today is **~55% of the way**:

| Capability class | Verdict |
|---|---|
| Civic/editorial feed (Screen 1 digest, Tea, discovery, collections) | **BUILT** |
| Event-driven commerce + ledger + campaigns | **BUILT** (settlement chain real) |
| Financial cooperatives (Chama/Stokvel/Esusu/Sou-Sou) | **NOT BUILT** |
| Escrow-backed staking (Screen 2) | **NOT BUILT + REGULATORY GATE** |
| Legal blueprints / SLAs / waivers (Screen 3) | **NOT BUILT + LEGAL GATE** |
| Cross-platform campaign blast + UTM (Screen 4) | **PARTIAL** (seam + Twilio exist; no trigger, no X, no UTM) |
| Real-time ledger on the feed | **PARTIAL** (ledger real; no push/websocket; home feed has no ledger module) |

The gaps are not effort gaps — several sit behind **hard gates** (regulatory
licensing for stakes, legal review for "binding" contracts, and credentials for
disbursement). Those are surfaced honestly below rather than papered over.

---

## 1. Four-screen gap analysis

### Screen 1 — Home Feed (Cultural Digest + Settlement Hub)

| Required | State | Notes |
|---|---|---|
| Morning digest (regional policy/civic/cultural) | **BUILT** | Tea editorial system (model + routes + seed + Tea Desk + reader). Voice is local/sharp, not a news wire. |
| Live collective-pooling ledger on the feed | **PARTIAL** | `ledger.js` is real (settled/pending, reconciliation), but (a) there is **no cooperative/pool model**, and (b) the home feed shows no ledger module — money surfaces only in the host Command centre and MoneyPanel. |
| Expiration-bounded flash drops / micro-auctions | **PARTIAL** | Auctions exist with an **opportunistic** `sweepExpired()` (on read, no cron). No "24-hour flash brand drop" queue, no automated visibility toggle by `expires_at`. |
| Regional mobile-money settlement into the feed | **PARTIAL** | Tuma collection connector is real but **credential-gated** (`TUMA_*` unset → honest 503). Disbursement has **no provider**. No webhook → feed broadcast loop exists. |

**Honest flag:** "instantly broadcasts balance updates to the entire group
feed" requires (a) a real-time transport (websocket/SSE) that does not exist,
and (b) a cooperative balance model that does not exist. Both are buildable;
neither is fakeable.

### Screen 2 — Arena (Social Staking & Engagement)

| Required | State | Notes |
|---|---|---|
| Low-friction engagement loops (chess matchmaking, prediction pools) | **PARTIAL** | Arena has real challenges/matches/players/venues/tournaments + a Game Theme Engine. No chess-specific or prediction-pool concept. |
| Peer-to-peer escrow with micro-settlements | **NOT BUILT + GATE** | No escrow state machine (`PENDING/FUNDED/ACTIVE_MATCH/DISPATCHED/COMPLETED`). `arenaMatches` statuses are scheduled/reported/confirmed/disputed/abandoned. |
| Private matchmaking lobbies | **PARTIAL** | Challenges + venues exist; no explicit private lobby/room primitive with invite codes. |

**Regulatory flag (non-negotiable):** escrow-backed staking is a **real-money
contest**. The existing compliance gate (`compliance.js`) **refuses** these
until licence + age verification + KYC + a licensed payment rail + responsible-
gaming controls exist. "Lock their stake inside an isolated transaction pool"
is exactly what the gate blocks today, and correctly so. This is not a code
gap I can close without the licensing; I will not silently wire money movement
around the gate.

### Screen 3 — What You Saved (Personal & Legal Briefcase)

| Required | State | Notes |
|---|---|---|
| Saved articles / vendor profiles / event materials | **BUILT** | The "saved" relationship (`SaveLabel`) + Vault (footsteps, handoffs) already persist saved content server-side. |
| Jurisdiction-aware legal blueprints (SLAs, waivers) | **NOT BUILT + LEGAL GATE** | No template system, no `saved_briefcase`-style table, no auto-fill from vendor+event parameters. |

**Legal flag:** I can build the **template infrastructure** (markdown/JSON
templates auto-filled from real vendor/event/host rows, exportable for
signature). I will **not** label generated documents "legally binding" —
that requires per-jurisdiction legal review (US metro, Kenya, Nigeria, South
Africa have genuinely different contract law). "Natively generated,
jurisdiction-aware legal blueprints" is a claim no unverified template can
honestly make; the truthful framing is "auto-filled draft contracts, review
before use."

### Screen 4 — Workflows (Campaign Automation Engine)

| Required | State | Notes |
|---|---|---|
| One-touch distribution to Telegram/WhatsApp/X | **PARTIAL** | Outbound seam + Twilio (SMS/WhatsApp-send) exist, but there is **no broadcast trigger** wired to campaigns, no Telegram *send* adapter, and **no X connector**. |
| UTM tracking + unified click analytics | **NOT BUILT** | `analytics.js` derives views/shares/registrations; there is no UTM parameter capture, no attribution of a registration to a channel, and no click pipeline. |
| Multi-state spatial grid allocations | **NOT BUILT** | No `spatial_grid_allocation` concept on campaigns. |

**The loop the blueprint wants** (Workflows → external → click → Home → Arena →
Vault) is the **referral/attribution gap** already identified in the earlier
reports (§2.4 of CAPABILITY-AND-ARCHITECTURE-REPORT). It is the single highest-
leverage missing primitive.

---

## 2. Diagnostic checklist (backend states / hooks / schema)

Per screen, the minimum to make the four screens compose:

| Screen | Backend states required | API hooks | Schema fields |
|---|---|---|---|
| 1 | pool balance derived; flash-drop `expires_at` + visibility sweep (cron or startup+interval) | `GET /feed` (exists), `GET /pools`, webhook → push | `financial_pools`, `flash_drops` |
| 2 | escrow `PENDING/FUNDED/ACTIVE/DISPATCHED/COMPLETED` behind the compliance gate | `POST /matches/:id/escrow`, outcome webhook → settle | `arena_matches.escrow_stake_amount`, `match_state`, `winner_id`, `settled_at` |
| 3 | template render + auto-fill from vendor/event/host | `GET /templates`, `POST /briefcase/:id/render` | `legal_templates` (markdown/JSON), `saved_briefcase` |
| 4 | campaign → blast with UTM; click capture | `POST /campaigns/:id/blast`, `GET /click?utm_*` | `campaign_links`, `click_events` |

---

## 3. Weak-infrastructure drop-off risks (from the blueprint, confirmed)

1. **Static feed** — without a real-time or cached aggregation endpoint, users
   polling full rows on scroll → slow feed → drop-off. (Brief's JSON store is
   synchronous; a cached `/feed` aggregate is the right first step, no Redis
   required at this scale.)
2. **Disconnected messaging** — ingest exists (Telegram/WhatsApp/web/RSS) but
   **send** has no trigger, so a host cannot syndicate an event; the "pump
   visibility back" loop never closes.
3. **No webhook → settlement broadcast** — a settled pool or match result that
   does not push to the feed means the money movement is invisible where it
   drives retention (Screen 1).
4. **Manual flash-drop admin** — no `expires_at` cron means "24-hour cycle"
   is a manual chore, not a mechanism.

---

## 4. Database strategy — mapping the blueprint's Postgres to Brief

Brief currently uses a **synchronous JSON document store** (`store.js`, one
`brief.json` + snapshots), not Postgres. The blueprint's SQL is the *target*.
The honest mapping:

| Blueprint table | Brief today | Action |
|---|---|---|
| `financial_pools` | **does not exist** | **New collection** (or table on Postgres migration). Chama/Stokvel/Esusu/Sou-Sou rotation model is a real, buildable primitive. |
| `community_events` | `campaigns` (+ `objects`) | Close fit. `spatial_grid_allocation` is **new**; the rest maps. |
| `arena_matches` | `arenaMatches` | Exists, but `escrow_stake_amount` / `match_state` / `settled_at` are **new** and blocked by the compliance gate. |
| `saved_briefcase` | `relationships` (verb `saved`) + `vault` | Exists in spirit; `legal_templates` + `custom_jurisdiction_rules` are **new**. |

**Note on the store:** the earlier report (§4.5) already flagged the JSON →
Postgres adapter seam. The blueprint's schema is a reasonable target shape, but
adopting Postgres is a **migration**, not a copy-paste — the EMPTY-merge +
versioned-migration machinery in `store.js` is what currently makes additive
schema changes free.

---

## 5. Honesty register (what I will not claim)

1. **Escrow staking** — blocked by the compliance gate (licence/KYC/rail).
   Will not wire money around it.
2. **"Legally binding" documents** — will build auto-filled draft templates,
   not claim legal validity.
3. **Cooperative balances** — do not exist; will build the model, not fake
   rotation payouts.
4. **"Instant micro-settlements"** — disbursement has no provider; collection
   (Tuma) is credential-gated. Honest 503 until configured.
5. **X broadcast** — no connector; will surface as configuration-required.

---

## 6. Recommended build order (dependency-aware, honest)

1. **Cooperative model** (`financial_pools` + rotation) — the retention engine
   the whole blueprint assumes; pure data model, no regulatory gate.
2. **Campaign → outbound blast + UTM click tracking** — closes the Screen 4
   loop; uses the existing outbound seam + Twilio; X added as a connector later.
3. **Flash-drop expiry queue** — cron/interval sweep on `expires_at`; small,
   unblocks the "24-hour cycle".
4. **Legal template infrastructure** — markdown/JSON templates auto-filled from
   real rows, labelled "draft, review before use."
5. **Escrow state machine** — build the states and the gate check; it will
   remain **disabled** until the licensing exists, but the structure will be
   ready.
6. **Real-time ledger on the feed** — cached aggregate first, then SSE/websocket.

Each of these preserves the current green baseline (server 1498 / client 1106 /
typecheck 0 / build) and traces UI → API → domain → persistence → provider.
