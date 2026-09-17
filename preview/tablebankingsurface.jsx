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

// The operator read, as the server sends it: the pool, the group's own demand,
// what settled (here in TWO currencies, so no single total exists), and a scope
// note instead of member businesses.
let opsFixture = {
  id: 'chm_1', name: 'Kiama Circle', status: 'active', currency: 'KES', cycleDays: 30, members: 2,
  callerRole: 'member',
  pool: {
    cashOnHand: 10000, totalContributed: 10000, totalPaidOut: 0, loanedOut: 0, totalRepaid: 0,
    perCycle: 5000, welfarePerCycle: 500, activeLoans: 0, outstandingLoansKes: 0,
    nextRecipientName: 'Alice', notYetContributed: 0, notYetReceived: 2
  },
  collective: {
    placed: 2, open: 1, quoted: 1, accepted: 1, byStatus: { matching: 1, completed: 1 }, windowDays: 90,
    items: [
      { requestId: 'r_1', placedAt: '2026-06-01T00:00:00Z', title: 'Fertilizer bulk buy', status: 'matching', open: true, quantity: 40, unit: 'bag', category: 'fertilizer', location: 'Kiambu', quotes: 3, accepted: false, acceptedValueKes: null, acceptedValueCurrency: null, closedAt: null },
      { requestId: 'r_2', placedAt: '2026-05-01T00:00:00Z', title: 'Napier grass, 40 bales', status: 'completed', open: false, quantity: 40, unit: 'bale', category: 'fodder', location: 'Kiambu', quotes: 2, accepted: true, acceptedValueKes: 48000, acceptedValueCurrency: 'KES', closedAt: '2026-05-20T00:00:00Z' }
    ]
  },
  settledThroughBrief: { settlements: 2, settledKes: null, currency: null, workOrders: 2, workOrdersCompleted: 1, windowDays: 90, latestAt: '2026-05-20T00:00:00Z' },
  memberBusiness: { visible: false, reason: 'Only the group owner sees member shopfronts. Your own position is yours below, and it is not shown to other members.', rows: [] },
  unavailable: [
    { key: 'member_turnover', label: 'A member’s revenue or turnover outside the group', reason: 'a member’s orders with people other than the group are their own business' },
    { key: 'attributed_share', label: 'Share of a member’s sales that came through the group', reason: 'there is no attribution row, so any percentage would be invented' },
    { key: 'staff_hours', label: 'Staff hours or attendance at member businesses', reason: 'Brief verifies no attendance' },
    { key: 'member_rank', label: 'A ranking of members by contribution or reliability', reason: 'a grade from the ledger is a credit judgement' },
    { key: 'benchmark', label: 'What a comparable group achieves', reason: 'Brief holds no cross-group benchmark table' }
  ],
  benchmark: null,
  derivedAt: '2026-06-14T00:00:00Z',
  note: 'Every figure here is a count or a sum over rows the group itself wrote.'
};
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

  // --- empty (no group): the first-run checklist replaces the void ---
  fetchHandler = async (url) => {
    if (url.includes('/me/table-banking')) return { ok: true, status: 200, text: async () => JSON.stringify({ groups: [] }) };
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(TableBankingSurface, { onRequireAuth: () => {} }));
    await flush();
    const t = text(container);
    assert.ok(t.includes('Start your group'), 'checklist step 1');
    assert.ok(t.includes('Add members'), 'checklist step 2');
    assert.ok(t.includes('0 of 4 done'), 'honest progress');
  }
  pass('TableBankingSurface: the empty state is the first-run checklist, not a void');

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
    act(() => { btn('Start your group').click(); });
    await flush();
    const t = text(container);
    assert.ok(t.includes('Merry-Go-Round'), 'template label renders');
    assert.ok(t.includes('Welfare First'), 'second template renders');
    assert.ok(t.includes('welfare KES 500'), 'template welfare default shown');
    assert.ok(btn('Create'), 'create action present');
  }
  pass('TableBankingSurface: the checklist "Start your group" step opens the template flow');

  // --- indicators ---
  fetchHandler = async (url, init) => {
    if (url.includes('/me/table-banking')) return { ok: true, status: 200, text: async () => JSON.stringify({ groups: [groupRow] }) };
    if (url.includes('/operations')) return { ok: true, status: 200, text: async () => JSON.stringify({ operations: opsFixture }) };
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
  // --- the operator read: what the group moved, and what this view will not say ---
  {
    const { container } = mount(React.createElement(TableBankingSurface, { onRequireAuth: () => {} }));
    await flush();
    // The group's sections live behind its own disclosure, like the treasurer test.
    act(() => { btn('Indicators').click(); });
    await flush();
    act(() => { btn('Operator read').click(); });
    await flush();
    const t = text(container);
    assert.ok(t.includes('Pool KES 10,000'), 'the pool is the same number the treasurer sees');
    assert.ok(t.includes('2 placed · 1 still open · 1 with quotes · 1 accepted'), 'demand is counts of the group’s own request rows');
    assert.ok(t.includes('accepted at KES 48,000'), 'an accepted value is the offer’s own money');
    assert.ok(t.includes('no accepted offer'), 'and a request without one says so');
    assert.ok(t.includes('Settled through Brief · last 90 days'), 'the settled figure names its window');
    assert.ok(t.includes('over 2 settlements'), 'the count of settlements is honest…');
    assert.ok(t.includes('mixed currencies, so no single total is shown'), '…while the amount is refused, not summed across currencies');
    assert.ok(/—\s*over 2 settlements/.test(t), 'an unmeasurable total is a dash beside the count that is real');
    assert.ok(!/KES —/.test(t), 'and a dash is never dressed up as a KES amount');
    assert.ok(t.includes('Only the group owner sees member shopfronts'), 'scope is stated on the surface');
    assert.ok(!/top contributor|most active member|engagement/i.test(t), 'no member is graded or ranked');
    assert.ok(!/How this is derived/.test(t), 'the operator read carries no footnote');
    assert.ok(/not computable here/.test(t), 'and says the gaps exist, in one line');
    const { HowBriefWorks } = require('./src/features/you/HowBriefWorks.tsx');
    const c3 = document.createElement('div');
    document.body.appendChild(c3);
    const r3 = createRoot(c3);
    act(() => r3.render(React.createElement(HowBriefWorks, {})));
    assert.ok(/no attribution row/.test(text(c3)), 'the full reasons live on the audit page');
    assert.ok(/ranking of members by contribution/.test(text(c3)), 'including why no member is graded');
    r3.unmount(); c3.remove();
  }
  pass('TableBankingSurface: the operator read counts the group’s rows and refuses the numbers that do not exist');


  console.log('\nPASS ' + count);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
