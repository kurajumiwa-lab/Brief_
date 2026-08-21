import React from 'react';
import { Compass, CalendarDays, MapPin, Tag } from 'lucide-react';
import * as briefApi from '../api/briefApi';

// ---------------------------------------------------------------------------
// FEED COMPOSER — the home feed, rebuilt in the Material 3 visual system.
//
// Layout: Today's Tea leads, then Around-you → Upcoming → Collections →
// Trending. Every slot is REAL data from /api/feed, /api/collections and
// /api/tea — never the reference's hardcoded placeholder content.
//
// Honesty rules (unchanged): media comes from the association layer (exact →
// venue → location → category → none); an object with no image renders as an
// icon block, never a wrong photo. CTAs reflect the object type. Empty
// sections are omitted, not padded.
// ---------------------------------------------------------------------------

type FeedObject = any;

interface FeedComposerProps {
  onOpen: (obj: FeedObject) => void;
  onOpenTea: (slug: string) => void;
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
  experience: 'Join', place: 'Explore', opportunity: 'View', service: 'Get started',
  product: 'Shop', identity: 'View', community: 'View', knowledge: 'Read',
  document: 'View', conversation: 'View'
};
const ctaFor = (o: FeedObject) => CTA_FOR_TYPE[o.type] ?? 'View';

/** A real date block (month/day) only when the object carries one; else null. */
function dateBlock(o: FeedObject): { month: string; day: string } | null {
  const iso = o.metadata?.deadline ?? o.startsAt ?? o.endsAt ?? null;
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: String(d.getDate())
  };
}

function metaFor(o: FeedObject): string {
  const parts: string[] = [];
  if (o.locationName) parts.push(o.locationName);
  if (typeof o.distanceKm === 'number' && Number.isFinite(o.distanceKm)) parts.push(`${o.distanceKm} km`);
  return parts.join(' · ');
}

const T = {
  bg: 'var(--m3-surface)',
  container: 'var(--m3-surface-container)',
  containerLow: 'var(--m3-surface-container-low)',
  primary: 'var(--m3-primary)',
  secondaryContainer: 'var(--m3-secondary-container)',
  onSurface: 'var(--m3-on-surface)',
  onSurfaceVariant: 'var(--m3-on-surface-variant)',
  outline: 'var(--m3-outline)',
  outlineVariant: 'var(--m3-outline-variant)'
};

export function FeedComposer({ onOpen, onOpenTea }: FeedComposerProps) {
  const [state, setState] = React.useState<{ status: 'loading' | 'ready'; feed: FeedData | null }>({ status: 'loading', feed: null });
  const [collections, setCollections] = React.useState<any[]>([]);

  React.useEffect(() => {
    let live = true;
    (async () => {
      const [feedRes, colRes] = await Promise.all([briefApi.getFeed(), briefApi.getCollections()]);
      if (!live) return;
      if (feedRes.ok) setState({ status: 'ready', feed: feedRes.data as FeedData });
      else setState({ status: 'ready', feed: null });
      if (colRes.ok) setCollections(colRes.data as any[]);
    })();
    return () => { live = false; };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-16 rounded-xl" style={{ background: T.container }} />
        <div className="h-64 rounded-xl" style={{ background: T.container }} />
      </div>
    );
  }

  const feed = state.feed;
  if (!feed || (feed.hero.length === 0 && feed.discovery.length === 0 && feed.opportunities.length === 0 && !feed.tea)) {
    return (
      <div className="rounded-xl border p-5" style={{ borderColor: T.outlineVariant, background: T.container }}>
        <p className="text-[13px]" style={{ color: T.onSurfaceVariant }}>Nothing much nearby right now. Try another area.</p>
      </div>
    );
  }

  const all = [...feed.hero, ...feed.discovery, ...feed.opportunities, ...feed.more];
  const upcoming = all.filter((o) => (o.type === 'experience' || o.type === 'opportunity') && o.expiryStatus !== 'expired');
  const trendingTags = [
    ...new Set([...all.map((o) => o.category).filter(Boolean), ...(feed.tea?.tags ?? [])])
  ].slice(0, 8);

  return (
    <div className="space-y-6" style={{ fontFamily: 'var(--m3-font-body)', color: T.onSurface }}>
      {/* --- Tea (the editorial feature) -------------------------------------- */}
      {feed.tea && (
        <article
          onClick={() => onOpenTea(feed.tea.slug)}
          className="cursor-pointer rounded-xl border p-5 transition-colors hover:border-[var(--m3-primary)]"
          style={{ borderColor: T.outlineVariant, background: T.container }}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: T.secondaryContainer, color: '#00374d' }}>
                <Compass className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: T.onSurface }}>Today's Tea</p>
                <p className="text-xs" style={{ color: T.onSurfaceVariant }}>{feed.tea.location ?? 'Your city'} · {feed.tea.category}</p>
              </div>
            </div>
          </div>
          <h4 className="mb-2 text-[18px] font-semibold" style={{ color: T.onSurface }}>{feed.tea.title}</h4>
          <p className="text-[13px]" style={{ color: T.onSurfaceVariant }}>{feed.tea.dek || `${feed.tea.readingTime} min read`}</p>
        </article>
      )}

      {/* --- Around you (discovery scroll) ------------------------------------ */}
      {feed.discovery.length > 0 && (
        <section className="mt-2">
          <h3 className="mb-3 px-1 text-[18px] font-semibold" style={{ color: T.onSurface }}>Around you</h3>
          <div className="flex gap-4 overflow-x-auto no-scrollbar px-1 pb-2">
            {feed.discovery.map((o) => (
              <article
                key={o.id}
                onClick={() => onOpen(o)}
                className="w-[320px] flex-none cursor-pointer rounded-xl border p-4 transition-colors hover:border-[var(--m3-primary)]"
                style={{ borderColor: T.outlineVariant, background: T.container }}
              >
                <div className="mb-3 flex h-40 items-center justify-center rounded-lg" style={{ background: `linear-gradient(135deg, ${T.containerLow}, ${T.bg})` }}>
                  {o.media?.url ? (
                    <img src={o.media.url} alt={o.media.alt ?? o.title} loading="lazy" className="h-full w-full rounded-lg object-cover" />
                  ) : (
                    <MapPin className="h-8 w-8" style={{ color: T.outlineVariant }} />
                  )}
                </div>
                <h4 className="mb-1 truncate text-[15px] font-semibold" style={{ color: T.onSurface }}>{o.title}</h4>
                <p className="line-clamp-2 text-[13px]" style={{ color: T.onSurfaceVariant }}>{metaFor(o) || o.summary}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* --- Upcoming events --------------------------------------------------- */}
      {upcoming.length > 0 && (
        <section className="mt-2">
          <div className="mb-3 flex items-center justify-between px-1">
            <h3 className="text-[18px] font-semibold" style={{ color: T.onSurface }}>Upcoming</h3>
            <span className="text-sm font-semibold" style={{ color: T.primary }}>{upcoming.length}</span>
          </div>
          <div className="flex flex-col gap-3">
            {upcoming.slice(0, 5).map((o) => {
              const db = dateBlock(o);
              return (
                <div
                  key={o.id}
                  onClick={() => onOpen(o)}
                  className="flex cursor-pointer items-center gap-4 rounded-xl border p-3 transition-colors hover:border-[var(--m3-primary)]"
                  style={{ borderColor: T.outlineVariant, background: T.container }}
                >
                  <div className="flex h-14 w-14 flex-col items-center justify-center rounded-lg border" style={{ borderColor: T.outlineVariant, background: T.bg }}>
                    {db ? (
                      <>
                        <span className="text-[11px] font-bold tracking-[0.08em]" style={{ color: T.primary }}>{db.month}</span>
                        <span className="text-[18px] font-semibold leading-none" style={{ color: T.onSurface }}>{db.day}</span>
                      </>
                    ) : (
                      <CalendarDays className="h-5 w-5" style={{ color: T.primary }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-[15px] font-semibold" style={{ color: T.onSurface }}>{o.title}</h4>
                    <p className="truncate text-[13px]" style={{ color: T.onSurfaceVariant }}>{metaFor(o) || o.summary}</p>
                  </div>
                  <span className="flex-none text-[13px] font-semibold" style={{ color: T.primary }}>{ctaFor(o)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* --- Collections -------------------------------------------------------- */}
      {collections.length > 0 && (
        <section className="mt-2">
          <h3 className="mb-3 px-1 text-[18px] font-semibold" style={{ color: T.onSurface }}>Collections</h3>
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-1 pb-2">
            {collections.map((c) => (
              <div key={c.id} className="flex-none rounded-xl border px-3 py-2" style={{ borderColor: T.outlineVariant, background: T.container }}>
                <p className="text-[13px] font-semibold" style={{ color: T.onSurface }}>{c.title}</p>
                {c.description && <p className="mt-0.5 max-w-[160px] truncate text-[11px]" style={{ color: T.onSurfaceVariant }}>{c.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* --- Trending topics ---------------------------------------------------- */}
      {trendingTags.length > 0 && (
        <section className="mt-2">
          <h3 className="mb-3 px-1 text-[18px] font-semibold" style={{ color: T.onSurface }}>Trending</h3>
          <div className="flex flex-wrap gap-2 px-1">
            {trendingTags.map((t) => (
              <span key={t} className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-[13px]" style={{ borderColor: T.outlineVariant, background: T.container, color: T.onSurface }}>
                <Tag className="h-3 w-3" style={{ color: T.primary }} />
                {t}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default FeedComposer;
