# The public face — what it is, and the four things it will not become

Written 2026-09-18, with the Layer-1 build. This is the record of what the
public page is *not*, because every one of those refusals is a feature somebody
will ask for twice.

## What shipped (Layer 1)

| Piece | Where | What it is |
|---|---|---|
| The page | `GET /s/:slug` (server-rendered HTML) | A mirror of one Space: name, one line, place + hours, live offers with price/unit/minimum/stock, the owner's recent update, follower rows, and a WhatsApp button only if the owner published a number. |
| The same data | `GET /api/public/spaces/:slug/page` | What the in-app mirror (`#space/<slug>`) renders. Read-only. |
| The owner's look | `GET /api/spaces/:id/public-page` → `PublicFacePanel` | The address, what a buyer sees right now, and any reports. Nothing to style. |
| The one write | `POST /s/:slug/report` | A plain form post → one `spaceAbuseReports` row. |
| The index | `GET /sitemap-spaces.xml` | Live public pages. 503 until `BRIEF_PUBLIC_ORIGIN` is declared. |
| The domain | `server/src/domain/spacePublicPage.js` | `publicPageView`, `openState`, `publicImage`, `contactChannel`, `renderPage`, `unavailableReason`, `reportSpace`, `sitemapXml`. |
| Tests | `server/test/spacePublicPage.mjs` (24) · `preview/publicface.jsx` (10) | The honesty contract, executed. |

Server-rendered for exactly one reason: the sharing channel is a WhatsApp status,
and a link preview does not run JavaScript. The HTML is produced from the same
projection the API serves, so a preview card cannot promise what the page does
not show, and the page cannot disagree with the directory.

## Why the URL is `/s/<slug>` and not `brief.app/jj`

Bare top-level handles collide with app routes (`/marketplace`, `/you`,
`/api`, `/assets`, `/health`) and would need a reserved-word blocklist that has
to be maintained forever, plus a migration for every existing space. `/s/`
matches the campaign face (`/c/:slug`) that already ships, and the slug is
already minted from the space's own name (`jj-cakes`), with a numeric tail on a
collision — never a cute word nobody chose.

The link a printed sticker carries is `https://brief.app/s/jj-cakes`. The
shorter form is a *redirect* decision for later (one route, one lookup), not a
schema change.

## The four things it will not become

**1. Not a website builder.** One layout, one palette, no theme, no fonts, no
section order, no accent picker. The brief proposed "category-tinted" and
"accent colour (3 options)" — refused: tinting needs a type→colour mapping that
means nothing to a buyer, and three accent options are the first three rungs of
a paid tier, which becomes a rank. If a page can be prettier, the shop with the
plainer page is worse, and Brief does not rank shops.

**2. Not a review page.** No stars, no "verified", no tick, no aggregate. Brief
stores no completed-order reviews — the errand rating rows are per-delivery,
about a person, and are listed as said, never averaged. A badge on a shop's
face would be the single most expensive thing this product could invent, because
it transfers Brief's credibility onto money changing hands between strangers.

**3. Not an analytics product.** No "18 people viewed your page this week".
A `space_viewed` row is written when a page opens, the owner's own opens are
excluded, and the count appears in the header strip labelled for what it is. No
per-visitor identity, no browse log, no "buyers who looked and left", no funnel.
The panel deliberately shows no counter, because a counter next to a share
button reads as a score.

**4. Not a paid tier — yet.** Free/Pro/Business (custom handle, branding
removal, custom subdomain) is a pricing decision with no payment rails behind
it. `fees.js` and `lipaMdogo.js` exist; there is no subscription billing, no
self-serve checkout, and no invoice. Selling a handle for KES 500/yr before the
money path exists would be a promise with no row to keep it. When it is built,
the tier must be a *capability* the app already has (an edited handle, a hidden
footer), never a removal of honesty: a paid page gets no stars, no rank and no
"verified" mark that free pages cannot have.

## Deferred, with the reason it is not free

| Item | Status | Why |
|---|---|---|
| SEO beyond meta tags | Partial | The page is server-rendered with `LocalBusiness` JSON-LD, so it is *indexable*. No Google Search Console verification, no structured-data test, no `robots.txt` yet. The page states its own hours and offers only — nothing indexed is invented. |
| Map embed | Not built | Brief has a `locations` graph and no tile provider or key. A pin from a text answer ("Narok town") on a map is a guess drawn as a fact. |
| Live stock status | Built, narrowly | `quantityAvailable` on the listing. `null` (not tracked) renders as nothing, never as 0. |
| Reviews from completed orders | Not built | No review table for space orders, and the aggregate ban above. |
| Photo gallery | Not built | Space posts carry no image column; `uploads` are per-purpose and only a public upload referenced by the space row is publishable (`publicImage` enforces exactly that). |
| Custom handle edit | Not built | `ensureSlug` writes once and is deliberately immutable: a link on a sticker must not break because a shop renamed itself. |
| Takedown flow | Not built | A report writes a row that the owner can read; no reviewer UI, so no promise of review. `handledAt`/`outcome` stay null. |
| SSG / CDN at scale | Not built | Every page read is derived. If page traffic becomes the cost, the fix is a cached copy with an invalidation on the space's `updatedAt` — not a second copy of the data. |

## The privacy line, and the one assumption

Making a space public is confirmed in the app with the address it creates and
the list of what becomes visible. Toggling back to private takes the page down
on the next read: `noindex` on the gone page, and nothing is cached behind it
(`Cache-Control: no-store` on every page response).

The owner's phone number is the one field that publishes a secret by choice.
There is deliberately no "hide the digits" toggle — a `wa.me/<digits>` link *is*
the digits, so a switch that hid the text while shipping the link would be a
control that lies. The honest choice is: publish a number, or leave the field
blank and be reachable through the Brief inbox.

One assumption is baked in and stated on the page: hours are read against East
Africa Time (fixed +03:00, no DST). "Open now" is never inferred from activity,
busyness, or how recently an order arrived — only from the owner's own
`availability` answer containing today's day and both ends of the clock.
