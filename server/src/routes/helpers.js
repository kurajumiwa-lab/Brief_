// Shared route helpers — the small set every route file depends on.
// Extracted from index.js verbatim.
import { callerId } from '../identity.js';
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
