// ---------------------------------------------------------------------------
// REPEAT PROCUREMENT ENGINE — Phase 6.
//
// Phase 5 established: Request → Match → Quote → Acceptance → Work Order →
// Fulfillment → Completion. Phase 6 turns a COMPLETED Work Order into a
// reusable procurement memory, so the next identical procurement is one tap
// away instead of a from-scratch reconstruction.
//
// RULES (deliberate, tested):
//   * A completed Work Order creates ONE `procurements` row (idempotent, keyed
//     on sourceWorkOrderId). The row is a HISTORICAL SNAPSHOT — it never
//     mutates the original Request, Quote or Work Order, and later edits to
//     those rows do not rewrite this memory.
//   * A repeat creates a brand-new Request through the EXISTING request system
//     (requests.createRequest). There is no parallel "repeat order" type.
//   * Historical price is stored as `lastAgreedPrice` and labelled "Previous
//     agreed price" — never "current". A repeat must go through normal quotes.
//   * A previous supplier is a SIGNAL, not an award. Availability is re-checked
//     against current persisted enterprise/capability state on every read, and
//     "unavailable" is reported honestly, never hidden.
//   * Repeat detection is DETERMINISTIC (a normalized pattern key), never
//     machine-learned and never raw text equality.
//   * Everything is owner-scoped: a business's procurement history, prices,
//     quantities and supplier relationships never leak to another business.
// ---------------------------------------------------------------------------

import { store, newId } from "../store.js";
import * as v from "./supplyValidation.js";
import * as supply from "./supply.js";
import * as requests from "./requests.js";
import * as participants from "./requestParticipants.js";
import { recordAudit } from "../routes/helpers.js";

const now = () => new Date().toISOString();

// --- Deterministic repeat detection (spec §5) --------------------------------
// "500 branded boxes", "1000 branded boxes" and "750 branded boxes" must land
// in the SAME pattern when the structured specification supports it. The key
// strips free-text quantities, normalises case/whitespace, and combines the
// structured category + unit + quantity-free title.

function tokenize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function stripQuantities(value) {
  return tokenize(value)
    .replace(/\b\d+(\.\d+)?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export function patternKeyOf({ category, unit, title }) {
  return [stripQuantities(category), tokenize(unit), stripQuantities(title)].join(
    "|",
  );
}

// --- Reference shape ---------------------------------------------------------
const own = (userId, id) => {
  v.actor(userId);
  const row = store.lookup("procurements", id);
  if (!row || row.ownerId !== userId) v.fail("not found", 404, "not_found");
  return row;
};

function priceLabel(ref) {
  return ref.lastAgreedPrice ?? null;
}

function derivedGrouping(rows) {
  const groups = new Map();
  for (const row of rows) {
    const list = groups.get(row.patternKey) ?? [];
    list.push(row);
    groups.set(row.patternKey, list);
  }
  return groups;
}

function groupStats(rows) {
  // A "repeat"/"recurring" pattern is established by MORE THAN ONE completed
  // procurement of the same structured pattern. One transaction is not a
  // pattern and never manufactures a "typical quantity".
  const quantities = rows
    .map((r) => r.lastQuantity)
    .filter((q) => typeof q === "number" && Number.isFinite(q));
  const distinct = [...new Set(quantities)];
  return {
    repeatCount: rows.length,
    recurring: rows.length >= 2,
    typicalQuantity:
      distinct.length >= 2
        ? { min: Math.min(...distinct), max: Math.max(...distinct) }
        : null,
  };
}

function view(userId, row, allRows) {
  const stats = groupStats(allRows.filter((r) => r.patternKey === row.patternKey));
  const previous = previousSupplierStatus(row);
  return structuredClone({
    ...row,
    lastAgreedPriceLabel: "Previous agreed price",
    previousSupplier: previous,
    ...stats,
  });
}

// --- Previous supplier availability (spec §9) --------------------------------
// Revalidates the previous participant against CURRENT persisted state:
// account/enterprise status, publication, and the previously used capability's
// operating status and availability. A historical relationship is never hidden
// — it is shown with the honest "currently unavailable" label when the
// participant is no longer suitable.
export function previousSupplierStatus(ref) {
  const base = { available: false, reason: null, label: null, participant: null };
  const snapshot = {
    id: ref.participantId,
    displayName: ref.participantName ?? null,
    roleLabel: ref.participantRole ?? null,
  };
  let raw = null;
  try {
    raw = supply.rawEnterprise(ref.participantId);
  } catch {
    return {
      ...base,
      participant: snapshot,
      label: "Previous supplier, currently unavailable",
      reason: "The previous supplier is no longer listed.",
    };
  }
  const enterprise = raw.enterprise;
  let participant = snapshot;
  // Prefer the live public display; fall back to the stored historical name.
  try {
    const pub = supply.getEnterprise(null, ref.participantId, { includeCapabilities: false });
    participant = { id: pub.id, displayName: pub.displayName, roleLabel: pub.roleLabel };
  } catch {
    /* stay on the stored snapshot */
  }
  if (raw.status !== "active" || enterprise.operatingStatus !== "active") {
    return {
      ...base,
      participant,
      label: "Previous supplier, currently unavailable",
      reason: "The previous supplier has paused or closed their enterprise.",
    };
  }
  if (enterprise.publication !== "public") {
    return {
      ...base,
      participant,
      label: "Previous supplier, currently unavailable",
      reason: "The previous supplier is no longer publicly visible.",
    };
  }
  // The previously used capability must still exist, be active and available.
  let capabilityReason = null;
  try {
    const capability = supply.getCapability(null, ref.capabilityId);
    if (capability.operatingStatus !== "active") {
      capabilityReason = "The previously used capability is no longer active.";
    } else if (capability.availability === "unavailable") {
      capabilityReason =
        "The previously used capability is currently declared unavailable.";
    }
  } catch {
    capabilityReason = "The previously used capability is no longer listed.";
  }
  if (capabilityReason) {
    return {
      ...base,
      participant,
      label: "Previous supplier, currently unavailable",
      reason: capabilityReason,
    };
  }
  return {
    available: true,
    reason: null,
    participant,
    label: "Previously fulfilled by this supplier",
  };
}

// --- Completion hook (idempotent) -------------------------------------------
export function recordCompletion(workOrder) {
  if (!workOrder || workOrder.status !== "completed" || !workOrder.completion)
    return null;
  const existing = store.find(
    "procurements",
    (p) => p.sourceWorkOrderId === workOrder.id,
  );
  if (existing) return existing;
  const request = store.lookup("requests", workOrder.requestId);
  const agreement = workOrder.agreements.at(-1);
  const terms = agreement?.terms ?? {};
  const at = now();
  const lead =
    typeof terms.productionLeadDays === "number" &&
    typeof terms.deliveryLeadDays === "number"
      ? {
          minDays: terms.productionLeadDays + terms.deliveryLeadDays,
          maxDays: terms.productionLeadDays + terms.deliveryLeadDays,
        }
      : typeof terms.productionLeadDays === "number"
        ? { minDays: terms.productionLeadDays, maxDays: terms.productionLeadDays }
        : null;
  const row = {
    id: newId("proc"),
    ownerId: workOrder.requesterId,
    sourceWorkOrderId: workOrder.id,
    sourceRequestId: workOrder.requestId,
    participantId: workOrder.participantId,
    participantUserId: workOrder.participantUserId,
    capabilityId: workOrder.capabilityId,
    participantName: workOrder.participant?.displayName ?? null,
    participantRole: workOrder.participant?.roleLabel ?? null,
    title: request?.title ?? workOrder.requirements?.title ?? "",
    itemOrService:
      (request && (request.title || request.category)) ||
      workOrder.requirements?.title ||
      "",
    category: request?.category ?? workOrder.requirements?.category ?? "",
    subcategory: request?.subcategory ?? "",
    specifications: structuredClone(
      request?.specifications ?? workOrder.requirements?.specifications ?? {},
    ),
    requirements: structuredClone(request?.requirements ?? []),
    unit: terms.unit || request?.unit || workOrder.requirements?.unit || "",
    lastQuantity:
      typeof terms.quotedQuantity === "number"
        ? terms.quotedQuantity
        : request?.quantity ?? workOrder.requirements?.quantity ?? null,
    lastAgreedPrice: {
      unitPriceMinor: terms.unitPriceMinor ?? null,
      subtotalMinor: terms.subtotalMinor ?? null,
      totalMinor: terms.totalMinor ?? null,
      deliveryCostMinor: terms.deliveryCostMinor ?? null,
      sourcingFeeMinor: terms.sourcingFeeMinor ?? null,
      otherCosts: structuredClone(terms.otherCosts ?? []),
      currency: terms.currency ?? request?.currency ?? "KES",
    },
    currency: terms.currency ?? request?.currency ?? "KES",
    budgetMin: request?.budgetMin ?? null,
    budgetMax: request?.budgetMax ?? null,
    location: request?.location ?? "",
    deliveryLocation: request?.deliveryLocation ?? "",
    requiredBy: request?.requiredBy ?? null,
    requesterType: request?.requesterType ?? "business",
    businessContext: structuredClone(request?.businessContext ?? {}),
    visibility: request?.visibility ?? "private",
    description: request?.description ?? "",
    lastSupplierType: workOrder.participant?.supplyRole ?? null,
    sourcingMode: workOrder.sourcingMode ?? terms.sourceType ?? null,
    lastFulfilledAt: workOrder.completedAt ?? null,
    typicalTurnaround: lead,
    patternKey: patternKeyOf({
      category: request?.category ?? workOrder.requirements?.category,
      unit: terms.unit || request?.unit || workOrder.requirements?.unit,
      title: request?.title ?? workOrder.requirements?.title,
    }),
    repeatedIntoRequestIds: [],
    createdAt: at,
    updatedAt: at,
  };
  store.insert("procurements", row);
  recordAudit("procurement.remembered", {
    actorId: workOrder.requesterId,
    objectType: "procurement",
    objectId: row.id,
    after: { sourceWorkOrderId: workOrder.id, sourceRequestId: workOrder.requestId },
  });
  return row;
}

// --- Reads -------------------------------------------------------------------
export function list(userId) {
  v.actor(userId);
  const rows = store
    .filter("procurements", (p) => p.ownerId === userId)
    .sort((a, b) => String(b.lastFulfilledAt ?? b.createdAt).localeCompare(
      String(a.lastFulfilledAt ?? a.createdAt),
    ));
  return rows.map((row) => view(userId, row, rows));
}

export function get(userId, id) {
  const row = own(userId, id);
  const rows = store.filter("procurements", (p) => p.ownerId === userId);
  return view(userId, row, rows);
}

export function forWorkOrder(userId, workOrderId) {
  v.actor(userId);
  const row = store.find(
    "procurements",
    (p) => p.sourceWorkOrderId === workOrderId && p.ownerId === userId,
  );
  if (!row) return null;
  return get(userId, row.id);
}

// --- Prefill (spec §3) -------------------------------------------------------
export function prefill(userId, id) {
  const row = own(userId, id);
  return structuredClone({
    title: row.title,
    description: row.description,
    category: row.category,
    subcategory: row.subcategory,
    quantity: row.lastQuantity,
    unit: row.unit,
    budgetMin: row.budgetMin,
    budgetMax: row.budgetMax,
    currency: row.currency,
    location: row.location,
    deliveryLocation: row.deliveryLocation,
    requiredBy: row.requiredBy,
    specifications: row.specifications,
    requirements: row.requirements,
    requesterType: row.requesterType,
    businessContext: row.businessContext,
    visibility: row.visibility,
  });
}

// --- Repeat (spec §3, §6, §8, §14) -------------------------------------------
// Creates a NEW Request from the historical memory. Never mutates the original
// Request, Quote or Work Order. The new Request receives a new id and flows
// through the normal draft/submit → matching → quote → work lifecycle.
const OVERRIDES = [
  "quantity",
  "specifications",
  "budgetMin",
  "budgetMax",
  "requiredBy",
  "deliveryLocation",
  "description",
  "attachments",
  "urgency",
  "currency",
  "location",
  "unit",
];

export function repeat(userId, id, input = {}) {
  const row = own(userId, id);
  v.fields(input, [...OVERRIDES, "intent", "supplierStrategy", "idempotencyKey"], "repeat");
  const intent = input.intent ?? "draft";
  if (!["draft", "submit"].includes(intent))
    v.fail("intent must be draft or submit");
  const strategy = input.supplierStrategy ?? "alternatives";
  v.choice(strategy, ["previous", "alternatives", "both"], "supplierStrategy");
  const overrides = Object.fromEntries(
    OVERRIDES.filter((k) => input[k] !== undefined).map((k) => [k, input[k]]),
  );
  const base = prefill(userId, id);
  const payload = {
    ...base,
    ...overrides,
    intent,
    idempotencyKey: input.idempotencyKey ?? null,
  };
  const created = requests.createRequest(userId, payload);
  // A previous relationship is a signal, never an automatic award. It goes
  // through the SAME shortlist → matching → quote architecture. Only when the
  // requester explicitly chooses "previous" or "both" do we add the previous
  // capability as a potential participant — and only if it is still available.
  let previousAdded = false;
  let previousNote = null;
  if (strategy === "previous" || strategy === "both") {
    const status = previousSupplierStatus(row);
    if (status.available) {
      try {
        participants.add(userId, created.id, { capabilityId: row.capabilityId });
        previousAdded = true;
      } catch (e) {
        previousNote = e?.message ?? "The previous supplier could not be added.";
      }
    } else {
      previousNote = status.reason ?? "Previous supplier is currently unavailable.";
    }
  }
  store.update("procurements", row.id, {
    repeatedIntoRequestIds: [...(row.repeatedIntoRequestIds ?? []), created.id],
    updatedAt: now(),
  });
  recordAudit("procurement.repeated", {
    actorId: userId,
    objectType: "procurement",
    objectId: row.id,
    after: { newRequestId: created.id, supplierStrategy: strategy },
  });
  return {
    request: created,
    procurement: get(userId, row.id),
    previousSupplier: {
      added: previousAdded,
      note: previousNote,
      strategy,
    },
  };
}
