// ---------------------------------------------------------------------------
// HANDOFF & ENTRY TOKENS
//
// Two needs, one mechanism:
//
//   1. CHANNEL HANDOFF ("continue elsewhere") — a participant begins on
//      Telegram, the host issues a "continue on WhatsApp/web" token, and when
//      the participant re-enters through another door the token resolves them
//      back to the SAME vault, with no duplicate participant and no lost
//      context.
//
//   2. GUEST ENTRY — a low-friction guest arrives through a public link and is
//      issued an entry token that binds them to the vault as a participant, so
//      their later actions (RSVP, question, request) are attributable without
//      forcing account creation.
//
// SECURITY
//   * tokens are opaque and signed (HMAC-SHA256) over {id, vaultId, purpose,
//     participantId, exp} — a tampered token fails verification
//   * expiry is enforced server-side
//   * replay protection: a token is single-use (usedAt is set on resolve)
//   * participant binding: a handoff token resolves to exactly one participant
//   * no sensitive data is embedded in the token itself — it is an opaque
//     reference to a server-side record
//   * FAIL CLOSED: with no HANDOFF_SECRET configured (and outside a test/known
//     key), signing refuses rather than producing an unsigned token
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';
import { store, newId } from '../store.js';

function secret() {
  const s = process.env.HANDOFF_SECRET;
  if (s && String(s).trim()) return String(s).trim();
  // A fixed development key so the server remains usable locally without a
  // secret, but NEVER in production — production must set HANDOFF_SECRET.
  if (process.env.NODE_ENV !== 'production') return 'brief-dev-handoff-key';
  return null;
}

export function handoffConfigured() {
  return Boolean(secret());
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (!secret()) return { ok: false, reason: 'handoff_not_configured' };
  const parts = String(token ?? '').split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed_token' };
  const [body, sig] = parts;
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }
  try {
    return { ok: true, payload: JSON.parse(Buffer.from(body, 'base64url').toString()) };
  } catch {
    return { ok: false, reason: 'malformed_token' };
  }
}

/**
 * Create a handoff token.
 *
 * `purpose` is 'handoff' (continue elsewhere) or 'guest_entry'. `participantId`
 * binds the token to one participant so resolution can never be replayed onto
 * a different person.
 */
export function createHandoff({
  vaultId,
  participantId,
  purpose = 'handoff',
  fromChannel = null,
  toChannel = null,
  createdBy = null,
  ttlMs = 7 * 24 * 60 * 60 * 1000 // 7 days
}) {
  if (!handoffConfigured()) {
    return { ok: false, reason: 'handoff_not_configured' };
  }
  if (!store.find('vaults', (v) => v.id === vaultId)) {
    return { ok: false, reason: 'vault_not_found' };
  }
  const id = newId('hnd');
  const now = Date.now();
  const record = {
    id,
    vaultId,
    participantId,
    purpose,
    fromChannel,
    toChannel,
    createdBy,
    expiresAt: new Date(now + ttlMs).toISOString(),
    usedAt: null,
    createdAt: new Date(now).toISOString()
  };
  store.insert('handoffs', record);
  const token = sign({ id, vaultId, purpose, participantId, exp: now + ttlMs });
  return { ok: true, token, expiresAt: record.expiresAt };
}

/**
 * Resolve a token to its vault + participant, enforcing expiry and replay
 * protection. A token may be resolved once.
 */
export function resolveHandoff(token, { markUsed = true } = {}) {
  const v = verify(token);
  if (!v.ok) return v;

  const record = store.find('handoffs', (h) => h.id === v.payload.id);
  if (!record) return { ok: false, reason: 'unknown_token' };
  if (record.usedAt) return { ok: false, reason: 'token_already_used' };
  if (Date.parse(record.expiresAt) < Date.now()) {
    return { ok: false, reason: 'token_expired' };
  }
  // The signed payload must agree with the stored record — a token cannot
  // carry a different vault or participant than the one recorded server-side.
  if (record.vaultId !== v.payload.vaultId || record.participantId !== v.payload.participantId) {
    return { ok: false, reason: 'token_mismatch' };
  }

  if (markUsed) {
    store.update('handoffs', record.id, { usedAt: new Date().toISOString() });
  }

  return {
    ok: true,
    vaultId: record.vaultId,
    participantId: record.participantId,
    purpose: record.purpose,
    fromChannel: record.fromChannel,
    toChannel: record.toChannel
  };
}
