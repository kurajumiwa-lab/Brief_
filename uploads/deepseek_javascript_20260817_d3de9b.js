// ---------------------------------------------------------------------------
// HANDLE PAYMENT WEBHOOK – Reliable, idempotent
// ---------------------------------------------------------------------------

import { store } from '../store.js';
import { executeCommand } from '../commands/command-engine.js';
import { transitionTransaction } from '../engine/transaction.js';
import { holdPayment } from '../clearing/clearing.js';
import { confirmReservation, releaseReservation } from '../inventory/inventory.js';
import { getPaymentAdapter } from '../payment/adapter.js';

export async function handlePaymentWebhook({ idempotencyKey, webhookPayload, paymentMethod = 'simulated' }) {
  const providerTxId = webhookPayload.providerTransactionId || webhookPayload.transactionId || 'unknown';
  const key = `${idempotencyKey}:${providerTxId}`;

  return await executeCommand(key, 'paymentWebhook', { webhookPayload }, async () => {
    const adapter = getPaymentAdapter(paymentMethod);
    const result = await adapter.handlePaymentWebhook(webhookPayload);

    if (!result.success) {
      throw new Error(`Webhook validation failed: ${result.error}`);
    }

    const paymentRequest = store.find('paymentRequests', r => r.id === webhookPayload.requestId);
    if (!paymentRequest) {
      throw new Error(`Payment request ${webhookPayload.requestId} not found`);
    }

    const tx = store.find('transactions', t => t.id === paymentRequest.reference);
    if (!tx) {
      throw new Error(`Transaction ${paymentRequest.reference} not found`);
    }

    // ---- Provider says payment failed (business failure) ----
    if (result.status === 'failed') {
      if (tx.reservationId) {
        releaseReservation(tx.reservationId);
      }
      transitionTransaction(tx.id, 'failed');
      return { success: false, status: 'failed', reason: result.error };
    }

    // ---- Provider says payment succeeded ----
    if (paymentRequest.amount !== tx.amount) {
      throw new Error(`Amount mismatch: expected ${tx.amount}, got ${paymentRequest.amount}`);
    }

    if (tx.status === 'payment_confirmed' || tx.status === 'held') {
      return { success: true, orderId: tx.id, status: tx.status };
    }

    transitionTransaction(tx.id, 'payment_confirmed');

    const clearing = holdPayment({
      amount: tx.amount,
      currency: tx.currency,
      customerId: tx.metadata?.customerId,
      orderId: tx.id,
      description: `Purchase of drop ${tx.metadata?.dropId}`
    });

    if (tx.reservationId) {
      confirmReservation(tx.reservationId);
    }

    store.update('transactions', tx.id, {
      clearingId: clearing.id,
      paymentConfirmedAt: new Date().toISOString(),
      providerTransactionId: paymentRequest.providerTransactionId || providerTxId
    });

    transitionTransaction(tx.id, 'held');

    return {
      success: true,
      orderId: tx.id,
      status: 'held',
      amount: tx.amount,
      providerTransactionId: paymentRequest.providerTransactionId
    };
  });
}