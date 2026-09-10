import React, { useEffect, useState } from "react";
import * as api from "../../api/briefApi";
import type { PartnerView, JoinLink, PartnerSettlement } from "../../api/briefApi";
import { MotionList } from "../../ui/motion/MotionList";
import { MotionNumber } from "../../ui/motion/MotionNumber";
import { MotionStatus } from "../../ui/motion/MotionStatus";

// ---------------------------------------------------------------------------
// PARTNER DESK — the operator surface for distribution partners (Phase 2).
//
// Lists the STORED partner records with their DERIVED economics (members,
// gross verified commercial activity, revenue share) and lets an operator:
//   * generate the partner's join link (the deep link that attributes members)
//   * set the revenue-share AGREEMENT (finance-gated)
//   * REQUEST, CONFIRM and REFUSE settlements (finance-gated)
//
// The server owns the state machine and every money figure. This desk sends a
// share rate (0..1) or a settlement intent, never a shilling of its own — the
// derived share is the server's arithmetic, and settlement becomes money only
// when finance confirms it (a real ledger transaction). A 403 on a finance
// action is shown verbatim, never papered over. Nothing here invents a partner
// or a number.
// ---------------------------------------------------------------------------

type LoadState =
  | { kind: "loading" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string }
  | { kind: "ready"; partners: PartnerView[] };

const pct = (rate: number) => `${(rate * 100).toFixed(0)}%`;

export function PartnerDesk() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [invites, setInvites] = useState<Record<string, JoinLink | null>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [settlements, setSettlements] = useState<Record<string, PartnerSettlement[] | undefined>>({});
  const [shareInput, setShareInput] = useState<Record<string, string>>({});
  const [refuseNote, setRefuseNote] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const loadPartners = async () => {
    const res = await api.getPartners();
    if (!res.ok && res.status === 403) {
      setState({ kind: "forbidden" });
      return;
    }
    if (!res.ok) {
      setState({ kind: "error", message: res.error ?? "Could not read partners." });
      return;
    }
    setState({ kind: "ready", partners: res.data });
  };

  useEffect(() => {
    void loadPartners();
  }, []);

  const setNoticeFor = (key: string, msg: string) =>
    setNotice((prev) => ({ ...prev, [key]: msg }));
  const markBusy = (key: string, v: boolean) =>
    setBusy((prev) => ({ ...prev, [key]: v }));

  const requestInvite = async (partner: PartnerView) => {
    const res = await api.getPartnerInviteLink(partner.id);
    setInvites((prev) => ({ ...prev, [partner.id]: res.ok ? res.data : null }));
  };

  const toggleManage = async (partner: PartnerView) => {
    const opening = !expanded[partner.id];
    setExpanded((prev) => ({ ...prev, [partner.id]: opening }));
    if (opening && settlements[partner.id] === undefined) {
      const res = await api.getPartnerSettlements(partner.id);
      if (res.ok) setSettlements((prev) => ({ ...prev, [partner.id]: res.data }));
      else setNoticeFor(`settlements:${partner.id}`, res.error ?? "Could not read settlements.");
    }
  };

  const saveAgreement = async (partner: PartnerView) => {
    const raw = shareInput[partner.id];
    const pctNum = Number(raw);
    if (!Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100) {
      setNoticeFor(`agreement:${partner.id}`, "Enter a share percentage between 0 and 100.");
      return;
    }
    markBusy(`agreement:${partner.id}`, true);
    const res = await api.setPartnerAgreement(partner.id, pctNum / 100);
    markBusy(`agreement:${partner.id}`, false);
    if (res.ok) {
      setNoticeFor(`agreement:${partner.id}`, "");
      // Refresh so the derived share in the header matches the new agreement.
      void loadPartners();
    } else if (res.status === 403) {
      setNoticeFor(`agreement:${partner.id}`, "Finance access is required to set an agreement.");
    } else {
      setNoticeFor(`agreement:${partner.id}`, res.error ?? "Could not save the agreement.");
    }
  };

  const requestSettlement = async (partner: PartnerView) => {
    markBusy(`settle:${partner.id}`, true);
    const res = await api.requestPartnerSettlement(partner.id);
    markBusy(`settle:${partner.id}`, false);
    if (res.ok) {
      setSettlements((prev) => ({ ...prev, [partner.id]: [res.data, ...(prev[partner.id] ?? [])] }));
      setNoticeFor(`settle:${partner.id}`, "");
    } else if (res.status === 403) {
      setNoticeFor(`settle:${partner.id}`, "Finance access is required to request a settlement.");
    } else {
      // no_agreement / no_activity / duplicate_settlement are the server's words.
      setNoticeFor(`settle:${partner.id}`, res.error ?? "Could not request a settlement.");
    }
  };

  const confirmSettlement = async (partner: PartnerView, settlement: PartnerSettlement) => {
    markBusy(`confirm:${settlement.id}`, true);
    const res = await api.confirmPartnerSettlement(settlement.id);
    markBusy(`confirm:${settlement.id}`, false);
    if (res.ok) {
      setSettlements((prev) => ({
        ...prev,
        [partner.id]: (prev[partner.id] ?? []).map((s) => (s.id === settlement.id ? res.data : s))
      }));
      setNoticeFor(`confirm:${settlement.id}`, "");
    } else if (res.status === 403) {
      setNoticeFor(`confirm:${settlement.id}`, "Finance access is required to confirm a settlement.");
    } else {
      setNoticeFor(`confirm:${settlement.id}`, res.error ?? "Could not confirm the settlement.");
    }
  };

  const refuseSettlement = async (partner: PartnerView, settlement: PartnerSettlement) => {
    const noteText = refuseNote[settlement.id] ?? "";
    if (noteText.trim().length < 4) {
      setNoticeFor(`refuse:${settlement.id}`, "Say why (at least 4 characters) before refusing.");
      return;
    }
    markBusy(`refuse:${settlement.id}`, true);
    const res = await api.refusePartnerSettlement(settlement.id, noteText);
    markBusy(`refuse:${settlement.id}`, false);
    if (res.ok) {
      setSettlements((prev) => ({
        ...prev,
        [partner.id]: (prev[partner.id] ?? []).map((s) => (s.id === settlement.id ? res.data : s))
      }));
      setNoticeFor(`refuse:${settlement.id}`, "");
    } else if (res.status === 403) {
      setNoticeFor(`refuse:${settlement.id}`, "Finance access is required to refuse a settlement.");
    } else {
      setNoticeFor(`refuse:${settlement.id}`, res.error ?? "Could not refuse the settlement.");
    }
  };

  return (
    <section className="max-w-3xl mx-auto" aria-label="Partner desk">
      <div>
        <span
          className="text-xs font-black uppercase tracking-widest"
          style={{ color: "var(--color-primary)" }}
        >
          Distribution
        </span>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1" style={{ color: "var(--color-text)" }}>
          Partners
        </h1>
      </div>
      <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
        Organizations that bring their cohort, and what that cohort actually did.
      </p>

      {state.kind === "loading" && (
        <p className="text-sm mt-6" style={{ color: "var(--color-text-muted)" }}>
          Reading partners…
        </p>
      )}

      {state.kind === "forbidden" && (
        <div
          className="mt-6 rounded-2xl border border-dashed p-8 text-center"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
        >
          <h2 className="text-lg font-black" style={{ color: "var(--color-text)" }}>
            Operator access only
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            The partner desk is for reviewers and administrators. You don't have that capability.
          </p>
        </div>
      )}

      {state.kind === "error" && (
        <p role="alert" className="text-sm mt-6" style={{ color: "var(--color-danger)" }}>
          {state.message}
        </p>
      )}

      {state.kind === "ready" && state.partners.length === 0 && (
        <div
          className="mt-6 rounded-2xl border border-dashed p-8 text-center"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
        >
          <h2 className="text-lg font-black" style={{ color: "var(--color-text)" }}>
            No partners yet
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            Create a partner (admin) to begin distributing to a cohort.
          </p>
        </div>
      )}

      {state.kind === "ready" && state.partners.length > 0 && (
        <MotionList className="mt-6 grid gap-3" stagger={50}>
          {state.partners.map((p) => {
            const sts = settlements[p.id];
            const open = expanded[p.id] ?? false;
            return (
              <div
                key={p.id}
                className="rounded-2xl p-5"
                style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black" style={{ color: "var(--color-text)" }}>
                      {p.name}
                    </h2>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {p.key} · {p.partnerType}
                    </p>
                  </div>
                  <MotionStatus status={p.status} label={p.status} />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div>
                    <MotionNumber value={p.economics.members} tier="consequential" />
                    <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>members</p>
                  </div>
                  <div>
                    <MotionNumber value={p.economics.grossKes} currency="KES" tier="consequential" />
                    <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>verified activity</p>
                  </div>
                  <div>
                    {p.economics.partnerShareKes !== null ? (
                      <MotionNumber value={p.economics.partnerShareKes} currency="KES" tier="consequential" />
                    ) : (
                      <span style={{ color: "var(--color-text-muted)" }}>—</span>
                    )}
                    <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                      share {p.economics.shareRate !== null ? pct(p.economics.shareRate) : "(no agreement)"}
                    </p>
                  </div>
                </div>

                {p.programs.length > 0 && (
                  <p className="text-xs mt-3" style={{ color: "var(--color-text-muted)" }}>
                    {p.programs.map((pr) => pr.name).join(" · ")}
                    {p.programs.some((pr) => pr.cohorts.length > 0)
                      ? ` — ${p.programs.reduce((n, pr) => n + pr.cohorts.length, 0)} cohort(s)`
                      : ""}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => requestInvite(p)}
                    className="rounded-full px-4 py-2 text-xs font-bold"
                    style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}
                  >
                    Generate invite link
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleManage(p)}
                    className="rounded-full px-4 py-2 text-xs font-bold"
                    style={{ background: "var(--color-surface-elevated)", color: "var(--color-text)" }}
                  >
                    {open ? "Close" : "Agreement & settlement"}
                  </button>
                  {invites[p.id] !== undefined && (
                    invites[p.id] && invites[p.id]!.available ? (
                      <input
                        readOnly
                        value={invites[p.id]!.url}
                        aria-label={`Invite link for ${p.name}`}
                        className="flex-1 rounded-full px-3 py-2 text-xs border"
                        style={{ borderColor: "var(--color-border)", background: "var(--color-surface-elevated)" }}
                      />
                    ) : (
                      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {invites[p.id]?.reason === "public_origin_not_configured"
                          ? "No public origin configured — link unavailable."
                          : "Link unavailable."}
                      </span>
                    )
                  )}
                </div>

                {open && (
                  <div
                    className="mt-4 rounded-2xl p-4 space-y-4"
                    style={{ background: "var(--color-surface-elevated)" }}
                  >
                    {/* Agreement */}
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                        Revenue-share agreement
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          inputMode="decimal"
                          placeholder={p.economics.shareRate !== null ? `${(p.economics.shareRate * 100).toFixed(0)}` : "e.g. 20"}
                          value={shareInput[p.id] ?? ""}
                          aria-label={`Share percentage for ${p.name}`}
                          onChange={(e) => setShareInput((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          className="rounded-full px-3 py-2 text-xs border w-24"
                          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
                        />
                        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>%</span>
                        <button
                          type="button"
                          onClick={() => saveAgreement(p)}
                          disabled={busy[`agreement:${p.id}`]}
                          className="rounded-full px-4 py-2 text-xs font-bold"
                          style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}
                        >
                          {busy[`agreement:${p.id}`] ? "Saving…" : "Save agreement"}
                        </button>
                      </div>
                      {notice[`agreement:${p.id}`] && (
                        <p className="text-xs mt-1" style={{ color: "var(--color-danger)" }} role="alert">
                          {notice[`agreement:${p.id}`]}
                        </p>
                      )}
                    </div>

                    {/* Settlements */}
                    <div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                          Settlements
                        </p>
                        <button
                          type="button"
                          onClick={() => requestSettlement(p)}
                          disabled={busy[`settle:${p.id}`]}
                          className="rounded-full px-3 py-1.5 text-xs font-bold"
                          style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}
                        >
                          {busy[`settle:${p.id}`] ? "Requesting…" : "Request settlement"}
                        </button>
                      </div>
                      {notice[`settle:${p.id}`] && (
                        <p className="text-xs mt-1" style={{ color: "var(--color-danger)" }} role="alert">
                          {notice[`settle:${p.id}`]}
                        </p>
                      )}

                      {sts === undefined ? (
                        <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
                          Reading settlements…
                        </p>
                      ) : sts.length === 0 ? (
                        <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
                          No settlements yet. A settlement is requested only once there is qualifying activity.
                        </p>
                      ) : (
                        <ul className="mt-2 space-y-2">
                          {sts.map((s) => (
                            <li
                              key={s.id}
                              className="rounded-xl p-3"
                              style={{ background: "var(--color-surface)" }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
                                  KES {s.shareKes.toLocaleString()}
                                </span>
                                <MotionStatus status={s.status} label={s.status} tier="structural" />
                              </div>
                              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                                {pct(s.shareRate)} of KES {s.grossKes.toLocaleString()} verified activity
                                {s.periodFrom ? ` · ${s.periodFrom}` : ""}
                                {s.periodTo ? ` → ${s.periodTo}` : ""}
                              </p>
                              {s.refusedReason && (
                                <p className="text-xs mt-1" style={{ color: "var(--color-danger)" }}>
                                  Refused: {s.refusedReason}
                                </p>
                              )}

                              {s.status === "pending" && (
                                <div className="mt-2 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => confirmSettlement(p, s)}
                                    disabled={busy[`confirm:${s.id}`]}
                                    className="rounded-full px-3 py-1.5 text-xs font-bold"
                                    style={{ background: "var(--color-success)", color: "var(--accent-ink)" }}
                                  >
                                    {busy[`confirm:${s.id}`] ? "Confirming…" : "Confirm paid"}
                                  </button>
                                  <input
                                    type="text"
                                    placeholder="Reason to refuse"
                                    value={refuseNote[s.id] ?? ""}
                                    aria-label={`Refusal reason for ${s.id}`}
                                    onChange={(e) => setRefuseNote((prev) => ({ ...prev, [s.id]: e.target.value }))}
                                    className="flex-1 rounded-full px-3 py-1.5 text-xs border"
                                    style={{ borderColor: "var(--color-border)", background: "var(--color-surface-elevated)" }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => refuseSettlement(p, s)}
                                    disabled={busy[`refuse:${s.id}`]}
                                    className="rounded-full px-3 py-1.5 text-xs font-bold"
                                    style={{ background: "var(--color-danger)", color: "var(--accent-ink)" }}
                                  >
                                    Refuse
                                  </button>
                                </div>
                              )}
                              {(notice[`confirm:${s.id}`] || notice[`refuse:${s.id}`]) && (
                                <p className="text-xs mt-1" style={{ color: "var(--color-danger)" }} role="alert">
                                  {notice[`confirm:${s.id}`] ?? notice[`refuse:${s.id}`]}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </MotionList>
      )}
    </section>
  );
}
