import React, { useState } from "react";
import * as api from "../../api/briefApi";
import type { DemandMatch } from "../../api/matchTypes";
import { SessionSignIn } from "../../components/SessionSignIn";
export function RequestQuoteButton({
  match,
  requestRevision,
  disabled,
}: {
  match: DemandMatch;
  requestRevision: number;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false),
    [sent, setSent] = useState(false);
  return (
    <div className="quote-invite">
      <button
        disabled={disabled || busy || sent}
        onClick={() => setOpen(!open)}
      >
        {sent ? "Quote requested" : "Request a quote"}
      </button>
      {open && !sent && (
        <div className="quote-consent">
          <p>
            Ask this matched business for a commercial proposal. It must
            indicate interest before quoting.
          </p>
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{" "}
            Share this Request’s specification fields, structured requirements,
            quantity, broad location and deadline with this participant.
          </label>
          <p className="request-hint">
            Your budget, private description, contacts, exact delivery address
            and Request images are not shared. Check the specification text for
            sensitive details before sending.
          </p>
          <button
            disabled={!consent || busy || disabled || auth}
            onClick={async () => {
              setBusy(true);
              const r = await api.requestMatchQuote(match.id, {
                requestRevision,
                matchRevision: match.revision,
                shareRequirements: true,
              });
              setBusy(false);
              if (r.ok) {
                setSent(true);
                setError("");
                window.dispatchEvent(new Event("brief:quotes-changed"));
              } else {
                setError(r.error);
                setAuth(r.status === 401);
              }
            }}
          >
            {busy ? "Sending…" : "Send quote request"}
          </button>
          <button disabled={busy} onClick={() => setOpen(false)}>
            Not now
          </button>
        </div>
      )}
      {sent && (
        <p role="status">
          The participant now has a real quote request in their workspace. No
          availability or price is promised.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {auth && (
        <SessionSignIn
          title="Sign in to request a quote"
          onSignedIn={() => {
            setAuth(false);
            setError("Signed in. Retry your quote request.");
          }}
        />
      )}
    </div>
  );
}
