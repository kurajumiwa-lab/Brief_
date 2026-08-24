// ---------------------------------------------------------------------------
// VENDOR CAPABILITIES + SYNDICATION (Yard Engine)
//
// Vendor/listing/order already exist. This shelf adds operational capabilities
// (supplier, transport, printing, POD, design), escrow compatibility and an
// auditable verification marker. It does not invent a rolling star rating:
// performance is derived from real fulfilment rows and recommendations remain
// explicit records.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import * as vendors from './vendor.js';

export const CAPABILITY_TYPES = ['supplier', 'transport', 'printing', 'pod', 'design'];

function ownerVendor(actorId, vendorId) {
  const vendor = store.find('vendors', (row) => row.id === vendorId && row.ownerId === actorId);
  if (!vendor) throw new Error('vendor not found');
  return vendor;
}

function capabilityView(row) {
  if (!row) return null;
  return { ...row, performance: performanceSummary(row.vendorId) };
}

export function upsertCapabilities(actorId, vendorId, input = {}) {
  ownerVendor(actorId, vendorId);
  if (!Array.isArray(input.services) || input.services.some((service) => !CAPABILITY_TYPES.includes(service))) {
    throw new Error(`services must be from ${CAPABILITY_TYPES.join(', ')}`);
  }
  const regions = Array.isArray(input.regions) ? [...new Set(input.regions.map((region) => String(region).trim()).filter(Boolean))] : [];
  const existing = store.find('vendorCapabilities', (row) => row.vendorId === vendorId);
  const patch = {
    services: [...new Set(input.services)],
    regions,
    escrowSupported: input.escrowSupported === true,
    // A vendor cannot self-verify its own license.
    isVerifiedLicense: existing?.isVerifiedLicense === true,
    updatedAt: new Date().toISOString()
  };
  if (existing) return capabilityView(store.update('vendorCapabilities', existing.id, patch));
  return capabilityView(store.insert('vendorCapabilities', {
    id: newId('vcap'),
    vendorId,
    ...patch,
    isVerifiedLicense: false,
    verifiedBy: null,
    verifiedAt: null,
    createdAt: new Date().toISOString()
  }));
}

export function getCapabilities(vendorId) {
  const row = store.find('vendorCapabilities', (capability) => capability.vendorId === vendorId);
  return capabilityView(row);
}

export function listCapabilities({ service = null, region = null } = {}) {
  return store.all('vendorCapabilities')
    .filter((row) => !service || row.services.includes(service))
    .filter((row) => !region || row.regions.includes(region))
    .map(capabilityView);
}

/** Operator-only in production; kept domain-level so a role gate can be added. */
export function verifyLicense({ vendorId, verifiedBy, verified = true, reference = null } = {}) {
  if (!verifiedBy) throw new Error('verifiedBy is required');
  const capability = store.find('vendorCapabilities', (row) => row.vendorId === vendorId);
  if (!capability) throw new Error('vendor capabilities not found');
  if (verifiedBy === store.find('vendors', (row) => row.id === vendorId)?.ownerId) {
    throw new Error('a vendor cannot verify its own license');
  }
  return capabilityView(store.update('vendorCapabilities', capability.id, {
    isVerifiedLicense: verified === true,
    verifiedBy,
    verifiedAt: verified === true ? new Date().toISOString() : null,
    licenseReference: reference ? String(reference).slice(0, 255) : null
  }));
}

export function addRecommendation({ vendorId, authorId, note, kind = 'staff_recommendation' } = {}) {
  const vendor = store.find('vendors', (row) => row.id === vendorId);
  if (!vendor) throw new Error('vendor not found');
  if (!authorId) throw new Error('authorId is required');
  if (vendor.ownerId === authorId) throw new Error('a vendor cannot recommend itself');
  if (!note || !String(note).trim()) throw new Error('note is required');
  return store.insert('vendorRecommendations', {
    id: newId('vrec'),
    vendorId,
    authorId,
    kind: String(kind).slice(0, 64),
    note: String(note).trim().slice(0, 1000),
    createdAt: new Date().toISOString()
  });
}

export function recommendations(vendorId) {
  return store.filter('vendorRecommendations', (row) => row.vendorId === vendorId)
    .slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/** Derived evidence, deliberately not a synthetic rating. */
export function performanceSummary(vendorId) {
  const rows = store.filter('orders', (order) => order.vendorId === vendorId);
  const fulfilled = rows.filter((order) => order.status === 'fulfilled' || order.status === 'settled').length;
  const settled = rows.filter((order) => order.status === 'settled').length;
  const disputed = rows.filter((order) => order.status === 'disputed').length;
  return {
    orderCount: rows.length,
    fulfilled,
    settled,
    disputed,
    onTime: null,
    rollingRating: null,
    note: 'On-time performance and ratings are not measured until fulfilment timestamps and verified reviews exist.'
  };
}

export function vendorView(vendorId) {
  const vendor = vendors.getVendor(vendorId);
  if (!vendor) return null;
  const capability = getCapabilities(vendorId);
  return {
    // Public projection: owner ids, audit identities and private store fields
    // never leave this boundary.
    vendor: {
      id: vendor.id,
      displayName: vendor.displayName,
      description: vendor.description,
      contactMethod: vendor.contactMethod,
      status: vendor.status,
      activeListingCount: vendor.activeListingCount,
      verification: vendor.verification
    },
    capabilities: capability ? {
      id: capability.id,
      vendorId: capability.vendorId,
      services: capability.services,
      regions: capability.regions,
      escrowSupported: capability.escrowSupported,
      isVerifiedLicense: capability.isVerifiedLicense
    } : null,
    performance: performanceSummary(vendorId),
    recommendations: recommendations(vendorId).map((row) => ({ id: row.id, kind: row.kind, note: row.note, createdAt: row.createdAt }))
  };
}
