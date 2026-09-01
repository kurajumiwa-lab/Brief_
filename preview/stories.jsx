// ---------------------------------------------------------------------------
// STORIES SUITE — the editorial presentation layer, end to end.
//
//   * the READER renders the designed story (theme/layout/accent), the photo
//     gallery, and the like bar with a working like toggle
//   * the FULL-SCREEN STUDIO opens from the desk, offers every theme + layout
//     preset, freehand accent/overlay, gallery management, a live preview,
//     and saves through the real editorial route
//   * the desk is de-branded: "Editorial Studio" + "stories", no Tea copy
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

const ARTICLE = {
  id: 'tea_1', slug: 'designed-story', title: 'The designed story', dek: 'A dek line.',
  body: 'The body of the story.', category: 'guide', location: 'Nairobi',
  heroImage: 'https://cdn.test/hero.jpg', images: ['https://cdn.test/g1.jpg', 'https://cdn.test/g2.jpg'],
  readingTime: 2, author: 'Editor', publishedAt: '2026-08-26T00:00:00Z',
  design: { theme: 'noir', layout: 'full-bleed', accent: null, overlay: 0.7 },
  likeCount: 4, likedByMe: false
};

let likeCalls = [];
let createCalls = [];
const send = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body), json: async () => body });

// FormData/File/Blob must come from one realm (jsdom's) or Node's FormData
// rejects a jsdom File. See preview/media.jsx.
global.FormData = dom.window.FormData;
global.Blob = dom.window.Blob;
global.File = dom.window.File;

let uploadCalls = [];
global.fetch = async (url, init) => {
  const path = String(url);
  if (path.includes('/api/media/status')) {
    return send({ media: { configured: false, count: 0, providers: {}, reason: 'no provider' },
      uploads: { enabled: true, kind: 'local_disk', persisted: false, dir: '/tmp/uploads', writable: true,
        dirError: null, maxBytes: 8388608, allowedTypes: ['image/jpeg','image/png','image/webp','image/gif'],
        count: 0, missingBytes: 0, reason: 'local disk' } });
  }
  if (path.includes('/api/media/upload')) {
    uploadCalls.push({ path, method: init?.method, name: init?.body?.get('file')?.name ?? null });
    return send({ upload: { id: 'upl_story', url: '/api/media/file/upl_story', mimeType: 'image/png',
      bytes: 68, sha256: 'c'.repeat(64), originalName: 'gallery.png', alt: null, createdAt: '2026-08-28T00:00:00Z' },
      duplicate: false }, 201);
  }
  if (path.includes('/api/tea/designed-story')) return send({ article: ARTICLE });
  if (path.includes('/like')) {
    likeCalls.push({ method: init?.method, path });
    return send({ liked: true, likeCount: 5 });
  }
  if (path.includes('/api/admin/tea') && init?.method === 'POST') {
    createCalls.push(JSON.parse(init.body));
    return send({ article: { id: 'tea_new', slug: 'new-story', ...JSON.parse(init.body) } }, 201);
  }
  if (path.includes('/api/admin/tea')) {
    return send({ articles: [ARTICLE] });
  }
  return { ok: false, status: 404, text: async () => '{}', json: async () => ({}) };
};

let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); } };
const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
// React controlled inputs ignore a raw .value assignment; use the native
// setter so the value tracker sees a real change before the input event.
const setVal = (el, v) => {
  const proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement : dom.window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
};
const body = () => text(document.body);
const btn = (t) => Array.from(document.querySelectorAll('button')).find((b) => text(b) === t || text(b).startsWith(t));

/** jsdom will not let a test type into a file input, so hand it a FileList. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
function chooseFile(input, name = 'gallery.png') {
  const file = new dom.window.File([PNG], name, { type: 'image/png' });
  const list = { 0: file, length: 1, item: (i) => (i === 0 ? file : null), [Symbol.iterator]: function* () { yield file; } };
  Object.defineProperty(input, 'files', { value: list, configurable: true });
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
}

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

async function main() {
  // ---------------- THE READER ----------------
  console.log('\n=== READER: designed story + gallery + likes ===');
  await withRoot(
    () => React.createElement(require('./src/components/TeaReader.tsx').default, { slug: 'designed-story', onClose: () => {} }),
    async () => {
      await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
      check('story renders', body().includes('The designed story'));
      check('hero photo rendered', Boolean(document.querySelector('img[src*="hero.jpg"]')));
      // Noir is the NIGHT EDITION: light ink on near-black charcoal (#08090B).
      check('theme applied (noir surface)', Boolean(document.querySelector('[style*="rgb(8, 9, 11)"]')));
      check('gallery shows every editor photo',
        document.querySelectorAll('img[src*="g1.jpg"], img[src*="g2.jpg"]').length === 2);
      check('like count shown', body().includes('4 likes'));
      check('like button present', Boolean(btn('Like')));

      await act(async () => { const b = btn('Like'); if (b) b.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
      check('like posted to the real endpoint', likeCalls.length === 1 && likeCalls[0].method === 'POST');
      check('count updates from the server answer', body().includes('5 likes'));
      check('button reflects the liked state', Boolean(btn('Liked')));
    }
  );

  // ---------------- THE DESK + FULL-SCREEN STUDIO ----------------
  console.log('\n=== EDITORIAL STUDIO: de-branded desk + full-screen editor ===');
  const TeaDesk = require('./src/components/TeaDesk.tsx').default;
  await withRoot(() => React.createElement(TeaDesk), async () => {
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });

    check('desk is de-branded (Editorial Studio)', body().includes('Editorial Studio'));
    check('no Tea copy on the desk', !/Tea Desk|Today's Tea/.test(body()));
    check('library row shows the design theme', body().includes('Noir'));
    check('library row shows the like count', body().includes('♥ 4'));
    check('New story affordance present', Boolean(btn('New story')));

    // Open the studio — it must be a FULL-SCREEN presentation.
    await act(async () => { const b = btn('New story'); if (b) b.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    const overlay = document.querySelector('[aria-modal="true"]');
    check('studio opens as a modal full-screen', Boolean(overlay) && overlay.className.includes('fixed inset-0'));

    // Presets: all four themes + all four layouts.
    for (const t of ['Classic', 'Noir', 'Poster', 'Gazette']) {
      check(`theme preset ${t} offered`, body().includes(t));
    }
    for (const l of ['Centered', 'Left rail', 'Full-bleed', 'Split']) {
      check(`layout preset ${l} offered`, body().includes(l));
    }
    check('freehand accent control present', Boolean(document.querySelector('input[type="color"]')));
    check('freehand overlay control present', Boolean(document.querySelector('input[type="range"]')));
    check('live preview renders the draft', body().includes('Live preview'));
    check('publish disabled until written', btn('Publish')?.disabled === true);

    // Write the story, add a gallery photo, and save.
    const inputs = Array.from(document.querySelectorAll('input[placeholder], textarea[placeholder]'));
    const headline = inputs.find((i) => i.placeholder === 'Headline');
    const bodyBox = Array.from(document.querySelectorAll('textarea')).find((t) => /Body/.test(t.placeholder || ''));
    await act(async () => {
      if (headline) setVal(headline, 'Studio story');
      if (bodyBox) setVal(bodyBox, 'Written in the studio.');
    });
    check('publish enables once written', btn('Publish')?.disabled === false);

    // Gallery photos are real files now, not pasted links. Upload one and it
    // must appear; the link route still exists behind "Use a link instead".
    const galleryUpload = Array.from(document.querySelectorAll('input[type="file"]'))
      .find((i) => (i.getAttribute('aria-label') || '').includes('Gallery'));
    check('the gallery takes a file upload', Boolean(galleryUpload));
    await act(async () => { if (galleryUpload) chooseFile(galleryUpload, 'gallery.png'); });
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    check('the photo was uploaded', uploadCalls.length === 1 && uploadCalls[0].name === 'gallery.png', JSON.stringify(uploadCalls));
    check('gallery photo added and shown', Boolean(document.querySelector('img[src="/ingest/api/media/file/upl_story"]')));

    const linkToggle = btn('Use a link instead');
    check('the link route is offered, but not the default', Boolean(linkToggle));
    await act(async () => { if (linkToggle) linkToggle.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    const linkInput = Array.from(document.querySelectorAll('input[placeholder]'))
      .find((i) => /photo\.jpg/.test(i.placeholder || ''));
    check('a link can still be used when asked for', Boolean(linkInput));
    await act(async () => { if (linkInput) setVal(linkInput, 'https://cdn.test/linked.jpg'); });
    const useBtn = Array.from(document.querySelectorAll('button')).find((b) => text(b) === 'Use');
    await act(async () => { if (useBtn) useBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    check('a pasted link is added too', Boolean(document.querySelector('img[src="https://cdn.test/linked.jpg"]')));

    await act(async () => { const b = btn('Save'); if (b) b.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    check('save went through the real editorial route', createCalls.length === 1);
    check('saved design rides along', createCalls[0]?.design?.theme === 'classic' && createCalls[0]?.design?.layout === 'center');
    check('saved gallery rides along', Array.isArray(createCalls[0]?.images));
    check('studio closed after save', !document.querySelector('[aria-modal="true"]'));
  });

  console.log(`\npass ${pass} fail ${fail}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
