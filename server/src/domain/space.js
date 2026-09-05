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
//   1. Money is never read from client body. Prices are derived from listings/quotes.
//   2. Identity is caller-authoritative.
//   3. Activity stream is append-only and reflects real server events.
//   4. Conversations support quotes, M-Pesa STK push triggers, and automatic order conversion.
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
  targetValueKes = null,
  initialOffer = null
}) {
  if (!ownerId) throw new Error('Space must have an ownerId');
  if (!name || !name.trim()) throw new Error('Space name cannot be empty');

  const spaceId = newId('spc');
  const now = new Date().toISOString();

  // Provision an underlying vendor row so existing commerce primitives link cleanly
  let vendorId = null;
  const existingVendor = store.find('vendors', (v) => v.ownerId === ownerId);
  if (existingVendor) {
    vendorId = existingVendor.id;
  } else {
    const newVend = vendors.createVendor({
      ownerId,
      displayName: name.trim(),
      description: `Space: ${name.trim()} (${type})`
    });
    vendorId = newVend.id;
  }

  const space = {
    id: spaceId,
    ownerId,
    vendorId,
    name: name.trim(),
    type: SPACE_TYPES.includes(type) ? type : 'business',
    goal: goal ? goal.trim() : '',
    targetValueKes: targetValueKes ? Number(targetValueKes) : null,
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
    title: `Created Space: ${space.name}`,
    description: goal ? `Goal: ${goal}` : `Initialized ${type} space`,
    actorId: ownerId,
    metadata: { type, goal }
  });

  // If initial offer provided, create it immediately
  if (initialOffer && initialOffer.title && initialOffer.price) {
    createSpaceOffer(spaceId, {
      title: initialOffer.title,
      price: initialOffer.price,
      currency: initialOffer.currency || 'KES',
      type: initialOffer.type || 'product',
      description: initialOffer.description || '',
      callerId: ownerId
    });
  }

  return hydrateSpace(space);
}

/**
 * Retrieves a Space with live metrics, active offers, recent activities, and conversations.
 */
export function getSpace(spaceId, { callerId = null } = {}) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) return null;
  return hydrateSpace(space, { callerId });
}

/**
 * Lists all spaces owned by a person.
 */
export function listSpacesForOwner(ownerId) {
  if (!ownerId) return [];
  const rows = store.filter('spaces', (s) => s.ownerId === ownerId);
  return rows.map((s) => hydrateSpace(s));
}

/**
 * Updates space properties (name, goal, targetValueKes, status).
 */
export function updateSpace(spaceId, updates = {}, { callerId }) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) return null;
  if (callerId && space.ownerId !== callerId) {
    throw new Error('Not authorized to update this space');
  }

  const patch = { updatedAt: new Date().toISOString() };
  if (updates.name && updates.name.trim()) patch.name = updates.name.trim();
  if (updates.goal !== undefined) patch.goal = String(updates.goal).trim();
  if (updates.targetValueKes !== undefined) patch.targetValueKes = updates.targetValueKes ? Number(updates.targetValueKes) : null;
  if (updates.status) patch.status = updates.status;

  const updated = store.update('spaces', spaceId, patch);
  return hydrateSpace(updated);
}

/**
 * Creates an offer/listing linked to this space with server-authoritative pricing.
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
    throw new Error('Not authorized to add offers to this space');
  }

  const numPrice = Number(price);
  if (isNaN(numPrice) || numPrice < 0) {
    throw new Error('Price must be a valid non-negative number');
  }

  // Create listing using authoritative listing domain
  const listing = listings.createListing({
    vendorId: space.vendorId,
    title: title.trim(),
    description: description ? description.trim() : '',
    price: numPrice,
    currency,
    type,
    images
  });

  // Attach space linkage to listing
  const updatedListing = store.update('listings', listing.id, { spaceId: space.id });

  // Record activity
  recordSpaceActivity({
    spaceId: space.id,
    kind: 'offer_created',
    title: `Added offer: ${listing.title}`,
    description: `${currency} ${numPrice.toLocaleString()} · Draft`,
    actorId: callerId,
    metadata: { offerId: listing.id, price: numPrice }
  });

  return updatedListing;
}

/**
 * Publishes an offer, making it active in the catalog.
 */
export function publishSpaceOffer(spaceId, offerId, { callerId }) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) throw new Error('Space not found');
  if (callerId && space.ownerId !== callerId) {
    throw new Error('Not authorized to publish offers in this space');
  }

  const listing = store.find('listings', (l) => l.id === offerId);
  if (!listing) throw new Error('Offer not found');

  const res = listings.transitionListing(offerId, 'active');
  const published = res.listing;

  // Record activity
  recordSpaceActivity({
    spaceId: space.id,
    kind: 'offer_published',
    title: `Published offer: ${published.title}`,
    description: `${published.currency} ${(published.priceKes || published.price || 0).toLocaleString()} · Live and accepting orders`,
    actorId: callerId,
    metadata: { offerId: published.id }
  });

  return published;
}

/**
 * Records an immutable activity event inside a Space.
 */
export function recordSpaceActivity({
  spaceId,
  kind,
  title,
  description = '',
  actorId = null,
  metadata = {}
}) {
  const activityId = newId('act');
  const now = new Date().toISOString();

  const activity = {
    id: activityId,
    spaceId,
    kind,
    title,
    description,
    actorId,
    metadata,
    createdAt: now
  };

  store.insert('spaceActivities', activity);
  return activity;
}

/**
 * Retrieves the activity log for a Space.
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
    quotes: [],
    paymentPrompts: [],
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
 * Posts a message into a conversation thread (from seller or customer).
 */
export function postSpaceMessage({
  spaceId,
  conversationId,
  text,
  from = 'owner',
  sender = 'Seller',
  quote = null,
  paymentPrompt = null,
  callerId = null
}) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) throw new Error('Space not found');

  const conversation = store.find('spaceConversations', (c) => c.id === conversationId);
  if (!conversation) throw new Error('Conversation not found');

  const now = new Date().toISOString();
  const msgId = newId('msg');

  const newMsg = {
    id: msgId,
    from,
    sender,
    text: String(text || '').trim(),
    quote,
    paymentPrompt,
    at: now
  };

  const updatedMessages = [...(conversation.messages || []), newMsg];
  const patch = { messages: updatedMessages, updatedAt: now };

  if (from === 'owner' && conversation.status === 'new') {
    patch.status = 'active';
  }

  const updatedConv = store.update('spaceConversations', conversationId, patch);

  if (from === 'owner' && !quote && !paymentPrompt) {
    recordSpaceActivity({
      spaceId,
      kind: 'message_sent',
      title: `Replied to ${conversation.customerName}`,
      description: `"${String(text).slice(0, 80)}"`,
      actorId: callerId,
      metadata: { conversationId }
    });
  }

  return updatedConv;
}

/**
 * Creates a formal in-chat quotation card for customized pricing.
 */
export function createSpaceQuote({
  spaceId,
  conversationId,
  title,
  priceKes,
  notes = '',
  callerId = null
}) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) throw new Error('Space not found');
  if (callerId && space.ownerId !== callerId) {
    throw new Error('Not authorized to quote in this space');
  }

  const conversation = store.find('spaceConversations', (c) => c.id === conversationId);
  if (!conversation) throw new Error('Conversation not found');

  const numPrice = Number(priceKes);
  if (isNaN(numPrice) || numPrice <= 0) {
    throw new Error('Quote price must be a positive amount');
  }

  const quoteId = newId('quot');
  const now = new Date().toISOString();

  const quote = {
    id: quoteId,
    title: String(title).trim(),
    priceKes: numPrice,
    notes: String(notes || '').trim(),
    status: 'sent',
    createdAt: now
  };

  const existingQuotes = conversation.quotes || [];
  store.update('spaceConversations', conversationId, {
    quotes: [...existingQuotes, quote],
    updatedAt: now
  });

  // Post quotation message in thread
  postSpaceMessage({
    spaceId,
    conversationId,
    from: 'owner',
    sender: space.name,
    text: `Quotation: ${quote.title} — KES ${numPrice.toLocaleString()}${notes ? ` (${notes})` : ''}`,
    quote,
    callerId
  });

  // Record space activity
  recordSpaceActivity({
    spaceId,
    kind: 'quote_sent',
    title: `Sent quote to ${conversation.customerName}`,
    description: `${quote.title} · KES ${numPrice.toLocaleString()}`,
    actorId: callerId,
    metadata: { conversationId, quoteId, priceKes: numPrice }
  });

  return quote;
}

/**
 * Triggers an M-Pesa STK push prompt card into the conversation.
 */
export function triggerMpesaPrompt({
  spaceId,
  conversationId,
  quoteId = null,
  phoneNumber,
  amountKes,
  description = 'Order Payment',
  callerId = null
}) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) throw new Error('Space not found');

  const conversation = store.find('spaceConversations', (c) => c.id === conversationId);
  if (!conversation) throw new Error('Conversation not found');

  const numAmount = Number(amountKes);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Amount must be positive');
  }

  const cleanPhone = String(phoneNumber || conversation.customerContact || '').replace(/[^\d+]/g, '');
  if (!cleanPhone) {
    throw new Error('Phone number is required for M-Pesa STK push');
  }

  const paymentRequestId = newId('payreq');
  const now = new Date().toISOString();

  const prompt = {
    id: paymentRequestId,
    quoteId,
    phoneNumber: cleanPhone,
    amountKes: numAmount,
    description: String(description).trim(),
    status: 'pending',
    createdAt: now
  };

  const existingPrompts = conversation.paymentPrompts || [];
  store.update('spaceConversations', conversationId, {
    paymentPrompts: [...existingPrompts, prompt],
    updatedAt: now
  });

  // Post payment prompt into thread
  postSpaceMessage({
    spaceId,
    conversationId,
    from: 'system',
    sender: 'M-Pesa Express',
    text: `M-Pesa STK Push sent to ${cleanPhone} for KES ${numAmount.toLocaleString()} (${description})`,
    paymentPrompt: prompt,
    callerId
  });

  // Record activity
  recordSpaceActivity({
    spaceId,
    kind: 'mpesa_prompt_sent',
    title: `M-Pesa prompt sent to ${conversation.customerName}`,
    description: `KES ${numAmount.toLocaleString()} · Waiting for PIN confirmation`,
    actorId: callerId,
    metadata: { conversationId, paymentRequestId, amountKes: numAmount, phone: cleanPhone }
  });

  return prompt;
}

/**
 * Completes an M-Pesa payment, settles the transaction, and auto-converts inquiry to a paid order.
 */
export function completeMpesaPayment({
  spaceId,
  conversationId,
  paymentRequestId,
  mpesaReceipt = null,
  amountPaid = null
}) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) throw new Error('Space not found');

  const conversation = store.find('spaceConversations', (c) => c.id === conversationId);
  if (!conversation) throw new Error('Conversation not found');

  const prompt = (conversation.paymentPrompts || []).find((p) => p.id === paymentRequestId);
  const finalAmount = amountPaid !== null ? Number(amountPaid) : (prompt ? prompt.amountKes : 0);
  const receipt = mpesaReceipt || `QA${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  const now = new Date().toISOString();

  // Update prompt status
  if (prompt) {
    prompt.status = 'paid';
    prompt.receipt = receipt;
    prompt.paidAt = now;
  }

  // Auto-convert to a paid Order
  const orderId = newId('ord');
  const newOrder = {
    id: orderId,
    vendorId: space.vendorId,
    spaceId: space.id,
    listingId: conversation.offerId || null,
    buyerId: `cust_${newId('guest')}`,
    customerName: conversation.customerName,
    customerContact: conversation.customerContact,
    quantity: 1,
    subtotal: finalAmount,
    discountKes: 0,
    total: finalAmount,
    currency: 'KES',
    status: 'paid',
    paymentMethod: 'mpesa',
    mpesaReceipt: receipt,
    note: `Ordered via chat conversation #${conversation.id.slice(-4)}`,
    createdAt: now,
    updatedAt: now
  };

  store.insert('orders', newOrder);

  // Update conversation status and attach orderId
  store.update('spaceConversations', conversationId, {
    status: 'converted',
    orderId: newOrder.id,
    updatedAt: now
  });

  // Post success message in conversation thread
  postSpaceMessage({
    spaceId,
    conversationId,
    from: 'system',
    sender: 'M-Pesa Verified',
    text: `Payment Confirmed! ${receipt} — KES ${finalAmount.toLocaleString()} received. Order #${orderId.slice(-4)} created.`,
    paymentPrompt: { ...prompt, status: 'paid', receipt }
  });

  // Record space activities
  recordSpaceActivity({
    spaceId,
    kind: 'payment_received',
    title: `Payment Received: KES ${finalAmount.toLocaleString()}`,
    description: `M-Pesa Receipt: ${receipt} from ${conversation.customerName}`,
    metadata: { conversationId, orderId: newOrder.id, receipt, amountKes: finalAmount }
  });

  recordSpaceActivity({
    spaceId,
    kind: 'order_created',
    title: `Order #${orderId.slice(-4)} paid by ${conversation.customerName}`,
    description: `KES ${finalAmount.toLocaleString()} · Ready for preparation / dispatch`,
    metadata: { orderId: newOrder.id, total: finalAmount }
  });

  return {
    order: newOrder,
    receipt,
    status: 'paid'
  };
}

/**
 * Inbound WhatsApp message router: routes customer WhatsApp chats into seller's Space inbox.
 */
export function routeInboundWhatsAppMessage({
  spaceId,
  from,
  customerName = 'WhatsApp Customer',
  text,
  offerId = null
}) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) throw new Error('Space not found');

  // Look for existing active conversation with this customer phone number in this space
  let conversation = store.find(
    'spaceConversations',
    (c) => c.spaceId === spaceId && c.customerContact === from && c.status !== 'archived'
  );

  const now = new Date().toISOString();

  if (conversation) {
    // Append to existing thread
    const updatedMessages = [
      ...(conversation.messages || []),
      {
        id: newId('msg'),
        from: 'customer',
        sender: customerName,
        text: String(text).trim(),
        at: now
      }
    ];

    conversation = store.update('spaceConversations', conversation.id, {
      messages: updatedMessages,
      status: conversation.status === 'converted' ? 'active' : conversation.status,
      updatedAt: now
    });

    recordSpaceActivity({
      spaceId,
      kind: 'whatsapp_message_received',
      title: `New WhatsApp message from ${customerName}`,
      description: `"${String(text).slice(0, 80)}"`,
      metadata: { conversationId: conversation.id, from }
    });
  } else {
    // Create new conversation
    conversation = createSpaceConversation({
      spaceId,
      offerId,
      customerName,
      customerContact: from,
      message: text
    });
  }

  return conversation;
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
 * Records a supply or operational expense for a space.
 */
export function recordSpaceExpense({
  spaceId,
  category = 'supplies',
  description,
  amountKes,
  date = null,
  callerId = null
}) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) throw new Error('Space not found');
  if (callerId && space.ownerId !== callerId) {
    throw new Error('Not authorized to record expenses for this space');
  }

  const numAmount = Number(amountKes);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Expense amount must be a positive number');
  }
  if (!description || !String(description).trim()) {
    throw new Error('Expense description is required');
  }

  const expenseId = newId('exp');
  const now = new Date().toISOString();

  const expense = {
    id: expenseId,
    spaceId,
    category: String(category).trim(),
    description: String(description).trim(),
    amountKes: numAmount,
    date: date || now.split('T')[0],
    createdAt: now
  };

  store.insert('spaceExpenses', expense);

  recordSpaceActivity({
    spaceId,
    kind: 'expense_recorded',
    title: `Recorded expense: ${expense.description}`,
    description: `KES ${numAmount.toLocaleString()} · ${expense.category}`,
    actorId: callerId,
    metadata: { expenseId, amountKes: numAmount, category: expense.category }
  });

  return expense;
}

/**
 * Lists all expenses for a space.
 */
export function getSpaceExpenses(spaceId) {
  const rows = store.filter('spaceExpenses', (e) => e.spaceId === spaceId);
  rows.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  return rows;
}

/**
 * Opens a customer credit tab (DukaBook / Lipa Pole Pole balance).
 */
export function recordCustomerTab({
  spaceId,
  customerName,
  customerContact = '',
  amountKes,
  note = '',
  callerId = null
}) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) throw new Error('Space not found');
  if (callerId && space.ownerId !== callerId) {
    throw new Error('Not authorized to manage tabs for this space');
  }

  const numAmount = Number(amountKes);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Credit amount must be a positive number');
  }
  if (!customerName || !String(customerName).trim()) {
    throw new Error('Customer name is required');
  }

  const tabId = newId('tab');
  const now = new Date().toISOString();

  const tab = {
    id: tabId,
    spaceId,
    customerName: String(customerName).trim(),
    customerContact: String(customerContact || '').trim(),
    initialDebtKes: numAmount,
    balanceKes: numAmount,
    status: 'active',
    notes: String(note || '').trim(),
    records: [
      {
        id: newId('rec'),
        type: 'credit',
        amountKes: numAmount,
        date: now.split('T')[0],
        note: note || 'Initial credit extended'
      }
    ],
    createdAt: now,
    updatedAt: now
  };

  store.insert('spaceCustomerTabs', tab);

  recordSpaceActivity({
    spaceId,
    kind: 'tab_created',
    title: `Extended credit to ${tab.customerName}`,
    description: `KES ${numAmount.toLocaleString()} balance recorded in DukaBook`,
    actorId: callerId,
    metadata: { tabId, amountKes: numAmount, customerName: tab.customerName }
  });

  return tab;
}

/**
 * Records a partial or full payment towards a customer credit tab.
 */
export function recordTabPayment({
  spaceId,
  tabId,
  amountKes,
  note = '',
  callerId = null
}) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) throw new Error('Space not found');
  if (callerId && space.ownerId !== callerId) {
    throw new Error('Not authorized to update tabs for this space');
  }

  const tab = store.find('spaceCustomerTabs', (t) => t.id === tabId && t.spaceId === spaceId);
  if (!tab) throw new Error('Customer tab not found');

  const numAmount = Number(amountKes);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Payment amount must be a positive number');
  }

  const now = new Date().toISOString();
  const newBalance = Math.max(0, tab.balanceKes - numAmount);
  const newStatus = newBalance === 0 ? 'cleared' : 'active';

  const updatedRecords = [
    ...(tab.records || []),
    {
      id: newId('rec'),
      type: 'payment',
      amountKes: numAmount,
      date: now.split('T')[0],
      note: note || 'Payment received on tab'
    }
  ];

  const updatedTab = store.update('spaceCustomerTabs', tabId, {
    balanceKes: newBalance,
    status: newStatus,
    records: updatedRecords,
    updatedAt: now
  });

  recordSpaceActivity({
    spaceId,
    kind: 'tab_payment_received',
    title: `Received KES ${numAmount.toLocaleString()} from ${tab.customerName}`,
    description: newBalance === 0 ? 'Tab fully cleared!' : `Remaining balance: KES ${newBalance.toLocaleString()}`,
    actorId: callerId,
    metadata: { tabId, paymentAmountKes: numAmount, remainingBalanceKes: newBalance }
  });

  return updatedTab;
}

/**
 * Lists all customer credit tabs for a space.
 */
export function getSpaceTabs(spaceId) {
  const rows = store.filter('spaceCustomerTabs', (t) => t.spaceId === spaceId);
  rows.sort((a, b) => (b.balanceKes || 0) - (a.balanceKes || 0));
  return rows;
}

/**
 * Retrieves the comprehensive financial summary for a space.
 */
export function getSpaceMoneySummary(spaceId) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) throw new Error('Space not found');

  const spaceOrders = store.filter('orders', (o) => o.spaceId === space.id || o.vendorId === space.vendorId);
  const expenses = getSpaceExpenses(spaceId);
  const tabs = getSpaceTabs(spaceId);

  let totalRevenueKes = 0;
  for (const ord of spaceOrders) {
    if (ord.status === 'paid' || ord.status === 'completed' || ord.status === 'settled' || ord.status === 'fulfilled') {
      totalRevenueKes += (ord.total || 0);
    }
  }

  let totalExpensesKes = 0;
  for (const exp of expenses) {
    totalExpensesKes += (exp.amountKes || 0);
  }

  let totalReceivablesKes = 0;
  for (const tab of tabs) {
    if (tab.status === 'active') {
      totalReceivablesKes += (tab.balanceKes || 0);
    }
  }

  const netProfitKes = totalRevenueKes - totalExpensesKes;
  const marginPercent = totalRevenueKes > 0 ? Math.round((netProfitKes / totalRevenueKes) * 100) : 0;

  return {
    spaceId,
    totalRevenueKes,
    totalExpensesKes,
    netProfitKes,
    marginPercent,
    totalReceivablesKes,
    activeTabsCount: tabs.filter((t) => t.status === 'active').length,
    recentExpenses: expenses.slice(0, 10),
    tabs: tabs.slice(0, 20)
  };
}

/**
 * Helper to hydrate a Space with real metrics and connected items.
 */
function hydrateSpace(space, { callerId = null } = {}) {
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

  const activeOrdersCount = spaceOrders.filter((o) => o.status === 'pending' || o.status === 'paid' || o.status === 'processing').length;

  return {
    ...space,
    metrics: {
      revenueKes,
      customerCount: customerSet.size,
      activeOrdersCount,
      totalOrdersCount: spaceOrders.length,
      offersCount: spaceListings.filter((l) => l.status === 'active').length
    },
    offers: spaceListings,
    recentActivities: activities,
    recentConversations: spaceConversations.slice(0, 10)
  };
}
