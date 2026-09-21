// ---------------------------------------------------------------------------
// DISPATCHER — picks the active rail, forwards every call.
//
// This is the only file in the directory that imports a concrete rail.
// Everything else imports the dispatcher. When Buni's transfer contract
// lands, one import and one case are added here, and the buni entry WRAPS
// `connectors/buni.js` — one connector implementation, never a copy. Nothing
// else changes.
//
// At the time of writing, the manual rail is the only rail installed.
// ---------------------------------------------------------------------------

import * as manual from './manual.js';
import { refused } from './rail.js';

const RAILS = {
  manual,
};

// The active rail's name. Read from env so deployments can switch without a
// code change. Defaults to manual. An unknown name fails closed on every
// call — never a silent fallback to a rail the operator did not name.
const ACTIVE = (process.env.SETTLEMENT_RAIL || 'manual').toLowerCase();

export function getActiveRail() {
  return RAILS[ACTIVE] ?? null;
}

export function getActiveRailName() {
  return ACTIVE;
}

export function isConfigured() {
  const rail = getActiveRail();
  return rail ? rail.isConfigured() : false;
}

export function supportsManualConfirmation() {
  const rail = getActiveRail();
  return Boolean(rail?.supportsManualConfirmation);
}

export async function disburse(params) {
  const rail = getActiveRail();
  if (!rail) return refused(`no rail configured for "${ACTIVE}"`);
  if (!rail.isConfigured()) return refused(`rail "${ACTIVE}" is not configured`);
  return rail.disburse(params);
}

export async function collect(params) {
  const rail = getActiveRail();
  if (!rail) return refused(`no rail configured for "${ACTIVE}"`);
  if (!rail.isConfigured()) return refused(`rail "${ACTIVE}" is not configured`);
  return rail.collect(params);
}

export async function markSent(attemptId, opts) {
  const rail = getActiveRail();
  if (!rail?.supportsManualConfirmation) return refused('active rail does not support manual confirmation');
  return rail.markSent(attemptId, opts);
}

export async function markReceived(attemptId, opts) {
  const rail = getActiveRail();
  if (!rail?.supportsManualConfirmation) return refused('active rail does not support manual confirmation');
  return rail.markReceived(attemptId, opts);
}

export async function markFailed(attemptId, opts) {
  const rail = getActiveRail();
  if (!rail?.supportsManualConfirmation) return refused('active rail does not support manual confirmation');
  return rail.markFailed(attemptId, opts);
}

export async function getAttempt(attemptId) {
  return require_rail().getAttempt(attemptId);
}

export async function reconcile(params) {
  return require_rail().reconcile(params);
}

function require_rail() {
  const rail = getActiveRail();
  if (!rail) throw new Error(`no rail configured for "${ACTIVE}"`);
  return rail;
}
