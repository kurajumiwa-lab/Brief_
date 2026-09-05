// SPACES ROUTES (Brief 2.0 — The Digital Landlord)
//
// Exposes the Space domain over HTTP.
// Identity is always caller-authoritative; pricing is server-derived.
import { callerId } from '../identity.js';
import * as spaces from '../domain/space.js';
import { requireAuth, recordError } from './helpers.js';

export function register(app) {
  // --- List caller's spaces ---
  app.get('/api/spaces', (req, res) => {
    try {
      const me = callerId(req);
      if (!me) {
        return res.json({ spaces: [] });
      }
      const list = spaces.listSpacesForOwner(me);
      res.json({ spaces: list });
    } catch (err) {
      recordError('spaces_list_failed', err);
      res.status(500).json({ error: 'failed to list spaces' });
    }
  });

  // --- Create a new space ---
  app.post('/api/spaces', requireAuth, (req, res) => {
    try {
      const me = callerId(req);
      const { name, type, goal, targetValueKes, initialOffer } = req.body || {};

      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Space name is required' });
      }

      const created = spaces.createSpace({
        ownerId: me,
        name,
        type,
        goal,
        targetValueKes,
        initialOffer
      });

      res.status(201).json({ space: created });
    } catch (err) {
      recordError('space_create_failed', err);
      res.status(400).json({ error: err.message || 'failed to create space' });
    }
  });

  // --- Get space by ID ---
  app.get('/api/spaces/:id', (req, res) => {
    try {
      const me = callerId(req);
      const space = spaces.getSpace(req.params.id, { callerId: me });
      if (!space) {
        return res.status(404).json({ error: 'space not found' });
      }
      res.json({ space });
    } catch (err) {
      recordError('space_get_failed', err);
      res.status(500).json({ error: 'failed to get space' });
    }
  });

  // --- Update a space ---
  app.patch('/api/spaces/:id', requireAuth, (req, res) => {
    try {
      const me = callerId(req);
      const updated = spaces.updateSpace(req.params.id, req.body || {}, { callerId: me });
      if (!updated) {
        return res.status(404).json({ error: 'space not found' });
      }
      res.json({ space: updated });
    } catch (err) {
      recordError('space_update_failed', err);
      res.status(400).json({ error: err.message || 'failed to update space' });
    }
  });

  // --- Create an offer inside a space ---
  app.post('/api/spaces/:id/offers', requireAuth, (req, res) => {
    try {
      const me = callerId(req);
      const { title, description, price, currency, type, images } = req.body || {};

      if (!title || price === undefined) {
        return res.status(400).json({ error: 'title and price are required' });
      }

      const listing = spaces.createSpaceOffer(req.params.id, {
        title,
        description,
        price,
        currency,
        type,
        images,
        callerId: me
      });

      res.status(201).json({ offer: listing });
    } catch (err) {
      recordError('space_offer_create_failed', err);
      res.status(400).json({ error: err.message || 'failed to create offer' });
    }
  });

  // --- Publish an offer inside a space ---
  app.post('/api/spaces/:id/offers/:offerId/publish', requireAuth, (req, res) => {
    try {
      const me = callerId(req);
      const published = spaces.publishSpaceOffer(req.params.id, req.params.offerId, { callerId: me });
      res.json({ offer: published });
    } catch (err) {
      recordError('space_offer_publish_failed', err);
      res.status(400).json({ error: err.message || 'failed to publish offer' });
    }
  });

  // --- List space activities ---
  app.get('/api/spaces/:id/activities', (req, res) => {
    try {
      const limit = parseInt(req.query.limit || '50', 10);
      const activities = spaces.getSpaceActivities(req.params.id, { limit });
      res.json({ activities });
    } catch (err) {
      recordError('space_activities_failed', err);
      res.status(500).json({ error: 'failed to get activities' });
    }
  });

  // --- Record a custom space activity ---
  app.post('/api/spaces/:id/activities', requireAuth, (req, res) => {
    try {
      const me = callerId(req);
      const { kind, title, description, metadata } = req.body || {};
      if (!title) {
        return res.status(400).json({ error: 'title is required' });
      }

      const act = spaces.recordSpaceActivity({
        spaceId: req.params.id,
        kind: kind || 'note',
        title,
        description,
        metadata,
        actorId: me
      });

      res.status(201).json({ activity: act });
    } catch (err) {
      recordError('space_activity_record_failed', err);
      res.status(400).json({ error: err.message || 'failed to record activity' });
    }
  });

  // --- Get space conversations ---
  app.get('/api/spaces/:id/conversations', requireAuth, (req, res) => {
    try {
      const convs = spaces.getSpaceConversations(req.params.id);
      res.json({ conversations: convs });
    } catch (err) {
      recordError('space_conversations_failed', err);
      res.status(500).json({ error: 'failed to get conversations' });
    }
  });

  // --- Create conversation (Customer enquiry) ---
  app.post('/api/spaces/:id/conversations', (req, res) => {
    try {
      const { offerId, customerName, customerContact, message } = req.body || {};

      if (!customerName || !message) {
        return res.status(400).json({ error: 'customerName and message are required' });
      }

      const conv = spaces.createSpaceConversation({
        spaceId: req.params.id,
        offerId,
        customerName,
        customerContact,
        message
      });

      res.status(201).json({ conversation: conv });
    } catch (err) {
      recordError('space_conversation_create_failed', err);
      res.status(400).json({ error: err.message || 'failed to create conversation' });
    }
  });

  // --- Post message in conversation ---
  app.post('/api/spaces/:id/conversations/:convId/messages', requireAuth, (req, res) => {
    try {
      const me = callerId(req);
      const { text, sender, from } = req.body || {};
      if (!text || !String(text).trim()) {
        return res.status(400).json({ error: 'Message text is required' });
      }

      const conv = spaces.postSpaceMessage({
        spaceId: req.params.id,
        conversationId: req.params.convId,
        text,
        sender: sender || 'Seller',
        from: from || 'owner',
        callerId: me
      });

      res.json({ conversation: conv });
    } catch (err) {
      recordError('space_message_post_failed', err);
      res.status(400).json({ error: err.message || 'failed to post message' });
    }
  });

  // --- Send Quote in conversation ---
  app.post('/api/spaces/:id/conversations/:convId/quote', requireAuth, (req, res) => {
    try {
      const me = callerId(req);
      const { title, priceKes, notes } = req.body || {};
      if (!title || !priceKes) {
        return res.status(400).json({ error: 'title and priceKes are required' });
      }

      const quote = spaces.createSpaceQuote({
        spaceId: req.params.id,
        conversationId: req.params.convId,
        title,
        priceKes,
        notes,
        callerId: me
      });

      res.status(201).json({ quote });
    } catch (err) {
      recordError('space_quote_create_failed', err);
      res.status(400).json({ error: err.message || 'failed to create quote' });
    }
  });

  // --- Trigger M-Pesa STK Prompt ---
  app.post('/api/spaces/:id/conversations/:convId/mpesa-prompt', requireAuth, (req, res) => {
    try {
      const me = callerId(req);
      const { quoteId, phoneNumber, amountKes, description } = req.body || {};
      if (!amountKes) {
        return res.status(400).json({ error: 'amountKes is required' });
      }

      const prompt = spaces.triggerMpesaPrompt({
        spaceId: req.params.id,
        conversationId: req.params.convId,
        quoteId,
        phoneNumber,
        amountKes,
        description,
        callerId: me
      });

      res.status(201).json({ prompt });
    } catch (err) {
      recordError('space_mpesa_prompt_failed', err);
      res.status(400).json({ error: err.message || 'failed to trigger M-Pesa prompt' });
    }
  });

  // --- Complete M-Pesa Payment & Auto-Convert to Order ---
  app.post('/api/spaces/:id/conversations/:convId/mpesa-complete', (req, res) => {
    try {
      const { paymentRequestId, mpesaReceipt, amountPaid } = req.body || {};
      if (!paymentRequestId) {
        return res.status(400).json({ error: 'paymentRequestId is required' });
      }

      const result = spaces.completeMpesaPayment({
        spaceId: req.params.id,
        conversationId: req.params.convId,
        paymentRequestId,
        mpesaReceipt,
        amountPaid
      });

      res.json(result);
    } catch (err) {
      recordError('space_mpesa_complete_failed', err);
      res.status(400).json({ error: err.message || 'failed to complete M-Pesa payment' });
    }
  });

  // --- Inbound WhatsApp Webhook Router ---
  app.post('/api/spaces/:id/whatsapp/inbound', (req, res) => {
    try {
      const { from, customerName, text, offerId } = req.body || {};
      if (!from || !text) {
        return res.status(400).json({ error: 'from phone and text are required' });
      }

      const conversation = spaces.routeInboundWhatsAppMessage({
        spaceId: req.params.id,
        from,
        customerName: customerName || 'WhatsApp Customer',
        text,
        offerId
      });

      res.status(201).json({ conversation });
    } catch (err) {
      recordError('space_whatsapp_inbound_failed', err);
      res.status(400).json({ error: err.message || 'failed to route WhatsApp message' });
    }
  });

  // --- Get Space Money & Duka Ledger Summary ---
  app.get('/api/spaces/:id/money', requireAuth, (req, res) => {
    try {
      const summary = spaces.getSpaceMoneySummary(req.params.id);
      res.json({ money: summary });
    } catch (err) {
      recordError('space_money_summary_failed', err);
      res.status(500).json({ error: 'failed to get money summary' });
    }
  });

  // --- Record an Expense / Supply Cost ---
  app.post('/api/spaces/:id/expenses', requireAuth, (req, res) => {
    try {
      const me = callerId(req);
      const { category, description, amountKes, date } = req.body || {};
      if (!description || !amountKes) {
        return res.status(400).json({ error: 'description and amountKes are required' });
      }

      const expense = spaces.recordSpaceExpense({
        spaceId: req.params.id,
        category,
        description,
        amountKes,
        date,
        callerId: me
      });

      res.status(201).json({ expense });
    } catch (err) {
      recordError('space_expense_record_failed', err);
      res.status(400).json({ error: err.message || 'failed to record expense' });
    }
  });

  // --- List Space Expenses ---
  app.get('/api/spaces/:id/expenses', requireAuth, (req, res) => {
    try {
      const expenses = spaces.getSpaceExpenses(req.params.id);
      res.json({ expenses });
    } catch (err) {
      recordError('space_expenses_list_failed', err);
      res.status(500).json({ error: 'failed to list expenses' });
    }
  });

  // --- Record a Customer Credit Tab (DukaBook) ---
  app.post('/api/spaces/:id/tabs', requireAuth, (req, res) => {
    try {
      const me = callerId(req);
      const { customerName, customerContact, amountKes, note } = req.body || {};
      if (!customerName || !amountKes) {
        return res.status(400).json({ error: 'customerName and amountKes are required' });
      }

      const tab = spaces.recordCustomerTab({
        spaceId: req.params.id,
        customerName,
        customerContact,
        amountKes,
        note,
        callerId: me
      });

      res.status(201).json({ tab });
    } catch (err) {
      recordError('space_tab_record_failed', err);
      res.status(400).json({ error: err.message || 'failed to record customer tab' });
    }
  });

  // --- Record Payment on Customer Tab ---
  app.post('/api/spaces/:id/tabs/:tabId/payments', requireAuth, (req, res) => {
    try {
      const me = callerId(req);
      const { amountKes, note } = req.body || {};
      if (!amountKes) {
        return res.status(400).json({ error: 'amountKes is required' });
      }

      const updatedTab = spaces.recordTabPayment({
        spaceId: req.params.id,
        tabId: req.params.tabId,
        amountKes,
        note,
        callerId: me
      });

      res.json({ tab: updatedTab });
    } catch (err) {
      recordError('space_tab_payment_failed', err);
      res.status(400).json({ error: err.message || 'failed to record tab payment' });
    }
  });

  // --- List Customer Tabs ---
  app.get('/api/spaces/:id/tabs', requireAuth, (req, res) => {
    try {
      const tabs = spaces.getSpaceTabs(req.params.id);
      res.json({ tabs });
    } catch (err) {
      recordError('space_tabs_list_failed', err);
      res.status(500).json({ error: 'failed to list customer tabs' });
    }
  });

  // --- Create an Inter-County Cargo Dispatch ---
  app.post('/api/spaces/:id/dispatches', requireAuth, (req, res) => {
    try {
      const me = callerId(req);
      const {
        orderId,
        destinationCounty,
        destinationTown,
        carrierSacco,
        waybillRef,
        receiverName,
        receiverPhone,
        conductorContact,
        stageFeeKes,
        notes
      } = req.body || {};

      const dispatch = spaces.createSpaceDispatch({
        spaceId: req.params.id,
        orderId,
        destinationCounty,
        destinationTown,
        carrierSacco,
        waybillRef,
        receiverName,
        receiverPhone,
        conductorContact,
        stageFeeKes,
        notes,
        callerId: me
      });

      res.status(201).json({ dispatch });
    } catch (err) {
      recordError('space_dispatch_create_failed', err);
      res.status(400).json({ error: err.message || 'failed to create cargo dispatch' });
    }
  });

  // --- List Space Dispatches ---
  app.get('/api/spaces/:id/dispatches', requireAuth, (req, res) => {
    try {
      const dispatches = spaces.getSpaceDispatches(req.params.id);
      res.json({ dispatches });
    } catch (err) {
      recordError('space_dispatches_list_failed', err);
      res.status(500).json({ error: 'failed to list dispatches' });
    }
  });

  // --- Update Dispatch Status ---
  app.patch('/api/spaces/:id/dispatches/:dispatchId', requireAuth, (req, res) => {
    try {
      const me = callerId(req);
      const { status, conductorContact } = req.body || {};

      const updated = spaces.updateDispatchStatus({
        spaceId: req.params.id,
        dispatchId: req.params.dispatchId,
        status,
        conductorContact,
        callerId: me
      });

      res.json({ dispatch: updated });
    } catch (err) {
      recordError('space_dispatch_update_failed', err);
      res.status(400).json({ error: err.message || 'failed to update dispatch' });
    }
  });

  // --- Create order from space ---
  app.post('/api/spaces/:id/orders', requireAuth, (req, res) => {
    try {
      const me = callerId(req);
      const { offerId, customerId, customerName, quantity, deliveryNotes } = req.body || {};

      if (!offerId) {
        return res.status(400).json({ error: 'offerId is required' });
      }

      const order = spaces.createSpaceOrder({
        spaceId: req.params.id,
        offerId,
        customerId,
        customerName,
        quantity: quantity || 1,
        deliveryNotes,
        callerId: me
      });

      res.status(201).json({ order });
    } catch (err) {
      recordError('space_order_create_failed', err);
      res.status(400).json({ error: err.message || 'failed to create order' });
    }
  });
}
