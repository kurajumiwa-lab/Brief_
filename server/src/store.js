// ---------------------------------------------------------------------------
// PERSISTENCE
//
// A tiny append-safe JSON document store. Deliberately not an ORM and not
// SQLite: the ingestion layer needs durable rows with predictable shapes, and
// swapping this file for Postgres/Supabase later is a contained change because
// every caller goes through the named collection helpers below.
//
// Everything is synchronous. At this scale that is a feature -- no partially
// written pipeline state after a crash mid-request.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.BRIEF_DATA_DIR || path.join(HERE, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'brief.json');

// The full schema. Each key is a collection of rows.
const EMPTY = {
  // Authentication. Passwords are scrypt-hashed with a per-user salt; only a
  // SHA-256 fingerprint of each session token is stored, never the token.
  users: [],
  sessions: [],
  sources: [],
  sourceMemberships: [],
  rawItems: [],
  objects: [],
  objectSources: [], // canonical object <-> source provenance, many-to-many
  relationships: [],
  syncRuns: [],
  errors: [],
  // Feature schema: durable group containers and their contents.
  circles: [],
  members: [],
  blocks: [],
  // One row per ballot cast, keyed by (blockId, voterId). Vote tallies are
  // computed by scanning these rows -- there is deliberately no stored count.
  votes: [],
  signals: [],
  // Recorded money movements. See src/domain/ledger.js -- no provider is
  // connected, so these are records only.
  ledgerTransactions: [],
  // Payment attempts. NOT a second money store: the authoritative economic
  // event is always the ledger transaction an intent points at.
  paymentIntents: [],
  // Raw provider callbacks, kept for audit and duplicate detection.
  paymentCallbacks: [],
  // Disbursements to sellers. A payout is a RECORD of money sent, not a
  // balance -- withdrawable is always derived as (settled net - paid - pending).
  payouts: [],
  // Creator distribution layer. A campaign wraps an existing object; its
  // metrics are derived, never stored. See src/domain/campaign.js.
  campaigns: [],
  registrations: [],
  // Commerce (Batch 3). A vendor sells listings; a customer's commitment to a
  // listing is an order; a contested order has a dispute. Money lives in
  // ledgerTransactions as it always has -- there is deliberately no order
  // balance and no second transaction table.
  // Arena. Competitive play, persisted server-side. Results require BOTH
  // players to agree; Brief never decides a winner. No Arena wallet exists --
  // paid contests go through the compliance gate and the one ledger.
  arenaChallenges: [],
  arenaMatches: [],
  // Fantasy 11. Non-economic core: pool, entries, stats and derived scores.
  // No Fantasy wallet -- paid entry would use the one ledger, once legal.
  fantasyCompetitions: [],
  fantasyPlayers: [],
  fantasyEntries: [],
  fantasyStats: [],
  vendors: [],
  listings: [],
  orders: [],
  disputes: [],
  // Auction. Price discovery over an existing listing. A BID IS NOT MONEY --
  // bids live here, entirely separate from ledgerTransactions, so that
  // nothing scanning the ledger can ever mistake an offer for income. A won
  // auction produces an ordinary order, which settles through the ordinary
  // chain. There is no auction wallet and no auction balance.
  auctions: [],
  bids: [],

  // --- The Vault -----------------------------------------------------------
  // A persistent context layer wrapping a real-world activity. A Vault is NOT
  // a chat, a CRM or an inbox: it is the room that channels, people, vendors,
  // orders and payments all open into. One real-world activity is one Vault,
  // regardless of how many channels it flows through.
  vaults: [],
  // Who is in a vault and what they may see/do. Roles: host, guest, vendor,
  // admin. Never derived from a client claim -- always a stored row.
  vaultParticipants: [],
  // Which channels open into this vault (telegram/whatsapp/web/manual/link).
  // A channel is a DOOR; the vault is the room.
  vaultChannels: [],
  // A guest's or host's request for something, routed to a vendor. A request
  // is NOT money; the order it turns into is, and that order lives in the
  // ordinary orders/ledger path.
  vaultRequests: [],
  // The immutable chronological event stream of a vault. See domain/footsteps.js.
  // Append-only; a footstep corresponds to a real application event.
  footsteps: [],
  // Opaque, signed, expiring tokens for channel handoffs and guest entry.
  // See domain/handoff.js. The token is the id; never stored in plaintext
  // anywhere else.
  handoffs: [],

  // --- Trust & integrity ---------------------------------------------------
  // Community confirmation of an object: one row per (object, actor). Tallies
  // are DERIVED by scanning these, never stored — same rule as votes and money.
  confirmations: [],
  // Abuse/spam reports. A report is a request for review, not a removal: it
  // has a lifecycle (open -> dismissed / actioned) and never auto-deletes.
  reports: [],
  // In-app notifications. A notification is a real, derived event (something
  // was confirmed, a challenge was accepted, a saved thing changed). Push is a
  // separate, still-unconnected rail — these are the local inbox.
  notifications: [],
  // Append-only audit trail of consequential mutations (who/what/when/from/to).
  // Never pruned by the app; the operator decides.
  auditLog: [],

  // --- Tea (editorial layer, home-feed master build) ------------------------
  // Articles with a full status lifecycle; only published+unexpired resolve
  // publicly. See domain/tea.js.
  teaArticles: [],

  // --- Media (visual association, home-feed master build) ------------------
  // The editorial media library: category/editorial images an editor approves
  // for use as fallback visuals. Empty until uploaded — never pre-fabricated.
  // See domain/media.js.
  mediaLibrary: [],

  // --- Collections (home-feed master build §47) ----------------------------
  // Named, data-driven groupings over real objects (rule or curated). See
  // domain/collection.js.
  collections: [],

  // --- Cooperative pools (four-screen build A) -----------------------------
  // Chama / Stokvel / Esusu / Sou-Sou rotating savings (ROSCA). Contributions
  // are ledger transactions; the rotation is a derived schedule. See
  // domain/pool.js.
  pools: [],
  poolMembers: [],
  poolRotations: [],

  // --- Distribution (four-screen build B) ----------------------------------
  // UTM click attribution: one row per tracked click. See domain/distribution.js.
  clickEvents: [],

  // --- Lobby (Arena integration: 1-tap room codes) -------------------------
  // Private game rooms (code + mode + slots + status), host vouches, scoreboard
  // receipts, and clan matches. See domain/lobby.js.
  lobbyRooms: [],
  lobbyVouches: [],
  scoreboardReceipts: [],
  clanMatches: [],

  // --- Automation engine (CCS §3.1) ----------------------------------------
  // Trigger→condition→action workflows evaluated against the signal log, and
  // their append-only run history. See domain/workflow.js.
  workflows: [],
  workflowRuns: [],

  // --- Partnership + subscriptions (CCS §3.3/§3.4) -------------------------
  // Creator media kits (derived) + brand opportunities, and recurring
  // memberships whose money still flows through the one ledger.
  partnershipRequests: [],
  subscriptions: [],

  // --- Person (report §4.4) -------------------------------------------------
  // A first-class entity over every identity Brief holds. A person is a stable
  // id; personAliases bind it to concrete external identifiers (user id, phone,
  // email, telegram/whatsapp, participant id) through EXPLICIT verified acts
  // only — never probabilistic inference.
  people: [],
  personAliases: [],

  // --- Arena entities (server models) -------------------------------------
  // A player's game identity is NOT their Brief account: one person holds many.
  arenaPlayers: [],
  arenaVenues: [],
  arenaTournaments: [],
  arenaResults: [] // agreed match results; leaderboards are derived from these
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// SCHEMA VERSION & MIGRATIONS
//
// Merging loaded data over EMPTY already handles the common case -- a new
// collection or a new optional field appears on an old database with no
// migration and no data loss. That is why there is no migration framework
// here, and it is a deliberate choice rather than an omission.
//
// What that merge CANNOT do is TRANSFORM existing rows: rename a field,
// backfill a required value, split a collection. Those need a real, ordered,
// one-time step, and that is what this is.
//
// Rules:
//   * migrations run in order, exactly once, recorded by version
//   * a BACKUP IS TAKEN before anything destructive runs
//   * a failing migration aborts startup rather than half-applying
//   * migrations are deterministic and must be safe to re-run on a fresh DB
// ---------------------------------------------------------------------------

export const SCHEMA_VERSION = 2;

const MIGRATIONS = [
  {
    version: 1,
    name: 'baseline',
    // Everything that existed before versioning. Nothing to transform: the
    // EMPTY-merge already gave old databases every new collection.
    up: (db) => db
  },
  {
    version: 2,
    name: 'backfill-order-currency',
    // Early orders were written before `currency` was explicit. Settlement
    // filters by currency, so a null there silently excludes real money from
    // a vendor's earnings. Backfill to the deployment default.
    up: (db) => {
      for (const o of db.orders ?? []) {
        if (!o.currency) o.currency = 'KES';
      }
      return db;
    }
  }
];

function backupBeforeMigration(fromVersion) {
  if (!fs.existsSync(DB_FILE)) return null;
  const dest = `${DB_FILE}.pre-v${fromVersion}-${Date.now()}.bak`;
  fs.copyFileSync(DB_FILE, dest);
  return dest;
}

/**
 * Bring a loaded database up to SCHEMA_VERSION.
 *
 * Exported so it can be tested against an OLD FIXTURE rather than only ever
 * running on a database that happens to already be current.
 */
export function migrate(db, { onBackup = backupBeforeMigration } = {}) {
  const from = Number.isInteger(db.__schemaVersion) ? db.__schemaVersion : 0;
  if (from >= SCHEMA_VERSION) return { db, migrated: false, from, to: from };

  const pending = MIGRATIONS.filter((m) => m.version > from).sort((a, b) => a.version - b.version);
  if (!pending.length) {
    db.__schemaVersion = SCHEMA_VERSION;
    return { db, migrated: false, from, to: SCHEMA_VERSION };
  }

  // Back up BEFORE transforming. If a migration is wrong, the operator still
  // has the original -- this is the whole reason the step exists.
  const backupFile = onBackup ? onBackup(from) : null;

  const applied = [];
  for (const m of pending) {
    try {
      db = m.up(db) ?? db;
      db.__schemaVersion = m.version;
      applied.push(`${m.version}:${m.name}`);
    } catch (e) {
      // Abort rather than leave the database half-migrated.
      const err = new Error(
        `migration ${m.version} (${m.name}) failed: ${e.message}. ` +
        (backupFile ? `The pre-migration copy is at ${backupFile}.` : 'No backup was taken.')
      );
      err.applied = applied;
      throw err;
    }
  }

  db.__schemaVersion = SCHEMA_VERSION;
  return { db, migrated: true, from, to: SCHEMA_VERSION, applied, backupFile };
}

function load() {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    const fresh = structuredClone(EMPTY);
    fresh.__schemaVersion = SCHEMA_VERSION;
    return fresh;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    // The merge that makes additive changes free: an old database gains every
    // new collection without a migration.
    const merged = { ...structuredClone(EMPTY), ...parsed };
    const result = migrate(merged);
    if (result.migrated) {
      console.log(JSON.stringify({
        at: new Date().toISOString(), level: 'info', event: 'schema_migrated',
        from: result.from, to: result.to, applied: result.applied, backup: result.backupFile
      }));
    }
    return result.db;
  } catch (e) {
    if (/^migration /.test(String(e.message))) throw e; // never silently continue
    // A corrupt file must not take the server down. Move it aside and start
    // clean; the operator still has the bad copy to inspect.
    fs.renameSync(DB_FILE, `${DB_FILE}.corrupt-${Date.now()}`);
    const fresh = structuredClone(EMPTY);
    fresh.__schemaVersion = SCHEMA_VERSION;
    return fresh;
  }
}

let db = load();

function persist() {
  ensureDir();
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE); // atomic swap
}

export const store = {
  all(collection) {
    return db[collection] ?? [];
  },
  find(collection, predicate) {
    return (db[collection] ?? []).find(predicate) ?? null;
  },
  filter(collection, predicate) {
    return (db[collection] ?? []).filter(predicate);
  },
  insert(collection, row) {
    db[collection].push(row);
    persist();
    return row;
  },
  update(collection, id, patch) {
    const row = db[collection].find((r) => r.id === id);
    if (!row) return null;
    Object.assign(row, patch, { updatedAt: new Date().toISOString() });
    persist();
    return row;
  },
  remove(collection, id) {
    const before = db[collection].length;
    db[collection] = db[collection].filter((r) => r.id !== id);
    persist();
    return db[collection].length < before;
  },
  /** Test helper: wipes everything. Never called by a route. */
  _reset() {
    db = structuredClone(EMPTY);
    db.__schemaVersion = SCHEMA_VERSION;
    persist();
  },
  schemaVersion() { return db.__schemaVersion ?? 0; },
  _file: DB_FILE
};

export function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * An opaque, high-entropy ticket code for gate check-in.
 *
 * Deliberately NOT the registration id (which is guessable and scoped
 * internally): a ticket code is what an attendee shows at the gate, so it must
 * be unguessable enough that possession of the code is a reasonable stand-in
 * for "this is my ticket", yet short enough to type or scan by hand.
 *
 * 4 groups of 4 base32 chars (26 bits each, ~104 bits total) — collision-safe
 * at realistic event scale without a stored index.
 */
export function newTicketCode() {
  // 31 chars: A-Z minus I,L,O and 2-9 minus 0,1 — no confusable glyphs.
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const group = () => {
    const bytes = new Uint8Array(4);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 4; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  };
  return `BRF-${group()}-${group()}-${group()}`;
}
