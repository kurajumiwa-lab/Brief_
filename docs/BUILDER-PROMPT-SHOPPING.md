# Trace — Shopping Run Stream (Builder Prompt)

> Status: **not started, by design.** The surface cleanup this prompt was gated on
> shipped first (see *Already done below*). Nothing in this file is built yet, and
> the "Corrections" section is not optional reading — four lines of the original
> brief describe arithmetic this repo cannot perform.

You are building the Shopping Run Stream: a coordination layer for supermarket
runs. Not a marketplace. Not an e-commerce site. A stream that formalises what
estate WhatsApp groups already do.

## The problem it solves

A resident needs items from Carrefour. They can't go. Or they can go, but the
transport costs too much alone. Either way, they lose — time, money, or both.

A second resident is going anyway. They have room in their car or on their matatu
seat. They could carry items for a neighbour, for a share of the transport.

Today this happens over WhatsApp: 40 messages, screenshots of M-Pesa, arguments
over who paid. Trace formalises it.

## What you are building (and what you are NOT)

You ARE building:
- A "shopping run" that has a source, a day, a window, and a list of participants
- Two roles: shopper (going anyway) and requester (needs items)
- Bundle savings shown as items or people are added
- A price broadcast from a shopper on site, to the run
- Settlement: per-item paid by requester, transport split equally

You are NOT building:
- A general-purpose marketplace (Discover handles that)
- A reviews or rating system (there are no rows to back one — see
  `server/src/domain/position.js`: no ladder, no tiers, no streaks)
- Promoted listings or paid placement
- Any "featured" or "top" mechanic
- Any savings number that is not computed from rows

## Non-negotiables (the repo already enforces these elsewhere; keep them)

- Every number printed is derived from a row the user could query. A `0` is
  allowed only when it is the true count; an unmeasurable figure is `—`.
- No defaults for source, day, or window. Blank ≠ Carrefour.
- No "recommended" listings, no seeded participants, no "N slots filling fast".
- No promo language. No "amazing deal". No emojis anywhere near money.
- Settlement is via M-Pesa. No points, no credits, no tokens (the referral points
  pool is a different rail and must not be used to settle a run).
- The stream a person reads is a **query over rows**, recomputed on read — it is
  not a stored tally that can drift from the rows it claims to summarise.

## What to build (in order)

### Step 1 — `shoppingRuns` rows
Fields: `id, source, sourceKind, area, day, windowFrom, windowTo, capacity,
transportKes, createdBy, createdAt, status`.
Status: `forming | confirmed | running | settled | cancelled`.
Source is validated (`SOURCES` in the domain, exported so the UI imports it
rather than copying it). Unknown source → refused with the list, never silently
filed under "local market". No `transportKes` → the run is `forming` and the
savings panel prints `—`, because a split of an unstated cost is not a number.

### Step 2 — `shoppingLists` rows
Fields: `id, runId, requesterId, items[], subtotal, status`.
`items[]`: `{ name, qty, priceEstimate }`. `priceEstimate` is **the requester's
own expectation**, labelled as such. This app fetches no shelf prices from
anywhere, so an estimate is the only price that can legitimately appear — and it
must never be printed as "the price at Carrefour".

### Step 3 — Join flow
One screen, two buttons: `I'm going` (shopper) / `I need items` (requester).
Capacity is enforced on the write, with the refusal shown verbatim on the card.

### Step 4 — The savings arithmetic
A pure function over rows: `transportPerSlot = transportKes / slotsTaken`, and
the one comparison that is honest — **what my share is now, against what it would
be with one more person sharing**. The server exposes it as
`GET /api/runs/:id/savings` and the client renders its answer without recomputing
anything (the lesson of `spaceMoneySummary`: two copies of a formula drift).
No savings is printed for a scenario that has no rows behind it.

### Step 5 — Broadcast templates
Five, following the four already shipped for the Membley run:
run announced · shopper joined · list posted · price found · run settled.
Plain English first. Each ends with one action. A broadcast is a row in the run
stream (the existing space-broadcast rail), not a new messaging system — Trace is
the record, WhatsApp stays the chat.

### Step 6 — Settlement
Per-item amounts are paid between members; Trace records that it happened.
**Today Trace cannot pay anybody out.** Collection works
(`server/src/connectors/buni.js`: STK push, UAT-verified contract), but B2C —
which is what "transport split to the shopper" needs — is refused in code until
KCB sends the transfer body spec, and `payoutFee()` returns `null` because no
schedule is published. So the "pending manual" branch in the original brief is
not a fallback, it is the **only** branch until that letter arrives: the receipt
says `manual settlement, not Trace-verified`, and a run cannot be marked settled
by a bot.

### Step 7 — Discovery
A `runs` room in the taxonomy (`preview/src/features/city/taxonomy.ts`) so the band
and the picker pick it up from one list. Shown: `forming` or `confirmed`, in the
member's area, not cancelled. Sorted by day, soonest first. No promoted runs, no
popularity sort, no counts on tiles that a row did not produce.

## Corrections to the original brief (four of them, all from the code)

1. **"The stream is a query, not a stored entity" contradicts Step 1's entity.**
   Both are true at different layers and the distinction matters: runs, lists and
   broadcasts are rows (they record promises); the *stream's* numbers — who is
   going, slots left, each share — are computed on read. A stored tally of
   "3 shoppers" is a number that can disagree with its own rows.
2. **"Add 5 more items → transport KES 400, you save 67" is not derivable.**
   Nothing in the model ties item count to vehicle capacity or fare, so the fare
   would have to be invented twice: once as a curve, once as the saving. Only
   `transportKes ÷ people` is arithmetically available. Drop "more items reduce
   transport" unless a real capacity/price row exists.
3. **"Order from Naivas instead → items KES 745, save 50" requires price data that
   does not exist.** There is no key-free price source wired anywhere (see
   `worldSignal.js`: `prices.status = 'not_configured'`, with the reason spelled
   out). Cross-shop price comparison stays unbuilt, and the tile that would show
   it shows `—` or nothing.
4. **"'local market' in the known-source list" is a category, not a source.** A
   market has a name. Model `sourceKind: 'chain' | 'market'` with a required
   `source` string in both cases, validated against the chain list for the first.

## Already done (do not redo)

- Discover's four flow tiles and the duplicate chip row are gone: one `Browse`
  entry opens a picker carrying the counts (`preview/src/features/city/DiscoverFeed.tsx`).
- The band carries rooms only; the flows live where they need a sentence
  (`preview/src/app/AppBelt.tsx`).
- The sheet is six entries, and a test fails if it grows or duplicates the band
  (`preview/appbelt.jsx`).
- Home's earn block renders nothing when all three rails are truly empty, and
  distinguishes "no rows" from "the read failed" (`preview/src/features/home/EarnStrip.tsx`).
- The `people not counted` caption is off the views tile; the explanation is on
  You → How Trace works (`SpaceStorefrontHeader.tsx`).
- The cake emoji and the prefilled sample offer ("Birthday Cake", 4500, "Custom
  2-tier celebration cake, baked fresh", "Get my first 20 customers") are gone
  from the create paths — those defaults were how a real shop's "Meals" offer
  ended up described as cake.

## Test requirements

- 1 shopper + 3 requesters: each share = `transportKes / 3`, and the arithmetic is
  asserted against the same function the UI calls, not a hand-computed constant.
- 0 requesters + 2 shoppers → stays `forming`.
- At capacity → the join is refused, the refusal is shown on the row.
- No change to the rows → savings is exactly `0`, and the panel says so rather
  than hiding.
- An unknown source → refused at the API, not coerced.
- A run with no `transportKes` → every derived figure prints `—`.
- No number is printed on any run surface that a test cannot recompute from rows.
- Settlement with B2C unavailable → status stays `pending_manual` and the receipt
  says it is not Trace-verified. `settled` must be unreachable without a real
  ledger row.

## The one rule

If a number isn't backed by a row, don't print it. If a saving isn't real, don't
show it. If the settlement isn't done, say so. Honesty is the product; the run is
the surface.

## Reference

The Membley Saturday run is the template: `server/src/domain/pickups.js`,
`server/src/domain/space.js` (broadcasts + the money summary), and
`preview/src/features/city/ErrandsLobby.tsx` for the kind-of-a-row pattern
(taxonomy on the server, optional on the form, refusal wording shared).
