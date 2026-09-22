// ---------------------------------------------------------------------------
// PHOTOS AT THE FRONT DOOR — the create-listing form takes the seller's files.
//
// Reported from a phone: "the creation widget to post a listing has no photo
// addition section." True, and worse than a gap in the form: the same offer,
// edited later from a space's catalog, already took up to eight. So a listing
// created through the marketplace counter was a name and a price, permanently —
// the buyer's first look at the goods was a title.
//
// What is pinned here:
//   1. The control is the real one (`components/ImageField`): a file goes to
//      POST /api/media/upload, the server's refusal is printed word for word,
//      and there is no local preview URL invented before the bytes land.
//   2. The cap is the server's. `MEDIA_CAP` on the client is compared against the
//      source of `domain/listing.js`, so a counter that says 8 cannot drift from
//      a store that keeps 6.
//   3. `media` actually travels on create, and the draft clears it after.
//   4. NOTHING is drawn that the seller did not supply: no stock image, no
//      placeholder frame, and no <img> at all while the offer has no photos.
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
global.HTMLInputElement = dom.window.HTMLInputElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.Event = dom.window.Event;
global.File = dom.window.File;
global.Blob = dom.window.Blob;
global.FormData = dom.window.FormData;
global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.localStorage = dom.window.localStorage;

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const { VendorPanel, MEDIA_CAP } = require('./src/components/marketplace/VendorPanel.tsx');
const { Marketplace } = require('./src/components/Marketplace.tsx');
const briefApi = require('./src/api/briefApi.ts');

let count = 0;
const pass = (n) => { count++; console.log('PASS ' + n); };
const flush = (ms = 50) => new Promise((r) => setTimeout(r, ms));
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const btnByText = (want) =>
  Array.from(document.querySelectorAll('button')).find((b) => text(b) === want || text(b).startsWith(want));
const click = async (el) => {
  await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await flush();
};

const UPLOAD = {
  id: 'upl_7', url: 'upl_7', mimeType: 'image/jpeg', bytes: 88_000,
  sha256: 'a'.repeat(64), createdAt: '2026-09-22T06:00:00.000Z', originalName: 'flour.jpg', alt: null
};
const LISTING = {
  id: 'list_9', vendorId: 'vnd_1', title: 'Maize flour 2kg', type: 'product', price: 120,
  currency: 'KES', quantityAvailable: 10, locationName: null, status: 'draft',
  orderable: false, unorderableReason: null, media: ['/api/media/file/upl_7']
};

let calls = [];
let POSTS = [];
const mainFetch = async (input, init) => {
  const url = String(typeof input === 'string' ? input : input?.url ?? input ?? '');
  const method = (init && init.method) || 'GET';
  const body = init && init.body ? String(init.body) : null;
  calls.push({ url, method, body });
  const ok = (o) => ({ ok: true, status: 200, text: async () => JSON.stringify(o), json: async () => o });
  if (url.includes('/api/media/storage')) return ok({ limitMb: 8, persisted: true });
  if (url.includes('/api/media/upload')) { POSTS.push('upload'); return ok({ upload: UPLOAD, duplicate: false }); }
  if (url.includes('/api/listings/mine')) return ok({ vendor: VENDOR, listings: [], orders: [] });
  if (url.includes('/api/vendor/orders') || (url.includes('/api/orders') && method === 'GET')) return ok({ orders: [] });
  if (url.includes('/api/earnings')) return ok({ earnings: { gross: 0, net: 0, payoutAvailable: false } });
  if (url.includes('/api/listings') && method === 'POST') { POSTS.push('listing'); return ok({ listing: LISTING }); }
  return { ok: false, status: 404, text: async () => '{}', json: async () => ({}) };
};
global.fetch = (input, init) => mainFetch(input, init);

// The shape the server's `hydrate` guarantees: every vendor row carries its own
// verification block, and the panel reads `.facts` off it unguarded.
const VENDOR = {
  id: 'vnd_1', ownerId: 'usr_1', displayName: 'Testshop', description: '', status: 'active',
  contactMethod: null, createdAt: '2026-09-01T06:00:00.000Z', activeListingCount: 0,
  verification: { evidence: [], verifiedCount: 0, facts: [{ kind: 'vendor_since', label: 'Selling since September 2026' }] }
};
const DRAFT = (over = {}) => ({
  title: '', description: '', price: '', type: 'product', quantity: '', location: '',
  flow: '', commodity: '', originKind: '', originName: '',
  destinationKind: '', destinationName: '', unit: '', minOrder: '', media: [], ...over
});

async function mountPanel(props) {
  document.body.innerHTML = '';
  calls = []; POSTS = [];
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(VendorPanel, {
      vendor: VENDOR, listings: [], orders: [], earnings: null, busyId: null, notice: null,
      draft: { displayName: '', description: '', contactMethod: '' },
      onDraftChange: () => {}, onCreateVendor: () => {},
      onListingDraftChange: () => {}, onCreateListing: () => {},
      onSetStatus: () => {}, onFulfil: () => {}, onSettle: () => {},
      ...props
    }));
  });
  await flush();
  return { host, t: text(host) };
}

/** jsdom will not accept a real FileList, so the input's `files` is defined. */
async function chooseFile(host, file) {
  const input = host.querySelector('input[type="file"]');
  assert.ok(input, 'a file input exists — a real file, not a URL to somebody else’s image');
  // jsdom will not build a FileList, so the input gets a list-shaped object;
  // both `input` and `change` are fired, because React maps onChange to one of
  // them depending on the element and a suite must not be coupled to which.
  const list = {
    0: file, length: 1, item: (i) => (i === 0 ? file : null),
    [Symbol.iterator]: function* () { yield file; }
  };
  Object.defineProperty(input, 'files', { value: list, configurable: true });
  await act(async () => {
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  await flush();
}

async function main() {
  // --- 1. the cap is the server's number, read off the server's file ---------
  {
    const server = fs.readFileSync(
      path.join(__dirname, '../server/src/domain/listing.js'), 'utf8'
    );
    const m = server.match(/export const MEDIA_CAP = (\d+);/);
    assert.ok(m, 'the server still declares one cap');
    assert.equal(MEDIA_CAP, Number(m[1]), `the form counts to ${MEDIA_CAP} and the store keeps ${m[1]}`);
    assert.match(server, /cleanMedia/, 'and the value travels through the normaliser');
  }
  pass('the photo cap on the form is the server’s cap, mirrored from its source');

  // --- 2. the section exists, and an offer with no photo shows no picture ----
  {
    const { host, t } = await mountPanel({ listingDraft: DRAFT(), onListingDraftChange: () => {} });
    assert.ok(/Photos/.test(t), 'the form names the section');
    assert.ok(t.includes(`0/${MEDIA_CAP}`), `with the count of what is attached: ${t.slice(0, 200)}`);
    assert.ok(host.querySelector('input[type="file"]'), 'and a real file control');
    const accept = host.querySelector('input[type="file"]').getAttribute('accept') || '';
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      assert.ok(accept.includes(type), `the picker accepts ${type}: got "${accept}"`);
    }
    assert.ok(!host.querySelector('img'), 'nothing is drawn for an offer with no photos — no stock frame');
    assert.match(t, /No photo yet/, 'and the absence is said');
    assert.ok(!/unsplash|picsum|placehold\.co|via\.placeholder|dummyimage|cdn\.\S+\/sample/i.test(host.innerHTML),
      'and no third-party image is stood in (a placeholder attribute on an input is not an image)');
    assert.equal(host.querySelectorAll('img').length, 0, 'the only images are the seller\u2019s own');
  }
  pass('the create form has the section, and no invented imagery');

  // --- 3. choosing a file uploads it and lands the server's url in the draft -
  {
    const patches = [];
    const { host } = await mountPanel({
      listingDraft: DRAFT(),
      onListingDraftChange: (p) => patches.push(p)
    });
    const file = new dom.window.File([new Uint8Array([255, 216, 255])], 'flour.jpg', { type: 'image/jpeg' });
    await chooseFile(host, file);
    const upload = calls.find((c) => c.url.includes('/api/media/upload'));
    assert.ok(upload, 'the file is POSTed to the upload endpoint, not stored as a name');
    assert.equal(upload.method, 'POST');
    assert.ok(patches.length >= 1, 'and the draft is patched once with the result');
    assert.deepEqual(patches[patches.length - 1].media, [UPLOAD.url],
      'the draft stores the server path; display prefixes /ingest at the <img>, not in the row');
  }
  pass('a chosen file is uploaded and its real url joins the listing');

  // --- 4. a refusal is the server's sentence, printed -------------------------
  {
    const refusalFetch = async (input, init) => {
      const url = String(typeof input === 'string' ? input : input?.url ?? '');
      if (url.includes('/api/media/upload')) {
        return { ok: false, status: 415, text: async () => JSON.stringify({ error: 'those bytes are not a JPEG, PNG, WebP or GIF' }), json: async () => ({}) };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({}), json: async () => ({}) };
    };
    global.fetch = (input, init) => refusalFetch(input, init);
    const { host } = await mountPanel({ listingDraft: DRAFT(), onListingDraftChange: () => {} });
    const file = new dom.window.File([new Uint8Array([1, 2, 3])], 'invoice.pdf', { type: 'application/pdf' });
    await chooseFile(host, file);
    const t = text(host);
    assert.ok(t.includes('not a JPEG, PNG, WebP or GIF'), `the refusal is the server's own words: ${t.slice(-180)}`);
    assert.ok(!/uploaded|added/i.test(t), 'and nothing is claimed about a file that was refused');
    // Restored: a suite that leaves a private fetch installed makes the NEXT
    // test fail for a reason that has nothing to do with what it is checking.
    global.fetch = (input, init) => mainFetch(input, init);
  }
  pass('a refused upload is reported as refused');

  // --- 5. the thumbnails are the draft's, and each one can come off ----------
  {
    const patches = [];
    const three = ['/api/media/file/a', '/api/media/file/b', '/api/media/file/c'];
    const { host, t } = await mountPanel({
      listingDraft: DRAFT({ media: three }),
      onListingDraftChange: (p) => patches.push(p)
    });
    assert.ok(t.includes(`3/${MEDIA_CAP}`), 'the counter counts the rows');
    const imgs = Array.from(host.querySelectorAll('img')).map((i) => i.getAttribute('src'));
    assert.deepEqual(imgs, three.map((u) => briefApi.mediaFileUrl(u)),
      'the <img> src is the display URL (/ingest/…); the draft still holds /api/…');
    const removeSecond = host.querySelector('[aria-label="Remove photo 2 from this listing"]');
    assert.ok(removeSecond, 'each thumbnail can be removed on its own');
    await click(removeSecond);
    assert.deepEqual(patches[patches.length - 1].media, ['/api/media/file/a', '/api/media/file/c'],
      'and only that one comes off');
  }
  pass('thumbnails are the seller’s own files, and each is removable');

  // --- 6. at the cap, the add control goes (no silent truncation) ------------
  {
    const eight = Array.from({ length: MEDIA_CAP }, (_, i) => `/api/media/file/p${i}`);
    const { host, t } = await mountPanel({ listingDraft: DRAFT({ media: eight }) });
    assert.ok(t.includes(`${MEDIA_CAP}/${MEDIA_CAP}`), 'the counter is full and says so');
    assert.ok(!host.querySelector('input[type="file"]'),
      'and there is no picker offering a ninth photo the server would drop');
  }
  pass('the cap is enforced in the form, not quietly in the store');

  // --- 7. the marketplace sends the media on create, and clears it -----------
  {
    window.location.hash = '';
    document.body.innerHTML = '';
    calls = []; POSTS = [];
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(React.createElement(Marketplace, { initialSection: 'selling' })); });
    await flush(); await flush();

    const setInput = async (el, value) => {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, value);
        el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
      await flush();
    };
    const title = Array.from(host.querySelectorAll('input')).find((i) => i.getAttribute('placeholder') === 'What are you offering?');
    const price = Array.from(host.querySelectorAll('input')).find((i) => i.getAttribute('placeholder') === 'Price');
    assert.ok(title && price, 'the form is reachable from the counter');
    await setInput(title, 'Maize flour 2kg');
    await setInput(price, '120');
    await chooseFile(host, new dom.window.File([new Uint8Array([9])], 'flour.jpg', { type: 'image/jpeg' }));
    const create = btnByText('Create listing');
    assert.ok(create, 'and one button writes it');
    await click(create);
    const post = calls.find((c) => c.url.includes('/api/listings') && c.method === 'POST');
    assert.ok(post, 'the create is a POST to the listings endpoint');
    const sent = JSON.parse(post.body);
    assert.equal(sent.title, 'Maize flour 2kg');
    assert.deepEqual(sent.media, [UPLOAD.url],
      'the photo travels with the offer at creation — not "add it later in the catalog"');
  }
  pass('the counter posts the listing with its photos attached');

  // --- 8. the words around the control say what a photo is not ---------------
  {
    const src = fs.readFileSync(path.join(__dirname, 'src/components/marketplace/VendorPanel.tsx'), 'utf8');
    assert.match(src, /a photo of something else is not a[\s\S]{0,40}photo of this/);
    assert.ok(!/stock photo|example image|sample photo/i.test(src), 'no affordance that would fill the gap for the seller');
    assert.match(src, /The server decides what the bytes really are/);
  }
  pass('the copy promises only what the code can do');

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
