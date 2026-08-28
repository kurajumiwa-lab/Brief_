// ---------------------------------------------------------------------------
// LIGI ROUTES — African fantasy football.
//
// Reads are open (a leaderboard nobody can see is not a leaderboard). Every
// write requires a real identity. The cash seat is refused here with the same
// compliance payload every other paid surface returns — one gate, one answer.
// ---------------------------------------------------------------------------

import * as ligi from '../domain/ligi.js';
import * as fantasy from '../domain/fantasy.js';
import { callerId } from '../identity.js';
import { requireAuth, requireCap, recordAudit } from './helpers.js';
import { requireFeature } from '../features.js';

const statusFor = (msg) =>
  /not found/i.test(msg) ? 404 : /only the organiser|not authorised/i.test(msg) ? 403 : 400;

export function register(app) {
  app.use('/api/ligi', requireFeature('ligi'));

  /** Everything the game screen needs, in one call. */
  app.get('/api/ligi', (req, res) => {
    res.json(ligi.overview(callerId(req), { seasonId: req.query.season ?? null }));
  });

  /** The rules, published so a manager can recompute their own week by hand. */
  app.get('/api/ligi/rules', (_req, res) => {
    res.json({
      house: ligi.HOUSE_RULES,
      squad: fantasy.SQUAD_RULES,
      scoring: fantasy.SCORING_RULES,
      leagues: ligi.LEAGUES,
      slots: ligi.SLOTS,
      note: 'Units are a scoring device with no cash value. Cash seats are refused until this deployment is licensed.'
    });
  });

  app.get('/api/ligi/seasons', (req, res) => {
    res.json({
      seasons: ligi.listSeasons({
        status: req.query.status ?? null,
        leagueId: req.query.league ?? null
      })
    });
  });

  /** Open a season over a real African league. Gameweeks are scheduled here. */
  app.post('/api/ligi/seasons', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.status(201).json(ligi.createSeason({
        createdBy: me,
        leagueId: req.body?.leagueId,
        name: req.body?.name ?? null,
        startsAt: req.body?.startsAt,
        gameweeks: req.body?.gameweeks ?? 10,
        cashSlotPriceKes: req.body?.cashSlotPriceKes ?? 0
      }));
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e), leagues: ligi.LEAGUES });
    }
  });

  app.get('/api/ligi/seasons/:id', (req, res) => {
    const season = ligi.getSeason(req.params.id);
    if (!season) return res.status(404).json({ error: 'season not found' });
    res.json({
      season,
      gameweeks: ligi.gameweeksOf(season.id),
      table: ligi.seasonTable(season.id),
      streaks: ligi.streakTable(season.id)
    });
  });

  app.get('/api/ligi/gameweeks/:id', (req, res) => {
    const view = ligi.gameweekView(req.params.id, callerId(req));
    if (!view) return res.status(404).json({ error: 'gameweek not found' });
    res.json(view);
  });

  /** Take a seat. `slot: 'cash'` is refused with the requirement list. */
  app.post('/api/ligi/gameweeks/:id/enter', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const { entry, created } = ligi.enter(req.params.id, me, { slot: req.body?.slot ?? 'free' });
      res.status(created ? 201 : 200).json({ entry, created });
    } catch (e) {
      if (e.code === 'compliance_gate') {
        return res.status(403).json({ error: String(e.message), ...e.compliance });
      }
      if (e.code === 'not_implemented') {
        return res.status(501).json({ error: String(e.message) });
      }
      const msg = String(e.message ?? e);
      res.status(statusFor(msg)).json({ error: msg });
    }
  });

  /** Pick the eleven. Delegated to Fantasy 11, lock and all. */
  app.post('/api/ligi/gameweeks/:id/team', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const { entry, created } = ligi.submitTeam(req.params.id, me, {
        playerIds: req.body?.playerIds,
        captainId: req.body?.captainId
      });
      res.status(created ? 201 : 200).json({ team: entry, created });
    } catch (e) {
      const msg = String(e.message ?? e);
      res.status(statusFor(msg)).json({ error: msg, problems: e.problems ?? null });
    }
  });

  /** Stake units against the house line. Closed at kickoff. */
  app.post('/api/ligi/gameweeks/:id/wagers', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const wager = ligi.placeWager(req.params.id, me, req.body ?? {});
      res.status(201).json({
        wager,
        unitsRemaining: ligi.HOUSE_RULES.weeklyUnits -
          ligi.wagersOf(req.params.id, me).reduce((sum, w) => sum + w.units, 0)
      });
    } catch (e) {
      const msg = String(e.message ?? e);
      res.status(statusFor(msg)).json({ error: msg });
    }
  });

  app.get('/api/ligi/gameweeks/:id/lines', (req, res) => {
    const gw = ligi.getGameweek(req.params.id);
    if (!gw) return res.status(404).json({ error: 'gameweek not found' });
    res.json({
      lines: gw.houseLines ?? ligi.deriveHouseLines(gw.id),
      frozen: Boolean(gw.houseLines),
      basis: 'median of the player\'s settled gameweeks this season, else the published position baseline'
    });
  });

  /**
   * Run the automated pass.
   *
   * The same function the interval calls. Exposed because a deployment without
   * a long-lived process (or a test) still needs the game to move, and because
   * an automated system you cannot trigger is an automated system you cannot
   * debug. It is idempotent, so calling it is never destructive.
   */
  app.post('/api/ligi/tick', (req, res) => {
    // Operator: Ligi operates itself from the system clock (§15). A manual
    // tick is an operator/debug affordance, not a player action.
    if (!requireCap(req, res, 'ops.run')) return;
    const result = ligi.tick();
    recordAudit('ligi.tick', { actorId: callerId(req), objectType: 'ligi', after: { gameweeks: Array.isArray(result?.gameweeks) ? result.gameweeks.length : null } });
    res.json(result);
  });
}
