// ARENA ROUTES — extracted from index.js (zero behaviour change).
// Each route keeps its original body verbatim; only its home file changed.
import { callerId } from '../identity.js';
import * as arena from '../domain/arena.js';
import * as progress from '../domain/arenaProgress.js';
import * as person from '../domain/person.js';
import * as signals from '../domain/signal.js';
import * as notifications from '../domain/notifications.js';
import * as compliance from '../domain/compliance.js';
import { requireAuth } from './helpers.js';

import { requireFeature } from '../features.js';

export function register(app) {
app.use('/api/arena', requireFeature('arena'));
/**
 * Real-money contest gate.
 *
 * This endpoint exists so the refusal is REACHABLE and testable, not merely a
 * hidden button. Any future stake-holding route must call
 * compliance.refuseIfUnlicensed() before touching money.
 */

app.post('/api/arena/contests/:id/stake', (req, res) => {
  const refusal = compliance.refuseIfUnlicensed();
  if (refusal) return res.status(403).json(refusal);
  // Unreachable in this deployment. Left explicit rather than silently
  // absent so the boundary is obvious to the next implementer.
  return res.status(501).json({ error: 'stake handling is not implemented' });
});


// --- Arena -------------------------------------------------------------------


app.get('/api/arena/games', (_req, res) => {
  res.json({ games: arena.ARENA_GAMES, activity: arena.gameActivity() });
});

// The public beta surface returns only aggregate counters. An authenticated
// caller additionally gets their own joined flag; no roster leaves this route.
app.get('/api/arena/beta', (req, res) => {
  res.json({ beta: arena.betaSummary({ userId: callerId(req) }) });
});

app.post('/api/arena/beta/join', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const result = arena.joinBeta({
      userId: me,
      segment: req.body?.segment,
      acquisitionSource: req.body?.acquisitionSource ?? null
    });
    if (!result.reused) {
      signals.emitSignal({
        type: 'arena_beta_joined',
        actorId: me,
        metadata: { betaId: result.signup.betaId, segment: result.signup.segment }
      });
    }
    res.status(result.reused ? 200 : 201).json(result);
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.get('/api/arena/challenges', (req, res) => {
  res.json({
    challenges: arena.listChallenges({
      gameId: req.query.gameId ?? null,
      status: req.query.status ?? 'open'
    })
  });
});



app.post('/api/arena/challenges', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const challenge = arena.createChallenge({
      createdBy: me,
      gameId: req.body?.gameId,
      mode: req.body?.mode ?? '1v1',
      stake: req.body?.stake ?? 'friendly',
      entryFeeKes: req.body?.entryFeeKes ?? null,
      note: req.body?.note ?? '',
      venue: req.body?.venue ?? null,
      openMinutes: req.body?.openMinutes ?? 120
    });
    signals.emitSignal({ type: 'arena_challenge_opened', actorId: me, metadata: { challengeId: challenge.id, gameId: challenge.gameId } });
    res.status(201).json({ challenge });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});



app.post('/api/arena/challenges/:id/accept', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const { challenge, match, reused } = arena.acceptChallenge(req.params.id, me);
    if (!reused) {
      signals.emitSignal({ type: 'arena_challenge_accepted', actorId: me, metadata: { challengeId: challenge.id, matchId: match.id } });
    }
    res.status(reused ? 200 : 201).json({ challenge, match, reused });
  } catch (e) {
    const msg = String(e.message ?? e);
    res.status(/not found/i.test(msg) ? 404 : 400).json({ error: msg });
  }
});



app.post('/api/arena/challenges/:id/cancel', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const { challenge, changed } = arena.cancelChallenge(req.params.id, me);
    res.json({ challenge, changed });
  } catch (e) {
    const msg = String(e.message ?? e);
    res.status(/not found/i.test(msg) ? 404 : /only the player/i.test(msg) ? 403 : 400).json({ error: msg });
  }
});



function withNames(match) {
  if (!match) return match;
  return {
    ...match,
    playerAName: person.resolveDisplayName(match.playerAId),
    playerBName: person.resolveDisplayName(match.playerBId)
  };
}

app.get('/api/arena/matches', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  res.json({
    matches: arena.listMatchesFor(me).map(withNames),
    record: arena.playerRecord(me)
  });
});



app.get('/api/arena/matches/:id', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const m = arena.getMatch(req.params.id);
  // A match is between two people. A stranger gets 404, not a peek.
  if (!m || !arena.isParticipant(m, me)) return res.status(404).json({ error: 'match not found' });
  res.json({ match: withNames(m) });
});



app.post('/api/arena/matches/:id/report', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const m = arena.getMatch(req.params.id);
  if (!m || !arena.isParticipant(m, me)) return res.status(404).json({ error: 'match not found' });
  try {
    const match = arena.reportResult(req.params.id, me, {
      winnerPlayerId: req.body?.winnerPlayerId ?? null,
      scoreLine: req.body?.scoreLine ?? null
    });
    signals.emitSignal({ type: 'arena_result_reported', actorId: me, metadata: { matchId: match.id } });
    res.json({ match });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});



app.post('/api/arena/matches/:id/confirm', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const m = arena.getMatch(req.params.id);
  if (!m || !arena.isParticipant(m, me)) return res.status(404).json({ error: 'match not found' });
  try {
    const out = arena.confirmResult(req.params.id, me, {
      winnerPlayerId: req.body?.winnerPlayerId
    });
    if (out.changed) {
      signals.emitSignal({
        type: out.disputed ? 'arena_result_disputed' : 'arena_result_confirmed',
        actorId: me, metadata: { matchId: out.match.id }
      });
      // A confirmed result is an agreed fact: record it for the leaderboard and
      // tell both players their match is settled.
      if (!out.disputed && out.match.status === 'confirmed') {
        arena.recordResult(out.match.id);
        for (const pid of [out.match.playerAId, out.match.playerBId]) {
          const player = arena.getPlayer(pid);
          if (player) {
            notifications.notify(player.userId, {
              kind: 'challenge',
              title: 'Match result confirmed',
              body: `Your ${player.gameId} match is settled.`,
              metadata: { matchId: out.match.id }
            });
          }
        }
      }
    }
    // The confirming player's own earnings, for the match-result toast.
    const mineRows = Array.isArray(out.rewards) ? out.rewards.filter((e) => e.userId === me) : [];
    res.json({
      ...out,
      yourRewards: mineRows.length > 0 ? { xp: mineRows.reduce((t, e) => t + (e.xp ?? 0), 0), coins: mineRows.reduce((t, e) => t + (e.coins ?? 0), 0) } : null
    });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});



app.post('/api/arena/matches/:id/abandon', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const m = arena.getMatch(req.params.id);
  if (!m || !arena.isParticipant(m, me)) return res.status(404).json({ error: 'match not found' });
  try {
    res.json({ match: arena.abandonMatch(req.params.id, me, req.body?.reason ?? '') });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});



app.get('/api/arena/status', (_req, res) => {
  res.json({ arenaMoney: compliance.arenaMoneyStatus() });
});


// --- Arena entities (players, venues, tournaments, leaderboards) ------------


app.post('/api/arena/players', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.status(201).json({ player: arena.createPlayer({ userId: me, gameId: req.body?.gameId, gamerTag: req.body?.gamerTag, platform: req.body?.platform ?? null, region: req.body?.region ?? null }) });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.get('/api/arena/players/me', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  res.json({ players: arena.listPlayers().filter((p) => p.userId === me) });
});

/** Public list is opted-in availability only. Not a people search. */
app.get('/api/arena/players', (req, res) => {
  res.json({ players: person.listAvailable({ gameId: req.query.gameId ?? null }) });
});

app.get('/api/arena/available', (req, res) => {
  res.json({ available: person.listAvailable({ gameId: req.query.gameId ?? null }) });
});



app.post('/api/arena/venues', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.status(201).json({ venue: arena.createVenue({ name: req.body?.name, gameIds: req.body?.gameIds ?? [], location: req.body?.location ?? null, lat: req.body?.lat ?? null, lng: req.body?.lng ?? null, contact: req.body?.contact ?? null }) });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});



app.get('/api/arena/venues', (req, res) => {
  res.json({ venues: arena.listVenues({ gameId: req.query.gameId ?? null }) });
});



app.post('/api/arena/tournaments', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.status(201).json({ tournament: arena.createTournament({ gameId: req.body?.gameId, title: req.body?.title, startsAt: req.body?.startsAt ?? null, createdBy: me, venueId: req.body?.venueId ?? null, maxPlayers: req.body?.maxPlayers ?? null }) });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});



app.get('/api/arena/tournaments', (req, res) => {
  res.json({ tournaments: arena.listTournaments({ gameId: req.query.gameId ?? null, status: req.query.status ?? null }) });
});



app.get('/api/arena/leaderboard', (req, res) => {
  res.json({ leaderboard: arena.leaderboard(req.query.gameId ?? 'efootball') });
});

// --- progression: the retention layer under the existing surfaces -----------

/** My Arena identity: level, XP, coins, missions, rivals, season rank. */
app.get('/api/arena/progress/me', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const players = arena.listPlayers().filter((p) => p.userId === me).map((p) => ({
    ...p,
    stats: progress.playerGameStats(p.id)
  }));
  res.json({
    profile: progress.profileOf(me),
    missions: progress.missionsFor(me),
    rivals: progress.rivalsFor(me),
    seasonRank: progress.mySeasonRank(me),
    players
  });
});

/** The honest live strip: real counts, zero when quiet. */
app.get('/api/arena/live', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  res.json(progress.liveNow());
});

/** Missions are daily, derived from today's confirmed matches; claim is
 *  idempotent per day per mission. */
app.post('/api/arena/missions/:key/claim', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const row = progress.claimMission(me, req.params.key);
    res.status(201).json({ claimed: row, missions: progress.missionsFor(me), profile: progress.profileOf(me) });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

/** Season leaderboard (XP this season) with the caller's own row. */
app.get('/api/arena/season/leaderboard', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  res.json({ ...progress.seasonLeaderboard({}), you: progress.mySeasonRank(me) });
});
}

