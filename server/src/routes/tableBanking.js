// TABLE BANKING ROUTES — the table-banking ledger + calculator. A group is a TOOL an
// existing group applies to itself; Brief is not the group and not the lender.
import * as tableBanking from '../domain/tableBanking.js';
import { requireAuth, requireCap } from './helpers.js';
import { requireFeature } from '../features.js';
import { callerId } from '../identity.js';

export function register(app) {
  app.use('/api/table-banking', requireFeature('table_banking'));
  app.use('/api/me/table-banking', requireFeature('table_banking'));
  app.use('/api/table-banking', requireFeature('table_banking'));

  // The member's own groups.
  app.get('/api/me/table-banking', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ groups: tableBanking.listTableBanking(me).map((c) => ({ ...c, summary: tableBanking.summary(c.id) })) });
  });

  // Create a table-banking group (the owner is the first member + secretary/maker).
  app.post('/api/table-banking', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const created = tableBanking.createTableBanking({
        ownerId: me,
        name: req.body?.name,
        contributionAmount: req.body?.contributionAmount,
        currency: req.body?.currency ?? 'KES',
        cycleDays: req.body?.cycleDays ?? 30,
        latePenaltyKes: req.body?.latePenaltyKes ?? 0
      });
      res.status(201).json({ group: { ...created, summary: tableBanking.summary(created.id) } });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Join a group (the group's own members; no discovery, no directory).
  app.post('/api/table-banking/:id/join', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const joined = tableBanking.joinTableBanking(req.params.id, me);
      res.json({ group: { ...joined, summary: tableBanking.summary(joined.id) } });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Summary + rotation + member's own view (the indicators).
  app.get('/api/table-banking/:id', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const c = tableBanking.getTableBanking(req.params.id);
      if (!c) return res.status(404).json({ error: 'group not found', code: 'not_found' });
      if (!c.members.some((m) => m.userId === me)) return res.status(403).json({ error: 'you are not a member', code: 'not_member' });
      res.json({
        group: c,
        summary: tableBanking.summary(c.id),
        rotation: tableBanking.rotationView(c.id),
        me: tableBanking.memberView(c.id, me)
      });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Record a contribution (member attestation with receipt hash).
  app.post('/api/table-banking/:id/contributions', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const row = tableBanking.recordContribution(req.params.id, me, {
        amount: req.body?.amount,
        receiptHash: req.body?.receiptHash ?? null,
        idempotencyKey: req.body?.idempotencyKey ?? null
      });
      res.status(201).json({ contribution: row, summary: tableBanking.summary(req.params.id) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Rotation actions.
  app.post('/api/table-banking/:id/rotate', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      tableBanking.advanceTurn(req.params.id, me);
      res.json({ rotation: tableBanking.rotationView(req.params.id) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });
  app.post('/api/table-banking/:id/skip', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      tableBanking.skipTurn(req.params.id, req.body?.memberId ?? me);
      res.json({ rotation: tableBanking.rotationView(req.params.id) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Collective demand — a group places a bulk Request riding the economic chain.
  app.get('/api/table-banking/:id/requests', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ collective: tableBanking.listCollectiveRequests(req.params.id) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });
  app.post('/api/table-banking/:id/requests', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const result = tableBanking.placeCollectiveRequest(req.params.id, me, req.body ?? {});
      res.status(201).json(result);
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Loans.
  app.post('/api/table-banking/:id/loans', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const loan = tableBanking.applyLoan(req.params.id, me, {
        principal: req.body?.principal,
        interestType: req.body?.interestType ?? 'flat',
        ratePercent: req.body?.ratePercent ?? 0,
        termMonths: req.body?.termMonths,
        guarantorsRequired: req.body?.guarantorsRequired ?? 0
      });
      res.status(201).json({ loan, schedule: tableBanking.loanSchedule(loan.id) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });
  app.get('/api/table-banking-loans/:id/schedule', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ schedule: tableBanking.loanSchedule(req.params.id), balance: tableBanking.outstandingBalance(req.params.id) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });
  app.post('/api/table-banking-loans/:id/guarantee', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ loan: tableBanking.signGuarantee(req.params.id, me) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });
  app.post('/api/table-banking-loans/:id/approve', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ loan: tableBanking.approveLoan(req.params.id, me) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });
  app.post('/api/table-banking-loans/:id/repay', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const row = tableBanking.recordRepayment(req.params.id, {
        amount: req.body?.amount,
        receiptHash: req.body?.receiptHash ?? null,
        idempotencyKey: req.body?.idempotencyKey ?? null
      });
      res.status(201).json({ repayment: row, balance: tableBanking.outstandingBalance(req.params.id) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Payouts (maker-checker).
  app.post('/api/table-banking/:id/payouts', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const payout = tableBanking.requestPayout(req.params.id, req.body?.memberId, me, { amount: req.body?.amount, cycle: req.body?.cycle ?? null });
      res.status(201).json({ payout });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });
  app.post('/api/table-banking-payouts/:id/confirm', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ payout: tableBanking.confirmPayout(req.params.id, me) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Operator read (moderate) — never a public directory.
  app.get('/api/ops/table-banking', (req, res) => {
    if (!requireCap(req, res, 'moderate')) return;
    res.json({ groups: tableBanking.listTableBanking(callerId(req)).map((c) => ({ ...c, summary: tableBanking.summary(c.id) })) });
  });
}
