// ---------------------------------------------------------------------------
// AUTOMATION ENGINE — trigger → condition → action (CCS §3.1)
//
// The creator-facing workflow system. A workflow watches the existing signal
// log (the append-only record of real state changes) and, when a signal matches
// its trigger + conditions, runs its actions.
//
//   TRIGGER    a signal type (member_joined, order_paid, campaign_shared, ...)
//              or '*' for "any signal"
//   CONDITION  a small predicate over the signal (actorId equals, a metadata
//              value equals/contains). All conditions must pass.
//   ACTION     one of:
//                notify   — in-app notification to a user (actor or explicit)
//                tag      — add a tag to a person (the CRM "interests" field)
//                blast    — outbound message via the distribution seam
//
// Execution is OPPORTUNISTIC (a sweep, like the auction expiry): signals are
// processed when sweep() runs — at boot and on an interval — never on the
// request path, so a workflow can never slow a webhook. Each run is deduped by
// (workflowId, signalId) in workflowRuns, so a sweep is safe to re-run.
//
// HONESTY:
//   * a `blast` action fails closed when no outbound provider / recipient is
//     configured — it never claims a send that did not happen
//   * a workflow only reacts to signals that genuinely occurred
//   * the run log is append-only, so an operator can see exactly what fired
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import * as notifications from './notifications.js';
import * as person from './person.js';
import * as outbound from '../outbound.js';

export const ACTION_TYPES = ['notify', 'tag', 'blast'];

/** Every condition field a workflow may filter on. */
export const CONDITION_FIELDS = ['actorId', 'type', 'objectId', 'circleId', 'metadata'];

function readField(signal, field) {
  if (field === 'actorId') return signal.actorId ?? null;
  if (field === 'type') return signal.type ?? null;
  if (field === 'objectId') return signal.objectId ?? null;
  if (field === 'circleId') return signal.circleId ?? null;
  if (field.startsWith('metadata.')) {
    const key = field.slice('metadata.'.length);
    return signal.metadata?.[key] ?? null;
  }
  return null;
}

function matchesCondition(signal, cond) {
  const actual = readField(signal, cond.field);
  const want = cond.value;
  switch (cond.op) {
    case 'eq': return String(actual ?? '') === String(want ?? '');
    case 'ne': return String(actual ?? '') !== String(want ?? '');
    case 'contains': return String(actual ?? '').toLowerCase().includes(String(want ?? '').toLowerCase());
    case 'exists': return actual !== null && actual !== undefined;
    default: return false;
  }
}

export function createWorkflow({ name, trigger, conditions = [], actions = [], ownerId, enabled = true }) {
  if (!name || !String(name).trim()) throw new Error('name is required');
  if (!trigger) throw new Error('trigger is required');
  if (!ownerId) throw new Error('an owner is required');
  if (!Array.isArray(actions) || actions.length === 0) throw new Error('at least one action is required');
  for (const a of actions) {
    if (!ACTION_TYPES.includes(a.type)) throw new Error(`unknown action type: ${a.type}`);
  }
  for (const c of conditions) {
    if (!CONDITION_FIELDS.includes(c.field)) throw new Error(`unknown condition field: ${c.field}`);
    if (!['eq', 'ne', 'contains', 'exists'].includes(c.op)) throw new Error(`unknown condition op: ${c.op}`);
  }
  const now = new Date().toISOString();
  return store.insert('workflows', {
    id: newId('wf'),
    name: String(name).trim(),
    trigger,
    conditions: conditions.map((c) => ({ field: c.field, op: c.op, value: c.value ?? null })),
    actions: actions.map((a) => ({ ...a })),
    ownerId,
    enabled: enabled !== false,
    createdAt: now,
    updatedAt: now
  });
}

export function updateWorkflow(id, patch) {
  const wf = store.find('workflows', (w) => w.id === id);
  if (!wf) throw new Error('workflow not found');
  const allowed = ['name', 'trigger', 'conditions', 'actions', 'enabled'];
  const next = {};
  for (const k of allowed) if (k in (patch ?? {})) next[k] = patch[k];
  return store.update('workflows', id, { ...next, updatedAt: new Date().toISOString() });
}

export function getWorkflow(id) {
  return store.find('workflows', (w) => w.id === id) ?? null;
}

export function listWorkflows({ ownerId = null } = {}) {
  let rows = store.all('workflows');
  if (ownerId) rows = rows.filter((w) => w.ownerId === ownerId);
  return rows.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

/** Does this workflow's trigger + conditions match a signal? */
export function matches(wf, signal) {
  if (!wf.enabled) return false;
  if (wf.trigger !== '*' && wf.trigger !== signal.type) return false;
  return (wf.conditions ?? []).every((c) => matchesCondition(signal, c));
}

/**
 * Execute one action. Returns a flat, honest result (ok + reason/detail) so the
 * run log records exactly what happened — including failures.
 */
async function runAction(action, signal, wf) {
  switch (action.type) {
    case 'notify': {
      const recipient = action.userId ?? signal.actorId;
      if (!recipient) return { ok: false, reason: 'no_recipient' };
      const n = notifications.notify(recipient, {
        kind: 'workflow',
        title: action.title ?? wf.name,
        body: action.body ?? null,
        metadata: { workflowId: wf.id, signalId: signal.id }
      });
      return { ok: true, detail: { notificationId: n.id } };
    }
    case 'tag': {
      const tag = action.tag;
      if (!tag) return { ok: false, reason: 'no_tag' };
      // The actor is a USER id; resolve (or create) their person, then tag it.
      const actorId = signal.actorId;
      if (!actorId) return { ok: false, reason: 'no_person' };
      const p = person.ensurePersonForUser(actorId);
      person.tagPerson(p.id, String(tag));
      return { ok: true, detail: { tag, personId: p.id } };
    }
    case 'blast': {
      if (!action.channel || !action.to) return { ok: false, reason: 'missing_channel_or_recipient' };
      const sent = await outbound.send({ channel: action.channel, to: action.to, text: action.text ?? wf.name });
      return { ok: sent.ok, reason: sent.reason ?? null, detail: sent.sid ? { sid: sent.sid } : undefined };
    }
    default:
      return { ok: false, reason: 'unknown_action' };
  }
}

/**
 * Sweep unprocessed signals through the workflows. Idempotent (deduped by
 * workflow+signal); async so blast actions can await the outbound seam. Returns
 * a count of what ran. Safe to call repeatedly — already-processed pairs are
 * skipped.
 */
export async function sweep({ limit = 500 } = {}) {
  const signals = store.all('signals').slice(-limit);
  const runs = store.all('workflowRuns');
  const done = new Set(runs.map((r) => `${r.workflowId}:${r.signalId}`));
  let executed = 0;

  for (const signal of signals) {
    for (const wf of listWorkflows()) {
      const key = `${wf.id}:${signal.id}`;
      if (done.has(key)) continue;
      if (!matches(wf, signal)) continue;

      const now = new Date().toISOString();
      const actionResults = [];
      for (const action of wf.actions) {
        const result = await runAction(action, signal, wf);
        actionResults.push({ action: action.type, ...result });
        if (result.ok) executed++;
      }
      store.insert('workflowRuns', {
        id: newId('wfrun'),
        workflowId: wf.id,
        signalId: signal.id,
        signalType: signal.type,
        results: actionResults,
        at: now
      });
      done.add(key);
    }
  }
  return { executed };
}

/**
 * Install a periodic sweep so workflows fire without a request. Uses the same
 * unref'd setInterval discipline as the backup cadence, so it never holds the
 * process open. Off in tests.
 */
export function installSweep({ intervalMs = 60 * 1000 } = {}) {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return null;
  const timer = setInterval(() => {
    sweep().catch((e) => { /* a failed sweep must not crash the process */ });
  }, intervalMs);
  timer.unref?.();
  return timer;
}

/** Runs, newest first — the operator's view of what fired and why. */
export function listRuns({ limit = 100 } = {}) {
  return store.all('workflowRuns').slice().sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, limit);
}

export function runStats() {
  const runs = store.all('workflowRuns');
  const byWorkflow = {};
  for (const r of runs) byWorkflow[r.workflowId] = (byWorkflow[r.workflowId] ?? 0) + 1;
  return { totalRuns: runs.length, byWorkflow };
}
