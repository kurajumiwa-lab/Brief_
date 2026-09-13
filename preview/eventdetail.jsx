// ---------------------------------------------------------------------------
// EVENT DETAIL (Tikiti T4) — the client-side contract of the rich detail
// screen. Three things must hold for the wiring to be honest:
//   1. the client validator ACCEPTS the server's new projection (venue,
//      agenda, seriesId, host, chamaOverlap) so the screen actually renders;
//   2. it still REJECTS any private leak (ownerId / id / objectId / metrics);
//   3. the small pure helpers (maps link, friendly date) behave truthfully.
// ---------------------------------------------------------------------------
const assert = require('assert').strict;
const { isPublicCampaign } = require('./src/api/validate.ts');
const { venueMapsHref, formatStartsAt } = require('./src/model/core.tsx');

let count = 0;
const pass = (name) => { count++; console.log('PASS ' + name); };

const full = {
  slug: 's1', title: 'Rooftop Series — June', description: 'A rooftop market', type: 'event',
  status: 'published', location: 'Kilimani', startsAt: '2026-09-14T12:00:00Z', endsAt: null,
  price: 500, currency: 'KES', capacity: 100, remaining: 66, soldOut: false, registered: 34,
  image: 'https://cdn.example.com/cover.jpg', creator: 'Amina K',
  venue: { name: 'Sarit Rooftop', address: 'Sarit Centre, Westlands', lat: -1.26, lng: 36.79 },
  agenda: [{ at: '18:00', title: 'Doors open' }, { title: 'Keynote', description: 'A talk' }],
  seriesId: 'rooftop-series',
  host: { name: 'Amina K', eventsHosted: 3 },
  chamaOverlap: [{ chamaId: 'chm_1', chamaName: 'Kilimani Chama', memberCount: 2 }]
};

// --- the new projection is ACCEPTED (so the detail screen renders) ---
assert.equal(isPublicCampaign(full), true, 'full T4 projection is a valid public campaign');
pass('isPublicCampaign accepts the T4 projection (venue/agenda/series/host/overlap)');

// --- still an honest allow-list: private fields are rejected even with the
//     new fields present ---
for (const key of ['ownerId', 'id', 'objectId', 'metrics']) {
  assert.equal(isPublicCampaign({ ...full, [key]: 'x' }), false, `rejects ${key}`);
}
pass('isPublicCampaign still rejects ownerId/id/objectId/metrics');

// --- maps link: coordinates win, then address/name, then the flat location ---
assert.equal(
  venueMapsHref({ lat: -1.26, lng: 36.79 }, null),
  'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('-1.26,36.79'),
  'coordinates produce a pin link'
);
assert.equal(
  venueMapsHref({ name: 'Sarit Rooftop', address: 'Sarit Centre' }, 'Kilimani'),
  'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Sarit Centre'),
  'address beats the flat location'
);
assert.equal(
  venueMapsHref(null, 'Kilimani'),
  'https://www.google.com/maps/search/?api=1&query=Kilimani',
  'no venue -> flat location'
);
assert.equal(venueMapsHref(null, null), null, 'nothing at all -> null (no dead link)');
pass('venueMapsHref derives coordinates, then address, then location — or null');

// --- friendly date: real ISO -> "day, date · time"; junk -> raw; null -> null ---
assert.equal(formatStartsAt(null), null);
assert.equal(formatStartsAt('not-a-date'), 'not-a-date', 'a non-date is passed through, not fabricated');
const nice = formatStartsAt('2026-09-14T12:00:00Z');
assert.ok(nice && nice.includes('·'), `formats a date+time: ${nice}`);
pass('formatStartsAt returns a friendly date, passes junk through, null stays null');

console.log('\nPASS ' + count);
process.exit(0);
