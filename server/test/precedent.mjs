// ---------------------------------------------------------------------------
// PRECEDENT — the honest confidence layer. Pins that "does this close" and
// "has money moved" are derived from real rows, with nothing invented.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-precedent-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const precedent = await import("../src/domain/precedent.js");

let count = 0;
const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };

const now = new Date().toISOString();

// A closed request (accepted quote) in 'catering', and an open one in 'produce'.
store.insert("requests", {
  id: "req_c", title: "Catering for 50", status: "ready_for_work", category: "catering",
  requesterId: "u1", revision: 1, history: [], attachments: [], acceptedQuote: { quoteId: "q1" },
  createdAt: now, updatedAt: now
});
store.insert("requests", {
  id: "req_o", title: "200kg potatoes", status: "open", category: "produce",
  requesterId: "u1", revision: 1, history: [], attachments: [], createdAt: now, updatedAt: now
});
// A settled order (real money moved).
store.insert("orders", {
  id: "ord_1", buyerId: "u1", vendorId: "v1", listingId: "l1", quantity: 2,
  total: 4000, currency: "KES", status: "settled", createdAt: now, updatedAt: now
});

test("categoryClosure counts only requests that actually closed, per category", () => {
  const c = precedent.categoryClosure();
  const catering = c.byCategory.find((x) => x.category === "catering");
  assert.equal(catering.closed, 1, "one catering request closed");
  assert.ok(!c.byCategory.some((x) => x.category === "produce"), "an open request is not counted as closed");
});

test("movement sums real settled money", () => {
  const m = precedent.movement();
  assert.equal(m.settledOrders, 1, "one settled order");
  assert.equal(m.settledOrdersKes, 4000, "the settled value is the real order total");
});


// ---------------------------------------------------------------------------
// FILL STATS — "how long did demand like this take, and what was it priced
// at?" Both figures must come from the rows themselves, and a row that does
// not carry the data yields null rather than a plausible number.
// ---------------------------------------------------------------------------
const HOUR = 3600000;

test("fillStats reports a real closure with NO invented time or price", () => {
  const f = precedent.fillStats({ category: "catering" });
  assert.equal(f.closed, 1, "the accepted-quote request counts as closed");
  // req_c has no acceptedAt and no quote row at all -> nothing to average.
  assert.equal(f.avgHoursToFill, null, "no acceptedAt -> no fill time, not a guess");
  assert.equal(f.hoursSampleCount, 0, "and the sample size says so");
  assert.equal(f.avgValue, null, "no accepted offer row -> no average price");
});

test("fillStats averages only real timestamps and the accepted offer's own terms", () => {
  // The accepted offer that req_c actually chose, with a completed price:
  // 2 units at KES 300 -> KES 600 total.
  store.insert("requestQuotes", {
    id: "q1", requestId: "req_c", participantUserId: "u2", requesterId: "u1",
    status: "accepted", revision: 1,
    offers: [{
      revision: 1,
      terms: {
        quotedQuantity: 2, unit: "tray", unitPriceMinor: 30000, currency: "KES",
        deliveryCostMinor: 0, sourcingFeeMinor: 0, otherCosts: []
      }
    }],
    history: [], operations: [], createdAt: now, updatedAt: now
  });
  const opened = new Date(Date.now() - 5 * HOUR).toISOString();
  store.update("requests", "req_c", {
    createdAt: opened,
    acceptedQuote: { quoteId: "q1", offerRevision: 1, acceptedAt: now }
  });

  const f = precedent.fillStats({ category: "catering" });
  assert.equal(f.closed, 1);
  assert.equal(f.avgHoursToFill, 5, "5.0h between the row's own createdAt and acceptedAt");
  assert.equal(f.hoursSampleCount, 1, "one row backs the average");
  assert.equal(f.avgValue.amount, 600, "the price is the accepted offer's derived total");
  assert.equal(f.avgValue.currency, "KES", "in the currency the offer itself states");
  assert.equal(f.avgValue.sampleCount, 1, "with its sample size");
});

test("fillStats for a category with no rows says so instead of scoring it", () => {
  const f = precedent.fillStats({ category: "transport" });
  assert.equal(f.closed, 0, "no closed rows");
  assert.equal(f.avgHoursToFill, null);
  assert.equal(f.avgValue, null);
  assert.ok(typeof f.note === "string" && f.note.length > 0, "the read states its own limits");
});

test("movement refuses one currency label when the basket is mixed", () => {
  const single = precedent.movement();
  assert.equal(single.settledCurrency, "KES", "one currency across settled rows -> it is named");

  store.insert("orders", {
    id: "ord_2", buyerId: "u1", vendorId: "v1", listingId: "l1", quantity: 1,
    total: 50, currency: "USD", status: "settled", createdAt: now, updatedAt: now
  });
  const mixed = precedent.movement();
  assert.equal(mixed.settledCurrency, null, "mixed currencies are not presented as one figure");
  assert.equal(mixed.settledOrders, 2, "the count is still the honest count");
});

console.log(`\nPASS ${count}`);
process.exit(0);
