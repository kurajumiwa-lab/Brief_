// ---------------------------------------------------------------------------
// EDITING AFTER PUBLISHING — a space and its offers stay the owner's to change.
//
// Two things this pins, because both were broken in the same direction:
//
//   1. THE CONTROLS WERE COSMETIC. "Pause offer" flipped local React state:
//      the offer stayed live to buyers. Now every status move goes through
//      POST /api/listings/:id/status and the card re-renders from the row the
//      server returns — so if the server says it is still active, the card says
//      ACTIVE. A lie with a checkmark is worse than no button.
//   2. THERE WAS NO WAY TO EDIT THE SPACE ITSELF. Name, goal and target were
//      set once at creation and then unreachable, even though the server always
//      allowed the patch. And a withdrawn offer must NOT offer "relist",
//      because archived is terminal by design — orders refer to what the
//      listing was, so re-listing means a new offer.
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
// jsdom ships no clipboard: the copy path must degrade to telling the user what
// to do, rather than claiming a copy it could not make.
Object.defineProperty(dom.window.navigator, 'clipboard', { value: undefined, configurable: true });

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const { SpaceShell } = require('./src/features/spaces/SpaceShell.tsx');

let count = 0;
const pass = (n) => { count++; console.log('PASS ' + n); };
const flush = (ms = 60) => new Promise((r) => setTimeout(r, ms));
function mount(el) {
  document.body.innerHTML = '';
  const c = document.createElement('div');
  document.body.appendChild(c);
  const root = createRoot(c);
  act(() => root.render(el));
  return { container: c, root };
}
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const q = (sel) => document.querySelector(sel);
const btn = (want) => Array.from(document.querySelectorAll('button')).find((b) => text(b) === want || text(b).startsWith(want));
const byAria = (label) => Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === label);
const click = (el) => act(() => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
const setValue = (el, value) => {
  const proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
};

const offer = (id, status, over = {}) => ({
  id, vendorId: 'v1', spaceId: 'spc_1', title: `${id} cake`, description: 'Two tiers', type: 'product',
  price: 4500, currency: 'KES', quantityAvailable: 6, status, createdAt: '', updatedAt: '', ...over
});

const spaceWith = (over = {}) => ({
  id: 'spc_1', ownerId: 'u1', vendorId: 'v1', name: "Amina's Cakes", type: 'business',
  goal: 'First 20 customers', targetValueKes: 100000, image: null,
  visibility: 'public', status: 'active', capabilities: [],
  offers: [offer('lst_1', 'active'), offer('lst_2', 'draft'), offer('lst_3', 'archived')],
  recentActivities: [], recentConversations: [], metrics: { revenueKes: 0, customerCount: 0, activeOrdersCount: 0, totalOrdersCount: 0, offersCount: 2 },
  createdAt: '', updatedAt: '', ...over
});

let calls = [];
let handler;
global.fetch = async (input, init) => {
  const url = String(input?.url ?? input ?? '');
  const body = init?.body ? String(init.body) : null;
  calls.push({ url, method: init?.method ?? 'GET', body });
  return handler(url, init);
};
const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });

async function main() {
  // --- 1. the space itself stays editable after going public ---------------
  handler = async (url, init) => {
    if (url.includes('/api/spaces/spc_1/operating')) return ok({ fields: [], maintenance: null, editorial: [], pipeline: null });
    if (url.endsWith('/api/spaces/spc_1') && (init?.method ?? 'GET') === 'GET') return ok({ space: spaceWith() });
    if (url.endsWith('/api/spaces/spc_1') && init?.method === 'PATCH') {
      const sent = JSON.parse(String(init.body));
      return ok({ space: spaceWith({ name: sent.name, goal: sent.goal, targetValueKes: sent.targetValueKes }) });
    }
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(SpaceShell, { spaceId: 'spc_1', onBack: () => {}, onShare: () => {} }));
    await flush();
    const edit = byAria('Edit this space');
    assert.ok(edit, 'a public space offers an edit control');
    click(edit);
    await flush();
    assert.ok(q('input[aria-label="Space name"]'), 'the editor opens with the name');
    assert.equal(q('input[aria-label="Space name"]').value, "Amina's Cakes", 'prefilled from the stored row');
    setValue(q('input[aria-label="Space name"]'), "Amina's Cake Studio");
    setValue(q('input[aria-label="Monthly target"]'), '');
    click(btn('Save'));
    await flush();
    const patch = calls.find((c) => c.method === 'PATCH' && c.url.endsWith('/api/spaces/spc_1'));
    assert.ok(patch, 'the edit goes to the real PATCH rail');
    assert.equal(JSON.parse(patch.body).name, "Amina's Cake Studio", 'with the new name');
    assert.equal(JSON.parse(patch.body).targetValueKes, null, 'a cleared target is null, not 0');
    const t = text(container);
    assert.ok(t.includes('Amina\'s Cake Studio'), 'the header shows the saved name');
    assert.ok(t.includes('directory shows this on the next read'), 'and publishing is stated as no barrier');
  }
  pass('A published space stays editable: name, goal and target save through the real rail');

  // --- 2. a refused edit is shown, not swallowed ---------------------------
  handler = async (url, init) => {
    if (url.includes('/api/spaces/spc_1/operating')) return ok({ fields: [], maintenance: null, editorial: [], pipeline: [] });
    if (url.endsWith('/api/spaces/spc_1') && (init?.method ?? 'GET') === 'GET') return ok({ space: spaceWith() });
    if (init?.method === 'PATCH') return { ok: false, status: 400, text: async () => JSON.stringify({ error: 'Space name is required' }) };
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(SpaceShell, { spaceId: 'spc_1', onBack: () => {}, onShare: () => {} }));
    await flush();
    click(byAria('Edit this space'));
    await flush();
    setValue(q('input[aria-label="Space name"]'), 'x'.repeat(3));
    click(btn('Save'));
    await flush();
    assert.ok(text(container).includes('Space name is required'), "the server's refusal appears word for word");
  }
  pass('A refused edit surfaces the server’s reason');

  // --- 3. offer controls are real, and status comes from the row ----------
  let pausedTo = null;
  let editedPrice = null;
  handler = async (url, init) => {
    const method = init?.method ?? 'GET';
    if (url.includes('/status') && method === 'POST') {
      pausedTo = JSON.parse(String(init.body)).status;
      // The row the server sends back is ACTIVE anyway: the UI must follow it.
      return ok({ listing: offer('lst_1', 'active'), changed: true });
    }
    if (url.includes('/api/listings/lst_1') && method === 'PATCH') {
      editedPrice = JSON.parse(String(init.body)).price;
      return ok({ listing: offer('lst_1', 'active', { price: editedPrice }) });
    }
    if (url.includes('/api/spaces/spc_1/operating')) return ok({ fields: [], maintenance: null, editorial: [], pipeline: null });
    if (url.endsWith('/api/spaces/spc_1') && method === 'GET') return ok({ space: spaceWith() });
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(SpaceShell, { spaceId: 'spc_1', onBack: () => {}, onShare: () => {}, initialTab: 'catalog' }));
    await flush();
    const menu = byAria('Actions for lst_1 cake');
    assert.ok(menu, 'an active offer has a menu of its legal moves');
    click(menu);
    await flush();
    const pause = btn('Pause — hidden from buyers');
    assert.ok(pause, 'pause is offered for an active offer');
    click(pause);
    await flush();
    assert.equal(pausedTo, 'paused', 'the move goes through the transition endpoint, not local state');

    // And because the server row still says active, the card must say ACTIVE.
    const t = text(container);
    assert.ok(t.includes('ACTIVE'), 'the badge follows the row, not the click');
    assert.ok(!t.includes('PAUSED'), 'no optimistic lie about a paused offer');

    // Editing content after publishing. Exact match: the header has its own
    // "Edit space" control, and the two must not be confused.
    const editOffer = Array.from(container.querySelectorAll('button')).find((b) => text(b) === 'Edit');
    assert.ok(editOffer, 'the offer card carries its own Edit control');
    click(editOffer);
    await flush();
    assert.ok(q('input[aria-label="Offer price"]'), 'the offer editor opens');
    setValue(q('input[aria-label="Offer price"]'), '3900');
    click(btn('Save changes'));
    await flush();
    assert.equal(editedPrice, 3900, 'the price PATCHes the real listing rail');
  }
  pass('Offer pause and price edits are server calls; the badge follows the returned row');

  // --- 4. withdrawn is terminal, and drafts get no nonsense --------------
  {
    const { container } = mount(React.createElement(SpaceShell, { spaceId: 'spc_1', onBack: () => {}, onShare: () => {}, initialTab: 'catalog' }));
    await flush();
    const t = text(container);
    assert.ok(t.includes('WITHDRAWN'), 'the withdrawn offer is labelled as it is');
    assert.ok(t.includes('a new offer re-lists it'), 'and explains the honest path back');
    assert.ok(!btn('Resume — live again'), 'no relist button is offered on a terminal row');
    // The draft card: publish only, plus withdraw — never "pause" a draft.
    const draftMenu = byAria('Actions for lst_2 cake');
    click(draftMenu);
    await flush();
    assert.ok(!btn('Pause — hidden from buyers'), 'a draft is not offered a pause');
    assert.ok(btn('Withdraw this offer'), 'a draft can still be withdrawn');
    click(draftMenu);
  }
  pass('Transitions offered match the ones the server will accept');

  // --- 5. sharing tells the truth about what exists -----------------------
  handler = async (url, init) => {
    const method = init?.method ?? 'GET';
    if (url.includes('/api/spaces/spc_1/operating')) return ok({ fields: [], maintenance: null, editorial: [], pipeline: [] });
    if (url.endsWith('/api/spaces/spc_1') && method === 'GET') return ok({ space: spaceWith({ visibility: 'private' }) });
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(SpaceShell, { spaceId: 'spc_1', onBack: () => {}, onShare: () => {} }));
    await flush();
    click(byAria('Copy the link that reaches this space'));
    await flush();
    const t = text(container);
    assert.ok(t.includes('no public page to link to'), 'a private space is not given a fake share link');
    assert.ok(t.includes('Set it to Public first'), 'and is told the one thing that changes it');
    assert.ok(!t.includes('copied!'), 'and no toast claims a copy that did not happen');
  }
  pass('Share is honest: no copied-link claim for a space that is not public');

  // --- 6. a public space links to a page that exists ----------------------
  // Shared with 6b: the same row, read with and without a declared origin.
  const publicSpace = {
    id: 'spc_7', ownerId: 'u1', vendorId: 'v7', name: 'Jj Cakes', type: 'business', goal: 'First 20 customers',
    targetValueKes: 0, image: null, slug: 'jj-cakes', visibility: 'public', status: 'active', capabilities: [],
    offers: [], recentActivities: [], recentConversations: [], featured: [], followers: 2, broadcastsLive: 0,
    metrics: { revenueKes: 0, customerCount: 0, activeOrdersCount: 0, totalOrdersCount: 0, offersCount: 0 },
    createdAt: '', updatedAt: ''
  };
  {
    global.fetch = async (input) => {
      const url = String(input?.url ?? input ?? '');
      const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
      if (url.includes('/audience')) return ok({ slug: 'jj-cakes', followers: 2, followerList: [], iAmFollowing: false, broadcasts: [], pastBroadcasts: 0, templates: [], insights: null, canManage: true, followable: false });
      if (url.includes('/api/spaces/spc_7')) return ok({ space: publicSpace });
      return { ok: false, status: 404, text: async () => JSON.stringify({}) };
    };
    const { container } = mount(React.createElement(SpaceShell, { spaceId: 'spc_7', onBack: () => {}, onShare: () => {} }));
    // Two reads now back the shell (audience + the public-face read), so the
    // first paint is one tick later than it used to be.
    await flush(220);
    const share = Array.from(container.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') ?? '').includes('Copy the link'));
    act(() => share.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
    await flush();
    const t = text(container);
    // The canonical page URL, not an in-app hash route: a hash link previews as
    // nothing in WhatsApp and cannot be printed on a sticker.
    assert.ok(t.includes('/s/jj-cakes'), 'the copied link is the page that resolves, by slug');
    assert.ok(!t.includes('#space/jj-cakes'), 'and never the in-app route, which is not a shareable address');
    assert.ok(!t.includes('copied!'), 'no triumphant toast about a clipboard the test browser denies');
    // The panel is the same address, so a vendor can see what they are sharing.
    assert.ok(t.includes('Public page'), 'the face panel is mounted in the shell');
  }
  pass('A public space shares a link that actually opens something');

  // --- 6b. the shell shows the server-declared canonical link, not its own host
  {
    global.fetch = async (input) => {
      const url = String(input?.url ?? input ?? '');
      const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
      if (url.includes('/audience')) return ok({ slug: 'jj-cakes', followers: 2, followerList: [], iAmFollowing: false, broadcasts: [], pastBroadcasts: 0, templates: [], insights: null, canManage: true, followable: false });
      if (url.includes('/public-page')) return ok({ view: null, path: '/s/jj-cakes', originDeclared: true, open: true, reason: null, reports: { count: 0, latest: null, note: 'No reports have been filed against this space.' }, note: 'mirror' });
      if (url.includes('/api/spaces/spc_7')) return ok({ space: publicSpace });
      return { ok: false, status: 404, text: async () => JSON.stringify({}) };
    };
    const { container } = mount(React.createElement(SpaceShell, { spaceId: 'spc_7', onBack: () => {}, onShare: () => {} }));
    // Two reads now back the shell (audience + the public-face read), so the
    // first paint is one tick later than it used to be.
    await flush(220);
    const t = text(container);
    assert.ok(t.includes('Public page'), 'the face panel is mounted in the shell');
    // No pageUrl in this read, so the address is the origin in use plus the
    // server's path — and never a brand domain nobody declared.
    assert.ok(t.includes('/s/jj-cakes'), 'the panel shows the same address the shell copies');
    assert.ok(!/brief\.app/.test(t), 'no invented hostname when none is configured');
  }
  pass('The panel and the copy button agree on the address');

  // --- 7. a settled figure never dresses itself as today's net profit ------
  {
    global.fetch = async (input, init) => {
      const url = String(input?.url ?? input ?? '');
      const method = init?.method ?? 'GET';
      const okp = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
      if (url.includes('/audience')) return okp({ slug: 'jj', followers: 0, followerList: [], iAmFollowing: false, broadcasts: [], pastBroadcasts: 0, templates: [], insights: null, canManage: true, followable: false });
      if (url.includes('/api/spaces/spc_1') && method === 'GET') {
        return okp({ space: spaceWith({ metrics: { revenueKes: 84200, customerCount: 23, activeOrdersCount: 7, totalOrdersCount: 9, offersCount: 2 } }) });
      }
      return { ok: false, status: 404, text: async () => JSON.stringify({}) };
    };
    const { container } = mount(React.createElement(SpaceShell, { spaceId: 'spc_1', onBack: () => {}, onShare: () => {}, initialTab: 'pipeline' }));
    await flush();
    const t = text(container);
    assert.ok(t.includes('Pipeline') || t.includes('Inbox'), 'the pipeline surface rendered at all');
    assert.ok(!/today's net take-home/i.test(t), 'no all-time figure is labelled as today');
    assert.ok(!/\bnet take-home\b/i.test(t), 'and nothing is called net while expenses are untouched');
    assert.ok(/Settled through Brief|Settled · all time/i.test(t), 'the honest label is used instead');
    assert.ok(t.includes('84,200'), 'with the real figure');
    assert.ok(/Expenses are not subtracted here/i.test(t), 'and it says what it excludes');
  }
  pass('A settled total is labelled as a settled total, not as profit');

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
