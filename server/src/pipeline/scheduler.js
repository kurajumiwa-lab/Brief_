// ---------------------------------------------------------------------------
// WEB + RSS INGESTION SCHEDULER — recurring polling of registered sources.
//
// The production answer to "how does a feed keep arriving without anyone
// clicking?". It follows the same unref'd setInterval discipline as the
// workflow/calendar sweeps (so it never holds the process open and is off in
// tests), and it drives the SAME storeRawItem -> processRawItem pipeline the
// Telegram webhook and the manual connector routes use.
//
// Guarantees:
//   * NO OVERLAPPING RUNS  — a `running` guard skips a tick that overlaps a
//     still-running round.
//   * PER-SOURCE ISOLATION — each source is polled in its own try/catch; one
//     broken site updates its own health and the loop moves on.
//   * TIMEOUT + BACKOFF    — the connector's hard timeout plus `withBackoff`
//     retry; a source that keeps failing degrades, never stalls the loop.
//   * IDEMPOTENT           — storeRawItem dedups on (source, externalId), so a
//     re-delivered item or a re-fetch produces no duplicate object.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { withBackoff } from '../queue.js';
import * as web from '../connectors/web.js';
import { storeRawItem, processRawItem } from './ingest.js';
import { normalizeRssItem, normalizeWebPage } from './normalize.js';

const POLLABLE_TYPES = new Set(['rss', 'webpage', 'website']);

/**
 * Update one source's operational health fields after a manual or scheduled
 * ingestion attempt. Shared by the scheduler and the manual connector routes so
 * a source's `healthState`/`lastError`/`lastSuccessAt`/`lastAttemptAt` always
 * reflect the REAL last outcome — never a hardcoded flag.
 * Returns null when the source row no longer exists.
 */
export function markSourceHealth(sourceId, { ok, error = null, lastMessageAt = null }) {
  const source = store.find('sources', (s) => s.id === sourceId);
  if (!source) return null;
  const patch = { lastAttemptAt: new Date().toISOString() };
  if (ok) {
    patch.connectionStatus = 'connected';
    patch.healthState = 'ok';
    patch.lastSuccessAt = new Date().toISOString();
    patch.lastError = null;
    if (lastMessageAt) patch.lastMessageAt = lastMessageAt;
  } else {
    patch.healthState = 'error';
    patch.lastError = error ?? 'unknown error';
  }
  return store.update('sources', sourceId, patch);
}

/** Is a source eligible for automatic polling? */
export function isPollable(source) {
  return Boolean(source) && source.enabled === true && POLLABLE_TYPES.has(source.type) && Boolean(source.url);
}

export function enabledPollableSources() {
  return store.filter('sources', (s) => isPollable(s));
}

/**
 * Poll ONE source end to end: fetch -> normalize -> store -> extract. Never
 * throws — every outcome is returned as a flat result so a caller (and the
 * round loop) can continue past any failure. Updates the source's health
 * fields as a side effect.
 */
export async function pollSource(sourceId) {
  const source = store.find('sources', (s) => s.id === sourceId);
  if (!source) return { ok: false, source: sourceId, error: 'source not found' };

  const attemptAt = new Date().toISOString();
  store.update('sources', source.id, { lastAttemptAt: attemptAt, connectionStatus: 'connected' });

  const finish = (ok, detail) => {
    if (ok) {
      store.update('sources', source.id, {
        lastSuccessAt: new Date().toISOString(),
        lastError: null,
        healthState: 'ok',
        lastMessageAt: detail.lastMessageAt ?? new Date().toISOString()
      });
    } else {
      store.update('sources', source.id, {
        lastError: detail.error ?? 'unknown error',
        healthState: 'error'
      });
    }
    store.insert('syncRuns', {
      id: newId('sync'),
      connector: source.type === 'rss' ? 'rss' : 'web',
      sourceId: source.id,
      at: attemptAt,
      received: detail.received ?? 0,
      stored: detail.stored ?? 0,
      ok,
      error: detail.error ?? null
    });
    return { ok, source: source.id, type: source.type, ...detail };
  };

  try {
    if (source.type === 'rss') {
      const feed = await withBackoff(() => web.fetchFeed(source.url));
      if (!feed.ok) return finish(false, { error: feed.error || 'feed fetch failed' });

      let stored = 0, skipped = 0;
      for (const item of feed.items) {
        const payload = normalizeRssItem({ source, item, feedTitle: feed.feedTitle });
        const { row, duplicate } = storeRawItem(payload);
        if (duplicate) { skipped++; continue; }
        processRawItem(row.id);
        stored++;
      }
      return finish(true, { received: feed.items.length, stored, skipped });
    }

    // webpage / website: a single page re-fetched; dedup by canonical URL means
    // a repeat poll produces no duplicate object.
    const page = await withBackoff(() => web.fetchPage(source.url));
    if (!page.ok) return finish(false, { error: page.error || 'page fetch failed' });

    const payload = normalizeWebPage({ source, page, url: source.url });
    const { row, duplicate } = storeRawItem(payload);
    let stored = 0, skipped = 0;
    if (duplicate) skipped++;
    else { processRawItem(row.id); stored++; }

    return finish(true, { received: 1, stored, skipped });
  } catch (e) {
    return finish(false, { error: String(e?.message ?? e) });
  }
}

let running = false;

/**
 * Poll every enabled RSS/Web source once. Skips (returns honestly) if a round
 * is already in progress, so ticks can never overlap. A source failure is
 * recorded on that source and the loop continues.
 */
export async function runPollRound() {
  if (running) return { ok: false, reason: 'already running' };
  running = true;
  try {
    const sources = enabledPollableSources();
    const results = [];
    for (const s of sources) {
      results.push(await pollSource(s.id));
    }
    return { ok: true, sources: sources.length, results };
  } finally {
    running = false;
  }
}

/**
 * Install the recurring poller. Same discipline as the other sweeps: off in
 * tests (index.js only installs outside NODE_ENV=test), unref'd so it never
 * holds the process open, and interval-configurable.
 */
export function installPoller({ intervalMs = 15 * 60 * 1000 } = {}) {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return null;
  const timer = setInterval(() => {
    runPollRound().catch(() => { /* a failed round must never crash the process */ });
  }, intervalMs);
  timer.unref?.();
  return timer;
}

/**
 * Real connector health, for /api/capabilities. Reports what is actually
 * registered and the last real fetch outcome — never a static flag. `kind` is
 * 'rss' | 'web' | null (both).
 */
export function ingestStatus(kind = null) {
  const matchType = (t) => kind
    ? (kind === 'web' ? (t === 'webpage' || t === 'website') : t === kind)
    : POLLABLE_TYPES.has(t);
  const sources = store.all('sources').filter((s) => matchType(s.type));
  const enabled = sources.filter((s) => s.enabled === true);
  const byState = {};
  for (const s of enabled) byState[s.healthState ?? 'never'] = (byState[s.healthState ?? 'never'] ?? 0) + 1;
  const lastSuccess = enabled
    .map((s) => s.lastSuccessAt)
    .filter(Boolean)
    .sort()
    .reverse()[0] ?? null;

  return {
    connector: kind ?? 'web/rss',
    configured: enabled.length > 0,
    sourcesRegistered: sources.length,
    sourcesEnabled: enabled.length,
    health: byState,
    lastSuccessAt: lastSuccess,
    lastAttemptAt: enabled.map((s) => s.lastAttemptAt).filter(Boolean).sort().reverse()[0] ?? null,
    // A source is operational once it has succeeded at least once and its most
    // recent attempt did not end in error.
    operational: enabled.length > 0 && enabled.some((s) => s.healthState === 'ok')
  };
}
