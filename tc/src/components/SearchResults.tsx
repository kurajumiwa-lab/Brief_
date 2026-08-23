import React from 'react';
import * as briefApi from '../api/briefApi';

// ---------------------------------------------------------------------------
// SEARCH RESULTS — title-first results for the home surface.
// ---------------------------------------------------------------------------

interface Results {
  counts: { objects: number; tea: number; vendors: number; collections: number };
  objects: any[];
  tea: any[];
  vendors: any[];
  collections: any[];
}

function ResultRow({ title, image, onClick }: { title: string; image?: string | null; onClick?: () => void }) {
  const content = (
    <>
      {image && <img src={image} alt="" aria-hidden="true" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl object-cover" />}
      <h3 className="min-w-0 flex-1 truncate px-1 text-[14px] font-semibold text-[#F3F1E7]">{title}</h3>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={title}
        className="flex w-full items-center gap-3 rounded-2xl border border-[#232A38] bg-[#10141C] p-2 text-left transition-colors hover:border-[#43D17A]"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex w-full items-center gap-3 rounded-2xl border border-[#232A38] bg-[#10141C] p-2 text-left">
      {content}
    </div>
  );
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
  if (loading) return <div className="h-16 animate-pulse rounded-2xl bg-[#10141C]" aria-label="Searching" />;
  if (!results) return null;

  const total = results.counts.objects + results.counts.tea + results.counts.vendors + results.counts.collections;
  if (total === 0) return null;

  return (
    <section className="mx-auto mb-6 max-w-5xl space-y-2">
      <h2 className="px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#8A93A6]">Results</h2>
      {results.objects.slice(0, 6).map((object) => (
        <ResultRow
          key={object.id}
          title={object.title}
          image={object.imageUrl ?? object.media?.url}
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
