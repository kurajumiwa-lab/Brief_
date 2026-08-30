// ARENA PULSE — the retention layer rendered honestly: live strip of REAL
// counts, level + XP bar, daily missions with claim, rivals from repeated
// play. Empty states say the truth instead of inventing a population.
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

const PROFILE = {
  userId: 'usr_me', level: 2, xpIntoLevel: 320, xpPerLevel: 500,
  seasonXp: 820, seasonCoins: 75, totalXp: 820, totalCoins: 75, matchesToday: 1
};
const MISSIONS = [
  { key: 'play_1', label: 'Play 1 match today', target: 1, hint: 'any confirmed match counts', reward: { xp: 50, coins: 0 }, progress: 1, complete: true, claimed: false, claimable: true },
  { key: 'win_2', label: 'Win 2 matches today', target: 2, hint: 'confirmed wins only', reward: { xp: 150, coins: 0 }, progress: 1, complete: false, claimed: false, claimable: false }
];
const LIVE = { playersActiveLastHour: 0, matchesAwaitingConfirmation: 0, openChallenges: 0, season: { id: 'season-01', label: 'Season 01', startedAt: '2026-08-30', endsAt: '2026-09-29', daysRemaining: 30 } };
let CLAIMED = false;

global.fetch = async (url, init = {}) => {
  const path = String(url);
  const send = (b, s = 200) => ({ ok: s < 400, status: s, text: async () => JSON.stringify(b), json: async () => b });
  if (path.includes('/claim')) {
    if (CLAIMED) return send({ error: 'already claimed today' }, 400);
    CLAIMED = true;
    MISSIONS[0].claimed = true; MISSIONS[0].claimable = false;
    return send({ claimed: { xp: 50, coins: 0 }, missions: MISSIONS, profile: PROFILE }, 201);
  }
  if (path.includes('/api/arena/live')) return send(LIVE);
  if (path.includes('/api/arena/progress/me')) return send({
    profile: PROFILE, missions: MISSIONS,
    rivals: [{ userId: 'usr_b', displayName: 'Kevin', played: 7, iWon: 4, theyWon: 3 }],
    seasonRank: { rank: 84, xp: 820, coins: 75 },
    players: [{ playerId: 'p1', rating: 1016, streak: 4, played: 10, won: 6, winRate: 60, gamerTag: 'G' }]
  });
  return { ok: false, status: 404, text: async () => '{}', json: async () => ({}) };
};

let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); } };

(async () => {
  const { ArenaPulse } = await import('../src/components/ArenaPulse.tsx');
  const root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(React.createElement(ArenaPulse)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });

  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const body = () => text(document.body);
  const btn = (t) => Array.from(document.querySelectorAll('button')).find((b) => text(b) === t);
  const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); }); };

  console.log('=== the lobby comes alive (honestly) ===');
  check('the tagline is the new one', body().includes('Play. Compete. Build your record.'));
  check('a quiet arena SAYS it is quiet — no invented population', body().includes('Quiet right now'));
  check('the season and its clock are visible', body().includes('Season 01') && body().includes('30d left'));

  console.log('\n=== the Arena identity ===');
  check('level and XP bar render', body().includes('Level 2') && body().includes('320 / 500 XP'));
  check('coins are labelled Arena Coins, not money', body().includes('75 Arena Coins'));
  check('the season rank is personal', body().includes('#84'));

  console.log('\n=== missions earn once ===');
  check('a complete mission shows Claim', Boolean(btn('Claim')));
  check('an incomplete mission shows honest progress', body().includes('1/2'));
  await click(btn('Claim'));
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  check('claiming grants and confirms in words', body().includes('Claimed +50 XP'), body().slice(-140));
  check('a claimed mission stays claimed', body().includes('Claimed'));

  console.log('\n=== rivals are earned by repetition ===');
  check('a rival shows with a head-to-head record', body().includes('Kevin') && body().includes('4 — 3 head to head'));

  console.log(`\nPASS ${pass} FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})();
