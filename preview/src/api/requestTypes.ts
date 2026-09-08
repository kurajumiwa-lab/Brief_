/** Canonical demand contract; independent of a vendor listing or supply mode. */
export type RequestStatus =
  | "draft"
  | "open"
  | "matching"
  | "quoted"
  | "ready_for_work"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "expired";
export type SupplyRole = "direct_supplier" | "verified_sourcing_agent";
export type SupplyRelationship =
  | "direct_supplier"
  | "authorized_distributor"
  | "independent_sourcing_agent"
  | "referral"
  | "reseller"
  | "local_stockist"
  | "logistics_partner";
export type SourceKind =
  | "direct_supplier"
  | "distributor"
  | "manufacturer"
  | "sourcing_agent"
  | "referral"
  | "local_stockist"
  | "logistics_provider";
export const specificationFields = {
  material: "Material",
  dimensions: "Dimensions",
  color: "Color",
  brandRequirements: "Brand requirements",
  qualityRequirements: "Quality requirements",
  packaging: "Packaging",
  deliveryRequirements: "Delivery requirements",
  certifications: "Certifications",
  minimumOrderRequirements: "Minimum order requirements",
  otherNotes: "Other notes",
} as const;
export interface BusinessContext {
  companyName?: string;
  industry?: string;
  location?: string;
  buyingFrequency?: string;
  recurringQuantity?: number | null;
  recurringUnit?: string;
}
export interface RequestInput {
  title: string;
  description: string;
  category: string;
  subcategory: string;
  quantity: number | null;
  unit: string;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  location: string;
  deliveryLocation: string;
  requiredBy: string | null;
  urgency: "flexible" | "standard" | "urgent";
  requirements?: {id:string;label:string;category:string;quantity:number|null;unit:string}[];
  specifications: Partial<Record<keyof typeof specificationFields, string>>;
  attachments: { uploadId: string }[];
  requesterType: "business" | "individual";
  businessContext: BusinessContext;
  preferredSupplierType: "any" | SupplyRole;
  visibility: "private" | "public";
  origin?: { objectId: string };
}
export interface RequestActivity {
  id: string;
  actorId: string;
  action: "created" | "updated" | "status_changed" | "cancelled" | "matching_started" | "match_refreshed" | "quote_submitted" | "quote_accepted" | "work_order_created" | "work_started" | "work_order_completed" | "work_order_cancelled";
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  changedFields: string[];
  at: string;
}
export interface DemandRequest
  extends Omit<RequestInput, "attachments" | "origin"> {
  id: string;
  requesterId: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  revision: number;
  requirementsRevision?: number;
  workOrderId?: string;
  acceptedQuote?: {quoteId:string;offerRevision:number;requestRevision:number;acceptedAt:string};
  history: RequestActivity[];
  origin: { objectId: string } | null;
  attachments: {
    uploadId: string;
    available: boolean;
    private?: boolean;
    name: string;
    url: string | null;
  }[];
}
/** Phase-two contract, NOT an operational offer or a verification claim.
 * Source identity and relationship are separate from the responding participant.
 * Only a future verified evidence record may establish representation/authority.
 * Money uses currency minor units; all costs must be disclosed, never netted away.
 */
export interface RequestResponseFoundation {
  requestId: string;
  participantId: string;
  supplyRole: SupplyRole | "hybrid";
  // Optional references prepare the chain; no quote/work/completion is invented.
  quoteId?: string | null;
  workId?: string | null;
  completionId?: string | null;
  provenance: {
    sourceKind: SourceKind;
    sourceParticipantId?: string | null;
    privateEvidenceIds?: string[];
    disclosedIntermediary?: {
      participantId: string;
      disclosure: string;
    } | null;
    supplierIdentity: { businessId?: string; name: string };
    sourceRelationship: SupplyRelationship;
    stockCapacityConfirmation?: {
      quantity: number;
      unit: string;
      evidenceUploadIds: string[];
      confirmedAt: string;
    };
    quoteEvidenceUploadIds: string[];
    specificationConfirmation?: string;
    agentDisclosure?: string;
    verification?: {
      evidenceId: string;
      verificationRecordId?: string;
      verifiedBy: string;
      verifiedAt: string;
    };
  };
  economics: {
    currency: string;
    supplierPriceMinor: number;
    agentFeeMinor: number;
    logisticsCostMinor: number;
    otherDisclosedCosts: { label: string; amountMinor: number }[];
    // A future quote service must derive total from the above, not client claims.
    readonly totalDeliveredPriceMinor?: number;
  };
  capability: {
    capabilityIds: string[];
    productServiceIds: string[];
    capacityKind:
      | "production"
      | "stock"
      | "service"
      | "logistics"
      | "sourcing_access";
    availableQuantity?: number;
    unit?: string;
    geographicAvailability: string[];
    turnaroundDays?: number;
  };
  // No price-only ranking or invented trust score. Future evaluation can use
  // evidence of capability/capacity, location, speed, reliability, source quality,
  // relationship/access and completed history alongside disclosed price.
}
