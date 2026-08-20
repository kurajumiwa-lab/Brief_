# Brief Home Feed — Implementation Map (Master Build, Phase 1)

Audited against the live repo (server/src + App.tsx). Statuses reflect what
actually exists, not what the prompt would like to exist.

## Existing → reuse (do NOT rebuild)

| Concept | Where it lives | Reuse as |
|---|---|---|
| Ranked discovery feed | `domain/discovery.js` → `GET /api/objects?rank=1` (freshness + trust + engagement) | feed ranking backbone |
| Geo proximity | `discovery.haversineKm` + `coordsOf` + `distanceKm` | "nearby" count + distance ranking |
| Objects (events/places/opportunities/services) | `store.objects` + `GET /api/objects` | the discovery/action cards |
| Saves | relationships verb `saved` + `SaveLabel` (`App.tsx` saved section) | saved/bookmark (already real) |
| Categories/types | `ObjectType` + `category` + `getDestinationState` | card CTAs ("Join"/"View"/"Explore"/"Get started") |
| Location | `selectedLocation` + NearbyMap + city coords (geo-tagged seed) | location control + ranking |
| Ingestion | Telegram/WhatsApp/web/RSS connectors + `storeRawItem`/`processRawItem` | Signal → Tea pipeline |
| Feature registry | `features.js` + `requireFeature` | gate Tea/feed/media independently |
| Route registry | `routes/*.js` per-domain mounts | add `routes/tea.js`, `routes/feed.js`, `routes/media.js` |

## Gaps → build (in dependency order)

| # | What | New model / service / API | Phase |
|---|---|---|---|
| 1 | Tea editorial model | `domain/tea.js` + `store.teaArticles` + `routes/tea.js` | 4 |
| 2 | Tea seed (evergreen library) | `seed.js` extension, `seedBatch`-tagged | 4 |
| 3 | Media association | `domain/media.js` + image provider abstraction | 6 |
| 4 | Feed composition | `domain/feed.js` (FeedItem ranking + dedup) + `routes/feed.js` | 8 |
| 5 | Collections | `domain/collection.js` (or tea/objects grouping) | 8 |
| 6 | Tea Desk (editorial workflow) | admin routes + role gate | 5 |
| 7 | Home feed UI rebuild | varied cards, hierarchy, context greeting | 2/3 |

## Honest constraints (unchanged rules)

- No real image provider exists → media resolution returns "no image" honestly
  until an `ImageProvider` is configured (env-gated), never a fake stock photo.
- No AI service configured → AI-assisted drafting is an abstraction, reported
  as configuration-required, never a fake draft.
- Seed data is `seedBatch`-tagged and removable; not presented as live facts.
- Arena stays separate from Around (Play tab unchanged).

## Status vocabulary
BUILT / PARTIAL / CONFIGURATION REQUIRED / NOT BUILT — used in the final report.
