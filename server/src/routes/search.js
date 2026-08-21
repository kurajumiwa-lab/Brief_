// SEARCH ROUTE — cross-entity search (objects + Tea + vendors + collections).
import * as search from '../domain/search.js';
import { requireFeature } from '../features.js';

export function register(app) {
  app.use('/api/search', requireFeature('search'));

  app.get('/api/search', (req, res) => {
    res.json({ results: search.search(req.query.q ?? '') });
  });
}
