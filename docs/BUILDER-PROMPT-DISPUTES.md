# Trace — Dispute Resolution (Builder Prompt)

> Status: **the filing half is built; the resolution half is a documented
> absence.** `order.js` already holds the primitive: `openDispute`
> (buyer-only, reason required, idempotent-before-eligibility), the
> `disputes` collection, a wired route with an `order_disputed`
> notification, and the order's `disputed` state — with `disputed: []` in
> the transition table and a comment saying why: *half a resolution flow, a
> disputed order stays visibly contested.* The repo refused to invent the
> exits without the flow. This prompt is the flow. Its real findings: the
> ledger has no `settled → held` transition (the prompt's central
> "hold the funds" mechanic is not representable for settled money),
> `withdrawn` is already named but unreachable, and the prompt declares
> "no auto-resolution" while specifying three.
>
> Verified against the tree on 2026-09-21. Read **Corrections first**.

---

## Corrections first (what was changed, and why)

1. **The primitive exists — extend the row, never a second `dispute`.**
   `openDispute({ orderId, reportedBy, reason })`: buyer-only standing
   ("Only the buyer contests their own order. The vendor has other remedies
   and an unrelated user has no standing at all. Checked FIRST so a
   stranger learns nothing about the order's state"), idempotent
   *before* eligibility ("a double-tapped button turning into an error
   instead of a no-op" — the ordering trap named in the comment), `reason`
   required, and the row carries `{ id, orderId, reportedBy, vendorId,
   reason, status: 'open', createdAt, updatedAt }`. The order moves to
   `disputed` "so no reader of an order can miss it by forgetting to check
   a separate table." Route: `POST /api/orders/:id/dispute`, feature-gated,
   emitting `order_disputed`. Everything this prompt adds — categories,
   amounts, windows, evidence, outcomes — extends **this** row and this
   vocabulary, not a parallel entity.

2. **The deadlock is deliberate, and this prompt is its completion.**
   `disputed: []` in the transition table, beside the comment: *"Deliberately
   absent… half a resolution flow, a disputed order stays visibly
   contested."* The repo built filing, named the contested state, and
   refused to guess the exits. The prompt supplies the exits — and they
   must be added to the same table with the same stated-why discipline:
   `disputed → settled` (no refund; the sale stands), `disputed →
   refunded` (full or as the refund rows sum), `disputed → cancelled`
   (withdrawal closes it as withdrawn, the order resumes its prior
   terminal state per the resolution). An order leaving `disputed` only
   through a recorded resolution is the invariant.

3. **`withdrawn` is already named and unreachable — the `reversed` pattern
   again.** `DISPUTE_STATUS = ['open', 'withdrawn']` exists at
   `order.js:356`; no withdraw door exists anywhere. The prompt's
   withdrawal path (buyer cancels, funds release, no re-filing) is the
   completion of a word the tree already reserved. Series pattern: the
   vocabulary is written down first, the door arrives later.

4. **The ledger cannot hold a settled transaction — the prompt's central
   mechanic needs a decision, not a build.** Ledger transitions:
   `settled: ['refunded']` — there is **no `settled → held`**. A settled
   order's money is already recorded as moved; it cannot be un-moved into
   a hold. The honest shape: the *hold* lives on the dispute and order
   rows (the contested state is the hold — that is what `disputed` already
   means), and the ledger moves once, at resolution: `settled → refunded`
   with refund rows carrying the amount. Which exposes the second gap:
   **partial refunds have no representation** — `refunded` is total, and
   the transaction's amount is fixed. Model a partial as refund rows
   summing to less than the transaction (the split-arithmetic pattern of
   `settlement.js`: the parts always sum exactly), never by mutating the
   transaction. Amend transitions once, in writing, if a true hold is
   wanted — never per-feature.

5. **The prompt contradicts itself on auto-resolution — and the fix is
   deterministic constants.** "You are NOT building: any auto-resolution
   (all outcomes are human-decided unless the seller voluntarily refunds)"
   — and then three auto-resolutions: 48-hour no-response auto full
   refund on "credible" evidence, 14-day expiry auto-closed in the
   buyer's favour, and the same expiry path restated. Pick one law and
   write it. The house answer: an unanswered dispute resolves itself
   *only* when credibility is a **row-derived fact, stated as constants** —
   e.g. `evidence count ≥ 1 AND category ≠ 'other' AND description ≥ 40
   characters` — never a human-ish judgement of "plausible" computed in
   code. The Shop Brief's flags law applies verbatim: if the rule isn't
   derivable from rows, it isn't a rule, it's a mood.

6. **Seller filing reverses a recorded decision — face it, don't drift.**
   The tree is buyer-only *by written reasoning* ("the vendor has other
   remedies"). The prompt's `filedByRole: 'buyer' | 'seller'` opens
   seller-filed disputes. That may be right — a courier short-paid, a
   buyer who received goods and won't confirm — but it reverses a comment
   that records a decision, so the reversal is written down where the
   comment lives, with the standing question answered: what does the
   vendor contest when the money already moved?

7. **The windows are rows, enforced by the sweep.** 48h response, 7-day
   evidence, 14-day decision: none exist, and the 14-day filing window
   isn't checked in `openDispute` today (a settled order from March is
   disputable). All four deadlines go on the dispute row as timestamps
   — the shopping-run `deadline` lesson, third time — enforced by the
   house unref'd sweep timer, and the receipt states the window ("After
   that, no dispute") exactly as the prompt says. The maturity rule: a
   deadline in prose has no trigger.

8. **Evidence is rows, and the private-upload mechanism already exists.**
   `supplyVerification.js` takes 1–8 **private evidence images** per
   submission with type and note — the same shape this prompt needs, for
   the same reviewer purpose. Arrays on the dispute row (`buyerEvidence:
   [...]`) would be the JSON-blob pattern the records keep refusing
   (verification's `history`, team's history): one row per upload, typed,
   attributed, appended. "No secret submissions — both parties see what
   the other submitted" is a projection choice on those rows, and
   `traceNotes` stays admin-readable only. The prompt is right that
   symmetric visibility is what makes mediation possible; the rows just
   make it auditable too.

9. **The replacement outcome is not a fake zero-total order.**
   `createOrder` computes total from a listing's price; an order with no
   charge is not a thing the write path can honestly produce. The
   replacement is a resolution outcome on the dispute — with its own
   fulfilment row if the parties need one — linked to the original order.
   Decide the shape when the outcome door is built; don't bend the order
   entity to carry a free item it never priced.

10. **Verification and disputes unblock each other — name the seam, then
    stop waiting.** This prompt's step 7 (suspend on file, restore or
    revoke on resolve) needs the verification flow; the verification
    prompt's dispute triggers need this one. Neither gates the core:
    disputes need orders, rows, windows and the ledger — all standing.
    Build the core; wire both suspension seams the day the other surface
    lands. The 3-in-30-days revocation threshold is then a derived read
    over resolution rows — day-window arithmetic computed at read, never a
    stored counter.

11. **Every refund is a payout — the fifth surface to meet
    `buni.js:335`.** "Money moves from seller's held balance to buyer via
    the Settlement Rail `reverse()`" has two absences in the tree: no
    `reverse()` (the reversal door the Settlement record keeps reserving),
    and B2C disbursement refused until KCB's letter. Until both land, the
    honest outcome line is the one the prompt already writes for the
    protection fund, extended: `seller_pays` — recorded as ledger rows,
    confirmed by finance, receipt marked *manual settlement, not
    Trace-verified* — or `unresolved`. The prompt's own protection-fund
    discipline ("until then, the honest outcome is seller_pays or
    unresolved") is the model: defer the claim, keep the row.

12. **Removals: phantom. The table: nine arrived.** No "contact support"
    placeholder exists anywhere; no dispute UI on public surfaces exists
    (disputes are not public in this repo at all); no hardcoded refund
    outcomes exist. And the operator's table now counts **ten prompts
    delivered** — nine have arrived. Events & Ticketing appears for the
    fourth time without ever being sent. Also carried forward: the Shop
    Brief unblock ("1 dispute filed, under review") is safe — a
    present-state read, day-scoped, derived from rows that will exist.

---

## The prompt's test requirements, mapped

| Required by the prompt | Where it stands |
| --- | --- |
| file within 14 days; refused after | new — the window check on `openDispute` (correction 7) |
| filing puts a hold; no funds move | half held — the order's `disputed` state is the hold; the ledger cannot hold settled money (correction 4) |
| filing suspends verification | gated — the mutual seam (correction 10) |
| 48h no response + credible evidence → auto full refund | new — with credibility as constants (correction 5) |
| seller voluntary full refund any time | new — the first resolution door; `disputed → refunded` |
| both parties upload; visible to both | new — evidence rows on the supply-verification pattern (correction 8) |
| admin resolves full / partial / none / replacement | new — the exits the transition table refused to guess (correction 2); partial needs refund rows (correction 4) |
| every resolution has a visible note | new — on the resolution, both parties' projection |
| partial moves only the specified amount | new — refund rows summing under the transaction (correction 4) |
| withdrawal releases funds; no re-filing | half held — `withdrawn` is named; the door is new (correction 3); idempotent filing already refuses doubles |
| 14 days no progress auto-expires | new — sweep-enforced, with the same credibility constants |
| 3 against in 30 days revokes verification | gated on verification — derived read, never a counter (correction 10) |
| nothing on public pages or Nearby | held — disputes are not public anywhere in this repo |
| no double filing for one order | **held** — idempotency-before-eligibility, tested in the existing path |

## What is genuinely new here

The resolution doors the transition table deliberately left empty ·
categories, amounts and refund rows · the three windows as timestamps ·
the evidence rows · the admin queue · the auto-resolve law with its
constants · the withdrawal door for the already-named state · the
buyer-history view and the flag-not-ban rule · the verification seam.
The filing path this prompt specifies — receipt → "File a dispute" →
category → evidence → the seller's 48 hours — sits on a primitive that
already exists, already refuses doubles, already notifies, and already
carries the contested state on the order itself. This is the rare prompt
in the series where the tree has been *waiting*: the exits were left
empty with the reason written down.

---

## The prompt, as received (verbatim)

What follows is the prompt exactly as it was received — unedited, including
the self-contradicted auto-resolution and the unrepresentable hold. It is
kept so the corrections can be checked against the ask, and so no future
builder has to trust a paraphrase.

````markdown
# Trace — Dispute Resolution (Builder Prompt)

You are building Dispute Resolution: the mechanism that
handles what happens when a buyer, seller, or partner
disagrees about an order. It is the missing link between the
Settlement Rail (money) and Verification (trust).

Without disputes, Trace is a mechanism that moves money and
hopes. Every marketplace that failed did so because it had no
answer to "the thing I bought wasn't what I paid for."

## The problem it solves

Mary orders 3kg of tilapia from Testshop for KES 1,020. She
pays via M-Pesa. The fish arrives. It's 2kg, and it smells old.

Options today:
1. Mary messages Testshop on WhatsApp. Owner denies it.
2. Mary calls the estate admin. Nobody knows what to do.
3. Mary leaves a bad review. Testshop calls it unfair. War.

There is no path. Nobody wins. The customer stops using Trace.
The shop loses a customer. Trust collapses for everyone.

After this prompt: Mary files a dispute. Testshop has 48 hours
to respond. Both upload evidence. Trace mediates. One of four
outcomes is reached: full refund, partial refund, no refund,
or escalated to a human mediator. The outcome is recorded.
Both parties accept it and move on — or the shop is
suspended and the buyer is refunded by Trace's protection
fund (once the pool exists).

## What you are building (and what you are NOT)

You ARE building:
- A `dispute` entity linked to a settlement transaction
- A filing flow (buyer or seller can file)
- A response window (48 hours for the other party)
- An evidence upload (photos, message logs, screenshots)
- A resolution outcome (full / partial / none / escalated)
- Holds on the underlying settlement during the dispute
- Suspension of verification while a dispute is open
- A record of outcomes on both parties' histories
- A record of outcomes on the shop's public page (aggregate
  count only)

You are NOT building:
- A public shaming surface (no "N disputes filed against this
  shop" on the public page — only the shop owner sees the
  count)
- A star rating system (separate feature)
- An open-ended mediation (each dispute must reach a decision
  within 14 days)
- A "Trace guarantees your money back" claim until the
  protection fund exists
- Any auto-resolution (all outcomes are human-decided unless
  the seller voluntarily refunds)
- Any arbitration that requires lawyers

Disputes are operational, not legal. Trace brokers. It doesn't
adjudicate.

## Non-negotiables

- A dispute is filed against a specific settled order. Not a
  shop in general. Not a user in general.
- The disputed amount cannot exceed the order's settled
  amount.
- The buyer can file within 14 days of settlement. After
  that, no dispute. The window is stated on the receipt.
- The seller has 48 hours to respond. If they don't, the
  dispute is automatically resolved in the buyer's favour
  (full refund) — but only if the evidence is credible.
  Otherwise the dispute escalates.
- Both parties can upload evidence: photos, screenshots of
  messages, order details.
- The buyer's evidence and the seller's evidence are both
  visible to both parties. Transparency on both sides. No
  secret submissions.
- If the shop has a `verified` verification, it is
  `suspended` while any dispute is open. It returns to
  `confirmed` if the dispute resolves in the shop's favour.
  It stays suspended if the dispute resolves against.
- The settlement funds are held during the dispute. Not
  refunded, not released. Held.
- A dispute cannot be filed twice for the same order.
- A dispute that is open blocks new reviews for the order.
  (Reviews are a separate feature — this prompt only
  guarantees the block.)
- The resolution is recorded on both parties' records. A
  shop's public page shows nothing about individual
  disputes — only the shop owner sees the count of disputes
  in their dashboard.
- A "protected" dispute (where Trace refunds the buyer even
  though the seller is at fault and can't be made to pay) is
  possible only after the protection fund is funded. Until
  then, the honest outcome is "seller_pays" or "unresolved."

## The Dispute entity

```
DISPUTE
├── id
├── orderId             (the settled order being disputed)
├── transactionId       (the specific settlement transaction)
├── filedBy             (userId)
├── filedByRole         ('buyer' | 'seller')
├── filedAt             (ISO)
├── category            ('not_delivered' | 'wrong_item'
│                        | 'damaged' | 'short_quantity'
│                        | 'quality' | 'unauthorised_charge'
│                        | 'other')
├── description         (free text — required)
│
├── STATUS
│   ├── status          ('open' | 'seller_responding'
│   │                    | 'evidence_gathering'
│   │                    | 'resolved' | 'escalated'
│   │                    | 'withdrawn' | 'expired')
│   └── statusChangedAt (ISO)
│
├── EVIDENCE
│   ├── buyerEvidence   (array of { type, url, note, at })
│   ├── sellerEvidence  (array of { type, url, note, at })
│   └── traceNotes      (array of admin notes — internal)
│
├── WINDOWS
│   ├── responseDueAt   (ISO — 48h after filing)
│   ├── evidenceDueAt   (ISO — 7 days after filing)
│   └── decisionDueAt   (ISO — 14 days after filing)
│
├── RESOLUTION
│   ├── outcome         ('full_refund' | 'partial_refund'
│   │                    | 'no_refund' | 'replacement' | null)
│   ├── refundAmount    (integer KES — for partial)
│   ├── resolvedBy      (userId — admin, or 'auto' if
│   │                    | seller accepted)
│   ├── resolvedAt      (ISO)
│   └── resolutionNote  (free text, visible to both parties)
│
└── ACTIONS
    └── timeline        (array of { action, by, at, note })
```

Status transitions:
```
open → seller_responding   (seller opens the dispute)
open → resolved           (seller accepts fault + refunds)
open → escalated          (buyer asks for admin review)
open → withdrawn          (buyer cancels the dispute)
seller_responding → evidence_gathering  (both parties upload)
seller_responding → resolved             (seller refunds voluntarily)
seller_responding → escalated            (48h passes with no response)
evidence_gathering → resolved             (admin decides)
evidence_gathering → escalated            (admin can't decide alone)
escalated → resolved                      (senior admin decides)
open → expired                            (14 days without action)
```

No other transitions. `expired` disputes are auto-closed in
the buyer's favour if the seller never responded. If the seller
did respond, the dispute escalates to a senior admin.

## The filing flow (buyer side)

From the order receipt:

```
┌─────────────────────────────────────┐
│  Order #4821                        │
│  Testshop · 21 Sept · KES 1,020    │
│                                     │
│  Received?                          │
│  [ It was fine ]  [ File a dispute ]│
│                                     │
└─────────────────────────────────────┘
```

Tapping "File a dispute" opens:

```
┌─────────────────────────────────────┐
│  File a dispute                     │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  WHAT WENT WRONG?                   │
│  ○ I didn't receive it              │
│  ○ Wrong item                       │
│  ○ Damaged                          │
│  ○ Short quantity                   │
│  ○ Quality issue                    │
│  ○ Unauthorised charge              │
│  ○ Other                            │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  TELL US WHAT HAPPENED              │
│  [                               ]  │
│  [                               ]  │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  PHOTOS (optional)                  │
│  [ Upload ]  [ Upload ]  [ + ]      │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  Your dispute goes to the seller    │
│  first. They have 48 hours to       │
│  respond. If they don't, Trace      │
│  reviews it.                        │
│                                     │
│  Filing a dispute does not refund   │
│  you automatically. It starts a     │
│  review.                            │
│                                     │
│  [ File dispute ]                   │
│                                     │
└─────────────────────────────────────┘
```

Once filed:

1. The dispute is created with status `open`.
2. The settlement transaction's status is `held` (the money
   stays frozen).
3. The shop's verification is `suspended` (if it was
   `confirmed`).
4. The seller receives a WhatsApp:

```
A dispute was filed on order #4821.

Reason: {{category}}
Description: {{description}}

Review the evidence and respond within 48 hours.
If you don't respond, Trace reviews it in the buyer's
favour if the evidence is credible.

Respond: {{disputeUrl}}
```

## The response flow (seller side)

The seller opens the dispute from the shop dashboard:

```
┌─────────────────────────────────────┐
│  Dispute · Order #4821              │
│  Filed by Mary                      │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  WHAT THE BUYER SAID                │
│  Category: Short quantity           │
│  "I ordered 3kg, received 2kg"      │
│                                     │
│  Buyer's photos (1)                 │
│  [ View ]                           │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  YOUR RESPONSE                      │
│  [                               ]  │
│  [                               ]  │
│                                     │
│  YOUR EVIDENCE (optional)           │
│  [ Upload ]  [ + ]                  │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  You have 42 hours left to respond. │
│                                     │
│  [ Respond ]  [ Refund in full ]    │
│                                     │
└─────────────────────────────────────┘
```

Two actions:
- **Respond** — submits the seller's side, moves to
  `evidence_gathering`.
- **Refund in full** — the seller accepts fault and refunds
  the order. Dispute becomes `resolved` with outcome
  `full_refund`. Money moves back to the buyer via the
  Settlement Rail.

If the seller takes no action in 48 hours:
- If the buyer's evidence is credible (has photos, has a
  plausible category) → auto-resolve `full_refund`.
- If the buyer's evidence is weak (no photos, category is
  `other` with a vague description) → escalate to admin.

**The auto-resolve rule is honest.** A seller who ignores a
credible dispute loses. A seller who ignores a vague dispute
gets a chance for a human to look at it.

## The evidence phase

Both parties upload. The evidence is visible to both.

```
┌─────────────────────────────────────┐
│  Dispute · Order #4821              │
│  Evidence gathering                 │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  BUYER'S EVIDENCE                   │
│  📷 Photo: fish on scale showing 2kg│
│  💬 Screenshot: order says 3kg     │
│                                     │
│  SELLER'S EVIDENCE                  │
│  📷 Photo: receipt showing 3kg      │
│  💬 Screenshot: WhatsApp confirming │
│     "3kg delivered"                 │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  Evidence due in 5 days.            │
│  Decision within 14 days.           │
│                                     │
└─────────────────────────────────────┘
```

**No hidden evidence.** Both parties see what the other
submitted. This is what makes mediation possible.

## The resolution

An admin (or senior admin for escalated disputes) reviews both
sides and decides:

```
┌─────────────────────────────────────┐
│  Resolve dispute · #4821            │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  BUYER'S CASE                       │
│  3kg ordered, 2kg delivered. Photo  │
│  shows 2kg on a scale.              │
│                                     │
│  SELLER'S CASE                      │
│  Receipt shows 3kg. Buyer signed    │
│  for 3kg on WhatsApp.               │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  OUTCOME                            │
│  ○ Full refund · KES 1,020          │
│  ○ Partial refund · [    ] KES      │
│  ○ No refund — seller was correct   │
│  ○ Replacement — coordinate a swap  │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  NOTE TO BOTH PARTIES               │
│  [                               ]  │
│                                     │
│  [ Resolve ]                        │
│                                     │
└─────────────────────────────────────┘
```

**Partial refund** — the admin enters the amount. Usually
proportional to the loss (in this case, 1kg of 3kg = KES 340).

**No refund** — the admin decides the seller was correct. The
dispute is resolved against the buyer. This is rare but real.

**Replacement** — the seller sends a new item. Both parties
agree. The dispute is resolved without money moving.

Every resolution has a note that both parties see:

```
Testshop refunds KES 340 (1kg short).

The receipt showed 3kg, but the buyer's photo shows 2kg
on a scale. The seller cannot produce a photo of the
3kg delivery. Partial refund in the buyer's favour.
```

**Every outcome is explained.** No "we decided, deal with it."

## The four outcomes in detail

### Outcome 1 — Full refund

The buyer was right. The seller pays the full amount back.

- Settlement Rail: `reverse()` for the full amount.
- Money moves from seller's held balance to buyer.
- Dispute status: `resolved`.
- Outcome: `full_refund`.
- Both parties notified with the resolution note.
- The order shows as "Refunded" on both sides.

### Outcome 2 — Partial refund

The buyer was partially right. The seller pays back part.

- Settlement Rail: `reverse()` for the partial amount.
- The remainder is released to the seller normally.
- Dispute status: `resolved`.
- Outcome: `partial_refund`.
- Both parties notified.

### Outcome 3 — No refund

The seller was right. The buyer's dispute is declined.

- Settlement Rail: release the held funds to the seller.
- Dispute status: `resolved`.
- Outcome: `no_refund`.
- Both parties notified.

### Outcome 4 — Replacement

Both parties agree the seller will send a new item. No money
moves. The dispute is closed once the replacement arrives.

- Settlement Rail: release the held funds to the seller
  (the original sale stands).
- A new "replacement" order is created — it has no charge.
- Dispute status: `resolved`.
- Outcome: `replacement`.
- Both parties notified.

## The withdrawal path

The buyer can withdraw their dispute at any time before
resolution:

```
┌─────────────────────────────────────┐
│  Withdraw dispute?                  │
│                                     │
│  This closes the dispute and        │
│  releases the funds to the seller.  │
│                                     │
│  You cannot file another dispute    │
│  for this order.                    │
│                                     │
│  [ Withdraw ]  [ Keep open ]        │
│                                     │
└─────────────────────────────────────┘
```

Withdrawal releases the held funds to the seller. The dispute
is closed. No further action.

## The expiry path

If a dispute sits open for 14 days with no progress:

- **Seller never responded + buyer evidence is credible** →
  auto full refund.
- **Seller responded but no admin decision** → escalate to
  senior admin.
- **Neither party took action** → auto-close `expired`.
  Funds release to the seller with a note that no decision
  was reached.

The 14-day limit prevents disputes from lingering.

## The consequences

### On the shop's verification

While a dispute is open:
```
verification.status = 'suspended'
verification.suspendedReason = 'dispute_open'
```

If resolved in the shop's favour:
```
verification.status = 'confirmed'
```

If resolved against the shop (full or partial refund):
```
verification.status = 'confirmed' (restored)
```
The shop keeps its verification but its `disputeCount`
increments.

If a shop accumulates **3 disputes resolved against it in 30
days**:
```
verification.status = 'revoked'
verification.revokedReason = 'dispute_threshold'
```
The shop loses verification. Can re-apply after 90 days.

### On the shop's dashboard

The shop owner sees their dispute count. Nobody else does.

```
┌─────────────────────────────────────┐
│  Testshop · Disputes                │
│                                     │
│  Open:       1                      │
│  This month: 2                      │
│  Lifetime:   3                      │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  #4821  Short quantity              │
│  Filed 21 Sept · under review       │
│                                     │
│  #4790  Quality issue               │
│  Filed 14 Sept · resolved: refunded │
│                                     │
└─────────────────────────────────────┘
```

**No dispute count on the public page.** Only the shop sees
their own. The public page shows verification status only.

### On the buyer's history

The buyer's account shows disputes they've filed. This is
visible only to them and to Trace admins. A buyer who files
10 disputes in a month gets flagged for review — not banned,
just flagged.

**No buyer is banned for filing disputes.** Filing is a
right. Filing falsely is flagged.

## What to remove from the current surface

- Any "contact support" placeholder that isn't wired to this
  flow.
- Any dispute UI on the public page or Nearby (disputes are
  private between the parties).
- Any hardcoded "resolution: refund" outcomes.

## Test requirements

- A buyer can file a dispute on a settled order within 14
  days. Filing after 14 days is refused at the API.
- Filing puts a hold on the settlement transaction. No funds
  move until resolution.
- Filing suspends the shop's verification if it was
  `confirmed`.
- The seller has 48 hours to respond. No response + credible
  buyer evidence → auto full refund.
- The seller can voluntarily refund (full) at any time.
- Both parties can upload evidence. Evidence is visible to
  both.
- An admin can resolve as `full_refund`, `partial_refund`,
  `no_refund`, or `replacement`.
- Every resolution has a note visible to both parties.
- A partial refund moves only the specified amount.
- Withdrawal releases the held funds to the seller.
- 14 days with no progress auto-expires the dispute.
- 3 disputes resolved against a shop in 30 days revokes
  verification.
- No dispute info is visible on the public page or Nearby.
- A dispute cannot be filed twice for the same order.

## The one rule

A dispute is a conversation with evidence. Both sides speak.
A human decides. The decision is written down and visible to
both. Money moves according to the decision, or is held until
it's made.

No party is silenced. No party is favoured. The evidence is
the truth.

## Order of operations

1. `dispute` entity + status state machine.
2. Filing flow (buyer).
3. Response flow (seller).
4. Evidence upload + visibility.
5. Admin resolution queue.
6. Settlement Rail integration (hold, reverse, release).
7. Verification suspension integration.
8. Auto-resolve rules (48h, 14d).
9. Dispute count + threshold revocation.
10. Buyer history.

Each step ships separately. Each step has its own test.

## What this unblocks

- The Settlement Rail has a reason to hold and reverse.
- Verification has a real suspension trigger.
- Reviews (next feature) have a gate — no review until the
  dispute resolves.
- The Shop Brief can say "1 dispute filed, under review."
- A buyer has a path when things go wrong.
- A seller has a defense when the buyer is wrong.
- Trust becomes a mechanism, not a hope.

## Reference

The Settlement Rail moves money. Verification assigns trust.
Disputes are what happens when trust breaks. Without a
dispute path, every transaction is a gamble. With a path,
every party has recourse — and every party knows it.

Ship this. Then the money has a recourse. Then the badge has
a consequence. Then the platform has a spine.
````

---

## Operator's note (received with the prompt, outside it)

> **Why Disputes, Next**
>
> Look at the current stack:
>
> | Feature | What it does | What happens when things go wrong |
> |---|---|---|
> | Settlement Rail | Moves money | **Nothing** |
> | Verification | Assigns trust | Suspends on a dispute that doesn't exist yet |
> | Nearby | Shows shops | Buyer has no path when a shop fails |
> | Shop Brief | Reports activity | Can't report a dispute that doesn't exist |
> | Events | Sells tickets | No path when a host cancels mid-event |
> | Shopping Runs | Coordinates trips | No path when a shopper loses goods |
> | Team & Roles | Attributes work | Logs a dispute that has nowhere to go |
> | Partner Onboarding | Onboards riders | No path when a delivery goes wrong |
>
> **Every single feature in the stack assumes disputes exist.**
> None of them have a mechanism for handling disagreement. That's
> the missing link.
>
> **Disputes are the consequence layer.** Without them, the
> Settlement Rail holds money forever, Verification suspends on
> a nonexistent trigger, and every party is left to argue on
> WhatsApp.
>
> Ship disputes. Then every other feature's failure mode has an
> answer.
>
> ---
>
> **Where We Are Now** — ten builder prompts delivered:
>
> | # | Prompt | Depends on |
> |---|---|---|
> | 1 | Shop Brief | Team & Roles |
> | 2 | Settlement Rail | — |
> | 3 | Nearby | — |
> | 4 | Shopping Run Stream | Nearby + Rail |
> | 5 | Invite-a-Shop | Nearby + Rail |
> | 6 | Events & Ticketing | Rail |
> | 7 | Partner Onboarding | Rail |
> | 8 | Team & Roles | — |
> | 9 | Verification Flow | — |
> | 10 | Dispute Resolution | Settlement Rail + Verification |
>
> **Recommended build order now:**
>
> 1. **Settlement Rail** — money moves
> 2. **Team & Roles** — attribution
> 3. **Verification Flow** — trust badge
> 4. **Dispute Resolution** — the consequence layer
> 5. **Nearby** — consumer sees shops
> 6. **Partner Onboarding** — supply side
> 7. **Shop Brief** — daily truth (now with dispute visibility)
> 8. **Invite-a-Shop** — growth
> 9. **Events & Ticketing** — consumer inflow
> 10. **Shopping Run Stream** — community
>
> **Remaining natural prompts:**
>
> 1. **Reviews (settlement-gated)** — real trust from real orders
> 2. **The Consumer Profile** — buyer's own page
> 3. **The Space Editor v2** — public page editing with history
> 4. **Trace Rewards** — what quality shops earn over time
> 5. **Group Buy Streams** — bulk purchasing for estates
>
> Say **"next"** and I'll pick the highest-leverage remaining one.

The note's own table betrays it twice, gently. First: "Verification
suspends on a dispute that doesn't exist yet" — true, and the repo
phrase is stronger: the exits from `disputed` were left empty *on
purpose*, with the reason in the transition table, because guessing a
resolution without the flow would have been a lie about what happened.
This prompt is the flow; the doors were waiting for it. Second: "ten
builder prompts delivered" — nine have arrived; Events & Ticketing is
counted for the fourth time and has never been sent. The closing
sentence is the right one, and the tree already agrees with it in
structure: filing exists, the contested state exists, the doubles are
refused, the notification fires — the spine is there. What this prompt
adds is the recourse: the doors, the windows, the evidence, the
decision, the note both parties read. Ship the doors. The spine was
poured waiting for them.
