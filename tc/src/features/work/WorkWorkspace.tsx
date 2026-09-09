import React, { useEffect, useState } from "react";
import * as api from "../../api/briefApi";
import type {
  WorkOrder,
  WorkAction,
  WorkCollection,
} from "../../api/workTypes";
import { useMatchFreshness } from "../matching/useMatchFreshness";
import { SessionSignIn } from "../../components/SessionSignIn";
import { RequestImage } from "../matching/RequestImage";
import { money } from "../quotes/money";
import { WorkAgreement } from "./WorkAgreement";
import {
  WorkActionPanel,
  actionLabels,
  amendmentFields,
} from "./WorkActionPanel";
import { openWork } from "./navigation";
import { requestPath } from "../requests/RequestsWorkspace";
import { WorkPaymentSection } from "./WorkPaymentSection";
import "../quotes/quotes.css";
import "./work.css";
const words = (s: string) => s.split("_").join(" ");
function changeValue(field: string, value: unknown, currency: string) {
  if (value === null || value === undefined || value === "")
    return "Not stated";
  if (field === "otherCosts" && Array.isArray(value))
    return value.length
      ? value
          .map((c) => `${c.label}: ${money(c.amountMinor, currency)}`)
          .join("; ")
      : "No additional costs";
  if (field.endsWith("Minor") && typeof value === "number")
    return money(value, currency);
  return typeof value === "number"
    ? value.toLocaleString("en-KE")
    : String(value);
}
const stages = [
  "created",
  "specification_pending",
  "confirmed",
  "in_progress",
  "ready",
  "dispatched",
  "delivered",
  "completed",
];
const time = (s: string) =>
  new Date(s).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" });
export function WorkWorkspace({
  requestId,
  onRequestChanged,
}: {
  requestId?: string;
  onRequestChanged?: () => void;
}) {
  const [data, setData] = useState<WorkCollection>({ workOrders: [] }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false),
    [reload, setReload] = useState(0),
    [opened, setOpened] = useState<string | null>(() =>
      new URL(window.location.href).searchParams.get("work"),
    ),
    [filter, setFilter] = useState("all"),
    [creating, setCreating] = useState(false);
  useMatchFreshness(setReload);
  useEffect(() => {
    const fn = (e: Event) => {
      setOpened((e as CustomEvent<string>).detail);
      setFilter("all");
    };
    window.addEventListener("brief:work-open", fn);
    return () => window.removeEventListener("brief:work-open", fn);
  }, []);
  useEffect(() => {
    let live = true;
    setLoading(true);
    (requestId ? api.getRequestWork(requestId) : api.getMyWork()).then((r) => {
      if (!live) return;
      setLoading(false);
      if (r.ok) {
        setData(r.data);
        setError("");
        setAuth(false);
      } else {
        setError(r.error);
        setAuth(r.status === 401);
      }
    });
    return () => {
      live = false;
    };
  }, [requestId, reload]);
  useEffect(() => {
    if (opened)
      document
        .getElementById(`work-${opened}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [opened, data.workOrders.length]);
  const refreshed = () => {
    setReload((n) => n + 1);
    onRequestChanged?.();
  };
  const rows = data.workOrders.filter(
    (w) =>
      filter === "all" ||
      (filter === "active" && !["completed", "cancelled"].includes(w.status)) ||
      (filter === "awaiting_confirmation" &&
        ["created", "specification_pending"].includes(w.status)) ||
      w.status === filter,
  );
  return (
    <section
      className="work-workspace quote-workspace request-panel"
      aria-label={requestId ? "Request work" : "Business work"}
    >
      <span className="request-eyebrow">Execution · real recorded work</span>
      <h2>{requestId ? "Work Order" : "Work you are responsible for"}</h2>
      <p>
        Frozen commercial terms. Explicit actions by both parties. No payment,
        stock or delivery is inferred.
      </p>
      {error && <p role="alert">{error}</p>}
      {auth && (
        <SessionSignIn
          title="Sign in to view your work"
          onSignedIn={() => {
            setAuth(false);
            setReload((n) => n + 1);
          }}
        />
      )}
      <button disabled={creating} onClick={() => setReload((n) => n + 1)}>
        Reload work
      </button>
      {loading && <p role="status">Loading work records…</p>}
      {!loading && !error && !data.workOrders.length && (
        <div className="work-empty">
          <h3>No Work Orders yet.</h3>
          <p>
            {data.acceptedQuoteId
              ? "An accepted quote exists, but no Work Order has been created. Create it from the selected version."
              : "Accepted proposals will appear here as real Work Orders. No progress is generated in advance."}
          </p>
          {requestId && data.acceptedQuoteId && (
            <button
              disabled={creating || auth}
              onClick={async () => {
                setCreating(true);
                const r = await api.createWorkOrder(data.acceptedQuoteId!);
                setCreating(false);
                if (r.ok) {
                  refreshed();
                  openWork(r.data.id);
                } else {
                  setError(r.error);
                  setAuth(r.status === 401);
                }
              }}
            >
              Create Work Order
            </button>
          )}
        </div>
      )}
      {data.workOrders.length > 0 && (
        <label className="quote-filter">
          Work stage
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {[
              "all",
              "active",
              "awaiting_confirmation",
              "in_progress",
              "ready",
              "dispatched",
              "delivered",
              "completed",
              "cancelled",
              "disputed",
            ].map((s) => (
              <option key={s} value={s}>
                {words(s)}
              </option>
            ))}
          </select>
        </label>
      )}
      {!loading && data.workOrders.length > 0 && !rows.length && (
        <p>No Work Orders at this stage.</p>
      )}
      {rows.map((w) => (
        <WorkCard
          key={w.id}
          work={w}
          open={opened === w.id || (!opened && rows.length === 1)}
          onOpen={() => openWork(w.id)}
          onSaved={refreshed}
        />
      ))}
    </section>
  );
}
function WorkCard({
  work: w,
  open,
  onOpen,
  onSaved,
}: {
  work: WorkOrder;
  open: boolean;
  onOpen: () => void;
  onSaved: () => void;
}) {
  const [dialog, setDialog] = useState<{
    action: WorkAction;
    amendmentId?: string;
  } | null>(null);
  const a = w.agreements[w.agreements.length - 1],
    pending = w.amendments.find((a) => a.status === "pending"),
    recorded = new Set(w.milestones.map((m) => m.status));
  const primary = w.actions.filter(
    (a) => !["propose_amendment", "cancel", "raise_issue"].includes(a),
  );
  const additional = w.actions.filter((a) =>
    ["propose_amendment", "cancel", "raise_issue"].includes(a),
  );
  const next =
    w.status === "completed"
      ? "The requester confirmed completion. This is not payment confirmation."
      : w.status === "cancelled"
        ? "Cancelled before work started. History and the original quote are retained."
        : w.status === "disputed"
          ? "Work is paused. Both parties must confirm that the issue is resolved."
          : pending
            ? "Review the pending amendment before advancing work."
            : w.confirmations[w.viewerRole] &&
                w.status === "specification_pending"
              ? "Waiting for the other party to confirm this agreement version."
              : w.status === "delivered"
                ? "Delivery has been recorded. Only the requester can confirm completion."
                : w.viewerRole === "requester" &&
                    [
                      "confirmed",
                      "in_progress",
                      "ready",
                      "dispatched",
                    ].includes(w.status)
                  ? "Review the participant’s recorded progress. No stage advances automatically."
                  : "Use the next explicit action below when the real milestone has happened.";
  return (
    <article className="work-card" data-testid="work-card" id={`work-${w.id}`}>
      <header className="work-card-header">
        <div>
          <span className={`work-status is-${w.status}`}>
            {words(w.status)}
          </span>
          <h3>{a.requirements.title}</h3>
          <p>
            {w.participant.displayName} · {w.participant.capabilityName}
          </p>
        </div>
        <strong>{money(a.terms.totalMinor, a.terms.currency)}</strong>
      </header>
      {!open && <button onClick={onOpen}>Open Work Order</button>}
      {open && (
        <>
          <ol className="work-stages" aria-label="Recorded fulfillment stages">
            {stages.map((s) => (
              <li
                key={s}
                className={
                  w.status === s
                    ? "current"
                    : recorded.has(s as WorkOrder["status"])
                      ? "recorded"
                      : ""
                }
              >
                <span>
                  {recorded.has(s as WorkOrder["status"]) ? "✓" : "○"}
                </span>{" "}
                {words(s)}
                {w.status === s && <strong> · current</strong>}
              </li>
            ))}
          </ol>
          <div className="work-next">
            <h4>What happens next</h4>
            <p>{next}</p>
          </div>
          <p className="request-hint">
            Work revision {w.revision} · Agreement version {a.revision} ·
            Accepted Quote v{w.acceptedOfferRevision}
          </p>
          <div className="work-confirmations">
            <span>
              Requester:{" "}
              {w.confirmations.requester
                ? `confirmed v${w.confirmations.requester.agreementRevision}`
                : "awaiting confirmation"}
            </span>
            <span>
              Participant:{" "}
              {w.confirmations.participant
                ? `confirmed v${w.confirmations.participant.agreementRevision}`
                : "awaiting confirmation"}
            </span>
          </div>
          <WorkAgreement work={w} agreement={a} />
          <WorkPaymentSection
            workOrderId={w.id}
            requesterView={w.viewerRole === "requester"}
            agreementTotalMinor={a.terms.totalMinor ?? 0}
            agreementCurrency={a.terms.currency}
            sourcingBreakdown={{
              sourceCostMinor: a.terms.subtotalMinor ?? null,
              sourcingFeeMinor: a.terms.sourcingFeeMinor ?? 0,
              logisticsCostMinor: a.terms.deliveryCostMinor ?? 0,
            }}
          />
          <div className="request-actions work-actions">
            {primary.map((action) => (
              <button
                key={action}
                className={
                  [
                    "confirm_specifications",
                    "start",
                    "ready",
                    "dispatch",
                    "deliver",
                    "complete",
                    "resolve_issue",
                  ].includes(action)
                    ? "request-primary"
                    : ""
                }
                disabled={!!dialog}
                onClick={() => setDialog({ action })}
              >
                {actionLabels[action]}
              </button>
            ))}
          </div>
          {w.status === "completed" && w.viewerRole === "requester" && (
            <button
              className="request-primary"
              onClick={() => requestPath("procurement")}
            >
              ↻ Request again
            </button>
          )}
          {additional.length > 0 && (
            <details>
              <summary>Changes, cancellation & issues</summary>
              <div className="request-actions">
                {additional.map((action) => (
                  <button
                    disabled={!!dialog}
                    key={action}
                    onClick={() => setDialog({ action })}
                  >
                    {actionLabels[action]}
                  </button>
                ))}
              </div>
              <p className="request-hint">
                Cancellation is limited to before work starts. After progress,
                record an issue rather than silently cancelling.
              </p>
            </details>
          )}
          {w.issue && (
            <section className="work-warning">
              <h4>
                {w.status === "disputed"
                  ? "Issue awaiting resolution"
                  : "Recorded issue"}
              </h4>
              <p>{w.issue.reason}</p>
              <p>
                {w.issue.resolvedAt
                  ? `Both parties confirmed resolution ${time(w.issue.resolvedAt)}`
                  : "No arbitration or financial resolution has been performed."}
              </p>
            </section>
          )}
          {w.amendments.length > 0 && (
            <section className="work-amendments">
              <h3>Agreement amendments</h3>
              {w.amendments.map((am) => {
                const mine =
                  (am.proposedBy === w.requesterId) ===
                  (w.viewerRole === "requester");
                return (
                  <article
                    key={am.id}
                    className="work-amendment"
                    data-testid="work-amendment"
                  >
                    <h4>
                      {words(am.status)} · amendment to v
                      {am.baseAgreementRevision}
                    </h4>
                    <p>{am.reason}</p>
                    <p>
                      {time(am.proposedAt)} · proposed by{" "}
                      {am.proposedBy === w.requesterId
                        ? "requester"
                        : "participant"}
                    </p>
                    <dl>
                      {am.changes.map((c) => (
                        <div key={c.field}>
                          <dt>{amendmentFields[c.field] ?? c.field}</dt>
                          <dd>
                            <span>
                              Before:{" "}
                              {changeValue(
                                c.field,
                                c.previous,
                                am.previous.terms.currency,
                              )}
                            </span>
                            <span>
                              Proposed:{" "}
                              {changeValue(
                                c.field,
                                c.proposed,
                                am.proposed.terms.currency,
                              )}
                            </span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p>
                      Previous total:{" "}
                      {money(
                        am.previous.terms.totalMinor,
                        am.previous.terms.currency,
                      )}{" "}
                      · Proposed total:{" "}
                      {money(
                        am.proposed.terms.totalMinor,
                        am.proposed.terms.currency,
                      )}
                    </p>
                    <details>
                      <summary>Review complete proposed agreement</summary>
                      <WorkAgreement
                        work={w}
                        agreement={am.proposed}
                        proposed
                      />
                    </details>
                    {am.status === "pending" && !mine && (
                      <div className="request-actions">
                        <button
                          disabled={!!dialog}
                          onClick={() =>
                            setDialog({
                              action: "accept_amendment",
                              amendmentId: am.id,
                            })
                          }
                        >
                          Accept amendment
                        </button>
                        <button
                          disabled={!!dialog}
                          onClick={() =>
                            setDialog({
                              action: "reject_amendment",
                              amendmentId: am.id,
                            })
                          }
                        >
                          Reject amendment
                        </button>
                      </div>
                    )}
                    {am.decisionNote && <p>{am.decisionNote}</p>}
                  </article>
                );
              })}
            </section>
          )}
          {dialog && (
            <WorkActionPanel
              key={`${dialog.action}:${dialog.amendmentId ?? ""}`}
              work={w}
              action={dialog.action}
              amendmentId={dialog.amendmentId}
              onSaved={onSaved}
              onClose={() => setDialog(null)}
            />
          )}
          {w.evidence.length > 0 && (
            <section>
              <h3>Permitted evidence</h3>
              {w.evidence.map((e) => (
                <div className="work-evidence" key={e.id}>
                  <h4>{words(e.type)}</h4>
                  <p>{e.description}</p>
                  <p>
                    {time(e.timestamp)} ·{" "}
                    {e.uploadedBy === w.requesterId
                      ? "Requester"
                      : "Participant"}{" "}
                    · {e.visibility === "shared" ? "Both parties" : "Only you"}{" "}
                    · {words(e.milestone)} · agreement v{e.agreementRevision}
                  </p>
                  <p className="request-hint">
                    Uploaded evidence, not independently verified by Brief.
                  </p>
                  <RequestImage
                    id={e.uploadId}
                    name={`Work evidence ${e.type.replace(/_/g, " ")}`}
                  />
                </div>
              ))}
            </section>
          )}
          {w.privateSource &&
            (w.privateSource.reference || w.privateSource.notes) && (
              <details>
                <summary>Your private source information</summary>
                <p>{w.privateSource.reference}</p>
                <p>{w.privateSource.notes}</p>
              </details>
            )}
          <section className="work-timeline">
            <h3>Work activity</h3>
            <ol>
              {w.history.map((e) => (
                <li key={e.id}>
                  <strong>{words(e.action)}</strong>
                  <p>
                    {e.actorId === w.requesterId ? "Requester" : "Participant"}{" "}
                    · {time(e.at)} · agreement v{e.agreementRevision} · work r
                    {e.revision}
                    {e.visibility === "private" ? " · Only you" : ""}
                  </p>
                  {e.toStatus && e.fromStatus !== e.toStatus && (
                    <p>
                      {e.fromStatus ? `${words(e.fromStatus)} → ` : ""}
                      {words(e.toStatus)}
                    </p>
                  )}
                  {e.note && <p className="quote-text">{e.note}</p>}
                </li>
              ))}
            </ol>
          </section>
          <details>
            <summary>Original accepted agreement & version history</summary>
            <WorkAgreement work={w} agreement={w.originalAgreement} />
            {w.agreements.slice(1).map((ag) => (
              <WorkAgreement key={ag.revision} work={w} agreement={ag} />
            ))}
          </details>
          {w.completion && (
            <p className="work-completion">
              Completion confirmed by the requester on{" "}
              {time(w.completion.completedAt)} against agreement v
              {w.completion.agreementRevision}. Final agreed value:{" "}
              {money(
                w.completion.agreement.terms.totalMinor,
                w.completion.agreement.terms.currency,
              )}
              . No payment confirmation is recorded.
            </p>
          )}
        </>
      )}
    </article>
  );
}
