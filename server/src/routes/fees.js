// FEES ROUTES — paying Brief through Pochi la Biashara (manual code flow).
import { requireAuth, requireCap } from './helpers.js';
import * as fees from '../domain/fees.js';

export function register(app) {
  /** What a member sees: the Pochi number (if configured — honestly null
   *  otherwise), the server-side price list, and their own payment rows. */
  app.get('/api/fees/mine', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({
      pochi: process.env.BRIEF_POCHI_NUMBER ? String(process.env.BRIEF_POCHI_NUMBER) : null,
      services: fees.catalogView(),
      fees: fees.listServiceFees({ userId: me })
    });
  });

  /** Submit an M-Pesa confirmation code against a catalog service. The
   *  amount is never taken from the client. */
  app.post('/api/fees/pay', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const fee = fees.payServiceFee(me, req.body ?? {});
      res.status(201).json({ fee });
    } catch (e) {
      const status = e.status ?? (/unknown service|confirmation code/.test(String(e.message ?? e)) ? 400 : 400);
      res.status(status).json({ error: String(e.message ?? e) });
    }
  });

  // --- Finance (the operator who confirms codes) ----------------------------

  app.get('/api/fees/all', (req, res) => {
    const me = requireCap(req, res, 'finance');
    if (!me) return;
    res.json({
      fees: fees.listServiceFees({ status: req.query?.status ? String(req.query.status) : null }),
      confirmedRevenueKes: fees.confirmedServiceRevenue()
    });
  });

  app.post('/api/fees/:id/respond', (req, res) => {
    const me = requireCap(req, res, 'finance');
    if (!me) return;
    try {
      const fee = fees.respondServiceFee(me, req.params.id, req.body ?? {});
      res.json({ fee });
    } catch (e) {
      const msg = String(e.message ?? e);
      res.status(/not found/.test(msg) ? 404 : 400).json({ error: msg });
    }
  });
}
