import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-proc-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js"),
  auth = await import("../src/domain/auth.js"),
  s = await import("../src/domain/supply.js"),
  r = await import("../src/domain/requests.js"),
  m = await import("../src/domain/matching.js"),
  q = await import("../src/domain/quotes.js"),
  w = await import("../src/domain/workOrders.js"),
  p = await import("../src/domain/procurement.js");
let count = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log("PASS " + name);
};
const rejects = (fn, code) =>
  assert.throws(fn, (e) => !code || e.code === code);
const user = (handle) =>
  auth.createUser({ handle, password: "procurement-actual-password" });
const buyer = user("proc_buyer"),
  direct = user("proc_direct"),
  agent = user("proc_agent"),
  other = user("proc_other");
let seq = 0;

function enterprise(u, source) {
  return s.createEnterprise(u.id, {
    displayName: source ? "Proc agent" : "Proc supplier",
    businessType: source ? "sourcing_agent" : "manufacturer",
    supplyRole: source ? "verified_sourcing_agent" : "direct_supplier",
    location: "Nairobi",
    serviceAreas: ["Nairobi"],
    publication: "public",
    firstCapability: {
      name: "Branded cardboard boxes",
      productsServices: ["Cardboard boxes"],
      category: "Packaging",
      supplyMode: source ? "source" : "direct",
      capacityKind: source ? "sourcing_access" : "production",
      typicalCapacity: 50000,
      minimumQuantity: 100,
      maximumQuantity: 100000,
      unit: "pieces",
      leadTime: { minDays: 2, maxDays: 4 },
      serviceAreas: ["Nairobi"],
    },
  });
}
const pd = enterprise(direct, false),
  pa = enterprise(agent, true);

function completeWork(source = false, title, quantity) {
  const u = source ? agent : direct,
    pp = source ? pa : pd;
  let req = r.createRequest(buyer.id, {
    title,
    description: "Repeatable procurement",
    quantity,
    unit: "pieces",
    category: "Packaging",
    location: "Nairobi",
    deliveryLocation: "Buyer warehouse, Nairobi",
    requiredBy: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    specifications: { material: "Corrugated" },
    visibility: "private",
    intent: "submit",
  });
  req = r.changeRequestStatus(buyer.id, req.id, {
    status: "matching",
    revision: req.revision,
  });
  const match = m
    .list(buyer.id, req.id)
    .matches.find((x) => x.participantId === pp.id);
  const inv = q.requestQuote(buyer.id, match.id, {
    requestRevision: req.revision,
    matchRevision: match.revision,
    shareRequirements: true,
  });
  m.expressInterest(u.id, match.id, {
    requestRevision: req.revision,
    revision: match.revision,
  });
  let quote = q.start(u.id, inv.id, { revision: inv.revision });
  quote = q.mutate(u.id, quote.id, {
    action: "submit",
    revision: quote.revision,
    requestRevision: req.revision,
    idempotencyKey: `proc-quote-key-${++seq}-abcdefghijklmnopqrstuvwxyz`,
    terms: {
      quotedQuantity: quantity,
      unit: "pieces",
      unitPriceMinor: source ? 1400 : 1500,
      currency: "KES",
      deliveryCostMinor: 100000,
      sourcingFeeMinor: source ? 200000 : 0,
      otherCosts: [],
      productionLeadDays: 3,
      deliveryLeadDays: 1,
      sourceType: source ? "sourcing" : "direct",
      specifications: "Branded cardboard boxes",
    },
  });
  // Submitting the quote advanced the Request (matching -> quoted), so re-read
  // the current revision before accepting, exactly as a real requester would.
  const currentReq = r.getRequest(buyer.id, req.id);
  const accepted = q.mutate(buyer.id, quote.id, {
    action: "accept",
    revision: quote.revision,
    requestRevision: currentReq.revision,
    idempotencyKey: `proc-accept-key-${++seq}-abcdefghijklmnopqrstuvwxyz`,
  });
  let work = w.get(buyer.id, accepted.workOrderId);
  const act = (who, workRow, action) =>
    w.mutate(who.id, workRow.id, {
      action,
      revision: workRow.revision,
      agreementRevision: workRow.agreements.at(-1).revision,
      idempotencyKey: `proc-act-key-${++seq}-abcdefghijklmnopqrstuvwxyz`,
    });
  work = act(buyer, work, "confirm_specifications");
  work = act(u, work, "confirm_specifications");
  work = act(u, work, "start");
  work = act(u, work, "ready");
  work = act(u, work, "dispatch");
  work = act(u, work, "deliver");
  work = act(buyer, work, "complete");
  return { req: r.getRequest(buyer.id, req.id), work };
}

// --- 1. Completed Work Order creates a reusable procurement memory ----------
const completed = completeWork(false, "500 branded boxes", 500);
test("A completed Work Order records exactly one procurement reference", () => {
  const rows = p.list(buyer.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sourceWorkOrderId, completed.work.id);
  assert.equal(rows[0].sourceRequestId, completed.req.id);
  assert.equal(rows[0].title, "500 branded boxes");
  assert.equal(rows[0].lastQuantity, 500);
  assert.equal(rows[0].unit, "pieces");
  assert.equal(rows[0].lastSupplierType, "direct_supplier");
  assert.equal(rows[0].sourcingMode, "direct");
  assert.equal(rows[0].lastAgreedPriceLabel, "Previous agreed price");
  assert.equal(rows[0].lastAgreedPrice.totalMinor, 1500 * 500 + 100000);
  assert.ok(rows[0].lastFulfilledAt);
});

test("Record-completion is idempotent (no duplicate reference)", () => {
  p.recordCompletion(store.lookup("workOrders", completed.work.id));
  assert.equal(store.filter("procurements", (x) => x.sourceWorkOrderId === completed.work.id).length, 1);
});

test("Original Request and Work Order remain unchanged", () => {
  assert.equal(r.getRequest(buyer.id, completed.req.id).status, "completed");
  assert.equal(store.lookup("workOrders", completed.work.id).status, "completed");
  assert.equal(store.lookup("workOrders", completed.work.id).completedAt, completed.work.completedAt);
});

// --- 2. Repeat creates a NEW Request, never mutating the original -----------
test("Repeat creates a brand-new prefilled Request with a new id", () => {
  const ref = p.list(buyer.id)[0];
  const before = p.list(buyer.id)[0];
  const res = p.repeat(buyer.id, ref.id, { intent: "draft", idempotencyKey: "repeat-key-0000000001" });
  assert.notEqual(res.request.id, completed.req.id);
  assert.equal(res.request.title, "500 branded boxes");
  assert.equal(res.request.quantity, 500);
  assert.equal(res.request.status, "draft");
  // Original unchanged.
  assert.equal(p.list(buyer.id)[0].title, before.title);
  assert.equal(r.getRequest(buyer.id, completed.req.id).status, "completed");
});

test("Repeat overrides quantity, specifications, deadline and description", () => {
  const ref = p.list(buyer.id)[0];
  const res = p.repeat(buyer.id, ref.id, {
    quantity: 1000,
    specifications: { material: "Recycled" },
    requiredBy: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    description: "Bigger order this month",
    intent: "draft",
    idempotencyKey: "repeat-key-0000000002",
  });
  assert.equal(res.request.quantity, 1000);
  assert.equal(res.request.specifications.material, "Recycled");
  assert.equal(res.request.description, "Bigger order this month");
});

test("Repeat is idempotent under the same key (no duplicate Request)", () => {
  const ref = p.list(buyer.id)[0];
  const a = p.repeat(buyer.id, ref.id, { intent: "draft", idempotencyKey: "repeat-key-0000000003" });
  const b = p.repeat(buyer.id, ref.id, { intent: "draft", idempotencyKey: "repeat-key-0000000003" });
  assert.equal(a.request.id, b.request.id);
});

test("A changed payload with the same key is rejected, not silently overwritten", () => {
  const ref = p.list(buyer.id)[0];
  rejects(
    () => p.repeat(buyer.id, ref.id, { quantity: 999, idempotencyKey: "repeat-key-0000000003" }),
    "idempotency_conflict",
  );
});

// --- 3. Price history is clearly historical, never "current" ---------------
test("Price is labelled historical and never re-used automatically", () => {
  const ref = p.list(buyer.id)[0];
  assert.equal(ref.lastAgreedPriceLabel, "Previous agreed price");
  // No "current price" field exists on the reference.
  assert.equal(ref.currentPrice, undefined);
});

// --- 4. Deterministic repeat detection (spec §5) ---------------------------
test("Similar titled quantities collapse to the same pattern key", () => {
  assert.equal(
    p.patternKeyOf({ category: "Packaging", unit: "pieces", title: "500 branded boxes" }),
    p.patternKeyOf({ category: "Packaging", unit: "pieces", title: "1000 branded boxes" }),
  );
  assert.equal(
    p.patternKeyOf({ category: "Packaging", unit: "pieces", title: "750 branded boxes" }),
    p.patternKeyOf({ category: "Packaging", unit: "pieces", title: "500 branded boxes" }),
  );
});

test("One completed procurement never manufactures a typical quantity", () => {
  const single = p.list(buyer.id).find((x) => x.sourceWorkOrderId === completed.work.id);
  assert.ok(single);
  assert.equal(single.repeatCount, 1);
  assert.equal(single.recurring, false);
  assert.equal(single.typicalQuantity, null);
});

test("A second completed procurement of the same pattern marks it recurring with a typical quantity", () => {
  const second = completeWork(false, "1000 branded boxes", 1000);
  assert.equal(second.work.status, "completed");
  const rows = p.list(buyer.id).filter((x) => x.category === "Packaging");
  const recurring = rows.find((x) => x.recurring);
  assert.ok(recurring, "expected a recurring reference");
  assert.equal(recurring.repeatCount, 2);
  assert.deepEqual(recurring.typicalQuantity, { min: 500, max: 1000 });
});

// --- 5. Previous supplier relationship + availability (spec §7, §9) --------
test("An available previous supplier shows the historical relationship honestly", () => {
  const ref = p.list(buyer.id).find((x) => x.participantId === pd.id);
  const status = p.previousSupplierStatus(ref);
  assert.equal(status.available, true);
  assert.equal(status.label, "Previously fulfilled by this supplier");
  assert.equal(status.participant.displayName, "Proc supplier");
});

test("A paused previous supplier is reported unavailable, not hidden", () => {
  const ref = p.list(buyer.id).find((x) => x.participantId === pd.id);
  // Pause the enterprise.
  s.updateEnterprise(direct.id, pd.id, {
    operatingStatus: "paused",
    revision: store.lookup("vendors", pd.id).enterprise.revision,
  });
  const status = p.previousSupplierStatus(ref);
  assert.equal(status.available, false);
  assert.equal(status.label, "Previous supplier, currently unavailable");
  assert.match(status.reason, /paused|closed/i);
  // Restore for later tests.
  s.updateEnterprise(direct.id, pd.id, {
    operatingStatus: "active",
    revision: store.lookup("vendors", pd.id).enterprise.revision,
  });
});

// --- 6. Authorization / privacy (spec §19, §20) ----------------------------
test("Procurement history is owner-scoped and private", () => {
  // A business with no history sees an empty list, never another's rows.
  assert.deepEqual(p.list(other.id), []);
  const ref = p.list(buyer.id)[0];
  rejects(() => p.get(other.id, ref.id), "not_found");
  rejects(() => p.repeat(other.id, ref.id, {}), "not_found");
  rejects(() => p.prefill(other.id, ref.id), "not_found");
  // No requester auth at all is refused.
  rejects(() => p.list(null), "no_token");
});

test("A sourcing-agent completion preserves the sourcing/lodging/economic split without leaking the source", () => {
  const sourced = completeWork(true, "500 branded boxes", 500);
  assert.equal(sourced.work.status, "completed");
  const ref = p.list(buyer.id).find((x) => x.sourceWorkOrderId === sourced.work.id);
  assert.ok(ref, "expected a procurement reference for the sourcing completion");
  assert.equal(ref.sourcingMode, "sourcing");
  assert.equal(ref.lastSupplierType, "verified_sourcing_agent");
  assert.equal(ref.lastAgreedPrice.sourcingFeeMinor, 200000);
  assert.equal(ref.lastAgreedPrice.deliveryCostMinor, 100000);
  // The reference is the requester's own memory: the sourcing agent's private
  // source identity/notes never enter it.
  const str = JSON.stringify(ref);
  assert.ok(!str.includes("CONFIDENTIAL"));
  assert.ok(!str.includes("privateProvenance"));
  assert.ok(!str.includes("privateSource"));
});

// --- 7. Matching integration (spec §15) ------------------------------------
test("A previous fulfillment appears as an explainable match signal", () => {
  const fresh = r.createRequest(buyer.id, {
    title: "More branded boxes",
    description: "A repeat order of branded boxes",
    quantity: 600,
    unit: "pieces",
    category: "Packaging",
    location: "Nairobi",
    intent: "submit",
  });
  r.changeRequestStatus(buyer.id, fresh.id, { status: "matching", revision: fresh.revision });
  const matches = m.list(buyer.id, fresh.id).matches;
  const prev = matches.find((x) => x.participantId === pd.id);
  assert.ok(prev, "previous supplier should be among matches");
  assert.ok(prev.previousFulfillment);
  assert.match(prev.previousFulfillment.label, /Previously completed/i);
  assert.ok(prev.previousFulfillment.count >= 2);
});


// --- HTTP API (spec §24: domain/API tests) ----------------------------------
// The route layer is a thin, owner-scoped wrapper over the domain functions
// above. These checks prove the endpoints are registered, require auth, and
// perform the repeat without mutating history.
{
  const appMod = await import("../src/index.js");
  const app = appMod.default;
  const srv = app.listen(0);
  const port = srv.address().port;
  const auth = await import("../src/domain/auth.js");
  const loginToken = auth.login({
    handle: "proc_buyer",
    password: "procurement-actual-password",
  }).token;
  const call = async (pathName, method = "GET", body, token) => {
    const headers = { "content-type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${pathName}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  try {
    const anon = await call("/api/me/procurement");
    assert.equal(anon.status, 401);
    test("API: procurement list requires auth and is owner-scoped", () => {});

    const mine = await call("/api/me/procurement", "GET", undefined, loginToken);
    assert.equal(mine.status, 200);
    assert.ok(Array.isArray(mine.body.procurements));
    assert.ok(mine.body.procurements.length >= 3);
    assert.ok(
      mine.body.procurements.every(
        (x) => x.lastAgreedPriceLabel === "Previous agreed price",
      ),
    );
    test("API: procurement memory lists historical rows with the historical price label", () => {});

    const refs = mine.body.procurements;
    const target = refs.find((x) => x.category === "Packaging");
    const before = (await call("/api/me/requests", "GET", undefined, loginToken)).body.requests.length;
    const res = await call(
      `/api/me/procurement/${target.id}/repeat`,
      "POST",
      { intent: "draft", quantity: 2500, idempotencyKey: "http-repeat-key-000000001" },
      loginToken,
    );
    assert.equal(res.status, 201);
    assert.ok(res.body.request.id);
    assert.equal(res.body.request.quantity, 2500);
    const after = (await call("/api/me/requests", "GET", undefined, loginToken)).body.requests.length;
    assert.equal(after, before + 1);
    test("API: repeat creates exactly one new Request over HTTP", () => {});

    // Unauthorized repeat from another business is refused.
    const otherToken = auth.login({
      handle: "proc_other",
      password: "procurement-actual-password",
    }).token;
    const denied = await call(
      `/api/me/procurement/${target.id}/repeat`,
      "POST",
      { intent: "draft" },
      otherToken,
    );
    assert.equal(denied.status, 404);
    test("API: another business cannot repeat someone else's procurement", () => {});
  } finally {
    srv.close();
  }
}

console.log(`\nPASS ${count}`);
