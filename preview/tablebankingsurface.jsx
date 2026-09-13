// ---------------------------------------------------------------------------
// TABLE BANKING SURFACE SUITE — the indicators behind the table-banking door.
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
const { TableBankingSurface } = require('./src/features/you/TableBankingSurface.tsx');

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

const groupRow = {
  id: 'chm_1', name: 'Kiama Circle', ownerId: 'u1', contributionAmount: 5000, welfareContributionAmount: 500, currency: 'KES', cycleDays: 30, status: 'active',
  members: [{ userId: 'u1', joinedAt: '2026-01-01T00:00:00Z' }, { userId: 'u2', joinedAt: '2026-01-02T00:00:00Z' }],
  summary: {
    id: 'chm_1', name: 'Kiama Circle', contributionAmount: 5000, welfareContributionAmount: 500, currency: 'KES', members: 2,
    cashOnHand: 10000, totalContributed: 10000, totalPaidOut: 0, loanedOut: 0, totalRepaid: 0,
    nextRecipient: 'u1', nextRecipientName: 'Alice', membersNotYetContributed: [], membersNotYetReceived: ['u1', 'u2'],
    activeLoans: [], note: 'derived'
  }
};

const welfareFund = {
  tableBankingId: 'chm_1', totalContributed: 1000, paidOut: 0, balance: 1000,
  claimCount: 1, pendingClaims: 1,
  note: "The welfare fund is the group's own earmarked money. Brief holds none of it."
};
const welfareClaims = [
  { id: 'wc_1', tableBankingId: 'chm_1', claimantId: 'u2', reason: 'Bereavement support', amount: 600, status: 'pending', votes: [], createdAt: '2026-01-05T00:00:00Z', updatedAt: '2026-01-05T00:00:00Z' }
];
const minutesList = [
  { id: 'mn_1', tableBankingId: 'chm_1', authorId: 'u1', title: 'June 14 meeting', body: 'Agreed the rotation.', decisions: ['Advance the turn'], actionItems: null, heldAt: '2026-06-14T00:00:00Z', createdAt: '2026-06-14T00:00:00Z' }
];

let fetchHandler;
let collectiveOrders = [];
global.fetch = async (input, init) => fetchHandler(String(input?.url ?? input ?? ''), init);

async function main() {
  // --- signed out ---
  fetchHandler = async (url) => {
    if (url.includes('/me/table-banking')) return { ok: false, status: 401, text: async () => JSON.stringify({ error: 'authentication required' }) };
    return { ok: false, status: 401, text: async () => JSON.stringify({ error: 'x' }) };
  };
  {
    const { container } = mount(React.createElement(TableBankingSurface, { onRequireAuth: () => {} }));
    await flush();
    assert.ok(text(container).includes('Sign in to see your Circles'));
  }
  pass('TableBankingSurface: signed-out state');

  // --- empty (no group) ---
  fetchHandler = async (url) => {
    if (url.includes('/me/table-banking')) return { ok: true, status: 200, text: async () => JSON.stringify({ groups: [] }) };
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(TableBankingSurface, { onRequireAuth: () => {} }));
    await flush();
    const t = text(container);
    assert.ok(t.includes('You belong to no Circle yet'));
    assert.ok(t.includes('not a directory'), 'states Brief is not a directory');
    assert.ok(btn('Start a group'), 'start-a-group action present');
  }
  pass('TableBankingSurface: honest empty state with a start-a-group action');

  // --- start-a-group flow (templates) ---
  fetchHandler = async (url) => {
    if (url.includes('/me/table-banking')) return { ok: true, status: 200, text: async () => JSON.stringify({ groups: [] }) };
    if (url.includes('/templates')) return { ok: true, status: 200, text: async () => JSON.stringify({ templates: [
      { id: 'merry_go_round', label: 'Merry-Go-Round', description: 'A simple rotation', defaults: { contributionAmount: 1000, welfareContributionAmount: 0, cycleDays: 30, latePenaltyKes: 0 } },
      { id: 'welfare_first', label: 'Welfare First', description: 'Smaller rotation with a pot', defaults: { contributionAmount: 1000, welfareContributionAmount: 500, cycleDays: 30, latePenaltyKes: 0 } }
    ] }) };
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(TableBankingSurface, { onRequireAuth: () => {} }));
    await flush();
    act(() => { btn('Start a group').click(); });
    await flush();
    const t = text(container);
    assert.ok(t.includes('Merry-Go-Round'), 'template label renders');
    assert.ok(t.includes('Welfare First'), 'second template renders');
    assert.ok(t.includes('welfare KES 500'), 'template welfare default shown');
    assert.ok(btn('Create'), 'create action present');
  }
  pass('TableBankingSurface: start-a-group flow shows templates');
  pass('TableBankingSurface: honest empty state, not a directory');

  // --- indicators ---
  fetchHandler = async (url, init) => {
    if (url.includes('/me/table-banking')) return { ok: true, status: 200, text: async () => JSON.stringify({ groups: [groupRow] }) };
    if (url.includes('/api/table-banking/chm_1/requests')) {
      // Collective orders: empty by default, or the sample after a POST.
      return { ok: true, status: 200, text: async () => JSON.stringify({ collective: collectiveOrders }) };
    }
    if (url.includes('/welfare')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ fund: welfareFund, claims: welfareClaims }) };
    }
    if (url.includes('/minutes')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ minutes: minutesList }) };
    }
    if (url.includes('/invites')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ invites: [] }) };
    }
    if (url.includes('/quotes')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ quotes: [
        { quoteId: 'q_1', requestId: 'r_1', requestTitle: 'Fertilizer bulk buy', requesterId: 'u1', status: 'submitted', vote: { approveCount: 1, declineCount: 0, total: 1 }, quorum: 2 }
      ] }) };
    }
    if (url.includes('/treasurer')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ dashboard: {
        group: { id: 'chm_1', name: 'Kiama Circle' },
        summary: { ...groupRow.summary, cashOnHand: 10000 },
        rotation: { currentMemberId: 'u1', nextMemberId: 'u2', order: [ { userId: 'u1', handle: 'alice', displayName: 'Alice', isCurrent: true, received: false }, { userId: 'u2', handle: 'bob', displayName: 'Bob', isCurrent: false, received: false } ] },
        members: [ { userId: 'u1', handle: 'alice', displayName: 'Alice', contributed: true, received: false, owesKes: 0 }, { userId: 'u2', handle: 'bob', displayName: 'Bob', contributed: false, received: false, owesKes: 0 } ],
        activeLoans: [],
        welfare: { ...welfareFund },
        pendingInvites: 1,
        note: 'derived'
      } }) };
    }
    if (url.includes('/api/table-banking/chm_1') && (!init?.method || init.method === 'GET')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({
        group: groupRow,
        summary: groupRow.summary,
        rotation: {
          order: [
            { userId: 'u1', handle: 'alice', displayName: 'Alice', isCurrent: true, received: false },
            { userId: 'u2', handle: 'bob', displayName: 'Bob', isCurrent: false, received: false }
          ],
          currentIndex: 0, currentMemberId: 'u1', nextMemberId: 'u2', note: 'deterministic'
        },
        me: { memberId: 'u1', contributedKes: 5000, contributedCount: 1, receivedKes: 0, isNext: true, owesKes: 0, loans: [] }
      }) };
    }
    if (url.includes('/contributions')) {
      return { ok: true, status: 201, text: async () => JSON.stringify({ contribution: { id: 'c1' }, summary: { ...groupRow.summary, cashOnHand: 15000 } }) };
    }
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(TableBankingSurface, { onRequireAuth: () => {} }));
    await flush();
    let t = text(container);
    assert.ok(t.includes('Kiama Circle'), 'group name');
    assert.ok(t.includes('cash on hand'), 'cash indicator');
    assert.ok(t.includes('next to receive'), 'next-recipient indicator');
    assert.ok(t.includes('Alice'), 'next recipient name');
    // Open indicators.
    act(() => { btn('Indicators').click(); });
    await flush();
    t = text(container);
    assert.ok(t.includes('Your position'), 'your-position indicator');
    assert.ok(t.includes('Your turn next'), 'isNext indicator');
    assert.ok(t.includes('Contributed KES 5,000'), 'contributed indicator');
    assert.ok(t.includes('Rotation'), 'rotation list');
    assert.ok(t.includes('Alice'), 'rotation member');
    // The record-contribution action is present.
    assert.ok(btn('Record contribution'), 'contribution action present');
    // Collective orders: the section + place-bulk-order action are present.
    assert.ok(t.includes('Collective orders'), 'collective orders section');
    assert.ok(t.includes('No collective orders yet'), 'honest empty collective state');
    assert.ok(btn('Place bulk order'), 'place bulk order action present');
    // Welfare fund: the derived pot, the pending claim, and vote + file actions.
    assert.ok(t.includes('Welfare fund'), 'welfare fund section');
    assert.ok(t.includes('in the pot'), 'welfare balance indicator');
    assert.ok(t.includes('Bereavement support'), 'pending claim reason');
    assert.ok(btn('Approve') && btn('Decline'), 'claim vote actions present');
    assert.ok(btn('File a claim'), 'file-a-claim action present');
    assert.ok(btn('Record welfare contribution (KES 500)'), 'welfare contribution action shows the configured amount');
    // Meeting minutes: the group's own record of decisions.
    assert.ok(t.includes('Minutes'), 'minutes section');
    assert.ok(t.includes('June 14 meeting'), 'minutes title');
    assert.ok(t.includes('Advance the turn'), 'minutes decisions');
    assert.ok(btn('Record minutes'), 'record-minutes action present');
    assert.ok(btn('Export PDF'), 'export-pdf action present');
    // Add members: the invite-by-phone flow.
    assert.ok(t.includes('Add members'), 'add-members section');
    assert.ok(btn('Invite a member'), 'invite-a-member action present');
    // Group quotes: the group votes on which quote to accept.
    assert.ok(t.includes('Group quotes'), 'group-quotes section');
    assert.ok(t.includes('Fertilizer bulk buy'), 'quote request title');
    assert.ok(t.includes('needs 2 to accept'), 'quorum shown');
    // Treasurer dashboard: the owner's derived view.
    act(() => { btn('Treasurer dashboard').click(); });
    await flush();
    const t2 = text(container);
    assert.ok(t2.includes('Pool'), 'treasurer pool shown');
    assert.ok(t2.includes('not contributed'), 'treasurer member status shown');
  }
  pass('TableBankingSurface: indicators show what can happen and what did happen');

  console.log('\nPASS ' + count);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
