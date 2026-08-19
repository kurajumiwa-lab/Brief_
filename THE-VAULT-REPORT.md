# THE VAULT — implementation report

> "Channels are doors. The Vault is the room. The thread is the memory. The
> transaction is the proof."

A persistent context layer over Brief's existing primitives. Built on top of
the live architecture (JSON document store, `signals` event stream,
`callerId` authorization, the Tuma provider seam) — not a replacement for it.

---

## What I discovered

- **Store**: a synchronous JSON document store with additive collections and
  an append-only `signals` event bus. New collections are free (the EMPTY-merge
  handles old databases); migrations exist only for *transforming* rows.
- **Auth**: `callerId(req)` resolves a verified session or the dev fallback;
  authority is always read from stored rows, never from the request.
- **Events**: `signals` already record "something happened" with actorId +
  metadata. The Vault's Footsteps are a *vault-scoped narrative layer* over the
  same real events, not a second money store.
- **Money**: `orders → paymentIntents → ledgerTransactions → settlement` is the
  single economic layer. The Vault owns no money; it only adds context.
- **Navigation**: five destinations; new surfaces belong under an existing
  destination's secondary nav. The Vault lives under **Workflows**.
- **Channels**: real connectors exist for Telegram, WhatsApp (ingest), web/RSS
  and manual. WhatsApp/Telegram are *ingestion* connectors — there is no
  outbound messaging, and none was faked.

## What I changed

### New domain models (server/src/domain)
- **`vault.js`** — Vault identity: create/list/update/close, participants with
  roles (`host`/`guest`/`vendor`/`admin`), links (`order`/`object`/`campaign`/
  `vendor`/`transaction`/`listing`), vendor requests (create → route → accept),
  channel attachment, scoped views, public entry, resolution, search.
- **`footsteps.js`** — the immutable, chronological, category-filterable event
  stream. 33 kinds across 7 categories (people/messages/commerce/payments/
  vendors/system/decisions), strict per-vault `seq` ordering, cursor
  pagination, and `dedupeKey` replay protection. Names resolved from the
  roster so the timeline reads with real names.
- **`handoff.js`** — opaque HMAC-signed tokens for channel handoff *and*
  guest entry: expiry, single-use replay protection, participant binding,
  fail-closed without `HANDOFF_SECRET`.

### Store
- Added 6 collections: `vaults`, `vaultParticipants`, `vaultChannels`,
  `vaultRequests`, `footsteps`, `handoffs`. **No migration needed** (additive),
  **no historical data touched**.

### New APIs (server/src/index.js)
- `POST /api/vaults`, `GET /api/vaults`, `GET /api/vaults/:id`, `PATCH`,
  `POST /:id/close`
- `GET/POST /api/vaults/:id/footsteps`
- `POST /:id/participants`, `/:id/link`, `/:id/channels`, `/:id/handoff`
- `GET/POST /api/vaults/:id/requests`, `/:id/requests/:rid/route|accept`
- `GET /api/public/vaults/:slug`, `POST /:slug/enter`
- `POST /api/vaults/handoff/resolve`
- `GET /api/vaults/search?q=`, `GET /api/vaults/resolution`

### Commerce ↔ Vault wiring
- Order creation, fulfilment, settlement, payment authorization/failure, and
  the **Tuma webhook** all emit a Footstep onto every vault that links the
  order (`vault.emitOrderFootsteps`), deduped by provider reference so a
  replayed callback never double-records. Money stays authoritative in the
  ledger; the Vault only narrates it.

### Frontend (src/components/vault/Vault.tsx)
- **Vault Home** — a restrained command surface: vault cards with derived
  metrics (people / requests / pending KSh), create-vault form, real search,
  and a "Needs attention" resolution list.
- **Vault Timeline** — a premium activity recorder: footsteps grouped by day,
  category filter chips, category color dots, "load earlier" pagination.
- **Host / Guest / Vendor views** — the server's `role` drives what renders;
  hosts manage participants + handoffs + closure, guests ask + request,
  vendors see and accept only their scoped requests.
- Mounted as a **Vault** section under Workflows (no sixth destination).

### Demo
- **`scripts/demo-vault.mjs`** — a deterministic, seeded journey through the
  real domain layer (host → public entry → RSVP → question → request → route →
  accept → order → Tuma payment → settled ledger → handoff → timeline),
  printing the timeline, scoped views, and the six invariants. The Tuma rail is
  an explicit **test adapter**, never a faked success.

## Tests

| Check | Result |
|---|---|
| `server/test/run.js` (full, incl. live 3rd-party) | **1321 passed / 0 failed / 1 skipped** |
| `./run-suites.sh` (23 client suites) | **1105 passed / 0 failed** |
| `tc` strict typecheck | **exit 0** |
| Production build (`vite build`) | **succeeds** (1537 modules) |
| `node scripts/demo-vault.mjs` | **DEMO PASSED** (6/6 invariants) |

New tests cover: vault creation, authorization boundaries (host/guest/vendor/
stranger), footsteps ordering + categories + dedupe + pagination, handoff
signing/expiry/replay/tamper, public vs private entry, vendor scoping (no
participant/roster leak), payment linkage → footstep, search, resolution,
and vault closure.

## Security

- Roles from stored rows only; a client-supplied role is ignored.
- Guest entry and handoff tokens are signed, expiring, single-use, and bound
  to one participant; a tampered or replayed token is refused (403).
- Public projection leaks no roster, no links, no ownerId.
- No API keys reach the client; `HANDOFF_SECRET` is server-side and fails
  closed in production.

## What remains genuinely unconnected (honest status)

- **Outbound messaging** (WhatsApp/Telegram *send*, SMS, email) — no such
  connector exists; the channel abstraction is in place but only web + link
  handoff is live. No channel is claimed "connected" unless its connector
  reports configured.
- **Tuma live** — the payment rail works through the test adapter; a real
  Tuma request/webhook has not run (no sandbox exists).
- **QR rendering** — entry links are produced; a QR bitmap is not yet drawn.
- **AI assistance** — deliberately not built; the seam (footsteps + search +
  resolution) is where a future summarizer would attach.
- **Automation engine** — composable primitives exist (footsteps are emitted
  from real events); no rule engine is wired.

## Deployment requirements

- `HANDOFF_SECRET` (server-side; required in production).
- Tuma env vars unchanged from the prior migration: `TUMA_EMAIL`,
  `TUMA_API_KEY`, `TUMA_WEBHOOK_SECRET`, `BRIEF_PUBLIC_ORIGIN`.
- `node scripts/demo-vault.mjs` for the deterministic demo.
