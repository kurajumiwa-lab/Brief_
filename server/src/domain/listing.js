// ---------------------------------------------------------------------------
// LISTING
//
// A Listing is something a vendor is offering. It is NOT a campaign.
//
//     Campaign = an organised activity with registration
//     Listing  = something a seller is offering
//     Order    = a customer's commitment to that listing
//
// These stay three models on purpose. Collapsing them would mean either every
// event becomes a purchase or every purchase needs an event, and both are
// wrong. Campaign registration remains the ticketing path; commerce is for
// standalone products, services and experiences.
//
// PRICE LIVES HERE, AND ONLY HERE. An order derives its money from the listing
// row at order time. No caller -- client or otherwise -- supplies a price to
// an order. See order.js.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';

// Reuses the existing Brief object vocabulary rather than inventing a parallel
// set of commerce categories. A listing classifies as one of the things Brief
// already knows how to talk about.
export const LISTING_TYPES = ['product', 'service', 'experience', 'event'];

export const LISTING_STATUS = ['draft', 'active', 'paused', 'sold_out', 'archived'];

// ---------------------------------------------------------------------------
// THE TWO AXES A SUPPLY BOARD NEEDS (see the taxonomy module on the client).
//
//   flow       WHERE IT IS GOING  → niche (a consumer), bulk (shops/resellers),
//                                   direct (bypassing the middle), group (a pool)
//   originKind WHERE IT COMES FROM → warehouse/market, source, producer,
//                                   manufacturer, importer
//
// They are OPTIONAL on a listing, and that is the honest part: a mobile
// welder in Riruta has no origin and no destination, and forcing one would
// make half the board invent addresses. What is NOT optional is the rule below
// — a listing may not call itself bulk without saying where it leaves from and
// where it goes. Bulk is a flow, and a flow without endpoints is a slogan.
// ---------------------------------------------------------------------------
export const LISTING_FLOWS = ['bulk', 'direct', 'niche', 'group'];
export const LISTING_ORIGIN_KINDS = ['warehouse', 'source', 'producer', 'manufacturer', 'importer'];
export const LISTING_DESTINATION_KINDS = ['consumers', 'vendors', 'pool'];

/**
 * The one rule that keeps the taxonomy honest. Returns an error string, or null.
 * Called on create AND on update, against the merged row, so a listing cannot
 * be reclassified into a flow it has no endpoints for.
 */
export function flowProblem(row) {
  const flow = row?.flow ?? null;
  if (!flow) return null;
  if (!LISTING_FLOWS.includes(flow)) return `flow must be one of ${LISTING_FLOWS.join(', ')}`;
  const origin = String(row.originName ?? '').trim();
  const destination = String(row.destinationName ?? '').trim();
  if (flow === 'bulk' && (!origin || !destination)) {
    return 'a bulk listing has to name where it leaves from and where it goes — bulk is a flow, not a label';
  }
  if (flow === 'direct' && !origin) {
    return 'a direct listing has to name its source (the farm, the fishery, the mill, the factory)';
  }
  if (flow === 'group' && !destination) {
    return 'a group listing has to name the pool it is filling (the estate, the trade group, the circle)';
  }
  return null;
}

// Explicit and server-authoritative. A client cannot write a status directly;
// it names a transition and the server decides whether that is legal.
//
// `archived` is terminal: a listing that has been withdrawn does not come back
// to life, because its orders' history refers to what it was. Re-listing means
// creating a new listing, which keeps the audit trail honest.
const VALID_TRANSITIONS = {
  draft: ['active', 'archived'],
  active: ['paused', 'sold_out', 'archived'],
  paused: ['active', 'archived'],
  sold_out: ['active', 'archived'],
  archived: []
};

// Only an active listing can take an order. Everything else is a refusal with
// a reason the buyer can understand.
const ORDERABLE = new Set(['active']);

const UNORDERABLE_REASON = {
  draft: 'this listing is not published yet',
  paused: 'this listing is paused and is not taking orders',
  sold_out: 'this listing is sold out',
  archived: 'this listing has been archived and is not taking orders'
};

/**
 * Photos, normalised. `Array.isArray(media) ? media : []` was the whole rule,
 * which meant a client posting a single string stored that string under a field
 * every reader treats as an array — and one bogus entry in a published offer's
 * media renders as a broken plate on every card and on the public page.
 *
 * So: an array or nothing, non-empty strings only, deduplicated, and a sane
 * cap. An offer with eight pictures has said what it has to say.
 */
export const MEDIA_CAP = 8;
export function cleanMedia(media) {
  if (!Array.isArray(media)) return [];
  const out = [];
  for (const m of media) {
    // A number, an object, a nested array: not a photo, and coercing it would
    // store "42" as a path that 404s in front of a buyer. Drop it.
    if (typeof m !== 'string') continue;
    const s = m.trim();
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= MEDIA_CAP) break;
  }
  return out;
}

export function createListing({
  vendorId,
  title,
  description = '',
  type = 'product',
  price,
  currency = 'KES',
  quantityAvailable = null,
  locationName = null,
  objectId = null,
  media = [],
  flow = null,
  originKind = null,
  originName = null,
  destinationKind = null,
  destinationName = null,
  unitLabel = null,
  minOrderQuantity = null,
  commodity = null
}) {
  const vendor = store.find('vendors', (v) => v.id === vendorId);
  if (!vendor) throw new Error('vendor not found');
  if (!title || !String(title).trim()) throw new Error('title is required');
  if (!LISTING_TYPES.includes(type)) {
    throw new Error(`type must be one of ${LISTING_TYPES.join(', ')}`);
  }

  // A price must be real money. A zero or negative price would flow straight
  // into order totals and, later, into settled revenue -- the same class of
  // bug the ledger already guards against by refusing amounts <= 0.
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('price must be a number greater than zero');
  }

  // Stock is optional: a service provider does not have "12 in stock". When it
  // IS given it must be a non-negative whole number.
  if (quantityAvailable !== null) {
    if (!Number.isInteger(quantityAvailable) || quantityAvailable < 0) {
      throw new Error('quantityAvailable must be a whole number of zero or more when provided');
    }
  }

  if (objectId && !store.find('objects', (o) => o.id === objectId)) {
    throw new Error('object not found');
  }

  const min = minOrderQuantity == null || minOrderQuantity === '' ? null : Number(minOrderQuantity);
  if (min !== null && (!Number.isInteger(min) || min < 1)) {
    throw new Error('minOrderQuantity must be a whole number of one or more, or left blank');
  }
  const draft = {
    flow: flow || null,
    originKind: originKind || null,
    originName: originName || null,
    destinationKind: destinationKind || null,
    destinationName: destinationName || null
  };
  const problem = flowProblem(draft);
  if (problem) throw new Error(problem);

  const now = new Date().toISOString();
  const listing = {
    id: newId('list'),
    vendorId,
    title: String(title).trim(),
    description: String(description ?? ''),
    type,
    price,
    currency,
    // null means "not stock-tracked" (a cleaner can take many jobs), which is
    // different from 0 meaning "none left".
    quantityAvailable,
    // Location is OPTIONAL by design. A product may have a pickup point, an
    // experience a venue, and a mobile service none at all. Forcing every
    // listing into one geographic model would make half of them lie.
    locationName: locationName ?? null,
    objectId: objectId ?? null,
    media: cleanMedia(media),
    // The two axes. Optional, and null renders as "not stated" — never as a
    // guessed warehouse or an invented destination.
    flow: flow || null,
    originKind: LISTING_ORIGIN_KINDS.includes(originKind) ? originKind : null,
    originName: originName ? String(originName).trim().slice(0, 120) : null,
    destinationKind: LISTING_DESTINATION_KINDS.includes(destinationKind) ? destinationKind : null,
    destinationName: destinationName ? String(destinationName).trim().slice(0, 120) : null,
    unitLabel: unitLabel ? String(unitLabel).trim().slice(0, 24) : null,
    // What the goods ARE, in the seller's own word ("tomatoes", "secondhand
    // shoes"). Demand is matched on this field rather than on a title, because
    // guessing a commodity out of "Tomatoes, 20 crates — call before noon" is
    // how a board ends up routing on a substring.
    commodity: commodity ? String(commodity).trim().slice(0, 60) : null,
    minOrderQuantity: min,
    // A listing starts as a draft. It is not offered to anyone until the
    // vendor activates it.
    status: 'draft',
    createdAt: now,
    updatedAt: now
  };
  store.insert('listings', listing);
  return hydrate(listing);
}

/** Attach the seller and the derived orderability, so clients need one call. */
function hydrate(listing) {
  const vendor = store.find('vendors', (v) => v.id === listing.vendorId) ?? null;
  const check = orderableReason(listing);
  return {
    ...listing,
    vendor: vendor
      ? {
          id: vendor.id,
          displayName: vendor.displayName,
          status: vendor.status,
          contactMethod: vendor.contactMethod ?? null
        }
      : null,
    orderable: check.ok,
    unorderableReason: check.ok ? null : check.reason
  };
}

/**
 * Whether this listing can accept an order right now, and why not if it
 * cannot. Used by both the read path (to render honestly) and the write path
 * (to refuse). One function so the two can never disagree.
 */
export function orderableReason(listing) {
  const vendor = store.find('vendors', (v) => v.id === listing.vendorId);
  if (!vendor) return { ok: false, reason: 'this seller no longer exists' };
  if (vendor.status !== 'active') {
    return { ok: false, reason: 'this seller is not currently trading' };
  }
  if (!ORDERABLE.has(listing.status)) {
    return { ok: false, reason: UNORDERABLE_REASON[listing.status] ?? 'this listing is not available' };
  }
  if (listing.quantityAvailable !== null && listing.quantityAvailable <= 0) {
    return { ok: false, reason: 'this listing is sold out' };
  }
  return { ok: true, reason: null };
}

export function getListing(id) {
  const l = store.find('listings', (x) => x.id === id);
  return l ? hydrate(l) : null;
}

/**
 * Browse. Defaults to ACTIVE listings only: a draft or archived listing is not
 * public. A vendor viewing their own shelf passes vendorId and gets everything.
 */
export function listListings({ vendorId = null, type = null, status = 'active', limit = 100 } = {}) {
  let rows = store.all('listings');
  if (vendorId) rows = rows.filter((l) => l.vendorId === vendorId);
  if (type) rows = rows.filter((l) => l.type === type);
  if (status) rows = rows.filter((l) => l.status === status);
  return rows
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
    .map(hydrate);
}

/**
 * The edit policy for an offer, stated as data so the UI, the route and the
 * tests all read the same rule.
 *
 *   • DESCRIPTIVE fields describe the thing — what it is, where it stands, how
 *     many, what photo shows it. They are the fields a business expects to
 *     change daily, so they stay editable forever, with no friction: an offer
 *     whose photo cannot be swapped is an offer that stops being updated.
 *   • MONEY fields decide what a buyer pays. They are ALSO changeable after
 *     publishing, because a catalogue whose price can never move becomes fiction
 *     the week maize moves. What changes is the accountability: once the offer
 *     has been public, a money edit needs a reason and is appended, immutably,
 *     to the offer's revision history.
 *
 * A hard lock was the obvious design and the wrong one: `order.js` snapshots
 * `unitPrice` when an order is placed, so a price change can never retro-bill
 * anybody, and locking prices would only push sellers to delete-and-repost —
 * which destroys the history a buyer would rather have seen.
 * `status` is in neither list: a lifecycle move goes through transitionListing,
 * so the transition table cannot be bypassed by PATCHing a field.
 */
export const DESCRIPTIVE_FIELDS = [
  'title', 'description', 'type', 'media', 'locationName', 'quantityAvailable',
  'flow', 'originKind', 'originName', 'destinationKind', 'destinationName', 'commodity'
];
export const MONEY_FIELDS = ['price', 'currency', 'unitLabel', 'minOrderQuantity'];
/** Short enough to be a sentence, long enough that "fix" is not an answer. */
export const REASON_MIN = 6;

const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function updateListing(id, patch, { actorId = null, reason = null } = {}) {
  const listing = store.find('listings', (l) => l.id === id);
  if (!listing) return null;

  const allowed = [...DESCRIPTIVE_FIELDS, ...MONEY_FIELDS];
  const clean = {};
  for (const k of allowed) if (k in patch) clean[k] = patch[k];

  if ('title' in clean && !String(clean.title ?? '').trim()) {
    throw new Error('title cannot be empty');
  }
  if ('type' in clean && !LISTING_TYPES.includes(clean.type)) {
    throw new Error(`type must be one of ${LISTING_TYPES.join(', ')}`);
  }
  if ('price' in clean && (!Number.isFinite(clean.price) || clean.price <= 0)) {
    throw new Error('price must be a number greater than zero');
  }
  if ('minOrderQuantity' in clean) {
    const v = clean.minOrderQuantity == null || clean.minOrderQuantity === '' ? null : Number(clean.minOrderQuantity);
    if (v !== null && (!Number.isInteger(v) || v < 1)) {
      throw new Error('minOrderQuantity must be a whole number of one or more, or left blank');
    }
    clean.minOrderQuantity = v;
  }
  // The flow rule is checked against the row AS IT WOULD BECOME, so a seller
  // cannot strip the origin off a bulk listing and keep the badge.
  if (['flow', 'originName', 'destinationName'].some((k) => k in clean)) {
    const problem = flowProblem({ ...listing, ...clean });
    if (problem) throw new Error(problem);
  }
  if ('quantityAvailable' in clean && clean.quantityAvailable !== null) {
    if (!Number.isInteger(clean.quantityAvailable) || clean.quantityAvailable < 0) {
      throw new Error('quantityAvailable must be a whole number of zero or more when provided');
    }
  }
  // Photos are the field the catalog editor now really sends (add, reorder,
  // remove after publishing), so it gets the same normalisation the create path
  // gives it. An empty array is a legitimate value here: it means "take the
  // photos down", and it must not be confused with "this field was not sent".
  if ('media' in clean) clean.media = cleanMedia(clean.media);

  // Only a REAL change is a money change: re-saving the same price from a form
  // that posts every field is not an event, and demanding a reason for it would
  // train people to type noise just to clear a gate.
  const wasPublished = listing.status !== 'draft';
  const touchedMoney = MONEY_FIELDS.filter((k) => k in clean && !sameValue(clean[k], listing[k]));
  // The reason may arrive as a call option (what the route passes) or inside the
  // patch itself (what a JSON client naturally sends). Accepting only one of the
  // two means a caller who included a perfectly good reason is refused for not
  // including it — and it is never `reason` itself that gets written to the row,
  // because it is not in `allowed`.
  const why = String(reason ?? patch?.reason ?? '').trim();
  if (wasPublished && touchedMoney.length && why.length < REASON_MIN) {
    throw new Error(
      `say why the ${touchedMoney.length === 1 ? 'price is changing' : 'terms are changing'} — it goes on the offer's record, not in a message`
    );
  }

  // The pre-image is taken NOW. `store.update` hands back the live row, so a
  // snapshot read after the write would show the new value as the old one —
  // which is how a history ends up describing its own present tense.
  const before = { ...listing };
  clean.updatedAt = new Date().toISOString();

  const updated = store.update('listings', id, clean);
  if (updated && wasPublished && touchedMoney.length) {
    const at = new Date().toISOString();
    for (const field of touchedMoney) {
      store.insert('listingRevisions', {
        id: newId('lrev'),
        listingId: id,
        vendorId: listing.vendorId,
        field,
        before: before[field] ?? null,
        after: updated[field] ?? null,
        reason: why.slice(0, 400),
        actorId: actorId ?? null,
        at
      });
    }
  }
  return updated ? hydrate(updated) : null;
}

/**
 * The money history of one offer, oldest first — the record a buyer is owed and
 * the reason a seller cannot quietly reprice. Nothing here aggregates or scores:
 * it is the list, with each row's own reason.
 */
export function revisionsFor(id, { limit = 50 } = {}) {
  const rows = store.filter('listingRevisions', (r) => r.listingId === id);
  return rows
    .slice()
    .sort((a, b) => (a.at < b.at ? -1 : 1))
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      field: r.field,
      before: r.before,
      after: r.after,
      reason: r.reason,
      at: r.at,
      actorId: r.actorId
    }));
}

/**
 * Move a listing through its lifecycle.
 *
 * Returns { listing, changed }. Asking for the state it is already in is a
 * harmless no-op with changed:false -- a double-tapped "Pause" button must not
 * be an error, and must not emit a second signal.
 */
export function transitionListing(id, next) {
  const listing = store.find('listings', (l) => l.id === id);
  if (!listing) throw new Error('listing not found');
  if (!LISTING_STATUS.includes(next)) {
    throw new Error(`status must be one of ${LISTING_STATUS.join(', ')}`);
  }
  if (listing.status === next) return { listing: hydrate(listing), changed: false };

  const allowed = VALID_TRANSITIONS[listing.status] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`invalid listing transition: ${listing.status} -> ${next}`);
  }
  const updated = store.update('listings', id, {
    status: next,
    updatedAt: new Date().toISOString()
  });
  return { listing: hydrate(updated), changed: true };
}

/**
 * Reduce stock after an order is placed. Only applies to stock-tracked
 * listings; a service is untouched.
 *
 * Auto-flips to sold_out at zero so the shelf tells the truth without the
 * vendor having to notice. That is a derived consequence of a real order, not
 * an invented state change.
 */
export function consumeStock(id, quantity) {
  const listing = store.find('listings', (l) => l.id === id);
  if (!listing) throw new Error('listing not found');
  if (listing.quantityAvailable === null) return hydrate(listing);

  const remaining = listing.quantityAvailable - quantity;
  if (remaining < 0) throw new Error('not enough available to fill this order');

  const patch = { quantityAvailable: remaining, updatedAt: new Date().toISOString() };
  if (remaining === 0 && listing.status === 'active') patch.status = 'sold_out';
  return hydrate(store.update('listings', id, patch));
}
