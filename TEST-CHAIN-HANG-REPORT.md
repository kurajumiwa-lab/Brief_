# Test-Chain Hang Report — the ref'd reconciler timer that stopped `npm test`

Found 2026-09-21 while verifying the tree at `f152985` (the merge of PR #18) in a
fresh sandbox. Every number below is recomputable by running the commands named
beside it.

## The symptom

`npm test` — the repo's headline server command, a `&&` chain of **70 files** —
never finished. It stalled at file **11 of 70** (`test/requests.mjs`), which
printed `PASSED 30 FAILED 0` in ~600ms and then sat alive. Observed alive
**632 seconds** before it was killed; it would have sat for an hour.

Files 12–70 never ran. That is 59 files, including the whole Request-to-Work
spine (supply, matching, quotes, workOrders), the table-banking suite, and the
settlement rail's own tests.

## The cause

Two mistakes, either of which alone would have been survivable:

1. `server/src/settlement/reconciler.js` — `start()` installed an hourly
   `setInterval` and did **not** unref it. A ref'd timer holds the process open
   for its full interval.
2. `server/src/index.js:303` — `startSettlementReconciler()` was called at
   **module scope**, outside the `if (process.env.NODE_ENV !== 'test')` guard at
   line 425 that installs every other sweep.

So importing the app under `NODE_ENV=test` armed an hourly timer, and any
process that imported the app could not exit until it fired.

**Provenance:** introduced by `3868541` ("feat: the manual settlement rail —
queue, confirm, reconcile"), the one piece of product code shipped in PR #18.
`git show ef3fc27:server/src/index.js | grep reconciler` returns nothing — the
call did not exist before that commit.

**Blast radius, measured** (`bash /tmp/survey.sh` — each of the 70 files run
alone under `timeout 30`): **18 of 70 hung.** All 18 import `src/index.js`
exactly once; none of the 52 that exit do. The correlation is exact.

```
11 requests  12 supply  13 matching  14 quotes  15 workOrders  16 listingEdits
17 procurement  18 participantTrust  19 workPayment  20 attribution  21 partner
22 fieldAgent  23 lipaMdogo  34 guardians  56 shopBrief  57 plannedWeather
59 errandKinds  61 spacePublicPage
```

**Handle introspection** (import the app under test env, then print active
resources) named the culprit directly — one extra resource, a `Timeout`:

```
resources: ["PipeWrap","PipeWrap","Timeout"]
```

The tree already knew this law. Five other sweeps unref their timers
(`domain/calendar.js:218`, `domain/workflow.js:201`, `domain/shopBrief.js:664`,
`ops.js:246`, `pipeline/scheduler.js:167`) and all five are installed inside the
`NODE_ENV !== 'test'` guard. `scheduler.js:159` even states the rule in prose:
*"index.js only installs outside NODE_ENV=test, unref'd so it never holds the
process open."* The reconciler was the only sweep that broke both halves.

**Two red herrings, named so nobody re-walks them:** `test/quotes.mjs:789` and
`test/workOrders.mjs:847` already call `server.closeAllConnections()` — an
earlier fix for a *different* exit bug (undici keep-alive sockets), and not the
cause here; both files hung anyway. A minimal repro (three `fetch` calls against
an ephemeral `http` server, then `srv.close()`) exits in 186ms, so the client
socket was never the problem.

## Files changed

| File | Change |
|---|---|
| `server/src/settlement/reconciler.js` | `timer.unref?.()` after the hourly `setInterval`, with the five precedents cited in the comment. |
| `server/src/index.js` | `startSettlementReconciler()` moved out of module scope into the `NODE_ENV !== 'test'` block, beside the other five sweeps; the old call site keeps a pointer comment so the omission reads as a decision. |
| `server/test/settlement/manual.mjs` | One new check: a fresh child process imports `src/index.js` under `NODE_ENV=test` and must exit on its own within 20s. |

The regression check lives in the rail's own test because the rail is what
broke, and it is written end-to-end rather than as a unit assertion on the
timer: if a ref'd sweep ever returns — this one or a new one — the probe hangs
and the check fails with the reason printed.

**The check was proven against the defect**, not just against the fix: with the
two source edits temporarily reverted, it reported

```
FAIL  a process that imports the app exits on its own
      -> still alive after 20s (killed by SIGTERM) — a ref'd sweep timer is
         holding the process open
PASSED 43   FAILED 1
```

and with the fix in place it passes. `test/settlement/manual.mjs` now runs
**44 checks, 0 failures** (was 43).

## Verification after the fix

| Command | Result |
|---|---|
| `npm test` (all 70 files, one chain) | **exit 0**, completes end to end; rail test `PASSED 44 FAILED 0` |
| each of the 18 previously-hanging files, run alone | **18/18 exit 0** (requests 30, supply 46, matching 43, quotes 53, workOrders 44, listingEdits 13, guardians 16, shopBrief 31, plannedWeather 9, errandKinds 8, spacePublicPage 28, and the seven that print no summary) |
| app-import control (`NODE_ENV=test`, import `src/index.js`) | **308ms**, was killed at 15s+ |
| `./run-suites.sh` (88 client suites) | **2095 passed / 0 failed — RESULT: GREEN** |
| `npm run test:typecheck` | **exit 0** |
| production boot (`PORT=8791`, no `NODE_ENV`) | `server_started` logged, `frontend_serving: true`, `GET /api/capabilities` → **200**; the reconciler still installs, now beside the other sweeps |

One environment note, since it reads as a code failure and is not:
`./run-suites.sh` on a fresh sandbox first reported **2077 passed / 0 failed,
CRASHED SUITES: dukabook, RESULT: NOT GREEN**. The crash was
`ENOENT: preview/dist/index.html` — that suite reads the built shell, and no
build existed yet. After `npm run build:client`, dukabook passes **18 / 0** and
the total is the 2095 above. Nothing in the tree changed between the two runs.

## One thing recorded, not explained

A single `npm test` run inside the fix window died once on a bare
`AssertionError [ERR_ASSERTION]`, positioned in the chain after
`test/errandKinds.mjs` — which puts it in `test/spaceAudience.mjs` or
`test/spacePublicPage.mjs`. It has not reproduced: two clean full-chain runs
after it, plus **8 consecutive clean runs of each suspect file** (24 runs, 0
failures). No test in the chain binds a fixed port, no stray processes were
left, and `git status` is clean apart from the three intended edits. It is
written down here rather than quietly dropped: if it returns, the window above
is where to look first.

## What this means for the record

PR #18's ledger reports suite runs per record, and those runs were real — but
they were single files, and single files are exactly the shape that hides this
bug: each of the 18 hangs *after* printing its own green summary. The chain
that would have caught it stops at the first one. `npm test` has not been
runnable to completion since `3868541` landed, roughly nine hours before this
report.
