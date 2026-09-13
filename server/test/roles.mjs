// ---------------------------------------------------------------------------
// ROLES — the role-on-scope resolver. Roles are additive, bounded to a scope,
// resolved per-context; the operator role is the break-glass rung; authority
// is revocable while attribution stays immutable. Scoping is enforced at the
// query ("where scope = mine"), never in the UI.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-roles-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const roles = await import("../src/domain/roles.js");

let count = 0;
const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };
const rejects = (fn, msg) => assert.throws(fn, (e) => !msg || e.message.includes(msg));
const user = (handle) => auth.createUser({ handle, password: "roles-pw" });

const op = user("rl_operator");
const partner = user("rl_partner");
const anchor = user("rl_anchor");
const member = user("rl_member");
const stranger = user("rl_stranger");

// Seed: operator + a partner scoped to org "org_w", an anchor scoped to
// cohort "chrt_nw" under org_w, a member in that cohort.
roles.assignRole({ userId: op.id, role: "operator", scopeKind: "platform", scopeId: null });
roles.assignRole({ userId: partner.id, role: "partner", scopeKind: "org", scopeId: "org_w", assignedBy: op.id });
roles.assignRole({ userId: anchor.id, role: "cohort_anchor", scopeKind: "cohort", scopeId: "chrt_nw", assignedBy: partner.id });
roles.assignRole({ userId: member.id, role: "circle_member", scopeKind: "circle", scopeId: "circle_1", assignedBy: anchor.id });

test("roles are additive and resolved per-context (not nested)", () => {
  assert.equal(roles.hasRole(partner.id, "partner", { scopeKind: "org", scopeId: "org_w" }), true);
  assert.equal(roles.hasRole(partner.id, "partner", { scopeKind: "org", scopeId: "org_other" }), false, "a partner is scoped to their own org only");
  assert.equal(roles.hasRole(anchor.id, "cohort_anchor", { scopeKind: "cohort", scopeId: "chrt_nw" }), true);
});

test("the operator role is the break-glass rung (passes for every other role)", () => {
  assert.equal(roles.can(op.id, "partner", { scopeKind: "org", scopeId: "anything" }), true);
  assert.equal(roles.can(op.id, "circle_treasurer", { scopeKind: "circle", scopeId: "c" }), true);
  assert.equal(roles.hasRole(op.id, "operator"), true);
  assert.equal(roles.hasRole(member.id, "operator"), false);
});

test("scopeIdsFor returns the query-filter primitive (where scope = mine)", () => {
  // A second anchor cohort assignment so the filter proves it narrows.
  roles.assignRole({ userId: anchor.id, role: "cohort_anchor", scopeKind: "cohort", scopeId: "chrt_east" });
  const ids = roles.scopeIdsFor(anchor.id, "cohort_anchor", "cohort");
  assert.deepEqual(ids.sort(), ["chrt_east", "chrt_nw"], "only the anchor's own cohorts");
  assert.equal(roles.scopeIdsFor(stranger.id, "cohort_anchor", "cohort").length, 0);
});

test("a role assignment is idempotent and revocable", () => {
  const before = store.filter("roleAssignments", (r) => r.userId === member.id).length;
  roles.assignRole({ userId: member.id, role: "circle_member", scopeKind: "circle", scopeId: "circle_1" });
  assert.equal(store.filter("roleAssignments", (r) => r.userId === member.id).length, before, "no duplicate row");

  const row = store.find("roleAssignments", (r) => r.userId === member.id && r.role === "circle_member");
  roles.revokeRole(row.id);
  assert.equal(roles.hasRole(member.id, "circle_member", { scopeKind: "circle", scopeId: "circle_1" }), false, "revoked authority no longer holds");
});

test("a role must be a known role and non-operator roles need a scope", () => {
  rejects(() => roles.assignRole({ userId: stranger.id, role: "superadmin" }), "must be one of");
  rejects(() => roles.assignRole({ userId: stranger.id, role: "partner" }), "needs a scope");
});

console.log(`\nPASS ${count}`);
process.exit(0);
