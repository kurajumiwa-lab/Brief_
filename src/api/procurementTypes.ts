/** Repeat procurement memory — private business history, owner-scoped. */

export interface ProcurementPrice {
  unitPriceMinor: number | null;
  subtotalMinor: number | null;
  totalMinor: number | null;
  deliveryCostMinor: number | null;
  sourcingFeeMinor: number | null;
  otherCosts: { label: string; amountMinor: number }[];
  currency: string;
}

export interface ProcurementSupplierStatus {
  available: boolean;
  reason: string | null;
  label: string | null;
  participant: {
    id: string;
    displayName: string | null;
    roleLabel: string | null;
  } | null;
}

export interface ProcurementReference {
  id: string;
  ownerId: string;
  sourceWorkOrderId: string;
  sourceRequestId: string;
  participantId: string;
  participantUserId: string;
  capabilityId: string;
  participantName: string | null;
  participantRole: string | null;
  title: string;
  itemOrService: string;
  category: string;
  subcategory: string;
  specifications: Record<string, string>;
  requirements: { id: string; label: string; category: string; quantity: number | null; unit: string }[];
  unit: string;
  lastQuantity: number | null;
  lastAgreedPrice: ProcurementPrice;
  lastAgreedPriceLabel: string;
  currency: string;
  budgetMin: number | null;
  budgetMax: number | null;
  location: string;
  deliveryLocation: string;
  requiredBy: string | null;
  requesterType: "business" | "individual";
  businessContext: Record<string, unknown>;
  visibility: "private" | "public";
  description: string;
  lastSupplierType: string | null;
  sourcingMode: string | null;
  lastFulfilledAt: string | null;
  typicalTurnaround: { minDays: number; maxDays: number } | null;
  repeatCount: number;
  recurring: boolean;
  typicalQuantity: { min: number; max: number } | null;
  previousSupplier: ProcurementSupplierStatus;
  createdAt: string;
  updatedAt: string;
}

export type RepeatSupplierStrategy = "previous" | "alternatives" | "both";

export interface RepeatProcurementInput {
  intent?: "draft" | "submit";
  supplierStrategy?: RepeatSupplierStrategy;
  idempotencyKey?: string;
  quantity?: number | null;
  specifications?: Record<string, string>;
  budgetMin?: number | null;
  budgetMax?: number | null;
  requiredBy?: string | null;
  deliveryLocation?: string;
  description?: string;
  attachments?: { uploadId: string }[];
  urgency?: "flexible" | "standard" | "urgent";
  currency?: string;
  location?: string;
  unit?: string;
}

export interface RepeatProcurementResult {
  request: { id: string; title: string; quantity: number | null; status: string; revision: number };
  procurement: ProcurementReference;
  previousSupplier: {
    added: boolean;
    note: string | null;
    strategy: RepeatSupplierStrategy;
  };
}
