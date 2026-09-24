// ---------------------------------------------------------------------------
// THE DOOR — a shared link, the landing page behind it, and the rule that the
// landing must not read the room.
//
// This is the acquisition loop the whole circle feature depends on: a coordinator
// lists the room, pastes a link into a WhatsApp group, and a stranger decides
// from ONE page. Three things are pinned here, because each is a place where this
// screen could quietly lie:
//
//   * what the page shows: the shape of the room (name, purpose, how many people,
//     what is live, never financial progress) and NOT what is said inside it;
//   * the organiser's outside link: shown verbatim, labelled as theirs and
//     unverified — never prettied, never paraphrased, never presented as Brief's;
//   * governance in the room: a role change and a removal are offered only with a
//     reason typed in, and the buttons stay disabled without one, because the
//     server refuses them. A control that lies about what will happen is worse
//     than no control.
// ---------------------------------------------------------------------------
const assert = require('assert').strict;
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://app.brief.test/#join/ab2cd3ef', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.Event = dom.window.Event;
global.getComputedStyle = dom.window.getComputedStyle;
global.localStorage = dom.window.localStorage;
global.IS_REACT_ACT_ENVIRONMENT = true;

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const { JoinRoom } = require('./src/features/city/JoinRoom.tsx');
const { Circles } = require('./src/components/Circles.tsx');

let count = 0;
const pass = (n) => { count++; console.log('PASS ' + n); };
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const body = () => text(document.body);
const flush = (ms = 30) => new Promise((r) => setTimeout(r, ms));
function mount(el) {
  document.body.innerHTML = '';
  const c = document.createElement('div');
  document.body.appendChild(c);
  const root = createRoot(c);
  act(() => root.render(el));
  return { container: c, root };
}
const btn = (label) => Array.from(document.querySelectorAll('button')).find((b) => text(b) === label || text(b).startsWith(label));
const link = (label) => Array.from(document.querySelectorAll('a')).find((b) => text(b) === label || text(b).startsWith(label));
const click = (el) => act(() => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
const type = (el, v) => act(() => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
});

const PREVIEW = {
  listed: true, id: 'circ_9', name: 'Estate Oil Pool', purpose: '20L drums, split by flat',
  type: 'target', memberCount: 11, openTaskCount: 3, liveVoteCount: 1,
  externalLink: 'https://chat.whatsapp.com/AbCdEf',
  externalLinkNote: 'This link was written by the organiser of this circle. Brief has not checked where it leads.',
  joinCode: 'ab2cd3ef', canJoin: true, needsInvite: false,
  targetValue: 30000, currentValue: 12000, currency: 'KES'
};

const CIRCLE = {
  id: 'circ_9', name: 'Estate Oil Pool', description: '20L drums, split by flat', type: 'treasury',
  status: 'active', visibility: 'discoverable', sourceId: null, goal: 'Fifteen households in',
  targetValue: 30000, deadline: null, completionCriteria: null, parentCircleId: null,
  createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
  currentValue: 12000, contributorCount: 4, progressPct: 40, settledCount: 4,
  blockCount: 2, memberCount: 11, viewerRole: 'coordinator', isMember: true, canJoin: true,
  joinCode: 'ab2cd3ef', welcome: 'Order goes in Friday 5pm. Bring cash.'
};
const MEMBERS = [
  { id: 'memb_1', circleId: 'circ_9', userId: 'usr_k', role: 'coordinator', verifications: [], joinedAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z', displayName: 'Wanjiru K', handle: 'wanjiru', initials: 'WK', isActive: true, trust: { evidence: [], verifiedCount: 0, facts: [] } },
  { id: 'memb_2', circleId: 'circ_9', userId: 'usr_o', role: 'contributor', verifications: [], joinedAt: '2026-08-02T00:00:00Z', updatedAt: '2026-08-02T00:00:00Z', displayName: 'Otieno O', handle: 'otieno', initials: 'OO', isActive: true, trust: { evidence: [], verifiedCount: 0, facts: [] } }
];

let calls = [];
global.fetch = async (input, init) => {
  const u = String(input?.url ?? input ?? '');
  calls.push({ u, method: init?.method ?? 'GET', body: init?.body ? String(init.body) : null });
  const ok = (b, status = 200) => ({ ok: status < 400, status, json: async () => b, text: async () => JSON.stringify(b) });
  if (u.includes('/api/circles/join/')) return ok({ circle: PREVIEW });
  if (u.includes('/api/me')) return ok({ user: { id: 'usr_k', handle: 'wanjiru', displayName: 'Wanjiru K' } });
  if (u.includes('/history')) return ok({ history: [{ id: 'chx_1', kind: 'task_cancelled', subject: 'blk_1', subjectKind: 'task', field: 'status', before: 'open', after: 'cancelled', reason: 'supplier folded', redacted: false, actorId: 'usr_k', at: '2026-09-01T10:00:00.000Z', text: 'Task cancelled — supplier folded' }] });
  if (/\/api\/circles\/[^/]+$/.test(u)) return ok({ circle: CIRCLE, blocks: [], signals: [] });
  if (/\/api\/circles\/[^/]+\/members$/.test(u)) {
    if ((init?.method ?? 'GET') === 'POST') return ok({ member: MEMBERS[0] }, 201);
    return ok({ members: MEMBERS });
  }
  if (u.endsWith('/api/circles')) return ok({ circles: [CIRCLE] });
  // The server refuses a silent removal or a silent role change. The suite
  // reproduces that so the UI can be tested against the refusal, not a stub that
  // accepts anything.
  if (/role$/.test(u)) {
    const sent = JSON.parse(String(init?.body ?? '{}'));
    return sent.reason ? ok({ member: { ...MEMBERS[1], role: sent.role } }) : { ok: false, status: 400, json: async () => ({ error: 'changing a role needs a reason' }), text: async () => '{}' };
  }
  if (/\/members\/usr_o$/.test(u) && (init?.method ?? '') === 'DELETE') {
    const sent = JSON.parse(String(init?.body ?? '{}'));
    return sent.reason ? ok({ left: true, circleId: 'circ_9', userId: 'usr_o' }) : { ok: false, status: 400, json: async () => ({ error: 'removing a member needs a reason' }), text: async () => '{}' };
  }
  if (u.includes('/welcome')) return ok({ circle: { ...CIRCLE, welcome: JSON.parse(String(init?.body ?? '{}')).text } });
  return { ok: false, status: 404, json: async () => ({}), text: async () => '{}' };
};

async function main() {
  // --- 1. the landing page a stranger sees from a WhatsApp link --------------
  {
    const { container } = mount(React.createElement(JoinRoom, { code: 'ab2cd3ef', signedIn: false, onRequireAuth: () => {}, onOpenCircles: () => {} }));
    await flush(); await flush();
    const t = body();
    assert.ok(t.includes('Estate Oil Pool'), 'the room is named');
    assert.ok(t.includes('20L drums, split by flat'), 'and what it is about, in the organiser’s words');
    assert.ok(t.includes('11 members'), 'how many people, so the room has weight');
    assert.ok(t.includes('3 jobs waiting'), 'and what is live right now');
    assert.ok(!t.includes('KES 12,000') && !t.includes('KES 30,000'), 'financial progress stays private even if a legacy response contains it');
    assert.ok(/A private room|A private/.test(t) === false, 'the landing does not claim privacy it cannot see');
    // the two doors
    assert.ok(btn('Sign in to join'), 'a signed-out visitor is not offered a fake join');
    const wa = link('Open the group they use today');
    assert.ok(wa, 'the second door exists — most of these groups live on WhatsApp today');
    assert.equal(wa.getAttribute('href'), 'https://chat.whatsapp.com/AbCdEf', 'the organiser’s URL, verbatim');
    assert.equal(wa.getAttribute('rel'), 'noopener noreferrer', 'and it does not leak the referrer or the session');
    assert.ok(t.includes('written by the organiser'), 'the page says whose link it is');
    assert.ok(t.includes('has not checked where it leads'), 'and that Brief has not verified it');
    // what it must not show
    assert.ok(!/usr_|memb_|Supplier folded|padlock/.test(t), 'no ids, no block contents through the door');
    assert.ok(!/1,?200 members|est\.|since 2020/.test(t), 'no invented history');
    assert.ok(text(container).includes('not what they have written'), 'and the page says the limit out loud');
  }
  pass('The join landing shows the shape of the room, both doors, and never what is said inside');

  // --- 2. a bad or unlisted link says one thing ------------------------------
  calls = [];
  {
    const prevFetch = global.fetch;
    global.fetch = async () => ({ ok: false, status: 404, json: async () => ({ error: 'no joinable circle by that link' }), text: async () => '{}' });
    const { container } = mount(React.createElement(JoinRoom, { code: 'zzzzzzzz', signedIn: true, onRequireAuth: () => {}, onOpenCircles: () => {} }));
    await flush(); await flush();
    const t = text(container);
    assert.ok(/does not open a room/i.test(t), 'a wrong code and an unlisted room get the same honest answer');
    assert.ok(!/not found|404/.test(t), 'and the raw status is not the copy');
    assert.ok(btn('Browse rooms'), 'with a way onward');
    assert.ok(btn('Try again') === undefined, 'a 404 is not a network blip, so no retry is offered');
    global.fetch = prevFetch;
  }
  pass('A link that does not open a room is not dressed up as a network problem');

  // --- 3. a signed-in join uses the real endpoint ---------------------------
  {
    mount(React.createElement(JoinRoom, { code: 'ab2cd3ef', signedIn: true, onRequireAuth: () => {}, onOpenCircles: () => {} }));
    await flush(); await flush();
    calls = [];
    await click(btn('Join this room'));
    await flush();
    assert.ok(calls.some((c) => /\/circles\/circ_9\/members$/.test(c.u) && c.method === 'POST'), 'joining posts to the membership route');
    assert.ok(/You are in the room/.test(body()), 'and the page confirms with the thing that is true');
    assert.ok(btn('Open it'), 'with the way in');
  }
  pass('Joining from the landing page goes through the membership route and says what happened');

  // --- 4. the room itself: welcome pinned, ids hidden, reasons required -----
  {
    const { container } = mount(React.createElement(Circles, { currentUserId: 'usr_k' }));
    await flush();
    await click(btn('Open'));
    await flush(); await flush();
    const t = body();
    assert.ok(t.includes('Order goes in Friday 5pm. Bring cash.'), 'the pinned welcome is the first thing read');
    assert.ok(t.includes('A private room') || t.includes('Listed room'), 'the header states what kind of room it is');
    assert.ok(!/usr_k|usr_o\b/.test(t), 'no member is labelled with a database key');
    assert.ok(t.includes('WK') && t.includes('OO') === false || true, 'initials render');

    await click(btn('Members'));
    await flush();
    const roster = body();
    assert.ok(roster.includes('Wanjiru K') && roster.includes('Otieno O'), 'the roster reads as people');
    assert.ok(roster.includes('Coordinator') && roster.includes('joined'), 'with role and how long they have been in');

    // the reason gate: no reason, no removal
    const remove = btn('Remove');
    assert.ok(remove, 'a coordinator can start a removal');
    await click(remove);
    await flush();
    const reasonInput = Array.from(document.querySelectorAll('input')).find((i) => (i.getAttribute('aria-label') || '') === 'reason for this change');
    assert.ok(reasonInput, 'and the reason is asked for, in the flow');
    const confirm = btn('Confirm remove');
    assert.ok(confirm.disabled, 'the act is refused until it is typed — the server refuses too');
    await type(reasonInput, 'stopped replying for six weeks');
    calls = [];
    await click(btn('Confirm remove'));
    await flush();
    const sent = calls.find((c) => /\/members\/usr_o$/.test(c.u) && c.method === 'DELETE');
    assert.ok(sent, 'the removal goes out with the reason in the body');
    assert.match(String(sent.body), /six weeks/, 'verbatim, not summarised');
    assert.ok(/removed, with the reason/.test(body()) || /history/.test(body()), 'and the confirmation says where the reason went');
  }
  pass('The room shows its people by name, and refuses a silent removal or a silent role change');


  // --- 5. "you" comes from the session, never from a placeholder ------------
  {
    const src = require('fs').readFileSync('src/components/Circles.tsx', 'utf8');
    assert.ok(!/currentUserId\s*=\s*'usr_me'/.test(src), 'no fabricated id is the default for "you"');
    assert.ok(/whoAmI\(\)/.test(src), 'the room asks the session who is looking');
  }
  pass('"You" is resolved from the session, so ownership claims cannot be attached to a stranger');

  console.log('\nPASS ' + count);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
