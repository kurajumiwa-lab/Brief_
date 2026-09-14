// ---------------------------------------------------------------------------
// RECIPROCITY — the derived social-debt ledger. Pins that favors are derived
// from real rows (loan guarantees, recommendations, delivery covers), that a
// favor older than the window goes "aging", and that an empty account returns
// honest zeroes.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-reciprocity-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const reciprocity = await import("../src/domain/reciprocity.js");

let count = 0;
const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };

const borrower = auth.createUser({ handle: "rcp_borrower", password: "reciprocity-pw" });
const guarantor = auth.createUser({ handle: "rcp_guarantor", password: "reciprocity-pw" });
const agent = auth.createUser({ handle: "rcp_agent", password: "reciprocity-pw" });
const rider = auth.createUser({ handle: "rcp_rider", password: "reciprocity-pw" });

const now = new Date().toISOString();

// --- LOAN GUARANTEE: guarantor took on borrower's risk --------------------
store.insert("tableBankingLoans", {
  id: "loan_1", tableBankingId: "tb_1", borrowerId: borrower.id,
  principal: 5000, interestType: "flat", ratePercent: 0, termMonths: 3,
  guarantorsRequired: 1, guarantors: [guarantor.id],
  status: "active", disbursedAt: now, settledAt: null, createdAt: now
});

// --- RECOMMENDATION: a partner vouched for the agent ----------------------
store.insert("coopPartnerships", {
  id: "coop_1", fromUserId: rider.id, toUserId: agent.id, status: "confirmed",
  recommendations: [{ byUserId: rider.id, forUserId: agent.id, note: "Great to work with", at: now }],
  createdAt: now
});

// --- DELIVERY COVER: rider delivered from the agent's onboarded shop ------
store.insert("vendors", { id: "vnd_a", ownerId: agent.id, displayName: "Agent Shop", status: "active", businessType: "retailer", location: "Kilimani", createdAt: now, updatedAt: now });
store.insert("vendorClaims", { id: "vcl_a", vendorId: "vnd_a", agentId: agent.id, claimType: "full_registration", territoryKey: null, status: "active", claimedAt: now, expiresAt: null, createdAt: now });
store.insert("pickups", {
  id: "pkp_1", originVendorId: "vnd_a", riderId: rider.id, destinationTown: "Nakuru",
  receiverName: "X", receiverPhone: "07xx", status: "delivered",
  createdAt: now, completedAt: now
});

test("loan guarantee: the borrower is owed reciprocity by the guarantor", () => {
  const b = reciprocity.reciprocityFor(borrower.id);
  const owed = b.owedToMe.find((c) => c.kind === "loan_guarantee");
  assert.ok(owed, "the borrower has a loan-guarantee favor owed to them");
  assert.equal(owed.fromParty, guarantor.id);
  assert.equal(owed.value.amount, 5000, "the value is the real loan principal");

  const g = reciprocity.reciprocityFor(guarantor.id);
  const due = g.owedByMe.find((c) => c.kind === "loan_guarantee");
  assert.ok(due, "the guarantor sees the mirror: they went out of their way");
});

test("delivery cover: a rider who delivered for another agent's shop is a favor", () => {
  const a = reciprocity.reciprocityFor(agent.id);
  const owed = a.owedToMe.find((c) => c.kind === "delivery_cover");
  assert.ok(owed, "the onboarding agent is owed reciprocity for the delivery");
  assert.equal(owed.fromParty, rider.id);
  assert.equal(owed.value.amount, 20, "the value is the real KES 20 origin fee");

  const r = reciprocity.reciprocityFor(rider.id);
  assert.ok(r.owedByMe.some((c) => c.kind === "delivery_cover"), "the rider went out of their way");
});

test("a recommendation is a favor the recommended party is owed", () => {
  const a = reciprocity.reciprocityFor(agent.id);
  assert.ok(a.owedToMe.some((c) => c.kind === "recommendation" && c.fromParty === rider.id), "a vouch is a favor owed to the recommended party");
});

test("a favor past the window is flagged aging; an empty account is honest zero", () => {
  // A delivery cover 20 days old.
  store.insert("pickups", {
    id: "pkp_old", originVendorId: "vnd_a", riderId: rider.id, destinationTown: "Kisumu",
    receiverName: "Y", receiverPhone: "07xx", status: "delivered",
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    completedAt: new Date(Date.now() - 20 * 86400000).toISOString()
  });
  const a = reciprocity.reciprocityFor(agent.id);
  assert.ok(a.aging.length > 0, "old favors appear in the aging list");
  assert.ok(a.aging[0].ageDays >= 14, "an aging favor is past the window");

  const fresh = auth.createUser({ handle: "rcp_fresh", password: "reciprocity-pw" });
  const f = reciprocity.reciprocityFor(fresh.id);
  assert.equal(f.owedToMe.length, 0);
  assert.equal(f.owedByMe.length, 0);
});

test("API: /api/me/reciprocity is wired and auth-gated", async () => {
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
    const anon = await call("/api/me/reciprocity", "GET");
    assert.equal(anon.status, 401, "no session -> 401");
    const A = (await call("/api/auth/register", "POST", { handle: "rcp_http" + Date.now().toString(36), password: "a good passphrase" })).body;
    const res = await call("/api/me/reciprocity", "GET", undefined, A.token);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.reciprocity.owedToMe) && Array.isArray(res.body.reciprocity.owedByMe), "full shape present");
  } finally {
    srv.close();
  }
});

console.log(`\nPASS ${count}`);
process.exit(0);
