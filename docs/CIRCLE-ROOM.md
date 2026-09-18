# A Circle is a room, not a record

Written 2026-09-18 with the lobby, the door and the append-only history in `main`.

## The two halves of the rule

> **The user can change their mind at any time. The record cannot.**

A room people will actually use has to be *editable* — a coordinator fixes a
deadline, hands the room over, cancels a vote the market made moot. A room a
group can *trust* has to be *auditable* — nobody, not the coordinator, can quietly
un-write what happened. Those two needs are not in conflict, and the way they are
reconciled here is the way the ledger already works:

- every act appends a row to `circleRevisions` — who, when, the value **before**,
  the value after, and (where it matters) why;
- the current state still lives on the row it belongs to, so nothing in the app
  got slower or more fragile;
- the state and its history are checked against each other in a test, because a
  live store object read *after* an update reports the new value — which is
  exactly how "before" quietly becomes a copy of "after". It happened while this
  was being built, and the test that caught it is `a pre-image is a pre-image`.

Reasons are required for precisely the acts a group can be harmed by: cancelling
work, reopening finished work, moving a deadline, changing a role, removing a
member, cancelling a vote with ballots on it, and putting a private room on the
list. They are NOT required for leaving a room, rejoining one, or changing your
own vote — a demand for a reason in those places produces noise, not honesty, and
noise is worse than silence because it makes the record look decorative.

There is no delete. A cancelled task sits under "Cancelled", with the reason under
it, so the room can still answer *what did we drop, and why*.

## The door

`visibility` is now `invite_only | discoverable | open`, and every circle is born
with a `joinCode` — eight characters, no `o`/`l`, because it is read off a phone
and typed into a phone.

- `GET /api/circles/join/:code` is the only circle endpoint that answers without a
  session, and it answers with `peek`: name, purpose, member count, how many jobs
  and votes are live, and how much money has actually settled through the group.
- It never returns block content, member names, or the ledger detail. A group that
  agrees to be *findable* has not agreed to be *read*. `circlejoin.jsx` pins this
  by putting a real secret sentence in a block and asserting it cannot be seen
  through the door.
- A wrong code and an unlisted room answer identically (404), so a link cannot be
  probed to learn which private rooms exist.
- `#join/<code>` renders the landing page over the app with the nav hidden, and it
  offers two doors: **Join on Brief**, or **the organiser's own WhatsApp link**,
  shown verbatim with the note that Brief has not checked where it leads. A link
  we did not verify is labelled as theirs; that is the whole difference between a
  bridge and a bait.
- Listing the room costs a reason, enforced before the write. An earlier cut of
  this code checked the reason *after* `store.update`, so a refused change still
  took effect — the door opened while the coordinator was being told they had not
  explained themselves. The test is `listing is a decision, and it is recorded as
  one`.

## What the lobby shows first

Header: the room's own plate, its name, one line — `A private room · 11 members` —
and the pinned welcome (the coordinator's sentence, capped at 400 characters,
logged when it changes). Then the live thing: a vote closing, else work nobody has
taken, else nothing. Metadata tables ("Purpose: Fun / Target: no target set /
0 blocks") are gone: a room's identity is what it is doing, not its columns.

People render as `WK · Wanjiru K · Coordinator · joined 3 days ago`. A `usr_…` key
is never a label anywhere in the room — enforced by a check that fails the suite if
the string `usr_` appears in the members or tasks panels. `nameOf()` in
`Circles.tsx` is the single place an id becomes a person, so the rule is one place
too. Invitations take an `@handle` and the server resolves the account; if no
account answers to it, that is said.

## Refusals, stated so nobody builds them by accident

The brief asked for these; they are not built, because there is no row behind them:

| Asked for | Why it stays out |
|---|---|
| ★ 4.9 (48 bookings) on a provider card | Aggregate star ratings are out of the product. Per-delivery ratings exist (`errandRatings`) and are listed, never averaged — a mean of two angry ratings is a number that decides someone's livelihood with a sample size of two. A count of real jobs is fine; a score is not. |
| "Live ETA" for a caravan/convoy | Brief has no location stream. Transport shows the *stages a person recorded*, with the time each was marked. An ETA we cannot observe is a fiction that strands people at a pickup point. |
| "Settlement is automatic", "automatic refund if the target is missed" | Brief holds no money and moves none. Payouts need a maker and a checker; a refund is a row someone records. Automation language here would describe a bank. |
| "Reminder 24h before" | No push channel is wired — SMS/WhatsApp are `not_configured`. A promise of a reminder nobody sends is worse than no promise. |
| Weighted votes (weight by contribution), ranked choice, multi-select, sub-tasks | Deferred deliberately. Weighted votes turn a cooperative's ledger into a voting class system, which is a governance decision, not a feature; the rest are the kind of surface that kills momentum in a group app. |
| `brief.app/c/brief-test` | We do not own a vanity domain. The link shown is the real origin plus `#join/<code>`, copy-on-tap, and it resolves — that is the whole claim. |
| 4,000+ SACCOs via KUSCCO | Corrected in `ICP-POSITIONING-CHANNEL.md`: 4,000–5,000 is an estimate of all registered societies; KUSCCO's own member unions number in the hundreds, and 2025 coverage of it is a Sh12.5bn misappropriation allegation. |

## Templates: what exists today

The group's economic core is not five new products; it is one chain the room
already rides:

- **Group buy / bulk order** — `groupbuy.js`: stages, pledges, `advanceStage`,
  `receiptHash`, per-member contribution rows. Progress moves when money settles.
- **Chama / contribution** — `tableBanking.js`: rotation, contributions, payouts
  with maker/checker, loans with guarantees and repayment schedules, a welfare pot,
  minutes with a PDF the group circulates.
- **Collective demand** — `placeCollectiveRequest`: the group's bulk ask goes
  through the ordinary Request → quotes → work order → settlement chain, so a group
  buys like a business and the record lands in the same ledger.
- **Event with RSVP** — the campaigns domain (registration, check-in, capacity) is
  per-organiser, and a room can hold one as a pinned block. What is *not* built is a
  circle-scoped RSVP object; if that is wanted, it should be a view over existing
  registration rows, not a parallel one.
- **Caravan/convoy** — pickups and dispatch stages exist for parcels and riders. A
  "convoy" is currently a route people mark up; no live tracking, by the refusal
  above.

## Where to look in the code

- `server/src/domain/circleHistory.js` — the append, the reason list, `describe()`,
  the newest-first tie-break.
- `server/src/domain/block.js` — task lifecycle (`editTask`, `cancelTask`,
  `reopenTask`, `verifyTask`) and votes (roll snapshot, auto-close, `changeVote`,
  `cancelVote`, sealed ballots, quorum).
- `server/src/domain/member.js` + `src/identity.js` — ending a membership instead of
  deleting it, atomic coordinator transfer, and every authority check ignoring
  `status: 'ended'` rows (a soft delete the authority layer ignores is a privilege
  that never expires).
- `server/test/circleRoom.mjs` (9) and the extended `test/run.js` — the invariants,
  including "a pre-image is a pre-image" and "there is always exactly one
  coordinator".
- `preview/src/components/Circles.tsx` (the room, full screen),
  `circle/CircleMembers.tsx` (faces, the reason gate), `circle/CircleTasks.tsx`,
  `circle/CircleVotes.tsx`, `features/city/JoinRoom.tsx`, and `preview/circlejoin.jsx`.
