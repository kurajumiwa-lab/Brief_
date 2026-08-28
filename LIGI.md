# LIGI — African fantasy football

Ligi is an Arena game: fantasy football played over **real African competitions**,
with a **seasonal league** and a **week-streak league**, a **free** seat and a
**staking** overlay, and a lifecycle that runs **with no human input**.

It reuses Fantasy 11's scoring engine (`server/src/domain/fantasy.js`). There is
one scoring engine in this codebase and Ligi did not fork it: every Ligi
gameweek is backed by a real `fantasyCompetitions` row.

---

## 1. The competitions

Twelve real African competitions ship in `LEAGUES` — two continental (CAF
Champions League, CAF Confederation Cup) and ten domestic (Kenya, Tanzania,
Uganda, Nigeria, Ghana, South Africa, Egypt, Morocco, Algeria, Tunisia). A
season cannot be opened over anything else; `POST /api/ligi/seasons` rejects an
unknown league and returns the catalogue so the caller can see what exists.

Squads are **not** shipped. A gameweek's player pool is entered through the
Fantasy 11 pool routes, and a gameweek with fewer than eleven players **will not
open** — it waits, visibly, rather than opening onto an empty screen.

## 2. Scoring

Per-position, EPL-shaped, and unchanged from Fantasy 11:

| Event | GK | DEF | MID | FWD |
| --- | --- | --- | --- | --- |
| Goal | 6 | 6 | 5 | 4 |
| Assist | 3 | 3 | 3 | 3 |
| Clean sheet | 4 | 4 | 1 | 0 |
| 60+ minutes | 2 | 2 | 2 | 2 |

Plus saves, penalties saved/missed, cards, own goals and goals conceded. The
captain doubles. Eleven players, one captain, formation rules enforced server
side. `GET /api/ligi/rules` publishes every number, so a manager can recompute
their own week by hand.

## 3. The staking overlay

Each manager gets **100 staking units per gameweek**. Units **do not roll over**
and they are **not money** — no ledger row is ever written by this game. Three
ways to spend them:

| Mode | How it settles |
| --- | --- |
| `over_under` | 1:1 against the player's house line. |
| `spread` | Head-to-head between two players with a derived handicap. A tie is a **push**: the stake comes back. |
| `confidence` | Your own eleven: `returned = units × clamp(teamPoints / par, 0, 2)`, where `par` is the median team score that week. |

Weekly net units are added to a season-long bankroll. Highest bankroll at the
end of the season wins the units ladder.

### The house line, with no commissioner

Nobody sets a line. At lock, each player's line is the **median of their last
five settled gameweek scores this season**, snapped to the nearest half point so
a line can never tie. A player with no history takes the published position
baseline: GK 2.5, DEF 3.5, MID 4.5, FWD 4.5. Every line carries the basis it was
derived from (`position_baseline` or `median_of_N`) and the history behind it.
Lines **freeze at lock**.

## 4. The two ladders

- **Season table** — points first, then net units, then userId, with standard
  competition ranking.
- **Week streaks** — current and longest run of won weeks. A week is *won* when
  net units are positive **and** your eleven scored at or above the week's par.

Both are recomputed from settled rows on every read, so a corrected result
corrects the ladder instead of leaving a stale total behind.

## 5. Automation

`tick()` in `server/src/domain/ligi.js` is the entire operations team. It runs
on an interval from `server/src/index.js` (`BRIEF_LIGI_INTERVAL_MS`, default
60s) and is also exposed at `POST /api/ligi/tick` so a deployment without a
long-lived process — or a test — can still move the game. It is idempotent;
every branch is a clock comparison or a data-completeness check.

```
scheduled ──(opensAt reached AND pool ≥ 11)──▶ open
open ──(kickoff)──▶ awaiting_results        [competition locked, lines frozen]
awaiting_results ──(every player has stats)──▶ settled
season: upcoming ──▶ running ──▶ complete
```

**It never invents a result.** `resultsReadiness()` returns
`{ready, needed, missing, reason}`; a week whose match stats have not arrived
stays `awaiting_results` and says how many players are missing. Passing the
results-due date settles nothing.

## 6. Free and paid slots

| Slot | Stake | Status |
| --- | --- | --- |
| Free | 100 units | **Open.** The whole game. |
| Cash | Money | **Refused.** |

The cash slot is real in the model — it is priced, listed, and it appears on the
screen — and `enter(..., { slot: 'cash' })` throws `code: 'compliance_gate'`
carrying `compliance.refuseIfUnlicensed()`. The route returns 403 with the five
unmet requirements (gaming licence, age verification, KYC, licensed payment
rail, responsible-gaming controls) and the client **prints them**. A greyed-out
button would be a suggestion; this is the server's answer, shown.

Because units have no cash value and cannot be bought or withdrawn, the free
seat is not gambling, which is why the full staking product ships today.

## 7. Placement

Ligi holds the **priority listing** on the main shelf: it is ordered first by a
`priority` flag rather than by hand, so a future priority card cannot quietly
bury it. On the ladder it sits at the `orient` rung — one rung below the rest of
Arena — because a free weekly game is the cheapest honest reason to come back.

## 8. Surface

```
GET  /api/ligi                        one read model for the whole screen
GET  /api/ligi/rules                  scoring, squad rules, house rules, leagues
GET  /api/ligi/seasons                filter by status / league
POST /api/ligi/seasons                open a season (schedules every gameweek)
GET  /api/ligi/seasons/:id            season, gameweeks, table, streaks
GET  /api/ligi/gameweeks/:id          pool, lines, readiness, your entry
GET  /api/ligi/gameweeks/:id/lines    the derived lines and their basis
POST /api/ligi/gameweeks/:id/enter    { slot: 'free' | 'cash' }
POST /api/ligi/gameweeks/:id/team     { playerIds[11], captainId }
POST /api/ligi/gameweeks/:id/wagers   { mode, units, playerId?, opponentPlayerId?, side? }
POST /api/ligi/tick                   run the automated pass now (idempotent)
```

## 9. Tests

- `server/test/run.js` — the `LIGI` section: the African catalogue, scheduling,
  the pool floor, automatic open/lock/settle, the 100-unit ceiling, refusal to
  settle without stats, 1:1 and spread and confidence settlement, idempotent
  settlement, both ladders, the derived line moving from baseline to median, and
  the cash refusal writing no ledger row.
- `preview/ligi.jsx` — the screen: Ligi first on the shelf, no button that sets
  a line or settles a week, the refusal printed with its requirements, both
  ladders, and empty states that say why they are empty.
