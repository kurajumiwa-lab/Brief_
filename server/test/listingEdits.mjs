// ---------------------------------------------------------------------------
// POST-PUBLISH OFFER EDITS — the policy, not the vibe.
//
// The ask was "allow editing after publish, but lock the sensitive bits". The
// shipped rule is narrower and kinder than that, and these tests are why:
//
//   * descriptive fields (photo, description, stock, place, flow tags) stay
//     editable forever, with no reason and no friction;
//   * money fields (price, currency, per-unit label, minimum order) stay
//     changeable AFTER publishing too — because order.js snapshots unitPrice at
//     order time, a change can never retro-bill anyone — but a change needs a
//     reason and is appended to an immutable revision row;
//   * re-sending an unchanged price is NOT an event: no reason demanded, no row;
//   * a draft is a draft: nothing is public, so nothing needs explaining;
//   * status still cannot be PATCHed (the lifecycle table stays the only door);
//   * and the history is readable by the owner and by nobody else.
// ---------------------------------------------------------------------------
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
process.env.BRIEF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "brief-ledits-"));

const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const listings = await import("../src/domain/listing.js");
const vendors = await import("../src/domain/vendor.js");
const orders = await import("../src/domain/order.js");
const ledger = await import("../src/domain/ledger.js");

let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log("PASS " + name); };

const seller = auth.createUser({ handle: "le_seller", password: "a good passphrase" });
const buyer = auth.createUser({ handle: "le_buyer", password: "a good passphrase" });
const stranger = auth.createUser({ handle: "le_stranger", password: "a good passphrase" });
const vendor = vendors.createVendor({ ownerId: seller.id, displayName: "Le Stall" });

const mk = () => {
  const l = listings.createListing({ vendorId: vendor.id, title: "Maize 1kg", price: 4500, currency: "KES", quantityAvailable: 10 });
  return l;
};
const row = (id) => store.find("listings", (x) => x.id === id);

// ---------------------------------------------------------------------------
await test("a draft can be repriced with no reason, and nothing is logged", () => {
  const l = mk();
  const out = listings.updateListing(l.id, { price: 5000 });
  assert.equal(out.price, 5000, "the edit landed");
  assert.equal(store.filter("listingRevisions", (r) => r.listingId === l.id).length, 0, "a draft has no public record to explain itself to");
});

await test("descriptive edits are free after publishing", () => {
  const l = mk();
  listings.transitionListing(l.id, "active");
  const out = listings.updateListing(l.id, {
    description: "Freshly milled, 2kg bags",
    media: ["/api/media/file/upl_1", "/api/media/file/upl_2"],
    quantityAvailable: 3,
    locationName: "Kikuyu market"
  });
  assert.equal(out.quantityAvailable, 3, "stock moved with no friction");
  assert.equal(out.media.length, 2, "the photo was swapped");
  assert.equal(out.locationName, "Kikuyu market");
  assert.equal(store.filter("listingRevisions", (r) => r.listingId === l.id).length, 0,
    "descriptive edits are not money events");
});

await test("a published price change demands a reason and states it", () => {
  const l = mk();
  listings.transitionListing(l.id, "active");
  let msg = null;
  try { listings.updateListing(l.id, { price: 6000 }); } catch (e) { msg = String(e.message); }
  assert.match(msg ?? "", /say why the price is changing/, `got: ${msg}`);
  // too short to mean anything
  let msg2 = null;
  try { listings.updateListing(l.id, { price: 6000, reason: "fix" }); } catch (e) { msg2 = String(e.message); }
  assert.match(msg2 ?? "", /say why/, "three letters is not a reason");
  // and with one it applies
  const out = listings.updateListing(l.id, { price: 6000, reason: "milling costs rose this week" });
  assert.equal(out.price, 6000);
});

await test("the revision row holds the true before-value, not the new one", () => {
  const l = mk();
  listings.transitionListing(l.id, "active");
  listings.updateListing(l.id, { price: 5200, reason: "supplier raised the bag price" });
  const [rev] = listings.revisionsFor(l.id);
  assert.equal(rev.field, "price");
  assert.equal(rev.before, 4500, "store.update returns the live row, so the pre-image had to be snapshotted first");
  assert.equal(rev.after, 5200);
  assert.equal(rev.reason, "supplier raised the bag price");
  assert.ok(rev.at && rev.id, "timestamped and addressable");
});

await test("re-submitting an unchanged price is not an event", () => {
  const l = mk();
  listings.transitionListing(l.id, "active");
  const out = listings.updateListing(l.id, { price: 4500 });
  assert.equal(out.price, 4500);
  assert.equal(store.filter("listingRevisions", (r) => r.listingId === l.id).length, 0,
    "no reason demanded, no row written — otherwise the gate trains people to type noise");
});

await test("currency, per-unit label and minimum are money fields too", () => {
  for (const patch of [{ currency: "USD" }, { unitLabel: "5kg bag" }, { minOrderQuantity: 5 }]) {
    const l = mk();
    listings.transitionListing(l.id, "active");
    assert.throws(() => listings.updateListing(l.id, patch), /say why/, `${Object.keys(patch)[0]} must need a reason`);
    const key = Object.keys(patch)[0];
    const out = listings.updateListing(l.id, { ...patch, reason: "switched terms for bulk buyers" });
    assert.equal(out[key], patch[key]);
    assert.equal(listings.revisionsFor(l.id)[0].field, key);
  }
});

await test("an order keeps the price it was quoted at, whatever the offer says now", () => {
  const l = mk();
  listings.transitionListing(l.id, "active");
  const order = orders.createOrder({ listingId: l.id, buyerId: buyer.id, quantity: 2 });
  assert.equal(order.unitPrice, 4500);
  assert.equal(order.total ?? order.totals.total, 9000);
  listings.updateListing(l.id, { price: 9000, reason: "drought pricing" });
  const again = orders.createOrder({ listingId: l.id, buyerId: buyer.id, quantity: 2 });
  assert.equal(order.unitPrice, 4500, "the placed order was NOT retro-billed");
  assert.equal(again.unitPrice, 9000, "the new order sees the new price");
});

await test("paused and sold-out offers were published once, so they still explain themselves", () => {
  for (const status of ["paused", "sold_out"]) {
    const l = mk();
    listings.transitionListing(l.id, "active");
    listings.transitionListing(l.id, status);
    assert.throws(() => listings.updateListing(l.id, { price: 7000 }), /say why/, status);
  }
});

await test("status still cannot be smuggled through the edit endpoint", () => {
  const l = mk();
  listings.transitionListing(l.id, "active");
  const out = listings.updateListing(l.id, { status: "draft", reason: "trying to dodge the rule" });
  assert.equal(out.status, "active", "a PATCH cannot walk the lifecycle backwards, even with a reason");
});

await test("archived means archived: money terms are not the way out", () => {
  const l = mk();
  listings.transitionListing(l.id, "active");
  listings.transitionListing(l.id, "archived");
  // archiving is terminal for the offer; a reason-based edit must not resurrect it
  const out = listings.updateListing(l.id, { price: 100, reason: "attempted revival" });
  assert.equal(out.status, "archived", "the record still says what it is");
  assert.equal(out.price, 100, "the edit is allowed, and it is on the record too");
  assert.equal(listings.revisionsFor(l.id).length, 1);
});

await test("the policy is readable as data, so UI and server cannot drift", () => {
  assert.deepEqual(listings.MONEY_FIELDS, ["price", "currency", "unitLabel", "minOrderQuantity"]);
  for (const f of ["media", "quantityAvailable", "description", "locationName"]) {
    assert.ok(listings.DESCRIPTIVE_FIELDS.includes(f), `${f} must be free to edit`);
  }
  assert.ok(!listings.DESCRIPTIVE_FIELDS.includes("status"), "status is not an editable field at all");
});

await test("HTTP: the history is owner-visible and nobody else's", async () => {
  const { default: app } = await import("../src/index.js");
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (p, method = "GET", body, tok) => {
    const r = await fetch(`http://127.0.0.1:${port}${p}`, {
      method, headers: { "content-type": "application/json", ...(tok ? { authorization: `Bearer ${tok}` } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const sellerTok = auth.issueSession(seller.id).token;
  const l = mk();
  listings.transitionListing(l.id, "active");
  const anon = await call(`/api/listings/${l.id}/revisions`);
  assert.equal(anon.status, 401, "an offer's price history is not public data");
  const nosy = await call(`/api/listings/${l.id}/revisions`, "GET", undefined, auth.issueSession(stranger.id).token);
  assert.ok([403, 404].includes(nosy.status), `a stranger gets a refusal, got ${nosy.status}`);
  const mine = await call(`/api/listings/${l.id}/revisions`, "GET", undefined, sellerTok);
  assert.equal(mine.status, 200);
  assert.ok(Array.isArray(mine.body.revisions));
  const short = await call(`/api/listings/${l.id}`, "PATCH", { price: 8000 }, sellerTok);
  assert.equal(short.status, 400, "the reason gate is on the route, not only in the domain");
  assert.match(short.body.error, /say why/);
  const ok = await call(`/api/listings/${l.id}`, "PATCH", { price: 8000, reason: "transport costs doubled" }, sellerTok);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.listing.price, 8000);
  assert.equal(ok.body.revisions.length, 1, "the PATCH response carries the record it just made");
  assert.equal(ok.body.revisions[0].before, 4500);
  assert.ok(Array.isArray(ok.body.moneyFields) && ok.body.moneyFields.includes("price"),
    "the client reads the locked set from the server, never re-declares it");
  assert.match(ok.body.note, /keep the price they were quoted at/, "and it says why this is safe to allow");
  // a descriptive edit needs no reason at all, over HTTP as well
  const pic = await call(`/api/listings/${l.id}`, "PATCH", { media: ["/api/media/file/upl_9"] }, sellerTok);
  assert.equal(pic.status, 200);
  assert.equal(pic.body.listing.media[0], "/api/media/file/upl_9");
  assert.equal(pic.body.revisions.length, 1, "and no extra row was written for a photo");
  srv.close();
});

console.log(`PASSED ${count} FAILED 0`);
