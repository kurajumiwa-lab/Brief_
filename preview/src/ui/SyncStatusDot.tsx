// ---------------------------------------------------------------------------
// SYNC STATUS DOT — the honest, persistent indicator of the offline queue.
//
// The app already parks failed writes in an offline queue (offlineQueue.ts)
// and flushes them on reconnect. What was missing is a VISIBLE status: the
// person has no idea writes are parked, or that the device is offline. This
// dot reads the real queue depth + navigator.onLine and states, plainly:
//
//   offline          device has no signal — writes will queue
//   queued           N writes are parked, waiting to resend
//   unsent           N writes were refused by the server (dead letters)
//   synced           online, nothing parked
//
// It never fabricates "synced": if it cannot read the browser's state it says
// so. Colors are semantic tokens (bronze for the queue, danger for dead
// letters, success for synced). Re-checks on the online/offline/visibility
// events so it is truthful without polling.
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from "react";
import { queueDepth, deadLetters } from "../api/offlineQueue";

export interface SyncStatusDotProps {
  /** Render the label text alongside the dot (default: tooltip only). */
  label?: boolean;
  className?: string;
}

type SyncState =
  | { kind: "unknown" }
  | { kind: "offline" }
  | { kind: "queued"; count: number }
  | { kind: "unsent"; count: number }
  | { kind: "synced" };

function readState(): SyncState {
  if (typeof navigator === "undefined") return { kind: "unknown" };
  if (navigator.onLine === false) return { kind: "offline" };
  const dead = deadLetters().length;
  if (dead > 0) return { kind: "unsent", count: dead };
  const queued = queueDepth();
  if (queued > 0) return { kind: "queued", count: queued };
  return { kind: "synced" };
}

export function SyncStatusDot({ label = false, className = "" }: SyncStatusDotProps) {
  const [state, setState] = useState<SyncState>(() => readState());

  useEffect(() => {
    const refresh = () => setState(readState());
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const meta: Record<SyncState["kind"], { color: string; text: string }> = {
    unknown: { color: "var(--color-text-muted)", text: "Sync state unknown" },
    offline: { color: "var(--color-warning)", text: "Offline — changes will queue" },
    queued: { color: "var(--color-primary)", text: "Syncing — changes queued" },
    unsent: { color: "var(--color-danger)", text: "Some changes could not be sent" },
    synced: { color: "var(--color-success)", text: "Synced" }
  };
  const m = meta[state.kind];
  const count = state.kind === "queued" || state.kind === "unsent" ? state.count : 0;
  const text = label ? (count > 0 ? `${m.text} (${count})` : m.text) : m.text;
  const pulse = state.kind === "queued" || state.kind === "offline";

  return (
    <span
      role="status"
      aria-label={text}
      title={text}
      className={`inline-flex items-center gap-1.5 ${className}`}
    >
      <span
        className={`inline-block w-2 h-2 rounded-full ${pulse ? "brief-breathe" : ""}`}
        style={{ background: m.color }}
      />
      {label && (
        <span className="text-[10px] font-bold" style={{ color: "var(--color-text-muted)" }}>
          {count > 0 ? `${m.text} (${count})` : m.text}
        </span>
      )}
    </span>
  );
}
