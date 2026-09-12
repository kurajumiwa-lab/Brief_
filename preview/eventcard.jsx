// ---------------------------------------------------------------------------
// EVENT CARD SUITE — cover image with gradient fallback, never a black box.
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
const { EventCard } = require('./src/components/events/EventCard.tsx');

let count = 0;
const pass = (name) => { count++; console.log('PASS ' + name); };
function mount(el) {
  document.body.innerHTML = '';
  const c = document.createElement('div');
  document.body.appendChild(c);
  const root = createRoot(c);
  act(() => root.render(el));
  return { container: c, root };
}
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

const base = {
  slug: 's1', title: 'Kilimani Wellness Day', description: 'A day of calm', coverImageUrl: null,
  category: 'session', categoryLabel: 'Sessions & classes', location: 'Kilimani', startsAt: '2026-09-14T12:00:00Z',
  endsAt: null, price: 500, currency: 'KES', goalAmount: null, featured: true, popularity: 34
};

async function main() {
  // --- real cover image renders an <img> ---
  {
    const { container } = mount(React.createElement(EventCard, { event: { ...base, coverImageUrl: 'https://x/cover.jpg' }, onOpen: () => {} }));
    assert.ok(container.querySelector('img'), 'renders an img when a cover exists');
    assert.equal(container.querySelector('img').src, 'https://x/cover.jpg');
    assert.equal(container.querySelector('img').getAttribute('loading'), 'lazy');
  }
  pass('EventCard renders a lazy-loaded cover image when present');

  // --- no cover -> gradient fallback with the title initial, never black ---
  {
    const { container } = mount(React.createElement(EventCard, { event: base, onOpen: () => {} }));
    assert.equal(container.querySelector('img'), null, 'no img when no cover');
    const fallback = Array.from(container.querySelectorAll('div')).find((d) => d.textContent.trim() === 'K');
    assert.ok(fallback, 'gradient fallback shows the title initial');
    assert.ok(fallback.style.background.includes('gradient'), 'fallback is a gradient, not a void');
  }
  pass('EventCard derives a deterministic gradient fallback (never a black box)');

  // --- meta + social proof ---
  {
    const { container } = mount(React.createElement(EventCard, { event: base, onOpen: () => {} }));
    const t = text(container);
    assert.ok(t.includes('Kilimani Wellness Day'), 'title');
    assert.ok(t.includes('Sessions & classes'), 'category chip');
    assert.ok(t.includes('34 going'), 'counted popularity');
    assert.ok(t.includes('KES 500'), 'price');
  }
  pass('EventCard shows title, category, price and counted popularity');

  console.log('\nPASS ' + count);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
