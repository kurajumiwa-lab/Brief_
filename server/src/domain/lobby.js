// ---------------------------------------------------------------------------
// LOBBY — the 1-tap private-lobby code board (Arena integration)
//
// The market-standard pattern for private game rooms (what WeChat/QQ gaming
// groups and Discord servers standardized): a host drops a room code, players
// tap to copy it and join in-game, and the host's reputation decides whether
// their rooms are trusted. Nothing here invents game state — Brief only carries
// the room CODE and the host's word for mode/slots; the game itself owns the
// actual match.
//
//   ROOM      a host's live lobby: code + mode + open slots + status. "started"
//             hides the code so nobody wastes time joining a closed room.
//   VOUCH     binary thumbs-up/down on a host → a derived "Verified Lobby
//             Master" badge once they earn enough trust. Bad hosts get filtered.
//   SCOREBOARD an endgame screenshot receipt. Brief stores the attachment and
//             marks it "pending verification" — it does NOT claim to OCR it:
//             no vision provider is configured, so it is honest about that.
//   CLAN      two communities (neighbourhoods / chamas) challenge each other to
//             a scheduled match sequence; the code board + scoreboards feed a
//             regional ranking. A clan match is structure over rooms, not a
//             fabricated result.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { GAME_IDS } from './arena.js';

const CODE_RE = /^\d{4,8}$/;

export const ROOM_STATUS = ['open', 'started', 'closed'];

export function createRoom({ gameId, code, mode = null, hostId, maxSlots = 8 }) {
  if (!gameId || !GAME_IDS.includes(gameId)) throw new Error(`gameId must be one of ${GAME_IDS.join(', ')}`);
  if (!hostId) throw new Error('a host is required');
  if (!CODE_RE.test(String(code ?? ''))) throw new Error('a room code is 4-8 digits');
  if (!Number.isInteger(maxSlots) || maxSlots < 2 || maxSlots > 64) throw new Error('maxSlots must be 2-64');
  const now = new Date().toISOString();
  return store.insert('lobbyRooms', {
    id: newId('room'),
    gameId,
    code: String(code),
    mode: mode ? String(mode).slice(0, 40) : null,
    hostId,
    maxSlots,
    claims: [],          // player ids that claimed a slot
    status: 'open',
    createdAt: now,
    startedAt: null,
    closedAt: null
  });
}

export function getRoom(id) {
  return store.find('lobbyRooms', (r) => r.id === id) ?? null;
}

/** Claim an open slot (idempotent per player; refused when full or not open). */
export function claimSlot(roomId, playerId) {
  const room = getRoom(roomId);
  if (!room) throw new Error('room not found');
  if (room.status !== 'open') throw new Error('room is not open');
  if (room.claims.includes(playerId)) return { room, reused: true };
  if (room.claims.length >= room.maxSlots) throw new Error('room is full');
  const claims = [...room.claims, playerId];
  store.update('lobbyRooms', roomId, { claims });
  return { room: store.find('lobbyRooms', (r) => r.id === roomId), reused: false };
}

/** The host flags the match as started: the code disappears from the board. */
export function startRoom(roomId, hostId) {
  const room = getRoom(roomId);
  if (!room) throw new Error('room not found');
  if (room.hostId !== hostId) throw new Error('only the host may start the room');
  if (room.status !== 'open') throw new Error('room is not open');
  return store.update('lobbyRooms', roomId, { status: 'started', startedAt: new Date().toISOString() });
}

export function closeRoom(roomId, hostId) {
  const room = getRoom(roomId);
  if (!room) throw new Error('room not found');
  if (room.hostId !== hostId) throw new Error('only the host may close the room');
  return store.update('lobbyRooms', roomId, { status: 'closed', closedAt: new Date().toISOString() });
}

/** Open rooms for a game, newest first. Started/closed rooms are hidden. */
export function listOpenRooms({ gameId = null } = {}) {
  let rows = store.filter('lobbyRooms', (r) => r.status === 'open');
  if (gameId) rows = rows.filter((r) => r.gameId === gameId);
  return rows.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/** The public board projection: the code, slots, mode — and the host's trust. */
export function roomView(roomOrId) {
  const room = typeof roomOrId === 'string' ? getRoom(roomOrId) : roomOrId;
  if (!room) return null;
  return {
    id: room.id,
    gameId: room.gameId,
    code: room.status === 'open' ? room.code : null, // a started room hides its code
    mode: room.mode,
    maxSlots: room.maxSlots,
    slotsTaken: room.claims.length,
    slotsOpen: room.maxSlots - room.claims.length,
    status: room.status,
    hostId: room.hostId,
    hostTrust: hostTrust(room.hostId)
  };
}

// ---------------------------------------------------------------------------
// HOST VOUCHING (Verified Lobby Master)
// ---------------------------------------------------------------------------

/** One vouch per (host, voter). A re-vouch replaces the prior one. */
export function vouchHost(hostId, voterId, up) {
  if (!hostId || !voterId) throw new Error('host and voter are required');
  if (hostId === voterId) throw new Error('a host cannot vouch for themselves');
  const existing = store.find('lobbyVouches', (v) => v.hostId === hostId && v.voterId === voterId);
  const now = new Date().toISOString();
  if (existing) {
    return store.update('lobbyVouches', existing.id, { up: Boolean(up), at: now });
  }
  return store.insert('lobbyVouches', { id: newId('vouch'), hostId, voterId, up: Boolean(up), at: now });
}

/** Derived host trust: up/down counts and a binary verified badge. */
export function hostTrust(hostId) {
  const rows = store.filter('lobbyVouches', (v) => v.hostId === hostId);
  const up = rows.filter((v) => v.up).length;
  const down = rows.length - up;
  // Market-standard threshold: a host is "verified" after 3 net-positive
  // vouches. It is DERIVED, never stored, so it can never drift from the rows.
  const verified = up >= 3 && up > down;
  return { up, down, verified, label: verified ? 'Verified Lobby Master' : null };
}

// ---------------------------------------------------------------------------
// SCOREBOARD RECEIPTS (honest — no fabricated OCR)
// ---------------------------------------------------------------------------

/**
 * Accept an endgame screenshot receipt. Brief stores the attachment and marks
 * it pending verification; it does NOT claim to have parsed the image (no
 * vision provider is configured). The leaderboard updates only when a result is
 * CONFIRMED by both players through the existing arena confirmResult path.
 */
export function recordScoreboard({ roomId, actorId, imageUrl = null, note = null }) {
  const room = getRoom(roomId);
  if (!room) throw new Error('room not found');
  return store.insert('scoreboardReceipts', {
    id: newId('sb'),
    roomId,
    actorId,
    imageUrl,
    note,
    status: 'pending_review', // honest: not parsed, not trusted
    createdAt: new Date().toISOString()
  });
}

export function listScoreboards({ roomId = null } = {}) {
  let rows = store.all('scoreboardReceipts');
  if (roomId) rows = rows.filter((r) => r.roomId === roomId);
  return rows.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

// ---------------------------------------------------------------------------
// CLAN MATCHES (neighbourhood / chama rivalry)
// ---------------------------------------------------------------------------

export const CLAN_STATUS = ['scheduled', 'active', 'completed', 'cancelled'];

export function createClanMatch({ title, homeLabel, awayLabel, gameId, hostId, startsAt = null }) {
  if (!title || !homeLabel || !awayLabel) throw new Error('title, homeLabel and awayLabel are required');
  if (!gameId || !GAME_IDS.includes(gameId)) throw new Error('invalid gameId');
  const now = new Date().toISOString();
  return store.insert('clanMatches', {
    id: newId('clan'),
    title: String(title).trim(),
    homeLabel: String(homeLabel).trim(),
    awayLabel: String(awayLabel).trim(),
    gameId,
    hostId,
    status: 'scheduled',
    startsAt,
    createdAt: now,
    updatedAt: now
  });
}

export function transitionClan(id, action, actorId) {
  const m = store.find('clanMatches', (x) => x.id === id);
  if (!m) throw new Error('clan match not found');
  if (m.hostId !== actorId) throw new Error('only the organiser may change the clan match');
  const map = { activate: ['scheduled', 'active'], complete: ['active', 'completed'], cancel: ['scheduled', 'cancelled'] };
  const t = map[action];
  if (!t) throw new Error(`unknown action: ${action}`);
  if (!t.includes(m.status)) throw new Error(`cannot ${action} from ${m.status}`);
  return store.update('clanMatches', id, { status: t[1], updatedAt: new Date().toISOString() });
}

export function listClanMatches({ status = null } = {}) {
  let rows = store.all('clanMatches');
  if (status) rows = rows.filter((m) => m.status === status);
  return rows.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
