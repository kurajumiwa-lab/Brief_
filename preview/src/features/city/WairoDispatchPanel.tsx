// ---------------------------------------------------------------------------
// WAIRO DISPATCH — rider routing to onboarded shops, wired to the REAL pickup
// API (no fake auction bids, no fake fares, no simulated dispatch).
//
// WAIRO is the rider/logistics layer. This is its dispatch surface:
//   * ORIGINS — shops a field agent onboarded (active full_registration claim).
//   * ASSIGN — route a rider to pick up from an origin, to a town, for a
//     receiver. The server refuses a shop nobody claimed (unclaimed_origin).
//   * ROUTE — the rider picker lets a dispatcher name WHO delivers: default is
//     self-dispatch, but any derived rider (an onboarding agent or a known
//     rider) can be assigned by id. The directory is derived, never seeded.
//   * DELIVERED — the rider marks a pickup delivered; the ONBOARDING agent
//     earns a derived flat per-pickup origin fee (shown honestly, "not money
//     until finance confirms").
//
// Nothing here is fabricated: origins come from real claims, pickups from real
// rows, the fee is derived. WAIRO's boda/indigo visual identity only.
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from "react";
import * as api from "../../api/briefApi";
import type { PickupOrigin, Pickup, PickupOriginObligation, Rider, PickupFeeSettlement } from "../../api/briefApi";
import { Bike, MapPin, Package, CheckCircle2, Plus, ArrowRight, Wallet, User } from "lucide-react";
import { soundEngine } from "../../utils/SoundEngine";

export function WairoDispatchPanel({ className = "" }: { className?: string }) {
  const [origins, setOrigins] = useState<PickupOrigin[] | null>(null);
  const [riders, setRiders] = useState<Rider[] | null>(null);
  const [pickups, setPickups] = useState<Pickup[] | null>(null);
  const [fee, setFee] = useState<PickupOriginObligation | null>(null);
  const [settlements, setSettlements] = useState<PickupFeeSettlement[] | null>(null);
  const [notice, setNotice] = useState("");

  // Assign form state
  const [originId, setOriginId] = useState("");
  // Empty string = self-dispatch (the server defaults riderId to the caller).
  const [riderId, setRiderId] = useState("");
  const [town, setTown] = useState("");
  const [receiver, setReceiver] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [o, r, p, f, s] = await Promise.all([
      api.getPickupOrigins(),
      api.getPickupRiders(),
      api.listMyPickups(),
      api.getMyPickupOriginFee(),
      api.getMyPickupFeeSettlements()
    ]);
    setOrigins(o.ok ? o.data : []);
    setRiders(r.ok ? r.data : []);
    setPickups(p.ok ? p.data : []);
    setFee(f.ok ? f.data : null);
    setSettlements(s.ok ? s.data : []);
  };

  useEffect(() => { void load(); }, []);

  const assign = async () => {
    if (!originId) { setNotice("Choose a shop to pick up from."); return; }
    if (!town.trim() || !receiver.trim() || !phone.trim()) {
      setNotice("Destination town, receiver name and phone are required."); return;
    }
    setBusy(true);
    const res = await api.assignPickup({
      originVendorId: originId,
      // Only sent when the dispatcher chose a DIFFERENT rider; otherwise the
      // server defaults to the caller (self-dispatch).
      ...(riderId ? { riderId } : {}),
      destinationTown: town.trim(),
      receiverName: receiver.trim(),
      receiverPhone: phone.trim()
    });
    setBusy(false);
    if (res.ok) {
      setNotice(`Pickup assigned — deliver to ${town.trim()}.`);
      setTown(""); setReceiver(""); setPhone(""); setOriginId(""); setRiderId("");
      void load();
    } else {
      setNotice(res.error ?? "Could not assign the pickup.");
    }
  };

  const complete = async (pickup: Pickup) => {
    soundEngine.play('tap');
    const res = await api.completePickup(pickup.id);
    if (res.ok) { setNotice("Pickup marked delivered."); void load(); }
    else setNotice(res.error ?? "Could not complete the pickup.");
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {notice && <p className="text-xs" role="status" style={{ color: "var(--color-text-muted)" }}>{notice}</p>}

      {/* ── Origins — the onboarded shops a rider can be routed to ── */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: "var(--color-primary)" }}>
          <Bike className="w-3 h-3 inline mr-1" /> Pickup origins
        </p>
        {origins === null ? (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Reading origins…</p>
        ) : origins.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            No onboarded shops yet. A shop appears here once a rider onboards it (You → Earn → Territory).
          </p>
        ) : (
          <div className="space-y-1.5">
            {origins.map((o) => (
              <button
                key={o.vendorId}
                type="button"
                onClick={() => { soundEngine.play('tap'); setOriginId(o.vendorId); }}
                className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all cursor-pointer ${originId === o.vendorId ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary-subtle)]' : 'border-[color:var(--color-border)] bg-white'}`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: "var(--color-text)" }}>{o.shopName}</p>
                  <p className="text-[11px] truncate" style={{ color: "var(--color-text-muted)" }}>
                    {[o.businessType, o.location].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-primary)" }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Assign a pickup ── */}
      <div className="p-3 rounded-2xl border" style={{ borderColor: "var(--color-border)", background: "var(--color-paper)" }}>
        <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          <Package className="w-3 h-3 inline mr-1" /> Assign a pickup
        </p>
        <div className="mt-2 space-y-1.5">
          <div className="relative">
            <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-text-muted)" }} />
            <select
              aria-label="Rider (who delivers)"
              value={riderId}
              onChange={(e) => { soundEngine.play('tap'); setRiderId(e.target.value); }}
              className="w-full rounded-lg pl-7 pr-2.5 py-1.5 text-xs border appearance-none cursor-pointer"
              style={{ borderColor: "var(--color-border)", background: "var(--color-paper)", color: "var(--color-text)" }}
            >
              <option value="">Me (self-dispatch)</option>
              {(riders ?? [])
                .filter((r) => !r.isSelf)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.displayName}{r.reasons.includes("onboarding_agent") ? " · onboarding agent" : ""}
                  </option>
                ))}
            </select>
          </div>
          <input type="text" placeholder="Destination town / stage" aria-label="Pickup destination town" value={town} onChange={(e) => setTown(e.target.value)} className="w-full rounded-lg px-2.5 py-1.5 text-xs border" style={{ borderColor: "var(--color-border)", background: "var(--color-paper)" }} />
          <input type="text" placeholder="Receiver name" aria-label="Receiver name" value={receiver} onChange={(e) => setReceiver(e.target.value)} className="w-full rounded-lg px-2.5 py-1.5 text-xs border" style={{ borderColor: "var(--color-border)", background: "var(--color-paper)" }} />
          <input type="text" placeholder="Receiver phone" aria-label="Receiver phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg px-2.5 py-1.5 text-xs border" style={{ borderColor: "var(--color-border)", background: "var(--color-paper)" }} />
          <button type="button" disabled={busy || !originId} onClick={assign} className="w-full rounded-full px-3 py-2 text-xs font-bold flex items-center justify-center gap-1" style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}>
            <Plus className="w-3.5 h-3.5" /> {busy ? "Assigning…" : "Assign rider"}
          </button>
        </div>
      </div>

      {/* ── Pickups + origin fee ── */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          <ArrowRight className="w-3 h-3 inline mr-1" /> Your pickups
        </p>
        {pickups === null ? (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Reading pickups…</p>
        ) : pickups.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>No pickups yet. Assign one above.</p>
        ) : (
          <div className="space-y-1.5">
            {pickups.map((p) => (
              <div key={p.id} className="p-2.5 rounded-xl border flex items-center justify-between gap-2" style={{ borderColor: "var(--color-border)", background: "var(--color-paper)" }}>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: "var(--color-text)" }}>{p.receiverName} → {p.destinationTown}</p>
                  <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{p.status}</p>
                </div>
                {p.status === 'delivered' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "var(--color-success)" }} />
                ) : (
                  <button type="button" onClick={() => complete(p)} className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}>
                    Delivered
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Origin fee (the onboarding agent's take) + settlement state ── */}
      {fee && (
        <div className="p-3 rounded-2xl flex items-center justify-between gap-2" style={{ borderColor: "var(--color-border)", background: "var(--color-paper)", border: "1px solid var(--color-border)" }}>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              <Wallet className="w-3 h-3 inline mr-1" /> Your origin fee
            </p>
            <p className="text-[11px] leading-snug" style={{ color: "var(--color-text-muted)" }}>{fee.note}</p>
            {(settlements ?? []).length > 0 && (() => {
              const latest = settlements![0];
              const color = latest.status === "confirmed"
                ? "var(--color-success)"
                : latest.status === "refused" ? "var(--color-danger)" : "var(--color-warning)";
              const label = latest.status === "confirmed"
                ? `KES ${latest.originFeeKes.toLocaleString()} settled by finance`
                : latest.status === "refused" ? "Last settlement refused by finance" : "Settlement pending — awaiting finance";
              return <p className="text-[11px] font-bold mt-0.5" style={{ color }}>{label}</p>;
            })()}
          </div>
          <span className="shrink-0 text-sm font-black" style={{ color: "var(--color-success)" }}>KES {fee.originFeeKes.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

export default WairoDispatchPanel;
