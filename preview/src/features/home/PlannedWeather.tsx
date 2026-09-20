// ---------------------------------------------------------------------------
// PLANNED WEATHER — the forecast Home is allowed to show.
//
// Home used to carry `WorldStrip`: a whole week of weather for every member,
// every day, whether or not the weather was any of their business. That is the
// decoration the belt rules in this repo exist to prevent — a surface with
// numbers nobody needed. This is the same provider, one notch more honest: the
// line appears ONLY where a dated forecast fact lands on a day the member has
// already committed to (a registration for a published or live event).
//
// Which means the component's most important behaviour is rendering nothing.
// A signed-out visitor, a member with nothing planned, a day the provider gave
// no dated fact for, an unreachable provider — in all four cases there is no
// card at all. No "clear skies ahead", no skeleton pretending to be data, no
// last-known figure presented as today's. The arithmetic lives in
// `server/src/domain/plannedWeather.js` and its suite pins it; this file repeats
// the provider's sentence and never recomputes it.
// ---------------------------------------------------------------------------
import React, { useEffect, useState } from 'react';
import { CloudRain, CloudSun, Sun } from 'lucide-react';
import * as briefApi from '../../api/briefApi';
import type { PlannedWeather as PlannedWeatherData, PlannedWeatherMatch } from '../../api/briefApi';

const PLACE_KEY = 'brief.world.place';
const storedPlace = () => {
  try { return typeof localStorage !== 'undefined' ? String(localStorage.getItem(PLACE_KEY) ?? '') : ''; }
  catch { return ''; }
};

/** The provider's own date words, so "Sat 26 Sep" reads as the day it is. */
const dayLabel = (iso: string): string => {
  const ms = Date.parse(`${iso}T12:00:00Z`);
  if (!Number.isFinite(ms)) return iso;
  try {
    return new Date(ms).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' });
  } catch {
    return iso;
  }
};

const factIcon = (kind: string) => (
  kind === 'heat' || kind === 'hottest'
    ? <Sun className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
    : kind === 'rain' || kind === 'rain-due'
      ? <CloudRain className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
      : <CloudSun className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
);

export function PlannedWeather({ className = '' }: { className?: string }) {
  const [data, setData] = useState<PlannedWeatherData | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    void briefApi.getPlannedWeather(storedPlace() || null).then((res) => {
      if (!live) return;
      // A 401 (no session) and a failed provider read both land here as `null`,
      // and null renders nothing. Showing "weather unavailable" to someone with
      // no plans would be a card about a gap nobody was standing in.
      setData(res.ok ? res.data : null);
    });
    return () => { live = false; };
  }, [attempt]);

  const matched: PlannedWeatherMatch[] = data?.matched ?? [];
  if (!matched.length) return null;

  return (
    <section
      className={`rounded-2xl p-3 space-y-2 ${className}`}
      style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-1), inset 0 0 0 1px var(--brief-line)' }}
      aria-label="Weather on a day you have planned"
    >
      {matched.map((m) => (
        <div key={`${m.date}-${m.campaignId ?? m.eventTitle}`} className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0">{factIcon(m.fact.kind)}</span>
          <p className="min-w-0 flex-1 text-[13px] leading-snug" style={{ color: 'var(--color-text)' }}>
            <strong className="font-black">{dayLabel(m.date)}</strong>
            {' · '}
            {m.slug ? (
              <a
                href={`/c/${encodeURIComponent(m.slug)}`}
                className="font-bold underline decoration-dotted underline-offset-2"
                style={{ color: 'var(--color-primary)' }}
              >
                {m.eventTitle}
              </a>
            ) : (
              <span className="font-bold">{m.eventTitle}</span>
            )}
            {m.eventCount > 1 ? ` (+${m.eventCount - 1} more that day)` : ''}
            {' — '}
            {/* The provider's sentence, quoted. Any arithmetic done here would be
                Brief putting its own number in the member's way. */}
            {m.fact.text}
          </p>
        </div>
      ))}
      <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
        {data?.provider ? `Forecast: ${data.provider}` : 'Forecast'}
        {data?.horizonDays ? ` · next ${data.horizonDays} days` : ''}
        {data?.unmatchedDays ? ` · ${data.unmatchedDays} planned day${data.unmatchedDays === 1 ? '' : 's'} with nothing dated` : ''}
        {/* A forecast is a model output, not an observation. Said once, here, so
            the number above is read for what it is. */}
        {' · a model, not a measurement'}
      </p>
      <button
        type="button"
        onClick={() => setAttempt((a) => a + 1)}
        className="text-[11px] font-bold underline cursor-pointer"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Read it again
      </button>
    </section>
  );
}

export default PlannedWeather;
