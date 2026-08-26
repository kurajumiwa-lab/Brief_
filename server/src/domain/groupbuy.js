// ---------------------------------------------------------------------------
// GROUP BUY ENGINE — the "Chama & Group Buy" financial package.
//
// A Group Buy is a tracked funding pipeline for a chama cycle or a group
// order. It runs on the same orchestration layer as everything else:
//
//   CONTRIBUTIONS  a rapid 3-field intake (member ref, amount, payment source)
//                  records a contribution, writes a REAL ledger transaction,
//                  and returns a structured receipt with a verifiable digest.
//   STEPPER        Funding Pool Initiated -> Target Achieved -> Merchant
//                  Escrow Locked -> Bulk Order Dispatched -> Individual
//                  Delivery. Server-authoritative; TARGET is reached
//                  automatically the moment contributions cover it.
//   SIGNALS        every contribution and stage change emits a signal, which
//                  the Universal Data Router fans out to the group's
//                  WhatsApp / Telegram / webhook endpoints — the same
//                  pipeline a gaming lobby update uses (unified routing).
//
// MONEY HONESTY: a contribution is a RECORD (a ledger row), not a settled
// payment — no provider is connected, and nothing here pretends otherwise.
// The receipt hash is a SHA-256 digest over the canonical receipt fields:
// verifiable against the stored rows, never a signature claim.
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';
import { store, newId } from '../store.js';
import { emitSignal } from './signal.js';
import { createTransaction } from './ledger.js';
import { guardrailFor } from './engine/tiers.js';

export const GROUP_BUY_STAGES = [
  { id: 'funding', label: 'Funding Pool Initiated', blurb: 'Members are contributing.' },
  { id: 'target_met', label: 'Target Achieved', blurb: 'The pool covers the order.' },
  { id: 'escrow', label: 'Merchant Escrow Locked', blurb: 'Funds held for the merchant.' },
  { id: 'dispatched', label: 'Bulk Order Dispatched', blurb: 'The order has left the merchant.' },
  { id: 'delivered', label: 'Individual Delivery', blurb: 'Every member has their share.' }
];

const STAGE_IDS = GROUP_BUY_STAGES.map((s) => s.id);

// The only legal forward moves. TARGET_MET also happens automatically when a
// contribution covers the target — the engine notices; nobody has to click it.
const STAGE_TRANSITIONS = {
  funding: ['target_met'],
  target_met: ['escrow'],
  escrow: ['dispatched'],
  dispatched: ['delivered'],
  delivered: []
};

export const PAYMENT_SOURCES = ['mpesa', 'cash', 'bank', 'other'];

const nowIso = () => new Date().toISOString();

export function stageIndex(stageId) {
  return Math.max(0, STAGE_IDS.indexOf(stageId));
}

export function createGroupBuy({ ownerId, title, targetAmount, note = null }, { maxActive = null } = {}) {
  if (!ownerId) throw new Error('ownerId is required');
  if (!title || !String(title).trim()) throw new Error('a group buy needs a title');
  const target = Math.trunc(Number(targetAmount));
  if (!Number.isSafeInteger(target) || target <= 0) throw new Error('target must be a positive whole number of shillings');

  // Tier guardrail: active buys are capped per tier, enforced right here.
  const active = store.filter('groupBuys', (b) => b.ownerId === ownerId && b.status !== 'closed');
  if (maxActive != null && active.length >= maxActive) {
    const err = new Error(`your tier allows ${maxActive} active group buy${maxActive === 1 ? '' : 's'}`);
    err.code = 'tier_limit';
    throw err;
  }

  const now = nowIso();
  const buy = store.insert('groupBuys', {
    id: newId('gbuy'),
    ownerId,
    title: String(title).trim(),
    note: note ? String(note).trim() : null,
    targetAmount: target,
    stage: 'funding',
    status: 'active',
    history: [{ stage: 'funding', at: now, note: 'created' }],
    createdAt: now,
    updatedAt: now
  });
  emitSignal({
    type: 'group_buy_created',
    actorId: ownerId,
    value: target,
    metadata: { groupBuyId: buy.id, title: buy.title }
  });
  return buy;
}

export function listGroupBuys({ ownerId } = {}) {
  let rows = store.all('groupBuys');
  if (ownerId) rows = rows.filter((b) => b.ownerId === ownerId);
  return rows
    .filter((b) => b.status !== 'closed')
    .slice()
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .map((b) => viewOf(b));
}

export function getGroupBuy(id) {
  const b = store.find('groupBuys', (x) => x.id === id);
  return b ? viewOf(b) : null;
}

function totalFor(buyId) {
  return store
    .filter('groupBuyContributions', (c) => c.groupBuyId === buyId)
    .reduce((sum, c) => sum + c.amount, 0);
}

function viewOf(b) {
  const total = totalFor(b.id);
  const contributions = store
    .filter('groupBuyContributions', (c) => c.groupBuyId === b.id)
    .slice()
    .sort((a, b2) => String(b2.createdAt).localeCompare(String(a.createdAt)));
  return {
    ...b,
    stages: GROUP_BUY_STAGES,
    stageIndex: stageIndex(b.stage),
    total,
    remaining: Math.max(0, b.targetAmount - total),
    progressPct: b.targetAmount > 0 ? Math.min(100, Math.round((total / b.targetAmount) * 100)) : 0,
    contributionCount: contributions.length,
    contributions: contributions.slice(0, 20)
  };
}

/**
 * The receipt digest: SHA-256 over the canonical receipt fields. Anyone can
 * recompute it from the stored rows — that is what makes it a ledger receipt
 * rather than a decoration.
 */
export function receiptHash(contribution) {
  const canonical = [
    contribution.groupBuyId,
    contribution.id,
    contribution.memberRef,
    contribution.amount,
    contribution.source,
    contribution.createdAt
  ].join('|');
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 24);
}

/**
 * The 3-field contribution intake: who, how much, from where.
 * Records the contribution, writes the ledger money-record, emits the signal
 * the router fans out, and returns the structured receipt.
 */
export function contribute({ groupBuyId, memberRef, amount, source = 'mpesa' }) {
  const buy = store.find('groupBuys', (b) => b.id === groupBuyId);
  if (!buy || buy.status === 'closed') throw new Error('group buy not found');
  if (!memberRef || !String(memberRef).trim()) throw new Error('member reference is required');
  if (!PAYMENT_SOURCES.includes(source)) {
    throw new Error(`payment source must be one of ${PAYMENT_SOURCES.join(', ')}`);
  }
  const value = Math.trunc(Number(amount));
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('amount must be a positive whole number of shillings');
  }

  const now = nowIso();
  const contribution = {
    id: newId('gbc'),
    groupBuyId: buy.id,
    memberRef: String(memberRef).trim().slice(0, 80),
    amount: value,
    source,
    createdAt: now
  };
  contribution.receiptHash = receiptHash(contribution);
  store.insert('groupBuyContributions', contribution);

  // The money RECORD rides the one ledger — a contribution is recorded, not
  // settled; no payment provider is connected and the row says so by status.
  createTransaction({
    amount: value,
    currency: 'KES',
    type: 'group_buy_contribution',
    description: `${buy.title}: ${contribution.memberRef}`,
    counterparty: contribution.memberRef,
    metadata: {
      direction: 'inflow',
      groupBuyId: buy.id,
      contributionId: contribution.id,
      receiptHash: contribution.receiptHash,
      source
    }
  });

  emitSignal({
    type: 'group_buy_contribution',
    actorId: buy.ownerId,
    value,
    metadata: {
      groupBuyId: buy.id,
      title: buy.title,
      memberRef: contribution.memberRef,
      source,
      receiptHash: contribution.receiptHash
    }
  });

  // The engine notices the target the moment it is covered — no manual click.
  const total = totalFor(buy.id);
  let stageChanged = false;
  if (buy.stage === 'funding' && total >= buy.targetAmount) {
    stageChanged = true;
    applyStage(buy, 'target_met', 'target covered by contributions');
  }

  return {
    receipt: {
      contributionId: contribution.id,
      memberRef: contribution.memberRef,
      amount: value,
      source,
      receiptHash: contribution.receiptHash,
      createdAt: now
    },
    total,
    progressPct: Math.min(100, Math.round((total / buy.targetAmount) * 100)),
    stageChanged
  };
}

/** Drive an explicit stage change (owner/organiser act). */
export function advanceStage({ groupBuyId, to, actorId = null }) {
  const buy = store.find('groupBuys', (b) => b.id === groupBuyId);
  if (!buy || buy.status === 'closed') throw new Error('group buy not found');
  if (!STAGE_IDS.includes(to)) throw new Error(`stage must be one of ${STAGE_IDS.join(', ')}`);
  const allowed = STAGE_TRANSITIONS[buy.stage] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`cannot move from ${buy.stage} to ${to}`);
  }
  const updated = applyStage(buy, to, `advanced by ${actorId ?? 'organiser'}`);
  return viewOf(updated);
}

function applyStage(buy, to, note) {
  const now = nowIso();
  const updated = store.update('groupBuys', buy.id, {
    stage: to,
    history: [...(buy.history ?? []), { stage: to, at: now, note }],
    updatedAt: now
  });
  emitSignal({
    type: 'group_buy_stage',
    actorId: buy.ownerId,
    metadata: { groupBuyId: buy.id, title: buy.title, stage: to }
  });
  return updated;
}
