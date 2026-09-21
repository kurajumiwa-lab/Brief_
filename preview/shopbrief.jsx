// ---------------------------------------------------------------------------
// THE MORNING BRIEF (client) — the panel must be a loudspeaker, not a calculator.
//
// The lesson this suite exists to keep learned: a "Margin" once appeared on a
// space's money panel because the panel divided one server figure by another
// server figure and called the quotient something neither had said. So every
// number and every caption here must be the payload's own, and the tests fail
// the component if it does arithmetic, pads a missing figure with a zero, or
// writes a friendlier word than the server sent.
//
// Checked:
//   * figures are `toLocaleString('en-KE')` of the payload's numbers, no more;
//   * the three basis sentences are printed verbatim from the read;
//   * a quiet day prints no money at all, and a business with no space prints
//     nothing (the street below already says what is missing);
//   * a failed read is a dash with a way to retry, never a zero;
//   * a flag expands to the row ids behind it, and its space button calls the
//     real opener;
//   * an actor with no name in the payload is not given one;
//   * the day stepper asks the server for the adjacent day, and cannot step
//     into a day that has not arrived;
//   * no rank, benchmark, urgency timer or crowd sentence survives on screen.
// ---------------------------------------------------------------------------
const assert = require('assert').strict;
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.HTMLSelectElement = dom.window.HTMLSelectElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.localStorage = dom.window.localStorage;

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const { ShopBrief } = require('./src/features/spaces/ShopBrief.tsx');

let count = 0;
const pass = (n) => { count++; console.log('PASS ' + n); };
const flush = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const btn = (label) => Array.from(document.querySelectorAll('button'))
  .find((b) => text(b) === label || text(b).startsWith(label));
const byAria = (label) => document.querySelector(`[aria-label="${label}"]`);

const BASIS = {
  in: 'orders marked paid or settled, on the day their own row says they moved',
  out: 'expenses you recorded and dated that day — nothing is imported',
  net: 'marked in minus recorded out, not profit',
  views: 'opens of a space’s public page; your own opens are left out'
};

const BRIEF = (over = {}) => ({
  ok: true,
  day: '2026-09-20',
  dayLabel: 'Sun, 20 Sept',
  isToday: false,
  asOf: '2026-09-21T03:00:00.000Z',
  stored: false,
  shop: { vendorId: 'vnd_1', name: 'Testshop', ownerId: 'usr_1' },
  basis: BASIS,
  empty: false,
  reason: null,
  money: { inKes: 4320, outKes: 1200, netKes: 3120, currency: 'KES', railSettledKes: null },
  orders: {
    placed: 4, marked: 3, open: 1, cancelled: 0, disputed: 0, unstamped: 0, aged: 2,
    movedByStatus: { fulfilled: 3, cancelled: 1 }, statuses: ['paid', 'completed', 'settled', 'fulfilled']
  },
  spaces: [{
    id: 'spc_a', name: 'Counter', slug: 'counter', mode: 'retail', modeLabel: 'Retail',
    scope: 'this space only', money: { inKes: 1500, outKes: 0, netKes: 1500 },
    orders: { placed: 2, marked: 1, open: 1 }, views: 3
  }],
  quietSpaces: ['Bulk book'],
  people: [{
    actorId: 'usr_1', name: 'mary', isOwner: true, actions: 6,
    lastAt: '2026-09-20T15:14:00.000Z', lastClock: '18:14', kinds: ['quote_sent', 'expense_recorded']
  }],
  views: { count: 3, ownOpensExcluded: 1 },
  flags: [{
    id: 'stock:lst_1:2026-09-20',
    kind: 'stock_recount',
    listingId: 'lst_1',
    offerTitle: 'Maize flour 2kg',
    spaceId: 'spc_a',
    spaceName: 'Counter',
    direction: 'up',
    counts: { start: 10, sold: 4, allowed: 6, end: 10, gap: 4 },
    message: 'Maize flour 2kg: 4 sold, and the count ended at 10 where the sales leave 6',
    detail: '4 units appeared on the shelf that no sale put there, the count was last typed by you at 20:04. A restock looks exactly like this here, because nothing records which it was.',
    evidenceIds: ['stk_1', 'stk_2', 'stk_3', 'stk_4', 'stk_5'],
    orderIds: ['ord_1', 'ord_2', 'ord_3', 'ord_4'],
    index: 1,
    action: { label: 'Open the catalog', surface: 'catalog' }
  }],
  unassigned: { orders: 1, inKes: 340, evidenceIds: ['ord_9'], note: 'money no space claims, counted for the business only' },
  ...over
});

const PREFS = (over = {}) => ({
  ownerId: 'usr_1', enabled: false, hour: null, hourLabel: null, lastBriefDay: null,
  hourNow: 6, willSendToday: false,
  note: 'one brief per day at most, and nothing is sent for a day with no rows',
  timeZone: 'Africa/Nairobi', ...over
});

let calls = [];
let handler = async (url) => {
  if (url.includes('/api/shop-brief/prefs')) return ok({ prefs: PREFS() });
  if (url.includes('/api/shop-brief')) return ok({ brief: BRIEF() });
  return notFound();
};
function ok(body) { return { ok: true, status: 200, text: async () => JSON.stringify(body) }; }
function notFound() { return { ok: false, status: 404, text: async () => JSON.stringify({}) }; }

global.fetch = async (input, init) => {
  const url = String(typeof input === 'string' ? input : input?.url ?? input ?? '');
  calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? String(init.body) : null });
  return handler(url, init);
};

async function mount(el) {
  document.body.innerHTML = '';
  calls = [];
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(el); });
  await flush();
  return { host, root, t: text(host) };
}
const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); await flush(); };

async function main() {
  // --- 1. the figures are the payload's, spelled the way the payload spelled them
  {
    const { t } = await mount(React.createElement(ShopBrief, {}));
    const kes = (n) => `KES ${n.toLocaleString('en-KE')}`;
    assert.ok(t.includes(kes(4320)), `the marked-in figure: ${t.slice(0, 160)}`);
    assert.ok(t.includes(kes(1200)), 'the recorded-out figure');
    assert.ok(t.includes(kes(3120)), 'and the subtraction the server made, not one the panel made');
    assert.ok(t.includes('4 placed') && t.includes('3 marked in') && t.includes('1 still open'),
      'order counts, in the plain words');
    assert.ok(t.includes('Testshop') && t.includes('Sun, 20 Sept'), 'whose shop, which day');
    assert.ok(t.includes('2 to answer') === false, 'no invented queue sentence');
  }
  pass('the panel prints the read: every figure is the payload\u2019s own');

  // --- 2. the captions are the server's sentences, verbatim -----------------
  {
    const { t } = await mount(React.createElement(ShopBrief, {}));
    for (const sentence of [BASIS.in, BASIS.out, BASIS.net]) {
      assert.ok(t.includes(sentence), `the basis line comes through unchanged: ${sentence}`);
    }
    assert.ok(t.includes('Marked in') && t.includes('Recorded out') && t.includes('Marked in − recorded out'),
      'three labels, none of them the word profit');
    assert.ok(!/net profit|take-home|\bmargin%/i.test(t), 'and no friendlier word is substituted');
  }
  pass('no screen writes its own caption: the basis sentences travel from the server');

  // --- 3. a quiet day is a sentence, not four zeroes ------------------------
  {
    const quiet = BRIEF({
      empty: true, reason: 'quiet_day',
      money: { inKes: 0, outKes: 0, netKes: 0, currency: 'KES', railSettledKes: null },
      orders: { placed: 0, marked: 0, open: 0, cancelled: 0, disputed: 0, unstamped: 0, aged: 0, movedByStatus: {}, statuses: [] },
      spaces: [], quietSpaces: ['Counter', 'Bulk book'], people: [], views: { count: 0, ownOpensExcluded: 0 },
      flags: [], unassigned: { orders: 0, inKes: 0, evidenceIds: [], note: '' }
    });
    handler = async (url) => (url.includes('/api/shop-brief/prefs')
      ? ok({ prefs: PREFS() })
      : url.includes('/api/shop-brief') ? ok({ brief: quiet }) : notFound());
    const { t } = await mount(React.createElement(ShopBrief, {}));
    assert.ok(t.includes('Nothing was recorded on Sun, 20 Sept'), t.slice(0, 200));
    assert.ok(!/KES/.test(t), 'a quiet day prints no money at all');
    assert.ok(t.includes('not shown as a day of zeroes'), 'and says that out loud');
    assert.ok(t.includes('Nothing recorded on Counter, Bulk book') === false,
      'the quiet-space line is not doubled when the whole day is quiet');
  }
  pass('an empty day is reported as empty, with no zeros to misread');

  // --- 4. a business with no space: the panel withdraws --------------------
  {
    const none = BRIEF({
      empty: true, reason: 'no_spaces', money: null, orders: null, views: null,
      spaces: [], quietSpaces: [], people: [], flags: [], unassigned: null
    });
    handler = async (url) => (url.includes('/api/shop-brief/prefs')
      ? ok({ prefs: PREFS() })
      : url.includes('/api/shop-brief') ? ok({ brief: none }) : notFound());
    const { host } = await mount(React.createElement(ShopBrief, {}));
    assert.equal(text(host), '', 'the street below already says a space is missing; nothing is echoed here');
  }
  pass('no space, no brief, no duplicate empty state');

  // --- 5. a failed read is a dash and a way back, not a zero ---------------
  {
    handler = async () => notFound();
    const { host, t } = await mount(React.createElement(ShopBrief, {}));
    assert.ok(t.includes('—'), `the unmeasurable is a dash: ${t}`);
    assert.ok(!/KES 0/.test(t), 'and it is never 0');
    const again = btn('Try again');
    assert.ok(again, 'with one action offered');
    const before = calls.length;
    await click(again);
    assert.ok(calls.length > before, 'and that action re-reads');
    assert.ok(host.querySelector('[role="status"]'), 'stated as a status, not as a number');
  }
  pass('a failed read says it failed');

  // --- 6. a flag carries its own rows -------------------------------------
  {
    handler = async (url) => (url.includes('/api/shop-brief/prefs')
      ? ok({ prefs: PREFS() })
      : url.includes('/api/shop-brief') ? ok({ brief: BRIEF() }) : notFound());
    let opened = null;
    const { host, t } = await mount(React.createElement(ShopBrief, { onOpenSpace: (id) => { opened = id; } }));
    assert.ok(t.includes('Maize flour 2kg: 4 sold'), 'the flag is the server\u2019s sentence');
    assert.ok(t.includes('A restock looks exactly like this'), 'including its concession');
    assert.ok(!/staff are hiding|shrinkage|theft/i.test(t), 'and it never picks a side');
    assert.ok(!document.querySelector('#evidence-row'), 'the rows start folded away');
    const toggle = Array.from(host.querySelectorAll('button')).find((b) => /rows behind this/.test(text(b)));
    assert.ok(toggle, '5 rows behind this');
    assert.equal(text(toggle), '5 rows behind this');
    await click(toggle);
    assert.ok(text(host).includes('stk_1') && text(host).includes('stk_5'), 'tap: the evidence ids appear');
    assert.ok(!text(host).includes('ord_1'), 'order ids are not smuggled into the row list');
    const spaceBtn = Array.from(host.querySelectorAll('button')).find((b) => text(b) === 'Counter');
    await click(spaceBtn);
    assert.equal(opened, 'spc_a', 'and the space line opens the real space');
  }
  pass('a flag is a question with its evidence attached');

  // --- 7. the unassigned money is said, not hidden -------------------------
  {
    const { t } = await mount(React.createElement(ShopBrief, {}));
    assert.ok(t.includes('KES 340 belongs to no space'), t.slice(0, 300));
    assert.ok(t.includes('the two are meant to differ'), 'and it explains why the space lines add to less');
    const line = Array.from(document.querySelectorAll('li')).find((li) => /Counter/.test(text(li)));
    assert.ok(/KES 1,500/.test(text(line)), 'the space line keeps only its own money');
    assert.ok(/this space only/.test(text(line)), 'and says which rule that is');
    assert.ok(/· 2 placed/.test(text(line)) && /· 1 open/.test(text(line)), 'its own counts');
    assert.ok(text(line).includes('· 3 viewed'), 'its own opens');
  }
  pass('per-space lines carry the space\u2019s day, and the difference is explained');

  // --- 8. no name without a row ------------------------------------------
  {
    const ghosted = BRIEF({
      people: [
        { actorId: 'usr_ghost', name: null, isOwner: false, actions: 2, lastAt: null, lastClock: null, kinds: ['message_sent'] },
        { actorId: 'usr_1', name: 'mary', isOwner: true, actions: 6, lastAt: '2026-09-20T15:14:00.000Z', lastClock: '18:14', kinds: ['quote_sent'] }
      ]
    });
    handler = async (url) => (url.includes('/api/shop-brief/prefs')
      ? ok({ prefs: PREFS() })
      : url.includes('/api/shop-brief') ? ok({ brief: ghosted }) : notFound());
    const { t } = await mount(React.createElement(ShopBrief, {}));
    assert.ok(t.includes('someone with no name on record'), 'the gap is named as a gap');
    assert.ok(t.includes('mary'), 'a name that does exist is printed');
    assert.ok(t.includes('(you)'), 'and the owner is told which line is theirs');
    assert.ok(t.includes('last 18:14'), 'a clock the server read in Nairobi time');
    assert.ok(!/\+254|07\d{8}/.test(t), 'and no phone number is guessed at to fill a name');
  }
  pass('a person is only ever as named as their user row');

  // --- 9. the day can be moved, never forward ----------------------------
  {
    let asked = [];
    handler = async (url, init) => {
      if (init?.method === 'PUT') return ok({ prefs: PREFS({ enabled: true, hour: 6, hourLabel: '06:00 in Nairobi time' }) });
      if (url.includes('/api/shop-brief/prefs')) return ok({ prefs: PREFS() });
      asked.push(url);
      const day = (url.match(/day=(\d{4}-\d{2}-\d{2})/) ?? [])[1] ?? '2026-09-20';
      return ok({ brief: BRIEF({ day, dayLabel: day === '2026-09-19' ? 'Sat, 19 Sept' : 'Sun, 20 Sept' }) });
    };
    const { host } = await mount(React.createElement(ShopBrief, {}));
    assert.ok(asked.some((u) => u.includes('/api/shop-brief') && !u.includes('day=')),
      `the first read asks for no day: the server answers yesterday — ${asked.join(' ')}`);
    const back = byAria('The day before');
    await click(back);
    assert.ok(asked.some((u) => u.includes('day=2026-09-19')), `earlier day asked for: ${asked.join(' ')}`);
    assert.ok(text(host).includes('Sat, 19 Sept'), 'and the label the server sent is the one printed');

    const fwd = byAria('The day after');
    await click(fwd);
    assert.ok(asked.some((u) => u.includes('day=2026-09-20')), 'one step forward is allowed: the 20th has arrived');
    const before = asked.length;
    // A day read as "today" cannot be stepped past.
    handler = async (url, init) => {
      if (init?.method === 'PUT') return ok({ prefs: PREFS() });
      if (url.includes('/api/shop-brief/prefs')) return ok({ prefs: PREFS() });
      asked.push(url);
      return ok({ brief: BRIEF({ day: '2026-09-21', dayLabel: 'Mon, 21 Sept', isToday: true }) });
    };
    const second = await mount(React.createElement(ShopBrief, {}));
    const nextBtn = byAria('The day after');
    assert.equal(nextBtn.disabled, true, 'the future is not browsable');
    assert.ok(!asked.slice(before).some((u) => u.includes('day=2026-09-22')), 'and no request is made for it');
    assert.ok(second.t.includes('Today so far'), 'which is named as the running day, not as a finished brief');
  }
  pass('the day stepper moves days, and never arrives before they happen');

  // --- 10. the morning notification is a choice, saved as one ------------
  {
    // Its own handler: what the server answers after a save is what the control
    // shows, so a fixture that replies "off" has to really reply "off".
    handler = async (url, init) => {
      if (init?.method === 'PUT') {
        const body = JSON.parse(init.body ?? '{}');
        return ok({ prefs: PREFS({
          enabled: body.enabled, hour: body.enabled ? body.hour : null,
          hourLabel: body.enabled ? `${String(body.hour).padStart(2, '0')}:00 in Nairobi time` : null,
          lastBriefDay: body.enabled ? '2026-09-21' : null
        }) });
      }
      if (url.includes('/api/shop-brief/prefs')) return ok({ prefs: PREFS() });
      return ok({ brief: BRIEF() });
    };
    const { host, t } = await mount(React.createElement(ShopBrief, {}));
    assert.ok(t.includes('Tell me each morning'), 'the opt-in is on the brief, not buried in settings');
    assert.ok(t.includes('never at an hour you have not chosen'), 'with its rule stated');
    const toggle = host.querySelector('input[type="checkbox"]');
    assert.equal(toggle.checked, false, 'it starts OFF: no default hour is claimed on the owner\u2019s behalf');
    // A controlled checkbox is switched the way a finger switches it: a click,
    // which jsdom turns into the change event React is listening for.
    await act(async () => { toggle.click(); });
    await flush();
    const save = btn('Save');
    assert.ok(save, 'and saving is an explicit act');
    await click(save);
    const put = calls.find((c) => c.method === 'PUT');
    assert.ok(put, 'a PUT is issued');
    assert.deepEqual(JSON.parse(put.body), { enabled: true, hour: 6 },
      'the hour sent is the one the control shows, so the choice is the owner\u2019s');
    assert.ok(/Nairobi time/.test(text(host)), 'and the zone is named next to the number');
    const after = text(host);
    assert.ok(after.includes('Saved — from now, at 06:00'), `the confirmation names the hour it saved: ${after.slice(-160)}`);
    assert.ok(document.querySelector('select#brief-hour'), 'and the hour control is a labelled select, not a wheel');
    assert.ok(after.includes('last sent Mon, 21 Sept'), `the day it was sent is read back: ${after.slice(-160)}`);
    assert.ok(!/\bsent daily\b|you are subscribed/.test(after), 'and it claims nothing beyond the one row it saved');
  }
  pass('the morning notification is opted into, at an hour the owner names');

  // --- 11. a refusal from the server is the sentence that gets printed ----
  {
    handler = async (url, init) => {
      if (init?.method === 'PUT') return { ok: false, status: 400, text: async () => JSON.stringify({ error: 'pick the hour you want it at, between 0 and 23 in Nairobi time — nothing is sent at a time you have not chosen' }) };
      if (url.includes('/api/shop-brief/prefs')) return ok({ prefs: PREFS() });
      return ok({ brief: BRIEF() });
    };
    const { host } = await mount(React.createElement(ShopBrief, {}));
    const toggle = host.querySelector('input[type="checkbox"]');
    await act(async () => { toggle.click(); });
    await flush();
    await click(btn('Save'));
    const t = text(host);
    assert.ok(t.includes('nothing is sent at a time you have not chosen'), t.slice(-200));
    assert.ok(t.includes('—'), 'the read itself is still a dash-plus-retry, not a silent blank');
  }
  pass('the server\u2019s refusal is what the owner reads');

  // --- 12. the surface carries no crowd, no ladder, no timer -------------
  {
    const { host, t } = await mount(React.createElement(ShopBrief, {}));
    for (const banned of ['people viewed', 'trending', 'Top rated', 'urgent', 'don\u2019t miss', 'expires in',
      'left to claim', 'trusted', 'verified', 'premium', 'leaderboard', 'you should', 'based on your area']) {
      assert.ok(!t.toLowerCase().includes(banned), `"${banned}" has no place on a brief`);
    }
    assert.ok(!/%/.test(t), 'and no percentage is printed anywhere on it');
    assert.ok(!/NaN|undefined|null/.test(t), `no unrendered value leaks: ${t.slice(0, 200)}`);
    assert.ok(host.querySelectorAll('button').length >= 1, 'the panel has ways to act');
    assert.ok(!/font-size:\s*(8|9|10)px/.test(require('fs').readFileSync('./src/features/spaces/ShopBrief.tsx', 'utf8')));
  }
  pass('no crowd, no ladder, no countdown: a brief reports');

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
