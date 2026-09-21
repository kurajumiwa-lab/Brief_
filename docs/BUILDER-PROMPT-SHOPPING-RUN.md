# Trace — The Shopping Run Stream (Builder Prompt, second revision)

> Status: **not started, by design — and this surface already has a record.**
> `docs/BUILDER-PROMPT-SHOPPING.md` is the corrected build spec for this exact
> stream, verified against the tree and still governing the build. This file
> records the second, fuller revision of the prompt **verbatim** (entity
> schema, failure modes, five templates, admin dashboard) and maps it against
> both the spec and the code. Nothing in this surface is built; nothing here
> contradicts that.
>
> The revision is mostly faithful to the spec it revises. Its new problems are
> two schema gaps (`deadline` and the `settling`/`payment_pending` states are
> used but never declared), one arithmetic self-contradiction in the join-card
> mockup, and a settlement section written against a rail (`SettlementRail`)
> that does not exist under that name — the standing seam is `providers.js`,
> and its B2C side is refused in code until KCB's letter. Read **Corrections
> first**. Verified against the tree on 2026-09-21.

---

## Corrections first (what was changed, and why)

1. **The sibling spec governs.** `BUILDER-PROMPT-SHOPPING.md` already holds
   this stream's corrected non-negotiables, build order, and test list, with
   status "not started, by design" — the gate it was waiting on (the Discover
   cleanup) shipped in `0d97d70`. Where this revision and the spec differ, the
   spec's corrections carry unless this file explicitly supersedes them. A
   pointer to this file has been added to the spec so a reader of either
   finds both.

2. **`SettlementRail` does not exist under that name — and its disburse
   half is refused in code.** The standing seam is `providers.js`
   (capability objects, one rail per direction). Collection works (Buni STK,
   UAT-verified contract); B2C disbursement returns
   `transfer_contract_unverified` until KCB publishes the transfer body
   (`buni.js:335`), and `payoutFee()` is `null` because nobody published a
   schedule. So the settlement flow's step 3 — the admin pays the van owner
   through `SettlementRail.disburse()` — cannot run today and must not be
   faked. The spec already wrote the honest branch: per-item and transport
   payments between members are **recorded**; a run cannot be marked settled
   by a bot; the receipt says `manual settlement, not Trace-verified`. The
   prompt's own one rule ("never fake a settlement") is the same sentence.

3. **The join card contradicts its own calculator.** With `transportCost`
   600 and 8 of 12 filled: the share now is 75, the share if one more joins
   is 600/9 ≈ 66.67, the share full is 50. The calculator section computes
   exactly this. The join-flow mockup prints "Your share if you join:
   KES 75" — that is the share *without* joining. Mockups are shape, but an
   internally inconsistent mockup is how a wrong label survives into a
   build; the rule stands that the arithmetic is served by the server
   (`GET /api/runs/:id/savings`, spec step 4) and the client renders its
   answer without recomputing.

4. **`settling` and `payment_pending` are used but never declared.** The
   entity schema's status enum is `forming | confirmed | running | settled |
   cancelled`, and the transition map lists six edges. The settlement flow
   then says "the run is `settling`, not `settled`" and puts requesters in
   `payment_pending` — neither state exists in the schema. If settled must
   wait for every payment to clear (it must), write the states into the
   schema and the transition map, or the invariant cannot be enforced
   server-side. The spec's shape until then: settlement rows hold
   `pending_manual`; the run's `settled` is unreachable without real ledger
   rows.

5. **`deadline` is missing from the entity schema.** The under-capacity
   failure mode depends on it ("defaults to 24h before depart"), the schema
   doesn't carry it. A deadline that exists only in prose has no trigger.
   Add the field where the state machine lives.

6. **The opt-out loop is under-specified.** At the 0.6 threshold the run
   confirms at a higher per-person share and participants have 2 hours to
   opt out — but every opt-out raises the share again, which invites the
   next opt-out. The rule that ends the loop: shares recompute on read
   (the spec's law), the opt-out window closes once for everyone, and the
   final split is fixed at settlement from the participants still on the
   manifest. The 0.6 as a named config constant, never a magic number,
   is correct and kept.

7. **Emojis next to money — already ruled.** The spec's non-negotiable,
   carried from the repo: "No promo language. No 'amazing deal'. No emojis
   anywhere near money." The five mockup templates put 🕑 🚐 💰 📢 against
   KES amounts and ✅/⚠ against savings figures. The five event names survive
   (run announced · shopper joined · list posted · price found · run
   settled); the mockup text is shape, not copy.

8. **Templates in this repo prefill; they do not send.**
   `spaceAudience.js`: "TEMPLATES are the vendor's own words, stored per
   space, capped… they prefill a message; they do not send anything on their
   own," beside four broadcast kinds (`update, stock, hours, drop`). The
   prompt's templates are system-composed and fired at participants. The
   spec's resolution stands: five run-event templates on the existing
   broadcast rail, each ending with one action, each a row in the run stream
   — Trace is the record, WhatsApp stays the chat. "Reply JOIN" is an
   instruction in a message, not an auto-subscription.

9. **"Runs near you … on Nearby, below the shop list" — collided twice.**
   The name Nearby is held by the mounted 2,415-line screen (see
   `BUILDER-PROMPT-NEARBY.md`, correction 2), and the shop directory the run
   list would sit "below" is not built. The spec's discovery answer needs no
   new screen: a `runs` room in the city taxonomy
   (`preview/src/features/city/taxonomy.ts` — a file whose header exists to
   stop exactly this kind of drift), shown in the member's area, soonest
   first, no promoted or popularity sort.

10. **The Shop Brief unblock breaks the Shop Brief.** "3 runs completed this
    week" is a rolling window, and the brief bans rolling windows on its own
    screen — the Shop Brief build refused even `orders/mo` for that reason.
    A run count that may appear on a brief must be day-scoped or not appear.

11. **Refunds "via the settlement rail" have no rail yet.** There is no
    reversal door (see `BUILDER-PROMPT-SETTLEMENT.md`, correction 4 and the
    reserved-but-unrouted `reversed` state). Today a refund is a ledger row
    (`refunded`, `ledger.js:116-120`) recorded after a human moves the money
    back. Until the reversal door exists, every "refunded via the rail" in
    the failure modes means exactly that, and says so on the receipt.

12. **What already carries.** Validated sources with the list exported from
    the domain (unknown → refused with the list, never silently "local
    market" — and `sourceKind: 'chain' | 'market'` with a required named
    source either way) · no defaults for source, day or window · capacity
    refused on the write · the savings arithmetic as a pure function with
    server-owned numbers · `priceEstimate` labelled as the requester's own
    expectation, never "the price at Carrefour" (this app fetches no shelf
    prices; `worldSignal.js` reports `prices.status = 'not_configured'`) ·
    the stream recomputed on read, never a stored tally.

---

## The revision's test requirements, mapped

| Required by this revision | Where it stands |
| --- | --- |
| 8 participants split correctly | spec test list — asserted against the same function the UI calls |
| calculator returns 0 savings when full | spec test list — "no change to the rows → savings is exactly `0`, and the panel says so" |
| accurate savings when one more joins | spec test list (same pure function); the mockup's own numbers are corrected above |
| at capacity → join refused at the API | spec test list — refusal shown verbatim on the card |
| no source → cannot confirm | spec non-negotiable + `SOURCES` exported, unknown refused |
| list editable until `running`, locked after | new in this revision — sensible; the lock belongs in the list write path, not the client |
| price broadcast updates expected vs actual | to build (spec step 5 + the broadcast rail) |
| ManualRail settlement creates correct queue rows | naming only — there is no ManualRail; the honest branch is `pending_manual` rows (correction 2) |
| M-Pesa settlement fires correct calls | gated exactly as the Settlement doc records: B2C refused until KCB's letter; collection exists |
| no-show still pays their share | new in this revision — a policy row on the run, stated before joining, enforced at settlement |
| under-capacity at deadline picks the right path | new — needs the `deadline` field (correction 5) and the once-closed opt-out window (correction 6) |
| admin cancellation refunds through the rail | refunds are ledger rows until a reversal door exists (correction 11) |

## What this revision genuinely adds to the spec

A concrete entity schema with `costModel` · the `deadline` field and the
under-capacity decision (0.6 threshold, shrink-or-cancel) · an explicit
no-show policy · the settling semantics (settled waits for every payment) ·
five named templates wired to run events · an admin dashboard whose mockup
is the right shape (manifest, money, one button per transition) · the
`pickupPoint` field. All of it slots into the spec's build order without
reordering a step — once the two missing states and the missing field are
declared in the schema, and the settlement section is read through the
provider seam that actually exists.

---

## The prompt, as received (verbatim)

What follows is the second revision exactly as it was received — unedited,
including the undeclared states, the contradictory mockup label, and the
rail that doesn't exist. It is kept so the corrections can be checked
against the ask, and so no future builder has to trust a paraphrase.

````markdown
# Trace — The Shopping Run Stream (Builder Prompt)

You are building the Shopping Run Stream: the coordination
layer for shared shopping trips. This is the feature that makes
estate circles real, and the one that turns Nearby from a
directory into an active economy.

A shopping run is not a marketplace. It is a shared cost. One
van, several households, one destination, one day. The value
is arithmetic.

## The problem it solves

A resident in Membley needs to shop at Carrefour. They can't go
today, or they can go but the transport costs too much alone.
A neighbour is going anyway with an empty seat and free hands.

Today this happens over WhatsApp. 40 messages. A screenshot of
an M-Pesa receipt. An argument about who paid for the matatu.
Nobody writes anything down. Next week, same loop.

The Shopping Run Stream formalises it. One run. One manifest.
One cost split. One settlement. Every participant knows who
paid what, and the record survives the trip.

## What you are building (and what you are NOT)

You ARE building:
- A `shoppingRun` entity with source, day, window, capacity,
  cost model, and status
- A `shoppingList` entity with items, quantities, and statuses
- Two roles: shopper (going anyway) and requester (needs items)
- A live bundle savings calculator
- Five WhatsApp templates for stream events
- Settlement through the SettlementRail (Manual first, M-Pesa
  or KCB when configured)
- Price broadcast — shoppers in-store post what they find
- Failure modes: under capacity, no-show, cancel, refund

You are NOT building:
- A general marketplace (Nearby handles that)
- Any rating or review system (no rows yet)
- Promoted runs, sponsored slots, or paid placement
- Any "recommended" or "top" run
- Any engagement metric (no view counts, no save counts)
- Any fake savings number — every figure is a real row

The run is arithmetic. Not marketing.

## Non-negotiables

- Every number printed is derived from a row the user could
  query. If it can't be recomputed, it isn't shown.
- No defaults for source, day, or window. Blank ≠ Carrefour,
  blank ≠ Saturday, blank ≠ any window.
- The source is validated against a known list. Unknown source
  = refused at the API, not silently accepted.
- Transport cost is a real number entered by the admin. Not
  estimated, not fetched from a map API, not averaged.
- Settlement goes through the SettlementRail. Never a fake
  "settled" state.
- A run at capacity refuses new joiners. No overflow list.
- A run without a source refuses to confirm.
- Under-capacity runs at deadline either shrink, extend, or
  cancel. No silent failure.

## The ShoppingRun entity

```
SHOPPING_RUN
├── id
├── source            (Carrefour, Naivas, Quickmart, market, etc.)
├── sourceValidated   (boolean — true if source is on the known list)
├── day               (YYYY-MM-DD in EAT)
├── window
│   ├── depart        (HH:MM in EAT)
│   └── return        (HH:MM in EAT)
├── pickupPoint       (free text, e.g. "Membley Gate 1")
├── capacity          (integer, seats available)
├── transportCost     (KES, total for the van)
├── costModel         ('split_equally' only for v1)
├── createdBy         (userId)
├── createdAt         (ISO)
├── status            ('forming' | 'confirmed' | 'running' | 'settled' | 'cancelled')
└── notes             (free text, optional)
```

Valid status transitions:
```
forming → confirmed (when capacity reached OR admin confirms)
forming → cancelled (admin cancels before confirmation)
confirmed → running (at depart time)
running → settled (admin marks complete)
running → cancelled (emergency — refunds apply)
confirmed → cancelled (emergency — refunds apply)
```

No other transitions. A run cannot go from `forming` to
`running` without passing `confirmed`. The state machine is
enforced server-side.

## The ShoppingList entity

```
SHOPPING_LIST
├── id
├── runId
├── requesterId
├── items
│   └── array of { name, qty, priceEstimate, category }
├── subtotal          (sum of qty * priceEstimate)
├── status            ('draft' | 'posted' | 'purchased' | 'delivered')
├── createdAt
└── updatedAt
```

A requester can edit their list until the run reaches `running`.
After that, the list is locked. Changes require admin approval —
because the shopper is already in the store.

The `priceEstimate` is what the requester *expects* to pay. Not
a fetched price. When the shopper buys the item, they enter the
*actual* price. The difference is shown to the requester at
settlement.

## The join flow

Two buttons on the run page:

```
┌─────────────────────────────────────┐
│  Saturday Carrefour Run             │
│  Membley Gate 1 · Sat 10:00–14:00   │
│                                     │
│  Seats: 8 of 12 filled              │
│  Transport: KES 600 split equally   │
│  Your share if you join: KES 75     │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  [ I'm going ]     [ I need items ] │
│                                     │
│  Going: you'll shop with the group  │
│  Items: a shopper picks up for you  │
│                                     │
└─────────────────────────────────────┘
```

**"I'm going"** → creates a `shopper` row on the run. The user
is now on the manifest as a shopper. They can also post their
own shopping list.

**"I need items"** → creates a `requester` row. They can post
their list. They cannot add more shoppers to the run.

A user can be both a shopper and a requester on the same run.
The roles are not exclusive.

## The bundle savings calculator

This is the retention feature. It must be real arithmetic,
visible in real time, computed on every render.

Given a run with:
- `transportCost` = the total van cost
- `capacity` = the total number of participants (shoppers +
  requesters, all sharing transport)
- current `participants.length` = people currently joined

Then:

```
costPerSlot = transportCost / capacity
currentSplit = transportCost / participants.length

savingsIfFull = currentSplit - costPerSlot
savingsIfOneMore = currentSplit - (transportCost / (participants.length + 1))
```

Display:

```
YOUR TRANSPORT SHARE
────────────────────────────────
Now:                  KES 75
If the run fills:     KES 50
If one more joins:    KES 67
                    ─────────
You save when full:   KES 25
```

Every number is a calculation, not a message. When the run
fills, `now` equals `if the run fills` and the "you save" line
disappears (there's nothing left to save).

The calculator is a **pure function**. It takes the run row and
returns four numbers. No state. No caching. Recompute on every
render.

## The five WhatsApp templates

### Template 1 — Run announced

Sent to the estate circle when a run is created.

```
{{pickupPoint}} → {{source}}

🕖 {{day}} · {{window.depart}}–{{window.return}}
🚐 {{capacity}} seats, transport split equally
💰 {{transportCost}} KES total · {{costPerSlot}} KES per person

What you can do:
· Join as a shopper (going anyway)
· Post a list (a shopper picks up)

Reply JOIN to add yourself.
Reply LIST to post what you need.
Link: {{runUrl}}
```

### Template 2 — Shopper joined

Sent to the run's participants.

```
{{shopperName}} is going on {{day}}.

Seats: {{filled}} of {{capacity}}
Share: {{currentSplit}} KES per person

{{remaining}} seats left.
```

### Template 3 — List posted

Sent to all shoppers on the run.

```
{{requesterName}} posted a list for {{day}}:

{{itemCount}} items · {{subtotal}} KES estimate

{{#each items}}
· {{name}} ({{qty}}) — ~{{priceEstimate}} KES
{{/each}}

Shoppers: view the full list at {{runUrl}}
```

### Template 4 — Price found (in-store broadcast)

Sent by a shopper from inside the store to the run participants.

```
📢 {{shopperName}} at {{source}}:

{{item}}: {{foundPrice}} KES
(Requested: {{estimate}} KES)

{{#if cheaper}}
✅ Cheaper than expected — save {{savings}} KES
{{else}}
⚠ Higher than expected — decide before the checkout
{{/if}}

Reply OK to confirm the purchase.
Reply SKIP to skip this item.
```

### Template 5 — Run settled

Sent to all participants after completion.

```
{{source}} run complete ✓

{{day}} · {{window.depart}}–{{window.return}}

TRANSPORT
Total: {{transportCost}} KES
Split: {{participantCount}} ways = {{costPerSlot}} KES each

YOUR ITEMS
{{#each myItems}}
· {{name}} — {{actualPrice}} KES
{{/each}}
Subtotal: {{mySubtotal}} KES
Transport: {{costPerSlot}} KES
────────────────
Total: {{myTotal}} KES

Receipt: {{receiptUrl}}
Paid: {{settlementStatus}}
```

Every template ends with an action or a link. Every template
is plain. No emojis beyond what a real Kenyan would text. No
marketing language.

## The settlement flow

When the admin marks a run as `settled`:

1. **Per-item payments.** Each requester pays the shopper the
   actual cost of their items. This is individual, not split.
   Uses `SettlementRail.collect()` with the shopper as
   recipient.
2. **Transport split.** The transport cost is divided equally
   among all participants (shoppers + requesters). Each
   participant pays their share to the admin (or to whoever
   paid the van). Uses `SettlementRail.collect()`.
3. **Admin disbursement.** The admin pays the van owner (or
   has already paid). Uses `SettlementRail.disburse()`.

All three go through the settlement rail. If the rail is manual,
each is a queue item that the admin marks as paid. If the rail
is automated, they run in parallel.

**Failure of any single payment does not fail the run.** A
requester who doesn't pay stays in `payment_pending` on the
run. The run is settled when all payments clear. Until then,
the run is `settling`, not `settled`.

## The failure modes

### Under capacity at deadline

The run has a `deadline` field (defaults to 24h before depart).
At deadline, if `participants.length < capacity`:

- If `participants.length >= capacity * 0.6`: run confirms
  with a higher per-person share. Participants are notified
  with the new split. They have 2 hours to opt out.
- If `participants.length < capacity * 0.6`: run cancels.
  Any collected payments are refunded via the settlement rail.

The threshold (0.6) is a config constant. Not a magic number
in the code.

### No-show at pickup

A shopper or requester who paid but didn't show:

- Shopper no-show: they still pay their transport share. The
  run cannot refund a seat that was held.
- Requester no-show: their items are delivered to their
  registered address by the shopper, or kept by the shopper
  for pickup. The requester still pays for the items and
  their transport share.

No-show policy is enforced by the run. No discretion.

### Cancellation by admin

If the admin cancels a `forming` or `confirmed` run:

- All collected payments are refunded via the rail.
- All participants are notified.
- The run is marked `cancelled` with a reason field.

A `running` run can only be cancelled for emergency (documented
reason required). If cancelled mid-run:

- The shopper returns with whatever they bought.
- Requesters receive their items if delivered, or a refund if
  not.
- Transport cost is split as if the run completed (the van was
  hired, the cost was incurred).

## The admin dashboard

One screen. The admin sees:

```
┌─────────────────────────────────────┐
│  Saturday Carrefour Run             │
│  Confirmed · 8 of 12 seats          │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  MANIFEST                           │
│  🛵 Shoppers (3)                    │
│    ✓ Wanjiru    paid transport      │
│    ✓ Peter      paid transport      │
│    ✓ Grace      paid transport      │
│                                     │
│  📝 Requesters (5)                  │
│    ✓ Mary       12 items · 3,200    │
│    ✓ Kamau       4 items ·   890    │
│    ✓ Faith       8 items · 2,100    │
│    ✓ Dennis      6 items · 1,450    │
│    ✓ Njeri       2 items ·   340    │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  MONEY                              │
│  Transport collected: KES 600       │
│  Van cost:            KES 600       │
│  Buffer:              KES 0         │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  [Send reminders]  [Mark departed]  │
│  [Mark returned]   [Settle]         │
└─────────────────────────────────────┘
```

No charts. No metrics. Just who's coming, who's paid, and one
button to move to the next state.

## What to remove from the current surface

This prompt does not change the current Home, Discover, or You
surfaces. It adds a new screen: the run detail page. The
Shopping Runs appear as entries in a new "Runs near you"
section on Nearby, below the shop list.

The 4 empty flow cards (Bulk/Direct/Niche/Group) on Discover
are already slated for removal in the Nearby prompt. This
prompt assumes that removal has landed.

## Test requirements

- A run with 8 participants computes transport split correctly.
- The bundle calculator returns 0 savings when the run is full.
- The bundle calculator returns accurate savings when a new
  participant joins.
- A run at capacity refuses new joiners at the API.
- A run without a source refuses to confirm.
- A requester can edit their list until `running`, then cannot.
- A shopper's in-store price broadcast updates the requester's
  expected vs actual.
- Settlement through ManualRail creates the correct queue rows.
- Settlement through M-PesaRail (when configured) fires the
  correct calls.
- A no-show still pays their share; the run does not refund.
- Under-capacity at deadline triggers the correct shrink,
  extend, or cancel path.
- Admin cancellation refunds all payments through the rail.

## The one rule

A shopping run is arithmetic. Show the cost. Show the saving.
Never fabricate a number. Never fake a settlement. If the
provider isn't there, the run says so.

The run is the smallest unit of shared economy. If it works
for one estate, it works for every estate.

## Order of operations

1. `shoppingRun` entity + status state machine.
2. `shoppingList` entity with per-item estimates.
3. Create-run flow (for the estate admin).
4. Join flow (shoppers and requesters).
5. Bundle savings calculator as a pure function.
6. Five WhatsApp templates wired to run events.
7. Admin dashboard with one-tap state transitions.
8. Settlement through ManualRail.
9. Failure modes: under capacity, no-show, cancel.
10. Price broadcast from shoppers in-store.

Each step ships separately. Each step has its own test. No
step depends on the next.

## What this unblocks

- Estate circles have a concrete economic mechanism, not just
  a chat.
- The Nearby surface has an active layer (runs) below the
  directory (shops).
- The Settlement Rail has a real flow that exercises it.
- The Shop Brief has a new activity type to aggregate ("3 runs
  completed this week").
- Consumers have a reason to open Trace on a Saturday morning.

Build the Shopping Run Stream. Run it in Membley first. Watch
it either save money or not. If it does, replicate to the next
estate.

The run is the proof.
````

---

## Operator's note (received with the prompt, outside it)

> Where We Are Now — four prompts delivered, each a complete build slice:
>
> | Prompt | Surface | Status |
> |---|---|---|
> | **Shop Brief** | Owner's daily truth | Ready to build |
> | **Settlement Rail** | Money movement | Ready to build |
> | **Nearby** | Consumer entry | Ready to build |
> | **Shopping Run Stream** | Shared coordination | Ready to build |
>
> These four form a coherent system:
>
> - **Nearby** shows a resident what shops exist near them
> - **Shopping Run Stream** lets them coordinate with neighbours
> - **Settlement Rail** moves the money cleanly
> - **Shop Brief** tells the owner what happened
>
> **The next logical prompt** would be one of these:
>
> 1. **Events & Ticketing** — the other consumer inflow (concerts, tournaments, workshops)
> 2. **Invite-a-Shop Referral Loop** — growth mechanism that lets residents onboard shops
> 3. **Reviews (settlement-gated)** — the trust layer for shops, once orders exist
> 4. **Verification Flow** — how a shop gets the ✓ badge, once and cleanly
> 5. **The Partner Program** — how riders, couriers, and field agents onboard themselves
>
> **Tell me which one and I'll write it.** Or say "surprise me" and I'll pick
> the one that unblocks the most other things — that's **Invite-a-Shop**,
> because growth is the bottleneck now, not features.

The table's status column is the note's one falsehood, and the records
correct it: the Shop Brief **is built** (with six refusals), the
settlement seam **exists** with the queues and sweep genuinely new, Nearby
**collided with a mounted screen**, and this run — the stream that would
exercise all three — is the one still waiting, by design, on a build that
starts from `BUILDER-PROMPT-SHOPPING.md` and this revision's deltas.
