import React from 'react';
import * as briefApi from '../api/briefApi';
import type { SearchFilters } from '../api/briefApi';

// ---------------------------------------------------------------------------
// SEARCH RESULTS — title-first results for the home surface, with filters
// that map to fields the server already stores (type, location, date, source).
// ---------------------------------------------------------------------------

interface Results {
  counts: { objects: number; tea: number; vendors: number; collections: number };
  objects: any[];
  tea: any[];
  vendors: any[];
  collections: any[];
}

const T = { muted: 'rgba(37,16,69,0.62)', ink: '#251045', line: '#D6CFE4', surface: '#FBFAFD' };

const TYPE_OPTIONS = [
  ['', 'All types'],
  ['event', 'Events'],
  ['offer', 'Offers'],
  ['alert', 'Alerts'],
  ['announcement', 'Notices'],
  ['news', 'News'],
  ['business', 'Businesses'],
  ['opportunity', 'Opportunities'],
  ['place', 'Places'],
  ['service', 'Services'],
  ['product', 'Products'],
  ['knowledge', 'Guides']
];

function metaLine(object: any): string | null {
  const bits: string[] = [];
  if (object?.type) bits.push(String(object.type));
  const t = object?.temporal;
  if (t?.status === 'upcoming' && typeof t.startsAt === 'string') {
    const d = new Date(t.startsAt);
    if (Number.isFinite(d.getTime())) bits.push(`On ${d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}`);
  } else if (t?.status === 'active' && typeof t.deadlineAt === 'string') {
    const d = new Date(t.deadlineAt);
    if (Number.isFinite(d.getTime())) bits.push(`Closes ${d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}`);
  } else if (t?.status === 'happening') {
    bits.push('Happening now');
  }
  if (object?.locationName) bits.push(String(object.locationName));
  else if (object?.metadata?.area) bits.push(String(object.metadata.area));
  else if (object?.metadata?.county) bits.push(String(object.metadata.county));
  return bits.length ? bits.join(' · ') : null;
}

function sourceLine(object: any): string | null {
  const names = Array.isArray(object?.sourceNames) ? object.sourceNames.filter((s: unknown) => typeof s === 'string') : [];
  if (names.length) {
    const extra = typeof object?.sourceCount === 'number' && object.sourceCount > names.length
      ? ` +${object.sourceCount - names.length}`
      : '';
    return `${names[0]}${extra}`;
  }
  return null;
}

function ResultRow({ title, image, meta, source, onClick }: {
  title: string;
  image?: string | null;
  meta?: string | null;
  source?: string | null;
  onClick?: () => void;
}) {
  const content = (
    <>
      {image && <img src={image} alt="" aria-hidden="true" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl object-cover" />}
      <span className="min-w-0 flex-1 px-1">
        <h3 className="truncate text-[14px] font-semibold" style={{ color: T.ink }}>{title}</h3>
        {meta && <p className="mt-0.5 truncate text-[10px] font-semibold" style={{ color: T.muted }}>{meta}</p>}
        {source && <p className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ color: T.muted }}>{source}</p>}
      </span>
    </>
  );

  const cls = `flex w-full items-center gap-3 rounded-2xl border p-2 text-left transition-colors ${onClick ? 'hover:border-[#6C3EC9]' : ''}`;
  const style = { borderColor: T.line, background: T.surface };

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={title} className={`${cls} cursor-pointer`} style={style}>
        {content}
      </button>
    );
  }
  return (
    <div className={cls} style={style}>
      {content}
    </div>
  );
}

export function SearchResults({ query, onOpenObject }: { query: string; onOpenObject: (o: any) => void }) {
  const [results, setResults] = React.useState<Results | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [filters, setFilters] = React.useState<SearchFilters>({});

  React.useEffect(() => {
    if (!query.trim() && !filters.type && !filters.location && !filters.date && !filters.source) {
      setResults(null);
      return;
    }
    let live = true;
    setLoading(true);
    (async () => {
      const res = await briefApi.searchAll(query, filters);
      if (!live) return;
      setLoading(false);
      setResults(res.ok ? (res.data as Results) : null);
    })();
    return () => { live = false; };
  }, [query, filters]);

  const hasAnyQuery = Boolean(query.trim() || filters.type || filters.location || filters.date || filters.source);
  if (!hasAnyQuery) return null;
  if (loading) return <div className="h-16 animate-pulse rounded-2xl bg-[#FBFAFD]" aria-label="Searching" />;
  if (!results) return null;

  const total = results.counts.objects + results.counts.tea + results.counts.vendors + results.counts.collections;
  if (total === 0) return null;

  const setFilter = (key: keyof SearchFilters, value: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };

  return (
    <section className="mx-auto mb-6 max-w-5xl space-y-2">
      <h2 className="px-1 text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: T.muted }}>Results</h2>
      {/* Filters: existing fields only — type, location, date, source. */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <select
          aria-label="Filter by type"
          value={filters.type ?? ''}
          onChange={(e) => setFilter('type', e.target.value)}
          className="rounded-full border px-3 py-1.5 text-[12px] font-semibold"
          style={{ borderColor: T.line, background: T.surface, color: T.ink }}
        >
          {TYPE_OPTIONS.map(([value, label]) => (
            <option key={value || 'all'} value={value}>{label}</option>
          ))}
        </select>
        <input
          aria-label="Filter by location"
          placeholder="Location (e.g. Kisumu)"
          value={filters.location ?? ''}
          onChange={(e) => setFilter('location', e.target.value)}
          className="w-40 rounded-full border px-3 py-1.5 text-[12px] font-semibold outline-none focus:border-[#6C3EC9]"
          style={{ borderColor: T.line, background: T.surface, color: T.ink }}
        />
        <input
          aria-label="Filter by date"
          type="date"
          value={filters.date ?? ''}
          onChange={(e) => setFilter('date', e.target.value)}
          className="rounded-full border px-3 py-1.5 text-[12px] font-semibold"
          style={{ borderColor: T.line, background: T.surface, color: T.ink }}
        />
        {(filters.type || filters.location || filters.date || filters.source) && (
          <button
            type="button"
            onClick={() => setFilters({})}
            className="rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors hover:border-[#6C3EC9]"
            style={{ borderColor: T.line, background: T.surface, color: T.ink }}
          >
            Clear filters
          </button>
        )}
      </div>
      {results.objects.slice(0, 8).map((object) => (
        <ResultRow
          key={object.id}
          title={object.title}
          image={object.imageUrl ?? object.media?.url}
          meta={metaLine(object)}
          source={sourceLine(object)}
          onClick={() => onOpenObject(object)}
        />
      ))}
      {results.tea.slice(0, 3).map((article) => (
        <ResultRow key={article.id} title={article.title} image={article.heroImage} />
      ))}
      {results.vendors.slice(0, 3).map((vendor) => (
        <ResultRow key={vendor.id} title={vendor.name} image={vendor.imageUrl} />
      ))}
      {results.collections.slice(0, 3).map((collection) => (
        <ResultRow key={collection.id} title={collection.title} image={collection.imageUrl} />
      ))}
    </section>
  );
}

export default SearchResults;
