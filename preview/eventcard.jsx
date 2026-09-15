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
  endsAt: null, price: 500, currency: 'KES', goalAmount: null, featured: true, popularity: 34,
  tableBankingOverlap: null
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

  // --- no cover -> the CATEGORY's tint, and no monogram letter anywhere ---
  {
    const { container } = mount(React.createElement(EventCard, { event: base, onOpen: () => {} }));
    assert.equal(container.querySelector('img'), null, 'no img when no cover');
    // The monogram is gone on purpose: "K" for "Kilimani Wellness Day" mapped to
    // nothing the reader knows, so it read as a placeholder rather than a design.
    const loneLetter = Array.from(container.querySelectorAll('span')).find((d) => /^[A-Z]$/.test(d.textContent.trim()));
    assert.equal(loneLetter, undefined, 'no oversized title initial is rendered');
    const tint = Array.from(container.querySelectorAll('div')).find((d) => (d.style.background || '').includes('gradient'));
    assert.ok(tint, 'fallback is a gradient, not a void');
    // ...and the tint means something: a different category is a different colour.
    const { container: other } = mount(
      React.createElement(EventCard, { event: { ...base, category: 'popup' }, onOpen: () => {} })
    );
    const otherTint = Array.from(other.querySelectorAll('div')).find((d) => (d.style.background || '').includes('gradient'));
    assert.notEqual(tint.style.background, otherTint.style.background, 'category drives the palette');
  }
  pass('EventCard tints by category and never falls back to a monogram or a black box');

  // --- meta + social proof ---
  {
    const { container } = mount(React.createElement(EventCard, { event: base, onOpen: () => {} }));
    const t = text(container);
    assert.ok(t.includes('Kilimani Wellness Day'), 'title');
    assert.ok(t.includes('Sessions & classes'), 'category chip');
    assert.ok(t.includes('34 going'), 'counted popularity');
    assert.ok(t.includes('KES 500'), 'price');
    assert.ok(!t.includes('from your Circle'), 'no group overlap when null');
  }
  pass('EventCard shows title, category, price and counted popularity');

  // --- group overlap social proof ---
  {
    const { container } = mount(React.createElement(EventCard, {
      event: { ...base, tableBankingOverlap: [{ tableBankingId: 'c1', tableBankingName: 'Kilimani Circle', memberCount: 8 }] },
      onOpen: () => {}
    }));
    const t = text(container);
    assert.ok(t.includes('8 from Kilimani Circle'), 'group overlap line');
    assert.ok(t.includes('going'), 'overlap ends with going');
  }
  pass('EventCard surfaces the derived group overlap ("8 from Kilimani Circle")');

  console.log('\nPASS ' + count);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
