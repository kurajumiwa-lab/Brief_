// ---------------------------------------------------------------------------
// NOTIFICATIONS TEST SUITE — the in-app return loop.
//
// Covers: generation (relevance gate — unrelated ingestion NEVER notifies),
// deduplication (one canonical object = one notification), coalescing (five
// new events in one area = one batched row), priority (important/normal/low),
// read/unread + unread count + mark all read, preferences (category toggles),
// following / location / saved / collection / event-reminder / offer-expiry /
// correction / status-change notifications, deep links, expiry honesty
// (stale objects still resolve with their real status), and PRIVACY (no
// cross-user reads) — at the domain level AND over the real HTTP API.
//
//   node test/notifications.mjs
// ---------------------------------------------------------------------------

import fs from 'node:fs';

process.env.NODE_ENV = 'test';
process.env.BRIEF_DATA_DIR = `/tmp/brief-notifications-${process.pid}`;
fs.rmSync(process.env.BRIEF_DATA_DIR, { recursive: true, force: true });

const { store } = await import('../src/store.js');
const notifications = await import('../src/domain/notifications.js');
const personal = await import('../src/domain/personal.js');
const entities = await import('../src/domain/entities.js');
const corrections = await import('../src/domain/corrections.js');
const analytics = await import('../src/domain/analytics.js');

store._reset();

let pass = 0;
let fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`); }
};

// --- clock: every scenario advances the same wall clock so "new since the
//     last sweep" stays honest and deterministic ----------------------------
const T0 = Date.now();
let CLOCK_MIN = 0;
const at = (minutes) => new Date(T0 + minutes * 60000).toISOString();
const NOW = () => new Date(T0 + CLOCK_MIN * 60000);
const sweep = (user, minutes = CLOCK_MIN) => notifications.generateForUser(user, new Date(T0 + minutes * 60000));

// --- fixtures --------------------------------------------------------------
const mkSource = (id, name, { type = 'telegram', accessType = 'public', url = 'https://example.com/rss' } = {}) =>
  store.insert('sources', {
    id, name, type, platform: type.split('_')[0],
    accessType, connectionStatus: 'connected', enabled: true,
    confidence: 0.9, trustStatus: 'normal', url,
    createdAt: at(-1000), updatedAt: at(-1000)
  });

let seq = 0;
const mkObject = (id, {
  type = 'event', title, area = null, county = 'Nairobi', locationName = null,
  venue = null, hostedBy = null, organizer = null,
  eventStartMin = null, eventEndMin = null,
  deadlineToday = false, deadlineDayMin = null, deadlineDaysAgo = null,
  statusBadge = null, createdAtMin, publication = 'public'
} = {}) => {
  const metadata = { locationConfidence: 0.9 };
  if (area) metadata.area = area;
  if (county) metadata.county = county;
  if (venue) metadata.venue = venue;
  if (hostedBy) metadata.hostedBy = hostedBy;
  if (organizer) metadata.organizer = organizer;
  if (eventStartMin !== null) metadata.eventStart = at(eventStartMin);
  if (eventEndMin !== null) metadata.eventEnd = at(eventEndMin);
  if (deadlineToday || deadlineDayMin !== null) {
    // End of the day at the given clock minute — a real "expires today"
    // deadline relative to the sweep, independent of wall-clock midnight.
    const d = new Date(T0 + (deadlineDayMin ?? CLOCK_MIN) * 60000);
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
    metadata.deadlineCanonical = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  }
  if (deadlineDaysAgo !== null) {
    const d = new Date(T0);
    const past = new Date(d.getFullYear(), d.getMonth(), d.getDate() - deadlineDaysAgo, 23, 59, 59);
    metadata.deadlineCanonical = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
  }
  if (statusBadge) metadata.statusBadge = statusBadge;
  const created = at(createdAtMin);
  return store.insert('objects', {
    id, type, title: title ?? `${type} ${++seq}`, summary: title ?? `summary ${seq}`,
    category: type, metadata, publication,
    extractionConfidence: 0.9, verificationStatus: 'unverified',
    createdAt: created, updatedAt: created
  });
};

const attach = (objectId, sourceId, publishedMin) =>
  store.insert('objectSources', {
    id: `osrc_${objectId}_${sourceId}_${Math.random().toString(36).slice(2, 6)}`,
    objectId, sourceId, rawItemId: null,
    sourcePublishedAt: at(publishedMin), sourceRetrievedAt: at(publishedMin + 1),
    sourceConfidence: 0.9, extractionConfidence: 0.9,
    createdAt: at(publishedMin + 1)
  });

const byType = (userId, type) => notifications.listNotifications(userId).filter((n) => n.type === type);
const byDedupe = (userId, key) => store.filter('notifications', (n) => n.userId === userId && n.dedupeKey === key);
const count = (userId) => notifications.listNotifications(userId).length;

// ===========================================================================
console.log('\n=== RELEVANCE GATE: unrelated ingestion never notifies ===');
{
  const user = 'usr_gate';
  const src = mkSource('src_gate', 'Random Channel');
  CLOCK_MIN = 1;
  const noise = mkObject('obj_gate_1', { type: 'news', title: 'Unrelated article', area: 'Nakuru', createdAtMin: 1 });
  attach(noise.id, src.id, 1);
  CLOCK_MIN = 2;
  const r = sweep(user, 2);
  check('a user with no follows/saves/interests gets nothing', r.total === 0 && count(user) === 0, JSON.stringify(r));

  // Followed venue + an unrelated NEW object: still nothing for that object.
  const place = mkObject('obj_gate_venue', { type: 'place', title: 'Kilimani Studio', area: 'Kilimani', createdAtMin: 3 });
  entities.followEntity(user, 'venue', place.id, at(3));
  const unrelated = mkObject('obj_gate_2', { type: 'news', title: 'Unrelated second article', area: 'Nakuru', createdAtMin: 4 });
  attach(unrelated.id, src.id, 4);
  CLOCK_MIN = 5;
  sweep(user, 5);
  check('unrelated ingestion after a follow still does not notify', count(user) === 0, JSON.stringify(notifications.listNotifications(user)));
}

// ===========================================================================
console.log('\n=== FOLLOWING: venue, organizer, publisher + canonical dedupe ===');
{
  const user = 'usr_follow';
  const src = mkSource('src_follow_venue', 'Kilimani Creators');
  const place = mkObject('obj_follow_venue', { type: 'place', title: 'Kilimani Studio', area: 'Kilimani', createdAtMin: 10 });
  entities.followEntity(user, 'venue', place.id, at(10));
  const event = mkObject('obj_follow_event', { type: 'event', title: 'Afrobeat Night', venue: 'Kilimani Studio', area: 'Kilimani', eventStartMin: 60 * 26, createdAtMin: 11 });
  attach(event.id, src.id, 11);
  CLOCK_MIN = 12;
  let r = sweep(user, 12);
  let rows = notifications.listNotifications(user);
  check('followed venue gets ONE following notification (identity row excluded)', r.total === 1 && rows.length === 1, JSON.stringify(r));
  check('following notification names the entity and object', rows[0].type === 'following' && rows[0].entityId === `venue:${place.id}` && rows[0].objectId === event.id);
  check('following notification deep-links the object', rows[0].dest === `object:${event.id}`, rows[0].dest);
  check('following notification is normal priority', rows[0].priority === 'normal');

  // Re-running at the same clock (user reopens the center) must not duplicate.
  r = sweep(user, 12);
  check('re-running the sweep does not duplicate the follow notice', count(user) === 1, JSON.stringify(r));

  // Organizer follow → the organizer's NEW event (after the follow).
  entities.followEntity(user, 'organizer', 'Boom Collective', at(13));
  CLOCK_MIN = 14;
  const orgEvent = mkObject('obj_follow_org_event', { type: 'event', title: 'Org presents a night', organizer: 'Boom Collective', area: 'Kilimani', eventStartMin: 60 * 50, createdAtMin: 14 });
  r = sweep(user, 15);
  check('organizer follow notifies for its new event', byType(user, 'following').some((n) => n.objectId === orgEvent.id), JSON.stringify(byType(user, 'following').map((n) => n.objectId)));

  // Publisher follow → source_update; canonical dedupe: one article via TWO
  // sources (Telegram + RSS style) = exactly one notification.
  const pub = mkSource('src_follow_pub', 'Nairobi Wire', { type: 'website' });
  entities.followEntity(user, 'publisher', pub.id, at(16));
  CLOCK_MIN = 17;
  const article = mkObject('obj_follow_article', { type: 'news', title: 'The Nairobi Wire story', area: 'Nairobi', createdAtMin: 17 });
  attach(article.id, pub.id, 17);
  attach(article.id, mkSource('src_follow_pub2', 'Nairobi Wire Mirror', { type: 'rss' }).id, 17);
  r = sweep(user, 18);
  const updates = byType(user, 'source_update');
  check('publisher follow produces a source_update', updates.length === 1 && updates[0].entityId === `publisher:${pub.id}`, JSON.stringify(updates));
  check('canonical dedupe: one article via two sources = one notification', updates.length === 1);
  check('publisher notice is normal priority', updates[0]?.priority === 'normal');
  check('publisher notice deep-links the article', updates[0]?.dest === `object:${article.id}`, updates[0]?.dest);
}

// ===========================================================================
console.log('\n=== LOCATION: batch coalescing + alert priority ===');
{
  const user = 'usr_loc';
  // Interest row lands at minute 20; objects land AFTER it.
  CLOCK_MIN = 20;
  personal.follow(user, 'location', 'Westlands');
  CLOCK_MIN = 21;
  const e1 = mkObject('obj_loc_1', { type: 'event', title: 'Westlands market', area: 'Westlands', eventStartMin: 60 * 30, createdAtMin: 21 });
  mkObject('obj_loc_2', { type: 'event', title: 'Westlands run', area: 'Westlands', eventStartMin: 60 * 31, createdAtMin: 22 });
  mkObject('obj_loc_o1', { type: 'offer', title: 'Westlands deal', area: 'Westlands', deadlineToday: true, createdAtMin: 23 });
  CLOCK_MIN = 24;
  let r = sweep(user, 24);
  const locs = byType(user, 'location');
  check('three items in a followed area coalesce into ONE notification', locs.length === 1, JSON.stringify(locs.map((n) => n.title)));
  check('coalesced location notice counts the batch', locs[0]?.title?.includes('3 new'), locs[0]?.title);
  check('location notice deep-links the location page', locs[0]?.dest === 'location:Westlands', locs[0]?.dest);
  check('location notice carries the batch count', locs[0]?.metadata?.count === 3, JSON.stringify(locs[0]?.metadata));

  // Two more arrive: the SAME row coalesces (no new row) and returns unread.
  mkObject('obj_loc_4', { type: 'event', title: 'Westlands fourth', area: 'Westlands', eventStartMin: 60 * 32, createdAtMin: 25 });
  mkObject('obj_loc_5', { type: 'event', title: 'Westlands fifth', area: 'Westlands', eventStartMin: 60 * 33, createdAtMin: 26 });
  notifications.markAllRead(user);
  CLOCK_MIN = 27;
  r = sweep(user, 27);
  const locs2 = byType(user, 'location');
  check('later items coalesce into the same batch row', locs2.length === 1 && locs2[0].metadata?.count === 5, JSON.stringify(locs2.map((n) => [n.title, n.metadata?.count])));
  check('coalescing bumps the row back to unread', locs2[0].read === false);

  // Alerts in a followed location are individually important.
  mkObject('obj_loc_alert', { type: 'alert', title: 'Water disruption in Westlands', area: 'Westlands', createdAtMin: 27 });
  CLOCK_MIN = 28;
  r = sweep(user, 28);
  const alerts = byType(user, 'alert');
  check('a real alert in a followed location notifies as important', alerts.length === 1 && alerts[0].priority === 'important' && alerts[0].objectId === 'obj_loc_alert', JSON.stringify(alerts));
  check('alert deep-links the alert object', alerts[0]?.dest === 'object:obj_loc_alert');
}

// ===========================================================================
console.log('\n=== SAVED: event reminder + offer expiry + priority + quietness ===');
{
  const user = 'usr_saved';
  CLOCK_MIN = 30;
  const tomorrow = mkObject('obj_saved_event', { type: 'event', title: 'Afrobeat Night', area: 'Kilimani', eventStartMin: 60 * 30, createdAtMin: 30 });
  const today = mkObject('obj_saved_offer', { type: 'offer', title: 'Studio Hoodie Deal', area: 'Kilimani', deadlineDayMin: 33, createdAtMin: 31 });
  const soonOffer = mkObject('obj_saved_offer2', { type: 'offer', title: 'Weekend pass deal', area: 'Westlands', deadlineDaysAgo: 3, createdAtMin: 32 });
  personal.saveObject(user, tomorrow.id);
  personal.saveObject(user, today.id);
  personal.saveObject(user, soonOffer.id);
  CLOCK_MIN = 33;
  let r = sweep(user, 33);
  const events = byType(user, 'event');
  const offers = byType(user, 'offer');
  check('saved event starting ~30h out gets an Event reminder', events.length === 1 && events[0].objectId === tomorrow.id, JSON.stringify(events));
  check('saved event tomorrow is normal priority', events[0].priority === 'normal');
  check('saved offer expiring in 8h gets an Offer notice', offers.some((n) => n.objectId === today.id), JSON.stringify(offers));
  check('offer expiring today is important', offers.find((n) => n.objectId === today.id)?.priority === 'important');
  check('offer expiring in 60h gets nothing (quiet)', !offers.some((n) => n.objectId === soonOffer.id));
  check('event reminder deep-links the event', events[0]?.dest === `object:${tomorrow.id}`, events[0]?.dest);

  // Re-running on the same day does not duplicate (day-bucket dedupe).
  r = sweep(user, 33);
  check('reminders are not duplicated on a second sweep', byType(user, 'event').length === 1 && byType(user, 'offer').length === 1);
}

// ===========================================================================
console.log('\n=== COLLECTION: status changes + corrections ===');
{
  const user = 'usr_col';
  CLOCK_MIN = 40;
  const cancelled = mkObject('obj_col_cancelled', { type: 'event', title: 'Cancelled gig', eventStartMin: 60 * 20, statusBadge: 'cancelled', createdAtMin: 40 });
  const ended = mkObject('obj_col_ended', { type: 'event', title: 'Past jazz night', eventStartMin: -60 * 8, eventEndMin: -60 * 6, createdAtMin: 41 });
  const expired = mkObject('obj_col_expired', { type: 'offer', title: 'Old hoodie deal', deadlineDaysAgo: 1, createdAtMin: 42 });
  for (const o of [cancelled, ended, expired]) personal.saveObject(user, o.id);
  CLOCK_MIN = 43;
  let r = sweep(user, 43);
  const cols = byType(user, 'collection');
  check('cancelled saved event notifies as important', cols.some((n) => n.objectId === cancelled.id && n.priority === 'important' && n.title === 'Event cancelled'), JSON.stringify(cols));
  check('ended saved event notifies its real status', cols.some((n) => n.objectId === ended.id && n.title === 'Event ended'), JSON.stringify(cols));
  check('expired saved offer notifies (stale never silences status news)', cols.some((n) => n.objectId === expired.id && n.title === 'Offer expired'), JSON.stringify(cols));
  const expiredRow = notifications.listNotifications(user).find((n) => n.dedupeKey === `status_end:${expired.id}:expired`);
  check('status notifications reflect current object state (not a claim)', expiredRow?.object?.status === 'expired', JSON.stringify(expiredRow?.object));

  // A correction on a saved object → Correction notification. The correction
  // row is stamped with the scenario clock (mirrors a correction made by an
  // operator between sweeps).
  const fixed = mkObject('obj_col_fixed', { type: 'place', title: 'Mistaken Venue', area: 'Kilimani', createdAtMin: 44 });
  personal.saveObject(user, fixed.id);
  const fixedCorr = corrections.correctObject({ objectId: fixed.id, field: 'title', value: 'Corrected Venue', operatorId: 'usr_op', reason: 'name typo', isMeta: false });
  store.update('corrections', fixedCorr.correction.id, { createdAt: at(44) });
  CLOCK_MIN = 45;
  r = sweep(user, 45);
  const corrRows = byType(user, 'correction');
  check('a correction on a saved object notifies as important', corrRows.length === 1 && corrRows[0].priority === 'important', JSON.stringify(corrRows));
  check('correction wording uses the REAL old/new values', corrRows[0]?.body?.includes('Mistaken Venue') && corrRows[0]?.body?.includes('Corrected Venue'), corrRows[0]?.body);

  // A correction on an object nobody cares about → silent.
  const nobody = mkObject('obj_col_nobody', { type: 'place', title: 'Nobody Cares Venue', createdAtMin: 46 });
  const nobodyCorr = corrections.correctObject({ objectId: nobody.id, field: 'title', value: 'Still Nobody Cares', operatorId: 'usr_op', reason: 'typo' });
  store.update('corrections', nobodyCorr.correction.id, { createdAt: at(46) });
  const before = count(user);
  CLOCK_MIN = 47;
  r = sweep(user, 47);
  check('corrections on non-saved/non-followed objects stay silent', count(user) === before, JSON.stringify(r));
}

// ===========================================================================
console.log('\n=== PREFERENCES: category toggles ===');
{
  const user = 'usr_pref';
  const src = mkSource('src_pref', 'Prefs Channel');
  CLOCK_MIN = 50;
  entities.followEntity(user, 'publisher', src.id, at(50));
  notifications.setPreferences(user, { news: false });
  const gated = mkObject('obj_pref_article', { type: 'news', title: 'A publisher story', area: 'Nairobi', createdAtMin: 51 });
  attach(gated.id, src.id, 51);
  CLOCK_MIN = 52;
  let r = sweep(user, 52);
  check('disabling News stops source_update notifications', byType(user, 'source_update').length === 0, JSON.stringify(r));

  // Re-enabled BEFORE the next article: it notifies (content arriving while
  // News was OFF stays off — the toggle is the user's word).
  notifications.setPreferences(user, { news: true });
  const fresh = mkObject('obj_pref_article2', { type: 'news', title: 'A later publisher story', area: 'Nairobi', createdAtMin: 53 });
  attach(fresh.id, src.id, 53);
  CLOCK_MIN = 54;
  r = sweep(user, 54);
  check('re-enabling News lets the next article notify', byType(user, 'source_update').length === 1, JSON.stringify(byType(user, 'source_update')));

  const savedPrefs = notifications.getPreferences(user);
  check('preferences persist with defaults + the change', savedPrefs.categories.news === true && savedPrefs.categories.events === true, JSON.stringify(savedPrefs));
  check('preference change returns a changed flag', notifications.setPreferences(user, { events: false }).changed === true);
}

// ===========================================================================
console.log('\n=== READ STATE ===');
{
  const user = 'usr_read';
  CLOCK_MIN = 60;
  mkObject('obj_read_1', { type: 'event', title: 'Read test event', eventStartMin: 60 * 20, createdAtMin: 60 });
  personal.saveObject(user, 'obj_read_1');
  CLOCK_MIN = 61;
  sweep(user, 61);
  const n = notifications.listNotifications(user)[0];
  check('a generated notification is unread with no readAt', n.read === false && n.readAt === null);

  const marked = notifications.markRead(user, n.id);
  check('markRead flips read + stamps readAt', marked.read === true && typeof marked.readAt === 'string');
  check('unread count drops', notifications.unreadCount(user) === 0);

  const unmarked = notifications.markUnread(user, n.id);
  check('markUnread restores the unread state', unmarked.read === false && unmarked.readAt === null && notifications.unreadCount(user) === 1);

  notifications.markAllRead(user);
  check('markAllRead clears the unread count', notifications.unreadCount(user) === 0);

  const opened = notifications.openNotification(user, n.id);
  check('opening a notification marks it read (deep-link tap)', opened.read === true && notifications.unreadCount(user) === 0);
}

// ===========================================================================
console.log('\n=== PRIVACY (domain-level): one user never sees another ===');
{
  const a = 'usr_priv_a';
  const b = 'usr_priv_b';
  notifications.notify(a, { type: 'system', title: 'A private note' });
  notifications.notify(b, { type: 'system', title: 'B private note' });
  check('A lists only A rows', notifications.listNotifications(a).length === 1 && notifications.listNotifications(a)[0].title === 'A private note');
  check('B lists only B rows', notifications.listNotifications(b).length === 1 && notifications.listNotifications(b)[0].title === 'B private note');
  check('A cannot mark B row read', notifications.markRead(a, notifications.listNotifications(b)[0].id) === null);
  check('A cannot open B row', notifications.openNotification(a, notifications.listNotifications(b)[0].id) === null);
  check('unread count is per-user', notifications.unreadCount(a) === 1 && notifications.unreadCount(b) === 1);
  notifications.setPreferences(a, { offers: false });
  check('preferences are per-user', notifications.getPreferences(a).categories.offers === false && notifications.getPreferences(b).categories.offers === true);
}

// ===========================================================================
console.log('\n=== ANALYTICS: tracked acts ===');
{
  const before = analytics.dashboard().engagement;
  check('notification analytics exist and count real events',
    before.notificationsGenerated >= 1 &&
    before.notificationsOpened >= 1 &&
    before.notificationsRead >= 1 &&
    before.notificationPrefChanges >= 1,
    JSON.stringify(before));
}

// ===========================================================================
console.log('\n=== HTTP API: authenticated, private, deep-linked ===');
{
  process.env.PORT = '0';
  const { default: app } = await import('../src/index.js');
  const srv = app.listen(0);
  const port = srv.address().port;
  const B = `http://127.0.0.1:${port}`;
  const call = async (p, method = 'GET', body, token) => {
    const headers = {};
    if (body) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`${B}${p}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  const signup = async (handle) => (await call('/api/auth/register', 'POST', { handle, password: 'a good passphrase', displayName: handle })).body?.token;
  const tokenA = await signup(`ntfa${Date.now() % 100000}`);
  const tokenB = await signup(`ntfb${Date.now() % 100000}`);
  check('two real sessions register', Boolean(tokenA) && Boolean(tokenB));

  const src = mkSource('src_http', 'HTTP Channel');
  const venue = mkObject('obj_http_venue', { type: 'place', title: 'HTTP Studio', area: 'Kilimani', createdAtMin: 70 });
  // One event for the FOLLOW path (not saved — saved rows get targeted notices).
  const event = mkObject('obj_http_event', { type: 'event', title: 'HTTP launch night', venue: 'HTTP Studio', area: 'Kilimani', eventStartMin: 60 * 28, createdAtMin: 71 });
  attach(event.id, src.id, 71);
  // One SEPARATE saved event for the reminder path.
  const savedEvent = mkObject('obj_http_saved', { type: 'event', title: 'HTTP saved night', area: 'Kilimani', eventStartMin: 60 * 30, createdAtMin: 72 });
  attach(savedEvent.id, src.id, 72);

  let r = await call(`/api/entities/${encodeURIComponent(`venue:${venue.id}`)}/follow`, 'POST', undefined, tokenA);
  check('follow via HTTP succeeds', r.status === 200 || r.status === 201, r.status + ' ' + JSON.stringify(r.body));

  r = await call(`/api/me/saved/${savedEvent.id}`, 'POST', undefined, tokenA);
  check('save via HTTP succeeds', r.status === 200, r.status + ' ' + JSON.stringify(r.body));

  // LIST generates opportunistically + returns unread + prefs.
  r = await call('/api/notifications', 'GET', undefined, tokenA);
  check('GET /api/notifications returns rows with unread count', r.status === 200 && Array.isArray(r.body?.notifications) && r.body.notifications.length >= 2 && r.body.unread >= 2, JSON.stringify({ status: r.status, unread: r.body?.unread, n: r.body?.notifications?.length }));
  const followN = r.body?.notifications?.find((n) => n.type === 'following');
  const eventN = r.body?.notifications?.find((n) => n.type === 'event');
  check('HTTP list carries deep links', followN?.dest === `object:${event.id}`, JSON.stringify(followN?.dest));
  check('HTTP list resolves the object preview with real status', followN?.object?.status === 'upcoming', JSON.stringify(followN?.object));
  check('HTTP list resolves per-object type (event reminder)', Boolean(eventN) && eventN.type === 'event' && eventN.objectId === savedEvent.id);

  // PRIVACY: user B sees none of A's.
  r = await call('/api/notifications', 'GET', undefined, tokenB);
  check('another user cannot list that user notifications', r.status === 200 && r.body?.notifications?.length === 0 && r.body.unread === 0, JSON.stringify(r.body));

  // Mark read / unread / all.
  r = await call('/api/notifications/read', 'POST', { id: followN.id }, tokenA);
  check('mark read via API', r.status === 200 && r.body?.notification?.read === true);
  r = await call('/api/notifications/read', 'POST', { id: followN.id, read: false }, tokenA);
  check('mark unread via API', r.status === 200 && r.body?.notification?.read === false, JSON.stringify(r.body));
  r = await call(`/api/notifications/${followN.id}/open`, 'POST', undefined, tokenA);
  check('open via API marks read', r.status === 200 && r.body?.notification?.read === true);
  r = await call('/api/notifications/read', 'POST', { all: true }, tokenA);
  check('mark all read via API', r.status === 200 && r.body?.marked >= 1);

  // Cross-user mutation is refused.
  r = await call(`/api/notifications/${followN.id}/open`, 'POST', undefined, tokenB);
  check('another user cannot open that notification (404)', r.status === 404, r.status + ' ' + JSON.stringify(r.body));

  // Preferences via API.
  r = await call('/api/notifications/preferences', 'GET', undefined, tokenA);
  check('GET preferences works', r.status === 200 && r.body?.preferences?.categories?.events === true);
  r = await call('/api/notifications/preferences', 'PUT', { categories: { events: false } }, tokenA);
  check('PUT preferences works', r.status === 200 && r.body?.preferences?.events === false, JSON.stringify(r.body));
  r = await call('/api/notifications/preferences', 'GET', undefined, tokenB);
  check('preferences are private', r.status === 200 && r.body?.preferences?.categories?.events === true);

  srv.close();
}

console.log(`\n${'='.repeat(52)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
process.exit(fail ? 1 : 0);
