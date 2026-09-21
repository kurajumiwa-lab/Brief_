# Trace — Reviews (Settlement-Gated) (Builder Prompt)

> Status: **the tree already has a rating system — for people — and every
> refusal of shop ratings is recorded as conditional on exactly the rows
> this prompt creates.** `errands.js` stores party-written, immutable stars
> (`errandRatings`) with the law in a comment: "No average is computed,
> because a **per-person** average is a score." Nearby refused ratings "no
> rows back them **yet**." The public-face panel: "Brief stores no reviews,
> **so** a tick here would be decoration over nothing." All conditionals.
> The rows arrive here. What remains the tree's own, unconditional: no
> per-person score, no tier ladder, no trust score, no leaderboard, no sort
> effect — and this prompt agrees with every one.
>
> The one decision this prompt exists to force: **the aggregate.** "4.6 from
> 12 buyers" is aggregating stars into a reputation number — the exact
> sentence the errands law refuses to compute, for anyone. Its scope as
> written is per-person; its reasoning does not distinguish person from
> shop. Read **Corrections first** — correction 2 is the decision, stated
> with both readings. Verified against the tree on 2026-09-21.

---

## Corrections first (what was changed, and why)

1. **Rating rows already exist — for people.** `rateErrand(id, { actorId,
   stars, note })`: one rating per person per completed delivery, the two
   parties only, whole stars 1–5, immutability enforced at the write
   ("you have already rated this delivery — ratings are not edited away"),
   stored in `errandRatings` with the rater's direction recorded. The
   prompt's shop review is this family's second member, and its rules are
   the same law restated for a different object: one per order, no editing,
   report-don't-edit. Build it as that family member — same write
   discipline, same stored-as-said philosophy — under its own name
   (`errandRatings` is taken; the order-review rows are not `ratings` in
   general). The family resemblance belongs in the code comment, not
   silently.

2. **THE decision: the aggregate.** The tree computes no average anywhere.
   The errands law's scope is per-person — "a per-person average is a
   score" — and a shop aggregate is therefore open territory *as
   written*. But the law's fuller sentence is "aggregating stars into a
   reputation number is how a credit score is born, and Brief is not a
   bank," and it does not say "per-person" there. 4.6 from 12 buyers IS
   aggregating stars into a reputation number. The prompt's mitigations
   are real and answer the law's failure modes: a 90-day window (the
   signal ages out — current-state, not a lifetime score), a 5-review
   threshold (silence below — no three-family-members 5.0), immutability,
   no leaderboard, no sort effect, no badge, "a review is either shown or
   not shown." Whether those mitigations *are* the written answer to the
   credit-score argument, or whether the argument extends to shops
   untouched, is the operator's call — made once, in writing, next to the
   errands comment so the two laws cannot silently disagree. Until that
   call: review rows, individual reviews and the response door can ship;
   the aggregate display is the part with a written argument against it.

3. **The refusals were conditional; this prompt completes their sentences.**
   Every recorded refusal of reviews is a conditional on absent rows — and
   the conditions are what this prompt changes. When the rows exist, the
   sentences get finished, not deleted: the public-face panel's comment is
   rewritten to name the rows that now back the display (the `room.jsx`
   pattern — explanations move or update, they never vanish), and the
   Nearby record's "yet" expires. What no rows ever justify: a per-person
   score (`position.js`: "NO tier/badge ladder, NO trust score"), a
   "Top Rated" badge, a "Best in Kilimani" — the prompt bans all three
   itself. Its "the rating is a gradient" line in the Reference is prose;
   on any surface, the gradient is still just the rows.

4. **`shopId` is `vendorId` — sixth time.** The parent decision is now a
   series convention: vendor stays the parent, "shop" is the WhatsApp shop
   builder. `REVIEW.shopId` keys to `vendorId`.

5. **The dispute interaction is half-gated — the block ships, the restore
   waits.** Open dispute rows exist today (status `'open'`), so both
   "a review under an open dispute is hidden" and "a buyer cannot review
   while their dispute is open" are enforceable from existing rows — the
   Disputes record explicitly reserved this hook ("this prompt only
   guarantees the block"). The restore-on-resolution waits on the
   resolution door that does not exist yet. Until then, hidden stays
   hidden — which errs toward silence, the house default. The review
   prompt's own deferral ("delayed until 24 hours after resolution")
   likewise needs the resolution row to exist; until then the deferral is
   indefinite, and honest about being so.

6. **The aggregate is derived-on-read — the prompt's best instinct, and the
   house law.** "If a shop drops below 5 reviews, the aggregate disappears
   on the next render": never stored, computed from rows, threshold and
   window as named constants. One read function — count, sum, breakdown,
   the 1-decimal figure — imported by the public page and the card alike,
   the way `SOURCES` is exported so the UI imports rather than copies. No
   stored `ratingAvg` on the vendor row may exist under any circumstance;
   a stored average would drift from its own reviews (the first law of
   this whole series).

7. **The 90-day window is a decision — write it down like
   `OVERRIDE_MONTHS`.** A rolling window on a public surface is new (the
   brief bans rolling windows on *its own* screen; dashboards may carry
   them), and the prompt's reason is good — "a review from 2 years ago
   says nothing about the current kitchen." Name the constant, state the
   reason beside it. The shop dashboard's "last 30 / 90 / 365" trend rows
   are three more rolling windows, owner-facing and permitted — each is
   another read, none may be a stored counter, and "up from 4.4" framing
   belongs to the operator, not to any surface (see correction 8).

8. **The Shop Brief unblock breaks the brief three ways at once — the
   series record.** "★ 4.6 this week, up from 4.4" is, in order: a rating
   (the brief's first non-negotiable: "No rating, badge, or rank"), a
   rolling week (banned on the brief's own screen), and a trend comparison
   ("up from" — the brief does not compare, advise or coach). What the
   brief may say, day-scoped and derived: a count — "2 buyers left reviews
   today" — and nothing more. This is the most-violated unblock in eleven
   prompts, and the pattern is now unmistakable: every feature wants to
   live on the brief, and the brief keeps refusing because the brief is
   the one surface that cannot lie.

9. **The WhatsApp prompt rides the outbound seam — eighth surface.** One
   message, sent once: one notification row, one sent flag — the shop
   brief's own delivery discipline ("one per day at most"). The 24-hour
   delay is the house unref'd sweep timer; the dispute-deferral variant is
   the same sweep watching dispute rows. "Not nagged" is enforced
   structurally by the sent row, not by politeness. The review form itself
   is a web door off the message — the errands lobby pattern of a link
   into the app, not a bot conversation.

10. **Frozen `buyerDisplayName` is the settlement-snapshot pattern.** The
    name is read from the user row once at submission and never
    re-derived — a later profile edit must not rewrite history, exactly as
    a partner settlement's snapshot survives later activity. First name +
    last initial is a projection choice the tree can honour (display-name
    derivation is trivial); the order-context line — items and date, never
    the amount, never the contact — is data minimisation consistent with
    the errands receipt. Photos (up to 3) go through the existing upload
    pipeline; they are the buyer's own images, publicly displayed by
    choice, and they are the one part of the row worth a retention
    sentence.

11. **Removals: phantom except Wairo — plus one flag for the prompt that
    was never sent.** No "rating: 4.9" fixtures; **`BriefAiAssistant.tsx`
    does not exist**; no "★ 4.8" on any shop card; no top-rated sort; no
    "N people reviewed this" text; no review-for-points mechanic (the
    earn strip is rails, not points). The only ★ glyphs in the entire
    client are "★ Featured" markers on event cards and a "★ Cover" label
    in a composer — not ratings. The flag: "★ Featured" on
    `EventCard.tsx` is a promoted-placement marker — the pattern this
    series refuses on every surface it touches — and it belongs to the
    Events surface, whose prompt has now been counted in the operator's
    tables five times without ever being sent. When that prompt finally
    arrives, Featured is on its removal docket, beside the wairo fixtures.

12. **What carries.** Immutability with the report-don't-edit path ·
    settled-order gating (the order pipeline and `settled` status are
    standing; the 14-day-old-settlement filing window from the disputes
    record is the model if a freshness bound is wanted on reviews) ·
    silence below threshold · no hidden scoring · the shop's report not
    auto-hiding (the asymmetry is right and rare) · 3-distinct-reports
    auto-hide as a row-derived constant (the flags law, satisfied) · one
    immutable response per review · the honesty line on the submit screen
    ("You can't edit this after you submit") — the interface saying the
    truth the write path enforces.

---

## The prompt's test requirements, mapped

| Required by the prompt | Where it stands |
| --- | --- |
| review only after settlement; refused otherwise | new — `settled` is a real order state; the gate is one check |
| one review per order; no editing | new — the `rateErrand` immutability pattern, order-keyed |
| rating 4 shows 4 stars; no text is valid | new — whole-integer stars as in `RATING_MIN/MAX` |
| photos show on the public page | new — upload pipeline exists |
| aggregate only at ≥5; disappears below | **the decision** (correction 2) — derived-on-read either way (correction 6) |
| 90-day exclusion from the aggregate; old reviews still visible | new — window constant + the individual page |
| shop responds once; response immutable | new |
| open dispute hides the review | **shippable today** — dispute rows exist (correction 5) |
| buyer can't review during an open dispute | **shippable today** — same rows |
| review returns when the dispute resolves | gated — the resolution door does not exist yet (correction 5) |
| 3+ distinct reports auto-hide; shop report doesn't | new — deterministic constants |
| admin can restore or remove | new — the moderation capability already exists (`moderate`) |
| no rating anywhere below threshold — public page, Nearby card | new — the display rules of two records, finally with rows |
| no fake review via any API; every review traces to a settled order | held by construction — the gate IS the join |

## What is genuinely new here

The order-review row — the second member of a family whose first is
`errandRatings` · the single-prompt write path · the individual review
section on the server-rendered public page · the response door · the
report flow with its honest asymmetry · the dispute hide (shippable
today) and restore (gated on resolution) · and the aggregate — the one
number in eleven prompts that the tree has a written argument against,
waiting on a decision rather than on plumbing.

---

## The prompt, as received (verbatim)

What follows is the prompt exactly as it was received — unedited, including
the aggregate the tree has an argument against. It is kept so the
corrections can be checked against the ask, and so no future builder has to
trust a paraphrase.

````markdown
# Trace — Reviews (Settlement-Gated) (Builder Prompt)

You are building Reviews: the trust signal that comes from
real buyers who paid real money and received a real thing.
Not from followers. Not from likes. Not from a marketing
campaign. From completed orders.

This is the last piece of the trust stack. Verification says
"a real person visited this shop." Disputes say "here's what
happens when it goes wrong." Reviews say "here's what hundreds
of buyers actually think."

## The problem it solves

A resident in Kilimani opens the Trace Nearby list. Two
fish vendors. Both are verified. Both have the same prices.
Which one do they call?

Today: they ask the estate WhatsApp group and hope someone
has an opinion.

After this prompt: the public page shows "4.6 from 12 buyers
in the last 90 days." That's the answer. Not a marketing
claim. A record of real orders.

The seller side matters too. A good shop with 40 completed
orders has no way to show the world. Reviews give them that.
Not as a badge to chase. As a record that proves itself.

## What you are building (and what you are NOT)

You ARE building:
- A `review` entity linked to a settled order
- A prompt to leave a review, once, after order completion
- A gated requirement: only buyers with a settled order
  can review
- A 1–5 rating + optional text + optional photos
- A public display: aggregate score + review count, with a
  minimum threshold before displaying
- An individual review view for buyers and the shop owner
- A shop's right to respond to a review, once
- A reporting flow for review abuse

You are NOT building:
- A "leave a review" nag every time the buyer opens the app
- Any incentive to leave a review (points, discounts,
  rewards)
- Any way for the shop to filter, hide, or delete reviews
- A way for the buyer to edit a review after submission
- A rating on anything that isn't tied to a settled order
- A "top reviewed" ranking that changes the Nearby sort
- Any rating for events, partners, or runs (that's separate)
- Any hidden scoring (a review is either shown or not shown)
- Any "verified buyer" badge (the whole review is from a
  verified buyer — it's redundant)
- Any numeric rating before the minimum threshold

Reviews are a record. Not a game.

## Non-negotiables

- **Only buyers with a settled order can review.** No
  general reviews. No "I heard this shop is good."
- **A buyer can only review once per order.** No editing. No
  re-submitting. If they made a mistake, they can report
  their own review for removal.
- **The rating is 1–5 integers.** No half stars. No
  "recommend / don't recommend" binary. No emoji.
- **The public page shows the aggregate rating only when at
  least 5 reviews exist.** Before that, it shows nothing —
  not "0 reviews," not "no reviews yet," nothing. A shop
  with 4 reviews is not rated.
- **The aggregate is over the last 90 days.** Older reviews
  are archived but visible on the individual review page.
  The aggregate is current-state.
- **No review can be deleted by the shop.** Only by an
  admin, and only under the abuse policy.
- **A shop can respond once per review.** The response is
  public. It cannot be edited after submission.
- **A review that's part of an open dispute is hidden**
  until the dispute resolves. The review still exists but
  is not counted.
- **No paid reviews.** No incentivised reviews. No
  "review for a discount." Any such offer is grounds for
  shop suspension.
- **No scraped reviews.** No imported reviews. No seeded
  reviews. The only reviews are ones a buyer wrote after a
  real order.
- **The reviewer's name is visible.** First name + last
  initial. Not anonymous. Not "Verified Buyer." Real people
  put their name on their opinion.
- **The reviewer's order is linked.** A reader can see
  "Order: 3kg tilapia, 21 Sept." Not the amount. Not the
  contact. Just enough context to know the review is real.

## The Review entity

```
REVIEW
├── id
├── orderId             (the settled order)
├── shopId              (derived from the order)
├── buyerId             (the reviewer)
├── buyerDisplayName    (First name + last initial at
│                        time of review — frozen)
├── rating              (1 | 2 | 3 | 4 | 5)
├── text                (nullable, max 800 chars)
├── photos              (array of up to 3 image URLs)
├── submittedAt         (ISO)
├── hidden              (boolean — for disputes, abuse,
│                        or admin action)
├── hiddenReason        (nullable)
├── hiddenAt            (nullable)
├── shopResponse        (nullable)
│   ├── text
│   ├── respondedAt
│   └── respondedBy     (userId)
├── reports             (array of { by, at, reason })
└── flags               (array of { kind, at, note } — internal)
```

**Reviews are immutable.** The `text` and `rating` cannot be
edited. A buyer who made a typo can report their own review
for removal — an admin decides. That's the only path to
"edit" a review.

## The write path (buyer)

After an order's settlement confirms, the buyer receives a
single WhatsApp message 24 hours later:

```
Your order from Testshop arrived.

How was it?
{{reviewUrl}}

One review per order. No editing after.
```

The WhatsApp is sent **once**. Not repeated. Not nagged.

If they tap the link, they see:

```
┌─────────────────────────────────────┐
│  Review Testshop                    │
│  Order: 3kg tilapia · 21 Sept       │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  YOUR RATING                        │
│  ★ ★ ★ ★ ★                         │
│  (tap to set)                       │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  TELL OTHERS (optional)             │
│  [                               ]  │
│  [                               ]  │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  PHOTOS (optional, up to 3)         │
│  [ Upload ]  [ + ]                  │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  You can't edit this after you      │
│  submit. Your name will show as     │
│  "Mary K."                          │
│                                     │
│  [ Submit review ]                  │
│                                     │
└─────────────────────────────────────┘
```

**What's on the screen that matters:**
- The order details (so they remember which order)
- The rating (star input)
- Optional text
- Optional photos
- The honesty line: "You can't edit this after you submit"
- Their display name, shown before submission

After submission:

```
┌─────────────────────────────────────┐
│                                     │
│              ✓                      │
│                                     │
│  Thanks. Your review is on          │
│  Testshop's page.                   │
│                                     │
│  [ View your review ]               │
│  [ Back to Nearby ]                 │
│                                     │
└─────────────────────────────────────┘
```

Done. No "share to earn points." No "review 3 more shops to
unlock a badge." The review exists. That's the whole flow.

## The public display

### On the public shop page

When a shop has **at least 5 reviews** in the last 90 days:

```
Testshop ✓
Food · Open now
★★★★☆ 4.6 · 12 reviews · last 90 days
```

Under the fold, in the "What buyers say" section:

```
WHAT BUYERS SAY
─────────────────────────────────────
4.6 ★ from 12 reviews

RATING BREAKDOWN
5 ★ ████████████ 8
4 ★ ████         3
3 ★ █            1
2 ★              0
1 ★              0

RECENT REVIEWS
[ See all 12 → ]

── Mary K. · 4 ★ · 21 Sept
   "Fresh tilapia, arrived on time. Slightly
    smaller than expected."
   Testshop responded:
   "Thanks Mary — we'll weigh twice next time."

── Peter O. · 5 ★ · 19 Sept
   "Best fish in Kilimani. Been buying for
    two years."
```

When a shop has **fewer than 5 reviews**, the public page
shows **nothing**. Not "no reviews yet." Not "be the first to
review." Silence. The shop is not rated.

**Why silence?** Because showing "3 reviews, 5.0 stars" tells
a visitor nothing reliable. Three reviews could all be
family. Five is the minimum for a rating to mean anything.
Before that, it doesn't.

**Why 90 days?** Because a shop's quality can change. A
review from 2 years ago says nothing about the current
kitchen. The aggregate is a current-state signal.

### On Nearby

Reviewed shops show the aggregate:

```
┌─────────────────────────────────────┐
│  Testshop ✓                         │
│  Food · Open now · 0.3 km           │
│  ★ 4.6 (12)  ·  🍲 Meals · KES 150 │
│  [ Chat on WhatsApp → ]             │
└─────────────────────────────────────┘
```

Shops with fewer than 5 reviews show no rating. The card is
visually identical in every other way.

**No rating appears anywhere else.** Not in the header. Not
in the search results. Only on the shop card and the shop's
public page.

### The rating widget

The aggregate is one star display:

```
★★★★☆  4.6 · 12 reviews
```

- Stars: filled for the rounded-down value, half-filled for
  the remainder
- Number: 1 decimal, always shown
- Count: in parentheses, small, muted

No "Top Rated" badge. No "Best in Kilimani." Just the number.

## The response flow (shop owner)

A shop can respond to any review, once.

```
┌─────────────────────────────────────┐
│  Review from Mary K. · 4 ★          │
│  21 Sept                            │
│                                     │
│  "Fresh tilapia, arrived on time.   │
│   Slightly smaller than expected."  │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  YOUR RESPONSE (one-time)           │
│  [                               ]  │
│  [                               ]  │
│                                     │
│  You can respond once. Your         │
│  response cannot be edited.         │
│                                     │
│  [ Post response ]                  │
│                                     │
└─────────────────────────────────────┘
```

**Rules for responses:**
- One per review
- Max 500 characters
- Cannot be edited after posting
- Cannot be deleted
- Public, shown under the review
- No threats, no personal information about the reviewer, no
  off-platform contact attempts (rate-limited and reported)

A good response is a signal:

```
Testshop responded:
"Thanks Mary — we'll weigh twice next time."
```

A bad response is also a signal — and it's on the shop's
record. No filtering.

**No "hide negative review" option.** The shop has to live
with what buyers say. This is the whole point.

## The minimum threshold logic

```
reviewCount = count of reviews WHERE
  shopId = this shop
  AND hidden = false
  AND submittedAt > now - 90 days

if reviewCount >= 5:
  aggregate = round(sum(rating) / reviewCount, 1)
  show aggregate
else:
  show nothing
```

**No "4 reviews so far" partial.** No "coming soon." No
"collecting reviews." The threshold is 5 or nothing.

If a shop drops below 5 reviews (because old ones aged out),
the aggregate disappears on the next render.

## The report flow

Any user can report a review as abuse:

```
┌─────────────────────────────────────┐
│  Report this review                 │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  WHY?                               │
│  ○ Fake review (never happened)     │
│  ○ Abusive language                 │
│  ○ Off-topic (not about this shop)  │
│  ○ Contains personal information    │
│  ○ Other                            │
│                                     │
│  NOTES (optional)                   │
│  [                               ]  │
│                                     │
│  [ Report ]                         │
│                                     │
└─────────────────────────────────────┘
```

A report creates a row in the review's `reports` array. If
3+ reports accumulate from distinct users, the review is
auto-hidden pending admin review.

**Auto-hide is not deletion.** An admin reviews and either:
- Restores the review (reports dismissed)
- Removes the review permanently (abuse confirmed)
- Marks the reviewer for review (repeat offender)

The shop owner can also report a review. If they do, the
report is flagged for admin review but does **not** auto-hide
the review. Shops cannot silence reviews by reporting them.

## The dispute interaction

If an order is under active dispute, its review (if it
exists) is hidden:

```
review.hidden = true
review.hiddenReason = 'dispute_open'
```

When the dispute resolves:
- **In buyer's favour** → the review is restored, counted
- **In seller's favour** → the review is restored, counted
- **Either way** → the review is restored once a decision
  is reached

A dispute doesn't affect whether the review exists. It
affects whether it's visible during the resolution.

**A buyer cannot leave a review while a dispute is open.**
The review prompt is delayed until 24 hours after
resolution, not 24 hours after order completion.

## The shop's view

The shop dashboard has a "Reviews" section:

```
┌─────────────────────────────────────┐
│  Testshop · Reviews                 │
│                                     │
│  ★ 4.6 · 12 reviews · last 90 days  │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  RATING TREND                       │
│  last 30 days  ★ 4.7                │
│  last 90 days  ★ 4.6                │
│  last 365 days ★ 4.4                │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  RECENT                             │
│  Mary K.   4 ★ · 21 Sept  [Respond] │
│  Peter O.  5 ★ · 19 Sept  ✓         │
│  Grace M.  5 ★ · 18 Sept  ✓         │
│                                     │
│  [ See all 12 ]                     │
│                                     │
└─────────────────────────────────────┘
```

**Reviews the shop hasn't responded to** have a `[Respond]`
button. Responded reviews show `✓`.

**No "unread reviews" nag.** No badge. No counter. The owner
opens when they open.

## What to remove from the current surface

- Any "rating: 4.9" hardcoded in fixtures or seed data
- The `BriefAiAssistant.tsx` fixture with fake reviews
- Any "★ 4.8" on the shop cards that isn't derived from a
  `reviews` query
- Any "top rated" or "highest rated" sort option
- Any "N people reviewed this" text that isn't a real count
- Any "review us to earn points" mechanic in any surface

## Test requirements

- A buyer can review an order after settlement. The review
  is created with `hidden = false`.
- A buyer cannot review an order twice. The API refuses.
- A buyer cannot review an order that isn't settled. The
  API refuses.
- A review with rating 4 shows 4 stars and a text field.
- A review with rating 4 and no text is valid.
- A review with photos shows them on the public page.
- The aggregate only appears when reviewCount >= 5.
- The aggregate disappears when a shop drops below 5.
- Reviews older than 90 days are excluded from the
  aggregate but still visible on the individual review
  page.
- A shop can respond once per review. Second attempt is
  refused.
- A response cannot be edited. The API refuses.
- A review under an open dispute is hidden. It returns when
  the dispute resolves.
- A buyer cannot submit a review while a dispute is open on
  their order.
- 3+ abuse reports from distinct users auto-hides the
  review pending admin review.
- A shop's report does not auto-hide the review.
- An admin can restore or remove a hidden review.
- The public page shows no rating when reviewCount < 5.
- The Nearby card shows no rating when reviewCount < 5.
- No fake review can be created via any API. Every review
  must trace to a real settled order.

## The one rule

A review is a record of a real transaction. Not an opinion.
Not a campaign. Not a metric to game. It exists because a
buyer paid money, received something, and had a view.

If there's no order, there's no review. If there's no
review, there's no rating. If there's no rating, the page
says nothing. Silence is honest.

## Order of operations

1. `review` entity + status rules.
2. The write path: prompt after settlement + review form.
3. The public display: aggregate + individual reviews.
4. The response flow for shop owners.
5. The report flow + auto-hide.
6. The dispute integration (hide while open, restore after).
7. The shop dashboard view.

Each step ships separately. Each step has its own test.

## What this unblocks

- The public page has real content, not just a menu.
- The Nearby list has a trust signal beyond ✓.
- The Shop Brief can say "★ 4.6 this week, up from 4.4."
- Buyers have a reason to check the shop before ordering.
- Sellers have a reason to maintain quality over time.
- A shop's reputation is a slow-growing asset, not a
  purchase.
- Disputes have a consequence beyond verification
  suspension — the review stays on the record.

## Reference

The verification badge says "a real person visited." Reviews
say "here's what hundreds of real buyers experienced." The
badge is binary. The rating is a gradient. Together they
tell the whole truth about a shop.

Ship reviews. Then the shop has a face. Then the buyer has
a way to check. Then the market has a signal.

Reviews are the last piece of the trust stack. After this,
every surface in the app has a real number behind it.
````

---

## Operator's note (received with the prompt, outside it)

> **Why Reviews, Next**
>
> Look at what's already spec'd:
>
> | Feature | What it does | Reviews dependency |
> |---|---|---|
> | Verification | Binary trust (✓ or nothing) | Reviews provide the gradient |
> | Disputes | Handle failures | Reviews gate behind disputes |
> | Shop Brief | Daily owner truth | Can now say "★ 4.6, up from 4.4" |
> | Public page | Show shop | Has nothing to say without reviews |
> | Nearby | Consumer entry | Buyer has no way to distinguish shops |
> | Shopping Runs | Coordinate | Nothing to reference without reviews |
>
> **Reviews is the missing middle layer.** Verification is
> binary and disputes are rare. Between them, reviews are
> what a buyer actually looks at before deciding.
>
> The stack now:
>
> - **Settlement Rail** — money moves
> - **Team & Roles** — attribution exists
> - **Verification** — trust is asserted
> - **Disputes** — failures have recourse
> - **Reviews** — quality is measured
>
> That's the whole spine of a marketplace.
>
> ---
>
> **Where We Are Now** — eleven builder prompts delivered:
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
> | 10 | Dispute Resolution | Rail + Verification |
> | 11 | Reviews | Rail + Disputes |
>
> **Recommended build order now:**
>
> 1. **Settlement Rail** — money moves
> 2. **Team & Roles** — attribution
> 3. **Verification Flow** — trust badge
> 4. **Dispute Resolution** — consequence layer
> 5. **Reviews** — trust gradient
> 6. **Nearby** — consumer entry
> 7. **Partner Onboarding** — supply side
> 8. **Shop Brief** — daily truth
> 9. **Invite-a-Shop** — growth
> 10. **Events & Ticketing** — consumer inflow
> 11. **Shopping Run Stream** — community
>
> **Remaining natural prompts:**
>
> 1. **The Consumer Profile** — buyer's own page (orders, saved shops, reviews left)
> 2. **The Space Editor v2** — public page editing with history
> 3. **Trace Rewards** — what quality shops earn over time
> 4. **Group Buy Streams** — bulk purchasing for estates
> 5. **The Trace Card** — the shop's physical card for customers to save the shop's number
> 6. **The Field Agent App** — the deep-dive on the agent's own surface
> 7. **The Partner Wallet** — the partner's earnings dashboard in depth
>
> Say **"next"** and I'll pick the highest-leverage remaining one.

Two corrections to the note, both by now traditional. "Eleven builder
prompts delivered" — ten have arrived; Events & Ticketing is counted for
the fifth time and has never been sent. And the table's Shop Brief row
carries the series' most-violated unblock yet: "★ 4.6, up from 4.4" is a
rating, a rolling week and a comparison on the one surface whose
non-negotiables refuse all three. The closing claim — "after this, every
surface in the app has a real number behind it" — is the tree's own law,
stated back at it; what this prompt actually adds is subtler: the first
number that is a *decision* rather than a count. Every other figure in
eleven prompts was arithmetic waiting to happen. The aggregate is a
written argument waiting to be answered. Answer it in writing — beside
the comment in `errands.js` that will still be there, correctly
refusing to average people — and the gradient can ship honestly.
