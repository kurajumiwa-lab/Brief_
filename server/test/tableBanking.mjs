import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-tablebanking-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js"),
  auth = await import("../src/domain/auth.js"),
  tableBanking = await import("../src/domain/tableBanking.js");
let count = 0;
const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };
const rejects = (fn, code) => assert.throws(fn, (e) => !code || e.code === code);
const user = (handle) => auth.createUser({ handle, password: "group-password" });

// Fixtures: an existing group of 5, one owns the tableBanking.
const owner = user("ch_owner");
const m2 = user("ch_m2"), m3 = user("ch_m3"), m4 = user("ch_m4"), m5 = user("ch_m5");

const c = tableBanking.createTableBanking({ ownerId: owner.id, name: "Kiama Circle", contributionAmount: 5000, cycleDays: 30, latePenaltyKes: 100 });
for (const m of [m2, m3, m4, m5]) tableBanking.joinTableBanking(c.id, m.id);

// ---------------------------------------------------------------------------
// ROTATION + CONTRIBUTIONS
// ---------------------------------------------------------------------------
test("a group starts with the owner first in the rotation", () => {
  const rot = tableBanking.rotationView(c.id);
  assert.equal(rot.order.length, 5);
  assert.equal(rot.currentMemberId, owner.id);
  assert.equal(rot.nextMemberId, m2.id);
  assert.match(rot.note, /deterministic/i);
});

test("contributions are records, idempotent by key, and pool is derived", () => {
  const s0 = tableBanking.summary(c.id);
  assert.equal(s0.totalContributed, 0);
  assert.equal(s0.cashOnHand, 0);

  tableBanking.recordContribution(c.id, owner.id, { amount: 5000, idempotencyKey: "c-owner-1", receiptHash: "MPESA-ABC" });
  tableBanking.recordContribution(c.id, m2.id, { amount: 5000, idempotencyKey: "c-m2-1" });
  // replay the same key -> no second row
  tableBanking.recordContribution(c.id, owner.id, { amount: 5000, idempotencyKey: "c-owner-1" });

  const s = tableBanking.summary(c.id);
  assert.equal(s.totalContributed, 10000);
  assert.equal(s.cashOnHand, 10000);
  assert.equal(s.membersNotYetContributed.length, 3);
});

test("advanceTurn records the handoff and moves the rotation", () => {
  tableBanking.advanceTurn(c.id, owner.id);
  const rot = tableBanking.rotationView(c.id);
  assert.equal(rot.currentMemberId, m2.id);
  assert.ok(rot.order.find((o) => o.userId === owner.id).received, "owner marked received");
});

test("skipTurn moves a member to the end; swapTurn exchanges places", () => {
  tableBanking.skipTurn(c.id, m2.id);
  let rot = tableBanking.rotationView(c.id);
  assert.equal(rot.order[rot.order.length - 1].userId, m2.id);

  tableBanking.swapTurn(c.id, m3.id, m4.id);
  rot = tableBanking.rotationView(c.id);
  const a = rot.order.findIndex((o) => o.userId === m3.id);
  const b = rot.order.findIndex((o) => o.userId === m4.id);
  // positions swapped relative to before (m3 was before m4)
  assert.ok(a > b, "m3 and m4 exchanged order");
});

// ---------------------------------------------------------------------------
// LOANS
// ---------------------------------------------------------------------------
test("flat loan schedule spreads principal + interest evenly", () => {
  const loan = tableBanking.applyLoan(c.id, m3.id, { principal: 12000, interestType: "flat", ratePercent: 12, termMonths: 12 });
  const sched = tableBanking.loanSchedule(loan.id);
  assert.equal(sched.schedule.length, 12);
  // total interest = 12000 * 0.12 * 1 = 1440; total repayable = 13440
  assert.equal(sched.totalRepayable, 13440);
  assert.equal(sched.schedule[0].installment, Math.floor(13440 / 12));
  // last installment folds the remainder
  assert.equal(sched.schedule.reduce((s, x) => s + x.installment, 0), 13440);
});

test("reducing-balance loan charges interest on the declining principal", () => {
  const loan = tableBanking.applyLoan(c.id, m4.id, { principal: 12000, interestType: "reducing_balance", ratePercent: 12, termMonths: 12 });
  const sched = tableBanking.loanSchedule(loan.id);
  assert.equal(sched.schedule.length, 12);
  // First month interest > last month interest (declining).
  assert.ok(sched.schedule[0].interest > sched.schedule[11].interest);
  // Principal portion is roughly equal; outstanding hits zero at the end.
  assert.equal(sched.schedule[11].outstanding, 0);
});

test("guarantor sign-off: loan clears only after the quorum approves", () => {
  const loan = tableBanking.applyLoan(c.id, m5.id, { principal: 10000, interestType: "flat", ratePercent: 0, termMonths: 5, guarantorsRequired: 2 });
  assert.equal(loan.status, "pending_guarantees");
  // borrower cannot self-guarantee
  rejects(() => tableBanking.signGuarantee(loan.id, m5.id), "self_guarantee");
  tableBanking.signGuarantee(loan.id, m2.id);
  assert.equal(store.find("tableBankingLoans", (l) => l.id === loan.id).status, "pending_guarantees", "one guarantee is not enough");
  tableBanking.signGuarantee(loan.id, m3.id);
  assert.equal(store.find("tableBankingLoans", (l) => l.id === loan.id).status, "approved");
  tableBanking.approveLoan(loan.id, owner.id);
  assert.equal(store.find("tableBankingLoans", (l) => l.id === loan.id).status, "active");
});

test("repayments reduce the derived balance and settle when fully paid", () => {
  const loan = tableBanking.applyLoan(c.id, m2.id, { principal: 6000, interestType: "flat", ratePercent: 0, termMonths: 6 });
  tableBanking.approveLoan(loan.id, owner.id);
  tableBanking.recordRepayment(loan.id, { amount: 6000, idempotencyKey: "repay-1", receiptHash: "MPESA-R" });
  const bal = tableBanking.outstandingBalance(loan.id);
  assert.equal(bal.remaining, 0);
  assert.equal(store.find("tableBankingLoans", (l) => l.id === loan.id).status, "settled");
});

test("a member's view shows what they owe and whether they are next", () => {
  const view = tableBanking.memberView(c.id, m2.id);
  assert.equal(typeof view.contributedKes, "number");
  assert.equal(typeof view.owesKes, "number");
  assert.equal(typeof view.isNext, "boolean");
});

// ---------------------------------------------------------------------------
// PAYOUTS (maker-checker)
// ---------------------------------------------------------------------------
test("a payout needs a maker and a DIFFERENT checker", () => {
  const payout = tableBanking.requestPayout(c.id, m4.id, owner.id, { amount: 5000 });
  assert.equal(payout.status, "pending");
  // maker cannot confirm their own request
  rejects(() => tableBanking.confirmPayout(payout.id, owner.id), "maker_is_checker");
  // a different member can
  const confirmed = tableBanking.confirmPayout(payout.id, m5.id);
  assert.equal(confirmed.status, "confirmed");
  assert.equal(confirmed.checkerId, m5.id);
});

test("a member cannot request their own payout", () => {
  rejects(() => tableBanking.requestPayout(c.id, owner.id, owner.id, { amount: 5000 }), "self_payout");
});

console.log(`\nPASS ${count}`);
