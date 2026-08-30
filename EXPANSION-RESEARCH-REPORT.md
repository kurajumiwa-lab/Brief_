# Expansion Research Report

Date: 2026-08-30. Nine streams researched against live sources; each section
ends with **how it lands in Brief** — the repository already carries most of
the primitives (objects, campaigns, orders, ledger, auction domain, media
upload, connectors, Mshikano), so most of this is extension, not new apps.

Status vocabulary stays strict: 🟢 buildable now · 🟡 buildable with a
partner/condition · 🟠 blocked by an honest external constraint.

---

## 1. Open market data for trading in Africa · obtaining NSE information

("nai.sec.ex" read as the **Nairobi Securities Exchange**.)

**How it is done.** African exchange data lives in four layers:

1. **The exchange itself.** The NSE sells live, delayed (≥15 min, Level 1 and
   Level 2), end-of-day and historical data — direct connection to their
   Nairobi data centre or through authorised vendors; subscription starts
   with an evaluation form to dataservices@nse.co.ke. Historical data is
   bought via a request form, with **discounted academic rates** (Market Data
   Policy §17.0). (nse.co.ke/dataservices)
2. **Global consolidators.** ICE carries NSE Level 1 streaming and up to 15
   years of tick history in Consolidated Feed/History products.
   (developer.ice.com)
3. **Pan-African developer APIs.** Afristox (JSE, NSE Kenya, EGX, ZSE/VFEX —
   free tier, REST/JSON); Mansa Markets (21 exchanges, 33 countries, quotes
   updated every 30 minutes, free weekly digest); the open-source African
   Markets API covers GSE + NGX with NSE Kenya planned. 
4. **Free/official statistics.** NSE publishes end-of-day reports and monthly
   statistics publicly — enough for a weekly "market desk" surface.

**How it lands in Brief (🟢).** A *Market desk* under Nearby: EOD quotes and
monthly stats from the NSE's public pages via a new connector (the connector
pattern already handles dead sources honestly), upgraded later to Afristox or
Mansa for breadth. Rules of the house apply: cite the source and timestamp on
every figure; never present a delayed quote as live.

---

## 2. Logistics loops: Europe's playbooks → Africa's caravans

**What Europe actually does.** The winning loop is not the load board — it is
**matching + visibility + backhaul** working together:

- Freight exchanges at scale: TIMOCOM ~156,000 members; Trans.eu ~250,000
  loads/vehicle offers posted daily; Teleroute ~350,000 daily offers across
  29 countries. (trucksonthemap.com comparisons)
- Multi-factor matching scores freight against capacity on **location,
  lane history, capacity, carrier performance**; deadhead distance is the
  single largest driver of willingness and rate.
- **Backhaul and triangulation matching** converts empty return legs into
  revenue — digital exchanges cut empty running by an estimated **10–30%**,
  with eCMR (digital consignment notes) closing the paperwork loop.
  (gettransport.com; trucksonthemap.com)
- Two honest models: *open exchange* (max liquidity, fraud screened by
  verification) vs *invite-only verified network* (smaller, lower fraud).

**The African reality.** East African cross-border trade is largely
**informal**: FEWS NET/EAGC monitor 88 commodities across borders precisely
because these flows "are not typically recorded in government statistics or
inspected and taxed through official channels" (fews.net cross-border
bulletins). Research on the Ethio-Somaliland corridor shows trade moving on
**social networks and informal norms** — traders collectively renting
mid-sized trucks, distributing to many receiving stores instead of one
warehouse to spread risk, relaying goods by three-wheeler (Bajaj) and boda
into towns. (DIIS Working Paper 2019/7)

**How it lands in Brief (🟢).** The unit already exists in this codebase:
a caravan is a **recurring object with provenance** — route, departure
window, capacity, corridor — plus Mshikano relationships for trust. Concretely:

1. **Caravan register** (corridor schedules as objects, honest empty states).
2. **Whole-load listing before departure** → feeds the auction point (§4):
   a truck leaving Wote for Gikomba Monday sells its remaining capacity to
   the highest/first confirmed buyer instead of travelling on hope.
3. **Backhaul posts**: the Europe lesson — the return leg is where the money
   is; every caravan arrival auto-opens a "returning empty" need post.
4. **Relay legs** (boda/bajaj last-mile) as errands (§3).
No telematics claims: visibility is *reported* by the caravan operator at
waypoints, and the row says who reported it and when.

---

## 3. Home essentials: weekly groceries, monthly promotions, wholesale↔riders

**How it lands in Brief (🟢).** Errands as a **primary service** on the
existing order + ledger spine, with the cut taken mathematically:

- **Standing weekly cycle**: a household's basket is a recurring order
  template; each week it becomes one real order against wholesale-shop
  listings (vendors/listings already exist).
- **Monthly promotions**: a promotion is a campaign row (the campaign domain
  already has publication lifecycle) — *featured*, never "discounted" unless
  the price row actually changed; honest pricing is a house rule.
- **Rider errands**: a rider claims a delivery/errand job; the **cut** is a
  derived ledger concept — `order total × r%` platform + `d%` rider, recorded
  as ledger transactions at settlement, never stored as a summary column
  ("one economic layer" rule). Riders settle to their Pochi number (§8).
- Sequencing matters: aggregate orders first (one truck, many baskets),
  dispatch second (fewer, fuller trips — the Europe consolidation lesson in
  miniature).

---

## 4. Auction point (references that earned trust)

**What succeeded elsewhere.**

- **Copart** (vehicles): 1.1M+ vehicles/year, 200+ yards; proxy bidding,
  live VB3 engine, condition reports + photos before you bid; 60%+ of
  auctions now transact on mobile. Lesson: **inspection data before the
  bid, timer integrity, and mobile-first bidding**. (accellor.com case study)
- **uShip / freight reverse auctions**: buyers post, carriers bid down;
  reputation from completed hauls. Lesson: **reverse auctions fit transport**.
- **Royal FloraHolland-style Dutch clock**: price falls until someone stops
  it — built for **perishables**, which is exactly a mango truck.
- **Nile.ag** (South Africa): "Africa's largest online marketplace for fresh
  produce" — cross-dock hubs consolidate mixed loads, 38 countries reached;
  also offers farmer input finance against offtake relationships. Lesson:
  **consolidation hubs + logistics as part of the marketplace**. (nile.ag)
- **Afrwood Wakulima Market** (East Africa, early): online agri auction with
  accredited-warehouse listing and final-value fees; breakeven modelled at
  400 tons/week. Lesson (cautionary): **liquidity is everything; an auction
  with no bidders is a billboard**. (vc4a.com)

**How it lands in Brief (🟢).** The repository already has an auction domain
(bids, server-authoritative amounts, winner-pays flows). Extend it with two
formats on the same engine: **English ascending** for capacity on scheduled
caravans (§2) and **Dutch declining** for perishable whole loads, plus a
**reserve price** and "buy now" fallback. Auctions close before departure
time, not after — a truck is not a warehouse. Payments settle through Pochi
(§8) and the cut is a ledger derivation (§3).

---

## 5. WhatsApp: link formats, styling, and the web-store question

**Formats (facts).** WhatsApp styling is character-based and works on every
platform: `*bold*`, `_italic_`, `~strikethrough~`, ` ```monospace``` `,
inline code, block quotes (`>`), and bulleted/numbered lists. **Underline
does not exist natively** — it is faked with Unicode combining characters and
renders inconsistently. "Themes"/fancy fonts are Unicode transforms, not real
fonts. (sendpulse.com; cashify.in; whatsformat.com)

**Click-to-chat links.** `https://wa.me/<number>?text=<urlencoded pre-filled
message>` opens a chat with the text ready to send — the lightest possible
"order button" in Kenya. (whatsformat.com)

**Can we create a WhatsApp web store?** Three honest tiers:

1. **Catalog in the free WhatsApp Business app** — up to 500 items, up to 10
   images or a video each, price/description/link per item; reviewed in
   minutes to 24h. Manual, per-phone, no API. (wati.io)
2. **Cloud API (programmatic)** — free API access; **per-delivered-template-
   message pricing since July 2025**; service conversations (customer
   messages first) free/heavily discounted, ~1,000 free/month. Requirements:
   verified Meta Business Manager (2–10 business days; unverified accounts
   capped at 250 conversations/24h), a dedicated phone number not active in
   the app, 2FA. (chatarmin.com; sendblue.io; gurusup.com; bonvoice.com)
3. **Own web store that SHARES to WhatsApp** — product pages on Brief with
   wa.me deep links carrying pre-formatted order text. No Meta approval, no
   per-message fees, full control of catalogue and theme.

**How it lands in Brief (🟢, choosing tier 3 first).** A **store builder**:
a vendor picks listings, Brief renders a themed public store page (the
extracted lavender palette), and every product gets a *Share to WhatsApp*
button emitting a styled message (`*2 Crates tomatoes* — KES 5,000 …` +
wa.me link to the vendor's number). Payment: the store shows the vendor's
**Pochi number** (§8). Upgrade to Cloud API catalogues only when a vendor's
volume justifies per-message costs — and note the standing constraint already
documented in `server/CONNECTORS.md`: WhatsApp **group ingestion is
genuinely impossible**; everything inbound must arrive by explicit share.

---

## 6. TikTok/WhatsApp ingestion → customer pipeline + growth-chart indicator

**The honest external constraint (🟠/🟡).** There is **no commercial API for
TikTok comments**: the official Research API serves non-profit academics only
(US/EU, proposal + ~4 weeks); the Content Posting API exposes only the
brand's own content metrics; scraping violates TikTok's ToS even where
public-data scraping is argued legal (hiQ precedent). (lobstr.io; apify.com)

**What is buildable (🟢).** Flip the direction: the creator is the ingestion
point.

- **WhatsApp text ingestion** (already half-built): a creator forwards a
  customer's WhatsApp text to Brief via the existing `brief-it/save` route;
  the pipeline already extracts price/time/place into objects.
- **"Comment → customer" card**: the creator pastes/translates a TikTok
  comment thread once; Brief parses intent (price ask, "DM me", location)
  into a lead object, replies with a generated WhatsApp response + store
  link (§5), and tracks the lead to *bought* and *registered* — a small
  honest CRM, with the creator doing the one tap TikTok forbids automating.
- Link-in-bio → store → Pochi payment completes the loop.

**The growth-chart indicator (🟢, with an honest cohort rule).** WHO growth
charts use the **LMS method**: L (Box-Cox skew), M (median), S (spread) at
each age; `z = [(X/M)^L − 1]/(L·S)`, converted to a percentile. (RCPCH;
healthcalculator.app; growthpercentile.com). Applied honestly:

- The **"age"** is months since the business's first confirmed sale on
  Brief; the **measurement** is a composite of ledger-derived facts (orders,
  repeat buyers, confirmed cooperations — never stars).
- The **reference population is Brief's own businesses** at the same age,
  computed from real rows — never a fabricated benchmark.
- Output is a percentile band with words ("growing faster than 7 in 10
  businesses the same age on Brief"), an empty state when the cohort is too
  small to be meaningful, and the same chart drawing code as a child's chart
  (curves at z = −2, −1, 0, +1, +2).

---

## 7. Vendor lending where we hold the lightest side of the balance sheet

**The proven model.** Embedded lending: the **platform supplies data, the
partner holds the credit**. Parafin underwrites marketplace sellers off
platform sales data (DoorDash, Amazon); Kanmon/Defacto/Finmid do it for
SaaS/B2B platforms (Wolt among them); the provider or its bank partners fund
and service; the platform earns an **origination fee + revenue share without
the credit risk**. What actually works at scale is *lending underwritten off
proprietary transaction data* — Shopify Capital originated $4.2B in 2025 on
exactly that thesis. (openbankingtracker.com; apideck.com; valueaddvc.com;
billed.app)

**African precedent.** Nile.ag offers farmers payment terms and finance
**against offtake relationships** — the buyer's commitment is the collateral
logic. (nile.ag)

**How it lands in Brief (🟡 — needs a licensed partner).** Brief's ledger
already records what a lender wishes it knew: settled sales velocity, repeat
buyers, confirmed cooperations (Mshikano), dispute history. The light-sheet
design:

1. Brief **originates**: surfaces "working capital" to a vendor whose
   derived record qualifies, and hands the underwriting packet (aggregated,
   consented) to a licensed lender/NBFI.
2. The **partner funds, collects, and carries the risk**; Brief takes an
   origination fee and a servicing revenue share — fee income, not credit.
3. **Compounding**: fees are reinvested into the platform, not lent out;
   Brief never holds depositor or borrower money (consistent with the
   existing "no payment provider configured" honesty — we do not pretend to
   be a bank while the partner is absent).
4. When the time comes, Kenyan PSP/banking partners from earlier research
   (Paystack for collections; Smile ID / Didit for KYC) complete the stack.

---

## 8. Pay for Brief's services with Pochi la Biashara (not an integration)

**Facts.** Pochi la Biashara is Safaricom's free business wallet for informal
traders: activated in minutes on an existing line (*334# or the M-Pesa app),
no paperwork, no till number — customers pay the **phone number** via the
Pochi/send-money path and the money lands in a balance **separate from
personal M-Pesa**. Customer pays standard send-money tariff (free ≤ KES 100,
capped ~KES 108–110 above 20k); receiving is free; withdrawals at standard
rates; limits KES 250,000 per transaction / KES 500,000 per day. Crucially:
**Pochi is not built for developer integration** — no API; automation
requires a till or paybill with Daraja. (veirahq.com; helloduty.com;
paybillke.com; tech-ish.com)

**BUILT 2026-08-30 (manual-first, 🟢).** Server: `domain/fees.js` + `/api/fees/*` — one server-side price catalog, member submits the M-PESA code, finance confirms, ledger carries money truth, one code is one payment ever, revenue derived. Client: Services tab under Workflows → Records. Proven in the server suite (+19), preview suite (fees.jsx, 7), and live phase 9 (16/0, idempotent). Automation (🟡) remains: a paybill + Daraja webhook would remove the operator step.

**How it lands in Brief (🟢 as manual-first, 🟡 automated).** Exactly what
the user chose: no WhatsApp payment integration. The service-payment flow:
Brief shows its Pochi number and amount → the member pays in their M-Pesa
app → enters the **M-Pesa confirmation code** into Brief → the fee is
recorded as a pending ledger transaction, confirmed by an operator (or later
by a paybill webhook if Brief ever upgrades to a till). The honest middle
state: services render on "code received, pending confirmation", never on
trust alone, and the UI says which state it is in.

---

## 9. Photo editing for event promoters and creators (🟢)

The media domain already uploads real files, checks magic bytes, bans SVG,
caps size, and serves with a strict CSP. The gap is only client-side: add a
**crop / rotate / caption / light-filter step** in the browser (canvas-based,
no external service) before the existing `POST /api/media/upload`. The server
stays the authority on what a file is; nothing about the upload contract
changes. Promoters get it on campaigns and events; creators on tea articles
and store pages (§5).

---

## Recommended build order

| # | Stream | Why first |
|---|---|---|
| 1 | Pochi payment flow (§8) | ✅ BUILT — live phase 9, 16/0 |
| 2 | WhatsApp store builder + styled share links (§5) | Cheapest distributor; no Meta approval needed |
| 3 | Photo editing (§9) | Small, self-contained, powers stores and campaigns |
| 4 | Caravan register + whole-load auctions (§2+§4) | Uses existing auction domain; Mshikano trust already built |
| 5 | Errands + weekly groceries + promotions (§3) | Needs ledger cut mechanics from #1 |
| 6 | Ingestion pipeline + growth chart (§6) | Needs real transaction cohorts from #2–#5 to be honest |
| 7 | Market desk / NSE data (§1) | Independent; connector pattern exists |
| 8 | Vendor lending (§7) | Last: requires a licensed partner and 6+ months of ledger history |

**Honest constraints to carry forward:** no commercial TikTok comment API
(creator-in-the-loop instead); Pochi has no API (manual-first); WhatsApp
group ingestion impossible (explicit share only); an auction without bidders
is a billboard (start where caravans already have buyers waiting); the
growth chart must say "on Brief" and stay empty until the cohort is real.
