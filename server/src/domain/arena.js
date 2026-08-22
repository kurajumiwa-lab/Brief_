// ---------------------------------------------------------------------------
// ARENA
//
// Competitive play, persisted server-side. Until now Arena existed only as
// client state, which meant a match vanished on refresh and no second player
// could ever see it. This module makes it real.
//
// WHAT ARENA IS NOT.
//
// It is NOT a second economy. There is no Arena wallet, no Arena balance and
// no Arena transaction table. Paid contests route through the SAME compliance
// gate and, when they are ever legal here, the SAME ledger as everything else.
// Free and ranked play -- which is what Brief can legally offer today -- needs
// no money at all, and that is the part implemented here.
//
// RESULT INTEGRITY IS THE WHOLE PRODUCT.
//
// A result that one player can set alone is worthless: the loser simply never
// agrees, or the winner inflates their record. So:
//
//   * a result is REPORTED by one player and must be CONFIRMED by the other
//   * the two reports must AGREE, or the match is disputed
//   * Brief never picks a winner
//   * a confirmed result is final -- no quiet edits
//
// This mirrors the client model exactly (`confirmedByA` / `confirmedByB`), so
// the existing UI keeps working against real persistence.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { personIdIfUser, resolveDisplayName } from './person.js';

/** Games Brief actually knows about. A challenge for anything else is refused. */
export const ARENA_GAMES = [
  { id: 'efootball', name: 'eFootball', platform: 'mobile' },
  { id: 'fc_mobile', name: 'FC Mobile', platform: 'mobile' },
  { id: 'pubg_mobile', name: 'PUBG Mobile', platform: 'mobile' },
  { id: 'cod_mobile', name: 'COD Mobile', platform: 'mobile' },
  { id: 'other', name: 'Other', platform: 'any' }
];

export const GAME_IDS = ARENA_GAMES.map((g) => g.id);

/**
 * Stake kinds.
 *
 * 'entry_fee' is accepted as a DESCRIPTION of an arrangement between players
 * -- Brief records that they agreed to play for money but does not hold,
 * move, or guarantee it. Anything that would make Brief the stakeholder goes
 * through the compliance gate and is currently refused.
 */
export const STAKES = ['friendly', 'ranked', 'entry_fee'];

export const CHALLENGE_STATUS = ['open', 'accepted', 'cancelled', 'expired'];
export const MATCH_STATUS = ['scheduled', 'reported', 'confirmed', 'disputed', 'abandoned'];

const DEFAULT_OPEN_MINUTES = 120;

// ---------------------------------------------------------------------------
// CHALLENGES
// ---------------------------------------------------------------------------

export function createChallenge({
  createdBy, gameId, mode = '1v1', stake = 'friendly',
  entryFeeKes = null, note = '', openMinutes = DEFAULT_OPEN_MINUTES, venue = null
}) {
  if (!createdBy) throw new Error('a player is required');
  if (!GAME_IDS.includes(gameId)) throw new Error(`gameId must be one of ${GAME_IDS.join(', ')}`);
  if (!STAKES.includes(stake)) throw new Error(`stake must be one of ${STAKES.join(', ')}`);

  // An entry fee is only meaningful for an entry_fee challenge, and must be a
  // sane positive number so it cannot be used to display nonsense.
  let fee = null;
  if (stake === 'entry_fee') {
    if (!Number.isInteger(entryFeeKes) || entryFeeKes <= 0 || entryFeeKes > 100000) {
      throw new Error('entryFeeKes must be a positive whole number of shillings');
    }
    fee = entryFeeKes;
  } else if (entryFeeKes !== null && entryFeeKes !== undefined) {
    throw new Error('entryFeeKes only applies to an entry_fee challenge');
  }

  if (!Number.isInteger(openMinutes) || openMinutes <= 0 || openMinutes > 1440) {
    throw new Error('openMinutes must be between 1 and 1440');
  }

  const now = Date.now();
  return store.insert('arenaChallenges', {
    id: newId('chal'),
    createdBy,
    personId: personIdIfUser(createdBy),
    gameId,
    mode: String(mode).slice(0, 16),
    stake,
    entryFeeKes: fee,
    note: String(note).slice(0, 200),
    venue: venue ? String(venue).slice(0, 120) : null,
    status: 'open',
    acceptedBy: null,
    matchId: null,
    createdAt: new Date(now).toISOString(),
    openUntil: new Date(now + openMinutes * 60_000).toISOString(),
    updatedAt: new Date(now).toISOString()
  });
}

export function getChallenge(id) {
  return store.find('arenaChallenges', (c) => c.id === id);
}

/** A challenge is only really open if it has not also expired. */
export function isOpen(challenge) {
  return challenge.status === 'open' && Date.parse(challenge.openUntil) > Date.now();
}

export function listChallenges({ gameId = null, status = 'open', includeExpired = false } = {}) {
  let rows = store.all('arenaChallenges');
  if (gameId) rows = rows.filter((c) => c.gameId === gameId);
  if (status) rows = rows.filter((c) => c.status === status);
  if (status === 'open' && !includeExpired) rows = rows.filter(isOpen);
  return rows;
}

export function cancelChallenge(id, actorId) {
  const c = getChallenge(id);
  if (!c) throw new Error('challenge not found');
  if (c.createdBy !== actorId) throw new Error('only the player who created this challenge may cancel it');
  if (c.status === 'accepted') throw new Error('this challenge has already been accepted');
  if (c.status !== 'open') return { challenge: c, changed: false };
  return { challenge: store.update('arenaChallenges', id, { status: 'cancelled' }), changed: true };
}

/**
 * Accept a challenge, creating the match.
 *
 * Idempotency matters here: a double tap must not create two matches for one
 * challenge, and the challenge row is what enforces it -- once it is
 * 'accepted' nobody else can take it.
 */
export function acceptChallenge(challengeId, acceptingPlayerId) {
  const c = getChallenge(challengeId);
  if (!c) throw new Error('challenge not found');
  if (c.createdBy === acceptingPlayerId) throw new Error('you cannot accept your own challenge');
  if (c.status === 'accepted') {
    // Already taken. If the SAME player took it, hand back their match rather
    // than erroring on a retry.
    if (c.acceptedBy === acceptingPlayerId) {
      return { challenge: c, match: store.find('arenaMatches', (m) => m.id === c.matchId), reused: true };
    }
    throw new Error('this challenge has already been accepted');
  }
  if (c.status !== 'open') throw new Error(`this challenge is ${c.status}`);
  if (Date.parse(c.openUntil) <= Date.now()) {
    store.update('arenaChallenges', c.id, { status: 'expired' });
    throw new Error('this challenge has expired');
  }

  const now = new Date().toISOString();
  const match = store.insert('arenaMatches', {
    id: newId('mtch'),
    challengeId: c.id,
    gameId: c.gameId,
    mode: c.mode,
    stake: c.stake,
    entryFeeKes: c.entryFeeKes,
    playerAId: c.createdBy,
    playerBId: acceptingPlayerId,
    personAId: personIdIfUser(c.createdBy),
    personBId: personIdIfUser(acceptingPlayerId),
    status: 'scheduled',
    // Result fields stay empty until players agree. Brief never fills these.
    reportedBy: null,
    reportedWinnerId: null,
    reportedScore: null,
    confirmedByA: false,
    confirmedByB: false,
    winnerPlayerId: null,
    scoreLine: null,
    disputeReason: null,
    createdAt: now,
    updatedAt: now
  });

  const challenge = store.update('arenaChallenges', c.id, {
    status: 'accepted', acceptedBy: acceptingPlayerId, matchId: match.id
  });
  return { challenge, match, reused: false };
}

// ---------------------------------------------------------------------------
// MATCHES & RESULTS
// ---------------------------------------------------------------------------

export function getMatch(id) {
  return store.find('arenaMatches', (m) => m.id === id);
}

export function listMatchesFor(playerId) {
  return store.filter('arenaMatches', (m) => m.playerAId === playerId || m.playerBId === playerId);
}

export function isParticipant(match, playerId) {
  return match.playerAId === playerId || match.playerBId === playerId;
}

/**
 * Report a result. One player says what happened; it is not yet true.
 *
 * The reporter's own confirmation is recorded automatically -- reporting IS
 * agreeing to your own report -- but the opponent must still confirm.
 */
export function reportResult(matchId, reporterId, { winnerPlayerId, scoreLine = null }) {
  const m = getMatch(matchId);
  if (!m) throw new Error('match not found');
  if (!isParticipant(m, reporterId)) throw new Error('only a player in this match may report a result');
  if (m.status === 'confirmed') throw new Error('this result is already confirmed');
  if (m.status === 'disputed') throw new Error('this match is disputed and needs both players to agree again');
  if (m.status === 'abandoned') throw new Error('this match was abandoned');

  // A winner must be one of the two players, or an explicit draw.
  const isDraw = winnerPlayerId === null || winnerPlayerId === 'draw';
  if (!isDraw && !isParticipant(m, winnerPlayerId)) {
    throw new Error('the winner must be one of the two players');
  }
  const winner = isDraw ? 'draw' : winnerPlayerId;

  const patch = {
    status: 'reported',
    reportedBy: reporterId,
    reportedWinnerId: winner,
    reportedScore: scoreLine ? String(scoreLine).slice(0, 24) : null,
    confirmedByA: m.playerAId === reporterId,
    confirmedByB: m.playerBId === reporterId
  };
  return store.update('arenaMatches', matchId, patch);
}

/**
 * Confirm (or contradict) a reported result.
 *
 * If the confirming player names a DIFFERENT winner, the match becomes
 * disputed rather than silently taking either version. Brief has no way to
 * know which player is telling the truth and does not pretend to.
 */
export function confirmResult(matchId, confirmerId, { winnerPlayerId = undefined } = {}) {
  const m = getMatch(matchId);
  if (!m) throw new Error('match not found');
  if (!isParticipant(m, confirmerId)) throw new Error('only a player in this match may confirm a result');
  if (m.status === 'confirmed') return { match: m, changed: false };
  if (m.status !== 'reported') throw new Error('no result has been reported yet');
  if (m.reportedBy === confirmerId) throw new Error('the other player must confirm this result');

  // Contradiction -> dispute.
  if (winnerPlayerId !== undefined) {
    const claimed = winnerPlayerId === null ? 'draw' : winnerPlayerId;
    if (claimed !== m.reportedWinnerId) {
      const disputed = store.update('arenaMatches', matchId, {
        status: 'disputed',
        disputeReason: 'the two players reported different winners'
      });
      return { match: disputed, changed: true, disputed: true };
    }
  }

  const patch = {
    status: 'confirmed',
    confirmedByA: true,
    confirmedByB: true,
    winnerPlayerId: m.reportedWinnerId,
    scoreLine: m.reportedScore
  };
  return { match: store.update('arenaMatches', matchId, patch), changed: true, disputed: false };
}

/** Either player can walk away from a match that never happened. */
export function abandonMatch(matchId, actorId, reason = '') {
  const m = getMatch(matchId);
  if (!m) throw new Error('match not found');
  if (!isParticipant(m, actorId)) throw new Error('only a player in this match may abandon it');
  if (m.status === 'confirmed') throw new Error('a confirmed result cannot be abandoned');
  return store.update('arenaMatches', matchId, {
    status: 'abandoned', disputeReason: String(reason).slice(0, 200) || null
  });
}

/**
 * A player's record, DERIVED from confirmed matches only.
 *
 * Nothing is stored. A disputed or unconfirmed match contributes nothing,
 * which is exactly why the confirmation rule is worth having.
 */
export function playerRecord(playerId) {
  const matches = listMatchesFor(playerId).filter((m) => m.status === 'confirmed');
  let won = 0, lost = 0, drawn = 0;
  for (const m of matches) {
    if (m.winnerPlayerId === 'draw') drawn++;
    else if (m.winnerPlayerId === playerId) won++;
    else lost++;
  }
  return {
    playerId,
    played: matches.length,
    won,
    lost,
    drawn,
    // Evidence, not a rating. Brief does not publish a skill number it cannot
    // justify from confirmed results.
    pending: listMatchesFor(playerId).filter((m) => m.status === 'reported').length,
    disputed: listMatchesFor(playerId).filter((m) => m.status === 'disputed').length
  };
}

/** Live activity per game, derived from real open challenges. */
export function gameActivity() {
  const counts = {};
  for (const g of ARENA_GAMES) {
    counts[g.id] = listChallenges({ gameId: g.id, status: 'open' }).length;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// ARENA ENTITIES — players, venues, tournaments, results, leaderboards
//
// These complete Arena as a real platform. Each is a persisted model with real
// lifecycle rules; leaderboards are DERIVED from confirmed results, never a
// stored table that could disagree with the matches behind it.
// ---------------------------------------------------------------------------

// --- Game identities / players --------------------------------------------

export function createPlayer({ userId, gameId, gamerTag, platform = null, region = null }) {
  if (!userId) throw new Error('a user is required');
  if (!GAME_IDS.includes(gameId)) throw new Error(`gameId must be one of ${GAME_IDS.join(', ')}`);
  if (!gamerTag || !String(gamerTag).trim()) throw new Error('a gamer tag is required');

  const existing = store.find('arenaPlayers', (p) => p.userId === userId && p.gameId === gameId);
  if (existing) return existing;

  return store.insert('arenaPlayers', {
    id: newId('ply'),
    userId,
    personId: personIdIfUser(userId),
    gameId,
    gamerTag: String(gamerTag).trim(),
    platform: platform ?? null,
    region: region ?? null,
    verified: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export function getPlayer(id) {
  return store.find('arenaPlayers', (p) => p.id === id) ?? null;
}

export function listPlayers({ gameId = null } = {}) {
  let rows = store.all('arenaPlayers');
  if (gameId) rows = rows.filter((p) => p.gameId === gameId);
  return rows.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// --- Venues ----------------------------------------------------------------

export function createVenue({ name, gameIds = [], location = null, lat = null, lng = null, contact = null }) {
  if (!name || !String(name).trim()) throw new Error('a name is required');
  return store.insert('arenaVenues', {
    id: newId('vnu'),
    name: String(name).trim(),
    gameIds: gameIds.filter((g) => GAME_IDS.includes(g)),
    location,
    lat: typeof lat === 'number' ? lat : null,
    lng: typeof lng === 'number' ? lng : null,
    contact,
    createdAt: new Date().toISOString()
  });
}

export function listVenues({ gameId = null } = {}) {
  let rows = store.all('arenaVenues');
  if (gameId) rows = rows.filter((v) => v.gameIds.includes(gameId));
  return rows;
}

// --- Tournaments -----------------------------------------------------------

export function createTournament({ gameId, title, startsAt, createdBy, venueId = null, maxPlayers = null }) {
  if (!GAME_IDS.includes(gameId)) throw new Error(`gameId must be one of ${GAME_IDS.join(', ')}`);
  if (!title || !String(title).trim()) throw new Error('a title is required');
  return store.insert('arenaTournaments', {
    id: newId('trn'),
    gameId,
    title: String(title).trim(),
    startsAt: startsAt ?? null,
    createdBy: createdBy ?? null,
    venueId,
    maxPlayers,
    status: 'open',
    createdAt: new Date().toISOString()
  });
}

export function listTournaments({ gameId = null, status = null } = {}) {
  let rows = store.all('arenaTournaments');
  if (gameId) rows = rows.filter((t) => t.gameId === gameId);
  if (status) rows = rows.filter((t) => t.status === status);
  return rows.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// --- Results + leaderboards ------------------------------------------------

/**
 * Record an AGREED result. This is what a confirmed match already is: the
 * result both players accepted. Writing it to arenaResults gives leaderboards
 * a single append-only source. Idempotent per match.
 */
export function recordResult(matchId) {
  const m = getMatch(matchId);
  if (!m) throw new Error('match not found');
  if (m.status !== 'confirmed') throw new Error('only a confirmed match has an agreed result');
  const existing = store.find('arenaResults', (r) => r.matchId === matchId);
  if (existing) return { result: existing, reused: true };

  return {
    result: store.insert('arenaResults', {
      id: newId('res'),
      matchId,
      gameId: m.gameId,
      winnerPlayerId: m.winnerPlayerId,
      playerAId: m.playerAId,
      playerBId: m.playerBId,
      scoreLine: m.scoreLine,
      confirmedAt: new Date().toISOString()
    }),
    reused: false
  };
}

/**
 * Leaderboard: players ranked by wins (then win rate), DERIVED from confirmed
 * results. Never a stored table that could drift from the matches.
 */
export function leaderboard(gameId) {
  const results = store.filter('arenaResults', (r) => r.gameId === gameId);
  const tally = {};
  for (const r of results) {
    for (const pid of [r.playerAId, r.playerBId]) {
      if (!pid) continue;
      (tally[pid] ??= { played: 0, won: 0 });
      tally[pid].played++;
    }
    if (r.winnerPlayerId && r.winnerPlayerId !== 'draw') {
      (tally[r.winnerPlayerId] ??= { played: 0, won: 0 }).won++;
    }
  }
  return Object.entries(tally)
    .map(([playerId, t]) => ({
      playerId,
      player: getPlayer(playerId)?.gamerTag
        ?? store.find('arenaPlayers', (p) => p.userId === playerId)?.gamerTag
        ?? resolveDisplayName(playerId),
      played: t.played,
      won: t.won,
      winRate: t.played ? t.won / t.played : null
    }))
    .sort((a, b) => b.won - a.won || (b.winRate ?? 0) - (a.winRate ?? 0));
}
