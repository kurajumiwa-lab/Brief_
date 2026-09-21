# Trace — The Nearby Surface (Builder Prompt)

> Status: **half-poured, with two collisions to resolve before anything is
> renamed.** The directory API (`/api/public/spaces`), the honest distance
> engine (`/api/nearby`), the server-rendered public page with its EAT hours
> pill and owner-controlled WhatsApp CTA, the geolocation-once hook, and the
> entire Discover cleanup this prompt opens with — all standing. What is
> genuinely new: the shop-card list itself on the consumer entry, coordinates
> on spaces (or an honest `—` on nearly every card), saved spaces, and an
> invite-a-shop link.
>
> The two collisions: **the name "Nearby" is already taken** —
> `NearbyScreen.tsx` (2,415 lines) is mounted at the `nearby` tab — and **the
> removal list already shipped** in `0d97d70`. Read **Corrections first**
> before building. Every claim below was verified against the tree on
> 2026-09-21.

---

## Corrections first (what was changed, and why)

1. **"What to remove from the current Discover" — already shipped.** The four
   dead flow cards became one `Browse the board` entry opening a picker
   (`DiscoverFeed.tsx:479-491`, whose own comment reads "Four dead tiles and a
   duplicate…"), the duplicate top chips went (the band is the sheet's
   `SIDE_ORDER` only), and `DiscoverScreen.tsx` is now a thin wrapper over
   `CityFeedView` whose header documents the deeper cleanup: the invented
   listings, Unsplash photos and fake phone numbers are gone — "a card exists
   only because a listing or a published event exists." Re-adding a category
   chip row where the prompt asks would re-create the duplication the cleanup
   removed; and the prompt's "7 chips" no longer exist to remove.

2. **"Rename Discover → Nearby" — collides with an existing screen.**
   `NearbyScreen.tsx` is mounted at `activeTab === 'nearby'`
   (`App.tsx:1392`) as the "Around you" aggregation surface — shelves,
   marketplace, pursuits, events: exactly the feed-shape this prompt says the
   directory must NOT be. Two surfaces cannot hold one name. The work here is
   a shop directory within the consumer entry, decided against the existing
   tab structure — not a rename that unmounts or orphans 2,415 lines.

3. **`shopId` parent — refused, and the refusal stands.** The first
   non-negotiable ("a real `shopId` parent") was decided in the Shop Brief
   build: no new entity, **the vendor is the parent** — and the name "shop" is
   already taken by `domain/shop.js`, the WhatsApp shop builder. The
   non-negotiable re-keys to what the rows actually carry:
   `SPACE_VISIBILITY = ['private', 'unlisted', 'public']` (`space.js:37`),
   which is what the directory already enforces —
   `GET /api/public/spaces` (`routes/spaces.js:120`) returns every public,
   active space, no session, safe projection, with the modes taxonomy attached
   "so a directory can render the arms it can filter by… An empty directory
   still gets the taxonomy, because the reason it is empty is not a missing
   category."

4. **The verified ✓ badge has no row behind it.** `verification.js` is
   *person* verification (email / phone / identity) feeding compliance gates —
   there is no shop-verification row anywhere. The status pill on the public
   page is derived from the owner's own stated hours, not from any review. A
   card must not print a ✓; if verification for businesses is wanted, it is a
   separate flow with its own rows, built first.

5. **The 8-category table is a second taxonomy; the repo already has one.**
   `SPACE_MODES` (retail, services, …) is the arms-of-one-business vocabulary,
   sent *with* the directory response precisely so the client imports it
   rather than copying it. A hardcoded Food/Groceries/Beauty table in the
   client is how two taxonomies drift. If a consumer-facing grouping is
   wanted, it is a mapping *over* the server's modes, declared once, on the
   server.

6. **"Open now" — already derived, in EAT, with the honest unstated state.**
   `spacePublicPage.js` does the opening-hours arithmetic in East Africa time
   with the assumption documented in the file (`:37`), refuses to say "open"
   when hours aren't stated (`:108` — `reason: 'no hours stated'`), and the
   page states plainly: "No 'open now' unless their own hours answer" (`:20`).
   The card must reuse this projection — never compute a second, more
   optimistic one client-side.

7. **Distance — the engine is built and tested; the coordinates mostly don't
   exist.** `/api/nearby` (`routes/graph.js:62`) does haversine over
   *genuinely stored* coordinates only, rounded to 1 decimal, radius capped,
   with `?area=` resolving a centroid from objects that genuinely carry
   coordinates and honest `{ available: false, reason }` otherwise
   (`graph.js:468-502`). `graph.mjs` holds the tests: coordinates-less,
   expired and private objects never enter nearby; distances are real
   kilometres. But **spaces carry text locations, not coordinates** — so a
   shop directory applying the prompt's own rule ("never fabricate a
   distance") prints `—` on nearly every card today. That is the honest
   result, and the doc says so: real distances require owner-supplied
   coordinates on the space row, built before any "0.3 km" prints.

8. **The WhatsApp template — the repo never types a message the seller didn't
   set.** The de-fictioned Discover says it outright: "'message on WhatsApp'
   appears only when the seller put that contact on their own listing — it is
   never defaulted, never looked up, never typed in by us." The public page's
   CTA is built from owner-supplied digits and the owner's own pre-fill
   (`spacePublicPage.js:165`, `:401`), with the hide-the-digits trade-off
   documented. The prompt's fixed template ("Hi \<shop name\> — I found you on
   Trace… https://trace.africa/s/\<handle\>") is a mockup and, as a
   default, contradicts that rule. The action fallback is already the
   pattern: no digits → no WhatsApp button, the page/card links to the shop
   instead.

9. **"Invite a shop" — decide it against `referrals.js`, not beside it.** A
   referral rail already exists, built as the anti-pyramid: one level deep,
   points earned from real deduplicated events, convertible only from a pool
   derived from confirmed revenue, refused with a reason when the pool is
   empty. The prompt's invite loop says "No points, no cash. The reward is
   the shop exists." A no-reward invite link is buildable and honest — but it
   must be a deliberate decision recorded against the existing rail, not a
   second, parallel referral scheme.

10. **Mockups are mockups.** `Testshop ✓ 0.3 km`, `🍲 Meals · KES 150`,
    `Kikao Hardware`, the neighbourhood pick-list, and `47 people viewed`-style
    engagement are shape, not rows. The house rules already ban the last one
    (`space.js:321` — "no engagement rate is derived from it"; views are page
    opens, owner excluded). The category-plate fallback for photo-less cards
    is kept — it is on the keep-list of two earlier prompts and exists.

---

## The prompt's test requirements, audited

| Required by the prompt | Where it stands |
| --- | --- |
| 5 shops sort correctly by distance | the engine does — `graph.mjs` (genuine coords, real haversine, stable sort); **not yet over spaces** (no coordinates on space rows) |
| a shop with no coordinates never shows a fake distance | held — `graph.mjs` ("objects without coordinates never enter nearby"); a directory card prints `—` |
| category filter narrows to matching shops | partially — `/api/public/spaces?mode=` filters server-side with the taxonomy attached; the client card list is not built |
| empty state when nothing matches | held in spirit — taxonomy-with-empty on the directory, `Browse the board` on Discover; the card empty-states are new |
| geolocation denial falls back to a chosen area | held at the seams — `useSessionLocation` degrades gracefully (`useSessionLocation.ts:83-89`), `/api/nearby?area=` resolves a derived centroid honestly |
| WhatsApp link carries the correct pre-fill | held for owner-set contact (`spacePublicPage.js:165`); the fixed default template is refused (correction 8) |
| no phone → "View shop", never a broken button | held as the pattern on the public page and de-fictioned feed cards |
| saved shops persist across sessions | My Layer holds saved objects and bundles; **saved spaces specifically** are new |
| renders with 0, 1 and 50 shops | the API is paginated (`limit`, default 50) and empty-safe; the screen that renders it is the work |

## What is genuinely new here

The shop-card directory on the consumer entry — one card per public space:
name, mode, hours-derived pill, the newest live offer if any, one action ·
owner-supplied coordinates on the space row, so distance can one day be real
instead of `—` · saved *spaces* syncing into My Layer · the invite-a-shop
link, decided against `referrals.js`. The seams under all four are standing
and tested; what this prompt adds is the surface, two honest fields, and one
product decision.

---

## The prompt, as received (verbatim)

What follows is the prompt exactly as it was received — unedited, including
the removals that already shipped and the collisions above. It is kept so the
corrections can be checked against the ask, and so no future builder has to
trust a paraphrase.

````markdown
# Trace — The Nearby Surface (Builder Prompt)

You are building the Nearby surface: the consumer's entry point
into Trace. It is not a feed. It is not a marketplace. It is a
list of shops that physically exist near the user, sorted by
distance, with one action each.

This is the surface that makes the B2C side of Trace real. It
is what a resident opens when they want something and don't
know where to get it.

## The problem it solves

A person in Kilimani needs a plumber, a meal, or a delivery.
They ask the estate WhatsApp group. Three people reply. Two of
them are wrong. One knows a guy. Nobody writes it down. Two
weeks later, the same question. Same loop.

The Nearby surface breaks the loop. Every shop a resident has
ever registered on Trace is here, sorted by distance, with a
verified status and a one-tap "Chat on WhatsApp." Every shop
that another resident has used is discoverable without asking.

## What you are building (and what you are NOT)

You are building:
- A "shops near me" screen that replaces the current Discover
  flow-card mess
- Category filters as a 2-column icon grid (not the current 7
  chips that duplicate the side menu)
- One card per shop: name, category, distance, status, one
  offer preview, one action
- A saved-shops list that syncs to My Layer
- Search that matches name, category, and location
- A "near me" hint that uses the browser's geolocation ONCE
  on first visit, then remembers, and can be reset

You are NOT building:
- A feed of posts
- Ratings or reviews (no rows back them yet)
- Promoted or sponsored shops
- "Recommended for you" algorithms
- Any "trending" or "popular" sort
- Any number that isn't a real row
- Any engagement metric (no "47 people viewed")

The Nearby surface is a directory, not a product feed.

## Non-negotiables

- Every shop listed must have a real row in `spaces` with a
  real `shopId` parent and `public` visibility.
- Distance is computed from the user's geolocation to the shop's
  location, in kilometres, rounded to 1 decimal. If either is
  missing, distance is `—`, not `0`.
- "Open now" is derived from the shop's hours, checked against
  East Africa Time. If hours aren't stated, status is
  "Hours not verified," not "Open."
- If a shop has no photo and no offers, the card shows a
  category plate. No stock photos. No empty rectangles.
- Sorting is distance, then freshness of last update. Nothing
  else. No "promoted first."
- The screen must work with zero shops. It shows an honest empty
  state, not filler.

## The three layers of the surface

### Layer 1 — Nearby (default)

The user opens Nearby. They see shops sorted by distance.

```
┌─────────────────────────────────────┐
│  Nearby                             │
│  Kilimani                           │
│                                     │
│  [All] [Food] [Goods] [Services]    │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  Testshop ✓                0.3 km   │
│  Food · ● Open now                  │
│  🍲 Meals · KES 150                 │
│  [Chat on WhatsApp →]               │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  Kikao Hardware            0.8 km   │
│  Goods · ● Open now                 │
│  🔌 Portable Solar 50W · KES 18,500 │
│  [Chat on WhatsApp →]               │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  ...more shops                      │
│                                     │
└─────────────────────────────────────┘
```

Each card:
- **Name** + optional ✓ (verified badge)
- **Category** + status pill
- **Distance** in km, right-aligned
- **One offer preview** (the newest live offer, if any)
- **One action**: "Chat on WhatsApp →" or "View shop →" if no
  WhatsApp number

Tap the card → opens the shop's public page.
Tap the action → opens WhatsApp with a pre-filled message.

### Layer 2 — Category filter

Tapping "Food" filters to food shops only. Same layout, fewer
cards. The filter is client-side; no new API call.

Category definitions (match the shop.category field):

| Category | Icon | What it covers |
|---|---|---|
| Food | 🍲 | Cooked food, restaurants, cafés |
| Groceries | 🛒 | Fresh produce, butchers, bakeries |
| Goods | 📦 | Hardware, electronics, clothing |
| Services | 🔧 | Repairs, plumbing, cleaning, tutoring |
| Health | 💊 | Pharmacies, clinics, wellness |
| Beauty | 💇 | Salons, barbers, spas |
| Delivery | 🛵 | Riders, couriers |
| Other | 🏪 | Anything not fitting above |

### Layer 3 — Search

Tapping the search bar in the header opens a text input. Search
matches:
- Shop name (fuzzy)
- Category
- Location (neighbourhood, street)

No "recommended" results. No sponsored. Just matches, sorted by
distance.

## The three empty states

### Empty state 1 — No shops nearby at all

```
┌─────────────────────────────────────┐
│                                     │
│              🏪                     │
│                                     │
│  No shops registered near you yet.  │
│                                     │
│  Know a shop that should be here?   │
│                                     │
│  [ Invite a shop ]                  │
│                                     │
└─────────────────────────────────────┘
```

"Invite a shop" opens a form. The form generates a link the
user can WhatsApp to the shop owner. When the owner registers,
they appear in the user's Nearby.

This is the referral loop. No points, no cash. The reward is
the shop exists.

### Empty state 2 — No shops in the selected category

```
┌─────────────────────────────────────┐
│                                     │
│              🍲                     │
│                                     │
│  No food shops near you yet.        │
│                                     │
│  [ Show all shops ]                 │
│                                     │
└─────────────────────────────────────┘
```

Never "no results found." Always a way forward.

### Empty state 3 — Geolocation denied

```
┌─────────────────────────────────────┐
│                                     │
│              📍                     │
│                                     │
│  We don't know where you are.       │
│                                     │
│  Set your area to see shops near    │
│  you:                               │
│                                     │
│  [ Kilimani ]                       │
│  [ Westlands ]                      │
│  [ Kileleshwa ]                     │
│  [ Other — type it ]                │
│                                     │
└─────────────────────────────────────┘
```

If the user denies geolocation, they pick a neighbourhood.
Distance is then calculated from the neighbourhood centroid to
each shop. Honest about the approximation.

## What to remove from the current Discover

The current Discover has:

- **4 flow cards** (Bulk/Direct/Niche/Group) with `0 NONE HERE`
  on each — **remove**. They belong on a Marketplace sub-screen,
  not the consumer entry point.
- **7 top chips** (Bulk/Direct/Niche/Group/Events/Circles/Errands)
  that duplicate the side menu — **remove**. Replace with the
  4-6 category chips above.
- **Duplicate navigation** between chips and side menu —
  **remove the chips**. Keep the side menu.
- **"All →" chip** — **remove**. It goes nowhere useful.

The new Discover (renamed to Nearby) has:
- One title: "Nearby"
- One location: current area
- Category chips: All + 6 categories (single row, scrollable)
- Shop cards: one per shop
- Empty state if none
- Search in the header

That's the whole screen.

## What to keep from the current Discover

- The header (with search icon)
- The bottom nav
- The user's area selector (already works)
- The category plate pattern (for shops without photos)

Everything else gets deleted in this commit.

## The WhatsApp link

Every shop card has one action: "Chat on WhatsApp →"

If the shop has a phone number:

```
https://wa.me/<number>?text=<encoded message>
```

Message template:
```
Hi <shop name> — I found you on Trace.
I want to ask about: <latest offer name or "what you have available">
https://trace.africa/s/<handle>
```

If the shop has no phone number:
- Action becomes "View shop →"
- Opens the shop's public page
- The public page says "No contact number — inquiries reach their Trace inbox"

Never show a fake WhatsApp button. Never open WhatsApp to a
number that doesn't exist.

## The saved-shops list

Tapping "Save" on any shop card adds it to a personal list. This
list appears in:
- A "Saved" section below the main Nearby list (collapsed by
  default)
- The "Saved" tab in My Layer

The list has no ranking. It's chronological (most recently
saved first). The user can reorder or remove.

**Saved is not engagement.** No "you saved 47 shops, keep going!"
No badges. Just a list.

## The distance calculation

Server-side or client-side? **Client-side, once.**

On first visit:
1. Ask for geolocation permission
2. If granted, store `{ lat, lng }` in local storage
3. Compute distance to each shop's coordinates
4. Sort by distance

If geolocation is denied:
1. Ask for a neighbourhood
2. Store the neighbourhood name
3. Server returns shops filtered by that neighbourhood
4. Sort by the shop's `distanceKm` field if set, else
   alphabetically by name

If neither:
1. Show all shops with `public` visibility
2. Sort by last updated (newest first)
3. Show "Set your area for distances" banner at the top

**Never fabricate a distance.** If you don't have coordinates
for the shop, don't show a distance for it.

## The test requirements

- A Nearby list with 5 shops sorts correctly by distance.
- A shop with no coordinates appears at the end (never at the
  top with a fake distance).
- Category filter narrows results to matching shops only.
- Empty state appears when no shops match.
- Geolocation denial falls back to neighbourhood selection.
- The WhatsApp link includes the correct pre-filled message.
- A shop with no phone number shows "View shop →" not a broken
  WhatsApp button.
- Saved shops persist across sessions.
- The screen renders with 0 shops, 1 shop, and 50 shops.

## What to watch for

- **Don't hardcode shop names.** The list must be dynamic.
- **Don't add a "featured" or "top" row.** Every shop is equal.
- **Don't show views, saves, or click counts.** Not yet.
- **Don't sort by anything other than distance.** Not by
  category, not by activity, not by any score.
- **Don't add infinite scroll.** Paginate if 100+ shops; show
  a "Load more" button.

## The one rule

The Nearby surface is a directory of real shops. Not a feed.
Not a marketplace. Not a recommendation engine. It lists what
exists, sorted by how close it is, with one action per row.

If a shop doesn't exist in the database, it doesn't appear.
If a distance isn't known, it doesn't print. If a status isn't
verifiable, it says so.

The surface is the truth of what's nearby.

## Order of operations

1. Rename Discover → Nearby. Delete the 4 flow cards. Delete
   the 7 duplicate chips.
2. Build the category chip row (6 chips + "All").
3. Build the shop card. It's the same shape as the public
   page's hero card.
4. Wire the geolocation prompt and fallback.
5. Build the WhatsApp link with the pre-filled message.
6. Build the empty states.
7. Build the saved-shops list.
8. Ship. Test with 1 real shop and confirm it appears.

## Reference

The public page shows one shop in full.
The Nearby surface shows many shops in brief.
The action is the same: chat on WhatsApp.

This is the front door for every consumer who opens Trace.

## What this unblocks

- The consumer has a reason to open the app. (Before: empty
  Discover. After: shops near me.)
- The shop owner sees real value in registering. (Before: an
  isolated page. After: appearing in nearby lists.)
- The B2B pitch has proof. ("Your shop appears in every
  resident's Nearby list within 5km.")
- The referral loop has an entry. ("Invite a shop → they
  register → they appear in your list.")
- The B2C funnel has a first screen. (Before: nothing. After:
  the shops.)

Build this. Ship it this week. Then everything downstream —
Shop Brief, Settlement Rail, Shopping Runs — has a consumer
surface to land on.
````

---

## Operator's note (received with the prompt, outside it)

> Every prompt so far has been **building the shop-side**:
>
> - Shop Brief → for owners
> - Settlement Rail → for money
> - Shopping Run Stream → for coordination
> - Public page reform → for one shop at a time
>
> But **no prompt yet has answered: "How does a consumer find a shop?"**
>
> The Nearby surface is the answer. It's the consumer's front door. Without
> it:
>
> - Shops exist but nobody finds them
> - Public pages exist but nobody visits them
> - The marketplace is empty because nothing is discoverable
>
> **Build Nearby next.** It's the missing consumer surface that makes
> everything else pay off.
>
> Tell me when it's live and I'll help wire the first real referral — one
> user inviting one shop that then appears in the user's Nearby list.
> That's the loop that proves the model works.

The door is mostly hung: the directory API, the distance engine and the
public page exist and are tested. What remains is the card list, the
coordinates that would make a distance true, and the invite link — built
on the seams that exist, under a name that doesn't collide with the
screen already holding this one.
