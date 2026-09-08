# Phase 3 — demand-to-capability matching

> Phase 5 now continues accepted proposals into [Work & Fulfillment](work-orders.md), with both-party specification confirmation and requester-confirmed completion. Earlier no-fulfillment language is historical; no payment or verification guarantee is implied.

> Phase 4 now adds authorized quote requests, versioned commercial proposals and selection: see [quotes.md](quotes.md). Earlier no-quoting scope is historical; matching and quotes can coexist in the `quoted` state.

Brief now connects an existing Request to the capabilities of real, published enterprises. The question is **who appears capable of helping?** A Match is not a quote, reservation, availability confirmation or order. No prices, ratings, reliability scores, notifications, payments or completed work are generated.

## Flow

1. Create and submit a Request using the existing workspace.
2. **Mark ready for matching** uses the existing `open → matching` transition. The server evaluates candidates and persists the transition, first matching run, matches and embedded histories in one store transaction. A failed persistence operation rolls the whole transition back.
3. Request detail shows **Suggested**, **Saved**, **Interested** and **Dismissed**, with Potential suppliers and Sourcing agents sections. Hybrid enterprises retain their role and each capability's actual direct/source mode. Related capabilities are grouped under one participant, not repeated cards.
4. View a profile, save, dismiss or restore a suggestion. These actions do not contact a business or create an order. Existing manually curated Phase 2 options remain available under a separate collapsed section.
5. Optionally edit Request visibility to **Share a limited brief with matched businesses**. Participants can see authorized briefs in their enterprise workspace and indicate **I can help with this Request**, or withdraw interest. The requester sees that real interest, including whether it needs reconfirmation after changes.
6. **Refresh matches** reruns server assessment. No page render starts matching, and adding a new supplier does not silently broadcast existing private demand.

## Canonical records and dependencies

- Existing `requests[]` remain demand. Private `matchingState` metadata records generation revision, Request revision, algorithm version, assessment/expiry times, candidate limits and refresh idempotency key. It is exposed only through the owner match API, not echoed by Request forms.
- Additive `matches[]`: one persistent relationship per Request/participant, with primary `capabilityId`, grouped `capabilityIds`, Request revision, internal ranking, structured reasons/warnings, supply fingerprint, assessment expiry, status, requester selection and audit history. Refreshes retain the relationship ID and saved/dismissed selections; unavailable options become historical.
- Existing `requestParticipants[]` also records `origin: participant_interest`, `status: interested/withdrawn`, actor, Request revision and supply fingerprint. It does not overwrite Phase 2 requester-selected options. Provenance stays null until an actual later response exists.
- Existing `RequestInput` accepts an optional, validated `requirements[]` of `{id,label,category,quantity,unit}` (maximum 12). This prepares composite requirements without a second Request model. The current engine uses their labels as relevance signals but does **not** claim multi-step orchestration or complete process coverage.
- Existing `search.js` owns capability candidate retrieval; `matchRanking.js` is the pure deterministic assessment policy; `matching.js` owns persisted relationships and authorization.
- Existing vendor IDs, enterprise roles, scoped verification, session transport, media service, JSON persistence and audit log are reused. Existing advertising creator matching (`campaignMatches`, feature `matching`) remains separate and unchanged; the procurement feature toggle is **`request_matching`**.

## Deterministic policy: `capability-overlap-v1`

A primary capability/product/service term must overlap the requested work. Broad company descriptions, category membership or proximity alone never produce a match. Normalization removes common request boilerplate, number/unit words and role/marketing words, folds simple plurals and a small explicit set of word forms. This is lexical retrieval, not semantic AI; users may need to clarify terminology. Category is a candidate-retrieval preference, not permission to insert unrelated businesses.

Internal ranking (never a percentage or API/UI product promise):

| Signal | Treatment |
|---|---|
| Capability overlap | Up to 60; mandatory primary-capability overlap |
| Quantity | +15 compatible; −18 outside minimum/maximum; −10 above typical capacity |
| Declared available capacity | −10 when explicitly below requested quantity; never treated as live stock |
| Coverage | +12 stated destination coverage; +6 nearby but unconfirmed coverage |
| Turnaround | +12 appears compatible; −12 may exceed timeframe; −25 deadline passed |
| Capability verification | +6 for current scoped manual approval |
| Capacity evidence | +3, always distinct from current capacity confirmation |
| Agent identity + sourcing role | +4 only when both are currently verified |
| Explicit Request supply preference | +3 for the corresponding direct/source capability |
| Availability | −25 business-declared unavailable; −6 limited |
| Explicit materials | −15 for nonoverlapping stated/requested materials; not inferred certification compliance |

Ties use stable participant/capability IDs. A supplier below MOQ or with uncertain information is not automatically labelled incapable or fraudulent. Unit mismatch produces uncertainty, never an invented conversion. Missing capacity is not unlimited capacity. A declared minimum alone cannot establish an upper capacity. Quantity comparisons use the capability's unit-bearing bounds; the sourcing profile's unitless order-size field is **not** silently converted into units. Capability-specific service areas take precedence over general enterprise coverage. Sourcing regions describe access/origin, not delivery coverage. Sourcing-profile lead time is used only when the sourcing capability states neither a minimum nor a maximum; a general profile must never override a capability-specific timing constraint.

**Strong match** requires at least 65% primary term overlap, compatible quantity, explicitly stated coverage, compatible turnaround, a capacity period supported by the available timeframe, no known material conflict, and no limited/unavailable declaration or composite workflow claim. **Potential match** retains meaningful relevance but warns about gaps or conflicts. **Sourcing option** explicitly describes external sourcing access; its internal relevance can rank above a direct factory with incompatible MOQ. Hybrids show the actual mode for each relevant capability. Reasons describe the best-fit capability, not an unassessed combined fulfillment promise.

All matches retain current-capacity uncertainty. Agent-role verification never establishes manufacturing, warehouse ownership, dealership or employment. Unverified capabilities remain eligible and visibly self-declared. Budget, inferred price, ratings and invented history never influence ranking.

## Freshness and concurrency

- Any Request revision change immediately makes old assessments stale on server reads/actions. No automatic rewrite of the user's saved decisions.
- A participant revision, matched capability revision, scoped verification change/expiry or loss of publication makes its assessment stale. Freshness is computed from authoritative current supply, not trusted from the browser.
- Assessments expire at the next Nairobi calendar-day boundary so deadline compatibility is not cached indefinitely.
- Stale responses suppress the old tier/reasons/signals. The UI identifies historical selections and offers refresh; an unavailable historical saved option can still be dismissed.
- New supplier discovery requires an explicit refresh. GET never generates or creates matching activity.
- Refresh requires the current `requestRevision`, current `generationRevision`, and optionally an idempotency key. A lost response can be retried safely. Conflicting generations return 409 rather than silently overwriting newer results.
- Match actions require Request and Match revisions. Interest requires authorization against the current shared Request and assessment. After requirements or supply change, previously recorded interest remains history, not reconfirmed availability.
- The frontend revalidates stored relationships on focus/visibility, while visible once per minute, and at assessment expiry. It does not rerun the engine. Cross-tab Request changes offer **Reload current Request** before a new matching action. API authorization/revisions remain authoritative between checks.
- A narrow shared-session fix prevents a delayed anonymous or superseded 401 response from erasing a newer login. No auth/account scheme was replaced.

## Privacy boundary

The full Request and its matches are always requester-owner-only, including when `visibility=public`. That flag now explicitly opts into the separate limited brief, **only for currently matched, active participants**. There is no public Request directory.

Participant brief allowlist: title, category, quantity, unit, broad Request location, deadline, relevant own capability names/modes and their own interest state. Excluded: requester identity, description, budgets, exact delivery address, business context/contact details, attachments, internal specifications, private requirements, ranking and requester-side reasons. The form tells owners to keep a shared title/location nonsensitive. Private, revised, cancelled, unavailable and dismissed matches do not confer participant access. Knowing a Request or Match ID is never authorization. Even a supply reviewer cannot read another user's private Request images.

The existing upload service now also supports immutable **`private_request`** purpose. New Request form uploads use it, with owner-only authenticated byte access and `private, no-store`; the UI opens temporary Blob URLs without token URLs. Private Request files are excluded from ordinary media pickers, public capability evidence and supply verification evidence. Existing `private_evidence` keeps its owner/reviewer ACL. Legacy public uploads remain public/unlisted: previously distributed URLs and cached copies cannot be made confidential retroactively, and no migration pretends otherwise.

## Performance

The JSON store gains derived, mutation-invalidated ID/field indexes. They are not persisted, are not a second store and are invalidated on transaction rollback. Matching relationships use indexed Request/participant lookups rather than full-database scans on each page.

The existing capability search module maintains a public-only inverted candidate index, invalidated by vendor/capability changes. Candidate retrieval bounds postings to 5,000 per term, expensive assessment to 300 candidates, participant representation in that pool to five capabilities, and results to 12 participants with up to three relevant capabilities each. A limit flag is surfaced honestly. Relevant-business briefs are bounded to 50 current relationships. No background full-database matching loop is added. The existing single-process JSON store is still not a distributed/multi-writer database.

## APIs

Browser calls use the existing `/ingest` proxy. Every route requires a real session; no dev-user fallback and no caller-supplied ownership.

| Method | Path | Body / behavior |
|---|---|---|
| PATCH | `/api/requests/:id/status` | Existing `{status:"matching",revision}` transition now generates atomically |
| GET | `/api/requests/:id/matches` | Owner-only list/generation metadata; optional role/location/verification/capacity/turnaround/tab filters |
| POST | `/api/requests/:id/matches` | `{requestRevision,generationRevision,idempotencyKey?}`; refresh matching Requests |
| GET | `/api/matches/:id` | Owner-only match |
| PATCH | `/api/matches/:id` | `{status,revision,requestRevision}`; viewed/saved/dismissed/suggested |
| GET | `/api/supply/relevant-requests` | Limited, current authorized briefs for the caller's enterprise |
| POST | `/api/matches/:id/interest` | `{requestRevision,revision}`; participant's explicit interest |
| DELETE | `/api/matches/:id/interest` | `{revision}`; withdraw own interest |

Initial status vocabulary: suggested, viewed, saved, dismissed, contacted, expired. `contacted` is reserved and cannot be self-set through these APIs because no contact/negotiation operation is built. No accepted/contracted/paid state or quote route exists in this domain.

Existing embedded histories and the audit log record matching_started, match_created, match_refreshed, match_saved, match_dismissed, match_expired, participant_interested and withdrawal. No second event store or synthetic notification is introduced. `BRIEF_DISABLED_FEATURES=request_matching` disables this feature without changing existing creator advertising matching. Supply and Requests feature gates also apply.

## Validation

- `npm run test:matching`: 43 domain/HTTP tests, including deterministic relevance/ranking/explanations, quantity/unit/period/material uncertainty, direct/source/hybrid grouping, real verification influence, revision/expiry, privacy, ownership, save/dismiss/interest/withdrawal, indexed read behavior, rollback and independent-process reload.
- `npm run test:matching:ui`: 14 matching browser scenarios (seven each on desktop and 360px mobile).
- `npm run test:requests:ui`: complete browser regression, 40 scenarios across Phases 1–3. Old assertions were updated only for intentional behavior changes: actual matching history and owner-only new Request images.
- Supplemental existing server suites: `engine`, `orchestration`, `stories`, `livecamp`, `yard-loop`, and `huduma` (`OFFLINE=1 node server/test/<suite>.mjs`). The orchestration fixture now intercepts its fake webhook offline; the yard-loop fixture uses an actual authorized operator and asserts an ordinary advertiser cannot sweep. Production transport and authorization were not relaxed.
- `npm test`, `npm run test:client`, `npm run build:client`, `npm run test:typecheck`: full existing regressions, canonical sync and build checks.

Browser and domain fixtures use disposable stores and real authentication. No test businesses, interests or evidence reviews are inserted into the ordinary preview/production data. Sandbox Chromium override: `BRIEF_TEST_CHROMIUM=/tmp/chromium LD_LIBRARY_PATH=/tmp/al2023/lib`.

No Railway deployment or production configuration change is made by this phase.
