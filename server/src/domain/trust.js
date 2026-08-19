// ---------------------------------------------------------------------------
// TRUST & INTEGRITY — community confirmation, abuse reporting, reputation
//
// What makes information "deserve attention" is corroboration, not decoration.
// This module turns that into data:
//
//   CONFIRMATION — a user marks an object as accurate. Each confirmation is a
//     row keyed by (object, actor) so one person cannot confirm twice. Tallies
//     are DERIVED by scanning rows, never stored, so a confidence figure can
//     never drift from the confirmations behind it.
//
//   VERIFICATION — escalates the existing object verificationStatus
//     (unverified → source_confirmed → cross_source_confirmed) with a
//     community tier: enough independent confirmations promote it further.
//
//   REPORT — a user flags an object as wrong/spam/offensive. A report is a
//     REQUEST FOR REVIEW, not a removal: it has a lifecycle and never
//     auto-deletes. Nothing is hidden until an operator (or the confirmed
//     majority) acts.
//
//   REPUTATION — a derived score for a contributor, from the things they have
//     actually done (objects contributed, confirmations that held up, reports
//     they made that were upheld). It is a countable fact, never a secret
//     ranking — and it is exposed only to the operator, not displayed as a
//     badge to other users.
//
// Trust influences ranking and visibility, but it NEVER moves money and NEVER
// silently deletes anything. A low-confidence object is ranked lower, not
// removed; a reported object is flagged, not destroyed.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';

export const VERIFICATION_LEVELS = [
  'unverified',
  'source_confirmed',
  'cross_source_confirmed',
  'community_confirmed'
];

const CONFIRM_TO_COMMUNITY = 2; // independent confirmations to reach community_confirmed

function now() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// CONFIRMATION
// ---------------------------------------------------------------------------

/** The caller's confirmation row for an object, or null. */
export function confirmationOf(objectId, actorId) {
  return store.find('confirmations', (c) => c.objectId === objectId && c.actorId === actorId) ?? null;
}

/** How many distinct actors have confirmed this object. Derived. */
export function confirmationCount(objectId) {
  return store.filter('confirmations', (c) => c.objectId === objectId).length;
}

/** The community-trust tier for an object. Derived from real rows. */
export function verificationLevel(objectId) {
  const object = store.find('objects', (o) => o.id === objectId);
  const base = object?.verificationStatus ?? 'unverified';
  if (!VERIFICATION_LEVELS.includes(base)) return 'unverified';
  if (confirmationCount(objectId) >= CONFIRM_TO_COMMUNITY) {
    return base === 'unverified' ? 'community_confirmed' : 'community_confirmed';
  }
  return base;
}

/**
 * Confirm an object as accurate. Idempotent per actor: re-confirming is a
 * no-op that returns the same row, so a retried request cannot double-count.
 */
export function confirmObject(objectId, actorId) {
  if (!store.find('objects', (o) => o.id === objectId)) throw new Error('object not found');
  if (!actorId) throw new Error('an actor is required');

  const existing = confirmationOf(objectId, actorId);
  if (existing) return { confirmation: existing, reused: true };

  const confirmation = store.insert('confirmations', {
    id: newId('conf'),
    objectId,
    actorId,
    createdAt: now()
  });

  // Escalate the stored verificationStatus so ranking and the API reflect the
  // community's word without recomputing on every read.
  const level = verificationLevel(objectId);
  if (level !== store.find('objects', (o) => o.id === objectId)?.verificationStatus) {
    store.update('objects', objectId, { verificationStatus: level });
  }

  return { confirmation, reused: false };
}

// ---------------------------------------------------------------------------
// REPORTING + MODERATION
// ---------------------------------------------------------------------------

export const REPORT_REASONS = ['wrong', 'spam', 'offensive', 'duplicate', 'expired', 'other'];

export function reportObject({ objectId, actorId, reason = 'wrong', note = null }) {
  if (!store.find('objects', (o) => o.id === objectId)) throw new Error('object not found');
  if (!REPORT_REASONS.includes(reason)) throw new Error(`reason must be one of ${REPORT_REASONS.join(', ')}`);

  // One open report per (object, actor) — a double-click must not stack spam.
  const existing = store.find('reports', (r) => r.objectId === objectId && r.actorId === actorId && r.status === 'open');
  if (existing) return { report: existing, reused: true };

  return {
    report: store.insert('reports', {
      id: newId('rep'),
      objectId,
      actorId,
      reason,
      note: note ? String(note).slice(0, 500) : null,
      status: 'open',
      createdAt: now(),
      resolvedAt: null,
      resolvedBy: null
    }),
    reused: false
  };
}

/** Open reports, oldest first — the operator's review queue. */
export function openReports() {
  return store.filter('reports', (r) => r.status === 'open')
    .slice().sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
}

/**
 * Resolve a report. `action` is 'dismiss' (no change) or 'remove' (the object
 * is taken out of public discovery). Removal never deletes the object row — it
 * sets publication to 'removed' so provenance and history are preserved and
 * the action is reversible and auditable.
 */
export function resolveReport(reportId, operatorId, action) {
  const report = store.find('reports', (r) => r.id === reportId);
  if (!report) throw new Error('report not found');
  if (report.status !== 'open') return { report, reused: true };
  if (action !== 'dismiss' && action !== 'remove') throw new Error('action must be dismiss or remove');

  if (action === 'remove') {
    store.update('objects', report.objectId, { publication: 'removed' });
  }
  const resolved = store.update('reports', reportId, {
    status: 'resolved',
    action,
    resolvedAt: now(),
    resolvedBy: operatorId
  });
  return { report: resolved, reused: false };
}

// ---------------------------------------------------------------------------
// REPUTATION (derived, operator-only)
// ---------------------------------------------------------------------------

/** A contributor's countable track record, derived from real rows. */
export function reputation(actorId) {
  if (!actorId) return null;
  const contributed = store.filter('objects', (o) => o.capturedBy === actorId).length;
  const confirmations = store.filter('confirmations', (c) => c.actorId === actorId).length;
  const upheldReports = store.filter('reports', (r) => r.actorId === actorId && r.status === 'resolved' && r.action === 'remove').length;
  return {
    actorId,
    contributed,
    confirmations,
    upheldReports,
    // A coarse, honest weight — a count of verified acts, not a hidden score.
    signal: contributed * 2 + confirmations + upheldReports * 3
  };
}

/** The operator's view of contributors with any track record. */
export function contributorLeaderboard() {
  const actors = new Set([
    ...store.all('objects').map((o) => o.capturedBy).filter(Boolean),
    ...store.all('confirmations').map((c) => c.actorId),
    ...store.all('reports').map((r) => r.actorId)
  ]);
  return Array.from(actors)
    .map((id) => reputation(id))
    .filter(Boolean)
    .sort((a, b) => b.signal - a.signal);
}
