// ---------------------------------------------------------------------------
// HUDUMALINK — USERS & THE ENCRYPTED eCitizen TOKEN
//
// A HudumaLink user is identified by phone (the WhatsApp number). The only
// sensitive field we hold is the eCitizen token, which lets us act on the
// citizen's behalf at a government portal. Per the blueprint's safety
// constraints and Kenya's Data Protection Act:
//
//   * The token is AES-256-GCM encrypted before it is ever persisted (crypto.js).
//   * It is only stored after the user has an explicit terms/consent record.
//   * It can be cleared on demand (right to erasure), and clearing wipes the
//     ciphertext, iv and tag together so nothing recoverable remains.
//
// Phone numbers are normalised to 2547XXXXXXXX/2541XXXXXXXX exactly as the
// M-Pesa rail requires, so the same value is the user key, the order key and
// the STK push target.
// ---------------------------------------------------------------------------

import { store, newId } from '../../store.js';
import { encrypt, decrypt, isConfigured as cryptoConfigured } from './crypto.js';

/** Normalise to 2547XXXXXXXX / 2541XXXXXXXX. Same rule as the M-Pesa rail. */
export function normalisePhone(input) {
  const digits = String(input ?? '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  let n = digits;
  if (n.startsWith('254')) { /* already international */ }
  else if (n.startsWith('0')) n = `254${n.slice(1)}`;
  else if (n.length === 9 && (n.startsWith('7') || n.startsWith('1'))) n = `254${n}`;
  else return null;
  if (!/^254[17][0-9]{8}$/.test(n)) return null;
  return n;
}

export function getOrCreateUser(phoneRaw) {
  const phone = normalisePhone(phoneRaw);
  if (!phone) throw new Error('invalid phone number');
  const existing = store.find('hudumaUsers', (u) => u.phone === phone);
  if (existing) return existing;
  const now = new Date().toISOString();
  const user = {
    id: newId('husr'),
    phone,
    displayName: null,
    ecitizenToken: null,            // { iv, tag, ciphertext } or null
    ecitizenTokenAt: null,
    termsAcceptedAt: null,
    createdAt: now,
    updatedAt: now
  };
  store.insert('hudumaUsers', user);
  return user;
}

export function getUserByPhone(phoneRaw) {
  const phone = normalisePhone(phoneRaw);
  if (!phone) return null;
  return store.find('hudumaUsers', (u) => u.phone === phone) ?? null;
}

export function getUser(id) {
  return store.find('hudumaUsers', (u) => u.id === id) ?? null;
}

/** Record explicit consent. Required before any token can be stored. */
export function acceptTerms(phoneRaw) {
  const phone = normalisePhone(phoneRaw);
  const user = getOrCreateUser(phone); // normalises & ensures the row exists
  const now = new Date().toISOString();
  return store.update('hudumaUsers', user.id, { termsAcceptedAt: now });
}

/**
 * Store the eCitizen token, encrypted at rest.
 *
 * FAIL CLOSED: if no master key is configured this refuses, returning a
 * machine-readable reason, rather than persisting the token in cleartext "just
 * this once". The route surfaces this as a 503 so the feature reports the
 * truth instead of silently weakening data protection.
 */
export function setEcitizenToken(phoneRaw, plaintext) {
  if (!cryptoConfigured()) {
    return { ok: false, reason: 'encryption_key_not_configured' };
  }
  const phone = normalisePhone(phoneRaw);
  const user = getOrCreateUser(phone);
  if (!user.termsAcceptedAt) {
    return { ok: false, reason: 'terms_not_accepted' };
  }
  const record = encrypt(plaintext);
  store.update('hudumaUsers', user.id, {
    ecitizenToken: record,
    ecitizenTokenAt: new Date().toISOString()
  });
  return { ok: true };
}

/** Decrypt and return the token, or null if none is stored. */
export function getEcitizenToken(phoneRaw) {
  const user = getUserByPhone(phoneRaw);
  if (!user || !user.ecitizenToken) return null;
  return decrypt(user.ecitizenToken); // throws on tamper — never returns garbage
}

/**
 * Right to erasure. Wipes the encrypted token artefacts together; nothing
 * recoverable remains because the ciphertext is meaningless without a key the
 * database never had.
 */
export function clearEcitizenToken(phoneRaw) {
  const user = getUserByPhone(phoneRaw);
  if (!user) return false;
  store.update('hudumaUsers', user.id, {
    ecitizenToken: null,
    ecitizenTokenAt: null
  });
  return true;
}

/** A read projection that never emits the token, even encrypted, to a client. */
export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    phone: user.phone,
    displayName: user.displayName,
    hasTerms: Boolean(user.termsAcceptedAt),
    hasEcitizenToken: Boolean(user.ecitizenToken),
    ecitizenTokenAt: user.ecitizenTokenAt
  };
}
