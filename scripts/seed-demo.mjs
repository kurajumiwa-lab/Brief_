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

// Realistic Nairobi-local messages; the extraction engine does the work.
const SEED_TEXTS = [
  // events / experiences
  'Saturday popup at Kilimani Studio. 12 vendors. Fashion, food and beauty. KES 300 entry. 4PM-10PM. Vendor: Kikao Streetwear. Printed Hoodie KES 2500. DM Jane on WhatsApp.',
  'Maji Mazuri Saturday Market Day, extended trading at Westlands Square. 20 vendors, live music from 11AM. Free entry. Kikoy by the yard from Mama Njeri.',
  'Rooftop yoga session at Kileleshwa. Sundays 8AM. KES 500 per class, bring your own mat. Instructor: Coach Amani.',
  'Tech meetup at iHub Nairobi, Thursday 6PM. Talks on mobile money and logistics. Free, register on arrival.',
  'Book fair at Sarit Centre Expo, weekend. 30 publishers, KES 200 entry, kids under 12 free.'
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

// A couple of direct places / opportunities (not event-worthy, but real).
for (const [title, summary, type, loc] of [
  ['Wakulima Market', 'The main produce market in the CBD, open 4AM-6PM daily.', 'place', 'CBD, Nairobi'],
  ['Green Commerce Grant', 'Apply for the Green Commerce grant. KES 500k for sustainable retail. Deadline Friday.', 'opportunity', 'Nairobi']
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

console.log('Demo seed complete:');
console.log(`  source:       ${source.name}`);
console.log(`  objects:      ${store.filter('objects', (o) => o.seedBatch === BATCH).length} (incl. vendors/products)`);
console.log(`  campaigns:    ${demoCampaigns.length} (public slugs: ${demoCampaigns.map((c) => `/c/${c.publicSlug}`).join(', ')})`);
console.log(`  vendors:      1 · listings: 2`);
console.log(`  raw items:    ${store.filter('rawItems', (r) => r.sourceId === source.id).length}`);
console.log(`  ledger/payments/orders: 0 (nothing fabricated)`);
console.log(`\nRemove everything with: node scripts/seed-demo.mjs --clear`);
