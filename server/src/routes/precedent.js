// ---------------------------------------------------------------------------
// PRECEDENT ROUTE — "does demand like this actually close?" Derived counts
// only: how many requests closed in the window, how long they took, and what
// the ACCEPTED offers were priced at. Session-gated, because it is market-wide
// aggregate intelligence, and it exposes no identity, no budget and no private
// field — only counts over rows and the arithmetic of accepted offer terms.
// ---------------------------------------------------------------------------

import { categoryClosure, movement, fillStats } from '../domain/precedent.js';
import { requireAuth } from './helpers.js';

export function register(app) {
  app.get('/api/precedent', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const category = typeof req.query?.category === 'string' && req.query.category.trim()
      ? req.query.category.trim().slice(0, 100)
      : null;
    res.json({
      category,
      closure: categoryClosure(),
      fill: fillStats({ category }),
      movement: movement(),
      note: 'Derived from real rows on read. A category with no closed request reports 0 closed and null averages — that is the absence of evidence, not a score.'
    });
  });
}
