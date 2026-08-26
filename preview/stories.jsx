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

global.fetch = async (url, init) => {
  const path = String(url);
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
      check('theme applied (noir surface)', Boolean(document.querySelector('[style*="rgb(17, 17, 17)"]')));
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
    const gallery = inputs.find((i) => i.placeholder?.includes('/photo.jpg') && i.placeholder?.includes('…') === false && i.closest('section')?.textContent.includes('Gallery'));
    await act(async () => {
      if (headline) setVal(headline, 'Studio story');
      if (bodyBox) setVal(bodyBox, 'Written in the studio.');
    });
    check('publish enables once written', btn('Publish')?.disabled === false);

    if (gallery) {
      await act(async () => { setVal(gallery, 'https://cdn.test/gallery.jpg'); });
      const add = Array.from(document.querySelectorAll('button[aria-label="Add gallery photo"]'))[0];
      await act(async () => { if (add) add.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
      check('gallery photo added and shown', Boolean(document.querySelector('img[src*="gallery.jpg"]')));
    }

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
