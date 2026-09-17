// ---------------------------------------------------------------------------
// WORLD STRIP — one line about the country, expandable to the facts.
//
// Home's other numbers are the user's own, and for a new account they are all
// zero. This line is the thing that is true regardless: rain is coming, or it
// isn't, and that is a fact a producer plans around. It reads as one line with a
// dot; the rest of the week is behind a tap.
//
// Every sentence here is composed by the server from the provider's own numbers,
// and this component repeats them without arithmetic. The reasons a price line is
// missing, what the cache window is, and why a forecast is not an observation are
// on the one audit screen (You → How Brief works), not in the reader's way here.
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import { ChevronDown, CloudRain, RefreshCw } from 'lucide-react';
import * as briefApi from '../../api/briefApi';
import type { WorldSignal } from '../../api/briefApi';
import { StateDot } from '../../ui/StateDot';
import { soundEngine } from '../../utils/SoundEngine';

const PLACE_KEY = 'brief.world.place';
const stored = () => {
  try { return typeof localStorage !== 'undefined' ? String(localStorage.getItem(PLACE_KEY) ?? '') : ''; }
  catch { return ''; }
};

const head = (facts: { kind: string; text: string }[]): string => {
  const wet = facts.find((f) => f.kind === 'wet-count');
  if (wet) return wet.text.replace(/ —.*$/, '');
  const rain = facts.find((f) => f.kind === 'rain' || f.kind === 'rain-due');
  if (rain) return rain.text.replace(/^Heavy rain forecast /, 'Rain ').replace(/^Wettest of the next \d+ days: /, '');
  const dry = facts.find((f) => f.kind === 'dry');
  return dry ? dry.text : facts[0]?.text ?? 'Nothing worth a sentence in the next seven days';
};

export function WorldStrip({ className = '' }: { className?: string }) {
  const [place, setPlace] = useState<string>(stored);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
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

  if (status === 'loading') {
    return <div className={`brief-skeleton h-9 rounded-xl ${className}`} style={{ background: 'var(--color-paper)' }} aria-busy="true" />;
  }

  if (status === 'error' || !data) {
    return (
      <button
        type="button"
        onClick={() => { setAttempt((a) => a + 1); soundEngine.play('tap'); }}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left cursor-pointer ${className}`}
        style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-1), inset 0 0 0 1px var(--brief-line)' }}
      >
        <StateDot state="unknown" />
        <span className="text-[12px] font-semibold flex-1" style={{ color: 'var(--color-text-muted)' }}>World read unavailable</span>
        <RefreshCw className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
      </button>
    );
  }

  const facts = data.facts ?? [];
  const state = facts.some((f) => f.kind === 'rain' || f.kind === 'rain-due' || f.kind === 'wet-count')
    ? 'moving'
    : facts.some((f) => f.kind === 'dry' || f.kind === 'heat')
      ? 'quiet'
      : 'unknown';

  return (
    <div className={className} style={{ background: 'var(--color-paper)', borderRadius: '14px', boxShadow: 'var(--room-light), var(--lift-1), inset 0 0 0 1px var(--brief-line)' }}>
      <div className="flex items-center gap-2 px-3 py-2">
        <CloudRain className="w-4 h-4 shrink-0" style={{ color: state === 'moving' ? 'var(--state-moving)' : 'var(--color-text-muted)' }} />
        <span className="text-[12.5px] font-bold truncate flex-1" style={{ color: 'var(--color-text)' }}>
          {data.available === false ? String(data.error ?? 'No read').split(/[,.(]/)[0] : head(facts)}
        </span>
        <span className="shrink-0 text-[9px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
          {(data.resolvedPlace?.name ?? data.place ?? '')}{data.stale ? ` · ${Math.round(data.ageHours ?? 0)}h` : ''}
        </span>
        {data.available === false ? (
          <button
            type="button"
            onClick={() => { setAttempt((a) => a + 1); soundEngine.play('tap'); }}
            className="shrink-0 text-[11px] font-black cursor-pointer"
            style={{ color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0, font: 'inherit' }}
          >
            Retry
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setOpen((v) => !v); soundEngine.play('tap'); }}
            aria-expanded={open}
            aria-label={open ? 'Hide the week' : 'See the week'}
            className="w-6 h-6 shrink-0 grid place-items-center rounded-md cursor-pointer"
            style={{ background: 'none', border: 'none' }}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--color-text-muted)' }} />
          </button>
        )}
      </div>

      {open && (
        <div className="px-3 pb-2.5 space-y-1.5" style={{ borderTop: '1px solid var(--brief-line)' }}>
          <ul className="pt-2 space-y-1">
            {facts.length === 0 ? (
              <li className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{data.error ?? 'Nothing in the window worth a sentence.'}</li>
            ) : facts.map((f, i) => (
              <li key={`${f.kind}-${i}`} className="flex items-start gap-2 text-[11.5px]" style={{ color: 'var(--color-text)' }}>
                <StateDot state={f.kind === 'rain' || f.kind === 'rain-due' || f.kind === 'wet-count' ? 'moving' : f.kind === 'cold' ? 'unknown' : 'quiet'} />
                <span className="min-w-0">{f.text}</span>
              </li>
            ))}
          </ul>
          {data.available === false && (
            <button type="button" onClick={() => setAttempt((a) => a + 1)} className="text-[11px] font-black cursor-pointer" style={{ color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0 }}>
              Retry
            </button>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const next = draft.trim();
              try { if (typeof localStorage !== 'undefined') { if (next) localStorage.setItem(PLACE_KEY, next); else localStorage.removeItem(PLACE_KEY); } } catch { /* not remembering is allowed */ }
              setPlace(next);
              setDraft('');
            }}
            className="flex items-center gap-1.5 pt-1"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={data.placeIsDefault ? 'Another place…' : 'Change place'}
              aria-label="Place"
              className="flex-1 min-w-0 text-[11px] rounded-lg px-2 py-1"
              style={{ background: 'var(--color-well)', color: 'var(--color-text)', boxShadow: 'inset 0 0 0 1px var(--brief-line)' }}
            />
            <button type="submit" className="text-[11px] font-black px-2 py-1 rounded-lg cursor-pointer" style={{ background: draft.trim() ? 'var(--color-primary)' : 'var(--color-well)', color: draft.trim() ? 'var(--accent-ink)' : 'var(--color-text-muted)' }}>
              Go
            </button>
            {place ? (
              <button type="button" onClick={() => { setPlace(''); setDraft(''); try { localStorage.removeItem(PLACE_KEY); } catch { /* ignore */ } }} className="text-[11px] font-bold cursor-pointer" style={{ color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0 }}>
                reset
              </button>
            ) : null}
          </form>
        </div>
      )}
    </div>
  );
}

export default WorldStrip;
