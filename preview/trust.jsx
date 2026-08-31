// ---------------------------------------------------------------------------
// TRUST + VERIFICATION LAYER
//
// The trust brief surfaces, all derived from real fields the server projects
// (publishedAt, sourceNames/sourceCount/sourcePlatforms, temporal,
// verificationStatus, corrections, openReportCount):
//
//   * source display (Source · Nation / Sources · 3, channel kinds)
//   * freshness (Just now / 18 min ago / Today / Yesterday / 3 days ago)
//   * event verification (Published X ago, separate from Event tomorrow 8PM)
//   * corroboration (Confirmed across N sources — never "truth")
//   * expiry (expired offers, ended events, closed opportunities)
//   * corrections (original vs corrected shown honestly)
//   * report flag ("Reported for review" only when a real open report exists)
//   * share payload carries source/freshness/status
//   * the VERIFIED badge never claims more than the server's level supports
// ---------------------------------------------------------------------------
const { boot } = require('./harness.cjs');
const Mod = require('./src/App.tsx');

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

  // --- 1. Pure display helpers ---------------------------------------------
  console.log('\n=== Freshness: publication age, never invented ===');
  const fresh = (isoStr, now2) => Mod.getRelativeFreshness(isoStr, now2);
  check('Just now under a minute', fresh(iso(-30 * 1000), now) === 'Just now', fresh(iso(-30 * 1000), now) ?? 'null');
  check('18 min ago', fresh(iso(-18 * 60000), now) === '18 min ago', fresh(iso(-18 * 60000), now) ?? 'null');
  check('Today same day', fresh(iso(-5 * 3600000), now) === 'Today', fresh(iso(-5 * 3600000), now) ?? 'null');
  check('Yesterday', fresh(iso(-26 * 3600000), now) === 'Yesterday', fresh(iso(-26 * 3600000), now) ?? 'null');
  check('3 days ago', fresh(iso(-3 * 86400000), now) === '3 days ago', fresh(iso(-3 * 86400000), now) ?? 'null');
  check('older than a week falls back to a date', /^\d{4}-\d{2}-\d{2}$/.test(fresh(iso(-12 * 86400000), now) ?? ''), fresh(iso(-12 * 86400000), now) ?? 'null');
  check('missing timestamp -> null', fresh(null, now) === null && fresh(undefined, now) === null);
  check('garbage timestamp -> null', fresh('not-a-date', now) === null);

  console.log('\n=== Source display: real names, no internal ids ===');
  check('single source chip', Mod.getSourceChip(mk({ sourceNames: ['Nation'] })) === 'Source · Nation');
  check('multi-source chip', Mod.getSourceChip(mk({ sourceNames: ['Nation', 'Citizen'], sourceCount: 2 })) === 'Sources · 2');
  check('no provenance -> no chip', Mod.getSourceChip(mk({})) === null);
  check('channel kind chip', Mod.getSourceKindChip(mk({ sourcePlatforms: ['telegram_channel'] })) === 'Telegram');
  check('web kind chip', Mod.getSourceKindChip(mk({ sourcePlatforms: ['web'] })) === 'web');
  check('no platform -> null', Mod.getSourceKindChip(mk({})) === null);

  console.log('\n=== Corroboration: a count, explicitly not certainty ===');
  check('two sources', Mod.getCorroborationLabel(mk({ sourceCount: 2 })) === 'Confirmed across 2 sources');
  check('three sources', Mod.getCorroborationLabel(mk({ sourceCount: 3 })) === 'Confirmed across 3 sources');
  check('single source says nothing (no false corroboration)', Mod.getCorroborationLabel(mk({ sourceCount: 1 })) === null);
  check('community confirmations', Mod.getCorroborationLabel(mk({ verificationStatus: 'community_confirmed', confirmationCount: 3 })) === 'Confirmed by 3 people');
  check('no data -> null', Mod.getCorroborationLabel(mk({})) === null);

  console.log('\n=== Event verification: Published vs Event date ===');
  check('published line uses publication time', Mod.getPublishedLine(mk({ publishedAt: iso(-18 * 60000), createdAt: iso(-30 * 60000) }), now) === 'Published 18 min ago');
  check('no publishedAt falls back to createdAt', Mod.getPublishedLine(mk({ createdAt: iso(-5 * 3600000) }), now) === 'Published today');
  check('no timestamps -> null', Mod.getPublishedLine(mk({ createdAt: undefined })) === null);
  check('event preview today', Mod.getEventStartPreview(iso(3 * 3600000), now) === `Today · ${new Date(now.getTime() + 3 * 3600000).toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit' })}`);
  check('event preview tomorrow', Mod.getEventStartPreview(iso(20 * 3600000), now) === `Tomorrow · ${new Date(now.getTime() + 20 * 3600000).toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit' })}`);

  console.log('\n=== Expiry / stale: never presents expired as active ===');
  const offerExpired = Mod.getLifecycleBadge(mk({ type: 'offer', temporal: { status: 'expired' } }));
  check('expired offer flagged', offerExpired?.label === 'Expired' && offerExpired.expired === true);
  const offerActive = Mod.getLifecycleBadge(mk({ type: 'offer', temporal: { status: 'active' } }));
  check('active offer labelled active, not expired', offerActive?.label === 'Offer active' && offerActive.expired === false);
  const eventPast = Mod.getLifecycleBadge(mk({ type: 'event', temporal: { status: 'past' } }));
  check('past event ended', eventPast?.label === 'Ended' && eventPast.expired === true);
  const eventUpcoming = Mod.getLifecycleBadge(mk({ type: 'event', temporal: { status: 'upcoming', startsAt: iso(20 * 3600000) } }));
  check('upcoming event shows a preview, not a vague badge', Boolean(eventUpcoming?.label.includes('Tomorrow')), eventUpcoming?.label ?? 'null');
  const oppClosed = Mod.getLifecycleBadge(mk({ type: 'opportunity', temporal: { status: 'past' } }));
  check('closed opportunity flagged', oppClosed?.label === 'Closed' && oppClosed.expired === true);
  check('plain knowledge row says nothing', Mod.getLifecycleBadge(mk({ type: 'knowledge', temporal: { status: 'current' } })) === null);
  check('no temporal -> nothing claimed', Mod.getLifecycleBadge(mk({ type: 'offer' })) === null);

  console.log('\n=== Verification levels: the badge never oversells ===');
  check('unverified is NOT verified', Mod.objectFromServer({ verificationStatus: 'unverified' }).isVerified === false);
  check('single source is NOT dressed up as verified', Mod.objectFromServer({ verificationStatus: 'source_confirmed' }).isVerified === false);
  check('cross-source IS verified (corroborated)', Mod.objectFromServer({ verificationStatus: 'cross_source_confirmed' }).isVerified === true);
  check('community confirmed IS verified', Mod.objectFromServer({ verificationStatus: 'community_confirmed' }).isVerified === true);
  check('verificationStatus survives the mapping', Mod.objectFromServer({ verificationStatus: 'cross_source_confirmed' }).verificationStatus === 'cross_source_confirmed');
  check('corrections survive the mapping', Mod.objectFromServer({ corrections: [{ id: 'c1', field: 'venue', originalValue: 'A', correctedValue: 'B', reason: 'r', createdAt: iso(0) }] }).corrections?.length === 1);
  check('openReportCount survives the mapping', Mod.objectFromServer({ openReportCount: 2 }).openReportCount === 2);
  check('sourcePlatforms survive the mapping', Mod.objectFromServer({ sourcePlatforms: ['telegram_channel'] }).sourcePlatforms?.[0] === 'telegram_channel');

  // --- 2. Feed cards carry the compact trust row ---------------------------
  console.log('\n=== Feed cards: source + freshness + status ===');
  {
    const h = await boot({
      objects: [
        mk({
          type: 'news', title: 'Trust card nation', summary: 'A story.',
          sourceNames: ['Nation'], sourceCount: 1,
          publishedAt: iso(-2 * 3600000), createdAt: iso(-2 * 3600000)
        }),
        mk({
          type: 'offer', title: 'Trust card expired offer', summary: 'A deal.',
          sourceNames: ['Citizen', 'Nation'], sourceCount: 2,
          publishedAt: iso(-86400000), createdAt: iso(-86400000),
          temporal: { status: 'expired', deadlineAt: iso(-3600000) }
        }),
        mk({
          type: 'event', title: 'Trust card upcoming event', summary: 'A gig.',
          sourceNames: [], publishedAt: iso(-3600000), createdAt: iso(-3600000),
          temporal: { status: 'upcoming', startsAt: iso(20 * 3600000) }
        })
      ],
      routes: {},
      sources: [],
      campaigns: [],
      rawItems: [],
      circles: []
    });
    const body = h.body();
    check('single-source card shows Source · Nation', body.includes('Source · Nation'), body.slice(0, 200));
    check('expired offer card shows Sources · 2', body.includes('Sources · 2'));
    check('expired offer card shows Expired', body.includes('Expired'));
    check('upcoming event card shows tomorrow preview', body.includes('Tomorrow'));
    check('news card shows published freshness', body.includes('Published today'), body.slice(0, 300));
    h.dom.window.close?.();
  }

  // --- 3. Detail: About this information ------------------------------------
  console.log('\n=== Detail: About this information ===');
  {
    const h = await boot({
      objects: [
        mk({
          type: 'news', title: 'Trust detail story', summary: 'Details.',
          sourceNames: ['Nation', 'Citizen'], sourceCount: 2,
          sourcePlatforms: ['web'],
          publishedAt: iso(-18 * 60000), createdAt: iso(-18 * 60000),
          sourceUrl: 'https://example.com/story',
          temporal: { status: 'current' },
          verificationStatus: 'cross_source_confirmed',
          openReportCount: 1,
          corrections: [{ id: 'c1', field: 'venue', isMeta: true, originalValue: 'Old Hall', correctedValue: 'New Hall', reason: 'typo', createdAt: iso(-86400000) }]
        })
      ],
      routes: {},
      sources: [], campaigns: [], rawItems: [], circles: []
    });
    // Open the detail modal by clicking the feed card (same funnel as the app).
    // The card title lives in an <h3>; a click on it bubbles to the card's
    // onClick exactly like a real tap.
    const cardTitle = Array.from(h.document.querySelectorAll('h3'))
      .find((el) => h.text(el).includes('Trust detail story'));
    check('feed card rendered', Boolean(cardTitle));
    if (cardTitle) await h.click(cardTitle);
    const body = h.body();
    check('About this information block present', body.includes('About this information'));
    check('source names shown', body.includes('From Nation, Citizen'));
    check('corroboration shown as count', body.includes('Confirmed across 2 sources'));
    check('published freshness shown', body.includes('Published 18 min ago'));
    check('corrected field shows original and new value', body.includes('was “Old Hall”, now “New Hall”'));
    check('open report flags the object', body.includes('Reported for review'));
    check('source link present', body.includes('Source'));
    h.dom.window.close?.();
  }

  // --- 4. Share payload carries the trust facts ----------------------------
  console.log('\n=== Share: source, freshness, status ===');
  {
    const obj = mk({
      type: 'offer', title: 'Share me', category: 'Offer',
      sourceNames: ['Citizen'], sourceCount: 1,
      publishedAt: iso(-5 * 3600000), createdAt: iso(-5 * 3600000),
      temporal: { status: 'expired', deadlineAt: iso(-3600000) }
    });
    const chip = Mod.getSourceChip(obj);
    const published = Mod.getPublishedLine(obj);
    const life = Mod.getLifecycleBadge(obj);
    check('share source line exists', chip?.replace(/^Source · /, 'Source: ') === 'Source: Citizen');
    check('share published line exists', published === 'Published today');
    check('share status line says Expired', life?.label === 'Expired');
  }

  console.log(`\n${'='.repeat(52)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
