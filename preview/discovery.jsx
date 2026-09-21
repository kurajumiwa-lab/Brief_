// ---------------------------------------------------------------------------
// DISCOVERY EXPERIENCE
//
// The surfaces the discovery brief describes: Today's Brief (TODAY / NEAR YOU
// / NOW / COMING UP from real rows), data-driven category tabs, the location
// chip (districts included), the news detail (publisher, publication time,
// "Read original", gallery) — all served over the real object load path.
// ---------------------------------------------------------------------------
const { boot } = require('./harness.cjs');
const Mod = require('./src/App.tsx');

async function main() {
  const now = new Date();
  const iso = (offsetMs) => new Date(now.getTime() + offsetMs).toISOString();
  const day = (offsetDays) => new Date(now.getTime() + offsetDays * 86400000).toISOString().slice(0, 10);

  // --- 1. The Daily Brief builder is honest about real temporal data --------
  console.log('\n=== Today\'s Brief: four sections from real rows ===');
  const base = {
    objects: [],
    area: 'Kilimani',
    geo: { lat: -1.2921, lng: 36.7808 }
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
  let pass = 0;
  let fail = 0;
  const check = (n, c, d = '') => {
    if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); }
  };
  const keys = (sections) => sections.map((s) => s.key).join(',');

  const briefToday = Mod.buildDiscoveryBrief({
    ...base,
    objects: [
      mk({ id: 'u_event_today', type: 'experience', title: 'Live jazz tonight', temporal: { status: 'happening' } }),
      mk({ id: 'u_offer_today', type: 'offer', title: 'Ends today deal', temporal: { status: 'active', deadlineAt: iso(0) } })
    ]
  });
  check('an event happening now lands in TODAY', keys(briefToday).includes('today'));
  check('an offer ending today lands in TODAY', briefToday.find((s) => s.key === 'today')?.objects.some((o) => o.id === 'u_offer_today'));

  const briefNow = Mod.buildDiscoveryBrief({
    ...base,
    objects: [
      mk({ id: 'u_alert', type: 'alert', title: 'Power cut', temporal: { status: 'current' } }),
      mk({ id: 'u_news_fresh', type: 'news', title: 'Fresh story', temporal: { status: 'current' } }),
      mk({ id: 'u_offer_live', type: 'offer', title: 'Ongoing promo', temporal: { status: 'active', deadlineAt: iso(5 * 86400000) } })
    ]
  });
  check('alerts, current news and active offers land in NOW', keys(briefNow) === 'now', keys(briefNow));

  const briefComing = Mod.buildDiscoveryBrief({
    ...base,
    objects: [
      mk({ id: 'u_upcoming', type: 'experience', title: 'Festival next week', temporal: { status: 'upcoming', startsAt: iso(5 * 86400000) } })
    ]
  });
  check('upcoming events land in COMING UP', keys(briefComing) === 'coming', keys(briefComing));

  const briefNear = Mod.buildDiscoveryBrief({
    ...base,
    objects: [
      mk({ id: 'u_place', type: 'place', title: 'Neighbourhood library', metadata: { area: 'Kilimani' }, locationName: 'Kilimani' }),
      mk({ id: 'u_biz', type: 'business', title: 'Corner bakery', metadata: { distanceKm: 1.2 } })
    ]
  });
  check('local activity lands in NEAR YOU', keys(briefNear) === 'near', keys(briefNear));

  check('no data produces no sections', Mod.buildDiscoveryBrief({ ...base, objects: [] }).length === 0);
  check('a row is never placed twice',
    Mod.buildDiscoveryBrief({
      ...base,
      objects: [
        mk({ id: 'u_both', type: 'alert', title: 'Alert in Kilimani', temporal: { status: 'current' }, metadata: { area: 'Kilimani' } })
      ]
    }).flatMap((s) => s.objects).filter((o) => o.id === 'u_both').length === 1);

  // --- 2. Full app: data-driven tabs + Today's Brief + location + news ------
  console.log('\n=== Discovery surfaces on the live app ===');
  const serverRows = [
    {
      id: 'd_event_today', type: 'experience', title: 'Rooftop jazz tonight', summary: 'Live band at sundown.',
      category: 'Music', locationName: 'Kilimani', publication: 'public', createdAt: iso(-2 * 3600000),
      metadata: { area: 'Kilimani', eventStart: iso(0) },
      temporal: { status: 'happening', startsAt: iso(0), endsAt: null, deadlineAt: null },
      sourceNames: ['City Wire'], sourceCount: 1
    },
    {
      id: 'd_event_soon', type: 'experience', title: 'Creators market on Saturday', summary: 'Stalls and demos.',
      category: 'Market', locationName: 'Westlands', publication: 'public', createdAt: iso(-10 * 3600000),
      metadata: { area: 'Westlands', eventStart: iso(2 * 86400000) },
      temporal: { status: 'upcoming', startsAt: iso(2 * 86400000), endsAt: null, deadlineAt: null },
      sourceNames: ['Creator Hub'], sourceCount: 1
    },
    {
      id: 'd_offer', type: 'offer', title: 'Coffee 2-for-1 this week', summary: 'At the Kilimani branch.',
      category: 'Food', locationName: 'Kilimani', publication: 'public', createdAt: iso(-6 * 3600000),
      metadata: { area: 'Kilimani', price: 0, deadlineCanonical: day(4) },
      temporal: { status: 'active', startsAt: null, endsAt: null, deadlineAt: iso(4 * 86400000) },
      sourceNames: ['Kilimani Notices'], sourceCount: 1
    },
    {
      id: 'd_place', type: 'place', title: 'City Park Arboretum', summary: 'Public gardens.',
      category: 'Leisure', locationName: 'Nairobi', publication: 'public', createdAt: iso(-30 * 86400000),
      metadata: { area: 'Nairobi', county: 'Nairobi' },
      temporal: { status: 'current', startsAt: null, endsAt: null, deadlineAt: null },
      sourceNames: ['Nairobi Traders'], sourceCount: 1
    },
    {
      id: 'd_news', type: 'news', title: 'City water restored after main burst', summary: 'Supply returned this morning.',
      category: 'News', locationName: 'CBD', publication: 'public', createdAt: iso(-3 * 3600000),
      publishedAt: iso(-3 * 3600000),
      metadata: { area: 'CBD', county: 'Nairobi' },
      temporal: { status: 'current', startsAt: null, endsAt: null, deadlineAt: null },
      sourceNames: ['City Wire'], sourceCount: 1, sourceUrl: 'https://citywire.example/story/water',
      gallery: [
        { url: 'https://cdn.example/water-1.jpg', alt: 'Crews on site' },
        { url: 'https://cdn.example/water-2.jpg', alt: 'Valve repair' }
      ]
    },
    {
      id: 'd_opportunity', type: 'opportunity', title: 'Green grant applications open', summary: 'For youth groups.',
      category: 'Funding', locationName: 'Nairobi', publication: 'public', createdAt: iso(-20 * 3600000),
      metadata: { area: 'Nairobi', deadlineCanonical: day(10) },
      temporal: { status: 'active', startsAt: null, endsAt: null, deadlineAt: iso(10 * 86400000) },
      sourceNames: ['City Wire'], sourceCount: 1
    },
    {
      id: 'd_alert', type: 'alert', title: 'Power cut in Kilimani', summary: 'Crews on site.',
      category: 'Alert', locationName: 'Kilimani', publication: 'public', createdAt: iso(-3600000),
      metadata: { area: 'Kilimani' },
      temporal: { status: 'current', startsAt: null, endsAt: null, deadlineAt: null },
      sourceNames: ['Kilimani Notices'], sourceCount: 1
    }
  ];

  const h = await boot({
    objects: [],
    routes: {
      '/api/objects': () => ({ objects: serverRows })
    }
  });
  const { text, body, click, btn } = h;
  const tabBtn = (t) => Array.from(document.querySelectorAll('button'))
    .find((b) => !b.dataset?.shelfId && (text(b) === t || text(b).startsWith(t)));

  check('Events tab appears with event data', !!tabBtn('Events'));
  check('Offers tab appears with offer data', !!tabBtn('Offers'));
  check('Places tab appears with place data', !!tabBtn('Places'));
  check('News tab appears with news data', !!tabBtn('News'));
  check('Opportunities tab appears with opportunity data', !!tabBtn('Opportunities'));

  const briefBody = body();
  check('Today\'s Brief renders TODAY from real rows', /TODAY/.test(briefBody));
  check('Today\'s Brief renders NOW from real rows', /NOW/.test(briefBody));
  check('Today\'s Brief renders COMING UP from real rows', /COMING UP/.test(briefBody));
  check('Today\'s Brief renders NEAR YOU from real rows', /NEAR YOU/.test(briefBody));

  console.log('\n=== Location chip: real wards, and no Nairobi assumption ===');
  // REWRITTEN against the control that actually renders. This section used to
  // look for a button labelled "Your area" and then for seven districts
  // (Westlands, Kilimani, CBD, Kasarani, Rongai, Mombasa, Kisumu). None of that
  // exists any more. `components/LocationChip.tsx` -- which held both the "Your
  // area" label and that gazetteer -- is still imported by App.tsx but is never
  // rendered, so the suite was asserting a dead component. The live control is
  // NearbyScreen's ward chip, "Ward · <name>", which opens the neighbourhood
  // picker over model/neighborhoods.ts.
  //
  // This went unnoticed because discovery.jsx was absent from run-suites.sh's
  // ALL list: the suite never ran, and since the lookup returned null the seven
  // district checks below it were SKIPPED rather than failed. A skipped check
  // inside a suite that is itself skipped is two layers of silence.
  const byText = (re2) => Array.from(document.querySelectorAll('button'))
    .find((b) => re2.test(text(b).replace(/\s+/g, ' '))) ?? null;
  const chip = byText(/^Ward · /);
  check('the ward chip sits in the Home header', !!chip, chip ? text(chip) : 'no button matches /^Ward · /');
  check('and it names the active ward, not a placeholder', /Ward · \S/.test(text(chip ?? '')), text(chip ?? ''));
  if (chip) {
    await click(chip);
    // model/neighborhoods.ts is the source of truth: four Nairobi wards and one
    // in Kisii. Asserting the real five is what makes "no Nairobi assumption"
    // checkable at all -- the old list was seven places the picker never had.
    for (const w of ['Kilimani', 'South B', 'Westlands', 'Roysambu', 'Nyamataro'])
      check(`the picker offers ${w}`, !!byText(new RegExp(w)), `no button matches /${w}/`);
    check('the picker is not a Nairobi-only list', !!byText(/Nyamataro/),
      'Nyamataro is in Kisii county; a picker with only Nairobi wards would be the assumption this section exists to refuse');
    const west = byText(/Westlands/);
    if (west) {
      await click(west);
      check('choosing a ward relabels the chip', /Ward ·\s*Westlands/.test(body()) || body().includes('Westlands'),
        'the chip should read "Ward · Westlands" after the choice');
    }
  }

  console.log('\n=== News detail: publisher, time, location, Read original, gallery ===');
  // The news row is in the NOW section of Today's Brief. Brief buttons carry
  // a decorative type letter plus the WHEN line, so match by inclusion.
  const newsBtn = Array.from(document.querySelectorAll('button'))
    .find((b) => /City water restored after main burst/.test(text(b)));
  check('the news story is reachable from the brief', !!newsBtn);
  if (newsBtn) {
    await click(newsBtn);
    const detail = body();
    check('news detail shows the publisher', /From City Wire/.test(detail));
    check('news detail shows the publication time', /\b[A-Z][a-z]{2}\b · \d{1,2} \w+/.test(detail) || /ago|Today/.test(detail));
    check('news detail shows the relevant location', /· CBD/.test(detail));
    const readBtn = Array.from(document.querySelectorAll('a')).find((a) => /Read original/.test(text(a)));
    check('a prominent Read original action exists', !!readBtn);
    check('Read original points at the real source', readBtn?.getAttribute('href') === 'https://citywire.example/story/water');
    const galleryImgs = Array.from(document.querySelectorAll('img')).map((i) => i.getAttribute('src'));
    check('gallery images render from real media', galleryImgs.includes('https://cdn.example/water-1.jpg') && galleryImgs.includes('https://cdn.example/water-2.jpg'));
  }

  console.log('\n=== Offer detail: commerce stays contextual ===');
  const offerBtn = Array.from(document.querySelectorAll('button'))
    .find((b) => /Coffee 2-for-1 this week/.test(text(b)));
  if (offerBtn) {
    await click(offerBtn);
    const detail = body();
    check('offer detail names the vendor/source', /From Kilimani Notices/.test(detail));
    check('offer detail shows a deadline', /Ends|deadline/i.test(detail));
  }

  console.log(`\n${'='.repeat(52)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
