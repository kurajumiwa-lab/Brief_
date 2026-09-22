// ---------------------------------------------------------------------------
// TILES — the vendor-portal pattern the reorg approved, pinned down:
//
//   * the status pill is ONE component with four fixed states (Active green,
//     Quiet amber, Expired grey, Flagged red), small, uppercase, 9px, dot on
//     the left — and it only says what a real row says;
//   * Mine's shops are a two-column tile grid: tinted by the shop's real mode
//     (the server's taxonomy — an unstated mode wears neutral, never a guess),
//     the name in white, the mode in white/70, the pill in the corner, and a
//     tap that opens the shop;
//   * Home's "Open now" rows wear the same treatment, tinted by the row's
//     real flow, with the name, the newest offer price and the real location
//     — never an invented distance;
//   * the shop's Documents section is the folder pattern (folder, name, what
//     is current about it) and, while nothing is filed, says exactly that.
//
// And the rejections stay rejected: no star ratings, no "Advanced search",
// no left filter panel, no desktop sidebar.
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
const { StatusPill, PILL_META, spacePillState } = require('./src/ui/StatusPill.tsx');
const { modeTint } = require('./src/features/spaces/modeTint.ts');
const { ShopDocuments } = require('./src/features/spaces/ShopDocuments.tsx');
const { MineSurface } = require('./src/features/mine/MineSurface.tsx');
const { HomeSurface } = require('./src/features/home/HomeSurface.tsx');
const { SpaceShell } = require('./src/features/spaces/SpaceShell.tsx');

let passed = 0;
let failed = 0;
const check = (name, cond) => {
  if (cond) { passed++; console.log('PASS ' + name); }
  else { failed++; console.log('FAIL ' + name); }
};
const flush = (ms = 50) => new Promise((r) => setTimeout(r, ms));
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

let fetchHandler = async () => ({ ok: false, status: 404, text: async () => JSON.stringify({}) });
global.fetch = async (input, init) => fetchHandler(String(input?.url ?? input ?? ''), init);

async function mount(el) {
  document.body.innerHTML = '';
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(el); });
  await flush();
  return { host, root };
}
const click = (el) => act(() => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
const bgOf = (el) => String(el.style.background || el.style.backgroundColor || '').toLowerCase();
const isBg = (el, hex) => {
  const b = bgOf(el);
  if (!b) return false;
  const m = hex.match(/^#(..)(..)(..)$/);
  const rgb = `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
  return b.includes(hex) || b.includes(rgb);
};

async function main() {
  // ── THE PILL — four states, one definition, the visual contract ──────────
  const states = Object.keys(PILL_META);
  check('pill: exactly four states', states.length === 4 &&
    ['active', 'quiet', 'expired', 'flagged'].every((s) => states.includes(s)));
  check('pill: the four labels', PILL_META.active.label === 'Active' && PILL_META.quiet.label === 'Quiet' &&
    PILL_META.expired.label === 'Expired' && PILL_META.flagged.label === 'Flagged');
  check('pill: four distinct colours', new Set(states.map((s) => PILL_META[s].color)).size === 4);
  {
    const g = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const [ar, ag, ab] = g(PILL_META.active.color); const [qr, qg] = g(PILL_META.quiet.color);
    const [er, eg, eb] = g(PILL_META.expired.color); const [fr] = g(PILL_META.flagged.color);
    check('pill: green has the green channel lead', ag > ar && ag > ab);
    check('pill: amber is orange family (red lead, green mid, low blue)', qr > qg && qg > 40 && g(PILL_META.quiet.color)[2] < 60);
    check('pill: grey is balanced (no channel leads)', Math.max(er, eg, eb) - Math.min(er, eg, eb) < 24);
    check('pill: red leads in red, low green', fr > 120 && g(PILL_META.flagged.color)[1] < 80);
  }
  {
    const { host } = await mount(React.createElement(StatusPill, { state: 'flagged' }));
    const pill = host.querySelector('[data-testid="status-pill-flagged"]');
    check('pill: renders with a data hook', !!pill);
    check('pill: 9px text', pill.classList.contains('text-[9px]'));
    check('pill: uppercase', pill.classList.contains('uppercase'));
    const dot = pill.querySelector('[aria-hidden]');
    check('pill: dot exists', !!dot);
    check('pill: dot is a 6px circle', !!dot && dot.classList.contains('w-1.5') && dot.classList.contains('h-1.5') && dot.classList.contains('rounded-full'));
    check('pill: dot is the FIRST child (left of the word)', !!dot && pill.firstElementChild === dot);
    check('pill: the word is its state', text(pill) === 'Flagged');
  }
  const sp = (o) => spacePillState(o);
  check('pill-state: archived says expired', sp({ status: 'archived', maintenance: { state: 'fresh' }, editorialBreakdown: { overdue: 3 } }) === 'expired');
  check('pill-state: an overdue queue row says flagged', sp({ status: 'active', maintenance: { state: 'stale' }, editorialBreakdown: { overdue: 1 } }) === 'flagged');
  check('pill-state: stale maintenance says quiet', sp({ status: 'active', maintenance: { state: 'stale' }, editorialBreakdown: { overdue: 0 } }) === 'quiet');
  check('pill-state: dormant says quiet', sp({ status: 'active', maintenance: { state: 'dormant' }, editorialBreakdown: { overdue: 0 } }) === 'quiet');
  check('pill-state: fresh, nothing owed, says active', sp({ status: 'active', maintenance: { state: 'fresh' }, editorialBreakdown: { overdue: 0 } }) === 'active');
  check('pill-state: no maintenance, nothing owed, still active (never guessed)', sp({ status: 'active', maintenance: null, editorialBreakdown: null }) === 'active');
  check('mode tint: one per real mode, neutral for unstated',
    modeTint('retail') !== modeTint('wholesale') && modeTint('services') !== modeTint('training') &&
    modeTint('delivery') !== modeTint('other') && modeTint(null) === modeTint(undefined) &&
    modeTint(null) === modeTint('never-a-real-mode'));

  // ── MINE — the shop tiles ─────────────────────────────────────────────────
  const MAINT = (state, over = {}) => ({
    state, lastTouchedAt: new Date().toISOString(), ageHours: 2,
    answered: 0, unanswered: 0, due: 0, overdue: 0,
    openConversations: 0, draftOffers: 0, pendingOrders: 0, fields: [], facts: [], ...over
  });
  const space = (id, over) => ({
    id, ownerId: 'me', name: `Shop ${id}`, type: 'shop', goal: 'g', targetValueKes: 0,
    image: null, visibility: 'public', status: 'active', capabilities: [],
    metrics: { revenueKes: 0, customerCount: 0, activeOrdersCount: 0, totalOrdersCount: 0, offersCount: 0 },
    offers: [], recentActivities: [], recentConversations: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...over
  });
  const S_A = space('spc_a', { name: 'Nairobi Boda', mode: 'retail', modeLabel: 'Retail', maintenance: MAINT('fresh') });
  const S_B = space('spc_b', {
    name: 'Kipepeo Stalls', mode: null, modeLabel: null, maintenance: MAINT('stale', { ageHours: 400, overdue: 1, unanswered: 1 }),
    editorialBreakdown: { unanswered: 1, overdue: 1, due: 0, replies: 0 },
    offers: [{ id: 'off_b1', spaceId: 'spc_b', title: 'Wax figures', status: 'draft', priceKes: null }],
    metrics: { revenueKes: 0, customerCount: 0, activeOrdersCount: 1, totalOrdersCount: 1, offersCount: 0 }
  });
  const S_C = space('spc_c', { name: 'Old Corner', mode: 'services', modeLabel: 'Services', status: 'archived', maintenance: null, editorialBreakdown: { unanswered: 0, overdue: 0, due: 0, replies: 0 } });
  fetchHandler = async (url) => {
    const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
    if (url.includes('/api/spaces')) return ok({ spaces: [S_A, S_B, S_C] });
    if (url.includes('/api/auth')) return ok({ user: { id: 'me', name: 'Test' } });
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  let opened = null;
  {
    const { host } = await mount(React.createElement(MineSurface, {
      onOpenSpace: (id) => { opened = id; }, onOpenCreateSpace: () => {}, onOpenEntity: () => {}, onRequireAuth: () => {}
    }));
    await flush();
    const grid = host.querySelector('[data-testid="mine-shop-tiles"]');
    check('mine: the shops are a grid', !!grid);
    check('mine: two columns, per the vendor pattern', !!grid && grid.classList.contains('grid-cols-2'));
    const tiles = host.querySelectorAll('[data-testid^="mine-shop-tile-"]');
    check('mine: one tile per active shop (archived is not operated)', tiles.length === 2);
    const tileA = host.querySelector('[data-testid="mine-shop-tile-spc_a"]');
    check('mine: tile A is tinted by its real mode (retail)', !!tileA && isBg(tileA, '#0E7C86'));
    const tileB = host.querySelector('[data-testid="mine-shop-tile-spc_b"]');
    check('mine: unstated mode wears the neutral slate, not a guess', !!tileB && isBg(tileB, '#64748B'));
    check('mine: the name is white on the tint', !!tileA && tileA.querySelector('.text-white') && text(tileA.querySelector('.text-white')).includes('Nairobi Boda'));
    check('mine: the mode label is white/70', !!tileA && !!tileA.querySelector('.text-white\\/70'));
    check('mine: the mode label is the server\'s own word', !!tileA && text(tileA).includes('Retail'));
    check('mine: an unstated mode says "Mode not stated"', !!tileB && text(tileB).includes('Mode not stated'));
    check('mine: fresh shop carries the active pill', !!host.querySelector('[data-testid="mine-shop-tile-spc_a"] [data-testid="status-pill-active"]'));
    check('mine: the overdue shop carries the flagged pill', !!host.querySelector('[data-testid="mine-shop-tile-spc_b"] [data-testid="status-pill-flagged"]'));
    {
      const corner = Array.from(tileA.querySelectorAll('span')).find((s) => s.classList.contains('absolute'));
      check('mine: the pill sits in the corner (absolute, top-right)',
        !!corner && corner.classList.contains('right-2.5') && corner.classList.contains('top-2.5') &&
        !!corner.querySelector('[data-testid^="status-pill-"]'));
    }
    check('mine: the owed work is still said, in words', !!tileB && text(tileB).includes('1 offer not published yet'));
    check('mine: tapping a tile opens that shop', (() => { void click(tileA); return opened === 'spc_a'; })());
    await flush(10);
    check('mine: no star ratings anywhere on the door', !/[★☆]/.test(text(host)));
  }

  // ── HOME — the "Open now" tiles ───────────────────────────────────────────
  fetchHandler = async (url) => {
    const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
    if (url.includes('/api/discover/summary')) return ok({
      tiles: [],
      feed: [
        { kind: 'listing', flow: 'bulk', commodity: 'tilapia', id: 'f1', title: 'Tilapia, whole, graded', description: null, priceLabel: 'KES 2,400 / 10kg', dateLabel: null, location: 'Nairobi CBD', mediaUrl: null },
        { kind: 'event', flow: null, commodity: null, id: 'f2', title: 'Market open day', description: null, priceLabel: null, dateLabel: null, location: 'Karura', mediaUrl: null }
      ]
    });
    if (url.includes('/api/spaces')) return ok({ spaces: [] });
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { host } = await mount(React.createElement(HomeSurface, { onOpenSpace: () => {} }));
    await flush();
    const shelf = host.querySelector('[data-testid="open-now-tiles"]');
    check('home: the "Open now" shelf renders its tiles', !!shelf);
    const tiles = host.querySelectorAll('[data-testid^="open-now-tile-"]');
    check('home: one tile per real row', tiles.length === 2);
    const tileF1 = host.querySelector('[data-testid="open-now-tile-f1"]');
    const tileF2 = host.querySelector('[data-testid="open-now-tile-f2"]');
    check('home: tinted by the row\'s real flow (bulk)', !!tileF1 && isBg(tileF1, '#2563EB'));
    check('home: no flow says neutral, never a guessed colour', !!tileF2 && isBg(tileF2, '#64748B'));
    check('home: the name is white on the tint', !!tileF1 &&
      Array.from(tileF1.querySelectorAll('.text-white')).some((el) => text(el).includes('Tilapia')));
    check('home: the newest offer price is on the tile', !!tileF1 && text(tileF1).includes('KES 2,400 / 10kg'));
    check('home: the real location is on the tile', !!tileF1 && text(tileF1).includes('Nairobi CBD'));
    check('home: no invented distance', !!shelf && !/\d+(\.\d+)?\s*km/i.test(text(shelf)));
    check('home: an event with no price says "Event", not a made-up figure', !!tileF2 && text(tileF2).includes('Event'));
  }

  // ── DOCUMENTS — the folder pattern ────────────────────────────────────────
  {
    const { host } = await mount(React.createElement(ShopDocuments, { documents: [] }));
    await flush();
    check('docs: the section is the folder pattern', !!host.querySelector('[data-testid="shop-documents"]'));
    const folders = ['verification', 'licences', 'receipts'].map((f) => host.querySelector(`[data-testid="shop-doc-folder-${f}"]`));
    check('docs: the three real folders (verification, licences, receipts)', folders.every(Boolean));
    check('docs: each folder says its state — empty, honestly', folders.every((f) => text(f).includes('Empty')));
    check('docs: an empty folder says nothing is filed', folders.every((f) => text(f).includes('Nothing filed yet.')));
    check('docs: no invented "updated X days ago" anywhere', !/updated \d+\s*(day|hr|week)s? ago/i.test(text(host)));
  }
  {
    const filed = new Date(Date.now() - 2 * 86400000).toISOString();
    const { host } = await mount(React.createElement(ShopDocuments, {
      documents: [{ id: 'd1', folder: 'licences', name: 'County trade licence', updatedAt: filed }]
    }));
    await flush();
    const lic = host.querySelector('[data-testid="shop-doc-folder-licences"]');
    check('docs: a filed row shows by name', !!lic && text(lic).includes('County trade licence'));
    check('docs: a filed folder counts its rows', !!lic && text(lic).includes('1 filed'));
    check('docs: the date shown is the row\'s real date', !!lic && text(lic).includes(`filed ${new Date(filed).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}`));
  }
  {
    // The shop file itself carries the documents section.
    const SP = space('spc_doc', { name: 'Doc Shop', mode: 'retail', modeLabel: 'Retail', maintenance: MAINT('fresh') });
    const PIPELINE = {
      discoverable: true, directory: 'Public',
      listings: { active: 0, drafts: 0, titles: [] },
      matchQueries30d: { count: 0, wording: 'people searched' },
      proposals: { total: 0, accepted: 0, declined: 0 },
      settled: { orders: 0, value: 0, currency: 'KES' },
      workOrders: 0, needs: [], note: ''
    };
    fetchHandler = async (url) => {
      const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
      if (url.includes('/api/spaces/spc_doc/operating')) return ok({ fields: [], maintenance: MAINT('fresh'), editorial: [], pipeline: PIPELINE });
      if (url.includes('/api/spaces/spc_doc')) return ok({ space: SP, modes: [] });
      return { ok: false, status: 404, text: async () => JSON.stringify({}) };
    };
    const { host } = await mount(React.createElement(SpaceShell, { spaceId: 'spc_doc', initialTab: 'operating', onBack: () => {} }));
    await flush();
    check('docs: the shop file (operating tab) carries the Documents section', !!host.querySelector('[data-testid="shop-documents"]'));
    check('docs: in the shop, all three folders stand empty and say so',
      ['verification', 'licences', 'receipts'].every((f) => {
        const el = host.querySelector(`[data-testid="shop-doc-folder-${f}"]`);
        return !!el && text(el).includes('Nothing filed yet.');
      }));
  }

  // ── THE REJECTIONS — still rejected ───────────────────────────────────────
  {
    const t = text(document.body);
    check('rejected: no star ratings anywhere', !/[★☆]/.test(t));
    check('rejected: no "Advanced search" anywhere', !/advanced search/i.test(t));
    check('rejected: no left filter panel / no sidebar second nav', !/filter panel|sidebar/i.test(t));
  }

  console.log(`\nPASSED ${passed} / FAILED ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
