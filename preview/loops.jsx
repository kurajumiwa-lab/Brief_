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

// Phase 1 loop walk: every listed card must expose a real verb.
global.fetch = async (url, init = {}) => {
  const path = String(url);
  const method = String(init.method || 'GET').toUpperCase();
  const send = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b), json: async () => b });
  if (path.includes('/api/auth/me')) {
    return send({ user: { id: 'usr_me', handle: 'local', displayName: 'Local', personId: 'person_me' } });
  }
  if (path.includes('/api/person/me')) {
    return send({
      person: { id: 'person_me', displayName: 'Local', tags: [], aliases: [] },
      standing: { personId: 'person_me', displayName: 'Local', hosted: 0, bought: 0, arrived: 0, registered: 0, vendor: null, gameTags: [] },
      availability: { state: 'offline' }
    });
  }
  if (path.includes('/api/arena/players')) return send({ players: [] });
  if (path.includes('/api/arena/status')) return send({ arenaMoney: { enabled: false, requirements: [] } });
  if (path.includes('/api/arena/games')) {
    return send({
      games: [{ id: 'efootball', name: 'eFootball', platform: 'mobile' }],
      activity: { efootball: 2 }
    });
  }
  if (path.includes('/api/arena/challenges/') && path.endsWith('/accept') && method === 'POST') {
    return send({
      challenge: { id: 'chl_mike_1', status: 'accepted', acceptedBy: 'usr_me' },
      match: {
        id: 'mtch_real',
        challengeId: 'chl_mike_1',
        gameId: 'efootball',
        playerAId: 'usr_host',
        playerBId: 'usr_me',
        status: 'scheduled',
        createdAt: '2026-08-22T10:00:00Z'
      },
      reused: false
    });
  }
  if (path.includes('/api/arena/challenges') && method === 'GET') {
    return send({
      challenges: [
        {
          id: 'chl_mike_1',
          gameId: 'efootball',
          mode: '1v1',
          createdBy: 'usr_host',
          stake: 'friendly',
          openUntil: '2099-01-01T00:00:00Z',
          status: 'open',
          createdAt: '2026-08-15T09:10:00Z'
        }
      ]
    });
  }
  if (path.includes('/api/arena/matches')) return send({ matches: [] });
  if (path.includes('/api/lobby/rooms')) return send({ rooms: [] });
  if (path.includes('/api/collections')) return send({ collections: [] });
  if (path.includes('/api/feed')) {
    return send({
      feed: {
        hero: [],
        discovery: [],
        opportunities: [],
        more: [],
        tea: null,
        moreTea: [],
        counts: { objects: 0, tea: 0, deduped: 0 }
      }
    });
  }
  return { ok: false, status: 404, text: async () => '{}', json: async () => ({}) };
};

async function main() {
  const root = createRoot(document.getElementById('root'));
  await act(async () => {
    root.render(React.createElement(App));
  });
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
    if (c) {
      pass++;
      console.log('  PASS  ' + n);
    } else {
      fail++;
      console.log('  FAIL  ' + n + (d ? ' -> ' + d : ''));
    }
  };

  console.log('=== Play cards complete their loop ===');
  await click(btn('Play'));
  check('Play is a place on the URL', window.location.pathname === '/play' || window.location.pathname.startsWith('/play'));
  await click(btn('Challenges'));
  check('Challenges live at /play/challenges', window.location.pathname === '/play/challenges');
  check('Accept is a real button', Boolean(btn('Accept')));
  check('open-challenge verb exists', /Open a 1v1 challenge/i.test(body()));
  await click(btn('Accept'));
  check('accept does not invent fixture names', !/Nyabs|Jay|Kip|Wanjiku/.test(body()));

  console.log('\n=== Menu coming-soon is not a fake door ===');
  const menu = btn('Menu');
  if (menu) await click(menu);
  const dead = Array.from(document.querySelectorAll('button')).filter((b) =>
    /^(Courses|Data desk|Premium)$/.test(text(b))
  );
  check('coming-soon rows are not buttons', dead.length === 0);
  check('coming-soon is labelled not built', /Not built/i.test(body()));

  console.log('');
  console.log('='.repeat(46));
  console.log('PASSED ' + pass + '   FAILED ' + fail);
  console.log('='.repeat(46));
  process.exit(fail ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
