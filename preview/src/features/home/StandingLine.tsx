// ---------------------------------------------------------------------------
// STANDING LINE — one line about where you actually stand.
//
// The brief asked for "Position #7 · Sector 4". No row in Brief holds a rank,
// a sector or a queue, so a number like that would be invented, and an invented
// standing is the one thing that turns a ledger into a casino. What this line
// shows instead is the real standing: how many of your proposals are expiring,
// what is owed to you, what you owe, what went to someone else, what is
// overdue. Every segment is a count over rows the user can open themselves,
// and a segment that is zero is not shown as zero — it is simply not there.
//
// "Nothing pending on your ledger." is only ever rendered after a successful
// read that really came back empty. A failed read renders nothing at all.
// ---------------------------------------------------------------------------

import React from 'react';
import type { MyCommitments, MyPosition, MyReciprocity } from '../../api/briefApi';

const kes = (n: number) => `KES ${Number(n).toLocaleString('en-KE')}`;

export function StandingLine({
  position,
  commitments,
  reciprocity,
  className = ''
}: {
  position: MyPosition | null;
  commitments: MyCommitments | null;
  reciprocity: MyReciprocity | null;
  className?: string;
}) {
  // No successful read yet -> no claim either way.
  if (!position && !commitments && !reciprocity) return null;

  const segments: string[] = [];

  if (position) {
    const expiring = position.decay.expiringQuotes.length;
    if (expiring > 0) segments.push(`${expiring} proposal${expiring === 1 ? '' : 's'} expiring`);
    const offered = position.decay.waitlist.filter((w) => w.status === 'offered').length;
    if (offered > 0) segments.push(`${offered} offer${offered === 1 ? '' : 's'} waiting on you`);
    if (position.decay.overdueInstallments > 0) {
      segments.push(`${position.decay.overdueInstallments} instalment${position.decay.overdueInstallments === 1 ? '' : 's'} overdue`);
    }
    if (position.missedCapture.count > 0) {
      const v = position.missedCapture.value;
      segments.push(
        `${position.missedCapture.count} proposal${position.missedCapture.count === 1 ? '' : 's'} went to someone else${
          v ? ` (${kes(v.amount)} of your own offers, ${v.over})` : ''
        }`
      );
    }
  }

  if (commitments) {
    if (commitments.owedToMe.length > 0) {
      segments.push(
        `${commitments.owedToMe.length} owed to you${commitments.owedToMeKes > 0 ? ` (${kes(commitments.owedToMeKes)})` : ''}`
      );
    }
    if (commitments.owedByMe.length > 0) {
      segments.push(
        `${commitments.owedByMe.length} you owe${commitments.owedByMeKes > 0 ? ` (${kes(commitments.owedByMeKes)})` : ''}`
      );
    }
    if (commitments.lapsed.length > 0) {
      segments.push(`${commitments.lapsed.length} lapsed`);
    }
  }

  if (reciprocity && reciprocity.aging.length > 0) {
    segments.push(`${reciprocity.aging.length} favour${reciprocity.aging.length === 1 ? '' : 's'} unreturned`);
  }

  return (
    <p className={`text-[11px] font-semibold leading-snug ${className}`} style={{ color: 'var(--color-text-muted)' }}>
      {segments.length === 0 ? (
        <span>Nothing pending on your ledger.</span>
      ) : (
        <>
          <span className="font-black uppercase tracking-[0.12em] text-[9px] mr-1.5" style={{ color: 'var(--color-primary)' }}>
            Your standing
          </span>
          {segments.join(' · ')}
        </>
      )}
    </p>
  );
}

export default StandingLine;
