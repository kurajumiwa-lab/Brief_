# Agreement & State Integrity Contract

**Status:** adopted as law. New economic code MUST obey it. Existing code is
brought into line phase by phase; nothing here claims the current tree already
complies — each phase says what it changed.

## The contract

An agreement is an immutable versioned economic commitment.

Each agreement version has a unique identifier. Any acceptance, amendment,
Work Order, payment intent, settlement, completion, or other economic
consequence MUST reference the agreement version from which it was derived.

An amendment MUST create a new agreement version. It MUST NOT rewrite the
historical terms, acceptance, Work Order, payment, ledger, or completion
records of an earlier version.

A command MAY transition multiple related state machines only when those
transitions form one explicitly defined atomic operation. Partial success
MUST NOT leave related records in incompatible states.

The following are independent facts and MUST NOT be conflated:

- Request state
- Quote/Offer state
- Agreement state
- Work Order state
- Payment state
- Ledger state
- Completion/procurement state
- Trust/history state

A transition in one state machine MUST NOT implicitly imply completion of
another state machine unless that relationship is explicitly defined by the
domain.

Reads, renders, previews, listings, and history views MUST be side-effect
free. They MUST NOT create agreements, orders, payments, ledger entries,
revisions, attribution, trust records, or other economic records.

Every externally retriable command that can create or transition an economic
record MUST define an idempotency boundary. Repeating the same command MUST
return or preserve the same logical result. Reusing an idempotency key with
materially different input MUST be rejected.

Historical economic facts MUST be immutable. Later pricing, profile, status,
or descriptive changes MUST NOT rewrite the historical facts from which
previous transactions were created.

Derived values MUST be calculated from authoritative records rather than
maintained as competing stored state, unless an explicit snapshot is required
for historical correctness. A snapshot MUST identify the source records and
the point in time at which it was taken.

Every economic or trust-producing record MUST have explainable provenance:

Actor → action → object → agreement/version → authoritative cause →
resulting record.

No money, credit, trust, attribution, completion, or economic obligation may
be created without such an authoritative cause.

Authorization MUST be evaluated against the real authenticated actor, the
target object, and the applicable scope/capability. Possession of a guessed
or foreign identifier MUST never constitute authorization.

A failed transition MUST leave all participating state machines in their
prior valid state. A successful transition MUST leave a state that can be
reconstructed from the committed records without relying on hidden
intermediate stages.

Process restart, retry, callback replay, and concurrent submission MUST NOT
create duplicate economic consequences.

The system MUST prefer an explicit refusal or an honest unavailable/unknown
state over silently fabricating, inferring, or completing a missing stage.

## The lifecycle is causal, not one giant state

“Accepted” is not “completed.” “Authorized” is not “paid.” “Paid” is not
“fulfilled.” “Fulfilled” is not “trusted.”

Quote → Accepted Agreement → Work → Payment Authorized →
Payment Confirmed/Settled → Work Completed → Historical/Trust Derivation

Each arrow is an explicit transition with its own cause. In particular:

- a payment callback MUST NOT complete a Work Order;
- an acceptance MUST NOT create a ledger transaction;
- a profile change MUST NOT recalculate historical trust.

## First implementation of this contract: vendor leads

`server/src/domain/vendorLeads.js` is the first domain written directly
against this contract, and the pattern to copy:

- `vendorLeads` rows carry `status` as one machine (`captured` → `validated`
  → `claimed`, plus `dropped`). Validation is a separate explicit command,
  not a side effect of creation or of any read.
- Creation takes an `idempotencyKey`. Same key + same input returns the same
  lead with `replayed: true`. Same key + different input is rejected (409).
- Validation requires an authoritative cause that MUST exist: a real
  capability, request, or Work Order row. A guessed id fails closed (404).
- Exposure terms are recorded only when an operator explicitly sets them —
  amount, period, note, setter, timestamp. There are no default amounts and
  no inferred prices anywhere.
- Reads (`listLeads`, `getLead`) create nothing.
- Every transition appends a history event (actor → action → changed fields).
