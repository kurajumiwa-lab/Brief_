// ---------------------------------------------------------------------------
// STATE DOT — the sentence, replaced by a colour.
//
// The readability rule this exists to serve: state is a dot, not a paragraph.
// "18 offers live, and nothing on the board is asking for them right now, which
// is a quiet week rather than a warning" is sixteen words to say what one amber
// dot says in none. So every surface that used to explain a state now marks it,
// and the word next to the dot is optional, single, and lowercase.
//
// What the dots mean — and the discipline behind each:
//   live    money in, or work that actually happened (a settled or completed row)
//   quiet   a TRUE zero. Nothing pending, nothing open. Not "we don't know".
//   moving  in transit right now: a dispatch, a pickup, an open quote countdown
//   stale   past the window its own cadence sets (derived from a timestamp)
//   unknown the read failed or the field is unmeasurable. Grey, never green, and
//           never shown as a zero: a 0 answers "how many?", and a failed read
//           answers nothing.
//
// It never invents a state. `state="unknown"` is the default, precisely so a
// component that has no data cannot render confidence.
// ---------------------------------------------------------------------------

import React from 'react';

export type DotState = 'live' | 'quiet' | 'moving' | 'stale' | 'unknown';

export const DOT_TOKEN: Record<DotState, string> = {
  live: 'var(--state-live)',
  quiet: 'var(--state-quiet)',
  moving: 'var(--state-moving)',
  stale: 'var(--state-stale)',
  unknown: 'var(--state-empty)'
};

export interface StateDotProps {
  state: DotState;
  /** One word. Kept because a colour alone fails a colour-blind reader. */
  label?: string;
  size?: 'sm' | 'lg';
  /** Put the dot and the word on their own line (list rows). */
  inline?: boolean;
  className?: string;
  title?: string;
}

export function StateDot({ state, label, size = 'sm', inline = false, className = '', title }: StateDotProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${inline ? '' : ''} ${className}`}
      data-state={state}
      title={title}
    >
      <span
        className={`brief-dot${size === 'lg' ? ' brief-dot--lg' : ''}`}
        style={{ background: DOT_TOKEN[state] ?? DOT_TOKEN.unknown }}
        aria-hidden="true"
      />
      {label ? (
        <span className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </span>
      ) : null}
    </span>
  );
}

/** Map a derived maintenance state onto a dot, in one place, so five surfaces
 *  cannot disagree about what STALE looks like. */
export function dotForMaintenance(state?: string | null): DotState {
  if (state === 'fresh') return 'live';
  if (state === 'active') return 'quiet';
  if (state === 'stale' || state === 'dormant') return 'stale';
  return 'unknown';
}

export default StateDot;
