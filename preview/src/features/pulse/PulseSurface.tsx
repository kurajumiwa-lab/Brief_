import React, { useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import * as briefApi from '../../api/briefApi';
import type { Pulse } from '../../api/briefApi';
import { ActivitySurface } from '../activity/ActivitySurface';

// ---------------------------------------------------------------------------
// PULSE — the check-in surface.
//
// "What's moving today", in full. The bar on Home rotates one fact at a time;
// this is the whole ledger the bar read from, as a list — because a place you
// go to when you want to know what happened should show everything that
// happened, not one rotating sentence.
//
// It is NOT a bottom-bar door. The reorg that owns this screen: the bar holds
// three places and one action; Pulse is a shelf in the drawer (and a link on
// the Home hero), because a check-in is a visit, not a room you live in.
//
// Honesty rules, same as the bar:
//   * the stamp is the newest real row, labelled as such — not a clock;
//   * an empty ledger says empty; a failed read says failed and offers a retry;
//   * below the world's numbers sits your own activity — the two halves of
//     "what happened" (out there, and to you).
// ---------------------------------------------------------------------------

const stampOf = (iso: string | null): string | null => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  try {
    const d = new Date(ms);
    const day = d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
    const time = d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    return `${day} · ${time}`;
  } catch {
    return null;
  }
};

export function PulseSurface({ onOpenRequests }: { onOpenRequests: () => void }) {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setStatus('loading');
    briefApi.getPulse().then((res) => {
      if (!live) return;
      if (res.ok) {
        setPulse(res.data);
        setStatus('ready');
      } else {
        setStatus('error');
      }
    });
    return () => { live = false; };
  }, [attempt]);

  // Coming back to the drawer re-reads: a refresh on return, not a stream.
  useEffect(() => {
    const onVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') setAttempt((a) => a + 1);
    };
    if (typeof window === 'undefined') return;
    window.addEventListener('focus', onVisible);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const stamp = stampOf(pulse?.asOf ?? null);
  const s = pulse?.sections ?? null;

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      <header className="space-y-1">
        <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
          Pulse
        </p>
        <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--color-text)' }}>
          What&rsquo;s moving today
        </h1>
        {stamp ? (
          <p className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
            Newest real row: {stamp} — a snapshot on read, not a clock
          </p>
        ) : null}
      </header>

      {status === 'error' && (
        <section
          className="flex items-center gap-2 px-4 py-3 rounded-2xl"
          style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), inset 0 0 0 1px var(--brief-line)' }}
          aria-label="Pulse unavailable"
        >
          <Activity className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-[13px] font-semibold flex-1" style={{ color: 'var(--color-text-muted)' }}>
            The ledger could not be read.
          </p>
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="shrink-0 flex items-center gap-1 text-[12px] font-bold cursor-pointer"
            style={{ color: 'var(--color-primary)' }}
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </section>
      )}

      {status === 'ready' && pulse && (
        <>
          {/* The whole fact list — the bar rotates one of these; here they all
              stand, in the order the server composed them. */}
          {pulse.facts.length > 0 ? (
            <section aria-label="What moved" className="space-y-1.5">
              {pulse.facts.map((f) => (
                <div
                  key={f.id}
                  className="px-4 py-3 rounded-2xl"
                  style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), inset 0 0 0 1px var(--brief-line)' }}
                >
                  <p className="text-[13px] font-semibold leading-snug" style={{ color: 'var(--color-text)' }}>
                    {f.text}
                  </p>
                </div>
              ))}
            </section>
          ) : pulse.empty ? (
            <div
              className="p-5 rounded-3xl border border-dashed text-center"
              style={{ borderColor: 'var(--brief-line)', background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-1)' }}
            >
              <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                Nothing has moved that the ledger can see.
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                A first request, a first settlement, a first event — one of those happens, and it is read here from the row.
              </p>
            </div>
          ) : null}

          {/* The section arithmetic, as four quiet tiles: the same numbers the
              bar joins into one line, each with its own window. */}
          {s && (
            <section aria-label="The ledger, by section" className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-2xl" style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), inset 0 0 0 1px var(--brief-line)' }}>
                <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Demand</p>
                <p className="text-[15px] font-black mt-0.5" style={{ color: 'var(--color-text)' }}>{s.demand.open} open</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{s.demand.collective} made together</p>
              </div>
              <div className="p-3 rounded-2xl" style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), inset 0 0 0 1px var(--brief-line)' }}>
                <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Closed · {s.closure.windowDays}d</p>
                <p className="text-[15px] font-black mt-0.5" style={{ color: 'var(--color-text)' }}>{s.closure.closed}</p>
                {s.closure.topCategory ? (
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>most in {s.closure.topCategory.category}</p>
                ) : null}
              </div>
              <div className="p-3 rounded-2xl" style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), inset 0 0 0 1px var(--brief-line)' }}>
                <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Settled · {s.money.windowDays}d</p>
                <p className="text-[15px] font-black mt-0.5" style={{ color: 'var(--color-text)' }}>
                  {s.money.settledOrders} order{s.money.settledOrders === 1 ? '' : 's'}
                </p>
                {s.money.settledValue != null ? (
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {s.money.settledCurrency ?? 'KES'} {Number(s.money.settledValue).toLocaleString('en-KE')} moved
                  </p>
                ) : null}
              </div>
              <div className="p-3 rounded-2xl" style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), inset 0 0 0 1px var(--brief-line)' }}>
                <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>On the board</p>
                <p className="text-[15px] font-black mt-0.5" style={{ color: 'var(--color-text)' }}>
                  {s.listings.active} listing{s.listings.active === 1 ? '' : 's'}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {s.events.open} event{s.events.open === 1 ? '' : 's'} still open
                </p>
              </div>
            </section>
          )}
        </>
      )}

      {/* The second half of "what happened": what it did to you. */}
      <section aria-label="Your activity" className="pt-2 border-t border-black/5">
        <h2 className="text-xs font-black uppercase tracking-wider pb-3" style={{ color: 'var(--color-text)' }}>
          Your activity
        </h2>
        <ActivitySurface onOpenRequests={onOpenRequests} />
      </section>
    </div>
  );
}

export default PulseSurface;
