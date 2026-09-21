# Trace — The Consumer Profile (Builder Prompt)

> Status: **the commerce view is genuinely new; the home it claims to build
> has existed since before the series started.** The You tab ships grouped —
> Identity / Business / Money / About (a keep-list item in the very first
> prompt of this series) — plus `PositionHero`, which reads `position.js`'s
> derived "position in time" (what is expiring, what you lost, what is
> open), plus `EarnSurface`, which prints "Your points, territory and
> contracts are yours alone." The genuinely new: the *commerce* sections —
> orders (derivable today via `listOrders({ buyerId })`), disputes
> (derivable today via `listDisputes({ reportedBy })`), saves (a note on
> the existing save signal), and reviews (gated on the Reviews prompt).
>
> Two items collide with built things: **"the phone is the account"**
> reverses an auth model that has real passwords (scrypt, 30-day sessions),
> and **"points belong to shops, not buyers"** would strip the referrals
> rail — built as the anti-pyramid, pool-backed from confirmed revenue.
> Read **Corrections first**. Verified against the tree on 2026-09-21.

---

## Corrections first (what was changed, and why)

1. **"She has no home in Trace" — the tree disagrees, and kept it on
   record.** The You tab is the grouped surface the Shop Brief prompt
   itself ordered kept ("The grouped You tab (Identity / Business /
   Money / About)"), and the build kept it. It holds `PositionHero` —
   the honest "your position in time" from `position.js` ("There is
   deliberately NO fabricated rider queue, NO tier/badge ladder, NO trust
   score"), `EarnSurface` ("Your points, territory and contracts are
   yours alone"), a first-run checklist, guardians, table banking, and
   the How-Brief-works audit page. The premise is wrong in general and
   right in particular: what does not exist is the **commerce** view —
   Mary's orders, her saved shops, her reviews, her disputes. Build
   those *into* the tab that exists; do not build a second "consumer
   profile" beside it.

2. **Three of the four sections are derivable today.** Orders:
   `listOrders({ buyerId })` exists, newest-first is one sort. Disputes:
   `listDisputes({ reportedBy })` exists, with status and outcome on the
   row — the buyer history the Disputes prompt specified ("visible only
   to them and to Trace admins") is a read, not a build. Saves: the
   `object_saved` signal already exists — analytics counts saves,
   discovery counts saves, `personal.js` personalises from them, and My
   Layer renders the result. Reviews: gated on the Reviews prompt and its
   unresolved aggregate decision. The genuinely new work is small and
   precise: the four-tab commerce view, the reorder flow, the save note,
   and the owner toggle.

3. **"The phone is the account" reverses the auth model — decide it in
   writing.** `auth.js` is "a real authentication boundary: users,
   password hashing, sessions, tokens" — scrypt-hashed passwords, 30-day
   sessions, `authProvider` with passwordless variants named ("sign-in,
   signed email links"). Phone verification exists as a kind; phone-keyed
   flows exist in huduma. But "no email required. No password. The phone
   is the account" is a different identity model, and v1's "a consumer
   cannot change their phone number" makes the account *brittle by
   design* — the one identity that can be lost with a SIM swap or a
   carrier migration. This is the series' biggest recorded-decision
   collision after the vendor-as-parent one. Either extend the existing
   boundary (phone as a verified login method alongside handle+password)
   or migrate the model — in writing, with the migration path for
   existing accounts, never by quietly forking identity.

4. **"Points belong to shops, not buyers" — refused as written; scoped,
   it is already law.** The referrals rail pays members points for real,
   deduplicated events (signups, purchases, referred activity, genuine
   link traffic) from a pool derived from confirmed revenue, capped at
   6.5%, refused with a reason when the pool is empty — and it is
   deliberately barred from settling anything (the shopping spec carries
   that wall). `EarnSurface` prints the conversion rate plainly ("100
   points = KES X — always. No chance, no spin"). Deleting buyer-side
   points would remove a built, honest, written system. What the prompt
   actually wants — no gamification *on the profile*, no "review 5 shops
   to unlock" — is already banned by every record in this series and by
   the prompt's own NOT-build list. Scope the removal to that; leave the
   rail standing.

5. **Saves: the row exists as a signal; the note is the new part.**
   `object_saved` is a first-class signal (counted by analytics,
   discovery and personalisation — "something they did (saved, opened,
   shared)"). A save/unsave pair and a private 120-char note ride that
   mechanism; "no history of saves needed" matches the signal's own
   design. One re-key, the series convention, eighth time:
   `SAVED_SHOP.shopId` keys to the vendor.

6. **The share flow is mostly standing — and one sentence needs scoping.**
   The public page exists at `/s/:slug`, is server-rendered for exactly
   the WhatsApp channel ("the sharing channel is WhatsApp"), and already
   builds the preview card a shared link gets. "A plain URL… no tracking
   parameter" honours that design — with one precision: **referral
   links** exist and are *supposed* to be attributed (the invite
   primitive's attribution, "genuine link traffic" as a points event).
   A plain share and a referral link are different links by intent; the
   prompt's "no way to know who shared what" is true of the plain share
   and must not be read as a ban on the referral rail. Two links, two
   names, both honest.

7. **Reorder is a thin, honest client flow — and the price-change note is
   already derivable.** Offers change price with a stated reason and the
   change stays on the record (the commerce law in the routes); an order
   references its listing. So "price changed from KES 500 to KES 550" is
   a read over recorded history, and "no longer available" is the
   listing's state. "No auto-charge — reorder is a shortcut to a full
   checkout" is exactly the existing `createOrder` → settlement path;
   the Settlement Rail's honest-collection half stands (Buni STK), and
   the payment step cannot be skipped because the order only settles
   through it.

8. **The WhatsApp commands are a new bot, not a surface tweak.** The
   outbound seam (sms/whatsapp/email/telegram, fail-closed) is standing —
   the ninth surface in this series to ride it — but *inbound* WhatsApp
   does not exist: Brief ingests Telegram, web, RSS and manual. MY
   ORDERS / REORDER / SAVE / SHARE as reply-commands are a stateful
   conversational surface on a channel Brief cannot yet hear. Build it
   on the seam pattern (a connector that hears, a parser that refuses
   unknown commands with the list), or ship the profile app-first and
   say so. "The app is optional" is a claim about a door that has no
   hinges yet.

9. **The Reviews tab inherits the gate.** Reviews do not exist as rows
   until the Reviews prompt lands — and its one open decision (the
   aggregate) does not block this tab, which shows the buyer's *own*
   signed rows, never an aggregate. The frozen display name matches the
   Reviews record's settlement-snapshot pattern; the 30-day rename limit
   is new, sensible, and needs the same test discipline as every window
   in this series (a timestamp on the user row, a refusal with the date
   it unlocks).

10. **Removals, audited.** "Any 'My Activity' listing": the You tab's
    sections are Identity / Business / Money / About — no surveillance
    feed — though signals of opens exist *by design* for explicit,
    inspectable personalisation ("nothing is inferred about sensitive
    characteristics, and nothing is ever exposed to other users"). No
    listing to delete; the privacy stance is already stronger than the
    prompt's. "Any 'Your standing' or 'Rank'": refused everywhere by
    law (`position.js` in writing) — phantom. The profile-fields item
    (bio/email/birthdate the consumer can't set) was not found on the
    tab's four sections; treat as phantom pending a full audit. Points:
    see correction 4 — the one removal that would break something real.

11. **The empty state is already the house style.** Zero-filled tables
    are refused across every record; "You haven't ordered anything yet"
    with two doors (Nearby, Invite a shop) is the EarnStrip pattern
    ("nothing when all three rails read OK and are empty") and the brief's
    "not a page of zeros." The masked phone number is data minimisation
    the tree already practises (huduma phone-keying hides attribution;
    digits only where the owner asks). The owner toggle is the one
    genuinely new navigation — and it must route to the existing
    SpacesLanding/street, not to a parallel "business view."

12. **The recap: thirteenth claimed, twelfth arrived.** Group Buy Streams
    remains the phantom — it graduated from "Delivered" (#12, last
    recap) into this recap's build order (#13) without ever being sent.
    Twelve prompts have genuinely arrived, this one being the twelfth.
    The remaining list gains two new names (Trace for Cooperatives —
    note: `coop.js`, `coopOperations.js` and a `circle` treasury already
    exist, so that prompt will want to read the tree first — and The
    WhatsApp Business Integration, which is correction 8's bot, already
    named here).

---

## The prompt's test requirements, mapped

| Required by the prompt | Where it stands |
| --- | --- |
| orders sorted newest first | **held** — `listOrders({ buyerId })` + a sort |
| reorder pre-selects available items; notes the rest | new — thin client flow; price history makes the notes derivable |
| reorder requires re-confirmation on price change | new — same flow; no auto-charge is the existing settlement path |
| save creates a row; unsave removes it | held in substance — the `object_saved` signal; the note is new (correction 5) |
| the note is private | new — private by the personal-brief rule ("nothing is ever exposed… through public endpoints") |
| reviews shown with the shop's response | gated — the Reviews prompt's rows |
| reviews cannot be edited or deleted | held by future construction — immutability is the Reviews design |
| disputes show status and outcome | **held** — `listDisputes({ reportedBy })` |
| share opens the OS sheet with the plain URL | held in substance — the public page and its WhatsApp preview card exist |
| no share parameter added to the URL | held — and scoped so the referral rail keeps its own, named links (correction 6) |
| MY ORDERS / REORDER / SAVE / SHARE replies | new — a WhatsApp inbound door that does not exist yet (correction 8) |
| empty state, not zero-filled tables | held as the house style |
| phone masked on the profile | new — trivial projection; minimisation is the tree's default |
| display name changes once per 30 days | new — timestamp + refusal naming the unlock date |

## What is genuinely new here

The four-tab commerce view inside the You tab that already exists · the
reorder flow with its derived price-change notes · the save note · the
owner toggle routed to the street that exists · the rename window · the
masked number · and — if it is wanted — the WhatsApp reply-commands as
the repo's first inbound WhatsApp door. The home the prompt says is
missing has been standing, grouped and audited, since before the series
began; what Mary lacks is not a home but a *room in it* — and three of
the four walls are one read away.

---

## The prompt, as received (verbatim)

What follows is the prompt exactly as it was received — unedited, including
the identity-model reversal and the points removal. It is kept so the
corrections can be checked against the ask, and so no future builder has to
trust a paraphrase.

````markdown
# Trace — The Consumer Profile (Builder Prompt)

You are building the Consumer Profile: the buyer's own page.
It is what a resident sees when they tap "You" and they are
not a shop owner. It is their orders, their saved shops,
their reviews, their disputes, and their share link.

Every previous prompt has been about making the shop or the
platform work. This one is about making the *buyer* feel that
Trace is theirs. Without it, they use Trace once and leave.

## The problem it solves

Mary orders tilapia from Testshop. It arrives. She's happy.
She closes Trace. She has no page, no history, no way to
find Testshop again except by scrolling Nearby and hoping
she recognises the name.

She can't see:
- What she ordered last week
- How much she spent this month
- Which shops she liked
- What she said about them
- How to tell a friend about Testshop

She has no home in Trace. So she doesn't come back to one.

After this prompt: Mary taps "You". She sees her orders, her
saved shops, her reviews, and a share link for each shop she
likes. She can reorder in one tap. She can send Testshop's
link to her friend in the estate.

The consumer profile is the reason a buyer is not just a
transaction. It is the reason they belong.

## What you are building (and what you are NOT)

You ARE building:
- A `consumerProfile` view over existing user rows
- Four sections: Orders, Saved Shops, Reviews, Disputes
- A one-tap reorder from a past order
- A one-tap share of a shop with a pre-filled WhatsApp message
- A referral link that's simple and honest
- The You tab's default content for non-owners
- The You tab's primary content for owners (with a
  "Switch to business view" toggle)

You are NOT building:
- A social profile (no bio, no followers, no photos beyond
  the avatar)
- A gamified progress (no badges, no levels, no streaks)
- A "spend analytics" dashboard with charts (nothing to
  plot)
- A recommendations feed ("you might also like...")
- Any public visibility of the consumer's orders or reviews
  (all private)
- Any incentive mechanic ("review 5 shops to unlock...")
- Any "top buyer" or "frequent customer" label

The consumer profile is a personal record. Not a game. Not a
social page. Not a marketing surface.

## Non-negotiables

- The consumer's phone number is their identity. No email
  required. No password. The phone is the account.
- The consumer's display name is what they typed at first
  order. They can change it once per 30 days.
- The consumer's orders are private. Only the consumer and
  the shop owner see them.
- The consumer's reviews are public (they signed them). The
  consumer's disputes are private.
- The consumer's saved shops are private. Only the consumer
  sees them.
- Reorder uses the same Settlement Rail and the same flow as
  a first order. No shortcut, no "buy again" that skips
  payment.
- A share link is a real link to the shop's public page. Not
  a referral code. Not a tracking pixel. A plain URL the
  recipient can open.
- Every number on the profile is derived from real rows. No
  estimates, no aggregates that hide details.
- Zero orders → empty state, not fake zeros.
- The WhatsApp-first default: every action on the profile
  can also be done via WhatsApp. The app is optional.

## The Consumer Profile view

The profile is a **view**, not a new entity. It reads from:
- `orders` (filtered by buyerId)
- `savedShops` (a new row — see below)
- `reviews` (filtered by buyerId)
- `disputes` (filtered by filedBy)
- `users` (name, phone)

The ConsumerProfile itself has no row. It's computed.

## The Saved Shops entity

```
SAVED_SHOP
├── id
├── userId              (the consumer)
├── shopId              (the saved shop)
├── savedAt             (ISO)
└── note                (nullable, private to the consumer,
                         max 120 chars)
```

A save is one row. Unsave removes the row. No history of
saves needed.

**The note is the only place a consumer can annotate.** It's
private. It's for their own memory ("the tilapia here was
good"). It's not shown to the shop or to anyone else.

## The You tab structure

When a consumer taps "You", they see:

```
┌─────────────────────────────────────┐
│  Mary K.                            │
│  +254 712 ••• 678                   │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  [ Orders (7) ]  [ Saved (4) ]      │
│  [ Reviews (3) ] [ Disputes (0) ]   │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  <content of the selected tab>      │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  [ How Trace works ]                │
│  [ Sign out ]                       │
│                                     │
└─────────────────────────────────────┘
```

If the consumer also owns a shop, there's a toggle at the
top:

```
┌─────────────────────────────────────┐
│  [ You ]  [ Your shops ]            │
│           ^ switch to owner view    │
└─────────────────────────────────────┘
```

The "You" tab defaults to the consumer view. "Your shops"
is the shop-owner view (which is a separate surface).

## The Orders tab

The consumer's orders, sorted by date (newest first):

```
┌─────────────────────────────────────┐
│  Orders                             │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  ✓ Testshop                         │
│  Order #4821 · 21 Sept              │
│  3kg tilapia · KES 1,020            │
│                                     │
│  [ Reorder ]  [ View shop ]         │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  ✓ Kikao Hardware                   │
│  Order #4804 · 14 Sept              │
│  1 Portable Solar Kit · KES 18,500  │
│                                     │
│  [ Reorder ]  [ View shop ]         │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  ... 5 more orders                  │
│                                     │
└─────────────────────────────────────┘
```

Each order shows:
- Settlement status (✓ paid, ⏳ pending, ✗ failed,
  ↩ refunded)
- Shop name
- Order ID + date
- Item summary (first item + count if more)
- Total
- Two actions: Reorder, View shop

**No "order again" nagging.** No badge. Just the list.

**Reorder flow:**

```
1. Tap "Reorder"
2. Trace opens the shop's current catalog
3. The exact items from the previous order are
   pre-selected IF they still exist at the same price
4. Items that no longer exist or whose price changed
   are shown with a note:
   "This item is no longer available"
   "Price changed from KES 500 to KES 550"
5. The consumer confirms the new order
6. Payment via Settlement Rail
```

**No auto-charge.** Reorder is a shortcut to a full
checkout, not a subscription.

## The Saved Shops tab

```
┌─────────────────────────────────────┐
│  Saved shops                        │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  ✓ Testshop                         │
│  Food · Kilimani · 0.3 km           │
│  "the tilapia here was good"        │
│                                     │
│  [ Order ]  [ Chat on WhatsApp ]    │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  ✓ Kikao Hardware                   │
│  Goods · Kilimani · 0.8 km          │
│                                     │
│  [ Order ]  [ Chat on WhatsApp ]    │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  ... 2 more                         │
│                                     │
└─────────────────────────────────────┘
```

Each saved shop shows:
- Name, category, distance
- The consumer's own note (if any)
- Two actions: Order, Chat on WhatsApp

**Unsave** is done by swiping the row (or a long-press on
mobile) — no dedicated button, no visual clutter.

## The Reviews tab

Every review the consumer has written:

```
┌─────────────────────────────────────┐
│  Reviews                            │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  ★★★★☆ 4 ★ · Testshop               │
│  21 Sept                            │
│  "Fresh tilapia, arrived on time.   │
│   Slightly smaller than expected."  │
│                                     │
│  Testshop responded:                │
│  "Thanks Mary — we'll weigh twice   │
│   next time."                       │
│                                     │
│  [ View on shop page ]              │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  ★★★★★ 5 ★ · Kikao Hardware         │
│  12 Sept                            │
│  "Fast delivery, quality product."  │
│                                     │
│  [ View on shop page ]              │
│                                     │
└─────────────────────────────────────┘
```

Each review shows:
- The full review text
- The shop's response (if any)
- A link to where it appears publicly

**Reviews cannot be edited or deleted by the consumer.**
They can report their own review for removal (e.g., if they
made a mistake) — an admin decides. That's the only path.

## The Disputes tab

```
┌─────────────────────────────────────┐
│  Disputes                           │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  (If no disputes)                   │
│                                     │
│  No disputes filed.                 │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  (If there are disputes)            │
│                                     │
│  Open · Order #4821 · Testshop      │
│  Filed 21 Sept · short quantity     │
│  [ View ]                           │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  Resolved · Order #4790 · Testshop  │
│  Filed 14 Sept · resolved: refunded │
│  [ View ]                           │
│                                     │
└─────────────────────────────────────┘
```

Each dispute shows:
- Status (Open, Resolved, Escalated, Withdrawn)
- Order and shop
- Category (short quantity, wrong item, etc.)
- Outcome if resolved

Tap → the dispute detail (reuses the dispute resolution
surface from Prompt #10).

## The share link

Every shop's public page has a "Share" button. Tapping it
opens:

```
┌─────────────────────────────────────┐
│  Share Testshop                     │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  [ WhatsApp ]                       │
│  [ Copy link ]                      │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  Link preview:                      │
│  ┌───────────────────────────────┐ │
│  │ Testshop ✓                    │ │
│  │ Food · Kilimani                │ │
│  │ ★ 4.6 (12)                    │ │
│  │ 🍲 Meals · KES 150            │ │
│  │ trace.africa/s/testshop        │ │
│  └───────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

**The WhatsApp share opens the OS share sheet** with a
pre-filled message:

```
Check out Testshop on Trace:

trace.africa/s/testshop

Fish, meals, and other food in Kilimani.
```

**No referral code. No tracking parameter. No "share and
earn."** Just a link. The recipient opens it, sees the shop,
and can act. That's the entire share flow.

**If the consumer saves a shop, the shop appears on their
profile.** If the recipient of a share saves the shop, it
appears on their profile. There's no way to know who shared
what. That's honest — the share is a gift, not a funnel.

## The WhatsApp-first surface

Every action on the Consumer Profile is also available via
WhatsApp. The consumer can:

- **MY ORDERS** → reply with "MY ORDERS" → list of last 5
  orders
- **REORDER #4821** → reply with "REORDER 4821" → reorder
  summary + payment request
- **SAVED** → reply with "SAVED" → list of saved shops
- **SAVE Testshop** → reply with "SAVE Testshop" → shop
  added to saved
- **SHARE Testshop** → reply with "SHARE Testshop" → returns
  the share link

The app is a nicer interface for the same operations. Not a
separate product.

## The empty state

A brand-new consumer with no orders:

```
┌─────────────────────────────────────┐
│  Mary K.                            │
│  +254 712 ••• 678                   │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  You haven't ordered anything yet. │
│                                     │
│  Browse shops near you:             │
│                                     │
│  [ Open Nearby ]                    │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  Know a shop that should be here?   │
│                                     │
│  [ Invite a shop ]                  │
│                                     │
└─────────────────────────────────────┘
```

**Not zero-filled tables.** Two options. That's it.

## The display name

The consumer's display name is used on their reviews and on
their own profile. It's set on first order (they type it in).

Format: `First name + last initial`. E.g., `Mary K.`

**Not editable** on reviews (frozen at review time).
**Editable** on the profile once per 30 days. Because
sometimes people change their name.

If the consumer has no orders, they can still set a display
name. It appears only on their profile.

## The phone number

The phone is the identity. It's shown as `+254 712 ••• 678`
(masked except the last 3 digits). Full number visible only
to the consumer (on tap).

**A consumer cannot change their phone number** in v1. They
must create a new account. This is because the phone is the
account — moving it is complicated, and the number of users
who need this is small.

## What to remove from the current surface

- Any "Profile" section that shows fields the consumer
  can't actually set (e.g., a bio, an email, a birthdate).
- Any "My Activity" listing that shows Trace interactions
  (like "viewed a shop") — the consumer doesn't need a
  surveillance log.
- Any "Points" or "Rewards" on the consumer side — points
  belong to shops, not buyers.
- Any "Your standing" or "Rank" — ranking a buyer is not
  a thing.

## Test requirements

- A consumer's orders show sorted by date, newest first.
- Reorder with all items available pre-selects them all.
- Reorder with one item unavailable shows the unavailability
  note and omits the item.
- Reorder with a price change shows the change and requires
  re-confirmation.
- A save creates a `savedShop` row. Unsave removes it.
- A save with a note stores the note. The note is private.
- Reviews are shown with the shop's response (if any).
- Reviews cannot be edited or deleted by the consumer.
- Disputes show status and outcome.
- Share opens the OS share sheet with the shop URL.
- No share parameter is added to the URL.
- MY ORDERS reply returns the last 5 orders.
- REORDER #4821 reply creates a reorder summary and sends a
  payment request.
- A brand-new consumer sees the empty state, not zero-filled
  tables.
- The phone number is masked on the profile screen.
- The display name can be changed once per 30 days. A second
  attempt within 30 days is refused.

## The one rule

The consumer profile is Mary's own page. Not a shop's page.
Not a marketplace. Not a social feed. It's where Mary sees
what she's done in Trace, and where she can act on it
again.

No gamification. No badges. No "top buyer." Just her orders,
her saves, her reviews, her disputes, and her share link.

If it helps Mary order again, it belongs. If it doesn't,
it doesn't.

## Order of operations

1. `savedShop` entity.
2. You tab: toggle between "You" and "Your shops" (for
   owners).
3. Orders tab with reorder flow.
4. Saved tab with note support.
5. Reviews tab (read-only).
6. Disputes tab (reuses dispute surface).
7. Share button on public pages.
8. WhatsApp-first commands for orders, reorder, save,
   share.
9. Empty state.
10. Display name editing with 30-day limit.

Each step ships separately. Each step has its own test.

## What this unblocks

- The consumer has a home in Trace besides Nearby.
- Reorder is one tap — for the buyer who buys from the
  same shop every week.
- Save a shop — for the buyer who wants to come back
  without scrolling Nearby.
- Share a shop — the growth loop has a natural home for
  consumers.
- Invite-a-Shop gets a consumer side: a resident can refer
  a shop AND save it.
- The "You" tab has real content for non-owners. Right now
  it's empty.
- A consumer who's also a shop owner gets a clean toggle
  between the two identities.

## Reference

The shop's dashboard is what they see when they open the
app to work. The consumer's profile is what they see when
they open the app to live. Both are "You" tabs. Different
identities.

The consumer doesn't have a business to run. They have a
life to live. The profile reflects that.
````

---

## Operator's note (received with the prompt, outside it)

> **Why Consumer Profile, Next**
>
> Looking at the stack:
>
> | Feature | Serves whom | Status |
> |---|---|---|
> | Settlement Rail | Everyone | Spec'd |
> | Team & Roles | Shop owners | Spec'd |
> | Verification | Shops | Spec'd |
> | Disputes | Buyer + seller | Spec'd |
> | Reviews | Buyer + seller | Spec'd |
> | Nearby | Consumer | Spec'd |
> | Partner Onboarding | Partners | Spec'd |
> | Shop Brief | Shop owners | Spec'd |
> | Invite-a-Shop | Everyone | Spec'd |
> | Events | Consumers + hosts | Spec'd |
> | Shopping Runs | Residents | Spec'd |
> | Group Buys | Consumers | Spec'd |
>
> **Almost every feature serves the shop owner or the partner.** The
> consumer gets Nearby and nothing else.
>
> The consumer has **no home**. They open the app, see shops, order, and
> leave. They have no page to return to. They have no reason to open
> Trace when they're not shopping.
>
> **The Consumer Profile fixes this.** It gives every buyer:
>
> - Their orders (reorder in one tap)
> - Their saved shops (one tap to see what they liked)
> - Their reviews (their own voice, on record)
> - Their disputes (their recourse, recorded)
> - Their share link (a gift, not a funnel)
>
> **It's the missing home.** Ship it. Then the consumer is not just a
> transaction. They're a member.
>
> ---
>
> **Where We Are Now** — thirteen builder prompts delivered:
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
> | 12 | Group Buy Streams | Rail + Verification |
> | 13 | Consumer Profile | Orders + Rails |
>
> **Recommended build order:**
>
> 1. Settlement Rail (ManualRail first)
> 2. Team & Roles
> 3. Verification Flow
> 4. Dispute Resolution
> 5. Reviews
> 6. Nearby
> 7. Partner Onboarding
> 8. Consumer Profile
> 9. Shop Brief
> 10. Invite-a-Shop
> 11. Events & Ticketing
> 12. Shopping Run Stream
> 13. Group Buy Streams
>
> **Remaining prompts available:**
>
> 1. **The Space Editor v2** — public page editing with history
> 2. **The Trace Card** — the shop's physical card for customers
> 3. **The Field Agent App** — the agent's surface in depth
> 4. **The Protection Fund** — the pool that covers failed wholesalers and
>    disputes
> 5. **Trace for Cooperatives** — the SACCO-specific surface
> 6. **The WhatsApp Business Integration** — the deep dive on
>    WhatsApp-first interactions
>
> Say **"next"** and I'll pick the highest-leverage remaining one.

Three corrections to the note, then the door. "Thirteen delivered" —
twelve have arrived; Group Buy Streams is counted a second time without
ever being sent, now promoted from a false "Delivered" into the build
order itself. "The consumer gets Nearby and nothing else" — the You tab
this series ordered kept holds Identity, Business, Money and About, a
derived position-in-time, points with their conversion rate printed
plainly, guardians, and the audit page; "right now it's empty" was true
of no surface in this repo. And "the Status column: Spec'd" — twelve
records now say what that word means here: some built, some refused,
some waiting on a letter. The genuine build in this prompt is small and
worth doing: a commerce room in a house that exists — orders one read
away, disputes one read away, saves a signal away, reviews one prompt
away. Two decisions must be written first: whether the phone replaces
the password, and whether the points rail survives its own removal.
Answer those in writing, and Mary's room can be built in an afternoon.
