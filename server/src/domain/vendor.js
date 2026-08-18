// ---------------------------------------------------------------------------
// VENDOR
//
// A Vendor is a seller identity. Until now "vendor" existed only as a NAME
// extracted from ingested text (pipeline/extract.js promotes a named vendor to
// an `identity` object). That is provenance, not an actor: an extracted name
// cannot own a listing, receive an order, or fulfil anything.
//
// This module makes the vendor a first-class actor while keeping the extracted
// object as its provenance. A vendor MAY point at the identity object it came
// from (`objectId`), so the chain stays:
//
//     Object -> Vendor -> Listing -> Order -> Fulfilment -> Transaction
//
// TRUST IS EVIDENCE, NOT A SCORE. There is deliberately no rating, no star
// count, no "87% positive", no review aggregate anywhere in this file. A
// vendor carries verifications that actually happened plus counts of things
// that actually occurred. Both are contestable by the vendor; a rating is not.
//
// OWNERSHIP IS NEVER CLIENT-SUPPLIED. Every function here takes ownerId from
// the caller-resolved identity in the route. A body-supplied ownerId is a
// forgeable claim, and the routes do not read one.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { VERIFICATION_KINDS } from './member.js';

export const VENDOR_STATUS = ['active', 'paused', 'closed'];

// A vendor's verification evidence is the SAME evidence machinery members
// already use. Inventing a second verification vocabulary for sellers would
// give Brief two answers to "is this person verified?".
const VERIFICATION_LABELS = {
  phone_verified: 'Phone verified',
  identity_verified: 'Identity verified',
  business_verified: 'Business document verified',
  moderator_verified: 'Verified by a moderator'
};

/**
 * Create a vendor for an owner. One vendor per owner: a second call returns
 * the existing row rather than creating a duplicate seller identity.
 */
export function createVendor({
  ownerId,
  displayName,
  description = '',
  contactMethod = null,
  objectId = null
}) {
  if (!ownerId) throw new Error('ownerId is required');
  if (!displayName || !String(displayName).trim()) {
    throw new Error('displayName is required');
  }

  const existing = store.find('vendors', (v) => v.ownerId === ownerId);
  if (existing) return hydrate(existing);

  // A vendor may be backed by an already-extracted identity object, which is
  // how an ingested trader becomes a real seller without losing provenance.
  if (objectId && !store.find('objects', (o) => o.id === objectId)) {
    throw new Error('object not found');
  }

  const now = new Date().toISOString();
  const vendor = {
    id: newId('vend'),
    ownerId,
    displayName: String(displayName).trim(),
    description: String(description ?? ''),
    contactMethod: contactMethod ?? null,
    objectId: objectId ?? null,
    status: 'active',
    createdAt: now,
    updatedAt: now
  };
  store.insert('vendors', vendor);
  return hydrate(vendor);
}

/**
 * Verification evidence and plain factual counts.
 *
 * Verifications are read from the owner's MEMBER rows -- the checks that were
 * actually recorded against that person somewhere in Brief. A vendor does not
 * get to assert its own verification.
 */
function hydrate(vendor) {
  const memberRows = store.filter('members', (m) => m.userId === vendor.ownerId);
  const kinds = new Set();
  for (const m of memberRows) {
    for (const v of m.verifications ?? []) {
      if (VERIFICATION_KINDS.includes(v)) kinds.add(v);
    }
  }
  const evidence = Array.from(kinds).map((kind) => ({
    kind,
    label: VERIFICATION_LABELS[kind]
  }));

  // Counted from real rows. If nothing has happened these are absent, not zero
  // -- "0 sales" invites a reader to treat absence as a bad score.
  const listings = store.filter('listings', (l) => l.vendorId === vendor.id);
  const activeListings = listings.filter((l) => l.status === 'active').length;
  const orders = store.filter('orders', (o) => o.vendorId === vendor.id);
  const fulfilled = orders.filter((o) => o.status === 'fulfilled' || o.status === 'settled').length;
  const settled = orders.filter((o) => o.status === 'settled').length;

  const facts = [];
  if (activeListings > 0) {
    facts.push({
      kind: 'active_listings',
      label: `${activeListings} active listing${activeListings === 1 ? '' : 's'}`
    });
  }
  if (fulfilled > 0) {
    facts.push({
      kind: 'fulfilled_orders',
      label: `${fulfilled} fulfilled order${fulfilled === 1 ? '' : 's'}`
    });
  }
  if (settled > 0) {
    facts.push({
      kind: 'settled_orders',
      label: `${settled} settled order${settled === 1 ? '' : 's'}`
    });
  }
  facts.push({
    kind: 'vendor_since',
    label: `Selling since ${new Date(vendor.createdAt).toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric'
    })}`
  });

  return {
    ...vendor,
    // Explicitly no score. Consumers render the evidence list and the facts.
    verification: { evidence, verifiedCount: evidence.length, facts },
    activeListingCount: activeListings
  };
}

export function getVendor(id) {
  const v = store.find('vendors', (x) => x.id === id);
  return v ? hydrate(v) : null;
}

/** The vendor owned by this user, or null. Used to answer "am I a seller?". */
export function getVendorByOwner(ownerId) {
  const v = store.find('vendors', (x) => x.ownerId === ownerId);
  return v ? hydrate(v) : null;
}

export function listVendors({ status = null } = {}) {
  let rows = store.all('vendors');
  if (status) rows = rows.filter((v) => v.status === status);
  return rows.map(hydrate);
}

/**
 * Update the vendor's own descriptive fields.
 *
 * `ownerId`, `id` and `createdAt` are deliberately absent from the allow-list:
 * a vendor cannot be reassigned to another owner through a PATCH, which would
 * otherwise be a way to steal a verified seller identity.
 */
export function updateVendor(id, patch) {
  const allowed = ['displayName', 'description', 'contactMethod', 'status'];
  const clean = {};
  for (const k of allowed) if (k in patch) clean[k] = patch[k];

  if ('status' in clean && !VENDOR_STATUS.includes(clean.status)) {
    throw new Error(`status must be one of ${VENDOR_STATUS.join(', ')}`);
  }
  if ('displayName' in clean && !String(clean.displayName ?? '').trim()) {
    throw new Error('displayName cannot be empty');
  }
  clean.updatedAt = new Date().toISOString();

  const updated = store.update('vendors', id, clean);
  return updated ? hydrate(updated) : null;
}

/** True when this user owns this vendor. The only ownership question routes ask. */
export function ownsVendor(vendorId, userId) {
  const v = store.find('vendors', (x) => x.id === vendorId);
  return Boolean(v && v.ownerId === userId);
}
