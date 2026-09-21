// ---------------------------------------------------------------------------
// YOU SURFACE SUITE — the section list is the contract.
//
// The reorg moved three destinations into the drawer's Settings group
// (Language · Notifications · Privacy) and gave them sections here. The
// assertion that matters is the one the old suite held and kept holding:
// every Section the surface knows appears EXACTLY ONCE in the tab list, so a
// reorganisation cannot silently drop or duplicate a section. The list was
// eleven; it is now fourteen.
//
// Each new section is also checked for the thing it must say:
//   * Language — one honest line, and no selector that switches nothing;
//   * Notifications — the real notification centre, reading server rows;
//   * Privacy — the device's own stores named: the area, the offline queue,
//     and sign out.
// ---------------------------------------------------------------------------
const assert = require('assert').strict;
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.localStorage = dom.window.localStorage;

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');

const { YouSurface } = require('./src/features/you/YouSurface.tsx');

let passed = 0;
let failed = 0;
const check = (name, cond) => {
  if (cond) { passed++; console.log('PASS ' + name); }
  else { failed++; console.log('FAIL ' + name); }
};
const flush = (ms = 40) => new Promise((r) => setTimeout(r, ms));

let fetchHandler;
global.fetch = async (input, init) => fetchHandler(String(input?.url ?? input ?? ''), init);

// The stubbed ledger: a signed-in member ("Amina"), the world's reads offline
// for the suite, and one real notification so the centre has a row to show.
const stub = () => async (url) => {
  const u = String(url);
  const ok = (body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
  if (u.includes('/auth/me')) return ok({ user: { displayName: 'Amina', handle: 'amina' } });
  if (u.includes('/notifications') && u.includes('preferences')) return ok({ preferences: { categories: {} } });
  if (u.includes('/notifications')) return ok({
    notifications: [{
      id: 'n1', kind: 'errand', type: 'status', title: 'A carrier took your errand',
      body: 'Wakulima → Westlands', objectId: null, entityId: null, collectionId: null,
      imageUrl: null, sourceName: null, context: null, dest: null, priority: 'normal',
      read: false, createdAt: new Date().toISOString()
    }],
    unread: 1
  });
  return { ok: false, status: 503, text: async () => JSON.stringify({ error: 'offline for the suite' }) };
};

const mount = (props) => {
  document.body.innerHTML = '';
  const c = document.createElement('div');
  document.body.appendChild(c);
  const root = createRoot(c);
  act(() => { root.render(React.createElement(YouSurface, props)); });
  return { c, root };
};

const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const clickTab = (label) => {
  const b = Array.from(document.querySelectorAll('button')).find((x) => (x.textContent || '').trim() === label);
  if (!b) throw new Error('no tab: ' + label);
  act(() => { b.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
  return flush(20);
};

// The section contract. Every id the surface knows, exactly once — and the
// group headers that organise them.
const EXPECTED_SECTIONS = [
  'Profile', 'Standing', 'Following',
  'Selling', 'Orders', 'Your network',
  'Earn', 'Table Banking', 'Subscriptions', 'Archive',
  'How Trace works',
  'Language', 'Notifications', 'Privacy'
];

async function main() {
  fetchHandler = stub();
  // Seeded on the device BEFORE the surface reads it: privacy names the store
  // as it is, and the surface reads it once on mount.
  dom.window.localStorage.setItem('brief.world.place', 'Kisii');
  const { c, root } = mount({ onOpenEntity: () => {}, onRequireAuth: () => {} });
  await flush(60);

  check('greeting uses the session name, not a placeholder', text(c).includes('Amina'));

  const tabLabels = Array.from(document.querySelectorAll('button'))
    .map((b) => (b.textContent || '').trim())
    .filter((t) => EXPECTED_SECTIONS.includes(t));
  const seen = new Map();
  tabLabels.forEach((t) => seen.set(t, (seen.get(t) ?? 0) + 1));
  check('every section tab appears exactly once',
    EXPECTED_SECTIONS.every((s) => seen.get(s) === 1) && tabLabels.length === EXPECTED_SECTIONS.length);

  // The settings group exists, in the drawer's order.
  check('settings group holds Language · Notifications · Privacy',
    /Settings/.test(text(c)) && tabLabels.indexOf('Language') < tabLabels.indexOf('Notifications') && tabLabels.indexOf('Notifications') < tabLabels.indexOf('Privacy'));

  // ── Language: one honest line, no selector that switches nothing. ──
  await clickTab('Language');
  check('language says the one language, plainly',
    /English/.test(text(c)) && /one language/i.test(text(c)));
  check('language has no fake selector',
    !document.querySelector('select') && !Array.from(document.querySelectorAll('button')).some((b) => /switch|change language/i.test(b.textContent || '')));

  // ── Notifications: the real centre, reading the server's one row. ──
  await clickTab('Notifications');
  await flush(30);
  check('notifications shows the server row, not an invention',
    /carrier took your errand/.test(text(c)));

  // ── Privacy: the device's stores, named, with real controls. ──
  await clickTab('Privacy');
  check('privacy names the area the device keeps',
    /Your area/.test(text(c)) && /Kisii/.test(text(c)));
  check('privacy shows the offline queue as a count',
    /Offline queue/.test(text(c)) && /Nothing is parked|waiting for signal/.test(text(c)));
  check('privacy carries a real sign-out',
    Array.from(document.querySelectorAll('button')).some((b) => (b.textContent || '').trim() === 'Sign out'));

  // The area clear acts on the store, not on a copy of it.
  const clearBtn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Clear');
  act(() => { clearBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
  check('clearing the area empties the device store',
    dom.window.localStorage.getItem('brief.world.place') === null);

  // ── The old sections survive the reorg: profile still leads. ──
  await clickTab('Profile');
  check('profile section still renders under the reorg',
    /Your account/.test(text(c)));

  act(() => { root.unmount(); });
  console.log(`\nPASSED ${passed} / FAILED ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
