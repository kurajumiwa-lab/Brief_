// ---------------------------------------------------------------------------
// YARD ENGINE ADVERTISING ROUTES
// ---------------------------------------------------------------------------

import * as advertising from '../domain/advertising.js';
import { requireAuth } from './helpers.js';
import { requireFeature } from '../features.js';

export function register(app) {
  app.use('/api/advertising', requireFeature('advertising'));
  app.use('/api/advertising/matches', requireFeature('matching'));
  app.use('/api/advertising/assets', requireFeature('ad_assets'));
  app.use('/api/public/ad', requireFeature('ad_assets'));

  app.get('/api/advertising/advertiser', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ advertiser: advertising.getMyAdvertiserProfile(me) });
  });

  app.patch('/api/advertising/advertiser', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ advertiser: advertising.updateAdvertiserProfile(me, req.body ?? {}) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.get('/api/advertising/campaigns', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ campaigns: advertising.listCampaigns({ actorId: me, status: req.query.status ?? null }) });
  });

  app.post('/api/advertising/campaigns', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.status(201).json({ campaign: advertising.createCampaign(me, req.body ?? {}) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.get('/api/advertising/campaigns/:id', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const campaign = advertising.getCampaign(req.params.id, me);
    if (!campaign) return res.status(404).json({ error: 'advertiser campaign not found' });
    res.json({ campaign });
  });

  app.patch('/api/advertising/campaigns/:id', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ campaign: advertising.updateCampaign(req.params.id, me, req.body ?? {}) });
    } catch (e) {
      const message = String(e.message ?? e);
      res.status(/not found|only the advertiser/i.test(message) ? 404 : 400).json({ error: message });
    }
  });

  app.post('/api/advertising/campaigns/:id/submit', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ campaign: advertising.submitCampaign(req.params.id, me) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  /** Manual funding is an explicit advertiser attestation, never an auto-success. */
  app.post('/api/advertising/campaigns/:id/confirm-funding', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json(advertising.confirmFunding(req.params.id, me, {
        confirmation: req.body?.confirmation === true,
        reference: req.body?.reference ?? null
      }));
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/advertising/campaigns/:id/allocate', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json(advertising.allocate(req.params.id, me));
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.get('/api/advertising/campaigns/:id/matches', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    if (!advertising.getCampaign(req.params.id, me)) return res.status(404).json({ error: 'advertiser campaign not found' });
    res.json({ matches: advertising.listMatches({ advertiserCampaignId: req.params.id }).map((match) => advertising.matchViewForRoute(match)) });
  });

  app.get('/api/advertising/matches/mine', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ matches: advertising.listMatches({ actorId: me }).map((match) => advertising.matchViewForRoute(match)) });
  });

  app.post('/api/advertising/matches/:id/accept', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ match: advertising.acceptMatch(req.params.id, me) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/advertising/matches/:id/decline', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ match: advertising.declineMatch(req.params.id, me) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/advertising/matches/:id/verify-fulfillment', async (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const result = await advertising.verifyFulfillment(req.params.id, me, {
        performanceVerified: req.body?.performanceVerified === true,
        proofUrl: req.body?.proofUrl ?? null
      });
      res.status(result.settlement?.ok ? 200 : 202).json(result);
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/advertising/matches/:id/retry-settlement', async (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const result = await advertising.retrySettlement(req.params.id, me);
      res.status(result.ok ? 200 : 202).json(result);
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.get('/api/advertising/assets', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ assets: advertising.listAssets({ actorId: me, advertiserCampaignId: req.query.advertiserCampaignId ?? null }) });
  });

  app.post('/api/advertising/assets', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.status(201).json({ asset: advertising.createAsset(me, req.body ?? {}) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/advertising/assets/:id/approve', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ asset: advertising.approveAsset(req.params.id, me) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/advertising/assets/:id/issue', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ asset: advertising.issueAsset(req.params.id, me) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.get('/api/advertising/assets/:id/distribution-kit', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ kit: advertising.distributionKit(req.params.id, me) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  /** Public tracked redirect: records the click before leaving Brief. */
  app.get('/api/public/ad/:trackingHash', (req, res) => {
    const hit = advertising.recordAssetClick(req.params.trackingHash, {
      source: req.query.utm_source ?? 'public',
      medium: req.query.utm_medium ?? 'asset'
    });
    if (!hit) return res.status(404).json({ error: 'ad asset not found' });
    let target = hit.asset.baseRedirectUrl;
    // Carry the verified asset key into a Brief campaign page so a later
    // registration can be attributed without trusting a client-supplied id.
    if (hit.asset.campaignId) {
      try {
        const url = new URL(target);
        url.searchParams.set('trackingHash', hit.asset.uniqueTrackingHash);
        target = url.toString();
      } catch { /* the asset was already URL-validated; keep the stored target */ }
    }
    return res.redirect(302, target);
  });
}
