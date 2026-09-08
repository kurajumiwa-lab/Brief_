import React, { useEffect, useRef, useState } from "react";
import type { WorkOrder, WorkAction, WorkInput } from "../../api/workTypes";
import * as api from "../../api/briefApi";
import { quoteCurrencies } from "../../api/quoteTypes";
import { minor } from "../quotes/money";
import { SessionSignIn } from "../../components/SessionSignIn";
export const actionLabels: Record<WorkAction, string> = {
  confirm_specifications: "Confirm specifications",
  start: "Start work",
  progress: "Record progress",
  ready: "Mark ready",
  dispatch: "Record dispatch",
  deliver: "Record delivery",
  complete: "Confirm completion",
  add_evidence: "Add evidence",
  cancel: "Cancel Work Order",
  raise_issue: "Record an issue",
  resolve_issue: "Confirm issue resolved",
  propose_amendment: "Propose amendment",
  accept_amendment: "Accept amendment",
  reject_amendment: "Reject amendment",
};
export const amendmentFields: Record<string, string> = {
  quotedQuantity: "Quantity",
  unit: "Unit",
  unitPriceMinor: "Unit price",
  deliveryCostMinor: "Delivery / logistics cost",
  sourcingFeeMinor: "Sourcing fee",
  otherCosts: "Other disclosed costs",
  currency: "Currency",
  productionLeadDays: "Production / service days",
  deliveryLeadDays: "Delivery days",
  specifications: "Offered specifications",
  exclusions: "Exclusions",
  terms: "Commercial / delivery terms",
  notes: "Commercial notes",
  fulfillmentLocation: "Fulfillment location",
  deliveryDetails: "Delivery details",
  agreedStartDate: "Agreed start date",
  estimatedCompletionDate: "Estimated completion date",
};
export function WorkActionPanel({
  work,
  action,
  amendmentId,
  onClose,
  onSaved,
}: {
  work: WorkOrder;
  action: WorkAction;
  amendmentId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [basis] = useState(work),
    [note, setNote] = useState(""),
    [visibility, setVisibility] = useState<"shared" | "private">("shared"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false),
    [changes, setChanges] = useState([{ field: "deliveryDetails", value: "" }]),
    [evidence, setEvidence] = useState<NonNullable<WorkInput["evidence"]>>([]),
    [costs, setCosts] = useState([{ label: "", amount: "" }]);
  const retry = useRef<{ signature: string; body: WorkInput } | null>(null);
  const a = basis.agreements[basis.agreements.length - 1];
  const editing = action === "propose_amendment";
  const attaching = ["progress", "add_evidence"].includes(action);
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (note || evidence.length || changes.some((c) => c.value)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [note, evidence, changes]);
  async function commit() {
    setError("");
    try {
      let patch: Record<string, unknown> | undefined;
      if (editing) {
        patch = {};
        const currency =
          changes.find((c) => c.field === "currency")?.value ||
          a.terms.currency;
        for (const c of changes) {
          if (c.field in patch)
            throw new Error("Choose each changed field only once.");
          if (c.field === "otherCosts")
            patch[c.field] = costs.map((c) => ({
              label: c.label,
              amountMinor: minor(c.amount, currency),
            }));
          else if (c.field.endsWith("Minor"))
            patch[c.field] = minor(c.value, currency);
          else if (
            [
              "quotedQuantity",
              "productionLeadDays",
              "deliveryLeadDays",
            ].includes(c.field)
          )
            patch[c.field] = c.value === "" ? null : Number(c.value);
          else
            patch[c.field] =
              c.value === "" &&
              ["agreedStartDate", "estimatedCompletionDate"].includes(c.field)
                ? null
                : c.value;
        }
      }
      const body = {
        action,
        revision: basis.revision,
        agreementRevision: a.revision,
        note,
        ...(editing ? { changes: patch } : {}),
        ...(amendmentId ? { amendmentId } : {}),
        ...(attaching ? { evidence, visibility } : {}),
      };
      const signature = JSON.stringify(body);
      if (retry.current?.signature !== signature)
        retry.current = {
          signature,
          body: { ...body, idempotencyKey: crypto.randomUUID() },
        };
      setBusy(true);
      const r = await api.changeWorkOrder(work.id, retry.current.body);
      setBusy(false);
      if (r.ok) {
        onSaved();
        onClose();
      } else {
        setError(r.error);
        setAuth(r.status === 401);
      }
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Could not record action");
    }
  }
  return (
    <div className="work-action-panel" role="group" aria-label="Work action">
      <h3>{actionLabels[action]}</h3>
      <p>
        Agreement version {a.revision} · Work revision {basis.revision}
      </p>
      {action === "confirm_specifications" && (
        <p>
          Confirm the full agreed quantity, specifications, costs, relationship,
          delivery terms and timeline above. Both parties must confirm before
          work starts.
        </p>
      )}
      {["start", "ready", "dispatch", "deliver"].includes(action) && (
        <p>
          Record only what has actually happened. This action is not a forecast
          or automated tracking update.
        </p>
      )}
      {action === "complete" && (
        <p>
          Confirm that the agreed work has been delivered and completed. This
          closes the Work Order and its Request. It does not confirm payment.
        </p>
      )}
      {action === "cancel" && (
        <p>
          Cancellation is only available before work starts. The accepted quote
          and full history will be retained. No refund or payment action occurs.
        </p>
      )}
      {action === "raise_issue" && (
        <p>
          This pauses operational transitions. Both parties must explicitly
          confirm resolution before work resumes; no arbitration or refund is
          performed.
        </p>
      )}
      {action === "resolve_issue" && (
        <p>
          Confirm that the recorded issue is resolved under the current
          agreement. Work resumes at the suspended stage only after both parties
          confirm.
        </p>
      )}
      {action === "accept_amendment" && (
        <p>
          Accept the proposed version shown above, including unchanged terms.
          Your acceptance and the other party’s proposal confirm the new
          agreement for both parties.
        </p>
      )}
      {work.revision !== basis.revision && (
        <p className="work-warning">
          Work changed while this action was open. A saved action can be retried
          safely; otherwise reload and review the latest version.
        </p>
      )}
      {auth && (
        <SessionSignIn
          title="Sign in to manage this Work Order"
          onSignedIn={() => {
            setAuth(false);
            setError("Signed in. Retry the same action.");
          }}
        />
      )}
      {error && <p role="alert">{error}</p>}
      <fieldset disabled={busy || auth}>
        {editing && (
          <>
            <p>
              Only the other party can accept these changes. Current terms
              remain in effect; stage advancement pauses while the proposal is
              pending.
            </p>
            <p className="request-hint">
              Prices use major currency amounts, not minor units. Currency
              changes require all prices and additional costs to be restated; no
              conversion is performed.
            </p>
            {changes.map((c, index) => (
              <div className="work-change" key={index}>
                <label>
                  Changed field
                  <select
                    value={c.field}
                    onChange={(e) =>
                      setChanges(
                        changes.map((x, i) =>
                          i === index
                            ? { field: e.target.value, value: "" }
                            : x,
                        ),
                      )
                    }
                  >
                    {Object.entries(amendmentFields).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {c.field === "otherCosts" ? (
                  <div>
                    {costs.map((cost, idx) => (
                      <div className="quote-fields" key={idx}>
                        <label>
                          Cost label
                          <input
                            value={cost.label}
                            onChange={(e) =>
                              setCosts(
                                costs.map((x, i) =>
                                  i === idx
                                    ? { ...x, label: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          Cost amount
                          <input
                            inputMode="decimal"
                            value={cost.amount}
                            onChange={(e) =>
                              setCosts(
                                costs.map((x, i) =>
                                  i === idx
                                    ? { ...x, amount: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setCosts(costs.filter((_, i) => i !== idx))
                          }
                        >
                          Remove cost
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={costs.length >= 12}
                      onClick={() =>
                        setCosts([...costs, { label: "", amount: "" }])
                      }
                    >
                      Add cost
                    </button>
                    <p>
                      Remove all rows to explicitly propose no additional costs.
                    </p>
                  </div>
                ) : c.field === "currency" ? (
                  <label>
                    Proposed currency
                    <select
                      value={c.value}
                      onChange={(e) =>
                        setChanges(
                          changes.map((x, i) =>
                            i === index ? { ...x, value: e.target.value } : x,
                          ),
                        )
                      }
                    >
                      <option value="">Choose currency</option>
                      {Object.keys(quoteCurrencies).map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label>
                    Proposed value
                    {[
                      "specifications",
                      "deliveryDetails",
                      "exclusions",
                      "terms",
                      "notes",
                    ].includes(c.field) ? (
                      <textarea
                        value={c.value}
                        maxLength={3000}
                        onChange={(e) =>
                          setChanges(
                            changes.map((x, i) =>
                              i === index ? { ...x, value: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    ) : (
                      <input
                        type={
                          [
                            "agreedStartDate",
                            "estimatedCompletionDate",
                          ].includes(c.field)
                            ? "date"
                            : "text"
                        }
                        value={c.value}
                        onChange={(e) =>
                          setChanges(
                            changes.map((x, i) =>
                              i === index ? { ...x, value: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    )}
                  </label>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setChanges(changes.filter((_, i) => i !== index))
                  }
                >
                  Remove change
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={changes.length >= Object.keys(amendmentFields).length}
              onClick={() =>
                setChanges([...changes, { field: "specifications", value: "" }])
              }
            >
              Add another change
            </button>
          </>
        )}
        <label>
          {editing
            ? "Reason for amendment"
            : ["cancel", "raise_issue", "resolve_issue", "progress"].includes(
                  action,
                )
              ? "What happened?"
              : "Note (optional)"}
          <textarea
            maxLength={3000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {attaching && (
          <>
            <label>
              Note visibility
              <select
                value={visibility}
                onChange={(e) =>
                  setVisibility(e.target.value as "shared" | "private")
                }
              >
                <option value="shared">Both parties</option>
                <option value="private">Only me</option>
              </select>
            </label>
            <label>
              Add work evidence
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={evidence.length >= 8}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  const r = await api.uploadMediaFile(file, {
                    purpose: "private_work",
                  });
                  setBusy(false);
                  if (r.ok)
                    setEvidence([
                      ...evidence,
                      {
                        uploadId: r.data.upload.id,
                        type: "production_progress",
                        visibility: "private",
                        description: "",
                      },
                    ]);
                  else {
                    setError(r.error);
                    setAuth(r.status === 401);
                  }
                  e.target.value = "";
                }}
              />
            </label>
            <p className="request-hint">
              Evidence is uploaded by a party, not verified by Brief. Images are
              private by default; explicitly choose “Both parties” to share.
            </p>
            {evidence.map((e, index) => (
              <div className="work-evidence-input" key={e.uploadId}>
                <strong>Image {index + 1}</strong>
                <label>
                  Evidence type
                  <select
                    value={e.type}
                    onChange={(ev) =>
                      setEvidence(
                        evidence.map((x, i) =>
                          i === index ? { ...x, type: ev.target.value } : x,
                        ),
                      )
                    }
                  >
                    {[
                      "production_progress",
                      "finished_goods",
                      "packaging",
                      "source_confirmation",
                      "dispatch",
                      "delivery",
                      "completion",
                      "specification",
                    ].map((t) => (
                      <option key={t} value={t}>
                        {t.split("_").join(" ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Image visibility
                  <select
                    value={e.visibility}
                    onChange={(ev) =>
                      setEvidence(
                        evidence.map((x, i) =>
                          i === index
                            ? {
                                ...x,
                                visibility: ev.target.value as
                                  | "shared"
                                  | "private",
                              }
                            : x,
                        ),
                      )
                    }
                  >
                    <option value="private">Only me</option>
                    <option value="shared">Both parties</option>
                  </select>
                </label>
                <label>
                  Image description
                  <textarea
                    maxLength={1000}
                    value={e.description}
                    onChange={(ev) =>
                      setEvidence(
                        evidence.map((x, i) =>
                          i === index
                            ? { ...x, description: ev.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setEvidence(evidence.filter((_, i) => i !== index))
                  }
                >
                  Remove image
                </button>
              </div>
            ))}
          </>
        )}
        <div className="request-actions">
          <button
            type="button"
            className="request-primary"
            onClick={() => void commit()}
          >
            {busy ? "Recording…" : "Confirm action"}
          </button>
          <button type="button" onClick={onClose}>
            Not now
          </button>
        </div>
      </fieldset>
      <button
        disabled={busy}
        type="button"
        onClick={() => {
          if (
            window.confirm(
              "Discard this unsaved action and reload current work?",
            )
          ) {
            onSaved();
            onClose();
          }
        }}
      >
        Reload current Work Order
      </button>
    </div>
  );
}
