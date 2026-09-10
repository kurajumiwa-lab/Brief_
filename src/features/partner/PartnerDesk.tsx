import React, { useEffect, useState } from "react";
import * as api from "../../api/briefApi";
import type { PartnerView, JoinLink } from "../../api/briefApi";
import { MotionList } from "../../ui/motion/MotionList";
import { MotionNumber } from "../../ui/motion/MotionNumber";
import { MotionStatus } from "../../ui/motion/MotionStatus";

// ---------------------------------------------------------------------------
// PARTNER DESK — the operator surface for distribution partners (Phase 2).
//
// Lists the STORED partner records with their DERIVED economics (members,
// gross verified commercial activity, revenue share) and lets an operator
// generate the partner's join link — the deep link that attributes members at
// sign-up. Reads are operator-gated (moderate capability) on the server; a
// non-operator caller gets 403, which this desk reports honestly rather than
// fabricating partner data. Nothing here invents a partner or a shilling.
// ---------------------------------------------------------------------------

type LoadState =
  | { kind: "loading" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string }
  | { kind: "ready"; partners: PartnerView[] };

export function PartnerDesk() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [invites, setInvites] = useState<Record<string, JoinLink | null>>({});

  useEffect(() => {
    let live = true;
    api.getPartners().then((res) => {
      if (!live) return;
      if (!res.ok && res.status === 403) {
        setState({ kind: "forbidden" });
        return;
      }
      if (!res.ok) {
        setState({ kind: "error", message: res.error ?? "Could not read partners." });
        return;
      }
      setState({ kind: "ready", partners: res.data });
    });
    return () => {
      live = false;
    };
  }, []);

  const requestInvite = async (partner: PartnerView) => {
    const res = await api.getPartnerInviteLink(partner.id);
    setInvites((prev) => ({ ...prev, [partner.id]: res.ok ? res.data : null }));
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
          {state.partners.map((p) => (
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
                    share {p.economics.shareRate !== null ? `${(p.economics.shareRate * 100).toFixed(0)}%` : "(no agreement)"}
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
            </div>
          ))}
        </MotionList>
      )}
    </section>
  );
}
