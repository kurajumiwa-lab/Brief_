import type { QuoteTerms, QuoteRequirements, QuoteOffer } from "./quoteTypes";
export type WorkStatus =
  | "created"
  | "specification_pending"
  | "confirmed"
  | "in_progress"
  | "ready"
  | "dispatched"
  | "delivered"
  | "completed"
  | "cancelled"
  | "disputed";
export type WorkAction =
  | "confirm_specifications"
  | "start"
  | "progress"
  | "ready"
  | "dispatch"
  | "deliver"
  | "complete"
  | "add_evidence"
  | "cancel"
  | "raise_issue"
  | "resolve_issue"
  | "propose_amendment"
  | "accept_amendment"
  | "reject_amendment";
export interface WorkAgreement {
  revision: number;
  createdAt: string;
  acceptedQuoteId: string;
  acceptedOfferRevision: number;
  terms: Omit<QuoteTerms, "evidence" | "validUntil" | "privateProvenance">;
  requirements: QuoteRequirements;
  fulfillmentLocation: string;
  deliveryDetails: string;
  agreedStartDate: string | null;
  amendmentId?: string;
}
export interface WorkEvidence {
  id: string;
  uploadId: string;
  type: string;
  uploadedBy: string;
  timestamp: string;
  visibility: "shared" | "private";
  description: string;
  verification: string;
  milestone: WorkStatus;
  agreementRevision: number;
}
export interface WorkAmendment {
  id: string;
  status: "pending" | "accepted" | "rejected";
  baseAgreementRevision: number;
  proposedBy: string;
  proposedAt: string;
  reason: string;
  changes: { field: string; previous: unknown; proposed: unknown }[];
  previous: WorkAgreement;
  proposed: WorkAgreement;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote?: string;
}
export interface WorkOrder {
  id: string;
  requestId: string;
  acceptedQuoteId: string;
  acceptedOfferRevision: number;
  requesterId: string;
  participantId: string;
  capabilityId: string;
  matchId: string;
  participant: QuoteOffer["participant"];
  sourcingMode: string;
  relationship: string;
  privateSource?: QuoteTerms["privateProvenance"];
  acceptedEvidence?: QuoteTerms["evidence"];
  originalAgreement: WorkAgreement;
  agreements: WorkAgreement[];
  status: WorkStatus;
  revision: number;
  viewerRole: "requester" | "participant";
  actions: WorkAction[];
  requestStatus: string;
  confirmations: {
    requester?: { actorId: string; at: string; agreementRevision: number };
    participant?: { actorId: string; at: string; agreementRevision: number };
  };
  amendments: WorkAmendment[];
  evidence: WorkEvidence[];
  milestones: {
    status: WorkStatus;
    actorId: string;
    at: string;
    agreementRevision: number;
  }[];
  history: {
    id: string;
    actorId: string;
    action: string;
    at: string;
    revision: number;
    agreementRevision: number;
    fromStatus: WorkStatus | null;
    toStatus: WorkStatus | null;
    visibility: string;
    note?: string;
    amendmentId?: string;
  }[];
  issue: {
    id: string;
    raisedBy: string;
    at: string;
    reason: string;
    previousStatus: WorkStatus;
    resolutions: Record<string, unknown>;
    resolvedAt?: string;
  } | null;
  completion: {
    completedAt: string;
    completedBy: string;
    agreementRevision: number;
    agreement: WorkAgreement;
  } | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  startedAt: string | null;
  readyAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}
export interface WorkInput {
  action: WorkAction;
  revision: number;
  agreementRevision: number;
  idempotencyKey: string;
  note?: string;
  visibility?: "shared" | "private";
  changes?: Record<string, unknown>;
  amendmentId?: string;
  evidence?: {
    uploadId: string;
    type: string;
    visibility: "shared" | "private";
    description: string;
  }[];
}
export interface WorkCollection {
  workOrders: WorkOrder[];
  acceptedQuoteId?: string | null;
}
