// ---------------------------------------------------------------------------
// PERSON — a first-class entity over every identity Brief holds (report §4.4)
//
// Brief has several partial identities that all describe "one human":
//   * an account (users) — a handle + scrypt hash
//   * a vault participant — a row per (vault, user), or a guest with a token
//   * a registration — attendeeRef + name + contact
//   * a footstep actor — userId OR a participant id
//
// Until now there was no single key that tied them together, so a "person
// timeline" across campaigns/orders/years could not be assembled. This module
// adds that key WITHOUT inventing identity:
//
//   * a person row is a stable id
//   * an alias BINDS a person to a concrete external identifier (a user id, a
//     phone, an email, a telegram/ whatsapp id, a participant id)
//   * an alias is only created through an EXPLICIT, VERIFIED act — the person
//     asserting their own alias, or an operator merging. There is deliberately
//     no probabilistic "these two rows are probably the same person" path.
//
// The rule that never changes: a client cannot declare "I am also that
// person". Every binding is either self-asserted (same authenticated caller)
// or operator-performed.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';

export const ALIAS_KINDS = ['user', 'phone', 'email', 'telegram', 'whatsapp', 'participant'];

/** Normalise a phone alias so "0722..." and "+254722..." bind the same key. */
export function normaliseAlias(kind, value) {
  const s = String(value ?? '').trim();
  if (!s) return null;
  if (kind === 'user' || kind === 'participant') return s;
  if (kind === 'email') return s.toLowerCase();
  if (kind === 'phone') {
    const digits = s.replace(/[^0-9]/g, '');
    let n = digits;
    if (n.startsWith('254')) { /* ok */ }
    else if (n.startsWith('0')) n = `254${n.slice(1)}`;
    else if (n.length === 9 && (n.startsWith('7') || n.startsWith('1'))) n = `254${n}`;
    else return null;
    if (!/^254[71][0-9]{8}$/.test(n)) return null;
    return n;
  }
  return s.toLowerCase();
}

/** The person that owns a given alias, or null. */
export function findByAlias(kind, value) {
  const normalised = normaliseAlias(kind, value);
  if (!normalised) return null;
  const row = store.find('personAliases', (a) => a.kind === kind && a.value === normalised);
  return row ? getPerson(row.personId) : null;
}

/** Find-or-create the person for an authenticated user. Explicit, not inferred. */
export function ensurePersonForUser(userId) {
  const existing = findByAlias('user', userId);
  if (existing) return existing;
  const user = store.find('users', (u) => u.id === userId);
  const person = store.insert('people', {
    id: newId('person'),
    displayName: user?.displayName ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  store.insert('personAliases', {
    id: newId('palias'),
    personId: person.id,
    kind: 'user',
    value: String(userId),
    verified: true,
    verifiedAt: new Date().toISOString(),
    source: 'account'
  });
  return person;
}

export function getPerson(id) {
  const p = store.find('people', (x) => x.id === id);
  if (!p) return null;
  return { ...p, aliases: store.filter('personAliases', (a) => a.personId === id) };
}

/**
 * Bind an alias to a person. `verified` is REQUIRED to be true unless the
 * operator explicitly overrides (operatorVerified). This is the "never weak
 * inference" gate: a binding must be an explicit, verifiable act.
 */
export function linkAlias(personId, kind, value, { verified = false, source = 'self', operatorVerified = false }) {
  if (!ALIAS_KINDS.includes(kind)) throw new Error(`invalid alias kind: ${kind}`);
  if (!getPerson(personId)) throw new Error('person not found');
  const normalised = normaliseAlias(kind, value);
  if (!normalised) throw new Error('invalid alias value');
  if (!verified && !operatorVerified) {
    throw new Error('an alias binding must be verified before it is linked');
  }
  // A value can only belong to one person. Re-binding is refused, not silent.
  const existing = store.find('personAliases', (a) => a.kind === kind && a.value === normalised);
  if (existing) {
    if (existing.personId === personId) return existing; // idempotent
    throw new Error('this alias is already linked to another person');
  }
  return store.insert('personAliases', {
    id: newId('palias'),
    personId,
    kind,
    value: normalised,
    verified: verified || operatorVerified,
    verifiedAt: new Date().toISOString(),
    source
  });
}

/** Operator merge: fold `from` into `into`, re-pointing every alias. */
export function mergePersons(fromId, intoId, actorId) {
  if (fromId === intoId) throw new Error('cannot merge a person into itself');
  const from = getPerson(fromId);
  const into = getPerson(intoId);
  if (!from || !into) throw new Error('person not found');
  let moved = 0;
  for (const a of from.aliases) {
    // Re-point: the alias now belongs to `into`. A collision (same kind+value
    // on both) means the target already owns that identity — skip it.
    const clash = store.find('personAliases', (x) => x.kind === a.kind && x.value === a.value && x.personId === intoId);
    if (clash) continue;
    store.update('personAliases', a.id, { personId: intoId });
    moved++;
  }
  store.remove('people', fromId);
  store.insert('auditLog', {
    id: newId('audit'),
    scope: 'person',
    action: 'merge',
    actorId,
    from: fromId,
    to: intoId,
    at: new Date().toISOString()
  });
  return { merged: true, movedAliases: moved, into: getPerson(intoId) };
}

/** A person's assembled timeline across the records Brief actually holds. */
export function timeline(personId, opts = {}) {
  const person = getPerson(personId);
  if (!person) return null;
  const userIds = new Set(person.aliases.filter((a) => a.kind === 'user').map((a) => a.value));
  const participantIds = new Set(person.aliases.filter((a) => a.kind === 'participant').map((a) => a.value));

  const registrations = store.filter('registrations', (r) =>
    userIds.has(r.userId) || participantIds.has(r.attendeeRef) || participantIds.has(r.id)
  );
  const orders = store.filter('orders', (o) => userIds.has(o.buyerId));
  const footsteps = store.filter('footsteps', (f) =>
    userIds.has(f.actorId) || participantIds.has(f.actorId)
  );
  const checkins = store.filter('registrations', (r) =>
    r.checkedInAt && (userIds.has(r.userId) || participantIds.has(r.attendeeRef) || participantIds.has(r.id))
  );

  const events = []
    .concat(registrations.map((r) => ({ type: 'registration', at: r.createdAt, ref: r.id, campaignId: r.campaignId })))
    .concat(orders.map((o) => ({ type: 'order', at: o.createdAt, ref: o.id, status: o.status })))
    .concat(footsteps.map((f) => ({ type: 'footstep', at: f.at ?? f.createdAt, ref: f.id, kind: f.kind })))
    .concat(checkins.map((r) => ({ type: 'check_in', at: r.checkedInAt, ref: r.id, campaignId: r.campaignId })))
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));

  return { person, counts: { registrations: registrations.length, orders: orders.length, footsteps: footsteps.length, checkIns: checkins.length }, events: opts.limit ? events.slice(-opts.limit) : events };
}
