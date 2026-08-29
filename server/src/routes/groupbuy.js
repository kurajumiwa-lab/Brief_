// GROUP BUY ROUTES — the Chama & Group Buy package over the engine layer.
// The 3-field intake, the ledger stepper, and the stage controls. Tier
// guardrails (active-buy caps) are enforced server-side at creation.
import { callerId } from '../identity.js';
import { requireAuth, recordError } from './helpers.js';
import { requireFeature } from '../features.js';
import * as groupbuy from '../domain/groupbuy.js';
import * as bargainTiers from '../domain/bargainTiers.js';
import { guardrailFor } from '../domain/engine/tiers.js';

export function register(app) {
  app.use('/api/engine/group-buys', requireFeature('engine'));

  app.get('/api/engine/group-buys', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ groupBuys: groupbuy.listGroupBuys({ ownerId: me }) });
  });

  app.post('/api/engine/group-buys', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const guard = guardrailFor(me);
      const buy = groupbuy.createGroupBuy(
        {
          ownerId: me,
          title: req.body?.title,
          targetAmount: req.body?.targetAmount,
          note: req.body?.note ?? null
        },
        // Free: one active buy. Pro: five. Operator: unlimited.
        { maxActive: guard.caps.maxRoutes === null ? null : Math.max(1, guard.caps.maxRoutes) }
      );
      res.status(201).json({ groupBuy: groupbuy.getGroupBuy(buy.id) });
    } catch (e) {
      const status = e.code === 'tier_limit' ? 403 : 400;
      res.status(status).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  app.get('/api/engine/group-buys/:id', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const buy = groupbuy.getGroupBuy(req.params.id);
    if (!buy || buy.ownerId !== me) return res.status(404).json({ error: 'group buy not found' });
    // Priced bargains carry the honest price view: current band, the next
    // band and what it needs, and the price everyone settles at if it fills.
    res.json({ groupBuy: buy, bargain: bargainTiers.bargainView(buy) });
  });

  /** The 3-field contribution intake: member ref, amount, payment source. */
  app.post('/api/engine/group-buys/:id/contribute', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const result = groupbuy.contribute({
        groupBuyId: req.params.id,
        memberRef: req.body?.memberRef,
        amount: req.body?.amount,
        source: req.body?.source ?? 'mpesa'
      });
      res.status(201).json(result);
    } catch (e) {
      const msg = String(e.message ?? e);
      res.status(/not found/.test(msg) ? 404 : 400).json({ error: msg });
    }
  });

  /** Drive an explicit stepper stage (organiser act). */
  app.post('/api/engine/group-buys/:id/stage', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const buy = groupbuy.getGroupBuy(req.params.id);
    if (!buy || buy.ownerId !== me) return res.status(404).json({ error: 'group buy not found' });
    try {
      res.json({ groupBuy: groupbuy.advanceStage({ groupBuyId: req.params.id, to: req.body?.to, actorId: me }) });
    } catch (e) {
      const msg = String(e.message ?? e);
      res.status(/not found/.test(msg) ? 404 : 400).json({ error: msg });
    }
  });

  // --- T2: priced bargains (participant bands -> price ladder) ---------------

  app.post('/api/engine/group-buys/:id/pricing', (req, res) => {
    try {
      const buy = bargainTiers.priceGroupBuy(callerId(req), req.params.id, {
        tiers: req.body?.tiers,
        minParticipants: req.body?.minParticipants ?? null,
        maxParticipants: req.body?.maxParticipants ?? null,
        expiresAt: req.body?.expiresAt ?? null
      });
      res.json({ buy });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/engine/group-buys/:id/join', (req, res) => {
    try {
      // The price is derived server-side from the live count; nothing in the
      // body is a price.
      const { participant, changed } = bargainTiers.joinBargain(callerId(req), req.params.id);
      res.status(changed ? 201 : 200).json({ participant, changed });
    } catch (e) {
      const full = e.code === 'bargain_full';
      res.status(full ? 409 : 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  app.post('/api/engine/group-buys/:id/leave', (req, res) => {
    try {
      const { participant, changed } = bargainTiers.leaveBargain(callerId(req), req.params.id);
      res.json({ participant, changed });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });
}
