import React, { useEffect, useState } from "react";
import * as api from "../../api/briefApi";
import type { PotentialParticipant } from "../../api/supplyTypes";
import { SessionSignIn } from "../../components/SessionSignIn";
import { supplyPath, turnaround, quantity } from "./shared";
export function RequestPotentialParticipants({
  requestId,
  writable,
}: {
  requestId: string;
  writable: boolean;
}) {
  const [rows, setRows] = useState<PotentialParticipant[]>([]),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    api.getPotentialParticipants(requestId).then((r) => {
      if (!live) return;
      setLoading(false);
      if (r.ok) {
        setRows(r.data);
        setError("");
      } else {
        setError(r.error);
        setAuth(r.status === 401);
      }
    });
    return () => {
      live = false;
    };
  }, [requestId, reload]);
  return (
    <section className="request-panel supply-potential">
      <div className="supply-row-head">
        <div>
          <span className="request-eyebrow">Your potential options</span>
          <h2>Businesses to consider</h2>
        </div>
        {writable && (
          <button onClick={() => supplyPath(`search/${requestId}`)}>
            Browse capabilities
          </button>
        )}
      </div>
      <p>
        Only options you save appear here. No automatic matching, inquiry,
        recommendation or capacity reservation. Your Request remains private.
      </p>
      {auth && (
        <SessionSignIn
          onSignedIn={() => {
            setAuth(false);
            setReload((n) => n + 1);
          }}
        />
      )}
      {error && (
        <p role="alert">
          {error}{" "}
          <button onClick={() => setReload((n) => n + 1)}>Retry options</button>
        </p>
      )}
      {loading ? (
        <p role="status">Loading potential options…</p>
      ) : (
        !error &&
        (["direct", "source"] as const).map((mode) => (
          <section key={mode}>
            <h3>
              {mode === "direct" ? "Potential suppliers" : "Sourcing agents"}
            </h3>
            {!rows.some((r) => r.supplyMode === mode) ? (
              <p>
                {mode === "direct"
                  ? "No potential suppliers saved yet."
                  : "No sourcing agents saved yet."}
              </p>
            ) : (
              rows
                .filter((r) => r.supplyMode === mode)
                .map((r) => (
                  <article className="supply-potential-row" key={r.id}>
                    {r.available && r.capability && r.participant ? (
                      <>
                        <h4>{r.capability.name}</h4>
                        <p>
                          {r.participant.displayName} ·{" "}
                          {r.supplyMode === "source"
                            ? "Can source"
                            : "Supplies directly"}{" "}
                          · {r.participant.roleLabel}
                        </p>
                        <p>
                          {quantity(r.capability.typicalCapacity)}{" "}
                          {r.capability.unit} typical capacity (declared) ·{" "}
                          {turnaround(r.capability.leadTime)}
                        </p>
                        <button
                          onClick={() =>
                            supplyPath(`profile/${r.participantId}`)
                          }
                        >
                          View enterprise
                        </button>
                      </>
                    ) : (
                      <>
                        <h4>Previously saved option unavailable</h4>
                        <p>
                          The enterprise or capability is no longer publicly
                          available. No private details are shown.
                        </p>
                      </>
                    )}
                    {writable && (
                      <button
                        disabled={!!busy}
                        onClick={async () => {
                          setBusy(r.id);
                          const res = await api.removePotentialParticipant(
                            requestId,
                            r.id,
                            r.revision,
                          );
                          setBusy("");
                          if (res.ok) setReload((n) => n + 1);
                          else {
                            setError(res.error);
                            setAuth(res.status === 401);
                          }
                        }}
                      >
                        Remove option
                      </button>
                    )}
                  </article>
                ))
            )}
          </section>
        ))
      )}
    </section>
  );
}
