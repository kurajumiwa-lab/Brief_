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

console.log(`\n${'='.repeat(52)}\nPASSED ${pass}   FAILED ${fail}   SKIPPED ${skip}\n${'='.repeat(52)}`);
process.exit(fail ? 1 : 0);
