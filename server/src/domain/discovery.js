// ---------------------------------------------------------------------------
// DISCOVERY INTELLIGENCE — geo, lifecycle, freshness, locality, confidence,
// source diversity and cross-source presentation
//
// "A user opening Brief should immediately see relevant, trustworthy things."
// This module computes that order from real, existing evidence and nothing
// else:
//
//   GEO       — haversine distance over stored coordinates, or a named-area
//               match (county / area / landmark / venue) when the caller asks
//               for a locality without coordinates. No user location is ever
//               invented: a locality boost exists ONLY when the caller
//               supplies one (lat/lng or an explicit named area).
//
//   LIFECYCLE — a temporal signal for every object, derived strictly from
//               extraction fields that already exist: eventStart/eventEnd,
//               dateCanonical, deadlineCanonical, dayOfWeek, recurrence,
//               validityWindowDays and provenance timestamps. Nothing here
//               invents a date: an event with an unknown date is "undated",
//               never assigned one; a weekday is a weekday, not a calendar
//               date.
//
//   EXPIRY    — an object whose validity window lapsed, or an offer whose
//               explicit deadline passed, is stale. The sweep marks it;
//               ranking demotes it; it is never deleted.
//
//   RANKING   — a derived score over freshness (age + type-aware temporal
//               relevance), locality, confidence (extraction confidence +
//               source confidence + verification/confirmation), and recorded
//               engagement. The score is computed, never stored, so it can
//               never drift from the rows it summarises.
//
//   DIVERSITY — the ranked stream is re-balanced so no single source floods
//               the feed and no single type runs in an unbroken block. The
//               pass is deterministic (no randomness): it swaps for the next
//               best item that satisfies the mix constraints, so the result
//               never looks artificially shuffled.
//
//   CLUSTERS  — cross-source (and same-source) near-duplicates are collapsed
//               at discovery time into ONE visible card carrying the union of
//               its sources. Provenance rows are untouched; only the
//               presentation collapses.
// ---------------------------------------------------------------------------

import { store } from '../store.js';
import * as trust from './trust.js';
import * as sourceTrust from './sourceTrust.js';
import { similarity } from '../pipeline/ingest.js';

// ---------------------------------------------------------------------------
// GEO
// ---------------------------------------------------------------------------

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Read a lat/lng off an object's metadata, or null when unknown. */
export function coordsOf(object) {
  const lat = object?.metadata?.lat ?? object?.lat ?? null;
  const lng = object?.metadata?.lng ?? object?.lng ?? null;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

// ---------------------------------------------------------------------------
// CONTENT TYPES
// ---------------------------------------------------------------------------

/** The content vocabulary the pipeline writes (extract.js + campaigns/seed). */
export const CONTENT_TYPES = new Set([
  'event', 'business', 'offer', 'alert', 'announcement', 'news',
  'experience', 'place', 'opportunity', 'service', 'product', 'knowledge'
]);

/** Dated content: an explicit start/deadline gives it a real lifecycle. */
const DATED_TYPES = new Set(['event', 'experience', 'offer', 'opportunity']);

/** Evergreen content: no temporal relevance of its own, ranked on trust etc. */
const EVERGREEN_TYPES = new Set([
  'place', 'business', 'service', 'product', 'knowledge'
]);

function typeOf(object) {
  const t = object?.type;
  return CONTENT_TYPES.has(t) ? t : null;
}

// ---------------------------------------------------------------------------
// TIMESTAMPS — the temporal signal, built from existing evidence only
// ---------------------------------------------------------------------------

/** First time this story was published anywhere in its provenance. */
export function publishedAtOf(object) {
  if (!object) return null;
  const rows = store.filter('objectSources', (s) => s.objectId === object?.id);
  const stamps = rows
    .map((s) => s.sourcePublishedAt)
    .filter((v) => typeof v === 'string' && Number.isFinite(Date.parse(v)))
    .map((v) => Date.parse(v));
  if (stamps.length) return new Date(Math.min(...stamps)).toISOString();
  return object?.createdAt ?? null;
}

/** Most recent time this story was seen (provenance retrieval, else row update). */
export function lastSeenAtOf(object) {
  if (!object) return null;
  const rows = store.filter('objectSources', (s) => s.objectId === object?.id);
  const stamps = rows
    .map((s) => s.sourceRetrievedAt ?? s.sourcePublishedAt)
    .filter((v) => typeof v === 'string' && Number.isFinite(Date.parse(v)))
    .map((v) => Date.parse(v));
  if (stamps.length) return new Date(Math.max(...stamps)).toISOString();
  return object?.updatedAt ?? object?.createdAt ?? null;
}

function isoAt(value) {
  if (typeof value !== 'string') return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/**
 * Derive the lifecycle of one object from extraction evidence only.
 *
 *   event/experience: startsAt/endsAt from eventStart/eventEnd, else the
 *     canonical day (dateCanonical) as an all-day window; a dayOfWeek or
 *     recurrence WITHOUT a date stays "undated" — never assigned a calendar
 *     date. status: upcoming | happening | past | undated | recurring.
 *   offer:            deadlineAt from deadlineCanonical. status:
 *     active | expired | no_deadline.
 *   opportunity:      deadlineAt from deadlineCanonical; active/past.
 *   everything else:  status "current"; expiresAt from validityWindowDays.
 *
 * `now` defaults to the current time so callers can freeze time in tests.
 */
export function lifecycleOf(object, now = new Date()) {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const meta = object?.metadata ?? {};
  const type = typeOf(object);

  const out = { status: 'current', startsAt: null, endsAt: null, deadlineAt: null, expiresAt: null, dayOfWeek: null, recurring: false };

  if (meta.dayOfWeek) out.dayOfWeek = String(meta.dayOfWeek);
  if (meta.recurrence) out.recurring = true;

  const startIso = isoAt(meta.eventStart) ?? (meta.dateCanonical ? isoAt(`${meta.dateCanonical}T00:00:00`) : null);
  const endIso = isoAt(meta.eventEnd) ?? (meta.dateCanonical ? isoAt(`${meta.dateCanonical}T23:59:59`) : null);
  if (startIso) out.startsAt = startIso;
  if (endIso) out.endsAt = endIso;

  const deadlineIso = meta.deadlineCanonical ? isoAt(`${meta.deadlineCanonical}T23:59:59`) : null;
  if (deadlineIso) out.deadlineAt = deadlineIso;

  const days = object?.validityWindowDays;
  if (Number.isFinite(days) && days > 0 && typeof object?.createdAt === 'string') {
    const created = Date.parse(object.createdAt);
    if (Number.isFinite(created)) out.expiresAt = new Date(created + days * 86400000).toISOString();
  }

  if (type === 'offer') {
    if (!out.deadlineAt) {
      out.status = 'no_deadline';
    } else {
      out.status = Date.parse(out.deadlineAt) >= nowMs ? 'active' : 'expired';
    }
    return out;
  }

  if (type === 'opportunity') {
    if (out.deadlineAt) {
      out.status = Date.parse(out.deadlineAt) >= nowMs ? 'active' : 'past';
    }
    return out;
  }

  if (type === 'event' || type === 'experience') {
    if (out.recurring && !out.startsAt) {
      out.status = 'recurring';
      return out;
    }
    if (!out.startsAt) {
      out.status = 'undated';
      return out;
    }
    const startMs = Date.parse(out.startsAt);
    const endMs = out.endsAt ? Date.parse(out.endsAt) : startMs;
    if (nowMs < startMs) out.status = 'upcoming';
    else if (nowMs <= endMs) out.status = 'happening';
    else out.status = 'past';
    return out;
  }

  return out;
}

// ---------------------------------------------------------------------------
// EXPIRY
// ---------------------------------------------------------------------------

/**
 * Mark stale objects. An object is stale when it carries a validity window in
 * days and that window has lapsed since it was created/last verified. The
 * sweep is opportunistic (runs on read, like the auction expiry) so there is
 * no daemon and no cron dependency.
 */
export function sweepExpired() {
  const nowMs = Date.now();
  let expired = 0;
  for (const o of store.all('objects')) {
    const days = o.validityWindowDays;
    if (!Number.isFinite(days) || days <= 0) continue;
    const created = Date.parse(o.createdAt);
    if (!Number.isFinite(created)) continue;
    if (nowMs - created > days * 86400000 && o.expiryStatus !== 'expired') {
      store.update('objects', o.id, { expiryStatus: 'expired' });
      expired++;
    }
  }
  return { expired };
}

/**
 * Stale means it should fall out of the default feed: the validity window
 * lapsed, or an explicit offer/opportunity deadline passed. Historical rows
 * are never deleted — only demoted/excluded from the live projection.
 */
export function isStale(object, now = new Date()) {
  if (object?.expiryStatus === 'expired') return true;
  const days = object?.validityWindowDays;
  if (Number.isFinite(days) && days > 0) {
    const created = Date.parse(object?.createdAt);
    if (Number.isFinite(created) && Date.now() - created > days * 86400000) return true;
  }
  const life = lifecycleOf(object, now);
  if (life.status === 'expired') return true;
  return false;
}

// ---------------------------------------------------------------------------
// ENGAGEMENT (derived from signals)
// ---------------------------------------------------------------------------

function engagement(objectId) {
  const rows = store.filter('signals', (s) => s.metadata?.objectId === objectId);
  const views = rows.filter((s) => s.type === 'object_viewed').length;
  const saves = rows.filter((s) => s.type === 'object_saved').length;
  const shares = rows.filter((s) => s.type === 'object_shared').length;
  return { views, saves, shares };
}

// ---------------------------------------------------------------------------
// CONFIDENCE (existing evidence fields — never invented)
// ---------------------------------------------------------------------------

/** Mean source confidence across provenance; defaults to the stored 0.5. */
export function sourceConfidenceOf(object) {
  const rows = store.filter('objectSources', (s) => s.objectId === object?.id);
  if (!rows.length) return 0.5;
  const vals = rows.map((s) => Number(s.sourceConfidence)).filter(Number.isFinite);
  if (!vals.length) return 0.5;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Extraction confidence as stored by the pipeline (0..1), else 0.5. */
export function extractionConfidenceOf(object) {
  const c = Number(object?.extractionConfidence);
  return Number.isFinite(c) && c >= 0 && c <= 1 ? c : 0.5;
}

// ---------------------------------------------------------------------------
// LOCALITY
// ---------------------------------------------------------------------------

/** Best named-locality evidence on an object: landmark/venue > area > county. */
export function localityFieldsOf(object) {
  const meta = object?.metadata ?? {};
  return {
    county: typeof meta.county === 'string' ? meta.county : null,
    area: typeof meta.area === 'string' ? meta.area : null,
    landmark: typeof meta.landmark === 'string' ? meta.landmark : null,
    venue: typeof object?.locationName === 'string' ? object.locationName : null,
    locationConfidence:
      Number.isFinite(Number(meta.locationConfidence)) &&
      Number(meta.locationConfidence) >= 0 && Number(meta.locationConfidence) <= 1
        ? Number(meta.locationConfidence)
        : object?.locationName ? 0.5 : null
  };
}

/** How well a named area query matches an object's locality evidence. */
export function areaMatchScore(object, areaQuery) {
  const q = String(areaQuery ?? '').trim().toLowerCase();
  if (!q) return 0;
  const l = localityFieldsOf(object);
  // Exact area/landmark/venue match is the strongest signal; county still
  // counts (a Kisumu event is relevant to someone viewing Kisumu county).
  if (l.area && l.area.toLowerCase().includes(q)) return 2.5;
  if (l.landmark && l.landmark.toLowerCase().includes(q)) return 3;
  if (l.venue && l.venue.toLowerCase().includes(q)) return 3;
  if (l.county && l.county.toLowerCase().includes(q)) return 2;
  // Partial word match on venue names ("kilimani" inside "Kilimani Studio").
  if (l.venue && new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(l.venue)) return 2;
  return 0;
}

/**
 * Locality boost. Only ever positive when the CALLER supplied a locality:
 * `near` (lat/lng + radius) or `area` (a named place). With neither, every
 * object scores 0 here — no city is hardcoded as a default.
 */
export function localityScore(object, { near = null, radiusKm = null, area = null } = {}) {
  let score = 0;

  if (near && Number.isFinite(radiusKm) && radiusKm > 0) {
    const c = coordsOf(object);
    if (c) {
      const dist = haversineKm(near.lat, near.lng, c.lat, c.lng);
      if (dist <= radiusKm) score += 2.5 * (1 - dist / radiusKm);
    }
    // Unlocated objects are simply not boosted — never silently dropped.
  }

  const rawArea = areaMatchScore(object, area);
  if (rawArea > 0) {
    const l = localityFieldsOf(object);
    const conf = l.locationConfidence ?? 0.5;
    // Low-confidence location extraction earns a smaller boost.
    score += rawArea * conf;
  }

  return score;
}

// ---------------------------------------------------------------------------
// RANKING
// ---------------------------------------------------------------------------

const TRUST_WEIGHT = {
  community_confirmed: 4,
  cross_source_confirmed: 3,
  source_confirmed: 2,
  unverified: 1
};

const LOW_CONFIDENCE_GATE = 0.35; // extraction confidence below this halves the temporal upside

/** Age-based freshness: halves every ~2 days since first publication. */
function ageScore(object, nowMs) {
  const published = publishedAtOf(object);
  if (!published) return 0;
  const t = Date.parse(published);
  if (!Number.isFinite(t)) return 0;
  const ageHours = Math.max(0, (nowMs - t) / 3600000);
  return 2 * Math.pow(0.5, ageHours / 48);
}

/** Type-aware temporal relevance: urgency curves over REAL dates only. */
function temporalScore(object, life, nowMs) {
  const type = typeOf(object);
  if (!type) return 0;

  if (type === 'alert') {
    // An alert matters while it is current; it decays fast and never lingers.
    const published = publishedAtOf(object);
    const t = published ? Date.parse(published) : NaN;
    const ageHours = Number.isFinite(t) ? Math.max(0, (nowMs - t) / 3600000) : 0;
    if (ageHours < 24) return 3;
    if (ageHours < 72) return 1.5;
    return 0;
  }

  if (type === 'event' || type === 'experience') {
    if (life.status === 'happening') return 2.5;
    if (life.status === 'upcoming' && life.startsAt) {
      const daysTo = Math.max(0, (Date.parse(life.startsAt) - nowMs) / 86400000);
      // Event tomorrow ≈ 2.6; next week ≈ 1.5; next month ≈ 0.5 — urgent
      // soon, relevant later, and it remains discoverable until it passes.
      return 3 * Math.pow(0.5, daysTo / 7);
    }
    if (life.status === 'past') return -6; // fell down, stays findable
    return 0; // undated/recurring: discoverable, no fake urgency
  }

  if (type === 'offer') {
    if (life.status === 'expired') return -10;
    if (life.deadlineAt) {
      const daysLeft = Math.max(0, (Date.parse(life.deadlineAt) - nowMs) / 86400000);
      return 2.5 * Math.pow(0.5, daysLeft / 4); // "ending soon" urgency
    }
    return 0.5;
  }

  if (type === 'opportunity') {
    if (life.status === 'past') return -6;
    if (life.deadlineAt) {
      const daysLeft = Math.max(0, (Date.parse(life.deadlineAt) - nowMs) / 86400000);
      return 2 * Math.pow(0.5, daysLeft / 3);
    }
    return 0;
  }

  if (type === 'announcement') {
    const published = publishedAtOf(object);
    const t = published ? Date.parse(published) : NaN;
    const ageHours = Number.isFinite(t) ? Math.max(0, (nowMs - t) / 3600000) : 0;
    return 0.5 * Math.pow(0.5, ageHours / 96); // a notice goes quiet after ~4 days
  }

  if (EVERGREEN_TYPES.has(type)) {
    // Evergreen content ranks on trust/confidence/locality, not age — but a
    // very old, never-updated row loses a little so it cannot permanently own
    // the top.
    const published = publishedAtOf(object);
    const t = published ? Date.parse(published) : NaN;
    if (Number.isFinite(t) && nowMs - t > 90 * 86400000) return -1;
    return 0;
  }

  return 0; // news: age decay already carries it
}

/**
 * A derived relevance score for one object. Higher is better. Stale objects
 * are demoted; removed objects are excluded entirely by the caller. The score
 * is a pure function of existing evidence — no invented values.
 */
export function rankObject(object, ctx = {}) {
  if (!object) return 0;
  if (object.publication === 'removed') return -Infinity;

  const now = ctx.now ?? new Date();
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const life = lifecycleOf(object, nowMs);

  let score = 0;

  // Trust: what level has the community corroborated it to?
  const level = trust.verificationLevel(object.id);
  score += TRUST_WEIGHT[level] ?? 1;
  score += trust.confirmationCount(object.id) * 0.5;

  // Confidence: how structured the extraction was + how reliable the source is.
  const extraction = extractionConfidenceOf(object);
  score += extraction * 2.5;
  score += sourceConfidenceOf(object) * 1.5;

  // Temporal: freshness age + type-aware urgency, gated by extraction
  // confidence so a sloppy late item cannot outrank clearly structured info
  // merely by arriving later.
  const temporal = ageScore(object, nowMs) + temporalScore(object, life, nowMs);
  score += extraction < LOW_CONFIDENCE_GATE ? temporal * 0.5 : temporal;

  // Locality: only when the caller supplied a place.
  score += localityScore(object, ctx);

  // Engagement: recorded signals, not clicks.
  const e = engagement(object.id);
  score += e.views * 0.02 + e.saves * 0.3 + e.shares * 0.4;

  // Staleness penalty.
  if (isStale(object, nowMs)) score -= 3;

  // Source-level trust (operator decision, not a public rating): degraded
  // sources are ranked lower, never hidden. "Trusted" grants no boost.
  const trustStanding = sourceTrust.trustOfObject(object);
  if (trustStanding.degraded) score -= 20;

  return score;
}

// ---------------------------------------------------------------------------
// CROSS-SOURCE DUPLICATE PRESENTATION
// ---------------------------------------------------------------------------

const CLUSTER_SIMILARITY = 0.78;

function metaOf(object) {
  return object?.metadata ?? {};
}

/** Normalised title: lowercase, punctuation folded, words kept. */
function normTitle(object) {
  return String(object?.title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Corroborating evidence shared by two items about the same story. The rule
 * is deliberately SPECIFIC so two genuinely different events that merely
 * share a venue or a date are never presented as one story:
 *   - identical normalised title, or
 *   - the same canonical URL, or
 *   - the same canonical day AND the same area/county, or
 *   - the same price AND the same area/county.
 */
function corroborates(a, b) {
  if (normTitle(a) && normTitle(a) === normTitle(b)) return true;
  const ma = metaOf(a);
  const mb = metaOf(b);
  const same = (k) => ma[k] !== undefined && ma[k] === mb[k];
  const samePlace = same('area') || same('county') || same('landmark') ||
    (a.locationName && b.locationName && similarity(a.locationName, b.locationName) > 0.6);
  if (same('url')) return true;
  if (same('dateCanonical') && samePlace) return true;
  if (same('dayOfWeek') && samePlace) return true;
  if (same('price') && samePlace) return true;
  return false;
}

/** Distinct source identities attached to an object. */
export function sourcesOf(object) {
  const rows = store.filter('objectSources', (s) => s.objectId === object?.id);
  const seen = new Map();
  for (const s of rows) {
    if (seen.has(s.sourceId)) continue;
    const src = store.find('sources', (x) => x.id === s.sourceId);
    seen.set(s.sourceId, {
      id: s.sourceId,
      name: src?.name ?? 'Unknown source',
      platform: src?.platform ?? src?.type ?? null,
      type: src?.type ?? null,
      confidence: s.sourceConfidence ?? src?.confidence ?? 0.5
    });
  }
  return [...seen.values()];
}

/**
 * Collapse near-duplicate items at discovery time so one story shows once,
 * whatever its provenance. Members keep their rows untouched; the
 * representative card carries the union of source names and the cluster size.
 */
export function collapseDuplicates(ranked) {
  const clusters = [];
  for (const object of ranked) {
    const title = String(object?.title ?? '').trim().toLowerCase();
    let placed = false;
    for (const cluster of clusters) {
      const repTitle = String(cluster.representative.title ?? '').trim().toLowerCase();
      if (similarity(title, repTitle) >= CLUSTER_SIMILARITY && corroborates(object, cluster.representative)) {
        cluster.members.push(object);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push({ representative: object, members: [object] });
    }
  }
  return clusters;
}

// ---------------------------------------------------------------------------
// SOURCE DIVERSITY — no single source floods the feed
// ---------------------------------------------------------------------------

/**
 * Re-balance a ranked stream deterministically. Constraints:
 *   - at most `maxConsecutiveType` consecutive items of one type
 *   - at most `maxConsecutiveAlert` consecutive alerts
 *   - no source may hold more than ~`maxSourceShare` of the emitted prefix
 *     (with a small floor so a quiet area still shows a second item)
 * Items that violate a constraint are deferred; when the quota-picked pass is
 * done, deferred items are appended in rank order. No randomness anywhere.
 */
export function diversify(ranked, { maxConsecutiveType = 2, maxConsecutiveAlert = 2, maxSourceShare = 0.4, minSourceFloor = 2 } = {}) {
  if (!ranked.length) return [];

  const dominantSource = (object) => {
    const rows = store.filter('objectSources', (s) => s.objectId === object?.id);
    // The FIRST provenance source is the dominant one for flood control.
    return rows[0]?.sourceId ?? null;
  };

  const emitted = [];
  const deferred = [];
  const typeRun = new Map();
  let alertRun = 0;
  const sourceCounts = new Map();

  const canEmit = (object) => {
    const type = object?.type ?? 'unknown';
    const run = typeRun.get(type) ?? 0;
    if (run >= maxConsecutiveType) return false;
    if (type === 'alert' && alertRun >= maxConsecutiveAlert) return false;
    const sid = dominantSource(object);
    if (sid) {
      const share = (sourceCounts.get(sid) ?? 0) + 1;
      // Once a few items are out, cap this source at ~maxSourceShare of the
      // emitted prefix (with a small floor so a quiet area still gets two).
      const cap = Math.max(minSourceFloor, Math.floor((emitted.length + 1) * maxSourceShare));
      if (emitted.length >= 4 && share > cap) return false;
    }
    return true;
  };

  const commit = (object) => {
    emitted.push(object);
    const type = object?.type ?? 'unknown';
    typeRun.set(type, (typeRun.get(type) ?? 0) + 1);
    for (const k of typeRun.keys()) if (k !== type) typeRun.set(k, 0);
    alertRun = type === 'alert' ? alertRun + 1 : 0;
    const sid = dominantSource(object);
    if (sid) sourceCounts.set(sid, (sourceCounts.get(sid) ?? 0) + 1);
  };

  for (const object of ranked) {
    if (canEmit(object)) commit(object);
    else deferred.push(object);
  }

  return [...emitted, ...deferred];
}

// ---------------------------------------------------------------------------
// PUBLIC TEMPORAL PROJECTION
// ---------------------------------------------------------------------------

/** Safe, public temporal fields — derived from existing evidence. */
/**
 * Attach the trust-layer projection fields to a single object row: source
 * names/count/platforms, first publication time, temporal lifecycle, and the
 * verification standing. Used by feed paths that return raw rows (no
 * location/ranking) so every consumer sees the same honest trust fields.
 */
export function enrichTrustFields(object, now = new Date()) {
  if (!object) return null;
  const sources = sourcesOf(object);
  return {
    ...object,
    sourceNames: sources.map((s) => s.name).slice(0, 3),
    sourceCount: sources.length,
    sourcePlatforms: sources.map((s) => s.platform).filter(Boolean).slice(0, 3),
    publishedAt: publishedAtOf(object),
    temporal: temporalFields(object, now),
    verificationStatus: trust.verificationLevel(object.id),
    confirmationCount: trust.confirmationCount(object.id)
  };
}

export function temporalFields(object, now = new Date()) {
  const life = lifecycleOf(object, now);
  const out = {
    status: life.status,
    startsAt: life.startsAt,
    endsAt: life.endsAt,
    deadlineAt: life.deadlineAt,
    expiresAt: life.expiresAt
  };
  if (life.dayOfWeek) out.dayOfWeek = life.dayOfWeek;
  if (life.recurring) out.recurring = true;
  return out;
}

// ---------------------------------------------------------------------------
// THE DISCOVERABLE FEED
// ---------------------------------------------------------------------------

/**
 * The discoverable feed: visible objects ranked by relevance, optionally
 * constrained to a radius around a point or a named area, cross-source
 * duplicates collapsed, and the stream diversified so no source floods it.
 * Removed, stale and deadline-expired objects fall away; located objects beat
 * unlocated ones when a location is given. Callers may pass
 * `publication: 'public'` when building an anonymous projection.
 *
 * Returns the plain ranked array — the shape the first-party /api/objects
 * route has always consumed.
 */
export function discoverable(opts = {}) {
  return discoverableStream(opts).objects;
}

/**
 * Same ranking pipeline as `discoverable`, but also reports the pagination
 * frame: `total` eligible items BEFORE offset/limit were applied, so callers
 * can expose an honest `hasMore`.
 */
export function discoverableStream({ near = null, radiusKm = null, area = null, type = null, limit = 50, offset = 0, includeExpired = false, publication = null, diversifyFeed = true, collapse = true } = {}) {
  sweepExpired();

  const now = new Date();
  const ctx = { near, radiusKm, area, now };

  let objects = store.filter('objects', (o) =>
    o.publication !== 'removed' && (!publication || o.publication === publication)
  );
  if (type && CONTENT_TYPES.has(type)) {
    objects = objects.filter((o) => o.type === type);
  }
  if (!includeExpired) {
    objects = objects.filter((o) => !isStale(o, now));
  }
  // A source marked disabled by an operator stops contributing to the
  // default feed (its content stays reachable directly). Trust never deletes.
  objects = objects.filter((o) => !sourceTrust.trustOfObject(o).disabled);

  const scored = objects.map((o) => {
    const c = coordsOf(o);
    const dist = c && near ? haversineKm(near.lat, near.lng, c.lat, c.lng) : null;
    return {
      object: o,
      score: rankObject(o, ctx),
      dist,
      within: dist !== null && dist <= (radiusKm ?? Infinity)
    };
  });

  // Located-within-radius first when a geo point is given; otherwise pure
  // rank. The id tiebreaker makes equal-score order deterministic, so two
  // paginated requests walk the exact same sequence.
  const ordered = scored
    .sort((a, b) => {
      if (near && radiusKm) {
        if (a.within !== b.within) return a.within ? -1 : 1;
      }
      const byScore = b.score - a.score;
      if (byScore !== 0) return byScore;
      return a.object.id < b.object.id ? -1 : a.object.id > b.object.id ? 1 : 0;
    })
    .map((s) => {
      const out = { ...s.object, score: s.score };
      if (near) {
        out.distanceKm = s.dist !== null ? Math.round(s.dist * 10) / 10 : null;
      } else {
        out.distanceKm = null;
      }
      return out;
    });

  // Cluster cross-source duplicates: one visible card per story.
  const clusters = collapse ? collapseDuplicates(ordered) : ordered.map((o) => ({ representative: o, members: [o] }));

  // The representative carries the cluster's provenance union.
  const representativeList = clusters.map((cluster) => {
    const rep = cluster.representative;
    if (cluster.members.length <= 1) {
      return { ...rep, clusterSize: 1 };
    }
    const memberSources = new Map();
    for (const m of cluster.members) {
      for (const s of sourcesOf(m)) if (!memberSources.has(s.id)) memberSources.set(s.id, s);
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

  // Diversify the stream, then apply pagination.
  const stream = diversifyFeed ? diversify(representativeList) : representativeList;
  const total = stream.length;
  const page = stream.slice(offset, offset + limit);

  const out = page.map((o) => {
    const withSources = o.clusterSize > 1
      ? o
      : {
          ...o,
          sourceNames: sourcesOf(o).map((s) => s.name).slice(0, 3),
          sourceCount: sourcesOf(o).length,
          sourcePlatforms: sourcesOf(o).map((s) => s.platform).filter(Boolean).slice(0, 3)
        };
    return {
      ...withSources,
      // When the story was first published anywhere in its provenance —
      // the honest publication time for news and announcements.
      publishedAt: publishedAtOf(o),
      temporal: temporalFields(o, now),
      verificationStatus: trust.verificationLevel(o.id),
      confirmationCount: trust.confirmationCount(o.id)
    };
  });

  return { objects: out, total, offset };
}
