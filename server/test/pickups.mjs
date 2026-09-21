// ---------------------------------------------------------------------------
// PICKUPS — rider routing to onboarded shops. This pins the logistics half of
// the rider loop and the pay law that now governs it:
//   (1) routing, assignment, completion and the dispatchable origins are real
//       and unchanged;
//   (2) the per-pickup origin fee Decision 5 ended is GONE — a delivered
//       pickup is a count, not money, and a shop's settled trade pays the
//       onboarding agent nothing at all. Pay is KES 150 per approved visit
//       (tested in fieldAgent.mjs);
//   (3) the settlement writers that used to turn that fee into ledger money no
//       longer exist, and the rows they left are readable history.
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

// The HTTP sections are async, so this file uses the shared harness: `test`
// registers, `run()` executes in order and awaits each one. It previously
// carried a private `atest` for exactly that reason — one harness now says it
// once, for every file, instead of sixteen private workarounds.
const { test, step, run } = await import("./harness.mjs");
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
// THE COUNT — derived per completed pickup. Information, not pay.
// ---------------------------------------------------------------------------
test("the origin fee is gone: a delivered pickup is a count, and the writers are gone with it", () => {
  assert.equal(pickups.PICKUP_ORIGIN_FEE_KES, undefined, "no per-pickup fee constant");
  assert.equal(pickups.pickupOriginObligation, undefined, "nothing owes an origin fee");
  assert.equal(pickups.requestPickupFeeSettlement, undefined, "no writer can mint pickup-fee money");
  assert.equal(pickups.confirmPickupFeeSettlement, undefined, "no writer can confirm pickup-fee money");

  const stats = pickups.pickupOriginStats(onboarder.id);
  assert.equal(stats.pickupCount, 1, "one delivered pickup from their shop — counted");
  assert.equal(stats.currency, null, "and it carries no currency, because it is not money");
  assert.equal(stats.originFeeKes, undefined, "no KES figure is served");
  assert.match(stats.note, /not pay/i, "the note says plainly that this is not pay");

  // The delivering rider is not the onboarding agent, so the count is not theirs.
  assert.equal(pickups.pickupOriginStats(rider.id).pickupCount, 0);
});

test("multiple pickups accumulate as a count, and only the active claimant is credited", () => {
  pickups.assignPickup({
    originVendorId: vendor.id, riderId: rider.id,
    destinationTown: "Kisumu", receiverName: "Buyer Two", receiverPhone: "0713 000000"
  }).id;
  const p2 = store.filter("pickups", (p) => p.status === "assigned")[0];
  pickups.completePickup(p2.id, rider.id);

  const stats = pickups.pickupOriginStats(onboarder.id);
  assert.equal(stats.pickupCount, 2, "two delivered pickups, counted");
  assert.equal(stats.shops, 1, "one shop onboarded");
  assert.equal(stats.originFeeKes, undefined, "and still no money attached");
});

// ---------------------------------------------------------------------------
// (2) THE ANTI-THROUGHPUT LAW, end-to-end: a shop's settled trade pays the
// onboarding agent NOTHING. Under the old economy KES 20,000 settled at this
// shop minted KES 150 of override for the agent who claimed it. Decision 5
// ended that: the agent is paid for the visit, once, flat.
// ---------------------------------------------------------------------------
test("settled orders at an onboarded shop pay the onboarding agent nothing", async () => {
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

  // The order really did settle — the rows are there to prove the point.
  assert.equal(store.filter("orders", (o) => o.status === "settled").length >= 1, true, "a real settled order exists");
  assert.equal(store.filter("ledgerTransactions", (t) => t.type === "order_payment" && t.status === "settled").length >= 1, true);

  // And it pays the onboarding agent nothing: no override economy exists.
  assert.equal(fa.overrideObligation, undefined, "the derived-percentage obligation is gone");
  assert.equal(fa.visitEarnings(onboarder.id).approvedKes, 0, "no approved visit, no pay — trade is not pay");
  assert.equal(store.filter("fieldVisits", (v) => v.agentId === onboarder.id).length, 0, "settling an order does not invent a visit");
});

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
test("API: assign, complete, and read the derived COUNT (no fee is served)", async () => {
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

    // The count is served at the renamed path, and it is a count.
    const stats = await call("/api/me/pickup-origins", "GET", undefined, A.token);
    assert.equal(stats.status, 200);
    assert.equal(typeof stats.body.stats.pickupCount, "number");
    assert.equal(stats.body.stats.originFeeKes, undefined, "no KES over HTTP either");
    // The fee-named route is retired, not left serving a zero.
    const retired = await call("/api/me/pickup-origin-fee", "GET", undefined, A.token);
    assert.equal(retired.status, 404, "the origin-fee route is gone");
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

// ---------------------------------------------------------------------------
// RIDERS — the dispatch directory, derived (never fabricated).
// ---------------------------------------------------------------------------
test("listRiders derives the directory: onboarding agent + known rider + self", () => {
  // At this point: `onboarder` actively claims the shop (onboarding agent),
  // `rider` has been assigned pickups (known rider). Add a third user who is
  // neither — they must NOT appear.
  const bystander = user("pk_bystander");
  const riders = pickups.listRiders({ selfId: onboarder.id });

  const byId = (id) => riders.find((r) => r.id === id);
  assert.ok(byId(onboarder.id), "the caller is listed");
  assert.equal(byId(onboarder.id).isSelf, true);
  assert.ok(byId(onboarder.id).reasons.includes("you"), "the caller is marked 'you'");
  assert.ok(byId(onboarder.id).reasons.includes("onboarding_agent"), "the caller is also an onboarding agent");
  assert.ok(byId(rider.id), "a known rider is listed");
  assert.ok(byId(rider.id).reasons.includes("rider"), "the known rider is marked 'rider'");
  assert.equal(byId(rider.id).isSelf, false);
  assert.ok(!byId(bystander.id), "a user who is neither agent nor rider is NOT listed");
  // Self sorts first.
  assert.equal(riders[0].id, onboarder.id, "self is first in the directory");
});

test("listRiders drops ids with no user row (no fabricated people)", () => {
  // An orphan riderId that points at no user must be dropped, not shown.
  store.insert('pickups', {
    id: 'pkp_orphan', originVendorId: vendor.id, riderId: 'usr_ghost',
    destinationTown: 'Nakuru', receiverName: 'X', receiverPhone: '07xx',
    status: 'assigned', createdAt: new Date().toISOString(), completedAt: null
  });
  const riders = pickups.listRiders({ selfId: onboarder.id });
  assert.ok(!riders.some((r) => r.id === 'usr_ghost'), 'orphan riderId is dropped');
});

test("API: a dispatcher can route to a DIFFERENT rider by id", async () => {
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
    const D = (await call("/api/auth/register", "POST", { handle: "pk_disp" + Date.now().toString(36), password: "a good passphrase" })).body;
    const R = (await call("/api/auth/register", "POST", { handle: "pk_ride" + Date.now().toString(36), password: "a good passphrase" })).body;

    // The directory lists both (the dispatcher as self, the rider as… the rider
    // will only appear once they've ridden; so first assign to them).
    const assigned = await call("/api/pickups", "POST", {
      originVendorId: vendor.id, riderId: R.user.id,
      destinationTown: "Nyeri", receiverName: "Routed Buyer", receiverPhone: "0716 000000"
    }, D.token);
    assert.equal(assigned.status, 201);
    assert.equal(assigned.body.pickup.riderId, R.user.id, "rider is the named person, not the dispatcher");
    assert.equal(assigned.body.pickup.assignedBy, D.user.id, "assignedBy is the dispatcher");

    const riders = await call("/api/pickups/riders", "GET", undefined, D.token);
    assert.equal(riders.status, 200);
    const list = riders.body.riders;
    assert.ok(list.some((r) => r.id === R.user.id), "the named rider now appears in the directory");
    assert.ok(list.some((r) => r.id === D.user.id && r.isSelf), "the dispatcher is listed as self");
  } finally {
    srv.close();
  }
});

// ---------------------------------------------------------------------------
// ORIGIN-FEE SETTLEMENT — REMOVED WITH THE FEE. Nothing can mint a
// `pickup_origin_fee` ledger entry any more; the history read stays so rows
// written before Decision 5 remain visible.
// ---------------------------------------------------------------------------
test("no pickup_origin_fee money can be written, and the history read still works", () => {
  // The deliveries are real and counted — derived from the rows, not hardcoded,
  // because the HTTP sections above deliver more of them (and did not used to
  // run at all, which is why this file once asserted a fixed 2).
  const delivered = store.filter("pickups", (p) => p.originVendorId === vendor.id && p.status === "delivered").length;
  assert.ok(delivered >= 2, `at least the two domain-test deliveries are real (found ${delivered})`);
  assert.equal(pickups.pickupOriginStats(onboarder.id).pickupCount, delivered, "the count is exactly the delivered rows at shops the agent claimed");
  assert.equal(
    store.filter("ledgerTransactions", (t) => t.type === "pickup_origin_fee").length,
    0,
    "not one pickup-fee ledger entry exists"
  );
  // The history collection is readable and empty — and stays empty.
  assert.deepEqual(pickups.listPickupFeeSettlements(onboarder.id), []);
});

// (Two tests stood here: one asserting the agent's settlement rows came back
// newest-first, and one asserting a request with no delivered pickups was
// refused with `no_activity`. Both tested the writers Decision 5 removed —
// there are no rows to order and no request to refuse. The refusal that
// replaces them is structural: the functions do not exist, asserted above.)

test("API: the pickup-fee writer routes are retired (404), the history read stays", async () => {
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
    const P = (await call("/api/auth/register", "POST", { handle: "pk_plainf" + Date.now().toString(36), password: "a good passphrase" })).body;
    // The history read is plain auth, and it is history: an array, empty here.
    const list = await call("/api/me/pickup-fee/settlements", "GET", undefined, P.token);
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.body.settlements));
    // The writer routes are retired — not gated, gone. A 403 would mean the
    // rail still exists and is only being withheld; a 404 says it does not.
    assert.equal((await call("/api/me/pickup-fee/settle", "POST", {}, P.token)).status, 404);
    assert.equal((await call("/api/ops/pickup-fee-settlements/x/confirm", "POST", {}, P.token)).status, 404);
    assert.equal((await call("/api/ops/pickup-fee-settlements/x/refuse", "POST", {}, P.token)).status, 404);
  } finally {
    srv.close();
  }
});

await run();
