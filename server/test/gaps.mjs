// ---------------------------------------------------------------------------
// GAPS — unmet demand derived from real rows. A request with no accepted quote
// is a gap; severity is a derived label (no_supplier / awaiting_quote /
// awaiting_accept). Counts are recomputed by scanning rows — never stored,
// never fabricated. The full request→match→quote chain is covered elsewhere;
// this pins the DERIVATION.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-gaps-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const gaps = await import("../src/domain/gaps.js");

let count = 0;
const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };
const user = (handle) => auth.createUser({ handle, password: "gaps-password" });

const owner = user("gp_owner");
const now = () => new Date().toISOString();

// Synthetic rows spanning the three severity tiers + the excluded accepted case.
store.insert("requests", { id: "req_a", requesterId: owner.id, title: "DAP fertilizer", category: "Agriculture", quantity: 24, unit: "bags", currency: "KES", location: "Nairobi", status: "open", updatedAt: now() });
store.insert("requests", { id: "req_b", requesterId: owner.id, title: "Maize seed", category: "Agriculture", quantity: 500, unit: "kg", currency: "KES", location: "Eldoret", status: "matching", updatedAt: now() });
store.insert("matches", { id: "m_b1", requestId: "req_b" });
store.insert("matches", { id: "m_b2", requestId: "req_b" });
store.insert("requests", { id: "req_c", requesterId: owner.id, title: "Packaging boxes", category: "Packaging", quantity: 1000, unit: "pieces", currency: "KES", location: "Mombasa", status: "quoted", updatedAt: now() });
store.insert("matches", { id: "m_c1", requestId: "req_c" });
store.insert("requests", { id: "req_d", requesterId: owner.id, title: "Fulfilled order", category: "Logistics", quantity: 1, unit: "job", currency: "KES", location: "Kisumu", status: "ready_for_work", updatedAt: now() });
store.insert("requests", { id: "req_e", requesterId: owner.id, title: "Bulk cooking oil", category: "FMCG", quantity: 200, unit: "litres", currency: "KES", location: "Nairobi", status: "open", businessContext: { tableBankingId: "tb_1", tableBankingName: "Kilimani Circle" }, updatedAt: now() });

test("unmet demand counts only active requests with no accepted quote", () => {
  const g = gaps.unmetDemand();
  assert.equal(g.total, 4, "req_a, req_b, req_c, req_e are gaps; req_d (ready_for_work) is not");
  assert.ok(!g.gaps.some((x) => x.requestId === "req_d"), "an accepted (ready_for_work) request is not a gap");
});

test("severity is derived from the match count and request status", () => {
  const g = gaps.unmetDemand();
  const a = g.gaps.find((x) => x.requestId === "req_a");
  const b = g.gaps.find((x) => x.requestId === "req_b");
  const c = g.gaps.find((x) => x.requestId === "req_c");
  assert.equal(a.severity, "no_supplier", "zero matches -> no_supplier");
  assert.equal(a.matchCount, 0);
  assert.equal(b.severity, "awaiting_quote", "matched but no quote -> awaiting_quote");
  assert.equal(b.matchCount, 2);
  assert.equal(c.severity, "awaiting_accept", "a quote exists -> awaiting_accept");
  assert.equal(c.matchCount, 1);
});

test("bySeverity counts are derived, and no_supplier sorts first", () => {
  const g = gaps.unmetDemand();
  assert.equal(g.bySeverity.no_supplier, 2, "req_a + req_e");
  assert.equal(g.bySeverity.awaiting_quote, 1);
  assert.equal(g.bySeverity.awaiting_accept, 1);
  assert.equal(g.gaps[0].severity, "no_supplier", "most severe gap leads");
});

test("a collective (table-banking) request is flagged as such", () => {
  const g = gaps.unmetDemand();
  const e = g.gaps.find((x) => x.requestId === "req_e");
  assert.equal(e.collective, true);
  assert.equal(e.tableBankingId, "tb_1");
  // No private fields leak: no budget, no requester id.
  assert.ok(!("budgetMax" in e) && !("requesterId" in e), "no private fields");
});

// ---------------------------------------------------------------------------
// HTTP — operator (moderate) reads gaps; anonymous is refused.
// ---------------------------------------------------------------------------
test("API: GET /api/gaps is moderate-gated", async () => {
  const { default: app } = await import("../src/index.js");
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (p, m = "GET", token) => {
    const headers = {};
    if (token) headers.authorization = `Bearer ${token}`;
    const r = await fetch(`http://127.0.0.1:${port}${p}`, { method: m, headers });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  try {
    // Anonymous -> 401.
    const anon = await call("/api/gaps");
    assert.equal(anon.status, 401);

    const reviewer = user("gp_reviewer");
    process.env.BRIEF_REVIEWERS = reviewer.handle;
    const token = auth.issueSession(reviewer.id).token;

    const ok = await call("/api/gaps", "GET", token);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.total, 4);
    assert.ok(Array.isArray(ok.body.gaps));
  } finally {
    delete process.env.BRIEF_REVIEWERS;
    srv.close();
  }
});

console.log(`\nPASS ${count}`);
process.exit(0);
