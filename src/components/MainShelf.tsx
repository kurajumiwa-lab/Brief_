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
  theme?: 'light' | 'dark';
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

function ShelfCardView({
  card,
  onSelect,
  compact,
  playOpenCount,
  theme = 'light'
}: {
  card: ShelfCard;
  onSelect: MainShelfProps['onSelect'];
  compact: boolean;
  playOpenCount: number | null;
  theme?: 'light' | 'dark';
}) {
  const Icon = card.Icon;
  const isDark = theme === 'dark';
  const detail = card.id === 'play' && playOpenCount !== null
    ? playOpenCount > 0 ? `${playOpenCount} open match${playOpenCount === 1 ? '' : 'es'} · enter Arena` : 'No open matches yet · Arena is quiet'
    : card.detail;
  return (
    <button
      type="button"
      onClick={() => onSelect(card.target)}
      aria-label={`${card.title}: ${detail}`}
      data-shelf-id={card.id}
      className={`group relative shrink-0 overflow-hidden rounded-xl text-left transition-all hover:-translate-y-0.5 cursor-pointer ${
        isDark
          ? 'border border-[#222B3A] hover:border-[#00DF8F] shadow-lg'
          : 'border border-[#E5E7EB] hover:border-[#111111]'
      } ${
        compact ? 'w-full min-h-[76px] sm:min-h-[82px]' : 'w-[144px] min-h-[102px] sm:w-auto sm:min-h-[108px]'
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
        style={{
          background: isDark
            ? 'linear-gradient(180deg, rgba(8,11,16,0.2) 0%, rgba(8,11,16,0.92) 100%)'
            : 'linear-gradient(180deg, rgba(9,11,16,0.18) 0%, rgba(9,11,16,0.85) 100%)'
        }}
      />
      {card.featured && (
        <span
          className={`absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[7px] font-extrabold uppercase tracking-[0.14em] ${
            isDark ? 'bg-[#00DF8F] text-[#0A0D14]' : 'bg-[#FFFFFF] text-[#111111]'
          }`}
        >
          Featured
        </span>
      )}
      {card.id === 'play' && playOpenCount === 0 && (
        <span className="absolute right-2 top-2 rounded-full border border-[#FFFFFF]/35 bg-[#090B10]/85 px-1.5 py-0.5 text-[7px] font-extrabold uppercase tracking-[0.14em] text-[#FFFFFF]">
          Quiet now
        </span>
      )}
      <span
        className={`absolute left-2 top-2 flex items-center justify-center rounded-md ${
          isDark
            ? 'bg-[#151D2A]/90 border border-[#2B374C] text-[#00DF8F]'
            : 'bg-[#111111]/85 text-[#FFFFFF]'
        } ${compact ? 'h-5 w-5' : 'h-6 w-6'}`}
      >
        <Icon className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      </span>
      <div className={`absolute inset-x-2.5 ${compact ? 'bottom-2' : 'bottom-2.5'}`}>
        <p
          className={`text-[7.5px] font-extrabold uppercase tracking-[0.16em] ${
            isDark ? 'text-[#00DF8F]' : 'text-[#FFFFFF]/75'
          }`}
        >
          {card.eyebrow}
        </p>
        <p className={`mt-0.5 font-extrabold leading-tight text-[#FFFFFF] ${compact ? 'text-[12px]' : 'text-[13px]'}`}>{card.title}</p>
        <p className="mt-0.5 line-clamp-1 text-[9px] leading-snug text-[#FFFFFF]/80">{detail}</p>
      </div>
    </button>
  );
}

export function MainShelf({ onSelect, compact = false, playOpenCount = null, theme = 'light' }: MainShelfProps) {
  const isDark = theme === 'dark';
  return (
    <section aria-labelledby="main-shelf-title" className="space-y-2.5">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p
            className={`text-[9px] font-extrabold uppercase tracking-[0.18em] ${
              isDark ? 'text-[#00DF8F]' : 'text-[#111111]/50'
            }`}
          >
            Main shelf
          </p>
          <h2
            id="main-shelf-title"
            className={`mt-0.5 text-[16px] font-extrabold tracking-[-0.02em] ${
              isDark ? 'text-[#FFFFFF]' : 'text-[#111111]'
            }`}
          >
            What do you want to do?
          </h2>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-[9px] font-bold ${
            isDark ? 'text-[#8B98A9]' : 'text-[#111111]/45'
          }`}
        >
          <ArrowRight className="h-2.5 w-2.5" /> swipe or tap
        </span>
      </div>
      <div className={compact ? 'grid grid-cols-2 gap-2' : 'flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory sm:grid sm:grid-cols-3 sm:overflow-visible'}>
        {SHELF_CARDS.map((card) => (
          <ShelfCardView
            key={card.id}
            card={card}
            onSelect={onSelect}
            compact={compact}
            playOpenCount={playOpenCount}
            theme={theme}
          />
        ))}
      </div>
      {!compact && (
        <p className={`px-1 text-[9.5px] leading-snug ${isDark ? 'text-[#8B98A9]' : 'text-[#111111]/45'}`}>
          The shelf is the shortcut. Use the menu for less frequent tools and region settings.
        </p>
      )}
    </section>
  );
}

export default MainShelf;
