// ---------------------------------------------------------------------------
// FULFILMENT – With payout verification and disbursement accounting
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { executeCommand } from '../commands/command-engine.js';
import { transitionTransaction } from '../engine/transaction.js';
import { releasePayment } from '../clearing/clearing.js';
import { getPaymentAdapter } from '../payment/adapter.js';
import { updateTrust } from '../engine/trust.js';
import { updateArenaMetrics } from '../admin/economics.js';

export async function confirmFulfilment({ idempotencyKey, orderId, customerId, paymentMethod = 'simulated' }) {
  return await executeCommand(idempotencyKey, 'fulfilment', { orderId, customerId }, async () => {
    const order = store.find('transactions', t => t.id === orderId);
    if (!order) throw new Error('Order not found');
    if (order.status !== 'held') {
      throw new Error(`Order cannot be fulfilled from status: ${order.status}`);
    }
    if (order.metadata?.customerId !== customerId) {
      throw new Error('Customer mismatch');
    }

    transitionTransaction(orderId, 'fulfilled');
    transitionTransaction(orderId, 'split');

    const sellerId = order.sellerId;
    const sellerAmount = order.sellerAmount || Math.round(order.amount * 0.92);
    const briefAmount = order.briefAmount || Math.round(order.amount * 0.06);
    const processingAmount = order.processingAmount || Math.round(order.amount * 0.02);

    const clearing = store.find('clearingTransactions', c => c.id === order.clearingId);
    if (!clearing) throw new Error('Clearing transaction not found');

    releasePayment({
      clearingId: clearing.id,
      orderId,
      sellerId,
      sellerAmount,
      briefAmount,
      processingAmount,
      currency: order.currency || 'KES'
    });

    transitionTransaction(orderId, 'settlement_pending');

    const sellerPayoutProfile = store.find('payoutProfiles', p => p.sellerId === sellerId);
    if (!sellerPayoutProfile || !sellerPayoutProfile.verified || sellerPayoutProfile.status !== 'active') {
      transitionTransaction(orderId, 'recovery_required');
      store.insert('recoveryRecords', {
        id: newId('rec'),
        transactionId: orderId,
        stage: 'payout_verification_failed',
        originalError: 'Seller payout profile is not verified/active',
        sellerId,
        amount: sellerAmount,
        status: 'open',
        createdAt: new Date().toISOString()
      });
      throw new Error(`Seller payout profile is not verified/active for seller ${sellerId}`);
    }

    const adapter = getPaymentAdapter(paymentMethod);
    const disbursement = await adapter.requestDisbursement({
      amount: sellerAmount,
      currency: order.currency || 'KES',
      recipient: sellerPayoutProfile.account,
      reference: orderId,
      description: `Disbursement for order ${orderId}`
    });

    if (!disbursement.success) {
      transitionTransaction(orderId, 'recovery_required');
      store.insert('disbursementAttempts', {
        id: newId('datt'),
        orderId,
        sellerId,
        amount: sellerAmount,
        attemptNumber: 1,
        status: 'failed',
        error: disbursement.error,
        createdAt: new Date().toISOString()
      });
      throw new Error(`Disbursement request failed: ${disbursement.error}`);
    }

    transitionTransaction(orderId, 'disbursement_pending');

    store.update('transactions', orderId, {
      disbursementId: disbursement.disbursementId,
      disbursementStatus: 'pending',
      payoutProfileId: sellerPayoutProfile.id
    });

    store.insert('disbursementAttempts', {
      id: newId('datt'),
      orderId,
      sellerId,
      amount: sellerAmount,
      disbursementId: disbursement.disbursementId,
      attemptNumber: 1,
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    const dropId = order.metadata?.dropId;
    if (dropId) {
      const drop = store.find('drops', d => d.id === dropId);
      if (drop && drop.remaining === 0 && drop.status === 'active') {
        drop.status = 'fulfilled';
        drop.fulfilledAt = new Date().toISOString();
        store.update('drops', dropId, drop);
      }
    }

    updateTrust(sellerId, { type: 'seller_fulfilled', orderId });
    updateTrust(customerId, { type: 'buyer_confirmed', orderId });

    return {
      success: true,
      orderId,
      status: 'disbursement_pending',
      disbursementId: disbursement.disbursementId,
      sellerAmount
    };
  });
}