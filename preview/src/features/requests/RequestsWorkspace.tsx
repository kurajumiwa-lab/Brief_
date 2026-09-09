import {WorkWorkspace} from "../work/LazyWork";
import {QuoteWorkspace} from "../quotes/LazyQuotes";
import { RequestMatches } from "../matching/RequestMatches";
import { RequestImage } from "../matching/RequestImage";
import { RequestPotentialParticipants } from "../supply/RequestPotentialParticipants";
import { ProcurementWorkspace } from "../procurement/ProcurementWorkspace";
import "../supply/supply.css";
import { SessionSignIn } from "../../components/SessionSignIn";
import React, { useEffect, useState } from "react";
import * as api from "../../api/briefApi";
import type {
  DemandRequest,
  RequestInput,
  RequestStatus,
  BusinessContext,
} from "../../api/requestTypes";
import { specificationFields } from "../../api/requestTypes";
import "./requests.css";

const date = (value: string | null) =>
  value
    ? new Date(
        value.length === 10 ? `${value}T12:00:00` : value,
      ).toLocaleDateString("en-KE", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not specified";
const label = (value: string) => value.replace(/_/g, " ");
export const requestPath = (id?: string) => {
  window.location.hash = id ? `requests/${encodeURIComponent(id)}` : "requests";
};
const emptyInput = (): RequestInput => ({
  title: "",
  description: "",
  category: "",
  subcategory: "",
  quantity: null,
  unit: "",
  budgetMin: null,
  budgetMax: null,
  currency: "KES",
  location: "",
  deliveryLocation: "",
  requiredBy: null,
  urgency: "standard",
  specifications: {},
  attachments: [],
  requesterType: "business",
  businessContext: {},
  preferredSupplierType: "any",
  visibility: "private",
});
function editable(row: DemandRequest): RequestInput {
  // Only editable demand fields travel back to the strict mutation API.
  // Commercial selection and revision metadata must never become input.
  const fields = Object.fromEntries(Object.keys(emptyInput()).map(k =>
    [k, row[k as keyof DemandRequest]])) as unknown as RequestInput;
  return {...fields, requirements: row.requirements ?? [],
    ...(row.origin ? {origin:row.origin} : {}),
    attachments:row.attachments.map(a => ({uploadId:a.uploadId}))};
}

export function RequestEntry() {
  return (
    <section className="request-entry" aria-label="Business requests">
      <div>
        <span className="request-eyebrow">Brief for business</span>
        <h1>What do you need?</h1>
        <p>
          Packaging, printing, logistics or something else. Start with a
          Request.
        </p>
      </div>
      <div className="request-actions">
        <button className="request-primary" onClick={() => requestPath("new")}>
          Create a Request <span aria-hidden="true">↗</span>
        </button>
        <button onClick={() => requestPath()}>My Requests</button>
        <button onClick={() => { window.location.hash = "supply/mine"; }}>Our capabilities</button>
      </div>
    </section>
  );
}

const groups: Record<string, RequestStatus[]> = {
  Open: ["open"],
  Active: ["matching", "quoted", "in_progress"],
  Completed: ["completed"],
  Drafts: ["draft"],
  Closed: ["cancelled", "expired"],
};
export function RequestsWorkspace({ route = "" }: { route?: string }) {
  const [rows, setRows] = useState<DemandRequest[]>([]);
  const [current, setCurrent] = useState<DemandRequest | null>(null);
  const [tab, setTab] = useState("Open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsAuth, setNeedsAuth] = useState(false);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [notice, setNotice] = useState("");
  const refresh = () => setReload((n) => n + 1);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    setEditing(false);
    setConfirmCancel(false);
    setCurrent(null);
    (async () => {
      const res =
        route && route !== "new"
          ? await api.getRequest(route)
          : await api.listMyRequests();
      if (!live) return;
      setLoading(false);
      if (!res.ok) {
        setNeedsAuth(res.status === 401);
        setError(res.status === 401 ? "" : res.error);
        return;
      }
      setNeedsAuth(false);
      if (Array.isArray(res.data)) setRows(res.data);
      else setCurrent(res.data);
    })();
    return () => {
      live = false;
    };
  }, [route, reload]);
  const saved = (row: DemandRequest) => {
    setCurrent(row);
    setEditing(false);
    setNotice("Request saved");
    if (route !== row.id) requestPath(row.id);
  };
  const transition = async (status: RequestStatus) => {
    if (!current) return;
    setBusy(true);
    setError("");
    const res = await api.changeRequestStatus(
      current.id,
      status,
      current.revision,
    );
    setBusy(false);
    if (res.ok) {
      setCurrent(res.data);
      setConfirmCancel(false);
      setNotice(
        status === "cancelled" ? "Request cancelled" : "Request status updated",
      );
    } else {
      setNeedsAuth(res.status === 401);
      setError(res.error);
    }
  };
  const filtered = rows.filter((r) => groups[tab].includes(r.status));
  if (route === "procurement")
    return <ProcurementWorkspace onOpenRequest={requestPath} />;
  return (
    <div className="requests-workspace">
      <header className="request-workspace-header">
        <div>
          <span className="request-eyebrow">Demand, clearly defined</span>
          <h1>
            {route === "new"
              ? "Create a Request"
              : route
                ? "Your Request"
                : "My Requests"}
          </h1>
        </div>
        <button onClick={() => (route ? requestPath() : requestPath("new"))}>
          {route ? "← My Requests" : "+ Create a Request"}
        </button>
      </header>
      {notice && (
        <p role="status" className="request-notice">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Loading your Requests…</p>
      ) : needsAuth ? (
        <SessionSignIn onSignedIn={refresh} />
      ) : (
        <>
          {error && (
            <div role="alert" className="request-error">
              {error} <button onClick={refresh}>Reload / retry</button>
            </div>
          )}
          {(route === "new" || (current && editing)) && (
            <RequestForm
              key={current?.id || "new"}
              initial={editing ? current! : undefined}
              onSaved={saved}
              onReload={refresh}
              onCancel={() => (editing ? setEditing(false) : requestPath())}
            />
          )}
          {current && !editing && (
            <>
              <article className="request-panel request-detail">
                <div className="request-meta">
                  <span className={`request-status is-${current.status}`}>
                    {label(current.status)}
                  </span>
                  <span>Created {date(current.createdAt)}</span>
                  <span>Updated {date(current.updatedAt)}</span>
                </div>
                <h2>{current.title}</h2>
                <p className="request-description">
                  {current.description || "No description added yet."}
                </p>
                <dl className="request-facts">
                  <Fact
                    name="Quantity"
                    value={
                      current.quantity !== null
                        ? `${current.quantity.toLocaleString("en-KE")} ${current.unit}`
                        : "Not specified"
                    }
                  />
                  <Fact
                    name="Location"
                    value={current.location || "Not specified"}
                  />
                  <Fact
                    name="Delivery location"
                    value={current.deliveryLocation || "To be agreed"}
                  />
                  <Fact name="Required by" value={date(current.requiredBy)} />
                  <Fact name="Urgency" value={label(current.urgency)} />
                  <Fact
                    name="Category"
                    value={
                      [current.category, current.subcategory]
                        .filter(Boolean)
                        .join(" / ") || "Not specified"
                    }
                  />
                  {(current.budgetMin !== null ||
                    current.budgetMax !== null) && (
                    <Fact
                      name="Budget"
                      value={`${current.currency} ${current.budgetMin !== null ? current.budgetMin.toLocaleString("en-KE") : "Not set"} – ${current.budgetMax !== null ? current.budgetMax.toLocaleString("en-KE") : "Not set"}`}
                    />
                  )}
                  <Fact
                    name="Supplier preference"
                    value={
                      current.preferredSupplierType === "any"
                        ? "Direct supplier or sourcing agent"
                        : current.preferredSupplierType ===
                            "verified_sourcing_agent"
                          ? "Sourcing agent (verification required)"
                          : "Direct supplier"
                    }
                  />
                </dl>
                <h3>Specifications</h3>
                {Object.values(current.specifications).some(Boolean) ? (
                  <dl className="request-facts">
                    {Object.entries(current.specifications)
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <Fact
                          key={k}
                          name={
                            specificationFields[
                              k as keyof typeof specificationFields
                            ]
                          }
                          value={v!}
                        />
                      ))}
                  </dl>
                ) : (
                  <p>No additional specifications yet.</p>
                )}
                <h3>
                  {current.requesterType === "business"
                    ? "Business context"
                    : "Individual request"}
                </h3>
                {Object.values(current.businessContext).some(Boolean) ? (
                  <dl className="request-facts">
                    {Object.entries(current.businessContext)
                      .filter(([, v]) => v !== null && v !== "")
                      .map(([k, v]) => (
                        <Fact
                          key={k}
                          name={label(k.replace(/([A-Z])/g, " $1"))}
                          value={String(v)}
                        />
                      ))}
                  </dl>
                ) : (
                  <p>
                    {current.requesterType === "business"
                      ? "Business details are optional. Add context to help future participants understand your needs."
                      : "For a personal need."}
                  </p>
                )}
                <h3>Attachments</h3>
                {current.attachments.length ? (
                  <ul className="request-attachments">
                    {current.attachments.map((a) => (
                      <li key={a.uploadId}>
                        {a.available && a.private ? <RequestImage id={a.uploadId} name={a.name}/> : a.available && a.url ? (
                          <a
                            href={api.mediaFileUrl(a.url)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {a.name} ↗
                          </a>
                        ) : (
                          <span>
                            {a.name} — image unavailable; edit to replace or
                            remove it.
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No images attached.</p>
                )}
                <p className="request-hint">
                  Your complete Request stays owner-only. New reference images are private. Older public image links remain unlisted, not access-controlled; re-upload sensitive images privately.
                </p>
                {["draft", "open", "matching", "quoted"].includes(current.status) && (
                  <div className="request-actions">
                    <button
                      disabled={busy}
                      className="request-primary"
                      onClick={() => setEditing(true)}
                    >
                      Edit Request
                    </button>
                    {current.status === "draft" && (
                      <button
                        disabled={busy}
                        onClick={() => transition("open")}
                      >
                        Submit Request
                      </button>
                    )}
                    {current.status === "open" && (
                      <button
                        disabled={busy}
                        onClick={() => transition("matching")}
                      >
                        Mark ready for matching
                      </button>
                    )}
                    <button
                      disabled={busy}
                      className="request-danger"
                      onClick={() => setConfirmCancel(true)}
                    >
                      Cancel Request
                    </button>
                  </div>
                )}
                {confirmCancel && (
                  <div className="request-cancel" role="alert">
                    <h3>Cancel this Request?</h3>
                    <p>
                      It will stay in your history, but cannot be edited or
                      reopened.
                    </p>
                    <div className="request-actions">
                      <button
                        className="request-danger"
                        disabled={busy}
                        onClick={() => transition("cancelled")}
                      >
                        {busy ? "Cancelling…" : "Yes, cancel Request"}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => setConfirmCancel(false)}
                      >
                        Keep Request
                      </button>
                    </div>
                  </div>
                )}
              </article>
              {current.acceptedQuote && <WorkWorkspace requestId={current.id} onRequestChanged={refresh}/>}
              {!["draft","open"].includes(current.status) && <QuoteWorkspace requestId={current.id} onRequestChanged={refresh}/>}
              <RequestMatches request={current} onReloadRequest={refresh} />
              <details><summary>Options you added manually</summary><RequestPotentialParticipants requestId={current.id} writable={["draft", "open", "matching"].includes(current.status)} /></details>
              <section className="request-future">
                <h2>What happens next</h2>
                <p>
                  {current.status === "matching"
                    ? "Brief has evaluated published capabilities. Matches are suggestions, not confirmed fulfillment."
                    : "Your demand is saved. Quotes record commercial proposals; an accepted quote prepares the next work stage, not payment or fulfillment."}
                </p>
                <div className="request-future-grid">
                  <div>
                    <h3>Matches</h3>
                    <p>
                      Relevant capabilities appear above with reasons and uncertainties. Refresh after changing requirements.
                    </p>
                  </div>
                  <div>
                    <h3>Quotes</h3>
                    <p>
                      Actual proposals disclose product or source cost, sourcing fees and delivery. Compare quantities, timing and validity before selecting.
                    </p>
                  </div>
                  <div>
                    <h3>Work progress</h3>
                    <p>
                      {current.workOrderId ? "See the Work Order above for the recorded fulfillment stage. Completion is confirmed by the requester, not inferred." : "No Work Order has been created. An accepted quote is the basis for starting work."}
                    </p>
                  </div>
                </div>
              </section>
              <section className="request-panel">
                <h2>Activity</h2>
                <ol className="request-history">
                  {[...current.history].reverse().map((e) => (
                    <li key={e.id}>
                      <strong>
                        {label(e.action)}
                        {e.fromStatus !== e.toStatus
                          ? ` → ${label(e.toStatus)}`
                          : ""}
                      </strong>
                      <time dateTime={e.at}>
                        {new Date(e.at).toLocaleString("en-KE")}
                      </time>
                      {e.changedFields.length > 0 && (
                        <small>
                          {e.changedFields
                            .map((f) => label(f.replace(/([A-Z])/g, " $1")))
                            .join(", ")}
                        </small>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}
          {!route && !error && (
            <>
              <p className="request-intro">
                What your business needs, all in one place. Start small; add the
                detail that helps someone get it done.
              </p>
              <button
                className="request-row procurement-entry"
                onClick={() => requestPath("procurement")}
              >
                <div className="request-row-title">
                  <h2>↻ Repeat procurement</h2>
                  <span className="request-status">Memory</span>
                </div>
                <p>Things you have sourced before — re-request in one tap.</p>
              </button>
              <div
                className="request-tabs"
                role="group"
                aria-label="Filter Requests"
              >
                {Object.entries(groups).map(([name, states]) => (
                  <button
                    key={name}
                    aria-pressed={tab === name}
                    onClick={() => setTab(name)}
                  >
                    {name}{" "}
                    <span>
                      {rows.filter((r) => states.includes(r.status)).length}
                    </span>
                  </button>
                ))}
              </div>
              {filtered.length ? (
                <div className="request-list">
                  {filtered.map((r) => (
                    <button
                      className="request-row"
                      key={r.id}
                      onClick={() => requestPath(r.id)}
                    >
                      <div className="request-row-title">
                        <h2>{r.title}</h2>
                        <span className={`request-status is-${r.status}`}>
                          {label(r.status)}
                        </span>
                      </div>
                      <p>
                        {r.quantity !== null
                          ? `${r.quantity.toLocaleString("en-KE")} ${r.unit} · `
                          : ""}
                        {r.location || "Location not added"}
                      </p>
                      <div className="request-meta">
                        <span>Due {date(r.requiredBy)}</span>
                        <span>Created {date(r.createdAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <section className="request-empty">
                  <span aria-hidden="true">↗</span>
                  <h2>
                    {tab === "Open"
                      ? "No open requests yet."
                      : `No ${tab.toLowerCase()} requests yet.`}
                  </h2>
                  <p>
                    {tab === "Completed"
                      ? "Requests whose work you confirmed complete appear here."
                      : tab === "Active"
                        ? "Requests marked ready for matching will appear here with explainable supply options."
                        : "Tell Brief what your business needs."}
                  </p>
                  <button
                    className="request-primary"
                    onClick={() => requestPath("new")}
                  >
                    Create a Request
                  </button>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
function Fact({ name, value }: { name: string; value: string }) {
  return (
    <div>
      <dt>{name}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function RequestForm({
  initial,
  onSaved,
  onCancel,
  onReload,
}: {
  initial?: DemandRequest;
  onSaved: (row: DemandRequest) => void;
  onCancel: () => void;
  onReload?: () => void;
}) {
  const [form, setForm] = useState<RequestInput>(() =>
    initial ? editable(initial) : emptyInput(),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initial?.attachments.map((a) => [a.uploadId, a.name]) || [],
    ),
  );
  const [dirty, setDirty] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [creationKey] = useState(() => crypto.randomUUID());
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const set = <K extends keyof RequestInput>(
    key: K,
    value: RequestInput[K],
  ) => {
    setDirty(true);
    setForm((f) => ({ ...f, [key]: value }));
  };
  const ctx = <K extends keyof BusinessContext>(
    key: K,
    value: BusinessContext[K],
  ) => set("businessContext", { ...form.businessContext, [key]: value });
  const input = (
    key:
      | "title"
      | "location"
      | "deliveryLocation"
      | "unit"
      | "category"
      | "subcategory",
    name: string,
    max: number,
    placeholder?: string,
  ) => (
    <label>
      {name}
      <input
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        maxLength={max}
        placeholder={placeholder}
        required={key === "title"}
        minLength={key === "title" ? 5 : undefined}
      />
    </label>
  );
  const num = (key: "quantity" | "budgetMin" | "budgetMax", name: string) => (
    <label>
      {name}
      <input
        type="number"
        inputMode="decimal"
        min={key === "quantity" ? "0.001" : "0"}
        max="1000000000000"
        step="any"
        value={form[key] ?? ""}
        onChange={(e) =>
          set(key, e.target.value === "" ? null : Number(e.target.value))
        }
      />
    </label>
  );
  async function save(intent: "draft" | "submit") {
    if (busy || uploading) return;
    setBusy(true);
    setError("");
    const res = initial
      ? await api.updateRequest(initial.id, {
          ...form,
          revision: initial.revision,
        })
      : await api.createRequest({
          ...form,
          intent,
          idempotencyKey: creationKey,
        });
    setBusy(false);
    if (res.ok) {
      setDirty(false);
      onSaved(res.data);
    } else {
      setError(res.error);
      setNeedsAuth(res.status === 401);
      setConflict(res.status === 409);
    }
  }
  return (
    <>
      {needsAuth && (
        <SessionSignIn
          onSignedIn={() => {
            setNeedsAuth(false);
            setError("Signed in. Review your details and save again.");
          }}
        />
      )}
      <form
        className="request-panel request-form"
        onSubmit={(e) => {
          e.preventDefault();
          const intent =
            (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
              "data-intent",
            ) === "draft"
              ? "draft"
              : "submit";
          void save(intent);
        }}
      >
        <fieldset disabled={busy || uploading || needsAuth}>
          <legend className="sr-only">Request details</legend>
          <p className="request-intro">
            Start in your own words. Then add quantity, place and timing—nothing
            is guessed for you.
          </p>
          {input(
            "title",
            "What do you need?",
            180,
            "e.g. 2,000 branded paper bags delivered to Nairobi by Friday",
          )}
          <div className="request-form-grid">
            {num("quantity", "Quantity (optional)")}
            {input("unit", "Unit", 40, "pieces, cartons, kg, trips…")}
            {input(
              "location",
              "Location",
              240,
              "e.g. Industrial Area, Nairobi",
            )}
            <label>
              Required by (optional)
              <input
                type="date"
                value={form.requiredBy || ""}
                onChange={(e) => set("requiredBy", e.target.value || null)}
              />
            </label>
          </div>
          <label>
            Short description
            <textarea
              rows={3}
              maxLength={5000}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What should a capable business know? Include intended use and anything essential."
            />
          </label>
          <div className="request-form-grid">
            <label>
              This Request is for
              <select
                value={form.requesterType}
                onChange={(e) =>
                  set(
                    "requesterType",
                    e.target.value as RequestInput["requesterType"],
                  )
                }
              >
                <option value="business">My business</option>
                <option value="individual">An individual need</option>
              </select>
            </label>
            <label>
              Urgency
              <select
                value={form.urgency}
                onChange={(e) =>
                  set("urgency", e.target.value as RequestInput["urgency"])
                }
              >
                <option value="standard">Standard</option>
                <option value="urgent">Urgent</option>
                <option value="flexible">Flexible</option>
              </select>
            </label>
          </div>
          <details>
            <summary>
              Budget <span>Optional</span>
            </summary>
            <div className="request-form-grid">
              {num("budgetMin", "Minimum budget")}
              {num("budgetMax", "Maximum budget")}
              <label>
                Currency
                <input
                  value={form.currency}
                  onChange={(e) =>
                    set("currency", e.target.value.toUpperCase())
                  }
                  pattern="[A-Z]{3}"
                  maxLength={3}
                  required
                />
              </label>
            </div>
            <p className="request-hint">
              An indication, not a payment or commitment. Quality and
              reliability matter alongside price.
            </p>
          </details>
          <details open={undefined}>
            <summary>
              Specifications & delivery <span>Add useful detail</span>
            </summary>
            <div className="request-form-grid">
              {input("category", "Category", 100, "e.g. Packaging")}
              {input("subcategory", "Subcategory", 100, "e.g. Paper bags")}
              {input(
                "deliveryLocation",
                "Delivery location",
                300,
                "Where should it arrive?",
              )}
              {Object.entries(specificationFields).map(([key, name]) => (
                <label key={key}>
                  {name}
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={
                      form.specifications[
                        key as keyof typeof specificationFields
                      ] || ""
                    }
                    onChange={(e) =>
                      set("specifications", {
                        ...form.specifications,
                        [key]: e.target.value,
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <label>
              Preferred participant
              <select
                value={form.preferredSupplierType}
                onChange={(e) =>
                  set(
                    "preferredSupplierType",
                    e.target.value as RequestInput["preferredSupplierType"],
                  )
                }
              >
                <option value="any">Direct supplier or sourcing agent</option>
                <option value="direct_supplier">Direct supplier</option>
                <option value="verified_sourcing_agent">
                  Sourcing agent — verification required
                </option>
              </select>
            </label>
            <p className="request-hint">
              A sourcing agent coordinates access; they are not presented as a
              manufacturer or representative. This is a preference, not a
              verification claim.
            </p>
          </details>
          {form.requesterType === "business" && (
            <details>
              <summary>
                Business context <span>Optional</span>
              </summary>
              <p>
                Help future suppliers understand one-off and recurring demand.
              </p>
              <div className="request-form-grid">
                {(
                  [
                    ["companyName", "Business name"],
                    ["industry", "Industry"],
                    ["location", "Business location"],
                    ["buyingFrequency", "Buying frequency"],
                    ["recurringUnit", "Recurring unit"],
                  ] as const
                ).map(([key, name]) => (
                  <label key={key}>
                    {name}
                    <input
                      maxLength={240}
                      value={form.businessContext[key] || ""}
                      onChange={(e) => ctx(key, e.target.value)}
                    />
                  </label>
                ))}
                <label>
                  Approximate recurring quantity
                  <input
                    type="number"
                    min="0.001"
                    max="1000000000000"
                    step="any"
                    value={form.businessContext.recurringQuantity ?? ""}
                    onChange={(e) =>
                      ctx(
                        "recurringQuantity",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                  />
                </label>
              </div>
            </details>
          )}
          <label>Who can see a matching brief?
            <select value={form.visibility} onChange={e=>set('visibility',e.target.value as 'private'|'public')}>
              <option value="private">Only me — keep Request private</option>
              <option value="public">Share a limited brief with matched businesses</option>
            </select>
          </label>
          <p className="request-hint">Sharing exposes only the title, category, quantity, unit, location and deadline to current matched participants. Keep the title and location broad. Description, exact delivery address, budgets, attachments, contact details and internal specifications are not shared.</p>
          <details>
            <summary>
              Reference images <span>Up to 8</span>
            </summary>
            <p className="request-hint">
              JPEG, PNG, WebP or GIF, up to 8 MB each. Uses Brief’s image
              library with owner-only access for new Request images. They are never shared with matched businesses. Files may become unavailable if the
              deployment’s upload disk is not persistent.
            </p>
            <label>
              Add an image
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={form.attachments.length >= 8}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (file.size > 8 * 1024 * 1024) {
                    setError("Images must be 8 MB or smaller");
                    return;
                  }
                  setUploading(true);
                  setError("");
                  const res = await api.uploadMediaFile(file, {purpose:'private_request'});
                  setUploading(false);
                  if (!res.ok) {
                    setError(res.error);
                    return;
                  }
                  const upload = res.data.upload;
                  setFiles((f) => ({ ...f, [upload.id]: file.name }));
                  if (!form.attachments.some((a) => a.uploadId === upload.id))
                    set("attachments", [
                      ...form.attachments,
                      { uploadId: upload.id },
                    ]);
                }}
              />
            </label>
            <ul className="request-attachments">
              {form.attachments.map((a) => (
                <li key={a.uploadId}>
                  <span>{files[a.uploadId] || "Image"}</span>
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "attachments",
                        form.attachments.filter(
                          (x) => x.uploadId !== a.uploadId,
                        ),
                      )
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </fieldset>
        {error && (
          <p role="alert" className="request-error">
            {error} Your form is still here; fix the details or try again.
          </p>
        )}
        {conflict && (
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "Discard unsaved changes and reload the saved Request?",
                )
              ) {
                setDirty(false);
                if (initial) onReload?.();
                else requestPath();
              }
            }}
          >
            Reload saved Request
          </button>
        )}
        {uploading && <p role="status">Uploading image…</p>}
        <p className="request-hint">
          Your complete Request is saved to your account. Submitting records an open Request;
          it does not start an automated search or send an order.
        </p>
        <div className="request-actions request-form-actions">
          <button
            disabled={busy || uploading || needsAuth}
            className="request-primary"
            type="submit"
          >
            {busy ? "Saving…" : initial ? "Save changes" : "Submit Request"}
          </button>
          {!initial && (
            <button
              type="submit"
              data-intent="draft"
              disabled={busy || uploading || needsAuth}
            >
              Save draft
            </button>
          )}
          <button
            type="button"
            disabled={busy || uploading || needsAuth}
            onClick={() => {
              if (!dirty || window.confirm("Discard unsaved changes?"))
                onCancel();
            }}
          >
            Discard changes
          </button>
        </div>
      </form>
    </>
  );
}
