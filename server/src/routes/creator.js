// CREATOR ROUTES — media kit, partnership, unified inbox, subscriptions.
import { callerId } from '../identity.js';
import * as partnership from '../domain/partnership.js';
import * as inbox from '../domain/inbox.js';
import * as subscription from '../domain/subscription.js';
import { requireAuth } from './helpers.js';
import { requireFeature } from '../features.js';

export function register(app) {
  app.use('/api/creator', requireFeature('partnership'));
  app.use('/api/inbox', requireFeature('partnership'));
  app.use('/api/subscriptions', requireFeature('partnership'));

  // --- Media kit + partnership ---------------------------------------------

  app.get('/api/creator/mediakit/mine', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ mediaKit: partnership.mediaKit(me) });
  });

  app.get('/api/creator/mediakits', (_req, res) => {
    res.json({ mediaKits: partnership.listMediaKits() });
  });

  app.get('/api/creator/opportunities', (req, res) => {
    const me = callerId(req);
    res.json({ opportunities: partnership.listOpportunities({ creatorId: me ?? undefined }) });
  });

  app.post('/api/creator/opportunities', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.status(201).json({ opportunity: partnership.createOpportunity({ ...req.body, brandId: me }) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/creator/opportunities/:id/:action', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ opportunity: partnership.transitionOpportunity(req.params.id, req.params.action, me) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  // --- Unified inbox --------------------------------------------------------

  app.get('/api/inbox/contacts', (_req, res) => {
    res.json({ contacts: inbox.listContacts() });
  });

  app.get('/api/inbox/thread/:key', (req, res) => {
    res.json({ messages: inbox.thread(decodeURIComponent(req.params.key)) });
  });

  // --- Subscriptions ----------------------------------------------------------

  app.get('/api/subscriptions', (req, res) => {
    const me = callerId(req);
    res.json({ subscriptions: subscription.listSubscriptions({ creatorId: me ?? undefined }) });
  });

  app.post('/api/subscriptions', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.status(201).json({ subscription: subscription.createSubscription({ ...req.body, creatorId: me }) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/subscriptions/:id/:action', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      if (req.params.action === 'cycle') {
        res.json({ transaction: subscription.recordCycle(req.params.id, me) });
        return;
      }
      res.json({ subscription: subscription.transitionSubscription(req.params.id, req.params.action) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });
}
