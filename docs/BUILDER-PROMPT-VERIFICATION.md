# Trace — The Verification Flow (Builder Prompt)

> Status: **the record asked for this prompt by name — and the repo already
> runs two verification systems this third one must not fork from.** The
> Nearby corrections refused the ✓ for lack of rows and said: "if
> verification for businesses is wanted, it is a separate flow with its own
> rows, built first." This is that flow. But `verification.js` (person
> checks, "no documents, ever") and `supplyVerification.js` (supply
> enterprises: six states, seven evidence kinds, **private evidence
> images**, moderate-capability reviewers, a queue) already exist — a third
> system built beside them instead of on their pattern would be the
> vocabulary collision of the series, at trust scale.
>
> Also verified: disputes have real rows but **no resolution door**
> (`openDispute` exists; nothing closes one), which suspends half the
> revocation machinery until Dispute Resolution is built. And the visit
> flow captures coordinates — the one build in this series that would
> actually close Nearby's distance gap. Read **Corrections first**.
> Verified against the tree on 2026-09-21.

---

## Corrections first (what was changed, and why)

1. **Two verification systems exist; the shop flow extends their pattern.**
   `verification.js`: person checks (`email`, `phone`, `identity`), "status +
   provider reference + review provenance, nothing else," feeding compliance
   gates. `supplyVerification.js`: `STATES = [unverified, submitted,
   under_review, verified, rejected, expired]`, `KINDS` (identity,
   business_type, capability, capacity, authorization…), `EVIDENCE_TYPES`
   (business_registration, physical_location, operating_evidence…), 1–8
   **private evidence images** per submission, `moderate`-capability
   reviewers, a queue, and a `review()` door. Neither covers the public
   shop/vendor surface — that is the genuine gap, exactly as the Nearby
   record said. The build is a vendor-scoped member of this family (same
   state spine, same reviewer authority, same private-evidence mechanism) —
   and it cannot be named `verification`: the word and the
   `verificationRecords` collection are taken. Name it for what it verifies.

2. **The documents collision, narrowed but real.** The person-scope rule is
   "No documents, ever." Yet supply verification already accepts **private
   evidence images** for commercial checks — so photo evidence per se has a
   tested precedent. What has none is the **photo of the owner holding
   their ID**: that is identity evidence, the exact thing person
   verification refuses to store, and a permanent-harm class of leak in
   this market. The middle path the tree already demonstrates is the
   field-agent anti-fraud gate: the visit records **structured facts**
   ("owner name confirmed: Joseph Ogallo") without retaining the ID image.
   If the ID photo is wanted, the rule changes once, in writing, with
   retention limits — the same decision Partner Onboarding must make, made
   once for both.

3. **The visit fee is the fourth field-agent pay number in the series.**
   This prompt: KES 150 per verification visit. Partner Onboarding: KES 200
   per shop + 0.5%/6 months + a bonus. Invite-a-Shop: 0.75%/24 months from
   first trade. The tree: 100 points for a menu upload + 0.75% of settled
   order value for 24 months from claim date. Five numbers, one street.
   Whatever the final schedule is, it lives in `fieldAgent.js` as exported
   constants, every surface reads the same values, and every visit fee is a
   derived obligation settled through the finance gate — never a balance.

4. **Disputes: the trigger has rows; the restore has nothing to wait for.**
   `openDispute` is real — buyer-only standing, idempotent, moves the order
   to `disputed`, inserts into `disputes` with status `open`. So "dispute
   filed → verification suspended" can be built today. But **nothing
   resolves a dispute**: there is no resolve/confirm door anywhere in
   `order.js`, so "resolved in the shop's favour → restore" and "confirmed
   against the shop → revoke" hang on a flow that does not exist. This
   prompt's dispute machinery is gated on Dispute Resolution being built —
   which the operator's own next-prompt list already names.

5. **The coordinates gap — and the one build that closes it.** Vendors and
   spaces carry text locations, not coordinates (the reason Nearby's
   distance engine prints `—` on nearly every shop). The prompt's GPS
   refusal ("more than 100m from the shop's stated location") cannot run
   against a location that is a sentence. But the visit **captures**
   coordinates — meaning verification visits are the first honest producer
   of shop pins in the repo. The 100m check needs the coordinates the first
   visit creates; until then it checks against a stated location only when
   the shop actually has one, and says `—` when it doesn't. Write the
   captured pin to the vendor (with the shop's consent on the visit screen)
   and Nearby's distance gap starts closing shop by shop.

6. **"Category" is the recorded re-key, fourth time.** There is no
   `shop.category`; there is the vendor's `businessType` (validated against
   `BUSINESS_TYPES`) and the space's `mode`. The category-change suspension
   trigger keys to whichever of those the verification was granted against
   — recorded at verify time (`categoryAtVerify` becomes
   `businessTypeAtVerify`), compared on change, exactly as the prompt's
   mechanism intends.

7. **The owner-change trigger has nothing to hook yet.** Ownership transfer
   does not exist (the Team & Roles record: it must be a guarded synchronous
   write, and the 1:1 person↔vendor model must be decided first). The
   suspension trigger is correct and cheap — hang it on the same guarded
   write that swaps `vendor.ownerId`, when that write exists.

8. **The Shop Brief unblock breaks the brief's own law.** "You've been
   verified for 8 months. Renewal in 4 months" is a forward-looking
   countdown, and the brief refuses future days outright ("asked for a day
   that has not arrived, it refuses instead of projecting"). The renewal
   reminders belong where the prompt already puts the 60/30/0-day
   notifications: the WhatsApp/outbound stream. The brief, if it says
   anything at all, states the fact — "Verified 21 Sept 2026" — and never
   coaches.

9. **The Invite-a-Shop unblock is refused.** "Shops you bring in get
   priority for field agent visits" is queue-jumping by referral — the same
   shape as promoted placement, which this series has refused on every
   surface (Nearby: no promoted-first; dispatch: nearest-first, not
   best-first; the ✓ itself: "information, not ranking"). The queue is
   real; the queue is fair; referral rewards come from the fee share, not
   from cutting the line.

10. **Two schema nits, the series' usual class.** "A shop has exactly one
    active verification row" is ambiguous under this prompt's own rules —
    renewal creates a new row while the old one lingers, and a suspended
    row is neither active nor dead. Define *current*: the latest row by
    `confirmedAt` whose status is `confirmed` or `suspended`; `expired` and
    `revoked` are terminal history. And the `history` array on the row
    duplicates the append-only pattern the repo keeps as *rows*
    (`teamHistory`, the stock log) — a status-change row per transition,
    not a JSON array that one write can rewrite.

11. **The display rules are already house law — stated back as
    confirmation.** Silence for the unverified shop is exactly the public
    page's hours rule ("no hours stated," never "open") and
    `PublicFacePanel`'s own comment: no badge or verified mark, "Brief
    stores no reviews, so a tick" — the sentence this prompt exists to let
    the code finish. `verifiedAt` must be read from the verification row
    on every surface — never mirrored onto the vendor row, where it would
    drift (the stored-tally refusal, again). And the ✓-does-not-affect-sort
    rule is Nearby's law verbatim. The prompt's "the ✓ is either always-on
    or always-off, nobody knows why" is wrong in the best way: it is
    always-off, on purpose, with the reason in a comment, waiting for
    rows.

12. **Removals: phantom, and the phantom is the point.** No hardcoded ✓
    exists in any client surface; no "Verified by Trace" text exists; no
    "premium/trusted" tier exists; no "verification in progress" state
    exists. The ✓ is absent everywhere because every record in this series
    refused to draw it without rows. There is nothing to delete — there is
    something to finally build.

---

## The prompt's test requirements, mapped

| Required by the prompt | Where it stands |
| --- | --- |
| unrequested shop shows no ✓ | held — the badge does not exist anywhere; the read returns nothing |
| requesting creates `pending_visit` | new — on the supply-verification state spine (correction 1) |
| visit requires coordinates ≤100m, two photos, a note | new — coordinates gap applies (correction 5); the ID photo is the documents decision (correction 2) |
| agent cannot verify their own shop | held as the pattern — `self_claim` refusal in `fieldAgent.claimVendor`; same check on the visit door |
| confirm sets `verifiedAt` + 12-month `expiresAt` | new — on the verification row only, never mirrored (correction 11) |
| 250m move / category change suspends | new — coordinates-dependent for the move; `businessType` re-key for the category (correction 6) |
| ownership transfer suspends | gated — the transfer does not exist yet (correction 7) |
| dispute files → suspend; resolve → restore; confirm → revoke | half gated — disputes open today; resolution does not exist (correction 4) |
| 12-month cron expires | new — the house unref'd sweep timer, the shop-brief pattern |
| renewal via a new visit | new — with the current-row definition fixed (correction 10) |
| public page shows the date only when `confirmed` | new — and it is the sentence `PublicFacePanel` has been waiting to finish |
| ✓ does not affect Nearby sort | held — Nearby's own law, verbatim |

## What is genuinely new here

The vendor-scoped verification entity on the proven review spine · the
field-agent visit door with the self-claim refusal and GPS guard · the
admin queue (the pattern exists in supply verification) · the public
display with its date — the first ✓ in this repo's history that a row
backs · the auto-suspension triggers on move, category and (later)
owner and dispute · the renewal cycle in the outbound stream · the
revoke doors with re-apply windows. The promise this prompt writes
down — *a person stood at the shop on a date* — is the one trust claim
in the series that no existing surface fakes, because every surface
refused to fake it.

---

## The prompt, as received (verbatim)

What follows is the prompt exactly as it was received — unedited, including
the unresolved-dispute machinery and the queue-jumping unblock. It is kept
so the corrections can be checked against the ask, and so no future builder
has to trust a paraphrase.

````markdown
# Trace — The Verification Flow (Builder Prompt)

You are building the Verification Flow: the mechanism that
gives a shop the ✓ badge. It is the trust layer underneath
every public surface — Nearby, the public page, Invite-a-Shop,
and the Shop Brief all assume verification exists.

Right now the ✓ appears or doesn't. Nobody knows why. Nobody
can earn it. Nobody can lose it. That is not a badge. That is
decoration.

This prompt makes the ✓ real.

## The problem it solves

A resident opens Nearby. They see two shops that sell the same
thing. One has a ✓. One doesn't. What does that mean?

Today: nothing. The ✓ is either always-on (undermined) or
always-off (undermined). There's no flow that produces it, no
row that records it, no reason it exists.

After this prompt: the ✓ means **a Trace field agent stood at
the shop's physical location, confirmed it exists, confirmed
the owner's identity, and photographed the storefront on a
specific date.** The badge has a date. The evidence is a real
photo at real coordinates. It expires in 12 months. It can be
revoked on complaint.

That is what a badge should mean. Nothing less.

## What you are building (and what you are NOT)

You ARE building:
- A `verification` entity linked to a shop
- A field-agent visit flow (geo-tagged, photo-backed)
- A self-submit path for shops to request verification
- A 12-month validity window with a renewal cycle
- A revocation path on complaint or business change
- A public display of the ✓ with its verification date
- An honest "not verified" state on every surface

You are NOT building:
- A paid verification (paying for a badge is not verification)
- An "instant verify" flow (that's self-attestation, not
  verification)
- A batch verification of shops that no one visited
- A badge that transfers to a new owner without re-verification
- A badge that survives a shop moving locations
- A badge that survives a shop changing its category
- Any "premium verified" tier (there is one tier: verified)
- Any "verified but not really" hedge language

Verification is binary. A shop is either verified or not. There
is no partial, no provisional, no "in review." While a shop is
being reviewed, it is not verified. That is honest.

## Non-negotiables

- Verification requires a **physical visit** by a Trace field
  agent (or an admin) to the shop's stated location.
- The visit captures: a geo-tagged photo, the field agent's
  user ID, the exact time, and a short structured note.
- The shop's `verifiedAt` is set only after the admin reviews
  the visit and confirms it.
- Verification expires 12 months from `verifiedAt`. After
  expiry, the ✓ disappears. The shop can request renewal.
- A shop that **moves** (changes `locationName` or
  `locationCoordinates` by more than 200m) loses verification
  until it's re-verified at the new location.
- A shop that **changes category** (from "food" to "goods")
  loses verification. Different category, different claim.
- A shop with an **active dispute** (unresolved complaint in
  the last 30 days) cannot be verified. If already verified
  and a dispute is filed, the verification is suspended
  pending resolution.
- A shop with an **owner change** loses verification. The new
  owner must re-verify. Verification is attached to the
  owner's identity, not the shop's brand.
- The ✓ badge shows a **date**. The date is the `verifiedAt`.
  Never "verified" without a date.
- The public page shows "Verified by Trace on {date}" in the
  details section, not just the ✓.
- A shop with no verification shows nothing. Not "Unverified."
  Not "Pending verification." Nothing. Silence is honest.
- **Field agents cannot verify their own shops.** If the
  field agent is also the shop owner, the visit is refused at
  the API.
- **No paid fast-track.** A shop cannot pay to skip the queue.
  The queue is a real queue.

## The Verification entity

```
VERIFICATION
├── id
├── shopId
├── status              ('pending_visit' | 'visited'
│                        | 'confirmed' | 'suspended'
│                        | 'revoked' | 'expired')
├── requestedBy         (userId — the shop owner or admin)
├── requestedAt         (ISO)
├── visit               (nullable)
│   ├── visitedBy       (userId — the field agent)
│   ├── visitedAt       (ISO)
│   ├── coordinates     ({ lat, lng })
│   ├── photoUrl        (the geo-tagged photo)
│   ├── storefrontUrl   (a second photo of the shop's front)
│   └── notes           (short structured note)
├── confirmedBy         (userId — the admin who reviewed)
├── confirmedAt         (ISO)
├── expiresAt           (ISO — 12 months from confirmedAt)
├── locationAtVerify    ({ lat, lng, name })
├── categoryAtVerify    (the shop's category when verified)
├── ownerAtVerify       (the userId of the owner when verified)
├── suspendedReason     (nullable)
├── suspendedAt         (nullable)
├── revokedReason       (nullable)
├── revokedAt           (nullable)
└── history             (array of status changes)
```

Status transitions:
```
(no verification) → pending_visit   (shop requests)
pending_visit → visited              (field agent submits visit)
pending_visit → revoked              (shop retracts request)
visited → confirmed                  (admin approves)
visited → revoked                    (admin rejects)
confirmed → suspended                (dispute filed, or admin action)
confirmed → revoked                  (fraud, complaint confirmed)
confirmed → expired                  (12 months pass — cron)
suspended → confirmed                (dispute resolved)
suspended → revoked                  (dispute confirmed)
expired → pending_visit              (shop requests renewal)
```

**A shop has exactly one active verification row.** Historical
verifications are kept for audit but are not "current." The
current one is the one with status `confirmed` and
`expiresAt` in the future.

## The verification flow (field agent path)

**Step 1 — Shop requests verification**

From the shop settings:

```
┌─────────────────────────────────────┐
│  Get verified                       │
│                                     │
│  A Trace field agent will visit     │
│  your shop, confirm the address,    │
│  and take a photo.                  │
│                                     │
│  Once confirmed, your shop shows    │
│  a ✓ on Nearby and its public page. │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  YOUR SHOP ADDRESS                  │
│  Testshop                           │
│  Bypass, Kilimani                   │
│                                     │
│  Is this correct?                   │
│                                     │
│  [ Yes, verify this address ]       │
│  [ Edit address first ]             │
│                                     │
└─────────────────────────────────────┘
```

Tapping "Yes, verify this address" creates a `pending_visit`
verification row.

**Step 2 — Field agent assigned**

The verification enters a queue. A field agent in the area is
dispatched (based on the same dispatch logic used for delivery
partners).

The field agent gets a WhatsApp message:

```
New verification job.

Shop: Testshop
Address: Bypass, Kilimani
Coordinates: -1.2987, 36.7901
Fee: KES 150

Reply ACCEPT to take it.
Reply SKIP to pass.
```

**Step 3 — Field agent visits**

At the shop, the field agent opens the app (or the WhatsApp
flow) and:

1. Confirms they're at the coordinates (GPS check)
2. Takes one photo of the storefront
3. Takes one photo of the owner holding their ID
4. Enters a note:
   ```
   Owner name confirmed: Joseph Ogallo
   Shop name on the front: Testshop
   Street confirmed: Bypass
   Category confirmed: food
   Notes: Small shop, sells meals and packaged goods
   ```
5. Submits

The visit is refused at the API if:
- The field agent is also the shop's owner
- The coordinates are more than 100m from the shop's stated location
- The photos are missing

**Step 4 — Admin review**

The admin sees the visit in the verification queue:

```
┌─────────────────────────────────────┐
│  Verification · Testshop            │
│                                     │
│  VISIT                              │
│  Field agent: Joseph (agent #12)    │
│  Visited: 21 Sept 14:32             │
│  Location: Bypass, Kilimani         │
│  GPS match: ✓ (28m from stated)    │
│                                     │
│  PHOTOS                             │
│  [ Storefront ]  [ Owner + ID ]     │
│                                     │
│  NOTES                              │
│  Owner name confirmed: Joseph Ogallo│
│  Shop name on the front: Testshop   │
│  Category confirmed: food           │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  [ Confirm verification ]           │
│  [ Request another visit ]          │
│  [ Reject ]                         │
│                                     │
└─────────────────────────────────────┘
```

**Confirm** → verification status becomes `confirmed`.
`verifiedAt` is set. `expiresAt` is 12 months from now. The
shop shows the ✓ on all public surfaces.

**Request another visit** → verification returns to
`pending_visit`. Field agent is notified.

**Reject** → verification is `revoked`. The shop is notified
with a reason. They can request again after 30 days.

## The self-submit path

For shops that want to be verified but live in an area with no
field agent yet:

```
┌─────────────────────────────────────┐
│  Get verified                       │
│                                     │
│  No field agent near you yet.       │
│  Submit photos and we'll verify     │
│  remotely.                          │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  PHOTO OF STOREFRONT                │
│  [ Upload ]                         │
│                                     │
│  PHOTO OF OWNER + ID                │
│  [ Upload ]                         │
│                                     │
│  OWNER NAME                         │
│  [                               ]  │
│                                     │
│  SHOP NAME ON THE FRONT             │
│  [                               ]  │
│                                     │
│  STREET / LANDMARK                  │
│  [                               ]  │
│                                     │
│  [ Submit for review ]              │
│                                     │
└─────────────────────────────────────┘
```

Self-submitted verifications are held to a higher standard:

- The photo must include visible street signage or a landmark
- The owner + ID photo must clearly match the name on the
  form
- The admin must cross-reference the shop's stated location
  with a map
- Two admins review and both must confirm (four-eyes rule)

**Self-submit is the fallback, not the default.** When a field
agent is available, use them. Self-submit is for coverage
gaps, and it accepts a slower, stricter review.

## The renewal cycle

Verification expires 12 months after `confirmedAt`.

**60 days before expiry:**

```
WhatsApp to owner:
Your shop {{name}} verification expires in 60 days.
Reply RENEW to start a new visit.
```

**30 days before expiry:**

```
WhatsApp to owner:
Your verification expires in 30 days. After that, your
shop no longer shows the ✓.
Reply RENEW to start a new visit.
```

**On expiry day:**

The verification status becomes `expired`. The ✓ disappears
from all surfaces. The shop is notified:

```
WhatsApp to owner:
Your verification has expired. Request renewal to restore
the ✓. Your shop is still listed on Nearby, just without
the badge.
```

**The shop does not lose functionality on expiry.** It loses
the badge. It remains listed. It remains orderable. It just
loses the trust signal.

**Renewal is a new verification.** Not a flag flip. A field
agent visits again. Photo again. Admin confirms again. The
whole flow runs. Renewal is not a formality — it's a check
that the shop is still there and still run by the same person.

## The revocation paths

Four ways a verification ends early.

### 1. Shop moves more than 200m

Detected when:
- `shop.locationCoordinates` changes
- `shop.locationName` changes significantly

On change:
```
verification.status = 'suspended'
verification.suspendedReason = 'location_changed'
```

The shop is notified:

```
You changed your shop's location. Your verification is
suspended. Request a new visit to restore the ✓.
```

### 2. Shop changes category

From `food` to `goods`, `services` to `food`, etc.

On change:
```
verification.status = 'suspended'
verification.suspendedReason = 'category_changed'
```

Same notification flow. A shop that used to be verified as
food cannot advertise itself as verified as services without
a new visit.

### 3. Owner change

When the shop's `ownerId` changes (via ownership transfer):

```
verification.status = 'suspended'
verification.suspendedReason = 'owner_changed'
```

The new owner must re-verify. Verification is per-owner, not
per-shop.

### 4. Dispute filed

When any buyer files a dispute against the shop:

```
verification.status = 'suspended'
verification.suspendedReason = 'dispute_filed'
```

While suspended, the ✓ shows greyed out or disappears
entirely. The buyer sees "This shop's verification is under
review."

If the dispute is resolved in the shop's favour:
```
verification.status = 'confirmed'
```
The ✓ returns.

If the dispute is confirmed against the shop:
```
verification.status = 'revoked'
verification.revokedReason = 'dispute_confirmed'
```
Permanent. The shop can re-apply after 90 days.

### 5. Fraud detected

If the field agent, admin, or any user reports fraud (shop
that doesn't exist, owner's ID doesn't match, etc.):

```
verification.status = 'revoked'
verification.revokedReason = 'fraud'
```

The shop's owner account is flagged. Re-verification requires
a manual review by the Trace team, not the standard field
agent flow.

## What shows on the public page

**Verified shop:**

```
Testshop ✓
Food · Open now
```

Details section (below the fold):

```
VERIFICATION
Verified by Trace on 21 Sept 2026
Field agent: Joseph (agent #12)
Valid until 21 Sept 2027
```

**Unverified shop:**

```
Testshop
Food · Open now
```

Nothing else. No "not verified" label. No "pending." Just
silence.

**Suspended shop:**

```
Testshop
Food · Open now
```

Details section:

```
VERIFICATION
Under review — check back soon.
```

**Expired shop:**

```
Testshop
Food · Open now
```

Details section:

```
VERIFICATION
Previously verified 21 Sept 2025
Expired 21 Sept 2026
```

The expired state shows the shop was once verified. That's
honest. It also signals to the shop that renewal is worth
doing.

## What shows on Nearby

Verified shops show the ✓ next to their name.

Unverified shops show nothing.

There is no visual difference in the card layout, size, or
position. **Verified shops do not appear higher in the list.**
Sorting is still distance, then freshness. The ✓ is
information, not ranking.

## The admin surface

An admin queue for verifications, disputes, and revocations:

```
┌─────────────────────────────────────┐
│  Verification queue                 │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  VISITS TO REVIEW (3)               │
│  Testshop           submitted 14:32 │
│  Kikao Hardware     submitted 11:05 │
│  Marigiti Greens    submitted 09:18 │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  SELF-SUBMITS TO REVIEW (2)         │
│  Jane's Tailors      submitted 20 Sep│
│  Ngara Auto Parts    submitted 19 Sep│
│                                     │
│  ──────────────────────────────     │
│                                     │
│  EXPIRING THIS MONTH (12)           │
│  [ View list ]                      │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  SUSPENDED / DISPUTED (1)           │
│  Riverside Foods    dispute_filed   │
│                                     │
└─────────────────────────────────────┘
```

Every review row is a real queue item. No fake urgency. No
"you have 5 pending verifications!" nagging.

## What to remove from the current surface

- Any hardcoded ✓ that isn't derived from a real
  `verification` row with status `confirmed`.
- Any "Verified by Trace" text on the public page that isn't
  derived from the same.
- Any "premium" or "trusted" alternative to verification.
- Any fake "verification in progress" state on a shop that
  hasn't requested it.

## Test requirements

- A shop that hasn't requested verification shows no ✓.
- Requesting verification creates a `pending_visit` row.
- A field agent visit requires: coordinates within 100m of
  the shop, two photos, and a note.
- A field agent cannot verify their own shop. The API refuses.
- An admin confirming a visit sets `verifiedAt` and
  `expiresAt` (12 months from now).
- Moving a shop's coordinates by 250m suspends the
  verification.
- Changing a shop's category suspends the verification.
- Transferring ownership suspends the verification.
- Filing a dispute against a verified shop suspends it.
- Resolving a dispute in the shop's favour restores
  verification.
- Confirming a dispute against the shop revokes
  verification permanently (re-apply after 90 days).
- 12 months after `verifiedAt`, a cron job moves the
  verification to `expired`.
- An expired verification can be renewed via a new visit.
- The public page shows "Verified by Trace on {date}" only
  when the verification is `confirmed`.
- The ✓ badge does not affect sort order on Nearby.
- A suspended or expired shop is not shown as verified on
  any surface.

## The one rule

Verification means a person physically confirmed the shop
exists and is what it says it is. If nobody went, it isn't
verified. If the address changed, it isn't verified. If the
owner changed, it isn't verified. If a dispute is open, it
isn't verified.

The badge has a date. The date is the promise. Renewal is the
proof.

## Order of operations

1. `verification` entity + status state machine.
2. Shop request flow (from settings).
3. Field agent dispatch + WhatsApp visit flow.
4. Admin review queue.
5. Public display with date.
6. Auto-suspension triggers (move, category, owner,
   dispute).
7. Renewal cycle with 60/30/0 day notifications.
8. Self-submit fallback with four-eyes review.
9. Revocation paths with re-application windows.

Each step ships separately. Each step has its own test.

## What this unblocks

- The ✓ badge on every surface becomes meaningful.
- Nearby has a trust signal that reflects reality.
- The public page has a verification date, not a vague
  claim.
- The Shop Brief can show "You've been verified for 8
  months. Renewal in 4 months."
- Invite-a-Shop can offer verification as the reward for
  joining ("Shops you bring in get priority for field
  agent visits").
- Disputes have a real consequence (verification
  suspension).
- A shop that isn't verified isn't punished — it just
  doesn't carry the badge.

## Reference

The badge is a promise. "A Trace field agent visited this
shop on this date and confirmed it exists." That is the
promise. Everything else in the app trusts the promise.
Nothing else in the app should claim it without the visit.

Ship this. Then every ✓ in the app means something.
````

---

## Operator's note (received with the prompt, outside it)

> **Why Verification, Next**
>
> Look at the last eight prompts — every one of them **assumes
> verification exists**:
>
> - **Nearby** shows a ✓ on shop cards
> - **Public page** shows a ✓ next to the shop name
> - **Invite-a-Shop** implies verification as a benefit
> - **Shop Brief** has an entire section for verification status
> - **Team & Roles** uses verification as an implicit trust gate
> - **Partner Onboarding** has its own verification flow (but for riders,
>   not shops)
> - **Shopping Run Stream** assumes shops are trustworthy
> - **Events & Ticketing** assumes hosts are real
>
> Right now the ✓ is undefined. This prompt makes it real.
>
> **Verification is the badge that earns everything else.**
>
> ---
>
> **Where We Are Now** — nine builder prompts delivered:
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
>
> **Updated recommended build order:**
>
> 1. **Settlement Rail** (ManualRail first) — everything financial depends on it
> 2. **Team & Roles** — attribution must exist before the brief means anything
> 3. **Verification Flow** — the badge every surface assumes
> 4. **Nearby** — first consumer surface
> 5. **Partner Onboarding** — supply side
> 6. **Shop Brief** — now meaningful with roles + verification
> 7. **Invite-a-Shop** — growth
> 8. **Events & Ticketing** — consumer inflow
> 9. **Shopping Run Stream** — community coordination
>
> **Natural next prompts:**
>
> 1. **Reviews (settlement-gated)** — trust from real orders
> 2. **Dispute Resolution** — what happens when a buyer and seller disagree
> 3. **The Consumer Profile** — buyer's own page: orders, saved shops, reviews left
> 4. **The Space Editor v2** — edit a public page with history
> 5. **Trace Rewards** — what a shop owner gets for maintaining a verified,
>    active, quality shop
>
> Say **"next"** and I'll keep going.

The note's premise inverts the history it describes. The surfaces did not
assume verification — they *refused to fake it*: Nearby refused the ✓ and
named this prompt as its prerequisite, the public page ships no tick with
the reason in a comment, the Shop Brief refused the staff flag for lack of
rows and would refuse a verification section it couldn't derive. That is
why this is the right prompt: it is the one the records have been asking
for since the first ✓ was declined. The corrections it must answer on the
way in: the two verification systems to extend rather than fork, the ID
photo against "no documents, ever," the fourth field-agent pay number, the
dispute machinery hanging on a resolution door that doesn't exist yet, and
the queue-jumping unblock that quietly reinstates the promoted-placement
this series exists to refuse. One warning for the road: the next-prompts
list ends with "Trace Rewards — what a shop owner gets for maintaining a
verified, active, quality shop." Read against every record in this
series, that is a targets-and-badges prompt wearing a reward's name — the
Shop Brief's laws (no targets, no ranks, no advice) will meet it at the
door.
