// ---------------------------------------------------------------------------
// LIGI — African fantasy football, run by the house, settled by itself.
//
// WHAT THIS IS.
//
// A fantasy football game whose competitions are AFRICAN: the CAF club
// competitions and the domestic leagues people here actually follow. Two
// ladders run over the same weeks —
//
//   SEASON   cumulative points and net units across every gameweek;
//   STREAK   consecutive gameweeks won, so a manager who joins in week 9 still
//            has something live to chase.
//
// and two slots run over the same game —
//
//   FREE     the full product, staked in UNITS. Units are a scoring device:
//            100 per gameweek, non-transferable, no cash value, and they do
//            not roll over. Nothing is bought and nothing is paid out.
//   CASH     real-money entry. Structurally present and priced, and REFUSED by
//            the same compliance gate as paid Arena until this deployment has
//            a licence. Brief does not hold a stake it cannot legally hold.
//
// WHY IT REUSES FANTASY 11 RATHER THAN FORKING IT.
//
// Every gameweek is backed by a real `fantasyCompetitions` row. Squad rules,
// the lock, the pool, and `scorePlayer()` all come from domain/fantasy.js.
// There is exactly ONE scoring engine in Brief; a second one would be a second
// source of truth about what a goal is worth.
//
// THE HOUSE, WITHOUT A COMMISSIONER.
//
// The blueprint this is modelled on has a commissioner who sets the weekly
// lines by hand. That does not survive contact with an automated product, so
// the line is DERIVED: the median of a player's own recent gameweek scores,
// falling back to a published per-position baseline when they have no history.
// Same inputs, same lines, every time — and a manager can recompute them.
//
// AUTOMATION, AND ITS HONEST LIMIT.
//
// `tick()` opens, locks, prices, settles and advances everything with no human
// input, and is idempotent — running it twice changes nothing the second time.
// What it will NOT do is invent a result. A gameweek whose match stats have
// not arrived stays `awaiting_results` and says how many players are missing.
// An automated game that fabricates scores is not automated, it is fiction.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import * as fantasy from './fantasy.js';
import * as compliance from './compliance.js';

// ---------------------------------------------------------------------------
// REFERENCE DATA — real competitions, named plainly
// ---------------------------------------------------------------------------

export const LEAGUES = [
  { id: 'caf_cl',     name: 'CAF Champions League',            country: 'Africa',       tier: 'continental' },
  { id: 'caf_cc',     name: 'CAF Confederation Cup',           country: 'Africa',       tier: 'continental' },
  { id: 'ke_fkf_pl',  name: 'FKF Premier League',              country: 'Kenya',        tier: 'domestic' },
  { id: 'tz_nbc',     name: 'NBC Premier League',              country: 'Tanzania',     tier: 'domestic' },
  { id: 'ug_upl',     name: 'Uganda Premier League',           country: 'Uganda',       tier: 'domestic' },
  { id: 'ng_npfl',    name: 'Nigeria Premier Football League', country: 'Nigeria',      tier: 'domestic' },
  { id: 'gh_gpl',     name: 'Ghana Premier League',            country: 'Ghana',        tier: 'domestic' },
  { id: 'za_psl',     name: 'South African Premiership',       country: 'South Africa', tier: 'domestic' },
  { id: 'eg_epl',     name: 'Egyptian Premier League',         country: 'Egypt',        tier: 'domestic' },
  { id: 'ma_botola',  name: 'Botola Pro',                      country: 'Morocco',      tier: 'domestic' },
  { id: 'zm_super',   name: 'Zambia Super League',             country: 'Zambia',       tier: 'domestic' },
  { id: 'sn_ligue1',  name: 'Ligue 1 Sénégal',                 country: 'Senegal',      tier: 'domestic' }
];

export function getLeague(id) {
  return LEAGUES.find((l) => l.id === id) ?? null;
}

/** The house rules, published as data so a manager can audit their own week. */
export const HOUSE_RULES = {
  weeklyUnits: 100,
  rollover: false,
  modes: ['over_under', 'spread', 'confidence'],
  payout: { over_under: '1:1', spread: '1:1', confidence: 'points-weighted' },
  spreadHandicapStep: 0.5,
  // Used only when a player has no scored history yet. Published, not hidden.
  baselineLine: { GK: 2.5, DEF: 3.5, MID: 4.5, FWD: 4.5 },
  lineHistoryWindow: 5,
  streakWinRule: 'net units above zero AND team points at or above the gameweek median',
  unitsAreNotMoney: true
};

export const SLOTS = ['free', 'cash'];
export const GAMEWEEK_STATUS = ['scheduled', 'open', 'locked', 'awaiting_results', 'settled', 'void'];
export const SEASON_STATUS = ['upcoming', 'running', 'complete'];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const OPEN_LEAD_MS = 3 * 24 * 60 * 60 * 1000; // entries open three days before kickoff
const iso = (ms) => new Date(ms).toISOString();

// ---------------------------------------------------------------------------
// SEASONS AND GAMEWEEKS
// ---------------------------------------------------------------------------

/**
 * Create a season and schedule every one of its gameweeks up front.
 *
 * Scheduling happens here, once, so the automated tick never has to decide
 * WHEN anything happens — only whether the clock has passed it.
 */
export function createSeason({
  createdBy, leagueId, name = null, startsAt, gameweeks = 10, cashSlotPriceKes = 0
}) {
  if (!createdBy) throw new Error('a creator is required');
  const league = getLeague(leagueId);
  if (!league) throw new Error(`unknown league: ${leagueId}`);
  const start = Date.parse(startsAt);
  if (!Number.isFinite(start)) throw new Error('a valid startsAt is required');
  const count = Math.floor(Number(gameweeks));
  if (!Number.isFinite(count) || count < 1 || count > 38) {
    throw new Error('a season runs between 1 and 38 gameweeks');
  }

  const now = new Date().toISOString();
  const season = store.insert('ligiSeasons', {
    id: newId('lseas'),
    createdBy,
    leagueId,
    leagueName: league.name,
    country: league.country,
    name: String(name ?? `${league.name} Fantasy`).trim().slice(0, 120),
    startsAt: iso(start),
    endsAt: iso(start + (count - 1) * WEEK_MS),
    gameweekCount: count,
    // A price is a STATEMENT of what a cash seat would cost. It is never
    // charged: the compliance gate refuses the seat before money is discussed.
    cashSlotPriceKes: Number.isFinite(Number(cashSlotPriceKes)) ? Math.max(0, Math.floor(cashSlotPriceKes)) : 0,
    status: 'upcoming',
    createdAt: now,
    updatedAt: now
  });

  for (let i = 1; i <= count; i++) {
    const kickoff = start + (i - 1) * WEEK_MS;
    const competition = fantasy.createCompetition({
      createdBy,
      title: `${season.name} — Gameweek ${i}`,
      description: `${league.name} (${league.country}) fantasy gameweek ${i}. Scored by Brief's one fantasy engine.`,
      kickoffAt: iso(kickoff)
    });
    store.insert('ligiGameweeks', {
      id: newId('lgw'),
      seasonId: season.id,
      competitionId: competition.id,
      index: i,
      opensAt: iso(kickoff - OPEN_LEAD_MS),
      kickoffAt: iso(kickoff),
      // Results are expected to have landed two days after kickoff. Passing
      // that point does not settle anything — it only makes the wait visible.
      resultsDueAt: iso(kickoff + 2 * 24 * 60 * 60 * 1000),
      status: 'scheduled',
      houseLines: null,
      settledAt: null,
      createdAt: now,
      updatedAt: now
    });
  }

  return { season, gameweeks: gameweeksOf(season.id) };
}

export function getSeason(id) {
  return store.find('ligiSeasons', (s) => s.id === id);
}

export function listSeasons({ status = null, leagueId = null } = {}) {
  return store.all('ligiSeasons').filter(
    (s) => (!status || s.status === status) && (!leagueId || s.leagueId === leagueId)
  );
}

export function gameweeksOf(seasonId) {
  return store
    .filter('ligiGameweeks', (g) => g.seasonId === seasonId)
    .sort((a, b) => a.index - b.index);
}

export function getGameweek(id) {
  return store.find('ligiGameweeks', (g) => g.id === id);
}

/** The gameweek a manager should be looking at right now. */
export function currentGameweek(seasonId, now = Date.now()) {
  const weeks = gameweeksOf(seasonId);
  return (
    weeks.find((g) => g.status === 'open') ??
    weeks.find((g) => g.status === 'locked' || g.status === 'awaiting_results') ??
    weeks.find((g) => Date.parse(g.kickoffAt) > now) ??
    weeks[weeks.length - 1] ??
    null
  );
}

// ---------------------------------------------------------------------------
// SLOTS AND ENTRY
// ---------------------------------------------------------------------------

/**
 * Take a seat in a gameweek.
 *
 * The free seat is the whole game. The cash seat is refused here — not hidden,
 * not disabled in a client, REFUSED — with the same requirement list every
 * other paid surface in Brief reports.
 */
export function enter(gameweekId, userId, { slot = 'free' } = {}) {
  if (!userId) throw new Error('a manager is required');
  if (!SLOTS.includes(slot)) throw new Error(`slot must be one of ${SLOTS.join(', ')}`);
  const gw = getGameweek(gameweekId);
  if (!gw) throw new Error('gameweek not found');
  if (gw.status === 'scheduled') throw new Error('this gameweek has not opened yet');
  if (gw.status !== 'open') throw new Error(`this gameweek is ${gw.status}`);

  if (slot === 'cash') {
    const refusal = compliance.refuseIfUnlicensed();
    if (refusal) {
      const err = new Error('cash entry is not available on this deployment');
      err.compliance = refusal;
      err.code = 'compliance_gate';
      throw err;
    }
    // Licensed deployments still have no implemented cash rail here. Saying
    // so is better than a seat that silently behaves like a free one.
    const err = new Error('cash entry is licensed but not implemented');
    err.code = 'not_implemented';
    throw err;
  }

  const existing = store.find('ligiEntries', (e) => e.gameweekId === gameweekId && e.userId === userId);
  if (existing) return { entry: existing, created: false };

  const now = new Date().toISOString();
  return {
    entry: store.insert('ligiEntries', {
      id: newId('lent'),
      seasonId: gw.seasonId,
      gameweekId,
      userId,
      slot: 'free',
      stakeKind: 'units',
      unitsBankroll: HOUSE_RULES.weeklyUnits,
      // Filled by settlement, never by a client.
      teamPoints: null,
      unitsStaked: 0,
      unitsReturned: null,
      netUnits: null,
      won: null,
      settledAt: null,
      createdAt: now,
      updatedAt: now
    }),
    created: true
  };
}

export function getEntry(gameweekId, userId) {
  return store.find('ligiEntries', (e) => e.gameweekId === gameweekId && e.userId === userId);
}

export function entriesOf(gameweekId) {
  return store.filter('ligiEntries', (e) => e.gameweekId === gameweekId);
}

/** Pick the eleven. Delegated whole to Fantasy 11, lock included. */
export function submitTeam(gameweekId, userId, { playerIds, captainId }) {
  const gw = getGameweek(gameweekId);
  if (!gw) throw new Error('gameweek not found');
  if (!getEntry(gameweekId, userId)) throw new Error('take a seat in this gameweek first');
  return fantasy.submitTeam(gw.competitionId, userId, { playerIds, captainId });
}

// ---------------------------------------------------------------------------
// THE HOUSE LINE — derived, never dictated
// ---------------------------------------------------------------------------

/** Round to the nearest half point, so a line can never be exactly tied. */
function toHalfLine(value) {
  const rounded = Math.round(value * 2) / 2;
  return Number.isInteger(rounded) ? rounded + 0.5 : rounded;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * What has this player scored in this season's already-settled gameweeks?
 *
 * Matched by NAME AND CLUB, because each gameweek has its own pool rows: the
 * same human being is a different `fantasyPlayers` id every week.
 */
export function playerHistory(seasonId, name, club, { before = Infinity } = {}) {
  const weeks = gameweeksOf(seasonId).filter((g) => g.status === 'settled' && g.index < before);
  const points = [];
  for (const gw of weeks) {
    const player = store.find(
      'fantasyPlayers',
      (p) => p.competitionId === gw.competitionId && p.name === name && p.club === club
    );
    if (!player) continue;
    const stat = store.find(
      'fantasyStats',
      (s) => s.competitionId === gw.competitionId && s.playerId === player.id
    );
    if (!stat) continue;
    points.push(fantasy.scorePlayer(player.position, stat.stats).points);
  }
  return points;
}

/**
 * The lines for one gameweek, one per pool player.
 *
 * Pure over (pool, settled history, baselines): no clock, no randomness, no
 * commissioner. Every line carries the basis it came from so a manager can
 * check it rather than trust it.
 */
export function deriveHouseLines(gameweekId) {
  const gw = getGameweek(gameweekId);
  if (!gw) throw new Error('gameweek not found');
  const pool = fantasy.playerPool(gw.competitionId);

  return pool
    .map((player) => {
      const history = playerHistory(gw.seasonId, player.name, player.club, { before: gw.index })
        .slice(-HOUSE_RULES.lineHistoryWindow);
      const mid = median(history);
      const line = mid === null
        ? HOUSE_RULES.baselineLine[player.position]
        : toHalfLine(mid);
      return {
        playerId: player.id,
        name: player.name,
        position: player.position,
        club: player.club,
        line,
        basis: mid === null ? 'position_baseline' : `median_of_${history.length}`,
        history
      };
    })
    .sort((a, b) => a.playerId.localeCompare(b.playerId));
}

export function lineFor(gameweek, playerId) {
  return (gameweek.houseLines ?? []).find((l) => l.playerId === playerId) ?? null;
}

// ---------------------------------------------------------------------------
// WAGERS — in units, against the house
// ---------------------------------------------------------------------------

/**
 * Place a wager for the week.
 *
 * Refused after the lock, refused past the 100-unit bankroll, refused against
 * a player who is not in the pool. A manager may place several as long as the
 * total fits; the bankroll is the whole constraint.
 */
export function placeWager(gameweekId, userId, wager = {}) {
  const gw = getGameweek(gameweekId);
  if (!gw) throw new Error('gameweek not found');
  const entry = getEntry(gameweekId, userId);
  if (!entry) throw new Error('take a seat in this gameweek first');
  const competition = fantasy.getCompetition(gw.competitionId);
  if (fantasy.isLocked(competition)) throw new Error('this gameweek is locked; wagers are closed');

  const mode = String(wager.mode ?? '');
  if (!HOUSE_RULES.modes.includes(mode)) {
    throw new Error(`mode must be one of ${HOUSE_RULES.modes.join(', ')}`);
  }
  const units = Math.floor(Number(wager.units));
  if (!Number.isFinite(units) || units <= 0) throw new Error('units must be a positive whole number');

  const alreadyStaked = wagersOf(gameweekId, userId).reduce((sum, w) => sum + w.units, 0);
  if (alreadyStaked + units > HOUSE_RULES.weeklyUnits) {
    throw new Error(
      `that would stake ${alreadyStaked + units} of ${HOUSE_RULES.weeklyUnits} units; ${HOUSE_RULES.weeklyUnits - alreadyStaked} remain`
    );
  }

  const row = {
    id: newId('lwag'),
    gameweekId,
    seasonId: gw.seasonId,
    userId,
    mode,
    units,
    // Filled by settlement only.
    settled: false,
    outcome: null,
    unitsReturned: null,
    detail: null,
    createdAt: new Date().toISOString()
  };

  if (mode === 'over_under') {
    const player = store.find('fantasyPlayers', (p) => p.id === wager.playerId && p.competitionId === gw.competitionId);
    if (!player) throw new Error('unknown player for this gameweek');
    const side = String(wager.side ?? '');
    if (side !== 'over' && side !== 'under') throw new Error("side must be 'over' or 'under'");
    row.playerId = player.id;
    row.side = side;
  } else if (mode === 'spread') {
    const player = store.find('fantasyPlayers', (p) => p.id === wager.playerId && p.competitionId === gw.competitionId);
    if (!player) throw new Error('unknown player for this gameweek');
    const opponent = store.find(
      'fantasyPlayers',
      (p) => p.id === wager.opponentPlayerId && p.competitionId === gw.competitionId
    );
    if (!opponent) throw new Error('unknown opponent player for this gameweek');
    if (opponent.id === player.id) throw new Error('a player cannot be spread against themselves');
    row.playerId = player.id;
    row.opponentPlayerId = opponent.id;
  } else {
    // confidence: units ride on the manager's own eleven, weighted by points.
    const teamEntry = fantasy.getEntry(gw.competitionId, userId);
    if (!teamEntry) throw new Error('pick your eleven before staking on it');
  }

  return store.insert('ligiWagers', row);
}

export function wagersOf(gameweekId, userId = null) {
  return store.filter(
    'ligiWagers',
    (w) => w.gameweekId === gameweekId && (!userId || w.userId === userId)
  );
}

/**
 * The spread handicap between two players, derived from their lines.
 *
 * The favourite gives away the difference, rounded to the published step. No
 * one sets this by hand either.
 */
export function spreadHandicap(gameweek, playerId, opponentPlayerId) {
  const mine = lineFor(gameweek, playerId);
  const theirs = lineFor(gameweek, opponentPlayerId);
  if (!mine || !theirs) return 0;
  const raw = mine.line - theirs.line;
  const step = HOUSE_RULES.spreadHandicapStep;
  return Math.round(raw / step) * step;
}

// ---------------------------------------------------------------------------
// SETTLEMENT — deterministic, repeatable, and never invented
// ---------------------------------------------------------------------------

/** Are the match stats for this gameweek complete enough to settle? */
export function resultsReadiness(gameweekId) {
  const gw = getGameweek(gameweekId);
  if (!gw) throw new Error('gameweek not found');
  const pool = fantasy.playerPool(gw.competitionId);
  const picked = new Set();
  for (const entry of fantasy.listEntries(gw.competitionId)) {
    for (const id of entry.playerIds) picked.add(id);
  }
  const needed = picked.size ? [...picked] : pool.map((p) => p.id);
  const have = fantasy.statsFor(gw.competitionId);
  const missing = needed.filter((id) => !have.has(id));
  return {
    ready: needed.length > 0 && missing.length === 0,
    needed: needed.length,
    missing: missing.length,
    reason: needed.length === 0
      ? 'no players have been picked, so there is nothing to score'
      : missing.length
      ? `match stats for ${missing.length} of ${needed.length} picked players have not arrived`
      : null
  };
}

function settleWager(gw, wager, pointsByPlayer, teamPointsByUser) {
  if (wager.mode === 'over_under') {
    const line = lineFor(gw, wager.playerId);
    const scored = pointsByPlayer.get(wager.playerId) ?? 0;
    const overHit = scored > line.line;
    const won = wager.side === 'over' ? overHit : !overHit;
    return {
      outcome: won ? 'won' : 'lost',
      unitsReturned: won ? wager.units * 2 : 0,
      detail: { line: line.line, scored, side: wager.side }
    };
  }

  if (wager.mode === 'spread') {
    const handicap = spreadHandicap(gw, wager.playerId, wager.opponentPlayerId);
    const mine = pointsByPlayer.get(wager.playerId) ?? 0;
    const theirs = pointsByPlayer.get(wager.opponentPlayerId) ?? 0;
    const margin = mine - theirs - handicap;
    const outcome = margin > 0 ? 'won' : margin < 0 ? 'lost' : 'push';
    return {
      outcome,
      unitsReturned: outcome === 'won' ? wager.units * 2 : outcome === 'push' ? wager.units : 0,
      detail: { handicap, mine, theirs, margin }
    };
  }

  // CONFIDENCE STACK. The units ride on the manager's own eleven: the return
  // is the stake scaled by how the team did against the week's median team.
  // A median-performing team gets its stake back; nothing is created from
  // nothing.
  const mine = teamPointsByUser.get(wager.userId) ?? 0;
  const par = teamPointsByUser.par;
  const ratio = par > 0 ? mine / par : mine > 0 ? 2 : 0;
  const returned = Math.round(wager.units * Math.max(0, Math.min(2, ratio)));
  return {
    outcome: returned > wager.units ? 'won' : returned < wager.units ? 'lost' : 'push',
    unitsReturned: returned,
    detail: { teamPoints: mine, par, ratio: Number(ratio.toFixed(3)) }
  };
}

/**
 * Settle a gameweek: score the teams, settle every wager, record the result.
 *
 * Idempotent. Refuses rather than guesses when the stats are incomplete.
 */
export function settleGameweek(gameweekId) {
  const gw = getGameweek(gameweekId);
  if (!gw) throw new Error('gameweek not found');
  if (gw.status === 'settled') return { gameweekId, alreadySettled: true, settledAt: gw.settledAt };

  const readiness = resultsReadiness(gameweekId);
  if (!readiness.ready) {
    return { gameweekId, settled: false, awaiting: true, ...readiness };
  }

  // Score through the one engine.
  const scored = fantasy.scoreCompetition(gw.competitionId);
  const teamPointsByUser = new Map(scored.standings.map((s) => [s.userId, s.points]));
  teamPointsByUser.par = median(scored.standings.map((s) => s.points)) ?? 0;

  // Per-player points, for the lines.
  const pool = fantasy.playerPool(gw.competitionId);
  const stats = fantasy.statsFor(gw.competitionId);
  const pointsByPlayer = new Map(
    pool.map((p) => [p.id, fantasy.scorePlayer(p.position, stats.get(p.id)).points])
  );

  const entries = entriesOf(gameweekId);
  for (const entry of entries) {
    const wagers = wagersOf(gameweekId, entry.userId);
    let staked = 0;
    let returned = 0;
    for (const wager of wagers) {
      const result = settleWager(gw, wager, pointsByPlayer, teamPointsByUser);
      store.update('ligiWagers', wager.id, {
        settled: true,
        outcome: result.outcome,
        unitsReturned: result.unitsReturned,
        detail: result.detail
      });
      staked += wager.units;
      returned += result.unitsReturned;
    }
    const teamPoints = teamPointsByUser.get(entry.userId) ?? 0;
    const netUnits = returned - staked;
    store.update('ligiEntries', entry.id, {
      teamPoints,
      unitsStaked: staked,
      unitsReturned: returned,
      netUnits,
      // The streak rule, applied identically to everyone and published above.
      won: netUnits > 0 && teamPoints >= teamPointsByUser.par,
      settledAt: new Date().toISOString()
    });
  }

  const settledAt = new Date().toISOString();
  store.update('ligiGameweeks', gameweekId, { status: 'settled', settledAt });
  return {
    gameweekId,
    settled: true,
    settledAt,
    entries: entries.length,
    standings: scored.standings
  };
}

// ---------------------------------------------------------------------------
// LADDERS — season table and streaks, both derived by scanning
// ---------------------------------------------------------------------------

export function seasonTable(seasonId) {
  const weeks = gameweeksOf(seasonId).filter((g) => g.status === 'settled');
  const byUser = new Map();
  for (const gw of weeks) {
    for (const entry of entriesOf(gw.id)) {
      if (entry.settledAt === null) continue;
      const row = byUser.get(entry.userId) ?? {
        userId: entry.userId, played: 0, points: 0, netUnits: 0, weeksWon: 0
      };
      row.played += 1;
      row.points += entry.teamPoints ?? 0;
      row.netUnits += entry.netUnits ?? 0;
      if (entry.won) row.weeksWon += 1;
      byUser.set(entry.userId, row);
    }
  }
  const rows = [...byUser.values()].sort(
    (a, b) => (b.points - a.points) || (b.netUnits - a.netUnits) || a.userId.localeCompare(b.userId)
  );
  let rank = 0, last = null, seen = 0;
  for (const row of rows) {
    seen++;
    const key = `${row.points}:${row.netUnits}`;
    if (key !== last) { rank = seen; last = key; }
    row.rank = rank;
  }
  return rows;
}

/**
 * The streak ladder.
 *
 * Current streak is consecutive won gameweeks up to the most recent settled
 * one; longest is the best run of the season. Both are recomputed from the
 * settled rows every time, so a corrected result corrects the streak.
 */
export function streakTable(seasonId) {
  const weeks = gameweeksOf(seasonId).filter((g) => g.status === 'settled');
  const byUser = new Map();
  for (const gw of weeks) {
    for (const entry of entriesOf(gw.id)) {
      if (entry.settledAt === null) continue;
      const row = byUser.get(entry.userId) ?? { userId: entry.userId, current: 0, longest: 0, played: 0 };
      row.played += 1;
      if (entry.won) {
        row.current += 1;
        row.longest = Math.max(row.longest, row.current);
      } else {
        row.current = 0;
      }
      byUser.set(entry.userId, row);
    }
  }
  return [...byUser.values()].sort(
    (a, b) => (b.current - a.current) || (b.longest - a.longest) || a.userId.localeCompare(b.userId)
  );
}

// ---------------------------------------------------------------------------
// THE AUTOMATED PASS
// ---------------------------------------------------------------------------

/**
 * Move everything that the clock and the data say should move.
 *
 * No arguments beyond the clock, no human in the loop, and idempotent: the
 * second run over the same state reports no actions. Every branch is either a
 * time comparison or a data-completeness check — nothing here decides a
 * result, it only notices one.
 */
export function tick(now = Date.now()) {
  const actions = [];

  for (const season of store.all('ligiSeasons')) {
    const weeks = gameweeksOf(season.id);

    for (const gw of weeks) {
      const opens = Date.parse(gw.opensAt);
      const kickoff = Date.parse(gw.kickoffAt);

      if (gw.status === 'scheduled' && now >= opens) {
        const competition = fantasy.getCompetition(gw.competitionId);
        // A gameweek with no player pool cannot open: there is nothing to
        // pick. It waits, visibly, instead of opening onto an empty screen.
        if (fantasy.playerPool(gw.competitionId).length < 11) {
          continue;
        }
        if (competition.status === 'draft') {
          store.update('fantasyCompetitions', competition.id, { status: 'open' });
        }
        store.update('ligiGameweeks', gw.id, { status: 'open' });
        actions.push({ gameweekId: gw.id, action: 'opened' });
        continue;
      }

      if (gw.status === 'open' && now >= kickoff) {
        fantasy.lockCompetition(gw.competitionId);
        // The lines are frozen AT LOCK, from history that existed then. A line
        // recomputed later against newer data would be a different bet.
        store.update('ligiGameweeks', gw.id, {
          status: 'awaiting_results',
          houseLines: deriveHouseLines(gw.id)
        });
        actions.push({ gameweekId: gw.id, action: 'locked' });
        continue;
      }

      if (gw.status === 'locked' || gw.status === 'awaiting_results') {
        if (!gw.houseLines) {
          store.update('ligiGameweeks', gw.id, { houseLines: deriveHouseLines(gw.id) });
        }
        const result = settleGameweek(gw.id);
        if (result.settled) actions.push({ gameweekId: gw.id, action: 'settled', entries: result.entries });
        continue;
      }
    }

    const settledCount = gameweeksOf(season.id).filter((g) => g.status === 'settled').length;
    const anyStarted = gameweeksOf(season.id).some((g) => g.status !== 'scheduled');
    const nextStatus = settledCount === season.gameweekCount
      ? 'complete'
      : anyStarted
      ? 'running'
      : 'upcoming';
    if (nextStatus !== season.status) {
      store.update('ligiSeasons', season.id, { status: nextStatus });
      actions.push({ seasonId: season.id, action: `season_${nextStatus}` });
    }
  }

  return { at: iso(now), actions, changed: actions.length > 0 };
}

// ---------------------------------------------------------------------------
// READ MODEL — one call the client can render from
// ---------------------------------------------------------------------------

export function gameweekView(gameweekId, userId = null) {
  const gw = getGameweek(gameweekId);
  if (!gw) return null;
  const competition = fantasy.getCompetition(gw.competitionId);
  const entry = userId ? getEntry(gameweekId, userId) : null;
  return {
    gameweek: gw,
    locked: fantasy.isLocked(competition),
    pool: fantasy.playerPool(gw.competitionId),
    houseLines: gw.houseLines ?? (gw.status === 'open' ? deriveHouseLines(gw.id) : null),
    readiness: resultsReadiness(gw.id),
    entryCount: entriesOf(gw.id).length,
    me: entry
      ? {
          entry,
          team: fantasy.getEntry(gw.competitionId, userId),
          wagers: wagersOf(gw.id, userId),
          unitsRemaining: HOUSE_RULES.weeklyUnits - wagersOf(gw.id, userId).reduce((s, w) => s + w.units, 0)
        }
      : null
  };
}

/**
 * The whole product in one response: leagues, the live season, this week, both
 * ladders, and an honest statement about each slot.
 */
export function overview(userId = null, { seasonId = null } = {}) {
  const seasons = listSeasons();
  const season = seasonId
    ? getSeason(seasonId)
    : seasons.find((s) => s.status === 'running') ?? seasons.find((s) => s.status === 'upcoming') ?? seasons[0] ?? null;
  const gw = season ? currentGameweek(season.id) : null;
  const money = compliance.arenaMoneyStatus();

  return {
    game: {
      id: 'ligi',
      name: 'Ligi',
      tagline: 'African fantasy football, settled by the house',
      priority: true
    },
    leagues: LEAGUES,
    rules: { house: HOUSE_RULES, squad: fantasy.SQUAD_RULES, scoring: fantasy.SCORING_RULES },
    slots: [
      {
        id: 'free',
        label: 'Free seat',
        stakeKind: 'units',
        available: true,
        detail: `${HOUSE_RULES.weeklyUnits} staking units a week. Units are a score, not money: nothing is bought and nothing is paid out.`
      },
      {
        id: 'cash',
        label: 'Cash seat',
        stakeKind: 'cash',
        available: money.enabled,
        priceKes: season?.cashSlotPriceKes ?? null,
        detail: money.enabled
          ? 'Licensed, but the cash rail is not implemented yet.'
          : 'Refused: real-money entry needs a licence this deployment does not have.',
        compliance: money
      }
    ],
    season: season ?? null,
    seasons,
    gameweek: gw ? gameweekView(gw.id, userId) : null,
    table: season ? seasonTable(season.id) : [],
    streaks: season ? streakTable(season.id) : []
  };
}
