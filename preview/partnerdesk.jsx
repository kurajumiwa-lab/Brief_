// ---------------------------------------------------------------------------
// PARTNER DESK SUITE — the Phase 2 distribution surface + acquisition capture.
//
// Tests:
//   1. the acquisition helper (capture from URL, first-touch-wins, clear)
//   2. PartnerDesk honest states: 403 -> operator-only, empty -> no partners
//   3. PartnerDesk list renders DERIVED economics (members/gross/share)
//   4. generate-invite-link produces a real URL (no public-origin -> honest)
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
// The acquisition helper + briefApi read window.localStorage; expose it.
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
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(el));
  return { container, root };
}

const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const btn = (label) => Array.from(document.querySelectorAll('button')).find((b) => text(b).startsWith(label));

async function main() {
  // --- 1. acquisition helper ---
  acq.captureAcquisitionFromUrl();
  const ctx = acq.pendingAcquisition();
  assert.ok(ctx, 'context captured');
  assert.equal(ctx.partnerKey, 'WEF');
  assert.equal(ctx.programKey, 'women-enterprise-2026');
  assert.equal(ctx.cohortKey, 'nairobi-west');
  pass('acquisition: captures partner/program/cohort from the landing URL');

  // First-touch-wins: a second capture with a different URL must not rewrite.
  dom.window.history.replaceState(null, '', '/join?partner=OTHER&cohort=eldoret');
  acq.captureAcquisitionFromUrl();
  const ctx2 = acq.pendingAcquisition();
  assert.equal(ctx2.partnerKey, 'WEF', 'first touch wins, not rewritten');
  pass('acquisition: first-touch-wins — a later link never rewrites the origin');

  acq.clearAcquisition();
  assert.equal(acq.pendingAcquisition(), null, 'cleared');
  pass('acquisition: clear removes the captured context');

  // --- 2. PartnerDesk: 403 -> operator-only ---
  global.fetch = async () => ({
    ok: false, status: 403,
    text: async () => JSON.stringify({ error: 'forbidden_capability' })
  });
  {
    const { container } = mount(React.createElement(PartnerDesk));
    await flush();
    assert.ok(text(container).includes('Operator access only'), '403 state shown');
  }
  pass('PartnerDesk: a non-operator sees an honest operator-only state');

  // --- 3. PartnerDesk: empty -> no partners ---
  global.fetch = async () => ({
    ok: true, status: 200,
    text: async () => JSON.stringify({ partners: [] })
  });
  {
    const { container } = mount(React.createElement(PartnerDesk));
    await flush();
    assert.ok(text(container).includes('No partners yet'), 'empty state shown');
  }
  pass('PartnerDesk: an operator with no partners sees an honest empty state');

  // --- 4. PartnerDesk: list renders derived economics + invite link ---
  const partnerList = [{
    id: 'ptn_1', key: 'wef', name: 'Women Enterprise Fund', partnerType: 'women_org', status: 'active',
    programs: [{ id: 'prg_1', key: 'women-enterprise-2026', name: 'Women Enterprise 2026', status: 'active', cohorts: [{ id: 'ch_1', key: 'nairobi-west', name: 'Nairobi West', status: 'active' }] }],
    agreement: { id: 'agr_1', shareRate: 0.2, basis: 'verified_commercial', status: 'active' },
    economics: {
      partner: { id: 'ptn_1', key: 'wef', name: 'Women Enterprise Fund', partnerType: 'women_org', status: 'active' },
      members: 3,
      activity: { ordersBought: 0, ordersSold: 0, workRequested: 2, workFulfilled: 0, repeatPatterns: 1, requestsCreated: 2 },
      grossKes: 17000,
      basis: 'verified_commercial',
      shareRate: 0.2,
      partnerShareKes: 3400,
      settlements: { pendingKes: 0, confirmedKes: 0 },
      note: 'derived'
    }
  }];
  global.fetch = async (input) => {
    const u = String(input?.url ?? input ?? '');
    if (u.includes('/api/ops/partners/') && u.includes('/invite')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ link: { available: false, reason: 'public_origin_not_configured', partnerKey: 'wef' } }) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({ partners: partnerList }) };
  };
  {
    const { container, root } = mount(React.createElement(PartnerDesk));
    await flush();
    const t = text(container);
    assert.ok(t.includes('Women Enterprise Fund'), 'partner name rendered');
    assert.ok(t.includes('3'), 'members rendered');
    assert.ok(t.includes('17,000'), 'gross rendered');
    assert.ok(t.includes('3,400'), 'share rendered');
    assert.ok(t.includes('20%'), 'share rate rendered');
    pass('PartnerDesk: renders derived economics (members/gross/share)');

    // Generate invite link -> honest unavailable (no public origin).
    act(() => { btn('Generate invite link').click(); });
    await flush();
    assert.ok(text(container).includes('No public origin configured'), 'honest unavailable link');
    pass('PartnerDesk: invite link is honest when no public origin is configured');
  }

  console.log('\nPASS ' + count);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
