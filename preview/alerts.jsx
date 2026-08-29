// DESTINATION ALERTS — the sidebar red-dot logic, proven at the unit level.
// The rule under test is the honesty rule: a dot appears ONLY when real data
// says something changed, routes to the right destination, and never lights
// up for old content or unreachable services.
const { deriveDestinationAlerts, alertLabel } = require('./src/nav/alerts.ts');

let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); } };
const NOW = Date.parse('2026-08-29T12:00:00Z');

console.log('=== alerts: notifications route to their destination ===');
{
  const a = deriveDestinationAlerts({
    notifications: [
      { kind: 'challenge', read: false },
      { kind: 'challenge', read: true },            // read -> silent
      { kind: 'workflow', read: false },
      { kind: 'confirmed', read: false },
      { kind: 'saved_changed', read: false },
      { kind: 'event_soon', read: false },
      { kind: 'system', read: false }
    ],
    lastSeen: {}, now: NOW
  });
  check('unread challenges light Arena', a.arena === 1, JSON.stringify(a));
  check('workflow notices light Workflows', a.workflows === 1, JSON.stringify(a));
  check('personal notices light My Layer (4 kinds)', a.mylayer === 4, JSON.stringify(a));
  check('a READ notification lights nothing', deriveDestinationAlerts({
    notifications: [{ kind: 'challenge', read: true }], lastSeen: {}, now: NOW
  }).arena === 0);
}

console.log('\n=== alerts: public freshness beats the last-seen clock ===');
{
  const a = deriveDestinationAlerts({
    rooms: [
      { createdAt: '2026-08-29T11:30:00Z' },        // after seen -> new
      { createdAt: '2026-08-28T10:00:00Z' }         // before seen -> old
    ],
    feedItems: [
      { createdAt: '2026-08-29T11:55:00Z' },        // new
      { publishedAt: '2026-08-20T09:00:00Z' },      // old
      { updatedAt: '2026-08-29T11:30:00Z' },        // new
      { updatedAt: '2026-08-29T11:00:00Z' }         // exactly at the seen mark -> already seen
    ],
    lastSeen: { arena: Date.parse('2026-08-29T11:00:00Z'), nearby: Date.parse('2026-08-29T11:00:00Z') },
    now: NOW
  });
  check('a room created since the last visit lights Arena', a.arena === 1, JSON.stringify(a));
  check('feed items newer than the last visit light Nearby', a.nearby === 2, JSON.stringify(a));
}

console.log('\n=== alerts: first visit baselines silently, never fakes ===');
{
  const a = deriveDestinationAlerts({
    rooms: [{ createdAt: '2020-01-01T00:00:00Z' }],
    feedItems: [{ createdAt: '2019-01-01T00:00:00Z' }],
    lastSeen: {}, now: NOW            // missing lastSeen == baseline now
  });
  check('no destination lights on first visit', a.nearby === 0 && a.arena === 0 && a.mylayer === 0 && a.workflows === 0, JSON.stringify(a));
}

console.log('\n=== alerts: unreachable services contribute zero ===');
{
  const a = deriveDestinationAlerts({ notifications: null, rooms: null, feedItems: null, lastSeen: {}, now: NOW });
  check('all-zero when every service is unreachable', JSON.stringify(a) === JSON.stringify({ nearby: 0, arena: 0, mylayer: 0, workflows: 0 }), JSON.stringify(a));
}

console.log('\n=== alerts: display label caps at 9+ ===');
{
  check('1 renders as a bare dot label', alertLabel(1) === '1');
  check('counts past nine cap honestly', alertLabel(12) === '9+');
  const a = deriveDestinationAlerts({
    rooms: Array.from({ length: 25 }, () => ({ createdAt: '2026-08-29T11:59:00Z' })),
    lastSeen: { arena: 0 }, now: NOW
  });
  check('the count itself is capped server-side of the UI (20)', a.arena === 20, JSON.stringify(a));
}

console.log(`\nPASS ${pass} FAIL ${fail}`);
process.exit(fail ? 1 : 0);
