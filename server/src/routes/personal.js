// ---------------------------------------------------------------------------
// PERSONAL ROUTES — the Personal Brief's private, self-scoped surface.
//
// Every endpoint here is authed and reads/writes ONLY the caller's own rows.
// Nothing personal is ever served anonymously, and the public object feed
// carries no preference data. The ranked feed is the global discovery feed
// re-ranked with the user's bounded personal boost — the same objects, no
// duplicates, no invented rows.
// ---------------------------------------------------------------------------

import * as personal from '../domain/personal.js';
import * as entities from '../domain/entities.js';
import { discoverable } from '../domain/discovery.js';
import { requireAuth } from './helpers.js';
import { emitSignal } from '../domain/signal.js';

function json(res, value) {
  res.json(value);
}

/** The authed caller's full personal state: interests, saves, controls. */
function personalStateFor(me) {
  return {
    interests: personal.interestsOf(me),
    saved: personal.savedIdsOf(me),
    relevance: {
      more: [...personal.relevanceOf(me).more],
      less: [...personal.relevanceOf(me).less],
      notInterested: [...personal.relevanceOf(me).notInterested],
      hiddenSources: [...personal.relevanceOf(me).hiddenSources]
    },
    topics: personal.TOPICS,
    suggestedLocations: personal.SUGGESTED_LOCATIONS,
    notificationCandidates: personal.notificationCandidates(me),
    // The viewer's own entity follows (management surface + feed boosting).
    followed: entities.listFollows(me).map((f) => ({
      id: f.id, kind: f.kind, entityKey: f.entityKey, name: f.name
    }))
  };
}

/** The set of entity keys the caller explicitly follows. */
function followedEntityKeysOf(me) {
  const set = new Set();
  for (const f of entities.listFollows(me)) set.add(`${f.kind}:${f.entityKey}`);
  return set;
}

export function register(app) {
  /** One round trip: everything the Personal Brief UI needs. */
  app.get('/api/me', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    json(res, personalStateFor(me));
  });

  /**
   * The user's personal feed: the SAME global objects (collapsed, diversified,
   * trust-ranked) re-ranked with their bounded personal boost. A user with no
   * preferences receives the unchanged global feed. Optional `type`, `lat`,
   * `lng`, `radiusKm`, `limit` pass through to the global discovery pipeline.
   */
  app.get('/api/me/feed', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;

    const type = typeof req.query.type === 'string' && req.query.type ? req.query.type : null;
    const lat = req.query.lat !== undefined ? Number(req.query.lat) : null;
    const lng = req.query.lng !== undefined ? Number(req.query.lng) : null;
    const radiusKm = req.query.radiusKm !== undefined ? Number(req.query.radiusKm) : null;
    const limit = req.query.limit !== undefined ? Math.max(1, Math.min(100, Number(req.query.limit))) : 50;

    const globalObjects = discoverable({
      near: lat !== null && lng !== null ? { lat, lng } : null,
      radiusKm,
      type,
      limit,
      publication: 'public'
    });

    const interests = personal.seedFromOnboarding(me);
    const relevance = personal.relevanceOf(me);
    const followedEntityKeys = followedEntityKeysOf(me);
    // Weak derived preference: types saved repeatedly (≥3) — never a single save.
    const saveAffinity = personal.saveAffinityTypes(me);
    const hasPersonal = interests.locations.length > 0 || interests.types.length > 0 || interests.topics.length > 0
      || relevance.more.size > 0 || relevance.less.size > 0 || relevance.notInterested.size > 0 || relevance.hiddenSources.size > 0
      || followedEntityKeys.size > 0 || saveAffinity.size > 0;

    // No preferences → the unchanged global feed, order and diversity intact.
    // Personalization is a boost on top of the global discovery ranking, not
    // a second feed.
    if (!hasPersonal) {
      json(res, {
        objects: globalObjects.map((o) => ({ ...o, personal: { boost: 0, reasons: [] } })),
        interests,
        personalized: false
      });
      return;
    }

    const ranked = personal.rankPersonalized(globalObjects, { interests, relevance, followedEntityKeys, saveAffinity });
    const kept = ranked.filter(({ object }) => !personal.excludedFromPersonal(object, relevance));

    json(res, {
      objects: kept.map(({ object, boost }) => ({
        ...object,
        personal: { boost: boost.boost, reasons: boost.reasons }
      })),
      interests,
      personalized: true
    });
  });

  /** Follow a location / type / topic. Idempotent. */
  app.post('/api/me/interests', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const { kind, value } = req.body ?? {};
      personal.follow(me, kind, value);
      json(res, { ok: true, interests: personal.interestsOf(me) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  /** Unfollow a location / type / topic. Removing nothing is a no-op. */
  app.delete('/api/me/interests', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const { kind, value } = req.body ?? {};
      personal.unfollow(me, kind, value);
      json(res, { ok: true, interests: personal.interestsOf(me) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  /**
   * Replace ALL interests in one call — the lightweight onboarding flow
   * ("Where do you want your Brief?" + "What do you care about?"). Skipping
   * means simply never calling this: no-preferences users keep the global
   * feed and the Brief stays fully usable.
   */
  app.put('/api/me/interests', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const { locations = [], types = [], topics = [] } = req.body ?? {};
      const interests = personal.replaceInterests(me, { locations, types, topics });
      json(res, { ok: true, interests });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  /** Save an object (server-persisted bookmark). Idempotent. */
  app.post('/api/me/saved/:objectId', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const { save, reused } = personal.saveObject(me, req.params.objectId);
      if (!reused) {
        emitSignal({ type: 'object_saved', objectId: save.objectId, actorId: me });
      }
      json(res, { ok: true, saved: personal.savedIdsOf(me) });
    } catch (e) {
      res.status(404).json({ error: String(e.message ?? e) });
    }
  });

  /** Unsave. Removing nothing is a no-op. */
  app.delete('/api/me/saved/:objectId', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    personal.unsaveObject(me, req.params.objectId);
    json(res, { ok: true, saved: personal.savedIdsOf(me) });
  });

  /**
   * Explicit relevance control: more | less | not_interested | hide_source.
   * The user said it out loud; it persists; it can be undone by posting the
   * opposite. Nothing is inferred from it.
   */
  app.post('/api/me/relevance', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const { kind, objectId = null, sourceId = null } = req.body ?? {};
      personal.setRelevance(me, kind, { objectId, sourceId });
      json(res, { ok: true, relevance: personalStateFor(me).relevance });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  /** Undo an explicit relevance control (same shape as the set call). */
  app.delete('/api/me/relevance', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const { kind, objectId = null, sourceId = null } = req.body ?? {};
      personal.unsetRelevance(me, kind, { objectId, sourceId });
      json(res, { ok: true, relevance: personalStateFor(me).relevance });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  /** Notification candidates — the data model only; nothing is sent. */
  app.get('/api/me/notification-candidates', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    json(res, { candidates: personal.notificationCandidates(me) });
  });
}
