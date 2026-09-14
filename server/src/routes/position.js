// ---------------------------------------------------------------------------
// POSITION ROUTE — the user's derived position in time (decay, missed, open).
// ---------------------------------------------------------------------------

import * as position from '../domain/position.js';
import { requireAuth } from './helpers.js';

export function register(app) {
  app.get('/api/me/position', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ position: position.positionFor(me) });
  });
}
