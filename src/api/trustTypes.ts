/** Participant trust — derived, explainable, privacy-safe. */

export type VerificationStatus =
  | "unverified"
  | "submitted"
  | "under_review"
  | "verified"
  | "rejected"
  | "expired";

export interface ScopedStanding {
  kind: string;
  status: VerificationStatus;
  verifiedAt: string | null;
  expiresAt: string | null;
  method: string | null;
  reviewedBy: string | null;
}

export interface EconomicHistory {
  participantId: string;
  capabilityId: string | null;
  completedWorkOrders: number;
  requesterConfirmedCompletions: number;
  cancelledWorkOrders: number;
  disputedWorkOrders: number;
  amendmentCount: number;
  repeatRelationships: number;
  businessesServed: number;
  capabilitiesFulfilled: number;
  onTime: { completed: number; eligible: number };
  limited: boolean;
}

export interface ReliabilitySignals {
  participantId: string;
  capabilityId: string | null;
  limited: boolean;
  statements: string[];
  note: string | null;
}

export interface CapabilityTrust {
  participantId: string;
  capabilityId: string;
  capabilityName: string | null;
  verification: ScopedStanding;
  history: EconomicHistory;
  signals: ReliabilitySignals;
}

export interface TrustProfile {
  participantId: string;
  verification: {
    identity: ScopedStanding;
    businessType: ScopedStanding;
    sourcingRole: ScopedStanding;
  };
  history: EconomicHistory;
  signals: ReliabilitySignals;
  capabilities: CapabilityTrust[];
}

/** Compact evidence for the supplier-decision context (matching + quotes). */
export interface DecisionContext {
  verifiedIdentity: boolean;
  verifiedBusinessType: boolean;
  verifiedSourcingRole: boolean;
  verifiedCapability: boolean;
  completedWorkOrders: number;
  requesterConfirmedCompletions: number;
  repeatRelationships: number;
  businessesServed: number;
  onTime: { completed: number; eligible: number };
  limited: boolean;
  statements: string[];
}
