const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  url: 'https://brief.test/',
  pretendToBeVisual: true
});
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const { WireSection } = require('./src/components/WireSection.tsx');

const now = new Date().toISOString();
let requestNo = 0;
global.fetch = async () => {
  requestNo += 1;
  const send = (body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });
  if (requestNo === 1) {
    return send({ wire: {
      source: 'test-wire', fetchedAt: now, kenya: [{ id: 'one', title: 'First Kenyan update', url: 'https://news.example/one', image: null }], world: [], note: 'checked', error: null
    } });
  }
  if (requestNo === 2) {
    return send({ wire: {
      source: 'test-wire', fetchedAt: new Date().toISOString(), kenya: [{ id: 'two', title: 'Updated Kenyan update', url: 'https://news.example/two', image: null }], world: [], note: 'checked again', error: null
    } });
  }
  return send({ wire: {
    source: 'test-wire', fetchedAt: new Date().toISOString(), kenya: [], world: [], note: 'No current items from the upstream source.', error: 'upstream unavailable'
  } });
};

async function settle() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

async function main() {
  const root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(React.createElement(WireSection)); });
  await settle();
  const text = () => (document.body.textContent || '').replace(/\s+/g, ' ').trim();
  const button = (label) => Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === label);
  const click = async (el) => act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 0)); });
  let pass = 0;
  let fail = 0;
  const check = (name, condition, detail = '') => {
    if (condition) { pass += 1; console.log(`  PASS  ${name}`); }
    else { fail += 1; console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`); }
  };

  console.log('=== News wire updates without a frozen client copy ===');
  check('first live news item renders', text().includes('First Kenyan update'));
  const firstLink = Array.from(document.querySelectorAll('a')).find((a) => a.getAttribute('href') === 'https://news.example/one');
  check('news item is a real external link', Boolean(firstLink) && firstLink.getAttribute('target') === '_blank');
  check('source and check time are visible', text().includes('Live from test-wire') && text().includes('checked'));

  await click(button('Refresh'));
  check('refresh replaces old news with the new response', text().includes('Updated Kenyan update') && !text().includes('First Kenyan update'));
  const secondLink = Array.from(document.querySelectorAll('a')).find((a) => a.getAttribute('href') === 'https://news.example/two');
  check('updated news keeps its clickable link', Boolean(secondLink));

  await click(button('Refresh'));
  check('an upstream failure is explicit', text().includes('upstream unavailable') && text().includes('No current news returned'));
  check('empty news is not silently treated as fresh content', !text().includes('First Kenyan update') && !text().includes('Updated Kenyan update'));

  console.log(`\nPASSED ${pass}   FAILED ${fail}`);
  process.exit(fail ? 1 : 0);
}
main().catch((error) => { console.error(error); process.exit(1); });
