// ---------------------------------------------------------------------------
// LOCAL ACTIVITY GRAPH TEST SUITE
//
// Pins the living information graph: event↔venue and offer↔business and
// event↔organizer and news↔publisher (bidirectional, structured-only, no
// keyword matching), object↔location, location pages (real counts, derived
// hierarchy, never fake), place pages, related content, search integration,
// Personal Brief integration, nearby logic (coords only when genuine), missing
// coordinates, low-confidence relationships (title-word sharing never links),
// privacy boundaries (private rows never serialize), expired content (never
// active), and the map-ready projection.
//
//   node test/graph.mjs
// ---------------------------------------------------------------------------

import fs from 'node:fs';

process.env.NODE_ENV = 'test';
process.env.BRIEF_DATA_DIR = `/tmp/brief-graph-${process.pid}`;
fs.rmSync(process.env.BRIEF_DATA_DIR, { recursive: true, force: true });

const { store } = await import('../src/store.js');
const graph = await import('../src/domain/graph.js');
const discovery = await import('../src/domain/discovery.js');
const entities = await import('../src/domain/entities.js');
const personal = await import('../src/domain/personal.js');

store._reset();

let pass = 0;
let fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`); }
};

const now = new Date();
const iso = (d) => d.toISOString();
const isoDays = (days) => {
  const d = new Date(now.getTime() + days * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const isoStart = (days) => `${isoDays(days)}T18:00:00`;

const mkSource = (id, name) =>
  store.insert('sources', {
    id, name, type: 'telegram', platform: 'telegram',
    accessType: 'public', connectionStatus: 'connected', enabled: true,
    confidence: 0.9, trustStatus: 'normal',
    createdAt: iso(now), updatedAt: iso(now)
  });

const mkObject = (id, {
  type = 'offer', title, area = null, county = null, landmark = null,
  deadlineDays = null, eventDays = null, venue = null, hostedBy = null,
  organizer = null, businessName = null, publication = 'public',
  locationName = null, lat = null, lng = null
} = {}) => {
  const metadata = { locationConfidence: 0.9 };
  if (area) metadata.area = area;
  if (county) metadata.county = county;
  if (landmark) metadata.landmark = landmark;
  if (deadlineDays !== null) metadata.deadlineCanonical = isoDays(deadlineDays);
  if (eventDays !== null) metadata.eventStart = isoStart(eventDays);
  if (venue) metadata.venue = venue;
  if (hostedBy) metadata.hostedBy = hostedBy;
  if (organizer) metadata.organizer = organizer;
  if (businessName) metadata.businessName = businessName;
  if (lat !== null && lng !== null) { metadata.lat = lat; metadata.lng = lng; }
  const t = new Date(now.getTime() - 2 * 3600000).toISOString();
  return store.insert('objects', {
    id, type, title: title ?? `${type} ${id}`, summary: `summary ${id}`,
    category: type, metadata, publication,
    extractionConfidence: 0.9, verificationStatus: 'unverified',
    locationName,
    createdAt: t, updatedAt: t, ingestedAt: t
  });
};

const attachSource = (objectId, sourceId, publishedHoursAgo = 2) => {
  const t = new Date(now.getTime() - publishedHoursAgo * 3600000).toISOString();
  store.insert('objectSources', {
    id: `os_${objectId}_${sourceId}`, objectId, sourceId,
    sourcePublishedAt: t, sourceRetrievedAt: t, sourceUrl: `https://ex.example/${sourceId}`,
    sourceConfidence: 0.9, extractionConfidence: 0.9, createdAt: t
  });
};

const rel = (sourceId, verb, targetId) =>
  store.insert('relationships', { id: `rel_${sourceId}_${targetId}`, sourceId, verb, targetId, createdAt: iso(now) });

const ids = (edges, verb) => (edges.find((e) => e.verb === verb)?.objects ?? []).map((o) => o.id);
const flatIds = (edges) => edges.flatMap((e) => e.objects.map((o) => o.id));

// ---------------------------------------------------------------------------
// FIXTURES — a small real-feeling corner of the city.
// ---------------------------------------------------------------------------
console.log('\n=== FIXTURES ===');
{
  mkSource('src_gaz', 'Nairobi Wire');
  mkSource('src_kil', 'Kilimani Community');

  // The venue + what happens there.
  mkObject('obj_g_venue', { type: 'place', title: 'Kilimani Studio', area: 'Kilimani', county: 'Nairobi', lat: -1.288, lng: 36.786 });
  mkObject('obj_g_gig', { type: 'event', title: 'Suite gig at the studio', area: 'Kilimani', county: 'Nairobi', eventDays: 3, venue: 'Kilimani Studio', lat: -1.288, lng: 36.786 });
  mkObject('obj_g_fest', { type: 'event', title: 'Street food fest', area: 'Kilimani', county: 'Nairobi', eventDays: 10, venue: 'Kilimani Studio', organizer: 'Jane Muthoni', lat: -1.288, lng: 36.786 });

  // The business + its offer.
  mkObject('obj_g_biz', { type: 'identity', title: 'Kikao Streetwear', area: 'Kilimani', county: 'Nairobi', lat: -1.288, lng: 36.786 });
  mkObject('obj_g_offer', { type: 'offer', title: 'Hoodie deal', area: 'Kilimani', county: 'Nairobi', deadlineDays: 7, businessName: 'Kikao Streetwear', lat: -1.288, lng: 36.786 });

  // News + announcement (publisher provenance, community source).
  mkObject('obj_g_news', { type: 'news', title: 'Studio report', area: 'Kilimani', county: 'Nairobi' });
  mkObject('obj_g_ann', { type: 'announcement', title: 'Kilimani water notice', area: 'Kilimani', county: 'Nairobi' });
  attachSource('obj_g_news', 'src_gaz');
  attachSource('obj_g_ann', 'src_kil');
  attachSource('obj_g_gig', 'src_gaz');
  attachSource('obj_g_fest', 'src_gaz');

  // The boundary cases.
  mkObject('obj_g_expired', { type: 'offer', title: 'Old deal', area: 'Kilimani', county: 'Nairobi', deadlineDays: -2, lat: -1.288, lng: 36.786 });
  mkObject('obj_g_private', { type: 'event', title: 'Private party', area: 'Kilimani', county: 'Nairobi', eventDays: 2, publication: 'private' });
  mkObject('obj_g_nocoords', { type: 'offer', title: 'Text-only offer', area: 'Kilimani', county: 'Nairobi', deadlineDays: 5 });
  mkObject('obj_g_word', { type: 'news', title: 'A story about Kilimani Studio vibes', area: 'Kilimani', county: 'Nairobi' });
  mkObject('obj_g_pottery', { type: 'event', title: 'Pottery night', area: 'Kilimani', county: 'Nairobi', eventDays: 6, organizer: 'Jane Muthoni' });
  mkObject('obj_g_west', { type: 'event', title: 'Westlands gig', area: 'Westlands', county: 'Nairobi', eventDays: 4, venue: 'Westlands Square' });
  mkObject('obj_g_west_offer', { type: 'offer', title: 'Westlands offer', area: 'Westlands', county: 'Nairobi', deadlineDays: 9 });
  rel('obj_g_gig', 'related_to', 'obj_g_west');

  check('fixtures in place', store.all('objects').length === 14, String(store.all('objects').length));
}

// ---------------------------------------------------------------------------
// DOMAIN: EVENT ↔ VENUE (bidirectional, structured only)
// ---------------------------------------------------------------------------
console.log('\n=== DOMAIN: EVENT ↔ VENUE ===');
{
  const g = graph.objectGraph('obj_g_gig', now);
  check('event graph resolves', Boolean(g), 'null');
  check('event has a structured happening_at edge to its venue',
    ids(g.edges, 'happening_at').includes('obj_g_venue'), JSON.stringify(ids(g.edges, 'happening_at')));
  check('happening_at edge is labelled with the venue name',
    g.edges.find((e) => e.verb === 'happening_at')?.label === 'Happening at Kilimani Studio');
  check('happening_at confidence is structured',
    g.edges.find((e) => e.verb === 'happening_at')?.confidence === 'structured');

  // Bidirectional: the venue's own graph also lists the events there.
  const vg = graph.objectGraph('obj_g_venue', now);
  const atVenue = vg.edges.find((e) => e.verb === 'happening_at');
  check('venue graph lists both events happening there',
    Boolean(atVenue) && atVenue.objects.some((o) => o.id === 'obj_g_gig') && atVenue.objects.some((o) => o.id === 'obj_g_fest'),
    JSON.stringify(ids(vg.edges, 'happening_at')));

  // No keyword matching: a title that merely mentions the venue joins nothing.
  const attachVerbs = ['happening_at', 'organized_by', 'offered_by', 'published_by', 'related_to'];
  check('title-word mention never attaches to the venue',
    !attachVerbs.some((v) => ids(g.edges, v).includes('obj_g_word')),
    JSON.stringify(flatIds(g.edges)));

  // Persisted relationship rows still connect.
  check('persisted related_to row surfaces in the graph',
    ids(g.edges, 'related_to').includes('obj_g_west'), JSON.stringify(ids(g.edges, 'related_to')));
  check('related_to edge is labelled as relationship confidence',
    g.edges.find((e) => e.verb === 'related_to')?.confidence === 'relationship');
}

// ---------------------------------------------------------------------------
// DOMAIN: OFFER ↔ BUSINESS, EVENT ↔ ORGANIZER, NEWS ↔ PUBLISHER
// ---------------------------------------------------------------------------
console.log('\n=== DOMAIN: OFFER/ORGANIZER/PUBLISHER EDGES ===');
{
  const og = graph.objectGraph('obj_g_offer', now);
  check('offer has a structured offered_by edge to its business',
    ids(og.edges, 'offered_by').includes('obj_g_biz'), JSON.stringify(ids(og.edges, 'offered_by')));
  check('offered_by label names the business',
    og.edges.find((e) => e.verb === 'offered_by')?.label === 'Offers from Kikao Streetwear');

  const fg = graph.objectGraph('obj_g_fest', now);
  const orgEdge = fg.edges.find((e) => e.verb === 'organized_by');
  check('event with organizer gets a structured organized_by edge to its other events',
    Boolean(orgEdge) && orgEdge.confidence === 'structured' && orgEdge.objects.some((o) => o.id === 'obj_g_pottery'),
    JSON.stringify(ids(fg.edges, 'organized_by')));

  const ng = graph.objectGraph('obj_g_news', now);
  const pub = ng.edges.find((e) => e.verb === 'published_by');
  check('single-source news gets a provenance published_by edge',
    Boolean(pub) && pub.confidence === 'provenance' && pub.objects.some((o) => o.id === 'obj_g_gig'),
    JSON.stringify(pub?.objects.map((o) => o.id)));
}

// ---------------------------------------------------------------------------
// DOMAIN: OBJECT ↔ LOCATION + LOCATION PAGE (real counts, derived hierarchy)
// ---------------------------------------------------------------------------
console.log('\n=== DOMAIN: LOCATION GRAPH ===');
{
  const loc = graph.resolveLocation('Kilimani');
  check('Kilimani resolves as an area', loc?.kind === 'area', JSON.stringify(loc));
  check('area → county is derived from objects carrying both', loc?.county === 'Nairobi', JSON.stringify(loc?.county));

  const nrb = graph.resolveLocation('Nairobi');
  check('Nairobi resolves as a county', nrb?.kind === 'county', JSON.stringify(nrb));
  check('county areas are derived from real objects (not hardcoded)',
    Array.isArray(nrb?.areas) && nrb.areas.includes('Kilimani') && nrb.areas.includes('Westlands'),
    JSON.stringify(nrb?.areas));

  check('unknown location resolves to null', graph.resolveLocation('Atlantis') === null);

  const act = graph.locationActivity('Kilimani', now);
  check('Kilimani activity resolves', Boolean(act), 'null');
  check('happening now counts match the real live list',
    act.counts.happeningNow === act.activity.happeningNow.length && act.counts.happeningNow >= 1,
    JSON.stringify(act.counts));
  check('coming up counts upcoming events only',
    act.counts.comingUp >= 2, JSON.stringify(act.counts));
  check('expired offer never counts as happening/today/coming-up',
    !act.activity.happeningNow.some((o) => o.id === 'obj_g_expired')
    && !act.activity.today.some((o) => o.id === 'obj_g_expired')
    && !act.activity.comingUp.some((o) => o.id === 'obj_g_expired'),
    JSON.stringify(act.activity.comingUp.map((o) => o.id)));
  check('private object never appears in location activity',
    ![...act.activity.happeningNow, ...act.activity.today, ...act.activity.comingUp, ...act.activity.latest]
      .some((o) => o.id === 'obj_g_private'));
  check('expired content is excluded from latest too',
    !act.activity.latest.some((o) => o.id === 'obj_g_expired'));

  const sections = graph.locationSections('Kilimani', now);
  check('offers section surfaces the active offer only',
    sections.offers.some((o) => o.id === 'obj_g_offer') && !sections.offers.some((o) => o.id === 'obj_g_expired'),
    JSON.stringify(sections.offers?.map((o) => o.id)));
  check('news section surfaces the report', sections.news.some((o) => o.id === 'obj_g_news'));
  check('announcements section surfaces the notice', sections.announcements.some((o) => o.id === 'obj_g_ann'));
  check('places section surfaces the venue', sections.places.some((o) => o.id === 'obj_g_venue'));
  check('events surface under upcoming/current', [...(sections.current ?? []), ...(sections.upcoming ?? [])].some((o) => o.id === 'obj_g_gig'));
  check('private objects never enter sections', !Object.values(sections).flat().some((o) => o.id === 'obj_g_private'));

  // The location edge on a detail object points at the explore page.
  const gg = graph.objectGraph('obj_g_gig', now);
  const le = gg.edges.find((e) => e.verb === 'located_at');
  check('object carries a located_at edge to its area',
    Boolean(le) && le.label === 'More happening in Kilimani' && le.location?.name === 'Kilimani' && le.location?.county === 'Nairobi',
    JSON.stringify(le?.location));
  check('located_at pools other objects in the area (not itself)',
    le.objects.some((o) => o.id === 'obj_g_offer') && !le.objects.some((o) => o.id === 'obj_g_gig'));

  const idx = graph.locationIndex(now);
  check('location index lists Kilimani with real counts',
    idx.some((l) => l.name === 'Kilimani' && l.counts.comingUp >= 2), JSON.stringify(idx.map((l) => l.name)));
  check('location index is most-active-first',
    idx.length > 1 && (idx[0].counts.today + idx[0].counts.comingUp) >= (idx[1].counts.today + idx[1].counts.comingUp));
}

// ---------------------------------------------------------------------------
// DOMAIN: NEARBY + MAP-READY (coordinates only when genuine)
// ---------------------------------------------------------------------------
console.log('\n=== DOMAIN: NEARBY + MAP-READY ===');
{
  const near = graph.nearbyObjects({ lat: -1.29, lng: 36.78, radiusKm: 10 }, now);
  check('nearby with genuine coords returns the Kilimani cluster',
    near.available && near.items.some((o) => o.id === 'obj_g_venue') && near.items.some((o) => o.id === 'obj_g_gig'),
    JSON.stringify(near.items.map((o) => o.id)));
  check('nearby distances are real haversine kilometres',
    near.items.every((o) => typeof o.distanceKm === 'number' && o.distanceKm >= 0 && o.distanceKm < 5),
    JSON.stringify(near.items.map((o) => o.distanceKm)));
  check('objects without coordinates never enter nearby', !near.items.some((o) => o.id === 'obj_g_nocoords'));
  check('expired objects never enter nearby', !near.items.some((o) => o.id === 'obj_g_expired'));
  check('private objects never enter nearby', !near.items.some((o) => o.id === 'obj_g_private'));

  const none = graph.nearbyObjects({}, now);
  check('nearby without a coordinate query reports no_coordinates',
    none.available === false && none.reason === 'no_coordinates' && none.items.length === 0);

  const byLoc = graph.nearbyForLocation('Kilimani', 10, now);
  check('nearby for a named area uses its derived centroid',
    byLoc.available && byLoc.items.length > 0, JSON.stringify(byLoc));
  const byLocNone = graph.nearbyForLocation('Westlands', 10, now);
  check('area without stored coords reports no_coordinates honestly',
    byLocNone.available === false && byLocNone.reason === 'no_coordinates', JSON.stringify(byLocNone));

  const map = graph.mapReadyFor(store.all('objects'), now);
  check('map-ready items carry the full contract (id/type/title/location/lat/lng/temporal)',
    map.items.every((o) => o.id && o.type && o.title && typeof o.lat === 'number' && typeof o.lng === 'number' && o.temporal?.status),
    JSON.stringify(map.items[0]));
  check('map-ready omits coordinate-less objects', !map.items.some((o) => o.id === 'obj_g_nocoords'));
  check('map-ready omits private + expired', !map.items.some((o) => o.id === 'obj_g_private') && !map.items.some((o) => o.id === 'obj_g_expired'));

  const m1 = graph.mapReadyObject(store.find('objects', (o) => o.id === 'obj_g_nocoords'), now);
  check('single-object map projection is honest nulls without coords',
    m1.lat === null && m1.lng === null && Boolean(m1.location));
}

// ---------------------------------------------------------------------------
// DOMAIN: PERSONAL BRIEF INTEGRATION (followed venue boosts its events)
// ---------------------------------------------------------------------------
console.log('\n=== DOMAIN: PERSONAL BRIEF INTEGRATION ===');
{
  const uid = 'usr_graph_person';
  personal.follow(uid, 'location', 'Kilimani');
  const boost = personal.personalBoost(
    store.find('objects', (o) => o.id === 'obj_g_gig'),
    personal.interestsOf(uid),
    personal.relevanceOf(uid),
    null
  );
  check('event connected to a followed location receives the location boost',
    boost.boost >= 6 && boost.reasons.includes('location'), JSON.stringify(boost));

  // Explicit venue follow is the stronger signal (entity follow, +8).
  const venueEntity = entities.getEntity('venue:obj_g_venue', null);
  const boost2 = personal.personalBoost(
    store.find('objects', (o) => o.id === 'obj_g_gig'),
    personal.interestsOf(uid),
    personal.relevanceOf(uid),
    new Set([venueEntity.id])
  );
  check('venue follow adds the explicit followed signal on top of location',
    boost2.boost > boost.boost && boost2.reasons.includes('followed'), JSON.stringify(boost2));
}

// ---------------------------------------------------------------------------
// DOMAIN: PRIVACY + EXPIRED ACROSS THE WHOLE GRAPH
// ---------------------------------------------------------------------------
console.log('\n=== DOMAIN: PRIVACY + EXPIRED ===');
{
  check('object graph refuses non-public objects', graph.objectGraph('obj_g_private', now) === null);
  check('object graph refuses unknown objects', graph.objectGraph('obj_g_nope', now) === null);
  const all = JSON.stringify({
    act: graph.locationActivity('Kilimani', now),
    near: graph.nearbyObjects({ lat: -1.29, lng: 36.78, radiusKm: 10 }, now),
    map: graph.mapReadyFor(store.all('objects'), now)
  });
  check('no payload serializes the private row', !all.includes('obj_g_private'));
  check('no payload serializes credentials or internal fields',
    !all.includes('connectionStatus') && !all.includes('accessType'));
}

// ---------------------------------------------------------------------------
// ROUTE CONTRACT (HTTP)
// ---------------------------------------------------------------------------
console.log('\n=== ROUTE CONTRACT (HTTP) ===');
{
  process.env.BRIEF_ADMINS = 'graph_admin';
  process.env.BRIEF_DEV_AUTH = '0';
  const { default: app } = await import('../src/index.js');
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, method = 'GET', body, token) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    // Location pages are PUBLIC (shareable /explore/kilimani).
    const page = await call('/api/locations/Kilimani');
    check('location page is public (200)', page.status === 200, `got ${page.status}`);
    check('location page carries real counts', page.body?.activity?.counts?.comingUp >= 2, JSON.stringify(page.body?.activity?.counts));
    check('location page carries sections', Boolean(page.body?.sections?.offers) && Boolean(page.body?.sections?.places), JSON.stringify(Object.keys(page.body?.sections ?? {})));
    check('location page carries map-ready data', Boolean(page.body?.map?.available) && page.body.map.items.length > 0, JSON.stringify(page.body?.map));
    check('location page never serializes private/internal fields',
      !JSON.stringify(page.body).includes('obj_g_private') && !JSON.stringify(page.body).includes('connectionStatus'));
    check('location page nearby is derived from genuine coords',
      page.body?.nearby?.available === true && page.body.nearby.items.length > 0, JSON.stringify(page.body?.nearby));

    const unknown = await call('/api/locations/Atlantis');
    check('unknown location is 404', unknown.status === 404, `got ${unknown.status}`);

    const idx = await call('/api/locations');
    check('location index is public', idx.status === 200 && idx.body.locations.some((l) => l.name === 'Kilimani'));

    const gg = await call('/api/graph/object/obj_g_gig');
    check('object graph is public for public objects', gg.status === 200, `got ${gg.status}`);
    check('object graph carries edges with confidence',
      gg.body.edges.some((e) => e.verb === 'happening_at' && e.confidence === 'structured'));
    check('object graph carries the location edge for /explore',
      gg.body.edges.some((e) => e.verb === 'located_at' && e.location?.name === 'Kilimani'));

    const priv = await call('/api/graph/object/obj_g_private');
    check('object graph refuses private objects (404)', priv.status === 404, `got ${priv.status}`);
    const missing = await call('/api/graph/object/obj_g_nope');
    check('object graph refuses unknown objects (404)', missing.status === 404, `got ${missing.status}`);

    const near = await call('/api/nearby?lat=-1.29&lng=36.78&radiusKm=10');
    check('nearby over HTTP returns ranked items', near.status === 200 && near.body.items.length > 0, `got ${near.status}`);
    const nearArea = await call('/api/nearby?area=Kilimani');
    check('nearby by named area works', nearArea.status === 200 && nearArea.body.available === true, `got ${nearArea.status}`);
    const nearBad = await call('/api/nearby');
    check('nearby without coordinates is a 400', nearBad.status === 400, `got ${nearBad.status}`);

    // Search integration: venue search surfaces the events THERE. Search is
    // behind the app gate, so this part runs with a real session.
    const reg = await call('/api/auth/register', 'POST', { handle: 'graph_user', password: 'pw-123456', displayName: 'Graph User' });
    check('user registers for the search check', reg.status === 201, `got ${reg.status}`);
    const token = reg.body?.token;
    const s1 = await call('/api/search?q=Kilimani%20Studio', 'GET', null, token);
    check('venue search returns events at that venue',
      s1.status === 200 && s1.body.results.objects.some((o) => o.id === 'obj_g_gig'),
      JSON.stringify(s1.body?.results?.objects?.map((o) => o.id)));
    const s2 = await call('/api/search?q=Kikao%20Streetwear', 'GET', null, token);
    check('business search returns its offers',
      s2.status === 200 && s2.body.results.objects.some((o) => o.id === 'obj_g_offer'),
      JSON.stringify(s2.body?.results?.objects?.map((o) => o.id)));
    check('search still ranks entity hits alongside',
      s1.body.results.entities.some((e) => e.id === 'venue:obj_g_venue'));

    srv.close();
  } catch (e) {
    srv.close();
    throw e;
  }
}

console.log(`\n${'='.repeat(52)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
process.exit(fail ? 1 : 0);
