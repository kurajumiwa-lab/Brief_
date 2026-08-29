import React from 'react';
import { Heart } from 'lucide-react';
import * as briefApi from '../api/briefApi';
import { WireSection } from './WireSection';
import { StandaloneBanner } from './StandaloneBanner';

// ---------------------------------------------------------------------------
// HOME FEED
//
// The home surface is intentionally quiet: real photography does the work,
// and every item is represented by its title. No teaser copy, counts or
// invented metadata compete with the things people came to find.
// ---------------------------------------------------------------------------

type FeedObject = any;

interface FeedComposerProps {
  onOpen: (obj: FeedObject) => void;
  onOpenTea: (slug: string) => void;
  onOpenTag?: (tag: string) => void;
  typeFilter?: string;
  onFeedStatus?: (status: 'loading' | 'ready' | 'unavailable') => void;
}

interface FeedData {
  hero: FeedObject[];
  discovery: FeedObject[];
  opportunities: FeedObject[];
  more: FeedObject[];
  tea: any | null;
  moreTea: any[];
  counts: { objects: number; tea: number; deduped: number };
  _meta?: { generatedAt?: string; apiVersion?: string } | null;
  _mediaProvider?: { configured?: boolean } | null;
}

const T = {
  bg: '#F1EDF7',
  surface: '#FFFFFF',
  line: '#D6CFE4',
  ink: '#251045',
  muted: 'rgba(17,17,17,0.62)',
  green: '#251045'
};

function feedUpdatedAt(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit' });
}

function testExpiryLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}

function imageOf(item: FeedObject): string | null {
  return item?.media?.url ?? item?.imageUrl ?? item?.heroImage ?? null;
}

function titleOf(item: FeedObject): string {
  return String(item?.title ?? '').trim();
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: T.muted }}>
      {children}
    </h2>
  );
}

function PhotoTitleCard({
  item,
  onOpen,
  className = ''
}: {
  item: FeedObject;
  onOpen: (obj: FeedObject) => void;
  className?: string;
}) {
  const image = imageOf(item);
  const title = titleOf(item);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={title}
      className={`group relative block min-h-[190px] overflow-hidden rounded-2xl border text-left transition-transform duration-200 hover:-translate-y-0.5 hover:border-[#6C3EC9] active:scale-[0.99] ${className}`}
      style={{ borderColor: T.line, background: T.surface }}
    >
      {image ? (
        <img
          src={image}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${T.surface} 0%, ${T.bg} 100%)` }}
        />
      )}
      {image && (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(9,11,16,0.04) 22%, rgba(9,11,16,0.82) 100%)' }}
        />
      )}
      <h3 className="absolute inset-x-4 bottom-4 line-clamp-3 text-[15px] font-semibold leading-snug" style={{ color: image ? '#FFFFFF' : T.ink }}>
        {title}
      </h3>
    </button>
  );
}

function TitleRow({
  item,
  onOpen,
  image = true
}: {
  item: FeedObject;
  onOpen: (obj: FeedObject) => void;
  image?: boolean;
}) {
  const source = imageOf(item);
  const title = titleOf(item);
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={title}
      className="group flex min-h-16 w-full items-center gap-3 rounded-2xl border p-2 text-left transition-colors hover:border-[#6C3EC9]"
      style={{ borderColor: T.line, background: T.surface }}
    >
      {image && source && (
        <img src={source} alt="" aria-hidden="true" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
      )}
      <h3 className="min-w-0 flex-1 truncate px-1 text-[14px] font-semibold" style={{ color: T.ink }}>
        {title}
      </h3>
    </button>
  );
}

export function FeedComposer({ onOpen, onOpenTea, onOpenTag, typeFilter = 'all', onFeedStatus }: FeedComposerProps) {
  const [state, setState] = React.useState<{
    status: 'loading' | 'ready';
    feed: FeedData | null;
  }>({ status: 'loading', feed: null });
  const [collections, setCollections] = React.useState<any[]>([]);
  const [banners, setBanners] = React.useState<any[]>([]);
  const [openCollection, setOpenCollection] = React.useState<{
    key: string;
    title: string;
    status: 'loading' | 'ready' | 'error';
    objects: FeedObject[];
    error: string | null;
  } | null>(null);

  const openCollectionByKey = async (collection: { key?: string; id?: string; title?: string }) => {
    const key = String(collection.key || collection.id || '');
    if (!key) return;
    setOpenCollection({ key, title: collection.title || key, status: 'loading', objects: [], error: null });
    const res = await briefApi.getCollection(key);
    if (!res.ok) {
      setOpenCollection({
        key,
        title: collection.title || key,
        status: 'error',
        objects: [],
        error: res.error || 'Collection unavailable.'
      });
      return;
    }
    setOpenCollection({
      key,
      title: res.data?.title || collection.title || key,
      status: 'ready',
      objects: Array.isArray(res.data?.objects) ? res.data.objects : [],
      error: null
    });
  };

  React.useEffect(() => {
    let live = true;
    onFeedStatus?.('loading');
    (async () => {
      const [feedRes, collectionRes, bannerRes] = await Promise.all([
        briefApi.getFeed(),
        briefApi.getCollections(),
        briefApi.getCampaignBanners()
      ]);
      if (!live) return;
      setState({ status: 'ready', feed: feedRes.ok ? feedRes.data as FeedData : null });
      onFeedStatus?.(feedRes.ok ? 'ready' : 'unavailable');
      if (collectionRes.ok) setCollections(collectionRes.data as any[]);
      if (bannerRes.ok) setBanners(bannerRes.data as any[]);
    })();
    return () => { live = false; };
  }, [onFeedStatus]);

  if (state.status === 'loading') {
    return (
      <div className="space-y-3 animate-pulse" aria-label="Loading">
        <div className="h-64 rounded-2xl" style={{ background: T.surface }} />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-40 rounded-2xl" style={{ background: T.surface }} />
          <div className="h-40 rounded-2xl" style={{ background: T.surface }} />
        </div>
      </div>
    );
  }

  const feed = state.feed;
  if (!feed) {
    return <WireSection />;
  }

  const all = [...(feed.hero ?? []), ...(feed.discovery ?? []), ...(feed.opportunities ?? []), ...(feed.more ?? [])];
  const unique = Array.from(new Map(all.filter((item) => item?.id).map((item) => [item.id, item])).values());
  const filtered = typeFilter === 'all'
    ? unique
    : unique.filter((item) => item.type === typeFilter);
  const hero = filtered[0] ?? null;
  const withoutHero = filtered.filter((item) => item.id !== hero?.id);
  const discovery = withoutHero.filter((item) => item.type !== 'experience' && item.type !== 'opportunity');
  const opportunities = withoutHero.filter((item) => item.type === 'opportunity');
  const events = withoutHero.filter((item) => item.type === 'experience');
  const tags = [...new Set([
    ...unique.map((item) => item.category).filter(Boolean),
    ...(feed.tea?.tags ?? [])
  ])].slice(0, 8);

  const hasContent = Boolean(hero || feed.tea || discovery.length || opportunities.length || events.length || collections.length || banners.length || tags.length);
  const temporary = [...unique, feed.tea].find((item) => item?.testContent);
  const temporaryExpiry = testExpiryLabel(temporary?.testContent?.expiresAt);
  if (!hasContent) {
    return (
      <>
        <WireSection />
        <h2 className="px-1 py-8 text-center text-base font-semibold" style={{ color: T.ink }}>Nothing nearby</h2>
      </>
    );
  }

  const updatedAt = feedUpdatedAt(feed._meta?.generatedAt);

  return (
    <div className="space-y-8" style={{ fontFamily: 'var(--m3-font-body)', color: T.ink }}>
      {temporary && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-dashed border-[#D6CFE4] bg-[#FBFAFD] px-3 py-2.5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#251045]">{temporary.testContent.label}</p>
            <p className="mt-1 text-[10px] leading-snug text-[#251045]/55">Temporary welcome content for release testing. It will leave the public feed at the expiry above and will not be silently reseeded.</p>
          </div>
          <span className="shrink-0 text-right text-[9px] font-bold text-[#251045]/45">{temporaryExpiry ? `until ${temporaryExpiry}` : 'temporary'}</span>
        </div>
      )}
      {updatedAt && (
        <p className="px-1 text-[10px] text-[#251045]/45">
          Live Brief feed · refreshed {updatedAt}
        </p>
      )}
      {/* A single visual lead. */}
      {hero && (
        <PhotoTitleCard
          item={hero}
          onOpen={onOpen}
          className="min-h-[290px] sm:min-h-[380px]"
        />
      )}

      {banners.length > 0 && (
        <section>
          <SectionTitle>Featured</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {banners.slice(0, 4).map((banner) => (
              <StandaloneBanner key={banner.id} banner={banner} />
            ))}
          </div>
        </section>
      )}

      {feed.tea && (
        <section>
          <SectionTitle>Stories</SectionTitle>
          <button
            type="button"
            onClick={() => onOpenTea(feed.tea.slug)}
            aria-label={titleOf(feed.tea)}
            className="group relative block min-h-[190px] w-full overflow-hidden rounded-2xl border text-left transition-transform duration-200 hover:-translate-y-0.5 hover:border-[#6C3EC9]"
            style={{ borderColor: T.line, background: T.surface }}
          >
            {imageOf(feed.tea) ? (
              <img
                src={imageOf(feed.tea) as string}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${T.surface}, ${T.bg})` }} />
            )}
            {imageOf(feed.tea) && (
              <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(9,11,16,0.04) 20%, rgba(9,11,16,0.86) 100%)' }} />
            )}
            <h3 className="absolute inset-x-4 bottom-4 line-clamp-3 text-[18px] font-semibold leading-snug" style={{ color: imageOf(feed.tea) ? '#FFFFFF' : T.ink }}>
              {titleOf(feed.tea)}
            </h3>
            {/* The public rating, on the front page: the real derived count. */}
            {typeof (feed.tea as any).likeCount === 'number' && (feed.tea as any).likeCount > 0 && (
              <span
                className="absolute right-3 top-3 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: 'rgba(9,11,16,0.75)', color: '#FFFFFF' }}
              >
                <Heart className="h-3 w-3" style={{ fill: '#FFFFFF', stroke: '#FFFFFF' }} />
                {(feed.tea as any).likeCount}
              </span>
            )}
          </button>
        </section>
      )}

      {discovery.length > 0 && (
        <section>
          <SectionTitle>Nearby</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {discovery.slice(0, 6).map((item) => (
              <PhotoTitleCard key={item.id} item={item} onOpen={onOpen} className="min-h-[190px] sm:min-h-[220px]" />
            ))}
          </div>
        </section>
      )}

      {opportunities.length > 0 && (
        <section>
          <SectionTitle>Offers</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {opportunities.slice(0, 6).map((item) => (
              <PhotoTitleCard key={item.id} item={item} onOpen={onOpen} className="min-h-[180px] sm:min-h-[220px]" />
            ))}
          </div>
        </section>
      )}

      {events.length > 0 && (
        <section>
          <SectionTitle>Upcoming</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {events.slice(0, 6).map((item) => (
              <PhotoTitleCard key={item.id} item={item} onOpen={onOpen} className="min-h-[180px] sm:min-h-[220px]" />
            ))}
          </div>
        </section>
      )}

      {collections.length > 0 && (
        <section>
          <SectionTitle>Collections</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {collections.map((collection) => {
              const image = imageOf(collection);
              const title = titleOf(collection);
              return (
                <button
                  key={collection.id || collection.key}
                  type="button"
                  onClick={() => void openCollectionByKey(collection)}
                  aria-label={title}
                  className="group relative min-h-28 overflow-hidden rounded-2xl border p-3 text-left transition-colors hover:border-[#6C3EC9]"
                  style={{ borderColor: openCollection?.key === (collection.key || collection.id) ? T.green : T.line, background: T.surface }}
                >
                  {image && <img src={image} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-60 transition-transform duration-500 group-hover:scale-[1.03]" />}
                  <div className="absolute inset-0" style={{ background: image ? 'linear-gradient(180deg, rgba(21,8,38,0.12), rgba(21,8,38,0.88))' : 'linear-gradient(135deg, #D6CFE4, #E9E4F2)' }} />
                  <span className="relative block line-clamp-3 text-[14px] font-semibold" style={{ color: image ? '#FFFFFF' : T.ink }}>{title}</span>
                </button>
              );
            })}
          </div>
          {openCollection && (
            <div className="mt-3 space-y-2">
              {openCollection.status === 'loading' && <div className="h-14 animate-pulse rounded-2xl" style={{ background: T.surface }} />}
              {openCollection.status === 'error' && <TitleRow item={{ id: 'collection-error', title: openCollection.error }} onOpen={() => undefined} image={false} />}
              {openCollection.status === 'ready' && openCollection.objects.map((item) => (
                <TitleRow key={item.id} item={item} onOpen={onOpen} />
              ))}
            </div>
          )}
        </section>
      )}

      {tags.length > 0 && (
        <section>
          <SectionTitle>Topics</SectionTitle>
          <div className="flex flex-wrap gap-2 px-1">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onOpenTag?.(tag)}
                className="rounded-full border px-3 py-2 text-[12px] font-semibold transition-colors hover:border-[#6C3EC9]"
                style={{ borderColor: T.line, background: T.surface, color: T.ink }}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default FeedComposer;
