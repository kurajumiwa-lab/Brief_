// ---------------------------------------------------------------------------
// HOME ZONES — the three-zone reformation, pinned against fabrication.
//
// Home answers three questions in three zones, and every figure in them has to
// trace to a row. These tests hold that line:
//
//   SignalBar     renders the facts /api/pulse composed; stamps them with the
//                 newest real row time; NEVER prints a percentage movement
//                 (no price history exists in this store); renders an honest
//                 error rather than a silent "all quiet".
//   NextMoveCard  renders the derived move and nothing more: a countdown only
//                 when the request row really holds `requiredBy`; a price only
//                 when it is the viewer's own offer or a real accepted offer;
//                 the action navigates to the real request surface.
//   StandingLine  counts, not rank: no "#7", no "Sector", no "tier".
//   CirclesStrip  the caller's numbers, verbatim.
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
const { SignalBar } = require('./src/features/home/SignalBar.tsx');
const { NextMoveCard } = require('./src/features/home/NextMoveCard.tsx');
const { StandingLine } = require('./src/features/home/StandingLine.tsx');
const { CirclesStrip } = require('./src/features/home/CirclesStrip.tsx');

let count = 0;
const pass = (n) => { count++; console.log('PASS ' + n); };
const flush = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const btnByText = (want) =>
  Array.from(document.querySelectorAll('button')).find((b) => text(b) === want || text(b).startsWith(want));

const PULSE = {
  asOf: '2026-09-15T07:12:00.000Z',
  sections: {
    demand: { open: 3, bySeverity: { no_supplier: 1, awaiting_quote: 1, awaiting_accept: 1 }, collective: 1 },
    closure: { windowDays: 30, closed: 4, topCategory: { category: 'produce', closed: 2 } },
    fill: { windowDays: 30, closed: 4, avgHoursToFill: 5.7, hoursSampleCount: 4, avgValue: { amount: 1955, currency: 'KES', sampleCount: 3 } },
    money: { windowDays: 30, settledOrders: 2, settledValue: 12400, settledCurrency: 'KES', completedWorkOrders: 1, deliveredPickups: 5 },
    listings: { active: 7, snapshot: [{ type: 'product', count: 7, currency: 'KES', minPrice: 300, avgPrice: 1500, maxPrice: 4200 }] },
    events: { open: 2, newLast24h: { requests: 1, events: 0, listings: 2, orders: 0 } }
  },
  facts: [
    { id: 'gaps', text: '3 requests open with no accepted quote' },
    { id: 'closure', text: '4 requests closed in the last 30 days' },
    { id: 'money', text: '2 orders settled for KES 12,400 in the last 30 days' }
  ],
  empty: false,
  note: 'derived from real rows'
};

const NEXT_MOVE = {
  requestId: 'req_9',
  title: '200kg of Irish potatoes, twice a week',
  category: 'produce',
  location: 'Wakulima Market',
  quantity: 200,
  unit: 'kg',
  currency: 'KES',
  severityLabel: 'Suppliers matched; no quote yet',
  matchCount: 4,
  collective: true,
  openedAt: '2026-09-15T01:00:00.000Z',
  ageHours: 6,
  requiredBy: '2026-09-18',
  hoursUntilRequiredBy: 78,
  myQuote: null,
  precedent: { closedInWindow: 2, windowDays: 30, avgHoursToFill: 5.7, avgValue: null },
  why: 'This was matched to one of your enterprises',
  evidence: { table: 'requests', id: 'req_9' }
};

const POSITION = {
  decay: { expiringQuotes: [{ quoteId: 'q1', requestId: 'r1', title: 'Catering for 50', validUntil: '2026-09-20', hoursLeft: 24 }], waitlist: [], override: null, overdueInstallments: 0 },
  missedCapture: { count: 2, recent: [], value: { amount: 2400, currency: 'KES', over: '30 days', sampleCount: 2 } },
  nextMove: NEXT_MOVE,
  open: { total: 3, top: [] },
  derivedAt: '2026-09-15T07:20:00.000Z',
  note: 'derived'
};

let fetchHandler;
global.fetch = async (input) => fetchHandler(String(input?.url ?? input ?? ''));

async function main() {
  // --- SignalBar: real facts, snapshot stamp, no invented trend ------------
  fetchHandler = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(PULSE) });
  {
    const c = document.createElement('div');
    document.body.appendChild(c);
    const root = createRoot(c);
    act(() => root.render(React.createElement(SignalBar, {})));
    await flush();
    const t = text(c);
    assert.ok(t.includes("What's moving"), 'the bar names itself');
    assert.ok(t.includes('3 requests open with no accepted quote'), 'a real derived fact renders');
    assert.ok(/newest row \d/.test(t), 'stamped with the newest real row, labelled as such');
    assert.ok(/newest row [^·]* · \d\d:\d\d/.test(t), 'the stamp carries a DATE as well as a clock time, so a three-day-old snapshot cannot read as now');
    assert.ok(!/live/i.test(t), 'no live-stream claim');
    assert.ok(!t.includes('%'), 'no percentage movement is printed (no price history exists)');
    assert.ok(t.includes('3 signals'), 'the signal count is available');
    act(() => { btnByText('3 signals').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    const d = text(c);
    assert.ok(d.includes('4 requests closed in the last 30 days'), 'details list every real fact');
    assert.ok(d.includes('2 orders settled for KES 12,400'), 'money moved is real money from rows');
    assert.ok(d.includes('no market price index'), 'the bar states what it is not');
    root.unmount(); c.remove();
  }
  pass('SignalBar renders only derived facts, stamped as a snapshot, with no fake trend');

  // --- StakesLine: the loss frame, but only as far as a row carries it ------
  const { StakesLine } = require('./src/features/home/StakesLine.tsx');
  const moneyLine = (pos, sp, extra = {}) => {
    const c = document.createElement('div');
    document.body.appendChild(c);
    const root = createRoot(c);
    act(() => root.render(React.createElement(StakesLine, { position: pos, spaces: sp, loading: false, ...extra })));
    const out = text(c);
    root.unmount(); c.remove();
    return out;
  };
  {
    // A real lost order: the quote row says the buyer chose someone else, and the
    // money is the sum of MY OWN declined offers.
    const t = moneyLine(
      { missedCapture: { count: 2, recent: [], value: { amount: 9600, currency: 'KES', over: '30 days', sampleCount: 2 } }, open: { total: 4, top: [{ title: 'Maize, 50 bags' }] } },
      [{ id: 's1', name: 'Shop', offers: [{ id: 'l1', status: 'active' }] }]
    );
    assert.ok(t.includes('2 quotes of yours ended with the buyer choosing someone else'), 'a lost order is named as one');
    assert.ok(t.includes('KES 9,600'), 'with the sum of the user’s own offers');
    assert.ok(t.includes('at stake'), 'tagged as at stake, not as a score');
    // …and when those offers carried no completed price, NO money appears.
    const bare = moneyLine({ missedCapture: { count: 1, recent: [], value: null }, open: { total: 0, top: [] } }, []);
    assert.ok(bare.includes('those offers carried no completed price'), 'the absence is stated');
    assert.ok(!/KES/.test(bare), 'and no amount is conjured to fill it');
    // Demand exists, nothing published: the gap is the story.
    const invisible = moneyLine({ missedCapture: { count: 0, recent: [], value: null }, open: { total: 5, top: [] } }, [{ id: 's', name: 'S', offers: [] }]);
    assert.ok(invisible.includes('5 requests are open') && invisible.includes('you have no live offer'), 'the findability gap, in row terms');
    assert.ok(!/90%|invisible to most buyers/.test(invisible), 'and not as a made-up percentage of shoppers');
    // A genuinely quiet week is said as a quiet week.
    const quiet = moneyLine({ missedCapture: { count: 0, recent: [], value: null }, open: { total: 0, top: [] } }, [{ id: 's', name: 'S', offers: [{ id: 'l', status: 'active' }] }]);
    assert.ok(/quiet week, not a warning/.test(quiet), 'a true zero is not dressed as failure');
    assert.ok(!/losing|at stake/.test(quiet), 'and no stakes are invented against it');
    // A failed read never becomes a calm all-clear.
    const failed = moneyLine(null, null, { failed: true });
    assert.ok(/could not be read, so nothing here is claimed/.test(failed), 'the failure is the message');
    // The frame Brief will not use at all.
    const all = moneyLine({ missedCapture: { count: 3, recent: [], value: { amount: 100, currency: 'KES', over: '30 days', sampleCount: 1 } }, open: { total: 0, top: [] } }, []);
    assert.ok(!/staff hours|hours you can’t verify|hours you can't verify/i.test(all), 'no unverifiable staff-hours claim');
    assert.ok(!/could have earned/.test(all), 'no counterfactual earnings figure');
    assert.ok(all.includes('covers 1 of the 3'), 'a partial sum says what it covers');
  }
  pass('StakesLine frames loss only where a row exists, and says a quiet week is quiet');

  // --- WorldStrip: the country's movement, not the user's ------------------
  const WORLD = {
    ok: true, available: true, provider: 'Open-Meteo', kind: 'forecast', observedAt: null, horizonDays: 7,
    place: 'Nairobi', placeIsDefault: true, defaultPlace: 'Nairobi',
    resolvedPlace: { name: 'Nairobi', admin: 'Nairobi County', country: 'Kenya' },
    elevationM: 1671, model: 'best_match', retrievedAt: '2026-09-17T06:00:00Z', ageHours: 0.2, fromCache: false, stale: false,
    facts: [
      { kind: 'rain', text: 'Heavy rain forecast in 3 days (Sat): 24.3 mm, 99% likely', value: 24.3, unit: 'mm', date: '2026-09-20', inDays: 3, chance: 99 },
      { kind: 'dry', text: 'Dry spell holds: no rain for the next 2 days', value: 2, unit: 'days', thresholdMm: 1 },
      { kind: 'heat', text: 'Hottest afternoon in 5 days: 28.1 °C', value: 28.1, unit: '°C', date: '2026-09-22' }
    ],
    dryRunDays: 2, wetDays: 3,
    prices: { status: 'not_configured', reason: 'no key-free commodity-price endpoint is reachable' },
    fuel: { status: 'not_configured', reason: 'EPRA publishes a document, not an API' },
    error: null
  };
  fetchHandler = async (url) => ({
    ok: true, status: 200,
    text: async () => JSON.stringify(String(url).includes('/api/world') ? WORLD : PULSE)
  });
  {
    const { WorldStrip } = require('./src/features/home/WorldStrip.tsx');
    const c = document.createElement('div');
    document.body.appendChild(c);
    const root = createRoot(c);
    act(() => root.render(React.createElement(WorldStrip, {})));
    await flush();
    const t = text(c);
    assert.ok(t.includes('The world, today'), 'the strip names what it is');
    assert.ok(t.includes('Heavy rain forecast in 3 days (Sat): 24.3 mm, 99% likely'), 'every sentence is the server\'s, verbatim');
    assert.ok(t.includes('Nairobi') && t.includes('Nairobi County'), 'the place and the gazetteer\'s own labels show');
    assert.ok(/default/i.test(t), 'a place nobody chose is announced as the default');
    assert.ok(t.includes('Open-Meteo'), 'the source is on the surface, not buried');
    assert.ok(t.includes('Prices and fuel are not wired'), 'the gaps are stated, in one line');
    assert.ok(!/\+\d+(\.\d+)?%\s|maize|KES \d/i.test(t), 'no commodity movement and no money figure is invented here');
    assert.ok(!/\bLIVE\b/.test(t), 'a forecast is not a live feed');
    // the provenance is deferred, not deleted: one tap shows the licence and the reasons
    act(() => { btnByText('How this is derived').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    const d = text(c);
    assert.ok(d.includes('no seasonal average'), 'the rule is one tap away and still true');
    assert.ok(d.includes('EPRA publishes a document, not an API'), 'the fuel gap states its own reason');
    root.unmount(); c.remove();
  }
  pass('WorldStrip reports the provider\'s own sentences, dated and attributed, and invents nothing');

  // --- WorldStrip: an outage is a gap, not a zero --------------------------
  fetchHandler = async (url) => ({
    ok: true, status: 200,
    text: async () => JSON.stringify(String(url).includes('/api/world')
      ? { ok: false, available: false, provider: 'Open-Meteo', facts: [], error: 'the provider could not be reached (socket hang up), and Brief has no recent read to show instead. A gap is shown as a gap.', place: 'Nairobi', placeIsDefault: true, prices: { status: 'not_configured' }, fuel: { status: 'not_configured' } }
      : PULSE)
  });
  {
    const { WorldStrip } = require('./src/features/home/WorldStrip.tsx');
    const c = document.createElement('div');
    document.body.appendChild(c);
    const root = createRoot(c);
    act(() => root.render(React.createElement(WorldStrip, {})));
    await flush();
    const t = text(c);
    assert.ok(t.includes('could not be reached'), 'the failure is the provider\'s, stated');
    assert.ok(!/0 mm|0 days|no rain/i.test(t), 'and it is not rendered as a measurement of zero');
    assert.ok(Boolean(Array.from(c.querySelectorAll('button')).find((b) => text(b) === 'Retry')), 'with a way to try again');
    root.unmount(); c.remove();
  }
  pass('A failed world read says it failed — no zeros, no stale fact dressed as current');

  // --- SignalBar: a dead read is an error, not an all-clear ----------------
  fetchHandler = async () => ({ ok: false, status: 500, text: async () => JSON.stringify({ error: 'boom' }) });
  {
    const c = document.createElement('div');
    document.body.appendChild(c);
    const root = createRoot(c);
    act(() => root.render(React.createElement(SignalBar, {})));
    await flush();
    const t = text(c);
    assert.ok(t.includes('Signals unavailable'), 'a failed read says so');
    assert.ok(!t.includes('Nothing has moved'), 'a failure never masquerades as an empty ledger');
    assert.ok(btnByText('Retry'), 'a retry exists');
    root.unmount(); c.remove();
  }
  pass('SignalBar renders an honest error with a retry instead of a fake "all quiet"');

  // --- NextMoveCard: the one decision, and nothing invented on top ---------
  {
    const c = document.createElement('div');
    document.body.appendChild(c);
    const root = createRoot(c);
    act(() => root.render(React.createElement(NextMoveCard, { position: POSITION })));
    await flush();
    const t = text(c);
    assert.ok(t.includes('Your next step'), 'the hero is labelled');
    assert.ok(t.includes('200kg of Irish potatoes'), 'the real request title renders');
    assert.ok(t.includes('This was matched to one of your enterprises'), 'the ranking reason is shown');
    assert.ok(t.includes('4 suppliers matched'), 'match count is the real counted matches');
    assert.ok(t.includes('needed by 2026-09-18'), 'a deadline renders only because the row carries one');
    assert.ok(t.includes('2× closed in 30 days'), 'precedent is a real closure count');
    assert.ok(t.includes('5.7h to fill on average'), 'fill time is averaged over real timestamps');
    assert.ok(t.includes('the requester’s budget is private'), 'no price is invented when none is derivable');
    assert.ok(!t.includes('KES 340'), 'the brief\u2019s example figure is not echoed as truth');
    assert.ok(btnByText('Respond to this demand'), 'the action is the real one: respond on the request');

    // The action goes somewhere that exists.
    act(() => { btnByText('Respond to this demand').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    assert.ok(String(dom.window.location.hash).includes('requests/req_9'), 'the action routes to the request');

    // "Not now" hides it with a stated, device-local reason.
    act(() => { btnByText('Not now').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    assert.ok(text(c).includes('hidden on this device'), 'dismissal is honest about its scope');
    assert.ok(localStorage.getItem('brief.nextMoveHidden.v1') === 'req_9', 'the dismissal is a real local record');
    root.unmount(); c.remove();
  }
  pass('NextMoveCard shows the derived move, no invented price, and takes a real action');

  // --- NextMoveCard: nothing open, and a failed read -----------------------
  {
    const c = document.createElement('div');
    document.body.appendChild(c);
    const root = createRoot(c);
    act(() => root.render(React.createElement(NextMoveCard, { position: { ...POSITION, nextMove: null } })));
    assert.ok(text(c).includes('No open demand on the ledger right now.'), 'no move is stated as no move');
    root.unmount(); c.remove();

    const c2 = document.createElement('div');
    document.body.appendChild(c2);
    const root2 = createRoot(c2);
    act(() => root2.render(React.createElement(NextMoveCard, { position: null })));
    assert.ok(text(c2).includes('could not be read'), 'a failed read is an error, not silence');
    assert.ok(btnByText('Try again'), 'retry offered');
    root2.unmount(); c2.remove();
  }
  pass('NextMoveCard distinguishes "nothing open" from "could not read"');

  // --- StandingLine: counts, never rank ------------------------------------
  {
    const c = document.createElement('div');
    document.body.appendChild(c);
    const root = createRoot(c);
    act(() => root.render(React.createElement(StandingLine, {
      position: POSITION,
      commitments: {
        owedByMe: [{ id: 'a' }], owedToMe: [{ id: 'b' }, { id: 'c' }],
        fulfilled: [], lapsed: [], owedByMeKes: 850, owedToMeKes: 1240,
        derivedAt: '2026-09-15T00:00:00Z', note: 'derived'
      },
      reciprocity: { owedToMe: [], owedByMe: [], fulfilled: [], aging: [{ id: 'f' }], windowDays: 14, derivedAt: '', note: '' }
    })));
    const t = text(c);
    assert.ok(t.includes('1 proposal expiring'), 'expiring proposals counted from real rows');
    assert.ok(t.includes('2 owed to you (KES 1,240)'), 'owed-to-you is a real count and a real sum');
    assert.ok(t.includes('1 you owe (KES 850)'), 'you-owe likewise');
    assert.ok(t.includes('2 proposals went to someone else (KES 2,400 of your own offers, 30 days)'), 'missed value is the viewer\u2019s own offers only');
    assert.ok(t.includes('1 favour unreturned'), 'aging favors are counted');
    assert.ok(!/position #\d/i.test(t), 'no rank is invented');
    assert.ok(!/sector/i.test(t), 'no sector is invented');
    assert.ok(!/tier/i.test(t), 'no tier ladder is invented');
    root.unmount(); c.remove();

    const c2 = document.createElement('div');
    document.body.appendChild(c2);
    const root2 = createRoot(c2);
    act(() => root2.render(React.createElement(StandingLine, { position: null, commitments: null, reciprocity: null })));
    assert.equal(text(c2), '', 'no read -> no claim');
    root2.unmount(); c2.remove();
  }
  pass('StandingLine reports real counts and refuses to invent a rank');

  // --- CirclesStrip: the caller's numbers, verbatim ------------------------
  {
    const c = document.createElement('div');
    document.body.appendChild(c);
    const root = createRoot(c);
    let clicked = false;
    act(() => root.render(React.createElement(CirclesStrip, {
      spaces: 3, circles: 1, needsYou: 1, onView: () => { clicked = true; }
    })));
    const t = text(c);
    assert.ok(t.includes('3 spaces · 1 circle · 1 needs you'), 'the strip renders exactly the counts given');
    act(() => { btnByText('View').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    assert.ok(clicked, 'View is a real action');
    root.unmount(); c.remove();
  }
  pass('CirclesStrip renders the derived counts and a real View action');

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
