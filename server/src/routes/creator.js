// CREATOR ROUTES — media kit, partnership, unified inbox, subscriptions.
import { callerId } from '../identity.js';
import * as partnership from '../domain/partnership.js';
import * as creatorProfile from '../domain/creatorProfile.js';
import * as person from '../domain/person.js';
import * as inbox from '../domain/inbox.js';
import * as subscription from '../domain/subscription.js';
import { requireAuth } from './helpers.js';
import { requireFeature } from '../features.js';

export function register(app) {
  app.use('/api/creator', requireFeature('partnership'));
  app.use('/api/creator/profile', requireFeature('creator_profiles'));
  app.use('/api/creator/rate-cards', requireFeature('creator_profiles'));
  app.use('/api/inbox', requireFeature('partnership'));
  app.use('/api/subscriptions', requireFeature('partnership'));

  // --- Creator profile + rate cards ----------------------------------------

  app.get('/api/creator/profile', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ profile: creatorProfile.getMyProfile(me) });
  });

  app.patch('/api/creator/profile', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ profile: creatorProfile.updateProfile(me, req.body ?? {}) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.get('/api/creator/rate-cards', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const personId = person.personIdForUser(me);
    res.json({ rateCards: creatorProfile.listRateCards({ creatorId: personId }) });
  });

  app.post('/api/creator/rate-cards', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.status(201).json({ rateCard: creatorProfile.createRateCard(me, req.body ?? {}) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.patch('/api/creator/rate-cards/:id', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ rateCard: creatorProfile.updateRateCard(me, req.params.id, req.body ?? {}) });
    } catch (e) {
      const msg = String(e.message ?? e);
      res.status(/not found/.test(msg) ? 404 : 400).json({ error: msg });
    }
  });

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

  // Plans are read in three shapes, and each is explicit rather than guessed
  // from an unauthenticated caller:
  //   (no query, signed in) MY plans
  //   ?creator=<id>          one creator's public plans (discovery)
  //   ?browse=1              every public plan, minus my own
  // An anonymous caller gets discovery only -- the old route returned every
  // plan in the deployment to anyone, which was a leak that happened to look
  // like a feature.
  app.get('/api/subscriptions', (req, res) => {
    const me = callerId(req);

    if (req.query.creator) {
      return res.json({
        subscriptions: subscription.listSubscriptions({ creatorId: String(req.query.creator), viewerId: me })
      });
    }

    if (req.query.browse) {
      const all = subscription.listSubscriptions({ viewerId: me })
        .filter((s) => s.creatorId !== me)
        .filter((s) => s.status === 'active');
      return res.json({ subscriptions: all });
    }

    if (!me) return res.status(401).json({ error: 'authentication required' });
    res.json({ subscriptions: subscription.listSubscriptions({ creatorId: me, viewerId: me }) });
  });

  // JOIN A PLAN. This is the follower's half of the loop: the creator can
  // publish a plan, and this is how anybody else actually supports it.
  app.post('/api/subscriptions/:id/subscribe', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const result = subscription.subscribe(req.params.id, me);
      // 201 on a new membership, 200 when the caller was already a member --
      // a duplicate must not look like a fresh commitment.
      res.status(result.duplicate ? 200 : 201).json({
        ...result,
        charged: false,
        note: result.duplicate
          ? 'You are already a member of this plan.'
          : 'Membership recorded. No payment provider is connected, so this cycle is recorded, not charged.'
      });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/subscriptions/:id/unsubscribe', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json(subscription.unsubscribe(req.params.id, me));
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  // Who is subscribed. Creator-only for their own plan: a member list is not
  // public data.
  app.get('/api/subscriptions/:id/subscribers', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const sub = subscription.getSubscription(req.params.id);
    if (!sub) return res.status(404).json({ error: 'subscription not found' });
    if (sub.creatorId !== me) {
      return res.status(403).json({ error: 'only the creator may see who is subscribed' });
    }
    res.json({ subscribers: subscription.listSubscribers({ subscriptionId: sub.id }) });
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
