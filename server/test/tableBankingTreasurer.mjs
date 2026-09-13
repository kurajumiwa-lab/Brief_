// ---------------------------------------------------------------------------
// TREASURER DASHBOARD — the owner's single derived view. Role-gated (owner
// only); every figure recomputed from real rows on read; nothing is stored.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-treasurer-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const tableBanking = await import("../src/domain/tableBanking.js");

let count = 0;
const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };
const rejects = (fn, code) => assert.throws(fn, (e) => !code || e.code === code);
const user = (handle) => auth.createUser({ handle, password: "treasurer-pw" });

const owner = user("tr_owner");
const m2 = user("tr_m2"), m3 = user("tr_m3");
const g = tableBanking.createTableBanking({ ownerId: owner.id, name: "Treasurer Circle", contributionAmount: 5000, welfareContributionAmount: 500 });
for (const m of [m2, m3]) tableBanking.joinTableBanking(g.id, m.id);
tableBanking.recordContribution(g.id, owner.id, { amount: 5000, idempotencyKey: "tr-owner" });
tableBanking.recordContribution(g.id, m2.id, { amount: 5000, idempotencyKey: "tr-m2" });
tableBanking.issueJoinInvite(g.id, owner.id, { phone: "0700000000", name: "Pending" });

test("the dashboard is owner-only", () => {
  rejects(() => tableBanking.treasurerView(g.id, m3.id), "not_treasurer");
});

test("the dashboard derives members, pool, rotation, welfare and invites", () => {
  const d = tableBanking.treasurerView(g.id, owner.id);
  assert.equal(d.group.name, "Treasurer Circle");
  assert.equal(d.summary.totalContributed, 10000);
  // owner + m2 contributed; m3 has not.
  const contributed = d.members.filter((m) => m.contributed);
  assert.equal(contributed.length, 2, "two members have contributed");
  assert.ok(d.members.find((m) => m.userId === m3.id) && !d.members.find((m) => m.userId === m3.id).contributed, "m3 has not contributed");
  assert.equal(d.rotation.nextMemberId, m2.id, "rotation next member");
  assert.equal(d.welfare.balance, 0, "no welfare contributions yet");
  assert.equal(d.pendingInvites, 1);
  assert.equal(d.activeLoans.length, 0);
});

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
test("API: owner reads the dashboard; a member is refused", async () => {
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
    const A = (await call("/api/auth/register", "POST", { handle: "tr_http" + Date.now().toString(36), password: "a good passphrase" })).body;
    const B = (await call("/api/auth/register", "POST", { handle: "tr_http2" + Date.now().toString(36), password: "a good passphrase" })).body;
    const grp = (await call("/api/table-banking", "POST", { name: "HTTP Treasurer", contributionAmount: 5000 }, A.token)).body.group;
    await call(`/api/table-banking/${grp.id}/join`, "POST", {}, B.token);

    const ownerRead = await call(`/api/table-banking/${grp.id}/treasurer`, "GET", undefined, A.token);
    assert.equal(ownerRead.status, 200);
    assert.ok(ownerRead.body.dashboard.summary);

    const memberRead = await call(`/api/table-banking/${grp.id}/treasurer`, "GET", undefined, B.token);
    assert.equal(memberRead.status, 403);
    assert.equal(memberRead.body.code, "not_treasurer");
  } finally {
    srv.close();
  }
});

console.log(`\nPASS ${count}`);
process.exit(0);
