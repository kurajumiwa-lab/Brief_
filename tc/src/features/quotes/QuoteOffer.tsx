import React from "react";
import type { QuoteOffer as Offer } from "../../api/quoteTypes";
import { RequestImage } from "../matching/RequestImage";
import { date } from "../supply/shared";
import { money } from "./money";
export { money } from "./money";
export function QuoteOffer({
  offer,
  context = "quote",
}: {
  offer: Offer;
  context?: "quote" | "work";
}) {
  const t = offer.terms,
    source = t.sourceType === "sourcing" || t.sourceType === "referral";
  return (
    <div className="quote-offer">
      <p className="quote-disclosure">{offer.disclosure}</p>
      <p className="request-hint">
        {offer.participant.roleLabel} (at submission) · Capability{" "}
        {offer.participant.capabilityVerification === "verified"
          ? "reviewed at submission"
          : "self-declared at submission"}
        . This does not verify the quote or source relationship.
      </p>
      <p>
        {t.quotedQuantity?.toLocaleString("en-KE")} {t.unit} ·{" "}
        {money(t.unitPriceMinor, t.currency)} / {t.unit}
      </p>
      <dl className="quote-costs">
        <dt>{source ? "Source cost" : "Product / service subtotal"}</dt>
        <dd>{money(t.subtotalMinor, t.currency)}</dd>
        <dt>{source ? "Logistics" : "Delivery"}</dt>
        <dd>{money(t.deliveryCostMinor, t.currency)}</dd>
        {source && (
          <>
            <dt>
              {t.sourceType === "referral" ? "Referral fee" : "Sourcing fee"}
            </dt>
            <dd>{money(t.sourcingFeeMinor, t.currency)}</dd>
          </>
        )}
        {t.otherCosts.map((c, index) => (
          <React.Fragment key={index}>
            <dt>{c.label}</dt>
            <dd>{money(c.amountMinor, t.currency)}</dd>
          </React.Fragment>
        ))}
      </dl>
      <p className="quote-total">Total {money(t.totalMinor, t.currency)}</p>
      <p>
        Stated turnaround: {t.productionLeadDays} production / service days.
        {t.deliveryLeadDays === null
          ? " Delivery timing not stated."
          : ` Plus ${t.deliveryLeadDays} delivery days.`}
      </p>
      {t.estimatedCompletionDate && (
        <p>Estimated completion: {date(t.estimatedCompletionDate)}</p>
      )}
      {context === "quote" && (
        <p>
          Quote expires:{" "}
          {t.validUntil
            ? `${date(t.validUntil)} (end of day, Nairobi)`
            : "No expiry specified"}
        </p>
      )}
      <details>
        <summary>Specification, exclusions and terms</summary>
        {(["specifications", "exclusions", "notes", "terms"] as const).map(
          (k) =>
            t[k] && (
              <div key={k}>
                <h4>
                  {k === "specifications"
                    ? "Offered specification"
                    : k[0].toUpperCase() + k.slice(1)}
                </h4>
                <p className="quote-text">{t[k]}</p>
              </div>
            ),
        )}
        <p className="request-hint">
          No exclusions stated does not imply independent confirmation of every
          requirement.
        </p>
      </details>
      <details>
        <summary>
          {context === "work"
            ? "Original shared Request requirements"
            : "Requirements this version responds to"}
        </summary>
        <p>
          {offer.requestSnapshot.title} · {offer.requestSnapshot.quantity}{" "}
          {offer.requestSnapshot.unit}
        </p>
        <p>
          {offer.requestSnapshot.location} ·{" "}
          {offer.requestSnapshot.requiredBy
            ? date(offer.requestSnapshot.requiredBy)
            : "Deadline not stated"}
        </p>
        {Object.entries(offer.requestSnapshot.specifications)
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <p key={k}>
              <strong>{k}: </strong>
              {v}
            </p>
          ))}
        {offer.requestSnapshot.requirements.map((r) => (
          <p key={r.id}>
            {r.label} · {r.quantity} {r.unit}
          </p>
        ))}
      </details>
      {t.evidence.length > 0 && (
        <details>
          <summary>
            Evidence uploaded by participant ({t.evidence.length}) — not
            verified
          </summary>
          {t.evidence.map((e, index) => (
            <div key={e.uploadId}>
              <p>
                {e.kind.split("_").join(" ")} ·{" "}
                {e.shareWithRequester
                  ? "Shared with requester"
                  : "Participant-private"}
              </p>
              <RequestImage
                id={e.uploadId}
                name={`Quote evidence ${index + 1}`}
              />
            </div>
          ))}
        </details>
      )}
      {t.privateProvenance &&
        (t.privateProvenance.reference || t.privateProvenance.notes) && (
          <details>
            <summary>Your private source provenance</summary>
            <p className="quote-text">{t.privateProvenance.reference}</p>
            <p className="quote-text">{t.privateProvenance.notes}</p>
          </details>
        )}
    </div>
  );
}
