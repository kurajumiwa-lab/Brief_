// ---------------------------------------------------------------------------
// OPERATIONS
//
// The minimum an operator needs to run Brief and know it is healthy. Not a
// DevOps platform -- there are no metrics servers, no tracing exporters and
// no alerting rules, because a single-process JSON-store deployment does not
// need them and pretending otherwise would be theatre.
//
// What IS here is what actually gets used at 2am:
//
//   * structured logs that can be grepped or shipped
//   * a startup diagnostic that says what is and is not configured
//   * a readiness check that inspects real state, not just "the process is up"
//   * a backup that can be taken and restored
//   * graceful shutdown, so a deploy does not truncate a write
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';

const STARTED_AT = Date.now();

/**
 * One JSON object per line. Greppable in a terminal, ingestible by any log
 * shipper, and it never interleaves badly across concurrent writes the way
 * multi-line output does.
 */
export function log(level, event, detail = {}) {
  // Test output stays readable: the suite asserts on behaviour, not on logs.
  if (process.env.NODE_ENV === 'test' && !process.env.BRIEF_LOG_IN_TEST) return;
  const line = JSON.stringify({
    at: new Date().toISOString(),
    level,
    event,
    ...detail
  });
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const logInfo = (event, detail) => log('info', event, detail);
export const logWarn = (event, detail) => log('warn', event, detail);
export const logError = (event, detail) => log('error', event, detail);

/**
 * Request logging. Deliberately records the STATUS and DURATION but never the
 * body, the Authorization header or any query string -- those are exactly
 * where tokens and personal data live.
 */
export function requestLogger(req, res, next) {
  const started = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - started;
    // Only log the path, with ids left in place: they are useful for tracing
    // and are not secrets. Query strings are dropped.
    const route = req.originalUrl.split('?')[0];
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    // Successful reads are noise at scale; log them only when asked.
    if (level === 'info' && req.method === 'GET' && !process.env.BRIEF_LOG_READS) return;
    log(level, 'request', {
      method: req.method,
      route,
      status: res.statusCode,
      ms,
      // Who did it, when known. Useful for abuse investigation.
      actor: req.auth?.userId ?? null
    });
  });
  next();
}

/**
 * What this deployment can and cannot do, printed once at boot.
 *
 * The point is that an operator sees the truth immediately rather than
 * discovering at the first real payment that no credentials were mounted.
 */
export function startupDiagnostics({ store, capabilities }) {
  const problems = [];
  const notes = [];

  if (process.env.NODE_ENV === 'production') {
    if (process.env.BRIEF_DEV_AUTH === '1') {
      problems.push('BRIEF_DEV_AUTH=1 in production: unauthenticated requests are accepted as a local user');
    }
    if (!capabilities.payments?.configured) {
      notes.push('no payment provider configured: Brief cannot collect or disburse money');
    }
    if (!process.env.TUMA_WEBHOOK_SECRET && capabilities.payments?.configured) {
      problems.push('payments are configured but TUMA_WEBHOOK_SECRET is unset: Tuma callbacks will be rejected');
    }
  }

  let dataWritable = false;
  try {
    const dir = path.dirname(store._file);
    fs.accessSync(dir, fs.constants.W_OK);
    dataWritable = true;
  } catch {
    problems.push(`data directory is not writable: ${path.dirname(store._file)}`);
  }

  return {
    startedAt: new Date(STARTED_AT).toISOString(),
    node: process.version,
    env: process.env.NODE_ENV ?? 'development',
    dataFile: store._file,
    dataWritable,
    problems,
    notes
  };
}

/**
 * Readiness. Distinct from liveness: the process can be alive but unable to
 * serve, and a load balancer needs to tell those apart.
 */
export function readiness({ store, reconcilers = [] }) {
  const checks = [];

  // Can we actually read and write the store?
  let storeOk = false;
  try {
    store.all('objects');
    fs.accessSync(path.dirname(store._file), fs.constants.W_OK);
    storeOk = true;
  } catch (e) {
    checks.push({ name: 'store', ok: false, detail: String(e.message ?? e) });
  }
  if (storeOk) checks.push({ name: 'store', ok: true });

  // Does the money still add up? A ledger that stopped reconciling is a
  // reason to stop taking traffic, not a dashboard curiosity.
  for (const r of reconcilers) {
    try {
      const result = r.run();
      checks.push({
        name: r.name,
        ok: result.balanced !== false,
        discrepancies: result.discrepancies?.length ?? 0
      });
    } catch (e) {
      checks.push({ name: r.name, ok: false, detail: String(e.message ?? e) });
    }
  }

  const ok = checks.every((c) => c.ok);
  return { ok, uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000), checks };
}

/**
 * Copy the data file aside. The store writes atomically (tmp + rename), so a
 * plain copy is a consistent snapshot without stopping the server.
 */
export function backup(store, targetDir = null) {
  const src = store._file;
  if (!fs.existsSync(src)) return { ok: false, reason: 'no data file yet' };
  const dir = targetDir ?? path.join(path.dirname(src), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(dir, `brief-${stamp}.json`);
  fs.copyFileSync(src, dest);
  const { size } = fs.statSync(dest);
  logInfo('backup_written', { dest, size });
  return { ok: true, file: dest, size };
}

/** Keep the newest N backups so a daily job cannot fill the disk. */
export function pruneBackups(store, keep = 14) {
  const dir = path.join(path.dirname(store._file), 'backups');
  if (!fs.existsSync(dir)) return { removed: 0 };
  const files = fs.readdirSync(dir)
    .filter((f) => f.startsWith('brief-') && f.endsWith('.json'))
    .sort()
    .reverse();
  const doomed = files.slice(keep);
  for (const f of doomed) fs.unlinkSync(path.join(dir, f));
  return { removed: doomed.length, kept: Math.min(files.length, keep) };
}

/**
 * Restore the newest snapshot when the primary data file is missing or empty.
 *
 * Railway's filesystem is ephemeral, so a fresh deploy starts with no data.
 * If the data directory is mounted on a persistent volume, this is a no-op
 * (the file is already there). If a previous run's snapshot exists — e.g. the
 * volume was re-attached after a crash, or a snapshot was copied in — this
 * brings it back so a redeploy does not silently wipe every record.
 *
 * Never overwrites an existing, non-empty data file: an empty/missing primary
 * is the only case that triggers a restore.
 */
export function restoreLatestBackupIfEmpty(store) {
  const src = store._file;
  if (fs.existsSync(src)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(src, 'utf8'));
      const keys = Object.keys(parsed).filter((k) => !k.startsWith('__'));
      const hasRows = Object.entries(parsed)
        .filter(([k]) => !k.startsWith('__'))
        .some(([, v]) => Array.isArray(v) && v.length > 0);
      if (hasRows) return { restored: false, reason: 'data file present and non-empty' };
      // Empty collections file (fresh init wrote a skeleton): treat as absent
      // only if a snapshot exists.
      if (keys.length > 0 && !hasRows) {
        // fall through to restore attempt below
      }
    } catch {
      return { restored: false, reason: 'data file unreadable; leaving as-is' };
    }
  }

  const dir = path.join(path.dirname(store._file), 'backups');
  if (!fs.existsSync(dir)) return { restored: false, reason: 'no snapshots' };
  const files = fs.readdirSync(dir)
    .filter((f) => f.startsWith('brief-') && f.endsWith('.json'))
    .sort()
    .reverse();
  if (!files.length) return { restored: false, reason: 'no snapshots' };

  const latest = path.join(dir, files[0]);
  fs.copyFileSync(latest, src);
  logInfo('restored_from_snapshot', { file: latest });
  return { restored: true, file: latest };
}

/**
 * Take a snapshot on a fixed cadence, in addition to the shutdown backup.
 *
 * The store writes atomically (tmp + rename), so a copy at any instant is a
 * consistent snapshot. This is the resilience net that survives a crash or a
 * forced kill (which never gets a chance to run the graceful-shutdown backup).
 * Off by default in tests; enabled in production via BRIEF_BACKUP_INTERVAL_MS.
 */
export function installPeriodicBackup(store, { intervalMs = 15 * 60 * 1000, keep = 14 } = {}) {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return null;
  const timer = setInterval(() => {
    try {
      const result = backup(store);
      if (result.ok) pruneBackups(store, keep);
    } catch (e) {
      logWarn('backup_failed', { error: String(e.message ?? e) });
    }
  }, intervalMs);
  // Do not hold the process open just to take snapshots.
  timer.unref?.();
  return timer;
}

/**
 * Finish in-flight requests before exiting.
 *
 * Without this a deploy can kill the process mid-write. The store's atomic
 * rename means the file is never corrupt, but a request can still be lost,
 * and for a payment callback that matters.
 */
export function installGracefulShutdown(server, { onShutdown = null, timeoutMs = 10_000 } = {}) {
  let shuttingDown = false;

  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logInfo('shutdown_started', { signal });

    // A crash is a FAILURE and must exit non-zero so a supervisor with
    // `restartPolicyType: "on_failure"` (Railway) actually restarts it. A
    // deliberate stop (SIGTERM on deploy, SIGINT, manual) is a clean exit 0.
    const exitCode = signal === 'uncaughtException' ? 1 : 0;

    const timer = setTimeout(() => {
      logWarn('shutdown_forced', { after: timeoutMs });
      process.exit(exitCode);
    }, timeoutMs);
    // Do not let the timer itself hold the process open.
    if (typeof timer.unref === 'function') timer.unref();

    server.close(async () => {
      try { if (onShutdown) await onShutdown(); } catch (e) {
        logError('shutdown_hook_failed', { message: String(e.message ?? e) });
      }
      clearTimeout(timer);
      logInfo('shutdown_complete', { exitCode });
      process.exit(exitCode);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // A crash must be logged in the same structured format, not lost to stderr.
  process.on('unhandledRejection', (reason) => {
    logError('unhandled_rejection', { reason: String(reason?.message ?? reason) });
  });
  process.on('uncaughtException', (err) => {
    logError('uncaught_exception', { message: String(err?.message ?? err), stack: err?.stack });
    shutdown('uncaughtException');
  });

  return () => shutdown('manual');
}
