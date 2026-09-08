import {RequestQuoteButton} from "../quotes/RequestQuoteButton";
import { useMatchFreshness } from "./useMatchFreshness";
import React, { useEffect, useRef, useState } from "react";
import * as api from "../../api/briefApi";
import type {
  DemandMatch,
  RequestMatches as Result,
} from "../../api/matchTypes";
import type { DemandRequest } from "../../api/requestTypes";
import { SessionSignIn } from "../../components/SessionSignIn";
import { quantity, turnaround, date, supplyPath } from "../supply/shared";
import "./matching.css";
const labels = {
  strong: "Strong match",
  potential: "Potential match",
  sourcing_option: "Sourcing option",
};
export function RequestMatches({
  request: r,
  onReloadRequest,
}: {
  request: DemandRequest;
  onReloadRequest: () => void;
}) {
  const [data, setData] = useState<Result | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [auth, setAuth] = useState(false),
    [busy, setBusy] = useState(""),
    [reload, setReload] = useState(0),
    [tab, setTab] = useState<
      "suggested" | "saved" | "interested" | "dismissed"
    >("suggested"),
    [filters, setFilters] = useState({
      role: "",
      location: "",
      verification: "",
      capacity: "",
      turnaround: "",
    }),
    [notice, setNotice] = useState("");
  const key = useRef(crypto.randomUUID());
  useMatchFreshness(setReload, data?.generation?.expiresAt);
  const requestChanged = !!data && data.requestRevision !== r.revision;
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    api.getRequestMatches(r.id).then((res) => {
      if (!live) return;
      setLoading(false);
      if (res.ok) {
        setData(res.data);
        setAuth(false);
      } else {
        setData(null);
        setError(res.error);
        setAuth(res.status === 401);
      }
    });
    return () => {
      live = false;
    };
  }, [r.id, r.revision, r.status, reload]);
  const failed = (res: { error: string; status: number | null }) => {
    setError(res.error);
    setAuth(res.status === 401);
  };
  const act = async (
    m: DemandMatch,
    status: "saved" | "dismissed" | "viewed" | "suggested",
  ) => {
    setBusy(m.id);
    setError("");
    const res = await api.changeMatch(m.id, {
      status,
      revision: m.revision,
      requestRevision: r.revision,
    });
    setBusy("");
    if (!res.ok) {
      failed(res);
      return false;
    }
    setData((d) =>
      d
        ? {
            ...d,
            matches: d.matches.map((x) => (x.id === m.id ? res.data : x)),
          }
        : d,
    );
    if (status !== "viewed") {
      setNotice(
        status === "saved"
          ? "Participant saved for consideration. No inquiry sent."
          : status === "dismissed"
            ? "Suggestion dismissed. You can restore it from Dismissed."
            : "Suggestion restored.",
      );
      setReload((n) => n + 1);
    }
    return true;
  };
  const all = data?.matches ?? [];
  const counts = {
    suggested: all.filter(
      (m) => !m.stale && ["suggested", "viewed"].includes(m.requesterState),
    ).length,
    saved: all.filter((m) => m.requesterState === "saved").length,
    interested: all.filter((m) => m.interested).length,
    dismissed: all.filter((m) => m.requesterState === "dismissed").length,
  };
  const rows = all.filter(
    (m) =>
      (tab === "suggested"
        ? !m.stale && ["suggested", "viewed"].includes(m.requesterState)
        : tab === "interested"
          ? m.interested
          : m.requesterState === tab) &&
      (!filters.role || m.matchType === filters.role) &&
      (!filters.location ||
        m.participant?.location
          .toLowerCase()
          .includes(filters.location.toLowerCase())) &&
      (!filters.verification || m.signals?.verified) &&
      (!filters.capacity ||
        (filters.capacity === "compatible"
          ? m.signals?.quantity === "compatible"
          : m.capabilities.some(
              (c) =>
                c.typicalCapacity !== null ||
                c.maximumQuantity !== null ||
                c.availableCapacity !== null,
            ))) &&
      (!filters.turnaround ||
        (filters.turnaround === "compatible"
          ? m.signals?.time === "compatible"
          : m.capabilities.some((c) => c.leadTime.maxDays !== null))),
  );
  const render = (m: DemandMatch) => (
    <article key={m.id} className="match-option" data-testid="match-option">
      <div className="supply-row-head">
        <div>
          <span className="request-eyebrow">
            {m.matchType === "hybrid"
              ? "Hybrid enterprise"
              : m.matchType === "source"
                ? "Can source this"
                : "Can supply directly"}
          </span>
          <h3>
            {m.participant?.displayName ??
              "Previously suggested participant unavailable"}
          </h3>
          <p>
            {m.participant?.location} · {m.participant?.roleLabel}
          </p>
        </div>
        <span className="supply-badge">
          {m.stale ? "Refresh required" : labels[m.tier!]}
        </span>
      </div>
      {m.stale ? (
        <p className="match-warning">
          {m.staleReason} This saved relationship is historical, not a current
          recommendation.
        </p>
      ) : (
        <>
          <h4>Relevant capabilities</h4>
          <ul className="match-capabilities">
            {m.capabilities.map((c) => (
              <li key={c.id}>
                <strong>{c.name}</strong> ·{" "}
                {c.supplyMode === "source" ? "Can source" : "Supplies directly"}
                <br />
                <span>
                  {quantity(c.typicalCapacity)}{" "}
                  {c.typicalCapacity !== null
                    ? `${c.unit} / ${c.capacityPeriod.replace(/_/g, " ")}`
                    : "capacity"}{" "}
                  · {turnaround(c.leadTime)} ·{" "}
                  {c.verification.status === "verified"
                    ? "Capability verified"
                    : "Capability self-declared"}
                </span>
                {c.availableCapacity !== null && (
                  <>
                    <br />
                    <span>
                      Declared available: {quantity(c.availableCapacity)}{" "}
                      {c.unit}. Not confirmed live stock.
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
          <h4>Why this participant appears</h4>
          <ul className="match-reasons">
            {m.matchReasons.map((x) => (
              <li key={x.code}>
                <span aria-hidden="true">✓</span> {x.text}
              </li>
            ))}
          </ul>
          <details className="match-warnings" open={m.tier !== "strong"}>
            <summary>
              What still needs confirmation ({m.warnings.length})
            </summary>
            <ul>
              {m.warnings.map((x) => (
                <li key={x.code}>{x.text}</li>
              ))}
            </ul>
          </details>
          <p className="request-hint">
            This participant appears capable of helping. It is not a
            fulfillment, stock or price commitment.
          </p>
        </>
      )}
      {m.interested && (
        <p className="match-interest">
          {m.interest?.current
            ? "This participant indicated “I can help.” Availability is not promised."
            : "Interest was recorded for earlier requirements. Ask for reconfirmation after refreshing."}
        </p>
      )}
      <div className="request-actions">
        {!m.stale && m.requesterState !== "dismissed" && <RequestQuoteButton match={m} requestRevision={r.revision} disabled={!!busy || auth || loading || requestChanged}/> }
        {m.stale && m.requesterState !== "dismissed" && (
          <button
            disabled={!!busy || auth || loading || requestChanged}
            onClick={() => act(m, "dismissed")}
          >
            Dismiss
          </button>
        )}
        {m.participant && (
          <button
            disabled={!!busy || auth || loading || requestChanged}
            onClick={async () => {
              if (
                m.requesterState === "suggested" &&
                !m.stale &&
                !(await act(m, "viewed"))
              )
                return;
              supplyPath(`profile/${m.participantId}`);
            }}
          >
            View profile
          </button>
        )}
        {!m.stale && (
          <>
            {m.requesterState !== "saved" &&
              m.requesterState !== "dismissed" && (
                <button
                  className="request-primary"
                  disabled={!!busy || auth || loading || requestChanged}
                  onClick={() => act(m, "saved")}
                >
                  Save
                </button>
              )}
            {m.requesterState === "dismissed" ? (
              <button
                disabled={!!busy || auth || loading || requestChanged}
                onClick={() => act(m, "suggested")}
              >
                Restore suggestion
              </button>
            ) : (
              <button
                disabled={!!busy || auth || loading || requestChanged}
                onClick={() => act(m, "dismissed")}
              >
                Dismiss
              </button>
            )}
          </>
        )}
      </div>
      <small className="match-date">
        Assessed {date(m.updatedAt)} · Request revision {m.requestRevision}
      </small>
    </article>
  );
  return (
    <section
      className="request-panel matching-workspace"
      aria-labelledby="matching-heading"
    >
      <div className="supply-row-head">
        <div>
          <span className="request-eyebrow">Demand → productive capacity</span>
          <h2 id="matching-heading">Who may be able to help?</h2>
        </div>
        {["matching","quoted"].includes(r.status) && (
          <button
            className="request-primary"
            disabled={!!busy || loading || auth || requestChanged}
            onClick={async () => {
              setBusy("refresh");
              setError("");
              const res = await api.refreshRequestMatches(r.id, {
                requestRevision: r.revision,
                generationRevision: data?.generation?.revision ?? 0,
                idempotencyKey: key.current,
              });
              setBusy("");
              if (res.ok) {
                setData(res.data);
                key.current = crypto.randomUUID();
                setNotice(
                  "Matches refreshed against the current Request and supply information.",
                );
              } else failed(res);
            }}
          >
            Refresh matches
          </button>
        )}
      </div>
      <p>
        Actual capabilities, compared with your quantity, location and deadline.
        Reasons first—not scores, prices or promises.
      </p>
      {r.visibility === "private" ? (
        <p className="request-hint">
          Your Request is private. None of these participants can see it or
          express interest. Edit its visibility to share a limited brief with
          matched businesses.
        </p>
      ) : (
        <p className="request-hint">
          Matched businesses can see your shared title, category, quantity,
          unit, location and deadline. Budgets, description, delivery address,
          attachments and internal specifications remain private.
        </p>
      )}
      {auth && (
        <SessionSignIn
          title="Sign in to manage your matches"
          onSignedIn={() => {
            setAuth(false);
            setReload((n) => n + 1);
          }}
        />
      )}
      {error && (
        <p className="request-error" role="alert">
          {error}{" "}
          <button
            onClick={() => {
              key.current = crypto.randomUUID();
              setReload((n) => n + 1);
            }}
          >
            Reload matches
          </button>
        </p>
      )}
      {notice && (
        <p role="status" className="supply-notice">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Loading matches…</p>
      ) : (
        data && (
          <>
            {requestChanged && (
              <div className="match-warning" role="status">
                <p>
                  This Request changed in another session. Reload the Request to
                  review the latest requirements.
                </p>
                <button onClick={onReloadRequest}>
                  Reload current Request
                </button>
              </div>
            )}
            {data.stale && (
              <p className="match-warning" role="status">
                {["matching","quoted"].includes(r.status)
                  ? "Requirements, supply details or assessment time changed. Refresh matches before relying on these suggestions."
                  : "This Request is no longer actively matching. Relationships are retained as history."}
              </p>
            )}
            {!["matching","quoted"].includes(r.status) && !data.generation ? (
              <p>
                Submit your Request, then mark it ready for matching. Brief will
                evaluate published capabilities on the server.
              </p>
            ) : (
              <>
                <nav className="match-tabs" aria-label="Match views">
                  {(
                    ["suggested", "saved", "interested", "dismissed"] as const
                  ).map((t) => (
                    <button
                      key={t}
                      aria-pressed={tab === t}
                      onClick={() => setTab(t)}
                    >
                      {t[0].toUpperCase() + t.slice(1)} ({counts[t]})
                    </button>
                  ))}
                </nav>
                <details className="match-filters">
                  <summary>Filter potential matches</summary>
                  <div className="request-form-grid">
                    <label>
                      Supply role
                      <select
                        value={filters.role}
                        onChange={(e) =>
                          setFilters((f) => ({ ...f, role: e.target.value }))
                        }
                      >
                        <option value="">All roles</option>
                        <option value="direct">Direct supplier</option>
                        <option value="source">Sourcing agent</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </label>
                    <label>
                      Participant location
                      <input
                        value={filters.location}
                        onChange={(e) =>
                          setFilters((f) => ({
                            ...f,
                            location: e.target.value,
                          }))
                        }
                        maxLength={160}
                      />
                    </label>
                    <label>
                      Capability verification
                      <select
                        value={filters.verification}
                        onChange={(e) =>
                          setFilters((f) => ({
                            ...f,
                            verification: e.target.value,
                          }))
                        }
                      >
                        <option value="">Declared or verified</option>
                        <option value="verified">Verified capability</option>
                      </select>
                    </label>
                    <label>
                      Capacity
                      <select
                        value={filters.capacity}
                        onChange={(e) =>
                          setFilters((f) => ({
                            ...f,
                            capacity: e.target.value,
                          }))
                        }
                      >
                        <option value="">Any / not stated</option>
                        <option value="known">Capacity stated</option>
                        <option value="compatible">
                          Quantity appears compatible
                        </option>
                      </select>
                    </label>
                    <label>
                      Turnaround
                      <select
                        value={filters.turnaround}
                        onChange={(e) =>
                          setFilters((f) => ({
                            ...f,
                            turnaround: e.target.value,
                          }))
                        }
                      >
                        <option value="">Any / not stated</option>
                        <option value="known">Turnaround stated</option>
                        <option value="compatible">
                          Deadline appears compatible
                        </option>
                      </select>
                    </label>
                  </div>
                </details>
                {!rows.length && (
                  <div className="match-empty">
                    <h3>
                      {data.stale
                        ? "Refresh to see current suggestions"
                        : tab === "suggested"
                          ? "Brief hasn't found a strong capability match yet."
                          : `No ${tab} participants to show.`}
                    </h3>
                    <p>
                      {tab === "suggested"
                        ? "Clarify the product or service, broaden your location or requirements, or remove filters. Brief will not insert unrelated businesses."
                        : tab === "interested"
                          ? "Businesses can indicate interest only in a current, shared brief. Interest is not a confirmation."
                          : "View suggestions and choose who you want to consider."}
                    </p>
                  </div>
                )}
                {rows.some((m) => m.matchType !== "source") && (
                  <section aria-label="Potential suppliers">
                    <h3>Potential suppliers</h3>
                    {rows.filter((m) => m.matchType !== "source").map(render)}
                  </section>
                )}
                <section aria-label="Sourcing agents">
                  <h3>Sourcing agents</h3>
                  {rows.some((m) => m.matchType === "source") ? (
                    rows.filter((m) => m.matchType === "source").map(render)
                  ) : (
                    <p>
                      No sourcing options in this view. Verification and
                      sourcing roles are shown separately when available.
                    </p>
                  )}
                </section>
                {data.generation?.limited && (
                  <p className="request-hint">
                    Showing a bounded set of relevant participants, not an
                    exhaustive supplier search. Refine the Request to narrow the
                    candidate pool.
                  </p>
                )}
              </>
            )}
          </>
        )
      )}
    </section>
  );
}
