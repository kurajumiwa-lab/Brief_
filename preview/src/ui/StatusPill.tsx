import React from 'react';
import type { Space } from '../api/types';

// ---------------------------------------------------------------------------
// STATUS PILL — the one small state marker the reorg approved from the vendor
// portals: a 9px uppercase word with a dot on the left. Four states, four
// fixed colours, defined ONCE so a green "active" is green everywhere.
//
// The honesty rule of the house applies to pills: a pill only ever says what
// a real row says, and it is never decoration that restates its own shelf.
//   EXPIRED  the space is archived — its rows are closed
//   FLAGGED  the editorial queue holds an overdue row — work is owed
//   QUIET    maintenance is stale or dormant — nobody has touched it lately
//   ACTIVE   everything else
// A shelf already titled "Open now" does not stamp "Active" on every row; the
// title is the state. The pill earns its place where a row's state can differ
// from the shelf's (a shop that is open but overdue, a space that is quiet).
// ---------------------------------------------------------------------------

export type PillState = 'active' | 'quiet' | 'expired' | 'flagged';

export const PILL_META: Record<PillState, { label: string; color: string }> = {
  active: { label: 'Active', color: '#15803D' },
  quiet: { label: 'Quiet', color: '#B45309' },
  expired: { label: 'Expired', color: '#6B7280' },
  flagged: { label: 'Flagged', color: '#B91C1C' },
};

/** The state a real Space row says. Every input is a counted, derived row —
 *  nothing here is guessed from a name or a number. */
export function spacePillState(
  space: Pick<Space, 'status' | 'maintenance' | 'editorialBreakdown'>
): PillState {
  if (space.status === 'archived') return 'expired';
  if ((space.editorialBreakdown?.overdue ?? 0) > 0) return 'flagged';
  const m = space.maintenance?.state;
  if (m === 'stale' || m === 'dormant') return 'quiet';
  return 'active';
}

/**
 * `onTint` is for pills sitting on a coloured tile: white word, white dot,
 * dark chip. Without it the pill uses its own colour on a light surface.
 */
export const StatusPill: React.FC<{
  state: PillState;
  onTint?: boolean;
  className?: string;
}> = ({ state, onTint = false, className = '' }) => {
  const meta = PILL_META[state];
  const ink = onTint ? '#FFFFFF' : meta.color;
  return (
    <span
      data-testid={`status-pill-${state}`}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.08em] leading-none whitespace-nowrap ${className}`}
      style={{ color: ink, background: onTint ? 'rgba(15,23,42,0.30)' : `${meta.color}1A` }}
    >
      <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: ink }} />
      {meta.label}
    </span>
  );
};

export default StatusPill;
