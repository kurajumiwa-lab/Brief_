# Partners, connectors, paid tasks — what ships, what is designed, what is refused

Written 2026-09-19, next to `PUBLIC-FACE.md` (the mirror) and the guardian/attribution
work in `server/src/domain/guardians.js`. This document exists so the three
remaining asks do not get built on assumptions later.

---

## 1. Partner accounts (riders, couriers, service providers)

### What already exists, so nobody builds it twice

| Need | Already in the codebase | Notes |
|---|---|---|
| "may this person carry a parcel?" | `errands.js` → `carrierBasis(userId)`, `canCarry(userId)` | A real basis: a field-agent or partner role, an active shop claim, or a pickup already assigned to them. A self-declared profile is **not** a basis and must not become one. |
| Roles and scoping | `roles.js` → `ROLES`, `ROLE_SCOPE_KIND`, `assignRole`, `hasRole` | Capability checks, not badges. |
| The open job board | `errands.js` → `carryBoard()`, `listErrands`, `acceptErrand`, `markPicked`, `markDelivered`, `confirmSettled` | First-to-accept already wins. A "partner home" is a **view over these rows**, not a new object. |
| Parcels a business assigns to a named rider | `space.js` dispatches (`spaceDispatches`), `pickups.js` | Stage timestamps are recorded by people, which is what makes "where is it" answerable today. |
| Payout rails | `workPayment.js` (intents, provider status), `ledger.js`, `connectors/mpesa.js` B2C, `fees.js` service-fee confirmation | Money moves through a ledger row plus a human confirmation. Nothing in Brief accrues a balance silently. |
| Referral / share economics | `referrals.js` (`DISTRIBUTION_CAP` 6.5%, pool = a fraction of confirmed service-fee revenue), `fieldAgent.js` (0.75% override, 24 months), `partner.js` (revenue-share agreements), `guardians.js` (1 point per KES 100 settled, shop-confirmed) | One pool, one cap, one finance confirmation. A partner share must be *added to this budget*, not placed beside it. |

### What is genuinely missing

A **partner profile**: the vehicle they run, the zones they actually cover, the hours
they work, the services they take. Today a rider exists only as a role assignment or a
person attached to a pickup, so there is nothing to browse, and a business cannot say
"these five people carry for us".

Design (no new money concept in it):

```
partners: one row per person
  userId · displayName · vehicle (boda | bike | car | van | truck | none)
  zones[] (keys from the locations graph — never free-text coordinates)
  services[] (delivery | errands | transport | long_distance)
  availability: [{ day, from, to }]            ← same shape the Space schema uses
  availableNow: { setAt }                      ← a stated self-mark, timestamped
  sponsoredBySpaceId | null                    ← a business vouching, as a ROW
```

* `sponsoredBySpaceId` is the trust chain the brief asked for, and it is only ever that:
  a row saying *this shop lists this person as carrying for them*. It is not a
  verification, not a badge, and not a rank. `GET /api/spaces/:id/partners` returns it to
  the space's members; the public page shows names and nothing else — see `PUBLIC-FACE.md`
  §"no tick".
* `availableNow` is rendered on the board as **"says available now · 14:02"**. It is not
  called *online*, because there is no dispatcher consuming it and no heartbeat expiring
  it. The moment a scheduler reads it, the word may change to "online" and the row gains a
  `heartbeatAt` that expires — the label follows the mechanism, never the other way round.
* A partner profile **cannot** grant the right to carry. `canCarry` stays as it is.
  Otherwise "register as a rider" becomes "decide you may take other people's goods",
  which is precisely how a marketplace gets its first theft.

### What the brief's rider mock gets wrong, and what replaces it

| Mock line | Problem | Ship instead |
|---|---|---|
| `KES 340 · 12 min away` | Brief has no live location stream, so minutes-to-you is a guess about a boda on a road. | The stated zone ("covers Westlands · Kileleshwa") and the posted fee, which is the poster's own number. |
| `Today: KES 1,240` | No payout rail sums a "today". A rider's day is not a row. | "Settled through Brief this week: KES N" — the sum of *confirmed* payout rows, `—` when there are none, never an estimate. |
| Push / WhatsApp / SMS to the top 3 riders | `sms` and `whatsapp` are `not_configured` in this deployment (see `spaceAudience.postBroadcast`, which already reports that honestly). A job loop built on an unconfigured channel is a queue nobody reads. | In-app notification rows (which exist) + a stated `channels` block per send. The routing rule is a **zone filter and a first-accept race**, which is real; "top 3" implies a ranking Brief does not hold. |
| "Live ETA" on the caravan template | Nothing streams. | Recorded stage timestamps with who set them and when. |
| "WAIRO riders are hardcoded" | Only in the harness screens (`wairoData.ts` and friends), which no production surface mounts. The live read, `errands.providers()`, already derives its roster from rows: active vendor claims, delivered pickups, and the carrier names that actually appear on dispatches. So there is no fake rider list to replace — the missing thing is a *profile per person*. | Build `partners` for the profile; delete the fixture rosters when the board view lands; leave `providers()` derived. |

---

## 2. East African logistics endpoints — the honest status table

| Provider | Status here | Reason |
|---|---|---|
| Open-Meteo (weather) | **live** | Key-free, `server/src/domain/worldSignal.js`, cached, facts composed only from response numbers, outage → an error and no number. |
| OpenStreetMap Nominatim (geocode) | **not built — the one free, legal piece worth doing** | No key needed, but the usage policy (≈1 req/s, declared UA, no bulk) must be respected, so it goes behind a queue with a cache. Its product use is *matching a stated place to a zone*, not drawing a pin. |
| Google Maps Directions (distance, ETA) | **refused as specced** | Needs a billing account and a key this deployment does not hold. More importantly: a Directions ETA describes a car on a mapped route, not a parcel on a matatu, and the brief wants it printed as "viability". Until a route model that fits the mode exists, the figure is `not_computed`, and a timestamped model estimate is a stretch — not a fact. |
| Sendy, Bolt Business, Uber Direct | **not_configured** | Each needs a registered business app, credentials and a commercial agreement. No "connected" string may appear anywhere until `credentialState()` says otherwise, the same rule `workPayment.providerStatus()` follows. |
| Lori Systems, Kobo360, Bwala | **not available** | Partnership-gated. They are named in the product as cargo options — name only, no phone, no price, no promise — exactly as `errands.js` already treats other carriers. |

Rule for every row: a connector's availability is a **read**, derived from
`credentialState()` / env presence, and each surface that could use it states which one
is live and which is `not_configured`, with the reason. No endpoint is described as
integrated because a URL exists in a document.

---

## 3. Public tasks paid in cash (and the survey funnel)

The idea: fill in information — photograph a shop, confirm its hours, log a market
price — and be paid. The brief's own numbers (KES 100 / 50 / 30 / 20 / 15) are the
problem, not the idea: a price printed before there is a source of money is a promise the
product cannot keep, and a task feed that pays for data will be fed fabricated data.

Four conditions, or it does not ship:

1. **A bounty has a payer.** Either a member/space funds it from a real ledger row, or it
   is an entry in the referral pool (currently a fraction of confirmed service-fee
   revenue). An unfunded task is not a job; it is an IOU with a UI.
2. **Verification costs somebody something.** Mirror the circle rule already built in
   `block.js`: `complete ≠ verified`. A submission needs evidence (an upload row, which
   exists) and a *second* party — the merchant, or another member in that zone — before
   it pays. Self-certified data is how "8 left today" becomes a rumour.
3. **One rate, stated where it is earned.** The brief allows points if the conversion is
   printed at the point of earning; the app's rate is 0.10 KES per point, *not* 1:1, and
   the pool balance is shown next to it (the guardian panel already does exactly this and
   fails a test if the pool figure disappears). Never "1,000 points" alone.
4. **No leaderboard, no tier, no streak.** Earning volume becomes a rank the moment it is
   displayed as one. `guardians.js` shows a person's own counts only; a task feed does the
   same. `participantTrust.js` and `sourceTrust.js` exist for *sourcing* judgements and are
   not a scoring surface for members.

The **survey → vendor funnel** is the one piece that is safe to build first, because it is
the guardian gate with different words: a survey may end with "know a shop that does this?
Introduce them". It records a `pending_owner` claim and nothing else. It cannot credit the
surveyor, cannot notify the shop more than the cap allows, and stops at a dispute. That is
`POST /api/guardians/claim`, already built and already capped.

---

## 4. Order of operations (mine, given what exists)

1. **Shipped today:** the room goes cool with a real type floor; the public page mirror;
   guardians (shop-confirmed attribution, points on the pool, complaint pause/freeze).
2. `partners` row + `GET/POST /api/partners*` + the space's partner list; the partner home
   as a **view** over `carryBoard()` and dispatch stages. No distance, no ETA, no
   "today's earnings" estimate.
3. Nominatim behind a queue + cache, so zone matching becomes real and "which board should
   this job appear on" stops being free-text.
4. Funded tasks with two-party verification, on the referral pool — then, and only then,
   prices per task type.
5. Paid tiers for the public page (custom handle, no branding) — needs a billing rail;
   `fees.js` sells named services with a human confirming, which is not a subscription.

The one rule from the brief is the right one, with a clause added: every feature must
connect someone to work, to a business, or to a payment — **and every number it prints must
come from a row that one of those three produced.**
