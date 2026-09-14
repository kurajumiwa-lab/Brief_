// ---------------------------------------------------------------------------
// MUSEUM GALLERY — swiping inventory, not a feed. A horizontal snap-scroll of
// real published events: one card at a time, the next peeking, each swipe
// landing cleanly. Position dots show how many are left — browsing is a finite,
// deliberate act, not an infinite scroll.
//
// Rules held here:
//   * every event is a REAL published campaign row from /api/events — nothing
//     is seeded to fill the case;
//   * the category "wing" filter above is the server's own five, labels and all;
//   * the active card is the only one with an action (the exhibit gets the
//     price tag, previews don't);
//   * an empty case says so plainly — an honest empty beats a filled screen.
// ---------------------------------------------------------------------------

import React, { useEffect, useRef, useState } from "react";
import * as briefApi from "../../api/briefApi";
import type { EventListing } from "../../api/briefApi";
import { MuseumCard } from "./MuseumCard";

export function MuseumGallery({ className = "" }: { className?: string }) {
  const [events, setEvents] = useState<EventListing[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void briefApi.getEventCategories().then((r) => {
      if (r.ok) setLabels(r.data.labels);
    });
  }, []);

  const load = React.useCallback(async () => {
    setError(null);
    const res = await briefApi.browseEvents({
      category: category ?? undefined,
      sort: "date",
      limit: 50
    });
    if (res.ok) {
      setEvents(res.data.events);
      setTotal(res.data.total);
    } else {
      setEvents([]);
      setError(res.error);
    }
  }, [category]);

  useEffect(() => {
    void load();
  }, [load]);

  // A filter change starts the case over at the first exhibit.
  useEffect(() => {
    setActiveIndex(0);
  }, [category]);

  // Track which card is centered -> drives the dots + active scaling.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const cards = el.querySelectorAll("article");
      const first = cards[0];
      if (!first) return;
      // step = card width + the gap (gap-3 = 12px)
      const step = first.clientWidth + 12;
      const index = Math.round(el.scrollLeft / step);
      setActiveIndex(Math.max(0, Math.min(index, cards.length - 1)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [events]);

  const open = (slug: string) => {
    if (typeof window !== "undefined") window.open(`/c/${slug}`, "_self");
  };

  const categories = ["popup", "session", "drop", "event", "contribution"];

  return (
    <div className={className}>
      {/* Wing filter — the category strip stays put above the gallery */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer border transition-all ${
            category === null ? "border-transparent" : "border-[var(--color-border)]"
          }`}
          style={
            category === null
              ? { background: "var(--color-primary)", color: "var(--accent-ink)" }
              : { background: "var(--color-surface)", color: "var(--color-text-muted)" }
          }
        >
          Everything
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(category === c ? null : c)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer border transition-all ${
              category === c ? "border-transparent" : "border-[var(--color-border)]"
            }`}
            style={
              category === c
                ? { background: "var(--color-primary)", color: "var(--accent-ink)" }
                : { background: "var(--color-surface)", color: "var(--color-text-muted)" }
            }
          >
            {labels[c] ?? c}
          </button>
        ))}
      </div>

      {error && <p className="text-xs" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {events === null && !error && (
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      )}
      {events !== null && events.length === 0 && !error && (
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Nothing published yet. When an event goes live around you, it appears in the case here.
        </p>
      )}

      {events !== null && events.length > 0 && (
        <div className="relative">
          {/* Horizontal scroller — snap-mandatory, native momentum, hidden bar */}
          <div
            ref={scrollerRef}
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar px-[22.5vw] pb-4"
            style={{ scrollPaddingLeft: "22.5vw", scrollPaddingRight: "22.5vw" }}
          >
            {events.map((e, i) => (
              <MuseumCard key={e.slug} event={e} isActive={i === activeIndex} onOpen={open} />
            ))}
          </div>

          {/* Position dots — filled for the active exhibit */}
          <div className="flex justify-center gap-1.5 mt-1">
            {events.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === activeIndex ? "w-6" : "w-1.5"}`}
                style={{ background: i === activeIndex ? "var(--color-primary)" : "var(--color-border)" }}
              />
            ))}
          </div>

          {/* Hint — the finite count, so it reads as inventory, not a feed */}
          <p className="text-center text-[11px] mt-2" style={{ color: "var(--color-text-muted)" }}>
            Swipe to browse {events.length}
            {total > events.length ? ` of ${total}` : ""} nearby
          </p>
        </div>
      )}
    </div>
  );
}

export default MuseumGallery;
