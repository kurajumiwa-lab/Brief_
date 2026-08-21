// DISTRIBUTION ROUTES — campaign blast + UTM click capture (four-screen build B).
import { store } from '../store.js';
import { callerId } from '../identity.js';
import * as campaigns from '../domain/campaign.js';
import * as distribution from '../domain/distribution.js';
import { requireAuth } from './helpers.js';
import { requireFeature } from '../features.js';

export function register(app) {
  app.use('/api/campaigns/:id/blast', requireFeature('distribution'));
  app.use('/api/click', requireFeature('distribution'));

  /** Owner-only blast: wrap the campaign in UTM links and send per recipient. */
  app.post('/api/campaigns/:id/blast', async (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const c = store.find('campaigns', (x) => x.id === req.params.id);
    if (!c || c.ownerId !== me) return res.status(404).json({ error: 'campaign not found' });
    const result = await distribution.blast(c, {
      recipients: req.body?.recipients ?? [],
      message: req.body?.message ?? null,
      publicOrigin: process.env.BRIEF_PUBLIC_ORIGIN || null
    });
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  });

  /** Public click capture: record the UTM hit and redirect to the campaign. */
  app.get('/api/click', (req, res) => {
    const campaign = distribution.recordClick(req.query);
    if (!campaign) return res.status(404).json({ error: 'campaign not found' });
    const origin = process.env.BRIEF_PUBLIC_ORIGIN || null;
    const target = origin ? `${String(origin).replace(/\/+$/, '')}/c/${campaign.publicSlug}` : '/c/' + campaign.publicSlug;
    res.redirect(302, target);
  });
}
