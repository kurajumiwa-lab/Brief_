# Verification sweep — 2026-08-28

A full re-run from a clean install, on branch `arena/01a047c5-brief` at
`8433e28` (PR #7 merged, working tree clean). The purpose was not to add
features: it was to find out whether the numbers the repository reports are
still true, and what is actually weak underneath a green suite.

Every figure below was produced by running the thing. Nothing is inherited
from an earlier report.

---

## 1. What was run, and what it said

| Check | Result |
|---|---|
| `server/test/run.js` | **1717 passed · 0 failed · 3 skipped** |
| `server/test/livecamp.mjs` | **111 passed · 0 failed** |
| `./run-suites.sh` (32 client suites) | **1194 passed · 0 failed** |
| `tc` strict typecheck | **exit 0** |
| `live/2-commerce-over-http.mjs` | **43 · 0** against the production build |
| `live/3-public-campaign.mjs` | **27 · 0** (was 22 passed / **4 failed**) |
| `live/4-full-chain.mjs` | **91 · 0** (was 86 passed / **1 failed**) |
| `live/5-release-smoke.mjs` | **16 · 0** read-only, **26 · 0** with writes |
| Production build | 1662 modules · JS 705.80 kB (gzip 179.41) · CSS 52.97 kB (gzip 10.12) |

**Total: 3225 assertions, 0 failing** (was 3077 claimed, with 5 of them
actually failing).

The API was started the way deployment starts it — `NODE_ENV=production` —
because the single-user development fallback answers every unauthenticated
request as `usr_me` outside production, and a suite run any other way tests a
system that does not exist.

---

## 2. What was found and fixed

### 2.1 Three write routes accepted an anonymous caller — **fixed**

Found by scanning every mutating route for an authorization check
(`scripts/audit-routes.mjs`, added in this change), then proving each
candidate over HTTP against a production-mode server.

| Route | What an anonymous caller could do | Evidence |
|---|---|---|
| `POST /api/campaigns` | create a campaign with `ownerId: null`, **publish it**, and have it resolve at `/api/public/campaigns/:slug` | `201` then `POST .../publish` → `200`, slug resolved `200` for a stranger |
| `POST /api/transactions` | write a row into `ledgerTransactions` — the single source of economic truth — with `counterparty: null` | `201 {"id":"txn_…","amount":1000,…}` |
| `POST /api/transactions/:id/transition` | move any transaction through its states, including `settled`, which promotes a registration and releases a spot | now `401` |

The campaign one is the sharp edge: the ownership guard compares the stored
owner to the caller, and `null === null`, so an anonymous caller was the owner
of everything it created — including the right to publish.

All three now require an identity. Outsiders lose nothing: the public
registration path (`/api/public/campaigns/:slug/register`) is untouched, and
18 new server assertions cover the refusals.

### 2.2 A source membership was written against a hard-coded user — **fixed**

`POST /api/sources/:id/membership` wrote its row against `CURRENT_USER`
(`usr_me`) rather than the caller. Two consequences: a real member's grant
landed on the wrong identity and never governed anything for them; and with
the development fallback on, an anonymous caller granting itself `owner` was
granting it to `usr_me`, which is exactly the identity it was being treated
as. `GET /api/sources` had the same bug in reverse, reporting memberships for
the constant instead of the caller.

Both now use `callerId(req)`, and the route requires an identity.

### 2.3 A manual capture claimed confidence it had not earned — **fixed**

When the extractor refuses text as "not object worthy", `POST
/api/brief-it/save` keeps the words anyway — correctly, since the client's
preview and the server's extractor can disagree and silently dropping text
someone just typed is worse than keeping it. But what it stored was a
fabrication:

```
publication:          'public'                    // straight to the anonymous feed
extractionConfidence: 0.85                        // over text nothing came out of
extractionEvidence:   'User manual capture/post'
```

while an object-worthy capture from that very same manual source took the
source's own default of `source_members`. So "just some idle chatter" became a
public object claiming 85% extraction confidence.

It now records the confidence extraction actually earned (0.2 for a bare
title), says in plain words that the note was kept as written, names the one
field that was found, marks the fields it could not establish as unknown, and
takes the same publication default as its sibling branch. Five assertions in
`live/4` and seven in the server suite hold this down, including one that
fetches `/api/public/feed` and greps for the text.

### 2.4 A live suite could not pass in production mode — **fixed**

`live/3-public-campaign.mjs` captured and created campaigns as nobody. Against
a production server those calls are `401`, so four checks failed — including
the dedupe check, which had therefore not been proving anything. The script now
registers a real organiser over HTTP, and every stranger-side call passes
`null` explicitly so its anonymity is deliberate rather than incidental. It is
27/0, and it is now actually testing what its name claims.

`live/README.md` still explained phase 1 as necessary because "a second actor
cannot be created over HTTP". That stopped being true when real authentication
landed; the document is corrected.

### 2.5 Documented numbers had drifted from the code — **fixed**

`README.md` claimed 1649 server assertions, 1161 client assertions, 3077
total, and 87 for phase 4. Measured: 1717 / 1194 / 3225 / 91. The phase-3 line
(26/26) was the most misleading of all, since four of those 26 were failing.
The README now carries measured numbers and says when they were measured.

---

## 3. What is still weak

Not fixed. Not dressed up. Ordered by how much I would trust them to bite.

1. **Anonymous writes that land as `null`-identity rows.** `POST /api/circles`
   (201), `POST /api/blocks` on an open circle (201), joining a circle
   (`{"userId":null}`), and `PATCH /api/circles/:id` while the circle has no
   members (200 — the guard is conditional on having members). Nothing here
   reaches another person's data, and once a circle has members only a
   coordinator can touch it, so this is unattributable writes rather than
   escalation. It is still a data-integrity problem: two different logged-out
   people collapse onto the same `userId: null`. Fixing it is a product
   decision (may a visitor who has not taken the anonymous device session
   start a circle?) rather than a bug fix, so it is left for you.
2. **The client bundle.** 711.03 kB (180.95 kB gzip) in a single chunk; Vite
   emits a >500 kB warning on every build. `App.tsx` is 11,721 lines and
   486 kB — the whole client is one module. The last report in this repository
   recorded 442.77 kB, so it has grown by ~60% since. No code splitting, no
   lazy surfaces. On a Kenyan mid-range Android over mobile data this is the
   first thing a real user feels, and no test measures it.
3. **Documentation drift is structural, not one bad table.**
   `BRIEF-FINAL-REPORT.md` still says 1217 server assertions and a 442.77 kB
   bundle. It is dated 2026-08-18 and honest *as of that date*, but nothing
   distinguishes "true then" from "true now". Either date-stamp these reports
   on every refresh or generate the numbers.
4. **No scheduled work.** No daemon, worker or cron. Auction expiry is swept
   opportunistically on read; Ligi is ticked by an interval in-process or by
   `POST /api/ligi/tick`. A single-process deployment that restarts loses its
   clock.
5. **Connectors.** No Telegram bot token, so authenticated ingestion has never
   run; WhatsApp is connector-shaped only. Unchanged and honestly reported.
6. **Payments.** Still no provider. `payments.configured:false`, paying
   returns 503 with `charged:false`. This is a gate, not a gap.

---

## 4. The audit tool

`scripts/audit-routes.mjs` — `node scripts/audit-routes.mjs`. It parses every
route module and lists the mutating routes whose handler contains no guard at
all: 182 mutating routes, **27 with no visible guard**.

It is a triage tool, not a verdict, and the distinction matters — a guard's
*condition* still has to be read. `PATCH /api/circles/:id` has an
`isCoordinator` check and therefore does not appear on the list, yet an
anonymous caller can still rename a circle that has no members, because the
guard is conditional. The 27 break down as: public by design (`/api/auth/*`,
the two `/api/public/*` entry routes, Huduma's deeplink and STK push), signed
webhooks (Tuma, Telegram, M-Pesa — HMAC over the raw body), delegated
ownership checks that answer 403/404 to a stranger (orders, vendors, source
disconnect, paid fantasy entry), and the compliance gate on Arena staking.

Run it after touching routes. The three holes in §2.1 were invisible to every
existing test because no test asked what an anonymous caller gets.

---

## 5. Recommended next work

1. **Split the client bundle** — route-level `import()` for My Layer,
   Workflows, Pulse and the Arena surfaces, with a budget asserted in CI so it
   cannot silently grow back. Biggest user-visible win, and measurable.
2. **Decide the anonymous-actor question** (§3.1) and, whichever way it goes,
   stop writing `null`-identity rows.
2a. **A flaky security assertion was found and fixed while doing this work.**
   "a tampered signature is refused" flipped the LAST base64url character of
   an RS256 signature, which carries only padding bits: about one run in three
   the tampering decoded to identical bytes, the signature verified, and the
   check failed. It now flips a character in the middle. Worth remembering:
   run the suite more than once before trusting a green result.
3. **Make the docs generate their own numbers** — one script that runs the
   suites and rewrites the table, so the next report cannot drift.
4. Then the standing gaps: scheduled work, connectors, payments credentials.

---

## 6. Addendum — image uploads (same day, after the sweep)

The editorial studio offered only a URL box, so every photo in Brief was
somebody else's asset on somebody else's server. It now takes a real file:
`POST /api/media/upload` (multipart), served back at
`GET /api/media/file/:id`.

* The type is decided by **magic bytes**, not by the declared type, the
  filename or the extension. A text file named `innocent.png` is refused; so
  is an SVG, because it is a document that can carry script.
* Only JPEG, PNG, WebP and GIF. 8 MB cap, enforced on the wire and again in
  the domain. The stored filename is generated by Brief, so no caller-supplied
  path component is ever used.
* An upload needs an identity; only the owner can delete one. Reading does not
  require a session, because a published story has to render for someone who
  has not signed in, and the id is a random unlisted handle.
* Bytes live on local disk. The store row records the size, the sha256 and the
  sniffed type; if the bytes are gone, the request answers 404 with that
  reason instead of a broken image.
* Client: one `ImageField` component (upload first, drop zone, link available
  behind "Use a link instead") used by the story studio's lead photo and
  gallery and by the Yard Engine advertiser media field. All of it goes
  through `briefApi`, the only place that fetches.

Tests: 32 new server assertions (formats accepted and refused, dedupe,
ownership, byte-for-byte round trip, the honest 404 for missing bytes) and 24
new client assertions (file posted as multipart with no hand-set content-type,
the returned URL proxied and rendered, the server's refusal shown verbatim, the
link route still reachable). `preview/media.jsx` is a new suite.

**Measured after: server 1750/0/3 · livecamp 111/0 · client 1218/0 ·
typecheck exit 0 · live/ 203/0 → 3282 assertions, 0 failing.**

---

## 7. Addendum — the Inbox, the bundles, and three unfinished loops (same day)

You asked for three things: make the Inbox simple and quick, complete the
loops that were left half-built ("how do I join circles"), and collapse the
feature count without losing functionality, bundling what ships as a package.

### 7.1 The Inbox is now one queue, not eighteen badges

`GET /api/triage` (`server/src/domain/triage.js`) answers one question — *what
is blocked on me right now* — by deriving it from real rows:

| Kind | Where it comes from |
|---|---|
| `task` | Blocks of type `task` whose `assigneeId` is the caller and whose status is not `completed` |
| `order` | Orders on the caller's own vendor still inside the fulfilment path |
| `checkin` | Campaigns the caller owns, published/live, starting inside the look-ahead window, with people still to check in |
| `draft` | `rawItems` whose `processingStatus` is still `pending` |

Rules it holds to, all covered by assertions:

* **Nothing is stored.** There is no triage table, so the queue cannot drift
  out of step with the work it describes and cannot be written to.
* **An unassigned task is absent.** Work nobody holds belongs to the circle,
  not to one person; it does not chase an individual.
* **Time-boxed work floats to the top.** A door opening tonight cannot wait
  behind a task with no deadline. `withinHours` is stated in the response
  (default 48, clamped 1–336) rather than left implicit.
* **It is per-caller and requires an identity.** An anonymous caller gets 401,
  not an empty queue that looks like "nothing is waiting".
* **The client cannot fake it.** An unreachable queue renders as
  *unreadable*, never as *empty*; a refused action keeps the row and shows the
  server's reason; completing a task re-reads the queue rather than splicing
  the row out locally.

It is deliberately its own namespace: `/api/inbox` already means the
per-contact conversation projection (`domain/inbox.js`).

### 7.2 The feature count collapsed; nothing was deleted

| Before | After |
|---|---|
| Workflows: a menu of **18 tools** | **Waiting on you** (the landing view) + **Create · Sell · Run · Records** |
| Saved: a menu of **11 options** | **Kept · Groups · Creator** |

The filing lives in one place, `src/ui/names.ts`. Every section id is
unchanged and every URL still resolves (`/actions/records/sources`,
`/saved/creator/subscriptions`, …); the bundle only decides which sub-tabs sit
next to each other. The active bundle is **derived** from the open section, so
a deep link cannot disagree with the chips.

* Create — Create, Review, Editor, Distribution, Calendar, AI review
* Sell — Campaigns, Vendors, Payments, Group Buy
* Run — Dashboard, Open, Done, Matches, Engine
* Records — Records, Check-in, Feeds
* Kept — Saved, Activity, Points, Events
* Groups — Groups, Chats, Matches
* Creator — Profile, Offers, Messages, Plans

### 7.3 Three loops that were half-built

**Circles: browse → join → leave.** `GET /api/circles` returned every circle in
the deployment with no membership information, and `Circles.tsx` rendered all
of them under "Communities you are part of" — so it could list circles while
its own empty state said "You are not part of any Circle yet". There was no
join button anywhere and **no way to leave at all**: the server had no removal
route.

* Each row now carries `viewerRole`, `isMember` and `canJoin`, all derived.
* `POST /api/circles/:id/members` **requires an identity**. It did not, and an
  anonymous join wrote a `userId: null` row — the §3.1 problem, now closed.
* `DELETE /api/circles/:id/members/me` leaves; `DELETE …/members/:userId`
  removes somebody else and is coordinator-only (403 otherwise).
* `POST /api/circles` now requires an identity **and makes the creator its
  coordinator**. Previously you could create a circle and then be told you
  were not a member of it, with no way in but an invitation from a coordinator
  who did not exist. This is also the first client-side way to start one
  (`Circles.tsx` — until now circles only appeared when derived from a source).
* The list is split into *Circles you are in* / *Open to join* / *Invite only*,
  and leaving says what it does and does not undo: work you were holding keeps
  your name on it, and settled money stays settled.

**Subscriptions: the follower's half.** `domain/subscription.js` was
creator-only — a creator could publish a plan and even record a billing cycle
for themselves, but no follower could ever join. Added `subscribe` /
`unsubscribe` / `listSubscribers`, `GET /api/subscriptions?browse=1` for
discovery, and `?creator=<id>` for one creator's plans. The old route handed
*every* plan in the deployment to an *anonymous* caller; that was a leak that
happened to look like a feature, and it is now 401.

Two honesty fixes came with it: `subscriberCount` was a stored field nothing
ever incremented — a permanent confident zero next to a list of real members —
and is now derived from rows; and joining reports `charged: false` with the
cycle recorded as a ledger transaction that has **not** settled, because no
payment provider is connected.

**Starting a circle.** See above: it was API-only, and now the client offers it.

### 7.4 Measured after this change

| Suite | Result |
|---|---|
| `server/test/run.js` | **1832 passed / 0 failed / 3 skipped** (was 1750) |
| `server/test/livecamp.mjs` | **111 / 0** |
| `./run-suites.sh` (34 client suites) | **1274 passed / 0 failed** (was 1218) |
| `tc` strict typecheck | exit 0 |
| `live/` against the production build | **43 + 27 + 91 + 16 + 26 = 203 / 0** |

**Total: 3420 assertions, 0 failing.** New coverage: 82 server assertions
(queue derivation, per-caller scoping, join/leave, subscriptions) and 49 client
assertions in a new suite, `preview/joins.jsx`, which drives the real
components against a mock server that refuses things the way the real one
does — because a loop that only works on the happy path is still broken for
the person who hits the refusal.

Four existing client suites were updated to the new navigation (`nav`,
`capture`, `inbox`, `batch1`, `onboard`): they walked `destination → section`,
which is now `destination → bundle → section`. Their assertions were rewritten,
not deleted — for example nav.jsx still checks that every Saved and Workflows
screen is reachable, and now also asserts that the flat "18 Tools"/"11
Options" lists are gone.

### 7.5 What this did not touch

§3 of this report still stands apart from one item. The client bundle is
untouched (still one chunk, still unmeasured by any test); documentation
drift, scheduled work, connectors and payments are all unchanged. **§3.1 is
resolved**: circle joins and circle creation now require an identity, so
`null`-identity membership rows can no longer be written.
