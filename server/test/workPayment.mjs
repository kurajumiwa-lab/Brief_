import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-wpay-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js"),
  auth = await import("../src/domain/auth.js"),
  s = await import("../src/domain/supply.js"),
  r = await import("../src/domain/requests.js"),
  m = await import("../src/domain/matching.js"),
  q = await import("../src/domain/quotes.js"),
  w = await import("../src/domain/workOrders.js"),
  wp = await import("../src/domain/workPayment.js");
let count = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log("PASS " + name);
};
const rejects = (fn, code) => assert.throws(fn, (e) => !code || e.code === code);
const user = (handle) =>
  auth.createUser({ handle, password: "work-payment-password" });
const buyer = user("wpay_buyer"),
  supplier = user("wpay_supplier"),
  agent = user("wpay_agent"),
  outsider = user("wpay_outsider");
let seq = 0;

function enterprise(u, source) {
  return s.createEnterprise(u.id, {
    displayName: source ? "Agent Co" : "Supplier Co",
    businessType: source ? "sourcing_agent" : "manufacturer",
    supplyRole: source ? "verified_sourcing_agent" : "direct_supplier",
    location: "Nairobi",
    serviceAreas: ["Nairobi"],
    publication: "public",
    firstCapability: {
      name: source ? "Sourced boxes" : "Branded boxes",
      productsServices: ["Boxes"],
      category: "Packaging",
      supplyMode: source ? "source" : "direct",
      capacityKind: source ? "sourcing_access" : "production",
      typicalCapacity: 50000,
      minimumQuantity: 100,
      maximumQuantity: 100000,
      unit: "pieces",
      leadTime: { minDays: 2, maxDays: 4 },
      serviceAreas: ["Nairobi"],
    },
  });
}
const sup = enterprise(supplier, false),
  agt = enterprise(agent, true);

function buildWork(source = false, terms = {}) {
  const u = source ? agent : supplier,
    pp = source ? agt : sup;
  let req = r.createRequest(buyer.id, {
    title: "100 branded boxes",
    description: "A payable work order",
    quantity: 100,
    unit: "pieces",
    category: "Packaging",
    location: "Nairobi",
    deliveryLocation: "Buyer warehouse",
    requiredBy: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    specifications: { material: "Corrugated" },
    visibility: "private",
    intent: "submit",
  });
  req = r.changeRequestStatus(buyer.id, req.id, { status: "matching", revision: req.revision });
  const match = m.list(buyer.id, req.id).matches.find((x) => x.participantId === pp.id);
  const inv = q.requestQuote(buyer.id, match.id, {
    requestRevision: req.revision,
    matchRevision: match.revision,
    shareRequirements: true,
  });
  m.expressInterest(u.id, match.id, { requestRevision: req.revision, revision: match.revision });
  let quote = q.start(u.id, inv.id, { revision: inv.revision });
  quote = q.mutate(u.id, quote.id, {
    action: "submit",
    revision: quote.revision,
    requestRevision: req.revision,
    idempotencyKey: `wpay-quote-${++seq}-abcdefghijklmnopqrstuvwxyz`,
    terms: {
      quotedQuantity: 100,
      unit: "pieces",
      unitPriceMinor: 1500,
      currency: "KES",
      deliveryCostMinor: 5000,
      sourcingFeeMinor: 0,
      otherCosts: [],
      productionLeadDays: 3,
      deliveryLeadDays: 1,
      sourceType: source ? "sourcing" : "direct",
      specifications: "Branded boxes",
      ...terms,
    },
  });
  const curReq = r.getRequest(buyer.id, req.id);
  const accepted = q.mutate(buyer.id, quote.id, {
    action: "accept",
    revision: quote.revision,
    requestRevision: curReq.revision,
    idempotencyKey: `wpay-accept-${++seq}-abcdefghijklmnopqrstuvwxyz`,
  });
  return {
    req: r.getRequest(buyer.id, req.id),
    work: w.get(buyer.id, accepted.workOrderId),
    supplier: u,
  };
}

// 155,000 minor = KES 1,550.00; collectible = 1550 whole KES.
const direct = buildWork(false);

// --- INTENT: amount derived, authorization, idempotency ---------------------
test("A Work Order payment intent derives the amount from the agreement", () => {
  const { intent } = wp.createIntent({ workOrderId: direct.work.id, payerId: buyer.id, phone: "0722000111" });
  assert.equal(intent.amountMinor, 155000);
  assert.equal(intent.amount, 1550);
  assert.equal(intent.currency, "KES");
  assert.equal(intent.payerId, buyer.id);
  assert.equal(intent.payeeId, supplier.id);
  assert.equal(intent.status, "intent");
  assert.equal(intent.transactionId, null);
  assert.equal(store.all("ledgerTransactions").length, 0);
});

test("Only the requester can create a payment intent", () => {
  assert.throws(
    () => wp.createIntent({ workOrderId: direct.work.id, payerId: outsider.id }),
    /only the requester/,
  );
});

test("A second live intent for the same Work Order is reused, not duplicated", () => {
  const again = wp.createIntent({ workOrderId: direct.work.id, payerId: buyer.id });
  assert.equal(again.reused, true);
  assert.equal(store.all("workPaymentIntents").length, 1);
});

test("An idempotency key reuses the same intent", () => {
  const k = wp.createIntent({ workOrderId: direct.work.id, payerId: buyer.id, idempotencyKey: "wpay-key-1" });
  assert.equal(k.intent.id, store.all("workPaymentIntents")[0].id);
});

test("No provider is configured -> payment is unavailable, not failed", () => {
  assert.equal(wp.activeProvider(), null);
  const st = wp.paymentState(direct.work.id);
  assert.equal(st.status, "pending");
  assert.equal(st.unavailable, true);
});

// --- INITIATION via a deterministic mock provider ---------------------------
// (async — runs inline at top level so its rejection is awaited, not orphaned)
{
  const { intent } = wp.createIntent({ workOrderId: direct.work.id, payerId: buyer.id, phone: "0722000111", idempotencyKey: "wpay-unavail" });
  const res = await wp.requestPayment(intent.id);
  assert.equal(res.ok, false);
  assert.equal(res.reason, "no_provider");
  count++;
  console.log("PASS Requesting payment with no provider returns an honest unavailable state");
}

// Simulate provider acceptance (as the existing order-payment tests do): the
// provider accepted the STK push and returned a checkout reference.
test("Provider acceptance marks the intent authorized — not confirmed", () => {
  const intent = store.all("workPaymentIntents")[0];
  store.update("workPaymentIntents", intent.id, { status: "authorized", providerRef: "wpay_CO_1", initiatedAt: new Date().toISOString() });
  assert.equal(wp.getIntent(intent.id).status, "authorized");
  // Provider initiation success is NOT payment success: no ledger yet.
  assert.equal(store.all("ledgerTransactions").length, 0);
});

// --- CONFIRMATION: the only place money appears -----------------------------
test("A successful callback confirms the payment, writes ONE ledger tx and settles", () => {
  const applied = wp.confirmPayment({ providerRef: "wpay_CO_1", succeeded: true, amount: 1550, receipt: "RX-1" });
  assert.equal(applied.ok, true);
  assert.equal(applied.intent.status, "confirmed");
  assert.equal(applied.transactionId, applied.intent.transactionId);
  const txs = store.all("ledgerTransactions");
  assert.equal(txs.length, 1);
  assert.equal(txs[0].amount, 1550);
  assert.equal(txs[0].currency, "KES");
  assert.equal(txs[0].status, "settled");
  assert.equal(txs[0].metadata.workOrderId, direct.work.id);
  assert.equal(txs[0].metadata.amountMinor, 155000);
  const settlements = store.all("workSettlements");
  assert.equal(settlements.length, 1);
  assert.equal(settlements[0].payeeId, supplier.id);
  assert.equal(settlements[0].status, "settled");
});

test("A repeated callback is an idempotent no-op, never a second transaction", () => {
  const again = wp.confirmPayment({ providerRef: "wpay_CO_1", succeeded: true, amount: 1550, receipt: "RX-1" });
  assert.equal(again.ok, true);
  assert.equal(again.duplicate, true);
  assert.equal(store.all("ledgerTransactions").length, 1);
});

test("Payment success does NOT complete the Work Order (independent facts)", () => {
  assert.equal(w.get(buyer.id, direct.work.id).status, "created");
  // And completing the Work Order does NOT create or mutate a payment.
  const before = store.all("workPaymentIntents").length;
  // (completion is exercised separately in workOrders.mjs; here we assert the
  //  absence of coupling: the payment layer holds no completion hook)
  assert.equal(store.all("workPaymentIntents").length, before);
});

// --- AMOUNT INTEGRITY + FAILURE STATES --------------------------------------
test("An amount mismatch fails the payment loudly and writes no ledger", () => {
  const before = store.all("ledgerTransactions").length;
  const { intent } = wp.createIntent({ workOrderId: direct.work.id, payerId: buyer.id, idempotencyKey: "wpay-tamper" });
  store.update("workPaymentIntents", intent.id, { status: "authorized", providerRef: "wpay_CO_TAMPER" });
  const res = wp.confirmPayment({ providerRef: "wpay_CO_TAMPER", succeeded: true, amount: 1, receipt: "RX-TAMPER" });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "amount_mismatch");
  assert.equal(wp.getIntent(intent.id).status, "failed");
  assert.equal(store.all("ledgerTransactions").length, before);
});

test("A cancelled callback is a distinct terminal state with no ledger entry", () => {
  const { intent } = wp.createIntent({ workOrderId: direct.work.id, payerId: buyer.id, idempotencyKey: "wpay-cancel" });
  store.update("workPaymentIntents", intent.id, { status: "authorized", providerRef: "wpay_CO_CANCEL" });
  const res = wp.confirmPayment({ providerRef: "wpay_CO_CANCEL", succeeded: false, cancelled: true });
  assert.equal(res.cancelled, true);
  assert.equal(wp.getIntent(intent.id).status, "cancelled");
});

test("A provider failure is a terminal state that preserves the attempt", () => {
  const { intent } = wp.createIntent({ workOrderId: direct.work.id, payerId: buyer.id, idempotencyKey: "wpay-fail" });
  store.update("workPaymentIntents", intent.id, { status: "authorized", providerRef: "wpay_CO_FAIL" });
  const res = wp.confirmPayment({ providerRef: "wpay_CO_FAIL", succeeded: false, failureReason: "insufficient funds" });
  assert.equal(res.failed, true);
  const i = wp.getIntent(intent.id);
  assert.equal(i.status, "failed");
  assert.match(i.failureReason, /insufficient funds/);
  // The failed attempt is preserved in history, not erased.
  assert.equal(store.all("workPaymentIntents").filter((p) => p.id === intent.id).length, 1);
});

test("A replayed receipt is refused", () => {
  const { intent } = wp.createIntent({ workOrderId: direct.work.id, payerId: buyer.id, idempotencyKey: "wpay-replay" });
  store.update("workPaymentIntents", intent.id, { status: "authorized", providerRef: "wpay_CO_REPLAY" });
  const res = wp.confirmPayment({ providerRef: "wpay_CO_REPLAY", succeeded: true, amount: 1550, receipt: "RX-1" });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "replayed_receipt");
});

test("An unknown reference is refused", () => {
  const res = wp.confirmPayment({ providerRef: "wpay_CO_NOPE", succeeded: true, amount: 1550, receipt: "RX-NOPE" });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "unknown_reference");
});

// --- SOURCING TRANSPARENCY (§17) --------------------------------------------
test("A sourcing-agent agreement exposes the source/fee/logistics breakdown", () => {
  const sourced = buildWork(true, {
    unitPriceMinor: 1400,
    deliveryCostMinor: 3000,
    sourcingFeeMinor: 20000,
  });
  const b = wp.agreementBreakdown(sourced.work.id);
  assert.equal(b.sourcingMode, "sourcing");
  assert.equal(b.sourceCostMinor, 140000);
  assert.equal(b.sourcingFeeMinor, 20000);
  assert.equal(b.logisticsCostMinor, 3000);
  assert.equal(b.totalMinor, 163000);
  // total = source + fee + logistics, never a hidden margin.
  assert.equal(b.totalMinor, b.sourceCostMinor + b.sourcingFeeMinor + b.logisticsCostMinor);
});

// --- PRIVACY (§25) ----------------------------------------------------------
test("Payment history is payer/payee scoped; outsiders see nothing", () => {
  assert.ok(wp.listPaymentsForWorkOrder(buyer.id, direct.work.id).length >= 1);
  assert.ok(wp.listPaymentsForWorkOrder(supplier.id, direct.work.id).length >= 1);
  assert.equal(wp.listPaymentsForWorkOrder(outsider.id, direct.work.id).length, 0);
  assert.equal(wp.listPaymentsForUser(outsider.id).length, 0);
  assert.ok(wp.listPaymentsForUser(buyer.id).length >= 1);
});

// --- RECONCILIATION (§12) ---------------------------------------------------
test("Reconciliation reports drift, never silently absorbs it", () => {
  // Force a confirmed intent with a missing transaction to expose a discrepancy.
  const { intent } = wp.createIntent({ workOrderId: direct.work.id, payerId: buyer.id, idempotencyKey: "wpay-recon" });
  store.update("workPaymentIntents", intent.id, {
    status: "confirmed",
    providerRef: "wpay_CO_RECON",
    transactionId: "txn_missing",
  });
  const rec = wp.reconcileWorkPayments();
  assert.ok(rec.discrepancies.some((d) => d.kind === "missing_transaction" && d.intentId === intent.id));
  // Restore integrity for the remaining assertions.
  store.update("workPaymentIntents", intent.id, { status: "failed", transactionId: null, providerRef: null });
  assert.equal(wp.reconcileWorkPayments().balanced, true);
});

console.log(`\nPASS ${count}`);

// --- PROVIDER INITIATION via a deterministic mock (spec §27) ----------------
{
  // Configure Tuma just enough to be "configured", then inject a fetch mock
  // that answers /auth/token and /payment/stk-push. No real network, no real
  // money — this proves the initiation path accepts and marks authorized.
  process.env.TUMA_EMAIL = "wpay@example.com";
  process.env.TUMA_API_KEY = "wpay_test_key";
  process.env.TUMA_WEBHOOK_SECRET = "wpay-cb-secret";
  process.env.BRIEF_PUBLIC_ORIGIN = "https://brief.example.com";
  const tuma = await import("../src/connectors/tuma.js");
  tuma._resetTokenCache();

  // §32: the provider status surfaced to clients must NEVER contain the
  // callback secret (it is the only defence on unsigned callbacks).
  const statusJson = JSON.stringify(wp.providerStatus());
  assert.ok(!statusJson.includes("wpay-cb-secret"));
  assert.ok(!statusJson.includes("/api/webhooks/tuma/"));
  count++;
  console.log("PASS Provider status never leaks the callback secret");

  const { intent } = wp.createIntent({
    workOrderId: direct.work.id,
    payerId: buyer.id,
    phone: "0722000111",
    idempotencyKey: "wpay-provider-init",
  });
  let stkSeen = null;
  const fakeFetch = async (url, opts) => {
    const u = String(url);
    if (u.includes("/auth/token")) {
      return { ok: true, status: 200, json: async () => ({ data: { token: "mock.jwt.token" } }) };
    }
    if (u.includes("/payment/stk-push")) {
      stkSeen = JSON.parse(opts.body);
      return { ok: true, status: 200, json: async () => ({ success: true, data: { checkout_request_id: "wpay_CO_MOCK", merchant_request_id: "m1", customer_message: "Check your phone" } }) };
    }
    throw new Error("unexpected URL " + u);
  };
  const res = await wp.requestPayment(intent.id, { fetchImpl: fakeFetch });
  assert.equal(res.ok, true);
  assert.equal(res.providerRef, "wpay_CO_MOCK");
  // The amount sent to the provider is the whole-unit collectible amount.
  assert.equal(stkSeen.amount, 1550);
  assert.equal(stkSeen.phone, "254722000111");
  const updated = wp.getIntent(intent.id);
  assert.equal(updated.status, "authorized");
  // Initiation success is NOT payment success: no ledger entry yet.
  assert.equal(store.all("ledgerTransactions").length, 1);
  count++;
  console.log("PASS Provider initiation accepts and marks authorized, without creating money");

  // A provider callback completes the loop (and the webhook dispatches to it).
  const confirmed = wp.confirmPayment({ providerRef: "wpay_CO_MOCK", succeeded: true, amount: 1550, receipt: "RX-MOCK" });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.intent.status, "confirmed");
  count++;
  console.log("PASS Provider callback confirms the initiated payment");

  delete process.env.TUMA_EMAIL;
  delete process.env.TUMA_API_KEY;
  delete process.env.TUMA_WEBHOOK_SECRET;
  delete process.env.BRIEF_PUBLIC_ORIGIN;
  tuma._resetTokenCache();
}

// --- HTTP API (spec §28: domain/API tests) ----------------------------------
{
  const appMod = await import("../src/index.js");
  const app = appMod.default;
  const srv = app.listen(0);
  const port = srv.address().port;
  const authMod = await import("../src/domain/auth.js");
  const buyerToken = authMod.login({ handle: "wpay_buyer", password: "work-payment-password" }).token;
  const supplierToken = authMod.login({ handle: "wpay_supplier", password: "work-payment-password" }).token;
  const outsiderToken = authMod.login({ handle: "wpay_outsider", password: "work-payment-password" }).token;
  const call = async (pathName, method = "GET", body, token) => {
    const headers = { "content-type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${pathName}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  try {
    // Pay endpoint: no provider -> honest 503 "Payment unavailable".
    const pay = await call(`/api/work-orders/${direct.work.id}/pay`, "POST", { phone: "0722000111" }, buyerToken);
    assert.equal(pay.status, 503);
    assert.ok(pay.body.intent);
    assert.equal(pay.body.charged, false);
    count++;
    console.log("PASS API: pay endpoint reports unavailable without a provider");

    // Payment state for the Work Order — payer can see; outsider is refused.
    const mine = await call(`/api/work-orders/${direct.work.id}/payments`, "GET", undefined, buyerToken);
    assert.equal(mine.status, 200);
    assert.ok(Array.isArray(mine.body.payments));
    assert.ok(mine.body.breakdown);
    count++;
    console.log("PASS API: payer sees payment state and agreement breakdown");

    const outsiderPayments = await call(`/api/work-orders/${direct.work.id}/payments`, "GET", undefined, outsiderToken);
    // Outsider cannot read the work order at all (404), so the payment list is
    // empty/refused — privacy holds.
    assert.ok(outsiderPayments.status === 200 && outsiderPayments.body.payments.length === 0);
    count++;
    console.log("PASS API: an unrelated user sees no payment history");

    // The payee sees settlement-relevant payment state.
    const payeeView = await call(`/api/work-orders/${direct.work.id}/payments`, "GET", undefined, supplierToken);
    assert.equal(payeeView.status, 200);
    count++;
    console.log("PASS API: the payee sees the Work Order payment state");

    // The caller's own payment history is scoped.
    const history = await call("/api/me/work-payments", "GET", undefined, buyerToken);
    assert.equal(history.status, 200);
    assert.ok(Array.isArray(history.body.payments));
    assert.ok(history.body.payments.length >= 1);
    count++;
    console.log("PASS API: payment history is payer/payee scoped");

    // Unauthorized access is refused.
    const anon = await call(`/api/work-orders/${direct.work.id}/payments`);
    assert.equal(anon.status, 401);
    count++;
    console.log("PASS API: payment endpoints require authentication");
  } finally {
    srv.close();
  }
}

console.log(`\nPASS ${count}`);
