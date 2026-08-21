// ---------------------------------------------------------------------------
// PARTNERSHIP — creator media kit + brand opportunities (CCS §3.3)
//
// The discovery/marketing side of a creator. A MEDIA KIT is a derived summary
// of a creator (a vendor / campaign host) that a BRAND can browse; an
// OPPORTUNITY is a brand's concrete offer to collaborate, which the creator
// accepts or declines.
//
// HONESTY (unchanged rules):
//   * every media-kit figure is DERIVED from real rows — signals, orders,
//     campaigns, listings. Nothing is a stored "10k followers" claim.
//   * a media kit is never fabricated for a creator with no activity: it shows
//     what actually exists, and states absence plainly.
//   * an opportunity is a request, not money. It carries a budget the BRAND
//     states; no payment moves through here.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';

export const OPPORTUNITY_STATUS = ['pending', 'accepted', 'declined', 'withdrawn'];

function deriveAudience(ownerId) {
  // Signals the creator's own acts caused, and engagement on their objects.
  const asActor = store.filter('signals', (s) => s.actorId === ownerId);
  const objects = store.filter('objects', (o) => o.publication === 'public' && o.capturedBy === ownerId);
  const objectIds = new Set(objects.map((o) => o.id));
  const engagement = store.filter('signals', (s) => objectIds.has(s.objectId));

  const views = engagement.filter((s) => s.type === 'object_viewed').length;
  const saves = engagement.filter((s) => s.type === 'object_saved').length;
  const shares = engagement.filter((s) => s.type === 'object_shared').length;
  const contributions = asActor.filter((s) => s.type === 'object_created').length;

  return {
    publishedObjects: objects.length,
    views,
    saves,
    shares,
    contributions,
    // Derived engagement rate over views; null when nothing is measured.
    engagementRate: views > 0 ? (saves + shares) / views : null
  };
}

function deriveInterests(ownerId) {
  const cats = new Set();
  for (const o of store.filter('objects', (x) => x.capturedBy === ownerId)) {
    if (o.category) cats.add(o.category);
  }
  for (const l of store.filter('listings', (x) => x.ownerId === ownerId)) {
    if (l.category) cats.add(l.category);
  }
  return Array.from(cats).slice(0, 12);
}

function deriveCampaigns(ownerId) {
  return store.filter('campaigns', (c) => c.ownerId === ownerId)
    .slice()
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .map((c) => ({ id: c.id, title: c.title, status: c.status, registered: 0 }))
    .slice(0, 12);
}

function derivePricing(ownerId) {
  const vendor = store.find('vendors', (v) => v.ownerId === ownerId);
  const listings = vendor ? store.filter('listings', (l) => l.vendorId === vendor.id && l.status === 'active') : [];
  const prices = listings.map((l) => l.price).filter((p) => Number.isFinite(p));
  return {
    listingCount: listings.length,
    currency: listings[0]?.currency ?? 'KES',
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null
  };
}

/** The derived media kit for a creator (their vendor identity's owner). */
export function mediaKit(ownerId) {
  const vendor = store.find('vendors', (v) => v.ownerId === ownerId);
  if (!vendor) return null;
  return {
    creatorId: ownerId,
    vendorId: vendor.id,
    displayName: vendor.displayName,
    description: vendor.description,
    contactMethod: vendor.contactMethod,
    audience: deriveAudience(ownerId),
    interests: deriveInterests(ownerId),
    campaigns: deriveCampaigns(ownerId),
    pricing: derivePricing(ownerId),
    // The honest statement: derived figures only, no invented reach.
    note: 'All figures are derived from real activity on Brief. No follower count is fabricated.'
  };
}

export function listMediaKits() {
  return store.all('vendors')
    .map((v) => mediaKit(v.ownerId))
    .filter(Boolean);
}

/** A brand sends an opportunity to a creator. It is a request, never money. */
export function createOpportunity({ creatorId, brandId, title, description = '', budget = null, currency = 'KES' }) {
  if (!creatorId || !brandId) throw new Error('creator and brand are required');
  if (!title || !String(title).trim()) throw new Error('title is required');
  const vendor = store.find('vendors', (v) => v.ownerId === creatorId);
  if (!vendor) throw new Error('creator has no vendor profile');
  const now = new Date().toISOString();
  return store.insert('partnershipRequests', {
    id: newId('opp'),
    creatorId,
    brandId,
    title: String(title).trim(),
    description: String(description ?? ''),
    budget,
    currency,
    status: 'pending',
    createdAt: now,
    updatedAt: now
  });
}

export function transitionOpportunity(id, action, actorId) {
  const opp = store.find('partnershipRequests', (x) => x.id === id);
  if (!opp) throw new Error('opportunity not found');
  // Only the creator can accept/decline; only the brand can withdraw.
  if ((action === 'accept' || action === 'decline') && opp.creatorId !== actorId) {
    throw new Error('only the creator may respond');
  }
  if (action === 'withdraw' && opp.brandId !== actorId) {
    throw new Error('only the brand may withdraw');
  }
  const map = {
    accept: { from: ['pending'], to: 'accepted' },
    decline: { from: ['pending'], to: 'declined' },
    withdraw: { from: ['pending'], to: 'withdrawn' }
  };
  const m = map[action];
  if (!m) throw new Error(`unknown action: ${action}`);
  if (!m.from.includes(opp.status)) throw new Error(`cannot ${action} from ${opp.status}`);
  return store.update('partnershipRequests', id, { status: m.to, updatedAt: new Date().toISOString() });
}

export function listOpportunities({ creatorId = null, brandId = null } = {}) {
  let rows = store.all('partnershipRequests');
  if (creatorId) rows = rows.filter((o) => o.creatorId === creatorId);
  if (brandId) rows = rows.filter((o) => o.brandId === brandId);
  return rows.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
