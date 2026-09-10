import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-lmd-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js"),
  auth = await import("../src/domain/auth.js"),
  lmd = await import("../src/domain/lipaMdogo.js"),
  partner = await import("../src/domain/partner.js"),
  vendors = await import("../src/domain/vendor.js");
let count = 0;
const pass = (name) => { count++; console.log("PASS " + name); };
const user = (handle) => auth.createUser({ handle, password: "lipa-mdogo-password" });

// Fixtures: a licensed lender (sacco partner), a customer, a vendor.
const customer = user("lmd_customer");
const vendorOwner = user("lmd_vendorowner");
const lender = partner.createPartner({ name: "M-Pesa SACCO", partnerType: "sacco", key: "sacco-lender" });
const nonLender = partner.createPartner({ name: "Women Org", partnerType: "women_org", key: "women-org" });
const vendor = vendors.createVendor({ ownerId: vendorOwner.id, displayName: "Gadget Shop" });

async function main() {
  // --- contract records ---
  assert.throws(() => lmd.createContract({ lenderId: nonLender.id, customerId: customer.id, totalValue: 10000, downPayment: 2000, termMonths: 4 }), (e) => e.code === "lender_not_licensed");
  assert.throws(() => lmd.createContract({ lenderId: "nope", customerId: customer.id, totalValue: 10000, termMonths: 4 }), (e) => e.code === "not_found");
  pass("createContract requires a licensed lender (bank/sacco/cooperative)");

  const c = lmd.createContract({
    lenderId: lender.id, vendorId: vendor.id, customerId: customer.id,
    asset: { name: "Home Radio", deviceId: "RADIO-001" },
    totalValue: 10000, downPayment: 2000, termMonths: 4
  });
  assert.equal(c.asset.financed, 8000);
  assert.equal(c.schedule.length, 4);
  assert.deepEqual(c.schedule.map((s) => s.amountDue), [2000, 2000, 2000, 2000]);
  assert.equal(c.lenderKey, "sacco-lender");
  pass("createContract derives a flat schedule from total minus down payment");

  const cRem = lmd.createContract({ lenderId: lender.id, customerId: customer.id, totalValue: 10000, downPayment: 0, termMonths: 3 });
  assert.deepEqual(cRem.schedule.map((s) => s.amountDue), [3333, 3333, 3334]);
  pass("the schedule folds the integer remainder into the final installment");

  const cHash = lmd.createContract({
    lenderId: lender.id, customerId: customer.id, totalValue: 10000, termMonths: 2,
    nationalIdHash: "12345678", hubVerificationStamp: "Hub KYC #A-1"
  });
  assert.match(cHash.verification.nationalIdHash, /^[0-9a-f]{64}$/);
  assert.ok(!cHash.verification.nationalIdHash.includes("12345678"));
  pass("the national ID is stored only as a SHA-256 hash, never in the clear");

  // --- collection + confirmation ---
  const cCol = lmd.createContract({ lenderId: lender.id, vendorId: vendor.id, customerId: customer.id, totalValue: 8000, downPayment: 0, termMonths: 2 });
  let noProvider = null;
  try { await lmd.requestCollection(cCol.id, 0, { phone: "0722000111" }); } catch (e) { noProvider = e; }
  assert.equal(noProvider?.code, "provider_unavailable");
  pass("requestCollection refuses without a collection provider");

  process.env.TUMA_EMAIL = "lmd@example.com";
  process.env.TUMA_API_KEY = "lmd_test_key";
  process.env.TUMA_WEBHOOK_SECRET = "lmd-cb-secret";
  process.env.BRIEF_PUBLIC_ORIGIN = "https://brief.example.com";
  const tuma = await import("../src/connectors/tuma.js");
  tuma._resetTokenCache();
  const fakeFetch = async (url) => {
    const u = String(url);
    if (u.includes("/auth/token")) return { ok: true, status: 200, json: async () => ({ data: { token: "mock.jwt.token" } }) };
    if (u.includes("/payment/stk-push")) return { ok: true, status: 200, json: async () => ({ success: true, data: { checkout_request_id: "lmd_CO_1" } }) };
    throw new Error("unexpected URL " + u);
  };
  const res = await lmd.requestCollection(cCol.id, 0, { phone: "0722000111", idempotencyKey: "lmd-1", fetchImpl: fakeFetch });
  assert.equal(res.ok, true);
  assert.equal(res.charged, true);
  assert.equal(res.checkoutRequestId, "lmd_CO_1");
  assert.equal(res.payment.installmentIndex, 0);
  assert.equal(res.payment.amountDue, 4000);
  pass("requestCollection dispatches the STK push and records an intent");

  const applied = lmd.confirmPayment({ providerRef: "lmd_CO_1", succeeded: true, amount: 4000, receipt: "RX-9" });
  assert.equal(applied.ok, true);
  assert.equal(applied.payment.status, "confirmed");
  assert.match(applied.payment.receiptHash, /^[0-9a-f]{64}$/);
  const tx = store.find("ledgerTransactions", (t) => t.id === applied.transactionId);
  assert.equal(tx.type, "lipa_mdogo_installment");
  assert.equal(tx.status, "settled");
  pass("the provider callback confirms the installment, writes ONE settled tx + receipt hash");

  const dup = lmd.confirmPayment({ providerRef: "lmd_CO_1", succeeded: true, amount: 4000, receipt: "RX-9" });
  assert.equal(dup.ok, true);
  assert.equal(dup.duplicate, true);
  pass("a replayed callback is an idempotent no-op");

  store.insert("lipaMdogoPayments", { id: "lmdp_2", contractId: cCol.id, installmentIndex: 1, amountDue: 4000, amount: 4000, providerRef: "lmd_CO_2", status: "intent", receiptHash: null, receipt: null, collectedAt: null, createdAt: new Date().toISOString() });
  const bad = lmd.confirmPayment({ providerRef: "lmd_CO_2", succeeded: true, amount: 1, receipt: "RX-X" });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "amount_mismatch");
  pass("an amount mismatch fails loudly and records no money");

  // --- derived maturity ---
  const cMat = lmd.createContract({ lenderId: lender.id, vendorId: vendor.id, customerId: customer.id, totalValue: 9000, downPayment: 0, termMonths: 3 });
  store.insert("lipaMdogoPayments", { id: "lmdp_3", contractId: cMat.id, installmentIndex: 0, amountDue: 3000, amount: 3000, providerRef: "lmd_CO_3", status: "confirmed", receiptHash: "x".repeat(64), receipt: null, collectedAt: new Date().toISOString(), createdAt: new Date().toISOString() });
  const state = lmd.contractState(cMat.id);
  assert.equal(state.schedule[0].state, "paid");
  assert.equal(state.summary.paidCount, 1);
  assert.equal(state.summary.remaining, 6000);
  assert.equal(state.maturity, "paying");
  pass("contractState derives paid/remaining and 'paying' maturity");

  const cOver = lmd.createContract({ lenderId: lender.id, customerId: customer.id, totalValue: 2000, downPayment: 0, termMonths: 1 });
  store.update("lipaMdogoContracts", cOver.id, { schedule: [{ index: 0, dueDate: "2000-01-01", amountDue: 2000 }] });
  assert.equal(lmd.contractState(cOver.id).schedule[0].state, "overdue");
  assert.equal(lmd.contractState(cOver.id).maturity, "overdue");
  store.insert("lipaMdogoPayments", { id: "lmdp_4", contractId: cOver.id, installmentIndex: 0, amountDue: 2000, amount: 2000, providerRef: "lmd_CO_4", status: "confirmed", receiptHash: "y".repeat(64), receipt: null, collectedAt: new Date().toISOString(), createdAt: new Date().toISOString() });
  assert.equal(lmd.contractState(cOver.id).maturity, "matured");
  pass("overdue and matured states are derived from real payments, not stored");

  // --- HTTP ---
  const appMod = await import("../src/index.js");
  const app = appMod.default;
  const srv = app.listen(0);
  const port = srv.address().port;
  const tokenOf = (u) => auth.login({ handle: u.handle, password: "lipa-mdogo-password" }).token;
  const customerToken = tokenOf(customer), vendorToken = tokenOf(vendorOwner);
  const call = async (pathName, method = "GET", body, token) => {
    const headers = { "content-type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${pathName}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  try {
    assert.equal((await call("/api/me/lipa-mdogo")).status, 401);
    pass("API: lipa-mdogo requires authentication");

    const mine = await call("/api/me/lipa-mdogo", "GET", undefined, customerToken);
    assert.equal(mine.status, 200);
    assert.ok(Array.isArray(mine.body.contracts));
    pass("API: a member reads their own contracts with derived state");

    const badLender = await call("/api/lipa-mdogo/contracts", "POST", { lenderId: nonLender.id, customerId: customer.id, totalValue: 1000, termMonths: 1 }, vendorToken);
    assert.equal(badLender.status, 409);
    pass("API: a non-licensed lender is refused (409)");

    const created = await call("/api/lipa-mdogo/contracts", "POST", { lenderId: lender.id, vendorId: vendor.id, customerId: customer.id, asset: { name: "Kettle" }, totalValue: 6000, downPayment: 1000, termMonths: 5 }, vendorToken);
    assert.equal(created.status, 201);
    assert.equal(created.body.contract.asset.financed, 5000);
    assert.equal(created.body.contract.schedule.length, 5);
    pass("API: a valid contract returns its derived schedule");
  } finally {
    srv.close();
  }

  console.log(`\nPASS ${count}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
