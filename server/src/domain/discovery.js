// ---------------------------------------------------------------------------
// DISCOVERY — geo, expiry, freshness/engagement/trust ranking
//
// "A user opening Brief should immediately see relevant, trustworthy things."
// This module computes that order from real data and nothing else:
//
//   GEO      — haversine distance + a coarse lat/lng on objects. When an
//              object has no coordinates, distance is "unknown" and it is
//              ranked below a located one, never dropped silently.
//
//   EXPIRY   — an object with a validity window that has lapsed is stale. A
//              sweep marks it; ranking demotes it; it is never deleted.
//
//   RANKING  — a derived score over freshness (age), trust (verification +
//              confirmation count) and engagement (recorded signals: views,
//              saves, shares). The score is computed, never stored, so it can
//              never drift from the rows it summarises.
// ---------------------------------------------------------------------------

import { store } from '../store.js';
import * as trust from './trust.js';

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

export function isStale(object) {
  if (object?.expiryStatus === 'expired') return true;
  const days = object?.validityWindowDays;
  if (!Number.isFinite(days) || days <= 0) return false;
  const created = Date.parse(object?.createdAt);
  if (!Number.isFinite(created)) return false;
  return Date.now() - created > days * 86400000;
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
// RANKING
// ---------------------------------------------------------------------------

const TRUST_WEIGHT = {
  community_confirmed: 4,
  cross_source_confirmed: 3,
  source_confirmed: 2,
  unverified: 1
};

/**
 * A derived relevance score for one object. Higher is better. Stale objects
 * are demoted; removed objects are excluded entirely by the caller.
 */
export function rankObject(object) {
  if (!object) return 0;
  if (object.publication === 'removed') return -Infinity;

  let score = 0;

  // Trust: what level has the community corroborated it to?
  const level = trust.verificationLevel(object.id);
  score += TRUST_WEIGHT[level] ?? 1;
  score += trust.confirmationCount(object.id) * 0.5;

  // Freshness: newer is better, with a half-life so it decays gently.
  const ageMs = Date.now() - Date.parse(object.createdAt);
  const ageHours = Math.max(0, ageMs / 3600000);
  score += 2 * Math.pow(0.5, ageHours / 48); // halves every ~2 days

  // Engagement: recorded signals, not clicks.
  const e = engagement(object.id);
  score += e.views * 0.02 + e.saves * 0.3 + e.shares * 0.4;

  // Staleness penalty.
  if (isStale(object)) score -= 3;

  return score;
}

/**
 * The discoverable feed: visible objects ranked by relevance, optionally
 * constrained to a radius around a point. Removed and stale-heavy objects fall
 * away; located objects beat unlocated ones when a location is given. Callers
 * may pass `publication: 'public'` when building an anonymous projection.
 */
export function discoverable({ near = null, radiusKm = null, limit = 50, includeExpired = false, publication = null } = {}) {
  sweepExpired();

  let objects = store.filter('objects', (o) =>
    o.publication !== 'removed' && (!publication || o.publication === publication)
  );
  if (!includeExpired) {
    objects = objects.filter((o) => !isStale(o));
  }

  if (near && radiusKm) {
    const scored = objects.map((o) => {
      const c = coordsOf(o);
      const dist = c ? haversineKm(near.lat, near.lng, c.lat, c.lng) : Infinity;
      return { o, dist, within: dist <= radiusKm };
    });
    // Within radius first (ranked), then unlocated/unknown as a tail so a
    // sparse area still shows *something* rather than an empty void.
    const within = scored.filter((s) => s.within && Number.isFinite(s.dist));
    const rest = scored.filter((s) => !s.within || !Number.isFinite(s.dist));
    const byRank = (a, b) => rankObject(b.o) - rankObject(a.o);
    return [...within.sort(byRank).map((s) => ({ ...s.o, distanceKm: Math.round(s.dist * 10) / 10 })), ...rest.sort(byRank).map((s) => ({ ...s.o, distanceKm: null }))].slice(0, limit);
  }

  return objects
    .slice()
    .sort((a, b) => rankObject(b) - rankObject(a))
    .slice(0, limit)
    .map((o) => ({
      ...o,
      distanceKm: null,
      verificationStatus: trust.verificationLevel(o.id),
      confirmationCount: trust.confirmationCount(o.id)
    }));
}
