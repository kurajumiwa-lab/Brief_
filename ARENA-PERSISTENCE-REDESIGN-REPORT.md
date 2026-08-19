# Brief — Arena rewire + persistence + visual redesign

Three directives executed in order. Everything is verified against the real
implementation and the test suite — no "looks good" claims.

---

## 1. Arena is now wired to its real backend

**Before:** the Arena UI rendered hardcoded fixtures (`ARENA_CHALLENGES` in
client `useState`); its only live call was the money-compliance gate. The real,
tested server Arena (`/api/arena/*`) was invisible to the user.

**Now:**
- `src/api/briefApi.ts` gained `getArenaGames`, `getArenaChallenges`,
  `createArenaChallenge`, `acceptArenaChallenge`, `cancelArenaChallenge`.
- Challenges **source from `GET /api/arena/challenges`** and are mapped onto the
  display model (`createdBy` → `createdByPlayerId`, etc.).
- **Accepting a challenge goes through the server** (`POST .../accept`), which
  creates the real, persisted match; the UI records that server match rather
  than fabricating one.
- `preview/arena.jsx` now serves real-shaped server data (64/64 green).

**Honest remainder:** Arena's *players, venues, tournaments, leaderboards,
game-identities and reliability scoring* are still client fixtures — the server
has no model for them. They are left as-is and flagged, not claimed real. Wiring
them would mean adding those models to the server (a product decision, not a
UI patch).

## 2. Persistence addressed (ephemeral store)

**The problem:** the JSON store lives on Railway's ephemeral filesystem, so data
(and seed) reset on every redeploy — the root cause of recurring "0 Objects".

**What I built (code, tested):**
- `ops.restoreLatestBackupIfEmpty` — on boot, if the data file is missing/empty
  but a snapshot exists, restore the newest one (never overwrites live data).
- `ops.installPeriodicBackup` — rolling snapshots on `BRIEF_BACKUP_INTERVAL_MS`
  (default 15 min), pruned to 14; off in tests.
- Wired both at server startup (alongside the existing graceful-shutdown backup).

**The durability guarantee (ops, documented):** `DEPLOYMENT.md` + `server/.env.example`
give the exact Railway step — attach a persistent volume and set
`BRIEF_DATA_DIR=/data`. Snapshots are crash-recovery; the **volume** is the
redeploy-survival guarantee. There is no code-only way to make an ephemeral
filesystem persist, so this is stated plainly rather than papered over.

## 3. Visual redesign (emotional category shift)

The biggest single lever: a **global palette swap** across 26 files, from
"neon-green-on-black cyberpunk" to "warm charcoal + soft green + cream":

| Before (cyberpunk) | After (warm) |
|---|---|
| `#00FF42` neon green (253 uses) | `#3E9A66` soft green |
| `#09150E` near-black green | `#191714` warm charcoal |
| `#E2ECE5` pale green-white | `#F2EFE7` cream |
| `#1E3A2A` / `#235F45` cold green borders | `#3B372B` / `#3F5544` warm |
| `#86935C` / `#5C6B52` olive | `#9A9278` / `#6F6A58` warm grey |
| `#8DCF74` light neon | `#7FA98B` soft green |

Plus copy: **"Nothing here yet" → "Nothing nearby right now"** (with a friendly
next-step hint), and **"Your Layer" → "Your saved things"**.

**Deferred (flagged, not done):** the full typography/copy pass — the "Good
afternoon 👋 / Nairobi CBD today" greeting card, nav rename ("My Layer" →
"Saved", "Workflows" → "Things you can get done"), and the all-caps → sentence
case sweep. The palette is the largest single step and is done; the copy layer
is the natural follow-on and touches copy that several client suites assert on.

---

## Verification

| Check | Result |
|---|---|
| Server suite (full, incl. live 3rd-party) | **1352 passed / 0 failed / 1 skipped** |
| Server suite (offline) | **1339 passed / 0 failed / 3 skipped** |
| Client suites (23) | **1105 passed / 0 failed** |
| Strict typecheck | **exit 0** |
| Production build | **succeeds** |
| Prod boot smoke | `/` 200 · `/api/health` 200 · `/api/arena/games` 200 |
| Arena suite (server-backed) | **64/64** |

## Files changed

- **Arena:** `src/api/briefApi.ts`, `App.tsx`, `preview/arena.jsx`
- **Persistence:** `server/src/ops.js`, `server/src/index.js`,
  `server/.env.example`, `server/test/run.js`, `DEPLOYMENT.md`
- **Redesign:** `App.tsx` + `src/components/**` (26 files, palette) + 2 copy edits
- All mirrored into `preview/src` and `tc/src`.

## What remains honestly deferred

1. **Arena's non-challenge simulation** (players/venues/tournaments/leaderboards)
   — needs server models, a product decision.
2. **Full copy/typography pass** (greeting card, nav renames, sentence case).
3. **Live payments** — Tuma credentials + a real request/webhook (no sandbox).
4. **Railway volume** — a one-time ops action (documented, not code).
