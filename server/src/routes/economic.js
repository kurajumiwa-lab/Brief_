// ECONOMIC ROUTES — extracted from index.js (zero behaviour change).
// Each route keeps its original body verbatim; only its home file changed.
import { store } from '../store.js';
import { callerId, isCoordinator } from '../identity.js';
import * as ledger from '../domain/ledger.js';
import * as campaigns from '../domain/campaign.js';
import * as signals from '../domain/signal.js';
import * as settlement from '../domain/settlement.js';
import * as payment from '../domain/payment.js';
import { requireAuth } from './helpers.js';

export function register(app) {
app.get('/api/economic/wallet', (req, res) => {
  res.json(ledger.walletBalance(String(req.query?.currency || 'KES')));
});



app.get('/api/transactions', (req, res) => {
  res.json({
    transactions: ledger.listTransactions({ limit: Math.min(Number(req.query.limit) || 50, 200) }),
    provider: ledger.providerStatus()
  });
});



app.post('/api/transactions', (req, res) => {
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
  if (!requireAuth(req, res)) return;
  res.json({ reconciliation: payment.reconcileIntents() });
});



app.get('/api/economic/reconcile', (_req, res) => {
  res.json({ reconciliation: settlement.reconcile() });
});
}

