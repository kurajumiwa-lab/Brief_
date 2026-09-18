import React, { useEffect, useState } from 'react';
import { ArrowRight, Bike } from 'lucide-react';
import * as briefApi from '../../api/briefApi';
import type { Errand } from '../../api/briefApi';

// ---------------------------------------------------------------------------
// ERRAND LOOPS — the cycle, made visible where the rest of your mid-flight
// work already lives.
//
// Activity answers "what is happening to me right now". An errand is the
// clearest example of a loop with a shape: posted → taken → collected →
// delivered → fee agreed → rated. Each stage below carries the timestamp of the
// row that proves it. A stage with no row shows as upcoming, never as a guess
// and never as an ETA — Brief cannot promise when a rider will arrive, so it
// says nothing and lets the board do the talking.
//
// The actions here are read-only on purpose: a loop is moved by the people in
// it, from the lobby, where the other side can see it happen.
// ---------------------------------------------------------------------------

const ago = (iso: string | null) => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const h = Math.max(0, Math.round((Date.now() - ms) / 3600000));
  if (h < 1) return 'just now';
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

export function ErrandLoops({ onOpenLobby }: { onOpenLobby?: () => void; className?: string }) {
  const [rows, setRows] = useState<Errand[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void briefApi.getErrandBoard().then((res) => {
      if (!live) return;
      if (res.ok) setRows(res.data.mine);
      else setError(res.status === 401 ? null : res.error ?? 'The board could not be read.');
      if (res.ok) setError(null);
    });
    return () => { live = false; };
  }, []);

  if (error) {
    return (
      <p className="text-xs font-bold" role="alert" style={{ color: 'var(--color-danger)' }}>
        {error}
      </p>
    );
  }
  if (rows === null) return null;
  if (rows.length === 0) return null; // no errands, no section — nothing invented

  const open = rows.filter((r) => !['delivered', 'cancelled'].includes(r.status));

  return (
    <section className={`mt-6 space-y-2 ${''}`} aria-label="Your errand loops">
      <div className="flex items-center gap-2">
        <Bike className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
        <h2 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--color-text)' }}>
          Errands you are in
        </h2>
        <span className="text-[11px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
          {open.length} mid-flight · {rows.length} total
        </span>
        {onOpenLobby && (
          <button
            type="button"
            onClick={onOpenLobby}
            className="ml-auto inline-flex items-center gap-1 text-[12px] font-bold cursor-pointer"
            style={{ color: 'var(--color-primary)' }}
          >
            Open the lobby <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {rows.slice(0, 4).map((e) => (
          <li key={e.id} className="p-3 rounded-2xl border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[14px] font-bold leading-snug min-w-0" style={{ color: 'var(--color-text)' }}>
                {e.what}
              </p>
              <span className="shrink-0 text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                {e.isMine ? (e.iAmTheCarrier ? 'you are carrying' : 'you posted') : ''} {e.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-[12px] truncate mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {e.pickup} → {e.dropoff}
              {e.offeredFeeKes != null ? ` · ${e.currency} ${e.offeredFeeKes.toLocaleString('en-KE')}` : ''}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {e.loop.map((s) => (
                <span
                  key={s.key}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{
                    border: `1px solid ${s.done ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: s.done ? 'var(--color-primary-subtle)' : 'transparent',
                    color: s.done ? 'var(--color-text)' : 'var(--color-text-muted)'
                  }}
                >
                  {s.label}
                  <span className="font-mono">{s.done ? ago(s.at) : '—'}</span>
                </span>
              ))}
            </div>
            {e.ratings.length > 0 && (
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
                {e.ratings.map((r) => `${r.stars}/5 by ${r.by} on ${r.about}`).join(' · ')} — listed as said, never averaged
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default ErrandLoops;
