import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-work-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js"),
  auth = await import("../src/domain/auth.js"),
  s = await import("../src/domain/supply.js"),
  r = await import("../src/domain/requests.js"),
  m = await import("../src/domain/matching.js"),
  q = await import("../src/domain/quotes.js"),
  w = await import("../src/domain/workOrders.js"),
  uploads = await import("../src/domain/upload.js");
let count = 0,
  seq = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log("PASS " + name);
};
const rejects = (fn, code) =>
  assert.throws(fn, (e) => !code || e.code === code);
const user = (handle) =>
  auth.createUser({ handle, password: "work-actual-test-password" });
const buyer = user("work_buyer"),
  direct = user("work_direct"),
  agent = user("work_agent"),
  other = user("work_other");
function enterprise(u, source) {
  return s.createEnterprise(u.id, {
    displayName: source ? "Work agent fixture" : "Work supplier fixture",
    businessType: source ? "sourcing_agent" : "manufacturer",
    supplyRole: source ? "verified_sourcing_agent" : "direct_supplier",
    location: "Nairobi",
    serviceAreas: ["Nairobi"],
    publication: "public",
    firstCapability: {
      name: "Branded linen bags",
      productsServices: ["Linen bags"],
      category: "Packaging",
      supplyMode: source ? "source" : "direct",
      capacityKind: source ? "sourcing_access" : "production",
      typicalCapacity: 20000,
      minimumQuantity: 100,
      maximumQuantity: 40000,
      unit: "pieces",
      leadTime: { minDays: 2, maxDays: 4 },
      serviceAreas: ["Nairobi"],
    },
  });
}
const pd = enterprise(direct, false),
  pa = enterprise(agent, true);
const ledgerBefore = store.all("ledgerTransactions").length,
  ordersBefore = store.all("orders").length;
function prepared(source = false, extraTerms = {}) {
  const u = source ? agent : direct,
    p = source ? pa : pd;
  let req = r.createRequest(buyer.id, {
    title: "5000 branded linen bags",
    description: "PRIVATE buyer description with contact",
    quantity: 5000,
    unit: "pieces",
    category: "Packaging",
    location: "Nairobi",
    deliveryLocation: "PRIVATE exact address",
    requiredBy: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    specifications: { material: "Linen" },
    visibility: "private",
    intent: "submit",
  });
  req = r.changeRequestStatus(buyer.id, req.id, {
    status: "matching",
    revision: req.revision,
  });
  const match = m
    .list(buyer.id, req.id)
    .matches.find((x) => x.participantId === p.id);
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
    idempotencyKey: `submitted-work-quote-${++seq}`,
    terms: {
      quotedQuantity: 5000,
      unit: "pieces",
      unitPriceMinor: source ? 1600 : 1800,
      currency: "KES",
      deliveryCostMinor: 200000,
      sourcingFeeMinor: source ? 300000 : 0,
      otherCosts: [{ label: "Printing setup", amountMinor: 10000 }],
      productionLeadDays: 4,
      deliveryLeadDays: 1,
      sourceType: source ? "sourcing" : "direct",
      specifications: "Printed linen bags matching shared requirements",
      terms: "Collection or delivery as mutually agreed",
      privateProvenance: {
        sourceParticipantId: source ? pd.id : null,
        reference: "CONFIDENTIAL SOURCE",
        notes: "PRIVATE SOURCE CONTACT",
      },
      ...extraTerms,
    },
  });
  return { req: r.getRequest(buyer.id, req.id), quote, u };
}
function accept(f) {
  const body = {
    action: "accept",
    revision: f.quote.revision,
    requestRevision: f.req.revision,
    idempotencyKey: `accept-work-order-${++seq}`,
  };
  const quote = q.mutate(buyer.id, f.quote.id, body);
  return {
    ...f,
    quote,
    acceptBody: body,
    work: w.get(buyer.id, quote.workOrderId),
  };
}
function act(u, work, action, extra = {}) {
  return w.mutate(u.id, work.id, {
    action,
    revision: work.revision,
    agreementRevision: work.agreements.at(-1).revision,
    idempotencyKey: `work-action-${++seq}-unique`,
    ...extra,
  });
}
const pending = prepared();
test("An unaccepted quote cannot create work", () =>
  rejects(
    () => w.createFromAccepted(buyer.id, pending.quote.id),
    "accepted_quote_required",
  ));
let d = accept(pending),
  a = accept(prepared(true));
test("Quote acceptance creates exactly one linked Work Order automatically", () => {
  assert.equal(d.work.status, "created");
  assert.equal(d.work.acceptedQuoteId, d.quote.id);
  assert.equal(r.getRequest(buyer.id, d.req.id).workOrderId, d.work.id);
  assert.equal(r.getRequest(buyer.id, d.req.id).status, "ready_for_work");
});
test("Duplicate creation and repeated acceptance retain one Work Order", () => {
  assert.equal(w.createFromAccepted(buyer.id, d.quote.id).id, d.work.id);
  const duplicate = q.mutate(buyer.id, d.quote.id, d.acceptBody);
  assert.equal(duplicate.workOrderId, d.work.id);
  assert.equal(
    store.indexed("workOrders", "acceptedQuoteId", d.quote.id).length,
    1,
  );
});
test("Work snapshots retain direct/source economics without manufacturing claims", () => {
  const terms = a.work.agreements[0].terms;
  assert.equal(terms.subtotalMinor, 8000000);
  assert.equal(terms.sourcingFeeMinor, 300000);
  assert.equal(terms.deliveryCostMinor, 200000);
  assert.equal(terms.totalMinor, 8510000);
  assert.equal(a.work.sourcingMode, "sourcing");
  assert.match(a.work.relationship, /Independent sourcing/);
  assert.ok(!a.work.participant.roleLabel.includes("Verified"));
});
test("Only requester and actual fulfilling account can access work", () => {
  assert.equal(w.get(direct.id, d.work.id).viewerRole, "participant");
  assert.equal(w.get(buyer.id, d.work.id).viewerRole, "requester");
  rejects(() => w.get(agent.id, d.work.id), "not_found");
  rejects(() => w.get(other.id, d.work.id), "not_found");
  rejects(() => w.createFromAccepted(direct.id, d.quote.id), "not_found");
  rejects(() => w.forRequest(other.id, d.req.id), "not_found");
  assert.equal(w.forParticipant(other.id).workOrders.length, 0);
});
test("Private source and original Request contacts are not shared by work", () => {
  const buyerView = JSON.stringify(w.get(buyer.id, a.work.id));
  assert.ok(!buyerView.includes("CONFIDENTIAL SOURCE"));
  assert.ok(!buyerView.includes("PRIVATE exact address"));
  assert.ok(!buyerView.includes("PRIVATE buyer"));
  assert.equal(
    w.get(agent.id, a.work.id).privateSource.sourceParticipantId,
    pd.id,
  );
});
test("Underlying Request, Quote and returned projections cannot mutate frozen agreement", () => {
  const quote = store.lookup("requestQuotes", d.quote.id),
    terms = quote.offers[0].terms,
    original = terms.unitPriceMinor;
  terms.unitPriceMinor = 1;
  const originalName = quote.offers[0].participant.displayName;
  quote.offers[0].participant.displayName = "Changed later";
  const req = store.lookup("requests", d.req.id);
  const material = req.specifications.material;
  req.specifications.material = "Changed later";
  const view = w.get(buyer.id, d.work.id);
  view.agreements[0].terms.unitPriceMinor = 2;
  view.originalAgreement.requirements.specifications.material =
    "Mutated projection";
  assert.equal(
    w.get(buyer.id, d.work.id).agreements[0].terms.unitPriceMinor,
    1800,
  );
  assert.equal(
    w.get(buyer.id, d.work.id).participant.displayName,
    originalName,
  );
  assert.equal(
    w.get(buyer.id, d.work.id).originalAgreement.requirements.specifications
      .material,
    "Linen",
  );
  terms.unitPriceMinor = original;
  quote.offers[0].participant.displayName = originalName;
  req.specifications.material = material;
});
test("No start, delivery or completion before appropriate confirmation and stages", () => {
  for (const action of ["start", "ready", "dispatch", "deliver"])
    rejects(() => act(direct, d.work, action), "invalid_transition");
  rejects(() => act(buyer, d.work, "complete"), "invalid_transition");
});
test("Requester confirmation opens specification confirmation, not work", () => {
  d.work = act(buyer, d.work, "confirm_specifications");
  assert.equal(d.work.status, "specification_pending");
  assert.ok(
    d.work.history.some(
      (e) => e.action === "specification_confirmation_started",
    ),
  );
  rejects(() => act(direct, d.work, "start"), "invalid_transition");
});
test("Both parties confirm the same agreement before work is confirmed", () => {
  d.work = act(direct, d.work, "confirm_specifications");
  assert.equal(d.work.status, "confirmed");
  assert.equal(d.work.confirmations.requester.agreementRevision, 1);
  assert.equal(d.work.confirmations.participant.agreementRevision, 1);
  assert.ok(d.work.confirmedAt);
});
test("Only participant starts work; Request advances without becoming completed", () => {
  rejects(() => act(buyer, d.work, "start"), "invalid_transition");
  d.work = act(direct, d.work, "start");
  assert.equal(d.work.status, "in_progress");
  assert.ok(d.work.startedAt);
  assert.equal(r.getRequest(buyer.id, d.req.id).status, "in_progress");
});
let progressBody;
test("Lost-response retries do not duplicate progress or milestones", () => {
  progressBody = {
    action: "progress",
    revision: d.work.revision,
    agreementRevision: 1,
    idempotencyKey: "progress-lost-response-key",
    note: "First production batch checked",
  };
  d.work = w.mutate(direct.id, d.work.id, progressBody);
  const retry = w.mutate(direct.id, d.work.id, progressBody);
  assert.equal(retry.revision, d.work.revision);
  assert.equal(
    retry.history.filter((e) => e.note === "First production batch checked")
      .length,
    1,
  );
});
test("Different payload cannot reuse a committed retry key", () =>
  rejects(
    () =>
      w.mutate(direct.id, d.work.id, {
        ...progressBody,
        note: "Changed value",
      }),
    "idempotency_conflict",
  ));
test("Stale tabs and stale agreement revisions are rejected", () => {
  rejects(
    () =>
      w.mutate(direct.id, d.work.id, {
        ...progressBody,
        idempotencyKey: "other-tab-different-key",
      }),
    "revision_conflict",
  );
  rejects(
    () =>
      w.mutate(direct.id, d.work.id, {
        action: "ready",
        revision: d.work.revision,
        agreementRevision: 0,
        idempotencyKey: "stale-agreement-revision",
      }),
    "agreement_conflict",
  );
});
test("Ordinary actions cannot edit price or skip arbitrary statuses", () => {
  rejects(
    () =>
      act(direct, d.work, "progress", {
        note: "Attempt",
        changes: { unitPriceMinor: 1 },
      }),
    "validation_error",
  );
  rejects(
    () =>
      w.mutate(direct.id, d.work.id, {
        action: "ready",
        revision: d.work.revision,
        agreementRevision: 1,
        idempotencyKey: "injected-status-jump",
        status: "completed",
      }),
    "validation_error",
  );
});
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
test("Shared accepted quote images remain frozen references without copying private evidence", () => {
  const sharedQuoteImage = uploads.saveUpload({
    ownerId: direct.id,
    bytes: png,
    purpose: "private_quote",
  }).upload;
  const privateQuoteImage = uploads.saveUpload({
    ownerId: direct.id,
    bytes: Buffer.concat([png, Buffer.from("privatequote")]),
    purpose: "private_quote",
  }).upload;
  const f = accept(
    prepared(false, {
      evidence: [
        {
          uploadId: sharedQuoteImage.id,
          kind: "product_specification",
          shareWithRequester: true,
        },
        {
          uploadId: privateQuoteImage.id,
          kind: "source_confirmation",
          shareWithRequester: false,
        },
      ],
    }),
  );
  assert.equal(f.work.acceptedEvidence.length, 1);
  assert.equal(f.work.acceptedEvidence[0].uploadId, sharedQuoteImage.id);
  assert.ok(!JSON.stringify(f.work).includes(privateQuoteImage.id));
  f.work.acceptedEvidence.length = 0;
  assert.equal(w.get(buyer.id, f.work.id).acceptedEvidence.length, 1);
});
const shared = uploads.saveUpload({
    ownerId: direct.id,
    bytes: png,
    purpose: "private_work",
  }).upload,
  secret = uploads.saveUpload({
    ownerId: direct.id,
    bytes: Buffer.concat([png, Buffer.from("secret")]),
    purpose: "private_work",
  }).upload;
test("Work evidence is private until explicitly shared through work", () => {
  assert.equal(w.canReadWorkEvidence(buyer.id, shared.id), false);
  d.work = act(direct, d.work, "add_evidence", {
    evidence: [
      {
        uploadId: shared.id,
        type: "production_progress",
        visibility: "shared",
        description: "Actual uploaded production test image",
      },
      {
        uploadId: secret.id,
        type: "source_confirmation",
        visibility: "private",
        description: "CONFIDENTIAL SOURCE IMAGE",
      },
    ],
  });
  assert.equal(w.canReadWorkEvidence(buyer.id, shared.id), true);
  assert.equal(w.canReadWorkEvidence(buyer.id, secret.id), false);
  assert.equal(w.get(buyer.id, d.work.id).evidence.length, 1);
  assert.equal(w.get(direct.id, d.work.id).evidence.length, 2);
  assert.equal(uploads.deleteUpload(shared.id, direct.id).status, 409);
  assert.ok(!uploads.listUploads(direct.id).some((e) => e.id === shared.id));
});
test("Private progress stays private in data and broad audit projections", () => {
  d.work = act(direct, d.work, "progress", {
    note: "PRIVATE NETWORK DETAIL",
    visibility: "private",
  });
  assert.ok(
    !JSON.stringify(w.get(buyer.id, d.work.id)).includes(
      "PRIVATE NETWORK DETAIL",
    ),
  );
  assert.ok(
    !JSON.stringify(store.all("auditLog")).includes("PRIVATE NETWORK DETAIL"),
  );
});
test("Foreign, public and quote evidence cannot be reused as work evidence", () => {
  const pub = uploads.saveUpload({
    ownerId: direct.id,
    bytes: png,
    purpose: "public",
  }).upload;
  for (const u of [buyer, other])
    rejects(() =>
      act(u, w.get(buyer.id, d.work.id), "add_evidence", {
        evidence: [
          {
            uploadId: secret.id,
            type: "delivery",
            visibility: "shared",
            description: "",
          },
        ],
      }),
    );
  rejects(() =>
    act(direct, w.get(direct.id, d.work.id), "add_evidence", {
      evidence: [
        {
          uploadId: pub.id,
          type: "delivery",
          visibility: "shared",
          description: "",
        },
      ],
    }),
  );
});
test("Amendments identify old/new values and pause advancement without replacing terms", () => {
  d.work = act(direct, d.work, "propose_amendment", {
    note: "Customer requested 500 additional bags",
    changes: {
      quotedQuantity: 5500,
      unitPriceMinor: 1700,
      deliveryDetails: "Collect at the agreed Nairobi loading bay",
    },
  });
  assert.equal(d.work.agreements.length, 1);
  const am = d.work.amendments.at(-1);
  assert.equal(am.status, "pending");
  assert.equal(
    am.changes.find((c) => c.field === "quotedQuantity").previous,
    5000,
  );
  assert.equal(am.proposed.terms.subtotalMinor, 9350000);
  rejects(() => act(direct, d.work, "ready"), "invalid_transition");
  rejects(
    () => act(direct, d.work, "accept_amendment", { amendmentId: am.id }),
    "amendment_conflict",
  );
});
test("Counterparty amendment approval appends a new mutually confirmed agreement", () => {
  const am = d.work.amendments.at(-1);
  d.work = act(buyer, d.work, "accept_amendment", {
    amendmentId: am.id,
    note: "Quantity and collection point agreed",
  });
  assert.equal(d.work.agreements.length, 2);
  assert.equal(d.work.agreements[0].terms.quotedQuantity, 5000);
  assert.equal(d.work.agreements[1].terms.quotedQuantity, 5500);
  assert.equal(d.work.agreements[1].terms.totalMinor, 9560000);
  assert.equal(d.work.confirmations.participant.agreementRevision, 2);
  assert.equal(d.work.status, "in_progress");
  assert.equal(
    q.get(buyer.id, d.quote.id).offers[0].terms.quotedQuantity,
    5000,
  );
});
test("Stale or already-decided amendment acceptance cannot overwrite newer agreement", () =>
  rejects(
    () =>
      act(buyer, d.work, "accept_amendment", {
        amendmentId: d.work.amendments[0].id,
      }),
    "amendment_conflict",
  ));
test("Invalid economic amendments and undisclosed fees are refused", () => {
  for (const changes of [
    { unitPriceMinor: -1 },
    { quotedQuantity: 0 },
    { sourceType: "sourcing" },
    { totalMinor: 1 },
    { sourcingFeeMinor: 1 },
    { currency: "USD" },
  ])
    rejects(
      () =>
        act(buyer, d.work, "propose_amendment", {
          note: "Invalid proposal",
          changes,
        }),
      "validation_error",
    );
});
test("Rejection retains the previous agreement and amendment history", () => {
  d.work = act(buyer, d.work, "propose_amendment", {
    note: "Can we change timing?",
    changes: { productionLeadDays: 2 },
  });
  const am = d.work.amendments.at(-1);
  d.work = act(direct, d.work, "reject_amendment", {
    amendmentId: am.id,
    note: "Four days remain necessary",
  });
  assert.equal(d.work.amendments.at(-1).status, "rejected");
  assert.equal(d.work.agreements.length, 2);
});
test("No silent cancellation after progress; issues pause operations", () => {
  rejects(
    () => act(buyer, d.work, "cancel", { note: "Need a change" }),
    "invalid_transition",
  );
  d.work = act(buyer, d.work, "raise_issue", {
    note: "Confirm print colour before continuing",
  });
  assert.equal(d.work.status, "disputed");
  rejects(() => act(direct, d.work, "ready"), "invalid_transition");
});
test("Both parties must explicitly resolve an issue before resuming previous state", () => {
  d.work = act(direct, d.work, "resolve_issue", {
    note: "Colour proof reviewed",
  });
  assert.equal(d.work.status, "disputed");
  d.work = act(buyer, d.work, "resolve_issue", { note: "Colour proof agreed" });
  assert.equal(d.work.status, "in_progress");
  assert.ok(d.work.issue.resolvedAt);
});
test("Only participant explicitly marks ready and dispatches", () => {
  rejects(() => act(buyer, d.work, "ready"), "invalid_transition");
  d.work = act(direct, d.work, "ready");
  assert.equal(d.work.status, "ready");
  assert.ok(d.work.readyAt);
  d.work = act(direct, d.work, "dispatch");
  assert.equal(d.work.status, "dispatched");
  assert.ok(d.work.dispatchedAt);
  rejects(() => act(buyer, d.work, "complete"), "invalid_transition");
});
test("Delivery is recorded, requests completion, and is not auto-completed", () => {
  d.work = act(direct, d.work, "deliver");
  assert.equal(d.work.status, "delivered");
  assert.ok(d.work.deliveredAt);
  assert.equal(d.work.completedAt, null);
  assert.ok(d.work.history.some((e) => e.action === "completion_requested"));
  rejects(() => act(direct, d.work, "complete"), "invalid_transition");
});
let completionBody;
test("Requester completion freezes final value and completes the Request atomically", () => {
  completionBody = {
    action: "complete",
    revision: d.work.revision,
    agreementRevision: 2,
    idempotencyKey: "completion-lost-response-key",
  };
  d.work = w.mutate(buyer.id, d.work.id, completionBody);
  assert.equal(d.work.status, "completed");
  assert.equal(d.work.completion.completedBy, buyer.id);
  assert.equal(d.work.completion.agreement.terms.totalMinor, 9560000);
  assert.equal(r.getRequest(buyer.id, d.req.id).status, "completed");
  assert.equal(
    w.mutate(buyer.id, d.work.id, completionBody).revision,
    d.work.revision,
  );
});
test("Terminal state cannot be contradicted, amended or silently reopened", () => {
  for (const action of ["cancel", "raise_issue", "start", "propose_amendment"])
    rejects(
      () => act(buyer, d.work, action, { note: "Cannot reopen" }),
      "work_closed",
    );
  assert.equal(w.createFromAccepted(buyer.id, d.quote.id).status, "completed");
});
test("Cancellation before progress is explicit, reasoned and retained", () => {
  const f = accept(prepared());
  rejects(() => act(direct, f.work, "cancel"), "validation_error");
  const cancelled = act(direct, f.work, "cancel", {
    note: "Unable to begin this job",
  });
  assert.equal(cancelled.status, "cancelled");
  assert.ok(cancelled.cancelledAt);
  assert.equal(r.getRequest(buyer.id, f.req.id).status, "cancelled");
  assert.equal(q.get(buyer.id, f.quote.id).status, "accepted");
});
test("An amendment before starting can mutually confirm the new agreement without hidden stages", () => {
  a.work = act(agent, a.work, "propose_amendment", {
    note: "Agree collection point",
    changes: { deliveryDetails: "Nairobi collection bay" },
  });
  const am = a.work.amendments.at(-1);
  a.work = act(buyer, a.work, "accept_amendment", { amendmentId: am.id });
  assert.equal(a.work.status, "confirmed");
  assert.ok(
    a.work.history.some(
      (e) => e.action === "specification_confirmation_started",
    ),
  );
  assert.ok(
    a.work.milestones.some((e) => e.status === "specification_pending"),
  );
  assert.equal(a.work.originalAgreement.terms.sourcingFeeMinor, 300000);
  assert.equal(a.work.confirmations.participant.at, am.proposedAt);
  const confirmation = a.work.history.findLast(
    (e) => e.action === "specifications_confirmed",
  );
  assert.equal(confirmation.fromStatus, "specification_pending");
  assert.equal(confirmation.toStatus, "confirmed");
});
test("Source participant completes the same real state machine with separated final economics", () => {
  for (const action of ["start", "ready", "dispatch", "deliver"])
    a.work = act(agent, a.work, action);
  a.work = act(buyer, a.work, "complete");
  assert.equal(a.work.completion.agreement.terms.sourcingFeeMinor, 300000);
  assert.equal(a.work.completion.agreement.terms.totalMinor, 8510000);
});
test("Start defensively rejects a stored confirmation for the wrong agreement version", () => {
  const f = accept(prepared());
  f.work = act(buyer, f.work, "confirm_specifications");
  f.work = act(direct, f.work, "confirm_specifications");
  store.update("workOrders", f.work.id, {
    confirmations: {
      ...f.work.confirmations,
      participant: {
        ...f.work.confirmations.participant,
        agreementRevision: 999,
      },
    },
  });
  rejects(() => act(direct, f.work, "start"), "confirmation_required");
  assert.equal(r.getRequest(buyer.id, f.req.id).status, "ready_for_work");
  assert.equal(w.get(buyer.id, f.work.id).status, "confirmed");
});
test("No ledger, checkout or payment order is created by work or amendments", () => {
  assert.equal(store.all("ledgerTransactions").length, ledgerBefore);
  assert.equal(store.all("orders").length, ordersBefore);
});
test("Persisted completion and agreements survive independent process reload", () => {
  const code = `const {store}=await import('${new URL("../src/store.js", import.meta.url).href}');console.log(JSON.stringify(store.lookup('workOrders','${d.work.id}')))`;
  const persisted = JSON.parse(
    execFileSync(process.execPath, ["--input-type=module", "-e", code], {
      encoding: "utf8",
      env: { ...process.env, BRIEF_DATA_DIR: dir },
    }),
  );
  assert.equal(persisted.status, "completed");
  assert.equal(persisted.agreements.length, 2);
  assert.equal(persisted.completion.agreement.terms.totalMinor, 9560000);
});
test("Work creation failure rolls back acceptance, Request and audit", () => {
  const f = prepared(),
    before = JSON.stringify({
      request: store.lookup("requests", f.req.id),
      quote: store.lookup("requestQuotes", f.quote.id),
      audits: store.all("auditLog"),
    });
  const insert = store.insert;
  store.insert = (collection, row) => {
    if (collection === "workOrders") throw new Error("injected work failure");
    return insert.call(store, collection, row);
  };
  try {
    assert.throws(() => accept(f), /injected work failure/);
  } finally {
    store.insert = insert;
  }
  assert.equal(
    JSON.stringify({
      request: store.lookup("requests", f.req.id),
      quote: store.lookup("requestQuotes", f.quote.id),
      audits: store.all("auditLog"),
    }),
    before,
  );
  assert.equal(
    store.indexed("workOrders", "acceptedQuoteId", f.quote.id).length,
    0,
  );
});
test("A failed start cannot leave Request and Work in different states", () => {
  const f = accept(prepared());
  let x = act(buyer, f.work, "confirm_specifications");
  x = act(direct, x, "confirm_specifications");
  const before = JSON.stringify({
      request: store.lookup("requests", f.req.id),
      work: store.lookup("workOrders", x.id),
    }),
    update = store.update;
  store.update = (collection, id, patch) => {
    if (collection === "workOrders" && id === x.id)
      throw new Error("injected transition failure");
    return update.call(store, collection, id, patch);
  };
  try {
    assert.throws(() => act(direct, x, "start"), /injected transition failure/);
  } finally {
    store.update = update;
  }
  assert.equal(
    JSON.stringify({
      request: store.lookup("requests", f.req.id),
      work: store.lookup("workOrders", x.id),
    }),
    before,
  );
});
test("Earlier accepted quotes have an explicit idempotent bridge, never a render-time creation", () => {
  process.env.BRIEF_DISABLED_FEATURES = "work_orders";
  const f = prepared();
  const quote = q.mutate(buyer.id, f.quote.id, {
    action: "accept",
    revision: f.quote.revision,
    requestRevision: f.req.revision,
    idempotencyKey: "earlier-accepted-before-work",
  });
  delete process.env.BRIEF_DISABLED_FEATURES;
  assert.equal(quote.workOrderId, null);
  assert.equal(w.forRequest(buyer.id, f.req.id).workOrders.length, 0);
  const work = w.createFromAccepted(buyer.id, quote.id);
  assert.equal(w.createFromAccepted(buyer.id, quote.id).id, work.id);
});
test("Events identify the real actor, state, Work and agreement version", () => {
  for (const action of [
    "work_order_created",
    "specification_confirmation_started",
    "specifications_confirmed",
    "work_started",
    "progress_recorded",
    "work_marked_ready",
    "dispatch_recorded",
    "delivery_recorded",
    "completion_requested",
    "work_order_completed",
    "work_order_cancelled",
    "amendment_requested",
    "amendment_accepted",
    "amendment_rejected",
  ])
    assert.ok(
      store.all("auditLog").some((e) => e.action === action),
      action,
    );
  for (const e of d.work.history) {
    assert.equal(e.workOrderId, d.work.id);
    assert.ok(e.actorId);
    assert.ok(e.at);
    assert.ok(e.agreementRevision);
  }
});
const { default: app } = await import("../src/index.js");
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const tokens = {
  buyer: auth.issueSession(buyer.id).token,
  direct: auth.issueSession(direct.id).token,
  other: auth.issueSession(other.id).token,
  agent: auth.issueSession(agent.id).token,
};
const call = (url, token, method = "GET", body) =>
  fetch(base + url, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
async function http(name, fn) {
  await fn();
  count++;
  console.log("PASS " + name);
}
try {
  await http(
    "HTTP requires real sessions and denies guessed foreign Work IDs",
    async () => {
      assert.equal((await call(`/api/work-orders/${d.work.id}`)).status, 401);
      assert.equal(
        (await call(`/api/work-orders/${d.work.id}`, tokens.other)).status,
        404,
      );
      assert.equal(
        (await call(`/api/work-orders/${d.work.id}`, tokens.agent)).status,
        404,
      );
      const res = await call(`/api/work-orders/${d.work.id}`, tokens.buyer);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("cache-control"), "no-store");
    },
  );
  await http(
    "HTTP media protects private bytes even from reviewers and other participants",
    async () => {
      process.env.BRIEF_REVIEWERS = other.handle;
      for (const [id, token, status] of [
        [shared.id, null, 404],
        [shared.id, tokens.other, 404],
        [shared.id, tokens.agent, 404],
        [secret.id, tokens.buyer, 404],
        [shared.id, tokens.buyer, 200],
        [secret.id, tokens.direct, 200],
      ]) {
        const res = await call(`/api/media/file/${id}`, token);
        assert.equal(res.status, status);
        assert.match(res.headers.get("cache-control"), /no-store/);
      }
    },
  );
  await http(
    "HTTP lifecycle cannot be driven by an unrelated account",
    async () => {
      const res = await call(
        `/api/work-orders/${a.work.id}/actions`,
        tokens.other,
        "POST",
        {
          action: "complete",
          revision: a.work.revision,
          agreementRevision: 2,
          idempotencyKey: "forged-http-completion",
        },
      );
      assert.equal(res.status, 404);
    },
  );
  await http("Work feature gate disables APIs independently", async () => {
    process.env.BRIEF_DISABLED_FEATURES = "work_orders";
    assert.equal(
      (await call("/api/supply/work-orders", tokens.direct)).status,
      503,
    );
    delete process.env.BRIEF_DISABLED_FEATURES;
  });
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(`PASSED ${count} FAILED 0`);
