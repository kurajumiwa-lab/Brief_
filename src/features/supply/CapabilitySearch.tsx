import React, { useEffect, useState } from "react";
import * as api from "../../api/briefApi";
import type { CapabilitySearch as SearchResult } from "../../api/supplyTypes";
import { SessionSignIn } from "../../components/SessionSignIn";
import { CapabilitySummary } from "./SupplyProfile";
import { supplyPath, TextField, words } from "./shared";
export function CapabilitySearch({ requestId }: { requestId?: string }) {
  const [filters, setFilters] = useState({
      q: "",
      category: "",
      location: "",
      serviceArea: "",
      supplyRole: "",
      supplyMode: "",
    }),
    [result, setResult] = useState<SearchResult | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [auth, setAuth] = useState(false),
    [reload, setReload] = useState(0),
    [query, setQuery] = useState<Record<string, string>>({}),
    [saving, setSaving] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    api.searchCapabilities(query).then((r) => {
      if (!live) return;
      setLoading(false);
      if (r.ok) {
        setResult(r.data);
        setAuth(false);
      } else {
        setResult(null);
        setError(r.error);
        setAuth(r.status === 401);
      }
    });
    return () => {
      live = false;
    };
  }, [query, reload]);
  return (
    <section>
      <span className="request-eyebrow">Find what a business can do</span>
      <h1>Explore capabilities</h1>
      <p>
        Search production, supply, services and sourcing access. Results explain
        what is declared, where it is offered and whether it has been reviewed.
        No scores or automatic recommendations.
      </p>
      {requestId && (
        <div className="request-future">
          <p>
            Keep potential options for your Request. Saving an option does not
            contact the business, create a match or reveal your private Request.
          </p>
          <button
            onClick={() => {
              window.location.hash = `requests/${requestId}`;
            }}
          >
            Back to Request
          </button>
        </div>
      )}
      <form
        className="request-panel request-form supply-search"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(
            Object.fromEntries(
              Object.entries(filters).filter(([, v]) => v.trim()),
            ),
          );
        }}
      >
        <label>
          What do you need to get done?
          <input
            type="search"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            maxLength={160}
            placeholder="e.g. cartons, cold storage, sourcing bottles"
          />
        </label>
        <details>
          <summary>Filter capabilities</summary>
          <div className="request-form-grid">
            {(["category", "location", "serviceArea"] as const).map((k) => (
              <TextField
                key={k}
                label={
                  k === "serviceArea"
                    ? "Service area"
                    : k === "location"
                      ? "Physical location"
                      : "Category"
                }
                value={filters[k]}
                onChange={(v) => setFilters((f) => ({ ...f, [k]: v }))}
                max={160}
              />
            ))}
            <label>
              Enterprise role
              <select
                value={filters.supplyRole}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, supplyRole: e.target.value }))
                }
              >
                <option value="">Any role</option>
                <option value="direct_supplier">Direct supplier</option>
                <option value="verified_sourcing_agent">
                  Sourcing agent (status shown separately)
                </option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>
            <label>
              Supply mode
              <select
                value={filters.supplyMode}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, supplyMode: e.target.value }))
                }
              >
                <option value="">Direct or sourcing</option>
                <option value="direct">Supplies directly</option>
                <option value="source">Can source</option>
              </select>
            </label>
          </div>
        </details>
        <div className="request-actions">
          <button className="request-primary" disabled={loading}>
            Search capabilities
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters({
                q: "",
                category: "",
                location: "",
                serviceArea: "",
                supplyRole: "",
                supplyMode: "",
              });
              setQuery({});
            }}
          >
            Clear filters
          </button>
        </div>
      </form>
      {auth && (
        <SessionSignIn
          title="Sign in to explore capabilities"
          onSignedIn={() => {
            setAuth(false);
            setReload((n) => n + 1);
          }}
        />
      )}
      {error && (
        <p role="alert" className="request-error">
          {error}{" "}
          <button onClick={() => setReload((n) => n + 1)}>Retry search</button>
        </p>
      )}
      {notice && (
        <p role="status" className="supply-notice">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Searching capabilities…</p>
      ) : (
        result && (
          <>
            <p>
              {result.total}{" "}
              {result.total === 1 ? "capability" : "capabilities"} found ·{" "}
              {result.total
                ? "Alphabetical order, not a ranking"
                : "No invented suppliers"}
            </p>
            {!result.total ? (
              <div className="request-empty">
                <h2>No capabilities found</h2>
                <p>
                  Try a different product, material, category or service area.
                  The network only shows actual published capabilities.
                </p>
                <button onClick={() => supplyPath("mine")}>
                  What can your business provide?
                </button>
              </div>
            ) : (
              result.capabilities.map(({ capability: c, participant: p }) => (
                <div className="supply-search-hit" key={c.id}>
                  <CapabilitySummary capability={c}>
                    <button onClick={() => supplyPath(`profile/${p.id}`)}>
                      View {p.displayName}
                    </button>
                    {requestId && (
                      <button
                        className="request-primary"
                        disabled={!!saving}
                        onClick={async () => {
                          setSaving(c.id);
                          setNotice("");
                          const r = await api.addPotentialParticipant(
                            requestId,
                            c.id,
                          );
                          setSaving("");
                          if (r.ok)
                            setNotice(
                              `${c.name} saved as a potential ${c.supplyMode === "source" ? "sourcing option" : "supplier"}. No inquiry sent.`,
                            );
                          else {
                            setError(r.error);
                            setAuth(r.status === 401);
                          }
                        }}
                      >
                        {saving === c.id ? "Saving…" : "Save potential option"}
                      </button>
                    )}
                  </CapabilitySummary>
                  <p className="supply-hit-identity">
                    {p.displayName} · {p.location} · {p.roleLabel}
                    <br />
                    <small>
                      {p.serviceAreas.join(", ")} ·{" "}
                      {words(p.verification.identity.status)} identity
                    </small>
                  </p>
                </div>
              ))
            )}
            {result.total > result.limit && (
              <div className="request-actions">
                <button
                  disabled={result.offset === 0}
                  onClick={() =>
                    setQuery((q) => ({
                      ...q,
                      offset: String(Math.max(0, result.offset - result.limit)),
                    }))
                  }
                >
                  Previous results
                </button>
                <button
                  disabled={result.offset + result.limit >= result.total}
                  onClick={() =>
                    setQuery((q) => ({
                      ...q,
                      offset: String(result.offset + result.limit),
                    }))
                  }
                >
                  Next results
                </button>
              </div>
            )}
          </>
        )
      )}
    </section>
  );
}
