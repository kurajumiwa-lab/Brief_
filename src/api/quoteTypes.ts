export const quoteCurrencies: Record<string, number> = {
  KES: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  TZS: 2,
  UGX: 0,
  RWF: 0,
  JPY: 0,
};
export type QuoteStatus =
  | "draft"
  | "submitted"
  | "viewed"
  | "revised"
  | "accepted"
  | "declined"
  | "withdrawn"
  | "expired";
export type QuoteSource =
  | "direct"
  | "distributor"
  | "sourcing"
  | "referral"
  | "reseller"
  | "logistics";
export interface QuoteTerms {
  quotedQuantity: number | null;
  unit: string;
  unitPriceMinor: number | null;
  currency: string;
  deliveryCostMinor: number;
  sourcingFeeMinor: number;
  otherCosts: { label: string; amountMinor: number }[];
  subtotalMinor: number | null;
  totalMinor: number | null;
  productionLeadDays: number | null;
  deliveryLeadDays: number | null;
  estimatedCompletionDate: string | null;
  validUntil: string | null;
  specifications: string;
  exclusions: string;
  notes: string;
  terms: string;
  sourceType: QuoteSource;
  relationshipType: string;
  privateProvenance?: {
    sourceParticipantId: string | null;
    reference: string;
    notes: string;
  };
  evidence: {
    uploadId: string;
    kind: string;
    shareWithRequester: boolean;
    verification?: "participant_uploaded";
  }[];
}
export interface QuoteRequirements {
  title: string;
  category: string;
  quantity: number | null;
  unit: string;
  location: string;
  requiredBy: string | null;
  currency: string;
  specifications: Record<string, string>;
  requirements: {
    id: string;
    label: string;
    quantity: number | null;
    unit: string;
  }[];
}
export interface QuoteInvitation {
  id: string;
  requestId: string;
  matchId: string;
  matchRevision: number;
  participantId: string;
  revision: number;
  requestRevision: number;
  currentRequestRevision: number;
  requirements: QuoteRequirements;
  capability: {
    id: string;
    name: string;
    supplyMode: "direct" | "source";
    capacityKind?: string;
    leadTime: { minDays: number | null; maxDays: number | null };
  };
  participant: {
    id: string;
    displayName: string;
    roleLabel: string;
    supplyRole: string;
  };
  interested: boolean;
  unavailableReason: string | null;
  quoteId: string | null;
  createdAt: string;
}
export interface QuoteOffer {
  revision: number;
  terms: QuoteTerms;
  requestRevision: number;
  requestSnapshot: QuoteRequirements;
  submittedAt: string;
  disclosure: string;
  participant: {
    id: string;
    displayName: string;
    roleLabel: string;
    supplyRole: string;
    capabilityName: string;
    capabilityVerification: string;
  };
}
export interface Quote {
  id: string;
  quoteRequestId: string;
  requestId: string;
  requesterId: string;
  participantId: string;
  matchId: string;
  capabilityId: string;
  revision: number;
  status: QuoteStatus;
  requestRevision: number;
  requirementsRevision: number;
  stale: boolean;
  staleReason: string | null;
  draft?: QuoteTerms | null;
  offers: QuoteOffer[];
  acceptedOfferRevision: number | null;
  workOrderId?:string|null;
  history: {
    id: string;
    actorId: string;
    action: string;
    at: string;
    offerRevision?: number;
    reason?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}
export interface CommercialWorkspace {
  invitations: QuoteInvitation[];
  quotes: Quote[];
  requestRevision?: number;
  status?: string;
  acceptedQuote?: {
    quoteId: string;
    offerRevision: number;
    requestRevision: number;
    acceptedAt: string;
  } | null;
}
export interface QuoteAction {
  action: "save" | "submit" | "view" | "accept" | "decline" | "withdraw";
  revision: number;
  requestRevision: number;
  idempotencyKey: string;
  terms?: Partial<QuoteTerms>;
  reason?: string;
}
