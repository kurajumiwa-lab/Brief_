import React, { useEffect, useState } from "react";
import * as api from "../../api/briefApi";
import type { ChamaRow, ChamaDetail } from "../../api/briefApi";
import { MotionList } from "../../ui/motion/MotionList";
import { MotionNumber } from "../../ui/motion/MotionNumber";
import { MotionStatus } from "../../ui/motion/MotionStatus";

// ---------------------------------------------------------------------------
// CHAMA — the indicators behind the table-banking door.
//
// Brief is NOT the chama and NOT a directory of chamas. This surface shows a
// member the groups they already belong to, and — crucially — WHAT CAN HAPPEN
// and WHAT DID HAPPEN, all DERIVED from real rows:
//
//   can happen:  who is next in the rotation, who still owes a contribution
//   did happen:  cash on hand, total contributed, loans outstanding
//   your own:    have you contributed, do you owe, is it your turn
//
// Empty state is honest: "you belong to no chama" means exactly that. There is
// no "browse chamas" (Brief is not a listing).
// ---------------------------------------------------------------------------

export function ChamaSurface({ onRequireAuth }: { onRequireAuth: () => void }) {
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [chamas, setChamas] = useState<ChamaRow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, ChamaDetail | null>>({});
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await api.getMyChamas();
    setLoading(false);
    if (!res.ok && res.status === 401) { setSignedOut(true); return; }
    setSignedOut(false);
    setChamas(res.ok ? res.data : null);
  };

  useEffect(() => { void load(); }, []);

  const openChama = async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (detail[id] === undefined) {
      const res = await api.getChama(id);
      setDetail((prev) => ({ ...prev, [id]: res.ok ? res.data : null }));
    }
  };

  const contribute = async (chama: ChamaRow) => {
    const res = await api.recordChamaContribution(chama.id, { amount: chama.contributionAmount, idempotencyKey: `contrib-${Date.now()}` });
    if (res.ok) { setNotice(`Recorded your contribution. Cash on hand: KES ${res.data.summary.cashOnHand.toLocaleString()}.`); void load(); }
    else if (res.status === 401) onRequireAuth();
    else setNotice(res.error ?? "Could not record the contribution.");
  };

  if (loading) return <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Reading your chamas…</p>;
  if (signedOut) {
    return <div className="mt-6 rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      <h2 className="text-lg font-black" style={{ color: "var(--color-text)" }}>Sign in to see your chamas</h2>
    </div>;
  }
  if (!chamas || chamas.length === 0) {
    return <div className="mt-6 rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      <h2 className="text-lg font-black" style={{ color: "var(--color-text)" }}>You belong to no chama yet</h2>
      <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
        Brief is a tool for groups that already exist — not a directory. Start one with your group, or join one you were invited to.
      </p>
    </div>;
  }

  return (
    <div className="mt-4 space-y-3">
      {notice && <p className="text-xs" role="status" style={{ color: "var(--color-text-muted)" }}>{notice}</p>}
      <MotionList className="space-y-3" stagger={40}>
        {chamas.map((c) => {
          const s = c.summary;
          const d = detail[c.id];
          const open = openId === c.id;
          return (
            <div key={c.id} className="rounded-2xl p-4" style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black" style={{ color: "var(--color-text)" }}>{c.name}</p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{c.members.length} members · KES {c.contributionAmount.toLocaleString()} / cycle</p>
                </div>
                <button type="button" onClick={() => openChama(c.id)} className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: "var(--color-surface-elevated)", color: "var(--color-text)" }}>
                  {open ? "Close" : "Indicators"}
                </button>
              </div>

              {s && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <MotionNumber value={s.cashOnHand} currency="KES" tier="consequential" />
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>cash on hand</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>{s.nextRecipientName ?? "—"}</p>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>next to receive</p>
                  </div>
                </div>
              )}

              {open && d && s && (
                <div className="mt-3 space-y-3">
                  {/* YOUR own indicator */}
                  <div className="rounded-xl p-3" style={{ background: "var(--color-surface-elevated)" }}>
                    <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Your position</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      <MotionStatus status={d.me.isNext ? "active" : "pending"} label={d.me.isNext ? "Your turn next" : "Not your turn yet"} tier="micro" />
                      <MotionStatus status={d.me.contributedKes > 0 ? "active" : "pending"} label={d.me.contributedKes > 0 ? `Contributed KES ${d.me.contributedKes.toLocaleString()}` : "Not contributed yet"} tier="micro" />
                      {d.me.owesKes > 0 && <MotionStatus status="failed" label={`Owes KES ${d.me.owesKes.toLocaleString()}`} tier="micro" />}
                    </div>
                    <button type="button" onClick={() => contribute(c)} className="mt-2 rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}>
                      Record contribution (KES {c.contributionAmount.toLocaleString()})
                    </button>
                  </div>

                  {/* Rotation */}
                  <div className="rounded-xl p-3" style={{ background: "var(--color-surface-elevated)" }}>
                    <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Rotation</p>
                    <ol className="mt-1 space-y-1">
                      {d.rotation.order.map((o, i) => (
                        <li key={o.userId} className="text-xs flex items-center gap-2" style={{ color: o.isCurrent ? "var(--color-primary)" : "var(--color-text)" }}>
                          <span style={{ fontWeight: o.isCurrent ? 800 : 400 }}>{i + 1}. {o.displayName ?? o.handle ?? "Member"}{o.isCurrent ? " ← current" : ""}{o.received ? " ✓" : ""}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Loans */}
                  {s.activeLoans.length > 0 && (
                    <div className="rounded-xl p-3" style={{ background: "var(--color-surface-elevated)" }}>
                      <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Loans outstanding</p>
                      {s.activeLoans.map((l) => (
                        <p key={l.id} className="text-xs mt-1" style={{ color: "var(--color-text)" }}>
                          KES {l.remaining.toLocaleString()} remaining @ {l.ratePercent}%
                        </p>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>{s.note}</p>
                </div>
              )}
            </div>
          );
        })}
      </MotionList>
    </div>
  );
}
