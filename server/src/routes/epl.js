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

  // Rooms list. Open ones anyone may browse; the caller's own drafts included
  // so an organiser can find their room again. Every row carries its DERIVED
  // lobby state and a live entry count.
  app.get('/api/epl/competitions', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const rows = fantasy.listCompetitions({ status: null }).map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      kickoffAt: c.kickoffAt,
      budgetKes: c.budgetKes ?? null,
      minEntries: c.minEntries ?? null,
      maxEntries: c.maxEntries ?? null,
      createdBy: c.createdBy,
      mine: c.createdBy === me,
      lobbyState: epl.lobbyStateOf(c),
      entries: epl.entryCount(c.id)
    }));
    res.json({ competitions: rows });
  });

  /**
   * Create an EPL contest room. The bare /api/fantasy surface was removed
   * (F5); THIS is the creation route that survived -- EPL-shaped, with the
   * budget and the room bounds set at creation instead of after the fact.
   */
  app.post('/api/epl/competitions', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const c = fantasy.createCompetition({
        createdBy: me,
        title: req.body?.title,
        kickoffAt: req.body?.kickoffAt
      });
      if (req.body?.budgetKes != null) epl.setBudget(me, c.id, req.body.budgetKes);
      if (req.body?.minEntries != null || req.body?.maxEntries != null) {
        epl.setEntryBounds(me, c.id, {
          minEntries: req.body?.minEntries ?? null,
          maxEntries: req.body?.maxEntries ?? null
        });
      }
      const fresh = fantasy.getCompetition(c.id);
      res.status(201).json({ competition: fresh, lobbyState: epl.lobbyStateOf(fresh) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  /**
   * Seat a team. Delegates to the one fantasy engine (squad rules, club cap,
   * captain, server-clock lock) which already runs the EPL budget check; a
   * refusal carries the arithmetic.
   */
  app.post('/api/epl/competitions/:id/entries', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const result = fantasy.submitTeam(req.params.id, me, {
        playerIds: req.body?.playerIds,
        captainId: req.body?.captainId ?? null
      });
      const c = fantasy.getCompetition(req.params.id);
      res.status(result.created ? 201 : 200).json({
        ...result,
        lobbyState: epl.lobbyStateOf(c),
        entries: epl.entryCount(req.params.id)
      });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  /** Standings after scoring; public read like every other result. */
  app.get('/api/epl/competitions/:id/standings', (req, res) => {
    const c = fantasy.getCompetition(req.params.id);
    if (!c) return res.status(404).json({ error: 'competition not found' });
    const s = fantasy.standings(req.params.id);
    res.json({ competition: { id: c.id, title: c.title, status: c.status }, standings: s.standings ?? s });
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
