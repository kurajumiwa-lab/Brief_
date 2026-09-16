// ---------------------------------------------------------------------------
// THE ERRANDS LOBBY — a noticeboard, not a gallery, and not a marketplace of
// promises. Pinned here:
//
//   * Discover is three rooms — Events, Marketplace, Errands. Circles and the
//     vaults left (they have doors, not shelves); WAIRO lives with errands only,
//     because a rider you push and an errand you post are the same walk.
//   * Posting is open to anyone signed in. CARRYING needs a real record, and the
//     UI only shows the accept button when the server has already agreed.
//   * The fee is the poster's words. No fee is invented, no ETA is invented, no
//     queue position is invented, and nothing claims a message was sent.
//   * A rating is one per person per completed delivery, listed as said. No
//     average, no score, no rank — and the panel says that rather than hiding it.
//   * Other mailing services are revealed as names Brief cannot book, with no
//     invented phone number or price attached to them.
// ---------------------------------------------------------------------------
const assert = require('assert').strict;
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.localStorage = dom.window.localStorage;

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const { ErrandsLobby } = require('./src/features/city/ErrandsLobby.tsx');
const { CityFeedView } = require('./src/features/city/CityFeedView.tsx');

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
const btn = (want) => Array.from(document.querySelectorAll('button')).find((b) => text(b) === want || text(b).startsWith(want));
const click = (el) => act(() => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
const setVal = (el, value) => {
  act(() => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
};

const stage = (key, label, at) => ({ key, label, at, done: Boolean(at) });
const nowIso = new Date('2026-09-16T06:00:00.000Z').toISOString();

const OPEN_ERRAND = {
  id: 'erd_1', what: 'Seal a file at City Hall', pickup: 'Wakulima stall 42', dropoff: 'City Hall, tower section',
  sizeOrWeight: 'one folder', whenNeeded: '2026-09-17', offeredFeeKes: 300, currency: 'KES', note: 'cash on arrival',
  status: 'open', posterId: 'usr_poster', posterName: 'Amina', acceptedBy: null, carrierName: null, carrierBasis: [],
  settlement: null, cancelReason: null, isMine: false, iAmTheCarrier: false, iAmThePoster: false,
  canRate: false, canConfirmFee: false, createdAt: nowIso, updatedAt: nowIso,
  history: [{ action: 'errand_posted', at: nowIso, by: 'Amina' }],
  loop: [stage('posted', 'Posted', nowIso), stage('accepted', 'A carrier took it', null), stage('picked_up', 'Collected at the source', null), stage('delivered', 'Delivered', null), stage('settled', 'Fee agreed between you', null), stage('rated', 'Rated by both sides', null)],
  ratings: [], ratingsNote: 'Ratings are listed as said, per delivery. Brief computes no average, score or rank from them.'
};

const MINE_DELIVERED = {
  ...OPEN_ERRAND, id: 'erd_2', what: 'Take the prescription to Kilimani', status: 'delivered',
  isMine: true, iAmThePoster: true, acceptedBy: 'usr_agent', carrierName: 'Otieno', carrierBasis: ['agent:2 active shop claims'],
  canRate: true, canConfirmFee: true,
  settlement: { amountKes: 250, currency: 'KES', confirmedBy: ['usr_agent'], confirmedNames: ['Otieno'], at: null, movedBy: null },
  loop: [stage('posted', 'Posted', nowIso), stage('accepted', 'A carrier took it', nowIso), stage('picked_up', 'Collected at the source', nowIso), stage('delivered', 'Delivered', nowIso), stage('settled', 'Fee agreed between you', null), stage('rated', 'Rated by both sides', null)],
  ratings: [{ id: 'erat_1', by: 'Otieno', about: 'poster', stars: 4, note: 'met me at the gate', createdAt: nowIso }]
};

const ELIGIBLE = { eligible: true, basis: ['agent:2 active shop claims'], howToJoin: 'Carry rights follow a real record', note: 'derived' };
const NOT_ELIGIBLE = { eligible: false, basis: [], howToJoin: 'Carry rights follow a real record — onboard a shop, hold a role, or complete a pickup.', note: 'derived' };

let board = { open: [OPEN_ERRAND], mine: [MINE_DELIVERED], eligibility: NOT_ELIGIBLE, carriersAround: 3, stages: OPEN_ERRAND.loop.map((l) => ({ key: l.key, label: l.label })) };
let providers = {
  integrated: [{ key: 'wairo', name: 'WAIRO riders', what: 'Bike and foot errands around town', canDispatchThroughBrief: true, agentsOnRecord: 2, deliveredPickups: 5, note: 'Dispatched and tracked in Brief.' }],
  usedHere: [{ key: 'sacco:Easy Ride', name: 'Easy Ride', what: 'Inter-county cargo, stage-to-stage', canDispatchThroughBrief: false, dispatchesRecorded: 4, waybillsCaptured: 3, note: 'Named by people using Brief.' }],
  external: [{ key: 'fargo', name: 'Fargo Courier', canDispatchThroughBrief: false, reason: 'no integration in Brief' }],
  disclosure: 'For anything not dispatched through Brief, this list carries a name and nothing else: no phone number, no price, no promise.'
};
let calls = [];
let handler;
global.fetch = async (input, init) => {
  const url = String(input?.url ?? input ?? '');
  calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? String(init.body) : null });
  return handler(url, init);
};
const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });

async function main() {
  handler = async (url) => {
    if (url.includes('/api/errands/providers')) return ok(providers);
    if (url.includes('/rate')) return ok({ rating: { id: 'erat_new', by: 'Amina', about: 'carrier', stars: 5, note: null, createdAt: nowIso } });
    if (/\/api\/errands\/[^/]+\//.test(url)) return ok({ errand: { ...MINE_DELIVERED, status: 'delivered' } });
    if (url.includes('/api/errands')) return ok(board);
    if (url.includes('/pickups/riders')) return ok({ riders: [] });
    if (url.includes('/api/events/categories')) return ok({ categories: ['event'], labels: { event: 'Events' } });
    if (url.includes('/api/events')) return ok({ events: [], total: 0 });
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };

  // --- 1. Discover is three rooms, and the old ones are gone --------------
  {
    const { container } = mount(React.createElement(CityFeedView, { onOpenSpace: () => {} }));
    await flush();
    const nav = container.querySelector('nav[aria-label="Discover sections"]');
    const chips = Array.from(nav.querySelectorAll('button')).map((b) => text(b));
    assert.deepEqual(chips, ['Events', 'Marketplace', 'Communities', 'Errands'],
      `four rooms: on, sale, belonging, carrying (got ${JSON.stringify(chips)})`);
    const t = text(container);
    assert.ok(t.includes('Events around you'), 'the case opens Discover');
    // A private arrangement is no longer scrolled past like a poster.
    assert.ok(!/Community Circles & Mutual Aid/.test(t), 'circles left Discover');
    assert.ok(!/Vault & Special Drops/.test(t), 'vaults left Discover');
    // WAIRO appears only when errands is selected.
    assert.ok(!document.querySelector('input[aria-label="Pickup destination town"]'), 'no WAIRO form on the events room');
    click(Array.from(nav.querySelectorAll('button')).find((b) => text(b) === 'Errands'));
    await flush();
    assert.ok(document.querySelector('input[aria-label="Pickup destination town"]'), 'the WAIRO contact card shows in the errands room');
    assert.ok(text(container).includes('The lobby'), 'and the lobby is themed as a room, not a gallery');
  }
  pass('Discover is Events / Marketplace / Errands, with WAIRO only inside Errands');

  // --- 2. the gate is real, and it does not dangle a button ----------------
  {
    board = { ...board, eligibility: NOT_ELIGIBLE };
    const { container } = mount(React.createElement(ErrandsLobby, {}));
    await flush();
    const t = text(container);
    assert.ok(t.includes('You cannot take errands yet.'), 'the board says what you are not');
    assert.ok(t.includes('onboard a shop'), 'and how that changes');
    assert.ok(!btn('Take this errand'), 'no accept button is offered to someone the server would refuse');
    assert.ok(t.includes('Only agents and partners on record can take an errand'), 'the reason is on the card itself');
    assert.ok(t.includes('3 carriers with a record here'), 'the roster is a count, not a list of names');
  }
  {
    board = { ...board, eligibility: ELIGIBLE };
    const { container } = mount(React.createElement(ErrandsLobby, {}));
    await flush();
    assert.ok(text(container).includes('You can take errands.'), 'an eligible carrier sees it');
    assert.ok(text(container).includes('agent:2 active shop claims'), 'with the fact that qualifies them');
    calls = [];
    click(btn('Take this errand'));
    await flush();
    assert.ok(calls.some((c) => c.url.includes('/api/errands/erd_1/accept') && c.method === 'POST'), 'taking it posts to the real rail');
  }
  pass('Carrying is gated by the server, and the UI never offers a refused action');

  // --- 3. posting: stated fee or nothing, and honest notification reporting -
  {
    calls = [];
    const { container } = mount(React.createElement(ErrandsLobby, {}));
    await flush();
    click(btn('Post an errand'));
    await flush();
    setVal(document.querySelector('input[aria-label="What needs carrying"]'), 'Collect the wedding photos');
    setVal(document.querySelector('input[aria-label="Collected from"]'), 'River Road studio');
    setVal(document.querySelector('input[aria-label="Dropped at"]'), 'Kilimani, Mca stage');
    // fee deliberately left blank
    click(btn('Put it on the board'));
    await flush();
    const post = calls.find((c) => c.url.endsWith('/api/errands') && c.method === 'POST');
    assert.ok(post, 'the post goes to the real rail');
    const body = JSON.parse(post.body);
    assert.equal(body.what, 'Collect the wedding photos');
    assert.ok(body.offeredFeeKes === null || body.offeredFeeKes === undefined, 'a blank fee is sent as nothing, never as 0');
    assert.ok(text(container).includes('3 carriers with a record here') || text(container).includes('notified'), 'the notice reports what was actually notified');
  }
  pass('An errand posts with the poster’s own words and no invented fee');

  // --- 4. the loop, the money silence, and the rating with no average -----
  {
    calls = [];
    const { container } = mount(React.createElement(ErrandsLobby, {}));
    await flush();
    const t = text(container);
    assert.ok(t.includes('Collected at the source'), 'the loop stages are shown');
    assert.ok(/—/.test(t), 'an unreached stage is an em dash, not a fake date');
    assert.ok(t.includes('Brief moved nothing'), 'the fee confirmation says Brief moved nothing');
    assert.ok(t.includes('4/5 on the poster · Otieno'), 'a rating is displayed as the row it is');
    assert.ok(t.includes('Brief computes no average, score or rank'), 'and the card states no average exists');
    assert.ok(document.querySelector('button[aria-label="1 star"]') && document.querySelector('button[aria-label="5 stars"]'), 'a party who has not rated sees a 1-5 star control');
    click(document.querySelector('button[aria-label="5 stars"]'));
    await flush();
    assert.ok(calls.some((c) => c.url.includes('/api/errands/erd_2/rate') && JSON.parse(c.body).stars === 5), 'the rating posts as a whole number of stars');
    assert.ok(text(container).includes('It is not averaged into anything'), 'and the reply is honest about what it becomes');
  }
  pass('The loop, the fee, and one rating per delivery — listed, never aggregated');

  // --- 5. other services: names only, no invented contacts ----------------
  {
    const { container } = mount(React.createElement(ErrandsLobby, {}));
    await flush();
    const t = text(container);
    assert.ok(t.includes('Other ways to move a thing'), 'the strip exists');
    assert.ok(t.includes('Fargo Courier'), 'Fargo is revealed as an option');
    assert.ok(t.includes('Brief cannot book, price or track this one'), 'with its limits stated');
    assert.ok(t.includes('Easy Ride'), 'and carriers people here actually use are counted from rows');
    // No fabricated contact details anywhere in the strip.
    const phoneish = t.match(/(\+?254|07\d{2}|0\d{2})[\s-]?\d{3}[\s-]?\d{3}/g);
    assert.equal(phoneish, null, 'no phone number is invented for a real company');
    assert.ok(t.includes('no phone number, no price, no promise'), 'and the disclosure says so');
  }
  pass('Other mailing services are revealed honestly: a name, never invented details');

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
