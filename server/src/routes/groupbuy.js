// GROUP BUY ROUTES — the Chama & Group Buy package over the engine layer.
// The 3-field intake, the ledger stepper, and the stage controls. Tier
// guardrails (active-buy caps) are enforced server-side at creation.
import { callerId } from '../identity.js';
import { requireAuth, recordError } from './helpers.js';
import { requireFeature } from '../features.js';
import * as groupbuy from '../domain/groupbuy.js';
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
    res.json({ groupBuy: buy });
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
}
