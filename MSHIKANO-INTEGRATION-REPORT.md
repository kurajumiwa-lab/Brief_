# Mshikano — Integration Report

Date: 2026-08-29. Commit `c18ac63` (+ this report). Status vocabulary used
strictly: 🟢 BUILT · 🟡 PARTIAL · 🟠 CAPTURED, NOT BUILT · 🔴 MISSING / BROKEN.

Mshikano is the member-to-member cooperation network: a Kenyan, peer-to-peer
layer where the unit is the **relationship**, not the profile, the listing or
the rating. It was built inside Brief as a new capability of the existing
repository — no new app, no new update — by extending the bootstrap that was
already there and building where it fell short.

---

## 1. The anchors, and where each one lives

| Anchor | Status | Evidence |
|---|---|---|
| Four intents: have / need / can help / looking for | 🟢 | `server/src/domain/coop.js` `INTENTS`; unknown intent → 400 (server suite + live 8) |
| The unit is the relationship | 🟢 | A cooperation row is `pending` until the **named partner** responds; only `confirmed` rows reach the graph, trust and recommendations |
| Trust = confirmed cooperation evidence, never stars | 🟢 | `trustFor()` counts confirmed cooperations, repeat partners, recommendations, identity verification, disputes; `levelWords` says the level in words; the string "star" appears nowhere in the payload (asserted live) |
| "Who can help?" is the killer feature | 🟢 | `GET /api/mshikano/who-can-help?q=…` groups answers into people / businesses / guides / groups, with counts |
| Honest empties — an empty platform is not fabricated full | 🟢 | `groups` is `[]` with `counts.groups: 0` until real groups exist (asserted live); no seed rows, no invented cooperation history |
| North star: confirmed cooperations per month | 🟢 | The graph totals count confirmed rows only — the number the product optimises for is the one the system counts |
| Corridor strategy (county/town) | 🟢 | Posts carry `county`/`town`; match reasons add +8 same county, +6 same town |
| Nothing without an account | 🟢 | Every `/api/mshikano/*` route sits behind `requireAuth`; anonymous gets 401 (asserted for posts, graph and who-can-help, live, through the production proxy) |

## 2. What was built

**Server (authoritative).** `server/src/domain/coop.js` (17th domain module):
post creation with intent validation, complement-only matching (`HAVE↔NEED`,
`CAN_HELP↔LOOKING_FOR`) with human-readable reasons (shared tokens +4, same
county +8, same town +6, recency ≤6), cooperation propose/respond (only the
named partner can respond; the proposer cannot self-confirm; anyone else gets
403), recommendations (only after a confirmed cooperation, once per side,
carried on the cooperation row), the cooperation graph (helped / received /
repeat partners), trust as counted evidence, and who-can-help. Routes in
`server/src/routes/coop.js`, mounted in `server/src/index.js`. Two collections
declared in the store's EMPTY: `coopPosts`, `coopPartnerships`.

**Client.** `src/components/MshikanoDesk.tsx`: the four-intent composer, an
intent-filtered feed, a matches drawer that shows *why* each match matched,
the propose/confirm flow whose copy states the rule ("counts only after THEIR
confirmation"), trust chips that show evidence counts, "Who can help?" and the
cooperation graph. Typed API functions with explicit validators in
`src/api/briefApi.ts` (no `as never`, no type inference from return shapes).
Navigation: filed under **Nearby** per the five-destination rule — the seventh
door on the main shelf (`COOPERATE`), wired through `routes.ts`, `App.tsx`,
`MainShelf.tsx`, `MenuSheet.tsx`, and `alerts.ts` routes `coop` alerts to
Nearby.

## 3. Verification — all numbers measured 2026-08-29

| Layer | Result |
|---|---|
| `server/test/run.js` (MSHIKANO block: gate, intents, complement reasons, outsider 403, two-sided confirm, trust, dedup, graph, who-can-help) | 1907 passed / 0 failed / 1 skipped |
| `preview/mshikano.jsx` (jsdom, real component, mocked fetch) | 16 / 0 |
| `preview/nav.jsx` (seven shelf doors) | 93 / 0 |
| `./run-suites.sh` (38 client suites) | 1321 / 0 GREEN |
| `tc` strict typecheck | exit 0 |
| Production build | ✓, bundle contains the desk |
| `live/8-mshikano.mjs` — over HTTP through the production proxy, two real identities plus an outsider | **26 / 0** |

Live phase 8 proves the whole spine with real tokens: anonymous 401s →
registration of Anne (Makueni) and Brian (Nairobi) → intent validation →
HAVE/NEED posts → complement match with reasons → mutuality of matches →
who-can-help with honest groups → proposal → outsider 403, self-confirm 403,
named partner confirms → evidence counted, level `cooperating`, no stars →
graph totals one confirmed link and names the partner → recommendation
allowed once, refused the second time.

A registration bug was found and fixed while measuring: `mshikano` had been
added to `run-suites.sh`'s suite list twice, double-counting its 16 checks.
The list is deduped (38 suites) and every number above is from after the fix.

## 4. Honest gaps (known, stated, not hidden)

| Gap | Status | Note |
|---|---|---|
| Groups in who-can-help | 🟠 | Honestly empty until real groups exist; either group matching gets built or the gap stays visible |
| Capability parity (collections `:key/:action`) | 🟢 | Closed 2026-08-29: publish/unpublish/archive now require the `moderate` capability and are audited with before/after status; plain member 403 `forbidden_capability` proven in the suite and against the production build |
| Business model | 🟠 | Deliberately none — no fees, no cut, no pay-to-be-seen. Deferred by decision, not by omission |
| Trust disputes | 🟡 | Counted in evidence (`disputed` partnerships) but no dispute-filing flow yet |
| Guides in who-can-help | 🟡 | Sourced from published tea articles — real, but not cooperation-specific knowledge |

## 5. How to verify

```bash
cd server && node test/run.js        # MSHIKANO block included
./run-suites.sh mshikano             # client suite
node live/8-mshikano.mjs             # needs :8787 (production) + :4173 preview
```
