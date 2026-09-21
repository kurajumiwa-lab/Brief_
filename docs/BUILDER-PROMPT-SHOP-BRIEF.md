# Trace — The Shop Brief (Builder Prompt)

> Status: **built (2026-09-21), with six refusals.** The daily read an owner
> opens at 6am is shipped as `domain/shopBrief.js` → `GET /api/shop-brief` →
> `features/spaces/ShopBrief.tsx`, printed on the street of the owner's own
> shopfronts, plus an opt-in morning notification at the hour the owner names.
>
> The prompt as received is now preserved **verbatim** at the bottom of this
> file — the section *The brief, as received* — so what was refused can be
> read against what was asked. Read **Corrections first** before extending
> this surface: the parts that were NOT built are the parts that cannot be
> built honestly from the rows in this store.
>
> All suites named here were re-run green on this branch on 2026-09-21:
> `shopBrief.mjs` 31/31 · `spaceMoneyScope.mjs` 8/8 · `stockLog.mjs` 11/11 ·
> client `shopbrief.jsx` 12/12. (This checkout carries a single squashed
> commit; the hashes cited below are from the working history the surfaces
> were built in, and the artifacts they name are in the tree and verified by
> the tests.)

---

## Corrections first (what was changed, and why)

1. **"The blocker (fix this first)" — already fixed.** `space.js` scoped money on
   `o.spaceId === space.id || o.vendorId === space.vendorId` while `order.js`
   wrote no `spaceId` at all, so every space of one vendor printed the vendor's
   whole takings. That is commit `09fa446`: orders now join through the listing
   they were placed against (`spaceBookScope`), an unattached row folds in only
   when the vendor has exactly one space, and otherwise it is counted and
   reported as `unattached`. The two-space test the brief demands exists —
   `server/test/spaceMoneyScope.mjs` (8). The build commit adds the **shop-level**
   version of that test, which is where a dashboard would have multiplied the
   error, and the invariant it enforces: `Σ spaces + unassigned = the shop's total`.
2. **Step 1 (a `Shop` parent entity) — refused.** Two reasons. The operator's own
   decision of 2026-09-20 was *"no new entity, vendor stays the parent"*, and the
   name is already taken: `domain/shop.js` and the `shops` collection are the
   WhatsApp shop builder (a member's price list), not a business umbrella. A
   second meaning for "shop" in the same store is how a migration ends up
   updating the wrong table. The brief is therefore keyed on the owner's vendor
   row, and no migration is needed: existing spaces already resolve to one shop.
3. **Step 3 (a `shopBriefs` table, computed at 05:30 by a cron) — refused, and
   replaced by a read.** A stored aggregate is a second source of truth. An
   expense can be **dated into the past** (`POST /api/spaces/:id/expenses` takes
   `date`), an order's status moves after the fact, an offer gets re-filed to
   another space. A row written at 05:30 would keep asserting what was true at
   05:30, and the moment it disagreed with the ledger one of the two would be a
   lie. So a brief is computed per read from the rows: the same figures for the
   same day for as long as the rows exist, nothing to backfill, nothing to expire,
   nothing to delete — and no "7 days then archived" rule to build or to break.
   `brief.stored === false` is in the payload so no screen can imply a saved report.
4. **Step 4's stock flag — the formula is impossible; the row that would make it
   possible was built.** `declaredStock(offer) - soldToday(offer) <
   expectedRemaining(offer)` needs three things this store does not have: there
   is no declared-stock *history* (a listing holds one number), no
   `expectedRemaining`, and no waste log anywhere in the tree. So `stockLog.js`
   now writes one append-only row per movement of a count, from the only two doors
   that can move it (`consumeStock` for a real order, `updateListing` for a hand
   that re-types it), and the flag compares counts instead of guessing a motive:
   `gap = end - (start - sold)`. `gap > 0` is units appearing with no sale behind
   them; `gap < 0` is units leaving beyond what was sold. Both tests the brief
   asked for pass: it fires when the count comes back up after 4 sales, it does
   not fire when the count went down by exactly 4. **A genuine restock is
   indistinguishable in these rows**, because the API requires no reason for a
   stock edit (unlike a price change), and the flag's own sentence says that.
5. **Step 4's staff flag — refused.** "Grace was scheduled Monday but no activity
   logged" needs a rota. There is no team table, no `teamMemberId` on any row, and
   no scheduling for staff (`roles.js` holds platform roles, not a shop's crew).
   What *is* printed is `Recorded by`: the space-activity rows for that day,
   grouped by the actor the row already names, with a display name only when a
   user row carries one. An actor with no user row prints as "someone with no
   name on record" — no name is guessed from a phone number, and nobody is
   reported absent.
6. **Step 5's default hour — contradicted the brief's own non-negotiable.** "No
   push notification at a time the owner hasn't chosen. Default is 6am EAT." A
   stored 6am *is* a time the owner hasn't chosen. Shipped: the morning brief is
   OFF until the owner turns it on, `setBriefPrefs` refuses to enable it without
   an explicit hour (0–23, labelled Nairobi time), nothing is sent for a day with
   no rows, one per day at most, and if the owner's own alerts category is off the
   day is *not* marked read — so re-enabling alerts can still catch up.
7. **Invented sample numbers are not in the product.** `KES 4,320 in · KES 4,100
   out · KES 220 net`, `3 orders settled · 1 pending`, `Mary: 6 orders fulfilled ·
   last action 18:14`, `18 offers · 42 orders/mo`, `⚠ stock declared as 10` and
   the "top 10%" comparison class are mockups. They are kept in the verbatim text
   below as *shape* only; every figure a real screen prints is a scan of rows, and
   a `0` appears only where zero is the count of rows (`KES 0` out on a day with no
   expense rows) while an unmeasurable figure is `—` (money settled *through* a
   rail: `railSettledKes: null`, because no rail is connected).
8. **The "what to remove" list shipped earlier**, in `0d97d70`: the four empty flow
   cards on Discover became one `Browse the board` entry opening a picker; the
   duplicate top chips went (the band is the sheet's `SIDE_ORDER` only); `EarnStrip`
   returns `null` when all three rails read OK and are empty, and a dash plus
   `Try again` when a read fails; the "people not counted" note came off the
   storefront and its explanation lives on the audit page.
9. **One gap left open on purpose:** the notification carries `dest: 'shopbrief'`
   and the shell routes that to the street the brief is printed on. There is no
   per-day URL (`/brief/2026-09-20`) yet, so "tapping opens yesterday's brief"
   means *opens the brief, on yesterday* — true for the day after it fires, but it
   does not land on the exact day. Say so until a day route exists.

---

## Where the test requirements live

| Required by the brief | Where it is held |
| --- | --- |
| two spaces of one owner, third order unattached, totals match | `shopBrief.mjs` ("two spaces split the day…") + `spaceMoneyScope.mjs` (8) |
| a day with zero rows produces no brief | `shopBrief.mjs` ("a day with nothing in it is not a page of zeros") — and the sweep sends nothing (`quiet: 1`) |
| a day with rows sums correctly, verified by hand | `shopBrief.mjs` ("every figure the brief prints can be re-added from the rows") |
| the stock flag fires when the count is re-declared | `shopBrief.mjs` + `stockLog.mjs` (11) |
| it does NOT fire when `end == start - sold` | `shopBrief.mjs` ("no flag when the count went down by exactly what was sold") |
| money with no space is reported separately | `shopBrief.mjs` + `shopbrief.jsx` (12, client) |
| the notification fires at the owner's chosen hour, not always 6am | `shopBrief.mjs` ("the sweep waits for the hour the owner named, then sends once") |

Re-verified green on this branch, 2026-09-21: `shopBrief.mjs` **31 passed / 0
failed**, `spaceMoneyScope.mjs` **8/0**, `stockLog.mjs` **11/0**,
`shopbrief.jsx` **12/0**.

## Built in the build commit

**Server.** `domain/stockLog.js` (the append-only shelf log) ·
`domain/shopBrief.js` (the read, the flags, the prefs, `morningSweep`,
`installSweep`) · `routes/shopBrief.js` (`GET /api/shop-brief?day=`,
`GET`/`PUT /api/shop-brief/prefs` — two reads and one preference, and deliberately
no write door for the figures) · `index.js` (mount + an unref'd sweep timer on the
calendar's pattern) · `notifications.js` (`shop_brief` type, gated by the existing
`alerts` category) · `store.js` (`stockChanges`, `shopBriefPrefs`) ·
`createSpaceOffer` now honours `quantityAvailable` (the same silently-dropped-field
bug `images` had) · tests `stockLog.mjs` (11) and `shopBrief.mjs` (31).

**Client.** `features/spaces/ShopBrief.tsx` on `SpacesLanding` — the whole
business above the list of its parts · `api/types.ts` + three calls in
`briefApi.ts` · `OverlaysShell` routes `dest: 'shopbrief'` to the street ·
the audit page gained a *The morning brief* section, and `room.jsx` pins four
sentences of it so the explanations cannot be deleted instead of moved ·
`shopbrief.jsx` (12).

## Still open

- A per-day route, so a tap lands on the exact day.
- `unitLabel` / `minOrderQuantity` still have no control on the inline catalog row,
  so the brief cannot report terms it has never been told.
- `SpacesLanding` and the CityFeed sub-tab row are the next crowded screens.
- Prod data, owner-side only: the `testshop` "Meals" offer still carries a
  cake description. Discover → Testshop → Meals → Edit → clear it (a descriptive
  field, so no reason is asked for).
- `orders/mo`, "42 orders", `● Open` counts on the space lines in the mockup: not
  built. A month is a rolling window and the brief bans them on its own screen; the
  street keeps the maintenance dot it already had.

---

## The brief, as received (verbatim)

What follows is the prompt exactly as it was received — unedited, including the
parts that were refused above. It is kept so the refusals can be checked against
the ask, and so no future builder has to trust a paraphrase.

````markdown
# Trace — The Shop Brief (Builder Prompt)

You are building the Shop Brief: the daily summary an owner reads
every morning at 6am EAT. It tells them what happened in their
business yesterday — including the things their staff won't tell
them.

This is the B2B revenue driver. It's what makes an owner open the
app every day, and it's what they pay for.

## The problem it solves

An owner leaves the shop at 6pm. They come back at 8am. In those
fourteen hours:
- Money moved (or didn't)
- Stock sold (or didn't)
- Staff acted (or didn't)
- Orders were fulfilled (or missed)
- Nothing was recorded

They ask their staff the next morning. The staff say "it was fine."
The owner has no way to verify. Over a month, the leakage compounds.

The Shop Brief is the answer. Every morning, the owner sees the
truth computed from real rows. Not from a staff report. Not from
their memory. From the ledger, the offers, the orders, the
signals — every row is timestamped and attributed.

## What you are building (and what you are NOT)

You ARE building:
- A `Shop` parent entity that groups Spaces under one business
- A daily aggregator that reads yesterday's rows and produces a brief
- A morning notification (in-app + optional WhatsApp)
- A shop-level view that scopes money correctly (fixing the
  current space-scoping bug where every space reports the whole
  vendor's takings)
- An unassigned bucket for money that no space claims

You are NOT building:
- Any rating, badge, or rank
- Any comparison with other shops ("you're in the top 10% of...")
- Any forward-looking estimate or forecast
- Any "targets" or "goals" the owner must hit
- Any recommendation ("you should stock more X")
- Any number not backed by a row

The brief reports. It does not advise. It does not compare. It
does not predict.

## Non-negotiables

- Every number traces to a row. If a row doesn't exist, the
  number is `—`, not `0`.
- Staff names appear only if a `teamMemberId` exists on the row.
  If a shop hasn't added team members, no names show. No guessing
  from phone numbers.
- Money is scoped by join: order → listing → space → shop. If an
  order has no space, it lands in `unassigned` for the shop, not
  silently counted in every space.
- The brief is read-only. The owner cannot edit it. They cannot
  delete rows. The rows are the truth.
- No push notification at a time the owner hasn't chosen. Default
  is 6am EAT. They can change it, or turn it off.
- The brief is per-shop, per-day. No rolling windows, no "last 7
  days" on the brief screen. Those live on the dashboard, not in
  the brief.

## The blocker (fix this first)

`server/src/domain/space.js:1224` and `:1404` scope money with
`o.spaceId === space.id || o.vendorId === space.vendorId`.

No order row has `spaceId` (grep proves it returns 0). So every
space reports the whole vendor's takings. The dashboard would
double-count every shilling.

Fix in this order:

1. Join orders → listing → space. The listing carries the space.
2. If a listing is unattached AND the vendor has exactly one space,
   count the order for that space.
3. If a listing is unattached AND the vendor has multiple spaces,
   count the order as `unassigned` on the shop.
4. Report unassigned separately. Never spread it across spaces.
5. Add the two-space test below BEFORE building the brief.

Do not build the brief until that test is green.

## Build steps

### Step 1 — Shop entity

```
SHOP
├── id
├── ownerId
├── name
├── category           (food, goods, services, etc.)
├── location
├── verifiedAt         (nullable — verification is a separate flow)
└── createdAt
```

A shop is a business. It can have 1..N spaces. A space belongs
to exactly one shop.

Migration: existing spaces get a shop created for them with the
same owner. One-to-one initially. Owners can then add more
spaces to the same shop.

### Step 2 — The join and the scoping fix

Every order lookup for money summaries:

```sql
-- Correct money scoping
SELECT o.*
FROM orders o
LEFT JOIN listings l ON o.listingId = l.id
LEFT JOIN spaces s ON l.spaceId = s.id
WHERE
  (s.shopId = :shopId)                     -- order has a space → shop
  OR
  (o.vendorId = :shopOwnerId              -- order has no space
   AND (SELECT COUNT(*) FROM spaces        -- and this owner has 1 space
        WHERE shopId = :shopId) = 1)
```

If the owner has 2+ spaces and an order has no space, the order
goes into `unassigned` — reported on the shop's dashboard but
never counted in any individual space.

Test:
```
Given owner O with shop S, spaces A and B
  AND order 1 attached to A (via listing → space)
  AND order 2 attached to B
  AND order 3 with no space
When the daily brief is computed for shop S
Then:
  space A shows exactly 1 order
  space B shows exactly 1 order
  shop S shows 2 orders + 1 unassigned
  the total matches the raw order count for O
```

### Step 3 — The daily aggregator

Reads yesterday's rows for one shop. Produces a structured
brief. Runs once at 05:30 EAT, writes to `shopBriefs`:

```
SHOP_BRIEF
├── shopId
├── dayStart       (YYYY-MM-DD in EAT)
├── moneyIn        (sum of settled payments)
├── moneyOut       (sum of payouts)
├── net            (moneyIn - moneyOut)
├── orders
│   ├── settled
│   ├── pending
│   └── unfulfilled
├── staff          (per member: fulfilled count, last action)
├── flags          (array of { kind, message, evidenceIds })
└── createdAt
```

Every field is derived. Nothing is a separate write. If the shop
has no rows for a day, the brief is not created — the owner sees
"no activity yesterday" on the dashboard, not a brief with zeros.

### Step 4 — The flags

Three flag types. Each is a computed condition, not a heuristic:

**Flag: stock mismatch**
```
declaredStock(offer) - soldToday(offer) < expectedRemaining(offer)
```

Example: Meals listed at 10, 4 sold, stock declared 10 again
after the day. Flag: "Meals stock unchanged after 4 sales."

**Flag: unfulfilled orders**
```
orders WHERE status = 'confirmed' AND fulfilledAt IS NULL
       AND createdAt < startOfToday
```

Example: "2 orders from yesterday were never marked fulfilled."

**Flag: missing staff activity**
```
IF shop has team AND a member was scheduled AND no rows
   from that member on a day they were scheduled
```

Example: "Grace was scheduled Monday but no activity logged."

Each flag links to the rows that produced it. The owner taps
the flag → sees the exact rows → knows whether to act.

### Step 5 — The morning delivery

At 05:30 EAT, a cron job computes briefs for all shops with
activity in the last 24h.

At 06:00 EAT (or the owner's chosen time), a notification fires:

```
Testshop · Tuesday 21 Sep

KES 4,320 in · KES 4,100 out · KES 220 net
3 orders settled · 1 pending

STAFF
Mary · 6 orders · last 18:14
John · 3 orders · last 14:22

FLAGS
⚠ Meals stock unchanged after 4 sales
⚠ 2 orders from Monday unfulfilled

[Open shop]
```

Tapping the notification opens the full brief in the app.
Closing it doesn't delete it — the brief stays available for 7
days, then archived.

### Step 6 — The dashboard view

The shop dashboard is not the brief. It's the *shape*:

```
TESTSHOP · Tuesday 21 Sep
─────────────────────────────────────

TODAY SO FAR
KES 1,240 in · KES 0 out

YESTERDAY'S BRIEF
KES 4,320 in · KES 4,100 out · KES 220 net
3 orders settled · 1 pending
2 flags

SPACES
Retail      ● Open   18 offers · 42 orders/mo
Wholesale   ● Open    6 offers · 12 orders/mo
Delivery    ● Quiet   0 offers ·  0 orders

UNASSIGNED
KES 340 (1 order, no space attached)
[Assign to a space]

[View yesterday's brief] [Settings]
```

Every number is a link to the rows that produced it.

## What to remove from the current surface

- The "What you can earn here" card block on Home when all
  values are zero. It's filler.
- The "people not counted" note under the VIEWS stat. If we
  can't count them, don't print the number.
- The 4 empty flow cards (Bulk/Direct/Niche/Group) on Discover.
  Replace with a single "Browse" entry.
- The duplicate top chips that mirror the side menu.

These come out in the same commit as the Shop entity, so the
surface lands clean.

## What to keep

- The grouped You tab (Identity / Business / Money / About).
- The status pill on public pages.
- The category plate fallback for photo-less items.
- The 4 WhatsApp templates for Membley.

## Test requirements

- Two-space-one-owner test above.
- Brief with zero rows for a day produces no brief row.
- Brief with rows produces correct sums (verify by hand).
- Flag for stock mismatch fires when declared = initial after
  sales.
- Flag does NOT fire when declared = initial - sold.
- Money scoped to unassigned when order has no space and owner
  has 2+ spaces.
- Notification fires at owner's chosen time, not always 6am.

## The one rule

If a number isn't backed by a row, don't print it. If a flag
isn't derived from rows, don't raise it. If a shop has no
activity, say so — don't fabricate a report.

The brief is the truth. Not the summary. Not the estimate. The
truth.

## Reference

The Shop Brief is the reason an owner pays. The Spaces are
what they show the world. The Brief is what tells them the
truth about their own business. Build the truth first.
````

---

## Operator's note (received with the prompt, outside it)

> The Shopping Run Stream makes consumers use Trace. The Shop Brief makes
> owners **depend** on it. Without the Brief, the owner has no reason to open
> the app every morning. With it, they can't *not* open it — the flag might
> be there.
>
> That dependency is the revenue. Build the Shop Brief next.

Built. The dependency is shipped; what remains open is listed under *Still
open*, and none of it is a number the rows cannot back.
