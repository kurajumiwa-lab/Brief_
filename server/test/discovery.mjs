// ---------------------------------------------------------------------------
// DISCOVERY INTELLIGENCE TEST SUITE
//
// The unified Brief feed must rank and present ingested information
// intelligently. This suite pins the behaviours that make it so:
//
//   freshness, upcoming/expired events, active/expired offers, alert
//   priority, locality ranking (named area + coordinates, no invented or
//   hardcoded city), source diversity, extraction confidence, cross-source
//   duplicate presentation, pagination and visibility/privacy.
//
//   node test/discovery.mjs
// ---------------------------------------------------------------------------

import fs from 'node:fs';

process.env.NODE_ENV = 'test';
process.env.BRIEF_DATA_DIR = `/tmp/brief-discovery-${process.pid}`;
fs.rmSync(process.env.BRIEF_DATA_DIR, { recursive: true, force: true });

const { store } = await import('../src/store.js');
const discovery = await import('../src/domain/discovery.js');

store._reset();

let pass = 0;
let fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`); }
};

const HOUR = 3600000;
const DAY = 86400000;
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();
const day = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

let seq = 0;
/** Insert a fixture object with the shape the pipeline writes. */
function makeObject(o = {}) {
  seq += 1;
  return store.insert('objects', {
    id: o.id ?? `t_obj_${seq}`,
    type: 'knowledge',
    title: `Test object ${seq}`,
    summary: 'A fixture row for discovery tests.',
    locationName: null,
    metadata: {},
    publication: 'public',
    verificationStatus: 'unverified',
    extractionConfidence: 0.7,
    extractionEvidence: [],
    isFixture: false,
    createdAt: iso(0),
    updatedAt: iso(0),
    ...o
  });
}

function attachSource(objectId, sourceId, extra = {}) {
  return store.insert('objectSources', {
    id: `os_${objectId}_${sourceId}`,
    objectId,
    sourceId,
    rawItemId: `raw_${objectId}_${sourceId}`,
    sourceConfidence: 0.5,
    extractionConfidence: 0.7,
    createdAt: iso(0),
    ...extra
  });
}

function makeSource(id, name, platform) {
  return store.insert('sources', {
    id,
    name,
    type: platform,
    platform,
    url: null,
    externalId: null,
    accessType: 'public',
    connectionStatus: 'connected',
    confidence: 0.5,
    createdAt: iso(0),
    updatedAt: iso(0)
  });
}

const indexOf = (list, id) => list.findIndex((o) => o.id === id);
const byId = (list, id) => list.find((o) => o.id === id) ?? null;

console.log('\n=== DISCOVERY: freshness ===');
{
  const old = makeObject({ type: 'news', title: 'Old news item', createdAt: iso(-10 * DAY) });
  const fresh = makeObject({ type: 'news', title: 'Fresh news item', createdAt: iso(-2 * HOUR) });
  const list = discovery.discoverable({ limit: 50, publication: 'public' });
  check('fresher news outranks older news at equal confidence',
    indexOf(list, fresh.id) >= 0 && indexOf(list, fresh.id) < indexOf(list, old.id));
  const temporal = byId(list, fresh.id)?.temporal;
  check('every feed object carries a temporal signal', Boolean(temporal) && typeof temporal.status === 'string');
  check('a plain news item is status current', temporal?.status === 'current');
}

console.log('\n=== DISCOVERY: upcoming events ===');
{
  const tomorrow = makeObject({
    type: 'experience', title: 'Event tomorrow',
    createdAt: iso(-HOUR),
    metadata: { eventStart: `${day(1)}T18:00:00`, eventEnd: `${day(1)}T21:00:00` }
  });
  const nextMonth = makeObject({
    type: 'experience', title: 'Event next month',
    createdAt: iso(-HOUR),
    metadata: { eventStart: `${day(31)}T18:00:00` }
  });
  const undated = makeObject({
    type: 'experience', title: 'Undated workshop',
    createdAt: iso(-HOUR),
    metadata: { dayOfWeek: 'saturday' }
  });
  const list = discovery.discoverable({ limit: 50, publication: 'public' });
  check('event tomorrow is promoted over event next month',
    indexOf(list, tomorrow.id) >= 0 && indexOf(list, tomorrow.id) < indexOf(list, nextMonth.id));
  check('an undated event stays discoverable', indexOf(list, undated.id) >= 0);
  const t = byId(list, undated.id)?.temporal;
  check('an undated event is not pretending to have a date',
    t?.status === 'undated' && t?.startsAt === null && t?.endsAt === null);
  check('event tomorrow is status upcoming with a real start',
    byId(list, tomorrow.id)?.temporal?.status === 'upcoming' && byId(list, tomorrow.id)?.temporal?.startsAt !== null);
}

console.log('\n=== DISCOVERY: expired events ===');
{
  const yesterday = makeObject({
    type: 'experience', title: 'Event yesterday',
    createdAt: iso(-2 * DAY),
    metadata: { eventStart: `${day(-1)}T18:00:00`, eventEnd: `${day(-1)}T21:00:00` }
  });
  const freshNews = makeObject({ type: 'news', title: 'Today news', createdAt: iso(-HOUR) });
  const list = discovery.discoverable({ limit: 50, publication: 'public' });
  const t = byId(list, yesterday.id)?.temporal;
  check('a past event is marked past, not upcoming', t?.status === 'past');
  check('a past event is no longer promoted above fresh content',
    indexOf(list, yesterday.id) > indexOf(list, freshNews.id));
  check('the past event row is not deleted from history',
    store.find('objects', (o) => o.id === yesterday.id) !== null);
}

console.log('\n=== DISCOVERY: active/expired offers ===');
{
  const active = makeObject({
    type: 'offer', title: 'Offer with a future deadline',
    metadata: { deadline: 'Friday', deadlineCanonical: day(2) }
  });
  const standing = makeObject({ type: 'offer', title: 'Standing offer, no deadline' });
  const expired = makeObject({
    type: 'offer', title: 'Offer past its deadline',
    metadata: { deadline: 'Last week', deadlineCanonical: day(-1) }
  });
  const list = discovery.discoverable({ limit: 50, publication: 'public' });
  check('an offer with a future deadline is active and present',
    byId(list, active.id)?.temporal?.status === 'active');
  check('a deadline offer outranks a standing offer',
    indexOf(list, active.id) >= 0 && indexOf(list, active.id) < indexOf(list, standing.id));
  check('an offer past its deadline is excluded from the default feed',
    indexOf(list, expired.id) === -1);
  check('no expiry was invented for the standing offer',
    byId(list, standing.id)?.temporal?.deadlineAt === null);
  const withExpired = discovery.discoverable({ limit: 50, publication: 'public', includeExpired: true });
  check('includeExpired brings the expired offer back (findable, not deleted)',
    byId(withExpired, expired.id)?.temporal?.status === 'expired');
  check('the expired offer row survives in the store',
    store.find('objects', (o) => o.id === expired.id) !== null);
}

console.log('\n=== DISCOVERY: alert priority ===');
{
  const freshAlert = makeObject({ type: 'alert', title: 'Water outage alert', createdAt: iso(-2 * HOUR) });
  const oldEvergreen = makeObject({ type: 'place', title: 'Aged place listing', createdAt: iso(-60 * DAY) });
  const oldAlert = makeObject({ type: 'alert', title: 'Old alert from last week', createdAt: iso(-10 * DAY) });
  const list = discovery.discoverable({ limit: 50, publication: 'public' });
  check('a fresh alert is not buried under old evergreen content',
    indexOf(list, freshAlert.id) >= 0 && indexOf(list, freshAlert.id) < indexOf(list, oldEvergreen.id));
  check('an old alert no longer dominates the feed',
    indexOf(list, oldAlert.id) > indexOf(list, freshAlert.id));
}

console.log('\n=== DISCOVERY: locality ranking ===');
{
  const kisumuEvent = makeObject({
    type: 'experience', title: 'Kisumu night market',
    locationName: 'Milimani, Kisumu',
    metadata: { county: 'Kisumu', area: 'Milimani', locationConfidence: 0.8, eventStart: `${day(3)}T18:00:00` }
  });
  const nairobiEvent = makeObject({
    type: 'experience', title: 'Nairobi tech meetup',
    locationName: 'Kilimani, Nairobi',
    metadata: { county: 'Nairobi', area: 'Kilimani', locationConfidence: 0.8, eventStart: `${day(3)}T18:00:00` }
  });

  const neutral = discovery.discoverable({ limit: 50, publication: 'public' });
  const kScore = byId(neutral, kisumuEvent.id)?.score;
  const nScore = byId(neutral, nairobiEvent.id)?.score;
  // The rows were created microseconds apart, so their age scores differ at
  // ~1e-9; anything larger than that would mean locality leaked in.
  check('without a user locality no city is assumed or hardcoded',
    Math.abs((kScore ?? 0) - (nScore ?? 0)) < 1e-6, `k=${kScore} n=${nScore}`);

  const kisumuView = discovery.discoverable({ limit: 50, publication: 'public', area: 'Kisumu' });
  check('a named county promotes its local content',
    indexOf(kisumuView, kisumuEvent.id) >= 0 && indexOf(kisumuView, kisumuEvent.id) < indexOf(kisumuView, nairobiEvent.id));

  const kilimaniView = discovery.discoverable({ limit: 50, publication: 'public', area: 'Kilimani' });
  check('area matching works for neighbourhoods, not one fixed city',
    indexOf(kilimaniView, nairobiEvent.id) >= 0 && indexOf(kilimaniView, nairobiEvent.id) < indexOf(kilimaniView, kisumuEvent.id));

  const lowConf = makeObject({
    type: 'experience', title: 'Event with fuzzy location',
    locationName: 'Kisumu somewhere',
    metadata: { county: 'Kisumu', locationConfidence: 0.3, eventStart: `${day(3)}T18:00:00` }
  });
  const lowView = discovery.discoverable({ limit: 50, publication: 'public', area: 'Kisumu' });
  check('low-confidence location extraction earns a smaller locality boost',
    indexOf(lowView, kisumuEvent.id) >= 0 && indexOf(lowView, kisumuEvent.id) < indexOf(lowView, lowConf.id));

  // Coordinates: within-radius first, distance surfaced.
  const nearKisumu = { lat: -0.1022, lng: 34.7617 };
  const coordsKisumu = makeObject({ type: 'offer', title: 'Kisumu offer', metadata: { lat: -0.1022, lng: 34.7617 } });
  const coordsNairobi = makeObject({ type: 'offer', title: 'Nairobi offer', metadata: { lat: -1.2864, lng: 36.8172 } });
  const geo = discovery.discoverable({ near: nearKisumu, radiusKm: 20, limit: 50, publication: 'public' });
  check('objects near the supplied point rank before far ones',
    indexOf(geo, coordsKisumu.id) >= 0 && indexOf(geo, coordsKisumu.id) < indexOf(geo, coordsNairobi.id));
  check('geo results carry distanceKm', byId(geo, coordsKisumu.id)?.distanceKm !== null);
}

console.log('\n=== DISCOVERY: source diversity ===');
{
  const flood = makeSource('src_flood', 'Flood Channel', 'telegram');
  const wire = makeSource('src_wire', 'Fresh Wire', 'rss');

  // 30 distinct items from one source, all freshly created.
  const topics = ['fashion', 'food', 'art', 'tech', 'furniture', 'beauty', 'crafts', 'books', 'wellness', 'gaming'];
  const floodIds = [];
  for (let i = 0; i < 30; i++) {
    const obj = makeObject({
      id: `flood_${i}`,
      type: 'announcement',
      title: `Unique listing: ${topics[i % 10]} stall ${i} clearance`,
      createdAt: iso(-HOUR)
    });
    attachSource(obj.id, flood.id);
    floodIds.push(obj.id);
  }
  const wireIds = [];
  for (let i = 0; i < 5; i++) {
    const obj = makeObject({
      id: `wire_${i}`,
      type: 'news',
      title: `Fresh wire story number ${i} this week`,
      createdAt: iso(-HOUR)
    });
    attachSource(obj.id, wire.id);
    wireIds.push(obj.id);
  }

  const feed = discovery.discoverable({ limit: 20, publication: 'public' });
  const top20 = feed.slice(0, 20);
  const floodInTop = top20.filter((o) => discovery.sourcesOf(o).some((s) => s.id === flood.id)).length;
  const wireInTop = top20.filter((o) => discovery.sourcesOf(o).some((s) => s.id === wire.id)).length;
  check('one source cannot flood the top of the feed (<= 40%)',
    floodInTop <= 8, `flood items in top 20: ${floodInTop}`);
  check('fresh items from other sources reach the top', wireInTop >= 2, `wire items in top 20: ${wireInTop}`);

  // And the whole stream is still bounded in source share.
  const all = discovery.discoverable({ limit: 50, publication: 'public' });
  const floodInAll = all.slice(0, 30).filter((o) => discovery.sourcesOf(o).some((s) => s.id === flood.id)).length;
  check('the diversity cap holds on longer pages too', floodInAll <= 12, `flood in first 30: ${floodInAll}`);
}

console.log('\n=== DISCOVERY: confidence ===');
{
  const structured = makeObject({
    type: 'announcement', title: 'Structured notice with full evidence',
    createdAt: iso(-5 * DAY), extractionConfidence: 0.9
  });
  const sloppy = makeObject({
    type: 'announcement', title: 'Sloppy late notice',
    createdAt: iso(-HOUR), extractionConfidence: 0.2
  });
  const list = discovery.discoverable({ limit: 50, publication: 'public' });
  check('low-confidence late items do not outrank clearly structured evidence',
    indexOf(list, structured.id) >= 0 && indexOf(list, structured.id) < indexOf(list, sloppy.id),
    `structured=${indexOf(list, structured.id)} sloppy=${indexOf(list, sloppy.id)}`);
}

console.log('\n=== DISCOVERY: cross-source duplicate presentation ===');
{
  // Isolate so clustering sees exactly this story set (deterministic).
  store._reset();
  seq = 0;
  const tgram = makeSource('src_dup_tg', 'Neighbourhood Telegram', 'telegram');
  const feed = makeSource('src_dup_rss', 'City RSS Wire', 'rss');
  const web = makeSource('src_dup_web', 'Local News Web', 'webpage');

  // The same story retained by the database from three sources as three rows
  // (e.g. rows that entered outside the ingestion merge path).
  const a = makeObject({
    id: 'dup_a', type: 'experience', title: 'Kilimani night market this Saturday',
    locationName: 'Prestige Plaza', createdAt: iso(-2 * HOUR),
    metadata: { area: 'Kilimani', dayOfWeek: 'saturday' }
  });
  const b = makeObject({
    id: 'dup_b', type: 'experience', title: 'Night market at Kilimani this Saturday',
    locationName: 'Prestige Plaza', createdAt: iso(-2 * HOUR),
    metadata: { area: 'Kilimani', dayOfWeek: 'saturday' }
  });
  const c = makeObject({
    id: 'dup_c', type: 'experience', title: 'Kilimani night market this Saturday',
    locationName: 'Prestige Plaza', createdAt: iso(-2 * HOUR),
    metadata: { area: 'Kilimani', dayOfWeek: 'saturday' }
  });
  attachSource(a.id, tgram.id);
  attachSource(b.id, feed.id);
  attachSource(c.id, web.id);

  const list = discovery.discoverable({ limit: 50, publication: 'public' });
  const visible = list.filter((o) => ['dup_a', 'dup_b', 'dup_c'].includes(o.id));
  check('the same story shows once, not as three cards', visible.length === 1, `visible=${visible.length}`);
  const card = visible[0];
  check('the visible card keeps the union of provenance',
    card?.sourceCount === 3 && Array.isArray(card?.sourceNames) && card.sourceNames.length === 3,
    JSON.stringify(card ? { sourceCount: card.sourceCount, sourceNames: card.sourceNames } : null));
  check('the card reports how many source rows it represents', card?.clusterSize === 3);
  check('the underlying rows are not destroyed (provenance retained)',
    store.find('objects', (o) => o.id === 'dup_a') !== null &&
    store.find('objects', (o) => o.id === 'dup_b') !== null &&
    store.find('objects', (o) => o.id === 'dup_c') !== null);

  // Distinct stories at the same venue/date must NOT collapse.
  const other = makeObject({
    id: 'other_market', type: 'experience', title: 'Jazz evening at Kilimani this Saturday',
    locationName: 'Prestige Plaza', createdAt: iso(-2 * HOUR),
    metadata: { area: 'Kilimani', dayOfWeek: 'saturday' }
  });
  const list2 = discovery.discoverable({ limit: 50, publication: 'public' });
  const visible2 = list2.filter((o) => ['dup_a', 'dup_b', 'dup_c', 'other_market'].includes(o.id));
  check('a genuinely different event at the same venue/date stays a separate card',
    visible2.length === 2, `visible=${visible2.length}`);
}

console.log('\n=== DISCOVERY: near-identical flood from one source ===');
{
  const spam = makeSource('src_spam', 'Spammy Channel', 'telegram');
  const ids = [];
  for (let i = 0; i < 30; i++) {
    const obj = makeObject({
      id: `spam_${i}`,
      type: 'offer',
      title: `Deal alert ${i} from one channel — same event reposted`,
      createdAt: iso(-HOUR),
      metadata: { area: 'Kawangware', dateCanonical: day(3) }
    });
    attachSource(obj.id, spam.id);
    ids.push(obj.id);
  }
  const list = discovery.discoverable({ limit: 50, publication: 'public' });
  const visible = list.filter((o) => ids.includes(o.id));
  check('30 near-identical reposts collapse to one visible card', visible.length === 1, `visible=${visible.length}`);
  check('the collapsed card says how many rows it represents', visible[0]?.clusterSize === 30);
}

console.log('\n=== DISCOVERY: pagination ===');
{
  // Isolate: pagination counts must reflect exactly the rows in this section.
  store._reset();
  seq = 0;
  const pageIds = [];
  for (let i = 0; i < 12; i++) {
    const obj = makeObject({ id: `page_${i}`, type: 'news', title: `Pagination item ${i}`, createdAt: iso(-(i + 1) * HOUR) });
    pageIds.push(obj.id);
  }
  const p1 = discovery.discoverableStream({ limit: 5, offset: 0, publication: 'public' });
  const p2 = discovery.discoverableStream({ limit: 5, offset: 5, publication: 'public' });
  const p3 = discovery.discoverableStream({ limit: 5, offset: 10, publication: 'public' });
  check('page 1 returns exactly limit items', p1.objects.length === 5);
  check('the stream reports the total before paging', p1.total === 12 && p2.total === 12 && p3.total === 12, `totals ${p1.total}/${p2.total}/${p3.total}`);
  check('pages do not overlap', p1.objects.every((o) => !p2.objects.some((x) => x.id === o.id)));
  check('paging walks the same ranked order',
    p2.objects.every((o) => p1.objects.every((x) => x.score >= o.score)) &&
    p3.objects.every((o) => p2.objects.every((x) => x.score >= o.score)),
    `scores p1=${p1.objects.map((o) => o.score.toFixed(2)).join(',')} p2=${p2.objects.map((o) => o.score.toFixed(2)).join(',')} p3=${p3.objects.map((o) => o.score.toFixed(2)).join(',')}`);
  check('the last page is short and complete', p3.objects.length === 2);
  check('offset beyond the end returns an empty page', discovery.discoverableStream({ limit: 5, offset: 50, publication: 'public' }).objects.length === 0);
}

console.log('\n=== DISCOVERY: visibility and privacy ===');
{
  // Isolate so the feed contains exactly these four rows.
  store._reset();
  seq = 0;
  const pub = makeObject({ id: 'vis_pub', type: 'news', title: 'Public story' });
  const members = makeObject({ id: 'vis_members', type: 'news', title: 'Members-only story', publication: 'source_members' });
  const priv = makeObject({ id: 'vis_priv', type: 'news', title: 'Private story', publication: 'private' });
  const removed = makeObject({ id: 'vis_removed', type: 'news', title: 'Removed story', publication: 'removed' });
  const list = discovery.discoverable({ limit: 50, publication: 'public' });
  check('public rows are discoverable', indexOf(list, pub.id) >= 0);
  check('source_members rows never leak into the public feed', indexOf(list, members.id) === -1);
  check('private rows never leak into the public feed', indexOf(list, priv.id) === -1);
  check('removed rows are excluded everywhere', indexOf(list, removed.id) === -1);
  const allVisible = discovery.discoverable({ limit: 50 });
  check('removed rows are excluded even without a publication filter', indexOf(allVisible, removed.id) === -1);
}

console.log('\n=== DISCOVERY: public feed HTTP contract ===');
{
  // Isolate: the HTTP walk sees exactly the rows it seeds.
  store._reset();
  seq = 0;
  const tgram = makeSource('src_http_tg', 'HTTP Telegram', 'telegram');
  const membersSrc = makeSource('src_http_members', 'Members Channel', 'telegram');

  for (let i = 0; i < 6; i++) {
    const obj = makeObject({
      id: `http_obj_${i}`,
      type: 'news',
      title: `HTTP feed story ${i}`,
      createdAt: iso(-(i + 1) * HOUR)
    });
    attachSource(obj.id, tgram.id);
  }
  const event = makeObject({
    id: 'http_event', type: 'experience', title: 'HTTP Kisumu festival',
    locationName: 'Milimani, Kisumu',
    metadata: { county: 'Kisumu', area: 'Milimani', locationConfidence: 0.8, eventStart: `${day(3)}T18:00:00` },
    createdAt: iso(-HOUR)
  });
  attachSource(event.id, tgram.id);
  makeObject({ id: 'http_private', type: 'news', title: 'HTTP members-only story', publication: 'source_members', createdAt: iso(-HOUR) });

  const { default: app } = await import('../src/index.js');
  const server = app.listen(0);
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const getJson = async (path) => {
    const res = await fetch(`${base}${path}`);
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    const r = await getJson('/api/public/feed?area=Kisumu&limit=5');
    const sectionKeys = ['hero', 'discovery', 'opportunities', 'more', 'tea', 'moreTea', 'counts'];
    check('the composed feed keeps its section contract',
      sectionKeys.every((k) => k in (r.body?.feed ?? {})) && r.body?.feed?.counts?.objects >= 1,
      JSON.stringify(Object.keys(r.body?.feed ?? {})));
    check('the named area is echoed in meta', r.body?.meta?.area === 'Kisumu');
    check('pagination meta is reported', r.body?.meta?.limit === 5 && r.body?.meta?.offset === 0 && r.body?.meta?.total >= 7 && r.body?.meta?.hasMore === true,
      JSON.stringify(r.body?.meta));
    const flat = [...(r.body?.feed?.hero ?? []), ...(r.body?.feed?.discovery ?? []), ...(r.body?.feed?.more ?? [])];
    check('the local event is promoted by the named area',
      flat.findIndex((o) => o.id === 'http_event') >= 0 && flat.findIndex((o) => o.id === 'http_event') < flat.findIndex((o) => o.id === 'http_obj_0'));
    const eventCard = flat.find((o) => o.id === 'http_event');
    check('cards carry the safe temporal projection',
      eventCard?.temporal?.status === 'upcoming' && typeof eventCard?.temporal?.startsAt === 'string');
    check('cards carry visible source provenance',
      Array.isArray(eventCard?.sourceNames) && eventCard.sourceNames.includes('HTTP Telegram') && eventCard?.sourceCount === 1);
    check('members-only rows never appear on the public endpoint',
      !flat.some((o) => o.id === 'http_private') && !(r.body?.feed?.more ?? []).some((o) => o.id === 'http_private'));
    check('internal scores never leave the server', flat.every((o) => o.score === undefined && o.sourceConfidence === undefined && o.extractionConfidence === undefined));

    const r2 = await getJson('/api/public/feed?limit=2&offset=2');
    const flat2 = [...(r2.body?.feed?.hero ?? []), ...(r2.body?.feed?.discovery ?? []), ...(r2.body?.feed?.more ?? [])];
    check('offset pages the public feed compatibly', flat2.length >= 1 && r2.body?.meta?.offset === 2 && r2.body?.meta?.hasMore === true);

    const bad = await getJson('/api/public/feed?area=Kisumu&offset=-1');
    check('invalid offset is refused with the existing error contract', bad.status === 400 && bad.body?.code === 'invalid_query');

    const badArea = await getJson('/api/public/feed?area=' + 'x'.repeat(100));
    check('oversized area is refused, not silently dropped', badArea.status === 400);
  } finally {
    server.close();
  }
}

console.log(`\n${'='.repeat(52)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
process.exit(fail ? 1 : 0);
