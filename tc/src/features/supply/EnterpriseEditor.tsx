import React, { useState } from "react";
import * as api from "../../api/briefApi";
import {
  businessTypes,
  type Enterprise,
  type EnterpriseInput,
  type EnterpriseSupplyRole,
} from "../../api/supplyTypes";
import {
  Editor,
  TextField,
  ListField,
  LeadFields,
  NumberField,
  words,
  emptyCapability,
} from "./shared";
export function EnterpriseEditor({
  initial,
  agentPath = false,
  onSaved,
  onCancel,
  onReload,
}: {
  initial?: Enterprise;
  agentPath?: boolean;
  onSaved: (e: Enterprise) => void;
  onCancel: () => void;
  onReload: () => void;
}) {
  const [form, setForm] = useState<EnterpriseInput>(() =>
    initial
      ? {
          displayName: initial.displayName,
          legalName: initial.legalName ?? "",
          description: initial.description,
          businessType: initial.businessType,
          supplyRole: initial.supplyRole,
          location: initial.location,
          serviceAreas: initial.serviceAreas,
          operatingStatus: initial.operatingStatus,
          publication: initial.publication,
          contactPreferences: {
            ...initial.contactPreferences,
            value: initial.contactPreferences.value ?? "",
          },
        }
      : {
          displayName: "",
          legalName: "",
          description: "",
          businessType: agentPath ? "sourcing_agent" : "service_provider",
          supplyRole: agentPath ? "verified_sourcing_agent" : "direct_supplier",
          location: "",
          serviceAreas: [],
          operatingStatus: "active",
          publication: "private",
          contactPreferences: { method: "brief", value: "", public: false },
        },
  );
  const [first, setFirst] = useState(() =>
    emptyCapability(agentPath ? "source" : "direct"),
  );
  const set = <K extends keyof EnterpriseInput>(
    k: K,
    value: EnterpriseInput[K],
  ) => setForm((f) => ({ ...f, [k]: value }));
  const role = (value: EnterpriseSupplyRole) => {
    setForm((f) => ({
      ...f,
      supplyRole: value,
      businessType:
        value === "hybrid"
          ? "hybrid"
          : value === "verified_sourcing_agent"
            ? "sourcing_agent"
            : "service_provider",
    }));
    setFirst((f) => ({
      ...f,
      supplyMode: value === "verified_sourcing_agent" ? "source" : "direct",
      capacityKind:
        value === "verified_sourcing_agent" ? "sourcing_access" : "service",
    }));
  };
  return (
    <Editor
      save={() =>
        initial
          ? api.updateEnterprise(initial.id, {
              ...form,
              revision: initial.revision!,
            })
          : api.createEnterprise({ ...form, firstCapability: first })
      }
      onSaved={onSaved}
      onCancel={onCancel}
      onReload={onReload}
      label={initial ? "Save enterprise" : "Create enterprise"}
    >
      <span className="request-eyebrow">
        {initial ? "Your enterprise identity" : "Start with what you can do"}
      </span>
      <h2>
        {initial
          ? "Edit enterprise"
          : "What can your business help someone get done?"}
      </h2>
      {!initial && (
        <>
          <TextField
            label="First capability"
            value={first.name}
            onChange={(name) => setFirst((f) => ({ ...f, name }))}
            max={180}
            required
            placeholder={
              agentPath
                ? "e.g. Source small-order branded bottles"
                : "e.g. Corrugated cartons, cold-chain transport"
            }
          />
          <TextField
            label="Capability category"
            value={first.category}
            onChange={(category) => setFirst((f) => ({ ...f, category }))}
            required
            max={180}
            placeholder="e.g. Packaging, logistics, fabrication"
          />
        </>
      )}
      <TextField
        label="Business / display name"
        value={form.displayName}
        onChange={(x) => set("displayName", x)}
        required
      />
      <label>
        How do you provide it?
        <select
          value={form.supplyRole}
          onChange={(e) => role(e.target.value as EnterpriseSupplyRole)}
        >
          <option value="direct_supplier">We supply directly</option>
          <option value="verified_sourcing_agent">
            I help businesses source things
          </option>
          <option value="hybrid">Both — direct supply and sourcing</option>
        </select>
      </label>
      {form.supplyRole !== "direct_supplier" && (
        <p className="supply-disclosure">
          You are identified as an independent sourcing agent for sourced
          capabilities, not the manufacturer or supplier. Do not claim ownership
          or authorization unless separately reviewed. Verification is not
          required to save a profile.
        </p>
      )}
      <label>
        Stated business type
        <select
          value={form.businessType}
          onChange={(e) =>
            set(
              "businessType",
              e.target.value as EnterpriseInput["businessType"],
            )
          }
        >
          {businessTypes
            .filter((t) =>
              form.supplyRole === "hybrid"
                ? t === "hybrid"
                : form.supplyRole === "verified_sourcing_agent"
                  ? t === "sourcing_agent"
                  : !["hybrid", "sourcing_agent"].includes(t),
            )
            .map((t) => (
              <option key={t} value={t}>
                {words(t)}
              </option>
            ))}
        </select>
      </label>
      <p className="request-hint">
        Business type is self-declared. Manufacturing, ownership and
        authorization are not treated as verified by this selection.
      </p>
      <div className="request-form-grid">
        <TextField
          label="Physical location"
          value={form.location}
          onChange={(x) => set("location", x)}
          required
          placeholder="e.g. Industrial Area, Nairobi"
        />
        <ListField
          label="Service areas"
          value={form.serviceAreas}
          onChange={(x) => set("serviceAreas", x)}
        />
      </div>
      <TextField
        label="What do you provide?"
        value={form.description}
        onChange={(x) => set("description", x)}
        max={3000}
        area
      />
      {!initial && (
        <details>
          <summary>
            Typical capacity & turnaround <span>Optional</span>
          </summary>
          <div className="request-form-grid">
            <NumberField
              label="Typical capacity"
              value={first.typicalCapacity}
              onChange={(typicalCapacity) =>
                setFirst((f) => ({ ...f, typicalCapacity }))
              }
            />
            <TextField
              label="Capacity unit"
              value={first.unit}
              onChange={(unit) => setFirst((f) => ({ ...f, unit }))}
              max={180}
            />
            <LeadFields
              value={first.leadTime}
              onChange={(leadTime) => setFirst((f) => ({ ...f, leadTime }))}
            />
          </div>
          <p className="request-hint">
            Per-order capacity stated by you. This is not verified inventory or
            a live availability promise.
          </p>
        </details>
      )}
      <details>
        <summary>
          Identity & contact preferences <span>Optional</span>
        </summary>
        <TextField
          label="Legal / registered business name (private)"
          value={form.legalName}
          onChange={(x) => set("legalName", x)}
        />
        <label>
          Preferred contact method
          <select
            value={form.contactPreferences.method}
            onChange={(e) =>
              set("contactPreferences", {
                ...form.contactPreferences,
                method: e.target
                  .value as EnterpriseInput["contactPreferences"]["method"],
              })
            }
          >
            {["brief", "email", "phone", "whatsapp"].map((m) => (
              <option key={m} value={m}>
                {words(m)}
              </option>
            ))}
          </select>
        </label>
        <TextField
          label="Contact details (private by default)"
          value={form.contactPreferences.value}
          onChange={(value) =>
            set("contactPreferences", { ...form.contactPreferences, value })
          }
        />
        <label className="supply-check">
          <input
            type="checkbox"
            checked={form.contactPreferences.public}
            onChange={(e) =>
              set("contactPreferences", {
                ...form.contactPreferences,
                public: e.target.checked,
              })
            }
          />
          Show these contact details on my public profile
        </label>
        <p className="request-hint">
          Choosing Brief records a preference; a new messaging service is not
          enabled by this setting.
        </p>
      </details>
      <label className="supply-check">
        <input
          type="checkbox"
          checked={form.publication === "public"}
          onChange={(e) =>
            set("publication", e.target.checked ? "public" : "private")
          }
        />
        Make my profile and active capabilities discoverable
      </label>
      <p className="request-hint">
        Private verification evidence and supplier-network notes are never
        published. You can save privately and publish later.
      </p>
      {initial && (
        <label>
          Operating status
          <select
            value={form.operatingStatus}
            onChange={(e) =>
              set(
                "operatingStatus",
                e.target.value as EnterpriseInput["operatingStatus"],
              )
            }
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="closed">Closed</option>
          </select>
        </label>
      )}
    </Editor>
  );
}
