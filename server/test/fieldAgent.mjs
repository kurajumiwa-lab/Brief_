import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-fa-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js"),
  auth = await import("../src/domain/auth.js"),
  fa = await import("../src/domain/fieldAgent.js"),
  referrals = await import("../src/domain/referrals.js"),
  vendors = await import("../src/domain/vendor.js"),
  listings = await import("../src/domain/listing.js"),
  orders = await import("../src/domain/order.js"),
  ledger = await import("../src/domain/ledger.js");
let count = 0;
const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };
const rejects = (fn, code) => assert.throws(fn, (e) => !code || e.code === code);
const user = (handle) => auth.createUser({ handle, password: "field-agent-password" });

// ---------------------------------------------------------------------------
// Fixtures: a vendor (shop owner), two rival agents, and a buyer.
// ---------------------------------------------------------------------------
const owner = user("fa_owner");
const agent = user("fa_agent");
const rival = user("fa_rival");
const buyer = user("fa_buyer");

const vendor = vendors.createVendor({ ownerId: owner.id, displayName: "Kiko Bakery" });
const listing = listings.createListing({ vendorId: vendor.id, title: "Cake", price: 10000, currency: "KES" });
listings.transitionListing(listing.id, "active");

// Settle an order the honest way: attach a settled ledger transaction.
function settledOrder(buyerId, total) {
  const order = orders.createOrder({ listingId: listing.id, buyerId, quantity: 1 });
  const tx = ledger.createTransaction({ amount: total, type: 'order_payment', description: 'test', counterparty: buyerId });
  // created -> pending -> confirmed -> settled (the only legal path).
  ledger.transitionTransaction(tx.id, 'pending');
  ledger.transitionTransaction(tx.id, 'confirmed');
  ledger.transitionTransaction(tx.id, 'settled');
  orders.attachTransaction(order.id, tx.id);
  orders.transitionOrder(order.id, 'fulfilled');
  return orders.transitionOrder(order.id, 'settled');
}

// ---------------------------------------------------------------------------
// CLAIMS
// ---------------------------------------------------------------------------
test("claimVendor requires a known claim type and a real vendor", () => {
  rejects(() => fa.claimVendor({ agentId: agent.id, vendorId: vendor.id, claimType: "nonsense" }));
  rejects(() => fa.claimVendor({ agentId: agent.id, vendorId: "nope", claimType: "menu_upload" }), "not_found");
});

test("a vendor owner cannot claim their own shop", () => {
  rejects(() => fa.claimVendor({ agentId: owner.id, vendorId: vendor.id, claimType: "full_registration" }), "self_claim");
});

test("menu_upload mints the one-off bounty exactly once", () => {
  const claim = fa.claimVendor({ agentId: agent.id, vendorId: vendor.id, claimType: "menu_upload" });
  assert.equal(claim.claimType, "menu_upload");
  assert.equal(claim.expiresAt, null);
  // The bounty landed on the agent's referral events, once.
  const events = store.filter("referralEvents", (e) => e.kind === "menu_upload_bounty" && e.referrerId === agent.id);
  assert.equal(events.length, 1);
  assert.equal(events[0].points, fa.MENU_UPLOAD_BOUNTY);
  // A second menu_upload claim for the same vendor is refused (first-touch).
  rejects(() => fa.claimVendor({ agentId: rival.id, vendorId: vendor.id, claimType: "menu_upload" }), "already_claimed");
});

test("full_registration is first-touch-wins per vendor", () => {
  const claim = fa.claimVendor({ agentId: agent.id, vendorId: vendor.id, claimType: "full_registration" });
  assert.equal(claim.status, "active");
  assert.ok(claim.expiresAt > claim.claimedAt, "has a 24-month expiry");
  assert.equal(fa.vendorClaim(vendor.id).agentId, agent.id);
  // The rival cannot overwrite the active territory.
  rejects(() => fa.claimVendor({ agentId: rival.id, vendorId: vendor.id, claimType: "full_registration" }), "already_claimed");
});

// ---------------------------------------------------------------------------
// DERIVED OVERRIDE — settled orders only, inside the window.
// ---------------------------------------------------------------------------
test("overrideObligation is zero before any settled order", () => {
  const obl = fa.overrideObligation(agent.id);
  assert.equal(obl.overrideKes, 0);
  assert.equal(obl.grossKes, 0);
  assert.equal(obl.claims.length, 1);
  assert.match(obl.note, /not money until/i);
});

test("a settled order produces the deterministic override", () => {
  settledOrder(buyer.id, 10000); // KES 10,000 settled
  const obl = fa.overrideObligation(agent.id);
  assert.equal(obl.grossKes, 10000);
  assert.equal(obl.overrideKes, Math.floor(0.0075 * 10000)); // KES 75
  assert.equal(obl.claims[0].settledOrders, 1);
  assert.equal(obl.claims[0].vendorName, "Kiko Bakery");
});

test("a rival with no claim earns nothing, even on the same orders", () => {
  assert.equal(fa.overrideObligation(rival.id).overrideKes, 0);
});

// ---------------------------------------------------------------------------
// SETTLEMENT — the only place the override becomes money.
// ---------------------------------------------------------------------------
test("requestOverrideSettlement snapshots the obligation and writes ONE pending tx", () => {
  const s = fa.requestOverrideSettlement(agent.id, {});
  assert.equal(s.status, "pending");
  assert.equal(s.overrideKes, Math.floor(0.0075 * 10000));
  assert.equal(s.rate, fa.OVERRIDE_RATE);
  const tx = store.find("ledgerTransactions", (t) => t.id === s.ledgerId);
  assert.equal(tx.type, "field_agent_override");
  assert.equal(tx.amount, s.overrideKes);
  assert.equal(tx.status, "pending");
  assert.equal(tx.counterparty, agent.id);
  rejects(() => fa.requestOverrideSettlement(agent.id, {}), "duplicate_settlement");
});

test("confirmOverrideSettlement settles the ledger; refusal reverses it", () => {
  const pending = store.find("fieldAgentSettlements", (s) => s.agentId === agent.id && s.status === "pending");
  const confirmed = fa.confirmOverrideSettlement(pending.id, { accept: true });
  assert.equal(confirmed.status, "confirmed");
  assert.ok(confirmed.confirmedAt);
  assert.equal(store.find("ledgerTransactions", (t) => t.id === pending.ledgerId).status, "confirmed");
  rejects(() => fa.confirmOverrideSettlement(pending.id, { accept: true }), "invalid_state");
});

test("a refused settlement writes no money and marks the ledger failed", () => {
  // A second agent + a fresh vendor (different owner) + settled order.
  const owner2 = user("fa_owner2");
  const vendor2 = vendors.createVendor({ ownerId: owner2.id, displayName: "Second Stall" });
  const listing2 = listings.createListing({ vendorId: vendor2.id, title: "Goods", price: 20000, currency: "KES" });
  listings.transitionListing(listing2.id, "active");
  fa.claimVendor({ agentId: rival.id, vendorId: vendor2.id, claimType: "full_registration" });
  const o = orders.createOrder({ listingId: listing2.id, buyerId: buyer.id, quantity: 1 });
  const tx = ledger.createTransaction({ amount: 20000, type: 'order_payment', description: 't', counterparty: buyer.id });
  ledger.transitionTransaction(tx.id, 'pending'); ledger.transitionTransaction(tx.id, 'confirmed'); ledger.transitionTransaction(tx.id, 'settled');
  orders.attachTransaction(o.id, tx.id); orders.transitionOrder(o.id, 'fulfilled'); orders.transitionOrder(o.id, 'settled');

  const s = fa.requestOverrideSettlement(rival.id, {});
  assert.equal(s.overrideKes, Math.floor(0.0075 * 20000)); // KES 150
  const refused = fa.confirmOverrideSettlement(s.id, { accept: false, note: "not this quarter" });
  assert.equal(refused.status, "refused");
  assert.equal(store.find("ledgerTransactions", (t) => t.id === s.ledgerId).status, "failed");
});

test("requestOverrideSettlement refuses when there is no settled override", () => {
  const agent2 = user("fa_agent2");
  rejects(() => fa.requestOverrideSettlement(agent2.id, {}), "no_activity");
});

// ---------------------------------------------------------------------------
// HTTP — capability gating.
// ---------------------------------------------------------------------------
{
  const appMod = await import("../src/index.js");
  const app = appMod.default;
  const srv = app.listen(0);
  const port = srv.address().port;
  const tokenOf = (u) => auth.login({ handle: u.handle, password: "field-agent-password" }).token;
  const agentToken = tokenOf(agent),
    rivalToken = tokenOf(rival),
    ownerToken = tokenOf(owner),
    buyerToken = tokenOf(buyer);
  const call = async (pathName, method = "GET", body, token) => {
    const headers = { "content-type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${pathName}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  try {
    const anon = await call(`/api/vendors/${vendor.id}/claim`);
    assert.equal(anon.status, 401);
    count++; console.log("PASS API: claim read requires authentication");

    const selfClaim = await call(`/api/vendors/${vendor.id}/claims`, "POST", { claimType: "full_registration" }, ownerToken);
    assert.equal(selfClaim.status, 409);
    count++; console.log("PASS API: a vendor owner is refused the self-claim");

    const mine = await call("/api/me/field-agent", "GET", undefined, agentToken);
    assert.equal(mine.status, 200);
    assert.ok(Array.isArray(mine.body.claims));
    assert.equal(typeof mine.body.override.overrideKes, "number");
    count++; console.log("PASS API: a member reads their own claims + derived override");

    // A plain member cannot read the ops list.
    const opsDenied = await call("/api/ops/field-agents", "GET", undefined, agentToken);
    assert.equal(opsDenied.status, 403);
    count++; console.log("PASS API: the ops claim list is moderate-gated");
  } finally {
    srv.close();
  }
}

console.log(`\nPASS ${count}`);
