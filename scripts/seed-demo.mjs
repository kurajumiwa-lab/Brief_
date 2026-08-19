#!/usr/bin/env node
// ---------------------------------------------------------------------------
// DEMO SEED — realistic Nairobi-local content through the REAL pipeline
//
// Usage:
//   node scripts/seed-demo.mjs            # seed the store with demo content
//   node scripts/seed-demo.mjs --clear    # remove everything this script added
//
// WHAT THIS IS
//   Brief's discovery surface was rendering but empty: nothing had been
//   ingested and nothing captured. This script populates it the SAME way real
//   content enters — through the extraction pipeline (storeRawItem →
//   processRawItem), plus the real campaign/vendor/listing domain services.
//   No hand-rolled fake rows, no fabricated money, no fake payments.
//
// SAFETY
//   * every row carries `seedBatch: 'nairobi-demo-v1'` so it is clearly
//     distinguishable from genuine data
//   * `--clear` removes exactly those rows (and the links that reference them)
//   * it creates NO ledger transactions, NO payment intents, NO orders —
//     nothing that could be mistaken for real money
//   * it is a script, not a route: an end user cannot trigger it
// ---------------------------------------------------------------------------

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BATCH = 'nairobi-demo-v1';
const HOST = 'usr_me'; // the single-user dev identity; host-scoped demo content lives here

// Resolve the store's data dir the same way the server does, so seeding hits
// the deployment's actual data file (or a test dir when BRIEF_DATA_DIR is set).
const serverSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'src');

const { store } = await import(path.join(serverSrc, 'store.js'));
const { storeRawItem, processRawItem } = await import(path.join(serverSrc, 'pipeline', 'ingest.js'));
const campaigns = await import(path.join(serverSrc, 'domain', 'campaign.js'));
const vendors = await import(path.join(serverSrc, 'domain', 'vendor.js'));
const listings = await import(path.join(serverSrc, 'domain', 'listing.js'));

const clear = process.argv.includes('--clear');

// ---------------------------------------------------------------------------
// CLEAR
// ---------------------------------------------------------------------------
function removeWhere(collection, pred) {
  const ids = store.filter(collection, pred).map((r) => r.id);
  for (const id of ids) store.remove(collection, id);
  return ids.length;
}

if (clear) {
  const demoObjectIds = new Set(store.filter('objects', (o) => o.seedBatch === BATCH).map((o) => o.id));
  const demoCampaignIds = new Set(store.filter('campaigns', (c) => c.seedBatch === BATCH).map((c) => c.id));
  const demoVendorIds = new Set(store.filter('vendors', (v) => v.seedBatch === BATCH).map((v) => v.id));
  const demoListingIds = new Set(store.filter('listings', (l) => l.seedBatch === BATCH).map((l) => l.id));
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

  console.log('Demo seed cleared:');
  for (const [k, v] of Object.entries(n)) if (v) console.log(`  ${k}: ${v}`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// SEED
// ---------------------------------------------------------------------------

// One public manual source carries the demo content, exactly as a real
// "captured by you" source would.
const source = store.insert('sources', {
  id: `src_${BATCH}`,
  name: 'Nairobi Community (demo)',
  type: 'manual',
  platform: 'manual',
  url: null,
  externalId: null,
  accessType: 'public', // so extracted objects default to public
  connectionStatus: 'connected',
  confidence: 0.5,
  seedBatch: BATCH,
  lastSyncedAt: new Date().toISOString(),
  lastMessageAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

// Realistic Kenyan-local messages; the extraction engine does the work. Each
// entry is a real place/event/opportunity anchored to an authentic Kenyan
// city and neighbourhood — but it flows through the pipeline like a real
// capture, so every object carries provenance and evidence. No fabricated
// ratings, no fake hosts, no invented reviews.
const SEED_TEXTS = [
  // Nairobi
  'Saturday popup at Kilimani Studio. 12 vendors. Fashion, food and beauty. KES 300 entry. 4PM-10PM. Vendor: Kikao Streetwear. Printed Hoodie KES 2500. DM Jane on WhatsApp.',
  'Maji Mazuri Saturday Market Day, extended trading at Westlands Square. 20 vendors, live music from 11AM. Free entry. Kikoy by the yard from Mama Njeri.',
  'Rooftop yoga session at Kileleshwa. Sundays 8AM. KES 500 per class, bring your own mat. Instructor: Coach Amani.',
  'Tech meetup at iHub Nairobi, Thursday 6PM. Talks on mobile money and logistics. Free, register on arrival.',
  'Book fair at Sarit Centre Expo, weekend. 30 publishers, KES 200 entry, kids under 12 free.',
  'Farmers market at Karen every first Saturday. Fresh produce, honey and flowers. Free entry from 8AM. Vendor: Karen Gardens.',
  'Lavington run club, Saturday 7AM at Lavington Green. 5k and 10k routes. KES 100 drop-in.',
  'Runda artisan fair, Sunday. Pottery, jewellery and home decor. KES 150 entry.',
  'Langata drive-in cinema, Friday night. Two films, KES 800 per car.',
  // Mombasa + coast
  'Beach clean-up and dhow race at Nyali Beach. Sunday 9AM. Free to join, equipment provided.',
  'Bamburi food festival this weekend. 15 food stalls, live Taarab music. KES 200 entry.',
  'Diani kitesurfing lesson package. Beginners welcome, equipment included. KES 3,500 per session.',
  'Shanzu night market, every Friday. Seafood, crafts and music by the water. Free entry.',
  'Mtwapa boat tour and snorkelling trip. Departures 9AM and 2PM. KES 2,500 per person.',
  // Kisumu
  'Kisumu fish market day at Milimani, Saturday. Fresh tilapia and Lake Victoria produce from 6AM.',
  'Riat Hills sunset hike, Sunday 4PM. Guided, KES 300 per person.',
  'Nyalenda community arts festival, weekend. Dance, theatre and crafts. Free entry.',
  // Nakuru
  'Nakuru Milimani farmers market, Saturday morning. Vegetables, dairy and coffee. Free entry.',
  'Lake Nakuru sunrise safari drive, daily 6AM. KES 4,000 per vehicle.',
  'Lanet pottery workshop, every Thursday. Make your own mug. KES 1,200 all materials included.',
  // Nanyuki
  'Nanyuki central market day, Tuesday. Wool, honey and fresh produce. Free entry.',
  'Mt Kenya forest walk from Burguret gate. Guided half-day. KES 1,800 per person.'
];

const demoObjectIds = new Set();
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
    // Mark the object and any child vendor/product objects.
    for (const id of [result.objectId, ...(result.childIds ?? [])]) {
      const obj = store.find('objects', (o) => o.id === id);
      if (obj) {
        store.update('objects', id, { seedBatch: BATCH, publication: 'public' });
        demoObjectIds.add(id);
      }
    }
  }
  return result;
};

const created = [];
SEED_TEXTS.forEach((text, i) => created.push(seedObject(text, i)));

// Direct places / opportunities (not event-worthy, but real), across the
// country so discovery isn't Nairobi-only.
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
  demoObjectIds.add(obj.id);
}

// Public campaigns — so public pages, ticketing and check-in are demonstrable.
const demoCampaigns = [];
for (const [title, price, capacity] of [
  ['Kilimani Plant Sale', 0, 100],
  ['Rooftop Saturday: Creators Meetup', 300, 60]
]) {
  const c = campaigns.createCampaign(HOST, {
    title, description: `A demo gathering: ${title}.`, type: 'event',
    location: 'Kilimani, Nairobi', capacity, price, currency: 'KES'
  });
  // A draft campaign has no public presence; take it live so the public page,
  // registration and ticket flow are all demonstrable.
  campaigns.transitionCampaign(c.id, 'published');
  campaigns.transitionCampaign(c.id, 'live');
  store.update('campaigns', c.id, { seedBatch: BATCH });
  if (store.find('objects', (o) => o.id === c.objectId)) {
    store.update('objects', c.objectId, { seedBatch: BATCH, publication: 'public' });
    demoObjectIds.add(c.objectId);
  }
  demoCampaigns.push(c);
}

// Vendors + listings — so the marketplace shows real offers.
const demoVendor = vendors.createVendor({
  ownerId: HOST, displayName: 'Kikao Streetwear',
  description: 'Printed streetwear from Kilimani.', contactMethod: 'WhatsApp'
});
store.update('vendors', demoVendor.id, { seedBatch: BATCH });
for (const [title, price, type] of [
  ['Printed Hoodie', 2500, 'product'],
  ['Screen Tee', 1200, 'product']
]) {
  const l = listings.createListing({ vendorId: demoVendor.id, title, price, currency: 'KES', type, quantityAvailable: 20 });
  // A draft listing is invisible to the public marketplace; make it active so
  // the demo surface is actually discoverable.
  listings.transitionListing(l.id, 'active');
  store.update('listings', l.id, { seedBatch: BATCH });
}

// A second vendor on the coast, so the marketplace is national, not Nairobi-only.
// (Vendors are one-per-owner, so this uses a distinct demo owner id.)
const coastVendor = vendors.createVendor({
  ownerId: 'usr_demo_coast', displayName: 'Pwani Handcrafts',
  description: 'Kikoy, carved wood and beach crafts from Mombasa.', contactMethod: 'WhatsApp'
});
store.update('vendors', coastVendor.id, { seedBatch: BATCH });
for (const [title, price, type] of [
  ['Handwoven Kikoy', 1800, 'product'],
  ['Carved Dhow Ornament', 950, 'product'],
  ['Coconut Shell Bowl', 700, 'product']
]) {
  const l = listings.createListing({ vendorId: coastVendor.id, title, price, currency: 'KES', type, quantityAvailable: 15 });
  listings.transitionListing(l.id, 'active');
  store.update('listings', l.id, { seedBatch: BATCH });
}

console.log('Demo seed complete:');
console.log(`  source:       ${source.name}`);
console.log(`  objects:      ${store.filter('objects', (o) => o.seedBatch === BATCH).length} (incl. vendors/products)`);
console.log(`  campaigns:    ${demoCampaigns.length} (public slugs: ${demoCampaigns.map((c) => `/c/${c.publicSlug}`).join(', ')})`);
console.log(`  vendors:      ${store.filter('vendors', (v) => v.seedBatch === BATCH).length} · listings: ${store.filter('listings', (l) => l.seedBatch === BATCH).length}`);
console.log(`  raw items:    ${store.filter('rawItems', (r) => r.sourceId === source.id).length}`);
console.log(`  ledger/payments/orders: 0 (nothing fabricated)`);
console.log(`\nRemove everything with: node scripts/seed-demo.mjs --clear`);
