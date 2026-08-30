// SHOP ROUTES — build a shop on Brief, sell it in WhatsApp.
import { requireAuth } from './helpers.js';
import * as shop from '../domain/shop.js';
// The escrow read layer: one honest view over every escrow pattern.
import { myEscrows } from '../domain/escrow.js';

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

  // --- Escrow-as-records (one read layer over every escrow pattern) ---------

  app.get('/api/escrows/mine', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json(myEscrows(me));
  });

  /** The Duka Book --------------------------------------------------------- */

  /** The derived book: today, yesterday, the week, top items, low stock. */
  app.get('/api/shop/mine/book', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json(shop.bookView(me));
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  /** Log a sale (3 fields). Idempotent per clientKey for the offline queue. */
  app.post('/api/shop/mine/sales', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const out = shop.recordSale(me, req.body ?? {});
      res.status(out.replayed ? 200 : 201).json(out);
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  /** Pool a restock: opens a Group Buy on the existing engine. */
  app.post('/api/shop/mine/pool', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.status(201).json(shop.poolRestock(me, req.body ?? {}));
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });
}
