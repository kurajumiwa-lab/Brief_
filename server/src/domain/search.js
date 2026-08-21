// ---------------------------------------------------------------------------
// SEARCH — one cross-entity search over the content Brief actually holds.
//
// The spec asks that search find Tea articles, places, events, opportunities,
// vendors and collections without building a second search system. This is a
// single, honest scan: case-insensitive substring over the real rows, typed by
// entity, with each hit carrying enough to render and navigate.
//
// There is no ranking model and no index yet — at this scale a scan is correct
// and predictable. It is deliberately simple; a real inverted index can slot
// in behind this same function later without changing callers.
// ---------------------------------------------------------------------------

import { store } from '../store.js';
import * as media from './media.js';

/** True when any extracted field contains the (already-lowercased) needle. */
function matchOn(needle, ...extractors) {
  return (row) => extractors.some((f) => String(f(row) ?? '').toLowerCase().includes(needle));
}

export function search(q) {
  const needle = String(q ?? '').trim().toLowerCase();
  if (!needle) return { query: '', objects: [], tea: [], vendors: [], collections: [] };

  const objects = media.enrichObjects(
    store.filter('objects', (o) => o.publication === 'public')
      .filter(matchOn(needle, (o) => o.title, (o) => o.summary, (o) => o.locationName, (o) => o.category))
  ).slice(0, 20);

  const tea = store.filter('teaArticles', (a) => a.status === 'published')
    .filter(matchOn(needle, (a) => a.title, (a) => a.dek, (a) => a.body))
    .slice(0, 10)
    .map((a) => ({ id: a.id, slug: a.slug, title: a.title, dek: a.dek, category: a.category, readingTime: a.readingTime }));

  const vendors = store.filter('vendors', (v) => v.status !== 'inactive')
    .filter(matchOn(needle, (v) => v.displayName, (v) => v.description))
    .slice(0, 10)
    .map((v) => ({ id: v.id, name: v.displayName, description: v.description }));

  const collections = store.filter('collections', (c) => c.status === 'published')
    .filter(matchOn(needle, (c) => c.title, (c) => c.description))
    .slice(0, 10)
    .map((c) => ({ id: c.id, key: c.key, title: c.title, description: c.description }));

  return {
    query: q,
    counts: { objects: objects.length, tea: tea.length, vendors: vendors.length, collections: collections.length },
    objects, tea, vendors, collections
  };
}
