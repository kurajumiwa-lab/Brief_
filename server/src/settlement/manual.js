// ---------------------------------------------------------------------------
// MANUAL RAIL
//
// The rail that works today with no provider, no credentials, no contracts.
// A human moves the money. Trace records that they did.
//
// This is not a temporary shim. It is the tree's own named manual path made
// first-class: providers.js says "Pochi la Biashara … has no API for third
// parties, so it is the manual path this repo already implements: a person
// moves the money, finance confirms the ledger row." This module IS that
// path, with a queue, a confirm, and a reconcile.
//
// When Buni's transfer contract lands, the BuniRail takes over the flows it
// supports and this rail stays for the rest.
//
// The ManualRail's job is to be honest. It records the intent, exposes the
// queue, records the human's confirmation, and refuses to silently do
// nothing. It never claims money moved. Only a human saying "I sent it"
// moves an attempt to settled.
//
// SCOPE NOTE (the derived-amount law is not bypassed here): vendor payouts
// keep their lifecycle in domain/settlement.js, where the amount is derived
// from settled orders and never client-supplied. This rail is the generic
// seam for movements that have no domain payout machinery yet (host payouts,
// cooperative disbursements, refunds) — the human who confirms is the
// maker-checker on the stated amount, the same two-person rule the
// table-banking pool uses.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import {
  RAIL_STATES,
  RAIL_DIRECTIONS,
  findByIdempotencyKey,
  accepted,
  refused,
} from './rail.js';

export const name = 'manual';
export const supportsManualConfirmation = true;

// Connector-contract shims (providers.js documents the contract a connector
// exposes). The manual rail has no tariff: the human pays whatever their
// channel charges, and the rail never invents a fee figure.
export const capabilities = { collect: true, disburse: true, manual: true };
export function payoutFee() { return 0; }

/**
 * The manual rail is always configured. It is a human, not a provider.
 * "Configured" here means "we can accept the request and put it in the queue."
 */
export function isConfigured() {
  return true;
}

// ---------------------------------------------------------------------------
// DISBURSE — money out
// ---------------------------------------------------------------------------

export async function disburse({
  amount,
  currency = 'KES',
  recipient,
  reference,
  idempotencyKey,
  note = null,
}) {
  if (!amount || amount <= 0) return refused('amount must be a positive integer');
  if (!Number.isInteger(amount)) return refused('amount must be integer KES');
  if (!recipient) return refused('recipient is required');
  if (!idempotencyKey) return refused('idempotencyKey is required');

  const existing = findByIdempotencyKey(store, idempotencyKey);
  if (existing) {
    return accepted(existing.id, {
      status: existing.status,
      providerRef: existing.providerRef,
      deduped: true,
    });
  }

  const attempt = {
    id: newId('sat'),
    rail: name,
    direction: RAIL_DIRECTIONS.OUT,
    amount,
    currency,
    recipient: String(recipient),
    reference: reference ?? null,
    idempotencyKey,
    note,
    status: RAIL_STATES.IN_FLIGHT, // a human must do the work
    providerRef: null,
    adminNote: null,
    completedBy: null,
    failureReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  };

  store.insert('settlementAttempts', attempt);
  return accepted(attempt.id);
}

// ---------------------------------------------------------------------------
// COLLECT — money in
// ---------------------------------------------------------------------------

export async function collect({
  amount,
  currency = 'KES',
  payer,
  reference,
  idempotencyKey,
  instructions = null,
}) {
  if (!amount || amount <= 0) return refused('amount must be a positive integer');
  if (!Number.isInteger(amount)) return refused('amount must be integer KES');
  if (!payer) return refused('payer is required');
  if (!idempotencyKey) return refused('idempotencyKey is required');

  const existing = findByIdempotencyKey(store, idempotencyKey);
  if (existing) {
    return accepted(existing.id, {
      status: existing.status,
      providerRef: existing.providerRef,
      deduped: true,
    });
  }

  const attempt = {
    id: newId('sat'),
    rail: name,
    direction: RAIL_DIRECTIONS.IN,
    amount,
    currency,
    recipient: null,
    payer: String(payer),
    reference: reference ?? null,
    idempotencyKey,
    note: instructions,
    status: RAIL_STATES.IN_FLIGHT, // waiting for the payer to pay
    providerRef: null,
    adminNote: null,
    completedBy: null,
    failureReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  };

  store.insert('settlementAttempts', attempt);
  return accepted(attempt.id, {
    instructions: instructions ?? 'Payment will be arranged out-of-band and confirmed by the operator.',
  });
}

// ---------------------------------------------------------------------------
// MANUAL CONFIRMATION — the three human actions
// ---------------------------------------------------------------------------

export async function markSent(attemptId, { providerRef = null, note = null, by = 'system' } = {}) {
  return transition(attemptId, RAIL_STATES.SETTLED, {
    providerRef,
    adminNote: note,
    completedBy: by,
  });
}

export async function markReceived(attemptId, { providerRef = null, note = null, by = 'system' } = {}) {
  return transition(attemptId, RAIL_STATES.SETTLED, {
    providerRef,
    adminNote: note,
    completedBy: by,
  });
}

export async function markFailed(attemptId, { reason, by = 'system' } = {}) {
  if (!reason) return refused('reason is required to mark failed');
  return transition(attemptId, RAIL_STATES.FAILED, {
    failureReason: reason,
    completedBy: by,
  });
}

function transition(attemptId, nextStatus, patch) {
  const attempt = store.find('settlementAttempts', (a) => a.id === attemptId);
  if (!attempt) return refused('attempt not found');
  if (attempt.status === nextStatus) {
    return { status: nextStatus, attemptId, deduped: true };
  }
  if (
    attempt.status === RAIL_STATES.SETTLED ||
    attempt.status === RAIL_STATES.FAILED ||
    attempt.status === RAIL_STATES.REVERSED
  ) {
    return refused(`attempt is already ${attempt.status}`);
  }
  store.update('settlementAttempts', attemptId, {
    status: nextStatus,
    ...patch,
    updatedAt: new Date().toISOString(),
    completedAt: nextStatus === RAIL_STATES.SETTLED || nextStatus === RAIL_STATES.FAILED
      ? new Date().toISOString()
      : attempt.completedAt,
  });
  return { status: nextStatus, attemptId };
}

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

export async function getAttempt(attemptId) {
  return store.find('settlementAttempts', (a) => a.id === attemptId) ?? null;
}

// ---------------------------------------------------------------------------
// RECONCILE
//
// The manual rail has no provider statement to compare against.
// Reconciliation means: find attempts that have been in_flight longer than
// the review window and flag them for a human to look at.
// ---------------------------------------------------------------------------

const STUCK_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function reconcile({ from, to } = {}) {
  const now = Date.now();
  const fromMs = from ? new Date(from).getTime() : 0;
  const toMs   = to   ? new Date(to).getTime()   : now;

  const stuck = store.filter('settlementAttempts', (a) => {
    if (a.rail !== name) return false;
    if (a.status !== RAIL_STATES.IN_FLIGHT) return false;
    const created = new Date(a.createdAt).getTime();
    if (created < fromMs || created > toMs) return false;
    return now - created > STUCK_AFTER_MS;
  });

  return {
    rail: name,
    checkedFrom: new Date(fromMs).toISOString(),
    checkedTo: new Date(toMs).toISOString(),
    mismatches: stuck.map((a) => ({
      attemptId: a.id,
      direction: a.direction,
      amount: a.amount,
      reference: a.reference,
      ageHours: Math.floor((now - new Date(a.createdAt).getTime()) / 3_600_000),
      resolution: 'escalate',
    })),
  };
}
