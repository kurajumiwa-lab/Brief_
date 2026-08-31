// ---------------------------------------------------------------------------
// ENTITY LAYER TEST SUITE (Following + Circles)
//
// Pins the followable layer: entity creation/representation (venue, business,
// organizer, publisher, community — all DERIVED from existing rows, never
// duplicated), entity pages (public, shareable, private-safe), follow /
// unfollow (authed, self-scoped, idempotent), the Following feed (ranked,
// expired content never active), Personal Brief integration (explicit follow
// stronger than inferred preference, still bounded), related content via the
// existing relationship graph, entity search (extends object search),
// privacy (credentials never reach the client), source trust (degraded sources
// are never presented as highly authoritative), and the five entity analytics
// signals.
//
//   node test/entities.mjs
// ---------------------------------------------------------------------------

import fs from 'node:fs';

process.env.NODE_ENV = 'test';
process.env.BRIEF_DATA_DIR = `/tmp/brief-entities-${process.pid}`;
fs.rmSync(process.env.BRIEF_DATA_DIR, { recursive: true, force: true });

const { store } = await import('../src/store.js');
const entities = await import('../src/domain/entities.js');
const personal = await import('../src/domain/personal.js');
const trust = await import('../src/domain/trust.js');
const discovery = await import('../src/domain/discovery.js');
const sourceTrust = await import('../src/domain/sourceTrust.js');
const circleDomain = await import('../src/domain/circle.js');
const analytics = await import('../src/domain/analytics.js');

store._reset();

let pass = 0;
let fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`); }
};

const now = new Date();
const iso = (d) => d.toISOString();
const isoDaysFromNow = (days) => {
  const d = new Date(now.getTime() + days * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const isoEventStart = (days) => `${isoDaysFromNow(days)}T18:00:00`;

const mkSource = (id, name, type = 'telegram', { accessType = 'public', url = 'https://example.com/x', trustStatus = 'normal' } = {}) =>
  store.insert('sources', {
    id, name, type, platform: type.split('_')[0],
    accessType, connectionStatus: 'connected', enabled: true,
    confidence: 0.9, trustStatus, url,
    createdAt: iso(now), updatedAt: iso(now)
  });

let objSeq = 0;
const mkObject = (id, { type = 'offer', title, area = null, county = 'Nairobi',
  deadlineDays = null, eventDays = null, publishedHoursAgo = 2,
  venue = null, hostedBy = null, organizer = null,
  publication = 'public', locationName = null } = {}) => {
  const metadata = { locationConfidence: 0.9 };
  if (area) metadata.area = area;
  if (county) metadata.county = county;
  if (deadlineDays !== null) metadata.deadlineCanonical = isoDaysFromNow(deadlineDays);
  if (eventDays !== null) metadata.eventStart = isoEventStart(eventDays);
  if (venue) metadata.venue = venue;
  if (hostedBy) metadata.hostedBy = hostedBy;
  if (organizer) metadata.organizer = organizer;
  const createdAt = new Date(now.getTime() - publishedHoursAgo * 3600000).toISOString();
  return store.insert('objects', {
    id, type, title: title ?? `${type} ${++objSeq}`, summary: title ?? `summary ${objSeq}`,
    category: type, metadata, publication,
    extractionConfidence: 0.9, verificationStatus: 'unverified',
    createdAt, updatedAt: createdAt, ingestedAt: createdAt
  });
};

const attachSources = (objectId, sourceIds, publishedHoursAgo = 2, sourceConfidence = 0.9) => {
  for (const [i, sourceId] of sourceIds.entries()) {
    const t = new Date(now.getTime() - publishedHoursAgo * 3600000).toISOString();
    store.insert('objectSources', {
      id: `os_${objectId}_${i}`, objectId, sourceId,
      sourcePublishedAt: t, sourceRetrievedAt: t, sourceUrl: `https://ex.example/${sourceId}`,
      sourceConfidence, extractionConfidence: 0.9, createdAt: t
    });
  }
};

const rel = (sourceId, verb, targetId) =>
  store.insert('relationships', { id: `rel_${sourceId}_${targetId}`, sourceId, verb, targetId, createdAt: iso(now) });

// ---------------------------------------------------------------------------
// DOMAIN: ENTITY REPRESENTATION (creation is DERIVED, never duplicated)
// ---------------------------------------------------------------------------
console.log('\n=== DOMAIN: ENTITY REPRESENTATION ===');
{
  // A place object IS a venue entity.
  const venue = mkObject('obj_ent_venue', { type: 'place', title: 'Kilimani Studio', area: 'Kilimani', summary: 'A studio block in Kilimani.' });
  const e = entities.resolveEntities().get(`venue:${venue.id}`);
  check('place object derives a venue entity', Boolean(e) && e.kind === 'venue' && e.name === 'Kilimani Studio', JSON.stringify(e?.name));
  check('venue entity keeps its location', e.location?.area === 'Kilimani', JSON.stringify(e?.location));
  check('venue entity keeps its own object', e.objects.some((o) => o.id === venue.id));

  // A business/identity object IS a business entity.
  const biz = mkObject('obj_ent_biz', { type: 'identity', title: 'Kikao Streetwear' });
  const eb = entities.resolveEntities().get(`business:${biz.id}`);
  check('identity object derives a business entity', Boolean(eb) && eb.kind === 'business' && eb.name === 'Kikao Streetwear');
  check('business entity has its own object', eb.objects.some((o) => o.id === biz.id));

  // Related content via the EXISTING relationship graph, not keyword matching.
  const popup = mkObject('obj_ent_popup', { type: 'experience', title: 'Saturday popup', area: 'Kilimani', eventDays: 7 });
  const hoodie = mkObject('obj_ent_hoodie', { type: 'product', title: 'Printed Hoodie', deadlineDays: 10 });
  rel(popup.id, 'has_vendor', biz.id);
  rel(biz.id, 'appears_at', popup.id);
  rel(popup.id, 'offers', hoodie.id);
  const eb2 = entities.resolveEntities().get(`business:${biz.id}`);
  check('business entity surfaces direct relationship-linked objects',
    eb2.objects.some((o) => o.id === popup.id),
    JSON.stringify(eb2.objects.map((o) => o.id)));
  check('two-hop links are not pulled in (only direct edges)',
    !eb2.objects.some((o) => o.id === hoodie.id),
    JSON.stringify(eb2.objects.map((o) => o.id)));

  // Venue-related objects via exact structured metadata (metadata.venue).
  const gig = mkObject('obj_ent_gig', { type: 'event', title: 'Live set at the studio', area: 'Kilimani', eventDays: 3, venue: 'Kilimani Studio' });
  const ev = entities.resolveEntities().get(`venue:${venue.id}`);
  check('venue entity surfaces objects whose structured venue field names it',
    ev.objects.some((o) => o.id === gig.id), JSON.stringify(ev.objects.map((o) => o.id)));

  // No keyword matching: an object whose TEXT merely mentions the venue name
  // without structured metadata must not join the entity.
  const mention = mkObject('obj_ent_mention', { type: 'news', title: 'A story about Kilimani Studio vibes', area: 'Kilimani', deadlineDays: 5 });
  const ev2 = entities.resolveEntities().get(`venue:${venue.id}`);
  check('text mention alone does not attach an object to an entity', !ev2.objects.some((o) => o.id === mention.id));

  // Organizer from structured metadata on event-ish objects.
  const fest = mkObject('obj_ent_fest', { type: 'experience', title: 'Food fest', area: 'Westlands', eventDays: 5, organizer: 'Jane Muthoni' });
  const eo = entities.resolveEntities().get('organizer:Jane Muthoni');
  check('organizer entity derives from metadata.organizer', Boolean(eo) && eo.name === 'Jane Muthoni', JSON.stringify(eo?.name));
  check('organizer entity carries the events they organize', eo.objects.some((o) => o.id === fest.id));
  check('organizer entity does not include the venue-named place', eo.objects.every((o) => o.id !== venue.id));

  // Publisher from a real named source with public objects behind it.
  const pubSrc = mkSource('src_ent_pub', 'Nairobi Wire');
  const article = mkObject('obj_ent_art', { type: 'news', title: 'Nairobi news piece', deadlineDays: 3 });
  attachSources(article.id, [pubSrc.id]);
  const ep = entities.resolveEntities().get(`publisher:${pubSrc.id}`);
  check('named source with objects derives a publisher entity', Boolean(ep) && ep.kind === 'publisher' && ep.name === 'Nairobi Wire');
  check('publisher entity carries its source objects', ep.objects.some((o) => o.id === article.id));

  // Raw technical sources without real content are NOT user-facing entities.
  const techSrc = mkSource('src_ent_tech', 'ingest-worker-7', 'api', { accessType: 'private', url: null });
  check('technical source without public objects is not an entity',
    !entities.resolveEntities().has(`publisher:${techSrc.id}`));

  // Community from a Circle (itself derived from a source, idempotently).
  const commSrc = mkSource('src_ent_comm', 'Kilimani Community');
  const commObj = mkObject('obj_ent_comm', { type: 'announcement', title: 'Community clean-up', area: 'Kilimani', deadlineDays: 7 });
  attachSources(commObj.id, [commSrc.id]);
  const circle = circleDomain.findOrCreateCircleFromSource(commSrc.id);
  check('circle derives idempotently from its source', circle.id === circleDomain.findOrCreateCircleFromSource(commSrc.id).id);
  const ec = entities.resolveEntities().get(`community:${circle.id}`);
  check('circle with content derives a community entity', Boolean(ec) && ec.kind === 'community' && ec.name.includes('Kilimani'), JSON.stringify(ec?.name));
  check('community entity carries its members objects', ec.objects.some((o) => o.id === commObj.id));

  // entityKeysOfObject agrees with the resolvers (deduped, one per entity).
  const keys = entities.entityKeysOfObject(popup);
  check('entityKeysOfObject covers the business link exactly once',
    keys.filter((k) => k === `business:${biz.id}`).length === 1,
    JSON.stringify(keys));
  const artKeys = entities.entityKeysOfObject(article);
  check('entityKeysOfObject covers the publisher link', artKeys.includes(`publisher:${pubSrc.id}`), JSON.stringify(artKeys));
  const commKeys = entities.entityKeysOfObject(commObj);
  check('entityKeysOfObject covers the community link', commKeys.includes(`community:${circle.id}`), JSON.stringify(commKeys));
  const placeKeys = entities.entityKeysOfObject(venue);
  check('entityKeysOfObject covers the venue self', placeKeys.includes(`venue:${venue.id}`));
  const orgKeys = entities.entityKeysOfObject(fest);
  check('entityKeysOfObject covers the organizer', orgKeys.includes('organizer:Jane Muthoni'), JSON.stringify(orgKeys));

  // Entity id parsing round-trips.
  const parsed = entities.parseEntityId(`venue:${venue.id}`);
  check('parseEntityId round-trips kind + key', parsed.kind === 'venue' && parsed.key === venue.id);
  check('bare object id parses with null kind', entities.parseEntityId(venue.id).kind === null);
  check('garbage entity id rejected', entities.parseEntityId('wat:zzz') === null);
  check('getEntity resolves a bare place object id', entities.getEntity(venue.id)?.kind === 'venue');
  check('getEntity resolves a bare identity object id', entities.getEntity(biz.id)?.kind === 'business');
  check('getEntity rejects unknown ids', entities.getEntity('obj_ent_nope') === null);
}

// ---------------------------------------------------------------------------
// DOMAIN: EXPIRED CONTENT NEVER ACTIVE
// ---------------------------------------------------------------------------
console.log('\n=== DOMAIN: EXPIRED CONTENT ===');
{
  const live = mkObject('obj_ent_live', { type: 'offer', title: 'Live offer', area: 'Kilimani', deadlineDays: 5 });
  const expired = mkObject('obj_ent_expired', { type: 'offer', title: 'Expired offer', area: 'Kilimani', deadlineDays: -1 });
  const src = mkSource('src_ent_exp', 'Expiry Source');
  attachSources(live.id, [src.id]);
  attachSources(expired.id, [src.id]);

  const e = entities.resolveEntities().get(`publisher:${src.id}`);
  check('expired object is absent from the entity page', e.objects.some((o) => o.id === live.id) && !e.objects.some((o) => o.id === expired.id),
    JSON.stringify(e.objects.map((o) => o.id)));
  check('live object carries its real temporal status', e.objects.find((o) => o.id === live.id)?.temporal?.status === 'active');
  check('stale is not presented as active anywhere', discovery.isStale(expired, new Date()));
}

// ---------------------------------------------------------------------------
// DOMAIN: TRUST OF ENTITIES (source trust, never invented badges)
// ---------------------------------------------------------------------------
console.log('\n=== DOMAIN: SOURCE TRUST ===');
{
  const goodSrc = mkSource('src_ent_trust_good', 'Good Source');
  const obj = mkObject('obj_ent_trust_obj', { type: 'news', title: 'Trust test', deadlineDays: 4 });
  attachSources(obj.id, [goodSrc.id]);
  let e = entities.getEntity(`publisher:${goodSrc.id}`);
  check('normal source entity is not degraded and not corroborated',
    e && e.trust?.degraded === false && e.trust?.disabled === false && e.trust?.corroborated === false,
    JSON.stringify(e?.trust));

  const badSrc = mkSource('src_ent_trust_bad', 'Shady Source', 'telegram', { trustStatus: 'degraded' });
  const obj2 = mkObject('obj_ent_trust_obj2', { type: 'news', title: 'Trust test 2', deadlineDays: 4 });
  attachSources(obj2.id, [badSrc.id]);
  e = entities.getEntity(`publisher:${badSrc.id}`);
  check('degraded source flags the entity as degraded (never authoritative)',
    e && e.trust?.degraded === true, JSON.stringify(e?.trust));

  const offSrc = mkSource('src_ent_trust_off', 'Disabled Source', 'telegram', { trustStatus: 'disabled' });
  const obj3 = mkObject('obj_ent_trust_obj3', { type: 'news', title: 'Trust test 3', deadlineDays: 4 });
  attachSources(obj3.id, [offSrc.id]);
  e = entities.getEntity(`publisher:${offSrc.id}`);
  check('disabled source flags the entity as disabled', e && e.trust?.disabled === true, JSON.stringify(e?.trust));

  const twoA = mkSource('src_ent_trust_2a', 'Corroboration A');
  const twoB = mkSource('src_ent_trust_2b', 'Corroboration B');
  const obj4 = mkObject('obj_ent_trust_obj4', { type: 'news', title: 'Trust test 4', deadlineDays: 4 });
  attachSources(obj4.id, [twoA.id, twoB.id]);
  e = entities.getEntity(`publisher:${twoA.id}`);
  check('multi-source provenance reports corroboration as a plain fact', e && e.trust?.corroborated === true, JSON.stringify(e?.trust));
}

// ---------------------------------------------------------------------------
// DOMAIN: FOLLOW / UNFOLLOW (self-scoped, idempotent)
// ---------------------------------------------------------------------------
console.log('\n=== DOMAIN: FOLLOW / UNFOLLOW ===');
{
  const venue = mkObject('obj_ent_fv', { type: 'place', title: 'Sarit Centre Expo', area: 'Westlands' });
  const u1 = 'usr_ent_1';
  const u2 = 'usr_ent_2';

  const f = entities.followEntity(u1, 'venue', venue.id);
  check('follow returns followed', f.followed === true && f.already === false);
  check('follow is idempotent', entities.followEntity(u1, 'venue', venue.id).already === true);
  check('follow persists exactly one row',
    store.filter('entityFollows', (x) => x.userId === u1 && x.kind === 'venue' && x.entityKey === venue.id).length === 1);

  const pub = entities.publicEntity(entities.resolveEntities().get(`venue:${venue.id}`), u1);
  check('public projection reflects the viewer follow state', pub.isFollowed === true && pub.followCount === 1);
  const pubAnon = entities.publicEntity(entities.resolveEntities().get(`venue:${venue.id}`), null);
  check('anonymous projection never reveals follow state', pubAnon.isFollowed === false && pubAnon.followCount === 1);

  const uf = entities.unfollowEntity(u1, 'venue', venue.id);
  check('unfollow removes the row', uf.unfollowed === true && uf.already === false);
  check('unfollow of nothing is a no-op', entities.unfollowEntity(u1, 'venue', venue.id).already === true);

  // Isolation: user 2's follow is their own row; user 1 cannot touch it.
  entities.followEntity(u2, 'venue', venue.id);
  check('follows are per-user', store.filter('entityFollows', (x) => x.entityKey === venue.id).length === 1
    && store.filter('entityFollows', (x) => x.userId === u2).length === 1);
  entities.unfollowEntity(u1, 'venue', venue.id);
  check('unfollowing as another user leaves the owner follow intact',
    store.filter('entityFollows', (x) => x.userId === u2 && x.entityKey === venue.id).length === 1);

  // Follows that point at a non-resolvable entity are inert but harmless.
  const inert = entities.followEntity(u1, 'venue', 'obj_ent_nope');
  check('follow of unknown entity records the edge (resolver stays authoritative)', inert.followed === true);
  check('unknown entity never appears in the following surface', entities.followingFeed(u1).every((s) => s.entityKey !== 'obj_ent_nope'));
}

// ---------------------------------------------------------------------------
// DOMAIN: FOLLOWING FEED (ranked, grouped, expired never active)
// ---------------------------------------------------------------------------
console.log('\n=== DOMAIN: FOLLOWING FEED ===');
{
  const u = 'usr_ent_feed';
  const venue = mkObject('obj_ent_ffv', { type: 'place', title: 'Karen Gardens', area: 'Karen' });
  const src = mkSource('src_ent_ffp', 'Feed Publisher');
  const a1 = mkObject('obj_ent_ff1', { type: 'news', title: 'Feed news one', area: 'Karen', publishedHoursAgo: 1, deadlineDays: 5 });
  const a2 = mkObject('obj_ent_ff2', { type: 'news', title: 'Feed news two', area: 'Karen', publishedHoursAgo: 40, deadlineDays: 5 });
  attachSources(a1.id, [src.id]);
  attachSources(a2.id, [src.id]);
  entities.followEntity(u, 'venue', venue.id);
  entities.followEntity(u, 'publisher', src.id);

  const feed = entities.followingFeed(u);
  check('following feed has one section per followed entity', feed.length === 2, `got ${feed.length}`);
  const venueSection = feed.find((s) => s.kind === 'venue');
  const pubSection = feed.find((s) => s.kind === 'publisher');
  check('feed sections carry entity identity', venueSection?.name === 'Karen Gardens' && pubSection?.name === 'Feed Publisher');
  check('feed objects are ranked by discovery score (descending)',
    pubSection.objects.every((o, i, arr) => i === 0 || arr[i - 1].score >= o.score),
    JSON.stringify(pubSection.objects.map((o) => o.score)));
  check('fresher news outranks older news', pubSection.objects[0].id === a1.id, JSON.stringify(pubSection.objects.map((o) => o.id)));
  check('feed objects carry temporal status', pubSection.objects.every((o) => o.temporal?.status));
  check('venue section carries the venue object', venueSection.objects.some((o) => o.id === venue.id));

  const expired = mkObject('obj_ent_ffx', { type: 'offer', title: 'Feed expired offer', area: 'Karen', deadlineDays: -2 });
  attachSources(expired.id, [src.id]);
  const feed2 = entities.followingFeed(u);
  const pub2 = feed2.find((s) => s.kind === 'publisher');
  check('expired content never appears in the following feed', !pub2.objects.some((o) => o.id === expired.id));

  entities.unfollowEntity(u, 'publisher', src.id);
  const feed3 = entities.followingFeed(u);
  check('unfollowed entity leaves the feed', feed3.length === 1 && feed3[0].kind === 'venue');

  const listed = entities.listFollows(u);
  check('follow management list has the remaining entity', listed.length === 1 && listed[0].entityKey === venue.id);
}

// ---------------------------------------------------------------------------
// DOMAIN: PERSONAL BRIEF INTEGRATION (explicit follow > inferred preference)
// ---------------------------------------------------------------------------
console.log('\n=== DOMAIN: PERSONAL BRIEF INTEGRATION ===');
{
  const u = 'usr_ent_pers';
  const interests = { locations: ['Kilimani'], types: ['offer'], topics: [] };
  const relevance = { more: new Set(), less: new Set(), notInterested: new Set(), hiddenSources: new Set() };
  // The venue entity created in the representation section (the offer joins it
  // through structured metadata.venue).
  const venue = store.find('objects', (o) => o.id === 'obj_ent_venue');
  // An ORDINARY offer: structured-metadata venue join to the followed venue,
  // low extraction confidence, a single low-confidence source.
  const offer = mkObject('obj_ent_po', { type: 'offer', title: 'Personal offer at the studio', area: 'Kilimani', deadlineDays: 5, venue: 'Kilimani Studio' });
  offer.extractionConfidence = 0.4;
  const weakSrc = mkSource('src_ent_weak', 'Weak Source');
  attachSources(offer.id, [weakSrc.id], 2, 0.5);

  const withoutFollow = personal.personalBoost(offer, interests, relevance, null);
  const withFollow = personal.personalBoost(offer, interests, relevance, new Set([`venue:${venue.id}`]));
  check('explicit entity follow adds a stronger signal than inferred location',
    withFollow.boost > withoutFollow.boost && withFollow.reasons.includes('followed'),
    JSON.stringify(withFollow));
  check('followed boost is bounded (global score stays primary)', withFollow.boost <= 8, `boost ${withFollow.boost}`);

  // A VERY IMPORTANT local alert (community_confirmed, six corroborations,
  // cross-source, fresh) still outranks an ordinary personalized offer, even
  // when the offer's venue is followed (no echo chamber).
  const alert = mkObject('obj_ent_pa', { type: 'alert', title: 'Security alert: major water outage across Nairobi', area: 'Nairobi', publishedHoursAgo: 1 });
  const alertSrc1 = mkSource('src_ent_pa1', 'Alert Source One');
  const alertSrc2 = mkSource('src_ent_pa2', 'Alert Source Two');
  attachSources(alert.id, [alertSrc1.id, alertSrc2.id], 1);
  for (let i = 0; i < 6; i++) trust.confirmObject(alert.id, `usr_ent_conf${i}`);
  const followed = new Set([`venue:${venue.id}`]);
  const scores = new Map([offer, alert].map((o) => [o.id, discovery.rankObject(o, { now })]));
  const rank = personal.rankPersonalized([offer, alert], { interests, relevance, scores, followedEntityKeys: followed });
  check('important local alert outranks an ordinary followed offer',
    rank.findIndex((r) => r.object.id === alert.id) < rank.findIndex((r) => r.object.id === offer.id),
    JSON.stringify(rank.map((r) => `${r.object.id}:${r.boost.boost}`)));

  // Explicit follow alone (no other preferences) personalizes the feed.
  const noPrefs = { locations: [], types: [], topics: [] };
  const solo = personal.personalBoost(offer, noPrefs, relevance, followed);
  check('a follow alone boosts its entity content', solo.boost > 0 && solo.reasons.includes('followed'), JSON.stringify(solo));
}

// ---------------------------------------------------------------------------
// DOMAIN: ENTITY SEARCH (extends object search)
// ---------------------------------------------------------------------------
console.log('\n=== DOMAIN: ENTITY SEARCH ===');
{
  const search = await import('../src/domain/search.js');
  const hits = search.search('Karen Gardens');
  check('entity search finds the venue by name', hits.entities.some((e) => e.kind === 'venue' && e.name === 'Karen Gardens'),
    JSON.stringify(hits.entities.map((e) => e.name)));
  check('entity search reports a count', hits.counts.entities >= 1, `count ${hits.counts.entities}`);
  check('entity search keeps object results first-class', Array.isArray(hits.objects));

  const single = search.search('Sarit Centre Expo');
  check('unique entity hit exposes entityMatch for direct navigation', single.entityMatch?.startsWith('venue:'), JSON.stringify(single.entityMatch));

  const none = search.search('zzzz-no-such-thing');
  check('no-match query yields no entities', none.entities.length === 0 && none.counts.entities === 0);
  check('no-match query still returns an empty object list', Array.isArray(none.objects) && none.objects.length === 0);

  const empty = search.search('');
  check('empty query yields no entity results', empty.entities.length === 0 && empty.counts.entities === 0);

  // Search must not leak non-public entities.
  const privateObj = mkObject('obj_ent_priv', { type: 'place', title: 'Private Hall', publication: 'private' });
  const priv = search.search('Private Hall');
  check('private objects never surface as entities in search', !priv.entities.some((e) => e.entityKey === privateObj.id));
}

// ---------------------------------------------------------------------------
// ROUTE CONTRACT (HTTP)
// ---------------------------------------------------------------------------
console.log('\n=== ROUTE CONTRACT (HTTP) ===');
{
  process.env.BRIEF_ADMINS = 'ent_admin';
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
    const venue = store.find('objects', (o) => o.id === 'obj_ent_venue');
    const entityId = `venue:${venue.id}`;
    const encoded = encodeURIComponent(entityId);

    // Entity page is PUBLIC (stable shareable URL) and honest.
    const anonPage = await call(`/api/entities/${encoded}`);
    check('anonymous entity page is public (200)', anonPage.status === 200, `got ${anonPage.status}`);
    check('entity page exposes the public projection', anonPage.body?.entity?.kind === 'venue' && anonPage.body.entity.name === 'Kilimani Studio');
    check('anonymous entity page shows no follow state', anonPage.body.entity.isFollowed === false);
    check('entity page never leaks relationship internals or credentials',
      !JSON.stringify(anonPage.body).includes('connectionStatus') && !JSON.stringify(anonPage.body).includes('accessType'));
    check('entity page lists the venue + structured-venue event', anonPage.body.entity.objects.some((o) => o.id === 'obj_ent_gig'));

    const missing = await call('/api/entities/venue%3Aobj_ent_nope');
    check('unknown entity page is 404', missing.status === 404, `got ${missing.status}`);
    const badId = await call('/api/entities/wat%3Azzz');
    check('malformed entity id is rejected', badId.status === 404 || badId.status === 400, `got ${badId.status}`);

    // Follow requires a real session.
    const anonFollow = await call(`/api/entities/${encoded}/follow`, 'POST', {});
    check('anonymous follow is refused (401)', anonFollow.status === 401, `got ${anonFollow.status}`);

    const reg = await call('/api/auth/register', 'POST', { handle: 'ent_user', password: 'pw-123456', displayName: 'Ent User' });
    check('user registers', reg.status === 201, `got ${reg.status}`);
    const token = reg.body?.token;
    const uid = store.all('users').find((u) => u.handle === 'ent_user')?.id;

    const follow = await call(`/api/entities/${encoded}/follow`, 'POST', {}, token);
    check('authenticated follow succeeds', follow.status === 200 && follow.body.followed === true && follow.body.followCount === 1, `got ${follow.status}`);
    const followAgain = await call(`/api/entities/${encoded}/follow`, 'POST', {}, token);
    check('follow is idempotent over HTTP', followAgain.body.already === true && followAgain.body.followCount === 1);
    const pageAsViewer = await call(`/api/entities/${encoded}`, 'GET', null, token);
    check('viewer sees their own follow state', pageAsViewer.body.entity.isFollowed === true);
    check('follow row is scoped to the viewer', store.filter('entityFollows', (f) => f.userId === uid && f.entityKey === venue.id).length === 1);

    // A second user never sees the first user's follows.
    const reg2 = await call('/api/auth/register', 'POST', { handle: 'ent_other', password: 'pw-123456', displayName: 'Other' });
    const token2 = reg2.body?.token;
    const otherPage = await call(`/api/entities/${encoded}`, 'GET', null, token2);
    check('another user sees the entity as not followed', otherPage.body.entity.isFollowed === false);

    // Personal Brief state now includes the follow; the feed boosts it.
    const me = await call('/api/me', 'GET', null, token);
    check('personal state lists the followed entity', me.body.followed.some((f) => f.id === entityId), JSON.stringify(me.body.followed));
    const feed = await call('/api/me/feed', 'GET', null, token);
    const feedObj = feed.body.objects.find((o) => o.id === 'obj_ent_po');
    check('personal feed boosts the followed entity content', Boolean(feedObj) && feedObj.personal?.reasons?.includes('followed'), JSON.stringify(feedObj?.personal));

    // Following surface over HTTP.
    const following = await call('/api/me/following', 'GET', null, token);
    check('following feed 200 with sections', following.status === 200 && following.body.sections.length >= 1, `got ${following.status}`);
    const vSec = following.body.sections.find((s) => s.entityId === entityId);
    check('following feed contains the followed venue section', Boolean(vSec) && vSec.name === 'Kilimani Studio');
    check('following feed rows carry temporal status', vSec.objects.every((o) => o.temporal?.status));
    const follows = await call('/api/me/follows', 'GET', null, token);
    check('follows management list is grouped by kind', follows.status === 200 && Array.isArray(follows.body.groups.venue) && follows.body.groups.venue.some((f) => f.id === entityId), `got ${follows.status}`);

    // Entity search over HTTP (extends object search).
    const searchRes = await call('/api/search?q=Kilimani%20Studio', 'GET', null, token);
    check('search returns entity hits alongside object hits',
      searchRes.status === 200 && searchRes.body.results?.entities?.some((e) => e.id === entityId),
      JSON.stringify(searchRes.body?.results?.entities?.map((e) => e.id)));
    check('search counts entities', searchRes.body.results?.counts?.entities >= 1);

    // Entity activity analytics: exactly the five tracked acts.
    const before = store.filter('signals', (s) => s.type.startsWith('entity_') || s.type === 'source_opened').length;
    await call(`/api/entities/${encoded}`, 'GET', null, token); // entity_viewed
    await call(`/api/entities/${encoded}/object-opened`, 'POST', { objectId: 'obj_ent_gig' }, token);
    await call(`/api/entities/${encoded}/source-opened`, 'POST', { sourceId: 'src_ent_pub' }, token);
    const sigs = store.filter('signals', (s) => s.actorId === uid);
    check('entity viewed signal recorded', sigs.some((s) => s.type === 'entity_viewed'));
    check('entity followed signal recorded', sigs.some((s) => s.type === 'entity_followed'));
    check('entity object opened signal recorded', sigs.some((s) => s.type === 'entity_object_opened' && s.objectId === 'obj_ent_gig'));
    check('source opened signal recorded', sigs.some((s) => s.type === 'source_opened' && s.sourceId === 'src_ent_pub'));
    const dash = analytics.dashboard();
    check('analytics dashboard reports entity engagement',
      dash.engagement.entityViews >= 1 && dash.engagement.entityFollows >= 1 && dash.engagement.entityObjectOpens >= 1 && dash.engagement.sourceOpens >= 1,
      JSON.stringify(dash.engagement));

    // Unfollow over HTTP; the feed drops the section.
    const unfollow = await call(`/api/entities/${encoded}/follow`, 'DELETE', {}, token);
    check('authenticated unfollow succeeds', unfollow.status === 200 && unfollow.body.unfollowed === true && unfollow.body.followCount === 0, `got ${unfollow.status}`);
    const sigsAfter = store.filter('signals', (s) => s.actorId === uid);
    check('entity unfollowed signal recorded', sigsAfter.some((s) => s.type === 'entity_unfollowed'));
    const feedAfter = await call('/api/me/following', 'GET', null, token);
    check('unfollowed entity leaves the following feed', !feedAfter.body.sections.some((s) => s.entityId === entityId));

    // A user cannot mutate another user's follows (self-scoped routes only).
    const otherUnfollow = await call(`/api/entities/${encoded}/follow`, 'DELETE', {}, token2);
    check('another user unfollowing their own (non-)follow is a no-op, not an error', otherUnfollow.status === 200 && otherUnfollow.body.already === true);

    // Shared entity pages stay stable across follow changes (same id → same entity).
    const stable = await call(`/api/entities/${encoded}`, 'GET');
    check('entity share URL stays stable and public after state changes', stable.status === 200 && stable.body.entity.id === entityId);
  } finally {
    srv.close();
  }
}

console.log(`\n${'='.repeat(52)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
process.exit(fail ? 1 : 0);
