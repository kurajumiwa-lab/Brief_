// SHOP ROUTES — build a shop on Brief, sell it in WhatsApp.
import { requireAuth } from './helpers.js';
import * as shop from '../domain/shop.js';

export function register(app) {
  app.get('/api/shop/mine', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json(shop.shopView(me));
  });

  app.put('/api/shop/mine', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const saved = shop.saveShop(me, req.body ?? {});
      res.status(201).json(shop.shopView(me));
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/shop/mine/publish', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const out = shop.publishShop(me);
      res.json({ ...out, ...shop.shopView(me) });
    } catch (e) {
      const status = e.status ?? 400;
      res.status(status).json({
        error: String(e.message ?? e),
        ...(e.requiresService ? { requiresService: e.requiresService } : {})
      });
    }
  });

  app.post('/api/shop/mine/unpublish', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const out = shop.unpublishShop(me);
      res.json({ ...out, ...shop.shopView(me) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });
}
