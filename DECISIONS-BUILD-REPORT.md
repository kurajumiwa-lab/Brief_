# Decisions build report — series audit, and Decision 5 built end to end

Branch `arena/01a0c209-brief`. Source of spec: `docs/DECISIONS.md` (9 decisions + 3 corrections).
Every status below was obtained by grepping the tree, not by reading the decision back to itself.

## Part 1 — audit of the nine decisions and three corrections

| # | Decision | Status in the tree | Evidence |
|---|----------|-------------------|----------|
| D1 | Reviews aggregate: real orders only, ★ on shop public pages, shown after 5 | **absent** | no reviews domain/route/suite anywhere; `server/src/domain/guardians.js:383` — "Brief holds no review rows". Shop public pages carry no rating (`preview/shopbrief.jsx` asserts the public shop surface and has no rating in it). *An earlier revision of this row cited a `vendorPublic.js` that does not exist anywhere in the tree; the citation is removed rather than replaced with another guess.* |
| D2 | ID & documents: one file per shop, ≤8 MB, `.pdf`/`.jpeg`/`.png` only, front-only, camera metadata, deleted within 90 days | **contradicted / absent** | `server/src/domain/upload.js:87-103` accepts `webp`, `gif`, `image/*` (a wildcard that admits more than the decision names), no PDF, no camera-metadata requirement, no front-only rule, no 90-day deletion. `docs/MVP-SCOPE.md:107` still says "ID verification stays manual" — that line needs updating when D2 is built. |
| D3 | Phone number as account identifier + verification (WhatsApp or code) | **absent** | `server/src/domain/auth.js` identity is handle + email (+ phone as an optional contact field on the vendor); `routes/auth.js` has no phone-identity or OTP path. |
| D4 | Speech-to-text = Whisper | **absent, and blocked** | no STT provider in the tree; `routes/workflows.js` carries the WhatsApp inbound rail but no transcription step. Gated on the inbound rail, which is outside this event. |
| D5 | Field agents: KES 150 flat per **approved** visit, paid weekly; no bonus, tier, speed or quality | **BUILT this session** | see Part 2. |
| D6 | Events: `startsAt` ascending, opt-in give-only interest, no featured/promoted/social-proof | **BUILT server-side** (`6dc1d4f` + follow-up); client surfaces still pending |
| D7 | Drawer = settings only | **contradicted** | `preview/src/components/MenuSheet.tsx:243-250` an `EXPLORE` array of seven navigation/marketing entries (Nearby, Saved, Events, Communities, Marketplace, Mshikano, WhatsApp Shop) plus `:278` a `QUICK` array. |
| D8 | `/g/<handle>` public cooperative page | **absent** | no `/g/` route in `server/src` or `preview/src`. |
| D9 | `cooperative` internal / group's own word external / `/c/` = Trace Card | **partly standing, with a namespace collision** | `coop.js` external word is Mshikano ✓, but `coopOperations.js`, `lipaMdogo.js` and `partner.js` still use "cooperative" in member-facing copy. **Collision:** `/c/:slug` is already taken by *campaign* public slugs (`server/src/index.js:331`, `routes/distribution.js:33`, `routes/health.js:133`), so D9's `/c/<slug>` Trace Card cannot be built until campaigns move off that prefix. Flagging rather than guessing. |
| Corr A | No cooperative wallet on Brief | **holds** | `grep -rn "cooperativeWallet\|coopWallet" server/src` → nothing. |
| Corr B | Member-to-member loans tracked, held elsewhere | **holds / already built** | `server/src/domain/tableBanking.js:311` `loanSchedule()`, `:170` archive refused while a loan is outstanding; `:12` states Brief does not hold the money. |
| Corr C | Minimum 5 / maximum 5000 member tiers, SASRA where applicable | **absent** | no member-count gate in `coopOperations.js` (grep for `MIN_`, `minimum`, `5000`, `SASRA` → nothing). |

Suggested build order for what remains: **D6** (smallest, deletes invented machinery) → **D1** → **D2** → **D9 + D8** (together, because the `/c/` collision has to be resolved in the same move) → **D7** → **D3** → **Corr C** → **D4** (last, gated on the inbound rail).

## Part 2 — Decision 5, built

The tree previously paid field agents **0.75% of a claimed shop's settled revenue for 24 months**.
Decision 5 ends that: a field agent does a job, an operator approves it, the agent is paid
**KES 150 per approved visit**, settled **weekly**. No bonus, no tier, no speed or quality modifier.

### Server

| File | Change |
|------|--------|
| `domain/fieldAgent.js` | rewritten as the visit economy. One visit = one job, recorded with the agent's own notes; ops approves or rejects it; **only an approved visit carries money** (a rejected visit keeps its `rejectReason` so the agent learns what was wrong; a pending visit carries KES 0 and is labelled *waiting*). Money lands in the ISO week of the **approval** date (`isoWeekOf`), not the visit date, so a visit approved across a week boundary is paid in the week it was decided. `agentEarnings` prints the count and `count × 150` beside the total so the agent can check the arithmetic. `settleWeek` requires finance, refuses an empty or already-settled week, and writes a ledger row — it moves nothing itself. `fieldAgentOverview` = `{ claims, visits, earnings, settlements }`. Retired: `TERRITORY_RATE`, `TERRITORY_WINDOW_MONTHS`, `vendorTerritory`, `overrideStatus`, `territoryObligation`. The old `fieldAgentClaims` rows stay as the audit trail of what was claimed. |
| `domain/position.js` | the DECAY 3 "field agent override" window is **deleted**, not widened: no override field on decay, no `expiresAt` clamp. Position is now honest by default for everyone — decay stops at the `never` floor (30 days) and a shop that has not logged in for 30+ days stops decaying. |
| `routes/fieldAgent.js` | rewritten. Member: `POST /api/me/field-agent/visits` (201), `GET /api/me/field-agent` (visits + earnings + settlement history). Ops: `approve` / `reject` per visit. Finance: `POST /api/me/field-agent/settle { week }`. |
| `store.js` | added `fieldVisits`; `pickupFeeSettlements` kept as **history only**. |
| `domain/pickups.js` | the per-pickup origin fee is gone: `ORIGIN_FEE_PER_PICKUP_KES`, `myPickupOriginFee`, `settlePickupOriginFee`, `pickupOriginFeeLedger` and `originFeeKes`/`settledAt` on the logistics row all deleted. **Kept:** origin bookkeeping, `originAgentId` attribution and the delivered count — the agent still earns for visiting the shop, which is where D5 puts the money. `pickupOriginStats` is a count with an explicit `currency: null` so no caller can read KES out of it. |
| `routes/pickups.js` | `GET /api/me/pickup-origin-fee` → `GET /api/me/pickup-origins` (count only). `POST /api/me/pickup-fee/settle` and `GET /api/me/pickup-fee/settlements` deleted (404); `GET /api/me/pickup-fee/settlements` remains as a finance-gated **history** read. The old `PUT /api/me/pickups/:id` and `GET /api/me/pickup-fees` stubs are gone too, so no retired route keeps returning `ok`. |

### Client

| File | Change |
|------|--------|
| `api/briefApi.ts` | `FieldAgentVisitRow` / `FieldAgentVisit` / `FieldAgentWeek` / `FieldAgentEarnings` replace `FieldAgentOverride`; `recordFieldVisit`, `settleFieldAgentWeek`; `onboardVendor` returns the created visit; `PickupOriginStats` + `getMyPickupOriginStats` replace `PickupOriginObligation`/`getMyPickupOriginFee`; `PickupFeeSettlement` documented as history-only; `override` dropped from `MyPosition['decay']`. |
| `features/you/EarnSurface.tsx` | the "Territory" block is now **Field visits**: KES earned from approved visits (with `count × 150` printed beside it), every visit with its own status — approved shows the fee, pending says *waiting on ops (pays nothing until approved)*, rejected shows the reason — plus the shop contact the agent can call or WhatsApp. Below it, the payout weeks with a per-week settle state and the rule in words. Claim/onboard notices and the "How you earn" bullet now say *visit, get it approved, KES 150*. |
| `features/home/EarnStrip.tsx` | "Territory" rail → "Field visits", showing the approved count and KES. |
| `features/home/PositionCard.tsx` | the 24-month override line deleted. Position now states what decay actually is. |
| `features/city/WairoDispatchPanel.tsx` | the "Your origin fee" card → "Deliveries from your shops" (a count); any pre-Decision-5 settlement renders as **History:** … "old per-pickup fee", never as current pay. |

### Suites

`earnsurface.jsx`, `homezones.jsx`, `wairodispatch.jsx`, `cityfeed.jsx` moved to the visit contract.
New assertions state the invariant in words — e.g. *"and a pending visit is named as waiting, not as
money"*, *"no rate, no window, and no share of the shop's trade survives in the copy"*, *"every KES
figure left is labelled history"*. `server/test/fieldAgent.mjs`, `pickups.mjs` and `position.mjs`
were rewritten with the retired routes asserted to 404.

## Part 3 — verification

Numbers as of `3eaa9ff`, after the runner fix in Part 4. The figures this section
carried before that fix were wrong, and the correction is recorded rather than
quietly overwritten.

- **Server chain** `npm test`: exit **0**. 70 invocations = `test/run.js` plus **69 `.mjs` files**;
  every one of the 69 also exits **0** when run individually, so nothing depends on chain order.
- **Real assertions: 1356** — 738 named `PASS <test>` lines across the `test()`-style files, plus
  618 `check()`-style checks across the other ten.
- **Client suites** `./run-suites.sh`: **2095 passed / 0 failed** across 88 suites — `RESULT: GREEN`.
- **Typecheck** `npm run test:typecheck`: exit **0**.
- Decision-5 files: `fieldAgent.mjs` 25 PASS, `pickups.mjs` 13 PASS, `position.mjs` 7 PASS.

> **Correction to an earlier claim in this file.** It previously reported "3505 PASS lines".
> That number came from `grep -cE "^PASS|PASS "`, which also matches the word PASS *inside test
> names and comments* — it counted prose, not assertions. The defensible figure is 1356, counted
> by excluding each file's `PASS <count>` summary line. It also reported "70 files" where the
> chain is 69 `.mjs` files plus `run.js`.

> **The client 2095/0 was never affected by the runner bug.** It is a different mechanism: client
> suites use `pass(n)` (an explicit marker called *after* the assertions, so there is no callback
> whose promise can be discarded) and eager `check(n, c, d)`; no client suite registers an async
> callback with a non-awaiting helper. `run-suites.sh` also decides green by parsing each suite's
> printed totals *and* detecting a crashed suite, so a suite that dies mid-run cannot score
> "0 passed / 0 failed". The number stands as a fact, not a claim.

## Part 4 — the runner honesty bug: found, then fixed (`3eaa9ff`)

> **This section was originally a warning about work not yet done, and it was wrong in its
> specifics.** It named `server/src/domain/testRunner.js` — **no such file exists.** Every test
> file carries its own private helper. It named 13 files, and nine of those (`city.mjs`,
> `communities.mjs`, `coop.mjs`, `coopOperations.mjs`, `guardians.mjs`, `health.mjs`, `index.mjs`,
> `inbox.mjs`, `nearby.mjs`, `uploads.mjs`, `vendors.mjs`) **are not in the `npm test` chain at
> all** — `guardians.mjs` is, and it was already correct. Recorded here because a wrong audit is
> worse than none: it sends the next reader to files that don't matter.

Two separate bugs, both the same class — a suite that reports green without having checked anything.

### Bug 1 — the helper discarded the callback's promise (16 files)

Each of these carried a private copy of the same three lines:

```js
let count = 0;
const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };
...
console.log(`\nPASS ${count}`);
process.exit(0);
```

`fn()` was called and its return value thrown away. A test written as
`test("API: ...", async () => {...})` printed PASS immediately, ran its body only as far as the
first `await`, and had every remaining assertion killed by `process.exit(0)`. Those assertions
could not fail. Because `npm test` is an `&&` chain, the whole suite reported green. **Every HTTP
test in those 16 files was in that state — the routes were asserted by nothing.**

The 16: `tableBankingWelfare`, `tableBankingMinutes`, `tableBankingTemplates`, `tableBankingInvites`,
`tableBankingArchive`, `tableBankingTreasurer`, `quoteVotes`, `minutesPdf`, `spaceLifecycle`,
`pickups`, `invites`, `gaps`, `priceSignals`, `position`, `commitments`, `reciprocity`.

Reproduced rather than inferred. A probe carrying a deliberately **false** assertion after an
`await`, in the old shape:

```
PASS API: an assertion that is FALSE, after an await
PASS 1
exit=0
```

The same test through the new harness: `FAIL`, `exit=1`.

**The fix** is `server/test/harness.mjs`. `test()` registers; `run()` executes the registered
entries in order, awaits each, prints the same summary these files always printed, and exits 1 on
failure. Sequential rather than parallel because these tests share one in-memory store and bind one
port. `step()` carries ordered setup that asserts nothing, so `position.mjs`'s interleaved match
fixture keeps its place in the sequence without being counted as a passing test. The output format
is unchanged, so nothing that reads these logs had to be rewritten; the additions are `FAIL` lines
and an exit code.

### Bug 2 — `check()` counted failures but never failed the process (9 files)

`discovery`, `feed-experience`, `trust`, `personal`, `entities`, `graph`, `collections`,
`notifications` and `settlement/manual` all had

```js
else { fail++; console.log(`  FAIL  ${name}...`); }
```

with no `process.exitCode`. A failing check printed FAIL and the process still exited 0.
`spaces.mjs` was the only one wired correctly; that pattern is now in all ten. All 618 of their
checks pass today, so this closed a hole rather than exposing a live failure — but it was a hole.

All ten also now **refuse a Promise as a condition**: a Promise is truthy whatever it resolves to,
so `check('x', someAsyncCall())` would have printed PASS no matter what happened.

### What the fix immediately exposed

1. **A real product bug** — `src/routes/tableBanking.js` substituted route-level defaults for
   omitted fields (`cycleDays ?? 30`, `latePenaltyKes ?? 0`, `welfareContributionAmount ?? 0`).
   `createTableBanking` resolves `field ?? template.default ?? fallback`, so those values made the
   client's *silence* look like an explicit *choice* and discarded the template. A group created
   from `table_banking` over HTTP came out with no late penalty; one created from `welfare_first`
   came out with **no welfare pot — the single thing that template exists to earmark.** Members got
   a group that looked created but was not the group they picked. Fixed by passing omitted fields
   through as `undefined`; both halves are now asserted over the wire (template default survives,
   explicit field still wins). This bug was invisible for as long as the test that covered it could
   not fail.
2. **A test bug** — `minutesPdf.mjs`'s `call()` returned only raw text, so the register step read
   `.body` off a response that never carried one and threw a TypeError that the discarded promise
   swallowed.
3. **A contract question, unresolved** — `GET /api/table-banking/templates` is written as public
   (`(_req, res)`, no `requireAuth`) but the global gate at `index.js:213` answers first and
   `PUBLIC_WITHOUT_SESSION` does not list it, so no anonymous caller can reach it. Asserted as 401,
   pinning what the product actually does, rather than widening the anonymous surface unilaterally.
   **Operator decision wanted.**

### The standing rule this establishes

> A test that cannot fail is not a test; it is a comfort. **Every decision is enforced by a test
> that fails if the thing comes back.** A decision recorded in a doc is not enforced. Write the
> refusal test first, watch it fail, then change the code until it passes.
