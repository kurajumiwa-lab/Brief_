// ---------------------------------------------------------------------------
// SEARCH — one cross-entity search over the content Brief actually holds.
//
// The spec asks that search find Tea articles, places, events, opportunities,
// vendors and collections without building a second search system. This is a
// single, honest scan: case-insensitive substring over the real rows, typed by
// entity, with each hit carrying enough to render and navigate.
//
// Object results are ranked by the same discovery intelligence as the feed
// (freshness, lifecycle, locality, confidence, source diversity) and
// near-duplicate stories are collapsed, so search and feed agree on what is
// most relevant. Filtering uses fields that already exist on the rows:
//
//   type      — one of the content types (event, business, offer, alert, ...)
//   location  — a named locality matched against county/area/landmark/venue
//   date      — a canonical day (YYYY-MM-DD) matched against event/deadline dates
//   source    — a source id or source name matched against provenance rows
// ---------------------------------------------------------------------------

import { store } from '../store.js';
import * as media from './media.js';
import * as discovery from './discovery.js';
import * as publicFeed from './publicFeed.js';
import * as entities from './entities.js';

/** True when any extracted field contains the (already-lowercased) needle. */
function matchOn(needle, ...extractors) {
  return (row) => extractors.some((f) => String(f(row) ?? '').toLowerCase().includes(needle));
}

const SEARCHABLE_TYPES = [
  'event', 'business', 'offer', 'alert', 'announcement', 'news',
  'experience', 'place', 'opportunity', 'service', 'product', 'knowledge'
];

/** A canonical day match: event day, deadline day or full-datetime day. */
function matchesDate(object, day) {
  const meta = object?.metadata ?? {};
  for (const k of ['dateCanonical', 'deadlineCanonical']) {
    if (meta[k] === day) return true;
  }
  for (const k of ['eventStart', 'eventEnd']) {
    if (typeof meta[k] === 'string' && meta[k].startsWith(day)) return true;
  }
  return false;
}

/** Provenance filter: source id or a case-insensitive source name. */
function matchesSource(object, needle) {
  const n = String(needle).trim().toLowerCase();
  if (!n) return false;
  return discovery.sourcesOf(object).some((s) =>
    s.id.toLowerCase() === n || String(s.name).toLowerCase().includes(n)
  );
}

function matchFilters(object, filters) {
  if (!filters) return true;
  if (filters.type) {
    const t = String(filters.type).trim().toLowerCase();
    if (t !== 'all' && SEARCHABLE_TYPES.includes(t) && object.type !== t) return false;
  }
  if (filters.location) {
    const q = String(filters.location).trim();
    if (!q) return true;
    if (discovery.areaMatchScore(object, q) <= 0) return false;
  }
  if (filters.date) {
    const day = String(filters.date).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !matchesDate(object, day)) return false;
  }
  if (filters.source) {
    if (!matchesSource(object, filters.source)) return false;
  }
  return true;
}

/**
 * Cross-entity search. `q` is optional when filters are given (browse mode).
 * Objects: ranked by discovery intelligence, collapsed across sources,
 * public-only. Returns an array shaped for the existing results UI.
 */
export function search(q, filters = {}) {
  const needle = String(q ?? '').trim().toLowerCase();
  const now = new Date();

  // Backwards-compatible contract: an empty query with no filters returns
  // nothing. Filters turn the same call into a browse of one dimension.
  const hasFilters = Boolean(filters?.type || filters?.location || filters?.date || filters?.source);
  if (!needle && !hasFilters) {
    return {
      query: q ?? '',
      filters: { type: null, location: null, date: null, source: null },
      counts: { objects: 0, tea: 0, vendors: 0, collections: 0, entities: 0 },
      objects: [], tea: [], vendors: [], collections: [],
      entities: [], entityTotal: 0, entityMatch: null
    };
  }

  const queryMatch = matchOn(
    needle,
    (x) => x.title, (x) => x.summary, (x) => x.locationName, (x) => x.category,
    (x) => x.metadata?.area, (x) => x.metadata?.county,
    // Graph-aware fields: a venue/business/organizer search must surface the
    // objects CONNECTED to it (events there, offers from it, things it hosts).
    (x) => x.metadata?.venue, (x) => x.metadata?.organizer,
    (x) => x.metadata?.hostedBy, (x) => x.metadata?.businessName
  );
  let objects = store.filter('objects', (o) => o.publication === 'public')
    .filter((o) => !needle || queryMatch(o))
    .filter((o) => matchFilters(o, filters))
    .filter((o) => !discovery.isStale(o, now));

  objects = objects
    .map((o) => ({ ...o, score: discovery.rankObject(o, { now, area: filters.location }) }))
    .sort((a, b) => (b.score - a.score) || a.id.localeCompare(b.id))
    .slice(0, 60);

  // Collapse near-duplicates: one result per story, provenance union kept.
  const clusters = discovery.collapseDuplicates(objects);
  const collapsed = clusters.map((cluster) => {
    const rep = cluster.representative;
    if (cluster.members.length <= 1) {
      return { ...rep, clusterSize: 1 };
    }
    const memberSources = new Map();
    for (const m of cluster.members) {
      for (const s of discovery.sourcesOf(m)) if (!memberSources.has(s.id)) memberSources.set(s.id, s);
    }
    const all = [...memberSources.values()];
    return {
      ...rep,
      clusterSize: cluster.members.length,
      sourceNames: all.map((s) => s.name).slice(0, 3),
      sourceCount: all.length,
      sourcePlatforms: [...new Set(all.map((s) => s.platform).filter(Boolean))].slice(0, 3)
    };
  });

  const ranked = collapsed.slice(0, 20).map((o) => ({
    ...o,
    temporal: discovery.temporalFields(o, now),
    sourceNames: Array.isArray(o.sourceNames) ? o.sourceNames : discovery.sourcesOf(o).map((s) => s.name).slice(0, 3),
    sourceCount: o.sourceCount ?? discovery.sourcesOf(o).length
  }));

  const enriched = media.enrichObjects(ranked);

  // Search is an ANONYMOUS endpoint, so results cross the same public
  // projection as the feed: only safe discovery fields leave the server
  // (internal metadata such as contact numbers, extraction evidence and
  // coordinates never serialize).
  const projected = enriched.map(publicFeed.publicObject).filter(Boolean);

  const tea = store.filter('teaArticles', (a) => a.status === 'published')
    .filter((a) => !needle || matchOn(needle, (x) => x.title, (x) => x.dek, (x) => x.body)(a))
    .slice(0, 10)
    .map((a) => ({ id: a.id, slug: a.slug, title: a.title, dek: a.dek, category: a.category, readingTime: a.readingTime }));

  const vendors = store.filter('vendors', (v) => v.status !== 'inactive')
    .filter((v) => !needle || matchOn(needle, (x) => x.displayName, (x) => x.description)(v))
    .slice(0, 10)
    .map((v) => ({ id: v.id, name: v.displayName, description: v.description }));

  const collections = store.filter('collections', (c) => c.status === 'published')
    .filter((c) => !needle || matchOn(needle, (x) => x.title, (x) => x.description)(c))
    .slice(0, 10)
    .map((c) => ({ id: c.id, key: c.key, title: c.title, description: c.description }));

  // Entity search EXTENDS object search: followable entities (venues,
  // businesses, publishers, organizers, communities) whose name matches the
  // query, ranked by match strength then live content. Object results stay
  // first-class — entities are an additional surface, never a replacement.
  const entityHits = entities.searchEntities(q, 4);
  const entityIds = new Set(entityHits.entities.map((e) => e.id));

  return {
    query: q ?? '',
    filters: {
      type: filters.type ?? null,
      location: filters.location ?? null,
      date: filters.date ?? null,
      source: filters.source ?? null
    },
    counts: {
      objects: projected.length,
      tea: tea.length,
      vendors: vendors.length,
      collections: collections.length,
      entities: entityHits.count
    },
    objects: projected, tea, vendors, collections,
    entities: entityHits.entities,
    entityTotal: entityHits.count,
    // Convenience for the client: when the query names exactly one entity,
    // the caller may jump straight to its page.
    entityMatch: entityIds.size === 1 ? [...entityIds][0] : null
  };
}
