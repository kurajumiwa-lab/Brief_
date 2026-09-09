/** Work Order payments — the financial rail under the economic chain. */

export type WorkPaymentStatus =
  | "intent"
  | "authorized"
  | "confirmed"
  | "failed"
  | "cancelled"
  | "expired";

export interface WorkPaymentIntent {
  id: string;
  workOrderId: string;
  requestId: string;
  payerId: string;
  payeeId: string;
  payeeParticipantId: string;
  amountMinor: number;
  amount: number;
  currency: string;
  phone: string | null;
  paymentMethod: string;
  provider: string | null;
  status: WorkPaymentStatus;
  providerRef: string | null;
  receipt: string | null;
  transactionId: string | null;
  failureReason: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
  initiatedAt: string | null;
  confirmedAt: string | null;
  failedAt: string | null;
  history: { status: WorkPaymentStatus; at: string }[];
}

export type WorkPaymentStateStatus =
  | "not_started"
  | "pending"
  | "processing"
  | "confirmed"
  | "failed"
  | "cancelled"
  | "expired";

export interface WorkPaymentState {
  status: WorkPaymentStateStatus;
  unavailable: boolean;
  intents: WorkPaymentIntent[];
  liveIntentId: string | null;
}

export interface AgreementBreakdown {
  sourceCostMinor: number | null;
  sourcingFeeMinor: number;
  logisticsCostMinor: number;
  totalMinor: number | null;
  currency: string;
  sourcingMode: string | null;
}

export interface WorkOrderPayments {
  payments: WorkPaymentIntent[];
  state: WorkPaymentState;
  breakdown: AgreementBreakdown | null;
}
