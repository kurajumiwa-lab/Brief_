// STANDALONE BANNER ROUTES
//
// Public readers get only active banners over already-published campaigns.
// Hosts create/archive their own banner; the campaign share URL remains owned
// by the campaign service and is never composed from a request Host header.

import * as banner from '../domain/banner.js';
import { requireAuth } from './helpers.js';
import { requireFeature } from '../features.js';

export function register(app) {
  app.use('/api/banners', requireFeature('campaigns'));
  app.use('/api/campaigns', requireFeature('campaigns'));

  app.get('/api/banners', (_req, res) => {
    res.json({ banners: banner.listActive() });
  });

  app.get('/api/campaigns/:id/banner', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const current = banner.getMine(req.params.id, me);
    res.json({ banner: current });
  });

  app.post('/api/campaigns/:id/banner', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const result = banner.createBanner({
        campaignId: req.params.id,
        ownerId: me,
        headline: req.body?.headline,
        body: req.body?.body,
        imageUrl: req.body?.imageUrl
      });
      res.status(result.reused ? 200 : 201).json(result);
    } catch (e) {
      const message = String(e.message ?? e);
      res.status(/not found/i.test(message) ? 404 : /owner/i.test(message) ? 403 : 400).json({ error: message });
    }
  });

  app.post('/api/banners/:id/archive', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ banner: banner.archive(req.params.id, me) });
    } catch (e) {
      const message = String(e.message ?? e);
      res.status(/not found/i.test(message) ? 404 : /owner/i.test(message) ? 403 : 400).json({ error: message });
    }
  });
}
