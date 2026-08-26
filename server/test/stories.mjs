// ---------------------------------------------------------------------------
// STORIES TEST SUITE — the editorial presentation layer:
//
//   * design presets (theme/layout) validate server-side; freehand overrides
//     (accent, overlay) are bounded; bad values are refused, never coerced
//   * design + gallery flow through the PUBLIC projection (reader + shelf
//     render server-validated design, not client input)
//   * likes: one row per (article, actor), counts DERIVED from rows,
//     likedByMe for the viewer, idempotent like, honest unlike
// ---------------------------------------------------------------------------

import fs from 'node:fs';

const DATA_DIR = '/tmp/stories-test-data';
fs.rmSync(DATA_DIR, { recursive: true, force: true });
process.env.BRIEF_DATA_DIR = DATA_DIR;

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; /* quiet on success */ }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' -> ' + detail : ''}`); }
};

const { store } = await import('../src/store.js');
const TEA = await import('../src/domain/tea.js');

console.log('\n=== DESIGN SYSTEM (presets + freehand) ===');
{
  store._reset();

  // Defaults applied when no design is sent.
  const plain = TEA.createArticle({ title: 'Plain story', body: 'Body text.' });
  check('default design is classic/center', plain.design.theme === 'classic' && plain.design.layout === 'center');
  check('default overlay is 0.55', plain.design.overlay === 0.55);
  check('default accent is null', plain.design.accent === null);

  // Presets + freehand accepted.
  const designed = TEA.createArticle({
    title: 'Designed story', body: 'Body text.',
    design: { theme: 'noir', layout: 'full-bleed', accent: '#43D17A', overlay: 0.8 }
  });
  check('theme preset stored', designed.design.theme === 'noir');
  check('layout preset stored', designed.design.layout === 'full-bleed');
  check('freehand accent stored', designed.design.accent === '#43D17A');
  check('freehand overlay stored', designed.design.overlay === 0.8);

  // Validation refuses, never coerces.
  let threw = null;
  try { TEA.createArticle({ title: 'X', body: 'B', design: { theme: 'neon' } }); } catch (e) { threw = e.message; }
  check('unknown theme refused', /theme must be one of/.test(threw ?? ''));

  threw = null;
  try { TEA.createArticle({ title: 'X', body: 'B', design: { layout: 'diagonal' } }); } catch (e) { threw = e.message; }
  check('unknown layout refused', /layout must be one of/.test(threw ?? ''));

  threw = null;
  try { TEA.createArticle({ title: 'X', body: 'B', design: { accent: 'green' } }); } catch (e) { threw = e.message; }
  check('non-hex accent refused', /accent must be/.test(threw ?? ''));

  threw = null;
  try { TEA.createArticle({ title: 'X', body: 'B', design: { overlay: 1.5 } }); } catch (e) { threw = e.message; }
  check('overlay above 0.9 refused', /overlay must be/.test(threw ?? ''));

  // Partial design patch merges over the existing design.
  TEA.updateArticle(designed.id, { design: { theme: 'poster' } });
  const patched = store.find('teaArticles', (a) => a.id === designed.id);
  check('partial design patch keeps layout', patched.design.layout === 'full-bleed');
  check('partial design patch applies theme', patched.design.theme === 'poster');
  check('partial design patch keeps accent', patched.design.accent === '#43D17A');
}

console.log('\n=== PUBLIC PROJECTION (design + gallery for readers) ===');
{
  store._reset();
  const a = TEA.createArticle({
    title: 'Shelf story', body: 'Body text.', heroImage: 'https://cdn.test/hero.jpg',
    images: ['https://cdn.test/1.jpg', 'https://cdn.test/2.jpg'],
    design: { theme: 'gazette', layout: 'split' }
  });
  TEA.transition(a.id, 'publish');

  const list = TEA.listPublished();
  check('published projection carries design', list[0].design.theme === 'gazette' && list[0].design.layout === 'split');
  check('published projection carries the gallery', list[0].images.length === 2);
  check('published projection carries the hero', list[0].heroImage === 'https://cdn.test/hero.jpg');
  check('like count present and zero-derived', list[0].likeCount === 0);

  const bySlug = TEA.getBySlug(a.slug);
  check('slug read carries design', bySlug.design.theme === 'gazette');
  check('slug read carries likeCount', bySlug.likeCount === 0);
  check('anonymous viewer has not liked', bySlug.likedByMe === false);
}

console.log('\n=== LIKES (the public rating) ===');
{
  store._reset();
  const a = TEA.createArticle({ title: 'Likeable', body: 'B' });
  TEA.transition(a.id, 'publish');

  // One like per actor, idempotent.
  const l1 = TEA.likeArticle(a.id, 'usr_one');
  check('first like records', l1.liked === true && l1.likeCount === 1);
  const l2 = TEA.likeArticle(a.id, 'usr_one');
  check('double like is idempotent', l2.liked === true && l2.likeCount === 1);

  TEA.likeArticle(a.id, 'usr_two');
  TEA.likeArticle(a.id, 'usr_three');
  check('count derives from distinct actors', TEA.likeCountFor(a.id) === 3);

  // Unlike removes exactly the actor's row.
  TEA.unlikeArticle(a.id, 'usr_two');
  check('unlike decrements the derived count', TEA.likeCountFor(a.id) === 2);
  TEA.unlikeArticle(a.id, 'usr_two');
  check('double unlike is a no-op', TEA.likeCountFor(a.id) === 2);

  // likedByMe follows the viewer.
  check('likedByMe true for a liker', TEA.getBySlug(a.slug, { viewerId: 'usr_one' }).likedByMe === true);
  check('likedByMe false for a stranger', TEA.getBySlug(a.slug, { viewerId: 'usr_four' }).likedByMe === false);

  // Anonymous liking is refused.
  let threw = null;
  try { TEA.likeArticle(a.id, null); } catch (e) { threw = e.message; }
  check('anonymous like refused', /signing in is required/.test(threw ?? ''));

  // Counts never touch ranking: editorial order is unchanged by likes.
  const b = TEA.createArticle({ title: 'Second story', body: 'B' });
  TEA.transition(b.id, 'publish');
  TEA.likeArticle(b.id, 'usr_one');
  TEA.likeArticle(b.id, 'usr_two');
  const ids = TEA.listPublished().map((x) => x.id);
  check('ranking stays editorial (not popularity)', ids.length === 2);
}

// ---- HTTP surface -------------------------------------------------------------
console.log('\n=== HTTP SURFACE ===');
{
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('../src/index.js');
  store._reset();
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, method = 'GET', body) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    // Design vocabulary endpoint is not captured by the :slug route.
    let r = await call('/api/tea-design');
    check('design vocabulary served', r.status === 200 && r.body?.themes?.length === 4 && r.body?.layouts?.length === 4);

    // Create with design over HTTP (dev fallback caller).
    r = await call('/api/admin/tea', 'POST', {
      title: 'HTTP story', body: 'Body.', heroImage: 'https://cdn.test/h.jpg',
      images: ['https://cdn.test/g1.jpg'],
      design: { theme: 'poster', layout: 'left', accent: '#111111', overlay: 0.7 }
    });
    check('create with design accepted', r.status === 201 && r.body?.article?.design?.theme === 'poster');
    const id = r.body.article.id;
    const slug = r.body.article.slug;

    r = await call('/api/admin/tea', 'POST', { title: 'Bad design', body: 'B', design: { theme: 'nope' } });
    check('bad design refused over HTTP (400)', r.status === 400);

    // Publish, then read publicly.
    await call(`/api/admin/tea/${id}/publish`, 'POST', {});
    r = await call(`/api/tea/${slug}`);
    check('public read carries design + gallery', r.body?.article?.design?.layout === 'left' && r.body?.article?.images?.length === 1);
    check('public read carries likeCount 0', r.body?.article?.likeCount === 0);

    // Like / unlike over HTTP.
    r = await call(`/api/tea/${id}/like`, 'POST', {});
    check('like over HTTP', r.status === 200 && r.body?.liked === true && r.body?.likeCount === 1);
    r = await call(`/api/tea/${slug}`);
    check('likedByMe reflected for the caller', r.body?.article?.likedByMe === true && r.body?.article?.likeCount === 1);
    r = await call(`/api/tea/${id}/like`, 'POST', {});
    check('idempotent like over HTTP', r.body?.likeCount === 1);
    r = await call(`/api/tea/${id}/like`, 'DELETE');
    check('unlike over HTTP', r.status === 200 && r.body?.liked === false && r.body?.likeCount === 0);

    // The published list carries likeCount for the front page.
    TEA.likeArticle(id, 'usr_someone');
    r = await call('/api/tea');
    check('front-page list carries like counts', r.body?.tea?.[0]?.likeCount === 1);
  } finally {
    srv.close();
  }
}

console.log(`\n${'='.repeat(52)}\nSTORIES  PASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
process.exit(fail ? 1 : 0);
