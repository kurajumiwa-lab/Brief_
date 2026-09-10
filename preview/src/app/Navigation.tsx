import React from 'react';
import { Sparkles, TrendingUp, Search } from 'lucide-react';
import { soundEngine } from '../utils/SoundEngine';

export type BriefNavigationTab =
  | 'supply'
  | 'requests'
  | 'home'
  | 'spaces'
  | 'discover'
  | 'activity'
  | 'city'
  | 'pipeline'
  | 'ledger'
  | 'catalog'
  | 'you';

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

// ── CUSTOM PIXEL-PERFECT ICONS MATCHING SCREENSHOT ──

// 1. Home Doorway Icon (Open Door)
const DoorwayIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M13 4h3a2 2 0 0 1 2 2v14" />
    <path d="M2 20h20" />
    <path d="M13 20V4a2 2 0 0 0-2-2L5 5a2 2 0 0 0-1 1.7V20" />
    <circle cx="10" cy="12" r="0.8" fill="currentColor" />
  </svg>
);

// 2. Spaces Overlapping Cards Icon with Arrows
const SpacesIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="6" width="12" height="12" rx="2.5" />
    <path d="M9 3h10a2 2 0 0 1 2 2v10" />
    <path d="M17 7l2-2 2 2" />
    <path d="M7 17l-2 2-2-2" />
  </svg>
);

// 3. Discover Magnifying Glass with Building/City
const DiscoverIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="10.5" cy="10.5" r="7.5" />
    <path d="M21 21l-5.2-5.2" />
    <path d="M8 12.5h5" />
    <path d="M10.5 8.5v6" />
  </svg>
);

// 4. Activity Trending Chart Line Icon
const ActivityIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  onCreateAction,
  spaceName = 'Your Brief',
  pendingInquiriesCount = 0,
  revenueKes = 0,
  offersCount = 0,
  className = ''
}) => {
  // Normalize active tab to one of the 4 primary slots
  const getNormalizedActive = (): 'supply' | 'requests' | 'home' | 'spaces' | 'discover' | 'activity' => {
    if (activeTab === 'supply') return 'supply';
    if (activeTab === 'requests') return 'requests';
    if (activeTab === 'home' || activeTab === 'city') return 'home';
    if (activeTab === 'spaces' || activeTab === 'pipeline') return 'spaces';
    if (activeTab === 'discover' || activeTab === 'catalog') return 'discover';
    if (activeTab === 'activity' || activeTab === 'ledger') return 'activity';
    return 'home';
  };

  const normalizedActive = getNormalizedActive();

  const handleTabClick = (tabId: 'home' | 'spaces' | 'discover' | 'activity') => {
    soundEngine.play('tap');
    if (typeof window !== 'undefined') {
      window.location.hash = `#${tabId}`;
    }
    // Map to the appropriate underlying view
    if (tabId === 'home') onSelectTab('home');
    else if (tabId === 'spaces') onSelectTab('pipeline');
    else if (tabId === 'discover') onSelectTab('city');
    else if (tabId === 'activity') onSelectTab('activity');
    else onSelectTab(tabId);
  };

  const handleFabClick = () => {
    soundEngine.play('heavyTap');
    onCreateAction?.();
  };

  // The 4 Navigation Tabs from the screenshot
  const navItems: Array<{
    id: 'home' | 'spaces' | 'discover' | 'activity';
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'home',
      label: 'Home',
      icon: <DoorwayIcon className="w-5 h-5" />
    },
    {
      id: 'spaces',
      label: 'Spaces',
      icon: <SpacesIcon className="w-5 h-5" />
    },
    {
      id: 'discover',
      label: 'Discover',
      icon: <DiscoverIcon className="w-5 h-5" />
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: <ActivityIcon className="w-5 h-5" />
    }
  ];

  return (
    <>
      {/* ── MOBILE BOTTOM FLOATING DOCK (Exact Screenshot Match) ── */}
      <nav
        role="navigation"
        aria-label="Mobile Navigation Dock"
        className={`md:hidden fixed bottom-4 left-4 right-4 max-w-sm sm:max-w-md mx-auto bg-white/95 backdrop-blur-md rounded-full px-5 py-2.5 shadow-[0_10px_35px_rgba(0,0,0,0.12)] border border-black/[0.04] flex items-center justify-between z-50 transition-all ${className}`}
        style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between flex-1 pr-3">
          {navItems.map((item) => {
            const isSelected = normalizedActive === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-current={isSelected ? 'page' : undefined}
                onClick={() => handleTabClick(item.id)}
                className="flex flex-col items-center justify-center cursor-pointer select-none py-0.5 group min-w-[52px]"
              >
                <div
                  className={`transition-all duration-200 ${
                    isSelected
                      ? 'text-[#111827] scale-105'
                      : 'text-[#94A3B8] group-hover:text-[#111827]'
                  }`}
                >
                  {item.icon}
                </div>
                <span
                  className={`text-[10px] tracking-tight mt-1 transition-colors ${
                    isSelected
                      ? 'text-[#111827] font-extrabold'
                      : 'text-[#94A3B8] font-medium group-hover:text-[#111827]'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── GLOWING NEON SPARKLES FAB ── */}
        <button
          type="button"
          onClick={handleFabClick}
          aria-label="Create Action"
          title="Create"
          className="w-11 h-11 rounded-full bg-[#111827] text-[#93EE34] shadow-[0_0_18px_rgba(147,238,52,0.45)] hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center shrink-0 border border-black/10"
        >
          <Sparkles className="w-5 h-5 text-[#93EE34]" />
        </button>
      </nav>

      {/* ── DESKTOP SIDEBAR RAIL ── */}
      <aside
        role="navigation"
        aria-label="Primary Desktop Navigation"
        className="hidden md:flex flex-col w-60 p-5 space-y-6 border-r border-black/5 bg-[#FAFAF8] shrink-0 min-h-screen justify-between"
      >
        <div className="space-y-6">
          <button className={`w-full rounded-xl p-3 text-left text-sm font-bold ${activeTab === 'requests' ? 'bg-[#203e31] text-white' : 'bg-white text-[#203e31]'}`} onClick={() => { window.location.hash = 'requests'; onSelectTab('requests'); }}>My Requests ↗</button>
          <button className={`w-full rounded-xl p-3 text-left text-sm font-bold ${activeTab === 'supply' ? 'bg-[#203e31] text-white' : 'bg-white text-[#203e31]'}`} onClick={() => { window.location.hash = 'supply/mine'; onSelectTab('supply'); }}>Capabilities ↗</button>
          {/* Top Brand & Space Switcher Block */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#111827] text-[#93EE34] font-black text-base flex items-center justify-center shadow-xs">
                B
              </div>
              <span className="text-xl font-black text-[#111827] tracking-tight">
                Brief
              </span>
            </div>

            {/* Active Space Selector Pill */}
            <div className="p-2.5 rounded-2xl bg-white border border-black/5 shadow-2xs flex items-center justify-between cursor-pointer hover:border-black/15 transition-all">
              <div className="flex items-center space-x-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#93EE34] shrink-0" />
                <span className="text-xs font-black text-[#111827] truncate">
                  {spaceName}
                </span>
              </div>
              <span className="text-[10px] text-[#94A3B8]">▾</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const isSelected = normalizedActive === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-current={isSelected ? 'page' : undefined}
                  onClick={() => handleTabClick(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#111827] text-[#93EE34] shadow-xs'
                      : 'text-[#64748B] hover:text-[#111827] hover:bg-black/5'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>

                  {item.id === 'activity' && revenueKes > 0 && (
                    <span className="text-[10px] font-black text-[#93EE34] bg-[#111827] px-2 py-0.5 rounded-full">
                      KES {(revenueKes / 1000).toFixed(1)}k
                    </span>
                  )}
                  {item.id === 'discover' && (
                    <span className="text-[10px] font-black bg-black/5 px-2 py-0.5 rounded-full text-[#111827]">
                      {offersCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Glowing Quick Action CTA */}
        <div className="pt-4 border-t border-black/5">
          <button
            type="button"
            onClick={handleFabClick}
            className="w-full py-3 rounded-2xl bg-[#111827] hover:bg-black text-[#93EE34] font-black text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(147,238,52,0.35)] active:scale-98"
          >
            <Sparkles className="w-4 h-4 text-[#93EE34]" />
            <span>+ Create Action</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Navigation;
