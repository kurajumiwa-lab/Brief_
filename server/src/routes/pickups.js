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

  // The riders a dispatcher can route to (onboarding agents + known riders +
  // you). Derived from real rows; assigning names a rider by id.
  app.get('/api/pickups/riders', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ riders: pickups.listRiders({ selfId: me }) });
  });

  // The onboarding agent's own pickup-fee settlements (finance records).
  app.get('/api/me/pickup-fee/settlements', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ settlements: pickups.listPickupFeeSettlements(me) });
  });

  // Request a settlement for the derived origin fee (finance): the only place
  // the fee becomes money, mirroring the field-agent override exactly.
  app.post('/api/me/pickup-fee/settle', (req, res) => {
    const me = requireCap(req, res, 'finance');
    if (!me) return;
    try {
      const settlement = pickups.requestPickupFeeSettlement(me, {
        from: req.body?.from ?? null,
        to: req.body?.to ?? null
      });
      res.status(201).json({ settlement });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Confirm a pickup-fee settlement (finance): the fee becomes money.
  app.post('/api/ops/pickup-fee-settlements/:id/confirm', (req, res) => {
    if (!requireCap(req, res, 'finance')) return;
    try {
      const settlement = pickups.confirmPickupFeeSettlement(req.params.id, { accept: true, note: req.body?.note });
      res.json({ settlement });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Refuse a pickup-fee settlement (finance): reverses the pending ledger entry.
  app.post('/api/ops/pickup-fee-settlements/:id/refuse', (req, res) => {
    if (!requireCap(req, res, 'finance')) return;
    try {
      const settlement = pickups.confirmPickupFeeSettlement(req.params.id, { accept: false, note: req.body?.note });
      res.json({ settlement });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Operator read of all pickups.
  app.get('/api/ops/pickups', (req, res) => {
    if (!requireCap(req, res, 'moderate')) return;
    res.json({ pickups: pickups.listPickups() });
  });
}
