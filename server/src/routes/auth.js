// AUTH ROUTES — extracted from index.js (zero behaviour change).
// Each route keeps its original body verbatim; only its home file changed.
import * as auth from '../domain/auth.js';
import * as referrals from '../domain/referrals.js';
import * as federated from '../domain/federated.js';
import * as onboarding from '../domain/onboarding.js';
import * as person from '../domain/person.js';
import { callerId, platformRolesOf, capabilitiesOf } from '../identity.js';
import { requireAuth } from './helpers.js';

import { requireFeature } from '../features.js';

export function register(app) {
app.use('/api/auth', requireFeature('auth'));
app.post('/api/auth/register', (req, res) => {
  try {
    const user = auth.createUser({
      handle: req.body?.handle,
      password: req.body?.password,
      displayName: req.body?.displayName
    });
    // Registering signs you in; requiring an immediate second round trip to
    // log in adds friction for no security benefit.
    const { token, session } = auth.issueSession(user.id);
    const mine = person.ensurePersonForUser(user.id);
    // First rung of the ladder: an account exists. Recording it here (rather
    // than letting the client claim it) keeps activation measured from the
    // real moment of sign-up.
    onboarding.ensureProfile(user.id);
    onboarding.recordEvent(user.id, 'signed_in', { provider: 'password', created: true });
    // Referral attribution: a code the new member brought with them credits
    // the DIRECT referrer only, once — depth is hard-capped at one level.
    try { referrals.recordSignup(user.id, req.body?.ref ?? req.body?.refCode ?? null); } catch { /* attribution must never break registration */ }
    res.status(201).json({
      user: { ...auth.publicUser(user), personId: mine.id },
      token,
      expiresAt: session.expiresAt,
      onboarding: onboarding.stateFor(user.id)
    });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});



app.post('/api/auth/login', (req, res) => {
  try {
    const { token, session } = auth.login({
      handle: req.body?.handle,
      password: req.body?.password
    });
    const user = auth.getUser(session.userId);
    const mine = person.ensurePersonForUser(user.id);
    onboarding.ensureProfile(user.id);
    onboarding.recordEvent(user.id, 'signed_in', { provider: 'password', created: false });
    res.json({
      user: { ...auth.publicUser(user), personId: mine.id },
      token,
      expiresAt: session.expiresAt,
      onboarding: onboarding.stateFor(user.id)
    });
  } catch (e) {
    // 401, not 400: these are credential failures, not malformed requests.
    res.status(401).json({ error: String(e.message ?? e) });
  }
});



app.post('/api/auth/logout', (req, res) => {
  const token = auth.tokenFromRequest(req);
  const revoked = token ? auth.revokeSession(token) : false;
  res.json({ ok: true, revoked });
});


/** Sign out everywhere. Requires a live session -- you may only revoke your own. */

app.post('/api/auth/logout-all', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  res.json({ ok: true, revoked: auth.revokeAllSessions(me) });
});


/** Who am I? The client uses this to decide between signed-in and signed-out UI. */
app.get('/api/auth/me', (req, res) => {
  const me = callerId(req);
  if (!me) {
    return res.status(401).json({ error: 'authentication required', code: req.authError ?? 'no_token' });
  }
  const user = auth.getUser(me);
  // A dev-fallback caller has no user row. Say so plainly rather than
  // fabricating a profile. A real session always carries the person id —
  // whoAmI is the only player id Play may use.
  if (!user) {
    return res.json({
      user: { id: me, handle: null, displayName: 'Local user', devFallback: true },
      method: req.auth?.method ?? 'dev_fallback'
    });
  }
  const mine = person.ensurePersonForUser(user.id);
  res.json({
    user: {
      ...auth.publicUser(user),
      personId: mine.id,
      // Operator-surface truth: what this account may operate. Derived only
      // from stored rows + deployment bootstrap, never from the request.
      platformRoles: platformRolesOf(user.id),
      capabilities: capabilitiesOf(user.id)
    },
    method: req.auth?.method ?? 'dev_fallback'
  });
});


// ---------------------------------------------------------------------------
// FEDERATED SIGN-IN
//
// The first screen leads with Google because typing a handle and a password is
// the slowest possible first thirty seconds. Telegram is NOT required to be a
// member: it stays available for people already inside the Mini App and is
// never a gate for anyone else.
// ---------------------------------------------------------------------------

/** What the sign-in screen may honestly offer on THIS deployment. */
app.get('/api/auth/providers', (_req, res) => {
  res.json({ providers: federated.providerStatus() });
});

/**
 * Continue with Google.
 *
 * The ID token is verified against Google's published keys — issuer,
 * audience, expiry, signature and email_verified are all checked. Without a
 * configured GOOGLE_CLIENT_ID this refuses with 503 and says why; it never
 * mints a session from a claim it cannot check.
 */
app.post('/api/auth/google', async (req, res) => {
  if (!federated.googleConfigured()) {
    return res.status(503).json({
      error: 'Google sign-in is not configured on this deployment',
      code: 'provider_not_configured',
      remedy: 'Set GOOGLE_CLIENT_ID on the server and the matching VITE_GOOGLE_CLIENT_ID on the client.'
    });
  }
  const verified = await federated.verifyGoogleIdToken(req.body?.credential);
  if (!verified.ok) {
    return res.status(401).json({ error: 'google credential rejected', reason: verified.reason });
  }
  try {
    const { user, created } = auth.signInWithVerifiedIdentity({
      provider: 'google',
      subject: verified.claims.subject,
      email: verified.claims.email,
      displayName: verified.claims.displayName
    });
    const { token, session } = auth.issueSession(user.id);
    const mine = person.ensurePersonForUser(user.id);
    onboarding.ensureProfile(user.id);
    onboarding.recordEvent(user.id, 'signed_in', { provider: 'google', created });
    if (req.body?.source) onboarding.setSource(user.id, req.body.source);
    res.status(created ? 201 : 200).json({
      user: { ...auth.publicUser(user), personId: mine.id },
      token,
      expiresAt: session.expiresAt,
      created,
      onboarding: onboarding.stateFor(user.id)
    });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

/**
 * Continue from a link that already knows who you are.
 *
 * This is the TikTok case. An in-app browser cannot read the device's Google
 * account — no browser can, and pretending otherwise would be a lie. What can
 * be true is that the link itself carries an email THIS server signed, so
 * arriving from it is one tap instead of a sign-up form. A bare `?email=` is
 * refused: only a token with a valid, unexpired HMAC resolves to an account.
 */
app.post('/api/auth/email-link', (req, res) => {
  const redeemed = federated.redeemEmailLinkToken(req.body?.token);
  if (!redeemed.ok) {
    return res.status(401).json({ error: 'this link cannot identify you', reason: redeemed.reason });
  }
  try {
    const { user, created } = auth.signInWithVerifiedIdentity({
      provider: 'email_link',
      email: redeemed.email,
      displayName: req.body?.displayName ?? null
    });
    const { token, session } = auth.issueSession(user.id);
    const mine = person.ensurePersonForUser(user.id);
    onboarding.ensureProfile(user.id);
    onboarding.recordEvent(user.id, 'signed_in', { provider: 'email_link', created });
    const source = req.body?.source ?? redeemed.source;
    if (source) onboarding.setSource(user.id, source);
    res.status(created ? 201 : 200).json({
      user: { ...auth.publicUser(user), personId: mine.id },
      token,
      expiresAt: session.expiresAt,
      created,
      onboarding: onboarding.stateFor(user.id)
    });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

/**
 * Mint a one-tap link token for an email you are inviting.
 *
 * Requires a live session: you may hand out recognition, but only as yourself,
 * and only for an address you typed. The token expires.
 */
app.post('/api/auth/email-link/mint', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const token = federated.mintEmailLinkToken(req.body?.email, { source: req.body?.source ?? null });
    res.status(201).json({
      token,
      expiresInMs: federated.EMAIL_LINK_TTL_MS,
      note: 'Append this as ?bt=<token> to a Brief link. Anyone holding the link is treated as that email.'
    });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});
}
