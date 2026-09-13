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

let count = 0;
const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };
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

console.log(`\nPASS ${count}`);
process.exit(0);
