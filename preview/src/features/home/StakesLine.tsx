// ---------------------------------------------------------------------------
// STAKES LINE — the hook on Home, in numbers and one dot.
//
// Before: "18 live offers published, and nothing on the board is asking for them
// right now. That is a quiet week, not a warning." Twenty words, of which the
// useful content is three numbers and a state. The state is now a dot.
//
// The loss frame the product needs is kept — an owner acts to stop losing, not to
// gain a dashboard — but it is only ever stated at the size of the row behind it:
//
//   lost      a quote of yours was declined because the buyer chose someone else.
//             A real `quote_declined` event, valued at YOUR OWN offer's total.
//   gap       open demand exists and you have nothing live. Counted, not implied.
//   ready     you have offers and nothing is asking. That is the state, so the dot
//             says it. No invented cost attached to a quiet week.
//   no read   the read failed. Nothing is claimed. A calm line here would be a
//             lie by omission, so the dot goes grey, not green.
//
// What never appears, in this component or anywhere: "90% of buyers can't find
// you" (there is no log of a stranger failing to find a listing), "hours you
// can't verify" (Brief verifies no attendance), "every day costs you KES X"
// (no attribution model), or a "could have earned" total. Those are not tone
// problems; they are numbers with no row under them.
// ---------------------------------------------------------------------------

import React from 'react';
import { ArrowRight, Info } from 'lucide-react';
import type { MyPosition } from '../../api/briefApi';
import type { Space } from '../../api/types';
import { StateDot, type DotState } from '../../ui/StateDot';

export interface StakesLineProps {
  position: MyPosition | null;
  spaces: Space[] | null;
  loading?: boolean;
  failed?: boolean;
  onOpenDiscover?: () => void;
  onPostOffer?: () => void;
  onOpenHow?: () => void;
}

interface Read {
  offers: number;
  waiting: number;
  lost: number;
  lostKes: number | null;
  currency: string;
  state: DotState;
  word: string;
}

function read(position: MyPosition | null, spaces: Space[] | null): Read {
  const offers = (spaces ?? []).reduce((n, s) => n + ((s.offers ?? []).filter((o) => o.status === 'active').length), 0);
  const open = position?.open?.total ?? 0;
  const waiting = (position?.decay?.expiringQuotes?.length ?? 0) + (position?.missedCapture?.count ?? 0) > 0
    ? (position?.decay?.expiringQuotes?.length ?? 0)
    : 0;
  const missed = position?.missedCapture ?? null;
  const lost = missed?.count ?? 0;
  const v = missed?.value ?? null;
  const state: DotState = lost > 0 ? 'stale' : open > 0 && offers === 0 ? 'stale' : offers > 0 ? 'quiet' : 'unknown';
  const word = lost > 0 ? 'lost' : open > 0 && offers === 0 ? 'gap' : offers > 0 ? 'quiet' : 'no read';
  return {
    offers,
    waiting,
    lost,
    lostKes: v?.amount != null ? Number(v.amount) : null,
    currency: v?.currency ?? 'KES',
    state,
    word
  };
}

const num = (n: number) => n.toLocaleString('en-KE');

export function StakesLine({ position, spaces, loading = false, failed = false, onOpenDiscover, onPostOffer, onOpenHow }: StakesLineProps) {
  if (loading) {
    return <div className="brief-skeleton h-6 rounded-lg max-w-sm" style={{ background: 'var(--color-well)' }} aria-busy="true" />;
  }
  if (failed || !position) {
    return (
      <p className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
        <StateDot state="unknown" /> No read — nothing claimed.
      </p>
    );
  }

  const r = read(position, spaces);
  const action = r.lost > 0 || (r.offers === 0 && (position.open?.total ?? 0) > 0)
    ? (r.offers === 0 ? onPostOffer : onOpenDiscover)
    : onOpenDiscover;
  const actionLabel = r.offers === 0 ? 'Post an offer' : 'See what is open';

  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] font-bold" style={{ color: 'var(--color-text)' }}>
      <span className="font-mono">
        {num(r.offers)} <span className="font-sans font-semibold" style={{ color: 'var(--color-text-muted)' }}>offers live</span>
      </span>
      <span aria-hidden="true" style={{ color: 'var(--brief-line)' }}>·</span>
      <span className="font-mono">
        {num(r.waiting)} <span className="font-sans font-semibold" style={{ color: 'var(--color-text-muted)' }}>waiting on you</span>
      </span>
      {r.lost > 0 && (
        <>
          <span aria-hidden="true" style={{ color: 'var(--brief-line)' }}>·</span>
          {/* A lost order, at the exact size of the row that records it: the count
              of declined quotes, and the sum of your own offers on those. */}
          <span className="font-mono" style={{ color: 'var(--color-danger)' }}>
            {num(r.lost)} lost
            {r.lostKes != null ? ` · ${r.currency} ${num(Math.round(r.lostKes))}` : ''}
          </span>
        </>
      )}
      <StateDot state={r.state} label={r.word} className="ml-0.5" />
      {action && (
        <button
          type="button"
          onClick={action}
          className="inline-flex items-center gap-0.5 text-[11px] font-black cursor-pointer"
          style={{ color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0, font: 'inherit' }}
        >
          {actionLabel} <ArrowRight className="w-3 h-3" />
        </button>
      )}
      {onOpenHow && (
        <button
          type="button"
          onClick={onOpenHow}
          aria-label="How Brief works"
          className="ml-auto inline-flex items-center justify-center w-6 h-6 rounded-full cursor-pointer"
          style={{ color: 'var(--color-text-muted)', background: 'var(--color-well)', border: 'none' }}
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      )}
    </p>
  );
}

export default StakesLine;
