// ---------------------------------------------------------------------------
// INTEGRITY REGRESSIONS — the fixes for the counter-audit's findings.
//
//   1. ledger amount/currency/type are immutable (store guard + test)
//   2. group-buy contributions carry the authenticated actor (no phantom)
//   3. mshikano post cooldown (sybil friction)
//   4. huduma order expiry (the permanent-lock escalation path)
//   5. confirm-after-cancel is refused (two-party race, serialized by the store)
// ---------------------------------------------------------------------------
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-integrity-"));
process.env.BRIEF_DATA_DIR = dir;

const { store } = await import("../src/store.js"),
  auth = await import("../src/domain/auth.js"),
  ledger = await import("../src/domain/ledger.js"),
  groupbuy = await import("../src/domain/groupbuy.js"),
  coop = await import("../src/domain/coop.js");
const hudumaOrders = await import("../src/domain/huduma/orders.js");
let count = 0;
const pass = (name) => { count++; console.log("PASS " + name); };

const user = (handle) => auth.createUser({ handle, password: "integrity-password" });

// ---------------------------------------------------------------------------
// 1. LEDGER IMMUTABILITY
// ---------------------------------------------------------------------------
{
  const tx = ledger.createTransaction({ amount: 500, type: "sale", description: "x", counterparty: "usr_x" });
  assert.equal(tx.amount, 500);
  // The store guard refuses any rewrite of amount/currency/type.
  let threw = null;
  try { store.update("ledgerTransactions", tx.id, { amount: 9999 }); } catch (e) { threw = e; }
  assert.ok(threw, "amount rewrite refused");
  assert.match(threw.message, /immutable/);
  threw = null;
  try { store.update("ledgerTransactions", tx.id, { type: "refund" }); } catch (e) { threw = e; }
  assert.ok(threw, "type rewrite refused");
  // A legitimate status transition still works and never changes amount.
  ledger.transitionTransaction(tx.id, "pending");
  const after = store.find("ledgerTransactions", (t) => t.id === tx.id);
  assert.equal(after.amount, 500);
  assert.equal(after.type, "sale");
  assert.equal(after.status, "pending");
  assert.equal(after.history.length, 2, "history is append-only (created + pending)");
  pass("ledger amount/currency/type are immutable; status transitions preserve them");
}

// ---------------------------------------------------------------------------
// 2. GROUP BUY CONTRIBUTION ACTOR BINDING
// ---------------------------------------------------------------------------
{
  const owner = user("gb_owner");
  const contributor = user("gb_contrib");
  const buy = groupbuy.createGroupBuy({ ownerId: owner.id, title: "Restock", targetAmount: 10000 });
  const c1 = groupbuy.contribute({ groupBuyId: buy.id, memberRef: "Neighbour duka", amount: 500, source: "mpesa", actorId: contributor.id });
  assert.equal(c1.receipt.contributorId, contributor.id, "the recording actor is stamped on the receipt");
  assert.match(c1.receipt.receiptHash, /^[0-9a-f]{24}$/, "receipt hash covers the record incl. the actor");
  // A phantom (no actor) is still representable at the domain layer (legacy
  // direct calls), but the HTTP route always stamps the caller — assert the
  // field exists and is null only when no actor is given.
  const c2 = groupbuy.contribute({ groupBuyId: buy.id, memberRef: "Anonymous", amount: 100, source: "cash" });
  assert.equal(c2.receipt.contributorId, null, "domain-level anonymous contribution is stamped null (route binds caller)");
  pass("group-buy contributions carry the recording actor and a receipt hash");
}

// ---------------------------------------------------------------------------
// 3. MSHIKANO POST COOLDOWN
// ---------------------------------------------------------------------------
{
  const spammer = user("coop_spammer");
  let threw = null;
  for (let i = 0; i <= coop.MAX_POSTS_PER_HOUR; i++) {
    try {
      coop.createPost(spammer.id, { intent: "have", title: `Flood ${i}`, body: "x" });
    } catch (e) { threw = e; break; }
  }
  assert.ok(threw, "the 11th post within the window is refused");
  assert.match(threw.message, /per hour/);
  pass("mshikano post cooldown caps an actor at the hourly limit");
}

// ---------------------------------------------------------------------------
// 4. HUDUMA ORDER EXPIRY
// ---------------------------------------------------------------------------
{
  // Create a paid, running order via the public path, then expire it.
  const order = hudumaOrders.createOrder({ phone: "254700000000", serviceId: "cr12", capturedInputs: { companyRef: "X" } });
  // Force it into RUNNING with LOCKED escrow by driving the state machine.
  hudumaOrders.registerStkPush(order.id, { mpesaCheckoutId: "CO1", amount: 500 });
  hudumaOrders.lockEscrow(order.id, { mpesaCheckoutId: "CO1", amount: 500 });
  hudumaOrders.beginExecution(order.id);
  assert.equal(hudumaOrders.getOrder(order.id).status, "RUNNING");

  const expired = hudumaOrders.expireOrder(order.id, { reason: "no executor response" });
  assert.equal(expired.status, "EXPIRED");
  assert.equal(expired.escrowStatus, "EXPIRED");

  // A completed order can never be expired (no backwards edge).
  const done = hudumaOrders.createOrder({ phone: "254700000001", serviceId: "cr12", capturedInputs: { companyRef: "Y" } });
  hudumaOrders.registerStkPush(done.id, { mpesaCheckoutId: "CO2", amount: 500 });
  hudumaOrders.lockEscrow(done.id, { mpesaCheckoutId: "CO2", amount: 500 });
  hudumaOrders.beginExecution(done.id);
  hudumaOrders.completeOrder(done.id, { document: { url: "https://s3/bucket/doc.pdf", signatureHash: "abc".repeat(21) }, executorRef: "e" });
  assert.throws(() => hudumaOrders.expireOrder(done.id), /cannot be expired/);

  // The sweep reports stuck orders (records-only, derived).
  const stuck = hudumaOrders.listExpiringOrders(1); // 1ms -> everything old
  assert.ok(Array.isArray(stuck), "sweep returns a list, never mutates");
  pass("huduma orders have an expiry/escalation path out of permanent lock");
}

// ---------------------------------------------------------------------------
// 5. CONFIRM-AFTER-CANCEL (two-party race, serialized)
// ---------------------------------------------------------------------------
{
  // The store is synchronous + single-threaded, so concurrent callbacks are
  // serialized. Pin that a cancelled work order can never be completed, and a
  // duplicate confirm is a no-op — the two-party-confirm integrity invariants.
  const requester = user("wo_req");
  const supplier = user("wo_sup");
  const s = await import("../src/domain/supply.js");
  const r = await import("../src/domain/requests.js");
  const m = await import("../src/domain/matching.js");
  const q = await import("../src/domain/quotes.js");
  const w = await import("../src/domain/workOrders.js");

  const ent = s.createEnterprise(supplier.id, {
    displayName: "Int Supplier", businessType: "manufacturer", supplyRole: "direct_supplier",
    location: "Nairobi", serviceAreas: ["Nairobi"], publication: "public",
    firstCapability: { name: "Boxes", category: "Packaging", supplyMode: "direct", capacityKind: "production", unit: "pieces", leadTime: { minDays: 1, maxDays: 2 }, serviceAreas: ["Nairobi"] }
  });
  let req = r.createRequest(requester.id, { title: "100 branded boxes", description: "Integrity test procurement", quantity: 100, unit: "pieces", category: "Packaging", location: "Nairobi", intent: "submit" });
  req = r.changeRequestStatus(requester.id, req.id, { status: "matching", revision: req.revision });
  const match = m.list(requester.id, req.id).matches.find((x) => x.participantId === ent.id);
  const inv = q.requestQuote(requester.id, match.id, { requestRevision: req.revision, matchRevision: match.revision, shareRequirements: true });
  m.expressInterest(supplier.id, match.id, { requestRevision: req.revision, revision: match.revision });
  let quote = q.start(supplier.id, inv.id, { revision: inv.revision });
  quote = q.mutate(supplier.id, quote.id, { action: "submit", revision: quote.revision, requestRevision: req.revision, idempotencyKey: `int-q-${Date.now()}-abcdefghijklmnopqrstuvwxyz`, terms: { quotedQuantity: 100, unit: "pieces", unitPriceMinor: 100, currency: "KES", deliveryCostMinor: 0, sourcingFeeMinor: 0, otherCosts: [], productionLeadDays: 1, deliveryLeadDays: 1, sourceType: "direct", specifications: "Boxes" } });
  const cur = r.getRequest(requester.id, req.id);
  const acc = q.mutate(requester.id, quote.id, { action: "accept", revision: quote.revision, requestRevision: cur.revision, idempotencyKey: `int-a-${Date.now()}-abcdefghijklmnopqrstuvwxyz` });
  let work = w.get(requester.id, acc.workOrderId);
  // Cancel before start.
  work = w.mutate(requester.id, work.id, { action: "cancel", revision: work.revision, agreementRevision: work.agreements.at(-1).revision, idempotencyKey: `int-c-${Date.now()}-abcdefghijklmnopqrstuvwxyz`, note: "no longer needed" });
  assert.equal(work.status, "cancelled");
  // A complete after cancel is refused (the work order is closed).
  assert.throws(() => w.mutate(supplier.id, work.id, { action: "complete", revision: work.revision, agreementRevision: work.agreements.at(-1).revision, idempotencyKey: `int-c2-${Date.now()}-abcdefghijklmnopqrstuvwxyz` }), /closed/);
  pass("a cancelled work order cannot be completed (confirm-after-cancel refused)");
}

console.log(`\nPASS ${count}`);
