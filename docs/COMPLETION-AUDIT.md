# Brief — Repository-Wide Completion Audit (§5)

Date: 2026-08-28. Baseline re-run before any change: **3417 assertions, 0 failures**
(server 1845/0/1 skipped · livecamp 111/0 · client 1274/0 GREEN · tc exit 0 ·
live HTTP 43/0 + 27/0 + 91/0 + 26/0 with writes). Audit method: static extraction
of the API client (243 exported functions), all 342 HTTP routes, every component
import graph, plus live probes against the production server.

Decision vocabulary per the brief: **A** complete it · **B** integrate it into an
existing loop · **C** remove it.

---

## F1 — P0 SECURITY · Operator surface is unguarded (§24 violation)

Every `/api/ops/*`, `/api/admin/*`, `/api/economic/reconcile`,
`/api/economic/payments/reconcile` route is protected only by `requireAuth`
(any logged-in user). **Verified live:** a freshly-registered ordinary account
gets 200 on `/api/ops/diagnostics`, `/api/ops/reports`, `/api/ops/unverified`
(moderation queue data), triggers a real disk backup via `POST /api/ops/backup`,
and reaches admin collection writes. No platform roles exist (only circle-level
roles). No audit trail for consequential operator actions.

**Decision A:** add platform roles + capabilities (`viewer, operator, reviewer,
finance, admin`), enforce at the route layer with 403 + honest reason, bootstrap
via environment (`BRIEF_ADMINS`, `BRIEF_OPERATORS` handle lists), and record
consequential actions to an append-only audit log. Guard the system-trigger
endpoints too (`/api/calendar/sweep`, `/api/workflows/sweep`, `/api/ligi/tick`,
`/api/engine/sync|tier`, `/api/ops/seed*`, `/api/ops/backup`).

**F1 remediation log (completed):** capability guards live server-side
(`ops.read/ops.run/moderate/finance/admin`, roles viewer→admin, env bootstrap
`BRIEF_ADMINS/REVIEWERS/FINANCE/OPERATORS`), 403 bodies name
`requiredCapability`, consequential actions land in `auditLog` (read via
`GET /api/ops/audit`, roles set via `POST /api/ops/roles` with before/after +
reason). Two follow-on holes found and closed during verification:

- `GET /api/economic/wallet` and `GET /api/transactions` were **anonymous and
  platform-wide** — no auth, and the fold summed every actor's rows while the
  UI (Workflows → Records → Money; the menu sheet) presented it as *your*
  wallet. Both now require auth and fold **only the caller's rows**
  (`counterparty === me`). The platform-wide fold is reserved for the F4
  operator Commerce home behind the `finance` capability. The menu sheet's
  dead wallet fetch (fetched, never rendered) was removed.
- The server test suites `run.js` and `huduma.mjs` assigned
  `process.env.BRIEF_DATA_DIR` **after** statically importing `store.js`, and
  ESM hoists imports above module body code — so both suites silently bound to
  the production store and `store._reset()` **wiped it on every run** (the
  prod store was found reduced to the suites' own fixture users; backup
  rotation then ate the pre-wipe backup). Fixed with `test/test-env.mjs`
  imported first in both suites (pid-unique temp store); verified by md5 of
  `server/data/brief.json` unchanged across a full suite run.

## F2 — Pulse was retired; the brief mandates five destinations (§2, §20)

`App.tsx` says "Four screens … Pulse was retired". `PulseSection` type, the
pulse derivations (`pulseNow`, `pulseNotices`, `pulseRecentlyVerified`,
`pulseGroupSignals`), `TownHealth` + `deriveTownHealth`, and the orphaned
`src/components/Pulse.tsx` all remain — dead code from a retired destination,
while the product spec requires Pulse as "what changed that matters".
**Decision A:** restore Pulse as the fifth destination (`nearby | arena |
mylayer | workflows | pulse`, ids/URLs stable), rebuilt change-first (§20):
notifications, newly confirmed objects, kept-object changes, group signals
(real membership only), event reminders, workflow completions. Retire the
vanity town-metrics reading (the code's own field note says it attracted
nobody) and delete the dead derivations it leaves behind.

## F3 — Notifications: complete server feature, zero UI

`domain/notifications.js` (kinds: confirmed, challenge, saved_changed,
event_soon, system, workflow) + `/api/notifications` + `/api/notifications/read`
exist and are tested. Client functions `getNotifications` /
`markNotificationsRead` exist — **no UI caller**. Users can never see what
changed. **Decision A/B:** notifications become a primary Pulse input, with
mark-read wired through the surface.

## F4 — Admin operating surface: no UI at all (§21–24)

The server has a rich operator API (`ops/diagnostics`, `ops/reports`,
`ops/unverified`, `ops/analytics`, `ops/contributors`, `admin/collections`,
`admin/tea`, `admin/media`, `media/status`, `economic/reconcile`,
`economic/wallet`, connector status…) — none of it is reachable from any
screen. No operator can operate the system through the product.
**Decision A:** build the admin area as a separate authenticated surface
(not a sixth consumer destination): Health / Attention / Ingestion / Content /
Media / Commerce / Security & compliance / Diagnostics, with complete loops
(flag → inspect → decide → audit; upload → validate → serve → missing-file;
order → payment → settlement → reconciliation) and capability-gated controls.

## F5 — Abandoned server-only products (no UI, no client, not in the product spec)

| Module | State | Decision |
|---|---|---|
| `auction` (10 routes + domain + tests) | zero client code, zero UI, never referenced by the brief | **C — remove** |
| `pools` (7 routes + domain + tests) | chama/stokvel savings; zero client code | **C — remove** |
| `routes/fantasy.js` (8 routes) | `/api/fantasy/*` surface unused; `domain/fantasy.js` is the engine behind Ligi, which has its own live routes + UI | **C — remove the HTTP surface, keep the domain for Ligi** |
| advertiser console (`/api/advertising/advertiser|campaigns|matches|assets` CRUD) | 4 client functions written, never called; no actor in the five-destination model | **C — remove console routes + client fns.** Keep the serving/attribution side (`assetForTrackingHash`, `/api/click`, `/api/public/ad/:trackingHash`) because campaign registration attribution uses it |

## F6 — Orphan client code

* `src/components/PipelineExplorer.tsx` — imported nowhere, contains a
  button without a handler. **C — remove.**
* `src/components/Pulse.tsx` — orphaned by the Pulse retirement; superseded by
  the F2 rebuild. **C — remove file; the new Pulse surface is authored fresh.**
* `src/components/TeaSection.tsx` — superseded by `TeaReader`. **C — remove.**
* Dead client API functions after F5 + the loops below are wired
  (41 candidates at audit time; each is either wired by F7/F8 or removed with
  its feature).

## F7 — Half-loops: server + client function exist, no UI (Decision A/B each)

| Surface | Uncalled client functions | Where it lands |
|---|---|---|
| Circle governance | `inviteMember`, `setMemberRole`, `removeMember` | Circle detail members panel (coordinator-gated) |
| Media lifecycle | `listMyMedia`, `deleteMedia` | Workflows → Create (media manager beside the editor); health/missing files → Admin → Media |
| Waitlist | `getCampaignWaitlist`, `acceptWaitlistOffer` | Calendar section (capacity → waitlist → accept) |
| Order depth | `getOrder`, `settleOrder`, `getDisputes` | Orders/records surfaces + Admin commerce loop |
| Commerce records | `getVendors`, `updateVendor` | Vendors section completion |
| Onboarding ladder | `getLadder` | Onboarding/NextStep — ladder from real rows (§12) |
| Vault operations | `listVaultRequests`, `routeVaultRequest` | Vault (Records) + operator review |
| Lobby trust | `vouchHost` | LobbyBoard host trust row |
| Arena | `abandonArenaMatch` | Active-match card action |
| Objects | `confirmObject`, `reportObject` | Object detail actions (§8 verify/report) |
| Ops/demo | `clearDemo`, `getActivationMetrics` | Admin (operator) |
| Session | `logout` | account menu (verify present; wire if missing) |

## F8 — Endpoints with no product caller that are *legitimately* external (keep)

Webhooks (`/api/webhooks/*`, `/api/huduma/webhooks/*`, tuma), WhatsApp/M-Pesa
huduma surfaces (their UI is WhatsApp itself + status is honest), health /
ready / status / capabilities (infra + release smoke), `/api/public/feed`
(documented external API), `/api/click` + `/api/public/ad/:hash` (external
link targets), favicon.

## F9 — §4 violation: two rogue `fetch()` calls in App.tsx — FIXED

Lines 5096–5097 called `/api/capabilities` and `/api/status` directly, outside
`src/api`. **Done:** `getConnectorCapabilities()` / `getIngestStatus()` now
live in `briefApi.ts` with typed bodies and shape guards; App.tsx routes the
boot checks through them and its local `INGEST_API` const is gone. A repo
sweep confirms no `fetch(` outside `src/api/briefApi.ts` anywhere in the
client tree (tc clean, client suites 1274/0).

## F10 — Navigation vocabulary drifted from the product (§2, §7, §10, §11)

Ids are right (`nearby arena mylayer workflows`) but labels read
Home/Play/Saved/Inbox; My Layer bundles and Workflows bundles already match the
brief (Kept/Groups/Creator; queue-first with Create/Sell/Run/Records —
verified `TriageQueue` is the Workflows landing). **Decision A:** restore the
brief's destination names, add Pulse, keep every section id/URL stable. Also
verify no onboarding-ladder chrome renders inside My Layer surfaces (§10).

## F11 — Button/handler sweep

Automated scan of all `<button>` elements in `App.tsx` + 58 components found
exactly one handler-less button — inside orphan `PipelineExplorer.tsx` (F6).
No other dead controls at the DOM level; remaining risk is at the *journey*
level (half-loops above), which F7 addresses.

---

## Execution order

1. **P0** F1 (roles, guards, audit log, tests)
2. **P1** F2+F3 (Pulse destination + notifications), F9, F10
3. **P2** F4 (admin surface)
4. **P3** F5+F6 (removals)
5. **P4** F7 (half-loop completion)
6. Full baseline re-run + §29 walkthrough + report

Every step keeps all suites green; removals delete their tests with them so
the totals stay honest.
