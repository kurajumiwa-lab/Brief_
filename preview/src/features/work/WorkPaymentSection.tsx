import React, { useEffect, useState } from "react";
import * as api from "../../api/briefApi";
import type { WorkOrderPayments, WorkPaymentStatus } from "../../api/workPaymentTypes";
import { money } from "../quotes/money";

// ---------------------------------------------------------------------------
// WORK ORDER PAYMENT SECTION (Phase 8).
//
// Shows the financial state of a Work Order separately from its fulfillment
// state. Payment success is NEVER inferred from work completion, and vice
// versa. The agreed total comes from the frozen agreement; the payment status
// comes from the provider's confirmed outcome, never from local optimism.
// ---------------------------------------------------------------------------

const statusLabel = (status: string): string =>
  status === "confirmed"
    ? "Payment confirmed"
    : status === "processing"
      ? "Payment processing"
      : status === "failed"
        ? "Payment failed"
        : status === "cancelled"
          ? "Payment cancelled"
          : status === "expired"
            ? "Payment expired"
            : status === "pending"
              ? "Payment pending"
              : "Payment not started";

function statusClass(status: string): string {
  if (status === "confirmed") return "is-confirmed";
  if (status === "failed" || status === "cancelled" || status === "expired") return "is-failed";
  if (status === "processing" || status === "pending") return "is-processing";
  return "is-idle";
}

export function WorkPaymentSection({
  workOrderId,
  requesterView,
  agreementTotalMinor,
  agreementCurrency,
  sourcingBreakdown,
}: {
  workOrderId: string;
  requesterView: boolean;
  agreementTotalMinor: number;
  agreementCurrency: string;
  sourcingBreakdown: { sourceCostMinor: number | null; sourcingFeeMinor: number; logisticsCostMinor: number } | null;
}) {
  const [data, setData] = useState<WorkOrderPayments | null>(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.getWorkOrderPayments(workOrderId).then((res) => {
      if (!live) return;
      setLoading(false);
      if (res.ok) setData(res.data);
    });
    return () => {
      live = false;
    };
  }, [workOrderId, reload]);

  const pay = async () => {
    setBusy(true);
    setNotice("");
    const res = await api.payWorkOrder(workOrderId, {
      phone,
      idempotencyKey: `pay-${workOrderId}-${Date.now()}`,
    });
    setBusy(false);
    setReload((n) => n + 1);
    if (!res.ok) {
      setNotice(res.error ?? "Payment could not be initiated.");
      return;
    }
    if (res.data.charged === false) {
      setNotice("Payment is unavailable right now. Brief cannot collect this payment.");
      return;
    }
    setNotice(res.data.customerMessage ?? "Payment initiated. Check your phone.");
  };

  if (loading) return <p role="status">Reading payment state…</p>;
  const state = data?.state;
  const confirmed = data?.payments.find((p) => p.status === "confirmed") ?? null;

  return (
    <section className="work-payment" aria-label="Payment">
      <h4>Payment</h4>
      <p className="request-hint">
        Agreed total:{" "}
        <strong>{money(agreementTotalMinor, agreementCurrency)}</strong>
        {state?.unavailable && " · Payment unavailable (no provider configured)"}
      </p>

      {state && (
        <p className={`work-payment-status ${statusClass(state.status)}`}>
          {statusLabel(state.status)}
        </p>
      )}

      {sourcingBreakdown && sourcingBreakdown.sourcingFeeMinor > 0 && (
        <p className="request-hint">
          Source cost {money(sourcingBreakdown.sourceCostMinor ?? 0, agreementCurrency)} ·{" "}
          Sourcing fee {money(sourcingBreakdown.sourcingFeeMinor, agreementCurrency)} ·{" "}
          Logistics {money(sourcingBreakdown.logisticsCostMinor, agreementCurrency)}
        </p>
      )}

      {confirmed && (
        <p className="request-hint">
          Transaction reference: {confirmed.providerRef ?? "not recorded"}
          {confirmed.receipt ? ` · receipt ${confirmed.receipt}` : ""}
        </p>
      )}

      {requesterView && state && state.status !== "confirmed" && !state.unavailable && (
        <div className="work-pay-form">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="M-Pesa phone (07xx…)"
            aria-label="Payment phone number"
          />
          <button className="request-primary" disabled={busy || !phone.trim()} onClick={pay}>
            {busy ? "Initiating…" : "Pay now"}
          </button>
        </div>
      )}

      {notice && (
        <p role="status" className="request-notice">
          {notice}
        </p>
      )}
    </section>
  );
}
