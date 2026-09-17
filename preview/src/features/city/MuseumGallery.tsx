// ---------------------------------------------------------------------------
// MUSEUM GALLERY — swiping inventory, not a feed. A horizontal snap-scroll of
// real published events: one card at a time, the next peeking, every swipe
// landing cleanly. The dots say how many there are, so browsing is finite.
//
// Rules held here:
//   * every event is a REAL published campaign row from /api/events — nothing
//     is seeded to fill the case;
//   * the control row is ONE line. The deep filters (wing, place, window,
//     featured, sort) live in a bottom sheet, because a filter is not content
//     and an untouched pair of date boxes reads as broken, not empty;
//   * no result counter — if you can see the exhibits, you can count them;
//   * the active card is the only one with an action;
//   * the case refreshes when the tab comes back to the foreground, and a card
//     is only marked "New" when the row genuinely appeared since you last
//     looked. No "LIVE" claim: this is a snapshot on read, not a stream;
//   * an empty case says so plainly.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import * as briefApi from "../../api/briefApi";
import type { EventListing } from "../../api/briefApi";
import { MuseumCard } from "./MuseumCard";
import { FilterSheet } from "../../ui/FilterSheet";
import { soundEngine } from "../../utils/SoundEngine";
import {
  daysSince,
  lastSeenSlugs,
  noteOpened,
  openedAt,
  rememberSeenSlugs
} from "./viewMemory";

export interface MuseumFilters {
  category: string | null;
  location: string;
  from: string;
  to: string;
  featured: boolean;
  sort: 'date' | 'popularity';
}

const EMPTY: MuseumFilters = {
  category: null,
  location: '',
  from: '',
  to: '',
  featured: false,
  sort: 'date'
};

const CATEGORIES = ["popup", "session", "drop", "event", "contribution"];

export function MuseumGallery({ className = "" }: { className?: string }) {
  const [events, setEvents] = useState<EventListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MuseumFilters>(EMPTY);
  const [applied, setApplied] = useState<MuseumFilters>(EMPTY);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newSlugs, setNewSlugs] = useState<string[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void briefApi.getEventCategories().then((r) => {
      if (r.ok) setLabels(r.data.labels);
    });
  }, []);

  const load = useCallback(async (f: MuseumFilters, quiet = false) => {
    if (!quiet) setError(null);
    const res = await briefApi.browseEvents({
      category: f.category ?? undefined,
      location: f.location.trim() || undefined,
      from: f.from || undefined,
      to: f.to || undefined,
      featured: f.featured || undefined,
      sort: f.sort,
      limit: 50
    });
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
    void load(applied);
  }, [applied, load]);

  // Back to the tab -> re-read the ledger. A refresh on return, not a stream.
  useEffect(() => {
    const onVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') void load(applied, true);
    };
    if (typeof window === 'undefined') return;
    window.addEventListener('focus', onVisible);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    };
  }, [applied, load]);

  // A filter change starts the case over at the first exhibit.
  useEffect(() => {
    setActiveIndex(0);
  }, [applied]);

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
  const activeCount = useMemo(
    () =>
      [
        filters.category,
        filters.location.trim(),
        filters.from,
        filters.to,
        filters.featured ? 'featured' : null
      ].filter(Boolean).length,
    [filters]
  );

  const wingLabel = filters.category
    ? labels[filters.category] ?? filters.category
    : 'All exhibits';

  const summaryParts = [
    wingLabel,
    filters.location.trim() ? `near ${filters.location.trim()}` : null,
    filters.from || filters.to
      ? `${filters.from || '…'} → ${filters.to || '…'}`
      : null,
    filters.featured ? 'featured only' : null,
    filters.sort === 'popularity' ? 'most people first' : null
  ].filter(Boolean) as string[];

  return (
    <div className={className}>
      {/* ONE control line: what you are looking at, and a drawer for the rest. */}
      <div className="flex items-center gap-2 pb-2">
        <button
          type="button"
          onClick={() => { soundEngine.play('tap'); setFilters(applied); setSheetOpen(true); }}
          className="flex min-w-0 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer border"
          style={{
            background: activeCount > 0 ? 'var(--color-primary)' : 'var(--color-surface)',
            color: activeCount > 0 ? 'var(--accent-ink)' : 'var(--color-text)',
            borderColor: activeCount > 0 ? 'transparent' : 'var(--brief-line)'
          }}
        >
          <span className="truncate">{summaryParts.join(' · ')}</span>
          <span aria-hidden="true">▾</span>
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => { setFilters(EMPTY); setApplied(EMPTY); }}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold cursor-pointer"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
        <span className="ml-auto shrink-0 text-[10px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
          swipe
        </span>
      </div>

      {error && <p className="text-xs" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {events === null && !error && (
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      )}
      {events !== null && rows.length === 0 && !error && (
        <div className="p-5 rounded-3xl border border-dashed" style={{ borderColor: 'var(--brief-line)', background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-1)' }}>
          <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
            {activeCount > 0 ? 'Nothing matches this filter.' : 'Nothing is published yet.'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {activeCount > 0
              ? 'Widen the window or clear a filter — an honest empty beats a filled screen.'
              : 'When an event goes live around you, it appears in the case here.'}
          </p>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => { setFilters(EMPTY); setApplied(EMPTY); }}
              className="mt-3 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer"
              style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
            >
              Clear the filters
            </button>
          )}
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

      <FilterSheet
        open={sheetOpen}
        title="Filter the case"
        onClose={() => setSheetOpen(false)}
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setFilters(EMPTY); setApplied(EMPTY); setSheetOpen(false); }}
              className="flex-1 py-2.5 rounded-2xl text-xs font-bold cursor-pointer border"
              style={{ borderColor: 'var(--brief-line)', color: 'var(--color-text-muted)', boxShadow: 'var(--room-light-dim)' }}
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={() => { soundEngine.play('tap'); setApplied(filters); setSheetOpen(false); }}
              className="flex-1 py-2.5 rounded-2xl text-xs font-black cursor-pointer"
              style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
            >
              Show
            </button>
          </div>
        }
      >
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Wing
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[null, ...CATEGORIES].map((c) => {
              const active = filters.category === c;
              return (
                <button
                  key={c ?? 'all'}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilters((f) => ({ ...f, category: active ? null : c }))}
                  className="px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer border"
                  style={{
                    background: active ? 'var(--color-primary)' : 'var(--color-paper)',
                    color: active ? 'var(--accent-ink)' : 'var(--color-text-muted)',
                    borderColor: active ? 'transparent' : 'var(--brief-line)'
                  }}
                >
                  {c === null ? 'Everything' : labels[c] ?? c}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label
            htmlFor="museum-loc"
            className="block text-[10px] font-black uppercase tracking-wider mb-2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Place (optional)
          </label>
          <input
            id="museum-loc"
            type="text"
            value={filters.location}
            onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
            placeholder="e.g. Kilimani"
            className="w-full px-3.5 py-2.5 rounded-xl text-xs border"
            style={{ background: 'var(--color-well)', borderColor: 'var(--brief-line)' }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
              From
            </p>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              className="w-full px-2.5 py-2.5 rounded-xl text-xs border"
              style={{ background: 'var(--color-well)', borderColor: 'var(--brief-line)' }}
            />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
              To
            </p>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              className="w-full px-2.5 py-2.5 rounded-xl text-xs border"
              style={{ background: 'var(--color-well)', borderColor: 'var(--brief-line)' }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={filters.featured}
            onClick={() => setFilters((f) => ({ ...f, featured: !f.featured }))}
            className="px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer border"
            style={{
              background: filters.featured ? 'var(--color-primary)' : 'var(--color-paper)',
              color: filters.featured ? 'var(--accent-ink)' : 'var(--color-text-muted)',
              borderColor: filters.featured ? 'transparent' : 'var(--color-border)'
            }}
          >
            ★ Featured only
          </button>
          <button
            type="button"
            onClick={() => setFilters((f) => ({ ...f, sort: f.sort === 'date' ? 'popularity' : 'date' }))}
            className="px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer border"
            style={{ borderColor: 'var(--brief-line)', color: 'var(--color-text)' }}
          >
            Sort: {filters.sort === 'date' ? 'soonest first' : 'most people first'}
          </button>
        </div>
      </FilterSheet>
    </div>
  );
}

export default MuseumGallery;
