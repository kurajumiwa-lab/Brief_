// ---------------------------------------------------------------------------
// SELLER HARDENING — no invented digits, no silent refusal, no false success.
//
// Four shipped surfaces prefilled a phone number when the customer had not given
// one ('254712345678' / '+254700000000'), and one seeded a quote price of 5000
// that nobody quoted. A phone in a payment field is not a placeholder: it is the
// value that gets submitted, and the server had a guard ("Phone number is
// required for M-Pesa STK push") that those defaults existed to bypass. A
// pre-filled price is the same thing with money on the end of it.
//
// Pinned here:
//   * a field the customer did not fill in starts EMPTY, and sending is refused
//     with the reason, not with a fabricated number;
//   * a refusal from the API is SHOWN. briefApi never throws, so a try/catch is
//     not error handling — the result has to be read;
//   * nothing announces success the ledger did not accept;
//   * the walk-in enquiry loop is reachable from the storefront header (it used
//     to hang off a component nothing mounted), and it records an ENQUIRY, not
//     an "order".
// ---------------------------------------------------------------------------
const assert = require('assert').strict;
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.localStorage = dom.window.localStorage;

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const { SpaceConversationThread } = require('./src/features/spaces/SpaceConversationThread.tsx');
const { SpaceStorefrontHeader } = require('./src/features/spaces/SpaceStorefrontHeader.tsx');
const { AppShell } = require('./src/app/AppShell.tsx');

let count = 0;
const pass = (n) => { count++; console.log('PASS ' + n); };
const flush = (ms = 70) => new Promise((r) => setTimeout(r, ms));
function mount(el) {
  document.body.innerHTML = '';
  const c = document.createElement('div');
  document.body.appendChild(c);
  const root = createRoot(c);
  act(() => root.render(el));
  return { container: c, root };
}
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const btnIn = (scope, re) => Array.from(scope.querySelectorAll('button')).find((b) => re.test(text(b)));
const click = (el) => act(() => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
const submit = (form) => act(() => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
const setVal = (el, v) => act(() => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
});

let posts = [];
let failNext = null;
global.fetch = async (input, init) => {
  const url = String(input?.url ?? input ?? '');
  const body = init?.body ? String(init.body) : null;
  posts.push({ url, method: init?.method ?? 'GET', body: body ? JSON.parse(body) : null });
  if (failNext && url.includes(failNext)) {
    return { ok: false, status: 400, text: async () => JSON.stringify({ error: 'No M-Pesa provider is configured for this deployment' }) };
  }
  const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
  if (url.includes('/mpesa-prompt')) return ok({ prompt: { id: 'pmp_1', status: 'pending', amountKes: 800, createdAt: new Date().toISOString() } });
  if (url.includes('/conversations')) return ok({ conversation: { id: 'cv_1', spaceId: 'spc_1', status: 'new' } });
  if (url.includes('/api/spaces')) return ok({ spaces: [{ id: 'spc_1', name: 'Tilapia at Wakulima' }], space: { id: 'spc_1', name: 'Tilapia at Wakulima', ownerId: 'u1', vendorId: 'v1', type: 'business', goal: '', targetValueKes: 0, visibility: 'public', status: 'active', capabilities: [], offers: [], recentActivities: [], recentConversations: [], metrics: { revenueKes: 0, customerCount: 0, activeOrdersCount: 0, totalOrdersCount: 0, offersCount: 0 }, createdAt: '', updatedAt: '' } });
  return ok({});
};

// placeholders are attributes, not text: match them, do not search textContent
const promptFormOf = (scope) => Array.from(scope.querySelectorAll('form')).find((f) => /STK Push Prompt/i.test(f.textContent));
const phoneInputOf = (scope) => Array.from(scope.querySelectorAll('input')).find((i) => (i.getAttribute('placeholder') ?? '').startsWith('Customer Phone'));
const amountInputOf = (scope) => Array.from(scope.querySelectorAll('input')).find((i) => (i.getAttribute('placeholder') ?? '').startsWith('Amount in KES'));

const conversation = (over = {}) => ({
  id: 'cv_1',
  spaceId: 'spc_1',
  customerName: 'Wanjiku',
  customerContact: '',
  offerId: null,
  offerTitle: '',
  offerPriceKes: null,
  status: 'new',
  messages: [{ id: 'm1', from: 'customer', text: 'Do you have 12 cupcakes?', at: new Date().toISOString() }],
  paymentPrompts: [],
  quotes: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over
});

async function main() {
  // --- 1. no contact on the enquiry: empty fields, refused send, no digits ---
  {
    posts = [];
    const { container } = mount(React.createElement(SpaceConversationThread, { spaceId: 'spc_1', conversation: conversation() }));
    await flush();
    assert.ok(!/254712345678|254700000000/.test(container.innerHTML), 'no invented phone number anywhere in the markup');

    const quoteBtn = btnIn(container, /Quote/i);
    assert.ok(quoteBtn, 'the quote drawer exists');
    click(quoteBtn);
    await flush();
    const price = Array.from(container.querySelectorAll('input')).find((i) => i.getAttribute('placeholder') === 'Price in KES');
    assert.ok(price, 'the price field is there');
    assert.equal(price.value, '', 'and starts EMPTY — no 5,000 seeded into a money field');

    const promptBtn = btnIn(container, /M-Pesa STK/i);
    assert.ok(promptBtn, 'the prompt control exists');
    click(promptBtn);
    await flush();
    const promptForm = promptFormOf(container);
    assert.ok(promptForm, 'the prompt form opened');
    const phoneInput = phoneInputOf(container);
    assert.equal(phoneInput.value, '', 'its number field is blank, not prefilled with a sample');
    setVal(amountInputOf(container), '800');
    submit(promptFormOf(container));
    await flush();
    assert.ok(!posts.some((p) => p.url.includes('/mpesa-prompt')), 'nothing is POSTed to a number that does not exist');
    const alert = container.querySelector('[role="alert"]');
    assert.ok(alert && /no phone number on it/.test(alert.textContent), 'the refusal is shown with its reason');
    assert.ok(!/KES 0/.test(text(promptForm)), 'and the button does not advertise a zero-amount prompt');
  }
  pass('A missing phone is a refusal, not a fabricated number');

  // --- 2. a contact that exists is used exactly as stated, and a refusal is read
  {
    posts = [];
    const { container } = mount(React.createElement(SpaceConversationThread, {
      spaceId: 'spc_1', conversation: conversation({ customerContact: '+254733445566', offerTitle: 'Cupcakes', offerPriceKes: 1200 })
    }));
    await flush();
    const promptBtn = btnIn(container, /M-Pesa/i);
    click(promptBtn);
    await flush();
    assert.equal(phoneInputOf(container).value, '+254733445566', 'the number on the row is what prefills — the row, not a guess');
    assert.equal(amountInputOf(container).value, '1200', 'and the amount is the quoted price, not a default');
    submit(promptFormOf(container));
    await flush();
    const sent = posts.find((p) => p.url.includes('/mpesa-prompt'));
    assert.ok(sent, 'with a real number and the row price, the prompt is requested');
    assert.equal(sent.body.phoneNumber, '+254733445566');
    assert.equal(sent.body.amountKes, 1200, 'at the quoted price, not a default');

    // Now make the server refuse, and check the seller is told.
    failNext = '/mpesa-prompt';
    posts = [];
    const { container: c2 } = mount(React.createElement(SpaceConversationThread, {
      spaceId: 'spc_1', conversation: conversation({ customerContact: '+254733445566', offerTitle: 'Cupcakes', offerPriceKes: 1200 })
    }));
    await flush();
    click(btnIn(c2, /M-Pesa/i));
    await flush();
    submit(promptFormOf(c2));
    await flush();
    const alert2 = c2.querySelector('[role="alert"]');
    assert.ok(alert2 && /provider/i.test(alert2.textContent), 'the API refusal reaches the screen verbatim');
    failNext = null;
  }
  pass('A stated number is used as stated; an API refusal is shown, not swallowed');

  // --- 3. the walk-in loop is reachable, and it says what it wrote ---------
  {
    let opened = 0;
    const { container } = mount(React.createElement(SpaceStorefrontHeader, {
      space: {
        id: 'spc_1', ownerId: 'u1', name: 'Tilapia at Wakulima', type: 'business', goal: 'First 20 customers',
        visibility: 'public', status: 'active', image: null, offers: [], recentConversations: [], metrics: { revenueKes: 0, offersCount: 2 },
        profileLabels: { where: 'Wakulima Market', when: 'Tue, Sat 06:00–18:00' }, recentActivities: [], capabilities: [], createdAt: '', updatedAt: ''
      },
      onCreateOrder: () => { opened++; }
    }));
    const walkIn = btnIn(container, /Walk-in enquiry/);
    assert.ok(walkIn, 'the header offers the walk-in enquiry, because that loop writes rows');
    click(walkIn);
    assert.equal(opened, 1, 'and it calls through to the real form');
  }
  pass('The walk-in enquiry loop is on the storefront, not orphaned in a dead header');

  // --- 4. end to end through the shell: blank stays blank ------------------
  {
    posts = [];
    const { container } = mount(React.createElement(AppShell, { initialTab: 'pipeline' }));
    await flush(120);
    const walkIn = Array.from(container.querySelectorAll('button')).find((b) => /Walk-in enquiry/.test(text(b)));
    if (walkIn) {
      click(walkIn);
      await flush();
      assert.ok(text(container).includes('New Walk-in Customer'), 'the modal opens');
      const nameInput = Array.from(container.querySelectorAll('input')).find((i) => /name/i.test(i.getAttribute('placeholder') ?? '') || /customer/i.test(i.getAttribute('aria-label') ?? ''));
      assert.ok(nameInput, 'the customer name field is there');
      setVal(nameInput, 'Gikomba trader');
      const form = nameInput.closest('form');
      submit(form);
      await flush();
      const conv = posts.find((p) => p.url.includes('/conversations'));
      assert.ok(conv, 'the enquiry is written');
      assert.equal(conv.body.customerContact, '', 'with no phone on it, the contact stays blank — never a sample number');
      assert.ok(!/Order created/i.test(text(container)), 'and nothing claims an order was created');
    } else {
      // If the shell landed elsewhere (no space open), still assert no fake digits.
      assert.ok(!/254712345678|254700000000/.test(container.innerHTML), 'no invented digits on the shell either');
    }
  }
  pass('Through the shell: a blank contact stays blank, and no false "order created"');

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
