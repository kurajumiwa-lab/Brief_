// ---------------------------------------------------------------------------
// DISCOVERY HEAD — a clean, premium light header for the Discover feed.
//
// No dark gradient card, no scoreboard, no pagination dots. Just a refined
// eyebrow + title + subtitle, and the section navigation as elegant light
// chips on the page background. Everything is supplied by the caller; nothing
// here invents a number or a status.
// ---------------------------------------------------------------------------

import React from 'react';

export interface DiscoveryHeadSegment {
  id: string;
  label: string;
}

export interface DiscoveryHeadProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  segments: DiscoveryHeadSegment[];
  activeSegmentId: string;
  /** Absent when there are no segments to change: no handler is invented for a list of zero. */
  onSegmentChange?: (id: string) => void;
  className?: string;
}

export function DiscoveryHead({
  eyebrow,
  title,
  subtitle,
  segments,
  activeSegmentId,
  onSegmentChange,
  className = ''
}: DiscoveryHeadProps) {
  return (
    <header className={className}>
      <div className="space-y-1">
        {eyebrow && (
          <p className="text-[12px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--color-primary)' }}>
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--color-text)' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>

      {segments.length === 0 ? null : (
      <nav
        className="mt-5 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar"
        aria-label="Discover sections"
      >
        {segments.map((s) => {
          const active = s.id === activeSegmentId;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSegmentChange?.(s.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer border ${
                active
                  ? 'border-transparent brief-lift-signal'
                  : 'border-[color:var(--brief-line)] hover:border-[color:var(--color-primary)]'
              }`}
              style={
                active
                  ? { background: 'var(--color-primary)', color: 'var(--accent-ink)' }
                  : { background: 'var(--color-paper)', color: 'var(--color-text-muted)' }
              }
            >
              {s.label}
            </button>
          );
        })}
      </nav>
      )}
    </header>
  );
}

export default DiscoveryHead;
