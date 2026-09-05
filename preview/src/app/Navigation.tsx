import React from 'react';
import {
  Home,
  Layers,
  BookOpen,
  Tag,
  Plus,
  Zap,
  DollarSign,
  Sparkles,
  ChevronDown,
  TrendingUp
} from 'lucide-react';
import { soundEngine } from '../utils/SoundEngine';

export type BriefNavigationTab = 'city' | 'pipeline' | 'ledger' | 'catalog' | 'home' | 'spaces' | 'discover' | 'activity' | 'you';

export interface NavigationProps {
  activeTab: BriefNavigationTab;
  onSelectTab: (tab: BriefNavigationTab) => void;
  onCreateAction?: () => void;
  spaceName?: string;
  pendingInquiriesCount?: number;
  revenueKes?: number;
  offersCount?: number;
  className?: string;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  onCreateAction,
  spaceName = "Amina's Cakes",
  pendingInquiriesCount = 2,
  revenueKes = 84200,
  offersCount = 3,
  className = ''
}) => {
  const currentActive = (
    activeTab === 'discover'
      ? 'city'
      : activeTab === 'home' || activeTab === 'spaces' || activeTab === 'activity'
      ? 'pipeline'
      : activeTab
  ) as 'city' | 'pipeline' | 'ledger' | 'catalog';

  const handleTabClick = (tabId: 'city' | 'pipeline' | 'ledger' | 'catalog') => {
    soundEngine.play('tap');
    if (typeof window !== 'undefined') {
      window.location.hash = `#${tabId}`;
    }
    onSelectTab(tabId);
  };

  const handleFabClick = () => {
    soundEngine.play('heavyTap');
    onCreateAction?.();
  };

  // 4 Primary Navigation Tabs
  const navItems: Array<{
    id: 'city' | 'pipeline' | 'ledger' | 'catalog';
    label: string;
    icon: React.ReactNode;
    badge?: React.ReactNode;
  }> = [
    {
      id: 'city',
      label: 'City',
      icon: <Home className="w-5 h-5" />
    },
    {
      id: 'pipeline',
      label: 'Pipeline',
      icon: <Layers className="w-5 h-5" />,
      badge: pendingInquiriesCount > 0 ? (
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
      ) : null
    },
    {
      id: 'ledger',
      label: 'Ledger',
      icon: <BookOpen className="w-5 h-5" />,
      badge: revenueKes > 0 ? (
        <span className="w-2 h-2 rounded-full bg-[#93EE34] animate-pulse" />
      ) : null
    },
    {
      id: 'catalog',
      label: 'Catalog',
      icon: <Tag className="w-5 h-5" />,
      badge: (
        <span className="text-[9px] font-black text-[#1A1F2E] bg-[#93EE34]/40 px-1.5 py-0.2 rounded-full">
          {offersCount}
        </span>
      )
    }
  ];

  // Contextual FAB Configuration based on activeTab
  const getFabConfig = () => {
    switch (currentActive) {
      case 'city':
        return {
          icon: <Sparkles className="w-4 h-4 text-[#93EE34]" />,
          label: 'Post',
          ariaLabel: 'Post an event or marketplace listing'
        };
      case 'pipeline':
        return {
          icon: <Zap className="w-4 h-4 text-[#93EE34]" />,
          label: 'New Order',
          ariaLabel: 'Create quick manual order for walk-in customer'
        };
      case 'ledger':
        return {
          icon: <DollarSign className="w-4 h-4 text-[#93EE34]" />,
          label: 'Log Outflow',
          ariaLabel: 'Quick-log an expense or outflow'
        };
      case 'catalog':
        return {
          icon: <Tag className="w-4 h-4 text-[#93EE34]" />,
          label: 'Add Offer',
          ariaLabel: 'Add a new offer to your catalog'
        };
    }
  };

  const fab = getFabConfig();

  return (
    <>
      {/* ── MOBILE BOTTOM NAVIGATION DOCK (4 Tabs + Floating Contextual FAB) ── */}
      <nav
        role="navigation"
        aria-label="Primary Mobile Navigation"
        className={`md:hidden fixed bottom-4 left-3 right-3 max-w-md mx-auto bg-white/95 backdrop-blur-md rounded-full px-4 py-2 shadow-2xl shadow-black/15 border border-black/5 flex items-center justify-between z-50 transition-all ${className}`}
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center space-x-2 sm:space-x-4">
          {navItems.map((item) => {
            const isSelected = currentActive === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-current={isSelected ? 'page' : undefined}
                onClick={() => handleTabClick(item.id)}
                className="flex flex-col items-center justify-center cursor-pointer select-none py-1 group relative"
              >
                <div
                  className={`p-2 rounded-full transition-all duration-300 relative ${
                    isSelected
                      ? 'bg-[#1A1F2E] text-[#93EE34] shadow-xs scale-105'
                      : 'text-[#64748B] group-hover:text-[#1A1F2E]'
                  }`}
                >
                  {item.icon}
                  {/* Micro-indicator badge */}
                  {item.badge && (
                    <span className="absolute top-0 right-0 -mt-0.5 -mr-0.5">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[9px] font-bold mt-0.5 transition-colors ${
                    isSelected ? 'text-[#1A1F2E]' : 'text-[#64748B]'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── CONTEXTUAL FLOATING ACTION BUTTON (FAB) ── */}
        <button
          type="button"
          onClick={handleFabClick}
          aria-label={fab.ariaLabel}
          title={fab.label}
          className="p-2.5 rounded-full bg-[#1A1F2E] hover:bg-black text-[#93EE34] shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center space-x-1 ml-2 border border-white/10"
        >
          {fab.icon}
          <span className="text-[10px] font-black text-[#93EE34] hidden sm:inline pr-1">
            {fab.label}
          </span>
        </button>
      </nav>

      {/* ── DESKTOP SIDEBAR RAIL ── */}
      <aside
        role="navigation"
        aria-label="Primary Desktop Navigation"
        className="hidden md:flex flex-col w-60 p-5 space-y-6 border-r border-black/5 bg-[#FAFAF8] shrink-0 min-h-screen justify-between"
      >
        <div className="space-y-6">
          {/* Top Brand & Space Switcher Block */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#1A1F2E] text-[#93EE34] font-black text-base flex items-center justify-center shadow-xs">
                B
              </div>
              <span className="text-xl font-black text-[#1A1F2E] tracking-tight">
                Brief
              </span>
            </div>

            {/* Active Space Selector Pill */}
            <div className="p-2 rounded-2xl bg-white border border-black/5 shadow-2xs flex items-center justify-between cursor-pointer hover:border-black/15 transition-all">
              <div className="flex items-center space-x-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#93EE34] shrink-0" />
                <span className="text-xs font-black text-[#1A1F2E] truncate">
                  {spaceName}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const isSelected = currentActive === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-current={isSelected ? 'page' : undefined}
                  onClick={() => handleTabClick(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#1A1F2E] text-[#93EE34] shadow-xs'
                      : 'text-[#64748B] hover:text-[#1A1F2E] hover:bg-black/5'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>

                  {/* Micro Indicators / Numbers */}
                  {item.id === 'ledger' && revenueKes > 0 && (
                    <span className="text-[10px] font-black text-[#93EE34] bg-[#1A1F2E] px-2 py-0.5 rounded-full">
                      KES {(revenueKes / 1000).toFixed(1)}k
                    </span>
                  )}
                  {item.id === 'catalog' && (
                    <span className="text-[10px] font-black bg-black/5 px-2 py-0.5 rounded-full text-[#1A1F2E]">
                      {offersCount}
                    </span>
                  )}
                  {item.id === 'pipeline' && pendingInquiriesCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Quick Action CTA */}
        <div className="pt-4 border-t border-black/5 space-y-2">
          <button
            type="button"
            onClick={handleFabClick}
            className="w-full py-3 rounded-2xl bg-[#1A1F2E] hover:bg-black text-[#93EE34] font-black text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md active:scale-98"
          >
            {fab.icon}
            <span>+ {fab.label}</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Navigation;
