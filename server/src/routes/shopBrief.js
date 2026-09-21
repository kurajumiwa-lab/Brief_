// ---------------------------------------------------------------------------
// THE MORNING BRIEF — the owner's own read of yesterday.
//
// Two doors, one rule: this route NEVER writes a business fact. It reads the
// rows the owner already made, and it stores exactly one thing the owner
// themselves chose — whether to be told, and at which hour.
//
// There is no edit, no delete and no share endpoint here on purpose. A brief the
// owner could adjust is a report; a brief that only reads rows is a record.
// ---------------------------------------------------------------------------

import { requireAuth } from './helpers.js';
import { getBriefPrefs, setBriefPrefs, shopBriefForOwner } from '../domain/shopBrief.js';

export function register(app) {
  /** Yesterday's brief, or a named day: `GET /api/shop-brief?day=YYYY-MM-DD`. */
  app.get('/api/shop-brief', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const brief = shopBriefForOwner(me, { day: req.query?.day ?? null });
      res.json({ brief });
    } catch (e) {
      const status = e.status ?? 400;
      res.status(status).json({ error: String(e.message ?? e) });
    }
  });

  /** The owner's own choice about being told. Unset until it is set. */
  app.get('/api/shop-brief/prefs', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ prefs: getBriefPrefs(me) });
  });

  app.put('/api/shop-brief/prefs', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const prefs = setBriefPrefs(me, {
        enabled: req.body?.enabled,
        hour: req.body?.hour ?? null
      });
      res.json({ prefs });
    } catch (e) {
      const status = e.status ?? 400;
      res.status(status).json({ error: String(e.message ?? e) });
    }
  });
}
