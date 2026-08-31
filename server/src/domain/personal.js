// ---------------------------------------------------------------------------
// PERSONAL BRIEF — interests, explicit relevance controls, saves, candidates
//
// Personalization is explicit and inspectable. There is no black box: every
// ranking change comes from something the user chose (followed location /
// type / topic), something they did (saved, opened, shared), or something
// they said (more like this / less like this / not interested / hide this
// source). Nothing is inferred about sensitive characteristics, and nothing
// is ever exposed to other users or through public endpoints.
//
// The same global objects are re-ranked per user — no duplicate store, no
// cloned rows. Personal relevance is a BOUNDED boost added to the existing
// global score, never an absolute override: an important local alert still
// outranks an ordinary personalized offer.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { getProfile } from './onboarding.js';
import { lifecycleOf, publishedAtOf } from './discovery.js';
import { entityKeysOfObject } from './entities.js';

export const INTEREST_KINDS = ['location', 'type', 'topic'];

/**
 * A small, curated topic vocabulary (the brief forbids a giant hand-built
 * taxonomy). Each topic matches against real object fields — title, summary,
 * category and extracted categories — with plain keywords.
 */
export const TOPICS = [
  { id: 'food', label: 'Food', keywords: ['food', 'restaurant', 'cafe', 'coffee', 'market', 'eats', 'menu', 'kitchen', 'snack', 'grill'] },
  { id: 'jobs', label: 'Jobs', keywords: ['job', 'vacancy', 'hiring', 'apply', 'apprenticeship', 'intern', 'career', 'position', 'recruit', 'salary'] },
  { id: 'business', label: 'Business', keywords: ['business', 'shop', 'store', 'vendor', 'trade', 'enterprise', 'startup', 'commerce', 'sme', 'entrepreneur'] },
  { id: 'community', label: 'Community', keywords: ['community', 'clean-up', 'meeting', 'baraza', 'volunteer', 'neighbourhood', 'fundraiser', 'fellowship'] },
  { id: 'health', label: 'Health', keywords: ['health', 'clinic', 'hospital', 'medical', 'vaccin', 'malaria', 'fever', 'wellness', 'pharmacy'] },
  { id: 'education', label: 'Education', keywords: ['school', 'college', 'university', 'training', 'course', 'class', 'workshop', 'scholarship', 'exam', 'library'] },
  { id: 'entertainment', label: 'Entertainment', keywords: ['concert', 'gig', 'show', 'festival', 'movie', 'film', 'music', 'dj', 'live band', 'comedy', 'party'] },
  { id: 'transport', label: 'Transport', keywords: ['transport', 'matatu', 'bus', 'train', 'road', 'traffic', 'sacco', 'boda', 'pilot', 'route'] },
  { id: 'safety', label: 'Safety', keywords: ['security', 'safety', 'police', 'theft', 'robbery', 'alert', 'danger', 'warning', 'fire'] },
  { id: 'sports', label: 'Sports', keywords: ['football', 'soccer', 'rugby', 'basketball', 'match', 'tournament', 'gym', 'fitness', 'athletics', 'race'] },
  { id: 'art', label: 'Art', keywords: ['art', 'gallery', 'exhibition', 'craft', 'design', 'painting', 'photography', 'sculpture'] },
  { id: 'environment', label: 'Environment', keywords: ['environment', 'climate', 'tree', 'planting', 'recycle', 'waste', 'energy', 'solar', 'water'] }
];

/** Locations offered in the personalization picker (cities/counties + hubs). */
export const SUGGESTED_LOCATIONS = [
  'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Naivasha',
  'Nyeri', 'Machakos', 'Kilimani', 'Westlands', 'Kileleshwa', 'Lavington',
  'Karen', "Lang'ata", 'Kasarani', 'South B', 'South C', 'Ruaka', 'Rongai',
  'Kitengela', 'Ngong', 'Kikuyu', 'Juja', 'Athi River'
];

function now() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// INTERESTS (follows)
// ---------------------------------------------------------------------------

/** A user's interests grouped by kind, each deduped and newest-first. */
export function interestsOf(userId) {
  if (!userId) return { locations: [], types: [], topics: [] };
  const rows = store.filter('userInterests', (i) => i.userId === userId)
    .slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const out = { locations: [], types: [], topics: [] };
  const keyOf = (kind) => (kind === 'location' ? 'locations' : kind === 'type' ? 'types' : kind === 'topic' ? 'topics' : null);
  for (const row of rows) {
    const key = keyOf(row.kind);
    if (key && !out[key].includes(row.value)) out[key].push(row.value);
  }
  return out;
}

/** Follow one location/type/topic. Idempotent: re-following is a no-op. */
export function follow(userId, kind, value) {
  if (!userId) throw new Error('a user is required');
  if (!INTEREST_KINDS.includes(kind)) throw new Error(`kind must be one of ${INTEREST_KINDS.join(', ')}`);
  const label = String(value ?? '').trim();
  if (!label) throw new Error('a value is required');
  if (label.length > 60) throw new Error('value is too long');
  if (kind === 'type' && !KNOWN_TYPES.has(label)) throw new Error(`type must be one of: ${[...KNOWN_TYPES].join(', ')}`);
  if (kind === 'topic' && !TOPICS.some((t) => t.id === label)) throw new Error(`topic must be one of: ${TOPICS.map((t) => t.id).join(', ')}`);

  const existing = store.find('userInterests', (i) => i.userId === userId && i.kind === kind && i.value === label);
  if (existing) return { interest: existing, reused: true };
  return {
    interest: store.insert('userInterests', { id: newId('int'), userId, kind, value: label, createdAt: now() }),
    reused: false
  };
}

/** Unfollow. Removing something not followed is a no-op. */
export function unfollow(userId, kind, value) {
  if (!userId) throw new Error('a user is required');
  if (!INTEREST_KINDS.includes(kind)) throw new Error(`kind must be one of ${INTEREST_KINDS.join(', ')}`);
  const label = String(value ?? '').trim();
  const rows = store.filter('userInterests', (i) => i.userId === userId && i.kind === kind && i.value === label);
  for (const row of rows) store.remove('userInterests', row.id);
  return { removed: rows.length };
}

/** Batch-replace (the lightweight onboarding flow). Returns the new state. */
export function replaceInterests(userId, { locations = [], types = [], topics = [] } = {}) {
  for (const row of store.filter('userInterests', (i) => i.userId === userId)) {
    store.remove('userInterests', row.id);
  }
  const picked = { locations: [], types: [], topics: [] };
  for (const value of locations) { try { follow(userId, 'location', value); picked.locations.push(String(value).trim()); } catch { /* skip invalid */ } }
  for (const value of types) { try { follow(userId, 'type', value); picked.types.push(String(value).trim()); } catch { /* skip invalid */ } }
  for (const value of topics) { try { follow(userId, 'topic', value); picked.topics.push(String(value).trim()); } catch { /* skip invalid */ } }
  return interestsOf(userId);
}

/**
 * Seed interests from the onboarding answer: the single `place` a person
 * chose during sign-up becomes their first followed location — one system of
 * record, not a second preference store. Only when they have no interests yet.
 */
export function seedFromOnboarding(userId) {
  const profile = getProfile(userId);
  if (!profile?.place) return interestsOf(userId);
  const current = interestsOf(userId);
  if (current.locations.length > 0 || current.types.length > 0 || current.topics.length > 0) {
    return current;
  }
  try { follow(userId, 'location', profile.place); } catch { /* not a place we can follow */ }
  return interestsOf(userId);
}

// ---------------------------------------------------------------------------
// TOPIC MATCHING
// ---------------------------------------------------------------------------

const KNOWN_TYPES = new Set([
  'event', 'business', 'offer', 'alert', 'announcement', 'news',
  'experience', 'place', 'opportunity', 'service', 'product', 'knowledge'
]);

function textOf(object) {
  const parts = [
    object?.title,
    object?.summary,
    object?.category,
    ...(Array.isArray(object?.metadata?.categories) ? object.metadata.categories : [])
  ].filter((v) => typeof v === 'string' && v);
  return parts.join(' ').toLowerCase();
}

/** Which curated topics an object genuinely matches (keyword hits only). */
export function topicsFor(object) {
  const text = textOf(object);
  if (!text) return [];
  const out = [];
  for (const topic of TOPICS) {
    if (topic.keywords.some((k) => text.includes(k))) out.push(topic.id);
  }
  return out;
}

// ---------------------------------------------------------------------------
// LOCATION MATCHING
// ---------------------------------------------------------------------------

/** Does this object belong to the followed place? Textual, never invented. */
export function matchesLocation(object, place) {
  if (!object || !place) return false;
  const wanted = String(place).trim().toLowerCase();
  if (!wanted) return false;
  const meta = object.metadata ?? {};
  const candidates = [
    meta.area, meta.county, meta.landmark, meta.venue,
    object.locationName
  ].filter((v) => typeof v === 'string' && v.trim());
  const hay = candidates.map((v) => v.toLowerCase());
  return hay.some((v) => v === wanted || v.includes(wanted) || wanted.includes(v));
}

// ---------------------------------------------------------------------------
// EXPLICIT RELEVANCE CONTROLS
// ---------------------------------------------------------------------------

export const RELEVANCE_KINDS = ['more', 'less', 'not_interested', 'hide_source'];

/**
 * Record an explicit relevance control. Idempotent per (user, kind, target):
 * repeating the same control is a no-op; changing your mind replaces the row.
 */
export function setRelevance(userId, kind, { objectId = null, sourceId = null } = {}) {
  if (!userId) throw new Error('a user is required');
  if (!RELEVANCE_KINDS.includes(kind)) throw new Error(`kind must be one of ${RELEVANCE_KINDS.join(', ')}`);
  if (kind === 'hide_source') {
    if (!sourceId) throw new Error('sourceId is required for hide_source');
    if (!store.find('sources', (s) => s.id === sourceId)) throw new Error('source not found');
  } else if (!objectId) {
    throw new Error('objectId is required');
  } else if (!store.find('objects', (o) => o.id === objectId)) {
    throw new Error('object not found');
  }

  const existing = store.find('userRelevance', (r) =>
    r.userId === userId && r.kind === kind &&
    (r.objectId ?? null) === (objectId ?? null) && (r.sourceId ?? null) === (sourceId ?? null));
  if (existing) return { relevance: existing, reused: true };

  const relevance = store.insert('userRelevance', {
    id: newId('rel'),
    userId,
    kind,
    objectId: objectId ?? null,
    sourceId: sourceId ?? null,
    createdAt: now()
  });
  return { relevance, reused: false };
}

/** Undo an explicit control (same shape as setRelevance). No-op if absent. */
export function unsetRelevance(userId, kind, { objectId = null, sourceId = null } = {}) {
  if (!userId) throw new Error('a user is required');
  if (!RELEVANCE_KINDS.includes(kind)) throw new Error(`kind must be one of ${RELEVANCE_KINDS.join(', ')}`);
  const key = kind === 'hide_source' ? 'sourceId' : 'objectId';
  const value = kind === 'hide_source' ? sourceId : objectId;
  const rows = store.filter('userRelevance', (r) =>
    r.userId === userId && r.kind === kind && r[key] === value);
  for (const row of rows) store.remove('userRelevance', row.id);
  return { removed: rows.length };
}

/** The user's explicit controls, for the ranking pass. */
export function relevanceOf(userId) {
  if (!userId) return { more: new Set(), less: new Set(), notInterested: new Set(), hiddenSources: new Set() };
  const out = { more: new Set(), less: new Set(), notInterested: new Set(), hiddenSources: new Set() };
  for (const row of store.filter('userRelevance', (r) => r.userId === userId)) {
    if (row.kind === 'more') out.more.add(row.objectId);
    if (row.kind === 'less') out.less.add(row.objectId);
    if (row.kind === 'not_interested') out.notInterested.add(row.objectId);
    if (row.kind === 'hide_source') out.hiddenSources.add(row.sourceId);
  }
  return out;
}

// ---------------------------------------------------------------------------
// SAVES (server-persisted bookmarks)
// ---------------------------------------------------------------------------

/** Save an object. Idempotent. Emits the object_saved signal at the route. */
export function saveObject(userId, objectId) {
  if (!userId) throw new Error('a user is required');
  const object = store.find('objects', (o) => o.id === objectId);
  if (!object) throw new Error('object not found');
  const existing = store.find('saves', (s) => s.userId === userId && s.objectId === objectId);
  if (existing) return { save: existing, reused: true };
  return {
    save: store.insert('saves', { id: newId('sav'), userId, objectId, createdAt: now() }),
    reused: false
  };
}

/** Unsave. Removing a non-existent save is a no-op. */
export function unsaveObject(userId, objectId) {
  const rows = store.filter('saves', (s) => s.userId === userId && s.objectId === objectId);
  for (const row of rows) store.remove('saves', row.id);
  return { removed: rows.length };
}

export function isSaved(userId, objectId) {
  return Boolean(store.find('saves', (s) => s.userId === userId && s.objectId === objectId));
}

/** The user's saved object ids, newest save first. */
export function savedIdsOf(userId) {
  return store.filter('saves', (s) => s.userId === userId)
    .slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((s) => s.objectId);
}

// ---------------------------------------------------------------------------
// PERSONAL RANKING BOOST
// ---------------------------------------------------------------------------

/**
 * The bounded personal contribution to the existing global score. Every term
 * is derived from an explicit user choice or action:
 *
 *   followed location +6, followed type +4, matched topics +3 each (max 2),
 *   engaged (opened/saved/shared) +3, said "more like this" +8.
 *
 * Caps are type-aware so personalization can never override importance: a
 * very important local alert scores ~14 globally (community confirmation +
 * corroboration + urgency + freshness + structure), while a maximally
 * personalized ordinary offer starts from a global score of ~6. Everyday
 * types (offers, products, services, knowledge) therefore cap at +6, so the
 * best-case personalized offer still lands BELOW a genuinely important
 * alert, which keeps its full global priority. Alerts, news, events and the
 * rest cap at +12 — following them is itself a strong signal, and for those
 * types a boost that big still cannot outrank a corroborated alert.
 * "Less like this" (−12) and "not interested" (excluded entirely) demote;
 * nothing is ever demoted by absence of personalization.
 */
/**
 * Weak derived type preference from SAVES (Collections brief). Only types the
 * user has saved at least SAVE_AFFINITY_MIN times count, so a single save
 * never implies a permanent preference. The boost it feeds is deliberately
 * smaller than an explicit interest type.
 */
export const SAVE_AFFINITY_MIN = 3;

export function saveAffinityTypes(userId, min = SAVE_AFFINITY_MIN) {
  const byType = {};
  for (const row of store.filter('saves', (s) => s.userId === userId)) {
    const obj = store.find('objects', (o) => o.id === row.objectId);
    if (!obj?.type) continue;
    byType[obj.type] = (byType[obj.type] ?? 0) + 1;
  }
  return new Set(Object.entries(byType).filter(([, n]) => n >= min).map(([t]) => t));
}

export function personalBoost(object, interests, relevance, followedEntityKeys = null, saveAffinity = null) {
  if (!object?.id) return { boost: 0, reasons: [] };
  let boost = 0;
  const reasons = [];

  if (interests.locations.some((loc) => matchesLocation(object, loc))) {
    boost += 6; reasons.push('location');
  }
  if (interests.types.includes(object.type)) {
    boost += 4; reasons.push('type');
  }
  const matchedTopics = topicsFor(object).filter((t) => interests.topics.includes(t)).slice(0, 2);
  boost += matchedTopics.length * 3;
  if (matchedTopics.length) reasons.push('topic');

  // Weak engagement signals: the user actually opened/saved/shared this row.
  if (engagementHits(object.id)) { boost += 3; reasons.push('engaged'); }

  // Repeated saves (≥ SAVE_AFFINITY_MIN of the same type) are a WEAK type
  // preference — smaller than the explicit +4 and never from a single save.
  if (saveAffinity && saveAffinity.has(object.type)) {
    boost += 2; reasons.push('saved_type');
  }

  // An EXPLICIT entity follow is a stronger signal than any inferred
  // preference: the user named this venue/business/publisher/organizer/
  // community themselves. Still bounded — the global score (trust, temporal,
  // corroboration) stays primary, so an important alert is never displaced
  // by an ordinary offer just because its venue is followed.
  let followed = false;
  if (followedEntityKeys && followedEntityKeys.size) {
    followed = entityKeysOfObject(object).some((k) => followedEntityKeys.has(k));
    if (followed) { boost += 8; reasons.push('followed'); }
  }

  // Explicit controls outrank everything derived.
  if (relevance.more.has(object.id)) { boost += 8; reasons.push('more'); }
  if (relevance.less.has(object.id)) { boost -= 12; reasons.push('less'); }
  if (relevance.notInterested.has(object.id)) { boost -= 100; reasons.push('not_interested'); }
  if (sourceHidden(object, relevance.hiddenSources)) { boost -= 12; reasons.push('hidden_source'); }

  const everyday = ['offer', 'product', 'service', 'knowledge'].includes(object.type);
  // Followed content may rise above the inferred-preference cap, but stays
  // tightly bounded so a very important alert (high trust, corroborated,
  // fresh) is never displaced by an ordinary offer just because its venue is
  // followed — no echo chamber. Everyday caps: 6 inferred / 8 followed.
  // Other types: 12 inferred / 16 followed (a followed venue's upcoming event
  // may rank high, but never above a corroborated local alert).
  const cap = everyday ? (followed ? 8 : 6) : (followed ? 16 : 12);
  return { boost: Math.min(boost, cap), reasons };
}

/**
 * Re-rank the global feed for one user. The global score stays primary —
 * this adds the bounded personal boost and keeps the original global order
 * (which already carries trust + temporal + source diversity) as the stable
 * tie-break, so no personalization can collapse diversity.
 */
export function rankPersonalized(objects, { interests, relevance, scores = null, followedEntityKeys = null, saveAffinity = null } = {}) {
  const withIndex = objects.map((o, index) => {
    const boost = personalBoost(o, interests, relevance, followedEntityKeys, saveAffinity);
    // Global score first: the discovery pipeline already stamped `.score`;
    // an explicit map wins when the caller computed scores separately.
    const base = scores && scores.has(o.id) ? scores.get(o.id) : (o.score ?? 0);
    return { o, index, total: base + boost.boost, boost };
  });
  return withIndex
    .sort((a, b) => (b.total - a.total) || (a.index - b.index))
    .map(({ o, boost }) => ({ object: o, boost }));
}

function engagementHits(objectId) {
  // A user's own signals are matched by actor; we only count non-empty actor.
  const rows = store.filter('signals', (s) =>
    Boolean(s.actorId) && s.objectId === objectId &&
    ['object_viewed', 'object_saved', 'object_shared'].includes(s.type));
  return rows.length > 0;
}

function sourceHidden(object, hiddenSources) {
  if (hiddenSources.size === 0) return false;
  const rows = store.filter('objectSources', (s) => s.objectId === object?.id);
  if (rows.length === 0) return false;
  const ids = rows.map((r) => r.sourceId);
  return ids.some((id) => hiddenSources.has(id));
}

/** Should this object be EXCLUDED from the personal feed? */
export function excludedFromPersonal(object, relevance) {
  if (!object?.id) return true;
  if (relevance.notInterested.has(object.id)) return true;
  // Hidden everywhere: every provenance source is hidden by this user.
  const rows = store.filter('objectSources', (s) => s.objectId === object.id);
  if (rows.length === 0) return false;
  return rows.every((r) => relevance.hiddenSources.has(r.sourceId));
}

// ---------------------------------------------------------------------------
// NOTIFICATION CANDIDATES (data architecture — nothing is sent)
// ---------------------------------------------------------------------------

/**
 * Compute what WOULD notify this user, from real objects × real interests.
 * This is the data model for future push: kinds are typed, each candidate
 * names the object, why it matched, and when it matters. No rows are written
 * and nothing is delivered — the inbox remains the only notification surface
 * until push is actually connected.
 */
export function notificationCandidates(userId, now = new Date()) {
  const interests = seedFromOnboarding(userId);
  const saved = savedIdsOf(userId);
  const relevance = relevanceOf(userId);
  const candidates = [];
  const objects = store.filter('objects', (o) => o.publication === 'public')
    .filter((o) => !excludedFromPersonal(o, relevance));

  for (const o of objects) {
    const meta = o.metadata ?? {};
    const isEvent = o.type === 'experience' || o.type === 'event';
    const life = lifecycleOf(o, now);
    const startsAt = life.startsAt;
    const deadlineAt = life.deadlineAt;
    const inFollowedLocation = interests.locations.some((loc) => matchesLocation(o, loc));
    const inFollowedType = interests.types.includes(o.type);
    const inFollowedTopic = topicsFor(o).some((t) => interests.topics.includes(t));
    const relevant = inFollowedLocation || inFollowedType || inFollowedTopic;

    if (relevant && isEvent && startsAt) {
      const daysTo = (Date.parse(startsAt) - now.getTime()) / 86400000;
      if (daysTo >= 0 && daysTo <= 14) {
        candidates.push({
          kind: 'new_event',
          objectId: o.id,
          title: o.title,
          dueAt: new Date(startsAt).toISOString(),
          reason: inFollowedLocation ? 'in a location you follow' : inFollowedType ? 'a type you follow' : 'matches a topic you follow'
        });
      }
      if (saved.includes(o.id) && daysTo >= 0 && daysTo <= 1) {
        candidates.push({ kind: 'event_reminder', objectId: o.id, title: o.title, dueAt: new Date(startsAt).toISOString(), reason: 'a saved event starting soon' });
      }
    }
    if (relevant && (o.type === 'offer' || o.type === 'opportunity') && deadlineAt) {
      const hoursLeft = (Date.parse(deadlineAt) - now.getTime()) / 3600000;
      if (hoursLeft >= 0 && hoursLeft <= 24) {
        candidates.push({ kind: 'offer_expiring', objectId: o.id, title: o.title, dueAt: new Date(deadlineAt).toISOString(), reason: 'expiring within 24 hours' });
      }
    }
    if (inFollowedLocation && o.type === 'alert') {
      candidates.push({ kind: 'local_alert', objectId: o.id, title: o.title, dueAt: life.expiresAt ?? null, reason: 'an alert in a location you follow' });
    }
    if (inFollowedTopic && (o.type === 'news' || o.type === 'announcement')) {
      candidates.push({ kind: 'topic_update', objectId: o.id, title: o.title, dueAt: publishedAtOf(o) ?? null, reason: 'a topic you follow' });
    }
  }
  return candidates.slice(0, 50);
}

/** The typed kinds the future notification system can represent. */
export const PERSONAL_NOTIFICATION_KINDS = ['new_event', 'event_reminder', 'offer_expiring', 'local_alert', 'topic_update'];
