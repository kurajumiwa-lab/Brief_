// ---------------------------------------------------------------------------
// COOPERATIVE POOLS — Chama / Stokvel / Esusu / Sou-Sou (four-screen build A)
//
// The rotating-savings-and-credit (ROSCA) primitive that the whole coalition
// blueprint assumes. One pool = N members, a fixed contribution per cycle, and
// a rotating recipient each cycle. This is the market-standard pattern across
// Kenya (chama), Nigeria (esusu), South Africa (stokvel) and the Black US
// diaspora (sou-sou) — identical arithmetic, different names.
//
// HONESTY (unchanged rules):
//   * a contribution is a REAL ledger transaction (type 'pool_contribution');
//     its status stays 'created' until money actually settles externally — the
//     ledger records money that moved elsewhere, it does not invent a balance
//   * the current balance is DERIVED from contributions, never a stored number
//   * the rotation is a derived schedule over the member order; the recipient
//     is computed, never fabricated
//   * a rotation payout is a disbursement — it reports "no provider" exactly
//     like every other payout until a real rail is connected
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { createTransaction, transitionTransaction, listTransactions } from './ledger.js';

export const REGION_TYPES = ['US_METRO', 'KENYA', 'NIGERIA', 'SOUTH_AFRICA', 'OTHER'];
export const POOL_STATUS = ['forming', 'active', 'completed'];

export function createPool({ name, regionType = 'KENYA', currency = 'KES', contributionAmount, createdBy, displayName = null }) {
  if (!name || !String(name).trim()) throw new Error('name is required');
  if (!REGION_TYPES.includes(regionType)) throw new Error(`regionType must be one of ${REGION_TYPES.join(', ')}`);
  if (!Number.isFinite(contributionAmount) || contributionAmount <= 0) throw new Error('contributionAmount must be positive');
  if (!createdBy) throw new Error('a creator is required');

  const now = new Date().toISOString();
  const pool = store.insert('pools', {
    id: newId('pool'),
    name: String(name).trim(),
    regionType,
    currency,
    contributionAmount,
    rotationOrder: [createdBy],
    rotationIndex: 0,
    cycleCount: 0,
    status: 'forming',
    createdBy,
    createdAt: now,
    updatedAt: now
  });
  store.insert('poolMembers', {
    id: newId('pmem'),
    poolId: pool.id,
    userId: createdBy,
    displayName: displayName ?? 'Member',
    joinedAt: now
  });
  return pool;
}

export function addMember(poolId, userId, displayName = null) {
  const pool = store.find('pools', (p) => p.id === poolId);
  if (!pool) throw new Error('pool not found');
  if (pool.status !== 'forming') throw new Error('members are locked once the pool is active');
  if (store.find('poolMembers', (m) => m.poolId === poolId && m.userId === userId)) {
    throw new Error('already a member');
  }
  const now = new Date().toISOString();
  const row = store.insert('poolMembers', { id: newId('pmem'), poolId, userId, displayName: displayName ?? 'Member', joinedAt: now });
  store.update('pools', poolId, { rotationOrder: [...pool.rotationOrder, userId], updatedAt: now });
  return row;
}

/** Forming -> active: the rotation order is locked and the first recipient is member 0. */
export function activate(poolId, actorId) {
  const pool = store.find('pools', (p) => p.id === poolId);
  if (!pool) throw new Error('pool not found');
  if (pool.createdBy !== actorId) throw new Error('only the creator may activate the pool');
  if (pool.status !== 'forming') throw new Error('pool is not in forming state');
  if (pool.rotationOrder.length < 2) throw new Error('a pool needs at least two members');
  return store.update('pools', poolId, { status: 'active', updatedAt: new Date().toISOString() });
}

/**
 * Record a member's contribution for the current cycle. This is a REAL ledger
 * transaction — money the member sent elsewhere — never an invented balance.
 */
export function contribute(poolId, memberId, amount = null) {
  const pool = store.find('pools', (p) => p.id === poolId);
  if (!pool) throw new Error('pool not found');
  if (pool.status !== 'active') throw new Error('pool is not active');
  if (!pool.rotationOrder.includes(memberId)) throw new Error('not a member');
  const amt = amount ?? pool.contributionAmount;
  if (!Number.isFinite(amt) || amt <= 0) throw new Error('amount must be positive');

  // One contribution per member per cycle — idempotent, no double-counting.
  const cycle = pool.cycleCount;
  const dup = store.find('ledgerTransactions', (t) =>
    t.type === 'pool_contribution' && t.metadata?.poolId === poolId && t.metadata?.memberId === memberId && t.metadata?.cycle === cycle);
  if (dup) return { transaction: dup, duplicate: true };

  const tx = createTransaction({
    amount: amt,
    currency: pool.currency,
    type: 'pool_contribution',
    description: `${pool.name} — cycle ${cycle + 1} contribution`,
    counterparty: memberId,
    metadata: { poolId, memberId, cycle }
  });
  return { transaction: tx, duplicate: false };
}

/** Advance the rotation to the next recipient. Completes a cycle after a full lap. */
export function rotate(poolId, actorId) {
  const pool = store.find('pools', (p) => p.id === poolId);
  if (!pool) throw new Error('pool not found');
  if (pool.createdBy !== actorId) throw new Error('only the creator may rotate');
  if (pool.status !== 'active') throw new Error('pool is not active');
  const n = pool.rotationOrder.length;
  const next = (pool.rotationIndex + 1) % n;
  const completedCycle = next === 0;
  const cycleCount = pool.cycleCount + (completedCycle ? 1 : 0);
  const now = new Date().toISOString();
  store.insert('poolRotations', { id: newId('prot'), poolId, cycle: pool.cycleCount, recipientId: pool.rotationOrder[pool.rotationIndex], at: now });
  return store.update('pools', poolId, { rotationIndex: next, cycleCount, updatedAt: now });
}

/** The recipient of the current cycle (derived, never stored). */
export function currentRecipient(pool) {
  if (!pool || pool.status !== 'active') return null;
  return pool.rotationOrder[pool.rotationIndex % pool.rotationOrder.length] ?? null;
}

/** Derived view: balance = sum of this pool's contributions; payout state honest. */
export function poolView(poolId) {
  const pool = store.find('pools', (p) => p.id === poolId);
  if (!pool) return null;
  const txs = store.filter('ledgerTransactions', (t) => t.type === 'pool_contribution' && t.metadata?.poolId === poolId);
  const settled = txs.filter((t) => t.status === 'settled').reduce((s, t) => s + t.amount, 0);
  const pending = txs.filter((t) => t.status !== 'settled' && t.status !== 'failed' && t.status !== 'refunded').reduce((s, t) => s + t.amount, 0);
  const members = pool.rotationOrder.map((userId) => {
    const row = store.find('poolMembers', (m) => m.poolId === poolId && m.userId === userId);
    const contributed = txs.some((t) => t.metadata?.memberId === userId && t.metadata?.cycle === pool.cycleCount);
    return { userId, displayName: row?.displayName ?? 'Member', contributedThisCycle: contributed };
  });
  return {
    ...pool,
    members,
    recipientId: currentRecipient(pool),
    balance: { settled, pending, total: settled + pending },
    contributionCount: txs.length,
    // A rotation payout is a disbursement; honest until a rail exists.
    payoutAvailable: false,
    payoutReason: 'No payout provider is connected. The rotation is recorded; money is settled outside Brief.'
  };
}

export function listPools({ regionType = null } = {}) {
  let rows = store.all('pools');
  if (regionType) rows = rows.filter((p) => p.regionType === regionType);
  return rows.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function listForUser(userId) {
  return store.filter('poolMembers', (m) => m.userId === userId).map((m) => poolView(m.poolId)).filter(Boolean);
}
