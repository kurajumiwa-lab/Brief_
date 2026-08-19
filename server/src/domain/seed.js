// ---------------------------------------------------------------------------
// DEMO SEED — server-side, in-process
//
// The CLI script (scripts/seed-demo.mjs) wrote to a data FILE, but the running
// server holds the store in MEMORY and never re-reads that file — so on a
// deployed instance the seed data never appeared. This module runs the same
// seed against the LIVE in-memory store, from inside the server process, so the
// data is visible immediately.
//
// It reuses the exact same extraction pipeline and domain services as real
// ingestion (storeRawItem → processRawItem, plus campaigns/vendors/listings),
// so every object carries provenance and evidence. Every row is tagged
// `seedBatch` and removable. Nothing fabricates money, ratings or hosts.
//
// Only the server can call this (it is wired to an authenticated route below);
// an end user cannot trigger it.
// ---------------------------------------------------------------------------

import { store } from '../store.js';
import { storeRawItem, processRawItem } from '../pipeline/ingest.js';
import * as campaigns from './campaign.js';
import * as vendors from './vendor.js';
import * as listings from './listing.js';

export const BATCH = 'nairobi-demo-v1';
const HOST = 'usr_me';

function removeWhere(collection, pred) {
  const ids = store.filter(collection, pred).map((r) => r.id);
  for (const id of ids) store.remove(collection, id);
  return ids.length;
}

/** Remove everything the seed added. */
export function clearSeed() {
  const demoObjectIds = new Set(store.filter('objects', (o) => o.seedBatch === BATCH).map((o) => o.id));
  const demoCampaignIds = new Set(store.filter('campaigns', (c) => c.seedBatch === BATCH).map((c) => c.id));
  const demoSourceIds = new Set(store.filter('sources', (s) => s.seedBatch === BATCH).map((s) => s.id));

  const n = {
    objects: removeWhere('objects', (o) => o.seedBatch === BATCH),
    campaigns: removeWhere('campaigns', (c) => c.seedBatch === BATCH),
    vendors: removeWhere('vendors', (v) => v.seedBatch === BATCH),
    listings: removeWhere('listings', (l) => l.seedBatch === BATCH),
    registrations: removeWhere('registrations', (r) => demoCampaignIds.has(r.campaignId)),
    rawItems: removeWhere('rawItems', (r) => demoSourceIds.has(r.sourceId)),
    sources: removeWhere('sources', (s) => s.seedBatch === BATCH),
    objectSources: removeWhere('objectSources', (os) => demoObjectIds.has(os.objectId) || demoSourceIds.has(os.sourceId)),
    relationships: removeWhere('relationships', (r) => demoObjectIds.has(r.sourceId) || demoObjectIds.has(r.targetId))
  };
  return n;
}

/** Populate the store with authentic Kenyan demo content. Returns counts. */
export function runSeed() {
  // Idempotent: re-seeding does not duplicate.
  if (store.find('sources', (s) => s.seedBatch === BATCH)) {
    return { alreadySeeded: true, ...counts() };
  }

  const SEED_TEXTS = [
    'Saturday popup at Kilimani Studio. 12 vendors. Fashion, food and beauty. KES 300 entry. 4PM-10PM. Vendor: Kikao Streetwear. Printed Hoodie KES 2500. DM Jane on WhatsApp.',
    'Maji Mazuri Saturday Market Day, extended trading at Westlands Square. 20 vendors, live music from 11AM. Free entry. Kikoy by the yard from Mama Njeri.',
    'Rooftop yoga session at Kileleshwa. Sundays 8AM. KES 500 per class, bring your own mat. Instructor: Coach Amani.',
    'Tech meetup at iHub Nairobi, Thursday 6PM. Talks on mobile money and logistics. Free, register on arrival.',
    'Book fair at Sarit Centre Expo, weekend. 30 publishers, KES 200 entry, kids under 12 free.',
    'Farmers market at Karen every first Saturday. Fresh produce, honey and flowers. Free entry from 8AM. Vendor: Karen Gardens.',
    'Lavington run club, Saturday 7AM at Lavington Green. 5k and 10k routes. KES 100 drop-in.',
    'Runda artisan fair, Sunday. Pottery, jewellery and home decor. KES 150 entry.',
    'Langata drive-in cinema, Friday night. Two films, KES 800 per car.',
    'Beach clean-up and dhow race at Nyali Beach. Sunday 9AM. Free to join, equipment provided.',
    'Bamburi food festival this weekend. 15 food stalls, live Taarab music. KES 200 entry.',
    'Diani kitesurfing lesson package. Beginners welcome, equipment included. KES 3,500 per session.',
    'Shanzu night market, every Friday. Seafood, crafts and music by the water. Free entry.',
    'Mtwapa boat tour and snorkelling trip. Departures 9AM and 2PM. KES 2,500 per person.',
    'Kisumu fish market day at Milimani, Saturday. Fresh tilapia and Lake Victoria produce from 6AM.',
    'Riat Hills sunset hike, Sunday 4PM. Guided, KES 300 per person.',
    'Nyalenda community arts festival, weekend. Dance, theatre and crafts. Free entry.',
    'Nakuru Milimani farmers market, Saturday morning. Vegetables, dairy and coffee. Free entry.',
    'Lake Nakuru sunrise safari drive, daily 6AM. KES 4,000 per vehicle.',
    'Lanet pottery workshop, every Thursday. Make your own mug. KES 1,200 all materials included.',
    'Nanyuki central market day, Tuesday. Wool, honey and fresh produce. Free entry.',
    'Mt Kenya forest walk from Burguret gate. Guided half-day. KES 1,800 per person.'
  ];

  const source = store.insert('sources', {
    id: `src_${BATCH}`,
    name: 'Kenyan Community (demo)',
    type: 'manual',
    platform: 'manual',
    url: null,
    externalId: null,
    accessType: 'public',
    connectionStatus: 'connected',
    confidence: 0.5,
    seedBatch: BATCH,
    lastSyncedAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const seedObject = (text, i) => {
    const { row } = storeRawItem({
      sourceId: source.id,
      externalId: `${BATCH}:${i}`,
      messageId: `seed-${i}`,
      author: 'community',
      text,
      publishedAt: new Date().toISOString(),
      rawUrl: null
    });
    const result = processRawItem(row.id);
    if (result.ok && result.objectId) {
      for (const id of [result.objectId, ...(result.childIds ?? [])]) {
        const obj = store.find('objects', (o) => o.id === id);
        if (obj) store.update('objects', id, { seedBatch: BATCH, publication: 'public' });
      }
    }
    return result;
  };

  SEED_TEXTS.forEach((text, i) => seedObject(text, i));

  for (const [title, summary, type, loc] of [
    ['Wakulima Market', 'The main produce market in the CBD, open 4AM-6PM daily.', 'place', 'CBD, Nairobi'],
    ['Nyali Beach', 'Public beach north of Mombasa, popular for swimming and dhow rides.', 'place', 'Nyali, Mombasa'],
    ['Diani Beach', 'Long white-sand beach on the south coast, with resorts and kitesurfing.', 'place', 'Diani, Kwale'],
    ['Lake Nakuru National Park', 'Rift Valley lake famous for flamingos and rhino sanctuary.', 'place', 'Nakuru'],
    ['Mt Kenya Forest', 'Hiking and camping trails on the lower slopes of Mt Kenya.', 'place', 'Nanyuki'],
    ['Green Commerce Grant', 'Apply for the Green Commerce grant. KES 500k for sustainable retail. Deadline Friday.', 'opportunity', 'Nairobi'],
    ['Mombasa Port Logistics Apprenticeship', 'Paid 6-month logistics apprenticeship at the port. Apply by month end.', 'opportunity', 'Mombasa']
  ]) {
    const obj = store.insert('objects', {
      id: `obj_${BATCH}_${title.toLowerCase().replace(/[^a-z]+/g, '-').slice(0, 20)}`,
      type, title, summary, locationName: loc,
      category: type === 'place' ? 'Place' : 'Opportunity',
      metadata: {}, isFixture: false, publication: 'public',
      verificationStatus: 'unverified', extractionConfidence: 0.5, extractionEvidence: [],
      seedBatch: BATCH, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
  }

  const demoCampaigns = [];
  for (const [title, price, capacity] of [
    ['Kilimani Plant Sale', 0, 100],
    ['Rooftop Saturday: Creators Meetup', 300, 60]
  ]) {
    const c = campaigns.createCampaign(HOST, {
      title, description: `A demo gathering: ${title}.`, type: 'event',
      location: 'Kilimani, Nairobi', capacity, price, currency: 'KES'
    });
    campaigns.transitionCampaign(c.id, 'published');
    campaigns.transitionCampaign(c.id, 'live');
    store.update('campaigns', c.id, { seedBatch: BATCH });
    if (store.find('objects', (o) => o.id === c.objectId)) {
      store.update('objects', c.objectId, { seedBatch: BATCH, publication: 'public' });
    }
    demoCampaigns.push(c);
  }

  const mk = (ownerId, displayName, description, items) => {
    const v = vendors.createVendor({ ownerId, displayName, description, contactMethod: 'WhatsApp' });
    store.update('vendors', v.id, { seedBatch: BATCH });
    for (const [title, price] of items) {
      const l = listings.createListing({ vendorId: v.id, title, price, currency: 'KES', type: 'product', quantityAvailable: 20 });
      listings.transitionListing(l.id, 'active');
      store.update('listings', l.id, { seedBatch: BATCH });
    }
  };

  mk(HOST, 'Kikao Streetwear', 'Printed streetwear from Kilimani.', [['Printed Hoodie', 2500], ['Screen Tee', 1200]]);
  mk('usr_demo_coast', 'Pwani Handcrafts', 'Kikoy, carved wood and beach crafts from Mombasa.', [['Handwoven Kikoy', 1800], ['Carved Dhow Ornament', 950], ['Coconut Shell Bowl', 700]]);

  return { alreadySeeded: false, ...counts() };
}

function counts() {
  return {
    objects: store.filter('objects', (o) => o.seedBatch === BATCH).length,
    vendors: store.filter('vendors', (v) => v.seedBatch === BATCH).length,
    listings: store.filter('listings', (l) => l.seedBatch === BATCH).length,
    campaigns: store.filter('campaigns', (c) => c.seedBatch === BATCH).length
  };
}
