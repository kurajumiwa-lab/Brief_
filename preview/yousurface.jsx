// ---------------------------------------------------------------------------
// YOU SURFACE SUITE — profile, follows and subscriptions (Phase 3).
//
// Tests:
//   1. YouSurface signed-out state
//   2. profile section (handle, standing counts)
//   3. following section (grouped list + unfollow action)
//   4. subscriptions section (browse plans + subscribe; honest 'not charged')
//   5. EntityDetail (follow/unfollow toggle backed by the real API)
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

const { YouSurface } = require('./src/features/you/YouSurface.tsx');
const { EntityDetail } = require('./src/features/you/EntityDetail.tsx');

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

// The user (whoAmI) + person (getPersonMe) shapes.
const authedUser = { id: 'usr_1', handle: 'wanjiku', displayName: 'Wanjiku Mwangi', personId: 'p_1', capabilities: ['ops.read'] };
const personMe = {
  person: { id: 'p_1', displayName: 'Wanjiku Mwangi', tags: [], aliases: [] },
  standing: { personId: 'p_1', displayName: 'Wanjiku Mwangi', hosted: 2, bought: 5, arrived: 3, registered: 1, vendor: null }
};

let fetchHandler;
global.fetch = async (input, init) => fetchHandler(String(input?.url ?? input ?? ''), init);

async function main() {
  // --- 1. signed out ---
  // This block used to assert one sentence ("Sign in to see your profile") and
  // it passed against a panel that offered NO way to do it — a dead end with good
  // copy. A gate is only real if the control exists, the submit hits the auth
  // endpoint, and the answer comes back; all three are asserted here now.
  const calls = [];
  fetchHandler = async (url, init) => {
    const u = String(url);
    if (u.includes('/auth/me')) return { ok: false, status: 401, text: async () => JSON.stringify({ error: 'authentication required' }) };
    if (u.includes('/auth/login')) {
      calls.push(JSON.parse(init.body));
      return { ok: true, status: 200, text: async () => JSON.stringify({ user: authedUser }) };
    }
    return { ok: false, status: 401, text: async () => JSON.stringify({ error: 'x' }) };
  };
  {
    const { container } = mount(React.createElement(YouSurface, { onOpenEntity: () => {}, onRequireAuth: () => {} }));
    await flush();
    const t = text(container);
    assert.ok(t.includes('Sign in to see your profile'), 'the signed-out state names itself');
    const handle = container.querySelector('input[autocomplete="username"]');
    const pass_ = container.querySelector('input[type="password"]');
    assert.ok(handle && pass_, 'the form has a handle and a password field, not just a message');
    assert.ok(container.querySelector('form'), 'and it is a real form');
    const setValue = (el, v) => act(() => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    setValue(handle, 'wanjiku');
    setValue(pass_, 'a good passphrase');
    const submit = Array.from(container.querySelectorAll('form > button, form button')).find((b) => /sign in/i.test(text(b)));
    assert.ok(submit, 'with a submit control');
    await act(async () => { submit.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
    await flush();
    assert.equal(calls.length, 1, 'submitting posts exactly once');
    assert.deepEqual(calls[0], { handle: 'wanjiku', password: 'a good passphrase' }, 'with the credentials the member typed');
    assert.ok(/create|account/i.test(t), 'and a fresh deployment offers account creation, because there is no account to sign into yet');
  }
  pass('YouSurface: the signed-out state is a working sign-in, not a notice');

  // --- 2. profile ---
  fetchHandler = async (url) => {
    if (url.includes('/auth/me')) return { ok: true, status: 200, text: async () => JSON.stringify({ user: authedUser }) };
    if (url.includes('/person/me')) return { ok: true, status: 200, text: async () => JSON.stringify(personMe) };
    if (url.includes('/me/acquisition')) return { ok: true, status: 200, text: async () => JSON.stringify({ acquisition: null, provenance: null, activity: { verifiedCommercialKes: 0, currency: 'KES' } }) };
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(YouSurface, { onOpenEntity: () => {}, onRequireAuth: () => {} }));
    await flush();
    const t = text(container);
    assert.ok(t.includes('Wanjiku Mwangi'), 'display name shown');
    assert.ok(t.includes('@wanjiku'), 'handle shown');
    assert.ok(t.includes('hosted') && t.includes('bought'), 'standing labels shown');
    assert.ok(t.includes('Sign out'), 'sign out present');
  }
  pass('YouSurface: profile shows identity + derived standing');

  // --- 3. following ---
  let unfollowed = false;
  fetchHandler = async (url, init) => {
    if (url.includes('/auth/me')) return { ok: true, status: 200, text: async () => JSON.stringify({ user: authedUser }) };
    if (url.includes('/person/me')) return { ok: true, status: 200, text: async () => JSON.stringify(personMe) };
    if (url.includes('/me/acquisition')) return { ok: true, status: 200, text: async () => JSON.stringify({ acquisition: null, provenance: null, activity: { verifiedCommercialKes: 0, currency: 'KES' } }) };
    if (url.includes('/me/follows')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ groups: { business: [{ id: 'e_1', kind: 'business', name: 'Kiko Bakery', entityKey: 'kiko', objectCount: 3, imageUrl: null, category: null, location: null, sourceNames: [], followedAt: '2026-09-10T00:00:00Z' }] }, total: 1, kindLabels: { business: 'Businesses' } }) };
    }
    if (url.includes('/entities/e_1/follow') && (init?.method === 'DELETE')) {
      unfollowed = true;
      return { ok: true, status: 200, text: async () => JSON.stringify({ unfollowed: true, already: false, followCount: 0 }) };
    }
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(YouSurface, { onOpenEntity: () => {}, onRequireAuth: () => {} }));
    await flush();
    act(() => { btn('Following').click(); });
    await flush();
    const t = text(container);
    assert.ok(t.includes('Businesses'), 'follows grouped by kind');
    assert.ok(t.includes('Kiko Bakery'), 'entity name shown');
    act(() => { btn('Unfollow').click(); });
    await flush();
    assert.ok(unfollowed, 'unfollow called the DELETE rail');
  }
  pass('YouSurface: following lists entities by kind and unfollows via the real rail');

  // --- 4. subscriptions ---
  let subscribeCalled = false;
  fetchHandler = async (url, init) => {
    if (url.includes('/auth/me')) return { ok: true, status: 200, text: async () => JSON.stringify({ user: authedUser }) };
    if (url.includes('/person/me')) return { ok: true, status: 200, text: async () => JSON.stringify(personMe) };
    if (url.includes('/me/acquisition')) return { ok: true, status: 200, text: async () => JSON.stringify({ acquisition: null, provenance: null, activity: { verifiedCommercialKes: 0, currency: 'KES' } }) };
    if (url.includes('/subscriptions?browse=1')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ subscriptions: [{ id: 'sub_1', creatorId: 'c_1', title: 'Bakery Insider', description: 'Weekly recipes', price: 200, currency: 'KES', interval: 'monthly', status: 'active', createdAt: '2026-09-10T00:00:00Z', updatedAt: '2026-09-10T00:00:00Z', subscriberCount: 4, settledCycles: 0, collected: 0, viewerIsSubscriber: false }] }) };
    }
    // /subscribe BEFORE the generic /api/subscriptions branch (its URL also
    // contains /api/subscriptions).
    if (url.includes('/subscribe')) {
      subscribeCalled = true;
      return { ok: true, status: 200, text: async () => JSON.stringify({ subscriber: { id: 's_1', subscriptionId: 'sub_1', memberId: 'usr_1', status: 'active', startedAt: '2026-09-10T00:00:00Z', endedAt: null }, transaction: null, duplicate: false, charged: false, note: 'recorded, not charged' }) };
    }
    if (url.includes('/api/subscriptions') && !url.includes('browse')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ subscriptions: [] }) };
    }
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(YouSurface, { onOpenEntity: () => {}, onRequireAuth: () => {} }));
    await flush();
    act(() => { btn('Subscriptions').click(); });
    await flush();
    const t = text(container);
    assert.ok(t.includes('Bakery Insider'), 'plan shown');
    assert.ok(t.includes('Subscribe'), 'subscribe action shown');
    act(() => { btn('Subscribe').click(); });
    await flush();
    assert.ok(subscribeCalled, 'subscribe called the rail');
    assert.ok(text(container).includes('recorded, not charged'), 'honest not-charged note shown');
  }
  pass('YouSurface: subscriptions browse + subscribe with an honest not-charged note');

  // --- 5. EntityDetail follow toggle ---
  let followState = 'follow';
  fetchHandler = async (url, init) => {
    // /follow BEFORE the generic entity branch (its URL also contains /entities/e_9).
    if (url.includes('/entities/e_9/follow') && init?.method === 'POST') {
      followState = 'followed';
      return { ok: true, status: 200, text: async () => JSON.stringify({ followed: true, already: false, followCount: 9 }) };
    }
    if (url.includes('/api/entities/e_9')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ entity: { kind: 'business', id: 'e_9', entityKey: 'kiko', name: 'Kiko Bakery', slug: 'kiko-bakery', summary: 'A Nairobi bakery', description: null, imageUrl: null, category: null, location: null, locationName: 'Nairobi', sourceNames: [], trust: { degraded: false, disabled: false, corroborated: false }, isFollowed: followState === 'followed', followCount: followState === 'followed' ? 9 : 8, objects: [] } }) };
    }
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(EntityDetail, { entityId: 'e_9', authed: true, onClose: () => {}, onRequireAuth: () => {} }));
    await flush();
    assert.ok(text(container).includes('Kiko Bakery'), 'entity name shown');
    assert.ok(text(container).includes('Follow · 8'), 'follow button with count');
    act(() => { btn('Follow · 8').click(); });
    await flush();
    assert.ok(text(container).includes('Following · 9'), 'button flips to Following with new count');
  }
  pass('EntityDetail: follow/unfollow toggle updates the count from the real rail');

  // --- 6. The rails the reformation moved HERE: Standing, Orders, Selling ---
  fetchHandler = async (url, init) => {
    const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
    if (url.includes('/auth/me')) return ok({ user: authedUser });
    if (url.includes('/person/me')) return ok(personMe);
    if (url.includes('/me/acquisition')) return ok({ acquisition: null, provenance: null, activity: { verifiedCommercialKes: 0, currency: 'KES' } });
    if (url.includes('/me/position')) {
      return ok({ position: {
        decay: { expiringQuotes: [{ quoteId: 'q1', requestId: 'r1', title: 'Catering for 50', validUntil: '2026-09-20', hoursLeft: 24 }], waitlist: [], override: null, overdueInstallments: 0 },
        missedCapture: { count: 0, recent: [], value: null },
        nextMove: null,
        open: { total: 1, top: [{ requestId: 'r1', title: 'Catering for 50', category: 'catering', location: 'Kilimani', severityLabel: 'Suppliers matched; no quote yet', collective: false, closesMonthly: null }] },
        derivedAt: '2026-09-15T00:00:00Z', note: 'derived'
      } });
    }
    if (url.includes('/me/commitments')) return ok({ commitments: { owedByMe: [], owedToMe: [], fulfilled: [], lapsed: [], owedByMeKes: 0, owedToMeKes: 0, derivedAt: '', note: 'derived' } });
    if (url.includes('/me/reciprocity')) return ok({ reciprocity: { owedToMe: [], owedByMe: [], fulfilled: [], aging: [], windowDays: 14, derivedAt: '', note: 'derived' } });
    if (url.includes('/listings/mine')) return ok({ vendor: null, listings: [] });
    if (url.includes('/vendor/orders')) return ok({ orders: [] });
    if (url.includes('/earnings')) return ok({ earnings: { gross: 0, net: 0, payoutAvailable: false } });
    if (url.includes('/api/listings')) return ok({ listings: [] });
    if (url.includes('/api/orders')) return ok({ orders: [] });
    if (url.includes('/disputes')) return ok({ disputes: [] });
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(YouSurface, { onOpenEntity: () => {}, onRequireAuth: () => {} }));
    await flush();
    const t0 = text(container);
    for (const label of ['Standing', 'Orders', 'Selling']) {
      assert.ok(new RegExp(label).test(t0), `the ${label} rail exists in You`);
    }

    // Standing: derived rows only, and it says so.
    act(() => { btn('Standing').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    const ts = text(container);
    assert.ok(ts.includes('Your position'), 'the derived position renders here');
    assert.ok(ts.includes('1 proposal'), 'a real expiring proposal is counted');
    assert.ok(ts.includes('Nothing here is a score'), 'and the surface names its own basis');
    assert.ok(!/tier/i.test(ts), 'no tier ladder is invented');

    // Orders + Selling: the personal halves of commerce, off the browse screen.
    act(() => { btn('Orders').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    assert.ok(/orders/i.test(text(container)), 'the orders rail renders');
    assert.ok(!/KES \d/.test(text(container)), 'no money figure is invented from an empty ledger');

    act(() => { btn('Selling').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    assert.ok(text(container).includes('Start selling'), 'the real selling flow is reachable from You');
  }
  pass('YouSurface: Standing, Orders and Selling rails exist and stay derived-only');

  // --- 6b. the four-group layout keeps every rail reachable -----------------
  {
    const src = require('fs')
      .readFileSync(require('path').join(__dirname, 'src/features/you/YouSurface.tsx'), 'utf8')
      .toString();
    const groupBlock = src.slice(src.indexOf('const YOU_GROUPS'), src.indexOf('type Section ='));
    // Group entries span lines; item entries are one line each — so this picks
    // out exactly the pills, and nothing else.
    const items = [...groupBlock.matchAll(/\{ id: "([a-zA-Z]+)", label: "([^"]+)" \}/g)].map((m) => [m[1], m[2]]);
    const ids = items.map(([id]) => id);
    const expected = ['profile', 'standing', 'following', 'selling', 'orders', 'network', 'earn', 'tableBanking', 'subscriptions', 'archive', 'how'];
    assert.deepEqual([...ids].sort(), [...expected].sort(),
      'the grouping lists every section exactly once — a reorganisation may move a rail, never drop or rename one');
    assert.equal(new Set(ids).size, ids.length, 'no section sits in two groups');
    // The labels are what the suite elsewhere clicks on; they must survive too.
    for (const label of ['Standing', 'Orders', 'Selling', 'Subscriptions', 'How Trace works']) {
      assert.ok(items.some(([, l]) => l === label), `the "${label}" pill is still labelled "${label}"`);
    }
    assert.ok(/YOU_GROUPS\.map/.test(src) && !/mt-4 flex flex-wrap gap-2">\s*\{tab\("profile"/.test(src),
      'the surface renders the groups, not a flat eleven-pill row');
  }
  pass('YouSurface: four groups, eleven rails, nothing dropped');

  console.log('\nPASS ' + count);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
