const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement; global.Element = dom.window.Element; global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent; global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const App = require('./src/App.tsx').default;

async function main() {
  dom.window.open = () => null;
  const root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(React.createElement(App)); });
  const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); }); };
  const modal = () => document.querySelector('.fixed.inset-0.z-50');
  const modalText = () => { const m = modal(); return m ? text(m) : ''; };
  let pass=0, fail=0;
  const check=(n,c,d='')=>{ if(c){pass++;console.log('  PASS  '+n);} else {fail++;console.log('  FAIL  '+n+(d?'  -> '+d:''));} };

  // open the Solar Kit from the stream
  const cards = Array.from(document.querySelectorAll('div.grid > div[class*="cursor-pointer"]'));
  const solar = cards.find(c => text(c).includes('Portable Solar Lighting Pack'));
  check('Solar Kit card present in stream', !!solar);
  await click(solar);
  check('Solar Kit detail opened', modalText().includes('Portable Solar Lighting Pack'));

  // Walk: Solar Kit -> Kikao Hardware -> Solar Install -> Kilimani Hub
  const hops = ['Kikao Hardware', 'Solar Pack Installation Support', 'Kilimani Innovation Hub'];
  for (const target of hops) {
    const tiles = Array.from(modal().querySelectorAll('button'));
    const tile = tiles.find(b => text(b).includes(target));
    check(`related rail offers "${target}"`, !!tile,
      tile ? '' : 'tiles: ' + tiles.map(b=>text(b).slice(0,26)).filter(Boolean).slice(0,6).join(' | '));
    if (!tile) break;
    await click(tile);
    check(`navigated to "${target}"`, modalOpenHas(target), modalText().slice(0,80));
  }
  function modalOpenHas(t){ return !!modal() && modalText().includes(t); }

  // Kikao renders safely with no image / no metadata
  const kikaoCards = Array.from(document.querySelectorAll('div.grid > div[class*="cursor-pointer"]'));
  const kikao = kikaoCards.find(c => text(c).includes('Kikao Hardware'));
  if (kikao) {
    await click(kikao);
    const t = modalText();
    check('Kikao detail renders without image/metadata', !!modal() && t.includes('Kikao Hardware'));
    check('no NaN / undefined / [object Object] leaked', !/NaN|undefined|\[object Object\]/.test(t), t.slice(0,120));
    // NB: the old pattern /KES\s*(?![\d])/ matched every valid price too --
    // \s* backtracks to zero width, so "KES 18,500" satisfied it. The intent
    // is "KES not followed by a number", which is what this asserts.
    check('no empty "KES" price shown', !/KES(?!\s*[\d])/.test(t));
    // Detail header renders the TYPE label by existing design; category lives on the card.
    check('detail shows Identity type label', t.includes('Identity'));
    // Stream cards render the type badge, not category (existing design):
    // category surfaces on related tiles. Assert it where it actually lives.
    check('card shows type badge + no broken image', text(kikao).includes('Identity') && !kikao.querySelector('img'));
    check('imageless card still shows category', text(kikao).includes('Hardware Supplier'), text(kikao).slice(0,140));
    check('imageless card still shows VERIFIED', text(kikao).toUpperCase().includes('VERIFIED'));
    const closeBtns = Array.from(modal().querySelectorAll('button')).filter(b => b.querySelector('svg') && !text(b));
    check('imageless detail has a close button', closeBtns.length > 0);
    check('imageless detail shows category chip', t.includes('Hardware Supplier'));
    check('creator/provider name present', t.includes('Kikao Hardware'));
    check('location is Kilimani Hardware Lab', t.includes('Kilimani Hardware Lab'));
    check('primary action is Open Map (no fake transaction)', t.includes('Open Map') && !/Buy|Purchase started|Booking started/.test(t));
    check('shows trust (mirrored 97%)', t.includes('97'));
  }
  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail?1:0);
}
main().catch(e => { console.error(e); process.exit(1); });
