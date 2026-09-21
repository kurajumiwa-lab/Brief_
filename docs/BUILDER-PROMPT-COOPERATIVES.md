# Trace for Cooperatives, as received

Received 2026-09-21. Fifteenth builder prompt to arrive; the operator's own
counting labels it #17. Saved as `docs/BUILDER-PROMPT-COOPERATIVES.md`.

**Verification verdict, before anything else:** this prompt arrives naming
itself "the B2B vertical" and builds it from virgin ground — a `cooperative`
entity, a treasury, contributions, votes, an AGM, a treasurer's dashboard.
The tree already contains this vertical, built, wired, taught, and tested
from more angles than any other system in the repo: `tableBanking.js` (847
lines — the ledger, the rotation, the loans, the maker-checker payouts, the
welfare pot, the minutes, the treasurer's dashboard), `coopOperations.js`
(223 lines — the operator read, in its own words "the read that makes a
group the customer… the question that gets paid for"), the You tab's Table
Banking door, the teaching section titled "Circles, chamas and the operator
read," nine server suites, and a client suite with **78 assertions on the
operator read alone**. The premise — *"Almost none have real
infrastructure"* — is false of this tree, and demonstrably so by suite run.

Fresh runs this session, 2026-09-21. Server (per-file assert counts):
`tableBanking` 12, `tableBankingArchive` 6, `tableBankingInvites` 5,
`tableBankingLoop` 7, `tableBankingMinutes` 5, `tableBankingOps` 8,
`tableBankingOverlap` 5, `tableBankingTemplates` 5, `tableBankingTreasurer`
4, `tableBankingWelfare` 9, `circleRoom` 10 — **76 asserts, all passing**.
Client, via `./run-suites.sh`:

| Suite | Result | Suite | Result |
|---|---|---|---|
| tablebankingsurface | 5 passed / 0 failed | group | 29 passed / 0 failed |
| circleops | 78 passed / 0 failed | groupui | 27 passed / 0 failed |
| mshikano | 19 passed / 0 failed | circlejoin | 5 passed / 0 failed |
| camp | 207 passed / 0 failed | | |

**TOTAL: 370 passed / 0 failed — GREEN.**

## Corrections first (what was changed, and why)

**1. The vertical exists, and the tree already states its philosophy in the
prompt's own vocabulary.** `tableBanking.js`'s header: *"Brief is NOT the
group, and NOT the lender. The members already exist, already trust each
other, and already run their rotation. Brief is the spreadsheet they hold
their meeting with."* Its exports are the prompt's entity list, shipped:
`createTableBanking` (:87), `recordContribution` (:181 — with receipt hash
and idempotency key), `rotationView`/`advanceTurn`/`skipTurn`/`swapTurn`
(:210–262, the merry-go-round as derived arithmetic), `applyLoan`,
`loanSchedule`, `signGuarantee`, `approveLoan`, `recordRepayment`,
`outstandingBalance` (:277–399), `requestPayout`/`confirmPayout` (:432–445,
maker and a different checker), `summary` (:458), `memberView` (:500),
`placeCollectiveRequest` (:535, the group as purchaser), minutes
(:714–740, *"newest meeting first"*), join invites by phone (:748), and
`treasurerView` (:813, *"only the treasurer can view this dashboard"*).
After this prompt's Notebook-and-dissolving-chama story: the notebook is
already a row store with tamper-evident hashes, and the treasurer's
dashboard is one derived read that cannot disagree with the ledger because
it is the ledger, scanned.

**2. The distinction table's "Circle — has a treasury: No" is false.**
`circle.js` ships `CIRCLE_TYPES` including **`treasury`** (:21) and
`CIRCLE_STATUS` = `['forming', 'active', 'completed', 'dormant']` (:22) —
the prompt's status machine uses the tree's own words. And the pool itself
is `tableBanking.js`. The consequence is the same law the Events record
enforced for campaign: **a third group-money system is refused.** The
`cooperative` entity must extend the table-banking spine — governance,
terms, dues, AGM — never fork it. The prompt's own category enum
(`'table_banking'`) concedes the audience already has a home here.

**3. `coop` is taken — by Mshikano.** `coop.js` is not this prompt's
cooperative: it is the peer-to-peer cooperation network (have / need /
can_help / looking_for posts, matches carrying WHY, a cooperation existing
only when BOTH parties confirm, trust as an evidence list — *"never a
five-star average, never an invented percentage"*). The full word
`cooperative` is free as an entity name; the record pins the namespace:
`coop`/Mshikano is the relationship graph, `cooperative` (if built) is the
treasury-and-governance tier, and no shorthand may blur them.

**4. The cooperativeWallet contradicts the deepest sentence in this
vertical — and the prompt's own non-negotiable.** `tableBanking.js`:
*"the pool is the group's own money. Brief holds none of it. This module is
deliberately SELF-CONTAINED… nothing here mints or moves money."* The
prompt wants "a Trace-managed account for the treasury" holding a standing
balance funded by rail collections — which is deposit-taking by another
name, forbidden by the prompt itself four paragraphs earlier ("Trace does
not hold deposits"). A wallet that holds the float between weekly
contributions and monthly disbursements IS holding deposits. The tree's
answer stands: contributions are attested RECORDS with receipt hashes; the
money moves member-to-member or member-to-vendor at payment time, as it
always has; where the rail touches it at all it is per-transaction
collection (Buni STK — the one complete money path), never a resting
balance. Held funds exist in this repo only as per-transaction escrow, not
as accounts.

**5. "No loans… Trace does not track repayment" would delete tested
capability to satisfy a slogan — and the tree already found the compliant
form.** The prompt: a disbursement is a payment, not a loan, and repayment
goes untracked. The tree: loans between MEMBERS, out of the members' OWN
pool, with schedules (flat / reducing-balance), guarantors, penalties,
repayment rows, outstanding balances, and a `defaulted` state — and Brief
holds none of the money and is not the lender. That is the honest version
of the prompt's own rule: the platform keeps records for the group's own
lending; it never lends. Deleting `recordRepayment` because "Trace does not
lend" confuses the lender with the ledger. The prompt's rule survives
amended: **nothing on Trace's books is a loan; everything on the group's
own books may be, and is recorded as what it is.**

**6. The disbursement mechanics hit the standing wall — seventh surface.**
The prompt's flow ends "Settlement Rail disburses KES 20,000 to the
vendor." `connectors/buni.js:332` — `disburse()` refuses:
`transfer_contract_unverified`, *"The transfer endpoint is in KCB's
catalogue; its request body is not published in the material reviewed.
Brief will not move money out with a guessed payload, so payouts remain
manual + finance-confirmed until the contract is confirmed in writing."*
Votes, approvals, purpose fields, and ledger rows can all ship now; the
money-out leg is the manual, finance-confirmed path until KCB's contract
arrives in writing — the same wall the Events record hit, now surfaced by
the cooperative treasury too. The prompt's refusal to fake the payload
would have been the tree's refusal; the tree got there first.

**7. The VOTE entity has a standing first instance — one system, not
two.** `quoteVotes.js`: members vote on which quote to accept for a
COLLECTIVE request; votes are real rows; *"the tally is recomputed on every
read"*; a majority authorises the delegate to accept **through the existing
quote-accept path** — *"the vote is the authorisation, the accept is the
same tested mutation as a single click."* The prompt's general vote
(time-bound, quorum, thresholds, transparent tallies) is the natural
generalisation of exactly this. Build the general case with quote votes as
the first instance riding it; never a second vote table. The prompt's
transparency rule and non-binding-until-executed split ("the vote
expresses intent. The treasurer executes") match quoteVotes' shape exactly
— the prompt is describing what the tree built, plus a clock.

**8. The 10–5000 gate would refuse groups the tree already serves.**
Table banking has no minimum: a five-member merry-go-round is a legitimate
group, templates included. A `cooperative` tier may set thresholds for its
own entity (constitution min/max are the prompt's fields, and the test
requirements' 9-member refusal and 5001-member refusal are fine **for that
tier**); it must never gate the standing surfaces, which continue to serve
chamas of any size. Below 10 is not a lesser group here — it is the core
audience the existing system was built for.

**9. Minutes, meetings, attendance: mostly built; the AGM report is the
genuinely new part and it is pure derivation.** Minutes exist
(`tableBanking.js:714–740`, permanent history that survives archiving).
Attendance is `checkin.js` — the gate layer over campaign registrations
(exactly-once, attributable, capacity-safe). An AGM scheduled as a campaign
inherits dates, capacity, registration, check-in, and the wait-list
chronology of `calendar.js` for free. The AGM report — membership movement,
contributions, treasury opened/received/disbursed/closed, largest
disbursements, votes held — is the tree's whole method in one document:
`treasurerView`, `operationsFor`, and `command.js` all already derive
dashboards by scanning rows with *"no stored dashboard and no cached total
that could drift from the ledger."* The report is not written by anyone;
it is computed — the prompt says this, and the tree has been doing it in
three places already. The 14-month flag is a new constant on a timer, the
house timer pattern.

**10. Cooperative verification: a third system must not fork, and
"verified IDs" is the documents decision's FOURTH asking.** Two
verification systems already exist (record `45c2294`: they cannot be named
`verification`); the field-agent visit is `fieldAgent.js` (17 tests); the
video-call alternative is a provider decision the tree has not made. The
cooperative tier's stronger check extends the same rows with the same
refusal discipline. And its step 2 — chairperson, treasurer, secretary
with *verified IDs* — asks the documents question a fourth time
(Verification, Partners, WhatsApp, now Cooperatives). Four prompts wanting
the same exception is not drift; it is the decision itself, waiting. Until
it is made once, with retention limits, the structured-facts middle path
holds. Verification expiring in 18 months is a named constant, fine.

**11. The Cooperative Directory contradicts a standing refusal and needs
a written decision.** `TableBankingSurface.tsx`'s header: *"Brief is NOT
the group and NOT a directory of groups… There is no 'browse groups'."*
A public, vendor-facing, browsable directory of cooperatives is a directory
of groups — refused as the surface stands today. What has precedent: a
verified cooperative's own public page (the `/s/:slug` shop page pattern,
consent of the listed), and the visibility vocabulary for it —
`circle.js`'s *"a shop window, not an open door: what is listed is the
metadata the coordinator chose to make listable."* A browsable,
category-chipped, vendor-facing directory is advertising-adjacent lead
generation; it is not refused forever, but it is a written operator
decision with the visibility rules spelled out, not a section of a build
prompt.

**12. WhatsApp-first rides the rail this series already recorded as
missing.** Outbound is standing (`whatsappMeta.js` — Meta Cloud direct,
fails closed, the 24-hour template obligation in its header). Inbound is
absent in the tree's own words (`twilio.js:33` — "Inbound SMS/WhatsApp
receive is a separate, unbuilt rail") — the sixteenth prompt's actual
subject, on which every "Reply PAY" in this prompt depends. The PAY action
itself has a complete path: Buni STK collect. The one-word command grammar
runs into the jargon-is-a-refused-API law — the command surface must
understand plain sentences and fall back honestly ("Sijaelewa. Reply
HELP"), exactly as the WhatsApp record specified. And the Swahili greeting
copy is a product-copy decision, not a Language setting: there is no i18n
rail in this tree (the nav record's finding), so HABARI/Karibu ships as
the voice of the product or not at all — no toggle pretending otherwise.

**13. The removal asks, audited: one phantom, one phantom, one wired-and-
standing.** "Any Circle that acts like a cooperative but has no treasury"
— phantom: `treasury` is a shipped circle type and the pool system exists.
"Any hardcoded 'chama' labels that aren't backed by a Cooperative row" —
the only two chama strings in the client are a consent comment
(`JoinRoom.tsx:12` — a group's listing is "not something a chama agreed to
when they tapped 'list it'") and a teaching title (`HowBriefWorks.tsx:132`,
"Circles, chamas and the operator read"); neither is a fake label.
"The old 'table banking' navigation item if it isn't wired to the
Cooperative entity" — it is wired: domain → routes (445 lines) → surface →
You tab (`YouSurface.tsx:74`, mounted :510) → ten suites. The ask would
unwire a standing, tested door to make room for an unbuilt one. Refused.

**14. The recap: seventeen claimed, sixteen arrived — and the delivered
table now carries TWO phantoms.** Group Buy Streams sits at #12 for the
fifth consecutive recap, never received. New this time: the **Notification
System** appears at #16 as delivered — "Depends on: Everything" — one row
above Cooperatives, and it has never arrived either; its remaining-prompts
entry is gone accordingly. The menu shrinks to four: Space Editor v2, the
Trace Card, the Field Agent App, the Protection Fund. A note the recap
cannot see: when the Notification System does arrive, its in-app half
already exists (real preferences in `NotificationCenter`, a real center,
mounted through the legacy harness) — it will be a unification record, not
a beginning.

**On the pitch numbers:** the 300,000 cooperatives, 1.5 million chamas,
KES 300 billion in assets, and the mockup dashboards' figures (47 members,
KES 512,500, "94% on time") are the prompt's illustrations, preserved
verbatim above and printed nowhere. The house law holds: every figure a
screen shows is recomputed from rows; the mockup numbers never enter the
product. One alignment worth recording: the prompt's privacy split — a
member's own on-time rate visible to that member, the treasurer seeing who
has and has not contributed, the chairperson seeing only aggregates — is
`coopOperations.js`'s exact law, including the refusal it does not yet
know to ask for: **no ranking of members** ("a credit judgement Brief is
not licensed to make"). The dashboards may show overdue counts; they may
never show a leaderboard.

## The prompt's test requirements, mapped

| # | Test requirement | Status against the tree |
|---|---|---|
| 1 | 9 members cannot activate; minimum 10 | **New, scoped** — a gate on the cooperative tier only; table banking keeps any size |
| 2 | 5001 members cannot be created; maximum 5000 | **New, scoped** — same |
| 3 | Exactly one chairperson / treasurer / secretary | **New** — the tableBanking owner model is single-owner; the officer trio extends it; roles machinery (`roles.js`, `member.js`) is the base |
| 4 | Contribution is a row; balance derived, never stored | **Already law** — `recordContribution`, `summary` scans rows; pinned by 76 server asserts |
| 5 | Paid via the rail moves money into the coop wallet | **Amended** — rail collection is per-transaction (Buni STK, complete); no standing wallet (correction 4) |
| 6 | Overdue stays overdue until paid or waived | **Extendable** — contributions are records; a waived state with a recorded reason is a small, honest addition |
| 7 | Disbursement above threshold requires a vote | **New** — the general vote entity (correction 7); below-threshold treasurer approval matches the maker-checker precedent |
| 8 | Vote opens and closes on schedule | **New** — time-bound votes; the house timer pattern |
| 9 | Vote result derived from real rows | **Already law** — `quoteVoteState` recomputes on every read |
| 10 | Every member sees the balance; histories only to member + treasurer | **Already true** — `summary`/`memberView`/`treasurerView`; extend the visibility matrix to the new officers |
| 11 | AGM report generated from rows, no manual entry | **New** — pure derivation over existing rows (correction 9) |
| 12 | No AGM in 14 months → flagged | **New** — one constant + a sweep, the house timer pattern |
| 13 | Term expiry enforced; "Term expired" shown | **New** — governance is the prompt's real deliverable |
| 14 | No activity for 90 days → `dormant` | **Words already exist** — `CIRCLE_STATUS` has `dormant`; inherit the machine, add the sweep |
| 15 | Dissolved: history remains, no new movements | **Matches** — archive preserves welfare and minutes history; dissolved extends the same idea |
| 16 | Not a bank: no interest, no platform loans, disbursement-not-loan | **Already enforced, amended** — Brief holds none of the pool, lends nothing, pays no interest; member-to-member lending stays recorded (correction 5) |

## What is genuinely new here

- **The governance layer** — the officer trio, term limits, rotation, the
  expiry banner, the 10–5000 constitution gates: the parts of a group that
  make it last, none of which exist yet.
- **The general vote** — time-bound, quorum'd, thresholded, transparent,
  with quote votes rebased as its first instance.
- **The AGM report generator** — the annual document computed from rows,
  plus the 14-month flag.
- **Dues vs contributions** — the split is new vocabulary; the row
  machinery to carry it is standing.
- **The cooperative verification tier** — as an extension of the existing
  rows and the field-agent program, never a third fork; the documents
  decision now asked four times.
- **Cooperative-level group demand** — `placeCollectiveRequest` and quote
  votes already make the group the customer; the engine for the phantom
  Group Buy Streams (`groupbuy.js`) fans out signals to WhatsApp. What is
  new is only the cooperative tier atop them.
- **WhatsApp commands** — rail-gated on the missing inbound half, STK
  backed for PAY, jargon-law compliant grammar.

**Refused or amended by this record:** the standing treasury wallet
(correction 4); untracking loan repayment (correction 5); instant rail
disbursement (correction 6 — the manual wall stands); a second vote table
or a third money system (corrections 2, 7); the 10-member gate on existing
groups (correction 8); the browsable vendor-facing directory without a
written decision (correction 11); unwiring the Table Banking door
(correction 13).

**Left to the operator, in writing:** (a) the directory — public face of
verified cooperatives per the shop-page precedent, or a browsable
vendor-facing marketplace for group demand; the second is a product
decision, not a feature. (b) The documents/ID rule, now at four askings —
decide once, with retention limits, and three recorded refusals resolve
themselves. (c) The relationship between the `cooperative` tier and
Mshikano's cooperation graph — two nouns that must never blur.

## The prompt, as received (verbatim)

````markdown
# Builder Prompt — Trace for Cooperatives

Save as `docs/BUILDER-PROMPT-COOPERATIVES.md`.

```markdown
# Trace — Trace for Cooperatives (Builder Prompt)

You are building Trace for Cooperatives: the surface for
SACCOs, chamas, table banking groups, and other collective
economic entities. It is the B2B vertical that turns a
WhatsApp-coordinated chama into a real operating entity.

Kenya has over 300,000 registered cooperatives and an
estimated 1.5 million informal chamas. Almost all of them
coordinate on WhatsApp. Almost none have a real ledger,
real attribution, or a way to bring new members in without
chaos.

This is the vertical that turns a group into an economy.

## The problem it solves

The Kilimani Traders Coop has 47 members. Every week:
- Members contribute KES 500 each to the group fund
- The treasurer records contributions in a notebook
- Someone pays late and nobody knows
- Someone pays early and nobody credits them
- At the annual meeting, the treasurer reads out a total
  that nobody can verify
- Disputes over contributions last for months

The treasurer quits. A new treasurer starts a new notebook.
The old records are lost. Trust collapses. The chama
dissolves.

After this prompt: every contribution is a row. Every member
sees their own balance. The treasurer sees the ledger. The
chairperson sees the annual report. Nobody argues about what
was paid because the record is shared, transparent, and
immutable.

## The distinction from shops and circles

| | Shop | Circle | Cooperative |
|---|---|---|---|
| Owns | Offers, orders | Members, purposes | Members, treasury, shops |
| Has a treasury | No | No | Yes |
| Has governance | No | Coordinator only | Chairperson, treasurer, secretary |
| Regulates itself | N/A | N/A | Yes (constitution, AGM) |
| Files returns | No | No | Yes (to the Ministry or SASRA) |
| Membership is | Customers | Ad-hoc | Formal, with dues |
| Legal entity | Sometimes | No | Yes (registered) |

A cooperative is a **legal entity**. It has a constitution,
an elected leadership, a member registry, and a treasury.
Trace does not make it a legal entity. Trace gives it
infrastructure.

## What you are building (and what you are NOT)

You ARE building:
- A `cooperative` entity with members, leadership, and
  a treasury
- A `cooperativeMember` entity with role, join date, and
  dues status
- A `contribution` entity — periodic member payments into
  the treasury
- A `treasuryLedger` — the cooperative's own accounting
  (separate from the platform ledger)
- A `cooperativeWallet` — a Trace-managed account for the
  treasury, with the same Settlement Rail underneath
- Bulk purchasing at the cooperative level
- A cooperative-wide group buy coordination
- Cooperative-level verification (stronger than shop
  verification)
- A member dashboard and a leadership dashboard
- An AGM surface — the annual report, generated from rows
- Governance: role rotation, tenure limits, voting
- A "meeting" surface — for AGMs and monthly meetings,
  with minutes and voting

You are NOT building:
- A deposit-taking institution
- An investment vehicle
- A loan product (Trace does not lend)
- A crypto or token system
- A securities product
- A savings account with interest
- Anything that requires a banking licence in Kenya

**The treasury is a shared ledger, not a bank account.**
Trace holds the funds via the Settlement Rail only while
they are being moved between members or to vendors. Trace
does not hold deposits.

## Non-negotiables

- **Trace is not a bank.** Every screen and every marketing
  claim says so. The cooperative's treasury is a Trace-
  managed wallet, not a deposit account.
- **No interest is paid.** Funds in the treasury wallet earn
  nothing. If a cooperative wants interest, they keep their
  money at a bank. Trace is the coordination layer.
- **No loans from the treasury.** A cooperative can vote to
  disburse funds (e.g., to a member in an emergency). The
  disbursement is a payment, not a loan. Trace does not
  track repayment because Trace does not lend.
- **Every member can see the treasury balance.** Not just
  the treasurer. Not just the chairperson. Every member.
  Transparency is the whole point.
- **Every contribution is a row.** Not a stored total. The
  total is derived.
- **Every disbursement is a row with a reason.** Members
  vote. The vote is recorded. The disbursement is executed
  via the Settlement Rail.
- **Leadership rotates.** A cooperative cannot have one
  chairperson forever. The constitution sets terms. Trace
  enforces them (banner: "Chairperson's term expires in
  30 days. Hold an election.").
- **A cooperative has between 10 and 5000 members.** Below
  10 is a chama. Above 5000 is a SACCO with SASRA
  requirements. Trace refuses outside this range in v1.
- **A cooperative needs a constitution.** Uploaded once,
  visible to all members. Trace reads nothing from it —
  it's a document, not a data source.
- **AGM is annual and mandatory.** Trace schedules it,
  generates the report, records attendance, and files the
  minutes. If no AGM in 14 months, the cooperative is
  flagged.
- **Member dues are separate from contributions.** Dues are
  for running the cooperative. Contributions are for the
  treasury. Both are tracked. Neither is missed.

## The Cooperative entity

```
COOPERATIVE
├── id
├── name
├── registrationNumber  (nullable — registered with the
│                        Ministry or SASRA)
├── constitutionUrl     (PDF or image — one document)
├── category            ('traders' | 'farmers' | 'boda'
│                        | 'welfare' | 'table_banking'
│                        | 'savings' | 'other')
├── location
├── foundedAt           (ISO — date of founding)
├── registeredAt        (ISO — date of registration, if
│                        registered)
│
├── GOVERNANCE
│   ├── chairpersonId   (userId — current)
│   ├── treasurerId     (userId — current)
│   ├── secretaryId     (userId — current)
│   ├── termEndsAt      (ISO — one term per cycle)
│   ├── termMonths      (integer — default 24)
│   └── constitution
│       ├── minMembers       (integer, default 10)
│       ├── maxMembers       (integer, default 5000)
│       ├── membershipFee    (KES — one-time)
│       ├── annualDues       (KES per year)
│       ├── contributionRate (KES per period — weekly,
│       │                    | biweekly, | monthly)
│       ├── contributionPeriod ('weekly' | 'biweekly'
│       │                    | 'monthly')
│       └── disbursementThreshold (integer — members
│                                 required to vote)
│
├── TREASURY
│   ├── walletId        (the Trace wallet for the coop)
│   ├── balance         (derived — sum of ledger rows)
│   ├── currency        ('KES')
│   └── lastMovementAt  (ISO)
│
├── STATUS
│   ├── status          ('forming' | 'active' | 'dormant'
│   │                    | 'dissolved')
│   └── statusChangedAt (ISO)
│
├── VERIFICATION
│   ├── verifiedAt      (nullable — stronger than shop
│   │                    verification)
│   ├── verifiedBy      (admin user ID)
│   └── expiresAt       (18 months from verifiedAt)
│
└── TIMESTAMPS
    ├── createdAt
    ├── activatedAt     (ISO — when membership reached
    │                    the minimum)
    └── dissolvedAt     (ISO)
```

Status transitions:
```
forming → active     (min members reached + leadership
                     elected)
forming → dissolved  (abandoned before activation)
active → dormant     (no activity for 90 days)
active → dissolved   (members voted to dissolve)
dormant → active     (activity resumed)
dormant → dissolved  (members voted to dissolve)
```

## The CooperativeMember entity

```
COOPERATIVE_MEMBER
├── id
├── cooperativeId
├── userId
├── role                ('chairperson' | 'treasurer'
│                        | 'secretary' | 'member' | 'auditor')
├── joinedAt            (ISO)
├── membershipFeePaidAt (ISO — nullable, until paid)
├── duesStatus          ('current' | 'overdue' | 'exempt')
├── lastDuesPaidAt      (ISO — nullable)
│
├── CONTRIBUTIONS
│   ├── totalContributed (derived — sum of contribution
│   │                    rows)
│   ├── contributionCount (derived)
│   └── onTimeRate      (derived — % of contributions
│                        paid by deadline)
│
├── STATUS
│   ├── status          ('active' | 'suspended'
│   │                    | 'removed' | 'left')
│   └── statusReason    (nullable)
│
└── TIMESTAMPS
    ├── invitedAt
    ├── acceptedAt
    └── removedAt
```

**Member roles are the cooperative's constitution's
business, not Trace's.** Trace enforces:
- Exactly one chairperson (or zero while between terms)
- Exactly one treasurer (or zero)
- Exactly one secretary (or zero)
- Any number of auditors (usually 1–2)
- Any number of members

## The Contribution entity

```
CONTRIBUTION
├── id
├── cooperativeId
├── memberId
├── periodLabel         (e.g., "Week 38, 2026" or
│                        "Sept 2026")
├── amount              (KES)
├── dueAt               (ISO — the deadline)
├── paidAt              (ISO — nullable)
├── paymentMethod       ('mpesa' | 'bank' | 'cash')
├── paymentReference    (the transaction reference)
├── recordedBy          (userId — usually the treasurer,
│                        or the member themselves)
├── status              ('pending' | 'paid' | 'overdue'
│                        | 'waived')
└── notes               (nullable)
```

**Contributions are the heartbeat of the cooperative.**
Every period, every member owes a contribution. The system
tracks who paid, who didn't, and when.

**Late contributions don't vanish.** They stay `overdue`
until paid or waived. A waived contribution requires a
recorded vote (for welfare groups) or a treasurer's note.

## The TreasuryLedger entity

The cooperative's own money. Separate from the platform
ledger but reconciled with it.

```
TREASURY_LEDGER
├── id
├── cooperativeId
├── direction           ('in' | 'out')
├── amount              (KES)
├── category            ('contribution' | 'membership_fee'
│                        | 'annual_dues' | 'disbursement'
│                        | 'vendor_payment' | 'fee'
│                        | 'other')
├── reference           (the row that caused this — a
│                        contribution ID, a disbursement ID,
│                        etc.)
├── recordedBy          (userId)
├── recordedAt          (ISO)
├── notes               (nullable)
└── settlementRowId     (nullable — the Settlement Rail
                         row if money moved through the rail)
```

**The TreasuryLedger is what the members see.** Every
shilling in, every shilling out. With reasons.

## The Disbursement entity

When the cooperative spends money, it's a disbursement.

```
DISBURSEMENT
├── id
├── cooperativeId
├── amount              (KES)
├── recipientType       ('member' | 'vendor' | 'external')
├── recipientId         (userId if member/vendor, or a
│                        name + phone for external)
├── purpose             (free text — required)
├── voteId              (nullable — required if amount
│                        exceeds threshold)
├── approvedBy          (userId — chairperson or treasurer)
├── approvedAt          (ISO)
├── status              ('pending' | 'approved' | 'paid'
│                        | 'rejected' | 'cancelled')
├── paidAt              (ISO — nullable)
└── settlementRowId     (the Settlement Rail row)
```

**Every disbursement has a purpose.** "Buying 40 chairs for
the office" is a purpose. "Misc" is refused at the API.

**Every disbursement above the threshold requires a vote.**
Below the threshold, the treasurer can act. Above, the
members decide.

**The threshold is set in the constitution.** Default: 5,000
KES.

## The Vote entity

Votes are how cooperatives make decisions.

```
VOTE
├── id
├── cooperativeId
├── proposedBy          (userId)
├── type                ('disbursement' | 'constitutional'
│                        | 'leadership' | 'membership'
│                        | 'other')
├── title
├── description         (required)
├── options             (array of { id, label })
├── quorumRequired      (integer — minimum voters)
├── threshold           ('simple_majority' | 'two_thirds'
│                        | 'unanimous')
├── opensAt             (ISO)
├── closesAt            (ISO)
├── status              ('open' | 'closed' | 'cancelled')
├── result              (nullable — the winning option)
└── timeline            (array of actions)
```

**Votes are time-bound.** Default: 72 hours. No vote is
open indefinitely.

**Votes are transparent.** Every member sees the question,
the options, the votes cast, and the result. Secret
ballots are not supported in v1 — the whole point of a
cooperative is transparency.

**Votes are non-binding unless the constitution says
otherwise.** A vote to spend 20,000 KES needs the
treasurer to execute it. The vote expresses intent. The
treasurer executes. If the treasurer refuses to execute a
passed vote, that's a governance issue, not a Trace issue.

## The Cooperative Wallet

Every cooperative has a Trace-managed wallet. It is:

- **Funded by** member contributions and membership fees
- **Spent by** disbursements and vendor payments
- **Held by** Trace via the Settlement Rail
- **Visible to** every member at all times

**The wallet is not a bank account.** Trace does not pay
interest. Trace does not lend from it. Trace does not
invest it. Trace holds it until the cooperative spends
it.

**Disbursement mechanics:**

```
Member contributes KES 500
  → Settlement Rail collects from member's M-Pesa
  → Funds land in the cooperative's wallet
  → TreasuryLedger records: in, KES 500, contribution

Cooperative votes to spend KES 20,000 on chairs
  → Vote passes
  → Treasurer approves the disbursement
  → Settlement Rail disburses KES 20,000 to the vendor
  → TreasuryLedger records: out, KES 20,000, disbursement
```

Both sides are real rows. Both are visible to every member.

## The member dashboard

Every member sees:

```
┌─────────────────────────────────────┐
│  Kilimani Traders Coop              │
│  Member since 15 March 2026         │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  YOUR CONTRIBUTIONS                 │
│  Total:    KES 12,500               │
│  On time:  47 of 50 (94%)           │
│  Overdue:  1 (Week 38)              │
│  [ Pay now → ]                      │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  COOPERATIVE TREASURY               │
│  Balance:  KES 87,450               │
│  Members:  47                       │
│  This month: +KES 23,500 in,        │
│              -KES 12,000 out        │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  ACTIVE VOTES                       │
│  · Buy 40 chairs · 45 yes, 2 no     │
│    Closes in 18 hours               │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  UPCOMING                           │
│  · Monthly meeting: 5 Oct 18:00     │
│  · Contribution due: 6 Oct          │
│                                     │
└─────────────────────────────────────┘
```

**Every number is derived.** Every action is a button.

## The leadership dashboard

The chairperson, treasurer, and secretary see more:

```
┌─────────────────────────────────────┐
│  Kilimani Traders Coop              │
│  Chairperson view                   │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  THIS WEEK                          │
│  Contributions received: 42 of 47   │
│  Overdue: 5 members                 │
│  [ Send reminders ]                 │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  TREASURY                           │
│  Balance:  KES 87,450               │
│  In (30d):  KES 82,500              │
│  Out (30d): KES 12,000              │
│  Projected (30d): +KES 70,500       │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  MEMBERS                            │
│  Active:    47                      │
│  Overdue:   5                       │
│  Suspended: 0                       │
│  [ Manage members ]                 │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  GOVERNANCE                         │
│  Your term ends: 15 March 2028      │
│  Next AGM: 15 March 2027            │
│  [ View constitution ]              │
│                                     │
└─────────────────────────────────────┘
```

**The chairperson does not see other members' individual
balances.** Only the aggregate. Individual contributions
are visible only to the member themselves and to the
treasurer (who records them).

**Transparency is for the aggregate, not for individuals.**
A member's contribution history is private to that member
and to the treasurer. What's public is the total, the
movements, and the votes.

## The AGM surface

Once a year, the cooperative holds its AGM. Trace generates
the report:

```
┌─────────────────────────────────────┐
│  Kilimani Traders Coop              │
│  Annual General Meeting 2026        │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  MEMBERSHIP                         │
│  Started the year:  38              │
│  Joined during year: 12             │
│  Left during year:   3              │
│  Ended the year:    47              │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  CONTRIBUTIONS                      │
│  Total received:    KES 512,500     │
│  Members current:   42 of 47 (89%)  │
│  Members overdue:   5               │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  TREASURY                           │
│  Opened the year:   KES 45,000      │
│  Received:          KES 512,500     │
│  Disbursed:         KES 470,050     │
│  Closed the year:   KES 87,450      │
│                                     │
│  LARGEST DISBURSEMENTS              │
│  · Chairs for the office: 20,000    │
│  · Water pump repair:      8,500    │
│  · Emergency (member):     5,000    │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  VOTES HELD                         │
│  14 votes · 47 members · avg 89%    │
│  participation                      │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  [ Download PDF ]  [ File with      │
│                      Ministry ]     │
│                                     │
└─────────────────────────────────────┘
```

**Every number is derived from rows.** The report is not
written by anyone — it's computed. The treasurer doesn't
need to prepare anything. The chairperson doesn't need to
verify anything. The members see the same report.

## The cooperative verification

Stronger than shop verification. A cooperative is verified
by an admin after:

1. The constitution is uploaded
2. The chairperson, treasurer, and secretary are real
   (verified IDs)
3. The cooperative is registered (registration number
   provided) OR it's a registered chama with 10+ members
4. A field agent visit OR a video call with leadership
5. The registration document matches the Trace record

Verified cooperatives get:
- A ✓ on their cooperative page
- Priority for group buys
- Priority for bulk purchasing through the platform
- Access to the "Cooperative Directory" (a curated list
  of verified cooperatives, used by vendors who want to
  sell to cooperatives)

**Verification expires in 18 months.** Renewal requires a
new check.

## The cooperative directory

A public listing of verified cooperatives:

```
┌─────────────────────────────────────┐
│  Cooperatives                       │
│                                     │
│  [ Traders ] [ Farmers ] [ Boda ]   │
│  [ Welfare ] [ Table Banking ]      │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  Kilimani Traders Coop ✓            │
│  Traders · Kilimani · 47 members    │
│  Founded 2024 · Registered          │
│                                     │
│  [ View ]                           │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  Kiambu Farmers Cooperative ✓       │
│  Farmers · Kiambu · 128 members     │
│  Founded 2019 · Registered          │
│                                     │
│  [ View ]                           │
│                                     │
└─────────────────────────────────────┘
```

**Why a public directory?** Because vendors want to find
cooperatives to sell to. Because cooperatives want to be
found by vendors. Because the directory is the bridge
between bulk demand and bulk supply.

## The WhatsApp-first cooperative

Like the rest of Trace, the cooperative surface works via
WhatsApp:

```
MEMBER: HABARI

TRACE: Karibu Kilimani Traders Coop.

       Your balance: KES 12,500
       This week's contribution: KES 500
       Due: 6 Oct

       Reply PAY to pay now.
       Reply STATUS to see the cooperative.
       Reply VOTE to see active votes.

MEMBER: PAY

TRACE: Paying KES 500 for Week 38, 2026.

       M-Pesa request sent to 0712 345 678.
       Enter your PIN to complete.

MEMBER: [pays]

TRACE: ✓ Contribution received.

       Week 38: KES 500 paid
       New balance: KES 13,000

       Reply STATUS anytime.
```

**Every cooperative action works via WhatsApp.** No app
required. The app is the nicer interface for those who
have it.

## What to remove from the current surface

- Any "Circle" that acts like a cooperative but has no
  treasury, no governance, and no member registry. Replace
  with a Cooperative when those exist.
- Any hardcoded "chama" labels that aren't backed by a
  Cooperative row.
- The old "table banking" navigation item if it isn't
  wired to the Cooperative entity.

## Test requirements

- A cooperative with 9 members cannot activate. Minimum
  is 10.
- A cooperative with 5001 members cannot be created.
  Maximum is 5000.
- Exactly one chairperson, one treasurer, one secretary
  at a time. Attempting to have two is refused.
- A contribution is recorded as a row. The treasury
  balance is derived, never stored.
- A contribution marked `paid` via the Settlement Rail
  moves money into the cooperative wallet.
- An overdue contribution stays overdue until paid or
  waived.
- A disbursement above the threshold requires a vote. A
  disbursement below the threshold requires only the
  treasurer's approval.
- A vote opens and closes on schedule. Votes don't stay
  open indefinitely.
- A vote's result is derived from real vote rows.
- Every member sees the treasury balance. A member cannot
  see another member's contribution history unless they
  are the treasurer.
- The AGM report is generated from rows. No manual entry
  is required.
- A cooperative that hasn't held an AGM in 14 months is
  flagged.
- Leadership terms are enforced. A chairperson whose term
  has ended is shown as "Term expired" until re-elected
  or replaced.
- A cooperative with no activity for 90 days is marked
  `dormant`.
- A dissolved cooperative's history remains, but no new
  contributions or disbursements are possible.
- The cooperative wallet is NOT a bank account. No
  interest is paid. No loans are made from the treasury
  without an explicit vote and the fact that it's a
  disbursement, not a loan.

## The one rule

A cooperative is a legal entity with members, a
constitution, a treasury, and a governance process. Trace
gives it infrastructure. Trace does not give it a licence.
Trace holds no deposits. Trace lends nothing.

What Trace does: it makes every contribution a row, every
disbursement a vote, every member a name, every year a
report.

What Trace refuses: to be a bank. To lend. To take custody
of funds beyond a transaction. To be SASRA-regulated (that
happens at the cooperative's own level, not Trace's).

## Order of operations

1. `cooperative` entity + status state machine.
2. `cooperativeMember` entity + roles.
3. `contribution` entity + period tracking.
4. `treasuryLedger` entity.
5. `disbursement` entity + approval flow.
6. `vote` entity + open/close lifecycle.
7. The member dashboard.
8. The leadership dashboard.
9. The AGM report generator.
10. The cooperative verification flow.
11. The cooperative directory.
12. WhatsApp-first commands for cooperative actions.
13. Leadership term enforcement.

Each step ships separately. Each step has its own test.

## What this unblocks

- Cooperatives have real infrastructure, not WhatsApp
  chaos.
- Members can see the treasury without waiting for the
  AGM.
- Treasurers can't fabricate records.
- Chairpersons can hold votes without paper.
- The AGM report is computed, not written.
- A cooperative can be found by a vendor who wants to
  sell to it.
- Bulk purchasing happens at the cooperative level, not
  the individual level.
- B2B revenue has a new vertical: cooperative
  subscriptions (once the revenue model is defined).
- The "group buy" feature has its highest-value use case:
  47 members pooling demand for a bulk order.

## Reference

A shop is one person selling. A cooperative is many
people pooling. Trace for Cooperatives is the surface for
the pooling. Not a bank. Not a lender. A treasury
coordination layer.

Kenya has 300,000+ cooperatives and 1.5 million chamas.
Almost all of them coordinate on WhatsApp. Almost none
have real infrastructure.

Ship this. Then the biggest economic block in Kenya has
a home.
```

---

## Why Trace for Cooperatives, Next

You said it yourself earlier:

> *"B2B is the way to go... B2C is dead market."*

And you said the ICP is the semi-literate entrepreneur
with ambition — but the **buyer** who has real budget in
Kenya is not the individual shop. It's the **cooperative**.

Cooperatives:
- Have real money (KS 300 billion in assets in Kenya)
- Have real governance needs (AGM, constitution, votes)
- Have real budgets (they pay for accounting software, SACCO systems, legal compliance)
- Are aggregators (one cooperative brings 47 members onto the platform)
- Are regulated (they must file returns, which means they need real records)
- Are underserved (current tools are either paper or expensive Western software)

**Trace for Cooperatives is where the B2B revenue lives.**
A single cooperative subscribing for KES 5,000/month is
more valuable than 1,000 individual shop owners using a
free tier.

And it directly serves the semi-literate entrepreneur: the
member of a cooperative who has no app, no website, no
ledger — but has a chama that he belongs to. Trace gives
him the chama's infrastructure, via WhatsApp, in Swahili,
without requiring him to learn anything new.

**This is the B2B vertical.** Ship it after the Settlement
Rail and Team & Roles.

---

## Where We Are Now

Seventeen builder prompts delivered:

| # | Prompt | Depends on |
|---|---|---|
| 1 | Shop Brief | Team & Roles |
| 2 | Settlement Rail | — |
| 3 | Nearby | — |
| 4 | Shopping Run Stream | Nearby + Rail |
| 5 | Invite-a-Shop | Nearby + Rail |
| 6 | Events & Ticketing | Rail |
| 7 | Partner Onboarding | Rail |
| 8 | Team & Roles | — |
| 9 | Verification Flow | — |
| 10 | Dispute Resolution | Rail + Verification |
| 11 | Reviews | Rail + Disputes |
| 12 | Group Buy Streams | Rail + Verification |
| 13 | Consumer Profile | Orders + Rails |
| 14 | WhatsApp Integration | Everything |
| 15 | Navigation Refactor | — |
| 16 | Notification System | Everything |
| 17 | Trace for Cooperatives | Rail + Team + Verification |

**Remaining prompts:**

1. **The Space Editor v2** — public page editing with history
2. **The Trace Card** — the shop's physical card
3. **The Field Agent App** — the agent's surface in depth
4. **The Protection Fund** — the pool that covers failed wholesalers and disputes

Say **"next"** and I'll pick the highest-leverage one. Or name it.
````

## Operator note

Every prompt in this series has met something already standing; this one
met the thing itself. The prompt's problem story — a treasurer's notebook,
an unverifiable annual total, records lost when the treasurer quits — is
the exact scenario `tableBanking.js` was written against, and its answer
is stricter than the prompt's: not only is every contribution a row, the
row carries a receipt hash; not only is the total derived, the payout that
moves money needs a maker and a *different* checker; not only can the
treasurer not fabricate, the group's money never sits on Trace's books at
all. "Brief holds none of that money" is the sentence this whole vertical
rests on, and it is the one sentence in the prompt the wallet section
would have undone.

What the prompt has that the tree lacks is worth having, and it is
narrower than the prompt thinks: governance. Terms and rotation. A general
vote with a clock. An annual report computed from rows and a flag when a
year goes by without one. Dues distinct from contributions. That is the
build — an extension of the standing spine, in the standing words
(`forming`, `active`, `dormant` are already `CIRCLE_STATUS`), against the
standing suites, with quote votes rebased as the first instance of the
general ballot.

Three things now wait on the operator's pen: the directory (public face
versus browsable marketplace — a product decision the surface's own header
currently refuses), the documents rule (four askings: Verification,
Partners, WhatsApp, Cooperatives — decide once with retention limits), and
the wall. The disbursement section of this prompt, the Events payouts, the
settlement refunds, the group-buy merchant escrow, and now the treasury's
KES 20,000 for chairs all end at the same place: `buni.js:332`,
`transfer_contract_unverified`, manual and finance-confirmed until KCB's
contract arrives in writing. The B2B vertical's money-out is a letter the
operator has not yet received — the series has now drawn it seven times.

The recap promoted a second phantom: the Notification System now appears
in the delivered table, one row above Cooperatives, depending on
"Everything." Group Buy Streams enters its fifth recap as delivered. The
honest count is sixteen received of seventeen claimed — and the tree's
irony this time is that the delivered-looking rows are the missing ones,
while the row that arrived describes the most-built system in the repo.

---

*Coda — the prompt ends: "Ship this. Then the biggest economic block in
Kenya has a home." The tree's version is quieter and already load-bearing:
a group's pool is derived from recorded contributions, payouts, loans and
repayments every time it is read, and Brief holds none of that money. That
sentence is in the product's own teaching, under "Circles, chamas and the
operator read," tested seventy-eight ways on the client and eleven on the
server. What this prompt truly brings is not the home — the home was
built when the merry-go-round became arithmetic and the notebook became
hashes. It brings the constitution: the terms, the ballot, the annual
report, the flag when a year passes without a meeting. Infrastructure
keeps the money honest. Governance keeps the group alive. Build the
second onto the first — and keep holding none of it.*
