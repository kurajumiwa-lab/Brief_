import React from 'react';
import * as briefApi from '../api/briefApi';

// ---------------------------------------------------------------------------
// FEED COMPOSER — the home feed as a magazine, not a card dump.
//
// Fetches the composed, deduplicated feed from /api/feed and renders it with a
// deliberate rhythm: Hero → Tea → discovery → opportunities → more. Card
// variants are chosen by the object's type and what it actually carries, so
// the feed never looks like a repeating grid.
//
// Honesty: every object is a real server row; media comes from the association
// layer (exact → venue → location → category → none); an object with no image
// renders as a text card, never a wrong photo. The CTA reflects the type —
// Join / Explore / View / Get started / Shop — never a universal button.
// ---------------------------------------------------------------------------

type FeedObject = any;

interface FeedComposerProps {
  onOpen: (obj: FeedObject) => void;
}

interface FeedData {
  hero: FeedObject[];
  discovery: FeedObject[];
  opportunities: FeedObject[];
  more: FeedObject[];
  tea: any | null;
  moreTea: any[];
  counts: { objects: number; tea: number; deduped: number };
}

const CTA_FOR_TYPE: Record<string, string> = {
  experience: 'Join',
  place: 'Explore',
  opportunity: 'View',
  service: 'Get started',
  product: 'Shop',
  identity: 'View',
  community: 'View',
  knowledge: 'Read',
  document: 'View',
  conversation: 'View'
};

function ctaFor(obj: FeedObject): string {
  return CTA_FOR_TYPE[obj.type] ?? 'View';
}

function metaFor(obj: FeedObject): string {
  const parts: string[] = [];
  if (obj.locationName) parts.push(obj.locationName);
  if (typeof obj.distanceKm === 'number' && Number.isFinite(obj.distanceKm)) parts.push(`${obj.distanceKm} km`);
  return parts.join(' · ');
}

// --- Card variants ---------------------------------------------------------

function HeroCard({ obj, onOpen }: { obj: FeedObject; onOpen: (o: FeedObject) => void }) {
  const media = obj.media;
  const price = obj.metadata?.price !== undefined ? `${obj.metadata.currency || 'KES'} ${obj.metadata.price.toLocaleString()}` : null;
  return (
    <button
      onClick={() => onOpen(obj)}
      className="group relative block w-full overflow-hidden rounded-2xl border border-[#232A38] bg-[#10141C] text-left cursor-pointer transition hover:border-[#43D17A]"
    >
      {media?.url ? (
        <div className="relative h-48 w-full bg-[#090B10]">
          <img src={media.url} alt={media.alt ?? obj.title} loading="lazy" className="h-full w-full object-cover opacity-90" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#090B10] to-transparent" />
        </div>
      ) : (
        <div className="h-24 w-full bg-gradient-to-br from-[#0B1A12] to-[#090B10]" />
      )}
      <div className="p-4">
        <p className="text-[10px] uppercase tracking-[0.15em] text-[#43D17A]">{obj.category}</p>
        <h3 className="mt-1 text-[20px] font-bold leading-snug text-[#F3F1E7]">{obj.title}</h3>
        {obj.summary && <p className="mt-1 text-[12px] leading-relaxed text-[#8A93A6] line-clamp-2">{obj.summary}</p>}
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            {metaFor(obj) && <p className="text-[11px] text-[#8A93A6] truncate">{metaFor(obj)}</p>}
            {price && <p className="text-[12px] font-bold text-[#43D17A] mt-0.5">{price}</p>}
          </div>
          <span className="shrink-0 rounded-full bg-[#43D17A] px-4 py-1.5 text-[12px] font-bold text-[#090B10]">
            {ctaFor(obj)}
          </span>
        </div>
      </div>
    </button>
  );
}

function HorizontalCard({ obj, onOpen }: { obj: FeedObject; onOpen: (o: FeedObject) => void }) {
  const media = obj.media;
  return (
    <button
      onClick={() => onOpen(obj)}
      className="flex w-full items-center gap-3 rounded-xl border border-[#232A38] bg-[#10141C] p-3 text-left cursor-pointer transition hover:border-[#43D17A]"
    >
      {media?.url ? (
        <img src={media.url} alt={media.alt ?? obj.title} loading="lazy" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="h-14 w-14 shrink-0 rounded-lg bg-gradient-to-br from-[#0B1A12] to-[#090B10]" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-snug text-[#F3F1E7] line-clamp-2">{obj.title}</p>
        {metaFor(obj) && <p className="mt-0.5 text-[10px] text-[#8A93A6] truncate">{metaFor(obj)}</p>}
      </div>
      <span className="shrink-0 text-[11px] font-bold text-[#43D17A]">{ctaFor(obj)}</span>
    </button>
  );
}

function CompactCard({ obj, onOpen }: { obj: FeedObject; onOpen: (o: FeedObject) => void }) {
  return (
    <button
      onClick={() => onOpen(obj)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#232A38] bg-[#10141C] p-3 text-left cursor-pointer transition hover:border-[#43D17A]"
    >
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-[0.12em] text-[#4B5162]">Opportunity</p>
        <p className="mt-0.5 text-[13px] font-semibold text-[#F3F1E7] line-clamp-1">{obj.title}</p>
        {metaFor(obj) && <p className="text-[10px] text-[#8A93A6] truncate">{metaFor(obj)}</p>}
      </div>
      <span className="shrink-0 text-[11px] font-bold text-[#43D17A]">{ctaFor(obj)}</span>
    </button>
  );
}

function TeaCard({ article }: { article: any }) {
  // Display-only: there is no article reader page yet, so the card does not
  // open a dead link. The full reader is a later phase (Tea Desk preview is
  // the editor view; the public reader routes already resolve server-side).
  return (
    <div className="block w-full overflow-hidden rounded-2xl border border-[#232A38] bg-[#10141C] text-left">
      <div className="p-4">
        <p className="text-[9px] uppercase tracking-[0.15em] text-[#4B5162]">{article.location ?? 'Your city'} · {article.category}</p>
        <h3 className="mt-1 text-[16px] font-bold leading-snug text-[#F3F1E7]">{article.title}</h3>
        {article.dek && <p className="mt-1 text-[11px] leading-relaxed text-[#8A93A6] line-clamp-2">{article.dek}</p>}
        <p className="mt-2 text-[10px] text-[#4B5162]">{article.readingTime} min read</p>
      </div>
    </div>
  );
}

// --- Composer ---------------------------------------------------------------

export function FeedComposer({ onOpen }: FeedComposerProps) {
  const [state, setState] = React.useState<{ status: 'loading' | 'ready'; feed: FeedData | null }>({ status: 'loading', feed: null });

  React.useEffect(() => {
    let live = true;
    (async () => {
      const res = await briefApi.getFeed();
      if (!live) return;
      if (res.ok) setState({ status: 'ready', feed: res.data as FeedData });
      else setState({ status: 'ready', feed: null });
    })();
    return () => { live = false; };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-48 rounded-2xl bg-[#10141C] border border-[#232A38]" />
        <div className="h-16 rounded-xl bg-[#10141C] border border-[#232A38]" />
      </div>
    );
  }

  const feed = state.feed;
  if (!feed || (feed.hero.length === 0 && feed.discovery.length === 0 && feed.opportunities.length === 0 && !feed.tea)) {
    return (
      <div className="rounded-2xl border border-[#232A38] bg-[#10141C] p-4">
        <p className="text-[13px] text-[#8A93A6]">Nothing much nearby right now. Try another area.</p>
      </div>
    );
  }

  const hero = feed.hero[0];
  const discovery = feed.discovery;

  return (
    <div className="space-y-5">
      {/* Hero — the single most important thing. */}
      {hero && <HeroCard obj={hero} onOpen={onOpen} />}

      {/* Tea — the editorial feature. */}
      {feed.tea && (
        <section className="space-y-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#43D17A]">Today's Tea</h2>
          <TeaCard article={feed.tea} />
        </section>
      )}

      {/* Discovery — a varied horizontal rhythm. */}
      {discovery.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#43D17A]">Around you</h2>
          {discovery.map((o) => (
            <HorizontalCard key={o.id} obj={o} onOpen={onOpen} />
          ))}
        </section>
      )}

      {/* Opportunities — compact, useful. */}
      {feed.opportunities.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#43D17A]">Opportunities</h2>
          {feed.opportunities.map((o) => (
            <CompactCard key={o.id} obj={o} onOpen={onOpen} />
          ))}
        </section>
      )}
    </div>
  );
}

export default FeedComposer;
