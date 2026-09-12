import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-chama-loop-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js"),
  auth = await import("../src/domain/auth.js"),
  chama = await import("../src/domain/chama.js"),
  requests = await import("../src/domain/requests.js");
let count = 0;
const pass = (name) => { count++; console.log("PASS " + name); };
const user = (handle) => auth.createUser({ handle, password: "chama-loop-pw" });

// A chama of 3, one places a bulk order on its behalf.
const owner = user("cl_owner");
const m2 = user("cl_m2"), m3 = user("cl_m3");
const c = chama.createChama({ ownerId: owner.id, name: "Kilimo Chama", contributionAmount: 5000 });
chama.joinChama(c.id, m2.id);
chama.joinChama(c.id, m3.id);

// ---------------------------------------------------------------------------
// A member can place a collective request; a non-member cannot.
// ---------------------------------------------------------------------------
{
  assert.throws(() => chama.placeCollectiveRequest(c.id, "not-a-member", { title: "x" }), /not a member/);
  pass("a non-member cannot place a collective request");

  const result = chama.placeCollectiveRequest(c.id, m2.id, {
    title: "Fertilizer for the season",
    description: "Bulk DAP fertilizer for all members",
    category: "Agriculture",
    quantity: 24,
    unit: "bags",
    location: "Nairobi",
    requiredBy: "2026-12-31",
    intent: "submit",
    breakdown: [
      { name: "Mary", quantity: 8 },
      { name: "Faith", quantity: 8 },
      { name: "Jane", quantity: 8 }
    ]
  });
  assert.ok(result.request.id, "a request was created");
  assert.equal(result.request.requesterId, m2.id, "the acting member is the requester");
  assert.equal(result.request.businessContext.chamaId, c.id, "request carries chama provenance");
  assert.equal(result.request.businessContext.chamaName, "Kilimo Chama");
  assert.equal(result.request.quantity, 24, "aggregate quantity (8+8+8) is derived");
  assert.equal(result.request.status, "open", "a submit intent opens the request");
  assert.equal(result.collective.aggregateQuantity, 24);
  assert.equal(result.collective.memberBreakdown.length, 3);
  pass("a member places a collective request with derived aggregate + chama provenance");
}

// ---------------------------------------------------------------------------
// The request is a REAL request — flowable through the normal chain.
// ---------------------------------------------------------------------------
{
  // It exists in the requests store as a normal demand row.
  const all = requests.listRequests(m2.id);
  assert.ok(all.some((r) => r.businessContext?.chamaId === c.id), "collective request is in the member's requests");
  pass("the collective request is a first-class Request in the economic chain");

  // listCollectiveRequests links it back to the chama with live status.
  const listed = chama.listCollectiveRequests(c.id);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].request.title, "Fertilizer for the season");
  assert.equal(listed[0].request.status, "open");
  pass("the chama can list its collective requests with live status");
}

// ---------------------------------------------------------------------------
// HTTP — place + list via routes.
// ---------------------------------------------------------------------------
{
  const { default: app } = await import("../src/index.js");
  const srv = app.listen(0);
  const port = srv.address().port;
  const token = auth.issueSession(m3.id).token;
  const call = async (p, m = "GET", body) => {
    const r = await fetch(`http://127.0.0.1:${port}${p}`, {
      method: m, headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  try {
    const list = await call(`/api/chamas/${c.id}/requests`);
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.body.collective));
    pass("API: GET collective requests returns the list");

    const placed = await call(`/api/chamas/${c.id}/requests`, "POST", {
      title: "Seeds for planting", description: "Certified maize seed", category: "Agriculture", quantity: 12, unit: "kg", location: "Nairobi", intent: "submit"
    });
    assert.equal(placed.status, 201);
    assert.equal(placed.body.request.businessContext.chamaId, c.id);
    pass("API: POST places a collective request with chama provenance");
  } finally {
    srv.close();
  }
}

console.log(`\nPASS ${count}`);
process.exit(0);
