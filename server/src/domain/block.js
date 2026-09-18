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
import * as history from './circleHistory.js';

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

  // Wrapped, not authored: the honest kind for a block that came from an
  // extracted object. A record that says "someone created a task" when the
  // pipeline ingested one would put words in a person's mouth.
  history.append({
    circleId,
    subject: block.id,
    subjectKind: type,
    kind: 'block_wrapped',
    after: String(block.content ?? '').slice(0, 200),
    metadata: { objectId: block.objectId ?? null }
  });
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

    // THE ROLL IS SNAPSHOT AT CREATION. A coordinator who could add members
    // mid-vote could manufacture a majority, and one who could remove them
    // could delete the opposition; a fixed list makes both impossible. Ghost
    // invitations are not on it — only people who are members right now.
    const roll = store
      .filter('members', (m) => m.circleId === circleId && m.status !== 'ended')
      .map((m) => m.userId);
    if (!roll.length) throw new Error('a vote needs at least one member to be eligible to cast it');

    let closesAt = metadata?.closesAt ? Date.parse(metadata.closesAt) : NaN;
    if (!Number.isFinite(closesAt)) closesAt = null;
    else if (closesAt <= Date.now()) throw new Error('closesAt must be in the future — a vote cannot open already closed');
    const quorum = Math.max(1, Math.min(Number(metadata?.quorum) || 1, roll.length));

    clean.vote = {
      options: unique,
      closed: false,
      closedAt: null,
      // When it closes on its own. A vote ends at a time, not when the person
      // in charge happens to like the running total.
      closesAt: closesAt ? new Date(closesAt).toISOString() : null,
      quorum,
      eligibleAt: roll,
      eligibleCount: roll.length,
      secret: metadata?.secret === true || metadata?.secret === 'true',
      cancelled: false,
      cancelledAt: null,
      cancelledBy: null,
      cancelReason: null
    };
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

  // The opening entry, so a thread of changes has a first line: without it
  // "deadline moved to Friday" floats with nothing it moved from.
  history.append({
    circleId,
    subject: block.id,
    subjectKind: type,
    kind: type === 'task' ? 'task_created' : type === 'vote' ? 'vote_created' : 'block_created',
    after: type === 'vote' ? clean.vote.options.join(' | ') : block.content.slice(0, 200),
    actorId: metadata?.actorId ?? null
  });
  if (type === 'vote') {
    history.append({
      circleId, subject: block.id, subjectKind: 'vote', kind: 'vote_roll_snapshotted',
      after: `${clean.vote.eligibleCount} eligible voter${clean.vote.eligibleCount === 1 ? '' : 's'}, quorum ${clean.vote.quorum}`,
      actorId: metadata?.actorId ?? null
    });
  }
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

export const TASK_STATUS = ['open', 'assigned', 'completed', 'cancelled'];

const TASK_TRANSITIONS = {
  open: ['assigned', 'cancelled'],
  assigned: ['completed', 'open', 'cancelled'],
  // Finished work CAN be reopened — but only with a reason, and the completion
  // row stays in history. What is not allowed is a silent un-completion: the
  // reopened task carries the record of having been marked done.
  completed: ['open', 'cancelled'],
  cancelled: ['open']
};

/** The task state carried by a block, or null when it is not a task. */
export function taskState(block) {
  if (!block || block.type !== 'task') return null;
  const t = block.metadata?.task;
  if (!t) return { status: 'open', assigneeId: null, completedAt: null, completedBy: null, verifiedAt: null, verifiedBy: null, dueAt: null, cancelledAt: null, cancelReason: null, evidence: null };
  return {
    status: TASK_STATUS.includes(t.status) ? t.status : 'open',
    assigneeId: t.assigneeId ?? null,
    completedAt: t.completedAt ?? null,
    completedBy: t.completedBy ?? null,
    // Complete and verified are SEPARATE facts. The person who did the work
    // attests to doing it; the coordinator attests that it landed. One field
    // for both would let a self-certification read as an approval.
    verifiedAt: t.verifiedAt ?? null,
    verifiedBy: t.verifiedBy ?? null,
    dueAt: t.dueAt ?? null,
    cancelledAt: t.cancelledAt ?? null,
    cancelReason: t.cancelReason ?? null,
    evidence: t.evidence ?? null
  };
}


/**
 * The ONLY way task state changes. Writing the row and appending its history
 * happen together, so there is no code path that can move a task without
 * leaving a mark — which is the property the whole design rests on.
 */
function mutateTask(block, patch, entry) {
  const task = { ...taskState(block), ...patch };
  store.update('blocks', block.id, { metadata: { ...(block.metadata ?? {}), task }, updatedAt: new Date().toISOString() });
  const fresh = store.find('blocks', (b) => b.id === block.id);
  history.append({ circleId: block.circleId, subject: block.id, subjectKind: 'task', ...entry });
  return fresh;
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
export function assignTask(blockId, assigneeId, { actorId = null, reason = null } = {}) {
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

  const fresh = mutateTask(block, { status: 'assigned', assigneeId }, {
    kind: state.status === 'assigned' ? 'task_reassigned' : 'task_assigned',
    field: 'assigneeId',
    before: state.assigneeId,
    after: assigneeId,
    actorId: assigneeId,
    // Taking over someone else's task is exactly the kind of change a group
    // should be able to ask "why?" about afterwards.
    reason: state.status === 'assigned' ? reason : null
  });
  return { block: hydrate(fresh), changed: true };
}

/**
 * Return an assigned task to the pool.
 *
 * Only an ASSIGNED task can be released. Finishing and then "releasing" is a
 * reopen, and a reopen is the one transition a group is most likely to abuse —
 * un-completing someone's late work silently. reopenTask() does it, and asks
 * why.
 */
export function releaseTask(blockId) {
  const block = requireTask(blockId);
  const state = taskState(block);
  if (state.status === 'open') return { block: hydrate(block), changed: false };
  if (state.status !== 'assigned') {
    throw new Error('work that is finished or cancelled is reopened with a reason, not released');
  }
  assertTransition(state.status, 'open');

  const fresh = mutateTask(block, { status: 'open', assigneeId: null }, {
    kind: 'task_released',
    field: 'assigneeId',
    before: state.assigneeId,
    after: null,
    actorId: state.assigneeId
  });
  return { block: hydrate(fresh), changed: true };
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

  const fresh = mutateTask(block, {
    status: 'completed',
    completedBy: completedBy ?? state.assigneeId ?? null,
    completedAt: new Date().toISOString()
  }, {
    kind: 'task_completed',
    field: 'status',
    before: state.status,
    after: 'completed',
    actorId: completedBy ?? state.assigneeId ?? null
  });
  return { block: hydrate(fresh), changed: true };
}

/**
 * Edit a task. Before anyone claims it, its wording is the author's to fix.
 * After a claim, the terms the claimant agreed to are locked: the title cannot
 * change and the deadline only can, with a reason — because moving a deadline
 * after someone missed it is the single easiest lie to tell in a group app, and
 * the only defence is that the move is on the record.
 */
export function editTask(blockId, { actorId = null, title = null, description = null, dueAt = null, reason = null } = {}) {
  const block = requireTask(blockId);
  const state = taskState(block);
  if (state.status === 'cancelled') throw new Error('a cancelled task is reopened, not edited');
  const claimed = state.status !== 'open';

  const entries = [];
  const nextMeta = { ...(block.metadata ?? {}) };
  let nextContent = block.content;
  let taskPatch = null;

  if (title != null && String(title).trim() && String(title).trim() !== block.content) {
    if (claimed) throw new Error('the title is locked once the task is claimed — those were the terms it was taken on');
    entries.push({ kind: 'task_edited', field: 'title', before: block.content, after: String(title).trim(), actorId });
    nextContent = String(title).trim();
  }
  if (description != null && String(description).trim() !== String(block.metadata?.description ?? '')) {
    entries.push({ kind: 'task_edited', field: 'description', before: block.metadata?.description ?? null, after: String(description).trim(), actorId });
    nextMeta.description = String(description).trim();
  }
  if (dueAt != null) {
    const next = dueAt === '' ? null : Date.parse(dueAt);
    if (dueAt !== '' && !Number.isFinite(next)) throw new Error('dueAt must be a real date');
    const normalised = dueAt === '' ? null : new Date(next).toISOString();
    if (normalised !== (state.dueAt ?? null)) {
      if (!String(reason ?? '').trim()) throw new Error('a deadline move needs a reason — it goes in the history');
      entries.push({ kind: 'task_due_changed', field: 'dueAt', before: state.dueAt ?? null, after: normalised, actorId, reason });
      taskPatch = { ...(taskPatch ?? {}), dueAt: normalised };
    }
  }
  if (!entries.length) return { block: hydrate(block), changed: false, edits: 0 };

  // One write for the row, one history row per change. Kept in the same call so
  // the two can never disagree about what happened.
  if (taskPatch) {
    const merged = { ...taskState(block), ...taskPatch };
    store.update('blocks', block.id, { content: nextContent, metadata: { ...nextMeta, task: merged }, updatedAt: new Date().toISOString() });
  } else {
    store.update('blocks', block.id, { content: nextContent, metadata: nextMeta, updatedAt: new Date().toISOString() });
  }
  for (const e of entries) history.append({ circleId: block.circleId, subject: block.id, subjectKind: 'task', ...e });
  return { block: hydrate(store.find('blocks', (b) => b.id === block.id)), changed: true, edits: entries.length };
}

/**
 * Cancel a task. There is no delete: this is the only way a task leaves the
 * active list, and it carries the reason in public.
 */
export function cancelTask(blockId, { actorId = null, reason = null } = {}) {
  const block = requireTask(blockId);
  const state = taskState(block);
  if (state.status === 'cancelled') return { block: hydrate(block), changed: false };
  const clean = String(reason ?? '').trim();
  if (!clean) throw new Error('a cancellation needs a reason — a task that vanishes without one looks like a task hidden');
  const fresh = mutateTask(block, { status: 'cancelled', cancelledAt: new Date().toISOString(), cancelReason: clean.slice(0, 500) }, {
    kind: 'task_cancelled', field: 'status', before: state.status, after: 'cancelled', actorId, reason: clean
  });
  return { block: hydrate(fresh), changed: true };
}

/** Reopen a completed or cancelled task. The earlier rows stay true. */
export function reopenTask(blockId, { actorId = null, reason = null } = {}) {
  const block = requireTask(blockId);
  const state = taskState(block);
  if (state.status === 'open') return { block: hydrate(block), changed: false };
  if (state.status === 'assigned') throw new Error('it is already open to its assignee — release it instead');
  const clean = String(reason ?? '').trim();
  if (!clean) throw new Error('reopening finished work needs a reason');
  const fresh = mutateTask(block, {
    status: 'open', assigneeId: null,
    // completedAt is deliberately NOT cleared: the fact that it was once
    // completed remains, and the reopen row sits after it.
    cancelledAt: null, cancelReason: null, verifiedAt: null, verifiedBy: null
  }, { kind: 'task_reopened', field: 'status', before: state.status, after: 'open', actorId, reason: clean });
  return { block: hydrate(fresh), changed: true };
}

/** Verification is its own act: "done" is attested by the doer, this by the coordinator. */
export function verifyTask(blockId, { actorId = null } = {}) {
  const block = requireTask(blockId);
  const state = taskState(block);
  if (state.status !== 'completed') throw new Error('only a completed task can be verified');
  if (state.verifiedAt) return { block: hydrate(block), changed: false };
  const fresh = mutateTask(block, { verifiedAt: new Date().toISOString(), verifiedBy: actorId }, {
    kind: 'task_verified', field: 'verifiedAt', before: null, after: actorId, actorId
  });
  return { block: hydrate(fresh), changed: true };
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

/**
 * A vote is closed when it was closed, when it was cancelled, or when its own
 * deadline passed — whichever came first. The third one is the point: the close
 * is a time, and a time cannot be edited by whoever dislikes the running total.
 */
export function isVoteClosed(block, now = Date.now()) {
  const v = block?.metadata?.vote;
  if (!v) return false;
  if (v.closed || v.cancelled) return true;
  const at = Date.parse(v.closesAt ?? '');
  return Number.isFinite(at) && now >= at;
}

/** Who may still cast: the roll taken at creation, minus anyone who has left. */
export function voteEligibility(block) {
  const v = block?.metadata?.vote ?? {};
  const roll = Array.isArray(v.eligibleAt) ? v.eligibleAt : [];
  const stillIn = new Set(
    store.filter('members', (m) => m.circleId === block?.circleId && m.status !== 'ended').map((m) => m.userId)
  );
  return {
    eligible: roll,
    eligibleCount: roll.length,
    quorum: v.quorum ?? null,
    secret: Boolean(v.secret),
    leftSinceOpen: roll.filter((id) => !stillIn.has(id)).length
  };
}

/**
 * Cast a ballot. One member, one vote: a second call from the same voter is
 * rejected rather than silently replacing the first, so a tally can never be
 * inflated by re-submitting.
 */
export function castVote(blockId, voterId, option, { now = Date.now(), allowChange = false } = {}) {
  const block = store.find('blocks', (b) => b.id === blockId);
  if (!block) throw new Error('block not found');
  if (block.type !== 'vote') throw new Error('block is not a vote');
  const v = block.metadata?.vote ?? {};
  if (v.cancelled) throw new Error('this vote was cancelled — its record stands, but nothing more can be cast on it');
  if (isVoteClosed(block, now)) throw new Error('vote is closed');

  const options = voteOptions(block);
  if (!options.includes(option)) {
    throw new Error(`option must be one of ${options.join(', ')}`);
  }

  // Voting is a membership right AND a right of the roll taken at creation.
  const member = store.find(
    'members',
    (m) => m.circleId === block.circleId && m.userId === voterId && m.status !== 'ended'
  );
  if (!member) throw new Error('only members of this circle may vote');
  if (Array.isArray(v.eligibleAt) && !v.eligibleAt.includes(voterId)) {
    throw new Error('this circle added you after the vote opened — eligibility is fixed when a vote is created, so a majority cannot be manufactured mid-count');
  }

  const existing = store
    .filter('votes', (x) => x.blockId === blockId && x.voterId === voterId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  if (existing && !allowChange) {
    throw new Error('this member has already voted — change your vote rather than adding a second ballot');
  }

  const row = {
    id: newId('vote'),
    blockId,
    circleId: block.circleId,
    // A sealed ballot stores a keyed hash instead of a person. The count stays
    // auditable; the choice stays the voter's.
    voterId: v.secret ? null : voterId,
    voterHash: v.secret ? history.voterHash(blockId, voterId) : null,
    option,
    supersedes: existing?.id ?? null,
    createdAt: new Date().toISOString()
  };
  if (existing) store.update('votes', existing.id, { supersededAt: row.createdAt });
  store.insert('votes', row);

  history.append({
    circleId: block.circleId,
    subject: blockId,
    subjectKind: 'vote',
    kind: existing ? 'vote_changed' : 'vote_cast',
    field: 'option',
    before: existing?.option ?? null,
    after: option,
    actorId: voterId,
    // No reason is demanded for changing your mind, and none is invented here:
    // the before/after pair in this row is the whole explanation.
    redact: Boolean(v.secret)
  });
  return row;
}

/** Changing your own vote before the close is allowed; the earlier ballot is
 *  superseded, never removed, so "changed at the last second" is visible. */
/**
 * Change your own vote before the close. A new ballot row is written and the old
 * one is marked superseded — never rewritten, never removed — so "changed at the
 * last second" is a fact the circle can read, and the arithmetic still counts one
 * person once.
 */
export function changeVote(blockId, voterId, option, opts = {}) {
  return castVote(blockId, voterId, option, { ...opts, allowChange: true });
}

/**
 * Closing early is NOT offered to a coordinator once ballots exist: whoever can
 * end a count at a moment of their choosing can end it while they are ahead.
 * With no votes cast, closing is harmless housekeeping. With votes on it, the
 * honest alternatives are to let the deadline arrive, or to cancel — and a
 * cancellation is a reason in the history that every member can read.
 */
export function closeVote(blockId, { actorId = null, now = Date.now() } = {}) {
  const block = store.find('blocks', (b) => b.id === blockId);
  if (!block) throw new Error('block not found');
  if (block.type !== 'vote') throw new Error('block is not a vote');
  const ballots = store.filter('votes', (v) => v.blockId === blockId);
  if (ballots.length) {
    throw new Error('a vote with ballots cannot be closed by hand — it closes at its own deadline, or you cancel it with a reason everyone can read');
  }
  const v = block.metadata?.vote ?? {};
  if (v.closed) return { block: hydrate(block), changed: false };
  const vote = { ...v, closed: true, closedAt: new Date(now).toISOString() };
  store.update('blocks', block.id, { metadata: { ...(block.metadata ?? {}), vote } });
  history.append({
    circleId: block.circleId, subject: block.id, subjectKind: 'vote', kind: 'vote_closed_early',
    field: 'closed', before: false, after: true, actorId,
    reason: 'no ballots had been cast'
  });
  return { block: hydrate(store.find('blocks', (b) => b.id === blockId)), changed: true };
}

/** Cancel a vote. The ballots and the reason stay visible forever. */
export function cancelVote(blockId, { actorId = null, reason = null } = {}) {
  const block = store.find('blocks', (b) => b.id === blockId);
  if (!block) throw new Error('block not found');
  if (block.type !== 'vote') throw new Error('block is not a vote');
  const v = block.metadata?.vote ?? {};
  if (v.cancelled) return { block: hydrate(block), changed: false };
  const clean = String(reason ?? '').trim();
  if (!clean) throw new Error('cancelling a vote needs a reason — the group is entitled to know why their ballots were set aside');
  const vote = { ...v, cancelled: true, cancelledAt: new Date().toISOString(), cancelledBy: actorId ?? null, cancelReason: clean.slice(0, 500) };
  store.update('blocks', block.id, { metadata: { ...(block.metadata ?? {}), vote } });
  history.append({
    circleId: block.circleId, subject: blockId, subjectKind: 'vote', kind: 'vote_cancelled',
    field: 'cancelled', before: false, after: true, actorId, reason: clean
  });
  return { block: hydrate(store.find('blocks', (b) => b.id === blockId)), changed: true };
}

/**
 * Tally, computed from the ballot rows themselves.
 *
 * Every declared option appears even with zero votes -- omitting them would
 * misrepresent the result by hiding what was rejected.
 */
export function tallyVote(blockId, { now = Date.now() } = {}) {
  const block = store.find('blocks', (b) => b.id === blockId);
  if (!block) throw new Error('block not found');
  if (block.type !== 'vote') throw new Error('block is not a vote');

  const v = block.metadata?.vote ?? {};
  const options = voteOptions(block);
  // Only the CURRENT ballot of each voter counts. A changed vote leaves its
  // earlier row in place (and in history) but out of the arithmetic, so one
  // person is one vote now and forever, and the change is still readable.
  const all = store.filter('votes', (x) => x.blockId === blockId);
  const live = all.filter((x) => !x.supersededAt);
  const identities = new Set(live.map((x) => x.voterHash ?? x.voterId));

  const counts = Object.fromEntries(options.map((o) => [o, 0]));
  for (const b of live) if (b.option in counts) counts[b.option] += 1;

  const totalVotes = identities.size;
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

  const eligibleCount = Array.isArray(v.eligibleAt) && v.eligibleAt.length ? v.eligibleAt.length : 0;
  const quorum = v.quorum ?? null;
  const quorumMet = quorum == null ? null : totalVotes >= quorum;
  const closed = isVoteClosed(block, now);

  // "failed quorum" is a state, printed as one. It is not nothing, and it is
  // not a decision — a group that only ever sees "3 voted yes" can quietly
  // claim a mandate that never arrived.
  const status = v.cancelled ? 'cancelled' : !closed ? 'open' : quorumMet === false ? 'failed_quorum' : 'resolved';

  return {
    blockId,
    circleId: block.circleId,
    closed,
    closesAt: v.closesAt ?? null,
    autoClosed: !v.closed && !v.cancelled && Number.isFinite(Date.parse(v.closesAt ?? '')) && now >= Date.parse(v.closesAt),
    totalVotes,
    changedVotes: all.length - live.length,
    eligibleCount,
    quorum,
    quorumMet,
    secret: Boolean(v.secret),
    status,
    cancelled: Boolean(v.cancelled),
    cancelReason: v.cancelReason ?? null,
    results,
    leader,
    note: v.secret
      ? 'Sealed ballot: the count is derived from keyed hashes, so the tally is checkable and the individual choices are not readable here.'
      : 'Derived from the ballot rows on read. There is no stored total, so nothing can drift from the votes it claims to summarise.'
  };
}

