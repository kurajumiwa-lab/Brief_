// SEARCH ROUTE — cross-entity search (objects + Tea + vendors + collections).
//
// Filters are optional and map to fields that already exist on the rows:
//   q          text across titles/summaries/locations
//   type       one of: event, business, offer, alert, announcement, news,
//              experience, place, opportunity, service, product, knowledge
//   location   a named locality (county/area/landmark/venue)
//   date       a canonical day YYYY-MM-DD (event day / deadline day)
//   source     a source id or source name
import * as search from '../domain/search.js';
import { requireFeature } from '../features.js';

function textParam(value, max = 80) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s.length > max ? null : s;
}

export function register(app) {
  app.use('/api/search', requireFeature('search'));

  app.get('/api/search', (req, res) => {
    const filters = {
      type: textParam(req.query.type, 32),
      location: textParam(req.query.location, 60),
      date: textParam(req.query.date, 10),
      source: textParam(req.query.source, 80)
    };
    // A filter value that is present but too long is an invalid query, not a
    // silent drop — the client should know the filter was refused.
    for (const [key, value] of Object.entries(filters)) {
      const raw = req.query[key];
      if (raw !== undefined && raw !== null && value === null && String(raw).trim() !== '') {
        return res.status(400).json({ error: `${key} filter is too long`, code: 'invalid_query' });
      }
    }
    res.json({ results: search.search(req.query.q ?? '', filters) });
  });
}
