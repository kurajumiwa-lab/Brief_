# HudumaLink — The Distributed Action Layer

A conversational micro-platform that sits **inside WhatsApp**, **paid through M-Pesa**, and
**governed by Kenya's Data Protection Act**. It shifts user value from *finding information*
to *buying completed legal and administrative results*.

This is a working, tested module inside the Brief ingestion server. It follows the host
codebase's non-negotiable rule — **never fake a capability**: every network seam (WhatsApp
outbound, M-Pesa STK, headless execution) **fails closed** with an honest `503` until real
credentials are mounted, and money is **always derived server-side**.

```
cd server && npm run test:huduma      # 117 offline assertions, no network/credentials
```

---

## Architecture — the Three-Layer Loop

```
[ FRONTEND  ]  WhatsApp Business Cloud API  ── interactive menus inside one chat thread
      │
[ ROUTING  ]  src/domain/huduma/router.js   ── structural classifier + per-phone state machine
      │
[ EXECUTE  ]  orders.js (escrow)  →  executor.js (headless/runner)  →  document delivery
```

| Layer | File | Responsibility |
|------|------|----------------|
| **Catalog** | `catalog.js` | What we sell + the **server-derived** price split (gov + platform + margin) |
| **Session** | `session.js` | Per-phone conversational state machine (no frontend) |
| **Router** | `router.js` | Classify inbound (`button_reply` / `list_reply` / free text) → advance the session → build & dispatch replies |
| **Orders + Escrow** | `orders.js` | The `PENDING → PAID → RUNNING → COMPLETED` loop and the `NONE → LOCKED → RELEASED` escrow ledger |
| **Executor** | `executor.js` | Headless automation / runner dispatch seam (pluggable; honest when unwired) |
| **Users** | `users.js` | Phone-keyed data subject + the **AES-256-GCM** eCitizen token |
| **WhatsApp** | `whatsapp.js` | Outbound interactive payloads (buttons / list / document) + dispatch |
| **M-Pesa** | `connectors/mpesa.js` | Safaricom Daraja: OAuth, STK Push, password, callback parsing |
| **Routes** | `routes/huduma.js` | Webhook (verify+inbound), STK push, M-Pesa callback, deep-link, status |
| **Schema** | `sql/hudumalink.sql` | PostgreSQL target: the 4 blueprint tables, CHECK constraints, RLS |

---

## The conversational flow (one chat thread, no app)

```
User enters via a wa.me deep link (ad / QR code / TikTok)
🤖  Habari! Welcome to HudumaLink…
    [ Business & Corporate ] [ Lands & Property ] [ Document Delivery ]

👤  taps "Business & Corporate"
🤖  (list menu) Select the result you need:
       Fetch Official CR12 Document — KES 500
       Draft & Digitally Sign Tenancy Agreement — KES 1,500
       Start Full Company Registration — KES 3,500

👤  picks "Fetch Official CR12 Document"
🤖  Please enter your *Company Name or Registration Number*:

👤  "ACME Holdings Ltd"
🤖  [buttons] CR12 Document … Total: KES 500   [ Pay with M-Pesa ] [ Cancel ]

👤  taps "Pay with M-Pesa"
🤖  ✅ Order received. Enter your M-Pesa PIN to authorise KES 500…
       (M-Pesa STK pushed → funds LOCKED in escrow on callback)
       → headless executor fetches CR12 → PDF delivered in chat → escrow RELEASED
```

Every arrow above is exercised end-to-end in `test/huduma.mjs`, with the network seams
injected so the logic is provable offline.

---

## The Secure M-Pesa Escrow Loop

The escrow is **not** a stored balance — it is a derived state from a ledger row, exactly
like the rest of this codebase. Funds move through a strict, server-authoritative lifecycle:

```
createOrder      status=PENDING,   escrow=NONE
stkPush          register a PENDING escrow row (CheckoutRequestID recorded)
callback (ok)    status=PAID,      escrow=LOCKED   ← amount MUST match order total
beginExecution   status=RUNNING,   escrow=LOCKED
completeOrder    status=COMPLETED, escrow=RELEASED ← only when a real document artefact exists
  (refundOrder)  status=REFUNDED,  escrow=REFUNDED
```

**Integrity guarantees enforced (and tested):**

- **Money is derived, never accepted from the client.** The STK amount is read from the
  order row, which was computed from the catalog. A `price`/`total` in any payload is ignored.
- **A token payment cannot lock a large order.** `lockEscrow()` refuses a callback whose
  amount ≠ the order total, before any status moves.
- **Escrow releases only on a verified artefact.** `completeOrder()` requires a concrete
  `{ url, signatureHash }` document. An unconfigured executor returns no artefact, so it can
  *never* release money — the order stays `RUNNING`, escrow stays `LOCKED`.
- **Idempotency everywhere.** Replayed STK pushes and redelivered callbacks are no-ops.
- **Completed orders are final.** A delivered result cannot be refunded.

---

## Data Protection & ODPC (Kenya DPA 2019) — the security rules

This module is built to be registrable with the Office of the Data Protection Commissioner.
The controls map directly to the Act's principles:

### 1. Encryption at rest — AES-256-GCM (`crypto.js`)
- The eCitizen token (and any credential) is encrypted **before** it is persisted.
- A **fresh 96-bit IV per record** (IV reuse would break GCM) and a **128-bit auth tag**
  stored alongside the ciphertext. Tampering fails decryption rather than yielding garbage.
- The master key (`HUDUMA_MASTER_KEY`) **never touches the database** — it lives only in the
  application's process memory. A stolen backup is useless without separate key access.

### 2. Fail-closed storage (`users.js`)
- A token is **refused** (`encryption_key_not_configured`) when no key is set — it is never
  persisted in cleartext "just to keep working".
- A token is **refused** (`terms_not_accepted`) until the user has an explicit consent record.
- **Right to erasure:** `clearEcitizenToken()` wipes ciphertext, IV and tag together.
- `publicUser()` is the only projection that leaves the server — it emits `hasEcitizenToken:
  true/false`, never the blob.

### 3. Lawful basis, purpose limitation & minimisation
- Identity is the **phone number** (the WhatsApp handle the citizen already uses). We collect
  no more than the service's `inputs` require (company name, plot number, etc.).
- The catalog tags each service `software` or `runner`, so purpose is explicit and the data
  flows only to the execution kind that needs it.

### 4. Integrity & confidentiality of processing
- **Webhook authenticity:** the WhatsApp inbound is verified over the **raw body** with a
  timing-safe HMAC (`X-Hub-Signature-256`); it fails closed with no app secret.
- **Callback authenticity:** Daraja signs nothing, so authenticity is a **secret path segment**
  **plus** re-verification of the `CheckoutRequestID` we issued and the amount we asked for.
- **Defence in depth (SQL schema):** Row-Level Security policies scope an application role to
  its own `huduma_orders` / `huduma_escrow` / `huduma_documents` rows — a second authority
  check behind the application's own.

### 5. Accountability & auditability
- Every order and escrow row carries an **append-only `history`** trail (`{status, at, note}`).
- Every M-Pesa callback is **persisted** to `paymentCallbacks` (accepted or rejected) for audit.
- The delivered document carries a **SHA-256 signature hash**, proving the artefact the
  citizen received is the one the platform stamped.

### 6. Storage limitation
- Temporary files produced by execution scripts must be **deleted immediately after delivery**
  (the runner/automation contract; the executor seam is where this lifecycle is enforced).
- Runner-uploaded scans must be **metadata-stripped** and never saved to the runner's gallery
  (the PWA/gig layer this seam dispatches to).

### What this module does NOT do (stated honestly)
- It is **not** key management: master-key rotation is an operational procedure (`rotateAll`)
  the module exposes but does not auto-run.
- It is **not** the headless portal login or the runner PWA: those are real integrations
  wired through `executor.registerExecutor()`. Until then the layer reports
  `executor_not_configured` and holds funds rather than pretending.

---

## Wiring it live

```bash
# 1. Data protection
openssl rand -hex 32   # -> HUDUMA_MASTER_KEY

# 2. WhatsApp (Meta App Dashboard)
#    WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN (inbound verify, already used by Brief)
#    WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID   (outbound interactive + document delivery)
#    HUDUMA_WA_NUMBER                            (for the wa.me deep links)

# 3. M-Pesa Daraja (https://developer.safaricom.co.ke)
#    MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_PASSKEY, MPESA_SHORTCODE
#    MPESA_CALLBACK_SECRET                       (openssl rand -hex 24)
#    MPESA_ENV=production                        (once live)
#    BRIEF_PUBLIC_ORIGIN=https://your.host       (so Daraja can reach the callback)

# 4. Point Meta's WhatsApp webhook at:
#    GET/POST  https://<BRIEF_PUBLIC_ORIGIN>/api/huduma/webhook
# 5. Point Daraja's STK CallbackURL at (auto-built):
#    POST      https://<BRIEF_PUBLIC_ORIGIN>/api/huduma/webhooks/mpesa/<MPESA_CALLBACK_SECRET>
```

Until each seam is configured, `GET /api/huduma/status` reports the honest state and the
relevant route returns `503` rather than faking a send or a charge.

---

## Routes

| Method | Path | Purpose |
|-------|------|---------|
| `GET` | `/api/huduma/status` | Honest config state (which seams are live) |
| `GET`/`POST` | `/api/huduma/deeplink` | Build the "Zero-Click" wa.me deep link |
| `GET` | `/api/huduma/webhook` | Meta subscription handshake |
| `POST` | `/api/huduma/webhook` | Inbound WhatsApp → router → reply |
| `POST` | `/api/huduma/stk-push` | Programmatic order + STK (e.g. from a PWA) |
| `POST` | `/api/huduma/webhooks/mpesa/:secret` | Daraja callback → escrow lock → execute |
| `GET` | `/api/huduma/orders/:id` | Order status for the citizen/PWA |

---

## Adding the real execution layer

The router and escrow are finished; fulfilment is a single seam:

```js
import * as executor from './domain/huduma/executor.js';

executor.registerExecutor(async (orderId) => {
  const order = orders.getOrder(orderId);
  const token = users.getEcitizenToken(order.phone);   // decrypted in-memory, used, dropped
  // ... Puppeteer against eCitizen / dispatch to a runner PWA ...
  const pdfBuffer = await compile(order, token);
  return {
    ok: true,
    executorRef: 'automator-1',
    document: { url: await uploadShortLived(pdfBuffer), signatureHash: sha256(pdfBuffer) }
  };
});
```

`completeOrder()` releases escrow **only** when that returns a real artefact.
