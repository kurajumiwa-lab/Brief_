import React from 'react';
import { ArrowRight, Clock, MapPin, RefreshCw } from 'lucide-react';
import type { DiscoverFeatured as Featured } from '../../api/briefApi';

// ---------------------------------------------------------------------------
// FEATURED CARD — the big, photo-first slot the old Discover layout got right.
// Scale is information: it tells the viewer "this one is worth your second".
//
// What was deliberately NOT copied from the mock it replaces:
//   * the borrowed Unsplash photograph. A listing with no photo of its own gets
//     a plain tint, not somebody else's market — a buyer who arrives expecting
//     the picture was promised a lie;
//   * "Over 40 verified creative vendors". No count of vendors is asserted here;
//     the only number on this card is the interest the rows carry — settled
//     orders, or counted registrations;
//   * the fake phone number and Telegram handle in the card's footer. Contact
//     goes through an inquiry, which becomes a row both sides can see. If the
//     seller has not stated their own contact, this card shows nothing;
//   * "verified" as a badge — Brief verifies people for payment rails, not
//     market stalls for ambience.
//
// The chip at the top is not decoration either: it states the RULE that put
// this item here (seller pinned it / most settled orders / newest / soonest
// event), so "featured" never becomes an unexplained ranking.
// ---------------------------------------------------------------------------

const money = (n: number | null, c: string) =>
  n === 0 ? 'Free' : n == null ? 'Price on request' : `${c} ${Number(n).toLocaleString('en-KE')}`;

const shortDate = (iso: string | null | undefined) => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  } catch {
    return null;
  }
};

export interface DiscoverFeaturedProps {
  featured: Featured | null;
  asOf: string | null;
  onOpen: (item: Featured) => void;
  onPost?: () => void;
  onRefresh?: () => void;
  busy?: boolean;
  className?: string;
}

export function DiscoverFeatured({ featured, asOf, onOpen, onPost, onRefresh, busy = false, className = '' }: DiscoverFeaturedProps) {
  const stamp = (() => {
    if (!asOf) return null;
    const ms = Date.parse(asOf);
    if (!Number.isFinite(ms)) return null;
    try {
      return new Date(ms).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  })();

  // The screen is still never dead — but an empty board says it is empty and
  // offers the one action that changes it, instead of showing a stock photo.
  if (!featured) {
    return (
      <section
        className={`p-5 rounded-3xl border-2 border-dashed ${className}`}
        style={{ borderColor: '#E5E7EB', background: '#fff' }}
        aria-label="Nothing featured yet"
      >
        <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--color-primary)' }}>
          Featured
        </p>
        <p className="text-[19px] font-extrabold leading-tight mt-2" style={{ color: '#0A0A0A' }}>
          Nothing is on the counter yet.
        </p>
        <p className="text-[13px] leading-snug mt-1.5" style={{ color: '#6B7280' }}>
          This slot fills with the first real listing: the seller&rsquo;s own photo, their own price, and the
          orders that actually settled. No borrowed photography, no invented crowd.
        </p>
        <div className="flex items-center gap-2 mt-3.5">
          {onPost && (
            <button
              type="button"
              onClick={onPost}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px] font-black cursor-pointer"
              style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
            >
              Post the first listing
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-full text-[12px] font-bold cursor-pointer border disabled:opacity-50"
              style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Re-read
            </button>
          )}
        </div>
      </section>
    );
  }

  const dateLabel = featured.kind === 'event' ? shortDate(featured.startsAt) : null;

  return (
    <section
      className={`overflow-hidden rounded-3xl border-2 ${className}`}
      style={{ borderColor: '#E5E7EB', background: '#fff' }}
      aria-label="Featured"
    >
      {/* Photo, or a plain tint. Never a stand-in photograph. */}
      <div className="relative h-[188px] w-full" style={{ background: 'linear-gradient(135deg, #4F46E5, #22D3EE)' }}>
        {featured.mediaUrl ? (
          <img src={featured.mediaUrl} alt={featured.title} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.75)' }}>
              no photo from the seller
            </span>
          </div>
        )}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
          <span
            className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider"
            style={{ background: 'rgba(255,255,255,0.95)', color: '#0A0A0A' }}
          >
            Featured · {featured.why}
          </span>
          {dateLabel && (
            <span
              className="px-2.5 py-1 rounded-full text-[10px] font-black inline-flex items-center gap-1"
              style={{ background: '#0A0A0A', color: '#fff' }}
            >
              <Clock className="w-3 h-3" /> {dateLabel}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-1.5">
        {featured.location && (
          <p className="text-[11px] font-medium inline-flex items-center gap-1" style={{ color: '#6B7280' }}>
            <MapPin className="w-3 h-3" /> {featured.location}
            {featured.seller ? ` · ${featured.seller}` : ''}
          </p>
        )}
        <h3 className="text-[19px] font-extrabold leading-tight" style={{ color: '#0A0A0A' }}>
          {featured.title}
        </h3>
        {featured.description && (
          <p className="text-[13px] leading-snug line-clamp-2" style={{ color: '#4B5563' }}>
            {featured.description}
          </p>
        )}

        <div className="flex items-end justify-between gap-3 pt-1">
          <div className="min-w-0">
            <p className="font-mono text-[17px] font-extrabold leading-none" style={{ color: '#0A0A0A' }}>
              {money(featured.price, featured.currency)}
            </p>
            <p className="text-[11px] font-mono mt-1" style={{ color: '#6B7280' }}>
              {featured.interest.count} {featured.interest.label}
              {featured.kind === 'listing' && featured.stock != null ? ` · ${featured.stock} in stock` : ''}
              {featured.group ? ` · ${featured.group}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={busy}
                aria-label="Re-read the board"
                className="p-2.5 rounded-full border cursor-pointer disabled:opacity-50"
                style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
                title="Read the rows again — this is a snapshot, not a live feed"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpen(featured)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px] font-black cursor-pointer"
              style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
            >
              {featured.kind === 'event' ? 'View event' : 'View listing'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="text-[10px] leading-snug pt-0.5" style={{ color: '#9CA3AF' }}>
          {stamp ? `Read from the rows at ${stamp}. ` : ''}
          No view counter, no crowd claim, no verified badge: those numbers would have to be invented to appear here.
        </p>
      </div>
    </section>
  );
}

export default DiscoverFeatured;
