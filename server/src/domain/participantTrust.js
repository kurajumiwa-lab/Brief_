// ---------------------------------------------------------------------------
// PARTICIPANT TRUST — Phase 7.
//
// Derives explainable, deterministic trust signals from canonical economic
// records. There is deliberately NO stored trust row, NO score, and NO rating:
// every figure below is recomputed on read from the canonical sources:
//
//   verificationRecords  (Phase 2 — scoped subject verification)
//   workOrders           (Phase 5 — completed/cancelled/disputed fulfillment)
//   procurements         (Phase 6 — repeat-procurement memory)
//
// This is the whole point: trust is a RECORD OF WHAT ACTUALLY HAPPENED, not a
// popularity contest. Nothing here can be typed into a profile, and a business
// cannot claim "verified" or "completed jobs" the system has not observed.
//
// Rules (deliberate, tested):
//   * Derived, never stored — always fresh, always idempotent (§16, §19, §23,
//     §26, §27).
//   * Scoped, never aggregate — a capability is verified, a sourcing role is
//     verified; there is no "Fully verified" unless a defined basis exists
//     (there is none, so none is produced) (§4).
//   * Explainable, never a score — statements like "12 Work Orders completed"
//     and "8 of 10 eligible completed by the agreed date", always with the
//     sample size visible (§6, §7, §8).
//   * Privacy-safe — aggregate counts only. No customer identities, no prices,
//     no private addresses, no confidential source relationships (§20, §11).
//   * Sourcing agents are legitimate participants; their trust evidence is a
//     sourcing-role verification + completed sourcing Work Orders, never a
//     manufacturer claim (§12).
// ---------------------------------------------------------------------------

import { store } from "../store.js";
import * as supply from "./supply.js";

const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// ECONOMIC HISTORY — derived from completed Work Orders (§5)
// ---------------------------------------------------------------------------

function workOrdersFor(participantId, capabilityId = null) {
  const rows = store.indexed("workOrders", "participantId", participantId);
  return capabilityId
    ? rows.filter((w) => w.capabilityId === capabilityId)
    : rows;
}

export function economicHistory(participantId, capabilityId = null) {
  const rows = workOrdersFor(participantId, capabilityId);
  const completed = rows.filter((w) => w.status === "completed");
  const cancelled = rows.filter((w) => w.status === "cancelled");
  const disputed = rows.filter((w) => w.status === "disputed");
  const requesterConfirmed = completed.filter(
    (w) => w.completion?.completedBy === w.requesterId,
  );

  let amendmentCount = 0;
  for (const w of rows) amendmentCount += (w.amendments ?? []).length;

  // On-time (§8): only completed Work Orders whose agreement carries an agreed
  // completion date and whose actual completion date exists. Cancelled/disputed
  // rows are excluded by construction (only `completed` is scanned). The sample
  // size is always returned alongside, never collapsed into a score.
  let onTimeEligible = 0;
  let onTime = 0;
  for (const w of completed) {
    const agreed = w.agreements.at(-1)?.terms?.estimatedCompletionDate ?? null;
    const actual = w.completedAt ?? null;
    if (agreed && actual) {
      onTimeEligible += 1;
      if (Date.parse(actual) <= Date.parse(`${agreed}T23:59:59.999+03:00`))
        onTime += 1;
    }
  }

  const businessesServed = new Set(completed.map((w) => w.requesterId)).size;
  const capabilitiesFulfilled = new Set(
    completed.map((w) => w.capabilityId),
  ).size;

  // Repeat relationships (§10): a business that returned to THIS participant
  // for >= 2 completed procurements. Counted from the Phase 6 procurement
  // memory, never exposed as identities.
  const procByOwner = new Map();
  for (const p of store.indexed("procurements", "participantId", participantId)) {
    procByOwner.set(p.ownerId, (procByOwner.get(p.ownerId) ?? 0) + 1);
  }
  const repeatRelationships = [...procByOwner.values()].filter((n) => n >= 2)
    .length;

  return {
    participantId,
    capabilityId,
    completedWorkOrders: completed.length,
    requesterConfirmedCompletions: requesterConfirmed.length,
    cancelledWorkOrders: cancelled.length,
    disputedWorkOrders: disputed.length,
    amendmentCount,
    repeatRelationships,
    businessesServed,
    capabilitiesFulfilled,
    onTime: { completed: onTime, eligible: onTimeEligible },
    limited: completed.length === 0,
  };
}

// ---------------------------------------------------------------------------
// RELIABILITY SIGNALS — explainable statements, never a score (§6, §7)
// ---------------------------------------------------------------------------

export function reliabilitySignals(participantId, capabilityId = null) {
  const h = economicHistory(participantId, capabilityId);
  if (h.limited) {
    return {
      participantId,
      capabilityId,
      limited: true,
      statements: ["Limited fulfillment history"],
      note: "This participant is new to Brief. There isn't enough completed-work history to show reliability signals yet.",
    };
  }
  const statements = [];
  if (h.completedWorkOrders)
    statements.push(
      `${h.completedWorkOrders} Work ${
        h.completedWorkOrders === 1 ? "Order" : "Orders"
      } completed`,
    );
  if (h.requesterConfirmedCompletions)
    statements.push(
      `${h.requesterConfirmedCompletions} requester-confirmed completion${
        h.requesterConfirmedCompletions === 1 ? "" : "s"
      }`,
    );
  if (h.repeatRelationships)
    statements.push(
      `${h.repeatRelationships} repeat procurement relationship${
        h.repeatRelationships === 1 ? "" : "s"
      }`,
    );
  if (h.businessesServed)
    statements.push(
      `${h.businessesServed} business${h.businessesServed === 1 ? "" : "es"} served`,
    );
  if (h.capabilitiesFulfilled)
    statements.push(
      `${h.capabilitiesFulfilled} capabilit${
        h.capabilitiesFulfilled === 1 ? "y" : "ies"
      } fulfilled`,
    );
  if (h.onTime.eligible > 0)
    statements.push(
      `${h.onTime.completed} of ${h.onTime.eligible} eligible Work ${
        h.onTime.eligible === 1 ? "Order" : "Orders"
      } completed by the agreed date`,
    );
  if (h.repeatRelationships > 0) statements.push("Repeat business recorded");
  return { participantId, capabilityId, limited: false, statements, note: null };
}

// ---------------------------------------------------------------------------
// VERIFICATION — scoped, reused from Phase 2 (§3, §4)
// ---------------------------------------------------------------------------

function scopedStanding(participantId, kind, capabilityId = null) {
  const s = supply.standing(participantId, kind, capabilityId);
  // Provenance path: verification claim -> verification record -> verifier
  // timestamp -> expiry (§13). The verifier identity is the reviewer id.
  let reviewedBy = null;
  if (s.status === "verified" || s.status === "expired") {
    const rec = store
      .indexed("verificationRecords", "participantId", participantId)
      .filter(
        (r) =>
          r.scope === "supply" &&
          r.kind === kind &&
          (r.capabilityId ?? null) === capabilityId,
      )
      .at(-1);
    reviewedBy = rec?.reviewedBy ?? null;
  }
  return {
    kind,
    status: s.status, // unverified|submitted|under_review|verified|rejected|expired
    verifiedAt: s.verifiedAt,
    expiresAt: s.expiresAt,
    method: s.method,
    reviewedBy,
  };
}

export function verificationSummary(participantId) {
  return {
    identity: scopedStanding(participantId, "identity"),
    businessType: scopedStanding(participantId, "business_type"),
    sourcingRole: scopedStanding(participantId, "sourcing_role"),
  };
}

// ---------------------------------------------------------------------------
// CAPABILITY TRUST — contextual, never one universal reputation (§11)
// ---------------------------------------------------------------------------

export function capabilityTrust(participantId, capabilityId) {
  // Fail closed: only a publicly visible, active capability has public trust.
  // Throws "not found" for archived/invisible/nonexistent capabilities, which
  // the route surfaces as an honest 404 rather than an empty profile.
  const capability = supply.getCapability(null, capabilityId);
  if (capability.participantId !== participantId)
    supply.rawEnterprise(participantId); // throws "not found" if the id is fake
  const name = capability.name;
  return {
    participantId,
    capabilityId,
    capabilityName: name,
    verification: scopedStanding(participantId, "capability", capabilityId),
    history: economicHistory(participantId, capabilityId),
    signals: reliabilitySignals(participantId, capabilityId),
  };
}

export function capabilityTrusts(participantId) {
  const ids = new Set();
  for (const w of store.indexed("workOrders", "participantId", participantId)) {
    if (w.capabilityId) ids.add(w.capabilityId);
  }
  // Also include every current capability so a participant with history on a
  // now-archived capability still gets an honest "capability not yet verified"
  // state on the live set.
  try {
    const ent = supply.getEnterprise(null, participantId, {
      includeCapabilities: true,
    });
    for (const c of ent.capabilities ?? []) ids.add(c.id);
  } catch {
    /* not publicly visible */
  }
  return [...ids].map((id) => capabilityTrust(participantId, id));
}

// ---------------------------------------------------------------------------
// PROFILE + DECISION CONTEXT — privacy-safe aggregates (§24, §25)
// ---------------------------------------------------------------------------

export function trustProfile(participantId) {
  // Fail closed: only a publicly visible enterprise has a public trust
  // profile. A nonexistent or non-public participant is "not found", never an
  // empty-but-valid-looking profile.
  supply.getEnterprise(null, participantId, { includeCapabilities: false });
  return {
    participantId,
    verification: verificationSummary(participantId),
    history: economicHistory(participantId),
    signals: reliabilitySignals(participantId),
    capabilities: capabilityTrusts(participantId),
  };
}

/** Compact evidence for the supplier-decision context (matching + quotes). */
export function decisionContext(participantId, capabilityId = null) {
  const v = verificationSummary(participantId);
  const h = economicHistory(participantId, capabilityId);
  return {
    verifiedIdentity: v.identity.status === "verified",
    verifiedBusinessType: v.businessType.status === "verified",
    verifiedSourcingRole: v.sourcingRole.status === "verified",
    verifiedCapability: capabilityId
      ? scopedStanding(participantId, "capability", capabilityId).status ===
        "verified"
      : false,
    completedWorkOrders: h.completedWorkOrders,
    requesterConfirmedCompletions: h.requesterConfirmedCompletions,
    repeatRelationships: h.repeatRelationships,
    businessesServed: h.businessesServed,
    onTime: h.onTime,
    limited: h.limited,
    statements: reliabilitySignals(participantId, capabilityId).statements,
  };
}
