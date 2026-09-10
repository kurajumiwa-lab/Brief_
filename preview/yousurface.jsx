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
  fetchHandler = async (url) => {
    if (url.includes('/auth/me')) return { ok: false, status: 401, text: async () => JSON.stringify({ error: 'authentication required' }) };
    return { ok: false, status: 401, text: async () => JSON.stringify({ error: 'x' }) };
  };
  {
    const { container } = mount(React.createElement(YouSurface, { onOpenEntity: () => {}, onRequireAuth: () => {} }));
    await flush();
    assert.ok(text(container).includes('Sign in to see your profile'), 'signed-out state');
  }
  pass('YouSurface: a signed-out member sees the signed-out state');

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

  console.log('\nPASS ' + count);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
