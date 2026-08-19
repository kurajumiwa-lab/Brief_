// ---------------------------------------------------------------------------
// SIGNAL SERVICE
//
// A Signal is an append-only record that something happened. Signals are
// emitted by real state changes elsewhere in the server -- never generated to
// make a feed look busy. An empty feed means nothing has happened yet, and
// that is the correct thing to show.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';

export const SIGNAL_TYPES = [
  'source_connected',
  'item_received',
  'object_created',
  'object_viewed',
  'object_saved',
  'object_shared',
  'object_confirmed',
  'object_reported',
  'object_updated',
  'duplicate_merged',
  'circle_created',
  'block_added',
  'target_progressed',
  'campaign_created',
  'campaign_published',
  'campaign_live',
  'campaign_closed',
  'campaign_cancelled',
  'campaign_completed',
  'campaign_viewed',
  'campaign_shared',
  'campaign_registration_started',
  'campaign_registered',
  'campaign_registration_updated',
  'campaign_checkin',
  'campaign_no_show',
  'member_joined',
  // --- Circle operations (Batch 2) -----------------------------------------
  // Each of these is emitted by a real state change on a Block, never by a
  // UI render. They are what the Circle activity feed and a member's evidence
  // history are derived from.
  'task_assigned',
  'task_released',
  'task_completed',
  'vote_cast',
  'vote_closed',
  // --- Commerce (Batch 3) --------------------------------------------------
  // Emitted by real state changes on vendors, listings and orders. An order
  // being placed is an event; a marketplace page being rendered is not.
  'vendor_created',
  'listing_published',
  'listing_paused',
  'listing_archived',
  'order_placed',
  'order_stage_changed',
  // Money genuinely confirmed by a payment provider. Emitted only from the
  // webhook path after a real ledger transaction exists.
  'order_paid',
  // --- Arena ---------------------------------------------------------------
  // Arena reuses the ONE activity layer rather than getting its own analytics
  // table. Every one of these is a real state change on a challenge or match.
  'arena_challenge_opened',
  'arena_challenge_accepted',
  'arena_result_reported',
  'arena_result_confirmed',
  'arena_result_disputed',
  'order_fulfilled',
  'order_settled',
  'order_disputed',
  'order_cancelled',
  'sync_completed',
  'sync_failed',
  // --- Auction (Batch 4) ---------------------------------------------------
  // A bid is an event, not money. These record price discovery; the money
  // events for a won auction are the ORDER's, emitted by the existing
  // commerce signals, because an auction settles through the ordinary chain.
  'auction_opened',
  'bid_placed',
  'auction_closed',
  'auction_order_raised',
  'auction_winner_defaulted',
  'auction_cancelled'
];

export function emitSignal({ type, circleId = null, blockId = null, sourceId = null, objectId = null, actorId = null, value = null, metadata = {} }) {
  if (!SIGNAL_TYPES.includes(type)) {
    throw new Error(`unknown signal type: ${type}`);
  }
  const signal = {
    id: newId('sig'),
    type,
    circleId,
    blockId,
    sourceId,
    objectId,
    // WHO did it. Null for system events (a sync completing has no actor).
    // This is what makes a member's evidence history derivable without a
    // second activity table -- the signal already records the event, it just
    // needs to say whose act it was.
    actorId,
    value,
    metadata,
    createdAt: new Date().toISOString()
  };
  store.insert('signals', signal);
  return signal;
}

// Newest first. Resolves the human-readable source name where one exists so
// the client never has to invent a label.
export function listSignals({ circleId = null, limit = 50 } = {}) {
  let rows = store.all('signals');
  if (circleId) rows = rows.filter((s) => s.circleId === circleId);
  return rows
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
    .map((s) => {
      const src = s.sourceId ? store.find('sources', (x) => x.id === s.sourceId) : null;
      const circ = s.circleId ? store.find('circles', (x) => x.id === s.circleId) : null;
      return {
        ...s,
        sourceName: src?.name ?? null,
        circleName: circ?.name ?? null
      };
    });
}

// ---------------------------------------------------------------------------
// MEMBER EVIDENCE
//
// A member's history, derived from signals they actually caused. There is no
// evidence table: a signal already records that something happened and who
// did it, so a second store would be a duplicate source of truth.
//
// TRUST IS EVIDENCE, NEVER A SCORE. This function deliberately returns a list
// of things that happened -- not a percentage, rating, reliability index or
// hidden ranking. A member who has done nothing has an empty list, and that
// is the honest answer.
// ---------------------------------------------------------------------------

// Signal type -> how it reads as a line of evidence. Only acts a member
// performs themselves appear here.
const EVIDENCE_LABELS = {
  member_joined: 'Joined circle',
  task_completed: 'Completed task',
  task_assigned: 'Took on task',
  vote_cast: 'Voted',
  block_added: 'Contributed',
  campaign_checkin: 'Arrived',
  // Commerce evidence is what a seller ACTUALLY did -- orders fulfilled and
  // settled. Deliberately not a rating: "6 fulfilled orders" is a countable
  // claim the vendor could contest, "4.8 stars" is not.
  order_fulfilled: 'Fulfilled an order',
  order_settled: 'Completed a settled sale'
};

export function memberEvidence(userId, { circleId = null } = {}) {
  if (!userId) return [];
  let rows = store.filter('signals', (s) => s.actorId === userId);
  if (circleId) rows = rows.filter((s) => s.circleId === circleId);

  return rows
    .filter((s) => EVIDENCE_LABELS[s.type])
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((s) => {
      const circ = s.circleId ? store.find('circles', (c) => c.id === s.circleId) : null;
      return {
        kind: s.type,
        label: EVIDENCE_LABELS[s.type],
        circleId: s.circleId,
        circleName: circ?.name ?? null,
        blockId: s.blockId,
        // The underlying signal, so a caller can always inspect what the
        // evidence is actually made of rather than trusting the summary.
        signalId: s.id,
        at: s.createdAt
      };
    });
}

/**
 * The same evidence grouped into counts -- still facts, still no score.
 * "3 completed tasks" is a countable claim a member could contest; "trust:
 * 87%" is not.
 */
export function memberEvidenceSummary(userId, { circleId = null } = {}) {
  const items = memberEvidence(userId, { circleId });
  const counts = {};
  for (const it of items) counts[it.kind] = (counts[it.kind] ?? 0) + 1;

  const PLURAL = {
    task_completed: (n) => `${n} completed task${n === 1 ? '' : 's'}`,
    task_assigned: (n) => `${n} task${n === 1 ? '' : 's'} taken on`,
    vote_cast: (n) => `${n} vote${n === 1 ? '' : 's'} cast`,
    block_added: (n) => `${n} contribution${n === 1 ? '' : 's'}`,
    member_joined: (n) => `Joined ${n} circle${n === 1 ? '' : 's'}`,
    campaign_checkin: (n) => `Arrived ${n} time${n === 1 ? '' : 's'}`,
    order_fulfilled: (n) => `${n} fulfilled order${n === 1 ? '' : 's'}`,
    order_settled: (n) => `${n} settled sale${n === 1 ? '' : 's'}`
  };

  return Object.entries(counts).map(([kind, n]) => ({
    kind,
    count: n,
    label: PLURAL[kind] ? PLURAL[kind](n) : `${n} x ${kind}`
  }));
}
