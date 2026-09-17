// ---------------------------------------------------------------------------
// SIGNAL BAR — "what is the local economy doing?", in one line.
//
// This is the honest version of the live ticker. The line it shows is a fact
// the server composed from real rows (GET /api/pulse): open requests with no
// accepted quote, requests that actually closed and how long they took, money
// that really settled, listings that exist right now, events still open.
//
// What it deliberately does NOT do:
//   * it does not say "LIVE" and does not pulse a scanning dot — the payload is
//     a snapshot taken on read, so it stamps the newest real row's time instead;
//   * it never shows a price movement percentage. There is no market feed wired
//     into Brief and a listing carries one price, not a series, so "+22%" would
//     be an invented number;
//   * it renders an error as an error. A silent "all quiet" when the read
//     failed would be a lie by omission.
//
// When there are several real facts the bar cycles through them (and pauses
// for anyone who asked for reduced motion). Rotation is presentation; the
// content is the same ledger either way.
// ---------------------------------------------------------------------------

import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronDown, RefreshCw } from 'lucide-react';
import * as briefApi from '../../api/briefApi';
import type { Pulse } from '../../api/briefApi';

const ROTATE_MS = 9000;
const FADE_MS = 300;

const prefersReducedMotion = () => {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

// A time with no date next to it reads as "just now" — and on a snapshot taken
// three days ago that is a lie by formatting. The stamp carries the day of the
// newest row it came from, so "as of" can never be mistaken for a live clock.
const stampOf = (iso: string | null) => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  try {
    const d = new Date(ms);
    const day = d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
    const time = d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    return `${day} · ${time}`;
  } catch {
    return null;
  }
};

export function SignalBar({
  onOpenPulse,
  className = ''
}: {
  onOpenPulse?: () => void;
  className?: string;
}) {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setStatus('loading');
    void briefApi.getPulse().then((res) => {
      if (!live) return;
      if (res.ok) {
        setPulse(res.data);
        setStatus('ready');
      } else {
        setPulse(null);
        setStatus('error');
      }
    });
    return () => { live = false; };
  }, [attempt]);

  const facts = pulse?.facts ?? [];
  const rotate = facts.length > 1 && !prefersReducedMotion();

  useEffect(() => {
    if (!rotate) return;
    const t = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIdx((i) => (i + 1) % facts.length);
        setFading(false);
      }, FADE_MS);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [rotate, facts.length]);

  const stamp = stampOf(pulse?.asOf ?? null);
  const current = facts[idx] ?? null;
  const counts = useMemo(() => {
    if (!pulse) return null;
    const s = pulse.sections;
    return [
      `${s.demand.open} open`,
      `${s.closure.closed} closed in ${s.closure.windowDays}d`,
      `${s.events.open} event${s.events.open === 1 ? '' : 's'}`,
      `${s.listings.active} listing${s.listings.active === 1 ? '' : 's'}`
    ].join(' · ');
  }, [pulse]);

  if (status === 'loading') {
    return (
      <section className={`brief-skeleton h-12 rounded-2xl ${className}`} style={{ background: 'var(--color-paper)' }} aria-busy="true" />
    );
  }

  if (status === 'error') {
    return (
      <section
        className={`flex items-center gap-2 px-4 py-3 rounded-2xl brief-card ${className}`}
        style={{ background: 'var(--color-paper)' }}
        aria-label="Signals unavailable"
      >
        <Activity className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
        <p className="text-[11px] font-semibold flex-1" style={{ color: 'var(--color-text-muted)' }}>
          Signals unavailable — the ledger could not be read.
        </p>
        <button
          type="button"
          onClick={() => setAttempt((a) => a + 1)}
          className="shrink-0 flex items-center gap-1 text-[11px] font-bold cursor-pointer"
          style={{ color: 'var(--color-primary)' }}
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </section>
    );
  }

  return (
    <section
      className={`rounded-2xl overflow-hidden brief-card--raised ${className}`}
      style={{ background: 'var(--color-paper)' }}
      aria-label="What's moving"
    >
      <div className="flex items-center gap-2 px-4 py-2.5">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: 'var(--color-primary)' }}
          aria-hidden="true"
        />
        <span
          className="text-[10px] font-black uppercase tracking-[0.14em] shrink-0"
          style={{ color: 'var(--color-primary)' }}
        >
          What's moving
        </span>
        <span className="text-[11px] font-mono shrink-0" style={{ color: 'var(--color-text-muted)' }}>
          {stamp ? `newest row ${stamp}` : 'no rows yet'}
        </span>

        <div className="min-w-0 flex-1 text-right">
          {current ? (
            <p
              className="brief-countdown text-[11px] font-semibold truncate transition-opacity duration-300"
              style={{ color: 'var(--color-text)', opacity: fading ? 0 : 1 }}
              title={current.text}
            >
              {current.text}
            </p>
          ) : (
            <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--color-text-muted)' }}>
              Nothing has moved on the ledger yet.
            </p>
          )}
        </div>

        {facts.length > 1 && (
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            aria-expanded={detailsOpen}
            className="shrink-0 flex items-center gap-0.5 text-[10px] font-black uppercase tracking-wider cursor-pointer"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {facts.length} signals
            <ChevronDown className={`w-3 h-3 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {detailsOpen && (
        <div className="px-4 pb-3 space-y-1.5 border-t" style={{ borderColor: 'var(--brief-line)' }}>
          {facts.map((f) => (
            <p key={f.id} className="text-[11px] leading-snug" style={{ color: 'var(--color-text)' }}>
              {f.text}
            </p>
          ))}
          <p className="text-[10px] leading-snug pt-1" style={{ color: 'var(--color-text-muted)' }}>
            A snapshot of real rows, not a feed: no market price index is wired in, and a listing holds
            one price — so no percentage movement is shown.
          </p>
          {onOpenPulse && (
            <button
              type="button"
              onClick={onOpenPulse}
              className="text-[11px] font-bold cursor-pointer"
              style={{ color: 'var(--color-primary)' }}
            >
              Open Pulse →
            </button>
          )}
        </div>
      )}

      {!detailsOpen && counts && facts.length === 0 && (
        <div className="px-4 pb-2.5">
          <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            {counts}
          </p>
        </div>
      )}
    </section>
  );
}

export default SignalBar;
