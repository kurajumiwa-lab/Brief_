import React from 'react';
import { Home, Layers, Compass, Activity, User, Plus } from 'lucide-react';
import { soundEngine } from '../utils/SoundEngine';

export type BriefNavigationTab = 'home' | 'spaces' | 'discover' | 'activity' | 'you';

export interface NavigationProps {
  activeTab: BriefNavigationTab;
  onSelectTab: (tab: BriefNavigationTab) => void;
  onCreateAction?: () => void;
  className?: string;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  onCreateAction,
  className = ''
}) => {
  const navItems: Array<{ id: BriefNavigationTab; label: string; icon: React.ReactNode }> = [
    { id: 'home', label: 'Home', icon: <Home className="w-5 h-5" /> },
    { id: 'spaces', label: 'Spaces', icon: <Layers className="w-5 h-5" /> },
    { id: 'discover', label: 'Discover', icon: <Compass className="w-5 h-5" /> },
    { id: 'activity', label: 'Activity', icon: <Activity className="w-5 h-5" /> }
  ];

  return (
    <>
      {/* ── MOBILE BOTTOM NAVIGATION DOCK ── */}
      <nav
        aria-label="Mobile Navigation"
        className={`md:hidden fixed bottom-3 left-3 right-3 bg-white/95 backdrop-blur-md rounded-full py-2 px-4 shadow-2xl border border-black/5 flex items-center justify-around z-40 ${className}`}
      >
        {navItems.map((item) => {
          const isSelected = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                soundEngine.play('tap');
                onSelectTab(item.id);
              }}
              className="flex flex-col items-center justify-center cursor-pointer select-none py-1 group"
            >
              <div
                className={`p-1.5 rounded-full transition-all duration-200 ${
                  isSelected
                    ? 'bg-[#5B2EA6] text-white shadow-sm'
                    : 'text-[#64748B] group-hover:text-[#1A1F2E]'
                }`}
              >
                {item.icon}
              </div>
              <span
                className={`text-[9px] font-bold mt-0.5 transition-colors ${
                  isSelected ? 'text-[#5B2EA6]' : 'text-[#64748B]'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Universal Create Button */}
        <button
          type="button"
          onClick={() => {
            soundEngine.play('heavyTap');
            onCreateAction?.();
          }}
          className="flex flex-col items-center justify-center cursor-pointer select-none py-1 group"
        >
          <div className="p-1.5 rounded-full bg-[#1A1F2E] text-white shadow-sm hover:scale-105 transition-transform">
            <Plus className="w-5 h-5 text-[#93EE34]" />
          </div>
          <span className="text-[9px] font-bold mt-0.5 text-[#1A1F2E]">
            Create
          </span>
        </button>
      </nav>

      {/* ── DESKTOP SIDEBAR RAIL ── */}
      <aside className="hidden md:flex flex-col w-56 p-4 space-y-6 border-r border-black/5 bg-[#FAFAF8] shrink-0 min-h-screen">
        <div className="flex items-center space-x-2.5 px-2 py-1">
          <div className="w-8 h-8 rounded-xl bg-[#5B2EA6] text-white font-black text-sm flex items-center justify-center shadow-xs">
            B
          </div>
          <span className="text-lg font-black text-[#1A1F2E] tracking-tight">
            Brief
          </span>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  soundEngine.play('tap');
                  onSelectTab(item.id);
                }}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#5B2EA6] text-white shadow-sm'
                    : 'text-[#64748B] hover:text-[#1A1F2E] hover:bg-black/5'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="pt-4 border-t border-black/5">
          <button
            type="button"
            onClick={() => {
              soundEngine.play('heavyTap');
              onCreateAction?.();
            }}
            className="w-full py-2.5 rounded-full bg-[#1A1F2E] hover:bg-black text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4 text-[#93EE34]" />
            <span>Create</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Navigation;
