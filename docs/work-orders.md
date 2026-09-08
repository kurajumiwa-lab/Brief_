# Phase 5 — Work & Fulfillment

The existing economic flow now continues from accepted Quote into real operational coordination:

**Request → Match → Quote → Acceptance → Work Order → Specification confirmation → Work → Ready → Dispatch → Delivery → Requester-confirmed completion.**

This supersedes Phase 4's no-fulfillment boundary. Acceptance creates a Work Order, not started work, a delivery guarantee, payment or completion. No Railway deployment or production migration was performed.

## Using it

1. Follow the existing [Request](requests.md), [matching](matching.md) and [Quote](quotes.md) flow. Accept a genuine submitted proposal. The server creates one Work Order for that exact accepted offer in the same transaction.
2. Open the Work Order from the accepted Quote, the Request, or the participant's **My business** workspace. Lists contain only the user's real work, with awaiting-confirmation, active and stage filters. A single Work Order opens directly; `?work=<id>` retains selection within the existing Request/business navigation.
3. Both parties review the frozen requirements, offered quantity/unit/specifications, cost breakdown, disclosed relationship, timeline and fulfillment details. Shared accepted-quote image references remain available; participant-private quote images are not copied into the shared Work view.
4. Each party explicitly confirms the same agreement version. The first confirmation starts specification confirmation; the second confirms the agreement. A pre-start amendment proposal also opens specification confirmation, but does not silently approve the unchanged original terms.
5. The participant explicitly **starts work**, optionally records progress/evidence, **marks ready**, **records dispatch** and **records delivery**. These are declarations of actual milestones, not forecasts or automated logistics tracking.
6. Recorded delivery requests completion; it does not complete the Work Order. Only the requester can **Confirm completion**. The final agreement/value, completing account and time remain attached to the completed record. The Request becomes completed atomically. **No payment confirmation is recorded.**

The stage rail distinguishes recorded milestones from future stages. Both views show role-appropriate actions, actual actors/times, pending decisions, original/current agreements and permitted evidence. The Work feature is lazy-loaded under canonical `src/features/work`, not a new App monolith or generic dashboard.

## Persistence and frozen agreement

`workOrders` is an additive collection in the existing JSON store. It links the Request, accepted Quote and offer revision, requester, participant enterprise/account, capability and match. Historical participant/relationship declarations are snapshots, not new identities or live verification claims.

- `originalAgreement` preserves the accepted commercial basis independently of later Request/Quote/profile changes.
- `agreements[]` is append-only. It holds integer minor-unit economics, offered specifications, the original explicitly shared Request requirements, production/service and delivery lead days, optional estimated completion, fulfillment location, delivery details and optional agreed start date.
- Unknown dates or delivery timing remain unknown. Nothing calculates a promised start/delivery/completion from elapsed time.
- `privateSource` preserves the accepted confidential source participant reference and provenance only for the fulfilling participant. It is excluded from requester projections and broad audit data.
- `acceptedEvidence` contains only shared image references from the accepted Quote. It uses existing quote-byte authorization; it is not new operational evidence or a verified source claim.
- Status, revision, confirmations, amendments, milestones, evidence, issue details, embedded history and explicit lifecycle timestamps belong to the same Work record. `completion` freezes the final agreement; completed/cancelled records cannot be silently rewritten.

Shared monetary validation reuses `quoteValidation.js`, safe integer minor units and exact total calculations. Sourcing/referral cost, disclosed fee, logistics, other named costs and total remain separate. Direct roles cannot introduce an undisclosed intermediary fee. No FX, platform commission, ledger entry, checkout, escrow, payout or payment-intent record is created.

## State and authorization

| Current stage | Allowed advancement | Who |
|---|---|---|
| created | specification_pending | First confirming party / pre-start amendment proposer |
| specification_pending | confirmed | Remaining party; or counterpart approving the proposed agreement |
| confirmed | in_progress | Participant, with both current-version confirmations |
| in_progress | ready | Participant |
| ready | dispatched | Participant |
| dispatched | delivered | Participant |
| delivered | completed | Requester |

The requester or the original participant account with current enterprise ownership may read the Work Order. A matching business, another bidder, a reviewer or an unrelated account does not gain Work access. Foreign IDs return not found. Real sessions are required even when legacy development identity fallback is enabled.

Ordinary actions cannot edit commercial terms or set arbitrary statuses. The existing Request remains the demand record: Work creation links `workOrderId` and preserves `ready_for_work`; starting changes it to `in_progress`; requester completion changes it to `completed`; allowed cancellation changes it to `cancelled`. These mutations and their audit/history updates share one transaction and preserve the accepted requirements revision. Earlier Request status/edit APIs cannot bypass the Work lifecycle.

### Amendments

Either party may propose one pending amendment before dispatch, including during active work or readiness. Allowlisted changes cover quantity/unit, prices/currency, disclosed costs, specification/exclusions/terms/notes, lead days/estimated completion, agreed start, location and delivery details. Party identities and the original direct/source relationship cannot be silently replaced.

Every proposal retains actor/time/reason, base agreement revision, changed fields with previous/proposed values, and full previous/proposed agreements. Current terms remain effective and advancement pauses pending a decision. Only the counterparty can accept/reject the current proposal. Acceptance appends the next agreement and records both parties' assent: the proposer's actual proposal timestamp and the counterparty's acceptance timestamp. Pre-start approval confirms specifications; approval during progress preserves the existing operational stage. Rejection retains the previous agreement and proposal history.

Currency changes must explicitly restate unit price, delivery cost, sourcing fee and other costs; amounts are not silently converted or reinterpreted. In the UI, money changes display currency amounts, not raw minor-unit integers. Proposed terms are labelled proposed, not already agreed.

### Cancellation and issues

Cancellation requires a shared reason and is available only before work has started. After progress, parties must record an issue rather than cancel silently. A dispute pauses advancement and preserves the prior stage. Both parties explicitly acknowledge resolution before resuming that exact stage. This does not arbitrate fault, resolve payment or trigger refunds. Cancellation/issue creation explicitly rejects any pending amendment with retained history. Terminal records cannot be reopened through this API.

## Evidence and privacy

Work images use the existing upload/media infrastructure with `private_work` purpose. Each attached record includes type, actual uploader/time, visibility, description, milestone and agreement version. Types cover production progress, finished goods, packaging, source confirmation, dispatch, delivery and completion.

- Only owned private Work uploads can be attached as operational evidence. Public, foreign and private-quote uploads cannot be repurposed through this endpoint.
- Images default to uploader-private; sharing with both parties is explicit. The media-byte endpoint enforces access, not just the UI. Review capability does not grant Work bytes.
- Work-linked uploads cannot be deleted out of retained history. Previously shared evidence is not silently unshared.
- Shared evidence never means Brief verified the goods, stock, factory, source relationship or delivery.
- Private progress notes are filtered from the other party's history; broad audit records exclude note/evidence contents.
- Authentication travels in headers to private-byte fetches, never tokenized image URLs. Responses are no-store.

Free text deliberately shared by a party is not automatically redacted; the visibility choice is consequential.

## API and retry contract

All routes use the existing transport, session/error conventions and feature registry. `work_orders`, `requests` and `supply` gates apply.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/work-orders/:id` | Authorized shared Work projection |
| GET | `/api/requests/:id/work-orders` | Request owner's Work and accepted-quote reference |
| GET | `/api/supply/work-orders` | Original participant's own enterprise Work |
| POST | `/api/request-quotes/:id/work-order` | Requester's explicit creation bridge for a previously accepted Quote |
| POST | `/api/work-orders/:id/actions` | Validated operational action or amendment decision |

Actions require `action`, current `revision`, current `agreementRevision` and an actor-scoped `idempotencyKey`. Optional fields are `note`, `visibility`, `evidence`, `changes` and `amendmentId`, restricted by action. Identical committed retries return the current record before stale/terminal checks; reuse with different content conflicts. Other stale writes return 409 without changing history. Creation has stable natural identity per accepted Quote; retrying cannot create another Work Order, including after completion.

Forms pin the revision originally opened, retain unsaved fields after failure/sign-in, and require explicit discard/reload to review a newer basis. Failed Request/Quote/Work writes **never enter the existing generic offline replay queue**: an uncertain start/dispatch/acceptance must not execute later merely because connectivity returned. No second retry/auth/media system was introduced.

When `work_orders` is disabled, quote acceptance remains a commercial decision without creating Work. Existing accepted Quotes have an explicit requester creation action when enabled. Neither GET nor rendering fabricates historical Work or milestones.

## Timeline and audit

The existing audit facility records `work_order_created`, `specification_confirmation_started`, `specifications_confirmed`, `work_started`, `progress_recorded`, `work_marked_ready`, `dispatch_recorded`, `delivery_recorded`, `completion_requested`, `work_order_completed`, `work_order_cancelled`, `amendment_requested`, `amendment_accepted`, `amendment_rejected`, and minimal evidence/issue/resolution events. Work history records the original real quote acceptance as a reference at its original time, not a claim Work existed then. Events identify actor, time, Work/aggregate/agreement revisions and actual state transitions.

## Verification and limits

- `OFFLINE=1 npm test`: full backend regression green, including **44 Work**, **53 Quote**, **43 matching**, **46 supply** and **30 Request** focused checks. Three external connector checks are honestly skipped in offline mode.
- `npm run test:work`: focused domain/HTTP checks for frozen money/provenance/shared quote images, creation/transition retries, role/state rules, same-version confirmations, amendments, private metadata and actual private bytes, cancellation/issues, requester completion, process reload and injected transaction rollback.
- Playwright: **60/60** desktop/360px tests across Phases 1–5, including **12 Work** tests. Direct and source flows create real isolated Requests, matches, proposals and accepted Work via the actual application. Coverage includes complete fulfillment, persistence, deep links, evidence privacy/foreign IDs, expired sessions, lost responses, stale operational tabs, stale amendment decisions and mutual issue resolution.
- Client regression: **1,861/0**, including four added transport cases for non-queued Work/Quote creation and actions. Build/typecheck and supplementary engine, orchestration, stories, livecamp, huduma and Yard HTTP suites are green.
- Test harness fixes keep app imports off the preview port and make the supplemental signal transport test deterministic/offline. No production transport/auth behavior was changed for those tests.

Sandbox browser command: `BRIEF_TEST_CHROMIUM=/tmp/chromium LD_LIBRARY_PATH=/tmp/al2023/lib ./node_modules/.bin/playwright test` after `npm run build:client`; a normal installation can use its installed Playwright Chromium.

Test stores/uploads and screenshots are disposable/ignored. No test accounts, supplier claims, fabricated business activity or operational completion records are inserted into the preview or production.

The persistence adapter remains **single-process/single-writer**, not distributed concurrency-safe. Lists and byte authorization reuse indexes scoped to the owning requester/participant; they do not scan unrelated Work on each render. Large owner-history pagination is not added in this phase. Multi-party allocation, partial shipment management, post-dispatch commercial amendments, reassignment, full chat, automatic logistics, sophisticated disputes, payments, trust scoring and repeat procurement remain outside scope.
