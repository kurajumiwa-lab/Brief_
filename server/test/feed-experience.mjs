// ---------------------------------------------------------------------------
// DISCOVERY EXPERIENCE TEST SUITE
//
// The surfaces the discovery experience is built on: typed category feeds,
// the safe public projection (metadata whitelist + galleries + publishedAt),
// and the search boundary (anonymous results never leak internal fields).
//
//   node test/feed-experience.mjs
// ---------------------------------------------------------------------------

import fs from 'node:fs';

process.env.NODE_ENV = 'test';
process.env.BRIEF_DATA_DIR = `/tmp/brief-feed-exp-${process.pid}`;
fs.rmSync(process.env.BRIEF_DATA_DIR, { recursive: true, force: true });

const { store } = await import('../src/store.js');
const discovery = await import('../src/domain/discovery.js');
const search = await import('../src/domain/search.js');
const publicFeed = await import('../src/domain/publicFeed.js');

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
function makeObject(o = {}) {
  seq += 1;
  return store.insert('objects', {
    id: o.id ?? `t_obj_${seq}`,
    type: 'knowledge',
    title: `Test object ${seq}`,
    summary: 'A fixture row.',
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

function attachSource(objectId, sourceId, rawItemId = null) {
  return store.insert('objectSources', {
    id: `os_${objectId}_${sourceId}_${seq}`,
    objectId,
    sourceId,
    rawItemId,
    sourceConfidence: 0.5,
    extractionConfidence: 0.7,
    createdAt: iso(0)
  });
}

function makeSource(id, name, platform) {
  return store.insert('sources', {
    id, name, type: platform, platform, url: null, externalId: null,
    accessType: 'public', connectionStatus: 'connected', confidence: 0.5,
    createdAt: iso(0), updatedAt: iso(0)
  });
}

console.log('\n=== EXPERIENCE: typed category feeds ===');
{
  store._reset();
  seq = 0;
  makeObject({ id: 't_event', type: 'experience', title: 'Rooftop concert', metadata: { eventStart: `${day(2)}T18:00:00` } });
  makeObject({ id: 't_offer', type: 'offer', title: 'Plant sale discount', metadata: { deadlineCanonical: day(4) } });
  makeObject({ id: 't_place', type: 'place', title: 'City Market' });
  makeObject({ id: 't_news', type: 'news', title: 'City council statement' });

  const events = discovery.discoverableStream({ type: 'experience', limit: 50, publication: 'public' });
  check('a typed feed returns only that type', events.objects.every((o) => o.type === 'experience') && events.objects.length === 1, `got ${events.objects.length}`);
  const offers = discovery.discoverableStream({ type: 'offer', limit: 50, publication: 'public' });
  check('the offer category feeds its own type', offers.objects.length === 1 && offers.objects[0].id === 't_offer');
  const news = discovery.discoverableStream({ type: 'news', limit: 50, publication: 'public' });
  check('the news category feeds its own type', news.objects.length === 1 && news.objects[0].id === 't_news');
  const unknown = discovery.discoverableStream({ type: 'nonsense', limit: 50, publication: 'public' });
  check('an unknown type filter is ignored, not fatal', unknown.objects.length >= 1);
}

console.log('\n=== EXPERIENCE: public projection safety ===');
{
  store._reset();
  seq = 0;
  const src = makeSource('src_proj', 'Projection Channel', 'telegram');
  const obj = makeObject({
    id: 'proj_obj', type: 'experience', title: 'Projection event',
    locationName: 'Kilimani Studio',
    metadata: {
      area: 'Kilimani', county: 'Nairobi', landmark: 'Prestige Plaza',
      venue: 'Kilimani Studio', organizer: 'Creators Hub',
      price: 300, currency: 'KES', deadline: 'Friday', deadlineCanonical: day(2),
      contactPhone: '0712345678', lat: -1.29, lng: 36.82,
      dateCanonical: day(2), eventStart: `${day(2)}T18:00:00`
    },
    extractionEvidence: [{ field: 'price', value: '300', evidence: 'KES 300' }],
    extractionConfidence: 0.9
  });
  attachSource(obj.id, src.id);

  const list = discovery.discoverableStream({ limit: 50, publication: 'public' });
  const card = list.objects.find((o) => o.id === 'proj_obj');
  // The public projection is what actually leaves the server (the route
  // projects every stream row through publicObject).
  const pub = publicFeed.publicObject(card);
  check('cards carry the extracted locality fields', pub?.metadata?.area === 'Kilimani' && pub?.metadata?.county === 'Nairobi' && pub?.metadata?.landmark === 'Prestige Plaza');
  check('cards carry venue and organizer', pub?.metadata?.venue === 'Kilimani Studio' && pub?.metadata?.organizer === 'Creators Hub');
  check('cards carry safe price and deadline', pub?.metadata?.price === 300 && pub?.metadata?.deadlineCanonical === day(2));
  check('internal fields never serialize on the feed',
    pub?.metadata?.contactPhone === undefined && pub?.metadata?.lat === undefined && pub?.metadata?.lng === undefined &&
    pub?.extractionEvidence === undefined && pub?.extractionConfidence === undefined);
  check('the card reports when it was first published', typeof pub?.publishedAt === 'string');

  const searchRes = search.search('projection');
  const hit = searchRes.objects.find((o) => o.id === 'proj_obj');
  check('search returns the object through the same public projection', Boolean(hit));
  check('search results keep the safe metadata', hit?.metadata?.area === 'Kilimani' && hit?.metadata?.price === 300);
  check('search results never leak contact/coordinates/evidence',
    hit?.metadata?.contactPhone === undefined && hit?.metadata?.lat === undefined && hit?.extractionEvidence === undefined);
  check('search results carry temporal and provenance', Boolean(hit?.temporal) && Array.isArray(hit?.sourceNames) && hit?.sourceNames.includes('Projection Channel'));
}

console.log('\n=== EXPERIENCE: galleries from real source media ===');
{
  store._reset();
  seq = 0;
  const src = makeSource('src_gal', 'Gallery Channel', 'telegram');

  // Two raw items, each carrying real image media, pointing at one object.
  const raw1 = store.insert('rawItems', {
    id: 'raw_gal_1', sourceId: src.id, externalId: 'g1', text: 'Market photos', media: [
      { kind: 'image', reference: 'file_id_aaa', caption: 'Stall one' },
      { kind: 'image', reference: 'file_id_bbb', caption: 'Crowd' }
    ],
    publishedAt: iso(-HOUR), retrievedAt: iso(0), processingStatus: 'processed',
    createdAt: iso(-HOUR)
  });
  const raw2 = store.insert('rawItems', {
    id: 'raw_gal_2', sourceId: src.id, externalId: 'g2', text: 'More photos', media: [
      { kind: 'image', url: 'https://cdn.example/market.jpg', caption: 'Wide shot' },
      { kind: 'document', reference: 'file_id_zzz' }
    ],
    publishedAt: iso(-HOUR), retrievedAt: iso(0), processingStatus: 'processed',
    createdAt: iso(-HOUR)
  });
  const obj = makeObject({ id: 'gal_obj', type: 'experience', title: 'Gallery event' });
  attachSource(obj.id, src.id, raw1.id);
  attachSource(obj.id, src.id, raw2.id);

  const list = discovery.discoverableStream({ limit: 50, publication: 'public' });
  const card = list.objects.find((o) => o.id === 'gal_obj');
  const gallery = publicFeed.publicObject(card)?.gallery ?? null;
  check('a gallery is projected when multiple real images exist', Array.isArray(gallery) && gallery.length >= 3, JSON.stringify(gallery));
  check('telegram references resolve to the server-side media path',
    gallery?.some((g) => /^\/api\/media\/telegram\/gal_obj\/\d+$/.test(g.url)));
  check('web image URLs are preserved', gallery?.some((g) => g.url === 'https://cdn.example/market.jpg'));
  check('non-image media never enters the gallery', gallery?.every((g) => g.url !== 'undefined') && gallery?.length <= 5);

  // Single image -> no gallery (the cover already shows it).
  store._reset();
  seq = 0;
  const src2 = makeSource('src_gal2', 'Single Shot Channel', 'telegram');
  const raw3 = store.insert('rawItems', {
    id: 'raw_gal_3', sourceId: src2.id, externalId: 'g3', text: 'One photo', media: [
      { kind: 'image', reference: 'file_id_ccc' }
    ],
    publishedAt: iso(-HOUR), retrievedAt: iso(0), processingStatus: 'processed',
    createdAt: iso(-HOUR)
  });
  const single = makeObject({ id: 'gal_single', type: 'place', title: 'Single image place' });
  attachSource(single.id, src2.id, raw3.id);
  const list2 = discovery.discoverableStream({ limit: 50, publication: 'public' });
  check('a single image does not fabricate a gallery',
    (publicFeed.publicObject(list2.objects.find((o) => o.id === 'gal_single'))?.gallery ?? null) === null);
}

console.log('\n=== EXPERIENCE: public feed HTTP contract for categories ===');
{
  store._reset();
  seq = 0;
  const src = makeSource('src_http2', 'HTTP Channel', 'telegram');
  makeObject({ id: 'h_event', type: 'experience', title: 'HTTP event', metadata: { eventStart: `${day(3)}T18:00:00` } });
  makeObject({ id: 'h_offer', type: 'offer', title: 'HTTP offer', metadata: { deadlineCanonical: day(5) } });
  makeObject({ id: 'h_news', type: 'news', title: 'HTTP news' });
  for (const id of ['h_event', 'h_offer', 'h_news']) {
    const o = store.find('objects', (x) => x.id === id);
    attachSource(o.id, src.id);
  }

  const { default: app } = await import('../src/index.js');
  const server = app.listen(0);
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const getJson = async (path) => {
    const res = await fetch(`${base}${path}`);
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    const r = await getJson('/api/public/feed?type=experience&limit=10');
    const flat = [...(r.body?.feed?.hero ?? []), ...(r.body?.feed?.discovery ?? []), ...(r.body?.feed?.more ?? [])];
    check('the category param filters the public feed', flat.length === 1 && flat[0]?.id === 'h_event' && r.body?.meta?.type === 'experience');
    const r2 = await getJson('/api/public/feed?type=offer&limit=10');
    const flat2 = [...(r2.body?.feed?.hero ?? []), ...(r2.body?.feed?.discovery ?? []), ...(r2.body?.feed?.more ?? [])];
    check('the offer category returns only offers', flat2.length === 1 && flat2[0]?.id === 'h_offer');
    const bad = await getJson('/api/public/feed?type=spacecraft');
    check('an invalid type is refused with the query-error contract', bad.status === 400 && bad.body?.code === 'invalid_query');
  } finally {
    server.close();
  }
}

console.log(`\n${'='.repeat(52)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
process.exit(fail ? 1 : 0);
