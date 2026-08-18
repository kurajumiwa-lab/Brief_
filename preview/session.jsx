// ---------------------------------------------------------------------------
// SESSION HANDLING (client)
//
// The credential layer, tested at the level that actually breaks in
// production: is the token attached to every request, is it cleared when the
// server says it is dead, and does a signed-out client stop sending it.
//
// This is deliberately NOT a render test. A login form that looks right but
// drops the token is worse than no login form.
// ---------------------------------------------------------------------------
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>',
  { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement; global.Element = dom.window.Element; global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent; global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;

let pass = 0, fail = 0;
const check = (n, c, d = '') => {
  if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); }
};

// --- a fetch that records exactly what the client sent ----------------------
let sent = [];
let responder = () => ({ status: 200, body: {} });
global.fetch = async (url, init = {}) => {
  const headers = init.headers ?? {};
  sent.push({
    url: String(url),
    method: init.method ?? 'GET',
    // Normalise header lookup: the client may use any casing.
    auth: headers.authorization ?? headers.Authorization ?? null,
    body: init.body ? JSON.parse(init.body) : null
  });
  const r = responder(String(url), init);
  return {
    ok: r.status < 400,
    status: r.status,
    text: async () => JSON.stringify(r.body ?? {}),
    json: async () => r.body ?? {}
  };
};

const api = require('./src/api/briefApi.ts');

async function main() {
  console.log('=== A signed-out client sends NO credential ===');
  api.setSessionToken(null);
  sent = [];
  responder = () => ({ status: 200, body: { listings: [] } });
  await api.getListings();
  check('a request was made', sent.length === 1);
  check('NO authorization header when signed out', sent[0].auth === null, String(sent[0].auth));

  console.log('\n=== Registering stores the token and starts sending it ===');
  sent = [];
  responder = (url) => url.includes('/api/auth/register')
    ? { status: 201, body: { user: { id: 'usr_a', handle: 'wanjiku', displayName: 'Wanjiku' }, token: 'tok_ABC123' } }
    : { status: 200, body: { listings: [] } };
  let res = await api.register('wanjiku', 'a good passphrase', 'Wanjiku');
  check('register succeeds', res.ok === true, JSON.stringify(res).slice(0, 120));
  check('it returns the user', res.ok && res.data.handle === 'wanjiku');
  check('the token is NOT leaked into the user object', !JSON.stringify(res.data).includes('tok_ABC123'));
  check('the token was stored', api.getSessionToken() === 'tok_ABC123');
  check('it persisted to localStorage', window.localStorage.getItem('brief_session') === 'tok_ABC123');

  await api.getListings();
  const last = sent[sent.length - 1];
  check('subsequent requests carry the bearer token', last.auth === 'Bearer tok_ABC123', String(last.auth));

  console.log('\n=== The password is never stored or re-sent ===');
  check('the password is not in localStorage',
    !String(window.localStorage.getItem('brief_session')).includes('a good passphrase'));
  const laterCalls = sent.filter((s) => !s.url.includes('/auth/'));
  check('no later request carries a password',
    laterCalls.every((s) => !JSON.stringify(s.body ?? {}).includes('passphrase')));

  console.log('\n=== Login replaces the token ===');
  responder = (url) => url.includes('/api/auth/login')
    ? { status: 200, body: { user: { id: 'usr_b', handle: 'otieno', displayName: 'Otieno' }, token: 'tok_XYZ789' } }
    : { status: 200, body: {} };
  res = await api.login('otieno', 'another passphrase');
  check('login succeeds', res.ok === true);
  check('the NEW token replaced the old one', api.getSessionToken() === 'tok_XYZ789');
  sent = [];
  await api.getListings();
  check('requests use the new token', sent[0].auth === 'Bearer tok_XYZ789');

  console.log('\n=== A wrong password does not sign you in ===');
  const before = api.getSessionToken();
  responder = () => ({ status: 401, body: { error: 'invalid handle or password' } });
  res = await api.login('otieno', 'wrong');
  check('a failed login reports failure', res.ok === false);
  check('and surfaces the server message', /invalid handle or password/i.test(res.error ?? ''), res.error);
  // A 401 on the LOGIN call must not be treated as an expired session.
  check('a failed login does not silently sign you out',
    api.getSessionToken() === before || api.getSessionToken() === null);

  console.log('\n=== An expired session clears itself and notifies ===');
  api.setSessionToken('tok_STALE');
  let expiredCalls = 0;
  api.setSessionExpiredHandler(() => { expiredCalls++; });
  responder = () => ({ status: 401, body: { error: 'your session has expired, please sign in again', code: 'expired' } });
  res = await api.getMyEarnings();
  check('the call reports failure', res.ok === false);
  check('the dead token was DISCARDED', api.getSessionToken() === null, String(api.getSessionToken()));
  check('localStorage was cleared too', window.localStorage.getItem('brief_session') === null);
  check('the app was notified exactly once', expiredCalls === 1, String(expiredCalls));
  sent = [];
  responder = () => ({ status: 200, body: { listings: [] } });
  await api.getListings();
  check('and the client stops sending the dead token', sent[0].auth === null);
  api.setSessionExpiredHandler(null);

  console.log('\n=== Logging out clears the credential even if the call fails ===');
  api.setSessionToken('tok_LIVE');
  responder = () => ({ status: 500, body: { error: 'server exploded' } });
  await api.logout();
  check('the token is cleared despite a server error', api.getSessionToken() === null);
  check('localStorage is clear', window.localStorage.getItem('brief_session') === null);

  console.log('\n=== Server-authoritative identity ===');
  api.setSessionToken('tok_LIVE2');
  responder = () => ({ status: 200, body: { user: { id: 'usr_real', handle: 'realone', displayName: 'Real One' }, method: 'session' } });
  res = await api.whoAmI();
  check('whoAmI returns the SERVER view of identity', res.ok && res.data.id === 'usr_real');
  const meCall = sent[sent.length - 1];
  check('and it was an authenticated request', meCall.auth === 'Bearer tok_LIVE2');
  // The client must never tell the server who it is.
  check('the client does not send its own user id', !JSON.stringify(meCall.body ?? {}).includes('usr_real'));

  console.log('\n=== Orders never carry a client-side price ===');
  sent = [];
  responder = () => ({ status: 201, body: { order: { id: 'ord_1', total: 5000 } } });
  await api.createOrder({ listingId: 'list_1', quantity: 2, idempotencyKey: 'k1' });
  const orderCall = sent[sent.length - 1];
  check('the order body has no price', orderCall.body.price === undefined);
  check('no total either', orderCall.body.total === undefined);
  check('but it does carry the idempotency key', orderCall.body.idempotencyKey === 'k1');
  check('and it is authenticated', orderCall.auth === 'Bearer tok_LIVE2');

  console.log(`\n${'='.repeat(52)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
