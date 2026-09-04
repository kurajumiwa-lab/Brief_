import React, { useState, useEffect } from 'react';
import {
  Menu,
  MapPin,
  Bookmark,
  Briefcase,
  Trophy,
  Heart,
  Users,
  Coins,
  Activity,
  Truck,
  Sparkles,
  X,
  Plus,
  Clock,
  Search,
  CheckCircle2,
  CalendarDays,
  Bike,
  ShieldCheck,
  ChevronDown,
  Award,
  Phone
} from 'lucide-react';
import {
  IronSheet,
  SheetMaterial,
  MetalTag,
  WairoBookmark,
  BriefBuilderSection
} from '../components/ui';
import { AppPalette } from '../styles/appPalette';
import { WairoMiniApp } from '../components/wairo/WairoMiniApp';
import { LiveTelemetryModal } from '../components/wairo/LiveTelemetryModal';
import { LocationModal } from '../components/wairo/LocationModal';
import { DispatchModal } from '../components/wairo/DispatchModal';
import { EmbedSDKModal } from '../components/wairo/EmbedSDKModal';
import { PrivateCarrierAuctionDesk } from '../components/wairo/PrivateCarrierAuctionDesk';
import { UssdSimulatorDesk } from '../components/offline/UssdSimulatorDesk';
import { OfflineSyncQueueDesk } from '../components/offline/OfflineSyncQueueDesk';
import { LOCATIONS, INITIAL_ACTIVE_DELIVERY, WairoLocation, WairoDelivery } from '../components/wairo/wairoData';
import { CommitteeDesk } from '../components/life/CommitteeDesk';
import { ChamaDesk } from '../components/circle/ChamaDesk';
import { WellbeingDesk } from '../components/wellbeing/WellbeingDesk';
import { InterCountyDesk } from '../components/wairo/InterCountyDesk';
import { UniversalCreatePostModal, Post } from '../components/posts/UniversalCreatePostModal';
import { SheetDetailScreen, SheetDetailScreenProps } from './SheetDetailScreen';
import { SubcategoryDrillScreen, SubcategoryDrillScreenProps } from './SubcategoryDrillScreen';
import {
  NEIGHBORHOODS,
  Neighborhood,
  getPrimaryNeighborhood,
  setPrimaryNeighborhood
} from '../model/neighborhoods';
import { NeighborhoodPickerModal } from '../components/neighborhood/NeighborhoodPickerModal';
import { CommunityChampionModal } from '../components/neighborhood/CommunityChampionModal';
import { soundEngine } from '../utils/SoundEngine';

export interface LandingScreenProps {
  onNavigateTab?: (tab: 'menu' | 'nearby' | 'mylayer' | 'workflows') => void;
  selectedLocation?: string;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({
  onNavigateTab,
  selectedLocation = "Lang'ata"
}) => {
  // Primary Neighborhood State (Week 2: Neighborhood Identity)
  const [activeNeighborhood, setActiveNeighborhood] = useState<Neighborhood>(() => getPrimaryNeighborhood());
  const [isNeighborhoodPickerOpen, setIsNeighborhoodPickerOpen] = useState(false);
  const [isChampionModalOpen, setIsChampionModalOpen] = useState(false);

  // Section Switcher State (0: Today, 1: Districts, 2: Shelf)
  const [selectedSection, setSelectedSection] = useState<0 | 1 | 2>(0);
  const [activeBottomNav, setActiveBottomNav] = useState<number>(1); // 1 = Nearby/Home

  // Wairo Floating State
  const [wairoSheetOpen, setWairoSheetOpen] = useState(false);
  const [wairoMiniAppOpen, setWairoMiniAppOpen] = useState(false);
  const [wairoLocation, setWairoLocation] = useState<WairoLocation>(LOCATIONS[0]);
  const [wairoDelivery, setWairoDelivery] = useState<WairoDelivery>(INITIAL_ACTIVE_DELIVERY);

  // Sync wairo location with active neighborhood when neighborhood changes
  const handleSelectNeighborhood = (nh: Neighborhood) => {
    setActiveNeighborhood(nh);
    setPrimaryNeighborhood(nh.id);
    const matchedLoc = LOCATIONS.find((l) => l.id.toLowerCase() === nh.id.toLowerCase());
    if (matchedLoc) {
      setWairoLocation(matchedLoc);
    }
    showToast(`Neighborhood switched to ${nh.name} (${nh.zone})`);
  };

  // Wairo Submodals
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [isSDKModalOpen, setIsSDKModalOpen] = useState(false);
  const [isCarrierAuctionOpen, setIsCarrierAuctionOpen] = useState(false);
  const [isUssdOpen, setIsUssdOpen] = useState(false);
  const [isOfflineSyncOpen, setIsOfflineSyncOpen] = useState(false);

  // Hub Desks Modals (Core 4 Pillars: WAIRO · Chamas · Gigs · Events)
  const [committeeOpen, setCommitteeOpen] = useState(false);
  const [chamaOpen, setChamaOpen] = useState(false);
  const [wellbeingOpen, setWellbeingOpen] = useState(false);
  const [interCountyOpen, setInterCountyOpen] = useState(false);
  const [createPostOpen, setCreatePostOpen] = useState(false);

  // Detail Screens Navigation Stack
  const [activeDetailScreen, setActiveDetailScreen] = useState<Omit<SheetDetailScreenProps, 'onClose'> | null>(null);
  const [activeDrillScreen, setActiveDrillScreen] = useState<Omit<SubcategoryDrillScreenProps, 'onClose'> | null>(null);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const openCategoryDetail = (params: Omit<SheetDetailScreenProps, 'onClose'>) => {
    soundEngine.play('tap');
    setActiveDetailScreen(params);
  };

  const openHubDetail = (params: Omit<SheetDetailScreenProps, 'onClose'>) => {
    soundEngine.play('tap');
    setActiveDetailScreen(params);
  };

  const openSubcategoryDrill = (params: Omit<SubcategoryDrillScreenProps, 'onClose'>) => {
    soundEngine.play('tap');
    setActiveDrillScreen(params);
  };

  const sections = ['Today', 'Districts', 'Shelf'];

  const bottomNavItems = [
    { id: 'menu', label: 'Menu', icon: Menu, tab: 'menu' as const },
    { id: 'nearby', label: 'Nearby', icon: MapPin, tab: 'nearby' as const },
    { id: 'mylayer', label: 'Layer', icon: Bookmark, tab: 'mylayer' as const },
    { id: 'workflows', label: 'Work', icon: Briefcase, tab: 'workflows' as const },
  ];

  return (
    <div className="relative min-h-screen w-full bg-[#E8E4DD] text-[#1A1F2E] font-sans overflow-x-hidden selection:bg-[#E8985E]/30">
      
      {/* ================= FLOATING WAIRO BOOKMARK (TOP-RIGHT) ================= */}
      <div className="fixed top-2 right-4 z-40">
        <WairoBookmark
          status="IN TRANSIT"
          location={wairoLocation.name}
          onTap={() => {
            soundEngine.play('heavyTap');
            setWairoSheetOpen(true);
          }}
        />
      </div>

      {/* ================= SCROLLABLE VIEWPORT ================= */}
      <div className="max-w-xl mx-auto px-4 sm:px-6 pt-3 pb-36 min-h-screen">
        
        {/* ── COMPACT HEADER WITH NEIGHBORHOOD IDENTITY ── */}
        <header className="pr-20 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#8B4FFF] to-[#E85D75] flex items-center justify-center text-white font-black text-lg shadow-md shrink-0">
              L
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B7280]">
                AROUND YOU
              </span>
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('tap');
                  setIsNeighborhoodPickerOpen(true);
                }}
                className="flex items-center space-x-1.5 text-left group cursor-pointer"
              >
                <h1 className="text-2xl font-black text-[#1A1F2E] leading-none tracking-tight group-hover:text-[#B8621F] transition-colors">
                  Home · {activeNeighborhood.name}
                </h1>
                <ChevronDown className="w-4 h-4 text-[#6B7280] group-hover:text-[#B8621F]" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              setIsChampionModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white text-[#1A1F2E] text-xs font-black shadow-sm transition-transform active:scale-95 cursor-pointer"
          >
            <span className="text-sm">{activeNeighborhood.champion.avatar}</span>
            <span className="hidden sm:inline text-[11px]">{activeNeighborhood.champion.name}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 font-extrabold uppercase">
              Champion
            </span>
          </button>
        </header>

        {/* ── NEIGHBORHOOD 3KM MICRO-HUB LIVE BANNER ── */}
        <div className="my-2 p-3.5 rounded-2xl bg-[#1A1F2E] text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black text-white truncate">
                  {activeNeighborhood.name} Micro-Hub
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#00BFEF]/20 text-[#00BFEF] font-bold">
                  {activeNeighborhood.stats.activeRidersCount} BODA RIDERS
                </span>
              </div>
              <p className="text-[11px] text-gray-300 truncate">
                {activeNeighborhood.recentActivity[0]?.text || activeNeighborhood.tagline}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              setIsNeighborhoodPickerOpen(true);
            }}
            className="ml-2 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-gray-200 transition-colors cursor-pointer shrink-0"
          >
            Switch
          </button>
        </div>

        {/* ── BRIEF BUILDER STRIP & CUSTOMIZER ── */}
        <BriefBuilderSection
          initialCities={[activeNeighborhood.name]}
          onBuildBrief={({ cities, interests }) => {
            showToast(`Brief calibrated for ${cities.length} places & ${interests.length} topics!`);
          }}
          onOpenCollections={() => showToast('Opening saved Collections')}
          onOpenFollowing={() => showToast('Opening Following feed')}
          onOpenUpdates={() => showToast('Checking recent Updates')}
        />

        {/* ── SHARED SECTION SWITCHER ── */}
        <div className="py-2">
          <div className="p-1 rounded-full bg-[#1A1F2E]/[0.07] flex items-center">
            {sections.map((sec, idx) => {
              const isSelected = selectedSection === idx;
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    soundEngine.play('tap');
                    setSelectedSection(idx as 0 | 1 | 2);
                  }}
                  className={`flex-1 py-2.5 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer text-center ${
                    isSelected
                      ? 'bg-[#1A1F2E] text-white shadow-md'
                      : 'text-[#6B7280] hover:text-[#1A1F2E]'
                  }`}
                >
                  {sec}
                </button>
              );
            })}
          </div>
        </div>

        {/* ================= SECTION 0: TODAY ================= */}
        {selectedSection === 0 && (
          <div className="space-y-4 animate-fadeIn">
            {/* Section Header Label */}
            <div className="flex items-center justify-between pt-1 pb-2">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-[#E8985E]" />
                <span className="text-xs font-black tracking-widest uppercase text-[#1A1F2E]">
                  Today in {activeNeighborhood.name}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-[#6B7280]">Live · 3km Radius</span>
            </div>

            {/* 2-Column IronSheet Grid (WAIRO · Chamas · Gigs · Events) */}
            <div className="grid grid-cols-2 gap-3">
              <IronSheet
                material="jade"
                title="Paid Gigs"
                subtitle={activeNeighborhood.activeGigs[0]?.title || "Waiter · Delivery · Cashier"}
                bigNumber={String(activeNeighborhood.stats.verifiedGigsCount || 3)}
                badge="GIGS"
                animationDelayMs={0}
                onTap={() =>
                  openCategoryDetail({
                    material: 'jade',
                    title: `${activeNeighborhood.name} Paid Gigs`,
                    subtitle: `${activeNeighborhood.activeGigs[0]?.employer || 'Local Businesses'} · 48h settlement`,
                    emoji: '💼',
                    badge: 'GIGS',
                    heroDescription:
                      `Verified employers in ${activeNeighborhood.name} post gigs daily. Apply once, get matched instantly, and receive payment within 48 hours. No agency fees.`
                  })
                }
              />

              <IronSheet
                material="steel"
                title="Fresh Harvest"
                subtitle="Avocados & Produce from Nyamataro"
                bigNumber="5"
                badge="PRODUCE"
                animationDelayMs={80}
                onTap={() =>
                  openCategoryDetail({
                    material: 'steel',
                    title: 'Fresh Harvest Produce',
                    subtitle: 'Farm-direct organics delivered to your doorstep',
                    emoji: '🥑',
                    badge: 'PRODUCE',
                    heroDescription:
                      'Direct partnership with smallholder cooperatives across Mt. Kenya and Rift Valley. Guaranteed freshness, verified fair-trade prices.'
                  })
                }
              />

              <IronSheet
                material="copper"
                title="WAIRO Logistics"
                subtitle={`${activeNeighborhood.activeRiders[0]?.name || 'Otieno'} · ${activeNeighborhood.activeRiders[0]?.distance || '0.4 km'} · ${activeNeighborhood.activeRiders[0]?.eta || '3 mins'}`}
                emoji="📦"
                badge="90/10"
                animationDelayMs={160}
                onTap={() => {
                  soundEngine.play('heavyTap');
                  setWairoSheetOpen(true);
                }}
              />

              <IronSheet
                material="obsidian"
                title="Chama Savings"
                subtitle={`${activeNeighborhood.activeChamas[0]?.name || 'Traders Circle'} · ${activeNeighborhood.activeChamas[0]?.cycle || 'Cycle 5'}`}
                emoji="🌸"
                badge="CHAMA"
                animationDelayMs={240}
                onTap={() => {
                  soundEngine.play('heavyTap');
                  setChamaOpen(true);
                }}
              />
            </div>
          </div>
        )}

        {/* ================= SECTION 1: DISTRICTS ================= */}
        {selectedSection === 1 && (
          <div className="space-y-4 animate-fadeIn">
            {/* Section Header Label */}
            <div className="flex items-center justify-between pt-1 pb-2">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-[#E8985E]" />
                <span className="text-xs font-black tracking-widest uppercase text-[#1A1F2E]">
                  Town Centre Districts · {activeNeighborhood.name}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-[#6B7280]">4 Core Pillars</span>
            </div>

            {/* 2-Column IronSheet Grid (WAIRO · Chamas · Gigs · Events) */}
            <div className="grid grid-cols-2 gap-3">
              <IronSheet
                material="copper"
                title="WAIRO Logistics & Cargo"
                subtitle="Courier · Errands · 47 Counties"
                emoji="🚚"
                badge="WAIRO 90/10"
                animationDelayMs={0}
                onTap={() => {
                  soundEngine.play('heavyTap');
                  setWairoSheetOpen(true);
                }}
              />

              <IronSheet
                material="obsidian"
                title="Chama & Table Bank"
                subtitle={activeNeighborhood.activeChamas[0]?.name || "Merry-Go-Round · Rotational"}
                emoji="🌸"
                badge={activeNeighborhood.activeChamas[0]?.cycle || "CYCLE 5"}
                animationDelayMs={80}
                onTap={() =>
                  openHubDetail({
                    material: 'obsidian',
                    title: 'Chama & Table Bank',
                    subtitle: `${activeNeighborhood.name} verified circular savings`,
                    emoji: '🌸',
                    badge: 'CHAMA',
                    heroDescription:
                      'Transparent community savings, rotational payouts, and micro-loans with instant M-Pesa ledger verification.',
                    onJoinSuccess: () => setChamaOpen(true)
                  })
                }
              />

              <IronSheet
                material="jade"
                title="Paid Gigs Hub"
                subtitle="Waiter · Delivery · Cashier"
                emoji="💼"
                badge="LIVE GIGS"
                animationDelayMs={160}
                onTap={() =>
                  openCategoryDetail({
                    material: 'jade',
                    title: 'Paid Gigs Hub',
                    subtitle: 'Verified local micro-work with 48h settlement',
                    emoji: '💼',
                    badge: 'LIVE GIGS',
                    heroDescription:
                      'Local employers post shifts and tasks daily. Work verified gigs, get rated, and receive payment directly.'
                  })
                }
              />

              <IronSheet
                material="steel"
                title="Life-Events Hub"
                subtitle="Burial & Harambee"
                emoji="🕊️"
                badge="72% FUNDED"
                animationDelayMs={240}
                onTap={() =>
                  openHubDetail({
                    material: 'steel',
                    title: 'Life-Events Hub',
                    subtitle: 'Community-funded burial & harambee coordination',
                    emoji: '🕊️',
                    badge: '72% FUNDED',
                    heroDescription:
                      'When life hits, the community responds. Track contributions, coordinate logistics, honor traditions — all in one place.',
                    onJoinSuccess: () => setCommitteeOpen(true)
                  })
                }
              />
            </div>

            {/* Subcategory Metal Tags Band */}
            <div className="pt-3 space-y-2">
              <span className="text-[11px] font-extrabold tracking-wider uppercase text-[#6B7280] block">
                Quick Access
              </span>
              <div className="flex items-center space-x-2 overflow-x-auto pb-2">
                <MetalTag
                  label="WAIRO"
                  icon={<Bike className="w-3.5 h-3.5" />}
                  material="copper"
                  selected={true}
                  onTap={() => setWairoSheetOpen(true)}
                />
                <MetalTag
                  label="Cargo"
                  icon={<Truck className="w-3.5 h-3.5" />}
                  material="steel"
                  onTap={() => {
                    setWairoLocation(LOCATIONS[0]);
                    setInterCountyOpen(true);
                  }}
                />
                <MetalTag
                  label="Chama"
                  icon={<Coins className="w-3.5 h-3.5" />}
                  material="obsidian"
                  onTap={() => setChamaOpen(true)}
                />
                <MetalTag
                  label="Gigs"
                  icon={<Briefcase className="w-3.5 h-3.5" />}
                  material="jade"
                  onTap={() =>
                    openSubcategoryDrill({
                      material: 'jade',
                      parentCategory: 'Paid Gigs',
                      subcategory: 'Open Shifts'
                    })
                  }
                />
                <MetalTag
                  label="Events"
                  icon={<CalendarDays className="w-3.5 h-3.5" />}
                  material="brass"
                  onTap={() =>
                    openCategoryDetail({
                      material: 'brass',
                      title: 'Community Events & Pop-ups',
                      subtitle: 'Live performances, weekend markets & gatherings',
                      emoji: '🎉',
                      badge: 'EVENTS',
                      heroDescription: 'Local events, cultural nights, and community gatherings.'
                    })
                  }
                />
                <MetalTag
                  label="Champion Desk"
                  icon={<ShieldCheck className="w-3.5 h-3.5" />}
                  material="brass"
                  onTap={() => setIsChampionModalOpen(true)}
                />
                <MetalTag
                  label="Harambee"
                  icon={<Heart className="w-3.5 h-3.5" />}
                  material="steel"
                  onTap={() => setCommitteeOpen(true)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= SECTION 2: SHELF ================= */}
        {selectedSection === 2 && (
          <div className="space-y-4 animate-fadeIn">
            {/* Section Header Label */}
            <div className="flex items-center justify-between pt-1 pb-2">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-[#E8985E]" />
                <span className="text-xs font-black tracking-widest uppercase text-[#1A1F2E]">
                  My Shelf
                </span>
              </div>
              <span className="text-[11px] font-semibold text-[#6B7280]">Your picks</span>
            </div>

            <div className="space-y-3">
              <IronSheet
                material="jade"
                title="Community Events"
                subtitle="Live gigs & street markets"
                emoji="🎉"
                badge="EVENTS"
                height={130}
                animationDelayMs={0}
                onTap={() => setSelectedSection(1)}
              />

              <IronSheet
                material="copper"
                title="Around You"
                subtitle="Places, events, and people near me"
                emoji="📍"
                height={130}
                animationDelayMs={100}
                onTap={() => setSelectedSection(1)}
              />

              <IronSheet
                material="brass"
                title="Mshiriki"
                subtitle="Have your say · Community polls"
                emoji="❤️"
                height={130}
                animationDelayMs={200}
                onTap={() => showToast('Opening Mshiriki Community Polls')}
              />
            </div>
          </div>
        )}

      </div>

      {/* ================= FLOATING BOTTOM NAVIGATION PILL ================= */}
      <nav
        aria-label="Bottom Navigation"
        className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto bg-white/95 backdrop-blur-md rounded-full py-2.5 px-4 shadow-2xl border border-black/5 flex items-center justify-around z-30"
      >
        {bottomNavItems.map((item, idx) => {
          const Icon = item.icon;
          const isSelected = activeBottomNav === idx;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                soundEngine.play('tap');
                setActiveBottomNav(idx);
                onNavigateTab?.(item.tab);
              }}
              className="flex flex-col items-center justify-center cursor-pointer select-none group"
            >
              <div
                className={`p-2 rounded-full transition-all duration-200 ${
                  isSelected
                    ? 'bg-[#E8985E] text-white shadow-md'
                    : 'text-[#6B7280] group-hover:text-[#1A1F2E]'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span
                className={`text-[10px] font-bold mt-0.5 transition-colors ${
                  isSelected ? 'text-[#E8985E]' : 'text-[#6B7280]'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ================= WAIRO BOTTOM SHEET MODAL ================= */}
      {wairoSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end p-3 animate-fadeIn"
          onClick={() => setWairoSheetOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg mx-auto rounded-[28px] p-6 text-white shadow-2xl animate-slideUp"
            style={{
              background: 'linear-gradient(135deg, #B8621F 0%, #8B4513 100%)',
              boxShadow: '0 20px 48px rgba(0, 0, 0, 0.4)'
            }}
          >
            {/* Top Badge & Close */}
            <div className="flex items-center justify-between">
              <div className="px-3 py-1 rounded-lg bg-white/20 text-white text-[10px] font-black tracking-wider uppercase">
                WAIRO · 90/10 PAYOUT
              </div>

              <button
                type="button"
                onClick={() => setWairoSheetOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title & Status */}
            <div className="mt-4 space-y-1">
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                WAIRO · Courier & Errands
              </h2>
              <p className="text-sm text-white/85 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Active Boda Stage · {activeNeighborhood.name}</span>
              </p>
            </div>

            {/* Mode Toggle: Local Errand vs Cross-County Cargo */}
            <div className="mt-4 p-1 rounded-xl bg-black/20 flex items-center gap-1">
              <button
                type="button"
                onClick={() => soundEngine.play('tap')}
                className="flex-1 py-2 rounded-lg bg-white/25 text-white text-xs font-bold text-center cursor-pointer"
              >
                Local Errand (Boda)
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('tap');
                  setWairoSheetOpen(false);
                  setInterCountyOpen(true);
                }}
                className="flex-1 py-2 rounded-lg text-white/70 hover:text-white text-xs font-bold text-center cursor-pointer"
              >
                Cross-County Cargo
              </button>
            </div>

            {/* Actions: Track, History, Book */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <MetalTag
                label="Track"
                icon={<Search className="w-3.5 h-3.5" />}
                material="copper"
                selected={true}
                onTap={() => {
                  setWairoSheetOpen(false);
                  setIsTelemetryOpen(true);
                }}
              />
              <MetalTag
                label="Dispatch"
                icon={<Plus className="w-3.5 h-3.5" />}
                material="copper"
                onTap={() => {
                  setWairoSheetOpen(false);
                  setIsDispatchModalOpen(true);
                }}
              />
              <MetalTag
                label="History"
                icon={<Clock className="w-3.5 h-3.5" />}
                material="copper"
                onTap={() => {
                  setWairoSheetOpen(false);
                  setWairoMiniAppOpen(true);
                }}
              />
            </div>

            {/* Non-Promises Disclaimer */}
            <p className="mt-4 text-[10px] text-white/70 leading-snug text-center">
              You are booking a rider directly. Brief connects you and records the trip — resolving issues is between you and the rider, with support from your Community Champion if needed.
            </p>
          </div>
        </div>
      )}

      {/* ================= MODAL: WAIRO MINI APP FULL DRAWER ================= */}
      {wairoMiniAppOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg h-[85vh] rounded-3xl overflow-hidden bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setWairoMiniAppOpen(false)}
              className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <WairoMiniApp
              onOpenTelemetry={() => setIsTelemetryOpen(true)}
              onOpenLocationModal={() => setIsLocationModalOpen(true)}
              onOpenDispatchModal={() => setIsDispatchModalOpen(true)}
              onOpenSDKModal={() => setIsSDKModalOpen(true)}
              onOpenUssdSim={() => setIsUssdOpen(true)}
              onOpenInterCounty={() => setInterCountyOpen(true)}
              onOpenCarrierAuction={() => setIsCarrierAuctionOpen(true)}
              onOpenOfflineSync={() => setIsOfflineSyncOpen(true)}
              selectedLocation={wairoLocation}
              activeDelivery={wairoDelivery}
            />
          </div>
        </div>
      )}

      {/* ================= WAIRO INTEGRATED MODALS ================= */}
      <LiveTelemetryModal 
        isOpen={isTelemetryOpen} 
        onClose={() => setIsTelemetryOpen(false)}
        activeDelivery={wairoDelivery}
        selectedLocation={wairoLocation}
      />

      <LocationModal 
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        selectedLocation={wairoLocation}
        onSelectLocation={(loc) => {
          setWairoLocation(loc);
          setWairoDelivery(prev => ({
            ...prev,
            destination: loc.fullName,
            locationId: loc.id,
            etaMinutes: loc.etaMins,
          }));
        }}
      />

      <DispatchModal 
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        onDispatchSuccess={(newOrder) => {
          setWairoDelivery(newOrder);
          const found = LOCATIONS.find(l => l.id === newOrder.locationId);
          if (found) setWairoLocation(found);
        }}
        currentLocation={wairoLocation}
      />

      <EmbedSDKModal 
        isOpen={isSDKModalOpen}
        onClose={() => setIsSDKModalOpen(false)}
      />

      {/* ================= USSD / SMS SIMULATOR MODAL ================= */}
      {isUssdOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} className="bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-auto">
            <UssdSimulatorDesk onClose={() => setIsUssdOpen(false)} />
          </div>
        </div>
      )}

      {/* ================= CARRIER REVERSE AUCTION MODAL ================= */}
      {isCarrierAuctionOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} className="bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-auto">
            <PrivateCarrierAuctionDesk onClose={() => setIsCarrierAuctionOpen(false)} />
          </div>
        </div>
      )}

      {/* ================= OFFLINE SYNC QUEUE MODAL ================= */}
      {isOfflineSyncOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} className="bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-auto">
            <OfflineSyncQueueDesk onClose={() => setIsOfflineSyncOpen(false)} />
          </div>
        </div>
      )}

      {/* ================= MODAL: LIFE EVENTS COMMITTEE ================= */}
      {committeeOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-2xl my-auto">
            <CommitteeDesk onClose={() => setCommitteeOpen(false)} />
          </div>
        </div>
      )}

      {/* ================= MODAL: CHAMA TABLE BANK ================= */}
      {chamaOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-auto">
            <ChamaDesk onClose={() => setChamaOpen(false)} />
          </div>
        </div>
      )}

      {/* ================= MODAL: WELLBEING HUB ================= */}
      {wellbeingOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-2xl my-auto">
            <WellbeingDesk onClose={() => setWellbeingOpen(false)} />
          </div>
        </div>
      )}

      {/* ================= MODAL: INTER-COUNTY CARGO ================= */}
      {interCountyOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-auto">
            <InterCountyDesk onClose={() => setInterCountyOpen(false)} />
          </div>
        </div>
      )}

      {/* ================= MODAL: NEIGHBORHOOD PICKER (WEEK 2) ================= */}
      <NeighborhoodPickerModal
        isOpen={isNeighborhoodPickerOpen}
        selectedId={activeNeighborhood.id}
        onSelect={handleSelectNeighborhood}
        onClose={() => setIsNeighborhoodPickerOpen(false)}
      />

      {/* ================= MODAL: COMMUNITY CHAMPION (WEEK 2) ================= */}
      <CommunityChampionModal
        isOpen={isChampionModalOpen}
        neighborhood={activeNeighborhood}
        onClose={() => setIsChampionModalOpen(false)}
        onCallChampion={(phone: string) => showToast(`Calling ${activeNeighborhood.champion.name} (${phone})`)}
        onVouchRider={() => showToast(`Vouch form opened for ${activeNeighborhood.name}`)}
      />

      {/* ================= MODAL: POST CREATOR ================= */}
      {createPostOpen && (
        <UniversalCreatePostModal
          isOpen={createPostOpen}
          onClose={() => setCreatePostOpen(false)}
          onPostCreated={(post) => {
            showToast(`Published "${post.title}" to local feed!`);
          }}
        />
      )}

      {/* ================= FULL-SCREEN ROUTE: SHEET DETAIL SCREEN ================= */}
      {activeDetailScreen && (
        <div className="fixed inset-0 z-50 overflow-y-auto animate-slideUp bg-[#1A1F2E]">
          <SheetDetailScreen
            material={activeDetailScreen.material}
            title={activeDetailScreen.title}
            subtitle={activeDetailScreen.subtitle}
            emoji={activeDetailScreen.emoji}
            badge={activeDetailScreen.badge}
            heroDescription={activeDetailScreen.heroDescription}
            onClose={() => setActiveDetailScreen(null)}
            onJoinSuccess={() => {
              activeDetailScreen.onJoinSuccess?.();
            }}
            onOpenSubcategoryDrill={(drill) => {
              openSubcategoryDrill({
                material: drill.material,
                parentCategory: drill.parent,
                subcategory: drill.sub,
                subcategoryIcon: drill.icon
              });
            }}
          />
        </div>
      )}

      {/* ================= FULL-SCREEN ROUTE: SUBCATEGORY DRILL SCREEN ================= */}
      {activeDrillScreen && (
        <div className="fixed inset-0 z-50 overflow-y-auto animate-slideUp bg-[#E8E4DD]">
          <SubcategoryDrillScreen
            material={activeDrillScreen.material}
            parentCategory={activeDrillScreen.parentCategory}
            subcategory={activeDrillScreen.subcategory}
            subcategoryIcon={activeDrillScreen.subcategoryIcon}
            onClose={() => setActiveDrillScreen(null)}
            onSelectItem={(itemTitle) => {
              showToast(`Selected "${itemTitle}"`);
            }}
          />
        </div>
      )}

      {/* ================= TOAST NOTIFICATION ================= */}
      {toastMsg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-[#1A1F2E] text-white text-xs font-bold shadow-2xl flex items-center space-x-2 animate-fadeIn border border-white/10">
          <CheckCircle2 className="w-4 h-4 text-[#2ECC71]" />
          <span>{toastMsg}</span>
        </div>
      )}

    </div>
  );
};
