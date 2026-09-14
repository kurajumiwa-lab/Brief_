// ---------------------------------------------------------------------------
// RECIPROCITY CARD — "who went out of their way for you" and "who you went out
// of your way for", from the derived social-debt ledger. Every line traces to a
// real favor row (a loan you guaranteed, a partner who vouched, a delivery you
// made for another agent's shop). Renders NOTHING when the read fails or there
// is nothing to say — never a fabricated entry.
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import type { MyReciprocity } from '../../api/briefApi';
import * as briefApi from '../../api/briefApi';
import { Heart, Clock } from 'lucide-react';

const KIND_LABEL: Record<string, string> = {
  loan_guarantee: 'guaranteed your loan',
  recommendation: 'vouched for you',
  delivery_cover: 'delivered for your shop'
};

export function ReciprocityCard({ className = '' }: { className?: string }) {
  const [r, setR] = useState<MyReciprocity | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    briefApi.getMyReciprocity().then((res) => {
      if (!live) return;
      setR(res.ok ? res.data : null);
      setLoaded(true);
    });
    return () => { live = false; };
  }, []);

  if (!loaded || !r) return null;
  if (r.owedToMe.length === 0 && r.owedByMe.length === 0) return null;

  return (
    <section className={`rounded-2xl border p-4 space-y-3 ${className}`} style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} aria-label="Your reciprocity">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--color-text)' }}>
          <Heart className="w-3.5 h-3.5 inline mr-1" style={{ color: 'var(--color-primary)' }} /> Reciprocity
        </h3>
        <span className="text-[10px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
          real favors on record
        </span>
      </div>

      {r.owedToMe.length > 0 && (
        <div>
          <p className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
            <Heart className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
            Went out of their way for you
          </p>
          <ul className="mt-1 space-y-1">
            {r.owedToMe.slice(0, 3).map((x) => (
              <li key={x.id} className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                {KIND_LABEL[x.kind] ?? x.kind}
                {x.value ? ` · KES ${x.value.amount.toLocaleString()}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.owedByMe.length > 0 && (
        <div>
          <p className="text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
            You went out of your way for {r.owedByMe.length} other{r.owedByMe.length === 1 ? '' : 's'}
          </p>
        </div>
      )}

      {r.aging.length > 0 && (
        <p className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
          <Clock className="w-3 h-3" />
          {r.aging.length} favor{r.aging.length === 1 ? ' is' : 's are'} over {r.windowDays} days old — reciprocate while it still counts.
        </p>
      )}
    </section>
  );
}

export default ReciprocityCard;
