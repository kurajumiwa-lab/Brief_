import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-quotes-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js"),
  auth = await import("../src/domain/auth.js"),
  s = await import("../src/domain/supply.js"),
  r = await import("../src/domain/requests.js"),
  m = await import("../src/domain/matching.js"),
  q = await import("../src/domain/quotes.js"),
  v = await import("../src/domain/quoteValidation.js"),
  uploads = await import("../src/domain/upload.js");
let count = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log("PASS " + name);
};
const reject = (fn, code = "validation_error") =>
  assert.throws(fn, (e) => e.code === code);
const user = (handle) =>
  auth.createUser({ handle, password: "commercial-test-password" });
const buyer = user("quote_buyer"),
  stranger = user("quote_stranger"),
  a = user("quote_direct"),
  b = user("quote_source");
const make = (u, source) =>
  s.createEnterprise(u.id, {
    displayName: source ? "Actual fixture agent" : "Actual fixture supplier",
    businessType: source ? "sourcing_agent" : "manufacturer",
    supplyRole: source ? "verified_sourcing_agent" : "direct_supplier",
    location: "Nairobi",
    serviceAreas: ["Nairobi"],
    publication: "public",
    firstCapability: {
      name: "Printed paper bags",
      productsServices: ["Paper bags"],
      category: "Packaging",
      supplyMode: source ? "source" : "direct",
      capacityKind: source ? "sourcing_access" : "production",
      typicalCapacity: 20000,
      unit: "pieces",
      minimumQuantity: 100,
      maximumQuantity: 30000,
      leadTime: { minDays: 2, maxDays: 4 },
      serviceAreas: ["Nairobi"],
    },
  });
const pa = make(a, false),
  pb = make(b, true);
function request() {
  let x = r.createRequest(buyer.id, {
    title: "5000 printed paper bags",
    quantity: 5000,
    unit: "pieces",
    category: "Packaging",
    location: "Nairobi",
    requiredBy: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    description: "PRIVATE DESCRIPTION phone",
    budgetMin: 15000,
    budgetMax: 99000,
    specifications: { material: "Kraft paper" },
    intent: "submit",
    visibility: "private",
  });
  return r.changeRequestStatus(buyer.id, x.id, {
    revision: x.revision,
    status: "matching",
  });
}
function invite(x, p) {
  const match = m
    .list(buyer.id, x.id)
    .matches.find((x) => x.participantId === p.id);
  return q.requestQuote(buyer.id, match.id, {
    requestRevision: r.getRequest(buyer.id, x.id).revision,
    matchRevision: match.revision,
    shareRequirements: true,
  });
}
function interest(i, u) {
  return m.expressInterest(u.id, i.matchId, {
    requestRevision: r.getRequest(buyer.id, i.requestId).revision,
    revision: store.lookup("matches", i.matchId).revision,
  });
}
function start(i, u) {
  interest(i, u);
  return q.start(u.id, i.id, { revision: i.revision });
}
const terms = (source = false) => ({
  quotedQuantity: 5000,
  unit: "pieces",
  unitPriceMinor: source ? 1640 : 1800,
  currency: "KES",
  deliveryCostMinor: source ? 300000 : 200000,
  sourcingFeeMinor: source ? 400000 : 0,
  otherCosts: [],
  productionLeadDays: source ? 3 : 4,
  deliveryLeadDays: 1,
  sourceType: source ? "sourcing" : "direct",
  validUntil: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  privateProvenance: {
    reference: "CONFIDENTIAL FACTORY",
    notes: "PRIVATE MARGIN AND CONTACT",
    sourceParticipantId: null,
  },
});
let seq = 0;
function act(u, quote, action, extra = {}) {
  return q.mutate(u.id, quote.id, {
    action,
    revision: quote.revision,
    requestRevision: ["save", "submit"].includes(action)
      ? q.get(u.id, quote.id).requirementsRevision
      : r.getRequest(buyer.id, quote.requestId).revision,
    idempotencyKey: `commercial-operation-${++seq}`,
    ...extra,
  });
}
const ledgerBefore = store.all("ledgerTransactions").length,
  ordersBefore = store.all("orders").length;
const req = request();
let ia, ib, qa, qb;
test("Uninvited private demand is not available to a participant", () => {
  assert.equal(m.relevantRequests(a.id).requests.length, 0);
  assert.equal(q.workspace(a.id).invitations.length, 0);
});
test("Only requester can invite matched participants", () => {
  const match = m.list(buyer.id, req.id).matches[0];
  reject(
    () =>
      q.requestQuote(stranger.id, match.id, {
        requestRevision: req.revision,
        matchRevision: match.revision,
        shareRequirements: true,
      }),
    "not_found",
  );
  reject(() =>
    q.requestQuote(buyer.id, match.id, {
      requestRevision: req.revision,
      matchRevision: match.revision,
      shareRequirements: false,
    }),
  );
});
test("Invitation is a real, idempotent scoped grant", () => {
  ia = invite(req, pa);
  ib = invite(req, pb);
  assert.equal(invite(req, pa).id, ia.id);
  assert.equal(store.indexed("quoteRequests", "requestId", req.id).length, 2);
  assert.equal(q.workspace(a.id).invitations.length, 1);
});
test("Shared snapshot excludes private description, budget, contacts and full Request", () => {
  const data = JSON.stringify(q.workspace(a.id));
  assert.ok(!data.includes("PRIVATE DESCRIPTION"));
  assert.ok(!data.includes("budget"));
  assert.equal(
    q.workspace(a.id).invitations[0].requirements.specifications.material,
    "Kraft paper",
  );
  reject(() => r.getRequest(a.id, req.id), "not_found");
});
test("Interest required; unrelated users cannot start quotes", () => {
  reject(
    () => q.start(a.id, ia.id, { revision: ia.revision }),
    "interest_required",
  );
  reject(
    () => q.start(stranger.id, ia.id, { revision: ia.revision }),
    "not_found",
  );
});
test("Quote draft prefills and is stable across duplicate starts", () => {
  qa = start(ia, a);
  qb = start(ib, b);
  assert.equal(qa.draft.quotedQuantity, 5000);
  assert.equal(q.start(a.id, ia.id, { revision: ia.revision }).id, qa.id);
  assert.equal(qb.draft.sourceType, "sourcing");
});
test("Buyer cannot inspect unsubmitted drafts or private working provenance", () => {
  assert.equal(q.listForRequest(buyer.id, req.id).quotes.length, 0);
  reject(() => q.get(buyer.id, qa.id), "not_found");
});
for (const [field, value] of [
  ["quotedQuantity", -1],
  ["quotedQuantity", 0],
  ["quotedQuantity", 0.0001],
  ["unitPriceMinor", -1],
  ["unitPriceMinor", 1.5],
  ["currency", "ZZZ"],
  ["deliveryCostMinor", -1],
  ["sourcingFeeMinor", -1],
  ["productionLeadDays", -1],
  ["validUntil", "2026-02-30"],
])
  test("Refuses malformed " + field + " " + value, () =>
    reject(() =>
      v.validate({ ...terms(), [field]: value }, a.id, { complete: true }),
    ),
  );
test("Client totals and fake verified evidence flags are refused", () => {
  reject(() => v.validate({ ...terms(), totalMinor: 1 }, a.id));
  reject(() =>
    v.validate(
      {
        ...terms(),
        evidence: [
          {
            uploadId: "fake",
            kind: "stock_confirmation",
            shareWithRequester: true,
            verified: true,
          },
        ],
      },
      a.id,
    ),
  );
});
test("Fractional quantities use exact half-up minor-unit arithmetic", () => {
  assert.equal(
    v.validate(
      {
        ...terms(),
        quotedQuantity: 0.125,
        unitPriceMinor: 101,
        deliveryCostMinor: 0,
      },
      a.id,
      { complete: true },
    ).totalMinor,
    13,
  );
  reject(() =>
    v.validate(
      { ...terms(), quotedQuantity: 1e9, unitPriceMinor: 1e12 },
      a.id,
      { complete: true },
    ),
  );
});
test("Agent cannot present a factory-direct proposal or hide fee economics", () => {
  reject(() =>
    act(b, qb, "submit", { terms: { ...terms(true), sourceType: "direct" } }),
  );
  reject(() =>
    act(a, qa, "submit", { terms: { ...terms(), sourcingFeeMinor: 1 } }),
  );
});
test("Supplier cannot change someone else’s quote or accept their own", () => {
  reject(() => act(b, qa, "save", { terms: terms(true) }), "not_found");
  reject(() => act(a, qa, "accept"), "not_found");
});
test("Draft save preserves submitted proposal separation", () => {
  qa = act(a, qa, "save", { terms: terms() });
  assert.equal(qa.draft.totalMinor, 9200000);
  assert.equal(qa.offers.length, 0);
  assert.equal(q.listForRequest(buyer.id, req.id).quotes.length, 0);
});
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const shared = uploads.saveUpload({
  bytes: png,
  ownerId: b.id,
  purpose: "private_quote",
}).upload;
const secret = uploads.saveUpload({
  bytes: Buffer.concat([png, Buffer.from("private")]),
  ownerId: b.id,
  purpose: "private_quote",
}).upload;
const tB = {
  ...terms(true),
  evidence: [
    {
      uploadId: shared.id,
      kind: "supplier_quotation",
      shareWithRequester: true,
    },
    {
      uploadId: secret.id,
      kind: "source_confirmation",
      shareWithRequester: false,
    },
  ],
};
test("Draft evidence remains private even with sharing flag", () => {
  qb = act(b, qb, "save", { terms: tB });
  assert.equal(q.canReadQuoteEvidence(buyer.id, shared.id), false);
  assert.equal(
    uploads.listUploads(b.id).some((x) => x.id === shared.id),
    false,
  );
});
test("First submission advances matching to quoted without invalidating requirements", () => {
  qa = act(a, qa, "submit", { terms: terms() });
  assert.equal(qa.status, "submitted");
  const row = r.getRequest(buyer.id, req.id);
  assert.equal(row.status, "quoted");
  assert.equal(row.requirementsRevision, req.revision);
  assert.equal(m.list(buyer.id, req.id).stale, false);
});
test("Agent submits separated source cost, fee and logistics", () => {
  qb = act(b, qb, "submit", { terms: tB });
  const t = qb.offers[0].terms;
  assert.equal(t.subtotalMinor, 8200000);
  assert.equal(t.sourcingFeeMinor, 400000);
  assert.equal(t.deliveryCostMinor, 300000);
  assert.equal(t.totalMinor, 8900000);
  assert.match(t.relationshipType, /Independent sourcing/);
});
test("Buyer sees only published commercial terms and explicitly shared evidence", () => {
  const data = q.get(buyer.id, qb.id);
  assert.equal(data.offers[0].terms.privateProvenance, undefined);
  assert.equal(data.offers[0].terms.evidence.length, 1);
  assert.equal(
    data.offers[0].terms.evidence[0].verification,
    "participant_uploaded",
  );
  assert.equal(q.canReadQuoteEvidence(buyer.id, shared.id), true);
  assert.equal(q.canReadQuoteEvidence(buyer.id, secret.id), false);
  reject(() => q.get(stranger.id, qb.id), "not_found");
  assert.equal(uploads.deleteUpload(shared.id, b.id).status, 409);
});
test("Private quote evidence cannot be promoted into public supply or Request images", () => {
  reject(() =>
    s.updateCapability(b.id, pb.capabilities[0].id, {
      revision: pb.capabilities[0].revision,
      images: [{ uploadId: shared.id }],
    }),
  );
  reject(
    () =>
      r.updateRequest(b.id, req.id, {
        revision: 1,
        attachments: [{ uploadId: shared.id }],
      }),
    "not_found",
  );
});
test("Viewed event is recorded without changing commercial version", () => {
  qa = act(buyer, q.get(buyer.id, qa.id), "view");
  assert.equal(qa.status, "viewed");
  assert.equal(qa.offers.length, 1);
});
let retryBody;
test("Lost submission response retry creates no duplicate offer or event", () => {
  retryBody = {
    action: "submit",
    revision: qb.revision,
    requestRevision: qb.requirementsRevision,
    idempotencyKey: "lost-response-submit-key",
    terms: { ...tB, unitPriceMinor: 1600 },
  };
  qb = q.mutate(b.id, qb.id, retryBody);
  const twice = q.mutate(b.id, qb.id, retryBody);
  assert.equal(twice.revision, qb.revision);
  assert.equal(twice.offers.length, 2);
  assert.equal(twice.status, "revised");
  assert.equal(twice.offers[0].terms.unitPriceMinor, 1640);
});
test("Retry keys cannot be reused with different commercial values", () =>
  reject(
    () => q.mutate(b.id, qb.id, { ...retryBody, terms: terms(true) }),
    "idempotency_conflict",
  ));
test("Two tabs cannot overwrite a newer submitted revision", () =>
  reject(
    () =>
      q.mutate(b.id, qb.id, {
        ...retryBody,
        idempotencyKey: "another-tab-operation",
      }),
    "revision_conflict",
  ));
test("Competing proposals remain intact while revision draft is prepared", () => {
  qb = act(b, qb, "save", { terms: { ...tB, unitPriceMinor: 1500 } });
  assert.equal(q.get(buyer.id, qb.id).offers.at(-1).terms.unitPriceMinor, 1600);
  assert.equal(q.get(buyer.id, qb.id).draft, undefined);
});
let accepted;
test("Accept selects exact published revision and declines competing active quotes atomically", () => {
  const current = q.get(buyer.id, qb.id);
  const body = {
    action: "accept",
    revision: current.revision,
    requestRevision: r.getRequest(buyer.id, req.id).revision,
    idempotencyKey: "accepted-selection-retry",
  };
  accepted = q.mutate(buyer.id, qb.id, body);
  assert.equal(accepted.acceptedOfferRevision, 2);
  assert.equal(q.mutate(buyer.id, qb.id, body).status, "accepted");
  assert.equal(q.get(a.id, qa.id).status, "declined");
  const row = r.getRequest(buyer.id, req.id);
  assert.equal(row.status, "ready_for_work");
  assert.equal(row.acceptedQuote.offerRevision, 2);
  assert.equal(row.acceptedQuote.quoteId, qb.id);
  assert.equal(accepted.offers[1].terms.unitPriceMinor, 1600);
  assert.equal(q.get(b.id, qb.id).draft, null);
});
test("Selection cannot become two acceptances or be silently withdrawn", () => {
  reject(() => act(b, accepted, "withdraw"), "accepted_quote_locked");
  reject(
    () => act(b, accepted, "save", { terms: terms(true) }),
    "accepted_quote_locked",
  );
  reject(
    () => act(buyer, q.get(buyer.id, qa.id), "accept"),
    "stale_quote_request",
  );
  reject(
    () =>
      r.updateRequest(buyer.id, req.id, {
        revision: r.getRequest(buyer.id, req.id).revision,
        title: "Changed",
      }),
    "invalid_transition",
  );
});
test("No order, payment or ledger transaction created on submission or acceptance", () => {
  assert.equal(store.all("ledgerTransactions").length, ledgerBefore);
  assert.equal(store.all("orders").length, ordersBefore);
});
test("Accepted records and evidence survive independent-process reload", () => {
  const code = `const {store}=await import('${new URL("../src/store.js", import.meta.url).href}'); console.log(JSON.stringify(store.lookup('requestQuotes','${qb.id}')));`;
  const persisted = JSON.parse(
    execFileSync(process.execPath, ["--input-type=module", "-e", code], {
      cwd: path.resolve("."),
      env: { ...process.env, BRIEF_DATA_DIR: dir },
      encoding: "utf8",
    }),
  );
  assert.equal(persisted.status, "accepted");
  assert.equal(persisted.offers.length, 2);
});
const changed = request();
let ic = invite(changed, pa),
  qc = start(ic, a);
qc = act(a, qc, "submit", { terms: terms() });
test("Request change invalidates quotes without silently changing published terms", () => {
  const old = r.getRequest(buyer.id, changed.id);
  const edit = r.updateRequest(buyer.id, old.id, {
    revision: old.revision,
    quantity: 7000,
  });
  assert.equal(edit.status, "matching");
  assert.equal(q.get(buyer.id, qc.id).stale, true);
  assert.equal(q.get(buyer.id, qc.id).offers[0].terms.quotedQuantity, 5000);
  reject(
    () => act(buyer, q.get(buyer.id, qc.id), "accept"),
    "stale_quote_request",
  );
});
test("Refresh and renewed invitation permit an auditable new commercial revision", () => {
  const row = r.getRequest(buyer.id, changed.id);
  m.generate(buyer.id, row.id, {
    requestRevision: row.revision,
    generationRevision: m.list(buyer.id, row.id).generation.revision,
  });
  ic = invite(row, pa);
  interest(ic, a);
  qc = act(a, q.get(a.id, qc.id), "submit", {
    terms: { ...terms(), quotedQuantity: 7000 },
  });
  assert.equal(qc.status, "revised");
  assert.equal(qc.offers.length, 2);
  assert.equal(qc.offers[1].requestRevision, row.revision);
});
test("Expiry prevents acceptance, does not renew itself, preserves history", () => {
  const raw = store.lookup("requestQuotes", qc.id);
  const offers = structuredClone(raw.offers);
  offers[1].terms.validUntil = "2020-01-01";
  store.update("requestQuotes", qc.id, { offers });
  assert.equal(q.get(buyer.id, qc.id).status, "expired");
  reject(
    () => act(buyer, q.get(buyer.id, qc.id), "accept"),
    "invalid_transition",
  );
  assert.equal(
    store.lookup("requestQuotes", qc.id).offers[1].terms.validUntil,
    "2020-01-01",
  );
  qc = act(a, q.get(a.id, qc.id), "submit", { terms: terms() });
  assert.equal(qc.offers.length, 3);
});
test("Withdrawal and optional decline reasons are durable commercial events", () => {
  qc = act(a, qc, "withdraw");
  assert.equal(qc.status, "withdrawn");
  reject(
    () => act(buyer, q.get(buyer.id, qc.id), "accept"),
    "invalid_transition",
  );
  qc = act(a, qc, "submit", { terms: terms() });
  qc = act(buyer, q.get(buyer.id, qc.id), "decline", {
    reason: "Turnaround too slow",
  });
  assert.equal(qc.history.at(-1).reason, "Turnaround too slow");
});
test("Cancellation prevents active invitations and offers from being used", () => {
  const row = r.getRequest(buyer.id, changed.id);
  r.changeRequestStatus(buyer.id, row.id, {
    revision: row.revision,
    status: "cancelled",
  });
  assert.ok(
    q.workspace(a.id).invitations.find((x) => x.id === ic.id).unavailableReason,
  );
  reject(
    () => act(a, q.get(a.id, qc.id), "submit", { terms: terms() }),
    "stale_quote_request",
  );
});
test("Commercial events use existing audit infrastructure", () => {
  for (const action of [
    "quote_requested",
    "quote_started",
    "quote_submitted",
    "quote_viewed",
    "quote_revised",
    "quote_accepted",
    "quote_declined",
    "quote_withdrawn",
  ])
    assert.ok(
      store.all("auditLog").some((e) => e.action === action),
      action,
    );
});

const atomic = request();
const ix = invite(atomic, pa),
  iy = invite(atomic, pb);
let x = start(ix, a),
  y = start(iy, b);
x = act(a, x, "submit", { terms: terms() });
y = act(b, y, "submit", { terms: terms(true) });
test("Acceptance rollback restores Request, competing quotes and audit after storage failure", () => {
  const before = JSON.stringify({
    r: store.lookup("requests", atomic.id),
    quotes: store.indexed("requestQuotes", "requestId", atomic.id),
    audit: store.all("auditLog"),
  });
  const update = store.update;
  store.update = (collection, id, patch) => {
    if (collection === "requestQuotes" && id === y.id)
      throw new Error("injected write interruption");
    return update.call(store, collection, id, patch);
  };
  try {
    assert.throws(
      () => act(buyer, q.get(buyer.id, y.id), "accept"),
      /injected write/,
    );
  } finally {
    store.update = update;
  }
  assert.equal(
    JSON.stringify({
      r: store.lookup("requests", atomic.id),
      quotes: store.indexed("requestQuotes", "requestId", atomic.id),
      audit: store.all("auditLog"),
    }),
    before,
  );
});
test("A second concurrent acceptance based on an old tab is rejected", () => {
  const oldX = q.get(buyer.id, x.id),
    oldR = r.getRequest(buyer.id, atomic.id);
  act(buyer, q.get(buyer.id, y.id), "accept");
  reject(
    () =>
      q.mutate(buyer.id, x.id, {
        action: "accept",
        revision: oldX.revision,
        requestRevision: oldR.revision,
        idempotencyKey: "concurrent-second-accept",
      }),
    "revision_conflict",
  );
  assert.equal(
    store
      .indexed("requestQuotes", "requestId", atomic.id)
      .filter((x) => x.status === "accepted").length,
    1,
  );
});
const supplyChange = request();
const iz = invite(supplyChange, pa);
let z = start(iz, a);
z = act(a, z, "submit", { terms: terms() });
test("Capability changes invalidate active proposals, but retain their submitted facts", () => {
  const cap = s.getCapability(a.id, pa.capabilities[0].id);
  s.updateCapability(a.id, cap.id, {
    revision: cap.revision,
    leadTime: { minDays: 40, maxDays: 45 },
  });
  assert.equal(q.get(buyer.id, z.id).stale, true);
  reject(
    () => act(buyer, q.get(buyer.id, z.id), "accept"),
    "stale_quote_request",
  );
  assert.equal(q.get(buyer.id, z.id).offers[0].terms.productionLeadDays, 4);
});
test("Owned quote evidence cannot be repurposed as a Request attachment", () => {
  const image = uploads.saveUpload({
    bytes: png,
    ownerId: buyer.id,
    purpose: "private_quote",
  }).upload;
  const draft = r.createRequest(buyer.id, {
    title: "Own attachment security",
    intent: "draft",
  });
  reject(() =>
    r.updateRequest(buyer.id, draft.id, {
      revision: draft.revision,
      attachments: [{ uploadId: image.id }],
    }),
  );
});
test("Large Request quantities do not block a participant from proposing a smaller supported quantity", () => {
  const initial = request();
  const big = r.updateRequest(buyer.id, initial.id, {
    revision: initial.revision,
    quantity: 1e10,
  });
  m.generate(buyer.id, big.id, {
    requestRevision: big.revision,
    generationRevision: m.list(buyer.id, big.id).generation.revision,
  });
  const i = invite(big, pb);
  const proposal = start(i, b);
  assert.equal(proposal.draft.quotedQuantity, null);
  const saved = act(b, proposal, "submit", { terms: terms(true) });
  assert.equal(saved.offers[0].terms.quotedQuantity, 5000);
  assert.equal(saved.offers[0].requestSnapshot.quantity, 1e10);
});
test("Unstated delivery timing stays unknown, never a fabricated zero-day promise", () => {
  const { deliveryLeadDays, ...input } = terms();
  assert.equal(
    v.validate(input, a.id, { complete: true }).deliveryLeadDays,
    null,
  );
  assert.equal(
    v.validate({ ...input, deliveryLeadDays: 0 }, a.id, { complete: true })
      .deliveryLeadDays,
    0,
  );
});
test("Logistics proposals require an actual matched logistics capability", () => {
  const u = user("quote_logistics");
  const p = s.createEnterprise(u.id, {
    displayName: "Transport fixture",
    businessType: "logistics_provider",
    supplyRole: "direct_supplier",
    location: "Nairobi",
    serviceAreas: ["Nairobi"],
    publication: "public",
    firstCapability: {
      name: "Paper bags transport",
      category: "Logistics",
      productsServices: ["Paper bags transport"],
      supplyMode: "direct",
      capacityKind: "logistics",
      typicalCapacity: 20000,
      unit: "pieces",
      leadTime: { minDays: 1, maxDays: 2 },
      serviceAreas: ["Nairobi"],
    },
  });
  const req = request(),
    i = invite(req, p),
    proposal = start(i, u);
  assert.equal(proposal.draft.sourceType, "logistics");
  const submitted = act(u, proposal, "submit", {
    terms: {
      ...terms(),
      sourceType: "logistics",
      exclusions: "Transportation only; excludes supplying the goods",
    },
  });
  assert.equal(
    submitted.offers[0].terms.relationshipType,
    "Logistics provider",
  );
  const sourceInvitation = invite(req, pb),
    sourceProposal = start(sourceInvitation, b);
  reject(() =>
    act(b, sourceProposal, "submit", {
      terms: { ...terms(true), sourceType: "logistics" },
    }),
  );
});
test("Read projections cannot mutate the immutable selected version or Request selection", () => {
  const row = q.get(b.id, qb.id);
  const price = row.offers[0].terms.unitPriceMinor;
  row.offers[0].terms.unitPriceMinor = 1;
  row.offers[0].terms.privateProvenance.notes = "tampered through read";
  row.offers[0].requestSnapshot.specifications.material = "tampered";
  const list = q.listForRequest(buyer.id, req.id);
  list.acceptedQuote.offerRevision = 900;
  const actual = q.get(b.id, qb.id);
  assert.equal(actual.offers[0].terms.unitPriceMinor, price);
  assert.notEqual(
    actual.offers[0].terms.privateProvenance.notes,
    "tampered through read",
  );
  assert.equal(
    actual.offers[0].requestSnapshot.specifications.material,
    "Kraft paper",
  );
  assert.equal(r.getRequest(buyer.id, req.id).acceptedQuote.offerRevision, 2);
});
const { default: app } = await import("../src/index.js");
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const tokens = {
  buyer: auth.issueSession(buyer.id).token,
  seller: auth.issueSession(b.id).token,
  stranger: auth.issueSession(stranger.id).token,
};
async function http(name, fn) {
  await fn();
  count++;
  console.log("PASS " + name);
}
try {
  await http("HTTP real-session and owner-only commercial access", async () => {
    assert.equal(
      (await fetch(base + `/api/requests/${req.id}/quotes`)).status,
      401,
    );
    assert.equal(
      (
        await fetch(base + `/api/requests/${req.id}/quotes`, {
          headers: { authorization: `Bearer ${tokens.stranger}` },
        })
      ).status,
      404,
    );
    const res = await fetch(base + `/api/request-quotes/${qb.id}`, {
      headers: { authorization: `Bearer ${tokens.buyer}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.ok(!(await res.text()).includes("CONFIDENTIAL FACTORY"));
  });
  await http(
    "HTTP evidence bytes: only supplier and authorized buyer, never strangers/reviewers",
    async () => {
      process.env.BRIEF_REVIEWERS = stranger.handle;
      for (const [id, token, status] of [
        [shared.id, null, 404],
        [shared.id, tokens.stranger, 404],
        [secret.id, tokens.buyer, 404],
        [shared.id, tokens.buyer, 200],
        [secret.id, tokens.seller, 200],
      ]) {
        const res = await fetch(base + `/api/media/file/${id}`, {
          headers: token ? { authorization: `Bearer ${token}` } : {},
        });
        assert.equal(res.status, status);
        assert.match(res.headers.get("cache-control"), /no-store/);
      }
    },
  );
  await http(
    "HTTP quote feature can be disabled independently of matching",
    async () => {
      process.env.BRIEF_DISABLED_FEATURES = "request_quotes";
      const res = await fetch(base + "/api/supply/quotes", {
        headers: { authorization: `Bearer ${tokens.seller}` },
      });
      assert.equal(res.status, 503);
      delete process.env.BRIEF_DISABLED_FEATURES;
    },
  );
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(`PASSED ${count} FAILED 0`);
