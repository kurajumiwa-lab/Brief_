import React, { useState } from 'react';
import {
  SlidersHorizontal,
  Bookmark,
  Users,
  Bell
} from 'lucide-react';
import { MetalTag } from '../ui/MetalTag';
import { soundEngine } from '../../utils/SoundEngine';

export interface BriefBuilderSectionProps {
  initialCities?: string[];
  initialInterests?: string[];
  initialExpanded?: boolean;
  followedCount?: number;
  updatesCount?: number;
  onCityToggle?: (city: string) => void;
  onInterestToggle?: (interest: string) => void;
  onBuildBrief?: (selected: { cities: string[]; interests: string[] }) => void;
  onSkip?: () => void;
  onOpenCollections?: () => void;
  onOpenFollowing?: () => void;
  onOpenUpdates?: () => void;
}

export const BriefBuilderSection: React.FC<BriefBuilderSectionProps> = ({
  initialCities = ['Machakos'],
  initialInterests = [],
  initialExpanded = false,
  followedCount = 0,
  updatesCount = 0,
  onCityToggle,
  onInterestToggle,
  onBuildBrief,
  onSkip,
  onOpenCollections,
  onOpenFollowing,
  onOpenUpdates
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(initialExpanded);
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set(initialCities));
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(new Set(initialInterests));

  const cities = [
    'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru',
    'Eldoret', 'Thika', 'Naivasha', 'Nyeri',
    'Machakos', 'Kilimani', 'Westlands', 'Kileleshwa',
    'Lavington', 'Karen', "Lang'ata", 'Kasarani'
  ];

  const interests = [
    'Knowledge', 'Experience', 'Food', 'Jobs',
    'Business', 'Community', 'Health', 'Education',
    'Entertainment', 'Transport'
  ];

  const toggleExpansion = () => {
    soundEngine.play('tap');
    if (isExpanded) {
      handleBuildBrief();
    } else {
      setIsExpanded(true);
    }
  };

  const toggleCity = (city: string) => {
    soundEngine.play('tap');
    setSelectedCities((prev) => {
      const next = new Set(prev);
      if (next.has(city)) {
        next.delete(city);
      } else {
        next.add(city);
      }
      return next;
    });
    onCityToggle?.(city);
  };

  const toggleInterest = (interest: string) => {
    soundEngine.play('tap');
    setSelectedInterests((prev) => {
      const next = new Set(prev);
      if (next.has(interest)) {
        next.delete(interest);
      } else {
        next.add(interest);
      }
      return next;
    });
    onInterestToggle?.(interest);
  };

  const handleBuildBrief = () => {
    soundEngine.play('victory');
    setIsExpanded(false);
    onBuildBrief?.({
      cities: Array.from(selectedCities),
      interests: Array.from(selectedInterests)
    });
  };

  return (
    <div className="w-full flex flex-col font-sans">
      
      {/* ═══ THE HEADER ROW ═══ */}
      <div className="px-5 py-2.5 flex items-center space-x-3">
        {/* 1. Interactive "Build my Brief" Trigger */}
        <button
          type="button"
          onClick={toggleExpansion}
          className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all duration-300 cursor-pointer shadow-sm active:scale-95 shrink-0 ${
            isExpanded
              ? 'bg-[#B8621F] text-white shadow-[#B8621F]/30 shadow-lg'
              : 'bg-white text-[#1A1F2E] hover:bg-white/90'
          }`}
          aria-expanded={isExpanded}
        >
          <SlidersHorizontal className={`w-4 h-4 ${isExpanded ? 'text-white' : 'text-[#1A1F2E]'}`} />
          <span>Build my Brief</span>
        </button>

        {/* 2. Scrollable Minimal Auxiliary Pills */}
        <div className="flex-1 overflow-x-auto no-scrollbar py-0.5">
          <div className="flex items-center space-x-2 min-w-max">
            <button
              type="button"
              onClick={() => {
                soundEngine.play('tap');
                onOpenCollections?.();
              }}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-white/60 hover:bg-white text-[#6B7280] hover:text-[#1A1F2E] text-xs font-semibold transition-colors cursor-pointer"
            >
              <Bookmark className="w-3.5 h-3.5 text-[#6B7280]" />
              <span>Collections</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.play('tap');
                onOpenFollowing?.();
              }}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-white/60 hover:bg-white text-[#6B7280] hover:text-[#1A1F2E] text-xs font-semibold transition-colors cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-[#6B7280]" />
              <span>Following</span>
              {followedCount > 0 && (
                <span className="rounded-full bg-[#FF5A1F] px-1.5 text-[9px] font-extrabold text-[#0D1117] ml-1">
                  {followedCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.play('tap');
                onOpenUpdates?.();
              }}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-white/60 hover:bg-white text-[#6B7280] hover:text-[#1A1F2E] text-xs font-semibold transition-colors cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-[#6B7280]" />
              <span>Updates</span>
              {updatesCount > 0 && (
                <span className="rounded-full bg-[#DC2626] px-1.5 text-[9px] font-extrabold text-white ml-1">
                  {updatesCount > 99 ? '99+' : updatesCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ THE EXPANDABLE CONTENT ═══ */}
      {isExpanded && (
        <div className="mx-5 mb-5 p-6 rounded-[24px] bg-[#FAFAF8] shadow-xl border border-black/5 animate-slideUp space-y-7">
          
          {/* Header & Skip */}
          <div className="flex items-start justify-between space-x-4">
            <div className="space-y-1.5 max-w-sm">
              <h3 className="text-xl font-black text-[#1A1F2E] tracking-tight leading-tight">
                Make this your Brief
              </h3>
              <p className="text-xs text-[#6B7280] leading-relaxed font-medium">
                Your daily city briefing: ordered around the places and things you follow. Skip anytime — nothing is blocked.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.play('tap');
                setIsExpanded(false);
                onSkip?.();
              }}
              className="px-4 py-2 rounded-full bg-gray-200 hover:bg-gray-300 text-[#4A5568] text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              Skip
            </button>
          </div>

          {/* Section: Cities */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1A1F2E]" />
              <span className="text-[11px] font-black uppercase tracking-wider text-[#1A1F2E]">
                Where do you want your Brief?
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {cities.map((city) => {
                const isSelected = selectedCities.has(city);
                return (
                  <MetalTag
                    key={city}
                    label={city}
                    material={isSelected ? 'copper' : 'steel'}
                    selected={isSelected}
                    onTap={() => toggleCity(city)}
                  />
                );
              })}
            </div>
          </div>

          {/* Section: Interests */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1A1F2E]" />
              <span className="text-[11px] font-black uppercase tracking-wider text-[#1A1F2E]">
                What do you care about?
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {interests.map((interest) => {
                const isSelected = selectedInterests.has(interest);
                return (
                  <MetalTag
                    key={interest}
                    label={interest}
                    material={isSelected ? 'copper' : 'steel'}
                    selected={isSelected}
                    onTap={() => toggleInterest(interest)}
                  />
                );
              })}
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center space-x-4 pt-2">
            <button
              type="button"
              onClick={handleBuildBrief}
              className="px-6 py-3.5 rounded-2xl bg-[#B8621F] hover:bg-[#9B5118] text-white font-black text-xs shadow-lg shadow-[#B8621F]/30 transition-transform active:scale-95 cursor-pointer shrink-0"
            >
              Build my Brief
            </button>

            <p className="text-[11px] text-[#9CA3AF] leading-tight">
              Pick anything, or skip — your feed stays global.
            </p>
          </div>

        </div>
      )}

    </div>
  );
};
