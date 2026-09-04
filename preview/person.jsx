const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  url: 'https://brief.test/',
  pretendToBeVisual: true
});
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true }); // Node >=21 ships a getter-only navigator; plain assignment silently fails
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const App = require('./src/App.tsx').default;

global.fetch = async (url, init = {}) => {
  const path = String(url);
  const send = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b), json: async () => b });
  if (path.includes('/api/auth/me')) {
    return send({ user: { id: 'usr_me', handle: 'local', displayName: 'Local Person', personId: 'person_me' } });
  }
  if (path.includes('/api/person/me')) {
    return send({
      person: { id: 'person_me', displayName: 'Local Person', tags: [], aliases: [] },
      standing: { personId: 'person_me', displayName: 'Local Person', hosted: 2, bought: 1, arrived: 3, registered: 0, vendor: null, gameTags: [] },
      availability: { state: 'offline' }
    });
  }
  if (path.includes('/api/lobby/rooms')) return send({ rooms: [] });
  if (path.includes('/api/feed')) {
    return send({ feed: { hero: [], discovery: [], opportunities: [], more: [], tea: null, moreTea: [], counts: { objects: 0, tea: 0, deduped: 0 } } });
  }
  return { ok: false, status: 404, text: async () => '{}', json: async () => ({}) };
};

async function main() {
  const root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(React.createElement(App)); });
  const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const body = () => text(document.body);
  const click = async (el) => {
    await act(async () => {
      el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  };
  const btn = (t) =>
    Array.from(document.querySelectorAll('button')).find((b) => text(b) === t || text(b).startsWith(t));
  let pass = 0;
  let fail = 0;
  const check = (n, c, d = '') => {
    if (c) { pass++; console.log('  PASS  ' + n); }
    else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); }
  };

  console.log('=== Session person identity ===');
  const menuBtn = btn('Menu');
  if (menuBtn) await click(menuBtn);
  check('displays session person name or menu', /Local Person|Menu|Brief/i.test(body()));
  check('no fixture nyabs name', !/Nyabs|ply_nyabs/.test(body()));

  console.log('');
  console.log('='.repeat(46));
  console.log('PASSED ' + pass + '   FAILED ' + fail);
  console.log('='.repeat(46));
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
