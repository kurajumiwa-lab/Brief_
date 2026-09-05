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
            className="flex items-center space-x-1.5 text-xs font-bold text-[#64748B] hover:text-[#1A1F2E] transition-colors cursor-pointer py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Spaces</span>
          </button>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#64748B]">
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
            className="p-2 rounded-full bg-white hover:bg-gray-100 text-[#1A1F2E] shadow-2xs transition-all cursor-pointer"
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
            <h1 className="text-2xl sm:text-3xl font-black text-[#1A1F2E] tracking-tight leading-tight">
              {space.name}
            </h1>
          </div>
          <p className="text-xs sm:text-sm font-medium text-[#64748B]">
            {space.goal || `${space.type.replace('_', ' ')} workspace`}
          </p>
        </div>
      </div>

      {/* Primary Metrics Strip (3 concise numbers) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 py-1">
        <div className="p-3.5 rounded-2xl bg-white shadow-2xs border border-black/5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#64748B] block font-semibold">
            Revenue
          </span>
          <span className="text-base sm:text-lg font-black text-[#1A1F2E] block mt-0.5 truncate">
            KES {(space.metrics?.revenueKes || 0).toLocaleString()}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white shadow-2xs border border-black/5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#64748B] block font-semibold">
            Customers
          </span>
          <span className="text-base sm:text-lg font-black text-[#1A1F2E] block mt-0.5">
            {space.metrics?.customerCount || 0}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white shadow-2xs border border-black/5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#64748B] block font-semibold">
            Active Orders
          </span>
          <span className="text-base sm:text-lg font-black text-[#1A1F2E] block mt-0.5">
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
          className="px-4 py-2 rounded-full bg-[#5B2EA6] hover:bg-[#4A238A] active:scale-95 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-[#93EE34]" />
          <span>Add Offer</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.play('tap');
            onCreateOrder?.();
          }}
          className="px-4 py-2 rounded-full bg-white hover:bg-gray-50 active:scale-95 text-[#1A1F2E] font-bold text-xs border border-black/10 shadow-2xs transition-all cursor-pointer flex items-center space-x-1.5"
        >
          <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
          <span>Create Order</span>
        </button>
      </div>
    </header>
  );
};

export default SpaceHeader;
