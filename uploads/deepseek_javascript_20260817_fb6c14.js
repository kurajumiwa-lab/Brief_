// ---------------------------------------------------------------------------
// CIRCLE SERVICE
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';

export const CIRCLE_TYPES = {
  GATHERING: 'gathering',
  BUILD: 'build',
  STUDY: 'study',
  TREASURY: 'treasury',
  MATCH: 'match',
  TARGET: 'target'
};

export const CIRCLE_STATUS = {
  FORMING: 'forming',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  DORMANT: 'dormant'
};

export function findOrCreateCircleFromSource(sourceId, overrides = {}) {
  const source = store.find('sources', s => s.id === sourceId);
  if (!source) throw new Error('Source not found');

  let circle = store.find('circles', c => c.sourceId === sourceId);
  if (circle) return circle;

  const typeMap = {
    'telegram_group': CIRCLE_TYPES.GATHERING,
    'telegram_channel': CIRCLE_TYPES.GATHERING,
    'whatsapp_group': CIRCLE_TYPES.GATHERING,
    'webpage': CIRCLE_TYPES.BUILD,
    'rss': CIRCLE_TYPES.STUDY,
    'manual': CIRCLE_TYPES.TREASURY,
    'api': CIRCLE_TYPES.MATCH
  };

  circle = {
    id: newId('circ'),
    name: source.name || source.id,
    description: source.description || '',
    type: overrides.type || typeMap[source.type] || CIRCLE_TYPES.GATHERING,
    status: CIRCLE_STATUS.ACTIVE,
    visibility: source.accessType === 'public' ? 'open' : 'invite-only',
    anchor_coordinator_id: overrides.anchor_coordinator_id || null,
    location: overrides.location || null,
    sourceId: source.id,
    goal: overrides.goal || null,
    deadline: overrides.deadline || null,
    completion_criteria: overrides.completion_criteria || null,
    parent_circle_id: overrides.parent_circle_id || null,
    created_at: new Date().toISOString(),
    activates_at: overrides.activates_at || null,
    metadata: overrides.metadata || {}
  };
  store.insert('circles', circle);
  return circle;
}

export function createTargetCircle({ name, description, goal, deadline, completion_criteria, anchor_coordinator_id }) {
  const circle = {
    id: newId('circ'),
    name,
    description: description || '',
    type: CIRCLE_TYPES.TARGET,
    status: CIRCLE_STATUS.FORMING,
    visibility: 'invite-only',
    anchor_coordinator_id,
    location: null,
    sourceId: null,
    goal,
    deadline,
    completion_criteria,
    parent_circle_id: null,
    created_at: new Date().toISOString(),
    activates_at: null,
    metadata: {}
  };
  store.insert('circles', circle);
  return circle;
}

export function getCircle(id) {
  return store.find('circles', c => c.id === id);
}

export function updateCircle(id, patch) {
  const circle = store.find('circles', c => c.id === id);
  if (!circle) return null;
  Object.assign(circle, patch, { updated_at: new Date().toISOString() });
  store.update('circles', id, circle);
  return circle;
}