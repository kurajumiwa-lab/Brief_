import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-supply-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const supply = await import("../src/domain/supply.js");
const verification = await import("../src/domain/supplyVerification.js");
const links = await import("../src/domain/requestParticipants.js");
const requests = await import("../src/domain/requests.js");
const uploads = await import("../src/domain/upload.js");
const vendors = await import("../src/domain/vendor.js");
const { default: app } = await import("../src/index.js");
let pass = 0;
const test = (n, fn) => {
  fn();
  pass++;
  console.log("PASS " + n);
};
const reject = (fn, code = "validation_error") =>
  assert.throws(fn, (e) => e.code === code);
const a = auth.createUser({
    handle: "supply_owner",
    password: "test-password-123",
  }),
  b = auth.createUser({
    handle: "supply_other",
    password: "test-password-123",
  }),
  reviewer = auth.createUser({
    handle: "supply_reviewer",
    password: "test-password-123",
  });
process.env.BRIEF_REVIEWERS = reviewer.handle;
const token = auth.issueSession(a.id).token,
  bt = auth.issueSession(b.id).token,
  rt = auth.issueSession(reviewer.id).token;
const enterprise = {
  displayName: "Test enterprise",
  legalName: "Private Legal Name",
  description: "Packaging and procurement services",
  businessType: "hybrid",
  supplyRole: "hybrid",
  location: "Industrial Area, Nairobi",
  serviceAreas: ["Nairobi", "Kiambu", "Machakos"],
  publication: "public",
  contactPreferences: {
    method: "phone",
    value: "+254700123456",
    public: false,
  },
};
const direct = {
  name: "Corrugated cartons",
  category: "Packaging",
  description: "Custom cartons made to requested dimensions",
  productsServices: ["Shipping boxes"],
  materials: ["Kraft paper"],
  minimumQuantity: 500,
  maximumQuantity: 50000,
  typicalCapacity: 10000,
  unit: "pieces",
  capacityPeriod: "week",
  capacityKind: "production",
  supplyMode: "direct",
  leadTime: { minDays: 3, maxDays: 7 },
  serviceAreas: ["Kenya-wide"],
};
let p, c, agent, agentCap;
test("enterprise reuses existing vendor and atomically creates first capability", () => {
  const prior = vendors.createVendor({
    ownerId: a.id,
    displayName: "Existing business",
  });
  p = supply.createEnterprise(a.id, { ...enterprise, firstCapability: direct });
  c = p.capabilities[0];
  assert.equal(p.id, prior.id);
  assert.equal(
    store.all("vendors").filter((r) => r.ownerId === a.id).length,
    1,
  );
  assert.equal(c.participantId, p.id);
  assert.equal(p.verification.identity.status, "unverified");
});
test("strict enterprise validation rejects owner, verification and invalid types", () => {
  for (const patch of [
    { ownerId: b.id },
    { verificationStatus: "verified" },
    { supplyRole: "factory_owner" },
    { businessType: "anything" },
    { location: "" },
    { serviceAreas: "Kenya" },
    { displayName: "x".repeat(241) },
    { contactPreferences: { method: "phone", value: "x", public: "true" } },
  ])
    reject(() => supply.createEnterprise(b.id, { ...enterprise, ...patch }));
  reject(() => supply.createEnterprise(null, enterprise), "no_token");
  reject(
    () =>
      supply.updateEnterprise(b.id, p.id, {
        displayName: "Stolen",
        revision: 1,
      }),
    "not_found",
  );
});
test("enterprise updates use revisions and legacy edits also invalidate stale revisions", () => {
  p = supply.updateEnterprise(a.id, p.id, {
    location: "Nairobi Industrial Area",
    revision: p.revision,
  });
  reject(
    () =>
      supply.updateEnterprise(a.id, p.id, {
        description: "Old overwrite",
        revision: 1,
      }),
    "revision_conflict",
  );
  vendors.updateVendor(p.id, { description: "Legacy edit" });
  reject(
    () =>
      supply.updateEnterprise(a.id, p.id, {
        description: "Old overwrite",
        revision: p.revision,
      }),
    "revision_conflict",
  );
  p = supply.getEnterprise(a.id, p.id);
});
test("capability shape, capacity and supply mode are server validated", () => {
  for (const patch of [
    { name: "" },
    { quantity: 1 },
    { typicalCapacity: -1 },
    { minimumQuantity: 100000 },
    { maximumQuantity: 100 },
    { unit: "" },
    { leadTime: { minDays: 7, maxDays: 2 } },
    { materials: "steel" },
    { verified: true },
    { availableCapacity: Infinity },
    { specifications: [{ name: "x", value: "y", verified: true }] },
    { supplyMode: "source", capacityKind: "production" },
  ])
    reject(() => supply.createCapability(a.id, p.id, { ...direct, ...patch }));
  reject(
    () => supply.updateCapability(b.id, c.id, { name: "Steal", revision: 1 }),
    "not_found",
  );
  const updated = supply.updateCapability(a.id, c.id, {
    typicalCapacity: 12000,
    revision: c.revision,
  });
  assert.equal(updated.capacityInformation.basis, "stated_by_business");
  reject(
    () =>
      supply.updateCapability(a.id, c.id, {
        name: "Stale",
        revision: c.revision,
      }),
    "revision_conflict",
  );
  c = updated;
});
test("deduplicated capability creation and atomic rollback of failed onboarding", () => {
  const once = supply.createCapability(a.id, p.id, {
    ...direct,
    name: "Product labels",
    idempotencyKey: "capability-repeat-0001",
  });
  assert.equal(
    supply.createCapability(a.id, p.id, {
      ...direct,
      name: "Product labels",
      idempotencyKey: "capability-repeat-0001",
    }).id,
    once.id,
  );
  reject(
    () =>
      supply.createCapability(a.id, p.id, {
        ...direct,
        name: "Different",
        idempotencyKey: "capability-repeat-0001",
      }),
    "idempotency_conflict",
  );
  const before = fs.readFileSync(store._file, "utf8"),
    count = store.all("vendors").length;
  const original = fs.writeFileSync;
  fs.writeFileSync = () => {
    throw Error("disk full");
  };
  try {
    assert.throws(
      () =>
        supply.createEnterprise(b.id, {
          ...enterprise,
          firstCapability: direct,
        }),
      /disk full/,
    );
  } finally {
    fs.writeFileSync = original;
  }
  assert.equal(store.all("vendors").length, count);
  assert.equal(fs.readFileSync(store._file, "utf8"), before);
  assert.equal(supply.myEnterprise(b.id), null);
});
test("sourcing-only participant cannot masquerade as manufacturer or direct capacity", () => {
  reject(() =>
    supply.createEnterprise(b.id, {
      ...enterprise,
      businessType: "manufacturer",
      supplyRole: "verified_sourcing_agent",
    }),
  );
  agent = supply.createEnterprise(b.id, {
    ...enterprise,
    displayName: "Independent sourcing",
    businessType: "sourcing_agent",
    supplyRole: "verified_sourcing_agent",
  });
  reject(() => supply.createCapability(b.id, agent.id, direct));
  agentCap = supply.createCapability(b.id, agent.id, {
    ...direct,
    name: "Can source cartons",
    supplyMode: "source",
    capacityKind: "sourcing_access",
  });
  agent = supply.saveSourcing(b.id, agent.id, {
    revision: agent.revision,
    serviceDescription: "Can coordinate independent procurement",
    experienceYears: 7,
    categories: ["Packaging"],
    regions: ["Nairobi", "Kiambu"],
    privateNetworks: "CONFIDENTIAL supplier contacts",
    inspectionCapability: true,
  });
  assert.match(agent.roleLabel, /not verified/);
  assert.match(agent.disclosure, /Not the manufacturer/);
  assert.equal(
    supply.getEnterprise(null, agent.id).sourcingProfile.privateNetworks,
    undefined,
  );
  reject(
    () =>
      supply.saveSourcing(a.id, agent.id, {
        revision: agent.revision,
        privateNetworks: "Steal",
      }),
    "not_found",
  );
});
test("public projections and legacy vendor routes never expose private evidence, contacts or networks", () => {
  const pub = supply.getEnterprise(null, p.id);
  assert.equal(pub.ownerId, undefined);
  assert.equal(pub.legalName, undefined);
  assert.equal(pub.history, undefined);
  assert.equal(pub.contactPreferences.value, null);
  assert.equal(vendors.getVendor(agent.id).enterprise, undefined);
  p = supply.updateEnterprise(a.id, p.id, {
    publication: "private",
    revision: p.revision,
  });
  reject(() => supply.getEnterprise(null, p.id), "not_found");
  assert.equal(vendors.getVendor(p.id).displayName, "Private enterprise");
  assert.ok(!vendors.listVendors().some((v) => v.id === p.id));
  p = supply.updateEnterprise(a.id, p.id, {
    publication: "public",
    revision: p.revision,
  });
});
const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
  "base64",
);
let privateFile, publicFile, record;
test("private evidence uses the SAME upload system but separate immutable access and deduplication", () => {
  privateFile = uploads.saveUpload({
    bytes: image,
    ownerId: b.id,
    purpose: "private_evidence",
    originalName: "private-proof.png",
  }).upload;
  publicFile = uploads.saveUpload({
    bytes: image,
    ownerId: b.id,
    originalName: "public-capability.png",
  }).upload;
  assert.notEqual(privateFile.id, publicFile.id);
  assert.ok(!uploads.listUploads(b.id).some((u) => u.id === privateFile.id));
  reject(() =>
    supply.createCapability(b.id, agent.id, {
      ...direct,
      supplyMode: "source",
      capacityKind: "sourcing_access",
      evidence: [{ uploadId: privateFile.id }],
    }),
  );
  reject(() =>
    requests.createRequest(b.id, {
      title: "Private upload leak",
      attachments: [{ uploadId: privateFile.id }],
    }),
  );
});
test("verification submitted, reviewed and approved only by authorized non-owner with evidence", () => {
  const input = {
    kind: "sourcing_role",
    participantRevision: agent.revision,
    evidence: [
      {
        uploadId: privateFile.id,
        type: "supplier_relationship",
        note: "Private reference",
      },
    ],
    note: "PRIVATE review note",
  };
  record = verification.submit(b.id, agent.id, input);
  assert.equal(record.status, "submitted");
  assert.equal(verification.submit(b.id, agent.id, input).id, record.id);
  assert.equal(uploads.deleteUpload(privateFile.id, b.id).status, 409);
  reject(
    () =>
      verification.review(a.id, record.id, {
        status: "under_review",
        revision: 1,
      }),
    "forbidden_capability",
  );
  process.env.BRIEF_REVIEWERS = `${reviewer.handle},${b.handle}`;
  reject(
    () =>
      verification.review(b.id, record.id, {
        status: "under_review",
        revision: 1,
      }),
    "self_review",
  );
  process.env.BRIEF_REVIEWERS = reviewer.handle;
  reject(
    () =>
      verification.review(reviewer.id, record.id, {
        status: "verified",
        revision: 1,
        reason: "Skip the review",
      }),
    "invalid_transition",
  );
  record = verification.review(reviewer.id, record.id, {
    status: "under_review",
    revision: 1,
  });
  record = verification.review(reviewer.id, record.id, {
    status: "verified",
    revision: 2,
    reason: "Manually reviewed operating evidence and sourcing references",
  });
  assert.equal(record.effectiveStatus, "verified");
  // Agent role alone never verifies a person's or enterprise's identity.
  assert.match(supply.getEnterprise(null, agent.id).roleLabel, /not verified/);
});
test("verified agent requires both identity and scoped sourcing review; no manufacturer badge", () => {
  let r = verification.submit(b.id, agent.id, {
    kind: "identity",
    participantRevision: agent.revision,
    evidence: [{ uploadId: privateFile.id, type: "business_registration" }],
  });
  r = verification.review(reviewer.id, r.id, {
    status: "under_review",
    revision: r.revision,
  });
  verification.review(reviewer.id, r.id, {
    status: "verified",
    revision: r.revision,
    reason: "Manually reviewed business identity evidence",
  });
  const pub = supply.getEnterprise(null, agent.id);
  assert.equal(pub.roleLabel, "Verified Sourcing Agent");
  assert.equal(pub.verification.businessType.status, "unverified");
  assert.ok(!JSON.stringify(pub).includes("PRIVATE"));
  assert.ok(!JSON.stringify(pub).includes(privateFile.id));
});
test("verification expiry, profile edits, stale reviews, rejection and resubmission are auditable", () => {
  record = verification.review(reviewer.id, record.id, {
    status: "expired",
    revision: record.revision,
    reason: "Evidence no longer sufficient; role check expired",
  });
  assert.match(supply.getEnterprise(null, agent.id).roleLabel, /not verified/);
  let r = verification.submit(b.id, agent.id, {
    kind: "sourcing_role",
    participantRevision: agent.revision,
    evidence: [{ uploadId: privateFile.id, type: "supplier_relationship" }],
  });
  r = verification.review(reviewer.id, r.id, {
    status: "under_review",
    revision: 1,
  });
  r = verification.review(reviewer.id, r.id, {
    status: "rejected",
    revision: 2,
    reason: "Additional independent sourcing evidence is needed",
  });
  assert.equal(r.status, "rejected");
  r = verification.submit(b.id, agent.id, {
    kind: "sourcing_role",
    participantRevision: agent.revision,
    evidence: [{ uploadId: privateFile.id, type: "operating_evidence" }],
  });
  agent = supply.updateEnterprise(b.id, agent.id, {
    displayName: "Updated sourcing identity",
    revision: agent.revision,
  });
  assert.equal(
    supply.getEnterprise(null, agent.id).verification.identity.status,
    "expired",
  );
  reject(
    () =>
      verification.review(reviewer.id, r.id, {
        status: "under_review",
        revision: 1,
      }),
    "subject_changed",
  );
  assert.ok(
    verification.myRecords(b.id, agent.id).some((r) => r.history.length === 3),
  );
});
test("capability-first search respects category, physical location, coverage and both supply modes", () => {
  assert.ok(supply.searchCapabilities(a.id, { q: "cartons" }).total >= 2);
  assert.equal(
    supply.searchCapabilities(a.id, {
      q: "Shipping boxes",
      supplyMode: "source",
    }).capabilities[0].capability.supplyMode,
    "source",
  );
  assert.ok(
    supply.searchCapabilities(a.id, {
      q: "cartons",
      category: "Packaging",
      location: "Nairobi",
      serviceArea: "Kenya-wide",
      supplyMode: "direct",
    }).total >= 1,
  );
  assert.equal(supply.searchCapabilities(a.id, { q: "CONFIDENTIAL" }).total, 0);
  assert.equal(
    supply.searchCapabilities(a.id, { q: "Test enterprise" }).total,
    0,
  );
  assert.equal(
    supply.searchCapabilities(a.id, { q: "cartons", location: "Kisumu" }).total,
    0,
  );
  assert.ok(
    supply
      .searchCapabilities(a.id, { supplyRole: "verified_sourcing_agent" })
      .capabilities.every(
        (r) => r.participant.supplyRole === "verified_sourcing_agent",
      ),
  );
});
let request, link;
test("Request ↔ participant ↔ capability is explicit, owner-only and never an automatic match", () => {
  request = requests.createRequest(a.id, {
    title: "Need cartons for shipping",
  });
  assert.deepEqual(links.list(a.id, request.id), []);
  link = links.add(a.id, request.id, { capabilityId: agentCap.id });
  assert.equal(link.status, "potential");
  assert.equal(link.provenance, null);
  assert.equal(link.origin, "requester_selected");
  assert.equal(
    links.add(a.id, request.id, { capabilityId: agentCap.id }).id,
    link.id,
  );
  assert.equal(requests.getRequest(a.id, request.id).status, "draft");
  reject(() => links.list(b.id, request.id), "not_found");
  reject(
    () => links.add(b.id, request.id, { capabilityId: agentCap.id }),
    "not_found",
  );
  reject(() =>
    links.add(a.id, request.id, { capabilityId: agentCap.id, score: 95 }),
  );
});
test("archive removes capability from search, preserves links as unavailable and rejects further edits", () => {
  supply.updateCapability(b.id, agentCap.id, {
    revision: agentCap.revision,
    operatingStatus: "archived",
  });
  assert.equal(links.list(a.id, request.id)[0].available, false);
  assert.ok(
    !supply
      .searchCapabilities(a.id, { q: "cartons" })
      .capabilities.some((r) => r.capability.id === agentCap.id),
  );
  reject(
    () =>
      supply.updateCapability(b.id, agentCap.id, {
        revision: 2,
        name: "Revive",
      }),
    "invalid_transition",
  );
  links.remove(a.id, request.id, link.id, { revision: 1 });
  assert.deepEqual(links.list(a.id, request.id), []);
});
test("enterprise, capability and scoped verification survive independent process reload", () => {
  const js = `const s=await import('./server/src/domain/supply.js'); console.log(JSON.stringify(s.getEnterprise(${JSON.stringify(a.id)},${JSON.stringify(p.id)})));`;
  const read = JSON.parse(
    execFileSync(process.execPath, ["--input-type=module", "-e", js], {
      cwd: path.resolve(import.meta.dirname, "../.."),
      env: process.env,
      encoding: "utf8",
    }),
  );
  assert.equal(read.capabilities[0].typicalCapacity, 12000);
  assert.equal(read.displayName, p.displayName);
});
test("legacy person approvals neither inherit supply standing nor mutate scoped evidence records", () => {
  store.insert("verificationRecords", {
    id: "legacy-approved",
    userId: a.id,
    kind: "identity",
    status: "approved",
    reviewedAt: new Date().toISOString(),
  });
  assert.equal(
    supply.getEnterprise(null, p.id).verification.identity.status,
    "unverified",
  );
});
test("scoped capacity review never creates a live capacity confirmation and expires on capability edit", () => {
  const proof = uploads.saveUpload({
    bytes: image,
    ownerId: a.id,
    purpose: "private_evidence",
  }).upload;
  let r = verification.submit(a.id, p.id, {
    kind: "capacity",
    capabilityId: c.id,
    participantRevision: p.revision,
    evidence: [{ uploadId: proof.id, type: "capability_evidence" }],
  });
  r = verification.review(reviewer.id, r.id, {
    status: "under_review",
    revision: r.revision,
  });
  reject(() =>
    verification.review(reviewer.id, r.id, {
      status: "verified",
      revision: r.revision,
      reason: "Evidence reviewed carefully",
      expiresAt: "invalid",
    }),
  );
  reject(() =>
    verification.review(reviewer.id, r.id, {
      status: "verified",
      revision: r.revision,
      reason: "Evidence reviewed carefully",
      expiresAt: "2000-01-01",
    }),
  );
  reject(() =>
    verification.review(reviewer.id, r.id, {
      status: "verified",
      revision: r.revision,
      reason: "Evidence reviewed carefully",
      expiresAt: "2099-01-01",
    }),
  );
  verification.review(reviewer.id, r.id, {
    status: "verified",
    revision: r.revision,
    reason: "Manually reviewed stated production limits for this capability",
  });
  const reviewed = supply.getCapability(null, c.id);
  assert.equal(reviewed.capacityInformation.basis, "verified");
  assert.equal(reviewed.capacityInformation.currentConfirmation, null);
  assert.equal(reviewed.verification.status, "unverified");
  c = supply.updateCapability(a.id, c.id, {
    revision: c.revision,
    typicalCapacity: 13000,
  });
  assert.equal(
    supply.getCapability(null, c.id).capacityInformation.verification.status,
    "expired",
  );
});
test("submission rejects public files, other-owner documents and nonexistent capability scopes", () => {
  for (const bad of [publicFile.id, "missing-proof"])
    reject(() =>
      verification.submit(a.id, p.id, {
        kind: "identity",
        participantRevision: p.revision,
        evidence: [{ uploadId: bad, type: "business_registration" }],
      }),
    );
  reject(() =>
    verification.submit(a.id, p.id, {
      kind: "identity",
      participantRevision: p.revision,
      evidence: [{ uploadId: privateFile.id, type: "business_registration" }],
    }),
  );
  reject(
    () =>
      verification.submit(a.id, p.id, {
        kind: "capacity",
        capabilityId: agentCap.id,
        participantRevision: p.revision,
        evidence: [{ uploadId: privateFile.id, type: "capability_evidence" }],
      }),
    "not_found",
  );
});
const legacyVerification = await import("../src/domain/verification.js");
test("legacy verification endpoints exclude scoped records and cannot approve or revoke them", () => {
  assert.ok(
    legacyVerification.myRecords(b.id).every((r) => r.scope !== "supply"),
  );
  assert.throws(
    () =>
      legacyVerification.decide(reviewer.id, record.id, {
        decision: "approved",
      }),
    /not found/,
  );
  assert.throws(
    () => legacyVerification.revoke(reviewer.id, record.id, "Reviewer reason"),
    /not found/,
  );
});
const srv = app.listen(0, "127.0.0.1");
await new Promise((r) => srv.once("listening", r));
const base = `http://127.0.0.1:${srv.address().port}`;
const call = async (url, method = "GET", body, session = token) => {
  const r = await fetch(`${base}/ingest${url}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(session ? { authorization: `Bearer ${session}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: r.status,
    body: await r.json().catch(() => null),
    headers: r.headers,
  };
};
try {
  for (const url of [
    "/api/me/enterprise",
    "/api/capabilities/search",
    `/api/enterprises/${p.id}/verification`,
  ]) {
    const r = await call(url, "GET", undefined, null);
    test("HTTP unauthenticated rejection " + url, () =>
      assert.equal(r.status, 401),
    );
  }
  const pub = await call(
    `/api/public/enterprises/${agent.id}`,
    "GET",
    undefined,
    null,
  );
  test("HTTP public projection protects evidence and private networks", () => {
    assert.equal(pub.status, 200);
    const str = JSON.stringify(pub.body);
    for (const sensitive of [
      "privateNetworks",
      "CONFIDENTIAL",
      "PRIVATE",
      "+254700123456",
      privateFile.id,
      "Private Legal Name",
    ])
      assert.ok(!str.includes(sensitive), sensitive);
  });
  for (const session of [null, token]) {
    const r = await call(
      `/api/media/file/${privateFile.id}`,
      "GET",
      undefined,
      session,
    );
    test("HTTP private bytes denied to anonymous/stranger", () =>
      assert.equal(r.status, 404));
  }
  for (const session of [bt, rt]) {
    const r = await fetch(`${base}/ingest/api/media/file/${privateFile.id}`, {
      headers: { authorization: `Bearer ${session}` },
    });
    test("HTTP evidence readable only by owner/reviewer with no-store caching", () => {
      assert.equal(r.status, 200);
      assert.match(r.headers.get("cache-control"), /no-store/);
    });
  }
  const publicBytes = await fetch(
    `${base}/ingest/api/media/file/${publicFile.id}`,
  );
  test("Existing public image behavior unchanged", () =>
    assert.equal(publicBytes.status, 200));
  const denied = await call(`/api/enterprises/${agent.id}`, "PATCH", {
    revision: agent.revision,
    displayName: "Stolen",
  });
  test("HTTP enterprise ownership", () => assert.equal(denied.status, 404));
  const caps = await call(`/api/enterprises/${p.id}/capabilities`, "POST", {
    ...direct,
    name: "HTTP capability",
  });
  test("HTTP real capability creation", () => assert.equal(caps.status, 201));
  const malformed = await call(
    `/api/enterprises/${p.id}/capabilities`,
    "POST",
    { ...direct, typicalCapacity: "lots" },
  );
  test("HTTP malformed capacity rejected", () =>
    assert.equal(malformed.status, 400));
  const edit = await call(
    `/api/supply/capabilities/${caps.body.capability.id}`,
    "PATCH",
    { revision: 1, name: "HTTP updated capability" },
  );
  const read = await call(
    `/api/supply/capabilities/${caps.body.capability.id}`,
  );
  test("HTTP edit persists", () => {
    assert.equal(edit.status, 200);
    assert.equal(read.body.capability.name, "HTTP updated capability");
  });
  const denyCap = await call(
    `/api/supply/capabilities/${c.id}`,
    "DELETE",
    { revision: c.revision },
    bt,
  );
  test("HTTP capability archive ownership", () =>
    assert.equal(denyCap.status, 404));
  const unauthorizedReview = await call("/api/ops/supply-verification");
  test("HTTP reviewer permission enforced", () =>
    assert.equal(unauthorizedReview.status, 403));
  const privacy = await call(`/api/enterprises/${agent.id}/verification`);
  test("HTTP other owner cannot read verification evidence metadata", () =>
    assert.equal(privacy.status, 404));
  const ref = await call(`/api/requests/${request.id}/participants`, "POST", {
    capabilityId: c.id,
  });
  const reqPrivate = await call(
    `/api/requests/${request.id}/participants`,
    "GET",
    undefined,
    bt,
  );
  test("HTTP potential references do not disclose demand to suppliers", () => {
    assert.equal(ref.status, 201);
    assert.equal(reqPrivate.status, 404);
  });
  const ownerCreate = await call(
    "/api/enterprises",
    "POST",
    { ...enterprise, displayName: "HTTP reviewer enterprise" },
    rt,
  );
  test("HTTP canonical enterprise onboarding", () =>
    assert.equal(ownerCreate.status, 201));
  const ownProfile = await call("/api/me/enterprise", "GET", undefined, rt);
  test("HTTP own enterprise reload", () =>
    assert.equal(
      ownProfile.body.enterprise.id,
      ownerCreate.body.enterprise.id,
    ));
  const sourceEdit = await call(
    `/api/enterprises/${agent.id}/sourcing`,
    "PUT",
    {
      revision: agent.revision,
      privateNetworks: "PRIVATE HTTP source network",
      categories: ["Packaging"],
    },
    bt,
  );
  const sourceGet = await call(
    `/api/enterprises/${agent.id}/sourcing`,
    "GET",
    undefined,
    bt,
  );
  test("HTTP sourcing write and owner retrieval", () => {
    assert.equal(sourceEdit.status, 200);
    assert.equal(
      sourceGet.body.sourcingProfile.privateNetworks,
      "PRIVATE HTTP source network",
    );
  });
  const filtered = await call(
    "/api/capabilities/search?q=cartons&supplyMode=direct&category=Packaging&location=Nairobi&serviceArea=Kenya-wide",
  );
  test("HTTP capability search applies filters", () => {
    assert.equal(filtered.status, 200);
    assert.ok(filtered.body.capabilities.some((r) => r.capability.id === c.id));
  });
  const stale = await call(`/api/enterprises/${p.id}`, "PATCH", {
    revision: 1,
    displayName: "Old name",
  });
  test("HTTP stale enterprise conflict", () => assert.equal(stale.status, 409));
  const proof = uploads.saveUpload({
    bytes: image,
    ownerId: a.id,
    purpose: "private_evidence",
  }).upload;
  const submitted = await call(
    `/api/enterprises/${p.id}/verification`,
    "POST",
    {
      kind: "business_type",
      participantRevision: p.revision,
      evidence: [{ uploadId: proof.id, type: "business_registration" }],
    },
  );
  test("HTTP evidence submission", () => assert.equal(submitted.status, 201));
  const underReview = await call(
    `/api/ops/supply-verification/${submitted.body.record.id}`,
    "PATCH",
    { status: "under_review", revision: 1 },
    rt,
  );
  const rejected = await call(
    `/api/ops/supply-verification/${submitted.body.record.id}`,
    "PATCH",
    {
      status: "rejected",
      revision: 2,
      reason: "Insufficient proof for the stated business type",
    },
    rt,
  );
  test("HTTP manual reviewer transitions and audit", () => {
    assert.equal(underReview.status, 200);
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.record.history.length, 3);
  });
  const stranger = await call(
    `/api/ops/supply-verification/${submitted.body.record.id}`,
    "GET",
    undefined,
    bt,
  );
  test("HTTP private reviewer metadata stays privileged", () =>
    assert.equal(stranger.status, 403));
  process.env.BRIEF_DISABLED_FEATURES = "supply";
  const disabled = await call(`/api/requests/${request.id}/participants`);
  test("Feature disable also disables Request supply links", () =>
    assert.equal(disabled.status, 503));
  delete process.env.BRIEF_DISABLED_FEATURES;
  requests.changeRequestStatus(a.id, request.id, {
    revision: request.revision,
    status: "cancelled",
  });
  test("Cancelled Request cannot add supply links", () =>
    reject(
      () => links.add(a.id, request.id, { capabilityId: c.id }),
      "invalid_transition",
    ));
} finally {
  await new Promise((r) => srv.close(r));
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(`PASSED ${pass} FAILED 0`);
