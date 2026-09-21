# Trace — The Shop Brief (Builder Prompt)

> Status: **built (2026-09-21), with six refusals.** The daily read an owner
> opens at 6am is shipped as `domain/shopBrief.js` → `GET /api/shop-brief` →
> `features/spaces/ShopBrief.tsx`, printed on the street of the owner's own
> shopfronts, plus an opt-in morning notification at the hour the owner names.
>
> The "blocker" this brief opens with was fixed three commits earlier, and four
> of its six build steps describe arithmetic or entities this repo does not have.
> Read **Corrections** before extending this surface — the parts that were NOT
> built are the parts that cannot be built honestly from the rows in this store.

---

## Corrections first (what was changed, and why)

1. **"The blocker (fix this first)" — already fixed.** `space.js` scoped money on
   `o.spaceId === space.id || o.vendorId === space.vendorId` while `order.js`
   wrote no `spaceId` at all, so every space of one vendor printed the vendor's
   whole takings. That is commit `09fa446`: orders now join through the listing
   they were placed against (`spaceBookScope`), an unattached row folds in only
   when the vendor has exactly one space, and otherwise it is counted and
   reported as `unattached`. The two-space test the brief demands exists —
   `server/test/spaceMoneyScope.mjs` (8). This commit adds the **shop-level**
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
   the "top 10%" comparison class are mockups. They are kept in the brief text
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

## The brief, as received

You are building the Shop Brief: the daily summary an owner reads every morning at
6am EAT. It tells them what happened in their business yesterday — including the
things their staff won't tell them.

### The problem it solves

An owner leaves the shop at 6pm and comes back at 8am. In those fourteen hours
money moved (or didn't), stock sold (or didn't), staff acted (or didn't), orders
were fulfilled (or missed) — and nothing was recorded. They ask their staff the
next morning; the staff say "it was fine." The Shop Brief is the answer computed
from the ledger, the offers, the orders and the signals, where every row is
timestamped and attributed.

### What it is not

No rating, badge or rank. No comparison with other shops. No forward-looking
estimate. No targets. No recommendation. No number that is not backed by a row.
The brief reports; it does not advise, compare or predict.

### Non-negotiables

- Every number traces to a row. If a row doesn't exist, the number is `—`, not `0`.
- Names appear only if the row carries an actor and a user row carries a name.
- Money is scoped by join: order → listing → space → shop. An order with no space
  lands in the shop's unclaimed bucket, never silently in every space.
- The brief is read-only. The owner cannot edit it or delete the rows.
- No notification at a time the owner hasn't chosen.
- The brief is per-shop, per-day. Rolling windows live elsewhere, not on it.

### The notification, as shipped

```
Testshop · Sun, 20 Sept

KES 5,340 in · KES 0 out · KES 5,340 net
3 marked in · 1 still open
KES 340 belongs to no space
2 flags to read
```

Every line above is produced by `briefNotificationText(brief)` from the same scan
the screen reads — the suite asserts the notification body equals the brief's own
text, so a paraphrase cannot drift into a claim.

### The test requirements, and where they live

| Required by the brief | Where it is held |
| --- | --- |
| two spaces of one owner, third order unattached, totals match | `shopBrief.mjs` ("two spaces split the day…") + `spaceMoneyScope.mjs` (8) |
| a day with zero rows produces no brief | `shopBrief.mjs` ("a day with nothing in it is not a page of zeros") — and the sweep sends nothing (`quiet: 1`) |
| a day with rows sums correctly, verified by hand | `shopBrief.mjs` ("every figure the brief prints can be re-added from the rows") |
| the stock flag fires when the count is re-declared | `shopBrief.mjs` + `stockLog.mjs` (11) |
| it does NOT fire when `end == start - sold` | `shopBrief.mjs` ("no flag when the count went down by exactly what was sold") |
| money with no space is reported separately | `shopBrief.mjs` + `shopbrief.jsx` (12, client) |
| the notification fires at the owner's chosen hour, not always 6am | `shopBrief.mjs` ("the sweep waits for the hour the owner named, then sends once") |

## Built in this commit

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

## The one rule

If a number isn't backed by a row, don't print it. If a flag isn't derived from
rows, don't raise it. If a shop has no activity, say so — don't fabricate a
report.

The brief is the truth. Not the summary. Not the estimate. The truth.
