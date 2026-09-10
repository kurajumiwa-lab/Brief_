// ---------------------------------------------------------------------------
// EARN SURFACE SUITE — deterministic points + field-agent override + Lipa
// Mdogo contracts, in one honest place (Phase 16 #4).
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

const { EarnSurface } = require('./src/features/you/EarnSurface.tsx');

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
  // --- signed out ---
  fetchHandler = async (url) => {
    if (url.includes('/referrals/mine')) return { ok: false, status: 401, text: async () => JSON.stringify({ error: 'authentication required' }) };
    return { ok: false, status: 401, text: async () => JSON.stringify({ error: 'x' }) };
  };
  {
    const { container } = mount(React.createElement(EarnSurface, { onRequireAuth: () => {} }));
    await flush();
    assert.ok(text(container).includes('Sign in to see your earnings'));
  }
  pass('EarnSurface: signed-out state is honest');

  // --- points + deterministic ratio + field agent + lipa mdogo ---
  let converted = 0;
  fetchHandler = async (url, init) => {
    if (url.includes('/referrals/mine')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({
        code: 'WANJIKU', maxDepth: 1, link: 'https://x/ref=WANJIKU',
        balance: { earned: 1500, locked: 0, available: 1500 },
        pool: { backingKes: 2000, paidOrPromisedKes: 0, availableKes: 2000 },
        conversion: { ptsToKes: 0.10, minPoints: 500 },
        events: [{ id: 'e1', kind: 'lead_closed', points: 250, valueKes: 10000, at: '2026-09-10T00:00:00Z' }],
        conversions: []
      }) };
    }
    if (url.includes('/field-agent')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({
        claims: [{ id: 'c1', vendorId: 'v1', agentId: 'a1', claimType: 'full_registration', territoryKey: null, status: 'active', claimedAt: '2026-09-01T00:00:00Z', expiresAt: '2028-09-01T00:00:00Z', createdAt: '2026-09-01T00:00:00Z' }],
        override: {
          agentId: 'a1', rate: 0.0075, months: 24,
          claims: [{ claimId: 'c1', vendorId: 'v1', vendorName: 'Kiko Bakery', claimedAt: '2026-09-01T00:00:00Z', expiresAt: '2028-09-01T00:00:00Z', settledOrders: 3, grossKes: 30000, overrideKes: 225 }],
          grossKes: 30000, overrideKes: 225, currency: 'KES', note: 'not money until settled'
        },
        settlements: []
      }) };
    }
    if (url.includes('/lipa-mdogo')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ contracts: [{
        id: 'lmd1', status: 'active',
        asset: { deviceId: 'D1', name: 'Home Radio', totalValue: 10000, downPayment: 2000, financed: 8000, termMonths: 4 },
        lender: { id: 'p1', key: 'sacco', name: 'M-Pesa SACCO' },
        vendorId: 'v1', customerId: 'u1', onboardingRiderId: null,
        schedule: [{ index: 0, dueDate: '2026-10-01', amountDue: 2000, paid: 2000, state: 'paid' }, { index: 1, dueDate: '2026-11-01', amountDue: 2000, paid: 0, state: 'pending' }],
        summary: { totalFinanced: 8000, totalPaid: 2000, remaining: 6000, paidCount: 1, overdueCount: 0, matured: false },
        maturity: 'paying', note: 'derived'
      }] }) };
    }
    if (url.includes('/referrals/convert')) {
      converted = Number(JSON.parse(init.body).points);
      return { ok: true, status: 201, text: async () => JSON.stringify({ conversion: { id: 'cv1', points: 500, kes: 50, status: 'pending', refusedReason: null, createdAt: '2026-09-10T00:00:00Z' } }) };
    }
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(EarnSurface, { onRequireAuth: () => {} }));
    await flush();
    const t = text(container);

    // Points + the deterministic, non-gambling ratio.
    assert.ok(t.includes('1,500'), 'earned points shown');
    assert.ok(t.includes('100 points = KES 10'), 'deterministic ratio stated');
    assert.ok(t.includes('No chance, no spin'), 'anti-gambling contract stated');

    // Field agent override.
    assert.ok(t.includes('KES 225'), 'derived override shown');
    assert.ok(t.includes('Kiko Bakery'), 'territory vendor named');
    assert.ok(t.includes('3 settled orders'), 'settled order count shown');

    // Lipa Mdogo contract + maturity.
    assert.ok(t.includes('Home Radio'), 'asset named');
    assert.ok(t.includes('paying'), 'maturity shown');
    assert.ok(t.includes('M-Pesa SACCO'), 'licensed lender named');
    assert.ok(t.includes('1/2 paid'), 'paid count shown');
  }
  pass('EarnSurface: points ratio, territory override and Lipa Mdogo all render');

  // Convert action sends the entered points.
  {
    const { container } = mount(React.createElement(EarnSurface, { onRequireAuth: () => {} }));
    await flush();
    const input = Array.from(document.querySelectorAll('input')).find((i) => (i.getAttribute('aria-label') || '').includes('Points to convert'));
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '500');
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    act(() => { btn('Convert to cash').click(); });
    await flush();
    assert.equal(converted, 500, 'conversion called with the entered points');
    assert.ok(text(container).includes('pending finance confirmation'), 'honest pending note shown');
  }
  pass('EarnSurface: convert action sends the deterministic point count');

  console.log('\nPASS ' + count);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
