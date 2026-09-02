// ---------------------------------------------------------------------------
// NOTIFICATION CENTER SUITE (client surface)
//
// Walks the real UI against a stateful fetch mock mirroring the server
// domain: bell entry + unread badge, NEW/EARLIER sections, mark read /
// unread / all, deep links into the EXISTING object detail, preferences
// toggles, an expired object rendered with its current status, and a
// zero-unread boot that shows no badge.
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
  const dialog = (h, aria) => h.document.querySelector(`[role="dialog"][aria-label="${aria}"]`);
  const dialogText = (h, aria) => text(dialog(h, aria));
  const inDialog = (h, aria) => Array.from((dialog(h, aria) ?? h.document).querySelectorAll('button'));

  const mk = (o) => ({
    id: `ntf_obj_${Math.random().toString(36).slice(2)}`,
    type: 'event',
    title: 'Seed event',
    summary: 'A seed row.',
    category: 'event',
    locationName: 'Kilimani',
    metadata: { area: 'Kilimani', county: 'Nairobi', eventStart: iso(3 * 86400000) },
    createdAt: iso(-2 * 86400000),
    ...o
  });

  const OBJ = mk({
    id: 'ntf_obj',
    title: 'Jazz Under the Stars',
    type: 'event',
    summary: 'Live jazz in Kilimani.',
    temporal: { status: 'upcoming', startsAt: iso(3 * 86400000) },
    metadata: { area: 'Kilimani', county: 'Nairobi', eventStart: iso(3 * 86400000) }
  });
  const EXPIRED = mk({
    id: 'ntf_expired',
    title: 'Old Hoodie Deal',
    type: 'offer',
    summary: 'A deal that ended.',
    metadata: { area: 'Kilimani', county: 'Nairobi', deadlineCanonical: '2020-01-01' },
    temporal: { status: 'expired', deadlineAt: iso(-30 * 86400000) }
  });
  const FIXTURES = [OBJ, EXPIRED];

  const row = (o) => {
    const obj = FIXTURES.find((f) => f.id === o.objectId) ?? null;
    return {
      id: o.id, kind: o.kind, type: o.type, title: o.title, body: o.body ?? null,
      objectId: o.objectId ?? null, entityId: o.entityId ?? null,
      collectionId: o.collectionId ?? null, imageUrl: o.imageUrl ?? null,
      sourceName: o.sourceName ?? null, context: o.context ?? null,
      dest: o.dest ?? null, priority: o.priority ?? 'normal', status: o.status ?? 'active',
      read: o.read ?? false, readAt: o.read ? iso(-3600000) : null,
      dedupeKey: null, metadata: null, createdAt: o.createdAt ?? iso(-3600000),
      object: obj ? {
        id: obj.id, type: obj.type, title: obj.title, status: obj.temporal?.status ?? null,
        imageUrl: obj.imageUrl ?? null, sourceNames: obj.sourceNames ?? []
      } : null
    };
  };

  // Stateful mock of the server domain: rows + categories + unread count.
  function makeNotificationsMock(initial) {
    const rows = initial.map(row);
    const prefs = { following: true, events: true, offers: true, alerts: true, news: true, locations: true, saved: true };
    const unread = () => rows.filter((r) => !r.read).length;
    return {
      rows,
      prefs,
      unread,
      list: ({ url }) => {
        const unreadOnly = /unread=1/.test(url);
        return {
          notifications: (unreadOnly ? rows.filter((r) => !r.read) : rows).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          unread: unread(),
          preferences: { categories: { ...prefs } },
          generatedAt: null
        };
      },
      read: ({ id, read }) => {
        const n = rows.find((r) => r.id === id);
        if (!n) return null;
        n.read = read !== false;
        n.readAt = n.read ? iso(0) : null;
        return { notification: n, unread: unread() };
      },
      allRead: () => {
        rows.forEach((r) => { r.read = true; r.readAt = r.readAt ?? iso(0); });
        return { marked: rows.length };
      },
      opened: (id) => {
        const n = rows.find((r) => r.id === id);
        if (!n) return null;
        n.read = true; n.readAt = n.readAt ?? iso(0);
        return { notification: n, unread: unread() };
      }
    };
  }

  function notificationRoutes(store) {
    return {
      '/api/notifications/preferences': ({ method, url, body }) => {
        if (method === 'PUT') {
          const cats = JSON.parse(body ?? '{}').categories ?? {};
          let changed = false;
          for (const [k, v] of Object.entries(cats)) {
            if (store.prefs[k] !== v) { store.prefs[k] = v; changed = true; }
          }
          return { ok: true, preferences: { ...store.prefs }, changed };
        }
        return { preferences: { categories: { ...store.prefs } } };
      },
      '/api/notifications/read': ({ body }) => {
        const b = JSON.parse(body ?? '{}');
        if (b.all) return store.allRead();
        return store.read({ id: b.id, read: b.read });
      },
      '/open': ({ url }) => {
        const m = url.match(/\/api\/notifications\/([^/]+)\/open$/);
        return store.opened(m ? m[1] : null);
      },
      '/api/notifications': ({ url }) => store.list({ url })
    };
  }

  // -------------------------------------------------------------------------
  console.log('\n=== zero-unread boot: no badge at all ===');
  {
    const store = makeNotificationsMock([]);
    const h = await boot({ objects: FIXTURES, routes: notificationRoutes(store) });
    const bell = h.buttons().find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Updates'));
    check('bell entry exists', !!bell);
    check('no unread badge when count is zero', bell ? !text(bell).match(/\d+\s*unread/) && !(dialogText(h, 'Notifications') ?? '').includes('unread') : false, bell ? text(bell) : 'no bell');
    h.dom.window.close();
  }

  // -------------------------------------------------------------------------
  console.log('\n=== center opens from the bell ===');
  const store = makeNotificationsMock([
    { id: 'ntf_open_1', type: 'following', title: 'New from Kilimani Studio', body: 'A new event was just added.', objectId: 'ntf_obj', dest: 'object:ntf_obj', sourceName: 'News Wire', priority: 'normal', createdAt: iso(-120000) },
    { id: 'ntf_open_2', type: 'event', title: 'Jazz Under the Stars starts Friday', body: 'Starts 8pm in Kilimani.', objectId: 'ntf_obj', dest: 'object:ntf_obj', priority: 'important', createdAt: iso(-3600000) },
    { id: 'ntf_open_3', type: 'correction', title: 'Old Hoodie Deal corrected', body: 'This offer is no longer active.', objectId: 'ntf_expired', dest: 'object:ntf_expired', priority: 'normal', read: true, createdAt: iso(-5 * 86400000) },
    { id: 'ntf_open_4', type: 'offer', title: 'New 2-for-1 at Kilimani Studio', objectId: 'ntf_obj', dest: 'object:ntf_obj', priority: 'low', createdAt: iso(-60000) }
  ]);
  const h = await boot({ objects: FIXTURES, routes: notificationRoutes(store) });

  const bell = await (async () => {
    // The rail bell carries the unread count in its aria-label.
    for (const b of h.buttons()) {
      const label = b.getAttribute('aria-label') ?? '';
      if (label.startsWith('Updates')) return b;
    }
    return null;
  })();
  check('rail bell shows unread count', !!bell && /3 unread/.test(bell.getAttribute('aria-label') ?? ''), bell ? (bell.getAttribute('aria-label') ?? '') : 'no bell');
  await h.click(bell);
  await h.settle();

  const dlg = dialog(h, 'Notifications');
  check('center opens with dialog role', !!dlg);
  check('NEW section lists unread rows first', !!dlg && text(dlg.querySelector('section[aria-label="New"]')).includes('Jazz Under the Stars starts Friday'));
  check('EARLIER section keeps read rows', !!dlg && text(dlg.querySelector('section[aria-label="Earlier"]')).includes('Old Hoodie Deal corrected'));
  check('freshness renders (m/h)', !!dlg && /\d+m/.test(dialogText(h, 'Notifications')));
  check('source shows where real', !!dlg && dialogText(h, 'Notifications').includes('News Wire'));

  // -------------------------------------------------------------------------
  console.log('\n=== deep link: tap opens the EXISTING object detail ===');
  {
    const rowBtn = inDialog(h, 'Notifications').find((b) => text(b).includes('Jazz Under the Stars starts Friday'));
    await h.click(rowBtn);
    await h.settle();
    check('center closes on deep link', !dialog(h, 'Notifications'));
    check('object detail opens', h.body().includes('Jazz Under the Stars') && h.body().includes('Live jazz in Kilimani'));
  }

  // -------------------------------------------------------------------------
  console.log('\n=== read persists across close/reopen ===');
  {
    // Close the object detail via its backdrop (dismissOverlay contract).
    const overlay = Array.from(h.document.querySelectorAll('div')).find(
      (d) => (d.className ?? '').includes('fixed inset-0') && text(d).includes('Jazz Under the Stars')
    );
    await h.click(overlay);
    await h.settle();
    const bell2 = h.buttons().find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Updates'));
    await h.click(bell2);
    await h.settle();
    const dlg2 = dialog(h, 'Notifications');
    const earlier = text(dlg2?.querySelector('section[aria-label="Earlier"]') ?? null);
    check('opened row is now in EARLIER', earlier.includes('Jazz Under the Stars starts Friday'), earlier);
    check('unread badge dropped to 2', /2 unread/.test(bell2.getAttribute('aria-label') ?? ''), bell2.getAttribute('aria-label') ?? '');
    check('expired object shows its CURRENT status, not a claim', dialogText(h, 'Notifications').includes('Expired'));
  }

  // -------------------------------------------------------------------------
  console.log('\n=== mark unread + mark all read ===');
  {
    const dlg3 = dialog(h, 'Notifications');
    const earlierSection = dlg3?.querySelector('section[aria-label="Earlier"]');
    const rowBtn = earlierSection ? Array.from(earlierSection.querySelectorAll('button')).find((b) => text(b).includes('Jazz Under the Stars starts Friday')) : null;
    const markUnread = rowBtn?.parentElement?.querySelector('button[aria-label="Mark unread"]') ?? null;
    await h.click(markUnread);
    await h.settle();
    check('mark unread moves it back to NEW', !!dlg3 && text(dlg3.querySelector('section[aria-label="New"]')).includes('Jazz Under the Stars starts Friday'));
    const markAll = inDialog(h, 'Notifications').find((b) => text(b).includes('Mark all read'));
    await h.click(markAll);
    await h.settle();
    check('mark all read empties NEW', !!dlg3 && (text(dlg3.querySelector('section[aria-label="New"]') ?? null) === ''));
    check('badge clears after mark all', !/ [1-9]\d* unread/.test(bell.getAttribute('aria-label') ?? ''), bell.getAttribute('aria-label') ?? '');
  }

  // -------------------------------------------------------------------------
  console.log('\n=== preferences: simple category toggles ===');
  {
    const setBtn = inDialog(h, 'Notifications').find((b) => b.getAttribute('aria-label') === 'Notification preferences');
    await h.click(setBtn);
    await h.settle();
    const eventsToggle = inDialog(h, 'Notifications').find((b) => text(b).startsWith('Events'));
    check('toggle row shows current state On', !!eventsToggle && text(eventsToggle).includes('On'));
    await h.click(eventsToggle);
    await h.settle();
    check('toggle flips to Off', text(eventsToggle).includes('Off'));
    check('preference persisted in mock', store.prefs.events === false, JSON.stringify(store.prefs));
  }

  // -------------------------------------------------------------------------
  console.log('\n=== MenuSheet entry carries the unread count ===');
  {
    const menuBtn = h.buttons().find((b) => text(b) === 'Menu');
    await h.click(menuBtn);
    await h.settle();
    const updatesRow = h.buttons().find((b) => text(b).includes('What changed while you were away'));
    check('Updates row exists in menu', !!updatesRow && text(updatesRow).startsWith('Updates'));
    check('menu row shows zero unread (all read)', !!updatesRow && !/\b\d+\b/.test(text(updatesRow)), updatesRow ? text(updatesRow) : 'no row');
  }

  h.dom.window.close();

  console.log(`\nPASS ${pass} FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
}

main().then(() => { process.exit(fail ? 1 : 0); }).catch((e) => { console.error(e); process.exit(1); });
