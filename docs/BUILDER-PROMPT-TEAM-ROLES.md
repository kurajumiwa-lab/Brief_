# Trace — Team & Roles (Builder Prompt)

> Status: **the layer exists at platform level; the shop crew is the
> recorded gap this prompt correctly names.** `roles.js`, `identity.js` and
> `invites.js` already hold the machinery (roles with rank, capabilities per
> role, a nine-rung invite primitive whose default expiry is already 7 days,
> and the breadth rule "you cannot invite a role broader than your own").
> Attribution already lives on the rows that matter — space writes carry the
> actor throughout, and the Shop Brief ships a "Recorded by" read over them.
> The one real hole: **`transitionOrder` takes no actor** — accept and
> fulfil are unattributed today. And one model decision gates everything:
> **the repo is strictly 1:1 person↔vendor**.
>
> All four removal items are phantom or preventive — there are no
> password-sharing instructions, no `canRead` stubs, no "1 member" text.
> Read **Corrections first**. Verified against the tree on 2026-09-21.

---

## Corrections first (what was changed, and why)

1. **The machinery exists; extend it, never parallel it.** `roles.js`:
   `ROLES` (operator, partner, program_lead, cohort_anchor,
   circle_treasurer, circle_member, vendor, field_agent, auditor),
   `ROLE_RANK` ("breadth of authority, used ONLY for the invite rule 'you
   cannot grant a role broader than you hold'"), `ROLE_SCOPE_KIND`.
   `identity.js`: `ROLE_CAPABILITIES`, `capabilitiesOf(userId)`,
   `hasCapability`. `invites.js`: scoped, expiring, single-use invites with
   `grants_role` / `grants_scope` / immutable attribution — and **the
   default expiry is already 7 days** ("Expiry is mandatory. Default 7
   days, but a caller may shorten it."). The Shop Brief's correction 5
   recorded the gap in plain words: "roles.js holds platform roles, not a
   shop's crew." This prompt is the right answer to that recorded gap —
   shop-scoped roles as new entries in these tables with
   `grants_scope: { kind, id: vendorId }`, not a second permission system.

2. **`shopId` is `vendorId` — third time.** The parent decision is recorded
   in the Shop Brief and Nearby records: the vendor is the parent; the name
   "shop" is taken by the WhatsApp shop builder. `TEAM_MEMBER.shopId` keys
   to `vendorId`.

3. **The 1:1 person↔vendor model is the structural decision everything
   else bends around.** `vendor.js` enforces one vendor per owner
   (`createVendor` reuses by `ownerId`), and `isOwner(vendorId, userId)` is
   the only authority check there is. `fieldAgent.onboardVendor` states the
   model in its own comment ("the current 1:1 person<->vendor model") and
   depends on it — an agent onboards a shop *under their own identity*.
   Team & Roles presumes N users acting on one vendor. That is a model
   change, not a feature: the moment John can act on Mary's vendor, "one
   person, one seller identity" stops being true, and every surface that
   assumes it (onboarding under the agent, referrer-≠-owner in the
   invite-a-shop loop, payout ownership) must be re-checked. Decide the
   model in writing; build the crew on the decision.

4. **Attribution exists on most rows; the order pipeline is the genuine
   hole.** `space.js` writes carry `callerId`/`actorId` throughout (offers,
   updates, broadcasts, templates, expenses, stock edits). `shopBrief.js`
   reads them: "Activity rows, grouped by the actor the row already
   names," with an honest `unattributed` bucket, a name only when a user
   row carries one, and the owner's own opens excluded from views. But
   `transitionOrder(id, next, { note })` — accept, fulfil, settle — takes
   **no actor at all**. The matrix's two staff rows ("Accept an order,"
   "Mark an order fulfilled") point at exactly the unattributed writes.
   That is the real work of this prompt: put the actor on order
   transitions, and the staff surface's "Mark fulfilled" becomes a row
   that says who. The prompt's own unblock ("the brief gets real
   attribution") is already half-shipped without any team table — the crew
   layer's gift to the brief is scope and revocability, not attribution's
   existence.

5. **"Withdraw money" owner-only is already the law.**
   `settlement.requestPayout`: "only the vendor may request their own
   payout" (`vendor.ownerId !== requestedBy` refuses). The matrix's most
   dangerous row is enforced today. Under a membership model, this one
   check must read the member's role instead of owner equality — the one
   place the matrix rewrite touches money.

6. **The invite flow is a rung on `invites.js` — and 7 days is already the
   default.** Phone-number invite via WhatsApp rides `outbound.js` (the
   fifth surface in this series to touch that seam). New invitable roles
   (a manager/staff/viewer scoped to one vendor) enter `INVITABLE_ROLES`
   with rank below `vendor`; the breadth rule then enforces "managers
   cannot promote or demote other managers" and "only the owner changes
   roles" without new logic. One correction to the flow: **decline should
   not delete.** "Decline → the invite is deleted" contradicts this
   prompt's own record-keeping law — a declined invite should stay a row
   with `declined`, because the inviter's "Declined" read and any future
   abuse review need the row. Expiry and single-use already handle the
   ghosts.

7. **`expired` is missing from the status enum — the third schema
   self-contradiction in this series.** The transitions say
   `invited → expired (set by cron)`; the enum lists only `invited |
   active | suspended | removed`. Same class of defect as the shopping
   run's undeclared `settling` and missing `deadline`. Declare the state
   where the machine lives. "Set by cron" is the house unref'd sweep timer
   (the calendar's, the shop brief's pattern) — fine, name it that.

8. **Ownership transfer: the invariant is right, the mechanism is
   misdescribed.** There are no database transactions in this repo — the
   store is an in-process JSON store with no multi-row transaction
   primitive. Atomicity is achieved the honest way here: one synchronous,
   guarded function that validates both writes and applies them together
   (single-threaded, so it is atomic), with the zero-or-two-owners
   invariant asserted by a test that tries to break it. Write the test,
   not the SQL. Also: the transfer must swap `vendor.ownerId` and the two
   member roles in the same guarded step, or the payout gate (correction
   5) and the member rows disagree.

9. **The matrix-in-one-place rule is already house law — keep it.** The
   taxonomy header exists to stop exactly this drift ("a second copy is a
   second taxonomy that can drift out of the first"), `SOURCES` is exported
   so the UI imports rather than copies, and `appbelt.jsx` fails its test
   if the sheet grows. A `permissions.js` module with the matrix, imported
   by both sides, plus a test that loops every (role, action) pair against
   the live API — that is the repo's own pattern, stated back at it. Build
   exactly that.

10. **Member status is genuine lifecycle — but say why.** Unlike the
    partner prompt's `offline` flaw (availability buried in a lifecycle
    enum), suspend/remove/restore are real states of a membership, not a
    toggle; this enum is correct as shaped. The `ip` field on activity
    rows, though, deserves a sentence before it exists: collecting the IP
    addresses of a shop's staff is surveillance-adjacent data with no
    stated retention or purpose beyond "security." Nullable-or-nothing;
    if kept, a written purpose and retention limit — data minimisation is
    the honest default, and the repo already shows it (verification "stores
    no documents").

11. **Removals: all four phantom or preventive.** No "share your password"
    instruction exists in docs, onboarding, or client copy (searched). No
    `permissions.canRead` stubs (the only hits are Telegram and advertising
    internals). No "1 member" text on any shop card. The single-user
    assumption "every action on a shop is by the owner" is real but is not
    a line to delete — it is corrections 3 and 4, and it is removed by
    building, not by editing copy.

12. **The dependency arrow is backwards as history.** The note says ship
    Team & Roles *before* Shop Brief "so the brief can attribute." The
    Shop Brief shipped and attributes — via the actors its rows already
    carry, with `Recorded by`, the unattributed bucket, and the no-rota
    refusal written down. What the crew layer adds to the brief is: order
    rows that name their actor (correction 4), a roster whose scope can be
    revoked, and the day the brief's "no schedule exists, so nobody is
    ever reported absent" sentence can be revisited. Earlier, not
    required.

---

## The prompt's test requirements, mapped

| Required by the prompt | Where it stands |
| --- | --- |
| invite creates `invited`; link expires in 7 days | the primitive already defaults to 7 — the rung is new (correction 6) |
| accepting creates `active` | new — redemption on the primitive writes attribution once |
| staff accepts orders; log records their actor | new — and the actor must first exist on order rows (correction 4) |
| staff cannot post offers; viewer refuses every write | enforcement pattern exists (`hasCapability`); the vendor-scoped matrix is new |
| staff cannot view money | new — `vendorEarnings` reads are owner-facing today |
| manager invites staff, cannot change roles | held by the primitive's rank rule once roles carry rank |
| transfer is atomic; zero or two owners impossible | invariant new; the mechanism is a guarded synchronous write, not SQL (correction 8) |
| removing writes `teamHistory` with a reason (min 10 chars) | new — append-only, consistent with the stock-log pattern |
| removed members cannot act; re-invite makes a new row | new — `isOwner`-style checks widen to membership reads |
| activity log append-only, no update/delete endpoints | house pattern — the brief's read-only route is the precedent ("no edit door, in the route file itself") |
| matrix matches enforcement on every (role, action) pair | new test — exactly the appbelt-style invariant the repo already runs |

## What is genuinely new here

Shop-scoped roles in the existing tables · the membership model decision ·
actors on order transitions · the vendor-scoped permission matrix with its
loop-the-pairs test · the roster and actor-filtered activity view · the
guarded ownership transfer · the staff surface · team history with
reasons. Beneath all of it: roles, rank, capabilities, expiring invites
with 7-day defaults, and row-level attribution are standing and tested.
This prompt is the one the series has been pointing at since the Shop
Brief refused the staff flag for lack of a crew table — and it arrives
with most of its substrate already poured.

---

## The prompt, as received (verbatim)

What follows is the prompt exactly as it was received — unedited, including
the phantom removals and the misdescribed transaction. It is kept so the
corrections can be checked against the ask, and so no future builder has to
trust a paraphrase.

````markdown
# Trace — Team & Roles (Builder Prompt)

You are building Team & Roles: the permission layer that lets
a shop owner invite staff, assign scopes, and see who did what.
It is what makes the Shop Brief possible, and what lets a shop
grow beyond one person.

Without this, every owner shares their password with their
staff. Every action looks like the owner's. Every daily brief
is meaningless because it can't attribute work. Every shop
caps at one person.

## The problem it solves

Mary runs a shop in Kilimani. Her assistant John helps during
peak hours. Today:
- John logs into Mary's account with her password
- Every order shows Mary's name
- When John takes a shortcut, Mary can't see it
- When John does good work, Mary can't credit it
- If John leaves, Mary changes the password and everything
  is fine — except she never had real attribution in the first
  place

The Shop Brief would say "6 orders fulfilled" but never "by
whom." That's not a brief. That's a sum.

Team & Roles makes attribution real. Every action has an
actor. Every actor has a scope. Every scope is revocable.

## What you are building (and what you are NOT)

You ARE building:
- A `teamMember` entity linking a user to a shop with a role
- Four roles: owner, manager, staff, viewer
- Scoped permissions enforced server-side on every write
- An invite flow (by phone number, via WhatsApp)
- A team roster on the shop dashboard
- An activity log filtered by actor
- A clean way to revoke a member without deleting history

You are NOT building:
- Any "employee" concept (this is not HR software)
- Any time tracking or attendance (nothing to back it)
- Any payroll (that's a regulated product)
- Any performance rating or ranking of staff
- Any "top performer this month" mechanic
- Any permission that persists after revocation
- Any "owner transfer" flow that isn't atomic

The team is a permission layer. Not a management system.

## Non-negotiables

- Every write on a shop's data carries an `actorId`. The actor
  is the logged-in user, verified by session. Never inferred.
- The `owner` role is exactly one per shop. Cannot be zero.
  Cannot be two. Transfer is atomic.
- An `owner` cannot remove themselves. They must transfer
  first. If they want to leave, the shop must have a new
  owner before they go.
- A `staff` or `viewer` can be removed at any time by an
  owner or manager. Their past actions remain in the log.
- Revocation takes effect immediately. No grace period. No
  cached permission.
- Every role change writes a row to `teamHistory` with reason.
  Reasons are visible to the owner, not the staff.
- The invite link expires in 7 days. Unaccepted invites
  become `expired`, not silent ghosts.
- Only the owner can change someone to owner. Managers cannot
  promote or demote other managers.
- A viewer can see everything but write nothing. Useful for
  accountants, partners, and family members.
- Server-side enforcement is the only enforcement. The UI
  hides buttons but the API refuses. Both must agree.

## The TeamMember entity

```
TEAM_MEMBER
├── id
├── shopId
├── userId              (the invited user's account)
├── role                ('owner' | 'manager' | 'staff' | 'viewer')
├── invitedBy           (the userId who invited them)
├── invitedAt           (ISO)
├── acceptedAt          (ISO — when they accepted)
├── status              ('invited' | 'active' | 'suspended'
│                        | 'removed')
├── suspendedReason     (nullable)
├── removedAt           (nullable)
├── removedBy           (nullable)
└── removedReason       (nullable)
```

Status transitions:
```
invited → active       (accepts the invite)
invited → expired      (7 days pass, no acceptance — set by cron)
active → suspended     (owner/manager suspends)
active → removed       (owner/manager removes)
suspended → active     (owner/manager restores)
suspended → removed    (owner/manager removes while suspended)
```

A `removed` member is final. To re-add the same user, a new
`teamMember` row is created. Their history from the old row
remains, attributed to the old row.

## The permission matrix

| Action | Owner | Manager | Staff | Viewer |
|--------|:-----:|:-------:|:-----:|:------:|
| View all shop data | ✓ | ✓ | ✓ | ✓ |
| View money (ledger, brief) | ✓ | ✓ | — | ✓ |
| Post an offer | ✓ | ✓ | — | — |
| Edit an offer | ✓ | ✓ | — | — |
| Delete an offer | ✓ | ✓ | — | — |
| Accept an order | ✓ | ✓ | ✓ | — |
| Mark an order fulfilled | ✓ | ✓ | ✓ | — |
| Post an update (24h) | ✓ | ✓ | ✓ | — |
| Post a walk-in enquiry | ✓ | ✓ | ✓ | — |
| Reply to inbox | ✓ | ✓ | ✓ | — |
| Invite staff | ✓ | ✓ | — | — |
| Remove staff | ✓ | ✓ | — | — |
| Change roles (below owner) | ✓ | — | — | — |
| Transfer ownership | ✓ | — | — | — |
| Withdraw money | ✓ | — | — | — |
| Publish / unpublish shop | ✓ | ✓ | — | — |
| Delete shop | ✓ | — | — | — |

**The server enforces this matrix on every write.** The UI
hides disallowed buttons but the API is the boundary.

The matrix is defined in one place in code:
```
server/src/domain/permissions.js
```

Both client and server import the same matrix. If they drift,
a test fails.

## The invite flow

The owner (or manager) taps "Invite a team member" from the
shop settings. One screen:

```
┌─────────────────────────────────────┐
│  Invite a team member               │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  PHONE NUMBER                       │
│  [+254 7                          ] │
│                                     │
│  ROLE                               │
│  ○ Staff — accept orders, help      │
│           customers                 │
│  ○ Manager — everything except      │
│              money and ownership    │
│  ○ Viewer — see only, for           │
│             accountants/partners    │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  They'll get a WhatsApp invite.     │
│  The link expires in 7 days.        │
│                                     │
│  [ Send invite ]                    │
│                                     │
└─────────────────────────────────────┘
```

The invite sends one WhatsApp message:

```
{{inviterName}} invited you to join {{shopName}}
on Trace as {{role}}.

Role: {{roleDescription}}
Access: {{accessDescription}}

Accept: {{inviteLink}}
Expires in 7 days.

If you don't recognise this, ignore the message.
```

If the phone number isn't a Trace user yet, the link opens
the sign-up flow. After sign-up, they land directly in the
team acceptance screen.

## The acceptance flow

```
┌─────────────────────────────────────┐
│                                     │
│  {{inviterName}} invited you to    │
│  join {{shopName}} on Trace.       │
│                                     │
│  ROLE: {{role}}                     │
│                                     │
│  What this means:                   │
│  {{roleDescription}}                │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  [ Accept ]   [ Decline ]           │
│                                     │
└─────────────────────────────────────┘
```

**Accept** → `teamMember` row goes to `active`. They now see
the shop in their "My shops" list.

**Decline** → the invite is deleted. The inviter sees "Declined."

If they don't respond in 7 days, the invite expires
automatically. The inviter sees "Invite expired."

## The team roster

The shop dashboard shows a "Team" section:

```
┌─────────────────────────────────────┐
│  Team                               │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  ogallo (you)                       │
│  Owner · since 14 Sept              │
│                                     │
│  Mary Kamau                         │
│  Manager · since 15 Sept            │
│  Last action: 6 orders today        │
│  [Change role] [Remove]             │
│                                     │
│  John Otieno                        │
│  Staff · since 15 Sept              │
│  Last action: 3 orders today        │
│  [Change role] [Remove]             │
│                                     │
│  Grace Wanjiku                      │
│  Viewer · since 16 Sept             │
│  No activity                        │
│  [Change role] [Remove]             │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  [ Invite a team member ]           │
│                                     │
└─────────────────────────────────────┘
```

Each row shows:
- Name + role
- When they joined
- **Last action** — the most recent attributed row, formatted
  as "N orders today" or "no activity"
- Two actions for owners/managers: change role, remove

**No ratings. No "top performer." No comparison.** Just who
they are and what they've done.

## The activity log

Every action on a shop writes an entry:

```
ACTIVITY_LOG
├── id
├── shopId
├── actorId             (userId — who did it)
├── action              ('order_accepted' | 'order_fulfilled'
│                        | 'offer_created' | 'offer_edited'
│                        | 'offer_deleted' | 'update_posted'
│                        | 'walk_in_posted' | 'money_withdrawn'
│                        | 'team_member_invited'
│                        | 'team_member_removed'
│                        | 'role_changed')
├── targetId            (order ID, offer ID, etc.)
├── metadata            (action-specific JSON)
├── at                  (ISO — EAT)
└── ip                  (nullable — for security)
```

The log is **append-only**. Actions cannot be edited or
deleted. A member's history survives their removal.

**The owner can filter the log by actor.** This is what makes
the Shop Brief meaningful:

```
TODAY · 21 Sept
─────────────────────────────────────
ogallo (owner)
  15:32  Invited Grace as viewer

Mary (manager)
  18:14  Fulfilled order #4821
  18:22  Fulfilled order #4824
  18:41  Fulfilled order #4826
  19:12  Posted update "closing in 30"

John (staff)
  14:22  Fulfilled order #4819
  15:10  Accepted order #4822
  16:05  Fulfilled order #4822

No activity
  Grace (viewer)
```

The owner sees exactly who did what, when. Not because
someone reported it. Because the log recorded it.

## The suspension and removal paths

**Suspend** — temporary. The member cannot act. Their history
remains. They can be restored.

**Remove** — permanent for that row. The member cannot act.
Their history remains. To re-add them, invite again — a new
row is created.

**Every action writes a `teamHistory` row with a reason.**
Suspension and removal require a reason field (free text,
minimum 10 characters). The reason is visible to the owner.
Never to the removed member.

```
TEAM_HISTORY
├── id
├── shopId
├── memberId
├── change              ('invited' | 'accepted' | 'role_changed'
│                        | 'suspended' | 'restored' | 'removed')
├── fromRole            (nullable)
├── toRole              (nullable)
├── reason              (nullable — required for suspend/remove)
├── changedBy           (userId)
└── at                  (ISO)
```

## The ownership transfer

The single most dangerous operation. Must be atomic.

```
┌─────────────────────────────────────┐
│  Transfer ownership                 │
│                                     │
│  This will make {{memberName}} the   │
│  new owner of {{shopName}}.         │
│                                     │
│  You will become a manager. You     │
│  will no longer be able to:         │
│  · Withdraw money                   │
│  · Change roles                     │
│  · Delete the shop                  │
│                                     │
│  This cannot be undone by you       │
│  alone. The new owner must transfer │
│  it back.                           │
│                                     │
│  Type the shop name to confirm:     │
│  [                               ]  │
│                                     │
│  [ Transfer ownership ]             │
│                                     │
└─────────────────────────────────────┘
```

When confirmed:

1. New owner's role → `owner`
2. Old owner's role → `manager`
3. Both rows updated in one database transaction
4. If the transaction fails, neither row changes
5. A `teamHistory` row records the transfer
6. Both users are notified
7. The old owner sees a message: "You are now a manager.
   The new owner is {{name}}."

**Zero or two owners is impossible.** The transaction either
applies both updates or neither.

## The staff surface

A staff member's app is different. They see:

```
┌─────────────────────────────────────┐
│  {{shopName}}                       │
│  You are staff                      │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  ORDERS TO FULFIL (3)               │
│                                     │
│  ● Order #4821                      │
│    Mary · 3 items · KES 1,240       │
│    [Mark fulfilled]                 │
│                                     │
│  ● Order #4824                      │
│    Peter · 1 item · KES 340         │
│    [Mark fulfilled]                 │
│                                     │
│  ● Order #4826                      │
│    Grace · 2 items · KES 890        │
│    [Mark fulfilled]                 │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  RECENTLY FULFILLED                 │
│  ✓ #4819   Mary   14:22              │
│  ✓ #4822   Peter  15:10              │
│                                     │
└─────────────────────────────────────┘
```

**No money screen.** No team management. No settings. Just
the orders they can act on and the log of what they did.

When a staff member taps "Mark fulfilled," the action writes
an `activity_log` row with their `actorId`. The owner's
brief will say "John · 3 orders today."

## What to remove from the current surface

- Any "share your password" instruction in docs or onboarding.
- The single-user assumption that every action on a shop is
  by the owner.
- The "1 member" text on the shop card — replace with the
  real member count from `teamMembers` where status is
  `active`.
- The `permissions.canRead` style stubs if any exist in the
  code. Replace with the real matrix.

## Test requirements

- Inviting a phone number creates an `invited` `teamMember`
  row. The invite link expires in 7 days.
- Accepting the invite creates an `active` row.
- A staff can accept orders. The activity log records their
  `actorId`.
- A staff cannot post offers. The API refuses.
- A staff cannot view money. The API refuses.
- A viewer can see everything. The API refuses every write.
- A manager can invite staff but not change roles.
- An owner can transfer ownership. The transaction is atomic.
- A shop cannot have zero owners. Transferring to a member
  who doesn't exist fails.
- A shop cannot have two owners. Attempting to set two fails.
- Removing a member writes a `teamHistory` row with a reason.
- Removed members cannot act. The API refuses.
- Re-inviting a removed member creates a new `teamMember`
  row. History from the old row remains.
- The activity log is append-only. No update or delete
  endpoints exist for it.
- The permission matrix in `permissions.js` matches the
  enforcement on every API endpoint. A test loops through
  every (role, action) pair and asserts the API allows or
  refuses exactly as the matrix says.

## The one rule

Every action has an actor. Every actor has a scope. Every
scope is revocable. Every revocation is logged. The
attribution is the truth.

No one shares a password. No one guesses who did what. No
one gets blamed for a shop's decision they didn't make.

Team & Roles is the boundary between the shop and its
people. It is what makes a shop more than one person.

## Order of operations

1. `teamMember` entity + status state machine.
2. `teamHistory` entity (append-only).
3. `activity_log` entity (append-only).
4. The permission matrix in `permissions.js`.
5. Server-side enforcement on every shop-scoped write.
6. Invite flow: form, WhatsApp message, link.
7. Acceptance flow.
8. Team roster on the shop dashboard.
9. Activity log with actor filter.
10. Ownership transfer (atomic).
11. Staff-specific surface.

Each step ships separately. Each step has its own test. No
step depends on the next.

## What this unblocks

- The Shop Brief gets real attribution ("Mary · 6 orders").
- Shops can grow beyond one person without sharing
  passwords.
- Every action on a shop is traceable to a real user.
- Views and permissions are enforced server-side.
- A viewer role gives accountants and partners read access
  without write risk.
- Ownership transfer is possible without account migration.
- The daily brief becomes a real management tool, not a
  passive sum.

The team is the boundary. Ship it after Settlement Rail so
the money has attribution. Ship it before Shop Brief so the
brief can attribute.

## Reference

The Shop Brief says "3 orders fulfilled today." Without Team
& Roles, that's a sum. With Team & Roles, it says "Mary
fulfilled 2, John fulfilled 1." That's the difference
between a report and a truth.

Ship this. Then the brief has meaning.
````

---

## Operator's note (received with the prompt, outside it)

> **Where We Are Now** — eight builder prompts delivered:
>
> | Prompt | Surface | Depends on |
> |---|---|---|
> | **Shop Brief** | Owner daily truth | Team & Roles |
> | **Settlement Rail** | Money movement | — |
> | **Nearby** | Consumer entry | — |
> | **Shopping Run Stream** | Coordination | Nearby + Rail |
> | **Invite-a-Shop** | Growth | Nearby + Rail |
> | **Events & Ticketing** | Consumer inflow | Rail |
> | **Partner Onboarding** | Supply side | Rail |
> | **Team & Roles** | Permission layer | — |
>
> **Recommended build order now:**
>
> 1. **Settlement Rail** (ManualRail first) — nothing financial works without it
> 2. **Team & Roles** — the shop can grow beyond one person
> 3. **Nearby** — consumer entry
> 4. **Partner Onboarding** — supply side, unblocks delivery
> 5. **Shop Brief** — now meaningful with roles in place
> 6. **Invite-a-Shop** — growth
> 7. **Events & Ticketing** — consumer inflow
> 8. **Shopping Run Stream** — community coordination
>
> **Natural next prompts:**
>
> 1. **Verification Flow** — how a shop earns the ✓ badge (cleanly, once)
> 2. **Reviews (settlement-gated)** — real trust from real orders
> 3. **The Space Editor v2** — edit a public page with history
> 4. **The Consumer Profile** — buyer's own page: orders, saved shops, reviews
> 5. **Dispute Resolution** — when things go wrong between buyer, seller, or partner
>
> Say **"next"** and I'll pick the highest-leverage one.

The reference section asks: "The Shop Brief says '3 orders fulfilled
today.' Without Team & Roles, that's a sum." The tree answers: the brief
already says who — "Recorded by," grouped by the actor each row names,
unattributed rows named as such — because attribution was put on the rows
before any crew table existed. What this prompt truly adds is the other
half of the sentence the brief could not print: not who acted, but who
may — and who may no longer. Build the matrix, put the actor on order
rows, decide the 1:1 model out loud, and the brief gains nothing it must
apologise for. One more standing correction to the table: Events &
Ticketing appears in it for the third time, and has still never been
sent.
