# Brief — Market-Ready Elevation: Reconnaissance & Gap Map

Status legend: **REAL** (connected end-to-end), **PARTIAL** (backend/domain
exists, UX or a leg is incomplete), **SIMULATED** (looks functional, doesn't
perform the real operation), **DEAD** (unused/duplicated/obsolete),
**DANGEROUS** (can create inconsistent financial/auth state).

> Traced UI → API → domain → persistence → state transition where relevant.

---

## Feature classification

### Payments & money
| Feature | State | Notes |
|---|---|---|
| Order → payment intent → ledger → settlement | **REAL** | Amount from order row; client/callback amounts rejected; settlement requires a settled ledger tx. |
| Tuma collection (STK Push) | **REAL** | `connectors/tuma.js`, real contract, fail-closed webhook, idempotent confirm, deduped footsteps. **Live rail blocked only by missing credentials (no Tuma sandbox).** |
| Provider seam | **REAL** | `providers.js`: `COLLECTION={tuma}`, `DISBURSEMENT={}`. |
| Daraja | **DEAD (removed)** | Connector, routes, env vars, B2C all deleted. No references remain. |
| Payout / disbursement | **PARTIAL** | Domain + honest `503/provider_unavailable` exists; no provider selected (intentional). |
| Refund | **PARTIAL** | `refunded` ledger status + registration demotion exist; no provider refund endpoint. |

### Events / campaigns / ticketing
| Feature | State | Notes |
|---|---|---|
| Campaign lifecycle (draft→published→live→closed) | **REAL** | Transition-gated, capacity writable only while draft. |
| Registration + capacity enforcement | **REAL** | Idempotent, live-count capacity, paid spots held as `started`. |
| Registration lifecycle (started→registered→confirmed→checked_in/cancelled/no_show) | **REAL** | Terminal-state transitions enforced; no revival, no double-charge. |
| Ticket codes + gate check-in | **REAL (this pass)** | Opaque `BRF-XXXX-XXXX-XXXX` codes issued at register; `GET/POST /api/tickets/:code(/check-in)` with not-found/cancelled/unpaid/already-in/checked-in states, operator attribution, idempotent re-scan, vault footstep. |
| QR rendering | **PARTIAL** | Codes exist; a QR *bitmap* is not yet drawn (code is the scannable input). |
| Gate operator **UI** | **PARTIAL** | API + domain complete; no dedicated mobile gate screen yet. |

### The Vault (context layer)
| Feature | State | Notes |
|---|---|---|
| Vault identity + scoped roles | **REAL** | host/guest/vendor/admin/public; roles from stored rows only. |
| Footsteps timeline | **REAL** | Immutable, category-filterable, paginated, deduped, roster-named. |
| Channel handoff + guest entry tokens | **REAL** | Signed, expiring, single-use, participant-bound. |
| Commerce↔Vault narration | **REAL** | Orders, payments, check-ins emit footsteps onto linked vaults. |
| Vendor requests (create→route→accept) | **REAL** | Vendor sees only scoped requests. |

### Distribution / public
| Feature | State | Notes |
|---|---|---|
| Public campaign page + share links | **REAL** | `publicSlug`, share-intent URLs, honest `publicOrigin: null`. |
| Public vault entry (no account) | **REAL** | `/api/public/vaults/:slug/enter` → guest token. |
| Referrals / promoters | **NOT BUILT** | No attribution model; campaign analytics count shares/views, not referrer→conversion. |
| Channel attribution (which channel produced a registration) | **NOT BUILT** | Signals record channel only where a connector supplies one. |

### People / relationships
| Feature | State | Notes |
|---|---|---|
| Identity aliases (Telegram X + WhatsApp Y + web Z = same person) | **NOT BUILT** | Handoff + entry tokens bind a *session* to a participant; no cross-channel person merge. |
| Relationship history ("Brian timeline") | **PARTIAL** | Footsteps + signals + member evidence exist; no unified person-centric projection across campaigns/orders/years. |

### Connectors
| Feature | State | Notes |
|---|---|---|
| Telegram ingest | **REAL** (webhook + pull) | Token-gated; live-tested. |
| WhatsApp ingest | **REAL** (inbound DM only) | Signature-verified; group ingestion correctly refused. |
| Web/RSS/manual | **REAL** | SSRF-guarded. |
| Outbound messaging (send/SMS/email) | **NOT BUILT** | No send connector exists; nothing is faked. |

---

## Gap map → highest-impact missing primitives (dependency order)

1. ✅ **Ticket codes + gate check-in** — *built this pass* (was the top Tier-1
   gap; composes with campaigns + payments + Vault).
2. ⬜ **Gate operator UI** — a fast mobile check-in surface over the new
   `/api/tickets/:code` endpoints (scan → name → paid → check in, one tap).
3. ⬜ **QR rendering** — draw the ticket code as a QR for print/share; the code
   is already the scannable value.
4. ⬜ **Referral / attribution primitive** — link-share → registration →
   paid → attended, attributed without fake commissions.
5. ⬜ **Person relationship timeline** — a per-person projection across
   registrations, orders, footsteps, check-ins (only data Brief actually holds).
6. ⬜ **Omnichannel identity aliases** — explicit, verified cross-channel
   linking (not weak inference).

## Known DANGEROUS paths (already defended)
- Client-supplied amount → rejected at `createIntent` (reads order row).
- Callback amount → rejected at `confirmPayment` (mismatch fails).
- Duplicate callback → replay-safe (provider ref unique + receipt unique).
- Settlement without settled ledger → refused in `transitionOrder`.
- Double check-in → idempotent `already_checked_in`.
- Anonymous roster read → public projection leaks nothing.

## Nothing is SIMULATED
Every surfaced feature either performs a real state transition against the
store/ledger, or reports `not_configured` / `provider_unavailable` honestly.
The Tuma rail runs against an explicit test adapter (no live credentials; no
sandbox exists) — never a faked success.
