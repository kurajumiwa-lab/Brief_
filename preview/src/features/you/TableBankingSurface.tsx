import React, { useEffect, useState } from "react";
import * as api from "../../api/briefApi";
import type { TableBankingGroup, TableBankingDetail, TableBankingCollectiveRequest, WelfareFund, WelfareClaim } from "../../api/briefApi";
import { MotionList } from "../../ui/motion/MotionList";
import { MotionNumber } from "../../ui/motion/MotionNumber";
import { MotionStatus } from "../../ui/motion/MotionStatus";

// ---------------------------------------------------------------------------
// TABLE BANKING — the indicators behind the table-banking door.
//
// Brief is NOT the group and NOT a directory of groups. This surface shows a
// member the groups they already belong to, and — crucially — WHAT CAN HAPPEN
// and WHAT DID HAPPEN, all DERIVED from real rows:
//
//   can happen:  who is next in the rotation, who still owes a contribution
//   did happen:  cash on hand, total contributed, loans outstanding
//   your own:    have you contributed, do you owe, is it your turn
//
// Empty state is honest: "you belong to no Circle" means exactly that. There is
// no "browse groups" (Brief is not a listing).
// ---------------------------------------------------------------------------

export function TableBankingSurface({ onRequireAuth }: { onRequireAuth: () => void }) {
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [groups, setGroups] = useState<TableBankingGroup[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, TableBankingDetail | null>>({});
  const [notice, setNotice] = useState("");
  const [collective, setCollective] = useState<Record<string, TableBankingCollectiveRequest[] | undefined>>({});
  const [orderOpen, setOrderOpen] = useState<Record<string, boolean>>({});
  const [orderForm, setOrderForm] = useState<Record<string, { title: string; description: string; category: string; quantity: string; unit: string }>>({});
  // Welfare fund: the group's own earmarked emergency pool (not insurance).
  const [welfare, setWelfare] = useState<Record<string, { fund: WelfareFund; claims: WelfareClaim[] } | null>>({});
  const [claimOpen, setClaimOpen] = useState<Record<string, boolean>>({});
  const [claimForm, setClaimForm] = useState<Record<string, { reason: string; amount: string }>>({});

  const load = async () => {
    setLoading(true);
    const res = await api.getMyTableBanking();
    setLoading(false);
    if (!res.ok && res.status === 401) { setSignedOut(true); return; }
    setSignedOut(false);
    setGroups(res.ok ? res.data : null);
  };

  useEffect(() => { void load(); }, []);

  const openGroup = async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (detail[id] === undefined) {
      const res = await api.getTableBanking(id);
      setDetail((prev) => ({ ...prev, [id]: res.ok ? res.data : null }));
    }
    if (collective[id] === undefined) {
      const res = await api.getTableBankingCollectiveRequests(id);
      setCollective((prev) => ({ ...prev, [id]: res.ok ? res.data : [] }));
    }
    if (welfare[id] === undefined) {
      const res = await api.getWelfareFund(id);
      setWelfare((prev) => ({ ...prev, [id]: res.ok ? res.data : null }));
    }
  };

  const refreshWelfare = async (id: string) => {
    const res = await api.getWelfareFund(id);
    if (res.ok) setWelfare((prev) => ({ ...prev, [id]: res.data }));
  };

  const recordWelfare = async (group: TableBankingGroup) => {
    const amt = group.welfareContributionAmount ?? 0;
    if (amt <= 0) { setNotice("This group has no welfare contribution amount set."); return; }
    const res = await api.recordWelfareContribution(group.id, { amount: amt, idempotencyKey: `welfare-${Date.now()}` });
    if (res.ok) { setNotice(`Recorded a welfare contribution. Fund balance: KES ${res.data.fund.balance.toLocaleString()}.`); void refreshWelfare(group.id); }
    else if (res.status === 401) onRequireAuth();
    else setNotice(res.error ?? "Could not record the welfare contribution.");
  };

  const fileClaim = async (group: TableBankingGroup) => {
    const f = claimForm[group.id];
    if (!f || !f.reason.trim()) { setNotice("A claim needs a reason."); return; }
    const res = await api.fileWelfareClaim(group.id, { reason: f.reason.trim(), amount: Number(f.amount) || 0 });
    if (res.ok) { setNotice(`Claim filed — it now needs the group's vote.`); setClaimOpen((p) => ({ ...p, [group.id]: false })); void refreshWelfare(group.id); }
    else if (res.status === 401) onRequireAuth();
    else setNotice(res.error ?? "Could not file the claim.");
  };

  const voteClaim = async (group: TableBankingGroup, claimId: string, approve: boolean) => {
    const res = await api.voteOnWelfareClaim(group.id, claimId, approve);
    if (res.ok) { setNotice(approve ? "Your approving vote is recorded." : "Your declining vote is recorded."); void refreshWelfare(group.id); }
    else if (res.status === 401) onRequireAuth();
    else setNotice(res.error ?? "Could not record the vote.");
  };

  const placeOrder = async (group: TableBankingGroup) => {
    const f = orderForm[group.id];
    if (!f || !f.title.trim() || !f.description.trim() || !f.category.trim()) {
      setNotice("Title, description and category are required for a bulk order.");
      return;
    }
    const res = await api.placeTableBankingCollectiveRequest(group.id, {
      title: f.title.trim(),
      description: f.description.trim(),
      category: f.category.trim(),
      quantity: Number(f.quantity) || 0,
      unit: f.unit.trim() || "units",
      location: "Nairobi",
      intent: "submit"
    });
    if (res.ok) {
      setNotice(`Bulk order placed — it's now a Request in the economic loop.`);
      setOrderOpen((prev) => ({ ...prev, [group.id]: false }));
      const list = await api.getTableBankingCollectiveRequests(group.id);
      if (list.ok) setCollective((prev) => ({ ...prev, [group.id]: list.data }));
    } else if (res.status === 401) onRequireAuth();
    else setNotice(res.error ?? "Could not place the bulk order.");
  };

  const contribute = async (group: TableBankingGroup) => {
    const res = await api.recordTableBankingContribution(group.id, { amount: group.contributionAmount, idempotencyKey: `contrib-${Date.now()}` });
    if (res.ok) { setNotice(`Recorded your contribution. Cash on hand: KES ${res.data.summary.cashOnHand.toLocaleString()}.`); void load(); }
    else if (res.status === 401) onRequireAuth();
    else setNotice(res.error ?? "Could not record the contribution.");
  };

  if (loading) return <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Reading your Circles…</p>;
  if (signedOut) {
    return <div className="mt-6 rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      <h2 className="text-lg font-black" style={{ color: "var(--color-text)" }}>Sign in to see your Circles</h2>
    </div>;
  }
  if (!groups || groups.length === 0) {
    return <div className="mt-6 rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      <h2 className="text-lg font-black" style={{ color: "var(--color-text)" }}>You belong to no Circle yet</h2>
      <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
        Brief is a tool for groups that already exist — not a directory. Start one with your group, or join one you were invited to.
      </p>
    </div>;
  }

  return (
    <div className="mt-4 space-y-3">
      {notice && <p className="text-xs" role="status" style={{ color: "var(--color-text-muted)" }}>{notice}</p>}
      <MotionList className="space-y-3" stagger={40}>
        {groups.map((c) => {
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
                <button type="button" onClick={() => openGroup(c.id)} className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: "var(--color-surface-elevated)", color: "var(--color-text)" }}>
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

                  {/* Welfare fund — the group's own earmarked emergency pool.
                      NOT insurance: the group's money, paid by the group's vote. */}
                  <div className="rounded-xl p-3" style={{ background: "var(--color-surface-elevated)" }}>
                    <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Welfare fund</p>
                    {welfare[c.id] === undefined ? (
                      <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Reading fund…</p>
                    ) : welfare[c.id] === null ? (
                      <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Could not load the welfare fund.</p>
                    ) : (
                      <>
                        <div className="mt-1 flex items-baseline gap-2">
                          <MotionNumber value={welfare[c.id]!.fund.balance} currency="KES" tier="consequential" />
                          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>in the pot</span>
                        </div>
                        <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                          {welfare[c.id]!.fund.totalContributed.toLocaleString()} contributed · {welfare[c.id]!.fund.paidOut.toLocaleString()} paid out
                        </p>

                        {/* Pending claims: eligible members vote approve/decline. */}
                        {welfare[c.id]!.claims.filter((cl) => cl.status === "pending").map((cl) => (
                          <div key={cl.id} className="mt-2 rounded-lg p-2 border" style={{ borderColor: "var(--color-border)" }}>
                            <p className="text-xs font-bold" style={{ color: "var(--color-text)" }}>Claim: {cl.reason}</p>
                            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>KES {cl.amount.toLocaleString()} · {cl.votes.length} vote{cl.votes.length === 1 ? "" : "s"}</p>
                            <div className="mt-1 flex gap-2">
                              <button type="button" onClick={() => voteClaim(c, cl.id, true)} className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}>Approve</button>
                              <button type="button" onClick={() => voteClaim(c, cl.id, false)} className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}>Decline</button>
                            </div>
                          </div>
                        ))}

                        {/* Resolved claims (approved/declined), shown honestly. */}
                        {welfare[c.id]!.claims.filter((cl) => cl.status !== "pending").map((cl) => (
                          <p key={cl.id} className="text-[10px] mt-1" style={{ color: "var(--color-text-muted)" }}>
                            {cl.status === "approved" ? "Approved" : "Declined"}: {cl.reason} — KES {cl.amount.toLocaleString()}
                          </p>
                        ))}

                        <button type="button" onClick={() => recordWelfare(c)} className="mt-2 rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}>
                          {c.welfareContributionAmount > 0
                            ? `Record welfare contribution (KES ${c.welfareContributionAmount.toLocaleString()})`
                            : "No welfare amount set"}
                        </button>
                        <button type="button" onClick={() => setClaimOpen((p) => ({ ...p, [c.id]: !p[c.id] }))} className="ml-1 mt-2 rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}>
                          {claimOpen[c.id] ? "Cancel" : "File a claim"}
                        </button>
                        {claimOpen[c.id] && (
                          <div className="mt-2 space-y-1.5">
                            <input type="text" placeholder="Reason (e.g. bereavement, hospitalisation)" aria-label="Claim reason" value={claimForm[c.id]?.reason ?? ""} onChange={(e) => setClaimForm((p) => ({ ...p, [c.id]: { ...(p[c.id] ?? { reason: "", amount: "" }), reason: e.target.value } }))} className="w-full rounded-lg px-2.5 py-1.5 text-xs border" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }} />
                            <input type="text" inputMode="numeric" placeholder="Amount (KES)" aria-label="Claim amount" value={claimForm[c.id]?.amount ?? ""} onChange={(e) => setClaimForm((p) => ({ ...p, [c.id]: { ...(p[c.id] ?? { reason: "", amount: "" }), amount: e.target.value } }))} className="w-full rounded-lg px-2.5 py-1.5 text-xs border" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }} />
                            <button type="button" onClick={() => fileClaim(c)} className="w-full rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}>Submit claim</button>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Collective orders — the group in the economic loop */}
                  <div className="rounded-xl p-3" style={{ background: "var(--color-surface-elevated)" }}>
                    <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Collective orders</p>
                    {collective[c.id] === undefined ? (
                      <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Reading orders…</p>
                    ) : collective[c.id]!.length === 0 ? (
                      <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>No collective orders yet. Place one to buy as a group.</p>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {collective[c.id]!.map((o) => (
                          <li key={o.id} className="text-xs flex items-center justify-between">
                            <span className="truncate" style={{ color: "var(--color-text)" }}>{o.request?.title ?? "Order"}</span>
                            <span className="shrink-0 ml-2" style={{ color: "var(--color-text-muted)" }}>{o.aggregateQuantity} {o.request?.unit ?? ""} · {o.request?.status ?? "?"}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      onClick={() => setOrderOpen((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                      className="mt-2 rounded-full px-3 py-1.5 text-xs font-bold"
                      style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}
                    >
                      {orderOpen[c.id] ? "Cancel" : "Place bulk order"}
                    </button>
                    {orderOpen[c.id] && (
                      <div className="mt-2 space-y-1.5">
                        {(["title", "description", "category", "quantity", "unit"] as const).map((k) => (
                          <input
                            key={k}
                            type="text"
                            placeholder={k === "quantity" ? "Total quantity (e.g. 24)" : k}
                            value={orderForm[c.id]?.[k] ?? ""}
                            aria-label={`Bulk ${k} for ${c.name}`}
                            onChange={(e) => setOrderForm((prev) => ({ ...prev, [c.id]: { ...(prev[c.id] ?? { title: "", description: "", category: "", quantity: "", unit: "" }), [k]: e.target.value } }))}
                            className="w-full rounded-lg px-2.5 py-1.5 text-xs border"
                            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => placeOrder(c)}
                          className="w-full rounded-full px-3 py-1.5 text-xs font-bold"
                          style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}
                        >
                          Submit bulk order
                        </button>
                      </div>
                    )}
                  </div>

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
