// ---------------------------------------------------------------------------
// PULSE — "what is moving", composed only from real rows.
//
// The whole point of this read is that it can be audited: every phrase is a
// count or a sum over rows that exist right now. So the tests pin both halves:
//
//   * an empty store produces NO facts and says it is empty (never a seeded
//     "the market is buzzing" line);
//   * a populated store produces exactly the counts the rows imply;
//   * and no percentage, trend or market-feed figure can appear, because Brief
//     holds no price history to compute one from.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-pulse-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const { pulse } = await import("../src/domain/pulse.js");

let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log("PASS " + name); };

const nowMs = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const HOUR = 3600000;
const DAY = 24 * HOUR;

const flat = (value) => JSON.stringify(value);

await test("an empty ledger produces no facts, and says it is empty", () => {
  const p = pulse();
  assert.equal(p.facts.length, 0, "no rows -> no claims");
  assert.equal(p.empty, true, "the emptiness is stated");
  assert.equal(p.asOf, null, "no row, no timestamp");
  assert.equal(p.sections.demand.open, 0);
  assert.ok(typeof p.note === "string" && p.note.length > 0, "the read states its own limits");
});

// --- Now real rows, each one a fact that can be counted -------------------
store.insert("requests", {
  id: "req_p1", title: "200kg of Irish potatoes", status: "open", category: "produce",
  quantity: 200, unit: "kg", currency: "KES", location: "Wakulima", requesterId: "u1",
  revision: 1, history: [], attachments: [], createdAt: iso(nowMs - 6 * HOUR), updatedAt: iso(nowMs - 2 * HOUR)
});
store.insert("requests", {
  id: "req_p2", title: "Cold-chain run", status: "matching", category: "logistics",
  requesterId: "u1", revision: 1, history: [], attachments: [],
  createdAt: iso(nowMs - 30 * DAY), updatedAt: iso(nowMs - 20 * DAY)
});
store.insert("requests", {
  id: "req_p3", title: "Trays of bread", status: "ready_for_work", category: "produce",
  requesterId: "u1", revision: 1, history: [], attachments: [],
  createdAt: iso(nowMs - 4 * DAY), updatedAt: iso(nowMs - 3 * DAY)
});
store.insert("campaigns", {
  id: "camp_p1", title: "Kilimani Night Market", status: "published", type: "event",
  price: 0, currency: "KES", ownerId: "u1", objectId: null,
  startsAt: iso(nowMs + 5 * DAY), endsAt: null, createdAt: iso(nowMs - 12 * HOUR), updatedAt: iso(nowMs - 12 * HOUR)
});
store.insert("campaigns", {
  id: "camp_past", title: "Last Saturday's drop", status: "published", type: "drop",
  price: 0, currency: "KES", ownerId: "u1", objectId: null,
  startsAt: iso(nowMs - 9 * DAY), endsAt: iso(nowMs - 9 * DAY),
  createdAt: iso(nowMs - 12 * DAY), updatedAt: iso(nowMs - 9 * DAY)
});
store.insert("listings", {
  id: "lst_p1", vendorId: "vnd_p1", title: "5kg potatoes", type: "product",
  price: 700, currency: "KES", status: "active", quantity: 10,
  createdAt: iso(nowMs - 3 * DAY), updatedAt: iso(nowMs - 3 * DAY)
});
store.insert("listings", {
  id: "lst_p2", vendorId: "vnd_p1", title: "10kg potatoes", type: "product",
  price: 1300, currency: "KES", status: "active", quantity: 4,
  createdAt: iso(nowMs - 2 * DAY), updatedAt: iso(nowMs - 2 * DAY)
});
store.insert("orders", {
  id: "ord_p1", buyerId: "u2", vendorId: "vnd_p1", listingId: "lst_p1", quantity: 2,
  total: 1400, currency: "KES", status: "settled", createdAt: iso(nowMs - 2 * DAY), updatedAt: iso(nowMs - 1 * DAY)
});
store.insert("workOrders", {
  id: "wo_p1", requestId: "req_p3", status: "completed",
  createdAt: iso(nowMs - 3 * DAY), updatedAt: iso(nowMs - 1 * DAY)
});

await test("every fact is a count over the rows that exist — and only those", () => {
  const p = pulse();
  const texts = p.facts.map((f) => f.text).join(" | ");

  // Demand: two live requests with no accepted quote (req_p3 closed).
  assert.equal(p.sections.demand.open, 2, "open demand counted from real request rows");
  assert.ok(/2 requests open with no accepted quote/.test(texts), "the demand fact states the count");

  // Events: only the campaign that has NOT ended counts as open.
  assert.equal(p.sections.events.open, 1, "an event with a past endsAt is not presented as open");
  assert.ok(/1 published event still open/.test(texts));

  // Money: one settled order, one completed work order.
  assert.equal(p.sections.money.settledOrders, 1);
  assert.equal(p.sections.money.settledValue, 1400, "the settled value is the order's own total");
  assert.equal(p.sections.money.settledCurrency, "KES", "and the currency the row states");
  assert.equal(p.sections.money.completedWorkOrders, 1);

  // Prices: the average of the two ACTIVE listings, from their own rows.
  const product = p.sections.listings.snapshot.find((s) => s.type === "product");
  assert.equal(product.count, 2, "active listings counted");
  assert.equal(product.avgPrice, 1000, "average of the two real prices");
  assert.ok(/average listed KES 1,000/.test(texts), "and the fact shows that average");

  // Precedent: only req_p3 has an accepted quote / closed status.
  assert.equal(p.sections.closure.closed, 1, "closures are counted, not assumed");

  // The snapshot stamp is the newest real row time, not the clock.
  // The newest timestamp on any considered row is req_p1's own updatedAt.
  assert.equal(p.asOf, iso(nowMs - 2 * HOUR), "asOf is the newest row's own timestamp, not the clock");
  assert.ok(Date.parse(p.asOf) < nowMs, "and it is never 'now'");
});

await test("no percentage, trend, sector or feed figure can appear", () => {
  const p = pulse();
  // The payload's own disclaimer legitimately USES those words to say they are
  // absent; the assertions are therefore about the data, not about the prose.
  const { note, ...data } = p;
  const json = flat(data);
  assert.equal(json.includes("%"), false, "a percent sign cannot appear in the data");
  for (const banned of ["trend", "changePct", "sector", "arbitrage", "forecast", "queuePosition", "tier"]) {
    assert.equal(json.toLowerCase().includes(banned.toLowerCase()), false, `no ${banned} in the payload`);
  }
  for (const f of p.facts) {
    assert.ok(f.text.length > 0 && f.id.length > 0, "each fact is a labelled real line");
    assert.equal(f.text.includes("%"), false, "and no fact reports a percentage");
  }
  // The absence is explained rather than hidden.
  assert.ok(/no trend percentage/.test(note), "the read states that it holds no trend");
});

await test("a mixed currency basket is not presented as one money figure", () => {
  store.insert("orders", {
    id: "ord_p2", buyerId: "u2", vendorId: "vnd_p1", listingId: "lst_p2", quantity: 1,
    total: 20, currency: "USD", status: "settled", createdAt: iso(nowMs - 2 * HOUR), updatedAt: iso(nowMs - 1 * HOUR)
  });
  const p = pulse();
  assert.equal(p.sections.money.settledValue, null, "two currencies -> no single figure");
  assert.equal(p.sections.money.settledOrders, 2, "while the count stays honest");
  const money = p.facts.find((f) => f.id === "money");
  assert.ok(money && !/KES/.test(money.text), "the money fact drops the amount, not the count");
});

await test("API: GET /api/pulse is public, derived, and never 401s a browse screen", async () => {
  const { default: app } = await import("../src/index.js");
  const srv = app.listen(0);
  const port = srv.address().port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/pulse`);
    assert.equal(r.status, 200, "the aggregate is readable without a session");
    const body = await r.json();
    assert.ok(Array.isArray(body.facts), "facts array present");
    assert.equal(typeof body.empty, "boolean", "the emptiness is explicit");
    assert.ok(body.sections.demand && body.sections.money, "the structured sections are present");
  } finally {
    srv.close();
  }
});

console.log(`\nPASS ${count}`);
process.exit(0);
