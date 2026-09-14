// ---------------------------------------------------------------------------
// WAIRO DISPATCH — rider routing, wired to the REAL pickup API. This pins that
// the panel renders origins (claimed shops), can assign a pickup (self-
// dispatch), and shows the derived origin fee — no fabricated bids/fares.
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
const { WairoDispatchPanel } = require('./src/features/city/WairoDispatchPanel.tsx');

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
const btn = (label) => Array.from(document.querySelectorAll('button')).find((b) => text(b).startsWith(label));

let fetchHandler;
global.fetch = async (input, init) => fetchHandler(String(input?.url ?? input ?? ''), init);

async function main() {
  let assignedBody = null;
  let completedId = null;
  fetchHandler = async (url, init) => {
    if (url.includes('/pickups/origins')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ origins: [
        { vendorId: 'v1', shopName: 'Kilimani Grocers', businessType: 'retailer', location: 'Kilimani', onboardingAgentId: 'a1' }
      ] }) };
    }
    if (url.includes('/pickups/mine')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ pickups: [
        { id: 'p1', originVendorId: 'v1', riderId: 'r1', assignedBy: 'r1', destinationTown: 'Nakuru', receiverName: 'Buyer', receiverPhone: '0712', notes: '', status: 'assigned', createdAt: '2026-09-10T00:00:00Z', completedAt: null }
      ] }) };
    }
    if (url.includes('/pickup-origin-fee')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ obligation: { agentId: 'a1', pickupCount: 1, feePerPickupKes: 20, originFeeKes: 20, note: 'derived' } }) };
    }
    if (url.includes('/complete')) {
      completedId = url.split('/pickups/')[1]?.split('/')[0] ?? null;
      return { ok: true, status: 200, text: async () => JSON.stringify({ pickup: { id: completedId, status: 'delivered' } }) };
    }
    if (url.includes('/api/pickups')) {
      assignedBody = JSON.parse(init.body);
      return { ok: true, status: 201, text: async () => JSON.stringify({ pickup: { id: 'p2', originVendorId: assignedBody.originVendorId, riderId: 'r1', destinationTown: assignedBody.destinationTown, status: 'assigned' } }) };
    }
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };

  const { container } = mount(React.createElement(WairoDispatchPanel, null));
  await flush();
  const t = text(container);

  assert.ok(t.includes('Kilimani Grocers'), 'origin (claimed shop) renders');
  assert.ok(t.includes('Assign a pickup'), 'assign form present');
  assert.ok(t.includes('KES 20'), 'derived origin fee shown');
  assert.ok(!t.includes('auction') && !t.includes('90%'), 'no fabricated bid/payout copy');
  pass('WairoDispatchPanel renders origins, assign form and the derived fee — no fabrication');

  // Assign (self-dispatch, no riderId -> server defaults to caller).
  act(() => {
    const setInput = (aria, v) => {
      const el = Array.from(document.querySelectorAll('input')).find((i) => (i.getAttribute('aria-label') || '') === aria);
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, v); el.dispatchEvent(new window.Event('input', { bubbles: true }));
    };
    setInput('Pickup destination town', 'Nakuru');
    setInput('Receiver name', 'Buyer');
    setInput('Receiver phone', '0712');
  });
  act(() => { document.querySelectorAll('button').forEach(b => { if (text(b).startsWith('Kilimani Grocers')) b.click(); }); });
  await flush();
  act(() => { btn('Assign rider').click(); });
  await flush();
  assert.equal(assignedBody.destinationTown, 'Nakuru', 'assign posted the destination');
  assert.equal(assignedBody.riderId, undefined, 'riderId defaults to caller (self-dispatch)');
  pass('WairoDispatchPanel assigns a self-dispatched pickup');

  // Mark delivered.
  act(() => { btn('Delivered').click(); });
  await flush();
  assert.equal(completedId, 'p1', 'complete posted for the pickup');
  pass('WairoDispatchPanel marks a pickup delivered');

  console.log('\nPASS ' + count);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
