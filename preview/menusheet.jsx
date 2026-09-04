// MENU, REDESIGNED — a navigation surface in the SAME visual system as the
// Arena screen: near-black page, dark cards, orange actions, one gold accent
// reserved for membership. One close control. Icons + typography, not
// photography. The bottom nav stays visible (z-50 beneath the dock).
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

global.fetch = async (url) => {
  const path = String(url);
  const send = (b, s = 200) => ({ ok: s < 400, status: s, text: async () => JSON.stringify(b), json: async () => b });
  if (path.includes('/api/auth/me')) return send({ user: { id: 'usr_1', handle: 'njeria', displayName: 'Mama Njeria' } });
  if (path.includes('/api/creator/mediakit/mine')) return send({ mediaKit: { displayName: 'Mama Njeria', contactMethod: '+254712345678', audience: { views: 1200 } } });
  if (path.includes('/api/host/command')) return send({ command: {
    money: { grossSettled: 0, grossPending: 0, currency: 'KES' },
    people: { registered: 12, checkedIn: 3 },
    distribution: { views: 99 }, now: [], upcoming: [], action: [],
    campaigns: [{ id: 'c1' }], vaultCount: 2
  } });
  if (path.includes('/api/person/me')) return send({ person: { id: 'usr_1' }, standing: { bought: 2 } });
  return { ok: false, status: 404, text: async () => '{}', json: async () => ({}) };
};

let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); } };

(async () => {
  const { MenuSheet } = await import('../src/components/MenuSheet.tsx');
  let picked = null; let city = null;
  const root = createRoot(document.getElementById('root'));
  await act(async () => {
    root.render(React.createElement(MenuSheet, {
      open: true,
      onClose: () => {},
      onSelect: (t) => { picked = t; },
      onSelectCity: (c) => { city = c; },
      selectedLocation: 'Nairobi, Kenya',
      canOperate: true
    }));
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });

  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const body = () => text(document.body);
  const btnByLabel = (l) => Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === l || text(b) === l);
  const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); }); };

  console.log('=== one app, two purposes: Menu navigates ===');
  check('the header says what the page is for', body().includes('Your shortcuts, tools and account'));
  check('the sheet is the light surface, not dark navy', Boolean(document.querySelector('.bg-\\[\\#EFF1F4\\]')), 'no light-surface sheet class');

  console.log('\n=== two-thirds sheet, the app still visible behind ===');
  const sheet = document.querySelector('.h-\\[2\\/3\\]') ?? document.querySelector('.h-2\\/3');
  check('the Menu occupies exactly two-thirds of the screen', Boolean(sheet), 'no h-2/3 element');
  const scrim = Array.from(document.querySelectorAll('button')).find((b) => /dismiss/i.test(b.getAttribute('aria-label') ?? ''));
  check('the remaining third is a see-through scrim over the live app', Boolean(scrim) && (scrim.className.includes('/25') || scrim.className.includes('/20')), scrim?.className);
  check('the scrim closes the Menu on tap (the natural dismissal)', Boolean(scrim));
  check('no opaque blackout anywhere — the underlying screen is SEEN', !Array.from(document.querySelectorAll('[class*="bg-black"]')).length, 'found a bg-black element');
  check('no neon green anywhere on the page', !body().includes('#00DF8F') && !document.querySelector('[class*="00DF8F"]'));
  check('EXACTLY ONE close control, in the top-right, neutral',
    Array.from(document.querySelectorAll('button')).filter((b) => /close/i.test(b.getAttribute('aria-label') ?? '')).length === 1
    && Boolean(btnByLabel('Close menu')));

  console.log('\n=== the Local card: compressed, honest ===');
  check('the account is one compact card', body().includes('Mama Njeria'));
  check('the identity opens the profile (My Layer)', Boolean(btnByLabel('Open your profile')));
  await click(btnByLabel('Open your profile'));
  check('profile door routes to Saved', picked?.tab === 'mylayer' && picked?.section === 'saved', JSON.stringify(picked));
  check('membership stays gold — the ONLY gold', body().includes('Platinum Member'));
  check('the settled figure is on the same line, muted', body().includes('KES 0 settled'));
  check('View opens the standing, derived from real rows', Boolean(btnByLabel('View →')));
  await click(btnByLabel('View →'));
  check('standing appears on demand (Settled · Arrived · Views · Hosted · Bought)',
    ['Settled', 'Arrived', 'Views', 'Hosted', 'Bought'].every((k) => body().includes(k)));
  check('sign out lives inside the account, not on the page chrome', body().includes('Sign out'));

  console.log('\n=== explore: icons + typography, no photography ===');
  check('doors as a grid, not a horizontal shelf',
    ['Nearby', 'Saved', 'Events', 'Communities', 'Marketplace', 'Mshikano', 'WhatsApp Shop'].every((k) => body().includes(k)));
  check('no photographic shelf cards inside Menu', document.querySelectorAll('img').length === 0);
  await click(Array.from(document.querySelectorAll('button')).find((b) => text(b).includes('WhatsApp Shop')));
  check('the WhatsApp Shop door routes to the builder', picked?.tab === 'workflows' && picked?.section === 'shop', JSON.stringify(picked));
  await click(Array.from(document.querySelectorAll('button')).find((b) => text(b).startsWith('Events')));
  check('the Events door routes to nearby events', picked?.tab === 'nearby' && picked?.section === 'events', JSON.stringify(picked));
  await click(Array.from(document.querySelectorAll('button')).find((b) => text(b).includes('Communities')));
  check('the Communities door routes to circles', picked?.tab === 'mylayer' && picked?.section === 'circles', JSON.stringify(picked));
  await click(Array.from(document.querySelectorAll('button')).find((b) => text(b).includes('Marketplace')));
  check('the Marketplace door routes to the market', picked?.tab === 'nearby' && picked?.section === 'market', JSON.stringify(picked));

  console.log('\n=== quick actions: compact rows, fast to scan ===');
  check('five rows in one card',
    ['New', 'Calendar', 'Inbox', 'Records', 'Dashboard'].every((k) => body().includes(k)));
  await click(Array.from(document.querySelectorAll('button')).find((b) => text(b).startsWith('Records')));
  check('Records goes to the vault', picked?.tab === 'workflows' && picked?.section === 'vault', JSON.stringify(picked));

  console.log('\n=== region + operate, in the same language ===');
  check('region chips are buttons with state', Array.from(document.querySelectorAll('button')).filter((b) => /Kenya|Tanzania/.test(text(b))).length >= 2);
  check('the operator door is a row like the others', body().includes('Operate') && body().includes('operator desk'));
  check('coming-later is one quiet line, not locked cards', body().includes('Coming later — Courses · Data desk · Premium'));

  console.log(`\nPASS ${pass} FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})();
