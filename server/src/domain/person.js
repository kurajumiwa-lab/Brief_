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

/**
 * Aliases a caller may assert about themselves over HTTP.
 *
 * Account id is proven by the session. Everything else needs a real check
 * (Telegram HMAC, phone OTP, operator). Claiming "this WhatsApp is me"
 * without a check is a guess, and Brief refuses guesses.
 */
export const SELF_ASSERTABLE_KINDS = ['user', 'participant'];
export const CHECKED_ALIAS_KINDS = ['phone', 'email', 'telegram', 'whatsapp'];

/** Find-or-create the person for an authenticated user. Explicit, not inferred. */
export function ensurePersonForUser(userId) {
  const existing = findByAlias('user', userId);
  if (existing) {
    // Keep the stored display name in step with the account when the person
    // has not set their own.
    const user = store.find('users', (u) => u.id === userId);
    if (user?.displayName && !existing.displayName) {
      store.update('people', existing.id, { displayName: user.displayName });
      return getPerson(existing.id);
    }
    return existing;
  }
  const user = store.find('users', (u) => u.id === userId);
  const person = store.insert('people', {
    id: newId('person'),
    displayName: user?.displayName ?? null,
    tags: [],
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
  return getPerson(person.id);
}

/** The person id for a user, creating the person if needed. */
export function personIdForUser(userId) {
  if (!userId) return null;
  return ensurePersonForUser(userId).id;
}

/**
 * Stamp a personId only when this id is already a user (or already has a
 * user alias). A vault guest / participant id is not a person.
 */
export function personIdIfUser(userId) {
  if (!userId) return null;
  const existing = findByAlias('user', userId);
  if (existing) return existing.id;
  if (store.find('users', (u) => u.id === userId)) return personIdForUser(userId);
  return null;
}

/**
 * Display name Brief will print for this account. Never a fixture handle.
 * Falls back to the account display name, then "Player".
 */
export function resolveDisplayName(userId) {
  if (!userId) return 'Player';
  const person = findByAlias('user', userId);
  if (person?.displayName) return person.displayName;
  const user = store.find('users', (u) => u.id === userId);
  if (user?.displayName) return user.displayName;
  if (user?.handle) return user.handle;
  return 'Player';
}

/**
 * Bind a Telegram user id after HMAC verification. The only honest way a
 * Telegram alias becomes verified.
 */
export function bindTelegram(userId, telegramUserId) {
  if (!userId || !telegramUserId) throw new Error('a telegram binding needs both identities');
  const person = ensurePersonForUser(userId);
  return linkAlias(person.id, 'telegram', String(telegramUserId), {
    verified: true,
    source: 'telegram_init'
  });
}

/**
 * One standing for one person: hosted campaigns, bought orders, vendor,
 * registrations. Views of the same human, not three logins.
 */
export function standing(personId) {
  const person = getPerson(personId);
  if (!person) return null;
  const userIds = new Set(person.aliases.filter((a) => a.kind === 'user').map((a) => a.value));

  const hosted = store.filter('campaigns', (c) => userIds.has(c.ownerId));
  const bought = store.filter('orders', (o) => userIds.has(o.buyerId) || o.personId === personId);
  const vendor = store.find('vendors', (v) => userIds.has(v.ownerId) || v.personId === personId);
  const registrations = store.filter('registrations', (r) =>
    userIds.has(r.userId) || r.personId === personId
  );
  const arrived = registrations.filter((r) => r.status === 'checked_in');
  const gameTags = store.filter('arenaPlayers', (p) =>
    userIds.has(p.userId) || p.personId === personId
  );

  return {
    personId,
    displayName: person.displayName ?? resolveDisplayName([...userIds][0]),
    hosted: hosted.length,
    bought: bought.length,
    arrived: arrived.length,
    registered: registrations.length,
    vendor: vendor
      ? { id: vendor.id, displayName: vendor.displayName }
      : null,
    gameTags: gameTags.map((p) => ({
      id: p.id,
      gameId: p.gameId,
      gamerTag: p.gamerTag,
      verified: Boolean(p.verified)
    }))
  };
}

export function getPerson(id) {
  const p = store.find('people', (x) => x.id === id);
  if (!p) return null;
  return { ...p, tags: p.tags ?? [], aliases: store.filter('personAliases', (a) => a.personId === id) };
}

/**
 * Add a tag to a person (the CRM "interests" field). Idempotent and additive —
 * tags are a creator's own labels ("Outdoor enthusiast", "Bought hiking
 * guide"), never a computed score.
 */
export function tagPerson(personId, tag) {
  const p = store.find('people', (x) => x.id === personId);
  if (!p) throw new Error('person not found');
  const clean = String(tag ?? '').trim();
  if (!clean) throw new Error('tag is required');
  const tags = [...new Set([...(p.tags ?? []), clean])];
  return store.update('people', personId, { tags, updatedAt: new Date().toISOString() });
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
    userIds.has(r.userId) || participantIds.has(r.attendeeRef) || participantIds.has(r.id) || r.personId === personId
  );
  const orders = store.filter('orders', (o) => userIds.has(o.buyerId) || o.personId === personId);
  const footsteps = store.filter('footsteps', (f) =>
    userIds.has(f.actorId) || participantIds.has(f.actorId) || f.personId === personId
  );
  const checkins = store.filter('registrations', (r) =>
    r.checkedInAt && (userIds.has(r.userId) || participantIds.has(r.attendeeRef) || participantIds.has(r.id) || r.personId === personId)
  );

  const events = []
    .concat(registrations.map((r) => ({ type: 'registration', at: r.createdAt, ref: r.id, campaignId: r.campaignId })))
    .concat(orders.map((o) => ({ type: 'order', at: o.createdAt, ref: o.id, status: o.status })))
    .concat(footsteps.map((f) => ({ type: 'footstep', at: f.at ?? f.createdAt, ref: f.id, kind: f.kind })))
    .concat(checkins.map((r) => ({ type: 'check_in', at: r.checkedInAt, ref: r.id, campaignId: r.campaignId })))
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));

  return { person, counts: { registrations: registrations.length, orders: orders.length, footsteps: footsteps.length, checkIns: checkins.length }, events: opts.limit ? events.slice(-opts.limit) : events };
}

// ---------------------------------------------------------------------------
// AVAILABILITY — explicit, off by default. Presence is not consent.
// ---------------------------------------------------------------------------

export const AVAILABILITY_STATES = ['available', 'offline'];
export const AVAILABILITY_WINDOWS = ['now', 'today', 'tonight', 'this_week'];
export const AVAILABILITY_FORMATS = ['1v1', '2v2', 'team'];

/**
 * The caller's availability row, or a synthetic offline default. Brief never
 * invents "available" from last-seen or activity.
 */
export function getAvailability(userId) {
  if (!userId) return null;
  const row = store.find('arenaAvailability', (a) => a.userId === userId);
  if (row) return row;
  return {
    userId,
    personId: findByAlias('user', userId)?.id ?? null,
    state: 'offline',
    gameId: null,
    mode: null,
    format: null,
    window: null,
    locationKind: null,
    updatedAt: null
  };
}

/**
 * Set availability. Off (offline) is the default and clears the listing.
 * Turning on requires an explicit game + format + window + place.
 */
export function setAvailability(userId, patch = {}) {
  if (!userId) throw new Error('a player is required');
  const personId = personIdForUser(userId);
  const state = patch.state ?? 'offline';
  if (!AVAILABILITY_STATES.includes(state)) {
    throw new Error(`state must be one of ${AVAILABILITY_STATES.join(', ')}`);
  }

  const existing = store.find('arenaAvailability', (a) => a.userId === userId);
  const now = new Date().toISOString();

  if (state !== 'available') {
    const row = {
      userId,
      personId,
      state: 'offline',
      gameId: null,
      mode: null,
      format: null,
      window: null,
      locationKind: null,
      updatedAt: now
    };
    if (existing) return store.update('arenaAvailability', existing.id, row);
    return store.insert('arenaAvailability', { id: newId('av'), ...row, createdAt: now });
  }

  const gameId = patch.gameId ?? existing?.gameId ?? null;
  const format = patch.format ?? existing?.format ?? '1v1';
  const window = patch.window ?? existing?.window ?? 'tonight';
  const locationKind = patch.locationKind ?? existing?.locationKind ?? 'online';
  const mode = patch.mode ?? existing?.mode ?? '1v1';
  if (!gameId) throw new Error('pick a game before going available');
  if (!AVAILABILITY_FORMATS.includes(format)) {
    throw new Error(`format must be one of ${AVAILABILITY_FORMATS.join(', ')}`);
  }
  if (!AVAILABILITY_WINDOWS.includes(window)) {
    throw new Error(`window must be one of ${AVAILABILITY_WINDOWS.join(', ')}`);
  }

  const row = {
    userId,
    personId,
    state: 'available',
    gameId,
    mode: String(mode).slice(0, 16),
    format,
    window,
    locationKind: locationKind === 'venue' ? 'venue' : 'online',
    updatedAt: now
  };
  if (existing) return store.update('arenaAvailability', existing.id, row);
  return store.insert('arenaAvailability', { id: newId('av'), ...row, createdAt: now });
}

/**
 * Public list of people who switched available on. No social graph, no
 * search of everyone who ever created a game tag.
 */
export function listAvailable({ gameId = null } = {}) {
  let rows = store.filter('arenaAvailability', (a) => a.state === 'available');
  if (gameId) rows = rows.filter((a) => a.gameId === gameId);
  return rows.map((a) => ({
    userId: a.userId,
    personId: a.personId,
    displayName: resolveDisplayName(a.userId),
    gameId: a.gameId,
    mode: a.mode,
    format: a.format,
    window: a.window,
    locationKind: a.locationKind,
    updatedAt: a.updatedAt
  }));
}
