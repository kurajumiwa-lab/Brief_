import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-matching-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js"),
  auth = await import("../src/domain/auth.js"),
  s = await import("../src/domain/supply.js"),
  q = await import("../src/domain/requests.js"),
  m = await import("../src/domain/matching.js"),
  v = await import("../src/domain/supplyVerification.js"),
  uploads = await import("../src/domain/upload.js"),
  search = await import("../src/domain/search.js");
const { assessCapability } = await import("../src/domain/matchRanking.js");
let count = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log("PASS " + name);
};
const rejects = (fn, code = "validation_error") =>
  assert.throws(fn, (e) => e.code === code);
const user = (name) =>
  auth.createUser({ handle: name, password: "matching-test-pass" });
const buyer = user("match_buyer"),
  other = user("match_stranger"),
  reviewer = user("match_reviewer");
process.env.BRIEF_REVIEWERS = reviewer.handle;
const supplyInput = {
  displayName: "Test supplier",
  businessType: "manufacturer",
  supplyRole: "direct_supplier",
  location: "Nairobi",
  serviceAreas: ["Nairobi"],
  publication: "public",
};
const capInput = {
  name: "Paper takeaway bags",
  category: "Packaging",
  productsServices: ["Paper bags"],
  minimumQuantity: 500,
  maximumQuantity: 50000,
  typicalCapacity: 20000,
  unit: "pieces",
  capacityKind: "production",
  leadTime: { minDays: 3, maxDays: 5 },
  serviceAreas: ["Nairobi"],
};
const make = (handle, enterprise = {}, cap = {}) => {
  const u = user(handle),
    p = s.createEnterprise(u.id, {
      ...supplyInput,
      ...enterprise,
      firstCapability: { ...capInput, ...cap },
    });
  return { u, p, c: p.capabilities[0] };
};
const direct = make("match_direct", { displayName: "Direct bags" }),
  plain = make("match_plain", { displayName: "Declared bags" }),
  agent = make(
    "match_agent",
    {
      displayName: "Independent agent",
      businessType: "sourcing_agent",
      supplyRole: "verified_sourcing_agent",
    },
    {
      supplyMode: "source",
      capacityKind: "sourcing_access",
      minimumQuantity: 100,
      maximumQuantity: 10000,
      typicalCapacity: 10000,
    },
  ),
  hybrid = make("match_hybrid", {
    displayName: "Hybrid enterprise",
    businessType: "hybrid",
    supplyRole: "hybrid",
  }),
  thin = make(
    "match_thin",
    { displayName: "Incomplete bags" },
    {
      minimumQuantity: null,
      maximumQuantity: null,
      typicalCapacity: null,
      leadTime: { minDays: null, maxDays: null },
    },
  ),
  far = make(
    "match_far",
    { displayName: "Distant bags", location: "Kisumu", serviceAreas: [] },
    { serviceAreas: [], leadTime: { minDays: 12, maxDays: 15 } },
  ),
  factory = make(
    "match_moq",
    { displayName: "Large-order factory" },
    { minimumQuantity: 10000 },
  );
s.createCapability(hybrid.u.id, hybrid.p.id, {
  ...capInput,
  name: "Printed paper bags",
  supplyMode: "source",
  capacityKind: "sourcing_access",
});
make(
  "match_unrelated",
  { displayName: "General retail" },
  {
    ...capInput,
    name: "General retail",
    productsServices: [],
    materials: [],
    description: "",
  },
);
const deadline = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
let request = q.createRequest(buyer.id, {
  title: "Need 5,000 branded takeaway paper bags",
  description: "PRIVATE description with contact and internal specification",
  quantity: 5000,
  unit: "pieces",
  category: "Packaging",
  location: "Nairobi",
  deliveryLocation: "Nairobi",
  requiredBy: deadline,
  budgetMin: 45000,
  budgetMax: 55000,
  specifications: { otherNotes: "SECRET internal requirements" },
  visibility: "public",
  intent: "submit",
});
const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
  "base64",
);
let record;
function approve(who, p, kind, capabilityId = null) {
  const file = uploads.saveUpload({
    bytes: image,
    ownerId: who.id,
    purpose: "private_evidence",
  }).upload;
  let r = v.submit(who.id, p.id, {
    participantRevision: s.getEnterprise(who.id, p.id).revision,
    kind,
    capabilityId,
    evidence: [{ uploadId: file.id, type: "capability_evidence" }],
  });
  r = v.review(reviewer.id, r.id, {
    status: "under_review",
    revision: r.revision,
  });
  return v.review(reviewer.id, r.id, {
    status: "verified",
    revision: r.revision,
    reason: "Test-only scoped manual evidence review",
  });
}
approve(direct.u, direct.p, "capability", direct.c.id);
approve(agent.u, agent.p, "identity");
approve(agent.u, agent.p, "sourcing_role");
let result;
test("open Request remains uncomputed until existing matching transition, then server generates", () => {
  assert.equal(m.list(buyer.id, request.id).generation, null);
  request = q.changeRequestStatus(buyer.id, request.id, {
    revision: request.revision,
    status: "matching",
  });
  result = m.list(buyer.id, request.id);
  assert.ok(result.generation);
  assert.equal(result.generation.requestRevision, request.revision);
  assert.equal(result.matches.length, 7);
  assert.equal(result.matches[0].participantId, direct.p.id);
});
test("relevance is mandatory, not a category directory; comparisons are structured and scores private", () => {
  assert.ok(
    !result.matches.some(
      (x) => x.participant?.displayName === "General retail",
    ),
  );
  const hit = result.matches.find((x) => x.participantId === direct.p.id);
  assert.equal(hit.tier, "strong");
  for (const code of [
    "capability",
    "quantity",
    "coverage",
    "turnaround",
    "direct",
    "capability_verified",
  ])
    assert.ok(
      hit.matchReasons.some((r) => r.code === code),
      code,
    );
  assert.equal(hit.rankingValue, undefined);
  assert.equal(hit.assessments, undefined);
  assert.ok(hit.warnings.some((x) => x.code === "current_capacity"));
});
test("verified capability outranks identical declared capability without excluding it", () => {
  assert.ok(
    result.matches.findIndex((x) => x.participantId === direct.p.id) <
      result.matches.findIndex((x) => x.participantId === plain.p.id),
  );
  assert.ok(
    result.matches
      .find((x) => x.participantId === plain.p.id)
      .warnings.some((w) => w.code === "capability_declared"),
  );
});
test("multi-capability participant is grouped once; hybrid modes stay explicit", () => {
  const h = result.matches.filter((x) => x.participantId === hybrid.p.id);
  assert.equal(h.length, 1);
  assert.equal(h[0].matchType, "hybrid");
  assert.equal(h[0].capabilities.length, 2);
  assert.deepEqual(
    new Set(h[0].capabilities.map((c) => c.supplyMode)),
    new Set(["direct", "source"]),
  );
});
test("sourcing access is first-class and agent approval never means manufacturer", () => {
  const a = result.matches.find((x) => x.participantId === agent.p.id);
  assert.equal(a.matchType, "source");
  assert.equal(a.tier, "sourcing_option");
  assert.equal(a.participant.roleLabel, "Verified Sourcing Agent");
  assert.equal(a.participant.verification.businessType.status, "unverified");
  assert.ok(a.warnings.some((x) => x.code === "independent_source"));
  assert.ok(
    result.matches.findIndex((x) => x.id === a.id) <
      result.matches.findIndex((x) => x.participantId === factory.p.id),
  );
});
test("MOQ, capacity, missing data, geography and turnaround influence explanations and ranking", () => {
  const f = result.matches.find((x) => x.participantId === factory.p.id);
  assert.equal(f.signals.quantity, "mismatch");
  const low = result.matches.find((x) => x.participantId === thin.p.id);
  assert.equal(low.tier, "potential");
  assert.ok(low.warnings.some((x) => x.code === "capacity_unknown"));
  assert.ok(low.warnings.some((x) => x.code === "turnaround_unknown"));
  const d = result.matches.find((x) => x.participantId === far.p.id);
  assert.notEqual(d.signals.location, "compatible");
  assert.equal(d.signals.time, "mismatch");
  assert.equal(d.tier, "potential");
});
test("unit incompatibility never fabricates a conversion or unlimited capacity", () => {
  const x = assessCapability(
    { ...request, unit: "kg" },
    s.getEnterprise(null, direct.p.id),
    s.getCapability(null, direct.c.id),
  );
  assert.equal(x.quantity, "unknown");
  assert.ok(x.warnings.some((x) => x.code === "units_unknown"));
});
test("structured composite requirements are additive and do not imply complete workflow readiness", () => {
  const r = q.createRequest(buyer.id, {
    title: "Packaging process",
    requirements: [
      { id: "bags", label: "Paper bags" },
      { id: "labels", label: "Label printing" },
    ],
  });
  assert.equal(r.requirements.length, 2);
  const a = assessCapability(
    { ...request, requirements: r.requirements },
    s.getEnterprise(null, direct.p.id),
    s.getCapability(null, direct.c.id),
  );
  assert.equal(a.tier, "potential");
  assert.ok(a.warnings.some((x) => x.code === "composite"));
  rejects(() =>
    q.updateRequest(buyer.id, r.id, {
      revision: r.revision,
      requirements: [
        { id: "x", label: "One" },
        { id: "x", label: "Two" },
      ],
    }),
  );
});
test("refresh deterministic, idempotent and versioned without resetting saved/dismissed decisions", () => {
  const before = result.matches.map((x) => x.participantId);
  record = result.matches[0];
  record = m.act(buyer.id, record.id, {
    status: "saved",
    revision: record.revision,
    requestRevision: request.revision,
  });
  const refreshed = m.generate(buyer.id, request.id, {
    requestRevision: request.revision,
    generationRevision: result.generation.revision,
    idempotencyKey: "test-refresh-key-001",
  });
  assert.deepEqual(
    refreshed.matches.map((x) => x.participantId),
    before,
  );
  assert.equal(refreshed.matches[0].status, "saved");
  const retry = m.generate(buyer.id, request.id, {
    requestRevision: request.revision,
    generationRevision: 1,
    idempotencyKey: "test-refresh-key-001",
  });
  assert.equal(retry.generation.revision, refreshed.generation.revision);
  rejects(
    () =>
      m.generate(buyer.id, request.id, {
        requestRevision: 1,
        generationRevision: 1,
      }),
    "revision_conflict",
  );
  result = refreshed;
  record = result.matches[0];
});
test("save/view/dismiss/restore enforce requester ownership, revisions and allowed states", () => {
  rejects(() => m.get(other.id, record.id), "not_found");
  rejects(() => m.list(other.id, request.id), "not_found");
  rejects(
    () =>
      m.act(other.id, record.id, {
        status: "saved",
        revision: record.revision,
        requestRevision: request.revision,
      }),
    "not_found",
  );
  rejects(() =>
    m.act(buyer.id, record.id, {
      status: "paid",
      revision: record.revision,
      requestRevision: request.revision,
    }),
  );
  rejects(
    () =>
      m.act(buyer.id, record.id, {
        status: "dismissed",
        revision: 1,
        requestRevision: request.revision,
      }),
    "revision_conflict",
  );
  record = m.act(buyer.id, record.id, {
    status: "dismissed",
    revision: record.revision,
    requestRevision: request.revision,
  });
  assert.equal(record.status, "dismissed");
  assert.equal(m.relevantRequests(direct.u.id).requests.length, 0);
  record = m.act(buyer.id, record.id, {
    status: "suggested",
    revision: record.revision,
    requestRevision: request.revision,
  });
  record = m.act(buyer.id, record.id, {
    status: "viewed",
    revision: record.revision,
    requestRevision: request.revision,
  });
  assert.equal(record.status, "viewed");
});
test("participant brief is minimal: no descriptions, budgets, addresses, attachments, owner or internal reasons", () => {
  const b = m.relevantRequests(agent.u.id).requests[0];
  assert.equal(b.title, request.title);
  for (const field of [
    "description",
    "budgetMin",
    "budgetMax",
    "attachments",
    "specifications",
    "deliveryLocation",
    "requesterId",
    "matchReasons",
  ])
    assert.equal(b[field], undefined);
  assert.ok(!JSON.stringify(b).includes("SECRET"));
  assert.ok(!JSON.stringify(b).includes("PRIVATE"));
  assert.equal(m.relevantRequests(other.id).requests.length, 0);
});
let agentMatch = result.matches.find((x) => x.participantId === agent.p.id);
test("I can help is an authorized auditable interest relationship, not a match status or order", () => {
  rejects(
    () =>
      m.expressInterest(other.id, agentMatch.id, {
        requestRevision: request.revision,
        revision: agentMatch.revision,
      }),
    "not_found",
  );
  const x = m.expressInterest(agent.u.id, agentMatch.id, {
    requestRevision: request.revision,
    revision: agentMatch.revision,
  });
  assert.equal(x.interest.status, "interested");
  assert.equal(
    m.expressInterest(agent.u.id, agentMatch.id, {
      requestRevision: request.revision,
      revision: agentMatch.revision,
    }).interest.id,
    x.interest.id,
  );
  assert.equal(m.get(buyer.id, agentMatch.id).interested, true);
  assert.equal(q.getRequest(buyer.id, request.id).status, "matching");
  const row = store.lookup("requestParticipants", x.interest.id);
  assert.equal(row.history[0].action, "participant_interested");
  assert.equal(row.provenance, null);
});
test("private Requests never become visible through matching and interest cannot be forced", () => {
  const privateR = q.createRequest(buyer.id, {
    title: "Private paper bags",
    description: "Confidential need never publish",
    location: "Nairobi",
    intent: "submit",
  });
  const active = q.changeRequestStatus(buyer.id, privateR.id, {
    status: "matching",
    revision: privateR.revision,
  });
  const privateM = m
    .list(buyer.id, active.id)
    .matches.find((x) => x.participantId === agent.p.id);
  assert.ok(privateM);
  assert.ok(
    !m
      .relevantRequests(agent.u.id)
      .requests.some((r) => r.requestId === active.id),
  );
  rejects(
    () =>
      m.expressInterest(agent.u.id, privateM.id, {
        requestRevision: active.revision,
        revision: privateM.revision,
      }),
    "not_found",
  );
});
test("material Request edits immediately invalidate recommendations and block new participant access", () => {
  request = q.updateRequest(buyer.id, request.id, {
    revision: request.revision,
    quantity: 50000,
  });
  assert.equal(m.list(buyer.id, request.id).stale, true);
  assert.equal(m.get(buyer.id, record.id).status, "expired");
  assert.deepEqual(m.get(buyer.id, record.id).matchReasons, []);
  assert.equal(m.relevantRequests(agent.u.id).requests.length, 0);
  rejects(
    () =>
      m.act(buyer.id, record.id, {
        status: "saved",
        revision: record.revision,
        requestRevision: request.revision,
      }),
    "stale_match",
  );
  rejects(
    () =>
      m.expressInterest(agent.u.id, agentMatch.id, {
        requestRevision: request.revision,
        revision: agentMatch.revision,
      }),
    "not_found",
  );
  result = m.generate(buyer.id, request.id, {
    requestRevision: request.revision,
    generationRevision: result.generation.revision,
  });
  assert.equal(result.stale, false);
  const a = result.matches.find((x) => x.id === agentMatch.id);
  assert.equal(a.interest.current, false);
  assert.equal(a.signals.quantity, "mismatch");
  agentMatch = a;
});
test("supply updates, verification expiry and assessment time invalidate cached assessments", () => {
  s.updateCapability(direct.u.id, direct.c.id, {
    revision: s.getCapability(direct.u.id, direct.c.id).revision,
    leadTime: { minDays: 15, maxDays: 20 },
  });
  assert.equal(m.get(buyer.id, record.id).stale, true);
  result = m.generate(buyer.id, request.id, {
    requestRevision: request.revision,
    generationRevision: result.generation.revision,
  });
  const row = store.lookup("matches", record.id);
  store.update("matches", row.id, { expiresAt: "2000-01-01T00:00:00Z" });
  assert.equal(m.get(buyer.id, row.id).stale, true);
  result = m.generate(buyer.id, request.id, {
    requestRevision: request.revision,
    generationRevision: result.generation.revision,
  });
});
test("indexed candidates rebuild after supply mutations, are bounded and exclude private/archived suppliers", () => {
  const x = search.capabilityCandidates({ text: "paper bags", limit: 3 });
  assert.ok(x.capabilities.length <= 3);
  assert.equal(x.limited, true);
  const fresh = make("match_fresh", { displayName: "New indexed supplier" });
  assert.ok(
    search
      .capabilityCandidates({ text: "paper bags" })
      .capabilities.some((c) => c.id === fresh.c.id),
  );
  s.updateEnterprise(fresh.u.id, fresh.p.id, {
    revision: fresh.p.revision,
    publication: "private",
  });
  assert.ok(
    !search
      .capabilityCandidates({ text: "paper bags" })
      .capabilities.some((c) => c.id === fresh.c.id),
  );
});
test("empty matching runs persist honestly, without random category businesses", () => {
  let r = q.createRequest(buyer.id, {
    title: "Specialized quantum gyroscope calibration",
    category: "Packaging",
    location: "Nairobi",
    description: "Specific technical calibration requirement",
    intent: "submit",
  });
  r = q.changeRequestStatus(buyer.id, r.id, {
    status: "matching",
    revision: r.revision,
  });
  const x = m.list(buyer.id, r.id);
  assert.equal(x.matches.length, 0);
  assert.equal(x.generation.matchCount, 0);
});
test("match generation failure rolls back transition, histories and match rows atomically", () => {
  const r = q.createRequest(buyer.id, {
    title: "Paper bags rollback",
    description: "Atomic demand transition test",
    location: "Nairobi",
    intent: "submit",
  });
  const oldCount = store.all("matches").length,
    before = fs.readFileSync(store._file, "utf8"),
    write = fs.writeFileSync;
  fs.writeFileSync = () => {
    throw Error("disk full");
  };
  try {
    assert.throws(
      () =>
        q.changeRequestStatus(buyer.id, r.id, {
          status: "matching",
          revision: r.revision,
        }),
      /disk full/,
    );
  } finally {
    fs.writeFileSync = write;
  }
  assert.equal(q.getRequest(buyer.id, r.id).status, "open");
  assert.equal(store.all("matches").length, oldCount);
  assert.equal(fs.readFileSync(store._file, "utf8"), before);
  assert.equal(store.lookup("requests", r.id).status, "open");
});
test("independent process reload preserves matches, decisions and interest", () => {
  const code = `const m=await import('./server/src/domain/matching.js');console.log(JSON.stringify(m.list(${JSON.stringify(buyer.id)},${JSON.stringify(request.id)})));`;
  const x = JSON.parse(
    execFileSync(process.execPath, ["--input-type=module", "-e", code], {
      cwd: path.resolve(import.meta.dirname, "../.."),
      env: process.env,
      encoding: "utf8",
    }),
  );
  assert.equal(
    x.matches.find((x) => x.participantId === agent.p.id).interested,
    true,
  );
  assert.equal(x.generation.requestRevision, request.revision);
});
test("capability constraints outrank profile defaults; sourcing origins are not delivery coverage", () => {
  const p = s.getEnterprise(null, plain.p.id),
    c = s.getCapability(null, plain.c.id);
  const supplier = {
    ...p,
    serviceAreas: ["Nairobi"],
    sourcingProfile: {
      regions: ["Nairobi"],
      sourcingLeadTime: { minDays: 1, maxDays: 2 },
    },
  };
  const a = assessCapability({ ...request, quantity: 5000 }, supplier, {
    ...c,
    supplyMode: "source",
    leadTime: { minDays: 365, maxDays: null },
    serviceAreas: ["Kisumu"],
  });
  assert.equal(a.time, "mismatch");
  assert.notEqual(a.location, "compatible");
  assert.ok(a.warnings.some((w) => w.code === "turnaround_mismatch"));
  const b = assessCapability(
    { ...request, quantity: 5000 },
    { ...supplier, serviceAreas: [] },
    {
      ...c,
      supplyMode: "source",
      serviceAreas: [],
      sourcingAccess: { ...c.sourcingAccess, regions: ["Nairobi"] },
    },
  );
  assert.notEqual(b.location, "compatible");
  const fallback = assessCapability({ ...request, quantity: 5000 }, supplier, {
    ...c,
    supplyMode: "source",
    serviceAreas: [],
    leadTime: { minDays: null, maxDays: null },
  });
  assert.equal(fallback.time, "compatible");
  assert.equal(fallback.location, "compatible");
});

test("known material conflicts and declared availability shortfalls cannot be strong matches", () => {
  const p = s.getEnterprise(null, plain.p.id),
    c = s.getCapability(null, plain.c.id);
  const a = assessCapability(
    {
      ...request,
      quantity: 5000,
      specifications: { material: "stainless steel" },
    },
    p,
    { ...c, materials: ["kraft paper"] },
  );
  assert.notEqual(a.tier, "strong");
  assert.ok(a.warnings.some((w) => w.code === "material_mismatch"));
  const b = assessCapability({ ...request, quantity: 5000 }, p, {
    ...c,
    availableCapacity: 200,
  });
  assert.equal(b.quantity, "mismatch");
  assert.ok(b.warnings.some((w) => w.code === "declared_available_shortfall"));
  const periodic = assessCapability({ ...request, quantity: 5000 }, p, {
    ...c,
    capacityPeriod: "month",
  });
  assert.notEqual(periodic.tier, "strong");
  assert.ok(periodic.warnings.some((w) => w.code === "capacity_window"));
});
test("supply verification changes invalidate matching until a refresh", () => {
  const before = m.get(
    buyer.id,
    result.matches.find((x) => x.participantId === plain.p.id).id,
  );
  assert.equal(before.stale, false);
  const verified = approve(plain.u, plain.p, "capability", plain.c.id);
  assert.equal(m.get(buyer.id, before.id).stale, true);
  result = m.generate(buyer.id, request.id, {
    requestRevision: request.revision,
    generationRevision: result.generation.revision,
  });
  assert.equal(m.get(buyer.id, before.id).stale, false);
  v.review(reviewer.id, verified.id, {
    status: "expired",
    revision: verified.revision,
    reason: "Test-only expiry of the scoped evidence review",
  });
  assert.equal(m.get(buyer.id, before.id).stale, true);
  result = m.generate(buyer.id, request.id, {
    requestRevision: request.revision,
    generationRevision: result.generation.revision,
  });
});
test("reads use indexed relationships and never regenerate matches or rescan the catalog", () => {
  const oldGeneration = m.list(buyer.id, request.id).generation.revision,
    cat = search.activeCapabilityCatalog();
  const all = store.all;
  store.all = function (collection) {
    if (["capabilities", "vendors", "requests"].includes(collection))
      throw Error("Unexpected catalog scan");
    return all.call(store, collection);
  };
  try {
    for (let i = 0; i < 5; i++) {
      assert.equal(
        m.list(buyer.id, request.id).generation.revision,
        oldGeneration,
      );
      m.relevantRequests(agent.u.id);
      assert.equal(search.activeCapabilityCatalog(), cat);
    }
  } finally {
    store.all = all;
  }
});
test("archive makes a saved match unavailable, and historical options can still be dismissed", () => {
  const h = m
    .list(buyer.id, request.id)
    .matches.find((x) => x.participantId === thin.p.id);
  const saved = m.act(buyer.id, h.id, {
    status: "saved",
    requestRevision: request.revision,
    revision: h.revision,
  });
  s.updateCapability(thin.u.id, thin.c.id, {
    revision: thin.c.revision,
    operatingStatus: "archived",
  });
  assert.equal(m.get(buyer.id, h.id).stale, true);
  assert.equal(
    m.act(buyer.id, h.id, {
      status: "dismissed",
      requestRevision: request.revision,
      revision: saved.revision,
    }).requesterState,
    "dismissed",
  );
});
test("private Request files cannot enter public capabilities or verification, even for their owner", () => {
  const f = uploads.saveUpload({
    bytes: image,
    ownerId: direct.u.id,
    purpose: "private_request",
  }).upload;
  rejects(() =>
    s.createCapability(direct.u.id, direct.p.id, {
      ...capInput,
      evidence: [{ uploadId: f.id }],
    }),
  );
  rejects(() =>
    v.submit(direct.u.id, direct.p.id, {
      kind: "identity",
      participantRevision: s.getEnterprise(direct.u.id, direct.p.id).revision,
      evidence: [{ uploadId: f.id, type: "business_registration" }],
    }),
  );
  assert.ok(!uploads.listUploads(direct.u.id).some((u) => u.id === f.id));
});
test("new feature toggle does not replace unrelated creator-campaign matching", () => {
  process.env.BRIEF_DISABLED_FEATURES = "request_matching";
  rejects(
    () =>
      m.generate(buyer.id, request.id, {
        requestRevision: request.revision,
        generationRevision: result.generation.revision,
      }),
    "feature_disabled",
  );
  delete process.env.BRIEF_DISABLED_FEATURES;
});
const { default: app } = await import("../src/index.js");
const srv = app.listen(0, "127.0.0.1");
await new Promise((r) => srv.once("listening", r));
const base = `http://127.0.0.1:${srv.address().port}/ingest`,
  buyerToken = auth.issueSession(buyer.id).token,
  agentToken = auth.issueSession(agent.u.id).token,
  strangerToken = auth.issueSession(other.id).token,
  reviewerToken = auth.issueSession(reviewer.id).token;
const call = async (url, method = "GET", data, token = buyerToken) => {
  const r = await fetch(base + url, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  return {
    status: r.status,
    body: await r.json().catch(() => null),
    headers: r.headers,
  };
};
try {
  for (const endpoint of [
    `/api/requests/${request.id}/matches`,
    `/api/matches/${record.id}`,
    "/api/supply/relevant-requests",
  ]) {
    const r = await call(endpoint, "GET", undefined, null);
    test("HTTP real-session gate " + endpoint, () =>
      assert.equal(r.status, 401),
    );
  }
  const denied = await call(
      `/api/requests/${request.id}/matches`,
      "GET",
      undefined,
      strangerToken,
    ),
    matchDenied = await call(
      `/api/matches/${record.id}`,
      "GET",
      undefined,
      agentToken,
    );
  test("HTTP owner-only Request/match reads", () => {
    assert.equal(denied.status, 404);
    assert.equal(matchDenied.status, 404);
  });
  const filtered = await call(
    `/api/requests/${request.id}/matches?role=source`,
  );
  test("HTTP explainable filtered results omit scores and private sourcing data", () => {
    assert.equal(filtered.status, 200);
    assert.ok(filtered.body.matches.every((m) => m.matchType === "source"));
    assert.ok(!JSON.stringify(filtered.body).includes("rankingValue"));
    assert.ok(!JSON.stringify(filtered.body).includes("supplyFingerprint"));
  });
  const wrongFilter = await call(
    `/api/requests/${request.id}/matches?score=90`,
  );
  test("HTTP unknown filters rejected", () =>
    assert.equal(wrongFilter.status, 400));
  const briefResult = await call(
    "/api/supply/relevant-requests",
    "GET",
    undefined,
    agentToken,
  );
  test("HTTP participant brief omits commercially sensitive fields", () => {
    assert.equal(briefResult.status, 200);
    for (const word of [
      "SECRET",
      "PRIVATE",
      "budgetMin",
      "attachments",
      "specifications",
      "deliveryLocation",
    ])
      assert.ok(!JSON.stringify(briefResult.body).includes(word));
  });
  const id = agentMatch.id,
    latest = m.get(buyer.id, id);
  const saved = await call(`/api/matches/${id}`, "PATCH", {
    requestRevision: request.revision,
    revision: latest.revision,
    status: "saved",
  });
  test("HTTP saved match persists", () => {
    assert.equal(saved.status, 200);
    assert.equal(m.get(buyer.id, id).status, "saved");
  });
  const intrude = await call(
    `/api/matches/${id}/interest`,
    "POST",
    { requestRevision: request.revision, revision: latest.revision },
    strangerToken,
  );
  test("HTTP interest cannot impersonate a supplier", () =>
    assert.equal(intrude.status, 404));
  const confirm = await call(
    `/api/matches/${id}/interest`,
    "POST",
    { requestRevision: request.revision, revision: saved.body.match.revision },
    agentToken,
  );
  test("HTTP interest reconfirmation for new Request revision", () => {
    assert.equal(confirm.status, 200);
    assert.equal(m.get(buyer.id, id).interest.current, true);
  });
  const withdrawal = await call(
    `/api/matches/${id}/interest`,
    "DELETE",
    { revision: confirm.body.request.interest.revision },
    agentToken,
  );
  test("HTTP owner can withdraw interest", () => {
    assert.equal(withdrawal.status, 200);
    assert.equal(m.get(buyer.id, id).interested, false);
  });
  const file = uploads.saveUpload({
    bytes: image,
    ownerId: buyer.id,
    purpose: "private_request",
  }).upload;
  request = q.updateRequest(buyer.id, request.id, {
    revision: request.revision,
    attachments: [{ uploadId: file.id }],
  });
  for (const token of [null, agentToken, reviewerToken]) {
    const r = await call(`/api/media/file/${file.id}`, "GET", undefined, token);
    test("Private Request bytes denied even to matched supplier / supply reviewer", () =>
      assert.equal(r.status, 404));
  }
  const bytes = await fetch(base + `/api/media/file/${file.id}`, {
    headers: { authorization: `Bearer ${buyerToken}` },
  });
  test("Private Request owner can read bytes with no-store", () => {
    assert.equal(bytes.status, 200);
    assert.match(bytes.headers.get("cache-control"), /no-store/);
  });
  test("Private Request images cannot be reused as public capability or supply review evidence", () => {
    rejects(
      () =>
        s.createCapability(buyer.id, direct.p.id, {
          ...capInput,
          evidence: [{ uploadId: file.id }],
        }),
      "not_found",
    );
    assert.equal(q.getRequest(buyer.id, request.id).attachments[0].url, null);
  });
  request = q.changeRequestStatus(buyer.id, request.id, {
    status: "cancelled",
    revision: request.revision,
  });
  test("cancel stops active matches and participant visibility", () => {
    assert.ok(m.list(buyer.id, request.id).matches.every((x) => x.stale));
    assert.equal(m.relevantRequests(agent.u.id).requests.length, 0);
    rejects(
      () =>
        m.generate(buyer.id, request.id, {
          requestRevision: request.revision,
          generationRevision: result.generation.revision,
        }),
      "invalid_transition",
    );
  });
} finally {
  await new Promise((r) => srv.close(r));
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(`PASSED ${count} FAILED 0`);
