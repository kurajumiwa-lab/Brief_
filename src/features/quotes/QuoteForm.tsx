import {decimal,minor} from "./money";
import React, { useEffect, useRef, useState } from "react";
import * as api from "../../api/briefApi";
import type {
  Quote,
  QuoteTerms,
  QuoteInvitation,
  QuoteAction,
  QuoteSource,
} from "../../api/quoteTypes";
import { quoteCurrencies } from "../../api/quoteTypes";
import { SessionSignIn } from "../../components/SessionSignIn";
import { money } from "./QuoteOffer";
const blank = (): QuoteTerms => ({
  quotedQuantity: null,
  unit: "",
  unitPriceMinor: null,
  currency: "KES",
  deliveryCostMinor: 0,
  sourcingFeeMinor: 0,
  otherCosts: [],
  subtotalMinor: null,
  totalMinor: null,
  productionLeadDays: null,
  deliveryLeadDays: null,
  estimatedCompletionDate: null,
  validUntil: null,
  specifications: "",
  exclusions: "",
  notes: "",
  terms: "",
  sourceType: "direct",
  relationshipType: "Direct supplier",
  privateProvenance: { sourceParticipantId: null, reference: "", notes: "" },
  evidence: [],
});
const termsOf = (q: Quote) =>
  q.draft ?? q.offers[q.offers.length - 1]?.terms ?? blank();
function formOf(q: Quote) {
  const t = structuredClone(termsOf(q));
  return {
    t,
    price: decimal(t.unitPriceMinor, t.currency),
    delivery: decimal(t.deliveryCostMinor, t.currency),
    fee: decimal(t.sourcingFeeMinor, t.currency),
    costs: t.otherCosts.map((c) => ({
      label: c.label,
      amount: decimal(c.amountMinor, t.currency),
    })),
  };
}
export function QuoteForm({
  quote,
  invitation,
  onClose,
  onSaved,
}: {
  quote: Quote;
  invitation: QuoteInvitation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [basis, setBasis] = useState(invitation.requestRevision);
  const [base, setBase] = useState(quote),
    [form, setForm] = useState(() => formOf(quote)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false),
    [dirty, setDirty] = useState(false),
    [notice, setNotice] = useState("");
  const retry = useRef<{ signature: string; body: QuoteAction } | null>(null);
  const t = form.t;
  const patch = (p: Partial<QuoteTerms>) => {
    setDirty(true);
    setForm((f) => ({ ...f, t: { ...f.t, ...p } }));
  };
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);
  async function commit(action: "save" | "submit") {
    setError("");
    setNotice("");
    try {
      const { subtotalMinor, totalMinor, relationshipType, ...values } = t;
      const terms = {
        ...values,
        evidence: t.evidence.map(({ uploadId, kind, shareWithRequester }) => ({
          uploadId,
          kind,
          shareWithRequester,
        })),
        unitPriceMinor:
          form.price === "" ? null : minor(form.price, t.currency),
        deliveryCostMinor: minor(form.delivery || "0", t.currency),
        sourcingFeeMinor: ["sourcing", "referral"].includes(t.sourceType)
          ? minor(form.fee || "0", t.currency)
          : 0,
        otherCosts: form.costs.map((c) => ({
          label: c.label,
          amountMinor: minor(c.amount, t.currency),
        })),
      };
      const body = {
        action,
        revision: base.revision,
        requestRevision: basis,
        terms,
      };
      const signature = JSON.stringify(body);
      if (retry.current?.signature !== signature)
        retry.current = {
          signature,
          body: { ...body, idempotencyKey: crypto.randomUUID() },
        };
      setBusy(true);
      const r = await api.changeRequestQuote(base.id, retry.current.body);
      setBusy(false);
      if (r.ok) {
        setBase(r.data);
        setDirty(false);
        retry.current = null;
        onSaved();
        if (action === "submit") onClose();
        else
          setNotice("Draft saved. Totals below were calculated by the server.");
      } else {
        setError(r.error);
        setAuth(r.status === 401);
      }
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Could not save quote.");
    }
  }
  const num = (
    name: string,
    label: string,
    value: number | null,
    update: (n: number | null) => void,
    required = false,
  ) => (
    <label>
      {label}
      <input
        name={name}
        type="number"
        min="0"
        step={name === "quantity" ? "0.001" : "1"}
        required={required}
        value={value ?? ""}
        onChange={(e) =>
          update(e.target.value === "" ? null : Number(e.target.value))
        }
      />
    </label>
  );
  return (
    <section className="quote-editor">
      <span className="request-eyebrow">Your commercial response</span>
      <h3>{base.offers.length ? "Revise quote" : "Prepare quote"}</h3>
      <p>
        You are proposing how to meet this Request. Review the prefilled
        requirements. Submission is not proof of stock or availability, and no
        money moves.
      </p>
      {base.offers.length > 0 && (
        <p>
          Published version {base.offers.length} remains unchanged while you
          prepare this revision.
        </p>
      )}
      {(quote.revision !== base.revision ||
        basis !== invitation.requestRevision) && (
        <p role="alert">
          This quote changed in another session. Your edits have been kept;
          reload the current quote before saving.
        </p>
      )}
      {auth && (
        <SessionSignIn
          title="Sign in to save your quote"
          onSignedIn={() => {
            setAuth(false);
            setError("Signed in. Retry the same save or submission.");
          }}
        />
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void commit("submit");
        }}
      >
        <fieldset disabled={busy || auth}>
          <div className="quote-fields">
            {num(
              "quantity",
              "Quoted quantity",
              t.quotedQuantity,
              (n) => patch({ quotedQuantity: n }),
              true,
            )}
            <label>
              Unit
              <input
                required
                maxLength={40}
                value={t.unit}
                onChange={(e) => patch({ unit: e.target.value })}
              />
            </label>
            <label>
              Currency
              <select
                value={t.currency}
                onChange={(e) => {
                  const currency = e.target.value;
                  patch({ currency });
                  setForm((f) => ({
                    ...f,
                    price: "",
                    delivery: "",
                    fee: "",
                    costs: [],
                  }));
                }}
              >
                {Object.keys(quoteCurrencies).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              {t.sourceType === "sourcing" ? "Source unit cost" : "Unit price"}
              <input
                required
                inputMode="decimal"
                value={form.price}
                onChange={(e) => {
                  setDirty(true);
                  setForm({ ...form, price: e.target.value });
                }}
              />
            </label>
          </div>
          <p className="request-hint">
            Amounts in {t.currency}, not minor units. Changing currency clears
            entered prices; no exchange-rate conversion is implied. Fractional
            quantities round the line subtotal once to the nearest minor unit.
          </p>
          <div className="quote-fields">
            {num(
              "productionDays",
              "Production / service lead days",
              t.productionLeadDays,
              (n) => patch({ productionLeadDays: n }),
              true,
            )}
            {num(
              "deliveryDays",
              "Delivery lead days",
              t.deliveryLeadDays,
              (n) => patch({ deliveryLeadDays: n }),
            )}
            <label>
              Estimated completion date
              <input
                type="date"
                value={t.estimatedCompletionDate ?? ""}
                onChange={(e) =>
                  patch({ estimatedCompletionDate: e.target.value || null })
                }
              />
            </label>
            <label>
              Quote valid until
              <input
                type="date"
                value={t.validUntil ?? ""}
                onChange={(e) => patch({ validUntil: e.target.value || null })}
              />
            </label>
          </div>
          <label>
            Supply relationship
            <select
              value={t.sourceType}
              onChange={(e) =>
                patch({ sourceType: e.target.value as QuoteSource })
              }
            >
              {(invitation.capability.supplyMode === "source"
                ? ["sourcing", "referral"]
                : ["direct", "distributor", "reseller", "referral", "logistics"]
              ).map((s) => (
                <option key={s} value={s}>
                  {
                    (
                      {
                        direct: "Direct supplier",
                        sourcing: "Independent sourcing agent",
                        distributor: "Distributor — declared relationship",
                        reseller: "Reseller",
                        referral: "Referral",
                        logistics: "Logistics provider",
                      } as Record<string, string>
                    )[s]
                  }
                </option>
              ))}
            </select>
          </label>
          <p className="request-hint">
            The relationship is visible to the requester. Sourcing does not
            imply manufacturing, owned stock or an independently verified
            supplier relationship.
          </p>
          <div className="quote-fields">
            <label>
              {t.sourceType === "sourcing" ? "Logistics cost" : "Delivery cost"}
              <input
                inputMode="decimal"
                value={form.delivery}
                onChange={(e) => {
                  setDirty(true);
                  setForm({ ...form, delivery: e.target.value });
                }}
              />
            </label>
            {["sourcing", "referral"].includes(t.sourceType) && (
              <label>
                Disclosed sourcing / referral fee
                <input
                  inputMode="decimal"
                  value={form.fee}
                  onChange={(e) => {
                    setDirty(true);
                    setForm({ ...form, fee: e.target.value });
                  }}
                />
              </label>
            )}
          </div>
          <details>
            <summary>Other disclosed costs ({form.costs.length})</summary>
            {form.costs.map((c, index) => (
              <div className="quote-fields" key={index}>
                <label>
                  Cost description
                  <input
                    value={c.label}
                    onChange={(e) => {
                      setDirty(true);
                      setForm({
                        ...form,
                        costs: form.costs.map((v, i) =>
                          i === index ? { ...v, label: e.target.value } : v,
                        ),
                      });
                    }}
                  />
                </label>
                <label>
                  Cost amount
                  <input
                    inputMode="decimal"
                    value={c.amount}
                    onChange={(e) => {
                      setDirty(true);
                      setForm({
                        ...form,
                        costs: form.costs.map((v, i) =>
                          i === index ? { ...v, amount: e.target.value } : v,
                        ),
                      });
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setDirty(true);
                    setForm({
                      ...form,
                      costs: form.costs.filter((_, i) => i !== index),
                    });
                  }}
                >
                  Remove cost
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={form.costs.length >= 12}
              onClick={() => {
                setDirty(true);
                setForm({
                  ...form,
                  costs: [...form.costs, { label: "", amount: "" }],
                });
              }}
            >
              Add disclosed cost
            </button>
          </details>
          {(["specifications", "exclusions", "notes", "terms"] as const).map(
            (k) => (
              <label key={k}>
                {
                  {
                    specifications: "Offered specification / alternatives",
                    exclusions: "Exclusions",
                    notes: "Notes to requester",
                    terms: "Commercial terms",
                  }[k]
                }
                <textarea
                  rows={3}
                  maxLength={5000}
                  value={t[k]}
                  onChange={(e) => patch({ [k]: e.target.value })}
                />
              </label>
            ),
          )}
          <details>
            <summary>
              Private source provenance — not shared with requester
            </summary>
            <p>
              Optional reference for your commercial record. This is a
              declaration, not verification or authority to represent another
              business.
            </p>
            <label>
              Private source reference
              <input
                maxLength={300}
                value={t.privateProvenance?.reference ?? ""}
                onChange={(e) =>
                  patch({
                    privateProvenance: {
                      sourceParticipantId:
                        t.privateProvenance?.sourceParticipantId ?? null,
                      notes: t.privateProvenance?.notes ?? "",
                      reference: e.target.value,
                    },
                  })
                }
              />
            </label>
            <label>
              Private source notes
              <textarea
                maxLength={3000}
                value={t.privateProvenance?.notes ?? ""}
                onChange={(e) =>
                  patch({
                    privateProvenance: {
                      sourceParticipantId:
                        t.privateProvenance?.sourceParticipantId ?? null,
                      reference: t.privateProvenance?.reference ?? "",
                      notes: e.target.value,
                    },
                  })
                }
              />
            </label>
          </details>
          <details>
            <summary>Evidence images ({t.evidence.length})</summary>
            <p>
              JPEG, PNG, WebP or GIF. Uploaded evidence is not verified by
              Brief. Shared images become part of the submitted commercial
              record; check for confidential contacts or source details.
            </p>
            <label>
              Add quote evidence
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={t.evidence.length >= 8}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  const r = await api.uploadMediaFile(file, {
                    purpose: "private_quote",
                  });
                  setBusy(false);
                  if (r.ok)
                    patch({
                      evidence: [
                        ...t.evidence,
                        {
                          uploadId: r.data.upload.id,
                          kind: "product_specification",
                          shareWithRequester: false,
                        },
                      ],
                    });
                  else {
                    setError(r.error);
                    setAuth(r.status === 401);
                  }
                  e.target.value = "";
                }}
              />
            </label>
            {t.evidence.map((e, index) => (
              <div key={e.uploadId}>
                <span>Evidence image {index + 1}</span>
                <label>
                  Evidence kind
                  <select
                    value={e.kind}
                    onChange={(ev) =>
                      patch({
                        evidence: t.evidence.map((x) =>
                          x.uploadId === e.uploadId
                            ? { ...x, kind: ev.target.value }
                            : x,
                        ),
                      })
                    }
                  >
                    {[
                      "supplier_quotation",
                      "product_specification",
                      "stock_confirmation",
                      "production_confirmation",
                      "source_confirmation",
                    ].map((k) => (
                      <option key={k} value={k}>
                        {k.split("_").join(" ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={e.shareWithRequester}
                    onChange={(ev) =>
                      patch({
                        evidence: t.evidence.map((x) =>
                          x.uploadId === e.uploadId
                            ? { ...x, shareWithRequester: ev.target.checked }
                            : x,
                        ),
                      })
                    }
                  />{" "}
                  Share with requester when submitted
                </label>
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      evidence: t.evidence.filter(
                        (x) => x.uploadId !== e.uploadId,
                      ),
                    })
                  }
                >
                  Remove image from this draft
                </button>
              </div>
            ))}
          </details>
          {base.draft?.totalMinor != null && (
            <p className="quote-total">
              Last saved total:{" "}
              {money(base.draft.totalMinor, base.draft.currency)}
            </p>
          )}
          <p className="request-hint">
            The server calculates the final subtotal and all disclosed costs. No
            platform fee or commission is added.
          </p>
          <div className="request-actions">
            <button type="button" onClick={() => void commit("save")}>
              Save draft
            </button>
            <button className="request-primary" type="submit">
              {base.offers.length ? "Submit revised quote" : "Submit quote"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!dirty || window.confirm("Discard unsaved quote edits?"))
                  onClose();
              }}
            >
              Close editor
            </button>
          </div>
        </fieldset>
      </form>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (
            dirty &&
            !window.confirm(
              "Replace your unsaved edits with the current server version?",
            )
          )
            return;
          const r = await api.getRequestQuote(base.id);
          if (r.ok) {
            setBase(r.data);
            setBasis(invitation.requestRevision);
            setForm(formOf(r.data));
            setDirty(false);
            retry.current = null;
            setError("");
          } else {
            setError(r.error);
            setAuth(r.status === 401);
          }
        }}
      >
        Reload current quote
      </button>
    </section>
  );
}
