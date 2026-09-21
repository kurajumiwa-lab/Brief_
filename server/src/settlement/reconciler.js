// ---------------------------------------------------------------------------
// RECONCILER — runs hourly. Finds stuck attempts. Escalates.
//
// The reconciler never marks an attempt settled. Only a human (via the manual
// rail) or a provider (via webhook) can do that. The reconciler's job is to
// flag attempts that have been in_flight too long and hand them to the admin.
//
// Escalations are rows, not counters: one open escalation per attempt, and a
// repeat sweep never duplicates one. The `errors` collection already exists
// in the store; `settlementEscalations` is added beside it.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { reconcile as railReconcile, getActiveRailName } from './dispatcher.js';

const INTERVAL_MS = 60 * 60 * 1000; // hourly
let timer = null;

export async function runOnce() {
  const railName = getActiveRailName();

  // NO WINDOW on the stuck sweep, deliberately: an attempt is stuck when it
  // has been in_flight longer than the rail's own review window, so any
  // candidate is by definition OLDER than "one day ago" — a from/to window
  // starting at 24h ago would exclude exactly the rows this exists to find.
  // from/to reconciliation belongs to provider rails comparing statements.
  const result = await railReconcile({});

  for (const mismatch of result.mismatches) {
    // Don't create duplicate escalations for the same attempt.
    const existing = store.find(
      'settlementEscalations',
      (e) => e.attemptId === mismatch.attemptId && e.status === 'open'
    );
    if (existing) continue;

    store.insert('settlementEscalations', {
      id: newId('sesc'),
      rail: railName,
      attemptId: mismatch.attemptId,
      direction: mismatch.direction,
      amount: mismatch.amount,
      reference: mismatch.reference,
      ageHours: mismatch.ageHours,
      status: 'open',
      createdAt: new Date().toISOString(),
    });
  }

  return result;
}

export function start() {
  if (timer) return;
  // Run once at boot, then hourly.
  runOnce().catch((err) => {
    store.insert('errors', {
      id: newId('err'),
      scope: 'reconciler',
      message: String(err?.message ?? err),
      at: new Date().toISOString(),
    });
  });
  timer = setInterval(() => {
    runOnce().catch((err) => {
      store.insert('errors', {
        id: newId('err'),
        scope: 'reconciler',
        message: String(err?.message ?? err),
        at: new Date().toISOString(),
      });
    });
  }, INTERVAL_MS);
}

export function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
