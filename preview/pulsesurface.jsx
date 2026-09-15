// ---------------------------------------------------------------------------
// PULSE — the world screen, and the honest version of a "live newspaper".
//
// Pins:
//   * every line is a count or sum the server derived from rows;
//   * per-category PRECEDENT loads on tap from /api/precedent and reports a
//     missing figure as missing ("no offer price to average") instead of
//     manufacturing an "avg value";
//   * an empty ledger reads as empty, and a dead read reads as dead;
//   * no market-feed percentages, no sector/route figures, no identities.
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
const { PulseSurface } = require('./src/features/city/PulseSurface.tsx');

let count = 0;
const pass = (n) => { count++; console.log('PASS ' + n); };
const flush = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const btnBy = (want) =>
  Array.from(document.querySelectorAll('button')).find((b) => text(b).includes(want));

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
    { id: 'money', text: '2 orders settled for KES 12,400 in the last 30 days' }
  ],
  empty: false,
  note: 'Derived on read from real rows in the store.'
};

const POSITION = {
  decay: { expiringQuotes: [], waitlist: [], override: null, overdueInstallments: 0 },
  missedCapture: { count: 0, recent: [], value: null },
  nextMove: null,
  open: {
    total: 3,
    top: [{
      requestId: 'req_9', title: '200kg of Irish potatoes', category: 'produce', location: 'Wakulima',
      severityLabel: 'Suppliers matched; no quote yet', collective: true, closesMonthly: 2
    }]
  },
  derivedAt: '', note: ''
};

const PRECEDENT = {
  category: 'produce',
  closure: { windowDays: 30, byCategory: [{ category: 'produce', closed: 2 }] },
  fill: {
    category: 'produce', windowDays: 30, closed: 2, avgHoursToFill: 5.7, hoursSampleCount: 2,
    avgValue: null, note: 'Precedent is counted from closed request rows.'
  },
  movement: { windowDays: 30, settledOrders: 2, settledOrdersKes: 12400, settledCurrency: 'KES', completedWorkOrders: 1, deliveredPickups: 5 },
  note: 'Derived from real rows on read.'
};

let fetchHandler;
global.fetch = async (input) => fetchHandler(String(input?.url ?? input ?? ''));

async function main() {
  fetchHandler = async (url) => {
    const ok = (body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
    if (url.includes('/api/pulse')) return ok(PULSE);
    if (url.includes('/api/me/position')) return ok({ position: POSITION });
    if (url.includes('/api/precedent')) return ok(PRECEDENT);
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };

  {
    const c = document.createElement('div');
    document.body.appendChild(c);
    const root = createRoot(c);
    act(() => root.render(React.createElement(PulseSurface, {})));
    await flush();
    const t = text(c);

    assert.ok(t.includes('Pulse'), 'the screen names itself');
    assert.ok(/snapshot /.test(t), 'stamped with the newest real row time');
    assert.ok(t.includes('3 requests open with no accepted quote'), 'real derived facts render');
    assert.ok(t.includes('2 orders settled for KES 12,400'), 'money that moved is money from rows');
    assert.ok(t.includes('200kg of Irish potatoes'), 'open demand renders from the position read');
    assert.ok(t.includes('no requester, no budget'), 'only demand is shown: no identities, no budgets');
    assert.ok(t.includes('avg KES 1,500'), 'the price snapshot is the real average of active listings');
    assert.ok(t.includes('not a trend'), 'and it is labelled as a snapshot, not a trend');
    assert.ok(!t.includes('%'), 'no percentage movement anywhere');
    assert.ok(!/sector/i.test(t), 'no invented sector');

    // Precedent, on demand, per category.
    act(() => { btnBy('Precedent for produce').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    const d = text(c);
    assert.ok(d.includes('2 requests in this category closed in the last 30 days'), 'real closure count renders');
    assert.ok(d.includes('5.7h on average across 2 rows'), 'fill time is averaged over real timestamps');
    assert.ok(d.includes('No offer price to average'), 'a missing price is reported as missing, not as zero');
    root.unmount(); c.remove();
  }
  pass('PulseSurface renders derived facts, real demand and honest per-category precedent');

  // --- An empty ledger reads as empty -------------------------------------
  fetchHandler = async (url) => {
    const ok = (body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
    if (url.includes('/api/pulse')) {
      return ok({
        ...PULSE,
        asOf: null,
        facts: [],
        empty: true,
        sections: {
          ...PULSE.sections,
          demand: { open: 0, bySeverity: {}, collective: 0 },
          closure: { windowDays: 30, closed: 0, topCategory: null },
          fill: { windowDays: 30, closed: 0, avgHoursToFill: null, hoursSampleCount: 0, avgValue: null },
          money: { windowDays: 30, settledOrders: 0, settledValue: null, settledCurrency: null, completedWorkOrders: 0, deliveredPickups: 0 },
          listings: { active: 0, snapshot: [] },
          events: { open: 0, newLast24h: { requests: 0, events: 0, listings: 0, orders: 0 } }
        }
      });
    }
    if (url.includes('/api/me/position')) {
      return ok({ position: { ...POSITION, open: { total: 0, top: [] } } });
    }
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const c = document.createElement('div');
    document.body.appendChild(c);
    const root = createRoot(c);
    act(() => root.render(React.createElement(PulseSurface, {})));
    await flush();
    const t = text(c);
    assert.ok(t.includes('Nothing has moved yet'), 'an empty ledger is stated, not decorated');
    assert.ok(t.includes('No active listings, so there is no average to report'), 'no average is implied from nothing');
    assert.ok(t.includes('No request is waiting for a quote right now.'), 'no demand is invented to fill the screen');
    assert.ok(!/KES 0/.test(t), 'a zero money figure is never printed');
    root.unmount(); c.remove();
  }
  pass('PulseSurface keeps an empty ledger empty (no seeded activity)');

  // --- A dead read is an error ---------------------------------------------
  fetchHandler = async () => ({ ok: false, status: 500, text: async () => JSON.stringify({ error: 'boom' }) });
  {
    const c = document.createElement('div');
    document.body.appendChild(c);
    const root = createRoot(c);
    act(() => root.render(React.createElement(PulseSurface, {})));
    await flush();
    assert.ok(text(c).includes('Pulse is unavailable'), 'a failed read says so plainly');
    root.unmount(); c.remove();
  }
  pass('PulseSurface reports an unavailable ledger instead of a fake one');

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
