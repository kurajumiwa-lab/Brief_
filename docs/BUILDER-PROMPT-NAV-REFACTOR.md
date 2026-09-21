# The Navigation Refactor, as received

Received 2026-09-21. Fourteenth builder prompt to arrive; the operator's own
counting labels it #16. Saved as `docs/BUILDER-PROMPT-NAV-REFACTOR.md`.

**Verification verdict, before anything else:** the decision this prompt
"locks" — bottom nav of five, a drawer scoped to the overflow, chips that
filter but never navigate — is already the shipped state of the production
shell, enforced by a test file the prompt asks to invent. The prompt audits a
drawer that was already cut from eleven entries to six and asserts the cut in
code; it asks for a routing test that runs green before this record was
written. Of its kill list, two entries are phantoms, one would strip the
commerce spine out of Discover, and one would delete real inventory to cure a
placeholder that does not exist. What is genuinely new here is small and
shippable: a Settings/Account drawer, a first-run empty state, per-mode
category chips (server taxonomy required), a full-screen search that must
resolve, and extensions to the test that already enforces the rules.

Fresh runs this session, via `./run-suites.sh` (2026-09-21):

| Suite | Result | Suite | Result |
|---|---|---|---|
| appbelt | 5 passed / 0 failed | firstrun | 5 passed / 0 failed |
| nav | 85 passed / 0 failed | routes | 24 passed / 0 failed |
| menusheet | 27 passed / 0 failed | room | 12 passed / 0 failed |
| discoverlayout | 6 passed / 0 failed | cityfeed | 7 passed / 0 failed |
| homezones | 11 passed / 0 failed | publicface | 10 passed / 0 failed |

**TOTAL: 192 passed / 0 failed — GREEN.**

One production fact the prompt's whole audit stands on:
`preview/src/main.jsx` — *"the legacy App.tsx shell is NOT part of the
production entry. (App.tsx remains only as the test harness for the legacy
feature suites)."* The production shell is `app/AppShell.tsx`. The navigation
this prompt audits is `app/Navigation.tsx` (the dock), `app/AppBelt.tsx` (the
band), and `app/NavSheet.tsx` (the sheet) — and each has already had the
argument this prompt re-opens, in comments and in `preview/appbelt.jsx`.

## Corrections first (what was changed, and why)

**1. The premise — "three navigation systems fighting each other" —
describes a renovation that is already finished.** The production shell ships
exactly the locked decision: a bottom dock of five destinations in the exact
order Home · Spaces · Discover · Activity · You, icon + label, with a sliding
active pill (`Navigation.tsx` `navItems`); a sheet holding six entries, not a
second navigation (`NavSheet.tsx`); and a band whose chips come from the app's
own taxonomy with the flows deliberately excluded (`AppBelt.tsx`). The tree's
own words pre-date the prompt's: *"the sheet holds the destinations that exist
nowhere else. The band holds the rooms. The dock holds the five tabs. A thing
you can reach from two places is a thing you will not find in either."*
(NavSheet.tsx header.) The refactor this prompt commands is, in production, a
description of what is.

**2. The drawer audit miscounts the drawer, and contradicts itself.** The
prompt says the drawer has "10+ items in 4 groups, none of which duplicate the
bottom nav" — and three paragraphs later that it "holds 10 items that
duplicate the 5 destinations plus 5 that shouldn't be primary at all." Both
cannot be true, and against the tree neither is: **six entries in three
groups** (`Your work`: Requests, Supply, Partners; `You, your standing, your
money`: Standing, Earn; `When you want it explained`: How Trace works), plus
the Your Area block. The six are asserted: `preview/appbelt.jsx` — *"six
entries, not eleven — a long list is a wall for a reader who scans."* The
drawer's own header records the surgery the prompt believes it is proposing:
*"Six entries. That number is asserted in `appbelt.jsx`, so the list cannot
quietly grow back into the eleven-item wall it replaced."* What survives of
the audit: Requests, Supply and Partners are sheet-only workspaces
(`RequestsWorkspace`, `SupplyWorkspace`, `PartnerDesk` — tabs that exist
nowhere else, which is exactly why the sheet keeps them); their Spaces homes
(`Spaces > Requests`, `Spaces > shop > Supply`, `Spaces > shop > Partners`)
do not exist yet and must be built **before** the sheet lines are removed —
the tree's own rule is moved-not-deleted, and appbelt's fifth test asserts the
copy MOVED. Standing and Earn genuinely are You sections (appbelt asserts
PositionCard/CommitmentsCard/ReciprocityCard live in You → Standing; EarnStrip
already runs on Home), so their two sheet lines can be removed now without
orphaning anything. That is the one removal that ships clean today.

**3. Killing "the top chips" would kill the commerce spine — and they are
not chips.** The belt rail is four words — All, Events, Circles, Errands —
read from `SIDE_ORDER` in `features/city/taxonomy.ts`, and appbelt asserts the
rail IS the taxonomy and that *"the flows are not in the band — they are in
the picker, beside their counts. Two navigations for one purpose is what this
cut."* Bulk, Direct, Niche and Group — the prompt's first four kill-list
entries — are not in the band. They are the **flow board**: the four
destination-flows (niche: a household; bulk: shops & resellers; group: a pool;
direct: bypassing the middle) whose labels live on the server
(`domain/flows.js`, arriving on `GET /api/discover/summary`), whose counts are
the server's counts, and whose law `HowBriefWorks.tsx:59` teaches: *"an offer
missing bulk's two endpoints is not bulk."* taxonomy.ts: *"Nothing in this
file can produce a number."* Deleting them from Discover deletes the flow
taxonomy the whole offer system is written in. Worse, the replacement mode row
— Shops, Events, Circles, Errands, **Runs**, **Group Buys** — invents a "Runs"
room that exists nowhere (Errands' own unit label is "open runs"), and
collides "Group Buys" (the `groupbuy.js` engine) with the "group" **flow**
(a destination = a pool) — the same class of name collision as the
Shop/shop decision of 2026-09-20, which reserved `shop`/`shops` for exactly
this reason. The flows survive this record. A mode row may be built **from**
the server taxonomy, never over it.

**4. Two kill-list entries are phantoms.** "The 'All →' chip — remove. It
goes nowhere useful": no chip named "All →" exists anywhere in `preview/src`.
The arrows in the city features are route labels ("Wakulima Market →
Kilimani shops · min 5 crate"), a filter glyph, and an "Open the ask →" link.
"The 'All exhibits' chip": there is no such chip. `MuseumGallery.tsx:161`
makes "All exhibits" the **wing label** — the summary line that says what you
are looking at when no category filter is set. It is a caption, not a
navigation control. Nothing to kill; the kill would take a caption.

**5. "What's moving" already is the real signal the prompt demands — in
both of the branches the prompt permits.** `SignalBar.tsx` renders the facts
`/api/pulse` composed — open demand, closures in window, open events, active
listings — stamps them with the newest real row time, prints "no rows yet"
when there are none, and on error renders *"Signals unavailable — the ledger
could not be read"* with a Retry button instead of a silent "all quiet."
`homezones.jsx` pins it: *"NEVER prints a percentage movement (no price
history exists in this store); renders an honest error rather than a silent
'all quiet'."* The prompt's either/or — "a real signal from a real source, or
hide it entirely until there's data" — is satisfied on the first branch when
rows exist and by the honest zero when they do not. The house prints `0` only
as a true row count; "no rows yet" is that zero, spoken.

**6. "What's out there" is inventory, not a placeholder — the deletion is
refused.** HomeSurface Zone 3 holds `MuseumGallery` — real published events,
*"inventory, not a feed"* — plus one "Browse everything" link. The cards
exist only because a listing or a published event exists (DiscoverScreen's
header records the earlier fiction purge: invented listings, Unsplash
photographs of other people's goods, phone numbers nobody runs — deleted). The
prompt kills the section as if it were an empty placeholder; by the prompt's
own criterion — "replace with a real signal from a real source" — it stays.
Deleting it would take the published world off a fresh member's Home and leave
the two-button empty state as the whole answer.

**7. The header re-argues a tested decision: the search box that resolves.**
The prompt wants no inline search bar — a tappable icon opening a full-screen
search. The belt's own comment: *"the search box resolves. It is not
decoration: it writes `#search/<q>`, which the shell answers with the real
`/api/search` surface. A box that filtered nothing would be the worst thing on
this screen, because it would teach the member that nothing here can be
trusted"* — and appbelt's second test pins the resolution end to end. A
full-screen search may be built, but it must resolve through the same surface
and inherit the negative assertions; a prettier door to the same resolution is
a change, a door that only looks like search is the bug class the belt exists
to refuse. Everything else the header section asks for is already true: the
band is `sticky top-0` (it never scrolls away); there is no greeting in it
(identity lives on Home — "Hi {sessionName}", *"never a placeholder name"*);
the area chip prints only what the member typed — *"Set your area"* when
unset, *"no inherited or guessed location"* asserted by test. One cosmetic
note: the sheet slides in from the **left** today; the prompt asks for the
right. Allowed, cosmetic, and it must take the one-close-affordance assertion
with it.

**8. The Settings adds are real, but two carry gates and one is a
re-homing.** No Settings surface exists (verified: no matches in app,
features/you, screens). Privacy has no client face; the server law exists —
`personal.js` makes personalisation explicit, inspectable, counted, and
*"nothing is ever exposed to other users or through public endpoints"* — so
the drawer row can be a real door to real controls. Notification preferences
**already exist**: `NotificationCenter.tsx` reads and writes real preferences
(`getNotificationPreferences` / `updateNotificationPreferences`, aria-label
"Notification preferences") — but it mounts only through the legacy harness
(`App.tsx:1558` via `OverlaysShell`), so the add is a re-homing into
production (Activity, per the prompt's own map), not a build. Language: there
is no i18n anywhere in this tree. A Language row that changes nothing is the
"search box that goes nowhere" class of control — either the i18n rail is
built first, or the row prints the truth ("English only today"). Sign out is
verified where the prompt says it is: `YouSurface.tsx:341`.

**9. The full feature map is mostly the tree's own shape — with three
exceptions and one silence.** Orders, Reviews, Disputes and Saved under You:
that is the Consumer Profile record's commerce room, consistent. Events,
Circles, Errands as Discover rooms: they exist — as belt chips fed by the
taxonomy. The exceptions: "Runs" (no such room — see correction 3); "Group
Buys" as a Discover mode (`GroupBuyPortal` exists but is imported only by the
legacy harness — `App.tsx`, `WorkflowsScreen`, `model/core` — the production
shell mounts nothing for it; a mode chip is not a mount, and the phantom that
never shipped keeps its shadow); and the map's silence about **Nearby** —
the received third prompt's front door. `NearbyScreen` also mounts only in the
legacy harness today, and the URL routing layer's root is nearby
(`nav/routes.ts`, asserted: `parsePath('/')` → `dest === 'nearby'` — consumed
by the legacy App and the share URLs, not by the production shell, which uses
raw hash tabs). The map's "Nearby shops list | Discover" re-homes a surface
the series already recorded without naming it; any re-homing answers to the
Nearby record (`4aab953`).

**10. The empty-state Home is a genuine add — with the mockup numbers
gated.** There is no dedicated first-run branch on Home today; every zone
prints honest empties (StandingLine shows real counts, *"no row in this store
holds a rank, a sector or a queue"*; EarnStrip *"renders, with dashes,
because 'we could not read it' and 'you have nothing' are different"*; the
upkeep counts are *"derived by the server from each space's own rows… Home
only adds those counts up — it invents no urgency"*). A "You haven't done
anything on Trace yet" state with two buttons — Browse shops near you,
Invite a shop (the loop exists, `8c5baf5`) — ships gated on the member having
no rows anywhere: no orders, no spaces, no saves, no reviews. It also overlaps
an existing resident: `FirstRunChecklist` already derives the first session as
an action queue from real rows (`firstrun.jsx`, 5 PASS) — the empty state and
the checklist are two doors into the same derivation and must share it, not
fork it. The mockup's "Orders (7) / Saved shops (4) / Reviews (3)" are
illustrations; every printed figure recomputes from rows.

**11. "Add a routing test that fails if any navigation rule is violated" —
it exists; extend it, never fork it.** `preview/appbelt.jsx` runs five PASS
groups: the band's geometry (All one tap away, honest area, rail = taxonomy,
flows excluded, no countdown, no crowd pressure, no loyalty theatre); the
search that resolves (`#search/<term>` → `SearchResults` → `/api/search`);
the message slot silent when empty and the host's own words when not; the
sheet holding the long list once (six entries, no duplicates, nothing shared
with band or dock, no counts on nav entries, one close affordance); and the
moved-not-deleted dedupe. The prompt's genuinely new assertions — dock order
pinned directly (the dock is exercised today only through the `cityfeed` and
`polish` suites), chip-never-matches-a-dock-label, the full-screen search
handoff, category rows fed by a server taxonomy, the empty-state branch —
belong in this file as new sections. Its own words: *"'we would never' is
only true for as long as a test says so."*

**12. The recap: fifteen claimed, fourteen arrived — the phantom now has a
table row and a dependency graph.** The "Where We Are Now" table lists Group
Buy Streams as delivered — #12, "Depends on Rail + Verification" — a prompt
that has never arrived, for the fourth consecutive recap, now upgraded from
missing to delivered-with-dependencies. The received count including this one
is fourteen; the operator's labels make it #16. The remaining menu grows a
sixth item: "The Notification System — what gets notified, when, and how
(unified across in-app, WhatsApp, SMS)." Note for that prompt: the in-app
half already has real preferences (correction 8) — it will be a unification,
not a beginning.

## The prompt's test requirements, mapped

| # | Test requirement | Status against the tree |
|---|---|---|
| 1 | Bottom nav: exactly 5 items, exact order | **Already true** — `Navigation.tsx` `navItems`; extend appbelt to pin the dock directly |
| 2 | Drawer: exactly 4 groups (Area, Settings, Help, Account) | **Partial** — area block + 3 groups today; Settings/Account are the add; the six-entry assertion is re-cut only when each new entry earns its line |
| 3 | No item in both dock and drawer | **Already asserted** — appbelt: dock tabs are not repeated in the sheet |
| 4 | No chip matches a bottom nav label exactly | **Partial** — band∩sheet and flows∉band asserted; extend to dock labels |
| 5 | Header: location, search, menu — in that order | **Different arrangement ships** — All + brand + resolving search, area on its own line, sticky; a new order may be pinned, but the resolving search and the honest area travel |
| 6 | The header never scrolls | **Already true** — `sticky top-0` |
| 7 | Search icon opens full-screen search | **Change to a tested decision** — permitted only if it resolves through `/api/search` like the box it replaces |
| 8 | Menu opens the drawer | **Already true** — one tap, asserted; slides from the left today, right requested |
| 9 | Dismiss by outside tap or ✕ | **Already true** — backdrop button + X + Escape, one-affordance assertion |
| 10 | Discover: two chip rows (mode + category) | **New** — the mode axis exists (rooms + flow picker); the category row needs a server taxonomy first |
| 11 | Mode chips: Shops, Events, Circles, Errands, Runs, Group Buys | **Amended** — the four flows survive (correction 3); Runs does not exist; Group Buys needs a production mount before a chip |
| 12 | Category chips change per mode | **New** — event categories are the precedent: server-fed labels (`MuseumGallery` reads them from the API), never a client-typed list |
| 13 | Home: next step if there is one, empty state if not | **Half true** — `NextMoveCard` is the next step (pinned by homezones); the empty branch is the add (correction 10) |
| 14 | Home never shows "What's out there" | **Refused** — it is inventory (correction 6) |
| 15 | Home never shows "All exhibits" or navigation chips | **Already true** — "All exhibits" is a caption inside the gallery, and no nav chips live on Home (moved-not-deleted asserted) |

## What is genuinely new here

- **A Settings/Account drawer** — Settings, Language (gated on an i18n rail
  or an honest one-line truth), Privacy (a real door to `personal.js`
  controls), Account with sign out (secondary access; You keeps its own).
- **Notification preferences in production** — re-homed from the harness
  (`NotificationCenter` is real and tested-by-mount) into Activity.
- **A first-run empty state on Home** — two buttons, gated on no-rows-
  anywhere, sharing its derivation with the existing `FirstRunChecklist`.
- **Per-mode category chips** — built from a server taxonomy (the flow
  vocabulary and the event categories are the two precedents), never typed
  client-side.
- **A full-screen search** — if, and only if, it resolves like the box it
  replaces.
- **appbelt extensions** — dock order pinned directly, chip∩dock label rule,
  the new rows and the empty-state branch asserted.
- **The locked rules themselves** — as recorded law this prompt and the tree
  now agree on: five destinations; one primary location per feature; the
  drawer never duplicates a destination; chips filter, rooms are content; the
  header and the dock do not move; adding a feature never adds a nav item.

**Refused or amended by this record:** deleting the flow board from Discover
(correction 3); the "Runs" room and the "Group Buys" chip without a mount
(corrections 3, 9); the "All →" and "All exhibits" kills — phantoms
(correction 4); deleting "What's out there" (correction 6); replacing
"What's moving" (correction 5); removing Requests/Supply/Partners sheet lines
before their Spaces homes exist (correction 2).

**Left to the operator, in writing:** the sheet's long-term philosophy. The
tree chose overflow-with-dedupe — the sheet holds destinations that exist
nowhere else, six, asserted. The prompt chooses settings-only — the drawer
holds nothing but Area, Settings, Help, Account. Both honour "one primary
location"; they differ on whether sheet-only workspaces are a legitimate
third kind of home. The choice costs either three built sections in Spaces
(prompt's way) or a drawer that is a settings menu plus three workspaces
(tree's way). Record it once; the test will hold whichever is chosen.

## The prompt, as received (verbatim)

````markdown
# Builder Prompt — The Navigation Refactor

Save as `docs/BUILDER-PROMPT-NAV-REFACTOR.md`.

```markdown
# Trace — The Navigation Refactor (Builder Prompt)

You are refactoring the navigation. Right now the app has
three navigation systems fighting each other:

1. **Bottom nav** — 5 destinations: Home, Spaces, Discover,
   Activity, You
2. **Side drawer** — 10+ items in 4 groups, none of which
   duplicate the bottom nav
3. **Top chips** — 7 items that mirror neither (Bulk, Direct,
   Niche, Group, Events, Circles)

A user opening the app sees three ways to move around, none
of which agree. That's not navigation. That's confusion.

This prompt picks one system, kills the others, and defines
the rules going forward.

## The decision (locked)

**Primary navigation: bottom nav, 5 items.**

- Home · Spaces · Discover · Activity · You

**Secondary navigation: side drawer, scoped.**

The side drawer is not a second nav. It's a "Settings and
more" menu. It holds:
- Anything that isn't one of the 5 destinations
- Anything that is a setting, help, or profile control
- Anything that's an infrequent action

**No top chips on primary destinations.**

Chips exist only inside a destination to filter its content,
and they are visually distinct from navigation. They never
mirror the side drawer.

## Why bottom nav wins

Three reasons:

**1. The bottom nav is where the thumb already is.** On a
6-inch phone, the bottom third of the screen is the reachable
zone. The top third is a stretch. The bottom nav is the only
system that respects this.

**2. The side drawer is a leftover from an older architecture.**
It was designed when Trace had 12 destinations. Now it has 5.
The drawer holds 10 items that duplicate the 5 destinations
plus 5 that shouldn't be primary at all.

**3. The top chips on Discover are duplicated from the side
drawer.** Every chip on Discover already exists in the drawer.
Two paths to the same thing. Users can't tell which is
correct, so they don't trust either.

## Why the side drawer stays

The side drawer is not dead. It's the second-level menu.
Settings, profile, help, "How Trace works" — these don't
belong on the bottom nav (they're not destinations) and
they don't belong in context (they're global).

But the drawer needs surgery:

**Remove from drawer:**
- Requests — belongs in Home (as "your next step") or a
  section within Spaces
- Supply — belongs in Spaces (as "your offerings")
- Partners — belongs in Spaces (as "your partners")
- Standing — belongs in You (already there)
- Earn — belongs in You (already there)

**Keep in drawer:**
- Your Area (setting — you set where you are)
- How Trace works (help)
- Settings (add this — currently missing)
- Sign out (already at bottom of You)
- Language (add this — currently missing)

The drawer becomes **5 items max**. Not 15.

## The audit (what to kill)

### Kill these from the side drawer

| Item | Current location | Where it actually belongs |
|---|---|---|
| Requests | Side drawer | Home (as a card) OR Spaces > Requests |
| Supply | Side drawer | Spaces > your shop's offerings |
| Partners | Side drawer | Spaces > your shop's partners |
| Standing | Side drawer | You tab (already has it) |
| Earn | Side drawer | You tab (already has it) |

### Kill these from Discover

- Top chips (Bulk, Direct, Niche, Group) — **remove
  entirely**. They duplicate the side drawer and confuse
  the entry point.
- The "All →" chip — **remove**. It goes nowhere useful.
- All 7 chips become **one row of shop-category chips**:
  `All · Food · Groceries · Goods · Services · Health ·
  Beauty · Delivery · Other`

### Kill these from Home

- The "What's moving" section header if it has no content.
  Right now it says "no rows yet" — that's honest but
  useless. Replace with a real signal from a real source,
  or hide it entirely until there's data.

## The new architecture

```
┌─────────────────────────────────────┐
│  HEADER                             │
│  ├─ Location selector (left)        │
│  ├─ Search (center)                 │
│  └─ ☰ Menu (right)                  │
├─────────────────────────────────────┤
│                                     │
│  CONTENT                            │
│                                     │
│  [depends on destination]           │
│                                     │
├─────────────────────────────────────┤
│  BOTTOM NAV                         │
│  Home · Spaces · Discover · Activity · You │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  ☰ MENU (side drawer, right-aligned)│
│                                     │
│  YOUR AREA                          │
│  Set your area                      │
│                                     │
│  SETTINGS                           │
│  Language                           │
│  Notification preferences           │
│  Privacy                            │
│                                     │
│  HELP                               │
│  How Trace works                    │
│                                     │
│  ACCOUNT                            │
│  Sign out                           │
│                                     │
└─────────────────────────────────────┘
```

**The header is one line.** Location on the left, search in
the middle, menu on the right. That's the entire top of the
screen.

## What lives where (full map)

| Feature | Primary location | Secondary access |
|---|---|---|
| Nearby shops list | Discover | — |
| Shop search | Discover (header) | — |
| Saved shops | You > Saved | Discover (small chip) |
| Orders (consumer) | You > Orders | — |
| Reviews (consumer) | You > Reviews | — |
| Disputes (consumer) | You > Disputes | — |
| Shop dashboard | Spaces > your shop | — |
| Shop catalog | Spaces > shop > Catalog | — |
| Shop orders | Spaces > shop > Orders | Home (as a card) |
| Shop money | Spaces > shop > Money | — |
| Shop team | Spaces > shop > Tools > Team | — |
| Shop verification | Spaces > shop > Tools > Verification | — |
| Shop public page | Spaces > shop > Share | — |
| Create offer | Spaces > shop > Add offer | Home (as a card) |
| Requests | Spaces > Requests | Home (as a card) |
| Supply | Spaces > shop > Supply | — |
| Partners | Spaces > shop > Partners | — |
| Standing | You > Standing | — |
| Earn | You > Earn | — |
| Events | Discover > Events | — |
| Circles | Discover > Circles | — |
| Errands | Discover > Errands | — |
| Runs | Discover > Runs | — |
| Group Buys | Discover > Group Buys | — |
| Notifications | Activity | — |
| Inbox | Activity > Inbox | — |
| How Trace works | Menu > Help | — |
| Settings | Menu > Settings | — |
| Language | Menu > Settings > Language | — |
| Sign out | Menu > Account | You (bottom) |

**Every feature has one primary location.** Some have a
secondary access point on Home or Discover as a "shortcut
card," but the primary is always inside a destination.

## The Discover page (new architecture)

Discover becomes the consumer's single shop-facing page:

```
┌─────────────────────────────────────┐
│  ☰  Discover              🔍        │
│                                     │
│  [ Shops ] [ Events ] [ Circles ]   │
│  [ Errands ] [ Runs ] [ Group Buys ]│
│                                     │
│  ──────────────────────────────     │
│                                     │
│  [All] [Food] [Groceries] [Goods]   │
│  [Services] [Health] [Beauty]       │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  <content of the selected mode>     │
│                                     │
└─────────────────────────────────────┘
```

**Two rows of chips.** Row 1 = mode. Row 2 = category. Not
seven chips in one row. Two rows, each with a purpose.

If the mode is "Shops," the second row filters by category.
If the mode is "Events," the second row filters by event
type. If the mode is "Circles," the second row filters by
circle type.

**The chips are visual** — colored icons in a horizontal
scroll — not text-heavy pills.

## The Home page (new architecture)

Home is the **personal dashboard**. Not a feed. Not a
directory. The user's own state.

```
┌─────────────────────────────────────┐
│  Hi Mary                            │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  YOUR NEXT STEP                     │
│  <one card, from the commitment     │
│   graph or the shop dashboard>      │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  WHAT YOU HAVE                      │
│  · Orders (7)                       │
│  · Saved shops (4)                  │
│  · Reviews (3)                      │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  YOUR SPACES                        │
│  · Testshop · FRESH · 1 question    │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  WHAT'S MOVING                      │
│  <real signal from a real source,   │
│   or hidden if there's nothing>     │
│                                     │
└─────────────────────────────────────┘
```

**No "All exhibits" chip.** No "Browse everything." No empty
"What's out there" placeholder.

If the user has nothing — no orders, no shops, no saves —
then Home shows:

```
┌─────────────────────────────────────┐
│  Hi Mary                            │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  You haven't done anything on       │
│  Trace yet.                         │
│                                     │
│  [ Browse shops near you ]          │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  Know a shop that should be here?   │
│                                     │
│  [ Invite a shop ]                  │
│                                     │
└─────────────────────────────────────┘
```

Two options. Not four empty sections.

## The header (new)

One line. Always visible. Never moves.

```
┌─────────────────────────────────────┐
│  📍 Kilimani     🔍      ☰          │
└─────────────────────────────────────┘
```

**The location** is a tappable area that opens the "Set
your area" drawer. The current area is shown as text.

**The search** is a tappable icon that opens a full-screen
search. On the search screen, the user types and sees
results. There is no search bar in the header (it takes
space).

**The menu** is a tappable icon that opens the side drawer
from the right. It's always in the same place. Users learn
it.

**No greeting in the header.** The header is for navigation,
not for identity. Identity lives in the greeting on Home.

## The side drawer (new)

Right-aligned. Slides in from the right. Same drawer from
every screen.

```
┌─────────────────────────────────────┐
│  ALL SECTIONS              ✕        │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  YOUR AREA                          │
│  Kilimani · Change                  │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  SETTINGS                           │
│  Language · English                 │
│  Notifications · On                 │
│  Privacy                            │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  HELP                               │
│  How Trace works                    │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  ACCOUNT                            │
│  Mary K. · +254 712 ••• 678         │
│  Sign out                           │
│                                     │
└─────────────────────────────────────┘
```

**4 groups.** Not 8.

- **Your Area** — one setting
- **Settings** — Language, Notifications, Privacy
- **Help** — How Trace works
- **Account** — you, sign out

**No "Your Work" group.** No "You, Your Standing, Your
Money" group. Those belong in the destinations, not the
drawer.

**Every item is a single tap.** No sub-menus. No nested
drawers. No "Settings > Advanced > Privacy > Data > Export."

## The rules going forward

**Rule 1 — A destination is one of five.** Home, Spaces,
Discover, Activity, You. Nothing else. No sixth destination.
Ever.

**Rule 2 — Every feature has one primary location.** No
feature appears in two primary locations. Secondary access
(a card on Home, a chip on Discover) is allowed but always
links to the primary.

**Rule 3 — The side drawer never duplicates a destination.**
If an item is a destination, it doesn't go in the drawer.
The drawer holds settings, help, and account only.

**Rule 4 — Chips are for filtering, not navigation.** A
chip filters content on the current screen. It never takes
the user to a different destination.

**Rule 5 — The header never moves.** Location, search, menu.
Always in that order. Always on the right.

**Rule 6 — The bottom nav never moves.** Five items. Always
in the same order. Always icon + label.

**Rule 7 — Adding a feature never adds a nav item.** A new
feature is a section within an existing destination, or a
card on Home, or a chip on Discover. It is never a new
destination.

## What to remove from the current surface

**Delete entirely:**
- The top chips on Discover (Bulk, Direct, Niche, Group,
  Events, Circles, Errands, All →)
- The "What's out there" section on Home
- The "All exhibits" chip
- The "YOUR WORK" group in the side drawer
- The "YOU, YOUR STANDING, YOUR MONEY" group in the side
  drawer
- The "WHEN YOU WANT IT EXPLAINED" group label (keep the
  item, remove the label)

**Refactor:**
- Discover becomes the mode + category chip page (two rows)
- The side drawer becomes 4 groups: Area, Settings, Help,
  Account
- Home becomes the personal dashboard (next step, your
  things, your spaces, what's moving)

**Add:**
- Language selection in the side drawer (Settings)
- Notification preferences in the side drawer (Settings)
- Privacy settings in the side drawer (Settings)
- "Settings" as a distinct drawer group

## Test requirements

- The bottom nav has exactly 5 items in the exact order:
  Home, Spaces, Discover, Activity, You.
- The side drawer has exactly 4 groups: Your Area, Settings,
  Help, Account.
- No item appears in both the bottom nav and the side drawer.
- No chip on any screen matches a bottom nav label exactly.
- The header shows: location, search icon, menu icon. In
  that order.
- The header never scrolls. It stays fixed.
- Tapping the search icon opens a full-screen search, not
  an inline search bar.
- Tapping the menu icon opens the side drawer from the
  right.
- The side drawer can be dismissed by tapping outside it or
  by tapping the ✕.
- Discover has two chip rows: mode and category.
- The mode chips are: Shops, Events, Circles, Errands, Runs,
  Group Buys.
- The category chips change based on the selected mode.
- Home shows the user's next step if there is one, and the
  empty state if there isn't.
- Home never shows a "What's out there" section.
- Home never shows "All exhibits" or similar navigation
  chips.

## The one rule

The user should be able to open the app and know, in one
glance, where they are, where they can go, and how to get
back. Three navigation systems break that. One navigation
system, used consistently, makes it.

Bottom nav for destinations. Side drawer for settings. No
top chips for navigation. That's the whole rule.

## Order of operations

1. Delete the top chips from Discover.
2. Delete the "What's out there" section from Home.
3. Rebuild the side drawer with 4 groups (Area, Settings,
   Help, Account).
4. Move the deleted drawer items to their real homes
   (Requests, Supply, Partners into Spaces; Standing, Earn
   stay in You).
5. Add Language, Notifications, Privacy to Settings.
6. Rebuild the header: location, search, menu.
7. Rebuild Discover: two chip rows (mode + category).
8. Rebuild Home: next step, your things, your spaces,
   what's moving.
9. Add a routing test that fails if any navigation rule is
   violated.

## What this unblocks

- The user can find everything. Three navs become one.
- The bottom nav is stable. Adding features never changes
  it.
- The side drawer becomes a real "settings" menu instead of
  a duplicate navigation system.
- Discover becomes the consumer's directory, not a
  chip-soup of modes.
- Home becomes personal, not empty.
- Every new feature has a rule for where it goes. No more
  "let's put it in the drawer and see."

## Reference

Bottom nav = 5 doors. Side drawer = settings. Header =
location + search + menu. Chips = filters, not navigation.

That's the whole navigation architecture. Say it ten times
before writing any code.

Ship this. Then every future feature knows where it belongs.
```

---

## My Choice, Explained

You asked me to choose between:

1. **Partial navigation** (side drawer as primary)
2. **Bottom navigation** (bottom nav as primary)

**I chose the bottom nav.** Here's why, concretely:

| Criterion | Bottom nav | Side drawer |
|---|---|---|
| Thumb reachability | ✓ Bottom third of screen | ✗ Requires moving hand |
| Discoverability | ✓ Always visible | ✗ Hidden until tapped |
| Learning curve | ✓ Standard mobile pattern | ✗ Requires learning |
| Space cost | ~60px always | 0 when closed |
| Max items | 5 (hard limit) | 15+ (soft limit) |
| Semi-literate user | ✓ Easier to tap icons | ✗ Menu metaphor is Western |
| Instagram/Uber family | ✓ Both use bottom nav | ✗ Uses drawer for settings |
| Fits Trace's 5 destinations | ✓ Exactly 5 | ✗ Hides them |

**The bottom nav wins on every meaningful criterion.**

The side drawer isn't dead — it's just repurposed from
"second nav" to "settings menu." The 5-destination bottom
nav is the primary. The drawer holds the things that don't
belong in a destination: your area, settings, help,
account.

And **the top chips die entirely.** They were a third
navigation system, and they were the worst of the three.
They duplicated the drawer, changed per screen, and looked
like filters while acting like navigation.

**One navigation system. Used consistently. That's the
rule.**

---

## Where We Are Now

Fifteen builder prompts delivered:

| # | Prompt | Depends on |
|---|---|---|
| 1 | Shop Brief | Team & Roles |
| 2 | Settlement Rail | — |
| 3 | Nearby | — |
| 4 | Shopping Run Stream | Nearby + Rail |
| 5 | Invite-a-Shop | Nearby + Rail |
| 6 | Events & Ticketing | Rail |
| 7 | Partner Onboarding | Rail |
| 8 | Team & Roles | — |
| 9 | Verification Flow | — |
| 10 | Dispute Resolution | Rail + Verification |
| 11 | Reviews | Rail + Disputes |
| 12 | Group Buy Streams | Rail + Verification |
| 13 | Consumer Profile | Orders + Rails |
| 14 | WhatsApp Integration | Everything |
| 15 | Navigation Refactor | — |

**Remaining prompts:**

1. **The Space Editor v2** — public page editing with history
2. **The Trace Card** — the shop's physical card for customers
3. **The Field Agent App** — the agent's surface in depth
4. **The Protection Fund** — the pool that covers failed wholesalers and disputes
5. **Trace for Cooperatives** — the SACCO-specific surface
6. **The Notification System** — what gets notified, when, and how (unified across in-app, WhatsApp, SMS)

Say **"next"** and I'll pick the highest-leverage one. Or name the one you want.
````

## Operator note

This is the first prompt in the series whose subject the tree has already
argued, decided, and pinned under test — the mirror image of the phantom:
everything it wants to build exists, and half of what it wants to kill does
not. The three names it writes into the drawer — YOUR WORK, YOU YOUR
STANDING YOUR MONEY, WHEN YOU WANT IT EXPLAINED — are the tree's own three
group labels, verbatim; the counts attached to them are not. That is the
pattern of this whole series in miniature: the words survive the audit, the
numbers don't.

The decision this prompt actually puts on the operator's desk is the one
correction 12 of the Reviews record modelled: what the drawer **is**. The
tree's answer — an overflow with a dedupe law and a count assertion — is
already enforced; the prompt's answer — settings-only — is coherent and
costs three built sections in Spaces. Both honour the rule both share:
every feature has one primary location. Choose once, write it down, and
appbelt holds it either way.

The phantom baton passes with a sharpened point: Group Buy Streams now
appears not in the remaining menu but in the delivered table, with
dependencies — a prompt that never arrived is now recorded as having
arrived, fourth recap running. And the menu grows a sixth name, the
Notification System, whose in-app foundations (real preferences, a real
center) already exist in the harness and wait for a production home. When
it arrives it will be a unification record, not a beginning.

Corrections stand at twelve. The suites ran green — 192/0 across the ten
navigation-relevant files — before a word of this record was committed.

---

*Coda — the prompt ends: "Say it ten times before writing any code." The
tree has been saying it in comments and assertions since before this series
began: the sheet holds six and the test counts them; the rail cannot invent
a room; the search box resolves or it does not exist; "we would never" is
only true for as long as a test says so. One navigation system, used
consistently — the tree's version is stricter, because a rule here is a
line of code that fails out loud. What remains of this prompt is the part
worth building: a drawer that owns its settings, a first session that
answers with two honest buttons, category words that come from the server
or not at all. The map was already drawn. The refactor is keeping the
counts true — in the drawer, in the dock, and in the recap.*
