// LIPA MDOGO ROUTES — asset-financing records + collection (not lending).
// Contracts are records created against a licensed lender partner; collection
// goes through the same STK rail as every payment; the lender owns the risk.
import * as lipaMdogo from '../domain/lipaMdogo.js';
import { requireAuth, requireCap } from './helpers.js';
import { requireFeature } from '../features.js';
import { callerId } from '../identity.js';

export function register(app) {
  app.use('/api/lipa-mdogo', requireFeature('lipa_mdogo'));

  // The member's own contracts + derived state (customer/vendor/lender view).
  app.get('/api/me/lipa-mdogo', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const rows = lipaMdogo.listFor(me).map((c) => lipaMdogo.contractState(c.id));
    res.json({ contracts: rows });
  });

  // Create a contract. Any authenticated member may initiate (e.g. the vendor
  // offering a gadget, or the lender), but the lender must be licensed.
  app.post('/api/lipa-mdogo/contracts', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const contract = lipaMdogo.createContract({
        lenderId: req.body?.lenderId,
        vendorId: req.body?.vendorId ?? null,
        customerId: req.body?.customerId ?? me,
        asset: req.body?.asset ?? {},
        totalValue: req.body?.totalValue,
        downPayment: req.body?.downPayment ?? 0,
        termMonths: req.body?.termMonths,
        nationalIdHash: req.body?.nationalIdHash ?? null,
        hubVerificationStamp: req.body?.hubVerificationStamp ?? null,
        onboardingRiderId: req.body?.onboardingRiderId ?? null
      });
      res.status(201).json({ contract: lipaMdogo.contractState(contract.id) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // One contract's derived state (owner/lender scoped).
  app.get('/api/lipa-mdogo/contracts/:id', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const c = lipaMdogo.getContract(req.params.id);
    if (!c) return res.status(404).json({ error: 'contract not found', code: 'not_found' });
    if (![c.customerId, c.vendorId, c.lenderId].includes(me)) {
      return res.status(403).json({ error: 'you are not a party to this contract', code: 'forbidden' });
    }
    res.json({ contract: lipaMdogo.contractState(c.id) });
  });

  // Collect one installment via the STK rail. Honest 503 without a provider.
  app.post('/api/lipa-mdogo/contracts/:id/collect', async (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const result = await lipaMdogo.requestCollection(req.params.id, req.body?.installmentIndex, {
        phone: req.body?.phone ?? null,
        idempotencyKey: req.body?.idempotencyKey ?? null
      });
      res.json({ charged: result.charged, duplicate: result.duplicate ?? false, payment: result.payment });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Operator list (moderate).
  app.get('/api/ops/lipa-mdogo', (req, res) => {
    if (!requireCap(req, res, 'moderate')) return;
    res.json({ contracts: lipaMdogo.listAll().map((c) => lipaMdogo.contractState(c.id)) });
  });
}
