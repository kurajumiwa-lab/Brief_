// REFERRALS ROUTES — codes, points, the honest rewards pool, conversions.
import { requireAuth, requireCap } from './helpers.js';
import * as referrals from '../domain/referrals.js';
import * as campaigns from '../domain/campaign.js';

export function register(app) {
  /** My referral surface: code, share links, derived balance, pool state. */
  app.get('/api/referrals/mine', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const base = process.env.BRIEF_PUBLIC_BASE ? String(process.env.BRIEF_PUBLIC_BASE).replace(/\/$/, '') : null;
    const link = base ? `${base}/?ref=${referrals.referralCodeOf(me)}` : `/?ref=${referrals.referralCodeOf(me)}`;
    res.json({
      code: referrals.referralCodeOf(me),
      maxDepth: referrals.MAX_REFERRAL_DEPTH,
      link,
      balance: referrals.pointsBalance(me),
      pool: referrals.rewardPool(),
      conversion: referrals.CONVERSION,
      points: referrals.POINTS,
      events: referrals.myEvents(me),
      conversions: referrals.myConversions(me)
    });
  });

  /** A styled WhatsApp share message for Brief itself or one of my events.
   *  WhatsApp posting is genuinely impossible from a server (CONNECTORS.md);
   *  the member shares, and traffic comes back through the ?via link. */
  app.get('/api/referrals/share', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const code = referrals.referralCodeOf(me);
    const base = process.env.BRIEF_PUBLIC_BASE ? String(process.env.BRIEF_PUBLIC_BASE).replace(/\/$/, '') : '';
    const slug = req.query?.slug ? String(req.query.slug) : null;
    let title = 'Brief';
    let body = 'what is happening around you — work, events, cooperation';
    let url = `${base}/?ref=${code}`;
    if (slug) {
      const c = campaigns.getPublicBySlug(slug);
      if (!c) return res.status(404).json({ error: 'campaign not found' });
      if (c.ownerId !== me) return res.status(403).json({ error: 'only the event owner can share with their code' });
      title = c.title;
      body = (c.description || '').slice(0, 80);
      url = `${base}/?ref=${code}&event=${encodeURIComponent(c.slug)}`;
    }
    const message = `*${title}*\n_${body}_\nJoin through my link:\n${url}`;
    res.json({
      code, slug, url, message,
      waMe: `https://wa.me/?text=${encodeURIComponent(message)}`
    });
  });

  app.post('/api/referrals/convert', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const row = referrals.requestConversion(me, req.body?.points);
      res.status(201).json({ conversion: row });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e) });
    }
  });

  // --- Finance (manual M-Pesa payout confirmation) --------------------------

  app.get('/api/referrals/all', (req, res) => {
    const me = requireCap(req, res, 'finance');
    if (!me) return;
    res.json({
      conversions: store_all_pending(), pool: referrals.rewardPool()
    });
  });

  app.post('/api/referrals/conversions/:id/respond', (req, res) => {
    const me = requireCap(req, res, 'finance');
    if (!me) return;
    try {
      const row = referrals.respondConversion(me, req.params.id, req.body ?? {});
      res.json({ conversion: row });
    } catch (e) {
      const msg = String(e.message ?? e);
      res.status(/not found/.test(msg) ? 404 : 400).json({ error: msg });
    }
  });
}

// All conversions for the finance queue (pending first).
import { store } from '../store.js';
function store_all_pending() {
  return store.all('referralConversions')
    .slice().sort((a, b) => ((a.status === 'pending') === (b.status === 'pending') ? (a.createdAt < b.createdAt ? 1 : -1) : (a.status === 'pending' ? -1 : 1)));
}
