import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  url: 'https://brief.test/', pretendToBeVisual: true
});
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true }); // Node >=21 ships a getter-only navigator; plain assignment silently fails
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { act } = await import('react-dom/test-utils');
const App = (await import('./src/App.tsx')).default;

// Capture navigations instead of performing them
const opened = [];
dom.window.open = (url) => { opened.push(url); return null; };

const root = createRoot(document.getElementById('root'));
await act(async () => { root.render(React.createElement(App)); });

const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const click = async (el) => { await act(async () => {
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
}); };
const modalOpen = () => !!document.querySelector('.fixed.inset-0.z-50');
const modalText = () => { const m = document.querySelector('.fixed.inset-0.z-50'); return m ? text(m) : ''; };

let pass = 0, fail = 0;
const check = (name, cond, detail='') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
};

console.log('\n=== PATH 1: Card -> opens detail ===');
const cards = $$('div.grid > div[class*="cursor-pointer"]');
console.log(`  found ${cards.length} stream cards`);
check('modal closed initially', !modalOpen());
await click(cards[0]);
check('modal opened on card click', modalOpen());
check('modal shows the clicked object', modalText().includes('Maji Mazuri'), `got: ${modalText().slice(0,60)}`);

console.log('\n=== PATH 2: Detail -> tells you what it is ===');
const mt = modalText();
check('shows type label', /\bPlace\b/.test(mt));
check('shows category', mt.includes('Marketplace'));
check('shows summary', mt.includes('Fresh organic produce'));
check('shows Location fact', mt.includes('Location') && mt.includes('Haile Selassie'));
check('shows When fact', mt.includes('When') && mt.includes('06:00-18:30'));
check('shows trust', mt.includes('Information trust') && mt.includes('96%'));

console.log('\n=== PATH 3: Primary button ===');
const modal = document.querySelector('.fixed.inset-0.z-50');
const primary = Array.from(modal.querySelectorAll('a,button,div')).find(el =>
  el.className && String(el.className).includes('flex-[2]'));
check('primary action rendered', !!primary);
check('label = actionLabel "Open Map"', text(primary).includes('Open Map'), `got: "${text(primary)}"`);
check('is a real <a> link', primary.tagName === 'A', `got <${primary.tagName}>`);
check('href is a real maps URL', (primary.getAttribute('href')||'').startsWith('https://www.google.com/maps/'), primary.getAttribute('href')||'');
check('opens in new tab', primary.getAttribute('target') === '_blank');
check('has noopener', (primary.getAttribute('rel')||'').includes('noopener'));
const note = text(modal).includes('Opens this location in Maps');
check('caption matches behaviour', note);
check('no fake transaction wording', !/Booking started|Purchase started/.test(text(modal)));

console.log('\n=== PATH 4: Related -> swaps detail, no dead end ===');
const relBtns = Array.from(modal.querySelectorAll('button')).filter(b => text(b).length && b.querySelector('img'));
console.log(`  found ${relBtns.length} related tiles`);
check('related rail is populated', relBtns.length > 0);
const before = modalText().slice(0,80);
const targetLabel = text(relBtns[0]);
await click(relBtns[0]);
check('modal STILL open after related click', modalOpen());
const after = modalText().slice(0,80);
check('detail swapped to new object', before !== after, `before="${before.slice(0,40)}" after="${after.slice(0,40)}"`);
console.log(`  swapped into: ${targetLabel.slice(0,50)}`);

// chain a second hop
const modal2 = document.querySelector('.fixed.inset-0.z-50');
const rel2 = Array.from(modal2.querySelectorAll('button')).filter(b => b.querySelector('img'));
check('second hop available (no dead end)', rel2.length > 0);
if (rel2.length) { const b2 = modalText().slice(0,60); await click(rel2[0]);
  check('second hop swapped', modalOpen() && modalText().slice(0,60) !== b2); }

console.log('\n=== EXTRA: backdrop closes, card body does not ===');
const overlay = document.querySelector('.fixed.inset-0.z-50');
const wrapper = overlay.firstElementChild;
const cardEl = wrapper.firstElementChild;
await click(cardEl);
check('clicking modal card keeps it open', modalOpen());
await click(wrapper);
check('clicking backdrop closes it', !modalOpen());

console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
process.exit(fail ? 1 : 0);
