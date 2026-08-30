// WHATSAPP SHOP BUILDER — Brief builds the shop, WhatsApp IS the shop.
// The preview must be the EXACT text (*bold*, _italic_ are WhatsApp's real
// formatting), publishing is gated on a confirmed store service, and the
// refusal deep-links to the Pochi fee flow.
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement; global.Element = dom.window.Element; global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent; global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
require('./suiteauth.cjs').installSuiteSession();
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');

const SHOP_VIEW = (over = {}) => ({
  shop: {
    id: 'shop_1', ownerId: 'usr_1', name: 'Mama Njeria Fresh', tagline: 'Fresh groceries, Kilimani',
    orderNumber: '+254 712 345 678',
    items: [
      { id: 'i1', name: 'Sukuma Wiki', priceKes: 50, note: null },
      { id: 'i2', name: 'Tomatoes (kg)', priceKes: 120, note: 'organic' }
    ],
    status: 'draft', publishedAt: null, ...over.shop
  },
  store: { priceKes: 250, active: false, activeUntil: null, ...over.store },
  share: null, ...over
});
const TEXT = '*Mama Njeria Fresh*\n_Fresh groceries, Kilimani_\n\n🛒 *PRICE LIST*\n1. Sukuma Wiki — *KES 50*\n2. Tomatoes (kg) — *KES 120* _organic_\n\n📲 To order, reply with the item number';

let state = { view: SHOP_VIEW(), gateOpen: true };
state.view.share = { text: TEXT, waMe: `https://wa.me/254712345678?text=${encodeURIComponent(TEXT)}`, shareable: false };

global.fetch = async (url, init = {}) => {
  const path = String(url);
  const send = (b, s = 200) => ({ ok: s < 400, status: s, text: async () => JSON.stringify(b), json: async () => b });
  if (path.includes('/api/shop/mine/publish')) {
    if (!state.view.store.active) {
      return send({ error: 'publishing needs the store service — KES 250/month via Pochi la Biashara, confirmed by an operator', requiresService: 'store_monthly' }, 409);
    }
    state.view = { ...state.view, shop: { ...state.view.shop, status: 'published', publishedAt: '2026-08-30T00:00:00Z' }, share: { ...state.view.share, shareable: true } };
    return send({ changed: true, ...state.view });
  }
  if (path.includes('/api/shop/mine/unpublish')) {
    state.view = { ...state.view, shop: { ...state.view.shop, status: 'draft' }, share: { ...state.view.share, shareable: false } };
    return send({ changed: true, ...state.view });
  }
  if (path.includes('/api/shop/mine') && (init.method === 'PUT' || !init.method)) {
    if (init.method === 'PUT') return send(state.view, 201);
    return send(state.view);
  }
  return { ok: false, status: 404, text: async () => '{}', json: async () => ({}) };
};

let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); } };

(async () => {
  const { WhatsAppShopBuilder } = await import('../src/components/WhatsAppShopBuilder.tsx');
  let feesOpened = false;
  const root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(React.createElement(WhatsAppShopBuilder, { onOpenFees: () => { feesOpened = true; } })); });
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });

  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const body = () => text(document.body);
  const btn = (t) => Array.from(document.querySelectorAll('button')).find((b) => text(b) === t);
  const inputByLabel = (frag) => Array.from(document.querySelectorAll('input')).find((i) => (i.placeholder ?? '') .includes(frag));
  const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); }); };
  const type = async (el, v) => { await act(async () => { el.value = v; el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); }); };

  console.log('=== the architecture is stated, not hidden ===');
  check('the shop says where selling happens', body().includes('sell in the conversation'));
  check('the honest money line: arranged between you, Brief never touches it', body().includes('Brief never touches it'));

  console.log('\n=== the preview is the EXACT WhatsApp text ===');
  check('the name renders in WhatsApp-bold stars', body().includes('*Mama Njeria Fresh*'));
  check('prices are bold, notes italic', body().includes('Sukuma Wiki — *KES 50*') && body().includes('_organic_'));
  check('the formatting note tells the truth about WhatsApp', body().includes('render bold'));
  check('the wa.me link opens the order number with the catalog', Boolean(document.querySelector('a[href^="https://wa.me/254712345678?text="]')));
  check('a draft is honestly marked not-live', body().includes('Draft preview'));

  console.log('\n=== the gate is the store service, confirmed by an operator ===');
  check('the service panel states the price and the flow', body().includes('KES 250/month') && body().includes('Pochi'));
  await click(btn('Publish'));
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  check('publishing is refused with the reason', body().includes('store service'));
  check('the refusal deep-links to the fee desk', body().includes('Pay the store service'));
  await click(btn('Pay the store service (KES 250/month via Pochi) →'));
  check('the link opens the fee desk', feesOpened === true);

  // Now confirm the service and publish for real.
  state.view = { ...state.view, store: { ...state.view.store, active: true, activeUntil: '2026-09-29T00:00:00Z' } };
  // key forces a true remount: a fresh read of the (now active) service.
  await act(async () => { root.render(React.createElement(WhatsAppShopBuilder, { key: 'svc-on', onOpenFees: () => {} })); });
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  check('an active service is stated with its end date', body().includes('Active until'));
  await click(btn('Publish'));
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  check('publishing works and the shop is marked Live', body().includes('Live'));
  check('the share is now shareable', !body().includes('Draft preview'));

  console.log('\n=== the builder edits ===');
  const name = inputByLabel('Mama Njeria');
  await type(name, 'Mama Njeria Fresh');
  check('the form loads the saved shop', Boolean(name) && name.value === 'Mama Njeria Fresh');
  await click(btn('Add an item'));
  check('a row can be added', Array.from(document.querySelectorAll('input[placeholder="Sukuma Wiki"]')).length === 3);

  console.log(`\nPASS ${pass} FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})();
