import React, { useEffect, useState } from "react";
import * as api from "../../api/briefApi";
import {
  evidenceTypes,
  type Enterprise,
  type SupplyEvidence,
  type SupplyVerification,
  type VerificationKind,
} from "../../api/supplyTypes";
import { SessionSignIn } from "../../components/SessionSignIn";
import { Editor, TextField, words, date } from "./shared";
export function PrivateEvidence({ id }: { id: string }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [signIn, setSignIn] = useState(false);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return (
    <div className="supply-evidence">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          const r = await api.readPrivateEvidence(id);
          setBusy(false);
          if (r.ok) setUrl(URL.createObjectURL(r.data));
          else setError(r.error);
        }}
      >
        {busy ? "Opening…" : "Open private evidence"}
      </button>
      {error && (
        <>
          <p role="alert">{error}</p>
          <button type="button" onClick={() => setSignIn(true)}>
            Sign in again
          </button>
        </>
      )}
      {signIn && (
        <SessionSignIn
          title="Sign in to open private evidence"
          onSignedIn={() => {
            setSignIn(false);
            setError("Signed in. Open the evidence again.");
          }}
        />
      )}
      {url && (
        <div role="dialog" aria-label="Private verification evidence">
          <p>
            Private evidence · Only the owner and authorized Brief reviewers
          </p>
          <img
            src={url}
            alt="Private verification evidence submitted by the business"
          />
          <button type="button" onClick={() => setUrl("")}>
            Close evidence
          </button>
        </div>
      )}
    </div>
  );
}
function RecordSummary({ record: r }: { record: SupplyVerification }) {
  return (
    <article className="supply-record">
      <div className="supply-row-head">
        <h3>
          {words(r.kind)}
          {r.capabilityId ? " · Capability scope" : ""}
        </h3>
        <span className="supply-badge">{words(r.effectiveStatus)}</span>
      </div>
      <p>
        Submitted {date(r.submittedAt)}
        {r.reviewedAt ? ` · Last reviewed ${date(r.reviewedAt)}` : ""}
        {r.expiresAt ? ` · Expires ${date(r.expiresAt)}` : ""}
      </p>
      {r.note && <p>Private submission note: {r.note}</p>}
      {r.reason && <p>Review reason: {r.reason}</p>}
      {r.evidence.map((e) => (
        <div key={e.uploadId}>
          <p>
            {words(e.type)}
            {e.note ? ` · ${e.note}` : ""}
          </p>
          <PrivateEvidence id={e.uploadId} />
        </div>
      ))}
      <details>
        <summary>Review history</summary>
        <ol>
          {r.history.map((e) => (
            <li key={e.id}>
              {words(e.action)} · {date(e.at)}
            </li>
          ))}
        </ol>
      </details>
    </article>
  );
}
export function VerificationPanel({
  enterprise: p,
  onDone,
}: {
  enterprise: Enterprise;
  onDone: () => void;
}) {
  const [records, setRecords] = useState<SupplyVerification[]>([]),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false),
    [reload, setReload] = useState(0),
    [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<VerificationKind>("identity"),
    [capabilityId, setCapability] = useState(""),
    [type, setType] = useState<SupplyEvidence["type"]>("business_registration"),
    [evidence, setEvidence] = useState<SupplyEvidence[]>([]),
    [note, setNote] = useState(""),
    [uploading, setUploading] = useState(false),
    [uploadError, setUploadError] = useState("");
  useEffect(() => {
    let live = true;
    setLoading(true);
    api.getSupplyVerification(p.id).then((r) => {
      if (!live) return;
      setLoading(false);
      if (r.ok) {
        setRecords(r.data);
        setError("");
      } else {
        setError(r.error);
        setAuth(r.status === 401);
      }
    });
    return () => {
      live = false;
    };
  }, [p.id, reload]);
  return (
    <section>
      <span className="request-eyebrow">
        Optional · private · scope-specific
      </span>
      <h2>Verification & private evidence</h2>
      <p>
        Onboarding is not blocked by verification. Brief reviewers can manually
        review evidence for a specific scope. This is not external KYC, live
        capacity confirmation or blanket approval of a business.
      </p>
      <p className="supply-disclosure">
        A verified sourcing role is separate from identity, manufacturing,
        authorization and capability checks. An agent label requires both
        identity and sourcing-role approval.
      </p>
      {auth && (
        <SessionSignIn
          title="Sign in to access private evidence"
          onSignedIn={() => {
            setAuth(false);
            setReload((n) => n + 1);
          }}
        />
      )}
      {error && (
        <p role="alert">
          {error}{" "}
          <button onClick={() => setReload((n) => n + 1)}>
            Retry verification
          </button>
        </p>
      )}
      <Editor
        save={() =>
          api.submitSupplyVerification(p.id, {
            kind,
            capabilityId: ["capability", "capacity"].includes(kind)
              ? capabilityId
              : null,
            participantRevision: p.revision!,
            evidence,
            note,
          })
        }
        onSaved={() => {
          setEvidence([]);
          setNote("");
          setReload((n) => n + 1);
        }}
        onCancel={onDone}
        onReload={onDone}
        canSubmit={!uploading && evidence.length > 0}
        label="Submit for manual review"
      >
        <h3>Submit evidence</h3>
        <div className="request-form-grid">
          <label>
            Verification scope
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as VerificationKind)}
            >
              {(
                [
                  "identity",
                  "business_type",
                  ...(p.supplyRole === "direct_supplier"
                    ? []
                    : ["sourcing_role"]),
                  "capability",
                  "capacity",
                  "authorization",
                ] as VerificationKind[]
              ).map((k) => (
                <option key={k} value={k}>
                  {words(k)}
                </option>
              ))}
            </select>
          </label>
          {["capability", "capacity"].includes(kind) && (
            <label>
              Capability to review
              <select
                required
                value={capabilityId}
                onChange={(e) => setCapability(e.target.value)}
              >
                <option value="">Choose capability</option>
                {p.capabilities
                  .filter((c) => c.operatingStatus !== "archived")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ·{" "}
                      {c.supplyMode === "source"
                        ? "Can source"
                        : "Supplies directly"}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label>
            Evidence type
            <select
              value={type}
              onChange={(e) =>
                setType(e.target.value as SupplyEvidence["type"])
              }
            >
              {evidenceTypes.map((t) => (
                <option key={t} value={t}>
                  {words(t)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Attach private evidence image
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={uploading || evidence.length >= 8}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setUploading(true);
              setUploadError("");
              const r = await api.uploadMediaFile(file, {
                purpose: "private_evidence",
              });
              setUploading(false);
              if (r.ok)
                setEvidence((x) =>
                  x.some((i) => i.uploadId === r.data.upload.id)
                    ? x
                    : [...x, { uploadId: r.data.upload.id, type, note: "" }],
                );
              else {
                setUploadError(r.error);
                setAuth(r.status === 401);
              }
            }}
          />
        </label>
        <p className="request-hint">
          JPEG, PNG, WebP or GIF, up to 8 MB each. PDFs and external
          verification providers are not enabled. Owner and authorized reviewers
          only; never publicly cached or included in public profiles. Submitted
          evidence is retained for the audit history.
        </p>
        {uploading && <p role="status">Uploading privately…</p>}
        {uploadError && <p role="alert">{uploadError}</p>}
        {evidence.map((e) => (
          <div className="request-actions" key={e.uploadId}>
            <span>{words(e.type)} · Private image ready</span>
            <button
              type="button"
              onClick={() =>
                setEvidence((x) => x.filter((i) => i.uploadId !== e.uploadId))
              }
            >
              Remove attachment
            </button>
          </div>
        ))}
        <TextField
          label="Private note to the reviewer"
          value={note}
          onChange={setNote}
          max={1500}
          area
        />
      </Editor>
      <h3>Your verification history</h3>
      {loading ? (
        <p role="status">Loading verification…</p>
      ) : !records.length && !error ? (
        <p>No evidence submitted. Your enterprise remains unverified.</p>
      ) : (
        records.map((r) => <RecordSummary key={r.id} record={r} />)
      )}
      <button onClick={onDone}>Back to enterprise</button>
    </section>
  );
}
function ReviewItem({
  record: r,
  onChanged,
}: {
  record: SupplyVerification;
  onChanged: () => void;
}) {
  const [reason, setReason] = useState(""),
    [checked, setChecked] = useState(false),
    [status, setStatus] = useState("verified");
  return (
    <section className="request-panel">
      <p>
        Participant {r.participantId} ·{" "}
        {r.capabilityId || "Enterprise-wide scope"}
      </p>
      <RecordSummary record={r} />
      <Editor
        save={() =>
          api.reviewSupplyVerification(r.id, {
            status: r.status === "submitted" ? "under_review" : status,
            revision: r.revision,
            reason,
          })
        }
        onSaved={onChanged}
        onCancel={onChanged}
        onReload={onChanged}
        label={
          r.status === "submitted" ? "Begin review" : "Record scoped decision"
        }
      >
        {r.status === "under_review" && (
          <>
            <label>
              Decision
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="verified">Approve this scope only</option>
                <option value="rejected">Reject — more evidence needed</option>
              </select>
            </label>
            <TextField
              label="Review reason"
              value={reason}
              onChange={setReason}
              required
              max={1500}
              area
            />
            <label className="supply-check">
              <input
                type="checkbox"
                required
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
              />
              I reviewed the private evidence for this scope. This is not
              blanket manufacturer, relationship or live-capacity verification.
            </label>
            <p>
              Approval expires after 90 days or when the subject changes. A
              reviewer cannot approve their own enterprise.
            </p>
          </>
        )}
      </Editor>
    </section>
  );
}
export function ReviewQueue() {
  const [rows, setRows] = useState<SupplyVerification[]>([]),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false),
    [loading, setLoading] = useState(true),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    api.supplyReviewQueue().then((r) => {
      if (!live) return;
      setLoading(false);
      if (r.ok) {
        setRows(r.data);
        setError("");
      } else {
        setError(r.error);
        setRows([]);
        setAuth(r.status === 401);
      }
    });
    return () => {
      live = false;
    };
  }, [reload]);
  return (
    <section>
      <h1>Supply evidence review</h1>
      <p>
        Restricted to existing Brief reviewers. Each decision is attributed,
        versioned and specific to the stated scope.
      </p>
      {auth && (
        <SessionSignIn
          title="Sign in to review supply evidence"
          onSignedIn={() => {
            setAuth(false);
            setReload((n) => n + 1);
          }}
        />
      )}
      {error && (
        <p role="alert">
          {error}{" "}
          <button onClick={() => setReload((n) => n + 1)}>
            Retry review queue
          </button>
        </p>
      )}
      {loading ? (
        <p role="status">Loading review queue…</p>
      ) : !rows.length && !error ? (
        <p>No submissions waiting for review.</p>
      ) : (
        rows.map((r) => (
          <ReviewItem
            key={`${r.id}-${r.revision}`}
            record={r}
            onChanged={() => setReload((n) => n + 1)}
          />
        ))
      )}
    </section>
  );
}
