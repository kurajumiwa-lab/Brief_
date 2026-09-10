// ---------------------------------------------------------------------------
// PARTNER DESK SUITE — the Phase 2 distribution surface + acquisition capture.
//
// Tests:
//   1. the acquisition helper (capture from URL, first-touch-wins, clear)
//   2. PartnerDesk honest states: 403 -> operator-only, empty -> no partners
//   3. PartnerDesk list renders DERIVED economics (members/gross/share)
//   4. generate-invite-link produces a real URL (no public-origin -> honest)
//   5. agreement editor: save + finance-403 honesty
//   6. settlements: request / confirm / refuse (incl. the reason-length rule)
// ---------------------------------------------------------------------------
const assert = require('assert').strict;
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'https://brief.test/join?partner=WEF&program=women-enterprise-2026&cohort=nairobi-west',
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
global.localStorage = dom.window.localStorage;

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');

const acq = require('./src/api/acquisition.ts');
const { PartnerDesk } = require('./src/features/partner/PartnerDesk.tsx');

let count = 0;
const pass = (name) => { count++; console.log('PASS ' + name); };
const flush = (ms = 40) => new Promise((r) => setTimeout(r, ms));

function mount(el) {
  // Fresh body per mount: earlier blocks may leave unmounted instances whose
  // buttons would otherwise capture clicks meant for the new one.
  document.body.innerHTML = '';
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(el));
  return { container, root };
}

const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const btn = (label) => Array.from(document.querySelectorAll('button')).find((b) => text(b).startsWith(label));
const input = (label) => Array.from(document.querySelectorAll('input')).find((i) => (i.getAttribute('aria-label') || '').includes(label));

// A partner whose economics have real numbers to derive from.
const partner = {
  id: 'ptn_1', key: 'wef', name: 'Women Enterprise Fund', partnerType: 'women_org', status: 'active',
  programs: [{ id: 'prg_1', key: 'women-enterprise-2026', name: 'Women Enterprise 2026', status: 'active', cohorts: [{ id: 'ch_1', key: 'nairobi-west', name: 'Nairobi West', status: 'active' }] }],
  agreement: { id: 'agr_1', shareRate: 0.2, basis: 'verified_commercial', status: 'active' },
  economics: {
    partner: { id: 'ptn_1', key: 'wef', name: 'Women Enterprise Fund', partnerType: 'women_org', status: 'active' },
    members: 3,
    activity: { ordersBought: 0, ordersSold: 1, workRequested: 2, workFulfilled: 0, repeatPatterns: 1, requestsCreated: 2 },
    grossKes: 17000,
    basis: 'verified_commercial',
    shareRate: 0.2,
    partnerShareKes: 3400,
    settlements: { pendingKes: 0, confirmedKes: 0 },
    note: 'derived'
  }
};

const cohortSummary = {
  filter: { partnerKey: 'wef', programKey: 'women-enterprise-2026', cohortKey: 'nairobi-west' },
  members: 2,
  ordersBought: 1, ordersBoughtKes: 1200,
  ordersSold: 1, ordersSoldKes: 1200,
  workRequested: 1, workRequestedKes: 8500,
  workFulfilled: 0, workFulfilledKes: 0,
  repeatPatterns: 1, requestsCreated: 1,
  verifiedCommercialKes: 10900,
  currency: 'KES',
  note: 'Gross activity across members.',
  rows: [
    { userId: 'usr_alice', handle: 'alice', displayName: 'Alice Njeri', acquisition: null, activity: { orders: { bought: { count: 1, totalKes: 1200 }, sold: { count: 0, totalKes: 0 } }, work: { requested: { count: 0, totalKes: 0 }, fulfilled: { count: 0, totalKes: 0 } }, procurement: { repeatPatterns: 0 }, requests: { created: 0 }, verifiedCommercialKes: 1200, currency: 'KES' } },
    { userId: 'usr_carol', handle: 'carol', displayName: 'Carol Wanjiku', acquisition: null, activity: { orders: { bought: { count: 0, totalKes: 0 }, sold: { count: 1, totalKes: 1200 } }, work: { requested: { count: 1, totalKes: 8500 }, fulfilled: { count: 0, totalKes: 0 } }, procurement: { repeatPatterns: 1 }, requests: { created: 1 }, verifiedCommercialKes: 9700, currency: 'KES' } }
  ]
};

const settlement = (status) => ({
  id: `pstl_${status}`, partnerId: 'ptn_1', periodKey: 'ptn_1:all:all',
  periodFrom: null, periodTo: null, grossKes: 17000, shareRate: 0.2, shareKes: 3400,
  basis: 'verified_commercial', ledgerId: 'txn_1', status,
  requestedBy: 'usr_fin', confirmedBy: null, confirmedAt: null, refusedReason: null,
  createdAt: '2026-09-10T00:00:00Z', updatedAt: '2026-09-10T00:00:00Z'
});

// A controllable fetch mock.
let fetchHandler;
global.fetch = async (input, init) => fetchHandler(String(input?.url ?? input ?? ''), init);

async function main() {
  // --- 1. acquisition helper ---
  acq.captureAcquisitionFromUrl();
  const ctx = acq.pendingAcquisition();
  assert.ok(ctx, 'context captured');
  assert.equal(ctx.partnerKey, 'WEF');
  assert.equal(ctx.programKey, 'women-enterprise-2026');
  assert.equal(ctx.cohortKey, 'nairobi-west');
  pass('acquisition: captures partner/program/cohort from the landing URL');

  dom.window.history.replaceState(null, '', '/join?partner=OTHER&cohort=eldoret');
  acq.captureAcquisitionFromUrl();
  assert.equal(acq.pendingAcquisition().partnerKey, 'WEF', 'first touch wins');
  pass('acquisition: first-touch-wins — a later link never rewrites the origin');

  acq.clearAcquisition();
  assert.equal(acq.pendingAcquisition(), null, 'cleared');
  pass('acquisition: clear removes the captured context');

  // --- 2. 403 -> operator-only ---
  fetchHandler = async () => ({ ok: false, status: 403, text: async () => JSON.stringify({ error: 'forbidden_capability' }) });
  {
    const { container } = mount(React.createElement(PartnerDesk));
    await flush();
    assert.ok(text(container).includes('Operator access only'));
  }
  pass('PartnerDesk: a non-operator sees an honest operator-only state');

  // --- 3. empty -> no partners ---
  fetchHandler = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ partners: [] }) });
  {
    const { container } = mount(React.createElement(PartnerDesk));
    await flush();
    assert.ok(text(container).includes('No partners yet'));
  }
  pass('PartnerDesk: an operator with no partners sees an honest empty state');

  // --- 4. list + invite link ---
  fetchHandler = async (url) => {
    if (url.includes('/invite')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ link: { available: false, reason: 'public_origin_not_configured', partnerKey: 'wef' } }) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({ partners: [partner] }) };
  };
  {
    const { container, root } = mount(React.createElement(PartnerDesk));
    await flush();
    const t = text(container);
    assert.ok(t.includes('Women Enterprise Fund'));
    assert.ok(t.includes('3'));
    assert.ok(t.includes('17,000'));
    assert.ok(t.includes('3,400'));
    assert.ok(t.includes('20%'));
    pass('PartnerDesk: renders derived economics (members/gross/share)');

    act(() => { btn('Generate invite link').click(); });
    await flush();
    assert.ok(text(container).includes('No public origin configured'));
    pass('PartnerDesk: invite link is honest when no public origin is configured');
    root.unmount();
  }

  // --- 4b. cohort drill-down: click a cohort -> members + verified activity ---
  fetchHandler = async (url) => {
    if (url.includes('/attribution/cohort')) {
      return { ok: true, status: 200, text: async () => JSON.stringify(cohortSummary) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({ partners: [partner] }) };
  };
  {
    const { container } = mount(React.createElement(PartnerDesk));
    await flush();
    // The cohort chip is present.
    assert.ok(text(container).includes('Nairobi West'), 'cohort chip shown');
    // Click it -> drill-down opens with member rows.
    act(() => { btn('Nairobi West').click(); });
    await flush();
    const t = text(container);
    assert.ok(t.includes('2 members'), 'member count shown');
    assert.ok(t.includes('KES 10,900'), 'cohort verified total shown');
    assert.ok(t.includes('Alice Njeri'), 'member displayName shown');
    assert.ok(t.includes('@alice'), 'member handle shown');
    assert.ok(t.includes('Carol Wanjiku'), 'second member shown');
    // The member with higher activity sorts first (Carol 9700 > Alice 1200).
    assert.ok(t.indexOf('Carol Wanjiku') < t.indexOf('Alice Njeri'), 'members sorted by activity descending');
    pass('PartnerDesk: clicking a cohort drills down to members + verified activity');
  }

  // --- 4c. cohort drill-down: honest empty state ---
  fetchHandler = async (url) => {
    if (url.includes('/attribution/cohort')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ ...cohortSummary, members: 0, rows: [], verifiedCommercialKes: 0 }) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({ partners: [partner] }) };
  };
  {
    const { container } = mount(React.createElement(PartnerDesk));
    await flush();
    act(() => { btn('Nairobi West').click(); });
    await flush();
    assert.ok(text(container).includes('No members attributed to this cohort yet'));
    pass('PartnerDesk: an empty cohort shows an honest no-members state');
  }

  // --- 5. agreement editor + finance 403 honesty ---
  fetchHandler = async (url, init) => {
    if (url.includes('/agreement')) {
      // Simulate the server refusing a non-finance caller.
      return { ok: false, status: 403, text: async () => JSON.stringify({ error: 'forbidden_capability', requiredCapability: 'finance' }) };
    }
    if (url.includes('/settlements')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ settlements: [] }) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({ partners: [partner] }) };
  };
  {
    const { container } = mount(React.createElement(PartnerDesk));
    await flush();
    act(() => { btn('Agreement & settlement').click(); });
    await flush();
    const t = text(container);
    assert.ok(t.includes('Revenue-share agreement'));
    assert.ok(t.includes('Settlements'));
    pass('PartnerDesk: the manage panel opens with agreement + settlements');

    // Enter 30 and save -> finance 403 is shown verbatim.
    const share = input('Share percentage');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(share, '30');
      share.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    act(() => { btn('Save agreement').click(); });
    await flush();
    assert.ok(text(container).includes('Finance access is required to set an agreement'));
    pass('PartnerDesk: a finance-403 on agreement is shown honestly');
  }

  // --- 6. settlements: request / confirm / refuse ---
  let settlementRows = [];
  fetchHandler = async (url, init) => {
    const method = init?.method ?? 'GET';
    if (url.includes('/agreement')) {
      return { ok: true, status: 201, text: async () => JSON.stringify({ agreement: { id: 'agr_2', shareRate: 0.3, basis: 'verified_commercial', status: 'active' } }) };
    }
    // confirm/refuse BEFORE settlements: their URLs also contain "settlements".
    if (url.includes('/confirm')) {
      const id = url.split('/').at(-2);
      const row = settlementRows.find((s) => s.id === id);
      const updated = { ...row, status: 'confirmed', confirmedBy: 'usr_fin', confirmedAt: '2026-09-10T01:00:00Z' };
      settlementRows = settlementRows.map((s) => (s.id === id ? updated : s));
      return { ok: true, status: 200, text: async () => JSON.stringify({ settlement: updated }) };
    }
    if (url.includes('/refuse')) {
      const id = url.split('/').at(-2);
      const body = JSON.parse(init.body || '{}');
      const row = settlementRows.find((s) => s.id === id);
      const updated = { ...row, status: 'refused', refusedReason: body.note };
      settlementRows = settlementRows.map((s) => (s.id === id ? updated : s));
      return { ok: true, status: 200, text: async () => JSON.stringify({ settlement: updated }) };
    }
    if (url.includes('/settlements')) {
      if (method === 'POST') {
        const row = settlement('pending');
        settlementRows.push(row);
        return { ok: true, status: 201, text: async () => JSON.stringify({ settlement: row }) };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({ settlements: settlementRows }) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({ partners: [partner] }) };
  };
  {
    const { container } = mount(React.createElement(PartnerDesk));
    await flush();
    act(() => { btn('Agreement & settlement').click(); });
    await flush();

    // Request a settlement -> a pending row appears.
    act(() => { btn('Request settlement').click(); });
    await flush();
    assert.ok(text(container).includes('KES 3,400'), 'settlement amount shown');
    assert.ok(text(container).includes('Confirm paid'), 'confirm action shown for pending');
    pass('PartnerDesk: requesting a settlement surfaces a pending row');

    // Refuse with a too-short reason is refused client-side.
    const reason = input('Refusal reason');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(reason, 'no');
      reason.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    act(() => { btn('Refuse').click(); });
    await flush();
    assert.ok(text(container).includes('Say why (at least 4 characters)'));
    pass('PartnerDesk: a too-short refusal reason is refused client-side');

    // A valid refusal reason flips the row to refused. Re-query the input:
    // the notice re-render replaces the DOM node, so the earlier reference is
    // stale and a dispatch on it would not reach React's listener.
    const reason2 = input('Refusal reason');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(reason2, 'not this quarter');
      reason2.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    act(() => { btn('Refuse').click(); });
    await flush();
    assert.ok(text(container).includes('not this quarter'), 'refusal reason shown');
    pass('PartnerDesk: a valid refusal marks the settlement refused with the reason');
  }

  console.log('\nPASS ' + count);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
