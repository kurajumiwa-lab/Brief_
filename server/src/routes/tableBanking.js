// TABLE BANKING ROUTES — the table-banking ledger + calculator. A group is a TOOL an
// existing group applies to itself; Brief is not the group and not the lender.
import * as tableBanking from '../domain/tableBanking.js';
import * as quoteVotes from '../domain/quoteVotes.js';
import * as outbound from '../outbound.js';
import { requireAuth, requireCap } from './helpers.js';
import { requireFeature } from '../features.js';
import { callerId } from '../identity.js';

export function register(app) {
  app.use('/api/table-banking', requireFeature('table_banking'));
  app.use('/api/me/table-banking', requireFeature('table_banking'));

  // The member's own groups.
  app.get('/api/me/table-banking', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ groups: tableBanking.listTableBanking(me).map((c) => ({ ...c, summary: tableBanking.summary(c.id) })) });
  });

  // Templates — assisted replication: the presets a new group can start from.
  app.get('/api/table-banking/templates', (_req, res) => {
    res.json({ templates: tableBanking.listTemplates() });
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
        latePenaltyKes: req.body?.latePenaltyKes ?? 0,
        welfareContributionAmount: req.body?.welfareContributionAmount ?? 0,
        template: req.body?.template ?? null
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

  // WELFARE FUND — the group's own earmarked emergency pool. Not insurance:
  // the group's money, paid out by the group's vote. Nothing here moves money
  // through Brief; it records the group's agreement and the fund balance is
  // derived from contributions minus approved claims.
  app.get('/api/table-banking/:id/welfare', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ fund: tableBanking.welfareFund(req.params.id), claims: tableBanking.listWelfareClaims(req.params.id) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  app.post('/api/table-banking/:id/welfare/contributions', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const row = tableBanking.recordWelfareContribution(req.params.id, me, {
        amount: req.body?.amount,
        receiptHash: req.body?.receiptHash ?? null,
        idempotencyKey: req.body?.idempotencyKey ?? null
      });
      res.status(201).json({ contribution: row, fund: tableBanking.welfareFund(req.params.id) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  app.post('/api/table-banking/:id/welfare/claims', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const claim = tableBanking.fileWelfareClaim(req.params.id, me, {
        reason: req.body?.reason,
        amount: req.body?.amount
      });
      res.status(201).json({ claim, fund: tableBanking.welfareFund(req.params.id) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  app.post('/api/table-banking/:id/welfare/claims/:claimId/vote', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const claim = tableBanking.voteOnWelfareClaim(req.params.claimId, me, req.body?.approve === true);
      res.json({ claim, fund: tableBanking.welfareFund(claim.tableBankingId) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // MEETING MINUTES — the group's own record of decisions, kept by members.
  app.get('/api/table-banking/:id/minutes', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ minutes: tableBanking.listMinutes(req.params.id) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  app.post('/api/table-banking/:id/minutes', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const row = tableBanking.recordMinutes(req.params.id, me, {
        title: req.body?.title,
        body: req.body?.body,
        decisions: req.body?.decisions ?? null,
        actionItems: req.body?.actionItems ?? null,
        heldAt: req.body?.heldAt ?? null
      });
      res.status(201).json({ minutes: row });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // JOIN INVITES — the treasurer adds a member by phone; the member confirms
  // by replying YES <code>. The outbound message is attempted here and is
  // fail-closed: with no provider configured, the invite still exists and the
  // delivery is reported as a named refusal (never "sent").
  app.get('/api/table-banking/:id/invites', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ invites: tableBanking.listInvites(req.params.id) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  app.post('/api/table-banking/:id/invites', async (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const invite = tableBanking.issueJoinInvite(req.params.id, me, { phone: req.body?.phone, name: req.body?.name ?? null });
      // Attempt the send on the requested channel; fail closed when none is configured.
      let delivery = { ok: false, reason: 'not_attempted' };
      const channel = req.body?.channel;
      if (channel) {
        try { delivery = await outbound.send({ channel, to: invite.phone, text: invite.message }); }
        catch (e) { delivery = { ok: false, reason: String(e.message ?? e) }; }
      }
      res.status(201).json({ invite, delivery });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // The gateway webhook: a "YES <code>" reply resolves here. It is PUBLIC (a
  // Twilio/Meta callback carries no session) — the code is the credential.
  // Wiring an inbound WhatsApp/SMS router to POST here is a separate
  // integration; this endpoint is the honest seam it would call.
  app.post('/api/webhooks/table-banking-invites', (req, res) => {
    try {
      const invite = tableBanking.acceptJoinInvite(req.body?.code, req.body?.phone ?? null);
      res.json({ invite });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // QUOTE VOTES — the group decides which quote to accept for a collective
  // request. Votes are real rows; the accept reuses the normal quote path.
  app.get('/api/table-banking/:id/quotes', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ quotes: quoteVotes.listGroupQuotes(req.params.id) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  app.post('/api/table-banking/:id/quotes/:quoteId/vote', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ vote: quoteVotes.voteOnQuote(req.params.id, me, req.params.quoteId, req.body?.approve === true) });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  app.post('/api/table-banking/:id/quotes/:quoteId/accept', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ quote: quoteVotes.acceptQuoteByGroupVote(req.params.id, req.params.quoteId) });
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
