import { activeCapabilityCatalog } from './search.js';
// Enterprise is an extension of the EXISTING vendor identity. Capabilities are
// independent of listings, inventory, prices or transactions. All quantities
// are declarations unless the scoped verification rail has reviewed them.
import { createHash } from "node:crypto";
import { store, newId } from "../store.js";
import { createVendor } from "./vendor.js";
import { readFile } from "./upload.js";
import * as v from "./supplyValidation.js";
export { SupplyError } from "./supplyValidation.js";
export const BUSINESS_TYPES = [
  "manufacturer",
  "wholesaler",
  "distributor",
  "retailer",
  "service_provider",
  "logistics_provider",
  "warehouse",
  "processor",
  "fabricator",
  "repair_provider",
  "sourcing_agent",
  "hybrid",
];
export const SUPPLY_ROLES = [
  "direct_supplier",
  "verified_sourcing_agent",
  "hybrid",
];
export const OPERATING_STATUSES = ["active", "paused", "closed"];
export const RELATIONSHIPS = [
  "direct_supplier",
  "authorized_distributor",
  "independent_sourcing_agent",
  "referral",
  "reseller",
  "local_stockist",
  "logistics_partner",
];
const ENTERPRISE_FIELDS = [
  "legalName",
  "displayName",
  "description",
  "businessType",
  "supplyRole",
  "location",
  "serviceAreas",
  "contactPreferences",
  "operatingStatus",
  "publication",
];
const CAP_FIELDS = [
  "name",
  "category",
  "description",
  "productsServices",
  "materials",
  "specifications",
  "minimumQuantity",
  "maximumQuantity",
  "typicalCapacity",
  "availableCapacity",
  "unit",
  "capacityPeriod",
  "capacityKind",
  "availability",
  "productionSchedule",
  "leadTime",
  "serviceAreas",
  "operatingStatus",
  "supplyMode",
  "evidence",
  "sourcingAccess",
];
const SOURCE_FIELDS = [
  "serviceDescription",
  "experienceYears",
  "categories",
  "regions",
  "typicalOrderMin",
  "typicalOrderMax",
  "sourcingLeadTime",
  "deliveryCoordination",
  "inspectionCapability",
  "negotiationCapability",
  "privateNetworks",
];
export function rawEnterprise(id) {
  const row = store.lookup("vendors", id);
  if (!row?.enterprise) v.fail("enterprise not found", 404, "not_found");
  return row;
}
export function ownEnterprise(userId, id) {
  v.actor(userId);
  const row = rawEnterprise(id);
  if (row.ownerId !== userId) v.fail("enterprise not found", 404, "not_found");
  return row;
}
export function rawCapability(id) {
  const c = store.lookup("capabilities", id);
  if (!c) v.fail("capability not found", 404, "not_found");
  return c;
}
const visible = (p) =>
  p.enterprise?.publication === "public" &&
  p.enterprise?.operatingStatus === "active" &&
  p.status === "active";
function bounds(min, max, label) {
  if (min !== null && max !== null && min > max)
    v.fail(`${label}: minimum cannot exceed maximum`);
}
function validateEnterprise(input) {
  v.fields(input, ENTERPRISE_FIELDS, "enterprise");
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (["legalName", "displayName", "location"].includes(key))
      out[key] = v.text(
        value,
        240,
        key,
        key === "displayName" ? 2 : key === "location" ? 2 : 0,
      );
    else if (key === "description") out[key] = v.text(value, 3000, key);
    else if (key === "businessType")
      out[key] = v.choice(value, BUSINESS_TYPES, key);
    else if (key === "supplyRole")
      out[key] = v.choice(value, SUPPLY_ROLES, key);
    else if (key === "operatingStatus")
      out[key] = v.choice(value, OPERATING_STATUSES, key);
    else if (key === "publication")
      out[key] = v.choice(value, ["private", "public"], key);
    else if (key === "serviceAreas") out[key] = v.strings(value, key);
    else if (key === "contactPreferences") {
      v.fields(value, ["method", "value", "public"], "contactPreferences");
      out[key] = {
        method: v.choice(
          value.method,
          ["brief", "email", "phone", "whatsapp"],
          "contact method",
        ),
        value: v.text(value.value ?? "", 240, "contact"),
        public: v.boolean(value.public ?? false, "public contact"),
      };
    }
  }
  return out;
}
function checkRole(p) {
  if (!p.displayName || !p.location || !p.businessType || !p.supplyRole)
    v.fail("Business name, type, supply role and location are required");
  if (
    p.businessType === "sourcing_agent" &&
    p.supplyRole !== "verified_sourcing_agent"
  )
    v.fail("A sourcing-agent business must use the sourcing role");
  if (
    p.supplyRole === "verified_sourcing_agent" &&
    p.businessType !== "sourcing_agent"
  )
    v.fail(
      "Sourcing-only participants must identify as sourcing agents, not manufacturers",
    );
  if (p.supplyRole === "hybrid" && p.businessType !== "hybrid")
    v.fail("Choose hybrid business type for mixed supply modes");
  if (p.businessType === "hybrid" && p.supplyRole !== "hybrid")
    v.fail("Choose hybrid supply role for a hybrid business");
}
function checkMode(p, mode) {
  if (
    (p.enterprise.supplyRole === "direct_supplier" && mode !== "direct") ||
    (p.enterprise.supplyRole === "verified_sourcing_agent" && mode !== "source")
  )
    v.fail("Capability supply mode must agree with the enterprise role");
}
function cleanEvidence(value, userId, privateOnly = false) {
  if (!Array.isArray(value) || value.length > 8)
    v.fail("At most eight evidence references are allowed");
  const seen = new Set();
  return value.map((e) => {
    v.fields(e, ["uploadId"], "evidence");
    const id = v.text(e.uploadId, 120, "uploadId", 1);
    const file = readFile(id);
    if (
      !file.ok ||
      file.row.ownerId !== userId ||
      seen.has(id) ||
      (privateOnly
        ? file.row.purpose !== "private_evidence"
        : (file.row.purpose ?? "public") !== "public")
    )
      v.fail(
        privateOnly
          ? "Use distinct private evidence images you own"
          : "Capability images must be owned, available public images, not private documents",
      );
    seen.add(id);
    return { uploadId: id };
  });
}
export { cleanEvidence };
function validateCapability(input, userId) {
  v.fields(input, CAP_FIELDS, "capability");
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (["name", "category", "unit", "productionSchedule"].includes(key))
      out[key] = v.text(
        value,
        key === "productionSchedule" ? 1000 : 180,
        key,
        ["name", "category"].includes(key) ? 2 : 0,
      );
    else if (key === "description") out[key] = v.text(value, 3000, key);
    else if (["productsServices", "materials", "serviceAreas"].includes(key))
      out[key] = v.strings(value, key);
    else if (
      [
        "minimumQuantity",
        "maximumQuantity",
        "typicalCapacity",
        "availableCapacity",
      ].includes(key)
    )
      out[key] = v.num(value, key);
    else if (key === "capacityPeriod")
      out[key] = v.choice(value, ["per_order", "day", "week", "month"], key);
    else if (key === "capacityKind")
      out[key] = v.choice(
        value,
        ["production", "stock", "service", "logistics", "sourcing_access"],
        key,
      );
    else if (key === "availability")
      out[key] = v.choice(
        value,
        ["unknown", "available", "limited", "unavailable"],
        key,
      );
    else if (key === "operatingStatus")
      out[key] = v.choice(value, ["active", "paused", "archived"], key);
    else if (key === "supplyMode")
      out[key] = v.choice(value, ["direct", "source"], key);
    else if (key === "leadTime") out[key] = v.leadTime(value);
    else if (key === "specifications") {
      if (!Array.isArray(value) || value.length > 20)
        v.fail("At most twenty named specifications are allowed");
      out[key] = value.map((s) => {
        v.fields(s, ["name", "value"], "specification");
        return {
          name: v.text(s.name, 80, "specification name", 1),
          value: v.text(s.value, 1000, "specification value", 1),
        };
      });
    } else if (key === "evidence") out[key] = cleanEvidence(value, userId);
    else if (key === "sourcingAccess") {
      v.fields(
        value,
        [
          "products",
          "regions",
          "networkDescription",
          "deliveryCoordination",
          "inspectionCapability",
          "negotiationCapability",
        ],
        "sourcingAccess",
      );
      out[key] = {
        products: v.strings(value.products ?? [], "products"),
        regions: v.strings(value.regions ?? [], "regions"),
        networkDescription: v.text(
          value.networkDescription ?? "",
          1000,
          "public network summary",
        ),
        deliveryCoordination: v.boolean(
          value.deliveryCoordination ?? false,
          "deliveryCoordination",
        ),
        inspectionCapability: v.boolean(
          value.inspectionCapability ?? false,
          "inspectionCapability",
        ),
        negotiationCapability: v.boolean(
          value.negotiationCapability ?? false,
          "negotiationCapability",
        ),
      };
    }
  }
  return out;
}
function checkCap(row) {
  if (!row.name || !row.category)
    v.fail("Capability name and category are required");
  bounds(row.minimumQuantity, row.maximumQuantity, "Quantity");
  if (
    [
      row.minimumQuantity,
      row.maximumQuantity,
      row.typicalCapacity,
      row.availableCapacity,
    ].some((n) => n !== null) &&
    !row.unit
  )
    v.fail("Add a unit for stated quantities");
  if (
    row.maximumQuantity !== null &&
    [row.typicalCapacity, row.availableCapacity].some(
      (n) => n !== null && n > row.maximumQuantity,
    )
  )
    v.fail("Capacity cannot exceed the stated maximum");
  if (row.supplyMode === "source" && row.capacityKind !== "sourcing_access")
    v.fail(
      "Sourced capability capacity describes sourcing access, not owned production or stock",
    );
  if (row.supplyMode === "direct" && row.capacityKind === "sourcing_access")
    v.fail("Direct capabilities cannot claim sourcing-access capacity");
}
export function createEnterprise(userId, input) {
  v.actor(userId);
  v.fields(input, [...ENTERPRISE_FIELDS, "firstCapability"], "enterprise");
  const { firstCapability, ...data } = input;
  const patch = validateEnterprise(data);
  const old = store.find("vendors", (p) => p.ownerId === userId);
  if (old?.enterprise)
    v.fail(
      "Your enterprise already exists. Open it to continue.",
      409,
      "enterprise_exists",
    );
  const profile = {
    legalName: "",
    description: old?.description ?? "",
    businessType: "service_provider",
    supplyRole: "direct_supplier",
    location: "",
    serviceAreas: [],
    contactPreferences: { method: "brief", value: "", public: false },
    operatingStatus: "active",
    publication: "private",
    displayName: old?.displayName ?? "",
    ...patch,
  };
  checkRole(profile);
  // Validate the entire onboarding payload before touching the existing vendor.
  if (firstCapability !== undefined) {
    const candidate = capDefaults(firstCapability, userId);
    checkMode({ enterprise: profile }, candidate.supplyMode);
  }
  return store.transaction(() => {
    const vendor =
      old ??
      createVendor({
        ownerId: userId,
        displayName: profile.displayName,
        description: profile.description,
      });
    const { displayName, description, ...extension } = profile;
    const e = v.event(userId, "enterprise_created", Object.keys(data));
    store.update("vendors", vendor.id, {
      displayName,
      description,
      status: profile.operatingStatus,
      enterprise: {
        ...extension,
        revision: 1,
        history: [e],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    if (firstCapability !== undefined)
      createCapability(userId, vendor.id, firstCapability);
    v.audit("enterprise", vendor.id, e, 1);
    return getEnterprise(userId, vendor.id);
  });
}
export function updateEnterprise(userId, id, input) {
  const row = ownEnterprise(userId, id);
  v.fields(input, [...ENTERPRISE_FIELDS, "revision"], "enterprise");
  v.revision(row.enterprise, input.revision);
  const { revision, ...data } = input;
  if (!Object.keys(data).length) v.fail("No changes supplied");
  const patch = validateEnterprise(data);
  const merged = {
    displayName: row.displayName,
    description: row.description,
    ...row.enterprise,
    ...patch,
  };
  checkRole(merged);
  for (const c of store.filter(
    "capabilities",
    (c) => c.participantId === id && c.operatingStatus !== "archived",
  ))
    checkMode({ enterprise: merged }, c.supplyMode);
  const e = v.event(userId, "enterprise_updated", Object.keys(data));
  const { displayName, description, ...extension } = merged;
  store.update("vendors", id, {
    displayName,
    description,
    status: merged.operatingStatus,
    enterprise: {
      ...extension,
      revision: revision + 1,
      history: [...row.enterprise.history, e],
      updatedAt: new Date().toISOString(),
    },
  });
  v.audit("enterprise", id, e, revision + 1);
  return getEnterprise(userId, id);
}
function capDefaults(input, userId) {
  const data = validateCapability(input, userId);
  const row = {
    name: "",
    category: "",
    description: "",
    productsServices: [],
    materials: [],
    specifications: [],
    minimumQuantity: null,
    maximumQuantity: null,
    typicalCapacity: null,
    availableCapacity: null,
    unit: "",
    capacityPeriod: "per_order",
    capacityKind: "service",
    availability: "unknown",
    productionSchedule: "",
    leadTime: { minDays: null, maxDays: null },
    serviceAreas: [],
    operatingStatus: "active",
    supplyMode: "direct",
    evidence: [],
    sourcingAccess: {
      products: [],
      regions: [],
      networkDescription: "",
      deliveryCoordination: false,
      inspectionCapability: false,
      negotiationCapability: false,
    },
    ...data,
  };
  checkCap(row);
  return row;
}
export function createCapability(userId, participantId, input) {
  const p = ownEnterprise(userId, participantId);
  v.fields(input, [...CAP_FIELDS, "idempotencyKey"], "capability");
  const { idempotencyKey = null, ...data } = input;
  const clean = capDefaults(data, userId);
  checkMode(p, clean.supplyMode);
  if (idempotencyKey !== null)
    v.text(idempotencyKey, 128, "idempotencyKey", 16);
  const fingerprint = hash(clean);
  const old =
    idempotencyKey &&
    store.find(
      "capabilities",
      (c) =>
        c.participantId === participantId && c.creationKey === idempotencyKey,
    );
  if (old) {
    if (old.creationFingerprint !== fingerprint)
      v.fail(
        "This capability was already saved with different details. Reload your enterprise.",
        409,
        "idempotency_conflict",
      );
    return capabilityView(old);
  }
  const now = new Date().toISOString();
  const e = v.event(userId, "capability_created");
  const row = store.insert("capabilities", {
    ...clean,
    id: newId("cap"),
    participantId,
    revision: 1,
    history: [e],
    createdAt: now,
    updatedAt: now,
    declaredAt: now,
    creationKey: idempotencyKey,
    creationFingerprint: fingerprint,
  });
  v.audit("capability", row.id, e, 1);
  return capabilityView(row);
}
export function updateCapability(userId, id, input) {
  const c = rawCapability(id);
  const p = ownEnterprise(userId, c.participantId);
  v.fields(input, [...CAP_FIELDS, "revision"], "capability");
  v.revision(c, input.revision);
  if (c.operatingStatus === "archived")
    v.fail("Archived capabilities cannot be edited", 409, "invalid_transition");
  const { revision, ...data } = input;
  if (!Object.keys(data).length) v.fail("No changes supplied");
  const patch = validateCapability(data, userId);
  const next = { ...c, ...patch };
  checkCap(next);
  checkMode(p, next.supplyMode);
  const e = v.event(
    userId,
    patch.operatingStatus === "archived"
      ? "capability_archived"
      : "capability_updated",
    Object.keys(data),
  );
  const updated = store.update("capabilities", id, {
    ...patch,
    declaredAt: new Date().toISOString(),
    revision: revision + 1,
    history: [...c.history, e],
  });
  v.audit("capability", id, e, revision + 1);
  return capabilityView(updated);
}
export function saveSourcing(userId, id, input) {
  const p = ownEnterprise(userId, id);
  if (p.enterprise.supplyRole === "direct_supplier")
    v.fail("Select a sourcing or hybrid enterprise role first");
  v.fields(input, [...SOURCE_FIELDS, "revision"], "sourcing profile");
  v.revision(p.enterprise, input.revision);
  const old = p.enterprise.sourcingProfile ?? {
    serviceDescription: "",
    experienceYears: null,
    categories: [],
    regions: [],
    typicalOrderMin: null,
    typicalOrderMax: null,
    sourcingLeadTime: { minDays: null, maxDays: null },
    deliveryCoordination: false,
    inspectionCapability: false,
    negotiationCapability: false,
    privateNetworks: "",
  };
  const patch = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === "revision") continue;
    if (["serviceDescription", "privateNetworks"].includes(key))
      patch[key] = v.text(value, 3000, key);
    else if (
      ["experienceYears", "typicalOrderMin", "typicalOrderMax"].includes(key)
    )
      patch[key] = v.num(value, key, 0, key === "experienceYears" ? 100 : 1e12);
    else if (["categories", "regions"].includes(key))
      patch[key] = v.strings(value, key);
    else if (key === "sourcingLeadTime") patch[key] = v.leadTime(value);
    else patch[key] = v.boolean(value, key);
  }
  const next = { ...old, ...patch };
  bounds(next.typicalOrderMin, next.typicalOrderMax, "Sourcing order size");
  const e = v.event(userId, "sourcing_updated", Object.keys(patch));
  const now = new Date().toISOString();
  store.update("vendors", id, {
    enterprise: {
      ...p.enterprise,
      sourcingProfile: {
        ...next,
        createdAt: old.createdAt ?? now,
        updatedAt: now,
      },
      revision: input.revision + 1,
      history: [...p.enterprise.history, e],
      updatedAt: now,
    },
  });
  v.audit("enterprise", id, e, input.revision + 1);
  return getEnterprise(userId, id);
}
export function hash(value) {
  const stable = (x) =>
    Array.isArray(x)
      ? x.map(stable)
      : x && typeof x === "object"
        ? Object.fromEntries(
            Object.keys(x)
              .sort()
              .map((k) => [k, stable(x[k])]),
          )
        : x;
  return createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex");
}
export function subjectFingerprint(participantId, kind, capabilityId = null) {
  const p = rawEnterprise(participantId);
  const identity = {
    displayName: p.displayName,
    legalName: p.enterprise.legalName,
    location: p.enterprise.location,
  };
  if (["capability", "capacity"].includes(kind)) {
    const c = rawCapability(capabilityId);
    if (c.participantId !== participantId)
      v.fail("capability not found", 404, "not_found");
    return hash({
      identity,
      capability: Object.fromEntries(CAP_FIELDS.map((k) => [k, c[k]])),
    });
  }
  if (kind === "identity") return hash(identity);
  if (kind === "business_type")
    return hash({ identity, businessType: p.enterprise.businessType });
  return hash({
    identity,
    supplyRole: p.enterprise.supplyRole,
    sourcing: p.enterprise.sourcingProfile ?? null,
  });
}
export function effectiveVerification(record) {
  if (!record) return "unverified";
  if (record.expiresAt && Date.parse(record.expiresAt) <= Date.now())
    return "expired";
  if (
    record.fingerprint !==
    subjectFingerprint(record.participantId, record.kind, record.capabilityId)
  )
    return "expired";
  return record.status;
}
export function standing(participantId, kind, capabilityId = null) {
  const record = store
    .indexed("verificationRecords", "participantId", participantId).filter(
      (r) =>
        r.scope === "supply" &&
        r.participantId === participantId &&
        r.kind === kind &&
        (r.capabilityId ?? null) === capabilityId,
    )
    .at(-1);
  const status = effectiveVerification(record);
  return {
    status,
    verifiedAt: status === "verified" ? record.reviewedAt : null,
    expiresAt: status === "verified" ? record.expiresAt : null,
    method: status === "verified" ? "manual_review" : null,
  };
}
export function capabilityView(c) {
  const verification = standing(c.participantId, "capability", c.id);
  const capacityVerification = standing(c.participantId, "capacity", c.id);
  const { creationKey, creationFingerprint, history, ...data } = c;
  return structuredClone({
    ...data,
    verification,
    capacityInformation: {
      basis:
        capacityVerification.status === "verified"
          ? "verified"
          : "stated_by_business",
      declaredAt: c.declaredAt,
      verification: capacityVerification,
      currentConfirmation: null,
    },
    evidence: c.evidence.map((e) => {
      const f = readFile(e.uploadId);
      return {
        uploadId: e.uploadId,
        url:
          f.ok && (f.row.purpose ?? "public") === "public"
            ? `/api/media/file/${e.uploadId}`
            : null,
      };
    }),
  });
}
export function getCapability(userId, id) {
  const c = rawCapability(id);
  const p = rawEnterprise(c.participantId);
  const owner = p.ownerId === userId;
  if (!owner && (!visible(p) || c.operatingStatus !== "active"))
    v.fail("capability not found", 404, "not_found");
  return {
    ...capabilityView(c),
    ...(owner ? { history: structuredClone(c.history) } : {}),
  };
}
export function listCapabilities(userId, id) {
  const p = rawEnterprise(id);
  if (p.ownerId !== userId && !visible(p))
    v.fail("enterprise not found", 404, "not_found");
  return store
    .indexed("capabilities", "participantId", id).filter(
      (c) =>
        (p.ownerId === userId || c.operatingStatus === "active"),
    )
    .map((c) => getCapability(userId, c.id));
}
export function getEnterprise(userId, id, {includeCapabilities=true} = {}) {
  const p = rawEnterprise(id);
  const e = p.enterprise;
  const owner = userId === p.ownerId;
  if (!owner && !visible(p)) v.fail("enterprise not found", 404, "not_found");
  const identity = standing(id, "identity"),
    businessType = standing(id, "business_type"),
    sourcingRole = standing(id, "sourcing_role");
  const agentVerified =
    identity.status === "verified" && sourcingRole.status === "verified";
  const sourcing =
    e.supplyRole !== "direct_supplier" && e.sourcingProfile
      ? { ...e.sourcingProfile }
      : null;
  if (sourcing && !owner) delete sourcing.privateNetworks;
  return structuredClone({
    id: p.id,
    displayName: p.displayName,
    description: p.description,
    businessType: e.businessType,
    supplyRole: e.supplyRole,
    roleLabel:
      e.supplyRole === "hybrid"
        ? "Hybrid · supplies directly and sources"
        : e.supplyRole === "direct_supplier"
          ? "Supplies directly · stated by business"
          : agentVerified
            ? "Verified Sourcing Agent"
            : "Sourcing agent · not verified",
    disclosure:
      e.supplyRole === "direct_supplier"
        ? "Direct supply is self-declared unless specifically reviewed."
        : "Independent sourcing agent for sourced capabilities. Not the manufacturer unless separately verified.",
    location: e.location,
    serviceAreas: e.serviceAreas,
    operatingStatus: e.operatingStatus,
    publication: e.publication,
    contactPreferences:
      owner || e.contactPreferences.public
        ? e.contactPreferences
        : { method: e.contactPreferences.method, value: null, public: false },
    verification: { identity, businessType, sourcingRole },
    capabilities: includeCapabilities ? listCapabilities(userId, id) : [],
    sourcingProfile: sourcing,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    ...(owner
      ? {
          ownerId: p.ownerId,
          legalName: e.legalName,
          revision: e.revision,
          history: e.history,
        }
      : {}),
  });
}
export function myEnterprise(userId) {
  v.actor(userId);
  const p = store.find("vendors", (p) => p.ownerId === userId && p.enterprise);
  return p ? getEnterprise(userId, p.id) : null;
}
export function searchCapabilities(userId, input = {}) {
  v.actor(userId);
  v.fields(
    input,
    [
      "q",
      "category",
      "location",
      "serviceArea",
      "supplyRole",
      "supplyMode",
      "offset",
      "limit",
    ],
    "search",
  );
  const q = v.text(input.q ?? "", 160, "query").toLowerCase();
  const category = v.text(input.category ?? "", 160, "category").toLowerCase();
  const location = v.text(input.location ?? "", 160, "location").toLowerCase();
  const area = v
    .text(input.serviceArea ?? "", 160, "serviceArea")
    .toLowerCase();
  const role = input.supplyRole
    ? v.choice(input.supplyRole, SUPPLY_ROLES, "supplyRole")
    : null;
  const mode = input.supplyMode
    ? v.choice(input.supplyMode, ["direct", "source"], "supplyMode")
    : null;
  if (
    ["offset", "limit"].some(
      (k) =>
        input[k] !== undefined &&
        !["string", "number"].includes(typeof input[k]),
    )
  )
    v.fail("Invalid pagination");
  const offset = input.offset === undefined ? 0 : Number(input.offset),
    limit = input.limit === undefined ? 30 : Number(input.limit);
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    v.fail("Invalid pagination");
  const rows = activeCapabilityCatalog().rows
    .filter((c) => {
      const p = store.lookup("vendors", c.participantId);
      if (!p || !visible(p) || c.operatingStatus !== "active") return false;
      const haystack = [
        c.name,
        c.category,
        c.description,
        ...c.productsServices,
        ...c.materials,
        ...c.sourcingAccess.products,
      ]
        .join(" ")
        .toLowerCase();
      const areas = [
        ...p.enterprise.serviceAreas,
        ...c.serviceAreas,
        ...c.sourcingAccess.regions,
      ]
        .join(" ")
        .toLowerCase();
      return (
        q.split(/\s+/).every((t) => haystack.includes(t)) &&
        (!category || c.category.toLowerCase().includes(category)) &&
        (!location || p.enterprise.location.toLowerCase().includes(location)) &&
        (!area || areas.includes(area)) &&
        (!role || p.enterprise.supplyRole === role) &&
        (!mode || c.supplyMode === mode)
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return {
    total: rows.length,
    offset,
    limit,
    capabilities: rows.slice(offset, offset + limit).map((c) => ({
      capability: capabilityView(c),
      participant: (() => {
        const p = getEnterprise(null, c.participantId);
        const { capabilities, ...summary } = p;
        return summary;
      })(),
    })),
  };
}
