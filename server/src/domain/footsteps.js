// ---------------------------------------------------------------------------
// FOOTSTEPS — the Vault timeline
//
// A Footstep is an IMMUTABLE, chronological record of something that happened
// inside a Vault. It is the memory of the room: attributable, typed, linked
// to its source, and human-readable. Once recorded it is never edited, so the
// timeline is always an honest audit of what occurred.
//
// Relationship to `signals`: signals are Brief's cross-cutting append-only
// event bus (one row per state change anywhere). Footsteps are the VAULT'S
// narrative timeline: vault-scoped, category-filterable, and rendered as a
// human-readable sequence. A footstep is emitted from the same real events
// that emit signals (an order settling records both), but it additionally
// carries the vault context and a display category. This is a thin, deliberate
// layer — not a second source of truth for money (that remains the ledger).
//
// INVARIANTS
//   * a footstep must correspond to a real application event — never invented
//     to make a timeline look busy
//   * a footstep is immutable: there is no update path, only append
//   * every footstep is attributable (actorId) and carries the channel it
//     arrived through where known
//   * replay-safe: a `seq` per vault gives a strict order, and callers that
//     pass a `dedupeKey` (e.g. a provider reference) cannot record twice
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { personIdIfUser } from './person.js';

export const FOOTSTEP_CATEGORIES = [
  'people',
  'messages',
  'commerce',
  'payments',
  'vendors',
  'system',
  'decisions'
];

// kind -> category + a label for rendering. Every kind is a real event.
export const FOOTSTEP_KINDS = {
  // people
  person_joined: { category: 'people', label: 'joined the vault' },
  person_left: { category: 'people', label: 'left the vault' },
  participant_invited: { category: 'people', label: 'was invited' },
  rsvp_created: { category: 'people', label: 'RSVPed' },
  rsvp_changed: { category: 'people', label: 'changed their RSVP' },
  checked_in: { category: 'people', label: 'arrived' },
  // messages
  message_received: { category: 'messages', label: 'sent a message' },
  message_sent: { category: 'messages', label: 'sent a message' },
  question_asked: { category: 'messages', label: 'asked a question' },
  host_responded: { category: 'messages', label: 'responded' },
  // commerce
  quote_received: { category: 'commerce', label: 'sent a quote' },
  quote_accepted: { category: 'commerce', label: 'accepted a quote' },
  order_created: { category: 'commerce', label: 'created an order' },
  order_updated: { category: 'commerce', label: 'updated an order' },
  order_fulfilled: { category: 'commerce', label: 'fulfilled an order' },
  order_settled: { category: 'commerce', label: 'settled an order' },
  // payments
  payment_requested: { category: 'payments', label: 'requested payment' },
  payment_authorized: { category: 'payments', label: 'authorized payment' },
  payment_failed: { category: 'payments', label: 'payment failed' },
  payment_settled: { category: 'payments', label: 'payment confirmed' },
  // vendors
  request_created: { category: 'vendors', label: 'made a request' },
  request_routed: { category: 'vendors', label: 'routed a request' },
  request_accepted: { category: 'vendors', label: 'accepted a request' },
  request_declined: { category: 'vendors', label: 'declined a request' },
  request_fulfilled: { category: 'vendors', label: 'fulfilled a request' },
  vendor_contacted: { category: 'vendors', label: 'contacted a vendor' },
  // system
  vault_created: { category: 'system', label: 'created the vault' },
  vault_closed: { category: 'system', label: 'closed the vault' },
  channel_changed: { category: 'system', label: 'continued on another channel' },
  handoff_created: { category: 'system', label: 'created a channel handoff' },
  handoff_resolved: { category: 'system', label: 're-entered via a handoff' },
  followup_created: { category: 'system', label: 'scheduled a follow-up' },
  task_assigned: { category: 'system', label: 'assigned a task' },
  // decisions
  decision_made: { category: 'decisions', label: 'recorded a decision' }
};

/**
 * Record a footstep. Immutable by construction — there is no update call.
 *
 * `dedupeKey`, when supplied, prevents the SAME logical event from being
 * recorded twice (e.g. a replayed payment callback carrying the same provider
 * reference). This is replay protection for the narrative, mirroring the
 * ledger's replay protection for money.
 */
export function recordFootstep({
  vaultId,
  kind,
  actorId = null,
  actorName = null,
  channel = null,
  value = null,
  metadata = {},
  dedupeKey = null,
  narrative = null,
  at = null
}) {
  if (!store.find('vaults', (v) => v.id === vaultId)) {
    throw new Error('vault not found');
  }
  const spec = FOOTSTEP_KINDS[kind];
  if (!spec) throw new Error(`unknown footstep kind: ${kind}`);

  if (dedupeKey) {
    const prior = store.find(
      'footsteps',
      (f) => f.vaultId === vaultId && f.dedupeKey === dedupeKey
    );
    if (prior) return { footstep: prior, reused: true };
  }

  const seq = store.filter('footsteps', (f) => f.vaultId === vaultId).length + 1;
  // Resolve the actor's display name from the vault roster when not supplied,
  // so the timeline reads with real names rather than "Someone".
  const resolvedName = actorName ?? resolveActorName(vaultId, actorId);
  const footstep = {
    id: newId('step'),
    vaultId,
    seq,
    kind,
    category: spec.category,
    label: spec.label,
    // The human-readable line. Derived from kind + actor + value when the
    // caller does not supply an explicit one, so the client never invents.
    narrative: narrative ?? defaultNarrative(kind, resolvedName, value),
    actorId,
    personId: personIdIfUser(actorId),
    actorName: resolvedName,
    channel,
    value,
    metadata,
    dedupeKey,
    createdAt: at ?? new Date().toISOString()
  };
  store.insert('footsteps', footstep);
  return { footstep, reused: false };
}

function resolveActorName(vaultId, actorId) {
  if (!actorId) return null;
  const p = store.find(
    'vaultParticipants',
    (x) => x.vaultId === vaultId && (x.userId === actorId || x.id === actorId)
  );
  return p?.name ?? null;
}

function defaultNarrative(kind, actorName, value) {
  const who = actorName ?? 'Someone';
  const v = value === null || value === undefined ? '' : ` ${value}`;
  switch (kind) {
    case 'vault_created': return `${who} opened this vault`;
    case 'vault_closed': return `${who} closed this vault`;
    case 'person_joined': return `${who} joined`;
    case 'person_left': return `${who} left`;
    case 'rsvp_created': return `${who} RSVPed yes`;
    case 'rsvp_changed': return `${who} changed their RSVP`;
    case 'question_asked': return `${who} asked a question`;
    case 'host_responded': return `${who} replied`;
    case 'message_received': return `${who} messaged`;
    case 'payment_settled': return `${who} paid${v}`;
    case 'payment_failed': return `Payment failed${v}`;
    case 'payment_authorized': return `${who} authorized a payment`;
    case 'order_created': return `${who} placed an order${v}`;
    case 'order_settled': return `Order settled${v}`;
    case 'request_created': return `${who} requested something`;
    case 'request_accepted': return `${who} accepted the request`;
    case 'request_fulfilled': return `${who} fulfilled the request`;
    case 'channel_changed': return `${who} continued elsewhere`;
    case 'decision_made': return `${who} recorded a decision`;
    case 'task_assigned': return `${who} assigned a task`;
    default: return `${who} ${FOOTSTEP_KINDS[kind].label}`;
  }
}

/**
 * List a vault's footsteps, oldest-first (the timeline reads top-down as a
 * chronology). Supports category filtering and cursor pagination so a huge
 * history is never loaded whole.
 */
export function listFootsteps(vaultId, { category = null, cursor = null, limit = 200 } = {}) {
  let rows = store.filter('footsteps', (f) => f.vaultId === vaultId);
  if (category && FOOTSTEP_CATEGORIES.includes(category)) {
    rows = rows.filter((f) => f.category === category);
  }
  // seq is the strict vault-local order.
  rows = rows.slice().sort((a, b) => a.seq - b.seq);
  if (cursor !== null && cursor !== undefined) {
    rows = rows.filter((f) => f.seq > cursor);
  }
  const page = rows.slice(0, limit);
  const nextCursor = page.length === limit ? page[page.length - 1].seq : null;
  return { footsteps: page, nextCursor, total: rows.length };
}
