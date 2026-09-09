import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-pt-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js"),
  auth = await import("../src/domain/auth.js"),
  s = await import("../src/domain/supply.js"),
  r = await import("../src/domain/requests.js"),
  m = await import("../src/domain/matching.js"),
  q = await import("../src/domain/quotes.js"),
  w = await import("../src/domain/workOrders.js"),
  sv = await import("../src/domain/supplyVerification.js"),
  t = await import("../src/domain/participantTrust.js");
let count = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log("PASS " + name);
};
const rejects = (fn, code) => assert.throws(fn, (e) => !code || e.code === code);
const user = (handle) =>
  auth.createUser({ handle, password: "participant-trust-password" });
const buyer = user("pt_buyer"),
  manufacturer = user("pt_maker"),
  agent = user("pt_agent"),
  newcomer = user("pt_newcomer"),
  reviewer = user("pt_reviewer"),
  other = user("pt_other");
process.env.BRIEF_REVIEWERS = reviewer.handle;
let seq = 0;

function enterprise(u, source) {
  return s.createEnterprise(u.id, {
    displayName: source ? "Sourcing Agent Co" : "Packaging Works",
    legalName: source ? "Agent Legal" : "Maker Legal",
    businessType: source ? "sourcing_agent" : "manufacturer",
    supplyRole: source ? "verified_sourcing_agent" : "direct_supplier",
    location: "Nairobi",
    serviceAreas: ["Nairobi"],
    publication: "public",
    firstCapability: {
      name: source ? "Sourced packaging" : "Branded boxes",
      productsServices: source ? ["Packaging sourcing"] : ["Branded boxes"],
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
const maker = enterprise(manufacturer, false),
  agt = enterprise(agent, true);
// A second capability for the maker (logistics), to prove capability-scoped trust.
const makerCap2 = s.createCapability(manufacturer.id, maker.id, {
  name: "Local delivery",
  category: "Logistics",
  supplyMode: "direct",
  capacityKind: "logistics",
  unit: "trips",
  leadTime: { minDays: 1, maxDays: 2 },
  serviceAreas: ["Nairobi"],
  operatingStatus: "active",
});
// A newcomer with a public enterprise but zero history.
const newEnt = s.createEnterprise(newcomer.id, {
  displayName: "Newcomer Supplies",
  businessType: "manufacturer",
  supplyRole: "direct_supplier",
  location: "Nairobi",
  serviceAreas: ["Nairobi"],
  publication: "public",
  firstCapability: {
    name: "New widgets",
    category: "Electronics",
    supplyMode: "direct",
    capacityKind: "production",
    unit: "pieces",
    leadTime: { minDays: 1, maxDays: 2 },
    serviceAreas: ["Nairobi"],
  },
});

function completeWork(source, quantity, opts = {}) {
  const u = source ? agent : manufacturer,
    pp = source ? agt : maker,
    capId = opts.capabilityId ?? pp.capabilities[0].id;
  let req = r.createRequest(buyer.id, {
    title: opts.title ?? "500 branded boxes",
    description: "Trust-history procurement",
    quantity,
    unit: "pieces",
    category: "Packaging",
    location: "Nairobi",
    deliveryLocation: "Buyer warehouse",
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
    idempotencyKey: `pt-quote-key-${++seq}-abcdefghijklmnopqrstuvwxyz`,
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
      specifications: "Branded boxes",
      ...(opts.estimatedCompletionDate
        ? { estimatedCompletionDate: opts.estimatedCompletionDate }
        : {}),
    },
  });
  const currentReq = r.getRequest(buyer.id, req.id);
  const accepted = q.mutate(buyer.id, quote.id, {
    action: "accept",
    revision: quote.revision,
    requestRevision: currentReq.revision,
    idempotencyKey: `pt-accept-key-${++seq}-abcdefghijklmnopqrstuvwxyz`,
  });
  let work = w.get(buyer.id, accepted.workOrderId);
  const act = (who, workRow, action, extra = {}) =>
    w.mutate(who.id, workRow.id, {
      action,
      revision: workRow.revision,
      agreementRevision: workRow.agreements.at(-1).revision,
      idempotencyKey: `pt-act-key-${++seq}-abcdefghijklmnopqrstuvwxyz`,
      ...extra,
    });
  work = act(buyer, work, "confirm_specifications");
  work = act(u, work, "confirm_specifications");
  if (opts.cancel === true) {
    // Cancellation is only available before work starts.
    work = act(u, work, "cancel", { note: "No longer needed" });
    return { req: r.getRequest(buyer.id, req.id), work };
  }
  work = act(u, work, "start");
  work = act(u, work, "ready");
  work = act(u, work, "dispatch");
  work = act(u, work, "deliver");
  work = act(buyer, work, "complete");
  return { req: r.getRequest(buyer.id, req.id), work };
}

// ---------------------------------------------------------------------------
// VERIFICATION — scoped, never "fully verified" (§3, §4)
// ---------------------------------------------------------------------------
test("A new participant is unverified and shows limited history", () => {
  const profile = t.trustProfile(newEnt.id);
  assert.equal(profile.verification.identity.status, "unverified");
  assert.equal(profile.history.limited, true);
  assert.equal(profile.signals.limited, true);
  assert.deepEqual(profile.signals.statements, ["Limited fulfillment history"]);
  assert.match(profile.signals.note, /new to Brief/);
});

function verify(kind, participantId, capabilityId = null) {
  const owner = store.lookup("vendors", participantId).ownerId;
  const ent = s.getEnterprise(owner, participantId);
  const rec = sv.submit(owner, participantId, {
    kind,
    capabilityId,
    participantRevision: ent.revision,
    evidence: [{ uploadId: "pt-evidence-" + kind, type: "capability_evidence", note: "" }],
    note: "review me",
  });
  return sv.review(reviewer.id, rec.id, {
    status: "under_review",
    revision: rec.revision,
  });
}
// (verification evidence requires real uploads; the scope distinction is the
//  point, so assert the summary shape on the raw standing instead.)

test("Verification states remain scoped — no aggregate 'fully verified' exists", () => {
  const profile = t.trustProfile(maker.id);
  assert.ok(!("fullyVerified" in profile));
  assert.ok(!("aggregate" in profile));
  assert.equal(profile.verification.identity.kind, "identity");
  assert.equal(profile.verification.businessType.kind, "business_type");
  assert.equal(profile.verification.sourcingRole.kind, "sourcing_role");
  // A direct supplier has no sourcing-role verification basis.
  assert.equal(profile.verification.sourcingRole.status, "unverified");
});

// ---------------------------------------------------------------------------
// ECONOMIC HISTORY + RELIABILITY SIGNALS (§5, §6, §7, §8, §9, §10)
// ---------------------------------------------------------------------------
completeWork(false, 500, { title: "500 branded boxes" });
completeWork(false, 1000, { title: "1000 branded boxes" });
completeWork(false, 750, { title: "750 branded boxes" });

test("Completed Work Orders derive economic history exactly once", () => {
  const h = t.economicHistory(maker.id);
  assert.equal(h.completedWorkOrders, 3);
  assert.equal(h.cancelledWorkOrders, 0);
  assert.equal(h.disputedWorkOrders, 0);
  assert.equal(h.limited, false);
  // Every completion is requester-confirmed by construction.
  assert.equal(h.requesterConfirmedCompletions, 3);
  assert.equal(h.businessesServed, 1);
  assert.equal(h.capabilitiesFulfilled, 1);
});

test("Derivation is idempotent — no stored trust row, no double counting", () => {
  const a = t.economicHistory(maker.id);
  const b = t.economicHistory(maker.id);
  assert.deepEqual(a, b);
  assert.equal(store.filter("trustSignals", () => true).length, 0);
  assert.equal(store.filter("participantTrust", () => true).length, 0);
});

test("Reliability signals are explainable statements, not scores", () => {
  const s = t.reliabilitySignals(maker.id);
  assert.equal(s.limited, false);
  assert.ok(s.statements.includes("3 Work Orders completed"));
  assert.ok(s.statements.includes("3 requester-confirmed completions"));
  assert.ok(s.statements.some((x) => /1 business/.test(x)));
  // No opaque numeric score anywhere.
  const str = JSON.stringify(s);
  assert.ok(!/reliabilityScore|"score"/.test(str));
});

test("Repeat relationships are counted from genuine returned business", () => {
  // Three procurements from the SAME buyer to the SAME maker => one repeat
  // relationship (the buyer returned >= 2 times).
  const h = t.economicHistory(maker.id);
  assert.equal(h.repeatRelationships, 1);
  const s = t.reliabilitySignals(maker.id);
  assert.ok(s.statements.includes("1 repeat procurement relationship"));
  assert.ok(s.statements.includes("Repeat business recorded"));
});

test("On-time is computed with the sample size visible, never collapsed", () => {
  const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const a = completeWork(false, 600, { title: "600 branded boxes on time", estimatedCompletionDate: future });
  const b = completeWork(false, 700, { title: "700 branded boxes late", estimatedCompletionDate: future });
  // The quote layer rejects a past agreed date, so simulate the late case by
  // rewriting the stored agreed date to the past AFTER completion (test-only
  // manipulation; the signal itself is a deterministic read of the two dates).
  const wo = store.lookup("workOrders", b.work.id);
  wo.agreements.at(-1).terms.estimatedCompletionDate =
    new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const h = t.economicHistory(maker.id);
  assert.equal(h.onTime.eligible, 2);
  assert.equal(h.onTime.completed, 1);
  const s = t.reliabilitySignals(maker.id);
  assert.ok(s.statements.includes("1 of 2 eligible Work Orders completed by the agreed date"));
});

test("A cancelled Work Order is excluded from completion history", () => {
  const before = t.economicHistory(maker.id).completedWorkOrders;
  completeWork(false, 800, { title: "800 branded boxes cancelled", cancel: true });
  const after = t.economicHistory(maker.id);
  assert.equal(after.completedWorkOrders, before);
  assert.equal(after.cancelledWorkOrders, 1);
});

// ---------------------------------------------------------------------------
// CAPABILITY-SCOPED TRUST (§11)
// ---------------------------------------------------------------------------
test("Trust is scoped to a capability, not one universal reputation", () => {
  const packaging = t.capabilityTrust(maker.id, maker.capabilities[0].id);
  const logistics = t.capabilityTrust(maker.id, makerCap2.id);
  assert.ok(packaging.history.completedWorkOrders >= 5);
  assert.equal(logistics.history.completedWorkOrders, 0);
  assert.equal(logistics.history.limited, true);
  assert.equal(logistics.signals.statements[0], "Limited fulfillment history");
  // Capability name resolves for the contextual label.
  assert.equal(packaging.capabilityName, "Branded boxes");
});

test("A participant's profile lists capability-scoped trust, not a rating", () => {
  const profile = t.trustProfile(maker.id);
  assert.ok(Array.isArray(profile.capabilities));
  const packaging = profile.capabilities.find(
    (c) => c.capabilityId === maker.capabilities[0].id,
  );
  assert.ok(packaging);
  assert.ok(packaging.history.completedWorkOrders >= 5);
  // No "4.8/5" anywhere.
  assert.ok(!/\d(\.\d)?\/5/.test(JSON.stringify(profile)));
});

// ---------------------------------------------------------------------------
// SOURCING AGENT DISTINCTION (§12)
// ---------------------------------------------------------------------------
completeWork(true, 900, { title: "900 sourced boxes" });

test("A sourcing agent's history is sourcing history, never a manufacturer claim", () => {
  const h = t.economicHistory(agt.id);
  assert.equal(h.completedWorkOrders, 1);
  const profile = t.trustProfile(agt.id);
  // The sourcing role is surfaced separately from identity/capability; there
  // is no "manufacturer" or "owns the goods" claim derived from history.
  assert.ok(!("manufacturer" in profile.history));
  assert.equal(profile.verification.sourcingRole.kind, "sourcing_role");
});

// ---------------------------------------------------------------------------
// PRIVACY (§20)
// ---------------------------------------------------------------------------
test("Trust aggregates never leak identities, prices or source relationships", () => {
  const profile = t.trustProfile(maker.id);
  const str = JSON.stringify(profile);
  assert.ok(!str.includes(buyer.id));
  assert.ok(!str.includes("Buyer warehouse"));
  assert.ok(!/unitPriceMinor|totalMinor|CONFIDENTIAL/.test(str));
  assert.ok(!str.includes("sourcingFeeMinor"));
});

// ---------------------------------------------------------------------------
// MATCHING + QUOTE INTEGRATION (§17, §18)
// ---------------------------------------------------------------------------
test("Matches carry explainable trust context that never overrides capability fit", () => {
  const req = r.createRequest(buyer.id, {
    title: "More branded boxes",
    description: "Repeat order for trust test",
    quantity: 600,
    unit: "pieces",
    category: "Packaging",
    location: "Nairobi",
    intent: "submit",
  });
  r.changeRequestStatus(buyer.id, req.id, { status: "matching", revision: req.revision });
  const matches = m.list(buyer.id, req.id).matches;
  const makerMatch = matches.find((x) => x.participantId === maker.id);
  assert.ok(makerMatch);
  assert.ok(makerMatch.trust);
  assert.ok(makerMatch.trust.completedWorkOrders >= 5);
  assert.equal(makerMatch.trust.limited, false);
  assert.ok(Array.isArray(makerMatch.trust.statements));
});

test("Quotes carry participant trust context for comparison", () => {
  // Reuse the most recent completed work's accepted quote via a fresh request.
  const req = r.createRequest(buyer.id, {
    title: "Even more boxes",
    description: "Quote trust context test",
    quantity: 400,
    unit: "pieces",
    category: "Packaging",
    location: "Nairobi",
    intent: "submit",
  });
  r.changeRequestStatus(buyer.id, req.id, { status: "matching", revision: req.revision });
  const curReq = r.getRequest(buyer.id, req.id);
  const match = m.list(buyer.id, req.id).matches.find((x) => x.participantId === maker.id);
  const inv = q.requestQuote(buyer.id, match.id, {
    requestRevision: curReq.revision,
    matchRevision: match.revision,
    shareRequirements: true,
  });
  m.expressInterest(manufacturer.id, match.id, {
    requestRevision: curReq.revision,
    revision: match.revision,
  });
  const quote = q.start(manufacturer.id, inv.id, { revision: inv.revision });
  const submitted = q.mutate(manufacturer.id, quote.id, {
    action: "submit",
    revision: quote.revision,
    requestRevision: curReq.revision,
    idempotencyKey: `pt-quote2-key-${++seq}-abcdefghijklmnopqrstuvwxyz`,
    terms: {
      quotedQuantity: 400,
      unit: "pieces",
      unitPriceMinor: 1500,
      currency: "KES",
      deliveryCostMinor: 50000,
      otherCosts: [],
      productionLeadDays: 3,
      deliveryLeadDays: 1,
      sourceType: "direct",
    },
  });
  const view = q.get(buyer.id, submitted.id);
  assert.ok(view.participantTrust);
  assert.ok(view.participantTrust.completedWorkOrders >= 5);
});

// ---------------------------------------------------------------------------
// HISTORICAL IMMUTABILITY (§14)
// ---------------------------------------------------------------------------
test("Historical completion context survives a later profile change", () => {
  // A completed work order retains its relationship/economic facts even after
  // the enterprise changes its business type / display name.
  const before = t.economicHistory(maker.id);
  const ent = s.getEnterprise(manufacturer.id, maker.id);
  s.updateEnterprise(manufacturer.id, maker.id, {
    displayName: "Rebranded Packaging",
    businessType: "distributor",
    revision: ent.revision,
  });
  const after = t.economicHistory(maker.id);
  assert.equal(after.completedWorkOrders, before.completedWorkOrders);
  // The historical work orders still reference the original participant id.
  assert.ok(store.indexed("workOrders", "participantId", maker.id).length > 0);
});

console.log(`\nPASS ${count}`);

// --- HTTP API (spec §28: domain/API tests) ----------------------------------
{
  const appMod = await import("../src/index.js");
  const app = appMod.default;
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (pathName) => {
    const res = await fetch(`http://127.0.0.1:${port}${pathName}`);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  try {
    // Public trust is anonymous and privacy-safe.
    const profile = await call(`/api/public/enterprises/${maker.id}/trust`);
    assert.equal(profile.status, 200);
    assert.ok(profile.body.trust);
    assert.ok(profile.body.trust.history.completedWorkOrders >= 5);
    assert.ok(Array.isArray(profile.body.trust.signals.statements));
    assert.ok(!JSON.stringify(profile.body).includes(buyer.id));
    test("API: public trust profile is anonymous and privacy-safe", () => {});

    const cap = await call(
      `/api/public/enterprises/${maker.id}/capabilities/${maker.capabilities[0].id}/trust`,
    );
    assert.equal(cap.status, 200);
    assert.ok(cap.body.trust.capabilityName);
    test("API: capability-scoped trust is public", () => {});

    // A non-existent participant is an honest 404, not an empty profile.
    const missing = await call(`/api/public/enterprises/nonexistent-id/trust`);
    assert.equal(missing.status, 404);
    test("API: unknown participant is a 404", () => {});
  } finally {
    srv.close();
  }
}

console.log(`\nPASS ${count}`);
