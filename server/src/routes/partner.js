// PARTNER ROUTES — first-class distribution partners (B2B2C infrastructure).
// Reads are operator-gated (moderate); creating a partner is an admin act;
// commercial terms and money movement are finance-gated. Every response is
// derived from real rows; nothing here fabricates a partner, a member count,
// or a shilling.
import * as partner from '../domain/partner.js';
import { requireCap } from './helpers.js';

export function register(app) {
  // List all partners with derived economics.
  app.get('/api/ops/partners', (req, res) => {
    if (!requireCap(req, res, 'moderate')) return;
    res.json({ partners: partner.listPartnerViews() });
  });

  // Create a partner (admin).
  app.post('/api/ops/partners', (req, res) => {
    const me = requireCap(req, res, 'admin');
    if (!me) return;
    try {
      const created = partner.createPartner({
        name: req.body?.name,
        partnerType: req.body?.partnerType,
        key: req.body?.key ?? null,
        operatorId: me
      });
      res.status(201).json({ partner: partner.partnerView(created.id) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Partner detail.
  app.get('/api/ops/partners/:id', (req, res) => {
    if (!requireCap(req, res, 'moderate')) return;
    const view = partner.partnerView(req.params.id);
    if (!view) return res.status(404).json({ error: 'partner not found', code: 'not_found' });
    res.json({ partner: view });
  });

  // Add a program to a partner (admin).
  app.post('/api/ops/partners/:id/programs', (req, res) => {
    if (!requireCap(req, res, 'admin')) return;
    try {
      const program = partner.createProgram(req.params.id, {
        key: req.body?.key ?? null,
        name: req.body?.name
      });
      res.status(201).json({ program });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Add a cohort to a program (admin).
  app.post('/api/ops/programs/:programId/cohorts', (req, res) => {
    if (!requireCap(req, res, 'admin')) return;
    try {
      const cohort = partner.createCohort(req.params.programId, {
        key: req.body?.key ?? null,
        name: req.body?.name
      });
      res.status(201).json({ cohort });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Set the revenue-share agreement (finance).
  app.post('/api/ops/partners/:id/agreement', (req, res) => {
    const me = requireCap(req, res, 'finance');
    if (!me) return;
    try {
      const agreement = partner.setAgreement(req.params.id, {
        shareRate: req.body?.shareRate,
        basis: req.body?.basis ?? 'verified_commercial'
      });
      res.status(201).json({ agreement });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Request a settlement for the partner's derived share (finance). The
  // obligation is snapshotted here; money moves only on confirmation.
  app.post('/api/ops/partners/:id/settlements', (req, res) => {
    const me = requireCap(req, res, 'finance');
    if (!me) return;
    try {
      const settlement = partner.requestSettlement(req.params.id, {
        from: req.body?.from ?? null,
        to: req.body?.to ?? null,
        operatorId: me
      });
      res.status(201).json({ settlement });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // List a partner's settlements (moderate).
  app.get('/api/ops/partners/:id/settlements', (req, res) => {
    if (!requireCap(req, res, 'moderate')) return;
    if (!partner.getPartner(req.params.id)) return res.status(404).json({ error: 'partner not found', code: 'not_found' });
    res.json({ settlements: partner.listSettlements(req.params.id) });
  });

  // Confirm a settlement (finance): the only place partner money becomes real.
  app.post('/api/ops/settlements/:id/confirm', (req, res) => {
    const me = requireCap(req, res, 'finance');
    if (!me) return;
    try {
      const settlement = partner.confirmSettlement(req.params.id, { operatorId: me, accept: true, note: req.body?.note });
      res.json({ settlement });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Refuse a settlement (finance): reverses the pending ledger entry.
  app.post('/api/ops/settlements/:id/refuse', (req, res) => {
    const me = requireCap(req, res, 'finance');
    if (!me) return;
    try {
      const settlement = partner.confirmSettlement(req.params.id, { operatorId: me, accept: false, note: req.body?.note });
      res.json({ settlement });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });
}
