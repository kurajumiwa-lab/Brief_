# Public-page report moderation

Implemented locally on 2026-09-25. Not merged or deployed.

## Scope and authority

This workflow handles **`spaceAbuseReports` only**, not the existing object/source trust-report system. It changes the public page, never the seller/provider account or commerce records.

- Both review and reinstatement require the existing `moderate` capability: platform reviewers and admins. Viewer, operator and finance roles alone are insufficient.
- Self-review and self-reinstatement are refused, including for admins. This is the conservative default communicated during implementation after the authorization clarification was skipped.
- Authority is checked in both routes and domain functions. Reviewer identity comes from the authenticated session, never the body. Authority is rechecked on retries.
- The live app exposes **All → Page moderation** only to capable sessions. The same panel is available in the legacy Admin Desk's Attention tab. Backend checks are authoritative.

## State transitions

| Command | Report | Public page | Other state |
|---|---|---|---|
| Report submitted | Pending (`handledAt: null`, `outcome: null`; queue displays `pending`) | Unchanged | Existing report-submission behavior retained |
| Uphold | `outcome: upheld`, `handledAt`, `handledBy`, reason and action ID stored | Visibility becomes `private`; a moderation hold is recorded | No account suspension, selling disablement, order cancellation or reward decision |
| Dismiss | `outcome: dismissed`, same completion/audit fields | Unchanged, including any hold from another report | No account/order/reward changes |
| Reinstate | Original upheld report remains upheld | Matching hold cleared; active page explicitly republished as `public` | No archive restoration, appeal decision or unrelated state clearing |

Every successful command requires an explicit non-empty reason (trimmed, maximum 1,000 characters). No reason is prefilled in the reviewer UI. Each command appends an `auditLog` row containing reviewer identity, action, reason, timestamps, before/after snapshots, request identity and result.

State and audit commit in one `store.transaction`. If either the audit insert or disk persistence fails, report, page and audit all roll back. This uses the repository's synchronous single-writer JSON store; it does not claim distributed/multi-writer transaction support.

A moderated owner may still edit content and create/publish listings. Owner visibility PATCH cannot clear a hold or republish the page. A forged moderation field in that PATCH is ignored by the existing update allowlist. The owner-facing page panel explains the hold instead of offering a publish button.

Archived shops cannot be reinstated by moderation: restoring an archived shop remains a separate owner action, and restoring it does not remove a moderation hold. A new uphold creates a new hold revision; an older reinstatement request cannot clear it. Dismissing another report does not remove an existing hold.

Public HTML, JSON page, discovery directory and sitemap all follow the same private/public visibility state. Hidden HTML is 404, `noindex` and `no-store`.

## Guardian/reward policy boundary

Previously, guardian checks counted only reports with no `handledAt`. Completing a review would therefore have released restrictions as an accidental side effect.

Newly reviewed reports receive `guardianEffectPending: true`. Guardian counting includes open reports **or** these policy-pending reports, still signed-in-only and deduplicated per reporter. Review and reinstatement preserve the pre-existing count, flagged/suspended status and reward records. Anonymous reports remain excluded. Previously handled legacy rows are not migrated or reinterpreted.

This is **not** a decision that an upheld or dismissed complaint should permanently cost rewards. No operation in this feature releases that marker. The effect of outcomes on guardian rewards, any retroactive adjustment and appeals remain separate policy decisions.

## HTTP contract

All endpoints require an authenticated `moderate` capability:

- `GET /api/ops/space-reports` — reports with pending/completed outcomes and current hidden pages. No mutation.
- `POST /api/ops/space-reports/:id/review` — `{ "outcome": "upheld" | "dismissed", "reason": "..." }`.
- `POST /api/ops/spaces/:id/reinstate-page` — `{ "holdId": "current hold from queue", "reason": "..." }`.

Both POSTs require **`Idempotency-Key`**, 8–128 characters from letters, digits, `.`, `_`, `:` or `-`. Use a fresh UUID for a new command; retain it when retrying the same command after a timeout/lost response.

- Same reviewer + key + canonical command: return the original result with `replayed: true`, without another write or audit row.
- Same key reused for a different target/action/reason: 409.
- Already completed report with a fresh key: 409. Decisions cannot be overwritten.
- Missing/changed/currently cleared hold or archived shop: 409 on a new reinstatement command.
- Missing reason, unsupported outcome or malformed key: 400.
- Unauthenticated: 401; unauthorized/self-review: 403; missing resource: 404.
- Failed persistence: 500, safe to retry with the same key.

A replay is a **historical response**, not a statement of current page visibility. An old uphold retry cannot re-hide a reinstated page, and an old reinstatement retry cannot reopen a newly hidden page. The UI refreshes current state after success/replay.

## Tests and review isolation

Focused commands:

```sh
npm --workspace=server run test:space-moderation
./run-suites.sh spacemoderation
```

Server coverage (14 cases) includes both complete lifecycles, HTML/JSON/directory/sitemap behavior, missing reasons, forbidden roles, self-review, forged identities, duplicate/concurrent requests, conflicting/repeated commands, revoked permissions, stale holds, archive independence, continued selling while hidden, guardian flag/freeze invariance, immutable report decisions, audit/disk rollback, persistence and replay after a fresh-process restart.

Client coverage (6 cases) covers mandatory uncanned reasons, retry-key retention, uphold/reinstate, dismissal, denied reads, owner hold messaging and capability-gated entry from the live shell.

Core changes are isolated in `domain/spaceModeration.js`, `routes/spaceModeration.js`, `SpaceModerationPanel.tsx` and their dedicated suites. Integration changes are limited to registration/navigation/API adapters, an owner publication guard, public-face messaging and preservation of guardian report effects. Weather production/test logic and setup/deployment documentation were not edited in this moderation pass. Earlier uncommitted UI and documentation work remains in the branch; it is not all moderation work.

Phone-first accounts, private-document verification and automated KCB payouts remain gated. No OTP channel, account migration, document-storage policy, appeal process or money-out implementation is introduced here.

### Final local verification

- `npm test`: passed, including 14 moderation lifecycle/security/persistence cases.
- `npm run test:client`: **2,305 passed / 0 failed**, including 6 moderation UI cases; no crashed suites.
- `npm run test:typecheck`: passed.
- `npm run build`: passed; existing large-bundle warning remains.
- `git diff --check`: passed.
