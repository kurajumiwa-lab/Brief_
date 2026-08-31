// ---------------------------------------------------------------------------
// PERSONAL COLLECTIONS — user-owned named groups of object references.
//
// Saves already exist as `saves` rows (Personal Brief): a frictionless
// bookmark with no structure. Collections EXTEND that layer instead of
// duplicating it — quick save still writes a `saves` row ("Saved"), and a
// collection only ever holds REFERENCES to existing Brief objects. The
// objects themselves are never copied, moved or deletable from here.
//
// Hard rules:
//   * ownership is enforced on every mutation (ownerId check)
//   * collections are private by default; private collections never resolve
//     publicly (a public read of a private id is a 404, not a 403 — the id
//     itself must not be guessable/confirmable)
//   * public pages project ONLY public objects (publicFeed.publicObject) —
//     an object that later becomes private/removed silently drops out of the
//     rendering without exposing private information
//   * expired/stale items still render with their REAL temporal status
//     (Ended/Expired/Closed) — a collection never pretends saved content is
//     still active
//   * covers are derived from real item images; nothing is fabricated
//   * search inside collections is scoped to the owner (never global)
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import * as discovery from './discovery.js';
import * as publicFeed from './publicFeed.js';

export const COLLECTION_VISIBILITIES = ['private', 'public'];
export const COLLECTION_NAME_MAX = 80;
export const COLLECTION_DESC_MAX = 500;

const nameOf = (value) => String(value ?? '').trim().slice(0, COLLECTION_NAME_MAX);
const descOf = (value) => String(value ?? '').trim().slice(0, COLLECTION_DESC_MAX);

function own(userId, id) {
  const c = store.find('personalCollections', (x) => x.id === id && x.ownerId === userId);
  return c ?? null;
}

function touch(id) {
  // store.update stamps updatedAt and persists.
  return store.update('personalCollections', id, {});
}

/** Items of one collection, ordered by position then insertion. */
function itemRows(collectionId) {
  return store.filter('personalCollectionItems', (r) => r.collectionId === collectionId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.addedAt).localeCompare(String(b.addedAt)));
}

/**
 * Resolve membership against the LIVE object store. Only rows that still
 * exist AND are public resolve — a deleted or privatised object never leaks,
 * it simply stops rendering. Expired objects stay (with their real temporal
 * status) so the collection stays understandable.
 */
export function resolveItems(collectionId, now = new Date()) {
  const out = [];
  for (const row of itemRows(collectionId)) {
    const raw = store.find('objects', (o) => o.id === row.objectId);
    if (!raw) continue; // deleted object — never leak, never render
    const projected = publicFeed.publicObject({ ...raw, temporal: discovery.temporalFields(raw, now) });
    if (!projected) continue; // not public — invisible everywhere
    out.push({ id: raw.id, addedAt: row.addedAt, position: row.position ?? 0, object: projected });
  }
  return out;
}

/** Smart cover: custom image wins, then the best item images. Never invents. */
export function coverOf(collection, items) {
  if (collection?.coverImage && typeof collection.coverImage === 'string' && collection.coverImage.trim()) {
    return { kind: 'custom', url: collection.coverImage };
  }
  const urls = items
    .map((it) => it.object?.media?.url)
    .filter((u) => typeof u === 'string' && u.trim())
    .slice(0, 4);
  if (urls.length === 1) return { kind: 'single', url: urls[0] };
  if (urls.length > 1) return { kind: 'mosaic', urls };
  return { kind: 'none' };
}

/** Location context from the items' OWN fields (area/county) — never derived. */
export function locationsOf(items) {
  const areas = new Set();
  const counties = new Set();
  for (const it of items) {
    const meta = it.object?.metadata ?? {};
    if (typeof meta.area === 'string' && meta.area.trim()) areas.add(meta.area.trim());
    if (typeof meta.county === 'string' && meta.county.trim()) counties.add(meta.county.trim());
    if (typeof it.object?.locationName === 'string' && it.object.locationName.trim()) {
      areas.add(it.object.locationName.trim());
    }
  }
  return { areas: [...areas].slice(0, 8), counties: [...counties].slice(0, 6) };
}

/** The owner's collection rows with live counts + derived cover. */
export function listCollections(userId, { q = '' } = {}) {
  const needle = String(q ?? '').trim().toLowerCase();
  const now = new Date();
  const collections = store.filter('personalCollections', (c) => c.ownerId === userId);
  const out = [];
  for (const c of collections) {
    const items = resolveItems(c.id, now);
    const itemTitles = items.map((it) => it.object?.title ?? '');
    if (needle) {
      const nameHit = c.name.toLowerCase().includes(needle);
      const itemHit = itemTitles.some((t) => t.toLowerCase().includes(needle));
      if (!nameHit && !itemHit) continue;
    }
    out.push({
      id: c.id,
      name: c.name,
      description: c.description,
      visibility: c.visibility,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      count: items.length,
      cover: coverOf(c, items),
      locations: locationsOf(items)
    });
  }
  out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return out;
}

/** Create a collection. Private by default. */
export function createCollection(userId, { name = '', description = '', coverImage = null, visibility = 'private' } = {}) {
  const clean = nameOf(name);
  if (!clean) throw new Error('collection name is required');
  if (!COLLECTION_VISIBILITIES.includes(visibility)) throw new Error('invalid visibility');
  const dup = store.find('personalCollections', (c) => c.ownerId === userId && c.name.toLowerCase() === clean.toLowerCase());
  if (dup) throw new Error('you already have a collection with this name');
  return store.insert('personalCollections', {
    id: newId('pcol'),
    ownerId: userId,
    name: clean,
    description: descOf(description),
    coverImage: coverImage && typeof coverImage === 'string' ? coverImage.trim().slice(0, 500) || null : null,
    visibility,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

/** Owner-only rename / description / cover / visibility update. */
export function updateCollection(userId, id, patch = {}) {
  const c = own(userId, id);
  if (!c) return null;
  if ('name' in patch) {
    const clean = nameOf(patch.name);
    if (!clean) throw new Error('collection name is required');
    const dup = store.find('personalCollections', (x) => x.ownerId === userId && x.id !== id && x.name.toLowerCase() === clean.toLowerCase());
    if (dup) throw new Error('you already have a collection with this name');
    c.name = clean;
  }
  if ('description' in patch) c.description = descOf(patch.description);
  if ('coverImage' in patch) {
    c.coverImage = patch.coverImage && typeof patch.coverImage === 'string' ? patch.coverImage.trim().slice(0, 500) || null : null;
  }
  if ('visibility' in patch) {
    if (!COLLECTION_VISIBILITIES.includes(patch.visibility)) throw new Error('invalid visibility');
    c.visibility = patch.visibility;
  }
  touch(c.id);
  return c;
}

/** Owner-only delete; membership rows go with it. The objects stay. */
export function deleteCollection(userId, id) {
  const c = own(userId, id);
  if (!c) return false;
  store.remove('personalCollections', id);
  for (const row of itemRows(id)) store.remove('personalCollectionItems', row.id);
  return true;
}

/**
 * Add an object reference. Idempotent (never duplicates). The object must
 * exist and be public — a private object can never be referenced from a
 * collection that might later be shared.
 */
export function addObject(userId, collectionId, objectId) {
  const c = own(userId, collectionId);
  if (!c) return { ok: false, reason: 'not_found' };
  const raw = store.find('objects', (o) => o.id === objectId);
  if (!raw) return { ok: false, reason: 'not_found' };
  if (raw.publication !== 'public') return { ok: false, reason: 'object_not_public' };
  const existing = store.find('personalCollectionItems', (r) => r.collectionId === collectionId && r.objectId === objectId);
  if (existing) return { ok: true, added: false, collection: c };
  const positions = itemRows(collectionId).map((r) => r.position ?? 0);
  store.insert('personalCollectionItems', {
    id: newId('pci'),
    collectionId,
    objectId,
    position: positions.length ? Math.max(...positions) + 1 : 0,
    addedAt: new Date().toISOString()
  });
  touch(collectionId);
  return { ok: true, added: true, collection: c };
}

/** Owner-only remove. Deleting a non-member is a no-op. */
export function removeObject(userId, collectionId, objectId) {
  const c = own(userId, collectionId);
  if (!c) return false;
  const rows = store.filter('personalCollectionItems', (r) => r.collectionId === collectionId && r.objectId === objectId);
  for (const row of rows) store.remove('personalCollectionItems', row.id);
  if (rows.length) touch(collectionId);
  return rows.length > 0;
}

/** Owner-only reorder: the given object ids define the new order. */
export function reorderCollection(userId, collectionId, orderedObjectIds = []) {
  const c = own(userId, collectionId);
  if (!c) return false;
  const rows = itemRows(collectionId);
  const byObject = new Map(rows.map((r) => [r.objectId, r]));
  const seen = new Set();
  let position = 0;
  for (const objectId of orderedObjectIds) {
    const row = byObject.get(objectId);
    if (!row || seen.has(objectId)) continue;
    row.position = position++;
    seen.add(objectId);
  }
  // Members not named in the order keep their relative order after the named ones.
  for (const row of rows) {
    if (!seen.has(row.objectId)) row.position = position++;
  }
  touch(collectionId);
  return true;
}

/** The full owner view of one collection. */
export function collectionForOwner(userId, id, now = new Date()) {
  const c = own(userId, id);
  if (!c) return null;
  const items = resolveItems(id, now);
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    visibility: c.visibility,
    coverImage: c.coverImage,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    count: items.length,
    cover: coverOf(c, items),
    locations: locationsOf(items),
    items
  };
}

/**
 * The PUBLIC page: shareable, read-only, only public objects. Unknown OR
 * private ids both return null (404) so collection ids can't be probed.
 */
export function collectionPagePublic(id, now = new Date()) {
  const c = store.find('personalCollections', (x) => x.id === id);
  if (!c || c.visibility !== 'public') return null;
  const items = resolveItems(id, now);
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    visibility: c.visibility,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    count: items.length,
    cover: coverOf(c, items),
    locations: locationsOf(items),
    items
  };
}
