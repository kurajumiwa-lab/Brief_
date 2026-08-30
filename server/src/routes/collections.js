// COLLECTIONS ROUTES — public resolution + editorial management.
import { requireAuth, requireCap, recordAudit } from './helpers.js';
import { requireFeature } from '../features.js';
import * as collection from '../domain/collection.js';

export function register(app) {
  app.use('/api/collections', requireFeature('collections'));

  /** Public: all published collections (metadata, no members). */
  app.get('/api/collections', (_req, res) => {
    res.json({ collections: collection.listPublished() });
  });

  /** Public: one collection resolved to its current honest membership. */
  app.get('/api/collections/:key', (req, res) => {
    const resolved = collection.resolveCollection(req.params.key, { limit: Number(req.query.limit) || 20 });
    if (!resolved) return res.status(404).json({ error: 'collection not found' });
    res.json({ collection: resolved });
  });

  // --- Editorial (authenticated) --------------------------------------------

  app.get('/api/admin/collections', (req, res) => {
    if (!requireCap(req, res, 'moderate')) return;
    res.json({ collections: collection.listAll() });
  });

  app.post('/api/admin/collections', (req, res) => {
    const me = requireCap(req, res, 'moderate');
    if (!me) return;
    try {
      const created = collection.createCollection(req.body ?? {});
      recordAudit('collection.create', { actorId: me, objectType: 'collection', objectId: created?.id, after: { key: created?.key, title: created?.title } });
      res.status(201).json({ collection: created });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  // Publishing, unpublishing and archiving change the PUBLIC story layer —
  // moderation acts, like tea's publish/unpublish: they require the
  // "moderate" capability, and every transition is audited with its
  // before/after status. (This route once asked only for an identity, which
  // let any signed-in member publish a collection; closed with the cap gap.)
  app.post('/api/admin/collections/:key/:action', (req, res) => {
    const me = requireCap(req, res, 'moderate');
    if (!me) return;
    try {
      const before = collection.getCollection(req.params.key)?.status ?? null;
      const row = collection.transitionCollection(req.params.key, req.params.action);
      recordAudit('collection.transition', {
        actorId: me,
        objectType: 'collection',
        objectId: row?.id,
        before: { status: before },
        after: { status: row?.status ?? null }
      });
      res.json({ collection: row });
    } catch (e) {
      const msg = String(e.message ?? e);
      res.status(/not found/.test(msg) ? 404 : 400).json({ error: msg });
    }
  });
}
