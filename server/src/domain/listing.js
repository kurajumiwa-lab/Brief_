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
  media = []
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
    media: Array.isArray(media) ? media : [],
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

/** Descriptive edits. Status is NOT here -- it moves only via transitionListing. */
export function updateListing(id, patch) {
  const listing = store.find('listings', (l) => l.id === id);
  if (!listing) return null;

  const allowed = [
    'title', 'description', 'type', 'price', 'currency',
    'quantityAvailable', 'locationName', 'media'
  ];
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
  if ('quantityAvailable' in clean && clean.quantityAvailable !== null) {
    if (!Number.isInteger(clean.quantityAvailable) || clean.quantityAvailable < 0) {
      throw new Error('quantityAvailable must be a whole number of zero or more when provided');
    }
  }
  clean.updatedAt = new Date().toISOString();

  const updated = store.update('listings', id, clean);
  return updated ? hydrate(updated) : null;
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
