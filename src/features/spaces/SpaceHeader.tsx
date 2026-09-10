import React from 'react';
import { Share2, Plus, MessageCircle, DollarSign, ArrowLeft, MoreHorizontal, CheckCircle2 } from 'lucide-react';
import type { Space } from '../../api/types';
import { soundEngine } from '../../utils/SoundEngine';

export interface SpaceHeaderProps {
  space: Space;
  onBack?: () => void;
  onAddOffer?: () => void;
  onCreateOrder?: () => void;
  onShare?: () => void;
  className?: string;
}

export const SpaceHeader: React.FC<SpaceHeaderProps> = ({
  space,
  onBack,
  onAddOffer,
  onCreateOrder,
  onShare,
  className = ''
}) => {
  const getSpaceEmoji = (type: string) => {
    switch (type) {
      case 'business': return '🍰';
      case 'side_hustle': return '🌱';
      case 'creator': return '🎨';
      case 'community': return '🌸';
      case 'event': return '🎉';
      case 'project': return '🚀';
      default: return '✨';
    }
  };

  return (
    <header className={`space-y-4 ${className}`}>
      {/* Top Navigation Row */}
      <div className="flex items-center justify-between">
        {onBack ? (
          <button
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              onBack();
            }}
            className="flex items-center space-x-1.5 text-xs font-bold text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] transition-colors cursor-pointer py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Spaces</span>
          </button>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--color-text-muted)]">
            YOUR SPACE
          </span>
        )}

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              onShare?.();
            }}
            className="p-2 rounded-full bg-white hover:bg-gray-100 text-[color:var(--color-text)] shadow-2xs transition-all cursor-pointer"
            title="Share Space"
            aria-label="Share Space"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Identity Row */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <span className="text-2xl sm:text-3xl select-none" role="img" aria-label="space icon">
              {getSpaceEmoji(space.type)}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-[color:var(--color-text)] tracking-tight leading-tight">
              {space.name}
            </h1>
          </div>
          <p className="text-xs sm:text-sm font-medium text-[color:var(--color-text-muted)]">
            {space.goal || `${space.type.replace('_', ' ')} workspace`}
          </p>
        </div>
      </div>

      {/* Primary Metrics Strip (3 concise numbers) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 py-1">
        <div className="p-3.5 rounded-2xl bg-white shadow-2xs border border-black/5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--color-text-muted)] block font-semibold">
            Revenue
          </span>
          <span className="text-base sm:text-lg font-black text-[color:var(--color-text)] block mt-0.5 truncate">
            KES {(space.metrics?.revenueKes || 0).toLocaleString()}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white shadow-2xs border border-black/5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--color-text-muted)] block font-semibold">
            Customers
          </span>
          <span className="text-base sm:text-lg font-black text-[color:var(--color-text)] block mt-0.5">
            {space.metrics?.customerCount || 0}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white shadow-2xs border border-black/5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--color-text-muted)] block font-semibold">
            Active Orders
          </span>
          <span className="text-base sm:text-lg font-black text-[color:var(--color-text)] block mt-0.5">
            {space.metrics?.activeOrdersCount || 0}
          </span>
        </div>
      </div>

      {/* Fast Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            soundEngine.play('heavyTap');
            onAddOffer?.();
          }}
          className="px-4 py-2 rounded-full bg-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-strong)] active:scale-95 text-[color:var(--accent-ink)] font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-[color:var(--color-primary)]" />
          <span>Add Offer</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.play('tap');
            onCreateOrder?.();
          }}
          className="px-4 py-2 rounded-full bg-white hover:bg-gray-50 active:scale-95 text-[color:var(--color-text)] font-bold text-xs border border-black/10 shadow-2xs transition-all cursor-pointer flex items-center space-x-1.5"
        >
          <DollarSign className="w-3.5 h-3.5 text-[color:var(--color-success)]" />
          <span>Create Order</span>
        </button>
      </div>
    </header>
  );
};

export default SpaceHeader;
