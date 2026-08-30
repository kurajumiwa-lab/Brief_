// REWARDS DESK — referrals with a mathematical edge, rendered with mocks.
// Proves the member can SEE the honest structure: the code, the one-level
// rule in words, the pool and its empty state, and payouts with states.
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement; global.Element = dom.window.Element; global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent; global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.navigator.clipboard = { writeText: async () => {} };
require('./suiteauth.cjs').installSuiteSession();
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');

const MINE = {
  code: 'REFA123', maxDepth: 1, link: 'https://brief.test/?ref=REFA123',
  balance: { earned: 775, locked: 500, available: 275 },
  pool: { backingKes: 50, paidOrPromisedKes: 50, availableKes: 0 },
  conversion: { ptsToKes: 0.1, minPoints: 500 },
  events: [
    { id: 'refv1', kind: 'signup', points: 100, valueKes: 0, at: new Date().toISOString() },
    { id: 'refv2', kind: 'referral_order', points: 500, valueKes: 10000, at: new Date().toISOString() }
  ],
  conversions: [{ id: 'refc1', points: 500, kes: 50, status: 'pending', refusedReason: null, createdAt: new Date().toISOString() }]
};
let CONVERT_RESULT = null;

global.fetch = async (url, init = {}) => {
  const path = String(url);
  const send = (b, s = 200) => ({ ok: s < 400, status: s, text: async () => JSON.stringify(b), json: async () => b });
  if (path.includes('/api/referrals/share')) return send({ code: MINE.code, slug: null, url: MINE.link, message: '*Brief*\nwhat is happening around you', waMe: 'https://wa.me/?text=Brief' });
  if (path.includes('/api/referrals/convert')) {
    const body = JSON.parse(init.body ?? '{}');
    if (CONVERT_RESULT) return send(CONVERT_RESULT, CONVERT_RESULT.err ? 409 : 201);
    if (body.points < MINE.conversion.minPoints) return send({ error: 'convert at least 500 points (KES 50)' }, 400);
    return send({ error: 'the rewards pool holds KES 0 right now — conversions are backed by real confirmed revenue only' }, 409);
  }
  if (path.includes('/api/referrals/mine')) return send(MINE);
  return { ok: false, status: 404, text: async () => '{}', json: async () => ({}) };
};

let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); } };

(async () => {
  const { default: RewardsDesk } = await import('../src/components/RewardsDesk.tsx');
  const root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(React.createElement(RewardsDesk, { settledPoints: 42, rank: 'new', accepted: 3, pending: 1 })); });
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });

  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const body = () => text(document.body);
  const btn = (t) => Array.from(document.querySelectorAll('button')).find((b) => text(b) === t);
  const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); }); };
  const setVal = (el, v) => {
    const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value');
    d.set.call(el, v); el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  };

  console.log('=== the honest structure is visible ===');
  check('the code is shown big', body().includes('REFA123'));
  check('the one-level rule is stated in words', body().includes('One level deep'));
  check('no entry fee is stated in words', body().includes('No entry fee'));
  check('cash only from earned money is stated', body().includes('backed by money Brief actually earned'));

  console.log('\n=== the pool tells the truth ===');
  check('an empty pool says WHY it is empty', body().includes('never printed from nothing'), body().slice(-200));
  check('the locked/earned/available split renders', body().includes('775 earned') && body().includes('500 locked'));

  console.log('\n=== conversion refuses honestly ===');
  const inp = document.querySelector('input[aria-label="Points to convert"]');
  await act(async () => { setVal(inp, '500'); });
  await click(btn('Convert'));
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  check('a refused conversion states the pool reason', body().includes('backed by real confirmed revenue'), body().slice(-160));

  console.log('\n=== payouts carry states ===');
  check('a pending payout says PENDING', body().toUpperCase().includes('PENDING'));
  check('earned events are explained in words', body().includes('someone joined with your code') && body().includes('an order by someone you brought'));

  console.log(`\nPASS ${pass} FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})();
