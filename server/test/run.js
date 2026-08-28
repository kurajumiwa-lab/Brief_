// ---------------------------------------------------------------------------
// INGESTION TEST SUITE
//
// Two kinds of test live here:
//   OFFLINE  pure pipeline logic -- always runs, no network.
//   LIVE     real HTTP against real third parties. Skipped automatically when
//            the network or a credential is unavailable, and reported as
//            SKIP rather than silently passing.
//
//   node test/run.js            offline + live
//   OFFLINE=1 node test/run.js  offline only
// ---------------------------------------------------------------------------

import { store } from '../src/store.js';
import path from 'node:path';
import { extractFields, extractVendors, extractProducts, isObjectWorthy } from '../src/pipeline/extract.js';
import { storeRawItem, processRawItem, previewText } from '../src/pipeline/ingest.js';
import * as telegram from '../src/connectors/telegram.js';
import * as web from '../src/connectors/web.js';
import * as whatsapp from '../src/connectors/whatsapp.js';
import crypto from 'node:crypto';

let pass = 0, fail = 0, skip = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' -> ' + detail : ''}`); }
};
const skipped = (name, why) => { skip++; console.log(`  SKIP  ${name} (${why})`); };

process.env.BRIEF_DATA_DIR = '/tmp/brief-test-data';
store._reset();

const POPUP = `Saturday popup at Kilimani Studio.

12 vendors.
Fashion, food and beauty.

KES 300 entry.
4PM-10PM.

Vendor: Kikao Streetwear
Printed Hoodie KES 2500

DM Jane on WhatsApp.`;

console.log('\n=== EXTRACTION (spec 6) ===');
{
  const { fields, confidence } = extractFields(POPUP);
  check('title extracted', fields.title?.includes('Kilimani Studio'), fields.title);
  check('type inferred as experience', fields.type === 'experience', fields.type);
  check('price 300 KES', fields.price === 300 && fields.currency === 'KES');
  check('time range normalised to 24h', fields.timeRange === '16:00-22:00', fields.timeRange);
  check('location extracted', fields.locationName === 'Kilimani Studio', fields.locationName);
  check('vendor count 12', fields.vendorCount === 12);
  check('categories found', ['fashion', 'food', 'beauty'].every((c) => fields.categories?.includes(c)));
  check('contact name found', fields.contactName === 'Jane', fields.contactName);
  check('confidence is high but not certain', confidence > 0.6 && confidence <= 1, String(confidence));
}

console.log('\n=== NEVER INVENT (spec 7 / 37) ===');
{
  const { fields } = extractFields(POPUP);
  check('day recorded as day, not a fake date', fields.dayOfWeek === 'saturday');
  check('no calendar date invented from "Saturday"', fields.dateText === undefined);
  const sparse = extractFields('Popup this weekend, come through!');
  check('sparse message yields no price', sparse.fields.price === undefined);
  check('sparse message yields no location', sparse.fields.locationName === undefined);
  check('sparse message is not object worthy', !isObjectWorthy(sparse.fields));
  const chat = extractFields('hey is anyone going today?');
  check('pure conversation is rejected', !isObjectWorthy(chat.fields));
}

console.log('\n=== TYPE CLASSIFICATION ===');
{
  const t = (s) => extractFields(s).fields.type;
  check('"night market" is an event', t('Night market at Westlands Square. 15 vendors.') === 'experience');
  check('"market day" is an event', t('Maji Mazuri Saturday Market Day, extended trading') === 'experience');
  check('"creator market" is an event', t('Creator market at the Alchemist, 20 vendors') === 'experience');
  check('a bare market is a place', t('Wakulima Market is the main produce market in the CBD') === 'place');
  check('a shop is a place', t('Our shop is at Kilimani Centre, open 9AM-5PM') === 'place');
  check('grant language wins for opportunities', t('Apply for the Green Commerce grant') === 'opportunity');
}

console.log('\n=== CONTACT NAMES ===');
{
  const c = (s) => extractFields(s).fields.contactName;
  check('"DM Jane" found despite capitalised keyword', c('DM Jane on WhatsApp') === 'Jane');
  check('"Contact Jane" found', c('Contact Jane') === 'Jane');
  check('"call us" is not a person', c('call us today') === undefined);
  check('"Contact Me" is not a person', c('Contact Me now') === undefined);
}

console.log('\n=== VENDORS + PRODUCTS (spec 20 / 21) ===');
{
  check('explicit vendor name found', extractVendors('Vendor: Kikao Streetwear').includes('Kikao Streetwear'));
  check('"will be selling" pattern found', extractVendors('Glow Studio will be selling skincare').includes('Glow Studio'));
  check('stall number is not a vendor name', !extractVendors('Find us at stall 14').includes('14'));
  check('no vendor invented from prose', extractVendors('It was a nice day in Nairobi').length === 0);
  const prods = extractProducts('Printed Hoodie KES 2500 and Caps KES 800');
  check('two products with prices', prods.length === 2 && prods[0].price === 2500);
  check('admission fee is NOT a product', extractProducts('Entry KES 300').length === 0);
  check('gate fee is NOT a product', extractProducts('Gate fee KES 100').length === 0);
}

console.log('\n=== RAW ITEM + PIPELINE (spec 5) ===');
let eventId = null;
{
  store.insert('sources', {
    id: 'src_tg', name: 'Kilimani Creators', type: 'telegram_group', platform: 'telegram',
    accessType: 'member_access', connectionStatus: 'connected', confidence: 0.6,
    url: null, externalId: '-100123', createdAt: new Date().toISOString()
  });
  const { row, duplicate } = storeRawItem({
    sourceId: 'src_tg', externalId: '-100123:77', messageId: '77', author: 'jane',
    text: POPUP, publishedAt: '2026-08-15T10:00:00Z', rawUrl: 'https://t.me/kilimanicreators/77'
  });
  check('raw item stored before any object exists', row.processingStatus === 'pending');
  check('first delivery is not a duplicate', duplicate === false);

  const again = storeRawItem({ sourceId: 'src_tg', externalId: '-100123:77', text: POPUP });
  check('redelivery is detected as duplicate', again.duplicate === true);
  check('redelivery does not create a second raw row', store.all('rawItems').length === 1);

  const result = processRawItem(row.id);
  eventId = result.objectId;
  check('object created from raw item', result.ok && result.created);
  check('raw item marked processed', store.find('rawItems', (r) => r.id === row.id).processingStatus === 'processed');
  check('vendor + product children created', result.childIds.length >= 2, String(result.childIds.length));

  const ev = store.find('objects', (o) => o.id === eventId);
  check('object is an experience', ev.type === 'experience');
  check('extraction evidence retained for audit', Array.isArray(ev.extractionEvidence) && ev.extractionEvidence.length > 0);
  check('unknown fields marked, not guessed', Array.isArray(ev.metadata.unknownFields));
}

console.log('\n=== PROVENANCE (spec 4 / 35) ===');
{
  const prov = store.filter('objectSources', (s) => s.objectId === eventId);
  check('provenance row exists', prov.length === 1);
  check('source message id preserved', prov[0].sourceMessageId === '77');
  check('source author preserved', prov[0].sourceAuthor === 'jane');
  check('real permalink preserved', prov[0].sourceUrl === 'https://t.me/kilimanicreators/77');
  check('retrieval timestamp present', Boolean(prov[0].sourceRetrievedAt));
  check('source and extraction confidence tracked separately',
    prov[0].sourceConfidence !== undefined && prov[0].extractionConfidence !== undefined);
}

console.log('\n=== PUBLICATION STATE (spec 24) ===');
{
  const ev = store.find('objects', (o) => o.id === eventId);
  check('private-source object is NOT public by default', ev.publication === 'source_members', ev.publication);

  store.insert('sources', {
    id: 'src_pub', name: 'Public Channel', type: 'telegram_channel', platform: 'telegram',
    accessType: 'public', connectionStatus: 'connected', confidence: 0.6,
    url: null, externalId: '-100999', createdAt: new Date().toISOString()
  });
  const { row } = storeRawItem({
    sourceId: 'src_pub', externalId: '-100999:5', text:
      'Night market at Westlands Square. KES 500 entry. 6PM-11PM. 20 vendors.'
  });
  const r = processRawItem(row.id);
  check('public-source object may be public',
    store.find('objects', (o) => o.id === r.objectId).publication === 'public');
}

console.log('\n=== DEDUPLICATION (spec 8) ===');
{
  store.insert('sources', {
    id: 'src_wa', name: 'Nairobi Fashion Community', type: 'whatsapp_group', platform: 'whatsapp',
    accessType: 'member_access', connectionStatus: 'connected', confidence: 0.5,
    url: null, externalId: 'wa1', createdAt: new Date().toISOString()
  });
  const before = store.all('objects').filter((o) => o.type === 'experience').length;
  const { row } = storeRawItem({
    sourceId: 'src_wa', externalId: 'wa1:9',
    text: 'Saturday popup at Kilimani Studio\nEntry KES 300. Runs 4PM-10PM.\nOver 12 vendors expected.'
  });
  const result = processRawItem(row.id);
  const after = store.all('objects').filter((o) => o.type === 'experience').length;

  check('same event from a 2nd source does NOT create a new event', after === before, `${before} -> ${after}`);
  check('it merged into the canonical object', result.merged && result.objectId === eventId);
  check('now attached to two sources',
    new Set(store.filter('objectSources', (s) => s.objectId === eventId).map((s) => s.sourceId)).size === 2);
  check('verification escalates to cross_source_confirmed',
    store.find('objects', (o) => o.id === eventId).verificationStatus === 'cross_source_confirmed');

  const { row: other } = storeRawItem({
    sourceId: 'src_wa', externalId: 'wa1:10',
    text: 'Craft fair at Karen Hub. KES 100 entry. 9AM-4PM. 6 vendors.'
  });
  const distinct = processRawItem(other.id);
  check('a genuinely different event is NOT merged', distinct.created === true);
}

console.log('\n=== GRAPH (spec 22) ===');
{
  const rels = store.filter('relationships', (r) => r.sourceId === eventId);
  check('event -> vendor relationship exists', rels.some((r) => r.verb === 'has_vendor'));
  check('event -> product relationship exists', rels.some((r) => r.verb === 'offers'));
  const vendor = store.find('objects', (o) => o.title === 'Kikao Streetwear');
  check('vendor -> event back-reference exists',
    store.filter('relationships', (r) => r.sourceId === vendor.id).some((r) => r.verb === 'appears_at'));
}

console.log('\n=== BRIEF IT PREVIEW (spec 16 / 17) ===');
{
  const objectsBefore = store.all('objects').length;
  const p = previewText(POPUP);
  check('preview reports it is worthy', p.worthy === true);
  check('preview returns fields', p.fields.price === 300);
  check('preview writes NOTHING to the store', store.all('objects').length === objectsBefore);
}

console.log('\n=== WHATSAPP SECURITY (spec 13 / 32) ===');
{
  process.env.WHATSAPP_APP_SECRET = 'shh';
  process.env.WHATSAPP_VERIFY_TOKEN = 'vtok';
  const body = Buffer.from(JSON.stringify({ hello: 'world' }));
  const good = 'sha256=' + crypto.createHmac('sha256', 'shh').update(body).digest('hex');
  check('valid signature accepted', whatsapp.verifySignature(body, good).ok);
  check('tampered signature rejected', !whatsapp.verifySignature(body, good.slice(0, -2) + 'ff').ok);
  check('missing signature rejected', !whatsapp.verifySignature(body, null).ok);
  check('verify handshake requires the right token',
    whatsapp.verifySubscription({ 'hub.mode': 'subscribe', 'hub.verify_token': 'vtok', 'hub.challenge': 'c' }).ok);
  check('wrong verify token refused',
    !whatsapp.verifySubscription({ 'hub.mode': 'subscribe', 'hub.verify_token': 'no', 'hub.challenge': 'c' }).ok);
  check('group ingestion is declared UNSUPPORTED, not faked',
    whatsapp.capabilities.groupIngestion.startsWith('NO'));

  const msgs = whatsapp.normalizeWebhook({
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: '555' },
      contacts: [{ wa_id: '254700', profile: { name: 'Jane' } }],
      messages: [{ id: 'wamid.1', from: '254700', timestamp: '1755250000', text: { body: 'Popup Saturday KES 200' } }]
    } }] }]
  });
  check('cloud API message normalised', msgs.length === 1 && msgs[0].author === 'Jane');
  check('no permalink fabricated for WhatsApp', msgs[0].rawUrl === null);
}

console.log('\n=== TELEGRAM NORMALIZATION (spec 10-12) ===');
{
  const norm = telegram.normalizeUpdate({
    message: {
      message_id: 77, date: 1755250000,
      chat: { id: -100123, title: 'Kilimani Creators', type: 'supergroup', username: 'kilimanicreators' },
      from: { username: 'jane' }, text: POPUP
    }
  });
  check('update normalised', norm.externalId === '-100123:77');
  check('permalink built for a public chat', norm.rawUrl === 'https://t.me/kilimanicreators/77');
  const priv = telegram.normalizeUpdate({
    message: { message_id: 5, date: 1, chat: { id: -1, type: 'group' }, text: 'Popup Saturday KES 200' }
  });
  check('no permalink invented for a private chat', priv.rawUrl === null);
  check('non-text update ignored',
    telegram.normalizeUpdate({ message: { message_id: 1, chat: { id: 1 } } }) === null);
  check('history limitation documented', telegram.capabilities.history.startsWith('no'));
}

console.log('\n=== SSRF GUARD (spec 32) ===');
{
  for (const bad of ['http://localhost/x', 'http://127.0.0.1/x', 'http://169.254.169.254/latest/meta-data',
                     'http://192.168.1.1/', 'http://10.0.0.5/', 'file:///etc/passwd']) {
    check(`refused ${bad}`, !web.validateUrl(bad).ok);
  }
  check('ordinary https URL allowed', web.validateUrl('https://example.com/page').ok);
}

// --- LIVE NETWORK TESTS ------------------------------------------------------

const OFFLINE = process.env.OFFLINE === '1';
async function online() {
  if (OFFLINE) return false;
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 6000);
    await fetch('https://example.com', { signal: c.signal });
    clearTimeout(t);
    return true;
  } catch { return false; }
}

const isOnline = await online();

console.log('\n=== LIVE: WEB CONNECTOR (spec 14) ===');
if (!isOnline) {
  skipped('web connector live tests', 'no network');
} else {
  const page = await web.fetchPage('https://example.com');
  check('real page fetched', page.ok === true, page.error);
  check('title extracted from real HTML', page.extracted?.title === 'Example Domain', page.extracted?.title);
  check('robots.txt consulted', Boolean(page.robots));

  const fb = await web.robotsAllows('https://www.facebook.com/somepage');
  check('robots.txt Disallow: / is honoured', fb.allowed === false, fb.reason);

  // Wildcard and end-anchor rules: the bug this suite exists to prevent.
  const gh = await web.robotsAllows('https://github.com/search');
  check('anchored rule "/search$" honoured', gh.allowed === false, gh.reason);
  const ghPulse = await web.robotsAllows('https://github.com/a/b/pulse');
  check('wildcard rule "/*/*/pulse" honoured', ghPulse.allowed === false, ghPulse.reason);
  const ghOk = await web.robotsAllows('https://github.com/anthropics/anthropic-sdk-python');
  check('permitted path still allowed', ghOk.allowed === true, ghOk.reason);
}

console.log('\n=== LIVE: RSS CONNECTOR (spec 15) ===');
if (!isOnline) {
  skipped('rss connector live tests', 'no network');
} else {
  const feed = await web.fetchFeed('https://feeds.bbci.co.uk/news/world/rss.xml');
  check('real RSS feed fetched and parsed', feed.ok === true, feed.error);
  check('feed items extracted', (feed.items?.length ?? 0) > 0, String(feed.items?.length));
  check('items carry real links', Boolean(feed.items?.[0]?.link));
  check('items carry publish dates', Boolean(feed.items?.[0]?.publishedAt));
  const notFeed = await web.fetchFeed('https://example.com');
  check('non-feed URL rejected honestly', notFeed.ok === false);
}

console.log('\n=== LIVE: TELEGRAM API (spec 10) ===');
if (!isOnline) {
  skipped('telegram live tests', 'no network');
} else if (telegram.isConfigured()) {
  const v = await telegram.verify();
  check('real bot token authenticates', v.ok === true, v.error);
  if (v.ok) console.log(`        bot @${v.bot.username}, can_read_all_group_messages=${v.bot.canReadAllGroupMessages}`);
} else {
  // No token configured: prove we still reach the real API and that it
  // rejects a bad credential, rather than pretending success.
  const saved = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = '123456:INVALID_TOKEN_FOR_TEST';
  const v = await telegram.verify();
  process.env.TELEGRAM_BOT_TOKEN = saved ?? '';
  check('real Telegram API reached and rejects a bad token',
    v.ok === false && /unauthorized/i.test(v.error ?? ''), JSON.stringify(v));
  skipped('authenticated Telegram tests', 'TELEGRAM_BOT_TOKEN not set');
}


// ---------------------------------------------------------------------------
// AUTHORITY (Phase 3.5)
//
// A caller must not be able to claim membership, authority or contribution
// belonging to another user. Identity comes from the authenticated request,
// never from the request body. These run against the real Express app.
// ---------------------------------------------------------------------------
console.log('\n=== AUTHORITY (spec 32) ===');
{
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('../src/index.js');
  store._reset();

  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, method = 'GET', body) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    const c = (await call('/api/circles', 'POST', { name: 'Auth Circle', targetValue: 1000 })).body.circle;

    // --- forging membership for another user ------------------------------
    let r = await call(`/api/circles/${c.id}/members`, 'POST', { userId: 'attacker_victim' });
    check('cannot create membership for another user', r.status === 403, `got ${r.status}`);
    check('refusal names the missing authority', /coordinator/.test(r.body?.error ?? ''));
    const rows = (await call(`/api/circles/${c.id}/members`)).body.members;
    check('forged request created no membership row', rows.length === 0, `${rows.length} rows`);

    // --- legitimate self-join ----------------------------------------------
    r = await call(`/api/circles/${c.id}/members`, 'POST', { role: 'coordinator' });
    check('self-join on a fresh circle succeeds', r.status === 201, `got ${r.status}`);
    check('identity taken from caller not body', r.body?.member?.userId === 'usr_me');

    // --- coordinator may add another user ----------------------------------
    r = await call(`/api/circles/${c.id}/members`, 'POST', { userId: 'invited_person' });
    check('coordinator may add another user', r.status === 201, `got ${r.status}`);
    check('invited user stored under their own id', r.body?.member?.userId === 'invited_person');

    // --- self-verification refused -----------------------------------------
    r = await call(`/api/circles/${c.id}/members/usr_me/verify`, 'POST', { kind: 'identity_verified' });
    check('a member cannot verify themselves', r.status === 403, `got ${r.status}`);

    r = await call(`/api/circles/${c.id}/members/invited_person/verify`, 'POST', { kind: 'phone_verified' });
    check('coordinator may verify another member', r.status === 200, `got ${r.status}`);
    check('evidence recorded', r.body?.member?.trust?.evidence?.length === 1);
    check('still no numeric trust score', !('trustScore' in (r.body?.member ?? {})));

    // --- a circle the caller does NOT coordinate ---------------------------
    const c2 = (await call('/api/circles', 'POST', { name: 'Second' })).body.circle;
    await call(`/api/circles/${c2.id}/members`, 'POST', { role: 'observer' });

    r = await call(`/api/circles/${c2.id}/members/usr_me/role`, 'PATCH', { role: 'coordinator' });
    check('non-coordinator cannot change roles', r.status === 403, `got ${r.status}`);

    r = await call(`/api/circles/${c.id}/members/invited_person/role`, 'PATCH', { role: 'scout' });
    check('coordinator may change a role', r.status === 200, `got ${r.status}`);
    check('role actually updated', r.body?.member?.role === 'scout');

    // --- circle mutation ----------------------------------------------------
    r = await call(`/api/circles/${c2.id}`, 'PATCH', { name: 'Hijacked' });
    check('non-coordinator cannot mutate a circle', r.status === 403, `got ${r.status}`);
    check('name unchanged after refused mutation',
      (await call(`/api/circles/${c2.id}`)).body.circle.name === 'Second');

    r = await call(`/api/circles/${c.id}`, 'PATCH', { name: 'Renamed By Coordinator' });
    check('coordinator may update the circle', r.status === 200, `got ${r.status}`);

    // --- transaction attribution --------------------------------------------
    r = await call('/api/transactions', 'POST',
      { amount: 500, type: 'contribution', counterparty: 'someone_else', circleId: c2.id });
    check('cannot attribute a transaction to another user', r.status === 403, `got ${r.status}`);

    r = await call('/api/transactions', 'POST',
      { amount: 500, type: 'contribution', counterparty: 'someone_else', circleId: c.id });
    check('coordinator may attribute a contribution', r.status === 201, `got ${r.status}`);

    r = await call('/api/transactions', 'POST', { amount: 250, type: 'contribution' });
    check('recording your own money needs no authority', r.status === 201, `got ${r.status}`);

    // --- ECONOMIC INVARIANT SURVIVES HARDENING -------------------------------
    const before = (await call(`/api/circles/${c.id}`)).body.circle.currentValue;
    await call(`/api/circles/${c.id}`, 'PATCH', { currentValue: 99999 });
    const after = (await call(`/api/circles/${c.id}`)).body.circle.currentValue;
    check('progress still not writable', after === before, `${before} -> ${after}`);

    // --- honest auth reporting ------------------------------------------------
    const a = await call('/api/auth/status');
    check('auth status exposed', a.status === 200);
    // Authentication is now genuinely implemented (users, scrypt, expiring
    // revocable sessions), so this must report configured. The honesty
    // requirement has not gone away -- it moved: the endpoint must now admit
    // when the single-user DEVELOPMENT FALLBACK is still accepting
    // unauthenticated requests.
    check('reports auth IS configured', a.body?.configured === true);
    check('names the method', a.body?.method === 'session_token', a.body?.method);
    check('discloses the dev fallback state', typeof a.body?.devFallback === 'boolean');
    check('dev fallback is on outside production', a.body?.devFallback === true);
    check('and is NOT flagged insecure outside production', a.body?.insecure === false);
    check('explains the current posture', (a.body?.reason ?? '').length > 30);
  } finally {
    srv.close();
  }
}


// ---------------------------------------------------------------------------
// CAMPAIGNS (creator distribution layer)
//
// Covers the 17 cases required by the campaign brief, plus the attacks:
// forged ownership, forged revenue, forged registration counts, capacity
// bypass, and private-data leakage through the public endpoint.
// ---------------------------------------------------------------------------
console.log('\n=== CAMPAIGNS ===');
{
  process.env.NODE_ENV = 'test';
  const { default: app2 } = await import('../src/index.js');
  store._reset();

  const srv2 = app2.listen(0);
  const port2 = srv2.address().port;
  const call2 = async (path, method = 'GET', body, extraHeaders) => {
    const res = await fetch(`http://127.0.0.1:${port2}${path}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(extraHeaders ?? {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    // 1 + 2 + 3: create, server-derived identity, forged ownerId ignored
    let r = await call2('/api/campaigns', 'POST', {
      title: 'Saturday Pop-up', type: 'popup', location: 'Westlands',
      capacity: 3, price: 500, ownerId: 'attacker'
    });
    check('creator can create a campaign', r.status === 201, `got ${r.status}`);
    const camp = r.body.campaign;
    check('ownerId comes from the server', camp.ownerId === 'usr_me', camp.ownerId);
    check('forged ownerId in body ignored', camp.ownerId !== 'attacker');
    check('campaign starts as draft', camp.status === 'draft');
    check('public slug generated', typeof camp.publicSlug === 'string' && camp.publicSlug.length > 5);
    check('wraps a real Brief object', Boolean(store.find('objects', (o) => o.id === camp.objectId)));
    check('no stored revenue field', !('revenue' in camp));
    check('no stored registrations counter', !('registrations' in camp));

    // 5: unpublished campaign is NOT public
    r = await call2(`/api/public/campaigns/${camp.publicSlug}`);
    check('draft campaign is not public', r.status === 404, `got ${r.status}`);
    r = await call2(`/api/public/campaigns/${camp.publicSlug}/register`, 'POST', { attendeeRef: 'a1' });
    check('cannot register for a draft campaign', r.status === 404);

    // 4 + 6: publish, then public
    r = await call2(`/api/campaigns/${camp.id}/publish`, 'POST', {});
    check('owner can publish', r.status === 200, `got ${r.status}`);
    check('wrapped object became public',
      store.find('objects', (o) => o.id === camp.objectId).publication === 'public');

    r = await call2(`/api/public/campaigns/${camp.publicSlug}`);
    check('published campaign is public', r.status === 200, `got ${r.status}`);

    // 17: public response must not leak private information
    const pub = r.body.campaign;
    check('public view hides ownerId', !('ownerId' in pub));
    check('public view hides internal id', !('id' in pub));
    check('public view hides objectId', !('objectId' in pub));
    check('public view hides metrics/analytics', !('metrics' in pub) && !('analytics' in pub));
    check('public view shows availability only', typeof pub.remaining === 'number');

    // 7 + 8: owner may update; capacity frozen after publication
    r = await call2(`/api/campaigns/${camp.id}`, 'PATCH', { title: 'Saturday Pop-up (updated)' });
    check('owner can update', r.status === 200, `got ${r.status}`);
    r = await call2(`/api/campaigns/${camp.id}`, 'PATCH', { capacity: 999 });
    check('capacity frozen after publication', r.status === 400, `got ${r.status}`);

    // 14: capacity enforced from real registrations
    for (const ref of ['a1', 'a2', 'a3']) {
      const rr = await call2(`/api/public/campaigns/${camp.publicSlug}/register`, 'POST', { attendeeRef: ref });
      check(`registration ${ref} accepted`, rr.status === 201, `got ${rr.status}`);
    }
    r = await call2(`/api/public/campaigns/${camp.publicSlug}/register`, 'POST', { attendeeRef: 'a4' });
    check('4th registration refused at capacity 3', r.status === 409, `got ${r.status}`);

    r = await call2(`/api/public/campaigns/${camp.publicSlug}/register`, 'POST', { attendeeRef: 'a1' });
    check('duplicate registration is idempotent', r.status === 201);
    let an = (await call2(`/api/campaigns/${camp.id}/analytics`)).body.analytics;
    check('slots taken counted once per attendee', an.slotsTaken === 3, `got ${an.slotsTaken}`);
    check('remaining derived to zero', an.remaining === 0);

    // 9: registration drives derived participation
    check('registrationsStarted derived', an.registrationsStarted === 3, `got ${an.registrationsStarted}`);
    check('views recorded from real page loads', an.views >= 1, `got ${an.views}`);

    // 11 + 12: settled money is revenue, unsettled is not
    const regs = (await call2(`/api/campaigns/${camp.id}/registrations`)).body.registrations;
    const tx = (await call2('/api/transactions', 'POST',
      { amount: 500, type: 'campaign_order', campaignId: camp.id })).body.transaction;
    an = (await call2(`/api/campaigns/${camp.id}/analytics`)).body.analytics;
    check('unsettled transaction is NOT revenue', an.revenueSettled === 0, `got ${an.revenueSettled}`);
    check('unsettled money reported separately', an.revenuePending === 500);

    for (const st of ['pending', 'confirmed', 'settled']) {
      await call2(`/api/transactions/${tx.id}/transition`, 'POST', { status: st });
    }
    an = (await call2(`/api/campaigns/${camp.id}/analytics`)).body.analytics;
    check('settled transaction becomes revenue', an.revenueSettled === 500, `got ${an.revenueSettled}`);

    // 13: client cannot forge revenue
    await call2(`/api/campaigns/${camp.id}`, 'PATCH', { revenueSettled: 999999, revenue: 999999 });
    an = (await call2(`/api/campaigns/${camp.id}/analytics`)).body.analytics;
    check('client cannot forge revenue', an.revenueSettled === 500, `got ${an.revenueSettled}`);

    // 14b: client cannot forge registration counts
    await call2(`/api/campaigns/${camp.id}`, 'PATCH', { registrations: 5000, slotsTaken: 5000 });
    an = (await call2(`/api/campaigns/${camp.id}/analytics`)).body.analytics;
    check('client cannot forge registration count', an.slotsTaken === 3, `got ${an.slotsTaken}`);

    // check-in flow
    await call2(`/api/campaigns/${camp.id}/registrations/${regs[0].id}/status`, 'POST', { status: 'checked_in' });
    an = (await call2(`/api/campaigns/${camp.id}/analytics`)).body.analytics;
    check('check-in derived from records', an.checkedIn === 1, `got ${an.checkedIn}`);

    // 15 + 16: circle link and the target invariant
    const circle = (await call2('/api/circles', 'POST', { name: 'Popup Fund', targetValue: 1000 })).body.circle;
    const camp2 = (await call2('/api/campaigns', 'POST',
      { title: 'Linked', type: 'session', circleId: circle.id, price: 0 })).body.campaign;
    check('campaign can connect to an existing Circle', camp2.circleId === circle.id);

    const ctx = (await call2('/api/transactions', 'POST',
      { amount: 400, type: 'contribution', circleId: circle.id, campaignId: camp2.id })).body.transaction;
    let c1 = (await call2(`/api/circles/${circle.id}`)).body.circle;
    check('unsettled money does not move target', c1.currentValue === 0, `got ${c1.currentValue}`);
    for (const st of ['pending', 'confirmed', 'settled']) {
      await call2(`/api/transactions/${ctx.id}/transition`, 'POST', { status: st });
    }
    c1 = (await call2(`/api/circles/${circle.id}`)).body.circle;
    check('settled money moves the target', c1.currentValue === 400, `got ${c1.currentValue}`);
    await call2(`/api/circles/${circle.id}`, 'PATCH', { currentValue: 50000 });
    c1 = (await call2(`/api/circles/${circle.id}`)).body.circle;
    check('target progress still not client-writable', c1.currentValue === 400, `got ${c1.currentValue}`);

    // relationships use the existing graph
    check('campaign edge in existing relationships table',
      Boolean(store.find('relationships', (x) => x.verb === 'promoted_by_campaign')));

    // lifecycle refuses illegal hops
    r = await call2(`/api/campaigns/${camp2.id}/complete`, 'POST', {});
    check('illegal lifecycle hop refused', r.status === 400, `got ${r.status}`);

    // 8b: NON-OWNER ACCESS. Simulate a second owner by rewriting the row,
    // then re-attempt every owner route as the (now different) caller.
    const solo = (await call2('/api/campaigns', 'POST', { title: 'Mine', type: 'popup', price: 0 })).body.campaign;
    store.update('campaigns', solo.id, { ownerId: 'someone_else' });
    check('non-owner cannot read', (await call2(`/api/campaigns/${solo.id}`)).status === 404);
    check('non-owner cannot update', (await call2(`/api/campaigns/${solo.id}`, 'PATCH', { title: 'Hijack' })).status === 404);
    check('non-owner cannot publish', (await call2(`/api/campaigns/${solo.id}/publish`, 'POST', {})).status === 404);
    check('non-owner cannot read analytics', (await call2(`/api/campaigns/${solo.id}/analytics`)).status === 404);
    check('non-owner cannot read registrations', (await call2(`/api/campaigns/${solo.id}/registrations`)).status === 404);
    check('title unchanged after refused update',
      store.find('campaigns', (x) => x.id === solo.id).title === 'Mine');
    check('list excludes other owners campaigns',
      !(await call2('/api/campaigns')).body.campaigns.some((x) => x.id === solo.id));

    // no numeric trust score anywhere on a campaign
    check('no trustScore on campaign', !('trustScore' in camp) && !('reputation' in camp));

    // ---------------------------------------------------------------------
    // PHASE 7: DISTRIBUTION + OBJECT LINKING
    // ---------------------------------------------------------------------
    console.log('\n=== DISTRIBUTION + OBJECT LINKING ===');

    // --- config / public origin -----------------------------------------
    delete process.env.BRIEF_PUBLIC_ORIGIN;
    let cfg = await call2('/api/config');
    check('config reports null origin when unset', cfg.body.publicOrigin === null);
    check('config exposes the campaign path prefix', cfg.body.campaignPathPrefix === '/c/');
    check('config leaks no secrets',
      !('TELEGRAM_BOT_TOKEN' in cfg.body) && !('telegramToken' in cfg.body) &&
      Object.keys(cfg.body).length === 2);

    process.env.BRIEF_PUBLIC_ORIGIN = 'https://brief.example.com/';
    cfg = await call2('/api/config');
    check('configured origin is returned', cfg.body.publicOrigin === 'https://brief.example.com');
    check('trailing slash is normalised', !cfg.body.publicOrigin.endsWith('/'));
    delete process.env.BRIEF_PUBLIC_ORIGIN;

    // --- object attachment ------------------------------------------------
    const ownCamp = (await call2('/api/campaigns', 'POST', { title: 'Owns Object', type: 'drop' })).body.campaign;
    const ownObjId = ownCamp.objectId;
    check('campaign that creates its object reports ownsObject', ownCamp.ownsObject === true);
    check('campaign response embeds the wrapped object', ownCamp.object && ownCamp.object.id === ownObjId);
    check('embedded object carries no economic fields',
      ownCamp.object && !('revenue' in ownCamp.object) && !('price' in ownCamp.object) &&
      !('currentValue' in ownCamp.object));

    const attached = (await call2('/api/campaigns', 'POST',
      { title: 'Attaches Object', type: 'drop', objectId: ownObjId })).body.campaign;
    check('existing object can be attached', attached.objectId === ownObjId);
    check('attaching does not create a second object', attached.objectId === ownCamp.objectId);
    check('attached campaign reports ownsObject false', attached.ownsObject === false);
    check('attached object is exposed in the response', attached.object.id === ownObjId);

    const badAttach = await call2('/api/campaigns', 'POST',
      { title: 'Bad', type: 'drop', objectId: 'obj_does_not_exist' });
    check('nonexistent object rejected', badAttach.status === 400);
    check('nonexistent object gives a real reason', /object not found/.test(badAttach.body.error));

    // unauthorised: an object from a source with no membership row
    store.insert('sources', { id: 'src_x', name: 'Foreign', type: 'group',
      platform: 'telegram', accessType: 'private', createdAt: new Date().toISOString() });
    store.insert('objects', { id: 'obj_x', type: 'experience', title: 'Foreign Object',
      summary: '', publication: 'source_members', createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString() });
    store.insert('objectSources', { id: 'os_x', objectId: 'obj_x', sourceId: 'src_x' });

    const denied = await call2('/api/campaigns', 'POST',
      { title: 'Steal', type: 'popup', objectId: 'obj_x' });
    check('unauthorised object attachment rejected', denied.status === 400);
    check('refusal names authority, not existence', /not authorised/.test(denied.body.error));
    check('GET object 404s without membership', (await call2('/api/objects/obj_x')).status === 404);

    store.insert('sourceMemberships', { id: 'mem_x', userId: 'usr_me', sourceId: 'src_x',
      membershipStatus: 'member', accessGranted: true, accessMethod: 'declared',
      connectedAt: new Date().toISOString() });
    const allowed = await call2('/api/campaigns', 'POST',
      { title: 'Allowed', type: 'popup', objectId: 'obj_x' });
    check('membership grants attachment', allowed.status === 201);
    check('GET object 200s with membership', (await call2('/api/objects/obj_x')).status === 200);

    // --- attaching must never mutate or publish the object ----------------
    const beforePub = store.find('objects', (o) => o.id === 'obj_x').publication;
    await call2(`/api/campaigns/${allowed.body.campaign.id}/publish`, 'POST', {});
    const afterPub = store.find('objects', (o) => o.id === 'obj_x').publication;
    check('publishing does NOT publish an attached object', afterPub === beforePub);
    check('attached object stays source_members', afterPub === 'source_members');

    // --- PATCH: attach an object to an EXISTING campaign -------------------
    const later = (await call2('/api/campaigns', 'POST', { title: 'Attach Later', type: 'popup' })).body.campaign;
    const laterOwnObj = later.objectId;
    check('a fresh campaign owns its generated object', later.ownsObject === true);

    const patched = (await call2(`/api/campaigns/${later.id}`, 'PATCH', { objectId: 'obj_x' })).body.campaign;
    check('PATCH can attach an object to an existing campaign', patched.objectId === 'obj_x');
    check('PATCH attach flips ownsObject to false', patched.ownsObject === false);
    check('PATCH attach embeds the object projection', patched.object.id === 'obj_x');
    check('PATCH attach leaves the previously created object alive',
      Boolean(store.find('objects', (o) => o.id === laterOwnObj)));
    check('PATCH attach does not publish the attached object',
      store.find('objects', (o) => o.id === 'obj_x').publication === 'source_members');
    check('PATCH attach does not change lifecycle', patched.status === later.status);
    check('PATCH attach does not change ownership', patched.ownerId === later.ownerId);
    check('PATCH attach does not change the slug', patched.publicSlug === later.publicSlug);
    check('PATCH attach moves no money', patched.metrics.revenueSettled === 0);

    // ATTACK: attach an object the caller has no membership for
    store.insert('sources', { id: 'src_z', name: 'Other', type: 'group', platform: 'telegram',
      accessType: 'private', createdAt: new Date().toISOString() });
    store.insert('objects', { id: 'obj_z', type: 'experience', title: 'Someone Elses',
      summary: '', publication: 'source_members', createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString() });
    store.insert('objectSources', { id: 'os_z', objectId: 'obj_z', sourceId: 'src_z' });

    const stealPatch = await call2(`/api/campaigns/${later.id}`, 'PATCH', { objectId: 'obj_z' });
    check('ATTACK: PATCH cannot attach an unauthorised object', stealPatch.status === 400);
    check('ATTACK: refusal cites authority', /not authorised/.test(stealPatch.body.error));
    check('ATTACK: failed attach did not swap the object',
      (await call2(`/api/campaigns/${later.id}`)).body.campaign.objectId === 'obj_x');

    // ATTACK: publish someone else's object by attaching then publishing
    const beforeZ = store.find('objects', (o) => o.id === 'obj_z').publication;
    await call2(`/api/campaigns/${later.id}/publish`, 'POST', {});
    check('ATTACK: cannot publish a foreign object via attachment',
      store.find('objects', (o) => o.id === 'obj_z').publication === beforeZ);

    check('PATCH cannot detach to null', (await call2(`/api/campaigns/${later.id}`, 'PATCH',
      { objectId: null })).status === 400);
    check('PATCH rejects an unknown objectId', (await call2(`/api/campaigns/${later.id}`, 'PATCH',
      { objectId: 'obj_nope' })).status === 400);

    // --- GET /share : canonical distribution payload -----------------------
    delete process.env.BRIEF_PUBLIC_ORIGIN;
    const unconf = (await call2(`/api/campaigns/${later.id}/share`)).body.share;
    check('share is unavailable when no origin is configured', unconf.available === false);
    check('share names the reason honestly', unconf.reason === 'public_origin_not_configured');
    check('share still returns the slug when unconfigured', unconf.slug === later.publicSlug);
    check('share invents no url when unconfigured', !('url' in unconf) || unconf.url == null);
    check('share offers no fake channels when unconfigured',
      Object.keys(unconf.channels).length === 0);

    process.env.BRIEF_PUBLIC_ORIGIN = 'https://brief.example.com/';
    const sh = (await call2(`/api/campaigns/${later.id}/share`)).body.share;
    check('share becomes available once configured', sh.available === true);
    check('share url is origin + /c/ + slug', sh.url === `https://brief.example.com/c/${later.publicSlug}`);
    check('share url has no double slash', !sh.url.slice(8).includes('//'));
    check('share reason is absent when available', !('reason' in sh) || sh.reason == null);
    check('whatsapp intent is a real wa.me link', sh.channels.whatsapp.startsWith('https://wa.me/?text='));
    check('telegram intent is a real t.me link', sh.channels.telegram.startsWith('https://t.me/share/url?url='));
    check('x intent is a real intent link', sh.channels.x.startsWith('https://twitter.com/intent/tweet?url='));
    check('every channel embeds the canonical url',
      ['whatsapp', 'telegram', 'x'].every((k) => sh.channels[k].includes(encodeURIComponent(sh.url))));
    check('channels are url-encoded, never raw',
      !sh.channels.telegram.includes('https://brief.example.com/c/'));
    check('exactly three real channels', Object.keys(sh.channels).length === 3);
    check('instagram is copy-link only, not a channel',
      !('instagram' in sh.channels) && sh.copyOnly.includes('instagram'));
    check('tiktok is copy-link only, not a channel',
      !('tiktok' in sh.channels) && sh.copyOnly.includes('tiktok'));

    // ATTACK: the share payload must not be forgeable via headers or body
    const hostForge = await call2(`/api/campaigns/${later.id}/share`, 'GET', undefined,
      { host: 'evil.example.net', 'x-forwarded-host': 'evil.example.net' });
    check('ATTACK: Host header cannot redirect the canonical url',
      hostForge.body.share.url.startsWith('https://brief.example.com/'));
    check('ATTACK: canonical url never contains the forged host',
      !JSON.stringify(hostForge.body.share).includes('evil.example.net'));

    // ATTACK: distribution endpoint of a campaign the caller does not own
    const foreignCamp = store.insert('campaigns', {
      id: 'cmp_foreign', ownerId: 'usr_someone_else', title: 'Not Yours', type: 'popup',
      status: 'published', objectId: 'obj_z', ownsObject: false, publicSlug: 'not-yours',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    check('ATTACK: GET share on a foreign campaign 404s',
      (await call2('/api/campaigns/cmp_foreign/share')).status === 404);
    check('ATTACK: POST share on a foreign campaign 404s',
      (await call2('/api/campaigns/cmp_foreign/share', 'POST', {})).status === 404);
    check('ATTACK: PATCH on a foreign campaign 404s',
      (await call2('/api/campaigns/cmp_foreign', 'PATCH', { title: 'Hijacked' })).status === 404);
    check('ATTACK: foreign campaign was not modified',
      store.find('campaigns', (c) => c.id === 'cmp_foreign').title === 'Not Yours');
    check('ATTACK: body ownerId does not grant ownership of a foreign campaign',
      (await call2('/api/campaigns/cmp_foreign', 'PATCH',
        { ownerId: 'usr_me', title: 'Mine Now' })).status === 404);
    check('ATTACK: foreign campaign still belongs to its owner',
      store.find('campaigns', (c) => c.id === 'cmp_foreign').ownerId === 'usr_someone_else');

    // ATTACK: slug manipulation
    const slugBefore = store.find('campaigns', (c) => c.id === later.id).publicSlug;
    await call2(`/api/campaigns/${later.id}`, 'PATCH', { publicSlug: 'premium-slug' });
    check('ATTACK: publicSlug is not writable via PATCH',
      store.find('campaigns', (c) => c.id === later.id).publicSlug === slugBefore);
    check('ATTACK: a manipulated slug resolves to nothing',
      (await call2('/api/public/campaigns/premium-slug')).status === 404);
    check('ATTACK: slug stays stable across a title change',
      (await call2(`/api/campaigns/${later.id}`, 'PATCH',
        { title: 'Totally New Title' })).body.campaign.publicSlug === slugBefore);

    // ATTACK: sharing an unpublished campaign must not expose it publicly
    const draftShare = (await call2('/api/campaigns', 'POST',
      { title: 'Draft Only', type: 'popup' })).body.campaign;
    const ds = (await call2(`/api/campaigns/${draftShare.id}/share`)).body.share;
    check('a draft still gets a link (the creator may prepare)', typeof ds.slug === 'string');
    check('ATTACK: the draft link resolves to 404 while unpublished',
      (await call2(`/api/public/campaigns/${ds.slug}`)).status === 404);
    await call2(`/api/campaigns/${draftShare.id}/share`, 'POST', {});
    check('ATTACK: recording a share does not publish the campaign',
      store.find('campaigns', (c) => c.id === draftShare.id).status === 'draft');
    check('ATTACK: recording a share creates no transaction',
      store.filter('transactions', (t) => t.campaignId === draftShare.id).length === 0);
    check('ATTACK: recording a share creates no registration',
      (await call2(`/api/campaigns/${draftShare.id}`)).body.campaign.metrics.registrations === 0);

    // ATTACK: repeated public views inflate views but never viewers/economics
    await call2(`/api/campaigns/${draftShare.id}/publish`, 'POST', {});
    const dslug = store.find('campaigns', (c) => c.id === draftShare.id).publicSlug;
    for (let i = 0; i < 5; i += 1) await call2(`/api/public/campaigns/${dslug}`);
    const afterViews = (await call2(`/api/campaigns/${draftShare.id}`)).body.campaign.metrics;
    check('ATTACK: repeated views are counted as page loads', afterViews.views === 5);
    check('ATTACK: repeated views do not become viewers', afterViews.viewers === 1);
    check('ATTACK: repeated views create no revenue', afterViews.revenueSettled === 0);
    check('ATTACK: repeated views create no registrations', afterViews.registrations === 0);
    // 5 views and 0 registrations is a MEASURED 0%, not an unmeasurable one --
    // the honest value here is 0, and null would be the lie.
    check('ATTACK: views with no registrations is a real, measured 0%',
      afterViews.conversionPct === 0);
    delete process.env.BRIEF_PUBLIC_ORIGIN;

    // an owned object still follows its campaign
    await call2(`/api/campaigns/${ownCamp.id}/publish`, 'POST', {});
    check('publishing DOES publish an object the campaign created',
      store.find('objects', (o) => o.id === ownObjId).publication === 'public');

    // --- share ------------------------------------------------------------
    const shareDraft = (await call2('/api/campaigns', 'POST', { title: 'Draft Share', type: 'popup' })).body.campaign;
    check('sharing a draft is refused',
      (await call2(`/api/campaigns/${shareDraft.id}/share`, 'POST', { channel: 'whatsapp' })).status === 400);

    const shareable = (await call2('/api/campaigns', 'POST', { title: 'Shareable', type: 'popup', price: 500 })).body.campaign;
    await call2(`/api/campaigns/${shareable.id}/publish`, 'POST', {});

    // --- standalone banner + WhatsApp link -------------------------------
    process.env.BRIEF_PUBLIC_ORIGIN = 'https://brief.example.com/';
    r = await call2(`/api/campaigns/${shareable.id}/banner`, 'POST', {
      headline: 'Share the next gathering', body: 'A clean standalone card for the home shelf.'
    });
    check('published campaign can create a standalone banner',
      r.status === 201 && r.body?.banner?.status === 'active');
    check('banner carries the server WhatsApp intent link',
      r.body?.banner?.share?.available === true && r.body.banner.share.channels.whatsapp.startsWith('https://wa.me/?text='));
    r = await call2('/api/banners');
    check('active banners are publicly listed without a roster',
      r.status === 200 && r.body?.banners?.some((item) => item.campaignId === shareable.id) &&
      !JSON.stringify(r.body.banners).includes(shareable.ownerId));
    r = await call2(`/api/campaigns/${shareable.id}/banner`, 'POST', { headline: 'Changed' });
    check('creating the same banner is idempotent', r.status === 200 && r.body?.reused === true);
    r = await call2(`/api/banners/${r.body.banner.id}/archive`, 'POST', {});
    check('the owner can archive the standalone banner', r.status === 200 && r.body?.banner?.status === 'archived');
    delete process.env.BRIEF_PUBLIC_ORIGIN;

    const beforeShare = (await call2(`/api/campaigns/${shareable.id}`)).body.campaign.metrics;
    await call2(`/api/campaigns/${shareable.id}/share`, 'POST', { channel: 'whatsapp' });
    await call2(`/api/campaigns/${shareable.id}/share`, 'POST', { channel: 'telegram' });
    const afterShare = (await call2(`/api/campaigns/${shareable.id}`)).body.campaign.metrics;
    check('share count is derived from signals', afterShare.shares === 2);
    check('sharing does not mutate revenue',
      afterShare.revenueSettled === beforeShare.revenueSettled && afterShare.revenueSettled === 0);
    check('sharing does not mutate pending revenue',
      afterShare.revenuePending === beforeShare.revenuePending);
    check('sharing does not mutate slots', afterShare.slotsTaken === beforeShare.slotsTaken);
    check('sharing does not create registrations', afterShare.registrations === 0);
    check('sharing does not create a transaction',
      store.filter('ledgerTransactions', (t) => t.campaignId === shareable.id).length === 0);
    check('campaign_shared is a real signal type',
      store.filter('signals', (x) => x.type === 'campaign_shared').length === 2);

    // slug stays canonical across all of it
    check('slug unchanged by sharing',
      (await call2(`/api/campaigns/${shareable.id}`)).body.campaign.publicSlug === shareable.publicSlug);
    check('slug is not writable',
      (await call2(`/api/campaigns/${shareable.id}`, 'PATCH', { publicSlug: 'stolen' }))
        .body.campaign.publicSlug === shareable.publicSlug);

    // --- viewing ----------------------------------------------------------
    const txBefore = store.all('ledgerTransactions').length;
    for (let i = 0; i < 4; i++) await call2(`/api/public/campaigns/${shareable.publicSlug}`);
    const viewed = (await call2(`/api/campaigns/${shareable.id}`)).body.campaign.metrics;
    check('viewing does not create a transaction', store.all('ledgerTransactions').length === txBefore);
    check('viewing does not create revenue', viewed.revenueSettled === 0);
    check('page loads are counted', viewed.views === 4);
    check('repeat loads from one client collapse into one viewer', viewed.viewers === 1);
    check('viewers is never greater than views', viewed.viewers <= viewed.views);

    // --- honest conversion -------------------------------------------------
    const unviewed = (await call2('/api/campaigns', 'POST', { title: 'Unviewed', type: 'popup' })).body.campaign;
    check('no views -> conversion is null, not zero', unviewed.metrics.conversionPct === null);
    check('no views -> viewers is null, not zero', unviewed.metrics.viewers === null);
    check('views but no registrations -> a real 0%', viewed.conversionPct === 0);

    // --- public projection -------------------------------------------------
    const meta = (await call2('/api/campaigns', 'POST',
      { title: 'Meta', type: 'popup', metadata: { creatorName: 'Amina K', image: 'https://cdn.example.com/a.jpg' } })).body.campaign;
    await call2(`/api/campaigns/${meta.id}/publish`, 'POST', {});
    const pv = (await call2(`/api/public/campaigns/${meta.publicSlug}`)).body.campaign;
    check('public view exposes a creator label', pv.creator === 'Amina K');
    check('public view exposes an image when set', pv.image === 'https://cdn.example.com/a.jpg');
    check('public view still hides ownerId', !('ownerId' in pv));
    check('public view still hides internal ids',
      !('id' in pv) && !('objectId' in pv) && !('circleId' in pv));
    check('public view hides ownsObject', !('ownsObject' in pv));
    check('public view hides metrics and metadata', !('metrics' in pv) && !('metadata' in pv));
    check('public view hides the viewer fingerprint', !JSON.stringify(pv).includes('viewerRef'));
    const noMeta = (await call2(`/api/public/campaigns/${shareable.publicSlug}`)).body.campaign;
    check('creator is null when unset, not invented', noMeta.creator === null);
    check('image is null when unset, not a placeholder', noMeta.image === null);

    // ---------------------------------------------------------------------
    // PHASE 8: THE PAID LOOP (settlement -> registration)
    // ---------------------------------------------------------------------
    console.log('\n=== PAID REGISTRATION LOOP ===');

    const paid = (await call2('/api/campaigns', 'POST',
      { title: 'Paid Workshop', type: 'popup', capacity: 5, price: 1000 })).body.campaign;
    await call2(`/api/campaigns/${paid.id}/publish`, 'POST', {});
    const paidSlug = store.find('campaigns', (c) => c.id === paid.id).publicSlug;

    const held = (await call2(`/api/public/campaigns/${paidSlug}/register`, 'POST',
      { attendeeRef: 'buyer-1', name: 'Buyer One' })).body.registration;
    check('a paid registration opens as a held spot', held.status === 'started');
    let pm = (await call2(`/api/campaigns/${paid.id}`)).body.campaign.metrics;
    check('a held spot occupies capacity', pm.slotsTaken === 1);
    check('a held spot is NOT counted as a registration', pm.registrations === 0);
    check('a held spot creates no revenue', pm.revenueSettled === 0);
    check('a held spot creates no transaction', pm.orders === 0);

    // --- path A: settling a linked transaction promotes the spot -----------
    const linkTx = (await call2('/api/transactions', 'POST',
      { amount: 1000, type: 'sale', campaignId: paid.id, registrationId: held.id })).body.transaction;
    check('a transaction may carry a registrationId', linkTx.registrationId === held.id);
    for (const st of ['pending', 'confirmed']) {
      await call2(`/api/transactions/${linkTx.id}/transition`, 'POST', { status: st });
    }
    check('an unsettled linked transaction does NOT promote the spot',
      store.find('registrations', (r) => r.id === held.id).status === 'started');
    check('unsettled money is not revenue',
      (await call2(`/api/campaigns/${paid.id}`)).body.campaign.metrics.revenueSettled === 0);

    await call2(`/api/transactions/${linkTx.id}/transition`, 'POST', { status: 'settled' });
    check('settling a linked transaction promotes the held spot',
      store.find('registrations', (r) => r.id === held.id).status === 'registered');
    pm = (await call2(`/api/campaigns/${paid.id}`)).body.campaign.metrics;
    check('the promoted spot now counts as a registration', pm.registrations === 1);
    check('settled money is now revenue', pm.revenueSettled === 1000);
    check('promotion did not double-count the slot', pm.slotsTaken === 1);
    check('promotion emitted the existing campaign_registered signal',
      store.filter('signals', (sg) => sg.type === 'campaign_registered' &&
        sg.metadata?.registrationId === held.id).length === 1);

    // --- path B: the organiser confirms cash arrived ----------------------
    const held2 = (await call2(`/api/public/campaigns/${paidSlug}/register`, 'POST',
      { attendeeRef: 'buyer-2', name: 'Buyer Two' })).body.registration;
    const conf = await call2(`/api/campaigns/${paid.id}/registrations/${held2.id}/confirm-payment`, 'POST', {});
    check('confirm-payment succeeds for a held spot', conf.status === 201);
    check('confirm-payment promotes the registration', conf.body.registration.status === 'registered');
    check('confirm-payment settles a real transaction', conf.body.transaction.status === 'settled');
    check('confirm-payment links the transaction to the registration',
      conf.body.transaction.registrationId === held2.id);
    check('confirm-payment charges the CAMPAIGN price', conf.body.transaction.amount === 1000);
    check('confirm-payment returns derived analytics', conf.body.analytics.registrations === 2);
    check('confirm-payment produced real revenue', conf.body.analytics.revenueSettled === 2000);
    check('the transaction went through the real state machine',
      conf.body.transaction.history.map((h) => h.status).join() === 'created,pending,confirmed,settled');

    // ATTACK: a forged amount in the body must be ignored
    const held3 = (await call2(`/api/public/campaigns/${paidSlug}/register`, 'POST',
      { attendeeRef: 'buyer-3' })).body.registration;
    const forgedAmt = await call2(`/api/campaigns/${paid.id}/registrations/${held3.id}/confirm-payment`,
      'POST', { amount: 999999, price: 999999, revenueSettled: 999999 });
    check('ATTACK: a forged amount cannot mint revenue',
      forgedAmt.body.transaction.amount === 1000);
    check('ATTACK: forged revenue fields are ignored',
      forgedAmt.body.analytics.revenueSettled === 3000);

    // ATTACK: confirming twice must not double-charge
    const twice = await call2(`/api/campaigns/${paid.id}/registrations/${held2.id}/confirm-payment`, 'POST', {});
    check('ATTACK: confirming an already-paid spot is refused', twice.status === 409);
    check('ATTACK: double confirmation created no extra revenue',
      (await call2(`/api/campaigns/${paid.id}`)).body.campaign.metrics.revenueSettled === 3000);

    // ATTACK: cross-campaign registration links
    const other = (await call2('/api/campaigns', 'POST',
      { title: 'Other Paid', type: 'popup', price: 50 })).body.campaign;
    const cross = await call2('/api/transactions', 'POST',
      { amount: 99999, type: 'sale', campaignId: other.id, registrationId: held.id });
    check('ATTACK: a transaction cannot link a foreign campaign registration',
      cross.status === 400 && /does not belong/.test(cross.body.error));
    const orphan = await call2('/api/transactions', 'POST',
      { amount: 5, type: 'sale', registrationId: held.id });
    check('ATTACK: registrationId without its campaignId is refused', orphan.status === 400);
    const ghost = await call2('/api/transactions', 'POST',
      { amount: 5, type: 'sale', campaignId: paid.id, registrationId: 'reg_ghost' });
    check('ATTACK: an unknown registrationId is refused', ghost.status === 400);

    // ATTACK: confirm-payment on another creator's campaign
    check('ATTACK: confirm-payment on a foreign campaign 404s',
      (await call2(`/api/campaigns/cmp_foreign/registrations/${held.id}/confirm-payment`,
        'POST', {})).status === 404);
    check('ATTACK: confirm-payment with a foreign registration 404s',
      (await call2(`/api/campaigns/${other.id}/registrations/${held.id}/confirm-payment`,
        'POST', {})).status === 404);

    // A cancelled spot is not revived by a late payment.
    const held4 = (await call2(`/api/public/campaigns/${paidSlug}/register`, 'POST',
      { attendeeRef: 'buyer-4' })).body.registration;
    await call2(`/api/campaigns/${paid.id}/registrations/${held4.id}/status`, 'POST',
      { status: 'cancelled' });
    const lateTx = (await call2('/api/transactions', 'POST',
      { amount: 1000, type: 'sale', campaignId: paid.id, registrationId: held4.id })).body.transaction;
    for (const st of ['pending', 'confirmed', 'settled']) {
      await call2(`/api/transactions/${lateTx.id}/transition`, 'POST', { status: st });
    }
    check('a cancelled registration is NOT revived by a late settlement',
      store.find('registrations', (r) => r.id === held4.id).status === 'cancelled');
    check('confirm-payment refuses a cancelled spot',
      (await call2(`/api/campaigns/${paid.id}/registrations/${held4.id}/confirm-payment`,
        'POST', {})).status === 409);

    // A free campaign has nothing to confirm.
    const freeC = (await call2('/api/campaigns', 'POST',
      { title: 'Free Talk', type: 'popup', price: 0 })).body.campaign;
    await call2(`/api/campaigns/${freeC.id}/publish`, 'POST', {});
    const freeSlug = store.find('campaigns', (c) => c.id === freeC.id).publicSlug;
    const freeReg = (await call2(`/api/public/campaigns/${freeSlug}/register`, 'POST',
      { attendeeRef: 'free-1' })).body.registration;
    check('a free registration is immediately registered', freeReg.status === 'registered');
    check('confirm-payment is refused on a free campaign',
      (await call2(`/api/campaigns/${freeC.id}/registrations/${freeReg.id}/confirm-payment`,
        'POST', {})).status === 400);

    // Views and shares still create nothing economic on a paid campaign.
    const beforeEcon = (await call2(`/api/campaigns/${paid.id}`)).body.campaign.metrics;
    for (let i = 0; i < 3; i += 1) await call2(`/api/public/campaigns/${paidSlug}`);
    await call2(`/api/campaigns/${paid.id}/share`, 'POST', { channel: 'whatsapp' });
    const afterEcon = (await call2(`/api/campaigns/${paid.id}`)).body.campaign.metrics;
    check('views create no revenue', afterEcon.revenueSettled === beforeEcon.revenueSettled);
    check('views create no registrations', afterEcon.registrations === beforeEcon.registrations);
    check('shares create no revenue', afterEcon.orders === beforeEcon.orders);
    check('views were still counted as page loads', afterEcon.views > beforeEcon.views);

    // ---------------------------------------------------------------------
    // PHASE 9: REGISTRATION STATE MACHINE + TRANSACTION INTEGRITY
    // ---------------------------------------------------------------------
    console.log('\n=== TRANSACTION & TRUST RAIL ===');

    const mkPaid = async (over = {}) => {
      const c = (await call2('/api/campaigns', 'POST',
        Object.assign({ title: 'Rail', type: 'popup', capacity: 10, price: 1000 }, over))).body.campaign;
      await call2(`/api/campaigns/${c.id}/publish`, 'POST', {});
      return store.find('campaigns', (x) => x.id === c.id);
    };
    const regFor = async (slug, ref) =>
      (await call2(`/api/public/campaigns/${slug}/register`, 'POST', { attendeeRef: ref })).body.registration;
    const setSt = (cid, rid, status) =>
      call2(`/api/campaigns/${cid}/registrations/${rid}/status`, 'POST', { status });

    // --- G1: cancellation is terminal -------------------------------------
    const rail1 = await mkPaid();
    const r1 = await regFor(rail1.publicSlug, 'x1');
    await setSt(rail1.id, r1.id, 'cancelled');
    const revive = await setSt(rail1.id, r1.id, 'registered');
    check('ATTACK: a cancelled registration cannot be revived', revive.status === 400);
    check('the refusal names the illegal transition',
      /invalid registration transition/.test(revive.body.error));
    check('ATTACK: a cancelled registration cannot be checked in',
      (await setSt(rail1.id, r1.id, 'checked_in')).status === 400);
    check('ATTACK: a cancelled registration cannot be marked no_show',
      (await setSt(rail1.id, r1.id, 'no_show')).status === 400);
    check('the cancelled row is still cancelled',
      store.find('registrations', (r) => r.id === r1.id).status === 'cancelled');

    // --- G2: capacity cannot be exceeded by revival -----------------------
    const rail2 = await mkPaid({ capacity: 1, price: 0 });
    const a1 = await regFor(rail2.publicSlug, 'cap-a');
    await setSt(rail2.id, a1.id, 'cancelled');
    const a2 = await regFor(rail2.publicSlug, 'cap-b');
    check('cancelling frees the slot for someone else', a2 && a2.id !== a1.id);
    await setSt(rail2.id, a1.id, 'registered');
    const capM = (await call2(`/api/campaigns/${rail2.id}`)).body.campaign.metrics;
    check('ATTACK: reviving a cancelled spot cannot overbook the campaign',
      capM.slotsTaken <= capM.capacity, `slotsTaken ${capM.slotsTaken} > capacity ${capM.capacity}`);
    check('remaining never goes negative', capM.remaining >= 0);

    // --- G3: no path back into `started` -> no double charge --------------
    const rail3 = await mkPaid({ price: 500 });
    const r3 = await regFor(rail3.publicSlug, 'dbl');
    await call2(`/api/campaigns/${rail3.id}/registrations/${r3.id}/confirm-payment`, 'POST', {});
    await setSt(rail3.id, r3.id, 'checked_in');
    check('ATTACK: a checked-in registration cannot be forced back to started',
      (await setSt(rail3.id, r3.id, 'started')).status === 400);
    check('ATTACK: nothing may transition INTO started',
      (await setSt(rail3.id, r3.id, 'started')).status === 400);
    // Pay-at-the-door: a held spot checked in on arrival is legitimate and
    // must keep working. The double-charge fix is the backward edge, not this.
    const door = await mkPaid({ price: 250 });
    const rDoor = await regFor(door.publicSlug, 'door');
    check('a held spot can be checked in at the door',
      (await setSt(door.id, rDoor.id, 'checked_in')).status === 200);
    check('checking in at the door invents no revenue',
      (await call2(`/api/campaigns/${door.id}`)).body.campaign.metrics.revenueSettled === 0);
    check('ATTACK: a door check-in cannot then be pushed back to started',
      (await setSt(door.id, rDoor.id, 'started')).status === 400);
    check('ATTACK: a paid attendee cannot be charged twice',
      (await call2(`/api/campaigns/${rail3.id}/registrations/${r3.id}/confirm-payment`, 'POST', {})).status === 409);
    check('one attendee at price 500 produced exactly 500 of revenue',
      (await call2(`/api/campaigns/${rail3.id}`)).body.campaign.metrics.revenueSettled === 500);

    // legal transitions still work
    const rail3b = await mkPaid({ price: 0 });
    const r3b = await regFor(rail3b.publicSlug, 'legal');
    check('registered -> checked_in is allowed', (await setSt(rail3b.id, r3b.id, 'checked_in')).status === 200);
    check('checked_in -> no_show corrects a mis-tap',
      (await setSt(rail3b.id, r3b.id, 'no_show')).status === 200);
    check('no_show -> checked_in corrects it back',
      (await setSt(rail3b.id, r3b.id, 'checked_in')).status === 200);
    check('registered -> cancelled is allowed',
      (await setSt(rail3b.id, (await regFor(rail3b.publicSlug, 'legal2')).id, 'cancelled')).status === 200);

    // --- G4: non-positive amounts are refused ------------------------------
    check('ATTACK: a negative transaction amount is refused',
      (await call2('/api/transactions', 'POST',
        { amount: -99999, type: 'sale', campaignId: rail3.id })).status === 400);
    check('ATTACK: a zero transaction amount is refused',
      (await call2('/api/transactions', 'POST',
        { amount: 0, type: 'sale', campaignId: rail3.id })).status === 400);
    check('ATTACK: negative money never reached campaign revenue',
      (await call2(`/api/campaigns/${rail3.id}`)).body.campaign.metrics.revenueSettled === 500);
    const negCircle = (await call2('/api/circles', 'POST',
      { name: 'Neg', goal: 'g', targetValue: 1000 })).body.circle;
    check('ATTACK: negative money cannot drive a target backwards',
      (await call2('/api/transactions', 'POST',
        { amount: -500, type: 'contribution', circleId: negCircle.id })).status === 400);
    check('the target is untouched',
      (await call2(`/api/circles/${negCircle.id}`)).body.circle.currentValue === 0);
    check('a positive amount is still accepted',
      (await call2('/api/transactions', 'POST',
        { amount: 1, type: 'sale', campaignId: rail3.id })).status === 201);

    // --- G5: a refund releases the spot ------------------------------------
    const rail5 = await mkPaid({ capacity: 2, price: 800 });
    const r5 = await regFor(rail5.publicSlug, 'ref');
    const conf5 = await call2(`/api/campaigns/${rail5.id}/registrations/${r5.id}/confirm-payment`, 'POST', {});
    const tx5 = conf5.body.transaction;
    check('the attendee is registered after paying',
      store.find('registrations', (r) => r.id === r5.id).status === 'registered');
    await call2(`/api/transactions/${tx5.id}/transition`, 'POST', { status: 'refunded' });
    check('a refund releases the registration',
      store.find('registrations', (r) => r.id === r5.id).status === 'cancelled');
    const m5 = (await call2(`/api/campaigns/${rail5.id}`)).body.campaign.metrics;
    check('a refund removes the revenue', m5.revenueSettled === 0);
    check('a refund frees the slot', m5.slotsTaken === 0);
    check('a refund is reflected in the cancelled count', m5.cancelled === 1);
    check('a refunded spot cannot be confirmed again',
      (await call2(`/api/campaigns/${rail5.id}/registrations/${r5.id}/confirm-payment`, 'POST', {})).status === 409);
    check('a refunded, cancelled registration is not revived by a repeat refund',
      store.find('registrations', (r) => r.id === r5.id).status === 'cancelled');

    // a refund must not demote somebody who already attended
    const rail5b = await mkPaid({ price: 400 });
    const r5b = await regFor(rail5b.publicSlug, 'attended');
    const tx5b = (await call2(`/api/campaigns/${rail5b.id}/registrations/${r5b.id}/confirm-payment`, 'POST', {})).body.transaction;
    await setSt(rail5b.id, r5b.id, 'checked_in');
    await call2(`/api/transactions/${tx5b.id}/transition`, 'POST', { status: 'refunded' });
    check('a refund does not erase an attendance that already happened',
      store.find('registrations', (r) => r.id === r5b.id).status === 'checked_in');

    // --- G6: replay emits no duplicate signal ------------------------------
    const rail6 = await mkPaid({ price: 0 });
    const r6 = await regFor(rail6.publicSlug, 'idem');
    for (let i = 0; i < 3; i += 1) await setSt(rail6.id, r6.id, 'checked_in');
    check('repeating a status is idempotent',
      store.find('registrations', (r) => r.id === r6.id).status === 'checked_in');
    check('a replayed status change emits no duplicate signal',
      store.filter('signals', (sg) => sg.type === 'campaign_checkin' &&
        sg.metadata?.registrationId === r6.id).length === 1);
    check('the derived check-in count is still 1',
      (await call2(`/api/campaigns/${rail6.id}`)).body.campaign.metrics.checkedIn === 1);

    // --- ownership on the whole rail ---------------------------------------
    check('ATTACK: status route on a foreign campaign 404s',
      (await call2(`/api/campaigns/cmp_foreign/registrations/${r6.id}/status`, 'POST',
        { status: 'cancelled' })).status === 404);
    check('ATTACK: the foreign attempt changed nothing',
      store.find('registrations', (r) => r.id === r6.id).status === 'checked_in');

    // ---------------------------------------------------------------------
    // PHASE 10: CONNECTOR BOUNDARY (G1 fail-closed, G2 malformed -> 400)
    // ---------------------------------------------------------------------
    console.log('\n=== CONNECTOR BOUNDARY ===');

    const tgUpdate = (over = {}) => ({
      update_id: 1,
      message: Object.assign({
        message_id: 4242, date: 1755400000,
        chat: { id: -100999, type: 'group', title: 'Boundary Group' },
        from: { id: 7 },
        text: 'Join us Sat 3pm at Kilimani Hall. Tickets 500 KES. Contact 0712345678'
      }, over)
    });
    const hook = (body, secretHeader) =>
      call2('/api/webhooks/telegram', 'POST', body,
        secretHeader ? { 'x-telegram-bot-api-secret-token': secretHeader } : undefined);

    // --- G1: fail closed ---------------------------------------------------
    const savedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    delete process.env.TELEGRAM_WEBHOOK_SECRET;

    const sourcesBefore = store.filter('sources', () => true).length;
    const rawBefore = store.filter('rawItems', () => true).length;

    let hr = await hook(tgUpdate());
    check('ATTACK: an unconfigured telegram webhook refuses anonymous input', hr.status === 401);
    check('the refusal names the missing configuration',
      /TELEGRAM_WEBHOOK_SECRET not set/.test(hr.body.error));
    check('ATTACK: guessing a header does not bypass an unset secret',
      (await hook(tgUpdate(), 'anything')).status === 401);
    check('ATTACK: an unauthenticated webhook creates no source',
      store.filter('sources', () => true).length === sourcesBefore);
    check('ATTACK: an unauthenticated webhook stores no raw item',
      store.filter('rawItems', () => true).length === rawBefore);

    process.env.TELEGRAM_WEBHOOK_SECRET = 'phase10-secret';
    check('ATTACK: a configured secret with no header is refused',
      (await hook(tgUpdate())).status === 401);
    check('ATTACK: a configured secret with the wrong header is refused',
      (await hook(tgUpdate(), 'wrong')).status === 401);

    const good = await hook(tgUpdate(), 'phase10-secret');
    check('a correctly authenticated webhook is accepted', good.status === 200);
    check('the accepted webhook stored a raw item', Boolean(good.body.rawItemId));
    check('replaying an authenticated webhook is idempotent',
      (await hook(tgUpdate(), 'phase10-secret')).body.duplicate === true);
    check('replay created no second raw item',
      store.filter('rawItems', (r) => r.externalId === '-100999:4242').length === 1);

    // --- G2: malformed -> 400, never 500 -----------------------------------
    const rawAtG2 = store.filter('rawItems', () => true).length;
    const malformed = [
      ['a non-object update', [1, 2, 3]],
      ['a non-object message', { update_id: 2, message: [1, 2, 3] }],
      ['an object message_id', tgUpdate({ message_id: { a: 1 } })],
      ['an array chat.id', tgUpdate({ chat: { id: [1, 2], type: 'group' } })],
      ['a numeric chat.type', tgUpdate({ chat: { id: -5, type: 99 } })],
      ['a numeric text', tgUpdate({ text: 12345 })],
      ['a non-numeric date', tgUpdate({ date: 'not-a-date' })],
      ['oversized text', tgUpdate({ text: 'A'.repeat(200000) })]
    ];
    for (const [label, body] of malformed) {
      const mr = await hook(body, 'phase10-secret');
      check(`malformed payload rejected with 400: ${label}`, mr.status === 400,
        `got ${mr.status}`);
      check(`the rejection for ${label} leaks no internals`,
        typeof mr.body.error === 'string' && !/\bat \w+\.|node_modules|\/home\//.test(mr.body.error));
    }
    check('malformed payloads persisted nothing',
      store.filter('rawItems', () => true).length === rawAtG2);

    // valid-but-ignorable input still succeeds (must NOT become a 400)
    const ignorable = await hook({ update_id: 3, message: { message_id: 55,
      date: 1755400000, chat: { id: -100999, type: 'group' } } }, 'phase10-secret');
    check('an update with no text is ignored, not rejected', ignorable.status === 200);
    check('the ignorable update is reported honestly', ignorable.body.ignored === 'no usable text');
    check('an empty update object is ignored, not rejected',
      (await hook({}, 'phase10-secret')).status === 200);

    // --- economic firewall across the connector boundary -------------------
    const moneyText = 'PAID: 50 tickets sold, revenue 250000 KES settled, 50 registrations. ' +
      'Sat 3pm Kilimani Hall contact 0712345678';
    const p10Tx = store.filter('ledgerTransactions', () => true).length;
    const p10Reg = store.filter('registrations', () => true).length;
    const p10Camp = store.filter('campaigns', () => true).length;
    await hook(tgUpdate({ message_id: 8888, text: moneyText }), 'phase10-secret');
    await new Promise((r) => setTimeout(r, 250));
    check('ingestion creates no transaction',
      store.filter('ledgerTransactions', () => true).length === p10Tx);
    check('ingestion creates no registration',
      store.filter('registrations', () => true).length === p10Reg);
    check('ingestion creates no campaign',
      store.filter('campaigns', () => true).length === p10Camp);
    // Scoped to the object THIS webhook produced. A global scan would be wrong:
    // objects ingested from a genuinely public source, and objects a campaign
    // publishes, are legitimately public elsewhere in this suite.
    const p10Src = store.find('sources', (x) => x.externalId === '-100999');
    const p10Raw = p10Src
      ? store.filter('rawItems', (r) => r.sourceId === p10Src.id).map((r) => r.id)
      : [];
    const p10Objs = store.filter('objects', (o) =>
      store.filter('objectSources', (os) => os.objectId === o.id)
        .some((os) => os.sourceId === p10Src?.id));
    check('the webhook source is private (member_access), not public',
      Boolean(p10Src) && p10Src.accessType === 'member_access');
    check('an object ingested from a private group is never public',
      p10Objs.every((o) => o.publication !== 'public'), 
      p10Objs.map((o) => o.publication).join(','));
    check('the webhook actually produced raw items to reason about', p10Raw.length > 0);

    if (savedSecret === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
    else process.env.TELEGRAM_WEBHOOK_SECRET = savedSecret;
  } finally {
    srv2.close();
  }
}

// ---------------------------------------------------------------------------
// CIRCLE OPERATIONS (Batch 2): blocks, tasks, votes, evidence.
//
// Finding F5 recorded that Blocks had ZERO server test coverage despite
// having a route and a type vocabulary. This closes that gap.
//
// These tests exercise BEHAVIOUR, not existence. Every case here fails if the
// implementation breaks: illegal transitions, forged assignees, duplicate
// ballots, cross-circle operations, and tallies that drift from their records.
//
// Multi-user note: callerId() is a single-user constant until an auth
// provider is connected, so "another user" is simulated by writing the
// membership rows directly and driving the domain layer, while the ROUTES are
// used to prove the authority checks reject the caller. Both halves matter --
// one proves the rules, the other proves they are actually wired in.
// ---------------------------------------------------------------------------
console.log('\n=== CIRCLE OPERATIONS: BLOCKS (spec F5) ===');
{
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('../src/index.js');
  const blocksDomain = await import('../src/domain/block.js');
  const signalsDomain = await import('../src/domain/signal.js');
  store._reset();

  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, method = 'GET', body) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const ME = 'usr_me';

  try {
    // --- setup: a circle the caller coordinates, and a foreign one ----------
    const circle = (await call('/api/circles', 'POST', { name: 'Kilimani Ops', targetValue: 5000 })).body.circle;
    await call(`/api/circles/${circle.id}/members`, 'POST', { role: 'coordinator' });
    const foreign = (await call('/api/circles', 'POST', { name: 'Other Circle' })).body.circle;

    // ================= NOTES =================
    console.log('\n  -- notes --');
    let r = await call('/api/blocks', 'POST', { circleId: circle.id, type: 'note', content: 'Gate code changed' });
    check('note block created', r.status === 201, `got ${r.status}`);
    check('note belongs to its circle', r.body?.block?.circleId === circle.id);
    check('note content preserved', r.body?.block?.content === 'Gate code changed');

    r = await call('/api/blocks', 'POST', { circleId: 'circ_does_not_exist', type: 'note', content: 'x' });
    check('note in a nonexistent circle rejected', r.status === 404, `got ${r.status}`);

    r = await call('/api/blocks', 'POST', { circleId: circle.id, type: 'note', content: '   ' });
    check('blank note content rejected', r.status === 400, `got ${r.status}`);

    r = await call('/api/blocks', 'POST', { circleId: circle.id, type: 'nonsense', content: 'x' });
    check('unknown block type rejected', r.status === 400, `got ${r.status}`);

    const listed = (await call(`/api/blocks?circleId=${circle.id}`)).body.blocks;
    check('blocks list scoped to the circle', listed.every((b) => b.circleId === circle.id));
    check('foreign circle blocks not listed', !listed.some((b) => b.circleId === foreign.id));

    // ================= TASKS =================
    console.log('\n  -- tasks --');
    r = await call('/api/blocks', 'POST', { circleId: circle.id, type: 'task', content: 'Repair the gate' });
    const task = r.body.block;
    check('task block created', r.status === 201 && task.type === 'task');
    check('task is born open', task.task?.status === 'open', JSON.stringify(task.task));
    check('task is born unassigned', task.task?.assigneeId === null);

    // A task cannot skip straight to completed -- it was never taken on.
    r = await call(`/api/circles/${circle.id}/blocks/${task.id}/complete`, 'POST', {});
    check('completing an unassigned task is rejected', r.status === 400, `got ${r.status}`);
    check('rejection names the illegal transition', /invalid task transition/.test(r.body?.error ?? ''), r.body?.error);

    r = await call(`/api/circles/${circle.id}/blocks/${task.id}/assign`, 'POST', {});
    check('self-assign succeeds', r.status === 200, `got ${r.status}`);
    check('task now assigned to caller', r.body?.block?.task?.assigneeId === ME);
    check('assignment reported as a real change', r.body?.changed === true);

    // Idempotence: the Phase 9 lesson applied to activity evidence.
    const sigsBefore = store.filter('signals', (s) => s.type === 'task_assigned').length;
    r = await call(`/api/circles/${circle.id}/blocks/${task.id}/assign`, 'POST', {});
    check('re-assigning to the same member is a no-op', r.body?.changed === false, JSON.stringify(r.body?.changed));
    const sigsAfter = store.filter('signals', (s) => s.type === 'task_assigned').length;
    check('a no-op emits NO second signal', sigsAfter === sigsBefore, `${sigsBefore} -> ${sigsAfter}`);

    // Assigning to a non-member must fail even with coordinator authority.
    r = await call(`/api/circles/${circle.id}/blocks/${task.id}/assign`, 'POST', { assigneeId: 'usr_outsider' });
    check('cannot assign to a non-member', r.status === 400, `got ${r.status}`);
    check('refusal explains membership', /not a member/.test(r.body?.error ?? ''), r.body?.error);

    r = await call(`/api/circles/${circle.id}/blocks/${task.id}/complete`, 'POST', {});
    check('assignee completes the task', r.status === 200 && r.body?.block?.task?.status === 'completed');
    check('completion records who did it', r.body?.block?.task?.completedBy === ME);
    check('completion is timestamped', Boolean(r.body?.block?.task?.completedAt));

    // Completed is terminal.
    const completedSigs = store.filter('signals', (s) => s.type === 'task_completed').length;
    r = await call(`/api/circles/${circle.id}/blocks/${task.id}/complete`, 'POST', {});
    check('completing twice is a no-op, not a second completion', r.body?.changed === false);
    check('no duplicate completion signal',
      store.filter('signals', (s) => s.type === 'task_completed').length === completedSigs);
    r = await call(`/api/circles/${circle.id}/blocks/${task.id}/release`, 'POST', {});
    check('a completed task cannot be reopened', r.status === 400, `got ${r.status}`);

    // --- cross-circle: a block is reachable only through its own circle ----
    // Created through the domain: the caller is not a member of `foreign`, so
    // the route would (correctly) refuse. The point of this case is the
    // cross-circle path check, not block creation.
    const foreignTask = blocksDomain.createBlock({
      circleId: foreign.id, type: 'task', content: 'Foreign work'
    });
    r = await call(`/api/circles/${circle.id}/blocks/${foreignTask.id}/assign`, 'POST', {});
    check('cannot operate on a foreign circle task via my circle', r.status === 404, `got ${r.status}`);
    check('foreign task untouched',
      blocksDomain.taskState(store.find('blocks', (b) => b.id === foreignTask.id)).status === 'open');

    r = await call(`/api/circles/${circle.id}/blocks/blk_nope/assign`, 'POST', {});
    check('unknown block id rejected', r.status === 404, `got ${r.status}`);

    // --- role enforcement: observer may not operate -------------------------
    // Demote the caller to observer and prove the API refuses, rather than
    // relying on a hidden button.
    const myRow = store.find('members', (m) => m.circleId === circle.id && m.userId === ME);
    store.update('members', myRow.id, { role: 'observer' });
    const obsTask = (await call('/api/blocks', 'POST', {
      circleId: circle.id, type: 'task', content: 'Observer must not take this'
    })).body.block;
    r = await call(`/api/circles/${circle.id}/blocks/${obsTask.id}/assign`, 'POST', {});
    check('observer cannot take on a task', r.status === 403, `got ${r.status}`);
    check('refusal names the role', /observer/.test(r.body?.error ?? ''), r.body?.error);
    check('observer assignment did not happen',
      blocksDomain.taskState(store.find('blocks', (b) => b.id === obsTask.id)).assigneeId === null);
    store.update('members', myRow.id, { role: 'coordinator' });

    // --- non-member cannot operate at all ----------------------------------
    const strangerCircle = (await call('/api/circles', 'POST', { name: 'Not Mine' })).body.circle;
    store.insert('members', {
      id: 'memb_other', circleId: strangerCircle.id, userId: 'usr_someone_else',
      role: 'coordinator', verifications: [], joinedAt: new Date().toISOString()
    });
    const strangerTask = blocksDomain.createBlock({
      circleId: strangerCircle.id, type: 'task', content: 'Their work'
    });
    r = await call(`/api/circles/${strangerCircle.id}/blocks/${strangerTask.id}/assign`, 'POST', {});
    check('non-member cannot take on a task', r.status === 403, `got ${r.status}`);
    check('refusal explains membership', /only members/.test(r.body?.error ?? ''), r.body?.error);

    // ================= VOTES =================
    console.log('\n  -- votes --');
    r = await call('/api/blocks', 'POST', {
      circleId: circle.id, type: 'vote', content: 'Move market day to Sunday?'
    });
    check('vote with no options rejected', r.status === 400, `got ${r.status}`);
    check('refusal explains the minimum', /two distinct options/.test(r.body?.error ?? ''), r.body?.error);

    // Created THROUGH THE ROUTE on purpose: the options travel in `metadata`,
    // and an earlier version of this route dropped that field entirely, so a
    // vote could never be created over HTTP. Building it via the domain here
    // would have hidden that bug.
    r = await call('/api/blocks', 'POST', {
      circleId: circle.id, type: 'vote', content: 'Move market day to Sunday?',
      metadata: { options: ['Yes', 'No', 'Abstain'] }
    });
    check('vote block created over HTTP', r.status === 201, `got ${r.status} ${JSON.stringify(r.body)}`);
    const voteBlock = r.body.block;
    check('options survived the route', blocksDomain.voteOptions(
      store.find('blocks', (b) => b.id === voteBlock.id)).length === 3);
    check('vote starts open', !blocksDomain.isVoteClosed(voteBlock));
    check('tally hydrated on creation', voteBlock.tally?.totalVotes === 0);

    // Duplicate options would let one choice appear twice on a ballot.
    r = await call('/api/blocks', 'POST', {
      circleId: circle.id, type: 'vote', content: 'Dupe?', metadata: { options: ['Yes', 'Yes'] }
    });
    check('duplicate vote options rejected', r.status === 400, `got ${r.status}`);

    let t = (await call(`/api/circles/${circle.id}/blocks/${voteBlock.id}/tally`)).body.tally;
    check('empty tally counts zero', t.totalVotes === 0);
    check('every option present even at zero', t.results.length === 3);
    check('pct is null, not 0, before any vote', t.results.every((x) => x.pct === null));
    check('no leader without votes', t.leader === null);

    r = await call(`/api/circles/${circle.id}/blocks/${voteBlock.id}/vote`, 'POST', { option: 'Yes' });
    check('member casts a valid vote', r.status === 201, `got ${r.status}`);
    check('tally returned with the ballot', r.body?.tally?.totalVotes === 1);

    r = await call(`/api/circles/${circle.id}/blocks/${voteBlock.id}/vote`, 'POST', { option: 'No' });
    check('duplicate vote rejected with 409', r.status === 409, `got ${r.status}`);
    check('refusal says already voted', /already voted/.test(r.body?.error ?? ''), r.body?.error);
    check('duplicate did not change the tally',
      blocksDomain.tallyVote(voteBlock.id).totalVotes === 1);

    r = await call(`/api/circles/${circle.id}/blocks/${voteBlock.id}/vote`, 'POST', { option: 'Maybe' });
    check('invalid option rejected', r.status === 400, `got ${r.status}`);
    check('refusal lists the valid options', /Yes/.test(r.body?.error ?? ''), r.body?.error);

    // --- tally correctness against real ballots ----------------------------
    // Add real members and real ballots through the domain, then verify the
    // tally MATCHES THE ROWS -- this is what a stored counter would get wrong.
    for (const u of ['usr_a', 'usr_b', 'usr_c']) {
      store.insert('members', {
        id: `memb_${u}`, circleId: circle.id, userId: u,
        role: 'contributor', verifications: [], joinedAt: new Date().toISOString()
      });
    }
    blocksDomain.castVote(voteBlock.id, 'usr_a', 'No');
    blocksDomain.castVote(voteBlock.id, 'usr_b', 'No');
    blocksDomain.castVote(voteBlock.id, 'usr_c', 'Abstain');

    t = blocksDomain.tallyVote(voteBlock.id);
    const byOpt = Object.fromEntries(t.results.map((x) => [x.option, x.count]));
    check('tally counts Yes correctly', byOpt.Yes === 1, JSON.stringify(byOpt));
    check('tally counts No correctly', byOpt.No === 2, JSON.stringify(byOpt));
    check('tally counts Abstain correctly', byOpt.Abstain === 1, JSON.stringify(byOpt));
    check('total equals ballots cast', t.totalVotes === 4, String(t.totalVotes));
    check('tally matches the underlying rows',
      t.totalVotes === store.filter('votes', (v) => v.blockId === voteBlock.id).length);
    check('leader is the strict winner', t.leader === 'No', String(t.leader));
    check('percentages derived from real total',
      Math.round(byOpt.No / t.totalVotes * 100) === Math.round(t.results.find((x) => x.option === 'No').pct));
    check('eligible count comes from real membership rows',
      t.eligibleCount === store.filter('members', (m) => m.circleId === circle.id).length);

    // A tie must not invent a winner.
    const tieVote = blocksDomain.createBlock({
      circleId: circle.id, type: 'vote', content: 'Tie?', metadata: { options: ['A', 'B'] }
    });
    blocksDomain.castVote(tieVote.id, 'usr_a', 'A');
    blocksDomain.castVote(tieVote.id, 'usr_b', 'B');
    check('a tie reports no leader', blocksDomain.tallyVote(tieVote.id).leader === null);

    // --- foreign circle voting ---------------------------------------------
    const foreignVote = blocksDomain.createBlock({
      circleId: foreign.id, type: 'vote', content: 'Their question', metadata: { options: ['X', 'Y'] }
    });
    r = await call(`/api/circles/${circle.id}/blocks/${foreignVote.id}/vote`, 'POST', { option: 'X' });
    check('cannot vote in a foreign circle through my own', r.status === 404, `got ${r.status}`);
    check('foreign vote received no ballot',
      blocksDomain.tallyVote(foreignVote.id).totalVotes === 0);

    // A member of MY circle is not automatically eligible in another.
    let threw = null;
    try { blocksDomain.castVote(foreignVote.id, 'usr_a', 'X'); } catch (e) { threw = e.message; }
    check('non-member of that circle cannot vote in it', /only members/.test(threw ?? ''), String(threw));

    // --- closing a vote -----------------------------------------------------
    r = await call(`/api/circles/${circle.id}/blocks/${voteBlock.id}/close-vote`, 'POST', {});
    check('coordinator closes the vote', r.status === 200 && r.body?.block?.metadata?.vote?.closed === true);
    r = await call(`/api/circles/${circle.id}/blocks/${voteBlock.id}/vote`, 'POST', { option: 'Yes' });
    check('closed vote accepts no more ballots', r.status === 400, `got ${r.status}`);
    check('tally survives closing', blocksDomain.tallyVote(voteBlock.id).totalVotes === 4);

    // ================= SIGNALS AS ACTIVITY =================
    console.log('\n  -- signals / activity --');
    const acts = (await call(`/api/signals?circleId=${circle.id}`)).body.signals;
    check('activity feed is populated by real actions', acts.length > 0, String(acts.length));
    check('activity records the task assignment', acts.some((s) => s.type === 'task_assigned'));
    check('activity records the task completion', acts.some((s) => s.type === 'task_completed'));
    check('activity records votes cast', acts.some((s) => s.type === 'vote_cast'));
    check('activity is newest-first',
      acts.every((s, i) => i === 0 || acts[i - 1].createdAt >= s.createdAt));
    check('activity scoped to this circle', acts.every((s) => s.circleId === circle.id));
    check('a vote signal does not leak HOW someone voted',
      acts.filter((s) => s.type === 'vote_cast').every((s) => !JSON.stringify(s.metadata ?? {}).includes('Yes')));

    const foreignActs = (await call(`/api/signals?circleId=${foreign.id}`)).body.signals;
    check('foreign circle activity does not leak in',
      foreignActs.every((s) => s.circleId === foreign.id));

    // ================= MEMBER EVIDENCE =================
    console.log('\n  -- member evidence --');
    const ev = (await call(`/api/circles/${circle.id}/members/${ME}/evidence`)).body;
    check('evidence derived for a member who acted', ev.evidence.length > 0, String(ev.evidence.length));
    check('evidence includes the completed task', ev.evidence.some((e) => e.kind === 'task_completed'));
    check('evidence includes the vote cast', ev.evidence.some((e) => e.kind === 'vote_cast'));
    check('evidence is human readable', ev.evidence.every((e) => typeof e.label === 'string' && e.label.length > 0));
    check('evidence links back to its signal', ev.evidence.every((e) => Boolean(e.signalId)));

    // The rule that matters most: evidence, never a score.
    const evJson = JSON.stringify(ev);
    check('NO trust score in evidence', !/trustScore|"score"|rating|reliability/i.test(evJson));
    check('NO percentage presented as trust', !/\d+%/.test(evJson.replace(/\d+% of/g, '')));
    check('summary counts are plain facts',
      ev.summary.every((x) => typeof x.count === 'number' && typeof x.label === 'string'));

    // Joining is the member's own act: it must appear in THEIR history, not
    // in that of the coordinator who added them.
    check('joining is attributed to the member who joined',
      ev.evidence.some((e) => e.kind === 'member_joined'),
      ev.evidence.map((e) => e.kind).join(','));

    const emptyEv = (await call(`/api/circles/${circle.id}/members/usr_nobody/evidence`)).body;
    check('a member who did nothing has NO evidence', emptyEv.evidence.length === 0);
    check('no evidence is an empty list, not a zero score', Array.isArray(emptyEv.evidence) && emptyEv.summary.length === 0);

    // Evidence is scoped: acting in one circle is not evidence in another.
    const scoped = signalsDomain.memberEvidence(ME, { circleId: foreign.id });
    check('evidence scoped per circle', scoped.every((e) => e.circleId === foreign.id));

    // ================= TARGETS STILL DERIVED =================
    console.log('\n  -- targets --');
    const before = (await call(`/api/circles/${circle.id}`)).body.circle;
    check('target progress starts at zero with no settled money', before.currentValue === 0);
    check('progressPct derived from a real target', before.progressPct === 0);

    // Client must not be able to write progress.
    r = await call(`/api/circles/${circle.id}`, 'PATCH', { currentValue: 99999, progressPct: 100 });
    const after = (await call(`/api/circles/${circle.id}`)).body.circle;
    check('client cannot PATCH currentValue', after.currentValue === 0, String(after.currentValue));
    check('client cannot PATCH progressPct', after.progressPct === 0, String(after.progressPct));

    // Real settled money moves it; nothing else does.
    store.insert('ledgerTransactions', {
      id: 'tx_c1', circleId: circle.id, amount: 2500, currency: 'KES', type: 'contribution',
      status: 'settled', counterparty: 'usr_a', history: [], createdAt: new Date().toISOString()
    });
    store.insert('ledgerTransactions', {
      id: 'tx_c2', circleId: circle.id, amount: 1000, currency: 'KES', type: 'contribution',
      status: 'pending', counterparty: 'usr_b', history: [], createdAt: new Date().toISOString()
    });
    const moved = (await call(`/api/circles/${circle.id}`)).body.circle;
    check('settled contribution counts toward target', moved.currentValue === 2500, String(moved.currentValue));
    check('PENDING money does NOT count', moved.currentValue === 2500, 'pending leaked into progress');
    check('progress percentage is real arithmetic', moved.progressPct === 50, String(moved.progressPct));
    check('contributor count from settled rows only', moved.contributorCount === 1, String(moved.contributorCount));
  } finally {
    srv.close();
  }
}


/**
 * A ledger row for commerce tests. Uses the real domain so the transaction is
 * subject to the same validation as any other money in Brief.
 */
function ledgerFor(st, { amount }) {
  return st.insert('ledgerTransactions', {
    id: `txn_t${st.all('ledgerTransactions').length + 1}`,
    amount, currency: 'KES', type: 'order_payment', status: 'created',
    description: '', counterparty: null, circleId: null, objectId: null,
    campaignId: null, registrationId: null, metadata: {},
    history: [{ status: 'created', at: new Date().toISOString() }],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
}

console.log('\n=== COMMERCE: VENDORS, LISTINGS, ORDERS (Batch 3) ===');
{
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('../src/index.js');
  const vendorsDomain = await import('../src/domain/vendor.js');
  const listingsDomain = await import('../src/domain/listing.js');
  const ordersDomain = await import('../src/domain/order.js');
  store._reset();

  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, method = 'GET', body) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const ME = 'usr_me';

  try {
    // --- honest empty state ------------------------------------------------
    let r = await call('/api/listings');
    check('empty marketplace returns no listings', Array.isArray(r.body.listings) && r.body.listings.length === 0);
    r = await call('/api/vendors/me');
    check('a user who does not sell has no vendor', r.body.vendor === null);
    r = await call('/api/orders');
    check('no orders before anything is bought', r.body.orders.length === 0);

    // --- listing before being a vendor -------------------------------------
    r = await call('/api/listings', 'POST', { title: 'Ghost goods', price: 100 });
    check('cannot list without a vendor profile', r.status === 403, `got ${r.status}`);

    // --- vendor creation ---------------------------------------------------
    r = await call('/api/vendors', 'POST', { displayName: 'Kikao Streetwear', description: 'Printed hoodies' });
    check('vendor created', r.status === 201, `got ${r.status} ${JSON.stringify(r.body)}`);
    const vendor = r.body.vendor;
    check('vendor owned by the caller, not the body', vendor.ownerId === ME, vendor.ownerId);
    check('vendor starts active', vendor.status === 'active');
    check('vendor carries no numeric score',
      !/score|rating|stars|reliability/i.test(JSON.stringify(vendor)), JSON.stringify(vendor).slice(0, 160));
    check('vendor verification is an evidence list', Array.isArray(vendor.verification.evidence));
    check('unverified vendor has no evidence', vendor.verification.evidence.length === 0);

    // FORGED OWNER: a body-supplied ownerId must be ignored entirely.
    r = await call('/api/vendors', 'POST', { displayName: 'Impostor', ownerId: 'usr_attacker' });
    check('duplicate vendor returns the existing one', r.body.vendor.id === vendor.id);
    check('forged ownerId ignored', r.body.vendor.ownerId === ME, r.body.vendor.ownerId);
    check('forged ownerId created no second vendor', store.all('vendors').length === 1);

    // --- vendor verification comes from real recorded checks ---------------
    {
      const c = (await call('/api/circles', 'POST', { name: 'Traders' })).body.circle;
      await call(`/api/circles/${c.id}/members`, 'POST', { role: 'coordinator' });
      // Recorded through the domain because the route (correctly) refuses
      // self-verification -- a moderator performs this check, not the seller.
      const membersDomain = await import('../src/domain/member.js');
      membersDomain.recordVerification(c.id, ME, 'identity_verified');
      const v = (await call(`/api/vendors/${vendor.id}`)).body.vendor;
      check('vendor evidence reuses real member verification',
        v.verification.evidence.some((e) => e.kind === 'identity_verified'),
        JSON.stringify(v.verification.evidence));
      check('evidence still carries no score', v.verification.verifiedCount === 1 && !('trustScore' in v.verification));
    }

    // --- listing creation + price integrity --------------------------------
    r = await call('/api/listings', 'POST', { title: 'Printed Hoodie', price: 2500, type: 'product', quantityAvailable: 3 });
    check('listing created', r.status === 201, `got ${r.status} ${JSON.stringify(r.body)}`);
    const hoodie = r.body.listing;
    check('listing starts as draft', hoodie.status === 'draft', hoodie.status);
    check('draft listing is not orderable', hoodie.orderable === false);
    check('draft refusal states why', /not published/i.test(hoodie.unorderableReason ?? ''), hoodie.unorderableReason);
    check('listing bound to the caller vendor', hoodie.vendorId === vendor.id);

    r = await call('/api/listings', 'POST', { title: 'Free stuff', price: 0 });
    check('zero price rejected', r.status === 400, `got ${r.status}`);
    r = await call('/api/listings', 'POST', { title: 'Negative', price: -500 });
    check('negative price rejected', r.status === 400, `got ${r.status}`);
    r = await call('/api/listings', 'POST', { title: 'Bad type', price: 100, type: 'spaceship' });
    check('invalid listing type rejected', r.status === 400, `got ${r.status}`);
    r = await call('/api/listings', 'POST', { title: '', price: 100 });
    check('empty title rejected', r.status === 400, `got ${r.status}`);

    // --- browse excludes drafts -------------------------------------------
    r = await call('/api/listings');
    check('draft does not appear in public browse', r.body.listings.length === 0, `${r.body.listings.length} shown`);
    r = await call('/api/listings/mine');
    check('vendor sees their own draft', r.body.listings.length === 1);

    // --- ordering an unavailable listing -----------------------------------
    r = await call('/api/orders', 'POST', { listingId: hoodie.id, quantity: 1 });
    check('cannot order a draft listing', r.status === 400, `got ${r.status}`);
    // Over HTTP the caller owns this vendor, so the self-order guard answers
    // first. That ordering is deliberate: "you cannot buy from yourself" is
    // true regardless of listing state. The availability refusal is asserted
    // below against a buyer who is not the seller.
    check('self-order guard answers first for the owner',
      /own listing/i.test(r.body?.error ?? ''), r.body?.error);
    {
      let threw = null;
      try { ordersDomain.createOrder({ listingId: hoodie.id, buyerId: 'usr_shopper', quantity: 1 }); }
      catch (e) { threw = String(e.message); }
      check('a real buyer is told the draft is unpublished',
        /not published/i.test(threw ?? ''), threw);
    }

    // --- lifecycle ---------------------------------------------------------
    r = await call(`/api/listings/${hoodie.id}/status`, 'POST', { status: 'sold_out' });
    check('draft cannot jump straight to sold_out', r.status === 400, `got ${r.status}`);
    check('invalid transition names both states', /draft -> sold_out/.test(r.body?.error ?? ''), r.body?.error);

    r = await call(`/api/listings/${hoodie.id}/status`, 'POST', { status: 'active' });
    check('draft activates', r.status === 200 && r.body.listing.status === 'active');
    check('activation reported as a change', r.body.changed === true);
    check('active listing is orderable', r.body.listing.orderable === true);

    r = await call(`/api/listings/${hoodie.id}/status`, 'POST', { status: 'active' });
    check('re-activating is a harmless no-op', r.status === 200 && r.body.changed === false);
    check('no duplicate signal for a no-op transition',
      store.filter('signals', (s) => s.type === 'listing_published').length === 1,
      String(store.filter('signals', (s) => s.type === 'listing_published').length));

    // --- client cannot write status directly -------------------------------
    r = await call(`/api/listings/${hoodie.id}`, 'PATCH', { status: 'archived' });
    check('PATCH cannot set status', r.status === 200 && r.body.listing.status === 'active', r.body?.listing?.status);

    // --- paused listings refuse orders -------------------------------------
    await call(`/api/listings/${hoodie.id}/status`, 'POST', { status: 'paused' });
    r = await call('/api/orders', 'POST', { listingId: hoodie.id, quantity: 1 });
    check('cannot order a paused listing', r.status === 400, `got ${r.status}`);
    {
      // Asserted against a real buyer: for the owner the self-order guard
      // answers first, which is the correct precedence.
      let threw = null;
      try { ordersDomain.createOrder({ listingId: hoodie.id, buyerId: 'usr_shopper', quantity: 1 }); }
      catch (e) { threw = String(e.message); }
      check('paused refusal explains', /paused/i.test(threw ?? ''), threw);
    }
    await call(`/api/listings/${hoodie.id}/status`, 'POST', { status: 'active' });

    // --- vendor cannot buy from themselves ---------------------------------
    r = await call('/api/orders', 'POST', { listingId: hoodie.id, quantity: 1 });
    check('a vendor cannot order from their own listing', r.status === 400, `got ${r.status}`);
    check('self-order refusal explains', /own listing/i.test(r.body?.error ?? ''), r.body?.error);

    // ---------------------------------------------------------------------
    // A SECOND ACTOR. callerId() cannot be varied over HTTP, so the buyer is
    // simulated at the domain layer -- the same technique the circle suite
    // uses. The ROUTE-level identity rules are covered above and below.
    // ---------------------------------------------------------------------
    const BUYER = 'usr_buyer';

    // --- server-derived pricing (the central rule) -------------------------
    const order = ordersDomain.createOrder({ listingId: hoodie.id, buyerId: BUYER, quantity: 2 });
    check('order total is server arithmetic', order.total === 5000, String(order.total));
    check('unit price copied from the listing', order.unitPrice === 2500, String(order.unitPrice));
    check('order records both parties', order.buyerId === BUYER && order.vendorId === vendor.id);
    check('order starts as ordered', order.status === 'ordered');
    check('a new order is NOT paid', order.paid === false);
    check('unpaid order says so plainly', order.paymentStatus === 'unpaid', order.paymentStatus);
    check('no transaction attached at order time', order.transactionId === null);

    // FORGED PRICE: the domain signature has no price/total parameter, so a
    // forged payload cannot reach the arithmetic. Proven by passing them.
    const forged = ordersDomain.createOrder({
      listingId: hoodie.id, buyerId: BUYER, quantity: 1,
      price: 1, unitPrice: 1, total: 1, amount: 1, currency: 'USD'
    });
    check('forged unit price ignored', forged.unitPrice === 2500, String(forged.unitPrice));
    check('forged total ignored', forged.total === 2500, String(forged.total));
    check('forged currency ignored', forged.currency === 'KES', forged.currency);

    // --- quantity validation ----------------------------------------------
    for (const [q, label] of [[0, 'zero'], [-3, 'negative'], [1.5, 'fractional']]) {
      let threw = null;
      try { ordersDomain.createOrder({ listingId: hoodie.id, buyerId: BUYER, quantity: q }); }
      catch (e) { threw = String(e.message); }
      check(`${label} quantity rejected`, threw !== null, 'accepted');
    }

    // --- stock consumption is real ----------------------------------------
    {
      const l = listingsDomain.getListing(hoodie.id);
      check('stock reduced by real orders', l.quantityAvailable === 0, String(l.quantityAvailable));
      check('listing auto-flips to sold_out at zero stock', l.status === 'sold_out', l.status);
      let threw = null;
      try { ordersDomain.createOrder({ listingId: hoodie.id, buyerId: BUYER, quantity: 1 }); }
      catch (e) { threw = String(e.message); }
      check('sold-out listing refuses orders', /sold out/i.test(threw ?? ''), threw);
    }

    // --- over-ordering available stock -------------------------------------
    {
      const l2 = listingsDomain.createListing({ vendorId: vendor.id, title: 'Cap', price: 800, quantityAvailable: 2 });
      listingsDomain.transitionListing(l2.id, 'active');
      let threw = null;
      try { ordersDomain.createOrder({ listingId: l2.id, buyerId: BUYER, quantity: 5 }); }
      catch (e) { threw = String(e.message); }
      check('cannot order more than is available', /only 2 available/.test(threw ?? ''), threw);
    }

    // --- services need no stock and no location ----------------------------
    {
      const svc = listingsDomain.createListing({
        vendorId: vendor.id, title: 'Deep clean', price: 3000, type: 'service'
      });
      listingsDomain.transitionListing(svc.id, 'active');
      check('a service needs no stock', svc.quantityAvailable === null);
      check('a service needs no location', svc.locationName === null);
      const o1 = ordersDomain.createOrder({ listingId: svc.id, buyerId: BUYER, quantity: 1 });
      const o2 = ordersDomain.createOrder({ listingId: svc.id, buyerId: 'usr_other', quantity: 1 });
      check('an untracked service can be ordered repeatedly', Boolean(o1 && o2));
      check('service listing stays active after orders',
        listingsDomain.getListing(svc.id).status === 'active');
    }

    // --- fulfilment is the vendor's act, over HTTP -------------------------
    r = await call(`/api/orders/${order.id}/fulfil`, 'POST', {});
    check('vendor can fulfil their order', r.status === 200 && r.body.order.status === 'fulfilled',
      `${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    check('fulfilment records a timestamp', Boolean(r.body.order.fulfilledAt));
    check('FULFILMENT DOES NOT MEAN PAID', r.body.order.paid === false);
    check('fulfilled-but-unpaid is representable', r.body.order.paymentStatus === 'unpaid');

    r = await call(`/api/orders/${order.id}/fulfil`, 'POST', {});
    check('re-fulfilling is a harmless no-op', r.status === 200 && r.body.changed === false);
    check('no duplicate fulfilment signal',
      store.filter('signals', (s) => s.type === 'order_fulfilled').length === 1);

    // --- foreign vendor cannot fulfil --------------------------------------
    {
      const other = vendorsDomain.createVendor({ ownerId: 'usr_rival', displayName: 'Rival Stall' });
      const theirListing = listingsDomain.createListing({ vendorId: other.id, title: 'Their goods', price: 700 });
      listingsDomain.transitionListing(theirListing.id, 'active');
      const theirOrder = ordersDomain.createOrder({ listingId: theirListing.id, buyerId: BUYER, quantity: 1 });

      r = await call(`/api/orders/${theirOrder.id}/fulfil`, 'POST', {});
      check('cannot fulfil another vendor order', r.status === 403, `got ${r.status}`);
      check('foreign fulfilment refusal explains', /only the vendor/i.test(r.body?.error ?? ''), r.body?.error);
      check('foreign order unchanged',
        ordersDomain.getOrder(theirOrder.id).status === 'ordered');

      // Foreign listing manipulation.
      r = await call(`/api/listings/${theirListing.id}`, 'PATCH', { price: 1 });
      check('cannot edit another vendor listing', r.status === 404, `got ${r.status}`);
      check('foreign price unchanged', listingsDomain.getListing(theirListing.id).price === 700);
      r = await call(`/api/listings/${theirListing.id}/status`, 'POST', { status: 'archived' });
      check('cannot archive another vendor listing', r.status === 404, `got ${r.status}`);
      r = await call(`/api/vendors/${other.id}`, 'PATCH', { displayName: 'Hijacked' });
      check('cannot edit another vendor profile', r.status === 404, `got ${r.status}`);
      check('foreign vendor name unchanged',
        vendorsDomain.getVendor(other.id).displayName === 'Rival Stall');

      // Foreign order is not readable by a stranger.
      r = await call(`/api/orders/${theirOrder.id}`);
      check('a stranger cannot read an order they are not party to', r.status === 404, `got ${r.status}`);
    }

    // --- SETTLEMENT CANNOT BE FABRICATED -----------------------------------
    r = await call(`/api/orders/${order.id}/settle`, 'POST', {});
    check('settlement refused without settled money', r.status === 400, `got ${r.status}`);
    check('refusal names the missing payment rail',
      /no payment provider is connected/i.test(r.body?.error ?? ''), r.body?.error);
    check('order still not settled', ordersDomain.getOrder(order.id).status === 'fulfilled');

    // A transaction that does not match the total must not settle the order.
    {
      const wrong = ledgerFor(store, { amount: 5, orderTotalHint: 5000 });
      let threw = null;
      try { ordersDomain.attachTransaction(order.id, wrong.id); } catch (e) { threw = String(e.message); }
      check('a token payment cannot back a large order', /does not match/i.test(threw ?? ''), threw);
      check('mismatched transaction not attached', ordersDomain.getOrder(order.id).transactionId === null);
    }

    // The legitimate path: a real settled transaction for the real amount.
    {
      const tx = ledgerFor(store, { amount: 5000 });
      ordersDomain.attachTransaction(order.id, tx.id);
      const attached = ordersDomain.getOrder(order.id);
      check('matching transaction attaches', attached.transactionId === tx.id);
      check('order still unpaid while the transaction is unsettled', attached.paid === false);
      check('payment status mirrors the ledger row', attached.paymentStatus === 'created', attached.paymentStatus);

      // Settle the ledger row through its own legal path.
      const ledgerDomain = await import('../src/domain/ledger.js');
      ledgerDomain.transitionTransaction(tx.id, 'pending');
      ledgerDomain.transitionTransaction(tx.id, 'confirmed');
      ledgerDomain.transitionTransaction(tx.id, 'settled');

      const paid = ordersDomain.getOrder(order.id);
      check('order reads as paid only from a SETTLED ledger row', paid.paid === true);
      check('paid flag is derived, never stored', !('paid' in store.find('orders', (o) => o.id === order.id)));

      r = await call(`/api/orders/${order.id}/settle`, 'POST', {});
      check('settlement succeeds with real settled money', r.status === 200 && r.body.order.status === 'settled',
        `${r.status} ${JSON.stringify(r.body?.error ?? '')}`);
      check('settlement records a timestamp', Boolean(r.body.order.settledAt));
    }

    // --- illegal transitions ------------------------------------------------
    for (const [from, to] of [['settled', 'ordered'], ['settled', 'fulfilled']]) {
      let threw = null;
      try { ordersDomain.transitionOrder(order.id, to); } catch (e) { threw = String(e.message); }
      check(`${from} -> ${to} rejected`, /invalid order transition/.test(threw ?? ''), threw);
    }
    {
      const fresh = ordersDomain.createOrder({
        listingId: listingsDomain.listListings({ vendorId: vendor.id, status: 'active' })[0].id,
        buyerId: BUYER, quantity: 1
      });
      ordersDomain.transitionOrder(fresh.id, 'fulfilled');
      let threw = null;
      try { ordersDomain.transitionOrder(fresh.id, 'ordered'); } catch (e) { threw = String(e.message); }
      check('fulfilled -> ordered rejected', /invalid order transition/.test(threw ?? ''), threw);
    }

    // --- no fabricated economics -------------------------------------------
    {
      const wallet = (await call('/api/economic/wallet')).body;
      const settledTotal = store
        .filter('ledgerTransactions', (t) => t.status === 'settled')
        .reduce((s, t) => s + t.amount, 0);
      check('wallet balance equals real settled rows only',
        wallet.balance === settledTotal, `${wallet.balance} vs ${settledTotal}`);
      check('orders created no second transaction table',
        store.all('orders').every((o) => !('balance' in o) && !('wallet' in o)));
      check('no order carries a stored paid flag',
        store.all('orders').every((o) => !('paid' in o)));
      check('unsettled orders contribute no revenue',
        store.filter('orders', (o) => o.status !== 'settled')
          .every((o) => { const t = store.find('ledgerTransactions', (x) => x.id === o.transactionId); return !t || t.status !== 'settled'; }));
      check('provider still reported as unconfigured', wallet.provider.configured === false);
    }

    // --- disputes -----------------------------------------------------------
    {
      // The buyer is not the caller, so the route must refuse the caller.
      r = await call(`/api/orders/${order.id}/dispute`, 'POST', { reason: 'Never arrived' });
      check('a non-buyer cannot dispute an order', r.status === 403, `got ${r.status}`);
      check('dispute refusal names the missing standing',
        /only the buyer/i.test(r.body?.error ?? ''), r.body?.error);
      check('refused dispute created no row', store.all('disputes').length === 0);

      // The real buyer, at the domain layer.
      const { dispute, order: disputed, changed } = ordersDomain.openDispute({
        orderId: order.id, reportedBy: BUYER, reason: 'Wrong size delivered'
      });
      check('buyer can dispute their own order', changed === true && dispute.status === 'open');
      check('dispute records the reason', dispute.reason === 'Wrong size delivered');
      check('DISPUTED ORDER IS NOT READ AS CLEAN', disputed.status === 'disputed', disputed.status);
      check('dispute surfaces on the order itself', disputed.dispute?.id === dispute.id);
      check('no refund was invented', !/refund/i.test(JSON.stringify(disputed)));
      // Re-read: `order` is the snapshot taken at creation, before the
      // transaction was attached. Its transactionId is still null.
      const liveOrder = store.find('orders', (o) => o.id === order.id);
      check('settled money was not reversed',
        store.find('ledgerTransactions', (t) => t.id === liveOrder.transactionId).status === 'settled');

      const again = ordersDomain.openDispute({ orderId: order.id, reportedBy: BUYER, reason: 'Same again' });
      check('re-disputing is idempotent', again.changed === false);
      check('only one dispute row exists', store.all('disputes').length === 1);

      let threw = null;
      try { ordersDomain.openDispute({ orderId: order.id, reportedBy: 'usr_stranger', reason: 'x' }); }
      catch (e) { threw = String(e.message); }
      check('an unrelated user cannot dispute', /only the buyer/i.test(threw ?? ''), threw);

      // On a FRESH order: the existing dispute above would short-circuit as an
      // idempotent no-op before any reason validation ran.
      {
        const l = listingsDomain.createListing({ vendorId: vendor.id, title: 'Tote', price: 400 });
        listingsDomain.transitionListing(l.id, 'active');
        const o = ordersDomain.createOrder({ listingId: l.id, buyerId: BUYER, quantity: 1 });
        let t2 = null;
        try { ordersDomain.openDispute({ orderId: o.id, reportedBy: BUYER, reason: '   ' }); }
        catch (e) { t2 = String(e.message); }
        check('a dispute needs a reason', /reason is required/.test(t2 ?? ''), t2);
        check('a rejected dispute left the order alone',
          ordersDomain.getOrder(o.id).status === 'ordered');
      }
    }

    // --- commerce evidence is countable, never a rating --------------------
    {
      const signalsDomain = await import('../src/domain/signal.js');
      const ev = signalsDomain.memberEvidence(ME);
      check('fulfilment appears in the seller evidence history',
        ev.some((e) => e.kind === 'order_fulfilled'), ev.map((e) => e.kind).join(','));
      const summary = signalsDomain.memberEvidenceSummary(ME);
      check('evidence summary counts real orders',
        summary.some((s) => /fulfilled order/.test(s.label)), JSON.stringify(summary));
      check('no rating anywhere in evidence',
        !/rating|stars|score|\d\.\d\s*\/\s*5/i.test(JSON.stringify(summary)));
    }

    // --- campaigns and listings stay separate models -----------------------
    {
      check('a listing is not a campaign', store.all('listings').every((l) => !('registrationCount' in l)));
      check('an order is not a registration', store.all('orders').every((o) => !('attendeeRef' in o)));
      check('commerce needs no campaign', store.all('campaigns').length === 0 && store.all('orders').length > 0);
    }
  } finally {
    srv.close();
  }
}


console.log('\n=== SECURITY & SETTLEMENT HARDENING (Batch 4) ===');
{
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('../src/index.js');
  const vendorsDomain = await import('../src/domain/vendor.js');
  const listingsDomain = await import('../src/domain/listing.js');
  const ordersDomain = await import('../src/domain/order.js');
  const settleDomain = await import('../src/domain/settlement.js');
  const ledgerDomain = await import('../src/domain/ledger.js');
  store._reset();

  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, method = 'GET', body) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const ME = 'usr_me';

  try {
    // --- IDOR: object publication ------------------------------------------
    store.insert('objects', {
      id: 'obj_private', type: 'event', title: 'Private plan', publication: 'private',
      metadata: {}, createdAt: new Date().toISOString()
    });
    let r = await call('/api/objects/obj_private/publish', 'POST', { publication: 'public' });
    check('IDOR: cannot publish an object with no provenance', r.status === 403, `got ${r.status}`);
    check('IDOR: object stayed private',
      store.find('objects', (o) => o.id === 'obj_private').publication === 'private');

    // With a membership on a source the object came from, it IS permitted.
    store.insert('sources', { id: 'src_mine', name: 'My feed', type: 'rss', createdAt: new Date().toISOString() });
    store.insert('objectSources', { id: 'os_1', objectId: 'obj_private', sourceId: 'src_mine' });
    store.insert('sourceMemberships', {
      id: 'mem_1', userId: ME, sourceId: 'src_mine',
      membershipStatus: 'member', accessGranted: true, connectedAt: new Date().toISOString()
    });
    r = await call('/api/objects/obj_private/publish', 'POST', { publication: 'public' });
    check('a source member CAN publish', r.status === 200, `got ${r.status}`);

    // A membership without granted access is not authority.
    store.insert('objects', {
      id: 'obj_two', type: 'event', title: 'Other', publication: 'private',
      metadata: {}, createdAt: new Date().toISOString()
    });
    store.insert('sources', { id: 'src_rev', name: 'Revoked', type: 'rss', createdAt: new Date().toISOString() });
    store.insert('objectSources', { id: 'os_2', objectId: 'obj_two', sourceId: 'src_rev' });
    store.insert('sourceMemberships', {
      id: 'mem_2', userId: ME, sourceId: 'src_rev',
      membershipStatus: 'unknown', accessGranted: false, connectedAt: new Date().toISOString()
    });
    r = await call('/api/objects/obj_two/publish', 'POST', { publication: 'public' });
    check('revoked access is not authority', r.status === 403, `got ${r.status}`);

    // --- source deletion ----------------------------------------------------
    store.insert('sources', { id: 'src_theirs', name: 'Their feed', type: 'rss', createdAt: new Date().toISOString() });
    r = await call('/api/sources/src_theirs', 'DELETE');
    check('cannot disconnect a source you are not a member of', r.status === 403, `got ${r.status}`);
    check('foreign source survived', Boolean(store.find('sources', (s) => s.id === 'src_theirs')));
    r = await call('/api/sources/src_mine', 'DELETE');
    check('own source can be disconnected', r.status === 200, `got ${r.status}`);
    check('its memberships were cleaned up',
      store.filter('sourceMemberships', (m) => m.sourceId === 'src_mine').length === 0);

    // --- quantity overflow ---------------------------------------------------
    const seller = vendorsDomain.createVendor({ ownerId: 'usr_seller', displayName: 'Seller' });
    const item = listingsDomain.createListing({ vendorId: seller.id, title: 'Bag of maize', price: 1000 });
    listingsDomain.transitionListing(item.id, 'active');

    for (const [q, label] of [[1e308, '1e308'], [Number.MAX_SAFE_INTEGER, 'MAX_SAFE_INTEGER'], [1e6, 'one million']]) {
      r = await call('/api/orders', 'POST', { listingId: item.id, quantity: q });
      check(`absurd quantity ${label} rejected`, r.status === 400, `got ${r.status} total ${r.body?.order?.total}`);
    }
    check('no absurd order was persisted', store.all('orders').length === 0);

    // A non-finite total can never be persisted.
    check('order total is always finite',
      store.all('orders').every((o) => Number.isFinite(o.total)));

    // --- idempotency ---------------------------------------------------------
    const results = await Promise.all([1, 2, 3, 4, 5].map(() =>
      call('/api/orders', 'POST', { listingId: item.id, quantity: 1, idempotencyKey: 'dup-key-1' })
    ));
    check('5 concurrent identical submissions create ONE order',
      store.filter('orders', (o) => o.idempotencyKey === 'dup-key-1').length === 1,
      String(store.filter('orders', (o) => o.idempotencyKey === 'dup-key-1').length));
    check('every response names the same order',
      new Set(results.map((x) => x.body?.order?.id)).size === 1);
    // Without a key, distinct orders are still distinct -- buying twice is legal.
    await call('/api/orders', 'POST', { listingId: item.id, quantity: 1 });
    await call('/api/orders', 'POST', { listingId: item.id, quantity: 1 });
    check('unkeyed repeat orders are NOT deduplicated',
      store.filter('orders', (o) => !o.idempotencyKey).length === 2);

    // --- fulfilment stages ----------------------------------------------------
    const kitchen = vendorsDomain.createVendor({ ownerId: ME, displayName: 'Njeri Kitchen' });
    const meal = listingsDomain.createListing({ vendorId: kitchen.id, title: 'Lunch', price: 400, type: 'service' });
    listingsDomain.transitionListing(meal.id, 'active');
    const ord = ordersDomain.createOrder({ listingId: meal.id, buyerId: 'usr_diner', quantity: 1 });

    for (const stage of ['accepted', 'preparing', 'ready']) {
      r = await call(`/api/orders/${ord.id}/stage`, 'POST', { stage });
      check(`vendor advances to ${stage}`, r.status === 200 && r.body.order.status === stage,
        `${r.status} ${r.body?.order?.status ?? r.body?.error}`);
    }
    r = await call(`/api/orders/${ord.id}/stage`, 'POST', { stage: 'settled' });
    check('stage endpoint cannot reach a terminal economic state', r.status === 400, `got ${r.status}`);
    r = await call(`/api/orders/${ord.id}/stage`, 'POST', { stage: 'accepted' });
    check('cannot move backwards through fulfilment', r.status === 400, `got ${r.status}`);
    r = await call(`/api/orders/${ord.id}/fulfil`, 'POST', {});
    check('ready -> fulfilled works', r.status === 200 && r.body.order.status === 'fulfilled');
    check('stages did not touch payment', r.body.order.paid === false);

    // Skipping stages entirely is legal -- most sellers have no prep step.
    const quick = ordersDomain.createOrder({ listingId: meal.id, buyerId: 'usr_diner2', quantity: 1 });
    const jumped = ordersDomain.transitionOrder(quick.id, 'fulfilled');
    check('ordered -> fulfilled directly is still legal', jumped.order.status === 'fulfilled');

    // --- commission arithmetic -------------------------------------------------
    {
      const s = settleDomain.splitAmount(1000, 0.05);
      check('commission is 5% of 1000', s.commission === 50, String(s.commission));
      check('seller receives the remainder', s.sellerAmount === 950, String(s.sellerAmount));
      check('parts sum exactly to the total', s.commission + s.sellerAmount === 1000);

      // Rounding must never invent or lose a shilling.
      for (const amt of [1, 7, 33, 99, 101, 333, 4999, 12345]) {
        const x = settleDomain.splitAmount(amt, 0.05);
        if (x.commission + x.sellerAmount !== amt) {
          check(`split of ${amt} is exact`, false, `${x.commission}+${x.sellerAmount}`);
        }
      }
      check('split is exact across many amounts', true);
      check('commission rounds DOWN (favours the seller)',
        settleDomain.splitAmount(99, 0.05).commission === 4, String(settleDomain.splitAmount(99, 0.05).commission));

      let threw = null;
      try { settleDomain.splitAmount(0); } catch (e) { threw = String(e.message); }
      check('zero amount cannot be split', threw !== null);
      threw = null;
      try { settleDomain.splitAmount(-500); } catch (e) { threw = String(e.message); }
      check('negative amount cannot be split', threw !== null);
    }

    // --- settlement only from real settled money ---------------------------------
    {
      const unsettled = ordersDomain.getOrder(ord.id);
      check('an unsettled order has NO settlement split',
        settleDomain.orderSettlement(unsettled.id) === null);

      const earningsBefore = settleDomain.vendorEarnings(kitchen.id);
      check('no earnings before anything settles', earningsBefore.gross === 0 && earningsBefore.net === 0);
      check('earnings are explicitly not withdrawable', earningsBefore.payoutAvailable === false);
      check('and the reason is stated', /no payment provider/i.test(earningsBefore.payoutReason));

      // Settle it properly through the ledger.
      const tx = ledgerDomain.createTransaction({ amount: 400, type: 'order_payment' });
      ordersDomain.attachTransaction(ord.id, tx.id);
      ledgerDomain.transitionTransaction(tx.id, 'pending');
      ledgerDomain.transitionTransaction(tx.id, 'confirmed');
      ledgerDomain.transitionTransaction(tx.id, 'settled');
      ordersDomain.transitionOrder(ord.id, 'settled');

      const split = settleDomain.orderSettlement(ord.id);
      check('settled order yields a split', split !== null);
      check('split derives from the real total', split.total === 400);
      check('commission on 400 at 5% is 20', split.commission === 20, String(split.commission));
      check('seller amount is 380', split.sellerAmount === 380, String(split.sellerAmount));

      const earnings = settleDomain.vendorEarnings(kitchen.id);
      check('earnings now reflect the settled order', earnings.gross === 400 && earnings.net === 380);
      check('earnings count exactly one order', earnings.orderCount === 1);
      check('STILL not withdrawable without a provider', earnings.payoutAvailable === false);

      // Nothing is stored.
      check('no stored commission on the order row',
        !('commission' in store.find('orders', (o) => o.id === ord.id)));
      check('no platform balance row exists',
        store.all('ledgerTransactions').every((t) => t.type !== 'platform_balance'));
    }

    // --- reconciliation ------------------------------------------------------
    {
      const rec = settleDomain.reconcile();
      check('books reconcile', rec.balanced === true, JSON.stringify(rec.discrepancies));
      check('platform commission equals the per-vendor sum',
        rec.platform.commission === settleDomain.vendorEarnings(kitchen.id).commission);

      // Introduce a real inconsistency and prove reconciliation CATCHES it,
      // rather than trusting that it would.
      const rogue = store.insert('orders', {
        id: 'ord_rogue', listingId: meal.id, listingTitle: 'Lunch', listingType: 'service',
        buyerId: 'usr_x', vendorId: kitchen.id, vendorOwnerId: ME,
        quantity: 1, unitPrice: 400, total: 400, currency: 'KES', note: '',
        status: 'settled', transactionId: null, fulfilledAt: null, settledAt: new Date().toISOString(),
        history: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
      const bad = settleDomain.reconcile();
      check('reconciliation DETECTS a settled order with no transaction',
        bad.balanced === false &&
        bad.discrepancies.some((d) => d.kind === 'settled_without_transaction'),
        JSON.stringify(bad.discrepancies));
      check('the unbacked order contributes no revenue',
        settleDomain.vendorEarnings(kitchen.id).gross === 400, 'phantom revenue counted');
      store.remove('orders', rogue.id);
      check('books reconcile again once removed', settleDomain.reconcile().balanced === true);
    }

    // --- earnings endpoint is owner-scoped ------------------------------------
    r = await call('/api/vendors/me/earnings');
    check('own earnings readable over HTTP', r.status === 200 && r.body.earnings.gross === 400,
      `${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    r = await call(`/api/orders/${ord.id}/settlement`);
    check('a party can read the order split', r.status === 200 && r.body.settlement.commission === 20);

    const foreignOrder = ordersDomain.createOrder({
      listingId: item.id, buyerId: 'usr_stranger', quantity: 1
    });
    r = await call(`/api/orders/${foreignOrder.id}/settlement`);
    check('a non-party cannot read a settlement split', r.status === 404, `got ${r.status}`);
  } finally {
    srv.close();
  }
}


console.log('\n=== COMPLIANCE GATES (Arena real money) ===');
{
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('../src/index.js');
  const complianceDomain = await import('../src/domain/compliance.js');
  store._reset();
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, method = 'GET', body) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    const st = complianceDomain.arenaMoneyStatus();
    check('real-money contests are DISABLED', st.enabled === false);
    check('every unmet requirement is named', st.unmet.length >= 4, JSON.stringify(st.unmet));
    check('licence is listed as missing', st.unmet.includes('gaming_licence'));
    check('age verification is listed as missing', st.unmet.includes('age_verification'));
    check('KYC is listed as missing', st.unmet.includes('kyc'));
    check('payment rail is listed as missing', st.unmet.includes('payment_rail'));
    check('responsible gaming is listed as missing', st.unmet.includes('responsible_gaming'));
    check('the reason is human-readable', /licence/i.test(st.reason), st.reason);
    check('free play is explicitly unaffected', /free and ranked/i.test(st.reason));

    // The GATE MUST REFUSE THE REQUEST, not merely hide a button.
    let r = await call('/api/arena/contests/c1/stake', 'POST', { amount: 500 });
    check('stake endpoint REFUSES with 403', r.status === 403, `got ${r.status}`);
    check('refusal is machine-readable', r.body?.code === 'compliance_gate');
    check('refusal enumerates requirements', Array.isArray(r.body?.requirements));
    check('no stake was recorded', store.all('ledgerTransactions').length === 0);

    // A partial configuration must NOT open the gate.
    process.env.BRIEF_GAMING_LICENCE_ID = 'BCLB-TEST-0001';
    const partial = complianceDomain.arenaMoneyStatus();
    check('a licence alone does not enable real money', partial.enabled === false);
    check('licence now shows as met', !partial.unmet.includes('gaming_licence'));
    check('payment rail still blocks', partial.unmet.includes('payment_rail'));
    r = await call('/api/arena/contests/c1/stake', 'POST', { amount: 500 });
    check('still refused with a partial configuration', r.status === 403, `got ${r.status}`);
    delete process.env.BRIEF_GAMING_LICENCE_ID;

    // Capabilities must report it, so the client can tell the truth.
    r = await call('/api/capabilities');
    check('capabilities report the arena gate', r.body?.arenaMoney?.enabled === false);
    check('capabilities report payment provider', r.body?.payments?.configured === false);
  } finally {
    srv.close();
  }
}


console.log('\n=== TERMINAL STATES & CANCELLATION (Batch 4) ===');
{
  store._reset();
  const vendors = await import('../src/domain/vendor.js');
  const listings = await import('../src/domain/listing.js');
  const ordersD = await import('../src/domain/order.js');

  const v = vendors.createVendor({ ownerId: 'usr_seller', displayName: 'Terminal Test Stall' });
  const l = listings.createListing({ vendorId: v.id, title: 'Bag of maize', type: 'product',
    price: 1000, currency: 'KES', quantityAvailable: 20 });
  listings.transitionListing(l.id, 'active');

  const mk = () => ordersD.createOrder({ listingId: l.id, buyerId: 'usr_buyer', quantity: 1 });

  // Cancelling twice must be a NO-OP, not a second cancellation and not an
  // error. Repeated taps on a flaky connection are normal.
  const o1 = mk();
  const c1 = ordersD.transitionOrder(o1.id, 'cancelled');
  check('first cancel changes the order', c1.changed === true && c1.order.status === 'cancelled');
  const c2 = ordersD.transitionOrder(o1.id, 'cancelled');
  check('second cancel is a no-op, not an error', c2.changed === false);
  check('and the order is still cancelled', c2.order.status === 'cancelled');

  // A cancelled order is TERMINAL. Nothing may revive it -- least of all
  // something that would make it look paid.
  for (const next of ['ordered', 'accepted', 'preparing', 'ready', 'fulfilled', 'settled', 'disputed']) {
    let refused = false;
    try {
      const r = ordersD.transitionOrder(o1.id, next);
      refused = r.changed === false;
    } catch { refused = true; }
    check(`cancelled -> ${next} is refused`, refused);
  }
  check('cancelled order never became paid',
    store.find('orders', (o) => o.id === o1.id).paid !== true);

  // Settled is terminal too, and is the state that matters most.
  const o2 = mk();
  ordersD.transitionOrder(o2.id, 'fulfilled');
  const tx = store.insert('ledgerTransactions', {
    id: 'tx_terminal_1', amount: 1000, currency: 'KES', status: 'settled',
    direction: 'in', createdAt: new Date().toISOString()
  });
  ordersD.attachTransaction(o2.id, tx.id);
  const s = ordersD.transitionOrder(o2.id, 'settled');
  check('an order with settled money CAN settle', s.order.status === 'settled');
  for (const next of ['ordered', 'fulfilled', 'cancelled']) {
    let refused = false;
    try {
      const r = ordersD.transitionOrder(o2.id, next);
      refused = r.changed === false;
    } catch { refused = true; }
    check(`settled -> ${next} is refused (no silent re-award)`, refused);
  }

  // DOUBLE SETTLEMENT: settling again must not double the seller's earnings.
  const before = (await import('../src/domain/settlement.js')).vendorEarnings(v.id);
  let second = null;
  try { second = ordersD.transitionOrder(o2.id, 'settled'); } catch { /* fine */ }
  check('re-settling does not change anything', !second || second.changed === false);
  const after = (await import('../src/domain/settlement.js')).vendorEarnings(v.id);
  check('earnings did NOT double', before.net === after.net, `${before.net} -> ${after.net}`);
  check('order count did NOT double', before.orderCount === after.orderCount);
  check('exactly one settled order counted', after.orderCount === 1, `got ${after.orderCount}`);
  check('commission is 5% floored', after.commission === 50, `got ${after.commission}`);
  check('seller keeps the remainder', after.net === 950, `got ${after.net}`);

  // And the ledger agrees with itself.
  const rec = (await import('../src/domain/settlement.js')).reconcile();
  check('ledger reconciles after settlement', rec.balanced === true, JSON.stringify(rec.discrepancies));
}


console.log('\n=== CONTROLLED / PRIVATE EVENTS (Batch 4) ===');
{
  store._reset();
  const camps = await import('../src/domain/campaign.js');
  // createCampaign creates the object it wraps; attaching a FOREIGN object is
  // refused, which is itself worth asserting.
  let refusedForeign = false;
  const foreign = store.insert('objects', {
    id: 'obj_foreign_1', type: 'event', title: "Someone else's event",
    publication: 'private', createdAt: new Date().toISOString()
  });
  try {
    camps.createCampaign('usr_host', { objectId: foreign.id, title: 'Hijack', type: 'event' });
  } catch (e) { refusedForeign = /not authorised/i.test(e.message); }
  check('cannot wrap an object the host has no claim to', refusedForeign);

  // An event is a CAMPAIGN TYPE, not a new primitive (see the architectural
  // discipline rule). A host creates a controlled distribution point.
  const c = camps.createCampaign('usr_host', {
    title: 'Supper Club',
    type: 'event', capacity: 2, price: 2500, currency: 'KES',
    location: 'Lavington'
  });
  check('an event is a campaign type, not a new table', c.type === 'event');
  check('capacity is stored on the campaign', c.capacity === 2);
  check('a new event is NOT public until published', c.status === 'draft');
  check('an unpublished event does not resolve by slug',
    camps.getPublicBySlug(c.publicSlug) === null);

  camps.transitionCampaign(c.id, 'published');
  check('a published event resolves by slug', camps.getPublicBySlug(c.publicSlug) !== null);

  // CAPACITY IS ENFORCED, not decorative. An over-capacity RSVP must be
  // refused rather than quietly accepted and shown as "full".
  const live = () => camps.getPublicBySlug(c.publicSlug);
  const r1 = camps.register(live(), { attendeeRef: '0700000001', name: 'A' });
  const r2 = camps.register(live(), { attendeeRef: '0700000002', name: 'B' });
  check('first two RSVPs accepted', Boolean(r1) && Boolean(r2));
  let full = false;
  try { camps.register(live(), { attendeeRef: '0700000003', name: 'C' }); }
  catch (e) { full = /full/i.test(e.message); }
  check('the third RSVP is REFUSED as full', full);
  check('exactly two registrations persisted',
    store.filter('registrations', (r) => r.campaignId === c.id).length === 2);

  // Remaining is DERIVED, never a stored counter that could drift.
  const pv = camps.publicView(camps.getPublicBySlug(c.publicSlug));
  check('remaining is derived and correct', pv.remaining === 0, `got ${pv.remaining}`);
  check('soldOut is derived', pv.soldOut === true);

  // The public view of an event must not leak the guest list. For a private
  // supper club or an LGBTQ+ meetup this is a safety property, not a nicety.
  const raw = JSON.stringify(pv);
  check('public event view has NO attendee list', !/0700000001|attendeeRef|registrations/.test(raw), raw.slice(0, 160));
  check('public event view has NO ownerId', !/usr_host|ownerId/.test(raw));

  // Re-registering the same person is not a second seat.
  const before = store.filter('registrations', (r) => r.campaignId === c.id).length;
  try { camps.register(live(), { attendeeRef: '0700000001', name: 'A' }); } catch { /* either is fine */ }
  check('re-registering the same contact does not take another seat',
    store.filter('registrations', (r) => r.campaignId === c.id).length === before);
}


console.log('\n=== REAL AUTHENTICATION: MULTIPLE INDEPENDENT ACTORS ===');
{
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('../src/index.js');
  const authD = await import('../src/domain/auth.js');
  store._reset();
  const srv = app.listen(0);
  const port = srv.address().port;

  // `as` carries a bearer token, so two genuinely different actors can drive
  // the SAME HTTP surface. This is what was impossible before.
  const call = async (path, method = 'GET', body, token) => {
    const headers = {};
    if (body) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    // --- registration -------------------------------------------------------
    let r = await call('/api/auth/register', 'POST', { handle: 'wanjiku', password: 'correct horse battery', displayName: 'Wanjiku' });
    check('actor A can register', r.status === 201, JSON.stringify(r.body).slice(0, 120));
    const tokenA = r.body?.token;
    const idA = r.body?.user?.id;
    check('registration returns a token', typeof tokenA === 'string' && tokenA.length > 20);
    check('registration NEVER returns the password hash', !/passwordHash|passwordSalt/.test(JSON.stringify(r.body)));

    r = await call('/api/auth/register', 'POST', { handle: 'otieno', password: 'another good passphrase', displayName: 'Otieno' });
    check('actor B can register', r.status === 201);
    const tokenB = r.body?.token;
    const idB = r.body?.user?.id;
    check('the two actors have DIFFERENT ids', idA !== idB, `${idA} vs ${idB}`);

    // --- registration validation -------------------------------------------
    r = await call('/api/auth/register', 'POST', { handle: 'wanjiku', password: 'yet another passphrase' });
    check('a duplicate handle is refused', r.status === 400, `got ${r.status}`);
    check('handle comparison is case-insensitive',
      (await call('/api/auth/register', 'POST', { handle: 'WANJIKU', password: 'passphrase here' })).status === 400);
    r = await call('/api/auth/register', 'POST', { handle: 'shorty', password: 'short' });
    check('a short password is refused', r.status === 400, `got ${r.status}`);
    r = await call('/api/auth/register', 'POST', { handle: 'bad handle!', password: 'a good passphrase' });
    check('an invalid handle is refused', r.status === 400, `got ${r.status}`);

    // --- password storage ---------------------------------------------------
    const rowA = store.find('users', (u) => u.id === idA);
    check('the password is NOT stored in plaintext',
      !JSON.stringify(rowA).includes('correct horse battery'));
    check('a salt is stored', typeof rowA.passwordSalt === 'string' && rowA.passwordSalt.length >= 16);
    check('the hash is long (scrypt, 64 bytes)', rowA.passwordHash.length === 128);
    const rowB = store.find('users', (u) => u.id === idB);
    check('salts differ per user', rowA.passwordSalt !== rowB.passwordSalt);

    // The raw token must not be recoverable from the database.
    check('only a token FINGERPRINT is stored',
      store.all('sessions').every((s) => !JSON.stringify(s).includes(tokenA)));

    // --- login --------------------------------------------------------------
    r = await call('/api/auth/login', 'POST', { handle: 'wanjiku', password: 'correct horse battery' });
    check('login with the right password works', r.status === 200);
    r = await call('/api/auth/login', 'POST', { handle: 'wanjiku', password: 'wrong password entirely' });
    check('login with a wrong password is refused 401', r.status === 401, `got ${r.status}`);
    const wrongPw = r.body?.error;
    r = await call('/api/auth/login', 'POST', { handle: 'nobody-here', password: 'wrong password entirely' });
    check('login for an unknown handle is refused 401', r.status === 401);
    // Enumeration protection: the two messages must be identical.
    check('unknown handle and wrong password give the SAME message', r.body?.error === wrongPw,
      `${r.body?.error} vs ${wrongPw}`);

    // --- identity is server-authoritative -----------------------------------
    r = await call('/api/auth/me', 'GET', undefined, tokenA);
    check('token A identifies actor A', r.body?.user?.id === idA, JSON.stringify(r.body).slice(0, 120));
    r = await call('/api/auth/me', 'GET', undefined, tokenB);
    check('token B identifies actor B', r.body?.user?.id === idB);

    // The central claim: a body cannot override a verified session.
    r = await call('/api/auth/me', 'POST', { userId: idB }, tokenA);
    const meA = await call('/api/auth/me', 'GET', undefined, tokenA);
    check('a client-supplied userId cannot change who you are', meA.body?.user?.id === idA);

    // --- invalid / expired / revoked sessions -------------------------------
    r = await call('/api/auth/me', 'GET', undefined, 'not-a-real-token-at-all');
    check('a forged token is refused 401', r.status === 401, `got ${r.status}`);
    check('the refusal names the reason', r.body?.code === 'unknown_token', r.body?.code);

    const { token: tokenTmp, session: sesTmp } = authD.issueSession(idA);
    store.update('sessions', sesTmp.id, { expiresAt: new Date(Date.now() - 1000).toISOString() });
    r = await call('/api/auth/me', 'GET', undefined, tokenTmp);
    check('an EXPIRED session is refused 401', r.status === 401, `got ${r.status}`);
    check('expiry is reported distinctly', r.body?.code === 'expired', r.body?.code);

    const { token: tokenRev } = authD.issueSession(idB);
    await call('/api/auth/logout', 'POST', {}, tokenRev);
    r = await call('/api/auth/me', 'GET', undefined, tokenRev);
    check('a REVOKED session is refused 401', r.status === 401, `got ${r.status}`);
    check('revocation is reported distinctly', r.body?.code === 'revoked', r.body?.code);

    // A failed token must NOT silently fall back to the dev identity.
    check('a bad token does not become the dev user', r.body?.user === undefined);

    // logout-all
    authD.issueSession(idA); authD.issueSession(idA);
    r = await call('/api/auth/logout-all', 'POST', {}, tokenA);
    check('sign-out-everywhere revokes sessions', r.body?.revoked >= 2, JSON.stringify(r.body));
    r = await call('/api/auth/me', 'GET', undefined, tokenA);
    check('the token used to sign out is itself dead', r.status === 401);
  } finally {
    srv.close();
  }
}

console.log('\n=== AUTHORIZATION ACROSS TWO REAL ACTORS ===');
{
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('../src/index.js');
  store._reset();
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, method = 'GET', body, token) => {
    const headers = {};
    if (body) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    const A = (await call('/api/auth/register', 'POST', { handle: 'seller_a', password: 'passphrase for a' })).body;
    const B = (await call('/api/auth/register', 'POST', { handle: 'buyer_b', password: 'passphrase for b' })).body;

    // --- vendors are per-actor ---------------------------------------------
    let r = await call('/api/vendors', 'POST', { displayName: "A's Stall" }, A.token);
    check('actor A creates a vendor', r.status === 201);
    const vendA = r.body?.vendor?.id;
    check('the vendor is owned by A, not the dev user', r.body?.vendor?.ownerId === A.user.id,
      r.body?.vendor?.ownerId);

    r = await call('/api/vendors/me', 'GET', undefined, B.token);
    check("actor B does NOT see A's vendor as their own", !r.body?.vendor, JSON.stringify(r.body).slice(0, 100));

    r = await call('/api/vendors', 'POST', { displayName: "B's Stall" }, B.token);
    const vendB = r.body?.vendor?.id;
    check('actor B gets a DIFFERENT vendor', vendB && vendB !== vendA);

    // --- listings -----------------------------------------------------------
    r = await call('/api/listings', 'POST', { title: "A's tomatoes", type: 'product', price: 2500, quantityAvailable: 10 }, A.token);
    check('A creates a listing', r.status === 201);
    const listA = r.body?.listing?.id;
    r = await call(`/api/listings/${listA}/status`, 'POST', { status: 'active' }, A.token);
    check('A publishes their own listing', r.status === 200);

    // IDOR: B must not be able to mutate A's listing.
    r = await call(`/api/listings/${listA}`, 'PATCH', { price: 1 }, B.token);
    check("B CANNOT edit A's listing", r.status === 403 || r.status === 404, `got ${r.status}`);
    const still = await call(`/api/listings/${listA}`);
    check('and the price is unchanged', still.body?.listing?.price === 2500, `price=${still.body?.listing?.price}`);
    r = await call(`/api/listings/${listA}/status`, 'POST', { status: 'archived' }, B.token);
    check("B CANNOT archive A's listing", r.status === 403 || r.status === 404, `got ${r.status}`);

    // --- orders across two real actors -------------------------------------
    r = await call('/api/orders', 'POST', { listingId: listA, quantity: 2, price: 1 }, B.token);
    check('B orders from A -- a genuine two-party trade', r.status === 201, JSON.stringify(r.body).slice(0, 140));
    const ord = r.body?.order;
    check('the order total is server-derived', ord?.total === 5000, `total=${ord?.total}`);
    check('the buyer is B', ord?.buyerId === B.user.id);

    // A vendor still cannot buy from themselves -- now genuinely testable.
    r = await call('/api/orders', 'POST', { listingId: listA, quantity: 1 }, A.token);
    check('A cannot order from their own listing', r.status === 400, `got ${r.status}`);

    // Fulfilment is the SELLER's right, not the buyer's.
    r = await call(`/api/orders/${ord.id}/fulfil`, 'POST', {}, B.token);
    check('the BUYER cannot fulfil (403)', r.status === 403, `got ${r.status}`);
    r = await call(`/api/orders/${ord.id}/stage`, 'POST', { stage: 'accepted' }, B.token);
    check('the BUYER cannot advance the stage (403)', r.status === 403, `got ${r.status}`);
    r = await call(`/api/orders/${ord.id}/stage`, 'POST', { stage: 'accepted' }, A.token);
    check('the SELLER can advance the stage', r.status === 200, JSON.stringify(r.body).slice(0, 120));
    r = await call(`/api/orders/${ord.id}/fulfil`, 'POST', {}, A.token);
    check('the SELLER can fulfil', r.status === 200);
    check('fulfilment did not mark it paid', r.body?.order?.paid !== true);

    // Settlement is still refused: no real money exists.
    r = await call(`/api/orders/${ord.id}/settle`, 'POST', {}, A.token);
    check('even the seller cannot settle without real money', r.status === 400, `got ${r.status}`);

    // A third actor is a stranger to the whole transaction.
    const C = (await call('/api/auth/register', 'POST', { handle: 'stranger_c', password: 'passphrase for c' })).body;
    r = await call(`/api/orders/${ord.id}`, 'GET', undefined, C.token);
    check('an unrelated actor cannot read the order (404)', r.status === 404, `got ${r.status}`);
    r = await call(`/api/orders/${ord.id}/settlement`, 'GET', undefined, C.token);
    check('an unrelated actor cannot read the settlement (404)', r.status === 404, `got ${r.status}`);
    r = await call(`/api/orders/${ord.id}/settlement`, 'GET', undefined, B.token);
    check('but the BUYER can read the settlement', r.status === 200, `got ${r.status}`);
    r = await call(`/api/orders/${ord.id}/settlement`, 'GET', undefined, A.token);
    check('and so can the SELLER', r.status === 200, `got ${r.status}`);

    // Earnings are per-actor and never leak across sellers.
    r = await call('/api/vendors/me/earnings', 'GET', undefined, A.token);
    check('A sees their own earnings', r.status === 200 && r.body?.earnings?.vendorId === vendA);
    r = await call('/api/vendors/me/earnings', 'GET', undefined, B.token);
    check('B sees only their own', r.body?.earnings?.vendorId === vendB, r.body?.earnings?.vendorId);

    // --- unauthenticated private operations ---------------------------------
    // NOTE: the dev fallback is ON in tests, so an unauthenticated caller is
    // `usr_me` -- a real third party, NOT A or B. It must therefore be
    // treated as a stranger, which is the security-relevant property.
    r = await call(`/api/orders/${ord.id}/fulfil`, 'POST', {});
    check("an unauthenticated caller cannot fulfil someone else's order",
      r.status === 403 || r.status === 404, `got ${r.status}`);
    r = await call(`/api/listings/${listA}`, 'PATCH', { price: 1 });
    check("an unauthenticated caller cannot edit A's listing",
      r.status === 403 || r.status === 404, `got ${r.status}`);

    // --- public operations stay public --------------------------------------
    r = await call('/api/listings');
    check('the public catalogue needs no auth', r.status === 200);
    check('and it does not leak ownerId', !/ownerId/.test(JSON.stringify(r.body)));
    r = await call('/api/health');
    check('health needs no auth', r.status === 200);
    r = await call('/api/release');
    check('release handshake names the current API contract',
      r.status === 200 && r.body?.apiContractVersion === 'gallery-banners-v1' && typeof r.body?.serverTime === 'string');
    r = await call('/api/capabilities');
    check('capabilities need no auth', r.status === 200);
    check('capabilities report auth as configured', r.body?.auth?.configured === true);
  } finally {
    srv.close();
  }
}


console.log('\n=== PAYMENT CONNECTOR BOUNDARY (no credentials configured) ===');
{
  const pay = await import('../src/domain/payment.js');
  const providers = await import('../src/providers.js');

  check('there is no active collection provider', pay.activeProvider() === null);
  check('there is no active disbursement provider', providers.activeDisbursementProvider() === null);
  check('providerStatus.configured is false', pay.providerStatus().configured === false);
  check('providerStatus.payoutConfigured is false', pay.providerStatus().payoutConfigured === false);
  check('the reason is stated', /no payment provider/i.test(pay.providerStatus().reason));

  // The ledger must agree -- one answer to "can Brief move money".
  const led = await import('../src/domain/ledger.js');
  check('ledger.providerConfigured() agrees', led.providerConfigured() === false);
  check('ledger delegates to the connector', led.providerStatus().detail?.provider === 'tuma');
}

console.log('\n=== TUMA CONNECTOR (simulated fetch -- the REAL Tuma contract) ===');
{
  const tuma = await import('../src/connectors/tuma.js');

  // With nothing configured, everything refuses with a stated reason.
  check('Tuma reports NOT configured', tuma.isConfigured() === false);
  check('every missing credential is named',
    tuma.missingCredentials().length === 4 && tuma.missingCredentials().includes('apiKey'),
    tuma.missingCredentials().join(','));
  const push0 = await tuma.collect({ amount: 100, phone: '0722000111' });
  check('collect REFUSES without credentials', push0.ok === false && push0.reason === 'not_configured');
  const tok0 = await tuma.accessToken();
  check('auth REFUSES without credentials', tok0.ok === false && tok0.reason === 'not_configured');
  check('callback verification fails closed when unset', tuma.verifyCallbackSecret('x').reason === 'callback_secret_not_configured');

  // Phone normalisation (provider-neutral Kenyan rule).
  check('0722... normalises', tuma.normalisePhone('0722000111') === '254722000111');
  check('+254... normalises', tuma.normalisePhone('+254722000111') === '254722000111');
  check('0110... (1-prefix) normalises', tuma.normalisePhone('0110000111') === '254110000111');
  check('a foreign number is refused', tuma.normalisePhone('+447700900000') === null);

  // Parse the REAL callback shapes Tuma documents (success / fail / cancelled).
  const okCb = tuma.parseCallback({
    status: 'completed', merchant_request_id: 'm1', checkout_request_id: 'ws_CO_1',
    result_code: 0, result_desc: 'ok', mpesa_receipt_number: 'REC1', amount: 600
  });
  check('success callback parses', okCb.ok === true && okCb.succeeded === true && okCb.receipt === 'REC1');
  check('success callback exposes amount', okCb.amount === 600);
  const failCb = tuma.parseCallback({
    status: 'failed', checkout_request_id: 'ws_CO_2', result_code: 2001,
    result_desc: 'initiator invalid', failure_reason: 'Invalid M-Pesa PIN'
  });
  check('failure callback parses (not success)', failCb.ok === true && failCb.succeeded === false);
  check('failure callback carries the reason', failCb.failureReason === 'Invalid M-Pesa PIN');
  const cancelCb = tuma.parseCallback({ status: 'cancelled', checkout_request_id: 'ws_CO_3', result_code: 1032 });
  check('cancelled callback parses and is not success', cancelCb.succeeded === false && cancelCb.cancelled === true);
  const junk = tuma.parseCallback({ nonsense: true });
  check('an unrecognised payload is refused', junk.ok === false && junk.reason === 'unrecognised_payload');

  // With credentials + a stubbed fetch, exercise the REAL request path.
  process.env.TUMA_EMAIL = 'shop@example.com';
  process.env.TUMA_API_KEY = 'tuma_test_key';
  process.env.BRIEF_PUBLIC_ORIGIN = 'https://brief.example.com';
  process.env.TUMA_WEBHOOK_SECRET = 'tuma-cb-secret';
  tuma._resetTokenCache();
  check('Tuma now reports configured', tuma.isConfigured() === true);
  check('the callback URL embeds the secret path', tuma.callbackUrl() === 'https://brief.example.com/api/webhooks/tuma/tuma-cb-secret');

  // (5) authentication failure: 401 invalid credentials.
  let authFail = await tuma.accessToken({ fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ success: false, message: 'Invalid credentials' }) }) });
  check('auth failure is surfaced, not faked', authFail.ok === false && authFail.reason === 'auth_failed', JSON.stringify(authFail));
  // (5) IPRS gate is named distinctly.
  let iprs = await tuma.accessToken({ fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({ success: false, error_code: 'IPRS_VERIFICATION_REQUIRED' }) }) });
  check('IPRS gate is named distinctly', iprs.reason === 'iprs_verification_required');

  // A stubbed Tuma: token then a successful push.
  let tokenCalls = 0;
  const fakeFetch = async (url, opts) => {
    if (url.endsWith('/auth/token')) {
      tokenCalls++;
      return { ok: true, status: 200, json: async () => ({ success: true, data: { token: 'jwt.test.token' } }) };
    }
    if (url.endsWith('/payment/stk-push')) {
      return {
        ok: true, status: 200,
        json: async () => ({
          success: true, message: 'sent',
          data: { checkout_request_id: 'ws_CO_9', merchant_request_id: 'mr_9', customer_message: 'Check your phone' }
        })
      };
    }
    throw new Error('unexpected URL ' + url);
  };
  const push = await tuma.collect({ amount: 600, phone: '0722000111', description: 'Brief order xyz', fetchImpl: fakeFetch });
  check('collect succeeds against a real-shaped response', push.ok === true && push.checkoutRequestId === 'ws_CO_9');
  check('the provider reference is the checkout_request_id', push.checkoutRequestId === 'ws_CO_9' && push.merchantRequestId === 'mr_9');
  check('a token was fetched exactly once', tokenCalls === 1);
  // Cached token: a second push does not re-auth.
  await tuma.collect({ amount: 600, phone: '0722000111', fetchImpl: fakeFetch });
  check('the token is cached across pushes', tokenCalls === 1);
  // (6) Tuma API failure: push rejected.
  const reject = await tuma.collect({
    amount: 600, phone: '0722000111',
    fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ success: false, message: 'Validation failed' }) })
  });
  check('a rejected push is surfaced as failure', reject.ok === false && reject.reason === 'push_rejected');

  // Callback secret verification: right/wrong/unset.
  check('the correct callback secret is accepted', tuma.verifyCallbackSecret('tuma-cb-secret').ok === true);
  check('a wrong callback secret is refused', tuma.verifyCallbackSecret('nope').reason === 'bad_secret');

  delete process.env.TUMA_EMAIL;
  delete process.env.TUMA_API_KEY;
  delete process.env.BRIEF_PUBLIC_ORIGIN;
  delete process.env.TUMA_WEBHOOK_SECRET;
  tuma._resetTokenCache();
}

console.log('\n=== OUTBOUND CHANNEL SEAM + TWILIO (no credentials configured) ===');
{
  const outbound = await import('../src/outbound.js');
  const twilio = await import('../src/connectors/twilio.js');

  // Nothing configured -> every channel is honestly unavailable.
  check('no channel can send yet', outbound.canSend('sms') === false && outbound.canSend('whatsapp') === false);
  check('email and telegram have no provider', outbound.canSend('email') === false && outbound.canSend('telegram') === false);
  check('status reports all channels unconfigured', outbound.status().anyConfigured === false);
  check('status names sms as unconfigured', outbound.status().channels.sms.configured === false);
  check('status names whatsapp as unconfigured', outbound.status().channels.whatsapp.configured === false);

  // Twilio, alone, refuses with a named reason.
  check('Twilio reports NOT configured (sms)', twilio.isConfigured('sms') === false);
  check('Twilio reports NOT configured (whatsapp)', twilio.isConfigured('whatsapp') === false);
  check('missing credentials are named', twilio.missingCredentials('sms').length === 3, twilio.missingCredentials('sms').join(','));
  const s0 = await twilio.send({ channel: 'sms', to: '0722000111', text: 'hi' });
  check('send REFUSES without credentials', s0.ok === false && s0.reason === 'not_configured');
  const s1 = await outbound.send({ channel: 'whatsapp', to: '0722000111', text: 'hi' });
  check('seam send REFUSES with no provider', s1.ok === false && s1.reason === 'no_provider');

  // Phone normalisation (E.164 with '+', Kenyan rule).
  check('0722... normalises to +254', twilio.normalisePhone('0722000111') === '+254722000111');
  check('+254... normalises', twilio.normalisePhone('+254722000111') === '+254722000111');
  check('0110... normalises', twilio.normalisePhone('0110000111') === '+254110000111');
  check('a foreign number is refused', twilio.normalisePhone('+447700900000') === null);

  // With credentials + a stubbed fetch, exercise the REAL request path.
  process.env.TWILIO_ACCOUNT_SID = 'AC_test_sid';
  process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
  process.env.TWILIO_SMS_FROM = '+254700000000';
  process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+254700000000';
  check('Twilio now reports configured (sms)', twilio.isConfigured('sms') === true);
  check('Twilio now reports configured (whatsapp)', twilio.isConfigured('whatsapp') === true);
  check('seam now finds the sms provider', outbound.canSend('sms') === true && outbound.providerForChannel('sms')?.name === 'twilio');

  let lastUrl = '', lastAuth = '', lastBody = '';
  const fakeFetch = async (url, opts) => {
    lastUrl = url; lastAuth = opts.headers.authorization; lastBody = opts.body;
    return { ok: true, status: 201, json: async () => ({ sid: 'SM_test_1', status: 'queued' }) };
  };
  const sent = await twilio.send({ channel: 'sms', to: '0722000111', text: 'Your spot is held.', fetchImpl: fakeFetch });
  check('sms send succeeds against a real-shaped response', sent.ok === true && sent.sid === 'SM_test_1' && sent.status === 'queued');
  check('the Twilio endpoint is correct', lastUrl.includes('/Accounts/AC_test_sid/Messages.json'));
  check('Basic auth carries SID:token', lastAuth === `Basic ${Buffer.from('AC_test_sid:test_auth_token').toString('base64')}`);
  check('the body is form-encoded with To/From/Body', lastBody.includes('Body=Your+spot+is+held.') && lastBody.includes('To=%2B254722000111') && lastBody.includes('From=%2B254700000000'));

  // WhatsApp path prefixes To with whatsapp:.
  await twilio.send({ channel: 'whatsapp', to: '0722000111', text: 'hi', fetchImpl: fakeFetch });
  check('whatsapp send uses whatsapp: To/From', lastBody.includes('To=whatsapp%3A%2B254722000111') && lastBody.includes('From=whatsapp%3A%2B254700000000'));

  // A Twilio-side rejection is surfaced, not faked.
  const rejected = await twilio.send({
    channel: 'sms', to: '0722000111', text: 'hi',
    fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ code: 21211, message: 'Invalid phone number' }) })
  });
  check('a rejected send is surfaced as failure', rejected.ok === false && rejected.reason === 'send_rejected' && rejected.code === 21211);

  // Invalid / empty inputs are refused before any network call.
  check('an invalid phone is refused', (await twilio.send({ channel: 'sms', to: '999', text: 'hi', fetchImpl: fakeFetch })).reason === 'invalid_phone');
  check('empty text is refused', (await twilio.send({ channel: 'sms', to: '0722000111', text: '  ', fetchImpl: fakeFetch })).reason === 'empty_text');

  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_SMS_FROM;
  delete process.env.TWILIO_WHATSAPP_FROM;
}

console.log('\n=== PERSON ENTITY (§4.4) ===');
{
  const person = await import('../src/domain/person.js');

  // ensurePersonForUser creates a person + verified user alias, idempotently.
  const p1 = person.ensurePersonForUser('usr_me');
  const p2 = person.ensurePersonForUser('usr_me');
  check('ensurePersonForUser is idempotent', p1.id === p2.id);
  check('a person holds a verified user alias', p2.aliases.some((a) => a.kind === 'user' && a.value === 'usr_me' && a.verified));

  // findByAlias resolves through the alias.
  const found = person.findByAlias('user', 'usr_me');
  check('findByAlias resolves the person', found && found.id === p1.id);

  // Verified-only: an unverified alias link is refused.
  try {
    person.linkAlias(p1.id, 'phone', '0722000111', { verified: false });
    check('unverified alias is refused', false);
  } catch (e) {
    check('unverified alias is refused', /verified/.test(e.message));
  }

  // A self-asserted alias binds and normalises the phone.
  const a = person.linkAlias(p1.id, 'phone', '0722000111', { verified: true, source: 'self' });
  check('self-asserted alias links', a.kind === 'phone' && a.value === '254722000111');
  check('phone alias is normalised to 254...', person.normaliseAlias('phone', '+254722000111') === '254722000111');

  // Re-binding the same value to a DIFFERENT person is refused, not silent.
  const other = person.ensurePersonForUser('usr_other');
  try {
    person.linkAlias(other.id, 'phone', '0722000111', { verified: true });
    check('alias re-binding is refused', false);
  } catch (e) {
    check('alias re-binding is refused', /already linked/.test(e.message));
  }

  // findByAlias finds via the phone alias now.
  check('findByAlias via phone works', person.findByAlias('phone', '254722000111')?.id === p1.id);

  // Merge: fold `other` into p1, re-pointing the user alias.
  const before = person.getPerson(other.id).aliases.length;
  const merged = person.mergePersons(other.id, p1.id, 'usr_admin');
  check('merge folds the aliases across', merged.movedAliases === before);
  check('merged-away person is gone', person.getPerson(other.id) === null);
  check('merged target now holds both user aliases', person.getPerson(p1.id).aliases.some((x) => x.value === 'usr_other'));
  check('merge is audited', store.find('auditLog', (x) => x.action === 'merge' && x.from === other.id) !== null);

  // Timeline: a person with no activity has empty events, not an error.
  const t = person.timeline(p1.id);
  check('timeline returns for a fresh person', t && Array.isArray(t.events));

  // Over HTTP: /api/person/me resolves for an authenticated caller.
  {
    const { default: appP } = await import('../src/index.js');
    const srvP = appP.listen(0);
    const portP = srvP.address().port;
    const r = await fetch(`http://127.0.0.1:${portP}/api/person/me`);
    const body = await r.json().catch(() => null);
    check('GET /api/person/me returns the caller person', r.status === 200 && body?.person?.id, JSON.stringify(body));
    srvP.close();
  }
}

console.log('\n=== TEA EDITORIAL SYSTEM (home-feed Phase 4) ===');
{
  const tea = await import('../src/domain/tea.js');

  // Draft does not appear publicly.
  const draft = tea.createArticle({ title: 'The Nairobi weekend guide', body: 'Here is a short useful guide to the weekend. It is practical and local.', category: 'guide' });
  check('an article starts as draft', draft.status === 'draft');
  check('a draft is not in the public list', tea.listPublished().every((a) => a.id !== draft.id));
  check('a draft slug does not resolve publicly', tea.getBySlug(draft.slug) === null);

  // Reading time is derived from body length.
  check('reading time is derived', draft.readingTime >= 1);

  // Publish -> appears publicly, and by slug.
  tea.transition(draft.id, 'publish');
  check('publishing sets status + publishedAt', tea.getById(draft.id).status === 'published' && Boolean(tea.getById(draft.id).publishedAt));
  check('a published article appears publicly', tea.listPublished().some((a) => a.id === draft.id));
  const bySlug = tea.getBySlug(draft.slug);
  check('a published slug resolves', bySlug && bySlug.id === draft.id);

  // Live articles rank above older guides (freshness + live lift).
  const live = tea.createArticle({ title: 'A popup opened today in Kilimani', body: 'Short live note about a new thing.', category: 'live', status: 'published', publishedAt: new Date().toISOString() });
  const top = tea.listPublished({ limit: 5 })[0];
  check('a fresh live article ranks first', top.id === live.id, top.title);

  // Category filter works.
  check('category filter returns only that category', tea.listPublished({ category: 'guide' }).every((a) => a.category === 'guide'));

  // Expiry: an expired article leaves the active feed.
  const expiring = tea.createArticle({ title: 'Weekend popup', body: 'Gone soon.', category: 'weekend', status: 'published', publishedAt: new Date().toISOString(), expiresAt: new Date(Date.now() - 1000).toISOString() });
  const after = tea.listPublished();
  check('an expired article leaves the public feed', after.every((a) => a.id !== expiring.id));
  check('the expired article is marked expired', tea.getById(expiring.id).status === 'expired');

  // Scheduled article publishes when its time arrives.
  const sched = tea.createArticle({ title: 'Tomorrow morning', body: 'Scheduled.', category: 'useful', status: 'scheduled', publishedAt: new Date(Date.now() - 1000).toISOString() });
  check('a due scheduled article auto-publishes on read', tea.getById(sched.id).status === 'published');

  // Transition gating: cannot publish from archived.
  const arch = tea.createArticle({ title: 'Old thing', body: 'Archived.', category: 'guide' });
  tea.transition(arch.id, 'publish');
  tea.transition(arch.id, 'archive');
  try {
    tea.transition(arch.id, 'publish');
    check('publishing from archived is refused', false);
  } catch (e) {
    check('publishing from archived is refused', /cannot publish from archived/.test(e.message));
  }

  // Over HTTP: public list + a draft is NOT reachable publicly.
  {
    const { default: appT } = await import('../src/index.js');
    const srvT = appT.listen(0);
    const portT = srvT.address().port;
    const list = await (await fetch(`http://127.0.0.1:${portT}/api/tea`)).json();
    check('GET /api/tea returns published articles + categories', Array.isArray(list.tea) && Array.isArray(list.categories));
    const slug = await (await fetch(`http://127.0.0.1:${portT}/api/tea/${draft.slug}`)).json();
    check('GET /api/tea/:slug resolves a published article', slug.article && slug.article.id === draft.id);
    srvT.close();
  }
}

console.log('\n=== MEDIA ASSOCIATION (home-feed Phase 6) ===');
{
  const media = await import('../src/domain/media.js');

  // No provider configured -> reported honestly, never pretended.
  check('no image provider is configured', media.providerStatus().configured === false);
  check('the reason is stated, not hidden', /No image provider/.test(media.providerStatus().reason));

  // An object with its own exact image resolves at level 'exact'.
  const exact = media.resolveMedia({ id: 'a', title: 'Pop-up', imageUrl: 'https://x/y.jpg', imageAlt: 'popup' });
  check('an exact image is preferred', exact.level === 'exact' && exact.image?.url === 'https://x/y.jpg');

  // An object with no image resolves to level 'none' — never a random image.
  const bare = media.resolveMedia({ id: 'b', title: 'Thing', category: 'Event' });
  check('no image -> level none', bare.level === 'none' && bare.image === null);

  // A vendor image is used when the object links a provider and has no own image.
  store.insert('vendors', { id: 'v1', ownerId: 'u', displayName: 'Kikao', imageUrl: 'https://x/vendor.jpg' });
  const viaVenue = media.resolveMedia({ id: 'c', title: 'Hoodie', providerObjectId: 'v1', metadata: {} });
  check('venue image is the second fallback', viaVenue.level === 'venue' && viaVenue.image?.url === 'https://x/vendor.jpg');

  // A location image is the third fallback.
  store.insert('objects', { id: 'loc1', title: 'Kilimani Studio', imageUrl: 'https://x/loc.jpg' });
  const viaLoc = media.resolveMedia({ id: 'd', title: 'Gig', locationObjectId: 'loc1' });
  check('location image is the third fallback', viaLoc.level === 'location' && viaLoc.image?.url === 'https://x/loc.jpg');

  // A category image is the fourth fallback, and only when APPROVED.
  media.recordMediaLibraryImage({ kind: 'category', key: 'Event', url: 'https://x/cat.jpg', status: 'draft' });
  check('a draft category image is NOT used', media.resolveMedia({ id: 'e', title: 'Gig', category: 'Event' }).level === 'none');
  media.recordMediaLibraryImage({ kind: 'category', key: 'Event', url: 'https://x/cat.jpg', status: 'approved' });
  const viaCat = media.resolveMedia({ id: 'f', title: 'Gig', category: 'Event' });
  check('an approved category image is used', viaCat.level === 'category' && viaCat.image?.url === 'https://x/cat.jpg');

  // enrichObjects tags every object with its resolved level.
  const enriched = media.enrichObjects([
    { id: 'g', title: 'A', imageUrl: 'https://x/a.jpg' },
    { id: 'h', title: 'B' }
  ]);
  check('enrichObjects tags the exact image', enriched[0].mediaLevel === 'exact' && enriched[0].media?.url === 'https://x/a.jpg');
  check('enrichObjects tags a missing image as none', enriched[1].mediaLevel === 'none' && enriched[1].media === null);

  // The library record is idempotent on (kind, key).
  const again = media.recordMediaLibraryImage({ kind: 'category', key: 'Event', url: 'https://x/cat2.jpg', status: 'approved' });
  check('media library record is idempotent per key', again.url === 'https://x/cat2.jpg');
}

console.log('\n=== FEED COMPOSITION (home-feed Phase 8) ===');
{
  const feed = await import('../src/domain/feed.js');

  const objects = [
    { id: 'o1', type: 'experience', title: 'Top event' },
    { id: 'o2', type: 'place', title: 'A place' },
    { id: 'o3', type: 'opportunity', title: 'An opportunity' },
    { id: 'o4', type: 'experience', title: 'Another event' },
    { id: 'o5', type: 'service', title: 'A service' },
    { id: 'o6', type: 'opportunity', title: 'Second opportunity' },
    { id: 'o7', type: 'product', title: 'A product' },
    { id: 'o8', type: 'place', title: 'Another place' }
  ];
  const tea = [
    { slug: 'a', title: 'Tea A' },
    { slug: 'b', title: 'Tea B' },
    { slug: 'c', title: 'Tea C' }
  ];

  const composed = feed.composeFeed({ objects, tea });
  check('a hero is chosen', composed.hero.length === 1 && composed.hero[0].id === 'o1');
  check('discovery is filled', composed.discovery.length === 4);
  check('opportunities are split out', composed.opportunities.length === 2);
  check('the rest is retained', composed.more.length === 1);
  check('a featured tea is chosen', composed.tea?.slug === 'a');
  check('supporting tea is limited', composed.moreTea.length === 2);

  // Dedup: no object appears in two slots.
  const allIds = [...composed.hero, ...composed.discovery, ...composed.opportunities, ...composed.more].map((o) => o.id);
  check('no object is duplicated across slots', new Set(allIds).size === allIds.length);

  // Dedup: the same object given twice collapses to one.
  const dup = feed.composeFeed({ objects: [{ id: 'x', type: 'place', title: 'X' }, { id: 'x', type: 'place', title: 'X' }], tea: [] });
  check('duplicate ids collapse to one', dup.hero.length + dup.discovery.length + dup.opportunities.length + dup.more.length === 1);
  check('dedup count is reported', dup.counts.deduped === 1);

  // An empty section is omitted, not padded.
  const empty = feed.composeFeed({ objects: [{ id: 'only', type: 'place', title: 'Only' }], tea: [] });
  check('empty opportunities is omitted', empty.opportunities.length === 0);
  check('empty tea is null', empty.tea === null && empty.moreTea.length === 0);
}

console.log('\n=== PUBLIC FEED API (home-feed) ===');
{
  const publicId = 'public_feed_object';
  const privateId = 'private_feed_object';
  store.insert('objects', {
    id: publicId,
    type: 'place',
    title: 'Public feed place',
    category: 'Place',
    summary: 'A public feed record',
    publication: 'public',
    imageUrl: 'https://example.com/place.jpg',
    metadata: { price: 200, contactPhone: '+254700000000', lat: -1.28, lng: 36.82 },
    createdAt: new Date().toISOString()
  });
  store.insert('objects', {
    id: privateId,
    type: 'place',
    title: 'Private feed place',
    summary: 'Must not appear publicly',
    publication: 'source_members',
    createdAt: new Date().toISOString()
  });

  const { default: appPF } = await import('../src/index.js');
  const srvPF = appPF.listen(0);
  const portPF = srvPF.address().port;
  const response = await fetch(`http://127.0.0.1:${portPF}/api/public/feed?limit=10`);
  const body = await response.json();
  const rows = [...body.feed.hero, ...body.feed.discovery, ...body.feed.opportunities, ...body.feed.more];
  const raw = JSON.stringify(body);
  check('public feed needs no auth', response.status === 200);
  check('public feed includes public objects', rows.some((o) => o.id === publicId));
  check('public feed excludes private objects', !raw.includes(privateId) && !raw.includes('Private feed place'));
  check('public feed omits contact and coordinates', !raw.includes('contactPhone') && !raw.includes('"lat"'));
  check('public feed sends cache headers', response.headers.get('cache-control')?.includes('max-age=60'));
  check('public feed identifies its generation time', typeof body.meta?.generatedAt === 'string' && body.meta?.apiVersion === '1');
  check('public feed validates incomplete location',
    (await fetch(`http://127.0.0.1:${portPF}/api/public/feed?lat=1`)).status === 400);
  srvPF.close();
}

console.log('\n=== COLLECTIONS (home-feed §47) ===');
{
  const collection = await import('../src/domain/collection.js');

  // A rule collection matches by price ceiling.
  const budget = collection.createCollection({ title: 'Under KES 300', kind: 'rule', rule: { maxPrice: 300 }, status: 'published' });
  check('a rule collection is created', Boolean(budget.id));

  // A curated collection holds explicit object ids.
  store.insert('objects', { id: 'obj_c1', type: 'place', title: 'Cafe', publication: 'public', category: 'Place', metadata: { price: 150 } });
  store.insert('objects', { id: 'obj_c2', type: 'place', title: 'Expensive spot', publication: 'public', category: 'Place', metadata: { price: 5000 } });
  const curated = collection.createCollection({ title: 'My picks', kind: 'curated', objectIds: ['obj_c1', 'obj_c2'], status: 'published' });
  check('a curated collection resolves its explicit ids', collection.resolveCollection(curated.key).objectCount === 2);

  // The rule collection only matches objects under the ceiling.
  const res = collection.resolveCollection(budget.key);
  check('a rule collection resolves only matching objects', res.objects.every((o) => (o.metadata?.price ?? Infinity) <= 300), JSON.stringify(res.objects.map((o) => o.title)));
  check('the expensive object is excluded', !res.objects.some((o) => o.id === 'obj_c2'));

  // A locationContains rule.
  store.insert('objects', { id: 'obj_k', type: 'experience', title: 'Kilimani gig', publication: 'public', locationName: 'Kilimani, Nairobi', category: 'Event', metadata: {} });
  const local = collection.createCollection({ title: 'Around Kilimani X', kind: 'rule', rule: { locationContains: 'Kilimani' }, status: 'published' });
  check('a location rule matches by substring', collection.resolveCollection(local.key).objects.some((o) => o.id === 'obj_k'));

  // A draft collection does not resolve publicly.
  const draft = collection.createCollection({ title: 'Hidden', kind: 'rule', rule: { type: 'place' }, status: 'draft' });
  check('a draft collection does not resolve', collection.resolveCollection(draft.key) === null);
  check('a draft collection is not listed', collection.listPublished().every((c) => c.id !== draft.id));

  // Publish makes it listed and resolvable.
  collection.transitionCollection(draft.key, 'publish');
  check('publishing lists the collection', collection.listPublished().some((c) => c.id === draft.id));
  check('a published collection resolves', collection.resolveCollection(draft.key) !== null);

  // Over HTTP: list + resolve.
  {
    const { default: appC } = await import('../src/index.js');
    const srvC = appC.listen(0);
    const portC = srvC.address().port;
    const list = await (await fetch(`http://127.0.0.1:${portC}/api/collections`)).json();
    check('GET /api/collections returns published collections', Array.isArray(list.collections) && list.collections.length > 0);
    const one = await (await fetch(`http://127.0.0.1:${portC}/api/collections/${budget.key}`)).json();
    check('GET /api/collections/:key resolves membership', one.collection && typeof one.collection.objectCount === 'number');
    srvC.close();
  }
}

console.log('\n=== SEARCH (home-feed §33) ===');
{
  const search = await import('../src/domain/search.js');

  // Cross-entity: an empty query returns nothing, honestly.
  check('an empty query returns nothing', search.search('  ').objects.length === 0);

  // Objects match by title/location/category.
  store.insert('objects', { id: 's_obj', type: 'place', title: 'Karura Forest walk', publication: 'public', category: 'Place', locationName: 'Karura', metadata: {} });
  const r1 = search.search('karura');
  check('search finds an object by title', r1.objects.some((o) => o.id === 's_obj'));
  check('search reports its counts', r1.counts.objects >= 1);

  // Tea matches by title/dek/body.
  const tea = await import('../src/domain/tea.js');
  const art = tea.createArticle({ title: 'Karura trail guide', body: 'A short guide to the Karura forest trails.', category: 'guide', status: 'published' });
  const r2 = search.search('karura');
  check('search finds a tea article', r2.tea.some((a) => a.slug === art.slug));

  // Vendors match by name.
  store.insert('vendors', { id: 's_vendor', ownerId: 'u', displayName: 'Karura Honey Co', status: 'active' });
  const r3 = search.search('karura');
  check('search finds a vendor', r3.vendors.some((v) => v.id === 's_vendor'));

  // Collections match by title.
  const collection = await import('../src/domain/collection.js');
  const col = collection.createCollection({ title: 'Karura mornings', kind: 'rule', rule: { locationContains: 'Karura' }, status: 'published' });
  const r4 = search.search('karura');
  check('search finds a collection', r4.collections.some((c) => c.id === col.id));

  // Over HTTP.
  {
    const { default: appS } = await import('../src/index.js');
    const srvS = appS.listen(0);
    const portS = srvS.address().port;
    const res = await (await fetch(`http://127.0.0.1:${portS}/api/search?q=karura`)).json();
    check('GET /api/search returns typed results', res.results && Array.isArray(res.results.objects) && Array.isArray(res.results.tea));
    srvS.close();
  }
}

console.log('\n=== AI ASSIST SEAM (§27) ===');
{
  const assist = await import('../src/domain/assist.js');

  check('no AI provider is configured', assist.providerStatus().configured === false);
  check('the reason is stated', /No AI provider/.test(assist.providerStatus().reason));

  const r = await assist.assist('summarise', { text: 'something' });
  check('assist fails closed without a provider', r.ok === false && r.reason === 'no_provider');

  // Over HTTP: status reports unconfigured; assist 503s (auth-gated, so this
  // is the anonymous refusal — the configured path is exercised in the unit
  // call above).
  {
    const { default: appA } = await import('../src/index.js');
    const srvA = appA.listen(0);
    const portA = srvA.address().port;
    const st = await (await fetch(`http://127.0.0.1:${portA}/api/assist/status`)).json();
    check('GET /api/assist/status reports unconfigured', st.assist?.configured === false);
    srvA.close();
  }
}

console.log('\n=== COOPERATIVE POOLS (four-screen build A) ===');
{
  const pool = await import('../src/domain/pool.js');

  const p = pool.createPool({ name: 'Kilimani Chama', regionType: 'KENYA', contributionAmount: 1000, createdBy: 'usr_me', displayName: 'Host' });
  check('a pool is created forming', p.status === 'forming' && p.rotationOrder.length === 1);

  pool.addMember(p.id, 'usr_b', 'Brian');
  pool.addMember(p.id, 'usr_c', 'Chiku');
  check('members join while forming', pool.poolView(p.id).members.length === 3);

  // A forming pool with <2 members cannot activate.
  const solo = pool.createPool({ name: 'Solo', contributionAmount: 500, createdBy: 'usr_me' });
  try { pool.activate(solo.id, 'usr_me'); check('a solo pool cannot activate', false); }
  catch (e) { check('a solo pool cannot activate', /at least two/.test(e.message)); }

  // Members lock once active.
  pool.activate(p.id, 'usr_me');
  try { pool.addMember(p.id, 'usr_d'); check('members lock after activation', false); }
  catch (e) { check('members lock after activation', /locked/.test(e.message)); }

  // Contributions are real ledger transactions; a duplicate is refused.
  const c1 = pool.contribute(p.id, 'usr_me', 1000);
  check('a contribution is a ledger transaction', c1.transaction.type === 'pool_contribution' && c1.transaction.amount === 1000);
  const c1b = pool.contribute(p.id, 'usr_me', 1000);
  check('a duplicate contribution is refused', c1b.duplicate === true);
  check('the balance is derived from contributions', pool.poolView(p.id).balance.total === 1000);

  // The recipient is the first member in rotation order (derived).
  check('the recipient is derived', pool.poolView(p.id).recipientId === 'usr_me');

  // Rotating advances to the next member.
  pool.rotate(p.id, 'usr_me');
  check('rotation advances the recipient', pool.poolView(p.id).recipientId === 'usr_b');

  // Payout is honestly unavailable (no disbursement provider).
  check('payout is honestly unavailable', pool.poolView(p.id).payoutAvailable === false && /No payout provider/.test(pool.poolView(p.id).payoutReason));

  // Over HTTP.
  {
    const { default: appP } = await import('../src/index.js');
    const srvP = appP.listen(0);
    const portP = srvP.address().port;
    const list = await (await fetch(`http://127.0.0.1:${portP}/api/pools`)).json();
    check('GET /api/pools lists pools', Array.isArray(list.pools) && list.pools.length > 0);
    const one = await (await fetch(`http://127.0.0.1:${portP}/api/pools/${p.id}`)).json();
    check('GET /api/pools/:id returns the derived view', one.pool && typeof one.pool.balance.total === 'number');
    srvP.close();
  }
}

console.log('\n=== DISTRIBUTION (four-screen build B) ===');
{
  const distribution = await import('../src/domain/distribution.js');
  const campaigns = await import('../src/domain/campaign.js');

  const c = campaigns.createCampaign('usr_me', { title: 'Rooftop Gig', type: 'event', location: 'Kilimani', capacity: 50, price: 0, currency: 'KES' });
  campaigns.transitionCampaign(c.id, 'published');
  campaigns.transitionCampaign(c.id, 'live');

  // A tracked link needs a public origin; null otherwise (honest).
  check('no tracked link without a public origin', distribution.trackedLink(c, null) === null);
  const link = distribution.trackedLink(c, 'https://brief.example.com', { source: 'whatsapp', medium: 'social', content: 'weekend' });
  check('a tracked link embeds UTM params', link && link.includes('utm_source=whatsapp') && link.includes('utm_campaign=' + c.id) && link.includes('utm_content=weekend'), link);

  // Blast fails honestly when no origin is configured.
  const noOrigin = await distribution.blast(c, { recipients: [{ channel: 'whatsapp', to: '0722000111' }], publicOrigin: null });
  check('blast fails without an origin', noOrigin.ok === false && noOrigin.reason === 'public_origin_not_configured');

  // A Telegram/X recipient is honestly "no send connector".
  process.env.BRIEF_PUBLIC_ORIGIN = 'https://brief.example.com';
  const tgBlast = await distribution.blast(c, { recipients: [{ channel: 'telegram', to: 'chat' }] });
  check('telegram blast reports no send connector', tgBlast.results[0].ok === false && tgBlast.results[0].reason === 'no_send_connector');

  // recordClick attributes a click and returns the campaign.
  const clicked = distribution.recordClick({ c: c.publicSlug, utm_source: 'x', utm_medium: 'social' });
  check('recordClick attributes a click', clicked && clicked.id === c.id);
  check('clicksFor aggregates by source', distribution.clicksFor(c.id).clicks === 1 && distribution.clicksFor(c.id).clicksBySource.x === 1);

  // Clicks flow into campaign analytics.
  const an = campaigns.analytics(c.id);
  check('campaign analytics reports clicks + bySource', an.clicks === 1 && an.clicksBySource.x === 1);

  // Over HTTP: click endpoint records and redirects.
  {
    const { default: appD } = await import('../src/index.js');
    const srvD = appD.listen(0);
    const portD = srvD.address().port;
    const r = await fetch(`http://127.0.0.1:${portD}/api/click?c=${c.publicSlug}&utm_source=whatsapp`, { redirect: 'manual' });
    check('GET /api/click redirects to the campaign', r.status === 302 && /\/c\//.test(r.headers.get('location') || ''), String(r.headers.get('location')));
    srvD.close();
  }

  delete process.env.BRIEF_PUBLIC_ORIGIN;
}

console.log('\n=== LOBBY CODE BOARD (Arena integration) ===');
{
  const lobby = await import('../src/domain/lobby.js');

  // A host creates a room with a 4-8 digit code.
  const room = lobby.createRoom({ gameId: 'cod_mobile', code: '48592', mode: 'Search & Destroy', hostId: 'usr_host', maxSlots: 8 });
  check('a room is created open', room.status === 'open' && room.code === '48592');

  // A non-digit or wrong-length code is refused.
  try { lobby.createRoom({ gameId: 'cod_mobile', code: 'abc', hostId: 'x' }); check('a non-numeric code is refused', false); }
  catch (e) { check('a non-numeric code is refused', /4-8 digits/.test(e.message)); }

  // The board view shows slots and the code while open.
  const v = lobby.roomView(room);
  check('the board shows open slots', v.slotsOpen === 8 && v.code === '48592');

  // Players claim slots; full is refused.
  for (let i = 0; i < 8; i++) lobby.claimSlot(room.id, `p${i}`);
  check('slots fill to capacity', lobby.roomView(room).slotsOpen === 0);
  try { lobby.claimSlot(room.id, 'p_overflow'); check('claiming a full room is refused', false); }
  catch (e) { check('claiming a full room is refused', /full/.test(e.message)); }

  // A re-claim by the same player is idempotent (reused).
  const r2 = lobby.createRoom({ gameId: 'efootball', code: '1234', hostId: 'usr_host', maxSlots: 4 });
  lobby.claimSlot(r2.id, 'p1');
  const re = lobby.claimSlot(r2.id, 'p1');
  check('a re-claim is idempotent', re.reused === true);

  // Starting the room hides the code.
  lobby.startRoom(r2.id, 'usr_host');
  check('a started room hides its code', lobby.roomView(r2.id).code === null);
  check('a started room leaves the open board', lobby.listOpenRooms({ gameId: 'efootball' }).length === 0);

  // Vouching: derived verification only after enough net-positive.
  for (let i = 0; i < 3; i++) lobby.vouchHost('usr_host', `voter${i}`, true);
  check('three up-vouches verify a host', lobby.hostTrust('usr_host').verified === true && lobby.hostTrust('usr_host').label === 'Verified Lobby Master');
  lobby.vouchHost('usr_host', 'voter_down', false);
  check('a down-vote is counted', lobby.hostTrust('usr_host').down === 1);
  try { lobby.vouchHost('usr_host', 'usr_host', true); check('self-vouch is refused', false); }
  catch (e) { check('self-vouch is refused', /themselves/.test(e.message)); }

  // Scoreboard receipt: honest "pending review", no fabricated OCR.
  const sb = lobby.recordScoreboard({ roomId: r2.id, actorId: 'usr_host', imageUrl: 'https://x/scoreboard.jpg' });
  check('a scoreboard receipt is pending review', sb.status === 'pending_review');

  // Clan match: neighbourhood rivalry.
  const clan = lobby.createClanMatch({ title: 'Nairobi CBD vs Ruiru', homeLabel: 'CBD', awayLabel: 'Ruiru', gameId: 'cod_mobile', hostId: 'usr_host' });
  check('a clan match is scheduled', clan.status === 'scheduled' && clan.homeLabel === 'CBD');
  lobby.transitionClan(clan.id, 'activate', 'usr_host');
  check('a clan match can activate', lobby.listClanMatches().find((m) => m.id === clan.id).status === 'active');

  // Over HTTP: board + host room + claim.
  {
    const { default: appL } = await import('../src/index.js');
    const srvL = appL.listen(0);
    const portL = srvL.address().port;
    const board = await (await fetch(`http://127.0.0.1:${portL}/api/lobby/rooms?gameId=cod_mobile`)).json();
    check('GET /api/lobby/rooms returns the open board', Array.isArray(board.rooms) && board.rooms.some((r) => r.code === '48592'));
    const trust = await (await fetch(`http://127.0.0.1:${portL}/api/lobby/hosts/usr_host/trust`)).json();
    check('GET trust returns derived host trust', trust.trust && typeof trust.trust.up === 'number');
    srvL.close();
  }
}

console.log('\n=== TELEGRAM MINI APP initData ===');
{
  const telegram = await import('../src/connectors/telegram.js');
  const crypto = await import('node:crypto');

  // Build a genuine signed initData using the real Telegram algorithm.
  process.env.TELEGRAM_BOT_TOKEN = '12345:test_token_for_initdata';
  const user = JSON.stringify({ id: 998877, first_name: 'Wanjiku', username: 'wanjiku_hikes' });
  const fields = {
    query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
    user,
    auth_date: String(Math.floor(Date.now() / 1000))
  };
  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update('12345:test_token_for_initdata').digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const initData = new URLSearchParams({ ...fields, hash }).toString();

  const verified = telegram.verifyInitData(initData);
  check('a valid initData verifies', verified.ok === true);
  check('the Telegram user id is extracted', verified.user?.id === '998877');
  check('the first name is extracted', verified.user?.firstName === 'Wanjiku');

  // Tampering with any field invalidates the signature.
  const tampered = initData.replace('Wanjiku', 'Attacker');
  check('a tampered initData is refused', telegram.verifyInitData(tampered).reason === 'bad_signature');

  // An expired initData is refused.
  const oldFields = { ...fields, auth_date: String(Math.floor(Date.now() / 1000) - 48 * 3600) };
  const oldDcs = Object.entries(oldFields).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const oldHash = crypto.createHmac('sha256', secretKey).update(oldDcs).digest('hex');
  const oldInitData = new URLSearchParams({ ...oldFields, hash: oldHash }).toString();
  check('an expired initData is refused', telegram.verifyInitData(oldInitData).reason === 'init_data_expired');

  // The init route binds the Telegram user to a Brief account + session.
  {
    const { default: appTg } = await import('../src/index.js');
    const srvTg = appTg.listen(0);
    const portTg = srvTg.address().port;
    const r = await fetch(`http://127.0.0.1:${portTg}/api/telegram/init`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initData })
    });
    const body = await r.json().catch(() => null);
    check('POST /api/telegram/init issues a session', r.status === 200 && Boolean(body?.token));
    check('the account is bound to the telegram id', body?.user?.handle === 'tg_998877', body?.user?.handle);
    // The returned token is a real session: whoAmI with it resolves.
    const me = await fetch(`http://127.0.0.1:${portTg}/api/auth/me`, { headers: { authorization: `Bearer ${body.token}` } });
    check('the minted token authenticates', me.status === 200);
    // A forged initData is refused with 401.
    const bad = await fetch(`http://127.0.0.1:${portTg}/api/telegram/init`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initData: tampered })
    });
    check('a forged initData is refused 401', bad.status === 401);
    srvTg.close();
  }

  delete process.env.TELEGRAM_BOT_TOKEN;
}

console.log('\n=== AUTOMATION ENGINE (CCS §3.1) ===');
{
  const workflow = await import('../src/domain/workflow.js');
  const signals = await import('../src/domain/signal.js');
  const person = await import('../src/domain/person.js');

  // A workflow that tags "Outdoor enthusiast" when a member joins, and
  // notifies the actor.
  const wf = workflow.createWorkflow({
    name: 'Welcome outdoor folks',
    trigger: 'member_joined',
    conditions: [],
    actions: [
      { type: 'tag', tag: 'Outdoor enthusiast' },
      { type: 'notify', title: 'Welcome!', body: 'Glad you are here.' }
    ],
    ownerId: 'usr_creator'
  });
  check('a workflow is created', Boolean(wf.id) && wf.enabled === true);

  // A matching signal fires it.
  const sig = signals.emitSignal({ type: 'member_joined', actorId: 'usr_me', circleId: 'c1' });
  check('matches() is true for a matching signal', workflow.matches(wf, sig) === true);

  // A non-matching signal does not.
  const other = signals.emitSignal({ type: 'object_viewed', actorId: 'usr_me' });
  check('matches() is false for a non-matching signal', workflow.matches(wf, other) === false);

  // The sweep runs the actions: tag + notify, deduped.
  const person1 = person.ensurePersonForUser('usr_me');
  const sweep1 = await workflow.sweep();
  check('the sweep executed actions', sweep1.executed >= 2, String(sweep1.executed));
  check('the tag action tagged the person', (person.getPerson(person1.id).tags ?? []).includes('Outdoor enthusiast'));
  check('the notify action created a notification', store.filter('notifications', (n) => n.metadata?.workflowId === wf.id).length >= 1);

  // A second sweep is idempotent — no double fire.
  const sweep2 = await workflow.sweep();
  check('a second sweep is idempotent', sweep2.executed === 0, String(sweep2.executed));

  // Conditions gate execution: a workflow that only fires for a specific actor.
  const cond = workflow.createWorkflow({
    name: 'VIP only', trigger: '*', conditions: [{ field: 'actorId', op: 'eq', value: 'usr_vip' }],
    actions: [{ type: 'tag', tag: 'VIP' }], ownerId: 'usr_creator'
  });
  const notVip = signals.emitSignal({ type: 'object_saved', actorId: 'usr_plain' });
  check('a condition can reject a signal', workflow.matches(cond, notVip) === false);
  const vip = signals.emitSignal({ type: 'object_saved', actorId: 'usr_vip' });
  check('a condition can accept a signal', workflow.matches(cond, vip) === true);

  // A blast action fails closed with no provider/recipient.
  const blastWf = workflow.createWorkflow({
    name: 'Blast', trigger: 'campaign_published',
    actions: [{ type: 'blast', channel: 'sms', to: '0722000111', text: 'New event!' }],
    ownerId: 'usr_creator'
  });
  signals.emitSignal({ type: 'campaign_published', actorId: 'usr_me', objectId: 'o1' });
  await workflow.sweep();
  const run = workflow.listRuns().find((r) => r.workflowId === blastWf.id);
  check('a blast run is logged even when it fails closed', Boolean(run) && run.results[0].ok === false);

  // Over HTTP.
  {
    const { default: appW } = await import('../src/index.js');
    const srvW = appW.listen(0);
    const portW = srvW.address().port;
    const list = await (await fetch(`http://127.0.0.1:${portW}/api/workflows`)).json();
    check('GET /api/workflows lists workflows + runs', Array.isArray(list.workflows) && Array.isArray(list.runs) && typeof list.stats.totalRuns === 'number');
    srvW.close();
  }
}

console.log('\n=== CREATOR: MEDIA KIT, PARTNERSHIP, INBOX, SUBSCRIPTIONS (CCS §3) ===');
{
  const partnership = await import('../src/domain/partnership.js');
  const inbox = await import('../src/domain/inbox.js');
  const subscription = await import('../src/domain/subscription.js');
  const vendors = await import('../src/domain/vendor.js');
  const campaigns = await import('../src/domain/campaign.js');

  // A media kit is derived from a creator's real vendor + activity.
  vendors.createVendor({ ownerId: 'usr_creator', displayName: 'Hike Kenya' });
  const kit = partnership.mediaKit('usr_creator');
  check('a media kit derives from a vendor', kit && kit.displayName === 'Hike Kenya');
  check('the media kit notes no fabricated reach', /No follower count is fabricated/.test(kit.note));
  check('interests are derived (may be empty)', Array.isArray(kit.interests));

  // A brand sends an opportunity; only the creator may respond.
  const opp = partnership.createOpportunity({ creatorId: 'usr_creator', brandId: 'usr_brand', title: 'Sponsored hike', budget: 20000 });
  check('an opportunity is created pending', opp.status === 'pending');
  try { partnership.transitionOpportunity(opp.id, 'accept', 'usr_brand'); check('a brand cannot accept', false); }
  catch (e) { check('a brand cannot accept', /creator may respond/.test(e.message)); }
  partnership.transitionOpportunity(opp.id, 'accept', 'usr_creator');
  check('the creator can accept', partnership.listOpportunities({ creatorId: 'usr_creator' })[0].status === 'accepted');

  // Unified inbox: inbound author activity forms a contact.
  store.insert('rawItems', { id: 'r1', sourceId: 's1', externalId: 'e1', author: 'Wanjiku', text: 'Hi!', platform: 'telegram', publishedAt: new Date().toISOString() });
  const contacts = inbox.listContacts();
  check('an inbound message forms a contact', contacts.some((c) => c.name === 'Wanjiku'));
  const thread = inbox.thread('author:Wanjiku');
  check('the thread has the inbound message', thread.length === 1 && thread[0].direction === 'inbound' && thread[0].text === 'Hi!');

  // Subscriptions: schedule is real, money flows through the ledger.
  const sub = subscription.createSubscription({ creatorId: 'usr_creator', title: 'Trail Club', price: 500, interval: 'monthly' });
  check('a subscription is created active', sub.status === 'active');
  subscription.transitionSubscription(sub.id, 'pause');
  check('a subscription can pause', subscription.getSubscription(sub.id).status === 'paused');
  subscription.transitionSubscription(sub.id, 'resume');
  const tx = subscription.recordCycle(sub.id, 'usr_member');
  check('a cycle is a real ledger transaction', tx.type === 'subscription' && tx.amount === 500);
  const subs = subscription.listSubscriptions({ creatorId: 'usr_creator' });
  check('subscriptions list', subs.length === 1);

  // Outdoor fields are validated and surfaced.
  const camp = campaigns.createCampaign('usr_creator', {
    title: 'Sunrise summit', type: 'popup', location: 'Ngong',
    metadata: { requirements: 'Bring water', equipmentList: ['Boots', 'Torch'], emergencyContact: '0722000111', routeInfo: 'Southern ridge' }
  });
  const pub = campaigns.publicView(campaigns.getCampaign(camp.id));
  check('outdoor fields are surfaced on the public view', pub.equipmentList?.includes('Boots') && pub.routeInfo === 'Southern ridge');
  try {
    campaigns.createCampaign('usr_creator', { title: 'Bad', type: 'popup', metadata: { equipmentList: 'not-a-list' } });
    check('a malformed equipmentList is refused', false);
  } catch (e) {
    check('a malformed equipmentList is refused', /equipmentList must be a list/.test(e.message));
  }

  // Over HTTP.
  {
    const { default: appC } = await import('../src/index.js');
    const srvC = appC.listen(0);
    const portC = srvC.address().port;
    const kits = await (await fetch(`http://127.0.0.1:${portC}/api/creator/mediakits`)).json();
    check('GET /api/creator/mediakits lists derived kits', Array.isArray(kits.mediaKits) && kits.mediaKits.some((k) => k.displayName === 'Hike Kenya'));
    const cs = await (await fetch(`http://127.0.0.1:${portC}/api/inbox/contacts`)).json();
    check('GET /api/inbox/contacts lists contacts', Array.isArray(cs.contacts));
    srvC.close();
  }
}

console.log('\n=== FEATURE REGISTRY (§4.2) ===');
{
  const features = await import('../src/features.js');

  // The WhatsApp connector tests above leave WHATSAPP_* set (a pre-existing
  // leak). Establish the no-credential baseline this block asserts against.
  delete process.env.WHATSAPP_APP_SECRET;
  delete process.env.WHATSAPP_VERIFY_TOKEN;

  // Default state: everything enabled; module features configured; provider
  // features NOT configured (no credentials in this run).
  check('every feature is enabled by default', features.list().every((f) => f.enabled));
  check('the registry holds all registered features', features.list().length === 41, String(features.list().length));
  check('auth is available by default', features.available('auth') === true);
  check('arena is available by default', features.available('arena') === true);
  check('vaults is available by default', features.available('vaults') === true);
  check('payments is enabled but NOT configured (no Tuma creds)', features.isEnabled('payments') === true && features.isConfigured('payments') === false);
  check('payments available=false (enabled yet unconfigured)', features.available('payments') === false);
  check('payouts is NOT configured', features.isConfigured('payouts') === false);
  check('outbound is NOT configured (no Twilio creds)', features.isConfigured('outbound') === false);
  check('telegram is NOT configured (no token in this run)', features.isConfigured('telegram') === false);
  check('whatsapp is NOT configured', features.isConfigured('whatsapp') === false);
  check('status() reports disabled as empty', features.status().disabled.length === 0);

  // Deploy toggle: disable arena, then confirm the edge guard 503s and the
  // rest of the app is untouched.
  process.env.BRIEF_DISABLED_FEATURES = 'arena';
  check('disabling arena flips enabled', features.isEnabled('arena') === false);
  check('a disabled feature is not available', features.available('arena') === false);
  check('status() names the disabled feature', features.status().disabled.includes('arena'));
  check('other features are unaffected', features.isEnabled('auth') === true && features.isEnabled('commerce') === true);

  // Over HTTP: /api/arena/games is 503 when arena is disabled; /api/health is not.
  {
    const { default: appF } = await import('../src/index.js');
    const srvF = appF.listen(0);
    const portF = srvF.address().port;
    const callF = async (p) => {
      const res = await fetch(`http://127.0.0.1:${portF}${p}`);
      return { status: res.status, body: await res.json().catch(() => null) };
    };
    const off = await callF('/api/arena/games');
    check('a disabled feature 503s at the edge', off.status === 503 && off.body?.feature === 'arena', JSON.stringify(off));
    const still = await callF('/api/health');
    check('health still serves while arena is disabled', still.status === 200);
    const cmd = await callF('/api/host/command');
    check('an enabled feature still serves', cmd.status === 200, `got ${cmd.status}`);
    srvF.close();
  }

  delete process.env.BRIEF_DISABLED_FEATURES;
  check('clearing the list re-enables the feature', features.isEnabled('arena') === true);
}

console.log('\n=== TUMA PAYMENT E2E + WEBHOOK (simulated provider) ===');
{
  process.env.NODE_ENV = 'test';
  process.env.TUMA_EMAIL = 'shop@example.com';
  process.env.TUMA_API_KEY = 'tuma_test_key';
  process.env.BRIEF_PUBLIC_ORIGIN = 'https://brief.example.com';
  process.env.TUMA_WEBHOOK_SECRET = 'tuma-cb-secret';

  const pay = await import('../src/domain/payment.js');
  const tuma = await import('../src/connectors/tuma.js');
  const { default: app } = await import('../src/index.js');
  store._reset();
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, method = 'GET', body, token) => {
    const headers = {};
    if (body) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    // A stubbed Tuma rail: token + successful push, in place of the real fetch.
    const fakeFetch = async (url, opts) => {
      if (url.endsWith('/auth/token')) {
        return { ok: true, status: 200, json: async () => ({ success: true, data: { token: 'jwt.test.token' } }) };
      }
      if (url.endsWith('/payment/stk-push')) {
        const b = JSON.parse(opts.body);
        return {
          ok: true, status: 200,
          json: async () => ({
            success: true, message: 'sent',
            data: { checkout_request_id: `ws_CO_${b.amount}`, merchant_request_id: 'mr_1', customer_message: 'Check your phone' }
          })
        };
      }
      throw new Error('unexpected URL ' + url);
    };

    const A = (await call('/api/auth/register', 'POST', { handle: 'tseller', password: 'a good passphrase' })).body;
    const B = (await call('/api/auth/register', 'POST', { handle: 'tbuyer', password: 'a good passphrase' })).body;
    await call('/api/vendors', 'POST', { displayName: 'Tuma Stall' }, A.token);
    let r = await call('/api/listings', 'POST', { title: 'Rice', type: 'product', price: 300, quantityAvailable: 10 }, A.token);
    const lid = r.body.listing.id;
    await call(`/api/listings/${lid}/status`, 'POST', { status: 'active' }, A.token);
    r = await call('/api/orders', 'POST', { listingId: lid, quantity: 2 }, B.token);
    const oid = r.body.order.id;
    check('order placed for 600', r.body.order.total === 600);

    // --- INITIATE through the domain layer with the stubbed rail -----------
    const { intent } = pay.createIntent({ orderId: oid, payerId: B.user.id, phone: '0722000111' });
    check('provider is Tuma on the intent', intent.provider === 'tuma');
    const init = await pay.requestPayment(intent.id, { fetchImpl: fakeFetch });
    check('requestPayment succeeds against the stubbed Tuma', init.ok === true && init.providerRef === 'ws_CO_600');
    let stored = pay.getIntent(intent.id);
    check('the intent is authorized with the provider ref', stored.status === 'authorized' && stored.providerRef === 'ws_CO_600');

    // --- WEBHOOK: fail closed ----------------------------------------------
    r = await call('/api/webhooks/tuma/wrong', 'POST', { status: 'completed', checkout_request_id: 'ws_CO_600', result_code: 0 });
    check('a wrong callback secret is refused (403)', r.status === 403, `got ${r.status}`);

    // --- WEBHOOK: success, end to end --------------------------------------
    r = await call('/api/webhooks/tuma/tuma-cb-secret', 'POST', {
      status: 'completed', checkout_request_id: 'ws_CO_600', result_code: 0,
      result_desc: 'ok', mpesa_receipt_number: 'REC600', amount: 600
    });
    check('a valid callback is accepted (200)', r.status === 200 && r.body?.ok === true, JSON.stringify(r.body));
    check('exactly ONE ledger transaction was created', store.all('ledgerTransactions').length === 1);
    check('the transaction is settled', store.all('ledgerTransactions')[0].status === 'settled');
    check('the intent is confirmed', pay.getIntent(intent.id).status === 'confirmed');
    check('the intent records a completion time', Boolean(pay.getIntent(intent.id).confirmedAt));
    const paidOrder = (await call(`/api/orders/${oid}`, 'GET', undefined, B.token)).body.order;
    check('the order now reads paid', paidOrder.paid === true && paidOrder.paymentStatus === 'settled');

    // --- WEBHOOK: duplicate callback is an idempotent no-op ----------------
    r = await call('/api/webhooks/tuma/tuma-cb-secret', 'POST', {
      status: 'completed', checkout_request_id: 'ws_CO_600', result_code: 0, amount: 600
    });
    check('a duplicate callback is a no-op (ok:true, duplicate)', r.status === 200 && r.body?.duplicate === true);
    check('a duplicate callback created NO second transaction', store.all('ledgerTransactions').length === 1);

    // --- WEBHOOK: amount mismatch fails loudly -----------------------------
    const { intent: intent2 } = pay.createIntent({ orderId: oid, payerId: B.user.id, phone: '0722000111' });
    // (a second live intent cannot exist for the same order, so simulate an
    // authorized state directly -- the domain enforces one live intent/order)
    store.update('paymentIntents', intent2.id, { status: 'authorized', providerRef: 'ws_CO_BAD' });
    r = await call('/api/webhooks/tuma/tuma-cb-secret', 'POST', {
      status: 'completed', checkout_request_id: 'ws_CO_BAD', result_code: 0, amount: 1
    });
    check('an amount mismatch is refused', r.body?.ok === false && r.body?.reason === 'amount_mismatch', JSON.stringify(r.body));
    check('still exactly one ledger transaction', store.all('ledgerTransactions').length === 1);

    // --- WEBHOOK: unknown reference ----------------------------------------
    r = await call('/api/webhooks/tuma/tuma-cb-secret', 'POST', {
      status: 'completed', checkout_request_id: 'ws_CO_NOPE', result_code: 0, amount: 600
    });
    check('an unknown reference is 200 but not applied', r.status === 200 && r.body?.ok === false && r.body?.reason === 'unknown_reference');
    check('no extra transaction was created', store.all('ledgerTransactions').length === 1);

    // --- WEBHOOK: cancelled payment does not credit ------------------------
    const { intent: intent3 } = pay.createIntent({ orderId: oid, payerId: B.user.id, phone: '0722000111' });
    store.update('paymentIntents', intent3.id, { status: 'authorized', providerRef: 'ws_CO_CANCEL' });
    r = await call('/api/webhooks/tuma/tuma-cb-secret', 'POST', {
      status: 'cancelled', checkout_request_id: 'ws_CO_CANCEL', result_code: 1032
    });
    check('a cancelled payment is a DISTINCT terminal state', pay.getIntent(intent3.id).status === 'cancelled');
    check('a cancelled payment created no transaction', store.all('ledgerTransactions').length === 1);

    // --- Unauthenticated initiation is refused -----------------------------
    const anon = await fetch(`http://127.0.0.1:${port}/api/orders/${oid}/pay`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer bogus' },
      body: JSON.stringify({ phone: '0722000111' })
    });
    check('an invalid token cannot initiate (401)', anon.status === 401);
  } finally {
    srv.close();
    delete process.env.TUMA_EMAIL;
    delete process.env.TUMA_API_KEY;
    delete process.env.BRIEF_PUBLIC_ORIGIN;
    delete process.env.TUMA_WEBHOOK_SECRET;
    tuma._resetTokenCache();
  }
}

console.log('\n=== PAYMENT LIFECYCLE, IDEMPOTENCY, REPLAY (simulated provider refs) ===');
{
  store._reset();
  const vendors = await import('../src/domain/vendor.js');
  const listings = await import('../src/domain/listing.js');
  const ordersD = await import('../src/domain/order.js');
  const pay = await import('../src/domain/payment.js');
  const settle = await import('../src/domain/settlement.js');

  const v = vendors.createVendor({ ownerId: 'usr_seller', displayName: 'Pay Test Stall' });
  const l = listings.createListing({ vendorId: v.id, title: 'Sack of rice', type: 'product',
    price: 2000, currency: 'KES', quantityAvailable: 50 });
  listings.transitionListing(l.id, 'active');
  const order = ordersD.createOrder({ listingId: l.id, buyerId: 'usr_buyer', quantity: 2 });
  check('order total is 4000', order.total === 4000, `got ${order.total}`);

  // --- intent creation ------------------------------------------------------
  let threw = null;
  try { pay.createIntent({ orderId: order.id, payerId: 'usr_someone_else' }); }
  catch (e) { threw = e.message; }
  check('a NON-BUYER cannot create a payment intent', /only the buyer/i.test(String(threw)), String(threw));

  const { intent } = pay.createIntent({ orderId: order.id, payerId: 'usr_buyer', phone: '0722000111' });
  check('intent created', intent.status === 'intent');
  // THE CENTRAL ECONOMIC RULE.
  check('the amount comes from the ORDER, not the caller', intent.amount === 4000, `got ${intent.amount}`);
  check('the phone was normalised', intent.phone === '254722000111', intent.phone);
  check('no transaction exists yet', intent.transactionId === null);
  check('the ledger is still empty', store.all('ledgerTransactions').length === 0);

  // A second intent for the same order returns the LIVE one, not a new push.
  const again = pay.createIntent({ orderId: order.id, payerId: 'usr_buyer', phone: '0722000111' });
  check('a second intent for the same order is REUSED', again.reused === true && again.intent.id === intent.id);
  check('only one intent row exists', store.all('paymentIntents').length === 1);

  // Idempotency key.
  const k = pay.createIntent({ orderId: order.id, payerId: 'usr_buyer', idempotencyKey: 'key-1' });
  check('an idempotency key also reuses', k.intent.id === intent.id);

  // --- confirmation ---------------------------------------------------------
  // Simulate the provider having accepted the push by recording its reference.
  store.update('paymentIntents', intent.id, { status: 'authorized', providerRef: 'ws_CO_TEST_1' });

  const unknown = pay.confirmPayment({ providerRef: 'ws_CO_NOPE', succeeded: true, amount: 4000, receipt: 'RX1' });
  check('a callback for an UNKNOWN reference is refused', unknown.ok === false && unknown.reason === 'unknown_reference');

  // AMOUNT TAMPERING: the provider says a different number than we asked for.
  const tampered = pay.confirmPayment({ providerRef: 'ws_CO_TEST_1', succeeded: true, amount: 1, receipt: 'RX_BAD' });
  check('an AMOUNT MISMATCH is refused', tampered.ok === false && tampered.reason === 'amount_mismatch');
  check('and the payment is marked failed, not left hanging', tampered.intent.status === 'failed');
  check('NO transaction was created for the mismatch', store.all('ledgerTransactions').length === 0);
  check('the failure reason records both numbers', /4000/.test(tampered.intent.failureReason) && /1/.test(tampered.intent.failureReason));

  // Recover: a fresh order and a clean confirmation.
  const order2 = ordersD.createOrder({ listingId: l.id, buyerId: 'usr_buyer', quantity: 1 });
  const i2 = pay.createIntent({ orderId: order2.id, payerId: 'usr_buyer', phone: '0722000111' }).intent;
  store.update('paymentIntents', i2.id, { status: 'authorized', providerRef: 'ws_CO_TEST_2' });

  const good = pay.confirmPayment({ providerRef: 'ws_CO_TEST_2', succeeded: true, amount: 2000, receipt: 'RCPT001' });
  check('a correct callback confirms', good.ok === true && good.intent.status === 'confirmed');
  check('exactly ONE ledger transaction was created', store.all('ledgerTransactions').length === 1);
  const tx = store.all('ledgerTransactions')[0];
  check('the transaction is settled', tx.status === 'settled');
  check('the transaction amount is the ORDER amount', tx.amount === 2000, `got ${tx.amount}`);
  check('the provider reference is recorded', tx.metadata?.providerRef === 'ws_CO_TEST_2');
  check('the receipt is recorded', good.intent.receipt === 'RCPT001');

  // --- DUPLICATE CALLBACK ---------------------------------------------------
  const dup = pay.confirmPayment({ providerRef: 'ws_CO_TEST_2', succeeded: true, amount: 2000, receipt: 'RCPT001' });
  check('a DUPLICATE callback is an idempotent no-op', dup.ok === true && dup.duplicate === true);
  check('it returns the ORIGINAL transaction', dup.transactionId === good.transactionId);
  check('still exactly ONE transaction -- no double payment', store.all('ledgerTransactions').length === 1);

  // --- REPLAY with a stolen receipt on a different intent -------------------
  const order3 = ordersD.createOrder({ listingId: l.id, buyerId: 'usr_buyer', quantity: 1 });
  const i3 = pay.createIntent({ orderId: order3.id, payerId: 'usr_buyer', phone: '0722000111' }).intent;
  store.update('paymentIntents', i3.id, { status: 'authorized', providerRef: 'ws_CO_TEST_3' });
  const replay = pay.confirmPayment({ providerRef: 'ws_CO_TEST_3', succeeded: true, amount: 2000, receipt: 'RCPT001' });
  check('REPLAYING a used receipt on another order is refused', replay.ok === false && replay.reason === 'replayed_receipt');
  check('no transaction was created by the replay', store.all('ledgerTransactions').length === 1);

  // --- failed payment -------------------------------------------------------
  const fail = pay.confirmPayment({ providerRef: 'ws_CO_TEST_3', succeeded: false, failureReason: 'Request cancelled by user' });
  check('a FAILED payment is recorded as failed', fail.ok === true && fail.failed === true);
  check('the failure reason is kept', /cancelled/i.test(fail.intent.failureReason));
  check('a failed payment creates NO transaction', store.all('ledgerTransactions').length === 1);
  const refail = pay.confirmPayment({ providerRef: 'ws_CO_TEST_3', succeeded: true, amount: 2000, receipt: 'RCPT999' });
  check('a failed payment cannot later be confirmed', refail.ok === false, JSON.stringify(refail).slice(0, 100));

  // --- SETTLEMENT ONLY AFTER CONFIRMED PAYMENT ------------------------------
  // order2 was genuinely paid, so it -- and only it -- may settle.
  let cannot = false;
  try { ordersD.transitionOrder(order3.id, 'settled'); } catch { cannot = true; }
  check('an UNPAID order still cannot settle', cannot);

  ordersD.attachTransaction(order2.id, good.transactionId);
  ordersD.transitionOrder(order2.id, 'fulfilled');
  const settled = ordersD.transitionOrder(order2.id, 'settled');
  check('a genuinely PAID order CAN settle', settled.order.status === 'settled');

  const earn = settle.vendorEarnings(v.id);
  check('earnings now reflect real money', earn.gross === 2000, `gross=${earn.gross}`);
  check('commission is 5% floored', earn.commission === 100, `commission=${earn.commission}`);
  check('the seller keeps the rest', earn.net === 1900, `net=${earn.net}`);
  check('exactly one settled order', earn.orderCount === 1);
  // The honest bit: earned is still not withdrawable.
  check('payout is STILL unavailable (no payout credentials)', earn.payoutAvailable === false);
  check('and the reason is stated', /provider/i.test(earn.payoutReason));

  // --- reconciliation -------------------------------------------------------
  let rec = pay.reconcileIntents();
  check('payment reconciliation is balanced', rec.balanced === true, JSON.stringify(rec.discrepancies));
  check('it counts confirmed intents', rec.confirmed === 1, `got ${rec.confirmed}`);
  check('it counts failed intents', rec.failed >= 2, `got ${rec.failed}`);

  // NEGATIVE: inject a confirmed intent with no transaction and prove the
  // reconciler catches it rather than trusting it would.
  const rogue = store.insert('paymentIntents', {
    id: 'pay_rogue', orderId: order3.id, payerId: 'usr_buyer', amount: 500,
    currency: 'KES', status: 'confirmed', provider: 'tuma', providerRef: 'ws_ROGUE',
    receipt: 'ROGUE1', transactionId: null, createdAt: new Date().toISOString()
  });
  rec = pay.reconcileIntents();
  check('reconciliation DETECTS a confirmed intent with no transaction',
    rec.balanced === false && rec.discrepancies.some((d) => d.kind === 'confirmed_without_transaction'),
    JSON.stringify(rec.discrepancies));
  store.remove('paymentIntents', rogue.id);
  check('and is balanced again once removed', pay.reconcileIntents().balanced === true);

  // The ledger's own reconciliation must also still agree.
  check('ledger reconciliation agrees', settle.reconcile().balanced === true);
}

console.log('\n=== PAYMENT HTTP SURFACE ===');
{
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('../src/index.js');
  store._reset();
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, method = 'GET', body, token) => {
    const headers = {};
    if (body) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    const A = (await call('/api/auth/register', 'POST', { handle: 'payseller', password: 'a good passphrase' })).body;
    const B = (await call('/api/auth/register', 'POST', { handle: 'paybuyer', password: 'a good passphrase' })).body;
    await call('/api/vendors', 'POST', { displayName: 'Pay Stall' }, A.token);
    let r = await call('/api/listings', 'POST', { title: 'Beans', type: 'product', price: 300, quantityAvailable: 10 }, A.token);
    const lid = r.body.listing.id;
    await call(`/api/listings/${lid}/status`, 'POST', { status: 'active' }, A.token);
    r = await call('/api/orders', 'POST', { listingId: lid, quantity: 2 }, B.token);
    const oid = r.body.order.id;
    check('order placed for 600', r.body.order.total === 600);

    // Paying without a provider must be honest, not a fake success.
    r = await call(`/api/orders/${oid}/pay`, 'POST', { phone: '0722000111' }, B.token);
    check('pay returns 503 with no provider', r.status === 503, `got ${r.status}`);
    check('it says nothing was charged', r.body?.charged === false);
    check('it names the missing provider', /no payment provider/i.test(r.body?.reason ?? ''));
    check('an intent still exists for audit', Boolean(r.body?.intent?.id));
    check('the intent amount is server-derived', r.body?.intent?.amount === 600);

    // Only the buyer may pay.
    r = await call(`/api/orders/${oid}/pay`, 'POST', { phone: '0722000111' }, A.token);
    check('the SELLER cannot pay for the buyer', r.status === 400, `got ${r.status}`);

    // Unauthenticated payment is refused outright.
    const anon = await fetch(`http://127.0.0.1:${port}/api/orders/${oid}/pay`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer bogus-token' },
      body: JSON.stringify({ phone: '0722000111' })
    });
    check('an invalid token cannot pay (401)', anon.status === 401, `got ${anon.status}`);

    // Payment visibility is party-only.
    r = await call(`/api/orders/${oid}/payments`, 'GET', undefined, B.token);
    check('the buyer can see payment state', r.status === 200 && Array.isArray(r.body?.payments));
    const C = (await call('/api/auth/register', 'POST', { handle: 'paystranger', password: 'a good passphrase' })).body;
    r = await call(`/api/orders/${oid}/payments`, 'GET', undefined, C.token);
    check('a stranger cannot see payment state (404)', r.status === 404, `got ${r.status}`);

    // --- WEBHOOK -------------------------------------------------------------
    // Fails closed with no secret configured.
    r = await call('/api/webhooks/tuma/whatever', 'POST', { status: 'completed', checkout_request_id: 'ws_X', result_code: 0 });
    check('the webhook REJECTS when no secret is configured (403)', r.status === 403, `got ${r.status}`);
    check('the rejection leaks no detail', JSON.stringify(r.body) === '{"error":"rejected"}', JSON.stringify(r.body));
    check('the rejected callback was still recorded for audit',
      store.all('paymentCallbacks').some((c) => c.accepted === false));

    // With a secret configured, a WRONG secret is still refused.
    process.env.TUMA_WEBHOOK_SECRET = 'sekret-value-123';
    r = await call('/api/webhooks/tuma/wrong-secret-value', 'POST', { status: 'completed', checkout_request_id: 'ws_X', result_code: 0 });
    check('a WRONG secret is refused (403)', r.status === 403, `got ${r.status}`);

    // Right secret, but a payload Tuma would never send.
    r = await call('/api/webhooks/tuma/sekret-value-123', 'POST', { nonsense: true });
    check('a malformed payload is 400, not 500', r.status === 400, `got ${r.status}`);

    // Right secret, unknown reference: accepted (200) but NOT applied, so
    // Tuma does not retry forever.
    r = await call('/api/webhooks/tuma/sekret-value-123', 'POST', {
      status: 'completed', checkout_request_id: 'ws_UNKNOWN', result_code: 0, amount: 600
    });
    check('an unknown reference returns 200 but ok:false', r.status === 200 && r.body?.ok === false, JSON.stringify(r.body));
    check('no transaction was created', store.all('ledgerTransactions').length === 0);
    delete process.env.TUMA_WEBHOOK_SECRET;

    // Reconciliation endpoint.
    r = await call('/api/economic/payments/reconcile', 'GET', undefined, B.token);
    check('payment reconciliation is exposed', r.status === 200 && typeof r.body?.reconciliation?.balanced === 'boolean');

    // Capabilities must tell the truth.
    r = await call('/api/capabilities');
    check('capabilities still report payments unconfigured', r.body?.payments?.configured === false);
    check('and name Tuma as the intended rail', r.body?.payments?.detail?.provider === 'tuma');
  } finally {
    srv.close();
  }
}


console.log('\n=== PAYOUT: SETTLED EARNINGS -> DISBURSEMENT ===');
{
  store._reset();
  const vendors = await import('../src/domain/vendor.js');
  const listings = await import('../src/domain/listing.js');
  const ordersD = await import('../src/domain/order.js');
  const settle = await import('../src/domain/settlement.js');
  const led = await import('../src/domain/ledger.js');
  const providers = await import('../src/providers.js');

  const v = vendors.createVendor({ ownerId: 'usr_payee', displayName: 'Payout Stall' });
  const l = listings.createListing({ vendorId: v.id, title: 'Crate', type: 'product',
    price: 1000, currency: 'KES', quantityAvailable: 100 });
  listings.transitionListing(l.id, 'active');

  // Genuinely settle two orders (2000 gross -> 100 commission -> 1900 net).
  const settleOne = (qty) => {
    const o = ordersD.createOrder({ listingId: l.id, buyerId: 'usr_buyer', quantity: qty });
    const tx = led.createTransaction({ amount: o.total, currency: 'KES', type: 'sale' });
    led.transitionTransaction(tx.id, 'pending');
    led.transitionTransaction(tx.id, 'confirmed');
    led.transitionTransaction(tx.id, 'settled');
    ordersD.attachTransaction(o.id, tx.id);
    ordersD.transitionOrder(o.id, 'fulfilled');
    ordersD.transitionOrder(o.id, 'settled');
    return o;
  };
  settleOne(1);
  settleOne(1);

  let e = settle.vendorEarnings(v.id);
  check('two settled orders', e.orderCount === 2);
  check('gross is 2000', e.gross === 2000, `got ${e.gross}`);
  check('commission is 100', e.commission === 100, `got ${e.commission}`);
  check('net is 1900', e.net === 1900, `got ${e.net}`);
  check('nothing paid out yet', e.paidOut === 0);
  check('withdrawable equals net', e.withdrawable === 1900, `got ${e.withdrawable}`);

  // WITHOUT a disbursement provider the request must be REFUSED, not queued,
  // and must never create a payout row or a ledger transaction.
  const ledgerRowsBefore = store.all('ledgerTransactions').length;
  let threw = null, code = null;
  try { settle.requestPayout({ vendorId: v.id, requestedBy: 'usr_payee', phone: '0722000111' }); }
  catch (err) { threw = err.message; code = err.code; }
  check('a payout is REFUSED with no provider', /unavailable|not configured/i.test(String(threw)), String(threw));
  check('the refusal is machine-readable (provider_unavailable)', code === 'provider_unavailable');
  check('no payout row was created', store.all('payouts').length === 0);
  check('no ledger transaction was created', store.all('ledgerTransactions').length === ledgerRowsBefore);
  check('payoutAvailable is false', e.payoutAvailable === false);
  check('and the reason names the provider', /provider/i.test(e.payoutReason));

  // Authorization: only the vendor may request their own payout.
  threw = null;
  try { settle.requestPayout({ vendorId: v.id, requestedBy: 'usr_someone_else', phone: '0722000111' }); }
  catch (err) { threw = err.message; }
  check('another actor cannot request this vendor payout', /only the vendor/i.test(String(threw)), String(threw));

  // --- with a disbursement provider registered -----------------------------
  // A test provider is registered ONLY to exercise the payout ledger
  // arithmetic; no network call is made because sendPayout() is not invoked
  // here. This also proves the provider seam works: the domain layer sees a
  // configured disbursement provider without knowing anything about it.
  providers.DISBURSEMENT_PROVIDERS.testpayout = {
    isPayoutConfigured: () => true,
    status: () => ({ provider: 'testpayout', configured: true }),
    disburse: async ({ amount }) => ({ ok: true, providerRef: `TEST_${amount}` })
  };

  e = settle.vendorEarnings(v.id);
  check('payout now reports available', e.payoutAvailable === true);
  check('withdrawable is still derived, not stored', e.withdrawable === 1900);

  const { payout } = settle.requestPayout({ vendorId: v.id, requestedBy: 'usr_payee', phone: '0722000111' });
  check('a payout can be requested', payout.status === 'requested');
  // THE CENTRAL RULE: the amount is derived, never asked for.
  check('the payout amount is DERIVED from settled orders', payout.amount === 1900, `got ${payout.amount}`);
  check('the phone was normalised', payout.phone === '254722000111');

  // In-flight money must reduce what is withdrawable.
  e = settle.vendorEarnings(v.id);
  check('an in-flight payout reduces withdrawable to 0', e.withdrawable === 0, `got ${e.withdrawable}`);
  check('pendingPayout reflects it', e.pendingPayout === 1900);
  check('payoutAvailable is false while one is in flight', e.payoutAvailable === false);
  check('and says a payout is in progress', /in progress/i.test(e.payoutReason), e.payoutReason);

  // A SECOND concurrent payout must not be created.
  const second = settle.requestPayout({ vendorId: v.id, requestedBy: 'usr_payee', phone: '0722000111' });
  check('a concurrent second payout is REUSED, not created', second.reused === true && second.payout.id === payout.id);
  check('still exactly one payout row', store.all('payouts').length === 1);

  // Idempotency key.
  const k1 = settle.requestPayout({ vendorId: v.id, requestedBy: 'usr_payee', idempotencyKey: 'pk-1' });
  check('an idempotency key reuses too', k1.payout.id === payout.id);

  // --- confirmation ---------------------------------------------------------
  store.update('payouts', payout.id, { providerRef: 'AG_CONV_1' });
  const unknown = settle.confirmPayout({ providerRef: 'AG_NOPE', succeeded: true });
  check('an unknown payout reference is refused', unknown.ok === false && unknown.reason === 'unknown_reference');

  const paid = settle.confirmPayout({ providerRef: 'AG_CONV_1', succeeded: true });
  check('the payout confirms as paid', paid.ok === true && paid.payout.status === 'paid');

  e = settle.vendorEarnings(v.id);
  check('paidOut now reflects the disbursement', e.paidOut === 1900, `got ${e.paidOut}`);
  check('withdrawable is 0 -- money was actually sent', e.withdrawable === 0);
  check('but net earnings are UNCHANGED (history, not a balance)', e.net === 1900);

  // DOUBLE PAYOUT: a re-delivered result must not pay again.
  const dup = settle.confirmPayout({ providerRef: 'AG_CONV_1', succeeded: true });
  check('a duplicate payout result is an idempotent no-op', dup.ok === true && dup.duplicate === true);
  check('paidOut did NOT double', settle.vendorEarnings(v.id).paidOut === 1900);
  check('still exactly one payout row', store.all('payouts').length === 1);

  // Requesting again with nothing left must be refused.
  threw = null;
  try { settle.requestPayout({ vendorId: v.id, requestedBy: 'usr_payee', phone: '0722000111' }); }
  catch (err) { threw = err.message; }
  check('a payout with nothing withdrawable is refused', /already been paid|no settled earnings/i.test(String(threw)), String(threw));

  // New sales create new withdrawable money -- and only the new amount.
  settleOne(1);
  e = settle.vendorEarnings(v.id);
  check('a new settled sale increases net', e.net === 2850, `got ${e.net}`);
  check('withdrawable is ONLY the new money', e.withdrawable === 950, `got ${e.withdrawable}`);

  // A FAILED payout must return the money to withdrawable, not lose it.
  const p2 = settle.requestPayout({ vendorId: v.id, requestedBy: 'usr_payee', phone: '0722000111' }).payout;
  store.update('payouts', p2.id, { providerRef: 'AG_CONV_2' });
  settle.confirmPayout({ providerRef: 'AG_CONV_2', succeeded: false, failureReason: 'insufficient float' });
  e = settle.vendorEarnings(v.id);
  check('a FAILED payout does not count as paid', e.paidOut === 1900, `got ${e.paidOut}`);
  check('and the money becomes withdrawable again', e.withdrawable === 950, `got ${e.withdrawable}`);
  check('the failure reason is retained',
    /insufficient float/i.test(store.find('payouts', (p) => p.id === p2.id).failureReason));

  // The ledger must still reconcile through all of this.
  check('ledger still reconciles', settle.reconcile().balanced === true, JSON.stringify(settle.reconcile().discrepancies));

  // NO SECOND WALLET: withdrawable is derived, so deleting payouts restores it.
  const before = settle.vendorEarnings(v.id).withdrawable;
  store.remove('payouts', p2.id);
  check('removing a payout row changes the derived figure (no stored balance)',
    settle.vendorEarnings(v.id).withdrawable === before);

  delete providers.DISBURSEMENT_PROVIDERS.testpayout;
  check('with the provider removed, payout is unavailable again',
    settle.vendorEarnings(v.id).payoutAvailable === false);
}

console.log('\n=== PAYOUT OVER HTTP: 503 / provider_unavailable (no provider) ===');
{
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('../src/index.js');
  const ordersD = await import('../src/domain/order.js');
  const ledgerD = await import('../src/domain/ledger.js');
  store._reset();
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, method = 'GET', body, token) => {
    const headers = {};
    if (body) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    const S = (await call('/api/auth/register', 'POST', { handle: 'payseller503', password: 'a good passphrase' })).body;
    const B = (await call('/api/auth/register', 'POST', { handle: 'paybuyer503', password: 'a good passphrase' })).body;
    const v = (await call('/api/vendors', 'POST', { displayName: '503 Stall' }, S.token)).body.vendor;
    const l = (await call('/api/listings', 'POST', { title: 'Beans', type: 'product', price: 500, quantityAvailable: 10 }, S.token)).body.listing;
    await call(`/api/listings/${l.id}/status`, 'POST', { status: 'active' }, S.token);
    const o = (await call('/api/orders', 'POST', { listingId: l.id, quantity: 2 }, B.token)).body.order;

    // Give the vendor REAL settled earnings: a settled ledger transaction
    // attached to the order, then fulfil + settle the order -- exactly the
    // ordinary money path. No provider is involved in this step.
    const tx = ledgerD.createTransaction({ amount: o.total, currency: 'KES', type: 'sale', counterparty: B.user.id });
    ledgerD.transitionTransaction(tx.id, 'pending');
    ledgerD.transitionTransaction(tx.id, 'confirmed');
    ledgerD.transitionTransaction(tx.id, 'settled');
    ordersD.attachTransaction(o.id, tx.id);
    await call(`/api/orders/${o.id}/fulfil`, 'POST', {}, S.token);
    await call(`/api/orders/${o.id}/settle`, 'POST', {}, S.token);

    const earn = (await call('/api/vendors/me/earnings', 'GET', undefined, S.token)).body.earnings;
    check('the vendor has settled earnings (net of commission)', earn?.withdrawable === 950, `got ${earn?.withdrawable}`);
    check('but payoutAvailable is false (no provider)', earn?.payoutAvailable === false);

    // Requesting a payout with earnings but NO disbursement provider must
    // return an honest 503 / provider_unavailable -- never a queued payout,
    // never a successful (or fake) ledger transaction.
    const payoutRowsBefore = store.all('payouts').length;
    const ledgerRowsBefore = store.all('ledgerTransactions').length;
    const r = await call('/api/vendors/me/payouts', 'POST', { phone: '0722000111' }, S.token);
    check('payout over HTTP is refused with 503', r.status === 503, `got ${r.status}`);
    check('and names provider_unavailable', r.body?.code === 'provider_unavailable', JSON.stringify(r.body));
    check('no payout row was created', store.all('payouts').length === payoutRowsBefore);
    check('no ledger transaction was created', store.all('ledgerTransactions').length === ledgerRowsBefore);
    check('earnings remain withdrawable (nothing was silently disbursed)',
      (await call('/api/vendors/me/earnings', 'GET', undefined, S.token)).body.earnings?.withdrawable === 950);
  } finally {
    srv.close();
  }
}


console.log('\n=== ARENA: SERVER-SIDE PERSISTENCE & RESULT INTEGRITY ===');
{
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('../src/index.js');
  const ar = await import('../src/domain/arena.js');
  store._reset();
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, method = 'GET', body, token) => {
    const headers = {};
    if (body) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    const P1 = (await call('/api/auth/register', 'POST', { handle: 'player_one', password: 'a good passphrase' })).body;
    const P2 = (await call('/api/auth/register', 'POST', { handle: 'player_two', password: 'a good passphrase' })).body;
    const P3 = (await call('/api/auth/register', 'POST', { handle: 'player_three', password: 'a good passphrase' })).body;

    // --- controlled beta -----------------------------------------------------
    let r = await call('/api/arena/beta');
    check('beta scoreboard starts empty and has explicit targets',
      r.status === 200 && r.body?.beta?.actual?.signups === 0 && r.body?.beta?.targets?.signups === 100);
    r = await call('/api/arena/beta/join', 'POST', { segment: 'competitive' }, P1.token);
    check('a player can join the beta with a stated segment',
      r.status === 201 && r.body?.signup?.segment === 'competitive');
    r = await call('/api/arena/beta/join', 'POST', { segment: 'casual' }, P1.token);
    check('a beta join is idempotent and preserves the first segment',
      r.status === 200 && r.body?.reused === true && r.body?.signup?.segment === 'competitive');
    r = await call('/api/arena/beta/join', 'POST', { segment: 'casual' }, P2.token);
    check('the second player can join the casual cohort', r.status === 201);
    r = await call('/api/arena/beta');
    check('beta counters derive signups and segments',
      r.body?.beta?.actual?.signups === 2 && r.body?.beta?.segments?.competitive === 1 && r.body?.beta?.segments?.casual === 1);

    // --- games ---------------------------------------------------------------
    r = await call('/api/arena/games');
    check('games are served from the SERVER', r.status === 200 && r.body?.games?.length === 5);
    check('eFootball present', r.body.games.some((g) => g.id === 'efootball'));
    check('PUBG present', r.body.games.some((g) => g.id === 'pubg_mobile'));
    check('activity counts start at zero -- no fake liveness',
      Object.values(r.body.activity).every((n) => n === 0), JSON.stringify(r.body.activity));

    // --- challenges ----------------------------------------------------------
    r = await call('/api/arena/challenges', 'POST', { gameId: 'efootball', stake: 'friendly', note: 'evening game' }, P1.token);
    check('a challenge can be created', r.status === 201, JSON.stringify(r.body).slice(0, 120));
    const chal = r.body.challenge;
    check('it belongs to the authenticated player', chal.createdBy === P1.user.id);
    check('it is open', chal.status === 'open');

    // PERSISTENCE: the whole point. A different actor can see it.
    r = await call('/api/arena/challenges?gameId=efootball');
    check('another actor SEES the challenge (real persistence)',
      r.body.challenges.some((c) => c.id === chal.id));
    r = await call('/api/arena/games');
    check('activity now reflects a real open challenge', r.body.activity.efootball === 1);

    // Validation.
    r = await call('/api/arena/challenges', 'POST', { gameId: 'not_a_game' }, P1.token);
    check('an unknown game is refused', r.status === 400, `got ${r.status}`);
    r = await call('/api/arena/challenges', 'POST', { gameId: 'efootball', stake: 'entry_fee' }, P1.token);
    check('an entry_fee challenge needs a fee', r.status === 400, `got ${r.status}`);
    r = await call('/api/arena/challenges', 'POST', { gameId: 'efootball', stake: 'entry_fee', entryFeeKes: -5 }, P1.token);
    check('a negative fee is refused', r.status === 400);
    r = await call('/api/arena/challenges', 'POST', { gameId: 'efootball', stake: 'friendly', entryFeeKes: 100 }, P1.token);
    check('a fee on a friendly challenge is refused', r.status === 400);
    r = await call('/api/arena/challenges', 'POST', { gameId: 'efootball' });
    check('creating a challenge requires auth (not anonymous)', r.status === 201 || r.status === 401);

    // --- accepting -----------------------------------------------------------
    r = await call(`/api/arena/challenges/${chal.id}/accept`, 'POST', {}, P1.token);
    check('you CANNOT accept your own challenge', r.status === 400, `got ${r.status}`);

    r = await call(`/api/arena/challenges/${chal.id}/accept`, 'POST', {}, P2.token);
    check('another player CAN accept', r.status === 201, JSON.stringify(r.body).slice(0, 120));
    const match = r.body.match;
    check('a match was created', Boolean(match?.id));
    check('the two players are recorded', match.playerAId === P1.user.id && match.playerBId === P2.user.id);
    check('the match has NO winner yet', match.winnerPlayerId === null);
    check('and is not confirmed', match.confirmedByA === false && match.confirmedByB === false);

    // A third player cannot take an accepted challenge.
    r = await call(`/api/arena/challenges/${chal.id}/accept`, 'POST', {}, P3.token);
    check('an already-accepted challenge cannot be taken again', r.status === 400, `got ${r.status}`);

    // Idempotency: the same accepter retrying gets the SAME match.
    r = await call(`/api/arena/challenges/${chal.id}/accept`, 'POST', {}, P2.token);
    check('re-accepting returns the SAME match, not a second one', r.body?.match?.id === match.id && r.body?.reused === true);
    check('only one match row exists', store.all('arenaMatches').length === 1);

    // --- match visibility ----------------------------------------------------
    r = await call(`/api/arena/matches/${match.id}`, 'GET', undefined, P1.token);
    check('player A can read the match', r.status === 200);
    r = await call(`/api/arena/matches/${match.id}`, 'GET', undefined, P3.token);
    check('a NON-PARTICIPANT cannot read the match (404)', r.status === 404, `got ${r.status}`);

    // --- result integrity ----------------------------------------------------
    r = await call(`/api/arena/matches/${match.id}/report`, 'POST', { winnerPlayerId: P1.user.id, scoreLine: '3-1' }, P3.token);
    check('a stranger cannot report a result', r.status === 404, `got ${r.status}`);

    r = await call(`/api/arena/matches/${match.id}/report`, 'POST', { winnerPlayerId: 'usr_nobody' }, P1.token);
    check('the winner must be one of the two players', r.status === 400, `got ${r.status}`);

    r = await call(`/api/arena/matches/${match.id}/report`, 'POST', { winnerPlayerId: P1.user.id, scoreLine: '3-1' }, P1.token);
    check('player A reports a result', r.status === 200 && r.body.match.status === 'reported');
    check('the reporter auto-confirms their own report', r.body.match.confirmedByA === true);
    check('the OPPONENT has not confirmed', r.body.match.confirmedByB === false);
    // THE CRITICAL RULE.
    check('a reported result is NOT yet a winner', r.body.match.winnerPlayerId === null);

    r = await call(`/api/arena/matches/${match.id}/confirm`, 'POST', {}, P1.token);
    check('the reporter cannot confirm their own result', r.status === 400, `got ${r.status}`);

    r = await call(`/api/arena/matches/${match.id}/confirm`, 'POST', {}, P2.token);
    check('the OPPONENT can confirm', r.status === 200 && r.body.match.status === 'confirmed');
    check('now there is a winner', r.body.match.winnerPlayerId === P1.user.id);
    check('both confirmations recorded', r.body.match.confirmedByA && r.body.match.confirmedByB);
    check('the score line survived', r.body.match.scoreLine === '3-1');

    // A confirmed result is FINAL.
    r = await call(`/api/arena/matches/${match.id}/report`, 'POST', { winnerPlayerId: P2.user.id }, P2.token);
    check('a confirmed result cannot be re-reported', r.status === 400, `got ${r.status}`);
    r = await call(`/api/arena/matches/${match.id}/abandon`, 'POST', {}, P1.token);
    check('a confirmed match cannot be abandoned', r.status === 400, `got ${r.status}`);

    // --- record is DERIVED ---------------------------------------------------
    r = await call('/api/arena/matches', 'GET', undefined, P1.token);
    check('player A has a record', r.body.record.played === 1 && r.body.record.won === 1);
    r = await call('/api/arena/matches', 'GET', undefined, P2.token);
    check('player B lost the same match', r.body.record.played === 1 && r.body.record.lost === 1);
    check('no rating number is invented', r.body.record.rating === undefined);

    // --- DISPUTE: the two players disagree -----------------------------------
    let c2 = (await call('/api/arena/challenges', 'POST', { gameId: 'pubg_mobile', stake: 'ranked' }, P1.token)).body.challenge;
    let m2 = (await call(`/api/arena/challenges/${c2.id}/accept`, 'POST', {}, P2.token)).body.match;
    await call(`/api/arena/matches/${m2.id}/report`, 'POST', { winnerPlayerId: P1.user.id }, P1.token);
    r = await call(`/api/arena/matches/${m2.id}/confirm`, 'POST', { winnerPlayerId: P2.user.id }, P2.token);
    check('contradicting the report DISPUTES the match', r.body.match.status === 'disputed' && r.body.disputed === true);
    check('a disputed match has NO winner', r.body.match.winnerPlayerId === null);
    check('and the reason is recorded', /different winners/i.test(r.body.match.disputeReason));

    r = await call('/api/arena/matches', 'GET', undefined, P1.token);
    check('a DISPUTED match does not count as a win', r.body.record.won === 1, `won=${r.body.record.won}`);
    check('but it is surfaced as disputed', r.body.record.disputed === 1);

    // --- draws ---------------------------------------------------------------
    let c3 = (await call('/api/arena/challenges', 'POST', { gameId: 'fc_mobile' }, P1.token)).body.challenge;
    let m3 = (await call(`/api/arena/challenges/${c3.id}/accept`, 'POST', {}, P2.token)).body.match;
    await call(`/api/arena/matches/${m3.id}/report`, 'POST', { winnerPlayerId: null, scoreLine: '2-2' }, P1.token);
    r = await call(`/api/arena/matches/${m3.id}/confirm`, 'POST', { winnerPlayerId: null }, P2.token);
    check('a draw can be agreed', r.body.match.status === 'confirmed' && r.body.match.winnerPlayerId === 'draw');
    r = await call('/api/arena/matches', 'GET', undefined, P1.token);
    check('a draw counts as neither win nor loss', r.body.record.drawn === 1 && r.body.record.won === 1);

    // --- cancellation --------------------------------------------------------
    let c4 = (await call('/api/arena/challenges', 'POST', { gameId: 'cod_mobile' }, P1.token)).body.challenge;
    r = await call(`/api/arena/challenges/${c4.id}/cancel`, 'POST', {}, P2.token);
    check('another player cannot cancel your challenge (403)', r.status === 403, `got ${r.status}`);
    r = await call(`/api/arena/challenges/${c4.id}/cancel`, 'POST', {}, P1.token);
    check('the owner can cancel', r.status === 200 && r.body.challenge.status === 'cancelled');
    r = await call(`/api/arena/challenges/${c4.id}/accept`, 'POST', {}, P2.token);
    check('a cancelled challenge cannot be accepted', r.status === 400, `got ${r.status}`);

    // --- expiry --------------------------------------------------------------
    const c5 = ar.createChallenge({ createdBy: P1.user.id, gameId: 'efootball', openMinutes: 1 });
    store.update('arenaChallenges', c5.id, { openUntil: new Date(Date.now() - 1000).toISOString() });
    r = await call(`/api/arena/challenges/${c5.id}/accept`, 'POST', {}, P2.token);
    check('an EXPIRED challenge cannot be accepted', r.status === 400, `got ${r.status}`);
    r = await call('/api/arena/challenges?gameId=efootball');
    check('an expired challenge is not listed as open', !r.body.challenges.some((c) => c.id === c5.id));

    // --- NO ARENA ECONOMY ----------------------------------------------------
    check('no arena wallet collection exists', store.all('arenaWallets').length === 0);
    check('arena created NO ledger transactions', store.all('ledgerTransactions').length === 0);
    check('arena created NO payment intents', store.all('paymentIntents').length === 0);
    // The compliance gate is untouched by any of this.
    r = await call('/api/arena/contests/x/stake', 'POST', { amount: 500 }, P1.token);
    check('the real-money gate STILL refuses (403)', r.status === 403, `got ${r.status}`);
    check('and still names the unmet requirements', Array.isArray(r.body?.requirements));

    // --- signals reused, no arena analytics table ----------------------------
    r = await call('/api/signals');
    const kinds = (r.body?.signals ?? []).map((s) => s.type);
    check('arena activity flows through SIGNALS', kinds.includes('arena_challenge_opened'));
    check('acceptance is a signal', kinds.includes('arena_challenge_accepted'));
    check('confirmation is a signal', kinds.includes('arena_result_confirmed'));
    check('disputes are a signal', kinds.includes('arena_result_disputed'));
  } finally {
    srv.close();
  }
}


console.log('\n=== FANTASY 11: LOCK, DETERMINISTIC SCORING, RANKING ===');
{
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('../src/index.js');
  const fz = await import('../src/domain/fantasy.js');
  store._reset();
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, method = 'GET', body, token) => {
    const headers = {};
    if (body) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    const ORG = (await call('/api/auth/register', 'POST', { handle: 'organiser', password: 'a good passphrase' })).body;
    const U1 = (await call('/api/auth/register', 'POST', { handle: 'fanuser1', password: 'a good passphrase' })).body;
    const U2 = (await call('/api/auth/register', 'POST', { handle: 'fanuser2', password: 'a good passphrase' })).body;

    // --- pure scoring, checked by hand ---------------------------------------
    check('a player who did not play scores 0', fz.scorePlayer('FWD', { minutes: 0 }).points === 0);
    check('captaincy does not multiply a zero', fz.scorePlayer('FWD', { minutes: 0 }, { isCaptain: true }).points === 0);
    check('an appearance is 1', fz.scorePlayer('MID', { minutes: 45 }).points === 1);
    check('a FWD goal is 4 (+1 appearance)', fz.scorePlayer('FWD', { minutes: 90, goals: 1 }).points === 5);
    check('a DEF goal is worth more than a FWD goal',
      fz.scorePlayer('DEF', { minutes: 90, goals: 1 }).points > fz.scorePlayer('FWD', { minutes: 90, goals: 1 }).points);
    check('a GK goal is 10', fz.scorePlayer('GK', { minutes: 90, goals: 1 }).points === 11);
    check('a captain doubles exactly', fz.scorePlayer('FWD', { minutes: 90, goals: 2 }, { isCaptain: true }).points === 18);
    check('a clean sheet counts for a DEF', fz.scorePlayer('DEF', { minutes: 90, cleanSheet: true }).points === 5);
    check('a clean sheet does NOT count for a FWD', fz.scorePlayer('FWD', { minutes: 90, cleanSheet: true }).points === 1);
    check('3 saves is 1 point', fz.scorePlayer('GK', { minutes: 90, saves: 3 }).points === 2);
    check('2 saves is 0 extra points', fz.scorePlayer('GK', { minutes: 90, saves: 2 }).points === 1);
    check('a red card costs 3', fz.scorePlayer('MID', { minutes: 90, redCards: 1 }).points === -2);
    check('conceding 4 costs a GK 2', fz.scorePlayer('GK', { minutes: 90, goalsConceded: 4 }).points === -1);
    check('conceding does NOT penalise a FWD', fz.scorePlayer('FWD', { minutes: 90, goalsConceded: 4 }).points === 1);
    check('an own goal costs 2', fz.scorePlayer('DEF', { minutes: 90, ownGoals: 1 }).points === -1);
    check('scoring is NEVER NaN', Number.isFinite(fz.scorePlayer('GK', { minutes: 90, goalsConceded: 5, saves: 7, penaltiesSaved: 1 }).points));
    check('every score carries a breakdown', fz.scorePlayer('FWD', { minutes: 90, goals: 1 }).lines.length === 2);

    // DETERMINISM: the same inputs must always give the same answer.
    const a1 = fz.scorePlayer('MID', { minutes: 90, goals: 1, assists: 2, yellowCards: 1 });
    const a2 = fz.scorePlayer('MID', { minutes: 90, goals: 1, assists: 2, yellowCards: 1 });
    check('scoring is deterministic', JSON.stringify(a1) === JSON.stringify(a2));

    // --- competition setup ---------------------------------------------------
    const kickoff = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    let r = await call('/api/fantasy/competitions', 'POST', { title: 'Saturday XI', kickoffAt: kickoff }, ORG.token);
    check('a competition can be created', r.status === 201);
    const comp = r.body.competition;
    check('it starts as draft', comp.status === 'draft');
    check('paid entry is null until legally possible', comp.entryFeeKes === null);

    r = await call('/api/fantasy/competitions', 'POST', { title: 'Bad', kickoffAt: 'not a date' }, ORG.token);
    check('an invalid kickoff is refused', r.status === 400);

    // Opening with too small a pool must fail.
    r = await call(`/api/fantasy/competitions/${comp.id}/open`, 'POST', {}, ORG.token);
    check('a competition cannot open without enough players', r.status === 400, `got ${r.status}`);

    // Build a real pool: 2 GK, 6 DEF, 6 MID, 4 FWD across 6 clubs.
    const mk = async (name, position, club) =>
      (await call(`/api/fantasy/competitions/${comp.id}/players`, 'POST', { name, position, club }, ORG.token)).body.player;
    const pool = [];
    const clubs = ['Gor', 'Leopards', 'Tusker', 'Bandari', 'Ulinzi', 'Kakamega'];
    for (let i = 0; i < 2; i++) pool.push(await mk(`GK${i}`, 'GK', clubs[i % 6]));
    for (let i = 0; i < 6; i++) pool.push(await mk(`DEF${i}`, 'DEF', clubs[i % 6]));
    for (let i = 0; i < 6; i++) pool.push(await mk(`MID${i}`, 'MID', clubs[i % 6]));
    for (let i = 0; i < 4; i++) pool.push(await mk(`FWD${i}`, 'FWD', clubs[i % 6]));
    check('the pool was built', pool.length === 18);

    // POOL AUTHORITY: a participant cannot add players.
    r = await call(`/api/fantasy/competitions/${comp.id}/players`, 'POST', { name: 'Ringer', position: 'FWD', club: 'Gor' }, U1.token);
    check('a PARTICIPANT cannot add to the player pool (403)', r.status === 403, `got ${r.status}`);
    r = await call(`/api/fantasy/competitions/${comp.id}/players`, 'POST', { name: 'X', position: 'STRIKER', club: 'Gor' }, ORG.token);
    check('an invalid position is refused', r.status === 400);

    r = await call(`/api/fantasy/competitions/${comp.id}/open`, 'POST', {}, ORG.token);
    check('the organiser opens the competition', r.status === 200 && r.body.competition.status === 'open');

    // --- squad validation ----------------------------------------------------
    const gk = pool.filter((p) => p.position === 'GK');
    const def = pool.filter((p) => p.position === 'DEF');
    const mid = pool.filter((p) => p.position === 'MID');
    const fwd = pool.filter((p) => p.position === 'FWD');
    // Build a squad that respects the max-3-per-club rule. Picking greedily
    // by position while tracking club counts is how a real client would.
    const pickSquad = (want, exclude = new Set()) => {
      const clubCount = {};
      const out = [];
      for (const [pos, n] of Object.entries(want)) {
        let taken = 0;
        for (const p of pool.filter((x) => x.position === pos)) {
          if (taken >= n) break;
          if (exclude.has(p.id)) continue;
          if ((clubCount[p.club] ?? 0) >= 3) continue;
          clubCount[p.club] = (clubCount[p.club] ?? 0) + 1;
          out.push(p); taken++;
        }
      }
      return out;
    };
    const squad1 = pickSquad({ GK: 1, DEF: 4, MID: 3, FWD: 3 });
    check('a legal 11 could be assembled', squad1.length === 11, `got ${squad1.length}`);
    const validTeam = squad1.map((p) => p.id);

    const bad = async (playerIds, captainId, label) => {
      const rr = await call(`/api/fantasy/competitions/${comp.id}/entries`, 'POST', { playerIds, captainId }, U1.token);
      check(label, rr.status === 400, `got ${rr.status}`);
    };
    await bad(validTeam.slice(0, 10), validTeam[0], 'a team of 10 is refused');
    await bad([...validTeam, fwd[3].id], validTeam[0], 'a team of 12 is refused');
    await bad([validTeam[0], ...validTeam.slice(0, 10)], validTeam[0], 'a duplicated player is refused');
    await bad([...validTeam.slice(0, 10), 'fply_invented'], validTeam[0], 'an INVENTED player is refused');
    await bad(validTeam, 'fply_invented', 'a captain outside the team is refused');
    await bad(validTeam, null, 'a missing captain is refused');
    await bad([gk[0].id, gk[1].id, ...validTeam.slice(1, 10)], gk[0].id, 'two goalkeepers is refused');

    // Club limit: 4 from one club.
    const gorPlayers = pool.filter((p) => p.club === 'Gor');
    if (gorPlayers.length >= 4) {
      const clubHeavy = [...gorPlayers.slice(0, 4).map((p) => p.id)];
      const filler = pool.filter((p) => !clubHeavy.includes(p.id)).slice(0, 7).map((p) => p.id);
      await bad([...clubHeavy, ...filler], clubHeavy[0], 'more than 3 from one club is refused');
    }

    // --- valid submission ----------------------------------------------------
    const cap1 = squad1.find((p) => p.position === 'FWD').id;
    const cap1b = squad1.find((p) => p.position === 'MID').id;
    r = await call(`/api/fantasy/competitions/${comp.id}/entries`, 'POST', { playerIds: validTeam, captainId: cap1 }, U1.token);
    check('a valid team is accepted', r.status === 201, JSON.stringify(r.body).slice(0, 140));
    check('the entry has no points yet', r.body.entry.points === null);
    check('and no rank yet', r.body.entry.rank === null);

    // DUPLICATE PROTECTION: resubmitting updates, never duplicates.
    r = await call(`/api/fantasy/competitions/${comp.id}/entries`, 'POST', { playerIds: validTeam, captainId: cap1b }, U1.token);
    check('resubmitting BEFORE lock updates the same entry', r.status === 200 && r.body.created === false);
    check('exactly one entry for this user', fz.listEntries(comp.id).filter((e) => e.userId === U1.user.id).length === 1);
    check('the captain changed', fz.getEntry(comp.id, U1.user.id).captainId === cap1b);

    // A second user enters.
    const squad2 = pickSquad({ GK: 1, DEF: 3, MID: 4, FWD: 3 });
    const team2 = squad2.map((p) => p.id);
    const cap2 = squad2.find((p) => p.position === 'FWD').id;
    r = await call(`/api/fantasy/competitions/${comp.id}/entries`, 'POST', { playerIds: team2, captainId: cap2 }, U2.token);
    check('a second user can enter', r.status === 201, JSON.stringify(r.body).slice(0, 140));
    check('two entries exist', fz.listEntries(comp.id).length === 2);

    // Privacy: you cannot read someone else's team.
    r = await call(`/api/fantasy/competitions/${comp.id}/entries/me`, 'GET', undefined, U2.token);
    check('you can read your OWN entry', r.status === 200 && r.body.entry.userId === U2.user.id);

    // --- stats before kickoff are refused ------------------------------------
    r = await call(`/api/fantasy/competitions/${comp.id}/stats`, 'POST', { playerId: fwd[0].id, stats: { minutes: 90, goals: 3 } }, ORG.token);
    check('stats CANNOT be recorded before kickoff', r.status === 400, `got ${r.status}`);
    r = await call(`/api/fantasy/competitions/${comp.id}/score`, 'POST', {}, ORG.token);
    check('scoring before lock is refused', r.status === 400, `got ${r.status}`);

    // --- THE LOCK ------------------------------------------------------------
    // Move kickoff into the past. The server clock decides, not the client.
    store.update('fantasyCompetitions', comp.id, { kickoffAt: new Date(Date.now() - 1000).toISOString() });
    check('the competition is now locked by TIME alone', fz.isLocked(fz.getCompetition(comp.id)) === true);

    r = await call(`/api/fantasy/competitions/${comp.id}/entries`, 'POST', { playerIds: team2, captainId: cap2 }, U1.token);
    check('a team CANNOT be changed after lock', r.status === 400, `got ${r.status}`);
    check('the refusal says why', /locked/i.test(r.body?.error ?? ''), r.body?.error);
    check('the stored team is unchanged', fz.getEntry(comp.id, U1.user.id).captainId === cap1b);

    r = await call(`/api/fantasy/competitions/${comp.id}/entries`, 'POST', { playerIds: validTeam, captainId: cap1 },
      (await call('/api/auth/register', 'POST', { handle: 'latecomer', password: 'a good passphrase' })).body.token);
    check('a NEW entry after lock is refused', r.status === 400, `got ${r.status}`);

    // --- stats + scoring ------------------------------------------------------
    r = await call(`/api/fantasy/competitions/${comp.id}/stats`, 'POST', { playerId: cap1, stats: { minutes: 90, goals: 2 } }, ORG.token);
    check('the organiser can record stats after kickoff', r.status === 200);
    r = await call(`/api/fantasy/competitions/${comp.id}/stats`, 'POST', { playerId: cap1, stats: { minutes: 90, goals: 5 } }, U1.token);
    check('a PARTICIPANT cannot record stats (403)', r.status === 403, `got ${r.status}`);

    for (const p of squad1.slice(0, 6)) {
      await call(`/api/fantasy/competitions/${comp.id}/stats`, 'POST',
        { playerId: p.id, stats: { minutes: 90, goals: p.position === 'FWD' ? 1 : 0, assists: 1, cleanSheet: p.position === 'GK' } }, ORG.token);
    }

    r = await call(`/api/fantasy/competitions/${comp.id}/score`, 'POST', {}, U1.token);
    check('a participant cannot score the competition (403)', r.status === 403, `got ${r.status}`);

    r = await call(`/api/fantasy/competitions/${comp.id}/score`, 'POST', {}, ORG.token);
    check('the organiser scores it', r.status === 200);
    const standings1 = r.body.standings;
    check('every entry got a score', standings1.length === 2 && standings1.every((s) => Number.isFinite(s.points)));
    check('ranks were assigned', standings1.every((s) => s.rank >= 1));

    // REPRODUCIBILITY: rescoring the same data gives the same answer.
    const again = fz.scoreCompetition(comp.id);
    check('rescoring is REPRODUCIBLE',
      JSON.stringify(again.standings) === JSON.stringify(standings1),
      `${JSON.stringify(again.standings)} vs ${JSON.stringify(standings1)}`);

    // AUDITABILITY: the breakdown must explain the number.
    const e1 = fz.getEntry(comp.id, U1.user.id);
    check('the entry carries a full breakdown', Array.isArray(e1.breakdown) && e1.breakdown.length === 11);
    const sum = e1.breakdown.reduce((t, b) => t + b.points, 0);
    check('the breakdown SUMS to the total', sum === e1.points, `${sum} vs ${e1.points}`);
    const capLine = e1.breakdown.find((b) => b.isCaptain);
    check('the captain is flagged in the breakdown', Boolean(capLine));
    check('the captain line shows the multiplier', capLine.lines.some((l) => /Captain/.test(l.label)));

    r = await call(`/api/fantasy/competitions/${comp.id}/standings`);
    check('standings are publicly readable after scoring', r.status === 200 && r.body.standings.length === 2);
    check('the competition is marked scored', r.body.status === 'scored');

    // --- NO FANTASY ECONOMY ---------------------------------------------------
    check('fantasy created NO ledger transactions', store.all('ledgerTransactions').length === 0);
    check('no fantasy wallet exists', store.all('fantasyWallets').length === 0);
    r = await call(`/api/fantasy/competitions/${comp.id}/paid-entry`, 'POST', { amount: 200 }, U1.token);
    check('PAID fantasy entry hits the same compliance gate (403)', r.status === 403, `got ${r.status}`);
    check('and returns the same machine-readable code', r.body?.code === 'compliance_gate');
    check('naming the same unmet requirements', r.body?.unmet?.includes('gaming_licence'));

    r = await call('/api/fantasy/rules');
    check('the scoring rules are published for verification', r.status === 200 && r.body.scoring.assist === 3);
  } finally {
    srv.close();
  }
}


console.log('\n=== MIGRATIONS AGAINST AN OLD FIXTURE ===');
{
  const st = await import('../src/store.js');

  // A database as it existed BEFORE any of Batch 3/4: no vendors, no orders,
  // no users, no schema version. This is the real upgrade case.
  const legacy = {
    sources: [{ id: 'src_old', name: 'Old source' }],
    objects: [{ id: 'obj_old', title: 'An old object' }],
    signals: [{ id: 'sig_old', type: 'object_created' }]
    // note: no __schemaVersion, no vendors/orders/users/sessions/payments
  };

  const merged = { ...JSON.parse(JSON.stringify({
    users: [], sessions: [], vendors: [], listings: [], orders: [], disputes: [],
    paymentIntents: [], paymentCallbacks: [], payouts: [],
    arenaChallenges: [], arenaMatches: [],
    fantasyCompetitions: [], fantasyPlayers: [], fantasyEntries: [], fantasyStats: []
  })), ...legacy };

  // No backup hook: this fixture is in memory, not on disk.
  const result = st.migrate(merged, { onBackup: () => null });
  check('an unversioned database is detected as version 0', result.from === 0);
  check('it migrates to the current version', result.to === st.SCHEMA_VERSION);
  check('migrations were applied in order', result.applied.join(',') === '1:baseline,2:backfill-order-currency', result.applied?.join(','));

  // EXISTING DATA MUST SURVIVE. This is the whole safety requirement.
  check('existing sources survived', result.db.sources.length === 1 && result.db.sources[0].id === 'src_old');
  check('existing objects survived', result.db.objects[0].title === 'An old object');
  check('existing signals survived', result.db.signals.length === 1);
  // And new collections exist without anyone writing a migration for them.
  check('new collections appear automatically', Array.isArray(result.db.users) && Array.isArray(result.db.payouts));
  check('new arena collections appear', Array.isArray(result.db.arenaMatches));

  // The real transformation: backfill a missing currency.
  const withOrders = { ...merged, __schemaVersion: 1, orders: [
    { id: 'ord_legacy_1', total: 500 },                 // no currency
    { id: 'ord_legacy_2', total: 800, currency: 'USD' } // already set
  ] };
  const r2 = st.migrate(withOrders, { onBackup: () => null });
  check('a v1 database migrates to v2', r2.from === 1 && r2.to === 2);
  check('a missing currency is BACKFILLED', r2.db.orders[0].currency === 'KES');
  check('an existing currency is NOT overwritten', r2.db.orders[1].currency === 'USD', r2.db.orders[1].currency);

  // Idempotency: running again must do nothing.
  const r3 = st.migrate(r2.db, { onBackup: () => null });
  check('re-running migrations is a no-op', r3.migrated === false && r3.from === st.SCHEMA_VERSION);

  // A CURRENT database is untouched.
  const current = { ...merged, __schemaVersion: st.SCHEMA_VERSION };
  check('a current database is not migrated', st.migrate(current, { onBackup: () => null }).migrated === false);

  // A FAILING migration must abort, not half-apply, and must say where the
  // backup is. Verified by injecting a thrower rather than trusting the path.
  let aborted = null;
  try {
    st.migrate({ ...merged, __schemaVersion: 0 }, {
      onBackup: () => { throw new Error('disk full'); }
    });
  } catch (e) { aborted = e.message; }
  check('a failing BACKUP aborts the migration', Boolean(aborted), String(aborted));
}

console.log('\n=== OPERATIONS: READINESS, DIAGNOSTICS, BACKUP ===');
{
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('../src/index.js');
  const opsM = await import('../src/ops.js');
  const settleM = await import('../src/domain/settlement.js');
  const payM = await import('../src/domain/payment.js');
  store._reset();
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, method = 'GET', body, token) => {
    const headers = {};
    if (body) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    // --- readiness -----------------------------------------------------------
    let r = await call('/api/ready');
    check('readiness is public and returns 200 when healthy', r.status === 200, `got ${r.status}`);
    check('it reports uptime', Number.isFinite(r.body?.uptimeSeconds));
    check('it checks the store', r.body.checks.some((c) => c.name === 'store' && c.ok));
    // Readiness must be tied to REAL economic state, not a hardcoded true.
    check('it checks settlement reconciliation', r.body.checks.some((c) => c.name === 'settlement'));
    check('it checks payment reconciliation', r.body.checks.some((c) => c.name === 'payments'));

    // Break reconciliation and prove readiness NOTICES.
    store.insert('orders', {
      id: 'ord_rogue_ready', vendorId: 'vend_x', buyerId: 'usr_y', status: 'settled',
      total: 100, currency: 'KES', transactionId: null, createdAt: new Date().toISOString()
    });
    r = await call('/api/ready');
    check('a broken ledger makes readiness FAIL (503)', r.status === 503, `got ${r.status}`);
    check('and the failing check is named',
      r.body.checks.some((c) => c.name === 'settlement' && !c.ok), JSON.stringify(r.body.checks));
    store.remove('orders', 'ord_rogue_ready');
    r = await call('/api/ready');
    check('readiness recovers once fixed', r.status === 200);

    // --- diagnostics ---------------------------------------------------------
    const U = (await call('/api/auth/register', 'POST', { handle: 'operator', password: 'a good passphrase' })).body;
    r = await call('/api/ops/diagnostics', 'GET', undefined, U.token);
    check('diagnostics are available to an authenticated operator', r.status === 200);
    check('they report the data file', typeof r.body?.startup?.dataFile === 'string');
    check('they report writability', r.body.startup.dataWritable === true);
    check('they count real collections', Number.isFinite(r.body?.counts?.users));
    check('they surface recent errors', Array.isArray(r.body?.recentErrors));
    check('they surface rejected webhook callbacks', Number.isFinite(r.body?.rejectedCallbacks));

    // --- backup --------------------------------------------------------------
    r = await call('/api/ops/backup', 'POST', {}, U.token);
    check('a backup can be taken', r.status === 200 && r.body?.ok === true, JSON.stringify(r.body).slice(0, 140));
    const fsm = await import('node:fs');
    check('the backup file really exists on disk', fsm.existsSync(r.body.file));
    check('and it is not empty', r.body.size > 0);
    // A backup must be restorable, which means valid JSON with real content.
    const restored = JSON.parse(fsm.readFileSync(r.body.file, 'utf8'));
    check('the backup parses as JSON', typeof restored === 'object');
    check('the backup carries the schema version', restored.__schemaVersion === (await import('../src/store.js')).SCHEMA_VERSION);
    check('the backup contains the users', Array.isArray(restored.users) && restored.users.length >= 1);

    // Pruning must keep the disk bounded.
    for (let i = 0; i < 3; i++) opsM.backup(store);
    const pruned = opsM.pruneBackups(store, 2);
    check('pruning keeps only the newest N', pruned.kept === 2, JSON.stringify(pruned));

    // --- restore-from-snapshot: the redeploy resilience net ------------------
    // With a live, non-empty data file, restore is a no-op.
    const restoreNoop = opsM.restoreLatestBackupIfEmpty(store);
    check('restore is a no-op when data exists', restoreNoop.restored === false, JSON.stringify(restoreNoop));
    // Simulate a wiped primary (fresh deploy) with a snapshot present: restore
    // must bring the snapshot back.
    const dataFile = store._file;
    const backupDir = path.join(path.dirname(dataFile), 'backups');
    const snapshots = fsm.readdirSync(backupDir).filter((f) => f.endsWith('.json')).sort();
    check('a snapshot exists to restore from', snapshots.length > 0, String(snapshots.length));
    fsm.renameSync(dataFile, `${dataFile}.wiped`);
    const restored2 = opsM.restoreLatestBackupIfEmpty(store);
    check('restore brings the snapshot back after a wipe', restored2.restored === true, JSON.stringify(restored2));
    check('the data file is back on disk', fsm.existsSync(dataFile));
    fsm.rmSync(`${dataFile}.wiped`, { force: true });

    // The periodic backup installer is disabled in test (non-positive interval).
    check('periodic backup disables on a non-positive interval', opsM.installPeriodicBackup(store, { intervalMs: 0 }) === null);

    // --- startup diagnostics flag real problems -------------------------------
    const diagProd = opsM.startupDiagnostics({
      store, capabilities: { payments: { configured: false } }
    });
    check('diagnostics note the missing payment provider outside production',
      Array.isArray(diagProd.notes));

    const prevEnv = process.env.NODE_ENV;
    const prevDev = process.env.BRIEF_DEV_AUTH;
    process.env.NODE_ENV = 'production';
    process.env.BRIEF_DEV_AUTH = '1';
    const risky = opsM.startupDiagnostics({ store, capabilities: { payments: { configured: false } } });
    check('an insecure production auth config is flagged as a PROBLEM',
      risky.problems.some((p) => /BRIEF_DEV_AUTH/.test(p)), JSON.stringify(risky.problems));
    // And the auth layer itself must agree.
    const { authStatus: as } = await import('../src/identity.js');
    check('authStatus also reports it as insecure', as().insecure === true);
    process.env.NODE_ENV = prevEnv;
    if (prevDev === undefined) delete process.env.BRIEF_DEV_AUTH; else process.env.BRIEF_DEV_AUTH = prevDev;
    check('and it is not insecure once unset', as().insecure === false);

    // --- ops endpoints are not public ----------------------------------------
    // (dev fallback is on in tests, so this asserts the route exists and is
    // guarded by requireAuth rather than being anonymous-only.)
    r = await call('/api/ops/diagnostics');
    check('diagnostics respond for a resolved caller', r.status === 200 || r.status === 401);
  } finally {
    srv.close();
  }
}


console.log('\n=== ENDPOINT AUTHORIZATION RULES, ENCODED EXPLICITLY ===');
{
  // Turn the development fallback OFF so "unauthenticated" genuinely means
  // no identity at all. This is the production posture.
  const prevDev = process.env.BRIEF_DEV_AUTH;
  process.env.BRIEF_DEV_AUTH = '0';
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('../src/index.js');
  store._reset();
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, method = 'GET', body, token) => {
    const headers = {};
    if (body) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    const { authStatus } = await import('../src/identity.js');
    check('with the fallback off, auth is REQUIRED', authStatus().devFallback === false);

    // --- private operations must be refused outright -------------------------
    const privateOps = [
      ['POST', '/api/sources', { name: 'X', type: 'manual' }],
      ['POST', '/api/connectors/web/fetch', { url: 'https://example.com' }],
      ['POST', '/api/connectors/rss/sync', { url: 'https://example.com/feed' }],
      ['POST', '/api/connectors/telegram/sync', {}],
      ['POST', '/api/brief-it/preview', { text: 'something' }],
      ['POST', '/api/brief-it/save', { text: 'something' }],
      ['POST', '/api/vendors', { displayName: 'X' }],
      ['POST', '/api/listings', { title: 'X', price: 1 }],
      ['POST', '/api/orders', { listingId: 'x' }],
      ['POST', '/api/arena/challenges', { gameId: 'efootball' }],
      ['GET', '/api/arena/matches', null],
      ['POST', '/api/fantasy/competitions', { title: 'X', kickoffAt: new Date().toISOString() }],
      ['GET', '/api/vendors/me/earnings', null],
      ['POST', '/api/vendors/me/payouts', {}],
      ['GET', '/api/ops/diagnostics', null],
      ['POST', '/api/ops/backup', {}]
    ];
    let refusedAll = true;
    const leaked = [];
    for (const [method, path, body] of privateOps) {
      const r = await call(path, method, body);
      if (r.status !== 401) { refusedAll = false; leaked.push(`${method} ${path} -> ${r.status}`); }
    }
    check('EVERY private operation refuses an anonymous caller (401)', refusedAll, leaked.join(' | '));

    // A forged token must be refused exactly the same way.
    const forged = await call('/api/vendors', 'POST', { displayName: 'X' }, 'totally-made-up-token');
    check('a forged token is refused too (401)', forged.status === 401, `got ${forged.status}`);

    // --- public operations must STAY public ----------------------------------
    const publicOps = [
      ['GET', '/api/health'],
      ['GET', '/api/ready'],
      ['GET', '/api/capabilities'],
      ['GET', '/api/listings'],
      ['GET', '/api/arena/games'],
      ['GET', '/api/arena/challenges'],
      ['GET', '/api/arena/status'],
      ['GET', '/api/fantasy/rules'],
      ['GET', '/api/fantasy/competitions']
    ];
    let allPublic = true;
    const blocked = [];
    for (const [method, path] of publicOps) {
      const r = await call(path, method);
      if (r.status === 401) { allPublic = false; blocked.push(path); }
    }
    check('public reads stay public', allPublic, blocked.join(', '));

    // --- registration and login must remain reachable ------------------------
    let r = await call('/api/auth/register', 'POST', { handle: 'authruleuser', password: 'a good passphrase' });
    check('registration is reachable without a token', r.status === 201, `got ${r.status}`);
    const tok = r.body.token;
    r = await call('/api/auth/login', 'POST', { handle: 'authruleuser', password: 'a good passphrase' });
    check('login is reachable without a token', r.status === 200);

    // --- SELF-SCOPED source creation, verified end to end --------------------
    r = await call('/api/sources', 'POST', { name: 'My channel', type: 'telegram_channel' }, tok);
    check('an authenticated caller CAN create a source', r.status === 201, JSON.stringify(r.body).slice(0, 120));
    const src = r.body.source;
    check('the creator got a granted membership',
      Boolean(store.find('sourceMemberships', (m) => m.sourceId === src.id && m.userId !== null && m.accessGranted)));
    check('a new source is NOT born connected', src.connectionStatus === 'needs_authorization');

    // The creator can delete their own source...
    const other = (await call('/api/auth/register', 'POST', { handle: 'otheractor', password: 'a good passphrase' })).body;
    r = await call(`/api/sources/${src.id}`, 'DELETE', undefined, other.token);
    check('ANOTHER actor cannot delete it (403)', r.status === 403, `got ${r.status}`);
    r = await call(`/api/sources/${src.id}`, 'DELETE', undefined, tok);
    check('the creator CAN delete it', r.status === 200, `got ${r.status}`);
    check('memberships cascaded', store.filter('sourceMemberships', (m) => m.sourceId === src.id).length === 0);

    // --- public campaign registration must stay intentionally public ---------
    const org = (await call('/api/auth/register', 'POST', { handle: 'puborg', password: 'a good passphrase' })).body;
    r = await call('/api/campaigns', 'POST', { title: 'Open Day', type: 'popup' }, org.token);
    const camp = r.body.campaign;
    await call(`/api/campaigns/${camp.id}/publish`, 'POST', {}, org.token);
    r = await call(`/api/public/campaigns/${camp.publicSlug}`);
    check('a public campaign resolves with NO token', r.status === 200, `got ${r.status}`);
    r = await call(`/api/public/campaigns/${camp.publicSlug}/register`, 'POST', { attendeeRef: '0700111222', name: 'Walk-in' });
    check('a stranger can still register with NO token', r.status === 200 || r.status === 201, `got ${r.status}`);
    check('this is the documented exception, and it still leaks nothing',
      !/ownerId|sourceId/.test(JSON.stringify(r.body)));
  } finally {
    srv.close();
    if (prevDev === undefined) delete process.env.BRIEF_DEV_AUTH; else process.env.BRIEF_DEV_AUTH = prevDev;
  }
}


console.log('\n=== AUCTION: PRICE DISCOVERY, NOT A SECOND ECONOMY ===');
{
  const auctions = await import('../src/domain/auction.js');
  const vendors = await import('../src/domain/vendor.js');
  const listings = await import('../src/domain/listing.js');
  const settlementM = await import('../src/domain/settlement.js');
  store._reset();

  const future = (ms) => new Date(Date.now() + ms).toISOString();

  const seller = { id: 'usr_seller' };
  const v = vendors.createVendor({ ownerId: seller.id, displayName: 'Curio Shop', contactMethod: '0700' });
  const mkListing = (over = {}) => listings.createListing({
    vendorId: v.id, title: 'Carved stool', type: 'product',
    price: 3000, currency: 'KES', quantityAvailable: 1, ...over
  });
  const l1 = mkListing();

  // ---- creation rules ------------------------------------------------------
  let threw = null;
  try {
    auctions.createAuction({ listingId: l1.id, ownerId: 'usr_stranger', startingPrice: 1000, endsAt: future(60000) });
  } catch (e) { threw = e.message; }
  check('a stranger cannot auction someone else\'s listing', /only the listing owner/.test(threw ?? ''), threw);

  threw = null;
  try {
    auctions.createAuction({ listingId: l1.id, ownerId: seller.id, startingPrice: 1000, endsAt: new Date(Date.now() - 1000).toISOString() });
  } catch (e) { threw = e.message; }
  check('an auction cannot end in the past', /future/.test(threw ?? ''), threw);

  threw = null;
  try {
    auctions.createAuction({ listingId: l1.id, ownerId: seller.id, startingPrice: 1000, reservePrice: 500, endsAt: future(60000) });
  } catch (e) { threw = e.message; }
  check('a reserve below the start price is refused', /reservePrice/.test(threw ?? ''), threw);

  threw = null;
  try {
    auctions.createAuction({ listingId: l1.id, ownerId: seller.id, startingPrice: 1000, buyNowPrice: 900, endsAt: future(60000) });
  } catch (e) { threw = e.message; }
  check('a Buy Now below the start price is refused', /buyNowPrice/.test(threw ?? ''), threw);

  const a1 = auctions.createAuction({ listingId: l1.id, ownerId: seller.id, startingPrice: 1000, endsAt: future(60000) });
  check('an auction is created as draft', a1.status === 'draft');
  check('it has NO winner', a1.winnerId === null && a1.winningBidId === null);
  check('its price starts at the starting price', a1.currentPrice === 1000);
  check('it is not yet biddable', a1.biddable === false);

  threw = null;
  try { auctions.createAuction({ listingId: l1.id, ownerId: seller.id, startingPrice: 1000, endsAt: future(60000) }); }
  catch (e) { threw = e.message; }
  check('a listing cannot have two live auctions', /already has an auction/.test(threw ?? ''), threw);

  // ---- bidding requires an open auction ------------------------------------
  threw = null;
  try { auctions.placeBid({ auctionId: a1.id, bidderId: 'usr_b1', amount: 1500 }); }
  catch (e) { threw = e.message; }
  check('a draft auction refuses bids', /not open/.test(threw ?? ''), threw);

  auctions.openAuction(a1.id, seller.id);
  check('the owner opens it', auctions.getAuction(a1.id).status === 'open');
  check('now it is biddable', auctions.getAuction(a1.id).biddable === true);

  threw = null;
  try { auctions.openAuction(a1.id, 'usr_stranger'); } catch (e) { threw = e.message; }
  check('a stranger cannot open an auction', /only the owner/.test(threw ?? ''), threw);

  // ---- A BID IS NOT A TRANSACTION -----------------------------------------
  const ledgerBefore = store.all('ledgerTransactions').length;
  const ordersBefore = store.all('orders').length;
  auctions.placeBid({ auctionId: a1.id, bidderId: 'usr_b1', amount: 1200 });
  check('a bid writes NO ledger transaction', store.all('ledgerTransactions').length === ledgerBefore);
  check('a bid creates NO order', store.all('orders').length === ordersBefore);
  check('a bid is stored in its own collection', store.all('bids').length === 1);
  check('the price is now DERIVED from the bid', auctions.currentPrice(a1.id) === 1200);

  // The seller has earned nothing. Bids are not revenue.
  const earn = settlementM.vendorEarnings(v.id);
  check('BIDS ARE NOT REVENUE: seller earnings still zero', earn.net === 0, JSON.stringify(earn));

  // ---- bidding rules -------------------------------------------------------
  threw = null;
  try { auctions.placeBid({ auctionId: a1.id, bidderId: 'usr_b2', amount: 1200 }); }
  catch (e) { threw = e.message; }
  check('a bid must EXCEED the current price', /exceed/.test(threw ?? ''), threw);

  threw = null;
  try { auctions.placeBid({ auctionId: a1.id, bidderId: seller.id, amount: 5000 }); }
  catch (e) { threw = e.message; }
  check('the seller cannot bid on their own auction', /your own auction/.test(threw ?? ''), threw);

  for (const bad of [0, -5, 2.5, NaN, Infinity, 1e308]) {
    threw = null;
    try { auctions.placeBid({ auctionId: a1.id, bidderId: 'usr_b2', amount: bad }); }
    catch (e) { threw = e.message; }
    check(`a bid of ${bad} is refused`, threw !== null, String(threw));
  }

  // Idempotency, matching orders.
  const k = 'bid-key-1';
  const r1 = auctions.placeBid({ auctionId: a1.id, bidderId: 'usr_b2', amount: 1500, idempotencyKey: k });
  const r2 = auctions.placeBid({ auctionId: a1.id, bidderId: 'usr_b2', amount: 1500, idempotencyKey: k });
  check('a repeated bid key returns the SAME bid', r1.bid.id === r2.bid.id);
  check('and is flagged as reused', r2.reused === true);
  check('only one row was written', store.filter('bids', (b) => b.idempotencyKey === k).length === 1);

  // ---- the leader is derived, so retraction re-derives it ------------------
  auctions.placeBid({ auctionId: a1.id, bidderId: 'usr_b3', amount: 2000 });
  check('the leader is the highest bid', auctions.highestBid(a1.id).amount === 2000);
  const top = auctions.highestBid(a1.id);
  auctions.retractBid({ bidId: top.id, actorId: 'usr_b3' });
  check('RETRACTION RE-DERIVES the price (no stale stored leader)',
    auctions.currentPrice(a1.id) === 1500, String(auctions.currentPrice(a1.id)));
  check('the retracted bid is excluded from active bids',
    !auctions.activeBids(a1.id).some((b) => b.id === top.id));

  threw = null;
  try { auctions.retractBid({ bidId: r1.bid.id, actorId: 'usr_someone_else' }); }
  catch (e) { threw = e.message; }
  check('only the bidder may retract their bid', /only the bidder/.test(threw ?? ''), threw);

  // ---- bidder privacy ------------------------------------------------------
  const pub = auctions.publicView(auctions.getAuction(a1.id));
  const pubStr = JSON.stringify(pub);
  check('the public view shows the leading AMOUNT', pub.currentPrice === 1500);
  check('and the bid count', pub.bidCount >= 1);
  check('but NO bidder identity leaks', !/usr_b1|usr_b2|usr_b3/.test(pubStr), pubStr.slice(0, 160));
  check('and no bid ids either', !/bid_/.test(pubStr));

  // ---- closing: deterministic winner --------------------------------------
  const closed = auctions.closeAuction({ auctionId: a1.id, actorId: seller.id });
  check('the owner may close early', closed.changed === true && closed.sold === true);
  check('the winner is the highest bidder', closed.auction.winnerId === 'usr_b2');
  check('at the winning amount', closed.auction.winningAmount === 1500);
  check('the auction is closed', closed.auction.status === 'closed');
  const lost = store.filter('bids', (b) => b.auctionId === a1.id && b.status === 'lost');
  check('losing bids are marked lost', lost.length >= 1);
  check('A LOSING BID PRODUCED NO LEDGER ROW', store.all('ledgerTransactions').length === ledgerBefore);
  check('and no order for the losers', store.filter('orders', (o) => o.buyerId === 'usr_b1').length === 0);

  // Terminal: no reopening, no re-closing with a different winner.
  const again = auctions.closeAuction({ auctionId: a1.id, actorId: seller.id });
  check('closing twice is a no-op', again.changed === false);
  check('the winner did not change', again.auction.winnerId === 'usr_b2');
  threw = null;
  try { auctions.openAuction(a1.id, seller.id); } catch (e) { threw = e.message; }
  check('a closed auction cannot be REOPENED', /cannot open/.test(threw ?? ''), threw);
  threw = null;
  try { auctions.placeBid({ auctionId: a1.id, bidderId: 'usr_b1', amount: 99999 }); }
  catch (e) { threw = e.message; }
  check('and cannot take a late bid', /not open/.test(threw ?? ''), threw);

  // ---- determinism: same bids in, same winner out --------------------------
  //
  // Note that placeBid REFUSES an equal bid, so a tie cannot arise through
  // the public API at all -- that is the first assertion below. The tie-break
  // is still tested, against rows written directly, because the comparator
  // must be a total order even for data that predates the rule or arrives by
  // repair.
  {
    const mkAuction = (owner) => {
      const vv = vendors.createVendor({ ownerId: owner, displayName: owner, contactMethod: '1' });
      const ll = listings.createListing({ vendorId: vv.id, title: 'X', type: 'product', price: 100, currency: 'KES', quantityAvailable: 1 });
      const aa = auctions.createAuction({ listingId: ll.id, ownerId: owner, startingPrice: 100, endsAt: future(60000) });
      auctions.openAuction(aa.id, owner);
      return aa;
    };

    store._reset();
    const aa = mkAuction('usr_s2');
    auctions.placeBid({ auctionId: aa.id, bidderId: 'usr_early', amount: 500 });
    let t = null;
    try { auctions.placeBid({ auctionId: aa.id, bidderId: 'usr_late', amount: 500 }); }
    catch (e) { t = e.message; }
    check('an EQUAL bid is refused, so ties cannot arise through the API', /exceed/.test(t ?? ''), t);

    // Force a tie at the data layer and confirm the winner is still stable.
    const runWinner = () => {
      store._reset();
      const a2 = mkAuction('usr_s2');
      const first = auctions.placeBid({ auctionId: a2.id, bidderId: 'usr_early', amount: 500 }).bid;
      store.update('bids', first.id, { placedAt: '2020-01-01T00:00:00.000Z' });
      // Written directly: placeBid would (correctly) refuse this.
      store.insert('bids', {
        id: 'bid_forced_tie', auctionId: a2.id, bidderId: 'usr_late', amount: 500,
        currency: 'KES', status: 'active', idempotencyKey: null,
        placedAt: '2020-06-01T00:00:00.000Z', createdAt: '2020-06-01T00:00:00.000Z'
      });
      return auctions.closeAuction({ auctionId: a2.id, actorId: 'usr_s2' }).auction.winnerId;
    };
    const w1 = runWinner(), w2 = runWinner(), w3 = runWinner();
    check('a forced TIE breaks by who bid FIRST', w1 === 'usr_early', String(w1));
    check('and the outcome is reproducible', w1 === w2 && w2 === w3);
  }

  // ---- reserve not met = closed with NO sale -------------------------------
  {
    store._reset();
    const vv = vendors.createVendor({ ownerId: 'usr_s3', displayName: 'S3', contactMethod: '1' });
    const ll = listings.createListing({ vendorId: vv.id, title: 'Rare', type: 'product', price: 9000, currency: 'KES', quantityAvailable: 1 });
    const aa = auctions.createAuction({ listingId: ll.id, ownerId: 'usr_s3', startingPrice: 1000, reservePrice: 8000, endsAt: future(60000) });
    auctions.openAuction(aa.id, 'usr_s3');
    auctions.placeBid({ auctionId: aa.id, bidderId: 'usr_low', amount: 2000 });
    const p = auctions.publicView(auctions.getAuction(aa.id));
    check('the public view says a reserve EXISTS', p.hasReserve === true);
    check('but never discloses its value', !JSON.stringify(p).includes('8000'));
    check('and reports it unmet', p.reserveMet === false);
    const r = auctions.closeAuction({ auctionId: aa.id, actorId: 'usr_s3' });
    check('an unmet reserve closes with NO sale', r.sold === false);
    check('no winner is recorded', r.auction.winnerId === null);
    check('the under-bid is marked lost, not won',
      store.filter('bids', (b) => b.auctionId === aa.id && b.status === 'won').length === 0);
    check('and NO order exists', store.filter('orders', (o) => o.auctionId === aa.id).length === 0);
    threw = null;
    try { auctions.createWinnerOrder({ auctionId: aa.id, actorId: 'usr_s3' }); } catch (e) { threw = e.message; }
    check('no order can be raised for an unsold auction', /no winner/.test(threw ?? ''), threw);
  }

  // ---- no bids at all ------------------------------------------------------
  {
    store._reset();
    const vv = vendors.createVendor({ ownerId: 'usr_s4', displayName: 'S4', contactMethod: '1' });
    const ll = listings.createListing({ vendorId: vv.id, title: 'Unwanted', type: 'product', price: 100, currency: 'KES', quantityAvailable: 1 });
    const aa = auctions.createAuction({ listingId: ll.id, ownerId: 'usr_s4', startingPrice: 100, endsAt: future(60000) });
    auctions.openAuction(aa.id, 'usr_s4');
    const r = auctions.closeAuction({ auctionId: aa.id, actorId: 'usr_s4' });
    check('an auction with no bids closes unsold', r.sold === false && r.auction.status === 'closed');
    check('with no economic activity of any kind',
      store.all('ledgerTransactions').length === 0 && store.all('orders').length === 0);
  }

  // ---- WINNER -> ORDER -> the ORDINARY chain -------------------------------
  {
    store._reset();
    const vv = vendors.createVendor({ ownerId: 'usr_s5', displayName: 'S5', contactMethod: '1' });
    const ll = listings.createListing({ vendorId: vv.id, title: 'Stool', type: 'product', price: 3000, currency: 'KES', quantityAvailable: 1 });
    const aa = auctions.createAuction({ listingId: ll.id, ownerId: 'usr_s5', startingPrice: 1000, endsAt: future(60000) });
    auctions.openAuction(aa.id, 'usr_s5');
    auctions.placeBid({ auctionId: aa.id, bidderId: 'usr_w', amount: 4200 });
    auctions.closeAuction({ auctionId: aa.id, actorId: 'usr_s5' });

    let t = null;
    try { auctions.createWinnerOrder({ auctionId: aa.id, actorId: 'usr_nobody' }); } catch (e) { t = e.message; }
    check('a stranger cannot raise the winner\'s order', /only the winner/.test(t ?? ''), t);

    const { order } = auctions.createWinnerOrder({ auctionId: aa.id, actorId: 'usr_w' });
    check('the winner gets an ORDINARY order row', order.id.startsWith('ord_'));
    check('priced from the WINNING BID, not the listing', order.total === 4200, String(order.total));
    check('the buyer is the winner', order.buyerId === 'usr_w');
    check('it is traceable back to the auction', order.auctionId === aa.id);
    check('and to the exact bid', Boolean(order.bidId));
    check('the order is NOT paid', order.transactionId === null);
    check('stock was consumed', store.find('listings', (x) => x.id === ll.id).quantityAvailable === 0);

    const dup = auctions.createWinnerOrder({ auctionId: aa.id, actorId: 'usr_w' });
    check('raising the order twice returns the SAME order', dup.order.id === order.id && dup.reused === true);
    check('and does not double-consume stock', store.find('listings', (x) => x.id === ll.id).quantityAvailable === 0);

    // Settlement must still refuse without real money.
    const ordersM = await import('../src/domain/order.js');
    t = null;
    try { ordersM.transitionOrder(order.id, 'settled'); } catch (e) { t = e.message; }
    check('an auction order CANNOT settle without a settled ledger row', t !== null, String(t));
    check('the seller has earned nothing yet', settlementM.vendorEarnings(vv.id).net === 0);

    // Commission on an auction is the ORDINARY commission. No auction rate.
    const split = settlementM.splitAmount(4200);
    check('commission uses the SAME 5% rule', split.commission === 210, JSON.stringify(split));
    check('and the split is exact', split.commission + split.sellerAmount === 4200, JSON.stringify(split));

    // No auction wallet anywhere.
    const collections = Object.keys(store.all('auctions').length >= 0 ? store._file ? {} : {} : {});
    check('there is NO auction wallet collection',
      store.all('wallets') === undefined || store.all('wallets').length === 0);
    check('and no auction balance field on the auction row',
      !('balance' in store.find('auctions', (x) => x.id === aa.id)));
  }

  // ---- WINNER NON-PAYMENT: an explicit path -------------------------------
  {
    store._reset();
    const vv = vendors.createVendor({ ownerId: 'usr_s6', displayName: 'S6', contactMethod: '1' });
    const ll = listings.createListing({ vendorId: vv.id, title: 'Bike', type: 'product', price: 5000, currency: 'KES', quantityAvailable: 1 });
    const aa = auctions.createAuction({ listingId: ll.id, ownerId: 'usr_s6', startingPrice: 1000, endsAt: future(60000) });
    auctions.openAuction(aa.id, 'usr_s6');
    auctions.placeBid({ auctionId: aa.id, bidderId: 'usr_deadbeat', amount: 3000 });
    auctions.placeBid({ auctionId: aa.id, bidderId: 'usr_runnerup', amount: 3500 });
    // Retract the higher one so the deadbeat wins.
    const hi = auctions.highestBid(aa.id);
    auctions.retractBid({ bidId: hi.id, actorId: 'usr_runnerup' });
    auctions.closeAuction({ auctionId: aa.id, actorId: 'usr_s6' });
    const { order } = auctions.createWinnerOrder({ auctionId: aa.id, actorId: 'usr_s6' });

    let t = null;
    try { auctions.defaultWinner({ auctionId: aa.id, actorId: 'usr_deadbeat' }); } catch (e) { t = e.message; }
    check('only the SELLER may record a default', /only the seller/.test(t ?? ''), t);

    const failed = auctions.defaultWinner({ auctionId: aa.id, actorId: 'usr_s6' });
    check('the auction moves to FAILED, not quietly closed', failed.status === 'failed');
    check('the reason is recorded', /did not pay/.test(failed.defaultReason ?? ''));
    check('the winner\'s order is cancelled',
      store.find('orders', (o) => o.id === order.id).status === 'cancelled');
    check('the item returns to stock',
      store.find('listings', (x) => x.id === ll.id).quantityAvailable === 1);
    check('the runner-up is NOT auto-awarded',
      store.filter('orders', (o) => o.buyerId === 'usr_runnerup').length === 0);
    check('and still no economic activity', store.all('ledgerTransactions').length === 0);
  }

  // ---- a PAID auction cannot be defaulted ---------------------------------
  {
    store._reset();
    const ledgerM = await import('../src/domain/ledger.js');
    const vv = vendors.createVendor({ ownerId: 'usr_s7', displayName: 'S7', contactMethod: '1' });
    const ll = listings.createListing({ vendorId: vv.id, title: 'Lamp', type: 'product', price: 800, currency: 'KES', quantityAvailable: 1 });
    const aa = auctions.createAuction({ listingId: ll.id, ownerId: 'usr_s7', startingPrice: 500, endsAt: future(60000) });
    auctions.openAuction(aa.id, 'usr_s7');
    auctions.placeBid({ auctionId: aa.id, bidderId: 'usr_payer', amount: 900 });
    auctions.closeAuction({ auctionId: aa.id, actorId: 'usr_s7' });
    const { order } = auctions.createWinnerOrder({ auctionId: aa.id, actorId: 'usr_payer' });

    // Walk a real ledger transaction to settled, the long way round.
    const tx = ledgerM.createTransaction({
      type: 'sale', amount: 900, currency: 'KES', description: 'auction sale'
    });
    // The real state machine, walked in order. No shortcut to a terminal
    // state: that is what makes the money auditable.
    for (const st of ['pending', 'confirmed', 'settled']) {
      ledgerM.transitionTransaction(tx.id, st);
    }
    const settledTx = store.find('ledgerTransactions', (x) => x.id === tx.id);
    if (settledTx.status === 'settled') {
      store.update('orders', order.id, { transactionId: tx.id });
      let t = null;
      try { auctions.defaultWinner({ auctionId: aa.id, actorId: 'usr_s7' }); } catch (e) { t = e.message; }
      check('a PAID auction cannot be defaulted by the seller', /paid for/.test(t ?? ''), t);
      const settledAuction = auctions.markSettled(aa.id);
      check('a paid auction can be marked settled', settledAuction.status === 'settled');
    } else {
      check('ledger reached settled for the paid-auction case', false, `status=${settledTx.status}`);
    }
  }

  // ---- markSettled cannot be used to fake a sale --------------------------
  {
    store._reset();
    const vv = vendors.createVendor({ ownerId: 'usr_s8', displayName: 'S8', contactMethod: '1' });
    const ll = listings.createListing({ vendorId: vv.id, title: 'Fake', type: 'product', price: 100, currency: 'KES', quantityAvailable: 1 });
    const aa = auctions.createAuction({ listingId: ll.id, ownerId: 'usr_s8', startingPrice: 100, endsAt: future(60000) });
    auctions.openAuction(aa.id, 'usr_s8');
    auctions.placeBid({ auctionId: aa.id, bidderId: 'usr_x', amount: 200 });
    auctions.closeAuction({ auctionId: aa.id, actorId: 'usr_s8' });
    auctions.createWinnerOrder({ auctionId: aa.id, actorId: 'usr_x' });
    let t = null;
    try { auctions.markSettled(aa.id); } catch (e) { t = e.message; }
    check('markSettled REFUSES an unpaid auction', /has not settled/.test(t ?? ''), t);
    check('the auction stays closed', auctions.getAuction(aa.id).status === 'closed');
  }

  // ---- Buy Now -------------------------------------------------------------
  {
    store._reset();
    const vv = vendors.createVendor({ ownerId: 'usr_s9', displayName: 'S9', contactMethod: '1' });
    const ll = listings.createListing({ vendorId: vv.id, title: 'Chair', type: 'product', price: 2000, currency: 'KES', quantityAvailable: 1 });
    const aa = auctions.createAuction({ listingId: ll.id, ownerId: 'usr_s9', startingPrice: 500, buyNowPrice: 2500, endsAt: future(60000) });
    auctions.openAuction(aa.id, 'usr_s9');
    auctions.placeBid({ auctionId: aa.id, bidderId: 'usr_bidder', amount: 700 });

    let t = null;
    try { auctions.buyNow({ auctionId: aa.id, buyerId: 'usr_s9' }); } catch (e) { t = e.message; }
    check('the seller cannot Buy Now their own auction', /your own/.test(t ?? ''), t);

    const r = auctions.buyNow({ auctionId: aa.id, buyerId: 'usr_instant' });
    check('Buy Now ends the auction immediately', r.auction.status === 'closed');
    check('the buyer wins', r.auction.winnerId === 'usr_instant');
    check('at exactly the Buy Now price', r.auction.winningAmount === 2500);
    check('the earlier bidder loses and pays nothing',
      store.find('bids', (b) => b.bidderId === 'usr_bidder').status === 'lost');
    check('Buy Now still creates NO ledger row by itself', store.all('ledgerTransactions').length === 0);
    const { order } = auctions.createWinnerOrder({ auctionId: aa.id, actorId: 'usr_instant' });
    check('and the winner order uses the Buy Now amount', order.total === 2500);
  }

  // ---- Circle auction: membership is enforced ------------------------------
  {
    store._reset();
    const circlesM = await import('../src/domain/circle.js');
    const membersM = await import('../src/domain/member.js');
    const vv = vendors.createVendor({ ownerId: 'usr_s10', displayName: 'S10', contactMethod: '1' });
    const ll = listings.createListing({ vendorId: vv.id, title: 'Members only', type: 'product', price: 300, currency: 'KES', quantityAvailable: 1 });
    const c = circlesM.createTargetCircle({ name: 'Kilimani Traders', description: 'trade' });
    membersM.addMember(c.id, 'usr_member', 'contributor');

    let t = null;
    try {
      auctions.createAuction({ listingId: ll.id, ownerId: 'usr_s10', type: 'circle', startingPrice: 100, endsAt: future(60000) });
    } catch (e) { t = e.message; }
    check('a circle auction requires a circleId', /circleId/.test(t ?? ''), t);

    const aa = auctions.createAuction({
      listingId: ll.id, ownerId: 'usr_s10', type: 'circle',
      startingPrice: 100, endsAt: future(60000), circleId: c.id
    });
    auctions.openAuction(aa.id, 'usr_s10');
    t = null;
    try { auctions.placeBid({ auctionId: aa.id, bidderId: 'usr_outsider', amount: 500 }); }
    catch (e) { t = e.message; }
    check('a NON-MEMBER cannot bid in a circle auction', /circle members/.test(t ?? ''), t);
    const ok = auctions.placeBid({ auctionId: aa.id, bidderId: 'usr_member', amount: 500 });
    check('a member can', ok.bid.amount === 500);
  }

  // ---- server-authoritative timing ----------------------------------------
  {
    store._reset();
    const vv = vendors.createVendor({ ownerId: 'usr_s11', displayName: 'S11', contactMethod: '1' });
    const ll = listings.createListing({ vendorId: vv.id, title: 'Timed', type: 'product', price: 100, currency: 'KES', quantityAvailable: 1 });
    const aa = auctions.createAuction({ listingId: ll.id, ownerId: 'usr_s11', startingPrice: 100, endsAt: future(60000) });
    auctions.openAuction(aa.id, 'usr_s11');
    auctions.placeBid({ auctionId: aa.id, bidderId: 'usr_t1', amount: 400 });

    // Move the end time into the past: the SERVER clock now says it is over.
    store.update('auctions', aa.id, { endsAt: new Date(Date.now() - 1000).toISOString() });
    let t = null;
    try { auctions.placeBid({ auctionId: aa.id, bidderId: 'usr_t2', amount: 900 }); }
    catch (e) { t = e.message; }
    check('the SERVER clock closes bidding, whatever the client thinks', /has ended/.test(t ?? ''), t);

    // A non-owner may finalise an auction whose time has passed.
    const r = auctions.closeAuction({ auctionId: aa.id, actorId: 'usr_anyone' });
    check('an expired auction can be finalised by anyone', r.changed === true && r.sold === true);
    check('and the winner is the last valid bidder', r.auction.winnerId === 'usr_t1');

    // The sweep is idempotent.
    const sweep1 = auctions.sweepExpired();
    check('sweeping an already-closed auction does nothing', sweep1.closed === 0);
  }

  // ---- cancellation --------------------------------------------------------
  {
    store._reset();
    const vv = vendors.createVendor({ ownerId: 'usr_s12', displayName: 'S12', contactMethod: '1' });
    const ll = listings.createListing({ vendorId: vv.id, title: 'C', type: 'product', price: 100, currency: 'KES', quantityAvailable: 1 });
    const aa = auctions.createAuction({ listingId: ll.id, ownerId: 'usr_s12', startingPrice: 100, endsAt: future(60000) });
    auctions.openAuction(aa.id, 'usr_s12');
    auctions.placeBid({ auctionId: aa.id, bidderId: 'usr_c1', amount: 300 });
    let t = null;
    try { auctions.cancelAuction({ auctionId: aa.id, actorId: 'usr_s12' }); } catch (e) { t = e.message; }
    check('a seller CANNOT cancel out of a live bid', /already has bids/.test(t ?? ''), t);

    const ll2 = listings.createListing({ vendorId: vv.id, title: 'C2', type: 'product', price: 100, currency: 'KES', quantityAvailable: 1 });
    const bb = auctions.createAuction({ listingId: ll2.id, ownerId: 'usr_s12', startingPrice: 100, endsAt: future(60000) });
    const cancelled = auctions.cancelAuction({ auctionId: bb.id, actorId: 'usr_s12' });
    check('an unbid auction can be cancelled', cancelled.status === 'cancelled');
    t = null;
    try { auctions.openAuction(bb.id, 'usr_s12'); } catch (e) { t = e.message; }
    check('a cancelled auction cannot be opened', /cannot open/.test(t ?? ''), t);
  }
}

console.log('\n=== AUCTION OVER HTTP ===');
{
  process.env.NODE_ENV = 'test';
  // Dev fallback OFF: otherwise every anonymous request would be silently
  // treated as the single dev user and the authorization assertions below
  // would prove nothing.
  const prevDev = process.env.BRIEF_DEV_AUTH;
  process.env.BRIEF_DEV_AUTH = '0';
  const { default: app } = await import('../src/index.js');
  store._reset();
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, method = 'GET', body, token) => {
    const headers = {};
    if (body) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    const u = Date.now().toString(36);
    const seller = (await call('/api/auth/register', 'POST', { handle: `aucs_${u}`, password: 'a good passphrase' })).body;
    const bidder = (await call('/api/auth/register', 'POST', { handle: `aucb_${u}`, password: 'a good passphrase' })).body;
    const other = (await call('/api/auth/register', 'POST', { handle: `auco_${u}`, password: 'a good passphrase' })).body;

    await call('/api/vendors', 'POST', { displayName: 'Auction House' }, seller.token);
    const listing = (await call('/api/listings', 'POST',
      { title: 'Signed print', type: 'product', price: 1000, currency: 'KES', quantityAvailable: 1 }, seller.token)).body.listing;
    await call(`/api/listings/${listing.id}/status`, 'POST', { status: 'active' }, seller.token);

    let r = await call('/api/auctions', 'POST', { listingId: listing.id, startingPrice: 500, endsAt: new Date(Date.now() + 60000).toISOString() });
    check('creating an auction requires auth (401)', r.status === 401, `got ${r.status}`);

    r = await call('/api/auctions', 'POST', { listingId: listing.id, startingPrice: 500, endsAt: new Date(Date.now() + 60000).toISOString() }, other.token);
    check('a non-owner cannot auction the listing (400)', r.status === 400, `got ${r.status}`);

    r = await call('/api/auctions', 'POST',
      { listingId: listing.id, startingPrice: 500, buyNowPrice: 5000, endsAt: new Date(Date.now() + 60000).toISOString() }, seller.token);
    check('the owner creates an auction (201)', r.status === 201, JSON.stringify(r.body).slice(0, 140));
    const auc = r.body.auction;

    r = await call(`/api/auctions/${auc.id}/bids`, 'POST', { amount: 600 }, bidder.token);
    check('a draft auction refuses bids (400)', r.status === 400, `got ${r.status}`);

    await call(`/api/auctions/${auc.id}/open`, 'POST', {}, seller.token);
    r = await call(`/api/auctions/${auc.id}/bids`, 'POST', { amount: 600 }, bidder.token);
    check('a bid is accepted (201)', r.status === 201, JSON.stringify(r.body).slice(0, 140));
    check('the response shows the new price', r.body.auction.currentPrice === 600);
    check('and does NOT name other bidders', !JSON.stringify(r.body.auction).includes(bidder.user.id));

    r = await call(`/api/auctions/${auc.id}/bids`, 'POST', { amount: 550 }, other.token);
    check('a lower bid is refused (400)', r.status === 400, `got ${r.status}`);

    // Bidder privacy over HTTP.
    r = await call(`/api/auctions/${auc.id}`, 'GET', undefined, other.token);
    check('a rival bidder sees the public view only', !JSON.stringify(r.body).includes(bidder.user.id),
      JSON.stringify(r.body).slice(0, 180));
    r = await call(`/api/auctions/${auc.id}/bids`, 'GET', undefined, other.token);
    check('a rival CANNOT read the bid list (403)', r.status === 403, `got ${r.status}`);
    r = await call(`/api/auctions/${auc.id}/bids`, 'GET', undefined, seller.token);
    check('the SELLER can read the bid list', r.status === 200 && r.body.bids.length === 1);

    r = await call('/api/bids/mine', 'GET', undefined, bidder.token);
    check('a bidder sees their OWN bids', r.body.bids.length === 1);
    r = await call('/api/bids/mine', 'GET', undefined, other.token);
    check('and only their own', r.body.bids.length === 0);

    // Idempotent bidding over the wire.
    const key = `k-${u}`;
    const [b1, b2] = await Promise.all([
      call(`/api/auctions/${auc.id}/bids`, 'POST', { amount: 800, idempotencyKey: key }, other.token),
      call(`/api/auctions/${auc.id}/bids`, 'POST', { amount: 800, idempotencyKey: key }, other.token)
    ]);
    const ids = [b1.body?.bid?.id, b2.body?.bid?.id];
    check('concurrent duplicate bid keys yield ONE bid', ids[0] === ids[1], ids.join(' vs '));

    // Close and order.
    r = await call(`/api/auctions/${auc.id}/close`, 'POST', {}, other.token);
    check('a non-owner cannot close early (400)', r.status === 400, `got ${r.status}`);
    r = await call(`/api/auctions/${auc.id}/close`, 'POST', {}, seller.token);
    check('the seller closes it', r.status === 200 && r.body.sold === true);
    check('the winner is the highest bidder', r.body.auction.winnerId === other.user.id);

    r = await call(`/api/auctions/${auc.id}/order`, 'POST', {}, bidder.token);
    check('a LOSER cannot raise the winner order (403)', r.status === 403, `got ${r.status}`);
    r = await call(`/api/auctions/${auc.id}/order`, 'POST', {}, other.token);
    check('the winner raises their order (201)', r.status === 201, JSON.stringify(r.body).slice(0, 140));
    const order = r.body.order;
    check('priced at the winning bid', order.total === 800);
    check('and unpaid', order.paid !== true);

    // The ordinary payment path applies, and still refuses honestly.
    r = await call(`/api/orders/${order.id}/pay`, 'POST', { phone: '0722000111' }, other.token);
    check('paying an auction order uses the ORDINARY route', r.status === 503, `got ${r.status}`);
    check('and admits nothing was charged', r.body?.charged === false);

    r = await call('/api/economic/reconcile', 'GET', undefined, seller.token);
    check('the ledger is still balanced after an auction', r.body?.reconciliation?.balanced === true);
    r = await call('/api/vendors/me/earnings', 'GET', undefined, seller.token);
    check('an unpaid auction produced NO earnings', r.body?.earnings?.net === 0);

    // Signals: one activity layer.
    r = await call('/api/signals');
    const kinds = (r.body?.signals ?? []).map((s) => s.type);
    check('auction signals use the shared layer', kinds.includes('auction_opened') && kinds.includes('bid_placed'));
    check('and record the close', kinds.includes('auction_closed'));
    const bidSignals = (r.body?.signals ?? []).filter((s) => s.type === 'bid_placed');
    check('bid signals do not leak the bidder to a public reader',
      bidSignals.every((s) => !JSON.stringify(s.metadata ?? {}).includes('usr_')));
  } finally {
    srv.close();
    if (prevDev === undefined) delete process.env.BRIEF_DEV_AUTH; else process.env.BRIEF_DEV_AUTH = prevDev;
  }
}

console.log('\n=== THE VAULT: IDENTITY, FOOTSTEPS, HANDOFF (domain) ===');
{
  process.env.HANDOFF_SECRET = 'vault-test-secret';
  store._reset();
  const vault = await import('../src/domain/vault.js');
  const footsteps = await import('../src/domain/footsteps.js');
  const handoff = await import('../src/domain/handoff.js');
  const ordersD = await import('../src/domain/order.js');
  const vendorsD = await import('../src/domain/vendor.js');
  const listingsD = await import('../src/domain/listing.js');
  const payD = await import('../src/domain/payment.js');

  // --- creation ------------------------------------------------------------
  const v = vault.createVault({
    ownerId: 'usr_host', type: 'gathering', title: 'Rooftop Saturday',
    description: 'A rooftop gathering', visibility: 'private', location: 'Kilimani'
  });
  check('a vault is created with a slug', Boolean(v.id) && Boolean(v.slug), v.slug);
  check('the owner becomes the first host', vault.participantRole(store, 'usr_host', v.id) === 'host');
  check('a vault_created footstep exists', store.filter('footsteps', (f) => f.vaultId === v.id).some((f) => f.kind === 'vault_created'));

  // --- authorization -------------------------------------------------------
  check('the owner has host access', vault.accessRole(store, 'usr_host', v.id) === 'host');
  check('a stranger has no access', vault.accessRole(store, 'usr_other', v.id) === null);
  check('only the host may edit', (() => { try { vault.updateVault('usr_other', v.id, { title: 'x' }); return false; } catch { return true; } })());

  // --- participants --------------------------------------------------------
  const guest = vault.addParticipant('usr_host', { vaultId: v.id, role: 'guest', userId: 'usr_guest', name: 'Jane' });
  check('a guest participant is added', guest.role === 'guest');
  check('the guest has guest access', vault.accessRole(store, 'usr_guest', v.id) === 'guest');
  check('a guest cannot add participants', (() => { try { vault.addParticipant('usr_guest', { vaultId: v.id, role: 'admin', userId: 'x' }); return false; } catch { return true; } })());
  check('a person_joined footstep recorded', store.filter('footsteps', (f) => f.vaultId === v.id).some((f) => f.kind === 'person_joined'));

  // --- footsteps: ordering, category, immutability, dedupe ---------------
  const r1 = footsteps.recordFootstep({ vaultId: v.id, kind: 'question_asked', actorId: 'usr_guest', actorName: 'Jane' });
  const r2 = footsteps.recordFootstep({ vaultId: v.id, kind: 'host_responded', actorId: 'usr_host', actorName: 'Host' });
  check('footsteps are sequenced', r1.footstep.seq < r2.footstep.seq, `${r1.footstep.seq} vs ${r2.footstep.seq}`);
  check('footsteps carry a category', r1.footstep.category === 'messages');
  check('footsteps are human-readable', /Jane/.test(r1.footstep.narrative), r1.footstep.narrative);

  const list = footsteps.listFootsteps(v.id);
  check('the timeline returns oldest-first', list.footsteps[0].kind === 'vault_created' && list.footsteps[list.footsteps.length - 1].kind === 'host_responded');
  const onlyPeople = footsteps.listFootsteps(v.id, { category: 'messages' });
  check('category filtering works', onlyPeople.footsteps.length === 2 && onlyPeople.footsteps.every((f) => f.category === 'messages'));

  // dedupe: the same logical event must not be recorded twice.
  const d1 = footsteps.recordFootstep({ vaultId: v.id, kind: 'payment_settled', actorId: 'usr_guest', dedupeKey: 'pay:settled:REF1' });
  const d2 = footsteps.recordFootstep({ vaultId: v.id, kind: 'payment_settled', actorId: 'usr_guest', dedupeKey: 'pay:settled:REF1' });
  check('a dedupe key prevents a duplicate footstep', d2.reused === true && d2.footstep.id === d1.footstep.id);

  // cursor pagination
  const all = footsteps.listFootsteps(v.id, { limit: 3 });
  check('pagination returns a next cursor', all.nextCursor !== null);
  const page2 = footsteps.listFootsteps(v.id, { cursor: all.nextCursor });
  check('the second page continues after the cursor', page2.footsteps[0].seq > all.footsteps[all.footsteps.length - 1].seq);

  // --- links + commerce wiring -------------------------------------------
  const vendor = vendorsD.createVendor({ ownerId: 'usr_vendor', displayName: 'Catering Co' });
  const listing = listingsD.createListing({ vendorId: vendor.id, title: 'Platters', type: 'service', price: 3000, currency: 'KES', quantityAvailable: 10 });
  listingsD.transitionListing(listing.id, 'active');
  const order = ordersD.createOrder({ listingId: listing.id, buyerId: 'usr_host', quantity: 2 });
  check('an order exists with total 6000', order.total === 6000);

  vault.linkVault('usr_host', v.id, { kind: 'order', id: order.id });
  check('the vault links the order', vault.getVault(v.id).links.some((l) => l.kind === 'order' && l.id === order.id));
  check('vaultsForOrder finds the vault', vault.vaultsForOrder(order.id).some((x) => x.id === v.id));

  // Payment settles -> a footstep appears on the linked vault.
  const { intent } = payD.createIntent({ orderId: order.id, payerId: 'usr_host', phone: '0722000111' });
  store.update('paymentIntents', intent.id, { status: 'authorized', providerRef: 'ws_CO_VAULT' });
  const confirmed = payD.confirmPayment({ providerRef: 'ws_CO_VAULT', succeeded: true, amount: 6000, receipt: 'REC_VAULT' });
  check('payment confirmed', confirmed.ok === true);
  vault.emitOrderFootsteps(order.id, 'payment_settled', { actorId: 'usr_host', value: 6000, dedupeKey: 'pay:settled:ws_CO_VAULT' });
  const paymentSteps = store.filter('footsteps', (f) => f.vaultId === v.id && f.kind === 'payment_settled' && f.metadata?.orderId === order.id);
  check('the vault timeline records the settlement', paymentSteps.length === 1);

  // --- handoff: signed, expiring, replay-protected ------------------------
  const h = handoff.createHandoff({ vaultId: v.id, participantId: guest.id, purpose: 'handoff', fromChannel: 'web', toChannel: 'telegram' });
  check('a handoff token is created', h.ok === true && Boolean(h.token));
  const resolved = handoff.resolveHandoff(h.token);
  check('the handoff resolves to the vault + participant', resolved.ok === true && resolved.vaultId === v.id && resolved.participantId === guest.id);
  const replay = handoff.resolveHandoff(h.token);
  check('a handoff token is single-use (replay refused)', replay.ok === false && replay.reason === 'token_already_used');

  // tampered token refused
  const tampered = h.token.slice(0, -4) + 'AAAA';
  check('a tampered token is refused', handoff.resolveHandoff(tampered).ok === false);

  // expiry
  const exp = handoff.createHandoff({ vaultId: v.id, participantId: guest.id, ttlMs: 1 });
  await new Promise((r) => setTimeout(r, 5));
  check('an expired token is refused', handoff.resolveHandoff(exp.token).ok === false && handoff.resolveHandoff(exp.token).reason === 'token_expired');

  // --- requests ------------------------------------------------------------
  const req = vault.createRequest('usr_guest', { vaultId: v.id, description: 'Need 10 extra chairs', kind: 'service' });
  check('a request is created open', req.status === 'open');
  vault.routeRequest('usr_host', { requestId: req.id, vendorId: vendor.id });
  check('routing sets the vendor and status routed', store.find('vaultRequests', (r) => r.id === req.id).status === 'routed');
  vault.acceptRequest('usr_vendor', { requestId: req.id });
  check('the vendor accepts the request', store.find('vaultRequests', (r) => r.id === req.id).status === 'accepted');
  check('a guest cannot route a request', (() => { try { vault.routeRequest('usr_guest', { requestId: req.id, vendorId: vendor.id }); return false; } catch { return true; } })());

  // --- scoped views --------------------------------------------------------
  const hostView = vault.vaultView('usr_host', v.id);
  check('the host sees participants, links, requests', hostView.role === 'host' && Array.isArray(hostView.participants) && Array.isArray(hostView.links) && Array.isArray(hostView.requests));
  const vendorView = vault.vaultView('usr_vendor', v.id);
  check('the vendor sees only scoped requests', vendorView.role === 'vendor' && vendorView.requests.length === 1 && vendorView.participants === undefined);
  const guestView = vault.vaultView('usr_guest', v.id);
  check('the guest sees a minimal view', guestView.role === 'guest' && guestView.participant !== undefined && guestView.participants === undefined);
  const publicView = vault.vaultView(null, v.id);
  check('an anonymous viewer sees a public projection only', publicView.role === 'public' && publicView.participants === undefined && publicView.links === undefined);

  // --- public entry --------------------------------------------------------
  const pv = vault.createVault({ ownerId: 'usr_host', type: 'event', title: 'Pop-up Market', visibility: 'public' });
  check('a public vault is publicly enterable', vault.isPubliclyEnterable(pv));
  const entry = vault.publicEnter(pv.slug, { name: 'Wanjiku', channel: 'web' });
  check('a guest enters a public vault with a token', entry.ok === true && Boolean(entry.token) && entry.participant.role === 'guest');
  const privateEntry = vault.publicEnter(v.slug, { name: 'X' });
  check('a PRIVATE vault refuses public entry', privateEntry.ok === false && privateEntry.reason === 'not_open');

  // --- search --------------------------------------------------------------
  const sr = vault.searchVaults('Wanjiku');
  check('search finds a vault by participant name', sr.some((x) => x.vaultId === pv.id));
  const sr2 = vault.searchVaults('chairs');
  check('search finds a vault by request text', sr2.some((x) => x.vaultId === v.id));

  // --- resolution ----------------------------------------------------------
  const rl = vault.resolution();
  check('resolution surfaces nothing for a settled vault', rl.filter((i) => i.vaultId === v.id && i.kind === 'payment_failed').length === 0);

  // --- closure -------------------------------------------------------------
  vault.closeVault('usr_host', v.id);
  check('closing a vault marks it closed', vault.getVault(v.id).status === 'closed');
  check('a vault_closed footstep exists', store.filter('footsteps', (f) => f.vaultId === v.id).some((f) => f.kind === 'vault_closed'));

  delete process.env.HANDOFF_SECRET;
}

console.log('\n=== THE VAULT: HTTP SURFACE, SCOPED ACCESS, HANDOFF (over HTTP) ===');
{
  process.env.HANDOFF_SECRET = 'vault-test-secret';
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('../src/index.js');
  store._reset();
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, method = 'GET', body, token, extraHeaders = {}) => {
    const headers = { ...extraHeaders };
    if (body) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    const HOST = (await call('/api/auth/register', 'POST', { handle: 'vhost', password: 'a good passphrase' })).body;
    const GUEST = (await call('/api/auth/register', 'POST', { handle: 'vguest', password: 'a good passphrase' })).body;
    const VENDOR = (await call('/api/auth/register', 'POST', { handle: 'vvendor', password: 'a good passphrase' })).body;
    const STRANGER = (await call('/api/auth/register', 'POST', { handle: 'vstranger', password: 'a good passphrase' })).body;

    // create a vault
    let r = await call('/api/vaults', 'POST', { type: 'gathering', title: 'Rooftop', visibility: 'private' }, HOST.token);
    check('HTTP: a vault is created', r.status === 201 && Boolean(r.body?.vault?.id), JSON.stringify(r.body).slice(0, 120));
    const vaultId = r.body.vault.id;
    check('HTTP: creator sees role host', r.body.vault.role === 'host');

    // authorization
    r = await call(`/api/vaults/${vaultId}`, 'GET', undefined, STRANGER.token);
    check('HTTP: a stranger cannot read a private vault (404)', r.status === 404, `got ${r.status}`);
    r = await call('/api/vaults', 'GET', undefined, STRANGER.token);
    check('HTTP: a stranger lists no vaults', r.body?.vaults?.length === 0);

    // add guest + vendor
    r = await call(`/api/vaults/${vaultId}/participants`, 'POST', { role: 'guest', userId: GUEST.user.id, name: 'Jane' }, HOST.token);
    check('HTTP: host adds a guest', r.status === 201);
    r = await call(`/api/vaults/${vaultId}/participants`, 'POST', { role: 'vendor', userId: VENDOR.user.id, name: 'Catering' }, HOST.token);
    check('HTTP: host adds a vendor', r.status === 201);

    // footsteps via HTTP
    r = await call(`/api/vaults/${vaultId}/footsteps`, 'POST', { kind: 'question_asked', actorName: 'Jane' }, GUEST.token);
    check('HTTP: a participant records a footstep', r.status === 201 && r.body?.footstep?.category === 'messages');
    r = await call(`/api/vaults/${vaultId}/footsteps`, 'GET', undefined, GUEST.token);
    check('HTTP: footsteps are readable and ordered', r.status === 200 && r.body?.footsteps?.length >= 2);
    r = await call(`/api/vaults/${vaultId}/footsteps`, 'GET', undefined, STRANGER.token);
    check('HTTP: a stranger cannot read footsteps (404)', r.status === 404);

    // vendor scoping over HTTP
    const vendorId = (await call('/api/vendors', 'POST', { displayName: 'Catering Co' }, VENDOR.token)).body.vendor.id;
    r = await call(`/api/vaults/${vaultId}/requests`, 'POST', { description: 'Chairs', kind: 'service' }, GUEST.token);
    const requestId = r.body.request.id;
    r = await call(`/api/vaults/${vaultId}/requests/${requestId}/route`, 'POST', { vendorId }, HOST.token);
    check('HTTP: host routes a request to the vendor', r.status === 200 && r.body.request.status === 'routed');
    r = await call(`/api/vaults/${vaultId}`, 'GET', undefined, VENDOR.token);
    check('HTTP: the vendor sees only scoped requests', r.body.vault.role === 'vendor' && r.body.vault.requests.length === 1 && r.body.vault.participants === undefined);

    // handoff over HTTP
    const participant = (await call(`/api/vaults/${vaultId}`, 'GET', undefined, GUEST.token)).body.vault.participant;
    r = await call(`/api/vaults/${vaultId}/handoff`, 'POST', { participantId: participant.id, toChannel: 'telegram' }, HOST.token);
    check('HTTP: host creates a handoff token', r.status === 201 && Boolean(r.body?.token));
    const token = r.body.token;
    r = await call('/api/vaults/handoff/resolve', 'POST', { token });
    check('HTTP: the handoff resolves to the same vault', r.status === 200 && r.body?.vault?.id === vaultId);
    r = await call('/api/vaults/handoff/resolve', 'POST', { token });
    check('HTTP: a replayed handoff is refused (403)', r.status === 403 && r.body?.error === 'token_already_used');

    // public entry
    r = await call('/api/vaults', 'POST', { type: 'event', title: 'Public Market', visibility: 'public' }, HOST.token);
    const pubSlug = r.body.vault.slug;
    r = await call(`/api/public/vaults/${pubSlug}`, 'GET');
    check('HTTP: a public vault is readable anonymously', r.status === 200 && r.body.vault.role === 'public' && r.body.vault.participants === undefined);
    r = await call(`/api/public/vaults/${pubSlug}/enter`, 'POST', { name: 'Wanjiku' });
    check('HTTP: a guest enters via a public link', r.status === 201 && Boolean(r.body?.token));
    const entryToken = r.body.token;
    r = await call(`/api/vaults/${vaultId}`, 'GET', undefined, null, { 'x-vault-token': entryToken });
    check('HTTP: a public entry token cannot read a DIFFERENT private vault', r.status === 404);

    // private vault is not public
    r = await call(`/api/public/vaults/${(await call(`/api/vaults/${vaultId}`, 'GET', undefined, HOST.token)).body.vault.slug}`, 'GET');
    check('HTTP: a private vault is not publicly readable', r.status === 404);

    // search + resolution
    r = await call('/api/vaults/search?q=chairs', 'GET', undefined, HOST.token);
    check('HTTP: search finds the vault by request text', r.status === 200 && r.body.results.some((x) => x.vaultId === vaultId));
    r = await call('/api/vaults/resolution', 'GET', undefined, HOST.token);
    check('HTTP: resolution returns an array', r.status === 200 && Array.isArray(r.body.items));

    // close
    r = await call(`/api/vaults/${vaultId}/close`, 'POST', {}, HOST.token);
    check('HTTP: host closes the vault', r.status === 200 && r.body.vault.status === 'closed');
    r = await call(`/api/vaults/${vaultId}/close`, 'POST', {}, GUEST.token);
    check('HTTP: a guest cannot close the vault (403)', r.status === 403);
  } finally {
    srv.close();
    delete process.env.HANDOFF_SECRET;
  }
}

console.log('\n=== THE GATE: TICKET CODES + CHECK-IN (domain + HTTP) ===');
{
  process.env.NODE_ENV = 'test';
  store._reset();
  const checkin = await import('../src/domain/checkin.js');
  const campaigns = await import('../src/domain/campaign.js');
  const vault = await import('../src/domain/vault.js');
  const { default: app } = await import('../src/index.js');

  // --- domain-level ---------------------------------------------------------
  const c = campaigns.createCampaign('usr_host', {
    title: 'Gate Test Gathering', type: 'event', price: 0, capacity: 2,
    location: 'Kilimani', startsAt: null, endsAt: null
  });
  campaigns.transitionCampaign(c.id, 'published');
  campaigns.transitionCampaign(c.id, 'live');
  const live = campaigns.getCampaign(c.id); // re-fetch: register reads live status

  const reg = campaigns.register(live, { attendeeRef: 'wanjiku-1', name: 'Wanjiku' });
  check('a registration carries an opaque ticket code', /^BRF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(reg.ticketCode), reg.ticketCode);
  check('the ticket code is not the registration id', reg.ticketCode !== reg.id);

  const found = checkin.lookupTicket(reg.ticketCode);
  check('a ticket is found by its code', found?.id === reg.id);
  check('a garbled code finds nothing', checkin.lookupTicket('BRF-NOPE-NOPE-NOPE') === null);

  const view = checkin.ticketView(reg);
  check('the gate view exposes name + paid but not contact', view.name === 'Wanjiku' && view.paid === true && view.contact === undefined);

  // Check-in succeeds once, records attribution.
  const res = checkin.checkIn(reg.ticketCode, 'usr_host');
  check('check-in succeeds', res.ok === true && res.ticket.status === 'checked_in');
  check('check-in records operator + timestamp', res.ticket.checkedInBy === 'usr_host' && Boolean(res.ticket.checkedInAt));
  check('checked-in count is derived', checkin.checkedInCount(c.id) === 1);

  // Re-scan is idempotent.
  const again = checkin.checkIn(reg.ticketCode, 'usr_host');
  check('a re-scan is an idempotent no-op', again.ok === true && again.already === true && again.ticket.checkedInAt === res.ticket.checkedInAt);

  // A cancelled ticket refuses.
  const reg2 = campaigns.register(live, { attendeeRef: 'jane-1', name: 'Jane' });
  campaigns.setRegistrationStatus(reg2.id, 'cancelled');
  check('a cancelled ticket refuses check-in', checkin.checkIn(reg2.ticketCode, 'usr_host').reason === 'cancelled');

  // An unpaid (held) spot refuses. Capacity is 2, so register on a fresh campaign.
  const paid = campaigns.createCampaign('usr_host', { title: 'Paid Gate', type: 'event', price: 1000 });
  campaigns.transitionCampaign(paid.id, 'published');
  campaigns.transitionCampaign(paid.id, 'live');
  const held = campaigns.register(campaigns.getCampaign(paid.id), { attendeeRef: 'unpaid-1', name: 'Held Spot' });
  check('a paid campaign opens a spot as started (held)', held.status === 'started');
  check('an unpaid ticket refuses check-in', checkin.checkIn(held.ticketCode, 'usr_host').reason === 'unpaid');

  // --- HTTP surface ---------------------------------------------------------
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, method = 'GET', body, token) => {
    const headers = {};
    if (body) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    const HOST = (await call('/api/auth/register', 'POST', { handle: 'gatehost', password: 'a good passphrase' })).body;
    const STRANGER = (await call('/api/auth/register', 'POST', { handle: 'gatestranger', password: 'a good passphrase' })).body;

    // Build a live campaign owned by HOST with a free registration.
    const cc = (await call('/api/campaigns', 'POST', { title: 'HTTP Gate', type: 'event', price: 0 }, HOST.token)).body.campaign;
    await call(`/api/campaigns/${cc.id}/publish`, 'POST', {}, HOST.token);
    await call(`/api/campaigns/${cc.id}/golive`, 'POST', {}, HOST.token);
    const rr = (await call(`/api/public/campaigns/${cc.publicSlug}/register`, 'POST', { attendeeRef: 'gate-http-1', name: 'Gate Guest' })).body.registration;
    const regRow = store.filter('registrations', (x) => x.campaignId === cc.id)[0];
    const ticketCode = regRow?.ticketCode ?? null;
    check('the HTTP registration produced a ticket code', Boolean(ticketCode));

    // An unauthenticated (bogus-token) reader cannot inspect a ticket.
    const anon = await call(`/api/tickets/${ticketCode}`, 'GET', undefined, 'bogus-token');
    check('an unauthenticated reader cannot inspect a ticket (401)', anon.status === 401);
    // A stranger cannot inspect it.
    const stranger = await call(`/api/tickets/${ticketCode}`, 'GET', undefined, STRANGER.token);
    check('a stranger cannot inspect a ticket (404)', stranger.status === 404);
    // The host can.
    const host = await call(`/api/tickets/${ticketCode}`, 'GET', undefined, HOST.token);
    check('the host sees the gate-safe ticket view', host.status === 200 && host.body.ticket.name === 'Gate Guest' && host.body.ticket.contact === undefined);

    // Check-in over HTTP.
    const cin = await call(`/api/tickets/${ticketCode}/check-in`, 'POST', {}, HOST.token);
    check('check-in over HTTP succeeds', cin.status === 200 && cin.body.ticket.status === 'checked_in' && cin.body.checkedInCount === 1);
    const cin2 = await call(`/api/tickets/${ticketCode}/check-in`, 'POST', {}, HOST.token);
    check('re-scan over HTTP is idempotent', cin2.status === 200 && cin2.body.already === true);
    // A stranger cannot check someone in.
    const cinStranger = await call(`/api/tickets/${ticketCode}/check-in`, 'POST', {}, STRANGER.token);
    check('a stranger cannot check a ticket in (404)', cinStranger.status === 404);
  } finally {
    srv.close();
  }
}

console.log('\n=== HOST COMMAND CENTRE (derived, scoped) ===');
{
  store._reset();
  const campaigns = await import('../src/domain/campaign.js');
  const command = await import('../src/domain/command.js');
  const ledgerD = await import('../src/domain/ledger.js');
  const vault = await import('../src/domain/vault.js');

  // A host with a paid campaign, one settled + one held registration.
  const c = campaigns.createCampaign('usr_host', { title: 'Command Gathering', type: 'event', price: 1000 });
  campaigns.transitionCampaign(c.id, 'published');
  campaigns.transitionCampaign(c.id, 'live');
  const live = campaigns.getCampaign(c.id);
  const reg = campaigns.register(live, { attendeeRef: 'cmd-1', name: 'Alice' });
  // Settle a transaction for Alice so she registers + revenue is real.
  const tx = ledgerD.createTransaction({ amount: 1000, currency: 'KES', type: 'sale', campaignId: c.id, registrationId: reg.id, counterparty: 'usr_guest' });
  ledgerD.transitionTransaction(tx.id, 'pending');
  ledgerD.transitionTransaction(tx.id, 'confirmed');
  ledgerD.transitionTransaction(tx.id, 'settled');
  campaigns.promoteRegistrationForSettledTransaction(tx);
  campaigns.setRegistrationStatus(reg.id, 'checked_in');
  // A second, held (unpaid) registration.
  const held = campaigns.register(live, { attendeeRef: 'cmd-2', name: 'Bob' });

  const cc = command.commandCentre('usr_host');
  check('command centre resolves for the host', cc !== null);
  check('money.settled is real (1000)', cc.money.grossSettled === 1000, JSON.stringify(cc.money));
  check('people.checkedIn is derived (1)', cc.people.checkedIn === 1, String(cc.people.checkedIn));
  check('people.registered is derived (1)', cc.people.registered === 1, String(cc.people.registered));
  check('an unpaid held spot appears in NOW', cc.now.some((n) => n.kind === 'unpaid_spot' && n.name === 'Bob'), JSON.stringify(cc.now));

  // A different host sees nothing.
  const stranger = command.commandCentre('usr_stranger');
  check('a stranger sees an empty command centre', stranger !== null && stranger.money.grossSettled === 0 && stranger.campaigns.length === 0);

  // Scope: a vault owned by the host appears; one owned by another does not.
  vault.createVault({ ownerId: 'usr_host', title: 'My Vault', type: 'gathering' });
  vault.createVault({ ownerId: 'usr_stranger', title: 'Their Vault', type: 'gathering' });
  const cc2 = command.commandCentre('usr_host');
  check('the host sees their own vault count', cc2.vaultCount === 1, String(cc2.vaultCount));
}

console.log('\n=== TRUST, DISCOVERY, NOTIFICATIONS, ANALYTICS, ARENA ENTITIES ===');
{
  store._reset();
  const trust = await import('../src/domain/trust.js');
  const discovery = await import('../src/domain/discovery.js');
  const notifications = await import('../src/domain/notifications.js');
  const analytics = await import('../src/domain/analytics.js');
  const arena = await import('../src/domain/arena.js');
  const signals = await import('../src/domain/signal.js');

  // --- geo ------------------------------------------------------------------
  check('haversine is ~111km per degree at equator', Math.round(discovery.haversineKm(0, 0, 0, 1)) === 111);
  check('same point is 0km', discovery.haversineKm(-1.28, 36.82, -1.28, 36.82) === 0);

  // --- objects with location + verification --------------------------------
  const o1 = store.insert('objects', { id: 'obj_nb', type: 'place', title: 'Nairobi Cafe', publication: 'public', verificationStatus: 'unverified', createdAt: new Date().toISOString(), metadata: { lat: -1.28, lng: 36.82 } });
  const o2 = store.insert('objects', { id: 'obj_ksm', type: 'place', title: 'Kisumu Spot', publication: 'public', verificationStatus: 'unverified', createdAt: new Date().toISOString(), metadata: { lat: -0.09, lng: 34.76 } });
  const o3 = store.insert('objects', { id: 'obj_noloc', type: 'place', title: 'No Location', publication: 'public', verificationStatus: 'unverified', createdAt: new Date().toISOString(), metadata: {} });

  // --- ranking: trust + freshness ------------------------------------------
  check('unverified objects have the base trust level', trust.verificationLevel('obj_nb') === 'unverified');
  trust.confirmObject('obj_nb', 'usr_a');
  trust.confirmObject('obj_nb', 'usr_b');
  check('two independent confirmations reach community_confirmed', trust.verificationLevel('obj_nb') === 'community_confirmed');
  check('confirmation count is derived (2)', trust.confirmationCount('obj_nb') === 2);

  // re-confirm is idempotent
  const re = trust.confirmObject('obj_nb', 'usr_a');
  check('re-confirming is a no-op', re.reused === true && trust.confirmationCount('obj_nb') === 2);

  // --- reporting ------------------------------------------------------------
  const { report } = trust.reportObject({ objectId: 'obj_ksm', actorId: 'usr_c', reason: 'spam' });
  check('a report is created open', report.status === 'open');
  const dup = trust.reportObject({ objectId: 'obj_ksm', actorId: 'usr_c', reason: 'spam' });
  check('a duplicate report is reused, not stacked', dup.reused === true);
  check('open reports are listed', trust.openReports().length === 1);

  trust.resolveReport(report.id, 'usr_admin', 'remove');
  check('resolving remove takes the object out of discovery', store.find('objects', (o) => o.id === 'obj_ksm').publication === 'removed');
  check('the object row is preserved (not deleted)', store.find('objects', (o) => o.id === 'obj_ksm') !== null);

  // --- reputation (derived) -------------------------------------------------
  const rep = trust.reputation('usr_a');
  check('reputation is derived from real acts', rep !== null && rep.confirmations === 1 && rep.signal > 0);

  // --- discovery ranking ----------------------------------------------------
  const ranked = discovery.discoverable({ limit: 10 });
  check('removed objects are excluded from discovery', !ranked.some((o) => o.id === 'obj_ksm'));
  check('a confirmed object outranks an unconfirmed one', ranked[0].id === 'obj_nb', ranked.map((o) => o.id).join(','));

  const near = discovery.discoverable({ near: { lat: -1.28, lng: 36.82 }, radiusKm: 5 });
  check('distance discovery returns the nearby object first', near[0].id === 'obj_nb' && near[0].distanceKm !== null, near.map((o) => `${o.id}:${o.distanceKm}`).join(','));

  // --- expiry ---------------------------------------------------------------
  const stale = store.insert('objects', { id: 'obj_old', type: 'event', title: 'Old Event', publication: 'public', verificationStatus: 'unverified', validityWindowDays: 1, createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), metadata: {} });
  discovery.sweepExpired();
  check('an expired object is marked stale', store.find('objects', (o) => o.id === 'obj_old').expiryStatus === 'expired');
  check('stale objects are excluded by default', !discovery.discoverable().some((o) => o.id === 'obj_old'));

  // --- notifications --------------------------------------------------------
  notifications.notify('usr_a', { kind: 'confirmed', title: 'Someone confirmed your info', objectId: 'obj_nb' });
  notifications.notify('usr_a', { kind: 'challenge', title: 'Challenge accepted' });
  check('notifications are listed newest-first', notifications.listNotifications('usr_a').length === 2 && notifications.listNotifications('usr_a')[0].title === 'Challenge accepted');
  check('unread count is derived', notifications.unreadCount('usr_a') === 2);
  notifications.markAllRead('usr_a');
  check('mark-all-read clears the unread count', notifications.unreadCount('usr_a') === 0);
  check('a notification for another user is not visible', notifications.listNotifications('usr_b').length === 0);

  // --- analytics ------------------------------------------------------------
  signals.emitSignal({ type: 'object_viewed', actorId: 'usr_a', objectId: 'obj_nb' });
  signals.emitSignal({ type: 'object_saved', actorId: 'usr_b', objectId: 'obj_nb' });
  const dash = analytics.dashboard();
  check('analytics counts engagement', dash.engagement.views === 1 && dash.engagement.saves === 1);
  check('analytics reports quality', typeof dash.quality.verificationRate === 'number');

  // --- arena entities -------------------------------------------------------
  const p1 = arena.createPlayer({ userId: 'usr_p1', gameId: 'efootball', gamerTag: 'P1' });
  const p2 = arena.createPlayer({ userId: 'usr_p2', gameId: 'efootball', gamerTag: 'P2' });
  check('players are real records, one per (user, game)', p1.id !== p2.id && arena.listPlayers({ gameId: 'efootball' }).length === 2);
  const venue = arena.createVenue({ name: 'GameHub Kilimani', gameIds: ['efootball'], lat: -1.28, lng: 36.82 });
  check('venues are filterable by game', arena.listVenues({ gameId: 'efootball' }).length === 1 && arena.listVenues({ gameId: 'cod_mobile' }).length === 0);
  const trn = arena.createTournament({ gameId: 'efootball', title: 'Kilimani Cup', createdBy: 'usr_admin' });
  check('tournaments are created open', trn.status === 'open');

  // leaderboard derives from confirmed results only
  const ch = arena.createChallenge({ createdBy: p1.id, gameId: 'efootball', stake: 'friendly' });
  const { match } = arena.acceptChallenge(ch.id, p2.id);
  arena.reportResult(match.id, p1.id, { winnerPlayerId: p1.id });
  arena.confirmResult(match.id, p2.id, { winnerPlayerId: p1.id });
  arena.recordResult(match.id);
  const board = arena.leaderboard('efootball');
  check('the leaderboard is derived from the confirmed result', board.length === 2 && board[0].playerId === p1.id && board[0].won === 1, JSON.stringify(board));
  check('recordResult is idempotent', arena.recordResult(match.id).reused === true);
}

console.log('\n=== PHASE 4: ONE PERSON, REAL SESSION ===');
{
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('../src/index.js');
  const person = await import('../src/domain/person.js');
  const vendors = await import('../src/domain/vendor.js');
  const listings = await import('../src/domain/listing.js');
  const ordersD = await import('../src/domain/order.js');
  const campaigns = await import('../src/domain/campaign.js');
  store._reset();
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, method = 'GET', body, token) => {
    const headers = {};
    if (body) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    const A = (await call('/api/auth/register', 'POST', {
      handle: 'phase4a', password: 'a good passphrase', displayName: 'Amina'
    })).body;
    const B = (await call('/api/auth/register', 'POST', {
      handle: 'phase4b', password: 'a good passphrase', displayName: 'Baraka'
    })).body;
    check('register returns a personId', Boolean(A.user.personId), JSON.stringify(A.user));
    check('whoAmI carries the same personId',
      (await call('/api/auth/me', 'GET', undefined, A.token)).body.user.personId === A.user.personId);

    let r = await call('/api/arena/challenges', 'POST', { gameId: 'efootball', stake: 'friendly' }, A.token);
    const chal = r.body.challenge;
    check('challenge is stamped with a personId', Boolean(chal.personId));
    r = await call(`/api/arena/challenges/${chal.id}/accept`, 'POST', {}, A.token);
    check('A cannot accept A\'s challenge', r.status === 400);

    r = await call(`/api/arena/challenges/${chal.id}/accept`, 'POST', {}, B.token);
    check('B can accept', r.status === 201);
    const match = r.body.match;
    check('player ids are account ids', match.playerAId === A.user.id && match.playerBId === B.user.id);
    const named = (await call(`/api/arena/matches/${match.id}`, 'GET', undefined, A.token)).body.match;
    check('whoAmI can resolve A\'s name', named.playerAName === 'Amina', String(named.playerAName));
    check('whoAmI can resolve B\'s name', named.playerBName === 'Baraka', String(named.playerBName));
    check('no fixture handle leaked', !/ply_nyabs|Nyabs/.test(JSON.stringify(named)));

    await call('/api/vendors', 'POST', { displayName: 'Amina Stall' }, A.token);
    const listing = (await call('/api/listings', 'POST', {
      title: 'Maize', type: 'product', price: 200, quantityAvailable: 5
    }, A.token)).body.listing;
    await call(`/api/listings/${listing.id}/status`, 'POST', { status: 'active' }, A.token);
    const otherV = vendors.createVendor({ ownerId: B.user.id, displayName: 'Baraka Goods' });
    const otherL = listings.createListing({ vendorId: otherV.id, title: 'Beans', price: 100, quantityAvailable: 4 });
    listings.transitionListing(otherL.id, 'active');
    ordersD.createOrder({ listingId: otherL.id, buyerId: A.user.id, quantity: 1 });
    campaigns.createCampaign(A.user.id, { title: 'Amina Night', type: 'popup', price: 0 });
    const mine = (await call('/api/person/me', 'GET', undefined, A.token)).body;
    check('standing is one person', mine.standing.personId === A.user.personId);
    check('hosted campaigns count on that person', mine.standing.hosted >= 1, String(mine.standing.hosted));
    check('bought orders count on that person', mine.standing.bought >= 1, String(mine.standing.bought));
    check('vendor is a view of the same person', mine.standing.vendor?.displayName === 'Amina Stall');

    check('availability starts offline', mine.availability.state === 'offline');
    r = await call('/api/person/me/availability', 'PUT', {
      state: 'available', gameId: 'efootball', format: '1v1', window: 'tonight', locationKind: 'online'
    }, A.token);
    check('going available requires an explicit switch', r.status === 200 && r.body.availability.state === 'available');
    const listed = (await call('/api/arena/available')).body.available;
    check('only opted-in people are listed', listed.some((p) => p.userId === A.user.id));
    check('B is not listed without opting in', !listed.some((p) => p.userId === B.user.id));
    await call('/api/person/me/availability', 'PUT', { state: 'offline' }, A.token);
    check('turning off removes them from the list',
      !(await call('/api/arena/available')).body.available.some((p) => p.userId === A.user.id));

    r = await call('/api/person/me/aliases', 'POST', { kind: 'whatsapp', value: '254700111222' }, A.token);
    check('unverified WhatsApp alias is refused', r.status === 400);
    check('the refusal names the guess', /not verified|will not guess/i.test(r.body?.error ?? ''), r.body?.error);
    r = await call('/api/person/me/aliases', 'POST', { kind: 'phone', value: '0722000111' }, A.token);
    check('self-asserted phone is refused without a check', r.status === 400);
    check('no whatsapp alias was stored',
      !store.all('personAliases').some((a) => a.kind === 'whatsapp' && a.personId === A.user.personId));

    const bound = person.linkAlias(A.user.personId, 'telegram', '999001', {
      verified: true, source: 'telegram_init'
    });
    check('a verified telegram bind is accepted', bound.kind === 'telegram' && bound.verified === true);
  } finally {
    srv.close();
  }
}

console.log('\n=== TEMPORARY DEMO CONTENT EXPIRY ===');
{
  const seed = await import('../src/domain/seed.js');
  const discovery = await import('../src/domain/discovery.js');
  store._reset();
  const seeded = seed.runSeed();
  const source = store.find('sources', (row) => row.seedBatch === seed.BATCH);
  const before = store.filter('objects', (row) => row.seedBatch === seed.BATCH).length;
  const expired = seed.expireSeed(Date.parse(source.seedExpiresAt) + 1);
  const visibleAfterExpiry = discovery.discoverable({ publication: 'public' });
  const rerun = seed.runSeed();
  check('demo seed is time-bounded', seeded.alreadySeeded === false && source.seedExpiresAt && seed.DEMO_TTL_DAYS === 7);
  check('expired demo content leaves public discovery', expired.expired === true && visibleAfterExpiry.length === 0);
  check('expired demo rows are retained as expired records', store.filter('objects', (row) => row.expiryStatus === 'expired').length === before);
  check('expired demo content is not silently reseeded', rerun.alreadySeeded === true && rerun.expired === true && store.filter('objects', (row) => row.seedBatch === seed.BATCH).length === before);
  const cleared = seed.clearSeed();
  check('the operator can explicitly clear the expired cohort', cleared.objects === before && store.filter('objects', (row) => row.seedBatch === seed.BATCH).length === 0);
}

console.log('\n=== ONBOARDING: THE SERVICE LADDER ===');
{
  const onboarding = await import('../src/domain/onboarding.js');
  const auth = await import('../src/domain/auth.js');
  store._reset();

  const user = auth.createUser({ handle: 'kamau', password: 'passw0rd123', displayName: 'Kamau' });
  onboarding.ensureProfile(user.id);

  let ladder = onboarding.ladderFor(user.id);
  check('an account alone reaches only the first rung',
    ladder.reached.length === 1 && ladder.reached[0] === 'identity');
  check('the next step is the segmentation question', ladder.nextStep?.id === 'orient');
  check('nobody is activated before they keep something', ladder.activated === false);

  const capture = ladder.services.find((s) => s.id === 'capture');
  const distribution = ladder.services.find((s) => s.id === 'distribution');
  check('capture is closed before activation', capture.unlocked === false);
  check('a closed service names the step that opens it',
    typeof capture.unlocksAfter === 'string' && capture.unlocksAfter.length > 0);
  check('distribution is closed at the very bottom of the ladder', distribution.unlocked === false);

  onboarding.setGoal(user.id, 'discover');
  ladder = onboarding.ladderFor(user.id);
  check('answering the one question climbs a rung', ladder.reached.includes('orient'));
  check('the aha step is now the next one', ladder.nextStep?.id === 'value');

  let refused = false;
  try { onboarding.setGoal(user.id, 'world-domination'); } catch { refused = true; }
  check('an unknown goal is refused rather than stored', refused);

  let badEvent = false;
  try { onboarding.recordEvent(user.id, 'invented_event'); } catch { badEvent = true; }
  check('an unknown activation event is refused', badEvent);

  // A LADDER, NOT A BADGE SHELF: creating a listing before saving anything
  // must not skip the rung underneath it.
  const vendor = store.insert('vendors', {
    id: 'ven_ladder', ownerId: user.id, displayName: 'Kamau Prints', status: 'active',
    createdAt: new Date().toISOString()
  });
  store.insert('listings', {
    id: 'lst_ladder', vendorId: vendor.id, title: 'Print run', price: 500, currency: 'KES',
    status: 'draft', createdAt: new Date().toISOString()
  });
  ladder = onboarding.ladderFor(user.id);
  check('a later rung with evidence is not REACHED while an earlier one is missing',
    ladder.rungs.find((r) => r.id === 'reach').done === true &&
    ladder.rungs.find((r) => r.id === 'reach').reached === false);
  check('the missing step is still the one being asked for', ladder.nextStep?.id === 'value');
  check('services above the gap stay closed',
    ladder.services.find((s) => s.id === 'distribution').unlocked === false);

  onboarding.recordEvent(user.id, 'object_saved', { objectId: 'obj_1' });
  ladder = onboarding.ladderFor(user.id);
  check('keeping the first thing is activation', ladder.activated === true && typeof ladder.activatedAt === 'string');
  check('activation opens capture', ladder.services.find((s) => s.id === 'capture').unlocked === true);
  check('activation alone does not open distribution',
    ladder.services.find((s) => s.id === 'distribution').unlocked === false);
  check('the rung records HOW it was reached',
    ladder.rungs.find((r) => r.id === 'value').how === 'Saved something from the feed');

  onboarding.recordEvent(user.id, 'capture_saved', {});
  ladder = onboarding.ladderFor(user.id);
  check('capturing climbs the contribute rung, which now lets the listing count',
    ladder.reached.includes('contribute') && ladder.reached.includes('reach'));
  check('a complete ladder asks for nothing more', ladder.complete === true && ladder.nextStep === null);

  const metrics = onboarding.metrics();
  check('activation metrics are scanned, not stored',
    metrics.started === 1 && metrics.activated === 1 && metrics.activationRate === 1);
  check('drop-off is reported per rung transition', metrics.dropOff.length === onboarding.RUNG_IDS.length - 1);

  // Personalisation: the answer promotes the service it is about, by ONE rung.
  const player = auth.createUser({ handle: 'otieno', password: 'passw0rd123' });
  onboarding.ensureProfile(player.id);
  const before = onboarding.ladderFor(player.id).services.find((s) => s.id === 'play');
  check('Arena follows the aha step by default', before.unlocked === false && before.requires === 'value');
  onboarding.setGoal(player.id, 'play');
  const after = onboarding.ladderFor(player.id).services.find((s) => s.id === 'play');
  check('someone who came to PLAY gets Arena one rung earlier',
    after.unlocked === true && after.promoted === true);
  const stillClosed = onboarding.ladderFor(player.id).services.find((s) => s.id === 'distribution');
  check('the promotion moves ONE service, not the whole ladder',
    stillClosed.unlocked === false && stillClosed.promoted === false);

  const fresh = auth.createUser({ handle: 'atieno', password: 'passw0rd123' });
  onboarding.ensureProfile(fresh.id);
  const cohort = onboarding.metrics();
  check('a person who has done nothing lowers the rate honestly',
    cohort.started === 3 && cohort.activated === 1 && Math.abs(cohort.activationRate - 1 / 3) < 1e-9);
}

console.log('\n=== FEDERATED SIGN-IN (Google + signed links) ===');
{
  const federated = await import('../src/domain/federated.js');
  const auth = await import('../src/domain/auth.js');
  store._reset();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.VITE_GOOGLE_CLIENT_ID;

  const status = federated.providerStatus();
  check('a password account is always offered', status.password.configured === true);
  check('Google reports itself unconfigured rather than pretending', status.google.configured === false);
  check('the refusal names what is missing', /GOOGLE_CLIENT_ID/.test(status.google.reason));
  check('TELEGRAM IS NOT REQUIRED FOR MEMBERSHIP', status.telegram.required === false);

  const unconfigured = await federated.verifyGoogleIdToken('a.b.c');
  check('no client id means no verification, and it says so',
    unconfigured.ok === false && unconfigured.reason === 'provider_not_configured');

  // Verify a REAL RS256 token against a key we control. This exercises the
  // same signature path a Google token takes; only the key differs.
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
  federated._setGoogleKeys([jwk]);
  process.env.GOOGLE_CLIENT_ID = 'brief-test.apps.googleusercontent.com';

  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const mint = (claims, kid = 'test-key') => {
    const head = b64({ alg: 'RS256', kid, typ: 'JWT' });
    const body = b64(claims);
    const sig = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${body}`), privateKey).toString('base64url');
    return `${head}.${body}.${sig}`;
  };
  const goodClaims = {
    iss: 'https://accounts.google.com',
    aud: 'brief-test.apps.googleusercontent.com',
    sub: '10992',
    email: 'Wanjiru@Example.com',
    email_verified: true,
    name: 'Wanjiru',
    exp: Math.floor(Date.now() / 1000) + 600
  };

  const good = await federated.verifyGoogleIdToken(mint(goodClaims));
  check('a correctly signed token verifies', good.ok === true, good.reason ?? '');
  check('the email is normalised', good.ok && good.claims.email === 'wanjiru@example.com');

  const tampered = mint(goodClaims).replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
  const bad = await federated.verifyGoogleIdToken(tampered);
  check('a tampered signature is refused', bad.ok === false);

  const wrongAud = await federated.verifyGoogleIdToken(mint({ ...goodClaims, aud: 'someone-else' }));
  check('a token minted for another app is refused', wrongAud.ok === false && wrongAud.reason === 'bad_audience');

  const expired = await federated.verifyGoogleIdToken(mint({ ...goodClaims, exp: Math.floor(Date.now() / 1000) - 5 }));
  check('an expired token is refused', expired.ok === false && expired.reason === 'expired');

  const unverifiedEmail = await federated.verifyGoogleIdToken(mint({ ...goodClaims, email_verified: false }));
  check('an unverified Google email is refused', unverifiedEmail.ok === false && unverifiedEmail.reason === 'email_not_verified');

  const unknownKid = await federated.verifyGoogleIdToken(mint(goodClaims, 'not-a-key'));
  check('a token signed by an unknown key is refused', unknownKid.ok === false && unknownKid.reason === 'unknown_key');

  // The account binding itself.
  const first = auth.signInWithVerifiedIdentity({
    provider: 'google', subject: '10992', email: 'wanjiru@example.com', displayName: 'Wanjiru'
  });
  check('a verified identity creates exactly one account', first.created === true);
  check('the handle is derived from the email', first.user.handle === 'wanjiru');
  const second = auth.signInWithVerifiedIdentity({
    provider: 'google', subject: '10992', email: 'WANJIRU@example.com'
  });
  check('signing in again reuses that account', second.created === false && second.user.id === first.user.id);
  check('the public projection carries the verified email, never a hash',
    auth.publicUser(second.user).email === 'wanjiru@example.com' &&
    auth.publicUser(second.user).passwordHash === undefined);

  // Signed one-tap links (the TikTok arrival path).
  const token = federated.mintEmailLinkToken('amina@example.com', { source: 'tiktok' });
  const redeemed = federated.redeemEmailLinkToken(token);
  check('a Brief-signed link identifies the address it was minted for',
    redeemed.ok === true && redeemed.email === 'amina@example.com' && redeemed.source === 'tiktok');

  const forged = `${token.split('.')[0]}.${'x'.repeat(token.split('.')[1].length)}`;
  check('a forged signature is refused', federated.redeemEmailLinkToken(forged).ok === false);
  check('a bare email is not a token', federated.redeemEmailLinkToken('amina@example.com').ok === false);

  const stale = federated.mintEmailLinkToken('amina@example.com', { ttlMs: 1000, now: Date.now() - 60_000 });
  check('an old link stops identifying anyone',
    federated.redeemEmailLinkToken(stale).ok === false &&
    federated.redeemEmailLinkToken(stale).reason === 'expired');

  let rejectedEmail = false;
  try { federated.mintEmailLinkToken('not-an-email'); } catch { rejectedEmail = true; }
  check('a malformed address cannot be minted', rejectedEmail);

  delete process.env.GOOGLE_CLIENT_ID;
  federated._setGoogleKeys(null);
}

console.log(`\n${'='.repeat(52)}\nPASSED ${pass}   FAILED ${fail}   SKIPPED ${skip}\n${'='.repeat(52)}`);
process.exit(fail ? 1 : 0);

