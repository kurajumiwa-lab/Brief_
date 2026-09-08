// Commercial values only: integer currency minor units, never ledger entries.
import * as v from "./supplyValidation.js";
import { readFile } from "./upload.js";
import { getEnterprise } from "./supply.js";
export const CURRENCIES = {
  KES: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  TZS: 2,
  UGX: 0,
  RWF: 0,
  JPY: 0,
};
export const RELATIONSHIPS = {
  direct: "Direct supplier",
  distributor: "Distribution relationship — participant declared",
  sourcing: "Independent sourcing agent — external supplier relationship",
  referral: "Referral to another party",
  reseller: "Reseller",
  logistics: "Logistics provider",
};
export const TERM_FIELDS = [
  "quotedQuantity",
  "unit",
  "unitPriceMinor",
  "currency",
  "deliveryCostMinor",
  "sourcingFeeMinor",
  "otherCosts",
  "productionLeadDays",
  "deliveryLeadDays",
  "estimatedCompletionDate",
  "specifications",
  "exclusions",
  "notes",
  "terms",
  "sourceType",
  "privateProvenance",
  "evidence",
  "validUntil",
];
export function date(value, name) {
  if (value === null || value === "") return null;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    v.fail(`${name} must be a real calendar date`);
  return value;
}
export const expiry = (value) =>
  value ? Date.parse(`${value}T23:59:59.999+03:00`) : Infinity;
function integer(n, name, max = 1e12) {
  if (!Number.isSafeInteger(n) || n < 0 || n > max)
    v.fail(`${name} must be a non-negative integer, at most ${max}`);
  return n;
}
export function quantity(n) {
  if (
    typeof n !== "number" ||
    !Number.isFinite(n) ||
    n <= 0 ||
    n > 1e9 ||
    !/^\d+(\.\d{1,3})?$/.test(String(n))
  )
    v.fail(
      "Quantity must be positive, at most 1 billion, with at most 3 decimal places",
    );
  return n;
}
export function calculate(t) {
  const [whole, fraction = ""] = String(quantity(t.quotedQuantity)).split(".");
  const thousandths = BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0"));
  // Fractional units round half-up to one currency minor unit, once per line.
  const subtotal =
    (thousandths * BigInt(integer(t.unitPriceMinor, "Unit price")) + 500n) /
    1000n;
  const total =
    subtotal +
    BigInt(t.deliveryCostMinor) +
    BigInt(t.sourcingFeeMinor) +
    t.otherCosts.reduce((n, c) => n + BigInt(c.amountMinor), 0n);
  if (total > BigInt(Number.MAX_SAFE_INTEGER))
    v.fail("Quote total exceeds the supported monetary range");
  return { subtotalMinor: Number(subtotal), totalMinor: Number(total) };
}
export function validate(input, userId, { complete = false } = {}) {
  v.fields(input, TERM_FIELDS, "quote terms");
  const t = {
    quotedQuantity: null,
    unit: "",
    unitPriceMinor: null,
    currency: "KES",
    deliveryCostMinor: 0,
    sourcingFeeMinor: 0,
    otherCosts: [],
    productionLeadDays: null,
    deliveryLeadDays: null,
    estimatedCompletionDate: null,
    specifications: "",
    exclusions: "",
    notes: "",
    terms: "",
    sourceType: "direct",
    privateProvenance: { sourceParticipantId: null, reference: "", notes: "" },
    evidence: [],
    validUntil: null,
    ...input,
  };
  if (t.quotedQuantity !== null) t.quotedQuantity = quantity(t.quotedQuantity);
  if (t.unitPriceMinor !== null) integer(t.unitPriceMinor, "Unit price");
  v.choice(t.currency, Object.keys(CURRENCIES), "currency");
  v.choice(t.sourceType, Object.keys(RELATIONSHIPS), "source type");
  for (const f of ["deliveryCostMinor", "sourcingFeeMinor"]) integer(t[f], f);
  if (t.productionLeadDays !== null)
    integer(t.productionLeadDays, "Production/service lead days", 3650);
  if (t.deliveryLeadDays !== null)
    integer(t.deliveryLeadDays, "Delivery lead days", 3650);
  for (const f of ["unit", "specifications", "exclusions", "notes", "terms"])
    t[f] = v.text(t[f], f === "unit" ? 40 : 5000, f);
  if (!Array.isArray(t.otherCosts) || t.otherCosts.length > 12)
    v.fail("At most 12 disclosed additional costs");
  t.otherCosts = t.otherCosts.map((c) => {
    v.fields(c, ["label", "amountMinor"], "cost");
    return {
      label: v.text(c.label, 160, "Cost label", 1),
      amountMinor: integer(c.amountMinor, "Additional cost"),
    };
  });
  for (const f of ["validUntil", "estimatedCompletionDate"])
    t[f] = date(t[f], f);
  v.fields(
    t.privateProvenance,
    ["sourceParticipantId", "reference", "notes"],
    "private provenance",
  );
  t.privateProvenance = {
    sourceParticipantId: t.privateProvenance.sourceParticipantId ?? null,
    reference: v.text(
      t.privateProvenance.reference ?? "",
      300,
      "Private source reference",
    ),
    notes: v.text(t.privateProvenance.notes ?? "", 3000, "Private notes"),
  };
  if (t.privateProvenance.sourceParticipantId)
    getEnterprise(
      null,
      v.text(
        t.privateProvenance.sourceParticipantId,
        100,
        "Source participant ID",
        1,
      ),
      { includeCapabilities: false },
    );
  if (!Array.isArray(t.evidence) || t.evidence.length > 8)
    v.fail("At most 8 evidence images");
  const ids = new Set();
  t.evidence = t.evidence.map((e) => {
    v.fields(e, ["uploadId", "kind", "shareWithRequester"], "evidence");
    const f = readFile(e.uploadId);
    if (
      !f.ok ||
      f.row.ownerId !== userId ||
      f.row.purpose !== "private_quote" ||
      ids.has(e.uploadId)
    )
      v.fail("Use your own private quote images, without duplicates");
    ids.add(e.uploadId);
    return {
      uploadId: e.uploadId,
      kind: v.choice(
        e.kind,
        [
          "supplier_quotation",
          "product_specification",
          "stock_confirmation",
          "production_confirmation",
          "source_confirmation",
        ],
        "evidence kind",
      ),
      shareWithRequester: v.boolean(e.shareWithRequester, "Share evidence"),
    };
  });
  if (complete) {
    if (
      t.quotedQuantity === null ||
      !t.unit ||
      t.unitPriceMinor === null ||
      t.productionLeadDays === null
    )
      v.fail(
        "Quantity, unit, unit price, currency and estimated turnaround are required",
      );
    if (expiry(t.validUntil) <= Date.now())
      v.fail(
        "Choose a future validity date; an expired offer cannot be submitted",
      );
    if (
      t.estimatedCompletionDate &&
      expiry(t.estimatedCompletionDate) < Date.now()
    )
      v.fail("Estimated completion cannot be in the past");
  }
  return {
    ...t,
    ...(t.quotedQuantity !== null && t.unitPriceMinor !== null
      ? calculate(t)
      : { subtotalMinor: null, totalMinor: null }),
    relationshipType: RELATIONSHIPS[t.sourceType],
  };
}
export function editableTerms(t) {
  return Object.fromEntries(
    TERM_FIELDS.filter((k) => k in t).map((k) => [k, t[k]]),
  );
}
