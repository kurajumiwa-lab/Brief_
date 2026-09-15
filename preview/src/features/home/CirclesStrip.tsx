// ---------------------------------------------------------------------------
// CIRCLES STRIP — one line of personal context under the gallery, so the
// screen never reads as a pure catalogue.
//
// Presentational by design: every number is passed in by the caller, and the
// caller derives them from real rows (listMySpaces + the attention queue in
// features/home/spaceSignals, and getCircles filtered on the viewer's own
// role). This component cannot invent a count, so it never does — and when the
// user is in nothing, it says so in one honest line instead of showing "0".
// ---------------------------------------------------------------------------

import React from 'react';
import { ArrowRight, Users } from 'lucide-react';

export function CirclesStrip({
  spaces,
  circles,
  needsYou,
  onView,
  className = ''
}: {
  spaces: number;
  circles: number;
  needsYou: number;
  onView: () => void;
  className?: string;
}) {
  const nothing = spaces === 0 && circles === 0;
  const parts = [
    spaces > 0 ? `${spaces} space${spaces === 1 ? '' : 's'}` : null,
    circles > 0 ? `${circles} circle${circles === 1 ? '' : 's'}` : null,
    needsYou > 0 ? `${needsYou} need${needsYou === 1 ? 's' : ''} you` : 'all caught up'
  ].filter(Boolean) as string[];

  return (
    <section
      className={`flex items-center gap-3 p-4 rounded-2xl border ${className}`}
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      aria-label="Your spaces and circles"
    >
      <Users className="w-4 h-4 shrink-0" style={{ color: 'var(--color-primary)' }} />
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
          Your spaces &amp; circles
        </p>
        <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text)' }}>
          {nothing ? 'You are not in anything yet.' : parts.join(' · ')}
        </p>
      </div>
      <button
        type="button"
        onClick={onView}
        className="shrink-0 inline-flex items-center gap-1 text-[11px] font-black cursor-pointer"
        style={{ color: 'var(--color-primary)' }}
      >
        {nothing ? 'Start' : 'View'}
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </section>
  );
}

export default CirclesStrip;
