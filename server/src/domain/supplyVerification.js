// Reuses verificationRecords and Brief's existing `moderate` reviewer authority.
// These checks are subject-scoped; a person/agent check never verifies a factory.
import { store, newId } from "../store.js";
import { hasCapability } from "../identity.js";
import * as supply from "./supply.js";
import * as v from "./supplyValidation.js";
export const STATES = [
  "unverified",
  "submitted",
  "under_review",
  "verified",
  "rejected",
  "expired",
];
export const KINDS = [
  "identity",
  "business_type",
  "sourcing_role",
  "capability",
  "capacity",
  "authorization",
];
export const EVIDENCE_TYPES = [
  "business_registration",
  "tax_identifier",
  "physical_location",
  "operating_evidence",
  "certification",
  "authorization",
  "supplier_relationship",
  "capability_evidence",
];
function reviewer(userId) {
  v.actor(userId);
  if (!hasCapability(userId, "moderate"))
    v.fail("Reviewer capability required", 403, "forbidden_capability");
}
function evidence(input, userId) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 8)
    v.fail("Attach between one and eight private evidence images");
  const seen = new Set();
  return input.map((e) => {
    v.fields(e, ["uploadId", "type", "note"], "evidence");
    if (seen.has(e.uploadId)) v.fail("Duplicate evidence");
    seen.add(e.uploadId);
    supply.cleanEvidence([{ uploadId: e.uploadId }], userId, true);
    return {
      uploadId: e.uploadId,
      type: v.choice(e.type, EVIDENCE_TYPES, "evidence type"),
      note: v.text(e.note ?? "", 500, "evidence note"),
    };
  });
}
function view(r) {
  const { fingerprint, ...row } = r;
  return structuredClone({
    ...row,
    effectiveStatus: supply.effectiveVerification(r),
  });
}
export function submit(userId, participantId, input) {
  const p = supply.ownEnterprise(userId, participantId);
  v.fields(
    input,
    ["kind", "capabilityId", "evidence", "note", "participantRevision"],
    "verification submission",
  );
  v.revision(p.enterprise, input.participantRevision);
  const kind = v.choice(input.kind, KINDS, "verification kind");
  const capabilityId = input.capabilityId ?? null;
  if (["capability", "capacity"].includes(kind)) {
    if (!capabilityId) v.fail("Choose a capability");
    const c = supply.rawCapability(capabilityId);
    if (c.participantId !== participantId || c.operatingStatus === "archived")
      v.fail("capability not found", 404, "not_found");
  } else if (capabilityId !== null)
    v.fail("This verification scope cannot reference a capability");
  if (kind === "sourcing_role" && p.enterprise.supplyRole === "direct_supplier")
    v.fail("A direct-only enterprise cannot submit an agent-role check");
  const proof = evidence(input.evidence, userId);
  const note = v.text(input.note ?? "", 1500, "private review note");
  const fingerprint = supply.subjectFingerprint(
    participantId,
    kind,
    capabilityId,
  );
  const current = store
    .filter(
      "verificationRecords",
      (r) =>
        r.scope === "supply" &&
        r.participantId === participantId &&
        r.kind === kind &&
        (r.capabilityId ?? null) === capabilityId,
    )
    .at(-1);
  if (
    current &&
    ["submitted", "under_review", "verified"].includes(
      supply.effectiveVerification(current),
    )
  ) {
    if (current.status === "verified")
      v.fail(
        "This subject is already verified. Update its details or wait until the check expires.",
        409,
        "invalid_transition",
      );
    return view(current); // retry cannot create a second pending submission
  }
  const e = v.event(userId, "verification_submitted");
  const row = store.insert("verificationRecords", {
    id: newId("sver"),
    scope: "supply",
    participantId,
    userId,
    kind,
    capabilityId,
    evidence: proof,
    note,
    status: "submitted",
    revision: 1,
    history: [e],
    fingerprint,
    submittedAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedAt: null,
    reason: null,
    expiresAt: null,
  });
  v.audit("supplyVerification", row.id, e, 1);
  return view(row);
}
export function myRecords(userId, participantId) {
  supply.ownEnterprise(userId, participantId);
  return store
    .filter(
      "verificationRecords",
      (r) => r.scope === "supply" && r.participantId === participantId,
    )
    .map(view)
    .reverse();
}
export function queue(userId) {
  reviewer(userId);
  return store
    .filter("verificationRecords", (r) => r.scope === "supply")
    .filter((r) =>
      ["submitted", "under_review"].includes(supply.effectiveVerification(r)),
    )
    .map(view);
}
export function record(userId, id) {
  const r = store.find(
    "verificationRecords",
    (r) => r.id === id && r.scope === "supply",
  );
  if (!r || (r.userId !== userId && !hasCapability(userId, "moderate")))
    v.fail("verification not found", 404, "not_found");
  return view(r);
}
export function review(userId, id, input) {
  reviewer(userId);
  const r = store.find(
    "verificationRecords",
    (r) => r.id === id && r.scope === "supply",
  );
  if (!r) v.fail("verification not found", 404, "not_found");
  if (r.userId === userId)
    v.fail(
      "You cannot verify your own enterprise or capabilities",
      403,
      "self_review",
    );
  v.fields(input, ["status", "revision", "reason", "expiresAt"], "review");
  v.revision(r, input.revision);
  const transitions = {
    submitted: ["under_review"],
    under_review: ["verified", "rejected"],
    verified: ["expired"],
  };
  if (!transitions[r.status]?.includes(input.status))
    v.fail("Invalid verification transition", 409, "invalid_transition");
  if (
    input.status !== "expired" &&
    supply.effectiveVerification(r) === "expired"
  )
    v.fail(
      "The subject changed or this check expired. Ask the owner to resubmit.",
      409,
      "subject_changed",
    );
  const reason = v.text(
    input.reason ?? "",
    1500,
    "review reason",
    input.status === "under_review" ? 0 : 10,
  );
  let expiresAt = null;
  if (input.status === "verified") {
    // Every retained file must still exist; no approval of vanished documents.
    supply.cleanEvidence(
      r.evidence.map((e) => ({ uploadId: e.uploadId })),
      r.userId,
      true,
    );
    const expiry = input.expiresAt
      ? Date.parse(input.expiresAt)
      : Date.now() + 90 * 86400000;
    if (
      !Number.isFinite(expiry) ||
      expiry <= Date.now() ||
      expiry > Date.now() + 366 * 86400000
    )
      v.fail("Verification expiry must be within the next year");
    expiresAt = new Date(expiry).toISOString();
  } else if (input.expiresAt) v.fail("An expiry date only applies to approval");
  const e = v.event(userId, `verification_${input.status}`, ["status"]);
  const updated = store.update("verificationRecords", id, {
    status: input.status,
    reason,
    expiresAt,
    reviewedBy: userId,
    reviewedAt: new Date().toISOString(),
    reviewMethod: "manual_review",
    revision: r.revision + 1,
    history: [...r.history, e],
  });
  v.audit("supplyVerification", id, e, updated.revision);
  return view(updated);
}
