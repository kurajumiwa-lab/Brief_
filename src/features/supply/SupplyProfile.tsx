import {WorkWorkspace} from "../work/LazyWork";
import {QuoteWorkspace} from "../quotes/LazyQuotes";
import { RelevantRequests } from "../matching/RelevantRequests";
import { TrustSection } from "./TrustSection";
import React from "react";
import { mediaFileUrl } from "../../api/briefApi";
import type { Enterprise, Capability } from "../../api/supplyTypes";
import { Fact, words, date, quantity, turnaround } from "./shared";
export function CapabilitySummary({
  capability: c,
  children,
}: {
  capability: Capability;
  children?: React.ReactNode;
}) {
  return (
    <article
      className={`supply-capability ${c.operatingStatus === "archived" ? "supply-archived" : ""}`}
    >
      <div className="supply-row-head">
        <div>
          <span className="request-eyebrow">
            {c.category} ·{" "}
            {c.supplyMode === "source" ? "Can source" : "Supplies directly"}
          </span>
          <h3>{c.name}</h3>
        </div>
        <span className="supply-badge">
          {c.operatingStatus !== "active"
            ? words(c.operatingStatus)
            : c.verification.status === "verified"
              ? "Capability reviewed"
              : "Business-declared"}
        </span>
      </div>
      {c.description && <p>{c.description}</p>}
      <dl className="supply-facts">
        <Fact
          label="Typical capacity"
          value={`${quantity(c.typicalCapacity)}${c.typicalCapacity !== null ? ` ${c.unit} / ${words(c.capacityPeriod)}` : ""}`}
        />
        <Fact
          label="Minimum order"
          value={`${quantity(c.minimumQuantity)} ${c.minimumQuantity === null ? "" : c.unit}`}
        />
        <Fact label="Turnaround" value={turnaround(c.leadTime)} />
        <Fact
          label="Service coverage"
          value={c.serviceAreas.join(", ") || "See enterprise coverage"}
        />
      </dl>
      <p className="request-hint">
        {c.supplyMode === "source"
          ? "Sourcing access, not owned production or stock. "
          : ""}
        Capacity and availability are stated by the business, not live
        inventory.{" "}
        {c.capacityInformation.verification.status === "verified"
          ? `Capacity evidence reviewed ${date(c.capacityInformation.verification.verifiedAt!)}. No current capacity confirmation.`
          : "Capacity not independently verified."}
      </p>
      <details>
        <summary>Operating details</summary>
        <dl className="supply-facts">
          <Fact
            label="Products / services"
            value={c.productsServices.join(", ") || "Not stated"}
          />
          <Fact
            label="Materials"
            value={c.materials.join(", ") || "Not stated"}
          />
          <Fact label="Maximum capacity" value={quantity(c.maximumQuantity)} />
          <Fact
            label="Declared available capacity"
            value={quantity(c.availableCapacity)}
          />
          <Fact label="Availability (declared)" value={words(c.availability)} />
          <Fact
            label="Capacity kind (declared)"
            value={words(c.capacityKind)}
          />
          <Fact
            label="Operating schedule"
            value={c.productionSchedule || "Not stated"}
          />
          <Fact label="Last declaration" value={date(c.declaredAt)} />
        </dl>
        {!!c.specifications.length && (
          <dl className="supply-facts">
            {c.specifications.map((s, i) => (
              <Fact key={i} label={s.name} value={s.value} />
            ))}
          </dl>
        )}
        {c.supplyMode === "source" && (
          <>
            <p>
              {c.sourcingAccess.networkDescription ||
                "No public sourcing-network description provided."}
            </p>
            <dl className="supply-facts">
              <Fact
                label="Can source"
                value={c.sourcingAccess.products.join(", ") || "Not stated"}
              />
              <Fact
                label="Sourcing regions"
                value={c.sourcingAccess.regions.join(", ") || "Not stated"}
              />
              <Fact
                label="Delivery / inspection / negotiation"
                value={
                  [
                    c.sourcingAccess.deliveryCoordination
                      ? "Delivery coordination"
                      : "",
                    c.sourcingAccess.inspectionCapability
                      ? "Goods inspection"
                      : "",
                    c.sourcingAccess.negotiationCapability ? "Negotiation" : "",
                  ]
                    .filter(Boolean)
                    .join(", ") || "Not stated"
                }
              />
            </dl>
          </>
        )}
        {c.evidence
          .filter((e) => e.url)
          .map((e) => (
            <a
              key={e.uploadId}
              href={mediaFileUrl(e.url!)}
              target="_blank"
              rel="noreferrer"
            >
              Public capability image (business-provided)
            </a>
          ))}
      </details>
      {children && <div className="request-actions">{children}</div>}
    </article>
  );
}
export function SupplyProfile({
  enterprise: p,
  owner,
  onEdit,
  onAdd,
  onCapability,
  onArchive,
  onSourcing,
  onVerification,
}: {
  enterprise: Enterprise;
  owner: boolean;
  onEdit: () => void;
  onAdd: () => void;
  onCapability: (c: Capability) => void;
  onArchive: (c: Capability) => void;
  onSourcing: () => void;
  onVerification: () => void;
}) {
  const source = p.sourcingProfile;
  return (
    <>
      <section className="supply-profile-heading">
        <span className="request-eyebrow">
          {owner ? "Your enterprise" : "Enterprise profile"} · {p.location}
        </span>
        <h1>{p.displayName}</h1>
        <div className="request-actions">
          <span className="supply-badge">{p.roleLabel}</span>
          <span className="supply-badge">{words(p.operatingStatus)}</span>
          {owner && (
            <span className="supply-badge">
              {p.publication === "public"
                ? "Discoverable when active"
                : "Private profile"}
            </span>
          )}
        </div>
        <p>{p.description || "A capability-led enterprise profile."}</p>
        <p className="supply-disclosure">{p.disclosure}</p>
        <dl className="supply-facts">
          <Fact
            label="Stated business type"
            value={`${words(p.businessType)} · ${p.verification.businessType.status === "verified" ? "type evidence reviewed" : "not verified"}`}
          />
          <Fact
            label="Service areas"
            value={p.serviceAreas.join(", ") || "Not stated"}
          />
          <Fact
            label="Identity verification"
            value={words(p.verification.identity.status)}
          />
          <Fact
            label="Sourcing-role verification"
            value={
              p.supplyRole === "direct_supplier"
                ? "Not an agent profile"
                : words(p.verification.sourcingRole.status)
            }
          />
        </dl>
        {p.contactPreferences.value && (
          <p>
            {p.contactPreferences.public
              ? "Public contact"
              : "Your private contact preference"}{" "}
            · {p.contactPreferences.method}: {p.contactPreferences.value}
          </p>
        )}
        {owner && (
          <div className="request-actions">
            <button onClick={onEdit}>Edit enterprise</button>
            <button onClick={onVerification}>
              Verification & private evidence
            </button>
            {p.supplyRole !== "direct_supplier" && (
              <button onClick={onSourcing}>Edit sourcing profile</button>
            )}
          </div>
        )}
      </section>
      <section aria-labelledby="supply-capabilities">
        <div className="supply-row-head">
          <div>
            <span className="request-eyebrow">What we can help get done</span>
            <h2 id="supply-capabilities">Capabilities</h2>
          </div>
          {owner && (
            <button className="request-primary" onClick={onAdd}>
              Add capability
            </button>
          )}
        </div>
        {!p.capabilities.length && (
          <div className="request-empty">
            <h3>No capabilities yet</h3>
            <p>
              {owner
                ? "Add what your business can produce, supply, deliver or source."
                : "This enterprise has no active capabilities to show."}
            </p>
          </div>
        )}
        {p.capabilities.map((c) => (
          <CapabilitySummary key={c.id} capability={c}>
            {owner && c.operatingStatus !== "archived" && (
              <>
                <button onClick={() => onCapability(c)}>Edit capability</button>
                <button className="request-danger" onClick={() => onArchive(c)}>
                  Archive capability
                </button>
              </>
            )}
          </CapabilitySummary>
        ))}
      </section>
      <TrustSection enterpriseId={p.id} />
      {p.supplyRole !== "direct_supplier" && (
        <section className="supply-section">
          <span className="request-eyebrow">
            Independent sourcing, explicitly disclosed
          </span>
          <h2>Sourcing profile</h2>
          <p>
            {source?.serviceDescription ||
              "No sourcing service description has been added."}
          </p>
          {source && (
            <>
              <dl className="supply-facts">
                <Fact
                  label="Categories"
                  value={source.categories.join(", ") || "Not stated"}
                />
                <Fact
                  label="Geographic coverage"
                  value={source.regions.join(", ") || "Not stated"}
                />
                <Fact
                  label="Years of experience (declared)"
                  value={quantity(source.experienceYears)}
                />
                <Fact
                  label="Typical order sizes (declared)"
                  value={`${quantity(source.typicalOrderMin)} to ${quantity(source.typicalOrderMax)}`}
                />
                <Fact
                  label="Sourcing lead time"
                  value={turnaround(source.sourcingLeadTime)}
                />
                <Fact
                  label="Coordination (declared)"
                  value={
                    [
                      source.deliveryCoordination ? "Delivery" : "",
                      source.inspectionCapability ? "Inspection" : "",
                      source.negotiationCapability ? "Negotiation" : "",
                    ]
                      .filter(Boolean)
                      .join(", ") || "Not stated"
                  }
                />
              </dl>
              {owner && source.privateNetworks && (
                <details>
                  <summary>Your private network notes</summary>
                  <p>{source.privateNetworks}</p>
                  <small>Not published or searchable.</small>
                </details>
              )}
            </>
          )}
          <p className="request-hint">
            Sourcing-role verification does not establish manufacturing
            capacity, ownership, dealership or an employment relationship.
            Underlying suppliers need not be publicly named.
          </p>
        </section>
      )}
      {owner && <><WorkWorkspace/><QuoteWorkspace/><RelevantRequests/></>}
    </>
  );
}
