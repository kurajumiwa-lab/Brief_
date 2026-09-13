// ---------------------------------------------------------------------------
// ROLES + INVITES ROUTES — the membership hierarchy's authority surface.
//
// Issuing an invite is an act any authenticated role-holder may attempt; the
// DOMAIN enforces breadth (you cannot grant a role broader than your own, and
// nobody can invite an operator). Redeeming an invite binds the scoped role to
// the redeemer and captures immutable first-touch attribution. Listing invites
// is operator-gated (moderate).
// ---------------------------------------------------------------------------

import * as roles from '../domain/roles.js';
import * as invites from '../domain/invites.js';
import { requireAuth, requireCap } from './helpers.js';

export function register(app) {
  // The caller's own active role assignments — the client's view of authority.
  app.get('/api/me/roles', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ roles: roles.rolesOf(me) });
  });

  // Issue a scoped, expiring invite. The domain refuses a role broader than
  // the issuer holds, and refuses `operator` outright.
  app.post('/api/invites', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const invite = invites.issueInvite({
        issuedBy: me,
        grantsRole: req.body?.grantsRole,
        grantsScope: req.body?.grantsScope ?? null,
        attributionKey: req.body?.attributionKey ?? null,
        expiresAt: req.body?.expiresAt ?? null,
        singleUse: req.body?.singleUse ?? null
      });
      res.status(201).json({ invite });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Redeem an invite: bind the scoped role to the caller, capture attribution.
  app.post('/api/invites/redeem', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const result = invites.redeemInvite({
        code: req.body?.code,
        redeemerId: me,
        attributionContext: req.body?.attributionContext ?? {}
      });
      res.json(result);
    } catch (e) {
      res.status(e.status ?? 400).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  // Operator surface: every invite, newest first.
  app.get('/api/ops/invites', (req, res) => {
    if (!requireCap(req, res, 'moderate')) return;
    res.json({ invites: invites.listInvites() });
  });
}
