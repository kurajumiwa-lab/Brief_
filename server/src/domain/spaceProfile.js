// ---------------------------------------------------------------------------
// SPACE PROFILE — a Space as an INSTRUMENT, not a container.
//
// A space currently holds offers, an inbox and a ledger. This module adds the
// thing that makes it a project: a small, fixed SCHEMA the owner maintains —
// what they do, how much they can carry, when they are on, where, how far they
// reach, what they CANNOT do, what they need from the network, what they give
// it. Those answers are stored as structured data on the space row and every
// field carries its own timestamp, so "how current is this?" is a question the
// ledger can answer instead of a guess.
//
// Three rules keep this honest:
//
//   1. STATE IS DERIVED, NEVER STORED. FRESH / ACTIVE / STALE / DORMANT are a
//      computation over the newest real maintenance event (a field edit, a
//      confirmation, a published offer, an order, a reply). It is not a column
//      anyone can PATCH upward, and no counter is incremented anywhere.
//
//   2. NO PRIVILEGES, NO LADDER, NO QUEUE. There is no "Priority matching", no
//      "you slipped from #3 to #7", no "you lost 3 buyer queries this week" —
//      Brief holds no ranking of vendors and no record of queries a vendor
//      missed, so those sentences would be invented. What a stale space
//      actually costs is stated factually: a private space is not in the
//      directory; a listing that is not published is not on the market. Those
//      are the real, visible consequences of the rows.
//
//   3. EVERY QUEUE ITEM IS A ROW OR A TIMESTAMP. The editorial queue is
//      assembled from the space's own data: a field past its refresh cadence,
//      a conversation whose last message came from the customer, a draft offer,
//      a pending order, a match that has not been answered. Each item carries
//      `evidence` (table + id) so it can be verified — and each has a real
//      action that writes a real row. Nothing is "acknowledged" into
//      disappearance: a refresh CONFIRMS the value with a timestamp, it does
//      not delete the item by fiat.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';

const HOUR = 3600000;
const DAY = 24 * HOUR;

/**
 * The schema. `cadenceHours` is how long an answer stays worth reading — it is
 * a maintenance expectation, not a score, and it is the same for every space so
 * nobody can be ranked by a hidden weight.
 */
export const PROFILE_FIELDS = [
  {
    key: 'what',
    question: 'What do you actually sell or provide?',
    kind: 'text',
    cadenceHours: 720,
    help: 'Plain words, e.g. "Fresh tilapia, whole, graded." This is what a buyer reads first.'
  },
  {
    key: 'capacity',
    question: 'How much can you deliver, per day or per week?',
    kind: 'measure',
    cadenceHours: 720,
    help: 'A real number with a unit, e.g. 40 kg/day. Matching cannot promise more than this.'
  },
  {
    key: 'availability',
    question: 'When are you on?',
    kind: 'schedule',
    cadenceHours: 168,
    help: 'Days and hours you actually operate. Stale availability is how a buyer gets turned away.'
  },
  {
    key: 'operatingFrom',
    question: 'Where do you operate from?',
    kind: 'text',
    cadenceHours: 2160,
    help: 'A market, a street, a stage — anything a person can stand at.'
  },
  {
    key: 'coverage',
    question: 'Which areas do you actually serve?',
    kind: 'list',
    cadenceHours: 168,
    help: 'Areas you can reach and do reach. This refreshes weekly because it changes.'
  },
  {
    key: 'constraints',
    question: 'What can you NOT do?',
    kind: 'list',
    cadenceHours: 720,
    help: 'The honest limits: distance, cold chain, cash change, minimum order. Constraints keep the pipeline from promising what you cannot carry.'
  },
  {
    key: 'needs',
    question: 'What do you need from the network?',
    kind: 'list',
    cadenceHours: 336,
    help: 'Cold chain twice a day, a shared van, more hands on Saturday. Each need can become a real request in one tap.'
  },
  {
    key: 'offersToNetwork',
    question: 'What can you give the network?',
    kind: 'list',
    cadenceHours: 720,
    help: 'A margin for a rider who brings buyers, first refusal on leftovers, a standing price for a group.'
  },
  {
    key: 'contactChannel',
    question: 'Where should a buyer reach you?',
    kind: 'contact',
    // OPTIONAL by design: staying reachable only through the Brief inbox is a
    // legitimate choice, not a gap. An unanswered optional field is never an
    // open item, never counted as unanswered, and never nags the owner.
    optional: true,
    cadenceHours: 4320,
    help: 'Your public page gets one button that opens WhatsApp to this number. Adding it here publishes it — leave it blank to stay reachable only through the Brief inbox.'
  }
];

export const PROFILE_KEYS = PROFILE_FIELDS.map((f) => f.key);
const FIELD_BY_KEY = new Map(PROFILE_FIELDS.map((f) => [f.key, f]));

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const clean = (value, max) => String(value ?? '').trim().slice(0, max);

/** Validation is per-kind and throws with the reason, so the UI can show it. */
function validate(kind, raw, label) {
  if (kind === 'text') {
    // Accept either the bare string or the { text } shape the client sends, so
    // a form object is never stringified into "[object Object]".
    const text = clean(typeof raw === 'string' ? raw : (raw?.text ?? ''), 300);
    if (text.length < 3) throw new Error(`${label}: give a real answer of at least 3 characters`);
    return { text };
  }
  if (kind === 'measure') {
    const value = Number(raw?.value ?? raw);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${label}: capacity must be a positive number`);
    if (value > 1e9) throw new Error(`${label}: that number is out of range`);
    const unit = clean(raw?.unit, 24);
    if (!unit) throw new Error(`${label}: a number needs a unit (kg, trays, trips)`);
    const per = clean(raw?.per, 24) || 'day';
    return { value, unit, per };
  }
  if (kind === 'schedule') {
    const days = Array.isArray(raw?.days) ? raw.days.map((d) => String(d).toLowerCase()).filter((d) => DAYS.includes(d)) : [];
    const summary = clean(raw?.summary, 120);
    if (!days.length && !summary) throw new Error(`${label}: pick the days you operate, or describe them`);
    const from = raw?.from && TIME.test(raw.from) ? raw.from : null;
    const to = raw?.to && TIME.test(raw.to) ? raw.to : null;
    // The summary is only ever what the human typed. Turning "tue, sat" into
    // "tue–sat" would claim every day in between, so it is rendered by
    // formatAnswer instead of being written into the row.
    return { days, from, to, summary };
  }
  if (kind === 'list') {
    // An EMPTY list is a real answer ("no constraints"), distinct from never
    // having answered — so it is preserved rather than treated as missing.
    const items = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
    const out = items.map((i) => clean(i, 200)).filter(Boolean).slice(0, 12);
    return { items: out };
  }
  if (kind === 'contact') {
    // Only WhatsApp, because that is the only channel Brief can actually link
    // to from a public page. A number is normalised to digits so the wa.me link
    // is derivable. There is deliberately NO "hide the digits" toggle: a wa.me
    // link contains the digits, so such a switch would be a control that does
    // not do what its label says. The honest choice is whether to publish it.
    const platform = clean(raw?.platform, 16) || 'whatsapp';
    if (platform !== 'whatsapp') throw new Error(`${label}: Brief can only link a WhatsApp number today`);
    const raw_phone = clean(raw?.phone, 32);
    const digits = raw_phone.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 15) {
      throw new Error(`${label}: use a full number with country code, e.g. +254 700 000 000`);
    }
    return {
      platform,
      phone: digits,
      message: clean(raw?.message, 200) || null
    };
  }
  throw new Error(`${label}: unknown field type`);
}

/** How a field reads right now, against the clock and its own cadence. */
function fieldStatus(def, entry, nowMs) {
  if (!entry) {
    // 'skipped' is its own state so an optional question cannot become a to-do,
    // a red dot, or a count against the owner. It is not 'unanswered'.
    const state = def.optional ? 'skipped' : 'unanswered';
    return { key: def.key, question: def.question, state, ageHours: null, dueInHours: def.cadenceHours, value: null, optional: Boolean(def.optional) };
  }
  const at = Date.parse(entry.lastConfirmedAt ?? entry.updatedAt ?? '') || nowMs;
  const ageHours = Math.max(0, Math.round((nowMs - at) / HOUR));
  const dueInHours = def.cadenceHours - ageHours;
  return {
    key: def.key,
    question: def.question,
    help: def.help,
    cadenceHours: def.cadenceHours,
    state: dueInHours <= 0 ? 'overdue' : dueInHours <= 48 ? 'due' : 'current',
    ageHours,
    dueInHours,
    updatedAt: entry.updatedAt ?? null,
    lastConfirmedAt: entry.lastConfirmedAt ?? null,
    confirmations: Number(entry.confirmations) || 0,
    value: entry.value ?? null
  };
}

/** A human-readable rendering of one answer, built from the stored shape only. */
export function formatAnswer(key, value) {
  const def = FIELD_BY_KEY.get(key);
  if (!def || value == null) return null;
  if (def.kind === 'text') return value.text || null;
  if (def.kind === 'measure') return `${value.value} ${value.unit}/${value.per}`;
  if (def.kind === 'schedule') {
    // Days are listed, never compressed into a range: "tue–sat" would read as
    // "every day between them", which is a different claim from the answer.
    const cap = (d) => (d ? d.charAt(0).toUpperCase() + d.slice(1) : '');
    const days = (value.days ?? []).map(cap).join(', ');
    const hours = value.from && value.to ? `${value.from}–${value.to}` : '';
    return `${days}${hours ? ` ${hours}` : ''}`.trim() || value.summary || null;
  }
  if (def.kind === 'contact') return value.phone ? `WhatsApp +${value.phone}` : null;
  const items = (value.items ?? []).filter(Boolean);
  return items.length ? items.join(' · ') : 'nothing stated';
}

/**
 * The newest real maintenance event for a space: an edit, a confirmation, an
 * activity row, a customer-facing message, an order. Nothing is written here —
 * this only reads what already happened.
 */
function lastTouchedAt(space, nowMs) {
  const seen = [];
  for (const entry of Object.values(space.profile?.fields ?? {})) {
    seen.push(entry?.updatedAt, entry?.lastConfirmedAt);
  }
  seen.push(space.updatedAt, space.createdAt);
  for (const a of store.filter('spaceActivities', (x) => x.spaceId === space.id)) seen.push(a.createdAt);
  for (const c of store.filter('spaceConversations', (x) => x.spaceId === space.id)) {
    for (const m of c.messages ?? []) seen.push(m.at ?? m.createdAt);
  }
  for (const o of store.filter('orders', (x) => x.spaceId === space.id || x.vendorId === space.vendorId)) seen.push(o.updatedAt ?? o.createdAt);
  let best = null;
  for (const v of seen) {
    const ms = Date.parse(v ?? '');
    if (Number.isFinite(ms) && (best === null || ms > best)) best = ms;
  }
  return { at: best, ageHours: best === null ? null : Math.max(0, Math.round((nowMs - best) / HOUR)) };
}

/**
 * Maintenance state — derived, and labelled for what it is: a description of
 * how fresh the answers are. It carries NO visibility consequence beyond the
 * two that are literally true (a private space is not in the directory, an
 * unpublished offer is not on the market), and it is not a ranking input.
 */
export function maintenanceFor(space, { now = Date.now() } = {}) {
  const statuses = PROFILE_FIELDS.map((def) => fieldStatus(def, space.profile?.fields?.[def.key], now));
  const touched = lastTouchedAt(space, now);
  const age = touched.ageHours;

  let state = 'dormant';
  if (age === null) state = 'unstarted';
  else if (age < 24) state = 'fresh';
  else if (age < 7 * 24) state = 'active';
  else if (age < 30 * 24) state = 'stale';

  const openConversations = store.filter(
    'spaceConversations',
    (c) => c.spaceId === space.id && ['new', 'active', 'replied'].includes(c.status)
  );
  const draftOffers = store.filter(
    'listings',
    (l) => (l.spaceId === space.id || l.vendorId === space.vendorId) && l.status === 'draft'
  );
  const pendingOrders = store.filter(
    'orders',
    (o) => (o.spaceId === space.id || o.vendorId === space.vendorId) && ['pending', 'paid', 'processing'].includes(o.status)
  );

  return {
    state,
    lastTouchedAt: touched.at ? new Date(touched.at).toISOString() : null,
    ageHours: age,
    answered: statuses.filter((s) => s.state !== 'unanswered' && s.state !== 'skipped').length,
    // An optional answer nobody gave is not a gap, so it is not counted here.
    unanswered: statuses.filter((s) => s.state === 'unanswered').length,
    due: statuses.filter((s) => s.state === 'due').length,
    overdue: statuses.filter((s) => s.state === 'overdue').length,
    openConversations: openConversations.length,
    draftOffers: draftOffers.length,
    pendingOrders: pendingOrders.length,
    fields: statuses,
    // Only consequences a row actually supports. Written as facts, not threats.
    facts: [
      space.visibility === 'public'
        ? 'This space is in the public directory.'
        : `This space is ${space.visibility ?? 'private'}, so it is not in the public directory.`,
      draftOffers.length > 0
        ? `${draftOffers.length} offer${draftOffers.length === 1 ? '' : 's'} ${draftOffers.length === 1 ? 'is' : 'are'} still a draft, so buyers cannot see ${draftOffers.length === 1 ? 'it' : 'them'}.`
        : null,
      space.status === 'archived' ? 'This space is archived.' : null
    ].filter(Boolean),
    note:
      'State is derived from real timestamps on read. Brief does not rank, boost or bury spaces, and no ' +
      'number here is a score: it describes how current your own answers are.'
  };
}

/**
 * The editorial queue — what a space needs doing, assembled from its own rows.
 * This is the part that makes an empty week useful: even with no orders there
 * are fields past their cadence, questions unanswered, replies owed, drafts
 * unpublished. Every item names the row or timestamp it came from.
 */
export function editorialQueueFor(space, { now = Date.now() } = {}) {
  const items = [];

  for (const def of PROFILE_FIELDS) {
    const entry = space.profile?.fields?.[def.key];
    if (!entry && def.optional) continue; // never asked, never owed
    if (!entry) {
      items.push({
        id: `field_${def.key}_unanswered`,
        kind: 'profile',
        field: def.key,
        label: def.question,
        detail: 'Never answered — the pipeline cannot read what is not there.',
        urgency: 'missing',
        action: 'edit',
        evidence: { table: 'spaces', id: space.id }
      });
      continue;
    }
    const status = fieldStatus(def, entry, now);
    if (status.state === 'current') continue;
    items.push({
      id: `field_${def.key}_${status.state}`,
      kind: 'profile',
      field: def.key,
      label: `Refresh: ${def.question}`,
      detail: `Last confirmed ${status.ageHours}h ago · this answer is read as current for ${Math.round(def.cadenceHours / 24)} days.`,
      urgency: status.state === 'overdue' ? 'overdue' : 'due',
      action: 'confirm',
      evidence: { table: 'spaces', id: space.id, field: def.key, at: entry.lastConfirmedAt ?? entry.updatedAt ?? null }
    });
  }

  const open = store
    .filter('spaceConversations', (c) => c.spaceId === space.id && ['new', 'active', 'replied'].includes(c.status))
    .map((c) => {
      const last = (c.messages ?? []).at(-1);
      return { conversation: c, last };
    })
    .filter(({ last }) => last && (last.from === 'customer' || last.from === 'buyer'))
    .map(({ conversation, last }) => ({
      id: `reply_${conversation.id}`,
      kind: 'reply',
      label: `Reply to ${conversation.customerName || 'a customer'}`,
      detail: `Their last message is ${Math.max(0, Math.round((now - (Date.parse(last.at ?? last.createdAt ?? now) || now)) / HOUR))}h old.`,
      urgency: 'open',
      action: 'inbox',
      evidence: { table: 'spaceConversations', id: conversation.id }
    }));
  items.push(...open);

  for (const l of store.filter('listings', (x) => (x.spaceId === space.id || x.vendorId === space.vendorId) && x.status === 'draft')) {
    items.push({
      id: `draft_${l.id}`,
      kind: 'offer',
      label: `Publish “${l.title}”`,
      detail: 'It exists but nobody can buy it while it is a draft.',
      urgency: 'open',
      action: 'offers',
      evidence: { table: 'listings', id: l.id }
    });
  }

  for (const o of store.filter('orders', (x) => (x.spaceId === space.id || x.vendorId === space.vendorId) && ['pending', 'paid', 'processing'].includes(x.status))) {
    items.push({
      id: `order_${o.id}`,
      kind: 'order',
      label: `Fulfil order ${o.id}`,
      detail: `${o.quantity ?? 1} × ${o.unitPrice ?? o.total ?? 0} ${o.currency ?? 'KES'} — payment and fulfilment are separate facts here.`,
      urgency: 'open',
      action: 'offers',
      evidence: { table: 'orders', id: o.id }
    });
  }

  // A live match nobody answered is the most valuable item in the queue.
  for (const m of store.filter('matches', (x) => x.participantId === space.vendorId && x.status !== 'expired')) {
    const request = store.find('requests', (r) => r.id === m.requestId);
    if (!request || !['open', 'matching', 'quoted'].includes(request.status)) continue;
    const hasQuote = store.filter(
      'requestQuotes',
      (q) => q.requestId === request.id && q.participantId === space.vendorId
    ).length;
    items.push({
      id: `match_${m.id}`,
      kind: 'demand',
      label: hasQuote ? `Follow up on your proposal for “${request.title}”` : `Answer “${request.title}”`,
      detail: hasQuote ? 'Your quote is on it; the demand is still open.' : 'This demand was matched to you and nobody has priced it.',
      urgency: 'open',
      action: 'request',
      requestId: request.id,
      evidence: { table: 'matches', id: m.id }
    });
  }

  const RANK = { overdue: 0, missing: 1, due: 2, open: 3 };
  items.sort((a, b) => (RANK[a.urgency] ?? 9) - (RANK[b.urgency] ?? 9));
  return items;
}

/**
 * How the network reads this space. Every line is a count over rows, and the
 * wording is careful: matches are "the matching run included this space", not
 * "you ranked Nth", because there is no ranking and no queue.
 */
export function pipelineFor(space, { now = Date.now() } = {}) {
  const vendorId = space.vendorId;
  const active = store.filter(
    'listings',
    (l) => (l.spaceId === space.id || l.vendorId === vendorId) && l.status === 'active'
  );
  const cutoff = now - 30 * DAY;
  const matches = store.filter(
    'matches',
    (m) => m.participantId === vendorId && Date.parse(m.createdAt ?? '') >= cutoff && m.status !== 'expired'
  );
  const quotes = store.filter('requestQuotes', (q) => q.participantId === vendorId);
  const settled = store.filter('orders', (o) => o.vendorId === vendorId && o.status === 'settled');
  const work = store.filter(
    'workOrders',
    (w) => w.participantId === vendorId && ['completed', 'in_progress', 'ready_for_work'].includes(w.status)
  );
  const needItems = (space.profile?.fields?.needs?.value?.items ?? []).filter(Boolean);

  return {
    discoverable: space.visibility === 'public' && space.status === 'active',
    directory: space.visibility === 'public'
      ? 'Listed in the public directory.'
      : `Not in the public directory (visibility is ${space.visibility ?? 'private'}).`,
    listings: {
      active: active.length,
      drafts: store.filter(
        'listings',
        (l) => (l.spaceId === space.id || l.vendorId === vendorId) && l.status === 'draft'
      ).length,
      titles: active.slice(0, 3).map((l) => l.title)
    },
    matchQueries30d: {
      count: matches.length,
      wording: 'requests whose matching run included this space in the last 30 days'
    },
    proposals: {
      total: quotes.length,
      accepted: quotes.filter((q) => q.status === 'accepted').length,
      declined: quotes.filter((q) => q.status === 'declined').length
    },
    settled: {
      orders: settled.length,
      value: settled.reduce((s, o) => s + (Number(o.total) || 0), 0),
      currency: new Set(settled.map((o) => o.currency).filter(Boolean)).size === 1
        ? [...new Set(settled.map((o) => o.currency).filter(Boolean))][0]
        : null
    },
    workOrders: work.length,
    needs: needItems.map((text) => ({ text, canPostAsRequest: true })),
    note:
      'Read-only view over real rows. There is no boost, no priority tier and no queue position: a space is ' +
      'either discoverable or it is not, listed or it is not, and that is the whole of it.'
  };
}

// ---------------------------------------------------------------------------
// WRITES — the only two, and both append truth rather than replacing history.
// ---------------------------------------------------------------------------

/** Merge structured answers into the space's profile, stamping each field. */
export function setProfile(spaceId, { callerId, fields = {} } = {}) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) return { error: 'space not found', status: 404 };
  if (callerId && space.ownerId !== callerId) return { error: 'not authorized to update this space', status: 403 };

  const now = new Date().toISOString();
  const next = { ...(space.profile ?? { fields: {} }) };
  const merged = { ...(next.fields ?? {}) };
  const changed = [];
  const confirmed = [];

  for (const [key, raw] of Object.entries(fields ?? {})) {
    const def = FIELD_BY_KEY.get(key);
    if (!def) return { error: `unknown profile field: ${key}`, status: 400 };
    const value = validate(def.kind, raw, def.question);
    const previous = merged[key];
    const same = previous && JSON.stringify(previous.value) === JSON.stringify(value);
    if (previous && same) {
      // Re-stating the same answer is a CONFIRMATION, not new information.
      confirmed.push(key);
      merged[key] = { ...previous, lastConfirmedAt: now, confirmations: (Number(previous.confirmations) || 0) + 1 };
    } else {
      changed.push(key);
      merged[key] = {
        value,
        updatedAt: now,
        updatedBy: callerId ?? null,
        lastConfirmedAt: now,
        confirmations: (Number(previous?.confirmations) || 0) + (previous ? 1 : 0)
      };
    }
  }

  if (!changed.length && !confirmed.length) {
    return { error: 'nothing to update — send at least one field', status: 400 };
  }

  next.fields = merged;
  next.updatedAt = now;
  const updated = store.update('spaces', spaceId, { profile: next, updatedAt: now });

  // A real activity row for a real change. No row for a no-op.
  if (changed.length) {
    store.insert('spaceActivities', {
      id: newId('act'),
      spaceId,
      kind: 'space_profile_updated',
      title: `Updated the space profile: ${changed.join(', ')}`,
      description: 'Structured answers the pipeline reads when it matches demand to this space.',
      actorId: callerId ?? null,
      metadata: { fields: changed, confirmed },
      createdAt: now
    });
  } else {
    store.insert('spaceActivities', {
      id: newId('act'),
      spaceId,
      kind: 'space_profile_confirmed',
      title: `Confirmed the space profile: ${confirmed.join(', ')}`,
      description: 'No new information — the owner restated what already stands, which is what keeps it current.',
      actorId: callerId ?? null,
      metadata: { fields: confirmed },
      createdAt: now
    });
  }

  return { space: updated, changed, confirmed };
}

/** "Still true" — the honest refresh. It timestamps a confirmation. */
export function confirmField(spaceId, key, { callerId } = {}) {
  const def = FIELD_BY_KEY.get(key);
  if (!def) return { error: `unknown profile field: ${key}`, status: 400 };
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) return { error: 'space not found', status: 404 };
  if (callerId && space.ownerId !== callerId) return { error: 'not authorized to update this space', status: 403 };
  const entry = space.profile?.fields?.[key];
  if (!entry) return { error: 'nothing to confirm — answer the question first', status: 409 };
  return setProfile(spaceId, { callerId, fields: { [key]: entry.value } });
}

/**
 * Seed answers at creation. The envelope — { value, updatedAt, lastConfirmedAt,
 * confirmations } — is built HERE and its timestamps come from the server clock,
 * so a client can never write "confirmed today" onto a row it has not confirmed.
 */
export function profileFromGenesis(input = {}, { actorId = null, now = new Date().toISOString() } = {}) {
  // An unknown key is refused, not ignored: a space file that quietly accepted
  // arbitrary JSON would stop being a schema and start being a junk drawer.
  for (const key of Object.keys(input ?? {})) {
    if (!FIELD_BY_KEY.has(key)) throw new Error(`unknown profile field: ${key}`);
  }
  const fields = {};
  for (const def of PROFILE_FIELDS) {
    const raw = input?.[def.key];
    if (raw === undefined || raw === null || raw === '') continue;
    fields[def.key] = {
      value: validate(def.kind, raw, def.question),
      updatedAt: now,
      updatedBy: actorId,
      lastConfirmedAt: now,
      confirmations: 0
    };
  }
  return fields;
}

/**
 * The full field view: the definition, its current status against the clock,
 * the rendered answer and the stored shape. Built here so the workspace editor
 * and the maintenance read can never disagree about what a field said.
 */
export function fieldsView(space, { now = Date.now() } = {}) {
  return PROFILE_FIELDS.map((def) => {
    const entry = space.profile?.fields?.[def.key];
    return {
      ...def,
      ...fieldStatus(def, entry, now),
      answer: entry ? formatAnswer(def.key, entry.value) : null,
      raw: entry?.value ?? null,
      confirmations: Number(entry?.confirmations) || 0
    };
  });
}

/** The safe public slice: what a space IS, never its economics. */
export function publicProfile(space) {
  const fields = space.profile?.fields ?? {};
  const out = { fields: {}, staleDays: null };
  for (const def of PROFILE_FIELDS) {
    const entry = fields[def.key];
    if (!entry) continue;
    const at = Date.parse(entry.lastConfirmedAt ?? entry.updatedAt ?? '');
    out.fields[def.key] = {
      answer: formatAnswer(def.key, entry.value),
      confirmedAt: entry.lastConfirmedAt ?? entry.updatedAt ?? null,
      ageDays: Number.isFinite(at) ? Math.max(0, Math.floor((Date.now() - at) / DAY)) : null
    };
  }
  const ages = Object.values(out.fields).map((f) => f.ageDays).filter((n) => typeof n === 'number');
  // A buyer is told how old the answers are, because it is true — not that the
  // seller is worse, and not a rank.
  if (ages.length && Math.min(...ages) > 7) out.staleDays = Math.min(...ages);
  return out;
}
