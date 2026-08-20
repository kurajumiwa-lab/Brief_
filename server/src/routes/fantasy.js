// FANTASY ROUTES — extracted from index.js (zero behaviour change).
// Each route keeps its original body verbatim; only its home file changed.
import * as fantasy from '../domain/fantasy.js';
import * as compliance from '../domain/compliance.js';
import { requireAuth } from './helpers.js';

export function register(app) {
// --- Fantasy 11 ----------------------------------------------------------------
//
// The non-economic core. Paid entry inherits the SAME compliance gate as
// paid Arena contests -- see POST /api/fantasy/competitions/:id/paid-entry.


app.get('/api/fantasy/rules', (_req, res) => {
  // Published so a participant can verify their own score by hand.
  res.json({ squad: fantasy.SQUAD_RULES, scoring: fantasy.SCORING_RULES, positions: fantasy.POSITIONS });
});



app.get('/api/fantasy/competitions', (req, res) => {
  res.json({ competitions: fantasy.listCompetitions({ status: req.query.status ?? null }) });
});



app.post('/api/fantasy/competitions', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.status(201).json({
      competition: fantasy.createCompetition({
        createdBy: me,
        title: req.body?.title,
        description: req.body?.description ?? '',
        kickoffAt: req.body?.kickoffAt,
        fixtures: req.body?.fixtures ?? []
      })
    });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});



app.get('/api/fantasy/competitions/:id', (req, res) => {
  const c = fantasy.getCompetition(req.params.id);
  if (!c) return res.status(404).json({ error: 'competition not found' });
  res.json({
    competition: c,
    pool: fantasy.playerPool(c.id),
    locked: fantasy.isLocked(c),
    entryCount: fantasy.listEntries(c.id).length
  });
});



app.post('/api/fantasy/competitions/:id/players', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.status(201).json({
      player: fantasy.addPoolPlayer(req.params.id, me, {
        name: req.body?.name, position: req.body?.position,
        club: req.body?.club, price: req.body?.price ?? 0
      })
    });
  } catch (e) {
    const msg = String(e.message ?? e);
    res.status(/not found/i.test(msg) ? 404 : /only the organiser/i.test(msg) ? 403 : 400).json({ error: msg });
  }
});



app.post('/api/fantasy/competitions/:id/open', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.json({ competition: fantasy.openCompetition(req.params.id, me) });
  } catch (e) {
    const msg = String(e.message ?? e);
    res.status(/not found/i.test(msg) ? 404 : /only the organiser/i.test(msg) ? 403 : 400).json({ error: msg });
  }
});


/** Submit or replace a team. Refused after the server-side lock. */

app.post('/api/fantasy/competitions/:id/entries', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const { entry, created } = fantasy.submitTeam(req.params.id, me, {
      playerIds: req.body?.playerIds, captainId: req.body?.captainId
    });
    res.status(created ? 201 : 200).json({ entry, created });
  } catch (e) {
    const msg = String(e.message ?? e);
    res.status(/not found/i.test(msg) ? 404 : 400).json({ error: msg, problems: e.problems ?? null });
  }
});


/** Your own entry. Other people's teams stay hidden until lock. */

app.get('/api/fantasy/competitions/:id/entries/me', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const entry = fantasy.getEntry(req.params.id, me);
  if (!entry) return res.status(404).json({ error: 'you have no entry in this competition' });
  res.json({ entry });
});



app.post('/api/fantasy/competitions/:id/stats', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.json({
      stats: fantasy.recordStats(req.params.id, me, req.body?.playerId, req.body?.stats ?? {})
    });
  } catch (e) {
    const msg = String(e.message ?? e);
    res.status(/not found|unknown player/i.test(msg) ? 404 : /only the organiser/i.test(msg) ? 403 : 400).json({ error: msg });
  }
});



app.post('/api/fantasy/competitions/:id/score', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.json(fantasy.scoreCompetition(req.params.id, me));
  } catch (e) {
    const msg = String(e.message ?? e);
    res.status(/not found/i.test(msg) ? 404 : /only the organiser/i.test(msg) ? 403 : 400).json({ error: msg });
  }
});



app.get('/api/fantasy/competitions/:id/standings', (req, res) => {
  const c = fantasy.getCompetition(req.params.id);
  if (!c) return res.status(404).json({ error: 'competition not found' });
  res.json({ standings: fantasy.standings(c.id), status: c.status });
});


/**
 * PAID fantasy entry.
 *
 * Inherits the identical compliance gate as paid Arena contests -- one gate,
 * one set of requirements, no second-class check that could drift.
 */

app.post('/api/fantasy/competitions/:id/paid-entry', (req, res) => {
  const refusal = compliance.refuseIfUnlicensed();
  if (refusal) return res.status(403).json(refusal);
  return res.status(501).json({ error: 'paid fantasy entry is not implemented' });
});
}

