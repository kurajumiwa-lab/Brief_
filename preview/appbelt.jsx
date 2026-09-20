// ---------------------------------------------------------------------------
// THE BELT AND THE SHEET — Amazon's header geometry, none of its psychology.
//
// The instruction was to renovate the shell using a mature commerce header as
// the reference, keeping the parts that reduce crowding. Four rules are pinned
// here, and each is one that a future "improvement" would break:
//
//   1. GEOMETRY. A band with an "All" affordance, a search box that resolves, an
//      area chip, a departments rail, and a message slot above the content.
//   2. THE TAXONOMY IS IMPORTED, NEVER TYPED. The rail's labels come from
//      `features/city/taxonomy` — the same lists the board itself renders. A belt
//      with its own category list is a second taxonomy, and the second one always
//      ends up offering a room that does not exist.
//   3. THE PSYCHOLOGY IS REFUSED. No countdown, no "X people viewed", no
//      "Sponsored", no cart badge, no invented deal, and a search box that goes
//      nowhere counts as a bug rather than a mockup. Each of those has an explicit
//      negative assertion below, because "we would never" is only true for as
//      long as a test says so.
//   4. THE DEDUPE. A destination the sheet owns does not also get a shelf on
//      Home. Home's three duplicated cards were moved to You → Standing with a
//      link in the sheet; the last section asserts the copy MOVED, not that it
//      was deleted.
// ---------------------------------------------------------------------------
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
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
const { AppBelt } = require('./src/app/AppBelt.tsx');
const { NavSheet, SHEET_GROUPS } = require('./src/app/NavSheet.tsx');
const { FLOW_ORDER, SIDE_ORDER } = require('./src/features/city/taxonomy');

let count = 0;
const pass = (n) => { count++; console.log('PASS ' + n); };
const flush = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const inEl = (host, sel) => Array.from(host.querySelectorAll(sel));
const byAria = (host, label) => inEl(host, 'button, a').find((b) => b.getAttribute('aria-label') === label);
const click = (el) => act(() => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
const src = (rel) => fs.readFileSync(path.join(__dirname, rel), 'utf8');

let fetchHandler = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ banners: [] }) });
global.fetch = async (input, init) => fetchHandler(input, init);

async function mount(el) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(el); });
  await flush();
  return { host, root, t: text(host) };
}

// The rail's expected labels, read from the taxonomy the board uses, so this
// file cannot quietly agree with a belt that invented a category.
const RAIL_LABELS = [
  ...FLOW_ORDER.map((f) => f.key[0].toUpperCase() + f.key.slice(1)),
  ...SIDE_ORDER.map((s) => s.label)
];

async function main() {
  // --- 1. the band --------------------------------------------------------
  {
    let opened = 0;
    let searched = null;
    let room = null;
    global.localStorage.removeItem('brief.world.place');
    const belt = await mount(React.createElement(AppBelt, {
      onOpenSheet: () => { opened++; },
      onHome: () => {},
      onOpenRoom: (r) => { room = r; },
      onSearch: (q) => { searched = q; },
      activeRoom: 'all'
    }));
    assert.ok(byAria(belt.host, 'Open all sections'), 'the sheet is one tap away, so the band can stay short');
    click(byAria(belt.host, 'Open all sections'));
    assert.equal(opened, 1, 'and that tap opens it');

    // The area chip states what is known. Nothing is inferred from an IP: a
    // confident location on a stranger's phone is a lie with good typography.
    assert.match(belt.t, /Set your area/, 'an unset area is said as unset');
    assert.ok(!/Delivering to|Nairobi County/i.test(belt.t), 'no inherited or guessed location');

    // Departments: exactly the taxonomy's rooms, in its order, nothing else.
    const chips = inEl(belt.host, '[aria-label="Departments"] button').map((b) => text(b));
    assert.deepEqual(chips, RAIL_LABELS, 'the rail IS the taxonomy, not a second list of categories');
    click(inEl(belt.host, '[aria-label="Departments"] button').find((b) => text(b) === 'Errands'));
    assert.equal(room, 'errands', 'and a chip opens that room');
    const current = inEl(belt.host, '[aria-label="Departments"] button').find((b) => b.getAttribute('aria-current') === 'page');
    assert.equal(text(current), 'All', 'the room actually in view is marked as such');

    // The search box resolves, or it does not exist.
    const input = belt.host.querySelector('#belt-search');
    assert.ok(input, 'the band carries a search field');
    const submit = byAria(belt.host, 'Search');
    assert.ok(submit.disabled, 'an empty query cannot be submitted');
    act(() => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, 'sukuma wiki');
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await flush();
    assert.equal(byAria(belt.host, 'Search').disabled, false, 'a typed query can be');
    click(byAria(belt.host, 'Search'));
    assert.equal(searched, 'sukuma wiki', 'and the term is handed to the shell');

    // The band is not a billboard.
    assert.ok(!/mins? left|hours? left|ends in|offer ends|\d\d:\d\d/.test(belt.t), 'no countdown anywhere in the band');
    assert.ok(!/people (are )?viewing|viewed this|in your cart|Sponsored/i.test(belt.t), 'no crowd pressure, no sponsored framing');
    assert.ok(!/\bPrime\b|Early Deals|cashback|bonus/i.test(belt.t), 'no loyalty theatre');
    belt.root.unmount(); belt.host.remove();
  }
  pass('The band carries the short list: All, a search that resolves, the stated area, the taxonomy rail');

  // --- 2. the search actually lands somewhere -----------------------------
  {
    const shell = src('./src/app/AppShell.tsx');
    assert.match(shell, /hash === 'search' \|\| hash\.startsWith\('search\/'\)/, 'the shell routes #search/<term>');
    assert.match(shell, /<SearchResults/, 'to the real search surface, not an empty state');
    const results = src('./src/components/SearchResults.tsx');
    assert.ok(/searchAll\(/.test(results), 'which performs the /api/search read itself');
  }
  pass('A search box in this app resolves: #search/<term> reaches the real search surface');

  // --- 3. the message slot: nothing when there is nothing ------------------
  {
    fetchHandler = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ banners: [] }) });
    const empty = await mount(React.createElement(AppBelt, { onOpenSheet: () => {}, onHome: () => {}, onOpenRoom: () => {}, onSearch: () => {} }));
    assert.ok(!empty.host.querySelector('[aria-label="Announcements"]'),
      'no banners, no frame — an empty promotional slot is still a claim that something is being promoted');
    empty.root.unmount(); empty.host.remove();

    fetchHandler = async () => ({
      ok: true, status: 200, text: async () => JSON.stringify({
        banners: [
          { id: 'b1', campaignId: 'c1', title: 'Kisii market Saturday', body: 'Bring your own baskets', location: 'Kisii', startsAt: '2026-09-20T08:00:00+03:00', imageUrl: null, status: 'active', createdAt: '', share: { available: false, reason: 'public_origin_not_configured' } },
          { id: 'b2', campaignId: 'c2', title: 'Grain drop', body: null, location: null, startsAt: null, imageUrl: null, status: 'active', createdAt: '', share: { available: true, url: 'https://example.test/c/grain-drop', channels: { whatsapp: 'x' } } }
        ]
      })
    });
    const two = await mount(React.createElement(AppBelt, { onOpenSheet: () => {}, onHome: () => {}, onOpenRoom: () => {}, onSearch: () => {} }));
    // The date is asserted through the same call the component uses — the app's
    // convention for a day label — so the test cannot be wrong about a locale and
    // cannot drift into pinning a string nobody chose.
    const dayLabel = new Date(Date.parse('2026-09-20T08:00:00+03:00'))
      .toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
    assert.match(two.t, new RegExp(`Kisii market Saturday — Bring your own baskets · ${dayLabel} · Kisii`),
      'a banner is its own words plus the date and place it carries');
    assert.match(two.t, /no public link yet/, 'and says so when there is nowhere to send people');
    assert.ok(!/Register now|Limited|ends soon|\bFree\b/i.test(two.t), 'the host wrote the copy; the app adds no urgency to it');
    const hrefs = inEl(two.host, '[aria-label="Announcements"] a').map((a) => a.getAttribute('href'));
    assert.deepEqual(hrefs, ['https://example.test/c/grain-drop'], 'only a configured link becomes a button');
    assert.ok(!two.host.querySelector('[aria-label="Announcements"] img'),
      'no image, no placeholder art of a market nobody photographed');
    two.root.unmount(); two.host.remove();
  }
  pass('Banners: silence when there is nothing, the host’s own words when there is, no invented CTA');

  // --- 4. the sheet holds the long list, once -----------------------------
  {
    const ids = SHEET_GROUPS.flatMap((g) => g.items.map((i) => i.id));
    assert.equal(new Set(ids).size, ids.length, 'no destination is listed twice in the sheet');
    const labels = SHEET_GROUPS.flatMap((g) => g.items.map((i) => i.label));
    assert.ok(labels.every((l) => l.trim().length > 2), 'every entry is a word a person can read');
    // Nav entries carry no numbers: a count in a nav list is a count that has to
    // be true everywhere it is printed, including before the member has rows.
    assert.ok(labels.every((l) => !/\d/.test(l)), 'no counts on nav entries');

    let went = null;
    let closed = 0;
    const sheet = await mount(React.createElement(NavSheet, {
      open: true,
      onClose: () => { closed++; },
      place: '',
      onSetPlace: () => {},
      onGo: (target) => { went = target; }
    }));
    assert.ok(sheet.host.querySelector('[role="dialog"]'), 'it is a dialog, so the screen behind it is not left half-reachable');
    assert.match(sheet.t, /Your area/, 'the area is set here, once, and read by the band and the forecast');
    assert.ok(sheet.host.querySelector('#belt-place'), 'in a real input, not a display of a city we guessed');
    click(inEl(sheet.host, 'button').find((b) => text(b) === 'Earn'));
    assert.deepEqual(went, { kind: 'you', section: 'earn' }, 'an entry goes to a real section');
    assert.equal(closed, 1, 'and choosing it closes the sheet');
    assert.equal(inEl(sheet.host, 'button[aria-label="Close the menu"]').length, 2,
      'the backdrop and one visible control are the same affordance, not two competing buttons');
    sheet.root.unmount(); sheet.host.remove();

    const shut = await mount(React.createElement(NavSheet, { open: false, onClose: () => {}, place: 'Kisii', onSetPlace: () => {}, onGo: () => {} }));
    assert.equal(shut.t, '', 'closed means nothing rendered, not a hidden tree');
    shut.root.unmount(); shut.host.remove();
  }
  pass('The sheet owns the long list: each destination once, no counts, one close affordance');

  // --- 5. what the sheet took over leaves the working screens -------------
  {
    const home = src('./src/features/home/HomeSurface.tsx');
    for (const gone of ['PositionCard', 'CommitmentsCard', 'ReciprocityCard', 'WorldStrip']) {
      assert.ok(!home.includes(gone), `Home no longer imports ${gone} — that surface has one home now`);
    }
    assert.ok(!fs.existsSync(path.join(__dirname, 'src/features/home/WorldStrip.tsx')),
      'and the component that put a whole week of weather on every visit is deleted, not left as a second answer');
    const you = src('./src/features/you/YouSurface.tsx');
    for (const kept of ['PositionCard', 'CommitmentsCard', 'ReciprocityCard']) {
      assert.ok(you.includes(kept), `${kept} still exists where it was moved to (You → Standing)`);
    }
    const sheetSrc = src('./src/app/NavSheet.tsx');
    assert.match(sheetSrc, /section: 'standing'/, 'reached from the sheet');
    assert.match(sheetSrc, /section: 'earn'/, 'and the same for Earn, whose rails Home now shows');
    // The definition that sat in Home's "Tip" box moved to the audit screen,
    // which is where a sentence about what a space IS belongs.
    const audit = src('./src/features/you/HowBriefWorks.tsx');
    assert.match(audit, /A space holds|public/i, 'the audit screen still carries the plain words');
    // And the forecast's provenance sentence survived on the line that replaced it.
    assert.match(src('./src/features/home/PlannedWeather.tsx'), /a model, not a measurement/,
      'the model-not-measurement note is on the line itself');
  }
  pass('A feature given a home in the sheet is denied a duplicate shelf on Home — moved, not deleted');

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
