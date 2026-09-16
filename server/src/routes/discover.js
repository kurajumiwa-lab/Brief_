// ---------------------------------------------------------------------------
// DISCOVER SUMMARY ROUTE — tile counts and the featured slot, for the browse
// front door. Public like the events and listings browse rails it is built
// from: it exposes counts and the same fields a stranger can already see on a
// listing or an event. No viewer identity is required, and none is inferred.
// ---------------------------------------------------------------------------

import { discoverSummary } from '../domain/discoverSummary.js';
import { callerId } from '../identity.js';

export function register(app) {
  app.get('/api/discover/summary', (req, res) => {
    // The viewer is resolved from the session (never from a query string), so
    // "you could join" and "N from your circle" are honest per-person reads.
    res.json(discoverSummary({ viewerId: callerId(req) }));
  });
}
