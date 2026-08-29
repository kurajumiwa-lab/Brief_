// ---------------------------------------------------------------------------
// VERIFICATION (Tikiti T6)
//
// A KYC architecture that stores NO documents: a verification record is
// status + provider reference + review provenance, nothing else. The record
// feeds the compliance gates (arena money, payouts) so "identity verified"
// is a reviewed fact, never a self-declared checkbox.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { emitSignal } from './signal.js';
import crypto from 'node:crypto';

const nowIso = () => new Date().toISOString();

export const VERIFICATION_KINDS = ['email', 'phone', 'identity'];
export const VERIFICATION_STATUSES = ['pending', 'approved', 'rejected', 'revoked'];

/** Submit an identity/phone verification request. No documents, ever. */
export function submitVerification(userId, { kind, providerRef = null, note = null }) {
  if (!VERIFICATION_KINDS.includes(kind)) throw new Error(`kind must be one of ${VERIFICATION_KINDS.join(', ')}`);
  const open = store.find('verificationRecords',
    (r) => r.userId === userId && r.kind === kind && r.status === 'pending');
  if (open) return { record: open, changed: false };
  const record = store.insert('verificationRecords', {
    id: newId('ver'),
    userId,
    kind,
    status: 'pending',
    // A provider reference only exists when a real provider checked the
    // submission; null is honest ("manual review").
    providerRef: providerRef ? String(providerRef).slice(0, 120) : null,
    note: note ? String(note).slice(0, 280) : null,
    submittedAt: nowIso(),
    reviewedBy: null,
    reviewedAt: null,
    reason: null
  });
  return { record, changed: true };
}

export function myRecords(userId) {
  return store.filter('verificationRecords', (r) => r.userId === userId)
    .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
}

/** The user's standing, derived -- never stored as a second source of truth. */
export function standingOf(userId) {
  const rows = store.filter('verificationRecords', (r) => r.userId === userId);
  const out = {};
  for (const kind of VERIFICATION_KINDS) {
    const approved = rows.find((r) => r.kind === kind && r.status === 'approved' && !isRevokedLater(rows, r));
    const pending = rows.find((r) => r.kind === kind && r.status === 'pending');
    out[kind] = approved ? 'verified' : pending ? 'pending' : 'unverified';
  }
  return out;
}

function isRevokedLater(rows, record) {
  return rows.some((r) => r.kind === record.kind && r.status === 'revoked'
    && String(r.reviewedAt ?? '') > String(record.reviewedAt ?? ''));
}

export function reviewQueue() {
  return store.filter('verificationRecords', (r) => r.status === 'pending')
    .sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)));
}

/**
 * A reviewer decides. Every decision is audited at the route; the domain
 * records provenance and emits the signal Pulse can surface.
 */
export function decide(reviewerId, recordId, { decision, reason = null }) {
  const record = store.find('verificationRecords', (r) => r.id === recordId);
  if (!record) throw new Error('verification record not found');
  if (record.status !== 'pending') throw new Error(`this record is already ${record.status}`);
  if (decision !== 'approved' && decision !== 'rejected') {
    throw new Error('decision must be approved or rejected');
  }
  if (decision === 'rejected' && (!reason || !String(reason).trim())) {
    throw new Error('a rejection carries a reason');
  }
  const updated = store.update('verificationRecords', record.id, {
    status: decision,
    reviewedBy: reviewerId,
    reviewedAt: nowIso(),
    reason: reason ? String(reason).slice(0, 280) : null
  });
  emitSignal({
    type: 'verification_decision',
    actorId: reviewerId,
    value: 0,
    metadata: { recordId: record.id, userId: record.userId, kind: record.kind, decision }
  });
  return updated;
}

/** Revocation is a separate, explicit act with its own reason. */
export function revoke(reviewerId, recordId, reason) {
  const record = store.find('verificationRecords', (r) => r.id === recordId);
  if (!record) throw new Error('verification record not found');
  if (record.status !== 'approved') throw new Error('only an approved record can be revoked');
  if (!reason || !String(reason).trim()) throw new Error('a revocation carries a reason');
  const updated = store.update('verificationRecords', record.id, {
    status: 'revoked',
    reviewedBy: reviewerId,
    reviewedAt: nowIso(),
    reason: String(reason).slice(0, 280)
  });
  emitSignal({
    type: 'verification_decision',
    actorId: reviewerId,
    value: 0,
    metadata: { recordId: record.id, userId: record.userId, kind: record.kind, decision: 'revoked' }
  });
  return updated;
}

// --- email subscriptions (T7) ------------------------------------------------

export const EMAIL_TOPICS = [
  'event_announcements', 'new_ticket_listings', 'bargain_alerts',
  'contribution_updates', 'arena_announcements', 'product_updates'
];

const normaliseEmail = (e) => String(e ?? '').trim().toLowerCase();
const newToken = () => crypto.randomBytes(24).toString('base64url');

function logEmail(to, topic, template, status, detail = null) {
  // The delivery log is the honest record: with no email provider, "queued"
  // would be a lie, so the status says exactly what happened.
  return store.insert('emailLog', {
    id: newId('mail'), to, topic, template, status, detail, at: nowIso()
  });
}

export function subscribeEmail(email, topics) {
  const address = normaliseEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) throw new Error('that is not an email address');
  const wanted = Array.isArray(topics) ? [...new Set(topics)] : [];
  const unknown = wanted.filter((t) => !EMAIL_TOPICS.includes(t));
  if (unknown.length) throw new Error(`unknown topics: ${unknown.join(', ')}`);
  if (wanted.length === 0) throw new Error('pick at least one topic');

  const existing = store.find('emailSubscriptions', (s) => s.email === address);
  if (existing) {
    if (existing.status === 'unsubscribed') {
      // Re-subscribing restarts double opt-in; the old token dies.
      const token = newToken();
      store.update('emailSubscriptions', existing.id, { status: 'pending', topics: wanted, token, createdAt: nowIso(), confirmedAt: null });
      logEmail(address, wanted[0], 'resubscribe_verify', 'skipped_no_provider', 'no email provider configured');
      return { subscription: store.find('emailSubscriptions', (s) => s.id === existing.id), changed: true };
    }
    return { subscription: existing, changed: false };
  }
  const token = newToken();
  const subscription = store.insert('emailSubscriptions', {
    id: newId('sub'), email: address, status: 'pending', topics: wanted, token,
    createdAt: nowIso(), confirmedAt: null
  });
  // Honest delivery: without a provider the verification mail is NOT sent.
  logEmail(address, wanted[0], 'subscribe_verify', 'skipped_no_provider', 'no email provider configured');
  return { subscription, changed: true };
}

export function confirmEmail(token) {
  const sub = store.find('emailSubscriptions', (s) => s.token === String(token ?? ''));
  if (!sub) return { ok: false, reason: 'unknown_token' };
  if (sub.status === 'confirmed') return { ok: true, subscription: sub, already: true };
  // A token from a subscription the person LEFT is retired. Letting it
  // re-confirm would resubscribe someone who explicitly opted out, using a
  // link they may not control any more. Rejoining goes through subscribe(),
  // which restarts double opt-in with a fresh token.
  if (sub.status === 'unsubscribed') return { ok: false, reason: 'token_retired' };
  const updated = store.update('emailSubscriptions', sub.id, { status: 'confirmed', confirmedAt: nowIso() });
  logEmail(sub.email, sub.topics[0] ?? null, 'subscribe_confirmed', 'skipped_no_provider', 'no email provider configured');
  return { ok: true, subscription: updated, already: false };
}

export function unsubscribe(tokenOrEmail) {
  const key = normaliseEmail(tokenOrEmail);
  const sub = store.find('emailSubscriptions', (s) => s.token === String(tokenOrEmail ?? '') || s.email === key);
  if (!sub) return { ok: false, reason: 'unknown_subscription' };
  if (sub.status === 'unsubscribed') return { ok: true, subscription: sub, already: true };
  const updated = store.update('emailSubscriptions', sub.id, { status: 'unsubscribed', topics: [] });
  return { ok: true, subscription: updated, already: false };
}

export function deliveryLog({ limit = 50 } = {}) {
  return store.all('emailLog').slice().reverse().slice(0, Math.min(limit, 200));
}
