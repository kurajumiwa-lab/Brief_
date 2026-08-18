// ---------------------------------------------------------------------------
// WEBHOOK PROCESSOR – Reliable, retry, recovery
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';

const MAX_RETRIES = 5;
const INITIAL_DELAY_MS = 1000;
const BACKOFF_FACTOR = 2;

let webhookQueue = [];
let isProcessing = false;

export function enqueueWebhook({ eventType, eventId, payload, attempt = 0 }) {
  const existing = webhookQueue.find(j => j.eventId === eventId && j.eventType === eventType);
  if (existing) return;
  webhookQueue.push({ eventType, eventId, payload, attempt, enqueuedAt: new Date().toISOString() });
  if (!isProcessing) processQueue();
}

async function processQueue() {
  if (isProcessing || webhookQueue.length === 0) return;
  isProcessing = true;
  while (webhookQueue.length > 0) {
    const job = webhookQueue.shift();
    try {
      await processWebhookJob(job);
    } catch (err) {
      console.error(`Webhook processing failed (attempt ${job.attempt + 1}):`, err.message);
      if (job.attempt < MAX_RETRIES) {
        const delay = INITIAL_DELAY_MS * Math.pow(BACKOFF_FACTOR, job.attempt);
        setTimeout(() => {
          enqueueWebhook({ ...job, attempt: job.attempt + 1 });
        }, delay);
      } else {
        createRecoveryRecord({
          eventType: job.eventType,
          eventId: job.eventId,
          originalPayload: job.payload,
          error: err.message || String(err),
          attempts: job.attempt + 1,
          status: 'open'
        });
        const event = store.find('webhookEvents', e => e.id === job.eventId);
        if (event) {
          event.status = 'failed';
          event.error = err.message || String(err);
          store.update('webhookEvents', event.id, event);
        }
      }
    }
  }
  isProcessing = false;
}

async function processWebhookJob(job) {
  const { eventType, eventId, payload } = job;
  const event = store.find('webhookEvents', e => e.id === eventId);
  if (!event) throw new Error(`Webhook event ${eventId} not found`);
  if (event.processed) return;

  let handler;
  switch (eventType) {
    case 'payment':
      const { handlePaymentWebhook } = await import('../flows/handle-payment-webhook.js');
      handler = handlePaymentWebhook;
      break;
    case 'disbursement':
      const { handleDisbursementWebhook } = await import('../flows/handle-disbursement-webhook.js');
      handler = handleDisbursementWebhook;
      break;
    default:
      throw new Error(`Unknown webhook type: ${eventType}`);
  }

  const result = await handler({
    idempotencyKey: `${eventType}:${eventId}`,
    webhookPayload: payload,
    paymentMethod: 'simulated'
  });

  if (!result || result.success === false) {
    throw new Error(result?.error || 'Handler returned failure');
  }

  event.processed = true;
  event.processedAt = new Date().toISOString();
  event.result = result;
  store.update('webhookEvents', eventId, event);
}

function createRecoveryRecord(data) {
  const record = {
    id: newId('rec'),
    ...data,
    status: data.status || 'open',
    createdAt: new Date().toISOString()
  };
  store.insert('recoveryRecords', record);
  return record;
}

export function flushWebhookQueue() {
  webhookQueue = [];
  isProcessing = false;
}