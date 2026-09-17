const assert = require('assert').strict;
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement; global.Element = dom.window.Element; global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent; global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true; global.localStorage = dom.window.localStorage;
const React = require('react'); const { createRoot } = require('react-dom/client'); const { act } = require('react-dom/test-utils');
const { CityFeedView } = require('./src/features/city/CityFeedView.tsx');
global.fetch = async () => ({ ok: false, status: 404, text: async () => JSON.stringify({}) });
const text = (el) => (el.textContent || '').replace(/\s+/g,' ').trim();
async function main(){
  const c = document.createElement('div'); document.body.appendChild(c); const r = createRoot(c);
  await act(async () => { r.render(React.createElement(CityFeedView, { onOpenSpace: () => {} })); });
  await act(async () => { await new Promise(x=>setTimeout(x,80)); });
  console.log('TEXT>>', text(c).slice(0, 700));
  console.log('TABS>>', Array.from(c.querySelectorAll('button[role="tab"]')).map(b=>text(b)).join(' | '));
  console.log('BTNS>>', Array.from(c.querySelectorAll('button')).map(b=>text(b)).filter(Boolean).slice(0,14).join(' | '));
}
main().catch(e=>{console.error(e);process.exit(1)});
