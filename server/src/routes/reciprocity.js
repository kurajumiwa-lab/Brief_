// ---------------------------------------------------------------------------
// RECIPROCITY ROUTE — the user's derived social-debt ledger.
// ---------------------------------------------------------------------------

import * as reciprocity from '../domain/reciprocity.js';
import { requireAuth } from './helpers.js';

export function register(app) {
  app.get('/api/me/reciprocity', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ reciprocity: reciprocity.reciprocityFor(me) });
  });
}
