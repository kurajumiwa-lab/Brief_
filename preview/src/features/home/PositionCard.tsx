// ---------------------------------------------------------------------------
// POSITION CARD — the user's derived position in time, shown on Home.
//
// The honest "registers that breathe" layer: what is expiring, what you were
// in the running for and lost, and what is still open. Every number comes from
// /api/me/position, which derives it by scanning real rows. Nothing here is
// stored, estimated or rounded up — and nothing renders when the read fails,
// so a dead network never masquerades as an empty "all clear".
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import type { MyPosition } from '../../api/briefApi';
import * as briefApi from '../../api/briefApi';
import { Clock, AlertTriangle, ChevronRight, Ticket } from 'lucide-react';

export function PositionCard({
  className = '',
  position
}: {
  className?: string;
  /** The parent's already-derived read — passed in so a screen reads once. */
  position?: MyPosition | null;
}) {
  const [own, setOwn] = useState<MyPosition | null>(null);
  const [loaded, setLoaded] = useState(position !== undefined);

  useEffect(() => {
    if (position !== undefined) return;
    let live = true;
    briefApi.getMyPosition().then((res) => {
      if (!live) return;
      setOwn(res.ok ? res.data : null);
      setLoaded(true);
    });
    return () => { live = false; };
  }, [position]);

  const pos = position ?? own;

  // Nothing derived and nothing to say -> render nothing (never a fake empty).
  if (!loaded || !pos) return null;

  const missed = pos.missedCapture.count;
  const expiring = pos.decay.expiringQuotes;
  const waitlist = pos.decay.waitlist;
  const override = pos.decay.override;
  const overdue = pos.decay.overdueInstallments;
  const openTotal = pos.open.total;

  const hasAnything =
    missed > 0 || expiring.length > 0 || waitlist.length > 0 ||
    overdue > 0 || openTotal > 0 || (override && override.monthsLeft < 3);

  if (!hasAnything) return null;

  const firstMissed = pos.missedCapture.recent[0];
  const firstExpiring = expiring[0];
  const firstWait = waitlist[0];
  const firstOpen = pos.open.top[0];

  return (
    <section className={`rounded-2xl border p-4 space-y-3 ${className}`} style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} aria-label="Your position">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--color-text)' }}>
          Your position
        </h3>
        <span className="text-[10px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
          derived from real activity
        </span>
      </div>

      {/* MISSED — real "selected another option" events */}
      {missed > 0 && (
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-warning)' }} />
          <div className="min-w-0">
            <p className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>
              {missed} proposal{missed === 1 ? '' : 's'} you made went to someone else
            </p>
            {firstMissed && (
              <p className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                “{firstMissed.title}” — the buyer selected another option.
              </p>
            )}
            {pos.missedCapture.value && (
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {pos.missedCapture.value.sampleCount} of your own priced offer
                {pos.missedCapture.value.sampleCount === 1 ? '' : 's'} in {pos.missedCapture.value.over} = KES{' '}
                {Number(pos.missedCapture.value.amount).toLocaleString('en-KE')}. What a winner charged is not
                stored, so it is not shown.
              </p>
            )}
          </div>
        </div>
      )}

      {/* DECAY — expiring quotes / waitlist / override / overdue */}
      {expiring.length > 0 && (
        <div className="flex items-start gap-2.5">
          <Clock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
          <div className="min-w-0">
            <p className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>
              {expiring.length} proposal{expiring.length === 1 ? '' : 's'} expiring
            </p>
            {firstExpiring && (
              <p className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                “{firstExpiring.title}” — valid until {firstExpiring.validUntil ?? 'soon'}.
              </p>
            )}
          </div>
        </div>
      )}

      {firstWait && (
        <div className="flex items-start gap-2.5">
          <Ticket className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
          <div className="min-w-0">
            <p className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>
              {firstWait.status === 'offered'
                ? `Offer waiting on “${firstWait.campaignTitle}”`
                : `#${firstWait.position ?? '—'} in line for “${firstWait.campaignTitle}”`}
            </p>
            {firstWait.hoursLeft != null && (
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {firstWait.status === 'offered' ? `Expires in ${firstWait.hoursLeft}h — accept it or it goes to the next person.` : `${firstWait.hoursLeft}h to respond.`}
              </p>
            )}
          </div>
        </div>
      )}

      {overdue > 0 && (
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-danger)' }} />
          <p className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>
            {overdue} Lipa Mdogo instalment{overdue === 1 ? '' : 's'} overdue.
          </p>
        </div>
      )}

      {override && override.monthsLeft < 3 && (
        <div className="flex items-start gap-2.5">
          <Clock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
          <p className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>
            Your territory override on {override.claimCount} shop{override.claimCount === 1 ? '' : 's'} has {override.monthsLeft} month{override.monthsLeft === 1 ? '' : 's'} left.
          </p>
        </div>
      )}

      {/* OPEN — still-open unmet demand, action framing */}
      {openTotal > 0 && (
        <div className="flex items-start gap-2.5">
          <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-success)' }} />
          <div className="min-w-0">
            <p className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>
              {openTotal} request{openTotal === 1 ? '' : 's'} still open near you
            </p>
            {firstOpen && (
              <p className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                “{firstOpen.title}” · {firstOpen.severityLabel}
                {firstOpen.closesMonthly ? ` · this category has closed ${firstOpen.closesMonthly}× this month` : ''}.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default PositionCard;
