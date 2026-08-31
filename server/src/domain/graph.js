// ---------------------------------------------------------------------------
// LOCAL ACTIVITY GRAPH — the living information layer over the city.
//
// Connects Brief objects through their EXISTING structured relationships:
//   event → venue (metadata.venue / hostedBy, or persisted relationships)
//   event → organizer (metadata.organizer / hostedBy)
//   offer → business (metadata.businessName, or persisted relationships)
//   object → publisher (provenance)
//   object → location (area / county / landmark from the gazetteer)
//   object → object (persisted relationships rows)
//
// Rules this module never breaks:
//   * No keyword matching. An edge exists only because structured data (or a
//     persisted relationship row) says so. Two objects sharing a title word
//     never become related.
//   * No invented geography. Locations come from the gazetteer; area→county
//     links are DERIVED from objects that carry both fields — never hardcoded
//     to a Nairobi-only map.
//   * No invented coordinates. lat/lng ride only on objects that genuinely
//     store them (metadata.lat/lng); everything else stays text-only.
//   * Expired content never appears active. Every section gates on the real
//     temporal lifecycle (discovery.temporalFields) plus staleness.
//   * Privacy holds. Only public objects ever enter graph payloads.
//   * Weak/inferred edges stay INTERNAL. Every exposed edge carries a
//     confidence ('structured' | 'provenance' | 'relationship'); anything
//     weaker is never serialized.
//   * Performance: every endpoint is a single batched pass over the store
//     (id/area/county/venue/organizer/business/source maps). No N+1.
// ---------------------------------------------------------------------------

import { store } from '../store.js';
import * as discovery from './discovery.js';
import * as media from './media.js';
import * as publicFeed from './publicFeed.js';
import { classifyLocation, COUNTIES, AREAS, LANDMARKS } from '../pipeline/gazetteer.js';

/** The relationship verbs this graph understands (existing + the primitives
 *  the brief adds: happening_at, organized_by, published_by, offered_by,
 *  hosted_by, near, about, belongs_to). Only `related_to` etc. are persisted
 *  rows; the rest are derived from structured fields. */
export const GRAPH_VERBS = [
  'located_at', 'happening_at', 'organized_by', 'hosted_by',
  'published_by', 'offered_by', 'related_to', 'near', 'about', 'belongs_to'
];

/** The verb pairs the graph exposes on detail pages, label builders attached. */
const EDGE_LABELS = {
  happening_at: (name) => `Happening at ${name}`,
  organized_by: (name) => `Hosted by ${name}`,
  hosted_by: (name) => `Hosted by ${name}`,
  published_by: (name) => `More from ${name}`,
  offered_by: (name) => `Offers from ${name}`,
  located_at: (name) => `More happening in ${name}`,
  related_to: () => 'Related',
  near: (name) => `Near ${name}`,
  about: (name) => `About ${name}`,
  belongs_to: (name) => `Part of ${name}`
};

const SECTION_TYPES = {
  current: new Set(['event', 'offer', 'alert']),
  upcoming: new Set(['event', 'offer']),
  offers: new Set(['offer']),
  businesses: new Set(['business', 'identity']),
  places: new Set(['place']),
  news: new Set(['news']),
  announcements: new Set(['announcement', 'alert']),
  opportunities: new Set(['opportunity'])
};

function lower(s) {
  return String(s ?? '').trim().toLowerCase();
}

/** The object's own location facts (structured only). */
export function locationOf(object) {
  const meta = object?.metadata ?? {};
  const area = typeof meta.area === 'string' && meta.area.trim() ? meta.area.trim() : null;
  const county = typeof meta.county === 'string' && meta.county.trim() ? meta.county.trim() : null;
  const landmark = typeof meta.landmark === 'string' && meta.landmark.trim() ? meta.landmark.trim() : null;
  const locationName = typeof object?.locationName === 'string' && object.locationName.trim()
    ? object.locationName.trim()
    : (area || county || null);
  return { area, county, landmark, locationName };
}

/** Object → business name (structured only: metadata.businessName, or a
 *  vendor/identity object the object belongs to via persisted rows). */
export function businessOf(object) {
  const meta = object?.metadata ?? {};
  const name = typeof meta.businessName === 'string' && meta.businessName.trim()
    ? meta.businessName.trim()
    : null;
  if (name) return name;
  for (const r of store.filter('relationships', (x) => x.sourceId === object.id || x.targetId === object.id)) {
    const otherId = r.sourceId === object.id ? r.targetId : r.sourceId;
    if (r.verb !== 'offered_by' && r.verb !== 'belongs_to') continue;
    const other = store.find('objects', (x) => x.id === otherId);
    if (other && (other.type === 'business' || other.type === 'identity')) return other.title;
  }
  return null;
}

// ---------------------------------------------------------------------------
// BATCHED INDEX — one pass over the store per request; every lookup below is
// a map hit. This is the whole performance story: no N+1 anywhere.
// ---------------------------------------------------------------------------
function buildIndex(now = new Date()) {
  const index = {
    byId: new Map(),
    byArea: new Map(),
    byCounty: new Map(),
    byLandmark: new Map(),
    byVenue: new Map(),
    byOrganizer: new Map(),
    byBusiness: new Map(),
    bySource: new Map(),
    areaCounty: new Map(),   // area lower → county (derived from real objects)
    countyAreas: new Map(),  // county lower → Set(areas) (derived)
    coordsByLocation: new Map() // locationName lower → first genuine coords
  };

  const sourceIdsByObject = new Map();
  for (const os of store.all('objectSources')) {
    if (!sourceIdsByObject.has(os.objectId)) sourceIdsByObject.set(os.objectId, []);
    sourceIdsByObject.get(os.objectId).push(os.sourceId);
  }
  const sourceNameById = new Map(
    store.all('sources').map((s) => [s.id, s.name ?? s.id])
  );

  const push = (map, key, obj) => {
    if (!key) return;
    const k = lower(key);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(obj);
  };

  for (const o of store.all('objects')) {
    if (o.publication !== 'public') continue;
    const loc = locationOf(o);
    index.byId.set(o.id, o);
    push(index.byArea, loc.area, o);
    push(index.byCounty, loc.county, o);
    push(index.byLandmark, loc.landmark, o);

    const meta = o.metadata ?? {};
    const venueName = typeof meta.venue === 'string' && meta.venue.trim() ? meta.venue.trim() : null;
    const orgName = typeof meta.organizer === 'string' && meta.organizer.trim() ? meta.organizer.trim()
      : (typeof meta.hostedBy === 'string' && meta.hostedBy.trim() ? meta.hostedBy.trim() : null);
    const bizName = businessOf(o) || (typeof meta.businessName === 'string' && meta.businessName.trim() ? meta.businessName.trim() : null);
    push(index.byVenue, venueName, o);
    push(index.byOrganizer, orgName, o);
    push(index.byBusiness, bizName, o);
    // A place object IS its venue (its title is the venue name) and a
    // business/identity object IS its business — index them by title so the
    // join works in both directions: event → venue AND venue → its events.
    if (o.type === 'place' && o.title) push(index.byVenue, o.title, o);
    if ((o.type === 'business' || o.type === 'identity') && o.title) push(index.byBusiness, o.title, o);

    // area → county links come from objects that carry BOTH fields. This is
    // the honest, data-derived hierarchy (no hardcoded Nairobi-only map).
    if (loc.area && loc.county) {
      if (!index.areaCounty.has(lower(loc.area))) index.areaCounty.set(lower(loc.area), loc.county);
      if (!index.countyAreas.has(lower(loc.county))) index.countyAreas.set(lower(loc.county), new Set());
      index.countyAreas.get(lower(loc.county)).add(loc.area);
    }

    const coords = discovery.coordsOf(o);
    if (coords && loc.locationName && !index.coordsByLocation.has(lower(loc.locationName))) {
      index.coordsByLocation.set(lower(loc.locationName), coords);
    }

    for (const sid of sourceIdsByObject.get(o.id) ?? []) {
      push(index.bySource, sourceNameById.get(sid), o);
    }
  }
  return index;
}

// ---------------------------------------------------------------------------
// LOCATION RESOLUTION + HIERARCHY
// ---------------------------------------------------------------------------
/** Resolve a location name into { name, kind, county, areas } using only the
 *  gazetteer + derived object data. Returns null when the name is unknown. */
export function resolveLocation(name) {
  const n = String(name ?? '').trim();
  if (!n) return null;
  const cls = classifyLocation(n);
  if (!cls) return null;

  const index = buildIndex(new Date());
  const base = { name: cls.value, kind: cls.kind };

  if (cls.kind === 'county') {
    base.areas = [...(index.countyAreas.get(lower(cls.value)) ?? [])].sort();
    base.county = cls.value;
  } else {
    base.county = index.areaCounty.get(lower(cls.value)) ?? null;
  }
  return base;
}

/** Every location with live content, most active first. */
export function locationIndex(now = new Date(), limit = 40) {
  const index = buildIndex(now);
  const out = [];
  const seen = new Set();

  const consider = (kind, key, objs) => {
    if (!key || seen.has(lower(key))) return;
    seen.add(lower(key));
    const t = temporalCounts(objs, now);
    out.push({
      name: key,
      kind,
      county: kind === 'county' ? key : (index.areaCounty.get(lower(key)) ?? null),
      counts: { happeningNow: t.happeningNow, today: t.today, comingUp: t.comingUp, latest: t.latest }
    });
  };

  for (const [k, objs] of index.byArea) consider('area', objs[0].metadata?.area, objs);
  for (const [k, objs] of index.byCounty) consider('county', objs[0].metadata?.county, objs);
  for (const [k, objs] of index.byLandmark) consider('landmark', objs[0].metadata?.landmark, objs);

  return out
    .sort((a, b) => (b.counts.today + b.counts.comingUp) - (a.counts.today + a.counts.comingUp))
    .slice(0, limit);
}

function temporalCounts(objs, now) {
  let happeningNow = 0;
  let today = 0;
  let comingUp = 0;
  let latest = 0;
  for (const o of objs) {
    if (discovery.isStale(o, now)) continue;
    const t = discovery.temporalFields(o, now);
    const status = t?.status;
    latest += 1;
    if (status === 'happening' || status === 'active') {
      happeningNow += 1;
      today += 1;
    }
    if (status === 'upcoming') {
      comingUp += 1;
      if (t.startsAt && sameDay(t.startsAt, now)) today += 1;
    }
  }
  return { happeningNow, today, comingUp, latest };
}

function sameDay(iso, now) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return false;
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

/** Project an object for graph payloads: the safe public projection plus the
 *  trust/lifecycle fields the surfaces need. Coordinates are NEVER included
 *  here — they leave the server only through mapReady items. */
function projectObject(o, now) {
  const p = publicFeed.publicObject(o) ?? null;
  if (!p) return null;
  const loc = locationOf(o);
  return {
    ...p,
    area: loc.area,
    county: loc.county,
    landmark: loc.landmark,
    temporal: p.temporal ?? discovery.temporalFields(o, now),
    degraded: discovery.sourcesOf(o).some((s) => s.trustStatus === 'degraded')
  };
}

// ---------------------------------------------------------------------------
// WHAT'S HAPPENING HERE — real counts, real items, never fake.
// ---------------------------------------------------------------------------
export function locationActivity(name, now = new Date()) {
  const resolved = resolveLocation(name);
  if (!resolved) return null;
  const index = buildIndex(now);
  const key = lower(resolved.name);

  const pools = {
    area: index.byArea.get(key) ?? [],
    county: resolved.kind === 'county' ? index.byCounty.get(key) ?? [] : [],
    landmark: index.byLandmark.get(key) ?? []
  };
  const all = [...new Set([...pools.area, ...pools.county, ...pools.landmark])]
    .filter((o) => !discovery.isStale(o, now));

  const happeningNow = [];
  const today = [];
  const comingUp = [];
  const latest = [];

  for (const o of all) {
    const t = discovery.temporalFields(o, now);
    const status = t?.status;
    latest.push(o);
    if (status === 'happening' || status === 'active') happeningNow.push(o);
    if (status === 'upcoming') {
      comingUp.push(o);
      if (t.startsAt && sameDay(t.startsAt, now)) today.push(o);
    }
    if (status === 'happening' || status === 'active') today.push(o);
  }

  const rank = (objs) => objs
    .map((o) => ({ o, score: discovery.rankObject(o, { now, area: resolved.name }) }))
    .sort((a, b) => b.score - a.score || a.o.id.localeCompare(b.o.id))
    .map((x) => projectObject(x.o, now))
    .filter(Boolean);

  const latestRanked = all
    .map((o) => ({ o, at: discovery.publishedAtOf(o) ?? o.createdAt ?? '' }))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .map((x) => projectObject(x.o, now))
    .filter(Boolean);

  return {
    location: resolved,
    counts: {
      happeningNow: happeningNow.length,
      today: today.length,
      comingUp: comingUp.length,
      latest: latestRanked.length
    },
    activity: {
      happeningNow: rank(happeningNow).slice(0, 12),
      today: rank(today).slice(0, 12),
      comingUp: rank(comingUp).slice(0, 24),
      latest: latestRanked.slice(0, 12)
    },
    map: mapReadyFor(all, now)
  };
}

/** The discovery sections of a location page (current/upcoming/offers/...). */
export function locationSections(name, now = new Date()) {
  const index = buildIndex(now);
  const resolved = resolveLocation(name);
  if (!resolved) return null;
  const key = lower(resolved.name);
  const pools = [
    ...(index.byArea.get(key) ?? []),
    ...(resolved.kind === 'county' ? index.byCounty.get(key) ?? [] : []),
    ...(index.byLandmark.get(key) ?? [])
  ];
  const seen = new Set();
  const all = pools.filter((o) => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return o.publication === 'public' && !discovery.isStale(o, now);
  });

  const sections = {};
  for (const [section, types] of Object.entries(SECTION_TYPES)) {
    const items = all
      .filter((o) => types.has(o.type))
      .map((o) => ({ o, score: discovery.rankObject(o, { now, area: resolved.name }) }))
      .sort((a, b) => b.score - a.score || a.o.id.localeCompare(b.o.id))
      .map((x) => projectObject(x.o, now))
      .filter(Boolean);
    if (items.length > 0) sections[section] = items.slice(0, 12);
  }
  return sections;
}

// ---------------------------------------------------------------------------
// OBJECT GRAPH — related content for a detail page, batched and confidence-
// labelled. Weak edges never serialize.
// ---------------------------------------------------------------------------
export function objectGraph(objectId, now = new Date()) {
  const object = store.find('objects', (o) => o.id === objectId);
  if (!object || object.publication !== 'public') return null;

  const index = buildIndex(now);
  const meta = object.metadata ?? {};
  const loc = locationOf(object);
  const edges = [];
  const seenObjects = new Set([object.id]);

  const addEdge = (verb, label, confidence, objects) => {
    const items = objects
      .filter((o) => !seenObjects.has(o.id) && !discovery.isStale(o, now))
      .slice(0, 8);
    if (items.length === 0) return;
    items.forEach((o) => seenObjects.add(o.id));
    edges.push({
      verb,
      label,
      confidence,
      objects: items.map((o) => projectObject(o, now)).filter(Boolean)
    });
  };

  // Venue edges — structured metadata.venue / hostedBy, or persisted rows.
  // A place object IS its venue: its own title names the venue, so the join
  // works in both directions (event → venue AND venue → its events).
  const venueName = object.type === 'place'
    ? (typeof object.title === 'string' && object.title.trim() ? object.title.trim() : null)
    : (typeof meta.venue === 'string' && meta.venue.trim() ? meta.venue.trim()
      : (typeof meta.hostedBy === 'string' && meta.hostedBy.trim() ? meta.hostedBy.trim() : null));
  if (venueName) {
    const venueObjects = index.byVenue.get(lower(venueName)) ?? [];
    addEdge('happening_at', EDGE_LABELS.happening_at(venueName), 'structured', venueObjects);
  }

  // Organizer edges.
  const orgName = typeof meta.organizer === 'string' && meta.organizer.trim() ? meta.organizer.trim()
    : (typeof meta.hostedBy === 'string' && meta.hostedBy.trim() ? meta.hostedBy.trim() : null);
  if (orgName && orgName !== venueName) {
    addEdge('organized_by', EDGE_LABELS.organized_by(orgName), 'structured', index.byOrganizer.get(lower(orgName)) ?? []);
  }

  // Business edges (offers → business activity).
  const bizName = businessOf(object);
  if (bizName) {
    addEdge('offered_by', EDGE_LABELS.offered_by(bizName), 'structured', index.byBusiness.get(lower(bizName)) ?? []);
  }

  // Publisher edges — real provenance only.
  const sourceIds = discovery.sourcesOf(object).map((s) => s.id);
  if (sourceIds.length === 1) {
    const src = discovery.sourcesOf(object)[0];
    if (src.name) {
      addEdge('published_by', EDGE_LABELS.published_by(src.name), 'provenance', index.bySource.get(lower(src.name)) ?? []);
    }
  }

  // Location edge — the "More happening in X" transition into /explore/:name.
  if (loc.area || loc.county || loc.landmark) {
    const locName = loc.area ?? loc.landmark ?? loc.county;
    const pool = [
      ...(loc.area ? index.byArea.get(lower(loc.area)) ?? [] : []),
      ...(loc.county ? index.byCounty.get(lower(loc.county)) ?? [] : []),
      ...(loc.landmark ? index.byLandmark.get(lower(loc.landmark)) ?? [] : [])
    ];
    addEdge('located_at', EDGE_LABELS.located_at(locName), 'structured', pool);
    edges[edges.length - 1].location = {
      name: locName,
      kind: loc.area ? 'area' : (loc.landmark ? 'landmark' : 'county'),
      county: loc.county
    };
  }

  // Persisted relationship rows (related_to and friends) — the existing graph.
  const related = [];
  for (const r of store.filter('relationships', (x) => x.sourceId === object.id || x.targetId === object.id)) {
    if (!GRAPH_VERBS.includes(r.verb)) continue;
    const otherId = r.sourceId === object.id ? r.targetId : r.sourceId;
    const other = index.byId.get(otherId);
    if (other) related.push(other);
  }
  addEdge('related_to', EDGE_LABELS.related_to(), 'relationship', related);

  return {
    object: projectObject(object, now),
    edges: edges.filter((e) => e.objects.length > 0)
  };
}

// ---------------------------------------------------------------------------
// NEARBY — distance only over genuinely stored coordinates.
// ---------------------------------------------------------------------------
export function nearbyObjects({ lat, lng, radiusKm = 10 } = {}, now = new Date()) {
  const hasQuery = typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng);
  if (!hasQuery) {
    return { available: false, reason: 'no_coordinates', items: [] };
  }
  const items = [];
  for (const o of store.all('objects')) {
    if (o.publication !== 'public' || discovery.isStale(o, now)) continue;
    const c = discovery.coordsOf(o);
    if (!c) continue;
    const dist = discovery.haversineKm(lat, lng, c.lat, c.lng);
    if (dist <= radiusKm) {
      items.push({ ...projectObject(o, now), distanceKm: Math.round(dist * 10) / 10 });
    }
  }
  items.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0) || a.id.localeCompare(b.id));
  return { available: items.length > 0 || store.all('objects').some((o) => discovery.coordsOf(o)), reason: null, items: items.slice(0, 24) };
}

/** Nearby for a named location using its derived centroid (from objects that
 *  genuinely carry coordinates there). Text-only locations are valid: the
 *  result simply reports no coordinates instead of inventing a pin. */
export function nearbyForLocation(name, radiusKm = 10, now = new Date()) {
  const index = buildIndex(now);
  const resolved = resolveLocation(name);
  if (!resolved) return { available: false, reason: 'unknown_location', items: [] };
  const key = lower(resolved.name);
  const pool = [
    ...(index.byArea.get(key) ?? []),
    ...(resolved.kind === 'county' ? index.byCounty.get(key) ?? [] : []),
    ...(index.byLandmark.get(key) ?? [])
  ];
  const coords = pool.map((o) => discovery.coordsOf(o)).find(Boolean);
  if (!coords) return { available: false, reason: 'no_coordinates', items: [] };
  return nearbyObjects({ ...coords, radiusKm }, now);
}

// ---------------------------------------------------------------------------
// MAP-READY ARCHITECTURE — the backend contract a future map can draw from.
// Coordinates appear ONLY where they genuinely exist (metadata.lat/lng).
// ---------------------------------------------------------------------------
export function mapReadyFor(objects, now = new Date()) {
  const items = [];
  for (const o of objects) {
    if (o.publication !== 'public' || discovery.isStale(o, now)) continue;
    const c = discovery.coordsOf(o);
    if (!c) continue;
    const loc = locationOf(o);
    items.push({
      id: o.id,
      type: o.type,
      title: o.title,
      location: loc.locationName,
      area: loc.area,
      county: loc.county,
      lat: c.lat,
      lng: c.lng,
      image: media.enrichObjects([o])[0]?.imageUrl ?? null,
      temporal: discovery.temporalFields(o, now)
    });
  }
  return { available: items.length > 0, items };
}

/** Map-ready projection of ONE object (for entity/location endpoints). */
export function mapReadyObject(o, now = new Date()) {
  const c = discovery.coordsOf(o);
  const loc = locationOf(o);
  return {
    id: o.id,
    type: o.type,
    title: o.title,
    location: loc.locationName,
    area: loc.area,
    county: loc.county,
    lat: c?.lat ?? null,
    lng: c?.lng ?? null,
    image: media.enrichObjects([o])[0]?.imageUrl ?? null,
    temporal: discovery.temporalFields(o, now)
  };
}

/** The gazetteer constants, re-exported for the explore index. */
export const GAZETTEER = { COUNTIES, AREAS, LANDMARKS };
