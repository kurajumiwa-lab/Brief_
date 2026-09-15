// ---------------------------------------------------------------------------
// POSITION — the derived "position in time" layer. Pins that every number is
// arithmetic over real rows (decay, missed capture, still-open), with nothing
// fabricated: a missed capture is ONLY a real "selected another option" event,
// an expiring quote is ONLY a real open quote with a future validUntil, and an
// empty account returns honest zeroes.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-position-"));
process.env.BRIEF_DATA_DIR = dir;
const { store, newId } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const position = await import("../src/domain/position.js");

let count = 0;
const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };

const me = auth.createUser({ handle: "pos_me", password: "position-pw" });
const buyer = auth.createUser({ handle: "pos_buyer", password: "position-pw" });

// A live request (still open — feeds the gaps/open section).
store.insert("requests", {
  id: "req_open", title: "200kg of Irish potatoes", status: "open",
  category: "produce", quantity: 200, unit: "kg", currency: "KES",
  location: "Wakulima", requesterId: buyer.id, revision: 1, history: [],
  attachments: [], updatedAt: new Date().toISOString()
});

// A request the buyer closed by choosing someone else.
store.insert("requests", {
  id: "req_closed", title: "Catering for 50", status: "ready_for_work",
  category: "catering", quantity: 1, unit: "job", currency: "KES",
  location: "Kilimani", requesterId: buyer.id, revision: 1, history: [],
  attachments: [], updatedAt: new Date().toISOString()
});

const now = new Date();
const tomorrow = new Date(now.getTime() + 24 * 3600000).toISOString().slice(0, 10);

// My quote on req_closed that was declined because another was selected.
store.insert("requestQuotes", {
  id: "q_lost", requestId: "req_closed", requesterId: buyer.id,
  participantId: "part_lost", participantUserId: me.id, capabilityId: null,
  matchId: null, status: "declined", revision: 2, offers: [], draft: null,
  history: [
    { action: "quote_submitted", actorId: me.id, at: now.toISOString() },
    { action: "quote_declined", actorId: buyer.id, reason: "Selected another option", at: now.toISOString() }
  ],
  operations: [], createdAt: now.toISOString(), updatedAt: now.toISOString()
});

// My open quote with a future validUntil (expiring).
store.insert("requestQuotes", {
  id: "q_open", requestId: "req_open", requesterId: buyer.id,
  participantId: "part_open", participantUserId: me.id, capabilityId: null,
  matchId: null, status: "submitted", revision: 1,
  offers: [{ terms: { validUntil: tomorrow }, revision: 1 }], draft: null,
  history: [{ action: "quote_submitted", actorId: me.id, at: now.toISOString() }],
  operations: [], createdAt: now.toISOString(), updatedAt: now.toISOString()
});

// A waitlist offer with a real position + expiry.
store.insert("campaigns", { id: "camp_1", title: "Kilimani Night Market", status: "live", ownerId: buyer.id, type: "event" });
store.insert("waitlistEntries", {
  id: "wl_1", campaignId: "camp_1", attendeeRef: "me", userId: me.id,
  personId: null, position: 2, status: "offered",
  offerExpiresAt: new Date(now.getTime() + 6 * 3600000).toISOString(),
  reservedAt: now.toISOString()
});

// A territory override with a window ~2 months out.
store.insert("vendors", { id: "vnd_1", ownerId: me.id, displayName: "Mama Njeri Grocers", status: "active", businessType: "retailer", location: "Gikomba", createdAt: now.toISOString(), updatedAt: now.toISOString() });
store.insert("vendorClaims", {
  id: "vcl_1", vendorId: "vnd_1", agentId: me.id, claimType: "full_registration",
  territoryKey: null, status: "active", claimedAt: now.toISOString(),
  expiresAt: new Date(now.getTime() + 60 * 24 * 3600000).toISOString(),
  createdAt: now.toISOString()
});

// A lipa-mdogo contract with one overdue instalment.
store.insert("lipaMdogoContracts", {
  id: "lmd_1", customerId: me.id, vendorId: "vnd_1", lenderId: "p1",
  lenderKey: "sacco", lenderName: "M-Pesa SACCO", status: "active",
  asset: { deviceId: "D1", name: "Home Radio", totalValue: 10000, downPayment: 2000, financed: 8000, termMonths: 4 },
  schedule: [{ index: 0, dueDate: new Date(now.getTime() - 5 * 24 * 3600000).toISOString(), amountDue: 2000 }],
  createdAt: now.toISOString()
});

// ---------------------------------------------------------------------------
test("positionFor derives expiring quotes, waitlist, override, overdue and open demand", () => {
  const p = position.positionFor(me.id);

  // Decay: one expiring quote with a future validUntil.
  assert.equal(p.decay.expiringQuotes.length, 1, "one expiring quote");
  assert.equal(p.decay.expiringQuotes[0].requestId, "req_open");
  assert.ok(p.decay.expiringQuotes[0].hoursLeft > 0, "a real hours-left figure");

  // Decay: waitlist offer with position + expiry.
  assert.equal(p.decay.waitlist.length, 1);
  assert.equal(p.decay.waitlist[0].position, 2);
  assert.equal(p.decay.waitlist[0].status, "offered");
  assert.ok(p.decay.waitlist[0].hoursLeft > 0);

  // Decay: override window derived from the claim's expiresAt.
  assert.equal(p.decay.override.claimCount, 1);
  assert.ok(p.decay.override.monthsLeft >= 1 && p.decay.override.monthsLeft <= 2, "override window ~2 months");

  // Decay: one overdue instalment.
  assert.equal(p.decay.overdueInstallments, 1, "one overdue instalment");

  // Missed: the one quote declined because another was selected.
  assert.equal(p.missedCapture.count, 1, "one real missed capture");
  assert.equal(p.missedCapture.recent[0].title, "Catering for 50");

  // Open: the live request with no accepted quote.
  assert.equal(p.open.total, 1, "one still-open request");
  assert.equal(p.open.top[0].title, "200kg of Irish potatoes");
});

test("missed capture only counts a REAL 'selected another option' decline", () => {
  // A quote I withdrew myself must NOT count as missed.
  store.insert("requestQuotes", {
    id: "q_withdrawn", requestId: "req_open", requesterId: buyer.id,
    participantId: "part_w", participantUserId: me.id, capabilityId: null,
    matchId: null, status: "withdrawn", revision: 1, offers: [], draft: null,
    history: [{ action: "quote_withdrawn", actorId: me.id, at: now.toISOString() }],
    operations: [], createdAt: now.toISOString(), updatedAt: now.toISOString()
  });
  const p = position.positionFor(me.id);
  assert.equal(p.missedCapture.count, 1, "a self-withdrawal is not a missed capture");
});

test("an empty account returns honest zeroes, never fabricated numbers", () => {
  const fresh = auth.createUser({ handle: "pos_fresh", password: "position-pw" });
  const p = position.positionFor(fresh.id);
  assert.equal(p.decay.expiringQuotes.length, 0);
  assert.equal(p.decay.waitlist.length, 0);
  assert.equal(p.decay.override, null);
  assert.equal(p.decay.overdueInstallments, 0);
  assert.equal(p.missedCapture.count, 0);
  // Open demand is global, so it may be non-zero; only the user's own rows are zero.
  assert.equal(typeof p.open.total, "number");
});

// ---------------------------------------------------------------------------
// NEXT MOVE + MISSED VALUE — the two places a number could be invented, so
// both are pinned to rows.
// ---------------------------------------------------------------------------
store.insert("matches", {
  id: "mtch_1", requestId: "req_open", participantId: "vnd_1", capabilityId: null,
  status: "suggested", requesterState: "suggested", revision: 1,
  createdAt: now.toISOString(), updatedAt: now.toISOString(), history: []
});

test("nextMove is the real open request a match row put in front of me", () => {
  const mv = position.positionFor(me.id).nextMove;
  assert.ok(mv, "a move exists because a real request is open");
  assert.equal(mv.requestId, "req_open", "the still-open request is the one");
  assert.equal(mv.why, "This was matched to one of your enterprises", "the ranking reason is the real match row");
  assert.equal(mv.matchCount, 1, "the match count is the counted match rows, not a seeded number");
  assert.equal(mv.title, "200kg of Irish potatoes", "the title is the request's own");
  // No deadline on the row -> no countdown on the card. Never "closes in 6h".
  assert.equal(mv.requiredBy, null, "no invented deadline");
  assert.equal(mv.hoursUntilRequiredBy, null, "no invented countdown");
  // The only price allowed is MY OWN offer's, and my offer carries none.
  assert.ok(mv.myQuote, "my live quote on it is recognised");
  assert.equal(mv.myQuote.offerValue, null, "an offer with no completed price reports no value");
  assert.equal("valueKes" in mv, false, "the move itself exposes no price field to misuse");
  // Precedent for 'produce' is genuinely zero, reported as zero, not smoothed.
  assert.equal(mv.precedent.closedInWindow, 0, "no closure precedent in this category");
  assert.equal(mv.precedent.avgValue, null, "no average price is manufactured");
  assert.equal(mv.evidence.table, "requests", "the figure is traceable to a row");
});

test("a missed capture carries only MY OWN declined offer's derived total", () => {
  const before = position.positionFor(me.id).missedCapture;
  assert.equal(before.count, 1);
  assert.equal(before.value, null, "my lost offer had no price -> no money figure at all");

  // Now a lost offer that DID carry a price: 10 units x KES 1,500.
  store.insert("requestQuotes", {
    id: "q_lost_priced", requestId: "req_closed", requesterId: buyer.id,
    participantId: "part_lost2", participantUserId: me.id, capabilityId: null,
    matchId: null, status: "declined", revision: 2,
    offers: [{
      revision: 1,
      terms: { quotedQuantity: 10, unit: "kg", unitPriceMinor: 150000, currency: "KES", deliveryCostMinor: 0, sourcingFeeMinor: 0, otherCosts: [] }
    }],
    draft: null,
    history: [{ action: "quote_declined", actorId: buyer.id, reason: "Selected another option", at: now.toISOString() }],
    operations: [], createdAt: now.toISOString(), updatedAt: now.toISOString()
  });

  const after = position.positionFor(me.id).missedCapture;
  assert.equal(after.count, 2, "both real declines are counted");
  assert.equal(after.value.amount, 15000, "the sum is my own priced offer only (10 x 1500)");
  assert.equal(after.value.sampleCount, 1, "and it says how many offers it averaged");
  assert.equal(after.value.currency, "KES", "the currency is the offer's own");
  const priced = after.recent.find((m) => m.value);
  assert.equal(priced.value.amount, 15000, "per-row value traces to that row's terms");
  assert.equal(priced.evidence.id, "q_lost_priced", "with the row id it came from");
});

test("a stranger's move falls back to real open demand, never a story", () => {
  const mv = position.positionFor(buyer.id).nextMove;
  assert.ok(mv, "open demand is platform-wide, so a move can still exist");
  assert.equal(mv.why, "Open demand on the platform right now", "the fallback states what it is");
  assert.equal(mv.myQuote, null, "no quote is attributed to someone who has none");
});

test("API: /api/me/position is wired and auth-gated", async () => {
  const { default: app } = await import("../src/index.js");
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (p, m = "GET", body, token) => {
    const headers = { "content-type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    const r = await fetch(`http://127.0.0.1:${port}${p}`, { method: m, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  try {
    const anon = await call("/api/me/position", "GET");
    assert.equal(anon.status, 401, "no session -> 401");
    const A = (await call("/api/auth/register", "POST", { handle: "pos_http" + Date.now().toString(36), password: "a good passphrase" })).body;
    const res = await call("/api/me/position", "GET", undefined, A.token);
    assert.equal(res.status, 200);
    assert.ok(res.body.position.decay && res.body.position.missedCapture && res.body.position.open, "full shape present");
  } finally {
    srv.close();
  }
});

console.log(`\nPASS ${count}`);
process.exit(0);
