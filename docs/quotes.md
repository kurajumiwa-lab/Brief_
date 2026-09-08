# Phase 4 — Quotes and commercial connection

> **Phase 5 extension:** acceptance now creates one frozen Work Order in the same transaction. See [work-orders.md](work-orders.md) for mutual specification confirmation, explicit fulfillment, controlled amendments and requester completion. The earlier no-fulfillment boundary is superseded; payment execution remains out of scope.

**Request → Match → Interest → Quote request → Quote → Decision** is implemented in the existing application. An accepted quote is a selected commercial proposal, **not a paid order, started work, availability guarantee or completed fulfillment**.

## Use the flow

1. Create a Request and mark it ready for matching. Existing matching, save/dismiss and interest still work.
2. From a current, non-dismissed match, choose **Request a quote**. Explicitly approve sharing the limited requirements snapshot with that participant.
3. The business sees a real invitation under **Quote requests & my quotes** in its enterprise workspace. If it has not already indicated interest, it must select **I can help with this Request** before starting a quote. A requester may invite first; invitation alone never fabricates participant interest.
4. Prepare a draft. Quantity and unit are prefilled where supported. The offered specification initially refers to the immutable shared requirements; alternatives, exclusions and terms can be entered explicitly. Prices and turnaround are entered by the participant, not generated.
5. Save a draft or submit. The server validates and calculates the commercial terms. Drafts are never shown to the requester.
6. The requester compares stacked proposals, explicitly reviews them, and accepts or declines. No cheapest/best supplier claim, currency conversion or manufactured price is shown.
7. Acceptance pins an exact submitted offer version, marks the Request **ready_for_work**, and declines competing active proposals without deleting them. Neither party can silently alter or withdraw the selected proposal.

## Reused architecture and boundaries

- Same JSON store, derived indexes, synchronous transaction/rollback mechanism and atomic persistence. Additive `quoteRequests` and `requestQuotes` collections; no database replacement or unrelated data migration.
- Same enterprise/vendor owner identity, real sessions, Request ownership, capability access, matching fingerprints and existing `requestParticipants` interest records.
- Same API transport, authentication recovery, error envelope, feature registry, upload infrastructure and audit log. New UI lives in canonical `src/features/quotes/`; the quote workspace is lazy-loaded. `sync.sh` regenerates the existing preview/typecheck mirrors.
- Existing Space conversation quotes were inspected. They are scoped to Space offers and coupled to Space messages/activity and payment/order conversion. No safe Request-scoped conversation exists there; this phase uses structured proposals rather than leaking private Request quotes into those threads or creating another chat system.
- Existing ledger/order code was inspected, but quote mutations never call it. Minor-unit commercial values follow the existing `RequestResponseFoundation` convention. There are **no ledger transactions, payment intents, platform commissions, payouts, payment orders or financing calculations** created by this feature. Phase 5 adds a separate operational Work Order, not a payment order.
- Pending invitations are actual workspace records, not fake notifications. Commercial events use the existing audit infrastructure; no second event store or synthetic notification pipeline.

## Domain records

### Quote request (`quoteRequests`)

One stable invitation per Match, containing Request/participant/capability references, the actual participant account, requirements revision, current supply fingerprint, revision, timestamps and actor history. The requirements snapshot contains only:

- title, category, quantity, unit and requested currency;
- broad location and deadline;
- explicitly approved specification fields and structured requirements.

It does **not** copy the private description, budget, exact delivery address, buyer identity/contact details, business context or Request attachments. The confirmation tells the requester to remove sensitive content from free-text specifications before sharing them. Text explicitly shared by a user is not automatically redacted.

Renewing after requirements or supply changes updates the invitation and records the event. Submitted quote versions retain their original snapshots. Repeating the same invitation does not duplicate it.

### Quote (`requestQuotes`)

A Quote has `id`, `quoteRequestId`, `requestId`, `requesterId`, `participantId`, participant account, `capabilityId`, `matchId`, aggregate `revision`, `status`, private `draft`, immutable `offers[]`, accepted offer reference, timestamps, embedded actor history and private idempotency operation records.

Each submitted offer stores its own sequential version, complete calculated terms, requirements revision/snapshot, supply fingerprint, participant/capability declaration snapshot, source disclosure and submission timestamp. Working on a revision never mutates an earlier submitted offer.

Terms include:

- quoted quantity, unit, unit price in minor units, currency;
- server-calculated subtotal and total;
- disclosed delivery/logistics cost, sourcing/referral fee and labelled additional costs;
- production/service lead days, optional delivery lead days and optional estimated completion date;
- offered specification/alternatives, exclusions, notes to requester and commercial terms;
- source type and derived relationship disclosure;
- optional participant-private provenance and evidence sharing choices;
- optional `validUntil` date.

## Money and timing rules

Supported proposal currencies: **KES, USD, EUR, GBP, TZS** (two minor-unit decimals), **UGX, RWF, JPY** (zero). Unsupported currencies are rejected. No exchange rates or automatic cross-currency rankings.

`unitPriceMinor`, `deliveryCostMinor`, `sourcingFeeMinor` and each `otherCosts[].amountMinor` must be non-negative safe integers, no greater than 1 trillion each. Additional costs require labels; maximum 12.

Quoted quantities must be positive, no greater than 1 billion, with at most three decimal places. A Request quantity outside that proposal range is not copied as an invalid draft: the participant can explicitly propose a supported smaller quantity. The original requested quantity remains in the offer snapshot for comparison.

The server computes the line subtotal with **BigInt thousandths of quantity × integer minor-unit price**, rounding half-up once to a currency minor unit. Fees are then added as integers. Totals above `Number.MAX_SAFE_INTEGER` are rejected. Client-provided subtotal, total, verification or relationship claims are not accepted as input. Currency formatting also preserves minor units at the supported upper bound.

Production/service lead days are required on submission. Delivery lead days are optional and remain **unknown** if omitted, never an invented zero-day promise. Explicit zero days is a participant declaration. Estimated completion is optional, not inferred from an unspecified future work-start date.

Validity dates are real calendar dates. A date expires at the end of that day in **Africa/Nairobi (UTC+03:00)**. Submission refuses past validity; an expired offer cannot be accepted and is not automatically renewed. Without a validity date, the UI says **No expiry specified**. A new submitted revision can establish new validity. Accepted versions remain historical selections even after their former offer-validity date.

## Provenance and evidence

Supported source types: `direct`, `distributor`, `sourcing`, `referral`, `reseller`, `logistics`. Relationship labels are derived, not free-form platform endorsements.

- A matched sourcing capability can offer sourcing or referral, never masquerade as factory-direct supply.
- Direct capabilities cannot silently become sourced proposals. Logistics proposals require an actual matched capability with the existing `logistics` capacity kind, not a guess from the business name.
- Sourcing/referral fees are allowed only with a disclosed intermediary role. Source cost, fee, logistics and labelled additional costs remain visible separately to the requester.
- No manufacturer/authorized-representative verification is invented. Existing scoped role/capability standing is preserved **as of submission**, and is explicitly distinguished from verification of the quote or source relationship.
- Private provenance can contain a source reference, internal notes and an optional existing public source participant ID. It is retained internally and visible only to the quoting participant, not copied to requester projections.

The existing image uploader now supports immutable purpose **`private_quote`**. JPEG, PNG, WebP and GIF are supported; this phase does not claim PDF/document support that the uploader does not provide.

Evidence kinds: supplier quotation, product specification, stock confirmation, production confirmation and source confirmation. Every uploaded item is labelled **participant uploaded, not verified**. The participant chooses whether each image is shared on submission; default is private.

Private quote bytes are available only to their uploader, or to a requester whose submitted offer explicitly shares that image. Draft sharing checkboxes do not grant access. Unrelated users and supply reviewers cannot read quote evidence. Responses are `no-store`, URLs contain no token, and private assets are absent from public media pickers. Quote images cannot be reused as Request images, public capability images or supply-verification evidence. Linked draft/submitted images are retained against deletion; previously shared historical evidence is not retroactively made inaccessible by editing a later revision.

## Lifecycle, revision and concurrency

- `draft → submitted → viewed → accepted / declined`.
- Later publication becomes `revised`, with a new immutable offer version.
- The participant can prepare a private revision while the last submitted version remains visible, withdraw an unaccepted proposal, or issue a fresh revision of a declined/withdrawn/expired proposal while the invitation and Request remain eligible.
- `expired` is an authoritative read-time projection of validity. GET does not renew or rewrite offers.
- Acceptance discards any unpublished working draft and pins the selected **published** version. Competing active/draft proposals become declined with **Selected another option**; expired/withdrawn history is preserved.

Request `revision` continues to guard aggregate edits/actions. Additive `requirementsRevision` separates material demand edits from commercial milestone changes, with the previous Request revision as the fallback for older records:

- first valid submission: `matching → quoted`, preserving the requirements revision;
- existing matching/interest can continue while quoted;
- editing quoted demand returns it to matching, advances requirements revision and invalidates old assessments/invitations/offers;
- refreshed matching plus a renewed explicit invitation and reconfirmed interest are required before proposing against changed requirements;
- acceptance: `quoted → ready_for_work`, preserving an `acceptedQuote` reference with quote ID, offer version, requirements revision and acceptance time;
- accepted demand cannot be edited/cancelled through the earlier Request endpoints. Phase 5 provides controlled Work amendments and pre-start cancellation, not silent commercial mutation.

Capability/publication/verification changes invalidate unaccepted proposals conservatively. A valid explicit invitation may outlive the daily suggestion-assessment TTL, but not changed requirements, changed supply or a closed Request. Cancellation stops new commercial actions while allowing the parties to retain already shared history.

All quote mutations require the current quote revision. Submission/save also bind to the requirements revision; acceptance binds to the current aggregate Request revision. Decision confirmation pins the exact version initially reviewed, rather than switching under a background refresh. Owner selection, competing decisions, Request state and audit persistence occur in one existing store transaction. There can be only one accepted quote per Request through this API.

Mutations require a bounded idempotency key. The stored actor/key/payload fingerprint makes identical lost-response retries return the current record without duplicate versions or events; changing terms under the same key is a conflict. Draft creation has stable identity per invitation. The browser preserves unsaved fields and retry keys across failed saves and same-account sign-in, never queues a quote as an offline success, and requires explicit reload before overwriting newer terms.

GET revalidation runs on focus, visibility, a visible-minute interval and approaching expiry. The server always rechecks state between browser refreshes. The existing JSON adapter remains **single-writer/single-process**; horizontal writers need the project's future transactional database adapter, not an implied distributed lock.

## APIs

All require a real session. Commercial responses are `Cache-Control: no-store`.

| Method | Endpoint | Permission / purpose |
|---|---|---|
| POST | `/api/matches/:id/quote-request` | Request owner; `{requestRevision, matchRevision, shareRequirements:true}` |
| GET | `/api/requests/:id/quotes` | Request owner only; proposals and invitation summaries |
| GET | `/api/supply/quotes` | Own enterprise invitations and quotes |
| POST | `/api/quote-requests/:id/quote` | Addressed participant, current interest; `{revision}` |
| GET | `/api/request-quotes/:id` | Requester after publication, or owning participant |
| POST | `/api/request-quotes/:id/actions` | `{action, revision, requestRevision, idempotencyKey, terms?, reason?}` |

Actions: participant `save`, `submit`, `withdraw`; requester `view`, `accept`, `decline`. Foreign access returns not found; validation/concurrency follow existing error conventions. `BRIEF_DISABLED_FEATURES=request_quotes` independently disables the commercial routes; Requests and supply gates also apply.

Audit events include `quote_requested`, `quote_started`, `quote_draft_saved`, `quote_submitted`, `quote_viewed`, `quote_revised`, `quote_withdrawn`, `quote_declined`, `quote_accepted`. Actor, timestamp and relevant revision are preserved. No source contacts or private terms are copied into broad activity/notification feeds.

## Validation and limits

- `npm run test:quotes`: **53** domain/API checks covering validation, exact money, privacy, provenance, revisions, expiry, idempotency, independent-process persistence, authorization, Request/supply changes, competing acceptance and injected transactional rollback.
- `npm run test:quotes:ui`: **8** actual browser scenarios (four each on desktop and 360px mobile), covering the complete direct/source loop, evidence sharing, explicit selection, persistence, session recovery, failed/lost-response retries, stale tabs, pinned decisions and changed requirements.
- Phase 4 browser baseline: **48** scenarios across Phases 1–4; the Phase 5 regression adds Work coverage (see [work-orders.md](work-orders.md)).
- Existing backend, 1,857 client checks, supplementary engine/orchestration/stories/livecamp/yard-loop/huduma suites, build and typecheck were also exercised. Sandbox Chromium can use `BRIEF_TEST_CHROMIUM=/tmp/chromium LD_LIBRARY_PATH=/tmp/al2023/lib`.

Fixtures use disposable test stores. No fixture businesses, quotes, prices or commercial history are inserted into the isolated preview or production data. Existing old phase documentation is a historical baseline, not a claim that quotes remain disabled.

The feature is one proposal thread per invited participant/Match, not multi-line composite fulfillment, cross-currency optimization, messaging, a live stock exchange or an evidence-verification service. Indexed histories are retained; large commercial-history pagination is not introduced in this phase. No Railway deployment, production credential changes or unrelated production migration is performed.
