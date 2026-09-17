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
import { PLASTER, PHOTO_FILTER, PHOTO_SCRIM } from "../city/room";
import { categoryWash, categoryAccent } from "../city/categoryPalette";

// A cover-less event gets the room's plaster carrying its CATEGORY's light — the
// same wing colour the case uses everywhere else. It used to be one of five cold
// two-tone swatches picked by hashing the title, which is a colour standing in
// for a fact: the same mistake as a number nobody counted. And the giant first
// letter is gone with it (killed on the museum cards for the same reason).

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
    const wash = categoryWash(e.category);
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
              className="w-10 h-10 rounded-xl shrink-0 relative"
              style={{ background: PLASTER, boxShadow: 'inset 0 0 0 1px var(--brief-line)' }}
              aria-hidden="true"
            >
              <span className="absolute inset-0 rounded-xl" style={{ background: wash }} />
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
          const wash = categoryWash(e.category);
          return (
            <a key={e.slug} href={`/c/${encodeURIComponent(e.slug)}`} className="shrink-0 w-full no-underline">
              <div className="relative h-44 sm:h-52 w-full">
                {e.coverImageUrl ? (
                  <img
                    src={e.coverImageUrl}
                    alt={e.title}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ background: PLASTER, filter: PHOTO_FILTER }}
                  />
                ) : (
                  <div className="absolute inset-0" style={{ background: PLASTER }}>
                    <span className="absolute inset-0" style={{ background: wash }} />
                    <span className="absolute bottom-3 left-3 text-[9px] font-black uppercase tracking-wider" style={{ color: categoryAccent(e.category) }}>
                      waiting on a cover
                    </span>
                  </div>
                )}
                <div className="absolute inset-0" style={{ background: PHOTO_SCRIM }} />
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
