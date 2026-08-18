// ---------------------------------------------------------------------------
// SIGNAL SERVICE
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';

export const SIGNAL_TYPES = {
  MOOD_CHECKIN: 'mood_checkin',
  BADGE_EARNED: 'badge_earned',
  BLOCK_ADDED: 'block_added',
  ARRIVED: 'arrived',
  MEMBER_JOINED: 'member_joined',
  TRANSACTION_CREATED: 'transaction_created',
  TRANSACTION_SETTLED: 'transaction_settled',
  PAYMENT_FAILED: 'payment_failed',
  DISBURSEMENT_REQUESTED: 'disbursement_requested',
  DISBURSEMENT_FAILED: 'disbursement_failed',
  DISBURSEMENT_SETTLED: 'disbursement_settled',
  FULFILMENT_CONFIRMED: 'fulfilment_confirmed',
  QUEST_COMPLETED: 'quest_completed'
};

export function emitSignal({ userId, circleId, blockId, type, value, metadata = {} }) {
  const signal = {
    id: newId('sig'),
    userId,
    circleId,
    blockId,
    type,
    value,
    metadata,
    timestamp: new Date().toISOString()
  };
  store.insert('signals', signal);
  return signal;
}

export function getSignalsByUser(userId, limit = 20) {
  return store
    .filter('signals', s => s.userId === userId)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, limit);
}

export function getSignalsByCircle(circleId, limit = 20) {
  return store
    .filter('signals', s => s.circleId === circleId)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, limit);
}