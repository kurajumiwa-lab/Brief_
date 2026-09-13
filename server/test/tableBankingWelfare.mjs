// ---------------------------------------------------------------------------
// TABLE BANKING WELFARE FUND — the group's own earmarked emergency pool.
//
// NOT insurance: the group's money, paid out by the group's vote. The fund
// balance is DERIVED (contributions minus approved claims); a claim cannot
// exceed the fund; a claimant cannot vote on their own claim; a strict
// majority of eligible voters decides. Nothing moves money through Brief.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-welfare-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const tableBanking = await import("../src/domain/tableBanking.js");

let count = 0;
const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };
const rejects = (fn, code) => assert.throws(fn, (e) => !code || e.code === code);
const user = (handle) => auth.createUser({ handle, password: "welfare-pw" });

// A group of 4 with a welfare amount of 500.
const owner = user("wf_owner");
const m2 = user("wf_m2"), m3 = user("wf_m3"), m4 = user("wf_m4");
const g = tableBanking.createTableBanking({ ownerId: owner.id, name: "Welfare Circle", contributionAmount: 5000, welfareContributionAmount: 500 });
for (const m of [m2, m3, m4]) tableBanking.joinTableBanking(g.id, m.id);

// ---------------------------------------------------------------------------
// Contributions + derived balance
// ---------------------------------------------------------------------------
test("welfare contributions are records, idempotent by key", () => {
  tableBanking.recordWelfareContribution(g.id, owner.id, { amount: 500, idempotencyKey: "wf-owner-1", receiptHash: "MPESA-W1" });
  tableBanking.recordWelfareContribution(g.id, m2.id, { amount: 500, idempotencyKey: "wf-m2-1" });
  // replay the same key -> no second row
  tableBanking.recordWelfareContribution(g.id, owner.id, { amount: 500, idempotencyKey: "wf-owner-1" });
  const fund = tableBanking.welfareFund(g.id);
  assert.equal(fund.totalContributed, 1000);
  assert.equal(fund.balance, 1000);
  assert.equal(fund.paidOut, 0);
});

test("a non-member cannot contribute to the fund", () => {
  const stranger = user("wf_stranger");
  rejects(() => tableBanking.recordWelfareContribution(g.id, stranger.id, { amount: 500 }), "not_member");
});

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------
test("a claim needs a reason, and cannot exceed the fund", () => {
  rejects(() => tableBanking.fileWelfareClaim(g.id, m3.id, { amount: 100 }), null); // no reason -> 'a claim needs a reason'
  // fund holds 1000; a claim of 2000 is refused.
  rejects(() => tableBanking.fileWelfareClaim(g.id, m3.id, { reason: "Hospital bill", amount: 2000 }), "insufficient_funds");
});

test("a claim files as pending and shows in the fund", () => {
  const claim = tableBanking.fileWelfareClaim(g.id, m3.id, { reason: "Bereavement support", amount: 600 });
  assert.equal(claim.status, "pending");
  const fund = tableBanking.welfareFund(g.id);
  assert.equal(fund.pendingClaims, 1);
  // A pending claim does NOT reduce the balance (only an approved one does).
  assert.equal(fund.balance, 1000);
});

// ---------------------------------------------------------------------------
// Voting
// ---------------------------------------------------------------------------
test("the claimant cannot vote on their own claim, and votes are one-per-member", () => {
  const claim = tableBanking.listWelfareClaims(g.id)[0];
  rejects(() => tableBanking.voteOnWelfareClaim(claim.id, m3.id, true), "self_vote");
  tableBanking.voteOnWelfareClaim(claim.id, owner.id, true);
  rejects(() => tableBanking.voteOnWelfareClaim(claim.id, owner.id, true), "already_voted");
});

test("a strict majority of eligible voters approves the claim and pays it out", () => {
  const claim = tableBanking.listWelfareClaims(g.id)[0];
  // eligible = owner + m2 + m4 (3, excluding claimant m3); quorum = 2.
  tableBanking.voteOnWelfareClaim(claim.id, m2.id, true);
  const resolved = store.find("tableBankingClaims", (c) => c.id === claim.id);
  assert.equal(resolved.status, "approved");
  const fund = tableBanking.welfareFund(g.id);
  assert.equal(fund.paidOut, 600);
  assert.equal(fund.balance, 400);
});

test("a declined claim leaves the balance untouched", () => {
  const claim = tableBanking.fileWelfareClaim(g.id, owner.id, { reason: "Fire damage", amount: 300 });
  tableBanking.voteOnWelfareClaim(claim.id, m2.id, false);
  tableBanking.voteOnWelfareClaim(claim.id, m3.id, false);
  const resolved = store.find("tableBankingClaims", (c) => c.id === claim.id);
  assert.equal(resolved.status, "declined");
  const fund = tableBanking.welfareFund(g.id);
  assert.equal(fund.balance, 400, "declined claims do not pay out");
});

// ---------------------------------------------------------------------------
// HTTP routes
// ---------------------------------------------------------------------------
test("API: contribute, file a claim, and vote over the wire", async () => {
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
    const A = (await call("/api/auth/register", "POST", { handle: "wf_http" + Date.now().toString(36), password: "a good passphrase" })).body;
    const B = (await call("/api/auth/register", "POST", { handle: "wf_http2" + Date.now().toString(36), password: "a good passphrase" })).body;
    const C = (await call("/api/auth/register", "POST", { handle: "wf_http3" + Date.now().toString(36), password: "a good passphrase" })).body;
    const grp = (await call("/api/table-banking", "POST", { name: "HTTP Welfare", contributionAmount: 5000, welfareContributionAmount: 500 }, A.token)).body.group;
    await call(`/api/table-banking/${grp.id}/join`, "POST", {}, B.token);
    await call(`/api/table-banking/${grp.id}/join`, "POST", {}, C.token);

    // contribute
    const c1 = await call(`/api/table-banking/${grp.id}/welfare/contributions`, "POST", { amount: 500 }, A.token);
    assert.equal(c1.status, 201);
    assert.equal(c1.body.fund.balance, 500);

    // file a claim
    const claim = await call(`/api/table-banking/${grp.id}/welfare/claims`, "POST", { reason: "Medical bill", amount: 300 }, B.token);
    assert.equal(claim.status, 201);
    assert.equal(claim.body.claim.status, "pending");

    // vote (A and C approve; quorum for eligible {A,C} = 2)
    await call(`/api/table-banking/${grp.id}/welfare/claims/${claim.body.claim.id}/vote`, "POST", { approve: true }, A.token);
    const voted = await call(`/api/table-banking/${grp.id}/welfare/claims/${claim.body.claim.id}/vote`, "POST", { approve: true }, C.token);
    assert.equal(voted.body.claim.status, "approved");
    assert.equal(voted.body.fund.paidOut, 300);
    assert.equal(voted.body.fund.balance, 200);

    // read the fund
    const read = await call(`/api/table-banking/${grp.id}/welfare`, "GET", undefined, A.token);
    assert.equal(read.status, 200);
    assert.equal(read.body.fund.balance, 200);
    assert.ok(Array.isArray(read.body.claims));
  } finally {
    srv.close();
  }
});

console.log(`\nPASS ${count}`);
process.exit(0);
