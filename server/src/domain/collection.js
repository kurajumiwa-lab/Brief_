// ---------------------------------------------------------------------------
// COLLECTIONS — editorial groupings over real content (home-feed Phase 8, §47)
//
// A collection is a named, data-driven group of things: "This weekend",
// "Under KES 500", "Around Kilimani". It is NOT a hardcoded UI section — the
// membership is RESOLVED from the store at read time by one of two rules:
//
//   'rule'    a filter spec (category / type / price ceiling / location
//             substring) applied to the live object list
//   'curated' an explicit list of object ids an editor chose
//
// Membership is always the current truth: an object that stops matching (or
// expires) leaves the collection on the next read; a new matching object
// joins. Collections are published/unpublished; unpublished ones never
// resolve publicly, exactly like Tea.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import * as media from './media.js';

export const COLLECTION_KINDS = ['rule', 'curated'];

export function slugify(title) {
  return String(title ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export function createCollection({
  title, description = '', kind = 'rule', rule = null, objectIds = [],
  location = null, status = 'draft', featured = false
}) {
  if (!title || !String(title).trim()) throw new Error('title is required');
  if (!COLLECTION_KINDS.includes(kind)) throw new Error('invalid kind');
  if (kind === 'rule' && (!rule || typeof rule !== 'object')) throw new Error('a rule collection requires a rule');
  if (kind === 'curated' && !Array.isArray(objectIds)) throw new Error('a curated collection requires objectIds');

  const key = slugify(title);
  if (store.find('collections', (c) => c.key === key)) throw new Error('a collection with this title already exists');

  return store.insert('collections', {
    id: newId('col'),
    key,
    title: String(title).trim(),
    description,
    kind,
    rule: kind === 'rule' ? rule : null,
    objectIds: kind === 'curated' ? objectIds : [],
    location,
    status,
    featured,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export function getCollection(keyOrId) {
  return store.find('collections', (c) => c.key === keyOrId || c.id === keyOrId) ?? null;
}

/** Does an object match a rule collection's filter spec? */
function matchesRule(rule, object) {
  if (!rule) return false;
  if (rule.type && object.type !== rule.type) return false;
  if (rule.category && object.category !== rule.category) return false;
  const price = object.metadata?.price;
  if (rule.maxPrice !== undefined) {
    if (typeof price !== 'number' || price > rule.maxPrice) return false;
  }
  if (rule.minPrice !== undefined) {
    if (typeof price !== 'number' || price < rule.minPrice) return false;
  }
  if (rule.locationContains) {
    const hay = (object.locationName ?? '').toLowerCase();
    if (!hay.includes(String(rule.locationContains).toLowerCase())) return false;
  }
  return true;
}

/** Resolve a published collection to its current, honest membership. */
export function resolveCollection(keyOrId, opts = {}) {
  const c = getCollection(keyOrId);
  if (!c || c.status !== 'published') return null;

  const objects = store.filter('objects', (o) => o.publication === 'public');
  let members;
  if (c.kind === 'curated') {
    const wanted = new Set(c.objectIds);
    members = objects.filter((o) => wanted.has(o.id));
  } else {
    members = objects.filter((o) => matchesRule(c.rule, o));
  }

  const enriched = media.enrichObjects(members);
  const limit = opts.limit ?? 20;
  return {
    ...c,
    objectCount: members.length,
    objects: enriched.slice(0, limit)
  };
}

/** All published collections (metadata only — no members). */
export function listPublished() {
  return store.filter('collections', (c) => c.status === 'published')
    .slice()
    .sort((a, b) => Number(b.featured ?? false) - Number(a.featured ?? false) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function listAll() {
  return store.all('collections').slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function transitionCollection(keyOrId, action) {
  const c = getCollection(keyOrId);
  if (!c) throw new Error('collection not found');
  const map = { publish: { from: ['draft'], to: 'published' }, unpublish: { from: ['published'], to: 'draft' }, archive: { from: ['published', 'draft'], to: 'archived' } };
  const m = map[action];
  if (!m) throw new Error(`unknown action: ${action}`);
  if (!m.from.includes(c.status)) throw new Error(`cannot ${action} from ${c.status}`);
  return store.update('collections', c.id, { status: m.to, updatedAt: new Date().toISOString() });
}
