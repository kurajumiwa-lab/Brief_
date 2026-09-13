// ---------------------------------------------------------------------------
// ROLES — the role-on-scope resolver.
//
// Brief's authority model is NOT a nested "user → admin → super admin" tree.
// It is nine ADDITIVE roles, each bounded to a scope, resolved per-context:
//
//   operator        platform (break-glass)
//   partner         org            (their contracted org only)
//   program_lead    program        (one program under a partner)
//   cohort_anchor   cohort         (one cohort's members)
//   circle_treasurer circle        (one circle's ledger/members/rotation)
//   circle_member   circle         (self + own circle visibility)
//   vendor          self           (own supply profile + work orders)
//   field_agent     cohort         (onboard-on-behalf for an anchor)
//   auditor         program|cohort (read-only, scoped)
//
// Two things are deliberately SEPARATE:
//   * ATTRIBUTION (who brought you — partner/program/cohort/invite) is
//     first-touch-wins and immutable (domain/attribution.js).
//   * AUTHORITY (what you may do) is role-based and revocable (this module).
//   A partner whose contract ends loses AUTHORITY; the attribution history
//   stays intact, so historical economic figures do not shift.
//
// The resolver is a single function used everywhere, so scope is enforced in
// the QUERY ("where scope = mine"), never by hiding rows in the UI.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';

export const ROLES = [
  'operator', 'partner', 'program_lead', 'cohort_anchor',
  'circle_treasurer', 'circle_member', 'vendor', 'field_agent', 'auditor'
];

// Breadth of authority, used ONLY for the invite rule "you cannot grant a role
// broader than you hold". A higher rank may invite a lower rank; never the
// reverse. (Ordered by scope of authority, not seniority.)
export const ROLE_RANK = {
  operator: 9,
  partner: 8,
  program_lead: 7,
  cohort_anchor: 6,
  circle_treasurer: 5,
  field_agent: 5,   // onboards within an anchor's cohort, same breadth
  circle_member: 4,
  vendor: 3,
  auditor: 3        // read-only
};

// What kind of scope a role is bounded to. `auditor` carries whatever scope the
// invite named (program or cohort); everything else is fixed per role.
export const ROLE_SCOPE_KIND = {
  operator: 'platform',
  partner: 'org',
  program_lead: 'program',
  cohort_anchor: 'cohort',
  circle_treasurer: 'circle',
  circle_member: 'circle',
  vendor: 'self',
  field_agent: 'cohort',
  auditor: 'scope'   // resolved from the invite's grantsScope
};

export function rankOf(role) {
  return ROLE_RANK[role] ?? 0;
}

function fail(message, status = 400, code = 'validation_error') {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  throw e;
}

/**
 * Assign a scoped role to a user. Idempotent: assigning the same role+scope
 * twice is a no-op (returns the existing row, does not duplicate).
 */
export function assignRole({ userId, role, scopeKind, scopeId, assignedBy = null }) {
  if (!userId) fail('a user is required');
  if (!ROLES.includes(role)) fail(`role must be one of ${ROLES.join(', ')}`);
  if (role !== 'operator' && !scopeKind) fail(`the ${role} role needs a scope`);

  const kind = role === 'auditor' ? scopeKind : (ROLE_SCOPE_KIND[role] ?? scopeKind);
  const existing = store.find(
    'roleAssignments',
    (r) => r.userId === userId && r.role === role && r.scopeKind === kind && r.scopeId === (scopeId ?? null)
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  return store.insert('roleAssignments', {
    id: newId('rol'),
    userId,
    role,
    scopeKind: kind,
    scopeId: scopeId ?? null,
    assignedBy: assignedBy ?? null,
    createdAt: now,
    revokedAt: null
  });
}

/** Every active role assignment a user holds, as { role, scopeKind, scopeId }. */
export function rolesOf(userId) {
  return store
    .filter('roleAssignments', (r) => r.userId === userId && r.revokedAt === null)
    .map((r) => ({ role: r.role, scopeKind: r.scopeKind, scopeId: r.scopeId }));
}

/**
 * Does the user hold `role` (optionally bounded to a specific scope)?
 * The operator role passes for every other role: it is the break-glass rung.
 */
export function hasRole(userId, role, { scopeKind = null, scopeId = null } = {}) {
  const roles = rolesOf(userId);
  if (roles.some((r) => r.role === 'operator')) return true;
  if (role === 'operator') return roles.some((r) => r.role === 'operator');
  return roles.some((r) => {
    if (r.role !== role) return false;
    if (scopeKind && r.scopeKind !== scopeKind) return false;
    if (scopeId && r.scopeId !== scopeId) return false;
    return true;
  });
}

/** The canonical "may this actor do X in scope S?" — one function, everywhere. */
export function can(userId, role, { scopeKind = null, scopeId = null } = {}) {
  return hasRole(userId, role, { scopeKind, scopeId });
}

/**
 * The scope ids a user holds `role` for, of a given scope kind. This is the
 * "filtered in the query" primitive: a route reads rows WHERE scopeId ∈ these
 * ids, so a Cohort Anchor sees members where cohort = theirs — not a global
 * list filtered in the UI.
 */
export function scopeIdsFor(userId, role, scopeKind) {
  return rolesOf(userId)
    .filter((r) => r.role === role && r.scopeKind === scopeKind && r.scopeId)
    .map((r) => r.scopeId);
}

/** Revoke a role assignment (authority is revocable; attribution is not). */
export function revokeRole(assignmentId) {
  const row = store.find('roleAssignments', (r) => r.id === assignmentId);
  if (!row) return null;
  return store.update('roleAssignments', assignmentId, { revokedAt: new Date().toISOString() });
}
