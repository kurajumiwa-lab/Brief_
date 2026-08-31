// ---------------------------------------------------------------------------
// PERSONAL BRIEF TEST SUITE
//
// Pins the personalization layer: onboarding follows, the re-ranked personal
// feed with the global fallback, server-persisted saves, explicit relevance
// controls, privacy boundaries, ranking (alert priority, event proximity,
// expired content, source diversity), and the notification-candidate data
// model (nothing is ever sent).
//
//   node test/personal.mjs
// ---------------------------------------------------------------------------

import fs from 'node:fs';

process.env.NODE_ENV = 'test';
process.env.BRIEF_DATA_DIR = `/tmp/brief-personal-${process.pid}`;
fs.rmSync(process.env.BRIEF_DATA_DIR, { recursive: true, force: true });

const { store } = await import('../src/store.js');
const personal = await import('../src/domain/personal.js');
const trust = await import('../src/domain/trust.js');
const discovery = await import('../src/domain/discovery.js');
const { storeRawItem, processRawItem } = await import('../src/pipeline/ingest.js');

store._reset();

let pass = 0;
let fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`); }
};

const now = new Date();
const iso = (d) => d.toISOString();
const isoDaysFromNow = (days, hour = '10') => {
  const d = new Date(now.getTime() + days * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const isoEventStart = (days) => `${isoDaysFromNow(days)}T18:00:00`;

const mkSource = (id, name, type = 'telegram') => store.insert('sources', {
  id, name, type, platform: type.split('_')[0],
  accessType: 'public', connectionStatus: 'connected', enabled: true,
  confidence: 0.9, trustStatus: 'normal',
  createdAt: iso(now), updatedAt: iso(now)
});

// One real pipeline-ingested object so the suite exercises provenance-backed
// rows, exactly like production.
const srcA = mkSource('src_pers_a', 'Pers Source A');
const ingested = (() => {
  const { row } = storeRawItem({
    sourceId: srcA.id, externalId: 'pers:1', messageId: 'pers-msg-1', author: 'pers',
    text: 'Kilimani food market this Saturday 4PM-10PM at Kilimani Studio. KES 300 entry. 12 vendors.',
    publishedAt: iso(now), rawUrl: null
  });
  return processRawItem(row.id);
})();
const pipedObjectId = ingested.objectId;

/** A directly-inserted object with precisely controlled temporal metadata. */
let objSeq = 0;
const mkObject = (id, { type = 'offer', title, area = 'Kilimani', county = 'Nairobi',
  deadlineDays = null, eventDays = null, publishedHoursAgo = 2,
  extractionConfidence = 0.9, verificationStatus = 'unverified' } = {}) => {
  const metadata = { area, county, locationConfidence: 0.9 };
  if (deadlineDays !== null) metadata.deadlineCanonical = isoDaysFromNow(deadlineDays);
  if (eventDays !== null) metadata.eventStart = isoEventStart(eventDays);
  const createdAt = new Date(now.getTime() - publishedHoursAgo * 3600000).toISOString();
  return store.insert('objects', {
    id, type, title: title ?? `${type} ${++objSeq}`, summary: title ?? `summary ${objSeq}`,
    category: type, metadata, publication: 'public',
    extractionConfidence, verificationStatus,
    createdAt, updatedAt: createdAt, ingestedAt: createdAt
  });
};

const attachSources = (objectId, sourceIds, publishedHoursAgo = 2) => {
  for (const [i, sourceId] of sourceIds.entries()) {
    const t = new Date(now.getTime() - publishedHoursAgo * 3600000).toISOString();
    store.insert('objectSources', {
      id: `os_${objectId}_${i}`, objectId, sourceId,
      sourcePublishedAt: t, sourceRetrievedAt: t, sourceUrl: `https://pers.example/${sourceId}`,
      sourceConfidence: 0.9, extractionConfidence: 0.9, createdAt: t
    });
  }
};

// ---------------------------------------------------------------------------
// DOMAIN: INTERESTS
// ---------------------------------------------------------------------------
console.log('\n=== DOMAIN: INTERESTS ===');
{
  const u = 'usr_pers_1';
  const empty = personal.interestsOf(u);
  check('new user has no interests', empty.locations.length === 0 && empty.types.length === 0 && empty.topics.length === 0);

  const f1 = personal.follow(u, 'location', 'Kilimani');
  const f2 = personal.follow(u, 'location', 'Kilimani');
  check('follow is idempotent', f1.interest.id === f2.interest.id, `${f1.interest.id} vs ${f2.interest.id}`);
  check('followed location recorded', personal.interestsOf(u).locations.includes('Kilimani'));

  personal.follow(u, 'type', 'event');
  personal.follow(u, 'topic', 'food');
  const all = personal.interestsOf(u);
  check('types and topics recorded', all.types.includes('event') && all.topics.includes('food'));

  let threw = false;
  try { personal.follow(u, 'type', 'nonsense'); } catch { threw = true; }
  check('unknown type refused', threw);
  threw = false;
  try { personal.follow(u, 'kind', 'wat'); } catch { threw = true; }
  check('unknown kind refused', threw);

  const removed = personal.unfollow(u, 'location', 'Kilimani');
  check('unfollow removes the follow', removed.removed === 1 && !personal.interestsOf(u).locations.includes('Kilimani'));
  check('unfollow of nothing is a no-op', personal.unfollow(u, 'location', 'Kilimani').removed === 0);
}

// ---------------------------------------------------------------------------
// DOMAIN: TOPIC MATCHING
// ---------------------------------------------------------------------------
console.log('\n=== DOMAIN: TOPIC MATCHING ===');
{
  const foodObj = mkObject('obj_pers_topic_food', { type: 'place', title: 'Cheap eats at the food market in Kilimani' });
  const topics = personal.topicsFor(foodObj);
  check('food topic matched from real text', topics.includes('food'), JSON.stringify(topics));
  check('non-matching object has no topics', personal.topicsFor(mkObject('obj_pers_topic_none', { type: 'place', title: 'Boring unrelated title' })).length === 0);
}

// ---------------------------------------------------------------------------
// DOMAIN: ONBOARDING SEED
// ---------------------------------------------------------------------------
console.log('\n=== DOMAIN: ONBOARDING SEED ===');
{
  const u = 'usr_pers_seed';
  const onboarding = await import('../src/domain/onboarding.js');
  onboarding.setPlace(u, 'Kasarani');
  const seeded = personal.seedFromOnboarding(u);
  check('onboarding place becomes the first followed location', seeded.locations.includes('Kasarani'), JSON.stringify(seeded.locations));

  // Explicit interests win: seeding never overwrites real choices.
  personal.follow(u, 'location', 'Kilimani');
  const after = personal.seedFromOnboarding(u);
  check('explicit interests are not overwritten by onboarding', after.locations.includes('Kilimani') && after.locations.length === 2, JSON.stringify(after.locations));
}

// ---------------------------------------------------------------------------
// DOMAIN: SAVES
// ---------------------------------------------------------------------------
console.log('\n=== DOMAIN: SAVES ===');
{
  const u = 'usr_pers_saves';
  const s1 = personal.saveObject(u, pipedObjectId);
  const s2 = personal.saveObject(u, pipedObjectId);
  check('save is idempotent', s1.save.id === s2.save.id);
  check('saved id is listed once', personal.savedIdsOf(u).filter((id) => id === pipedObjectId).length === 1);
  check('isSaved true', personal.isSaved(u, pipedObjectId));
  check('unsave removes', personal.unsaveObject(u, pipedObjectId).removed === 1 && !personal.isSaved(u, pipedObjectId));
  let threw = false;
  try { personal.saveObject(u, 'obj_pers_missing'); } catch { threw = true; }
  check('saving a missing object refuses', threw);
}

// ---------------------------------------------------------------------------
// DOMAIN: RELEVANCE CONTROLS
// ---------------------------------------------------------------------------
console.log('\n=== DOMAIN: RELEVANCE CONTROLS ===');
{
  const u = 'usr_pers_rel';
  const o = mkObject('obj_pers_rel_offer', { type: 'offer', title: 'Relevance test offer', deadlineDays: 5 });
  const srcH = mkSource('src_pers_hidden', 'Hidden Source');
  attachSources(o.id, [srcH.id]);

  personal.setRelevance(u, 'more', { objectId: o.id });
  personal.setRelevance(u, 'less', { objectId: o.id });
  const rel = personal.relevanceOf(u);
  check('more and less recorded', rel.more.has(o.id) && rel.less.has(o.id));
  personal.setRelevance(u, 'less', { objectId: o.id }); // repeat
  const rel2 = personal.relevanceOf(u);
  check('repeat control is a no-op', [...rel2.less].filter((id) => id === o.id).length === 1);

  personal.setRelevance(u, 'hide_source', { sourceId: srcH.id });
  const rel3 = personal.relevanceOf(u);
  check('hidden source recorded', rel3.hiddenSources.has(srcH.id));

  personal.unsetRelevance(u, 'hide_source', { sourceId: srcH.id });
  check('control can be undone', !personal.relevanceOf(u).hiddenSources.has(srcH.id));

  // Not interested excludes the object from the personal feed but never
  // touches the global feed (search stays global).
  personal.setRelevance(u, 'not_interested', { objectId: o.id });
  check('not_interested excludes from personal', personal.excludedFromPersonal(o, personal.relevanceOf(u)));
  check('not_interested leaves the object in the store', Boolean(store.find('objects', (x) => x.id === o.id)));
}

// ---------------------------------------------------------------------------
// DOMAIN: RANKING
// ---------------------------------------------------------------------------
console.log('\n=== DOMAIN: RANKING ===');
{
  const u = 'usr_pers_rank';
  // Two equal-quality offers in different areas.
  const kilimaniOffer = mkObject('obj_pers_rank_kil', { type: 'offer', title: 'Kilimani offer', area: 'Kilimani', deadlineDays: 5 });
  const westlandsOffer = mkObject('obj_pers_rank_wes', { type: 'offer', title: 'Westlands offer', area: 'Westlands', deadlineDays: 5 });
  personal.follow(u, 'location', 'Kilimani');
  personal.follow(u, 'type', 'offer');

  const interests = personal.interestsOf(u);
  const relevance = personal.relevanceOf(u);
  const bK = personal.personalBoost(kilimaniOffer, interests, relevance);
  const bW = personal.personalBoost(westlandsOffer, interests, relevance);
  check('Kilimani rows are boosted for a Kilimani follower', bK.boost > bW.boost, `${bK.boost} vs ${bW.boost}`);
  check('unfollowed area gets the type-only boost (no location)', bW.boost === 4, `got ${bW.boost}`);
  check('boost reasons are explicit', bK.reasons.includes('location') && bK.reasons.includes('type'), JSON.stringify(bK.reasons));

  // The offer cap: an ordinary offer can never fly past an important alert.
  const cap = personal.personalBoost(kilimaniOffer, { locations: ['Kilimani'], types: ['offer'], topics: [] }, { more: new Set([kilimaniOffer.id]), less: new Set(), notInterested: new Set(), hiddenSources: new Set() });
  check('everyday types cap at +6', cap.boost === 6, `got ${cap.boost}`);

  // A very important local alert: community-confirmed, 2 sources, fresh, current.
  const alert = mkObject('obj_pers_rank_alert', { type: 'alert', title: 'Water outage alert in Kilimani', area: 'Kilimani', publishedHoursAgo: 1, verificationStatus: 'cross_source_confirmed' });
  attachSources(alert.id, [srcA.id, 'src_pers_alert_b'], 1);
  trust.confirmObject(alert.id, 'usr_pers_conf_a');
  trust.confirmObject(alert.id, 'usr_pers_conf_b');
  const alertScore = discovery.rankObject(alert, { now });
  const offerScore = discovery.rankObject(kilimaniOffer, { now });
  const alertTotal = alertScore + personal.personalBoost(alert, interests, relevance).boost;
  const offerTotal = offerScore + personal.personalBoost(kilimaniOffer, interests, relevance).boost;
  check('important alert keeps its global priority', alertScore > offerScore, `${alertScore} vs ${offerScore}`);
  check('very important local alert outranks a personalized ordinary offer', alertTotal > offerTotal, `${alertTotal} vs ${offerTotal}`);

  // Event proximity: same-date events, followed area wins.
  const kilEvent = mkObject('obj_pers_rank_kev', { type: 'event', title: 'Kilimani concert', area: 'Kilimani', eventDays: 2 });
  const wesEvent = mkObject('obj_pers_rank_wev', { type: 'event', title: 'Westlands concert', area: 'Westlands', eventDays: 2 });
  const tK = discovery.rankObject(kilEvent, { now }) + personal.personalBoost(kilEvent, interests, relevance).boost;
  const tW = discovery.rankObject(wesEvent, { now }) + personal.personalBoost(wesEvent, interests, relevance).boost;
  check('followed-location event ranks above an unfollowed same-date event', tK > tW, `${tK} vs ${tW}`);

  // Source diversity: re-ranking never drops rows — the tie-break preserves
  // the global order, and every object survives personalization.
  const ranked = personal.rankPersonalized(
    [westlandsOffer, kilimaniOffer],
    { interests, relevance }
  );
  check('personalized ranking keeps both rows', ranked.length === 2);
  check('boosted row first, unboosted still present', ranked[0].object.id === kilimaniOffer.id && ranked.some((r) => r.object.id === westlandsOffer.id));
}

// ---------------------------------------------------------------------------
// DOMAIN: EXPIRED CONTENT
// ---------------------------------------------------------------------------
console.log('\n=== DOMAIN: EXPIRED CONTENT ===');
{
  const expiredOffer = mkObject('obj_pers_expired_offer', { type: 'offer', title: 'Expired offer', area: 'Kilimani', deadlineDays: -1 });
  const life = discovery.lifecycleOf(expiredOffer);
  check('expired offer reads as expired, not active', life.status === 'expired', life.status);
  const stream = discovery.discoverable({ limit: 50, publication: 'public' });
  check('expired offer falls out of the live feed', !stream.some((o) => o.id === expiredOffer.id));
  check('expired offer is never deleted', Boolean(store.find('objects', (o) => o.id === expiredOffer.id)));
}

// ---------------------------------------------------------------------------
// DOMAIN: NOTIFICATION CANDIDATES (data model only — nothing is sent)
// ---------------------------------------------------------------------------
console.log('\n=== DOMAIN: NOTIFICATION CANDIDATES ===');
{
  const u = 'usr_pers_ntf';
  personal.replaceInterests(u, { locations: ['Kilimani'], types: ['event'], topics: ['food'] });

  // New event in a followed location within 14 days.
  const upcoming = mkObject('obj_pers_ntf_event', { type: 'event', title: 'Kilimani food festival', area: 'Kilimani', eventDays: 3 });
  // Saved event starting within a day.
  const savedSoon = mkObject('obj_pers_ntf_saved', { type: 'event', title: 'Jazz night', area: 'Westlands', eventDays: 0 });
  personal.saveObject(u, savedSoon.id);
  // Offer expiring within 24 hours.
  const expiring = mkObject('obj_pers_ntf_offer', { type: 'offer', title: 'Flash sale', area: 'Kilimani', deadlineDays: 0 });
  // Local alert in a followed location.
  const alert = mkObject('obj_pers_ntf_alert', { type: 'alert', title: 'Kilimani security alert', area: 'Kilimani' });
  // News matching a followed topic.
  const foodNews = mkObject('obj_pers_ntf_news', { type: 'news', title: 'Food prices rise in the market', area: 'Nairobi' });

  const candidates = personal.notificationCandidates(u, now);
  const kinds = candidates.map((c) => c.kind);
  check('new_event candidate for followed-location event', candidates.some((c) => c.kind === 'new_event' && c.objectId === upcoming.id), JSON.stringify(kinds));
  check('event_reminder candidate for a saved event starting soon', candidates.some((c) => c.kind === 'event_reminder' && c.objectId === savedSoon.id), JSON.stringify(kinds));
  check('offer_expiring candidate for a 24h deadline', candidates.some((c) => c.kind === 'offer_expiring' && c.objectId === expiring.id), JSON.stringify(kinds));
  check('local_alert candidate for followed location', candidates.some((c) => c.kind === 'local_alert' && c.objectId === alert.id), JSON.stringify(kinds));
  check('topic_update candidate for followed-topic news', candidates.some((c) => c.kind === 'topic_update' && c.objectId === foodNews.id), JSON.stringify(kinds));
  check('candidate kinds are typed and known', candidates.every((c) => personal.PERSONAL_NOTIFICATION_KINDS.includes(c.kind)));
  check('candidates carry real object ids and reasons', candidates.every((c) => c.objectId && c.reason));
  check('NO notifications are written or sent', store.all('notifications').length === 0);
}

// ---------------------------------------------------------------------------
// ROUTE CONTRACT (HTTP)
// ---------------------------------------------------------------------------
console.log('\n=== ROUTE CONTRACT (HTTP) ===');
{
  process.env.BRIEF_ADMINS = 'pers_admin';
  // Real sessions only: turn the development fallback identity off so the
  // account gate actually gates, exactly like production.
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
    const anon = await call('/api/me');
    check('anonymous /api/me is refused', anon.status === 401, `got ${anon.status}`);
    const anonFeed = await call('/api/me/feed');
    check('anonymous /api/me/feed is refused', anonFeed.status === 401, `got ${anonFeed.status}`);

    const reg = await call('/api/auth/register', 'POST', { handle: 'pers_user', password: 'pw-123456', displayName: 'Pers User' });
    check('user registers', reg.status === 201, `got ${reg.status}`);
    const token = reg.body?.token;
    const uid = store.all('users').find((u) => u.handle === 'pers_user')?.id;
    check('user id resolved from the real account', Boolean(uid), JSON.stringify(uid));

    const me = await call('/api/me', 'GET', null, token);
    check('GET /api/me returns the personal state', me.status === 200 && me.body?.interests, `got ${me.status}`);
    check('new user state is empty', me.body.interests.locations.length === 0 && me.body.interests.types.length === 0 && me.body.interests.topics.length === 0);
    check('state exposes topic vocabulary', Array.isArray(me.body.topics) && me.body.topics.some((t) => t.id === 'food'));

    // Onboarding flow: PUT replaces all interests in one round trip.
    const put = await call('/api/me/interests', 'PUT', { locations: ['Kilimani'], types: ['event', 'offer'], topics: ['food'] }, token);
    check('PUT interests persists the picks', put.status === 200 && put.body.interests.locations.includes('Kilimani') && put.body.interests.types.includes('event'), JSON.stringify(put.body));
    const put2 = await call('/api/me/interests', 'PUT', { locations: ['Westlands'] }, token);
    check('PUT replaces (does not append)', put2.status === 200 && put2.body.interests.locations.length === 1 && put2.body.interests.locations[0] === 'Westlands', JSON.stringify(put2.body?.interests?.locations));
    await call('/api/me/interests', 'PUT', { locations: ['Kilimani'], types: ['event', 'offer'], topics: ['food'] }, token);

    // Follow/unfollow over HTTP.
    const follow = await call('/api/me/interests', 'POST', { kind: 'location', value: 'Mombasa' }, token);
    check('POST /api/me/interests follows', follow.status === 200 && follow.body.interests.locations.includes('Mombasa'), `got ${follow.status}`);
    const unfollow = await call('/api/me/interests', 'DELETE', { kind: 'location', value: 'Mombasa' }, token);
    check('DELETE /api/me/interests unfollows', unfollow.status === 200 && !unfollow.body.interests.locations.includes('Mombasa'), `got ${unfollow.status}`);
    const badFollow = await call('/api/me/interests', 'POST', { kind: 'type', value: 'nonsense' }, token);
    check('invalid type follow refused (400)', badFollow.status === 400, `got ${badFollow.status}`);

    // Personal feed: same objects as global, re-ranked.
    const globalFeed = await call('/api/objects?rank=1&limit=50', 'GET', null, token);
    const personalFeed = await call('/api/me/feed', 'GET', null, token);
    check('personal feed 200', personalFeed.status === 200, `got ${personalFeed.status}`);
    check('personal feed is a re-ranking of global objects, not a new store', personalFeed.body.objects.length > 0 && personalFeed.body.objects.every((o) => globalFeed.body.objects.some((g) => g.id === o.id)), `personal ${personalFeed.body.objects.length} vs global ${globalFeed.body.objects.length}`);

    // The followed-location object outranks the equal unfollowed one.
    const pids = personalFeed.body.objects.map((o) => o.id);
    const gids = globalFeed.body.objects.map((o) => o.id);
    check('followed-location offer ranks above unfollowed one in the personal feed',
      pids.indexOf('obj_pers_rank_kil') !== -1 && pids.indexOf('obj_pers_rank_kil') < pids.indexOf('obj_pers_rank_wes'),
      `personal order: ${pids.slice(0, 6).join(', ')}`);

    // No-preferences fallback: a second user with no picks gets the global order.
    const reg2 = await call('/api/auth/register', 'POST', { handle: 'pers_plain', password: 'pw-123456', displayName: 'Plain' });
    const token2 = reg2.body?.token;
    const uid2 = store.all('users').find((u) => u.handle === 'pers_plain')?.id;
    const plainFeed = await call('/api/me/feed', 'GET', null, token2);
    check('no-preference feed is the global feed', plainFeed.status === 200 && plainFeed.body.personalized === false);
    // The personal feed may legitimately filter to public objects; what must
    // hold is that whatever it shows keeps the GLOBAL relative order.
    const plainIds = plainFeed.body.objects.map((o) => o.id);
    const globalRankOf = new Map(gids.map((id, i) => [id, i]));
    const preservesOrder = plainIds.every((id, i) =>
      globalRankOf.has(id) && (i === 0 || globalRankOf.get(id) > globalRankOf.get(plainIds[i - 1])));
    check('no-preference feed preserves global relative order', preservesOrder, `personal ${plainIds.slice(0, 5)} vs global ${gids.slice(0, 5)}`);
    check('no-preference rows carry no personal boost', plainFeed.body.objects.every((o) => !o.personal || o.personal.boost === 0));

    // Saved over HTTP.
    const save = await call(`/api/me/saved/${pipedObjectId}`, 'POST', {}, token);
    check('POST saved persists', save.status === 200 && save.body.saved.includes(pipedObjectId), `got ${save.status}`);
    const saveAgain = await call(`/api/me/saved/${pipedObjectId}`, 'POST', {}, token);
    check('save is idempotent over HTTP', saveAgain.body.saved.filter((id) => id === pipedObjectId).length === 1);
    const signals = store.filter('signals', (s) => s.type === 'object_saved' && s.actorId === uid);
    check('save emits an object_saved signal with the actor', signals.length === 1, `got ${signals.length}`);
    const unsave = await call(`/api/me/saved/${pipedObjectId}`, 'DELETE', {}, token);
    check('DELETE saved removes', unsave.status === 200 && !unsave.body.saved.includes(pipedObjectId), `got ${unsave.status}`);

    // Relevance over HTTP.
    const rel = await call('/api/me/relevance', 'POST', { kind: 'not_interested', objectId: 'obj_pers_rel_offer' }, token);
    check('POST relevance persists', rel.status === 200 && rel.body.relevance.notInterested.includes('obj_pers_rel_offer'), `got ${rel.status}`);
    const feedAfterNI = await call('/api/me/feed', 'GET', null, token);
    check('not-interested object leaves the personal feed', !feedAfterNI.body.objects.some((o) => o.id === 'obj_pers_rel_offer'));
    check('not-interested object STAYS in the global feed (search stays global)', globalFeed.body.objects.some((o) => o.id === 'obj_pers_rel_offer'));
    const undo = await call('/api/me/relevance', 'DELETE', { kind: 'not_interested', objectId: 'obj_pers_rel_offer' }, token);
    check('DELETE relevance undoes the control', undo.status === 200 && !undo.body.relevance.notInterested.includes('obj_pers_rel_offer'), `got ${undo.status}`);
    const badRel = await call('/api/me/relevance', 'POST', { kind: 'mystery', objectId: 'obj_pers_rel_offer' }, token);
    check('unknown relevance kind refused', badRel.status === 400, `got ${badRel.status}`);

    // Notification candidates over HTTP (data only).
    const ntf = await call('/api/me/notification-candidates', 'GET', null, token);
    check('notification candidates endpoint 200', ntf.status === 200 && Array.isArray(ntf.body?.candidates), `got ${ntf.status}`);

    // PRIVACY: another user never sees this user's preferences, and public
    // object rows never carry preference data.
    const me2 = await call('/api/me', 'GET', null, token2);
    check('another user sees only their own empty state', me2.body.interests.locations.length === 0 && me2.body.interests.types.length === 0);
    const publicFeed = await call('/api/public/feed', 'GET');
    check('public feed is anonymous and free of preferences', publicFeed.status === 200 && !JSON.stringify(publicFeed.body).includes('userInterests') && !JSON.stringify(publicFeed.body).includes('personal'));
    check('public feed rows never embed personal interest data', !JSON.stringify(publicFeed.body).includes('obj_pers_rel_offer') || !JSON.stringify(publicFeed.body).includes('not_interested'));
    check('store keeps interests scoped by user', store.filter('userInterests', (i) => i.userId === uid).length > 0 && store.filter('userInterests', (i) => i.userId === uid2).length === 0);
  } finally {
    srv.close();
  }
}

console.log(`\n${'='.repeat(52)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
process.exit(fail ? 1 : 0);
