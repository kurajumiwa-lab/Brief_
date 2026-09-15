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
  if (url.includes('/api/pulse')) {
    return ok({
      asOf: null,
      sections: {
        demand: { open: 0, bySeverity: { no_supplier: 0, awaiting_quote: 0, awaiting_accept: 0 }, collective: 0 },
        closure: { windowDays: 30, closed: 0, topCategory: null },
        fill: { windowDays: 30, closed: 0, avgHoursToFill: null, hoursSampleCount: 0, avgValue: null },
        money: { windowDays: 30, settledOrders: 0, settledValue: null, settledCurrency: null, completedWorkOrders: 0, deliveredPickups: 0 },
        listings: { active: 0, snapshot: [] },
        events: { open: 0, newLast24h: { requests: 0, events: 0, listings: 0, orders: 0 } }
      },
      facts: [], empty: true, note: 'derived'
    });
  }
  if (url.includes('/api/me/position')) {
    return ok({
      position: {
        decay: { expiringQuotes: [], waitlist: [], override: null, overdueInstallments: 0 },
        missedCapture: { count: 0, recent: [], value: null },
        nextMove: null,
        open: { total: 0, top: [] },
        derivedAt: '2026-09-15T00:00:00Z', note: 'derived'
      }
    });
  }
  if (url.includes('/api/me/commitments')) {
    return ok({ commitments: { owedByMe: [], owedToMe: [], fulfilled: [], lapsed: [], owedByMeKes: 0, owedToMeKes: 0, derivedAt: '2026-09-15T00:00:00Z', note: 'derived' } });
  }
  if (url.includes('/api/me/reciprocity')) {
    return ok({ reciprocity: { owedToMe: [], owedByMe: [], fulfilled: [], aging: [], windowDays: 14, derivedAt: '2026-09-15T00:00:00Z', note: 'derived' } });
  }
  if (url.includes('/api/auth/me')) return ok({ user: { id: 'usr_1', handle: 'amina', displayName: 'Amina' } });
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

  // --- 2b. The head card is a clean, premium light header ------------------
  {
    const c = mount(React.createElement(CityFeedView, { onOpenSpace: () => {} }));
    await flush();
    // No dark gradient card, no scoreboard, no pagination dots.
    const card = c.querySelector('.bg-gradient-to-b');
    assert.ok(!card, 'no dark gradient card remains');
    const t = text(c);
    assert.ok(t.includes('Everything happening around you'), 'a premium title is present');
    assert.ok(t.includes('Discover'), 'an eyebrow label is present');
    // Section navigation survives as light chips.
    const nav = c.querySelector('nav[aria-label="Discover sections"]');
    assert.ok(nav, 'the section navigation is present');
    const chips = Array.from(nav.querySelectorAll('button'));
    assert.equal(chips.length, 6, 'six discover sections (Pulse is now one of them)');
    assert.equal(chips[0].getAttribute('aria-pressed'), 'true', 'the first (All) section is active by default');
    // No scoreboard "0 : 0" hero.
    const hero = Array.from(c.querySelectorAll('div')).find((d) => (d.getAttribute('class') || '').includes('text-3xl'));
    assert.ok(!hero, 'no scoreboard hero remains');
  }
  pass('DiscoveryHead is a clean premium light header (no scoreboard, no dark card)');

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

  // --- 4. The All tab is a decision screen, not a catalogue --------------
  {
    const c = mount(React.createElement(CityFeedView, { onOpenSpace: () => {} }));
    await flush();
    const t = text(c);
    // The orphaned, clipped "COMMUNITY MARKETPLACE & SECOND-HAND DROPS" block
    // and its Browse/My orders/Selling row no longer sit on the browse screen.
    assert.ok(!/Community Marketplace/i.test(t), 'the marketplace block is off the All tab');
    assert.ok(!/My orders/.test(t), 'the marketplace tab row is off the All tab');
    // Commerce is reachable as its own segment instead.
    const nav = c.querySelector('nav[aria-label="Discover sections"]');
    assert.ok(Array.from(nav.querySelectorAll('button')).some((b) => text(b) === 'Market'), 'Market is its own segment');
    // The three zones exist above the fold: world, decision, inventory.
    assert.ok(t.includes("What's moving"), 'a signal line is present');
    assert.ok(t.includes('Events around you'), 'the case (gallery) heads the browse zone');
    // Deep filters are not a four-row panel anymore — nothing is on screen but
    // a sheet trigger.
    assert.ok(!/shown\b/.test(t), 'no result counter anywhere on the browse screen');
  }
  pass('All tab: no orphaned marketplace block, no result counter, three zones present');

  // --- 5. Pulse is its own segment (the world, kept apart from you) --------
  {
    const c = mount(React.createElement(CityFeedView, { onOpenSpace: () => {} }));
    await flush();
    const nav = c.querySelector('nav[aria-label="Discover sections"]');
    const pulse = Array.from(nav.querySelectorAll('button')).find((b) => text(b) === 'Pulse');
    act(() => { pulse.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    assert.ok(/Pulse/.test(text(c)), 'Pulse renders as a surface');
    // Its empty state is honest: nothing is pre-filled to look busy.
    assert.ok(/Nothing has moved yet|Pulse is unavailable/.test(text(c)), 'Pulse reports real emptiness or a real error');
  }
  pass('Pulse is a Discover segment with an honest empty state');

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
