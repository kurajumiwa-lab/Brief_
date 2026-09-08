import type { Enterprise, Capability } from "./supplyTypes";
export interface MatchReason {
  code: string;
  text: string;
}
export interface DemandMatch {
  id: string;
  requestId: string;
  participantId: string;
  capabilityId: string;
  capabilityIds: string[];
  requestRevision: number;
  revision: number;
  status:
    | "suggested"
    | "viewed"
    | "saved"
    | "dismissed"
    | "contacted"
    | "expired";
  requesterState: "suggested" | "viewed" | "saved" | "dismissed";
  matchType: "direct" | "source" | "hybrid";
  tier: "strong" | "potential" | "sourcing_option" | null;
  stale: boolean;
  staleReason: string | null;
  participant: Pick<
    Enterprise,
    | "id"
    | "displayName"
    | "supplyRole"
    | "roleLabel"
    | "disclosure"
    | "location"
    | "serviceAreas"
    | "verification"
  > | null;
  capabilities: Pick<
    Capability,
    | "id"
    | "name"
    | "supplyMode"
    | "unit"
    | "availableCapacity"
    | "typicalCapacity"
    | "minimumQuantity"
    | "maximumQuantity"
    | "capacityPeriod"
    | "leadTime"
    | "verification"
  >[];
  matchReasons: MatchReason[];
  warnings: MatchReason[];
  signals: {
    quantity: string;
    location: string;
    time: string;
    verified: boolean;
  } | null;
  interested: boolean;
  interest: {
    id: string;
    status: string;
    requestRevision: number;
    current: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  history: { id: string; actorId: string; action: string; at: string }[];
}
export interface RequestMatches {
  requestId: string;
  requestRevision: number;
  requestStatus: string;
  generation: {
    revision: number;
    requestRevision: number;
    algorithmVersion: string;
    generatedAt: string;
    expiresAt: string;
    candidateCount: number;
    evaluatedCount: number;
    limited: boolean;
    matchCount: number;
  } | null;
  stale: boolean;
  matches: DemandMatch[];
  counts: {
    suggested: number;
    saved: number;
    interested: number;
    dismissed: number;
  };
}
export interface RelevantRequest {
  matchId: string;
  matchRevision: number;
  participantId: string;
  requestId: string;
  requestRevision: number;
  title: string;
  category: string;
  quantity: number | null;
  unit: string;
  location: string;
  requiredBy: string | null;
  capabilities: { id: string; name: string; supplyMode: "direct" | "source" }[];
  reason: string;
  interest: {
    id: string;
    status: string;
    revision: number;
    requestRevision: number;
    current: boolean;
  } | null;
}
