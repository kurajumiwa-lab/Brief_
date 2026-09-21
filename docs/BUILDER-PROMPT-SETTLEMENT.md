# Trace — The Settlement Rail (Builder Prompt)

> Status: **the seam exists; the queue and the reconciler do not.** The
> provider-agnostic rail, the honest refusals, the idempotency and the
> row-backed states were built before this prompt arrived — `providers.js`
> is the seam the prompt asks for, shaped as a capability object rather
> than a five-method interface. What is genuinely new here: the manual
> payout/collection *queues* (`awaiting_human` rows with evidence), the
> hourly reconciler sweep over in-flight rows, per-provider rate limiting,
> and a reversal path at the rail.
>
> Read **Corrections first** before building: two of the prompt's removals
> are already done, one of them (`buni.js:335`) would be a *downgrade* to
> re-do as written, and the ManualRail queue reverses a refusal this repo
> wrote down a reason for. Nothing here is argument for its own sake —
> every item below was verified against the tree on 2026-09-21.

---

## Corrections first (what was changed, and why)

1. **Tuma and IntaSend — already deleted.** The prompt's last removal item
   ("They were never wired. Delete them.") is done. `providers.js` keeps the
   written rationale in its header: Tuma needed a paybill/bank relationship
   Brief does not have; IntaSend was integrated, never exercised, and its
   payout tier for unregistered accounts is undocumented. The registry holds
   exactly one rail per direction (`COLLECTION_PROVIDERS = { buni }`,
   `DISBURSEMENT_PROVIDERS = { buni }` — `providers.js:30-31`). The history
   ran Daraja → Tuma-only (`TUMA-INTEGRATION-REPORT.md`) → both deleted for
   Buni. Re-adding a provider when its contract lands is a one-line
   registration, which is the prompt's "the rail is the seam" — already true.

2. **`buni.js:335` — the early return IS the honest behaviour; replacing it
   with a bare `isConfigured()` check would be a downgrade.** The line
   returns `{ ok: false, reason: 'transfer_contract_unverified', detail }`,
   where the detail is KCB's own note: the transfer endpoint is in the
   catalogue but its request body was never published, and "Brief will not
   move money out with a guessed payload." Behind the
   `BUNI_ALLOW_UNVERIFIED_TRANSFERS=1` switch it refuses a *second* time
   (`not_implemented`), because even enabled there is no payload to send.
   The check the prompt wants already exists around it:
   `isPayoutConfigured()` (`buni.js:345`), `providerStatus().payoutConfigured`
   (`false` today, asserted in `run.js:3546`), and `enablementState()`
   (`buni.js:132`) which reports the gate *and the reason*. A generic
   configured-check would keep the refusal and lose the reason. The prompt's
   own KcbRail rule — "until the letter lands, `isConfigured()` returns
   false, `settle()` returns `no_provider`, no silent fallback" — is exactly
   what this line already does, with better wording.

3. **A provider-agnostic rail already exists — shaped differently from the
   prompt's interface.** `providers.js` registers capability objects:
   `capabilities, isConfigured(), status(), credentialState/
   missingCredentials, collect(), parseCallback(), verifyCallbackSecret(),
   callbackUrl()` — payout rails add `disburse(), isPayoutConfigured(),
   payoutFee()`. Domain code calls the provider-neutral operations and never
   a vendor's payload shape; that is why the commerce webhook route can be
   rewritten for a new rail without touching a domain file. The prompt's
   five-method `SettlementRail` is a re-shape of this, not a new build. Any
   adoption of its naming must preserve the one invariant that matters:
   **the domain never learns a vendor's shape.**

4. **The state machine exists on both rails, with other names.** Every
   state is a row (`payouts`, `paymentIntents`, `paymentCallbacks`); no
   state is held in memory; callbacks are persisted *before* processing so a
   replay is auditable. The mapping:

   | Prompt | Payouts (`settlement.js`) | Collections (`payment.js`) |
   |---|---|---|
   | `pending` | `requested` (`:261`, `:285`) | `intent` |
   | `in_flight` | `processing` | `authorized` |
   | `settled` | `paid` | `confirmed` |
   | `failed` | `failed` (reason on the row) | `failed` |
   | `refused` | no row at all — `requestPayout` throws `provider_unavailable` *before* creating one | no row |
   | `reversed` | does not exist | `reversed` is a named terminal state (`INTENT_STATUS`, `payment.js:44-51`) that nothing routes to yet |

   Two philosophy differences, stated plainly. (a) *Refused*: the prompt
   wants refusals visible as rows; this repo refuses **before** the row
   exists and states the reason on the earnings/capability read instead
   (`vendorEarnings().payoutReason`, `providerStatus().reason`). A queue of
   rows that say "refused" is a second way to be honest, not the only one.
   (b) *Reversed*: the ledger already carries refunds as rows —
   `refunded` is a real transaction status with real transitions
   (`ledger.js:116-120`); what is missing is a rail-side reversal row and
   the door into `reversed`.

5. **ManualRail-as-queue reverses a recorded decision — so decide it,
   don't drift into it.** `requestPayout` (`settlement.js:285`) refuses to
   create *any* payout row when no disbursement provider is active:
   "Refuse rather than queue a payout Brief has no way to fulfil." The
   prompt's step 1 — `manualPayouts` rows with status `awaiting_human`, an
   admin queue, an `evidenceUrl` — is a different answer to the same
   problem, and it is a defensible one: the repo already runs
   finance-confirmed manual money rows elsewhere (`partnerSettlements`,
   `tableBankingPayouts` with maker-checker, Pochi la Biashara as a
   *practice*). The real difference is timing: those rows record a **fact
   after** a human moved money; the queue records an **intention before**.
   The queue is honest exactly as long as an `awaiting_human` row can never
   print as sent — which is also what the prompt says. Building it means
   changing `requestPayout`'s refusal for a configured *manual* rail. That
   is a product decision, it contradicts a comment in the tree, and this
   doc exists so the contradiction is decided deliberately.

6. **The reconciler is two jobs; one is built.** `settlement.reconcile()`
   (`settlement.js:204`) is the ledger half: recompute the economics from
   rows, report settled-without-transaction, amount mismatches, commission
   sums that disagree. `buni.paymentStatus()` (`buni.js:303`) is the
   explicit status read, "because a callback can be missed." What does NOT
   exist: the hourly sweep that finds rail rows `in_flight` past 15 minutes,
   queries the provider, applies the answer, and flags 24-hour strays for
   human review. The house pattern for it is already in the tree (the
   unref'd sweep timer behind the calendar and the shop brief). Rate
   limiting: `queue.js` has a token-bucket `allow(key, ratePerMin, burst)`
   (`queue.js:60`) that nothing points at a provider today — the Daraja
   ~1 req/second rule has infrastructure, not a binding.

7. **MpesaRail is mostly sitting in the tree, unregistered.**
   `connectors/mpesa.js` is a complete Daraja connector with the documented
   contract in its header (auth, STK push, B2C v3 body, Result URL), a flat
   `b2cFee()` passed through at exact cost, `isPayoutConfigured()`, and
   `disburse()`. The B2C *result* webhook is already routed and idempotent:
   `/api/webhooks/mpesa-b2c/:secret` (`commerce.js:771`) persists the
   callback, then `settlement.confirmPayout()` applies it — duplicate-safe
   (`duplicate: true` on re-delivery), fails closed on an unknown
   ConversationID. The connector is simply not in `DISBURSEMENT_PROVIDERS`.
   The prompt's step 6 — "wire Mpesa when Daraja approves; nothing else
   changes" — is closer to the truth than it knows: what remains is
   registration and enablement, not new plumbing.

8. **The prompt's "what to remove" list, audited.** Item 1 (`buni.js:335`):
   see correction 2 — do not replace it. Item 2 ("any place that returns
   `ok: true` when no provider is configured"): searched; none found — the
   webhook routes' `ok: true` responses are *acknowledgements* (with
   `duplicate` flags), not success claims about money, and every
   money-moving door refuses with a reason (`providerStatus().reason`,
   `payoutReason`, `transfer_contract_unverified`). Item 3 ("any 'pending'
   that isn't backed by a real row in `settlementAttempts` or
   `manualPayouts`"): those two collections do not exist; the rows that
   exist are `payouts`, `paymentIntents`, `paymentCallbacks`, and no
   in-memory pending was found. Item 4: see correction 1.

9. **The user-facing state strings are mockups.** "Sending — usually under
   a minute", "Sent · 14:32 with provider ref", the six-row table: shape,
   not build. The principle behind the table is already enforced —
   `providerStatus()` states the truth on `/api/capabilities`-adjacent
   surfaces, and "never show Sent for something in flight" is what
   `confirmPayout`'s idempotency guarantees. The claim "users check the app
   more often when the state is honest" is a belief, not a measurement; no
   surface may print it as one.

---

## The prompt's test requirements, audited

| Required by the prompt | Where it stands |
| --- | --- |
| manual disbursement: queue → admin taps "Sent" → ledger updates | **not built** — and it reverses `requestPayout`'s refusal (correction 5) |
| manual collection: instructions shown → admin confirms | **not built** as a manual rail; collection today is Buni STK when configured, else a ledger record of money that moved elsewhere |
| no provider → `refused`, never success | **held** — `run.js:3544-3547` (no active provider, reason stated), `run.js:3092-3093` (earnings explicitly not withdrawable, reason stated), `requestPayout` throws `provider_unavailable` |
| same `idempotencyKey` twice → refused/reused at the rail | **held** — `requestPayout` reuses the prior row (`reused: true`); one payout in flight per vendor |
| webhook arriving twice is idempotent, no double ledger write | **held** — callbacks persisted before processing; `confirmPayout` returns `duplicate: true`; the STK callback path reports `duplicate` the same way |
| reconciler marks a stuck row failed on the provider's word | **not built** — `paymentStatus()` exists; the sweep does not |
| a row `in_flight` 25 hours raises an escalation flag | **not built** |
| no test asserts a fake provider response | **held in spirit** — `run.js:4963-4967` registers a clearly-labelled test-only provider, removes it at `:5049`; Buni tests drive the documented contract through injected `fetchImpl`, and the unverified-payout switch is proven *not* to invent a call (`run.js:3707-3708`) |

## What is genuinely new here

A `settle()` entry that dispatches on the configured rail (today
collection and disbursement are entered from separate domain flows) · the
`manualPayouts`/`manualCollections` queues with `awaiting_human` /
`awaiting_payment`, evidence attachment, and a queue UI · the hourly
reconciler sweep with the 15-minute and 24-hour rules · a per-provider
rate limit bound to the rails · a rail-side reversal row and the door into
the reserved `reversed` state · MpesaRail registration when Daraja
approves. Everything else in the prompt is already standing, and two of
its removals are already done.

---

## The prompt, as received (verbatim)

What follows is the prompt exactly as it was received — unedited, including
the parts already done and the parts that contradict recorded decisions. It
is kept so the corrections above can be checked against the ask, and so no
future builder has to trust a paraphrase.

````markdown
# Trace — The Settlement Rail (Builder Prompt)

You are building the settlement rail: the layer that actually
moves money. Not the ledger. The ledger already exists and is
correct. This is the rail that sits between the ledger and the
outside world (M-Pesa, KCB Buni, or a human with a phone).

Right now the ledger records what should happen. The rail makes
it happen. They are different jobs.

## The problem it solves

Today, a work order completes. The ledger says "seller is owed
KES 4,500." But nothing moves. The money sits. The seller waits.
The buyer wonders if they'll be refunded. The owner wonders if
they actually collected.

The rail moves money on the ledger's say-so. Once the ledger
says "owed," the rail dispatches. Once the rail confirms,
the ledger marks "settled." Clean handoff, both directions.

## What you are building (and what you are NOT)

You ARE building:
- A provider-agnostic rail interface with three implementations:
  - `ManualRail` — human confirms they sent/received money
  - `MpesaRail` — Safaricom Daraja STK Push + B2C
  - `KcbRail` — KCB Buni collection + disbursement
- A single `settle()` function that dispatches to the configured rail
- A `pending → in_flight → settled | failed | reversed` state machine
- Webhook handling for asynchronous providers
- Idempotency keys on every external call
- Rate limiting per provider per day
- Honest state when no provider is configured

You are NOT building:
- Any new ledger model (the existing ledger is correct)
- Any wallet, cash balance, or stored total
- Any crypto, token, or points-based settlement
- Any "pending" that isn't tracked in a real row
- Any retry that isn't idempotent

## Non-negotiables

- The ledger is the source of truth. The rail reports back to it.
  Never the other way around.
- Every external call carries a UUID `idempotencyKey`. Duplicate
  calls with the same key are refused at the provider.
- Every state transition writes a row. No state is held in memory.
- If the provider is not configured, `settle()` returns
  `{ status: 'no_provider', reason: '...' }` — never fakes success.
- If the provider times out, the row stays `in_flight`. The
  reconciler picks it up. Never silently mark it settled.
- No number is printed that isn't a real ledger sum or a real
  provider confirmation.

## The rail interface

Every rail implements the same five methods. Nothing else.

```typescript
interface SettlementRail {
  name: string;

  // Is the provider configured? If not, all calls refuse honestly.
  isConfigured(): boolean;

  // Send money out (to a rider, seller, provider).
  // Returns immediately with a reference. The provider may confirm
  // asynchronously via webhook, or the manual rail confirms inline.
  disburse(params: {
    amount: number;
    currency: 'KES';
    recipient: string;        // phone, till, account
    reference: string;        // ledger row ID
    idempotencyKey: string;
  }): Promise<{
    status: 'in_flight' | 'settled' | 'failed' | 'refused';
    providerRef?: string;
    reason?: string;
  }>;

  // Receive money in (from a buyer, contributor).
  // Returns a reference the buyer must act on (STK Push pending,
  // or a payment link, or an instruction).
  collect(params: {
    amount: number;
    currency: 'KES';
    payer: string;
    reference: string;
    idempotencyKey: string;
  }): Promise<{
    status: 'in_flight' | 'settled' | 'failed' | 'refused';
    providerRef?: string;
    instructions?: string;   // what the payer must do
    reason?: string;
  }>;

  // Handle an async confirmation from the provider.
  // Called by the webhook handler. Must be idempotent.
  confirm(params: {
    providerRef: string;
    outcome: 'settled' | 'failed';
    providerData: unknown;
  }): Promise<{ acknowledged: boolean }>;

  // Reverse a settled payment (refund or chargeback).
  reverse(params: {
    providerRef: string;
    reason: string;
    idempotencyKey: string;
  }): Promise<{
    status: 'in_flight' | 'settled' | 'failed' | 'refused';
    providerRef?: string;
    reason?: string;
  }>;

  // Reconcile a batch of in-flight transactions against the
  // provider's statement. Returns discrepancies only.
  reconcile(params: {
    from: string;      // ISO date
    to: string;        // ISO date
  }): Promise<{
    mismatches: Array<{
      providerRef: string;
      ledgerAmount: number;
      providerAmount: number;
      resolution: 'resolved' | 'escalate';
    }>;
  }>;
}
```

Everything else — retry policy, backoff, rate limits, log
format — is shared across rails. Only these five methods differ.

## The three rails

### ManualRail (ship first)

The rail that works today, with zero provider dependencies.

`disburse()` writes a row to `manualPayouts` with status
`awaiting_human`. The owner or an admin sees the row in a queue.
They send money via M-Pesa manually. They tap "Sent." The rail
confirms. The ledger marks settled.

`collect()` writes a row to `manualCollections` with status
`awaiting_payment`. The payer sees instructions in their app
(M-Pesa number to send to, amount, reference). They pay. The
admin confirms receipt. The ledger marks settled.

Every row has an `evidenceUrl` field where the admin can attach
a screenshot of the M-Pesa confirmation. Not required, but
allowed. If attached, the payer can see it.

Honesty: the manual rail is not instant, not automated, but it
is real. Never fake the confirmation. If the admin hasn't tapped
"Sent," the row stays `awaiting_human`.

### MpesaRail (when Daraja is approved)

`disburse()` → B2C call to Safaricom. Asynchronous confirmation
via `MPESA_B2C_RESULT_URL`.

`collect()` → STK Push. Asynchronous confirmation via
`MPESA_CALLBACK_URL`.

`reverse()` → reversal request. Requires business approval for
most cases.

Rate limits: Daraja allows roughly 1 request per second per
shortcode. The rail enforces this in code.

### KcbRail (when the letter lands)

Same shape as MpesaRail. Different endpoints, different auth,
same five methods.

Until the KCB letter lands and the transfer spec is published,
`isConfigured()` returns false. `settle()` returns `no_provider`.
No silent fallback to another rail.

## The reconciler

Every hour, for each configured rail:
- Find rows with status `in_flight` older than 15 minutes
- Query the provider's status endpoint
- If the provider says settled, mark settled
- If the provider says failed, mark failed
- If the provider returns "not found," escalate

Rows stuck in `in_flight` for 24 hours are flagged for human
review. They do not auto-expire.

Write the reconciler once. It's provider-agnostic. Only the
status query differs, and it goes through the rail's `reconcile`.

## The honest states

When a user sees a payment in the app, they see one of:

| State | What it means | What the user sees |
|---|---|---|
| `pending` | Ledger row exists, no rail call yet | "Preparing" |
| `in_flight` | Rail called provider, awaiting confirmation | "Sending — usually under a minute" |
| `settled` | Provider confirmed | "Sent · 14:32" with provider ref |
| `failed` | Provider refused or failed | "Failed — reason" with retry option |
| `refused` | Rail refused (no provider, bad input) | "Cannot send — provider not configured" |
| `reversed` | Money was sent, then reversed | "Reversed — reason" |

Never combine `in_flight` and `settled`. Never show "Sent" for
something still in flight. Users check the app more often when
the state is honest.

## What to remove from the current code

- `buni.js:335` — the `transfer_contract_unverified` early
  return. Replace with the rail's `isConfigured()` check.
- Any place that returns `"ok": true` when no provider is
  configured. Replace with `"ok": false, reason: "..."`.
- Any "pending" that isn't backed by a real row in
  `settlementAttempts` or `manualPayouts`.
- The Tuma and IntaSend registrations in the connector registry.
  They were never wired. Delete them.

## Test requirements

- A manual disbursement: queue → admin taps "Sent" → ledger
  updates → user sees settled.
- A manual collection: instructions shown → admin confirms →
  ledger updates.
- A manual rail call with no provider configured returns
  `refused`, not success.
- Idempotency: the same `idempotencyKey` sent twice is refused
  at the rail level, not double-processed.
- A webhook arriving twice for the same provider ref is
  idempotent — no double ledger write.
- The reconciler finds a stuck row and marks it failed if the
  provider says so.
- A row stuck in `in_flight` for 25 hours creates an escalation
  flag for human review.
- No test asserts a fake provider response. Every test either
  mocks the provider correctly or uses the manual rail.

## The one rule

Money moves when the ledger says it should. The rail reports
back when it moves. If the rail can't move it, the ledger knows.
If the provider isn't there, the app says so.

Fake success is the only failure worse than a real one.

## Order of operations

1. `ManualRail` with `disburse()` only. Ship it today.
2. The queue UI: a list of `awaiting_human` rows the admin
   acts on.
3. `ManualRail.collect()`. Ship it this week.
4. The reconciler for manual rows (updates stale rows, flags
   old ones). Ship it next week.
5. `MpesaRail` skeleton with `isConfigured() = false`. All
   five methods return `no_provider` honestly. Ship it.
6. Wire Mpesa when Daraja approves. Nothing else changes.

The rail is the seam. Every provider slots into it. No provider
is the default. Manual is the fallback that always works.

## Reference

The ledger says what should happen. The rail makes it happen.
The reconciler ensures it happened. Three jobs. Three clear
ownerships. Nothing overlaps.
````

---

## Operator's note (received with the prompt, outside it)

> The Shop Brief tells owners the truth. The Shopping Run Stream lets
> residents coordinate. But **neither moves money**. Without the settlement
> rail, the ledger is a promise no one can keep.
>
> The rail is the thing every downstream feature depends on:
>
> - Settlement for shopping runs
> - Payouts for riders
> - Refunds for failed orders
> - Contributions for target Circles
> - Subscription billing for B2B
>
> **Build the rail next.** Ship `ManualRail` today. Ship the queue UI this
> week. Then every other feature can call `settle()` and know the money is
> real.
>
> Tell me when `ManualRail` is live and I'll help wire the first real
> settlement through it.

The seam is poured; the queues, the sweep and the reversal door are the
work. Build them on the seam that exists — and do not smooth
`buni.js:335` into a check that refuses without saying why.
