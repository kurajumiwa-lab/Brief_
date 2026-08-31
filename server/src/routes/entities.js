// ---------------------------------------------------------------------------
// ENTITY ROUTES — the followable layer (DISCOVER → FOLLOW → RECEIVE → ACT).
//
// Entity pages are PUBLIC (stable shareable URLs) and expose only the public
// projection (entities.publicEntity). Follow/unfollow are authenticated and
// strictly self-scoped: a user can only ever modify their OWN follow rows.
// All analytics go through the existing signal log (entity_viewed,
// entity_followed, entity_unfollowed, entity_object_opened, source_opened) —
// nothing else is recorded about the viewer.
// ---------------------------------------------------------------------------

import * as entities from '../domain/entities.js';
import { requireAuth } from './helpers.js';
import { callerId } from '../identity.js';
import { emitSignal } from '../domain/signal.js';

export function register(app) {
  /**
   * Resolve an entity by EXACT name — the hook for "Venue · X" / "Source · X"
   * / "Hosted by X" links on feed cards. Returns { entity: null } (200) when
   * no entity carries that name, so the client renders plain text instead of
   * a dead link. Public, like entity pages.
   */
  app.get('/api/entities/by-name', (req, res) => {
    const kind = typeof req.query.kind === 'string' ? req.query.kind : null;
    const name = typeof req.query.name === 'string' ? req.query.name.trim() : '';
    if (!kind || !entities.ENTITY_KINDS.includes(kind) || !name) {
      return res.status(400).json({ error: 'kind and name are required' });
    }
    const viewer = callerId(req);
    const needle = name.toLowerCase();
    for (const e of entities.resolveEntities().values()) {
      if (e.kind === kind && String(e.name).toLowerCase() === needle) {
        return res.json({ entity: entities.publicEntity(e, viewer) });
      }
    }
    res.json({ entity: null });
  });

  /**
   * Public entity page. No session required: entity pages are shareable.
   * When a session IS present, the payload carries the viewer's own
   * isFollowed flag — never anyone else's follow state.
   */
  app.get('/api/entities/:id', (req, res) => {
    const viewer = callerId(req);
    const entity = entities.getEntity(req.params.id, viewer);
    if (!entity) return res.status(404).json({ error: 'entity not found' });
    if (viewer) {
      emitSignal({
        type: 'entity_viewed',
        actorId: viewer,
        metadata: { entityId: `${entity.kind}:${entity.entityKey}`, kind: entity.kind }
      });
    }
    res.json({ entity });
  });

  /**
   * Follow an entity. Authenticated, self-scoped, idempotent. The follow row
   * is a pure edge (userId, kind, entityKey) — no object duplication.
   */
  app.post('/api/entities/:id/follow', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const parsed = entities.parseEntityId(req.params.id);
    if (!parsed || !parsed.kind) return res.status(400).json({ error: 'invalid entity id' });
    const entity = entities.getEntity(req.params.id, me);
    if (!entity) return res.status(404).json({ error: 'entity not found' });

    const result = entities.followEntity(me, parsed.kind, parsed.key);
    if (!result.already) {
      emitSignal({
        type: 'entity_followed',
        actorId: me,
        metadata: { entityId: `${parsed.kind}:${parsed.key}`, kind: parsed.kind }
      });
    }
    res.json({
      followed: true,
      already: result.already,
      followCount: entity.followCount + (result.already ? 0 : 1)
    });
  });

  /** Unfollow. Authenticated, self-scoped, idempotent. */
  app.delete('/api/entities/:id/follow', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const parsed = entities.parseEntityId(req.params.id);
    if (!parsed || !parsed.kind) return res.status(400).json({ error: 'invalid entity id' });
    const entity = entities.getEntity(req.params.id, me);
    if (!entity) return res.status(404).json({ error: 'entity not found' });

    const result = entities.unfollowEntity(me, parsed.kind, parsed.key);
    if (!result.already) {
      emitSignal({
        type: 'entity_unfollowed',
        actorId: me,
        metadata: { entityId: `${parsed.kind}:${parsed.key}`, kind: parsed.kind }
      });
    }
    res.json({
      unfollowed: true,
      already: result.already,
      followCount: Math.max(0, entity.followCount - (result.already ? 0 : 1))
    });
  });

  /** The viewer's own follow list (management surface), grouped by kind. */
  app.get('/api/me/follows', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const follows = entities.listFollows(me);
    const groups = {};
    for (const kind of entities.ENTITY_KINDS) groups[kind] = [];
    for (const f of follows) groups[f.kind]?.push(f);
    for (const kind of entities.ENTITY_KINDS) {
      if (groups[kind].length) groups[kind].sort((a, b) => a.name.localeCompare(b.name));
    }
    res.json({
      groups,
      total: follows.length,
      kindLabels: entities.KIND_GROUP_LABELS
    });
  });

  /**
   * The viewer's Following feed: recent information from followed entities,
   * each section ranked by the same discovery intelligence as the feed.
   * Expired content is projected with its real temporal status (never active).
   */
  app.get('/api/me/following', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const sections = entities.followingFeed(me).map((s) => ({
      ...s,
      objects: s.objects.map((o) => ({
        id: o.id,
        type: o.type,
        title: o.title,
        summary: o.summary ?? o.dek ?? null,
        imageUrl: o.imageUrl ?? null,
        locationName: o.locationName ?? null,
        category: o.category ?? null,
        area: o.metadata?.area ?? null,
        county: o.metadata?.county ?? null,
        temporal: o.temporal ?? null,
        score: o.score ?? null
      }))
    }));
    res.json({ sections, total: sections.length });
  });

  /** Record that the viewer opened an object from an entity page. */
  app.post('/api/entities/:id/object-opened', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const parsed = entities.parseEntityId(req.params.id);
    const objectId = typeof req.body?.objectId === 'string' ? req.body.objectId : null;
    if (!parsed || !parsed.kind) return res.status(400).json({ error: 'invalid entity id' });
    if (!objectId) return res.status(400).json({ error: 'objectId is required' });
    emitSignal({
      type: 'entity_object_opened',
      actorId: me,
      objectId,
      metadata: { entityId: `${parsed.kind}:${parsed.key}`, kind: parsed.kind }
    });
    res.json({ ok: true });
  });

  /** Record that the viewer opened a source from an entity page. */
  app.post('/api/entities/:id/source-opened', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const parsed = entities.parseEntityId(req.params.id);
    const sourceId = typeof req.body?.sourceId === 'string' ? req.body.sourceId : null;
    if (!parsed || !parsed.kind) return res.status(400).json({ error: 'invalid entity id' });
    if (!sourceId) return res.status(400).json({ error: 'sourceId is required' });
    emitSignal({
      type: 'source_opened',
      actorId: me,
      sourceId,
      metadata: { entityId: `${parsed.kind}:${parsed.key}`, kind: parsed.kind }
    });
    res.json({ ok: true });
  });

  /**
   * The viewer's followed entity keys, folded into the Personal Brief state
   * so the client can render follow state everywhere from one payload.
   */
  app.get('/api/me/followed-entities', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const follows = entities.listFollows(me);
    res.json({
      entities: follows.map((f) => ({ id: f.id, kind: f.kind, entityKey: f.entityKey, name: f.name }))
    });
  });
}
