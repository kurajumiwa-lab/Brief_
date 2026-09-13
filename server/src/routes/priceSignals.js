// ---------------------------------------------------------------------------
// PRICE SIGNALS ROUTE — average listed prices, derived from real rows.
//
// Public (like GET /api/listings browse): it is the same information as
// browsing active listings, aggregated. Nothing here fabricates a price.
// ---------------------------------------------------------------------------

import * as priceSignals from '../domain/priceSignals.js';

export function register(app) {
  app.get('/api/price-signals', (_req, res) => {
    res.json(priceSignals.priceSignals());
  });
}
