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

  // The onboarding agent's DERIVED pickup count — information, not pay. The
  // path used to be /api/me/pickup-origin-fee and used to answer with KES;
  // Decision 5 (docs/DECISIONS.md) ended the per-pickup fee, and a route named
  // "fee" that returns no fee is a route that invites somebody to re-add one.
  app.get('/api/me/pickup-origins', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ stats: pickups.pickupOriginStats(me) });
  });

  // The dispatchable origins — every shop with an active onboarding claim.
  app.get('/api/pickups/origins', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ origins: pickups.listOrigins() });
  });

  // The riders a dispatcher can route to (onboarding agents + known riders +
  // you). Derived from real rows; assigning names a rider by id.
  app.get('/api/pickups/riders', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ riders: pickups.listRiders({ selfId: me }) });
  });

  // HISTORY ONLY: pickup-fee settlements written before Decision 5 ended the
  // per-pickup fee. Readable, never re-payable — the settle/confirm/refuse
  // routes that used to sit here are gone with the fee they moved.
  app.get('/api/me/pickup-fee/settlements', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ settlements: pickups.listPickupFeeSettlements(me) });
  });

  // Operator read of all pickups.
  app.get('/api/ops/pickups', (req, res) => {
    if (!requireCap(req, res, 'moderate')) return;
    res.json({ pickups: pickups.listPickups() });
  });
}
