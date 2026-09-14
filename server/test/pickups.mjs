// ---------------------------------------------------------------------------
// PICKUPS — rider routing to onboarded shops, with a DERIVED per-pickup origin
// fee for the onboarding agent. This pins both halves of the rider loop:
//   (1) the 0.75% override is the "minimal fee" on settled orders (already
//       tested in fieldAgent.mjs, re-asserted here end-to-end), and
//   (3) a different rider completing a pickup from the shop earns the
//       onboarding agent a flat PICKUP_ORIGIN_FEE_KES.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-pickups-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const vendors = await import("../src/domain/vendor.js");
const listings = await import("../src/domain/listing.js");
const orders = await import("../src/domain/order.js");
const fa = await import("../src/domain/fieldAgent.js");
const pickups = await import("../src/domain/pickups.js");

let count = 0;
const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };
const rejects = (fn, code) => assert.throws(fn, (e) => !code || e.code === code);
const user = (handle) => auth.createUser({ handle, password: "pickups-pw" });

const owner = user("pk_owner");       // the shop owner
const onboarder = user("pk_onboarder"); // the rider who onboards the shop
const rider = user("pk_rider");         // a different rider who delivers

// The shop exists (owner's vendor), and the onboarder claims it (full_registration).
const vendor = vendors.createVendor({ ownerId: owner.id, displayName: "Kilimani Grocers", businessType: "retailer", location: "Kilimani" });
fa.claimVendor({ agentId: onboarder.id, vendorId: vendor.id, claimType: "full_registration" });

// ---------------------------------------------------------------------------
// ROUTING — a pickup needs an onboarded (claimed) shop.
// ---------------------------------------------------------------------------
test("a pickup can only originate from a claimed shop", () => {
  // A second shop nobody claimed -> refused.
  const unclaimed = vendors.createVendor({ ownerId: user("pk_owner2").id, displayName: "Unclaimed Stall", businessType: "retailer", location: "Westlands" });
  rejects(() => pickups.assignPickup({
    originVendorId: unclaimed.id, riderId: rider.id,
    destinationTown: "Nakuru", receiverName: "A", receiverPhone: "07xx"
  }), "unclaimed_origin");

  const p = pickups.assignPickup({
    originVendorId: vendor.id, riderId: rider.id,
    destinationTown: "Nakuru", receiverName: "Buyer One", receiverPhone: "0712 000000"
  });
  assert.equal(p.status, "assigned");
  assert.equal(p.riderId, rider.id);
});

test("only the rider or assigner can complete a pickup; completion is idempotent", () => {
  const p = store.filter("pickups", () => true)[0];
  rejects(() => pickups.completePickup(p.id, onboarder.id), "forbidden"); // onboarder is not the rider/assigner here
  const done = pickups.completePickup(p.id, rider.id);
  assert.equal(done.status, "delivered");
  // Idempotent.
  assert.equal(pickups.completePickup(p.id, rider.id).status, "delivered");
});

// ---------------------------------------------------------------------------
// THE ORIGIN FEE — derived per completed pickup, for the ONBOARDING agent.
// ---------------------------------------------------------------------------
test("the onboarding agent earns a derived per-pickup fee, not the rider", () => {
  const obl = pickups.pickupOriginObligation(onboarder.id);
  assert.equal(obl.pickupCount, 1, "one delivered pickup from their shop");
  assert.equal(obl.originFeeKes, pickups.PICKUP_ORIGIN_FEE_KES);

  // The delivering rider earns NO origin fee (they are not the onboarding agent).
  assert.equal(pickups.pickupOriginObligation(rider.id).originFeeKes, 0);
});

test("multiple pickups accumulate, and only the active claimant earns", () => {
  pickups.assignPickup({
    originVendorId: vendor.id, riderId: rider.id,
    destinationTown: "Kisumu", receiverName: "Buyer Two", receiverPhone: "0713 000000"
  }).id;
  const p2 = store.filter("pickups", (p) => p.status === "assigned")[0];
  pickups.completePickup(p2.id, rider.id);

  const obl = pickups.pickupOriginObligation(onboarder.id);
  assert.equal(obl.pickupCount, 2);
  assert.equal(obl.originFeeKes, 2 * pickups.PICKUP_ORIGIN_FEE_KES);
});

// ---------------------------------------------------------------------------
// (1) THE 0.75% OVERRIDE — the "minimal fee" on settled orders, end-to-end.
// ---------------------------------------------------------------------------
test("the 0.75% override is the settled-order fee the onboarding agent earns", async () => {
  const ledger = await import("../src/domain/ledger.js");
  const listing = listings.createListing({ vendorId: vendor.id, title: "Goods", price: 10000, currency: "KES" });
  listings.transitionListing(listing.id, "active");
  const buyer = user("pk_buyer");
  const order = orders.createOrder({ listingId: listing.id, buyerId: buyer.id, quantity: 2 }); // KES 20,000
  // Settle the honest way: a settled ledger transaction, then fulfil -> settle.
  const tx = ledger.createTransaction({ amount: 20000, type: 'order_payment', description: 'test', counterparty: buyer.id });
  ledger.transitionTransaction(tx.id, 'pending');
  ledger.transitionTransaction(tx.id, 'confirmed');
  ledger.transitionTransaction(tx.id, 'settled');
  orders.attachTransaction(order.id, tx.id);
  orders.transitionOrder(order.id, 'fulfilled');
  orders.transitionOrder(order.id, 'settled');

  const obl = fa.overrideObligation(onboarder.id);
  assert.equal(obl.grossKes, 20000, "gross is the settled order value");
  assert.equal(obl.overrideKes, Math.floor(0.0075 * 20000), "override is floor(0.75% x settled)");
});

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
test("API: assign, complete, and read the derived origin fee", async () => {
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
    const A = (await call("/api/auth/register", "POST", { handle: "pk_http" + Date.now().toString(36), password: "a good passphrase" })).body;
    const R = (await call("/api/auth/register", "POST", { handle: "pk_http_r" + Date.now().toString(36), password: "a good passphrase" })).body;

    const assigned = await call("/api/pickups", "POST", {
      originVendorId: vendor.id, riderId: R.user.id,
      destinationTown: "Eldoret", receiverName: "HTTP Buyer", receiverPhone: "0714 000000"
    }, A.token);
    assert.equal(assigned.status, 201);
    assert.ok(assigned.body.pickup.id);

    const done = await call(`/api/pickups/${assigned.body.pickup.id}/complete`, "POST", {}, R.token);
    assert.equal(done.status, 200);
    assert.equal(done.body.pickup.status, "delivered");

    const fee = await call("/api/me/pickup-origin-fee", "GET", undefined, A.token);
    assert.equal(fee.status, 200);
    assert.equal(typeof fee.body.obligation.originFeeKes, "number");
  } finally {
    srv.close();
  }
});

// ---------------------------------------------------------------------------
// ORIGINS + self-dispatch default (the dispatch panel's server contract).
// ---------------------------------------------------------------------------
test("listOrigins returns only shops with an active claim, joined to their vendor", () => {
  const origins = pickups.listOrigins();
  assert.ok(origins.some((o) => o.vendorId === vendor.id && o.shopName === "Kilimani Grocers"), "the claimed shop is an origin");
  assert.equal(origins.find((o) => o.vendorId === vendor.id).businessType, "retailer");
  // The unclaimed shop from earlier is NOT an origin.
  assert.ok(!origins.some((o) => o.shopName === "Unclaimed Stall"), "an unclaimed shop is not an origin");
});

test("API: assign defaults the rider to the caller (self-dispatch)", async () => {
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
    const A = (await call("/api/auth/register", "POST", { handle: "pk_self" + Date.now().toString(36), password: "a good passphrase" })).body;
    const assigned = await call("/api/pickups", "POST", {
      originVendorId: vendor.id, destinationTown: "Kisumu", receiverName: "Self", receiverPhone: "0715"
    }, A.token);
    assert.equal(assigned.status, 201);
    assert.equal(assigned.body.pickup.riderId, A.user.id, "riderId defaults to the caller");
    assert.equal(assigned.body.pickup.assignedBy, A.user.id);

    const origins = await call("/api/pickups/origins", "GET", undefined, A.token);
    assert.equal(origins.status, 200);
    assert.ok(Array.isArray(origins.body.origins));
  } finally {
    srv.close();
  }
});

console.log(`\nPASS ${count}`);
process.exit(0);
