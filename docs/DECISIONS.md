# DECISIONS — the operator's written decisions, 2026-09-21

Received in the Decisions + Report message of 2026-09-21 and recorded here
as the operator's law. **The convention that makes this file work:** the
prompt archive in `docs/BUILDER-PROMPT-*.md` is preserved verbatim — it is
the record of what was ASKED, and every refusal is checked against it.
**This file is the record of what is DECIDED.** Where a decision overrides
a prompt, the prompt is not edited; the override lives here and wins at
build time. Nine open items closed in one sitting; three corrections
applied; the phantom count is addressed in `SERIES-LEDGER.md` §3.

---

## Decision 1 — Reviews aggregate scope

**Decision:** The 5-review minimum and the ★ aggregate apply **only to shop
public pages**. Events, Group Buys, and Cooperatives have **no rating** in
v1. Not "coming soon." Not "collecting." Nothing.

**Rationale:** A rating needs five real reviews to mean anything. Events
sell tickets once — nobody reviews them twice. Group buys are one-off.
Cooperatives are institutions, not products. Inventing a rating for any of
these would create a number with no row behind it. The tree's own refusal
("no member rankings") extends to this.

**So what:** Remove every "★" reference from Events (#6), Group Buys (#12),
and Cooperatives (#17). Shop pages keep theirs. Nothing else does.

*Verification note:* the stored Events prompt's two ★ are the featured
markers — killed outright by Decision 6. The stored Cooperatives prompt
contains zero ★ (its ✓ is the verification badge, kept per Decision 8).
Group Buys has no stored prompt to edit (see ledger §3). Under "only to
shop public pages," the three shop-adjacent surfaces that were waiting on
this decision (Nearby card, share preview, messaging list) do not print
the aggregate. This closes the Reviews record's central open question; the
`errands.js` comment gets its answer.

## Decision 2 — Documents / ID rule

**Decision:**

- Accept: JPG, PNG, PDF (PDF only for full documents, not for IDs)
- Reject: >10MB files, any file whose EXIF has been stripped, screenshots
  (detected via missing camera metadata), anything that isn't a real photo
  from a camera
- ID capture: front only, no back, one photo, one document
- Store: encrypted at rest, path-scoped, deleted 90 days after
  verification completes

**Rationale:** This is the fourth asking. Without a rule, every surface
invents one. With a rule, IDs are captured consistently, verified
consistently, and deleted consistently.

**So what:** Every surface (Verification #9, Partner #7, Field Agent #20,
Cooperative #17) points to this file. No prompt restates it.

*Verification note:* the four askings are now one rule. Until built, the
structured-facts middle path remains the standing behaviour; the 90-day
deletion is a named constant when it ships.

## Decision 3 — Phone-as-account

**Decision:** Phone number is the account. No email required. Ever. Shop
owners may optionally add email for receipts; consumers never do.

**Rationale:** Kenya runs on phone numbers. Email is a Western account
abstraction. Requiring it is friction with no benefit.

**So what:** Confirmed. Every "enter your email" mention in Consumer
Profile (#13) is overridden. Shop onboarding (#4) may offer email as
optional.

*Verification note:* the stored Consumer Profile prompt already argued this
— line 268: "The consumer's phone number is their identity. No email." The
decision confirms the prompt's own position. Build consequence carried from
the records: extend `auth.js`/`authProvider`, never fork; the migration
path is a build-time obligation.

## Decision 4 — STT provider

**Decision:** **Whisper API** (OpenAI).

**Rationale:** Best Swahili accuracy, one HTTP call, no infrastructure.
Azure and Google are heavier, and neither is significantly better for
Kenyan English or Swahili.

**So what:** WhatsApp (#14) voice notes name their provider: OpenAI
Whisper. No other STT integrations considered.

*Verification note:* the WhatsApp record's thresholds (≥.85 proceed /
.60–.85 confirm / <.60 retry) become the working spec with a named
provider. Receiving a voice note still gates on the missing inbound rail
(ledger §5) — the provider unblocks transcription, not delivery.

## Decision 5 — Field agent pay

**Decision:** **KES 150 flat per approved visit.** No bonus. No volume
tier. No speed incentive. No quality multiplier. One number.

**Rationale:** Anything else creates gaming. Agents shouldn't compete on
number of shops visited — they should visit honestly. A flat fee is the
only structure that makes the job about accuracy, not throughput.

**So what:** Field Agent (#20, reported) gets its four pending numbers
replaced by one. Rejected visits don't pay. Approved visits pay 150.
Weekly payout. That's the whole structure.

*Verification note:* `fieldAgent.js` (17 suite asserts) carries the four
pending numbers; the decision replaces them at build time.

## Decision 6 — Events scoping

**Decision:**

- **Transferable:** Opt-in per event (host's choice). When opted-in, the
  ticket can be *given* to someone else. It cannot be *sold* through
  Trace. No resale flow. No transfer marketplace.
- **Featured events:** None. No promoted events. No featured slot. Sorting
  is `startsAt` ascending. Period.
- **Social proof:** None. No "X going." No attendee names. No view count.
  Only "27 of 40 seats remaining."

**Rationale:** Every other platform adds these to drive engagement. They
don't drive sales; they drive FOMO, and FOMO doesn't pay the host. Keep
events honest.

**So what:** The decision closes the gap the Events record left: 
transferable is allowed; resale is not.

*Supersession note (recorded plainly):* this overrides the Events record's
interim stance that featured = organiser choice via `events.js`
`setFeatured`, ban scoped to platform-sold slots — the operator has
decided stronger: no featured slot anywhere. As written, "no attendee
names" also ends the record's sparing of the per-viewer circle overlap.
Tree consequence: `events.js` (`setFeatured`, the featured filter at
:121/:144) and the gallery's "featured only" filter are standing code the
build must re-point or remove; surfaces sort `startsAt` ascending. The
give-not-sell rule answers the transferable-vs-`ticketMarket` question:
the market stays unbuilt.

## Decision 7 — Drawer philosophy

**Decision:** **Settings-only. No overflow. No dedupe.**

The side drawer holds:

- Your Area (setting)
- Language (setting)
- Notification preferences (setting)
- Privacy (setting)
- How Trace works (help)
- Account and Sign out

**Nothing else.** No "Your Work." No "Requests." No "Supply." No
"Partners." No "Standing." No "Earn." Every one of those belongs in a
destination.

**Rationale:** The bottom nav has 5 items. The side drawer is not a second
nav. If a feature doesn't belong on the bottom nav, it belongs in a
destination. If a feature isn't a destination, it isn't in the drawer
either.

**So what:** The Navigation Refactor (#15) proposed this; this decision
locks it as final. Every prompt that proposed a drawer item is overridden
here.

*Build-order note (from the record the decision resolves):* moved-not-
deleted still governs — Requests, Supply and Partners must gain their
Spaces homes **before** the sheet lines are removed (`appbelt.jsx` asserts
the copy moved, not deleted); Standing and Earn already live in You, so
their two sheet lines can be removed cleanly. Language is gated on the
i18n rail or prints the truth; Notification preferences are the re-homing
of the real harness control; Privacy is the `personal.js` door. The
six-entry assertion is re-cut when this ships.

## Decision 8 — Cooperative directory

**Decision:**

- **Per-cooperative public page:** Yes. Each cooperative has a page at
  `trace.africa/g/<handle>`. Public. It shows the cooperative's name,
  category, location, founding date, and — if verified — the badge.
- **Browsable list of cooperatives:** No. No "Cooperative Directory." No
  vendor-facing marketplace of cooperatives. No "Find a cooperative near
  you."

**Rationale:** The tree's own refusal stands: *"Brief is NOT the group and
NOT a directory of groups."* A directory of cooperatives turns Trace into
a network of institutions. That's a different product. A public page per
cooperative is what the shop precedent already provides.

**So what:** The Cooperatives prompt's directory section is overridden
(deleted at build time). The public page section stays. Vendors who want
to find cooperatives use the same search as anyone else.

*Verification note:* this resolves the ledger's directory question on the
side the standing surface already defends. The ✓ badge survives here.

## Decision 9 — `cooperative` vs Mshikano namespace

**Decision:**

- **Internal code namespace:** `cooperative` (full word). Free, unique,
  doesn't collide.
- **User-facing labels:** Depends on the group. A chama uses "chama." A
  SACCO uses "SACCO." A farmer's group uses "cooperative." Trace uses the
  group's own word.
- **URL handles:** `trace.africa/g/<handle>` (not `/c/` — that's the card).

**Rationale:** The tree already has `coop.js` as Mshikano (a
peer-cooperation network). Code needs to distinguish. Users don't. The
internal name is `cooperative`; the label is whatever the group calls
itself.

**So what:** Cooperatives' internals use `cooperative`, never `coop`. The
user-facing UI stays flexible. `/c/` is reserved for the Trace Card.

---

## The three corrections (the tree dictates, the operator applies)

### Correction A — No cooperative wallet. A ledger instead.

- **No standing wallet.** Trace holds no floating balance for a
  cooperative.
- **A cooperative ledger.** Every contribution is a receipt-hashed row.
  Every disbursement is a row. The treasury balance is *derived* by
  summing the rows.
- **Per-transaction money movement.** When a member contributes, money
  moves from the member's M-Pesa to the cooperative's *bank account* (not
  Trace's). When the coop disburses, money moves from the coop's *bank
  account* (not Trace's) to the recipient.
- **Trace holds nothing.** Between transactions, the money sits in the
  cooperative's own bank account. Trace records the movement. Trace does
  not custody the money.

*Note:* this aligns with the Cooperatives record's refusal and extends it —
the resting place is named: the group's own bank account, not a Trace
side-account. Money-out remains behind the Buni wall
(`transfer_contract_unverified`) until KCB's contract arrives in writing.

### Correction B — Trace tracks member-to-member loans

- **Trace does not lend.** Correct, and unchanged.
- **Trace does track member-to-member loans.** A member can lend to
  another member. The cooperative's ledger records the schedule, the
  guarantors, the repayments, and any default.
- **This is compliant.** Trace never uses its own balance to lend. Trace
  never takes credit risk. Trace simply records a loan between two people,
  the same way a chama's notebook would.

*Note:* matches the record exactly — the ledger is not the lender.

### Correction C — Cooperative minimum is 5, not 10

- **Minimum: 5 members** for the cooperative tier. A 5-member group is a
  chama. Refusing them would refuse core audience.
- **Maximum: 5000 members.** Above this, SASRA regulation applies; Trace
  refuses and directs to a SACCO-appropriate tool.
- **No minimum for "chama."** A 3-person table banking group is possible;
  they just don't get the cooperative-grade features (AGM scheduling, term
  limits).

*Note:* matches the record's amendment; the gate applies to the
cooperative tier only and never to the standing table-banking surfaces.

---

## What this file resolves

All nine open operator decisions from `SERIES-LEDGER.md` §5 are closed:
the Reviews aggregate (shop public pages only), the documents rule (one
rule, four askings answered), phone-as-account (the phone IS the account),
the STT provider (Whisper), field-agent pay (KES 150 flat, approved
visits, weekly), Events scoping (opt-in give-only transferable, no
featured, no social proof), the drawer (settings-only), the directory
(public pages yes, browsable directory no), and the namespace
(`cooperative` internal, the group's own word external, `/g/` handles,
`/c/` reserved).

Still awaited, unchanged: the KCB Buni disbursement contract, the inbound
WhatsApp/SMS rail, an i18n rail. The phantom count stands at two until the
two prompt texts actually arrive — see `SERIES-LEDGER.md` §3.
