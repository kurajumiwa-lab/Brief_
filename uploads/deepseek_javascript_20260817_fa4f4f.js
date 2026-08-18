// ---------------------------------------------------------------------------
// TRANSACTION STATE MACHINE (extended)
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';

export const TRANSACTION_STATUS = {
  CREATED: 'created',
  AUTHORIZED: 'authorized',
  PAYMENT_PENDING: 'payment_pending',
  PAYMENT_CONFIRMED: 'payment_confirmed',
  HELD: 'held',
  FULFILLED: 'fulfilled',
  SPLIT: 'split',
  SETTLEMENT_PENDING: 'settlement_pending',
  DISBURSEMENT_PENDING: 'disbursement_pending',
  SETTLED: 'settled',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  DISPUTED: 'disputed',
  RESOLVED: 'resolved',
  REVERSED: 'reversed',
  RECOVERY_REQUIRED: 'recovery_required'
};

const VALID_TRANSITIONS = {
  created: ['authorized', 'failed'],
  authorized: ['payment_pending', 'failed', 'recovery_required'],
  payment_pending: ['payment_confirmed', 'failed', 'recovery_required'],
  payment_confirmed: ['held', 'refunded', 'recovery_required'],
  held: ['fulfilled', 'refunded', 'disputed', 'recovery_required'],
  fulfilled: ['split', 'disputed', 'recovery_required'],
  split: ['settlement_pending', 'disputed', 'recovery_required'],
  settlement_pending: ['disbursement_pending', 'disputed', 'recovery_required'],
  disbursement_pending: ['settled', 'disputed', 'recovery_required'],
  settled: ['reversed', 'recovery_required'],
  failed: [],
  refunded: [],
  disputed: ['resolved', 'recovery_required'],
  resolved: ['settled', 'refunded'],
  reversed: [],
  recovery_required: ['resolved']
};

export function createTransactionRecord({ idempotencyKey, amount, currency = 'KES', type, source, metadata = {} }) {
  const tx = {
    id: newId('txn'),
    idempotencyKey,
    status: 'created',
    amount,
    currency,
    type,
    source,
    metadata,
    history: [{ status: 'created', at: new Date().toISOString() }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.insert('transactions', tx);
  return tx;
}

export function transitionTransaction(txId, newStatus, note = '') {
  const tx = store.find('transactions', t => t.id === txId);
  if (!tx) throw new Error(`Transaction ${txId} not found`);
  const allowed = VALID_TRANSITIONS[tx.status];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new Error(`Invalid transition: ${tx.status} → ${newStatus}`);
  }
  tx.status = newStatus;
  tx.updatedAt = new Date().toISOString();
  tx.history.push({ status: newStatus, at: new Date().toISOString(), note });
  store.update('transactions', txId, tx);
  return tx;
}

export function getTransaction(txId) {
  return store.find('transactions', t => t.id === txId);
}