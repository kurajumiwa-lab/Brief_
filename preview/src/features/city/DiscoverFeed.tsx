import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bike, CalendarDays, Check, ChevronRight, MapPin, MessageCircle, Package, Plus, Search, Sun,
  ShoppingBag, Sparkles, Users, X
} from 'lucide-react';
import * as briefApi from '../../api/briefApi';
import type { DiscoverFeedItem, DiscoverRoute, DiscoverSummary } from '../../api/briefApi';
import { MuseumGallery } from './MuseumGallery';
import { Marketplace } from '../../components/Marketplace';
import { Circles } from '../../components/Circles';
import { ErrandsLobby } from './ErrandsLobby';
import { TransportRail } from './TransportRail';
import { FLOW_ORDER, SIDE_ORDER, isFlowRoom, type DiscoverRoom } from './taxonomy';
import { soundEngine } from '../../utils/SoundEngine';

// ---------------------------------------------------------------------------
// DISCOVER FEED — a supply board read as routes.
//
// Four flow tiles (bulk / direct / niche / group), a second row for the mixed
// view and the non-supply rooms, and — inside a flow — a list of ROUTES:
// "Wakulima Market → Kilimani shops · min 5 crate", each with how many sellers
// run it and how many open asks name that commodity and that destination. A
// marketplace shows products; a supply chain shows movement, and the difference
// is what a buyer here is actually shopping for.
//
// What it will not do:
//   * infer a flow, an origin or a destination. A listing that declares nothing
//     is counted as untagged and shown under All; it is never folded into a route
//     somebody else described.
//   * promise a buyer. "2 open asks" is a count of public Requests with no
//     accepted quote that match on the fields the asker typed — not "8 buyers
//     waiting", and not a guarantee anybody will buy.
//   * rank. The route order is (most matching open demand, then most listings),
//     which is arithmetic over rows, and the card says which rule put it there.
//   * show a photo that is not the seller's own.
//
// The look is the legacy Discover screen's — 2x2 switcher, full-bleed 16:10
// cards, a detail sheet, a warm floating Create pill — because that layout was
// better and the user asked for it back. Its data was a hardcoded array of
// invented listings with Unsplash photos and fake phone numbers; that stayed
// deleted.
// ---------------------------------------------------------------------------

const ICONS: Record<string, React.ReactNode> = {
  box: <Package className="w-6 h-6" />,
  leaf: <Sun className="w-6 h-6" />,
  sparkle: <Sparkles className="w-6 h-6" />,
  users: <Users className="w-6 h-6" />,
  feed: <Search className="w-5 h-5" />,
  calendar: <CalendarDays className="w-5 h-5" />,
  bike: <Bike className="w-5 h-5" />
};

const shortDate = (iso: string | null | undefined) => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// card
// ---------------------------------------------------------------------------
function FeedCard({ item, onOpen }: { item: DiscoverFeedItem; onOpen: (item: DiscoverFeedItem) => void }) {
  const dateLabel = item.kind === 'event' ? shortDate(item.dateLabel ?? undefined) ?? item.dateLabel : item.dateLabel;
  return (
    <button
      type="button"
      onClick={() => { soundEngine.play('tap'); onOpen(item); }}
      className="w-full text-left relative aspect-[16/10] rounded-3xl overflow-hidden cursor-pointer transition-transform active:scale-[0.99] group"
      style={{ background: 'linear-gradient(135deg, #4F46E5, #22D3EE)', boxShadow: '0 10px 30px rgba(10,10,10,0.10)' }}
      aria-label={`Open ${item.title}`}
    >
      {item.mediaUrl ? (
        <img src={item.mediaUrl} alt={item.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 grid place-items-center">
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider" style={{ background: 'rgba(10,10,10,0.35)', color: 'rgba(255,255,255,0.9)' }}>
            no photo from {item.seller ?? 'the seller'}
          </span>
        </span>
      )}
      <span className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.84), rgba(0,0,0,0.20) 55%, transparent)' }} />

      {item.priceLabel && (
        <span
          className="absolute top-3 right-3 px-3 py-1.5 rounded-full font-mono text-[11px] font-black"
          style={{ background: 'rgba(255,255,255,0.95)', color: '#0A0A0A' }}
        >
          {item.priceLabel}
          {item.unit ? ` / ${item.unit}` : ''}
        </span>
      )}
      {dateLabel && (
        <span
          className={`absolute ${item.priceLabel ? 'top-12' : 'top-3'} right-3 px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1`}
          style={{ background: 'rgba(10,10,10,0.65)', color: '#fff' }}
        >
          <CalendarDays className="w-3 h-3" /> {dateLabel}
        </span>
      )}

      <span className="absolute left-3 right-3 bottom-3 block text-white">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded-md text-[9px] font-mono uppercase font-black" style={{ background: 'rgba(255,255,255,0.22)' }}>
            {item.flow ?? item.kind}
          </span>
          {item.origin && item.destination && (
            <span className="text-[11px] font-mono truncate">
              {item.origin} → {item.destination}
            </span>
          )}
          {!item.origin && item.location && (
            <span className="text-[11px] inline-flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3" /> {item.location}
            </span>
          )}
        </span>
        <span className="block text-[16px] font-extrabold leading-snug mt-1 line-clamp-2">{item.title}</span>
        <span className="block text-[11px] opacity-90 mt-0.5 truncate">
          {item.minOrder ? `min ${item.minOrder}${item.unit ? ` ${item.unit}` : ''} · ` : ''}
          {item.interest.count} {item.interest.label} · {item.why}
        </span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// route card — the thing a shelf of products never tells you
// ---------------------------------------------------------------------------
function RouteCard({
  route,
  active,
  onBrowse
}: {
  route: DiscoverRoute;
  active: boolean;
  onBrowse: () => void;
}) {
  return (
    <div className="p-3.5 rounded-2xl border-2" style={{ borderColor: active ? 'var(--color-primary)' : '#E5E7EB', background: '#fff' }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-extrabold leading-snug min-w-0" style={{ color: '#0A0A0A' }}>
          {route.origin}
          <span className="mx-1.5 font-mono" style={{ color: '#9CA3AF' }}>→</span>
          {route.destination}
        </p>
        {route.openDemand > 0 ? (
          <span
            className="shrink-0 px-2 py-1 rounded-full text-[10px] font-black font-mono"
            style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}
          >
            {route.openDemand} open ask{route.openDemand === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>

      <p className="text-[11px] font-mono mt-1.5 truncate" style={{ color: '#6B7280' }}>
        {route.listings} listing{route.listings === 1 ? '' : 's'}
        {route.sellers.length ? ` · ${route.sellers.length} seller${route.sellers.length === 1 ? '' : 's'}` : ''}
        {route.minOrderFrom ? ` · min ${route.minOrderFrom}${route.unit ? ` ${route.unit}` : ''}` : ''}
      </p>
      {route.topCommodities.length > 0 && (
        <p className="text-[11px] mt-1 truncate" style={{ color: '#0A0A0A' }}>
          moving: {route.topCommodities.join(', ')}
        </p>
      )}
      {route.openDemandQuantity != null && (
        <p className="text-[11px] font-mono mt-1" style={{ color: '#6B7280' }}>
          {route.openDemandQuantity}
          {route.unit ? ` ${route.unit}` : ''} asked for, from the quantities buyers typed
        </p>
      )}
      {route.commodityUndeclared ? (
        <p className="text-[10px] mt-1" style={{ color: '#B45309' }}>
          {route.commodityUndeclared} listing{route.commodityUndeclared === 1 ? '' : 's'} on this route declare no commodity, so no
          demand is counted against it.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => { soundEngine.play('tap'); onBrowse(); }}
        className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-black cursor-pointer"
        style={{
          background: active ? 'var(--color-primary)' : '#F4F4F7',
          color: active ? 'var(--accent-ink)' : '#0A0A0A'
        }}
      >
        {active ? <><Check className="w-4 h-4" /> Browsing this route</> : <>Browse this route<ChevronRight className="w-4 h-4" /></>}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// the detail sheet, with the contact rule
// ---------------------------------------------------------------------------
function FeedSheet({ item, onClose, onOpenFull }: {
  item: DiscoverFeedItem;
  onClose: () => void;
  onOpenFull: (item: DiscoverFeedItem) => void;
}) {
  const digits = (item.contact ?? '').replace(/\D/g, '');
  const whatsapp = digits.length >= 9
    ? `https://wa.me/${digits}?text=${encodeURIComponent(`Hi — I saw "${item.title}" on Brief and I would like to ask about it.`)}`
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(10,10,10,0.62)' }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl mx-auto rounded-t-[28px] overflow-auto" style={{ background: '#fff', maxHeight: '88vh' }}>
        <div className="flex justify-center pt-3 pb-1">
          <span className="w-10 h-1 rounded-full" style={{ background: '#E5E7EB' }} />
        </div>
        <div className="relative aspect-video" style={{ background: 'linear-gradient(135deg, #4F46E5, #22D3EE)' }}>
          {item.mediaUrl ? <img src={item.mediaUrl} alt={item.title} className="absolute inset-0 h-full w-full object-cover" /> : (
            <span className="absolute inset-0 grid place-items-center text-[10px] font-black uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.85)' }}>
              no photo from {item.seller ?? 'the seller'}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="absolute top-3 right-3 w-9 h-9 rounded-full grid place-items-center cursor-pointer"
            style={{ background: 'rgba(10,10,10,0.6)', color: '#fff' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider" style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}>
              {item.flow ?? item.kind}
            </span>
            {item.origin && <span className="text-[11px] font-mono" style={{ color: '#6B7280' }}>from {item.origin}{item.originKind ? ` (${item.originKind})` : ''}</span>}
            {item.destination && <span className="text-[11px] font-mono" style={{ color: '#6B7280' }}>to {item.destination}{item.destinationKind ? ` (${item.destinationKind})` : ''}</span>}
          </div>

          <h2 className="text-[21px] font-extrabold leading-tight" style={{ color: '#0A0A0A' }}>{item.title}</h2>
          {item.description && <p className="text-[13px] leading-relaxed" style={{ color: '#4B5563' }}>{item.description}</p>}

          <dl className="grid grid-cols-2 gap-2 text-[12px]">
            {[
              ['price', item.priceLabel ?? 'not stated'],
              ['per', item.unit ?? 'not stated'],
              ['minimum', item.minOrder ? `${item.minOrder}${item.unit ? ` ${item.unit}` : ''}` : 'none stated'],
              ['commodity', item.commodity ?? 'not declared'],
              ['where', item.location ?? 'no place given'],
              ['when', item.dateLabel ?? 'no date given'],
              ['taken so far', `${item.interest.count} ${item.interest.label}`],
              ['stock', item.stock != null ? String(item.stock) : 'not tracked']
            ].map(([k, v]) => (
              <div key={k} className="p-2.5 rounded-xl" style={{ background: '#F4F4F7' }}>
                <dt className="text-[9px] font-black uppercase tracking-wider" style={{ color: '#9CA3AF' }}>{k}</dt>
                <dd className="font-mono font-bold mt-0.5 truncate" style={{ color: '#0A0A0A' }}>{v}</dd>
              </div>
            ))}
          </dl>

          <p className="text-[11px] leading-snug" style={{ color: '#6B7280' }}>
            {item.why} — by a stated rule, not a ranking.
          </p>

          {whatsapp ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#0A0A0A' }}>
                The contact this seller put on their own listing
              </p>
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-[13px] font-black"
                style={{ background: '#25D366', color: '#04310F' }}
              >
                <MessageCircle className="w-4 h-4" /> Message {item.seller ?? 'the seller'} on WhatsApp
              </a>
              <p className="text-[10px]" style={{ color: '#9CA3AF' }}>{item.contactNote ?? ''}</p>
            </div>
          ) : (
            <p className="text-[11px] leading-snug p-3 rounded-xl" style={{ background: '#F4F4F7', color: '#6B7280' }}>
              No contact number on this listing, so none is shown — Brief will not guess one or borrow one from
              somewhere else. Use the enquiry below: it becomes a message the seller can answer in the app.
            </p>
          )}

          <button
            type="button"
            onClick={() => onOpenFull(item)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl text-[13px] font-black cursor-pointer"
            style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
          >
            {item.kind === 'event' ? 'Open the event page' : 'Open the listing & enquire'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// the board
// ---------------------------------------------------------------------------
export interface DiscoverFeedProps {
  room?: DiscoverRoom;
  onRoomChange?: (room: DiscoverRoom) => void;
  onPostListing?: () => void;
  onHostEvent?: () => void;
  /** Passed to the counter so "Post a listing" lands on the real create form. */
  counterSection?: 'browse' | 'orders' | 'selling';
  counterKey?: number;
  className?: string;
}

export function DiscoverFeed({
  room = 'all', onRoomChange, onPostListing, onHostEvent, counterSection = 'browse', counterKey = 0, className = ''
}: DiscoverFeedProps) {
  const [summary, setSummary] = useState<DiscoverSummary | null>(null);
  const [open, setOpen] = useState<DiscoverFeedItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [routeFilter, setRouteFilter] = useState<string | null>(null);
  const [subFilter, setSubFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    const res = await briefApi.getDiscoverSummary();
    setBusy(false);
    if (res.ok) { setSummary(res.data); setFailed(null); }
    else setFailed(res.error ?? 'The board could not be read.');
  }, []);

  useEffect(() => {
    void load();
    const onVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') void load();
    };
    window.addEventListener('focus', onVisible);
    return () => window.removeEventListener('focus', onVisible);
  }, [load]);

  // A room change resets both filters, so a stale route never hides a new room.
  useEffect(() => { setRouteFilter(null); setSubFilter(null); }, [room]);

  const flows = summary?.flows ?? [];
  const flow = isFlowRoom(room) ? flows.find((f) => f.key === room) ?? null : null;
  const routes = useMemo(() => {
    const all = summary?.routes ?? [];
    return isFlowRoom(room) ? all.filter((r) => r.flow === room) : all;
  }, [summary, room]);

  const feed = useMemo(() => {
    let rows = summary?.feed ?? [];
    if (isFlowRoom(room)) rows = rows.filter((i) => i.flow === room);
    if (room === 'events') rows = rows.filter((i) => i.kind === 'event');
    if (room === 'all') rows = rows;
    if (subFilter) rows = rows.filter((i) => `${i.commodity ?? ''} ${i.title}`.toLowerCase().includes(subFilter.toLowerCase()));
    if (routeFilter) {
      const ids = (summary?.routes ?? []).find((r) => `${r.origin}→${r.destination}` === routeFilter)?.listingIds ?? [];
      rows = rows.filter((i) => ids.includes(i.id));
    }
    return rows;
  }, [summary, room, subFilter, routeFilter]);

  const openFull = (item: DiscoverFeedItem) => {
    if (typeof window === 'undefined') return;
    if (item.kind === 'event') window.open(`/c/${item.id}`, '_self');
    else window.location.hash = `offer/${encodeURIComponent(item.id)}`;
  };

  const tiles = summary?.tiles ?? [];
  const countFor = (key: string) => {
    if (key === 'all') return summary?.feed.length ?? 0;
    if (key === 'errands') return tiles.find((t) => t.key === 'errands')?.count ?? 0;
    if (key === 'events') return tiles.find((t) => t.key === 'events')?.count ?? 0;
    if (key === 'circles') return tiles.find((t) => t.key === 'circles')?.count ?? 0;
    return flows.find((f) => f.key === key)?.listings ?? 0;
  };
  const unitFor = (key: string) =>
    isFlowRoom(key as any)
      ? `${key === 'bulk' ? 'for vendors & shops' : key === 'direct' ? 'source-direct' : key === 'niche' ? 'curated for you' : 'pooled demand'}`
      : SIDE_ORDER.find((s) => s.key === key)?.unit ?? '';

  const gaps = summary?.unmapped ?? [];

  return (
    <div className={`space-y-5 ${className}`}>
      {/* ── the four flows ───────────────────────────────────────────────── */}
      <section className="space-y-2.5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: '#0A0A0A' }}>
            The flows
          </h2>
          <button type="button" onClick={() => void load()} disabled={busy} className="text-[10px] font-mono cursor-pointer disabled:opacity-50" style={{ color: '#9CA3AF' }}>
            {busy ? 'reading…' : 're-read'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5" role="tablist" aria-label="Discover flows">
          {FLOW_ORDER.map((f) => {
            const isActive = room === f.key;
            const src = flows.find((x) => x.key === f.key);
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => { soundEngine.play('tap'); onRoomChange?.(f.key); }}
                className="relative p-4 rounded-3xl cursor-pointer text-left transition-transform active:scale-[0.98]"
                style={{
                  background: isActive ? 'var(--color-primary)' : '#fff',
                  border: isActive ? '1px solid transparent' : '1px solid #E5E7EB',
                  boxShadow: isActive ? '0 12px 28px rgba(79,70,229,0.26)' : '0 1px 0 rgba(10,10,10,0.03)'
                }}
              >
                <span className="flex items-center justify-between">
                  <span className="w-9 h-9 rounded-2xl grid place-items-center" style={{ background: isActive ? 'rgba(255,255,255,0.18)' : '#F4F4F7', color: isActive ? '#fff' : 'var(--color-primary)' }}>
                    {ICONS[f.icon]}
                  </span>
                  <span className="font-mono text-[20px] font-extrabold leading-none" style={{ color: isActive ? '#fff' : '#0A0A0A' }}>
                    {countFor(f.key)}
                  </span>
                </span>
                <span className="block mt-2.5 text-[15px] font-extrabold" style={{ color: isActive ? '#fff' : '#0A0A0A' }}>
                  {src?.label ?? (f.key.charAt(0).toUpperCase() + f.key.slice(1))}
                </span>
                <span className="block text-[10px] leading-snug" style={{ color: isActive ? 'rgba(255,255,255,0.82)' : '#6B7280' }}>
                  {unitFor(f.key)}
                </span>
                {src && src.openDemand > 0 && (
                  <span className="absolute -bottom-0.5 right-3 text-[9px] font-mono" style={{ color: isActive ? 'rgba(255,255,255,0.8)' : '#9CA3AF' }}>
                    {src.openDemand} ask{src.openDemand === 1 ? '' : 's'} name it
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label="Other views">
          {SIDE_ORDER.map((t) => {
            const isActive = room === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => { soundEngine.play('tap'); onRoomChange?.(t.key); }}
                className="px-2 py-2 rounded-2xl border text-center cursor-pointer"
                style={{
                  borderColor: isActive ? 'var(--color-primary)' : '#E5E7EB',
                  background: isActive ? 'var(--color-primary-subtle)' : '#fff',
                  color: isActive ? 'var(--color-primary)' : '#6B7280'
                }}
              >
                <span className="block">{t.label}</span>
                <span className="block text-[10px] font-mono mt-0.5" style={{ color: isActive ? 'var(--color-primary)' : '#9CA3AF' }}>
                  {countFor(t.key)}
                </span>
              </button>
            );
          })}
        </div>

        {summary?.untagged ? (
          <p className="text-[10px] leading-snug" style={{ color: '#9CA3AF' }}>
            {summary.untagged} live listing{summary.untagged === 1 ? ' has' : 's have'} no flow declared, so {summary.untagged === 1 ? 'it appears' : 'they appear'} under
            All and in no route. Nothing here is sorted by guesswork.
          </p>
        ) : null}
      </section>

      {failed && (
        <p className="text-[12px] font-bold" role="alert" style={{ color: '#E53935' }}>
          {failed} <button type="button" onClick={() => void load()} className="underline cursor-pointer">Try again</button>
        </p>
      )}

      {/* ── the sub-filter strip: one tap, flat, no tree ─────────────────── */}
      {flow && flow.subFilters.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1" role="tablist" aria-label={`${flow.label} sub-filters`}>
          <button
            type="button"
            onClick={() => setSubFilter(null)}
            aria-pressed={!subFilter}
            className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border cursor-pointer"
            style={{ borderColor: '#E5E7EB', background: subFilter ? '#fff' : '#F4F4F7', color: '#0A0A0A' }}
          >
            Everything on this flow
          </button>
          {flow.subFilters.map((sf) => {
            const on = subFilter === sf;
            return (
              <button
                key={sf}
                type="button"
                onClick={() => { soundEngine.play('tap'); setSubFilter(on ? null : sf); }}
                aria-pressed={on}
                className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border cursor-pointer"
                style={{
                  borderColor: on ? 'transparent' : '#E5E7EB',
                  background: on ? 'var(--color-primary)' : '#fff',
                  color: on ? 'var(--accent-ink)' : '#6B7280'
                }}
              >
                {sf}
              </button>
            );
          })}
        </div>
      )}

      {/* ── routes, for a flow ──────────────────────────────────────────── */}
      {isFlowRoom(room) && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[11px] font-black uppercase tracking-wider" style={{ color: '#0A0A0A' }}>
              Routes on the board
            </h3>
            {routeFilter && (
              <button type="button" onClick={() => setRouteFilter(null)} className="text-[10px] font-bold cursor-pointer" style={{ color: 'var(--color-primary)' }}>
                clear route filter
              </button>
            )}
          </div>
          {routes.length === 0 ? (
            <div className="p-4 rounded-2xl border-2 border-dashed" style={{ borderColor: '#E5E7EB', background: '#fff' }}>
              <p className="text-[13px] font-bold" style={{ color: '#0A0A0A' }}>No {flow?.label ?? room} route has been declared yet.</p>
              <p className="text-[11px] mt-1 leading-snug" style={{ color: '#6B7280' }}>
                A route appears when a seller states where goods leave from and where they go — the two fields this board
                refuses to invent. Until then there is nothing honest to list here.
              </p>
              {onPostListing && (
                <button type="button" onClick={onPostListing} className="mt-2.5 px-3.5 py-2 rounded-full text-[12px] font-black cursor-pointer" style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}>
                  Declare a route
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {routes.map((r) => (
                <RouteCard
                  key={`${r.origin}-${r.destination}`}
                  route={r}
                  active={routeFilter === `${r.origin}→${r.destination}`}
                  onBrowse={() => setRouteFilter(routeFilter === `${r.origin}→${r.destination}` ? null : `${r.origin}→${r.destination}`)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── the listings on show ────────────────────────────────────────── */}
      {(isFlowRoom(room) || room === 'all') && (
        <section className="space-y-3">
          {feed.length === 0 && !failed ? (
            <div className="p-6 rounded-3xl border-2 border-dashed text-center space-y-2" style={{ borderColor: '#E5E7EB', background: '#fff' }}>
              <p className="text-[15px] font-extrabold" style={{ color: '#0A0A0A' }}>
                {subFilter || routeFilter ? 'Nothing on the board matches that filter.' : 'Nothing is published on this flow yet.'}
              </p>
              <p className="text-[12px] leading-snug" style={{ color: '#6B7280' }}>
                This feed is what sellers have actually put up, with their own photos, prices and endpoints. It is not
                padded, and it is not sorted by a model guessing what you want.
              </p>
              <div className="flex flex-wrap gap-2 justify-center pt-1">
                {(subFilter || routeFilter) && (
                  <button type="button" onClick={() => { setSubFilter(null); setRouteFilter(null); }} className="px-4 py-2 rounded-full text-[12px] font-black cursor-pointer" style={{ background: '#F4F4F7', color: '#0A0A0A' }}>
                    Clear the filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { soundEngine.play('tap'); onRoomChange?.('all'); }}
                  className="px-4 py-2 rounded-full text-[12px] font-black cursor-pointer"
                  style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
                >
                  See everything
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {feed.map((item) => <FeedCard key={`${item.kind}-${item.id}`} item={item} onOpen={setOpen} />)}
            </div>
          )}
        </section>
      )}

      {/* ── the market's own shelf, still one tap away ─────────────────── */}
      {(room === 'all') && (
        <section className="p-4 rounded-3xl bg-white border shadow-2xs space-y-3" style={{ borderColor: '#E5E7EB' }}>
          <h3 className="text-[11px] font-black uppercase tracking-wider" style={{ color: '#0A0A0A' }}>The counter</h3>
          <Marketplace key={counterKey} initialSection={counterSection} />
        </section>
      )}

      {room === 'events' && (
        <section className="space-y-2">
          <h3 className="text-[11px] font-black uppercase tracking-wider" style={{ color: '#0A0A0A' }}>The case — published events</h3>
          <MuseumGallery />
        </section>
      )}

      {room === 'circles' && (
        <section className="p-4 rounded-3xl bg-white border space-y-2" style={{ borderColor: '#E5E7EB' }}>
          <h3 className="text-[11px] font-black uppercase tracking-wider" style={{ color: '#0A0A0A' }}>Circles</h3>
          <p className="text-[11px]" style={{ color: '#6B7280' }}>
            Groups with a door: members, shared work, a pot whose progress moves only when money settles. This is
            not a poster to walk past, which is why it sits beside the flows instead of inside them.
          </p>
          <Circles />
        </section>
      )}

      {room === 'errands' && (
        <div className="space-y-4">
          <TransportRail />
          <ErrandsLobby />
        </div>
      )}

      {/* ── the gap board: demand with no declared route ───────────────── */}
      {(room === 'all' || isFlowRoom(room)) && gaps.length > 0 && (
        <section className="space-y-2" aria-label="Demand with no route">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[11px] font-black uppercase tracking-wider" style={{ color: '#0A0A0A' }}>
              Asked for, no route says it
            </h3>
            <span className="text-[9px] font-mono" style={{ color: '#9CA3AF' }}>
              matched on stated fields
            </span>
          </div>
          <ul className="space-y-2">
            {gaps.slice(0, 5).map((g) => (
              <li key={g.requestId} className="p-3 rounded-2xl border" style={{ borderColor: '#E5E7EB', background: '#fff' }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-bold leading-snug min-w-0" style={{ color: '#0A0A0A' }}>{g.title}</p>
                  <span className="shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#92400E' }}>
                    {g.coverage === 'listing_without_route' ? 'listed, unrouted' : 'no route declared'}
                  </span>
                </div>
                <p className="text-[11px] font-mono mt-1 truncate" style={{ color: '#6B7280' }}>
                  {[g.category, g.quantity ? `${g.quantity} ${g.unit ?? 'units'}` : null, g.location, g.requiredBy ? `by ${shortDate(g.requiredBy)}` : null]
                    .filter(Boolean).join(' · ')}
                </p>
                <button
                  type="button"
                  onClick={() => { soundEngine.play('tap'); window.location.hash = `requests/${encodeURIComponent(g.requestId)}`; }}
                  className="mt-2 text-[11px] font-black cursor-pointer"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Open the ask →
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[10px] leading-snug" style={{ color: '#9CA3AF' }}>
            A listing whose text mentions the commodity and the place but declares no endpoints is counted as “listed,
            unrouted” — it may well cover the ask; nobody has said so in the fields. This board does not read titles as
            promises, and it does not turn a count into a shortage.
          </p>
        </section>
      )}

      {summary?.boardNote && (
        <p className="text-[10px] leading-snug px-1" style={{ color: '#9CA3AF' }}>{summary.boardNote}</p>
      )}

      {/* ── the Create pill ─────────────────────────────────────────────── */}
      {room !== 'errands' && (onHostEvent || onPostListing) && (
        <div className="fixed bottom-24 left-0 right-0 flex justify-center z-40 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2">
            {onHostEvent && (
              <button
                type="button"
                onClick={() => { soundEngine.play('heavyTap'); onHostEvent(); }}
                className="inline-flex items-center gap-2 pl-4 pr-5 py-3 rounded-full text-[13px] font-black cursor-pointer active:scale-95 transition"
                style={{ background: '#0A0A0A', color: '#fff', boxShadow: '0 12px 28px rgba(10,10,10,0.28)' }}
              >
                <Plus className="w-5 h-5" /> Host an event
              </button>
            )}
            {onPostListing && (
              <button
                type="button"
                onClick={() => { soundEngine.play('tap'); onPostListing(); }}
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-full text-[12px] font-black cursor-pointer active:scale-95 transition"
                style={{ background: '#fff', color: '#0A0A0A', border: '1px solid #E5E7EB', boxShadow: '0 10px 24px rgba(10,10,10,0.12)' }}
              >
                <ShoppingBag className="w-4 h-4" /> Post a listing
              </button>
            )}
          </div>
        </div>
      )}

      {open && <FeedSheet item={open} onClose={() => setOpen(null)} onOpenFull={openFull} />}
    </div>
  );
}

export default DiscoverFeed;
