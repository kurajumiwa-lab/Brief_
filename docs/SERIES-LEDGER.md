# The Series Ledger — received, standing, waiting, refused

Compiled 2026-09-21, branch `arena/01a0c209-brief`, fifteen commits after
base `4dbe321`. This page is an index, not a source: every claim here is
carried by the record it points to, and every figure below is recomputable
by counting the files.

**Scope, stated plainly:** nothing in the product tree was changed by this
series. No domain file, no route, no surface. The deliverable is the record
— the series receives builder prompts, preserves each verbatim, verifies
every claim against the tree and its suites, and writes down what already
stands, what genuinely adds, what waits on a decision, and what is refused.
Sixteen prompts arrived at the product; fifteen were real.

---

## 1. Received and recorded — 15 prompts, 16 files, 11,994 lines

| # | Prompt | Record | Commit | One line |
|---|---|---|---|---|
| 1 | Shop Brief | BUILDER-PROMPT-SHOP-BRIEF.md | `0f5150d` | The surface ships; blocker pre-fixed in the tree |
| 2 | Settlement Rail | BUILDER-PROMPT-SETTLEMENT.md | `2c4f11b` | The seam beside the queue it asks for |
| 3 | Nearby | BUILDER-PROMPT-NEARBY.md | `4aab953` | The front door beside its collisions |
| 4 | Shopping Run | BUILDER-PROMPT-SHOPPING-RUN.md (+ SHOPPING.md spec) | `0d25a51` | Second revision, recorded beside the spec it revises |
| 5 | Invite-a-Shop | BUILDER-PROMPT-INVITE-A-SHOP.md | `8c5baf5` | The consumer twin of the field-agent program |
| 6 | Partners | BUILDER-PROMPT-PARTNERS.md | `7c52701` | Supply side; Wairo the real fiction |
| 7 | Team & Roles | BUILDER-PROMPT-TEAM-ROLES.md | `3df71c7` | 1:1 person↔vendor gates all; `transitionOrder` the real hole |
| 8 | Verification | BUILDER-PROMPT-VERIFICATION.md | `45c2294` | Two systems exist; structured-facts middle path |
| 9 | Disputes | BUILDER-PROMPT-DISPUTES.md | `485086a` | Extend `openDispute`; every refund is a payout |
| 10 | Reviews | BUILDER-PROMPT-REVIEWS.md | `2161460` | The aggregate decision left to the operator; stored `ratingAvg` forbidden |
| 11 | Events & Ticketing | BUILDER-PROMPT-EVENTS.md | `7a13d37` | Extend campaign, never a second table; payouts behind the wall |
| 12 | Consumer Profile | BUILDER-PROMPT-CONSUMER-PROFILE.md | `dd383b0` | The commerce room inside the standing You tab |
| 13 | WhatsApp Business | BUILDER-PROMPT-WHATSAPP.md | `0e33c4c` | The inbound rail, absent by the tree's own words, beside the standing outbound half |
| 14 | Navigation Refactor | BUILDER-PROMPT-NAV-REFACTOR.md | `84a9330` | The constitution already shipped and enforced by `appbelt.jsx` |
| 15 | Trace for Cooperatives | BUILDER-PROMPT-COOPERATIVES.md | `1e6c625` | The B2B vertical, already the most-built system in the repo |

The operator's own recap numbering runs two ahead (#17 for the fifteenth
arrival) because it counts two prompts that never came — see §3.

Every record has the same shape: status header with fresh suite runs →
numbered corrections → the prompt's test requirements mapped → what
genuinely adds → **the prompt verbatim** (4-backtick fence, exactly two
outer lines) → operator note and coda.

## 2. Re-sends verified, no action — 2

- **Shopping Run**, re-sent identical: verified, no action (record `0d25a51`).
- **Navigation Refactor**, re-sent identical: 577 lines diffed byte-for-byte
  against the stored verbatim, no action (record `84a9330`).

## 3. The phantoms — claimed delivered, never received

| Phantom | Recap appearances | Status |
|---|---|---|
| Group Buy Streams | five consecutive recaps | Counted in the remaining menu, then in the delivered table at #12 with dependencies — never sent. Its engine (`groupbuy.js`) and fan-out exist; the prompt does not. |
| Notification System | one (the seventeenth recap) | Appeared as delivered at #16, "Depends on: Everything," then vanished from the remaining menu. Never sent. Its in-app half (real preferences, real center) already exists in the harness, waiting for a production home. |

Honest count: **15 received of 17 claimed** — the difference is exactly the
two phantoms.

## 4. What the series built

- **The archive.** 16 files, 11,994 lines, fifteen commits pushed to the
  session branch. Every prompt preserved verbatim so any refusal can be
  checked against the ask.
- **The verification layer.** Every citation grepped before acceptance —
  which caught, among others, the WhatsApp prompt citing a file
  (`connectors/whatsapp.js`) that does not exist. Suites run fresh per
  record; this sandbox's runs: navigation-relevant suites **192 passed /
  0 failed** (10 suites incl. `appbelt` 5, `nav` 85, `menusheet` 27); the
  cooperative vertical **76 server asserts across 11 files** and **370
  passed / 0 failed on the client** (7 suites incl. `circleops` 78,
  `camp` 207). Earlier sandboxes: eventDetail 13, eventExpiry 4, partner
  21, errands 8, fieldAgent 17 — all green.
- **One environment repair.** A fresh sandbox fell back to the branch base;
  the remote held the full history; realigned to `0e33c4c` with the tree
  clean before further work.
- **One self-correction.** The Cooperatives operator note said "sixteen
  received of seventeen claimed"; the true count is fifteen — fixed in the
  same commit as this ledger. The series counts itself by the same rules
  it applies to the tree.

## 5. Kept aside — waiting on a written decision or an outside event

These are recorded refusals-with-a-door: the ask is not wrong, it is
waiting on its decider.

**On the operator's desk (9):**

1. **The Reviews aggregate** — the star rating "★ 4.6 (12)". The law is
   written (row-derived on read, threshold silence) but the go/no-go is
   unsigned; four surfaces now inherit it (public page, Nearby card, share
   preview, messaging surfaces). Sits beside the `errands.js` comment.
2. **The documents/ID rule** — asked FOUR times (Verification, Partners,
   WhatsApp, Cooperatives). Decide once, with retention limits; until then
   structured facts, not ID images.
3. **Phone-as-account** — asked twice (Consumer Profile, WhatsApp). Both
   records agree: extend `authProvider`, never fork; needs a written
   decision and a migration path.
4. **The STT provider** — voice notes refuse-with-reason until one is
   chosen; the same gate holds the video-call verification alternative.
5. **Field-agent pay** — four numbers pending in `fieldAgent.js` (KES 150
   was the fourth proposed).
6. **Events scoping** — transferable-tickets default vs `ticketMarket`;
   the featured ban's reach; the social-proof ban's sparing of
   `tableBankingOverlapFor`.
7. **The drawer's philosophy** — overflow-with-dedupe (the tree, asserted
   at six entries) vs settings-only (the Nav prompt; costs three built
   sections in Spaces). `appbelt.jsx` holds whichever is chosen.
8. **The cooperative directory** — a verified cooperative's public page
   (precedent exists) vs a browsable vendor-facing marketplace (a product
   decision the standing surface's own header currently refuses).
9. **The namespace** — `cooperative` tier vs Mshikano (`coop.js`); pinned
   in the Cooperatives record, worth one line of operator ink.

**On outside events (3):**

10. **The KCB Buni disbursement contract** — money-out is
    manual + finance-confirmed until the contract arrives in writing
    (`connectors/buni.js:332`, `transfer_contract_unverified`). The wall
    the series has drawn seven times: settlement, disputes, events,
    group-buy escrow, WhatsApp, cooperatives' treasury, and the rail
    itself.
11. **The inbound WhatsApp/SMS rail** — absent in the tree's own words
    (`twilio.js:33`). Every conversational surface — the WhatsApp bot, the
    cooperative's "Reply PAY" — gates on it. Outbound is standing
    (`whatsappMeta.js`, fails closed, 24h-template obligation).
12. **An i18n rail** — none exists. Language rows are gated; Swahili copy
    ships as the product's voice or not at all, never as a toggle that
    toggles nothing.

## 6. Denied — the standing refusals

Grouped by the law that does the refusing; each is carried by its record.

**Stored truth that can drift.** A stored `ratingAvg` under any
circumstance (Reviews); stored totals or balances anywhere (the whole
tree's law); stored dashboards (`command.js` precedent). Recompute per
read; `0` only as a true row count; `—` when unmeasurable.

**Second systems.** A second event table (extend `campaign`); a second
profile (the commerce room lives in the You tab); a second vote table
(generalise `quoteVotes`); a third group-money system (the cooperative
tier extends `tableBanking`; `treasury` is already a circle type); an auth
fork for phone identities (extend `authProvider`); a third verification
system (two exist; neither may be named `verification`).

**The float.** The `cooperativeWallet` as a Trace-held standing balance is
deposit-taking by another name and dies against the vertical's own deepest
sentence — *"the pool is the group's own money. Brief holds none of it."*
Held funds exist only as per-transaction escrow; money-out is behind the
Buni wall; refunds are payouts, never reversals.

**Slogan-driven deletions.** "Trace does not lend" does not delete
repayment tracking (member-to-member loans on the group's own books are
recorded as what they are); "Home is personal" does not delete "What's out
there" (real inventory); "wire it to Cooperatives" does not unwire the
standing Table Banking door (domain → routes → surface → You tab → ten
suites).

**The commerce spine.** Deleting Bulk/Direct/Niche/Group from Discover
(server-labelled flows, count-bearing); the "Runs" room (does not exist);
a "Group Buys" chip without a production mount; the 10-member gate applied
to standing groups (a five-member merry-go-round is core audience).

**Phantom kills.** The "All →" chip, the "All exhibits" chip, "hardcoded
chama labels," and every per-record removal that greps clean — each audit
checks the kill list against the tree, and the phantoms are named.

**Middlemanning.** Routing a shop's buyer chats through Trace's WhatsApp
number (the owner keeps their digits; Trace's number carries Trace's
transactions only); selling reach Trace cannot verify (the
"✓ always-on" claim); urgency, countdowns, crowd pressure, loyalty theatre
in the band (asserted negative, `appbelt.jsx`).

**Name collisions.** `shop`/`shops` reserved for the WhatsApp shop builder
(operator decision 2026-09-20 — the 8th re-key followed it);
`coop` belongs to Mshikano; the ★ aggregate cannot ship before its
decision; featured/sponsored framings are scoped, never ambient.

**People-laws.** No ranking of members by contribution or reliability ("a
credit judgement Brief is not licensed to make"); no hidden auto-resolution
constants (disputes' are row-derived and printed); silence below
thresholds; report-don't-edit; one immutable seller response; a member's
history to no one but the member and the treasurer.

**The interface law.** Jargon is a refused API — one-word command grammars
(PAY, STATUS) must understand plain sentences and fall back honestly
("Sijaelewa. Reply HELP"); a search box that resolves or does not exist; a
control that changes nothing (a Language row without an i18n rail) is the
bug class, not a feature; mockup numbers (Orders (7), 47 members, KES
512,500, 94%) are illustrations, never rows.

## 7. Where the series stands

**Received: 15. Claimed: 17. Phantoms: 2. Re-sends: 2, both verified.**
Suites: green everywhere run, most recently 192/0 (navigation) and
76 asserts + 370/0 (cooperatives). Open operator decisions: nine. Outside
events awaited: three. Product tree touched: nothing — deliberately; the
series' build is the record.

**The remaining menu, as the recaps have it:** Space Editor v2 · the Trace
Card · the Field Agent App · the Protection Fund — plus the two phantoms,
whenever they decide to exist. Notes the next record will want: the Field
Agent App meets `fieldAgent.js` (17 suites, four pay numbers pending); the
Protection Fund meets `escrow.js`, the disputes hold, and the Buni wall;
the Notification System, if it ever arrives, is a unification record — its
in-app half already exists; Space Editor v2 meets `spaceEdit` suites and
the space-audience template split; the Trace Card meets whatever the shop
owns that a card can carry — verified facts, printed plainly.

---

*The series in one sentence: every prompt arrived certain the tree was
empty; every record found the tree already arguing with itself in comments
and suites, and joined the argument. Fifteen times the verdict was the
same shape — the ask is real, the premise is wrong, the build is narrower
than claimed, and the refusal is written down where the next prompt can
trip over it.*
