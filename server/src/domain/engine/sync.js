// ---------------------------------------------------------------------------
// ENGINE — STATE SYNCHRONIZATION CORE ("Zero-Latency State Management")
//
// The power plant behind the app never feeling like it is "loading data":
//
//   1. The client carries a compact MANIFEST: for every synced collection, a
//      per-row digest (id + version). That is the whole handshake state.
//   2. A sync runs the pipeline:  PING GATEWAY -> HASH COMPARISON ->
//      DELTA ISOLATION -> UI RENDER.  The server measures its own stages with
//      REAL timings and returns them, so the pipeline visualizer shows the
//      actual work, never a fabricated animation.
//   3. If the overall version matches, the answer is "in sync" and ZERO rows
//      cross the wire. Otherwise only the added/updated/removed rows do.
//
// HONEST SCOPE:
//   * Digests are derived from each row's (id, updatedAt) — the store bumps
//     updatedAt on every write, so a digest change means a real change. We do
//     not pretend to detect field-level edits the store does not record.
//   * "UI Render" is measured CLIENT-side; the server reports it as a client
//     stage with the row counts to apply, and the client engine fills in its
//     own render duration. The server never invents a render time.
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';
import { store } from '../../store.js';

// The collections the engine syncs. Deliberately the ones the home surfaces
// render; adding one is a one-line change here.
export const SYNCED_COLLECTIONS = ['objects', 'campaigns', 'circles', 'listings', 'vendors'];

// Signals are append-only activity, not row state: the engine carries a
// watermark (the latest signal id seen) instead of per-row digests.
const WATERMARK_COLLECTION = 'signals';

const nowIso = () => new Date().toISOString();

function digestRow(row) {
  // Identity + version. updatedAt is bumped by every store write, so this is
  // a honest content-version fingerprint for this store.
  const key = `${row.id}|${row.updatedAt ?? row.createdAt ?? ''}`;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/**
 * The current manifest: per collection { count, digest, rows: { id: digest } },
 * plus the signals watermark and an overall version digest.
 *
 * `includeRows` false omits the per-row map (used for cheap status checks).
 */
export function computeManifest({ includeRows = true } = {}) {
  const collections = {};
  for (const name of SYNCED_COLLECTIONS) {
    const rows = store.all(name);
    const rowMap = {};
    let acc = '';
    for (const r of rows) {
      const d = digestRow(r);
      rowMap[r.id] = d;
      acc += `${r.id}:${d};`;
    }
    collections[name] = {
      count: rows.length,
      digest: crypto.createHash('sha256').update(acc || 'empty').digest('hex').slice(0, 16),
      ...(includeRows ? { rows: rowMap } : {})
    };
  }
  const signals = store.all(WATERMARK_COLLECTION);
  const watermark = signals.length
    ? signals[signals.length - 1].id
    : null;
  const version = crypto.createHash('sha256')
    .update(Object.values(collections).map((c) => c.digest).join('|') + `#${watermark ?? ''}`)
    .digest('hex')
    .slice(0, 24);
  return { version, watermark, collections, at: nowIso() };
}

/** Cheap liveness + version probe (the "Ping Gateway" stage). */
export function ping() {
  return {
    ok: true,
    serverTime: nowIso(),
    collections: SYNCED_COLLECTIONS.length
  };
}

/**
 * Run the full pipeline for a caller.
 *
 * clientManifest: { version, collections: { name: { rows: {id: digest} } } }
 *   Absent/empty  -> treated as a cold client (everything is "added").
 *
 * Returns { inSync, stages[], manifest, deltas }, where stages carry the real
 * per-stage timings and counts. Nothing here mutates state.
 */
export function runSync({ clientManifest = null } = {}) {
  const stages = [];
  const t = () => Number(process.hrtime.bigint() / 1000n) / 1000; // ms, fractional

  // --- Stage 1: Ping Gateway ------------------------------------------------
  let t0 = t();
  const pingResult = ping();
  stages.push({
    id: 'ping',
    label: 'Ping Gateway',
    status: 'done',
    ms: Math.round((t() - t0) * 100) / 100,
    detail: `${pingResult.collections} collections live`
  });

  // --- Stage 2: Hash Comparison ---------------------------------------------
  t0 = t();
  const manifest = computeManifest({ includeRows: true });
  const clientVersion = clientManifest?.version ?? null;
  const inSync = clientVersion !== null && clientVersion === manifest.version;
  stages.push({
    id: 'hash',
    label: 'Hash Comparison',
    status: 'done',
    ms: Math.round((t() - t0) * 100) / 100,
    detail: inSync
      ? `version match ${manifest.version.slice(0, 8)}`
      : clientVersion
      ? `version drift ${String(clientVersion).slice(0, 8)} -> ${manifest.version.slice(0, 8)}`
      : 'cold client — no prior manifest'
  });

  // --- Stage 3: Delta Isolation ----------------------------------------------
  t0 = t();
  const deltas = {};
  let deltaRows = 0;
  if (inSync) {
    for (const name of SYNCED_COLLECTIONS) {
      deltas[name] = { added: [], updated: [], removed: [] };
    }
  } else {
    for (const name of SYNCED_COLLECTIONS) {
      const current = store.all(name);
      const clientRows = clientManifest?.collections?.[name]?.rows ?? {};
      const added = [];
      const updated = [];
      for (const r of current) {
        const d = digestRow(r);
        if (!(r.id in clientRows)) added.push(r);
        else if (clientRows[r.id] !== d) updated.push(r);
      }
      const removed = Object.keys(clientRows).filter((id) => !current.some((r) => r.id === id));
      deltas[name] = { added, updated, removed };
      deltaRows += added.length + updated.length + removed.length;
    }
  }
  stages.push({
    id: 'delta',
    label: 'Delta Isolation',
    status: 'done',
    ms: Math.round((t() - t0) * 100) / 100,
    detail: inSync ? '0 rows — already in sync' : `${deltaRows} row${deltaRows === 1 ? '' : 's'} isolated`
  });

  // --- Stage 4: UI Render (client stage) --------------------------------------
  // The server cannot measure the client's render. It hands over the counts;
  // the client engine records its own duration and the UI shows that.
  stages.push({
    id: 'render',
    label: 'UI Render',
    status: 'client',
    ms: null,
    detail: inSync ? 'nothing to apply' : `${deltaRows} row${deltaRows === 1 ? '' : 's'} to apply`
  });

  return { inSync, version: manifest.version, stages, manifest, deltas, deltaRows };
}
