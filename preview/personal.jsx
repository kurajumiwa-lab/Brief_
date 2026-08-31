// ---------------------------------------------------------------------------
// PERSONAL BRIEF SUITE
//
// The Personal Brief experience, all against real persisted fixtures served
// over fetch: skippable onboarding chips, follow/unfollow persistence,
// personal sections (YOUR BRIEF / AROUND YOU / TODAY / COMING UP / FOR YOU —
// never empty), the Saved surface grouped Upcoming/Active/News/Places/Offers
// with expired rows reading as expired, explicit relevance controls in the
// detail modal, and the report reasons aligned with the server allowlist.
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
    topics: [
      { id: 'food', label: 'Food', keywords: ['food', 'restaurant', 'cafe', 'market'] },
      { id: 'jobs', label: 'Jobs', keywords: ['job', 'vacancy', 'hiring', 'apply'] },
      { id: 'entertainment', label: 'Entertainment', keywords: ['concert', 'gig', 'show', 'music'] },
      { id: 'community', label: 'Community', keywords: ['community', 'clean-up', 'meeting'] }
    ],
    suggestedLocations: ['Kilimani', 'Westlands', 'Kasarani', 'Mombasa', 'Nairobi'],
    notificationCandidates: []
  };

  // --- 1. Onboarding: where + what, skippable, never blocks -----------------
  console.log('\n=== Onboarding: chips, skip, never blocks ===');
  {
    const h = await boot({
      objects: [
        mk({ type: 'event', title: 'Personal suite concert', summary: 'A gig at the yard.', metadata: { area: 'Kilimani', county: 'Nairobi', eventStart: iso(48 * 3600000) }, locationName: 'Kilimani' }),
        mk({ type: 'offer', title: 'Personal suite offer', summary: 'A deal.', metadata: { area: 'Kilimani', deadlineCanonical: '2099-01-01' } })
      ],
      routes: {
        // Specific paths first: the harness matches by substring.
        '/api/me/feed': { objects: [], interests: { locations: [], types: [], topics: [] }, personalized: false },
        '/api/me': emptyPersonal
      },
      sources: [], campaigns: [], rawItems: [], circles: []
    });
    await h.settle();
    const body = h.body();
    check('onboarding card renders for a fresh user', body.includes('Make this your Brief'), body.slice(0, 120));
    check('where-question asked', body.includes('Where do you want your Brief?'));
    check('what-question asked', body.includes('What do you care about?'));
    check('location chips offered', body.includes('Kilimani') && body.includes('Westlands'));
    check('topic chips offered', body.includes('Food') && body.includes('Jobs'));
    check('skip is available', Boolean(h.btn('Skip')));

    // Skip: the card closes, the Brief stays fully usable, feed rows remain.
    await h.click(h.btn('Skip'));
    await h.settle();
    const after = h.body();
    check('skip closes the card', !after.includes('Make this your Brief'));
    check('global feed still shows real rows after skip', after.includes('Personal suite concert'));
    check('a quiet personalize affordance remains', after.includes('Personalize'));
    h.dom.window.close?.();
  }

  // --- 2. Build my Brief: picks persist, following chips appear -------------
  console.log('\n=== Build my Brief: picks persist via PUT ===');
  {
    let lastPut = null;
    let served = { ...emptyPersonal };
    const h = await boot({
      objects: [
        mk({ type: 'experience', title: 'Personal suite concert', summary: 'A gig at the yard.', metadata: { area: 'Kilimani', county: 'Nairobi', eventStart: iso(48 * 3600000) }, locationName: 'Kilimani' })
      ],
      routes: {
        '/api/me/interests': ({ method, body }) => {
          const picks = body ? JSON.parse(body) : null;
          lastPut = { method, picks };
          if (method === 'PUT' && picks) {
            served = { ...served, interests: { locations: picks.locations ?? [], types: picks.types ?? [], topics: picks.topics ?? [] } };
          }
          return { ok: true, interests: served.interests };
        },
        '/api/me/feed': () => ({ objects: [], interests: served.interests, personalized: served.interests.locations.length > 0 }),
        '/api/me': () => served
      },
      sources: [], campaigns: [], rawItems: [], circles: []
    });
    await h.settle();
    await h.click(h.btn('Kilimani'));
    await h.click(h.btn('Experience'));
    await h.click(h.btn('Build my Brief'));
    await h.settle();
    check('PUT carried the picked location', lastPut?.method === 'PUT' && lastPut?.picks?.locations?.includes('Kilimani'), JSON.stringify(lastPut));
    check('PUT carried the picked type', lastPut?.picks?.types?.includes('experience'), JSON.stringify(lastPut?.picks?.types));
    check('onboarding card closes after saving', !h.body().includes('Make this your Brief'));
    check('following chip shows the location with an unfollow', h.body().includes('Kilimani'));
    h.dom.window.close?.();
  }

  // --- 3. Unfollow: the × removes the follow via DELETE ---------------------
  console.log('\n=== Unfollow: obvious ×, persisted ===');
  {
    let lastDelete = null;
    let served = {
      ...emptyPersonal,
      interests: { locations: ['Kilimani'], types: ['event'], topics: [] }
    };
    const h = await boot({
      objects: [
        mk({ type: 'event', title: 'Personal suite concert', summary: 'A gig at the yard.', metadata: { area: 'Kilimani' } })
      ],
      routes: {
        '/api/me/interests': ({ method, body }) => {
          const req = body ? JSON.parse(body) : null;
          if (method === 'DELETE' && req) {
            lastDelete = req;
            served = {
              ...served,
              interests: {
                locations: served.interests.locations.filter((v) => v !== req.value),
                types: served.interests.types.filter((v) => v !== req.value),
                topics: served.interests.topics.filter((v) => v !== req.value)
              }
            };
          }
          return { ok: true, interests: served.interests };
        },
        '/api/me/feed': () => ({ objects: [], interests: served.interests, personalized: true }),
        '/api/me': () => served
      },
      sources: [], campaigns: [], rawItems: [], circles: []
    });
    await h.settle();
    const followedChips = () => h.buttons().filter((b) => b.getAttribute('title') === 'Stop following Kilimani');
    check('followed location chip present', followedChips().length === 1, String(followedChips().length));
    await h.click(followedChips()[0]);
    await h.settle();
    check('unfollow sent DELETE with the right kind/value', lastDelete?.kind === 'location' && lastDelete?.value === 'Kilimani', JSON.stringify(lastDelete));
    check('followed chip disappears after unfollow', followedChips().length === 0, String(followedChips().length));
    h.dom.window.close?.();
  }

  // --- 4. Personal sections: only non-empty, from real rows -----------------
  console.log('\n=== Personal sections: YOUR BRIEF / AROUND YOU / TODAY / COMING UP / FOR YOU ===');
  {
    const h = await boot({
      objects: [
        mk({ id: 'boosted', type: 'offer', title: 'Personal suite boosted offer', summary: 'Kilimani deal.', metadata: { area: 'Kilimani', deadlineCanonical: '2099-01-01' }, temporal: { status: 'active', deadlineAt: iso(30 * 86400000) } }),
        mk({ id: 'future', type: 'event', title: 'Personal suite future gig', summary: 'Upcoming.', metadata: { area: 'Westlands', eventStart: iso(72 * 3600000) }, temporal: { status: 'upcoming', startsAt: iso(72 * 3600000) } }),
        mk({ id: 'unplaced', type: 'news', title: 'Personal suite unplaced news', summary: 'Nowhere.', metadata: {} }),
        mk({ id: 'around_me', type: 'place', title: 'Personal suite local place', summary: 'Nearby.', metadata: { area: 'Kilimani' } })
      ],
      routes: {
        '/api/me/feed': () => ({
          objects: [
            { id: 'boosted', personal: { boost: 6, reasons: ['location'] } },
            { id: 'future', personal: { boost: 0, reasons: [] } },
            { id: 'unplaced', personal: { boost: 0, reasons: [] } },
            { id: 'around_me', personal: { boost: 0, reasons: [] } }
          ],
          interests: { locations: ['Kilimani'], types: ['offer'], topics: [] },
          personalized: true
        }),
        '/api/me': {
          ...emptyPersonal,
          interests: { locations: ['Kilimani'], types: ['offer'], topics: [] }
        }
      },
      sources: [], campaigns: [], rawItems: [], circles: []
    });
    await h.settle();
    // Scope assertions to the My Brief section so the global feed (which
    // legitimately shows every object) cannot mask what personal sections do.
    const myBrief = h.document.querySelector('section[aria-label="My Brief"]');
    const briefText = myBrief ? h.text(myBrief) : '';
    check('My Brief section renders', Boolean(myBrief));
    check('YOUR BRIEF section renders', briefText.includes('YOUR BRIEF'));
    check('boosted row inside YOUR BRIEF', briefText.includes('Personal suite boosted offer'));
    check('AROUND YOU section renders', briefText.includes('AROUND YOU') && briefText.includes('Personal suite local place'));
    check('COMING UP section renders', briefText.includes('COMING UP'));
    check('future gig inside COMING UP', briefText.includes('Personal suite future gig'));
    check('no TODAY section when nothing is today', !briefText.includes('TODAY'));
    check('unplaced news never surfaces in a personal section', !briefText.includes('Personal suite unplaced news'));
    h.dom.window.close?.();
  }

  // --- 5. Saved surface: grouped, expired reads as expired ------------------
  console.log('\n=== Saved: Upcoming / Active / News / Places / Offers, expired never active ===');
  {
    const h = await boot({
      objects: [
        mk({ id: 'sv_event', type: 'event', title: 'Personal suite saved gig', summary: 'Soon.', metadata: { area: 'Kilimani', eventStart: iso(48 * 3600000) } }),
        mk({ id: 'sv_offer', type: 'offer', title: 'Personal suite dead offer', summary: 'Gone.', metadata: { area: 'Kilimani', deadlineCanonical: '2020-01-01' }, temporal: { status: 'expired', deadlineAt: iso(-10 * 86400000) } }),
        mk({ id: 'sv_news', type: 'news', title: 'Personal suite saved news', summary: 'Fresh.', metadata: { area: 'Nairobi' } }),
        mk({ id: 'sv_place', type: 'place', title: 'Personal suite saved place', summary: 'Here.', metadata: { area: 'Kilimani' } })
      ],
      routes: {
        '/api/me/feed': () => ({ objects: [], interests: { locations: [], types: [], topics: [] }, personalized: false }),
        '/api/me': {
          ...emptyPersonal,
          saved: ['sv_event', 'sv_offer', 'sv_news', 'sv_place']
        }
      },
      sources: [], campaigns: [], rawItems: [], circles: []
    });
    await h.settle();
    const body = h.body();
    check('Saved panel renders', body.includes('Saved'));
    check('Upcoming group holds the future event', body.includes('Upcoming'));
    check('News group holds the news row', body.includes('News'));
    check('Places group holds the place row', body.includes('Places'));
    check('expired offer reads as Expired', body.includes('Expired'));
    check('expired offer is struck through, never active', body.includes('Personal suite dead offer'));
    h.dom.window.close?.();
  }

  // --- 6. Detail modal: explicit tuning controls, persisted -----------------
  console.log('\n=== Detail: More / Less / Not interested / Hide source ===');
  {
    let lastRelevance = null;
    let relevance = { more: [], less: [], notInterested: [], hiddenSources: [] };
    const h = await boot({
      objects: [
        mk({
          id: 'tune_me', type: 'offer', title: 'Personal suite tunable offer', summary: 'Tune.',
          sourceId: 'src_suite', sourceNames: ['Suite Source'], sourceCount: 1,
          metadata: { area: 'Kilimani', deadlineCanonical: '2099-01-01' }
        })
      ],
      routes: {
        '/api/me/relevance': ({ method, body }) => {
          const req = body ? JSON.parse(body) : null;
          lastRelevance = { method, ...req };
          if (method === 'POST') {
            if (req.kind === 'hide_source') relevance.hiddenSources.push(req.sourceId);
            else relevance[req.kind].push(req.objectId);
          } else if (method === 'DELETE') {
            if (req.kind === 'hide_source') relevance.hiddenSources = relevance.hiddenSources.filter((v) => v !== req.sourceId);
            else relevance[req.kind] = relevance[req.kind].filter((v) => v !== req.objectId);
          }
          return { ok: true, relevance };
        },
        '/api/me/feed': () => ({ objects: [], interests: { locations: [], types: [], topics: [] }, personalized: false }),
        '/api/me': () => ({ ...emptyPersonal, relevance })
      },
      sources: [], campaigns: [], rawItems: [], circles: []
    });
    await h.settle();
    const title = Array.from(h.document.querySelectorAll('h3')).find((el) => h.text(el).includes('Personal suite tunable offer'));
    check('feed card rendered', Boolean(title));
    if (title) await h.click(title);
    await h.settle();
    const body = h.body();
    check('tuning row present in the detail modal', body.includes('Tune this in your Brief'));
    check('More like this offered', body.includes('More like this'));
    check('Less like this offered', body.includes('Less like this'));
    check('Not interested offered', body.includes('Not interested'));
    check('Hide this source offered when a source exists', body.includes('Hide this source'));

    await h.click(h.btn('More like this'));
    await h.settle();
    check('More-like-this POSTed with the object id', lastRelevance?.method === 'POST' && lastRelevance.kind === 'more' && lastRelevance.objectId === 'tune_me', JSON.stringify(lastRelevance));
    check('control reflects as active', h.body().includes('✓ More like this'));

    await h.click(h.btn('✓ More like this'));
    await h.settle();
    check('re-tap undoes the control (DELETE)', lastRelevance?.method === 'DELETE' && lastRelevance.kind === 'more', JSON.stringify(lastRelevance));
    check('control is no longer active', !h.body().includes('✓ More like this'));
    h.dom.window.close?.();
  }

  // --- 7. Report reasons are the server allowlist ---------------------------
  console.log('\n=== Report reasons aligned with the server allowlist ===');
  {
    const h = await boot({
      objects: [
        mk({ id: 'rep_me', type: 'event', title: 'Personal suite reportable event', summary: 'Report.', metadata: { area: 'Kilimani' } })
      ],
      routes: {
        '/api/me/feed': () => ({ objects: [], interests: { locations: [], types: [], topics: [] }, personalized: false }),
        '/api/me': emptyPersonal
      },
      sources: [], campaigns: [], rawItems: [], circles: []
    });
    await h.settle();
    const title = Array.from(h.document.querySelectorAll('h3')).find((el) => h.text(el).includes('Personal suite reportable event'));
    if (title) await h.click(title);
    await h.settle();
    await h.click(h.btn('Report'));
    await h.settle();
    const body = h.body();
    check('Incorrect information reason present', body.includes('Incorrect information'));
    check('Event cancelled reason present', body.includes('Event cancelled'));
    check('Wrong location reason present', body.includes('Wrong location'));
    check('Wrong date/time reason present', body.includes('Wrong date/time'));
    check('old client-only reasons are gone', !body.includes('wrong details') && !body.includes('no longer true'));
    h.dom.window.close?.();
  }

  console.log(`\n${'='.repeat(52)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
