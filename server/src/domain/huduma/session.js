// ---------------------------------------------------------------------------
// HUDUMALINK — CONVERSATIONAL SESSION STATE MACHINE
//
// HudumaLink has no UI but a chat thread, so "where is this user in the flow?"
// is server state, not client state. A session row per phone tracks the
// current state and the small amount of context needed to resume: which
// category/service they are in, which free-text field they are being asked
// for, and the order id once one exists.
//
// STATES (the legal places a conversation can be):
//
//   MENU_ROOT        the top-level category buttons
//   MENU_CATEGORY    a list of services inside one category
//   AWAITING_INPUT   the bot asked a question and is waiting for free text;
//                    `awaitingField` names which input is expected, and
//                    `serviceId`/`categoryId` keep the resume context
//   AWAITING_PAYMENT an order exists; the STK push has fired; we are waiting
//                    on the M-Pesa callback (handled by the callback route)
//
// The router is the only writer here. Sessions are keyed by phone and expire
// after a period of inactivity (EXPIRES_MS) so a stale half-flow does not
// trap a returning user.
// ---------------------------------------------------------------------------

import { store } from '../../store.js';

export const STATES = {
  MENU_ROOT: 'MENU_ROOT',
  MENU_CATEGORY: 'MENU_CATEGORY',
  AWAITING_INPUT: 'AWAITING_INPUT',
  CONFIRMING_ORDER: 'CONFIRMING_ORDER',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT'
};

const EXPIRES_MS = 1000 * 60 * 30; // 30 minutes of inactivity

export function getSession(phone) {
  const s = store.find('hudumaSessions', (x) => x.phone === phone);
  if (!s) return freshSession(phone);
  // An expired session resets to the root menu rather than resuming a flow the
  // user has probably forgotten.
  if (Date.now() - new Date(s.updatedAt).getTime() > EXPIRES_MS) {
    return freshSession(phone);
  }
  return s;
}

function freshSession(phone) {
  return {
    phone,
    state: STATES.MENU_ROOT,
    categoryId: null,
    serviceId: null,
    awaitingField: null,
    capturedInputs: {},
    orderId: null,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Apply a transition. The caller passes the new state plus any context fields
 * that changed. Returns the persisted session. Writing the session is what
 * makes a conversational turn durable: a crash mid-flow resumes correctly.
 */
export function setSession(phone, patch) {
  const current = getSession(phone);
  const next = {
    ...current,
    ...patch,
    phone,
    updatedAt: new Date().toISOString()
  };
  const existing = store.find('hudumaSessions', (x) => x.phone === phone);
  if (existing) {
    store.update('hudumaSessions', existing.id, next);
  } else {
    store.insert('hudumaSessions', { id: `hses_${phone}`, ...next });
  }
  return store.find('hudumaSessions', (x) => x.phone === phone);
}

/** Reset to the root menu (used by the "back"/"cancel" actions). */
export function resetToRoot(phone) {
  return setSession(phone, {
    state: STATES.MENU_ROOT,
    categoryId: null,
    serviceId: null,
    awaitingField: null,
    capturedInputs: {},
    orderId: null
  });
}

export function captureInput(phone, key, value) {
  const s = getSession(phone);
  const capturedInputs = { ...(s.capturedInputs || {}), [key]: value };
  return setSession(phone, { capturedInputs });
}
