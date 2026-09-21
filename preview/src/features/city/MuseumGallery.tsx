// ---------------------------------------------------------------------------
// MUSEUM GALLERY — swiping inventory, not a feed. A horizontal snap-scroll of
// real published events: one card at a time, the next peeking, every swipe
// landing cleanly. The dots say how many there are, so browsing is finite.
//
// Rules held here:
//   * every event is a REAL published campaign row from /api/events — nothing
//     is seeded to fill the case;
//   * no control row. This shelf used to carry a filter chip ("All exhibits",
//     then "All events") and a drawer of wing/place/date filters. The chip was
//     the third navigation for the events the board and Home already point at,
//     and the reorg deleted it: the case is everything published, soonest
//     first, and a reader who wants a narrower view goes to the board, where
//     the filters sit beside what they filter. Decision 6 removed the featured
//     toggle and the popularity sort for the same reason: a control the server
//     no longer has would visibly do nothing;
//   * no result counter — if you can see the exhibits, you can count them;
//   * the active card is the only one with an action;
//   * the case refreshes when the tab comes back to the foreground, and a card
//     is only marked "New" when the row genuinely appeared since you last
//     looked. No "LIVE" claim: this is a snapshot on read, not a stream;
//   * an empty case says so plainly.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useRef, useState } from "react";
import * as briefApi from "../../api/briefApi";
import type { EventListing } from "../../api/briefApi";
import { MuseumCard } from "./MuseumCard";
import {
  daysSince,
  lastSeenSlugs,
  noteOpened,
  openedAt,
  rememberSeenSlugs
} from "./viewMemory";

export function MuseumGallery({ className = "" }: { className?: string }) {
  const [events, setEvents] = useState<EventListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [newSlugs, setNewSlugs] = useState<string[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setError(null);
    // The whole case: no category, no place, no window. The order is the
    // server's one order — startsAt ascending.
    const res = await briefApi.browseEvents({ limit: 50 });
    if (!res.ok) {
      if (!quiet) {
        setEvents([]);
        setError(res.error);
      }
      return;
    }
    const rows = res.data.events;
    // "New" is only ever a real diff: a row this device had not seen before.
    const seen = lastSeenSlugs();
    if (seen.length > 0) {
      const fresh = rows.map((r) => r.slug).filter((s) => !seen.includes(s));
      if (fresh.length > 0) setNewSlugs((prev) => [...new Set([...prev, ...fresh])]);
    }
    rememberSeenSlugs(rows.map((r) => r.slug));
    setEvents(rows);
    setError(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Back to the tab -> re-read the ledger. A refresh on return, not a stream.
  useEffect(() => {
    const onVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') void load(true);
    };
    if (typeof window === 'undefined') return;
    window.addEventListener('focus', onVisible);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  // Which card is centred -> drives the dots and the active scaling.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const cards = el.querySelectorAll("article");
      const first = cards[0];
      if (!first) return;
      const step = first.clientWidth + 12; // gap-3 = 12px
      const index = Math.round(el.scrollLeft / step);
      setActiveIndex(Math.max(0, Math.min(index, cards.length - 1)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [events]);

  const open = (slug: string) => {
    noteOpened(slug); // a real local record: this device opened this
    if (typeof window !== "undefined") window.open(`/c/${slug}`, "_self");
  };

  const rows = events ?? [];

  return (
    <div className={className}>
      {error && <p className="text-xs" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {events === null && !error && (
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      )}
      {events !== null && rows.length === 0 && !error && (
        <div className="p-5 rounded-3xl border border-dashed" style={{ borderColor: 'var(--brief-line)', background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-1)' }}>
          <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
            Nothing is published yet.
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            When an event goes live around you, it appears here.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="relative">
          <div
            ref={scrollerRef}
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar px-[22.5vw] pb-4"
            style={{ scrollPaddingLeft: "22.5vw", scrollPaddingRight: "22.5vw" }}
          >
            {rows.map((e, i) => (
              <MuseumCard
                key={e.slug}
                event={e}
                isActive={i === activeIndex}
                onOpen={open}
                isNew={newSlugs.includes(e.slug)}
                openedAgoDays={daysSince(openedAt(e.slug))}
              />
            ))}
          </div>

          {/* Position dots — the finite case, so it reads as inventory */}
          <div className="flex justify-center gap-1.5 mt-1">
            {rows.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === activeIndex ? "w-6" : "w-1.5"}`}
                style={{ background: i === activeIndex ? "var(--color-primary)" : "var(--brief-line)" }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MuseumGallery;
