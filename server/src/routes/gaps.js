// ---------------------------------------------------------------------------
// GAPS ROUTES — the honest unmet-demand picture, derived from real rows.
//
// Operator-gated (moderate): unmet demand is market-wide economic
// intelligence, so it sits with the other ops surfaces (partners, field
// agents) rather than a public feed. Nothing here fabricates a gap.
// ---------------------------------------------------------------------------

import * as gaps from '../domain/gaps.js';
import { requireCap } from './helpers.js';

export function register(app) {
  app.get('/api/gaps', (req, res) => {
    if (!requireCap(req, res, 'moderate')) return;
    res.json(gaps.unmetDemand());
  });
}
