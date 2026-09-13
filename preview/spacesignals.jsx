// ---------------------------------------------------------------------------
// SPACE SIGNALS — the honest "needs your attention" derivation. Every signal
// comes from real rows on the hydrated space; nothing is seeded or guessed.
// ---------------------------------------------------------------------------
const assert = require('assert').strict;
const { needsAttention, attentionQueue, splitSpaces } = require('./src/features/home/spaceSignals.ts');

let count = 0;
const pass = (name) => { count++; console.log('PASS ' + name); };

function space(over = {}) {
  return {
    id: 'spc_1', ownerId: 'u1', vendorId: 'v1', name: 'Test Space', type: 'business',
    goal: '', targetValueKes: 0, status: 'active', capabilities: [],
    metrics: { revenueKes: 0, customerCount: 0, activeOrdersCount: 0, totalOrdersCount: 0, offersCount: 0 },
    offers: [], recentActivities: [], recentConversations: [],
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...over
  };
}

async function main() {
  // --- a quiet space needs nothing ---
  assert.deepEqual(needsAttention(space()), []);
  pass('a space with no open rows needs no attention');

  // --- open conversation / draft offer / active order each signal ---
  {
    const items = needsAttention(space({
      recentConversations: [
        { id: 'c1', spaceId: 'spc_1', customerName: 'A', status: 'new', messages: [], createdAt: '', updatedAt: '' },
        { id: 'c2', spaceId: 'spc_1', customerName: 'B', status: 'converted', messages: [], createdAt: '', updatedAt: '' }
      ],
      offers: [{ id: 'o1', status: 'draft' }, { id: 'o2', status: 'active' }],
      metrics: { revenueKes: 0, customerCount: 0, activeOrdersCount: 2, totalOrdersCount: 2, offersCount: 2 }
    }));
    assert.equal(items.length, 3, 'three distinct signals');
    assert.ok(items.some((i) => i.kind === 'conversation' && i.count === 1), 'one open conversation');
    assert.ok(items.some((i) => i.kind === 'offer' && i.count === 1), 'one draft offer');
    assert.ok(items.some((i) => i.kind === 'order' && i.count === 2), 'two active orders');
  }
  pass('open conversations, draft offers and active orders each produce a signal');

  // --- the queue is ordered most-needing first, and excludes archived ---
  {
    const a = space({ id: 'a', name: 'A', status: 'active', metrics: { revenueKes: 0, customerCount: 0, activeOrdersCount: 1, totalOrdersCount: 1, offersCount: 0 } });
    const b = space({ id: 'b', name: 'B', status: 'active', recentConversations: [{ id: 'c', spaceId: 'b', customerName: 'X', status: 'new', messages: [], createdAt: '', updatedAt: '' }], offers: [{ id: 'o', status: 'draft' }] });
    const arch = space({ id: 'c', name: 'Archived', status: 'archived', metrics: { revenueKes: 0, customerCount: 0, activeOrdersCount: 9, totalOrdersCount: 9, offersCount: 0 } });
    const q = attentionQueue([a, b, arch]);
    assert.equal(q.length, 2, 'archived is excluded');
    assert.equal(q[0].space.id, 'b', 'the space with more signals sorts first');
  }
  pass('the attention queue orders most-needing first and excludes archived');

  // --- splitSpaces separates active from archived ---
  {
    const { active, archived } = splitSpaces([
      space({ id: 'x', status: 'active' }),
      space({ id: 'y', status: 'archived' }),
      space({ id: 'z', status: 'active' })
    ]);
    assert.equal(active.length, 2);
    assert.equal(archived.length, 1);
  }
  pass('splitSpaces separates the feed into active and archived');

  console.log('\nPASS ' + count);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
