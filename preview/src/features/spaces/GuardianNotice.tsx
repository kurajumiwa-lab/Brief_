import React, { useEffect, useState } from 'react';
import { ShieldQuestion, ShieldX } from 'lucide-react';
import * as briefApi from '../../api/briefApi';
import type { SpaceGuardian } from '../../api/types';

// ---------------------------------------------------------------------------
// GUARDIAN NOTICE — the shop's answer to "somebody says they registered you".
//
// This is the whole anti-fraud gate in one card. A claim is stored as pending
// and credits NOTHING until the shop confirms it, so the only power a claimant
// has is the ability to ask. Two rules the copy has to keep honest:
//
//   * the money never comes out of the shop. Points are paid from Brief's
//     rewards pool (a share of confirmed service-fee revenue, finance-
//     confirmed). Saying "1% of your orders" when no order fee exists would be
//     inventing a charge;
//   * a dispute is not escalated and not mediated. It ends the link, and Brief
//     refuses to let the shop be asked again, because there is no reviewer here
//     and a "we'll look into it" would be a promise with nobody behind it.
// ---------------------------------------------------------------------------

export function GuardianNotice({ spaceId, className = '' }: { spaceId: string; className?: string }) {
  const [data, setData] = useState<SpaceGuardian | null>(null);
  const [busy, setBusy] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState('');
  const [answered, setAnswered] = useState<string | null>(null);

  const load = React.useCallback(async () => {
    const res = await briefApi.getSpaceGuardian(spaceId);
    if (res.ok) setData(res.data);
  }, [spaceId]);
  useEffect(() => { void load(); }, [load]);

  const answer = async (kind: 'confirm' | 'dispute') => {
    if (!data?.attribution) return;
    setBusy(true);
    const res = await briefApi.answerGuardian(data.attribution.id, kind, kind === 'dispute' ? reason : undefined);
    setBusy(false);
    if (!res.ok) { setAnswered(res.error ?? 'That did not go through.'); return; }
    setAnswered(kind === 'confirm'
      ? 'Confirmed. The credit runs from today, from Brief’s pool, not from your earnings.'
      : 'Disputed. The link is closed and nobody else will be allowed to claim this shop.');
    setDisputing(false);
    void load();
  };

  if (!data || !data.attribution) return null;
  const a = data.attribution;
  if (a.status !== 'pending_owner' && !answered) {
    // A live link is a fact about the shop's own file, not an alert. One quiet
    // line, no badge, no "protected by" nonsense.
    return (
      <p className={`text-[11px] font-medium ${className}`} style={{ color: 'var(--brief-muted)' }} data-guardian="live">
        Introduced by {a.guardianName ?? 'a member'} · {data.note}
      </p>
    );
  }

  return (
    <div className={`p-3.5 rounded-2xl brief-lift-2 space-y-2 ${className}`} style={{ background: 'var(--brief-card)' }} data-guardian="pending">
      <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
        <ShieldQuestion className="w-3.5 h-3.5" aria-hidden="true" /> Somebody says they registered you
      </p>
      <p className="text-[14px] font-bold" style={{ color: 'var(--brief-ink)' }}>
        {a.guardianName ?? 'A member'} · asked {a.claimedAt ? new Date(a.claimedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }) : 'recently'}
      </p>
      {a.note && <p className="text-[13px] leading-snug" style={{ color: 'var(--brief-muted)' }}>“{a.note}”</p>}
      <p className="text-[12px] leading-snug" style={{ color: 'var(--brief-ink)' }}>{data.terms}</p>
      <p className="text-[11px] leading-snug" style={{ color: 'var(--brief-faint)' }}>{data.note}</p>

      {answered ? (
        <p role="status" className="text-[12px] font-bold" style={{ color: 'var(--brief-muted)' }}>{answered}</p>
      ) : disputing ? (
        <div className="space-y-1.5">
          <input
            type="text"
            aria-label="Why you are disputing this"
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            placeholder="optional: what actually happened"
            className="w-full px-3 py-2 rounded-xl text-[13px] focus:outline-none"
            style={{ background: 'var(--color-well)', color: 'var(--brief-ink)' }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer('dispute')}
              className="px-3.5 py-2 rounded-full text-[12px] font-black cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--brief-danger)', color: '#FFFFFF' }}
            >
              <ShieldX className="w-3.5 h-3.5 inline -mt-0.5 mr-1" aria-hidden="true" /> That is not right
            </button>
            <button type="button" onClick={() => setDisputing(false)} className="px-3.5 py-2 rounded-full text-[12px] font-bold cursor-pointer" style={{ background: 'var(--color-well)', color: 'var(--brief-ink)' }}>
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void answer('confirm')}
            className="px-3.5 py-2 rounded-full text-[12px] font-black cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
          >
            Yes, they did
          </button>
          <button
            type="button"
            onClick={() => setDisputing(true)}
            className="px-3.5 py-2 rounded-full text-[12px] font-bold cursor-pointer"
            style={{ background: 'var(--color-well)', color: 'var(--brief-ink)' }}
          >
            That is not right
          </button>
        </div>
      )}
    </div>
  );
}

export default GuardianNotice;
