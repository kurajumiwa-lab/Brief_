// ---------------------------------------------------------------------------
// MEDIA SUITE — the editorial surfaces take a real FILE now, not only a link.
//
// The studio used to be a URL box: every photo in Brief was somebody else's
// asset on somebody else's server. These checks hold the new path down:
//
//   * choosing a file posts it as multipart through the ONE api client
//   * the URL that comes back is the one the story saves, proxied correctly
//   * a server refusal is shown to the person word for word
//   * the link route still exists, but you have to ask for it
//   * the "local disk" caveat is stated rather than discovered
// ---------------------------------------------------------------------------
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');

// FormData, File and Blob must come from ONE realm. Node's global FormData
// rejects jsdom's File ("parameter 2 is not of type 'Blob'") because they are
// different classes -- and in a browser there is only ever one realm, so using
// jsdom's for all three is what the app actually gets.
global.FormData = dom.window.FormData;
global.Blob = dom.window.Blob;
global.File = dom.window.File;

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);
const TEXT = Buffer.from('this is not an image at all');

// What the upload endpoint answers, and what it received.
let uploadCalls = [];
let uploadReply = {
  status: 201,
  body: { upload: { id: 'upl_1', url: '/api/media/file/upl_1', mimeType: 'image/png', bytes: 68, sha256: 'a'.repeat(64), originalName: 'photo.png', alt: null, createdAt: '2026-08-28T00:00:00Z' }, duplicate: false }
};

const send = (body, status = 200) => ({
  ok: status < 400,
  status,
  text: async () => JSON.stringify(body),
  json: async () => body
});

global.fetch = async (url, init) => {
  const path = String(url);
  if (path.includes('/api/media/status')) {
    return send({
      media: { configured: false, count: 0, providers: {}, reason: 'no provider' },
      uploads: {
        enabled: true, kind: 'local_disk', persisted: false, dir: '/tmp/uploads',
        writable: true, dirError: null, maxBytes: 8388608,
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        count: 0, missingBytes: 0, reason: 'local disk'
      }
    });
  }
  if (path.includes('/api/media/upload')) {
    const form = init?.body;
    const file = form && typeof form.get === 'function' ? form.get('file') : null;
    uploadCalls.push({
      path,
      method: init?.method,
      hasFile: Boolean(file),
      name: file?.name ?? null,
      // The client must NOT set content-type itself: the browser owns the
      // multipart boundary.
      contentType: (init?.headers && init.headers['content-type']) ?? null,
      auth: (init?.headers && init.headers.authorization) ?? null
    });
    if (uploadReply.status >= 400) return send(uploadReply.body, uploadReply.status);
    return send(uploadReply.body, uploadReply.status);
  }
  return { ok: false, status: 404, text: async () => '{}', json: async () => ({}) };
};

let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); } };
const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
const btn = (t) => Array.from(document.querySelectorAll('button')).find((b) => text(b) === t || text(b).startsWith(t));

async function withRoot(render, run) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(render()); });
  try { await run(); } finally {
    await act(async () => { root.unmount(); });
    host.remove();
  }
}

/** jsdom will not let a test type into a file input, so hand it a FileList. */
function chooseFile(input, bytes, name, type) {
  const file = new dom.window.File([bytes], name, { type });
  const list = { 0: file, length: 1, item: (i) => (i === 0 ? file : null), [Symbol.iterator]: function* () { yield file; } };
  Object.defineProperty(input, 'files', { value: list, configurable: true });
  // React listens for 'change' on a file input, and 'input' elsewhere: send
  // both so the suite is not coupled to that detail.
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
}

async function main() {
  const ImageField = require('./src/components/ImageField.tsx').default;

  console.log('\n=== IMAGE FIELD: upload is the default, the link is behind a door ===');
  let value = null;
  // A stateful host, not a static element: the field is controlled, so the
  // upload has to flow back out through onChange and re-render for the preview
  // to appear. A plain render would assert against a prop that never moves.
  const Harness = () => {
    const [v, setV] = React.useState(null);
    value = v;
    return React.createElement(ImageField, {
      label: 'Lead photo',
      value: v,
      onChange: (url) => setV(url)
    });
  };
  await withRoot(
    () => React.createElement(Harness),
    async () => {
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); });

      check('it offers a file picker, not a URL box', Boolean(btn('Choose photo')));
      const urlInputs = Array.from(document.querySelectorAll('input[placeholder]'));
      check('no link field is shown until it is asked for',
        !urlInputs.some((i) => /photo\.jpg/.test(i.placeholder || '')),
        urlInputs.map((i) => i.placeholder).join(' | '));
      check('the local-disk caveat is stated', /survive a restart, not a redeploy/.test(document.body.textContent));

      await act(async () => { const b = btn('Use a link instead'); if (b) b.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
      check('the link route is still reachable when asked for',
        Array.from(document.querySelectorAll('input[placeholder]')).some((i) => /photo\.jpg/.test(i.placeholder || '')));

      // ---- upload a real file -------------------------------------------
      const fileInput = document.querySelector('input[type="file"]');
      check('the file input only accepts images', fileInput?.getAttribute('accept') === 'image/jpeg,image/png,image/webp,image/gif');
      await act(async () => { chooseFile(fileInput, PNG, 'market.png', 'image/png'); });
      await act(async () => { await new Promise((r) => setTimeout(r, 30)); });

      check('the file went to the upload endpoint', uploadCalls.length === 1 && /\/api\/media\/upload$/.test(uploadCalls[0].path), JSON.stringify(uploadCalls[0]));
      check('it was sent as multipart with the file attached', uploadCalls[0]?.hasFile === true && uploadCalls[0]?.name === 'market.png');
      check('the client did NOT set its own content-type', !uploadCalls[0]?.contentType, String(uploadCalls[0]?.contentType));
      check('the saved value is the URL the server returned', value === '/ingest/api/media/file/upl_1', String(value));
      check('the saved image is rendered', Boolean(document.querySelector('img[src="/ingest/api/media/file/upl_1"]')));
      check('replace and remove are offered once a photo is set', Boolean(btn('Replace')) && Boolean(btn('Remove')));
    }
  );

  console.log('\n=== IMAGE FIELD: a refusal is shown the way the server said it ===');
  uploadCalls = [];
  uploadReply = { status: 415, body: { error: 'only JPEG, PNG, WebP and GIF images can be uploaded', code: 'unsupported_image_type' } };
  await withRoot(
    () => React.createElement(ImageField, { label: 'Lead photo', value: null, onChange: () => {} }),
    async () => {
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
      const fileInput = document.querySelector('input[type="file"]');
      await act(async () => { chooseFile(fileInput, TEXT, 'notes.png', 'image/png'); });
      await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
      check('the server\'s reason is shown word for word',
        document.body.textContent.includes('only JPEG, PNG, WebP and GIF images can be uploaded'),
        text(document.body).slice(0, 200));
      check('nothing was saved when the server refused', !document.querySelector('img'));
      check('the picker is still there to try again', Boolean(btn('Choose photo')));
    }
  );

  console.log('\n=== STORY STUDIO: the studio uploads too ===');
  uploadCalls = [];
  uploadReply = {
    status: 201,
    body: { upload: { id: 'upl_2', url: '/api/media/file/upl_2', mimeType: 'image/png', bytes: 68, sha256: 'b'.repeat(64), originalName: 'hero.png', alt: null, createdAt: '2026-08-28T00:00:00Z' }, duplicate: false }
  };
  const StoryEditor = require('./src/components/StoryEditor.tsx').default;
  // The studio saves through the real editorial route; 404 is fine here
  // because this suite only cares about the photo path.
  await withRoot(
    () => React.createElement(StoryEditor, { article: null, onClose: () => {}, onSaved: () => {} }),
    async () => {
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
      const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
      check('the studio offers an upload for the lead photo', inputs.length >= 1, `${inputs.length} file inputs`);
      check('the studio offers an upload for the gallery', Boolean(btn('Choose photos')));
      await act(async () => { chooseFile(inputs[0], PNG, 'hero.png', 'image/png'); });
      await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
      check('the studio uploaded through the api client', uploadCalls.length === 1, JSON.stringify(uploadCalls));
      check('the lead photo is the uploaded file', Boolean(document.querySelector('img[src="/ingest/api/media/file/upl_2"]')));
    }
  );

  console.log(`\npass ${pass} fail ${fail}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
