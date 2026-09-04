import React, { useState } from 'react';
import {
  ArrowLeft,
  Search,
  BookOpen,
  CheckCircle2,
  Sparkles,
  X
} from 'lucide-react';
import {
  SheetMaterial,
  SHEET_MATERIALS,
  IronSheet,
  MetalTag
} from '../components/ui';
import { soundEngine } from '../utils/SoundEngine';

export interface SubcategoryDrillScreenProps {
  material?: SheetMaterial;
  parentCategory?: string;
  subcategory?: string;
  subcategoryIcon?: React.ReactNode;
  onClose?: () => void;
  onSelectItem?: (itemTitle: string) => void;
}

export const SubcategoryDrillScreen: React.FC<SubcategoryDrillScreenProps> = ({
  material = 'copper',
  parentCategory = 'Skills Workshop',
  subcategory = 'Beginner',
  subcategoryIcon,
  onClose,
  onSelectItem
}) => {
  const [sortIndex, setSortIndex] = useState<0 | 1 | 2>(0);
  const [selectedFilter, setSelectedFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const palette = SHEET_MATERIALS[material] || SHEET_MATERIALS.copper;
  const sortOptions = ['Newest', 'Popular', 'Nearby'];
  const filterOptions = ['All', 'Free', 'Certificate', 'Weekend', 'Online'];

  const items = [
    { title: 'Coffee Art', subtitle: '2 slots · Sat 9AM', bigNumber: '2', badge: 'FREE', type: 'Free' },
    { title: 'Espresso 101', subtitle: '4 slots · Sat 11AM', bigNumber: '4', badge: 'PAID', type: 'Certificate' },
    { title: 'Latte Craft', subtitle: '6 slots · Sun 2PM', bigNumber: '6', badge: 'PAID', type: 'Weekend' },
    { title: 'Bean Origins', subtitle: '8 slots · Online Zoom', bigNumber: '8', badge: 'FREE', type: 'Online' },
    { title: 'Milk Steaming', subtitle: '10 slots · Mon 6PM', bigNumber: '10', badge: 'PAID', type: 'Weekend' },
    { title: 'POS Basics', subtitle: '12 slots · Tue 10AM', bigNumber: '12', badge: 'FREE', type: 'Certificate' },
    { title: 'Order Flow', subtitle: '14 slots · Wed 3PM', bigNumber: '14', badge: 'PAID', type: 'Online' },
    { title: 'Cash Handling', subtitle: '16 slots · Thu 1PM', bigNumber: '16', badge: 'FREE', type: 'Free' }
  ];

  const filteredItems = items.filter((item) => {
    const matchesFilter = selectedFilter === 'All' || item.type === selectedFilter || item.badge === selectedFilter.toUpperCase();
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || item.subtitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#E8E4DD] font-sans text-[#1A1F2E] select-none overflow-x-hidden">
      
      {/* ── Top Metallic Band with Diagonal Streaks Overlay ── */}
      <div
        className="relative w-full h-64 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${palette.highlight} 0%, ${palette.base} 45%, ${palette.shadow} 100%)`
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              rgba(255, 255, 255, 0.2),
              rgba(255, 255, 255, 0.2) 1px,
              transparent 1px,
              transparent 4px
            )`
          }}
        />

        <div
          className="absolute -top-12 -right-12 w-64 h-64 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${palette.highlight}88 0%, transparent 70%)`
          }}
        />
      </div>

      {/* ── Main Viewport Overlay ── */}
      <div className="max-w-xl mx-auto -mt-64 relative min-h-screen pb-24">
        
        {/* ================= TOP BAR ================= */}
        <header className="px-4 pt-4 pb-3 flex items-center justify-between text-white">
          <button
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              onClose?.();
            }}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer transition-transform active:scale-90"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <span
            className="text-xs font-bold tracking-widest uppercase truncate max-w-[200px]"
            style={{ color: palette.textSecondary }}
          >
            {parentCategory}
          </span>

          <button
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              setIsSearching(!isSearching);
            }}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer transition-transform active:scale-90"
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </button>
        </header>

        {/* Optional Search Bar Field */}
        {isSearching && (
          <div className="px-5 pb-3 animate-fadeIn">
            <div className="bg-black/30 backdrop-blur-md rounded-2xl px-3 py-2 flex items-center space-x-2 border border-white/20">
              <Search className="w-4 h-4 text-white/70" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${subcategory}...`}
                className="bg-transparent border-none outline-none text-xs text-white placeholder-white/60 w-full"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-white/70 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ================= HEADER ZONE ================= */}
        <div className="px-6 pt-2 pb-6 flex items-center space-x-4">
          <div
            className="w-16 h-16 rounded-[20px] flex items-center justify-center text-white shadow-lg shrink-0"
            style={{ backgroundColor: `${palette.shadow}80` }}
          >
            {subcategoryIcon || <BookOpen className="w-8 h-8" style={{ color: palette.textPrimary }} />}
          </div>

          <div className="min-w-0">
            <h1
              className="text-2xl sm:text-3xl font-black leading-tight truncate"
              style={{ color: palette.textPrimary }}
            >
              {subcategory}
            </h1>
            <p
              className="text-xs font-semibold mt-1"
              style={{ color: palette.textSecondary }}
            >
              {filteredItems.length} items · Updated 5m ago
            </p>
          </div>
        </div>

        {/* ================= FILTER ROW (MetalTag Band) ================= */}
        <div className="px-5 overflow-x-auto no-scrollbar py-1">
          <div className="flex items-center space-x-2 min-w-max">
            {filterOptions.map((f) => {
              const isSelected = selectedFilter === f;
              return (
                <MetalTag
                  key={f}
                  label={f}
                  material={material}
                  selected={isSelected}
                  onTap={() => {
                    soundEngine.play('tap');
                    setSelectedFilter(f);
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* ================= SORT PILL ================= */}
        <div className="px-5 pt-4 pb-4">
          <div className="p-1 rounded-full bg-white shadow-md flex items-center">
            {sortOptions.map((opt, idx) => {
              const isSelected = sortIndex === idx;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    soundEngine.play('tap');
                    setSortIndex(idx as 0 | 1 | 2);
                  }}
                  className={`flex-1 py-2.5 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer text-center ${
                    isSelected
                      ? 'text-white shadow font-black'
                      : 'text-[#6B7280] hover:text-[#1A1F2E]'
                  }`}
                  style={{
                    backgroundColor: isSelected ? palette.base : 'transparent'
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* ================= ITEM GRID (2-Column IronSheet) ================= */}
        <main className="px-5">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 bg-white/60 rounded-3xl p-6 border border-black/5">
              <Sparkles className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-[#1A1F2E]">No items match "{selectedFilter}"</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedFilter('All');
                  setSearchQuery('');
                }}
                className="mt-3 px-4 py-2 rounded-full bg-[#1A1F2E] text-white text-xs font-bold"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredItems.map((item, idx) => (
                <IronSheet
                  key={item.title}
                  material={material}
                  title={item.title}
                  subtitle={item.subtitle}
                  bigNumber={item.bigNumber}
                  badge={item.badge}
                  animationDelayMs={idx * 60}
                  onTap={() => {
                    soundEngine.play('tap');
                    showToast(`Selected ${item.title}`);
                    onSelectItem?.(item.title);
                  }}
                />
              ))}
            </div>
          )}
        </main>

      </div>

      {/* ================= TOAST ================= */}
      {toastMsg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-[#1A1F2E] text-white text-xs font-bold shadow-2xl flex items-center space-x-2 animate-fadeIn border border-white/10">
          <CheckCircle2 className="w-4 h-4 text-[#2ECC71]" />
          <span>{toastMsg}</span>
        </div>
      )}

    </div>
  );
};
