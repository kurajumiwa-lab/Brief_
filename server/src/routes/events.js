// EVENTS HUB ROUTES (Tikiti T4) — the public browsing surface over events
// that actually exist. Categories are campaign types, popularity is counted
// registrations, featured is the organiser's explicit choice.

import * as events from '../domain/events.js';
import { requireAuth } from './helpers.js';

export function register(app) {
  app.get('/api/events', (req, res) => {
    try {
      const result = events.browseEvents({
        category: req.query?.category ?? null,
        location: req.query?.location ?? null,
        from: req.query?.from ?? null,
        to: req.query?.to ?? null,
        featured: req.query?.featured === '1' || req.query?.featured === 'true' ? true : null,
        sort: req.query?.sort === 'popularity' ? 'popularity' : 'date',
        limit: Number(req.query?.limit) || 50
      });
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.get('/api/events/categories', (_req, res) => {
    res.json({ categories: events.EVENT_CATEGORIES, labels: events.CATEGORY_LABELS });
  });

  app.post('/api/campaigns/:id/feature', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const c = events.setFeatured(me, req.params.id, req.body?.featured !== false);
      res.json({ campaign: { id: c.id, featured: c.metadata?.featured === true } });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });
}
