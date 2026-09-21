# Trace — Events & Ticketing (Builder Prompt)

> Status: **the phantom arrives — into the most-built surface in the
> series.** Six records counted this prompt in tables it never graced; it
> is here now, and the tree it lands on is *comprehensive*: `campaign.js`
> **is** the event entity (capacity, price with 0 = free, `circleId` for
> circle hosting, derived registrations and remaining capacity), `events.js`
> is the browsing hub whose header says "It creates NO second event table,"
> `ticketMarket.js` already runs QR tickets with transfer-rotating code
> versions, check-in exists (`checked_in`, `checkedInBy`, `campaign_checkin`
> signals), public event pages with registration exist, payment-confirmed
> registrations ride the ordinary settlement path, and `eventDetail.mjs`
> (13) + `eventExpiry.mjs` (4) pass on re-run today. Even the punchline:
> `EventsHub` is already embedded in the Nearby screen.
>
> What is genuinely new: the 15-minute seat hold, held revenue until
> completion, host payout and cancellation refunds (all behind the recurring
> disbursement wall), the auto-complete sweep, and three scoping decisions
> this prompt must write down (resale, featured, "X going"). Read
> **Corrections first**. Verified against the tree on 2026-09-21.

---

## Corrections first (what was changed, and why)

1. **The event entity exists — it is called a campaign, and a second table
   is forbidden in writing.** `events.js`'s header: "One honest browsing
   surface over the events that actually exist: published campaigns… It
   creates NO second event table — a category is a campaign type, popularity
   is counted registrations, 'featured' is an explicit organiser choice."
   `campaign.js` carries everything the prompt's `EVENT` asks for:
   `capacity` (positive integer, validated), `price` (non-negative KES,
   **default 0 — free events are the default, exactly as the prompt
   insists**), `startsAt`/`endsAt`, a host, `circleId` (circle hosting
   exists), `CAMPAIGN_TYPES` (`popup, session, drop, event, contribution`)
   as the categories. Registrations, checked-in counts and remaining
   capacity are **derived, never stored**. The prompt's instruction — "any
   existing code that treats an 'event' as a place or a shop should be
   migrated to this entity" — is precisely the migration the header exists
   to prevent. The build extends the campaign row (a `hostShopId` keying to
   the vendor, per the series convention, sixth time), never a parallel
   `events` collection.

2. **Paid tickets, check-in, and QR codes are standing — with one door and
   one wall.** Registration is confirmed through the ordinary settlement
   path (`/api/campaigns/:id/registrations/:regId/confirm-payment` — "it
   does not write a registration status directly, and it writes no
   counter"), which is the honest version of "ticket sales through the
   Settlement Rail": collection works (Buni STK). Check-in exists as rows:
   `checked_in` status, `checkedInAt`, `checkedInBy`, a `campaign_checkin`
   signal. `ticketMarket.js` (Tikiti T1) already mints tickets from
   confirmed registrations, prices everything server-side ("a client-sent
   price is never read"), kills every previously printed QR on ownership
   change (`codeVersion`), and gates ownership transfer on a genuinely
   settled ledger row. What has no door: host payout and refunds —
   disbursement is refused in code until KCB's letter (`buni.js:335`), the
   sixth surface to meet that sentence, and there is no reversal door.
   Held revenue, host payout, and automatic cancellation refunds are
   therefore all `pending_manual` + finance-confirmed until those land —
   the receipts say recorded, not moved.

3. **The transferability ban collides with a built market.** The prompt:
   "non-transferable by default, opt-in per event." The tree: an entire
   resale market exists because seats transfer — one active listing per
   ticket, locked while pending, voiding as a moderation act, refunds
   reverting ownership. These can coexist — the event's `transferable`
   flag gating whether `ticketMarket` accepts listings for its tickets is
   a clean read — but the default reverses the direction the tree
   already built in. Decide in writing, next to the ticketMarket header:
   which way the default faces, and what happens to existing resellable
   registrations when an event sets the flag off.

4. **"★ Featured" — the marker this series flagged twice, resolved.** The
   Reviews record flagged `EventCard.tsx`'s "★ Featured" as promoted
   placement belonging to this prompt's docket. The tree's answer:
   `setFeatured(ownerId, campaignId, featured)` — "'featured' is an
   explicit organiser choice," not a platform-sold slot, and the Events Hub
   counts popularity as *counted registrations* ("N going"-adjacent only
   where derivable). The prompt's ban — "a 'featured event' or 'promoted
   event' slot" — is honoured if it is scoped to **platform-sold
   placement**; the organiser's own switch is self-presentation, the same
   class as an owner writing their own description. Write the scoping into
   this prompt's NOT-build list and the flag keeps its defence; leave it
   unscoped and a built, honest feature is condemned by a sentence that
   meant something else.

5. **"Any social proof" vs the circle overlap — same scoping discipline.**
   The public page ban list ("attendee names, view count, 'X going'")
   matches the tree's own rules — a view is "a recorded event, not an
   increment," and no attendance numbers are invented. But
   `tableBankingOverlapFor` computes **"3 from your Circle going"** for the
   signed-in viewer, from their own groups against real registrations,
   never stored, null for anonymous viewers. That is not public social
   proof; it is a per-viewer derived fact about the viewer's own
   communities. The ban should name its target (public aggregate counts)
   and explicitly spare the viewer-scoped overlap — or remove the feature;
   either is honest, silence on the distinction is not.

6. **The genuinely new mechanics, and their timers.** The 15-minute
   reservation hold (a `reserved` registration with an expiry, releasing
   the seat on timeout) is new — the campaigns' derived-remaining logic
   gives it a seat pool to draw from, and a late-settling payment must
   refund, not resurrect, exactly as the prompt says. Auto-completion at
   24 hours with a 12-hour reminder rides the house unref'd sweep timer —
   and "silence is not a cancellation" is the correct honesty, the mirror
   of the calendar's natural expiry (`hasEnded` already ends events whose
   time has passed). Host cancellation refunds wait on the reversal door;
   until then, cancelled events hold recorded refund obligations, finance-
   confirmed, receipts marked manual.

7. **The fee is already a derived constant — and the mockup agrees with
   it.** `commissionRate()` (default **0.05**, env-configurable, validated
   on read) is the platform fee; the prompt's host dashboard shows "KES 675
   (5%)" — the one mockup in the series whose arithmetic matches the
   tree's default. The fee must be taken once per settled ticket through
   the settlement path (the same no-double-charge invariant
   `splitAmount` guarantees: commission + seller === total, by
   construction). No stored revenue counters on the event row — sales,
   held, and net are derived reads, as the registrations already are.

8. **The Nearby chip already exists inside the name collision.** `EventsHub`
   is embedded in `NearbyScreen.tsx` today — the aggregation surface the
   Nearby record said holds the name. So "events on Nearby" is standing,
   inside the very screen whose name the directory build must resolve. The
   prompt's sort rule (startsAt ascending, nothing else, past events drop
   off after 24h) matches the hub's natural expiry and honest browse;
   `eventExpiry.mjs` (4 PASS) already tests that past occurrences leave
   the rails.

9. **The Shop Brief unblock survives — barely, and day-scoped.** "27
   tickets sold for Friday's event" mixes days in its phrasing, but the
   underlying read is honest: tickets sold *today* for any event is a row
   count the brief may print. What it may not print: attendance forecasts,
   "trending" anything, or a countdown to doors (future days are refused
   on the brief's own screen). The pattern holds for the ninth time: the
   brief takes counts, not narratives.

10. **Removals: the assumption is shipped, the scoping is the work.** The
    prompt's "4 empty flow cards… This prompt assumes that removal has
    landed" — correct, `0d97d70`, first verified in the Shop Brief record.
    "Events are events, not places with dates" is honoured in the tree's
    own vocabulary already — campaigns typed `event` render as experiences,
    and nothing treats an event as a venue. There is nothing to migrate;
    there are three scopes to write (corrections 3, 4, 5).

11. **What carries, so it is not rebuilt.** Server-side capacity refusal
    (validated positive integer, derived remaining, "must not consume
    remaining capacity" on lapsed holds) · free events as first-class
    (price defaults to 0) · natural expiry · payment via the settlement
    path · check-in as attributed rows · server-priced everything ·
    moderation acts reason-required and audited · "N of M seats remaining"
    as the only public count — which the derived projection already is.

12. **The recap table: one phantom retired, another crowned.** Eleven
    prompts have now genuinely arrived — this is the eleventh. The recap
    declares "Twelve prompts delivered" and lists "**Group Buy Streams** |
    Delivered" — Group Buy has never been sent; it now sits in the chair
    this prompt just vacated, as prompt #6 sat in it for six records. The
    remaining list is otherwise honest: Consumer Profile, Space Editor v2,
    Trace Card, Field Agent App, Protection Fund — none received.

---

## The prompt's test requirements, mapped

| Required by the prompt | Where it stands |
| --- | --- |
| capacity 40 accepts exactly 40; the 41st refused | **held** — validated capacity, derived remaining, server-side |
| reserved ticket expires at 15 min; seat returns | new — the hold on the registration row, sweep-released |
| late settlement → refund, never resurrect | new — and honest-only: recorded refunds until the rail moves money |
| free event → `paid` ticket without payment | **held in substance** — price defaults to 0; the paid-state naming follows the registration flow |
| no host withdrawal before completion | new — and moot until payout exists (`pending_manual`) |
| host cancellation refunds all paid tickets | gated — the reversal door does not exist (correction 2) |
| no-show marked after endsAt; no refund | held in substance — checked-in is a row state; the end-of-night sweep is new |
| a scanned ticket cannot scan twice | **held** — check-in rows with `checkedInAt`/`checkedInBy` |
| public page shows no attendee names, views, "X going" | **held** — views are recorded events, not increments; scope the circle overlap (correction 5) |
| unconfirmed host → auto-complete at 24h | new — the sweep, with the 12h reminder in the outbound stream |
| fee deducted exactly once per settled ticket | **held by construction** — the split-arithmetic invariant |
| Nearby sorted by startsAt only; past events drop off | **held** — natural expiry tested in `eventExpiry.mjs` |

## What is genuinely new here

The 15-minute seat hold and its release sweep · held revenue and the
host-payout door (gated, `pending_manual` until the wall moves) · the
cancellation refund flow (same gate) · auto-completion with its reminder ·
the three written scopes (transferable default, featured, social proof) ·
the `hostShopId` key. Beneath all of it: the event, the ticket, the
check-in, the QR, the public page, the payment path, the capacity law and
the free-event default are standing, tested, and more honest than the
prompt dared assume. This is the series' punchline surface: the prompt
counted six times as missing arrived to find itself mostly built.

---

## The prompt, as received (verbatim)

What follows is the prompt exactly as it was received — unedited, including
the migration instruction the tree's own header forbids and the resale ban
that collides with a built market. It is kept so the corrections can be
checked against the ask, and so no future builder has to trust a paraphrase.

````markdown
# Trace — Events & Ticketing (Builder Prompt)

You are building Events & Ticketing: the second consumer inflow
after Nearby. A shop, an individual, or a circle can host an
event. Attendees buy tickets through the Settlement Rail. The
host is paid after the event completes.

This is the mechanism that turns Trace from a directory into a
place where things happen. Without events, a consumer opens the
app once a week to shop. With events, they open it every day.

## The problem it solves

A comedian in Kilimani wants to do a small show. 40 seats, KES
500 a head. Today, they post on WhatsApp, take cash at the door,
and hope. No-shows steal seats. Latecomers argue about price.
The take is unrecorded. Next month, the same loop.

A cooking class, a workshop, a chess tournament, an estate
party, a football watch-along — the same pattern, the same
problem, four different hosts.

Trace formalises it: create the event, sell the tickets, hold
the money, confirm the event happened, pay the host. Every
step is a real row.

## What you are building (and what you are NOT)

You ARE building:
- An `event` entity with host, venue, time, capacity, price
- A `ticket` entity linked to a buyer and an event
- Ticket sales through the Settlement Rail (collection)
- Host payout through the Settlement Rail (disbursement),
  held until the event completes
- Attendance confirmation via a QR code or a short code
- Refund flow through the Settlement Rail
- Capacity enforcement (server-side)
- Non-transferability by default, opt-in per event
- A public event page (read-only, shareable)
- Events on the Nearby surface, filtered alongside shops

You are NOT building:
- A "featured event" or "promoted event" slot
- Any "trending" or "popular" sort
- Any rating or review of events (no rows yet)
- Any rescheduling logic (cancellation and re-creation only)
- Any seat selection or floor plan
- Any discount codes or promo pricing
- Any "sold out in 5 minutes" urgency mechanic
- Any fake attendance number, view count, or "X going"

The event is a real thing at a real time. Nothing about it is
invented.

## Non-negotiables

- Capacity is enforced server-side. A 40-seat event accepts
  exactly 40 tickets. The 41st buyer is refused, not
  waitlisted.
- Money is held by Trace until the event completes. The host
  cannot withdraw early. If the host cancels, all tickets are
  refunded automatically.
- A ticket is non-transferable by default. The buyer's name is
  on it. It cannot be resold through Trace.
- An event cannot be created without a venue, a date, a start
  time, a duration, a capacity, and a price (or "free").
- Free events are real events. They have capacity, tickets,
  and attendance. They just have price = 0.
- The public event page shows the host's name and a link to
  their Trace page. No anonymous events.
- No-show tickets are not refunded. The money stays with the
  host. This is stated at purchase.
- The host must confirm the event happened within 24 hours of
  the end time. If they don't, the money is auto-released
  after 24h + a reminder.

## The Event entity

```
EVENT
├── id
├── hostId             (userId — a shop owner, an individual,
│                       or a circle coordinator)
├── hostType           ('shop' | 'individual' | 'circle')
├── hostShopId         (nullable — set if hostType is 'shop')
├── hostCircleId       (nullable — set if hostType is 'circle')
├── title
├── description
├── category           ('music' | 'workshop' | 'sports' |
│                       'food' | 'community' | 'other')
├── venueName
├── venueAddress
├── venueCoordinates   (nullable — { lat, lng })
├── startsAt           (ISO, EAT)
├── endsAt             (ISO, EAT)
├── doorsOpenAt        (ISO, EAT — when attendees can enter)
├── capacity           (integer, minimum 2, maximum 5000)
├── price              (integer KES, or 0 for free)
├── currency           ('KES')
├── transferable       (boolean, default false)
├── refundPolicy       ('no_refund' | 'host_cancel_only')
├── status             ('draft' | 'published' | 'sold_out' |
│                       'running' | 'completed' | 'cancelled')
├── createdAt
├── publishedAt        (nullable)
└── completedAt        (nullable)
```

Status transitions:
```
draft → published         (host publishes)
draft → cancelled         (host abandons)
published → sold_out      (capacity reached)
published → running       (at doorsOpenAt)
published → cancelled     (host cancels)
sold_out → running        (at doorsOpenAt)
sold_out → cancelled      (host cancels)
running → completed       (at endsAt or host confirms)
running → cancelled       (emergency only)
```

No other transitions. An event cannot go from `draft` to
`running` without being published. A `completed` event is
final. A `cancelled` event triggers refunds.

## The Ticket entity

```
TICKET
├── id
├── eventId
├── buyerId            (userId)
├── buyerName          (the name on the ticket)
├── ticketCode         (short code — 6 chars — for attendance)
├── qrPayload          (a signed string for the QR code)
├── status             ('reserved' | 'paid' | 'attended' |
│                       'no_show' | 'refunded' | 'cancelled')
├── reservedAt         (when buyer initiated checkout)
├── paidAt             (when payment settled)
├── attendedAt         (when ticket was scanned)
├── refundedAt         (nullable)
└── refundReason       (nullable)
```

Status transitions:
```
reserved → paid        (Settlement Rail confirms)
reserved → cancelled   (buyer abandons within 15 min, or
                        payment fails)
paid → attended        (QR scanned at doors)
paid → no_show         (event ends without scan)
paid → refunded        (host cancelled, or event cancelled)
```

A `reserved` ticket holds a seat for 15 minutes. After that,
it expires and the seat returns to the pool. No seat is held
indefinitely.

## The purchase flow

```
┌─────────────────────────────────────┐
│  An Evening with Wanjiru Kamau      │
│  Friday 3 Oct · 19:00–21:00         │
│  The Alchemist, Westlands           │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  KES 500 per ticket                 │
│  Seats: 27 of 40 remaining          │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  NUMBER OF TICKETS                  │
│  [ 1 ▾ ]                            │
│                                     │
│  NAME FOR THE TICKET                │
│  [                               ]  │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  Total: KES 500                     │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  Tickets are not refundable if you  │
│  don't attend. If the host cancels, │
│  you are refunded automatically.    │
│                                     │
│  [ Pay with M-Pesa ]                │
│                                     │
└─────────────────────────────────────┘
```

**What happens when they tap "Pay":**

1. A `reserved` ticket is created and holds the seat for 15
   minutes.
2. The Settlement Rail collects via M-Pesa STK Push.
3. If payment settles within 15 min, ticket becomes `paid`.
   QR code is shown. Confirmation sent.
4. If payment fails or times out, the ticket is cancelled
   and the seat returns to the pool.

**Multiple tickets on one purchase.** A buyer can purchase up
to 5 tickets in one transaction. Each ticket has its own name
and code. The buyer enters each name. The others receive a
WhatsApp with their ticket code.

**Free events.** Same flow. No payment step. The ticket is
`paid` immediately upon reservation. This is honest — the
ticket exists even when money doesn't move.

## The attendance flow

At the venue, at `doorsOpenAt`, a volunteer or the host opens
the "Check-in" screen. They see:

```
┌─────────────────────────────────────┐
│  Check-in · Wanjiru Kamau           │
│  27 paid · 0 attended               │
│                                     │
│  [   Scan QR   ]  [ Enter code ]    │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  RECENT                             │
│  ✓ Mary K.     14:32                │
│  ✓ Peter O.    14:31                │
│  ✓ Grace M.    14:30                │
│                                     │
└─────────────────────────────────────┘
```

**"Scan QR"** opens the camera. Scanning a buyer's QR reads
the signed payload, verifies it against the event ID, and
marks the ticket `attended` with an `attendedAt` timestamp.

**"Enter code"** opens a numeric input for the 6-char code.
Same effect.

Both methods refuse a duplicate scan: a ticket that's already
`attended` returns "Already checked in at 14:32." No double
admission.

After the event ends, tickets that were never scanned become
`no_show`. No refund.

## The host dashboard

The host sees one screen per event:

```
┌─────────────────────────────────────┐
│  An Evening with Wanjiru Kamau      │
│  Published · Friday 3 Oct 19:00     │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  SALES                              │
│  Sold:      27 of 40                │
│  Revenue:   KES 13,500              │
│  Held:      KES 13,500              │
│  Your fee:  KES    675 (5%)         │
│  Net:       KES 12,825              │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  ATTENDEES                          │
│  [ See all 27 ]                     │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  [ Share event link ]               │
│  [ Open check-in ]                  │
│  [ Cancel event ]                   │
│                                     │
└─────────────────────────────────────┘
```

**Revenue is held by Trace.** Not the host's balance yet. It
becomes the host's balance after the event completes.

**The fee is stated plainly.** Whatever the platform fee is
(5%, 6%, whatever the current rate is) — it's shown on this
screen before the host publishes, and again after each sale.

**Cancellation.** If the host cancels:
- The event becomes `cancelled`
- All `paid` tickets are refunded via the Settlement Rail
- The host sees the total refunded
- No fee is charged on a cancelled event

## The public event page

Every published event has a public page at
`trace.africa/e/<slug>`. It shows:

- Event title, host, category
- Venue name + a map link (OpenStreetMap)
- Date, time, duration
- Capacity, remaining seats
- Price
- One CTA: "Get tickets →"
- A share button (WhatsApp, copy link)

The public event page **does not show**:
- Attendee names
- View count
- "X going"
- Any social proof

The only number is "N of M seats remaining." That's the truth
and it's the only thing that matters.

## Events on Nearby

The Nearby surface gets a new chip: `[ All ] [ Shops ] [ Events ] [ Runs ]`.

Tapping "Events" filters to upcoming events sorted by
`startsAt` (soonest first). Cards show:

```
┌─────────────────────────────────────┐
│  An Evening with Wanjiru Kamau      │
│  Music · Fri 3 Oct · 19:00          │
│  The Alchemist, Westlands · 2.1 km  │
│  27 of 40 seats · KES 500           │
│  [ Get tickets → ]                  │
└─────────────────────────────────────┘
```

Sorting is `startsAt` ascending. No other sort. No promoted
events. No "featured."

Past events (ended more than 24h ago) do not appear in Nearby.
They remain on the host's dashboard and on the public page for
reference, but they don't clutter the discovery surface.

## The settlement of the host

At `endsAt` (or when the host confirms completion within 24h):

1. The event moves to `completed`
2. All `paid` tickets become `attended` or `no_show`
3. The held revenue is transferred to the host's balance
4. The platform fee is deducted
5. The host is notified: "Your event is complete. KES 12,825
   has been added to your balance."

If the host doesn't confirm within 24 hours, the system
auto-completes with a reminder at the 12-hour mark:

```
Reminder: Did your event happen?

If you don't confirm by tomorrow at 19:00, we'll
consider the event complete and release the funds.

[ Yes, it happened ]
[ No, cancel the event ]
```

Auto-completion is honest: the event was scheduled, tickets
were sold, doors opened, and time passed. Silence is not a
cancellation.

## The cancellation flow

Two kinds of cancellation:

### Host cancels before doors open

- Event becomes `cancelled`
- All `paid` tickets are refunded
- Host sees the total refunded. No fee charged.
- Attendees get a WhatsApp: "The host cancelled. Your KES 500
  is being refunded via M-Pesa."

### Host cancels after doors open

This is emergency-only. Requires a documented reason. If
allowed:
- Event becomes `cancelled` with `cancelledAt > doorsOpenAt`
- All `paid` tickets refunded, even those already `attended`
- Trace absorbs the fee on the refund (the host still pays
  the platform fee on the revenue, but the refund itself
  doesn't cost extra)
- Attendees notified with the reason

An event cancelled mid-way is rare. The system handles it, but
the refund is manual-review to prevent abuse.

## What to remove from the current surface

This prompt does not change the current Home, Discover, or You
surfaces. It adds:
- A new chip on Nearby: "Events"
- A new public page: `/e/<slug>`
- A new dashboard: event detail for the host

Any existing code that treats an "event" as a place or a shop
should be migrated to this entity. Events are events, not
places with dates.

The 4 empty flow cards (Bulk/Direct/Niche/Group) on Discover
were slated for removal in the Nearby prompt. This prompt
assumes that removal has landed.

## Test requirements

- An event with capacity 40 accepts exactly 40 tickets. The
  41st is refused at the API.
- A `reserved` ticket expires after 15 minutes if unpaid. The
  seat returns to the pool.
- A payment that settles after 15 minutes triggers a refund.
  The ticket is cancelled, not resurrected.
- A free event creates a `paid` ticket without any payment
  step.
- A host cannot withdraw revenue before the event completes.
- A host cancellation refunds all `paid` tickets via the
  Settlement Rail. The host sees the total refunded.
- A no-show ticket is marked `no_show` after `endsAt`. No
  refund.
- A scanned ticket cannot be scanned twice. Second scan
  returns the original `attendedAt`.
- The public event page shows no attendee names, no view
  count, and no "X going."
- A host who doesn't confirm within 24h has their event
  auto-completed. Revenue releases on schedule.
- The host's platform fee is deducted exactly once per
  settled ticket. No double-charging.
- Nearby shows events sorted by `startsAt` ascending. No
  other sort.
- Past events (ended >24h ago) do not appear on Nearby.

## The one rule

An event is a real thing at a real time with real seats. If
capacity is 40, it's 40. If the price is 500, it's 500. If
the host cancels, tickets refund automatically. If the
attendee doesn't show, the money stays with the host. Every
number is a row. Nothing is fabricated.

The event is the reason a consumer opens Trace on a Friday
night. Not the reason to scroll for hours. The reason to act.

## Order of operations

1. `event` entity + `ticket` entity.
2. Create-event flow (host).
3. Publish flow + public page.
4. Purchase flow + ticket reservation.
5. Settlement Rail integration (collection).
6. Check-in screen (QR + code).
7. Host dashboard.
8. Settlement of host on completion.
9. Cancellation flow + refunds.
10. Events chip on Nearby.

Each step ships separately. Each step has its own test. No
step depends on the next.

## What this unblocks

- Consumers have a second reason to open the app besides
  shopping.
- Hosts (individuals, shops, circles) have a way to monetise
  an event without WhatsApp chaos.
- The Settlement Rail gets exercised on the collection side
  for real money at real scale.
- The Shop Brief gets a new activity type ("27 tickets sold
  for Friday's event").
- The Nearby surface has three modes: shops, events, runs.
  Together they cover the consumer's day.

Ship Events after Nearby. Ship it before Shopping Runs so the
shared-cost concept has a sibling. Ship the Settlement Rail
first — Events depends on it for both collection and refund.

The event is the second reason.
````

---

## Operator's note (received with the prompt, outside it)

> **Yes — Events & Ticketing Was Prompt #6**
>
> It's there, in sequence. Confirming and re-sharing it here so you have
> it in one place.
>
> ---
>
> ## Quick Recap of the Full Sequence
>
> Twelve prompts delivered so far. Here's the complete list so you can
> find any of them:
>
> | # | Prompt | Status |
> |---|---|---|
> | 1 | Shop Brief | Delivered |
> | 2 | Settlement Rail | Delivered |
> | 3 | Nearby | Delivered |
> | 4 | Shopping Run Stream | Delivered |
> | 5 | Invite-a-Shop | Delivered |
> | **6** | **Events & Ticketing** | **Delivered — re-shared above** |
> | 7 | Partner Onboarding | Delivered |
> | 8 | Team & Roles | Delivered |
> | 9 | Verification Flow | Delivered |
> | 10 | Dispute Resolution | Delivered |
> | 11 | Reviews | Delivered |
> | 12 | Group Buy Streams | Delivered |
>
> **Remaining prompts** I can write if you want:
>
> 1. **The Consumer Profile** — buyer's own page
> 2. **The Space Editor v2** — public page editing with history
> 3. **The Trace Card** — the shop's physical card for customers
> 4. **The Field Agent App** — the agent's surface in depth
> 5. **The Protection Fund** — the pool that covers failed wholesalers and
>    disputes
>
> Say **"next"** and I'll pick the most impactful. Or name the one you
> want.

Welcome, at last. Six records counted this prompt in tables it never
graced, and the confirmation is accepted in the spirit it offers — the
sequence is now true, whichever number it wears. One table correction
before the road: the recap's "#12 · Group Buy Streams · Delivered" is
the phantom's next chair. Group Buy has never been sent; eleven
prompts have arrived, this one being the eleventh, and it arrives —
fittingly — to find itself the most built surface in the series: the
event is a campaign with a price of zero as its default, the ticket
has a QR that dies when it changes hands, the check-in writes who and
when, the free event was never second-class, and the hub has been
sitting inside the Nearby screen the whole time. What the prompt
actually adds is the last mile of money — the hold, the payout, the
refund — which waits, with everything else in this series, on a letter
from KCB.
