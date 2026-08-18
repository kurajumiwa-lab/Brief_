// ---------------------------------------------------------------------------
// BLOCK SERVICE
//
// A Block is a unit of content inside a Circle. A Block may wrap an extracted
// Brief object (objectId set) or be authored directly (objectId null).
//
// Wrapping an object does NOT copy it. The Block points at the canonical
// object, so provenance and dedup continue to work through the existing graph.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';

export const BLOCK_TYPES = ['note', 'pin', 'image', 'voice', 'task', 'vote', 'listing'];

// Brief object type -> the Block presentation that fits it.
const TYPE_FROM_OBJECT = {
  event: 'listing',
  product: 'listing',
  service: 'listing',
  experience: 'listing',
  opportunity: 'task',
  knowledge: 'note',
  place: 'pin',
  identity: 'pin'
};

export function listBlocks(circleId) {
  const rows = circleId
    ? store.filter('blocks', (b) => b.circleId === circleId)
    : store.all('blocks');
  return rows.map(hydrate);
}

// Attach the canonical object and its provenance, so the client can render a
// source line without a second round trip. Never fabricates a source.
function hydrate(block) {
  // Operational state is attached on read so a client never has to know that
  // tasks and votes are stored inside block metadata. `tally` is computed
  // from ballot rows on every read -- never cached, never stored.
  const ops = {};
  if (block.type === 'task') ops.task = taskState(block);
  if (block.type === 'vote') ops.tally = tallyVote_(block);

  if (!block.objectId) return { ...block, ...ops, object: null, sources: [] };
  const object = store.find('objects', (o) => o.id === block.objectId) ?? null;
  const links = store.filter('objectSources', (os) => os.objectId === block.objectId);
  const sources = links.map((l) => {
    const s = store.find('sources', (x) => x.id === l.sourceId);
    return {
      sourceId: l.sourceId,
      sourceName: s?.name ?? null,
      sourceUrl: l.sourceUrl ?? null,
      sourcePublishedAt: l.sourcePublishedAt ?? null
    };
  });
  return { ...block, ...ops, object, sources };
}

/**
 * Tally from a block already in hand. Split from the exported tallyVote() so
 * hydrate() does not re-fetch the row it was just given.
 */
function tallyVote_(block) {
  const ballots = store.filter('votes', (v) => v.blockId === block.id);
  const opts = Array.isArray(block.metadata?.vote?.options) ? block.metadata.vote.options : [];
  const counts = Object.fromEntries(opts.map((o) => [o, 0]));
  for (const b of ballots) if (b.option in counts) counts[b.option] += 1;
  const totalVotes = ballots.length;
  const results = opts.map((option) => ({
    option,
    count: counts[option],
    pct: totalVotes > 0 ? (counts[option] / totalVotes) * 100 : null
  }));
  const top = [...results].sort((a, b) => b.count - a.count);
  const leader =
    totalVotes > 0 && (top.length === 1 || top[0].count > top[1].count) ? top[0].option : null;
  return {
    blockId: block.id,
    circleId: block.circleId,
    closed: Boolean(block.metadata?.vote?.closed),
    totalVotes,
    eligibleCount: store.filter('members', (m) => m.circleId === block.circleId).length,
    results,
    leader
  };
}

export function getBlock(id) {
  const b = store.find('blocks', (x) => x.id === id);
  return b ? hydrate(b) : null;
}

/**
 * Promote an existing extracted object into a Circle. Idempotent per
 * (circle, object) pair so re-running ingestion never duplicates a Block.
 */
export function createBlockFromObject(objectId, circleId, overrides = {}) {
  const object = store.find('objects', (o) => o.id === objectId);
  if (!object) throw new Error('object not found');
  const circle = store.find('circles', (c) => c.id === circleId);
  if (!circle) throw new Error('circle not found');

  const existing = store.find(
    'blocks',
    (b) => b.objectId === objectId && b.circleId === circleId
  );
  if (existing) return hydrate(existing);

  const now = new Date().toISOString();
  const block = {
    id: newId('blk'),
    circleId,
    objectId: object.id,
    type: overrides.type || TYPE_FROM_OBJECT[object.type] || 'note',
    content: overrides.content || object.title || '',
    weight: 0,
    validatedBy: null,
    createdAt: now,
    updatedAt: now
  };
  store.insert('blocks', block);
  return hydrate(block);
}

export function createBlock({ circleId, type, content, metadata = {} }) {
  const circle = store.find('circles', (c) => c.id === circleId);
  if (!circle) throw new Error('circle not found');
  if (!BLOCK_TYPES.includes(type)) {
    throw new Error(`type must be one of ${BLOCK_TYPES.join(', ')}`);
  }
  if (!content || !String(content).trim()) throw new Error('content is required');

  // Operational block types carry validated starting state. Building it here
  // means a task always begins 'open' and a vote always has real options --
  // neither can be created in a shape the transition rules cannot handle.
  const clean = { ...metadata };

  if (type === 'task') {
    // A task is always born unassigned. Accepting an assignee at creation
    // would skip the membership check that assignTask() performs.
    clean.task = { status: 'open', assigneeId: null, completedAt: null, completedBy: null };
  }

  if (type === 'vote') {
    const options = Array.isArray(metadata?.options)
      ? metadata.options.map((o) => String(o).trim()).filter(Boolean)
      : [];
    const unique = Array.from(new Set(options));
    // Two distinct options is the minimum for a choice to mean anything. A
    // one-option "vote" is a formality with a predetermined result.
    if (unique.length < 2) throw new Error('a vote needs at least two distinct options');
    if (unique.length !== options.length) throw new Error('vote options must be unique');
    clean.vote = { options: unique, closed: false, closedAt: null };
    delete clean.options;
  }

  const now = new Date().toISOString();
  const block = {
    id: newId('blk'),
    circleId,
    objectId: null,
    type,
    content: String(content).trim(),
    weight: 0,
    validatedBy: null,
    metadata: clean,
    createdAt: now,
    updatedAt: now
  };
  store.insert('blocks', block);
  return hydrate(block);
}

// ---------------------------------------------------------------------------
// TASKS
//
// A task is a Block of type 'task'. There is deliberately no tasks table: the
// Block primitive already carries circle, content, timestamps and metadata,
// and a parallel table would be a second source of truth for the same thing.
//
// Task-specific state lives in block.metadata under a `task` key, so an
// ordinary block read still works and nothing else in the system needs to
// know tasks exist.
//
// Lifecycle:      open --assign--> assigned --complete--> completed
//                   ^                  |
//                   +----- release ----+
//
// Every transition below is validated. A caller cannot jump straight to
// completed, cannot complete a task nobody holds, and cannot reopen finished
// work -- the same discipline the ledger applies to money.
// ---------------------------------------------------------------------------

export const TASK_STATUS = ['open', 'assigned', 'completed'];

const TASK_TRANSITIONS = {
  open: ['assigned'],
  // A completed task is terminal. Reopening it would erase the evidence that
  // it was ever finished, exactly as reviving a cancelled payment would.
  assigned: ['completed', 'open'],
  completed: []
};

/** The task state carried by a block, or null when it is not a task. */
export function taskState(block) {
  if (!block || block.type !== 'task') return null;
  const t = block.metadata?.task;
  if (!t) return { status: 'open', assigneeId: null, completedAt: null, completedBy: null };
  return {
    status: TASK_STATUS.includes(t.status) ? t.status : 'open',
    assigneeId: t.assigneeId ?? null,
    completedAt: t.completedAt ?? null,
    completedBy: t.completedBy ?? null
  };
}

function requireTask(blockId) {
  const block = store.find('blocks', (b) => b.id === blockId);
  if (!block) throw new Error('block not found');
  if (block.type !== 'task') throw new Error('block is not a task');
  return block;
}

function assertTransition(from, to) {
  const allowed = TASK_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) throw new Error(`invalid task transition: ${from} -> ${to}`);
}

/**
 * Assign a task to a member of the SAME circle.
 *
 * Idempotent: assigning to whoever already holds it is a no-op that returns
 * the block unchanged, so a double-tap cannot manufacture two assignment
 * signals for one real event (the Phase 9 lesson).
 */
export function assignTask(blockId, assigneeId) {
  const block = requireTask(blockId);
  const state = taskState(block);

  if (state.status === 'assigned' && state.assigneeId === assigneeId) {
    return { block: hydrate(block), changed: false };
  }

  // Membership is checked BEFORE the transition. Ordering matters: assigning
  // an outsider to an already-assigned task should report the real problem
  // ("not a member"), not a confusing 'assigned -> assigned' transition error.
  const member = store.find(
    'members',
    (m) => m.circleId === block.circleId && m.userId === assigneeId
  );
  if (!member) throw new Error('assignee is not a member of this circle');

  // Reassignment from one member to another is legitimate, so 'assigned' is
  // a valid starting point here as well as 'open'.
  if (state.status !== 'assigned') assertTransition(state.status, 'assigned');

  const task = { ...taskState(block), status: 'assigned', assigneeId };
  store.update('blocks', block.id, { metadata: { ...(block.metadata ?? {}), task } });
  return { block: hydrate(store.find('blocks', (b) => b.id === block.id)), changed: true };
}

/** Return an assigned task to the pool. */
export function releaseTask(blockId) {
  const block = requireTask(blockId);
  const state = taskState(block);
  if (state.status === 'open') return { block: hydrate(block), changed: false };
  assertTransition(state.status, 'open');

  const task = { ...state, status: 'open', assigneeId: null };
  store.update('blocks', block.id, { metadata: { ...(block.metadata ?? {}), task } });
  return { block: hydrate(store.find('blocks', (b) => b.id === block.id)), changed: true };
}

/**
 * Complete a task. Only the assignee or a coordinator may do this, which the
 * route enforces -- this function records the fact and refuses illegal
 * transitions (completing an unassigned task, or completing twice).
 */
export function completeTask(blockId, completedBy) {
  const block = requireTask(blockId);
  const state = taskState(block);

  if (state.status === 'completed') return { block: hydrate(block), changed: false };
  assertTransition(state.status, 'completed');

  const task = {
    ...state,
    status: 'completed',
    completedBy: completedBy ?? state.assigneeId ?? null,
    completedAt: new Date().toISOString()
  };
  store.update('blocks', block.id, { metadata: { ...(block.metadata ?? {}), task } });
  return { block: hydrate(store.find('blocks', (b) => b.id === block.id)), changed: true };
}

// ---------------------------------------------------------------------------
// VOTES
//
// A vote is a Block of type 'vote'. The options live on the block; each cast
// ballot is stored as a row in `votes`, keyed by (blockId, voterId).
//
// THE TALLY IS DERIVED. There is no stored totalVotes counter -- counts are
// computed by scanning the actual ballots every time. A stored counter can
// drift from the records it claims to summarise; a derived one cannot.
// ---------------------------------------------------------------------------

export function voteOptions(block) {
  if (!block || block.type !== 'vote') return [];
  const opts = block.metadata?.vote?.options;
  return Array.isArray(opts) ? opts : [];
}

export function isVoteClosed(block) {
  return Boolean(block?.metadata?.vote?.closed);
}

/**
 * Cast a ballot. One member, one vote: a second call from the same voter is
 * rejected rather than silently replacing the first, so a tally can never be
 * inflated by re-submitting.
 */
export function castVote(blockId, voterId, option) {
  const block = store.find('blocks', (b) => b.id === blockId);
  if (!block) throw new Error('block not found');
  if (block.type !== 'vote') throw new Error('block is not a vote');
  if (isVoteClosed(block)) throw new Error('vote is closed');

  const options = voteOptions(block);
  if (!options.includes(option)) {
    throw new Error(`option must be one of ${options.join(', ')}`);
  }

  // Voting is a membership right. A non-member cannot vote in a circle, and
  // nobody can vote in a circle they do not belong to.
  const member = store.find(
    'members',
    (m) => m.circleId === block.circleId && m.userId === voterId
  );
  if (!member) throw new Error('only members of this circle may vote');

  const existing = store.find('votes', (v) => v.blockId === blockId && v.voterId === voterId);
  if (existing) throw new Error('this member has already voted');

  const row = {
    id: newId('vote'),
    blockId,
    circleId: block.circleId,
    voterId,
    option,
    createdAt: new Date().toISOString()
  };
  store.insert('votes', row);
  return row;
}

/** Close a vote so no further ballots are accepted. Idempotent. */
export function closeVote(blockId) {
  const block = store.find('blocks', (b) => b.id === blockId);
  if (!block) throw new Error('block not found');
  if (block.type !== 'vote') throw new Error('block is not a vote');
  if (isVoteClosed(block)) return { block: hydrate(block), changed: false };

  const vote = { ...(block.metadata?.vote ?? {}), closed: true, closedAt: new Date().toISOString() };
  store.update('blocks', block.id, { metadata: { ...(block.metadata ?? {}), vote } });
  return { block: hydrate(store.find('blocks', (b) => b.id === block.id)), changed: true };
}

/**
 * Tally, computed from the ballot rows themselves.
 *
 * Every declared option appears even with zero votes -- omitting them would
 * misrepresent the result by hiding what was rejected.
 */
export function tallyVote(blockId) {
  const block = store.find('blocks', (b) => b.id === blockId);
  if (!block) throw new Error('block not found');
  if (block.type !== 'vote') throw new Error('block is not a vote');

  const ballots = store.filter('votes', (v) => v.blockId === blockId);
  const options = voteOptions(block);

  const counts = Object.fromEntries(options.map((o) => [o, 0]));
  for (const b of ballots) {
    if (b.option in counts) counts[b.option] += 1;
  }

  const totalVotes = ballots.length;
  const results = options.map((option) => ({
    option,
    count: counts[option],
    // Share of ballots actually cast. Null rather than 0 when nobody has
    // voted: 0% would imply a measurement that has not happened.
    pct: totalVotes > 0 ? (counts[option] / totalVotes) * 100 : null
  }));

  // A leader only exists if one option is strictly ahead. A tie reports no
  // leader rather than silently picking the first.
  const top = [...results].sort((a, b) => b.count - a.count);
  const leader =
    totalVotes > 0 && (top.length === 1 || top[0].count > top[1].count) ? top[0].option : null;

  return {
    blockId,
    circleId: block.circleId,
    closed: isVoteClosed(block),
    totalVotes,
    eligibleCount: store.filter('members', (m) => m.circleId === block.circleId).length,
    results,
    leader
  };
}
