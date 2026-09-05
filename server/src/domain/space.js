// ---------------------------------------------------------------------------
// SPACE DOMAIN (Brief 2.0 — The Digital Landlord)
//
// A Space is something a person is trying to make happen (a business, side-hustle,
// creator brand, circular fund, or project).
//
// Space sits as the governing container over existing commerce, communication,
// ledger, and activity primitives. The user expresses an intention; Brief
// coordinates the underlying capabilities.
//
// Invariants:
//   1. Money is never read from client body. Prices are derived from listings.
//   2. Identity is caller-authoritative.
//   3. Activity stream is append-only and reflects real server events.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import * as vendors from './vendor.js';
import * as listings from './listing.js';
import * as orders from './order.js';

export const SPACE_TYPES = [
  'business',
  'side_hustle',
  'creator',
  'community',
  'event',
  'project',
  'other'
];

/**
 * Creates a Space for an owner. If this is a commercial space (business / side_hustle),
 * it ensures an underlying vendor identity exists in the commerce layer.
 */
export function createSpace({
  ownerId,
  name,
  type = 'business',
  goal = '',
  targetValueKes = 0,
  initialOffer = null
}) {
  if (!ownerId) throw new Error('ownerId is required');
  if (!name || !String(name).trim()) throw new Error('Space name is required');

  const cleanName = String(name).trim();
  const cleanType = SPACE_TYPES.includes(type) ? type : 'other';

  // Ensure an underlying vendor identity exists for commerce operations
  let vendor = store.find('vendors', (v) => v.ownerId === ownerId);
  if (!vendor) {
    vendor = vendors.createVendor({
      ownerId,
      displayName: cleanName,
      description: goal || `Space: ${cleanName}`
    });
  }

  const spaceId = newId('spc');
  const now = new Date().toISOString();

  const space = {
    id: spaceId,
    ownerId,
    vendorId: vendor.id,
    name: cleanName,
    type: cleanType,
    goal: String(goal || '').trim(),
    targetValueKes: Number(targetValueKes) || 0,
    status: 'active',
    capabilities: ['commerce', 'communication', 'ledger', 'activity'],
    createdAt: now,
    updatedAt: now
  };

  store.insert('spaces', space);

  // Record initial activity
  recordSpaceActivity({
    spaceId,
    kind: 'space_created',
    title: `Created Space: ${cleanName}`,
    description: goal ? `Goal: ${goal}` : 'Space initialized',
    actorId: ownerId
  });

  // If an initial offer was provided, create it now
  if (initialOffer && initialOffer.title && initialOffer.price) {
    createSpaceOffer(spaceId, {
      ...initialOffer,
      callerId: ownerId
    });
  }

  return hydrateSpace(space);
}

/**
 * Retrieves a Space by id, hydrated with its offers, metrics, and activities.
 */
export function getSpace(spaceId, { callerId = null } = {}) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) return null;
  return hydrateSpace(space);
}

/**
 * Lists all spaces owned by a person.
 */
export function listSpacesForOwner(ownerId) {
  if (!ownerId) return [];
  const rows = store.filter('spaces', (s) => s.ownerId === ownerId && s.status !== 'archived');
  return rows.map(hydrateSpace);
}

/**
 * Updates a space.
 */
export function updateSpace(spaceId, updates = {}, { callerId }) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) return null;
  if (callerId && space.ownerId !== callerId) {
    throw new Error('Not authorized to update this space');
  }

  const allowed = {};
  if (typeof updates.name === 'string' && updates.name.trim()) allowed.name = updates.name.trim();
  if (typeof updates.goal === 'string') allowed.goal = updates.goal.trim();
  if (typeof updates.targetValueKes === 'number') allowed.targetValueKes = updates.targetValueKes;
  if (SPACE_TYPES.includes(updates.type)) allowed.type = updates.type;

  allowed.updatedAt = new Date().toISOString();
  store.update('spaces', space.id, allowed);

  return hydrateSpace({ ...space, ...allowed });
}

/**
 * Creates an offer (listing) associated with this space and its vendor.
 */
export function createSpaceOffer(spaceId, {
  title,
  description = '',
  price,
  currency = 'KES',
  type = 'product',
  images = [],
  callerId
}) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) throw new Error('Space not found');
  if (callerId && space.ownerId !== callerId) {
    throw new Error('Not authorized to create offers in this space');
  }

  const listing = listings.createListing({
    vendorId: space.vendorId,
    title,
    description,
    price,
    currency,
    type,
    images
  });

  // Attach space tag
  const updatedListing = store.update('listings', listing.id, { spaceId: space.id });

  recordSpaceActivity({
    spaceId: space.id,
    kind: 'offer_created',
    title: `Drafted offer: ${listing.title}`,
    description: `Price: ${listing.currency} ${(listing.price || 0).toLocaleString()}`,
    actorId: callerId || space.ownerId,
    metadata: { listingId: listing.id, price: listing.price }
  });

  return {
    ...listing,
    spaceId: space.id
  };
}

/**
 * Publishes an offer, transitioning it to 'active'.
 */
export function publishSpaceOffer(spaceId, offerId, { callerId }) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) throw new Error('Space not found');
  if (callerId && space.ownerId !== callerId) {
    throw new Error('Not authorized to publish offers in this space');
  }

  const listing = store.find('listings', (l) => l.id === offerId);
  if (!listing) throw new Error('Offer not found');

  const { listing: updated } = listings.transitionListing(offerId, 'active');

  recordSpaceActivity({
    spaceId: space.id,
    kind: 'offer_published',
    title: `Published offer: ${listing.title}`,
    description: `${listing.currency} ${(listing.price || 0).toLocaleString()} · Live and accepting orders`,
    actorId: callerId || space.ownerId,
    metadata: { listingId: listing.id, price: listing.price }
  });

  return updated;
}

/**
 * Records an immutable activity event in the Space.
 */
export function recordSpaceActivity({
  spaceId,
  kind,
  title,
  description = '',
  metadata = {},
  actorId = null
}) {
  const act = {
    id: newId('act'),
    spaceId,
    kind,
    title,
    description,
    metadata: metadata || {},
    actorId,
    createdAt: new Date().toISOString()
  };
  store.insert('spaceActivities', act);
  return act;
}

/**
 * Retrieves activity stream for a space (most recent first).
 */
export function getSpaceActivities(spaceId, { limit = 50 } = {}) {
  const rows = store.filter('spaceActivities', (a) => a.spaceId === spaceId);
  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return rows.slice(0, limit);
}

/**
 * Creates a contextual conversation from customer to seller about an offer.
 */
export function createSpaceConversation({
  spaceId,
  offerId = null,
  customerName,
  customerContact = '',
  message
}) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) throw new Error('Space not found');
  if (!customerName || !String(customerName).trim()) throw new Error('Customer name is required');
  if (!message || !String(message).trim()) throw new Error('Message is required');

  let offer = null;
  if (offerId) {
    offer = store.find('listings', (l) => l.id === offerId);
  }

  const convId = newId('cnv');
  const now = new Date().toISOString();

  const conversation = {
    id: convId,
    spaceId,
    offerId: offer ? offer.id : null,
    offerTitle: offer ? offer.title : null,
    offerPriceKes: offer ? offer.priceKes : null,
    customerName: String(customerName).trim(),
    customerContact: String(customerContact || '').trim(),
    status: 'new',
    messages: [
      {
        id: newId('msg'),
        from: 'customer',
        sender: String(customerName).trim(),
        text: String(message).trim(),
        at: now
      }
    ],
    createdAt: now,
    updatedAt: now
  };

  store.insert('spaceConversations', conversation);

  recordSpaceActivity({
    spaceId,
    kind: 'conversation_received',
    title: `${customerName} asked about ${offer ? offer.title : 'your space'}`,
    description: `"${String(message).slice(0, 80)}"`,
    metadata: { conversationId: convId, offerId }
  });

  return conversation;
}

/**
 * Retrieves conversations for a space.
 */
export function getSpaceConversations(spaceId) {
  const rows = store.filter('spaceConversations', (c) => c.spaceId === spaceId);
  rows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return rows;
}

/**
 * Creates an order directly from a space / conversation with server-authoritative pricing.
 */
export function createSpaceOrder({
  spaceId,
  offerId,
  customerId,
  customerName,
  quantity = 1,
  deliveryNotes = '',
  callerId
}) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) throw new Error('Space not found');
  if (callerId && space.ownerId !== callerId) {
    throw new Error('Not authorized to create orders in this space');
  }

  const order = orders.createOrder({
    listingId: offerId,
    buyerId: customerId || `cust_${newId('guest')}`,
    quantity,
    note: deliveryNotes ? `${customerName ? `For: ${customerName}. ` : ''}${deliveryNotes}` : (customerName ? `For: ${customerName}` : '')
  });

  // Attach space metadata
  store.update('orders', order.id, { spaceId: space.id, customerName: customerName || 'Customer' });

  recordSpaceActivity({
    spaceId: space.id,
    kind: 'order_created',
    title: `Order #${order.id.slice(-4)} created for ${customerName || 'Customer'}`,
    description: `${order.currency} ${(order.total || 0).toLocaleString()} · Ready for payment`,
    actorId: callerId,
    metadata: { orderId: order.id, total: order.total }
  });

  return {
    ...order,
    spaceId: space.id,
    customerName: customerName || 'Customer'
  };
}

/**
 * Helper to hydrate a Space with real metrics and connected items.
 */
function hydrateSpace(space) {
  const spaceListings = store.filter('listings', (l) => (l.spaceId === space.id || l.vendorId === space.vendorId) && l.status !== 'archived');
  const spaceOrders = store.filter('orders', (o) => o.spaceId === space.id || o.vendorId === space.vendorId);
  const spaceConversations = store.filter('spaceConversations', (c) => c.spaceId === space.id);
  const activities = getSpaceActivities(space.id, { limit: 10 });

  // Calculate real revenue from completed/paid ledger or orders
  let revenueKes = 0;
  for (const ord of spaceOrders) {
    if (ord.status === 'paid' || ord.status === 'completed' || ord.status === 'settled' || ord.status === 'fulfilled') {
      revenueKes += (ord.total || 0);
    }
  }

  // Count distinct customers from orders & conversations
  const customerSet = new Set();
  spaceOrders.forEach((o) => {
    if (o.customerName) customerSet.add(o.customerName);
    else if (o.buyerId) customerSet.add(o.buyerId);
  });
  spaceConversations.forEach((c) => {
    if (c.customerName) customerSet.add(c.customerName);
  });

  return {
    ...space,
    metrics: {
      revenueKes,
      customerCount: customerSet.size,
      activeOrdersCount: spaceOrders.filter((o) => o.status === 'ordered' || o.status === 'accepted' || o.status === 'preparing' || o.status === 'ready').length,
      totalOrdersCount: spaceOrders.length,
      offersCount: spaceListings.length
    },
    offers: spaceListings,
    recentActivities: activities,
    recentConversations: spaceConversations.slice(0, 5)
  };
}
