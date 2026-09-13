import React, { useEffect, useState } from "react";
import * as api from "../../api/briefApi";
import type { MyReferrals, FieldAgentOverview, LipaMdogoContract } from "../../api/briefApi";
import type { Vendor } from "../../api/types";
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
  // Territory onboarding: pick a vendor and claim it (menu_upload or
  // full_registration). Vendors come from the real public vendor list.
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [claimBusy, setClaimBusy] = useState<Record<string, boolean>>({});

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

  const openOnboard = async () => {
    setOnboardOpen((v) => !v);
    if (vendors === null) {
      const res = await api.getVendors();
      setVendors(res.ok ? res.data : []);
    }
  };

  const claim = async (vendor: Vendor, claimType: 'menu_upload' | 'full_registration') => {
    setClaimBusy((p) => ({ ...p, [vendor.id]: true }));
    const res = await api.claimVendor(vendor.id, claimType);
    setClaimBusy((p) => ({ ...p, [vendor.id]: false }));
    if (res.ok) {
      setNotice(claimType === 'full_registration'
        ? `Territory claimed on ${vendor.displayName} — 0.75% of their settled orders for 24 months.`
        : `Menu onboarded for ${vendor.displayName} — bounty credited.`);
      setOnboardOpen(false);
      setVendors(null);
      void load();
    } else if (res.status === 401) {
      onRequireAuth();
    } else {
      // The server's honest refusal (self_claim / already_claimed) is the useful text.
      setNotice(res.error ?? "Could not claim that vendor.");
    }
  };

  // Onboard a NEW vendor: the door-to-door agent's primary act. Creates the
  // shop AND records the territory claim in one step — no existing vendor to
  // "claim" first. This is what "onboard" means when the market is empty.
  const [onboardName, setOnboardName] = useState("");
  const [onboardBusy, setOnboardBusy] = useState(false);
  const onboardNewVendor = async () => {
    const name = onboardName.trim();
    if (!name) { setNotice("Enter the shop's name to onboard it."); return; }
    setOnboardBusy(true);
    const res = await api.onboardVendor({ displayName: name, claimType: 'full_registration' });
    setOnboardBusy(false);
    if (res.ok) {
      setNotice(`Onboarded ${name} — territory claimed, 0.75% of their settled orders for 24 months.`);
      setOnboardName("");
      setOnboardOpen(false);
      setVendors(null);
      void load();
    } else if (res.status === 401) {
      onRequireAuth();
    } else {
      setNotice(res.error ?? "Could not onboard that vendor.");
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

      {/* --- 0. ONBOARDING — the first thing a new member sees, an action not a dead end. --- */}
      <section className="rounded-2xl p-5" style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
        <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--color-primary)" }}>How you earn</p>
        <p className="text-sm mt-1 font-bold" style={{ color: "var(--color-text)" }}>Three honest ways, all derived from real activity.</p>
        <ul className="mt-2 space-y-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
          <li><strong style={{ color: "var(--color-text)" }}>Points</strong> — deterministic, no chance, no spin.</li>
          <li><strong style={{ color: "var(--color-text)" }}>Territory</strong> — a 0.75% override on vendors you onboard, for 24 months.</li>
          <li><strong style={{ color: "var(--color-text)" }}>Lipa Mdogo</strong> — asset-financing contracts you are party to.</li>
        </ul>
        <button
          type="button"
          onClick={() => document.getElementById("earn-territory")?.scrollIntoView({ behavior: "smooth", block: "center" })}
          className="mt-3 rounded-full px-4 py-2 text-xs font-bold"
          style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}
        >
          Set up your territory →
        </button>
      </section>

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
      <section id="earn-territory" className="rounded-2xl p-5" style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
        <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--color-primary)" }}>Territory</p>
        {agent === null ? (
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Reading your territory…</p>
        ) : agent.override.claims.length === 0 ? (
          <div className="mt-2 rounded-xl p-3" style={{ background: "var(--color-surface-elevated)" }}>
            <p className="text-xs font-bold" style={{ color: "var(--color-text)" }}>No territory yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              Onboard a vendor and earn a 0.75% override on their settled orders for 24 months.
            </p>
            <button
              type="button"
              onClick={openOnboard}
              className="mt-2 rounded-full px-4 py-1.5 text-xs font-bold"
              style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}
            >
              {onboardOpen ? "Close" : "Onboard a vendor"}
            </button>
            {onboardOpen && (
              <div className="mt-3 space-y-2">
                {/* Onboard a NEW vendor — the primary act when the market has no
                    vendors to claim yet (or alongside claiming existing ones). */}
                <div className="rounded-lg p-2 border" style={{ borderColor: "var(--color-border)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Onboard a new shop</p>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      placeholder="Shop name (e.g. Mama Njeri Grocers)"
                      aria-label="New vendor name"
                      value={onboardName}
                      onChange={(e) => setOnboardName(e.target.value)}
                      className="flex-1 rounded-lg px-2.5 py-1.5 text-xs border"
                      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
                    />
                    <button
                      type="button"
                      disabled={onboardBusy}
                      onClick={onboardNewVendor}
                      className="rounded-full px-3 py-1.5 text-[10px] font-bold shrink-0"
                      style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}
                    >
                      {onboardBusy ? "…" : "Add shop"}
                    </button>
                  </div>
                </div>

                {vendors === null ? (
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Reading vendors…</p>
                ) : vendors.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    No vendors to claim yet — onboard a new shop above, or claim one here once it exists.
                  </p>
                ) : (
                  vendors.map((v) => (
                    <div key={v.id} className="rounded-lg p-2 flex items-center justify-between gap-2 border" style={{ borderColor: "var(--color-border)" }}>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate" style={{ color: "var(--color-text)" }}>{v.displayName}</p>
                        <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>{v.activeListingCount} active listing{v.activeListingCount === 1 ? "" : "s"}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button type="button" disabled={claimBusy[v.id]} onClick={() => claim(v, "full_registration")} className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}>
                          {claimBusy[v.id] ? "…" : "Claim territory"}
                        </button>
                        <button type="button" disabled={claimBusy[v.id]} onClick={() => claim(v, "menu_upload")} className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}>
                          Menu
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
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
