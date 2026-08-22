const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  url: 'https://brief.test/',
  pretendToBeVisual: true
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
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

let availability = { state: 'offline', gameId: null, format: null, window: null, locationKind: null };
let gameTag = null;

global.fetch = async (url, init = {}) => {
  const path = String(url);
  const method = String(init.method || 'GET').toUpperCase();
  const send = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b), json: async () => b });
  if (path.includes('/api/auth/me')) {
    return send({ user: { id: 'usr_me', handle: 'local', displayName: 'Local', personId: 'person_me' } });
  }
  if (path.includes('/api/person/me/availability') && method === 'PUT') {
    const body = init.body ? JSON.parse(init.body) : {};
    availability = { ...availability, ...body };
    return send({ availability });
  }
  if (path.includes('/api/person/me')) {
    return send({
      person: { id: 'person_me', displayName: 'Local', tags: [], aliases: [] },
      standing: { personId: 'person_me', displayName: 'Local', hosted: 0, bought: 0, arrived: 0, registered: 0, vendor: null, gameTags: [] },
      availability
    });
  }
  if (path.includes('/api/arena/players') && method === 'POST') {
    const body = init.body ? JSON.parse(init.body) : {};
    gameTag = body.gamerTag;
    return send({ player: { id: 'ply_me', userId: 'usr_me', gameId: body.gameId, gamerTag: body.gamerTag } });
  }
  if (path.includes('/api/arena/players/me')) return send({ players: gameTag ? [{ gamerTag: gameTag, gameId: 'efootball' }] : [] });
  if (path.includes('/api/arena/status')) return send({ arenaMoney: { enabled: false, requirements: [] } });
  if (path.includes('/api/arena/games')) {
    return send({ games: [{ id: 'efootball', name: 'eFootball', platform: 'mobile' }], activity: {} });
  }
  if (path.includes('/api/arena/challenges')) return send({ challenges: [] });
  if (path.includes('/api/arena/matches')) return send({ matches: [] });
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

  console.log('=== First Play visit is a real person ===');
  await click(btn('Play'));
  check('Play as the session name', /Play as Local/i.test(body()));
  check('no Nyabs fixture', !/Nyabs|ply_nyabs/.test(body()));
  check('availability is off until switched', /Not available|Off unless you switch/i.test(body()) || /Play as Local/i.test(body()));

  const playAs = btn('Play as Local');
  check('Play as is a real button', Boolean(playAs));
  if (playAs) await click(playAs);
  check('confirming keeps the person', /Local/i.test(body()));

  const go = btn('Go available');
  check('availability switch is present after confirm', Boolean(go));
  if (go) await click(go);
  check('available copy names the game honestly', /Available for eFootball, 1v1, tonight, online/i.test(body()));

  console.log('');
  console.log('='.repeat(46));
  console.log('PASSED ' + pass + '   FAILED ' + fail);
  console.log('='.repeat(46));
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
