import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-requests-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const domain = await import("../src/domain/requests.js");
const uploads = await import("../src/domain/upload.js");
const { default: app } = await import("../src/index.js");
let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`PASS ${name}`);
};
const rejects = (fn, code = "validation_error") =>
  assert.throws(fn, (e) => e.code === code);
const user = auth.createUser({
  handle: "request_buyer",
  password: "test-password-123",
});
const stranger = auth.createUser({
  handle: "request_stranger",
  password: "test-password-123",
});
const token = auth.issueSession(user.id).token;
const otherToken = auth.issueSession(stranger.id).token;
const valid = {
  title: "2,000 branded paper bags",
  description: "Printed paper bags for our restaurant takeaway orders.",
  quantity: 2000,
  unit: "pieces",
  location: "Nairobi",
  deliveryLocation: "Industrial Area, Nairobi",
  requiredBy: "2099-09-12",
  category: "Packaging",
  budgetMin: 0,
  budgetMax: 50000,
  currency: "KES",
  specifications: {
    material: "Kraft paper",
    dimensions: "20 × 30 cm",
    brandRequirements: "Two-color printed logo",
  },
  businessContext: {
    companyName: "Test buyer",
    buyingFrequency: "Monthly",
    recurringQuantity: 2000,
    recurringUnit: "pieces",
  },
};
let draft;
test("draft creation, structured context and immutable ownership", () => {
  draft = domain.createRequest(user.id, valid);
  assert.equal(draft.status, "draft");
  assert.equal(draft.requesterId, user.id);
  assert.equal(draft.specifications.material, "Kraft paper");
  assert.equal(draft.history[0].action, "created");
  draft.title = "mutated outside store";
  assert.equal(domain.getRequest(user.id, draft.id).title, valid.title);
});
test("owner-only retrieval/list/update/transition", () => {
  assert.equal(domain.listRequests(stranger.id).length, 0);
  rejects(() => domain.getRequest(stranger.id, draft.id), "not_found");
  rejects(
    () =>
      domain.updateRequest(stranger.id, draft.id, {
        title: "Stolen",
        revision: 1,
      }),
    "not_found",
  );
  rejects(
    () =>
      domain.changeRequestStatus(stranger.id, draft.id, {
        status: "cancelled",
        revision: 1,
      }),
    "not_found",
  );
  rejects(() => domain.createRequest(null, valid), "no_token");
});
test("validation: strict shapes, oversized fields, amounts, dates, attachments, protected fields", () => {
  for (const patch of [
    { title: "" },
    { title: "x".repeat(181) },
    { description: "x".repeat(5001) },
    { quantity: -1 },
    { quantity: 0 },
    { quantity: "20" },
    { quantity: Infinity },
    { budgetMin: -1 },
    { budgetMin: 50001 },
    { currency: "XYZ" },
    { currency: "kes" },
    { requiredBy: "2027-02-29" },
    { requiredBy: "tomorrow" },
    { specifications: [] },
    { specifications: { material: { bad: 1 } } },
    { specifications: { color: "x".repeat(1001) } },
    { businessContext: { recurringQuantity: -1 } },
    { attachments: [{ url: "javascript:alert(1)" }] },
    { attachments: [{ uploadId: "../passwd" }] },
    { attachments: Array(9).fill({ uploadId: "none" }) },
    { requesterId: stranger.id },
    { status: "completed" },
    { history: [] },
    { revision: 12 },
    { origin: { objectId: "private" } },
    { urgency: "yesterday" },
    { preferredSupplierType: "factory_employee" },
    { visibility: "anyone" },
  ]) {
    rejects(() => domain.createRequest(user.id, { ...valid, ...patch }));
  }
  for (const body of [null, [], "text"])
    rejects(() => domain.createRequest(user.id, body));
});
test("all rejected updates leave both disk and memory unchanged", () => {
  const before = fs.readFileSync(store._file, "utf8");
  rejects(() =>
    domain.updateRequest(user.id, draft.id, {
      title: "valid new title",
      quantity: -1,
      revision: 1,
    }),
  );
  assert.equal(fs.readFileSync(store._file, "utf8"), before);
  assert.equal(domain.getRequest(user.id, draft.id).title, valid.title);
});
test("edit, optimistic conflict and draft → open → matching", () => {
  draft = domain.updateRequest(user.id, draft.id, {
    quantity: 3000,
    revision: 1,
  });
  assert.equal(draft.quantity, 3000);
  rejects(
    () =>
      domain.updateRequest(user.id, draft.id, { quantity: 99, revision: 1 }),
    "revision_conflict",
  );
  draft = domain.changeRequestStatus(user.id, draft.id, {
    status: "open",
    revision: draft.revision,
  });
  draft = domain.changeRequestStatus(user.id, draft.id, {
    status: "matching",
    revision: draft.revision,
  });
  assert.equal(draft.status, "matching");
  assert.equal(draft.history.length, 5);
  assert.equal(draft.history.at(-1).action, "matching_started");
  for (const status of [
    "draft",
    "open",
    "quoted",
    "in_progress",
    "completed",
    "expired",
    "bogus",
  ])
    rejects(
      () =>
        domain.changeRequestStatus(user.id, draft.id, {
          status,
          revision: draft.revision,
        }),
      "invalid_transition",
    );
});
test("cancel is durable, terminal and audited", () => {
  draft = domain.changeRequestStatus(user.id, draft.id, {
    status: "cancelled",
    revision: draft.revision,
  });
  rejects(
    () =>
      domain.updateRequest(user.id, draft.id, {
        title: "Rewrite past",
        revision: draft.revision,
      }),
    "invalid_transition",
  );
  rejects(
    () =>
      domain.changeRequestStatus(user.id, draft.id, {
        status: "open",
        revision: draft.revision,
      }),
    "invalid_transition",
  );
  assert.equal(draft.history.at(-1).action, "cancelled");
  assert.ok(
    store.find(
      "auditLog",
      (a) => a.objectId === draft.id && a.action === "request_cancelled",
    ),
  );
  const minimal = domain.createRequest(user.id, { title: "Office chairs" });
  assert.equal(
    domain.changeRequestStatus(user.id, minimal.id, {
      status: "cancelled",
      revision: 1,
    }).status,
    "cancelled",
  );
});
test("submit requires actionable description/location and a future deadline", () => {
  rejects(() =>
    domain.createRequest(user.id, { title: "Office chairs", intent: "submit" }),
  );
  rejects(() =>
    domain.createRequest(user.id, {
      ...valid,
      requiredBy: "2000-01-01",
      intent: "submit",
    }),
  );
  assert.equal(
    domain.createRequest(user.id, {
      ...valid,
      requesterType: "individual",
      intent: "submit",
    }).status,
    "open",
  );
});
test("attachments reuse owned, byte-available uploads; no arbitrary URLs or verification", () => {
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
    "base64",
  );
  const result = uploads.saveUpload({
    ownerId: user.id,
    bytes: image,
    originalName: "spec.png",
  });
  assert.ok(result.ok, result.error);
  const uploadId = result.upload.id;
  const row = domain.createRequest(user.id, {
    ...valid,
    attachments: [{ uploadId }],
    preferredSupplierType: "verified_sourcing_agent",
  });
  assert.equal(row.attachments[0].available, true);
  assert.equal(row.verified, undefined);
  rejects(() =>
    domain.createRequest(stranger.id, {
      ...valid,
      attachments: [{ uploadId }],
    }),
  );
  rejects(() =>
    domain.createRequest(user.id, {
      ...valid,
      attachments: [{ uploadId }, { uploadId }],
    }),
  );
  uploads.deleteUpload(uploadId, user.id);
  assert.equal(
    domain.getRequest(user.id, row.id).attachments[0].available,
    false,
  );
});
test("idempotent creation cannot duplicate demand or overwrite a previous submission", () => {
  const input = {
    ...valid,
    intent: "submit",
    idempotencyKey: "request-retry-key-0001",
  };
  const first = domain.createRequest(user.id, input);
  const count = store.all("requests").length;
  assert.equal(domain.createRequest(user.id, input).id, first.id);
  assert.equal(store.all("requests").length, count);
  assert.equal(domain.getRequest(user.id, first.id).history.length, 1);
  rejects(
    () => domain.createRequest(user.id, { ...input, quantity: 1 }),
    "idempotency_conflict",
  );
  assert.notEqual(domain.createRequest(stranger.id, input).id, first.id);
});
test("disk-write failure rolls back insert and update in memory", () => {
  const original = fs.writeFileSync;
  const before = fs.readFileSync(store._file, "utf8");
  const count = store.all("requests").length;
  const editable = domain.createRequest(user.id, valid);
  fs.writeFileSync = () => {
    throw new Error("simulated disk full");
  };
  try {
    assert.throws(() => domain.createRequest(user.id, valid), /disk full/);
    assert.throws(
      () =>
        domain.updateRequest(user.id, editable.id, {
          title: "Should not persist",
          revision: 1,
        }),
      /disk full/,
    );
    assert.equal(store.all("requests").length, count + 1);
    assert.equal(domain.getRequest(user.id, editable.id).title, valid.title);
    assert.equal(domain.getRequest(user.id, editable.id).revision, 1);
  } finally {
    fs.writeFileSync = original;
  }
});
test("persisted request and history survive an independent process", () => {
  const script = `const {getRequest}=await import('./server/src/domain/requests.js'); console.log(JSON.stringify(getRequest(${JSON.stringify(user.id)},${JSON.stringify(draft.id)})));`;
  const loaded = JSON.parse(
    execFileSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: path.resolve(import.meta.dirname, "../.."),
      env: process.env,
      encoding: "utf8",
    }),
  );
  assert.equal(loaded.status, "cancelled");
  assert.equal(loaded.quantity, 3000);
  assert.equal(loaded.history.length, 6);
});
const srv = app.listen(0, "127.0.0.1");
await new Promise((resolve) => srv.once("listening", resolve));
const call = async (endpoint, method = "GET", body, session = token) => {
  const res = await fetch(
    `http://127.0.0.1:${srv.address().port}/ingest${endpoint}`,
    {
      method,
      headers: {
        ...(session ? { authorization: `Bearer ${session}` } : {}),
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  return { status: res.status, body: await res.json().catch(() => null) };
};
try {
  for (const [url, method, body] of [
    ["/api/requests", "POST", valid],
    ["/api/me/requests", "GET"],
    [`/api/requests/${draft.id}`, "GET"],
    [`/api/requests/${draft.id}`, "PATCH", { title: "Attack", revision: 5 }],
    [
      `/api/requests/${draft.id}/status`,
      "PATCH",
      { status: "open", revision: 5 },
    ],
  ]) {
    const r = await call(url, method, body, null);
    test(`HTTP unauthenticated ${method} ${url}`, () =>
      assert.equal(r.status, 401));
  }
  process.env.BRIEF_DEV_AUTH = "1";
  const fallback = await call("/api/requests", "POST", valid, null);
  test("Requests do not use anonymous development ownership", () =>
    assert.equal(fallback.status, 401));
  process.env.BRIEF_DEV_AUTH = "0";
  const created = await call("/api/requests", "POST", {
    ...valid,
    intent: "submit",
  });
  test("HTTP authenticated create", () => {
    assert.equal(created.status, 201);
    assert.equal(created.body.request.status, "open");
    assert.equal(created.body.request.requesterId, user.id);
  });
  const id = created.body.request.id;
  const strangerGet = await call(
    `/api/requests/${id}`,
    "GET",
    undefined,
    otherToken,
  );
  const strangerPatch = await call(
    `/api/requests/${id}`,
    "PATCH",
    { quantity: 1, revision: 1 },
    otherToken,
  );
  const strangerStatus = await call(
    `/api/requests/${id}/status`,
    "PATCH",
    { status: "cancelled", revision: 1 },
    otherToken,
  );
  test("HTTP private read/update/cancel isolation", () => {
    assert.equal(strangerGet.status, 404);
    assert.equal(strangerPatch.status, 404);
    assert.equal(strangerStatus.status, 404);
  });
  const malformed = await call("/api/requests", "POST", {
    ...valid,
    quantity: "many",
  });
  const spoof = await call("/api/requests", "POST", {
    ...valid,
    requesterId: stranger.id,
    status: "completed",
  });
  test("HTTP validation and ownership spoof rejected", () => {
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.code, "validation_error");
    assert.equal(spoof.status, 400);
  });
  const updated = await call(`/api/requests/${id}`, "PATCH", {
    quantity: 5000,
    revision: 1,
  });
  const retrieved = await call(`/api/requests/${id}`);
  test("HTTP update persisted and retrieved", () => {
    assert.equal(updated.status, 200);
    assert.equal(retrieved.body.request.quantity, 5000);
    assert.equal(retrieved.body.request.revision, 2);
  });
  const invalid = await call(`/api/requests/${id}/status`, "PATCH", {
    status: "completed",
    revision: 2,
  });
  const matching = await call(`/api/requests/${id}/status`, "PATCH", {
    status: "matching",
    revision: 2,
  });
  const cancelled = await call(`/api/requests/${id}/status`, "PATCH", {
    status: "cancelled",
    revision: 3,
  });
  test("HTTP transitions and cancellation", () => {
    assert.equal(invalid.status, 409);
    assert.equal(matching.body.request.status, "matching");
    assert.equal(cancelled.body.request.status, "cancelled");
  });
  const listed = await call("/api/me/requests");
  test("HTTP list contains only persisted owned requests", () => {
    assert.ok(
      listed.body.requests.some((r) => r.id === id && r.status === "cancelled"),
    );
    assert.ok(listed.body.requests.every((r) => r.requesterId === user.id));
  });
  for (const url of [
    "/api/epl/clubs",
    "/api/fantasy/competitions",
    "/api/arena/games",
    "/api/arena/challenges",
    "/api/lobby/rooms",
    "/api/person/me/availability",
  ]) {
    const retired = await call(url);
    test(`Retired route is absent: ${url}`, () =>
      assert.equal(retired.status, 404));
  }
  const cap = await call("/api/capabilities");
  test("No active Arena capability", () =>
    assert.equal(
      JSON.stringify(cap.body).toLowerCase().includes("arena"),
      false,
    ));
} finally {
  await new Promise((resolve) => srv.close(resolve));
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(`PASSED ${passed} FAILED 0`);
