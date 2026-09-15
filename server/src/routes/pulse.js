// ---------------------------------------------------------------------------
// PULSE ROUTE — "what is moving", derived from real rows.
//
// Public, like the price-signal aggregate: it exposes only counts over rows
// that are already browsable (published events, active listings, unmet demand
// headlines). No requester identities, no budgets, no private fields.
// ---------------------------------------------------------------------------

import { pulse } from '../domain/pulse.js';

export function register(app) {
  app.get('/api/pulse', (_req, res) => {
    res.json(pulse());
  });
}
