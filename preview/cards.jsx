// ---------------------------------------------------------------------------
// CARDS — the Globys card pattern, pinned as the ONE shape.
//
// The rule the refactor holds: ONE card shape, ONE tile shape, ONE banner,
// nothing is special. So this suite audits every list surface the same way:
//
//   * the card: a 1:1 image slot (photo or waiting plate), a title that stops
//     at two lines, the bold 16px price, the seller with the verified check
//     INLINE (never a badge of its own), the real where/when in mono, and
//     EXACTLY ONE full-width action. No card with two buttons, no card with a
//     corner badge, no "featured" variant anywhere;
//   * the banner: one dark-gradient button per screen at most — "What's
//     moving today →" on Home, "Your shop overview →" on Mine when a shop is
//     owned. A second gradient on one screen is a second shout;
//   * the tile: the drawer's and the You tab's one menu-tile shape (pinned
//     alongside in appbelt.jsx and yousurface.jsx);
//   * the shop's Documents section stays the folder pattern: folder, name,
//     what is current about it, and while nothing is filed, exactly that.
//
// The rejections stay rejected: no star ratings, no "Advanced search", no
// left filter panel, no desktop sidebar, no "0 SETTLED ORDERS" hero.
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
// No navigation in jsdom: record where an action tried to go instead.
let openedUrl = null;
dom.window.open = (u) => { openedUrl = u; return { closed: false, focus() {}, close() {} }; };

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const { GlobysCard } = require('./src/ui/GlobysCard.tsx');
const { HomeSurface } = require('./src/features/home/HomeSurface.tsx');
const { MineSurface } = require('./src/features/mine/MineSurface.tsx');
const { CityFeedView } = require('./src/features/city/CityFeedView.tsx');
const { ShopDocuments } = require('./src/features/spaces/ShopDocuments.tsx');

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
const click = (el) => act(() => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })));

// ── THE AUDIT — every card on a surface must pass the same three laws -------
// 1. a title, 2. exactly ONE action, 3. no corner badge. A card that breaks
// any of them is a second shape, and a second shape is the failure.
const CORNER = /(^|\s)(top-2\.5|top-3|top-4|right-2\.5|right-3|right-4|left-2\.5|left-3|left-4)(\s|$)/;
const cornerBadges = (scope) => Array.from(scope.querySelectorAll('[class*="absolute"]')).filter((el) => {
  const cls = el.className || '';
  return CORNER.test(cls) && /(^|\s)(right-2\.5|right-3|right-4)(\s|$)/.test(cls);
});
const auditCards = (scope) => {
  const cards = Array.from(scope.querySelectorAll('article[data-testid^=globys-card]'));
  const issues = [];
  for (const c of cards) {
    const id = c.getAttribute('data-testid');
    const title = c.querySelector('h3');
    if (!title || !text(title)) issues.push(`${id}: no title`);
    const actions = c.querySelectorAll('[data-testid^=card-action]');
    if (actions.length !== 1) issues.push(`${id}: ${actions.length} action buttons`);
    if (cornerBadges(c).length > 0) issues.push(`${id}: corner badge present`);
  }
  return { cards, issues };
};
const assertClean = (scope, label) => {
  const { cards, issues } = auditCards(scope);
  assert.ok(cards.length > 0, `${label}: at least one card renders`);
  assert.deepEqual(issues, [], `${label}: every card is the one shape — ${issues.join('; ')}`);
  return cards;
};

async function main() {
  // ── 1. THE CARD — one shape, line by line ─────────────────────────────────
  {
    const { host } = await mount(React.createElement(GlobysCard, {
      image: 'https://example.test/greens.jpg',
      imageAlt: 'Irish potatoes, graded',
      title: 'Irish potatoes, graded, 200kg lots',
      price: 'KES 150',
      seller: 'Wakulima Market',
      verified: true,
      mono: 'Wakulima Market → Kilimani shops',
      actionLabel: 'Chat on WhatsApp →',
      actionHref: 'https://wa.me/254712000111',
      onAction: () => {},
      testId: 'spec'
    }));
    const card = host.querySelector('[data-testid="globys-card-spec"]');
    assert.ok(card, 'the card renders under its own hook');
    // 1:1 slot, the row's own photo.
    const slot = card.querySelector('.aspect-square');
    assert.ok(slot, 'the image slot is 1:1');
    assert.ok(slot.querySelector('img[src="https://example.test/greens.jpg"]'), 'the slot carries the row\'s own photo');
    // Title: two lines max, bold.
    const title = card.querySelector('h3');
    assert.ok(title.classList.contains('line-clamp-2') && title.classList.contains('font-bold'), 'the title stops at two lines');
    // Price: bold, 16px.
    const price = Array.from(card.querySelectorAll('p')).find((p) => p.textContent === 'KES 150');
    assert.ok(price && price.classList.contains('text-[16px]') && price.classList.contains('font-bold'), 'the price is bold 16px');
    // Seller: the check is INLINE in the seller's own line.
    const sellerLine = Array.from(card.querySelectorAll('p')).find((p) => p.textContent.includes('Wakulima Market'));
    assert.ok(sellerLine, 'the seller stands by name');
    const inlineCheck = sellerLine.querySelector('svg[aria-label="verified"]');
    assert.ok(inlineCheck, 'the verified check sits inline with the name, on the same line');
    assert.ok(inlineCheck.previousElementSibling && inlineCheck.previousElementSibling.textContent.includes('Wakulima Market'),
      'the check follows the name, not a separate line or a badge of its own');
    // Mono: the real where, in mono.
    const mono = Array.from(card.querySelectorAll('p')).find((p) => p.textContent.includes('Wakulima Market → Kilimani shops'));
    assert.ok(mono && mono.classList.contains('font-mono'), 'the where/when line is mono');
    // The one action: a full-width link to the seller's real number.
    const action = card.querySelector('[data-testid="card-action-spec"]');
    assert.ok(action && action.tagName === 'A', 'the action renders');
    assert.ok(action.classList.contains('w-full'), 'the action is full width');
    assert.ok(action.getAttribute('href').includes('254712000111'), 'the action points at the digits on the row');
    // Exactly one action, no corner badge — the two shape breakers.
    assert.equal(card.querySelectorAll('[data-testid^=card-action]').length, 1, 'one card, one action');
    assert.equal(cornerBadges(card).length, 0, 'no corner badge on the card');
  }
  {
    // Unverified: no check is invented.
    const { host } = await mount(React.createElement(GlobysCard, {
      title: 'Bread, sliced', price: 'KES 250', seller: 'Old Corner',
      verified: false, actionLabel: 'Enquire →', testId: 'plain'
    }));
    const card = host.querySelector('[data-testid="globys-card-plain"]');
    assert.ok(!card.querySelector('svg[aria-label="verified"]'), 'no verified check where the row is not verified');
    // No price, no seller, no mono: an absent fact is not a zero and not a guess.
    const { host: h2 } = await mount(React.createElement(GlobysCard, {
      title: 'Market open day', actionLabel: 'View event →', testId: 'bare'
    }));
    const bare = h2.querySelector('[data-testid="globys-card-bare"]');
    assert.equal(bare.querySelectorAll('p').length, 0, 'the lines that have no fact render nothing');
    // The audit accepts a bare card: title + one action, nothing else.
    assert.deepEqual(auditCards(h2).issues, [], 'the audit accepts the minimal card');
  }

  // ── 2. HOME — the banner and the three shelves, all the one card ──────────
  fetchHandler = async (url) => {
    const ok = (b, status = 200) => ({ ok: true, status, text: async () => JSON.stringify(b) });
    const bad = (message) => ({ ok: false, status: 500, text: async () => JSON.stringify({ error: message }) });
    if (url.includes('/api/discover/summary')) return ok({
      tiles: [],
      feed: [
        { kind: 'listing', flow: 'bulk', commodity: 'potatoes', id: 'f1',
          title: 'Irish potatoes, graded, 200kg lots', description: null,
          priceLabel: 'KES 150', dateLabel: null, location: 'Wakulima Market',
          seller: 'Wakulima Market', contact: '+254 712 000 111',
          origin: 'Wakulima Market', destination: 'Kilimani shops',
          mediaUrl: null, listedAt: new Date(Date.now() - 2 * 3600_000).toISOString(), orderable: false },
        { kind: 'event', flow: null, commodity: null, id: 'f2',
          title: 'Market open day', description: null, priceLabel: 'Free', dateLabel: 'Sat 06:00',
          location: 'Karura', seller: null, contact: null, mediaUrl: null }
      ]
    });
    if (url.includes('/api/events/categories')) return ok({ categories: [], labels: {} });
    if (url.includes('/api/events')) return ok({
      events: [{
        slug: 'open-day', title: 'Market open day', description: null, coverImageUrl: null,
        category: 'event', categoryLabel: 'Events', location: 'Karura',
        startsAt: (() => { const d = new Date(); d.setHours(6, 0, 0, 0); return d.toISOString(); })(), endsAt: null,
        price: 0, currency: 'KES', goalAmount: null, publishedAt: '2026-09-20T00:00:00Z'
      }],
      total: 1
    });
    if (url.includes('/api/spaces')) return ok({ spaces: [] });
    if (url.includes('/api/circles')) return ok({
      circles: [{
        id: 'circ_home', name: 'Kilimani Traders', description: '', type: 'treasury', status: 'active',
        visibility: 'invite_only', sourceId: null, goal: null, targetValue: null, deadline: null,
        completionCriteria: null, parentCircleId: null, createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z', currentValue: 0, contributorCount: 0, progressPct: null,
        settledCount: 0, blockCount: 0, memberCount: 3, isMember: true, canJoin: false, viewerRole: 'coordinator'
      }]
    });
    if (url.includes('/api/auth/me')) return bad('no session for the suite');
    return bad('not read by this suite');
  };
  {
    const { host } = await mount(React.createElement(HomeSurface, { onOpenSpace: () => {} }));
    await flush(150); // the three shelves read in one effect; let them all land
    // THE BANNER — one, at the top, the only loud thing.
    const banners = host.querySelectorAll('[data-testid="gradient-banner"]');
    assert.equal(banners.length, 1, 'exactly one gradient banner on Home');
    assert.ok(text(banners[0]).includes("What’s moving today"), 'and it names the check-in');
    // OPEN NOW — the board's top as the one card.
    const grid = host.querySelector('[data-testid="open-now-grid"]');
    assert.ok(grid && grid.classList.contains('grid-cols-2'), 'open now is a two-column grid');
    const cards = assertClean(grid, 'open now');
    assert.equal(cards.length, 2, 'one card per real row');
    const listing = host.querySelector('[data-testid="globys-card-open-f1"]');
    assert.ok(listing, 'the listing is a card');
    assert.ok(text(listing).includes('KES 150') && Array.from(listing.querySelectorAll('p')).some((p) => p.classList.contains('text-[16px]')),
      'the card renders its real price, bold');
    const waAction = listing.querySelector('[data-testid="card-action-open-f1"]');
    assert.ok(waAction.textContent.includes('Chat on WhatsApp'), 'the row with a contact offers the chat');
    assert.ok(waAction.tagName === 'A' && waAction.getAttribute('href').includes('254712000111'), 'the chat is a real wa.me link from the row');
    const eventCard = host.querySelector('[data-testid="globys-card-open-f2"]');
    assert.ok(eventCard.querySelector('[data-testid^=card-action]').textContent.includes('View event'), 'the event card offers its one action');
    assert.ok(text(eventCard).includes('Wakulima Market → Kilimani shops') === false, 'the event card carries no route it never declared');
    assert.ok(text(listing).includes('Wakulima Market → Kilimani shops'), 'the listing card carries the route the seller declared');
    // FROM YOUR GROUPS — the same card, the member figure as its price line.
    const gGrid = host.querySelector('[data-testid="groups-grid"]');
    const gCards = assertClean(gGrid, 'from your groups');
    assert.equal(gCards.length, 1, 'the circle you are in renders as a card');
    assert.ok(text(gCards[0]).includes('3 members'), 'the member count is the figure, stated');
    assert.ok(gCards[0].querySelector('[data-testid^=card-action]').textContent.includes('Open'), 'the membership action is the one action');
    // HAPPENING TODAY — the same card on the clock.
    const tGrid = host.querySelector('[data-testid="today-grid"]');
    const tCards = assertClean(tGrid, 'happening today');
    assert.equal(tCards.length, 1, 'the event starting today renders as a card');
    assert.ok(tCards[0].querySelector('[data-testid^=card-action]').textContent.includes('View event'), 'its one action opens the event');
    // The rule of the refactor, on the whole screen: nothing is special.
    assert.ok(!/featured/i.test(text(host)), 'no "featured" anywhere on Home');
    assert.equal(host.querySelectorAll('[data-testid="gradient-banner"]').length, 1, 'and still only one banner');
  }

  // ── 3. MINE — the shop banner and the shop grid ───────────────────────────
  {
    const space = (id, over) => ({
      id, ownerId: 'me', name: `Shop ${id}`, type: 'shop', goal: 'g', targetValueKes: 0,
      image: null, visibility: 'public', status: 'active', capabilities: [],
      metrics: { revenueKes: 0, customerCount: 0, activeOrdersCount: 0, totalOrdersCount: 0, offersCount: 0 },
      offers: [], recentActivities: [], recentConversations: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...over
    });
    fetchHandler = async (url) => {
      const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
      if (url.includes('/api/spaces')) return ok({ spaces: [
        space('spc_m', { name: 'Nairobi Boda', offers: [{ id: 'o1', spaceId: 'spc_m', title: 'Boda service, airport run', status: 'active', price: 1500, currency: 'KES' }] }),
        space('spc_n', { name: 'Kipepeo Stalls' })
      ] });
      if (url.includes('/api/auth/me')) return ok({ id: 'me', displayName: 'Test', handle: 'test' });
      return { ok: false, status: 404, text: async () => JSON.stringify({}) };
    };
    const { host } = await mount(React.createElement(MineSurface, {
      onOpenSpace: () => {}, onOpenCreateSpace: () => {}, onOpenEntity: () => {}, onRequireAuth: () => {}
    }));
    await flush(150);
    // THE BANNER — the member owns shops, so the one loud thing is here.
    const banners = host.querySelectorAll('[data-testid="gradient-banner"]');
    assert.equal(banners.length, 1, 'exactly one gradient banner on Mine');
    assert.ok(text(banners[0]).includes('Your shop overview'), 'and it is the shop overview, not a promise');
    // THE GRID — the shops as the one card.
    const grid = host.querySelector('[data-testid="mine-shop-grid"]');
    assert.ok(grid && grid.classList.contains('grid-cols-2'), 'the shops are a two-column grid');
    const cards = assertClean(grid, 'your shops');
    assert.equal(cards.length, 2, 'one card per shop you operate');
    const boda = host.querySelector('[data-testid="globys-card-shop-spc_m"]');
    assert.ok(boda, 'a shop renders as a card');
    assert.ok(text(boda).includes('from KES 1,500'), 'the price line is the real lowest active offer, not a badge');
    assert.ok(text(boda).includes('You'), 'the seller of your own shop is you, stated');
    let opened = null;
    const { host: h2 } = await mount(React.createElement(MineSurface, {
      onOpenSpace: (id) => { opened = id; }, onOpenCreateSpace: () => {}, onOpenEntity: () => {}, onRequireAuth: () => {}
    }));
    await flush(150);
    await click(h2.querySelector('[data-testid="card-action-shop-spc_n"]'));
    assert.equal(opened, 'spc_n', 'the one action on a shop card opens that shop');
    // The deletions stay deleted on this screen.
    assert.ok(!/0 settled orders/i.test(text(host)), 'no "0 settled orders" hero on Mine');
    assert.ok(!/[★☆]/.test(text(host)), 'no star ratings on Mine');
    assert.ok(!/featured/i.test(text(host)), 'no "featured" on Mine');
  }

  // ── 4. DISCOVER — the board's feed, the one card ──────────────────────────
  fetchHandler = async (url) => {
    const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
    if (url.includes('/api/discover/summary')) return ok({
      tiles: [],
      feed: [
        { kind: 'listing', flow: 'bulk', commodity: 'tilapia', id: 'f1',
          title: 'Tilapia, whole, graded', description: null, priceLabel: 'KES 2,400 / 10kg',
          dateLabel: null, location: 'Nairobi CBD', seller: 'Mwangi Wholesale',
          contact: '+254 712 000 222', origin: 'Nairobi CBD', destination: 'Kilimani shops',
          mediaUrl: null, listedAt: new Date(Date.now() - 3600_000).toISOString(), orderable: true },
        { kind: 'listing', flow: null, commodity: null, id: 'f2',
          title: 'Hand-poured candles, set of 3', description: null, priceLabel: 'KES 900',
          dateLabel: null, location: 'Westlands', seller: 'Candle Studio', contact: null,
          mediaUrl: null, orderable: true }
      ]
    });
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { host } = await mount(React.createElement(CityFeedView, { onOpenSpace: () => {} }));
    await flush(150);
    const cards = assertClean(host, 'discover feed');
    assert.equal(cards.length, 2, 'one card per row on the board');
    const withContact = host.querySelector('[data-testid="globys-card-feed-f1"]');
    const action = withContact.querySelector('[data-testid^=card-action]');
    assert.ok(action.tagName === 'A' && action.getAttribute('href').includes('254712000222'),
      'the contact on the row becomes the one action, a real link');
    const noContact = host.querySelector('[data-testid="globys-card-feed-f2"]');
    const noContactAction = noContact.querySelector('[data-testid^=card-action]');
    assert.ok(noContactAction.tagName === 'BUTTON' && text(noContactAction).includes('Order'),
      'and a row without a contact gets the honest order action, not a dead link');
    // The top chip row is gone from the board (the audit page keeps the note).
    assert.ok(!Array.from(host.querySelectorAll('button')).some((b) => /Everything on this flow|Advanced search/i.test(text(b))),
      'no chip row, no "Advanced search"');
    assert.ok(!/featured/i.test(text(host)), 'no "featured" on the board');
  }

  // ── 5. DOCUMENTS — the folder pattern keeps the shop ─────────────────────
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

  // ── 6. THE REJECTIONS — still rejected ───────────────────────────────────
  {
    const t = text(document.body);
    check('rejected: no star ratings anywhere', !/[★☆]/.test(t));
    check('rejected: no "Advanced search" anywhere', !/advanced search/i.test(t));
    check('rejected: no left filter panel / no sidebar second nav', !/filter panel|sidebar/i.test(t));
    check('rejected: the "0 settled orders" hero is gone for good', !/0 settled orders/i.test(t));
  }

  console.log(`\nPASSED ${passed} / FAILED ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
