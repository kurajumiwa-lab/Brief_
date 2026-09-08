import React from "react";
import type {
  WorkOrder,
  WorkAgreement as Agreement,
} from "../../api/workTypes";
import { QuoteOffer } from "../quotes/QuoteOffer";
export function WorkAgreement({
  work,
  agreement: a,
  proposed = false,
}: {
  work: WorkOrder;
  agreement: Agreement;
  proposed?: boolean;
}) {
  return (
    <div className="work-agreement">
      <h3>
        {proposed ? "Proposed terms" : "Agreed terms"} · version{" "}
        {a.revision + (proposed ? 1 : 0)}
      </h3>
      <p>{a.requirements.title}</p>
      <p className="request-hint">
        Based on accepted Quote v{work.acceptedOfferRevision}. Routine progress
        cannot edit these terms.
      </p>
      <QuoteOffer
        context="work"
        offer={{
          revision: a.revision,
          submittedAt: a.createdAt,
          requestRevision: 0,
          requestSnapshot: a.requirements,
          participant: work.participant,
          disclosure: work.relationship,
          terms: {
            ...a.terms,
            validUntil: null,
            evidence: work.acceptedEvidence ?? [],
          },
        }}
      />
      <dl className="quote-costs">
        <dt>Fulfillment location</dt>
        <dd>{a.fulfillmentLocation || "Not agreed yet"}</dd>
        <dt>Agreed start date</dt>
        <dd>{a.agreedStartDate || "Not agreed yet"}</dd>
      </dl>
      <h4>Delivery details</h4>
      <p className="quote-text">
        {a.deliveryDetails ||
          "No further delivery details agreed. Propose an amendment to confirm an address or collection instructions."}
      </p>
    </div>
  );
}
