// ---------------------------------------------------------------------------
// BLOCK SERVICE
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';

export const BLOCK_TYPES = {
  NOTE: 'note',
  PIN: 'pin',
  IMAGE: 'image',
  VOICE: 'voice',
  TASK: 'task',
  VOTE: 'vote',
  LISTING: 'listing'
};

const TYPE_MAP = {
  'event': BLOCK_TYPES.LISTING,
  'product': BLOCK_TYPES.LISTING,
  'service': BLOCK_TYPES.LISTING,
  'opportunity': BLOCK_TYPES.TASK,
  'knowledge': BLOCK_TYPES.NOTE,
  'place': BLOCK_TYPES.PIN,
  'identity': BLOCK_TYPES.PIN,
  'experience': BLOCK_TYPES.LISTING
};

export function createBlockFromObject(objectId, circleId, overrides = {}) {
  const obj = store.find('objects', o => o.id === objectId);
  if (!obj) throw new Error('Object not found');

  let block = store.find('blocks', b => b.objectId === objectId);
  if (block) return block;

  block = {
    id: newId('blk'),
    circleId,
    objectId: obj.id,
    type: overrides.type || TYPE_MAP[obj.type] || BLOCK_TYPES.NOTE,
    content: overrides.content || obj.title || obj.summary || '',
    weight: overrides.weight || 0,
    validated_by: overrides.validated_by || null,
    created_at: obj.createdAt || new Date().toISOString(),
    metadata: overrides.metadata || obj.metadata || {}
  };
  store.insert('blocks', block);
  return block;
}

export function createBlock({ circleId, type, content, weight = 0, validated_by = null, metadata = {} }) {
  const block = {
    id: newId('blk'),
    circleId,
    objectId: null,
    type,
    content,
    weight,
    validated_by,
    created_at: new Date().toISOString(),
    metadata
  };
  store.insert('blocks', block);
  return block;
}

export function getBlock(id) {
  return store.find('blocks', b => b.id === id);
}

export function getBlocksByCircle(circleId) {
  return store.filter('blocks', b => b.circleId === circleId);
}