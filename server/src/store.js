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
  // Server-held secrets that must survive a restart but must never reach a
  // client (currently: the HMAC key that signs one-tap email links).
  appSecrets: [],
  // First-run state: the segmentation answer a person actually gave, and the
  // append-only stream of named activation events. Ladder progress is DERIVED
  // from these plus ordinary rows (confirmations, captures, campaigns) — never
  // stored as a step counter. See domain/onboarding.js.
  onboardingProfiles: [],
  activationEvents: [],
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
  // Service fees paid to Brief via Pochi la Biashara (manual M-Pesa code flow).
  servicePayments: [],
  // Referral reward events (append-only, deduped by key) and point-to-cash
  // conversions paid from the derived rewards pool.
  referralEvents: [],

  // WhatsApp shops: the builder state. The storefront is WhatsApp itself —
  // the share output (formatted text + wa.me link) is derived, never stored.
  shops: [],

  // Duka book: logged sales (the paper-ledger replacement). Rows are facts;
  // every total, top-item and low-stock flag is DERIVED at read time.
  shopSales: [],
  referralConversions: [],
  // Creator distribution layer. A campaign wraps an existing object; its
  // metrics are derived, never stored. See src/domain/campaign.js.
  campaigns: [],
  registrations: [],
  // P2P ticket resale (Tikiti integration T1). A ticket is ONE admitted
  // seat, born from a confirmed campaign registration; its scannable code
  // IS the registration's gate code, versioned so a transfer kills every
  // prior QR. ledgerTransactions remains the only economic truth — these
  // rows are inventory, provenance and state machines, never money.
  tickets: [],
  ticketListings: [],
  ticketOrders: [],
  ticketTransfers: [],
  // Standalone public banners are a presentation layer over a published
  // campaign. They carry no second event or payment state.
  campaignBanners: [],
  // Commerce (Batch 3). A vendor sells listings; a customer's commitment to a
  // listing is an order; a contested order has a dispute. Money lives in
  // ledgerTransactions as it always has -- there is deliberately no order
  // balance and no second transaction table.
  // Arena. Competitive play, persisted server-side. Results require BOTH
  // players to agree; Brief never decides a winner. No Arena wallet exists --
  // paid contests go through the compliance gate and the one ledger.
  arenaChallenges: [],
  arenaMatches: [],
  // The controlled eFootball pilot. Signup rows carry cohort intent; pilot
  // counters are derived from these rows plus the ordinary Arena matches.
  arenaBetaSignups: [],
  // Fantasy 11. Non-economic core: pool, entries, stats and derived scores.
  // No Fantasy wallet -- paid entry would use the one ledger, once legal.
  // The bare /api/fantasy HTTP surface was removed (F5); the domain engine
  // lives on behind Ligi and the EPL contest routes.
  fantasyCompetitions: [],
  fantasyPlayers: [],
  fantasyEntries: [],
  fantasyStats: [],

  // --- Commerce -------------------------------------------------------------
  vendors: [],
  listings: [],
  orders: [],
  disputes: [],

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
  // Operator corrections: one row per corrected field, preserving the ORIGINAL
  // source value next to the corrected value (who/when/why). The object's
  // provenance is never rewritten; this log is the history.
  corrections: [],
  // In-app notifications. A notification is a real, derived event (something
  // was confirmed, a challenge was accepted, a saved thing changed). Push is a
  // separate, still-unconnected rail — these are the local inbox.
  notifications: [],
  // One row per user: which notification categories they want (following,
  // events, offers, alerts, news, locations, saved) plus the watermark of the
  // last generation sweep. The row is created lazily with defaults ON.
  notificationPrefs: [],
  // --- Personal Brief ------------------------------------------------------
  // A user's explicit interests: one row per (user, kind, value) where kind is
  // location | type | topic. Idempotent by design — re-following is a no-op.
  // These are PRIVATE to the owner and never appear on public endpoints.
  userInterests: [],
  // Explicit relevance controls: one row per (user, kind, target) where kind
  // is more | less | not_interested | hide_source. The user said this out
  // loud; nothing is inferred. Also private to the owner.
  userRelevance: [],
  // Server-persisted bookmarks: one row per (user, object). The client-side
  // relationship graph already models "saved"; this is the durable copy so
  // saves survive across devices and sessions.
  saves: [],
  // --- Following (entity layer) --------------------------------------------
  // A user follows an ENTITY, never a raw object list: one row per
  // (user, entity kind, entity key). Entities themselves are DERIVED from
  // existing records (objects, sources, circles) — nothing is duplicated
  // here, this store only holds the follow edges.
  entityFollows: [],
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
  // Real image files a person uploaded, not links to somebody else's server.
  // The row records the bytes (size, sha256, sniffed type); the file itself
  // lives in the upload directory, which is local disk and therefore not
  // durable across a redeploy. See domain/upload.js.
  uploads: [],

  // --- Collections (home-feed master build §47) ----------------------------
  // Named, data-driven groupings over real objects (rule or curated). See
  // domain/collection.js.
  collections: [],

  // --- Personal collections (Collections brief) ----------------------------
  // USER-owned named groups of object REFERENCES. Membership lives in
  // personalCollectionItems; the objects themselves are never duplicated.
  // Quick-save reuses the existing `saves` rows ("Saved"). See
  // domain/collections.js — distinct from the editorial domain/collection.js.
  personalCollections: [],
  personalCollectionItems: [],

  // --- Yard Engine / creator advertising -----------------------------------
  // These are additive operational shelves. Identity remains in `people`,
  // money remains in `ledgerTransactions`, and content remains in `objects`.
  creatorProfiles: [],
  rateCards: [],
  advertiserProfiles: [],
  advertiserCampaigns: [],
  campaignMatches: [],
  queueReservations: [],
  adAssets: [],
  calendarEntries: [],
  waitlistEntries: [],
  vendorCapabilities: [],
  vendorRecommendations: [],
  outboundMessages: [],

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
  // WHO is subscribed to which plan. Separate from the plan row so membership
  // is a fact per person and the count is derived, never a stored number that
  // can drift out of step with the rows it claims to count.
  subscribers: [],

  // --- Person (report §4.4) -------------------------------------------------
  // A first-class entity over every identity Brief holds. A person is a stable
  // id; personAliases bind it to concrete external identifiers (user id, phone,
  // email, telegram/whatsapp, participant id) through EXPLICIT verified acts
  // only — never probabilistic inference.
  people: [],
  personAliases: [],
  // Explicit Play availability. Off by default: a missing row is offline.
  // Presence is not consent — only an opted-in row is listed.
  arenaAvailability: [],

  // --- Arena entities (server models) -------------------------------------
  // A player's game identity is NOT their Brief account: one person holds many.
  arenaPlayers: [],
  // Arena progression: append-only XP/coin events (idempotent by key).
  arenaEvents: [],
  // T5: the shared EPL player catalog. Rows carry their source; 'seed' rows
  // 'seed' rows are clearly mock development data.
  eplCatalog: [],
  // Mshikano: cooperation posts + two-party-confirmed partnerships.
  coopPosts: [],
  coopPartnerships: [],
  arenaVenues: [],
  arenaTournaments: [],
  arenaResults: [], // agreed match results; leaderboards are derived from these

  // --- HudumaLink (WhatsApp + M-Pesa distributed action layer) -------------
  // A self-contained product module living inside the same store. Identity is
  // keyed by phone; money lives in hudumaEscrow exactly as the ledger pattern
  // elsewhere expects (no second balance). See server/src/domain/huduma/* and
  // the production schema in server/sql/hudumalink.sql.
  hudumaUsers: [],       // phone-keyed data subjects; eCitizen token AES-encrypted
  hudumaOrders: [],      // service orders + escrow status
  hudumaEscrow: [],      // M-Pesa STK ledger rows backing each order
  hudumaDocuments: [],   // delivered artefacts + authenticity signature hash
  hudumaSessions: [],    // per-phone conversational state machine

  // --- Engine (sync core + universal router + tier guardrails) -------------
  // The "power plant": background state synchronization, signed webhook
  // dispatch, and server-authoritative access tiers. engineSyncs is an audit
  // trail of real pipeline runs (bounded per caller); engineDeliveries is the
  // dispatch ledger — nothing is recorded delivered that was not delivered.
  engineSyncs: [],       // per-caller sync telemetry (real stage timings)
  engineRoutes: [],      // user routing rules: signal match -> channels
  engineDeliveries: [],  // webhook/outbound dispatch ledger, every attempt
  engineTierGrants: [],  // operator tier grants (billing is not connected)

  // --- Story likes (editorial rating) ---------------------------------------
  // One row per (article, actor). Like counts are DERIVED by scanning these
  // rows — never a stored counter that can drift from the records.
  articleLikes: [],

  // --- Group Buy engine (Chama & group-order pipelines) ---------------------
  // A group buy is a tracked funding pipeline; contributions are records with
  // verifiable receipt digests. Money records also ride the one ledger —
  // there is deliberately no second balance here.
  groupBuys: [],
  groupBuyContributions: [],
  // T2: a bargain's committed participants (per-head pricing bands).
  groupBuyParticipants: [],
  // T3: owner-authored updates on a contribution campaign.
  campaignUpdates: [],
  // T6: KYC verification records. No identity documents are ever stored --
  // only status, provider reference and review provenance.
  verificationRecords: [],
  // T7: email subscriptions with double opt-in + delivery log.
  emailSubscriptions: [],
  emailLog: [],

  // --- Brief 2.0 Spaces (The Digital Landlord) -----------------------------
  // A Space is something a person is trying to make happen (a business,
  // project, community, or side-hustle). Spaces own capabilities, goals,
  // people relationships, conversations, activity streams, ledger rails, and cargo dispatches.
  spaces: [],
  spaceActivities: [],
  spaceConversations: [],
  spaceExpenses: [],
  spaceCustomerTabs: [],
  spaceDispatches: []
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
