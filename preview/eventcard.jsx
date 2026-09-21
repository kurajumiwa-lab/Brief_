// ---------------------------------------------------------------------------
// EVENT CARD SUITE — a real cover, else a lit plate in the room's own
// plaster carrying the category's hue. Never a black box, never a stock photo,
// never a cold gradient swatch that looks like a different app's card.
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
const { CATEGORY_PALETTE } = require('./src/features/city/categoryPalette.ts');

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
  // No `featured`, no `popularity`, no `tableBankingOverlap`: the server's
  // listing projection stopped carrying them (Decision 6), so a fixture that
  // still had them would test against a contract that no longer exists.
  endsAt: null, price: 500, currency: 'KES', goalAmount: null
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
    // The style ATTRIBUTE, not div.style.background: the cover treatment is now
    // a multi-layer background (two radial lights over a plaster linear), and
    // jsdom's CSS parser drops anything that complicated. A real browser paints
    // all of it; the attribute is the honest thing to assert on.
    const plateOf = (c) => {
      const els = Array.from(c.querySelectorAll('div, span'));
      const plaster = els.find((d) => (d.getAttribute('style') || '').includes('#EDF1F6'));
      const glow = els.find((d) => /radial-gradient/.test(d.getAttribute('style') || ''));
      return { plaster: plaster ? plaster.getAttribute('style') : '', glow: glow ? glow.getAttribute('style') : '', el: plaster };
    };
    const tint = plateOf(container);
    assert.ok(tint.el, 'fallback is a lit plate, not a void and not a black box');
    const plate = tint.plaster;
    assert.ok(plate.includes('#FBFCFE') && plate.includes('#EDF1F6'), 'the plate is the room\'s own warm plaster');
    assert.ok(tint.glow.includes('#0E7C86'), 'the wing\'s colour is on it — as a light, since session is that wing');
    assert.ok(!/4F46E5,\s*#22D3EE|#22D3EE\)/.test(plate), 'never the cold blue-violet swatch that made cards look pasted in');
    // ...and the tint means something: a different category is a different light.
    const { container: other_ } = mount(
      React.createElement(EventCard, { event: { ...base, category: 'popup' }, onOpen: () => {} })
    );
    const other = plateOf(other_);
    assert.notEqual(tint.glow, other.glow, 'category drives the palette');
    assert.ok(other.glow.includes('#7C3AED'), 'popup brings its own hue');
    // A category may never borrow the action colour — the flip to a blue accent
    // would otherwise make every primary button read as a wing label.
    const accents = new Set(Object.values(CATEGORY_PALETTE).map((c) => c.accent));
    assert.ok(!accents.has('#2563EB'), 'no category accent is the app accent');
    assert.equal(accents.size, 5, 'five wings, five hues');
  }
  pass('EventCard tints by category and never falls back to a monogram or a black box');

  // --- meta + social proof ---
  {
    const { container } = mount(React.createElement(EventCard, { event: base, onOpen: () => {} }));
    const t = text(container);
    assert.ok(t.includes('Kilimani Wellness Day'), 'title');
    assert.ok(t.includes('Sessions & classes'), 'category chip');
    assert.ok(t.includes('KES 500'), 'price');
    // Decision 6: no "X going", no attendee names, no view count.
    assert.ok(!/going/i.test(t), 'the card prints no "going" count of any kind');
    assert.ok(!/featured/i.test(t), 'and no featured badge');
  }
  pass('EventCard shows title, category and price — and no social proof');

  // --- REFUSAL: the fields are gone from the contract, so hand the card a
  // --- fixture that still carries them and assert it renders none of it. This
  // --- is the test that fails if the badge or the crowd count comes back.
  {
    const { container } = mount(React.createElement(EventCard, {
      event: {
        ...base,
        featured: true,
        popularity: 34,
        tableBankingOverlap: [{ tableBankingId: 'c1', tableBankingName: 'Kilimani Circle', memberCount: 8 }]
      },
      onOpen: () => {}
    }));
    const t = text(container);
    assert.ok(!t.includes('34 going'), 'a popularity count in the data is not rendered (D6)');
    assert.ok(!t.includes('8 from Kilimani Circle'), 'a circle overlap in the data is not rendered (D6)');
    assert.ok(!/featured/i.test(t), 'a featured flag in the data is not rendered (D6)');
    assert.ok(t.includes('Kilimani Wellness Day'), 'the card still renders the event itself');
  }
  pass('EventCard refuses featured/popularity/overlap even when a caller supplies them');

  console.log('\nPASS ' + count);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
