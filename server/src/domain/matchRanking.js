// Transparent first-version assessment. No ML, pricing, reviews or reliability
// inference. A relevant capability is mandatory; geography never creates a hit.
import { capabilityTerms } from "./search.js";
export const ALGORITHM = "capability-overlap-v1";
const signal = (code, text) => ({ code, text });
const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const units = (s) =>
  ({
    pcs: "piece",
    pieces: "piece",
    units: "piece",
    unit: "piece",
    kilograms: "kg",
    kilogram: "kg",
    litres: "litre",
    liters: "litre",
  })[norm(s)] ?? norm(s);
export function demandTerms(r) {
  const places = new Set(
    capabilityTerms(`${r.location} ${r.deliveryLocation}`),
  );
  return capabilityTerms(
    [r.title, ...(r.requirements ?? []).map((x) => x.label)].join(" "),
  ).filter((t) => !places.has(t));
}
export function assessCapability(r, p, c, { now = Date.now() } = {}) {
  const terms = demandTerms(r);
  if (!terms.length) return null;
  const primary = new Set(
    capabilityTerms(
      [c.name, ...c.productsServices, ...c.sourcingAccess.products].join(" "),
    ),
  );
  const matched = terms.filter((t) => primary.has(t));
  if (!matched.length) return null;
  const relevance = matched.length / terms.length,
    reasons = [
      signal(
        "capability",
        `Capability overlaps requested product/service: ${matched.join(", ")}.`,
      ),
    ],
    warnings = [];
  let score = Math.round(relevance * 60),
    quantity = "unknown",
    location = "unknown",
    time = "unknown";
  if (relevance < 0.65)
    warnings.push(
      signal(
        "partial_capability",
        "Only part of the requested capability is described. Confirm the complete requirement.",
      ),
    );
  const source = c.supplyMode === "source",
    sp = source ? p.sourcingProfile : null;
  // Source order bounds describe access, never owned factory stock.
  const min = c.minimumQuantity,
    max = c.maximumQuantity,
    typical = c.typicalCapacity;
  if (r.quantity == null)
    warnings.push(
      signal(
        "request_quantity_unknown",
        "Request quantity not stated; capacity compatibility needs confirmation.",
      ),
    );
  else if (!units(r.unit) || !units(c.unit) || units(r.unit) !== units(c.unit))
    warnings.push(
      signal(
        "units_unknown",
        "Quantity units differ or are not stated; no conversion has been assumed.",
      ),
    );
  else if (
    (min !== null && r.quantity < min) ||
    (max !== null && r.quantity > max)
  ) {
    quantity = "mismatch";
    score -= 18;
    warnings.push(
      signal(
        "quantity_mismatch",
        `Requested quantity is outside stated ${min ?? "unspecified"}–${max ?? "unspecified"} ${c.unit} order bounds. Ask whether an exception is possible.`,
      ),
    );
  } else if (typical !== null && r.quantity > typical) {
    quantity = "mismatch";
    score -= 10;
    warnings.push(
      signal(
        "capacity_shortfall",
        `Request exceeds typical declared capacity of ${typical} ${c.unit} per ${c.capacityPeriod.replaceAll("_", " ")}.`,
      ),
    );
  } else if (max !== null || typical !== null) {
    quantity = "compatible";
    score += 15;
    reasons.push(
      signal(
        "quantity",
        `Quantity fits stated ${source ? "sourcing access" : "capacity"} of ${typical ?? max} ${c.unit} (${c.capacityPeriod.replaceAll("_", " ")}); not reserved stock.`,
      ),
    );
  } else
    warnings.push(
      signal(
        "capacity_unknown",
        c.availableCapacity === null
          ? "Capacity not stated. A minimum order alone does not establish capacity."
          : "Typical or maximum capacity not stated; an available-capacity declaration is not a confirmed order allocation.",
      ),
    );
  if (
    r.quantity !== null &&
    c.availableCapacity !== null &&
    units(r.unit) === units(c.unit) &&
    r.quantity > c.availableCapacity
  ) {
    quantity = "mismatch";
    score -= 10;
    warnings.push(
      signal(
        "declared_available_shortfall",
        `The last declared available capacity (${c.availableCapacity} ${c.unit}) is below this Request. It is not live stock.`,
      ),
    );
  }
  if (c.capacityPeriod !== "per_order" && r.quantity !== null)
    warnings.push(
      signal(
        "capacity_period",
        `Capacity is declared per ${c.capacityPeriod}, not a confirmed per-order allocation.`,
      ),
    );
  if (c.availability === "unavailable") {
    score -= 25;
    warnings.push(
      signal(
        "unavailable",
        "Business currently declares this capability unavailable.",
      ),
    );
  } else if (c.availability === "limited") {
    score -= 6;
    warnings.push(signal("limited", "Business declares limited availability."));
  }
  const destination = norm(r.deliveryLocation || r.location);
  // Capability constraints take precedence over general enterprise defaults.
  // Sourcing regions describe access/origin, not confirmed delivery coverage.
  const coverage = (
    c.serviceAreas.length ? c.serviceAreas : p.serviceAreas
  ).map(norm);
  const wordMatch = (a, b) =>
    a === b ||
    (a.length >= 3 &&
      (` ${b} `.includes(` ${a} `) || ` ${a} `.includes(` ${b} `)));
  if (
    destination &&
    coverage.some(
      (a) =>
        wordMatch(a, destination) ||
        (["kenya wide", "nationwide", "all kenya", "kenya"].includes(a) &&
          /kenya|nairobi|kiambu|mombasa|kisumu|nakuru|eldoret|machakos|kajiado/.test(
            destination,
          )),
    )
  ) {
    location = "compatible";
    score += 12;
    reasons.push(
      signal(
        "coverage",
        "Declared service coverage includes the requested destination.",
      ),
    );
  } else if (destination && wordMatch(norm(p.location), destination)) {
    location = "nearby";
    score += 6;
    warnings.push(
      signal(
        "coverage_unconfirmed",
        "Based near the requested location; delivery/service coverage is not confirmed.",
      ),
    );
  } else
    warnings.push(
      signal(
        "location_unknown",
        "Requested destination is not covered by stated service areas; confirm geographic coverage.",
      ),
    );
  const lead =
    c.leadTime.maxDays !== null || c.leadTime.minDays !== null
      ? c.leadTime
      : (sp?.sourcingLeadTime ?? c.leadTime);
  if (r.requiredBy) {
    const days = Math.floor(
      (Date.parse(`${r.requiredBy}T23:59:59+03:00`) - now) / 86400000,
    );
    if (days < 0) {
      time = "mismatch";
      score -= 25;
      warnings.push(
        signal("deadline_passed", "The requested deadline has passed."),
      );
    } else if (lead.maxDays !== null && lead.maxDays <= days) {
      time = "compatible";
      score += 12;
      reasons.push(
        signal(
          "turnaround",
          `Typical turnaround (${lead.minDays ?? "?"}–${lead.maxDays} days) appears compatible with the deadline.`,
        ),
      );
    } else if (
      (lead.minDays !== null && lead.minDays > days) ||
      (lead.maxDays !== null && lead.maxDays > days)
    ) {
      time = "mismatch";
      score -= 12;
      warnings.push(
        signal(
          "turnaround_mismatch",
          "Typical turnaround may exceed the requested timeframe.",
        ),
      );
    } else
      warnings.push(
        signal("turnaround_unknown", "Turnaround not stated or confirmed."),
      );
  } else
    warnings.push(
      signal(
        "deadline_unknown",
        "No Request deadline stated; timing needs confirmation.",
      ),
    );
  if (c.verification.status === "verified") {
    score += 6;
    reasons.push(
      signal(
        "capability_verified",
        "Capability evidence verified through a scoped manual review.",
      ),
    );
  } else
    warnings.push(
      signal(
        "capability_declared",
        "Capability is self-declared; unverified does not mean fraudulent.",
      ),
    );
  if (c.capacityInformation.verification.status === "verified") {
    score += 3;
    reasons.push(
      signal(
        "capacity_reviewed",
        "Capacity evidence reviewed; current capacity still needs confirmation.",
      ),
    );
  }
  warnings.push(
    signal(
      "current_capacity",
      "Current capacity and availability have not been confirmed for this Request.",
    ),
  );
  if (source) {
    reasons.push(
      signal(
        "source",
        "Can source this through external supplier relationships.",
      ),
    );
    warnings.push(
      signal(
        "independent_source",
        "Independent sourcing relationship; not a claim of manufacturing, ownership or available stock.",
      ),
    );
    if (
      p.verification.identity.status === "verified" &&
      p.verification.sourcingRole.status === "verified"
    ) {
      score += 4;
      reasons.push(
        signal(
          "agent_verified",
          "Identity and sourcing role verified separately; manufacturer status is not implied.",
        ),
      );
    }
  } else
    reasons.push(
      signal("direct", "Can supply directly, as declared by the business."),
    );
  if (p.supplyRole === "hybrid")
    reasons.push(
      signal(
        "hybrid",
        "Hybrid enterprise; each relevant capability states direct supply or sourcing separately.",
      ),
    );
  if (
    (r.preferredSupplierType === "verified_sourcing_agent" && source) ||
    (r.preferredSupplierType === "direct_supplier" && !source)
  )
    score += 3;
  if (Object.values(r.specifications ?? {}).some(Boolean))
    warnings.push(
      signal(
        "specifications",
        "Detailed specifications, materials and certifications require confirmation; textual overlap does not establish compliance.",
      ),
    );
  const composite = (r.requirements?.length ?? 0) > 1;
  if (composite)
    warnings.push(
      signal(
        "composite",
        "This is a capability overlap, not confirmation of the complete multi-step workflow.",
      ),
    );
  const windowDays = r.requiredBy
    ? Math.floor(
        (Date.parse(`${r.requiredBy}T23:59:59+03:00`) - now) / 86400000,
      )
    : null;
  const periodFits =
    c.capacityPeriod === "per_order" ||
    (windowDays !== null &&
      windowDays >=
        ({ day: 1, week: 7, month: 31 }[c.capacityPeriod] ?? Infinity));
  if (!periodFits && r.quantity !== null)
    warnings.push(
      signal(
        "capacity_window",
        "The capacity period is not covered by the requested timeframe. Confirm an order-specific allocation.",
      ),
    );
  let materialConflict = false;
  if (r.specifications?.material && c.materials.length) {
    const requested = capabilityTerms(r.specifications.material),
      offered = new Set(capabilityTerms(c.materials.join(" ")));
    if (requested.length && !requested.some((t) => offered.has(t))) {
      materialConflict = true;
      score -= 15;
      warnings.push(
        signal(
          "material_mismatch",
          "The stated materials do not overlap the requested material. Confirm suitability.",
        ),
      );
    }
  }
  const strong =
    !materialConflict &&
    periodFits &&
    relevance >= 0.65 &&
    quantity === "compatible" &&
    location === "compatible" &&
    time === "compatible" &&
    !composite &&
    c.availability !== "unavailable" &&
    c.availability !== "limited";
  return {
    capabilityId: c.id,
    score,
    relevance,
    quantity,
    location,
    time,
    tier: source ? "sourcing_option" : strong ? "strong" : "potential",
    matchReasons: reasons,
    warnings,
  };
}
