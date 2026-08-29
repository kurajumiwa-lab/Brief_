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

  app.post('/api/admin/collections/:key/:action', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ collection: collection.transitionCollection(req.params.key, req.params.action) });
    } catch (e) {
      const msg = String(e.message ?? e);
      res.status(/not found/.test(msg) ? 404 : 400).json({ error: msg });
    }
  });
}
