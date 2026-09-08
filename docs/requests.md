# Requests — Phase 1

> Phase 5 now continues accepted proposals into [Work & Fulfillment](work-orders.md), with both-party specification confirmation and requester-confirmed completion. Earlier no-fulfillment language is historical; no payment or verification guarantee is implied.

> Phase 4 now adds authorized quote requests, versioned commercial proposals and selection: see [quotes.md](quotes.md). Earlier no-quoting scope is historical; matching and quotes can coexist in the `quoted` state.

> Phase 3 extends this baseline: see [matching.md](matching.md) for live capability matching, explicitly shared participant briefs and owner-only new Request images. Earlier “not enabled yet” descriptions below document that phase, not the current matching feature.

Requests run in the existing Express application and JSON store. The frontend
lives under `src/features/requests`; `AppShell` is the entry point. Production
builds run `sync.sh` before Vite to mirror canonical sources.

## Working surfaces

- Discovery: **What do you need? → Create a Request**.
- `#requests`: owner workspace (Open, Active, Completed, Drafts, Closed).
- `#requests/new`: progressive business/individual request form.
- `#requests/:id`: durable detail, edit, cancellation and lifecycle history.
- Existing Brief credentials/session tokens are reused. No enterprise signup.

## API

All reads and mutations require an actual authenticated session, including when
legacy development auth is enabled. Ownership comes only from that session.
Unknown or other users' request IDs return 404. Responses are `{ request }` or
`{ requests }`; domain errors are `{ error, code }`.

| Method | Path | Body |
| --- | --- | --- |
| POST | `/api/requests` | Request fields; `intent: draft` (default) or `submit`; optional owner-scoped `idempotencyKey` |
| GET | `/api/me/requests` | — |
| GET | `/api/requests/:id` | — |
| PATCH | `/api/requests/:id` | Changed editable fields plus current `revision` |
| PATCH | `/api/requests/:id/status` | `status`, current `revision` |

Transitions: draft → open → matching; each can cancel. `matching` means explicitly
marked ready for future matching, **not** an active automated search. Future
statuses are modeled but cannot be reached through these endpoints. Cancelled
requests remain in history and are not editable/reopenable. Stale revisions and
changed creation payloads reusing an idempotency key return 409.

The create form sends a stable key so a lost success response can be retried
without duplicate demand. Request writes are not silently offline-replayed.
Lifecycle events are saved inside the same atomic document write as the Request;
the existing audit log also records the action. Failed insert/update writes roll
back in-memory changes. No database migration or replacement is required.

## Media and privacy

Attachments reference owned, byte-available uploads from the existing image
service (up to eight). It accepts JPEG, PNG, GIF and WebP, not PDFs. Links are
unlisted and publicly readable; the UI explicitly warns against confidential
attachments. Private Request contents themselves are owner-only. A `public`
visibility preference is representable but no public Request distribution/read
surface is enabled in this phase.

Requests inherit the deployment's storage guarantees. Keep `BRIEF_DATA_DIR` and
`BRIEF_UPLOAD_DIR` on persistent storage for durability across redeployments.
No live data or hosting configuration was migrated as part of this build.

## Next-phase contracts

`src/api/requestTypes.ts` defines structured demand and the future response
foundation: independent supply role, supplier identity, provenance/relationship,
evidence and verification references, capacity and disclosed cost components.
These types do not create offers, imply verification, compute trust scores or
rank by price. An optional validated public discovery `origin.objectId` preserves
the consumer-to-business demand connection. Future quotes/jobs/transactions can
reference the stable Request ID without requiring a vendor listing.

Arena, private game lobbies and the related EPL/fantasy product modules were
removed, including API mounts, active store schema entries, client bindings and
UI. Previously persisted retired rows are preserved by the store's additive
load/merge and backups; no destructive cleanup migration runs.

## Verification

- `OFFLINE=1 npm test`: existing backend suites plus Request domain/API suite.
- `npm run test:requests`: isolated domain, HTTP, auth, validation, fault injection,
  lifecycle, retry safety and independent-process persistence tests.
- `npm run test:client`: existing JSDOM client regression suites.
- `bash sync.sh && npm run test:typecheck`: canonical frontend typecheck.
- `npx playwright install chromium` then `npm run test:requests:ui`: real backend
  browser flows at desktop and 360px mobile sizes. The test server creates a
  disposable data directory; it never resets production storage. Optional
  `BRIEF_TEST_CHROMIUM` selects an already installed Chromium executable.

No payments, supplier onboarding, matching execution, quotes or fulfillment were
added. No new economic activity is fabricated in empty workspaces.
