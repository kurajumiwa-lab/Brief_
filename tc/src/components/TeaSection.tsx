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
      <div className="rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] p-4 animate-pulse">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#111111]">Today's Stories</p>
        <div className="mt-3 h-16 rounded-xl bg-[#FAFAFA]" />
      </div>
    );
  }

  if (state.tea.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] p-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#111111]">Today's Stories</p>
        <p className="mt-2 text-[13px] text-[#111111]/60">Stories are being written. Check back soon.</p>
      </div>
    );
  }

  const [featured, ...rest] = state.tea;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#111111]">
          Today's Stories
        </h2>
        <span className="text-[10px] text-[#111111]/40">What the city is reading</span>
      </div>

      {/* Featured editorial card */}
      <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF]">
        <div className="p-4">
          <p className="text-[9px] uppercase tracking-[0.15em] text-[#111111]/40">
            {featured.location ?? 'Your city'} · {featured.category}
          </p>
          <h3 className="mt-2 text-[18px] font-bold leading-snug text-[#111111]">
            {featured.title}
          </h3>
          {featured.dek && (
            <p className="mt-2 text-[12px] leading-relaxed text-[#111111]/60">{featured.dek}</p>
          )}
          <p className="mt-3 text-[10px] text-[#111111]/40">
            {featured.readingTime} min read · Today
          </p>
        </div>
      </div>

      {/* Supporting articles */}
      {rest.slice(0, 3).map((a) => (
        <div key={a.id} className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] p-3">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] uppercase tracking-[0.12em] text-[#111111]/40">{a.category}</p>
            <p className="mt-1 text-[13px] font-semibold leading-snug text-[#111111]">{a.title}</p>
          </div>
          <span className="shrink-0 text-[10px] text-[#111111]/40">{a.readingTime}m</span>
        </div>
      ))}
    </section>
  );
}

export default TeaSection;
