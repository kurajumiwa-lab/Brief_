// Shared route helpers — the small set every route file depends on.
// Extracted from index.js verbatim.
import { callerId, hasCapability, platformRolesOf } from '../identity.js';
import { store, newId } from '../store.js';

/**
 * Guard for routes that require a real actor.
 *
 * Returns the caller id, or sends 401 and returns null. Distinguishes an
 * expired session from a missing one so a client can prompt a re-login
 * instead of showing a generic error.
 */
export function requireAuth(req, res) {
  const me = callerId(req);
  if (me) return me;
  const reason = req.authError ?? 'no_token';
  res.status(401).json({
    error: reason === 'expired' ? 'your session has expired, please sign in again'
      : reason === 'revoked' ? 'this session has been signed out'
      : 'authentication required',
    code: reason
  });
  return null;
}

export const now = () => new Date().toISOString();
export const CURRENT_USER = 'usr_me'; // single-user deployment; auth slots in here

export function recordError(scope, sourceId, message) {
  store.insert('errors', { id: newId('err'), scope, sourceId: sourceId ?? null, message, at: now() });
}

/**
 * Guard for operator-surface routes: a real actor WHO HOLDS a capability.
 *
 * 401 for no identity (same as requireAuth), 403 with an honest reason when
 * the identity is real but not permitted. The refusal names the capability
 * and the caller's own roles so the client can explain itself.
 */
export function requireCap(req, res, capability) {
  const me = requireAuth(req, res);
  if (!me) return null;
  if (!hasCapability(me, capability)) {
    res.status(403).json({
      error: `this action requires the "${capability}" capability`,
      code: 'forbidden_capability',
      requiredCapability: capability,
      yourRoles: platformRolesOf(me)
    });
    return null;
  }
  return me;
}

/**
 * Append-only record of a consequential action. Who, what object, when,
 * before/after, reason. Never throws -- an audit failure must not unwind the
 * operation it is describing, but it is also never swallowed silently: the
 * row carries the error if one occurs.
 */
export function recordAudit(action, { actorId = null, objectType = null, objectId = null, before = null, after = null, reason = null } = {}) {
  try {
    return store.insert('auditLog', {
      id: newId('aud'),
      at: new Date().toISOString(),
      actorId,
      actorHandle: (() => {
        const u = store.find('users', (x) => x.id === actorId);
        return u?.handle ?? null;
      })(),
      action,
      objectType,
      objectId,
      before: before === null ? null : JSON.parse(JSON.stringify(before)),
      after: after === null ? null : JSON.parse(JSON.stringify(after)),
      reason: reason === null ? null : String(reason).slice(0, 300)
    });
  } catch (e) {
    store.insert('errors', {
      id: newId('err'), at: new Date().toISOString(), scope: 'audit',
      message: String(e?.message ?? e)
    });
    return null;
  }
}
