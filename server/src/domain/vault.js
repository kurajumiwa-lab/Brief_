// ---------------------------------------------------------------------------
// THE VAULT — a persistent context layer
//
// A Vault wraps a real-world activity (a gathering, event, market, campaign,
// service, or deal) and gives it one stable identity. Channels, people,
// vendors, orders, payment intents and ledger transactions all open INTO a
// Vault; the Vault is the room they share, and the Footsteps are its memory.
//
// PRINCIPLES
//   * A change of channel must NOT create a new business context. One real
//     activity is one Vault, no matter how many doors it is entered through.
//   * The Vault owns NO money. orders / paymentIntents / ledgerTransactions
//     remain the single economic layer; the Vault only adds context around
//     them. Financial state is never inferred from a Vault action.
//   * Authorization is scoped. A host sees everything; a guest sees their own
//     experience; a vendor sees only their scoped requests; the public sees a
//     deliberately minimal projection.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import * as footsteps from './footsteps.js';
import * as handoff from './handoff.js';

export const VAULT_TYPES = ['gathering', 'event', 'marketplace', 'campaign', 'service', 'deal'];
export const VAULT_STATUS = ['active', 'pending', 'settled', 'closed', 'archived'];
export const VAULT_VISIBILITY = ['public', 'private', 'invite_only', 'token_access'];
export const PARTICIPANT_ROLES = ['host', 'guest', 'vendor', 'admin'];
export const REQUEST_STATUS = ['open', 'routed', 'accepted', 'declined', 'fulfilled'];

function slugify(title) {
  const base = String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'vault';
  return `${base}-${newId('').slice(2, 6)}`;
}

function now() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// ACCESS CONTROL
// ---------------------------------------------------------------------------

/** The caller's participant role in a vault, or null. Read from stored rows. */
export function participantRole(storeImpl, actorId, vaultId) {
  // A participant is matched by their authenticated user id OR by their
  // participant id — the latter covers guests who entered through a public
  // link and have no account (their entry token resolves to a participant id).
  const row = storeImpl.find(
    'vaultParticipants',
    (p) => p.vaultId === vaultId && (p.userId === actorId || p.id === actorId)
  );
  return row ? row.role : null;
}

function isOwner(storeImpl, actorId, vaultId) {
  const v = storeImpl.find('vaults', (x) => x.id === vaultId);
  return Boolean(v && v.ownerId === actorId);
}

/**
 * The strongest role the caller holds, in order host > admin > vendor > guest.
 * Ownership implies host. Returns null when the caller has no access.
 */
export function accessRole(storeImpl, actorId, vaultId) {
  if (!actorId) return null;
  if (isOwner(storeImpl, actorId, vaultId)) return 'host';
  const role = participantRole(storeImpl, actorId, vaultId);
  return role ?? null;
}

const ROLE_RANK = { guest: 1, vendor: 2, admin: 3, host: 4 };

/** May `actor` perform `required` or a stronger role's action? */
export function canAct(storeImpl, actorId, vaultId, required) {
  const role = accessRole(storeImpl, actorId, vaultId);
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

// ---------------------------------------------------------------------------
// CREATE / READ / UPDATE / CLOSE
// ---------------------------------------------------------------------------

export function createVault({
  ownerId,
  type = 'gathering',
  title,
  description = '',
  visibility = 'private',
  location = null,
  startsAt = null,
  endsAt = null,
  sourceId = null,
  metadata = {}
}) {
  if (!ownerId) throw new Error('ownerId is required');
  if (!VAULT_TYPES.includes(type)) throw new Error(`vault type must be one of ${VAULT_TYPES.join(', ')}`);
  if (!title || !String(title).trim()) throw new Error('title is required');
  if (!VAULT_VISIBILITY.includes(visibility)) throw new Error(`visibility must be one of ${VAULT_VISIBILITY.join(', ')}`);

  const t = now();
  const vault = store.insert('vaults', {
    id: newId('vault'),
    slug: slugify(title),
    type,
    title: String(title).trim(),
    description: String(description ?? ''),
    status: 'active',
    visibility,
    ownerId,
    sourceId,
    location,
    startsAt,
    endsAt,
    // Links to the real things this vault wraps. { kind, id }. Kinds:
    // order, object, campaign, vendor, transaction, listing.
    links: [],
    metadata,
    createdAt: t,
    updatedAt: t,
    closedAt: null
  });

  // The owner is the first host participant.
  store.insert('vaultParticipants', {
    id: newId('part'),
    vaultId: vault.id,
    userId: ownerId,
    role: 'host',
    name: null,
    phone: null,
    channel: 'web',
    joinedAt: t
  });

  footsteps.recordFootstep({
    vaultId: vault.id,
    kind: 'vault_created',
    actorId: ownerId,
    channel: 'web',
    metadata: { type, visibility }
  });

  return vault;
}

export function getVault(id) {
  return store.find('vaults', (v) => v.id === id) ?? null;
}

export function getVaultBySlug(slug) {
  return store.find('vaults', (v) => v.slug === slug) ?? null;
}

/** Vaults where the caller is the owner or a participant. */
export function listVaults(actorId, { status = null, limit = 100 } = {}) {
  if (!actorId) return [];
  let rows = store.filter('vaults', (v) =>
    v.ownerId === actorId ||
    store.find('vaultParticipants', (p) => p.vaultId === v.id && p.userId === actorId)
  );
  if (status) rows = rows.filter((v) => v.status === status);
  return rows
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
    .map((v) => hydrate(store, v));
}

export function updateVault(actorId, vaultId, patch) {
  const vault = getVault(vaultId);
  if (!vault) throw new Error('vault not found');
  if (!canAct(store, actorId, vaultId, 'host')) throw new Error('only the host may edit this vault');

  const allowed = ['title', 'description', 'type', 'visibility', 'location', 'startsAt', 'endsAt', 'status', 'metadata'];
  const next = {};
  for (const k of allowed) {
    if (k in patch) next[k] = patch[k];
  }
  if (next.type && !VAULT_TYPES.includes(next.type)) throw new Error('invalid vault type');
  if (next.visibility && !VAULT_VISIBILITY.includes(next.visibility)) throw new Error('invalid visibility');
  if (next.status && !VAULT_STATUS.includes(next.status)) throw new Error('invalid status');

  return store.update('vaults', vaultId, next);
}

export function closeVault(actorId, vaultId, { note = '' } = {}) {
  const vault = getVault(vaultId);
  if (!vault) throw new Error('vault not found');
  if (!canAct(store, actorId, vaultId, 'host')) throw new Error('only the host may close this vault');
  if (vault.status === 'closed') return vault;

  const updated = store.update('vaults', vaultId, {
    status: 'closed',
    closedAt: now()
  });
  footsteps.recordFootstep({
    vaultId,
    kind: 'vault_closed',
    actorId,
    channel: 'web',
    metadata: { note }
  });
  return updated;
}

// ---------------------------------------------------------------------------
// PARTICIPANTS
// ---------------------------------------------------------------------------

export function addParticipant(actorId, {
  vaultId,
  role = 'guest',
  userId = null,
  name = null,
  phone = null,
  channel = 'web'
}) {
  const vault = getVault(vaultId);
  if (!vault) throw new Error('vault not found');
  // Hosts/admin add participants; a caller may also join themselves as a guest.
  const me = actorId;
  if (role === 'guest' && userId === me) {
    // self-join is fine
  } else if (!canAct(store, actorId, vaultId, 'admin')) {
    throw new Error('only the host may add participants');
  }
  if (!PARTICIPANT_ROLES.includes(role)) throw new Error('invalid role');

  // One participant row per (vault, user). Re-adding returns the existing row.
  if (userId) {
    const existing = store.find(
      'vaultParticipants',
      (p) => p.vaultId === vaultId && p.userId === userId
    );
    if (existing) return existing;
  }

  const participant = store.insert('vaultParticipants', {
    id: newId('part'),
    vaultId,
    userId,
    role,
    name,
    phone,
    channel,
    joinedAt: now()
  });

  footsteps.recordFootstep({
    vaultId,
    kind: 'person_joined',
    actorId: userId ?? me,
    actorName: name ?? null,
    channel,
    metadata: { role, participantId: participant.id }
  });

  return participant;
}

export function listParticipants(vaultId) {
  return store.filter('vaultParticipants', (p) => p.vaultId === vaultId);
}

export function getParticipant(id) {
  return store.find('vaultParticipants', (p) => p.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// LINKS (order / object / campaign / vendor / transaction / listing)
// ---------------------------------------------------------------------------

const LINK_KINDS = ['order', 'object', 'campaign', 'vendor', 'transaction', 'listing'];

export function linkVault(actorId, vaultId, { kind, id }) {
  const vault = getVault(vaultId);
  if (!vault) throw new Error('vault not found');
  if (!canAct(store, actorId, vaultId, 'admin')) throw new Error('only the host may link things to this vault');
  if (!LINK_KINDS.includes(kind)) throw new Error('invalid link kind');

  const existing = vault.links.find((l) => l.kind === kind && l.id === id);
  if (existing) return vault;

  const updated = store.update('vaults', vaultId, {
    links: [...vault.links, { kind, id }]
  });

  // A link is a real event: record the context it introduces.
  footsteps.recordFootstep({
    vaultId,
    kind: linkKindToFootstep(kind),
    actorId,
    channel: 'web',
    metadata: { kind, id }
  });

  return updated;
}

function linkKindToFootstep(kind) {
  return {
    order: 'order_created',
    transaction: 'payment_settled',
    vendor: 'vendor_contacted',
    object: 'message_received',
    campaign: 'vault_created',
    listing: 'request_created'
  }[kind] ?? 'message_received';
}

/** Vaults that link a given order (for the payment → footstep wiring). */
export function vaultsForOrder(orderId) {
  return store.filter('vaults', (v) => v.links.some((l) => l.kind === 'order' && l.id === orderId));
}

/** Vaults that link a given campaign (for the check-in → footstep wiring). */
export function vaultsForCampaign(campaignId) {
  return store.filter('vaults', (v) => v.links.some((l) => l.kind === 'campaign' && l.id === campaignId));
}

// ---------------------------------------------------------------------------
// REQUESTS (guest asks, host routes, vendor accepts)
// ---------------------------------------------------------------------------

export function createRequest(actorId, {
  vaultId,
  participantId = null,
  kind = 'service',
  description,
  quantity = 1,
  priceEstimate = null,
  location = null,
  notes = null
}) {
  const vault = getVault(vaultId);
  if (!vault) throw new Error('vault not found');
  if (!description || !String(description).trim()) throw new Error('a request needs a description');

  const request = store.insert('vaultRequests', {
    id: newId('req'),
    vaultId,
    participantId,
    from: actorId,
    kind,
    description: String(description).trim(),
    quantity,
    priceEstimate,
    location,
    notes,
    status: 'open',
    vendorId: null,
    orderId: null,
    createdAt: now(),
    updatedAt: now()
  });

  footsteps.recordFootstep({
    vaultId,
    kind: 'request_created',
    actorId,
    channel: 'web',
    metadata: { requestId: request.id, description }
  });

  return request;
}

export function routeRequest(actorId, { requestId, vendorId }) {
  const request = store.find('vaultRequests', (r) => r.id === requestId);
  if (!request) throw new Error('request not found');
  if (!canAct(store, actorId, request.vaultId, 'host')) throw new Error('only the host may route a request');
  const vendor = store.find('vendors', (v) => v.id === vendorId);
  if (!vendor) throw new Error('vendor not found');

  const updated = store.update('vaultRequests', requestId, { vendorId, status: 'routed' });

  // Routing grants the vendor SCOPED access: add the vendor's owner as a
  // vendor participant (if not already) so they see only this request.
  const already = store.find(
    'vaultParticipants',
    (p) => p.vaultId === request.vaultId && p.userId === vendor.ownerId
  );
  if (!already) {
    store.insert('vaultParticipants', {
      id: newId('part'),
      vaultId: request.vaultId,
      userId: vendor.ownerId,
      role: 'vendor',
      name: vendor.displayName,
      phone: null,
      channel: 'web',
      joinedAt: now()
    });
  }

  footsteps.recordFootstep({
    vaultId: request.vaultId,
    kind: 'request_routed',
    actorId,
    channel: 'web',
    metadata: { requestId, vendorId }
  });
  return updated;
}

export function acceptRequest(actorId, { requestId }) {
  const request = store.find('vaultRequests', (r) => r.id === requestId);
  if (!request) throw new Error('request not found');
  // The host may accept; the owner of the routed vendor may accept. Nobody
  // else. (A vendor's owner is who the request is routed TO.)
  const isHost = canAct(store, actorId, request.vaultId, 'host');
  let isRoutedVendor = false;
  if (request.vendorId) {
    const vendor = store.find('vendors', (v) => v.id === request.vendorId);
    isRoutedVendor = Boolean(vendor && vendor.ownerId === actorId);
  }
  if (!isHost && !isRoutedVendor) throw new Error('not authorized to accept this request');
  if (request.status !== 'routed' && request.status !== 'open') {
    throw new Error(`request is already ${request.status}`);
  }

  const updated = store.update('vaultRequests', requestId, { status: 'accepted' });
  footsteps.recordFootstep({
    vaultId: request.vaultId,
    kind: 'request_accepted',
    actorId,
    channel: 'web',
    metadata: { requestId }
  });
  return updated;
}

export function setRequestStatus(actorId, requestId, status, { orderId = null } = {}) {
  const request = store.find('vaultRequests', (r) => r.id === requestId);
  if (!request) throw new Error('request not found');
  if (!REQUEST_STATUS.includes(status)) throw new Error('invalid request status');
  if (!canAct(store, actorId, request.vaultId, 'host') &&
      participantRole(store, actorId, request.vaultId) !== 'vendor') {
    throw new Error('not authorized');
  }

  const updated = store.update('vaultRequests', requestId, { status, orderId: orderId ?? request.orderId });
  const kind = status === 'fulfilled' ? 'request_fulfilled' : status === 'declined' ? 'request_declined' : 'request_created';
  footsteps.recordFootstep({
    vaultId: request.vaultId,
    kind,
    actorId,
    channel: 'web',
    metadata: { requestId, status }
  });
  return updated;
}

export function listRequests(vaultId, { vendorId = null } = {}) {
  let rows = store.filter('vaultRequests', (r) => r.vaultId === vaultId);
  if (vendorId) rows = rows.filter((r) => r.vendorId === vendorId);
  return rows.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// ---------------------------------------------------------------------------
// CHANNELS (doors)
// ---------------------------------------------------------------------------

export function attachChannel(actorId, { vaultId, channel, externalId = null }) {
  const vault = getVault(vaultId);
  if (!vault) throw new Error('vault not found');
  if (!canAct(store, actorId, vaultId, 'admin')) throw new Error('only the host may attach a channel');

  const existing = store.find(
    'vaultChannels',
    (c) => c.vaultId === vaultId && c.channel === channel
  );
  if (existing) return existing;

  return store.insert('vaultChannels', {
    id: newId('chan'),
    vaultId,
    channel,
    externalId,
    connectedAt: now()
  });
}

export function listChannels(vaultId) {
  return store.filter('vaultChannels', (c) => c.vaultId === vaultId);
}

// ---------------------------------------------------------------------------
// SCOPED VIEWS
// ---------------------------------------------------------------------------

/** Derived metrics shown on a vault card — computed, never stored. */
function metrics(storeImpl, vault) {
  const participants = storeImpl.filter('vaultParticipants', (p) => p.vaultId === vault.id);
  const requests = storeImpl.filter('vaultRequests', (r) => r.vaultId === vault.id);
  const pendingRequests = requests.filter((r) => r.status === 'open' || r.status === 'routed').length;
  const linkedOrderIds = vault.links.filter((l) => l.kind === 'order').map((l) => l.id);

  let pendingKes = 0;
  for (const oid of linkedOrderIds) {
    const order = storeImpl.find('orders', (o) => o.id === oid);
    if (!order || order.paid) continue;
    pendingKes += order.total;
  }

  return {
    participantCount: participants.length,
    requestCount: requests.length,
    pendingRequests,
    pendingKes,
    orderCount: linkedOrderIds.length,
    settled: vault.status === 'settled' || vault.status === 'closed'
  };
}

function hydrate(storeImpl, vault) {
  return { ...vault, metrics: metrics(storeImpl, vault) };
}

/** The projection a participant sees, scoped by their role. */
export function vaultView(actorId, vaultId) {
  const vault = getVault(vaultId);
  if (!vault) return null;
  const role = accessRole(store, actorId, vaultId);

  const base = {
    id: vault.id,
    slug: vault.slug,
    type: vault.type,
    title: vault.title,
    description: vault.description,
    status: vault.status,
    visibility: vault.visibility,
    location: vault.location,
    startsAt: vault.startsAt,
    endsAt: vault.endsAt,
    createdAt: vault.createdAt,
    closedAt: vault.closedAt,
    role,
    metrics: metrics(store, vault)
  };

  if (role === 'host' || role === 'admin') {
    return {
      ...base,
      ownerId: vault.ownerId,
      links: vault.links,
      participants: listParticipants(vaultId),
      channels: listChannels(vaultId),
      requests: listRequests(vaultId),
      metadata: vault.metadata
    };
  }

  if (role === 'vendor') {
    // A vendor sees only their scoped requests and the vault's bare context.
    const vendor = store.find('vendors', (v) => v.ownerId === actorId);
    const vendorId = vendor?.id ?? null;
    return {
      ...base,
      requests: listRequests(vaultId, { vendorId })
    };
  }

  if (role === 'guest') {
    const me = store.find(
      'vaultParticipants',
      (p) => p.vaultId === vaultId && (p.userId === actorId || p.id === actorId)
    );
    return {
      ...base,
      participant: me ? { id: me.id, role: me.role, name: me.name, joinedAt: me.joinedAt } : null,
      // Guests see the schedule/location and their own RSVP, not the roster.
      location: vault.location,
      startsAt: vault.startsAt,
      endsAt: vault.endsAt
    };
  }

  // Public / anonymous: the minimal projection.
  return {
    id: vault.id,
    slug: vault.slug,
    type: vault.type,
    title: vault.title,
    description: vault.description,
    status: vault.status,
    visibility: vault.visibility,
    location: vault.visibility === 'public' ? vault.location : null,
    startsAt: vault.visibility === 'public' ? vault.startsAt : null,
    endsAt: vault.visibility === 'public' ? vault.endsAt : null,
    metrics: { participantCount: metrics(store, vault).participantCount },
    role: 'public'
  };
}

// ---------------------------------------------------------------------------
// PUBLIC ENTRY
// ---------------------------------------------------------------------------

/** Whether a vault is enterable through a public link right now. */
export function isPubliclyEnterable(vault) {
  return vault.status === 'active' && ['public', 'token_access', 'invite_only'].includes(vault.visibility);
}

/**
 * A guest enters through a public link (no account required). Returns their
 * participant row plus an entry token so later actions are attributable.
 */
export function publicEnter(slug, { name = null, phone = null, channel = 'web' }) {
  const vault = getVaultBySlug(slug);
  if (!vault) return { ok: false, reason: 'not_found' };
  if (!isPubliclyEnterable(vault)) return { ok: false, reason: 'not_open' };

  // A guest has no userId yet; we mint a participant with a guest identity
  // and bind an entry token to it.
  const participant = store.insert('vaultParticipants', {
    id: newId('part'),
    vaultId: vault.id,
    userId: null,
    role: 'guest',
    name,
    phone,
    channel,
    joinedAt: now()
  });

  footsteps.recordFootstep({
    vaultId: vault.id,
    kind: 'person_joined',
    actorName: name ?? 'A guest',
    channel,
    metadata: { participantId: participant.id, via: 'public_link' }
  });

  const token = handoff.createHandoff({
    vaultId: vault.id,
    participantId: participant.id,
    purpose: 'guest_entry',
    fromChannel: channel,
    ttlMs: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  if (!token.ok) return { ok: false, reason: token.reason };

  return {
    ok: true,
    vault: vaultView(participant.userId, vault.id),
    participant: { id: participant.id, role: 'guest', name, joinedAt: participant.joinedAt },
    token: token.token
  };
}

/**
 * Emit a footstep onto every vault that links a given order. Used by the
 * order and payment flows so a vault's timeline reflects the commerce that
 * happens inside it without the vault needing to poll. No-op when unlinked.
 */
export function emitOrderFootsteps(orderId, kind, { actorId = null, actorName = null, value = null, dedupeKey = null, metadata = {} } = {}) {
  const vaults = vaultsForOrder(orderId);
  for (const vault of vaults) {
    footsteps.recordFootstep({
      vaultId: vault.id,
      kind,
      actorId,
      actorName,
      value,
      dedupeKey: dedupeKey ? `${dedupeKey}:${vault.id}` : null,
      metadata: { ...metadata, orderId }
    });
  }
}

/**
 * Emit a footstep onto every vault that links a given campaign. Mirrors
 * emitOrderFootsteps: a check-in is a real event the vault narrates, deduped so
 * a re-scan never double-records. No-op when unlinked.
 */
export function emitCampaignFootsteps(campaignId, kind, { actorId = null, actorName = null, value = null, dedupeKey = null, metadata = {} } = {}) {
  const vaults = vaultsForCampaign(campaignId);
  for (const vault of vaults) {
    footsteps.recordFootstep({
      vaultId: vault.id,
      kind,
      actorId,
      actorName,
      value,
      dedupeKey: dedupeKey ? `${dedupeKey}:${vault.id}` : null,
      metadata: { ...metadata, campaignId }
    });
  }
}

// ---------------------------------------------------------------------------
// RESOLUTION & SEARCH
// ---------------------------------------------------------------------------

/** Things needing attention, derived from real rows — never stored. */
export function resolution() {
  const items = [];
  for (const vault of store.all('vaults')) {
    if (vault.status === 'closed' || vault.status === 'archived') continue;

    for (const r of store.filter('vaultRequests', (x) => x.vaultId === vault.id)) {
      if (r.status === 'open' || r.status === 'routed') {
        items.push({ vaultId: vault.id, vaultTitle: vault.title, kind: 'request_unresolved', requestId: r.id, description: r.description });
      }
    }

    const orderIds = vault.links.filter((l) => l.kind === 'order').map((l) => l.id);
    for (const oid of orderIds) {
      const failed = store.find('paymentIntents', (p) => p.orderId === oid && p.status === 'failed');
      if (failed) {
        items.push({ vaultId: vault.id, vaultTitle: vault.title, kind: 'payment_failed', orderId: oid, failureReason: failed.failureReason });
      }
      const stalled = store.find('paymentIntents', (p) =>
        p.orderId === oid && p.status === 'authorized' && Date.now() - Date.parse(p.createdAt) > 15 * 60 * 1000
      );
      if (stalled) {
        items.push({ vaultId: vault.id, vaultTitle: vault.title, kind: 'callback_pending', orderId: oid, providerRef: stalled.providerRef });
      }
    }
  }
  return items;
}

/**
 * Real search over the actual data layer: vaults, participants, footsteps,
 * requests, and linked object/vendor titles. No fake index.
 */
export function searchVaults(q) {
  const needle = String(q ?? '').trim().toLowerCase();
  if (!needle) return [];
  const results = [];

  for (const vault of store.all('vaults')) {
    const matches = [];
    if ((vault.title + ' ' + vault.description).toLowerCase().includes(needle)) {
      matches.push({ where: 'vault', snippet: vault.title });
    }
    for (const p of store.filter('vaultParticipants', (x) => x.vaultId === vault.id)) {
      const hay = `${p.name ?? ''} ${p.phone ?? ''}`.toLowerCase();
      if (hay.includes(needle)) matches.push({ where: 'person', snippet: p.name ?? p.phone });
    }
    for (const f of store.filter('footsteps', (x) => x.vaultId === vault.id)) {
      if ((f.narrative ?? '').toLowerCase().includes(needle)) {
        matches.push({ where: 'footstep', snippet: f.narrative });
      }
    }
    for (const r of store.filter('vaultRequests', (x) => x.vaultId === vault.id)) {
      if (r.description.toLowerCase().includes(needle)) {
        matches.push({ where: 'request', snippet: r.description });
      }
    }
    for (const l of vault.links) {
      if (l.kind === 'object') {
        const o = store.find('objects', (x) => x.id === l.id);
        if (o && (o.title ?? '').toLowerCase().includes(needle)) matches.push({ where: 'object', snippet: o.title });
      }
      if (l.kind === 'vendor') {
        const v = store.find('vendors', (x) => x.id === l.id);
        if (v && (v.displayName ?? '').toLowerCase().includes(needle)) matches.push({ where: 'vendor', snippet: v.displayName });
      }
    }
    if (matches.length) {
      results.push({ vaultId: vault.id, title: vault.title, status: vault.status, matches: matches.slice(0, 5) });
    }
  }
  return results;
}
