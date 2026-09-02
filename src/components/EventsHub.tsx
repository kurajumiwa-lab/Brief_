import React from 'react';
import * as briefApi from '../api/briefApi';
import type { EventListing } from '../api/briefApi';

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
// ---------------------------------------------------------------------------

const money = (n: number, c: string) => (n === 0 ? 'Free' : `${c} ${n.toLocaleString()}`);


export function EventsHub() {
  const [rows, setRows] = React.useState<EventListing[] | null>(null);
  const [total, setTotal] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<string | null>(null);
  const [labels, setLabels] = React.useState<Record<string, string>>({});
  const [location, setLocation] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [featuredOnly, setFeaturedOnly] = React.useState(false);
  const [sort, setSort] = React.useState<'date' | 'popularity'>('date');
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
      location: location.trim() || undefined,
      from: from || undefined,
      to: to || undefined,
      featured: featuredOnly || undefined,
      sort,
      limit: 50
    });
    setBusy(false);
    if (res.ok) {
      setRows(res.data.events);
      setTotal(res.data.total);
    } else {
      setRows([]);
      setError(res.error);
    }
  }, [category, location, from, to, featuredOnly, sort]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const open = (slug: string) => {
    if (typeof window !== 'undefined') window.open(`/c/${slug}`, '_self');
  };

  const categories = ['popup', 'session', 'drop', 'event', 'contribution'];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-[#0D1117]">What's on</h2>
        <p className="text-[10px] text-[#0D1117]/60 leading-snug">
          Everything published around you — popups, sessions, drops, events and causes.
          Popularity is counted people, never a seeded number.
        </p>
      </div>

      {/* category chips — the server's five, nothing invented */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setCategory(null)}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer border ${
            category === null ? 'bg-[#FF5A1F] text-[#0D1117] border-[#2563EB]' : 'bg-[#FFFFFF] text-[#0D1117]/70 border-[#E5E8EC]'
          }`}
        >
          Everything
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(category === c ? null : c)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer border ${
              category === c ? 'bg-[#FF5A1F] text-[#0D1117] border-[#2563EB]' : 'bg-[#FFFFFF] text-[#0D1117]/70 border-[#E5E8EC]'
            }`}
          >
            {labels[c] ?? c}
          </button>
        ))}
      </div>

      {/* filters */}
      <div className="rounded-2xl border border-[#E5E8EC] bg-[#FFFFFF] p-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Near (location)"
            aria-label="location filter"
            className="min-w-[140px] flex-1 rounded-lg border border-[#E5E8EC] bg-[#F0F2F5] px-3 py-2 text-[12px] text-[#0D1117]"
          />
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="from date"
            className="rounded-lg border border-[#E5E8EC] bg-[#F0F2F5] px-2.5 py-2 text-[12px] text-[#0D1117]"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="to date"
            className="rounded-lg border border-[#E5E8EC] bg-[#F0F2F5] px-2.5 py-2 text-[12px] text-[#0D1117]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFeaturedOnly((v) => !v)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer border ${
              featuredOnly ? 'bg-[#FF5A1F] text-[#0D1117] border-[#2563EB]' : 'bg-[#FFFFFF] text-[#0D1117]/70 border-[#E5E8EC]'
            }`}
          >
            ★ Featured only
          </button>
          <button
            onClick={() => setSort(sort === 'date' ? 'popularity' : 'date')}
            className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold border border-[#E5E8EC] bg-[#FFFFFF] text-[#0D1117] cursor-pointer"
          >
            Sort: {sort === 'date' ? 'soonest first' : 'most people first'}
          </button>
          <span className="ml-auto text-[10px] text-[#0D1117]/60">
            {rows === null ? '' : `${rows.length} shown${total > rows.length ? ` of ${total}` : ''}`}
          </span>
        </div>
      </div>

      {error && <p className="text-xs text-[#0D1117]">{error}</p>}
      {busy && rows === null && <p className="text-xs text-[#0D1117]/60">Loading…</p>}
      {rows !== null && rows.length === 0 && !error && (
        <p className="text-xs text-[#0D1117]/60">
          Nothing matches. Widen the window or clear a filter — an honest empty
          beat a filled screen.
        </p>
      )}

      <div className="space-y-2">
        {(rows ?? []).map((e) => (
          <button
            key={e.slug}
            onClick={() => open(e.slug)}
            className="w-full text-left bg-[#FFFFFF] border border-[#E5E8EC] rounded-2xl p-3.5 space-y-1.5 cursor-pointer hover:border-[#2563EB]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#0D1117]/60">
                  {e.categoryLabel}
                </p>
                <p className="text-sm font-extrabold text-[#0D1117] truncate">{e.title}</p>
              </div>
              {e.featured && (
                <span className="shrink-0 text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[#FF5A1F] text-[#0D1117]">
                  ★ Featured
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-[#0D1117]/60">
              {e.startsAt && <span>{e.startsAt.slice(0, 10)}</span>}
              {e.location && <span className="truncate">{e.location}</span>}
              <span>{e.goalAmount != null ? 'Cause / pot' : money(e.price, e.currency)}</span>
              <span>{e.popularity} going</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default EventsHub;
