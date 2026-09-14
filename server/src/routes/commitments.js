// ---------------------------------------------------------------------------
// COMMITMENTS ROUTE — the user's derived reciprocal-obligation graph.
// ---------------------------------------------------------------------------

import * as commitments from '../domain/commitments.js';
import { requireAuth } from './helpers.js';

export function register(app) {
  app.get('/api/me/commitments', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ commitments: commitments.commitmentsFor(me) });
  });
}
