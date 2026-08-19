// ---------------------------------------------------------------------------
// CHECK-IN — the gate operating layer
//
// A ticket is a campaign REGISTRATION that carries an opaque `ticketCode`.
// (Campaign registration IS the ticketing path in Brief; there is no parallel
// ticket store, by design.) This module is the GATE's view of that lifecycle:
//
//   issued (started) → registered → confirmed → checked_in  (→ no_show / cancelled)
//
// WHAT THE GATE NEEDS
//   * scan/lookup a code → who is this, are they paid, have they already
//     entered?
//   * check a code in → exactly once, attributable, timestamped, capacity-safe
//   * honest refusals: not found, cancelled, unpaid, already in
//
// The actual state transition still goes through campaigns.setRegistrationStatus
// (the single place that enforces terminal-state and capacity rules and emits
// the campaign_checkin signal). This module only adds the GATE concerns that
// the organiser-facing path does not have: code lookup and operator
// attribution. It never invents an economic event — check-in is not money, and
// it touches no ledger row.
// ---------------------------------------------------------------------------

import { store } from '../store.js';
import * as campaigns from './campaign.js';
import * as vault from './vault.js';

/** The attendee's scannable code, normalised for loose keyboard entry. */
function normaliseCode(code) {
  return String(code ?? '').trim().toUpperCase().replace(/[\s-]+/g, '');
}

/** Look a ticket up by code. Returns null when no registration carries it. */
export function lookupTicket(code) {
  const normalised = normaliseCode(code);
  if (!normalised) return null;
  // Normalise the STORED code too: it is issued in a dashed display form but
  // the gate may type it without dashes, and the lookup must match either.
  return store.find('registrations', (r) => normaliseCode(r.ticketCode) === normalised) ?? null;
}

/**
 * The gate-safe projection of a ticket: what an operator may see without
 * reading the whole roster. Never leaks contact details or other attendees.
 */
export function ticketView(registration) {
  if (!registration) return null;
  const campaign = store.find('campaigns', (c) => c.id === registration.campaignId);
  return {
    code: registration.ticketCode,
    campaignId: registration.campaignId,
    campaignTitle: campaign?.title ?? null,
    name: registration.name ?? null,
    status: registration.status,
    paid: registration.status !== 'started', // a held (started) spot has no settled money
    checkedInAt: registration.checkedInAt ?? null,
    checkedInBy: registration.checkedInBy ?? null
  };
}

/**
 * Check a code in.
 *
 * Honest results, every one a real state — never a silent success:
 *   not_found          no registration carries that code
 *   cancelled          the ticket was cancelled and cannot be revived
 *   unpaid             the spot is held but no money has settled
 *   already_checked_in idempotent: re-scanning returns the original check-in
 *   checked_in         success — recorded with operator + timestamp
 */
export function checkIn(code, operatorId = null) {
  const registration = lookupTicket(code);
  if (!registration) return { ok: false, reason: 'not_found' };

  // Idempotent re-scan: the same attendee scanning twice must not count twice
  // and must not look like an error at the gate.
  if (registration.status === 'checked_in') {
    return { ok: true, already: true, registration, ticket: ticketView(registration) };
  }
  if (registration.status === 'cancelled') {
    return { ok: false, reason: 'cancelled', ticket: ticketView(registration) };
  }
  if (registration.status === 'started') {
    return { ok: false, reason: 'unpaid', ticket: ticketView(registration) };
  }

  // The transition itself is delegated so terminal-state and capacity rules
  // (and the campaign_checkin signal) stay in exactly one place.
  let updated;
  try {
    updated = campaigns.setRegistrationStatus(registration.id, 'checked_in');
  } catch (e) {
    // An illegal transition (e.g. a race to a terminal state) is refused, not
    // silently forced.
    return { ok: false, reason: 'invalid_transition', detail: String(e.message ?? e) };
  }

  // Attribution: who checked this person in and when. Recorded here, not in
  // the organiser path, because only the gate knows the operator.
  store.update('registrations', registration.id, {
    checkedInAt: new Date().toISOString(),
    checkedInBy: operatorId
  });

  // Any vault linking this campaign narrates the arrival, deduped by ticket
  // so a re-scan never double-records.
  vault.emitCampaignFootsteps(registration.campaignId, 'checked_in', {
    actorName: registration.name ?? null,
    dedupeKey: `checkin:${registration.id}`,
    metadata: { registrationId: registration.id, ticketCode: registration.ticketCode }
  });

  const final = store.find('registrations', (r) => r.id === registration.id);
  return { ok: true, registration: final, ticket: ticketView(final) };
}

/** How many have actually crossed the gate for a campaign, derived live. */
export function checkedInCount(campaignId) {
  return store.filter('registrations', (r) => r.campaignId === campaignId && r.status === 'checked_in').length;
}
