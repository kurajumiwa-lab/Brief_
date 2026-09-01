# Brief — Lean-Engineering Capability Map

A navigable reference tying the "hyper-practical, zero-overhead" playbook to
the files where each pattern already lives in this repository. Nothing here is
aspirational — every row is verified against the current `main` (`8faf9a7`,
the modular-shell build).

---

## 1. Derive data, don't store it

| Pattern | Where it lives |
|---|---|
| Ledger balances derived by scanning transactions (no wallet column) | `server/src/domain/ledger.js` — `walletBalance()` sums `ledgerTransactions` |
| Commission split derived, never stored (`commissionEarned` doesn't exist) | `server/src/domain/settlement.js` — `splitAmount()`, `vendorEarnings()`, `platformCommission()` |
| Leaderboard derived from confirmed results | `server/src/domain/arena.js` — `leaderboard()` scans `arenaResults` |
| Referral totals derived from deduplicated event rows | `server/src/domain/referrals.js` |
| Campaign metrics derived (views/registrations/revenue) on read | `server/src/domain/campaign.js` — `analytics()` |
| Pool/ROSCA balance + recipient derived from contributions + rotation order | `server/src/domain/pool.js` |

## 2. Idempotency for shaky connections

| Pattern | Where it lives |
|---|---|
| Server-side idempotency key on orders | `server/src/domain/order.js` — `createOrder({ idempotencyKey })` |
| Payment intent idempotency + replay-safe receipts | `server/src/domain/payment.js` — `createIntent()`, unique `receipt` |
| Replay-safe webhooks (unique provider ref, timing-safe secret) | `server/src/connectors/tuma.js`, `mpesa.js` |
| Footsteps replay protection (per-vault `seq`) | `server/src/domain/footsteps.js` |
| Single-use handoff tokens | `server/src/domain/handoff.js` |
| Auction bid idempotency key | `server/src/domain/auction.js` |

> Note: the resource describes a *client-side offline queue with local storage
> replay*. Brief currently does idempotency **server-side** (the more robust
> half of the pattern). A client `clientKey` + offline-replay queue is a real
> gap if offline-first is a goal — not built yet.

## 3. Ladder onboarding (gradual, utility-driven)

| Pattern | Where it lives |
|---|---|
| Federated sign-in + ladder state machine | `src/api/briefApi.ts` — `LadderRung`, `Ladder`, `OnboardingState` |
| Rung ids: identity → orient → value → contribute → reach | `LadderRungId` in `briefApi.ts` |
| Anonymous read-first, gate only on transaction | `src/engine/` bootstrap (`whoAmI` 401 → local identity) |

## 4. The "zero-API" WhatsApp communication engine

| Pattern | Where it lives |
|---|---|
| "Brief builds the shop, WhatsApp IS the shop" | `src/components/WhatsAppShopBuilder.tsx` |
| Markdown price list → `wa.me` deep link | `server/src/domain/shop.js` + `WhatsAppShopBuilder.tsx` |
| Share intents (WhatsApp/Telegram/X) derived, never hardcoded origins | `server/src/domain/campaign.js` — `shareView()` |

## 5. Manual operator-verified payment desk (Pochi la Biashara)

| Pattern | Where it lives |
|---|---|
| Pochi has no API → manual M-Pesa code flow | `server/src/domain/fees.js` |
| Operator confirms a reference, flips the access switch | `server/src/routes/fees.js`, `server/src/domain/advertising.js` — `confirmFunding()` |
| Pochi number surfaced from `BRIEF_POCHI_NUMBER` (honestly null if unset) | `server/src/routes/fees.js` |

## 6. Strict 1-level referral network (anti-pyramid)

| Pattern | Where it lives |
|---|---|
| `MAX_REFERRAL_DEPTH = 1` — no event kind can pay a level above the first | `server/src/domain/referrals.js` |
| No entry fee anywhere | `referrals.js` header comment (enforced structurally) |
| Points → cash only from a pool = `POOL_RATE (10%)` of confirmed service-fee revenue | `referrals.js` — `POOL_RATE = 0.10` |
| Conversion refused when the pool is empty (never tomorrow's recruit) | `referrals.js` |

---

## Where the playbook's *"drill down first"* question lands

All three functional domains the resource asks about — **derived ledger,
idempotency, ladder onboarding** — are already implemented. The one genuine gap
is the **client-side offline queue** (the resource's `clientKey` + local-storage
replay half); Brief does idempotency server-side only. If offline-first matters
for the target market, that is the single highest-leverage missing primitive.

---

## Monetization rails (current state)

| Provider | One-line | Required env vars |
|---|---|---|
| **Tuma** (STK Push) | Kenyan mobile money, merchant settles to till | `TUMA_EMAIL`, `TUMA_API_KEY`, `TUMA_WEBHOOK_SECRET`, `BRIEF_PUBLIC_ORIGIN` |
| **Paystack** | Card/transfer; **one var** | `PAYSTACK_SECRET_KEY` (auto live/sandbox by `sk_live`/`sk_test` prefix) |
| **MPESA / Daraja** | Lipa Na M-Pesa Online | `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, `MPESA_CALLBACK_SECRET`, `MPESA_ENV`, `BRIEF_PUBLIC_ORIGIN` |
| **Pochi** (service fees) | Manual desk, no API | `BRIEF_POCHI_NUMBER` |

Collection is fail-closed; the active provider is the first configured one, or
`BRIEF_COLLECTION_PROVIDER` if it names a fully-configured provider.
