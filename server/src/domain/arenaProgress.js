// ---------------------------------------------------------------------------
// ARENA PROGRESSION — the retention layer under the existing Arena.
//
// Everything here is DERIVED from confirmed matches and append-only reward
// events. Nothing is a stored counter:
//   • XP and Coins live in `arenaEvents` rows written once per confirmed
//     match (idempotent by key) and once per claimed mission.
//   • Level is a function of XP. Streak is a replay of the player's
//     confirmed matches. Rating is an Elo replay of those same rows — a
//     number the system can justify, per the evidence rule in playerRecord.
//   • Missions are DAILY and their progress is computed from today's real
//     confirmed matches; a mission nobody can complete yet says so.
//   • The season is a calendar fact, not a row.
// The live strip counts real things only: open challenges, matches awaiting
// confirmation, and distinct players with arena activity in the last hour.
// An empty arena reports "quiet", never a fabricated population.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { getUser } from './auth.js';
import { listMatchesFor } from './arena.js';

export const XP_PER_LEVEL = 500;
export const REWARDS = { win: { xp: 100, coins: 25 }, played: { xp: 30, coins: 0 } };

export const SEASON = {
  id: 'season-01',
  label: 'Season 01',
  startedAt: '2026-08-30T00:00:00.000Z',
  endsAt: '2026-09-29T00:00:00.000Z'
};

// --- reward events (append-only, idempotent by key) ---------------------------

function grant({ userId, key, kind, xp = 0, coins = 0, meta = {} }) {
  if (!userId) return null;
  if (store.find('arenaEvents', (e) => e.key === key)) return null; // once, ever
  return store.insert('arenaEvents', {
    id: newId('aev'), userId, key, kind, xp, coins, meta, at: new Date().toISOString()
  });
}

// Matches may reference either a user id or an arenaPlayers id; both resolve
// to the human who earns.
function resolveUser(ref) {
  if (!ref || ref === 'draw') return null;
  if (store.find('users', (u) => u.id === ref)) return ref;
  const p = store.find('arenaPlayers', (x) => x.id === ref);
  return p?.userId ?? null;
}
const inMatch = (m, userId) => resolveUser(m.playerAId) === userId || resolveUser(m.playerBId) === userId;
const wonMatch = (m, userId) => resolveUser(m.winnerPlayerId) === userId;

/** Called by arena.confirmResult: both participants earn from a CONFIRMED
 *  result only. The winner earns more. Idempotent per match. */
export function grantForConfirmedMatch(match) {
  if (match.status !== 'confirmed') return null;
  const rows = [];
  const sides = [...new Set([resolveUser(match.playerAId), resolveUser(match.playerBId)].filter(Boolean))];
  for (const userId of sides) {
    const won = wonMatch(match, userId);
    const r = won ? REWARDS.win : REWARDS.played;
    rows.push(grant({
      userId,
      key: `arena:match:${match.id}:${userId}`,
      kind: won ? 'match_win' : 'match_played',
      xp: r.xp, coins: r.coins,
      meta: { matchId: match.id }
    }));
  }
  return rows.filter(Boolean);
}

// --- the profile: level, xp, coins — all derived ------------------------------

export function xpTotals(userId, { since = null } = {}) {
  let xp = 0, coins = 0;
  for (const e of store.all('arenaEvents')) {
    if (e.userId !== userId) continue;
    if (since && e.at < since) continue;
    xp += e.xp ?? 0;
    coins += e.coins ?? 0;
  }
  return { xp, coins };
}

export function profileOf(userId) {
  const { xp, coins } = xpTotals(userId, { since: SEASON.startedAt });
  const total = xpTotals(userId);
  const level = Math.floor(total.xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = total.xp % XP_PER_LEVEL;
  const today = new Date().toISOString().slice(0, 10);
  const todayConfirmed = myConfirmedMatchesToday(userId, today).length;
  return {
    userId,
    level, xpIntoLevel, xpPerLevel: XP_PER_LEVEL,
    seasonXp: xp, seasonCoins: coins, totalXp: total.xp, totalCoins: total.coins,
    matchesToday: todayConfirmed
  };
}

function myPlayers(userId) {
  return store.filter('arenaPlayers', (p) => p.userId === userId);
}

function myConfirmedMatchesToday(userId, day) {
  return confirmedOf(userId).filter((m) => String(m.confirmedAt ?? m.updatedAt ?? '').slice(0, 10) === day);
}

// --- per-player game stats: rating + streak by replay --------------------------

export function playerGameStats(playerId) {
  const userId = resolveUser(playerId) ?? playerId;
  const matches = confirmedOf(userId);
  const rating = replayAll().get(userId) ?? 1000;
  // Streak: consecutive wins ending at the most recent confirmed match.
  let streak = 0;
  for (let i = matches.length - 1; i >= 0; i--) {
    if (wonMatch(matches[i], userId)) streak++;
    else break;
  }
  const won = matches.filter((m) => wonMatch(m, userId)).length;
  return {
    playerId,
    rating,
    streak,
    played: matches.length,
    won,
    winRate: matches.length === 0 ? null : Math.round((won / matches.length) * 100)
  };
}

/** ONE deterministic replay of every confirmed match, in order, for everyone.
 *  No recursion, no cache, no stored number — the rating is a pure function
 *  of the confirmed rows. */
function confirmedOf(userId) {
  return store.all('arenaMatches')
    .filter((m) => m.status === 'confirmed' && inMatch(m, userId))
    .slice()
    .sort((a, b) => String(a.confirmedAt ?? a.updatedAt ?? '').localeCompare(String(b.confirmedAt ?? b.updatedAt ?? '')));
}

function replayAll() {
  const rating = new Map();
  const matches = store.all('arenaMatches')
    .filter((m) => m.status === 'confirmed')
    .slice()
    .sort((a, b) => String(a.confirmedAt ?? a.updatedAt ?? '').localeCompare(String(b.confirmedAt ?? b.updatedAt ?? '')));
  for (const m of matches) {
    const a = resolveUser(m.playerAId);
    const b = resolveUser(m.playerBId);
    if (!a || !b) continue;
    const ra = rating.get(a) ?? 1000;
    const rb = rating.get(b) ?? 1000;
    const expectedA = 1 / (1 + Math.pow(10, (rb - ra) / 400));
    const actualA = m.winnerPlayerId === 'draw' ? 0.5 : (resolveUser(m.winnerPlayerId) === a ? 1 : 0);
    rating.set(a, ra + 32 * (actualA - expectedA));
    rating.set(b, rb + 32 * ((1 - actualA) - (1 - expectedA)));
  }
  return rating;
}

// --- daily missions -----------------------------------------------------------

export const MISSIONS = [
  { key: 'play_1', label: 'Play 1 match today', target: 1, reward: { xp: 50, coins: 0 }, hint: 'any confirmed match counts' },
  { key: 'win_2', label: 'Win 2 matches today', target: 2, reward: { xp: 150, coins: 0 }, hint: 'confirmed wins only' },
  { key: 'streak_3', label: 'Win 3 in a row', target: 3, reward: { xp: 0, coins: 300 }, hint: 'your best run today' }
];

export function missionsFor(userId) {
  const day = new Date().toISOString().slice(0, 10);
  const todays = myConfirmedMatchesToday(userId, day);
  const wins = todays.filter((m) => wonMatch(m, userId)).length;
  // Best win streak within today's matches.
  let best = 0, run = 0;
  for (const m of todays) {
    if (wonMatch(m, userId)) { run++; best = Math.max(best, run); } else run = 0;
  }
  const progress = { play_1: todays.length, win_2: wins, streak_3: best };
  return MISSIONS.map((mission) => {
    const claimed = Boolean(store.find('arenaEvents', (e) =>
      e.key === `arena:mission:${day}:${mission.key}:${userId}`));
    const value = Math.min(progress[mission.key] ?? 0, mission.target);
    return {
      ...mission,
      progress: value,
      complete: value >= mission.target,
      claimed,
      claimable: value >= mission.target && !claimed
    };
  });
}

export function claimMission(userId, missionKey) {
  const mission = MISSIONS.find((m) => m.key === missionKey);
  if (!mission) throw new Error('unknown mission');
  const state = missionsFor(userId).find((m) => m.key === missionKey);
  if (!state.complete) throw new Error(`not yet: ${mission.hint}`);
  if (state.claimed) throw new Error('already claimed today');
  const day = new Date().toISOString().slice(0, 10);
  const row = grant({
    userId,
    key: `arena:mission:${day}:${missionKey}:${userId}`,
    kind: 'mission',
    xp: mission.reward.xp, coins: mission.reward.coins,
    meta: { mission: missionKey, day }
  });
  if (!row) throw new Error('already claimed today');
  return row;
}

// --- the live strip: real counts only ------------------------------------------

export function liveNow() {
  const hourAgo = Date.now() - 3600_000;
  const active = new Set();
  let awaiting = 0;
  for (const m of store.all('arenaMatches')) {
    if (m.status === 'reported') awaiting++;
    if (['scheduled', 'reported'].includes(m.status) && Date.parse(m.createdAt ?? '') > hourAgo) {
      active.add(m.playerAId); active.add(m.playerBId);
    }
    if (m.status === 'confirmed' && Date.parse(m.confirmedAt ?? m.updatedAt ?? '') > hourAgo) {
      active.add(m.playerAId); active.add(m.playerBId);
    }
  }
  const openChallenges = store.filter('arenaChallenges', (c) => c.status === 'open').length;
  return {
    playersActiveLastHour: active.size,
    matchesAwaitingConfirmation: awaiting,
    openChallenges,
    season: { ...SEASON, daysRemaining: Math.max(0, Math.ceil((Date.parse(SEASON.endsAt) - Date.now()) / 86400_000)) }
  };
}

// --- season leaderboard (XP) with a YOU row ------------------------------------

export function seasonLeaderboard({ limit = 50 } = {}) {
  const byUser = new Map();
  for (const e of store.all('arenaEvents')) {
    if (e.at < SEASON.startedAt) continue;
    const row = byUser.get(e.userId) ?? { userId: e.userId, xp: 0, coins: 0 };
    row.xp += e.xp ?? 0;
    row.coins += e.coins ?? 0;
    byUser.set(e.userId, row);
  }
  const rows = [...byUser.values()]
    .map((r) => ({ ...r, displayName: getUser(r.userId)?.displayName ?? getUser(r.userId)?.handle ?? 'A player' }))
    .filter((r) => r.xp > 0 || r.coins > 0)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit)
    .map((r, i) => ({ rank: i + 1, ...r }));
  return { season: liveNow().season, rows };
}

export function mySeasonRank(userId) {
  const all = seasonLeaderboard({ limit: 100000 }).rows;
  const idx = all.findIndex((r) => r.userId === userId);
  return idx === -1 ? null : { rank: idx + 1, ...all[idx] };
}

// --- rivals: the people you keep playing ---------------------------------------

export function rivalsFor(userId) {
  const tally = new Map();
  for (const m of confirmedOf(userId)) {
    const other = resolveUser(m.playerAId) === userId ? resolveUser(m.playerBId) : resolveUser(m.playerAId);
    if (!other) continue;
    const t = tally.get(other) ?? { played: 0, iWon: 0 };
    t.played++;
    if (wonMatch(m, userId)) t.iWon++;
    tally.set(other, t);
  }
  return [...tally.entries()]
    .filter(([, t]) => t.played >= 2)
    .map(([rivalUserId, t]) => {
      const u = getUser(rivalUserId);
      return {
        userId: rivalUserId,
        displayName: u?.displayName ?? u?.handle ?? 'A rival',
        played: t.played,
        iWon: t.iWon,
        theyWon: t.played - t.iWon
      };
    })
    .sort((a, b) => b.played - a.played)
    .slice(0, 5);
}
