// ---------------------------------------------------------------------------
// MUSEUM GALLERY — swiping inventory over REAL events. Pins the museum rules
// after the home-feed reformation:
//   * one card at a time (snap) with position dots, and the ACTIVE card is the
//     only one carrying an action;
//   * no result counter anywhere — "2 shown" was metadata nobody asked for;
//   * the control line is ONE row, and the deep filters live in a bottom sheet
//     whose selections drive the REAL /api/events query;
//   * "New" is only ever a real diff against what this device already saw, and
//     "you opened this" is only ever this device's own record — nothing about
//     other people is claimed;
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
// jsdom has no navigation: the handler's job here is the local record it writes.
dom.window.open = () => ({ closed: false, focus() {}, close() {} });

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
const btnByText = (want) =>
  Array.from(document.querySelectorAll('button')).find((b) => text(b) === want || text(b).startsWith(want));

let fetchHandler;
global.fetch = async (input, init) => fetchHandler(String(input?.url ?? input ?? ''), init);

const ev = (slug, title, popularity, overlap, extra = {}) => ({
  slug, title, description: null, coverImageUrl: null,
  category: 'event', categoryLabel: 'Events',
  location: 'Kilimani', startsAt: '2026-09-20T06:00:00Z', endsAt: null,
  price: 0, currency: 'KES', goalAmount: null, featured: false,
  publishedAt: '2026-09-01T06:00:00Z',
  popularity, tableBankingOverlap: overlap, ...extra
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

  // --- 1. Real exhibits, dots, one action, and NO result counter -----------
  localStorage.clear();
  fetchHandler = serve([
    ev('night-market', 'Kilimani Night Market', 12, [{ tableBankingId: 'tb1', tableBankingName: 'Kejani', memberCount: 1 }]),
    ev('cake-drop', 'Birthday Cake Drop', 0, null)
  ]);
  {
    const c = mount(React.createElement(MuseumGallery, null));
    await flush();
    const t = text(c);
    assert.ok(t.includes('Kilimani Night Market'), 'first exhibit renders');
    assert.ok(t.includes('Birthday Cake Drop'), 'second exhibit renders');
    assert.ok(t.includes('12 going'), 'counted popularity rendered');
    assert.ok(t.includes('1 from Kejani going'), 'real group overlap rendered');

    // The counter is gone by design ("if you can see them, you can count them").
    assert.ok(!/shown/i.test(t), 'no "N shown" metadata');
    assert.ok(!t.includes('Swipe to browse'), 'no numeric browse hint');

    // Dots: one per exhibit.
    const dots = Array.from(c.querySelectorAll('div')).filter((d) => (d.getAttribute('class') || '').includes('h-1.5 rounded-full'));
    assert.equal(dots.length, 2, 'one dot per exhibit');

    // Rule: only the active card carries an action.
    assert.equal(Array.from(c.querySelectorAll('article button')).length, 1, 'only the active card has an action');

    // Monogram killed: no oversized letter box on a cover-less exhibit.
    assert.equal(
      Array.from(c.querySelectorAll('article span')).find((s) => /^[A-Z]$/.test(text(s))),
      undefined,
      'no title-initial monogram is rendered'
    );

    // One control line, not a six-chip row plus a four-row panel.
    const chips = Array.from(c.querySelectorAll('button')).filter((b) => (b.getAttribute('class') || '').includes('rounded-full'));
    assert.ok(chips.length <= 3, `the control line is compact (got ${chips.length} pills)`);
    assert.ok(t.includes('All exhibits'), 'the control line names the current wing');
  }
  pass('MuseumGallery: real exhibits, dots, one action, no counter, no monogram, one control line');

  // --- 2. The bottom sheet drives the REAL query ---------------------------
  {
    const c = mount(React.createElement(MuseumGallery, null));
    await flush();
    act(() => { btnByText('All exhibits').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    assert.ok(text(document.body).includes('Filter the case'), 'the sheet opens from the control line');
    assert.ok(text(document.body).includes('★ Featured only'), 'the sheet holds the deep filters');

    // Pick a wing + a place + featured, then apply.
    act(() => { btnByText('Events').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    act(() => { btnByText('★ Featured only').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    const input = document.querySelector('input[aria-label], #museum-loc');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'Kisii');
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    act(() => { btnByText('Show').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    const q = new URLSearchParams(lastQuery.replace(/&amp;/g, '&'));
    assert.equal(q.get('category'), 'event', 'the sheet applies the real category filter');
    assert.equal(q.get('featured'), '1', 'the sheet applies the real featured filter');
    assert.equal(q.get('location'), 'Kisii', 'the sheet applies the real place filter');

    // The applied state is now named on the control line, with a way out.
    const t = text(c);
    assert.ok(t.includes('Events'), 'the control line names the applied wing');
    assert.ok(t.includes('near Kisii'), 'the control line names the applied place');
    assert.ok(btnByText('Clear'), 'a clear control exists once a filter is active');
    act(() => { btnByText('Clear').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    assert.ok(!(new URLSearchParams(lastQuery).get('category')), 'Clear drops the filter for real');
  }
  pass('MuseumGallery: one control line + bottom sheet that drives the real query');

  // --- 3. "New" is a real diff, and opening writes a local record ----------
  {
    // This device has already seen 'night-market'...
    localStorage.setItem('brief.eventSeen.v1', JSON.stringify({ at: new Date().toISOString(), slugs: ['night-market'] }));
    localStorage.removeItem('brief.eventOpens.v1');
    fetchHandler = serve([
      ev('night-market', 'Kilimani Night Market', 12, null),
      ev('cake-drop', 'Birthday Cake Drop', 0, null)
    ]);
    const c = mount(React.createElement(MuseumGallery, null));
    await flush();
    const cards = Array.from(c.querySelectorAll('article'));
    assert.equal(cards.length, 2, 'both exhibits rendered');
    assert.ok(text(cards[1]).includes('New'), 'the row this device had not seen is marked New');
    assert.ok(!text(cards[0]).includes('New'), 'a row already seen is not marked New');
    assert.ok(!text(c).includes('opened'), 'no viewing history is claimed before this device opened anything');

    // Opening the active card records a real local fact.
    const action = Array.from(cards[0].querySelectorAll('button')).find((b) => text(b).includes('View event'));
    act(() => { action.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    const opens = JSON.parse(localStorage.getItem('brief.eventOpens.v1') || '{}');
    assert.ok(opens['night-market'], 'opening an exhibit writes this device\'s own record');
  }
  pass('MuseumGallery: "New" is a real diff and "opened" is a real local record');

  // --- 4. Empty case is honest --------------------------------------------
  fetchHandler = serve([]);
  {
    const c = mount(React.createElement(MuseumGallery, null));
    await flush();
    const t = text(c);
    assert.ok(t.includes('Nothing is published yet'), 'empty case says so plainly');
    assert.ok(!t.includes('New'), 'no fabricated marks on an empty case');
  }
  pass('MuseumGallery renders an honest empty state (no fabricated exhibits)');

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
