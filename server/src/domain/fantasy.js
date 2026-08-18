// ---------------------------------------------------------------------------
// FANTASY 11
//
// Pick eleven players, name a captain, lock at kickoff, score deterministically
// from real match events, rank.
//
// THE NON-ECONOMIC CORE IS BUILT FIRST, DELIBERATELY.
//
// Paid fantasy is regulated gambling in Kenya exactly like paid contests are,
// so it inherits the SAME compliance gate. Building the money first would
// produce a product that cannot legally run; building the game first produces
// something that works today and can be monetised the day a licence exists.
// There is no Fantasy wallet and never will be -- if paid entry is ever
// enabled it uses the one ledger, like everything else.
//
// WHAT MAKES THE SCORING TRUSTWORTHY.
//
//   * the player pool is SERVER-AUTHORITATIVE -- a client cannot invent a
//     player, or a price, or a fixture
//   * lock time is server-side and checked against the server clock
//   * after lock, a team is immutable. No edits, no swaps, no "my phone was
//     slow" exceptions
//   * scoring is a PURE FUNCTION of (team, stats, rules) -- rerunning it on
//     the same inputs always gives the same number, which is what makes a
//     disputed score checkable rather than a matter of trust
//   * every score carries a breakdown, so a player can see exactly why
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';

export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

export const COMPETITION_STATUS = ['draft', 'open', 'locked', 'scored', 'cancelled'];

/** Exactly one keeper, a real defence, eleven players. */
export const SQUAD_RULES = {
  size: 11,
  minByPosition: { GK: 1, DEF: 3, MID: 2, FWD: 1 },
  maxByPosition: { GK: 1, DEF: 5, MID: 5, FWD: 3 },
  maxPerClub: 3,
  captainMultiplier: 2
};

/**
 * Points. Published as data rather than buried in the scorer so the rules can
 * be shown to players and asserted against in tests.
 */
export const SCORING_RULES = {
  appearance: 1,
  goal: { GK: 10, DEF: 6, MID: 5, FWD: 4 },
  assist: 3,
  cleanSheet: { GK: 4, DEF: 4, MID: 1, FWD: 0 },
  savesPerPoint: 3,       // 1 point per 3 saves
  penaltySaved: 5,
  penaltyMissed: -2,
  yellowCard: -1,
  redCard: -3,
  ownGoal: -2,
  goalsConcededPer2: -1   // GK/DEF only
};

// ---------------------------------------------------------------------------
// COMPETITIONS
// ---------------------------------------------------------------------------

export function createCompetition({
  createdBy, title, kickoffAt, description = '', fixtures = []
}) {
  if (!createdBy) throw new Error('a creator is required');
  if (!title || !String(title).trim()) throw new Error('title is required');
  const lock = Date.parse(kickoffAt);
  if (!Number.isFinite(lock)) throw new Error('a valid kickoffAt is required');

  const now = new Date().toISOString();
  return store.insert('fantasyCompetitions', {
    id: newId('fcomp'),
    createdBy,
    title: String(title).trim().slice(0, 120),
    description: String(description).slice(0, 500),
    // The single source of truth for "is it too late". Server-side, always.
    kickoffAt: new Date(lock).toISOString(),
    fixtures: Array.isArray(fixtures) ? fixtures.slice(0, 20) : [],
    status: 'draft',
    // Paid entry stays null until the compliance gate allows it to exist.
    entryFeeKes: null,
    createdAt: now,
    updatedAt: now
  });
}

export function getCompetition(id) {
  return store.find('fantasyCompetitions', (c) => c.id === id);
}

export function listCompetitions({ status = null } = {}) {
  let rows = store.all('fantasyCompetitions');
  if (status) rows = rows.filter((c) => c.status === status);
  return rows;
}

export function openCompetition(id, actorId) {
  const c = getCompetition(id);
  if (!c) throw new Error('competition not found');
  if (c.createdBy !== actorId) throw new Error('only the organiser may open this competition');
  if (c.status !== 'draft') throw new Error(`competition is already ${c.status}`);
  if (playerPool(id).length < SQUAD_RULES.size) {
    throw new Error('the player pool is too small to pick a valid team');
  }
  return store.update('fantasyCompetitions', id, { status: 'open' });
}

/**
 * Has this competition locked?
 *
 * Time-based, checked against the SERVER clock. A client's clock is not
 * consulted, so a device with the wrong time cannot buy extra minutes.
 */
export function isLocked(competition) {
  if (!competition) return true;
  if (competition.status === 'locked' || competition.status === 'scored') return true;
  return Date.now() >= Date.parse(competition.kickoffAt);
}

export function lockCompetition(id) {
  const c = getCompetition(id);
  if (!c) throw new Error('competition not found');
  if (c.status === 'scored') throw new Error('this competition is already scored');
  if (c.status === 'locked') return { competition: c, changed: false };
  return { competition: store.update('fantasyCompetitions', id, { status: 'locked' }), changed: true };
}

// ---------------------------------------------------------------------------
// PLAYER POOL
// ---------------------------------------------------------------------------

/**
 * Add a real player to a competition's pool.
 *
 * Organiser-only. This is what stops a participant inventing a striker who
 * scores six goals a game.
 */
export function addPoolPlayer(competitionId, actorId, { name, position, club, price = 0 }) {
  const c = getCompetition(competitionId);
  if (!c) throw new Error('competition not found');
  if (c.createdBy !== actorId) throw new Error('only the organiser may change the player pool');
  if (c.status !== 'draft') throw new Error('the pool cannot change once the competition is open');
  if (!name || !String(name).trim()) throw new Error('a player name is required');
  if (!POSITIONS.includes(position)) throw new Error(`position must be one of ${POSITIONS.join(', ')}`);
  if (!club || !String(club).trim()) throw new Error('a club is required');

  return store.insert('fantasyPlayers', {
    id: newId('fply'),
    competitionId,
    name: String(name).trim().slice(0, 80),
    position,
    club: String(club).trim().slice(0, 60),
    price: Number.isFinite(price) ? price : 0,
    createdAt: new Date().toISOString()
  });
}

export function playerPool(competitionId) {
  return store.filter('fantasyPlayers', (p) => p.competitionId === competitionId);
}

// ---------------------------------------------------------------------------
// TEAM SELECTION
// ---------------------------------------------------------------------------

/**
 * Validate a squad against the rules. Returns a list of problems, so the
 * client can show every issue at once rather than one at a time.
 */
export function validateSquad(competitionId, playerIds, captainId) {
  const problems = [];
  const pool = playerPool(competitionId);
  const byId = new Map(pool.map((p) => [p.id, p]));

  if (!Array.isArray(playerIds)) return ['a team must be a list of players'];
  if (playerIds.length !== SQUAD_RULES.size) {
    problems.push(`a team must have exactly ${SQUAD_RULES.size} players`);
  }
  if (new Set(playerIds).size !== playerIds.length) {
    problems.push('the same player cannot be picked twice');
  }

  const chosen = [];
  for (const id of playerIds) {
    const p = byId.get(id);
    // The pool check: an unknown id is a fabricated player.
    if (!p) { problems.push(`unknown player: ${id}`); continue; }
    chosen.push(p);
  }

  const counts = {};
  const clubs = {};
  for (const p of chosen) {
    counts[p.position] = (counts[p.position] ?? 0) + 1;
    clubs[p.club] = (clubs[p.club] ?? 0) + 1;
  }
  for (const pos of POSITIONS) {
    const n = counts[pos] ?? 0;
    if (n < SQUAD_RULES.minByPosition[pos]) {
      problems.push(`at least ${SQUAD_RULES.minByPosition[pos]} ${pos} required`);
    }
    if (n > SQUAD_RULES.maxByPosition[pos]) {
      problems.push(`at most ${SQUAD_RULES.maxByPosition[pos]} ${pos} allowed`);
    }
  }
  for (const [club, n] of Object.entries(clubs)) {
    if (n > SQUAD_RULES.maxPerClub) {
      problems.push(`at most ${SQUAD_RULES.maxPerClub} players from ${club}`);
    }
  }
  if (!captainId) problems.push('a captain is required');
  else if (!playerIds.includes(captainId)) problems.push('the captain must be in the team');

  return problems;
}

/**
 * Submit or replace a team.
 *
 * Before lock a player may resubmit freely -- that is normal team management,
 * and it UPDATES their single entry rather than creating a second one. After
 * lock, nothing changes, ever.
 */
export function submitTeam(competitionId, userId, { playerIds, captainId }) {
  const c = getCompetition(competitionId);
  if (!c) throw new Error('competition not found');
  if (c.status === 'draft') throw new Error('this competition is not open yet');
  if (c.status === 'cancelled') throw new Error('this competition was cancelled');
  // THE LOCK. Checked against the server clock, not the request.
  if (isLocked(c)) throw new Error('this competition is locked; teams can no longer be changed');

  const problems = validateSquad(competitionId, playerIds, captainId);
  if (problems.length) {
    const err = new Error(problems[0]);
    err.problems = problems;
    throw err;
  }

  const existing = store.find(
    'fantasyEntries',
    (e) => e.competitionId === competitionId && e.userId === userId
  );
  const now = new Date().toISOString();

  if (existing) {
    // DUPLICATE PROTECTION: one entry per user per competition, updated in
    // place. Submitting twice does not create two teams or two chances.
    return {
      entry: store.update('fantasyEntries', existing.id, {
        playerIds: [...playerIds], captainId, updatedAt: now
      }),
      created: false
    };
  }

  return {
    entry: store.insert('fantasyEntries', {
      id: newId('fent'),
      competitionId,
      userId,
      playerIds: [...playerIds],
      captainId,
      // Filled by scoring, never by a client.
      points: null,
      breakdown: null,
      rank: null,
      createdAt: now,
      updatedAt: now
    }),
    created: true
  };
}

export function getEntry(competitionId, userId) {
  return store.find('fantasyEntries', (e) => e.competitionId === competitionId && e.userId === userId);
}

export function listEntries(competitionId) {
  return store.filter('fantasyEntries', (e) => e.competitionId === competitionId);
}

// ---------------------------------------------------------------------------
// STATS & SCORING
// ---------------------------------------------------------------------------

/**
 * Record what a player actually did. Organiser-only, and only once the
 * competition is locked -- stats before kickoff would be fiction.
 */
export function recordStats(competitionId, actorId, playerId, stats = {}) {
  const c = getCompetition(competitionId);
  if (!c) throw new Error('competition not found');
  if (c.createdBy !== actorId) throw new Error('only the organiser may record match stats');
  if (!isLocked(c)) throw new Error('stats cannot be recorded before kickoff');
  const player = store.find('fantasyPlayers', (p) => p.id === playerId && p.competitionId === competitionId);
  if (!player) throw new Error('unknown player');

  const clean = {
    minutes: int(stats.minutes),
    goals: int(stats.goals),
    assists: int(stats.assists),
    cleanSheet: Boolean(stats.cleanSheet),
    saves: int(stats.saves),
    penaltiesSaved: int(stats.penaltiesSaved),
    penaltiesMissed: int(stats.penaltiesMissed),
    yellowCards: int(stats.yellowCards),
    redCards: int(stats.redCards),
    ownGoals: int(stats.ownGoals),
    goalsConceded: int(stats.goalsConceded)
  };

  const existing = store.find(
    'fantasyStats',
    (s) => s.competitionId === competitionId && s.playerId === playerId
  );
  if (existing) return store.update('fantasyStats', existing.id, { stats: clean });
  return store.insert('fantasyStats', {
    id: newId('fstat'), competitionId, playerId, stats: clean,
    createdAt: new Date().toISOString()
  });
}

function int(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function statsFor(competitionId) {
  const rows = store.filter('fantasyStats', (s) => s.competitionId === competitionId);
  return new Map(rows.map((r) => [r.playerId, r.stats]));
}

/**
 * Points for ONE player. A pure function: same inputs, same output, no clock,
 * no randomness, no store access.
 *
 * Exported because a score a player cannot recompute is a score they have to
 * take on faith.
 */
export function scorePlayer(position, stats, { isCaptain = false } = {}) {
  if (!stats || !stats.minutes) {
    // Did not play: zero, and captaincy does not multiply zero into anything.
    return { points: 0, lines: [{ label: 'Did not play', points: 0 }] };
  }
  const lines = [];
  const add = (label, points) => { if (points !== 0) lines.push({ label, points }); };

  add('Appearance', SCORING_RULES.appearance);
  if (stats.goals) add(`Goals x${stats.goals}`, SCORING_RULES.goal[position] * stats.goals);
  if (stats.assists) add(`Assists x${stats.assists}`, SCORING_RULES.assist * stats.assists);
  if (stats.cleanSheet && SCORING_RULES.cleanSheet[position]) {
    add('Clean sheet', SCORING_RULES.cleanSheet[position]);
  }
  if (stats.saves >= SCORING_RULES.savesPerPoint) {
    add(`Saves x${stats.saves}`, Math.floor(stats.saves / SCORING_RULES.savesPerPoint));
  }
  if (stats.penaltiesSaved) add(`Penalties saved x${stats.penaltiesSaved}`, SCORING_RULES.penaltySaved * stats.penaltiesSaved);
  if (stats.penaltiesMissed) add(`Penalties missed x${stats.penaltiesMissed}`, SCORING_RULES.penaltyMissed * stats.penaltiesMissed);
  if (stats.yellowCards) add(`Yellow cards x${stats.yellowCards}`, SCORING_RULES.yellowCard * stats.yellowCards);
  if (stats.redCards) add(`Red cards x${stats.redCards}`, SCORING_RULES.redCard * stats.redCards);
  if (stats.ownGoals) add(`Own goals x${stats.ownGoals}`, SCORING_RULES.ownGoal * stats.ownGoals);
  if ((position === 'GK' || position === 'DEF') && stats.goalsConceded >= 2) {
    add(`Conceded x${stats.goalsConceded}`, Math.floor(stats.goalsConceded / 2) * SCORING_RULES.goalsConcededPer2);
  }

  let points = lines.reduce((sum, l) => sum + l.points, 0);
  if (isCaptain) {
    const bonus = points * (SQUAD_RULES.captainMultiplier - 1);
    lines.push({ label: `Captain (x${SQUAD_RULES.captainMultiplier})`, points: bonus });
    points += bonus;
  }
  return { points, lines };
}

/**
 * Score every entry and rank them.
 *
 * DETERMINISTIC AND REPEATABLE: running this twice on the same data produces
 * identical points, identical breakdowns and an identical order. Ties share a
 * rank (standard competition ranking), because inventing a tiebreak Brief
 * cannot justify would be arbitrary.
 */
export function scoreCompetition(competitionId, actorId = null) {
  const c = getCompetition(competitionId);
  if (!c) throw new Error('competition not found');
  if (actorId && c.createdBy !== actorId) {
    throw new Error('only the organiser may score this competition');
  }
  if (!isLocked(c)) throw new Error('this competition has not locked yet');

  const stats = statsFor(competitionId);
  const players = new Map(playerPool(competitionId).map((p) => [p.id, p]));
  const entries = listEntries(competitionId);

  const scored = entries.map((e) => {
    const breakdown = [];
    let total = 0;
    for (const pid of e.playerIds) {
      const player = players.get(pid);
      if (!player) continue;
      const res = scorePlayer(player.position, stats.get(pid), { isCaptain: pid === e.captainId });
      total += res.points;
      breakdown.push({
        playerId: pid, name: player.name, position: player.position,
        isCaptain: pid === e.captainId, points: res.points, lines: res.lines
      });
    }
    return { entry: e, points: total, breakdown };
  });

  // Sort by points, then by entry id so the order is stable across runs.
  scored.sort((a, b) => (b.points - a.points) || a.entry.id.localeCompare(b.entry.id));

  let rank = 0, lastPoints = null, seen = 0;
  for (const s of scored) {
    seen++;
    if (s.points !== lastPoints) { rank = seen; lastPoints = s.points; }
    store.update('fantasyEntries', s.entry.id, {
      points: s.points, breakdown: s.breakdown, rank
    });
    s.rank = rank;
  }

  store.update('fantasyCompetitions', competitionId, { status: 'scored' });

  return {
    competitionId,
    scoredAt: new Date().toISOString(),
    standings: scored.map((s) => ({
      entryId: s.entry.id, userId: s.entry.userId, points: s.points, rank: s.rank
    }))
  };
}

export function standings(competitionId) {
  return listEntries(competitionId)
    .filter((e) => e.points !== null)
    .sort((a, b) => (b.points - a.points) || a.id.localeCompare(b.id))
    .map((e) => ({ entryId: e.id, userId: e.userId, points: e.points, rank: e.rank }));
}
