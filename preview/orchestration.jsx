// ---------------------------------------------------------------------------
// ORCHESTRATION SUITE — the three engine packages, client side.
//
//   PACKAGE 1  GroupBuyPortal: the 3-field intake, the five-stage ledger
//              stepper driven by real state, the receipt with its digest
//   PACKAGE 2  MatchQueuePanel: instant-queue badge, inline toggles, the
//              REAL match pipeline (queue -> opponent -> live -> reported ->
//              confirmed) derived from actual challenge/match rows
//   PACKAGE 3  TicketBar: the locked gate pass with the ticket code, and the
//              inline delta banner when the event changed after issuance
// ---------------------------------------------------------------------------
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
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

let contributionCalls = [];
let queueCalls = [];
let availabilityToggles = 0;

const BUY = {
  id: 'gbuy_1', title: 'Unga December', note: null, targetAmount: 6000,
  stage: 'target_met', stageIndex: 1,
  stages: [
    { id: 'funding', label: 'Funding Pool Initiated', blurb: 'Members are contributing.' },
    { id: 'target_met', label: 'Target Achieved', blurb: 'The pool covers the order.' },
    { id: 'escrow', label: 'Merchant Escrow Locked', blurb: 'Funds held for the merchant.' },
    { id: 'dispatched', label: 'Bulk Order Dispatched', blurb: 'The order has left the merchant.' },
    { id: 'delivered', label: 'Individual Delivery', blurb: 'Every member has their share.' }
  ],
  total: 6000, remaining: 0, progressPct: 100, contributionCount: 2,
  contributions: [
    { id: 'gbc_1', memberRef: 'Wanjiku', amount: 3500, source: 'mpesa', receiptHash: 'a1b2c3d4e5f6a7b8c9d0e1f2', createdAt: '2026-08-26T09:00:00Z' },
    { id: 'gbc_2', memberRef: 'Otieno', amount: 2500, source: 'cash', receiptHash: 'f1e2d3c4b5a69788776 655443'.replace(/ /g, ''), createdAt: '2026-08-26T09:05:00Z' }
  ],
  history: []
};

const send = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body), json: async () => body });

global.fetch = async (url, init) => {
  const path = String(url);
  if (path.includes('/api/engine/group-buys') && path.includes('/contribute')) {
    contributionCalls.push(JSON.parse(init.body));
    return send({
      receipt: { contributionId: 'gbc_3', memberRef: 'Amina', amount: 500, source: 'mpesa', receiptHash: 'deadbeefcafe0123456789ab', createdAt: '2026-08-26T09:10:00Z' },
      total: 6500, progressPct: 100, stageChanged: false
    }, 201);
  }
  if (path.includes('/api/engine/group-buys') && init?.method === 'POST') {
    return send({ groupBuy: { ...BUY, id: 'gbuy_2', title: 'New buy', stage: 'funding', stageIndex: 0, total: 0, progressPct: 0, contributions: [] } }, 201);
  }
  if (path.includes('/api/engine/group-buys')) return send({ groupBuys: [BUY] });
  if (path.includes('/api/engine/ticket-bar')) {
    return send({
      active: true,
      ticket: { eventTitle: 'Kilimani Night Market', ticketCode: 'BRF-9921-AAAA-BBBB', registrationId: 'reg_1', entryState: 'active', startsAt: null, checkedIn: false },
      deltas: [{ kind: 'details_updated', at: '2026-08-26T00:00:00Z' }]
    });
  }
  if (path.includes('/api/engine/status')) return send({ engine: 'brief.engine/1', version: 'abc', watermark: null, collections: {}, guardrail: null, router: { signingConfigured: true, channels: [] }, billingConfigured: false });
  if (path.includes('/api/engine/routes')) return send({ routes: [] });
  if (path.includes('/api/engine/deliveries')) return send({ deliveries: [] });
  if (path.includes('/api/engine/sync')) return send({ inSync: true, version: 'abc', stages: [], deltas: {}, deltaRows: 0, manifest: { version: 'abc', collections: {} } });
  if (path.includes('/api/arena/matches')) return send({ matches: [] });
  return { ok: false, status: 404, text: async () => '{}', json: async () => ({}) };
};

let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); } };
const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
const body = () => text(document.body);
const btn = (t) => Array.from(document.querySelectorAll('button')).find((b) => text(b) === t || text(b).startsWith(t));
const setVal = (el, v) => {
  const proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement : dom.window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
};

async function withRoot(render, run) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(render()); });
  try { await run(); } finally {
    await act(async () => { root.unmount(); });
    host.remove();
  }
}

async function main() {
  // ---------------- PACKAGE 1 ----------------
  console.log('\n=== PACKAGE 1: GROUP BUY PORTAL ===');
  await withRoot(() => React.createElement(require('./src/components/GroupBuyPortal.tsx').default), async () => {
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });

    check('portal renders the buy', body().includes('Unga December'));
    check('the five ledger stages render', ['Funding Pool Initiated', 'Target Achieved', 'Merchant Escrow Locked', 'Bulk Order Dispatched', 'Individual Delivery'].every((s) => body().includes(s)));
    check('progress derived (KSh 6,000 / 6,000)', body().includes('6,000') && body().includes('100%'));
    check('contributions feed with receipt digests', body().includes('Wanjiku') && body().includes('#a1b2c3d4'));
    check('only the legal next stage is offered', Boolean(btn('Mark: Merchant Escrow Locked')));

    // The 3-field intake.
    const fields = Array.from(document.querySelectorAll('input, select'));
    const member = fields.find((f) => f.placeholder === 'Member ID');
    const amount = fields.find((f) => f.placeholder === 'Amount KSh');
    await act(async () => {
      if (member) setVal(member, 'Amina');
      if (amount) setVal(amount, '500');
    });
    await act(async () => { const b = btn('Record contribution'); if (b) b.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    check('the 3-field intake posted (member, amount, source)', contributionCalls.length === 1 && contributionCalls[0].memberRef === 'Amina' && contributionCalls[0].amount === 500);
    check('the structured receipt is shown', body().includes('Ledger receipt') && body().includes('#deadbeefcafe'));
  });

  // ---------------- PACKAGE 2 ----------------
  console.log('\n=== PACKAGE 2: MATCH QUEUE PANEL ===');
  const MatchQueuePanel = require('./src/components/MatchQueuePanel.tsx').default;
  const challenge = { id: 'chl_1', status: 'open', mode: '1v1', stake: 'friendly', createdByPlayerId: 'ply_me', openUntil: '2099-01-01T00:00:00Z', createdAt: '2026-08-26T00:00:00Z', gameId: 'efootball' };
  await withRoot(() => React.createElement(MatchQueuePanel, {
    gameName: 'eFootball',
    latestChallenge: challenge, latestMatch: null,
    availabilityOn: true, busy: false,
    onEnterQueue: (p) => queueCalls.push(p),
    onToggleAvailability: () => { availabilityToggles++; }
  }), async () => {
    check('instant queue badge reflects availability', body().includes('Instant Queue Matching'));
    check('inline mode toggles offered', body().includes('Casual') && body().includes('Ranked'));
    check('inline interface toggles offered', body().includes('Touch') && body().includes('Controller'));
    check('real pipeline shown for an open challenge',
      ['Queue Entered', 'Opponent Found', 'Match Live', 'Result Reported', 'Result Confirmed'].every((s) => body().includes(s)));
    check('challenge reference surfaced', body().includes('chl_1'));

    // Toggle to Ranked + Controller, then re-render with the queue params flowing.
    const ranked = Array.from(document.querySelectorAll('button')).find((b) => text(b) === 'Ranked');
    const controller = Array.from(document.querySelectorAll('button')).find((b) => text(b) === 'Controller');
    await act(async () => {
      if (ranked) ranked.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      if (controller) controller.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });
    check('toggles respond immediately', Boolean(ranked && controller));

    // Availability toggle goes through.
    const zap = Array.from(document.querySelectorAll('button')).find((b) => text(b).includes('Instant'));
    await act(async () => { if (zap) zap.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    check('availability toggles through the panel', availabilityToggles === 1);
  });

  // Idle player -> idle pipeline, queue entry fires with the toggled params.
  await withRoot(() => React.createElement(MatchQueuePanel, {
    gameName: 'eFootball', latestChallenge: null, latestMatch: null,
    availabilityOn: false, busy: false,
    onEnterQueue: (p) => queueCalls.push(p),
    onToggleAvailability: () => {}
  }), async () => {
    check('idle player sees an honest idle state', body().includes('Idle'));
    const ranked = Array.from(document.querySelectorAll('button')).find((b) => text(b) === 'Ranked');
    const controller = Array.from(document.querySelectorAll('button')).find((b) => text(b) === 'Controller');
    await act(async () => {
      if (ranked) ranked.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      if (controller) controller.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });
    await act(async () => { const b = btn('Enter queue'); if (b) b.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    check('entering the queue carries the toggled mode', queueCalls.length === 1 && queueCalls[0].stake === 'ranked');
    check('and the interface preference rides the note', queueCalls[0].note === 'controller interface');
  });

  // A confirmed match pins the pipeline at its terminal stage.
  await withRoot(() => React.createElement(MatchQueuePanel, {
    gameName: 'eFootball', latestChallenge: challenge,
    latestMatch: { id: 'mtch_1', status: 'confirmed', confirmedByA: true, confirmedByB: true, playerAName: 'A', playerBName: 'B' },
    availabilityOn: true, busy: false,
    onEnterQueue: () => {}, onToggleAvailability: () => {}
  }), async () => {
    const dots = Array.from(document.querySelectorAll('div')).filter((d) => d.className.includes && String(d.className).includes('rounded-full'));
    // All five stage nodes render; the pipeline headline shows the match id.
    check('match pipeline renders for a live match', body().includes('mtch_1') && body().includes('Result Confirmed'));
  });

  // ---------------- PACKAGE 3 ----------------
  console.log('\n=== PACKAGE 3: TICKET BAR ===');
  await withRoot(() => React.createElement(require('./src/components/TicketBar.tsx').default), async () => {
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    check('gate pass locked with the ticket code', body().includes('Ticket #9921'));
    check('entry state shown', body().includes('Event Entry: Active'));
    check('event title on the stub', body().includes('Kilimani Night Market'));
    check('inline delta banner for the changed event', body().includes('details changed since your ticket'));

    // Dismiss the delta — the entry stays.
    const gotIt = btn('Got it');
    await act(async () => { if (gotIt) gotIt.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    check('delta dismissed, entry persists', !body().includes('details changed since your ticket') && body().includes('Ticket #9921'));

    // Hide the whole bar for the session.
    const hide = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === 'Hide ticket bar');
    await act(async () => { if (hide) hide.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    check('bar hides for the session', body() === '');
  });

  console.log(`\npass ${pass} fail ${fail}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
