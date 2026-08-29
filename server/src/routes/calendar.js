// ---------------------------------------------------------------------------
// CALENDAR + WAIT-LIST ROUTES (Yard Engine)
// ---------------------------------------------------------------------------

import * as calendar from '../domain/calendar.js';
import * as campaigns from '../domain/campaign.js';
import { requireAuth, requireCap, recordAudit } from './helpers.js';
import { requireFeature } from '../features.js';

export function register(app) {
  app.use('/api/calendar', requireFeature('calendar'));
  app.use('/api/waitlist', requireFeature('calendar'));

  app.get('/api/calendar', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ entries: calendar.listEntries({ actorId: me, kind: req.query.kind ?? null, status: req.query.status ?? null }) });
  });

  app.post('/api/calendar', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.status(201).json({ entry: calendar.createEntry(me, req.body ?? {}) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/calendar/sweep', (req, res) => {
    const me = requireCap(req, res, 'ops.run');
    if (!me) return;
    const result = calendar.sweep();
    recordAudit('calendar.sweep', { actorId: me, objectType: 'calendar', after: result });
    res.json(result);
  });

  app.get('/api/calendar/campaigns/:campaignId/waitlist', (req, res) => {
    const campaign = campaigns.getPublicBySlug(req.params.campaignId);
    if (!campaign) return res.status(404).json({ error: 'campaign not found' });
    res.json({ waitlist: calendar.listWaitlist(campaign.id) });
  });

  app.post('/api/calendar/campaigns/:campaignId/waitlist', (req, res) => {
    const campaign = campaigns.getPublicBySlug(req.params.campaignId);
    if (!campaign) return res.status(404).json({ error: 'campaign not found' });
    try {
      res.status(201).json(calendar.joinWaitlist({
        campaignId: campaign.id,
        attendeeRef: req.body?.attendeeRef,
        name: req.body?.name ?? null,
        contact: req.body?.contact ?? null,
        userId: req.auth?.userId ?? null
      }));
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/waitlist/:id/accept', (req, res) => {
    // Anonymous guests prove an offer with attendeeRef; authenticated users are
    // bound to the user id. The domain enforces the exact match.
    try {
      const result = calendar.acceptOffer(req.params.id, {
        attendeeRef: req.body?.attendeeRef ?? null,
        userId: req.auth?.userId ?? null
      });
      res.status(201).json(result);
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });
}
