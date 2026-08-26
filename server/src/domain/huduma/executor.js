// ---------------------------------------------------------------------------
// HUDUMALINK — EXECUTION LAYER (headless automation + runner dispatch)
//
// This is the seam that turns a PAID order into a delivered result. The
// blueprint describes two fulfilment loops:
//
//   SOFTWARE  a headless browser (Puppeteer/Playwright) logs into the target
//             portal with the encrypted eCitizen token, performs the action,
//             compiles a PDF and returns it.
//   RUNNER    the task is broadcast to a verified field operator who collects
//             the physical artefact and uploads a geotagged, metadata-stripped
//             photo.
//
// HONEST SCOPE (the same posture as every other connector in this codebase):
//
//   Neither the headless portal automation nor the runner dispatch PWA is
//   connected here. Wiring Puppeteer against eCitizen, and standing up the
//   runner network, are real integrations with credentials and physical
//   logistics; stubbing them would let money release against a pretend result.
//
//   So the default executor FAILS: it returns { ok:false, reason:
//   'executor_not_configured' }, the order stays in RUNNING, and escrow stays
//   LOCKED — the citizen's money is held, never silently "completed". The
//   seam is registered, testable (an injected executor completes the flow),
//   and ready for a real implementation to drop in without touching the router.
//
// SAFETY INVARIANT the router relies on:
//   completeOrder() only releases escrow when the executor returns a concrete
//   document artefact (url + signature hash). A not-configured executor
//   returns no artefact, so it can never release money.
// ---------------------------------------------------------------------------

import { beginExecution, completeOrder } from './orders.js';

// Pluggable. Set via registerExecutor() (e.g. a real Puppeteer/runner module
// at boot). While null, the layer honestly reports it cannot fulfil.
let activeExecutor = null;

export function registerExecutor(impl) {
  activeExecutor = impl;
}

export function isConfigured() {
  return activeExecutor !== null;
}

/**
 * Drive an order from PAID -> RUNNING -> (COMPLETED | still RUNNING).
 *
 * Returns one of:
 *   { ok:true,  orderId, status:'COMPLETED', document }
 *   { ok:false, orderId, status:'RUNNING',  reason:'executor_not_configured' }
 *   { ok:false, orderId, status:'RUNNING',  reason:<executor reason> }
 *
 * On a real completion the executor must supply { url, signatureHash }. The
 * content hash is what proves the delivered PDF is the one the platform
 * stamped — replaying it later recomputes to the same value.
 */
export function execute(orderId) {
  // PAID -> RUNNING is unconditional and immediate: the order has been paid
  // for, so the citizen expects work to begin. What is NOT unconditional is
  // completion: that waits on a real artefact.
  beginExecution(orderId);

  if (!activeExecutor) {
    return { ok: false, orderId, status: 'RUNNING', reason: 'executor_not_configured' };
  }

  const result = activeExecutor(orderId);
  if (!result || !result.ok) {
    return { ok: false, orderId, status: 'RUNNING', reason: result?.reason ?? 'executor_failed' };
  }
  if (!result.document || !result.document.url || !result.document.signatureHash) {
    return { ok: false, orderId, status: 'RUNNING', reason: 'executor_returned_no_artefact' };
  }

  const order = completeOrder(orderId, {
    document: result.document,
    executorRef: result.executorRef ?? null
  });
  return { ok: true, orderId, status: 'COMPLETED', document: order.document };
}
