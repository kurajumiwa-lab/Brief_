import React, { useEffect, useState } from "react";
import { SessionSignIn } from "../../components/SessionSignIn";
import type { ApiResult } from "../../api/types";
import type {
  LeadTime,
  Capability,
  CapabilityInput,
} from "../../api/supplyTypes";
export const words = (s: string) => s.replace(/_/g, " ");
export const supplyPath = (path = "mine") => {
  window.location.hash = `supply/${path}`;
};
export const date = (s: string) =>
  new Date(s).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const quantity = (n: number | null | undefined) =>
  n == null ? "Not stated" : n.toLocaleString("en-KE");
export const turnaround = (l: LeadTime) =>
  l.minDays === null && l.maxDays === null
    ? "Not stated"
    : `${l.minDays === null ? "Not stated" : l.minDays}–${l.maxDays === null ? "Not stated" : l.maxDays} days`;
export function TextField({
  label,
  value,
  onChange,
  max = 240,
  required = false,
  area = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  required?: boolean;
  area?: boolean;
  placeholder?: string;
}) {
  return (
    <label>
      {label}
      {area ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={max}
          rows={3}
          required={required}
          placeholder={placeholder}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={max}
          required={required}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}
export function ListField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  // Keep separators while typing; normalize only on blur to avoid eating commas.
  const [raw, setRaw] = useState(value.join(", "));
  return (
    <label>
      {label}
      <input
        value={raw}
        maxLength={3200}
        placeholder="Separate entries with commas"
        onChange={(e) => {
          setRaw(e.target.value);
          onChange(
            e.target.value
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
          );
        }}
      />
    </label>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  max = 1e12,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  max?: number;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        inputMode="decimal"
        min="0"
        max={max}
        step="any"
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      />
    </label>
  );
}
export function LeadFields({
  value,
  onChange,
}: {
  value: LeadTime;
  onChange: (v: LeadTime) => void;
}) {
  return (
    <>
      <NumberField
        label="Minimum turnaround (days)"
        value={value.minDays}
        onChange={(minDays) => onChange({ ...value, minDays })}
        max={3650}
      />
      <NumberField
        label="Maximum turnaround (days)"
        value={value.maxDays}
        onChange={(maxDays) => onChange({ ...value, maxDays })}
        max={3650}
      />
    </>
  );
}
export function Fact({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
export function Editor<T>({
  children,
  save,
  onSaved,
  onCancel,
  onReload,
  label = "Save changes",
  canSubmit = true,
}: {
  children: React.ReactNode;
  save: () => Promise<ApiResult<T>>;
  onSaved: (r: T) => void;
  onCancel: () => void;
  onReload?: () => void;
  label?: string;
  canSubmit?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false),
    [conflict, setConflict] = useState(false),
    [dirty, setDirty] = useState(false);
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
  return (
    <>
      {auth && (
        <SessionSignIn
          title="Sign in to save your enterprise"
          onSignedIn={() => {
            setAuth(false);
            setError("Signed in. Review your details and save again.");
          }}
        />
      )}
      <form
        className="request-panel request-form supply-editor"
        onChange={() => setDirty(true)}
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          const res = await save();
          setBusy(false);
          if (res.ok) {
            setDirty(false);
            onSaved(res.data);
          } else {
            setError(res.error);
            setAuth(res.status === 401);
            setConflict(res.status === 409);
          }
        }}
      >
        <fieldset disabled={busy || auth}>{children}</fieldset>
        {error && (
          <p className="request-error" role="alert">
            {error}
          </p>
        )}
        {conflict && (
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "Discard unsaved changes and reload the saved profile?",
                )
              ) {
                setDirty(false);
                onReload?.();
              }
            }}
          >
            Reload saved profile
          </button>
        )}
        <p className="request-hint">
          Your information is a declaration, not a verified claim. No prices,
          stock or matches are inferred.
        </p>
        <div className="request-actions">
          <button
            className="request-primary"
            disabled={busy || auth || !canSubmit}
            type="submit"
          >
            {busy ? "Saving…" : label}
          </button>
          <button
            type="button"
            disabled={busy}
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
export function emptyCapability(
  mode: "direct" | "source" = "direct",
): CapabilityInput {
  return {
    name: "",
    category: "",
    description: "",
    productsServices: [],
    materials: [],
    specifications: [],
    minimumQuantity: null,
    maximumQuantity: null,
    typicalCapacity: null,
    availableCapacity: null,
    unit: "",
    capacityPeriod: "per_order",
    capacityKind: mode === "source" ? "sourcing_access" : "service",
    availability: "unknown",
    productionSchedule: "",
    leadTime: { minDays: null, maxDays: null },
    serviceAreas: [],
    operatingStatus: "active",
    supplyMode: mode,
    evidence: [],
    sourcingAccess: {
      products: [],
      regions: [],
      networkDescription: "",
      deliveryCoordination: false,
      inspectionCapability: false,
      negotiationCapability: false,
    },
  };
}
export function capabilityInput(c: Capability): CapabilityInput {
  const {
    id,
    participantId,
    revision,
    history,
    createdAt,
    updatedAt,
    declaredAt,
    verification,
    capacityInformation,
    evidence,
    ...fields
  } = c;
  return {
    ...fields,
    evidence: evidence.map((e) => ({ uploadId: e.uploadId })),
  };
}
