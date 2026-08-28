// OPS ROUTES — extracted from index.js (zero behaviour change).
// Each route keeps its original body verbatim; only its home file changed.
import { store } from '../store.js';
import { callerId, PLATFORM_ROLES } from '../identity.js';
import * as ops from '../ops.js';
import * as ledger from '../domain/ledger.js';
import * as settlement from '../domain/settlement.js';
import * as payment from '../domain/payment.js';
import * as analytics from '../domain/analytics.js';
import * as trust from '../domain/trust.js';
import * as seed from '../domain/seed.js';
import { requireAuth, requireCap, recordAudit } from './helpers.js';

export function register(app) {
/**
 * Operational diagnostics. Authenticated: it names which credentials are
 * absent, which is useful to an operator and to nobody else.
 */

app.get('/api/ops/diagnostics', (req, res) => {
  if (!requireCap(req, res, 'ops.read')) return;
  res.json({
    startup: ops.startupDiagnostics({ store, capabilities: { payments: ledger.providerStatus() } }),
    readiness: ops.readiness({ store, reconcilers: [
      { name: 'settlement', run: () => settlement.reconcile() },
      { name: 'payments', run: () => payment.reconcileIntents() }
    ] }),
    counts: Object.fromEntries(
      ['objects', 'orders', 'ledgerTransactions', 'paymentIntents', 'payouts', 'signals', 'users', 'sessions']
        .map((c) => [c, store.all(c).length])
    ),
    // Failed jobs and rejected webhooks, which is where silent breakage hides.
    recentErrors: store.all('errors').slice(-20),
    rejectedCallbacks: store.all('paymentCallbacks').filter((c) => !c.accepted).slice(-10).length
  });
});


/** Take a backup on demand. Atomic-write store, so a copy is consistent. */

app.post('/api/ops/backup', (req, res) => {
  const me = requireCap(req, res, 'ops.run');
  if (!me) return;
  const result = ops.backup(store);
  if (result.ok) recordAudit('ops.backup', { actorId: me, objectType: 'store', objectId: result.file, after: { size: result.size } });
  if (!result.ok) return res.status(400).json(result);
  res.json({ ...result, pruned: ops.pruneBackups(store) });
});


// --- Analytics + operations (host/operator) ---------------------------------


app.get('/api/ops/analytics', (req, res) => {
  if (!requireCap(req, res, 'ops.read')) return;
  res.json({ analytics: analytics.dashboard() });
});



app.get('/api/ops/reports', (req, res) => {
  if (!requireCap(req, res, 'ops.read')) return;
  res.json({ reports: trust.openReports() });
});



app.post('/api/ops/reports/:id/resolve', (req, res) => {
  const me = requireCap(req, res, 'moderate');
  if (!me) return;
  try {
    const report = trust.resolveReport(req.params.id, me, req.body?.action ?? 'dismiss');
    recordAudit('ops.report.resolve', { actorId: me, objectType: 'report', objectId: req.params.id, after: { status: report?.status ?? null }, reason: req.body?.reason ?? null });
    res.json({ report });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});



app.get('/api/ops/contributors', (req, res) => {
  if (!requireCap(req, res, 'ops.read')) return;
  res.json({ contributors: trust.contributorLeaderboard() });
});



app.get('/api/ops/unverified', (req, res) => {
  if (!requireCap(req, res, 'ops.read')) return;
  res.json({ objects: store.filter('objects', (o) => o.verificationStatus === 'unverified' && o.publication !== 'removed') });
});


/**
 * Seed / clear demo content IN-PROCESS. The CLI script wrote to a data file
 * that the running server (which holds the store in memory) never re-reads, so
 * on the deployed site the data never appeared. These routes run the seed
 * against the live in-memory store, so it is visible immediately.
 *
 * Authenticated (the local bootstrapped account counts), and the seed is
 * clearly-tagged, removable, and creates no money — a harmless demo affordance,
 * not a privileged surface.
 */

app.post('/api/ops/seed', (req, res) => {
  const me = requireCap(req, res, 'admin');
  if (!me) return;
  const seeded = seed.runSeed();
  recordAudit('ops.seed', { actorId: me, objectType: 'store', after: { seeded: seeded?.length ?? seeded } });
  res.json({ seeded });
});



/**
 * The append-only audit trail, newest first. Every consequential operator
 * action lands here via recordAudit(). Readable by any operator role because
 * the question it answers -- "who did what, when" -- is not privileged.
 */
app.get('/api/ops/audit', (req, res) => {
  if (!requireCap(req, res, 'ops.read')) return;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const rows = store.all('auditLog').slice(-limit).reverse();
  res.json({ audit: rows, total: store.all('auditLog').length });
});

/**
 * Assign or clear platform roles for a user. Admin-only, audited with
 * before/after. Roles are never read from this request for authorisation --
 * only written to the target user's own row.
 */
app.post('/api/ops/roles', (req, res) => {
  const me = requireCap(req, res, 'admin');
  if (!me) return;
  const userId = String(req.body?.userId ?? '').trim();
  const roles = Array.isArray(req.body?.roles) ? req.body.roles : [];
  const valid = [...new Set(roles.map(String))].filter((r) => PLATFORM_ROLES.includes(r));
  const user = store.find('users', (u) => u.id === userId || u.handle === userId);
  if (!user) return res.status(404).json({ error: 'user not found' });
  const before = Array.isArray(user.platformRoles) ? user.platformRoles : [];
  store.update('users', user.id, { platformRoles: valid });
  recordAudit('ops.roles.set', {
    actorId: me, objectType: 'user', objectId: user.id,
    before: { platformRoles: before }, after: { platformRoles: valid },
    reason: req.body?.reason ?? null
  });
  res.json({ user: { id: user.id, handle: user.handle, platformRoles: valid } });
});

app.post('/api/ops/seed/clear', (req, res) => {
  const me = requireCap(req, res, 'admin');
  if (!me) return;
  const cleared = seed.clearSeed();
  recordAudit('ops.seed.clear', { actorId: me, objectType: 'store', after: { cleared: cleared?.length ?? cleared } });
  res.json({ cleared });
});
}

