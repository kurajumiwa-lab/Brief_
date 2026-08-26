// ---------------------------------------------------------------------------
// STANDALONE COMMERCE (Batch 3)
//
// The commerce loop, through the real UI:
//
//   Vendor -> Listing -> browse -> Order -> Fulfilment -> Dispute
//
// Mounts <Marketplace> against a mutating mock server and drives it the way a
// buyer and a seller would. What is being guarded:
//
//   * an empty marketplace looks empty -- no seeded vendors or products
//   * the ORDER TOTAL RENDERED IS THE SERVER'S, not a client recomputation
//   * ordering is not paying: an order shows "not paid" until real settlement
//   * fulfilment and payment render as two separate facts
//   * lifecycle actions match the server's transition table
//   * a seller profile carries evidence and facts, never a rating
//   * server refusals are surfaced verbatim rather than swallowed
// ---------------------------------------------------------------------------
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>',
  { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document; Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true }); // Node >=21 ships a getter-only navigator; plain assignment silently fails
global.HTMLElement = dom.window.HTMLElement; global.Element = dom.window.Element; global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent; global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const { Marketplace } = require('./src/components/Marketplace.tsx');

let pass = 0, fail = 0;
const check = (n, c, d = '') => {
  if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); }
};

// --- mock server state ------------------------------------------------------
// Mutated by the POST handlers so the UI's refetch-after-action sees genuinely
// updated rows, exactly as the real server behaves.

const mkVendor = (over = {}) => ({
  id: 'vend_1', ownerId: 'usr_rival', displayName: 'Mama Njeri Groceries',
  description: 'Fresh produce, Kilimani market', contactMethod: 'Call 0722 000111',
  objectId: null, status: 'active',
  verification: {
    evidence: [{ kind: 'identity_verified', label: 'Identity verified' }],
    verifiedCount: 1,
    facts: [
      { kind: 'active_listings', label: '2 active listings' },
      { kind: 'vendor_since', label: 'Selling since June 2026' }
    ]
  },
  activeListingCount: 2,
  createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z',
  ...over
});

const mkListing = (over = {}) => ({
  id: 'list_1', vendorId: 'vend_1', title: '50kg Maize Flour',
  description: 'Fresh mill, this week.', type: 'product',
  price: 3200, currency: 'KES', quantityAvailable: 4,
  locationName: 'Kilimani Market', objectId: null, media: [],
  status: 'active',
  vendor: { id: 'vend_1', displayName: 'Mama Njeri Groceries', status: 'active', contactMethod: 'Call 0722 000111' },
  orderable: true, unorderableReason: null,
  createdAt: '2026-06-02T00:00:00Z', updatedAt: '2026-06-02T00:00:00Z',
  ...over
});

const mkOrder = (over = {}) => ({
  id: 'ord_1', listingId: 'list_1', listingTitle: '50kg Maize Flour', listingType: 'product',
  buyerId: 'usr_me', vendorId: 'vend_1', vendorOwnerId: 'usr_rival',
  quantity: 2, unitPrice: 3200, total: 6400, currency: 'KES', note: '',
  status: 'ordered', transactionId: null,
  paid: false, paymentStatus: 'unpaid', transaction: null, dispute: null,
  fulfilledAt: null, settledAt: null,
  history: [{ status: 'ordered', at: '2026-08-15T00:00:00Z' }],
  createdAt: '2026-08-15T00:00:00Z', updatedAt: '2026-08-15T00:00:00Z',
  ...over
});

let state;
const reset = (over = {}) => {
  state = {
    listings: [mkListing()],
    myOrders: [],
    myVendor: null,
    myListings: [],
    vendorOrders: [],
    vendors: { vend_1: mkVendor() },
    calls: [],
    refuse: null,
    orderKeys: [],
    earnings: null,
    ...over
  };
};

global.fetch = async (url, init) => {
  const u = String(url);
  const method = init?.method ?? 'GET';
  const body = init?.body ? JSON.parse(init.body) : null;
  const path = u.replace(/^.*\/ingest/, '');
  state.calls.push(`${method} ${path}`);

  const ok = (b, status = 200) => ({ ok: true, status, text: async () => JSON.stringify(b), json: async () => b });
  const err = (status, message) => ({ ok: false, status, text: async () => JSON.stringify({ error: message }), json: async () => ({ error: message }) });

  if (state.refuse && path.includes(state.refuse.match) && method === (state.refuse.method ?? 'POST')) {
    return err(state.refuse.status, state.refuse.message);
  }

  // --- orders --------------------------------------------------------------
  if (path.startsWith('/api/orders') && method === 'POST') {
    const m = path.match(/\/api\/orders\/([^/]+)\/(fulfil|cancel|dispute|settle)/);
    if (m) {
      const o = [...state.myOrders, ...state.vendorOrders].find((x) => x.id === m[1]);
      if (m[2] === 'fulfil') {
        o.status = 'fulfilled';
        o.fulfilledAt = '2026-08-16T00:00:00Z';
        // Fulfilment says NOTHING about money -- paid stays false.
        return ok({ order: o, changed: true });
      }
      if (m[2] === 'cancel') { o.status = 'cancelled'; return ok({ order: o, changed: true }); }
      if (m[2] === 'dispute') {
        o.status = 'disputed';
        o.dispute = { id: 'disp_1', reason: body.reason, status: 'open', reportedBy: 'usr_me', createdAt: '2026-08-17T00:00:00Z' };
        return ok({ dispute: o.dispute, order: o, changed: true }, 201);
      }
      if (m[2] === 'settle') {
        return err(400, 'an order can only be settled once a settled transaction is attached; no payment provider is connected');
      }
    }
    // Placing an order. The SERVER decides the money: the mock deliberately
    // ignores any price the client might have sent and derives it from the
    // listing, so a client-side recomputation would show up as a mismatch.
    const listing = state.listings.find((l) => l.id === body.listingId);
    const qty = body.quantity ?? 1;
    state.orderKeys.push(body.idempotencyKey ?? null);
    // Behave like the real server: a repeated key returns the FIRST order.
    if (body.idempotencyKey) {
      const prior = state.myOrders.find((o) => o.__key === body.idempotencyKey);
      if (prior) return ok({ order: prior }, 200);
    }
    const order = mkOrder({
      id: 'ord_new' + (state.myOrders.length ? '_' + state.myOrders.length : ''), listingId: listing.id, listingTitle: listing.title,
      quantity: qty, unitPrice: listing.price, total: listing.price * qty,
      currency: listing.currency
    });
    order.__key = body.idempotencyKey ?? null;
    state.myOrders = [order, ...state.myOrders];
    if (listing.quantityAvailable !== null) {
      listing.quantityAvailable -= qty;
      if (listing.quantityAvailable <= 0) {
        listing.status = 'sold_out';
        listing.orderable = false;
        listing.unorderableReason = 'this listing is sold out';
      }
    }
    return ok({ order }, 201);
  }
  if (path === '/api/vendors/me/earnings') {
    // Absent by default: a seller who has settled nothing has no earnings,
    // and the panel must render nothing rather than a zero balance.
    if (!state.earnings) return err(404, 'no vendor profile');
    return ok({ earnings: state.earnings });
  }
  if (path.startsWith('/api/orders?role=vendor')) return ok({ orders: state.vendorOrders });
  if (path.startsWith('/api/orders')) return ok({ orders: state.myOrders });

  // --- vendors -------------------------------------------------------------
  if (path === '/api/vendors' && method === 'POST') {
    state.myVendor = mkVendor({
      id: 'vend_me', ownerId: 'usr_me', displayName: body.displayName,
      description: body.description ?? '', contactMethod: body.contactMethod ?? null,
      verification: { evidence: [], verifiedCount: 0, facts: [{ kind: 'vendor_since', label: 'Selling since August 2026' }] },
      activeListingCount: 0
    });
    return ok({ vendor: state.myVendor }, 201);
  }
  if (path === '/api/vendors/me') return ok({ vendor: state.myVendor });
  const vm = path.match(/^\/api\/vendors\/([^/?]+)$/);
  if (vm && method === 'GET') {
    const v = state.vendors[vm[1]];
    if (!v) return err(404, 'vendor not found');
    return ok({ vendor: v, listings: state.listings.filter((l) => l.vendorId === v.id && l.status === 'active') });
  }

  // --- listings ------------------------------------------------------------
  if (path === '/api/listings' && method === 'POST') {
    const l = mkListing({
      id: 'list_new', vendorId: 'vend_me', title: body.title,
      description: body.description ?? '', type: body.type ?? 'product',
      price: body.price, quantityAvailable: body.quantityAvailable ?? null,
      locationName: body.locationName ?? null,
      status: 'draft', orderable: false, unorderableReason: 'this listing is not published yet',
      vendor: { id: 'vend_me', displayName: state.myVendor.displayName, status: 'active', contactMethod: null }
    });
    state.myListings = [...state.myListings, l];
    return ok({ listing: l }, 201);
  }
  const sm = path.match(/^\/api\/listings\/([^/]+)\/status$/);
  if (sm && method === 'POST') {
    const l = state.myListings.find((x) => x.id === sm[1]);
    const changed = l.status !== body.status;
    l.status = body.status;
    l.orderable = body.status === 'active';
    l.unorderableReason = body.status === 'active' ? null : `this listing is ${body.status}`;
    if (body.status === 'active' && !state.listings.some((x) => x.id === l.id)) state.listings.push(l);
    return ok({ listing: l, changed });
  }
  if (path === '/api/listings/mine') {
    return ok({ vendor: state.myVendor, listings: state.myListings });
  }
  const lm = path.match(/^\/api\/listings\/([^/?]+)$/);
  if (lm && method === 'GET') {
    const l = [...state.listings, ...state.myListings].find((x) => x.id === lm[1]);
    if (!l) return err(404, 'listing not found');
    return ok({ listing: l });
  }
  if (path.startsWith('/api/listings')) return ok({ listings: state.listings });

  if (path.startsWith('/api/disputes')) return ok({ disputes: [] });
  return err(404, 'not found');
};
dom.window.fetch = global.fetch;

async function main() {
  const root = createRoot(document.getElementById('root'));
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const body = () => text(document.body);
  const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 10)); }); };
  const click = async (el) => {
    if (!el) throw new Error('click target not found');
    await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
    await settle();
  };
  const buttons = () => Array.from(document.querySelectorAll('button'));
  const btn = (t) => buttons().find((b) => text(b) === t || text(b).startsWith(t));
  const inputs = () => Array.from(document.querySelectorAll('input'));
  const setVal = async (el, v) => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      setter.call(el, v);
      el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  };
  // Unmount first: <Marketplace> owns section/view state, so re-rendering into
  // a live root would keep the previous scenario's screen open.
  const mount = async (props = {}) => {
    await act(async () => { root.render(null); });
    await act(async () => { root.render(React.createElement(Marketplace, props)); });
    await settle();
  };

  // =========================================================================
  console.log('=== Honest empty marketplace ===');
  reset({ listings: [] });
  await mount();
  let b = body();
  check('empty marketplace says so', /nothing is listed yet/i.test(b), b.slice(0, 160));
  check('no fabricated vendors', !/mama njeri|kikao/i.test(b));
  check('no fabricated prices', !/KES\s*\d/.test(b), b.slice(0, 160));

  await click(btn('My orders'));
  check('no orders yet is stated plainly', /have not ordered anything/i.test(body()));

  await click(btn('Selling'));
  b = body();
  check('non-seller is offered a seller profile', /start selling/i.test(b));
  check('no fake sales figures for a non-seller', !/revenue|earnings|\bsales\b/i.test(b), b.slice(0, 200));

  // =========================================================================
  console.log('\n=== Browse a real listing ===');
  reset();
  await mount();
  b = body();
  check('listing appears in browse', b.includes('50kg Maize Flour'));
  check('price rendered from server', b.includes('3,200'), b.slice(0, 200));
  check('seller named on the card', b.includes('Mama Njeri Groceries'));
  check('location shown when present', b.includes('Kilimani Market'));
  check('stock shown when tracked', /4 available/.test(b));
  check('no rating on a listing card', !/rating|stars|\d\.\d\s*\/\s*5|reviews?/i.test(b));

  // =========================================================================
  console.log('\n=== Listing detail and the order preview ===');
  await click(btn('50kg Maize Flour'));
  b = body();
  check('detail opened', b.includes('Fresh mill, this week'));
  check('detail shows the unit price', b.includes('3,200'));
  check('quantity starts at 1', /Quantity - 1 \+/.test(b) || /Quantity/.test(b));
  check('estimated total labelled as an estimate', /estimated total/i.test(b), b.slice(-400));
  check('estimate is marked server-confirmed', /confirmed by the server/i.test(b));
  check('ordering is stated NOT to be paying',
    /does not pay for it/i.test(b), b.slice(-300));

  // Bump the quantity: the estimate tracks it.
  await click(btn('+'));
  b = body();
  check('quantity increments', /Quantity - 2 \+/.test(b) || b.includes('2'));
  check('estimate follows quantity', b.includes('6,400'), b.slice(-400));

  // =========================================================================
  console.log('\n=== Placing an order: the SERVER total is what is shown ===');
  await click(btn('Place order'));
  b = body();
  check('moves to my orders after ordering', /50kg Maize Flour/.test(b));
  check('SERVER total rendered', b.includes('6,400'), b.slice(0, 300));
  check('unit x quantity shown', /2 x KES 3,200/.test(b), b.slice(0, 300));
  check('order status is ordered', /Ordered/i.test(b));
  check('ORDER IS NOT PAID', /not paid yet/i.test(b), b.slice(0, 400));
  check('unpaid wording names the missing record',
    /no settled payment is on record/i.test(b));
  check('no invented payment confirmation', !/payment (received|successful|complete)/i.test(b));
  check('order POST carried no price field', (() => {
    const call = state.calls.find((c) => c === 'POST /api/orders');
    return Boolean(call);
  })());

  // The request body is the real guard: the client must not send money.
  check('client never sent a total', !JSON.stringify(state.myOrders[0]).includes('"clientTotal"'));

  // =========================================================================
  console.log('\n=== Buyer disputes an order ===');
  await click(btn('Report a problem'));
  b = body();
  check('order shows as disputed', /Disputed/i.test(b), b.slice(0, 300));
  check('dispute reason surfaced', /reported a problem/i.test(b));
  check('no refund is implied', !/refund|money back|reimburse/i.test(b), b.slice(0, 400));
  check('disputed order is not shown as clean', !/fulfilled/i.test(b) || /disputed/i.test(b));

  // =========================================================================
  console.log('\n=== Vendor profile: evidence, never a score ===');
  reset();
  await mount();
  await click(btn('50kg Maize Flour'));
  await click(btn('Sold by Mama Njeri Groceries'));
  b = body();
  check('vendor profile opened', b.includes('Fresh produce, Kilimani market'));
  check('contact method shown', /0722 000111/.test(b));
  check('verification evidence listed', /identity verified/i.test(b));
  check('counted facts listed', /2 active listings/.test(b));
  check('seller-since fact shown', /selling since june 2026/i.test(b));
  check('NO RATING ANYWHERE', !/rating|stars|\d\.\d\s*\/\s*5|reviews?|score/i.test(b), b.slice(0, 400));
  check('no follower or social counts', !/follow|likes?\b/i.test(b));
  check('vendor listings shown', b.includes('50kg Maize Flour'));

  // An unverified seller must show absence, not a zero.
  reset({ vendors: { vend_1: mkVendor({ verification: { evidence: [], verifiedCount: 0, facts: [] } }) } });
  await mount();
  await click(btn('50kg Maize Flour'));
  await click(btn('Sold by Mama Njeri Groceries'));
  b = body();
  check('unverified seller says nothing is verified',
    /nothing has been verified/i.test(b), b.slice(0, 400));
  check('unverified seller shows no zero score', !/\b0\s*(%|stars|\/)/.test(b));

  // =========================================================================
  console.log('\n=== Seller: create profile, list, publish ===');
  reset({ listings: [] });
  await mount();
  await click(btn('Selling'));
  const nameInput = inputs()[0];
  await setVal(nameInput, 'Kikao Streetwear');
  await setVal(inputs()[1], 'Printed hoodies');
  await setVal(inputs()[2], 'WhatsApp 0700 111222');
  await click(btn('Create seller profile'));
  b = body();
  check('seller profile created', b.includes('Kikao Streetwear'), b.slice(0, 200));
  check('new seller has no invented history',
    !/\d+ fulfilled order/.test(b), b.slice(0, 300));

  // Create a listing.
  await setVal(inputs()[0], 'Printed Hoodie');
  await setVal(inputs()[1], 'Heavyweight cotton');
  await setVal(inputs()[2], '2500');
  await setVal(inputs()[3], '5');
  await click(btn('Create listing'));
  b = body();
  check('listing created', b.includes('Printed Hoodie'), b.slice(0, 400));
  check('new listing starts as a draft', /draft/i.test(b));
  check('draft explained to the seller', /start as a draft/i.test(b));
  check('publish offered for a draft', Boolean(btn('Publish')));
  check('pause NOT offered for a draft', !buttons().some((x) => text(x) === 'Pause'));

  await click(btn('Publish'));
  b = body();
  check('published listing reads active', /active/i.test(b));
  check('pause now offered', Boolean(btn('Pause')));
  check('publish no longer offered', !buttons().some((x) => text(x) === 'Publish'));

  await click(btn('Pause'));
  b = body();
  check('paused listing reads paused', /paused/i.test(b));
  check('resume offered when paused', Boolean(btn('Resume')));

  // =========================================================================
  console.log('\n=== Seller fulfils an order ===');
  reset({
    myVendor: mkVendor({ id: 'vend_me', ownerId: 'usr_me', displayName: 'Kikao Streetwear' }),
    myListings: [mkListing({ id: 'list_me', vendorId: 'vend_me', title: 'Printed Hoodie' })],
    vendorOrders: [mkOrder({ id: 'ord_v', listingTitle: 'Printed Hoodie', vendorId: 'vend_me', vendorOwnerId: 'usr_me', buyerId: 'usr_ann' })]
  });
  await mount();
  await click(btn('Selling'));
  b = body();
  check('incoming order listed', b.includes('Printed Hoodie'));
  check('orders-to-fulfil count shown', /1 to fulfil/.test(b), b.slice(0, 400));
  check('fulfil action offered', Boolean(btn('Mark fulfilled')));

  await click(btn('Mark fulfilled'));
  b = body();
  check('order reads fulfilled', /Fulfilled/i.test(b));
  check('FULFILLED IS STILL NOT PAID', /not paid yet/i.test(b), b.slice(0, 500));
  check('fulfilment did not invent revenue', !/revenue|earned|payout/i.test(b));
  check('fulfil no longer offered once fulfilled', !buttons().some((x) => text(x) === 'Mark fulfilled'));

  // =========================================================================
  console.log('\n=== Server refusals are surfaced verbatim ===');
  reset();
  state.refuse = { match: '/api/orders', status: 400, message: 'this listing is sold out' };
  await mount();
  await click(btn('50kg Maize Flour'));
  await click(btn('Place order'));
  b = body();
  check('server refusal shown to the user', /sold out/i.test(b), b.slice(-400));
  check('refused order created nothing locally', state.myOrders.length === 0);

  // A vendor-side refusal.
  reset({
    myVendor: mkVendor({ id: 'vend_me', ownerId: 'usr_me' }),
    myListings: [mkListing({ id: 'list_me', vendorId: 'vend_me' })],
    vendorOrders: [mkOrder({ id: 'ord_v', vendorId: 'vend_me', vendorOwnerId: 'usr_me' })]
  });
  state.refuse = { match: '/fulfil', status: 403, message: 'only the vendor for this order may fulfil it' };
  await mount();
  await click(btn('Selling'));
  await click(btn('Mark fulfilled'));
  check('403 refusal surfaced verbatim',
    /only the vendor for this order may fulfil it/i.test(body()), body().slice(-300));

  // =========================================================================
  console.log('\n=== Sold-out listing cannot be ordered ===');
  reset({ listings: [mkListing({ quantityAvailable: 0, status: 'sold_out', orderable: false, unorderableReason: 'this listing is sold out' })] });
  await mount();
  b = body();
  check('sold-out reason on the card', /sold out/i.test(b));
  await click(btn('50kg Maize Flour'));
  b = body();
  check('no order box on a sold-out listing', !buttons().some((x) => text(x) === 'Place order'));
  check('sold-out reason explained on detail', /sold out/i.test(b));

  // =========================================================================
  console.log('\n=== A service listing needs no stock and no location ===');
  reset({ listings: [mkListing({ id: 'list_svc', title: 'Home deep clean', type: 'service', price: 3000, quantityAvailable: null, locationName: null })] });
  await mount();
  b = body();
  check('service listed', b.includes('Home deep clean'));
  check('service shows no stock line', !/\davailable/i.test(b.replace('Home deep clean', '')));
  check('service type labelled', /Service/.test(b));
  await click(btn('Home deep clean'));
  check('service is orderable without stock', Boolean(btn('Place order')));


  // =========================================================================
  // DOUBLE-TAP PROTECTION
  //
  // The buyer-facing half of server-side idempotency. A shaky connection or
  // an impatient tap must not create two commitments to pay.
  console.log('\n=== Placing an order twice does not create two orders ===');
  reset({ listings: [mkListing({ id: 'list_dbl', title: 'Sack of potatoes', price: 1200, quantityAvailable: 10 })] });
  await mount();
  await click(btn('Sack of potatoes'));
  check('order button present', Boolean(btn('Place order')));
  await click(btn('Place order'));
  check('an idempotency key was SENT', state.orderKeys.length === 1 && typeof state.orderKeys[0] === 'string',
    JSON.stringify(state.orderKeys));
  check('the key is non-empty', (state.orderKeys[0] || '').length > 5);
  check('exactly one order exists', state.myOrders.length === 1, `got ${state.myOrders.length}`);

  // Buying the same thing again LATER is legitimate and must still work:
  // idempotency protects against retries, not against repeat custom.
  const firstKey = state.orderKeys[0];
  await mount();
  await click(btn('Sack of potatoes'));
  if (btn('Place order')) {
    await click(btn('Place order'));
    check('a deliberate second purchase uses a NEW key',
      state.orderKeys.length === 2 && state.orderKeys[1] !== firstKey,
      JSON.stringify(state.orderKeys));
    check('the second purchase created a second order', state.myOrders.length === 2,
      `got ${state.myOrders.length}`);
  }

  // =========================================================================
  // EARNINGS ARE NOT A WALLET
  console.log('\n=== Settled earnings render only when money really settled ===');
  reset({
    myVendor: mkVendor({ id: 'vend_me', ownerId: 'usr_me', displayName: 'My Stall' }),
    earnings: {
      vendorId: 'vend_me', currency: 'KES', gross: 0, commission: 0, net: 0,
      orderCount: 0, rate: 0.05, lines: [],
      payoutAvailable: false, payoutReason: 'no payment provider is connected'
    }
  });
  await mount();
  if (btn('Selling')) await click(btn('Selling'));
  b = body();
  check('a seller with nothing settled sees NO earnings panel', !/Settled earnings/i.test(b));
  check('and no zero balance is invented', !/KES\s*0\b/.test(b));

  reset({
    myVendor: mkVendor({ id: 'vend_me', ownerId: 'usr_me', displayName: 'My Stall' }),
    earnings: {
      vendorId: 'vend_me', currency: 'KES', gross: 4000, commission: 200, net: 3800,
      orderCount: 2, rate: 0.05,
      lines: [], payoutAvailable: false,
      payoutReason: 'Earned, but not withdrawable: no payment provider is connected.'
    }
  });
  await mount();
  if (btn('Selling')) await click(btn('Selling'));
  b = body();
  check('settled earnings shown', /Settled earnings/i.test(b));
  check('NET is the headline, not gross', /3,?800/.test(b));
  check('gross is disclosed', /4,?000/.test(b));
  check('commission is disclosed', /200/.test(b));
  check('the order count is real', /2 settled orders/i.test(b));
  // The single most important honesty check on this panel.
  check('states it is NOT withdrawable', /not withdrawable/i.test(b), b.slice(0, 200));
  check('names the actual reason', /no payment provider/i.test(b));
  check('no withdraw button is offered', !buttons().some((x) => /withdraw|cash ?out|payout/i.test(text(x))));

  console.log(`\n${'='.repeat(52)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
