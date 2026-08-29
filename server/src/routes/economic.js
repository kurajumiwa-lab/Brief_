// ECONOMIC ROUTES — extracted from index.js (zero behaviour change).
// Each route keeps its original body verbatim; only its home file changed.
import { store } from '../store.js';
import { callerId, isCoordinator } from '../identity.js';
import * as ledger from '../domain/ledger.js';
import * as campaigns from '../domain/campaign.js';
import * as signals from '../domain/signal.js';
import * as settlement from '../domain/settlement.js';
import * as payment from '../domain/payment.js';
import { requireAuth, requireCap } from './helpers.js';

import { requireFeature } from '../features.js';

export function register(app) {
app.use('/api/economic', requireFeature('economic'));
app.use('/api/transactions', requireFeature('economic'));
// A wallet is personal. It requires a caller and folds only the rows that
// caller is the counterparty on (see ledger.walletBalance). The anonymous
// platform-wide fold this route used to return was neither authenticated nor
// anyone's actual balance.
app.get('/api/economic/wallet', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  res.json(ledger.walletBalance(String(req.query?.currency || 'KES'), me));
});



// The ledger a user reads is their own: rows where they are the
// counterparty. The full platform ledger is an operator view behind the
// finance capability, not a default feed.
app.get('/api/transactions', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  res.json({
    transactions: ledger.listTransactions({ limit: Math.min(Number(req.query.limit) || 50, 200), userId: me }),
    provider: ledger.providerStatus()
  });
});



app.post('/api/transactions', (req, res) => {
  // AUTHORIZATION. ledgerTransactions is the single source of economic truth,
  // so a row must always have someone behind it. An anonymous POST used to
  // succeed with `counterparty: null`, which is an economic fact with no
  // actor -- unattributable and unauditable.
  if (!requireAuth(req, res)) return;
  const { amount, currency, type, description, counterparty, circleId, objectId, campaignId, registrationId } = req.body ?? {};
  // A caller may record money against their own name. Attributing a payment to
  // somebody else inside a circle is a coordinator act -- otherwise anyone
  // could inflate another person's contribution record.
  const me = callerId(req);
  if (counterparty && counterparty !== me && circleId && !isCoordinator(store, req, circleId)) {
    return res.status(403).json({
      error: 'only a coordinator may record a transaction for another user'
    });
  }
  try {
    const tx = ledger.createTransaction({
      amount: Number(amount), currency, type, description, counterparty, circleId, objectId, campaignId, registrationId
    });
    res.status(201).json({ transaction: tx });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});



app.post('/api/transactions/:id/transition', (req, res) => {
  // AUTHORIZATION. Moving money through states is the most consequential
  // write in the product -- settling promotes a registration and releases a
  // spot -- so it is never an anonymous act.
  if (!requireAuth(req, res)) return;
  try {
    const tx = ledger.transitionTransaction(req.params.id, req.body?.status, req.body?.note ?? '');
    // A held spot becomes a real registration only when money actually
    // settles. Derived from the authoritative transaction row, not a claim.
    if (tx.status === 'settled') campaigns.promoteRegistrationForSettledTransaction(tx);
    // A refund releases the spot it paid for. Reuses the existing cancelled
    // state; adds no new registration concept.
    if (tx.status === 'refunded') campaigns.demoteRegistrationForRefundedTransaction(tx);
    // A target only moves when money actually settles.
    if (tx.status === 'settled' && tx.circleId) {
      signals.emitSignal({
        type: 'target_progressed',
        circleId: tx.circleId,
        value: tx.amount,
        metadata: { transactionId: tx.id, currency: tx.currency }
      });
    }
    res.json({ transaction: tx });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});


/** Payment reconciliation. Operator visibility over provider references. */

app.get('/api/economic/payments/reconcile', (req, res) => {
  if (!requireCap(req, res, 'finance')) return;
  if (!requireAuth(req, res)) return;
  res.json({ reconciliation: payment.reconcileIntents() });
});



app.get('/api/economic/reconcile', (req, res) => {
  if (!requireCap(req, res, 'finance')) return;
  res.json({ reconciliation: settlement.reconcile() });
});
}

