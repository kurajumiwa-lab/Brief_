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
        displayName: 'Me Self', handle: 'me', initials: 'MS', isActive: true,
        verifications: ['phone_verified'], joinedAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z',
        trust: { evidence: [{ kind: 'phone_verified', label: 'Phone verified' }], verifiedCount: 1,
                 facts: [{ kind: 'member_since', label: 'Member since May 2026' }] } },
      { id: 'm2', circleId: 'circ_1', userId: 'usr_ann', role: 'contributor',
        displayName: 'Ann Njoki', handle: 'ann', initials: 'AN', isActive: true,
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

  const m = u.match(/\/api\/circles\/([^/]+)\/blocks\/([^/]+)\/(assign|release|complete|vote|close-vote|cancel-vote|cancel|reopen|verify|task)/);
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
      // the server refuses a hand-close once ballots exist; the mock says the
      // same, so the UI cannot pass by talking to a softer stub
      if ((blk.tally.totalVotes ?? 0) > 0) return err(400, 'a vote with ballots cannot be closed by hand — it closes at its own deadline, or you cancel it with a reason everyone can read');
      blk.tally.closed = true;
      return ok({ block: blk, changed: true, tally: blk.tally });
    }
    if (m[3] === 'cancel-vote') {
      state.lastBody = JSON.stringify(body ?? {});
      if (!String(body?.reason ?? '').trim()) return err(400, 'cancelling a vote needs a reason');
      blk.tally.closed = true;
      blk.tally.status = 'cancelled';
      blk.tally.cancelled = true;
      blk.tally.cancelReason = body.reason;
      return ok({ block: blk, changed: true, tally: blk.tally });
    }
    if (m[3] === 'cancel') {
      state.lastBody = JSON.stringify(body ?? {});
      if (!String(body?.reason ?? '').trim()) return err(400, 'a cancellation needs a reason');
      blk.task = { ...blk.task, status: 'cancelled', cancelledAt: '2026-08-19T00:00:00Z', cancelReason: body.reason };
      return ok({ block: blk, changed: true });
    }
    if (m[3] === 'reopen') {
      if (!String(body?.reason ?? '').trim()) return err(400, 'reopening finished work needs a reason');
      blk.task = { ...blk.task, status: 'open', assigneeId: null };
      return ok({ block: blk, changed: true });
    }
    if (m[3] === 'verify') {
      if (blk.task?.status !== 'completed') return err(400, 'only a completed task can be verified');
      blk.task = { ...blk.task, verifiedAt: '2026-08-19T00:00:00Z', verifiedBy: 'usr_me' };
      return ok({ block: blk, changed: true });
    }
    if (m[3] === 'task') {
      if (body?.dueAt && !String(body?.reason ?? '').trim()) return err(400, 'a deadline move needs a reason — it goes in the history');
      if (body?.dueAt) blk.task = { ...blk.task, dueAt: `${body.dueAt}T00:00:00.000Z` };
      return ok({ block: blk, changed: true, edits: 1 });
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
  if (u.includes('/history')) {
    return ok({
      history: [
        { id: 'chx_1', kind: 'task_completed', subject: 'blk_2', subjectKind: 'task', field: 'status', before: 'assigned', after: 'completed', reason: null, redacted: false, actorId: 'usr_ann', at: '2026-08-05T10:00:00.000Z', text: 'Marked done' },
        { id: 'chx_2', kind: 'member_joined', subject: 'memb_2', subjectKind: 'member', field: null, before: null, after: 'contributor', reason: null, redacted: false, actorId: 'usr_ann', at: '2026-08-03T09:00:00.000Z', text: 'Joined circle' }
      ]
    });
  }
  if (/\/api\/circles\/[^/]+$/.test(u)) {
    const live = { ...CIRCLE, blockCount: state.blocks.length };
    return ok({ circle: live, blocks: state.blocks, signals: state.signals });
  }
  if (u.includes('/api/circles')) return ok({ circles: [CIRCLE] });
  return err(404, 'not found');
};
dom.window.fetch = global.fetch;

const type2 = (el, v) => act(() => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
});

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
  // the room loads its detail and its history together, so let both land
  await settle(); await settle();
  b = body();
  check('circle opened', b.includes('Kilimani Traders'));
  check('role stated plainly', /coordinator/i.test(b));
  // THE ROOM RULE: a person is never labelled with a database key.
  check('no raw user id is shown as a label', !/usr_[a-z0-9]+/.test(b.replace(/join\/[a-z0-9]+/g, '')), b.match(/usr_[a-z0-9]+/g)?.[0]);
  check('purpose shown', b.includes('Shared stall fund'));
  check('target arithmetic from server', b.includes('2,500') && b.includes('10,000'));
  check('note block rendered', b.includes('Gate code changed'));
  check('block provenance shown', /via Traders WhatsApp/i.test(b));
  check('tasks NOT duplicated into the blocks list', !b.includes('Repair the market gate'));
  // The overview carries the room's own history of changes — the record, in the
  // server's words — and the Activity tab keeps the signal feed. Not both in one.
  check('what-changed history on the overview', /What changed/i.test(b));
  check('and a real change is named', /Marked done|Task cancelled|Took on task|Voted|Joined/.test(b), b.slice(0, 60));

  // =========================================================================
  console.log('\n=== Tasks: the full lifecycle ===');
  await click(btn('Tasks'));
  b = body();
  check('open task listed', b.includes('Repair the market gate'));
  check('completed task listed', b.includes('Collect August dues'));
  check('status groups rendered', /Open .* 1/i.test(b) && /Completed .* 1/i.test(b));
  check('completion attributed by name, never by key', /Completed by Me Self/i.test(b), b.slice(0, 200));
  check('the tasks panel prints no database key', !/usr_[a-z0-9]+/i.test(b));
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
  check('a member may change their vote before the close', /Change to /i.test(b));
  check('the rule is stated with the change', /One vote counts/i.test(b));

  // A live count with ballots is not closable by hand: the control offered is a
  // cancellation with a reason, and the reason is typed before it will submit.
  check('no hand-close button once ballots exist', !btn('Close this vote') && !btn('Close it — nobody has voted'));
  await click(Array.from(document.querySelectorAll('summary')).find((x) => /Cancel this vote/i.test(x.textContent || '')));
  const reasonInput = document.querySelector('input[name="reason"]');
  check('the cancellation asks for a reason in the flow', Boolean(reasonInput));
  await type2(reasonInput, 'the market moved the Sunday, question is moot');
  state.calls.length = 0;
  await click(Array.from(document.querySelectorAll('form button[type="submit"]')).find((x) => /Cancel vote/i.test(x.textContent || '')));
  b = body();
  check('the cancel hit its own endpoint', state.calls.some((c) => /cancel-vote/.test(c)));
  check('with the reason in the body', /market moved the Sunday/.test(state.lastBody ?? ''), state.lastBody);
  check('result announced once cancelled', /Result: Yes/i.test(b));
  check('a cancelled count takes no more ballots', !btn('Vote No'));

  // =========================================================================
  console.log('\n=== Tasks: the lifecycle, with reasons where they are required ===');
  await click(btn('Tasks'));
  b = body();
  check('a coordinator is offered a cancel on an open task', Boolean(btn('Cancel')), 'the act exists');
  await click(btn('Cancel'));
  const taskReason = Array.from(document.querySelectorAll('input')).find((i) => /reason for cancelling/i.test(i.getAttribute('aria-label') || ''));
  check('the reason field appears inline', Boolean(taskReason));
  const cancelBtn = btn('Cancel task');
  check('and the act is disabled until it is typed', Boolean(cancelBtn && cancelBtn.disabled));
  await type2(taskReason, 'the supplier folded');
  state.calls.length = 0;
  await click(btn('Cancel task'));
  check('the cancel went to its own route', state.calls.some((c) => /\/cancel/.test(c)), state.calls.join(' | '));
  check('with the reason attached', /supplier folded/.test(state.lastBody ?? ''), state.lastBody);
  b = body();
  check('a cancelled task is grouped, not vanished', /Cancelled · 1/i.test(b), b.slice(0, 80));
  check('and its reason is readable next to it', /the supplier folded/i.test(b));

  // =========================================================================
  console.log('\n=== Members: evidence, never a score ===');
  await click(btn('Members'));
  b = body();
  {
    const rows = Array.from(document.querySelectorAll('div')).filter((d) => /Coordinator|Contributor/.test(d.textContent || '') && d.querySelector('span.rounded-full'));
    check('members listed by name, not by key', rows.length >= 1, String(rows.length));
    const text = (rows[0]?.textContent || '').replace(/\s+/g, ' ');
    check('a member row shows an initial, a name and a role', /^[A-Z]?\s*\S/.test(text) && !/usr_/.test(text), text.slice(0, 60));
  }
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
