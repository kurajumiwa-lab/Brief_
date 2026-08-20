import React from 'react';
import * as briefApi from '../api/briefApi';

// ---------------------------------------------------------------------------
// TEA SECTION — the editorial layer on the home feed.
//
// Renders real published Tea articles from /api/tea (ranked server-side).
// Editorial, not a card dump: one featured piece + a compact list. When there
// is nothing, it says so plainly — never a hardcoded article.
// ---------------------------------------------------------------------------

interface TeaArticle {
  id: string;
  slug: string;
  title: string;
  dek: string;
  category: string;
  location: string | null;
  readingTime: number;
}

export function TeaSection() {
  const [state, setState] = React.useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    tea: TeaArticle[];
  }>({ status: 'idle', tea: [] });

  React.useEffect(() => {
    let live = true;
    (async () => {
      setState((p) => ({ ...p, status: 'loading' }));
      const res = await briefApi.getTea({ limit: 6 });
      if (!live) return;
      if (res.ok) setState({ status: 'ready', tea: res.data as TeaArticle[] });
      else setState({ status: 'ready', tea: [] }); // honest empty, not an error wall
    })();
    return () => { live = false; };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="rounded-2xl border border-[#232A38] bg-[#10141C] p-4 animate-pulse">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#43D17A]">Today's Tea</p>
        <div className="mt-3 h-16 rounded-xl bg-[#090B10]" />
      </div>
    );
  }

  if (state.tea.length === 0) {
    return (
      <div className="rounded-2xl border border-[#232A38] bg-[#10141C] p-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#43D17A]">Today's Tea</p>
        <p className="mt-2 text-[13px] text-[#8A93A6]">Tea is brewing. Check back soon.</p>
      </div>
    );
  }

  const [featured, ...rest] = state.tea;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#43D17A]">
          Today's Tea
        </h2>
        <span className="text-[10px] text-[#4B5162]">What the city is talking about</span>
      </div>

      {/* Featured editorial card */}
      <div className="overflow-hidden rounded-2xl border border-[#232A38] bg-[#10141C]">
        <div className="p-4">
          <p className="text-[9px] uppercase tracking-[0.15em] text-[#4B5162]">
            {featured.location ?? 'Your city'} · {featured.category}
          </p>
          <h3 className="mt-2 text-[18px] font-bold leading-snug text-[#F3F1E7]">
            {featured.title}
          </h3>
          {featured.dek && (
            <p className="mt-2 text-[12px] leading-relaxed text-[#8A93A6]">{featured.dek}</p>
          )}
          <p className="mt-3 text-[10px] text-[#4B5162]">
            {featured.readingTime} min read · Today
          </p>
        </div>
      </div>

      {/* Supporting articles */}
      {rest.slice(0, 3).map((a) => (
        <div key={a.id} className="flex items-center gap-3 rounded-xl border border-[#232A38] bg-[#10141C] p-3">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] uppercase tracking-[0.12em] text-[#4B5162]">{a.category}</p>
            <p className="mt-1 text-[13px] font-semibold leading-snug text-[#F3F1E7]">{a.title}</p>
          </div>
          <span className="shrink-0 text-[10px] text-[#4B5162]">{a.readingTime}m</span>
        </div>
      ))}
    </section>
  );
}

export default TeaSection;
