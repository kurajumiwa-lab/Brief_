import React, { useEffect, useMemo, useState } from "react";
import * as api from "../../api/briefApi";
import type {
  ProcurementReference,
  RepeatProcurementInput,
} from "../../api/procurementTypes";
import { money } from "../quotes/money";
import "../requests/requests.css";
import "./procurement.css";

// ---------------------------------------------------------------------------
// REPEAT PROCUREMENT — the business memory of how things actually get bought.
//
// A completed Work Order becomes a reusable reference. This surface lists them
// (Recent / Repeat / Suppliers), lets a requester re-request with a short
// prefill form, and reports the previous supplier's CURRENT availability
// honestly. Historical price is always labelled "Previous agreed price".
// Nothing here is invented: every row is a real completed Work Order.
// ---------------------------------------------------------------------------

const timeAgo = (iso: string | null) => {
  if (!iso) return "unknown";
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const days = Math.floor(ms / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
};

function supplierLine(ref: ProcurementReference) {
  const s = ref.previousSupplier;
  if (!s.label) return null;
  return { label: s.label, available: s.available, reason: s.reason };
}

function RefCard({
  ref,
  onRequest,
}: {
  ref: ProcurementReference;
  onRequest: () => void;
}) {
  const supplier = supplierLine(ref);
  const price = ref.lastAgreedPrice;
  return (
    <article className="procurement-card">
      <div className="procurement-card-top">
        <div>
          <h3>{ref.title}</h3>
          <p className="procurement-meta">
            {ref.itemOrService && ref.itemOrService !== ref.title
              ? `${ref.itemOrService} · `
              : ""}
            {ref.recurring ? "Recurring · " : ""}
            Last {ref.lastFulfilledAt ? `fulfilled ${timeAgo(ref.lastFulfilledAt)}` : "completed"}
          </p>
        </div>
        <button className="request-primary procurement-again" onClick={onRequest}>
          Request again
        </button>
      </div>

      <dl className="procurement-facts">
        {ref.lastQuantity !== null && (
          <div>
            <dt>Last quantity</dt>
            <dd>
              {ref.lastQuantity} {ref.unit}
            </dd>
          </div>
        )}
        {ref.typicalQuantity && (
          <div>
            <dt>Typical quantity</dt>
            <dd>
              {ref.typicalQuantity.min}–{ref.typicalQuantity.max} {ref.unit}
            </dd>
          </div>
        )}
        {ref.typicalTurnaround && (
          <div>
            <dt>Typical turnaround</dt>
            <dd>
              {ref.typicalTurnaround.minDays}
              {ref.typicalTurnaround.maxDays !== ref.typicalTurnaround.minDays
                ? `–${ref.typicalTurnaround.maxDays}`
                : ""}{" "}
              days
            </dd>
          </div>
        )}
      </dl>

      <p className="procurement-price">
        <span className="procurement-price-label">{ref.lastAgreedPriceLabel}</span>{" "}
        {price.totalMinor !== null
          ? money(price.totalMinor, price.currency)
          : price.unitPriceMinor !== null
            ? `${money(price.unitPriceMinor, price.currency)} / ${ref.unit}`
            : "Not stated"}
        {price.sourcingFeeMinor ? (
          <span className="procurement-price-note">
            {" "}
            (incl. {money(price.sourcingFeeMinor, price.currency)} sourcing fee)
          </span>
        ) : null}
      </p>

      {supplier && (
        <p
          className={`procurement-supplier ${
            supplier.available ? "procurement-supplier-ok" : "procurement-supplier-off"
          }`}
        >
          {supplier.available ? "✓ " : "⚠ "}
          {supplier.label}
          {ref.participantName ? ` — ${ref.participantName}` : ""}
          {!supplier.available && supplier.reason ? (
            <span className="procurement-supplier-reason"> ({supplier.reason})</span>
          ) : null}
        </p>
      )}
    </article>
  );
}

export function ProcurementWorkspace({
  onOpenRequest,
}: {
  onOpenRequest: (requestId: string) => void;
}) {
  const [rows, setRows] = useState<ProcurementReference[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsAuth, setNeedsAuth] = useState(false);
  const [reload, setReload] = useState(0);
  const [drafting, setDrafting] = useState<ProcurementReference | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  // Prefill form state.
  const [form, setForm] = useState<{
    quantity: string;
    specifications: string;
    requiredBy: string;
    deliveryLocation: string;
    description: string;
    supplierStrategy: "previous" | "alternatives" | "both";
  }>({
    quantity: "",
    specifications: "",
    requiredBy: "",
    deliveryLocation: "",
    description: "",
    supplierStrategy: "alternatives",
  });

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    api.listProcurement().then((res) => {
      if (!live) return;
      setLoading(false);
      if (res.ok) {
        setRows(res.data);
        setNeedsAuth(false);
      } else {
        setNeedsAuth(res.status === 401);
        setError(res.status === 401 ? "" : res.error);
      }
    });
    return () => {
      live = false;
    };
  }, [reload]);

  const sections = useMemo(() => {
    const all = rows ?? [];
    return {
      recurring: all.filter((r) => r.recurring),
      recent: all.filter((r) => !r.recurring).slice(0, 6),
      suppliers: [...new Map(all.map((r) => [r.participantId, r])).values()],
    };
  }, [rows]);

  const openDraft = (ref: ProcurementReference) => {
    setDrafting(ref);
    setNotice("");
    setForm({
      quantity: ref.lastQuantity !== null ? String(ref.lastQuantity) : "",
      specifications: Object.entries(ref.specifications)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n"),
      requiredBy: ref.requiredBy ?? "",
      deliveryLocation: ref.deliveryLocation ?? "",
      description: ref.description ?? "",
      supplierStrategy: "alternatives",
    });
  };

  const submit = async () => {
    if (!drafting) return;
    setBusy(true);
    setError("");
    const input: RepeatProcurementInput = {
      intent: "submit",
      supplierStrategy: form.supplierStrategy,
      idempotencyKey: `proc-repeat-${Date.now()}-${drafting.id}`,
      quantity: form.quantity.trim() ? Number(form.quantity) : undefined,
      requiredBy: form.requiredBy || undefined,
      deliveryLocation: form.deliveryLocation || undefined,
      description: form.description || undefined,
      specifications: form.specifications.trim()
        ? Object.fromEntries(
            form.specifications
              .split("\n")
              .map((l) => l.split(":").map((s) => s.trim()))
              .filter((p) => p.length === 2 && p[0] && p[1])
              .map(([k, v]) => [k, v]),
          )
        : undefined,
    };
    const res = await api.repeatProcurement(drafting.id, input);
    setBusy(false);
    if (!res.ok) {
      setNeedsAuth(res.status === 401);
      setError(res.error);
      return;
    }
    setNotice(
      res.data.previousSupplier.note
        ? `Request created. ${res.data.previousSupplier.note}`
        : "Request created from your procurement memory.",
    );
    setDrafting(null);
    setReload((n) => n + 1);
    onOpenRequest(res.data.request.id);
  };

  const empty = rows !== null && rows.length === 0;

  return (
    <div className="requests-workspace">
      <header className="request-workspace-header">
        <div>
          <span className="request-eyebrow">Repeat procurement</span>
          <h1>{drafting ? "Request again" : "Things you regularly source"}</h1>
        </div>
        <button onClick={() => (drafting ? setDrafting(null) : onOpenRequest(""))}>
          {drafting ? "← Back" : "← My Requests"}
        </button>
      </header>

      {notice && (
        <p role="status" className="request-notice">
          {notice}
        </p>
      )}

      {loading ? (
        <p role="status">Reading your procurement history…</p>
      ) : needsAuth ? (
        <p role="status" className="request-error">
          Sign in to see your procurement history.
        </p>
      ) : error ? (
        <div role="alert" className="request-error">
          {error}
        </div>
      ) : drafting ? (
        <section className="procurement-form">
          <h2>{drafting.title}</h2>
          <p className="procurement-meta">
            {drafting.lastAgreedPriceLabel}:{" "}
            {drafting.lastAgreedPrice.totalMinor !== null
              ? money(drafting.lastAgreedPrice.totalMinor, drafting.lastAgreedPrice.currency)
              : "not stated"}{" "}
            — a repeat requires a fresh quote; historical pricing is never reused.
          </p>
          <label>
            Quantity ({drafting.unit || "units"})
            <input
              type="number"
              min="0"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              placeholder={drafting.lastQuantity ? `Last: ${drafting.lastQuantity}` : "Enter quantity"}
            />
          </label>
          <label>
            Specifications (one "key: value" per line)
            <textarea
              rows={4}
              value={form.specifications}
              onChange={(e) => setForm((f) => ({ ...f, specifications: e.target.value }))}
            />
          </label>
          <label>
            Deadline
            <input
              type="date"
              value={form.requiredBy}
              onChange={(e) => setForm((f) => ({ ...f, requiredBy: e.target.value }))}
            />
          </label>
          <label>
            Delivery location
            <input
              value={form.deliveryLocation}
              onChange={(e) => setForm((f) => ({ ...f, deliveryLocation: e.target.value }))}
            />
          </label>
          <label>
            Notes
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <fieldset className="procurement-strategy">
            <legend>How to proceed</legend>
            <label>
              <input
                type="radio"
                name="strategy"
                checked={form.supplierStrategy === "alternatives"}
                onChange={() => setForm((f) => ({ ...f, supplierStrategy: "alternatives" }))}
              />{" "}
              Find alternatives
            </label>
            <label>
              <input
                type="radio"
                name="strategy"
                checked={form.supplierStrategy === "previous"}
                onChange={() => setForm((f) => ({ ...f, supplierStrategy: "previous" }))}
              />{" "}
              Previous supplier
            </label>
            <label>
              <input
                type="radio"
                name="strategy"
                checked={form.supplierStrategy === "both"}
                onChange={() => setForm((f) => ({ ...f, supplierStrategy: "both" }))}
              />{" "}
              Both
            </label>
          </fieldset>
          <button className="request-primary" disabled={busy} onClick={submit}>
            {busy ? "Creating…" : "Request again"}
          </button>
        </section>
      ) : empty ? (
        <section className="procurement-empty">
          <h2>No completed procurement yet.</h2>
          <p>
            When a Work Order completes, Brief remembers what you bought, from
            whom and under what terms — so the next identical order is one tap.
          </p>
          <button className="request-primary" onClick={() => onOpenRequest("")}>
            Create a Request
          </button>
        </section>
      ) : (
        <div className="procurement-list">
          {sections.recurring.length > 0 && (
            <section>
              <h2>Repeat · things you regularly source</h2>
              {sections.recurring.map((r) => (
                <RefCard key={r.id} ref={r} onRequest={() => openDraft(r)} />
              ))}
            </section>
          )}
          {sections.recent.length > 0 && (
            <section>
              <h2>Recent</h2>
              {sections.recent.map((r) => (
                <RefCard key={r.id} ref={r} onRequest={() => openDraft(r)} />
              ))}
            </section>
          )}
          {sections.suppliers.length > 0 && (
            <section>
              <h2>Suppliers</h2>
              {sections.suppliers.map((r) => (
                <p key={r.participantId} className="procurement-supplier">
                  {r.participantName ?? "Supplier"}{" "}
                  {r.previousSupplier.available ? "— available" : "— currently unavailable"}
                </p>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
