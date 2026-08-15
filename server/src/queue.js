// ---------------------------------------------------------------------------
// ASYNC PROCESSING (spec 29) + RATE LIMITING (spec 31)
//
// An in-process queue with concurrency 1. Deliberately modest: webhooks must
// return 200 fast so the platform does not retry, while extraction happens
// after the response. Swapping this for BullMQ/Cloud Tasks later means
// replacing this file only.
//
// A failed job records the error and never takes the process down (spec 30).
// ---------------------------------------------------------------------------

import { store, newId } from './store.js';

const queue = [];
let running = false;
let processed = 0;

export function enqueue(name, fn) {
  queue.push({ name, fn });
  setImmediate(drain);
  return queue.length;
}

async function drain() {
  if (running) return;
  running = true;
  while (queue.length) {
    const job = queue.shift();
    try {
      await job.fn();
      processed++;
    } catch (err) {
      store.insert('errors', {
        id: newId('err'),
        scope: 'queue',
        job: job.name,
        message: String(err?.message ?? err),
        at: new Date().toISOString()
      });
    }
  }
  running = false;
}

/** Resolves once the queue is idle. Used by tests, not by routes. */
export async function drained() {
  while (running || queue.length) await new Promise((r) => setTimeout(r, 10));
}

export function queueStats() {
  return { pending: queue.length, running, processed };
}

// --- Rate limiting -----------------------------------------------------------
// Token bucket per key. Applied to outbound sync so Brief cannot hammer an
// external API, and to inbound webhooks as basic abuse protection.

const buckets = new Map();

export function allow(key, ratePerMin = 30, burst = 10) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: burst, last: now };
    buckets.set(key, b);
  }
  const refill = ((now - b.last) / 60000) * ratePerMin;
  b.tokens = Math.min(burst, b.tokens + refill);
  b.last = now;
  if (b.tokens < 1) {
    return { ok: false, retryAfterMs: Math.ceil(((1 - b.tokens) / ratePerMin) * 60000) };
  }
  b.tokens -= 1;
  return { ok: true };
}

/** Exponential backoff with jitter, for retrying an external call. */
export async function withBackoff(fn, { attempts = 3, baseMs = 300 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fn();
      if (res && res.ok === false && res.retryAfter) {
        await new Promise((r) => setTimeout(r, res.retryAfter * 1000));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      const wait = baseMs * 2 ** i + Math.random() * 100;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  if (lastErr) throw lastErr;
  return { ok: false, error: 'retries exhausted' };
}
