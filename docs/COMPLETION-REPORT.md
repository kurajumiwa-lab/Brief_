# Brief × Tikiti — Completion Report

Date: 2026-08-29. Scope: the entire remaining program — the repository-wide
completion audit's findings (F1–F11) and the Tikiti merge (T1–T10) — closed,
committed, and re-verified end to end. Every number below was produced by
running the thing today.

---

## 1. Final baseline (all green)

| Check | Result |
|---|---|
| `server/test/run.js` | **1875 passed · 0 failed · 1 skipped** |
| `server/test/livecamp.mjs` | **111 passed · 0 failed** |
| `./run-suites.sh` (37 client suites, incl. new `admin`) | **1318 passed · 0 failed** |
| `tc` strict typecheck | **0 errors** |
| `npm run build:client` (vite production build) | **clean, 4.3s** |
| Live HTTP, production build + proxy (`live/`) | **43/0 · 27/0 · 82/0 · 16/0 · 26/0-with-writes** |
| New `live/6-completion-walk.mjs` | **35/0** |

The live phases run against `NODE_ENV=production` on `:8787` through the
preview proxy (`:4173/ingest`), i.e. the exact path a browser takes. The
startup note is honest: *no payment provider configured: Brief cannot collect
or disburse money* — and nothing in the product pretends otherwise.

## 2. What the completion walk walked (live/6, new)

One script, real identities, no fixtures: a capture is **confirmed by a
stranger and its contributor is notified and reads it in Pulse** (the whole
F2/F3 rail); the **T6 verification loop** runs submit → capability-refused
queue → reasonless-rejection-refused → reasoned approval → derived standing →
reasoned revocation; the **T7 email list** runs double opt-in with the token
returned honestly (no provider), confirm, idempotent resubscribe,
account-free unsubscribe, retired-token refusal; **T4/T5** public surfaces
(categories, events shape, seeded clubs, catalog provenance `source`,
kickoff-honest competition creation, derived lobby state, public standings);
the **F4 desk** is refused to a plain user by capability and answers an
operator across diagnostics, disputes, listings, the audit trail (carrying
that very walk) and the delivery log.

## 3. Defects the walk found, and their fixes (this batch)

A green suite is not a walked product; the walk caught three real gaps:

1. **The capture→confirmation notification rail was dead.** `/api/brief-it/save`
   promised attribution "via `capturedBy`" but never stamped it, so the
   `confirmed` notification in `objects.js` found nobody to notify (manual
   captures entered through a shared source with many members). Fixed: the
   save route stamps `capturedBy` on objects it creates — which also tightens
   the capturer-governs rule to the true capturer. Regression-tested in
   `run.js`.
2. **A retired confirmation token could resurrect a left email list.**
   Confirming with the old token after unsubscribing silently re-confirmed a
   subscription the person had opted out of. Fixed: unsubscribed rows refuse
   their tokens (`token_retired` → 404); rejoining goes through `subscribe()`,
   which restarts double opt-in with a fresh token. Regression-tested.
3. Two walk-script bugs (first-confirm is 201; EPL competitions require a
   real `kickoffAt` and expose `lobbyState` derived-on-read, never stored) —
   fixed in the script, which is the point of a walk that argues back.

## 4. Program close-out (commits)

| Item | Deliverable | Commit |
|---|---|---|
| T1 resale market (server + 3 surfaces) | `e9d7571` (+`f370e65`) | done |
| T2 bargains / T3 pots (server) | `b594cba` | done |
| T2/T3 client UI | Batch C `9a198de` | done |
| T4 events / T5 EPL (server) | `8d3213d` | done |
| T4/T5 client UI | Batch D `3067be6` | done |
| T6/T7 client UI (Verify panel, Email lists) | Batch E `35e0b1a` | done |
| F2+F3 Pulse, fifth destination, change-first | `8574500` | done |
| F4+T8 operator desk | `12b2b2c` | done |
| F5/F6/F7 removals + half-loop wiring | `498aa13` `94d4d89` `a7f34bc` | done |
| T9 payments | resolved as Brief's provider truth: registry (`tuma`), real Daraja connector on the huduma rail, no mock provider, 503 `charged:false` when unconfigured (§17) — no sandbox-simulated success ported, deliberately | by design |
| T10 security | listing fraud screen (`b594cba`), verified webhooks with recorded rejects, capability-gated + audited operator surface (F1) | done |
| Docs | `INTEGRATION-TIKITI.md` progress synced; `COMPLETION-AUDIT.md` close-out table | this batch |

## 5. Honest limitations (standing, stated, not hidden)

* **No payment provider is configured.** Every money path refuses honestly
  (503 `charged:false`; settlement requires a genuinely settled ledger row).
  Adding a provider is a connector + credentials, not a product change.
* **No email provider.** List subscriptions complete double opt-in by
  returning the token to the subscriber; the delivery log records
  `skipped_no_provider`, never "sent".
* **EPL data is seed-tagged** (`source: 'seed'`); the licensed-provider sync
  answers 503 until a provider key exists. No invented match stats anywhere.
* **Notifications are in-app only**; the push rail (FCM/APNs) is deliberately
  not faked.
* **Single-host store** with atomic writes and rotating backups; ops backup is
  one audited click away on the desk.

## 6. §-mapping for the handoff

Five destinations exactly (§2) with Pulse restored (§20) · App.tsx
authoritative, `sync.sh` mirrors (§3) · `fetch()` only in `briefApi.ts` (§4,
re-swept) · audit executed and closed (§5) · one-object-one-truth with
provenance (§9) · no ladder chrome in My Layer (§10) · ledger as the only
economic truth, server-side pricing, settle-on-settled (§16) · honest refusal
everywhere (§27) · compliance gates Kenya, no gambling, no account-selling
(§15/§25) · operator surface capability-gated and audited (§21–24, F1/F4).
