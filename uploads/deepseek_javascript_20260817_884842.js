// ---------------------------------------------------------------------------
// PERSISTENCE – Full schema (Feature Schema + Economic OS)
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.BRIEF_DATA_DIR || path.join(HERE, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'brief.json');

const EMPTY = {
  sources: [],
  objects: [],
  relationships: [],
  circles: [],
  members: [],
  blocks: [],
  signals: [],
  webhookEvents: [],
  recoveryRecords: [],
  disbursementAttempts: [],
  payoutProfiles: [],
  transactions: [],
  ledgerTransactions: [],
  clearingTransactions: [],
  inventoryReservations: [],
  paymentRequests: [],
  disbursements: [],
  drops: [],
  orders: [],
  commands: [],
  trustRecords: [],
  purchaseResults: [],
  economicsMetrics: [],
  disputes: []
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) return structuredClone(EMPTY);
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const merged = { ...structuredClone(EMPTY), ...parsed };
    for (const key of Object.keys(EMPTY)) {
      if (!merged[key]) merged[key] = [];
    }
    return merged;
  } catch {
    fs.renameSync(DB_FILE, `${DB_FILE}.corrupt-${Date.now()}`);
    return structuredClone(EMPTY);
  }
}

let db = load();

function persist() {
  ensureDir();
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

export const store = {
  all(collection) { return db[collection] ?? []; },
  find(collection, predicate) { return (db[collection] ?? []).find(predicate) ?? null; },
  filter(collection, predicate) { return (db[collection] ?? []).filter(predicate); },
  insert(collection, row) {
    db[collection].push(row);
    persist();
    return row;
  },
  update(collection, id, patch) {
    const row = db[collection].find(r => r.id === id);
    if (!row) return null;
    Object.assign(row, patch, { updatedAt: new Date().toISOString() });
    persist();
    return row;
  },
  remove(collection, id) {
    const before = db[collection].length;
    db[collection] = db[collection].filter(r => r.id !== id);
    persist();
    return db[collection].length < before;
  },
  _reset() { db = structuredClone(EMPTY); persist(); }
};

export function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}