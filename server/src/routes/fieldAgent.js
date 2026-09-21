// FIELD AGENT ROUTES — riders/agents onboard vendors, record the visits that
// pay, and read their own derived earnings. Claims and visits are a member act
// (self-dealing refused, first-touch-wins, one paid visit per shop per
// purpose); approving a visit is an operator act; money is finance-gated.
//
// Pay is the operator's Decision 5 (docs/DECISIONS.md): KES 150 flat per
// APPROVED visit, settled weekly. No rate, no window, no bonus — so nothing
// here accepts a rate, a window or a bonus either.
import * as fieldAgent from '../domain/fieldAgent.js';
import { requireAuth, requireCap } from './helpers.js';
import { requireFeature } from '../features.js';

export function register(app) {
  app.use('/api/vendors/:vendorId/claim', requireFeature('field_agents'));
  app.use('/api/me/field-agent', requireFeature('field_agents'));
  app.use('/api/ops/field-agents', requireFeature('field_agents'));
  app.use('/api/ops/field-agent-visits', requireFeature('field_agents'));
  app.use('/api/ops/field-agent-settlements', requireFeature('field_agents'));

  // Who currently holds this vendor's territory (the active full_registration
  // claim), or honest null when nobody does.
  app.get('/api/vendors/:vendorId/claim', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json({ claim: fieldAgent.vendorClaim(req.params.vendorId) });
  });

  // Claim a vendor (attribution only — a claim is not payable by itself).
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

  // RECORD A VISIT — the payable act. Arrives pending; an operator decides it.
  app.post('/api/me/field-agent/visits', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const visit = fieldAgent.recordVisit({
        agentId: me,
        vendorId: req.body?.vendorId,
        purpose: req.body?.purpose ?? 'full_registration',
        notes: req.body?.notes ?? ''
      });
      res.status(201).json({ visit });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Onboard a NEW vendor (create it + record the territory claim + the visit
  // the act is, atomically). This is the door-to-door agent's primary act:
  // bring a shop into Brief.
  app.post('/api/me/field-agent/onboard', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const result = fieldAgent.onboardVendor({
        agentId: me,
        displayName: req.body?.displayName,
        contactMethod: req.body?.contactMethod ?? null,
        contactName: req.body?.contactName ?? null,
        businessType: req.body?.businessType ?? null,
        location: req.body?.location ?? null,
        description: req.body?.description ?? '',
        claimType: req.body?.claimType ?? 'full_registration',
        notes: req.body?.notes ?? ''
      });
      res.status(201).json(result);
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // The member's own claims, visits, derived earnings and settlements. The
  // earnings carry the counts beside the money, so the figure is checkable.
  app.get('/api/me/field-agent', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({
      claims: fieldAgent.myClaims(me),
      visits: fieldAgent.myVisits(me),
      earnings: fieldAgent.visitEarnings(me),
      settlements: fieldAgent.listSettlements(me)
    });
  });

  // Request the weekly settlement for one week of approved visits (finance).
  app.post('/api/me/field-agent/settle', (req, res) => {
    const me = requireCap(req, res, 'finance');
    if (!me) return;
    try {
      const settlement = fieldAgent.requestWeeklySettlement(me, req.body?.week);
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

  // Operator queue of visits awaiting a decision (moderate). Approving a visit
  // is NOT moving money — it is saying the visit happened. The money still
  // waits for a finance-confirmed settlement.
  app.get('/api/ops/field-agent-visits', (req, res) => {
    if (!requireCap(req, res, 'moderate')) return;
    const status = req.query?.status;
    const visits = fieldAgent.listVisits();
    res.json({
      visits: status ? visits.filter((v) => v.status === String(status)) : visits,
      feeKes: fieldAgent.VISIT_FEE_KES
    });
  });

  app.post('/api/ops/field-agent-visits/:id/approve', (req, res) => {
    const me = requireCap(req, res, 'moderate');
    if (!me) return;
    try {
      const visit = fieldAgent.decideVisit(req.params.id, { accept: true, decidedBy: me });
      res.json({ visit });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  app.post('/api/ops/field-agent-visits/:id/reject', (req, res) => {
    const me = requireCap(req, res, 'moderate');
    if (!me) return;
    try {
      const visit = fieldAgent.decideVisit(req.params.id, {
        accept: false,
        note: req.body?.note ?? req.body?.reason ?? '',
        decidedBy: me
      });
      res.json({ visit });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Confirm a settlement (finance): the only place a visit fee becomes money.
  app.post('/api/ops/field-agent-settlements/:id/confirm', (req, res) => {
    const me = requireCap(req, res, 'finance');
    if (!me) return;
    try {
      const settlement = fieldAgent.confirmVisitSettlement(req.params.id, {
        accept: true, note: req.body?.note, confirmedBy: me
      });
      res.json({ settlement });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Refuse a settlement (finance): reverses the pending ledger entry.
  app.post('/api/ops/field-agent-settlements/:id/refuse', (req, res) => {
    if (!requireCap(req, res, 'finance')) return;
    try {
      const settlement = fieldAgent.confirmVisitSettlement(req.params.id, { accept: false, note: req.body?.note });
      res.json({ settlement });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });
}
