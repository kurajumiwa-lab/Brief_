// ---------------------------------------------------------------------------
// MEETING MINUTES — the group's own record of decisions. Members write them;
// they are real rows, newest meeting first. Nothing is fabricated.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-minutes-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const tableBanking = await import("../src/domain/tableBanking.js");

let count = 0;
const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };
const rejects = (fn, code) => assert.throws(fn, (e) => !code || e.code === code);
const user = (handle) => auth.createUser({ handle, password: "minutes-pw" });

const owner = user("mn_owner");
const m2 = user("mn_m2");
const g = tableBanking.createTableBanking({ ownerId: owner.id, name: "Minutes Circle", contributionAmount: 5000 });
tableBanking.joinTableBanking(g.id, m2.id);

test("a member records minutes; a non-member cannot", () => {
  rejects(() => tableBanking.recordMinutes(g.id, "not-a-member", { title: "x", body: "y" }), "not_member");
  const m = tableBanking.recordMinutes(g.id, owner.id, {
    title: "June 14 meeting",
    body: "Agreed the rotation and reviewed the welfare pot.",
    decisions: ["Advance the turn", "Set welfare at 500"],
    actionItems: ["Mary to collect receipts"]
  });
  assert.equal(m.title, "June 14 meeting");
  assert.equal(m.decisions.length, 2);
});

test("minutes need a title and a body", () => {
  rejects(() => tableBanking.recordMinutes(g.id, owner.id, { title: "", body: "x" }), null);
  rejects(() => tableBanking.recordMinutes(g.id, owner.id, { title: "x", body: "" }), null);
});

test("listMinutes is newest meeting first", () => {
  tableBanking.recordMinutes(g.id, m2.id, { title: "June 21 meeting", body: "Reviewed loans." });
  const list = tableBanking.listMinutes(g.id);
  assert.equal(list.length, 2);
  assert.equal(list[0].title, "June 21 meeting");
  assert.equal(list[1].title, "June 14 meeting");
});

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
test("API: POST and GET minutes", async () => {
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
    const A = (await call("/api/auth/register", "POST", { handle: "mn_http" + Date.now().toString(36), password: "a good passphrase" })).body;
    const grp = (await call("/api/table-banking", "POST", { name: "HTTP Minutes", contributionAmount: 5000 }, A.token)).body.group;
    const posted = await call(`/api/table-banking/${grp.id}/minutes`, "POST", { title: "Kickoff", body: "Formed the group." }, A.token);
    assert.equal(posted.status, 201);
    assert.equal(posted.body.minutes.title, "Kickoff");
    const read = await call(`/api/table-banking/${grp.id}/minutes`, "GET", undefined, A.token);
    assert.equal(read.status, 200);
    assert.equal(read.body.minutes.length, 1);
  } finally {
    srv.close();
  }
});

console.log(`\nPASS ${count}`);
process.exit(0);
