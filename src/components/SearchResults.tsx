import React from 'react';
import * as briefApi from '../api/briefApi';

// ---------------------------------------------------------------------------
// SEARCH RESULTS — cross-entity results (objects + Tea + vendors + collections)
//
// Renders the typed results of /api/search. Objects open the detail view;
// Tea/vendors/collections are honest and typed (Tea read-only until the reader
// page ships; vendors and collections are labelled). No fabricated hits.
// ---------------------------------------------------------------------------

interface Results {
  counts: { objects: number; tea: number; vendors: number; collections: number };
  objects: any[];
  tea: any[];
  vendors: any[];
  collections: any[];
}

export function SearchResults({ query, onOpenObject }: { query: string; onOpenObject: (o: any) => void }) {
  const [results, setResults] = React.useState<Results | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!query.trim()) { setResults(null); return; }
    let live = true;
    setLoading(true);
    (async () => {
      const res = await briefApi.searchAll(query);
      if (!live) return;
      setLoading(false);
      setResults(res.ok ? (res.data as Results) : null);
    })();
    return () => { live = false; };
  }, [query]);

  if (!query.trim()) return null;
  if (loading) return <p className="text-xs text-[#8A93A6] py-2">Searching…</p>;
  if (!results) return null;

  const total = results.counts.objects + results.counts.tea + results.counts.vendors + results.counts.collections;
  if (total === 0) return null; // the stream's own empty state handles "nothing"

  return (
    <div className="mb-5 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#43D17A]">
        Search results · {total} across {results.counts.objects} things, {results.counts.tea} articles, {results.counts.vendors} vendors, {results.counts.collections} collections
      </p>

      {results.objects.slice(0, 6).map((o) => (
        <button
          key={o.id}
          onClick={() => onOpenObject(o)}
          className="flex w-full items-center gap-3 rounded-xl border border-[#232A38] bg-[#10141C] p-3 text-left cursor-pointer transition hover:border-[#43D17A]"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[9px] uppercase tracking-[0.12em] text-[#4B5162]">{o.category}</p>
            <p className="text-[13px] font-semibold text-[#F3F1E7] line-clamp-1">{o.title}</p>
            {o.locationName && <p className="text-[10px] text-[#8A93A6] truncate">{o.locationName}</p>}
          </div>
        </button>
      ))}

      {results.tea.slice(0, 3).map((a) => (
        <div key={a.id} className="rounded-xl border border-[#232A38] bg-[#10141C] p-3">
          <p className="text-[9px] uppercase tracking-[0.12em] text-[#4B5162]">Tea · {a.category}</p>
          <p className="text-[13px] font-semibold text-[#F3F1E7]">{a.title}</p>
          <p className="text-[10px] text-[#4B5162]">{a.readingTime} min read</p>
        </div>
      ))}

      {results.vendors.slice(0, 3).map((v) => (
        <div key={v.id} className="rounded-xl border border-[#232A38] bg-[#10141C] p-3">
          <p className="text-[9px] uppercase tracking-[0.12em] text-[#4B5162]">Vendor</p>
          <p className="text-[13px] font-semibold text-[#F3F1E7]">{v.name}</p>
        </div>
      ))}

      {results.collections.slice(0, 3).map((c) => (
        <div key={c.id} className="rounded-xl border border-[#232A38] bg-[#10141C] p-3">
          <p className="text-[9px] uppercase tracking-[0.12em] text-[#4B5162]">Collection</p>
          <p className="text-[13px] font-semibold text-[#F3F1E7]">{c.title}</p>
        </div>
      ))}
    </div>
  );
}

export default SearchResults;
