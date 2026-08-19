# Brief — Final Build Report

Date: 2026-08-18. Status vocabulary used strictly. No percentages, because a
percentage of an unfinished product is a guess dressed as a measurement.

---

## 1. BUILT

Everything here is server-authoritative, tested at multiple layers, and
verified against the production build over HTTP.

**Foundation (frozen, no regressions)**
Objects & capture · dedup · provenance · classification · campaigns with
publication lifecycle and public projection · Signals · Circles · vendors ·
listings · orders · fulfilment · server-authoritative pricing · quantity
validation · idempotency · public distribution · events · private
distribution · production build with self-hosted assets.

**Real identity (§3)**
Accounts with scrypt-hashed passwords and per-user salts. Only a SHA-256
*fingerprint* of each session token is stored — never the token. Bearer
sessions with a 30-day TTL, revocation, and `authMiddleware` resolving the
actor before any route runs. **No route reads an owner id from the request
body.** Multi-actor authorization is now exercised over real HTTP with real
tokens; the old domain-layer workaround is retired. Development mode is an
explicit opt-in that startup diagnostics flag as unsafe in production.

**Payments (§4)**
`domain/payment.js` distinguishes intent · authorization · confirmation ·
ledger transaction · settlement · failure. Amounts are read from the order
row, never the caller. Webhook verification **fails closed**. Raw callbacks
are stored for audit and duplicate detection. Reconciliation runs against
provider references. With no credentials, paying returns **503 with
`charged:false`** and still records an intent — there is no fake success mode
anywhere in the codebase.

**Settlement and payout (§5)**
`Order → Payment → Confirmed transaction → Ledger → Settlement → Seller
earnings → Payout` is complete in code. Commission is derived (5%, env-clamped
0–0.5, floored in the seller's favour so the parts sum exactly). Withdrawable
is derived as (settled net − paid − pending); there is no balance column
anywhere. Settlement without a settled ledger row is refused, and that refusal
is correct.

**Arena server domain (§7)**
Arena, Game, Match, Participant, Challenge and Result all persist server-side.
Challenge acceptance is idempotent. Results require **dual confirmation** —
reporting alone sets no winner, the reporter cannot self-confirm, and
contradictory reports produce `disputed`. Arena emits into the one Signals
collection; it has no analytics system of its own and no economy of its own.

**Fantasy 11 non-economic core (§10)**
Competition → Fixture → Player pool → Team selection → Captain multiplier →
Submission → Lock → Scoring → Ranking. The lock time and player pool are
server-authoritative, no editing survives the lock, one entry per user, and
scoring is pure and deterministic with shared tied ranks.

**Auction (§11)**
Price discovery over an existing listing — not a second marketplace. A bid
writes no ledger row and no order. A losing bid produces nothing at all. The
highest valid bid is **derived**, so retracting the leader re-derives the
price. Closing is server-clock authoritative and the winner is chosen by a
total order (amount, then time, then id), so it is reproducible. Closed,
settled, cancelled and failed are terminal. Winner non-payment is an explicit
seller-only path that cancels the order, returns stock and refuses outright
once the money has actually arrived. Bidder identities never reach a rival.
Variants: ascending, pop-up, Circle (membership enforced), plus Buy Now
implemented as a bid at the fixed price followed by the normal close.

**Operations (§14) and migrations (§13)**
Structured JSON logging that never records bodies or `Authorization` headers.
A readiness endpoint tied to real reconciliation state. Startup diagnostics,
auth-guarded diagnostics and backup endpoints, backup pruning, and graceful
shutdown with a final backup. Schema versioning with an ordered migration
list, backup **before** any transform, and abort-on-failure so a migration is
never half-applied.

---

## 2. PARTIAL

| Area | What exists | What is missing |
|---|---|---|
| **Payments / payouts** | Every code path: intents, confirmation, webhook verification with replay protection, settlement, payout states, reconciliation. | **Credentials.** `payments.configured=false`, `payoutAvailable=false`. No money has ever moved. |
| **Marketplace depth** | The common `Object → Listing → Order → Fulfilment → Transaction` chain, four listing types, fulfilment stages, disputes, auctions. | Services lifecycle and jobs/contracts (`request → offer → acceptance → completion`) are not built as first-class flows. |
| **Connectors** | Web fetch and RSS are genuinely live. Telegram is real HTTP that fails closed without a token. | Telegram has no valid bot token; WhatsApp is connector-shaped only. |
| **Scheduled work** | Auction expiry is swept opportunistically on read. | No daemon, no worker, no cron. A single process by design. |

---

## 3. CAPTURED, NOT BUILT

Nothing remains in this category. The Auction — the sole occupant at the start
of this mandate — is now built and mutation-proven.

---

## 4. MISSING / BROKEN

Not started. Not faked. Not padded into the matrix.

- **Arena marketplace and live feed** — would reuse listings and Signals; no
  Arena-specific supply or analytics layer will be added.
- **Maps** — no provider connected.
- **Media storage** — no object store.
- **Email** — no provider.
- **Analytics** — deliberately absent. Signals are real state changes, not
  page views.
- **WhatsApp** — connector shape only; `isConfigured()` is false.
- **Real-money Arena and paid Fantasy 11** — refused at the server by the
  compliance gate. This is a gate, not a gap.

Nothing is broken. There are no known failing paths.

---

## 5. VERIFIED — exact results

| Check | Result |
|---|---|
| `server/test/run.js` | **1217 passed · 0 failed · 1 skipped** |
| `server/test/livecamp.mjs` | **111 passed · 0 failed** |
| `./run-suites.sh` (23 client suites) | **1105 passed · 0 failed** |
| `tc` strict typecheck | **exit 0** |
| `live/2-commerce-over-http.mjs` | **43 · 0** against the production build |
| `live/3-public-campaign.mjs` | **26 · 0** against the production build |
| `live/4-full-chain.mjs` | **87 · 0** against the production build |
| Production build | 1535 modules · JS 442.77 kB (gzip 113.55) · CSS 26.96 kB (gzip 5.46) · **0 CDN references** |

**Total: 2589 automated assertions, 0 failing.**

Server suite progression across this mandate:
702 → 768 (auth) → 855 (payments) → 896 (payout) → 958 (Arena) →
1029 (Fantasy) → 1069 (ops + migrations) → 1084 (authorization rules) →
**1217 (Auction)**.

**Mutation testing.** Tests that cannot fail prove nothing, so each economic
rule was deliberately broken to confirm the suite notices. The Auction alone
survived **10 injected defects — all 10 detected**: stale stored price,
latest-bidder-wins, reserve ignored, bidder list leaked, closed auction
reopened, winner order priced at 1, paid auction defaulted, fake settlement,
server clock ignored, and cancelling out from under a live bid.

**Two real defects were found by the new tests**, not by inspection:

1. Commerce routes (`POST /api/vendors`, `/api/listings`, `/api/orders`,
   `GET /api/vendors/me/earnings`) refused anonymous callers with 400/403/404
   rather than 401 — they had no explicit auth guard and were relying on
   incidental failure. Fixed.
2. The circle-auction membership check tested `status === 'active'`, but
   member rows carry a role and an evidence list and have **no status
   column** — the check would have excluded every legitimate member. Fixed in
   the product, not in the test.

Every other failure during this work was my test's wrong assumption (a listing
that is draft by design, the classifier's two-signal rule, `sellerAmount` vs
`seller`, a ledger path with no `authorized` state, a squad legitimately
breaking the max-3-per-club rule). **No product rule was weakened to make a
test pass.**

---

## 6. EXTERNAL BLOCKERS — genuine only

These are not engineering gaps. Every one is code-complete and waiting on
something only a human with credentials or a licence can supply.

1. **Tuma credentials** — business email + API key (from the Tuma merchant
   portal), a webhook secret, and a public origin for the callback. Without
   them no money can move, `payments.configured` stays false, and payouts stay
   unavailable. The intent, confirmation and settlement code is already
   written and tested against the Tuma contract.
2. **Gaming licence, 18+ verification, KYC provider, and self-exclusion
   register** — all four, plus a payment rail, are required before real-money
   Arena or paid Fantasy 11 can be enabled. A licence alone does not unlock
   it, and that is asserted.
3. **Telegram bot token** — the connector makes real HTTP calls and surfaces a
   genuine 401 today. Authenticated channel ingestion is untested because no
   valid token exists.
4. **WhatsApp Business credentials** — not available.

---

## 7. PRODUCTION STATUS

**Deployable today** as a real, single-process product for capture,
distribution, Circles, commerce, Arena free play, Fantasy 11 and Auctions,
with genuine multi-user authentication and honest refusal everywhere money
would otherwise be faked.

**Not deployable as a payments product**, because no payment provider is
connected — and the application says so out loud rather than pretending
otherwise. `/api/capabilities` reports `payments.configured:false` and
`arenaMoney.enabled:false`; paying returns 503 with `charged:false`; earnings
show real zeros instead of invented balances.

The single coherent chain holds end to end:

    Identity → Object → Campaign/Distribution → Participation
      → Listing/Order/Activity → Fulfilment → Transaction → Ledger
      → Settlement → Payout

with the Arena and Auction chains joining it rather than running beside it.
There is one economic layer, one activity layer, one navigation system, and no
parallel economies, fake balances, fake payments, fake Arena money or fake
auctions anywhere in the product.
