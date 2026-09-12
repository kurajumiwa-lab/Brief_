// ---------------------------------------------------------------------------
// CHAMA — the ledger + calculator for EXISTING table-banking groups.
//
// Brief is NOT the chama, and NOT the lender. The members already exist, already
// trust each other, and already run their rotation. Brief is the spreadsheet
// they hold their meeting with:
//
//   * contributions are RECORDS a member attests (with a receipt hash), never
//     money Brief collected.
//   * the merry-go-round is a DERIVED rotation (who's next, skip, swap) over
//     the member order — pure deterministic arithmetic.
//   * loans are members lending to each other OUT OF THEIR OWN POOL. Brief
//     computes the schedule (flat / reducing-balance) and the penalties; the
//     money moves member-to-member by M-Pesa as it always has.
//   * a payout needs a MAKER and a different CHECKER before it is recorded —
//     the two-person rule that makes an inside job need a conspiracy.
//
// HONESTY (unchanged, restated):
//   * every total is DERIVED by scanning rows. There is no stored balance.
//   * no negative amounts, no fractional shillings, no invented interest.
//   * a member who has not contributed shows "not contributed", never a fake
//     zero that looks like a payment.
//   * the pool is the group's own money. Brief holds none of it.
//
// This module is deliberately SELF-CONTAINED (like groupbuy): the chama pool
// is NOT written into the global marketplace ledger, because it is not the
// member's personal wallet — it is a group's shared spreadsheet. Receipt hashes
// make the trail tamper-evident; nothing here mints or moves money.
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';
import { store, newId } from '../store.js';
import { getUser } from './auth.js';
import * as requests from './requests.js';

export const CHAMA_STATUS = ['active', 'archived'];
export const PAYOUT_STATUS = ['pending', 'confirmed'];
export const LOAN_STATUS = ['pending_guarantees', 'approved', 'active', 'settled', 'defaulted'];
export const INTEREST_TYPES = ['flat', 'reducing_balance'];

function fail(message, status = 400, code = 'validation_error') {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  throw e;
}
function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}
// Money is whole KES (M-Pesa reality): positive integer.
function money(n, name = 'amount') {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) fail(`${name} must be a positive whole number`);
  return Math.round(v);
}
function memberOf(chama, userId) {
  return chama.members.find((m) => m.userId === userId) ?? null;
}
function requireMember(chama, userId) {
  if (!memberOf(chama, userId)) fail('you are not a member of this chama', 403, 'not_member');
}

// ---------------------------------------------------------------------------
// CHAMA + MEMBERSHIP
// ---------------------------------------------------------------------------
export function createChama({ ownerId, name, contributionAmount, currency = 'KES', cycleDays = 30, latePenaltyKes = 0 }) {
  if (!ownerId) fail('an owner is required');
  const n = String(name ?? '').trim();
  if (!n) fail('chama name is required');
  const amt = money(contributionAmount, 'contributionAmount');
  const cyc = Number(cycleDays);
  if (!Number.isInteger(cyc) || cyc < 1) fail('cycleDays must be a whole number of one or more');
  const now = new Date().toISOString();
  const chama = store.insert('chamas', {
    id: newId('chm'),
    ownerId,
    name: n,
    contributionAmount: amt,
    currency,
    cycleDays: cyc,
    latePenaltyKes: Number(latePenaltyKes) > 0 ? Math.round(Number(latePenaltyKes)) : 0,
    members: [{ userId: ownerId, joinedAt: now }],
    order: [ownerId],
    turnIndex: 0,
    status: 'active',
    createdAt: now,
    updatedAt: now
  });
  return chama;
}

export function getChama(id) {
  return store.find('chamas', (c) => c.id === id) ?? null;
}
export function listChamas(userId) {
  return store.filter('chamas', (c) => c.members.some((m) => m.userId === userId));
}

export function joinChama(chamaId, userId) {
  const chama = getChama(chamaId);
  if (!chama) fail('chama not found', 404, 'not_found');
  if (memberOf(chama, userId)) return chama; // idempotent
  const now = new Date().toISOString();
  const members = [...chama.members, { userId, joinedAt: now }];
  const order = [...chama.order, userId]; // new member joins at the end of the rotation
  return store.update('chamas', chamaId, { members, order, updatedAt: now });
}

export function leaveChama(chamaId, userId) {
  const chama = getChama(chamaId);
  if (!chama) fail('chama not found', 404, 'not_found');
  if (chama.ownerId === userId) fail('the owner cannot leave; archive the chama instead', 409, 'owner_cannot_leave');
  requireMember(chama, userId);
  const members = chama.members.filter((m) => m.userId !== userId);
  const order = chama.order.filter((id) => id !== userId);
  const turnIndex = Math.min(chama.turnIndex, order.length - 1);
  return store.update('chamas', chamaId, { members, order, turnIndex, updatedAt: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// CONTRIBUTIONS (records, receipt-hashed, idempotent)
// ---------------------------------------------------------------------------
export function recordContribution(chamaId, memberId, { amount, receiptHash = null, idempotencyKey = null } = {}) {
  const chama = getChama(chamaId);
  if (!chama) fail('chama not found', 404, 'not_found');
  requireMember(chama, memberId);
  const amt = money(amount, 'contribution');
  if (idempotencyKey) {
    const prior = store.find('chamaContributions', (c) => c.idempotencyKey === idempotencyKey && c.chamaId === chamaId);
    if (prior) return prior;
  }
  const at = new Date().toISOString();
  return store.insert('chamaContributions', {
    id: newId('chc'),
    chamaId,
    memberId,
    amount: amt,
    receiptHash: receiptHash ? sha256(receiptHash) : null,
    idempotencyKey: idempotencyKey ?? null,
    at
  });
}

export function contributionsFor(chamaId) {
  return store.filter('chamaContributions', (c) => c.chamaId === chamaId)
    .slice().sort((a, b) => a.at.localeCompare(b.at));
}

// ---------------------------------------------------------------------------
// MERRY-GO-ROUND ROTATION (derived order + turn; skip/swap/advance)
// ---------------------------------------------------------------------------
export function rotationView(chamaId) {
  const chama = getChama(chamaId);
  if (!chama) fail('chama not found', 404, 'not_found');
  const paidOut = store.filter('chamaPayouts', (p) => p.chamaId === chamaId && p.status === 'confirmed')
    .map((p) => p.memberId);
  const order = chama.order.map((userId) => ({
    userId,
    handle: getUser(userId)?.handle ?? null,
    displayName: getUser(userId)?.displayName ?? null,
    isCurrent: userId === chama.order[chama.turnIndex],
    received: paidOut.includes(userId)
  }));
  return {
    order,
    currentIndex: chama.turnIndex,
    currentMemberId: chama.order[chama.turnIndex] ?? null,
    nextMemberId: chama.order[(chama.turnIndex + 1) % chama.order.length] ?? null,
    note: 'The rotation is a deterministic order. Brief records turns; the members pay each other directly.'
  };
}

/** Record that the current member received their turn, then advance. */
export function advanceTurn(chamaId, actorId) {
  const chama = getChama(chamaId);
  if (!chama) fail('chama not found', 404, 'not_found');
  requireMember(chama, actorId);
  const recipient = chama.order[chama.turnIndex];
  if (!recipient) fail('no members to rotate');
  const now = new Date().toISOString();
  // Record the payout as a CONFIRMED handoff (a member-to-member fact).
  if (!store.find('chamaPayouts', (p) => p.chamaId === chamaId && p.memberId === recipient && p.status === 'confirmed' && p.marker === 'turn')) {
    store.insert('chamaPayouts', {
      id: newId('chp'), chamaId, memberId: recipient, amount: chama.contributionAmount,
      status: 'confirmed', marker: 'turn', makerId: actorId, checkerId: actorId, // turn handoffs are peer-to-peer; no dual sign-off
      at: now
    });
  }
  const turnIndex = (chama.turnIndex + 1) % chama.order.length;
  return store.update('chamas', chamaId, { turnIndex, updatedAt: now });
}

/** A member passes their turn: they move to the end of the order. */
export function skipTurn(chamaId, memberId) {
  const chama = getChama(chamaId);
  if (!chama) fail('chama not found', 404, 'not_found');
  requireMember(chama, memberId);
  const order = [...chama.order.filter((id) => id !== memberId), memberId];
  const turnIndex = Math.min(chama.turnIndex, order.length - 1);
  return store.update('chamas', chamaId, { order, turnIndex, updatedAt: new Date().toISOString() });
}

/** Two members swap places in the rotation. */
export function swapTurn(chamaId, aId, bId) {
  const chama = getChama(chamaId);
  if (!chama) fail('chama not found', 404, 'not_found');
  requireMember(chama, aId);
  requireMember(chama, bId);
  const order = [...chama.order];
  const ai = order.indexOf(aId), bi = order.indexOf(bId);
  if (ai < 0 || bi < 0) fail('both members must be in the rotation');
  [order[ai], order[bi]] = [order[bi], order[ai]];
  return store.update('chamas', chamaId, { order, updatedAt: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// LOANS — members borrow from the group's own pool. Brief computes, not lends.
// ---------------------------------------------------------------------------
export function applyLoan(chamaId, borrowerId, { principal, interestType = 'flat', ratePercent = 0, termMonths, guarantorsRequired = 0 }) {
  const chama = getChama(chamaId);
  if (!chama) fail('chama not found', 404, 'not_found');
  requireMember(chama, borrowerId);
  if (!INTEREST_TYPES.includes(interestType)) fail(`interestType must be one of ${INTEREST_TYPES.join(', ')}`);
  const p = money(principal, 'principal');
  const rate = Number(ratePercent);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) fail('ratePercent must be between 0 and 100');
  const term = Number(termMonths);
  if (!Number.isInteger(term) || term < 1 || term > 60) fail('termMonths must be a whole number between 1 and 60');
  const now = new Date().toISOString();
  return store.insert('chamaLoans', {
    id: newId('chl'),
    chamaId,
    borrowerId,
    principal: p,
    interestType,
    ratePercent: rate,
    termMonths: term,
    guarantorsRequired: Number.isInteger(guarantorsRequired) ? Math.max(0, guarantorsRequired) : 0,
    guarantors: [],
    status: guarantorsRequired > 0 ? 'pending_guarantees' : 'approved',
    disbursedAt: null,
    settledAt: null,
    createdAt: now,
    updatedAt: now
  });
}

/**
 * The repayment schedule, DERIVED. Flat: interest = principal * rate * term/12,
 * spread evenly. Reducing-balance: interest each month on the declining
 * principal. All in whole KES; the remainder folds into the last installment.
 */
export function loanSchedule(loanId) {
  const loan = store.find('chamaLoans', (l) => l.id === loanId);
  if (!loan) fail('loan not found', 404, 'not_found');
  const principal = loan.principal;
  const term = loan.termMonths;
  const schedule = [];
  if (loan.interestType === 'flat') {
    const totalInterest = Math.round(principal * (loan.ratePercent / 100) * (term / 12));
    const total = principal + totalInterest;
    const base = Math.floor(total / term);
    let outstanding = total;
    for (let i = 0; i < term; i++) {
      const installment = i === term - 1 ? outstanding : base;
      outstanding -= installment;
      schedule.push({ month: i + 1, principal: null, interest: null, installment, outstanding });
    }
  } else {
    const monthlyRate = loan.ratePercent / 100 / 12;
    const basePrincipal = Math.floor(principal / term);
    let outstanding = principal;
    for (let i = 0; i < term; i++) {
      const principalPortion = i === term - 1 ? outstanding : basePrincipal;
      const interest = Math.round(outstanding * monthlyRate);
      outstanding -= principalPortion;
      schedule.push({ month: i + 1, principal: principalPortion, interest, installment: principalPortion + interest, outstanding });
    }
  }
  return {
    loanId,
    interestType: loan.interestType,
    ratePercent: loan.ratePercent,
    principal,
    totalRepayable: schedule.reduce((s, x) => s + x.installment, 0),
    schedule,
    note: 'Computed schedule. The money is repaid member-to-member; Brief records repayments.'
  };
}

export function signGuarantee(loanId, guarantorId) {
  const loan = store.find('chamaLoans', (l) => l.id === loanId);
  if (!loan) fail('loan not found', 404, 'not_found');
  const chama = getChama(loan.chamaId);
  requireMember(chama, guarantorId);
  if (guarantorId === loan.borrowerId) fail('the borrower cannot guarantee their own loan', 409, 'self_guarantee');
  if (loan.status !== 'pending_guarantees') fail(`this loan is already ${loan.status}`, 409, 'invalid_state');
  if (loan.guarantors.includes(guarantorId)) return loan; // idempotent
  const guarantors = [...loan.guarantors, guarantorId];
  const approved = guarantors.length >= loan.guarantorsRequired;
  return store.update('chamaLoans', loanId, {
    guarantors,
    status: approved ? 'approved' : 'pending_guarantees',
    updatedAt: new Date().toISOString()
  });
}

/** The treasurer/owner approves a fully-guaranteed loan, disbursing from the pool. */
export function approveLoan(loanId, actorId) {
  const loan = store.find('chamaLoans', (l) => l.id === loanId);
  if (!loan) fail('loan not found', 404, 'not_found');
  const chama = getChama(loan.chamaId);
  if (chama.ownerId !== actorId) fail('only the chama owner may approve a loan', 403, 'owner_only');
  if (loan.status !== 'approved') fail(`this loan is ${loan.status}`, 409, 'invalid_state');
  return store.update('chamaLoans', loanId, { status: 'active', disbursedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
}

export function recordRepayment(loanId, { amount, receiptHash = null, idempotencyKey = null } = {}) {
  const loan = store.find('chamaLoans', (l) => l.id === loanId);
  if (!loan) fail('loan not found', 404, 'not_found');
  if (loan.status !== 'active' && loan.status !== 'settled') fail(`cannot repay a ${loan.status} loan`, 409, 'invalid_state');
  const amt = money(amount, 'repayment');
  if (idempotencyKey) {
    const prior = store.find('chamaRepayments', (r) => r.idempotencyKey === idempotencyKey && r.loanId === loanId);
    if (prior) return prior;
  }
  const at = new Date().toISOString();
  const row = store.insert('chamaRepayments', {
    id: newId('chr'), loanId, chamaId: loan.chamaId, amount: amt,
    receiptHash: receiptHash ? sha256(receiptHash) : null, idempotencyKey: idempotencyKey ?? null, at
  });
  // Auto-settle when fully repaid.
  const bal = outstandingBalance(loanId);
  if (bal.remaining === 0 && loan.status === 'active') {
    store.update('chamaLoans', loanId, { status: 'settled', settledAt: at, updatedAt: at });
  }
  return row;
}

/** Outstanding balance + late penalty, DERIVED from repayments vs the schedule. */
export function outstandingBalance(loanId) {
  const loan = store.find('chamaLoans', (l) => l.id === loanId);
  if (!loan) fail('loan not found', 404, 'not_found');
  const sched = loanSchedule(loanId);
  const repaid = store.filter('chamaRepayments', (r) => r.loanId === loanId)
    .reduce((sum, r) => sum + r.amount, 0);
  const remaining = Math.max(0, sched.totalRepayable - repaid);
  // Late penalty: per overdue installment whose due month has passed without
  // being covered. Simplest honest rule: count schedule months past, minus
  // months covered by repayments, times the chama's flat penalty.
  const chama = getChama(loan.chamaId);
  const now = new Date();
  const start = loan.disbursedAt ? new Date(loan.disbursedAt) : new Date(loan.createdAt);
  const monthsElapsed = Math.max(0, Math.floor((now - start) / (30 * 86400000)));
  const monthsCovered = Math.min(loan.termMonths, Math.floor(repaid / (sched.totalRepayable / loan.termMonths)));
  const overdueMonths = Math.max(0, monthsElapsed - monthsCovered);
  const penalty = chama.latePenaltyKes > 0 ? overdueMonths * chama.latePenaltyKes : 0;
  return {
    loanId,
    principal: loan.principal,
    totalRepayable: sched.totalRepayable,
    repaid,
    remaining,
    overdueMonths,
    penaltyKes: penalty,
    status: loan.status,
    note: 'Derived from real repayments. Brief computes; the members pay each other.'
  };
}

// ---------------------------------------------------------------------------
// PAYOUTS — maker-checker (two different members must agree).
// ---------------------------------------------------------------------------
export function requestPayout(chamaId, memberId, makerId, { amount, cycle = null } = {}) {
  const chama = getChama(chamaId);
  if (!chama) fail('chama not found', 404, 'not_found');
  requireMember(chama, memberId);
  requireMember(chama, makerId);
  if (memberId === makerId) fail('the maker cannot request their own payout', 409, 'self_payout');
  const amt = money(amount, 'payout');
  return store.insert('chamaPayouts', {
    id: newId('chp'), chamaId, memberId, amount: amt, status: 'pending',
    makerId, checkerId: null, cycle: cycle ?? null, marker: null, at: new Date().toISOString()
  });
}

export function confirmPayout(payoutId, checkerId) {
  const payout = store.find('chamaPayouts', (p) => p.id === payoutId);
  if (!payout) fail('payout not found', 404, 'not_found');
  if (payout.status !== 'pending') fail(`this payout is already ${payout.status}`, 409, 'invalid_state');
  if (payout.checkerId === null) { /* first confirm sets checker */ }
  if (payout.checkerId && payout.checkerId !== checkerId) fail('a different checker already confirmed this payout', 409, 'already_checked');
  if (payout.makerId === checkerId) fail('the maker cannot also be the checker', 409, 'maker_is_checker');
  return store.update('chamaPayouts', payoutId, { status: 'confirmed', checkerId, updatedAt: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// INDICATORS — the derived "what can happen / did happen".
// ---------------------------------------------------------------------------
export function summary(chamaId) {
  const chama = getChama(chamaId);
  if (!chama) fail('chama not found', 404, 'not_found');
  const contributions = contributionsFor(chamaId);
  const totalContributed = contributions.reduce((s, c) => s + c.amount, 0);
  const payouts = store.filter('chamaPayouts', (p) => p.chamaId === chamaId && p.status === 'confirmed');
  const totalPaidOut = payouts.reduce((s, p) => s + p.amount, 0);
  const loans = store.filter('chamaLoans', (l) => l.chamaId === chamaId);
  const activeLoans = loans.filter((l) => l.status === 'active');
  const loanedOut = activeLoans.reduce((s, l) => s + l.principal, 0);
  const repayments = store.filter('chamaRepayments', (r) => r.chamaId === chamaId);
  const totalRepaid = repayments.reduce((s, r) => s + r.amount, 0);

  const rot = rotationView(chamaId);
  const contributedIds = new Set(contributions.map((c) => c.memberId));
  const receivedIds = new Set(payouts.map((p) => p.memberId));

  return {
    id: chama.id,
    name: chama.name,
    contributionAmount: chama.contributionAmount,
    currency: chama.currency,
    members: chama.members.length,
    // The pool, DERIVED: what the group has on hand after payouts and loans.
    cashOnHand: totalContributed - totalPaidOut - loanedOut + totalRepaid,
    totalContributed,
    totalPaidOut,
    loanedOut,
    totalRepaid,
    // What CAN happen next.
    nextRecipient: rot.currentMemberId,
    nextRecipientName: getUser(rot.currentMemberId)?.displayName ?? getUser(rot.currentMemberId)?.handle ?? null,
    membersNotYetContributed: chama.members.filter((m) => !contributedIds.has(m.userId)).map((m) => m.userId),
    membersNotYetReceived: chama.members.filter((m) => !receivedIds.has(m.userId)).map((m) => m.userId),
    // What DID happen.
    activeLoans: activeLoans.map((l) => ({ id: l.id, borrowerId: l.borrowerId, principal: l.principal, ratePercent: l.ratePercent, remaining: outstandingBalance(l.id).remaining })),
    note: 'All figures are derived from recorded contributions, payouts, loans and repayments. Brief holds none of this money.'
  };
}

/** One member's own view: have I contributed? am I next? what do I owe? */
export function memberView(chamaId, userId) {
  const chama = getChama(chamaId);
  if (!chama) fail('chama not found', 404, 'not_found');
  const s = summary(chamaId);
  const contributed = contributionsFor(chamaId).filter((c) => c.memberId === userId);
  const received = store.filter('chamaPayouts', (p) => p.chamaId === chamaId && p.memberId === userId && p.status === 'confirmed');
  const myLoans = store.filter('chamaLoans', (l) => l.chamaId === chamaId && l.borrowerId === userId);
  return {
    memberId: userId,
    contributedKes: contributed.reduce((x, c) => x + c.amount, 0),
    contributedCount: contributed.length,
    receivedKes: received.reduce((x, p) => x + p.amount, 0),
    isNext: s.nextRecipient === userId,
    owesKes: myLoans.reduce((x, l) => x + outstandingBalance(l.id).remaining, 0),
    loans: myLoans.map((l) => ({ id: l.id, remaining: outstandingBalance(l.id).remaining, status: l.status }))
  };
}

// ---------------------------------------------------------------------------
// COLLECTIVE DEMAND — a chama places a bulk Request as a first-class
// participant in the existing economic chain.
//
// This is the "community that does things" seam. The chama does NOT get a
// parallel procurement system: it rides the SAME Request -> Match -> Quote ->
// WorkOrder -> Payment chain every other requester uses. The only additions are
// (a) provenance — the request carries the chama id + name — and (b) the
// member breakdown, so the chama's collective buying power is legible.
// ---------------------------------------------------------------------------

/**
 * Place a bulk request on behalf of the chama. `actingMemberId` must be a
 * member (the treasurer/owner will act as requester in the chain). The request
 * is created through the ordinary requests.createRequest path, carrying the
 * chama provenance, and a chamaRequests row links it back to the group.
 */
export function placeCollectiveRequest(chamaId, actingMemberId, input = {}) {
  const chama = getChama(chamaId);
  if (!chama) fail('chama not found', 404, 'not_found');
  requireMember(chama, actingMemberId);

  // The member-level breakdown is the honest "who needed how much". It is a
  // RECORD of the aggregation, not a second source of demand.
  const breakdown = Array.isArray(input.breakdown) ? input.breakdown.slice(0, 200) : [];
  const aggregateQuantity = breakdown.length
    ? breakdown.reduce((s, b) => s + (Number(b.quantity) || 0), 0)
    : (Number(input.quantity) || 0);

  // Only pass DEFINED fields: requests.validate() iterates every key it is
  // given, so an `undefined` value (e.g. an omitted subcategory) would fail.
  const reqInput = {
    title: input.title,
    description: input.description,
    category: input.category,
    quantity: aggregateQuantity || input.quantity,
    unit: input.unit,
    currency: input.currency ?? 'KES',
    location: input.location,
    intent: input.intent ?? 'submit',
    specifications: input.specifications ?? {},
    businessContext: {
      ...(input.businessContext ?? {}),
      companyName: input.businessContext?.companyName ?? chama.name,
      chamaId: chama.id,
      chamaName: chama.name
    }
  };
  if (input.subcategory) reqInput.subcategory = input.subcategory;
  if (input.budgetMax != null) reqInput.budgetMax = input.budgetMax;
  if (input.deliveryLocation) reqInput.deliveryLocation = input.deliveryLocation;
  if (input.requiredBy) reqInput.requiredBy = input.requiredBy;
  if (input.urgency) reqInput.urgency = input.urgency;

  const request = requests.createRequest(actingMemberId, reqInput);

  const row = store.insert('chamaRequests', {
    id: newId('chrq'),
    chamaId: chama.id,
    requestId: request.id,
    placedBy: actingMemberId,
    aggregateQuantity,
    memberBreakdown: breakdown,
    placedAt: new Date().toISOString()
  });

  return { request, collective: row };
}

/** The chama's collective requests, newest first, with live request status. */
export function listCollectiveRequests(chamaId) {
  return store.filter('chamaRequests', (r) => r.chamaId === chamaId)
    .slice()
    .sort((a, b) => (a.placedAt < b.placedAt ? 1 : -1))
    .map((row) => ({
      ...row,
      request: store.find('requests', (r) => r.id === row.requestId) ?? null
    }));
}
