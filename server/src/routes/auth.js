// AUTH ROUTES — extracted from index.js (zero behaviour change).
// Each route keeps its original body verbatim; only its home file changed.
import * as auth from '../domain/auth.js';
import * as person from '../domain/person.js';
import { callerId } from '../identity.js';
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
    res.status(201).json({
      user: { ...auth.publicUser(user), personId: mine.id },
      token,
      expiresAt: session.expiresAt
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
    res.json({
      user: { ...auth.publicUser(user), personId: mine.id },
      token,
      expiresAt: session.expiresAt
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
    user: { ...auth.publicUser(user), personId: mine.id },
    method: req.auth?.method ?? 'dev_fallback'
  });
});
}

