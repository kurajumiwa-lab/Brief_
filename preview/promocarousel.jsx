// ---------------------------------------------------------------------------
// PROMO CAROUSEL — the space screen's header feeder, replaced with an
// auto-advancing slider of REAL published events. No fabricated promos.
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
const { PromoCarousel } = require('./src/features/spaces/PromoCarousel.tsx');

let count = 0;
const pass = (name) => { count++; console.log('PASS ' + name); };
const flush = (ms = 40) => new Promise((r) => setTimeout(r, ms));

function mount(el) {
  document.body.innerHTML = '';
  const c = document.createElement('div');
  document.body.appendChild(c);
  const root = createRoot(c);
  act(() => root.render(el));
  return { container: c, root };
}
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

let fetchHandler;
global.fetch = async (input, init) => fetchHandler(String(input?.url ?? input ?? ''), init);

const event = (over = {}) => ({
  slug: 'night-market', title: 'Kilimani Night Market', description: 'An evening market', coverImageUrl: 'https://x/cover.jpg',
  category: 'popup', categoryLabel: 'Popups & markets', location: 'Kilimani', startsAt: '2026-09-20T12:00:00Z', endsAt: null,
  price: 500, currency: 'KES', goalAmount: null, featured: true, popularity: 34, tableBankingOverlap: null,
  ...over
});

async function main() {
  // --- renders a real event with its cover image + meta ---
  fetchHandler = async (url) => {
    if (url.includes('/api/events')) return { ok: true, status: 200, text: async () => JSON.stringify({ events: [event()], total: 1 }) };
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(PromoCarousel, null));
    await flush();
    const t = text(container);
    assert.ok(t.includes('Kilimani Night Market'), 'event title');
    assert.ok(t.includes('Popups & markets'), 'category label');
    assert.ok(t.includes('KES 500'), 'price');
    assert.ok(container.querySelector('img'), 'cover image renders');
    assert.equal(container.querySelector('img').src, 'https://x/cover.jpg');
    assert.ok(!t.includes('Alchemist') && !t.includes('Zawadi'), 'no mock content');
  }
  pass('PromoCarousel renders a real event with cover, category, price — no mock');

  // --- a cover-less event gets a gradient + initial, never a black box ---
  fetchHandler = async (url) => {
    if (url.includes('/api/events')) return { ok: true, status: 200, text: async () => JSON.stringify({ events: [event({ coverImageUrl: null })] , total: 1 }) };
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(PromoCarousel, null));
    await flush();
    assert.equal(container.querySelector('img'), null, 'no img when no cover');
    const fallback = Array.from(container.querySelectorAll('div')).find((d) => d.textContent.trim() === 'K');
    assert.ok(fallback, 'gradient fallback shows the title initial');
    assert.ok((fallback.style.background || '').includes('gradient'), 'fallback is a gradient');
  }
  pass('PromoCarousel derives a gradient fallback for a cover-less event');

  // --- no events -> renders nothing (never a fabricated promo) ---
  fetchHandler = async (url) => {
    if (url.includes('/api/events')) return { ok: true, status: 200, text: async () => JSON.stringify({ events: [], total: 0 }) };
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(PromoCarousel, null));
    await flush();
    assert.equal(container.textContent.trim(), '', 'renders nothing when there are no events');
  }
  pass('PromoCarousel renders nothing when there are no published events');

  // --- vertical variant: a compact ticker, one event at a time, no cover image ---
  fetchHandler = async (url) => {
    if (url.includes('/api/events')) return { ok: true, status: 200, text: async () => JSON.stringify({ events: [event()], total: 1 }) };
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(PromoCarousel, { variant: 'vertical' }));
    await flush();
    const t = text(container);
    assert.ok(t.includes('Kilimani Night Market'), 'vertical ticker shows the title');
    assert.ok(t.includes('KES 500'), 'vertical ticker shows the price');
    assert.equal(container.querySelector('img'), null, 'vertical ticker has no cover image');
    assert.ok(container.querySelector('a'), 'vertical ticker is tappable');
  }
  pass('PromoCarousel vertical variant is a compact, honest ticker');

  // --- multiple events render dots ---
  fetchHandler = async (url) => {
    if (url.includes('/api/events')) return { ok: true, status: 200, text: async () => JSON.stringify({ events: [event(), event({ slug: 'e2', title: 'Second Event' })] , total: 2 }) };
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(PromoCarousel, null));
    await flush();
    const dots = Array.from(container.querySelectorAll('button[aria-label^="Go to slide"]'));
    assert.equal(dots.length, 2, 'a dot per event');
  }
  pass('PromoCarousel shows a dot per event');

  console.log('\nPASS ' + count);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
