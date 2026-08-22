// WIRE ROUTES — public Kenya + world headlines.
import { getWire } from '../domain/wire.js';

export function register(app) {
  app.get('/api/wire', async (_req, res) => {
    try {
      const wire = await getWire();
      res.json({ wire });
    } catch (e) {
      res.status(502).json({ error: String(e?.message ?? e) });
    }
  });
}
