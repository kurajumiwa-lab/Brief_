// ---------------------------------------------------------------------------
// SKELETON — a quiet placeholder while a surface is loading.
//
// The critique's "kill the black-screen flash": a loading surface should show
// the SHAPE of the content about to arrive, not a blank void or a bare
// "Loading…" string. It uses the canonical surface token and the `.brief-
// skeleton` pulse from the stylesheet (killed by prefers-reduced-motion).
// ---------------------------------------------------------------------------

import React from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`brief-skeleton rounded-lg bg-[var(--color-surface-elevated)] ${className}`}
    />
  );
}

/** A card-shaped placeholder — title line, sub-line, and a body block. */
export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl p-4 space-y-3 border border-[var(--color-border)] bg-[var(--color-surface)] ${className}`}>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
