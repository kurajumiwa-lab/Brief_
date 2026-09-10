import React, { useEffect, useState } from "react";
import * as api from "../../api/briefApi";

// ---------------------------------------------------------------------------
// ACTIVITY — the user's operational inbox (§11 / Phase 10 §15).
//
// "What happened to me, and what needs my action?" Distinct from Discover (the
// outside world) and Spaces (a persistent work context). This surface shows
// the user's OWN real economic activity — their Requests, Work, Payments and
// repeat-procurement memory — with honest empty / signed-out states. Nothing
// here is invented.
// ---------------------------------------------------------------------------

interface ActivityState {
  requests: number;
  work: number;
  payments: number;
  confirmedPayments: number;
  procurement: number;
}

const initialState: ActivityState = {
  requests: 0,
  work: 0,
  payments: 0,
  confirmedPayments: 0,
  procurement: 0,
};

export function ActivitySurface({ onOpenRequests }: { onOpenRequests: () => void }) {
  const [state, setState] = useState<ActivityState | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    (async () => {
      const [reqs, work, pays, proc] = await Promise.all([
        api.listMyRequests(),
        api.getMyWork(),
        api.getMyWorkPayments(),
        api.listProcurement(),
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
      setState({
        requests: reqs.ok ? reqs.data.length : 0,
        work: work.ok ? work.data.workOrders.length : 0,
        payments: pays.ok ? pays.data.length : 0,
        confirmedPayments: pays.ok
          ? pays.data.filter((p) => p.status === "confirmed").length
          : 0,
        procurement: proc.ok ? proc.data.length : 0,
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
          <span className="text-xs font-black uppercase tracking-widest text-[#5B2EA6]">
            Your operational inbox
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1A1F2E] tracking-tight mt-1">
            Activity
          </h1>
        </div>
      </div>
      <p className="text-sm text-[#64748B] mt-1">
        What happened to you, and what needs your action.
      </p>

      {loading ? (
        <p className="text-sm text-[#64748B] mt-6">Reading your activity…</p>
      ) : signedOut ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#1A1F2E]/20 bg-white p-8 text-center">
          <h2 className="text-lg font-black text-[#1A1F2E]">Sign in to see your activity</h2>
          <p className="text-sm text-[#64748B] mt-1">
            Your Requests, Work and payments are yours alone.
          </p>
        </div>
      ) : state ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onOpenRequests}
            className="text-left rounded-2xl border border-[#1A1F2E]/10 bg-white p-5 hover:border-[#5B2EA6] transition-colors"
          >
            <p className="text-2xl font-black text-[#1A1F2E]">{state.requests}</p>
            <p className="text-xs font-black uppercase tracking-wider text-[#64748B] mt-1">
              Requests
            </p>
            <p className="text-sm text-[#64748B] mt-2">
              {state.requests > 0
                ? "What your business has asked for."
                : "No requests yet. Create one to begin."}
            </p>
          </button>

          <div className="rounded-2xl border border-[#1A1F2E]/10 bg-white p-5">
            <p className="text-2xl font-black text-[#1A1F2E]">{state.work}</p>
            <p className="text-xs font-black uppercase tracking-wider text-[#64748B] mt-1">
              Work Orders
            </p>
            <p className="text-sm text-[#64748B] mt-2">
              {state.work > 0 ? "Work you are involved in." : "No work yet."}
            </p>
          </div>

          <div className="rounded-2xl border border-[#1A1F2E]/10 bg-white p-5">
            <p className="text-2xl font-black text-[#1A1F2E]">
              {state.confirmedPayments}
              <span className="text-sm font-bold text-[#64748B]"> / {state.payments}</span>
            </p>
            <p className="text-xs font-black uppercase tracking-wider text-[#64748B] mt-1">
              Payments confirmed
            </p>
            <p className="text-sm text-[#64748B] mt-2">
              {state.payments > 0
                ? "Confirmed payments out of your total attempts."
                : "No payment activity yet."}
            </p>
          </div>

          <div className="rounded-2xl border border-[#1A1F2E]/10 bg-white p-5">
            <p className="text-2xl font-black text-[#1A1F2E]">{state.procurement}</p>
            <p className="text-xs font-black uppercase tracking-wider text-[#64748B] mt-1">
              Repeat procurement
            </p>
            <p className="text-sm text-[#64748B] mt-2">
              {state.procurement > 0
                ? "Things you have sourced before."
                : "Completed work will appear here for re-ordering."}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
