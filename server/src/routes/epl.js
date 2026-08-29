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

  // Rooms list. PUBLIC: browsing rooms is a read, not an act -- a signed-out
  // visitor sees the same rooms (creating a room and seating an XI still ask
  // for a session). Every row carries its DERIVED lobby state and a live
  // entry count; 'mine' is true only for the room's organiser.
  app.get('/api/epl/competitions', (req, res) => {
    const me = callerId(req);
    const rows = fantasy.listCompetitions({ status: null }).map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      // createdAt powers the sidebar's new-activity dot; it is the server's
      // own timestamp, never a client guess.
      createdAt: c.createdAt,
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
    // Same self-heal as the catalog read: feasibility arithmetic needs rows.
    epl.ensureCatalogSeeded();
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      // Validate EVERYTHING that can be validated before the room exists.
      // Creating the row and failing on its budget left a phantom room the
      // organiser was told had failed -- half a transaction is no transaction.
      const budget = req.body?.budgetKes != null ? Math.trunc(Number(req.body.budgetKes)) : null;
      if (req.body?.budgetKes != null) {
        if (!Number.isSafeInteger(budget) || budget <= 0) throw new Error('a budget is whole shillings above zero');
        epl.assertBudgetFeasible(null, budget); // catalog floor; the room has no pool yet
      }
      const c = fantasy.createCompetition({
        createdBy: me,
        title: req.body?.title,
        kickoffAt: req.body?.kickoffAt
      });
      if (budget != null) epl.setBudget(me, c.id, budget);
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
    // Self-heal: a genuinely empty catalog (fresh deploy, restored-empty
    // store) draws the clearly-tagged SEED roster so the game is playable.
    // No-op the moment the catalog has rows, whatever their source.
    epl.ensureCatalogSeeded();
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

  /**
   * A room's imported pool -- the rows a manager actually picks from. These
   * are DISTINCT from the catalog rows they were imported from (a pool row
   * belongs to its room), so the seat picker must read THIS endpoint, not the
   * catalog: submitting catalog ids was refused as 'unknown player'.
   */
  app.get('/api/epl/competitions/:id/pool', (req, res) => {
    const c = fantasy.getCompetition(req.params.id);
    if (!c) return res.status(404).json({ error: 'competition not found' });
    res.json({ players: fantasy.playerPool(req.params.id) });
  });

  app.post('/api/epl/competitions/:id/pool/import', (req, res) => {
    // Same self-heal as the catalog read: importing from an empty catalog
    // would otherwise seat nobody, ever.
    epl.ensureCatalogSeeded();
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const imported = epl.importPool(req.params.id, me, { club: req.body?.club ?? null });
      // OPEN THE ROOM. A draft room can never seat an XI (submitTeam refuses
      // drafts), and on this surface import IS the organiser saying "open for
      // picking". openCompetition re-checks organiser + pool sufficiency, so
      // this can never open an unplayable room. Without it every room stayed
      // a draft forever -- the dead-end screen.
      let opened = false;
      let openNote = null;
      if (fantasy.getCompetition(req.params.id)?.status === 'draft') {
        try {
          opened = Boolean(fantasy.openCompetition(req.params.id, me));
        } catch (e) {
          // The import SUCCEEDED; the room just cannot open yet (e.g. a club
          // filter left fewer than 11 players). Say why, keep it a draft the
          // organiser can top up with another import.
          openNote = String(e.message ?? e);
        }
      }
      res.status(201).json({ imported: imported.length, opened, openNote });
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
