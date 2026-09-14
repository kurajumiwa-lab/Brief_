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

console.log(`\nPASS ${count}`);
process.exit(0);
