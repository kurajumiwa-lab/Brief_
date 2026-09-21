// ---------------------------------------------------------------------------
// COMMITMENTS — the derived reciprocal-obligation graph. Pins that "owed to
// me / I owe" are arithmetic over real rows (orders, work orders, quotes,
// loans), with a real KES value only where a real amount exists, and honest
// zeroes for an empty account.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-commitments-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const vendor = await import("../src/domain/vendor.js");
const listing = await import("../src/domain/listing.js");
const order = await import("../src/domain/order.js");
const commitments = await import("../src/domain/commitments.js");

// Shared harness: `test` registers, `run()` executes in order and awaits each.
const { test, step, run } = await import("./harness.mjs");

const buyer = auth.createUser({ handle: "cmt_buyer", password: "commitments-pw" });
const seller = auth.createUser({ handle: "cmt_seller", password: "commitments-pw" });

// Seller's vendor + a listing -> a real unpaid order (buyer owes seller).
const shop = vendor.createVendor({ ownerId: seller.id, displayName: "Kiko Bakery", businessType: "retailer", location: "Kilimani" });
const list = listing.createListing({ vendorId: shop.id, title: "Bread", price: 500, currency: "KES" });
listing.transitionListing(list.id, "active");
const o = order.createOrder({ listingId: list.id, buyerId: buyer.id, quantity: 3 }); // KES 1,500

test("an unpaid order is a PAYMENT commitment: buyer owes the seller KES 1500", () => {
  const b = commitments.commitmentsFor(buyer.id);
  const owed = b.owedByMe.find((c) => c.kind === "payment" && c.evidence.id === o.id);
  assert.ok(owed, "the buyer has an open payment commitment");
  assert.equal(owed.value.amount, 1500, "the value is the real order total");
  assert.equal(owed.fromParty, buyer.id);
  assert.equal(owed.toParty, seller.id);
  assert.equal(b.owedByMeKes, 1500, "owed-by-me total is real");

  const s = commitments.commitmentsFor(seller.id);
  const due = s.owedToMe.find((c) => c.kind === "payment" && c.evidence.id === o.id);
  assert.ok(due, "the seller has the mirror: owed-to-me");
  assert.equal(s.owedToMeKes, 1500, "owed-to-me total is real");
});

test("an empty account returns honest zeroes", () => {
  const fresh = auth.createUser({ handle: "cmt_fresh", password: "commitments-pw" });
  const c = commitments.commitmentsFor(fresh.id);
  assert.equal(c.owedByMe.length, 0);
  assert.equal(c.owedToMe.length, 0);
  assert.equal(c.owedByMeKes, 0);
  assert.equal(c.owedToMeKes, 0);
});

test("API: /api/me/commitments is wired and auth-gated", async () => {
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
    const anon = await call("/api/me/commitments", "GET");
    assert.equal(anon.status, 401, "no session -> 401");
    const A = (await call("/api/auth/register", "POST", { handle: "cmt_http" + Date.now().toString(36), password: "a good passphrase" })).body;
    const res = await call("/api/me/commitments", "GET", undefined, A.token);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.commitments.owedByMe) && Array.isArray(res.body.commitments.owedToMe), "full shape present");
  } finally {
    srv.close();
  }
});

await run();
