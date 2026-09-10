import React, { useEffect, useState } from "react";
import * as api from "../../api/briefApi";
import { MotionList } from "../../ui/motion/MotionList";
import { MotionNumber } from "../../ui/motion/MotionNumber";

// ---------------------------------------------------------------------------
// ACTIVITY — the user's operational inbox (§11 / Phase 10 §15).
//
// "What happened to me, and what needs my action?" Distinct from Discover (the
// outside world) and Spaces (a persistent work context). This surface shows
// the user's OWN real economic activity — their Requests, Work, Payments and
// repeat-procurement memory — plus, honestly, the provenance of how they
// arrived (partner/program/cohort), which is null when none was captured.
//
// Colors reference the canonical design tokens (src/ui/theme.css) only — the
// stale purple/slate palette is gone. The stat figures use MotionNumber so a
// real change reads as economic causality; a card with no prior value shows
// the number plainly (never a rolling counter).
// ---------------------------------------------------------------------------

interface ActivityState {
  requests: number;
  work: number;
  payments: number;
  confirmedPayments: number;
  procurement: number;
  verifiedCommercialKes: number | null;
  provenanceLabel: string | null;
}

const initialState: ActivityState = {
  requests: 0,
  work: 0,
  payments: 0,
  confirmedPayments: 0,
  procurement: 0,
  verifiedCommercialKes: null,
  provenanceLabel: null,
};

export function ActivitySurface({ onOpenRequests }: { onOpenRequests: () => void }) {
  const [state, setState] = useState<ActivityState | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    (async () => {
      const [reqs, work, pays, proc, acq] = await Promise.all([
        api.listMyRequests(),
        api.getMyWork(),
        api.getMyWorkPayments(),
        api.listProcurement(),
        api.getMyAcquisition(),
      ]);
      if (!live) return;
      setLoading(false);
      // A signed-out caller gets 401 from every owner-scoped endpoint.
      const denied = [reqs, pays, proc].some((r) => !r.ok && r.status === 401);
      if (denied) {
        setSignedOut(true);
        setState(null);
        return;
      }
      setSignedOut(false);

      // Provenance: derive a single honest line from the chain, or null.
      let provenanceLabel: string | null = null;
      if (acq.ok && acq.data.acquisition) {
        const a = acq.data.acquisition;
        const parts: string[] = [];
        if (a.partnerName || a.partnerKey) parts.push(a.partnerName ?? a.partnerKey!);
        if (a.cohortName || a.cohortKey) parts.push(a.cohortName ?? a.cohortKey!);
        if (a.channel) parts.push(`via ${a.channel}`);
        provenanceLabel = parts.join(" · ");
      }

      setState({
        requests: reqs.ok ? reqs.data.length : 0,
        work: work.ok ? work.data.workOrders.length : 0,
        payments: pays.ok ? pays.data.length : 0,
        confirmedPayments: pays.ok
          ? pays.data.filter((p) => p.status === "confirmed").length
          : 0,
        procurement: proc.ok ? proc.data.length : 0,
        verifiedCommercialKes: acq.ok ? acq.data.activity.verifiedCommercialKes : null,
        provenanceLabel,
      });
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    <section className="max-w-3xl mx-auto" aria-label="Activity">
      <div className="flex items-end justify-between">
        <div>
          <span
            className="text-xs font-black uppercase tracking-widest"
            style={{ color: "var(--color-primary)" }}
          >
            Your operational inbox
          </span>
          <h1
            className="text-2xl sm:text-3xl font-black tracking-tight mt-1"
            style={{ color: "var(--color-text)" }}
          >
            Activity
          </h1>
        </div>
      </div>
      <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
        What happened to you, and what needs your action.
      </p>

      {loading ? (
        <p className="text-sm mt-6" style={{ color: "var(--color-text-muted)" }}>
          Reading your activity…
        </p>
      ) : signedOut ? (
        <div
          className="mt-6 rounded-2xl border border-dashed p-8 text-center"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-surface)",
          }}
        >
          <h2 className="text-lg font-black" style={{ color: "var(--color-text)" }}>
            Sign in to see your activity
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            Your Requests, Work and payments are yours alone.
          </p>
        </div>
      ) : state ? (
        <MotionList className="mt-6 grid gap-3 sm:grid-cols-2" stagger={45}>
          <button
            type="button"
            onClick={onOpenRequests}
            className="text-left rounded-2xl p-5 transition-colors"
            style={{
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
            }}
          >
            <MotionNumber value={state.requests} tier="consequential" />
            <p
              className="text-xs font-black uppercase tracking-wider mt-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              Requests
            </p>
            <p className="text-sm mt-2" style={{ color: "var(--color-text-muted)" }}>
              {state.requests > 0
                ? "What your business has asked for."
                : "No requests yet. Create one to begin."}
            </p>
          </button>

          <div
            className="rounded-2xl p-5"
            style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
          >
            <MotionNumber value={state.work} tier="consequential" />
            <p
              className="text-xs font-black uppercase tracking-wider mt-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              Work Orders
            </p>
            <p className="text-sm mt-2" style={{ color: "var(--color-text-muted)" }}>
              {state.work > 0 ? "Work you are involved in." : "No work yet."}
            </p>
          </div>

          <div
            className="rounded-2xl p-5"
            style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
          >
            <MotionNumber value={state.confirmedPayments} tier="consequential" />
            <span
              className="text-sm font-bold"
              style={{ color: "var(--color-text-muted)" }}
            >
              {" "}/ {state.payments}
            </span>
            <p
              className="text-xs font-black uppercase tracking-wider mt-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              Payments confirmed
            </p>
            <p className="text-sm mt-2" style={{ color: "var(--color-text-muted)" }}>
              {state.payments > 0
                ? "Confirmed payments out of your total attempts."
                : "No payment activity yet."}
            </p>
          </div>

          <div
            className="rounded-2xl p-5"
            style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
          >
            <MotionNumber value={state.procurement} tier="consequential" />
            <p
              className="text-xs font-black uppercase tracking-wider mt-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              Repeat procurement
            </p>
            <p className="text-sm mt-2" style={{ color: "var(--color-text-muted)" }}>
              {state.procurement > 0
                ? "Things you have sourced before."
                : "Completed work will appear here for re-ordering."}
            </p>
          </div>

          {/* Provenance — how you arrived. Honest: hidden entirely when no
              provenance was captured at sign-up. */}
          {state.provenanceLabel && (
            <div
              className="rounded-2xl p-5 sm:col-span-2"
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-surface-elevated)",
              }}
            >
              <p
                className="text-xs font-black uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)" }}
              >
                You came through
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--color-text)" }}>
                {state.provenanceLabel}
              </p>
              {state.verifiedCommercialKes !== null && (
                <p
                  className="text-sm mt-2"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Verified commercial activity:{" "}
                  <span style={{ color: "var(--color-success)", fontWeight: 700 }}>
                    KES {state.verifiedCommercialKes.toLocaleString()}
                  </span>
                </p>
              )}
            </div>
          )}
        </MotionList>
      ) : null}
    </section>
  );
}
