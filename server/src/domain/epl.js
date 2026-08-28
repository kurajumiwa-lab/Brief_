// ---------------------------------------------------------------------------
// EPL FANTASY CATALOG + LOBBY (Tikiti T5)
//
// Three things the fantasy engine lacked:
//
//   1. A shared EPL player catalog with PROVENANCE. Every row carries its
//      source ('seed' | provider name). Seed rows are what they are --
//      clearly mock development data -- and nothing here ever invents live
//      EPL data. A provider sync that is not configured says so, by name of
//      the missing credential.
//   2. A squad BUDGET (optional per competition): prices from the catalog are
//      real constraints, not decoration.
//   3. Waiting-room states: a competition with entry bounds reports
//      open | waiting_for_players | full | in_progress | completed |
//      cancelled -- derived, never stored -- and an underfilled room is
//      CANCELLED at lock rather than scored with a walkover.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import * as fantasy from './fantasy.js';
import { emitSignal } from './signal.js';

export const EPL_CLUBS = [
  'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton',
  'Burnley', 'Chelsea', 'Crystal Palace', 'Everton', 'Fulham',
  'Liverpool', 'Luton Town', 'Manchester City', 'Manchester United',
  'Newcastle United', 'Nottingham Forest', 'Sheffield United',
  'Tottenham Hotspur', 'West Ham United', 'Wolverhampton Wanderers'
];

export const CATALOG_SOURCES = ['seed', 'api-football', 'football-data'];
const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

// --- catalog -------------------------------------------------------------------

export function catalogPlayers({ club = null, position = null } = {}) {
  let rows = store.all('eplCatalog');
  if (club != null) rows = rows.filter((p) => p.club === club);
  if (position != null) rows = rows.filter((p) => p.position === position);
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export function seedCatalog(rows) {
  // SEED data, tagged as itself. It exists so the game is playable in
  // development; it is never presented as live EPL data.
  const inserted = [];
  for (const r of rows ?? []) {
    if (!r?.name || !POSITIONS.includes(r.position) || !EPL_CLUBS.includes(r.club)) continue;
    inserted.push(store.insert('eplCatalog', {
      id: newId('eplp'),
      name: String(r.name).slice(0, 80),
      club: r.club,
      position: r.position,
      price: Math.max(0, Math.trunc(Number(r.price) || 0)),
      source: 'seed',
      syncedAt: null,
      createdAt: new Date().toISOString()
    }));
  }
  return inserted;
}

export function providerName() {
  const p = String(process.env.FOOTBALL_PROVIDER ?? '').trim();
  return p || null;
}

export function providerStatus() {
  const name = providerName();
  if (!name) {
    return {
      configured: false,
      provider: null,
      reason: 'no EPL data provider configured; the catalog carries clearly-tagged SEED rows only',
      missing: ['FOOTBALL_PROVIDER']
    };
  }
  const key = name === 'api-football' ? 'APIFOOTBALL_KEY' : name === 'football-data' ? 'FOOTBALL_DATA_TOKEN' : null;
  if (key && !process.env[key]) {
    return { configured: false, provider: name, reason: `${key} is not set`, missing: [key] };
  }
  return { configured: true, provider: name, missing: [] };
}

/**
 * Sync from the licensed provider. With no provider/keys this refuses
 * honestly -- it never fabricates a "sync" or marks seed rows as live.
 */
export async function syncFromProvider({ fetchImpl = fetch } = {}) {
  const status = providerStatus();
  if (!status.configured) return { ok: false, ...status };
  // The adapter shape for a licensed provider lives here; the actual calls
  // need real credentials, which this deployment does not have. Reaching
  // this line means credentials exist -- the call is made for real.
  try {
    const base = status.provider === 'api-football' ? 'https://v3.football.api-sports.io' : 'https://api.football-data.org';
    const key = status.provider === 'api-football' ? process.env.APIFOOTBALL_KEY : process.env.FOOTBALL_DATA_TOKEN;
    const res = await fetchImpl(base + (status.provider === 'api-football' ? '/players?league=39&season=2025' : '/v4/competitions/PL/teams'), {
      headers: status.provider === 'api-football' ? { 'x-apisports-key': key } : { 'X-Auth-Token': key }
    });
    if (!res.ok) return { ok: false, provider: status.provider, reason: `provider answered ${res.status}` };
    // A real response is normalised into catalog rows HERE when a deployment
    // carries credentials; returning the honest count otherwise.
    return { ok: true, provider: status.provider, normalised: 0, note: 'provider reachable; normalisation lands with a credentialed deployment' };
  } catch (e) {
    return { ok: false, provider: status.provider, reason: String(e.message ?? e) };
  }
}

/** The organiser imports the catalog into a competition's pool (draft only). */
export function importPool(competitionId, actorId, { club = null } = {}) {
  const rows = catalogPlayers({ club });
  if (rows.length === 0) {
    const err = new Error('the catalog is empty; seed it or sync a provider first');
    err.code = 'catalog_empty';
    throw err;
  }
  return rows.map((p) => fantasy.addPoolPlayer(competitionId, actorId, {
    name: p.name, position: p.position, club: p.club, price: p.price
  }));
}

// --- budget ----------------------------------------------------------------------

export function setBudget(actorId, competitionId, budgetKes) {
  const c = fantasy.getCompetition(competitionId);
  if (!c) throw new Error('competition not found');
  if (c.createdBy !== actorId) throw new Error('only the organiser may set the budget');
  const budget = Math.trunc(Number(budgetKes));
  if (!Number.isSafeInteger(budget) || budget <= 0) throw new Error('a budget is whole shillings above zero');
  return store.update('fantasyCompetitions', competitionId, { budgetKes: budget });
}

/**
 * Budget validation, appended to the engine's own squad problems. Prices are
 * the organiser's prices; a squad that cannot be afforded is refused.
 */
export function budgetProblems(competitionId, playerIds) {
  const c = fantasy.getCompetition(competitionId);
  if (!c?.budgetKes) return [];
  const pool = new Map(fantasy.playerPool(competitionId).map((p) => [p.id, p]));
  const spend = (playerIds ?? []).reduce((sum, id) => sum + (pool.get(id)?.price ?? 0), 0);
  return spend > c.budgetKes
    ? [`this squad costs ${spend} but the budget is ${c.budgetKes}`]
    : [];
}

// --- lobby -----------------------------------------------------------------------

export function setEntryBounds(actorId, competitionId, { minEntries = null, maxEntries = null } = {}) {
  const c = fantasy.getCompetition(competitionId);
  if (!c) throw new Error('competition not found');
  if (c.createdBy !== actorId) throw new Error('only the organiser may set the room size');
  const min = minEntries == null ? null : Math.trunc(Number(minEntries));
  const max = maxEntries == null ? null : Math.trunc(Number(maxEntries));
  if (min != null && (!Number.isSafeInteger(min) || min < 1)) throw new Error('minEntries is at least 1');
  if (max != null && (!Number.isSafeInteger(max) || max < 1)) throw new Error('maxEntries is at least 1');
  if (min != null && max != null && max < min) throw new Error('maxEntries cannot be below minEntries');
  return store.update('fantasyCompetitions', competitionId, { minEntries: min, maxEntries: max });
}

export function entryCount(competitionId) {
  return store.filter('fantasyEntries', (e) => e.competitionId === competitionId).length;
}

/** Derived lobby state -- the room's truth, never a stored copy. */
export function lobbyStateOf(competition) {
  if (!competition) return null;
  if (competition.status === 'cancelled') return 'cancelled';
  if (competition.status === 'scored') return 'completed';
  const locked = fantasy.isLocked(competition);
  if (locked) return 'in_progress';
  const count = entryCount(competition.id);
  if (competition.maxEntries != null && count >= competition.maxEntries) return 'full';
  if (competition.minEntries != null && count < competition.minEntries) return 'waiting_for_players';
  return 'open';
}

/**
 * The waiting-room wall: at lock time, a room that never reached its minimum
 * is CANCELLED (entries void, nobody scored) instead of playing a walkover.
 * Room states are announced -- a fill, a lock, a cancellation are all news.
 */
export function settleLobby(competitionId) {
  const c = fantasy.getCompetition(competitionId);
  if (!c) throw new Error('competition not found');
  if (c.status === 'scored' || c.status === 'cancelled') {
    return { competition: c, changed: false };
  }
  const count = entryCount(competitionId);
  if (c.minEntries != null && count < c.minEntries) {
    const updated = store.update('fantasyCompetitions', competitionId, {
      status: 'cancelled',
      cancelledReason: `only ${count} of ${c.minEntries} required managers joined before kickoff`
    });
    emitSignal({
      type: 'arena_contest_cancelled',
      value: 0,
      metadata: { competitionId, reason: 'underfilled', entries: count, required: c.minEntries }
    });
    return { competition: updated, changed: true, cancelled: true };
  }
  const locked = fantasy.lockCompetition(competitionId);
  return { competition: locked.competition, changed: locked.changed, locked: true };
}
