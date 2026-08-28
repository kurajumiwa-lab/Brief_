// EPL CATALOG + LOBBY ROUTES (Tikiti T5).
//
// The catalog is public to read (a game must show its players) but only an
// operator seeds or syncs it, and provenance travels with every row.

import { callerId } from '../identity.js';
import * as epl from '../domain/epl.js';
import * as fantasy from '../domain/fantasy.js';
import { requireAuth, requireCap, recordAudit } from './helpers.js';

export function register(app) {
  app.get('/api/epl/clubs', (_req, res) => {
    res.json({ clubs: epl.EPL_CLUBS, provider: epl.providerStatus() });
  });

  app.get('/api/epl/catalog', (req, res) => {
    res.json({
      players: epl.catalogPlayers({ club: req.query?.club ?? null, position: req.query?.position ?? null }),
      provider: epl.providerStatus()
    });
  });

  app.post('/api/epl/catalog/seed', (req, res) => {
    const gate = requireCap(req, res, 'ops.run');
    if (!gate) return;
    const rows = epl.seedCatalog(req.body?.players);
    recordAudit('epl.catalog_seeded', {
      actorId: callerId(req),
      objectType: 'eplCatalog',
      after: { inserted: rows.length, source: 'seed' },
      reason: 'development catalog'
    });
    res.status(201).json({ inserted: rows.length, source: 'seed' });
  });

  app.post('/api/epl/catalog/sync', async (req, res) => {
    const gate = requireCap(req, res, 'ops.run');
    if (!gate) return;
    const result = await epl.syncFromProvider();
    // An unconfigured provider is not an error the operator caused; it is the
    // honest state of the deployment, reported plainly.
    res.status(result.ok ? 200 : 503).json(result);
  });

  app.post('/api/epl/competitions/:id/pool/import', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const imported = epl.importPool(req.params.id, me, { club: req.body?.club ?? null });
      res.status(201).json({ imported: imported.length });
    } catch (e) {
      res.status(e.code === 'catalog_empty' ? 409 : 400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/epl/competitions/:id/budget', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const c = epl.setBudget(me, req.params.id, req.body?.budgetKes);
      res.json({ competition: c });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/epl/competitions/:id/lobby', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const c = epl.setEntryBounds(me, req.params.id, {
        minEntries: req.body?.minEntries ?? null,
        maxEntries: req.body?.maxEntries ?? null
      });
      res.json({ competition: c, lobbyState: epl.lobbyStateOf(c) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  // The waiting-room wall: cancel underfilled rooms at lock, or lock a
  // filled one. Derived state comes back with it.
  app.post('/api/epl/competitions/:id/settle-lobby', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const result = epl.settleLobby(req.params.id);
      res.json({
        competition: result.competition,
        changed: result.changed,
        lobbyState: epl.lobbyStateOf(result.competition)
      });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  // Lobby state is derived everywhere a competition is read.
  const wrapped = (req, res) => {
    const c = fantasy.getCompetition(req.params.id);
    if (!c) return res.status(404).json({ error: 'competition not found' });
    res.json({ competition: c, lobbyState: epl.lobbyStateOf(c), entries: epl.entryCount(c.id) });
  };
  app.get('/api/epl/competitions/:id/lobby', (req, res) => {
    if (!requireAuth(req, res)) return;
    wrapped(req, res);
  });
}
