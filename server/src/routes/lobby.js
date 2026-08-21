// LOBBY ROUTES — the 1-tap private-lobby code board (Arena integration).
import { callerId } from '../identity.js';
import * as lobby from '../domain/lobby.js';
import { requireAuth } from './helpers.js';
import { requireFeature } from '../features.js';

export function register(app) {
  app.use('/api/lobby', requireFeature('lobby'));

  /** Public board: open rooms for a game (or all). */
  app.get('/api/lobby/rooms', (req, res) => {
    const rows = lobby.listOpenRooms({ gameId: req.query.gameId ?? null });
    res.json({ rooms: rows.map(lobby.roomView) });
  });

  /** Host a room — the 1-tap lobby code. */
  app.post('/api/lobby/rooms', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const room = lobby.createRoom({ ...req.body, hostId: me });
      res.status(201).json({ room: lobby.roomView(room) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  /** Claim an open slot (the player is the caller). */
  app.post('/api/lobby/rooms/:id/claim', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const { room, reused } = lobby.claimSlot(req.params.id, me);
      res.json({ room: lobby.roomView(room), reused });
    } catch (e) {
      const msg = String(e.message ?? e);
      res.status(/full/.test(msg) ? 409 : /not found/.test(msg) ? 404 : 400).json({ error: msg });
    }
  });

  /** The host flags the room as started (code disappears). */
  app.post('/api/lobby/rooms/:id/start', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ room: lobby.roomView(lobby.startRoom(req.params.id, me)) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/lobby/rooms/:id/close', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ room: lobby.roomView(lobby.closeRoom(req.params.id, me)) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  /** Vouch a host (thumbs up/down). */
  app.post('/api/lobby/hosts/:hostId/vouch', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const v = lobby.vouchHost(req.params.hostId, me, req.body?.up !== false);
      res.json({ vouch: v, trust: lobby.hostTrust(req.params.hostId) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.get('/api/lobby/hosts/:hostId/trust', (req, res) => {
    res.json({ trust: lobby.hostTrust(req.params.hostId) });
  });

  /** Submit an endgame scoreboard receipt (honest: pending review). */
  app.post('/api/lobby/rooms/:id/scoreboard', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.status(201).json({
        receipt: lobby.recordScoreboard({ roomId: req.params.id, actorId: me, imageUrl: req.body?.imageUrl ?? null, note: req.body?.note ?? null })
      });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  // --- Clan matches ---------------------------------------------------------

  app.get('/api/lobby/clans', (req, res) => {
    res.json({ clans: lobby.listClanMatches({ status: req.query.status ?? null }) });
  });

  app.post('/api/lobby/clans', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.status(201).json({ clan: lobby.createClanMatch({ ...req.body, hostId: me }) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/lobby/clans/:id/:action', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ clan: lobby.transitionClan(req.params.id, req.params.action, me) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });
}
