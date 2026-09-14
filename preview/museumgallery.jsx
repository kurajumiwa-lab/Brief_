// ---------------------------------------------------------------------------
// MUSEUM GALLERY — swiping inventory over REAL events. Pins the museum rules:
// one card at a time (snap), position dots for the finite count, the active
// card is the only one with an action, and an empty case says so honestly.
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

// A real-shaped event, per EventListing.
const ev = (slug, title, popularity, overlap) => ({
  slug, title, description: null, coverImageUrl: null,
  category: 'event', categoryLabel: 'Events',
  location: 'Kilimani', startsAt: '2026-09-20T06:00:00Z', endsAt: null,
  price: 0, currency: 'KES', goalAmount: null, featured: false,
  popularity, tableBankingOverlap: overlap
});

async function main() {
  let lastCategory = null;

  // --- With two real events ---
  fetchHandler = async (url) => {
    if (url.includes('/events/categories')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ categories: ['event'], labels: { event: 'Events' } }) };
    }
    if (url.includes('/api/events')) {
      lastCategory = (url.match(/category=([^&]*)/) || [])[1] ?? null;
      return { ok: true, status: 200, text: async () => JSON.stringify({
        events: [
          ev('night-market', 'Kilimani Night Market', 12, [{ tableBankingId: 'tb1', tableBankingName: 'Kejani', memberCount: 1 }]),
          ev('cake-drop', 'Birthday Cake Drop', 0, null)
        ],
        total: 2
      }) };
    }
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const c = mount(React.createElement(MuseumGallery, null));
    await flush();
    const t = text(c);

    // Both events render as exhibits.
    assert.ok(t.includes('Kilimani Night Market'), 'first exhibit renders');
    assert.ok(t.includes('Birthday Cake Drop'), 'second exhibit renders');

    // Finite count + dots (museum = inventory, not infinite feed).
    assert.ok(t.includes('Swipe to browse 2 nearby'), 'finite count hint renders');
    const dots = Array.from(c.querySelectorAll('div')).filter((d) => (d.getAttribute('class') || '').includes('h-1.5 rounded-full'));
    assert.equal(dots.length, 2, 'one dot per exhibit');

    // Rule #8: only the active card has an action button.
    const actionButtons = Array.from(c.querySelectorAll('article button'));
    assert.equal(actionButtons.length, 1, 'only the active card carries an action');

    // Real counted "going" and real group overlap — no seeded social proof.
    assert.ok(t.includes('12 going'), 'counted popularity rendered');
    assert.ok(t.includes('1 from Kejani going'), 'real group overlap rendered');
    assert.ok(!t.includes('from your Circle going'), 'no fabricated overlap');

    // The wing filter is the server's own category, not invented.
    assert.ok(t.includes('Events'), 'category wing filter renders');
  }
  pass('MuseumGallery renders real events as exhibits with dots + one action');

  // --- Category filter drives the query ---
  {
    mount(React.createElement(MuseumGallery, null));
    await flush();
    const chip = Array.from(document.querySelectorAll('button')).find((b) => text(b) === 'Events');
    act(() => { chip.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    assert.equal(lastCategory, 'event', 'selecting the wing posts the category filter');
  }
  pass('MuseumGallery wing filter drives the real category query');

  // --- Empty case is honest ---
  fetchHandler = async (url) => {
    if (url.includes('/events/categories')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ categories: [], labels: {} }) };
    }
    if (url.includes('/api/events')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ events: [], total: 0 }) };
    }
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const c = mount(React.createElement(MuseumGallery, null));
    await flush();
    const t = text(c);
    assert.ok(t.includes('Nothing published yet'), 'empty case says so plainly');
    assert.ok(!t.includes('Swipe to browse'), 'no dots/hint when the case is empty');
  }
  pass('MuseumGallery renders an honest empty state (no fabricated exhibits)');

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
