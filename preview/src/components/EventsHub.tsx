import React from 'react';
import * as briefApi from '../api/briefApi';
import type { EventListing } from '../api/briefApi';
import { EventCard } from './events/EventCard';
import { FilterSheet } from '../ui/FilterSheet';
import { SlidersHorizontal, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// EVENTS HUB (Tikiti T4) — one browse surface over everything that is
// actually happening: popups, sessions, drops, events, causes.
//
// Everything here is a real published campaign row from /api/events:
//   * category chips are the server's own five, labels and all,
//   * popularity is COUNTED registrations (a number the server derived),
//   * "Featured" is the organiser's explicit choice, never a ranking,
//   * a card opens the event's public page by SLUG — internal ids stay
//     private, and there is no sixth destination to visit.
// An empty result says so plainly; nothing is seeded to fill the screen.
//
// The reformation: the four-row filter panel (a location box, two untouched
// date boxes, two toggles and a result counter) is now ONE line plus a bottom
// sheet. Untouched inputs read as broken, and "N shown" is metadata nobody
// asked for — if you can see the cards, you can count them.
// ---------------------------------------------------------------------------

const categories = ['popup', 'session', 'drop', 'event', 'contribution'];

interface FilterState {
  location: string;
  from: string;
  to: string;
  featured: boolean;
  sort: 'date' | 'popularity';
}

const EMPTY: FilterState = { location: '', from: '', to: '', featured: false, sort: 'date' };

export function EventsHub() {
  const [rows, setRows] = React.useState<EventListing[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<string | null>(null);
  const [labels, setLabels] = React.useState<Record<string, string>>({});
  const [filters, setFilters] = React.useState<FilterState>(EMPTY);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    void briefApi.getEventCategories().then((res) => {
      if (res.ok) setLabels(res.data.labels);
    });
  }, []);

  const load = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    const res = await briefApi.browseEvents({
      category: category ?? undefined,
      location: filters.location.trim() || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      featured: filters.featured || undefined,
      sort: filters.sort,
      limit: 50
    });
    setBusy(false);
    if (res.ok) {
      setRows(res.data.events);
    } else {
      setRows([]);
      setError(res.error);
    }
  }, [category, filters]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const open = (slug: string) => {
    if (typeof window !== 'undefined') window.open(`/c/${slug}`, '_self');
  };

  const activeCount = [
    category,
    filters.location.trim(),
    filters.from,
    filters.to,
    filters.featured ? 'featured' : null,
    filters.sort === 'popularity' ? 'popularity' : null
  ].filter(Boolean).length;

  const summary = [
    category ? (labels[category] ?? category) : 'Everything',
    filters.location.trim() ? `near ${filters.location.trim()}` : null,
    filters.from || filters.to ? `${filters.from || '…'} → ${filters.to || '…'}` : null,
    filters.featured ? 'featured only' : null,
    filters.sort === 'popularity' ? 'most people first' : null
  ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold truncate" style={{ color: 'var(--color-text)' }}>
            What&rsquo;s on
          </h2>
          <p className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
            Popularity is counted people, never a seeded number.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-expanded={sheetOpen}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold cursor-pointer border"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-text)',
            background: activeCount > 0 ? 'var(--color-primary-subtle)' : 'var(--color-paper)'
          }}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters{activeCount > 0 ? ` · ${activeCount}` : ''}
        </button>
      </div>

      {/* ONE line: what you're looking at, and a way to clear it. */}
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-[12px] font-bold truncate" style={{ color: 'var(--color-text-muted)' }}>
          {summary}
        </p>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => { setCategory(null); setFilters(EMPTY); }}
            className="shrink-0 inline-flex items-center gap-1 text-[12px] font-bold cursor-pointer"
            style={{ color: 'var(--color-primary)' }}
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {error && <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>}
      {busy && rows === null && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Loading…</p>}
      {rows !== null && rows.length === 0 && !error && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {activeCount > 0
            ? 'Nothing matches. Widen the window or clear a filter — an honest empty beat a filled screen.'
            : 'Nothing is published yet. When an event goes live around you, it shows up here.'}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(rows ?? []).map((e) => (
          <EventCard key={e.slug} event={e} onOpen={open} />
        ))}
      </div>

      <FilterSheet open={sheetOpen} title="Filter what's on" onClose={() => setSheetOpen(false)}>
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Category
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[null, ...categories].map((c) => {
              const active = category === c;
              return (
                <button
                  key={c ?? 'all'}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(active ? null : c)}
                  className="px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer border"
                  style={{
                    background: active ? 'var(--color-primary)' : 'var(--color-paper)',
                    color: active ? 'var(--accent-ink)' : 'var(--color-text-muted)',
                    borderColor: active ? 'transparent' : 'var(--color-border)'
                  }}
                >
                  {c === null ? 'Everything' : labels[c] ?? c}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="eh-loc" className="block text-[11px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Place (optional)
          </label>
          <input
            id="eh-loc"
            value={filters.location}
            onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
            placeholder="e.g. Kisii"
            className="w-full px-3.5 py-2.5 rounded-xl text-xs border"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
              From
            </p>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              className="w-full px-2.5 py-2.5 rounded-xl text-xs border"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
              To
            </p>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              className="w-full px-2.5 py-2.5 rounded-xl text-xs border"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
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
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            Sort: {filters.sort === 'date' ? 'soonest first' : 'most people first'}
          </button>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => { setCategory(null); setFilters(EMPTY); }}
            className="flex-1 py-2.5 rounded-2xl text-xs font-bold cursor-pointer border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            className="flex-1 py-2.5 rounded-2xl text-xs font-black cursor-pointer"
            style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
          >
            Show
          </button>
        </div>
      </FilterSheet>
    </div>
  );
}

export default EventsHub;
