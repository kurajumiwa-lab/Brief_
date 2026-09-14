// ---------------------------------------------------------------------------
// DISCOVERY HEAD — a generic, domain-free "featured card" shell for the top of
// the Discover feed. It clones a specific visual blueprint as four primitives:
//
//   1. Floating segmented control  — a full-width pill; active = solid white
//      with dark bold text, inactive = muted with light text; smooth fade.
//   2. Card base + gradient        — full-width rounded card, vertical gradient
//      #132328 (top) -> #091C16 (bottom), uniform 16px padding.
//   3. Three-column scoreboard     — left badge (right-aligned), large bold
//      hero "L : R", right badge (left-aligned); beneath it a centred
//      sub-metadata stack (status label + rounded dark mono chips).
//   4. Pagination dots             — centred capsule dashes, one bright active.
//
// Every slot is a PROP. This component knows nothing about sports, markets or
// events — it renders whatever honest content the caller supplies, so nothing
// here can invent a number. The caller (CityFeedView) feeds it derived counts.
// ---------------------------------------------------------------------------

import React from 'react';

export interface DiscoveryHeadSegment {
  id: string;
  label: string;
}

export interface DiscoveryHeadBadge {
  label: string;
  icon?: React.ReactNode;
}

export interface DiscoveryHeadProps {
  segments: DiscoveryHeadSegment[];
  activeSegmentId: string;
  onSegmentChange: (id: string) => void;

  /** Three-column scoreboard: left / hero / right. */
  left: DiscoveryHeadBadge;
  right: DiscoveryHeadBadge;
  heroLeft: string;
  heroRight: string;

  /** Sub-metadata: a small label + optional mono counter chips "L : R". */
  statusLabel: string;
  chips?: { left: string; right: string } | null;

  /** Pagination: total dashes + which one is lit. */
  dotCount: number;
  activeDot: number;

  className?: string;
}

export function DiscoveryHead({
  segments,
  activeSegmentId,
  onSegmentChange,
  left,
  right,
  heroLeft,
  heroRight,
  statusLabel,
  chips = null,
  dotCount,
  activeDot,
  className = ''
}: DiscoveryHeadProps) {
  return (
    <div className={`w-full rounded-3xl bg-gradient-to-b from-[#132328] to-[#091C16] p-4 text-white shadow-xl ${className}`}>
      {/* ── 1. Floating segmented control ── */}
      <div className="flex rounded-full bg-black/40 p-1" role="tablist" aria-label="Discover sections">
        {segments.map((s) => {
          const active = s.id === activeSegmentId;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSegmentChange(s.id)}
              className={`flex-1 rounded-full py-1.5 px-1 text-xs transition-colors duration-200 cursor-pointer ${
                active
                  ? 'bg-white font-semibold text-black'
                  : 'font-medium text-white/70 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ── 3. Three-column scoreboard (primary row) ── */}
      <div className="mt-6 flex items-center justify-between px-2">
        <div className="flex flex-1 items-center justify-end gap-2 text-right font-semibold">
          <span className="text-sm leading-tight">{left.label}</span>
          <div className="h-8 w-8 shrink-0 rounded-full bg-white/20 flex items-center justify-center">
            {left.icon ?? null}
          </div>
        </div>

        <div className="px-4 text-3xl font-extrabold tracking-tight tabular-nums">
          {heroLeft}
          <span className="mx-1 opacity-60">:</span>
          {heroRight}
        </div>

        <div className="flex flex-1 items-center justify-start gap-2 text-left font-semibold">
          <div className="h-8 w-8 shrink-0 rounded-full bg-white/20 flex items-center justify-center">
            {right.icon ?? null}
          </div>
          <span className="text-sm leading-tight">{right.label}</span>
        </div>
      </div>

      {/* ── 3b. Sub-metadata stack ── */}
      <div className="mt-3 flex flex-col items-center gap-1.5">
        <span className="text-xs text-white/60">{statusLabel}</span>
        {chips && (
          <div className="flex items-center gap-1 font-mono text-xs tabular-nums">
            <span className="rounded bg-black/40 px-2 py-0.5">{chips.left}</span>
            <span className="text-white/70">:</span>
            <span className="rounded bg-black/40 px-2 py-0.5">{chips.right}</span>
          </div>
        )}
      </div>

      {/* ── 4. Pagination / carousel dots ── */}
      <div className="mt-6 flex justify-center gap-1.5" aria-hidden="true">
        {Array.from({ length: dotCount }).map((_, i) => (
          <div
            key={i}
            className={`h-1 w-5 rounded-full transition-colors duration-200 ${
              i === activeDot ? 'bg-white' : 'bg-white/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default DiscoveryHead;
