// ---------------------------------------------------------------------------
// WHOSE MONEY IS IT — a space's figures are that space's, and what cannot be
// attributed is said out loud instead of absorbed.
//
// The bug this exists to kill: a space shares its owner's VENDOR, and both
// money reads filtered orders on `o.spaceId === space.id || o.vendorId ===
// space.vendorId`. `order.js` never wrote a `spaceId`, so the first clause was
// always false and the second caught everything the owner had ever sold. Two
// spaces of one bakery each displayed the bakery's whole takings — and the Money
// panel then divided one by the other to print a "Margin". Any dashboard built
// on top of that (the owner's view of all spaces, the daily brief) would have
// shipped a double count as a feature.
//
// The rule, and the four things these tests hold:
//
//   * an order joins to a space through the offer it was placed against, and new
//     orders also carry `spaceId` directly, stamped from the listing at creation
//     (a listing can be re-filed later; the order must keep saying where the
//     sale happened);
//   * a row of the vendor's that names NO space folds in only for a vendor with
//     exactly one space — the state every shop was in before spaces multiplied;
//   * once a second space exists, an unattached row belongs to none of them, and
//     it is COUNTED AND REPORTED (`unattached`) rather than added to every space
//     or dropped in silence. A number that shrinks without saying why is the
//     same lie in the other direction;
//   * and the words on the number come from the server (`revenueBasis`,
//     `scope`), so no screen can quietly call a status count a ledger fact.
// ---------------------------------------------------------------------------
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
process.env.BRIEF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "brief-mscope-"));

const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const spaces = await import("../src/domain/space.js");
const listings = await import("../src/domain/listing.js");
const orders = await import("../src/domain/order.js");
const vendors = await import("../src/domain/vendor.js");

let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log("PASS " + name); };

const owner = auth.createUser({ handle: "ms_owner", password: "a good passphrase" });
const buyer = auth.createUser({ handle: "ms_buyer", password: "a good passphrase" });
const vendor = vendors.createVendor({ ownerId: owner.id, displayName: "One Bakery" });

/** A listing of the shared vendor, filed under `spaceId` (or nowhere). */
function offer(spaceId, price = 1000) {
  const l = listings.createListing({ vendorId: vendor.id, title: `Loaf ${price}`, price, currency: "KES", quantityAvailable: 100 });
  if (spaceId) store.update("listings", l.id, { spaceId });
  listings.transitionListing(l.id, "active");
  return listings.getListing(l.id);
}
/**
 * A sale against that offer, taken through the ordinary order rail as far as it
 * goes WITHOUT a payment: `fulfilled` is in the counted set and needs no ledger
 * row, while `settled` is refused until one is attached — see the last test,
 * which is why the figure is captioned "marked" and not "settled".
 */
function sale(listing, total = null) {
  const o = orders.createOrder({ listingId: listing.id, buyerId: buyer.id, quantity: 1 });
  orders.transitionOrder(o.id, "fulfilled");
  if (total !== null) store.update("orders", o.id, { total });
  return store.find("orders", (x) => x.id === o.id);
}

const retail = spaces.createSpace({ ownerId: owner.id, name: "Counter", type: "business", mode: "retail" });
store.update("spaces", retail.id, { vendorId: vendor.id });
const wholesale = spaces.createSpace({ ownerId: owner.id, name: "Bulk book", type: "business", mode: "wholesale" });
store.update("spaces", wholesale.id, { vendorId: vendor.id });

// ---------------------------------------------------------------------------
await test("a new order carries the space of the offer it was placed against", () => {
  const l = offer(retail.id, 500);
  const o = sale(l);
  assert.equal(o.spaceId, retail.id, "stamped at creation, not looked up later");
  const unfiled = offer(null, 300);
  assert.equal(unfiled.spaceId, undefined, "an offer filed under no space stays that way");
  assert.equal(orders.createOrder({ listingId: unfiled.id, buyerId: buyer.id, quantity: 1 }).spaceId, null,
    "and the order says null, which is a fact, not a missing field");
});

await test("two spaces of one business do not both report the same takings", () => {
  sale(offer(retail.id, 4000));
  sale(offer(wholesale.id, 1000));
  sale(offer(wholesale.id, 1000));
  const a = spaces.getSpace(retail.id, { callerId: owner.id });
  const b = spaces.getSpace(wholesale.id, { callerId: owner.id });
  // 500 came from the first test's sale, which is the point of summing: the
  // counter carries the 500 and the 4,000 it is owed, and NOTHING of the bulk
  // book's 2,000. Before the join existed both rows read 6,500.
  assert.equal(a.metrics.revenueKes, 4500, `counter shows only its own, got ${a.metrics.revenueKes}`);
  assert.equal(b.metrics.revenueKes, 2000, `bulk shows only its own, got ${b.metrics.revenueKes}`);
  assert.notEqual(a.metrics.revenueKes, b.metrics.revenueKes, "the whole point: they are not the same number");
  assert.equal(a.metrics.scope, "this space only", "and each read says what it covers");
  assert.equal(a.metrics.totalOrdersCount, 2, "its two sales, and no more");
  assert.equal(b.metrics.totalOrdersCount, 2, "its two sales, and no more");
});

await test("an unattached order is reported, not absorbed and not hidden", () => {
  const before = spaces.getSpace(retail.id, { callerId: owner.id }).metrics;
  const orphan = sale(offer(null, 9000), 9000);
  assert.equal(orphan.spaceId, null, "the order belongs to the vendor, and to no space");
  const a = spaces.getSpace(retail.id, { callerId: owner.id }).metrics;
  const b = spaces.getSpace(wholesale.id, { callerId: owner.id }).metrics;
  assert.equal(a.revenueKes, before.revenueKes, "so it enters neither space’s figure");
  assert.equal(b.revenueKes, 2000, "not even by rounding the corners");
  assert.equal(a.unattachedOrderCount, (before.unattachedOrderCount ?? 0) + 1, "but it is counted, where it is visible");
  assert.equal(a.unattachedRevenueKes, (before.unattachedRevenueKes ?? 0) + 9000, "with its money attached");
});

await test("a sole space still gets the shop’s whole book, because there is nowhere else", () => {
  // A DIFFERENT owner and vendor, so this space genuinely has no sibling. Reusing
  // the bakery above would have made it a second space of that vendor, and the
  // test would have been checking the opposite of what its name says.
  const solo = auth.createUser({ handle: "ms_solo", password: "a good passphrase" });
  const soloBuyer = auth.createUser({ handle: "ms_solo_buyer", password: "a good passphrase" });
  const soloVendor = vendors.createVendor({ ownerId: solo.id, displayName: "One Man Duka" });
  const lone = spaces.createSpace({ ownerId: solo.id, name: "Sole Shop", type: "business" });
  assert.equal(lone.vendorId, soloVendor.id, "the space provisioned onto its owner's vendor");

  // An offer filed under no space, and a sale against it. The one-space case IS
  // the pre-multi-space state, so the fallback survives — scoped to exactly that
  // case, and named in the read rather than assumed by the reader.
  const unfiled = listings.createListing({ vendorId: soloVendor.id, title: "Roti", price: 900, currency: "KES", quantityAvailable: 50 });
  listings.transitionListing(unfiled.id, "active");
  const o = orders.createOrder({ listingId: unfiled.id, buyerId: soloBuyer.id, quantity: 1 });
  orders.transitionOrder(o.id, "fulfilled");

  const m = spaces.getSpace(lone.id, { callerId: solo.id }).metrics;
  assert.equal(m.scope, "sole space of this business", "and the read admits which rule it used");
  assert.equal(m.revenueKes, 900, `the unattached sale is counted for the sole space, got ${m.revenueKes}`);
  assert.equal(m.unattachedOrderCount, 0, "nothing is left over when there is one space");

  // A second space ends the courtesy immediately: the unattached sale now has a
  // sibling it could be confused with, so it belongs to neither and is reported.
  const second = spaces.createSpace({ ownerId: solo.id, name: "Second Room", type: "business" });
  assert.equal(second.vendorId, soloVendor.id, "same business, new room");
  const after = spaces.getSpace(lone.id, { callerId: solo.id }).metrics;
  assert.equal(after.scope, "this space only", "the scope changes with the facts, on the same row");
  assert.equal(after.revenueKes, 0, "and the figure stops claiming a row it cannot attribute");
  assert.equal(after.unattachedOrderCount, 1, "which surfaces as one order belonging to no space");
  assert.equal(after.unattachedRevenueKes, 900, "with its money named");
  const alsoEmpty = spaces.getSpace(second.id, { callerId: solo.id }).metrics;
  assert.equal(alsoEmpty.revenueKes, 0, "and the new room does not inherit the old one's sales");
});

await test("the money panel’s arithmetic follows the same scope as the header", () => {
  const r = spaces.getSpaceMoneySummary(retail.id);
  const w = spaces.getSpaceMoneySummary(wholesale.id);
  assert.equal(r.totalRevenueKes, 4500, `in, this space: ${r.totalRevenueKes}`);
  assert.equal(w.totalRevenueKes, 2000, `in, that space: ${w.totalRevenueKes}`);
  assert.equal(r.scope, "this space only");
  assert.ok(r.unattached && r.unattached.orders >= 1, "and the panel is told about the leftovers, so it can say so");
  assert.ok(r.unattached.revenueKes >= 9000, "with the amount, not just a count");
  assert.equal(r.settledOrderCount, 2, "a count of the rows behind the figure travels with it");
  assert.equal(r.totalRevenueKes, spaces.getSpace(retail.id, { callerId: owner.id }).metrics.revenueKes,
    "the panel and the header cannot disagree, because both read one scoped set");
});

await test("expenses never leak across spaces, because they are keyed on the space", () => {
  spaces.recordSpaceExpense({ spaceId: retail.id, category: "supplies", description: "Flour, 50kg", amountKes: 1500, callerId: owner.id });
  const r = spaces.getSpaceMoneySummary(retail.id);
  const w = spaces.getSpaceMoneySummary(wholesale.id);
  assert.equal(r.totalExpensesKes, 1500, "the flour the counter bought");
  assert.equal(w.totalExpensesKes, 0, "is not the bulk book’s cost");
  assert.equal(r.expensesRecorded, 1, "and the panel says how few rows the out figure rests on");
  assert.equal(r.netProfitKes, r.totalRevenueKes - 1500, "recorded in minus recorded out");
  assert.equal(spaces.getSpace(wholesale.id, { callerId: owner.id }).metrics.revenueKes, 2000,
    "and the flour did not move the other space’s number either");
});

await test("no money measured is a null margin, never 0%", () => {
  const quiet = spaces.createSpace({ ownerId: owner.id, name: "Quiet Room", type: "business" });
  store.update("spaces", quiet.id, { vendorId: "vnd_something_else_entirely" });
  const q = spaces.getSpaceMoneySummary(quiet.id);
  assert.equal(q.totalRevenueKes, 0, "a true zero: nothing settled here");
  assert.equal(q.marginPercent, null, "and no ratio, because a 0% margin states a fact this shop has not");
  assert.equal(q.netProfitKes, 0, "the subtraction of two empties is still an empty");

  // A shop that sold and kept nothing DOES get a real 0%.
  sale(offer(quiet.id, 1000));
  spaces.recordSpaceExpense({ spaceId: quiet.id, category: "cost", description: "Everything went out", amountKes: 1000, callerId: owner.id });
  const sold = spaces.getSpaceMoneySummary(quiet.id);
  assert.equal(sold.netProfitKes, 0, "in equals out");
  assert.equal(sold.marginPercent, 0, "and that is a measured 0%, which the dash is not");
});

await test("an order with no ledger row is still in the figure — so the caption says “marked”", () => {
  const l = offer(retail.id, 2500);
  const o = orders.createOrder({ listingId: l.id, buyerId: buyer.id, quantity: 1 });
  orders.transitionOrder(o.id, "fulfilled");
  const row = store.find("orders", (x) => x.id === o.id);
  assert.equal(row.transactionId, null, "no payment was ever recorded against it");
  // The pairing that keeps the label honest: the domain REFUSES the word
  // "settled" on an order until a settled ledger row is attached to it. So the
  // only rows in this figure without money behind them are the ones the owner
  // marked paid or fulfilled — precisely what the caption says, and precisely
  // what "Settled through Brief" used to claim without checking.
  assert.throws(() => orders.transitionOrder(o.id, "settled"), /settled transaction is attached/);
  const m = spaces.getSpace(retail.id, { callerId: owner.id }).metrics;
  assert.ok(m.revenueKes >= 2500, "it is still in the figure — this is a marking, not a settlement");
  assert.equal(m.revenueBasis, "orders marked paid or settled",
    "so the read carries the words that make it true, and no surface has to invent them");
});

console.log(`PASSED ${count} FAILED 0`);
