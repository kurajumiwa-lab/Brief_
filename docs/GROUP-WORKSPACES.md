# Purpose workspaces — preview implementation

Updated 2026-09-25. This is a functional implementation pass, **not production readiness or a completed adversarial/permission audit**. No production migration, deployment, live payments, refund policy or automated money-out is included.

## Entry paths

- `/groups` mounts the public directory without AppShell, membership, eligibility or financial loaders. It lists only opted-in discovery metadata; no member counts or membership roster. Anonymous browsing does not enroll anyone. A signed-in viewer can join an open group or request admission to a listed discoverable group. A coordinator handles requests with a reason; approval grants only native Group membership.
- The live Groups room exposes **Workspaces**. Selecting a specialized purpose opens that section after group creation and when opening a purpose group. Coordinators explicitly create named setups; a category never silently opens a ledger or enrolls members.
- An owner configures and activates a setup. Activation creates exactly one linked native banking ledger, group buy or campaign. The contextual API adapts existing native engines rather than inventing a second ledger, registration registry or payment provider.
- Table banking opens the exact linked native ledger, including archived history, not the viewer's first unrelated banking group. Group-buy records and event registration/check-in have contextual owner/participant views.

## Authorities are separate

| Domain | Authority and scope |
|---|---|
| Group discovery | Explicit opt-in listing; no private contents/financial records |
| Group membership | Open self-join or coordinator admission; required to open contextual workspaces |
| Workspace setup | Active Group coordinator may create a setup for an enabled purpose |
| Workspace operation | Its explicit owner, not every coordinator, shop owner or manager |
| Banking participation | Native financial membership, admitted separately; ledger records remain native |
| Group-buy participation | Explicit requested participation approved by workspace owner; participants see their own contribution rows, owner sees the pool |
| Events | Native attendee registration and ticket/check-in state; attendance does not grant organizer authority |
| Shop team | Owner manages roles and money; manager has scoped brand edit + catalog read; staff catalog read. No inherited Group/workspace authority |

Owner approval for financial admission is a conservative preview default, not a new money-transfer authorization. A published event intentionally also has a public campaign page: public attendance does not grant access to the private Group. Native financial history membership can outlive Group membership; leaving a community is not an instruction to erase a ledger or unwind liabilities.

Linked native banking routes check financial membership, child loan/payout routes resolve their parent ledger, invites are owner-scoped and archived linked ledgers reject writes. Linked legacy group-buy routes cannot bypass contextual mutations; nonowners cannot read organizer projections through them. Linked financial/organizer signals are filtered from the generic signal route. **This is not a claim that every legacy feed/export/chat/API surface has been adversarially audited.**

## Lifecycles

- **Table banking:** setup → active → archived. Contributions are records; Brief does not hold the funds. Native archive checks continue to refuse outstanding active loans/pending payouts. Archive does not settle funds. Archived linked ledgers are read-only.
- **Group buy:** setup → funding → target_met → ordered → dispatched → delivered → closed. Target is derived from recorded contributions, not verified bank settlement. Owner records procurement progress with a reason/reference. No fake escrow or automatic transfer is created. Withdrawing after contributing is blocked rather than silently dropping financial obligations. Early cancellation/refunds are a separate policy gate.
- **Events:** setup → native draft → explicitly published → live → ended → closed. `ended` is also derived from the scheduled end while the organizer still needs to close. Draft/published cancellation uses native transitions. Native free registration confirms attendance; paid registration remains pending the existing payment flow. This pass exercised free events, not live paid settlement. Paid-event participant withdrawal is blocked pending the separate refund policy.
- An unactivated setup may be cancelled, but cannot then be activated. Draft events may be edited before publication. Closed/inactive Groups cannot create/activate fresh workspaces; existing obligations are not silently erased.

Setup activation and contribution request IDs provide retry protection. Workspace setup/configuration/activation, participation decisions, withdrawals and operation transitions insert audit rows within store transactions. This does not substitute for a deliberate retry/race/rollback test matrix.

## APIs / implementation homes

`server/src/domain/groupWorkspaces.js` is the contextual adapter; `workspaceAccess.js` is the shared native-link check. `groupAdmissions.js` handles private membership requests. `groupWorkspaces` and `workspaceParticipants` are distinct from native members, registrations and priced-bargain participants.

Authenticated, no-store routes:

- `GET/POST /api/groups/:groupId/workspaces`
- `GET /api/group-workspaces/:id`
- `PATCH /api/group-workspaces/:id/setup`
- `POST /api/group-workspaces/:id/activate`
- `POST /api/group-workspaces/:id/participation`
- `POST /api/group-workspaces/:id/participation/decide`
- `POST /api/group-workspaces/:id/actions`
- `GET/POST /api/groups/:groupId/admission`
- `POST /api/groups/:groupId/admission/decide`

UI: `GroupWorkspaces.tsx`, `PublicGroupsPage.tsx`, the live `Circles.tsx` room and the scoped `TableBankingSurface`. Shop creation remains a private, productless shell; brand cover/category precede products and do not constitute publication. Team roles operate through the restricted `/api/spaces/:id/team` projections/actions rather than exposing the owner dashboard.

## Bundle diagnosis and fix

The previous roughly 1,002 kB entry eagerly imported both `model/core` (including the public campaign page/legacy model) and AppShell with most destinations. Merely making the root lazy still left a 733 kB AppShell chunk. Lazy destination boundaries in AppShell, plus independent public directory/campaign entry points, reduced the largest emitted chunk to about **370 kB** (gzip about 92 kB). The default 500 kB warning is gone; no warning threshold was raised. The legacy core remains about 99 kB and is not needed to browse `/groups`.

## Verification and remaining milestone

Reproducible isolated HTTP walkthrough:

```sh
node scripts/smoke-workspaces.mjs
```

It creates a fresh OS-temporary store before importing the server, uses disposable approved-identity fixtures, and exercises the directory admission → Group → all three native workspace lifecycles, plus a restricted shop-manager brand operation. It never connects to an existing server or store. It is a functional walkthrough, not a security suite.

Browser checks in development exercised anonymous directory-only loading, purpose navigation, fresh group-buy setup/activation/contribution/procurement through closure, and opening the archived linked banking ledger. The activation response initially lacked the owner's buy controls; the browser walkthrough caught that and the response now returns the complete authorized native view. Ordinary server/client regressions, typecheck and build also passed locally. Regression totals are **not** architecture or security evidence.

Still deliberately outstanding: full browser multi-actor coverage, direct/legacy/alternate-route authorization attacks, hidden-data/cache/feed/export traversal, revoked/stale memberships, feature-disabled paths, financial history after departures, retry/race/restart/failure injection, paid-event/payment callbacks, and adversarial lifecycle inputs. Perform that dedicated hard-validation pass next; do not call this production-ready. Phone-first, private documents, refunds, appeals/guardian outcomes and verified KCB money-out remain independently gated as described in ACTIVE-BACKLOG.md.
