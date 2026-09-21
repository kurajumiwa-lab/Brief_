// ---------------------------------------------------------------------------
// SETTLEMENT ROUTES
//
//   Admin routes (session-gated; see the gate note below):
//     GET  /api/settlement/pending         — the manual queue
//     POST /api/settlement/:id/sent        — mark a payout sent
//     POST /api/settlement/:id/received    — mark a collection received
//     POST /api/settlement/:id/failed      — mark an attempt failed
//     GET  /api/settlement/state           — the active rail's state
//     GET  /api/settlement/escalations     — open escalations
//
//   User routes:
//     GET  /api/settlement/me/:id          — read one attempt (if it's theirs)
//
// GATE NOTE (honest, not hidden): the tree has no admin-role middleware
// today — the shared gate is the session (requireAuthMw from
// routes/helpers.js), and the global /api middleware already refuses
// unauthenticated calls on every non-public path. "Admin" is therefore
// "a signed-in caller" until a role exists; that is a named gap, recorded
// here rather than papered over with a fake role check.
//
// None of these routes move money. They record that a human did.
// ---------------------------------------------------------------------------

import { requireAuthMw } from '../routes/helpers.js';
import { callerId } from '../identity.js';
import { store } from '../store.js';
import * as dispatcher from './dispatcher.js';
import { RAIL_STATES, RAIL_DIRECTIONS } from './rail.js';

export function register(app) {
  // The active rail's state — what rail is installed and what it supports.
  app.get('/api/settlement/state', requireAuthMw, (_req, res) => {
    res.json({
      activeRail: dispatcher.getActiveRailName(),
      configured: dispatcher.isConfigured(),
      supportsManualConfirmation: dispatcher.supportsManualConfirmation(),
    });
  });

  // The manual queue. Only returns in_flight attempts.
  app.get('/api/settlement/pending', requireAuthMw, (_req, res) => {
    const attempts = store
      .filter('settlementAttempts', (a) => a.status === RAIL_STATES.IN_FLIGHT)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    res.json({
      attempts: attempts.map((a) => ({
        id: a.id,
        rail: a.rail,
        direction: a.direction,
        amount: a.amount,
        currency: a.currency,
        recipient: a.recipient,
        payer: a.payer,
        reference: a.reference,
        note: a.note,
        createdAt: a.createdAt,
      })),
    });
  });

  // Mark a payout sent. Money left the account.
  app.post('/api/settlement/:id/sent', requireAuthMw, async (req, res) => {
    const { providerRef = null, note = null } = req.body ?? {};
    const attempt = await dispatcher.getAttempt(req.params.id);
    if (!attempt) return res.status(404).json({ error: 'attempt not found' });
    if (attempt.direction !== RAIL_DIRECTIONS.OUT) {
      return res.status(400).json({ error: 'only outbound attempts can be marked sent' });
    }
    const result = await dispatcher.markSent(req.params.id, {
      providerRef,
      note,
      by: callerId(req) ?? 'signed-in-caller',
    });
    if (result.status === 'refused') return res.status(400).json(result);
    res.json(result);
  });

  // Mark a collection received.
  app.post('/api/settlement/:id/received', requireAuthMw, async (req, res) => {
    const { providerRef = null, note = null } = req.body ?? {};
    const attempt = await dispatcher.getAttempt(req.params.id);
    if (!attempt) return res.status(404).json({ error: 'attempt not found' });
    if (attempt.direction !== RAIL_DIRECTIONS.IN) {
      return res.status(400).json({ error: 'only inbound attempts can be marked received' });
    }
    const result = await dispatcher.markReceived(req.params.id, {
      providerRef,
      note,
      by: callerId(req) ?? 'signed-in-caller',
    });
    if (result.status === 'refused') return res.status(400).json(result);
    res.json(result);
  });

  // Mark an attempt failed. A reason is required — a silent failure is how
  // money quietly disappears from the queue without anyone saying why.
  app.post('/api/settlement/:id/failed', requireAuthMw, async (req, res) => {
    const { reason } = req.body ?? {};
    if (!reason) return res.status(400).json({ error: 'reason is required' });
    const result = await dispatcher.markFailed(req.params.id, {
      reason,
      by: callerId(req) ?? 'signed-in-caller',
    });
    if (result.status === 'refused') return res.status(400).json(result);
    res.json(result);
  });

  // Open escalations from the reconciler.
  app.get('/api/settlement/escalations', requireAuthMw, (_req, res) => {
    const open = store.filter('settlementEscalations', (e) => e.status === 'open');
    res.json({ escalations: open });
  });

  // A caller can read an attempt that references them.
  app.get('/api/settlement/me/:id', requireAuthMw, async (req, res) => {
    const attempt = await dispatcher.getAttempt(req.params.id);
    if (!attempt) return res.status(404).json({ error: 'attempt not found' });
    const userId = callerId(req);
    const mine =
      (attempt.recipient && attempt.recipient === userId) ||
      (attempt.payer && attempt.payer === userId) ||
      (attempt.reference && String(attempt.reference).endsWith(userId));
    if (!mine) return res.status(403).json({ error: 'not your attempt' });
    res.json({
      id: attempt.id,
      status: attempt.status,
      direction: attempt.direction,
      amount: attempt.amount,
      currency: attempt.currency,
      providerRef: attempt.providerRef,
      createdAt: attempt.createdAt,
      completedAt: attempt.completedAt,
    });
  });
}
