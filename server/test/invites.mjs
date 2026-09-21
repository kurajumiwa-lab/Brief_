// ---------------------------------------------------------------------------
// INVITES — one primitive, nine rungs. An invite grants a role bounded to a
// scope, carries immutable provenance, always expires, and is one-shot for
// privileged roles. An invite can never grant a role broader than the issuer
// holds, and can never grant `operator`.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-invites-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const roles = await import("../src/domain/roles.js");
const invites = await import("../src/domain/invites.js");

// Shared harness: `test` registers, `run()` executes in order and awaits each.
const { test, step, run } = await import("./harness.mjs");
const rejects = (fn, msg) => assert.throws(fn, (e) => !msg || e.message.includes(msg));
const user = (handle) => auth.createUser({ handle, password: "invites-pw" });

const op = user("iv_operator");
const partner = user("iv_partner");
const anchor = user("iv_anchor");
const joiner = user("iv_joiner");
roles.assignRole({ userId: op.id, role: "operator", scopeKind: "platform", scopeId: null });
roles.assignRole({ userId: partner.id, role: "partner", scopeKind: "org", scopeId: "org_w", assignedBy: op.id });
roles.assignRole({ userId: anchor.id, role: "cohort_anchor", scopeKind: "cohort", scopeId: "chrt_nw", assignedBy: partner.id });

test("a partner invites a cohort anchor, scoped and attributed", () => {
  const inv = invites.issueInvite({
    issuedBy: partner.id,
    grantsRole: "cohort_anchor",
    grantsScope: { kind: "cohort", id: "chrt_nw" },
    attributionKey: "org_w→prog_x→chrt_nw"
  });
  assert.equal(inv.grantsRole, "cohort_anchor");
  assert.equal(inv.singleUse, true, "privileged roles are one-shot");
  assert.ok(inv.expiresAt > new Date().toISOString(), "expiry is mandatory");

  const redeemed = invites.redeemInvite({ code: inv.code, redeemerId: joiner.id });
  assert.equal(redeemed.role.role, "cohort_anchor");
  assert.equal(redeemed.role.scopeId, "chrt_nw");
  assert.equal(roles.hasRole(joiner.id, "cohort_anchor", { scopeKind: "cohort", scopeId: "chrt_nw" }), true);
});

test("a one-shot invite cannot be redeemed twice", () => {
  const inv = invites.issueInvite({
    issuedBy: partner.id, grantsRole: "program_lead",
    grantsScope: { kind: "program", id: "prog_x" }
  });
  invites.redeemInvite({ code: inv.code, redeemerId: joiner.id });
  rejects(() => invites.redeemInvite({ code: inv.code, redeemerId: user("iv_other").id }), "already been used");
});

test("an expired invite refuses redemption", () => {
  const inv = invites.issueInvite({
    issuedBy: partner.id, grantsRole: "cohort_anchor",
    grantsScope: { kind: "cohort", id: "chrt_nw" },
    expiresAt: new Date(Date.now() + 1000).toISOString()
  });
  // Force it past expiry by mutating the stored row.
  store.update("invites", inv.id, { expiresAt: new Date(Date.now() - 1000).toISOString() });
  rejects(() => invites.redeemInvite({ code: inv.code, redeemerId: joiner.id }), "expired");
});

test("an invite can never grant a role broader than the issuer holds", () => {
  // An anchor (rank 6) cannot invite a partner (rank 8).
  rejects(() => invites.issueInvite({
    issuedBy: anchor.id, grantsRole: "partner", grantsScope: { kind: "org", id: "org_w" }
  }), "broader than your own");
  // And nobody can invite an operator.
  rejects(() => invites.issueInvite({ issuedBy: op.id, grantsRole: "operator" }), "seeded, not invited");
});

test("member invites are multi-use until expiry", () => {
  const inv = invites.issueInvite({
    issuedBy: anchor.id, grantsRole: "circle_member",
    grantsScope: { kind: "circle", id: "circle_1" },
    singleUse: false
  });
  assert.equal(inv.singleUse, false);
  invites.redeemInvite({ code: inv.code, redeemerId: user("iv_m1").id });
  const second = invites.redeemInvite({ code: inv.code, redeemerId: user("iv_m2").id });
  assert.equal(second.role.role, "circle_member", "a second member redeems the same link");
});

test("redemption captures immutable attribution (first-touch-wins)", async () => {
  const attribution = await import("../src/domain/attribution.js");
  const inv = invites.issueInvite({
    issuedBy: partner.id, grantsRole: "cohort_anchor",
    grantsScope: { kind: "cohort", id: "chrt_nw" },
    attributionKey: "org_w→prog_x→chrt_nw"
  });
  const target = user("iv_attr");
  invites.redeemInvite({ code: inv.code, redeemerId: target.id });
  const acq = attribution.acquisitionOf(target.id);
  assert.equal(acq.partnerKey, "org_w");
  assert.equal(acq.cohortKey, "chrt_nw");
});

// (console.log + process.exit moved to the very end — see bottom)

// ---------------------------------------------------------------------------
// HTTP — issue/redeem over the wire, operator list, /api/me/roles.
// ---------------------------------------------------------------------------
test("API: issue + redeem an invite, and read /api/me/roles", async () => {
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
    const P = (await call("/api/auth/register", "POST", { handle: "iv_http_p" + Date.now().toString(36), password: "a good passphrase" })).body;
    const J = (await call("/api/auth/register", "POST", { handle: "iv_http_j" + Date.now().toString(36), password: "a good passphrase" })).body;
    // Make the first user a partner so they may invite a cohort anchor.
    roles.assignRole({ userId: P.user.id, role: "partner", scopeKind: "org", scopeId: "org_w" });

    const issued = await call("/api/invites", "POST", { grantsRole: "cohort_anchor", grantsScope: { kind: "cohort", id: "chrt_nw" } }, P.token);
    assert.equal(issued.status, 201);
    assert.ok(issued.body.invite.code);

    const redeemed = await call("/api/invites/redeem", "POST", { code: issued.body.invite.code }, J.token);
    assert.equal(redeemed.status, 200);
    assert.equal(redeemed.body.role.role, "cohort_anchor");

    const myRoles = await call("/api/me/roles", "GET", undefined, J.token);
    assert.equal(myRoles.status, 200);
    assert.ok(myRoles.body.roles.some((r) => r.role === "cohort_anchor"), "redeemer now holds the scoped role");

    // A non-member cannot invite a broader role than they hold.
    const denied = await call("/api/invites", "POST", { grantsRole: "partner", grantsScope: { kind: "org", id: "org_z" } }, J.token);
    assert.equal(denied.status, 403);
  } finally {
    srv.close();
  }
});

await run();
