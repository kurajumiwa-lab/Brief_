import React, { useState } from "react";
import * as api from "../../api/briefApi";
import type {
  Capability,
  CapabilityInput,
  Enterprise,
} from "../../api/supplyTypes";
import {
  Editor,
  TextField,
  ListField,
  NumberField,
  LeadFields,
  words,
  emptyCapability,
  capabilityInput,
} from "./shared";
export function CapabilityEditor({
  enterprise,
  initial,
  onSaved,
  onCancel,
  onReload,
}: {
  enterprise: Enterprise;
  initial?: Capability;
  onSaved: (c: Capability) => void;
  onCancel: () => void;
  onReload: () => void;
}) {
  const [form, setForm] = useState<CapabilityInput>(() =>
    initial
      ? capabilityInput(initial)
      : emptyCapability(
          enterprise.supplyRole === "verified_sourcing_agent"
            ? "source"
            : "direct",
        ),
  );
  const [key] = useState(() => crypto.randomUUID());
  const set = <K extends keyof CapabilityInput>(
    k: K,
    value: CapabilityInput[K],
  ) => setForm((f) => ({ ...f, [k]: value }));
  return (
    <Editor
      save={() =>
        initial
          ? api.updateCapability(initial.id, {
              ...form,
              revision: initial.revision,
            })
          : api.createCapability(enterprise.id, {
              ...form,
              idempotencyKey: key,
            })
      }
      onSaved={onSaved}
      onCancel={onCancel}
      onReload={onReload}
      label={initial ? "Save capability" : "Add capability"}
    >
      <span className="request-eyebrow">Capability, not an advert</span>
      <h2>{initial ? "Edit capability" : "What can you help with?"}</h2>
      <TextField
        label="Capability name"
        value={form.name}
        onChange={(x) => set("name", x)}
        required
        max={180}
        placeholder="e.g. Stainless steel fabrication"
      />
      <div className="request-form-grid">
        <TextField
          label="Category"
          value={form.category}
          onChange={(x) => set("category", x)}
          required
          max={180}
        />
        <label>
          Supply mode
          <select
            value={form.supplyMode}
            onChange={(e) => {
              const mode = e.target.value as "direct" | "source";
              setForm((f) => ({
                ...f,
                supplyMode: mode,
                capacityKind: mode === "source" ? "sourcing_access" : "service",
              }));
            }}
          >
            {enterprise.supplyRole !== "verified_sourcing_agent" && (
              <option value="direct">Supplies directly</option>
            )}
            {enterprise.supplyRole !== "direct_supplier" && (
              <option value="source">Can source</option>
            )}
          </select>
        </label>
      </div>
      <TextField
        label="Capability description"
        value={form.description}
        onChange={(x) => set("description", x)}
        max={3000}
        area
      />
      <div className="request-form-grid">
        <ListField
          label="Products / services"
          value={form.productsServices}
          onChange={(x) => set("productsServices", x)}
        />
        <ListField
          label="Materials"
          value={form.materials}
          onChange={(x) => set("materials", x)}
        />
        <ListField
          label="Capability service areas"
          value={form.serviceAreas}
          onChange={(x) => set("serviceAreas", x)}
        />
        <label>
          Availability (self-declared)
          <select
            value={form.availability}
            onChange={(e) =>
              set(
                "availability",
                e.target.value as CapabilityInput["availability"],
              )
            }
          >
            {["unknown", "available", "limited", "unavailable"].map((x) => (
              <option key={x} value={x}>
                {words(x)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <details open>
        <summary>
          Quantity & capacity <span>Optional declarations</span>
        </summary>
        <div className="request-form-grid">
          <NumberField
            label="Minimum order quantity"
            value={form.minimumQuantity}
            onChange={(x) => set("minimumQuantity", x)}
          />
          <NumberField
            label="Maximum capacity"
            value={form.maximumQuantity}
            onChange={(x) => set("maximumQuantity", x)}
          />
          <NumberField
            label="Typical capacity"
            value={form.typicalCapacity}
            onChange={(x) => set("typicalCapacity", x)}
          />
          <NumberField
            label="Declared available capacity"
            value={form.availableCapacity}
            onChange={(x) => set("availableCapacity", x)}
          />
          <TextField
            label="Unit"
            value={form.unit}
            onChange={(x) => set("unit", x)}
            max={180}
          />
          <label>
            Capacity period
            <select
              value={form.capacityPeriod}
              onChange={(e) =>
                set(
                  "capacityPeriod",
                  e.target.value as CapabilityInput["capacityPeriod"],
                )
              }
            >
              {["per_order", "day", "week", "month"].map((x) => (
                <option key={x} value={x}>
                  {words(x)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Capacity kind
            <select
              value={form.capacityKind}
              onChange={(e) =>
                set(
                  "capacityKind",
                  e.target.value as CapabilityInput["capacityKind"],
                )
              }
            >
              {(form.supplyMode === "source"
                ? ["sourcing_access"]
                : ["production", "stock", "service", "logistics"]
              ).map((x) => (
                <option key={x} value={x}>
                  {words(x)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="request-hint">
          These are your normal operating limits, not measured live stock. A
          later confirmation or review must be recorded separately.
        </p>
      </details>
      <details>
        <summary>Timing & specifications</summary>
        <div className="request-form-grid">
          <LeadFields
            value={form.leadTime}
            onChange={(x) => set("leadTime", x)}
          />
        </div>
        <TextField
          label="Production / operating schedule"
          value={form.productionSchedule}
          onChange={(x) => set("productionSchedule", x)}
          max={1000}
          area
        />
        {form.specifications.map((s, i) => (
          <div className="supply-spec-row" key={i}>
            <TextField
              label={`Specification ${i + 1} name`}
              value={s.name}
              onChange={(name) =>
                set(
                  "specifications",
                  form.specifications.map((x, j) =>
                    j === i ? { ...x, name } : x,
                  ),
                )
              }
              max={80}
            />
            <TextField
              label={`Specification ${i + 1} value`}
              value={s.value}
              onChange={(value) =>
                set(
                  "specifications",
                  form.specifications.map((x, j) =>
                    j === i ? { ...x, value } : x,
                  ),
                )
              }
              max={1000}
            />
            <button
              type="button"
              onClick={() =>
                set(
                  "specifications",
                  form.specifications.filter((_, j) => j !== i),
                )
              }
            >
              Remove specification
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={form.specifications.length >= 20}
          onClick={() =>
            set("specifications", [
              ...form.specifications,
              { name: "", value: "" },
            ])
          }
        >
          Add specification
        </button>
      </details>
      {form.supplyMode === "source" && (
        <details open>
          <summary>Sourcing access</summary>
          <p className="supply-disclosure">
            Can source, not manufactured or owned stock. Share a general
            description here, not confidential supplier identities.
          </p>
          <ListField
            label="Products you can source"
            value={form.sourcingAccess.products}
            onChange={(products) =>
              set("sourcingAccess", { ...form.sourcingAccess, products })
            }
          />
          <ListField
            label="Sourcing regions"
            value={form.sourcingAccess.regions}
            onChange={(regions) =>
              set("sourcingAccess", { ...form.sourcingAccess, regions })
            }
          />
          <TextField
            label="Public network description"
            value={form.sourcingAccess.networkDescription}
            onChange={(networkDescription) =>
              set("sourcingAccess", {
                ...form.sourcingAccess,
                networkDescription,
              })
            }
            max={1000}
            area
          />
          {(
            [
              ["deliveryCoordination", "Can coordinate delivery"],
              ["inspectionCapability", "Can inspect goods"],
              ["negotiationCapability", "Can negotiate terms"],
            ] as const
          ).map(([key, name]) => (
            <label className="supply-check" key={key}>
              <input
                type="checkbox"
                checked={form.sourcingAccess[key]}
                onChange={(e) =>
                  set("sourcingAccess", {
                    ...form.sourcingAccess,
                    [key]: e.target.checked,
                  })
                }
              />
              {name}
            </label>
          ))}
        </details>
      )}
      {initial && (
        <label>
          Capability status
          <select
            value={form.operatingStatus}
            onChange={(e) =>
              set(
                "operatingStatus",
                e.target.value as CapabilityInput["operatingStatus"],
              )
            }
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </label>
      )}
    </Editor>
  );
}
