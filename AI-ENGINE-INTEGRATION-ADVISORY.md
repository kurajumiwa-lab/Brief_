# Brief + Yard Engine
## AI-engine integration advisory and shelf-allocation report

**Audit date:** 24 August 2026  
**Scope:** current `Brief_` checkout: `App.tsx`, `src/components`,
`server/src/domain`, `server/src/routes`, `server/src/store.js`, connectors,
feature registry, and the public feed work already added on this branch.

---

## 1. Executive decision

The Yard Engine proposal can be pushed into Brief as an **additive creator,
advertiser and operations layer**. It should not replace Brief's existing object,
identity, signal or economic layers.

Brief already has the right system-of-record seams:

```text
Telegram / WhatsApp / Web / RSS / Manual
                 │
                 ▼
        rawItems → objects → discovery / public feed
                 │                    │
                 ▼                    ▼
             signals            public campaigns
                 │
                 ▼
        workflows → notifications / outbound

campaigns → registrations → payment intents → ledger transactions → settlement
vendors   → listings      → orders          ────────────────────────┘
people    → aliases / vault participants / creator views
```

The proposal is **not drop-in complete**. The following are still absent or
blocked:

1. PostgreSQL/Supabase persistence and transactional reservation semantics.
2. A first-class creator profile and rate-card model.
3. Advertiser accounts, advertiser campaigns and creator matching.
4. A curated ad-asset vault with immutable tracking identifiers.
5. A real calendar/wait-list/expiry worker.
6. Automated WhatsApp Status and Facebook publishing adapters.
7. Live escrow collection and merchant disbursement.
8. A configured AI provider and human-reviewed AI workflow.
9. Cross-channel conversion attribution from tracked click to registration,
   payment and fulfilment.

**Recommended posture:** scaffold these as independent shelves, but keep them
off until each provider, authorization rule and state transition is real. The AI
agent may recommend, classify, draft and orchestrate; it must not become a
second source of truth for money, identity, campaign state or attendance.

The Gmail links in the supplied prompt are not treated as technical
requirements. They are private message links, not repository documentation or
an integration contract, and no credentials should be taken from them.

---

## 2. What exists today

| Area | Current evidence | Status against Yard Engine |
|---|---|---|
| Canonical content graph | `objects`, `objectSources`, `relationships`, `pipeline/ingest.js`, provenance and extraction evidence | **BUILT** |
| People and explicit identity | `people`, `personAliases`, verified alias binding, account/session identity | **BUILT**, but creator profile fields are missing |
| Creator-facing layer | `partnership.js`, media-kit projection, creator opportunities, subscriptions, vendor identity | **PARTIAL** |
| Campaign/event wrapper | `campaigns`, lifecycle, public slug, capacity, registrations, ticketing and check-in | **BUILT for events/drops; not an advertiser campaign model** |
| Public feed | `GET /api/public/feed`, public-only projection, CORS, geo ranking, `limit`, cache headers; `/api/feed` alias | **BUILT** |
| Public campaign distribution | `/api/public/campaigns/:slug`, server-side Open Graph injection, share-intent links | **BUILT for campaign pages** |
| Tracking | `distribution.trackedLink`, `clickEvents`, UTM source/medium/content, click analytics | **PARTIAL** |
| Outbound messaging | `outbound.js` plus Twilio SMS/WhatsApp-send adapter | **CONFIGURATION REQUIRED**; no credentials or delivery callbacks |
| Telegram / WhatsApp input | Telegram webhook/pull and WhatsApp inbound DM paths | **BUILT**, subject to platform credentials; WhatsApp group ingestion is intentionally unsupported |
| TikTok input/output | No TikTok connector, webhook, publisher or import contract | **NOT BUILT** |
| AI seam | `assist.js`, task/provider abstraction, fail-closed behavior | **CONFIGURATION REQUIRED**; `AI_PROVIDERS` is empty |
| Workflow automation | `workflows`, `workflowRuns`, trigger/condition/action engine, periodic signal sweep, `CreatorCockpit` UI | **BUILT**, but not yet an advertiser-specific orchestration layer |
| Payments | Tuma collection connector, payment intents, confirmation and ledger state machine | **CONFIGURATION REQUIRED**; no live credentials and no sandbox |
| Escrow/disbursement | `held` ledger status and payout domain/provider seam | **PARTIAL / NOT AVAILABLE**; `DISBURSEMENT_PROVIDERS` is empty |
| Cooperatives | `pools`, `poolMembers`, `poolRotations`, contributions through the shared ledger | **BUILT for cooperative savings; not connected to advertising escrow** |
| Vendors | vendors, listings, orders, fulfilment, disputes, trust evidence | **PARTIAL**; no transport/print/POD capability registry |
| Calendar | campaign `startsAt`, `endsAt`, capacity and gate data | **PARTIAL**; no unified calendar or waiting list |
| Persistence | synchronous JSON document store, named collections, schema version/migrations | **NOT READY for multi-replica production** |

The current feature registry already provides the correct pattern for shelf
allocation: a feature can report `enabled`, `configured` and `available`, and a
deploy can disable a feature without pretending it works.

---

## 3. Structural fit by requested module

### Module 1 — data core and metric spreadsheets

| Requested node | Closest Brief node | Finding | Required secondary development |
|---|---|---|---|
| `creators_profile` | `people`, `personAliases`, `vendors`, derived `partnership.mediaKit` | There is a canonical person, but no preferred language, region, niche or external-social-links record. Vendor is a commercial identity, not a full creator profile. | Add a one-to-one `creatorProfiles` record keyed by `personId`; do not create a second identity table. |
| `rate_cards` | Derived vendor listing pricing and `partnership.derivePricing()` | Current pricing is a min/max view of active listings. It cannot quote WhatsApp Status, FB post, dedicated campaign or appearance services. | Add `rateCards` with service type, price, currency, availability and version/status. |
| `campaign_ledger` | `campaigns`, `ledgerTransactions`, campaign analytics | Brief deliberately has one economic ledger. `campaigns` are currently event/drop wrappers. A second ledger would violate the one-money-source rule. | Add an advertiser-campaign wrapper or extend campaign metadata; link every hold, payout, refund and fee to `ledgerTransactions`. Derive `distributedPayouts`. |
| `curated_ads_vault` | `campaigns`, `distribution.js`, `clickEvents`, media association | No ad-vault row, asset lifecycle or immutable per-creative tracking hash exists. | Add `adAssets`/`distributionAssets` owned by an advertiser campaign. Store references and metadata, not binary media in the JSON store. |
| PostgreSQL/Supabase | `server/src/store.js` JSON store | No relational database, row-level security, SQL indexes or multi-writer transaction exists. | Implement a store adapter and migration plan before money reservation, queue reservations or multi-region operation. |

#### Important enum normalization

The prompt uses `US_METRO`, `KE`, `NG`, `ZA`; the current cooperative code uses
`US_METRO`, `KENYA`, `NIGERIA`, `SOUTH_AFRICA`, `OTHER`. Choose one canonical
wire/storage vocabulary before creating rate-card or matching queries. The
recommended external/API values are:

```json
{
  "regions": ["US_METRO", "KE", "NG", "ZA"],
  "currencies": ["USD", "KES", "NGN", "ZAR"],
  "serviceTypes": [
    "WHATSAPP_STATUS",
    "FB_POST",
    "DEDICATED_CAMPAIGN",
    "EVENT_APPEARANCE"
  ]
}
```

The internal pool labels can remain backward-compatible through an explicit
mapping, but should not become the advertiser API vocabulary.

### Module 2 — advertiser access and campaign management

| Requirement | Current state | Advisory finding |
|---|---|---|
| Advertiser identity and access | Accounts exist; campaign ownership is creator/host-oriented; `brandId` appears in partnership requests but is not an advertiser domain | **Not built as a proper advertiser role.** Add `advertiserProfiles` and permissions. Do not overload creator ownership. |
| Budget submission | Campaign price and order totals exist; no campaign budget/reserved amount model | **Not built.** A budget is not the same as an event ticket price. |
| Rate-card matching | No rate-card matrix or matching query | **Not built.** Needs region, service, minimum interaction and availability joins. |
| Queue bandwidth | `queue.js` is an in-process ingestion queue with concurrency one | **Not the requested capacity model.** Add explicit creator availability/queue reservations; do not infer capacity from the ingestion queue. |
| Micro-payments | Ledger/payment intent state machine and Tuma collection exist | **Provider-unwired.** Tuma is collection only in this repository; there is no selected payout provider. |
| Escrow / communal pot | Cooperative pools exist and ledger has `held` | **Partial.** There is no advertiser escrow object, release policy, dispute window or cross-campaign allocation transaction. |
| M-Pesa B2C / Korapay | No active connector/provider registration | **Not built.** Never label payouts live until a provider is selected, credentialed and callback-tested. |

### Module 3 — automated content pipeline and embedded links

| Requirement | Current state | Finding |
|---|---|---|
| Link generation | `distribution.trackedLink()` creates a campaign URL with UTM parameters | **Partial.** It is a real tracked link, but not a short URL or an immutable `unique_tracking_hash` per ad asset. |
| Click recording | `clickEvents` and campaign click analytics exist | **Built for clicks.** Registration and payment are not yet joined to the originating click. |
| WhatsApp Status banner | No image-generation, compression, storage or share-kit route | **Not built.** A downloadable status-ready asset is feasible; automatic posting to a creator's personal Status must not be assumed. |
| WhatsApp send | Twilio adapter can send WhatsApp messages when configured | **Different capability.** Message send is not Status publishing. |
| Facebook card | `/c/:slug` gets server-side `og:*` tags for crawlers | **Partial/built for link preview.** Open Graph is metadata consumed by Facebook and other crawlers; it is not a Facebook Page publishing API. |
| Optimized copy | `assist.js` exposes a provider seam only | **Configuration required.** No model is connected and no AI output can be trusted or auto-published. |
| Downloadable media | Media is URL-based and resolves only real associated images | **Partial.** No durable object storage or image transform service exists. |

### Module 4 — chronology and vendor syndication

| Requirement | Current state | Finding |
|---|---|---|
| Unified calendar | Campaign dates, capacity, tickets and check-in exist | **Partial.** No cross-campaign/event calendar projection or calendar API. |
| Expiration-bounded waiting list | No wait-list collection, reservation timeout or promotion policy | **Not built.** Requires a durable scheduler/worker and an idempotent state machine. |
| Notify adjacent backups | Notifications exist; outbound seam exists | **Partial.** The delivery rails are not all configured and there is no wait-list event to trigger them. |
| Vendor syndication | Vendor/listing/order/fulfilment and vendor requests exist in Vault | **Partial.** Transport, print vendor, POD and capability matching are absent. |
| Trust markers | Community verification evidence, fulfilled/settled sale facts and member evidence exist | **Partial.** No explicit licensing, historical-performance policy, escrow compatibility or staff recommendation model. |

---

## 4. Recommended canonical data model

The prompt's names should be translated into Brief's existing ownership and
money rules rather than copied literally.

### 4.1 Identity and creator profile

```json
{
  "creatorProfile": {
    "id": "cp_...",
    "personId": "person_...",
    "name": "Creator display name",
    "preferredLanguage": "en",
    "regions": ["KE"],
    "niche": ["events", "fashion"],
    "externalSocialLinks": {
      "instagram": "https://...",
      "facebook": "https://..."
    },
    "status": "active"
  }
}
```

`personId` is the authority. Telegram IDs, WhatsApp IDs, phone numbers and
handles must enter through the existing verified-alias rules. `externalSocialLinks`
are links, not proof that an account belongs to the person.

### 4.2 Rate card

```json
{
  "rateCard": {
    "id": "rate_...",
    "creatorId": "person_...",
    "serviceType": "WHATSAPP_STATUS",
    "basePrice": "1500.00",
    "currency": "KES",
    "regions": ["KE"],
    "fulfillmentMetrics": {
      "turnaroundHours": 24,
      "requiredAssets": ["image", "copy"]
    },
    "availability": "open",
    "status": "published",
    "version": 1
  }
}
```

Use a decimal/numeric value in PostgreSQL or integer minor units at the
provider boundary. Do not use JavaScript floating-point arithmetic for
settlement. A rate card is a quote/offer; it is not a payment and does not
create a ledger row until a real commitment exists.

### 4.3 Advertiser campaign

This should be separate from the current event campaign only when the
semantics differ. The recommended design is an `advertiserCampaigns` row that
can optionally point to a public Brief `campaignId` or `objectId`:

```json
{
  "advertiserCampaign": {
    "id": "adcamp_...",
    "advertiserId": "person_...",
    "campaignId": "camp_...",
    "name": "Launch campaign",
    "budget": "50000.00",
    "currency": "KES",
    "targetRegions": ["KE"],
    "targetNiches": ["fashion"],
    "minInteractionThreshold": {
      "views": 100,
      "settledCampaigns": 1
    },
    "status": "matching",
    "expiresAt": "2026-09-15T00:00:00.000Z"
  }
}
```

The budget lifecycle should be explicit:

```text
draft → submitted → funding_pending → funded → matching → active
      → fulfilment_review → settling → completed
      ↘ rejected / cancelled / expired
```

The budget is not `distributedPayouts`. Funds held, fees, creator payouts,
refunds and releases are separate linked rows in the existing
`ledgerTransactions` collection/table and are derived into views.

### 4.4 Ad asset / vault row

```json
{
  "adAsset": {
    "id": "asset_...",
    "advertiserCampaignId": "adcamp_...",
    "creatorId": "person_...",
    "targetPlatform": "WHATSAPP_STATUS",
    "baseRedirectUrl": "https://brief.example/c/...",
    "uniqueTrackingHash": "opaque-server-generated-value",
    "mediaAssetUrl": "https://cdn.example/...",
    "optimizedCopyText": "...",
    "status": "approved",
    "createdAt": "2026-08-24T00:00:00.000Z"
  }
}
```

The hash must be generated server-side, unique, non-sequential and treated as
a lookup key rather than a password. The redirect endpoint should resolve the
hash to a campaign and record a click, then redirect only to an allow-listed
Brief destination. It must not accept an arbitrary redirect URL from the
client.

### 4.5 Matching and reservations

These are the missing joins that make the advertiser promise honest:

```json
{
  "campaignMatch": {
    "id": "match_...",
    "advertiserCampaignId": "adcamp_...",
    "creatorId": "person_...",
    "rateCardId": "rate_...",
    "matchReason": {
      "region": true,
      "niche": true,
      "interactionThreshold": true,
      "queueAvailable": true
    },
    "status": "proposed",
    "expiresAt": "2026-08-26T00:00:00.000Z"
  },
  "queueReservation": {
    "id": "qres_...",
    "creatorId": "person_...",
    "campaignMatchId": "match_...",
    "capacityUnits": 1,
    "status": "held",
    "expiresAt": "2026-08-26T00:00:00.000Z"
  }
}
```

A reservation must be created transactionally with the matching decision. The
current JSON store cannot guarantee this across multiple processes; this is a
hard reason to complete the PostgreSQL adapter before enabling paid matching.

### 4.6 Calendar and wait list

```json
{
  "calendarEntry": {
    "id": "cal_...",
    "kind": "campaign",
    "sourceId": "adcamp_...",
    "startsAt": "2026-09-01T10:00:00.000Z",
    "endsAt": "2026-09-01T18:00:00.000Z",
    "status": "scheduled"
  },
  "waitlistEntry": {
    "id": "wait_...",
    "campaignId": "camp_...",
    "personId": "person_...",
    "position": 2,
    "status": "waiting",
    "offerExpiresAt": null
  }
}
```

The wait-list state machine should be:

```text
waiting → offered → reserved → registered
       ↘ expired / withdrawn
```

A worker, not a browser render, should transition expired offers and release
reservations. Every worker action needs an idempotency key such as
`waitlistEntryId:transition:version`.

---

## 5. Screen and shelf allocation

Brief has four primary destinations: **Home, Play, Saved and Inbox**. The Yard
Engine should not add a fifth top-level destination. Allocate capability under
the existing secondary navigation.

| Screen | Existing job | New shelf allocation | Do not put here |
|---|---|---|---|
| **Home** | Public discovery feed, Tea, public objects and public campaign entry | Public promoted placements, creator/event cards and public ad landing links. Use the safe `/api/public/feed` projection. | Advertiser budgets, rate-card editing, private match data, creator payout details |
| **Play** | Arena players, challenges, lobbies, tournaments and results | No core Yard Engine shelf. A sponsored Arena event may be a public campaign/object and enter Home or a campaign page. | Advertising operations, escrow controls, audience targeting or vendor fulfilment |
| **Saved** | Personal saves, activity, circles, campaigns, profile/media kit, opportunities, messages, subscriptions | **Creator profile**, rate cards, external social links, creator availability, incoming brand opportunities and the creator's shareable media kit. Existing `mediakit`, `opportunities` and `messages` sections are the natural landing points. | Advertiser-wide campaign queue, platform delivery logs and system-wide analytics |
| **Inbox** | Workflows/host tools: Create, Dashboard, Open/Done, Review, Feeds, Payments, Records, Check-in and Editor | **Primary operations shelf:** advertiser campaign creation, match review, distribution kits, calendar, wait list, vendor syndication, automation and escrow status. Add secondary sections rather than a new destination. | Public discovery cards and social browsing |
| **Menu sheet** | Cross-screen shortcuts and host value card | Add an `Advertise`/`Brand campaigns` shortcut only after role/access rules exist. Use it as an entry point, not a data model. | Hidden admin bypasses or direct provider credential controls |
| **Public API** | External read surface | `/api/public/feed`, public campaign pages, tracked redirects and later public asset-kit reads. | Private source membership, creator rate-card drafts, match scores or payout data |

### Proposed Inbox secondary sections

The current Workflows/InBox sections can absorb the proposal as follows:

| Proposed section | Existing section to extend | Primary content |
|---|---|---|
| `Campaigns` | `Create` + `Dashboard` | Advertiser briefs, budgets, lifecycle and creator-owned campaigns |
| `Matches` | `Review` | Suggested creators, rate cards, accept/decline, reservation expiry |
| `Distribution` | `Dashboard` + `Sources` | Asset kits, tracking hashes, channel readiness, click attribution |
| `Calendar` | `Open`/`Done` or a new Workflows secondary tab | Campaign/event dates, wait-list state, expiring offers |
| `Vendors` | `Records`/Vault | Supplier, transport, printing and fulfilment tickets |
| `Payments` | Existing `Money` | Funding, held ledger rows, settlement and payout availability |
| `Automation` | Existing `Create`/Creator Cockpit | Trigger → condition → action rules for the new signal types |
| `AI review` | Existing `Editor`/Review | Draft copy, match explanations and asset suggestions awaiting human approval |

### Proposed feature-registry shelves

Add independently toggleable entries rather than scattering flags through the
UI:

| Feature key | Domain/route shelf | Depends on | Current state |
|---|---|---|---|
| `creator_profiles` | `domain/creatorProfile.js`, `/api/creator/profile` | `people`, `auth` | **NOT BUILT** |
| `rate_cards` | `domain/rateCard.js`, `/api/creator/rate-cards` | `creator_profiles` | **NOT BUILT** |
| `advertising` | `domain/advertising.js`, `/api/advertising/*` | profiles, rate cards, campaigns, ledger | **NOT BUILT** |
| `matching` | `domain/matching.js`, `/api/advertising/:id/matches` | advertising, signals, reservations | **NOT BUILT** |
| `ad_assets` | `domain/adAsset.js`, public/private kit routes | advertising, media, distribution | **NOT BUILT** |
| `calendar` | `domain/calendar.js`, `/api/calendar/*` | campaigns, wait list, worker | **NOT BUILT** |
| `vendor_syndication` | vendor capability/fulfilment routes | vendors, orders, Vault | **PARTIAL** |
| `automation` | existing `workflow` domain/routes | signals, outbound | **BUILT**, needs new triggers/actions |
| `ai_engine` | existing `assist` provider seam | review/editorial authorization | **CONFIGURATION REQUIRED** |
| `payouts` | existing provider/settlement shelf | selected disbursement provider | **UNWIRED** |
| `public_feed` | existing feed/public projection route | public objects, media | **BUILT** |

---

## 6. Cross-platform automation design

### 6.1 Social boundary rule

Telegram and WhatsApp should remain **input and delivery adapters**, not the
source of operational truth.

```text
social event
  → verify signature / session
  → normalize inbound payload
  → rawItems / signals
  → domain state transition
  → workflow action
  → optional outbound message or downloadable asset
```

A WhatsApp message saying that a campaign was paid does not settle a ledger
row. A creator accepting a match in WhatsApp does not consume a queue slot until
the server receives a verified action. A click is not a registration, and a
registration is not a paid fulfilment.

### 6.2 Signal types to add

The current `signals` collection and workflow engine are the correct attach
point. Add explicit events for:

```text
advertiser_campaign_submitted
advertiser_campaign_funded
creator_match_proposed
creator_match_accepted
creator_match_declined
queue_reservation_expiring
queue_reservation_released
ad_asset_approved
ad_asset_issued
tracked_asset_clicked
campaign_registration_attributed
campaign_fulfilment_verified
advertiser_campaign_expired
payout_ready
payout_failed
```

Each signal should carry IDs and a correlation ID, not a copied financial
amount or a free-form identity claim.

### 6.3 State-toggle handlers

The handlers should be provider-neutral and idempotent:

```js
async function acceptCreatorMatch(matchId, actorId) {
  // 1. Verify actor is the matched creator.
  // 2. Re-read the match and ensure it is still proposed and unexpired.
  // 3. Transactionally claim/reconfirm the queue reservation.
  // 4. Move match -> accepted.
  // 5. Emit creator_match_accepted.
  // 6. Let a workflow notify the advertiser; do not send from the UI.
}

async function issueDistributionKit(assetId, actorId) {
  // 1. Verify campaign ownership or creator assignment.
  // 2. Require approved asset + active campaign.
  // 3. Resolve the opaque tracking hash server-side.
  // 4. Return copy, download URL and public redirect URL.
  // 5. Emit ad_asset_issued. Never claim that a social post was published.
}

async function expireWaitlistOffer(entryId) {
  // 1. Re-read the entry and compare the server clock.
  // 2. If still offered and expired, release the reservation.
  // 3. Move entry -> expired and offer the next waiting entry once.
  // 4. Emit queue_reservation_released.
  // 5. Notify through the configured outbound provider or record not_configured.
}
```

No handler should accept `advertiserId`, `creatorId`, payout amount or payment
status from an untrusted body when those values can be derived from the
session, match, campaign or ledger rows.

### 6.4 AI boundary rule

Extend `assist.js` rather than building an independent AI service inside the
UI. The provider contract should return a suggestion with provenance:

```json
{
  "task": "suggest_copy",
  "suggestion": {
    "headline": "...",
    "body": "...",
    "cta": "..."
  },
  "provider": "configured-provider",
  "model": "model-id",
  "promptVersion": "v1",
  "sourceIds": ["object_...", "campaign_..."],
  "requiresApproval": true
}
```

Allowed AI tasks:

- classify a campaign brief;
- suggest creator matches with reasons from explicit fields;
- draft copy and a CTA;
- generate an image search/creative brief;
- cluster or summarize already-authorized content.

Disallowed direct AI writes:

- publish an object or Tea article without an editor;
- mark a creator verified;
- accept a match on behalf of a creator;
- settle, refund or release money;
- infer that two social accounts are the same person;
- claim a social post was delivered without a provider receipt.

Private source content must be field-allow-listed before it is sent to a model.
Prompt injection in source messages must be treated as data, not instructions.

---

## 7. What is missing, blocked or likely to fail

| Capability | Status | Why it will fail if attempted now | Shelf allocation |
|---|---|---|---|
| PostgreSQL/Supabase schema | **NOT BUILT** | JSON store has no SQL indexes, RLS, multi-writer transactions or durable job claims | Persistence/platform, before paid matching |
| Creator profile record | **NOT BUILT** | `people` is identity, not creator preferences/links/niche | Saved → Profile |
| Service rate cards | **NOT BUILT** | Listing price range is not a service quote | Saved → Media kit |
| Advertiser role/profile | **NOT BUILT** | Current campaign owner is not a brand/advertiser principal | Inbox → Campaigns |
| Budget and escrow policy | **NOT BUILT** | `held` ledger status alone has no allocation/release/dispute policy | Inbox → Payments |
| Creator matching | **NOT BUILT** | No rate-card, region, threshold or bandwidth joins | Inbox → Matches |
| Persistent reservation queue | **NOT BUILT** | Current `queue.js` is an ingestion queue, not a creator-capacity ledger | Inbox → Matches/Calendar |
| Ad vault / asset lifecycle | **NOT BUILT** | No ad asset record, hash, storage or approval lifecycle | Inbox → Distribution |
| Short/opaque tracking hash | **PARTIAL** | UTM links and click rows exist, but no per-asset hash/shortener | Public API + Distribution |
| Click → registration attribution | **NOT BUILT** | Registration does not persist the originating click/asset key | Inbox → Distribution/Analytics |
| WhatsApp Status auto-publish | **NOT BUILT / platform-dependent** | Twilio send is not Status publishing; no approved creator-posting adapter exists | Distribution, behind provider gate |
| WhatsApp downloadable banner | **NOT BUILT** | No image processing or durable object storage | Distribution |
| Facebook publishing | **NOT BUILT** | Open Graph preview exists; Graph Page publishing/auth is separate | Distribution |
| Calendar and wait list | **NOT BUILT** | Campaign dates/capacity do not implement waiting-list semantics | Inbox → Calendar |
| Expiry worker | **PARTIAL** | Workflow sweep exists, but no time-based wait-list worker or durable locks | Server worker |
| Vendor transport/print/POD | **NOT BUILT** | Vendor/listing/order model has no capability or external fulfilment adapters | Inbox → Vendors |
| Licensing/performance trust markers | **PARTIAL** | Evidence/facts exist, but no structured compliance documents or review policy | Saved → Profile / Inbox → Vendors |
| AI copy/matching | **CONFIGURATION REQUIRED** | `AI_PROVIDERS` empty; no model, moderation or cost controls | Inbox → AI review |
| Tuma collection | **CONFIGURATION REQUIRED** | Connector is present but credentials/public callback are absent | Inbox → Payments |
| B2C/payout rail | **UNWIRED** | `DISBURSEMENT_PROVIDERS` is empty | Inbox → Payments |
| KRA/iTax integration | **NOT BUILT** | No tax connector or reporting/export contract | Operations/compliance, not Home |
| Cross-border compliance | **NOT BUILT** | No KYC, sanctions, tax, consent or regional payout policy | Platform/compliance gate |
| Automated outbound receipts/reminders | **CONFIGURATION REQUIRED** | Twilio seam exists but no configured sender/callback delivery state | Workflows |

---

## 8. Dependency-ordered implementation plan

### Phase 0 — choose the foundation before money

1. Decide whether Supabase/PostgreSQL is the production source of truth.
2. Implement a store adapter so the current JSON store remains a development
   adapter, not a second production database.
3. Add tenant/organization authorization for creator and advertiser roles.
4. Normalize region and currency enums.
5. Add request/operation correlation IDs and durable audit events.
6. Add RLS and indexes for `personId`, `creatorId`, `advertiserId`, campaign
   status, region, currency, expiry and tracking hash.

**Gate:** two concurrent requests cannot reserve the same creator capacity or
spend the same advertiser budget.

### Phase 1 — identity, profiles and rates

1. Add `creatorProfiles` keyed to `people`.
2. Add `rateCards` and availability windows.
3. Add advertiser profile/role and role-scoped UI.
4. Surface Profile/Media kit and rate cards under Saved.
5. Keep current vendor profile as the fulfilment/commercial identity.

**Gate:** no rate card can be published without a real creator/person; a client
cannot change creator ownership through a PATCH.

### Phase 2 — advertiser campaign and matching

1. Add advertiser campaign lifecycle and budget fields.
2. Add `campaignMatches` and `queueReservations`.
3. Implement server-side matching using explicit region, niche, rate, metrics
   and availability fields.
4. Add accept/decline/expiry transitions and Inbox → Matches UI.
5. Emit the signal types listed above.

**Gate:** a match is explainable from stored fields; no AI-only match is binding;
expired reservations release once and only once.

### Phase 3 — asset vault and public distribution

1. Add `adAssets` with server-generated tracking hash.
2. Add object storage/CDN abstraction and image validation/compression.
3. Add creator/advertiser approval lifecycle.
4. Add `/api/advertising/:id/distribution-kit` and public hash redirect.
5. Join click events to registration attribution.
6. Extend the existing server-side Open Graph implementation instead of
   inventing a second social preview system.

**Gate:** every redirect is allow-listed, every click is attributable to one
asset, and asset generation never claims social delivery.

### Phase 4 — chronology, vendor operations and worker

1. Add calendar projection and wait-list entries.
2. Replace the in-process-only expiry path with a durable worker/job claim.
3. Add transport, printer and POD vendor capabilities as adapters.
4. Add fulfilment tickets in Vault and Workflows → Vendors.
5. Add structured licensing/compliance evidence with expiry.

**Gate:** restarts cannot lose a wait-list transition; every notification is
idempotent and reports provider-unavailable when sending is not configured.

### Phase 5 — money and provider enablement

1. Define advertiser funding/escrow policy and dispute/refund windows.
2. Map funding, holds, fees, creator earnings and releases to the one ledger.
3. Configure and live-test Tuma collection.
4. Select and implement a disbursement provider separately.
5. Add reconciliation and provider callback receipts.
6. Add regional/KYC/tax gates before enabling cross-border or real-money flows.

**Gate:** no budget is marked funded without a real settled provider-backed
transaction; no creator payout is marked paid without a provider receipt.

### Phase 6 — AI enablement

1. Register a real provider behind `AI_PROVIDERS`.
2. Add cost, rate, timeout, redaction and moderation controls.
3. Store model/prompt/source provenance with every suggestion.
4. Add human approval UI under Inbox → AI review.
5. Enable only drafting/recommendation tasks first.

**Gate:** disabling the provider leaves the rest of Brief working and produces
an honest `no_provider` response; no AI suggestion can directly mutate money,
identity or publication state.

---

## 9. API surface to add later

These are the recommended route shelves; they are not present today unless
noted.

```text
GET    /api/creator/profile
PATCH  /api/creator/profile
GET    /api/creator/rate-cards
POST   /api/creator/rate-cards
PATCH  /api/creator/rate-cards/:id

GET    /api/advertisers/me
POST   /api/advertising/campaigns
GET    /api/advertising/campaigns
GET    /api/advertising/campaigns/:id
POST   /api/advertising/campaigns/:id/submit
GET    /api/advertising/campaigns/:id/matches
POST   /api/advertising/matches/:id/accept
POST   /api/advertising/matches/:id/decline

POST   /api/advertising/assets
POST   /api/advertising/assets/:id/approve
GET    /api/advertising/assets/:id/distribution-kit
GET    /api/public/ad/:trackingHash

GET    /api/calendar
GET    /api/calendar/:id/waitlist
POST   /api/calendar/:id/waitlist
POST   /api/waitlist/:id/accept

GET    /api/ai/status
POST   /api/ai/suggest
```

All private routes need session/role checks. Public asset redirects and public
feed reads must use allow-listed projections. Public APIs must never become a
shortcut around campaign ownership, source membership or payment authority.

---

## 10. Final recommendation

### Safe to push into Brief now

- Use the existing public feed and public campaign surface as the distribution
  discovery layer.
- Use `people` and verified aliases as the identity base.
- Extend `partnership` into a real creator profile/media-kit shelf.
- Add rate cards, advertiser profiles and campaigns as new domain modules.
- Reuse `signals`, `workflow`, `outbound`, `campaigns`, Vault and the one ledger.
- Put all operational UI under Saved and Inbox; keep Play unchanged.

### Do not claim yet

- automatic WhatsApp Status posting;
- automatic Facebook publishing;
- live escrow or creator payout;
- KRA/iTax reporting;
- cross-channel identity matching from names/handles alone;
- AI-generated content as published fact;
- wait-list activation without a durable worker;
- multi-region production safety on the JSON store.

**Bottom line:** Brief has enough existing architecture to host the Yard Engine,
but the next build should be a **creator/advertiser operations vertical** with
its own profile, rate, matching, asset and calendar shelves. It must plug into
Brief's existing person, signal, campaign, Vault and ledger authorities rather
than introducing parallel identities, parallel ledgers or social-platform
claims the connectors cannot actually perform.
