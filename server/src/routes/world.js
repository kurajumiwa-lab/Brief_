// ---------------------------------------------------------------------------
// WORLD ROUTE — "what is moving in the world", read from a real provider.
//
// Public, like /api/pulse: a weather forecast is not personal data and there is
// nothing here to leak. The route never invents a fallback: the domain returns
// either facts with provenance or an error string, and this hands it through
// verbatim with a 200 so the surface can render the gap instead of a spinner.
// A 5xx would be a lie of the opposite kind — it would say Brief is broken when
// what is true is that a third party is unreachable.
// ---------------------------------------------------------------------------

import { worldSignal, DEFAULT_PLACE } from '../domain/worldSignal.js';

export function register(app) {
  app.get('/api/world', async (req, res) => {
    try {
      const place = typeof req.query?.place === 'string' ? req.query.place.slice(0, 80) : null;
      const out = await worldSignal({ place });
      res.json({ ok: out.available, defaultPlace: DEFAULT_PLACE.name, ...out });
    } catch (e) {
      // Defensive: the domain already swallows failures. If something else
      // throws, say that plainly rather than sending an empty board.
      res.status(500).json({ ok: false, available: false, facts: [], error: `the world could not be read: ${e.message}` });
    }
  });
}
