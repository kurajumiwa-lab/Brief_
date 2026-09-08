// Explicit requester-curated links. Not recommendations, quotes or matches.
// Participant ownership grants NO access to a requester's private demand.
import { store, newId } from "../store.js";
import { getRequest } from "./requests.js";
import { getCapability, getEnterprise } from "./supply.js";
import * as v from "./supplyValidation.js";
function writable(userId, id) {
  const r = getRequest(userId, id);
  if (!["draft", "open", "matching"].includes(r.status))
    v.fail(
      "Closed requests cannot change potential participants",
      409,
      "invalid_transition",
    );
  return r;
}
function view(link) {
  try {
    const capability = getCapability(null, link.capabilityId);
    const participant = getEnterprise(null, link.participantId);
    return {
      ...link,
      available: true,
      capability,
      participant: {
        id: participant.id,
        displayName: participant.displayName,
        roleLabel: participant.roleLabel,
        disclosure: participant.disclosure,
      },
      supplyMode: capability.supplyMode,
    };
  } catch {
    return { ...link, available: false, capability: null, participant: null };
  }
}
export function list(userId, requestId) {
  getRequest(userId, requestId);
  return store
    .filter(
      "requestParticipants",
      (r) => r.requestId === requestId && r.status === "potential",
    )
    .map(view);
}
export function add(userId, requestId, input) {
  writable(userId, requestId);
  v.fields(input, ["capabilityId"], "potential participant");
  const id = v.text(input.capabilityId, 120, "capabilityId", 1);
  const capability = getCapability(null, id);
  getEnterprise(null, capability.participantId);
  const existing = store.find(
    "requestParticipants",
    (r) =>
      r.requestId === requestId &&
      r.capabilityId === id &&
      r.status === "potential",
  );
  if (existing) return view(existing);
  const e = v.event(userId, "potential_participant_added");
  const row = store.insert("requestParticipants", {
    id: newId("rpart"),
    requestId,
    participantId: capability.participantId,
    capabilityId: id,
    supplyMode: capability.supplyMode,
    origin: "requester_selected",
    status: "potential",
    revision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [e],
    // Phase-three provenance is separate from a shortlist. Empty is not evidence.
    provenance: null,
  });
  v.audit("requestParticipant", row.id, e, 1);
  return view(row);
}
export function remove(userId, requestId, id, input) {
  writable(userId, requestId);
  v.fields(input, ["revision"], "remove option");
  const row = store.find(
    "requestParticipants",
    (r) => r.id === id && r.requestId === requestId,
  );
  if (!row) v.fail("option not found", 404, "not_found");
  v.revision(row, input.revision);
  if (row.status !== "potential")
    v.fail("Option already removed", 409, "invalid_transition");
  const e = v.event(userId, "potential_participant_removed");
  const updated = store.update("requestParticipants", id, {
    status: "removed",
    revision: row.revision + 1,
    history: [...row.history, e],
  });
  v.audit("requestParticipant", id, e, updated.revision);
  return { removed: true };
}
