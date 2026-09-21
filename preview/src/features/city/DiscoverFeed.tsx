import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bike, CalendarDays, Check, ChevronRight, MapPin, MessageCircle, Package, Plus, RefreshCw, Search, Sun,
  ShoppingBag, Sparkles, Users, X
} from 'lucide-react';
import * as briefApi from '../../api/briefApi';
import type { DiscoverFeedItem, DiscoverFlow, DiscoverRoute, DiscoverSummary } from '../../api/briefApi';
import { MuseumGallery } from './MuseumGallery';
import { StateDot } from '../../ui/StateDot';
import { Marketplace } from '../../components/Marketplace';
import { Circles } from '../../components/Circles';
import { ErrandsLobby } from './ErrandsLobby';
import { TransportRail } from './TransportRail';
import { FLOW_ORDER, SIDE_ORDER, isFlowRoom, type DiscoverRoom } from './taxonomy';
import { NoPhotoPlate } from './NoPhotoPlate';
import { PHOTO_FILTER, PHOTO_SCRIM, PLASTER, roomSurface, roomPlate, listedAgo } from './room';
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
//
// THE ROOM RULE (src/ui/theme.css + features/city/room.ts), which is what this
// board used to fail: a surface is separated from the room by LIGHT, not by a
// stroke. No card here carries `border: 1px solid` any more — each takes a
// --lift-* shadow whose inset highlight says "there is a light source in this
// room". A photograph gets PHOTO_SCRIM, which is the room's own ink fading up
// through the picture, so the image belongs to the screen instead of sitting on
// it. A selected tile or chip glows with the accent (--lift-signal): that is the
// difference between a filter you happened to land on and a choice you made. A
// listing with no photograph is a plate in the room's own colour carrying the
// flow the seller declared and the row's real timestamp — WAITING, not broken,
// and never somebody else's stock image.
// ---------------------------------------------------------------------------

/** Icon per FLOW, at plate size. The mark is the flow the SELLER declared, so an
    untagged listing gets no mark rather than a guessed one. */
const BOARD_ICONS: Record<string, string> = { bulk: 'box', direct: 'bike', niche: 'leaf', group: 'users' };

/** A hue per FLOW, as an identity — the same reasoning as the museum's wing
    tints: the same flow is always the same colour, so the colour teaches the
    taxonomy. It is never hashed from a title, and an untagged listing gets the
    room's default rather than a guessed hue. */
const FLOW_ACCENT: Record<string, string> = { bulk: '#2563EB', direct: '#0E7C86', niche: '#8A5A2B', group: '#059669' };

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
/** The plate's mark: the declared flow, or a calendar on an event. */
function plateIcon(item: DiscoverFeedItem): React.ReactNode {
  if (item.kind === 'event') return <CalendarDays className="w-4 h-4" />;
  return (item.flow && ICONS[BOARD_ICONS[item.flow]]) || <Package className="w-4 h-4" />;
}

/**
 * The one honest reading of an interest count. The server sends a counted row
 * (settled orders on a listing, registrations on an event); a zero is a real
 * zero, and it is written as a sentence instead of a dashboard tile.
 */
// A count and one word. The sentence it replaces ("no settled orders through
// Brief yet — this starts at your first settled order") was fifteen words for 0.
function interestLine(item: DiscoverFeedItem): string {
  const label = item.interest.label === 'settled orders' ? 'settled' : item.interest.label;
  return `${item.interest.count} ${label}`;
}

function FeedCard({ item, onOpen }: { item: DiscoverFeedItem; onOpen: (item: DiscoverFeedItem) => void }) {
  const dateLabel = item.kind === 'event' ? shortDate(item.dateLabel ?? undefined) ?? item.dateLabel : item.dateLabel;
  const stamp = item.kind === 'listing' ? listedAgo(item.listedAt) : null;
  return (
    <button
      type="button"
      onClick={() => { soundEngine.play('tap'); onOpen(item); }}
      className="w-full text-left relative aspect-[16/10] rounded-3xl overflow-hidden cursor-pointer transition-transform active:scale-[0.99] group brief-lift-2"
      style={{ background: 'var(--color-paper)' }}
      aria-label={`Open ${item.title}`}
    >
      {item.mediaUrl ? (
        <img
          src={item.mediaUrl}
          alt={item.title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ background: PLASTER, filter: PHOTO_FILTER }}
        />
      ) : (
        <NoPhotoPlate
          seller={item.seller}
          mark={item.flow ?? 'listing'}
          icon={plateIcon(item)}
          stamp={stamp}
          accent={(item.flow && FLOW_ACCENT[item.flow]) || null}
        />
      )}
      <span className="absolute inset-0" style={{ background: PHOTO_SCRIM }} />

      {item.priceLabel && (
        <span
          className="absolute top-3 right-3 px-3 py-1.5 rounded-full font-mono text-[12px] font-black"
          style={{ background: 'rgba(255,255,255,0.95)', color: 'var(--brief-ink)' }}
        >
          {item.priceLabel}
          {item.unit ? ` / ${item.unit}` : ''}
        </span>
      )}
      {dateLabel && (
        <span
          className={`absolute ${item.priceLabel ? 'top-12' : 'top-3'} right-3 px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1`}
          style={{ background: 'rgba(24,19,12,0.6)', color: 'var(--accent-ink)' }}
        >
          <CalendarDays className="w-3 h-3" /> {dateLabel}
        </span>
      )}

      {!item.mediaUrl && (
        <span className="absolute left-3 top-3 block pointer-events-none">
          <span className="block font-mono text-[30px] font-black leading-none" style={{ color: 'var(--brief-ink)' }}>
            {item.interest.count}
          </span>
          <span className="block text-[11px] font-black uppercase tracking-[0.14em] mt-0.5" style={{ color: 'var(--brief-muted)' }}>
            {item.interest.label}
          </span>
        </span>
      )}

      <span className="absolute left-3 right-3 bottom-3 block text-white">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono uppercase font-black" style={{ background: 'rgba(255,255,255,0.22)' }}>
            {item.flow ?? item.kind}
          </span>
          {item.origin && item.destination && (
            <span className="text-[12px] font-mono truncate">
              {item.origin} → {item.destination}
            </span>
          )}
          {!item.origin && item.location && (
            <span className="text-[12px] inline-flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3" /> {item.location}
            </span>
          )}
        </span>
        <span className="block text-[16px] font-extrabold leading-snug mt-1 line-clamp-2">{item.title}</span>
        <span className="block text-[12px] opacity-90 mt-0.5 truncate">
          {item.minOrder ? `min ${item.minOrder}${item.unit ? ` ${item.unit}` : ''} · ` : ''}
          {interestLine(item)}{stamp ? ` · ${stamp}` : ''}
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
    <div
      className="p-3.5 rounded-2xl transition-shadow"
      style={{
        background: 'var(--color-paper)',
        boxShadow: active
          ? 'var(--lift-signal), inset 0 0 0 2px var(--color-primary)'
          : 'var(--room-light), var(--lift-2), inset 0 0 0 1px var(--brief-line)'
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[14px] font-extrabold leading-snug min-w-0" style={{ color: 'var(--brief-ink)' }}>
          {route.origin}
          <span className="mx-1.5 font-mono" style={{ color: 'var(--color-quiet)' }}>→</span>
          {route.destination}
        </p>
        {route.openDemand > 0 ? (
          <span
            className="shrink-0 px-2 py-1 rounded-full text-[11px] font-black font-mono"
            style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}
          >
            {route.openDemand} open ask{route.openDemand === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>

      <p className="text-[12px] font-mono mt-1.5 truncate" style={{ color: 'var(--brief-muted)' }}>
        {route.listings} listing{route.listings === 1 ? '' : 's'}
        {route.sellers.length ? ` · ${route.sellers.length} seller${route.sellers.length === 1 ? '' : 's'}` : ''}
        {route.minOrderFrom ? ` · min ${route.minOrderFrom}${route.unit ? ` ${route.unit}` : ''}` : ''}
      </p>
      {route.topCommodities.length > 0 && (
        <p className="text-[12px] mt-1 truncate" style={{ color: 'var(--brief-ink)' }}>
          moving: {route.topCommodities.join(', ')}
        </p>
      )}
      {route.openDemandQuantity != null && (
        <p className="text-[12px] font-mono mt-1" style={{ color: 'var(--brief-muted)' }}>
          {route.openDemandQuantity}
          {route.unit ? ` ${route.unit}` : ''} asked for, from the quantities buyers typed
        </p>
      )}
      {route.commodityUndeclared ? (
        <p className="text-[11px] mt-1" style={{ color: '#B45309' }}>
          {route.commodityUndeclared} listing{route.commodityUndeclared === 1 ? '' : 's'} on this route declare no commodity, so no
          demand is counted against it.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => { soundEngine.play('tap'); onBrowse(); }}
        className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-black cursor-pointer"
        style={{
          background: active ? 'var(--color-primary)' : 'var(--color-well)',
          color: active ? 'var(--accent-ink)' : 'var(--brief-ink)'
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
      style={{ background: 'rgba(24,19,12,0.62)' }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl mx-auto rounded-t-[28px] overflow-auto" style={{ background: 'var(--color-paper)', maxHeight: '88vh', boxShadow: 'var(--lift-4)' }}>
        <div className="flex justify-center pt-3 pb-1">
          <span className="w-10 h-1 rounded-full" style={{ background: 'var(--brief-line)' }} />
        </div>
        <div className="relative aspect-video" style={{ background: roomPlate(null) }}>
          {item.mediaUrl ? (
            <img src={item.mediaUrl} alt={item.title} className="absolute inset-0 h-full w-full object-cover" style={{ filter: PHOTO_FILTER }} />
          ) : (
            <NoPhotoPlate seller={item.seller} mark={item.flow ?? 'listing'} icon={plateIcon(item)} stamp={item.kind === 'listing' ? listedAgo(item.listedAt) : null} />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="absolute top-3 right-3 w-9 h-9 rounded-full grid place-items-center cursor-pointer"
            style={{ background: 'rgba(24,19,12,0.6)', color: 'var(--accent-ink)', boxShadow: 'var(--lift-1)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider" style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}>
              {item.flow ?? item.kind}
            </span>
            {item.origin && <span className="text-[12px] font-mono" style={{ color: 'var(--brief-muted)' }}>from {item.origin}{item.originKind ? ` (${item.originKind})` : ''}</span>}
            {item.destination && <span className="text-[12px] font-mono" style={{ color: 'var(--brief-muted)' }}>to {item.destination}{item.destinationKind ? ` (${item.destinationKind})` : ''}</span>}
          </div>

          <h2 className="text-[21px] font-extrabold leading-tight" style={{ color: 'var(--brief-ink)' }}>{item.title}</h2>
          {item.description && <p className="text-[14px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{item.description}</p>}

          <dl className="grid grid-cols-2 gap-2 text-[13px]">
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
              <div key={k} className="p-2.5 rounded-xl" style={{ background: 'var(--color-well)' }}>
                <dt className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-quiet)' }}>{k}</dt>
                <dd className="font-mono font-bold mt-0.5 truncate" style={{ color: 'var(--brief-ink)' }}>{v}</dd>
              </div>
            ))}
          </dl>

          <p className="text-[12px] leading-snug" style={{ color: 'var(--brief-muted)' }}>
            {item.why} — by a stated rule, not a ranking.
          </p>

          {whatsapp ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--brief-ink)' }}>
                The contact this seller put on their own listing
              </p>
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-[14px] font-black"
                style={{ background: '#25D366', color: '#04310F' }}
              >
                <MessageCircle className="w-4 h-4" /> Message {item.seller ?? 'the seller'} on WhatsApp
              </a>
              <p className="text-[11px]" style={{ color: 'var(--color-quiet)' }}>{item.contactNote ?? ''}</p>
            </div>
          ) : (
            <p className="text-[12px] leading-snug p-3 rounded-xl" style={{ background: 'var(--color-well)', color: 'var(--brief-muted)' }}>
              No contact number on this listing, so none is shown — Brief will not guess one or borrow one from
              somewhere else. Use the enquiry below: it becomes a message the seller can answer in the app.
            </p>
          )}

          <button
            type="button"
            onClick={() => onOpenFull(item)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl text-[14px] font-black cursor-pointer"
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const roomLabel = isFlowRoom(room as any)
    ? (flows.find((x) => x.key === room)?.label ?? room)
    : (SIDE_ORDER.find((s) => s.key === room)?.label ?? 'Everything');

  return (
    <div className={`space-y-5 ${className}`}>
      {/* ── ONE entry: Browse ─────────────────────────────────────────────────
           This screen used to open with four flow tiles, each shouting a 32px
           zero, plus a second row of four chips. Four dead tiles and a duplicate
           nav is not a board, it is a wall — and for someone reading this on a
           hand-me-down Android with one hand, it is the screen they give up on.

           So the surface is one button. The counts are not gone: they are inside
           the picker, where a zero can sit next to the one step that changes it.
           A zero is a TRUE count and stays printed — what goes is the four-tile
           frame that made "nothing here yet" the biggest thing on the page. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => { soundEngine.play('tap'); setPickerOpen(true); }}
          aria-label="Browse the board"
          aria-expanded={pickerOpen}
          className="flex-1 flex items-center gap-2.5 px-4 py-3 rounded-2xl cursor-pointer text-left"
          style={{
            background: 'var(--color-paper)',
            boxShadow: 'var(--room-light), var(--lift-2), inset 0 0 0 1px var(--brief-line)'
          }}
        >
          <span className="w-8 h-8 rounded-xl grid place-items-center shrink-0" style={{ background: 'var(--color-well)', color: 'var(--color-primary)' }}>
            <Search className="w-4 h-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold" style={{ color: 'var(--brief-ink)' }}>
              {roomLabel}
            </span>
            <span className="block text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
              {countFor(room)} {countFor(room) === 1 ? 'listing' : 'listings'} · change
            </span>
          </span>
          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
        </button>
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          aria-label={busy ? 'Reading' : 'Re-read the board'}
          className="w-11 h-11 rounded-2xl grid place-items-center shrink-0 cursor-pointer disabled:opacity-40"
          style={{ background: 'var(--color-well)', color: 'var(--color-text-muted)', border: 'none' }}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* The picker: the taxonomy with its counts, behind one tap. */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Browse the board">
          <button type="button" aria-label="Close the picker" onClick={() => setPickerOpen(false)} className="absolute inset-0 bg-black/45" />
          <div
            className="relative w-full max-w-lg rounded-t-3xl p-4 space-y-3 max-h-[80vh] overflow-y-auto"
            style={{ background: 'var(--color-bg)', boxShadow: 'var(--lift-3)' }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--brief-ink)' }}>
                Browse
              </p>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                aria-label="Close the picker"
                className="w-8 h-8 rounded-full grid place-items-center cursor-pointer"
                style={{ background: 'var(--color-paper)', color: 'var(--brief-ink)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                The flows
              </p>
              {FLOW_ORDER.map((f) => {
                const src = flows.find((x) => x.key === f.key);
                const empty = countFor(f.key) === 0;
                const isActive = room === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => { soundEngine.play('tap'); onRoomChange?.(f.key); setPickerOpen(false); }}
                    aria-pressed={isActive}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-left cursor-pointer"
                    style={{
                      background: isActive ? 'var(--color-primary-subtle)' : 'var(--color-paper)',
                      boxShadow: 'var(--room-light), var(--lift-1), inset 0 0 0 1px var(--brief-line)'
                    }}
                  >
                    <span className="w-8 h-8 rounded-xl grid place-items-center shrink-0" style={{ background: 'var(--color-well)', color: 'var(--color-primary)' }}>
                      {ICONS[f.icon]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-extrabold" style={{ color: 'var(--brief-ink)' }}>
                        {src?.label ?? (f.key.charAt(0).toUpperCase() + f.key.slice(1))}
                      </span>
                      <StateDot state={empty ? 'unknown' : 'quiet'} label={empty ? 'none here' : src?.sub ?? ''} />
                    </span>
                    <span className="shrink-0 font-mono text-[15px] font-extrabold" style={{ color: empty ? 'var(--color-quiet)' : 'var(--brief-ink)' }}>
                      {countFor(f.key)}
                    </span>
                    {empty && onPostListing && (
                      <span className="shrink-0 text-[11px] font-black" style={{ color: 'var(--color-primary)' }}>
                        {src?.zeroReason === 'untagged_only' ? 'Tag one' : 'Post one'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Other views
              </p>
              {SIDE_ORDER.map((t) => {
                const isActive = room === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => { soundEngine.play('tap'); onRoomChange?.(t.key); setPickerOpen(false); }}
                    aria-pressed={isActive}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-left cursor-pointer"
                    style={{
                      background: isActive ? 'var(--color-primary-subtle)' : 'var(--color-paper)',
                      boxShadow: 'var(--room-light), var(--lift-1), inset 0 0 0 1px var(--brief-line)'
                    }}
                  >
                    <span className="min-w-0 flex-1 text-[14px] font-extrabold" style={{ color: 'var(--brief-ink)' }}>
                      {t.label}
                      <span className="ml-2 text-[12px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                        {unitFor(t.key)}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[15px] font-extrabold" style={{ color: 'var(--brief-ink)' }}>
                      {countFor(t.key)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {failed && (
        <p className="text-[13px] font-bold" role="alert" style={{ color: '#E53935' }}>
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
            className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold cursor-pointer transition-shadow"
            style={{
              background: subFilter ? 'var(--color-paper)' : 'var(--color-well)',
              color: 'var(--brief-ink)',
              boxShadow: 'var(--room-light), var(--lift-1), inset 0 0 0 1px var(--brief-line)'
            }}
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
                className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold cursor-pointer transition-shadow"
                style={{
                  background: on ? 'var(--color-primary)' : 'var(--color-paper)',
                  color: on ? 'var(--accent-ink)' : 'var(--brief-muted)',
                  boxShadow: on
                    ? 'var(--lift-signal)'
                    : 'var(--room-light), var(--lift-1), inset 0 0 0 1px var(--brief-line)'
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
            <h3 className="text-[12px] font-black uppercase tracking-wider" style={{ color: 'var(--brief-ink)' }}>
              Routes on the board
            </h3>
            {routeFilter && (
              <button type="button" onClick={() => setRouteFilter(null)} className="text-[11px] font-bold cursor-pointer" style={{ color: 'var(--color-primary)' }}>
                clear route filter
              </button>
            )}
          </div>
          {routes.length === 0 ? (
            <div className="p-4 rounded-2xl border border-dashed" style={{ borderColor: 'var(--brief-line)', background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-1)' }}>
              <p className="text-[14px] font-bold" style={{ color: 'var(--brief-ink)' }}>No {flow?.label ?? room} routes</p>
              {onPostListing && (
                <button type="button" onClick={onPostListing} className="mt-2.5 px-3.5 py-2 rounded-full text-[13px] font-black cursor-pointer transition-shadow" style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)', boxShadow: 'var(--lift-signal)' }}>
                  Post an offer
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
            <div className="p-6 rounded-3xl border border-dashed text-center space-y-2" style={{ borderColor: 'var(--brief-line)', background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-1)' }}>
              <Package className="w-7 h-7 mx-auto" style={{ color: 'var(--color-quiet)' }} />
              <p className="text-[15px] font-extrabold pt-1.5" style={{ color: 'var(--brief-ink)' }}>
                {subFilter || routeFilter ? 'Nothing matches that filter' : 'Nothing here yet'}
              </p>
              <div className="flex flex-wrap gap-2 justify-center pt-1">
                {/* Exactly one action per empty state. */}
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('tap');
                    if (subFilter || routeFilter) { setSubFilter(null); setRouteFilter(null); }
                    else onRoomChange?.('all');
                  }}
                  className="px-4 py-2 rounded-full text-[13px] font-black cursor-pointer transition-shadow"
                  style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)', boxShadow: 'var(--lift-signal)' }}
                >
                  {subFilter || routeFilter ? 'Clear the filters' : 'See everything'}
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
        <section className="p-4 rounded-3xl bg-[color:var(--color-paper)] brief-card--raised space-y-3">
          <h3 className="text-[12px] font-black uppercase tracking-wider" style={{ color: 'var(--brief-ink)' }}>The counter</h3>
          <Marketplace key={counterKey} initialSection={counterSection} />
        </section>
      )}

      {room === 'events' && (
        <section className="space-y-2">
          <h3 className="text-[12px] font-black uppercase tracking-wider" style={{ color: 'var(--brief-ink)' }}>What's on — published events</h3>
          <MuseumGallery />
        </section>
      )}

      {room === 'circles' && (
        <section className="p-4 rounded-3xl bg-[color:var(--color-paper)] brief-card--raised space-y-2">
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
            <h3 className="text-[12px] font-black uppercase tracking-wider" style={{ color: 'var(--brief-ink)' }}>
              Asked for, no route says it
            </h3>

          </div>
          <ul className="space-y-2">
            {gaps.slice(0, 5).map((g) => (
              <li key={g.requestId} className="p-3 rounded-2xl brief-card" style={{ background: 'var(--color-paper)' }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-bold leading-snug min-w-0" style={{ color: 'var(--brief-ink)' }}>{g.title}</p>
                  <span className="shrink-0 text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#92400E' }}>
                    {g.coverage === 'listing_without_route' ? 'listed, unrouted' : 'no route declared'}
                  </span>
                </div>
                <p className="text-[12px] font-mono mt-1 truncate" style={{ color: 'var(--brief-muted)' }}>
                  {[g.category, g.quantity ? `${g.quantity} ${g.unit ?? 'units'}` : null, g.location, g.requiredBy ? `by ${shortDate(g.requiredBy)}` : null]
                    .filter(Boolean).join(' · ')}
                </p>
                <button
                  type="button"
                  onClick={() => { soundEngine.play('tap'); window.location.hash = `requests/${encodeURIComponent(g.requestId)}`; }}
                  className="mt-2 text-[12px] font-black cursor-pointer"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Open the ask →
                </button>
              </li>
            ))}
          </ul>

        </section>
      )}



      {/* ── the Create pill ─────────────────────────────────────────────── */}
      {room !== 'errands' && (onHostEvent || onPostListing) && (
        <div className="fixed bottom-24 left-0 right-0 flex justify-center z-40 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2">
            {onHostEvent && (
              <button
                type="button"
                onClick={() => { soundEngine.play('heavyTap'); onHostEvent(); }}
                className="inline-flex items-center gap-2 pl-4 pr-5 py-3 rounded-full text-[14px] font-black cursor-pointer active:scale-95 transition"
                style={{ background: 'var(--brief-ink)', color: 'var(--accent-ink)', boxShadow: 'var(--lift-4)' }}
              >
                <Plus className="w-5 h-5" /> Host an event
              </button>
            )}
            {onPostListing && (
              <button
                type="button"
                onClick={() => { soundEngine.play('tap'); onPostListing(); }}
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-full text-[13px] font-black cursor-pointer active:scale-95 transition"
                style={{ background: 'var(--color-paper)', color: 'var(--brief-ink)', boxShadow: 'var(--room-light), var(--lift-3), inset 0 0 0 1px var(--brief-line)' }}
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
