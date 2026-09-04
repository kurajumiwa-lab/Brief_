// MODERN DARK SHELF UI SUITE
// Tests the physical slate-dark bookshelf aesthetic, tokens, ShelfPlank dimensions,
// contact drop shadows, and seated card behaviors.

const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement; global.Element = dom.window.Element; global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent; global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');

let passCount = 0;
let failCount = 0;

function check(label, ok, detail) {
  if (ok) {
    passCount++;
    console.log(`  ✓ ${label}`);
  } else {
    failCount++;
    console.log(`  ✗ FAIL: ${label}${detail ? ` (${detail})` : ''}`);
  }
}

async function runTests() {
  const mount = async (element) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(element); });
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    return {
      host,
      text: () => (host.textContent || '').replace(/\s+/g, ' ').trim(),
      buttons: () => Array.from(host.querySelectorAll('button')),
      click: async (el) => {
        await act(async () => {
          el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
        });
      },
      unmount: async () => { await act(async () => { root.unmount(); }); host.remove(); }
    };
  };

  const {
    ShelfPlank,
    ModernDarkShelfWrapper,
    ShelfRow,
    DarkShelfBookCard,
    DARK_SHELF_TOKENS
  } = require('./src/components/shelf');

  console.log('\n=== 1. DARK SHELF DESIGN TOKENS ===');
  check('canvas base token is #0F1013', DARK_SHELF_TOKENS.canvasBase === '#0F1013');
  check('ambient top gradient token is #1A1B21', DARK_SHELF_TOKENS.ambientTop === '#1A1B21');
  check('shelf top lip highlight is #3A3C44', DARK_SHELF_TOKENS.shelfTopLip === '#3A3C44');
  check('shelf deck surface is #23252C', DARK_SHELF_TOKENS.shelfDeckSurface === '#23252C');
  check('shelf front lip is #1A1B20', DARK_SHELF_TOKENS.shelfFrontLip === '#1A1B20');
  check('shelf drop shadow has 12px blur and 0.70 opacity', DARK_SHELF_TOKENS.shelfDropShadow.includes('12px') && DARK_SHELF_TOKENS.shelfDropShadow.includes('0.7'));
  check('muted text token is #7D818F', DARK_SHELF_TOKENS.mutedText === '#7D818F');

  console.log('\n=== 2. SHELF PLANK COMPONENT ===');
  const plank = await mount(React.createElement(ShelfPlank, { className: 'custom-plank' }));
  const plankDiv = plank.host.querySelector('[role="presentation"]');
  check('plank element exists with presentation role', Boolean(plankDiv));
  check('plank element has 11px height (10-12px spec)', plankDiv && plankDiv.style.height === '11px');
  check('plank top border is 1px solid #3A3C44', plankDiv && plankDiv.style.borderTop.includes('1px solid') && (plankDiv.style.borderTop.includes('rgb(58, 60, 68)') || plankDiv.style.borderTop.includes('#3A3C44')));
  check('plank has drop shadow', plankDiv && Boolean(plankDiv.style.boxShadow));
  check('plank preserves custom class', plankDiv && plankDiv.classList.contains('custom-plank'));
  await plank.unmount();

  console.log('\n=== 3. DARK SHELF BOOK CARD ===');
  let clicked = false;
  const card = await mount(React.createElement(DarkShelfBookCard, {
    id: 'test-card-1',
    title: 'CBC Grade 7 Curriculum Guide',
    category: 'EDUCATION',
    subtitle: 'Madam Beatrice',
    badge: 'VERIFIED',
    onClick: () => { clicked = true; }
  }));
  const cardBtn = card.host.querySelector('[data-shelf-item-id="test-card-1"]');
  check('card button exists with data attribute', Boolean(cardBtn));
  check('card displays title', /CBC Grade 7 Curriculum Guide/i.test(card.text()));
  check('card displays category', /EDUCATION/i.test(card.text()));
  check('card displays author/subtitle', /Madam Beatrice/i.test(card.text()));
  check('card displays badge', /VERIFIED/i.test(card.text()));
  check('card has contact drop shadow', cardBtn && Boolean(cardBtn.style.boxShadow));
  await card.click(cardBtn);
  check('clicking card fires onClick callback', clicked === true);
  await card.unmount();

  console.log('\n=== 4. MODERN DARK SHELF WRAPPER WITH TIERED ROWS ===');
  const fullShelf = await mount(
    React.createElement(ModernDarkShelfWrapper, {
      title: 'My Shelf',
      subtitle: 'Saved publications, community runs & local briefs',
      badge: 'SLATE EDITION'
    },
    React.createElement(ShelfRow, { label: 'Community Publications', countLabel: '2 items' },
      React.createElement(DarkShelfBookCard, { id: 'c1', title: 'Publication 1' }),
      React.createElement(DarkShelfBookCard, { id: 'c2', title: 'Publication 2' })
    ),
    React.createElement(ShelfRow, { label: 'Local Passes' },
      React.createElement(DarkShelfBookCard, { id: 'p1', title: 'Live Gigs Pass' })
    )
  ));

  const fullText = fullShelf.text();
  check('shelf wrapper displays main title', /My Shelf/i.test(fullText));
  check('shelf wrapper displays subtitle', /Saved publications, community runs/i.test(fullText));
  check('shelf wrapper displays badge', /SLATE EDITION/i.test(fullText));
  check('shelf wrapper displays row 1 header', /Community Publications/i.test(fullText));
  check('shelf wrapper displays row 2 header', /Local Passes/i.test(fullText));
  check('shelf renders planks underneath rows', fullShelf.host.querySelectorAll('[role="presentation"]').length >= 2);
  await fullShelf.unmount();

  console.log(`\nPASSED ${passCount} / FAILED ${failCount}`);
  process.exit(failCount === 0 ? 0 : 1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
