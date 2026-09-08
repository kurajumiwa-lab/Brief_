import React, { useState } from "react";
import * as api from "../../api/briefApi";
import type { Enterprise, SourcingInput } from "../../api/supplyTypes";
import {
  Editor,
  TextField,
  ListField,
  NumberField,
  LeadFields,
} from "./shared";
export function SourcingEditor({
  enterprise,
  onSaved,
  onCancel,
  onReload,
}: {
  enterprise: Enterprise;
  onSaved: (p: Enterprise) => void;
  onCancel: () => void;
  onReload: () => void;
}) {
  const [form, setForm] = useState<SourcingInput>(() => {
    const defaults: SourcingInput = {
      serviceDescription: "",
      experienceYears: null,
      categories: [],
      regions: [],
      typicalOrderMin: null,
      typicalOrderMax: null,
      sourcingLeadTime: { minDays: null, maxDays: null },
      deliveryCoordination: false,
      inspectionCapability: false,
      negotiationCapability: false,
      privateNetworks: "",
    };
    return Object.fromEntries(
      Object.entries(defaults).map(([key, value]) => [
        key,
        enterprise.sourcingProfile?.[key as keyof SourcingInput] ?? value,
      ]),
    ) as unknown as SourcingInput;
  });
  const set = <K extends keyof SourcingInput>(k: K, value: SourcingInput[K]) =>
    setForm((f) => ({ ...f, [k]: value }));
  return (
    <Editor
      save={() =>
        api.saveSourcingProfile(enterprise.id, {
          ...form,
          revision: enterprise.revision!,
        })
      }
      onSaved={onSaved}
      onCancel={onCancel}
      onReload={onReload}
      label="Save sourcing profile"
    >
      <span className="request-eyebrow">Independent sourcing</span>
      <h2>What can you source?</h2>
      <p className="supply-disclosure">
        You source through external relationships. You are not presented as the
        manufacturer, warehouse owner, employee or authorized dealer unless that
        specific relationship is reviewed.
      </p>
      <TextField
        label="Sourcing service description"
        value={form.serviceDescription}
        onChange={(x) => set("serviceDescription", x)}
        max={3000}
        area
      />
      <div className="request-form-grid">
        <ListField
          label="Sourcing categories"
          value={form.categories}
          onChange={(x) => set("categories", x)}
        />
        <ListField
          label="Geographic coverage"
          value={form.regions}
          onChange={(x) => set("regions", x)}
        />
        <NumberField
          label="Years of sourcing experience (stated)"
          value={form.experienceYears}
          onChange={(x) => set("experienceYears", x)}
          max={100}
        />
        <NumberField
          label="Typical minimum order size"
          value={form.typicalOrderMin}
          onChange={(x) => set("typicalOrderMin", x)}
        />
        <NumberField
          label="Typical maximum order size"
          value={form.typicalOrderMax}
          onChange={(x) => set("typicalOrderMax", x)}
        />
        <LeadFields
          value={form.sourcingLeadTime}
          onChange={(x) => set("sourcingLeadTime", x)}
        />
      </div>
      {(
        [
          ["deliveryCoordination", "Delivery coordination"],
          ["inspectionCapability", "Goods inspection"],
          ["negotiationCapability", "Supplier negotiation"],
        ] as const
      ).map(([key, name]) => (
        <label className="supply-check" key={key}>
          <input
            type="checkbox"
            checked={form[key]}
            onChange={(e) => set(key, e.target.checked)}
          />
          {name} — self-declared
        </label>
      ))}
      <details>
        <summary>
          Private supplier-network notes <span>Only you</span>
        </summary>
        <TextField
          label="Private network notes"
          value={form.privateNetworks}
          onChange={(x) => set("privateNetworks", x)}
          max={3000}
          area
        />
        <p className="request-hint">
          These notes never appear in search or public profiles. Private
          evidence for a reviewer belongs in verification, not in this public
          service description.
        </p>
      </details>
      <p className="request-hint">
        Location and contact preferences come from your enterprise identity.
        Fees and prices belong to a future disclosed quote, not this profile.
      </p>
    </Editor>
  );
}
