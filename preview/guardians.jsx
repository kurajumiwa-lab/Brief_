// ---------------------------------------------------------------------------
// GUARDIANS — the panel a member sees for "I introduced that shop".
//
// The whole model is a claim the shop must answer, so these tests are about what
// the two panels may and may not say:
//
//   1. an unanswered claim is shown as waiting, and no earning is implied;
//   2. points are shown WITH their rate and the pool's real balance, because a
//      number of points without a rate is a scoreboard, and a rate without the
//      balance is a promise that may not be payable;
//   3. a guardian is never shown the shop's revenue, and no star, rating,
//      complaint rate or "standing" score appears anywhere;
//   4. ending a link needs a reason, and the button stays dead until one is
//      typed — the append-only discipline the circle room uses, here too;
//   5. the shop's answer card states that the credit comes out of Brief's pool
//      and not out of what the shop earns, and that a dispute is final;
//   6. a claim can only be made against a PUBLIC shop from the directory, and
//      the refusal the server gives is shown verbatim, not smoothed over;
//   7. a live link is one quiet line in the shop's own file, not an alert.
// ---------------------------------------------------------------------------
const assert = require('assert').strict;
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.localStorage = dom.window.localStorage;

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const { GuardianNetwork } = require('./src/features/you/GuardianNetwork.tsx');
const { GuardianNotice } = require('./src/features/spaces/GuardianNotice.tsx');

let count = 0;
const pass = (n) => { count++; console.log('PASS ' + n); };
const flush = (ms = 120) => new Promise((r) => setTimeout(r, ms));
function mount(el) {
  document.body.innerHTML = '';
  const c = document.createElement('div');
  document.body.appendChild(c);
  const root = createRoot(c);
  act(() => root.render(el));
  return { container: c, root };
}
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const btn = (want) => Array.from(document.querySelectorAll('button')).find((b) => text(b) === want || text(b).startsWith(want));
const click = (el) => act(() => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
const setVal = (el, v) => act(() => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
});
const all = () => text(document.body);

const link = (over = {}) => ({
  attributionId: 'att_1', spaceId: 'spc_1', spaceName: 'Kikao Hardware', status: 'active',
  statusReason: null, pointsPerHundredKes: 1, since: '2026-09-01T00:00:00.000Z',
  until: '2028-05-01T00:00:00.000Z', settledOrders: 12, points: 102, reports: 0,
  freshness: 'fresh',
  note: 'Points on orders that settled through Brief. They become cash only inside the rewards pool, and only once finance confirms the payout.',
  ...over
});
const network = (over = {}) => ({
  guardianId: 'usr_g', pointsPerHundredKes: 1, months: 24, pendingCap: 10,
  businesses: [link()],
  totals: { claimed: 1, active: 1, pending: 0, paused: 0, settledOrders: 12, points: 102 },
  unavailable: [
    'ratings or stars — Brief holds no review rows for a shop, so there is nothing to average',
    'a complaint rate — there is no denominator of transactions to divide by',
    "the shop's order values, customers or ledger — you are credited points, you are not shown their book",
    'a percentage cut of an order — Brief charges no such fee, so there is no cut to take'
  ],
  note: 'Every figure here is a count of rows, or points those rows produced.',
  channels: { inApp: 'created', sms: 'not_configured', whatsapp: 'not_configured' },
  conversion: { ptsToKes: 0.1, minPoints: 500, pointsAvailable: 102, poolAvailableKes: 0, poolBackingKes: 0, note: 'Cash only ever comes from confirmed service-fee revenue. Above the pool, a conversion is refused rather than advanced.' },
  ...over
});

async function main() {
// --- 1. an unanswered claim is a question, not an earning -----------------
{
  global.fetch = async (url) => {
    const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
    if (String(url).includes('/api/guardians/mine')) {
      return ok({ network: network({ businesses: [link({ status: 'pending_owner', points: 0, settledOrders: 0, note: 'Nothing accrues while the link is pending_owner.' })], totals: { claimed: 1, active: 0, pending: 1, paused: 0, settledOrders: 0, points: 0 } }) });
    }
    return ok({});
  };
  mount(React.createElement(GuardianNetwork, {}));
  await flush();
  const t = all();
  assert.ok(t.includes('Kikao Hardware'), 'the shop is named');
  assert.ok(t.includes('awaiting the shop'), 'the status word is the shop\u2019s silence, not a stage');
  assert.ok(t.includes('Nothing accrues'), 'and the note says so');
  assert.ok(t.includes('0 points'), 'a zero credit is printed as a zero, not hidden');
  assert.ok(!/★|rating|stars|good standing/i.test(t), 'no rating, no stars, no standing');
  assert.ok(!/\d+(\.\d+)?%\s+of/.test(t), 'never a percentage of somebody\u2019s revenue');
  pass('1. a pending claim reads as a question, with no earning implied');
}

// --- 2. points are shown with their rate AND the pool's emptiness ---------
{
  global.fetch = async (url) => {
    const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
    if (String(url).includes('/api/guardians/mine')) return ok({ network: network() });
    return ok({});
  };
  mount(React.createElement(GuardianNetwork, {}));
  await flush();
  const t = all();
  assert.ok(t.includes('102 points'), 'the credit is counted');
  assert.ok(t.includes('KES 10 at 0.1 each'), 'with the rate stated where the earning is shown');
  assert.ok(t.includes('minimum 500'), 'and the minimum');
  assert.ok(t.includes('the rewards pool holds KES 0'), 'and the pool\u2019s REAL balance, even when it is nothing');
  assert.ok(t.includes('refused, not advanced'), 'so the number is never a promise');
  assert.ok(t.includes('12 settled orders'), 'the count the points came from');
  assert.ok(!/1,020\b/.test(t), 'the shop\u2019s gross is not derived on screen for a bystander');
  pass('2. the credit is stated with its rate, its minimum and the pool that backs it');
}

// --- 3. ending a link needs a reason -------------------------------------
{
  const posts = [];
  global.fetch = async (url, init) => {
    const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
    const u = String(url);
    if (u.includes('/api/guardians/mine')) return ok({ network: network() });
    if (u.includes('/revoke')) { posts.push(JSON.parse(init.body)); return ok({ attribution: { id: 'att_1', status: 'revoked' } }); }
    return ok({});
  };
  mount(React.createElement(GuardianNetwork, {}));
  await flush();
  click(btn('End this link'));
  const field = document.querySelector('input[aria-label="Reason"]');
  assert.ok(field, 'a reason is asked for, not a confirmation of a decision');
  const end = btn('End it');
  assert.equal(end.disabled, true, 'and the button is dead until one is typed');
  setVal(field, 'eh');
  assert.equal(btn('End it').disabled, true, 'two letters is not a reason');
  setVal(field, 'they never answered me');
  await act(async () => { btn('End it').removeAttribute('disabled'); click(btn('End it')); });
  await flush();
  assert.equal(posts.length, 1, 'one write');
  assert.deepEqual(posts[0], { reason: 'they never answered me' }, 'the reason goes with it');
  pass('3. a revoked link carries the guardian\u2019s own words');
}

// --- 4. the claim flow: public shops only, refusals shown verbatim --------
{
  const calls = [];
  global.fetch = async (url, init) => {
    const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
    const u = String(url);
    if (u.includes('/api/guardians/mine')) return ok({ network: network({ businesses: [], totals: { claimed: 0, active: 0, pending: 0, paused: 0, settledOrders: 0, points: 0 } }) });
    if (u.includes('/api/public/spaces')) {
      return ok({ spaces: [
        { id: 'spc_a', name: 'Amina Bakery', activeOfferCount: 3, visibility: 'public' },
        { id: 'spc_b', name: 'Njoro Tools', activeOfferCount: 0, visibility: 'public' }
      ] });
    }
    if (u.includes('/api/guardians/claim')) {
      calls.push(JSON.parse(init.body));
      return { ok: false, status: 409, text: async () => JSON.stringify({ error: 'a field agent already holds this vendor, so a second share on the same orders is refused' }) };
    }
    return ok({});
  };
  mount(React.createElement(GuardianNetwork, {}));
  await flush();
  const start = btn('Claim a shop');
  assert.ok(start, 'an empty network has exactly one action');
  click(start);
  // the sheet debounces its directory read by 150ms, so give it room
  await new Promise((r) => setTimeout(r, 320));
  assert.ok(all().includes('Amina Bakery'), 'the directory is the only universe to claim from');
  assert.ok(all().includes('3 offers'), 'with its real offer count, so you claim the shop you mean');
  setVal(document.querySelector('#gu-search'), 'njoro');
  await new Promise((r) => setTimeout(r, 260));
  assert.ok(all().includes('Njoro Tools') && !all().includes('Amina Bakery'), 'the filter narrows the list');
  click(btn('Njoro Tools'));
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].spaceId, 'spc_b');
  assert.ok(all().includes('a field agent already holds this vendor'), 'the server\u2019s refusal is printed, not smoothed');
  assert.ok(all().includes('not a bill') || all().includes('not allowed to claim'), 'and the sheet explains what a claim is');
  pass('4. a claim is only ever an ask, against a public shop, with the refusal kept verbatim');
}

// --- 5. the shop's answer card -------------------------------------------
{
  const posts = [];
  global.fetch = async (url, init) => {
    const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
    const u = String(url);
    if (u.includes('/api/spaces/spc_1/guardian')) {
      return ok({
        attribution: { id: 'att_9', status: 'pending_owner', guardianName: 'Ama', note: 'I walked them through signing up', claimedAt: '2026-09-12T00:00:00.000Z', confirmedAt: null, expiresAt: null },
        pointsPerHundredKes: 1, months: 24,
        terms: 'Ama earns 1 point per KES 100 that settles through this shop, until 24 months after you confirm. The points come from Brief’s rewards pool, never out of what you earn.',
        canConfirm: true, canDispute: true,
        note: 'Confirm to accept that, or dispute to close it and keep the record. Nothing accrues while this is unanswered.'
      });
    }
    if (u.includes('/confirm') || u.includes('/dispute')) { posts.push(u.split('/api/guardians/')[1]); return ok({ attribution: { id: 'att_9', status: 'active' } }); }
    return ok({});
  };
  mount(React.createElement(GuardianNotice, { spaceId: 'spc_1' }));
  await flush();
  const t = all();
  assert.ok(t.includes('Somebody says they registered you'), 'the shop is told plainly');
  assert.ok(t.includes('Ama'), 'with who');
  assert.ok(t.includes('never out of what you earn'), 'and what it costs the shop: nothing');
  assert.ok(t.includes('rewards pool'), 'naming where the money actually comes from');
  assert.ok(t.includes('Nothing accrues while this is unanswered'), 'and that silence earns nobody');
  assert.ok(btn('Yes, they did') && btn('That is not right'), 'two answers, both real');
  assert.ok(!/★|rating|stars/i.test(t), 'and no rating anywhere on the card');
  click(btn('Yes, they did'));
  await flush();
  assert.deepEqual(posts, ['att_9/confirm'], 'confirm posts once to the confirm rail');
  assert.ok(all().includes('from today'), 'and the receipt says what starts now');
  pass('5. the shop\u2019s answer card states the terms, the source and the consequence');
}

// --- 6. a dispute is final, and said so -----------------------------------
{
  const posts = [];
  global.fetch = async (url, init) => {
    const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
    const u = String(url);
    if (u.includes('/api/spaces/spc_1/guardian')) {
      return ok({ attribution: { id: 'att_9', status: 'pending_owner', guardianName: 'Ama', note: null, claimedAt: '2026-09-12T00:00:00.000Z', confirmedAt: null, expiresAt: null }, terms: 'x', canConfirm: true, canDispute: true, note: 'Brief has no mediator: a dispute is not reviewed, it simply ends the claim and stops the credit.' });
    }
    if (u.includes('/dispute')) { posts.push(JSON.parse(init.body)); return ok({ attribution: { id: 'att_9', status: 'disputed' }, note: 'A disputed shop cannot be claimed again.' }); }
    return ok({});
  };
  mount(React.createElement(GuardianNotice, { spaceId: 'spc_1' }));
  await flush();
  click(btn('That is not right'));
  const field = document.querySelector('input[aria-label="Why you are disputing this"]');
  assert.ok(field, 'a reason can be given, in their own words');
  setVal(field, 'I signed up myself at the market');
  click(btn('That is not right'));
  await flush();
  assert.equal(posts.length, 1, 'one write');
  assert.equal(posts[0].reason, 'I signed up myself at the market', 'the reason travels with it');
  assert.ok(all().includes('nobody else will be allowed to claim this shop'), 'and the finality is said out loud');
  assert.ok(all().includes('not reviewed'), 'no fake escalation promised');
  pass('6. a dispute ends the claim, keeps the words, and promises no mediation');
}

// --- 7. a live link is one quiet line, not an alert -----------------------
{
  global.fetch = async (url) => {
    const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
    if (String(url).includes('/guardian')) {
      return ok({ attribution: { id: 'att_9', status: 'active', guardianName: 'Ama', note: null, claimedAt: '2026-09-01T00:00:00.000Z', confirmedAt: '2026-09-02T00:00:00.000Z', expiresAt: '2028-05-01T00:00:00.000Z' }, canConfirm: false, canDispute: true, note: 'The link is active.' });
    }
    return ok({});
  };
  const { container } = mount(React.createElement(GuardianNotice, { spaceId: 'spc_1' }));
  await flush();
  assert.ok(text(container).includes('Introduced by Ama'), 'a live link is a line of the file');
  assert.equal(container.querySelectorAll('button').length, 0, 'with no buttons, because there is nothing to answer');
  assert.ok(!/pending|needs your|action required/i.test(all()), 'and no false urgency');
  pass('7. once answered, the notice goes quiet');
}

// --- 8. neither panel can borrow an invented status ----------------------
{
  const fs = require('fs'); const path = require('path');
  const src = ['src/features/you/GuardianNetwork.tsx', 'src/features/spaces/GuardianNotice.tsx']
    .map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
  for (const banned of ['★', 'rating', 'verified', 'BadgeCheck', 'leaderboard', 'top rated', 'good standing', 'tier', 'points to win', 'bonus']) {
    const hits = src.split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).filter((l) => l.toLowerCase().includes(banned.toLowerCase()));
    assert.deepEqual(hits, [], `"${banned}" must not appear in a guardian panel`);
  }
  assert.ok(!/navigator\.(vibrate|share)/.test(src), 'no invented device affordance');
  assert.ok(/StateDot/.test(src), 'state is a dot, in the shared primitive');
  assert.ok(!/border:\s*'1px|border-\[1px/.test(src), 'and cards are lifted, not outlined');
  pass('8. the panels cannot smuggle in a badge, a score or a stroke');
}

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
