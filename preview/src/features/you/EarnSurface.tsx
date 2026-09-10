import React, { useEffect, useState } from "react";
import * as api from "../../api/briefApi";
import type { MyReferrals, FieldAgentOverview, LipaMdogoContract } from "../../api/briefApi";
import { MotionList } from "../../ui/motion/MotionList";
import { MotionNumber } from "../../ui/motion/MotionNumber";
import { MotionStatus } from "../../ui/motion/MotionStatus";

// ---------------------------------------------------------------------------
// EARN — the member's distribution earnings in one honest place (Phase 16 #4).
//
// Three rails, one surface:
//   1. POINTS — deterministic, non-gambling. The fixed ratio is stated on
//      screen ("100 points = KES X"), the balance is derived, and conversion
//      is refused by the server when the pool is empty. No chance, no spin.
//   2. FIELD AGENT — the territory override on vendors you onboarded (a
//      derived 0.75% of settled orders, 24 months), plus your claims.
//   3. LIPA MDOGO — the asset-financing contracts you are party to, with
//      their derived maturity (paying / overdue / matured). Records only:
//      the licensed lender owns the risk.
//
// Everything is read from real server rows. A signed-out member sees the
// signed-out state; an empty list is empty, never fabricated.
// ---------------------------------------------------------------------------

export function EarnSurface({ onRequireAuth }: { onRequireAuth: () => void }) {
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [refs, setRefs] = useState<MyReferrals | null>(null);
  const [agent, setAgent] = useState<FieldAgentOverview | null>(null);
  const [contracts, setContracts] = useState<LipaMdogoContract[] | null>(null);
  const [convertPts, setConvertPts] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [r, a, c] = await Promise.all([
      api.myReferrals(),
      api.getMyFieldAgent(),
      api.getMyLipaMdogo()
    ]);
    setLoading(false);
    if (!r.ok && r.status === 401) {
      setSignedOut(true);
      return;
    }
    setSignedOut(false);
    setRefs(r.ok ? r.data : null);
    setAgent(a.ok ? a.data : null);
    setContracts(c.ok ? c.data : null);
  };

  useEffect(() => {
    void load();
  }, []);

  const convert = async () => {
    const pts = Number(convertPts);
    if (!Number.isFinite(pts) || pts < 1) {
      setNotice("Enter a whole number of points to convert.");
      return;
    }
    setBusy(true);
    const res = await api.convertReferralPoints(pts);
    setBusy(false);
    if (res.ok) {
      setNotice(`Conversion requested — KES ${res.data.conversion.kes} pending finance confirmation.`);
      setConvertPts("");
      void load();
    } else if (res.status === 401) {
      onRequireAuth();
    } else {
      // The server's honest refusal (below minimum / pool empty) is the useful text.
      setNotice(res.error ?? "Could not convert points.");
    }
  };

  if (loading) return <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Reading your earnings…</p>;
  if (signedOut) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <h2 className="text-lg font-black" style={{ color: "var(--color-text)" }}>Sign in to see your earnings</h2>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>Your points, territory and contracts are yours alone.</p>
      </div>
    );
  }

  const ptsToKes = refs?.conversion.ptsToKes ?? 0.10;
  const hundredKes = Math.round(100 * ptsToKes);

  return (
    <div className="mt-4 space-y-5">
      {notice && <p className="text-xs" style={{ color: "var(--color-text-muted)" }} role="status">{notice}</p>}

      {/* --- 1. POINTS (deterministic, non-gambling) --- */}
      <section className="rounded-2xl p-5" style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
        <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--color-primary)" }}>Points</p>
        <div className="mt-2 grid grid-cols-3 gap-3">
          <div><MotionNumber value={refs?.balance.earned ?? 0} tier="consequential" /><p className="text-xs" style={{ color: "var(--color-text-muted)" }}>earned</p></div>
          <div><MotionNumber value={refs?.balance.locked ?? 0} tier="structural" /><p className="text-xs" style={{ color: "var(--color-text-muted)" }}>locked</p></div>
          <div><MotionNumber value={refs?.balance.available ?? 0} tier="consequential" /><p className="text-xs" style={{ color: "var(--color-text-muted)" }}>available</p></div>
        </div>
        {/* The fixed, deterministic ratio — the anti-gambling contract. */}
        <p className="text-xs mt-3" style={{ color: "var(--color-text)" }}>
          <strong>100 points = KES {hundredKes}</strong> — always. No chance, no spin. Minimum conversion: {refs?.conversion.minPoints ?? 500} points.
        </p>
        {refs && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="number"
              min={refs.conversion.minPoints}
              step="1"
              inputMode="numeric"
              placeholder={`min ${refs.conversion.minPoints}`}
              value={convertPts}
              aria-label="Points to convert"
              onChange={(e) => setConvertPts(e.target.value)}
              className="rounded-full px-3 py-2 text-xs border w-32"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface-elevated)" }}
            />
            <button type="button" onClick={convert} disabled={busy} className="rounded-full px-4 py-2 text-xs font-bold" style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}>
              {busy ? "Converting…" : "Convert to cash"}
            </button>
          </div>
        )}
      </section>

      {/* --- 2. FIELD AGENT (territory override) --- */}
      <section className="rounded-2xl p-5" style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
        <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--color-primary)" }}>Territory</p>
        {agent === null ? (
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Reading your territory…</p>
        ) : agent.override.claims.length === 0 ? (
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            No territory yet. Onboard a vendor (menu upload or full registration) to start earning an override.
          </p>
        ) : (
          <>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black" style={{ color: "var(--color-text)" }}>KES {agent.override.overrideKes.toLocaleString()}</span>
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                derived at {(agent.override.rate * 100).toFixed(2)}% of settled orders · {agent.override.months} months
              </span>
            </div>
            <MotionList className="mt-3 space-y-2" stagger={30}>
              {agent.override.claims.map((cl) => (
                <div key={cl.claimId} className="rounded-xl p-3 flex items-center justify-between" style={{ background: "var(--color-surface-elevated)" }}>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: "var(--color-text)" }}>{cl.vendorName ?? "Vendor"}</p>
                    <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                      {cl.settledOrders} settled order{cl.settledOrders === 1 ? "" : "s"} · KES {cl.grossKes.toLocaleString()} gross
                    </p>
                  </div>
                  <span className="text-sm font-bold shrink-0 ml-2" style={{ color: "var(--color-success)" }}>KES {cl.overrideKes.toLocaleString()}</span>
                </div>
              ))}
            </MotionList>
            <p className="text-[10px] mt-2" style={{ color: "var(--color-text-muted)" }}>{agent.override.note}</p>
          </>
        )}
      </section>

      {/* --- 3. LIPA MDOGO (contracts + maturity) --- */}
      <section className="rounded-2xl p-5" style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
        <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--color-primary)" }}>Lipa Mdogo</p>
        {contracts === null ? (
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Reading your contracts…</p>
        ) : contracts.length === 0 ? (
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>No asset-financing contracts yet.</p>
        ) : (
          <MotionList className="mt-3 space-y-2" stagger={30}>
            {contracts.map((c) => (
              <div key={c.id} className="rounded-xl p-3" style={{ background: "var(--color-surface-elevated)" }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>{c.asset.name ?? "Asset"}</p>
                  <MotionStatus status={c.maturity} label={c.maturity} tier="structural" />
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                  {c.lender.name} · financed KES {c.asset.financed.toLocaleString()} over {c.asset.termMonths} mo
                </p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span style={{ color: "var(--color-text-muted)" }}>
                    {c.summary.paidCount}/{c.schedule.length} paid{c.summary.overdueCount > 0 ? ` · ${c.summary.overdueCount} overdue` : ""}
                  </span>
                  <span style={{ color: "var(--color-text)" }}>
                    remaining KES {c.summary.remaining.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </MotionList>
        )}
      </section>
    </div>
  );
}
