// ---------------------------------------------------------------------------
// CIRCLE SERVICE
//
// A Circle is a durable group container. It is deliberately a thin layer over
// the existing store: a Circle may be derived from an ingested Source (so the
// provenance chain is preserved) or created directly by a user as a TARGET.
//
// This does NOT replace the relationship graph. Circles reference objects via
// Blocks, and Blocks carry the objectId, so the existing graph stays canonical.
// ---------------------------------------------------------------------------

import { cleanDirectory } from './groupDirectory.js';
import crypto from 'node:crypto';
import { store, newId } from '../store.js';
import * as history from './circleHistory.js';

export const CIRCLE_TYPES = ['gathering', 'build', 'study', 'treasury', 'match', 'target'];
export const CIRCLE_STATUS = ['forming', 'active', 'completed', 'dormant'];

/**
 * Who can find the room.
 *   invite_only   — nothing lists it; a code is the only way in
 *   discoverable  — it appears in the circles list with a join link, and the
 *                   link's landing page shows the room's shape, never its contents
 *   open          — as above, and anybody with the link may join without asking
 * A discoverable circle is a shop window, not an open door: what is listed is
 * the metadata the coordinator chose to make listable, and the blocks inside
 * stay behind membership. That distinction is why a group will agree to this.
 */
export const CIRCLE_VISIBILITY = ['invite_only', 'discoverable', 'open'];

// A code a person can type from a WhatsApp message on a cracked screen: no
// look-alikes, no ambiguity when read aloud.
const CODE_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
function newJoinCode() {
  let out = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i += 1) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** Only a real, absolute http(s) link is stored — a group's WhatsApp invite is
 *  shown verbatim, and a relative path or a javascript: URL is refused. */
function safeUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('protocol');
    return u.href.slice(0, 500);
  } catch {
    throw new Error('an external link must be a full http(s) URL');
  }
}

// Source type -> the Circle shape that best fits it.
const TYPE_FROM_SOURCE = {
  telegram_group: 'gathering',
  telegram_channel: 'gathering',
  whatsapp_group: 'gathering',
  whatsapp_channel: 'gathering',
  webpage: 'build',
  website: 'build',
  rss: 'study',
  manual: 'treasury',
  api: 'match',
  business: 'build',
  event_feed: 'study'
};

/**
 * List circles.
 *
 * `viewerId` makes the list honest about membership. Without it every circle
 * in the deployment looks the same, and a client cannot tell "yours" from
 * "open to join" -- which is exactly how the list ended up labelled
 * "communities you are part of" while showing circles you had never joined.
 *
 * With a viewer, each row carries `viewerRole` (their role, or null when they
 * are not a member) and `canJoin` (whether a self-join is permitted: an open
 * circle, or one with nobody in it yet). Both are derived, never stored.
 */
export function listCircles(viewerId = null) {
  return store.all('circles').map((c) => withCounts(c, viewerId));
}

function withCounts(circle, viewerId = null) {
  // An ENDED membership is history, not a seat: it must not make the viewer a
  // member, a coordinator, or someone who cannot self-join again.
  const membership = viewerId
    ? store.find('members', (m) => m.circleId === circle.id && m.userId === viewerId && m.status !== 'ended') ?? null
    : null;
  const blocks = store.filter('blocks', (b) => b.circleId === circle.id);
  const members = store.filter('members', (m) => m.circleId === circle.id);
  const activeMembers = members.filter((m) => m.status !== 'ended');

  // TARGET PROGRESS IS DERIVED, NEVER STORED.
  //
  // currentValue is computed from transactions that have actually reached
  // 'settled' and are linked to this circle. There is deliberately no way to
  // write it: a caller cannot PATCH progress upward, and the UI cannot
  // manufacture a moving progress bar. If no money has settled, progress is 0.
  const contributions = store.filter(
    'ledgerTransactions',
    (t) => t.circleId === circle.id && t.status === 'settled'
  );
  const currentValue = contributions.reduce((sum, t) => sum + t.amount, 0);
  const contributorCount = new Set(
    contributions.map((t) => t.counterparty).filter(Boolean)
  ).size;

  const progressPct =
    circle.targetValue && circle.targetValue > 0
      ? Math.min(100, (currentValue / circle.targetValue) * 100)
      : null;

  return {
    ...circle,
    currentValue,
    contributorCount,
    progressPct,
    settledCount: contributions.length,
    blockCount: blocks.length,
    memberCount: activeMembers.length,
    // Membership facts about the viewer. Stated as null (not omitted) so a
    // client cannot mistake "unknown" for "member".
    viewerRole: membership?.role ?? null,
    isMember: Boolean(membership),
    // A self-join is permitted when the circle is open or discoverable, or when
    // it has no live members and therefore nobody to ask. Ended memberships do
    // not count: a circle everyone left is reclaimable, not permanently locked.
    canJoin: circle.visibility === 'open' || circle.visibility === 'discoverable' || activeMembers.length === 0
  };
}

export function getCircle(id, viewerId = null) {
  const circle = store.find('circles', (c) => c.id === id);
  return circle ? withCounts(circle, viewerId) : null;
}

/**
 * Derive a Circle from an already-connected Source. Idempotent: calling twice
 * for the same source returns the same Circle rather than a duplicate.
 */
export function findOrCreateCircleFromSource(sourceId, overrides = {}) {
  const source = store.find('sources', (s) => s.id === sourceId);
  if (!source) throw new Error('source not found');

  const existing = store.find('circles', (c) => c.sourceId === sourceId);
  if (existing) return withCounts(existing);

  const now = new Date().toISOString();
  const circle = {
    id: newId('circ'),
    name: overrides.name || source.name || source.id,
    description: overrides.description || source.description || '',
    type: overrides.type || TYPE_FROM_SOURCE[source.type] || 'gathering',
    status: 'active',
    // A Circle is only "open" if the underlying source is genuinely public.
    // Anything else stays invite-only so Brief never implies open access.
    visibility: source.accessType === 'public' ? 'open' : 'invite_only',
    sourceId: source.id,
    goal: null,
    targetValue: null,
    deadline: null,
    completionCriteria: null,
    parentCircleId: overrides.parentCircleId || null,
    createdAt: now,
    updatedAt: now
  };
  store.insert('circles', circle);
  return withCounts(circle);
}

/**
 * A TARGET circle is user-created and carries measurable progress.
 * targetValue is required so progress is real arithmetic, never a guess.
 */
export function createTargetCircle({
  name,
  description = '',
  goal = null,
  targetValue = null,
  deadline = null,
  completionCriteria = null,
  hostSpaceId = null,
  directory = null
}) {
  if (!name) throw new Error('name is required');
  if (targetValue !== null && !(Number.isFinite(targetValue) && targetValue > 0)) {
    throw new Error('targetValue must be a positive number when provided');
  }
  const now = new Date().toISOString();
  const circle = {
    id: newId('circ'),
    name,
    description,
    type: 'target',
    status: 'forming',
    hostSpaceId,
    directory: directory ? cleanDirectory(directory) : null,
    visibility: directory?.listed === true ? 'discoverable' : 'invite_only',
    // Minted at creation, never derived from the name: a name can be reused and
    // renamed, and a link that changes is a link that stops working in the last
    // place you pasted it.
    joinCode: newJoinCode(),
    externalLink: null,
    welcome: null,
    sourceId: null,
    goal,
    targetValue,
    deadline,
    completionCriteria,
    parentCircleId: null,
    createdAt: now,
    updatedAt: now
  };
  store.insert('circles', circle);
  return withCounts(circle);
}

export function updateCircle(id, patch, { actorId = null, reason = null } = {}) {
  // 'currentValue' is intentionally ABSENT: progress is derived from settled
  // transactions in withCounts(). Allowing it here would let the client fake
  // a target moving forward. 'joinCode' is absent too — a link that a member
  // can rewrite is a link that stops working where it was last shared.
  const allowed = [
    'name', 'description', 'status', 'visibility', 'goal',
    'targetValue', 'deadline', 'completionCriteria', 'welcome', 'externalLink', 'directory'
  ];
  const clean = {};
  for (const k of allowed) if (k in patch) clean[k] = patch[k];
  if ('directory' in clean) clean.directory = cleanDirectory(clean.directory);
  if ('status' in clean && !CIRCLE_STATUS.includes(clean.status)) {
    throw new Error(`status must be one of ${CIRCLE_STATUS.join(', ')}`);
  }
  if ('visibility' in clean && !CIRCLE_VISIBILITY.includes(clean.visibility)) {
    throw new Error(`visibility must be one of ${CIRCLE_VISIBILITY.join(', ')}`);
  }
  if ('externalLink' in clean) clean.externalLink = safeUrl(clean.externalLink);
  // The welcome note is the room's identity, so it has a length cap a phone can
  // actually read: one paragraph, not a manifesto.
  if ('welcome' in clean) {
    clean.welcome = clean.welcome == null ? null : String(clean.welcome).trim().slice(0, 400) || null;
  }
  if (!Object.keys(clean).length) return getCircle(id, actorId);

  // Snapshot the pre-image: store rows are live, so reading `before[field]`
  // after the write would compare the new value with itself and log nothing.
  const beforeRow = store.find('circles', (c) => c.id === id);
  if (!beforeRow) return null;
  const before = { ...beforeRow };
  const changes = Object.entries(clean).filter(([field, after]) => JSON.stringify(before[field] ?? null) !== JSON.stringify(after ?? null));
  if (!changes.length) return withCounts(beforeRow, actorId);

  // ORDER IS THE SECURITY. A reason checked after the write lets a refused
  // change take effect anyway — an earlier version of this function did exactly
  // that, so a circle's door would swing open while the coordinator was being
  // told they had not explained themselves. Decide, then write.
  if (changes.some(([field]) => field === 'visibility' || field === 'directory') && !String(reason ?? '').trim()) {
    throw new Error('listing a private room needs a reason — the members are owed one, in writing');
  }

  const updated = store.update('circles', id, clean);
  for (const [field, after] of changes) {
    history.append({
      circleId: id, subject: id, subjectKind: 'circle',
      // Two kinds, deliberately: listing a private room is an act members are
      // owed an explanation for, and it cannot be recorded without one. Fixing a
      // typo in the goal is logged, not gated.
      kind: field === 'visibility' ? 'circle_visibility_changed' : 'circle_terms_changed',
      field, before: before[field] ?? null, after, actorId, reason: reason ?? null
    });
  }
  return updated ? withCounts(updated, actorId) : null;
}

/** The room's pinned welcome, as a first-class field rather than a block the
 *  client has to hunt for. Setting it is a change of terms, so it is logged. */
export function setWelcome(circleId, text, { actorId = null } = {}) {
  const circle = store.find('circles', (c) => c.id === circleId);
  if (!circle) throw new Error('circle not found');
  const clean = String(text ?? '').trim().slice(0, 400) || null;
  const was = circle.welcome ?? null;
  store.update('circles', circleId, { welcome: clean });
  history.append({
    circleId, subject: circleId, subjectKind: 'circle', kind: 'welcome_pinned',
    field: 'welcome', before: was, after: clean, actorId
  });
  return withCounts(store.find('circles', (c) => c.id === circleId), actorId);
}

/** Find a circle by the code on its join link. Case-insensitive, because it is
 *  read off a screen and typed by thumb. */
export function findByJoinCode(code) {
  const wanted = String(code ?? '').trim().toLowerCase();
  if (!wanted) return null;
  const circle = store.find('circles', (c) => String(c.joinCode ?? '').toLowerCase() === wanted);
  return circle ?? null;
}

/**
 * What a stranger may see before joining — the landing page behind a shared
 * link, and the card in the circles list.
 *
 * Deliberately absent: block contents, member names, the ledger. A group will
 * accept being *listed* (a name, what it is about, how many people, what is live
 * right now) and will not accept its chat being readable by whoever follows a
 * link. So the preview describes the shape of the room, and never its contents.
 */
export function peek(joinCodeOrId) {
  const circle = findByJoinCode(joinCodeOrId) ?? store.find('circles', (c) => c.id === joinCodeOrId);
  if (!circle) return null;
  const listed = circle.visibility === 'discoverable' || circle.visibility === 'open';
  const members = store.filter('members', (m) => m.circleId === circle.id && m.status !== 'ended');
  const blocks = store.filter('blocks', (b) => b.circleId === circle.id);
  const openTasks = blocks.filter((b) => b.type === 'task' && (b.metadata?.task?.status ?? 'open') === 'open');
  const liveVotes = blocks.filter((b) => b.type === 'vote' && !(b.metadata?.vote?.closed || b.metadata?.vote?.cancelled));

  return {
    listed: listed === true,
    id: circle.id,
    name: circle.name ?? null,
    purpose: circle.description ?? circle.goal ?? null,
    type: circle.type ?? null,
    memberCount: members.length,
    // Counts, not contents. "2 tasks people are picking up" is an invitation;
    // the text of those tasks is a reason to join, not a reason to browse.
    openTaskCount: openTasks.length,
    liveVoteCount: liveVotes.length,
    externalLink: circle.externalLink ?? null,
    externalLinkNote: circle.externalLink
      ? 'This link was written by the organiser of this circle. Brief has not checked where it leads.'
      : null,
    joinCode: circle.joinCode ?? null,
    canJoin: circle.visibility === 'open' || members.length === 0,
    needsInvite: circle.visibility === 'invite_only',
    // Financial progress belongs to members, not the public join preview.
    targetValue: null,
    currentValue: null,
    currency: circle.currency ?? 'KES'
  };
}

/** The circles a stranger may browse. Listing is opt-in by the coordinator, so
 *  this is empty until someone chooses it — an honest empty list, not a
 *  directory of everybody's private group. */
export function listDiscoverable() {
  return store
    .filter('circles', (c) => c.visibility === 'discoverable' || c.visibility === 'open')
    .map((c) => peek(c.id))
    .filter(Boolean);
}
