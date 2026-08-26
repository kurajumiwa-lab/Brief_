import React from 'react';
import { ArrowRight, CalendarDays, MessageCircle, Plus, Sparkles, Trophy, Users } from 'lucide-react';
import type { MenuTarget } from './MenuSheet';

import communityArt from '../assets/shelf/nairobi-community.webp';
import shareArt from '../assets/shelf/whatsapp-share.webp';
import createArt from '../assets/shelf/host-create.webp';
import efootballArt from '../assets/arena/efootball.webp';
import eventArt from '../assets/shelf/event-gathering.webp';

// ---------------------------------------------------------------------------
// MAIN SHELF
//
// The first sheet is a gallery, not a directory of rows. It gives the high
// frequency doors a visual home, keeps the drawer for overflow, and makes the
// current product's strongest loop — discover -> host -> share -> return —
// legible at a glance.
//
// Images are editorial surfaces only. Actions still route into the real Brief
// destinations and the WhatsApp card routes into the server-backed campaign
// distribution UX; no card pretends that a provider or a campaign exists.
// ---------------------------------------------------------------------------

export interface MainShelfProps {
  onSelect: (target: MenuTarget) => void;
  compact?: boolean;
  /** Actual open eFootball challenges; null means the activity check has not returned. */
  playOpenCount?: number | null;
}

interface ShelfCard {
  id: string;
  eyebrow: string;
  title: string;
  detail: string;
  image: string;
  target: MenuTarget;
  Icon: React.ComponentType<{ className?: string }>;
  featured?: boolean;
}

const SHELF_CARDS: ShelfCard[] = [
  {
    id: 'around',
    eyebrow: 'DISCOVER',
    title: 'Around you',
    detail: 'Places, events and useful signals',
    image: communityArt,
    target: { tab: 'nearby', section: 'stream' },
    Icon: Sparkles
  },
  {
    id: 'play',
    eyebrow: 'ARENA',
    title: 'Play',
    detail: 'Find a match or open a lobby',
    image: efootballArt,
    target: { tab: 'arena' },
    Icon: Trophy
  },
  {
    id: 'events',
    eyebrow: 'GATHER',
    title: 'Events',
    detail: 'See what people are organising',
    image: eventArt,
    target: { tab: 'mylayer', section: 'campaigns' },
    Icon: CalendarDays
  },
  {
    id: 'create',
    eyebrow: 'MAKE',
    title: 'Create',
    detail: 'Turn a message into something useful',
    image: createArt,
    target: { tab: 'capture' },
    Icon: Plus
  },
  {
    id: 'share',
    eyebrow: 'REACH',
    title: 'WhatsApp link',
    detail: 'Make a shareable campaign banner',
    image: shareArt,
    target: { tab: 'workflows', section: 'distribution' },
    Icon: MessageCircle,
    featured: true
  },
  {
    id: 'groups',
    eyebrow: 'YOUR LAYER',
    title: 'Groups',
    detail: 'Return to communities you joined',
    image: communityArt,
    target: { tab: 'mylayer', section: 'groups' },
    Icon: Users
  }
];

function ShelfCardView({ card, onSelect, compact, playOpenCount }: { card: ShelfCard; onSelect: MainShelfProps['onSelect']; compact: boolean; playOpenCount: number | null }) {
  const Icon = card.Icon;
  const detail = card.id === 'play' && playOpenCount !== null
    ? playOpenCount > 0 ? `${playOpenCount} open match${playOpenCount === 1 ? '' : 'es'} · enter Arena` : 'No open matches yet · Arena is quiet'
    : card.detail;
  return (
    <button
      type="button"
      onClick={() => onSelect(card.target)}
      aria-label={`${card.title}: ${detail}`}
      data-shelf-id={card.id}
      className={`group relative shrink-0 overflow-hidden rounded-2xl border border-[#E5E7EB] text-left transition-all hover:-translate-y-0.5 hover:border-[#111111] ${
        compact ? 'w-full min-h-[120px]' : 'w-[174px] min-h-[154px] sm:w-auto sm:min-h-[164px]'
      }`}
    >
      <img
        src={card.image}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(9,11,16,0.08) 18%, rgba(9,11,16,0.88) 100%)' }}
      />
      {card.featured && (
        <span className="absolute right-2.5 top-2.5 rounded-full bg-[#FFFFFF] px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.14em] text-[#111111]">
          Featured path
        </span>
      )}
      {card.id === 'play' && playOpenCount === 0 && (
        <span className="absolute right-2.5 top-2.5 rounded-full border border-[#FFFFFF]/35 bg-[#090B10]/75 px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.14em] text-[#FFFFFF]">
          No supply now
        </span>
      )}
      <span className="absolute left-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-[#111111]/85 text-[#FFFFFF]">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="absolute inset-x-3 bottom-3">
        <p className="text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#FFFFFF]/70">{card.eyebrow}</p>
        <p className="mt-1 text-[15px] font-extrabold leading-tight text-[#FFFFFF]">{card.title}</p>
        <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-[#FFFFFF]/72">{detail}</p>
      </div>
    </button>
  );
}

export function MainShelf({ onSelect, compact = false, playOpenCount = null }: MainShelfProps) {
  return (
    <section aria-labelledby="main-shelf-title" className="space-y-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#111111]/50">Main shelf</p>
          <h2 id="main-shelf-title" className="mt-1 text-[18px] font-extrabold tracking-[-0.02em] text-[#111111]">What do you want to do?</h2>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#111111]/45">
          <ArrowRight className="h-3 w-3" /> swipe or tap
        </span>
      </div>
      <div className={compact ? 'grid grid-cols-2 gap-2' : 'flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory sm:grid sm:grid-cols-3 sm:overflow-visible'}>
        {SHELF_CARDS.map((card) => <ShelfCardView key={card.id} card={card} onSelect={onSelect} compact={compact} playOpenCount={playOpenCount} />)}
      </div>
      {!compact && (
        <p className="px-1 text-[10px] leading-snug text-[#111111]/45">
          The shelf is the shortcut. Use the menu for less frequent tools and region settings.
        </p>
      )}
    </section>
  );
}

export default MainShelf;
