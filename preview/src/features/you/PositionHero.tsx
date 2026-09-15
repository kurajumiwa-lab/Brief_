import React from 'react';
import { AlertTriangle, ArrowRight, Clock, ShieldCheck, TrendingUp } from 'lucide-react';
import type { MyCommitments, MyPosition, MyReciprocity, Precedent } from '../../api/briefApi';
import type { Space } from '../../api/types';
import { CopyId } from '../../ui/CopyId';

// ---------------------------------------------------------------------------
// POSITION HERO — the Chess.com "rating as the first thing you see" shape, with
// the rating taken out.
//
// What Chess.com puts at the top of a profile is a number the site invented to
// rank people against each other. Brief has no such number, and inventing one
// would be the exact failure this platform exists to avoid. So the hero shows
// the closest honest equivalent: WHERE YOU STAND, in rows.
//
//   · the headline is the fact that currently has the most weight on you —
//     something expiring, something owed to you, something you owe — not a score;
//   · the pills are the derived maintenance state of your own spaces
//     (FRESH / ACTIVE / STALE / DORMANT), which decay because they are
//     timestamps, unlike Linear's statuses;
//   · the "defended" line is the fraction of your CLOSED commitments that
//     actually got fulfilled. That is the platform-scale version of a defense
//     rate, and the sample size travels with it. The stricter version — "of
//     members whose position decayed in the last 7 days, how many defended
//     within 72 hours" — is not shown, because Brief has no cohort table and no
//     decay event log to divide by. When it does, the number goes here.
//   · every figure is copy-on-tap traceable: the row reference goes on the
//     clipboard, so a number can be taken to the person you are arguing with.
//
// Deliberately absent: a rating, a tier, a badge, a streak, a rank, a follower
// count, a profile-views count, a leaderboard, and any percentile.
// ---------------------------------------------------------------------------

const STATE_TONE: Record<string, { fg: string; rail: string }> = {
  fresh: { fg: 'var(--color-success)', rail: 'var(--color-success)' },
  active: { fg: 'var(--color-primary)', rail: 'var(--color-primary)' },
  stale: { fg: 'var(--color-warning)', rail: 'var(--color-warning)' },
  dormant: { fg: 'var(--color-danger)', rail: 'var(--color-danger)' },
  unstarted: { fg: 'var(--color-text-muted)', rail: 'var(--color-border)' }
};

const kes = (n: number) => `KES ${Number(n).toLocaleString('en-KE')}`;

export interface PositionHeroProps {
  position: MyPosition | null;
  commitments: MyCommitments | null;
  reciprocity: MyReciprocity | null;
  spaces?: Space[];
  precedent?: Precedent | null;
  /** True when the reads were refused for want of a session (401). */
  denied?: boolean;
  onRetry?: () => void;
  className?: string;
}

function Tile({ label, value, sub, evidence }: { label: string; value: string; sub?: string | null; evidence?: { table: string; id: string } | null }) {
  return (
    <div className="p-3 rounded-xl" style={{ background: 'var(--color-surface)' }}>
      <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      <p className="text-lg font-mono font-extrabold brief-countdown truncate" style={{ color: 'var(--color-text)' }}>
        {value}
      </p>
      {sub && (
        <p className="text-[10px] leading-snug truncate" style={{ color: 'var(--color-text-muted)' }}>
          {sub}
        </p>
      )}
      {evidence && evidence.id ? (
        <div className="mt-1">
          <CopyId value={evidence.id} label={evidence.table} />
        </div>
      ) : null}
    </div>
  );
}

export function PositionHero({
  position,
  commitments,
  reciprocity,
  spaces = [],
  precedent = null,
  denied = false,
  onRetry,
  className = ''
}: PositionHeroProps) {
  if (!position && !commitments && !reciprocity) {
    return (
      <section
        className={`p-4 rounded-2xl border ${className}`}
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        aria-label="Position unavailable"
      >
        <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
          {denied ? 'No session, so there is no position to read.' : 'Your position could not be read.'}
        </p>
        <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {denied
            ? 'Sign in and this becomes your own ledger: what is owed to you, what is expiring, what you defended.'
            : 'Nothing is shown in its place — no reassuring zero, no invented standing.'}
        </p>
        {!denied && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 px-3.5 py-2 rounded-full text-xs font-black cursor-pointer"
            style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
          >
            Try again
          </button>
        )}
      </section>
    );
  }

  const expiring = position?.decay.expiringQuotes ?? [];
  const owedToMe = commitments?.owedToMe ?? [];
  const owedByMe = commitments?.owedByMe ?? [];
  const fulfilled = commitments?.fulfilled ?? [];
  const lapsed = commitments?.lapsed ?? [];
  const closed = fulfilled.length + lapsed.length;
  const defended = closed > 0 ? Math.round((fulfilled.length / closed) * 100) : null;
  const overdue = position?.decay.overdueInstallments ?? 0;
  const missed = position?.missedCapture.count ?? 0;
  const favors = (reciprocity?.owedByMe.length ?? 0) + (reciprocity?.owedToMe.length ?? 0);
  const aging = reciprocity?.aging.length ?? 0;

  // The headline carries whatever actually has weight right now.
  const headline =
    expiring.length > 0
      ? {
          icon: <Clock className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />,
          text: `${expiring.length} proposal${expiring.length === 1 ? '' : 's'} of yours ${expiring.length === 1 ? 'is' : 'are'} losing validity`,
          sub: expiring[0] ? `“${expiring[0].title}” — valid until ${expiring[0].validUntil ?? 'soon'}` : null,
          tone: 'primary' as const
        }
      : owedByMe.length > 0
        ? {
            icon: <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />,
            text: `${owedByMe.length} commitment${owedByMe.length === 1 ? '' : 's'} of yours is${owedByMe.length === 1 ? '' : ' are'} still open`,
            sub: commitments && commitments.owedByMeKes > 0 ? `${kes(commitments.owedByMeKes)} you owe` : 'no money figure on them',
            tone: 'warning' as const
          }
        : owedToMe.length > 0
          ? {
              icon: <TrendingUp className="w-4 h-4" style={{ color: 'var(--color-success)' }} />,
              text: `${owedToMe.length} commitment${owedToMe.length === 1 ? '' : 's'} owed to you`,
              sub: commitments && commitments.owedToMeKes > 0 ? `${kes(commitments.owedToMeKes)} on real orders and loans` : null,
              tone: 'success' as const
            }
          : {
              icon: <ShieldCheck className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />,
              text: 'Nothing pending on your ledger.',
              sub: 'No open commitment, no expiring proposal, no overdue instalment.',
              tone: 'muted' as const
            };

  const spacePills = spaces
    .filter((s) => s.status !== 'archived')
    .map((s) => ({ id: s.id, name: s.name, state: s.maintenance?.state ?? 'unstarted', ageHours: s.maintenance?.ageHours ?? null, open: s.editorialOpen ?? 0 }));

  return (
    <section
      className={`rounded-2xl border overflow-hidden ${className}`}
      style={{ borderColor: 'var(--color-border)', background: '#fff' }}
      aria-label="Your position"
    >
      {/* Hero band */}
      <div className="p-4 space-y-1.5" style={{ borderLeft: `3px solid var(--color-primary)` }}>
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--color-primary)' }}>
            Your position
          </p>
          <span className="text-[9px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
            derived from your rows
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0">{headline.icon}</span>
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold leading-snug" style={{ color: 'var(--color-text)' }}>
              {headline.text}
            </p>
            {headline.sub && (
              <p className="text-[11px] leading-snug truncate" style={{ color: 'var(--color-text-muted)' }}>
                {headline.sub}
              </p>
            )}
          </div>
        </div>
        {expiring[0] && (
          <button
            type="button"
            onClick={() => { window.location.hash = `requests/${encodeURIComponent(expiring[0].requestId)}`; }}
            className="inline-flex items-center gap-1 text-[11px] font-black cursor-pointer"
            style={{ color: 'var(--color-primary)' }}
          >
            Defend it now
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Space state — the derived pills, with a rail that carries the colour so
          the state is legible without relying on hue alone. */}
      {spacePills.length > 0 && (
        <div className="px-4 py-3 space-y-1.5 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Your spaces
          </p>
          <div className="flex flex-wrap gap-1.5">
            {spacePills.map((p) => {
              const tone = STATE_TONE[p.state] ?? STATE_TONE.unstarted;
              return (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1.5 max-w-full px-2 py-1 rounded-full text-[10px] font-bold"
                  style={{ border: `1px solid ${tone.rail}`, color: tone.fg, background: 'var(--color-surface)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tone.rail }} aria-hidden="true" />
                  <span className="truncate">{p.name}</span>
                  <span className="font-black uppercase tracking-wider">{p.state}</span>
                  {p.ageHours != null && (
                    <span className="font-mono font-normal" style={{ color: 'var(--color-text-muted)' }}>
                      {p.ageHours < 24 ? `${p.ageHours}h` : `${Math.round(p.ageHours / 24)}d`}
                    </span>
                  )}
                  {p.open > 0 && <span className="font-mono">{p.open} open</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* The tiles — numbers, not narrative. Each is a count over rows. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-4 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
        {/* Each tile carries the row it was counted from, copy-on-tap, so the
            figure can be checked rather than believed. */}
        <Tile
          label="owed to you"
          value={String(owedToMe.length)}
          sub={commitments && commitments.owedToMeKes > 0 ? kes(commitments.owedToMeKes) : 'no money on them'}
          evidence={owedToMe[0]?.evidence ?? null}
        />
        <Tile
          label="you owe"
          value={String(owedByMe.length)}
          sub={commitments && commitments.owedByMeKes > 0 ? kes(commitments.owedByMeKes) : 'nothing priced'}
          evidence={owedByMe[0]?.evidence ?? null}
        />
        <Tile
          label="expiring"
          value={String(expiring.length)}
          sub={expiring[0] ? `${expiring[0].hoursLeft}h left on one` : 'nothing losing validity'}
          evidence={expiring[0] ? { table: 'requestQuotes', id: expiring[0].quoteId } : null}
        />
        <Tile
          label="went to someone else"
          value={String(missed)}
          sub={position?.missedCapture.value ? `${kes(position.missedCapture.value.amount)} of your own priced offers` : 'no priced loss on record'}
          evidence={position?.missedCapture.recent[0]?.evidence ?? null}
        />
        <Tile
          label="favors open"
          value={String(favors)}
          sub={aging > 0 ? `${aging} older than ${reciprocity?.windowDays ?? 14} days` : 'none aging'}
          evidence={reciprocity?.owedToMe[0]?.evidence ?? reciprocity?.owedByMe[0]?.evidence ?? null}
        />
        <Tile
          label="instalments overdue"
          value={String(overdue)}
          sub={overdue === 0 ? 'current on Lipa Mdogo' : 'go before they compound'}
        />
        <Tile
          label="demand you could answer"
          value={String(position?.open.total ?? 0)}
          sub={position && position.open.top[0] ? `top: ${position.open.top[0].title}` : 'nothing unmet right now'}
          evidence={position?.open.top[0] ? { table: 'requests', id: position.open.top[0].requestId } : null}
        />
      </div>

      {/* Defended, from closed rows — with its sample size, and the caveat that
          the stricter cohort version is not measurable yet. */}
      <div className="px-4 py-3 border-t space-y-1" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          Defended
        </p>
        {closed === 0 ? (
          <p className="text-[11px] leading-snug" style={{ color: 'var(--color-text)' }}>
            No commitment of yours has closed yet, so there is nothing to rate. The number appears with the first row that closes.
          </p>
        ) : (
          <p className="text-[11px] leading-snug font-mono brief-countdown" style={{ color: 'var(--color-text)' }}>
            {fulfilled.length} fulfilled · {lapsed.length} lapsed · {defended}% defended across {closed} closed commitment{closed === 1 ? '' : 's'}
          </p>
        )}
        <p className="text-[10px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
          The 7-day version — of members whose position decayed last week, how many defended within 72 hours — is not shown: Brief keeps
          no decay-event log or cohort table to divide by. It will be computed the day one exists, not before.
        </p>
      </div>

      {/* What the platform has actually closed, so "does this work" is a count
          and not a testimonial. */}
      {precedent && (precedent.fill.closed > 0 || precedent.movement.settledOrders > 0) && (
        <div className="px-4 py-3 border-t space-y-1" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Precedent on Brief · {precedent.fill.windowDays} days
          </p>
          <p className="text-[11px] font-mono brief-countdown leading-snug" style={{ color: 'var(--color-text)' }}>
            {precedent.fill.closed} request{precedent.fill.closed === 1 ? '' : 's'} reached an accepted quote ·{' '}
            {precedent.movement.settledOrders} order{precedent.movement.settledOrders === 1 ? '' : 's'} settled
            {precedent.movement.settledCurrency ? ` for ${kes(precedent.movement.settledOrdersKes)}` : ''} ·{' '}
            {precedent.movement.completedWorkOrders} work order{precedent.movement.completedWorkOrders === 1 ? '' : 's'} completed
          </p>
          {typeof precedent.fill.avgHoursToFill === 'number' && (
            <p className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
              took {precedent.fill.avgHoursToFill}h on average across {precedent.fill.hoursSampleCount} row
              {precedent.fill.hoursSampleCount === 1 ? '' : 's'}
            </p>
          )}
          <p className="text-[10px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>{precedent.note}</p>
        </div>
      )}
    </section>
  );
}

export default PositionHero;
