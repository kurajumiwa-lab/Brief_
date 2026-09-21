// ---------------------------------------------------------------------------
// THE SHELF LOG — every movement of a stock count leaves a row, or the morning
// brief has nothing honest to say about the shelf.
//
// A listing stores ONE number (`quantityAvailable`) and the order rail
// decrements it. "4 sold, so why is the count back at 10?" is therefore not a
// question about that field — it is a question about a history that did not
// exist until this file. What these tests hold:
//
//   * the log is written by the two doors that can move a count and by nothing
//     else: a real order (`consumeStock`) and a human re-typing it
//     (`updateListing`);
//   * a non-change writes no row, so a form that posts every field cannot
//     "explain" a disappearance with noise;
//   * `delta` is computed from the row's own endpoints, never supplied;
//   * a sale names the order behind it, a typed edit names the actor behind it;
//   * and the log is append-only — no update path, no delete path, checked
//     against the source rather than asserted in prose.
// ---------------------------------------------------------------------------
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
process.env.BRIEF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "brief-stock-"));

const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const vendors = await import("../src/domain/vendor.js");
const listings = await import("../src/domain/listing.js");
const orders = await import("../src/domain/order.js");
const stockLog = await import("../src/domain/stockLog.js");

let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log("PASS " + name); };

const owner = auth.createUser({ handle: "st_owner", password: "a good passphrase" });
const buyer = auth.createUser({ handle: "st_buyer", password: "a good passphrase" });
const vendor = vendors.createVendor({ ownerId: owner.id, displayName: "Counter" });

/** A stock-tracked offer of `start` units, active. */
function mk(title, start) {
  const l = listings.createListing({
    vendorId: vendor.id, title, price: 100, currency: "KES", quantityAvailable: start
  });
  listings.transitionListing(l.id, "active");
  return listings.getListing(l.id);
}
const sell = (listing, qty = 1) => orders.createOrder({ listingId: listing.id, buyerId: buyer.id, quantity: qty });
const rowsFor = (listingId) => store.filter("stockChanges", (r) => r.listingId === listingId);

await test("the two doors are the only writers, and the log cannot be rewritten", () => {
  const src = fs.readFileSync(new URL("../src/domain/listing.js", import.meta.url), "utf8");
  const logSrc = fs.readFileSync(new URL("../src/domain/stockLog.js", import.meta.url), "utf8");
  assert.equal((src.match(/stockLog\.recordStockChange\(/g) ?? []).length, 2,
    "one call in consumeStock, one in updateListing — a third door would have to be a lie or a leak");
  assert.match(src, /reason: "order"|reason: 'order'/);
  assert.match(src, /reason: "owner_edit"|reason: 'owner_edit'/);
  assert.ok(!/store\.update\(["']stockChanges["']/.test(logSrc), "no update path: an editable movement log is not evidence");
  assert.ok(!/store\.remove\(["']stockChanges["']|store\.delete\(["']stockChanges["']/.test(logSrc), "no delete path");
  assert.deepEqual(stockLog.STOCK_REASONS, ["order", "owner_edit"]);
});

await test("a sale writes one row, named by the order that took the units", () => {
  const l = mk("Maize flour 2kg", 10);
  const o = sell(l, 4);
  const rows = rowsFor(l.id);
  assert.equal(rows.length, 1, `one movement for one order, got ${rows.length}`);
  assert.equal(rows[0].reason, "order");
  assert.equal(rows[0].orderId, o.id, "a unit that left the shelf says which order took it");
  assert.equal(rows[0].from, 10);
  assert.equal(rows[0].to, 6);
  assert.equal(rows[0].delta, -4, "negative: units went out");
  assert.equal(rows[0].actorId, null, "the buyer did not edit the shelf; the orderId names them instead");
  assert.equal(store.find("listings", (x) => x.id === l.id).quantityAvailable, 6, "and the field still agrees with the log");
});

await test("a typed count writes a row with the actor who typed it, and no reason", () => {
  const l = mk("Cooking oil 5L", 8);
  sell(l, 3);                                            // 8 -> 5
  listings.updateListing(l.id, { quantityAvailable: 8 });   // a hand puts it back
  const rows = rowsFor(l.id);
  assert.equal(rows.length, 2);
  const edit = rows[1];
  assert.equal(edit.reason, "owner_edit");
  assert.equal(edit.from, 5);
  assert.equal(edit.to, 8);
  assert.equal(edit.delta, 3, "the units that appeared, with no sale behind them");
  assert.equal(edit.orderId, null, "no order caused it");
  assert.equal(edit.actorId, null, "the route's actor is what fills this; the domain call above sent none");
  // The row's `reason` is WHICH DOOR moved the count, not an explanation of why.
  // There is no field for a motive, because the API does not ask for one — the
  // brief therefore reports an unexplained delta and never an accusation.
  assert.deepEqual(Object.keys(edit).sort(),
    ["actorId", "at", "delta", "from", "id", "listingId", "orderId", "reason", "spaceId", "to", "vendorId"].sort(),
    "the whole shape of a movement row: counts, an actor, a time, and no field for a motive");
});

await test("an actor typed it: the row that says so is the row the flag points at", () => {
  const l = mk("Sugar 1kg", 20);
  listings.updateListing(l.id, { quantityAvailable: 18 }, { actorId: owner.id });
  const row = rowsFor(l.id)[0];
  assert.equal(row.actorId, owner.id);
  assert.equal(row.delta, -2, "2 left the shelf with no order behind them");
});

await test("re-saving the same count is not an event", () => {
  const l = mk("Rice 5kg", 4);
  sell(l, 1);                                                 // 4 -> 3
  const before = rowsFor(l.id).length;
  listings.updateListing(l.id, { quantityAvailable: 3, title: "Rice 5kg (relabelled)" });
  assert.equal(rowsFor(l.id).length, before, "the count did not move, so nothing was logged");
  listings.updateListing(l.id, { quantityAvailable: 3 }, { actorId: owner.id });
  assert.equal(rowsFor(l.id).length, before, "not even from the form that posts every field");
});

await test("starting to track stock is not a restock", () => {
  const l = mk("Broom", null);                                 // untracked
  assert.equal(rowsFor(l.id).length, 0, "a service-like offer has no shelf to log");
  listings.updateListing(l.id, { quantityAvailable: 12 }, { actorId: owner.id });
  const rows = rowsFor(l.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].from, null, "there was no earlier count");
  assert.equal(rows[0].delta, null, "so the change is not a number, and no flag may read it as one");
  // An untracked listing that an order passes through stays untouched.
  sell(l, 5);
  assert.equal(store.find("listings", (x) => x.id === l.id).quantityAvailable, 7);
  assert.equal(rowsFor(l.id).length, 2, "once it IS tracked, a sale is a movement");
  assert.equal(rowsFor(l.id)[1].reason, "order");
});

await test("taking stock tracking off writes nothing and breaks nothing", () => {
  const l = mk("Second-hand shoes", 6);
  sell(l, 2);
  const before = rowsFor(l.id).length;
  listings.updateListing(l.id, { quantityAvailable: null }, { actorId: owner.id });
  assert.equal(rowsFor(l.id).length, before, "null is 'stop counting', not a count");
  assert.equal(store.find("listings", (x) => x.id === l.id).quantityAvailable, null);
});

await test("an unknown reason is refused, and a landing count is required", () => {
  const l = mk("Milk 2L", 12);
  assert.throws(() => stockLog.recordStockChange({ listingId: l.id, from: 12, to: 11, reason: "vibes" }),
    /stock change reason must be one of order, owner_edit/);
  assert.throws(() => stockLog.recordStockChange({ listingId: l.id, from: 12, reason: "owner_edit" }),
    /needs the count it landed on/);
  assert.throws(() => stockLog.recordStockChange({ from: 12, to: 11, reason: "order" }),
    /needs the listing it belongs to/);
  assert.equal(rowsFor(l.id).length, 0, "and a refused call leaves no row behind");
});

await test("movementsOnDay reads the day as a set of counts, oldest first", () => {
  const day = "2026-09-14";
  const l = mk("Tomatoes 1kg", 30);
  stockLog.recordStockChange({ listingId: l.id, vendorId: vendor.id, from: 30, to: 24, reason: "order", orderId: "ord_x", at: `${day}T07:12:00Z` });
  stockLog.recordStockChange({ listingId: l.id, vendorId: vendor.id, from: 24, to: 22, reason: "order", orderId: "ord_y", at: `${day}T09:40:00Z` });
  stockLog.recordStockChange({ listingId: l.id, vendorId: vendor.id, from: 22, to: 30, reason: "owner_edit", actorId: owner.id, at: `${day}T17:04:00Z` });
  // The next morning, and the day before. Neither may blur this day.
  stockLog.recordStockChange({ listingId: l.id, vendorId: vendor.id, from: 30, to: 29, reason: "order", orderId: "ord_z", at: "2026-09-15T06:00:00Z" });
  stockLog.recordStockChange({ listingId: l.id, vendorId: vendor.id, from: 31, to: 30, reason: "order", orderId: "ord_w", at: "2026-09-13T06:00:00Z" });

  const m = stockLog.movementsOnDay([l.id], day);
  const bucket = m.get(l.id);
  assert.equal(bucket.sold, 8, "the two ORDERS took 8; the typed edit is not a sale");
  assert.equal(bucket.startCount, 30, "the day's first row carries the count the day opened on");
  assert.equal(bucket.endCount, 30, "and the last row carries the count it closed on");
  assert.equal(bucket.sales.length, 2);
  assert.equal(bucket.edits.length, 1);
  assert.equal(bucket.rows[0].orderId, "ord_x", "oldest first, so a surface can print the order things happened in");
  assert.equal(m.size, 1, "one offer asked about, one offer answered");
});

await test("a day with no movement has no bucket, which is how 'nothing moved' is said", () => {
  const l = mk("Salt 1kg", 40);
  sell(l, 1);
  const m = stockLog.movementsOnDay([l.id], "2026-01-01");
  assert.equal(m.size, 0, "and it is not a zero sold, which would be a claim about that day");
});

await test("the history of one offer reads oldest first and stops at the cap", () => {
  const l = mk("Onions 1kg", 10);
  for (let i = 0; i < 5; i++) {
    stockLog.recordStockChange({ listingId: l.id, vendorId: vendor.id, from: 10 - i, to: 9 - i, reason: "order", at: `2026-09-1${i}T06:00:00Z` });
  }
  const all = stockLog.stockChangesFor(l.id);
  assert.equal(all.length, 5);
  assert.ok(all[0].at < all[4].at, "chronological");
  assert.equal(stockLog.stockChangesFor(l.id, { limit: 2 }).length, 2, "capped at the tail, which is the recent end");
});

console.log(`PASSED ${count} FAILED 0`);
