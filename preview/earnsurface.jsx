// ---------------------------------------------------------------------------
// EARN SURFACE SUITE — deterministic points + field-agent VISITS + Lipa
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
      // Decision 5: KES 150 flat per APPROVED visit, weekly. One approved, one
      // still waiting — the surface must show the difference honestly.
      return { ok: true, status: 200, text: async () => JSON.stringify({
        claims: [{ id: 'c1', vendorId: 'v1', agentId: 'a1', claimType: 'full_registration', territoryKey: null, status: 'active', claimedAt: '2026-09-01T00:00:00Z', expiresAt: null, createdAt: '2026-09-01T00:00:00Z' }],
        visits: [{ id: 'fv1', agentId: 'a1', vendorId: 'v1', purpose: 'full_registration', status: 'approved', notes: 'Met the owner at the stall.', submittedAt: '2026-09-08T00:00:00Z', decidedBy: 'op1', decidedAt: '2026-09-09T00:00:00Z', rejectReason: null, createdAt: '2026-09-08T00:00:00Z' }],
        earnings: {
          agentId: 'a1', feeKes: 150, currency: 'KES',
          visits: [
            { visitId: 'fv1', vendorId: 'v1', vendorName: 'Kiko Bakery', purpose: 'full_registration', status: 'approved', notes: 'Met the owner at the stall and confirmed the bakery opens at six.', submittedAt: '2026-09-08T00:00:00Z', decidedAt: '2026-09-09T00:00:00Z', decidedBy: 'op1', rejectReason: null, week: '2026-W37', feeKes: 150, contactName: 'Papa Kiko', contactMethod: '0712345678', businessType: 'retailer', location: 'Kilimani' },
            { visitId: 'fv2', vendorId: 'v2', vendorName: 'Mama Njeri Grocers', purpose: 'menu_upload', status: 'pending', notes: 'Photographed the price list at the stall.', submittedAt: '2026-09-10T00:00:00Z', decidedAt: null, decidedBy: null, rejectReason: null, week: null, feeKes: 0, contactName: 'Mama Njeri', contactMethod: '0713000000', businessType: 'retailer', location: 'Gikomba' }
          ],
          approved: 1, pending: 1, rejected: 0, approvedKes: 150, unsettledKes: 150,
          weeks: [{ week: '2026-W37', visits: 1, kes: 150, feeKes: 150, currency: 'KES', settlementId: null, settlementStatus: null }],
          note: 'KES 150 per approved visit, paid weekly; a rejected or waiting visit pays nothing. Not money until a settlement is confirmed by finance.'
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

    // Onboarding welcome + the "next step" CTA (no dead end).
    assert.ok(t.includes('How you earn'), 'onboarding welcome card shown');
    assert.ok(t.includes('Set up your territory'), 'next-step CTA present');

    // Points + the deterministic, non-gambling ratio.
    assert.ok(t.includes('1,500'), 'earned points shown');
    assert.ok(t.includes('100 points = KES 10'), 'deterministic ratio stated');
    assert.ok(t.includes('No chance, no spin'), 'anti-gambling contract stated');

    // Field agent visits — Decision 5: one flat number, printed with its arithmetic.
    assert.ok(t.includes('KES 150'), 'the flat approved-visit fee is shown');
    assert.ok(t.includes('Kiko Bakery'), 'the visited shop is named');
    assert.ok(/1 approved/.test(t), 'the approved count is shown');
    assert.ok(/1 waiting/.test(t), 'and a pending visit is named as waiting, not as money');
    assert.ok(t.includes('Week 2026-W37'), 'the payout week is printed');
    assert.ok(t.includes('not settled yet'), 'with its settlement state, not an implied one');
    assert.ok(t.includes('Met the owner at the stall'), "the agent's own words about the visit are shown");
    assert.ok(!/0\.75%|24 month|settled order/i.test(t), 'no rate, no window, and no share of the shop\'s trade survives in the copy');
    // The direct contact the agent captured, with Call + WhatsApp affordances.
    assert.ok(t.includes('Papa Kiko'), 'direct contact name shown');
    assert.ok(t.includes('0712345678'), 'direct contact phone shown');
    const callLink = Array.from(container.querySelectorAll('a')).find((a) => (a.getAttribute('href') || '').startsWith('tel:'));
    const waLink = Array.from(container.querySelectorAll('a')).find((a) => (a.getAttribute('href') || '').includes('wa.me'));
    assert.ok(callLink, 'a Call link exists for the contact');
    assert.equal(waLink?.getAttribute('href'), 'https://wa.me/254712345678', 'a WhatsApp link is normalised to international');
    // Repeatability: onboarding is STILL offered even with an existing claim.
    assert.ok(btn('+ Onboard another shop'), 'onboard action remains available after the first claim');

    // Lipa Mdogo contract + maturity.
    assert.ok(t.includes('Home Radio'), 'asset named');
    assert.ok(t.includes('paying'), 'maturity shown');
    assert.ok(t.includes('M-Pesa SACCO'), 'licensed lender named');
    assert.ok(t.includes('1/2 paid'), 'paid count shown');
  }
  pass('EarnSurface: points ratio, approved-visit fees and Lipa Mdogo all render');

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

  // --- territory onboarding: pick a vendor and claim it (no dead end) ---
  let claimedVendorId = null;
  let claimedType = null;
  let onboardedName = null;
  let onboardedType = null;
  let onboardedLocation = null;
  let onboardedContact = null;
  fetchHandler = async (url, init) => {
    if (url.includes('/referrals/mine')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({
        code: 'WANJIKU', maxDepth: 1, link: 'https://x/ref=WANJIKU',
        balance: { earned: 0, locked: 0, available: 0 },
        pool: { backingKes: 0, paidOrPromisedKes: 0, availableKes: 0 },
        conversion: { ptsToKes: 0.10, minPoints: 500 },
        events: [], conversions: []
      }) };
    }
    if (url.includes('/field-agent/onboard')) {
      const body = init?.body ? JSON.parse(init.body) : {};
      onboardedName = body.displayName ?? null;
      onboardedType = body.businessType ?? null;
      onboardedLocation = body.location ?? null;
      onboardedContact = body.contactName ?? null;
      return { ok: true, status: 201, text: async () => JSON.stringify({ vendor: { id: 'vnew', ownerId: 'a1', displayName: onboardedName, description: '', contactMethod: null, objectId: null, businessType: onboardedType, location: onboardedLocation, status: 'active', verification: { evidence: [], facts: [], verifiedCount: 0 }, activeListingCount: 0, createdAt: '2026-09-10T00:00:00Z', updatedAt: '2026-09-10T00:00:00Z' }, claim: { id: 'cnew', vendorId: 'vnew', agentId: 'a1', claimType: 'full_registration', territoryKey: null, status: 'active', claimedAt: '2026-09-10T00:00:00Z', expiresAt: '2028-09-10T00:00:00Z', createdAt: '2026-09-10T00:00:00Z' } }) };
    }
    if (url.includes('/field-agent')) {
      // No claims yet -> the "Onboard a vendor" action must appear.
      return { ok: true, status: 200, text: async () => JSON.stringify({
        claims: [],
        visits: [],
        earnings: { agentId: 'a1', feeKes: 150, currency: 'KES', visits: [], approved: 0, pending: 0, rejected: 0, approvedKes: 0, unsettledKes: 0, weeks: [], note: 'derived' },
        settlements: []
      }) };
    }
    if (url.includes('/lipa-mdogo')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ contracts: [] }) };
    }
    if (url.includes('/claims')) {
      claimedVendorId = url.split('/vendors/')[1]?.split('/')[0] ?? null;
      claimedType = init?.body ? JSON.parse(init.body).claimType : null;
      return { ok: true, status: 201, text: async () => JSON.stringify({ claim: { id: 'c2', vendorId: claimedVendorId, agentId: 'a1', claimType: claimedType, territoryKey: null, status: 'active', claimedAt: '2026-09-10T00:00:00Z', expiresAt: null, createdAt: '2026-09-10T00:00:00Z' } }) };
    }
    if (url.includes('/api/vendors')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ vendors: [
        { id: 'v9', ownerId: 'o9', displayName: 'Mama Njeri Grocers', description: '', contactMethod: null, objectId: null, status: 'active', verification: { evidence: [], facts: [], verifiedCount: 0 }, activeListingCount: 2, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' }
      ] }) };
    }
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(EarnSurface, { onRequireAuth: () => {} }));
    await flush();
    assert.ok(text(container).includes('No visits yet'), 'empty visit state');
    assert.ok(text(container).includes('KES 150'), 'and even empty, it states the one flat number');
    assert.ok(btn('+ Onboard another shop'), 'onboard action present (no dead end)');

    act(() => { btn('+ Onboard another shop').click(); });
    await flush();
    assert.ok(text(container).includes('Make the initial connection'), 'onboard-new-shop input present');
    assert.ok(text(container).includes('Mama Njeri Grocers'), 'vendor list renders');
    assert.ok(btn('Claim territory'), 'claim-territory action present');
    assert.ok(btn('Menu'), 'menu-upload action present');

    // Claim an EXISTING vendor (the claim flow, exercised first since it closes the panel).
    act(() => { btn('Claim territory').click(); });
    await flush();
    assert.equal(claimedVendorId, 'v9', 'claim posted for the chosen vendor');
    assert.equal(claimedType, 'full_registration', 'claim type is full_registration');
  }
  pass('EarnSurface: a member can claim an existing vendor for territory');

  // --- Onboard a brand-new shop (the primary act when the market is empty) ---
  {
    const { container } = mount(React.createElement(EarnSurface, { onRequireAuth: () => {} }));
    await flush();
    act(() => { btn('+ Onboard another shop').click(); });
    await flush();

    const setInput = (aria, value) => {
      const el = Array.from(document.querySelectorAll('input')).find((i) => (i.getAttribute('aria-label') || '') === aria);
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, value);
      el.dispatchEvent(new window.Event('input', { bubbles: true }));
    };
    setInput('New vendor name', 'Mama Njeri Grocers');
    setInput('Shop location', 'Gikomba Market, Stall 12');
    setInput('Direct contact name', 'Mama Njeri');

    // Select the business type (select element -> 'change' event).
    const typeSelect = Array.from(document.querySelectorAll('select')).find((s) => (s.getAttribute('aria-label') || '') === 'Business type');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(typeSelect, 'retailer');
    typeSelect.dispatchEvent(new window.Event('change', { bubbles: true }));

    act(() => { btn('Save connection').click(); });
    await flush();
    assert.equal(onboardedName, 'Mama Njeri Grocers', 'onboard posted the shop name');
    assert.equal(onboardedType, 'retailer', 'onboard posted the business type');
    assert.equal(onboardedLocation, 'Gikomba Market, Stall 12', 'onboard posted the physical location');
    assert.equal(onboardedContact, 'Mama Njeri', 'onboard posted the direct contact name');
  }
  pass('EarnSurface: a member can onboard a brand-new vendor with type, location + direct contact');
  pass('EarnSurface: a member can onboard a new vendor and claim territory (no dead end)');

  console.log('\nPASS ' + count);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
