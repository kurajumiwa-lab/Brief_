// SPACES ROUTES (Brief 2.0 — The Digital Landlord)
//
// Exposes the Space domain over HTTP.
// Identity is always caller-authoritative; pricing is server-derived.
import { store } from '../store.js';
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
