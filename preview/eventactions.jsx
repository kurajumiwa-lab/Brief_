// ---------------------------------------------------------------------------
// EVENT SECONDARY ACTIONS — the .ics generator (add-to-calendar), honest and
// standards-compliant, built from real campaign fields only.
// ---------------------------------------------------------------------------
const assert = require('assert').strict;
const { eventIcsUrl, buildMapsHref } = require('./src/model/core.tsx');

let count = 0;
const pass = (name) => { count++; console.log('PASS ' + name); };

// .ics requires a start time; missing -> null (no fake calendar entry).
assert.equal(eventIcsUrl({ title: 'X', description: null, location: null, startsAt: null, endsAt: null }), null);
pass('.ics is null when there is no start time');

// A full event produces a valid VEVENT with escaped fields.
const url = eventIcsUrl({
  title: 'Kilimani Wellness Day',
  description: 'A day of calm, tea and breathing',
  location: 'Kilimani, Nairobi',
  startsAt: '2026-09-14T12:00:00.000Z',
  endsAt: '2026-09-14T14:00:00.000Z'
});
assert.ok(url.startsWith('data:text/calendar'), 'is a calendar data URI');
const ics = decodeURIComponent(url.replace('data:text/calendar;charset=utf-8,', ''));
assert.ok(ics.includes('BEGIN:VCALENDAR') && ics.includes('END:VCALENDAR'));
assert.ok(ics.includes('BEGIN:VEVENT') && ics.includes('END:VEVENT'));
assert.ok(ics.includes('SUMMARY:Kilimani Wellness Day'));
assert.ok(ics.includes('DESCRIPTION:A day of calm\\, tea and breathing'), 'comma escaped');
assert.ok(ics.includes('LOCATION:Kilimani\\, Nairobi'), 'location comma escaped');
assert.ok(ics.includes('DTSTART:20260914T120000Z'), 'start time formatted');
assert.ok(ics.includes('DTEND:20260914T140000Z'), 'end time formatted');
pass('.ics emits a valid, escaped VEVENT');

// Missing end time falls back to +1h.
const url2 = eventIcsUrl({ title: 'X', description: null, location: null, startsAt: '2026-09-14T12:00:00.000Z', endsAt: null });
const ics2 = decodeURIComponent(url2.replace('data:text/calendar;charset=utf-8,', ''));
assert.ok(ics2.includes('DTEND:20260914T130000Z'), 'fallback end time is +1h');
pass('.ics falls back to +1h when no end time');

// Directions link is a real Google Maps URL.
assert.equal(buildMapsHref('Kilimani'), 'https://www.google.com/maps/search/?api=1&query=Kilimani');
pass('buildMapsHref builds a Google Maps directions URL');

console.log('\nPASS ' + count);
process.exit(0);
