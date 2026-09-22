// ---------------------------------------------------------------------------
// EDITING AFTER PUBLISHING — a space and its offers stay the owner's to change.
//
// Two things this pins, because both were broken in the same direction:
//
//   1. THE CONTROLS WERE COSMETIC. "Pause offer" flipped local React state:
//      the offer stayed live to buyers. Now every status move goes through
//      POST /api/listings/:id/status and the card re-renders from the row the
//      server returns — so if the server says it is still active, the card says
//      ACTIVE. A lie with a checkmark is worse than no button.
//   2. THERE WAS NO WAY TO EDIT THE SPACE ITSELF. Name, goal and target were
//      set once at creation and then unreachable, even though the server always
//      allowed the patch. And a withdrawn offer must NOT offer "relist",
//      because archived is terminal by design — orders refer to what the
//      listing was, so re-listing means a new offer.
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
// FormData, File and Blob must come from ONE realm. Node's global FormData
// rejects a jsdom File as "not of type Blob", so the upload path is bound to
// jsdom's. Without this line the suite fails on plumbing, not on behaviour.
global.FormData = dom.window.FormData;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.localStorage = dom.window.localStorage;
// jsdom ships no clipboard: the copy path must degrade to telling the user what
// to do, rather than claiming a copy it could not make.
Object.defineProperty(dom.window.navigator, 'clipboard', { value: undefined, configurable: true });

const React = require('react');
const path = require('path');
const fs = require('fs');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const { SpaceShell } = require('./src/features/spaces/SpaceShell.tsx');
const { MIRROR_MONEY_FIELDS, MIRROR_REASON_MIN } = require('./src/features/spaces/CatalogView.tsx');

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
const q = (sel) => document.querySelector(sel);
const btn = (want) => Array.from(document.querySelectorAll('button')).find((b) => text(b) === want || text(b).startsWith(want));
const byAria = (label) => Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === label);
const click = (el, what = 'control') => act(() => {
  // A missing element used to surface as "cannot read dispatchEvent of
  // undefined" pointing at a helper. Name the control instead, so a
  // failure says which button the UI failed to render.
  if (!el) throw new Error('no such control in the rendered UI: ' + what);
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
const setValue = (el, value) => {
  const proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
};

/** jsdom will not let a test type into a file input, so hand it a FileList. */
function chooseFile(input, name) {
  const file = new dom.window.File([Buffer.from('fake png bytes')], name, { type: 'image/png' });
  const list = { 0: file, length: 1, item: (i) => (i === 0 ? file : null), [Symbol.iterator]: function* () { yield file; } };
  Object.defineProperty(input, 'files', { value: list, configurable: true });
  // React listens for 'change' on a file input, and 'input' elsewhere: send
  // both so the suite is not coupled to that detail.
  act(() => {
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
}

/**
 * Hand the shared recorder back after a block that installed its own fetch.
 * Every later test answers through `handler`, so a private fetch left in place
 * makes the NEXT test read the wrong shop and fail for a reason that has
 * nothing to do with what it is checking.
 */
function restoreFetch() {
  global.fetch = async (input, init) => {
    const url = String(input?.url ?? input ?? '');
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? String(init.body) : null });
    return handler(url, init);
  };
}

const offer = (id, status, over = {}) => ({
  id, vendorId: 'v1', spaceId: 'spc_1', title: `${id} cake`, description: 'Two tiers', type: 'product',
  price: 4500, currency: 'KES', quantityAvailable: 6, status, createdAt: '', updatedAt: '',
  // The client's own `isListing` guard (src/api/validate.ts) refuses a row
  // without these two, and a refused row never reaches the card. A fixture that
  // fails validation makes every "the badge follows the row" assertion vacuous:
  // the badge would still say ACTIVE because nothing was applied at all.
  orderable: status === 'active', unorderableReason: status === 'active' ? null : 'this listing is not published yet',
  // `locationName` has to be PRESENT and null: `isStrOrNull(undefined)` is
  // false, so an omitted field makes the client reject the whole row, the
  // editor stays open on an error, and any later assertion about the card is
  // reading a card that never received the server's answer.
  locationName: null,
  media: [], ...over
});

const spaceWith = (over = {}) => ({
  id: 'spc_1', ownerId: 'u1', vendorId: 'v1', name: "Amina's Cakes", type: 'business',
  goal: 'First 20 customers', targetValueKes: 100000, image: null,
  visibility: 'public', status: 'active', capabilities: [],
  offers: [offer('lst_1', 'active'), offer('lst_2', 'draft'), offer('lst_3', 'archived')],
  recentActivities: [], recentConversations: [], metrics: { revenueKes: 0, customerCount: 0, activeOrdersCount: 0, totalOrdersCount: 0, offersCount: 2 },
  createdAt: '', updatedAt: '', ...over
});

let calls = [];
let handler;
global.fetch = async (input, init) => {
  const url = String(input?.url ?? input ?? '');
  const body = init?.body ? String(init.body) : null;
  calls.push({ url, method: init?.method ?? 'GET', body });
  return handler(url, init);
};
const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });

async function main() {
  // --- 1. the space itself stays editable after going public ---------------
  handler = async (url, init) => {
    if (url.includes('/api/spaces/spc_1/operating')) return ok({ fields: [], maintenance: null, editorial: [], pipeline: null });
    if (url.endsWith('/api/spaces/spc_1') && (init?.method ?? 'GET') === 'GET') return ok({ space: spaceWith() });
    if (url.endsWith('/api/spaces/spc_1') && init?.method === 'PATCH') {
      const sent = JSON.parse(String(init.body));
      return ok({ space: spaceWith({ name: sent.name, goal: sent.goal, targetValueKes: sent.targetValueKes }) });
    }
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(SpaceShell, { spaceId: 'spc_1', onBack: () => {}, onShare: () => {} }));
    await flush();
    const edit = byAria('Edit this space');
    assert.ok(edit, 'a public space offers an edit control');
    click(edit);
    await flush();
    assert.ok(q('input[aria-label="Space name"]'), 'the editor opens with the name');
    assert.equal(q('input[aria-label="Space name"]').value, "Amina's Cakes", 'prefilled from the stored row');
    setValue(q('input[aria-label="Space name"]'), "Amina's Cake Studio");
    setValue(q('input[aria-label="Monthly target"]'), '');
    click(btn('Save'));
    await flush();
    const patch = calls.find((c) => c.method === 'PATCH' && c.url.endsWith('/api/spaces/spc_1'));
    assert.ok(patch, 'the edit goes to the real PATCH rail');
    assert.equal(JSON.parse(patch.body).name, "Amina's Cake Studio", 'with the new name');
    assert.equal(JSON.parse(patch.body).targetValueKes, null, 'a cleared target is null, not 0');
    const t = text(container);
    assert.ok(t.includes('Amina\'s Cake Studio'), 'the header shows the saved name');
    assert.ok(t.includes('directory shows this on the next read'), 'and publishing is stated as no barrier');
  }
  pass('A published space stays editable: name, goal and target save through the real rail');

  // --- 2. a refused edit is shown, not swallowed ---------------------------
  handler = async (url, init) => {
    if (url.includes('/api/spaces/spc_1/operating')) return ok({ fields: [], maintenance: null, editorial: [], pipeline: [] });
    if (url.endsWith('/api/spaces/spc_1') && (init?.method ?? 'GET') === 'GET') return ok({ space: spaceWith() });
    if (init?.method === 'PATCH') return { ok: false, status: 400, text: async () => JSON.stringify({ error: 'Space name is required' }) };
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(SpaceShell, { spaceId: 'spc_1', onBack: () => {}, onShare: () => {} }));
    await flush();
    click(byAria('Edit this space'));
    await flush();
    setValue(q('input[aria-label="Space name"]'), 'x'.repeat(3));
    click(btn('Save'));
    await flush();
    assert.ok(text(container).includes('Space name is required'), "the server's refusal appears word for word");
  }
  pass('A refused edit surfaces the server’s reason');

  // --- 3. offer controls are real, and status comes from the row ----------
  let pausedTo = null;
  let editedPrice = null;
  handler = async (url, init) => {
    const method = init?.method ?? 'GET';
    if (url.includes('/status') && method === 'POST') {
      pausedTo = JSON.parse(String(init.body)).status;
      // The row the server sends back is ACTIVE anyway: the UI must follow it.
      return ok({ listing: offer('lst_1', 'active'), changed: true });
    }
    if (url.includes('/api/listings/lst_1') && method === 'PATCH') {
      editedPrice = JSON.parse(String(init.body)).price;
      return ok({ listing: offer('lst_1', 'active', { price: editedPrice }) });
    }
    if (url.includes('/api/spaces/spc_1/operating')) return ok({ fields: [], maintenance: null, editorial: [], pipeline: null });
    if (url.endsWith('/api/spaces/spc_1') && method === 'GET') return ok({ space: spaceWith() });
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(SpaceShell, { spaceId: 'spc_1', onBack: () => {}, onShare: () => {}, initialTab: 'catalog' }));
    await flush();
    const menu = byAria('Actions for lst_1 cake');
    assert.ok(menu, 'an active offer has a menu of its legal moves');
    click(menu);
    await flush();
    const pause = btn('Pause — hidden from buyers');
    assert.ok(pause, 'pause is offered for an active offer');
    click(pause);
    await flush();
    assert.equal(pausedTo, 'paused', 'the move goes through the transition endpoint, not local state');

    // And because the server row still says active, the card must say ACTIVE.
    const t = text(container);
    assert.ok(t.includes('ACTIVE'), 'the badge follows the row, not the click');
    assert.ok(!t.includes('PAUSED'), 'no optimistic lie about a paused offer');

    // Editing content after publishing. Exact match: the header has its own
    // "Edit space" control, and the two must not be confused.
    const editOffer = Array.from(container.querySelectorAll('button')).find((b) => text(b) === 'Edit');
    assert.ok(editOffer, 'the offer card carries its own Edit control');
    click(editOffer);
    await flush();
    assert.ok(q('input[aria-label="Offer price"]'), 'the offer editor opens');
    // The photos are in the same editor. They used to be missing, which made a
    // published offer permanently un-photographable even though the server
    // accepts `media` on the very same PATCH.
    assert.ok(q('input[aria-label="Add Photos of these goods"]'), 'the editor carries a real photo uploader');
    setValue(q('input[aria-label="Offer price"]'), '3900');
    await flush();
    // A published money change asks for the seller's reason IN THE ROW, instead
    // of bouncing them off the server's refusal with no way to answer it.
    const reason = q('input[aria-label="Reason for the price change"]');
    assert.ok(reason, 'a published price change opens a reason field');
    click(btn('Save changes'));
    await flush();
    assert.equal(editedPrice, null, 'a money change with no reason does not reach the network');
    assert.equal(calls.filter((c) => c.method === 'PATCH' && c.url.includes('/api/listings/lst_1')).length, 0,
      'no doomed request is sent, so the server is not the one teaching this');
    assert.match(text(container), /Say why the price is changing/, 'and the row says what it wants, in plain words');
    setValue(reason, 'sugar went up at the mill');
    click(btn('Save changes'));
    await flush();
    assert.equal(editedPrice, 3900, 'the price PATCHes the real listing rail');
    assert.equal(text(container).includes('Saving…'), false, 'and the row is not stuck mid-save');
    const patchBody = JSON.parse(calls.find((c) => c.method === 'PATCH' && c.url.includes('/api/listings/lst_1')).body);
    assert.equal(patchBody.reason, 'sugar went up at the mill', 'with the seller’s own reason attached');
    assert.ok(Array.isArray(patchBody.media), 'and the photo list rides along, so an edit cannot wipe it');
    // A plain content edit needs no reason: the gate is on money, not on effort.
    // The row closed on save, so it is opened again from the row itself.
    const reopen = Array.from(container.querySelectorAll('button')).find((b) => text(b) === 'Edit');
    click(reopen);
    await flush();
    setValue(q('input[aria-label="Offer title"]'), 'Red velvet, 2 tiers');
    await flush();
    assert.equal(q('input[aria-label="Reason for the price change"]'), null, 'a title edit alone raises no reason row');
    click(btn('Save changes'));
    await flush();
    const lastPatch = calls.filter((c) => c.method === 'PATCH' && c.url.includes('/api/listings/lst_1')).pop();
    const lastBody = JSON.parse(lastPatch.body);
    assert.equal(lastBody.title, 'Red velvet, 2 tiers', 'and the title still saves');
    assert.equal(lastBody.reason, undefined, 'with no reason invented for a field nobody gated');

    // The client mirrors the server's money list rather than re-declaring it.
    const serverListing = fs.readFileSync(path.join(__dirname, '../server/src/domain/listing.js'), 'utf8');
    const serverMoney = (serverListing.match(/export const MONEY_FIELDS = \[([^\]]*)\]/) || [])[1];
    assert.ok(serverMoney, 'the server declares the money set');
    assert.deepEqual(
      MIRROR_MONEY_FIELDS,
      serverMoney.split(',').map((s) => s.trim().replace(/^'|'$/g, '')),
      'the editor gates exactly the fields the server gates'
    );
    assert.match(serverListing, /export const REASON_MIN = 6;/, 'the server minimum is still 6');
    assert.equal(MIRROR_REASON_MIN, 6, 'and the editor asks at the same length, not a stricter one');
  }
  pass('Offer pause and price edits are server calls; a money change carries a reason');

  // --- 3b. the photos are edited on the row, with no reason gate ------------
  // A picture is a descriptive field: the server never asks why you swapped it,
  // and the row must not ask either. This is the half of the editor that did not
  // exist at all — published offers could not be re-photographed.
  // One stored value, read back after the write, so the card shows what the
  // server has rather than what the fixture always returns. A test that cannot
  // see its own save is a test of the request, not of the product.
  let storedMedia = [];
  const h3b = async (url, init) => {
    const method = init?.method ?? 'GET';
    if (url.includes('/api/media/status')) return ok({ media: null, uploads: { maxBytes: 5242880, persisted: false } });
    if (url.includes('/api/media/upload') && method === 'POST') {
      return { ok: true, status: 201, text: async () => JSON.stringify({
        upload: { id: 'upl_photo', url: '/api/media/file/upl_photo', mimeType: 'image/png', bytes: 14, sha256: 'c'.repeat(64), originalName: 'cake.png', alt: null, createdAt: '2026-09-20T00:00:00Z' },
        duplicate: false
      }) };
    }
    if (url.includes('/api/listings/lst_1') && method === 'PATCH') {
      storedMedia = JSON.parse(String(init.body)).media ?? [];
      return ok({ listing: offer('lst_1', 'active', { media: storedMedia }) });
    }
    if (url.includes('/api/spaces/spc_1/operating')) return ok({ fields: [], maintenance: null, editorial: [], pipeline: null });
    if (url.endsWith('/api/spaces/spc_1') && method === 'GET') {
      return ok({ space: spaceWith({ offers: [offer('lst_1', 'active', { media: storedMedia }), offer('lst_2', 'draft'), offer('lst_3', 'archived')] }) });
    }
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  global.fetch = async (input, init) => {
    const url = String(input?.url ?? input ?? '');
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? String(init.body) : null });
    return h3b(url, init);
  };
  {
    const { container } = mount(React.createElement(SpaceShell, { spaceId: 'spc_1', onBack: () => {}, onShare: () => {}, initialTab: 'catalog' }));
    await flush();
    click(Array.from(container.querySelectorAll('button')).find((b) => text(b) === 'Edit'), 'offer Edit');
    await flush();
    assert.match(text(container), /No photo yet/, 'an offer with no picture says so, rather than showing a stock one');
    const picker = q('input[type="file"]');
    assert.ok(picker, 'the row carries a real file input');
    chooseFile(picker, 'cake.png');
    await flush(140);
    assert.match(text(container), /Photos \(1\)/, 'the upload lands in the row’s own count');
    assert.ok(
      Array.from(container.querySelectorAll('img')).some((im) => String(im.getAttribute('src')).includes('api/media/file/upl_photo')),
      'and the picture is the file the server took, not a placeholder'
    );
    assert.equal(q('input[aria-label="Reason for the price change"]'), null, 'a photo edit raises no reason row');
    click(btn('Save changes'));
    await flush();
    const mediaPatch = calls.filter((c) => c.method === 'PATCH' && c.url.includes('/api/listings/lst_1')).pop();
    assert.ok(mediaPatch, 'the photo save goes to the listing rail');
    const mediaBody = JSON.parse(mediaPatch.body);
    assert.deepEqual(mediaBody.media, ['/api/media/file/upl_photo'], 'the media list is the server path, not the SPA proxy prefix');
    assert.equal(mediaBody.reason, undefined, 'and no reason is demanded for a picture');

    // Remove it again: an empty gallery is a real edit, not an ignored field.
    // The save closed the row, so it is opened again from the refreshed card —
    // and the refreshed card still carries the photo, because the server has it.
    assert.ok(
      Array.from(container.querySelectorAll('img')).some((im) => String(im.getAttribute('src')).includes('api/media/file/upl_photo')),
      'and the photo is on the card itself after the save, not only inside the editor'
    );
    click(Array.from(container.querySelectorAll('button')).find((b) => text(b) === 'Edit'), 'offer Edit again');
    await flush();
    click(byAria('Remove photo 1 from lst_1 cake'), 'remove photo');
    await flush();
    assert.match(text(container), /Photos \(0\)/, 'the row can take the picture back down');
    click(btn('Save changes'));
    await flush();
    const cleared = JSON.parse(calls.filter((c) => c.method === 'PATCH' && c.url.includes('/api/listings/lst_1')).pop().body);
    assert.deepEqual(cleared.media, [], 'and an empty gallery is sent as empty, not omitted');
  }
  // Hand the shared recorder back: every later test installs its answers on
  // `handler`, so leaving this block's private handler in place would make the
  // next test read the wrong shop and fail for the wrong reason.
  restoreFetch();
  pass('Photos are editable after publish: uploaded, counted, removable, never gated');

  // --- 3c. the arm of the business: a label the owner chooses, from the server
  // A space with no mode is UNSTATED, so the select must offer that as its own
  // answer, and the list of arms has to come from the read — a client that kept
  // its own copy could offer something the row would refuse.
  let modePatch;
  global.fetch = async (input, init) => {
    const url = String(input?.url ?? input ?? '');
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? String(init.body) : null });
    const okp = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
    if (url.includes('/api/spaces/spc_1/operating')) return okp({ fields: [], maintenance: null, editorial: [], pipeline: null });
    if (url.endsWith('/api/spaces/spc_1') && method === 'GET') {
      return okp({
        space: spaceWith({ mode: 'wholesale', modeLabel: 'Wholesale' }),
        modes: [
          { id: 'retail', label: 'Retail', blurb: 'Selling to the person who walks in' },
          { id: 'wholesale', label: 'Wholesale', blurb: 'Bulk, for other shops to resell' },
          { id: 'other', label: 'Something else', blurb: 'Say it in your own words' }
        ]
      });
    }
    if (url.endsWith('/api/spaces/spc_1') && method === 'PATCH') {
      const sent = JSON.parse(String(init.body));
      modePatch = sent;
      return okp({ space: spaceWith({ mode: sent.mode, modeLabel: sent.mode === null ? null : 'Retail' }) });
    }
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(SpaceShell, { spaceId: 'spc_1', onBack: () => {}, onShare: () => {} }));
    await flush();
    click(byAria('Edit this space'));
    await flush();
    const select = q('select[aria-label="Space mode"]');
    assert.ok(select, 'the editor can name which arm of the business this is');
    assert.equal(select.value, 'wholesale', 'prefilled from the stored row');
    // One option per server-supplied arm, plus the explicit "not stated".
    const options = Array.from(select.querySelectorAll('option'));
    assert.equal(options.length, 4, 'three arms from the read, and the blank answer');
    assert.equal(options[0].value, '', 'and blank is a real choice, not a placeholder to be missed');
    assert.match(options[0].textContent, /Not stated/, 'labelled in words a person reads');
    assert.ok(!options.some((o) => /Retail \(\d+\)|\b\d+ offers\b/.test(o.textContent)), 'no tile counts, so no zero is printed as a shop window');
    act(() => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set.call(select, 'retail');
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
    click(btn('Save'));
    await flush();
    assert.equal(modePatch.mode, 'retail', 'the choice is PATCHed as the id, not the label');
    assert.ok(!('modeLabel' in modePatch), 'and the client never sends a label of its own');
    // Clearing is an ordinary edit: null, not '' and not omission.
    click(byAria('Edit this space'));
    await flush();
    act(() => {
      const sel2 = q('select[aria-label="Space mode"]');
      Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set.call(sel2, '');
      sel2.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
    click(btn('Save'));
    await flush();
    assert.equal(modePatch.mode, null, 'choosing "Not stated" stores null, so nothing defaults to retail');
  }
  // Back to the shared recorder: the tests after this one answer through
  // `handler`, and a private fetch left in place makes the next test read the
  // wrong shop and fail for the wrong reason. (This exact trap already bit 3b.)
  restoreFetch();
  pass('A space can name its arm of the business, or say nothing — and nothing is not "Retail"');

  // --- 4. withdrawn is terminal, and drafts get no nonsense --------------
  {
    const { container } = mount(React.createElement(SpaceShell, { spaceId: 'spc_1', onBack: () => {}, onShare: () => {}, initialTab: 'catalog' }));
    await flush();
    const t = text(container);
    assert.ok(t.includes('WITHDRAWN'), 'the withdrawn offer is labelled as it is');
    assert.ok(t.includes('a new offer re-lists it'), 'and explains the honest path back');
    assert.ok(!btn('Resume — live again'), 'no relist button is offered on a terminal row');
    // The draft card: publish only, plus withdraw — never "pause" a draft.
    const draftMenu = byAria('Actions for lst_2 cake');
    click(draftMenu);
    await flush();
    assert.ok(!btn('Pause — hidden from buyers'), 'a draft is not offered a pause');
    assert.ok(btn('Withdraw this offer'), 'a draft can still be withdrawn');
    click(draftMenu);
  }
  pass('Transitions offered match the ones the server will accept');

  // --- 5. sharing tells the truth about what exists -----------------------
  handler = async (url, init) => {
    const method = init?.method ?? 'GET';
    if (url.includes('/api/spaces/spc_1/operating')) return ok({ fields: [], maintenance: null, editorial: [], pipeline: [] });
    if (url.endsWith('/api/spaces/spc_1') && method === 'GET') return ok({ space: spaceWith({ visibility: 'private' }) });
    return { ok: false, status: 404, text: async () => JSON.stringify({}) };
  };
  {
    const { container } = mount(React.createElement(SpaceShell, { spaceId: 'spc_1', onBack: () => {}, onShare: () => {} }));
    await flush();
    click(byAria('Copy the link that reaches this space'));
    await flush();
    const t = text(container);
    assert.ok(t.includes('no public page to link to'), 'a private space is not given a fake share link');
    assert.ok(t.includes('Set it to Public first'), 'and is told the one thing that changes it');
    assert.ok(!t.includes('copied!'), 'and no toast claims a copy that did not happen');
  }
  pass('Share is honest: no copied-link claim for a space that is not public');

  // --- 6. a public space links to a page that exists ----------------------
  // Shared with 6b: the same row, read with and without a declared origin.
  const publicSpace = {
    id: 'spc_7', ownerId: 'u1', vendorId: 'v7', name: 'Jj Cakes', type: 'business', goal: 'First 20 customers',
    targetValueKes: 0, image: null, slug: 'jj-cakes', visibility: 'public', status: 'active', capabilities: [],
    offers: [], recentActivities: [], recentConversations: [], featured: [], followers: 2, broadcastsLive: 0,
    metrics: { revenueKes: 0, customerCount: 0, activeOrdersCount: 0, totalOrdersCount: 0, offersCount: 0 },
    createdAt: '', updatedAt: ''
  };
  {
    global.fetch = async (input) => {
      const url = String(input?.url ?? input ?? '');
      const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
      if (url.includes('/audience')) return ok({ slug: 'jj-cakes', followers: 2, followerList: [], iAmFollowing: false, broadcasts: [], pastBroadcasts: 0, templates: [], insights: null, canManage: true, followable: false });
      if (url.includes('/api/spaces/spc_7')) return ok({ space: publicSpace });
      return { ok: false, status: 404, text: async () => JSON.stringify({}) };
    };
    const { container } = mount(React.createElement(SpaceShell, { spaceId: 'spc_7', onBack: () => {}, onShare: () => {} }));
    // Two reads now back the shell (audience + the public-face read), so the
    // first paint is one tick later than it used to be.
    await flush(220);
    const share = Array.from(container.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') ?? '').includes('Copy the link'));
    act(() => share.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
    await flush();
    const t = text(container);
    // The canonical page URL, not an in-app hash route: a hash link previews as
    // nothing in WhatsApp and cannot be printed on a sticker.
    assert.ok(t.includes('/s/jj-cakes'), 'the copied link is the page that resolves, by slug');
    assert.ok(!t.includes('#space/jj-cakes'), 'and never the in-app route, which is not a shareable address');
    assert.ok(!t.includes('copied!'), 'no triumphant toast about a clipboard the test browser denies');
    // The panel is the same address, so a vendor can see what they are sharing.
    assert.ok(t.includes('Public page'), 'the face panel is mounted in the shell');
  }
  pass('A public space shares a link that actually opens something');

  // --- 6b. the shell shows the server-declared canonical link, not its own host
  {
    global.fetch = async (input) => {
      const url = String(input?.url ?? input ?? '');
      const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
      if (url.includes('/audience')) return ok({ slug: 'jj-cakes', followers: 2, followerList: [], iAmFollowing: false, broadcasts: [], pastBroadcasts: 0, templates: [], insights: null, canManage: true, followable: false });
      if (url.includes('/public-page')) return ok({ view: null, path: '/s/jj-cakes', originDeclared: true, open: true, reason: null, reports: { count: 0, latest: null, note: 'No reports have been filed against this space.' }, note: 'mirror' });
      if (url.includes('/api/spaces/spc_7')) return ok({ space: publicSpace });
      return { ok: false, status: 404, text: async () => JSON.stringify({}) };
    };
    const { container } = mount(React.createElement(SpaceShell, { spaceId: 'spc_7', onBack: () => {}, onShare: () => {} }));
    // Two reads now back the shell (audience + the public-face read), so the
    // first paint is one tick later than it used to be.
    await flush(220);
    const t = text(container);
    assert.ok(t.includes('Public page'), 'the face panel is mounted in the shell');
    // No pageUrl in this read, so the address is the origin in use plus the
    // server's path — and never a brand domain nobody declared.
    assert.ok(t.includes('/s/jj-cakes'), 'the panel shows the same address the shell copies');
    assert.ok(!/brief\.app/.test(t), 'no invented hostname when none is configured');
  }
  pass('The panel and the copy button agree on the address');

  // --- 7. a settled figure never dresses itself as today's net profit ------
  {
    global.fetch = async (input, init) => {
      const url = String(input?.url ?? input ?? '');
      const method = init?.method ?? 'GET';
      const okp = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
      if (url.includes('/audience')) return okp({ slug: 'jj', followers: 0, followerList: [], iAmFollowing: false, broadcasts: [], pastBroadcasts: 0, templates: [], insights: null, canManage: true, followable: false });
      if (url.includes('/api/spaces/spc_1') && method === 'GET') {
        return okp({ space: spaceWith({ metrics: { revenueKes: 84200, customerCount: 23, activeOrdersCount: 7, totalOrdersCount: 9, offersCount: 2 } }) });
      }
      return { ok: false, status: 404, text: async () => JSON.stringify({}) };
    };
    const { container } = mount(React.createElement(SpaceShell, { spaceId: 'spc_1', onBack: () => {}, onShare: () => {}, initialTab: 'pipeline' }));
    await flush();
    const t = text(container);
    assert.ok(t.includes('Pipeline') || t.includes('Inbox'), 'the pipeline surface rendered at all');
    assert.ok(!/today's net take-home/i.test(t), 'no all-time figure is labelled as today');
    assert.ok(!/\bnet take-home\b/i.test(t), 'and nothing is called net while expenses are untouched');
    // The label names the BASIS now ("Marked settled"), because "Settled through
    // Brief" promised a ledger row and the figure is orders whose own status says
    // paid or settled. The assertion moved with the copy, not after it.
    assert.ok(/Marked settled/i.test(t), 'the label states what was counted, not a nicer word for it');
    assert.ok(!/Settled through Brief/i.test(t), 'and the ledger promise is gone from this surface');
    assert.ok(t.includes('84,200'), 'with the real figure');
    assert.ok(/Expenses are not subtracted here/i.test(t), 'and it says what it excludes');
    assert.ok(/Not a ledger feed/i.test(t), 'and it says so plainly, without a nicer word');
  }
  pass('A settled total is labelled as a settled total, not as profit');

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
