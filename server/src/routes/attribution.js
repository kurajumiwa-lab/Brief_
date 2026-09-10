// ATTRIBUTION ROUTES — the provenance chain a member can see about themselves,
// and the derived cohort economics an operator can see about a partner slice.
import * as attribution from '../domain/attribution.js';
import { requireAuth, requireCap } from './helpers.js';
import { requireFeature } from '../features.js';

export function register(app) {
  app.use('/api/me/acquisition', requireFeature('attribution'));
  app.use('/api/ops/attribution', requireFeature('attribution'));

  // A member sees their own provenance chain and derived activity. Honest
  // null when no provenance was captured at sign-up.
  app.get('/api/me/acquisition', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const acq = attribution.acquisitionOf(me);
    res.json({
      acquisition: acq,
      provenance: attribution.provenanceChain(me),
      activity: attribution.economicActivityOf(me)
    });
  });

  // Operator surface: the derived, per-partner attribution report. Empty list
  // when no member arrived with provenance — never a fabricated number.
  app.get('/api/ops/attribution', (req, res) => {
    const me = requireCap(req, res, 'moderate');
    if (!me) return;
    res.json({ report: attribution.attributionReport() });
  });

  // Operator surface: aggregate a specific partner/program/cohort slice.
  app.get('/api/ops/attribution/cohort', (req, res) => {
    const me = requireCap(req, res, 'moderate');
    if (!me) return;
    res.json(attribution.cohortSummary({
      partnerKey: req.query.partner,
      programKey: req.query.program,
      cohortKey: req.query.cohort
    }));
  });
}
