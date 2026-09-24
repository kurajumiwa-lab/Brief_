// Public-page moderation ONLY. This domain never edits accounts, vendors,
// listings, orders, guardian links or reward records. Audit and state commit in
// one synchronous store transaction; a failed audit/write rolls everything back.
import { store, newId } from '../store.js';
import { hasCapability } from '../identity.js';

function fail(message, status = 400, code = 'validation_error') {
  throw Object.assign(new Error(message), { status, code });
}
export function requireModerator(actorId) {
  if (!actorId) fail('Authentication required.', 401, 'authentication_required');
  if (!hasCapability(actorId, 'moderate')) fail('The moderate capability is required.', 403, 'forbidden');
}
function reasonText(value) {
  if (typeof value !== 'string' || !value.trim()) fail('A non-empty moderation reason is required.');
  if (value.trim().length > 1000) fail('Moderation reasons must be at most 1000 characters.');
  return value.trim();
}
function requestKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(value)) {
    fail('Supply an Idempotency-Key of 8–128 letters, digits, dots, underscores, colons or hyphens.');
  }
  return value;
}
function spaceForAction(spaceId, actorId) {
  const space = store.lookup('spaces', spaceId);
  if (!space) fail('Space not found.', 404, 'not_found');
  if (space.ownerId === actorId) fail('A reviewer cannot moderate or reinstate their own page.', 403, 'self_review');
  return space;
}
function replay(actorId, key, request) {
  const old = store.find('auditLog', a => a.objectType === 'spaceModeration' && a.actorId === actorId && a.idempotencyKey === key);
  if (!old) return null;
  if (JSON.stringify(old.request) !== JSON.stringify(request)) fail('This Idempotency-Key was used for a different action.', 409, 'idempotency_conflict');
  // Never reapply an earlier takedown/reinstatement on retry. The current state
  // may have advanced since this historical response was written.
  return { ...structuredClone(old.result), replayed: true };
}
function snapshot(space) {
  return { visibility: space.visibility, moderation: structuredClone(space.publicPageModeration ?? null) };
}
function audit({ id, actorId, key, request, reason, at, before, after, result }) {
  store.insert('auditLog', {
    id, objectType: 'spaceModeration', objectId: request.spaceId,
    action: `space.moderation.${request.action}`, actorId,
    actorHandle: store.lookup('users', actorId)?.handle ?? null,
    reason, at, createdAt: at, idempotencyKey: key,
    request, before, after, result: structuredClone(result)
  });
}

export function reviewReport(reportId, { actorId, outcome, reason, idempotencyKey } = {}) {
  requireModerator(actorId);
  const text = reasonText(reason);
  const key = requestKey(idempotencyKey);
  if (!['upheld', 'dismissed'].includes(outcome)) fail('Choose upheld or dismissed.');
  const report = store.lookup('spaceAbuseReports', reportId);
  if (!report) fail('Report not found.', 404, 'not_found');
  const space = spaceForAction(report.spaceId, actorId);
  const request = { action: outcome, reportId, spaceId: space.id, reason: text };
  const previous = replay(actorId, key, request);
  if (previous) return previous;
  if (report.handledAt || report.outcome) fail('This report has already been reviewed. Its decision cannot be overwritten.', 409, 'already_reviewed');
  return store.transaction(() => {
    const at = new Date().toISOString();
    const id = newId('smod');
    const before = { report: structuredClone(report), page: snapshot(space) };
    // Closing a report must NOT implicitly release existing guardian/reward
    // restrictions. Keep its pre-review contribution until a separate policy
    // explicitly governs that effect; dismissal is not a financial decision.
    store.update('spaceAbuseReports', report.id, {
      outcome, handledAt: at, handledBy: actorId, moderationReason: text,
      moderationActionId: id, guardianEffectPending: true
    });
    if (outcome === 'upheld') {
      store.update('spaces', space.id, {
        visibility: 'private',
        publicPageModeration: { hidden: true, holdId: id, reportId, hiddenAt: at, hiddenBy: actorId }
      });
    }
    const result = { actionId: id, reportId, spaceId: space.id, outcome, handledAt: at, handledBy: actorId,
      visibility: space.visibility, holdId: space.publicPageModeration?.hidden ? space.publicPageModeration.holdId : null };
    audit({ id, actorId, key, request, reason: text, at, before,
      after: { report: structuredClone(report), page: snapshot(space) }, result });
    return { ...result, replayed: false };
  });
}

export function reinstatePage(spaceId, { actorId, holdId, reason, idempotencyKey } = {}) {
  requireModerator(actorId);
  const text = reasonText(reason);
  const key = requestKey(idempotencyKey);
  if (typeof holdId !== 'string' || !holdId.trim()) fail('The current moderation holdId is required.');
  const space = spaceForAction(spaceId, actorId);
  const request = { action: 'reinstate', spaceId, holdId, reason: text };
  const previous = replay(actorId, key, request);
  if (previous) return previous;
  const hold = space.publicPageModeration;
  if (!hold?.hidden || hold.holdId !== holdId) fail('The moderation hold has changed. Reload before reinstating.', 409, 'stale_hold');
  if (space.status !== 'active') fail('An archived shop cannot be republished by moderation. Its owner must restore it separately.', 409, 'inactive_space');
  return store.transaction(() => {
    const at = new Date().toISOString();
    const id = newId('smod');
    const before = snapshot(space);
    store.update('spaces', space.id, {
      visibility: 'public',
      publicPageModeration: { ...hold, hidden: false, reinstatedAt: at, reinstatedBy: actorId, reinstatementActionId: id }
    });
    const result = { actionId: id, spaceId, holdId, visibility: 'public', reinstatedAt: at, reinstatedBy: actorId };
    audit({ id, actorId, key, request, reason: text, at, before, after: snapshot(space), result });
    return { ...result, replayed: false };
  });
}

export function moderationQueue(actorId) {
  requireModerator(actorId);
  return {
    reports: store.all('spaceAbuseReports').map(r => {
      const s = store.lookup('spaces', r.spaceId);
      return { id: r.id, spaceId: r.spaceId, spaceName: s?.name ?? 'Deleted space', slug: s?.slug ?? null,
        reason: r.reason, createdAt: r.createdAt, outcome: r.outcome ?? 'pending',
        handledAt: r.handledAt ?? null, handledBy: r.handledBy ?? null, moderationReason: r.moderationReason ?? null,
        canReview: Boolean(s && s.ownerId !== actorId && !r.handledAt && !r.outcome) };
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    hiddenPages: store.filter('spaces', s => s.publicPageModeration?.hidden).map(s => ({
      id: s.id, name: s.name, slug: s.slug, status: s.status,
      holdId: s.publicPageModeration.holdId, hiddenAt: s.publicPageModeration.hiddenAt,
      canReinstate: s.ownerId !== actorId && s.status === 'active'
    }))
  };
}
