import {openWork} from "../work/navigation";
import React, { useEffect, useRef, useState } from "react";
import * as api from "../../api/briefApi";
import type {
  Quote,
  CommercialWorkspace,
  QuoteInvitation,
  QuoteAction,
} from "../../api/quoteTypes";
import { SessionSignIn } from "../../components/SessionSignIn";
import { useMatchFreshness } from "../matching/useMatchFreshness";
import { QuoteForm } from "./QuoteForm";
import { QuoteOffer } from "./QuoteOffer";
import { date } from "../supply/shared";
import "./quotes.css";
export function QuoteWorkspace({
  requestId,
  onRequestChanged,
}: {
  requestId?: string;
  onRequestChanged?: () => void;
}) {
  const buyer = !!requestId;
  const [data, setData] = useState<CommercialWorkspace>({
      invitations: [],
      quotes: [],
    }),
    [reload, setReload] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false),
    [busy, setBusy] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [decision, setDecision] = useState<{
      id: string;
      action: "accept" | "decline";
      revision: number;
      requestRevision: number;
      offerRevision: number;
    } | null>(null),
    [reason, setReason] = useState(""),
    [tab, setTab] = useState("all");
  const pending = useRef<{ signature: string; body: QuoteAction } | null>(null);
  const expiryTimes = data.quotes
    .filter((q) => ["submitted", "viewed", "revised"].includes(q.status))
    .map((q) => q.offers[q.offers.length - 1]?.terms.validUntil)
    .filter(Boolean)
    .map((d) => Date.parse(`${d}T23:59:59.999+03:00`))
    .filter((t) => t > Date.now() && t - Date.now() < 2e9);
  useMatchFreshness(
    setReload,
    expiryTimes.length
      ? new Date(Math.min(...expiryTimes)).toISOString()
      : undefined,
  );
  useEffect(() => {
    const f = () => setReload((n) => n + 1);
    window.addEventListener("brief:quotes-changed", f);
    return () => window.removeEventListener("brief:quotes-changed", f);
  }, []);
  useEffect(() => {
    let live = true;
    setLoading(true);
    (requestId ? api.getRequestQuotes(requestId) : api.getMyQuotes()).then(
      (r) => {
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
      },
    );
    return () => {
      live = false;
    };
  }, [requestId, reload]);
  const refresh = () => setReload((n) => n + 1);
  async function act(q: Quote, action: QuoteAction["action"]) {
    const pinned =
      decision?.id === q.id && ["accept", "decline"].includes(action)
        ? decision
        : null;
    const body = {
      action,
      revision: pinned?.revision ?? q.revision,
      requestRevision:
        pinned?.requestRevision ?? data.requestRevision ?? q.requestRevision,
      ...(action === "decline" ? { reason } : {}),
    };
    const signature = JSON.stringify({ id: q.id, ...body });
    if (pending.current?.signature !== signature)
      pending.current = {
        signature,
        body: { ...body, idempotencyKey: crypto.randomUUID() },
      };
    setBusy(q.id);
    setError("");
    const r = await api.changeRequestQuote(q.id, pending.current.body);
    setBusy("");
    if (r.ok) {
      pending.current = null;
      setDecision(null);
      setReason("");
      refresh();
      if (action === "accept") onRequestChanged?.();
    } else {
      setError(r.error);
      setAuth(r.status === 401);
    }
  }
  async function start(i: QuoteInvitation) {
    setBusy(i.id);
    const r = await api.startRequestQuote(i.id, i.revision);
    setBusy("");
    if (r.ok) {
      setData((d) => ({
        ...d,
        quotes: [...d.quotes.filter((q) => q.id !== r.data.id), r.data],
      }));
      setEditing(r.data.id);
    } else {
      setError(r.error);
      setAuth(r.status === 401);
    }
  }
  const rows = data.quotes.filter((q) => tab === "all" || q.status === tab);
  return (
    <section
      className="quote-workspace request-panel"
      aria-label={buyer ? "Request quotes" : "Commercial workspace"}
    >
      <span className="request-eyebrow">
        Commercial proposals · no money moves
      </span>
      <h2>
        {buyer
          ? data.acceptedQuote
            ? "Selected proposal"
            : "Quotes"
          : "Quote requests & my quotes"}
      </h2>
      <p>
        {buyer
          ? "Compare actual proposals: quantity, disclosed costs, relationship, timing and validity. Different quantities or currencies are not directly comparable."
          : "Respond to invitations addressed to your enterprise. Interest is not a promise of stock or availability."}
      </p>
      {data.acceptedQuote && (
        <p className="quote-selected" role="status">
          Quote version {data.acceptedQuote.offerRevision} selected. This is the
          commercial basis for the Work Order — not a paid order. Review Work for actual fulfillment progress.
        </p>
      )}
      {auth && (
        <SessionSignIn
          title="Sign in to manage quotes"
          onSignedIn={() => {
            setAuth(false);
            refresh();
          }}
        />
      )}
      {error && <p role="alert">{error}</p>}
      <button disabled={!!busy} onClick={refresh}>
        Reload quotes
      </button>
      {loading && <p role="status">Loading commercial records…</p>}
      {!loading && !error && !data.quotes.length && (
        <div className="quote-empty">
          <h3>No quotes yet.</h3>
          <p>
            {buyer
              ? "Request a quote from a relevant match. Only real submitted proposals will appear here."
              : "Start with a quote request from a matched customer. No proposals are created on your behalf."}
          </p>
        </div>
      )}
      {data.invitations.length > 0 && (
        <div className="quote-invitations">
          <h3>Quote requests</h3>
          {data.invitations.map((i) => (
            <article
              className="quote-invitation"
              data-testid="quote-invitation"
              key={i.id}
            >
              <h4>
                {buyer ? i.participant.displayName : i.requirements.title}
              </h4>
              <p>
                {i.capability.name} ·{" "}
                {buyer ? "Quote requested" : "Your matched capability"}
              </p>
              <p>
                {i.requirements.quantity?.toLocaleString("en-KE") ??
                  "Quantity not stated"}{" "}
                {i.requirements.unit} · {i.requirements.location} ·{" "}
                {i.requirements.requiredBy
                  ? `Needed by ${date(i.requirements.requiredBy)}`
                  : "No deadline stated"}
              </p>
              <details>
                <summary>Shared requirements</summary>
                {Object.entries(i.requirements.specifications)
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <p key={k}>
                      <strong>{k}: </strong>
                      {v}
                    </p>
                  ))}
                {i.requirements.requirements.map((r) => (
                  <p key={r.id}>
                    {r.label} · {r.quantity} {r.unit}
                  </p>
                ))}
                <p className="request-hint">
                  Explicitly shared with this participant. Budget, private
                  contacts and Request images remain private.
                </p>
              </details>
              {i.unavailableReason && (
                <p className="quote-warning">{i.unavailableReason}</p>
              )}
              {!buyer && !i.unavailableReason && (
                <div className="request-actions">
                  {!i.interested ? (
                    <button
                      disabled={!!busy || auth || loading}
                      onClick={async () => {
                        setBusy(i.id);
                        const r = await api.expressMatchInterest(
                          i.matchId,
                          i.currentRequestRevision,
                          i.matchRevision,
                        );
                        setBusy("");
                        if (r.ok) refresh();
                        else {
                          setError(r.error);
                          setAuth(r.status === 401);
                        }
                      }}
                    >
                      I can help with this Request
                    </button>
                  ) : (
                    <>
                      <span>Interest recorded</span>
                      <button
                        disabled={!!busy || auth || loading}
                        onClick={() => {
                          if (i.quoteId) {
                            setEditing(i.quoteId);
                            document
                              .getElementById(`quote-${i.quoteId}`)
                              ?.scrollIntoView({ behavior: "smooth" });
                          } else void start(i);
                        }}
                      >
                        {i.quoteId ? "Open my quote" : "Create quote"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {data.quotes.length > 0 && (
        <>
          <h3>{buyer ? "Commercial proposals" : "My quotes"}</h3>
          <label className="quote-filter">
            Quote status
            <select value={tab} onChange={(e) => setTab(e.target.value)}>
              <option value="all">All proposals</option>
              {[
                "draft",
                "submitted",
                "viewed",
                "revised",
                "accepted",
                "declined",
                "withdrawn",
                "expired",
              ].map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <div className="quote-list">
        {rows.map((q) => {
          const i = data.invitations.find((i) => i.id === q.quoteRequestId)!;
          const offer = q.offers[q.offers.length - 1];
          const active = ["submitted", "viewed", "revised"].includes(q.status);
          return (
            <article
              className={`quote-card ${q.status === "accepted" ? "quote-card-selected" : ""}`}
              data-testid="quote-card"
              id={`quote-${q.id}`}
              key={q.id}
            >
              <header>
                <div>
                  <span className="request-eyebrow">
                    {q.status}{" "}
                    {offer ? `· Quote v${offer.revision}` : "· Not submitted"}
                  </span>
                  <h3>
                    {buyer
                      ? offer?.participant.displayName
                      : i.requirements.title}
                  </h3>
                </div>
              </header>
              {offer && <QuoteOffer offer={offer} />}
              {q.workOrderId && <button onClick={()=>openWork(q.workOrderId!)}>Open Work Order</button>}
              {q.status === "accepted" && (
                <p className="quote-selected">
                  Accepted version {q.acceptedOfferRevision}. Commercial
                  selection only. No money has moved.
                </p>
              )}
              {q.stale && q.status !== "accepted" && (
                <p className="quote-warning">{q.staleReason}</p>
              )}
              {q.status === "expired" && (
                <p className="quote-warning">
                  This quote expired. It is not an active offer and cannot be
                  accepted.
                </p>
              )}
              <div className="request-actions">
                {buyer && active && (
                  <>
                    <button
                      disabled={!!busy || auth || loading}
                      onClick={() => void act(q, "view")}
                    >
                      Review quote
                    </button>
                    <button
                      className="request-primary"
                      disabled={!!busy || q.stale || auth || loading}
                      onClick={() =>
                        setDecision({
                          id: q.id,
                          action: "accept",
                          revision: q.revision,
                          requestRevision:
                            data.requestRevision ?? q.requestRevision,
                          offerRevision: offer!.revision,
                        })
                      }
                    >
                      Accept quote
                    </button>
                    <button
                      disabled={!!busy || auth || loading}
                      onClick={() =>
                        setDecision({
                          id: q.id,
                          action: "decline",
                          revision: q.revision,
                          requestRevision:
                            data.requestRevision ?? q.requestRevision,
                          offerRevision: offer!.revision,
                        })
                      }
                    >
                      Decline quote
                    </button>
                  </>
                )}
                {!buyer && q.status !== "accepted" && !i.unavailableReason && (
                  <button
                    disabled={!!busy || auth || loading}
                    onClick={() => setEditing(q.id)}
                  >
                    {offer ? "Revise quote" : "Edit draft"}
                  </button>
                )}
                {!buyer &&
                  [
                    "draft",
                    "submitted",
                    "viewed",
                    "revised",
                    "expired",
                  ].includes(q.status) && (
                    <button
                      disabled={!!busy || auth || loading}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Withdraw this proposal? Its history will be retained.",
                          )
                        )
                          void act(q, "withdraw");
                      }}
                    >
                      Withdraw quote
                    </button>
                  )}
              </div>
              {decision?.id === q.id && (
                <div
                  className="quote-consent"
                  role="group"
                  aria-label="Quote decision"
                >
                  <h4>
                    {decision.action === "accept"
                      ? `Select quote v${decision.offerRevision}?`
                      : "Decline this quote?"}
                  </h4>
                  <p>
                    {decision.action === "accept"
                      ? "Competing active proposals will be declined and retained in history. Selection is not payment or the start of fulfillment."
                      : "The participant will see this decision. The proposal remains in history."}
                  </p>
                  {decision.action === "decline" && (
                    <label>
                      Reason (optional)
                      <textarea
                        maxLength={300}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </label>
                  )}
                  {(q.revision !== decision.revision ||
                    data.requestRevision !== decision.requestRevision) && (
                    <p role="alert">
                      The commercial record changed. Close this confirmation and
                      review the current proposal before deciding.
                    </p>
                  )}
                  <button
                    disabled={
                      !!busy ||
                      auth ||
                      loading ||
                      q.revision !== decision.revision ||
                      data.requestRevision !== decision.requestRevision
                    }
                    className="request-primary"
                    onClick={() => void act(q, decision.action)}
                  >
                    {decision.action === "accept"
                      ? "Confirm acceptance"
                      : "Confirm decline"}
                  </button>
                  <button disabled={!!busy} onClick={() => setDecision(null)}>
                    Not now
                  </button>
                </div>
              )}
              {!buyer && editing === q.id && q.status !== "accepted" && (
                <QuoteForm
                  quote={q}
                  invitation={i}
                  onSaved={refresh}
                  onClose={() => setEditing(null)}
                />
              )}
              {q.offers.length > 1 && (
                <details>
                  <summary>
                    Previous commercial versions ({q.offers.length - 1})
                  </summary>
                  {q.offers.slice(0, -1).map((o) => (
                    <section className="quote-old-version" key={o.revision}>
                      <h4>Quote v{o.revision} — superseded</h4>
                      <p>
                        Submitted {date(o.submittedAt)} · Requirements revision{" "}
                        {o.requestRevision}
                      </p>
                      <QuoteOffer offer={o} />
                    </section>
                  ))}
                </details>
              )}
              <details>
                <summary>Commercial history</summary>
                <ol>
                  {q.history.map((e) => (
                    <li key={e.id}>
                      {e.action.split("_").join(" ")} ·{" "}
                      {e.actorId === q.requesterId
                        ? "Requester"
                        : "Participant"}{" "}
                      ·{" "}
                      {new Date(e.at).toLocaleString("en-KE", {
                        timeZone: "Africa/Nairobi",
                      })}
                      {e.offerRevision ? ` · v${e.offerRevision}` : ""}
                      {e.reason ? ` · ${e.reason}` : ""}
                    </li>
                  ))}
                </ol>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
