// POOLS ROUTES — cooperative savings (four-screen build A).
import { callerId } from '../identity.js';
import * as pool from '../domain/pool.js';
import { requireAuth, now } from './helpers.js';
import { requireFeature } from '../features.js';

export function register(app) {
  app.use('/api/pools', requireFeature('pools'));

  app.get('/api/pools', (req, res) => {
    res.json({ pools: pool.listPools({ regionType: req.query.regionType ?? null }) });
  });

  app.get('/api/pools/mine', (req, res) => {
    const me = callerId(req);
    res.json({ pools: me ? pool.listForUser(me) : [] });
  });

  app.get('/api/pools/:id', (req, res) => {
    const v = pool.poolView(req.params.id);
    if (!v) return res.status(404).json({ error: 'pool not found' });
    res.json({ pool: v });
  });

  app.post('/api/pools', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.status(201).json({ pool: pool.createPool({ ...req.body, createdBy: me }) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/pools/:id/members', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.status(201).json({ member: pool.addMember(req.params.id, req.body?.userId ?? me, req.body?.displayName ?? null) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/pools/:id/activate', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ pool: pool.activate(req.params.id, me) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/pools/:id/contribute', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json(pool.contribute(req.params.id, me, req.body?.amount ?? null));
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/pools/:id/rotate', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ pool: pool.rotate(req.params.id, me) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });
}
