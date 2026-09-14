// ---------------------------------------------------------------------------
// PICKUPS ROUTES — rider routing to onboarded shops.
// ---------------------------------------------------------------------------

import * as pickups from '../domain/pickups.js';
import { requireAuth, requireCap } from './helpers.js';

export function register(app) {
  // Assign a rider to pick up from an onboarded shop. The rider defaults to
  // the caller (self-dispatch); a dispatcher may name a different rider by id.
  app.post('/api/pickups', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const pickup = pickups.assignPickup({
        originVendorId: req.body?.originVendorId,
        riderId: req.body?.riderId || me,
        destinationTown: req.body?.destinationTown,
        receiverName: req.body?.receiverName,
        receiverPhone: req.body?.receiverPhone,
        notes: req.body?.notes ?? '',
        assignedBy: me
      });
      res.status(201).json({ pickup });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // A rider (or assigner) marks a pickup delivered.
  app.post('/api/pickups/:id/complete', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ pickup: pickups.completePickup(req.params.id, me) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // The rider's own pickups.
  app.get('/api/pickups/mine', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ pickups: pickups.listPickups({ riderId: me }) });
  });

  // The onboarding agent's DERIVED origin fee.
  app.get('/api/me/pickup-origin-fee', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ obligation: pickups.pickupOriginObligation(me) });
  });

  // The dispatchable origins — every shop with an active onboarding claim.
  app.get('/api/pickups/origins', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ origins: pickups.listOrigins() });
  });

  // Operator read of all pickups.
  app.get('/api/ops/pickups', (req, res) => {
    if (!requireCap(req, res, 'moderate')) return;
    res.json({ pickups: pickups.listPickups() });
  });
}
