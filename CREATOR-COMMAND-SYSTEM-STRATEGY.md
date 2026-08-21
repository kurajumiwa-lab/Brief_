# Creator Command System (CCS) — Strategy & Architecture Map

**Date:** 2026-08-22 · **Method:** every mapping below was verified against the live
codebase. The CCS prompt describes a pivot from "social app" to "creator CRM +
automation platform + experience infrastructure." The honest finding is that
**Brief already owns ~65% of the CCS primitives under different names** — the
pivot is mostly a *reframing* plus a handful of genuinely-new systems, not a
rewrite.

---

## 1. The honest verdict

CCS is **not a rebuild**. Brief is already a creator/community operating system.
What it lacks is (a) the *naming* that makes that obvious, and (b) three
genuinely-new subsystems: a **workflow automation engine**, a **unified inbox**,
and a **media kit / partnership layer**. Everything else maps.

## 2. CCS module → existing Brief infrastructure

| CCS module | What Brief already has | Gap |
|---|---|---|
| **Creator Command Dashboard** | `command.js` + `/api/host/command` (NOW/MONEY/PEOPLE/DISTRIBUTION/ACTION/NEXT) + `analytics.js` | Present. Add "audience growth" + "LTV" (derivable from signals/orders). |
| **Audience Relationship CRM** | `person.js` (§4.4: people + verified aliases) + `vault.js` participants + `footsteps.js` (immutable interaction timeline) + `SaveLabel` tags | **The closest match.** A "contact" = a person row; "interaction history" = footsteps; "tags" = a new field on the person/alias. Small addition, big payoff. |
| **Communication Hub** | `outbound.js` (Twilio SMS/WhatsApp-send) + `notifications.js` (inbox) + Telegram/WhatsApp **ingest** | **Unified inbox is NOT built** — ingest writes objects, it doesn't surface a per-contact conversation view. Broadcast = `distribution.blast` (exists). |
| **Automation Engine** | `queue.js` (in-process queue) + `signals.js` (event log) + `assist.js` | **NOT BUILT.** No trigger→condition→action workflow. This is the single biggest new system. |
| **Creator Action Store** | `vendor.js`/`listing.js`/`order.js`/`payment.js` (sell, digital, one-time) + `campaign.js` (events, applications) | Mostly present. Missing: **recurring subscriptions** (ledger is one-time txns only) and **surveys**. |
| **Outdoor Experience Module** | `campaign.js` + `checkin.js` (title/location/capacity/price/registration/attendance) | Present. Add `requirements`/`equipmentList`/`emergencyContact`/`routeInfo` to campaign `metadata`. |
| **AI Creator Assistant** | `assist.js` (provider seam, fails-closed) | **CONFIGURATION REQUIRED** — abstraction exists, no AI credentials. |
| **Brand Partnership System** | `vendor.js` (creators *are* vendors; listings *are* offers) | **Media kit NOT built.** No audience-statistics/pricing/previous-campaigns object for a creator. |

## 3. The three genuinely-new systems (in build order)

### 3.1 Workflow Automation Engine (highest leverage)
`trigger → condition → action`, evaluated against the existing `signals` event
log. New schema: `workflows` (the rule) + `workflowRuns` (the log). Triggers map
to existing signal types (`object_saved`, `object_viewed`, `campaign_shared`,
`member_joined`, `order_created`…); actions map to existing primitives (send a
notification, run a `distribution.blast`, emit a follow-up). **No new messaging
rail needed** — actions reuse `outbound` + `notifications`.

### 3.2 Unified Inbox (communication hub)
A per-contact conversation projection: join Telegram/WhatsApp ingest `rawItems`
+ outbound sends + notifications by the resolved `person`. This is what makes
the CRM *feel* like a CRM instead of a list.

### 3.3 Media Kit + Brand Partnership
A `mediaKit` object per creator (derived audience stats from signals/orders,
interests, past campaigns, pricing) + a brand-facing "send opportunity" flow.
`vendor` already models the creator's commercial side; the media kit is the
discovery/marketing side.

## 4. "Colonize underutilized screen space"

The CCS pivot should not add screens — it should **reclaim the four that exist**:

| Screen | Becomes (CCS) |
|---|---|
| **Around (Screen 1)** | The creator's **public storefront + digest** — events, drops, Tea. Already is. |
| **Play / Arena (Screen 2)** | The **engagement workspace** — lobbies, challenges, pools. Already is. |
| **Saved (Screen 3)** | The **CRM + briefcase** — contacts, footsteps, saved vendors, contracts. Add the inbox + media kit here. |
| **Actions / Workflows (Screen 4)** | The **automation engine + distribution hub** — workflows, blasts, UTM. Add the workflow builder here. |

The "underutilized space" is exactly **Screen 4 (Workflows)** — it currently
holds host tools; it should become the automation surface, which is the
marquee CCS capability.

## 5. Recommended build order

1. **Automation engine** (3.1) — the differentiator; reuses signals + outbound.
2. **Media kit + partnership** (3.3) — small schema, large "this is a creator OS" signal.
3. **Unified inbox** (3.2) — makes the CRM complete.
4. **Recurring subscriptions** in the ledger — unblocks membership monetization.
5. **Outdoor fields** on campaign metadata — cheap completeness.

Each preserves the green baseline (server 1543 / client 1106 / typecheck 0 /
build) and the standing honesty rules (no fabricated metrics, no fake money,
no "configured" without credentials).
