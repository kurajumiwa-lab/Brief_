// ---------------------------------------------------------------------------
// FIRST-RUN CHECKLIST — the new member's first session as an action queue.
// Every step is DERIVED from real rows: a step is "done" because the data says
// so, never because a client flipped a flag. This pins the derivation.
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
const { deriveChecklist, FirstRunChecklist } = require('./src/features/you/FirstRunChecklist.tsx');

let count = 0;
const pass = (name) => { count++; console.log('PASS ' + name); };
const noop = () => {};
const actions = { onStartGroup: noop, onAddMembers: noop, onRecordContribution: noop, onSeeLedger: noop };

const group = (over = {}) => ({
  id: 'g1', name: 'Kilimani Circle', ownerId: 'u1', contributionAmount: 5000,
  welfareContributionAmount: 0, currency: 'KES', cycleDays: 30, status: 'active',
  members: [{ userId: 'u1', joinedAt: '2026-01-01T00:00:00Z' }],
  summary: { id: 'g1', name: 'Kilimani Circle', contributionAmount: 5000, welfareContributionAmount: 0, currency: 'KES', members: 1, cashOnHand: 0, totalContributed: 0, totalPaidOut: 0, loanedOut: 0, totalRepaid: 0, nextRecipient: 'u1', nextRecipientName: 'Alice', membersNotYetContributed: ['u1'], membersNotYetReceived: ['u1'], activeLoans: [], note: 'derived' },
  ...over
});

function mount(el) {
  document.body.innerHTML = '';
  const c = document.createElement('div');
  document.body.appendChild(c);
  const root = createRoot(c);
  act(() => root.render(el));
  return { container: c, root };
}
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

async function main() {
  // --- zero groups: only "start your group" is pending ---
  {
    const steps = deriveChecklist([], actions);
    assert.equal(steps.length, 4);
    assert.equal(steps[0].done, false, 'start not done with no group');
    assert.equal(steps[1].done, false);
    assert.equal(steps[2].done, false);
    assert.equal(steps[3].done, false);
  }
  pass('an empty list leaves all four steps pending');

  // --- a group with one member, no contribution ---
  {
    const steps = deriveChecklist([group()], actions);
    assert.equal(steps[0].done, true, 'start done once a group exists');
    assert.equal(steps[1].done, false, 'one member is not "members added"');
    assert.equal(steps[2].done, false, 'no contribution yet');
    assert.equal(steps[3].done, false, 'ledger has no rows yet');
  }
  pass('a single-member group with no contribution: only step 1 is done');

  // --- a full group with a contribution ---
  {
    const steps = deriveChecklist([group({ members: [{ userId: 'u1', joinedAt: '' }, { userId: 'u2', joinedAt: '' }], summary: { ...group().summary, totalContributed: 10000 } })], actions);
    assert.equal(steps[1].done, true, 'two members counts as members added');
    assert.equal(steps[2].done, true, 'contribution recorded');
    assert.equal(steps[3].done, true, 'ledger has rows to show');
    assert.equal(steps.every((s) => s.done), true, 'all done');
  }
  pass('a group with members and a contribution completes the checklist');

  // --- the compact card disappears when everything is done ---
  {
    const full = group({ members: [{ userId: 'u1', joinedAt: '' }, { userId: 'u2', joinedAt: '' }], summary: { ...group().summary, totalContributed: 10000 } });
    const { container } = mount(React.createElement(FirstRunChecklist, { compact: true, groups: [full], ...actions }));
    assert.equal(container.textContent.trim(), '', 'compact checklist renders nothing when complete');
  }
  pass('the compact checklist hides once every step is done');

  // --- the full checklist renders progress and the pending steps ---
  {
    const { container } = mount(React.createElement(FirstRunChecklist, { groups: [], ...actions }));
    const t = text(container);
    assert.ok(t.includes('Start your group'), 'step 1 label');
    assert.ok(t.includes('Add members'), 'step 2 label');
    assert.ok(t.includes('Record your first contribution'), 'step 3 label');
    assert.ok(t.includes('See your ledger'), 'step 4 label');
    assert.ok(t.includes('0 of 4 done'), 'honest progress count');
  }
  pass('the full checklist shows all four steps and an honest progress count');

  console.log('\nPASS ' + count);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
