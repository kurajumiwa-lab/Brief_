# Tikiti → Brief Integration Plan

**Decision (user, 2026-08-28):** Tikiti — the standalone Next.js/Postgres
platform built earlier (`/home/user/tikiti`, 42 Prisma models, vitest green) —
is merged **into Brief** as the product going forward. Everything Tikiti does
that Brief lacks is ported **in Brief's idiom**, under Brief's rules. Tikiti's
repo stays as reference; no code is copied blindly — invariants and semantics
are ported, not frameworks.

## Governing rules (from the Brief handoff — non-negotiable)

- §2 exactly five destinations (Nearby / Arena / My Layer / Workflows / Pulse).
  Tikiti features land under existing destinations' secondary nav. No sixth.
- §3 `App.tsx` authoritative; `sync.sh` refreshes `preview/src` + `tc/src`.
- §4 `fetch()` only in `src/api/briefApi.ts`.
- §9 one real-world thing = one canonical object; provenance retained; no
  invented facts.
- §16 `ledgerTransactions` is the only economic truth. No wallet columns.
  Server-side pricing only. Settlement requires genuinely settled ledger rows.
- §17 no fake payments: honest 503 `charged:false` until a provider exists.
- §15/§25 compliance gates Kenya (KYC/AML/DPA); no gambling without licensing;
  account-selling only where ToS/law permit — otherwise compliant alternative.
- §27 honest refusal over fake success. Every loop walks end to end.

## Feature map: what Brief already has vs. what Tikiti adds

| Tikiti area | Brief today | Gap to close |
|---|---|---|
| P2P ticket resale (list/transfer/QR/refund/dispute) | Campaigns issue one-time gate codes + check-in; **no resale** | **T1 — full resale marketplace** |
| Group bargains (tiered price, countdown, caps) | `groupBuys` = pooled money toward a target; **no price tiers** | **T2 — tier mechanics + expiry** |
| Contribution pots (anonymous, deadline, updates) | Circles + campaigns + ledger contributions | **T3 — anonymity/deadline/updates/progress semantics** |
| Events hub (categories, featured, search) | Campaigns + calendar + discovery/search | **T4 — event browsing consolidation** |
| EPL fantasy (catalog, squad rules, gameweeks, waiting rooms) | `fantasy.js` (pick 11, captain, server-clock lock, scoring) + `ligiGameweeks` | **T5 — EPL catalog/budget/club rules/gameweeks/lobby states/licensed-provider interface** |
| User verification / KYC | Compliance gates (five unmet requirements) | **T6 — verification records + review queue** |
| Email subscriptions | Creator-plan subscribers only | **T7 — topic subscriptions, verify/unsubscribe, delivery log** |
| Admin dashboard | F4 (P2) planned; ops API exists | **T8 — admin surface absorbs Tikiti's admin loops** |
| Payments (M-Pesa Daraja / Stripe sandbox) | Tuma provider abstraction (unconfigured) | **T9 — provider adapters + webhook signatures behind Brief's payment domain** |
| Security | F1 done (capabilities, audit, test isolation) | **T10 — webhook signature verification, fraud flags** |

## Phase order (user chose: everything, Tikiti-brief order), interleaved with Brief's F-phases

- **T1 Tickets** — `tickets`, `ticketListings`, `ticketOrders`,
  `ticketTransfers` collections; state machines; anti-fraud invariants
  (one active listing per ticket; `codeVersion` bump kills stale QR;
  transfer only by owner; settle only on settled ledger row; refund is a
  status; removal is a moderation act, audited). UI: Nearby → event context
  ("resale tickets"), Workflows → Sell ("Resale listings"), My Layer → Kept
  ("My tickets" with live QR + transfer history).
- **T2 Bargains** — tiers (participant bands → price), countdown expiry,
  min/max participants, tier-change signals, per-tier activation.
- **T3 Contributions** — anonymous option (identity kept server-side, display
  hashed), deadline/expiry, public/private, updates feed, honest progress
  from ledger rows only.
- **T4 Events** — categories/featured/search over campaigns+calendar; ticket
  types surfaced in context.
- **T5 Arena EPL** — player catalog (`source` field: seed vs provider, never
  invented), squad rules (budget, formation, club cap, bench, captain/vice),
  gameweek lock on server clock, competition lobby states
  (open/waiting/full/locked/running/done/cancelled), head-to-head + private
  leagues, licensed provider adapters (`api-football`/`football-data`),
  prize config behind compliance.
- **T6 Verification** — verification records (email/phone/identity; status;
  provider ref; review) feeding the existing compliance gates.
- **T7 Email subscriptions** — topic prefs, verified double opt-in,
  unsubscribe, delivery log; ties into F3 notifications.
- **T8 Admin** — F4's surface absorbs moderation of listings/disputes/
  bargains/contributions/account listings.
- **T9 Payments** — Daraja + Stripe sandbox adapters behind the tuma-style
  provider interface; webhook signature verification; reconciliation stays
  finance-capability.
- **T10 Security sweep** — fraud flags, rate limits, signature tests.

Cadence: one T-phase at a time, always leaving `run.js`, `run-suites.sh`,
`tc`, and the live suites green; alternate with Brief F-phases (F2 Pulse,
F3 notifications, F4 admin, F5–F7 removals) per the parallel-work decision.

## Progress

- [x] Plan agreed (target = merge into Brief; order = all, Tikiti-brief order; parallel with F-phases)
- [x] **T1 server** — `domain/ticketMarket.js` + `routes/ticketmarket.js` + 4 store
      collections + auto-issuance hooks (confirm-payment & registration promote)
      + version-aware gate (`/api/tickets/:code`/check-in honour `?v=`,
      stale/void codes refused 409/410) + 5 new signal types + moderation
      (remove/void, `moderate` cap, audited). 51 new checks in run.js:
      **1925/0/1**. Live suites re-verified green; production probe walked
      register→confirm→issue→list→buy→pay-503-honest→settle-refused→gate-200.
- [x] T1 client API layer — `briefApi.ts` bindings + types (§4 clean, tc green).
- [ ] T1 UI (Nearby event context "Resale tickets" / Workflows → Sell "Resale listings" / My Layer → Kept "My tickets" with live QR)
- [ ] T2 Bargains — tiered pricing + expiry + caps
- [ ] T3–T10 …
