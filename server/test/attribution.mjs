import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-at-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js"),
  auth = await import("../src/domain/auth.js"),
  att = await import("../src/domain/attribution.js"),
  s = await import("../src/domain/supply.js"),
  r = await import("../src/domain/requests.js"),
  m = await import("../src/domain/matching.js"),
  q = await import("../src/domain/quotes.js"),
  w = await import("../src/domain/workOrders.js"),
  vendors = await import("../src/domain/vendor.js"),
  listings = await import("../src/domain/listing.js"),
  orders = await import("../src/domain/order.js");
let count = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log("PASS " + name);
};
const user = (handle) => auth.createUser({ handle, password: "attribution-password" });

// ---------------------------------------------------------------------------
// CAPTURE — one row per member, first touch wins, never fabricated.
// ---------------------------------------------------------------------------
const alice = user("at_alice"),
  bob = user("at_bob"),
  carol = user("at_carol");

test("capture stores one provenance row per member", () => {
  const row = att.capture(alice.id, {
    partnerKey: "WEF",
    partnerName: "Women Enterprise Fund",
    programKey: "women-enterprise-2026",
    programName: "Women Enterprise 2026",
    cohortKey: "nairobi-west",
    cohortName: "Nairobi West",
    inviteCode: "ABC123",
    channel: "whatsapp",
    utmSource: "partner",
    utmMedium: "link"
  });
  assert.equal(row.userId, alice.id);
  assert.equal(row.partnerKey, "wef"); // keys are lowercased for grouping
  assert.equal(row.partnerName, "Women Enterprise Fund");
  assert.equal(row.cohortKey, "nairobi-west");
  assert.equal(row.inviteCode, "ABC123");
  assert.equal(att.acquisitionOf(alice.id).id, row.id);
});

test("capture is first-touch-wins — a later code cannot rewrite the origin", () => {
  const again = att.capture(alice.id, { partnerKey: "OTHER", inviteCode: "XYZ999" });
  assert.equal(again.partnerKey, "wef");
  assert.equal(again.inviteCode, "ABC123");
  assert.equal(store.filter("acquisitions", (a) => a.userId === alice.id).length, 1);
});

test("capture with no provenance returns null and stores nothing", () => {
  assert.equal(att.capture(bob.id, {}), null);
  assert.equal(att.acquisitionOf(bob.id), null);
});

test("provenanceChain omits absent hops and ends at the member", () => {
  const chain = att.provenanceChain(alice.id);
  assert.deepEqual(
    chain.map((c) => c.hop),
    ["partner", "program", "cohort", "invite", "member"]
  );
  assert.equal(chain[0].key, "wef");
  assert.equal(chain.at(-1).id, alice.id);
  // Bob has no provenance at all.
  assert.equal(att.provenanceChain(bob.id), null);
});

// ---------------------------------------------------------------------------
// ECONOMIC ACTIVITY — derived from real rows only.
// ---------------------------------------------------------------------------
// A completed work order (requester = carol, participant = a supplier) plus the
// repeat-procurement row it generates.
const supplier = user("at_supplier");
const supplierEnt = s.createEnterprise(supplier.id, {
  displayName: "Attribution Supplies",
  businessType: "manufacturer",
  supplyRole: "direct_supplier",
  location: "Nairobi",
  serviceAreas: ["Nairobi"],
  publication: "public",
  firstCapability: {
    name: "Attribution boxes",
    category: "Packaging",
    supplyMode: "direct",
    capacityKind: "production",
    unit: "pieces",
    leadTime: { minDays: 2, maxDays: 4 },
    serviceAreas: ["Nairobi"]
  }
});
let seq = 0;
function completeWork(requester, quantity) {
  const capId = supplierEnt.capabilities[0].id;
  let req = r.createRequest(requester.id, {
    title: "500 attribution boxes",
    description: "attribution economics",
    quantity,
    unit: "pieces",
    category: "Packaging",
    location: "Nairobi",
    deliveryLocation: "Buyer warehouse",
    requiredBy: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    specifications: { material: "Corrugated" },
    visibility: "private",
    intent: "submit"
  });
  req = r.changeRequestStatus(requester.id, req.id, { status: "matching", revision: req.revision });
  const match = m.list(requester.id, req.id).matches.find((x) => x.participantId === supplierEnt.id);
  const inv = q.requestQuote(requester.id, match.id, {
    requestRevision: req.revision,
    matchRevision: match.revision,
    shareRequirements: true
  });
  m.expressInterest(supplier.id, match.id, { requestRevision: req.revision, revision: match.revision });
  let quote = q.start(supplier.id, inv.id, { revision: inv.revision });
  quote = q.mutate(supplier.id, quote.id, {
    action: "submit",
    revision: quote.revision,
    requestRevision: req.revision,
    idempotencyKey: `at-quote-key-${++seq}-abcdefghijklmnopqrstuvwxyz`,
    terms: {
      quotedQuantity: quantity,
      unit: "pieces",
      unitPriceMinor: 1500,
      currency: "KES",
      deliveryCostMinor: 100000,
      sourcingFeeMinor: 0,
      otherCosts: [],
      productionLeadDays: 3,
      deliveryLeadDays: 1,
      sourceType: "direct",
      specifications: "Attribution boxes"
    }
  });
  const currentReq = r.getRequest(requester.id, req.id);
  const accepted = q.mutate(requester.id, quote.id, {
    action: "accept",
    revision: quote.revision,
    requestRevision: currentReq.revision,
    idempotencyKey: `at-accept-key-${++seq}-abcdefghijklmnopqrstuvwxyz`
  });
  let work = w.get(requester.id, accepted.workOrderId);
  const act = (who, row, action) =>
    w.mutate(who.id, row.id, {
      action,
      revision: row.revision,
      agreementRevision: row.agreements.at(-1).revision,
      idempotencyKey: `at-act-key-${++seq}-abcdefghijklmnopqrstuvwxyz`
    });
  work = act(requester, work, "confirm_specifications");
  work = act(supplier, work, "confirm_specifications");
  work = act(supplier, work, "start");
  work = act(supplier, work, "ready");
  work = act(supplier, work, "dispatch");
  work = act(supplier, work, "deliver");
  work = act(requester, work, "complete");
  return work;
}

// A fulfilled marketplace order (buyer = alice, seller = carol's vendor).
function fulfilledOrder(buyerId, sellerOwnerId, price) {
  const vendor = vendors.createVendor({ ownerId: sellerOwnerId, displayName: "Attribution Stall" });
  const listing = listings.createListing({ vendorId: vendor.id, title: "Attribution goods", price, currency: "KES" });
  listings.transitionListing(listing.id, "active");
  const order = orders.createOrder({ listingId: listing.id, buyerId, quantity: 1 });
  orders.transitionOrder(order.id, "fulfilled");
  return order;
}

test("economicActivityOf derives real work-order + order + procurement figures", () => {
  // Carol requests + receives completed work (KES 850 = 750 units + 100 delivery).
  completeWork(carol, 500);
  // Alice buys a fulfilled KES 1200 order from Carol's vendor.
  fulfilledOrder(alice.id, carol.id, 1200);
  // Bob has no activity at all.
  const carolAct = att.economicActivityOf(carol.id);
  assert.equal(carolAct.work.requested.count, 1);
  assert.equal(carolAct.work.requested.totalKes, 8500); // 500 * KES 15 + KES 1000 delivery, in major units
  assert.equal(carolAct.work.fulfilled.count, 0);
  assert.equal(carolAct.procurement.repeatPatterns, 1);
  assert.equal(carolAct.requests.created, 1);
  assert.equal(carolAct.orders.sold.count, 1);
  assert.equal(carolAct.orders.sold.totalKes, 1200);

  const supplierAct = att.economicActivityOf(supplier.id);
  assert.equal(supplierAct.work.fulfilled.count, 1);
  assert.equal(supplierAct.work.fulfilled.totalKes, 8500);

  const aliceAct = att.economicActivityOf(alice.id);
  assert.equal(aliceAct.orders.bought.count, 1);
  assert.equal(aliceAct.orders.bought.totalKes, 1200);
  assert.equal(aliceAct.verifiedCommercialKes, 1200);

  // A member with zero activity reports zero, plainly.
  const bobAct = att.economicActivityOf(bob.id);
  assert.equal(bobAct.verifiedCommercialKes, 0);
  assert.equal(bobAct.orders.bought.count, 0);
});

// ---------------------------------------------------------------------------
// COHORT + PARTNER AGGREGATION — derived, grouped, empty when nothing exists.
// ---------------------------------------------------------------------------
test("cohortSummary aggregates only members whose provenance matches", () => {
  att.capture(carol.id, { partnerKey: "WEF", programKey: "women-enterprise-2026", cohortKey: "nairobi-west" });
  att.capture(supplier.id, { partnerKey: "SACCO-X", cohortKey: "eldoret" });

  const wef = att.cohortSummary({ partnerKey: "WEF" });
  assert.equal(wef.members, 2); // alice + carol
  assert.equal(wef.verifiedCommercialKes, 8500 + 1200 + 1200); // carol's work + carol's sale + alice's purchase (gross)
  assert.equal(wef.workRequested, 1);
  assert.equal(wef.ordersSold, 1);
  assert.equal(wef.ordersBought, 1);
  assert.match(wef.note, /gross/i);

  const cohort = att.cohortSummary({ partnerKey: "WEF", cohortKey: "nairobi-west" });
  assert.equal(cohort.members, 2);
  assert.ok(Array.isArray(cohort.rows));
  assert.equal(cohort.rows.length, 2);
  // Drill-down enrichment: every row carries the member's identity so an
  // operator can see WHO the members are, not just anonymous ids.
  for (const row of cohort.rows) {
    assert.equal(typeof row.userId, "string");
    assert.equal(typeof row.handle, "string");
    assert.equal(typeof row.activity.verifiedCommercialKes, "number");
  }
  assert.ok(cohort.rows.some((row) => row.handle === "at_alice"));
  assert.ok(cohort.rows.some((row) => row.handle === "at_carol"));

  // An empty filter matches nobody — a report is always an explicit ask.
  assert.equal(att.cohortSummary({}).members, 0);
  // A partner nobody arrived through shows zero, never fabricated.
  assert.equal(att.cohortSummary({ partnerKey: "NOBODY" }).members, 0);
});

test("attributionReport groups by partner with derived totals", () => {
  const report = att.attributionReport();
  const wef = report.find((p) => p.partnerKey === "wef");
  assert.ok(wef);
  assert.equal(wef.members, 2);
  assert.equal(wef.partnerName, "Women Enterprise Fund");
  const sacco = report.find((p) => p.partnerKey === "sacco-x");
  assert.ok(sacco);
  assert.equal(sacco.members, 1);
  assert.equal(sacco.partnerName, "sacco-x"); // no display name -> falls back to key
});

// ---------------------------------------------------------------------------
// HTTP — own provenance is auth-scoped; the operator report is capability-gated.
// ---------------------------------------------------------------------------
{
  const appMod = await import("../src/index.js");
  const app = appMod.default;
  const srv = app.listen(0);
  const port = srv.address().port;
  const aliceToken = auth.login({ handle: "at_alice", password: "attribution-password" }).token;
  const bobToken = auth.login({ handle: "at_bob", password: "attribution-password" }).token;
  const call = async (pathName, method = "GET", body, token) => {
    const headers = { "content-type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${pathName}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  try {
    const mine = await call("/api/me/acquisition", "GET", undefined, aliceToken);
    assert.equal(mine.status, 200);
    assert.equal(mine.body.acquisition.partnerKey, "wef");
    assert.equal(mine.body.provenance[0].key, "wef");
    assert.ok(typeof mine.body.activity.verifiedCommercialKes === "number");
    count++;
    console.log("PASS API: a member reads their own provenance chain and activity");

    const none = await call("/api/me/acquisition", "GET", undefined, bobToken);
    assert.equal(none.status, 200);
    assert.equal(none.body.acquisition, null);
    assert.equal(none.body.provenance, null);
    count++;
    console.log("PASS API: a member with no provenance gets an honest null");

    const anon = await call("/api/me/acquisition");
    assert.equal(anon.status, 401);
    count++;
    console.log("PASS API: provenance requires authentication");

    const forbidden = await call("/api/ops/attribution", "GET", undefined, aliceToken);
    assert.equal(forbidden.status, 403);
    count++;
    console.log("PASS API: the operator report requires the moderate capability");

    const reviewer = user("at_reviewer");
    process.env.BRIEF_REVIEWERS = reviewer.handle;
    const reviewerToken = auth.login({ handle: "at_reviewer", password: "attribution-password" }).token;
    const report = await call("/api/ops/attribution", "GET", undefined, reviewerToken);
    assert.equal(report.status, 200);
    assert.ok(Array.isArray(report.body.report));
    assert.ok(report.body.report.some((p) => p.partnerKey === "wef"));
    const cohort = await call("/api/ops/attribution/cohort?partner=WEF", "GET", undefined, reviewerToken);
    assert.equal(cohort.status, 200);
    assert.equal(cohort.body.members, 2);
    count++;
    console.log("PASS API: a reviewer reads the per-partner report and a cohort slice");
  } finally {
    srv.close();
  }
}

console.log(`\nPASS ${count}`);
