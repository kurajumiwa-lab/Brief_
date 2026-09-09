import React, { useEffect, useState } from "react";
import * as api from "../../api/briefApi";
import type { TrustProfile } from "../../api/trustTypes";

// ---------------------------------------------------------------------------
// TRUST SECTION (Phase 7) — evidence-based, never a rating.
//
// Renders the participant's derived trust profile: scoped verification,
// economic history and explainable reliability signals. Every figure is a
// record of what actually happened; nothing here can be typed into a profile.
// A participant with no history shows "Limited fulfillment history" honestly.
// ---------------------------------------------------------------------------

const statusLabel = (s: string) =>
  s === "verified"
    ? "Verified"
    : s === "submitted" || s === "under_review"
      ? "Under review"
      : s === "rejected"
        ? "Rejected"
        : s === "expired"
          ? "Verification expired"
          : "Not verified";

export function TrustSection({ enterpriseId }: { enterpriseId: string }) {
  const [profile, setProfile] = useState<TrustProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.getPublicTrust(enterpriseId).then((res) => {
      if (!live) return;
      setLoading(false);
      if (res.ok) setProfile(res.data);
    });
    return () => {
      live = false;
    };
  }, [enterpriseId]);

  if (loading) return <p role="status">Reading trust history…</p>;
  if (!profile) return null;

  const v = profile.verification;
  const verifiedCount = [v.identity, v.businessType, v.sourcingRole].filter(
    (x) => x.status === "verified",
  ).length;

  return (
    <section className="supply-section" aria-labelledby="supply-trust">
      <div className="supply-row-head">
        <div>
          <span className="request-eyebrow">Evidence, not reputation</span>
          <h2 id="supply-trust">Trust & fulfillment history</h2>
        </div>
      </div>

      <dl className="supply-facts">
        <div>
          <dt>Identity</dt>
          <dd className={v.identity.status === "verified" ? "trust-ok" : ""}>
            {statusLabel(v.identity.status)}
          </dd>
        </div>
        <div>
          <dt>Business documents</dt>
          <dd className={v.businessType.status === "verified" ? "trust-ok" : ""}>
            {statusLabel(v.businessType.status)}
          </dd>
        </div>
        {v.sourcingRole.status !== "unverified" ||
        profile.history.completedWorkOrders > 0 ? (
          <div>
            <dt>Sourcing role</dt>
            <dd className={v.sourcingRole.status === "verified" ? "trust-ok" : ""}>
              {statusLabel(v.sourcingRole.status)}
            </dd>
          </div>
        ) : null}
      </dl>

      {profile.signals.limited ? (
        <p className="request-hint">
          Limited fulfillment history — this participant is new to Brief.
          There isn't enough completed-work history to show reliability signals
          yet.
        </p>
      ) : (
        <ul className="match-reasons">
          {profile.signals.statements.map((s, i) => (
            <li key={i}>
              <span aria-hidden="true">✓</span> {s}
            </li>
          ))}
        </ul>
      )}

      {profile.capabilities.some(
        (c) => c.history.completedWorkOrders > 0 || c.verification.status === "verified",
      ) && (
        <div className="trust-capabilities">
          <h4>By capability</h4>
          {profile.capabilities
            .filter(
              (c) =>
                c.history.completedWorkOrders > 0 ||
                c.verification.status === "verified",
            )
            .map((c) => (
              <p key={c.capabilityId} className="request-hint">
                <strong>{c.capabilityName ?? "Capability"}</strong> ·{" "}
                {c.verification.status === "verified"
                  ? "verified"
                  : "not yet verified"}{" "}
                · {c.history.completedWorkOrders} Work{" "}
                {c.history.completedWorkOrders === 1 ? "Order" : "Orders"} completed
                {c.history.repeatRelationships > 0
                  ? ` · ${c.history.repeatRelationships} repeat relationship${
                      c.history.repeatRelationships === 1 ? "" : "s"
                    }`
                  : ""}
              </p>
            ))}
        </div>
      )}

      <p className="supply-disclosure">
        Trust is a record of what actually happened — not a popularity contest.
        Verification is scoped to a subject and expires; it never implies an
        aggregate "fully verified" claim.
      </p>
    </section>
  );
}
