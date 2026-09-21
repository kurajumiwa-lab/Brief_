// EVENTS HUB ROUTES (Tikiti T4) -- the browsing surface over the events that
// actually exist. Categories are campaign types. Decision 6 removed the rest of
// the knobs: no featured filter, no popularity sort, and no feature route, so
// the only order this endpoint serves is startsAt ascending. Enforced by
// server/test/decisions.mjs.

import * as events from '../domain/events.js';
// requireAuth and callerId went with the feature route and the viewer-scoped
// overlap; this endpoint now reads only the query string.

export function register(app) {
  app.get('/api/events', (req, res) => {
    try {
      const result = events.browseEvents({
        category: req.query?.category ?? null,
        location: req.query?.location ?? null,
        from: req.query?.from ?? null,
        to: req.query?.to ?? null,
        limit: Number(req.query?.limit) || 50
        // No `featured`, no `sort`, no `viewerId`: Decision 6 removed the
        // featured filter, the popularity sort and the circle overlap, so there
        // is nothing left for a query string to steer.
      });
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.get('/api/events/categories', (_req, res) => {
    res.json({ categories: events.EVENT_CATEGORIES, labels: events.CATEGORY_LABELS });
  });

  // NO POST /api/campaigns/:id/feature (Decision 6). The route used to let an
  // organiser feature their own event; the operator decided there is no
  // featured slot anywhere, so the route is retired rather than gated -- it
  // answers 404, and server/test/decisions.mjs fails if it comes back.
}
