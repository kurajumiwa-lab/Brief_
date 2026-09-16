import React from 'react';
import { Bike, CalendarDays, ShoppingBag, Users } from 'lucide-react';
import type { DiscoverTile } from '../../api/briefApi';
import { soundEngine } from '../../utils/SoundEngine';

// ---------------------------------------------------------------------------
// CATEGORY GRID — the tile nav from the old Discover screen, kept for its
// shape and rebuilt on rows.
//
// Tiles beat a chip row for two reasons the old screenshots were right about:
// they are thumb-reachable, and they carry a number that tells you whether the
// room is worth opening before you tap. The number is the whole point of the
// tile, so it is never decorative: 0 live offers is displayed as 0, because an
// early network with two listings is a fact the vendor needs, not a design
// failure to hide with a seeded tile.
//
// Marketplace sits top-left because it is the front door: scanning starts
// there, and a market is what this network can actually settle today.
// ---------------------------------------------------------------------------

const ICON: Record<string, React.ReactNode> = {
  marketplace: <ShoppingBag className="w-5 h-5" />,
  events: <CalendarDays className="w-5 h-5" />,
  circles: <Users className="w-5 h-5" />,
  errands: <Bike className="w-5 h-5" />
};

export interface DiscoverCategoryGridProps {
  tiles: DiscoverTile[];
  active: string;
  onSelect: (key: 'marketplace' | 'events' | 'circles' | 'errands') => void;
  onSelectAll?: () => void;
  allActive?: boolean;
  className?: string;
}

export function DiscoverCategoryGrid({
  tiles,
  active,
  onSelect,
  onSelectAll,
  allActive = false,
  className = ''
}: DiscoverCategoryGridProps) {
  const ordered = [...tiles].sort((a, b) => (a.key === 'marketplace' ? -1 : b.key === 'marketplace' ? 1 : 0));

  return (
    <div className={`space-y-2 ${className}`} role="tablist" aria-label="Discover categories">
      <div className="grid grid-cols-2 gap-2">
        {ordered.map((t) => {
          const isActive = !allActive && active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => { soundEngine.play('tap'); onSelect(t.key); }}
              className="text-left p-3.5 rounded-3xl border-2 min-h-[86px] flex flex-col justify-between cursor-pointer transition-transform active:scale-[0.98]"
              style={{
                background: isActive ? 'var(--color-primary)' : '#fff',
                borderColor: isActive ? 'transparent' : '#E5E7EB',
                color: isActive ? 'var(--accent-ink)' : '#0A0A0A'
              }}
            >
              <span
                className="w-8 h-8 rounded-2xl grid place-items-center"
                style={{ background: isActive ? 'rgba(255,255,255,0.18)' : '#F4F4F7', color: isActive ? 'var(--accent-ink)' : 'var(--color-primary)' }}
              >
                {ICON[t.key]}
              </span>
              <span className="flex items-end justify-between gap-2">
                <span className="text-[15px] font-extrabold leading-tight truncate">{t.label}</span>
                <span className="text-right shrink-0">
                  <span className="block font-mono text-[17px] font-extrabold leading-none brief-countdown">{t.count}</span>
                  <span
                    className="block text-[9px] uppercase tracking-wider font-medium mt-0.5"
                    style={{ color: isActive ? 'rgba(255,255,255,0.75)' : '#6B7280' }}
                  >
                    {t.unit}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {onSelectAll && (
        <button
          type="button"
          role="tab"
          aria-selected={allActive}
          onClick={() => { soundEngine.play('tap'); onSelectAll(); }}
          className="w-full text-left px-3.5 py-2.5 rounded-2xl border-2 flex items-center justify-between cursor-pointer"
          style={{
            background: allActive ? '#0A0A0A' : '#fff',
            borderColor: allActive ? 'transparent' : '#E5E7EB',
            color: allActive ? '#fff' : '#6B7280'
          }}
        >
          <span className="text-[13px] font-bold">Everything at once</span>
          <span className="text-[10px] font-mono uppercase tracking-wider">All rooms, one scroll</span>
        </button>
      )}
    </div>
  );
}

export default DiscoverCategoryGrid;
