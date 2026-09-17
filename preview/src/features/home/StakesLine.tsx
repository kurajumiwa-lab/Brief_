// ---------------------------------------------------------------------------
// STAKES LINE — what the loss frame is allowed to say.
//
// The business case for Brief is loss-framed, and correctly so: an owner feels
// an order that went past them far more than a dashboard they might have liked.
// The temptation that comes with that framing is to WRITE THE LOSS DOWN —
// "you're losing KES 40,000 a month", "90% of buyers can't find you", "hours
// you can't verify". None of those have a row behind them, and on this product a
// number with no row is not marketing, it is a false statement about someone's
// business. So this component says the loss ONLY where a real row carries it:
//
//   • a quote of yours that was declined because the buyer chose someone else —
//     a `quote_declined` event Brief wrote, with YOUR OWN offer's derived total.
//     That is a lost order, and it can be counted, so it is said.
//   • open demand you cannot be found for, when you have no live offer — the
//     request count is the gap engine's, the zero-offers is your own space's.
//   • open demand in a category with precedent, when you do have offers: the
//     buyer is there, you are just not in front of them.
//
// What it will not say: staff hours, "hours you can't verify" (Brief verifies no
// attendance), a percentage of buyers who "can't find you" (there is no browse
// log of a stranger failing to find something — absence of a click is not a row),
// or any "could have earned" figure beyond the sum of your own declined offers.
//
// When nothing has been lost and nothing is open, it says so plainly. A zero that
// is a true zero is not a failure of the screen; inventing stakes against it is.
// ---------------------------------------------------------------------------

import React from 'react';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import type { MyPosition } from '../../api/briefApi';
import type { Space } from '../../api/types';

export interface StakesLineProps {
  position: MyPosition | null;
  spaces: Space[] | null;
  loading?: boolean;
  /** The read failed: say that, rather than reporting a calm "nothing at stake". */
  failed?: boolean;
  onOpenDiscover?: () => void;
  onPostOffer?: () => void;
}

interface Stance {
  text: React.ReactNode;
  action?: { label: string; run?: () => void };
  tone: 'loss' | 'opportunity' | 'quiet';
}

export function StakesLine({ position, spaces, loading = false, failed = false, onOpenDiscover, onPostOffer }: StakesLineProps) {
  const build = (): Stance => {
    if (failed) {
      return { tone: 'quiet', text: 'Your position could not be read, so nothing here is claimed.' };
    }
    if (loading || !position || !spaces) {
      return { tone: 'quiet', text: 'Reading what is at stake…' };
    }

    const missed = position.missedCapture ?? null;
    const openLive = spaces.reduce((n, s) => n + ((s.offers ?? []).filter((o) => o.status === 'active').length), 0);
    const open = position.open?.total ?? 0;

    // 1. A loss that actually happened, with a row behind it.
    if (missed && missed.count > 0) {
      const v = missed.value ?? null;
      return {
        tone: 'loss',
        text: (
          <>
            {missed.count} quote{missed.count === 1 ? '' : 's'} of yours ended with the buyer choosing
            someone else
            {v?.amount != null
              ? <> — your own offers on those totalled <b className="font-mono">{v.currency} {Number(v.amount).toLocaleString('en-KE')}</b> over the {v.over}</>
              : ' — those offers carried no completed price, so no money figure is attached'}
            {v?.sampleCount != null && v.sampleCount < missed.count
              ? ` (the total covers ${v.sampleCount} of the ${missed.count}, the ones with a price on the row)`
              : ''}
            .
          </>
        ),
        action: onOpenDiscover ? { label: 'See what is open now →', run: onOpenDiscover } : undefined
      };
    }

    // 2. Invisible by choice: demand exists, you have published nothing.
    if (open > 0 && openLive === 0) {
      return {
        tone: 'loss',
        text: (
          <>
            <b className="font-mono">{open}</b> request{open === 1 ? '' : 's'} are open on the board and you have no live offer,
            so none of them can reach you. That is the one gap a post closes.
          </>
        ),
        action: onPostOffer ? { label: 'Open your spaces to post one →', run: onPostOffer } : undefined
      };
    }

    // 3. Published, but unanswered demand is still out there.
    if (open > 0) {
      const top = position.open?.top?.[0];
      return {
        tone: 'opportunity',
        text: (
          <>
            {openLive} live offer{openLive === 1 ? '' : 's'} published, and <b className="font-mono">{open}</b> request
            {open === 1 ? '' : 's'} still without an accepted quote
            {top?.title ? <> — the nearest is “{top.title}”</> : null}.
          </>
        ),
        action: onOpenDiscover ? { label: 'Answer it →', run: onOpenDiscover } : undefined
      };
    }

    // 4. Nothing at stake, said without dressing it up.
    return {
      tone: 'quiet',
      text: openLive > 0
        ? `${openLive} live offer${openLive === 1 ? '' : 's'} published, and nothing on the board is asking for them right now. That is a quiet week, not a warning.`
        : 'Nothing is at stake in Brief yet — no live offer, no open demand in your categories. The first offer is what gives this screen something true to tell you.',
      action: openLive === 0 && onPostOffer ? { label: 'Open your spaces to post one →', run: onPostOffer } : undefined
    };
  };

  const stance = build();
  const color = stance.tone === 'loss' ? 'var(--color-danger)' : stance.tone === 'opportunity' ? 'var(--color-primary)' : 'var(--color-text-muted)';

  return (
    <p
      className="text-[13px] leading-snug font-semibold flex flex-wrap items-center gap-x-2 gap-y-1"
      style={{ color: 'var(--color-text)' }}
      data-tone={stance.tone}
    >
      <span
        className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-full shrink-0"
        style={{ background: 'var(--color-well)', color }}
      >
        <ShieldAlert className="w-3 h-3" />
        {stance.tone === 'loss' ? 'at stake' : stance.tone === 'opportunity' ? 'open' : 'quiet'}
      </span>
      <span className="min-w-0 flex-1">{stance.text}</span>
      {stance.action?.run && (
        <button
          type="button"
          onClick={stance.action.run}
          className="shrink-0 inline-flex items-center gap-0.5 text-[11px] font-black cursor-pointer"
          style={{ color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0, font: 'inherit' }}
        >
          {stance.action.label}
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </p>
  );
}

export default StakesLine;
