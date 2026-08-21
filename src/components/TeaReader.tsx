import React from 'react';
import * as briefApi from '../api/briefApi';

// ---------------------------------------------------------------------------
// TEA READER — the public article page (home-feed §32 "See all").
//
// Renders one published article by slug from GET /api/tea/:slug: title, dek,
// body, source, reading time, category and location. Real editorial content;
// a missing/unpublished slug resolves to an honest not-found state.
// ---------------------------------------------------------------------------

export function TeaReader({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [state, setState] = React.useState<{ status: 'loading' | 'ready' | 'missing'; article: any | null }>({ status: 'loading', article: null });

  React.useEffect(() => {
    let live = true;
    (async () => {
      const res = await briefApi.getTeaArticle(slug);
      if (!live) return;
      if (res.ok) setState({ status: 'ready', article: res.data });
      else setState({ status: 'missing', article: null });
    })();
    return () => { live = false; };
  }, [slug]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#090B10]/95 backdrop-blur-md" onClick={onClose}>
      <div
        className="mx-auto min-h-full max-w-2xl px-4 py-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="mb-4 text-[12px] font-bold text-[#8A93A6] cursor-pointer">← Back</button>

        {state.status === 'loading' && <p className="text-sm text-[#8A93A6]">Loading…</p>}

        {state.status === 'missing' && (
          <div className="rounded-2xl border border-[#232A38] bg-[#10141C] p-5">
            <p className="text-sm font-bold text-[#F3F1E7]">This article is not available.</p>
            <p className="mt-1 text-[12px] text-[#8A93A6]">It may be unpublished, expired, or the link is wrong.</p>
          </div>
        )}

        {state.status === 'ready' && state.article && (() => {
          const a = state.article;
          return (
            <article className="space-y-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#43D17A]">
                {a.location ?? 'Brief'} · {a.category}
              </p>
              <h1 className="font-display text-3xl font-bold leading-tight text-[#F3F1E7]">{a.title}</h1>
              {a.dek && <p className="text-[15px] leading-relaxed text-[#8A93A6]">{a.dek}</p>}
              <div className="flex items-center gap-3 text-[11px] text-[#4B5162]">
                {a.author && <span>{a.author}</span>}
                <span>{a.readingTime} min read</span>
                {a.publishedAt && <span>{new Date(a.publishedAt).toLocaleDateString()}</span>}
              </div>
              <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#E8E3D4]">{a.body}</div>
              {a.source && (
                <p className="border-t border-[#232A38] pt-3 text-[11px] text-[#4B5162]">
                  Source: {a.source}
                  {a.sourceUrl ? ` · ${a.sourceUrl}` : ''}
                </p>
              )}
              {(a.relatedContent?.length > 0 || a.relatedPlaces?.length > 0 || a.relatedEvents?.length > 0) && (
                <div className="rounded-xl border border-[#232A38] bg-[#10141C] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#43D17A]">Related</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {[...(a.relatedPlaces ?? []), ...(a.relatedEvents ?? []), ...(a.relatedContent ?? [])].map((r, i) => (
                      <span key={i} className="rounded-full border border-[#232A38] px-2 py-0.5 text-[10px] text-[#8A93A6]">{r}</span>
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })()}
      </div>
    </div>
  );
}

export default TeaReader;
