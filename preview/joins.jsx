// ---------------------------------------------------------------------------
// COMPLETED LOOPS
//
// A loop is only finished when a person can walk it end to end. Three of them
// were half-built, and each half looked like a feature:
//
//   1. CIRCLES. The list showed every circle in the deployment under the
//      heading "communities you are part of", with no way in and no way out.
//      Joining an open circle was legal on the server; the client never
//      offered it. Leaving was impossible everywhere -- there was no route.
//
//   2. THE INBOX. Eighteen tools each held their own badge, so "is anything
//      waiting for me?" had no answer. The queue answers it in one list.
//
//   3. SUBSCRIPTIONS. A creator could publish a plan and bill themselves for
//      it; nobody could ever JOIN one. The follower's half did not exist.
//
// These checks drive the real components against a mock server that behaves
// like the real one -- including its refusals, because a loop that only works
// on the happy path is still broken for the person who hits the refusal.
// ---------------------------------------------------------------------------
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>',
  { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement; global.Element = dom.window.Element; global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent; global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const { Circles } = require('./src/components/Circles.tsx');
const { TriageQueue } = require('./src/components/TriageQueue.tsx');
const { SubscriptionsPanel } = require('./src/components/CreatorPanels.tsx');

let pass = 0, fail = 0;
const check = (n, c, d = '') => {
  if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); }
};

// --- mock server ------------------------------------------------------------

const circle = (id, name, over = {}) => ({
  id, name, description: '', type: 'treasury', status: 'active',
  visibility: 'invite_only', sourceId: null, goal: null, targetValue: null,
  deadline: null, completionCriteria: null, parentCircleId: null,
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
  currentValue: 0, contributorCount: 0, progressPct: null, settledCount: 0,
  blockCount: 0, memberCount: 1,
  viewerRole: null, isMember: false, canJoin: false,
  ...over
});

let state;
const reset = () => {
  state = {
    circles: [
      circle('circ_mine', 'Kilimani Traders', { viewerRole: 'coordinator', isMember: true, canJoin: true, memberCount: 3 }),
      circle('circ_open', 'Ngong Trail Crew', { visibility: 'open', canJoin: true, memberCount: 4 }),
      circle('circ_shut', 'Closed Crew', { canJoin: false, memberCount: 2 })
    ],
    // Ordered exactly as the server orders it: an event already running
    // floats above an event starting soon, and everything else follows by how
    // long it has waited. The client renders this order as given.
    queue: {
      items: [
        { kind: 'checkin', id: 'cmp_1', campaignId: 'cmp_1', status: 'open',
          title: 'Sunrise run', detail: '2026-08-28T06:00:00.000Z', at: '2026-08-28T06:00:00.000Z',
          daysWaiting: 0, pending: 3, checkedIn: 1, actions: ['checkin'] },
        { kind: 'task', id: 'blk_1', circleId: 'circ_mine', circleName: 'Kilimani Traders',
          status: 'assigned', title: 'Repair the market gate', detail: 'Hinges are rusted',
          at: '2026-08-20T09:00:00.000Z', daysWaiting: 4, actions: ['complete', 'release'] },
        { kind: 'order', id: 'ord_1', vendorId: 'vnd_1', vendorName: 'Queue Foods',
          status: 'ordered', nextStatus: 'accepted', title: '2 × Roasted maize',
          detail: 'Ordered by usr_buyer · 200 KES', at: '2026-08-25T09:00:00.000Z',
          daysWaiting: 1, actions: ['advance'] },
        { kind: 'draft', id: 'raw_1', sourceId: 'src_1', sourceName: 'Kilimani WhatsApp',
          channel: 'whatsapp', title: 'Power is back on Ngong Road', detail: '',
          at: '2026-08-27T09:00:00.000Z', daysWaiting: 1, actions: ['review'] }
      ],
      counts: { task: 1, order: 1, checkin: 1, draft: 1 },
      total: 4, viewer: 'usr_me', withinHours: 48
    },
    plans: [
      { id: 'sub_1', creatorId: 'usr_creator', title: 'Trail Club', description: '',
        price: 500, currency: 'KES', interval: 'monthly', status: 'active',
        createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
        subscriberCount: 0, settledCycles: 0, collected: 0, viewerIsSubscriber: false }
    ],
    myPlans: [],
    calls: [],
    refuse: null,
    queueFails: false
  };
};
reset();

const ok = (b, status = 200) => ({ ok: true, status, text: async () => JSON.stringify(b), json: async () => b });
const err = (status, message) => ({
  ok: false, status,
  text: async () => JSON.stringify({ error: message }),
  json: async () => ({ error: message })
});

global.fetch = async (url, init) => {
  const u = String(url);
  const method = init?.method ?? 'GET';
  const body = init?.body ? JSON.parse(init.body) : null;
  state.calls.push(`${method} ${u.replace(/^.*\/ingest/, '')}`);

  if (state.refuse && u.includes(state.refuse.match)) {
    return err(state.refuse.status, state.refuse.message);
  }

  // ---- the waiting-on-you queue -------------------------------------------
  if (u.includes('/api/triage')) {
    if (state.queueFails) return err(503, 'the queue could not be read');
    return ok(state.queue);
  }

  // ---- circles: join / leave ----------------------------------------------
  const leave = u.match(/\/api\/circles\/([^/]+)\/members\/me$/);
  if (leave && method === 'DELETE') {
    const c = state.circles.find((x) => x.id === leave[1]);
    if (!c || !c.isMember) return err(404, 'you are not a member of this circle');
    c.isMember = false; c.viewerRole = null;
    c.memberCount = Math.max(0, c.memberCount - 1);
    return ok({ left: true, circleId: c.id, userId: 'usr_me' });
  }

  const join = u.match(/\/api\/circles\/([^/]+)\/members$/);
  if (join && method === 'POST') {
    const c = state.circles.find((x) => x.id === join[1]);
    if (!c) return err(404, 'circle not found');
    // The real server refuses a self-join to a closed circle that has members.
    if (!c.canJoin) return err(403, 'this circle is invite only');
    // A body-supplied userId is not how you join: the caller's identity is used.
    if (body && body.userId && body.userId !== 'usr_me') return err(403, 'only a coordinator of this circle may add another user');
    c.isMember = true; c.viewerRole = 'contributor';
    c.memberCount += 1;
    return ok({ member: { id: 'memb_new', circleId: c.id, userId: 'usr_me', role: 'contributor',
      verifications: [], joinedAt: '2026-08-28T00:00:00.000Z', updatedAt: '2026-08-28T00:00:00.000Z',
      trust: { evidence: [], verifiedCount: 0, facts: [] } } }, 201);
  }

  // A full block row, because the client validates the response the same way
  // it validates a read: a stub that returns { id } would be rejected as an
  // unexpected shape, and the suite would be testing the wrong thing.
  const taskBlock = (task) => ({
    id: 'blk_1', circleId: 'circ_mine', objectId: null, type: 'task',
    content: 'Repair the market gate', weight: 0, validatedBy: null,
    metadata: { task }, createdAt: '2026-08-20T09:00:00.000Z',
    updatedAt: '2026-08-26T09:00:00.000Z', object: null, sources: [], task
  });

  if (u.match(/\/api\/circles\/[^/]+\/blocks\/[^/]+\/complete$/)) {
    state.queue = { ...state.queue, items: state.queue.items.filter((i) => i.id !== 'blk_1'),
      counts: { ...state.queue.counts, task: 0 }, total: state.queue.total - 1 };
    return ok({ block: taskBlock({ status: 'completed', assigneeId: 'usr_me',
      completedAt: '2026-08-28T00:00:00.000Z', completedBy: 'usr_me' }), changed: true });
  }

  if (u.match(/\/api\/circles\/[^/]+\/blocks\/[^/]+\/release$/)) {
    const item = state.queue.items.find((i) => i.id === 'blk_1');
    if (item) { item.status = 'open'; item.actions = ['assign']; }
    return ok({ block: taskBlock({ status: 'open', assigneeId: null,
      completedAt: null, completedBy: null }), changed: true });
  }

  if (u.includes('/api/circles') && u.includes('/members')) return ok({ members: [] });
  if (u.match(/\/api\/circles\/[^/]+$/)) {
    const c = state.circles.find((x) => x.id === u.split('/').pop());
    return ok({ circle: c ?? state.circles[0], blocks: [], signals: [] });
  }
  if (u.includes('/api/circles')) return ok({ circles: state.circles });

  // ---- subscriptions: the follower's half ---------------------------------
  const subJoin = u.match(/\/api\/subscriptions\/([^/]+)\/subscribe$/);
  if (subJoin && method === 'POST') {
    const plan = state.plans.find((p) => p.id === subJoin[1]);
    if (!plan) return err(404, 'subscription not found');
    if (plan.status !== 'active') return err(400, 'this plan is not open');
    if (plan.viewerIsSubscriber) {
      return ok({
        subscriber: { id: 'subm_1', subscriptionId: plan.id, memberId: 'usr_me', status: 'active',
          startedAt: '2026-08-01T00:00:00.000Z', endedAt: null },
        transaction: null, duplicate: true, charged: false,
        note: 'You are already a member of this plan.'
      });
    }
    plan.viewerIsSubscriber = true;
    plan.subscriberCount += 1;
    return ok({
      subscriber: { id: 'subm_1', subscriptionId: plan.id, memberId: 'usr_me', status: 'active',
        startedAt: '2026-08-28T00:00:00.000Z', endedAt: null },
      transaction: { id: 'txn_1', status: 'created', amount: plan.price },
      duplicate: false, charged: false,
      note: 'Membership recorded. No payment provider is connected, so this cycle is recorded, not charged.'
    }, 201);
  }

  const subLeave = u.match(/\/api\/subscriptions\/([^/]+)\/unsubscribe$/);
  if (subLeave && method === 'POST') {
    const plan = state.plans.find((p) => p.id === subLeave[1]);
    if (!plan || !plan.viewerIsSubscriber) return err(400, 'you are not subscribed to this plan');
    plan.viewerIsSubscriber = false;
    plan.subscriberCount = Math.max(0, plan.subscriberCount - 1);
    return ok({
      subscriber: { id: 'subm_1', subscriptionId: plan.id, memberId: 'usr_me', status: 'cancelled',
        startedAt: '2026-08-01T00:00:00.000Z', endedAt: '2026-08-28T00:00:00.000Z' },
      changed: true
    });
  }

  if (u.includes('/api/subscriptions') && u.includes('browse=1')) return ok({ subscriptions: state.plans });
  if (u.includes('/api/subscriptions') && method === 'GET') return ok({ subscriptions: state.myPlans });

  return err(404, 'not found');
};
dom.window.fetch = global.fetch;

// --- harness ---------------------------------------------------------------

async function main() {
  const root = createRoot(document.getElementById('root'));
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const body = () => text(document.body);
  const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 10)); }); };
  const click = async (el) => {
    if (!el) throw new Error('click target not found');
    await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
    await settle();
  };
  const buttons = () => Array.from(document.querySelectorAll('button'));
  const btn = (t) => buttons().find((b) => text(b) === t || text(b).startsWith(t));
  const mount = async (component, props = {}) => {
    await act(async () => { root.render(null); });
    await act(async () => { root.render(React.createElement(component, props)); });
    await settle();
  };

  // =========================================================================
  console.log('=== 1. CIRCLES: THE LIST NO LONGER CLAIMS YOU ARE A MEMBER ===');
  // =========================================================================
  reset();
  await mount(Circles);
  let b = body();
  check('a circle you are in is listed as yours',
    /Circles you are in \(1\)/.test(b) && /Kilimani Traders/.test(b), b.slice(0, 160));
  check('a circle you are NOT in is not listed as yours',
    /Open to join \(1\)/.test(b) && /Invite only \(1\)/.test(b), b.slice(0, 200));
  check('the old blanket claim is gone', !/Communities you are part of/.test(b));
  check('an open circle offers a way in', !!btn('Join'));
  check('an invite-only circle offers no join button',
    /Invite only \(1\)/.test(b) && !/Invite only — a coordinator has to add you[\s\S]*?Join/.test(b));

  console.log('\n=== 2. JOINING ===');
  state.calls = [];
  await click(btn('Join'));
  b = body();
  check('joining posts to the membership route',
    state.calls.some((c) => c === 'POST /api/circles/circ_open/members'), state.calls.join(' | '));
  check('the joined circle moves into the list you are in',
    /Circles you are in \(2\)/.test(b), b.slice(0, 200));
  check('it is no longer offered as something to join',
    !/Open to join \(1\)/.test(b), b.slice(0, 200));
  check('joining is reported', /You have joined this circle/.test(b));

  console.log('\n=== 3. A REFUSED JOIN IS SHOWN, NOT SWALLOWED ===');
  reset();
  await mount(Circles);
  // Ask the mock to refuse every join the way the server refuses a closed one.
  state.refuse = { match: '/members', status: 403, message: 'this circle is invite only' };
  await click(btn('Join'));
  b = body();
  check('the server\'s reason is displayed', /this circle is invite only/.test(b), b.slice(0, 200));
  check('the circle did not move into the list you are in',
    /Circles you are in \(1\)/.test(b), b.slice(0, 200));
  state.refuse = null;

  console.log('\n=== 4. LEAVING ===');
  reset();
  await mount(Circles);
  state.calls = [];
  await click(btn('Leave'));
  b = body();
  check('leaving calls the leave route',
    state.calls.some((c) => c === 'DELETE /api/circles/circ_mine/members/me'), state.calls.join(' | '));
  check('the circle leaves the list you are in', !/Circles you are in/.test(b), b.slice(0, 200));
  check('leaving is reported', /You have left this circle/.test(b));
  check('with nothing joined, the surface says so',
    /You are not part of any Circle yet/.test(b), b.slice(0, 240));

  console.log('\n=== 5. STARTING A CIRCLE IS PART OF THE SAME LOOP ===');
  reset();
  await mount(Circles);
  check('there is a way to start one', !!btn('Start a circle'));
  await click(btn('Start a circle'));
  const placeholders = () => Array.from(document.querySelectorAll('input')).map((i) => i.placeholder);
  check('and it asks only for what it needs',
    placeholders().includes('Circle name') && placeholders().includes('What is it for? (optional)'),
    placeholders().join(' | '));

  // =========================================================================
  console.log('\n=== 6. THE QUEUE HOLDS EVERY KIND OF WAITING WORK ===');
  // =========================================================================
  reset();
  await mount(TriageQueue, { onOpenSection: () => {}, onNotice: () => {} });
  b = body();
  check('a task you hold is in the queue', /Repair the market gate/.test(b));
  check('it says which circle it belongs to', /Kilimani Traders/.test(b));
  check('an order on your shelf is in the queue', /Roasted maize/.test(b));
  check('an event you are running is in the queue', /Sunrise run/.test(b));
  check('a message awaiting review is in the queue', /Power is back on Ngong Road/.test(b));
  check('the counts are stated, not implied', /3 still to check in · 1 checked in/.test(b), b.slice(0, 300));
  check('time-boxed work is first', b.indexOf('Sunrise run') < b.indexOf('Repair the market gate'));
  check('the button names the next real step', !!btn('Mark accepted'), body().slice(0, 200));

  console.log('\n=== 7. ACTING ON THE QUEUE ===');
  state.calls = [];
  await click(btn('Mark done'));
  b = body();
  check('completing posts to the task route',
    state.calls.some((c) => c === 'POST /api/circles/circ_mine/blocks/blk_1/complete'), state.calls.join(' | '));
  check('the item leaves because the work is done, not because it was hidden',
    !/Repair the market gate/.test(b), b.slice(0, 200));
  check('the rest of the queue is untouched', /Roasted maize/.test(b) && /Sunrise run/.test(b));

  console.log('\n=== 8. A REFUSAL KEEPS THE ITEM IN THE QUEUE ===');
  reset();
  await mount(TriageQueue, { onOpenSection: () => {}, onNotice: () => {} });
  state.refuse = { match: '/complete', status: 403, message: 'only the assignee may complete this task' };
  await click(btn('Mark done'));
  b = body();
  check('the server\'s reason is shown', /only the assignee may complete this task/.test(b), b.slice(0, 220));
  check('the item is still in the queue', /Repair the market gate/.test(b));
  state.refuse = null;

  console.log('\n=== 9. AN EMPTY QUEUE IS EMPTY, AN UNREADABLE ONE SAYS SO, AND SIGNED-OUT IS NEITHER ===');
  reset();
  state.queue = { items: [], counts: { task: 0, order: 0, checkin: 0, draft: 0 }, total: 0, viewer: 'usr_me', withinHours: 48 };
  await mount(TriageQueue, { onOpenSection: () => {}, onNotice: () => {} });
  b = body();
  check('nothing waiting is reported as nothing waiting', /Nothing is waiting on you/.test(b), b.slice(0, 160));
  check('and is not padded with suggestions', !/Try one of these|Suggested|You could/.test(b));

  reset();
  state.queueFails = true;
  await mount(TriageQueue, { onOpenSection: () => {}, onNotice: () => {} });
  b = body();
  check('an unreachable queue is NOT rendered as an empty one', !/Nothing is waiting on you/.test(b), b.slice(0, 160));
  check('it says it could not be read', /could not be read/i.test(b), b.slice(0, 200));
  state.queueFails = false;

  // Signed out is a third fact: nobody is signed in, so there is no "you" for
  // the queue to be about. It must not be dresssed up as an outage.
  reset();
  state.refuse = { match: '/api/triage', status: 401, message: 'authentication required' };
  await mount(TriageQueue, { onOpenSection: () => {}, onNotice: () => {} });
  b = body();
  check('a signed-out visitor is asked to sign in, not told the queue broke',
    /Sign in to see what is waiting/.test(b), b.slice(0, 200));
  check('and is not shown an empty queue', !/Nothing is waiting on you/.test(b));
  check('and is not shown an outage', !/could not be read/i.test(b));
  state.refuse = null;

  // =========================================================================
  console.log('\n=== 10. SUBSCRIPTIONS: THE FOLLOWER\'S HALF ===');
  // =========================================================================
  reset();
  await mount(SubscriptionsPanel);
  check('the panel offers the side that was missing', !!btn('Plans I can join'));
  await click(btn('Plans I can join'));
  b = body();
  check('public plans are listed', /Trail Club/.test(b), b.slice(0, 200));
  check('the member count is derived and stated', /0 members/.test(b), b.slice(0, 240));
  check('there is a way to join', !!btn('Join'));

  state.calls = [];
  await click(btn('Join'));
  b = body();
  check('joining posts to the subscribe route',
    state.calls.some((c) => c === 'POST /api/subscriptions/sub_1/subscribe'), state.calls.join(' | '));
  check('THE MONEY IS NOT COLLECTED and the surface says so',
    /recorded, not charged|not charged/i.test(b), b.slice(0, 300));
  check('the count came from the server, not from a local guess', /1 member/.test(b), b.slice(0, 300));
  check('the button becomes a way out', !!btn('Subscribed — leave'));

  await click(btn('Subscribed — leave'));
  b = body();
  check('leaving is offered too', /You have left this plan/.test(b), b.slice(0, 200));
  check('and the count drops', /0 members/.test(b), b.slice(0, 240));

  console.log('\n=== 11. A REFUSED JOIN IS REPORTED ===');
  reset();
  await mount(SubscriptionsPanel);
  await click(btn('Plans I can join'));
  state.refuse = { match: '/subscribe', status: 400, message: 'this plan is not open' };
  await click(btn('Join'));
  check('the reason is shown', /this plan is not open/.test(body()), body().slice(0, 200));
  check('no membership was claimed', !/Subscribed — leave/.test(body()));
  state.refuse = null;

  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
