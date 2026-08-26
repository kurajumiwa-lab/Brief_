// ---------------------------------------------------------------------------
// CIRCLE OPERATIONS (Batch 2)
//
// The community operating loop, through the real UI:
//
//   Circle -> members -> roles -> blocks -> tasks/votes -> signals
//          -> activity/evidence -> target progress
//
// Mounts <Circles> directly with a mocked server, then drives it the way a
// member would. What is being guarded:
//
//   * task lifecycle reaches the API with the right calls
//   * vote tallies RENDER what the server computed and nothing else
//   * a tie shows no winner; an unvoted option shows a dash, not 0%
//   * trust is an evidence list -- no score anywhere on the surface
//   * role restrictions are reflected in the UI (and the server refusal is
//     surfaced verbatim when one slips through)
//   * empty circles look empty
// ---------------------------------------------------------------------------
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>',
  { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document; Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true }); // Node >=21 ships a getter-only navigator; plain assignment silently fails
global.HTMLElement = dom.window.HTMLElement; global.Element = dom.window.Element; global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent; global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const { Circles } = require('./src/components/Circles.tsx');

let pass = 0, fail = 0;
const check = (n, c, d = '') => {
  if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); }
};

// --- server state the mock serves ------------------------------------------
// Mutated by the mock's POST handlers so the UI's refetch-after-action sees
// genuinely updated data -- the same contract the real server honours.
const CIRCLE = {
  id: 'circ_1', name: 'Kilimani Traders', description: 'Neighbourhood traders.',
  type: 'treasury', status: 'active', visibility: 'invite_only', sourceId: null,
  goal: 'Shared stall fund', targetValue: 10000, deadline: null, completionCriteria: null,
  parentCircleId: null, createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
  currentValue: 2500, contributorCount: 1, progressPct: 25, settledCount: 1,
  blockCount: 4, memberCount: 3
};

const mkTask = (id, content, task) => ({
  id, circleId: 'circ_1', objectId: null, type: 'task', content,
  weight: 0, validatedBy: null, metadata: {}, createdAt: '2026-08-02T00:00:00Z',
  updatedAt: '2026-08-02T00:00:00Z', object: null, sources: [], task
});

const mkVote = (id, content, results, opts = {}) => ({
  id, circleId: 'circ_1', objectId: null, type: 'vote', content,
  weight: 0, validatedBy: null, metadata: {}, createdAt: '2026-08-02T00:00:00Z',
  updatedAt: '2026-08-02T00:00:00Z', object: null, sources: [],
  tally: {
    blockId: id, circleId: 'circ_1', closed: Boolean(opts.closed),
    totalVotes: results.reduce((a, r) => a + r.count, 0),
    eligibleCount: 3, results,
    leader: opts.leader === undefined ? null : opts.leader
  }
});

let state;
const reset = () => {
  state = {
    blocks: [
      { id: 'blk_note', circleId: 'circ_1', objectId: null, type: 'note',
        content: 'Gate code changed to 4471', weight: 0, validatedBy: null, metadata: {},
        createdAt: '2026-08-02T00:00:00Z', updatedAt: '2026-08-02T00:00:00Z',
        object: null, sources: [{ sourceId: 's1', sourceName: 'Traders WhatsApp', sourceUrl: null, sourcePublishedAt: null }] },
      mkTask('blk_task_open', 'Repair the market gate',
        { status: 'open', assigneeId: null, completedAt: null, completedBy: null }),
      mkTask('blk_task_done', 'Collect August dues',
        { status: 'completed', assigneeId: 'usr_me', completedAt: '2026-08-10T00:00:00Z', completedBy: 'usr_me' }),
      mkVote('blk_vote', 'Move market day to Sunday?',
        [{ option: 'Yes', count: 0, pct: null }, { option: 'No', count: 0, pct: null }])
    ],
    signals: [
      { id: 'sig_1', type: 'task_completed', circleId: 'circ_1', blockId: 'blk_task_done',
        sourceId: null, objectId: null, actorId: 'usr_me', value: null, metadata: {},
        createdAt: '2026-08-10T09:00:00Z', sourceName: null, circleName: 'Kilimani Traders' },
      { id: 'sig_2', type: 'member_joined', circleId: 'circ_1', blockId: null,
        sourceId: null, objectId: null, actorId: 'usr_ann', value: null, metadata: {},
        createdAt: '2026-08-05T09:00:00Z', sourceName: null, circleName: 'Kilimani Traders' }
    ],
    members: [
      { id: 'm1', circleId: 'circ_1', userId: 'usr_me', role: 'coordinator',
        verifications: ['phone_verified'], joinedAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z',
        trust: { evidence: [{ kind: 'phone_verified', label: 'Phone verified' }], verifiedCount: 1,
                 facts: [{ kind: 'member_since', label: 'Member since May 2026' }] } },
      { id: 'm2', circleId: 'circ_1', userId: 'usr_ann', role: 'contributor',
        verifications: [], joinedAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z',
        trust: { evidence: [], verifiedCount: 0, facts: [{ kind: 'member_since', label: 'Member since June 2026' }] } },
      { id: 'm3', circleId: 'circ_1', userId: 'usr_obs', role: 'observer',
        verifications: [], joinedAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
        trust: { evidence: [], verifiedCount: 0, facts: [] } }
    ],
    calls: [],
    refuse: null
  };
};
reset();

const findBlock = (id) => state.blocks.find((b) => b.id === id);

global.fetch = async (url, init) => {
  const u = String(url);
  const method = init?.method ?? 'GET';
  const body = init?.body ? JSON.parse(init.body) : null;
  state.calls.push(`${method} ${u.replace(/^.*\/ingest/, '')}`);

  const ok = (b, status = 200) => ({ ok: true, status, text: async () => JSON.stringify(b), json: async () => b });
  const err = (status, message) => ({ ok: false, status, text: async () => JSON.stringify({ error: message }), json: async () => ({ error: message }) });

  if (state.refuse && u.includes(state.refuse.match)) {
    return err(state.refuse.status, state.refuse.message);
  }

  const m = u.match(/\/api\/circles\/([^/]+)\/blocks\/([^/]+)\/(assign|release|complete|vote|close-vote)/);
  if (m) {
    const blk = findBlock(m[2]);
    if (m[3] === 'assign') {
      blk.task = { ...blk.task, status: 'assigned', assigneeId: body?.assigneeId ?? 'usr_me' };
      return ok({ block: blk, changed: true });
    }
    if (m[3] === 'release') {
      blk.task = { ...blk.task, status: 'open', assigneeId: null };
      return ok({ block: blk, changed: true });
    }
    if (m[3] === 'complete') {
      blk.task = { ...blk.task, status: 'completed', completedBy: blk.task.assigneeId, completedAt: '2026-08-18T00:00:00Z' };
      return ok({ block: blk, changed: true });
    }
    if (m[3] === 'vote') {
      const r = blk.tally.results.find((x) => x.option === body.option);
      r.count += 1;
      blk.tally.totalVotes += 1;
      for (const x of blk.tally.results) x.pct = (x.count / blk.tally.totalVotes) * 100;
      const sorted = [...blk.tally.results].sort((a, b) => b.count - a.count);
      blk.tally.leader = sorted[0].count > (sorted[1]?.count ?? -1) ? sorted[0].option : null;
      return ok({ vote: { id: 'v1', option: body.option }, tally: blk.tally }, 201);
    }
    if (m[3] === 'close-vote') {
      blk.tally.closed = true;
      return ok({ block: blk, changed: true, tally: blk.tally });
    }
  }

  const ev = u.match(/\/api\/circles\/([^/]+)\/members\/([^/]+)\/evidence/);
  if (ev) {
    if (ev[2] === 'usr_ann') return ok({ evidence: [], summary: [] });
    return ok({
      evidence: [
        { kind: 'task_completed', label: 'Completed task', circleId: 'circ_1',
          circleName: 'Kilimani Traders', blockId: 'blk_task_done', signalId: 'sig_1', at: '2026-08-10T09:00:00Z' },
        { kind: 'vote_cast', label: 'Voted', circleId: 'circ_1',
          circleName: 'Kilimani Traders', blockId: 'blk_vote', signalId: 'sig_9', at: '2026-08-11T09:00:00Z' }
      ],
      summary: [
        { kind: 'task_completed', count: 1, label: '1 completed task' },
        { kind: 'vote_cast', count: 1, label: '1 vote cast' }
      ]
    });
  }

  if (/\/api\/circles\/[^/]+\/members$/.test(u)) return ok({ members: state.members });
  if (/\/api\/circles\/[^/]+$/.test(u)) {
    const live = { ...CIRCLE, blockCount: state.blocks.length };
    return ok({ circle: live, blocks: state.blocks, signals: state.signals });
  }
  if (u.includes('/api/circles')) return ok({ circles: [CIRCLE] });
  return err(404, 'not found');
};
dom.window.fetch = global.fetch;

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
  // Unmount first: <Circles> holds openId/section in state, so re-rendering
  // into a live root would keep the previous scenario's detail view open.
  const mount = async (props = {}) => {
    await act(async () => { root.render(null); });
    await act(async () => { root.render(React.createElement(Circles, props)); });
    await settle();
  };

  // =========================================================================
  console.log('=== Circle list: server-derived target ===');
  await mount();
  let b = body();
  check('circle listed', b.includes('Kilimani Traders'));
  check('server-derived progress rendered', b.includes('25%'));
  check('progress cites settled contributions', /from 1 settled contribution/i.test(b));
  check('no invented progress', !b.includes('100%'));

  // =========================================================================
  console.log('\n=== Overview: purpose, target, blocks, recent activity ===');
  await click(btn('Open'));
  b = body();
  check('circle opened', b.includes('Kilimani Traders'));
  check('role stated plainly', /you are coordinator/i.test(b));
  check('purpose shown', b.includes('Shared stall fund'));
  check('target arithmetic from server', b.includes('2,500') && b.includes('10,000'));
  check('note block rendered', b.includes('Gate code changed'));
  check('block provenance shown', /via Traders WhatsApp/i.test(b));
  check('tasks NOT duplicated into the blocks list', !b.includes('Repair the market gate'));
  check('recent activity present on overview', /Task completed/i.test(b));

  // =========================================================================
  console.log('\n=== Tasks: the full lifecycle ===');
  await click(btn('Tasks'));
  b = body();
  check('open task listed', b.includes('Repair the market gate'));
  check('completed task listed', b.includes('Collect August dues'));
  check('status groups rendered', /Open .* 1/i.test(b) && /Completed .* 1/i.test(b));
  check('completion attributed', /Completed by usr_me/i.test(b));
  check('open task offers the action', !!btn('Take this on'));

  await click(btn('Take this on'));
  check('assign hit the real endpoint',
    state.calls.some((c) => /POST .*\/blocks\/blk_task_open\/assign/.test(c)),
    state.calls.slice(-3).join(' | '));
  b = body();
  check('task now shows as assigned to you', /Assigned to you/i.test(b));
  check('assignee may complete', !!btn('Mark complete'));
  check('assignee may release', !!btn('Release'));

  await click(btn('Mark complete'));
  check('complete hit the real endpoint',
    state.calls.some((c) => /POST .*\/blocks\/blk_task_open\/complete/.test(c)));
  b = body();
  check('two tasks now complete', /Completed .* 2/i.test(b));
  check('no open tasks remain', !/Open .* 1/i.test(b));

  // =========================================================================
  console.log('\n=== Votes: derived tally, honest absences ===');
  await click(btn('Votes'));
  b = body();
  check('vote question rendered', b.includes('Move market day to Sunday?'));
  check('turnout from real rows', /0 of 3 eligible members voted/i.test(b));
  check('unvoted option shows a dash, NOT 0%', b.includes('--') && !/0 votes . 0%/.test(b));
  check('no leader declared before any vote', !/Result:/i.test(b));
  check('every option shown even at zero', b.includes('Yes') && b.includes('No'));

  await click(btn('Vote Yes'));
  check('vote hit the real endpoint',
    state.calls.some((c) => /POST .*\/blocks\/blk_vote\/vote/.test(c)));
  b = body();
  check('tally reflects the cast ballot', /1 of 3 eligible members voted/i.test(b));
  check('percentage now shown from real total', b.includes('100%'));
  check('one member one vote enforced in UI', /You have voted/i.test(b));
  check('voting buttons withdrawn after voting', !btn('Vote Yes'));

  await click(btn('Close this vote'));
  b = body();
  check('closed vote hit the endpoint',
    state.calls.some((c) => /close-vote/.test(c)));
  check('result announced once closed', /Result: Yes/i.test(b));
  check('closed vote accepts no more ballots', !btn('Vote No'));

  // =========================================================================
  console.log('\n=== Members: evidence, never a score ===');
  await click(btn('Members'));
  b = body();
  check('members listed', b.includes('usr_me') && b.includes('usr_ann'));
  check('roles shown', b.includes('Coordinator') && b.includes('Observer'));
  check('recorded verification shown as evidence', b.includes('Phone verified'));
  check('NO trust percentage anywhere', !/\d+% trust|trust score|reliability/i.test(b));
  check('NO star rating', !/★|⭐|\bstars?\b/i.test(b));

  await click(buttons().find((x) => text(x) === 'Evidence'));
  b = body();
  check('evidence loaded from the server', /1 completed task/i.test(b));
  check('evidence lists real events', /Completed task/i.test(b) && /Voted/i.test(b));
  check('member-since fact shown', /Member since May 2026/i.test(b));
  check('evidence is still not a score', !/\d+%/.test(b.split('Evidence')[1] ?? ''));

  // A member who has done nothing must show nothing -- not a zero rating.
  const annBtn = buttons().filter((x) => text(x) === 'Evidence')[0];
  await click(annBtn);
  b = body();
  check('member with no history shows no evidence',
    /No recorded activity in this circle yet/i.test(b));

  // =========================================================================
  console.log('\n=== Activity: derived from real signals only ===');
  await click(btn('Activity'));
  b = body();
  check('activity feed rendered', /Task completed/i.test(b));
  check('join event rendered', /Someone joined/i.test(b));
  check('actor attributed where recorded', b.includes('usr_ann'));
  check('no invented activity', !/liked|viewed your|trending/i.test(b));

  // =========================================================================
  console.log('\n=== Role enforcement is the SERVER\'s, surfaced honestly ===');
  // An observer is not offered the action...
  reset();
  state.members = state.members.map((m) =>
    m.userId === 'usr_me' ? { ...m, role: 'observer' } : m);
  await mount();
  await click(btn('Open'));
  await click(btn('Tasks'));
  b = body();
  check('observer is not offered the task action', !btn('Take this on'));
  check('observer is told why', /Observers cannot take on tasks/i.test(b));
  await click(btn('Votes'));
  b = body();
  check('observer is not offered a ballot', !btn('Vote Yes'));
  check('observer told they cannot vote', /Observers cannot vote/i.test(b));

  // ...and when a refusal does come back, the server's reason is shown verbatim.
  reset();
  await mount();
  await click(btn('Open'));
  await click(btn('Tasks'));
  state.refuse = { match: '/assign', status: 403, message: "role 'observer' may not take on tasks in this circle" };
  await click(btn('Take this on'));
  b = body();
  check('server refusal surfaced to the user', /may not take on tasks/i.test(b), b.slice(0, 200));
  check('refused action did not change the task', !/Assigned to you/i.test(b));

  // =========================================================================
  console.log('\n=== Empty circle looks empty ===');
  reset();
  state.blocks = [];
  state.signals = [];
  state.members = [];
  await mount();
  await click(btn('Open'));
  await click(btn('Tasks'));
  check('no tasks says so', /No tasks in this circle/i.test(body()));
  await click(btn('Votes'));
  check('no votes says so', /No votes in this circle/i.test(body()));
  await click(btn('Members'));
  check('no members says so', /No members yet/i.test(body()));
  await click(btn('Activity'));
  b = body();
  check('no activity says so', /No activity recorded yet/i.test(b));
  check('empty state invents nothing', !/usr_|Task completed/i.test(b));

  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
