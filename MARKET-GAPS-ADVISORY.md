# Market gaps → Brief: what to integrate, what to harness, what to decline

*Studied against the running code, 2026-08-30. Every "already have" claim below was verified in the repository before writing.*

---

## The position in one paragraph

Brief should not become a logistics company, a lender, or a power utility. But of the five gaps in the analysis, **three are already half-built inside Brief's seams**, one is a single provider contract away, and one should be declined in writing. The through-line: Brief's existing rails — WhatsApp as the storefront, server-derived money, two-sided confirmation as truth, the signals engine, and the Mshikano trust layer — are exactly the "software as force multiplier" the analysis describes. We integrate by **pointing existing seams at these markets**, not by building new products.

---

## Scorecard

| Gap | Fit | Already in Brief | Missing piece | Verdict |
|---|---|---|---|---|
| 3. SME / duka digitization | ★★★ | WhatsApp Shop, vendors/listings/orders, stock, Group Buy, fees | The *book* (derived view) | **Build next — days, not months** |
| 2. Agri supply chain | ★★☆ | WhatsApp Shop, campaigns, SMS seam, HudumaLink sessions | A provider (SMS/USSD aggregator) | **Harness — one contract** |
| 4. B2B settlement | ★★☆ | Escrow *records* (HudumaLink, Group Buy, tickets), ledger | A license we will not hold | **Take the records layer only** |
| 1. Cross-border logistics | ★☆☆ | Challenge pattern, Mshikano trust, regions KE–TZ–UG–RW | Liquidity + Swahili | **Later, after density** |
| 5. Off-grid PAYG | ✗ | Nothing compounds | Hardware + field ops | **Decline, in writing** |

---

## 1. SME digitization — our lane, mostly built (Gap 3)

The duka is not a future user; it is the current one. The WhatsApp shop builder ships today, `quantityAvailable` already tracks stock optionally, orders run vendor→listing→fulfil→dispute, and Group Buy is a chama-grade pooled-order pipeline with an escrow stepper.

**Harness today, zero build:** a duka's price list in WhatsApp; pooled orders through Group Buy; restock demand visible in order signals.

**Build next (the smallest honest builds):**

1. **The Duka Book** — the paper-ledger replacement is a *derived view*, not a feature. `GET /api/shop/mine/book` scanning confirmed orders: yesterday/this week sales, top items, items at zero stock. One endpoint + one card in the shop builder ("Yesterday: 14 sales · KES 3,250 · 2 items low"). Days of work, pure derivation — the house style.
2. **Shop → Group Buy bridge** — "pool this item" on a shop line: N shops ordering the same item become one Group Buy with a target and a bulk price. This is the analysis's "wholesale marketplace aggregation", and the engine already exists.
3. **Credit history, honestly** — the Book *is* the credit file. Do **not** model credit on inventory alone: without repayment truth a score is decoration, and Brief's rule is never to fake a capability. The compliant route is the partner pattern already researched (Parafin/Kanmon/Defacto): Brief supplies the data and takes an origin fee; a licensed bank holds the credit. File under "when there is volume", not "now".

## 2. Agricultural supply chains — same rails, one contract (Gap 2)

- **Feature-phone access (USSD/SMS):** the outbound seam already speaks `sms` and fails closed — the provider slot is empty, waiting. One aggregator contract (e.g. Africa's Talking: SMS + USSD + payouts) unlocks it. The architecture is even ready: HudumaLink's per-phone state machine (MENU_ROOT → … → order) is exactly the shape a USSD session needs; the session concept ports, the menus re-skin to harvest listings.
- **Farmer → urban retailer:** a harvest listing is a listing with a perishability window; campaigns + WhatsApp distribution + Nearby already carry producer→buyer with no middleman. No new surface.
- **Dynamic pricing — decline the algorithmic version.** On thin, local, honest data, an AI price engine is confident nonsense. The honest alternative is what the codebase already does: Group Buy target prices, and "price today" broadcasts derived from *actual confirmed transactions* only.
- **IoT cold-chain: decline.** Sensors, trucks, capex, field maintenance. Nothing in Brief compounds there.

## 3. B2B settlement — the records layer is ours, the money is not (Gap 4)

Brief moves no money by design (no provider configured; the compliance gate owns the door; `startup_note` says so on boot). Multi-currency wallets and SWIFT bridging are a licensed PSP business — out.

What *is* ours, and already patterned three times in the code:

- HudumaLink orders: `PENDING → PAID → RUNNING → COMPLETED` with escrow `NONE → LOCKED → RELEASED`
- Group Buy: "Merchant Escrow Locked" stage
- Ticket market: `confirm-received`

**The product to extract: escrow-as-records.** Two-sided confirmation = release. Wire "order delivered + buyer confirms" to the escrow release record, and the "funds held until delivery verified by logistics software" from the analysis becomes — us, at the record layer, with disputes instead of smart contracts. Cross-currency: record the counterparty amount as *fact metadata* next to the KES ledger row; conversion is a bureau license we do not hold.

## 4. Cross-border logistics — the right moat, the wrong time (Gap 1)

The analysis asks for freight forwarding and customs automation; the real East African gap (per the earlier research) is *informal* cross-border trade running on social networks and norms. That is Mshikano's exact shape: relationships as units, two-sided confirmation, trust evidence. A lane board (Nairobi→Kigali) is structurally the Arena challenge pattern (open → accept → confirm → record) — proven code.

**But:** a board with no trucks is a dead board. Liquidity before surface. Sequence it after the SME layer creates density, not before. Multilingual: for KE/TZ/UG/RW the real languages are Swahili + English (+ French for Rwanda). There is no i18n today — add the string table *when a second-language market is actually entered*, not speculatively.

## 5. Off-grid PAYG — declined (Gap 5)

Remote lock-off is hardware-dependent and cuts power to real households; predictive maintenance needs battery telemetry we will never have. A software-only team with no field presence should not own that risk surface. No branch of Brief's codebase compounds into it. **No.**

---

## Cross-cutting: offline is the one infra investment worth making now

There is no service worker today (verified). For dukas with weak signal and any transit use case, a PWA shell — cached app + last data + **queued writes with idempotency keys replayed on reconnect** — is the highest-leverage gap. The idempotency pattern already exists twice (arena grant events, referral events); writes just need to carry keys. This unlocks gaps 1–3 simultaneously.

---

## Recommended order

| # | Move | Effort | Why now |
|---|---|---|---|
| ① | **Duka Book** (derived bookkeeping view) | days | Turns the shop builder into the ledger-book replacement; pure derivation |
| ② | **Shop ↔ Group Buy pooling bridge** | days | "Wholesale aggregation" — engine exists, needs the door |
| ③ | **PWA offline shell + queued writes** | ~a week | One investment, three markets |
| ④ | **SMS/USSD provider on the existing seam** | contract + port | Feature-phone ordering; HudumaLink sessions re-skin |
| ⑤ | **Escrow-as-records generalized from the 3 existing patterns** | contained | The B2B play we can own without a license |
| ⑥ | Lane board (challenge pattern) · Swahili strings | conditional | Only after density / market entry |
| ✗ | IoT cold chain · multi-currency settlement · PAYG lock-off · AI pricing on thin data | — | Declined for the stated reasons |

**User group:** the shop owner Brief already serves — they already have shops, orders, fees and pooled buying. **Platform:** the existing web app + WhatsApp + SMS/USSD via one aggregator. No new app, no new navigation, no new visual language — the same rule as the Arena work: consume what exists, never replace it.
