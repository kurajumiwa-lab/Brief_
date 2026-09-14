// ---------------------------------------------------------------------------
// SPACESHELL — the full space workspace. A space must not feel like a register:
// it must expose build (add offer), organise (tabs), edit (visibility, archive)
// and identity. This pins the header + controls.
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
const { SpaceShell } = require('./src/features/spaces/SpaceShell.tsx');

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

const space = {
  id: 'spc_1', ownerId: 'u1', vendorId: 'v1', name: "Amina's Cakes", type: 'business',
  goal: 'First 20 customers', targetValueKes: 0, visibility: 'private', status: 'active',
  capabilities: [], metrics: { revenueKes: 0, customerCount: 0, activeOrdersCount: 0, totalOrdersCount: 0, offersCount: 0 },
  offers: [], recentActivities: [], recentConversations: [], createdAt: '', updatedAt: ''
};

let fetchHandler;
global.fetch = async (input, init) => fetchHandler(String(input?.url ?? input ?? ''), init);

async function main() {
  fetchHandler = async (url) => {
    if (url.includes(`/api/spaces/${space.id}`)) return { ok: true, status: 200, text: async () => JSON.stringify({ space }) };
    if (url.includes('/api/events')) return { ok: true, status: 200, text: async () => JSON.stringify({ events: [], total: 0 }) };
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };

  const { container } = mount(React.createElement(SpaceShell, { spaceId: space.id, onBack: () => {}, onShare: () => {} }));
  await flush();
  const t = text(container);

  // Identity — it reads as a project, not a register.
  assert.ok(t.includes("Amina's Cakes"), 'space name');
  assert.ok(t.includes('First 20 customers'), 'goal');
  // Build capability: the + Add Offer button is present.
  assert.ok(t.includes('Add Offer'), 'add-offer action present');
  // The three consolidated surfaces.
  assert.ok(t.includes('Pipeline') && t.includes('Ledger') && t.includes('Catalog'), 'three tabs present');
  // Visibility controls: the owner decides who discovers the space.
  assert.ok(t.includes('Private') && t.includes('Unlisted') && t.includes('Public'), 'visibility choices present');
  pass('SpaceShell exposes identity, add-offer, tabs, and visibility — not a register');

  console.log('\nPASS ' + count);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
