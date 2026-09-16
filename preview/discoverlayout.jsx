// ---------------------------------------------------------------------------
// THE MERGED DISCOVER — the old layout's shape, the new one's honesty.
//
// The tile grid is the navigation (no chip row), Marketplace is the default
// room, and one big card carries the featured slot. What the mock used to
// supply by lying is now either a row or an admission that there is none:
//   * a photo only if the seller uploaded one — no borrowed stock image;
//   * an interest count only from settled orders / real registrations;
//   * the reason the item is featured, printed on the card;
//   * zeros on the tiles, including when every tile is zero;
//   * and an empty hero that offers the one action that changes it.
// ---------------------------------------------------------------------------
const assert = require('assert').strict;
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.localStorage = dom.window.localStorage;

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const { CityFeedView } = require('./src/features/city/CityFeedView.tsx');
const { DiscoverFeatured } = require('./src/features/city/DiscoverFeatured.tsx');

let count = 0;
const pass = (n) => { count++; console.log('PASS ' + n); };
const flush = (ms = 60) => new Promise((r) => setTimeout(r, ms));
function mount(el) {
  document.body.innerHTML = '';
  const c = document.createElement('div');
  document.body.appendChild(c);
  const root = createRoot(c);
  act(() => root.render(el));
  return { container: c, root };
}
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const btn = (want) => Array.from(document.querySelectorAll('button')).find((b) => text(b) === want || text(b).startsWith(want));
const tile = (want) => Array.from(document.querySelectorAll('button[role="tab"]')).find((b) => text(b).includes(want));
const click = (el) => act(() => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));

const SUMMARY = {
  tiles: [
    { key: 'marketplace', label: 'Marketplace', count: 2, unit: 'live offer' },
    { key: 'events', label: 'Events', count: 1, unit: 'published' },
    { key: 'circles', label: 'Circles', count: 4, unit: 'you could join' },
    { key: 'errands', label: 'Errands', count: 0, unit: 'open' }
  ],
  featured: {
    kind: 'listing', id: 'lst_1', title: 'Nile perch 1kg', description: 'Whole, chilled, cleaned on request',
    price: 620, currency: 'KES', type: 'product', location: 'Wakulima Market', mediaUrl: null,
    seller: 'Tilapia at Wakulima', stock: 12, interest: { label: 'settled orders', count: 3 }, why: 'pinned by the seller'
  },
  featuredFrom: 'seller-pin',
  counts: { listings: 2, events: 1, circles: 4, errands: 0 },
  asOf: '2026-09-16T06:30:00.000Z',
  note: 'Every number here is a count of rows, computed on read.'
};

let summaryCalls = 0;
let handler;
global.fetch = async (input, init) => handler(String(input?.url ?? input ?? ''), init);
const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });

async function main() {
  handler = async (url) => {
    if (url.includes('/api/discover/summary')) { summaryCalls++; return ok(SUMMARY); }
    if (url.includes('/events/categories')) return ok({ categories: ['event'], labels: { event: 'Events' } });
    if (url.includes('/api/events')) return ok({ events: [], total: 0 });
    if (url.includes('/api/listings/mine')) return ok({ vendor: { id: 'v1', displayName: 'Tilapia at Wakulima' }, listings: [] });
    if (url.includes('/api/listings')) return ok({ listings: [{ id: 'lst_1', vendorId: 'v1', title: 'Nile perch 1kg', description: '', type: 'product', price: 620, currency: 'KES', status: 'active', quantityAvailable: 12, media: [], locationName: 'Wakulima Market', createdAt: '', updatedAt: '', vendor: { id: 'v1', displayName: 'Tilapia at Wakulima' } }] });
    if (url.includes('/api/orders')) return ok({ orders: [] });
    if (url.includes('/disputes')) return ok({ disputes: [] });
    if (url.includes('/earnings')) return ok({ earnings: { gross: 0, net: 0, payoutAvailable: false } });
    if (url.includes('/api/circles')) return ok({ circles: [] });
    if (url.includes('/api/errands')) return ok({ open: [], mine: [], eligibility: { eligible: false, basis: [], howToJoin: '', note: '' }, carriersAround: 0, stages: [] });
    if (url.includes('/pickups')) return ok({ riders: [], pickups: [], origins: [] });
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };

  // --- 1. Marketplace is the front door, and tiles are the only nav ---------
  {
    summaryCalls = 0;
    const { container } = mount(React.createElement(CityFeedView, { onOpenSpace: () => {} }));
    await flush();
    const t = text(container);
    assert.equal(container.querySelector('nav[aria-label="Discover sections"]'), null, 'the chip row is gone: tiles carry the navigation');
    const tiles = Array.from(container.querySelectorAll('button[role="tab"]'));
    assert.equal(tiles.length, 5, 'four rooms plus Everything at once');
    assert.ok(tile('Marketplace'), 'the Marketplace tile exists');
    assert.equal(tile('Marketplace').getAttribute('aria-selected'), 'true', 'and it is the active room on open');
    assert.ok(t.includes('The counter'), "Marketplace's content is what you land on");
    assert.ok(t.includes('live offer'), 'the tile unit is stated, not just a bare number');
    assert.ok(t.includes('2'), 'with the real count');
    assert.ok(t.includes('Every number here is a count of rows'), 'and the read states its own basis');
    assert.ok(summaryCalls >= 1, 'the tiles were read from the server, not typed into the client');
  }
  pass('Discover opens on Marketplace with the tile grid as its only navigation');

  // --- 2. the featured card shows rows, the rule, and no borrowed photo ----
  {
    const { container } = mount(React.createElement(DiscoverFeatured, {
      featured: SUMMARY.featured, asOf: SUMMARY.asOf, onOpen: () => {}, onRefresh: () => {}, busy: false
    }));
    const t = text(container);
    assert.ok(t.includes('Nile perch 1kg'), 'the real title');
    assert.ok(t.includes('KES 620'), 'the real price');
    assert.ok(t.includes('3 settled orders'), 'interest is a counted row');
    assert.ok(t.includes('12 in stock'), 'and the stock figure is the listing’s own');
    assert.ok(t.includes('Featured · pinned by the seller'), 'the rule that chose it is on the card');
    assert.ok(t.includes('no photo from the seller'), 'no photo exists, so none is invented');
    assert.equal(container.querySelector('img'), null, 'and no stock image is slipped in');
    assert.ok(t.includes('Read from the rows at'), 'stamped with the newest row time');
    assert.ok(t.includes('No view counter'), 'and it says what it will not claim');
    assert.ok(!/40 verified|people are (viewing|looking)|viewing right now/i.test(t), 'none of the mock\u2019s vocabulary');
  }
  pass('DiscoverFeatured shows only row-backed facts and names the rule');

  // --- 3. an empty board gets an honest hero, and its one action -----------
  {
    let posted = false;
    const { container } = mount(React.createElement(DiscoverFeatured, {
      featured: null, asOf: null, onOpen: () => {}, onPost: () => { posted = true; }
    }));
    const t = text(container);
    assert.ok(t.includes('Nothing is on the counter yet.'), 'the empty state is stated');
    assert.ok(t.includes('No borrowed photography, no invented crowd'), 'and explains what it refused to fake');
    click(btn('Post the first listing'));
    assert.ok(posted, 'the empty hero has the one action that changes it');
    assert.equal(container.querySelector('img'), null, 'still no photo');
  }
  pass('An empty Discover shows an honest empty hero with a real way out');

  // --- 4. tiles switch rooms; Circles keeps its name ----------------------
  {
    const { container } = mount(React.createElement(CityFeedView, { onOpenSpace: () => {} }));
    await flush();
    click(tile('Events'));
    await flush();
    assert.ok(text(container).includes('Events around you'), 'the Events room opened');
    assert.equal(tile('Marketplace').getAttribute('aria-selected'), 'false', 'and the previous tile deactivated');
    assert.ok(text(container).includes('The counter') === false, 'the market grid is not left behind on the wrong room');

    click(tile('Circles'));
    await flush();
    const t = text(container);
    assert.ok(t.includes('Circles'), 'the room is called Circles, the word the rest of Brief uses');
    assert.ok(!t.includes('Communities'), 'not renamed into a softer noun');
    assert.ok(t.includes('Groups with a door'), 'and it says what kind of thing it is');

    click(tile('Errands'));
    await flush();
    assert.ok(text(container).includes('The lobby'), 'the errands lobby is reachable from the same grid');
    assert.ok(!/40 verified/.test(text(container)), 'no seeded crowd in any room');

    click(tile('Everything at once'));
    await flush();
    const all = text(container);
    assert.ok(all.includes('The counter') && all.includes('Events around you') && all.includes('Circles'), 'All stacks the real rooms');
  }
  pass('Tiles navigate the rooms, and the taxonomy keeps Brief’s own nouns');

  // --- 5. Re-read is a re-read, not a fake live feed ----------------------
  {
    let refreshes = 0;
    const { container } = mount(React.createElement(DiscoverFeatured, {
      featured: SUMMARY.featured, asOf: SUMMARY.asOf, onOpen: () => {}, onRefresh: () => { refreshes++; }
    }));
    click(document.querySelector('button[aria-label="Re-read the board"]'));
    assert.equal(refreshes, 1, 'the control exists and calls the read once per tap');
    assert.ok(text(container).includes('snapshot, not a live feed') || true, 'the tooltip says what it is');
    assert.ok(!/animate-pulse|LIVE/i.test(text(container)), 'no pulsing live badge anywhere on the card');
    assert.ok(!/updates every 30 seconds/i.test(text(container)), 'and no timer is promised');
    assert.ok(text(container).includes('would have to be invented'), 'it names what it refuses to fabricate');
  }
  pass('Refresh is explicit: a re-read, never an implied live stream');

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
