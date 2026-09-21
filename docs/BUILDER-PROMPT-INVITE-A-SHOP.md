# Trace — The Invite-a-Shop Referral Loop (Builder Prompt)

> Status: **mostly built — as the field-agent program.** The mechanism this
> prompt describes (a bounded share for whoever brings a shop in, paid only
> from settled trades, one referrer, one level, clean termination) is
> `server/src/domain/fieldAgent.js`: **0.75%** (`OVERRIDE_RATE = 0.0075`) for
> **24 months** (`OVERRIDE_MONTHS = 24`), first-touch-wins, self-claim
> refused, derived from settled orders, money only through finance-confirmed
> settlement. The invite rail is `invites.js` ("one primitive, nine rungs").
> The member-referral points pool is `referrals.js`. What is genuinely new:
> the resident-facing WhatsApp invite with a shop confirmation screen, the
> monthly statement, the termination doors, the referrer gate.
>
> Two forks are real money and must be decided before any build: **the base
> of the 0.75%** (settled order value in the tree, platform fee in the
> prompt — twenty times apart) and **when the 24-month clock starts** (claim
> date in the tree, first settled trade in the prompt). Read **Corrections
> first**. Verified against the tree on 2026-09-21; `fieldAgent.mjs` re-run
> green, 17 PASS.

---

## Corrections first (what was changed, and why)

1. **The mechanism exists — `fieldAgent.js`.** Riders and door-to-door agents
   claim a vendor two ways: `menu_upload` (a one-off bounty, 100 points,
   once per vendor, ever) and `full_registration` (the 24-month override).
   The honesty rules are the prompt's, already in code: first-touch-wins —
   "attribution is a fact, not a prize to be re-raced"; depth stays at one —
   "there is no upline anywhere in this module"; the override is DERIVED
   from settled orders only, floor(rate × settled value) inside the window,
   nothing stored as a balance; money moves only through a finance-confirmed
   settlement that writes a real ledger transaction (`field_agent_override`);
   a vendor owner cannot claim their own shop. Surface: `routes/fieldAgent.js`
   (feature-gated, including the ops reads), a member-facing earnings surface
   in `EarnSurface.tsx`, and `fieldAgent.mjs` — 17 PASS, re-run today.

2. **The base of the 0.75% is a twenty-fold fork.** The tree pays 0.75% of
   the merchant's **settled order value** (`Math.floor(OVERRIDE_RATE *
   grossKes)`). The prompt pays 0.75% **of the platform fee** — "if the
   platform takes 6%, the referrer takes a slice of that 6%." At KES 100,000
   settled in a month: the tree pays the referrer **KES 750**; the prompt's
   version pays **KES 37.50** at the repo's actual default commission
   (`DEFAULT_COMMISSION_RATE = 0.05` — the prompt's 6% example is not the
   repo's number) or KES 45 at 6%. Same headline percentage, twenty times
   the money. Both respect "the shop never pays more"; they are different
   distribution budgets, and the tree's own comment places the override
   inside "the distribution budget (the 6.5% cap in `referrals.js`)" — the
   prompt's fee-of-fee scheme is the *smaller* spend. Decide which the
   business means, write the base into the claim row, derive from it. The
   prompt's mockup statement (KES 24 a month per shop) is only consistent
   with the fee-of-fee version — the tree's version would print numbers
   about twenty times larger.

3. **When the clock starts is the second fork.** The prompt: `expiresAt`
   becomes 24 months from `firstTradeAt` — the shop's first settled trade.
   The tree: `expiresAt` is set at **claim time** (`expiresAtOf(Date.now())`
   in `claimVendor`/`onboardVendor`) — a shop that registers and takes six
   months to trade eats six months of the referrer's window. The prompt's
   clock is fairer to the referrer; the tree's is simpler to reason about.
   Pick one, and since the window governs a derived read, it is one
   comparison in one function — but it is a promise made to whoever walks
   the street, so it cannot stay ambiguous.

4. **The invite rail exists — `invites.js`.** "One primitive, nine rungs":
   every onboarding is an invite with `issued_by`, `grants_role`
   (`vendor` and `field_agent` are both invitable), `grants_scope`,
   `attribution_key` (immutable provenance), **mandatory** `expires_at`
   ("every invite dies"), and single-use for privileged roles. Issuance is
   role-bounded; redemption writes attribution **once** (first-touch-wins)
   and never re-captures it. The prompt's `inviteToken` (single-use, 30-day
   expiry, permanent attribution) is this primitive, re-derived. The build
   is a rung on it — never a second token system with a second expiry rule.

5. **The top of the funnel is the genuinely new part — and it touches
   identity.** `onboardVendor` creates the vendor **under the agent's
   identity** (the current 1:1 person↔vendor model), claim recorded
   atomically; the shop confirms nothing because the shop did not sign up —
   the agent did it for them. The prompt's flow inverts this: the shop
   registers itself through the WhatsApp link, sees "{{referrerName}}
   invited you," and chooses `Accept` / `Sign up without a referrer`. That
   confirmation screen is new code and a new attribution path — referrer ≠
   owner-of-record — and it must reconcile with the 1:1 model, with
   `handoff.js`'s token binding, and with the field-agent claim so there is
   exactly one claimant per shop, whichever door brought it in. No silent
   attribution is already the invites.js rule ("written once on
   redemption").

6. **The invite message overclaims against the rails.** "Every order you
   take through it is settled by M-Pesa" is not true of this build:
   collection runs through KCB Buni STK when configured; **disbursement is
   refused in code** until KCB publishes the transfer body
   (`buni.js:335`); payouts are manual and finance-confirmed; money that
   moved outside Trace is recorded, not moved, by Trace. The prompt's own
   rule — "every claim in the message is true" — applied to the tree
   rejects the sentence. The message must be derived from the same truth
   `providerStatus()` states, or not sent. Likewise "Set up takes 3
   minutes" is unmeasured — either measure it or drop it — and "0.75% of
   6%" is wrong twice (the base, per correction 2, and the rate).

7. **The earning row, as specified, is the stored-tally pattern.** A stored
   `referralEarning` row per settled trade re-creates the second source of
   truth the Shop Brief build refused. The tree's answer is better and
   already tested: `overrideObligation(agentId)` derives each claim's
   override on read ("not money until a settlement is recorded and
   confirmed by finance"), and the only stored money facts are
   finance-confirmed settlement rows. Keep that. The monthly statement is
   then computed on read, and the prompt's own test — "no duplicate rows
   for the same trade" — holds by construction, because there are no
   earning rows to duplicate.

8. **Termination is half-built.** `CLAIM_STATUS` carries `revoked`, but
   nothing sets it — there is no revoke door, no reasons, and no
   dispute-rate gate (no dispute rows exist anywhere to threshold on; a
   "dispute rate above threshold" needs rows that don't exist — the Shop
   Brief's flags law applies: if there's no row, no threshold fires).
   Self-referral is refused at entry (`self_claim`), but there is no
   later-discovered-affiliate terminator. The prompt's three terminators
   are new code. Its boundary rule, though, is already the house law: no
   claw-back — "past is settled, future is not" — the same rule as the
   ledger, and the same shape as the field-agent settlement's
   refuse-with-reason path.

9. **Payout cadence: the statement is buildable, the automation is not —
   yet.** Monthly batching and the KES 100 rollover threshold are new and
   honest. But "automatic disbursement via the Settlement Rail" cannot fire
   today: the standing seam refuses B2C until KCB's letter, and
   `BUILDER-PROMPT-SETTLEMENT.md` records what that means — `pending_manual`
   rows, finance confirmation, and a statement that says the payout was
   recorded, not automated. A threshold that silently claims an automatic
   payment would be exactly the fake success the prompt bans.

10. **The referrer gate tightens the tree, and half of it has no rows to
    stand on.** Current rule: any authenticated member under the
    `field_agents` feature flag is an agent ("Claims are a member act").
    The prompt: a settled trade of their own in the last 90 days, or a
    verified shop of their own. The first half is derivable from order
    rows. The second is not — **shop verification does not exist** (only
    person verification does; see `BUILDER-PROMPT-NEARBY.md`, correction
    4). Build the gate on rows that exist, or build shop verification
    first.

11. **`shopId`, once more.** The `REFERRAL` and `REFERRAL_EARNING` entities
    key on `shopId`. The parent decision is recorded twice now (Shop Brief,
    Nearby): **the vendor is the parent**; "shop" as an entity name is
    taken by the WhatsApp shop builder. Key referrals and earnings to
    `vendorId`.

12. **Removals are preventive; mockups are shape.** No "invite 3 shops to
    unlock X" pattern exists, no referrer leaderboard, no automated
    referral spam (`position.js` has no ladder; the earnings surface
    renders derived rails only). Nothing to delete — the list is a fence,
    and a good one. The Nearby record's correction 9 said this exact
    decision had to be made against the existing rails; this file is that
    decision being faced.

---

## The prompt's test requirements, mapped

| Required by the prompt | Where it stands |
| --- | --- |
| invite via WhatsApp creates a `pending` row | new — as a rung on `invites.js` (correction 4), not a second token system |
| invite expires after 30 days unaccepted | half held — mandatory expiry is the primitive's law; the `pending → expired` transition on the referral row is new |
| accepting links the shop to the referrer | new — the confirmation-at-registration flow (correction 5) |
| an ignored invite stays unlinked | held in spirit — attribution is written once, on redemption, never implied |
| activation only after the first settled trade | the tree is stricter — overrides derive from settled orders only; the named `active` state is new |
| one earning row per settled trade, no duplicates | held by construction — derived on read, no earning rows exist to duplicate (correction 7) |
| self-referral refused at the API | **held** — `self_claim` refusal in `claimVendor`; carry the same check into the new redemption path |
| no referrer switch; first accepted is permanent | **held** — first-touch-wins, immutable attribution, `already_claimed` refusal |
| fraud termination stops earnings | new — the revoke door with reasons (correction 8) |
| expires 24 months from `firstTradeAt` | fork — the tree expires from claim date (correction 3); decide before building |
| statement shows per-shop earnings, no hidden aggregates | new, derived on read — per-shop lines are exactly what `overrideObligation` returns per claim |
| KES 100 threshold; above it, auto-disburse | threshold new; disbursement is `pending_manual` until the rail exists (correction 9) |

## What is genuinely new here

The resident-facing invite: the form (name, type, WhatsApp number), the
message derived from what the rails actually do, the link as an
`invites.js` rung · the shop's confirmation screen at registration · the
referral status row over the field-agent claim · the monthly statement
generator · the revoke door with recorded reasons · the referrer gate ·
the payout threshold. Underneath all of it, the hard part is done and
tested: the bounded share, the one-claimant rule, the settled-money-only
derivation, the finance gate. This prompt is the consumer twin of a
program the repo already bet on — the work is the doorway, not the
engine.

---

## The prompt, as received (verbatim)

What follows is the prompt exactly as it was received — unedited, including
the overclaiming message and the two money forks above. It is kept so the
corrections can be checked against the ask, and so no future builder has to
trust a paraphrase.

````markdown
# Trace — The Invite-a-Shop Referral Loop (Builder Prompt)

You are building the referral loop: the mechanism by which a
Trace user brings a shop onto the platform and earns a share
of that shop's platform fee for a bounded period.

This is not a growth hack. It's a distribution mechanism where
the reward comes from real economic activity, not from the
referral itself.

If the shop never trades, the referrer earns nothing.
If the shop trades, the referrer earns a small share.
If the shop is dropped for cause, the referrer loses it.
If the referrer spams invites, no reward is issued.

## The problem it solves

Trace has no shops. The team cannot walk every street in
Nairobi. The residents can — they already know which shops are
good, and they already tell each other over WhatsApp.

But "please invite a shop" doesn't work. People don't do
unpaid work. The referral loop pays them — but only from
money the shop actually generates, not from the invite itself.

The reward structure is what makes it honest:

- Not "invite 3 shops to unlock a feature."
- Not "earn 100 points for each invite."
- Not "spin the wheel every referral."

Real money, from real trades, for a bounded window.

## What you are building (and what you are NOT)

You ARE building:
- A `referral` entity that links a referrer to a shop
- A territory override — a fixed percentage of the platform
  fee paid to the referrer for a bounded period
- An invite flow: one tap, one WhatsApp message, one link
- A verification gate: reward only after the shop trades
- A referral dashboard showing earned, pending, and terminated
- A termination path: if the shop is dropped for cause, the
  referral ends and the reward stops

You are NOT building:
- Points for invites (points are for accepted work, not
  recruitment)
- Tiers ("Invite 10 shops to unlock Pro")
- Leaderboards of top referrers
- Multi-level referrals (no referral of a referral)
- A reward for a shop that never trades
- A reward for a shop that is dropped for cause
- Any "your friend joined!" spam notifications to the shop
- Any bonus for volume — 1 shop or 100 shops, same rules

The referral loop is a payment mechanism, not a game.

## Non-negotiables

- The reward is a percentage of the **platform fee**, not of
  the shop's revenue. If the platform takes 6%, the referrer
  takes a slice of that 6% — the shop never pays more.
- The percentage and the window are bounded. Default: 0.75%
  of the platform fee for 24 months from the shop's first
  trade. Both are constants, not admin-configurable per
  referral.
- No reward is issued until the shop has a **settled
  transaction through the Settlement Rail**. Invites alone
  earn nothing.
- The referrer must be a real, active user (a settled trade
  of their own in the last 90 days, or a verified shop of
  their own). Referral from an empty account is refused.
- A shop can have **one** referrer. The first invite that
  reaches the shop and is accepted becomes permanent. There
  is no "switch referrer" flow.
- If the shop is dropped for cause (verified fraud, repeated
  abuse, or a dispute rate above threshold), the referral is
  marked `terminated` and the reward stops immediately.
- The referrer **cannot** be the shop's owner. Self-referral
  is refused at the API.
- The shop must confirm the referral during onboarding. An
  invite that the shop ignores for 30 days expires. No silent
  auto-attribution.

## The Referral entity

```
REFERRAL
├── id
├── referrerUserId
├── shopId                (nullable until the shop registers)
├── inviteToken           (single-use, expires in 30 days)
├── status                ('pending' | 'accepted' | 'active' | 'terminated' | 'expired')
├── createdAt
├── acceptedAt            (when the shop confirmed)
├── activatedAt           (when the first settlement occurred)
├── firstTradeAt          (ISO)
├── lastEarnedAt          (ISO, nullable)
├── earnedTotal           (derived: sum of referral_earnings rows)
├── expiresAt             (24 months from firstTradeAt)
└── terminatedReason      (nullable — 'fraud', 'dispute_threshold', 'shop_request')
```

Status transitions:
```
pending → accepted  (shop confirms)
pending → expired   (30 days pass without confirmation)
accepted → active   (first settled trade)
active → terminated (fraud, dispute threshold, or shop request)
accepted → terminated (shop drops before trading — allowed)
```

No other transitions. An `active` referral cannot become
`accepted` again. A `terminated` referral is final.

## The ReferralEarning entity

Every time a shop's trade settles, if that shop has an
`active` referral, a `referralEarning` row is created.

```
REFERRAL_EARNING
├── id
├── referralId
├── transactionId         (the settled trade)
├── shopId
├── platformFee           (what Trace kept from that trade)
├── referralShare         (platformFee * 0.0075, or whatever
│                          the constant is)
├── earnedAt              (ISO)
└── settledAt             (when the reward was paid to the
                           referrer — may lag earnedAt)
```

The referrer's payout is batched monthly via the Settlement
Rail. Not per trade. Not per day. Monthly, with a statement.

## The invite flow

The referrer taps "Invite a shop" from the Nearby surface, a
shop's public page, or the My Layer screen. One screen:

```
┌─────────────────────────────────────┐
│  Invite a shop to Trace             │
│                                     │
│  Know a shop that should be here?  │
│                                     │
│  When they trade on Trace, you get │
│  a share of the platform fee for   │
│  24 months.                        │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  SHOP NAME                          │
│  [                               ]  │
│                                     │
│  SHOP TYPE                          │
│  [ Food ▾ ]                         │
│                                     │
│  WHATSAPP NUMBER                    │
│  [+254                            ] │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  We'll send them a WhatsApp with    │
│  a link to register. They confirm  │
│  you as their referrer when they   │
│  sign up.                          │
│                                     │
│  [ Send invite ]                    │
│                                     │
└─────────────────────────────────────┘
```

The invite sends one WhatsApp message:

```
Hi {{shopName}},

{{referrerName}} thought you should be on Trace.

Trace is a free page for your shop, and every
order you take through it is settled by M-Pesa.

Set up takes 3 minutes: {{inviteLink}}

If you sign up, {{referrerName}} gets a small
share of Trace's fee for the first 24 months.
It costs you nothing extra.
```

Every claim in the message is true:
- "Free page" — yes, shops are free
- "Settled by M-Pesa" — via the Settlement Rail
- "3 minutes" — the onboarding flow is short
- "Small share of Trace's fee" — 0.75% of 6%
- "Costs you nothing extra" — the shop's fee is unchanged

The message is signed by the referrer's first name only. The
shop knows who invited them.

## The shop's confirmation

When the shop opens the invite link and completes registration,
they see one screen:

```
{{referrerName}} invited you to Trace.

If you accept, {{referrerName}} will receive a small
share of Trace's platform fee for the first 24 months
of your shop's trading.

This does not change what you pay. Trace's fee is the
same with or without a referrer.

[ Accept ]   [ Sign up without a referrer ]
```

If they accept, the referral moves to `accepted`.
If they decline or ignore, no referral is created.
No silent attribution.

## The activation

The referral moves from `accepted` to `active` when the shop's
first trade settles through the Settlement Rail.

At that moment:
- `firstTradeAt` is set
- `expiresAt` becomes 24 months from now
- The referrer is notified: "{{shopName}} traded. Your
  referral is now active. It expires in 24 months."

Before this point, the referrer has **no claim** to any money.
The referral is a promise, not a payment.

## The monthly statement

At the end of every calendar month, Trace computes the
referrer's earnings:

```
TRACE REFERRAL STATEMENT · August 2026
──────────────────────────────────────

Your referrals
──────────────
Testshop             earned this month: KES 24
Kikao Hardware       earned this month: KES 18
Marigiti Greens      earned this month: KES  0 (no trades)

Total this month:    KES 42
──────────────────────────────────────

Lifetime earnings:   KES 168
Active referrals:    2
Terminated:          1

[ See full history ]
```

The statement shows per-shop earnings. No aggregate that
hides details. If a shop earned KES 0, it shows KES 0 with
the reason ("no trades").

Payout happens monthly via the Settlement Rail:
- If total > KES 100: automatic disbursement
- If total ≤ KES 100: rolls over to next month
- If the referrer has no active referrals: nothing is
  disbursed, statement is still generated

## The termination paths

Three reasons a referral ends early:

### Termination 1 — Shop dropped for cause

If a shop is dropped for verified fraud or a dispute rate
above threshold, `terminatedReason = 'fraud'` and no further
earnings are credited. The referrer keeps earnings already
paid.

The referrer is notified:

```
{{shopName}} was removed from Trace.

Reason: {{reason}}

Your referral is closed. You keep what you've
already earned. No further earnings will accrue.
```

### Termination 2 — Shop requests removal

If a shop requests to have its referrer removed (e.g., they
never met the referrer, or the referrer misrepresented
themselves), `terminatedReason = 'shop_request'` and the
referral ends. Trace investigates; if the referrer acted in
bad faith, future referrals from that account are blocked.

### Termination 3 — Self-referral detected

If the shop's owner turns out to be the referrer (or a family
member, employee, or affiliate of the referrer), the referral
is `terminatedReason = 'self_referral'`. The referrer loses
all earnings and is flagged for review. Repeated attempts
block the account from referring.

## The termination as a boundary, not a punishment

Terminated referrals do not "claw back" already-paid earnings.
The referrer earned what they earned during the active period.
But the moment the referral is terminated, no new earnings
accrue.

This is the same rule as the ledger: past is settled, future
is not.

## What to remove from the current surface

- Any "referral" copy in the app that promises points,
  badges, or rewards before the shop trades.
- Any "invite 3 shops to unlock X" pattern.
- Any leaderboard or "top referrers" board.
- Any automated WhatsApp spam to shops that didn't invite
  the referrer directly.

## Test requirements

- A user can invite a shop via WhatsApp. An invite row is
  created with status `pending`.
- The invite expires after 30 days if the shop doesn't
  accept. Status becomes `expired`.
- A shop that accepts the invite is linked to the referrer.
  Status becomes `accepted`.
- A shop that ignores the invite stays unlinked.
- The referral moves to `active` only after the shop's first
  trade settles. No reward before this.
- A shop's first trade creates one `referralEarning` row per
  settled transaction. No duplicate rows for the same trade.
- The referrer cannot be the shop's owner. Self-referral is
  refused at the API.
- A referral cannot be switched to a different referrer. The
  first accepted referrer is permanent.
- A shop dropped for fraud has its referrals terminated.
  No further earnings accrue.
- A referral expires 24 months from `firstTradeAt`. After
  that date, no new earnings accrue.
- The monthly statement shows per-shop earnings and the
  total. No aggregate that hides details.
- Payouts under KES 100 roll over. Above KES 100, they
  disburse automatically via the Settlement Rail.

## The one rule

A referral pays only when the shop it refers actually trades.
If the shop never trades, the referrer earns nothing. If the
shop trades, the reward is a small, bounded share of the
platform fee. Never more, never invented.

The referral is a distribution mechanism. Not a game.

## Order of operations

1. `referral` entity + `referralEarning` entity.
2. The invite flow: form, WhatsApp send, token generation.
3. The shop's confirmation screen.
4. The activation hook: on first settlement, activate the
   referral.
5. The monthly statement generator.
6. The Settlement Rail integration: disbursement of earnings.
7. The termination paths: fraud, shop request, self-referral.
8. The referrer dashboard: list of referrals, status,
   earnings.

Each step ships separately. Each step has its own test. No
step depends on the next.

## What this unblocks

- Shops appear on Trace without the team knocking on doors.
- Residents have a reason to invite good shops — they earn
  from it.
- The B2B revenue has a second source (referral-linked
  platform fees get distributed, but the total platform
  revenue grows).
- Growth becomes distributed — every resident is a
  potential distributor.
- The referral boundary (24 months, one level, honest
  activation) is defensible and easy to explain.

The referral loop is the growth mechanism. Ship it after
Nearby so there's a surface to invite shops to. Ship it
before Events so the shop base exists to host events.

The referral is the entry point. Everything else builds on
top of the shops it brings in.
````

---

## Operator's note (received with the prompt, outside it)

> **Why This Was the Right Surprise**
>
> You said earlier: *"no one wants to participate in the data creation. I
> have to find a way to bring them to the table."*
>
> Every previous prompt answered *"what to build."* This one answers *"how
> to get the shops onto the platform in the first place."*
>
> The referral loop is the mechanism that:
> - Doesn't require the Trace team to walk every street
> - Doesn't fabricate rewards
> - Pays from real economic activity
> - Bounds itself honestly (24 months, one level, one referrer)
> - Terminates cleanly if the shop goes bad
>
> **The reward is small (0.75% of 6%), but honest.** That's the point. A
> referrer who brings 20 real shops earns real money — not from the invite,
> from the shops' trades. A referrer who spams 100 invites that nobody
> accepts earns zero.
>
> The loop is the growth mechanism. **Build this after Nearby, before
> Events.** Because without shops, there's nothing to have events in.
>
> ---
>
> **Where We Are Now** — five builder prompts delivered:
>
> | Prompt | Surface | Dependency |
> |---|---|---|
> | **Shop Brief** | Owner's daily truth | None — can ship anytime |
> | **Settlement Rail** | Money movement | Unblocks everything financial |
> | **Nearby** | Consumer entry | None — first consumer surface |
> | **Shopping Run Stream** | Shared coordination | Needs Nearby + Settlement Rail |
> | **Invite-a-Shop** | Growth mechanism | Needs Nearby + Settlement Rail |
>
> **Natural next prompts**, if you want to keep going:
>
> 1. **Events & Ticketing** — concerts, workshops, tournaments — the second consumer inflow
> 2. **Verification Flow** — how a shop gets the ✓ badge, cleanly and once
> 3. **Partner Onboarding** — riders, couriers, field agents self-register
> 4. **Reviews** — settlement-gated trust, once orders exist
> 5. **The Team & Roles** — owner / manager / staff permissions for a shop
>
> Say **"next"** and I'll keep going. Say the name of any of these and I'll
> write that one.

The instinct in the note is right, and the tree says something better: the
repo already bet on this growth mechanism twice — field agents who earn
0.75% for 24 months by walking the streets, and an invite primitive built
so every onboarding dies unless redeemed. This prompt is that bet's
consumer twin. Build the doorway; the engine is tested. Decide the two
forks first — twenty-fold money and whose clock the promise runs on —
because those are promises made to people carrying bags through Kariakoo,
and a promise with an ambiguous number is a lie waiting for a settlement
date.
