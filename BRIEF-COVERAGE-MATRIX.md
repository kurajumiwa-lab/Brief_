# Brief — Coverage Matrix

Generated 2026-08-18. Every "Evidence" cell points at code, a named test, or a
live run that actually executed. Status vocabulary is used strictly:

🟢 BUILT · 🟡 PARTIAL · 🟠 CAPTURED, NOT BUILT · 🔴 MISSING / BROKEN

**Verification baseline at time of writing**

| Suite | Result |
|---|---|
| `server/test/run.js` | **1217 passed / 0 failed / 1 skipped** |
| `server/test/livecamp.mjs` | **111 passed / 0 failed** |
| `./run-suites.sh` (23 client suites) | **1105 passed / 0 failed** |
| `tc` strict typecheck | exit 0 |
| `live/2-commerce-over-http.mjs` | **43 / 0** against the production build |
| `live/3-public-campaign.mjs` | **26 / 0** against the production build |
| `live/4-full-chain.mjs` | **87 / 0** against the production build |
| Production build | 1535 modules, JS 442.77 kB (gzip 113.55), CSS 26.96 kB (gzip 5.46), **0 CDN refs** |

**Total: 2589 automated assertions, 0 failing.**

---

## 1. Identity & Auth — 🟢 BUILT

| Capability | Status | Evidence |
|---|---|---|
| Real accounts | 🟢 | `domain/auth.js`: `createUser`, `login`, scrypt password hashing with a per-user salt. Only a SHA-256 **fingerprint** of each session token is stored — the token itself is never persisted. |
| Session tokens | 🟢 | `issueSession` / `resolveSession` / `revokeSession` / `revokeAllSessions`, 30-day TTL. `authMiddleware` resolves a bearer token before any route runs. |
| Ownership from identity | 🟢 | Every mutating route derives the actor from the session. **No route reads an owner id from the body** — proven by the forged-order test and by the auth mutation table. |
| Expired / invalid session | 🟢 | Tested: expired, revoked, forged and malformed tokens all yield 401. |
| Multi-actor authorization | 🟢 | Actor A vs actor B over HTTP with real tokens, in both `run.js` and `live/4-full-chain.mjs`. The domain-layer workaround is **retired**. |
| Endpoint authorization rules | 🟢 | "ENDPOINT AUTHORIZATION RULES, ENCODED EXPLICITLY" block: with `BRIEF_DEV_AUTH=0`, **16 private operations all return 401**, 9 public reads stay public, and register/login stay reachable. |
| Self-scoped source creation | 🟢 | `POST /api/sources` requires an identity and grants the creator a membership; another actor gets 403 on delete, the creator gets 200. The rule is **encoded and tested**, per §15. |
| Connector-sync authorization | 🟢 | The three connector-sync routes plus both `brief-it` routes require an identity, so Brief cannot be used as an anonymous fetch proxy. |
| Public registration stays public | 🟢 | `POST /api/public/campaigns/:slug/register` works with **no token** and leaks no `ownerId` — the documented exception. |
| Client session layer | 🟢 | `session` suite (30 assertions): the token is attached centrally, cleared on 401, never stored alongside a password, and a signed-out client sends no credential. |
| Development mode | 🟢 | `BRIEF_DEV_AUTH` is an **explicit** opt-in. `startupDiagnostics` raises a problem if it is set in production, and `authStatus().insecure` agrees.

## 2. Objects & Capture — 🟢 BUILT

| Capability | Status | Evidence |
|---|---|---|
| Text → object | 🟢 | `pipeline/extract.js` + `ingest.js`; `/api/brief-it/save` live-verified in `live/3`. |
| Deduplication | 🟢 | Re-capturing identical text returns `duplicate:true` — asserted live in `live/3`. |
| Provenance | 🟢 | `objectSources` many-to-many; publish authority derives from it. |
| Classification | 🟢 | `parse` (28) + `capture` (27) + `ing` (29) suites. |

## 3. Campaigns / Distribution — 🟢 BUILT

| Capability | Status | Evidence |
|---|---|---|
| Campaign wraps an existing object | 🟢 | `campaign.js createCampaign()`; refuses a foreign object (`not authorised to attach this object`) — asserted in the events block. |
| Draft → published lifecycle | 🟢 | An unpublished campaign returns **404** on its public slug; live-verified. |
| Public projection is allow-listed | 🟢 | `campaign.js:publicView()`. Live-asserted: no `ownerId`, no roster, no `sourceId`, no `rawItem`. |
| Derived metrics | 🟢 | `remaining`/`soldOut` computed, never stored. |
| `camp` suite | 🟢 | 206 assertions. |

## 4. Signals — 🟢 BUILT

| Capability | Status | Evidence |
|---|---|---|
| Single activity layer | 🟢 | One `signals` collection; `signal.js`. No per-feature analytics tables. |
| Real events only | 🟢 | Live: `order_placed`, `order_cancelled`, `listing_published` present; **`order_settled` absent because nothing settled**. |
| No inflation | 🟢 | Idempotent cancel emits **exactly one** `order_cancelled` — live-asserted. |

## 5. Circles — 🟢 BUILT

| Capability | Status | Evidence |
|---|---|---|
| People/Purpose/Place/Blocks/Signals/Targets | 🟢 | `circle.js`, `block.js`, `member.js`; `src/components/circle/` (5 files). |
| Not a second marketplace or wallet | 🟢 | No circle-scoped transaction table; money flows through the one ledger. |
| `circleops` / `group` / `groupui` | 🟢 | 62 + 29 + 27 assertions. |

## 6. Vendors, Listings, Orders, Fulfilment — 🟢 BUILT

| Capability | Status | Evidence |
|---|---|---|
| Vendor lifecycle | 🟢 | `vendor.js`; trust is an **evidence list**, never a score. |
| Listing draft→active | 🟢 | Live: a new listing is `draft` and **not publicly discoverable** until published. |
| Server-authoritative pricing | 🟢 | Live: a client sending `price:1, total:1` still produced **total 5000**. `OrderCreate` has no price field by design. |
| Self-dealing refused | 🟢 | Live: "a vendor cannot order from their own listing" (400). |
| Fulfilment stages | 🟢 | `accepted→preparing→ready`; backwards refused; the stage endpoint **cannot reach `settled`**. |
| Terminal states | 🟢 | `cancelled` and `settled` are terminal — all 7 / 3 escape transitions refused (events + lifecycle blocks). |
| Idempotent cancel | 🟢 | Second cancel returns `changed:false`, not an error, and emits no second signal. |
| Quantity validation | 🟢 | Live: `1e308`, `MAX_SAFE_INTEGER`, `1e6`, `0`, `-1`, `2.5` all **400**; every stored total finite. |
| Idempotency | 🟢 | Live: concurrent duplicate keys → **one** order id, one persisted row. Unkeyed repeats still distinct (buying twice is legal). |
| `commerce` suite | 🟢 | **88** assertions (up from 72). |

## 7. Transactions, Ledger, Settlement, Payments, Payout — 🟡 PARTIAL (every code path built; no credentials exist)

| Capability | Status | Evidence |
|---|---|---|
| One economic layer | 🟢 | Single `ledgerTransactions` collection. No Arena/campaign/circle/vendor wallet anywhere. |
| Commission | 🟢 | `splitAmount()`: 5% default, env-clamped 0–0.5, `Math.floor` **in the seller's favour**. Exact across 1/7/33/99/101/333/4999/12345. Derived, never stored. |
| Settlement requires real money | 🟢 | `transitionOrder` refuses `settled` unless a **settled** ledger row is attached. Live: buyer settle → 403; domain settle → refused with reason. |
| Double settlement | 🟢 | Re-settling is a no-op; earnings and order count **do not double** (asserted numerically: 950 stays 950, count stays 1). |
| Reconciliation | 🟢 | `reconcile()` — proven by **injecting** a rogue settled-order-without-transaction and asserting detection, then `balanced:true` after removal. |
| Earnings endpoint | 🟢 | `GET /api/vendors/me/earnings`; live returns real zeros, never invented money. |
| Payment intent layer | 🟢 | `domain/payment.js`: intent · authorization · confirmation · ledger tx · settlement · failure, each a distinct state. Amounts read from the **order row**, never the caller. Buyer-only. |
| Webhook verification | 🟢 | `POST /api/webhooks/tuma/:secret` **fails closed** — a wrong or missing secret returns 403 `{"error":"rejected"}` with no detail. Live-asserted. |
| Replay / duplicate callbacks | 🟢 | Raw callbacks stored in `paymentCallbacks`; a repeated provider reference is recorded and ignored rather than settling twice. |
| Payment reconciliation | 🟢 | `reconcileIntents()` + `GET /api/economic/payments/reconcile`, balanced live. |
| Payout chain | 🟢 | `PAYOUT_STATUS`, `requestPayout` → `sendPayout` → `confirmPayout`. Withdrawable is **derived** as (settled net − paid − pending); there is no balance column. 41-assertion proof. |
| No fake success | 🟢 | With no credentials, `POST /api/orders/:id/pay` returns **503** with `charged:false` and a stated reason, and still records an intent for audit. It never fabricates a payment. |
| **Real disbursement** | 🔴 | `tuma.isConfigured()` is **false** — no Tuma credentials exist. `payments.configured=false`, `payoutAvailable=false`. **Genuine external blocker.** |

## 8. Public Distribution / Links — 🟢 BUILT

| Capability | Status | Evidence |
|---|---|---|
| Clean public link | 🟢 | `/c/:slug`; slug is not the security boundary — publication status is. |
| Non-leaking metadata | 🟢 | Live-asserted absence of `ownerId`, roster, `sourceId`, `rawItem`, `capturedBy`. |
| Invalid handling | 🟢 | Unknown slug → 404 leaking nothing; register to unknown → 404; empty body → 400. |
| Stranger participation | 🟢 | Live: registration succeeds without auth; re-registering the same contact takes no second seat. |

## 9. Events & Passing-Mass Distribution — 🟢 BUILT

| Capability | Status | Evidence |
|---|---|---|
| Event is a campaign type, not a new primitive | 🟢 | `CAMPAIGN_TYPES = ['popup','session','drop','event']` — per the architectural-discipline rule. |
| Host creates a controlled point | 🟢 | Private-by-default; the object is written `publication:'private'`. |
| Capacity enforced, not decorative | 🟢 | Live: seats 1–2 accepted, **3rd and 4th refused 409 "campaign is full"**, exactly 2 rows persisted. |
| Guest list is private | 🟢 | Public view of a full event exposes no `attendeeRef` — a **safety** property for private/LGBTQ+ gatherings, not a nicety. |
| No public/government-location assumption | 🟢 | `location` is free text supplied by the host. |

## 10. Marketplace — 🟢 BUILT (breadth), 🟡 depth

| Capability | Status | Evidence |
|---|---|---|
| Beyond e-commerce | 🟢 | `LISTING_TYPES = ['product','service','experience','event']`; a service needs no stock and no location (asserted in `commerce`). |
| Common supply architecture | 🟢 | One vendor/listing/order chain for goods, services and event offers. |
| Contracts / jobs / local fulfilment | 🟡 | Expressible as `service` listings + Circle blocks/tasks; no dedicated job-matching flow. |

## 11. Arena — 🟢 BUILT (free play), 🔴 gated (money)

| Capability | Status | Evidence |
|---|---|---|
| Server-side domain | 🟢 | `domain/arena.js` + 10 routes: Arena, Game, Match, Participant, Challenge, Result all persist server-side. **62-assertion proof**; live-verified that a second actor sees a challenge the first created. |
| Challenge lifecycle | 🟢 | `createChallenge` → `acceptChallenge` (idempotent, `reused:true`) → match. You cannot accept your own challenge; only the owner may cancel. |
| Dual-confirmation results | 🟢 | `reportResult` alone sets **no winner**; the reporter cannot self-confirm; the opponent confirms. Contradictory reports → `disputed`. Live-asserted end to end. |
| Result integrity | 🟢 | "Result not confirmed by both players" — no invented outcomes, and no server-decided winners. |
| **Real-money contests / pot rooms** | 🔴 **gated** | `domain/compliance.js`. `POST /api/arena/contests/:id/stake` returns **403 `compliance_gate`** enumerating 5 unmet requirements. A licence alone does **not** open it (asserted). |
| No fake Arena wallet | 🟢 | Live + client asserted: no wallet, no balance, no deposit/top-up/withdraw control anywhere in Arena. |
| Compliance surfaced in the UI | 🟢 | Arena renders "Brief does not handle match money", names licence / 18+ / KYC / payment rail / self-exclusion, and **never says "coming soon"**. |
| Signals, not a second analytics layer | 🟢 | Arena emits `arena_challenge_opened` / `_accepted` / `arena_result_reported` / `_confirmed` / `_disputed` into the **one** `signals` collection. |
| Arena marketplace / live feed | 🔴 | Not built. Would reuse listings + signals; no Arena-specific supply or analytics system will be added. |

**This is the honest position:** free and ranked play is a real, working
product. Paid contests are refused at the server, not hidden in the UI.

## 12. Fantasy 11 — 🟢 BUILT (non-economic core), 🔴 gated (paid entry)

| Capability | Status | Evidence |
|---|---|---|
| Competition → Fixture → Pool | 🟢 | `domain/fantasy.js` + 11 routes. `addPoolPlayer` is organiser-only and draft-only, so the pool is server-authoritative. |
| Squad rules | 🟢 | `SQUAD_RULES` / `validateSquad`: formation, budget and **max 3 per club** enforced. A hand-written squad that broke the club rule was the rule working, not a bug. |
| Captain multiplier | 🟢 | Applied in `scorePlayer`, covered by the scoring tests. |
| Lock time | 🟢 | `isLocked()` reads the **server clock**. No submission or edit after lock; no pool changes before it. |
| Duplicate submission | 🟢 | One entry per user per competition, enforced at the domain layer. |
| Deterministic scoring | 🟢 | `scoreCompetition` is pure and reproducible; ties share a rank. An explicit assertion proves a score is **never NaN** — the bug that review, not testing, first caught. |
| Auditability | 🟢 | Stats are recorded post-lock by the organiser only; scores derive from stat rows, never from a stored total. |
| **Paid entry** | 🔴 **gated** | `POST /api/fantasy/competitions/:id/paid-entry` → **403 `compliance_gate`**, the *same* gate as paid Arena. Live-asserted with the identical machine-readable code. **No Fantasy wallet exists.** |

## 13. Auction — 🟢 BUILT

`domain/auction.js` + 12 routes. An auction is **price discovery over an
existing listing**, not a second marketplace: when it closes, the winner
receives an ordinary Order that flows through the ordinary payment, ledger,
settlement and payout code.

| Rule | Status | Evidence |
|---|---|---|
| Bid ≠ transaction | 🟢 | Placing a bid writes **no** ledger row and **no** order — asserted by counting both collections before and after. Bids live in their own `bids` collection so nothing scanning the ledger can mistake an offer for income. |
| Bid ≠ revenue | 🟢 | `vendorEarnings()` is still `net: 0` with live bids standing. Live-asserted too. |
| Losing bid = no economic activity | 🟢 | Losers are marked `lost`; nothing is charged, refunded, reserved or held. |
| Highest valid bid is **derived** | 🟢 | No `currentPrice` column and no `highestBidId` pointer — both are computed by scanning bid rows. Retracting the leader **re-derives** the price (mutation-proven: storing it fails 7 assertions). |
| Server-authoritative close | 🟢 | `hasEnded()` uses the server clock; a late bid is refused even if the client disagrees. Mutation-proven. |
| Deterministic winner | 🟢 | Total order (amount DESC, placedAt ASC, id ASC). An equal bid is refused outright, so ties cannot arise through the API; a forced tie still breaks by who bid first, reproducibly across three runs. |
| No casual reopen / edit | 🟢 | `closed` / `settled` / `cancelled` / `failed` are terminal. Reopening, re-closing with a new winner and late bidding are all refused. A seller **cannot** cancel out from under a live bid. |
| Explicit winner-non-payment | 🟢 | `defaultWinner()`: seller-only, moves the auction to `failed`, cancels the order, returns stock, records the reason, and **does not** auto-award the runner-up. Refused outright once the order is genuinely paid. |
| No bidder-data leakage | 🟢 | `publicView()` exposes the leading **amount** and bid **count**, never identities. A rival bidder gets 403 on the bid list; only the seller may read it. Live-asserted over HTTP. |
| No auction wallet | 🟢 | No auction balance, no auction commission rate, no auction transaction type. Commission is the ordinary 5% `splitAmount`. |
| Reserve price | 🟢 | Its **existence** is public, its **value** is not. An unmet reserve closes with no sale, no winner and no order. |
| Variants | 🟢 | `ascending`, `popup` (creator/pop-up) and `circle` (members-only, membership enforced) share one mechanism. **Buy Now** is implemented as a bid at the fixed price followed by a close, so it cannot drift from the normal path. |
| Settlement honesty | 🟢 | `markSettled()` reads the order's ledger transaction and **refuses** unless it is genuinely settled — it cannot be used to fake a sale. Mutation-proven. |

**Mutation-tested:** 10 deliberate defects (stale stored price, latest-bidder
wins, reserve ignored, bidder list leaked, closed auction reopened, winner
order priced at 1, paid auction defaulted, fake settlement, server clock
ignored, cancel under a live bid) — **all 10 detected**.

## 14. External Connectors — 🟡 PARTIAL, accurately marked

| Connector | Status | Evidence |
|---|---|---|
| Web fetch | 🟢 | Real. `robots.txt` gate corrected after `github.com/robots.txt` proved blank lines do **not** terminate a group. Wikipedia fetched successfully; Facebook correctly blocked. |
| RSS | 🟢 | Real. BBC World: 24 items parsed, all correctly rejected (no time/place/price signal). |
| Telegram | 🟡 | Real HTTP. `api.telegram.org` reachable; invalid token → genuine **401** surfaced as `{ok:false,status:401}`. Webhook verifies `TELEGRAM_WEBHOOK_SECRET` and **fails closed**. No valid bot token exists. |
| WhatsApp | 🟠 | Connector shape present, `isConfigured()` false. |
| Payments | 🔴 | None. Drives every payout limitation above. |
| Maps / media storage / email / analytics | 🔴 | Not connected; not faked. |
| Manual paste | 🟢 | Always available — the deliberate fallback. |

`/api/capabilities` reports all of the above truthfully, including
`payments.configured:false` and `arenaMoney.enabled:false`.

## 15. Security (§18) — 🟢 fixed and regression-tested

| # | Vulnerability | Before | After |
|---|---|---|---|
| 1 | IDOR on `POST /api/objects/:id/publish` | 200, object made public | **403**; positive case (granted source member) still works; revoked access refused |
| 2 | `DELETE /api/sources/:id` unauthorized | 200, source deleted | **403** / 404; memberships cascade |
| 3 | Quantity overflow (`Number.isInteger(1e308)` is `true`) | 201, total `null`/9e18 | **400**; all stored totals finite |
| 4 | Missing idempotency | 5 concurrent → 5 orders | **1 order**, same id |
| 5 | Client-trusted pricing | — | not vulnerable; live-reproved (`price:1` ignored) |
| 6 | Double settlement | — | no-op; earnings do not double |
| 7 | Unlicensed real-money contests | endpoint would have been reachable | **403 at the server** |
| 8 | Commerce routes had no auth guard | anonymous `POST /api/vendors` → 400, `/api/listings` → 403, `/api/orders` → 400, earnings → 404 | **401 on all four.** Found by the new authorization block, not by inspection |
| 9 | Source creation / connector sync unguarded | anonymous callers could create sources and drive outbound fetches | **401**; source creation now grants the creator a membership |

Every one is now a permanent assertion in `server/test/run.js`, not a
throwaway probe.

**Previously-open gaps, now resolved and encoded (§15):**

- `POST /api/sources` — **self-scoped by rule**, and the rule is now written in
  the code and tested: any identity may declare a source, doing so grants
  **only that caller** a membership, and no other user's data becomes
  reachable. Anonymous callers get 401.
- `POST /api/sources/:id/membership` and the 3 connector-sync endpoints —
  now require an identity, so Brief cannot be driven as an anonymous fetch
  proxy.
- `POST /api/public/campaigns/:slug/register` — **intentionally public**, and
  asserted to stay that way while leaking no `ownerId` and no attendee roster.

The authorization contract is now a test, not a comment: with
`BRIEF_DEV_AUTH=0`, **16 private operations return 401** and **9 public reads
stay public**.

## 16. Testing (§19) — 🟢 BUILT

| Type | Evidence |
|---|---|
| Unit | Domain modules throughout `server/test/run.js`. |
| Integration | HTTP `call()` against a real `app.listen(0)`. |
| Authorization | Correct actor vs unauthorized actor for publish, source delete, fulfil, settle, stage, campaign object attach. |
| Lifecycle | Valid **and** invalid transitions; terminal states proven terminal. |
| Economic | Amounts, commission across 8 values, settlement preconditions, idempotency, reconciliation **including a negative case**. |
| Regression | Every security fix has a permanent test. |
| Client journeys + failure states | 23 suites, 1105 assertions; failure paths (sold out, refusals surfaced verbatim, honest empty states). |
| Session / credential handling | `session` suite: token attached centrally, discarded on 401, never co-stored with a password, no credential sent when signed out. |
| Mutation testing | Auth, payments, payouts, Arena, Fantasy and Auction rules are **mutation-proven** — the Auction alone survived 10 deliberate defects, all detected. |
| Not manipulated for green | Every failure this session was investigated at the source. Most were my test's wrong assumptions (a listing that is draft by design, the classifier's two-signal rule, `sellerAmount` vs `seller`, a ledger path with no `authorized` state, a squad breaking the max-3-per-club rule). **Two were real product defects** — commerce routes returning 400/403/404 instead of 401, and a circle-membership check against a `status` field that does not exist. Both were fixed in the product, never by weakening the test. |

## 17. Deployment (§21) — 🟢 BUILT

| Item | Status | Evidence |
|---|---|---|
| Production build | 🟢 | `preview/` has `build` + `preview` scripts; 1535 modules; **0 CDN references**. |
| Self-hosted CSS | 🟢 | Tailwind moved off `cdn.tailwindcss.com` to a local build: **5.46 kB gzipped** vs a ~100 kB+ third-party round trip. The app is now styled **offline** — material for a low-data, mobile-first audience. |
| Prod API path | 🟢 | `vite preview` carries the **same `/ingest` proxy contract as dev**, so the built artifact is tested on the path the browser really uses. |
| Live prod verification | 🟢 | **43 + 26 + 87 = 156 assertions** through `:4173/ingest`, covering the whole chain plus Arena, Fantasy, Auction and ops. |
| Env vars | 🟢 | `BRIEF_DATA_DIR`, `PORT`, `BRIEF_COMMISSION_RATE`, `TELEGRAM_WEBHOOK_SECRET`, `BRIEF_GAMING_LICENCE_ID`, `BRIEF_KYC_PROVIDER`. No secrets in source. |
| Error handling | 🟢 | Corrupt DB file is moved aside, not fatal. Atomic write via tmp + rename. |
| Structured logging | 🟢 | `ops.js`: one JSON object per line; `requestLogger` strips query strings and never logs bodies or `Authorization`. |
| Health + readiness | 🟢 | `GET /api/health` and `GET /api/ready`. Readiness is **real**: injecting a rogue settled order with no transaction flipped it to **503** naming the `settlement` check, and removing it returned 200. |
| Startup diagnostics | 🟢 | Flags `BRIEF_DEV_AUTH=1` in production, a missing `TUMA_WEBHOOK_SECRET` when payments are configured, and an unwritable data dir. |
| Backup / recovery | 🟢 | `POST /api/ops/backup` writes a file that parses as JSON, carries the schema version and contains real rows; `pruneBackups(store, 2)` kept exactly 2 of 4. |
| Graceful shutdown | 🟢 | SIGTERM/SIGINT drain with a 10s force timer, final backup, structured `unhandledRejection` / `uncaughtException` logging. |
| Scheduled jobs / workers | 🟡 | No daemon by design. Expiry is handled opportunistically: `auctions.sweepExpired()` runs on read, so an ended auction closes the next time anyone looks. |

## 18. Migrations (§13) — 🟢 BUILT

`store.js` merges loaded data over `EMPTY`, so **additive changes remain
free** — new collections and new optional fields appear on an existing
database with no migration and no data loss. That claim is now *tested*
rather than asserted: against a genuine pre-Batch-3 fixture, `users`,
`payouts` and `arenaMatches` all appear without anyone writing a migration.

On top of that, schema churn is now versioned:

| Capability | Status | Evidence |
|---|---|---|
| Version stamp | 🟢 | `SCHEMA_VERSION = 2`; a fixture with no `__schemaVersion` is detected as version 0. |
| Ordered upgrade path | 🟢 | `MIGRATIONS` = `1:baseline`, `2:backfill-order-currency`, applied **in order**, logging `schema_migrated`. |
| Safe startup | 🟢 | The real `server/data/brief.json` migrated 0 → 2 on first load with existing rows byte-intact. |
| Backup before change | 🟢 | `<DB_FILE>.pre-v<N>-<ts>.bak` is written **before** any transform. |
| Deterministic | 🟢 | An order with no currency is backfilled to `KES`; one already marked `USD` is **not** overwritten. Re-running is a no-op (`migrated:false`). |
| Recovery / abort | 🟢 | A throwing backup hook (`disk full`) **aborts** the migration rather than half-applying it, and the error names the backup path. |
| Older-fixture test | 🟢 | "MIGRATIONS AGAINST AN OLD FIXTURE" block in `server/test/run.js`. |

## 19. UI (§24) & No Feature Theatre (§25) — 🟢

| Rule | Evidence |
|---|---|
| Five destinations, unchanged | Nearby · Arena · My Layer · Workflows · Pulse. `dest` (22) + `nav` (88). |
| "If there's nothing there, show nothing" | A seller with nothing settled sees **no** earnings panel — not "KES 0". Asserted in `commerce`. |
| No fake balances | No withdraw/cash-out/payout control exists; asserted by absence. |
| Trust is evidence, never a number | `verification.evidence[]` + `facts[]`; asserted "verified never defaulted true". |
| No AI branding | Parsing is invisible. |
| No "coming soon" | Arena states the actual regulatory reason instead. |
