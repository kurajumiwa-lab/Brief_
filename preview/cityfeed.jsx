// ---------------------------------------------------------------------------
// CITY FEED (Discover) — pins the two regressions this layer had:
//   1. the nav pill highlighted HOME while the City feed was on screen
//      (the Discover tab looked unselectable and the screens "merged"), and
//   2. the Events / Marketplace sub-tabs had no input surface to post.
// Now: 'city' normalises to Discover, and the feed exposes "Host an event"
//      (a real createCampaign -> publish) and "Post a listing" (deep-links to
//      the marketplace Selling flow).
// ---------------------------------------------------------------------------
const assert = require('assert').strict;
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.HTMLSelectElement = dom.window.HTMLSelectElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.localStorage = dom.window.localStorage;

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const { Navigation } = require('./src/app/Navigation.tsx');
const { CityFeedView } = require('./src/features/city/CityFeedView.tsx');

let count = 0;
const pass = (n) => { count++; console.log('PASS ' + n); };
const flush = (ms = 40) => new Promise((r) => setTimeout(r, ms));
function mount(el) {
  document.body.innerHTML = '';
  const c = document.createElement('div');
  document.body.appendChild(c);
  const root = createRoot(c);
  act(() => root.render(el));
  return c;
}
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const btn = (label) => Array.from(document.querySelectorAll('button')).find((b) => text(b) === label || text(b).startsWith(label));

// Broad, honest-empty fetch mock: every surface the City feed mounts reads
// real rows; none exist in this fixture, so each answers with an empty shape.
global.fetch = async (input) => {
  const url = String(typeof input === 'string' ? input : input?.url ?? input);
  const ok = (body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
  if (url.includes('/events/categories')) return ok({ categories: [], labels: {} });
  if (url.includes('/api/events')) return ok({ events: [], total: 0 });
  if (url.includes('/api/listings/mine')) return ok({ vendor: null, listings: [] });
  if (url.includes('/api/listings')) return ok({ listings: [] });
  if (url.includes('/api/orders')) return ok({ orders: [] });
  if (url.includes('/earnings')) return ok({ earnings: { gross: 0, net: 0, payoutAvailable: false } });
  if (url.includes('/public/spaces')) return ok({ spaces: [] });
  if (url.includes('/pickups/origins')) return ok({ origins: [] });
  if (url.includes('/pickups/riders')) return ok({ riders: [] });
  if (url.includes('/pickups/mine')) return ok({ pickups: [] });
  if (url.includes('/pickup-origin-fee')) return ok({ obligation: { agentId: 'me', pickupCount: 0, feePerPickupKes: 20, originFeeKes: 0, note: 'derived' } });
  if (url.includes('/pickup-fee/settlements')) return ok({ settlements: [] });
  if (url.includes('/api/circles')) return ok({ circles: [] });
  if (url.includes('/api/vaults')) return ok({ vaults: [] });
  return { ok: false, status: 404, text: async () => JSON.stringify({}) };
};

async function main() {
  // --- 1. Navigation: 'city' normalises to DISCOVER, never Home ------------
  {
    const c = mount(React.createElement(Navigation, { activeTab: 'city', onSelectTab: () => {} }));
    const tabs = Array.from(c.querySelectorAll('button[role="tab"]'));
    const discover = tabs.find((b) => text(b).includes('Discover'));
    const home = tabs.find((b) => text(b).includes('Home'));
    assert.ok(discover && home, 'both Home and Discover tabs render');
    assert.equal(discover.getAttribute('aria-selected'), 'true', 'Discover is selected when the City feed is active');
    assert.equal(home.getAttribute('aria-selected'), 'false', 'Home is NOT selected when the City feed is active');
  }
  pass('Navigation highlights Discover (not Home) when the City feed is active');

  // --- 2. City feed exposes post affordances --------------------------------
  {
    const c = mount(React.createElement(CityFeedView, { onOpenSpace: () => {} }));
    await flush();
    assert.ok(btn('Host'), 'a Host-an-event affordance exists');
    assert.ok(btn('Post a listing'), 'a Post-a-listing affordance exists');
  }
  pass('CityFeedView exposes event + marketplace input surfaces');

  // --- 2b. The head card clones the four-primitive shell -------------------
  {
    const c = mount(React.createElement(CityFeedView, { onOpenSpace: () => {} }));
    await flush();
    const tablist = c.querySelector('[role="tablist"]');
    assert.ok(tablist, 'the head renders a segmented control (tablist)');
    const segs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    assert.equal(segs.length, 5, 'five discover sections');
    assert.equal(segs[0].getAttribute('aria-selected'), 'true', 'the first (All) section is active by default');
    const heroEl = Array.from(c.querySelectorAll('div')).find((d) => (d.getAttribute('class') || '').includes('text-3xl'));
    assert.ok(heroEl, 'the head renders a hero scoreboard element');
    assert.ok(/^\d+\s*:\s*\d+$/.test(text(heroEl)), `hero shows two derived counts split by a colon (got "${text(heroEl)}")`);
    const dashes = Array.from(c.querySelectorAll('div[aria-hidden="true"] div')).filter((d) => (d.getAttribute('class') || '').includes('h-1 w-5'));
    assert.equal(dashes.length, 5, 'five carousel dashes');
  }
  pass('DiscoveryHead clones the segmented control + scoreboard + pagination dots');

  // --- 3. Host opens a real event form; Post-a-listing opens Selling -------
  {
    mount(React.createElement(CityFeedView, { onOpenSpace: () => {} }));
    await flush();
    act(() => { btn('Host').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    assert.ok(text(document.body).includes('Put your event on the public feed'), 'the host-event form opens');
    assert.ok(document.querySelector('input[aria-label="Event title"]'), 'the form has a title input');
    // close it
    act(() => { Array.from(document.querySelectorAll('button')).find((b) => text(b) === 'Cancel').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();

    act(() => { btn('Post a listing').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    assert.ok(text(document.body).includes('Start selling'), 'Post a listing deep-links to the marketplace Selling flow');
  }
  pass('Host opens the event form; Post-a-listing opens the Selling flow');

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
