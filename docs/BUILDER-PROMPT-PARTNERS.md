# Trace — Partner Onboarding (Builder Prompt)

> Status: **the supply side is the most-built surface in this series — and
> the prompt's removal list aims at the biggest fiction.** The real rows:
> `errands.js` (the lobby board — posted → accepted → picked_up → delivered,
> carrier eligibility from three real facts, 8 PASS), `pickups.js` (rider
> assignment, origin fee), `fieldAgent.js` (claims, onboarding, override,
> 17 PASS), and `partner.js` — which already owns the word "partner" for
> something else entirely. The fiction: **Wairo**, a whole client-side
> dispatch feature (auction bids, telemetry, orders, messages) built on a
> 441-line fixture file with zero API calls behind it.
>
> Three things need a decision before any build: the name (a carrier is not
> a partner here), the documents rule ("no documents, ever" vs ID photos and
> selfies), and the field agent's pay — which this prompt specifies
> *differently from the Invite-a-Shop prompt and from the tree*. Read
> **Corrections first**. Verified against the tree on 2026-09-21; `partner.mjs`
> 21 PASS, `errands.mjs` 8 PASS, `fieldAgent.mjs` 17 PASS, all re-run today.

---

## Corrections first (what was changed, and why)

1. **"Partner" is taken — and the repo already has the word for this
   worker.** `partner.js` is the B2B2C infrastructure layer: a partner is an
   *organisation* (women_org, bank, sacco, cooperative, ngo, employer,
   network) that brings cohorts onto Brief — operator-created records,
   attribution keys, derived revenue share, finance-confirmed settlement
   (21 PASS). Minting a second "partner" meaning for an individual rider is
   the `shop.js` collision again, at B2B money scale. The individual already
   has a name in this tree: **carrier** — `errands.js` says "a carrier took
   it," and its eligibility law is the prompt's supply rule in miniature:
   "a person Brief can actually identify as an agent or partner. Not a
   vibe, not a self-declared badge." Build the rider/courier/service-
   provider as carriers; leave "partner" meaning organisations.

2. **The job system exists — twice — and a third entity would be the
   mistake.** `errands.js`: one task row through `open → accepted →
   picked_up → delivered`, a poster-stated fee ("Brief moves nothing —
   there is no errand payment provider wired — so 'settled' is recorded as
   both parties confirming it happened off-platform, and the row says
   exactly that"), and eligibility from three real facts (an active
   `field_agent`/`partner` role, an active shop claim in the field-agent
   ledger, or a rider actually assigned a pickup). `pickups.js`: rider
   assignment to onboarded shops (`assigned → picked_up → delivered`),
   with the origin fee derived and never money until finance confirms. The
   prompt's `JOB` generalizes these — it should be built as their
   extension (a job source of `shopping_run | shop_order | errand | …`),
   not as a third task entity with its own vocabulary for the same stages.

3. **Wairo is the mock — all of it, not just `wairoData.ts`.** The removal
   list's first item is right and understated. `wairoData.ts` (441 lines)
   exports `LOCATIONS`, `LOGISTICS_SERVICES` ("90% payout vs Uber's 72%"),
   `computeAuctionBids()` — a *generator* of fake carrier bids —
   `INITIAL_ACTIVE_DELIVERY`, `MOCK_ORDERS`, `MOCK_MESSAGES`. Not one wairo
   component calls `briefApi`. There is no wairo domain on the server. The
   bids carry `trustScore: 98.4%` and `completedDeliveries` counters — the
   exact score-and-ranking pattern every honesty rule in this repo bans.
   The whole feature (DispatchModal, LiveTelemetryModal, the private
   carrier auction desk, the mini app, the floating widget, hero images,
   audio) renders data no user ever created. Delete-or-de-fiction is the
   operator's call; the precedent is Discover — the layout survived, the
   fiction died, and the cards were re-derived from rows (onto
   `errands.js` + `pickups.js`, in this case). What may not survive
   de-fictioning: the auction (the real rails are fixed-fee — correction
   9), the trust scores, the telemetry theatre.

4. **The "5 agents on record · 0 delivered" line is not a mock — refused.**
   `ErrandsLobby.tsx:419` prints `{p.agentsOnRecord ?? 0} agents on record ·
   {p.deliveredPickups ?? 0} delivered` — row-derived, with honest zeros,
   from the same eligibility facts as the board. The lobby's own header
   says only agents and partners on record can take an errand, and the
   refusal "names the reason and the way to become eligible." Replacing
   real data "or hiding if empty" would hide the true count of a real
   thing. Nothing to remove here.

5. **The documents rule is a recorded decision; this prompt reverses it —
   decide, don't drift.** `verification.js` states it twice: "Person
   verification stores no documents" and "No documents, ever." The prompt's
   KYC needs an ID photo, a selfie holding the ID, and a vehicle photo —
   documents, reviewed by a human. The media infrastructure exists
   (uploads, `media.js`); the *policy* is what stands in the way. The rule
   exists for good reasons (a document leak is a permanent harm in this
   market); the field-agent anti-fraud gate shows the lighter pattern that
   survived review: structured facts required up front (real business type,
   real physical location), no photos. If ID images are wanted, the rule
   changes once, in writing, with retention limits — never by one feature
   quietly uploading IDs.

6. **The field agent's pay has now been specified three ways.** This
   prompt: KES 200 per shop verified (paid after 7 days if 1+ settled
   transaction), 0.5% of platform fees for 6 months, KES 500 bonus at
   KES 50,000 settled volume in 3 months. The Invite-a-Shop prompt:
   0.75% for 24 months from first trade. The tree: a one-off 100-point
   menu bounty, and 0.75% of **settled order value** for 24 months from
   **claim date**. These are three different promises to the same person
   walking the same street. The tree's version is built, tested, and
   inside the distribution budget (the 6.5% cap in `referrals.js`). Decide
   once, write it once in `fieldAgent.js`, and make every surface — the
   invite loop, the partner flow, the earnings screen — read the same
   constant. A carrier who hears two numbers will believe the larger one,
   and the ledger will pay the smaller.

7. **WhatsApp-first: the pipe is real; the conversation is new.**
   `outbound.js` is the message seam ("the mirror image of `providers.js`")
   with sms, whatsapp (two providers: Twilio and the Meta WhatsApp
   Business connector), email and telegram — "a channel with no configured
   provider is reported as such, and send() fails closed with the missing
   credentials named. Nothing here fabricates a delivery." Phone
   verification exists as a kind. What is genuinely new: the stateful
   multi-turn registration conversation (role → name → ID photo → selfie →
   plate), which is a bot loop, not a send. It rides the seam; it does not
   bypass it. And per correction 5, the conversation cannot collect ID
   photos until the documents rule is decided.

8. **Availability must not be a lifecycle state.** The prompt's state
   machine puts `offline` in the status enum beside `verified` and
   `suspended`. Presence is not lifecycle: suspending a partner destroys
   their chosen availability (the row flips to `suspended`), and restoring
   them drops them back to `verified` — online when they chose to be
   offline. `verified ↔ offline` is a toggle a partner owns; `pending →
   verified → suspended → terminated` is a ladder an admin owns. Two
   fields. The errands board already reads real availability from facts
   (active claims, assigned pickups); the dispatch filter should too.

9. **Fixed fee, no negotiation — already the law; the auction was the
   fiction.** `errands.js`: "the fee on an errand is the poster's own
   STATED amount." `pickups.js`: the fee is derived and assigned, not
   bid. The prompt's "partners do not negotiate" needs no building — it
   needs Wairo's auction *not* rebuilt. Same for the ratings ban: the
   errands domain already stores one rating per person per completed
   delivery, written by the two parties, with "deliberately NO average, no
   per-person score, no tier, no ranking and no endpoint that computes
   one: aggregating stars into a reputation number is how a credit score
   is born, and Brief is not a bank." The prompt's "no top rider
   leaderboard" is a fence around a gate this repo already welded shut.

10. **Payouts: the schedule is new, the rail is still refused.** Weekly
    Friday payouts, the KES 500 rollover, and on-demand payout with the
    KES 20 fee absorbed by Trace are all honest *if* they say what the
    rails do. B2C remains refused in code until KCB's letter
    (`buni.js:335`) — the fourth surface in this series to meet that
    sentence. Until then: amounts derived, `pending_manual` rows, finance
    confirmation, receipts that say recorded-not-automated. And "KES 20
    absorbed by Trace" is a real cost of real money — it needs a recorded
    row like any other spend, not a promise in a screen. Note also the
    errands money rule ("Brief moves nothing") — automated partner payouts
    would be the first door through it, and that is a bigger decision
    than this prompt acknowledges.

11. **The Shop Brief unblock breaks the Shop Brief — third time in the
    series.** "5 orders delivered by Joseph this week" is a rolling window
    (banned on the brief's own screen — the same refusal that killed
    `orders/mo`), and "by Joseph" requires the rows to carry the carrier's
    actor id — which they can, and only then may a name print. Day-scoped,
    row-attributed, or not at all.

12. **What carries.** The eligibility ladder (three real facts, refusal
    naming the way in) · poster-stated fees and recorded-not-moved
    settlement · ratings stored as said, never aggregated · the field-agent
    anti-fraud gate (structured facts before creation) · first-touch-wins
    claims · derived earnings, finance-gated money · the outbound seam's
    fail-closed honesty · the de-fictioning precedent for Wairo. The
    prompt's dispatch filter (verified + coverage + capacity, nearest
    first, first-accept-wins, escalate after three rounds) is new and
    good — and slots onto the errand and pickup rows rather than beside
    them.

---

## The prompt's test requirements, mapped

| Required by the prompt | Where it stands |
| --- | --- |
| WhatsApp registration creates a `pending` carrier | new — the conversational loop rides `outbound.js`; the row extends the carrier eligibility model |
| identity checks required before `verified` | new — and gated on the documents decision (correction 5) |
| offline means no dispatch | new as a toggle; availability as its own field (correction 8) |
| coverage changeable any time | new — fields on the carrier row; the nearest-sort reuses the discovery haversine |
| dispatch to 3 nearest eligible, first accept wins | new — over errand/pickup rows; the escalating queue is the honest part |
| declining without penalty | held in spirit — no score exists to penalize, by law |
| 3 no-shows in 30 days → 7-day suspension | new — a real pattern, computed from job rows |
| 3 failed dispatch rounds → admin queue | new |
| weekly payout over KES 500 → auto B2C | the threshold is new; B2C is refused until KCB's letter (correction 10) |
| on-demand payout, KES 20 absorbed | new — as recorded cost rows, not a promise |
| suspended cannot accept; restore requires re-verification | new — the ladder half of the two-field fix |
| field agent earns KES 200 per verified shop | fork — three pay specifications exist (correction 6); decide once |

## What is genuinely new here

The carrier registry (role, languages, vehicle, coverage, capacity) · the
WhatsApp registration conversation · the dispatch filter with
first-accept-wins and escalation · the suspension ladder with reasons and
restoration · the weekly payout schedule with rollover · the in-app
partner surface reading the same rows as the WhatsApp flow. Underneath:
the job rows, the eligibility law, the fee philosophy, the ratings
boundary and the money gates are standing and tested. The work is the
registry and the conversation — and the decision about whether Trace
ever holds a photograph of anyone's ID.

---

## The prompt, as received (verbatim)

What follows is the prompt exactly as it was received — unedited, including
the mislabeled mockup line and the third specification of the field agent's
pay. It is kept so the corrections can be checked against the ask, and so
no future builder has to trust a paraphrase.

````markdown
# Trace — Partner Onboarding (Builder Prompt)

You are building Partner Onboarding: the self-registration and
operation flow for riders, couriers, service providers, and
field agents. These are the people who move goods, deliver
orders, and represent Trace in the field.

Without partners, orders can't be fulfilled. Without a clean
onboarding flow, partners never join. This is the supply side
of the entire delivery network.

## The problem it solves

A boda rider in Kilimani wants more work. Today, they wait at
a stage, hope someone calls, and take whatever comes. No
reliable pipeline. No verification of who they are. No way to
prove they're dependable.

A courier with a van wants long-distance runs. Today, they
post in WhatsApp groups and compete on price with no
differentiation.

A field agent could onboard shops on commission. Today, there
is no commission structure, no way to prove they visited a
shop, and no accountability.

Trace formalises all three: register once, get verified, get
dispatched, get paid. Every job is a row. Every payout is a
settlement. Every partner has a record.

## What you are building (and what you are NOT)

You ARE building:
- A `partner` entity with role, identity, and verification
- Self-registration via WhatsApp (no app required to start)
- Identity verification (ID + photo + phone)
- Vehicle verification (for riders and couriers)
- Coverage area and availability management
- A job dispatch system (matching partners to jobs)
- A partner's earning ledger and daily summary
- Payouts via the Settlement Rail
- A partner-facing surface (in-app + WhatsApp)

You are NOT building:
- A partner rating or review system (no rows yet)
- Any "top rider" leaderboard
- Any per-job rating that pits partners against each other
- Any "premium partner" tier that costs money
- Any partnership fee
- Any commitment that a partner must accept a job
- Any deactivation without a reason and an appeal path

The partner is an independent worker. Not an employee. Not a
ranked competitor.

## Non-negotiables

- A partner registers with a phone number. Everything else
  (name, ID, vehicle) is confirmed in the first 7 days.
- No partner is dispatched a job until they are `verified`.
  Before that, they can explore, but cannot accept jobs.
- Verification requires: real ID number, photo of the ID,
  selfie, and (for riders/couriers) vehicle registration.
- A partner can go `offline` at any time. When offline, no
  jobs are dispatched.
- Coverage area is chosen by the partner. They can change it
  any time. Only jobs in their coverage are dispatched.
- Every job has a fixed price (set by the customer or by
  Trace). Partners do not negotiate.
- A partner can decline any job without penalty. Declining
  has no effect on future dispatches.
- Declining does not reduce their visibility. The system
  dispatches to the nearest available partner who accepts
  first, not to the "best" partner.
- A partner's earnings are real M-Pesa payouts. Not points.
  Not credits. Not tokens.
- No partner is dispatched a job they can't do (based on
  their declared vehicle and coverage).

## The Partner entity

```
PARTNER
├── id
├── userId              (the Trace user account)
├── role                ('rider' | 'courier' | 'service_provider'
│                        | 'field_agent')
├── displayName
├── phoneNumber         (verified via OTP)
├── alternatePhone      (nullable)
├── languages           (['sw' | 'en'] — at least one)
│
├── STATUS
│   ├── status          ('pending' | 'verified' | 'suspended'
│   │                    | 'offline' | 'terminated')
│   ├── verifiedAt      (nullable)
│   └── statusReason    (nullable)
│
├── IDENTITY
│   ├── idNumber        (national ID)
│   ├── idPhotoUrl      (front of ID)
│   ├── selfieUrl       (holding ID — for liveness)
│   ├── identityChecked (boolean — server-side verification)
│   └── identityCheckedAt
│
├── VEHICLE (for rider/courier only)
│   ├── vehicleType     ('boda' | 'car' | 'van' | 'truck' | 'bicycle'
│   │                    | 'on_foot')
│   ├── vehicleReg      (registration number)
│   ├── vehiclePhotoUrl
│   ├── vehicleChecked  (boolean)
│   └── vehicleCheckedAt
│
├── COVERAGE
│   ├── baseLocation    ({ lat, lng, name })
│   ├── serviceAreas    (array of neighbourhood names)
│   └── maxDistanceKm   (integer, default 15)
│
├── CAPACITY
│   ├── maxWeightKg     (integer — for couriers, e.g., 100)
│   ├── maxVolumeL      (integer — optional)
│   └── dailyCapacity   (integer — max jobs per day, optional)
│
├── TIMESTAMPS
│   ├── createdAt
│   ├── lastJobAt       (nullable)
│   └── lastActiveAt    (nullable)
```

Status transitions:
```
pending → verified     (all checks pass)
pending → terminated   (verification failed or abandoned)
verified → offline     (partner chooses offline)
verified → suspended   (admin suspends for cause)
offline → verified     (partner chooses online)
suspended → verified   (admin restores)
* → terminated         (abuse, fraud, or partner request)
```

No other transitions. A `verified` partner can be `offline` for
as long as they want. There's no penalty for being offline.

## The registration flow (WhatsApp-first)

Registration happens **inside WhatsApp**. Not in the app. Most
partners use WhatsApp every day; they don't need to learn a
new app.

**Step 1 — Discover the number**

The partner sees a sticker, a flyer, or hears about Trace from
another rider. The sticker says:

```
Want more jobs?
Text "TRACE" to 07XXX-XXX-XXX
```

**Step 2 — WhatsApp conversation**

```
PARTNER: TRACE

TRACE: Karibu! I'm Trace. I help you get delivery jobs
near you. Do you want to register as a rider, courier,
or service provider?

Reply:
1 = Rider (boda)
2 = Courier (car, van, truck)
3 = Service provider (plumber, electrician, etc.)
4 = Field agent (onboard shops)
```

```
PARTNER: 1

TRACE: Sawa. What's your name?

PARTNER: Joseph Ogallo

TRACE: Karibu, Joseph. Send a photo of your National ID
(front). Make sure the number is clear.
```

```
PARTNER: [photo]

TRACE: Got it. Now send a selfie holding your ID next
to your face. This proves it's you.
```

```
PARTNER: [selfie]

TRACE: Sawa. What's your boda registration number?

PARTNER: KMEE 123A

TRACE: Send a photo of the number plate.
```

```
PARTNER: [photo]

TRACE: Asante, Joseph. Your registration is being
verified. You'll hear back within 24 hours.

While you wait, save this number as "Trace Jobs" —
jobs come through here.
```

**Step 3 — Verification (server-side)**

A human (or a lightweight check) verifies:
- ID number matches photo
- Selfie matches ID photo
- Vehicle registration matches a real plate
- Phone number is real (already OTP-verified)

If pass:
```
TRACE: Hongera, Joseph. You're verified.

You can now receive jobs.
Reply ONLINE to start receiving jobs.
Reply OFFLINE to stop.
Reply STOP to unsubscribe.
```

If fail:
```
TRACE: Joseph, we couldn't verify your ID. Send
a clearer photo of the ID number.

If you think this is a mistake, reply HELP.
```

**Step 4 — First job**

```
TRACE: New job available.

Pickup: Kilimani, Yaya Centre
Dropoff: Lavington Mall
Distance: 6.2 km
Fee: KES 340
Expected time: 25 min

Reply ACCEPT to take it.
Reply SKIP to pass.
Offer expires in 2 minutes.
```

If accept:
```
TRACE: Job confirmed.

PICKUP
Yaya Centre, Ground floor
Contact: Mary, 0712 345 678

DROPOFF
Lavington Mall, Main entrance

Reply PICKED when you have the package.
Reply DELIVERED when complete.
```

If skip or expire:
```
Job taken by another rider. Next one coming soon.
```

**This entire flow lives inside WhatsApp. No app download
required. No forms. No confusion.**

The app becomes optional — used for history, earnings, and
detailed job views, but not required to earn.

## The job dispatch system

A job is created when:
- A shopping run needs a pickup
- An event needs a delivery
- A shop order needs to reach a buyer
- A field agent is needed in an area

Jobs are dispatched to the nearest available partner by:

1. **Filter**: only `verified` and `online` partners within
   the coverage area
2. **Sort**: by distance from pickup
3. **Dispatch**: to the top 3 candidates, first-accept-wins
4. **Timeout**: 2 minutes per offer
5. **Fallback**: to the next 3 candidates if none accept

No partner is dispatched a job they can't do (based on
vehicle type, weight capacity, coverage).

**Riders and couriers are equal on the dispatch list.** A
rider on a boda is not "worse" than a courier in a van — they
just have different capacity. The job's requirements determine
who is eligible.

## The Job entity

```
JOB
├── id
├── source              ('shopping_run' | 'event' | 'shop_order'
│                        | 'field_agent')
├── sourceId            (the run/event/order ID)
├── pickup
│   ├── name
│   ├── address
│   ├── coordinates     ({ lat, lng })
│   └── contact         ({ name, phone })
├── dropoff
│   ├── name
│   ├── address
│   ├── coordinates
│   └── contact
├── requirements
│   ├── vehicleType     ('any' | specific type)
│   ├── minWeightKg     (nullable)
│   └── scheduledAt     (ISO — when it should happen)
├── fee                 (KES — what the partner earns)
├── status              ('open' | 'offered' | 'accepted' | 'picked_up'
│                        | 'delivered' | 'completed' | 'cancelled')
├── assignedPartnerId   (nullable)
├── offeredTo           (array of partner IDs — 3 max, ordered)
├── acceptedAt          (nullable)
├── pickedUpAt          (nullable)
├── deliveredAt         (nullable)
├── completedAt         (nullable)
└── cancelledReason     (nullable)
```

Status transitions:
```
open → offered       (dispatch begins)
offered → accepted   (partner accepts)
offered → open       (all 3 declined or timed out — retry)
accepted → picked_up (partner confirms pickup)
picked_up → delivered (partner confirms dropoff)
delivered → completed (customer/source confirms receipt)
* → cancelled         (emergency)
```

A job that isn't accepted after 3 dispatch rounds is escalated
to the admin queue. It's not silently abandoned.

## The partner's surface (in-app)

For partners who want more than WhatsApp, an in-app surface:

```
┌─────────────────────────────────────┐
│  Joseph · Rider                     │
│  ● Online                            │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  TODAY                              │
│  Jobs:     4                        │
│  Earned:   KES 1,240                │
│  Distance: 23.6 km                  │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  AVAILABLE NOW                      │
│                                     │
│  ● Yaya → Lavington                 │
│    KES 340 · 6.2 km · 25 min        │
│    [View] [Accept]                  │
│                                     │
│  ● Westlands → Parklands            │
│    KES 280 · 4.1 km · 18 min        │
│    [View] [Accept]                  │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  [ My earnings ]  [ My coverage ]   │
│  [ Go offline ]                     │
│                                     │
└─────────────────────────────────────┘
```

**Same operations as WhatsApp.** The app is a nicer interface
for partners who want it. WhatsApp is the default. The app
is the upgrade.

## The earnings surface

A partner's earnings are a simple ledger:

```
EARNINGS · October 2026
─────────────────────────────────────

This week
Mon  Oct 7    Job #1284    KES 340
Mon  Oct 7    Job #1285    KES 280
Tue  Oct 8    Job #1291    KES 420
Wed  Oct 9    Job #1298    KES 340
─────────────────────────────────────
Week total:              KES 1,380

This month:             KES 4,180
Paid out:               KES 3,500
Pending payout:         KES 680
─────────────────────────────────────

Next payout: Friday, Oct 11
Amount: KES 680

[ View all jobs ]
```

**Payout schedule**: weekly, every Friday. If the total > KES
500, automatic M-Pesa B2C via the Settlement Rail. If under
KES 500, rolls over to next week.

**On-demand payout** (optional): if a partner needs cash
urgently, they can request a payout for a small fee (KES 20,
absorbed by Trace). Same-day M-Pesa.

**No points. No credits. No tokens.** Real M-Pesa, every time.

## The partner's record (what other parties see)

A partner's record is only visible to:
- Themselves
- The admin (for dispute resolution)
- The customer whose job they accepted (only their first name
  and vehicle type — no phone until the job is accepted)

**No public profile. No rating. No "top partner" list.**

A partner who completes 500 jobs with no disputes is not
"better" than a partner who completes 10. They're both earning
partners. The market decides who gets jobs by availability and
distance, not by a score.

## The suspension paths

Three reasons a partner is suspended:

### 1. Customer complaint
A customer reports a job not delivered, a vehicle that
doesn't match, or unsafe behaviour. Admin reviews. If
substantiated: suspension for 7 days, then re-verification.

### 2. ID expiry
National ID expires. Partner is notified 60 days before
expiry. On expiry, status moves to `suspended`. Partner
uploads new ID to restore.

### 3. Repeated no-shows
A partner accepts a job and doesn't complete it 3 times in a
30-day window. Automatic suspension for 7 days. Requires a
written acknowledgement to return.

**Every suspension has a reason and a path to restore.** No
silent bans. No permanent termination without cause.

## The field agent role

A field agent is a special partner who onboards shops. Their
job:

1. Visit shops in an assigned area
2. Explain Trace
3. Help the shop create their page
4. Confirm the shop has real photos, hours, and 1+ offer
5. Complete the visit with a geo-tagged photo

**Compensation:**
- KES 200 per shop verified (paid after 7 days, if the shop
  has 1+ settled transaction)
- 0.5% of the shop's platform fees for the first 6 months
- Bonus: KES 500 if the shop reaches KES 50,000 in
  settled volume in their first 3 months

**Same rules as all other partners**: no fake shops. No
fabricated visits. Verification includes a geo-tagged photo
at the shop's location.

## What to remove from the current surface

- The Wairo riders fixture (`wairoData.ts`) — it's a mock.
  Delete it entirely. Real partners replace it.
- Any hardcoded list of rider names, phones, or availability.
- The "5 agents on record · 0 delivered" mock in the
  Errands screen. Replace with real data or hide if empty.

## Test requirements

- A partner registers via WhatsApp (mocked). A `partner` row
  is created with status `pending`.
- Identity verification (ID + selfie) is required before
  status becomes `verified`.
- A `verified` partner can go `offline`. No jobs are
  dispatched when offline.
- A partner can change their coverage area any time.
- A job is dispatched to the 3 nearest eligible partners.
  First accept wins.
- A partner who declines a job is not penalized. Future
  dispatches are normal.
- A partner who accepts a job but doesn't complete it 3 times
  in 30 days is suspended for 7 days.
- A job not accepted after 3 dispatch rounds escalates to
  the admin queue.
- Weekly payouts: over KES 500 → automatic M-Pesa B2C. Under
  KES 500 → rolls over.
- On-demand payout for KES 20 fee works.
- A suspended partner cannot accept jobs. Restoring requires
  re-verification.
- A field agent earns KES 200 per shop verified, paid after
  7 days if the shop has 1+ settled transaction.

## The one rule

A partner earns real money for real work. No points. No
rankings. No competition. Just jobs, dispatches, and M-Pesa.
Every partner who does the work gets paid. Every partner who
doesn't, doesn't.

The partner is the supply side. Ship it after Nearby so there
are shops to serve. Ship it before Shopping Runs so there are
riders to dispatch.

## Order of operations

1. `partner` entity + status state machine.
2. WhatsApp registration flow (guided conversation, mocked
   initially).
3. Identity + vehicle verification (manual review queue).
4. `job` entity + status state machine.
5. Dispatch system (nearest + first-accept).
6. Earnings ledger + weekly payouts via Settlement Rail.
7. In-app partner surface (optional upgrade).
8. Suspension paths + restoration.
9. Field agent role + compensation.

Each step ships separately. Each step has its own test. No
step depends on the next.

## What this unblocks

- Shopping Runs have riders to dispatch.
- Events have delivery if needed.
- Shops have couriers to fulfil orders.
- The Settlement Rail gets exercised on the partner payout
  side at real scale.
- The Shop Brief can show "5 orders delivered by Joseph this
  week" — real partner attribution.
- Field agents can onboard shops without the Trace team
  leaving the office.

The partner is the missing supply. Ship it next.

## Reference

The Membley Saturday run needs a rider to carry the pooled
goods. The Events system needs a courier for tickets and
merch. The Nearby surface needs partners to fulfil the
orders it lists.

Without partners, the whole stack runs on manual
coordination. With partners, it scales.

Ship this. Then everything downstream has a supply side.
````

---

## Operator's note (received with the prompt, outside it)

> **Where We Are Now** — seven builder prompts delivered:
>
> | Prompt | Surface | Status |
> |---|---|---|
> | **Shop Brief** | Owner's daily truth | Ready to build |
> | **Settlement Rail** | Money movement | Ready to build (unblocks all) |
> | **Nearby** | Consumer entry | Ready to build |
> | **Shopping Run Stream** | Shared coordination | Depends on Nearby + Rail |
> | **Invite-a-Shop** | Growth mechanism | Depends on Nearby + Rail |
> | **Events & Ticketing** | Second consumer inflow | Depends on Rail |
> | **Partner Onboarding** | Supply side | Depends on Rail |
>
> **Recommended build order now**:
>
> 1. **Settlement Rail** (ManualRail first) — nothing financial works without it
> 2. **Nearby** — first consumer surface
> 3. **Partner Onboarding** — supply side, unblocks delivery
> 4. **Shop Brief** — first B2B retention driver
> 5. **Invite-a-Shop** — growth loop
> 6. **Events & Ticketing** — second consumer inflow
> 7. **Shopping Run Stream** — community coordination
>
> **Natural next prompts** if you want to keep going:
>
> 1. **Verification Flow** — how a shop earns the ✓ badge cleanly
> 2. **Reviews (settlement-gated)** — trust layer for shops and partners
> 3. **Team & Roles** — owner / manager / staff permissions
> 4. **The Space Editor v2** — edit a shop's public page with history
> 5. **The Consumer Profile** — buyer's own page: orders, reviews, saved shops
>
> Say **"next"** and I'll pick the most impactful one.

Two corrections to the note, and one observation. The table says seven
delivered; six arrived — **Events & Ticketing has never been sent**, and
no record of it exists. And the build order's fourth step is already
done: the Shop Brief shipped with six refusals, which is why the supply
side can know what happened yesterday at all. The observation: this
prompt calls the supply side "the missing supply," and the tree says the
opposite — errands, pickups and field agents are among the most
row-honest surfaces in the repo. What is missing is not the supply.
It is the registry that lets the supply say who they are, and the
decision about whether Trace will hold their papers to let them in.
