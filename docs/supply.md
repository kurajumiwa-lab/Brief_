# Phase 2: enterprise, capability and verified sourcing foundation

> Phase 5 now continues accepted proposals into [Work & Fulfillment](work-orders.md), with both-party specification confirmation and requester-confirmed completion. Earlier no-fulfillment language is historical; no payment or verification guarantee is implied.

> Phase 4 now adds authorized quote requests, versioned commercial proposals and selection: see [quotes.md](quotes.md). Earlier no-quoting scope is historical; matching and quotes can coexist in the `quoted` state.

> Phase 3 extends this baseline: see [matching.md](matching.md) for live capability matching, explicitly shared participant briefs and owner-only new Request images. Earlier “not enabled yet” descriptions below document that phase, not the current matching feature.

Built on the existing Request, business, session, file-store and upload primitives. No matching, quoting, payments, inventory exchange, scores or synthetic suppliers are introduced. No production deployment or data replacement is needed for this additive implementation.

## Screens

- `#supply/mine`: owner workspace and onboarding paths (also reachable from **Our capabilities** on Home and **Capabilities** on the desktop navigation).
- `#supply/new` / `#supply/agent`: capability-first onboarding; direct supply, independent sourcing, or a hybrid. Private by default; verification never blocks enrollment.
- `#supply/search`: authenticated capability search, not a company-description directory.
- `#supply/profile/:id`: explicitly public-safe enterprise profile. Private/paused/closed participants and archived capabilities are unavailable publicly.
- `#supply/search/:requestId`: requester-curated potential options. A saved Request has separate Potential suppliers / Sourcing agents sections. No inquiry is sent and suppliers get no access to demand.
- `#supply/review`: existing `moderate` reviewers can inspect private images, begin review and record a scoped approval/rejection. No new role, account, provider or automatic verification system.

Enterprise and capability edits are versioned and survive reload. Errors preserve form fields; 401 allows inline sign-in with the existing session transport, and 409 offers explicit reload of saved data. Capability creation uses a stable retry key. Enrollment is limited to one canonical business per owner: an uncertain retry cannot create another enterprise and can recover through “Reload saved profile.” Supply writes never enter the offline replay queue. Discard/reload prompts protect form edits.

## Canonical data

`vendors[].enterprise` extends the existing owner/business record. `displayName`, `description` and operating status remain coordinated with legacy vendor identity. Enrolling an existing business does not create another vendor. Legacy edits advance enterprise revision/history; existing legacy consumers do not receive the private enterprise extension. Private enrolled businesses are excluded from legacy vendor search/listing and their legacy identity projection is redacted.

New `capabilities[]` reference the vendor ID as `participantId`; they do not create listings, prices or inventory. Each capability has a direct/source mode, category, products/services, materials/specifications, quantity bounds, capacity unit/period/kind, declared availability, schedule, turnaround and geographic coverage. Archived capabilities are retained, terminal, and removed from search. “Delete” is this safe archive operation, not destructive erasure of referenced data.

Direct-only businesses cannot publish sourcing-mode capabilities; sourcing-only businesses cannot declare direct production/stock. Hybrids explicitly distinguish each capability. The historical `verified_sourcing_agent` enum names a **role**, not a badge: the visible label remains **Sourcing agent · not verified** until both enterprise identity and sourcing-role evidence are approved. Business type and manufacturer/ownership/authorization claims are never inferred from agent approval.

Sourcing profiles store service description, declared experience, categories/regions, order-size bounds, sourcing lead time, coordination/inspection/negotiation, and owner-only network notes. Public capability network descriptions must not include confidential suppliers; private notes and verification evidence are separate.

`requestParticipants[]` hold explicit requester-selected Request → participant → capability references, a revision, audit history and `provenance: null`. There is no scoring or automatic assignment. Current public-safe projections are recomputed on read; an unavailable participant never exposes retained private profile fields.

The existing `RequestResponseFoundation` in `src/api/requestTypes.ts` is extended with typed source relationships, source-participant/intermediary/evidence references and optional quote/work/completion references. Future economics separately disclose source price, agent fee, logistics and other costs. A future quote service must derive totals. No economics are calculated or persisted by this phase.

## Verification and private files

Supply records reuse `verificationRecords` with `scope: 'supply'`. Legacy person-verification handlers exclude this scope, and legacy approvals do not confer enterprise standing.

Scopes: identity, business type, sourcing role, capability, capacity and authorization. An authorization record does not create an unqualified public ownership/manufacturer badge. Owner submissions require owned, existing **private** image references and the current enterprise revision. States are unverified (no submission), submitted, under_review, verified, rejected and expired. Only existing `moderate` reviewers may transition submitted → under_review → verified/rejected; nobody can review their own business. Review decisions require revisions and a meaningful reason. Approved records may explicitly expire with a reason through the reviewer API.

Approvals expire after 90 days by default (at most 366 days). Subject fingerprints invalidate a check when its identity/capability/role changes, including legacy identity edits. `effectiveStatus` is derived without rewriting historical decisions. Embedded histories retain reviewer actions/reasons and the shared audit log receives secondary events. A capacity review is not live stock: `currentConfirmation` is always null and the UI continues to identify quantities as business-declared.

The **existing** `/api/media/upload` accepts immutable `purpose=private_evidence` in multipart data. Existing files default to public; deduplication is isolated by owner **and purpose**, so public cached URLs never become “private” later. Private bytes at `/api/media/file/:id` require the owner or an authorized reviewer, return `private, no-store` with authorization variation, and cannot be opened anonymously or by another member. The browser fetches private bytes with its existing bearer session into temporary Blob URLs; tokens never appear in URLs. Default media pickers exclude private evidence. Request attachments and public capability evidence reject private uploads. Submitted files cannot be deleted while referenced by retained supply verification history.

Supported evidence is raster JPEG/PNG/WebP/GIF, up to the existing 8 MB limit. PDFs, other documents and external verification providers are **not enabled**. No payment/KYC enrollment dependency is added. As with the existing store, sensitive persistent data requires trusted deployment filesystem access and backups; no at-rest encryption or independent verification provider is claimed.

## API contract

Paths use the existing `/ingest` browser proxy. Public paths return intentionally limited projections even to an owner; all other paths require a real session (no developer identity fallback).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/me/enterprise` | Current owner's enterprise, or null |
| POST | `/api/enterprises` | Enroll/reuse vendor; optional first capability is atomic |
| GET/PATCH | `/api/enterprises/:id` | Safe read / owner revisioned update |
| GET | `/api/public/enterprises/:id` | Public-safe active profile |
| GET/POST | `/api/enterprises/:id/capabilities` | List / owner create (optional idempotencyKey) |
| GET/PATCH/DELETE | `/api/supply/capabilities/:id` | Read / revisioned edit / terminal archive |
| GET | `/api/public/capabilities/:id` | Public-safe active capability |
| GET/PUT | `/api/enterprises/:id/sourcing` | Safe read / owner revisioned write |
| GET | `/api/capabilities/search` | q/category/location/serviceArea/supplyRole/supplyMode/offset/limit |
| GET/POST | `/api/enterprises/:id/verification` | Owner history / private evidence submission |
| GET | `/api/ops/supply-verification` | Authorized reviewer pending queue |
| GET/PATCH | `/api/ops/supply-verification/:id` | Private reviewer record / manual decision |
| GET/POST | `/api/requests/:id/participants` | Request owner list / explicit capability option |
| DELETE | `/api/requests/:id/participants/:linkId` | Request owner revisioned removal |

Writes reject caller-supplied ownership, verification labels, scores and unsupported fields. 400: malformed data; 401: session required; 403: reviewer privilege/self-review; 404: absent or unauthorized owner resource; 409: stale revision/invalid transition; 503: storage failure or disabled feature. `BRIEF_DISABLED_FEATURES=supply` also guards Request supply links.

The existing JSON store supports synchronous transaction batching and rollback so enterprise enrollment plus its first capability persists as one atomic swap. It is still the existing single-process file store, not a new database or multi-writer deployment architecture. Existing historical/unknown collections remain preserved on load; no destructive migration is introduced.

## Tests

- `npm run test:supply`: 46 domain/API tests using a disposable store, including real HTTP, fresh-process reload, write-failure rollback, authorization, validation, privacy/byte ACL, reviewer decisions/expiry, role distinctions, search and Request links.
- `npm run test:requests`: Phase 1's 30 domain/API tests.
- `npm test`: complete server regression suite, including both phases.
- `npm run test:client`: full existing client regression suites.
- `npm run build:client && npm run test:typecheck`: canonical sources synchronized and checked.
- `npm run test:requests:ui`: builds the client and runs both browser suites: 10 Request + 16 supply scenarios across desktop and 360px mobile. `npm run test:supply:ui` runs supply scenarios against the latest build.

Browser tests use `scripts/request-test-server.mjs`, real authentication and a disposable directory. Its reviewer handles and all test businesses exist only in that disposable harness, never in the normal preview/production store. For this sandbox's available Chromium: `BRIEF_TEST_CHROMIUM=/tmp/chromium LD_LIBRARY_PATH=/tmp/al2023/lib`. No tests call Railway or a production endpoint.
