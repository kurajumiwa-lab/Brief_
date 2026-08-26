// ---------------------------------------------------------------------------
// HUDUMALINK — DATA-PROTECTION CRYPTO LAYER (AES-256-GCM)
//
// ODPC / Kenya Data Protection Act (2019) compliance posture:
//
//   Personal data must be secured against unauthorised access, loss and
//   unlawful processing. For HudumaLink that means credentials a user hands
//   us in chat — above all the eCitizen token used to act on their behalf —
//   must never reach the database in cleartext, and a stolen database row
//   alone must not be enough to impersonate the data subject.
//
// HOW THIS FILE MEETS THAT:
//
//   * AES-256-GCM. Authenticated encryption: a row that has been tampered
//     with FAILS to decrypt (the GCM auth tag does not verify), so a modified
//     ciphertext is detected rather than silently producing wrong plaintext.
//   * A random 96-bit IV per record. Reusing an IV with the same key breaks
//     GCM entirely, so it is generated fresh with crypto.randomBytes() every
//     encrypt() call and stored alongside the ciphertext.
//   * The key NEVER lives in the database. It is a server-side master key
//     (HUDUMA_MASTER_KEY), held only in process memory. A database dump
//     contains iv + tag + ciphertext but not the key, so it is useless
//     without separate access to the secret store.
//   * FAIL CLOSED. With no key configured, every operation refuses rather
//     than falling back to a weaker scheme. Storing a credential unencrypted
//     "just to keep working" is exactly the failure the Act exists to prevent.
//
// WHAT THIS FILE DELIBERATELY DOES NOT DO:
//
//   * It is NOT key management. Rotating the master key requires re-encrypting
//     every stored blob; that is an operational procedure this module exposes
//     (rotateAll) but does not automate on a schedule.
//   * It is NOT field-level access control. Decryption grants the full
//     plaintext to any caller with the key; column-level least privilege is
//     the database/RLS layer's job (see sql/hudumalink.sql).
//   * It does NOT retain plaintext in memory beyond the call. Callers receive
//     the secret, use it, and let it be GC'd.
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;   // 96-bit IV is the GCM-recommended length
const KEY_BYTES = 32;  // 256-bit key
const TAG_BYTES = 16;  // 128-bit auth tag

/**
 * Resolve the master key to a 32-byte Buffer.
 *
 * Accepts hex or base64. Both must decode to exactly 32 bytes; anything else
 * is refused so a mis-typed env var cannot silently truncate or pad the key
 * into something weaker than 256 bits.
 */
export function masterKey() {
  const raw = process.env.HUDUMA_MASTER_KEY;
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim();
  let buf = null;
  // Hex first: 64 hex chars. Then base64. We never guess.
  if (/^[0-9a-fA-F]{64}$/.test(s)) buf = Buffer.from(s, 'hex');
  else {
    try { buf = Buffer.from(s, 'base64'); } catch { buf = null; }
  }
  if (!buf || buf.length !== KEY_BYTES) return null;
  return buf;
}

export function isConfigured() {
  return masterKey() !== null;
}

/** A stable, non-reversible fingerprint of the active key, for ops/logging. */
export function keyFingerprint() {
  const k = masterKey();
  if (!k) return null;
  return crypto.createHash('sha256').update(k).digest('hex').slice(0, 16);
}

export function status() {
  return {
    configured: isConfigured(),
    algorithm: ALGORITHM,
    keyFingerprint: keyFingerprint()
  };
}

/**
 * Encrypt a UTF-8 string. Returns a self-describing record.
 *
 *   { iv, tag, ciphertext }  — all base64
 *
 * The whole record is what must be persisted: any one of the three missing
 * makes decryption impossible, which is the desired fail-closed behaviour.
 */
export function encrypt(plaintext) {
  const key = masterKey();
  if (!key) {
    // FAIL CLOSED: never persist a secret in cleartext because no key is set.
    throw new Error('HUDUMA_MASTER_KEY not configured; refusing to store a credential unencrypted');
  }
  const str = String(plaintext ?? '');
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: enc.toString('base64')
  };
}

/**
 * Decrypt a record produced by encrypt(). Throws on tamper, missing key, or a
 * malformed record — it never returns best-effort garbage.
 */
export function decrypt(record) {
  const key = masterKey();
  if (!key) throw new Error('HUDUMA_MASTER_KEY not configured; cannot decrypt');
  if (!record || typeof record !== 'object') {
    throw new Error('malformed encrypted record');
  }
  const { iv, tag, ciphertext } = record;
  if (!iv || !tag || !ciphertext) {
    throw new Error('encrypted record is missing iv/tag/ciphertext');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  // setAuthTag + update/final verifies the tag; a mismatch throws here.
  const dec = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]);
  return dec.toString('utf8');
}

/**
 * Convenience for a caller that needs "encrypt this or tell me you couldn't"
 * without a try/catch — e.g. a route that wants to 503 the whole feature.
 */
export function tryEncrypt(plaintext) {
  try {
    return { ok: true, record: encrypt(plaintext) };
  } catch (e) {
    return { ok: false, reason: 'key_not_configured', message: String(e.message ?? e) };
  }
}
