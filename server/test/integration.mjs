import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-integration-"));
process.env.BRIEF_DATA_DIR = dir;

// The complete economic graph: Request → Match → Quote → Work Order →
// Completion → Repeat Procurement → Trust/Economic History → Payment.
const { store } = await import("../src/store.js"),
  auth = await import("../src/domain/auth.js"),
  s = await import("../src/domain/supply.js"),
  r = await import("../src/domain/requests.js"),
  m = await import("../src/domain/matching.js"),
  q = await import("../src/domain/quotes.js"),
  w = await import("../src/domain/workOrders.js"),
  p = await import("../src/domain/procurement.js"),
  t = await import("../src/domain/participantTrust.js"),
  wp = await import("../src/domain/workPayment.js");

let count = 0;
const step = (n, name, fn) => {
  fn();
  count++;
  console.log(`PASS step ${n}: ${name}`);
};
const user = (handle) =>
  auth.createUser({ handle, password: "integration-password" });
const buyer = user("int_buyer"),
  agent = user("int_agent"),
  direct = user("int_direct"),
  outsider = user("int_outsider");
let seq = 0;

// Step 1 + 2: a sourcing-agent business with a sourcing capability.
const agentEnt = s.createEnterprise(agent.id, {
  displayName: "Integrated Sourcing Co",
  businessType: "sourcing_agent",
  supplyRole: "verified_sourcing_agent",
  location: "Nairobi",
  serviceAreas: ["Nairobi"],
  publication: "public",
  firstCapability: {
    name: "Sourced packaging",
    productsServices: ["Packaging sourcing", "Boxes"],
    category: "Packaging",
    supplyMode: "source",
    capacityKind: "sourcing_access",
    typicalCapacity: 50000,
    minimumQuantity: 100,
    maximumQuantity: 100000,
    unit: "pieces",
    leadTime: { minDays: 2, maxDays: 5 },
    serviceAreas: ["Nairobi"],
  },
});

function createRequest(title, quantity, description) {
  const req = r.createRequest(buyer.id, {
    title,
    description,
    quantity,
    unit: "pieces",
    category: "Packaging",
    location: "Nairobi",
    deliveryLocation: "Buyer warehouse, Nairobi",
    requiredBy: new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10),
    specifications: { material: "Corrugated" },
    visibility: "private",
    intent: "submit",
  });
  return r.changeRequestStatus(buyer.id, req.id, {
    status: "matching",
    revision: req.revision,
  });
}

function quoteAndAccept(req) {
  const match = m
    .list(buyer.id, req.id)
    .matches.find((x) => x.participantId === agentEnt.id);
  assert.ok(match, "sourcing-agent match must exist");
  const inv = q.requestQuote(buyer.id, match.id, {
    requestRevision: req.revision,
    matchRevision: match.revision,
    shareRequirements: true,
  });
  m.expressInterest(agent.id, match.id, {
    requestRevision: req.revision,
    revision: match.revision,
  });
  let quote = q.start(agent.id, inv.id, { revision: inv.revision });
  quote = q.mutate(agent.id, quote.id, {
    action: "submit",
    revision: quote.revision,
    requestRevision: req.revision,
    idempotencyKey: `int-q-${++seq}-abcdefghijklmnopqrstuvwxyz`,
    terms: {
      quotedQuantity: req.quantity,
      unit: "pieces",
      unitPriceMinor: 1400,
      currency: "KES",
      deliveryCostMinor: 3000,
      sourcingFeeMinor: 20000,
      otherCosts: [{ label: "Inspection", amountMinor: 500 }],
      productionLeadDays: 3,
      deliveryLeadDays: 2,
      sourceType: "sourcing",
      specifications: "Branded corrugated boxes",
    },
  });
  const curReq = r.getRequest(buyer.id, req.id);
  const accepted = q.mutate(buyer.id, quote.id, {
    action: "accept",
    revision: quote.revision,
    requestRevision: curReq.revision,
    idempotencyKey: `int-a-${++seq}-abcdefghijklmnopqrstuvwxyz`,
  });
  return w.get(buyer.id, accepted.workOrderId);
}

function completeWork(work) {
  const act = (who, workRow, action) =>
    w.mutate(who.id, workRow.id, {
      action,
      revision: workRow.revision,
      agreementRevision: workRow.agreements.at(-1).revision,
      idempotencyKey: `int-w-${++seq}-abcdefghijklmnopqrstuvwxyz`,
    });
  let cur = act(buyer, work, "confirm_specifications");
  cur = act(agent, cur, "confirm_specifications");
  cur = act(agent, cur, "start");
  cur = act(agent, cur, "ready");
  cur = act(agent, cur, "dispatch");
  cur = act(agent, cur, "deliver");
  cur = act(buyer, cur, "complete");
  return cur;
}

// ---------------------------------------------------------------------------
// Steps 1–13: the forward chain through completion + trust.
// ---------------------------------------------------------------------------
const req1 = createRequest("500 branded boxes", 500, "First integrated procurement");
const work1 = completeWork(quoteAndAccept(req1));

step(13, "Trust/Economic History receives the completion facts", () => {
  const h = t.economicHistory(agentEnt.id);
  assert.equal(h.completedWorkOrders, 1);
  assert.equal(h.requesterConfirmedCompletions, 1);
  assert.equal(h.businessesServed, 1);
  assert.equal(h.capabilitiesFulfilled, 1);
  assert.equal(h.limited, false);
});

// ---------------------------------------------------------------------------
// Steps 14–16: repeat procurement.
// ---------------------------------------------------------------------------
let ref, repeatResult;
step(14, "'Request again' creates a brand-new prefilled Request", () => {
  ref = p.list(buyer.id)[0];
  assert.ok(ref, "a procurement reference must exist after completion");
  repeatResult = p.repeat(buyer.id, ref.id, {
    intent: "submit",
    supplierStrategy: "previous",
    quantity: 800,
    idempotencyKey: `int-repeat-${++seq}-abcdefghijklmnopqrstuvwxyz`,
  });
  assert.ok(repeatResult.request.id);
  assert.notEqual(repeatResult.request.id, req1.id);
  assert.equal(repeatResult.request.quantity, 800);
});

step(16, "The original Request and Work Order remain immutable", () => {
  assert.equal(r.getRequest(buyer.id, req1.id).status, "completed");
  assert.equal(store.lookup("workOrders", work1.id).status, "completed");
  assert.equal(p.list(buyer.id)[0].sourceWorkOrderId, work1.id);
  // The original request's title/quantity are untouched by the repeat.
  assert.equal(r.getRequest(buyer.id, req1.id).quantity, 500);
});

// ---------------------------------------------------------------------------
// Steps 17–18: the repeat flows through matching, and the previous supplier
// is surfaced as a match (the requester-selected shortlist integration).
// ---------------------------------------------------------------------------
const req2 = r.changeRequestStatus(buyer.id, repeatResult.request.id, {
  status: "matching",
  revision: repeatResult.request.revision,
});

step(17, "Matching on the repeat surfaces the previous (selected) supplier", () => {
  const matches = m.list(buyer.id, req2.id).matches;
  const prev = matches.find((x) => x.participantId === agentEnt.id);
  assert.ok(prev, "the previously selected supplier must appear as a match");
  assert.ok(prev.requesterSelected === true, "it must be flagged requester-selected");
  assert.ok(
    prev.matchReasons.some((x) => /selected this participant/.test(x.text)) ||
      prev.matchReasons.some((x) => /You selected/.test(x.text)),
    "an explainable requester-selected reason must be present",
  );
});

let req2Work;
step(18, "A new quote is created and accepted against the repeat request", () => {
  const match = m.list(buyer.id, req2.id).matches.find((x) => x.participantId === agentEnt.id);
  const inv = q.requestQuote(buyer.id, match.id, {
    requestRevision: req2.revision,
    matchRevision: match.revision,
    shareRequirements: true,
  });
  m.expressInterest(agent.id, match.id, { requestRevision: req2.revision, revision: match.revision });
  let quote = q.start(agent.id, inv.id, { revision: inv.revision });
  quote = q.mutate(agent.id, quote.id, {
    action: "submit",
    revision: quote.revision,
    requestRevision: req2.revision,
    idempotencyKey: `int-q2-${++seq}-abcdefghijklmnopqrstuvwxyz`,
    terms: {
      quotedQuantity: 800,
      unit: "pieces",
      unitPriceMinor: 1350,
      currency: "KES",
      deliveryCostMinor: 4000,
      sourcingFeeMinor: 25000,
      otherCosts: [],
      productionLeadDays: 3,
      deliveryLeadDays: 2,
      sourceType: "sourcing",
      specifications: "Branded corrugated boxes",
    },
  });
  assert.ok(quote.id);
  const curReq = r.getRequest(buyer.id, req2.id);
  const accepted = q.mutate(buyer.id, quote.id, {
    action: "accept",
    revision: quote.revision,
    requestRevision: curReq.revision,
    idempotencyKey: `int-a2-${++seq}-abcdefghijklmnopqrstuvwxyz`,
  });
  req2Work = w.get(buyer.id, accepted.workOrderId);
  assert.ok(req2Work.id);
});

// ---------------------------------------------------------------------------
// Steps 19–23: payment on the SECOND work order (the repeat's new work order).
// ---------------------------------------------------------------------------

step(19, "Payment intent derives from the accepted agreement totalMinor", () => {
  const breakdown = wp.agreementBreakdown(req2Work.id);
  // 800 * 1350 = 1,080,000 minor source cost + 4,000 logistics + 25,000 fee
  assert.equal(breakdown.sourceCostMinor, 1080000);
  assert.equal(breakdown.sourcingFeeMinor, 25000);
  assert.equal(breakdown.logisticsCostMinor, 4000);
  assert.equal(breakdown.totalMinor, 1109000);
  assert.equal(breakdown.sourcingMode, "sourcing");

  const { intent } = wp.createIntent({ workOrderId: req2Work.id, payerId: buyer.id, phone: "0722000111" });
  assert.equal(intent.amountMinor, 1109000);
  assert.equal(intent.amount, 11090); // whole KES
  assert.equal(intent.payeeId, agent.id);
  assert.equal(intent.status, "intent");
  assert.equal(store.all("ledgerTransactions").length, 0);
});

step(20, "Deterministic payment confirmation succeeds", () => {
  const intent = store.all("workPaymentIntents").find((x) => x.workOrderId === req2Work.id);
  store.update("workPaymentIntents", intent.id, { status: "authorized", providerRef: "int_CO_1" });
  const res = wp.confirmPayment({ providerRef: "int_CO_1", succeeded: true, amount: 11090, receipt: "INT-RX-1" });
  assert.equal(res.ok, true);
  assert.equal(res.intent.status, "confirmed");
});

step(21, "Exactly one append-only ledger entry and one settlement", () => {
  const txs = store.all("ledgerTransactions");
  assert.equal(txs.length, 1);
  assert.equal(txs[0].status, "settled");
  assert.equal(txs[0].metadata.workOrderId, req2Work.id);
  const settlements = store.all("workSettlements");
  assert.equal(settlements.length, 1);
  assert.equal(settlements[0].payeeId, agent.id);
  // A repeated confirmation is an idempotent no-op.
  const again = wp.confirmPayment({ providerRef: "int_CO_1", succeeded: true, amount: 11090, receipt: "INT-RX-1" });
  assert.equal(again.duplicate, true);
  assert.equal(store.all("ledgerTransactions").length, 1);
});

step(22, "Payment success does NOT complete the Work Order automatically", () => {
  assert.equal(w.get(buyer.id, req2Work.id).status, "created");
  // Complete it now, independently.
  completeWork(req2Work);
  assert.equal(w.get(buyer.id, req2Work.id).status, "completed");
});

step(23, "Work Order completion does NOT fabricate payment success", () => {
  // The payment was already confirmed; but completion itself never writes a
  // second ledger entry or settlement.
  assert.equal(store.all("ledgerTransactions").length, 1);
  assert.equal(store.all("workSettlements").length, 1);
  // A second work order completed (without payment) proves the independence:
  const req3 = createRequest("250 branded boxes", 250, "Third procurement, no payment");
  const work3 = completeWork(quoteAndAccept(req3));
  assert.equal(w.get(buyer.id, work3.id).status, "completed");
  assert.equal(store.all("ledgerTransactions").length, 1); // unchanged — completion wrote nothing financial
});

// ---------------------------------------------------------------------------
// Sourcing-agent continuity + immutability + privacy (§9, §16, §10).
// ---------------------------------------------------------------------------
step(24, "The sourcing agent remains correctly identified through the whole graph", () => {
  const trust = t.trustProfile(agentEnt.id);
  assert.equal(trust.verification.sourcingRole.kind, "sourcing_role");
  // Two completed sourcing Work Orders (work1 + req2Work + work3 = 3).
  assert.equal(trust.history.completedWorkOrders, 3);
  // No manufacturer/ownership claim is derived from sourcing history.
  assert.ok(!/manufacturer|factory price/i.test(JSON.stringify(trust)));
  // The payment breakdown preserves source + fee + logistics = total.
  const breakdown = wp.agreementBreakdown(req2Work.id);
  assert.equal(breakdown.totalMinor, breakdown.sourceCostMinor + breakdown.sourcingFeeMinor + breakdown.logisticsCostMinor);
});

step(25, "Private economic data never leaks to an unrelated business", () => {
  const txs = store.all("ledgerTransactions");
  assert.ok(txs.every((tx) => !JSON.stringify(tx).includes(buyer.id) || JSON.stringify(tx).includes(tx.counterparty)));
  // Outsider sees no procurement history, no work, no payments.
  assert.deepEqual(p.list(outsider.id), []);
  assert.deepEqual(wp.listPaymentsForUser(outsider.id), []);
  assert.equal(t.trustProfile(agentEnt.id).history.businessesServed >= 1, true);
});

console.log(`\nPASS ${count}`);
