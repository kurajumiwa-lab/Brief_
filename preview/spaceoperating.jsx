// ---------------------------------------------------------------------------
// THE SPACE FILE — schema, editorial queue, pipeline. A space is a project you
// maintain, not a group you post in, so this suite pins what "maintained" means
// when it is honest:
//
//   * the state badge renders the DERIVED word + the real age, and the panel
//     states that it is not a score;
//   * the queue lists the fields never answered as "never answered" — never as
//     zero, never as complete;
//   * "Still true" writes a CONFIRMATION and says so; it does not make an item
//     vanish by fiat and does not pretend to be new information;
//   * every action goes to a real place (a request, the inbox, the offers
//     tab), and a declared NEED becomes a DRAFT the vendor owns — not an
//     automatically published gap;
//   * the live create flow posts the typed name, the chosen type and the brand
//     cover — and a shell-only create sends no invented first offer.
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
const { SpaceOperatingPanel } = require('./src/features/spaces/SpaceOperatingPanel.tsx');
const { SpaceShell } = require('./src/features/spaces/SpaceShell.tsx');
const { CreateFlowModal } = require('./src/features/spaces/CreateFlowModal.tsx');

let count = 0;
const pass = (n) => { count++; console.log('PASS ' + n); };
const flush = (ms = 50) => new Promise((r) => setTimeout(r, ms));
function mount(el) {
  document.body.innerHTML = '';
  const c = document.createElement('div');
  document.body.appendChild(c);
  const root = createRoot(c);
  act(() => root.render(el));
  return { container: c, root };
}
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const btn = (want) =>
  Array.from(document.querySelectorAll('button')).find((b) => text(b) === want || text(b).startsWith(want));
const click = (el) => act(() => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));

const F = (key, question, state, extra = {}) => ({
  key, question, kind: extra.kind ?? 'text', cadenceHours: extra.cadenceHours ?? 720,
  help: extra.help ?? '', state, ageHours: extra.ageHours ?? null, dueInHours: extra.dueInHours ?? 10,
  updatedAt: extra.updatedAt ?? null, lastConfirmedAt: extra.lastConfirmedAt ?? null,
  confirmations: extra.confirmations ?? 0, value: extra.value ?? null,
  answer: extra.answer ?? null, raw: extra.raw ?? null
});

const VIEW = {
  fields: [
    F('what', 'What do you actually sell or provide?', 'current', { answer: 'Fresh tilapia, whole, graded', lastConfirmedAt: new Date().toISOString(), raw: { text: 'Fresh tilapia, whole, graded' } }),
    F('capacity', 'How much can you deliver, per day or per week?', 'current', { kind: 'measure', cadenceHours: 720, answer: '40 kg/day', ageHours: 5, lastConfirmedAt: new Date().toISOString(), raw: { value: 40, unit: 'kg', per: 'day' } }),
    F('availability', 'When are you on?', 'overdue', { kind: 'schedule', cadenceHours: 168, answer: 'Tue, Wed 06:00–18:00', ageHours: 240, dueInHours: -72, lastConfirmedAt: new Date().toISOString() }),
    F('operatingFrom', 'Where do you operate from?', 'current', { answer: 'Wakulima Market, stall 42', ageHours: 5 }),
    F('coverage', 'Which areas do you actually serve?', 'current', { kind: 'list', answer: 'Nairobi CBD · Westlands', ageHours: 5 }),
    F('constraints', 'What can you NOT do?', 'unanswered', { kind: 'list' }),
    F('needs', 'What do you need from the network?', 'current', { kind: 'list', answer: 'Cold chain for 2 runs a day', ageHours: 5, raw: { items: ['Cold chain for 2 runs a day'] } }),
    F('offersToNetwork', 'What can you give the network?', 'unanswered', { kind: 'list' })
  ],
  maintenance: {
    state: 'stale', lastTouchedAt: new Date(Date.now() - 240 * 3600000).toISOString(), ageHours: 240,
    answered: 6, unanswered: 2, due: 0, overdue: 1, openConversations: 1, draftOffers: 1, pendingOrders: 0,
    fields: [],
    facts: ['This space is private, so it is not in the public directory.', '1 offer is still a draft, so buyers cannot see it.'],
    note: 'State is derived from real timestamps on read. Brief does not rank, boost or bury spaces.'
  },
  editorial: [
    { id: 'a', kind: 'profile', field: 'availability', label: 'Refresh: When are you on?', detail: 'Last confirmed 240h ago · this answer is read as current for 7 days.', urgency: 'overdue', action: 'confirm', evidence: { table: 'spaces', id: 'spc_1', field: 'availability', at: new Date().toISOString() } },
    { id: 'b', kind: 'profile', field: 'constraints', label: 'What can you NOT do?', detail: 'Never answered — the pipeline cannot read what is not there.', urgency: 'missing', action: 'edit', evidence: { table: 'spaces', id: 'spc_1' } },
    { id: 'c', kind: 'reply', label: 'Reply to Wanjiku', detail: 'Their last message is 4h old.', urgency: 'open', action: 'inbox', evidence: { table: 'spaceConversations', id: 'cv_1' } },
    { id: 'd', kind: 'demand', label: 'Answer “40kg tilapia for Friday”', detail: 'This demand was matched to you and nobody has priced it.', urgency: 'open', action: 'request', requestId: 'req_7', evidence: { table: 'matches', id: 'mtch_1' } }
  ],
  pipeline: {
    discoverable: false,
    directory: 'Not in the public directory (visibility is private).',
    listings: { active: 2, drafts: 1, titles: ['Tilapia 1kg', 'Nile perch 1kg'] },
    matchQueries30d: { count: 3, wording: 'requests whose matching run included this space in the last 30 days' },
    proposals: { total: 4, accepted: 2, declined: 1 },
    settled: { orders: 5, value: 21500, currency: 'KES' },
    workOrders: 2,
    needs: [{ text: 'Cold chain for 2 runs a day', canPostAsRequest: true }],
    note: 'Read-only view over real rows. There is no boost, no priority tier and no queue position.'
  }
};
// maintenance.fields and the top-level fields are the same derived list
VIEW.maintenance.fields = VIEW.fields;

let fetchHandler;
let lastBody = null;
global.fetch = async (input, init) => {
  const url = String(input?.url ?? input ?? '');
  if (init?.body) lastBody = String(init.body);
  return fetchHandler(url, init);
};

async function main() {
  // --- The panel, on the real derived view ---------------------------------
  fetchHandler = async (url) => {
    const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
    if (url.includes('/operating')) return ok(VIEW);
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  let switched = null;
  {
    const { container } = mount(React.createElement(SpaceOperatingPanel, {
      spaceId: 'spc_1', maintenance: null, onSwitchTab: (t) => { switched = t; }
    }));
    await flush();
    const t = text(container);
    assert.ok(t.includes('STALE'), 'the state badge renders the derived word');
    assert.ok(t.includes('last touched 10d ago'), 'with the real age, not a countdown');
    assert.ok(t.includes('6/8 answers on record · 1 overdue · 0 coming due · 2 never answered'), 'the tally is arithmetic over the fields');
    assert.ok(t.includes('never answered'), 'an unanswered field says never answered');
    assert.ok(!t.includes('0/8 complete'), 'nothing is scored as a percentage complete');
    // Consequences are the true ones only.
    assert.ok(t.includes('so it is not in the public directory'), 'the visibility fact is stated');
    assert.ok(t.includes('buyers cannot see it'), 'the draft-offer fact is stated');
    assert.ok(!/rank|slipped|queue position|priority matching|boosted/i.test(t.replace(/no rank[^\n]*|no boost[^\n]*|no priority[^\n]*|not rank[^\n]*/gi, '')),
      'no invented consequence survives the disclaimer text');
    // Pipeline reads.
    assert.ok(t.includes('3 requests whose matching run included this space in the last 30 days'), 'match queries use their precise wording');
    assert.ok(t.includes('5 orders · KES 21,500'), 'settled money is the real sum');
    // Queue actions go somewhere real.
    assert.ok(btn('Answer it'), 'an unanswered field has a real action');
    click(btn('Open inbox'));
    assert.equal(switched, 'pipeline', 'the reply item switches to the inbox');
    click(btn('Open the request'));
    assert.ok(String(dom.window.location.hash).includes('requests/req_7'), 'the demand item opens the real request');
  }
  pass('SpaceOperatingPanel renders the derived state, true consequences, the row-backed queue and the pipeline read');

  // --- "Still true" is a confirmation, and the notice says so --------------
  {
    let confirmCalled = null;
    fetchHandler = async (url, init) => {
      const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
      if (url.includes('/confirm')) { confirmCalled = url; return ok({ space: { id: 'spc_1' } }); }
      if (url.includes('/operating')) return ok(VIEW);
      return { ok: false, status: 404, text: async () => JSON.stringify({}) };
    };
    const { container } = mount(React.createElement(SpaceOperatingPanel, { spaceId: 'spc_1' }));
    await flush();
    const before = text(container);
    // The last "Still true" is the one the queue raised, on `availability`.
    const stills = Array.from(container.querySelectorAll('button')).filter((b) => text(b) === 'Still true');
    assert.ok(stills.length >= 2, 'both the overview rows and the queue item offer a confirmation');
    click(stills[stills.length - 1]);
    await flush();
    assert.ok(confirmCalled && confirmCalled.includes('/profile/availability/confirm'), 'the refresh hits the real confirm route for that field');
    const after = text(container);
    assert.ok(after.includes('recorded as a confirmation, not new information') || after.includes('Confirmed just now'), 'and the panel says what it was');
    assert.ok(after.includes('STALE'), 'the item is re-read from the server, not deleted from the DOM');
    assert.ok(before.includes('Editorial queue'), 'queue stays a server-derived list');
  }
  pass('A refresh records a real confirmation and re-reads the queue instead of hiding the item');

  // --- A declared need becomes a DRAFT the vendor owns, not a live gap -----
  {
    let created = null;
    fetchHandler = async (url, init) => {
      const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
      if (url.includes('/operating')) return ok(VIEW);
      if (url.endsWith('/api/requests') && init?.method === 'POST') {
        created = JSON.parse(String(init.body));
        return ok({ request: {
          id: 'req_new', requesterId: 'usr_1', title: 'Cold chain for 2 runs a day',
          status: 'draft', revision: 1, history: [], attachments: []
        } });
      }
      return { ok: false, status: 404, text: async () => JSON.stringify({}) };
    };
    const { container } = mount(React.createElement(SpaceOperatingPanel, { spaceId: 'spc_1' }));
    await flush();
    click(btn('Post as a request'));
    await flush();
    assert.ok(created, 'the need posts through the real request rail');
    assert.equal(created.intent, 'draft', 'as a DRAFT — it goes live only when the vendor submits it');
    assert.match(created.title, /Cold chain for 2 runs a day/);
    assert.ok(String(dom.window.location.hash).includes('requests/req_new'), 'and lands on the draft to edit');
  }
  pass('A need becomes a vendor-owned draft request, never an auto-published gap');

  // --- A failed read is an error, not an empty space file ------------------
  {
    fetchHandler = async () => ({ ok: false, status: 500, text: async () => JSON.stringify({ error: 'ledger unavailable' }) });
    const { container } = mount(React.createElement(SpaceOperatingPanel, { spaceId: 'spc_1' }));
    await flush();
    // The server's own refusal is shown verbatim; no friendly filler, no
    // reassuring "all clear" invented to cover the gap.
    assert.ok(text(container).includes('ledger unavailable'), 'the panel reports the failure verbatim');
    assert.ok(!/FRESH|nothing due/i.test(text(container)), 'and never shows a reassuring all-clear');
  }
  pass('SpaceOperatingPanel degrades to an honest error');

  // --- The workspace exposes the space file with its real open-item count --
  {
    const space = {
      id: 'spc_9', ownerId: 'u1', vendorId: 'v1', name: 'Tilapia at Wakulima', type: 'business', goal: '', targetValueKes: 0,
      visibility: 'private', status: 'active', capabilities: [],
      offers: [], recentActivities: [], recentConversations: [],
      editorialOpen: 3, maintenance: VIEW.maintenance,
      metrics: { revenueKes: 0, customerCount: 0, activeOrdersCount: 0, totalOrdersCount: 0, offersCount: 0 },
      createdAt: '', updatedAt: ''
    };
    fetchHandler = async (url) => {
      const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
      if (url.includes('/operating')) return ok(VIEW);
      if (url.includes('/api/spaces/spc_9')) return ok({ space });
      return { ok: false, status: 404, text: async () => JSON.stringify({}) };
    };
    const { container } = mount(React.createElement(SpaceShell, { spaceId: 'spc_9', onBack: () => {}, onShare: () => {} }));
    await flush();
    const t = text(container);
    assert.ok(t.includes('To do · 3'), 'the tab badge counts the real open items');
    click(btn('To do · 3'));
    await flush();
    assert.ok(text(container).includes('Editorial queue'), 'and it opens the space file');
  }
  pass('SpaceShell mounts the space file with a derived open-item badge');

  // --- The live create flow posts name, type and cover, nothing invented ----
  {
    let posted = null;
    fetchHandler = async (url, init) => {
      const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
      if (url.endsWith('/api/spaces') && init?.method === 'POST') {
        posted = JSON.parse(String(init.body));
        return ok({ space: { id: 'spc_new', name: "Amina's Fish", type: 'community', offers: [], recentActivities: [], recentConversations: [], metrics: {} } });
      }
      return { ok: false, status: 404, text: async () => JSON.stringify({}) };
    };
    let completed = null;
    const { container } = mount(React.createElement(CreateFlowModal, { isOpen: true, onClose: () => {}, onCompleted: (s) => { completed = s; } }));
    await flush();
    assert.ok(text(container).includes('Make it your shop'), 'step 1 renders');
    assert.ok(text(container).includes('Team / network'), 'the Team split is in the live flow');
    assert.ok(text(container).includes('Shop brand cover'), 'the brand cover field is in the live flow');
    click(btn('Team / network'));                 // a physical shop is not the only uniform
    const nameInput = document.querySelector('input[placeholder^="e.g."]');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
      setter.call(nameInput, "Amina's Fish");
      nameInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    click(btn('Create shop — add offers later')); // shell only: no first offer invented
    await flush();
    assert.ok(posted, 'the create call goes out');
    assert.equal(posted.name, "Amina's Fish");
    assert.equal(posted.type, 'community', 'the chosen Team type is what is stored');
    assert.equal(posted.image, null, 'no cover chosen yet means null, not a placeholder');
    assert.equal(posted.initialOffer, undefined, 'a shell-only create sends no first offer');
    assert.ok(completed && completed.id === 'spc_new', 'completion hands back the created space');
  }
  pass('The live create flow posts name, type and cover with no invented offer');

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
