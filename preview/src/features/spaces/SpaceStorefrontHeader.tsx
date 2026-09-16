import React from 'react';
import { Bell, BellOff, Lock, MessageCircle, Pencil, Plus, Share2 } from 'lucide-react';
import type { Space } from '../../api/types';
import type { SpaceAudienceView } from '../../api/briefApi';

// ---------------------------------------------------------------------------
// SPACE HEADER — the storefront front, not a settings page.
//
// Cover, avatar, name, one line of truth about where and when, then the CTA
// trio, then the stats strip. The order is deliberate: a buyer decides in about
// four seconds whether this shop is real and near them, and the vendor needs to
// see at a glance whether their own shopfront is working.
//
// The stats strip is the part every product is tempted to invent. So:
//   * views are the count of real `space_viewed` rows on the public page, with
//     the owner's own opens taken out — your look at your own shop is not demand;
//   * follows are rows people wrote by tapping follow;
//   * inquiries and orders are counted from those tables;
//   * conversion is a ratio of two of those counts and renders as an em dash
//     when the denominator is empty;
//   * there is NO sector average, no "3 buyers missed", no percentile. Brief
//     holds no industry data, and the strip says that out loud instead of
//     leaving the vendor to wonder whether the missing number is bad news.
//
// A cover with no photo is a plain gradient, not somebody's stock image: a fake
// photograph of a shop that does not exist is a lie a buyer would walk into.
// ---------------------------------------------------------------------------

const num = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('en-KE'));

export interface SpaceStorefrontHeaderProps {
  space: Space;
  audience?: SpaceAudienceView | null;
  /** Owner view by default; the public page passes true. */
  asVisitor?: boolean;
  onAddOffer?: () => void;
  onEdit?: () => void;
  onShare?: () => void;
  onFollow?: () => void;
  onMessage?: () => void;
  onOpenInbox?: () => void;
  busy?: boolean;
}

export function SpaceStorefrontHeader({
  space,
  audience = null,
  asVisitor = false,
  onAddOffer,
  onEdit,
  onShare,
  onFollow,
  onMessage,
  onOpenInbox,
  busy = false
}: SpaceStorefrontHeaderProps) {
  const insights = audience?.insights ?? null;
  const isOwner = !asVisitor;
  const followers = audience?.followers ?? space.followers ?? 0;
  const initials = (space.name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  // Read the labels the server rendered. Re-formatting the shapes here is how a
  // header and a space file end up disagreeing about the same answer.
  const where = space.profileLabels?.where ?? null;
  const when = space.profileLabels?.when ?? null;
  const openInquiries = (space.recentConversations ?? []).filter((c) => ['new', 'active'].includes(c.status)).length;

  return (
    <header className="rounded-3xl overflow-hidden border" style={{ borderColor: 'var(--color-border)', background: '#fff' }}>
      {/* Cover */}
      <div className="relative h-[168px] w-full" style={{ background: 'linear-gradient(135deg, #4F46E5, #22D3EE)' }}>
        {space.image ? (
          <img src={space.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
            style={{ background: 'rgba(255,255,255,0.94)', color: '#0A0A0A' }}
          >
            {space.visibility === 'public' ? 'Public' : space.visibility === 'unlisted' ? 'Unlisted' : <><Lock className="w-3 h-3" /> Private</>}
          </span>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-end gap-3 -mt-8">
          <span
            className="w-16 h-16 rounded-full grid place-items-center text-lg font-black shrink-0 border-4"
            style={{ background: '#fff', borderColor: '#fff', color: 'var(--color-primary)', boxShadow: '0 0 0 1px var(--color-border)' }}
            aria-hidden="true"
          >
            {initials || '·'}
          </span>
          <div className="min-w-0 pb-1">
            <h1 className="text-[22px] font-extrabold leading-tight truncate" style={{ color: '#0A0A0A' }}>
              {space.name}
            </h1>
            <p className="text-[13px] truncate" style={{ color: '#6B7280' }}>
              {space.goal || (space.type ?? 'business').replace('_', ' ')}
            </p>
            <p className="text-[11px] font-medium tracking-wide truncate" style={{ color: '#6B7280' }}>
              {[where, when].filter(Boolean).join(' · ') || 'No place or hours stated yet'}
            </p>
          </div>
        </div>

        {/* CTAs. The owner gets the doing-buttons; a visitor gets follow/message,
            and follow only exists on a public, active space. */}
        <div className="flex flex-wrap gap-2 mt-3.5">
          {isOwner ? (
            <>
              <button
                type="button"
                onClick={onAddOffer}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-black cursor-pointer disabled:opacity-50"
                style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
              >
                <Plus className="w-4 h-4" /> Add offer
              </button>
              <button
                type="button"
                onClick={onOpenInbox}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-bold border cursor-pointer"
                style={{ borderColor: '#E5E7EB', color: '#0A0A0A', background: '#fff' }}
              >
                <MessageCircle className="w-4 h-4" /> Inbox
                {openInquiries > 0 && <span className="font-mono">· {openInquiries}</span>}
              </button>
              <button
                type="button"
                onClick={onEdit}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-bold border cursor-pointer disabled:opacity-50"
                style={{ borderColor: '#E5E7EB', color: '#0A0A0A', background: '#fff' }}
              >
                <Pencil className="w-4 h-4" /> Edit space
              </button>
            </>
          ) : (
            <>
              {audience?.followable && (
                <button
                  type="button"
                  onClick={onFollow}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-black cursor-pointer disabled:opacity-50"
                  style={space.iAmFollowing || audience.iAmFollowing
                    ? { background: '#fff', color: '#0A0A0A', border: '1px solid #E5E7EB' }
                    : { background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
                >
                  {space.iAmFollowing || audience.iAmFollowing ? <><BellOff className="w-4 h-4" /> Following</> : <><Bell className="w-4 h-4" /> Follow</>}
                </button>
              )}
              <button
                type="button"
                onClick={onMessage}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-bold border cursor-pointer"
                style={{ borderColor: '#E5E7EB', color: '#0A0A0A', background: '#fff' }}
              >
                <MessageCircle className="w-4 h-4" /> Message
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-bold border cursor-pointer"
            style={{ borderColor: '#E5E7EB', color: '#0A0A0A', background: '#fff' }}
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>

        {/* Stats strip. Instagram's shape; Brief's arithmetic. */}
        <div className="flex items-stretch divide-x mt-4 rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
          {(isOwner
            ? [
                { label: 'views · 7d', value: num(insights?.views.count), sub: insights?.views.distinctViewers != null ? `${num(insights.views.distinctViewers)} people` : 'people not counted' },
                { label: 'new follows', value: num(insights?.follows.newInWindow), sub: `${num(insights?.follows.total ?? followers)} total` },
                { label: 'inquiries', value: num(insights?.inquiries.newInWindow), sub: `${num(insights?.inquiries.awaitingYourReply)} awaiting you` },
                { label: 'orders', value: num(insights?.orders.newInWindow), sub: `${num(insights?.orders.total)} all time` },
                {
                  label: 'view → order',
                  value: insights && insights.conversion.viewsToOrdersPct !== null ? `${insights.conversion.viewsToOrdersPct}%` : '—',
                  sub: 'no benchmark exists'
                }
              ]
            : [
                { label: 'followed by', value: num(followers), sub: 'people, counted' },
                { label: 'offers', value: num(space.metrics?.offersCount ?? null), sub: 'active now' },
                { label: 'updates', value: num(audience?.broadcasts?.length ?? space.broadcastsLive ?? null), sub: 'live in 24h' }
              ]
          ).map((tile) => (
            <div key={tile.label} className="flex-1 px-2 py-2.5 text-center" style={{ background: '#fff' }}>
              <p className="font-mono text-[17px] font-extrabold leading-none brief-countdown" style={{ color: '#0A0A0A' }}>
                {tile.value}
              </p>
              <p className="text-[10px] font-medium tracking-wide uppercase mt-1" style={{ color: '#6B7280' }}>
                {tile.label}
              </p>
              {tile.sub && (
                <p className="text-[9px] font-mono mt-0.5 truncate" style={{ color: '#9CA3AF' }}>
                  {tile.sub}
                </p>
              )}
            </div>
          ))}
        </div>

        <p className="text-[10px] leading-snug mt-2" style={{ color: '#6B7280' }}>
          {isOwner
            ? `${num(insights?.views.ownOpensExcluded)} of your own opens are left out of the view count. Brief has no sector averages and no browse log of who looked and left, so those numbers are absent rather than estimated.`
            : 'Followed by a person, counted once. No view, no bot, no rounded-up number.'}
        </p>
      </div>
    </header>
  );
}

export default SpaceStorefrontHeader;
