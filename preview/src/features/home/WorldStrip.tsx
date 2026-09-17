// ---------------------------------------------------------------------------
// WORLD STRIP — "the world is moving even though your ledger is not".
//
// Home's other zones are about the user: their standing, their next move, their
// spaces. Those are all legitimately empty for a new user, which is why a Home
// built only from them reads as a form letter. This strip is the one place on the
// screen that reports something true the user did not have to produce: the
// weather a producer actually plans around, read from Open-Meteo by the server,
// cached per place, stamped with when it was retrieved.
//
// What it will not do:
//   * show a number the provider did not return. No "maize +12%", no seasonal
//     average, no "typical for September", no illustrative price. The server
//     composes every sentence from the response's own fields; this component
//     repeats them and adds no arithmetic of its own.
//   * pretend prices or fuel are wired. They are declared `not_configured` by the
//     domain, with the reason, and the strip says that in one line — behind the
//     derivation note, not in the reader's way.
//   * pass a forecast off as an observation. The payload's `observedAt` is null
//     and the header says FORECAST with its horizon; a stale read is labelled
//     with its age rather than shown as current.
//   * invent a place. A place is either the default (and says so) or whatever the
//     provider's gazetteer matched, with the provider's own county/country
//     labels printed next to it — so a wrong match is visible, not smoothed.
//
// The chosen place lives on the device (localStorage), like the view memory: it is
// a reading preference, not a claim about the account.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { CloudRain, CloudSun, RefreshCw, Snowflake, Sun, MapPin } from 'lucide-react';
import * as briefApi from '../../api/briefApi';
import type { WorldFact, WorldSignal } from '../../api/briefApi';
import { DerivationNote } from '../../ui/DerivationNote';
import { soundEngine } from '../../utils/SoundEngine';

const PLACE_KEY = 'brief.world.place';

const readStoredPlace = (): string => {
  try { return typeof localStorage !== 'undefined' ? String(localStorage.getItem(PLACE_KEY) ?? '') : ''; }
  catch { return ''; }
};
const storePlace = (v: string) => {
  try { if (typeof localStorage !== 'undefined') { if (v) localStorage.setItem(PLACE_KEY, v); else localStorage.removeItem(PLACE_KEY); } }
  catch { /* a device that will not remember is allowed */ }
};

const clockOf = (iso?: string | null) => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
};

const TONE: Record<string, { color: string; icon: React.ReactNode }> = {
  rain: { color: 'var(--color-accent)', icon: <CloudRain className="w-3.5 h-3.5" /> },
  'rain-due': { color: 'var(--color-accent)', icon: <CloudRain className="w-3.5 h-3.5" /> },
  'wet-count': { color: 'var(--color-accent)', icon: <CloudRain className="w-3.5 h-3.5" /> },
  dry: { color: 'var(--color-warning)', icon: <Sun className="w-3.5 h-3.5" /> },
  heat: { color: 'var(--color-warning)', icon: <CloudSun className="w-3.5 h-3.5" /> },
  cold: { color: 'var(--color-accent)', icon: <Snowflake className="w-3.5 h-3.5" /> }
};

export interface WorldStripProps {
  className?: string;
}

export function WorldStrip({ className = '' }: WorldStripProps) {
  const [place, setPlace] = useState<string>(readStoredPlace);
  const [draft, setDraft] = useState<string>('');
  const [data, setData] = useState<WorldSignal | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setStatus('loading');
    void briefApi.getWorld(place || null).then((res) => {
      if (!live) return;
      if (res.ok) { setData(res.data); setStatus('ready'); }
      else { setData(null); setStatus('error'); }
    });
    return () => { live = false; };
  }, [place, attempt]);

  const apply = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const next = draft.trim();
    storePlace(next);
    setPlace(next);
    soundEngine.play('tap');
  }, [draft]);

  if (status === 'loading') {
    return <section className={`brief-skeleton h-24 rounded-2xl ${className}`} style={{ background: 'var(--color-paper)' }} aria-busy="true" />;
  }

  if (status === 'error' || !data) {
    return (
      <section
        className={`flex items-center gap-2 px-4 py-3 rounded-2xl brief-card ${className}`}
        style={{ background: 'var(--color-paper)' }}
        aria-label="World signal unavailable"
      >
        <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
        <p className="text-[11px] font-semibold flex-1" style={{ color: 'var(--color-text-muted)' }}>
          The world could not be read.
        </p>
        <button
          type="button"
          onClick={() => { setAttempt((a) => a + 1); soundEngine.play('tap'); }}
          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer"
          style={{ color: 'var(--color-primary)' }}
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </section>
    );
  }

  const facts: WorldFact[] = data.facts ?? [];
  const where = data.resolvedPlace?.name ?? data.place ?? 'the default place';
  const labels = [data.resolvedPlace?.admin, data.resolvedPlace?.country].filter(Boolean).join(', ');
  const retrieved = clockOf(data.retrievedAt);
  const gaps = [data.prices, data.fuel].filter((x) => x && x.status === 'not_configured');

  return (
    <section
      className={`rounded-2xl overflow-hidden brief-card--raised ${className}`}
      style={{ background: 'var(--color-paper)' }}
      aria-label="The world, today"
    >
      <div className="flex items-center gap-2 px-4 pt-3 pb-1 flex-wrap">
        <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
        <h2 className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--color-primary)' }}>
          The world, today
        </h2>
        <span className="text-[11px] font-bold truncate" style={{ color: 'var(--color-text)' }}>
          {where}
          {labels ? <span className="font-mono font-normal"> · {labels}</span> : null}
        </span>
        {data.placeIsDefault && (
          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-well)', color: 'var(--color-text-muted)' }}>
            default
          </span>
        )}
        <span className="ml-auto text-[10px] font-mono" style={{ color: 'var(--color-text-faint)' }}>
          {data.stale ? `stale · ${data.ageHours ?? '?'}h old` : retrieved ? `${retrieved}` : 'no time given'}
        </span>
      </div>

      {data.available === false ? (
        <div className="flex items-start gap-2 px-4 pb-3">
          <p className="flex-1 text-[11px] leading-snug" role="status" style={{ color: 'var(--brief-muted)' }}>
            {data.error || 'No read is available right now, so nothing is shown.'}
          </p>
          {/* A gap gets a way out, never a spinner that hides it. */}
          <button
            type="button"
            onClick={() => { setAttempt((a) => a + 1); soundEngine.play('tap'); }}
            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer"
            style={{ color: 'var(--color-primary)' }}
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      ) : facts.length === 0 ? (
        <p className="px-4 pb-3 text-[11px] leading-snug" style={{ color: 'var(--brief-muted)' }}>
          Nothing in the forecast is worth a sentence for {where} in the next {data.horizonDays ?? 7} days — that is the read, not a fault.
        </p>
      ) : (
        <ul className="px-4 pb-2 space-y-1">
          {facts.map((f, i) => {
            const tone = TONE[f.kind] ?? { color: 'var(--color-text-muted)', icon: <CloudSun className="w-3.5 h-3.5" /> };
            return (
              <li key={`${f.kind}-${i}`} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0" style={{ color: tone.color }} aria-hidden="true">{tone.icon}</span>
                <p className="text-[12.5px] leading-snug font-semibold" style={{ color: 'var(--color-text)' }}>
                  {f.text}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="px-4 pb-3">
        <DerivationNote
          summary={
            <>
              {data.provider ?? 'The provider'} forecast for the next {data.horizonDays ?? 7} days — a forecast, not a measurement
              {data.fromCache ? ', read from a cache' : ''}.
              {gaps.length ? ` Prices and fuel are not wired${gaps.length === 2 ? ' either' : ''}.` : ''}
            </>
          }
          detail={
            <>
              Brief asks {data.provider ?? 'a public provider'} once per place per six hours and repeats what it returns, sentence by
              sentence, from the response's own numbers. {data.model ? `The model is ${data.model}. ` : ''}
              {data.elevationM != null ? `The reading is taken at ${data.elevationM} m. ` : ''}
              It never fills a gap: no seasonal average, no "typical for this month", no illustrative percentage — there is no
              market-price feed in Brief, so a movement figure would be a number with nothing behind it.
              {gaps.map((g, i) => (
                <span key={i}> {g === data.prices ? 'Commodity prices' : 'Fuel prices'}: {g!.reason}. </span>
              ))}
              <span className="font-mono">Licence: {data.providerLicence ?? 'stated by the provider'}.</span>
            </>
          }
        />
      </div>

      <form onSubmit={apply} className="flex items-center gap-1.5 px-4 pb-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={data.placeIsDefault ? 'Read it for another place…' : `Place: ${where}`}
          aria-label="Place for the world read"
          list="brief-world-places"
          className="flex-1 min-w-0 text-[11px] rounded-lg px-2.5 py-1.5"
          style={{ background: 'var(--color-well)', color: 'var(--color-text)', boxShadow: 'inset 0 0 0 1px var(--brief-line)' }}
        />
        <datalist id="brief-world-places">
          {['Nairobi', 'Kisii', 'Kisumu', 'Nakuru', 'Mombasa', 'Eldoret', 'Thika', 'Machakos'].map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <button
          type="submit"
          className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer"
          style={{ background: draft.trim() ? 'var(--color-primary)' : 'var(--color-well)', color: draft.trim() ? 'var(--accent-ink)' : 'var(--color-text-muted)' }}
        >
          {draft.trim() ? (draft.trim() === place ? 'Re-read' : 'Read there') : 'Use Nairobi'}
        </button>
        {place && (
          <button
            type="button"
            onClick={() => { setDraft(''); storePlace(''); setPlace(''); }}
            className="shrink-0 px-2 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer"
            style={{ color: 'var(--color-primary)', background: 'transparent', border: 'none' }}
          >
            reset
          </button>
        )}
      </form>
    </section>
  );
}

export default WorldStrip;
