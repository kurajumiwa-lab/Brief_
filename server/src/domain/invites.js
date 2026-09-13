// ---------------------------------------------------------------------------
// INVITES — one primitive, nine rungs.
//
// Every onboarding in the system is an invite with a scope and a provenance:
//
//   invite {
//     issued_by:       user id           # who sent it
//     grants_role:     role              # partner | program_lead | cohort_anchor
//                                        # | circle_treasurer | circle_member
//                                        # | vendor | field_agent | auditor
//     grants_scope:    { kind, id }      # what the role is bounded to
//     attribution_key: partner→program→cohort   # provenance, immutable
//     expires_at:      timestamp         # mandatory — every invite dies
//     single_use:      bool              # privileged roles one-shot
//   }
//
// Rules that fall out of it (all enforced here):
//   * an invite can never grant a role broader than the issuer holds.
//   * an invite can never grant `operator` (operators are seeded, not invited).
//   * expiry is mandatory: no permanent links.
//   * redemption is one-shot for privileged roles; multi-use only for member
//     invites (a treasurer invites 14 people with one link).
//   * attribution is written once on redemption (first-touch-wins) and reused
//     from the existing attribution domain — never re-captured, never mutated.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import * as roles from './roles.js';
import * as attribution from './attribution.js';

// No operator invites. The first operator is seeded by whoever deploys.
export const INVITABLE_ROLES = [
  'partner', 'program_lead', 'cohort_anchor',
  'circle_treasurer', 'circle_member', 'vendor', 'field_agent', 'auditor'
];

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L

function newCode() {
  let s = '';
  for (let i = 0; i < 10; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

function fail(message, status = 400, code = 'validation_error') {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  throw e;
}

/** A role is multi-use only when it is a member invite; everything else is one-shot. */
function defaultSingleUse(grantsRole) {
  return grantsRole !== 'circle_member';
}

/**
 * Issue a scoped, expiring invite. `issuedBy` must hold a role at least as
 * broad as the one being granted.
 */
export function issueInvite({
  issuedBy,
  grantsRole,
  grantsScope,
  attributionKey = null,
  expiresAt = null,
  singleUse = null
}) {
  if (!issuedBy) fail('an issuer is required');
  if (grantsRole === 'operator') fail('operators are seeded, not invited', 403, 'forbidden');
  if (!INVITABLE_ROLES.includes(grantsRole)) fail(`cannot invite role ${grantsRole}`);

  // The broadening guard: the issuer must hold a role of rank >= the granted
  // role. An operator (rank 9) may invite anything below it.
  const issuerRoles = roles.rolesOf(issuedBy);
  const issuerRank = issuerRoles.length
    ? Math.max(...issuerRoles.map((r) => roles.rankOf(r.role)))
    : 0;
  if (issuerRank < roles.rankOf(grantsRole)) {
    fail('you cannot invite a role broader than your own', 403, 'role_breadth');
  }

  // Expiry is mandatory. Default 7 days, but a caller may shorten it.
  let expiry = expiresAt;
  if (!expiry) expiry = new Date(Date.now() + 7 * 86400000).toISOString();
  if (Date.parse(expiry) <= Date.now()) fail('an invite must expire in the future');

  const isSingle = singleUse === null ? defaultSingleUse(grantsRole) : Boolean(singleUse);
  const now = new Date().toISOString();
  const invite = store.insert('invites', {
    id: newId('inv'),
    code: newCode(),
    issuedBy,
    grantsRole,
    grantsScope: grantsScope ?? { kind: roles.ROLE_SCOPE_KIND[grantsRole] ?? 'scope', id: null },
    attributionKey: attributionKey ?? null,
    expiresAt: expiry,
    singleUse: isSingle,
    redeemedBy: null,
    createdAt: now
  });
  return invite;
}

/**
 * Redeem an invite. One-shot for privileged roles (a second redemption is
 * refused); member invites stay open until expiry. Attribution is captured
 * once and is immutable thereafter.
 */
export function redeemInvite({ code, redeemerId, attributionContext = {} }) {
  if (!code) fail('a code is required');
  if (!redeemerId) fail('a redeemer is required');
  const invite = store.find('invites', (i) => i.code === String(code).trim());
  if (!invite) fail('invite not found', 404, 'not_found');
  if (Date.parse(invite.expiresAt) <= Date.now()) fail('this invite has expired', 410, 'expired');
  if (invite.singleUse && invite.redeemedBy) fail('this invite has already been used', 409, 'already_used');

  // Attribute first-touch; a no-op if the member already has provenance.
  const ctx = { ...attributionContext };
  if (!ctx.inviteCode) ctx.inviteCode = invite.code;
  if (invite.attributionKey) {
    // The attribution key is a compact "partner→program→cohort" token; parse it
    // into the capture keys the attribution domain already understands.
    const parts = String(invite.attributionKey).split('→');
    if (!ctx.partnerKey && parts[0]) ctx.partnerKey = parts[0];
    if (!ctx.programKey && parts[1]) ctx.programKey = parts[1];
    if (!ctx.cohortKey && parts[2]) ctx.cohortKey = parts[2];
  }
  try { attribution.capture(redeemerId, ctx); } catch { /* attribution never blocks a redemption */ }

  // Grant the role, bounded to the invite's scope.
  const assignment = roles.assignRole({
    userId: redeemerId,
    role: invite.grantsRole,
    scopeKind: invite.grantsScope?.kind ?? null,
    scopeId: invite.grantsScope?.id ?? null,
    assignedBy: invite.issuedBy
  });

  if (invite.singleUse) {
    store.update('invites', invite.id, { redeemedBy: redeemerId });
  }

  return { invite: { ...invite, redeemedBy: invite.singleUse ? redeemerId : invite.redeemedBy }, role: assignment };
}

/** All invites, newest first (operator surface). */
export function listInvites() {
  return store.all('invites').slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
