// ---------------------------------------------------------------------------
// CAMPAIGN
//
// A Campaign is an ORCHESTRATION WRAPPER, not a second marketplace and not a
// new kind of thing to sell. It wraps an existing Brief object (an
// `experience` for a popup/session/event, a `product` for a drop) and adds
// exactly three capabilities the object layer does not have:
//
//   1. creator ownership          -- who controls distribution
//   2. a public shareable slug    -- one link to paste anywhere
//   3. a publication lifecycle    -- draft -> published -> live -> closed
//
// Everything else is REUSED:
//   - the wrapped object lives in `objects` like any other Brief object
//   - money is `ledgerTransactions` through the existing state machine
//   - activity is `signals`
//   - graph edges are `relationships` (no second graph)
//   - a financial goal is an existing TARGET Circle
//
// DERIVED, NEVER STORED: registrations, checked-in count, remaining capacity,
// revenue, views. Every one is computed from real rows on read. There is no
// writable counter anywhere in this file -- see analytics().
// ---------------------------------------------------------------------------

import { store, newId, newTicketCode } from '../store.js';
import { emitSignal } from './signal.js';

export const CAMPAIGN_TYPES = ['popup', 'session', 'drop', 'event'];

// Lifecycle. Mirrors the existing object `publication` convention rather than
// inventing a parallel vocabulary: only a `published`/`live` campaign is
// publicly readable.
export const CAMPAIGN_STATUS = ['draft', 'published', 'live', 'closed', 'cancelled', 'completed'];

const VALID_TRANSITIONS = {
  draft: ['published', 'cancelled'],
  published: ['live', 'closed', 'cancelled'],
  live: ['closed', 'cancelled'],
  closed: ['completed'],
  cancelled: [],
  completed: []
};

// The Brief object type each campaign type wraps. No new object types.
const OBJECT_TYPE_FOR = {
  popup: 'experience',
  session: 'experience',
  event: 'experience',
  drop: 'product'
};

export const REGISTRATION_STATES = [
  'started', 'registered', 'confirmed', 'checked_in', 'cancelled', 'no_show'
];

// Registrations that occupy a slot. A cancelled or no-show registration frees
// nothing retroactively but must not consume remaining capacity.
const OCCUPIES_SLOT = new Set(['started', 'registered', 'confirmed', 'checked_in']);

/**
 * URL-safe, readable, unguessable-enough slug. Not a security boundary --
 * publication status is. A slug only resolves when the campaign is public.
 */
function makeSlug(title) {
  const base = String(title || 'campaign')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'campaign';
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

function relate(sourceObjId, verb, targetObjId) {
  if (!sourceObjId || !targetObjId) return null;
  const existing = store.find(
    'relationships',
    (r) => r.sourceId === sourceObjId && r.verb === verb && r.targetId === targetObjId
  );
  if (existing) return existing;
  return store.insert('relationships', {
    id: newId('rel'),
    sourceId: sourceObjId,
    verb,
    targetId: targetObjId,
    createdAt: new Date().toISOString()
  });
}

// ---------------------------------------------------------------------------
// DERIVED METRICS
// ---------------------------------------------------------------------------

/**
 * Everything a dashboard shows, computed from real rows.
 *
 * There is deliberately no `campaign.revenue`, no `campaign.registrations`
 * and no `campaign.views` stored anywhere. A client cannot write these
 * because they do not exist as fields.
 */
export function analytics(campaignId) {
  const regs = store.filter('registrations', (r) => r.campaignId === campaignId);

  const occupied = regs.filter((r) => OCCUPIES_SLOT.has(r.status));
  const registered = regs.filter((r) => r.status !== 'started' && r.status !== 'cancelled');
  const checkedIn = regs.filter((r) => r.status === 'checked_in');
  const noShows = regs.filter((r) => r.status === 'no_show');
  const cancelled = regs.filter((r) => r.status === 'cancelled');

  // Money: only SETTLED transactions count as revenue. Pending money is
  // reported separately so a dashboard can never present it as earned.
  const txns = store.filter('ledgerTransactions', (t) => t.campaignId === campaignId);
  const settled = txns.filter((t) => t.status === 'settled');
  const pending = txns.filter((t) => ['created', 'pending', 'confirmed', 'held'].includes(t.status));

  const revenueSettled = settled.reduce((s, t) => s + t.amount, 0);
  const revenuePending = pending.reduce((s, t) => s + t.amount, 0);

  // Views come from recorded signals, not a counter.
  //
  // HONESTY: this is the number of times the public page was LOADED on the
  // server. It is not a count of people. A refresh counts twice, and a link
  // preview crawler counts as one. `viewers` narrows it to distinct coarse
  // fingerprints where one was recorded, which is closer to "people" but
  // still not a claim about identity -- so both are reported, and neither is
  // ever called "reach" or "impressions".
  const viewSignals = store.filter(
    'signals',
    (s) => s.metadata?.campaignId === campaignId && s.type === 'campaign_viewed'
  );
  const views = viewSignals.length;
  const fingerprints = new Set(
    viewSignals.map((s) => s.metadata?.viewerRef).filter(Boolean)
  );
  const viewers = fingerprints.size > 0 ? fingerprints.size : null;

  const shares = store.filter(
    'signals',
    (s) => s.metadata?.campaignId === campaignId && s.type === 'campaign_shared'
  ).length;

  const campaign = store.find('campaigns', (c) => c.id === campaignId);
  const capacity = campaign?.capacity ?? null;

  return {
    views,
    registrationsStarted: regs.length,
    registrations: registered.length,
    checkedIn: checkedIn.length,
    noShows: noShows.length,
    cancelled: cancelled.length,
    slotsTaken: occupied.length,
    capacity,
    remaining: capacity === null ? null : Math.max(0, capacity - occupied.length),
    orders: txns.length,
    revenueSettled,
    revenuePending,
    currency: campaign?.currency ?? 'KES',
    viewers,
    shares,
    // Conversion is only meaningful once a view has actually been recorded.
    // With no views this is `null` ("not enough data"), never 0 -- a real 0%
    // and an unmeasured one are different facts.
    conversionPct: views > 0 ? (registered.length / views) * 100 : null
  };
}

/**
 * A read-only projection of the wrapped object, so the Campaign -> Object ->
 * Circle chain can be rendered without a second request. Deliberately NOT a
 * copy of the object into the campaign row: it is recomputed on every read
 * from the objects table, and carries no economic fields.
 */
function objectView(objectId) {
  const o = store.find('objects', (x) => x.id === objectId);
  if (!o) return null;
  return {
    id: o.id,
    type: o.type,
    title: o.title,
    summary: o.summary ?? null,
    locationName: o.locationName ?? null,
    publication: o.publication,
    verificationStatus: o.verificationStatus ?? null
  };
}

function hydrate(campaign) {
  return {
    ...campaign,
    object: objectView(campaign.objectId),
    metrics: analytics(campaign.id)
  };
}

// ---------------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------------

/**
 * ATTACHMENT AUTHORITY.
 *
 * Objects deliberately carry NO ownerId (see PHASE7A audit): Brief's objects
 * arrive from ingestion and are shared, not owned. So "may this caller attach
 * this object?" is answered with the access model that already exists --
 * source membership -- rather than by inventing ownership.
 *
 * A caller may attach an object when ANY of these hold:
 *
 *   1. It is already public. Anyone can point at public information.
 *   2. It came from a source the caller has a granted membership on. This is
 *      the same rule `GET /api/objects` uses for `userHasAccess`.
 *   3. It has no provenance at all AND was created by one of the caller's own
 *      campaigns. That is the object this creator made through Brief.
 *
 * Anything else is refused. Note what this does NOT do: it never mutates the
 * object, never changes its publication, and never grants the caller rights
 * they did not already have.
 */
export function mayAttachObject(userId, object) {
  if (!object) return false;
  if (object.publication === 'discarded') return false;
  if (object.publication === 'public') return true;

  const provenance = store.filter('objectSources', (os) => os.objectId === object.id);
  if (provenance.length > 0) {
    return provenance.some((os) =>
      store.find(
        'sourceMemberships',
        (m) => m.sourceId === os.sourceId && m.userId === userId && m.accessGranted
      )
    );
  }

  // No provenance: only reachable if this creator's own campaign made it.
  return Boolean(
    store.find('campaigns', (c) => c.objectId === object.id && c.ownerId === userId)
  );
}

/**
 * Create a campaign AND the Brief object it wraps. `ownerId` is supplied by
 * the route from the authenticated caller -- never from the request body.
 */
export function createCampaign(ownerId, input = {}) {
  const {
    title, description = '', type = 'popup', location = null,
    startsAt = null, endsAt = null, capacity = null,
    price = 0, currency = 'KES', circleId = null, metadata = {},
    objectId = null
  } = input;

  if (!title || !String(title).trim()) throw new Error('title is required');
  if (!CAMPAIGN_TYPES.includes(type)) {
    throw new Error(`type must be one of ${CAMPAIGN_TYPES.join(', ')}`);
  }
  if (capacity !== null && !(Number.isInteger(capacity) && capacity > 0)) {
    throw new Error('capacity must be a positive integer when provided');
  }
  if (!Number.isFinite(price) || price < 0) throw new Error('price must be a non-negative number');
  if (circleId && !store.find('circles', (c) => c.id === circleId)) {
    throw new Error('circle not found');
  }

  const now = new Date().toISOString();

  // The campaign wraps a REAL Brief object, so it participates in discovery,
  // dedup and the relationship graph like anything else.
  //
  // Either it wraps an object that already exists -- attached, never copied,
  // never mutated -- or it creates the minimum object needed. A campaign never
  // duplicates object data into its own row.
  let object;
  if (objectId) {
    object = store.find('objects', (o) => o.id === objectId);
    if (!object) throw new Error('object not found');
    if (!mayAttachObject(ownerId, object)) throw new Error('not authorised to attach this object');
    // ATTACHED, NOT ABSORBED. No store.update() on the object here, and none
    // on publish either (see transitionCampaign): attaching must never change
    // an object's publication or any other field.
  } else {
    object = store.insert('objects', {
      id: newId('obj'),
      type: OBJECT_TYPE_FOR[type],
      title: String(title).trim(),
      summary: description,
      publication: 'private',
      createdAt: now,
      updatedAt: now
    });
  }

  const campaign = {
    id: newId('camp'),
    ownerId,
    objectId: object.id,
    // Whether the wrapped object pre-existed. Publication side effects apply
    // only to objects this campaign created.
    ownsObject: !objectId,
    circleId,
    title: String(title).trim(),
    description,
    type,
    status: 'draft',
    location,
    startsAt,
    endsAt,
    capacity,
    price,
    currency,
    publicSlug: makeSlug(title),
    createdAt: now,
    updatedAt: now,
    metadata
  };
  store.insert('campaigns', campaign);

  // Graph edges, using the existing relationships table. No second graph.
  relate(object.id, 'promoted_by_campaign', campaign.id);
  if (circleId) relate(campaign.id, 'belongs_to_circle', circleId);

  emitSignal({ type: 'campaign_created', circleId, objectId: object.id, metadata: { campaignId: campaign.id } });
  return hydrate(campaign);
}

export function getCampaign(id) {
  const c = store.find('campaigns', (x) => x.id === id);
  return c ? hydrate(c) : null;
}

export function listCampaigns(ownerId) {
  return store
    .filter('campaigns', (c) => c.ownerId === ownerId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map(hydrate);
}

/** Only a published/live campaign resolves publicly. */
export function getPublicBySlug(slug) {
  const c = store.find('campaigns', (x) => x.publicSlug === slug);
  if (!c) return null;
  if (c.status !== 'published' && c.status !== 'live') return null;
  return c;
}

/**
 * The public projection. Deliberately allow-listed: internal ids, ownerId,
 * transactions, member data and analytics never appear.
 */
export function publicView(campaign) {
  const m = analytics(campaign.id);
  return {
    slug: campaign.publicSlug,
    title: campaign.title,
    description: campaign.description,
    type: campaign.type,
    status: campaign.status,
    location: campaign.location,
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    price: campaign.price,
    currency: campaign.currency,
    // Availability only -- never the registration list or who registered.
    capacity: campaign.capacity,
    remaining: m.remaining,
    soldOut: m.remaining === 0,
    // Share metadata. Only what a link preview legitimately needs, and only
    // when it actually exists -- no placeholder image, no invented creator
    // name. `creator` is a display label, never the internal ownerId.
    image: campaign.metadata?.image ?? null,
    creator: campaign.metadata?.creatorName ?? null
  };
}

const WRITABLE = [
  'title', 'description', 'location', 'startsAt', 'endsAt', 'price', 'currency', 'metadata'
];

/**
 * Capacity is writable only while the campaign is a draft (spec 14): once
 * published, people have made decisions based on it.
 */
export function updateCampaign(id, patch = {}, ownerId = null) {
  const campaign = store.find('campaigns', (c) => c.id === id);
  if (!campaign) return null;

  const clean = {};
  for (const k of WRITABLE) if (k in patch) clean[k] = patch[k];

  // Attach (or swap) the wrapped object on an existing campaign. Same
  // authority rule as create: source membership, never a client claim. The
  // object itself is never mutated -- see the ownsObject note below.
  if ('objectId' in patch) {
    if (patch.objectId === null) throw new Error('a campaign must reference an object');
    const next = store.find('objects', (o) => o.id === patch.objectId);
    if (!next) throw new Error('object not found');
    if (!mayAttachObject(ownerId, next)) throw new Error('not authorised to attach this object');
    clean.objectId = next.id;
    // The campaign no longer owns the object it may have created, so publish
    // must stop cascading onto it. A previously created object is left exactly
    // as it is rather than being deleted or retracted.
    clean.ownsObject = false;
  }

  if ('capacity' in patch) {
    if (campaign.status !== 'draft') {
      throw new Error('capacity cannot be changed after publication');
    }
    if (patch.capacity !== null && !(Number.isInteger(patch.capacity) && patch.capacity > 0)) {
      throw new Error('capacity must be a positive integer when provided');
    }
    clean.capacity = patch.capacity;
  }
  if ('price' in clean && (!Number.isFinite(clean.price) || clean.price < 0)) {
    throw new Error('price must be a non-negative number');
  }

  const updated = store.update('campaigns', id, clean);
  return updated ? hydrate(updated) : null;
}

export function transitionCampaign(id, next) {
  const campaign = store.find('campaigns', (c) => c.id === id);
  if (!campaign) return null;
  const allowed = VALID_TRANSITIONS[campaign.status] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`invalid transition: ${campaign.status} -> ${next}`);
  }
  store.update('campaigns', id, { status: next });

  // Publishing the campaign publishes the wrapped object; closing it retracts.
  //
  // ONLY for an object this campaign created. An ATTACHED object belongs to
  // the wider system -- it may be someone else's ingested content that the
  // creator merely has read access to -- so a campaign must never change its
  // publication. Promoting a thing is not the same as owning it.
  if (campaign.ownsObject !== false) {
    if (next === 'published') {
      store.update('objects', campaign.objectId, { publication: 'public' });
    } else if (next === 'cancelled' || next === 'closed') {
      store.update('objects', campaign.objectId, { publication: 'private' });
    }
  }

  emitSignal({
    type: `campaign_${next}`,
    circleId: campaign.circleId,
    objectId: campaign.objectId,
    metadata: { campaignId: campaign.id }
  });
  return hydrate(store.find('campaigns', (c) => c.id === id));
}

/** A view is a recorded event, not an increment. */
/**
 * The canonical distribution payload for a campaign.
 *
 * ONE link. The slug is canonical and the URL is composed from configured
 * server origin -- never from a request header, which a caller controls and
 * could use to mint a link pointing anywhere.
 *
 * Channels are share-INTENT URLs: ordinary web links that pre-fill a compose
 * box. Brief holds no social credentials and posts nothing. Instagram and
 * TikTok publish no such URL, so they are reported as copy-link rather than
 * given a button that silently fails.
 */
export function shareView(campaign, publicOrigin) {
  const slug = campaign.publicSlug;

  if (!publicOrigin) {
    return {
      available: false,
      reason: 'public_origin_not_configured',
      slug,
      channels: {},
      copyOnly: ['instagram', 'tiktok']
    };
  }

  const url = `${String(publicOrigin).replace(/\/+$/, '')}/c/${slug}`;
  const text = encodeURIComponent(campaign.title);
  const enc = encodeURIComponent(url);

  return {
    available: true,
    url,
    slug,
    channels: {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(campaign.title + ' ' + url)}`,
      telegram: `https://t.me/share/url?url=${enc}&text=${text}`,
      x: `https://twitter.com/intent/tweet?url=${enc}&text=${text}`
    },
    // Honest: these platforms have no share-intent URL. The link is the product.
    copyOnly: ['instagram', 'tiktok']
  };
}

/**
 * The creator pressed Share. This records an INTENT TO DISTRIBUTE and nothing
 * more: it cannot know whether anyone saw the link. It must never feed a
 * conversion metric, and it moves no money.
 */
export function recordShare(campaign, channel = 'link') {
  emitSignal({
    type: 'campaign_shared',
    circleId: campaign.circleId,
    objectId: campaign.objectId,
    metadata: { campaignId: campaign.id, channel: String(channel).slice(0, 32) }
  });
}

export function recordView(campaign, viewerRef = null) {
  emitSignal({
    type: 'campaign_viewed',
    circleId: campaign.circleId,
    objectId: campaign.objectId,
    // viewerRef is a coarse, server-derived fingerprint. It is NOT an identity
    // and is never exposed publicly -- it exists only so `viewers` can be
    // reported alongside raw page loads.
    metadata: { campaignId: campaign.id, ...(viewerRef ? { viewerRef } : {}) }
  });
}

// ---------------------------------------------------------------------------
// REGISTRATION
// ---------------------------------------------------------------------------

/**
 * Register for a public campaign.
 *
 * CAPACITY IS ENFORCED HERE, against a live count of occupying registrations.
 * The client cannot influence it: there is no count in the request and no
 * counter in storage.
 */
export function register(campaign, { attendeeRef, name = null, contact = null } = {}) {
  if (campaign.status !== 'published' && campaign.status !== 'live') {
    throw new Error('campaign is not open for registration');
  }
  if (!attendeeRef) throw new Error('attendeeRef is required');

  const existing = store.find(
    'registrations',
    (r) => r.campaignId === campaign.id && r.attendeeRef === attendeeRef &&
           r.status !== 'cancelled'
  );
  if (existing) return existing; // idempotent: one slot per attendee

  if (campaign.capacity !== null) {
    const taken = store.filter(
      'registrations',
      (r) => r.campaignId === campaign.id && OCCUPIES_SLOT.has(r.status)
    ).length;
    if (taken >= campaign.capacity) throw new Error('campaign is full');
  }

  const now = new Date().toISOString();
  // Paid campaigns start as 'started' and only become 'registered' when money
  // settles. Free campaigns register immediately.
  const row = store.insert('registrations', {
    id: newId('reg'),
    campaignId: campaign.id,
    attendeeRef,
    name,
    contact,
    status: campaign.price > 0 ? 'started' : 'registered',
    // The gate's scannable code. Opaque and unguessable; issued once, never
    // rotated, and independent of the internal id so the gate never needs to
    // know about row internals.
    ticketCode: newTicketCode(),
    checkedInAt: null,
    checkedInBy: null,
    createdAt: now,
    updatedAt: now
  });

  emitSignal({
    type: campaign.price > 0 ? 'campaign_registration_started' : 'campaign_registered',
    circleId: campaign.circleId,
    objectId: campaign.objectId,
    metadata: { campaignId: campaign.id, registrationId: row.id }
  });
  return row;
}

/**
 * Settlement -> registration promotion.
 *
 * A paid registration opens as 'started' (a held spot, no money yet). This is
 * the ONLY thing that turns a held spot into a real one, and it runs strictly
 * off an authoritative settled transaction row -- never off a client claim,
 * never off a view, a click or a share.
 *
 * Idempotent: replaying a settlement, or settling a second transaction for the
 * same registration, will not double-count. Nothing here writes a counter;
 * `analytics()` continues to derive every number by scanning rows.
 *
 * Returns the promoted registration, or null when there was nothing to do.
 */
export function promoteRegistrationForSettledTransaction(tx) {
  if (!tx || tx.status !== 'settled' || !tx.registrationId) return null;

  const reg = store.find('registrations', (r) => r.id === tx.registrationId);
  if (!reg) return null;
  // Guard the link again at promotion time: a transaction must not be able to
  // reach across into another campaign's registration.
  if (!tx.campaignId || reg.campaignId !== tx.campaignId) return null;
  // Only a held spot is promoted. A cancelled registration is NOT silently
  // revived by a late payment, and an already-registered one is left alone so
  // this stays idempotent.
  if (reg.status !== 'started') return null;

  store.update('registrations', reg.id, {
    status: 'registered',
    updatedAt: new Date().toISOString()
  });

  const campaign = store.find('campaigns', (c) => c.id === reg.campaignId);
  // Reuses the EXISTING signal. No campaign-specific analytics store, no new
  // event bus -- the signal is the record, and analytics derives from rows.
  emitSignal({
    type: 'campaign_registered',
    circleId: campaign?.circleId ?? null,
    objectId: campaign?.objectId ?? null,
    metadata: {
      campaignId: reg.campaignId,
      registrationId: reg.id,
      transactionId: tx.id,
      settled: true
    }
  });

  return store.find('registrations', (r) => r.id === reg.id);
}

/**
 * Refund -> registration demotion.
 *
 * A refunded payment previously left the attendee `registered`: still holding
 * a slot, having paid nothing. Derived revenue correctly dropped to zero, so
 * the money was right while the roster was wrong.
 *
 * The spot is released by moving the registration to `cancelled` -- an
 * EXISTING state, so no new concept enters the model. Runs strictly off an
 * authoritative refunded transaction row, and is idempotent.
 */
export function demoteRegistrationForRefundedTransaction(tx) {
  if (!tx || tx.status !== 'refunded' || !tx.registrationId) return null;

  const reg = store.find('registrations', (r) => r.id === tx.registrationId);
  if (!reg) return null;
  if (!tx.campaignId || reg.campaignId !== tx.campaignId) return null;
  // Already released, or the attendance already happened -- leave it alone.
  if (reg.status === 'cancelled' || reg.status === 'no_show') return null;
  if (reg.status === 'checked_in') return null;

  store.update('registrations', reg.id, {
    status: 'cancelled',
    updatedAt: new Date().toISOString()
  });

  const campaign = store.find('campaigns', (c) => c.id === reg.campaignId);
  emitSignal({
    type: 'campaign_registration_updated',
    circleId: campaign?.circleId ?? null,
    objectId: campaign?.objectId ?? null,
    metadata: {
      campaignId: reg.campaignId,
      registrationId: reg.id,
      transactionId: tx.id,
      refunded: true
    }
  });

  return store.find('registrations', (r) => r.id === reg.id);
}

/**
 * Legal registration transitions.
 *
 * Before Phase 9 the status VALUE was validated but the TRANSITION was not, so
 * any status could jump to any other. That single omission produced three real
 * defects, all fixed here by refusing the illegal edges:
 *
 *   - a cancelled registration could be revived (the locked product rule says
 *     cancellation is terminal);
 *   - reviving a cancelled row re-occupied a slot someone else had already
 *     taken, overbooking the campaign past its capacity;
 *   - forcing a paid, checked-in row back to `started` made it eligible for
 *     payment confirmation a SECOND time, doubling derived revenue for one
 *     attendee.
 *
 * Nothing may transition INTO `started`: that state is only ever produced by
 * `register()` at the moment a held spot is created. That is what closes the
 * double-charge path for good.
 *
 * `checked_in` and `no_show` may correct each other -- an organiser mis-taps,
 * or somebody turns up late. Neither carries an economic consequence, so the
 * correction is safe. Both are otherwise terminal, as is `cancelled`.
 */
const REGISTRATION_TRANSITIONS = {
  // A held spot may be checked in directly: somebody reserved online and paid
  // cash at the door. Blocking that would break a real organiser workflow (and
  // an existing test correctly asserted it). It is safe because the defect was
  // never the forward edge -- it was the BACKWARD one into `started`.
  started: ['registered', 'confirmed', 'checked_in', 'cancelled', 'no_show'],
  registered: ['confirmed', 'checked_in', 'cancelled', 'no_show'],
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['no_show'],
  no_show: ['checked_in'],
  cancelled: []
};

export function setRegistrationStatus(registrationId, status) {
  if (!REGISTRATION_STATES.includes(status)) {
    throw new Error(`status must be one of ${REGISTRATION_STATES.join(', ')}`);
  }
  const row = store.find('registrations', (r) => r.id === registrationId);
  if (!row) return null;

  // Idempotent: re-sending the status a row already has is a no-op and emits
  // no signal, so a retried request cannot spam the signal log.
  if (row.status === status) return row;

  const allowed = REGISTRATION_TRANSITIONS[row.status] ?? [];
  if (!allowed.includes(status)) {
    throw new Error(`invalid registration transition: ${row.status} -> ${status}`);
  }

  store.update('registrations', registrationId, { status });
  const campaign = store.find('c' + 'ampaigns', (c) => c.id === row.campaignId);
  emitSignal({
    type: status === 'checked_in' ? 'campaign_checkin'
        : status === 'no_show' ? 'campaign_no_show'
        : 'campaign_registration_updated',
    circleId: campaign?.circleId ?? null,
    objectId: campaign?.objectId ?? null,
    metadata: { campaignId: row.campaignId, registrationId }
  });
  return store.find('registrations', (r) => r.id === registrationId);
}

export function listRegistrations(campaignId) {
  return store.filter('registrations', (r) => r.campaignId === campaignId);
}
