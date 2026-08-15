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
  sources: [],
  sourceMemberships: [],
  rawItems: [],
  objects: [],
  objectSources: [], // canonical object <-> source provenance, many-to-many
  relationships: [],
  syncRuns: [],
  errors: []
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) return structuredClone(EMPTY);
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return { ...structuredClone(EMPTY), ...parsed };
  } catch {
    // A corrupt file must not take the server down. Move it aside and start
    // clean; the operator still has the bad copy to inspect.
    fs.renameSync(DB_FILE, `${DB_FILE}.corrupt-${Date.now()}`);
    return structuredClone(EMPTY);
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
    persist();
  },
  _file: DB_FILE
};

export function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
