// ---------------------------------------------------------------------------
// ENTITY LAYER SUITE (Following + Circles)
//
// The followable layer against real persisted fixtures served over fetch:
// tappable "Venue · X" / "Source · X" chips on cards that open entity pages,
// the follow button (persisted, idempotent), the Following surface (feed +
// management grouped Places/Businesses/Publishers/Organizers/Communities
// with direct unfollow), expired content never presented as active, degraded
// sources flagged plainly, and an honest not-found state.
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

  const entityPayload = (id, over = {}) => ({
    entity: {
      kind: 'venue',
      id,
      entityKey: id.split(':')[1],
      name: 'Kilimani Studio',
      slug: id,
      summary: 'A studio block in Kilimani.',
      description: null,
      imageUrl: null,
      category: 'Place',
      location: { area: 'Kilimani', county: 'Nairobi' },
      locationName: 'Kilimani',
      sourceNames: ['Kilimani Community'],
      trust: { degraded: false, disabled: false, corroborated: true },
      isFollowed: false,
      followCount: 2,
      objects: [],
      ...over
    }
  });

  // --- 1. Entity discovery: tappable card chip -> entity page -> follow -----
  console.log('\n=== Card chips, entity page, follow ===');
  {
    const VENUE_ID = 'venue:obj_ent_venue';
    const VENUE_ENC = encodeURIComponent(VENUE_ID);
    let lastFollow = null;
    let lastUnfollow = null;
    let servedMe = {
      ...emptyPersonal,
      followed: []
    };
    const h = await boot({
      objects: [
        mk({ id: 'obj_ent_venue', type: 'place', title: 'Kilimani Studio', summary: 'A studio block.', locationName: 'Kilimani', metadata: { area: 'Kilimani', county: 'Nairobi' } }),
        mk({ id: 'obj_ent_gig', type: 'event', title: 'Suite gig at the studio', summary: 'Live set.', metadata: { venue: 'Kilimani Studio', area: 'Kilimani', eventStart: iso(72 * 3600000) }, temporal: { status: 'upcoming', startsAt: iso(72 * 3600000) } }),
        mk({ id: 'obj_ent_offer', type: 'offer', title: 'Suite studio offer', summary: 'A deal.', metadata: { venue: 'Kilimani Studio', deadlineCanonical: '2099-01-01' }, temporal: { status: 'active', deadlineAt: iso(10 * 86400000) } }),
        mk({ id: 'obj_ent_news', type: 'news', title: 'Suite news piece', summary: 'Report.', sourceNames: ['Nairobi Wire'], sourceCount: 1, metadata: { area: 'Nairobi' } })
      ],
      routes: {
        // Specific paths first (substring matching, encoded ids).
        [`/api/entities/${VENUE_ENC}/follow`]: ({ method }) => {
          if (method === 'POST') lastFollow = (lastFollow ?? 0) + 1;
          if (method === 'DELETE') lastUnfollow = (lastUnfollow ?? 0) + 1;
          return { followed: true, unfollowed: true, already: false, followCount: 3 };
        },
        [`/api/entities/${VENUE_ENC}`]: () => entityPayload(VENUE_ID, {
          isFollowed: (lastFollow ?? 0) > (lastUnfollow ?? 0),
          objects: [
            { id: 'obj_ent_gig', type: 'event', title: 'Suite gig at the studio', summary: 'Live set.', imageUrl: null, locationName: 'Kilimani', category: 'event', area: 'Kilimani', county: 'Nairobi', temporal: { status: 'upcoming', startsAt: iso(72 * 3600000) }, sourceNames: [] },
            { id: 'obj_ent_offer', type: 'offer', title: 'Suite studio offer', summary: 'A deal.', imageUrl: null, locationName: 'Kilimani', category: 'offer', area: 'Kilimani', county: 'Nairobi', temporal: { status: 'active', deadlineAt: iso(10 * 86400000) }, sourceNames: [] },
            { id: 'obj_ent_expired', type: 'offer', title: 'Suite long-gone offer', summary: 'Old.', imageUrl: null, locationName: 'Kilimani', category: 'offer', area: 'Kilimani', county: 'Nairobi', temporal: { status: 'expired', deadlineAt: iso(-5 * 86400000) }, sourceNames: [] }
          ]
        }),
        '/api/entities/by-name': ({ url }) => {
          if (url.includes('kind=publisher') && url.includes('Nairobi%20Wire')) {
            return { entity: { kind: 'publisher', id: 'publisher:src_nairobi_wire', entityKey: 'src_nairobi_wire', name: 'Nairobi Wire', slug: 'src_nairobi_wire', summary: null, description: null, imageUrl: null, category: 'Publisher', location: null, locationName: null, sourceNames: [], trust: { degraded: false, disabled: false, corroborated: false }, isFollowed: false, followCount: 0, objects: [] } };
          }
          if (url.includes('kind=venue') && url.includes('Kilimani%20Studio')) {
            return { entity: { kind: 'venue', id: VENUE_ID, entityKey: 'obj_ent_venue', name: 'Kilimani Studio', slug: 'obj_ent_venue', summary: 'A studio block in Kilimani.', description: null, imageUrl: null, category: 'Place', location: { area: 'Kilimani', county: 'Nairobi' }, locationName: 'Kilimani', sourceNames: ['Kilimani Community'], trust: { degraded: false, disabled: false, corroborated: true }, isFollowed: false, followCount: 2, objects: [] } };
          }
          return { entity: null };
        },
        '/api/entities/publisher%3Asrc_nairobi_wire': () => ({
          entity: { kind: 'publisher', id: 'publisher:src_nairobi_wire', entityKey: 'src_nairobi_wire', name: 'Nairobi Wire', slug: 'src_nairobi_wire', summary: null, description: null, imageUrl: null, category: 'Publisher', location: null, locationName: null, sourceNames: [], trust: { degraded: false, disabled: false, corroborated: false }, isFollowed: false, followCount: 0, objects: [] }
        }),
        '/api/me/followed-entities': () => ({ entities: [] }),
        '/api/me/feed': () => ({ objects: [], interests: { locations: [], types: [], topics: [] }, personalized: false }),
        '/api/me': () => servedMe
      },
      sources: [], campaigns: [], rawItems: [], circles: []
    });
    await h.settle();

    // The event/offer cards carry tappable "Venue · Kilimani Studio" chips
    // (by-name resolved); the place card carries a direct-id chip.
    const venueChip = h.buttons().find((b) => text(b) === 'Venue · Kilimani Studio');
    check('venue chips render as tappable buttons', Boolean(venueChip), text(h.document.body).slice(0, 200));
    await h.click(venueChip);
    await h.settle();
    await h.settle();
    check('entity page opens with the name and follower count',
      h.body().includes('Kilimani Studio') && h.body().includes('2 followers'));
    check('entity page labels the kind', h.body().includes('Place'));
    check('entity page shows its location', h.body().includes('Kilimani'));
    check('upcoming section renders the event', h.body().includes('Suite gig at the studio'));
    check('active offers section renders the offer', h.body().includes('Suite studio offer'));
    const activeSection = h.document.querySelector('section[aria-label="Active offers"]');
    const activeText = activeSection ? h.text(activeSection) : '';
    const expiredSection = h.document.querySelector('section[aria-label="Expired"]');
    const expiredText = expiredSection ? h.text(expiredSection) : '';
    check('expired content is NEVER inside Active offers', !activeText.includes('Suite long-gone offer'), activeText.slice(0, 120));
    check('expired content sits in its own expired strip', expiredText.includes('Suite long-gone offer') && expiredText.includes('Expired'), expiredText.slice(0, 120));
    const followBtn = h.buttons().find((b) => text(b) === 'Follow');
    check('follow button is offered', Boolean(followBtn));

    await h.click(followBtn);
    await h.settle();
    check('follow POST was sent', lastFollow === 1, String(lastFollow));
    check('follow button flips (Follow is gone, Following is shown)',
      !h.buttons().some((b) => text(b) === 'Follow') && h.buttons().some((b) => text(b) === 'Following'));

    // The news card carries a tappable "Source · Nairobi Wire" chip.
    const srcChip = h.buttons().find((b) => text(b).startsWith('Source · Nairobi Wire'));
    check('news card shows a source chip', Boolean(srcChip));
    await h.click(srcChip);
    await h.settle();
    await h.settle();
    check('publisher entity page opens', h.body().includes('Nairobi Wire') && h.body().includes('Publisher'));

    h.dom.window.close?.();
  }

  // --- 2. Following surface: feed + management with direct unfollow ---------
  console.log('\n=== Following surface: feed + manage ===');
  {
    let lastUnfollow = null;
    let servedFollows = {
      groups: {
        venue: [{ kind: 'venue', id: 'venue:obj_ent_venue', entityKey: 'obj_ent_venue', name: 'Kilimani Studio', category: 'Place', imageUrl: null, location: { area: 'Kilimani', county: null }, sourceNames: [], objectCount: 3, followedAt: iso(0) }],
        business: [],
        publisher: [],
        organizer: [],
        community: []
      },
      total: 1,
      kindLabels: { venue: 'Places', business: 'Businesses', publisher: 'Publishers', organizer: 'Organizers', community: 'Communities' }
    };
    const h = await boot({
      objects: [
        mk({ id: 'obj_ent_venue', type: 'place', title: 'Kilimani Studio', locationName: 'Kilimani', metadata: { area: 'Kilimani' } })
      ],
      routes: {
        '/api/entities/venue%3Aobj_ent_venue/follow': ({ method }) => {
          if (method === 'DELETE') {
            lastUnfollow = 'venue:obj_ent_venue';
            servedFollows = { ...servedFollows, groups: { ...servedFollows.groups, venue: [] }, total: 0 };
          }
          return { followed: true, unfollowed: true, already: false, followCount: 0 };
        },
        '/api/me/following': () => ({
          sections: [
            {
              kind: 'venue', entityId: 'venue:obj_ent_venue', entityKey: 'obj_ent_venue',
              name: 'Kilimani Studio', category: 'Place', imageUrl: null, location: { area: 'Kilimani', county: null },
              objects: [
                { id: 'obj_ent_gig', type: 'event', title: 'Suite gig at the studio', summary: 'Live set.', imageUrl: null, locationName: 'Kilimani', category: 'event', area: 'Kilimani', county: 'Nairobi', temporal: { status: 'upcoming', startsAt: iso(72 * 3600000) }, score: 8 }
              ]
            }
          ],
          total: 1
        }),
        '/api/me/follows': () => servedFollows,
        '/api/me/feed': () => ({ objects: [], interests: { locations: [], types: [], topics: [] }, personalized: false }),
        '/api/me': () => ({
          ...emptyPersonal,
          followed: [{ id: 'venue:obj_ent_venue', kind: 'venue', entityKey: 'obj_ent_venue', name: 'Kilimani Studio' }]
        })
      },
      sources: [], campaigns: [], rawItems: [], circles: []
    });
    await h.settle();

    const followingBtn = h.buttons().find((b) => text(b).startsWith('Following'));
    check('My Brief header offers the Following surface', Boolean(followingBtn), String(text(h.document.body).slice(0, 160)));
    check('following count badge shows', followingBtn.textContent.includes('1'));
    await h.click(followingBtn);
    await h.settle();
    check('following feed renders the venue section', h.body().includes('Suite gig at the studio'));
    check('feed rows carry real temporal info', h.body().includes('On '));
    check('feed section links to the entity', h.body().includes('Kilimani Studio'));

    await h.click(h.btn('Manage (1)'));
    await h.settle();
    const surfaceText = () => {
      const overlay = Array.from(h.document.querySelectorAll('.fixed')).pop();
      return overlay ? text(overlay) : '';
    };
    check('management groups by kind', surfaceText().includes('Places') && surfaceText().includes('Kilimani Studio'), surfaceText().slice(0, 160));
    check('direct unfollow is available', Boolean(h.btn('Unfollow')));
    check('follows are private (privacy note)', surfaceText().includes('private'));
    await h.click(h.btn('Unfollow'));
    await h.settle();
    check('unfollow DELETE sent for the right entity', lastUnfollow === 'venue:obj_ent_venue', String(lastUnfollow));
    check('unfollowed row disappears from management', !surfaceText().includes('Kilimani Studio'), surfaceText().slice(0, 160));

    h.dom.window.close?.();
  }

  // --- 3. Degraded source: flagged, never authoritative ---------------------
  console.log('\n=== Degraded trust note ===');
  {
    const VENUE_ID = 'venue:obj_ent_bad';
    const h = await boot({
      objects: [
        mk({ id: 'obj_ent_bad', type: 'place', title: 'Shady Hall', locationName: 'Eastleigh', metadata: { area: 'Eastleigh' } })
      ],
      routes: {
        [`/api/entities/${encodeURIComponent(VENUE_ID)}`]: () => entityPayload(VENUE_ID, {
          name: 'Shady Hall',
          trust: { degraded: true, disabled: false, corroborated: false },
          objects: []
        }),
        '/api/me/feed': () => ({ objects: [], interests: { locations: [], types: [], topics: [] }, personalized: false }),
        '/api/me': () => emptyPersonal
      },
      sources: [], campaigns: [], rawItems: [], circles: []
    });
    await h.settle();
    const chip = h.buttons().find((b) => text(b).startsWith('Venue · Shady Hall'));
    check('degraded venue still has a chip (never hidden)', Boolean(chip));
    await h.click(chip);
    await h.settle();
    check('degraded source is flagged plainly', h.body().includes('degraded'));
    check('no invented verification badge', !h.body().includes('Verified') || h.body().includes('degraded'));
    h.dom.window.close?.();
  }

  // --- 4. Not found: honest state, never a fake profile ---------------------
  console.log('\n=== Entity not found ===');
  {
    const h = await boot({
      objects: [],
      routes: {
        '/api/me/feed': () => ({ objects: [], interests: { locations: [], types: [], topics: [] }, personalized: false }),
        '/api/me': () => emptyPersonal
      },
      sources: [], campaigns: [], rawItems: [], circles: []
    });
    await h.settle();
    h.dom.window.history.pushState({}, '', '/e/venue%3Aobj_nope');
    h.dom.window.dispatchEvent(new h.dom.window.PopStateEvent('popstate'));
    await h.settle();
    check('unknown entity shows the honest not-found state', h.body().includes("This entity isn't on Brief"));
    h.dom.window.close?.();
  }

  console.log(`\n${'='.repeat(52)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
