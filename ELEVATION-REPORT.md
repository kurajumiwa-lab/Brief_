# Product Elevation — implementation report

Graduation mode: audit against the user journey, then make the smallest set of
changes that makes Brief feel substantially more mature — not more feature-dense.

---

## What I discovered (reconnaissance, before building)

- **Public page already existed** (`PublicCampaignPage`, `/c/:slug` via SPA
  fallback), but it was a plain CRUD-looking form: no share actions, no social
  proof, no ticket after registering, and — critically — **no Open Graph
  metadata**, so a link shared on WhatsApp/Telegram/X showed a blank shell
  (crawlers don't run the SPA's JavaScript).
- **Campaign analytics already computed** views, registrations, check-ins,
  settled/pending revenue, shares, and conversion — but only per-campaign, with
  no host-facing aggregate view.
- **The Vault already exposed** a resolution centre and scoped views — the
  command centre could be *composed* from existing primitives rather than built
  from scratch.

So the work was: (1) make the public page the shop window it should be, (2)
gather the host's already-derived numbers into one NOW/MONEY/PEOPLE/DISTRIBUTION
/ACTION/NEXT surface. Nothing new was stored; nothing was invented.

---

## What was implemented

### 1. Premium public surface + shareability (priority 1)

**Server**
- `publicView` now carries an aggregate **`registered`** count — social proof
  ("42 people registered"), never a roster, never *who*.
- **`/c/:slug` renders a real HTML shell with `og:*` / `twitter:*` meta** injected
  from the campaign's public projection. HTML-escaped (a user-authored title
  cannot break out of a tag). No image is fabricated when none exists; the same
  SPA bundle still loads for real browsers. A missing campaign falls back to the
  honest SPA "not available" state.

**Frontend** (`PublicCampaignPage`)
- Social proof line (`registered` count).
- Share row: **WhatsApp / Telegram / copy-link**, built from the URL the viewer
  is actually on (no fabricated origin).
- After registering, the attendee now receives **their own ticket with a QR** —
  the code they show at the gate.

*Verified by `scripts/verify-og.mjs` (self-contained, 9/9) and the camp suite.*

### 2. Host Command Centre (priority 2)

**Server** — `domain/command.js` + `GET /api/host/command`
- **NOW** — unpaid held spots, upcoming gatherings
- **MONEY** — gross settled vs pending, derived from ledger rows
- **PEOPLE** — registered / checked-in / cancelled
- **DISTRIBUTION** — views + shares (recorded signals, never a counter)
- **ACTION** — the Vault resolution centre, scoped to the host
- **NEXT** — upcoming gatherings
- Scoped strictly to the caller's own campaigns and vaults — a host never sees
  another host's figures.

**Frontend** — a **Command** section (now the Workflows landing surface), plain
and information-dense. It renders the server's numbers and computes nothing.

---

## What was intentionally deferred (and why)

| Item | Reason |
|---|---|
| **Person timeline** (priority 3) | Needs a person-identity model first; footsteps/signals/registrations are per-person-attributable and ready to aggregate, but a "person" is not yet a first-class entity (guests enter with a token, not an account). |
| **Channel attribution** (priority 4) | `recordShare` already stores `channel`; the missing link is tagging a *registration* with the channel it arrived through. Small, but it should land after the person model so attribution attaches to a person, not a session. |
| **Referrals** (priority 5) | Explicitly "only after attribution" per your ordering. The attribution seam is now the single prerequisite. |
| **AI** | Buried, per instruction. The substrate (footsteps + search + identity + orders + payments + relationships) is ready; nothing is shipped as a superficial "AI" feature. |
| **Outbound messaging / live Tuma** | Still no connector / no credentials. Nothing faked. |

---

## Verification

| Check | Result |
|---|---|
| Server suite (full, incl. live 3rd-party) | **1347 passed / 0 failed / 1 skipped** |
| Client suites (23) | **1105 passed / 0 failed** |
| Strict typecheck | **exit 0** |
| Production build | **succeeds** |
| OG self-check | **9/9** |

## Files changed

- `server/src/domain/campaign.js` — `registered` in publicView
- `server/src/index.js` — OG route for `/c/:slug`, `/api/host/command`
- `server/src/domain/command.js` (new) — command centre
- `App.tsx`, `src/components/HostCommand.tsx` (new) — command surface
- `src/api/{types,validate,briefApi}.ts` — CommandCentre + registered + ticketCode
- `preview/camp.jsx` — fixture + `registered`
- `scripts/verify-og.mjs` (new)

## Honest status

Capability is now *felt through the workflow* rather than announced: a stranger
opens a link and sees a real gathering (with a preview when it travels through
WhatsApp), registers, gets a scannable ticket; the host opens Brief and sees
what needs them, what's been collected, who arrived, and where people came from
— all from real rows. Person timeline, attribution, and referrals remain the
ordered next steps, each now a single well-scoped build on top of what exists.
