// ---------------------------------------------------------------------------
// ARCHIVE — the owner's only way to close a table-banking group. Not a delete:
// history is permanent. Guard rails: owner-only; refused while a loan is
// active or a payout is pending; idempotent; archived groups drop out of the
// member's active list but stay resolvable by id.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-archive-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const tableBanking = await import("../src/domain/tableBanking.js");

let count = 0;
const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };
const rejects = (fn, code) => assert.throws(fn, (e) => !code || e.code === code);
const user = (handle) => auth.createUser({ handle, password: "archive-pw" });

const owner = user("ar_owner");
const m2 = user("ar_m2");

test("a clean group can be archived by its owner, and drops out of the active list", () => {
  const g = tableBanking.createTableBanking({ ownerId: owner.id, name: "Archive Me", contributionAmount: 5000 });
  tableBanking.joinTableBanking(g.id, m2.id);

  const archived = tableBanking.archiveTableBanking(g.id, owner.id);
  assert.equal(archived.status, "archived");

  // It is gone from the owner's active list…
  assert.equal(tableBanking.listTableBanking(owner.id).length, 0);
  // …but still resolvable by id (history intact).
  assert.equal(tableBanking.getTableBanking(g.id).status, "archived");
});

test("archiving is owner-only and idempotent", () => {
  const g = tableBanking.createTableBanking({ ownerId: owner.id, name: "Owned", contributionAmount: 5000 });
  rejects(() => tableBanking.archiveTableBanking(g.id, m2.id), "owner_only");
  tableBanking.archiveTableBanking(g.id, owner.id);
  // Idempotent: re-archiving returns the group, no error.
  assert.equal(tableBanking.archiveTableBanking(g.id, owner.id).status, "archived");
});

test("archive is refused while a loan is active", () => {
  const g = tableBanking.createTableBanking({ ownerId: owner.id, name: "Loaned", contributionAmount: 5000 });
  tableBanking.joinTableBanking(g.id, m2.id);
  const loan = tableBanking.applyLoan(g.id, m2.id, { principal: 6000, interestType: "flat", ratePercent: 0, termMonths: 6 });
  tableBanking.approveLoan(loan.id, owner.id); // -> active, money outstanding
  rejects(() => tableBanking.archiveTableBanking(g.id, owner.id), "loan_outstanding");

  // Repay in full -> settled -> archiving is now allowed.
  tableBanking.recordRepayment(loan.id, { amount: 6000, idempotencyKey: "ar-repay" });
  assert.equal(tableBanking.archiveTableBanking(g.id, owner.id).status, "archived");
});

test("archive is refused while a payout is pending", () => {
  const g = tableBanking.createTableBanking({ ownerId: owner.id, name: "Payout", contributionAmount: 5000 });
  tableBanking.joinTableBanking(g.id, m2.id);
  const payout = tableBanking.requestPayout(g.id, m2.id, owner.id, { amount: 5000 });
  assert.equal(payout.status, "pending");
  rejects(() => tableBanking.archiveTableBanking(g.id, owner.id), "payout_pending");

  // Confirm the payout (maker != checker) -> archiving allowed.
  tableBanking.confirmPayout(payout.id, m2.id);
  assert.equal(tableBanking.archiveTableBanking(g.id, owner.id).status, "archived");
});

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
test("API: archive over the wire; non-owner refused", async () => {
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
    const A = (await call("/api/auth/register", "POST", { handle: "ar_http" + Date.now().toString(36), password: "a good passphrase" })).body;
    const B = (await call("/api/auth/register", "POST", { handle: "ar_http2" + Date.now().toString(36), password: "a good passphrase" })).body;
    const grp = (await call("/api/table-banking", "POST", { name: "HTTP Archive", contributionAmount: 5000 }, A.token)).body.group;
    await call(`/api/table-banking/${grp.id}/join`, "POST", {}, B.token);

    // Non-owner cannot archive.
    const denied = await call(`/api/table-banking/${grp.id}/archive`, "POST", {}, B.token);
    assert.equal(denied.status, 403);

    const done = await call(`/api/table-banking/${grp.id}/archive`, "POST", {}, A.token);
    assert.equal(done.status, 200);
    assert.equal(done.body.group.status, "archived");

    // The archived group no longer appears in the member's active list.
    const list = await call("/api/me/table-banking", "GET", undefined, A.token);
    assert.equal(list.body.groups.length, 0);
  } finally {
    srv.close();
  }
});

console.log(`\nPASS ${count}`);
process.exit(0);
