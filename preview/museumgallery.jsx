// ---------------------------------------------------------------------------
// MUSEUM GALLERY — the events, as a two-column grid of the ONE card shape.
// Pins the museum rules after the card-pattern refactor:
//   * every exhibit is the SAME GlobysCard as the board, Home and Mine:
//     1:1 cover or waiting plate, title, the real price, the where/when in
//     mono, and exactly ONE action ("View event →") on EVERY card — the old
//     swipe case gave a button only to "the active card", which was two
//     shapes pretending to be one;
//   * no corner badges. "New" was a chip in the corner computed from this
//     device's own memory of last visit — decoration, not a fact — so it is
//     gone, and a row this device had never seen is NOT marked any different;
//   * no position dots (the swipe case is gone), no result counter
//     ("if you can see them, you can count them");
//   * NO control line at all. The "All exhibits" chip (then "All events") and
//     its filter sheet were the third navigation for events the board and Home
//     already point at, so the reorg deleted the whole row: the case is
//     everything published, soonest first, and a reader who wants a narrower
//     view goes to the board, where the filters sit beside what they filter;
//   * an empty case says so plainly.
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
// jsdom has no navigation: the stub records where the action tried to go.
let openedUrl = null;
dom.window.open = (u) => { openedUrl = u; return { closed: false, focus() {}, close() {} }; };

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const { MuseumGallery } = require('./src/features/city/MuseumGallery.tsx');

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

let fetchHandler;
global.fetch = async (input, init) => fetchHandler(String(input?.url ?? input ?? ''), init);

const ev = (slug, title, extra = {}) => ({
  slug, title, description: null, coverImageUrl: null,
  category: 'event', categoryLabel: 'Events',
  location: 'Kilimani', startsAt: '2026-09-20T06:00:00Z', endsAt: null,
  price: 0, currency: 'KES', goalAmount: null,
  publishedAt: '2026-09-01T06:00:00Z',
  ...extra
});

const CATEGORIES_BODY = { categories: ['event'], labels: { event: 'Events' } };

async function main() {
  let lastQuery = '';
  const serve = (events, total = events.length) => async (url) => {
    if (url.includes('/events/categories')) {
      return { ok: true, status: 200, text: async () => JSON.stringify(CATEGORIES_BODY) };
    }
    if (url.includes('/api/events')) {
      lastQuery = url.split('?')[1] ?? '';
      return {
        ok: true, status: 200,
        text: async () => JSON.stringify({ events, total })
      };
    }
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };

  // --- 1. Real exhibits as the one card shape: two columns, one action each
  localStorage.clear();
  fetchHandler = serve([
    ev('night-market', 'Kilimani Night Market', { price: 300 }),
    ev('cake-drop', 'Birthday Cake Drop')
  ]);
  {
    const c = mount(React.createElement(MuseumGallery, null));
    await flush();
    const t = text(c);
    assert.ok(t.includes('Kilimani Night Market'), 'first exhibit renders');
    assert.ok(t.includes('Birthday Cake Drop'), 'second exhibit renders');

    // Every card is a GlobysCard, in a two-column grid.
    const grid = c.querySelector('.grid-cols-2');
    assert.ok(grid, 'the case is a two-column grid');
    const cards = Array.from(grid.querySelectorAll('article[data-testid^=globys-card-]'));
    assert.equal(cards.length, 2, 'both exhibits render as product cards');

    // Each card: title, the real price (300 KES / Free), the mono where/when,
    // and EXACTLY ONE action button.
    for (const card of cards) {
      const actions = Array.from(card.querySelectorAll('[data-testid^=card-action]'));
      assert.equal(actions.length, 1, 'every card has exactly one action');
      assert.ok(actions[0].textContent.includes('View event'), 'the action is "View event"');
      assert.ok(Array.from(card.querySelectorAll('p')).some((p) => p.classList.contains('font-mono')), 'the card carries the mono where/when line');
    }
    assert.ok(text(cards[0]).includes('KES 300'), 'the priced card shows its real price');
    assert.ok(text(cards[1]).includes('Free'), 'the free card says Free, not a guessed zero');

    // Decision 6: no "X going", no attendee names, no view count, no crowd.
    assert.ok(!/going/i.test(t), 'no "going" count is rendered');
    // The counter is gone by design ("if you can see them, you can count them").
    assert.ok(!/shown/i.test(t), 'no "N shown" metadata');

    // The swipe case is gone: no position dots, no active-only scaling.
    const dots = Array.from(c.querySelectorAll('div')).filter((d) => (d.getAttribute('class') || '').includes('h-1.5 rounded-full'));
    assert.equal(dots.length, 0, 'no position dots — the swipe case is gone');

    // The control line is GONE: no "All exhibits"/"All events" chip, no filter
    // sheet trigger. The case is everything published, soonest first.
    assert.ok(!/All (exhibits|events)/i.test(t), 'no "All events" filter chip');
    const filterTriggers = Array.from(c.querySelectorAll('button')).filter((b) => /filter/i.test(b.getAttribute('aria-label') || ''));
    assert.equal(filterTriggers.length, 0, 'no filter sheet trigger on the case');
  }
  pass('MuseumGallery: real exhibits as the one card shape, one action each, no dots, no counter, no control line');

  // --- 2. The case is everything published — no filter parameters ----------
  {
    const c = mount(React.createElement(MuseumGallery, null));
    await flush();
    const q = new URLSearchParams(lastQuery.replace(/&amp;/g, '&'));
    assert.equal(q.get('category'), null, 'the case does not send a category filter');
    assert.equal(q.get('location'), null, 'and no place filter — the whole case is the shelf');
    assert.equal(q.get('sort'), null, 'and no sort parameter — the order is the server\'s one order, startsAt ascending (D6)');
    assert.equal(q.get('featured'), null, 'no featured parameter reaches the server (D6)');
    assert.ok(text(c).includes('Kilimani Night Market'), 'published events still render in the case');
  }
  pass('MuseumGallery: the case is everything published; narrower views live on the board');

  // --- 3. No corner badges: a never-seen row is not marked any different ----
  {
    // This device has already seen 'night-market' — the old case would have
    // stamped "New" on the other card. The corner badge is gone, so neither
    // card differs.
    localStorage.setItem('brief.eventSeen.v1', JSON.stringify({ at: new Date().toISOString(), slugs: ['night-market'] }));
    fetchHandler = serve([
      ev('night-market', 'Kilimani Night Market'),
      ev('cake-drop', 'Birthday Cake Drop')
    ]);
    const c = mount(React.createElement(MuseumGallery, null));
    await flush();
    const cards = Array.from(c.querySelectorAll('article'));
    assert.equal(cards.length, 2, 'both exhibits rendered');
    assert.ok(!Array.from(c.querySelectorAll('article')).some((card) => /new/i.test(text(card))),
      'no "New" corner badge on any card, seen or unseen');

    // The one action still does its real job: open the event page.
    openedUrl = null;
    const action = cards[0].querySelector('[data-testid^=card-action]');
    act(() => { action.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    assert.ok(openedUrl && openedUrl.includes('/c/night-market'), 'the action opens the exhibit\'s page');
  }
  pass('MuseumGallery: no "New" corner badge; the one action opens the exhibit');

  // --- 4. Empty case is honest --------------------------------------------
  fetchHandler = serve([]);
  {
    const c = mount(React.createElement(MuseumGallery, null));
    await flush();
    const t = text(c);
    assert.ok(t.includes('Nothing is published yet'), 'empty case says so plainly');
    assert.ok(!/new/i.test(t), 'no fabricated marks on an empty case');
  }
  pass('MuseumGallery renders an honest empty state (no fabricated exhibits)');

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
