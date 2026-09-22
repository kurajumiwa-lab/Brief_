// ---------------------------------------------------------------------------
// HOME ZONES — the three-zone reformation, pinned against fabrication.
//
// Home answers three questions in three zones, and every figure in them has to
// trace to a row. These tests hold that line:
//
//   BannerButton  the hero is ONE dark-gradient banner ("What's moving
//                 today →") — the only loud thing on Home, and the door into
//                 the pulse ledger. The rotating fact bar it replaced is
//                 gone with the SignalBar: the facts stand in the drawer.
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
const { BannerButton } = require('./src/ui/BannerButton.tsx');
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
  // --- BannerButton: the one dark-gradient thing on the screen -------------
  fetchHandler = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(PULSE) });
  {
    const c = document.createElement('div');
    document.body.appendChild(c);
    const root = createRoot(c);
    let opened = false;
    act(() => root.render(React.createElement(BannerButton, {
      label: "What's moving today",
      onClick: () => { opened = true; }
    })));
    await flush();
    const banner = c.querySelector('[data-testid=gradient-banner]');
    assert.ok(banner, 'the hero is the gradient banner');
    assert.ok(text(c).includes("What's moving today"), 'the banner names itself');
    const style = banner.getAttribute('style') || '';
    assert.ok(/linear-gradient/i.test(style), 'a dark gradient background, not a flat chip');
    assert.ok(banner.querySelector('svg'), 'the arrow sits on the right');
    // White bold label, dark background: loud by design, and only once.
    const label = Array.from(banner.querySelectorAll('span')).find((s) => (s.className || '').includes('text-white'));
    assert.ok(label && (label.className || '').includes('font-bold'), 'the label is white and bold on the dark gradient');
    act(() => { banner.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    assert.ok(opened, 'the banner opens the pulse ledger');
    root.unmount(); c.remove();
  }
  pass('Home hero is the one dark-gradient banner: label, white bold, arrow, one action');

  // --- StakesLine: numbers, a dot, one action; loss only where a row holds it --
  const { StakesLine } = require('./src/features/home/StakesLine.tsx');
  const line = (pos, sp, extra = {}) => {
    const c = document.createElement('div');
    document.body.appendChild(c);
    const root = createRoot(c);
    act(() => root.render(React.createElement(StakesLine, { position: pos, spaces: sp, loading: false, ...extra })));
    const out = text(c);
    root.unmount(); c.remove();
    return out;
  };
  {
    const base = { decay: { expiringQuotes: [] }, open: { total: 0, top: [] } };
    const lost = line({ ...base, missedCapture: { count: 2, recent: [], value: { amount: 9600, currency: 'KES', over: '30 days', sampleCount: 2 } } },
      [{ id: 's1', name: 'Shop', offers: [{ id: 'l1', status: 'active' }] }]);
    assert.ok(/2 lost/.test(lost), 'a lost order is counted in two words');
    assert.ok(lost.includes('KES 9,600'), 'valued at the user’s own declined offers');
    assert.ok(lost.length < 170, `it is a glance, not a paragraph (${lost.length} chars)`);
    assert.ok(!/ended with the buyer choosing|that is a quiet|not a warning/.test(lost), 'and nothing is explained about the dot');
    const bare = line({ ...base, missedCapture: { count: 1, recent: [], value: null } }, []);
    assert.ok(!/KES/.test(bare), 'no amount appears when no row carried a price');
    const gap = line({ ...base, open: { total: 5, top: [] }, missedCapture: { count: 0, recent: [], value: null } },
      [{ id: 's', name: 'S', offers: [] }], { onPostOffer: () => {} });
    assert.ok(/0 offers live/.test(gap) && /gap/.test(gap), 'the findability gap is a state, marked by a dot');
    assert.ok(/Post an offer/.test(gap), 'with exactly one action');
    assert.ok(!/90%|invisible to/.test(gap), 'never as a made-up share of buyers');
    const quiet = line({ ...base, missedCapture: { count: 0, recent: [], value: null } }, [{ id: 's', name: 'S', offers: [{ id: 'l', status: 'active' }] }]);
    assert.ok(/1 offers live/.test(quiet) && /quiet/.test(quiet), 'a quiet week is a dot and a word');
    assert.ok(!/warning/.test(quiet), 'and the argument with the reader is gone');
    const failed = line(null, null, { failed: true });
    assert.ok(/No read — nothing claimed/.test(failed), 'a failed read claims nothing, in five words');
  }
  pass('StakesLine: a count, a dot, one action — the loss only as big as the row behind it');



  // --- PlannedWeather: a forecast only where it lands on a planned day -----
  const MATCHED = {
    available: true,
    reason: null,
    provider: 'Open-Meteo', providerLicence: 'CC BY 4.0', horizonDays: 7,
    note: 'Weather is shown only for a day you have something planned. Nothing planned, nothing shown.',
    unmatchedDays: 0,
    plannedDays: [{ date: '2026-09-20', dayIndex: 3, events: [{ title: 'Kisii Saturday market' }] }],
    matched: [{
      date: '2026-09-20', dayIndex: 3, eventTitle: 'Kisii Saturday market', eventCount: 1,
      campaignId: 'cmp_1', slug: 'kisii-market', startsAt: '2026-09-20T08:00:00+03:00', location: 'Kisii',
      fact: { kind: 'rain', text: 'Heavy rain forecast in 3 days (Sat): 24.3 mm, 99% likely', value: 24.3, unit: 'mm' }
    }]
  };
  const EMPTY_PLAN = { ...MATCHED, matched: [], plannedDays: [], reason: 'nothing_planned' };
  const BROKEN = {
    available: false, matched: [], plannedDays: [{ date: '2026-09-20', dayIndex: 3, events: [] }],
    reason: 'world_read_unavailable', provider: null, providerLicence: null, horizonDays: null,
    note: MATCHED.note, unmatchedDays: 1
  };
  const mountWeather = async (payload) => {
    fetchHandler = async (url) => ({
      ok: true, status: 200,
      text: async () => JSON.stringify(String(url).includes('/api/planned-weather') ? payload : PULSE)
    });
    const { PlannedWeather } = require('./src/features/home/PlannedWeather.tsx');
    const c = document.createElement('div');
    document.body.appendChild(c);
    const root = createRoot(c);
    act(() => root.render(React.createElement(PlannedWeather, {})));
    await flush();
    return { c, root, t: text(c) };
  };
  {
    const { c, root, t } = await mountWeather(MATCHED);
    assert.ok(t.includes('Kisii Saturday market'), 'the line names the plan the weather is about');
    assert.ok(/24\.3 mm, 99% likely/.test(t), 'and quotes the provider\'s sentence, unchanged');
    const link = Array.from(c.querySelectorAll('a')).find((a) => /\/c\//.test(a.getAttribute('href') || ''));
    assert.ok(link && link.getAttribute('href') === '/c/kisii-market', 'a plan with a real page links to it');
    assert.ok(/a model, not a measurement/.test(t), 'and says a forecast is a model output');
    assert.ok(!/bring|cover|warning|alert|avoid/.test(t), 'no advice, no alarm: the fact is the whole card');
    assert.ok(!/\bLIVE\b/.test(t), 'a forecast is not a live feed');
    root.unmount(); c.remove();
  }
  pass('PlannedWeather quotes one dated fact against one planned day, and links only a real page');

  // --- the two cases where the honest answer is: no card at all ------------
  {
    const { c, root, t } = await mountWeather(EMPTY_PLAN);
    assert.equal(t, '', 'nothing planned, nothing rendered — not a generic week, not a zero');
    root.unmount(); c.remove();
  }
  {
    const { c, root, t } = await mountWeather(BROKEN);
    assert.equal(t, '', 'an unreachable provider yields silence, not a stale line dressed as current');
    root.unmount(); c.remove();
  }
  {
    fetchHandler = async () => ({ ok: false, status: 401, text: async () => JSON.stringify({ error: 'authentication required' }) });
    const { PlannedWeather } = require('./src/features/home/PlannedWeather.tsx');
    const c = document.createElement('div');
    document.body.appendChild(c);
    const root = createRoot(c);
    act(() => root.render(React.createElement(PlannedWeather, {})));
    await flush();
    assert.equal(text(c), '', 'and a signed-out visitor is not shown a card about a gap they were never in');
    root.unmount(); c.remove();
  }
  pass('No plan, no dated fact, no provider, no session — Home shows no weather card');

  // --- EarnStrip: the income rails, quoted from the server -----------------
  const REFERRALS = {
    code: 'ABC', maxDepth: 2, link: '/c/x',
    balance: { earned: 900, locked: 300, available: 600 },
    pool: { balanceKes: 12000 },
    conversion: { ptsToKes: 0.1, minPoints: 500 },
    events: [{ id: 'e1', kind: 'guardian_order', points: 600, valueKes: 60000, at: '2026-09-01T00:00:00Z' }],
    conversions: [{ id: 'c1', points: 500, kes: 50, status: 'pending', refusedReason: null, createdAt: '2026-09-10T00:00:00Z' }]
  };
  const AGENT = {
    claims: [], settlements: [], visits: [],
    // Decision 5: two approved visits x KES 150 = KES 300. No rate, no window.
    earnings: {
      agentId: 'u1', feeKes: 150, currency: 'KES',
      visits: [
        { visitId: 'fv1', vendorId: 'v1', vendorName: 'Testshop', purpose: 'full_registration', status: 'approved', notes: 'Met the owner.', submittedAt: '2026-08-01T00:00:00Z', decidedAt: '2026-08-02T00:00:00Z', decidedBy: 'op1', rejectReason: null, week: '2026-W31', feeKes: 150, contactName: 'Jane', contactMethod: '+254700000000', businessType: 'retailer', location: 'Kilimani' },
        { visitId: 'fv2', vendorId: 'v2', vendorName: 'Secondshop', purpose: 'menu_upload', status: 'approved', notes: 'Photographed the menu.', submittedAt: '2026-08-03T00:00:00Z', decidedAt: '2026-08-04T00:00:00Z', decidedBy: 'op1', rejectReason: null, week: '2026-W31', feeKes: 150, contactName: 'Jim', contactMethod: '+254711111111', businessType: 'retailer', location: 'CBD' }
      ],
      approved: 2, pending: 0, rejected: 0, approvedKes: 300, unsettledKes: 300,
      weeks: [{ week: '2026-W31', visits: 2, kes: 300, feeKes: 150, currency: 'KES', settlementId: null, settlementStatus: null }],
      note: 'derived'
    }
  };
  {
    fetchHandler = async (url) => {
      const u = String(url);
      const body = u.includes('/api/referrals/mine') ? REFERRALS
        : u.includes('/api/me/field-agent') ? AGENT
          : u.includes('/api/me/lipa-mdogo') ? { contracts: [{ id: 'lm1', maturity: 'paying', status: 'active', summary: {}, asset: {} }] }
            : PULSE;
      return { ok: true, status: 200, text: async () => JSON.stringify(body) };
    };
    const { EarnStrip } = require('./src/features/home/EarnStrip.tsx');
    const c = document.createElement('div');
    document.body.appendChild(c);
    const root = createRoot(c);
    act(() => root.render(React.createElement(EarnStrip, {})));
    await flush();
    const t = text(c);
    assert.ok(/600/.test(t), 'the points the server says are available');
    assert.ok(/100 points = KES 10/.test(t), 'with the server\'s rate quoted, not applied to anything');
    assert.ok(/2 approved/.test(t) && /KES 300/.test(t), 'the visits rail counts its approved rows and their money');
    assert.ok(/KES 150 per approved visit, paid weekly/.test(t), 'naming the terms the server set — one flat number');
    assert.ok(!/0\.75%|24 months|override/i.test(t), 'the old rate-and-window copy is gone from Home');
    assert.ok(/1 conversion waiting on finance/.test(t) && /Not cash yet/.test(t), 'a pending conversion is a queue entry, not money in a pocket');
    assert.ok(!/could have earned|missed|forecast|project/i.test(t), 'no missed-income framing, no projection');
    assert.ok(!/tier|badge|level|streak|rank/i.test(t), 'and no ladder — the pool has none');
    root.unmount(); c.remove();
  }
  pass('EarnStrip surfaces the real income rails on Home, with the server\'s rate and no projection');

  // --- and nothing at all, when there is nothing at all -------------------
  // Three cards of zeros is furniture. The strip is the same three reads with an
  // empty result, and the honest surface is the absence of the section — while a
  // FAILED read still renders, with dashes, because "could not read" and "you
  // have nothing" are different facts that must not look identical.
  {
    fetchHandler = async (url) => {
      const u = String(url);
      if (u.includes('/api/referrals/mine')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({
          code: 'ABC', maxDepth: 2, link: '/c/x',
          balance: { earned: 0, locked: 0, available: 0 }, pool: { balanceKes: 0 },
          conversion: { ptsToKes: 0.1, minPoints: 500 }, events: [], conversions: []
        }) };
      }
      if (u.includes('/api/me/field-agent')) return { ok: true, status: 200, text: async () => JSON.stringify({ claims: [], visits: [], settlements: [], earnings: { agentId: 'u1', feeKes: 150, currency: 'KES', visits: [], approved: 0, pending: 0, rejected: 0, approvedKes: 0, unsettledKes: 0, weeks: [], note: 'derived' } }) };
      if (u.includes('/api/me/lipa-mdogo')) return { ok: true, status: 200, text: async () => JSON.stringify({ contracts: [] }) };
      return { ok: true, status: 200, text: async () => JSON.stringify(PULSE) };
    };
    const { EarnStrip } = require('./src/features/home/EarnStrip.tsx');
    const c = document.createElement('div');
    document.body.appendChild(c);
    const root = createRoot(c);
    act(() => root.render(React.createElement(EarnStrip, {})));
    await flush();
    assert.equal(text(c), '', 'no rows on any rail, no section on Home');
    root.unmount(); c.remove();
  }
  {
    fetchHandler = async () => ({ ok: false, status: 500, text: async () => JSON.stringify({ error: 'boom' }) });
    const { EarnStrip } = require('./src/features/home/EarnStrip.tsx');
    const c = document.createElement('div');
    document.body.appendChild(c);
    const root = createRoot(c);
    act(() => root.render(React.createElement(EarnStrip, {})));
    await flush();
    const t = text(c);
    assert.ok(t.length > 0, 'but a failed read still shows — silence would look like an empty pocket');
    assert.ok(t.includes('—'), 'with dashes, not zeros');
    assert.ok(!/\b0\b/.test(t.replace(/[0-9]{4}/g, '')), 'and no zero is printed for a number nobody read');
    root.unmount(); c.remove();
  }
  pass('EarnStrip disappears when the rails are truly empty, and stays honest when they cannot be read');

  // (The old SignalBar error check lived with the component: a dead
  // /api/pulse read now says so in the pulse drawer itself, which owns the
  // ledger the banner points at.)

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
