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
  const [onboardType, setOnboardType] = useState("");
  const [onboardLocation, setOnboardLocation] = useState("");
  const [onboardContact, setOnboardContact] = useState("");
  const [onboardPhone, setOnboardPhone] = useState("");
  const [onboardBusy, setOnboardBusy] = useState(false);
  const onboardNewVendor = async () => {
    const name = onboardName.trim();
    if (!name) { setNotice("Name the shop first."); return; }
    if (!onboardType) { setNotice("Choose what kind of business this is."); return; }
    if (!onboardLocation.trim()) { setNotice("Enter the physical location — this is the proof a shop is real."); return; }
    if (!onboardContact.trim()) { setNotice("Name your direct contact — the person you reached."); return; }
    setOnboardBusy(true);
    const res = await api.onboardVendor({
      displayName: name,
      businessType: onboardType,
      location: onboardLocation.trim(),
      contactName: onboardContact.trim(),
      contactMethod: onboardPhone.trim() || null,
      claimType: 'full_registration'
    });
    setOnboardBusy(false);
    if (res.ok) {
      setNotice(`Connection made at ${name} — ${onboardContact.trim()} is on file. Territory claimed for 24 months.`);
      setOnboardName(""); setOnboardType(""); setOnboardLocation(""); setOnboardContact(""); setOnboardPhone("");
      setOnboardOpen(false);
      setVendors(null);
      void load();
    } else if (res.status === 401) {
      onRequireAuth();
    } else {
      setNotice(res.error ?? "Could not onboard that vendor.");
    }
  };

  // Build honest contact links from the phone the agent captured. tel: dials
  // as-is; wa.me needs international digits, so a Kenyan "07xx…" is normalised
  // to 2547xx…. A malformed/empty number yields null (no dead link).
  const contactLinks = (phone: string | null): { call: string | null; wa: string | null } => {
    if (!phone) return { call: null, wa: null };
    const digits = phone.replace(/[^\d+]/g, '');
    if (!digits) return { call: null, wa: null };
    const call = `tel:${digits}`;
    let wa: string | null = null;
    const d = digits.replace(/\D/g, '');
    if (d.length === 9 && d.startsWith('7')) wa = `https://wa.me/254${d}`;
    else if (d.length === 10 && d.startsWith('0')) wa = `https://wa.me/254${d.slice(1)}`;
    else if (d.length === 12 && d.startsWith('254')) wa = `https://wa.me/${d}`;
    else if (d.length >= 10 && !d.startsWith('0')) wa = `https://wa.me/${d}`;
    return { call, wa };
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
          onClick={() => {
            // One tap = straight to the onboard input, not a scroll-and-hunt.
            // Open the panel (force-open, never toggle) and bring it into view.
            setOnboardOpen(true);
            if (vendors === null) {
              void api.getVendors().then((res) => setVendors(res.ok ? res.data : []));
            }
            requestAnimationFrame(() => document.getElementById("earn-territory")?.scrollIntoView({ behavior: "smooth", block: "center" }));
          }}
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
        ) : (
          <>
            {agent.override.claims.length === 0 ? (
              <div className="mt-2 rounded-xl p-3" style={{ background: "var(--color-surface-elevated)" }}>
                <p className="text-xs font-bold" style={{ color: "var(--color-text)" }}>No territory yet</p>
                <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                  Make your first connection and earn a 0.75% override on their settled orders for 24 months.
                </p>
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
                  {agent.override.claims.map((cl) => {
                    const links = contactLinks(cl.contactMethod);
                    return (
                      <div key={cl.claimId} className="rounded-xl p-3" style={{ background: "var(--color-surface-elevated)" }}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold truncate" style={{ color: "var(--color-text)" }}>{cl.vendorName ?? "Vendor"}</p>
                          <span className="text-sm font-bold shrink-0 ml-2" style={{ color: "var(--color-success)" }}>KES {cl.overrideKes.toLocaleString()}</span>
                        </div>
                        <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                          {[cl.businessType, cl.location].filter(Boolean).join(' · ')} · {cl.settledOrders} settled order{cl.settledOrders === 1 ? "" : "s"}
                        </p>
                        {/* The direct contact the agent captured — call or WhatsApp. */}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="text-[11px] min-w-0 truncate" style={{ color: "var(--color-text-muted)" }}>
                            <strong style={{ color: "var(--color-text)" }}>{cl.contactName ?? "Contact"}</strong>
                            {cl.contactMethod ? ` · ${cl.contactMethod}` : ""}
                          </p>
                          {links.call && (
                            <div className="flex gap-1.5 shrink-0">
                              <a href={links.call} className="rounded-full px-2.5 py-1 text-[10px] font-bold no-underline" style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}>Call</a>
                              {links.wa && <a href={links.wa} target="_blank" rel="noopener noreferrer" className="rounded-full px-2.5 py-1 text-[10px] font-bold no-underline" style={{ background: "#16A34A", color: "#fff" }}>WhatsApp</a>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </MotionList>
                <p className="text-[10px] mt-2" style={{ color: "var(--color-text-muted)" }}>{agent.override.note}</p>
              </>
            )}

            {/* Always-available onboarding — the agent repeats this over time.
                Every shop is a detail Google Maps can't give us and proof the
                shop is real. This must NEVER disappear after the first move. */}
            <div className="mt-4 rounded-xl p-3 border" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-elevated)" }}>
              <p className="text-xs font-bold" style={{ color: "var(--color-text)" }}>Make a connection</p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                Every shop you onboard is proof it is real and a contact Google Maps can't give you. Do it as many times as you like.
              </p>
              <button
                type="button"
                onClick={openOnboard}
                className="mt-2 rounded-full px-4 py-1.5 text-xs font-bold"
                style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}
              >
                {onboardOpen ? "Close" : "+ Onboard another shop"}
              </button>
              {onboardOpen && (
                <div className="mt-3 space-y-2">
                  {/* Onboard a NEW vendor — the door-to-door agent's primary act. */}
                  <div className="rounded-lg p-2 border space-y-1.5" style={{ borderColor: "var(--color-border)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Make the initial connection</p>
                    <p className="text-[9px]" style={{ color: "var(--color-text-muted)" }}>
                      Name, what it is, where it is, and who you reached — so a false shop never counts in the vendor list.
                    </p>
                    <input
                      type="text"
                      placeholder="Shop name (e.g. Mama Njeri Grocers)"
                      aria-label="New vendor name"
                      value={onboardName}
                      onChange={(e) => setOnboardName(e.target.value)}
                      className="w-full rounded-lg px-2.5 py-1.5 text-xs border"
                      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
                    />
                    <select
                      aria-label="Business type"
                      value={onboardType}
                      onChange={(e) => setOnboardType(e.target.value)}
                      className="w-full rounded-lg px-2.5 py-1.5 text-xs border"
                      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
                    >
                      <option value="">What kind of business?</option>
                      {["retailer", "wholesaler", "distributor", "manufacturer", "service_provider", "logistics_provider", "warehouse", "processor", "repair_provider"].map((t) => (
                        <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Physical location (e.g. Gikomba Market, Stall 12)"
                      aria-label="Shop location"
                      value={onboardLocation}
                      onChange={(e) => setOnboardLocation(e.target.value)}
                      className="w-full rounded-lg px-2.5 py-1.5 text-xs border"
                      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
                    />
                    <input
                      type="text"
                      placeholder="Direct contact — who did you reach? (name)"
                      aria-label="Direct contact name"
                      value={onboardContact}
                      onChange={(e) => setOnboardContact(e.target.value)}
                      className="w-full rounded-lg px-2.5 py-1.5 text-xs border"
                      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
                    />
                    <input
                      type="text"
                      placeholder="Their phone / WhatsApp (optional)"
                      aria-label="Shop phone"
                      value={onboardPhone}
                      onChange={(e) => setOnboardPhone(e.target.value)}
                      className="w-full rounded-lg px-2.5 py-1.5 text-xs border"
                      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
                    />
                    <button
                      type="button"
                      disabled={onboardBusy}
                      onClick={onboardNewVendor}
                      className="w-full rounded-full px-3 py-1.5 text-[10px] font-bold"
                      style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}
                    >
                      {onboardBusy ? "…" : "Save connection"}
                    </button>
                  </div>

                  {vendors === null ? (
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Reading vendors…</p>
                  ) : vendors.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      No shops to claim yet — onboard a new one above, or claim one here once it exists.
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
