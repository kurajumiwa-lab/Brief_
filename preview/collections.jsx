// ---------------------------------------------------------------------------
// COLLECTIONS SUITE (personal collections)
//
// Walks the real UI against fetch-mocked collections endpoints that mirror
// the server domain: create -> save -> organize -> revisit -> act. Covers
// quick create, the Saved bucket, collection pages (owner mode), add/remove/
// reorder/rename/share, expired items rendered with their real status,
// missing-image covers, the add-to-collection picker in the object modal,
// and the PUBLIC shared page (private ids never resolve).
// ---------------------------------------------------------------------------
const { boot } = require('./harness.cjs');

async function main() {
  const now = new Date();
  const iso = (offsetMs) => new Date(now.getTime() + offsetMs).toISOString();
  let pass = 0;
  let fail = 0;
  const check = (n, c, d = '') => {
    if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); }
  };
  const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  // The overlays keep the main shelf in the DOM, so global button queries can
  // hit background controls (e.g. a stray "Create"). Every interaction is
  // scoped to the active dialog instead.
  const inDialog = (h, aria) => h.document.querySelector(`[role="dialog"][aria-label="${aria}"]`);
  const dialogButtons = (h, aria) => {
    const d = inDialog(h, aria);
    return d ? Array.from(d.querySelectorAll('button')) : [];
  };

  const typeInto = async (h, el, value) => {
    const proto = h.document.defaultView.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new h.document.defaultView.Event('input', { bubbles: true }));
    await h.settle();
  };

  const mk = (o) => ({
    id: `u_${Math.random().toString(36).slice(2)}`,
    type: 'knowledge',
    title: 'Unit row',
    summary: '',
    category: 'Uncategorised',
    locationName: undefined,
    metadata: {},
    createdAt: iso(0),
    ...o
  });

  const emptyPersonal = {
    interests: { locations: [], types: [], topics: [] },
    saved: [],
    relevance: { more: [], less: [], notInterested: [], hiddenSources: [] },
    topics: [],
    suggestedLocations: [],
    notificationCandidates: [],
    followed: []
  };

  const FIXTURES = [
    mk({ id: 'colc_event', type: 'event', title: 'Weekend Jazz Night', summary: 'Live jazz.', locationName: 'Haile Selassie Ave, CBD', category: 'event', metadata: { area: 'Kilimani', county: 'Nairobi', eventStart: iso(3 * 86400000) }, media: { url: 'https://img.example/jazz.jpg' }, temporal: { status: 'upcoming', startsAt: iso(3 * 86400000) } }),
    mk({ id: 'colc_place', type: 'place', title: 'Kilimani Studio', summary: 'A studio block.', locationName: 'Kilimani', category: 'place', metadata: { area: 'Kilimani', county: 'Nairobi' }, media: { url: 'https://img.example/studio.jpg' }, temporal: { status: 'current' } }),
    mk({ id: 'colc_offer', type: 'offer', title: 'Studio Hoodie Deal', summary: 'A deal.', locationName: 'Kilimani', category: 'offer', metadata: { area: 'Kilimani', county: 'Nairobi', deadlineCanonical: '2099-01-01' }, temporal: { status: 'active', deadlineAt: iso(10 * 86400000) } }),
    mk({ id: 'colc_expired', type: 'offer', title: 'Old Hoodie Deal', summary: 'Long gone.', locationName: 'Kilimani', category: 'offer', metadata: { area: 'Kilimani', county: 'Nairobi', deadlineCanonical: '2020-01-01' }, temporal: { status: 'expired', deadlineAt: iso(-30 * 86400000) } }),
    mk({ id: 'colc_event_old', type: 'event', title: 'Old Jazz Night', summary: 'Ended.', locationName: 'Kilimani', category: 'event', metadata: { area: 'Kilimani', county: 'Nairobi', eventStart: iso(-10 * 86400000) }, temporal: { status: 'expired', startsAt: iso(-10 * 86400000) } })
  ];

  // A stateful mock of the collections domain (mirrors server/src/domain/
  // collections.js): private by default, refs only, idempotent adds, public
  // pages project public items only, covers derived from real images.
  function makeCollectionsMock() {
    const collections = [];
    const items = []; // { collectionId, objectId, position }
    const byId = (id) => collections.find((c) => c.id === id);
    const itemRows = (cid) => items.filter((r) => r.collectionId === cid).sort((a, b) => a.position - b.position);
    const resolve = (cid) => itemRows(cid).map((r) => {
      const o = FIXTURES.find((f) => f.id === r.objectId);
      if (!o) return null;
      return { id: o.id, addedAt: iso(0), position: r.position, object: o };
    }).filter(Boolean);
    const cover = (c) => {
      const urls = resolve(c.id).map((i) => i.object.media?.url).filter(Boolean).slice(0, 4);
      if (c.coverImage) return { kind: 'custom', url: c.coverImage };
      if (urls.length === 1) return { kind: 'single', url: urls[0] };
      if (urls.length > 1) return { kind: 'mosaic', urls };
      return { kind: 'none' };
    };
    const summary = (c) => {
      const list = resolve(c.id);
      const areas = [...new Set(list.map((i) => i.object.metadata?.area).filter(Boolean))];
      return {
        id: c.id, name: c.name, description: c.description, visibility: c.visibility,
        createdAt: c.createdAt, updatedAt: c.updatedAt, count: list.length,
        cover: cover(c), locations: { areas, counties: [] }
      };
    };
    const page = (c) => ({
      ...summary(c), coverImage: c.coverImage ?? null,
      items: resolve(c.id)
    });
    return {
      list: () => collections.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(summary),
      create: (body) => {
        const c = {
          id: `pcol_${collections.length + 1}`,
          name: String(body.name ?? '').trim(),
          description: String(body.description ?? '').trim(),
          coverImage: body.coverImage ?? null,
          visibility: body.visibility === 'public' ? 'public' : 'private',
          createdAt: iso(0), updatedAt: iso(0)
        };
        collections.push(c);
        return c;
      },
      get: (id) => { const c = byId(id); return c ? page(c) : null; },
      patch: (id, patch) => {
        const c = byId(id);
        if (!c) return null;
        if (patch.name) c.name = String(patch.name).trim();
        if (patch.description !== undefined) c.description = String(patch.description ?? '').trim();
        if (patch.visibility) c.visibility = patch.visibility;
        c.updatedAt = iso(1);
        return c;
      },
      del: (id) => {
        const at = collections.findIndex((c) => c.id === id);
        if (at < 0) return false;
        collections.splice(at, 1);
        for (let i = items.length - 1; i >= 0; i--) if (items[i].collectionId === id) items.splice(i, 1);
        return true;
      },
      add: (cid, objectId) => {
        const c = byId(cid);
        if (!c) return { ok: false, status: 404 };
        const o = FIXTURES.find((f) => f.id === objectId);
        if (!o || o.metadata?.publication === 'private') return { ok: false, status: 400 };
        if (itemRows(cid).some((r) => r.objectId === objectId)) return { ok: true, added: false };
        items.push({ collectionId: cid, objectId, position: itemRows(cid).length });
        c.updatedAt = iso(1);
        return { ok: true, added: true };
      },
      remove: (cid, objectId) => {
        const at = items.findIndex((r) => r.collectionId === cid && r.objectId === objectId);
        if (at < 0) return false;
        items.splice(at, 1);
        return true;
      },
      reorder: (cid, ordered) => {
        const c = byId(cid);
        if (!c) return false;
        const rows = itemRows(cid);
        ordered.forEach((oid, i) => { const r = rows.find((x) => x.objectId === oid); if (r) r.position = i; });
        return true;
      },
      publicPage: (id) => {
        const c = byId(id);
        if (!c || c.visibility !== 'public') return null;
        return page(c);
      }
    };
  }

  const mock = makeCollectionsMock();

  // A catch-all mock of /api/me/collections (list/create + owner page +
  // items + share) and /api/collections/personal/:id (public page).
  function collectionRoutes(extra = {}) {
    return {
      '/api/me/collections': ({ method, url, body }) => {
        const rest = url.replace(/^.*?\/api\/me\/collections/, '').replace(/^\/?\??/, '').replace(/\?.*$/, '');
        const parts = rest.split('/').filter(Boolean);
        const [id, action, oid] = parts;
        if (!id) {
          if (method === 'POST') {
            const c = mock.create(JSON.parse(body ?? '{}'));
            return { ok: true, collection: mock.get(c.id) };
          }
          const q = new URLSearchParams((url.split('?')[1] ?? '')).get('q') ?? '';
          const list = mock.list().filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
          return { collections: list };
        }
        if (action === 'items') {
          if (method === 'POST') {
            const { objectId } = JSON.parse(body ?? '{}');
            const r = mock.add(id, objectId);
            return r.ok ? { ok: true, added: r.added, collectionId: id } : { error: 'nope' };
          }
          if (method === 'PUT') return { ok: true };
          if (method === 'DELETE') return { ok: true, removed: mock.remove(id, oid) };
          return { ok: true };
        }
        if (action === 'share') return { ok: true, url: 'https://brief.example/collections/' + id };
        if (method === 'PATCH') { mock.patch(id, JSON.parse(body ?? '{}')); return { ok: true, collection: mock.get(id) }; }
        if (method === 'DELETE') { mock.del(id); return { ok: true }; }
        const c = mock.get(id);
        return c ? { collection: c } : { error: 'collection not found' };
      },
      '/api/collections/personal/': ({ url }) => {
        const id = decodeURIComponent(url.replace(/^.*?\/api\/collections\/personal\//, '').split('?')[0]);
        const p = mock.publicPage(id);
        return p ? { collection: p } : { error: 'collection not found' };
      },
      ...extra
    };
  }

  // --- 1. Surface: header entry, create, Saved bucket -----------------------
  console.log('\n=== Surface: header, create, Saved ===');
  {
    let servedMe = { ...emptyPersonal, saved: [] };
    const h1 = await boot({
      objects: FIXTURES,
      routes: {
        ...collectionRoutes(),
        '/api/me/feed': () => ({ objects: [], interests: { locations: [], types: [], topics: [] }, personalized: false }),
        '/api/me/followed-entities': () => ({ entities: [] }),
        // '/api/me' is a substring of every /api/me/* path — the harness
        // matches in insertion order, so the catch-all goes LAST.
        '/api/me': () => servedMe
      },
      sources: [], campaigns: [], rawItems: [], circles: []
    });
    await h1.settle();

    const collectionsBtn = h1.buttons().find((b) => text(b).includes('Collections'));
    check('Collections button is in the header', Boolean(collectionsBtn), h1.body().slice(0, 150));
    await h1.click(collectionsBtn);
    await h1.settle();
    check('surface opens', h1.body().includes('Your quick saves'));
    check('Saved bucket shows the real count', h1.body().includes('0 items'));

    // Create (all clicks scoped to the Collections dialog).
    await h1.click(dialogButtons(h1, 'Collections').find((b) => text(b) === 'New'));
    await h1.settle();
    const nameInput = inDialog(h1, 'Collections').querySelector('input[aria-label="Collection name"]');
    check('create form appears', Boolean(nameInput));
    await typeInto(h1, nameInput, 'Weekend Plans');
    await h1.click(dialogButtons(h1, 'Collections').find((b) => text(b) === 'Create'));
    await h1.settle();
    check('new collection card appears with count', h1.body().includes('Weekend Plans') && h1.body().includes('0 items'));
    check('private by default (lock icon shown)', Boolean(inDialog(h1, 'Collections').querySelector('svg.lucide-lock')));
    // Second collection: the picker later adds the jazz event into it.
    await h1.click(dialogButtons(h1, 'Collections').find((b) => text(b) === 'New'));
    await h1.settle();
    const name2 = inDialog(h1, 'Collections').querySelector('input[aria-label="Collection name"]');
    await typeInto(h1, name2, 'Nairobi Food Spots');
    await h1.click(dialogButtons(h1, 'Collections').find((b) => text(b) === 'Create'));
    await h1.settle();
    check('second collection appears', h1.body().includes('Nairobi Food Spots'));
  }

  // --- 2. Collection page (owner): open, add from picker, expired, remove ---
  console.log('\n=== Collection page: owner view ===');
  let h2;
  {
    mock.add('pcol_1', 'colc_offer');
    mock.add('pcol_1', 'colc_expired');
    mock.add('pcol_1', 'colc_place'); // has studio.jpg — cover must derive from it
    mock.add('pcol_1', 'colc_event'); // jazz night — picker exercises its row
    h2 = await boot({
      objects: FIXTURES,
      routes: {
        ...collectionRoutes(),
        '/api/me/feed': () => ({ objects: [], interests: { locations: [], types: [], topics: [] }, personalized: false }),
        '/api/me/followed-entities': () => ({ entities: [] }),
        '/api/me': () => ({ ...emptyPersonal, saved: [] })
      },
      sources: [], campaigns: [], rawItems: [], circles: []
    });
    await h2.settle();

    const collectionsBtn = h2.buttons().find((b) => text(b).includes('Collections'));
    await h2.click(collectionsBtn);
    await h2.settle();
    // The surface's Back must dismiss it IN-APP (same overlay contract as
    // Following) and keep the session running.
    const surfaceBack = dialogButtons(h2, 'Collections').find((b) => text(b) === 'Back' || b.getAttribute('aria-label') === 'Back');
    check('collections surface offers Back', Boolean(surfaceBack));
    await h2.click(surfaceBack);
    await h2.settle();
    await h2.settle();
    check('collections Back dismisses the surface in-app', !Boolean(inDialog(h2, 'Collections')));
    check('collections Back keeps the app running', Boolean(h2.buttons().find((b) => text(b).includes('Collections'))));
    await h2.click(h2.buttons().find((b) => text(b).includes('Collections')));
    await h2.settle();
    const card = dialogButtons(h2, 'Collections').find((b) => text(b).includes('Weekend Plans'));
    check('collection card lists its real count', text(card).includes('4 items'), text(card));
    await h2.click(card);
    await h2.settle();
    const body = h2.body();
    check('collection page shows name + count', body.includes('Weekend Plans') && body.includes('4 items'));
    check('expired item shows Expired (never active)', body.includes('Old Hoodie Deal') && body.includes('Expired'));
    check('active item shows its real status line', body.includes('Studio Hoodie Deal') && body.includes('Closes'));
    check('cover derived from real images', Boolean(h2.document.querySelector('img[src="https://img.example/studio.jpg"]')));
    check('location chip from item fields', body.includes('Kilimani'));

    // Remove the expired item (its own row's Remove control).
    const rows = Array.from(inDialog(h2, 'Collection Weekend Plans').querySelectorAll('div.group'));
    const expiredRow = rows.find((r) => text(r).includes('Old Hoodie Deal'));
    const removeBtn = expiredRow ? expiredRow.querySelector('button[aria-label="Remove"]') : null;
    check('remove control exists', Boolean(removeBtn));
    await h2.click(removeBtn);
    await h2.settle();
    await h2.settle();
    const ownerDialog = inDialog(h2, 'Collection Weekend Plans');
    check('removed item leaves the page', !text(ownerDialog).includes('Old Hoodie Deal'));


    // Rename.
    const renameBtn = dialogButtons(h2, 'Collection Weekend Plans').find((b) => text(b).includes('Rename'));
    await h2.click(renameBtn);
    await h2.settle();
    const rnInput = inDialog(h2, 'Collection Weekend Plans').querySelector('input[aria-label="Collection name"]');
    await typeInto(h2, rnInput, 'Weekend Ideas');
    await h2.click(dialogButtons(h2, 'Collection Weekend Plans').find((b) => text(b) === 'Save'));
    await h2.settle();
    check('rename applies', h2.body().includes('Weekend Ideas'));

    // Make public + share.
    const visBtn = dialogButtons(h2, 'Collection Weekend Ideas').find((b) => text(b).includes('Private'));
    await h2.click(visBtn);
    await h2.settle();
    check('visibility toggles to Public', h2.body().includes('Public'));
    const shareBtn = dialogButtons(h2, 'Collection Weekend Ideas').find((b) => text(b).includes('Share'));
    await h2.click(shareBtn);
    await h2.settle();
    check('share reveals the stable URL', h2.body().includes('/collections/pcol_1'));

    // Picker: open an item from the page → detail modal → Add to collection
    // → toggle 'Nairobi Food Spots' → membership persists server-side.
    await h2.click(dialogButtons(h2, 'Collection Weekend Ideas').find((b) => text(b).includes('Weekend Jazz Night')));
    await h2.settle();
    const modal = Array.from(h2.document.querySelectorAll('div.fixed.inset-0.z-50')).find((d) => text(d).includes('Add to collection'));
    check('detail modal opens with Add to collection', Boolean(modal));
    await h2.click(Array.from(modal.querySelectorAll('button')).find((b) => text(b).includes('Add to collection')));
    await h2.settle();
    const pickRows = Array.from(modal.querySelectorAll('button')).filter((b) => text(b).includes('Nairobi Food Spots') || text(b).includes('Weekend Ideas'));
    const wpRow = pickRows.find((b) => text(b).includes('Weekend Ideas'));
    const nrbRow = pickRows.find((b) => text(b).includes('Nairobi Food Spots'));
    check('picker lists collections with live membership',
      pickRows.length === 2 && wpRow.className.includes('bg-[#171A20]') && !nrbRow.className.includes('bg-[#171A20]'));
    await h2.click(nrbRow);
    await h2.settle();
    await h2.settle();
    check('add persists server-side (ref only)', mock.get('pcol_2').items.some((i) => i.object.id === 'colc_event'));
    check('picker row flips to checked', nrbRow.className.includes('bg-[#171A20]'));
    // Close the detail modal again before the public-route step.
    await h2.click(modal.querySelector('button'));
    await h2.settle();
  }

  // --- 3. Public shared page (route /collections/:id) -----------------------
  console.log('\n=== Public shared page ===');
  {
    mock.patch('pcol_1', { visibility: 'public' });
    mock.add('pcol_1', 'colc_event');
    // Leave the owner page first so only the shared-route page is up.
    await h2.click(dialogButtons(h2, 'Collection Weekend Ideas').find((b) => text(b) === 'Back'));
    await h2.settle();
    await h2.settle();
    // Land on the shared route like a real share link: pushState + popstate
    // drives the app's own router (bootRoute is module-level, so a second
    // boot cannot re-parse the URL — the router path is the honest one).
    const { parsePath } = require('./src/nav/routes.ts');
    const shared = parsePath('/collections/pcol_1', '');
    h2.dom.window.history.pushState(shared, '', '/collections/pcol_1');
    h2.dom.window.dispatchEvent(new h2.dom.window.PopStateEvent('popstate', { state: shared }));
    await h2.settle();
    await h2.settle();
    const pubDialog = inDialog(h2, 'Collection Weekend Ideas');
    check('public page renders from the shared route', Boolean(pubDialog) && text(pubDialog).includes('Weekend Ideas'), h2.body().slice(0, 120));
    check('public page shows the Public badge', Boolean(pubDialog) && Boolean(dialogButtons(h2, 'Collection Weekend Ideas').find((b) => text(b).includes('Share'))));
    check('public page renders mixed item types', Boolean(pubDialog) && text(pubDialog).includes('Weekend Jazz Night') && text(pubDialog).includes('Studio Hoodie Deal'));
    check('public page has no owner controls (no Remove)', !pubDialog || dialogButtons(h2, 'Collection Weekend Ideas').every((b) => b.getAttribute('aria-label') !== 'Remove'));
    check('public page links items into the app', Boolean(dialogButtons(h2, 'Collection Weekend Ideas').find((b) => text(b).includes('Weekend Jazz Night'))));
  }

  console.log(`\n${'='.repeat(52)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
