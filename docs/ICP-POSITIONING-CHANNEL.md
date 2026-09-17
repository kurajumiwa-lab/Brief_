# Brief — ICP, positioning and channel

Written 2026-09-18 against the deployed app (`main` @ the commit that added
`coopOperations`). This is a strategy document, but every claim about what Brief
*does* is a claim about shipped code; where the framework's advice cannot be
honoured honestly, that is written down rather than smoothed over.

---

## 1. The frame: loss, not features

Agreed with the framework, with one boundary. Nobody wakes up wanting a business
management platform; people act to stop losing. So the surface leads with what is
at stake. The boundary: **a loss figure may only be stated when a row records
it.** `features/home/StakesLine.tsx` implements exactly that ladder:

| State of the rows | What Home says |
|---|---|
| A quote of theirs was declined because the buyer chose someone else (a real `quote_declined` event) | "2 quotes of yours ended with the buyer choosing someone else — your own offers on those totalled KES 9,600 over the 30 days" |
| Those declined offers had no completed price | the same sentence, **and no amount** — "those offers carried no completed price, so no money figure is attached" |
| Open demand exists, they have no live offer | "5 requests are open on the board and you have no live offer, so none of them can reach you" |
| They have offers, nothing is asking | "…nothing on the board is asking for them right now. That is a quiet week, not a warning." |
| The read failed | "Your position could not be read, so nothing here is claimed." |

**Rejected from the recommended copy, with the reason:**

- *"You're invisible to 90% of buyers who search digitally."* No browse log of a
  stranger failing to find a listing exists. Absence of a click is not a row.
- *"You're paying for staff hours you can't verify."* Brief verifies no
  attendance or hours. Saying it would be a claim about people nobody observed.
- *"Every day without a link costs you X."* No attribution model exists, so no
  day can be costed.
- *"Your competitors are getting your customers."* Brief can say a *specific*
  quote lost to another supplier, because that row exists; it cannot say who is
  winning generally.

The rule to hold: the reframe changes **which real number is put first**, never
whether a number is real.

---

## 2. ICP — who has money on the line

The framework's principle (buyers with budget and a cost of inaction) is right.
Its default segment (US-style mid-market) does not exist here in that shape, so:

**Primary — cooperatives, table-banking groups and SACCO chapters, 100+ members.**
- They already hold money and obligations collectively: contributions, payouts,
  loans, guarantees, a welfare pot. That is a ledger, and Brief keeps it with
  maker/checker payouts, receipt hashes and minutes.
- Their cost of inaction is member churn and a transparency argument, not
  "no website".
- One sale puts 100 businesses inside the product — distribution, not outreach.
- What they buy, as a shipped surface: **the operator read**
  (`GET /api/table-banking/:id/operations`) — the pool exactly as the treasurer's
  screen computes it, the group's *own* collective Requests with quote/accept
  status, the money that actually settled through Brief in a stated window, and
  each member's *public* shopfront facts for the owner only.

**Secondary — wholesale aggregators and mid-size retailers (produce, fodder,
building materials, pharma distribution).**
- They live on spreads, so the flow board (declared origins and destinations,
  counted open asks, `untagged` honesty) is direct P&L, not a nice-to-have.
- They have POS/accounting budgets already, so the ask is displacement.

**Tertiary — diaspora-funded businesses.**
- The owner is remote; the product is a shopfront plus a maintenance state that
  cannot be faked (FRESH / STALE derive from real edit and reply timestamps) and
  a settled-through-Brief figure that only moves when money settles.

**Explicitly not the buyer: individual hawkers, one-person side businesses.** They
are *users* — the supply that makes the board worth looking at — and monetising
them directly is the wrong lever. Keep the free layer honest; bill the layer above.

---

## 3. Channel — the group is the channel

Partner-led distribution, not paid acquisition. Named bodies, verified today
(2026-09-18) rather than recalled:

| Channel | Fact checked | How to use it |
|---|---|---|
| **SASRA's gazetted register** | 176 deposit-taking SACCOs authorised for 2026; five placed on credit-only; two exited the perimeter | A *named, bounded* prospect list with real compliance pressure. Do not sell "software"; sell the member-facing transparency the regulator already asks for. |
| **KUSCCO** (Kenya Union of Savings & Credit Co-operatives, est. 1973, KUSCCO Centre, Upper Hill, Nairobi) | 2025 reporting alleges Sh12.5bn misappropriation; ~247 member SACCOs exposed, liabilities Sh17.7bn against Sh5.2bn assets | Approach **last**, and never as a credibility badge. An honesty-positioned product does not borrow a headline under investigation. |
| **Kenya National Federation of Co-operatives (KNFC, 1964, per sector reporting — confirm before quoting)** and the State Department of Co-operatives / Commissioner for Co-operative Development | umbrella bodies for non-SACCO societies; the Commissioner still supervises non-deposit-taking societies | The route to dairy, coffee, horticulture and marketing co-operatives — exactly the sectors where the flow board has real meaning. |
| **Sacco Central / shared-services bodies** | sector body formed to give SACCOs shared technology and payment access | A shared-services buyer is the natural host for a member-facing tool; pitch the operator read as the module they are missing. |
| **County co-operative officers and trade fairs** | regulation-adjacent trust | One county endorsement is worth more than any ad; ask for a demo slot at the county farmers' day. |
| **The WhatsApp group that already exists** | every market, every chama, every chapter has one | Give the group admin the thing the group argues about — a transparent pool — not a referral code. |

**Do not spend on:** Meta ads (the buyer is not scrolling for software), Google
ads (thin search volume for SME tools here), LinkedIn outbound, generic content
marketing. This is a decision, not a deferral: until a self-serve signup converts
without a human, paid traffic buys nothing.

**Not a channel, and worth saying:** a *benchmark* would be the classic B2B sales
weapon ("groups like yours settle X"). Brief has no cross-group benchmark table,
and `operationsFor` returns `benchmark: null` on purpose so nobody builds a pitch
on an invented average.

---

## 4. Expansion — the three motions, and the one that cannot be priced yet

1. **Solo → multi-space.** A second shop, line or branch. The product already
   treats each space as its own instrument (its own file, queue, money bar).
2. **Space → cooperative.** This is the 10× motion: the member's space becomes
   the *evidence* the group's dashboard needs. Nothing new to build — the
   operator read is the reason the group pays.
3. **Seller → buyer → both.** A vendor who sells on Niche and buys on Bulk. The
   gap engine already treats them as demand; the repeat-procurement memory is
   already written per completed work order.

**Pricing — an explicit refusal.** The recommended ladder (KES 500 → KES 2,500 →
3–5% of *recovered revenue*) cannot be adopted as stated. The last one is not a
price, it is a measurement claim: Brief has no attribution row linking an order
to a group introduction, so "recovered revenue" is uncomputable, and charging a
percentage of a number you cannot compute is how a trust product becomes a
dispute. Sequence instead: **flat per-group fee for the operator read** (a thing
that demonstrably exists), **per-space fee** when multi-space lands, and revisit
any outcome-linked pricing only when `attributed_share` stops being in the
`unavailable` list of `coopOperations.js` — that list is the honest gate.

---

## 5. What this week's product work had to be, to make the above true

- `server/src/domain/coopOperations.js` + `GET /api/table-banking/:id/operations`
  (pool taken from `summary()` rather than re-added; settled money read from
  `workSettlements`; mixed currencies reported as `null`, not converted at a
  made-up rate; members' private spaces never appear; no key on the payload
  grades a person).
- `features/home/StakesLine.tsx` — the loss frame with a row behind every number.
- Zero states that name their own cause (`zeroReason`, `FLOW_REQUIRES`,
  `scope: 'national'`), so "0" stops being ambiguous.
- Disclaimers folded to one clause (`ui/DerivationNote.tsx`) so the honesty layer
  stops being the product.

Each is covered by tests: `server/test/tableBankingOps.mjs` (7) and the
`StakesLine` block in `preview/homezones.jsx`.
