// ---------------------------------------------------------------------------
// FEDERATED IDENTITY — Google Sign-In and signed email links.
//
// WHY THIS EXISTS.
//
// Onboarding starts with identity. Typing a handle and a password is the
// slowest possible first screen, so the first-run flow leads with "Continue
// with Google" and keeps the password path as the fallback. Telegram is NOT
// required to be a member: `/api/telegram/init` remains available for people
// who arrive inside the Mini App, but it is one door among several, never the
// gate.
//
// WHAT IS REAL HERE.
//
//   * Google ID tokens are VERIFIED, not trusted. The token's RS256 signature
//     is checked against Google's published JWKS, then issuer, audience,
//     expiry and `email_verified` are all checked. A token that fails any of
//     those is refused.
//   * When GOOGLE_CLIENT_ID is absent the route refuses with 503 and a stated
//     reason. It never mints a session from an unverifiable claim — that is
//     precisely the fabricated-success this codebase forbids.
//   * Email links are HMAC-signed by THIS server. A raw `?email=` in a URL is
//     not an identity and is never accepted; only a token this server minted
//     (and that has not expired) resolves to an account.
//
// WHAT AN "IN-APP BROWSER" CAN AND CANNOT DO.
//
// A TikTok / Instagram in-app browser cannot read the device's Google account
// by itself — no browser exposes that, and any code claiming to would be
// lying. What genuinely works, and is what this module supports, is:
//
//   1. the share link carries a Brief-signed `bt=` token holding the email the
//      link was minted for -> one tap, no typing (mintEmailLinkToken /
//      redeemEmailLinkToken);
//   2. the in-app browser already holds a Brief session cookie/token from a
//      previous visit -> resumed silently;
//   3. Google Identity Services returns a real ID token in that webview ->
//      verified here.
//
// Anything else falls through to the ordinary sign-in screen. That is the
// honest boundary.
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';
import { store, newId } from '../store.js';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/** Link tokens are short-lived: a link forwarded to a group chat months later
 *  must not still log someone in as the person it was minted for. */
export const EMAIL_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// --- configuration ---------------------------------------------------------

export function googleClientId() {
  return process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || null;
}

export function googleConfigured() {
  return Boolean(googleClientId());
}

/**
 * The secret that signs email links.
 *
 * Prefer an operator-provided secret. Failing that, generate one ONCE and
 * persist it, so links survive a restart. It never leaves the server.
 */
export function linkSecret() {
  if (process.env.BRIEF_LINK_SECRET) return String(process.env.BRIEF_LINK_SECRET);
  const existing = store.find('appSecrets', (s) => s.name === 'email_link');
  if (existing) return existing.value;
  const created = store.insert('appSecrets', {
    id: newId('sec'),
    name: 'email_link',
    value: crypto.randomBytes(32).toString('base64url'),
    createdAt: new Date().toISOString()
  });
  return created.value;
}

/** What the client may show as a sign-in option. Honest, derived, no flags. */
export function providerStatus() {
  return {
    password: { configured: true, label: 'Handle and password' },
    google: {
      configured: googleConfigured(),
      clientId: googleClientId(),
      label: 'Continue with Google',
      reason: googleConfigured() ? null : 'GOOGLE_CLIENT_ID is not set on the server'
    },
    // Telegram is a door, not a requirement. It only appears when a bot token
    // exists, and never blocks membership.
    telegram: {
      configured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      required: false,
      label: 'Telegram Mini App',
      reason: process.env.TELEGRAM_BOT_TOKEN ? null : 'TELEGRAM_BOT_TOKEN is not set on the server'
    },
    emailLink: { configured: true, label: 'Signed email link' }
  };
}

// --- Google ID token verification -----------------------------------------

function b64urlToBuffer(part) {
  return Buffer.from(String(part).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function decodeSegment(part) {
  return JSON.parse(b64urlToBuffer(part).toString('utf8'));
}

let jwksCache = { at: 0, keys: [] };

async function fetchGoogleKeys(fetchImpl = fetch) {
  // Google rotates keys; a five-minute cache is the documented sweet spot
  // between hammering the endpoint and holding a retired key.
  if (Date.now() - jwksCache.at < 5 * 60 * 1000 && jwksCache.keys.length) {
    return jwksCache.keys;
  }
  const res = await fetchImpl(GOOGLE_JWKS_URL);
  if (!res || !res.ok) throw new Error('google_jwks_unavailable');
  const body = await res.json();
  const keys = Array.isArray(body?.keys) ? body.keys : [];
  if (!keys.length) throw new Error('google_jwks_empty');
  jwksCache = { at: Date.now(), keys };
  return keys;
}

/** Test seam: let a suite install keys without touching the network. */
export function _setGoogleKeys(keys) {
  jwksCache = { at: keys ? Date.now() : 0, keys: keys ?? [] };
}

/**
 * Verify a Google ID token end to end.
 *
 * Returns `{ ok:true, claims }` or `{ ok:false, reason }`. Never throws for a
 * bad token — a malformed credential is an ordinary 401, not a crash.
 */
export async function verifyGoogleIdToken(idToken, { fetchImpl = fetch, now = Date.now() } = {}) {
  const clientId = googleClientId();
  if (!clientId) return { ok: false, reason: 'provider_not_configured' };
  if (typeof idToken !== 'string' || idToken.split('.').length !== 3) {
    return { ok: false, reason: 'malformed_token' };
  }

  const [headerPart, payloadPart, signaturePart] = idToken.split('.');
  let header;
  let claims;
  try {
    header = decodeSegment(headerPart);
    claims = decodeSegment(payloadPart);
  } catch {
    return { ok: false, reason: 'malformed_token' };
  }
  if (header.alg !== 'RS256') return { ok: false, reason: 'unsupported_algorithm' };

  let keys;
  try {
    keys = await fetchGoogleKeys(fetchImpl);
  } catch (e) {
    return { ok: false, reason: String(e.message ?? e) };
  }
  const jwk = keys.find((k) => k.kid === header.kid) ?? null;
  if (!jwk) return { ok: false, reason: 'unknown_key' };

  let verified = false;
  try {
    const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    verified = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${headerPart}.${payloadPart}`),
      key,
      b64urlToBuffer(signaturePart)
    );
  } catch {
    return { ok: false, reason: 'signature_check_failed' };
  }
  if (!verified) return { ok: false, reason: 'bad_signature' };

  if (!GOOGLE_ISSUERS.includes(String(claims.iss))) return { ok: false, reason: 'bad_issuer' };
  if (String(claims.aud) !== String(clientId)) return { ok: false, reason: 'bad_audience' };
  if (!claims.exp || Number(claims.exp) * 1000 <= now) return { ok: false, reason: 'expired' };
  if (!claims.sub) return { ok: false, reason: 'no_subject' };
  if (!claims.email) return { ok: false, reason: 'no_email' };
  if (claims.email_verified === false) return { ok: false, reason: 'email_not_verified' };

  return {
    ok: true,
    claims: {
      subject: String(claims.sub),
      email: String(claims.email).trim().toLowerCase(),
      displayName: String(claims.name ?? claims.given_name ?? claims.email).trim(),
      picture: claims.picture ? String(claims.picture) : null
    }
  };
}

// --- signed email links ----------------------------------------------------

function sign(payloadB64) {
  return crypto.createHmac('sha256', linkSecret()).update(payloadB64).digest('base64url');
}

/**
 * Mint a token that logs the named email in with one tap.
 *
 * This is what makes "found Brief through a TikTok link and was already
 * recognised" real: the link the creator shared to that person carries a token
 * THIS server signed. No token, no identity.
 */
export function mintEmailLinkToken(email, { ttlMs = EMAIL_LINK_TTL_MS, now = Date.now(), source = null } = {}) {
  const normalised = String(email ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalised)) throw new Error('a valid email is required');
  const payload = { email: normalised, exp: now + ttlMs, src: source };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${sign(body)}`;
}

/** Verify and unpack a link token. Returns `{ ok, email, source }` or a reason. */
export function redeemEmailLinkToken(token, { now = Date.now() } = {}) {
  if (typeof token !== 'string' || !token.includes('.')) return { ok: false, reason: 'malformed_token' };
  const [body, signature] = token.split('.');
  const expected = sign(body);
  const a = Buffer.from(String(signature));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed_token' };
  }
  if (!payload?.email) return { ok: false, reason: 'no_email' };
  if (!payload.exp || Number(payload.exp) <= now) return { ok: false, reason: 'expired' };
  return { ok: true, email: String(payload.email), source: payload.src ?? null };
}
