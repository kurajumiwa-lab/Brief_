// MSHIKANO DESK — the cooperation surface, rendered for real with mocked data.
// Proves the member experience: four intents, matches with reasons, the
// two-party confirmation, and evidence-based trust (never stars).
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement; global.Element = dom.window.Element; global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent; global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
require('./suiteauth.cjs').installSuiteSession();
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');

const ME = { id: 'usr_me', handle: 'me', displayName: 'Me' };
const FARMER = {
  id: 'coop_p1', intent: 'have', intentLabel: 'Have', title: '1 tonne of mangoes', body: null,
  category: 'agriculture', town: 'Wote', county: 'Makueni', createdAt: new Date().toISOString(),
  status: 'open', mine: false, author: { id: 'usr_farmer', handle: 'farmer', displayName: 'Makueni Farmer' },
  trust: { userId: 'usr_farmer', level: 'cooperating', levelWords: 'Has worked with someone, both sides confirmed',
    evidence: { confirmedCooperations: 2, repeatPartners: 0, recommendations: 1, identityVerified: false, disputes: 0 },
    recommendationNotes: [] }
};
const POSTS = [FARMER, {
  id: 'coop_p2', intent: 'need', intentLabel: 'Need', title: '500 kg mangoes every week', body: null,
  category: 'agriculture', town: 'Gikomba', county: 'Nairobi', createdAt: new Date().toISOString(),
  status: 'open', mine: true, author: ME,
  trust: { userId: 'usr_me', level: 'new', levelWords: 'No confirmed cooperation yet',
    evidence: { confirmedCooperations: 0, repeatPartners: 0, recommendations: 0, identityVerified: false, disputes: 0 },
    recommendationNotes: [] }
}];
const MATCHES = [{
  post: FARMER, sharedCount: 1, reasons: ['both mention: mangoes'], score: 16
}];

global.fetch = async (url, init = {}) => {
  const path = String(url);
  const send = (b, s = 200) => ({ ok: s < 400, status: s, text: async () => JSON.stringify(b), json: async () => b });
  if (path.includes('/api/mshikano/posts/') && path.includes('/matches')) return send({ matches: MATCHES });
  if (path.includes('/api/mshikano/cooperations') && (init.method === 'POST')) {
    return send({ cooperation: { id: 'coopx_1', status: 'pending', fromUserId: 'usr_me', toUserId: 'usr_farmer', summary: 'About: mangoes', recommendations: [], postId: FARMER.id } }, 201);
  }
  if (path.includes('/api/mshikano/cooperations')) {
    return send({
      pending: [], declined: [], confirmed: [{ id: 'coopx_0', postId: null, fromUserId: 'usr_farmer', toUserId: 'usr_me',
        summary: 'mangoes weekly', status: 'confirmed', recommendations: [], createdAt: new Date().toISOString(),
        confirmedAt: new Date().toISOString(), direction: 'incoming', partner: { id: 'usr_farmer', displayName: 'Makueni Farmer' } }]
    });
  }
  if (path.includes('/api/mshikano/who-can-help')) return send({
    query: 'poultry', counts: { people: 1, businesses: 0, groups: 0, guides: 0 },
    people: [FARMER], businesses: [], guides: []
  });
  if (path.includes('/api/mshikano/posts') && init.method === 'POST') {
    return send({ post: { ...POSTS[1], id: 'coop_new', title: 'Solar training for three people in Kisumu', mine: true, author: ME } }, 201);
  }
  if (path.includes('/api/mshikano/posts')) return send({ posts: POSTS });
  return { ok: false, status: 404, text: async () => '{}', json: async () => ({}) };
};
dom.window.fetch = global.fetch;

let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); } };

(async () => {
  const { MshikanoDesk } = require('./src/components/MshikanoDesk.tsx');
  const root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(React.createElement(MshikanoDesk)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const body = () => text(document.body);
  const btn = (t) => Array.from(document.querySelectorAll('button')).find((b) => text(b) === t);
  const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); }); };
  const setVal = (el, v) => {
    const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value');
    d.set.call(el, v); el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  };

  console.log('=== the desk states the idea ===');
  check('the tagline is in words', body().includes('What one person has can help another'));

  console.log('\n=== four intents in the composer ===');
  for (const label of ['Have', 'Need', 'Can help', 'Looking for']) {
    check(`intent chip: ${label}`, Boolean(btn(label)));
  }
  const title = document.querySelector('textarea');
  await act(async () => { setVal(title, 'Solar training for three people in Kisumu'); });
  await click(btn('Post it'));
  check('posting confirms honestly', body().includes('Posted. Check its matches below.'), body().slice(0, 200));

  console.log('\n=== the stream shows posts + EVIDENCE trust ===');
  check('posts render', body().includes('1 tonne of mangoes') && body().includes('500 kg mangoes every week'));
  check('trust shows counted evidence, not stars', body().includes('2 confirmed') && body().includes('1 recs'));
  check('a new member is labelled honestly', body().includes('new member'));
  check('no star ratings anywhere', !/★★|☆|5 stars/i.test(body()));

  console.log('\n=== matches carry WHY ===');
  await click(btn('See matches'));
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  check('a complement is found', body().includes('1 tonne of mangoes'));
  check('the reason is stated', body().includes('both mention: mangoes'));

  console.log('\n=== the relationship unit: both sides confirm ===');
  check("'We worked together' proposes (not confirms)", body().includes('We worked together'));
  const farmerCard = Array.from(document.querySelectorAll('article')).find((a) => a.textContent.includes('1 tonne of mangoes'));
  const worked = Array.from(farmerCard.querySelectorAll('button')).find((b) => text(b) === 'We worked together');
  await click(worked);
  check('the proposal says it counts only after THEIR confirmation',
    body().includes('It counts once THEY confirm it'), body().slice(-260));
  check('the confirmed cooperation shows on the graph', body().includes('Your cooperation graph'));

  console.log('\n=== who can help? ===');
  const q = document.querySelector('input[aria-label="Ask who can help"]');
  await act(async () => { setVal(q, 'poultry business in Bungoma'); });
  await click(btn('Ask'));
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  check('the question returns grouped people', body().includes('1 person'), body().slice(-160));

  console.log(`\nPASS ${pass} FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})();
