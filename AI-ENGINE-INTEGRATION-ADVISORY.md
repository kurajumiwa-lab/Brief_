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

The proposal is now **partially implemented as a working Yard Engine vertical**.
The remaining gaps are deliberate provider or production boundaries:

1. PostgreSQL/Supabase persistence and transactional reservation semantics.
2. Durable multi-process worker claims for expiry and queue reservations.
3. Live escrow collection and merchant disbursement.
4. Automated WhatsApp Status and Facebook publishing adapters.
5. Durable object storage/image compression for generated media.
6. A configured AI provider and human-reviewed AI generation flow.
7. Full cross-border compliance, KRA/iTax reporting and provider-specific
   settlement certification.

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
| Creator-facing layer | `creatorProfile.js`, `partnership.js`, media-kit projection, creator opportunities, subscriptions, vendor identity | **BUILT for profiles/rate cards; media-kit/partnership remains partial** |
| Campaign/event wrapper | `campaigns`, lifecycle, public slug, capacity, registrations, ticketing and check-in | **BUILT for events/drops; advertiser campaign layer now added** |
| Public feed | `GET /api/public/feed`, public-only projection, CORS, geo ranking, `limit`, cache headers; `/api/feed` alias | **BUILT** |
| Public campaign distribution | `/api/public/campaigns/:slug`, server-side Open Graph injection, share-intent links | **BUILT for campaign pages** |
| Tracking | `distribution.trackedLink`, `clickEvents`, UTM source/medium/content, click analytics; advertiser asset hashes and registration attribution | **BUILT for local loop; shortener/persistent analytics still partial** |
| Advertiser campaigns and matching | `advertising.js`, advertiser profiles, rate cards, campaign matches, queue reservations, manual funding attestation | **BUILT locally; provider funding/disbursement remains blocked** |
| Ad distribution kits | `adAssets`, approval/issue lifecycle, public hash redirect, WhatsApp copy kit and Facebook OG payload | **BUILT as a download/copy kit; automatic publishing/media transform unavailable** |
| Outbound messaging | `outbound.js` plus Twilio SMS/WhatsApp-send adapter | **CONFIGURATION REQUIRED**; no credentials or delivery callbacks |
| Telegram / WhatsApp input | Telegram webhook/pull and WhatsApp inbound DM paths | **BUILT**, subject to platform credentials; WhatsApp group ingestion is intentionally unsupported |
| TikTok input/output | No TikTok connector, webhook, publisher or import contract | **NOT BUILT** |
| AI seam | `assist.js`, task/provider abstraction, fail-closed behavior | **CONFIGURATION REQUIRED**; `AI_PROVIDERS` is empty |
| Workflow automation | `workflows`, `workflowRuns`, trigger/condition/action engine, periodic signal sweep, `CreatorCockpit` UI | **BUILT**, but not yet an advertiser-specific orchestration layer |
| Payments | Tuma collection connector, payment intents, confirmation and ledger state machine | **CONFIGURATION REQUIRED**; no live credentials and no sandbox |
| Escrow/disbursement | `held` ledger status, advertising funding, derived 5% split plan and provider seam | **PARTIAL / NOT AVAILABLE**; live collection and `DISBURSEMENT_PROVIDERS` remain absent |
| Cooperatives | `pools`, `poolMembers`, `poolRotations`, contributions through the shared ledger | **BUILT for cooperative savings; not connected to advertising escrow** |
| Vendors | vendors, listings, orders, fulfilment, disputes, trust evidence, capability declarations | **PARTIAL**; no transport/print/POD provider adapters or operator license route |
| Calendar | `calendar.js`, calendar entries, public campaign wait list, offer/expiry sweeper | **BUILT on JSON adapter; durable multi-process worker still required** |
| Persistence | synchronous JSON document store, named collections, schema version/migrations; supplemental `server/sql/yard-engine.sql` target | **SCHEMA PREPARED; runtime adapter is not ready for multi-replica production** |

The current feature registry already provides the correct pattern for shelf
allocation: a feature can report `enabled`, `configured` and `available`, and a
deploy can disable a feature without pretending it works.

---

## 3. Structural fit by requested module

### Module 1 — data core and metric spreadsheets

| Requested node | Closest Brief node | Finding | Required secondary development |
|---|---|---|---|
| `creators_profile` | `people`, `personAliases`, `creatorProfile.js`, `vendors`, derived `partnership.mediaKit` | A canonical profile is now persisted against `personId`, with language, regions, niches and validated social links. | **Implemented.** Keep `people` as identity and `creatorProfiles` as creator metadata; do not duplicate identity. |
| `rate_cards` | `creatorProfile.js`, `/api/creator/rate-cards` | Service-specific pricing now supports all four requested tiers, regions, currencies, availability and draft/published versions. | **Implemented locally.** Matching uses published cards; decimal/transactional DB work remains. |
| `campaign_ledger` | `advertising.js`, `campaigns`, `ledgerTransactions`, campaign analytics | Advertiser campaigns, manual funding, held escrow rows, derived reservations and 5% payout plans now exist. A second ledger would still violate the one-money-source rule. | **Implemented as an advertiser wrapper.** `distributedPayouts` remains derived; all money stays in `ledgerTransactions`. |
| `curated_ads_vault` | `advertising.js`, `adAssets`, `distribution.js`, `clickEvents`, media association | Ad assets now have approval/issue lifecycle, unique tracking hashes, public redirects, media URL and copy fields. | **Implemented as metadata/URL storage.** Binary media storage and compression remain unbuilt. |
| PostgreSQL/Supabase | `server/src/store.js` JSON store + `server/sql/yard-engine.sql` target migration | A relational target, constraints and indexes are now documented, but no runtime adapter, RLS policy or multi-writer transaction is active. | **Schema prepared; adapter not wired.** Add the adapter before enabling concurrent paid allocation. |

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
| Advertiser identity and access | `advertiserProfiles` tied to `people`; advertiser routes are session-scoped | **Implemented for one advertiser role.** Organization/team roles and approval policy remain. |
| Budget submission | `advertiserCampaigns`, budget/currency/targets, submitted and funding-pending states | **Implemented.** Funding is manual-attestation fallback until Tuma collection is configured. |
| Rate-card matching | `advertising.allocate()` joins active creator profiles, published rate cards, region/niche/service and derived interactions | **Implemented locally.** Matching is explainable; database locking is still required for production. |
| Queue bandwidth | `queueReservations` with max active allocation, offer expiry and release state | **Implemented locally.** The JSON adapter cannot provide multi-writer atomic reservation. |
| Micro-payments | Shared ledger, funding transaction and provider-neutral settlement plan | **Partial.** Tuma collection exists but is not live; paid funding endpoint is not yet provider-wired. |
| Escrow / communal pot | Advertiser escrow funding in `ledgerTransactions`, `held` state, derived 5% split, retryable payout block; pools remain separate | **Partial.** Dispute/refund/release policy and live payout provider remain. |
| M-Pesa B2C / Korapay | No active connector/provider registration | **Not built.** Never label payouts live until a provider is selected, credentialed and callback-tested. |

### Module 3 — automated content pipeline and embedded links

| Requirement | Current state | Finding |
|---|---|---|
| Link generation | `advertising.createAsset()`, `uniqueTrackingHash`, `distributionKit()`, public `/api/public/ad/:trackingHash`; existing `distribution.trackedLink()` remains | **Built for opaque asset redirects.** A dedicated short domain/edge cache is still optional work. |
| Click recording | `recordAssetClick()`, `clickEvents`, campaign registration `trackingHash`, derived attribution analytics | **Built for the local loop.** Multi-touch attribution and consent controls remain. |
| WhatsApp Status banner | Distribution kit returns media URL, one-click copy caption and explicitly `autoPublish:false` | **Built as a safe copy/download kit.** No personal Status publishing is claimed. |
| WhatsApp send | Twilio adapter can send WhatsApp messages when configured | **Different capability.** Message send is not Status publishing. |
| Facebook card | Distribution kit returns Open Graph tags; `/c/:slug` already gets server-side `og:*` tags | **Built for link preview.** Facebook Page publishing/auth remains unbuilt. |
| Optimized copy | `assist.js` exposes a provider seam; UI exposes AI review status | **Configuration required.** No model is connected and no AI output can be trusted or auto-published. |
| Downloadable media | Ad asset accepts a real media URL and kit surfaces it | **Partial.** No durable object storage, compression or transform service exists. |

### Module 4 — chronology and vendor syndication

| Requirement | Current state | Finding |
|---|---|---|
| Unified calendar | `calendar.js`, calendar entries, owner checks and Workflows → Calendar shelf | **Built on the JSON adapter.** Cross-region calendar sync and durable jobs remain. |
| Expiration-bounded waiting list | `waitlistEntries`, public join/accept routes, offer expiry and promotion sweep | **Built for one process.** Durable worker claims and notification delivery remain. |
| Notify adjacent backups | `waitlist_offered`/`waitlist_expired` signals and workflow/outbound seams | **Partial.** The event path exists; provider delivery is configuration-dependent. |
| Vendor syndication | `vendorSyndication.js`, capability declarations, escrow flag, performance evidence, vendor route | **Partial.** Transport, print vendor, POD adapters and operator-only license verification still need deployment work. |
| Trust markers | Community verification evidence, fulfilled/settled sale facts, capability license marker and recommendations | **Partial.** No external compliance registry or fully separated operator role is configured. |

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
| **Inbox** | Workflows/host tools: Create, Dashboard, Open/Done, Review, Feeds, Payments, Records, Check-in and Editor | **Primary operations shelf:** advertiser campaign creation, match review, distribution kits, calendar, wait list, vendor syndication, automation and escrow status. The new Yard shelves are secondary tabs, not a new destination. | Public discovery cards and social browsing |
| **Menu sheet** | Cross-screen shortcuts and host value card | `Advertise`, `Matches`, `Distribution` and `Calendar` now open the corresponding Inbox shelves. The menu is an entry point, not a data model. | Hidden admin bypasses or direct provider credential controls |
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
| `creator_profiles` | `domain/creatorProfile.js`, `/api/creator/profile`, `/api/creator/rate-cards` | `people`, `auth` | **BUILT locally** |
| `rate_cards` | `creatorProfile.js`, `/api/creator/rate-cards` | `creator_profiles` | **BUILT locally** |
| `advertising` | `domain/advertising.js`, `/api/advertising/*` | profiles, rate cards, campaigns, ledger | **BUILT locally** |
| `matching` | `advertising.allocate()`, `/api/advertising/matches/*` | advertising, signals, reservations | **BUILT locally** |
| `ad_assets` | `adAssets`, `/api/advertising/assets/*`, `/api/public/ad/*` | advertising, media, distribution | **BUILT as kit/redirect** |
| `calendar` | `domain/calendar.js`, `/api/calendar/*`, `/api/waitlist/*` | campaigns, wait list, worker | **BUILT on JSON adapter** |
| `vendor_syndication` | `vendorSyndication.js`, `/api/vendors/:id/capabilities` | vendors, orders, Vault | **PARTIAL** |
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
| PostgreSQL/Supabase runtime adapter | **NOT BUILT** | `server/sql/yard-engine.sql` supplies the target constraints/indexes, but the JSON store still has no SQL transactions, RLS or durable job claims | Persistence/platform, before paid matching |
| Creator profile record | **BUILT locally** | `creatorProfile.js` stores profile metadata against `people`; production DB adapter remains | Saved → Profile |
| Service rate cards | **BUILT locally** | Four service tiers, currency/region, availability and versioning exist | Saved → Media kit |
| Advertiser role/profile | **BUILT locally** | `advertiserProfiles` is tied to `people`; organization/team roles remain | Inbox → Campaigns |
| Budget and escrow policy | **PARTIAL** | Manual funding creates a held ledger transaction; provider funding, disputes and refunds remain | Inbox → Payments |
| Creator matching | **BUILT locally** | Region, niche, interaction, service and active allocation checks are explicit | Inbox → Matches |
| Persistent reservation queue | **PARTIAL** | `queueReservations` and expiry exist; JSON adapter is not safe for multi-writer claims | Inbox → Matches/Calendar |
| Ad vault / asset lifecycle | **BUILT as metadata/URL** | `adAssets` has hash, approval and issue states; binary storage/compression remains | Inbox → Distribution |
| Short/opaque tracking hash | **BUILT** | Per-asset random hash and public redirect exist; dedicated short-domain/edge cache is optional | Public API + Distribution |
| Click → registration attribution | **BUILT for one touch** | Registration stores the validated tracking hash and campaign analytics derives attribution; multi-touch remains | Inbox → Distribution/Analytics |
| WhatsApp Status auto-publish | **NOT BUILT / platform-dependent** | Twilio send is not Status publishing; the kit deliberately returns `autoPublish:false` | Distribution, behind provider gate |
| WhatsApp downloadable banner | **PARTIAL** | Existing media URL can be issued; image processing and durable object storage remain | Distribution |
| Facebook publishing | **PARTIAL** | Open Graph kit and campaign preview exist; Graph Page publishing/auth remains | Distribution |
| Calendar and wait list | **BUILT on JSON adapter** | Calendar entries, public wait-list join/offer/accept and capacity release exist | Inbox → Calendar |
| Expiry worker | **PARTIAL** | Minute sweep hook exists and is unref'd; durable job claims remain | Server worker |
| Vendor transport/print/POD | **PARTIAL** | Capability declarations and evidence exist; provider adapters remain | Inbox → Vendors |
| Licensing/performance trust markers | **PARTIAL** | Capability license marker, recommendations and derived order evidence exist; operator/registry integration remains | Saved → Profile / Inbox → Vendors |
| AI copy/matching | **CONFIGURATION REQUIRED** | `AI_PROVIDERS` empty; no model, moderation or cost controls | Inbox → AI review |
| Tuma collection | **CONFIGURATION REQUIRED** | Connector is present but credentials/public callback are absent | Inbox → Payments |
| B2C/payout rail | **UNWIRED** | `DISBURSEMENT_PROVIDERS` is empty | Inbox → Payments |
| KRA/iTax integration | **NOT BUILT** | No tax connector or reporting/export contract | Operations/compliance, not Home |
| Cross-border compliance | **NOT BUILT** | No KYC, sanctions, tax, consent or regional payout policy | Platform/compliance gate |
| Automated outbound receipts/reminders | **CONFIGURATION REQUIRED** | Twilio seam exists but no configured sender/callback delivery state | Workflows |

---

## 8. Dependency-ordered implementation plan

### Delivered in this pass

The first functional vertical is now present on the existing store and screens:

```text
creator profile + rate card
  → advertiser campaign
  → manual funding attestation / held ledger row
  → explainable creator match + queue reservation
  → creator accept/decline
  → approved distribution asset + opaque tracking hash
  → public redirect
  → attributed registration
  → explicit fulfilment verification
  → provider-unavailable block with retry
  → provider-backed test seam → 95/5 payout split → completed campaign
```

The same pass adds a public wait list:

```text
full campaign → join wait list → cancellation → expiry sweep
  → next offer → acceptance → real campaign registration
```

The UI shelves are live under Saved → Creator profile and Inbox → Campaigns,
Matches, Distribution, Calendar and Vendors. The AI review shelf is visible but
provider-gated. A target PostgreSQL migration is staged at
`server/sql/yard-engine.sql`; the runtime still uses the existing JSON adapter.
The loop test intentionally exercises both the honest blocked state and the
provider seam so a missing credential is not mistaken for a dead end.

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

Phases 1–4 below describe the production hardening and external-provider work
that remains after the local JSON-adapter vertical above; the profile, rate,
matching, asset and basic calendar code is already scaffolded and tested.

### Phase 1 — productionize identity, profiles and rates

1. Move `creatorProfiles` and `rateCards` from the JSON adapter into the selected relational adapter.
2. Add database constraints for one current card per creator/service and availability windows.
3. Add organization/team advertiser roles and role-scoped access.
4. Harden the Saved → Profile/Media kit and rate-card UI.
5. Keep current vendor profile as the fulfilment/commercial identity.

**Gate:** no rate card can be published without a real creator/person; a client
cannot change creator ownership through a PATCH.

### Phase 2 — harden advertiser campaign and matching

1. Port advertiser campaign lifecycle and budget fields to PostgreSQL.
2. Add database uniqueness/locking for `campaignMatches` and `queueReservations`.
3. Keep matching server-side using explicit region, niche, rate, metrics and
   availability fields; AI remains advisory.
4. Harden accept/decline/expiry transitions and Inbox → Matches UI.
5. Keep the signal types listed above as the automation contract.

**Gate:** a match is explainable from stored fields; no AI-only match is binding;
expired reservations release once and only once.

### Phase 3 — productionize asset vault and public distribution

1. Move `adAssets` and server-generated tracking hashes to PostgreSQL.
2. Add object storage/CDN abstraction and image validation/compression.
3. Keep the creator/advertiser approval lifecycle and add moderation/audit policy.
4. Add edge caching for `/api/public/ad/:trackingHash` without caching writes.
5. Extend the existing click-to-registration attribution to multi-touch consented attribution.
6. Extend the existing server-side Open Graph implementation instead of
   inventing a second social preview system.

**Gate:** every redirect is allow-listed, every click is attributable to one
asset, and asset generation never claims social delivery.

### Phase 4 — productionize chronology, vendor operations and worker

1. Move calendar projection and wait-list entries to the relational adapter.
2. Replace the in-process-only expiry path with a durable worker/job claim.
3. Add transport, printer and POD capabilities as adapters.
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

## 9. API surface implemented and remaining

The following shelves now exist in the JSON adapter and are session/role
checked where they mutate state:

```text
GET/PATCH /api/creator/profile
GET       /api/creator/rate-cards
POST/PATCH /api/creator/rate-cards/:id

GET       /api/advertising/advertiser
GET       /api/advertising/campaigns
POST      /api/advertising/campaigns
GET/PATCH /api/advertising/campaigns/:id
POST      /api/advertising/campaigns/:id/submit
POST      /api/advertising/campaigns/:id/confirm-funding
POST      /api/advertising/campaigns/:id/allocate
GET       /api/advertising/campaigns/:id/matches
GET       /api/advertising/matches/mine
POST      /api/advertising/matches/:id/accept|decline
POST      /api/advertising/matches/:id/verify-fulfillment
POST      /api/advertising/matches/:id/retry-settlement

GET/POST  /api/advertising/assets
POST      /api/advertising/assets/:id/approve|issue
GET       /api/advertising/assets/:id/distribution-kit
GET       /api/public/ad/:trackingHash

GET/POST  /api/calendar
POST      /api/calendar/sweep
GET/POST  /api/calendar/campaigns/:slug/waitlist
POST      /api/waitlist/:id/accept

GET       /api/public/feed
GET       /api/assist/status
```

Still required are provider-backed funding, a public/role-separated advertiser
administration model, multi-touch attribution, image transformation/storage,
Facebook/Status publishing adapters, and a production database/worker.

All private routes need session/role checks. Public asset redirects and public
feed reads use allow-listed projections. Public APIs must never become a
shortcut around campaign ownership, source membership or payment authority.

---

## 10. Final recommendation

### Safe to push into Brief now

- Use the existing public feed and public campaign surface as the distribution
  discovery layer.
- Use `people` and verified aliases as the identity base.
- Keep the new creator profile/media-kit and rate-card shelf under Saved.
- Keep advertiser campaigns, matching, assets, calendar and vendor operations
  under Inbox/Workflows.
- Reuse `signals`, `workflow`, `outbound`, `campaigns`, Vault and the one ledger;
  do not introduce a parallel economy.
- Harden the local JSON implementation with PostgreSQL transactions, durable
  workers and live providers; keep Play unchanged.

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
