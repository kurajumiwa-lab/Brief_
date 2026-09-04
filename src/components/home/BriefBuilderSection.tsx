import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  Bookmark,
  Users,
  Bell,
  Check
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface BriefBuilderSectionProps {
  initialCities?: string[];
  initialInterests?: string[];
  initialTypes?: string[];
  initialExpanded?: boolean;
  suggestedLocations?: string[];
  availableTypes?: Array<{ id: string; label: string } | string>;
  topics?: Array<{ id: string; label: string }>;
  followedCount?: number;
  updatesCount?: number;
  onCityToggle?: (city: string) => void;
  onTypeToggle?: (typeId: string) => void;
  onTopicToggle?: (topicId: string) => void;
  onInterestToggle?: (interest: string) => void;
  onBuildBrief?: (selected: { cities: string[]; interests: string[]; types?: string[]; topics?: string[] }) => void;
  onSkip?: () => void;
  onOpenCollections?: () => void;
  onOpenFollowing?: () => void;
  onOpenUpdates?: () => void;
}

export const BriefBuilderSection: React.FC<BriefBuilderSectionProps> = ({
  initialCities = [],
  initialInterests = [],
  initialTypes = [],
  initialExpanded = false,
  suggestedLocations = ['Machakos', 'Nairobi', 'Kilimani', 'Westlands', 'Kasarani', 'South B', "Lang'ata", 'Karen', 'Mombasa', 'Kisumu'],
  availableTypes = [
    { id: 'experience', label: 'Experience' },
    { id: 'event', label: 'Event' },
    { id: 'offer', label: 'Offer' },
    { id: 'place', label: 'Place' },
    { id: 'news', label: 'News' },
    { id: 'knowledge', label: 'Knowledge' }
  ],
  topics = [
    { id: 'food', label: 'Food' },
    { id: 'jobs', label: 'Jobs' },
    { id: 'entertainment', label: 'Entertainment' },
    { id: 'community', label: 'Community' }
  ],
  followedCount = 0,
  updatesCount = 0,
  onCityToggle,
  onTypeToggle,
  onTopicToggle,
  onInterestToggle,
  onBuildBrief,
  onSkip,
  onOpenCollections,
  onOpenFollowing,
  onOpenUpdates
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(initialExpanded);
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set(initialCities));
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(initialTypes));
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set(initialInterests));

  useEffect(() => {
    setIsExpanded(initialExpanded);
  }, [initialExpanded]);

  const normalizedTypes = availableTypes.map((t) =>
    typeof t === 'string' ? { id: t.toLowerCase(), label: t } : t
  );

  const toggleExpansionOrSave = () => {
    soundEngine.play('tap');
    if (!isExpanded) {
      setIsExpanded(true);
    } else {
      handleSaveBrief();
    }
  };

  const toggleCity = (city: string) => {
    soundEngine.play('tap');
    setSelectedCities((prev) => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city);
      else next.add(city);
      return next;
    });
    onCityToggle?.(city);
  };

  const toggleType = (typeId: string, label: string) => {
    soundEngine.play('tap');
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(typeId)) next.delete(typeId);
      else next.add(typeId);
      return next;
    });
    onTypeToggle?.(typeId);
    onInterestToggle?.(label);
  };

  const toggleTopic = (topicId: string, label: string) => {
    soundEngine.play('tap');
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
    onTopicToggle?.(topicId);
    onInterestToggle?.(label);
  };

  const handleSaveBrief = () => {
    soundEngine.play('victory');
    setIsExpanded(false);
    onBuildBrief?.({
      cities: Array.from(selectedCities),
      interests: [...Array.from(selectedTypes), ...Array.from(selectedTopics)],
      types: Array.from(selectedTypes),
      topics: Array.from(selectedTopics)
    });
  };

  return (
    <div className="w-full flex flex-col font-sans transition-all duration-300">
      
      {/* ═══ THE HORIZONTAL PILLS ROW ═══ */}
      <div className="px-5 py-2.5 flex items-center space-x-2.5 overflow-x-auto no-scrollbar">
        {/* 1. "Build my Brief" Action Pill (Copper / Orange Accent) */}
        <button
          type="button"
          onClick={toggleExpansionOrSave}
          className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-black tracking-wide transition-all duration-250 cursor-pointer shadow-sm active:scale-95 shrink-0 ${
            isExpanded
              ? 'bg-[#B8621F] text-white shadow-md'
              : 'bg-[#B8621F]/15 hover:bg-[#B8621F]/25 text-[#B8621F]'
          }`}
          aria-expanded={isExpanded}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Build my Brief</span>
        </button>

        {/* 2. Collections Pill */}
        <button
          type="button"
          onClick={() => {
            soundEngine.play('tap');
            onOpenCollections?.();
          }}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white/70 hover:bg-white text-[#6B7280] hover:text-[#1A1F2E] text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-sm"
        >
          <Bookmark className="w-3.5 h-3.5 text-[#6B7280]" />
          <span>Collections</span>
        </button>

        {/* 3. Following Pill */}
        <button
          type="button"
          onClick={() => {
            soundEngine.play('tap');
            onOpenFollowing?.();
          }}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white/70 hover:bg-white text-[#6B7280] hover:text-[#1A1F2E] text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-sm"
        >
          <Users className="w-3.5 h-3.5 text-[#6B7280]" />
          <span>Following</span>
          {followedCount > 0 && (
            <span className="rounded-full bg-[#B8621F] px-1.5 text-[9px] font-extrabold text-white ml-1">
              {followedCount}
            </span>
          )}
        </button>

        {/* 4. Updates Pill */}
        <button
          type="button"
          onClick={() => {
            soundEngine.play('tap');
            onOpenUpdates?.();
          }}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white/70 hover:bg-white text-[#6B7280] hover:text-[#1A1F2E] text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-sm"
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

      {/* ═══ THE EXPANDABLE INLINE ACCORDION (Hidden by default, pushes content down) ═══ */}
      {isExpanded && (
        <div className="mx-5 mb-4 p-5 rounded-[24px] bg-[#FAFAF8] shadow-lg animate-slideUp space-y-5 transition-all duration-300">
          
          {/* Header & Skip */}
          <div className="flex items-start justify-between space-x-4">
            <div className="space-y-1">
              <h3 className="text-lg font-black text-[#1A1F2E] tracking-tight leading-tight">
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
              className="px-3.5 py-1.5 rounded-full bg-black/5 hover:bg-black/10 text-[#4A5568] text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              Skip
            </button>
          </div>

          {/* Section: Where do you want your Brief? */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#1A1F2E] block">
              Where do you want your Brief?
            </span>

            <div className="flex flex-wrap gap-2">
              {suggestedLocations.map((city) => {
                const isSelected = selectedCities.has(city);
                return (
                  <button
                    key={city}
                    type="button"
                    onClick={() => toggleCity(city)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-250 cursor-pointer flex items-center space-x-1.5 ${
                      isSelected
                        ? 'bg-[#B8621F] text-white shadow-sm'
                        : 'bg-black/[0.06] hover:bg-black/[0.1] text-[#4A5568]'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                    <span>{city}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: What do you care about? */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#1A1F2E] block">
              What do you care about?
            </span>

            {/* Types */}
            {normalizedTypes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {normalizedTypes.map((t) => {
                  const isSelected = selectedTypes.has(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleType(t.id, t.label)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-250 cursor-pointer flex items-center space-x-1.5 ${
                        isSelected
                          ? 'bg-[#B8621F] text-white shadow-sm'
                          : 'bg-black/[0.06] hover:bg-black/[0.1] text-[#4A5568]'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Topics */}
            {topics.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {topics.map((topic) => {
                  const isSelected = selectedTopics.has(topic.id);
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => toggleTopic(topic.id, topic.label)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-250 cursor-pointer flex items-center space-x-1.5 ${
                        isSelected
                          ? 'bg-[#B8621F] text-white shadow-sm'
                          : 'bg-black/[0.06] hover:bg-black/[0.1] text-[#4A5568]'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                      <span>{topic.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex items-center space-x-4 pt-1">
            <button
              type="button"
              onClick={handleSaveBrief}
              className="px-6 py-3 rounded-xl bg-[#B8621F] hover:bg-[#9B5118] text-white font-black text-xs shadow-md shadow-[#B8621F]/20 transition-transform active:scale-95 cursor-pointer shrink-0"
            >
              Build my Brief
            </button>

            <p className="text-[11px] text-[#9CA3AF] leading-tight">
              Pick anything, or skip — your feed stays local.
            </p>
          </div>

        </div>
      )}

    </div>
  );
};
