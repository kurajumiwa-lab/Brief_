// ---------------------------------------------------------------------------
// CIRCLE SERVICE
//
// A Circle is a durable group container. It is deliberately a thin layer over
// the existing store: a Circle may be derived from an ingested Source (so the
// provenance chain is preserved) or created directly by a user as a TARGET.
//
// This does NOT replace the relationship graph. Circles reference objects via
// Blocks, and Blocks carry the objectId, so the existing graph stays canonical.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';

export const CIRCLE_TYPES = ['gathering', 'build', 'study', 'treasury', 'match', 'target'];
export const CIRCLE_STATUS = ['forming', 'active', 'completed', 'dormant'];

// Source type -> the Circle shape that best fits it.
const TYPE_FROM_SOURCE = {
  telegram_group: 'gathering',
  telegram_channel: 'gathering',
  whatsapp_group: 'gathering',
  whatsapp_channel: 'gathering',
  webpage: 'build',
  website: 'build',
  rss: 'study',
  manual: 'treasury',
  api: 'match',
  business: 'build',
  event_feed: 'study'
};

export function listCircles() {
  return store.all('circles').map(withCounts);
}

function withCounts(circle) {
  const blocks = store.filter('blocks', (b) => b.circleId === circle.id);
  const members = store.filter('members', (m) => m.circleId === circle.id);

  // TARGET PROGRESS IS DERIVED, NEVER STORED.
  //
  // currentValue is computed from transactions that have actually reached
  // 'settled' and are linked to this circle. There is deliberately no way to
  // write it: a caller cannot PATCH progress upward, and the UI cannot
  // manufacture a moving progress bar. If no money has settled, progress is 0.
  const contributions = store.filter(
    'ledgerTransactions',
    (t) => t.circleId === circle.id && t.status === 'settled'
  );
  const currentValue = contributions.reduce((sum, t) => sum + t.amount, 0);
  const contributorCount = new Set(
    contributions.map((t) => t.counterparty).filter(Boolean)
  ).size;

  const progressPct =
    circle.targetValue && circle.targetValue > 0
      ? Math.min(100, (currentValue / circle.targetValue) * 100)
      : null;

  return {
    ...circle,
    currentValue,
    contributorCount,
    progressPct,
    settledCount: contributions.length,
    blockCount: blocks.length,
    memberCount: members.length
  };
}

export function getCircle(id) {
  const circle = store.find('circles', (c) => c.id === id);
  return circle ? withCounts(circle) : null;
}

/**
 * Derive a Circle from an already-connected Source. Idempotent: calling twice
 * for the same source returns the same Circle rather than a duplicate.
 */
export function findOrCreateCircleFromSource(sourceId, overrides = {}) {
  const source = store.find('sources', (s) => s.id === sourceId);
  if (!source) throw new Error('source not found');

  const existing = store.find('circles', (c) => c.sourceId === sourceId);
  if (existing) return withCounts(existing);

  const now = new Date().toISOString();
  const circle = {
    id: newId('circ'),
    name: overrides.name || source.name || source.id,
    description: overrides.description || source.description || '',
    type: overrides.type || TYPE_FROM_SOURCE[source.type] || 'gathering',
    status: 'active',
    // A Circle is only "open" if the underlying source is genuinely public.
    // Anything else stays invite-only so Brief never implies open access.
    visibility: source.accessType === 'public' ? 'open' : 'invite_only',
    sourceId: source.id,
    goal: null,
    targetValue: null,
    deadline: null,
    completionCriteria: null,
    parentCircleId: overrides.parentCircleId || null,
    createdAt: now,
    updatedAt: now
  };
  store.insert('circles', circle);
  return withCounts(circle);
}

/**
 * A TARGET circle is user-created and carries measurable progress.
 * targetValue is required so progress is real arithmetic, never a guess.
 */
export function createTargetCircle({
  name,
  description = '',
  goal = null,
  targetValue = null,
  deadline = null,
  completionCriteria = null
}) {
  if (!name) throw new Error('name is required');
  if (targetValue !== null && !(Number.isFinite(targetValue) && targetValue > 0)) {
    throw new Error('targetValue must be a positive number when provided');
  }
  const now = new Date().toISOString();
  const circle = {
    id: newId('circ'),
    name,
    description,
    type: 'target',
    status: 'forming',
    visibility: 'invite_only',
    sourceId: null,
    goal,
    targetValue,
    deadline,
    completionCriteria,
    parentCircleId: null,
    createdAt: now,
    updatedAt: now
  };
  store.insert('circles', circle);
  return withCounts(circle);
}

export function updateCircle(id, patch) {
  // 'currentValue' is intentionally ABSENT: progress is derived from settled
  // transactions in withCounts(). Allowing it here would let the client fake
  // a target moving forward.
  const allowed = [
    'name', 'description', 'status', 'visibility', 'goal',
    'targetValue', 'deadline', 'completionCriteria'
  ];
  const clean = {};
  for (const k of allowed) if (k in patch) clean[k] = patch[k];
  if ('status' in clean && !CIRCLE_STATUS.includes(clean.status)) {
    throw new Error(`status must be one of ${CIRCLE_STATUS.join(', ')}`);
  }
  const updated = store.update('circles', id, clean);
  return updated ? withCounts(updated) : null;
}
