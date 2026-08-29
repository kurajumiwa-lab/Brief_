// THE APP GATE — no access without an account (product decision 2026-08-29).
//
// Two renders of the REAL App:
//   1. signed out  -> the wall is the whole experience; no shelf, no feed,
//                     no navigation into the product;
//   2. signed in   -> the wall is gone and the actual app is on screen.
// The server side of the same rule (401 account_required on every data
// route) is proven in the server suite; this file proves the client half.
const { JSDOM } = require('jsdom');

let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); } };

async function renderApp({ session }) {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></div></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
  global.window = dom.window; global.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
  global.HTMLElement = dom.window.HTMLElement; global.Element = dom.window.Element; global.Node = dom.window.Node;
  global.MouseEvent = dom.window.MouseEvent; global.getComputedStyle = dom.window.getComputedStyle;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  if (session) require('./suiteauth.cjs').installSuiteSession();
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { act } = require('react-dom/test-utils');
  const App = require('./src/App.tsx').default;
  const root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(React.createElement(App)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const body = () => text(document.body);
  const out = { body, root };
  return out;
}

(async () => {
  console.log('=== signed out: the wall is the product ===');
  {
    const { body } = await renderApp({ session: false });
    check('the gate wall is on screen', body().includes('An account opens everything'));
    check('the capabilities copy states what an account unlocks', /publish your own stories/i.test(body()) && /EPL fantasy rooms/i.test(body()));
    check('Google honesty: activation depends on deployment credentials', /Google sign-in activates/i.test(body()));
    check('the primary registry is named as an option', /Brief handle/i.test(body()));
    check('NO app content leaks past the wall', !body().includes('What do you want to do?'));
    check('no sidebar navigation behind the wall', !document.querySelector('nav[aria-label="Primary"]'));
  }

  console.log('\n=== signed in: the wall lifts ===');
  {
    const { body } = await renderApp({ session: true });
    check('the wall is gone', !body().includes('An account opens everything'));
    check('the app itself is reachable (main shelf renders)', body().includes('What do you want to do?'));
  }

  console.log(`\nPASS ${pass} FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})();
