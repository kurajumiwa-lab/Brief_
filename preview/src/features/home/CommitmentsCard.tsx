// ---------------------------------------------------------------------------
// COMMITMENTS CARD — "owed to you" vs "you owe", from the derived commitment
// graph. Every line traces to a real row (evidence.table + id); every KES
// figure is a real amount from an order or loan. Renders NOTHING when the read
// fails or there is nothing to say — never a fabricated zero.
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import type { MyCommitments } from '../../api/briefApi';
import * as briefApi from '../../api/briefApi';
import { ArrowDown, ArrowUpRight, TrendingUp } from 'lucide-react';

const KIND_LABEL: Record<string, string> = {
  quote_honor: 'held price',
  delivery: 'delivery',
  payment: 'payment',
  repayment: 'repayment'
};

export function CommitmentsCard({ className = '' }: { className?: string }) {
  const [c, setC] = useState<MyCommitments | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    briefApi.getMyCommitments().then((res) => {
      if (!live) return;
      setC(res.ok ? res.data : null);
      setLoaded(true);
    });
    return () => { live = false; };
  }, []);

  if (!loaded || !c) return null;
  if (c.owedByMe.length === 0 && c.owedToMe.length === 0) return null;

  return (
    <section className={`rounded-2xl border p-4 space-y-3 ${className}`} style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} aria-label="Your commitments">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--color-text)' }}>
          <TrendingUp className="w-3.5 h-3.5 inline mr-1" /> Your commitments
        </h3>
        <span className="text-[10px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
          every line traces to a real record
        </span>
      </div>

      {c.owedToMe.length > 0 && (
        <div>
          <p className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--color-success)' }}>
            <ArrowDown className="w-3.5 h-3.5" />
            Owed to you · {c.owedToMe.length} commitment{c.owedToMe.length === 1 ? '' : 's'}
            {c.owedToMeKes > 0 && <span className="font-black">· KES {c.owedToMeKes.toLocaleString()}</span>}
          </p>
          <ul className="mt-1 space-y-1">
            {c.owedToMe.slice(0, 3).map((x) => (
              <li key={x.id} className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                {KIND_LABEL[x.kind] ?? x.kind}
                {x.value ? ` · KES ${x.value.amount.toLocaleString()}` : ''}
                {x.deadline ? ` · due ${x.deadline}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {c.owedByMe.length > 0 && (
        <div>
          <p className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--color-warning)' }}>
            <ArrowUpRight className="w-3.5 h-3.5" />
            You owe · {c.owedByMe.length} commitment{c.owedByMe.length === 1 ? '' : 's'}
            {c.owedByMeKes > 0 && <span className="font-black">· KES {c.owedByMeKes.toLocaleString()}</span>}
          </p>
          <ul className="mt-1 space-y-1">
            {c.owedByMe.slice(0, 3).map((x) => (
              <li key={x.id} className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                {KIND_LABEL[x.kind] ?? x.kind}
                {x.value ? ` · KES ${x.value.amount.toLocaleString()}` : ''}
                {x.deadline ? ` · due ${x.deadline}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default CommitmentsCard;
