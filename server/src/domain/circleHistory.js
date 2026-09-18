// ---------------------------------------------------------------------------
// CIRCLE HISTORY — the rule that makes editing safe.
//
// A group's records decide things: who holds a task, what the vote was, who was
// a coordinator when the decision was taken. If those can be rewritten in place,
// the group can be lied to — usually by the person with the most power in it. So
// the rule is the ledger's rule, extended to everything a circle cares about:
//
//     the user may change their mind at any time. The record cannot.
//
// Every mutation appends a row here: who did it, when, what the field said before,
// what it says now, and (where it matters) WHY. The current state still lives on
// the row it belongs to — that keeps every existing reader working and every read
// cheap — but it is no longer the only account of itself. The state can be checked
// against the history, and a suite does exactly that: the last revision of each
// kind must agree with the live row, so a state write that skips the log is a bug
// caught in CI rather than a fiction discovered by a member.
//
// What is enforced here, and why it is the interesting part:
//
//   • reason-required actions. Cancelling a task, changing a deadline, removing a
//     member, changing a role, cancelling a vote, reopening finished work — an
//     empty reason throws. A coordinator who must explain is a coordinator who
//     leaves a track record; that is the whole accountability mechanism, and it is
//     cheap precisely because it is a sentence, not a permission system.
//   • no hard delete. "Delete" is a cancel row. The task stays, marked cancelled,
//     in the archive, with its reason. A list you can quietly empty is not a record.
//   • redaction, not deletion. A secret ballot writes a keyed hash of the voter,
//     never their id, so the count is auditable and the choice is not. Nothing is
//     hidden from the members — the room simply cannot see inside an envelope.
//
// What this is NOT: it is not immutability theatre. Rows are never encrypted away
// and no one is prevented from amending their own words. Every row here is readable
// by any member of the circle who could read the thing it describes.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import crypto from 'node:crypto';

/** Actions a member must explain. Everything else may be done silently. */
export const REASON_REQUIRED = [
  'task_cancelled',
  'task_reopened',
  'task_due_changed',
  'task_reassigned',
  'member_role_changed',
  'member_removed',
  'vote_cancelled',
  // Opening a private room to the list is the one circle-level edit a member can
  // be harmed by, so it is the one that must be explained. Renaming a circle or
  // correcting its goal is logged like everything else, but demanding a reason
  // for it only trains people to type noise.
  'circle_visibility_changed'
];

/* Deliberately NOT here, with the reason: `member_left` (a person owes nobody an
   explanation for leaving), `member_rejoined` (an apology would be absurd), and
   `vote_changed` (the before/after pair IS the explanation; asking a member to
   justify changing their mind is how a group pressures a vote). Requiring a
   reason everywhere turns accountability into friction people route around by
   typing noise. */

/** Field names in a member's words, for the activity line. */
const LABELS = {
  name: 'The name',
  description: 'The purpose',
  goal: 'The goal',
  targetValue: 'The target',
  deadline: 'The deadline',
  completionCriteria: 'The criteria',
  status: 'The status',
  welcome: 'The welcome note',
  externalLink: 'The outside link'
};

function reason(text) {
  const clean = String(text ?? '').trim();
  if (!clean) throw new Error('a reason is required for this change — it goes in the circle’s history, not in a message');
  return clean.slice(0, 500);
}

/**
 * Append one row. Returns it. There is deliberately no update or delete
 * exported: the only way to correct a row is to append another one.
 */
export function append({
  circleId,
  subject = null,
  subjectKind = null,
  kind,
  field = null,
  before = null,
  after = null,
  actorId = null,
  reason: why = null,
  at = new Date().toISOString(),
  redact = false
} = {}) {
  if (!circleId) throw new Error('circleId is required');
  if (!kind) throw new Error('kind is required');
  const needsReason = REASON_REQUIRED.includes(kind);
  const row = {
    id: newId('chx'),
    circleId,
    subject,
    subjectKind,
    kind,
    field,
    // A redacted row keeps its shape and loses its contents: the fact that a
    // ballot was cast is public to the circle, who it went to is not.
    before: redact ? null : (before ?? null),
    after: redact ? null : (after ?? null),
    redacted: Boolean(redact),
    actorId: redact ? null : (actorId ?? null),
    reason: needsReason ? reason(why) : (String(why ?? '').trim().slice(0, 500) || null),
    at
  };
  if (needsReason && !row.reason) throw new Error(`a reason is required for ${kind}`);
  store.insert('circleRevisions', row);
  return row;
}

/** Convenience for the reason-required calls, so every caller gets the same error. */
export function appendWithReason(input) {
  return append({ ...input, reason: reason(input.reason) });
}

/** A keyed hash: same voter, same vote, same value; no way back to the person. */
export function voterHash(blockId, userId) {
  return crypto.createHash('sha256').update(`${blockId}:${userId}:circle-ballot`).digest('hex').slice(0, 32);
}

/** Newest first. `limit` guards the UI against unbounded lists, not the record. */
export function historyFor(circleId, { subject = null, kinds = null, limit = 50 } = {}) {
  let rows = store.filter('circleRevisions', (r) => (subject ? r.circleId === circleId && r.subject === subject : r.circleId === circleId));
  if (kinds?.length) rows = rows.filter((r) => kinds.includes(r.kind));
  // Newest first, and ties broken by insertion order — timestamps have
  // millisecond resolution and a burst of changes lands inside one of them, so
  // without the reverse-first step two rows written in the same millisecond
  // would come back in the order the engine felt like, and "what happened last"
  // would be a coin toss.
  return rows
    .slice()
    .reverse()
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, Math.max(1, Math.min(Number(limit) || 50, 200)));
}

/**
 * The last recorded value of `field` for a subject, so a read can check itself:
 * "the live row says X; history's last change to X says Y" is the drift test.
 */
export function lastChange(subject, field) {
  return store
    .filter('circleRevisions', (r) => r.subject === subject && (!field || r.field === field))
    .slice()
    .sort((a, b) => (a.at < b.at ? 1 : -1))[0] ?? null;
}

/** The shape the client renders: what changed, in words, with who and when. */
export function describe(row) {
  const who = row.actorId ? 'A member' : 'Brief';
  if (row.redacted) return `${who} cast a sealed ballot`;
  const value = (v) => (v === null || v === undefined || v === '' ? 'nothing' : String(v));
  switch (row.kind) {
    case 'task_cancelled':   return `Task cancelled — ${value(row.reason)}`;
    case 'task_reopened':    return `Reopened — ${value(row.reason)}`;
    case 'task_due_changed': return `Deadline moved from ${value(row.before)} to ${value(row.after)} — ${value(row.reason)}`;
    case 'task_assigned':    return `Claimed${row.after ? ` by ${row.after}` : ''}`;
    case 'task_released':    return `Put back for anyone to take${row.reason ? ` — ${row.reason}` : ''}`;
    case 'task_completed':   return `Marked done${row.after ? ` — ${row.after}` : ''}`;
    case 'task_verified':    return `Completion verified`;
    case 'task_edited':      return `${row.field === 'description' ? 'Description' : 'Title'} edited`;
    case 'vote_cancelled':   return `Vote cancelled — ${value(row.reason)}`;
    case 'vote_changed':     return `Vote changed from ${value(row.before)} to ${value(row.after)}`;
    case 'vote_cast':        return row.redacted ? `Sealed ballot recorded` : `Voted ${value(row.after)}`;
    case 'member_role_changed': return `Role: ${value(row.before)} → ${value(row.after)} — ${value(row.reason)}`;
    case 'member_removed':    return `Removed by the coordinator — ${value(row.reason)}`;
    case 'member_left':       return `Left the circle${row.reason ? ` — ${row.reason}` : ''}`;
    case 'member_rejoined':   return `Rejoined the circle`;
    case 'welcome_pinned':    return `Pinned a welcome note`;
    case 'circle_visibility_changed': return `Now ${value(row.after)} — ${value(row.reason)}`;
    case 'circle_terms_changed': return `${LABELS[row.field] ?? value(row.field)} changed`;
    default:                  return row.kind.replace(/_/g, ' ');
  }
}

export default { append, appendWithReason, historyFor, lastChange, describe, voterHash, REASON_REQUIRED };
