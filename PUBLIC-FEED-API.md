# Brief public feed API

`GET /api/public/feed` is the anonymous, read-only feed contract for websites,
bots and other integrations.

No session, bearer token or API key is required. The server sends CORS headers
for cross-origin reads.

## Request

```bash
curl 'https://your-brief-host.example/api/public/feed'
```

Optional query parameters:

| Parameter | Description |
|---|---|
| `limit` | Maximum number of object records to compose, from `1` to `50`. Default `50`. |
| `lat` | Latitude used for nearby ranking. Must be sent with `lng`. |
| `lng` | Longitude used for nearby ranking. Must be sent with `lat`. |
| `radiusKm` | Nearby radius from `0` to `200` km. Requires `lat` and `lng`; defaults to `40` when a location is supplied. |

Invalid or incomplete query parameters return `400` with
`{"error":"...","code":"invalid_query"}`.

Example:

```bash
curl 'https://your-brief-host.example/api/public/feed?lat=-1.2864&lng=36.8172&radiusKm=15&limit=20'
```

## Response

```json
{
  "feed": {
    "hero": [],
    "discovery": [],
    "opportunities": [],
    "more": [],
    "tea": null,
    "moreTea": [],
    "counts": {
      "objects": 0,
      "tea": 0,
      "deduped": 0
    }
  },
  "meta": {
    "apiVersion": "1",
    "generatedAt": "2026-08-24T00:00:00.000Z",
    "location": null,
    "limit": 50
  },
  "mediaProvider": {
    "configured": false
  }
}
```

Object records contain public discovery fields: `id`, `type`, `title`,
`category`, `summary`, `locationName`, verification timing, safe metadata,
`media`, and a sanitized `action` when the record has one. Safe metadata
includes public-facing values such as price, deadline, opening hours and
distance. Images are included only when a real image is already associated with
the record.

Tea records in the feed are lightweight cards: title, slug, teaser, category,
location, image references, attribution and publication timing. The full
article body is available through the existing public Tea endpoint:
`GET /api/tea/:slug`.

## Privacy boundary

Only records with `publication: "public"` are eligible. The public projection
omits source membership, provenance rows, extraction evidence, ownership,
internal relationships, contact numbers, coordinates, and other internal store
fields. Private and `source_members` records are never returned by this
endpoint.

## Caching and versioning

Responses include:

- `Cache-Control: public, max-age=60, stale-while-revalidate=300`
- `X-API-Version: 1`

`GET /api/feed` remains available as the first-party alias. New integrations
should use `/api/public/feed` so the public boundary is explicit.
