// FIELD AGENT ROUTES — riders/agents onboard vendors and earn territory
// overrides. Claims are a member act (self-dealing refused, first-touch-wins);
// the derived override is the member's own; money is finance-gated.
import * as fieldAgent from '../domain/fieldAgent.js';
import { requireAuth, requireCap } from './helpers.js';
import { requireFeature } from '../features.js';

export function register(app) {
  app.use('/api/vendors/:vendorId/claim', requireFeature('field_agents'));
  app.use('/api/me/field-agent', requireFeature('field_agents'));
  app.use('/api/ops/field-agents', requireFeature('field_agents'));
  app.use('/api/ops/field-agent-settlements', requireFeature('field_agents'));

  // Who currently holds this vendor's territory (the active full_registration
  // claim), or honest null when nobody does.
  app.get('/api/vendors/:vendorId/claim', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json({ claim: fieldAgent.vendorClaim(req.params.vendorId) });
  });

  // Claim a vendor (menu_upload bounty or full_registration override).
  app.post('/api/vendors/:vendorId/claims', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const claim = fieldAgent.claimVendor({
        agentId: me,
        vendorId: req.params.vendorId,
        claimType: req.body?.claimType,
        territoryKey: req.body?.territoryKey ?? null
      });
      res.status(201).json({ claim });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // The member's own claims + derived override.
  app.get('/api/me/field-agent', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({
      claims: fieldAgent.myClaims(me),
      override: fieldAgent.overrideObligation(me),
      settlements: fieldAgent.listSettlements(me)
    });
  });

  // Request a settlement for the member's derived override (finance).
  app.post('/api/me/field-agent/settle', (req, res) => {
    const me = requireCap(req, res, 'finance');
    if (!me) return;
    try {
      const settlement = fieldAgent.requestOverrideSettlement(me, {
        from: req.body?.from ?? null,
        to: req.body?.to ?? null
      });
      res.status(201).json({ settlement });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Operator list of all claims (moderate).
  app.get('/api/ops/field-agents', (req, res) => {
    if (!requireCap(req, res, 'moderate')) return;
    res.json({ claims: fieldAgent.listClaims() });
  });

  // Confirm a settlement (finance): the only place the override becomes money.
  app.post('/api/ops/field-agent-settlements/:id/confirm', (req, res) => {
    if (!requireCap(req, res, 'finance')) return;
    try {
      const settlement = fieldAgent.confirmOverrideSettlement(req.params.id, { accept: true, note: req.body?.note });
      res.json({ settlement });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Refuse a settlement (finance): reverses the pending ledger entry.
  app.post('/api/ops/field-agent-settlements/:id/refuse', (req, res) => {
    if (!requireCap(req, res, 'finance')) return;
    try {
      const settlement = fieldAgent.confirmOverrideSettlement(req.params.id, { accept: false, note: req.body?.note });
      res.json({ settlement });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });
}
