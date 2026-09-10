import React, { useEffect, useState } from "react";
import * as api from "../../api/briefApi";
import type { BriefEntity } from "../../api/briefApi";
import { MotionStatus } from "../../ui/motion/MotionStatus";

// ---------------------------------------------------------------------------
// ENTITY DETAIL — the followable entity page (Phase 3).
//
// A lean, self-contained page for a venue/business/publisher/organizer/
// community: name, summary, and a FOLLOW/UNFOLLOW toggle backed by the real
// /api/entities/:id/follow rail. This is the "follow a creator" action the
// production shell was missing — the entity's own objects are listed so a
// follow has something to follow.
//
// Everything is read from real rows; an unknown entity is an honest error, and
// following is idempotent (the server reports `already`).
// ---------------------------------------------------------------------------

export function EntityDetail({
  entityId,
  authed,
  onClose,
  onRequireAuth
}: {
  entityId: string;
  authed: boolean;
  onClose: () => void;
  onRequireAuth: () => void;
}) {
  const [entity, setEntity] = useState<BriefEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await api.getEntity(entityId);
    setLoading(false);
    if (res.ok) {
      setEntity(res.data.entity);
      setError(null);
    } else {
      setError(res.error ?? "This entity is not available.");
    }
  };

  useEffect(() => {
    void load();
  }, [entityId]);

  const toggleFollow = async () => {
    if (!entity) return;
    if (!authed) {
      onRequireAuth();
      return;
    }
    setBusy(true);
    const wasFollowed = entity.isFollowed;
    const res = wasFollowed ? await api.unfollowEntity(entity.id) : await api.followEntity(entity.id);
    setBusy(false);
    if (res.ok) {
      setEntity((prev) =>
        prev ? { ...prev, isFollowed: !wasFollowed, followCount: res.data.followCount } : prev
      );
    }
  };

  return (
    <section className="max-w-3xl mx-auto" aria-label="Entity">
      <button
        type="button"
        onClick={onClose}
        className="text-xs font-bold"
        style={{ color: "var(--color-primary)" }}
      >
        ← Back
      </button>

      {loading ? (
        <p className="text-sm mt-4" style={{ color: "var(--color-text-muted)" }}>Reading entity…</p>
      ) : error ? (
        <p className="text-sm mt-4" style={{ color: "var(--color-danger)" }} role="alert">{error}</p>
      ) : entity ? (
        <div className="mt-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--color-primary)" }}>{entity.kind}</p>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1" style={{ color: "var(--color-text)" }}>{entity.name}</h1>
              {entity.locationName && (
                <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{entity.locationName}</p>
              )}
            </div>
            <button
              type="button"
              onClick={toggleFollow}
              disabled={busy}
              className="rounded-full px-4 py-2 text-xs font-black shrink-0"
              style={{
                background: entity.isFollowed ? "var(--color-surface-elevated)" : "var(--color-primary)",
                color: entity.isFollowed ? "var(--color-text)" : "var(--accent-ink)"
              }}
            >
              {busy ? "…" : entity.isFollowed ? `Following · ${entity.followCount}` : `Follow · ${entity.followCount}`}
            </button>
          </div>

          {entity.summary && <p className="text-sm mt-3" style={{ color: "var(--color-text)" }}>{entity.summary}</p>}

          <div className="mt-5">
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              Recent from this {entity.kind}
            </p>
            {entity.objects.length === 0 ? (
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Nothing published yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {entity.objects.map((o) => (
                  <li key={o.id} className="rounded-xl p-3" style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>{o.title}</p>
                      {o.temporal && <MotionStatus status={o.temporal.status} label={o.temporal.status} tier="micro" />}
                    </div>
                    {o.summary && <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{o.summary}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
