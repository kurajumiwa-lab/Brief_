// CHAMA ROUTES — the table-banking ledger + calculator. A chama is a TOOL an
// existing group applies to itself; Brief is not the chama and not the lender.
import * as chama from '../domain/chama.js';
import { requireAuth, requireCap } from './helpers.js';
import { requireFeature } from '../features.js';
import { callerId } from '../identity.js';

export function register(app) {
  app.use('/api/chama', requireFeature('chama'));
  app.use('/api/me/chamas', requireFeature('chama'));
  app.use('/api/chamas', requireFeature('chama'));

  // The member's own chamas.
  app.get('/api/me/chamas', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ chamas: chama.listChamas(me).map((c) => ({ ...c, summary: chama.summary(c.id) })) });
  });

  // Create a chama (the owner is the first member + secretary/maker).
  app.post('/api/chamas', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const created = chama.createChama({
        ownerId: me,
        name: req.body?.name,
        contributionAmount: req.body?.contributionAmount,
        currency: req.body?.currency ?? 'KES',
        cycleDays: req.body?.cycleDays ?? 30,
        latePenaltyKes: req.body?.latePenaltyKes ?? 0
      });
      res.status(201).json({ chama: { ...created, summary: chama.summary(created.id) } });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Join a chama (the group's own members; no discovery, no directory).
  app.post('/api/chamas/:id/join', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const joined = chama.joinChama(req.params.id, me);
      res.json({ chama: { ...joined, summary: chama.summary(joined.id) } });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Summary + rotation + member's own view (the indicators).
  app.get('/api/chamas/:id', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const c = chama.getChama(req.params.id);
      if (!c) return res.status(404).json({ error: 'chama not found', code: 'not_found' });
      if (!c.members.some((m) => m.userId === me)) return res.status(403).json({ error: 'you are not a member', code: 'not_member' });
      res.json({
        chama: c,
        summary: chama.summary(c.id),
        rotation: chama.rotationView(c.id),
        me: chama.memberView(c.id, me)
      });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Record a contribution (member attestation with receipt hash).
  app.post('/api/chamas/:id/contributions', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const row = chama.recordContribution(req.params.id, me, {
        amount: req.body?.amount,
        receiptHash: req.body?.receiptHash ?? null,
        idempotencyKey: req.body?.idempotencyKey ?? null
      });
      res.status(201).json({ contribution: row, summary: chama.summary(req.params.id) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Rotation actions.
  app.post('/api/chamas/:id/rotate', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      chama.advanceTurn(req.params.id, me);
      res.json({ rotation: chama.rotationView(req.params.id) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });
  app.post('/api/chamas/:id/skip', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      chama.skipTurn(req.params.id, req.body?.memberId ?? me);
      res.json({ rotation: chama.rotationView(req.params.id) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Loans.
  app.post('/api/chamas/:id/loans', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const loan = chama.applyLoan(req.params.id, me, {
        principal: req.body?.principal,
        interestType: req.body?.interestType ?? 'flat',
        ratePercent: req.body?.ratePercent ?? 0,
        termMonths: req.body?.termMonths,
        guarantorsRequired: req.body?.guarantorsRequired ?? 0
      });
      res.status(201).json({ loan, schedule: chama.loanSchedule(loan.id) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });
  app.get('/api/chama-loans/:id/schedule', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ schedule: chama.loanSchedule(req.params.id), balance: chama.outstandingBalance(req.params.id) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });
  app.post('/api/chama-loans/:id/guarantee', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ loan: chama.signGuarantee(req.params.id, me) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });
  app.post('/api/chama-loans/:id/approve', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ loan: chama.approveLoan(req.params.id, me) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });
  app.post('/api/chama-loans/:id/repay', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const row = chama.recordRepayment(req.params.id, {
        amount: req.body?.amount,
        receiptHash: req.body?.receiptHash ?? null,
        idempotencyKey: req.body?.idempotencyKey ?? null
      });
      res.status(201).json({ repayment: row, balance: chama.outstandingBalance(req.params.id) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Payouts (maker-checker).
  app.post('/api/chamas/:id/payouts', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const payout = chama.requestPayout(req.params.id, req.body?.memberId, me, { amount: req.body?.amount, cycle: req.body?.cycle ?? null });
      res.status(201).json({ payout });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });
  app.post('/api/chama-payouts/:id/confirm', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ payout: chama.confirmPayout(req.params.id, me) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Operator read (moderate) — never a public directory.
  app.get('/api/ops/chamas', (req, res) => {
    if (!requireCap(req, res, 'moderate')) return;
    res.json({ chamas: chama.listChamas(callerId(req)).map((c) => ({ ...c, summary: chama.summary(c.id) })) });
  });
}
