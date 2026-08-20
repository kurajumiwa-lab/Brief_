# Brief — Capability & Architecture Report

**Date:** 2026-08-20 · **Scope:** the feature list as it exists in the codebase
(`server/src/domain/*`, `server/src/connectors/*`, `server/src/index.js`, the
Vite client) — assessed for (a) what can actually *run* today, (b) where Brief
falls short, and (c) what the architecture must change to give every feature a
"shelf" that can be integrated *independently* (added, removed, or toggled
without disturbing the others).

Every status below is traced to a real module or route, not a claim from a
screenshot. Nothing here invents capability.

---

## 0. Status legend

| Status | Meaning |
|---|---|
| **RUNNING** | Real end-to-end: UI → API → domain → persistence → (provider). |
| **UNWIRED** | Code is real and tested, but blocked on external credentials/provider selection. It fails *honestly*, never fakes success. |
| **PARTIAL** | Built, but a leg is missing (usually a UI surface or a cross-feature join). |
| **NOT BUILT** | Honest gap — no rail exists, and none is faked. |

---

## 1. The feature list, with capability status

### A. Ingestion & provenance — the spine
| Feature | Status | Notes |
|---|---|---|
| Raw capture (Telegram webhook + pull, WhatsApp DM, web fetch, RSS, manual paste) | **RUNNING** | Signature-verified WhatsApp, token-gated Telegram, SSRF-guarded web fetch, group ingestion correctly refused. |
| Extraction pipeline (message → object → child objects, dedup, evidence) | **RUNNING** | `pipeline/ingest.js`; provenance + extraction confidence stored per object. |
| Canonical object graph (relationships, providers, locations, parents) | **RUNNING** | Typed verbs mapped server → client (`relationshipsFromServer`). |

### B. Identity & auth
| Feature | Status | Notes |
|---|---|---|
| Accounts (scrypt hashes, per-user salt) + sessions (SHA-256 fingerprint only, 30-day TTL, revocation) | **RUNNING** | No route reads an owner id from a request body. |
| Silent local bootstrap | **RUNNING** | Dev-only; flagged unsafe in production. |
| Vault-scoped roles (host/guest/vendor/admin/public from stored rows) | **RUNNING** | Roles never derived from a client claim. |

### C. Discovery & trust
| Feature | Status | Notes |
|---|---|---|
| Ranked feed (freshness + trust + engagement, derived score) | **RUNNING** | `/api/objects?rank=1`; score computed, never stored. |
| Geo (haversine, radius-scoped feed, `distanceKm`) | **RUNNING** | Server computes distance; client now surfaces it on the relative map. |
| Expiry sweep (stale demoted, never deleted) | **RUNNING** | Opportunistic on read. |
| Community confirmations + abuse reports + reputation | **RUNNING** | Tallies derived by scan; report lifecycle open→dismissed/actioned. |
| In-app notifications (inbox) | **RUNNING** | Derived events; push rail still separate/unconnected. |

### D. Commerce & money
| Feature | Status | Notes |
|---|---|---|
| Vendors, listings, orders, fulfilment | **RUNNING** | Server-authoritative pricing; quantity validation; idempotency. |
| Payment intent → confirmation → ledger → settlement | **RUNNING** | Amounts read from the order row, never the caller; fail-closed webhook; idempotent. |
| Tuma collection (STK Push) | **UNWIRED** | Real connector + contract; **blocked on `TUMA_*` credentials** (no sandbox exists). |
| Payout / disbursement | **UNWIRED** | Domain + honest `503/provider_unavailable`; **no disbursement provider selected**. |
| Refund | **PARTIAL** | `refunded` ledger status + registration demotion exist; no provider refund endpoint. |
| Auctions (bid ≠ money, closes into an ordinary order) | **RUNNING** | Bids live apart from the ledger by design. |
| Fantasy paid-entry gate | **RUNNING** | Inherits the same compliance gate as Arena. |

### E. Events & the gate
| Feature | Status | Notes |
|---|---|---|
| Campaign lifecycle (draft→published→live→closed) | **RUNNING** | Transition-gated; capacity writable only while draft. |
| Registration + capacity (idempotent, live-count) | **RUNNING** | Paid spots held as `started`. |
| Ticket codes (`BRF-XXXX-XXXX-XXXX`) + gate check-in | **RUNNING** | Opaque codes, honest states, operator attribution, idempotent re-scan, QR rendering + camera scanning. |
| Recurring / "continue" surface | **NOT BUILT** | No unified recurring-gathering model. |

### F. The Vault (context layer)
| Feature | Status | Notes |
|---|---|---|
| Vault identity + scoped roles | **RUNNING** | |
| Footsteps timeline (immutable, deduped, roster-named, paginated) | **RUNNING** | 33 kinds. |
| Channel handoff + guest-entry tokens (signed, expiring, single-use) | **RUNNING** | |
| Vendor requests (create→route→accept, scoped) | **RUNNING** | |
| Commerce↔Vault narration | **RUNNING** | Orders/payments/check-ins emit footsteps onto linked vaults. |

### G. Arena
| Feature | Status | Notes |
|---|---|---|
| Players, venues, tournaments, results, leaderboard | **RUNNING** | Leaderboard **derived** from confirmed results; results require both players to agree. |
| Challenges + matches + reporting | **RUNNING** | Idempotent `recordResult`. |

### H. Circles / blocks / signals (community)
| Feature | Status | Notes |
|---|---|---|
| Groups, membership, governance, votes (derived tallies) | **RUNNING** | Authority rules enforced (`canOperate`, `canGovernObject`). |

### I. Distribution & operations
| Feature | Status | Notes |
|---|---|---|
| Public campaign page + share links + Open Graph meta | **RUNNING** | `og:*` injected server-side (crawlers don't run JS); no fabricated image. |
| Host command centre (NOW/MONEY/PEOPLE/DISTRIBUTION/ACTION/NEXT) | **RUNNING** | All figures server-derived. |
| Analytics (activation/engagement/retention/quality) | **RUNNING** | Scan-only; no analytics table. |
| Demo seed (in-process, `seedBatch`-tagged, removable) | **RUNNING** | Kenyan multi-city content; no money/ratings fabricated. |
| Backup / restore / migrations | **RUNNING** | Atomic write; schema v2; pre-migration backup. |
| Capability registry (`/api/capabilities`) | **RUNNING** | Reports each connector's configured state so the client states truth. |

### J. Connectors
| Connector | Status |
|---|---|
| Telegram ingest | **RUNNING** (webhook + pull) |
| WhatsApp ingest (inbound DM only) | **RUNNING** |
| Web / RSS ingest | **RUNNING** |
| Manual paste | **RUNNING** (always-on fallback) |
| Tuma (collection) | **UNWIRED** (credentials) |
| **Outbound messaging (SMS/email/WhatsApp-send/Telegram-send)** | **NOT BUILT** |

---

## 2. Where Brief falls short (honest, dependency-ordered)

1. **Outbound messaging — the largest gap.** Brief can *receive* from every
   channel but *send* on none. There is no send connector, no
   `OUTBOUND_PROVIDERS` seam, nothing faked. This blocks receipts, reminders,
   gate confirmations, and any "the host replied" loop.
2. **Disbursement / payouts.** Collection has a provider seam (Tuma); payout
   does not. `DISBURSEMENT_PROVIDERS = {}` is intentional, but it means sellers
   cannot be paid through Brief yet.
3. **Live money.** The Tuma collection rail is correct and tested against an
   explicit adapter, but **no live transaction has ever run** — Tuma publishes
   no sandbox and no credentials have been supplied. This is the only "works in
   code, unproven in production" rail.
4. **Referrals & channel attribution.** `recordShare` stores `channel`, but a
   *registration* is never tagged with the channel it arrived through, so
   "which channel produced the attendee" is unanswerable. Referrals wait on
   this.
5. **Person timeline & omnichannel identity.** There is **no first-class
   `person` entity**. Guests enter with tokens, users are accounts, and a
   "Brian timeline" across campaigns/orders/years cannot be assembled from a
   single key. Cross-channel merge (Telegram X + WhatsApp Y + web Z = one
   person) is deliberately **not** inferred — it waits on verified identities.
6. **AI.** Buried by instruction. The substrate (footsteps + search + identity
   + orders + relationships) is the attach point; nothing is shipped as a
   superficial "AI" feature.
7. **Scale assumptions.** The store is a single synchronous in-memory JSON
   document. Correct and atomic at current scale, but it cannot run multiple
   replicas, and every feature shares one write path.

---

## 3. What the architecture *already* does right (shelf space that exists)

These are the seams that already make a feature "independently integrated":

1. **`domain/` module boundary.** 26 domain modules, each owning its state
   transitions and reached only through `store` + its own functions. A feature
   is a module; its data is a named collection.
2. **`providers.js` seam.** The single registry that maps provider names to
   connectors. *Adding a provider (Paystack, SasaPay, Flutterwave) = one
   connector file + one line.* No domain code knows Tuma's endpoints.
3. **Connector interface.** Every connector exposes `capabilities`,
   `isConfigured()`, `status()`. The `/api/capabilities` endpoint aggregates
   them so the client *states* what is unavailable instead of implying it.
4. **Schema EMPTY-merge + versioned migrations.** A new collection or field
   appears on an old database with zero migration; destructive changes get an
   ordered, one-time, backup-first step. This is exactly the "add a feature
   without breaking existing data" property.
5. **`queue.js` seam.** In-process queue (concurrency 1) with a documented
   swap path to BullMQ/Cloud Tasks — replacing one file, not the app.
6. **Honesty conventions.** `not_configured`, `provider_unavailable`, and
   `startup_note` make "unwired" a first-class, visible state rather than a
   silent failure.

---

## 4. Architecture updates needed — "shelf space for all, integrated independently"

These are the changes that would let every feature (current and future) have a
home and be toggled/added/removed independently. Ordered by leverage.

### 4.1 A per-domain route registry (highest leverage)
**Problem:** all **179 routes** are declared in one `server/src/index.js`.
Today a feature's routes are interleaved with everything else, so "integrate a
feature independently" still means editing the monolith.

**Change:** give each domain module an `registerRoutes(router)` (or a
`routes.js` per domain) and mount them. `index.js` becomes a list of mounts —
`mount('/api/campaigns', campaign.routes())` — instead of 179 hand-written
handlers. Adding a feature = one module + one mount line; removing it = delete
the mount. This is the single change that makes "independently integrated"
structural rather than aspirational.

### 4.2 A feature registry (enable/disable + configured state)
**Problem:** capabilities are *reported* but never *gated*. There is no way to
turn a feature off independently — an unwired feature (e.g. payouts) is only
"off" because its code returns 503, not because it's disabled.

**Change:** a `FEATURES` registry (`{ key, enabled, configured, domain }`).
Routes consult it; `/api/capabilities` reports it; ops can toggle a feature
off at deploy time without a code change. This is what "shelf space" means for
a half-wired feature: it sits on the shelf, visible, toggleable, but not in the
request path until it's configured.

### 4.3 An outbound channel seam (mirror `providers.js`)
**Problem:** ingest has a seam; send does not. There is nowhere to register an
SMS/email/WhatsApp-send provider.

**Change:** `OUTBOUND_PROVIDERS = {}` beside `COLLECTION_PROVIDERS`, with a
common `send()` shape and per-channel `capabilities`/`isConfigured()`. The
moment a real SMS/email connector exists, it slots in with one line — and until
then, "cannot send" is reported honestly, exactly like payouts today.

### 4.4 A first-class `person` entity (unblocks three deferred features)
**Problem:** person timeline, channel attribution, and omnichannel identity
merge all blocked on the absence of a single identity key.

**Change:** a `people` collection with explicit, *verified* alias bindings
(never weak inference — that is a hard rule). `registrations`, `orders`,
`footsteps`, `check-ins` gain an optional `personId` join. This is a data-model
change, not a UI change: it must land before any "Brian timeline" can be
honest.

### 4.5 A store adapter seam (scale, not correctness)
**Problem:** synchronous single-process JSON is the one thing every feature
shares and the one thing that cannot be "independently" scaled. It is *correct*
now; it is *the* limit later.

**Change:** `store.js` already isolates every access behind named helpers —
that is the seam. The work is a Postgres/Supabase adapter implementing the same
`all/find/filter/insert/update/remove` surface, with the sync-API preserved via
an async transition or a single-writer gateway. Documented swap path; not
urgent until multi-replica or multi-tenant scale is real.

### 4.6 Correlation IDs (observability for independent features)
**Problem:** every record carries `providerRef`/`orderId`/`footstepId`, but
there is no request-scoped correlation ID propagated across the async queue.

**Change:** a `correlationId` set at the edge, attached to queue jobs and
footsteps, so a single user action can be traced across features that ran at
different times. Cheap, and it is what makes "independently integrated but
composable" actually observable.

---

## 5. Baseline (unchanged, all green)

| Check | Result |
|---|---|
| Server suite | 1380 passed / 0 failed / 1 skipped |
| Client suites (23) | 1102 passed / 0 failed |
| Strict typecheck | exit 0 |
| Production build | succeeds |
| Live deploy | `/`, assets, SPA fallback, `/api/health`, `/api/ready`, `/favicon.ico` all 200 |

---

## 6. One-line verdict

Brief's **core loop runs end-to-end today** — discover → trust → act → pay
(recorded) → attend → reconcile — and its architecture already has strong seams
(`domain/`, `providers.js`, connector interface, schema merge). The honest
shortfalls are **outbound messaging, payouts, live money, and a person model**;
the structural work to make every future feature independently integrable is
**a per-domain route registry, a feature registry, and an outbound seam** —
in that order.
