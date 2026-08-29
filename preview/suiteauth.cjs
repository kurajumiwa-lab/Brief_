// SUITE SESSION — install BEFORE requiring App.tsx (and before a suite
// installs its own fetch mock).
//
// The app gate (no access without an account) does not render the app at all
// without a session, so suites that exercise the SIGNED-IN product need two
// things: a stored session token, and an /api/auth/me answer. Suites later
// replace global.fetch with their own fixture mocks — so this installs a
// DISPATCHER property that cannot be lost by reassignment: /api/auth/me is
// always answered here, and everything else flows to whatever mock (or real
// fetch) is currently installed.
const ME_BODY = JSON.stringify({
  user: {
    id: 'usr_suite_runner',
    handle: 'suite_runner',
    displayName: 'Suite Runner',
    personId: 'per_suite_runner'
  },
  method: 'password'
});

function installSuiteSession() {
  try {
    window.localStorage.setItem('brief_session', 'suite-runner-token');
  } catch { /* jsdom without storage: the gate shows; suites fail loudly */ }
  let next = global.fetch ?? window.fetch;
  if (!next) return;
  Object.defineProperty(global, 'fetch', {
    configurable: true,
    get() {
      return async (input, init) => {
        const url = String((typeof input === 'string' ? input : input?.url) ?? input);
        if (url.includes('/api/auth/me')) {
          return new Response(ME_BODY, { status: 200, headers: { 'content-type': 'application/json' } });
        }
        return next(input, init);
      };
    },
    set(v) { next = v; }
  });
  try { window.fetch = global.fetch; } catch { /* read-only in some envs */ }
}
module.exports = { installSuiteSession };
