// ---------------------------------------------------------------------------
// PROMO CAROUSEL — an auto-advancing banner slider of REAL published events.
//
// The "header feeder" on the space screen used to be a hardcoded "Nairobi
// Tonight" strip (fabricated festival / tote / co-op cards). This replaces it
// with an honest, dynamic carousel: the cards are the events that actually
// exist, with their real cover images (deterministic gradient fallback when an
// organiser set none), auto-advancing on a timer and pausable.
//
// Motion honours the canonical tokens (--motion-normal, --ease-emphasized) and
// prefers-reduced-motion (auto-advance stops, sliding becomes instant). With
// no published events the carousel renders nothing — never a fabricated promo.
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from "react";
import * as briefApi from "../../api/briefApi";
import type { EventListing } from "../../api/briefApi";

// Two-tone gradients keyed by a stable title hash — the same identity an event
// has everywhere else in the app, so a cover-less event is never a black box.
const GRADIENTS = [
  "linear-gradient(135deg, #4F46E5, #06B6D4)",
  "linear-gradient(135deg, #06B6D4, #10B981)",
  "linear-gradient(135deg, #8B5CF6, #4F46E5)",
  "linear-gradient(135deg, #0EA5E9, #4F46E5)",
  "linear-gradient(135deg, #14B8A6, #06B6D4)"
];

function titleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const money = (n: number, c: string) => (n === 0 ? "Free" : `${c} ${n.toLocaleString()}`);

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** prefers-reduced-motion, read once and kept in sync (no framer-motion dep). */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

export function PromoCarousel({ className = "", variant = 'horizontal' }: { className?: string; variant?: 'horizontal' | 'vertical' }) {
  const [events, setEvents] = useState<EventListing[] | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    let live = true;
    void briefApi.browseEvents({ sort: "date", limit: 8 }).then((res) => {
      if (!live) return;
      if (!res.ok) { setEvents([]); return; }
      const list = res.data.events ?? [];
      // Featured events lead the rotation; the rest follow soonest-first.
      const featured = list.filter((e) => e.featured);
      const rest = list.filter((e) => !e.featured);
      setEvents([...featured, ...rest]);
    });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!events || events.length < 2 || paused || reduced) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % events.length), 5000);
    return () => clearInterval(t);
  }, [events, paused, reduced]);

  if (!events || events.length === 0) return null;

  const go = (i: number) => setIndex(((i % events.length) + events.length) % events.length);

  // VERTICAL VARIANT — a compact auto-cycling ticker. One event at a time,
  // advancing on the same timer, with a subtle vertical slide. Honest: no
  // cover image, just title + category + date · price · count.
  if (variant === 'vertical') {
    const e = events[index];
    const gradient = GRADIENTS[titleHash(e.title) % GRADIENTS.length];
    const initial = (e.title || '?').trim().charAt(0).toUpperCase();
    return (
      <div
        className={`relative overflow-hidden rounded-2xl border border-black/5 shadow-sm ${className}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        role="region"
        aria-label="Featured events"
      >
        <div
          key={e.slug}
          className="w-full"
          style={{ animation: reduced ? 'none' : 'brief-rise-in var(--motion-normal) var(--ease-emphasized) both' }}
        >
          <a href={`/c/${encodeURIComponent(e.slug)}`} className="flex items-center gap-3 p-3 no-underline">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: gradient }}
            >
              <span className="text-lg font-black text-white/80">{initial}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-[color:var(--color-text)] truncate">{e.title}</p>
              <p className="text-[10px] text-[color:var(--color-text-muted)] truncate">
                {[e.categoryLabel, fmtDate(e.startsAt), money(e.price, e.currency), e.popularity > 0 ? `${e.popularity} going` : null]
                  .filter(Boolean).join(' · ')}
              </p>
            </div>
          </a>
        </div>
        {events.length > 1 && (
          <div className="absolute bottom-2 right-3 flex items-center gap-1">
            {events.map((ev, i) => (
              <button
                key={ev.slug}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => go(i)}
                className="h-1 rounded-full transition-all"
                style={{ width: i === index ? 12 : 4, background: i === index ? 'var(--color-primary)' : 'var(--color-border)' }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-black/5 shadow-sm ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      role="region"
      aria-label="Featured events"
    >
      <div
        className="flex"
        style={{
          transform: `translateX(-${index * 100}%)`,
          transition: reduced ? "none" : "transform var(--motion-normal) var(--ease-emphasized)"
        }}
      >
        {events.map((e) => {
          const gradient = GRADIENTS[titleHash(e.title) % GRADIENTS.length];
          const initial = (e.title || "?").trim().charAt(0).toUpperCase();
          return (
            <a key={e.slug} href={`/c/${encodeURIComponent(e.slug)}`} className="shrink-0 w-full no-underline">
              <div className="relative h-44 sm:h-52 w-full">
                {e.coverImageUrl ? (
                  <img
                    src={e.coverImageUrl}
                    alt={e.title}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ background: "var(--color-surface-elevated)" }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: gradient }}>
                    <span className="text-6xl font-black text-white/80">{initial}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white space-y-1">
                  <span className="inline-block text-[9px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                    {e.categoryLabel}
                  </span>
                  <p className="text-base font-black leading-tight">{e.title}</p>
                  <p className="text-[10px] text-white/80">
                    {[fmtDate(e.startsAt), e.location, money(e.price, e.currency), e.popularity > 0 ? `${e.popularity} going` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
            </a>
          );
        })}
      </div>

      {/* Dots */}
      {events.length > 1 && (
        <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
          {events.map((e, i) => (
            <button
              key={e.slug}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => go(i)}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === index ? 18 : 6,
                background: i === index ? "#ffffff" : "rgba(255,255,255,0.5)"
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default PromoCarousel;
