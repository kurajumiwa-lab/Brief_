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

  // --- 1. Discover is four rooms on tiles, and the old ones are gone --------
  {
    const { container } = mount(React.createElement(CityFeedView, { onOpenSpace: () => {} }));
    await flush();
    const tiles = Array.from(container.querySelectorAll('button[role="tab"]')).map((b) => text(b));
    assert.ok(tiles.some((x) => /Bulk/.test(x)), 'the flows lead the grid');
    assert.ok(tiles.some((x) => /Events/.test(x)), 'Events is a tile');
    assert.ok(tiles.some((x) => /Circles/.test(x)), 'Circles is a side view');
    assert.ok(tiles.some((x) => /Errands/.test(x)), 'Errands is a tile');

    assert.equal(container.querySelector('nav[aria-label="Discover sections"]'), null, 'no chip row survives');
    const errandsTile = Array.from(container.querySelectorAll('button[role="tab"]')).find((b) => /^\s*Errands/.test(text(b)));
    click(errandsTile);
    await flush();
    assert.ok(text(container).includes('The lobby'), 'the errands room opened from the grid');
    assert.ok(document.querySelector('input[aria-label="Pickup destination town"]'), 'the WAIRO card lives here only');
    assert.ok(text(container).includes('Seal a file at City Hall'), 'the real open errand from the rail is on the board');
    assert.ok(!/\d+ riders? (nearby|around)/i.test(text(container)), 'no invented crowd size');
    assert.ok(btn('Post an errand'), 'the lobby carries its own post action');
  }
  pass('Discover navigates by tiles, and WAIRO lives only inside Errands');

  // --- 1b. an empty board says so, in words a vendor can act on -----------
  {
    const saved = board;
    board = { ...board, open: [] };
    const { container } = mount(React.createElement(ErrandsLobby, {}));
    await flush();
    assert.ok(text(container).includes('Nothing is posted right now.'), 'the empty is stated plainly');
    assert.ok(text(container).includes('not a hidden queue'), 'and refuses to imply a queue behind it');
    board = saved;
  }
  pass('An empty errands board is reported as empty');

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
    assert.ok(t.includes('No booking, price or tracking inside Brief'), 'with its limits stated, in one clause');
    assert.ok(!t.includes('Fargo has no integration in Brief'), 'the long reason is not pasted on every card');
    const why = Array.from(container.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Why');
    assert.ok(why, 'the reason is offered');
    act(() => { why.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    assert.ok(/no integration in Brief|will not quote a price/i.test(text(container)), 'and one tap states it in full');
    assert.ok(t.includes('Easy Ride'), 'and carriers people here actually use are counted from rows');
    // No fabricated contact details anywhere in the strip.
    const phoneish = t.match(/(\+?254|07\d{2}|0\d{2})[\s-]?\d{3}[\s-]?\d{3}/g);
    assert.equal(phoneish, null, 'no phone number is invented for a real company');
    assert.ok(t.includes('no phone number, no price, no promise'), 'and the disclosure says so');
  }
  pass('Other mailing services are revealed honestly: a name, never invented details');


  // --- the eligibility badge is words, with the code kept for audit ---------
  {
    const { basisLabel } = require('./src/features/city/ErrandsLobby.tsx');
    assert.equal(basisLabel('role:field_agent'), 'Field agent', 'a role reads as a role');
    assert.equal(basisLabel('agent:4 active shop claims'), '4 shops run from this account', 'and a count reads as a count of things');
    assert.equal(basisLabel('rider:1 pickup assigned'), '1 pickup assigned to you');
    assert.equal(basisLabel('whatever:else'), 'whatever:else', 'an unknown code is passed through, never guessed at');
    assert.ok(!/agent:|rider:|role:/.test(basisLabel('agent:4 active shop claims') + basisLabel('rider:1 pickup assigned') + basisLabel('role:partner')),
      'no raw code is printed for a person to decode');

    // …and the guarantee is checked on the RENDERED chip, not only on the
    // helper. An earlier version of this test passed while the component still
    // printed the raw code: a unit test that never touches the surface is a
    // test of a function nobody calls.
    board = { ...board, eligibility: ELIGIBLE };
    {
      const { container } = mount(React.createElement(ErrandsLobby, {}));
      await flush();
      const chips = Array.from(container.querySelectorAll('.brief-lobby-stage')).map((el) => ({
        t: (el.textContent || '').trim(),
        code: el.getAttribute('title')
      }));
      const claimed = chips.filter((c) => /shop/.test(c.t));
      assert.ok(claimed.length > 0, `the claim basis renders as words (chips: ${JSON.stringify(chips.map((c) => c.t))})`);
      assert.ok(claimed.every((c) => /^\d+ shops? run from this account$/.test(c.t)), 'a count reads as a count of shops');
      assert.ok(claimed.every((c) => /^agent:\d+ active shop claims?$/.test(c.code || '')), 'and the raw basis rides on title= for the audit');
      assert.ok(!chips.some((c) => /\brole:/.test(c.t)), 'no chip prints a role key');
    }
  }
  pass('Eligibility says what it means, and keeps the audit code one attribute away');

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
