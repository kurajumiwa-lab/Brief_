import React, { useState } from 'react';
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
  FileText,
  Compass,
  Sparkles,
  X,
  Plus,
  Clock,
  Search,
  CheckCircle2,
  CalendarDays
} from 'lucide-react';
import {
  IronSheet,
  SheetMaterial,
  MetalTag,
  WairoBookmark
} from '../components/ui';
import { AppPalette } from '../styles/appPalette';
import { WairoMiniApp } from '../components/wairo/WairoMiniApp';
import { LOCATIONS, INITIAL_ACTIVE_DELIVERY, WairoLocation, WairoDelivery } from '../components/wairo/wairoData';
import { CommitteeDesk } from '../components/life/CommitteeDesk';
import { ChamaDesk } from '../components/circle/ChamaDesk';
import { WellbeingDesk } from '../components/wellbeing/WellbeingDesk';
import { InterCountyDesk } from '../components/wairo/InterCountyDesk';
import { CivicKnowledgeGuide } from '../components/civic/CivicKnowledgeGuide';
import { BriefAiAssistant } from '../components/ai/BriefAiAssistant';
import { UniversalCreatePostModal, Post } from '../components/posts/UniversalCreatePostModal';
import { soundEngine } from '../utils/SoundEngine';

export interface LandingScreenProps {
  onNavigateTab?: (tab: 'menu' | 'nearby' | 'mylayer' | 'workflows' | 'arena') => void;
  selectedLocation?: string;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({
  onNavigateTab,
  selectedLocation = "Lang'ata"
}) => {
  // Section Switcher State (0: Today, 1: Districts, 2: Shelf)
  const [selectedSection, setSelectedSection] = useState<0 | 1 | 2>(0);
  const [activeBottomNav, setActiveBottomNav] = useState<number>(1); // 1 = Nearby/Home

  // Wairo Floating State
  const [wairoSheetOpen, setWairoSheetOpen] = useState(false);
  const [wairoMiniAppOpen, setWairoMiniAppOpen] = useState(false);
  const [wairoLocation, setWairoLocation] = useState<WairoLocation>(LOCATIONS[0]);
  const [wairoDelivery, setWairoDelivery] = useState<WairoDelivery>(INITIAL_ACTIVE_DELIVERY);

  // Hub Desks Modals
  const [committeeOpen, setCommitteeOpen] = useState(false);
  const [chamaOpen, setChamaOpen] = useState(false);
  const [wellbeingOpen, setWellbeingOpen] = useState(false);
  const [interCountyOpen, setInterCountyOpen] = useState(false);
  const [civicGuideOpen, setCivicGuideOpen] = useState(false);
  const [briefAiOpen, setBriefAiOpen] = useState(false);
  const [createPostOpen, setCreatePostOpen] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const sections = ['Today', 'Districts', 'Shelf'];

  const bottomNavItems = [
    { id: 'menu', label: 'Menu', icon: Menu, tab: 'menu' as const },
    { id: 'nearby', label: 'Nearby', icon: MapPin, tab: 'nearby' as const },
    { id: 'mylayer', label: 'Layer', icon: Bookmark, tab: 'mylayer' as const },
    { id: 'workflows', label: 'Work', icon: Briefcase, tab: 'workflows' as const },
    { id: 'arena', label: 'Arena', icon: Trophy, tab: 'arena' as const },
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
        
        {/* ── COMPACT HEADER ── */}
        <header className="pr-20 py-2 flex items-center space-x-3">
          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#8B4FFF] to-[#E85D75] flex items-center justify-center text-white font-black text-lg shadow-md shrink-0">
            L
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B7280]">
              AROUND YOU
            </span>
            <h1 className="text-2xl font-black text-[#1A1F2E] leading-none tracking-tight">
              Home
            </h1>
          </div>
        </header>

        {/* ── SHARED SECTION SWITCHER ── */}
        <div className="py-4">
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
                  Today's Opportunities
                </span>
              </div>
              <span className="text-[11px] font-semibold text-[#6B7280]">Live</span>
            </div>

            {/* 2-Column IronSheet Grid */}
            <div className="grid grid-cols-2 gap-3">
              <IronSheet
                material="jade"
                title="Paid Gigs"
                subtitle="Waiter · Delivery · Cashier"
                bigNumber="3"
                badge="GIGS"
                animationDelayMs={0}
                onTap={() => showToast('Opening Paid Gigs board')}
              />

              <IronSheet
                material="steel"
                title="Pool Match"
                subtitle="Needs 1 player · eFootball"
                bigNumber="1"
                badge="ARENA"
                animationDelayMs={80}
                onTap={() => {
                  if (onNavigateTab) onNavigateTab('arena');
                  else showToast('Opening Arena matchmaking');
                }}
              />

              <IronSheet
                material="copper"
                title="Skills Workshop"
                subtitle="2:00 PM · Online Zoom"
                emoji="✨"
                badge="LEARNING"
                animationDelayMs={160}
                onTap={() => showToast('Opening Skills Workshop')}
              />

              <IronSheet
                material="brass"
                title="Thrift Drop"
                subtitle="12:00 PM · Nyamataro Market"
                emoji="👕"
                badge="THRIFT"
                animationDelayMs={240}
                onTap={() => showToast('Opening Thrift Drop')}
              />

              <IronSheet
                material="obsidian"
                title="J Segera"
                subtitle="Live at 7:00 PM · Kisii Lounge"
                emoji="🎤"
                badge="CREATOR"
                animationDelayMs={320}
                onTap={() => showToast('Opening Creator Live Event')}
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
                  Town Centre Districts
                </span>
              </div>
              <span className="text-[11px] font-semibold text-[#6B7280]">4 Live Hubs</span>
            </div>

            {/* 2-Column IronSheet Grid */}
            <div className="grid grid-cols-2 gap-3">
              <IronSheet
                material="steel"
                title="Life-Events Hub"
                subtitle="Burial & Harambee"
                emoji="🕊️"
                badge="72% FUNDED"
                animationDelayMs={0}
                onTap={() => setCommitteeOpen(true)}
              />

              <IronSheet
                material="obsidian"
                title="Chama & Table Bank"
                subtitle="Merry-Go-Round"
                emoji="🌸"
                badge="CYCLE 5"
                animationDelayMs={80}
                onTap={() => setChamaOpen(true)}
              />

              <IronSheet
                material="zinc"
                title="Wellbeing Hub"
                subtitle="Circles & Therapists"
                emoji="💚"
                badge="PRIVATE"
                animationDelayMs={160}
                onTap={() => setWellbeingOpen(true)}
              />

              <IronSheet
                material="steel"
                title="Inter-County Cargo"
                subtitle="Mombasa · Kisumu"
                emoji="🚚"
                badge="4-COUNTY"
                animationDelayMs={240}
                onTap={() => setInterCountyOpen(true)}
              />

              <IronSheet
                material="copper"
                title="Town Concierge"
                subtitle="Local Guide"
                emoji="🤖"
                badge="THE MAYOR"
                animationDelayMs={320}
                onTap={() => setBriefAiOpen(true)}
              />

              <IronSheet
                material="brass"
                title="Civic Guides"
                subtitle="Permits & Licenses"
                emoji="🏛️"
                badge="VERIFIED"
                animationDelayMs={400}
                onTap={() => setCivicGuideOpen(true)}
              />
            </div>

            {/* Subcategory Metal Tags Band */}
            <div className="pt-3 space-y-2">
              <span className="text-[11px] font-extrabold tracking-wider uppercase text-[#6B7280] block">
                Quick Access
              </span>
              <div className="flex items-center space-x-2 overflow-x-auto pb-2">
                <MetalTag
                  label="Burial"
                  icon={<Heart className="w-3.5 h-3.5" />}
                  material="steel"
                  selected={true}
                  onTap={() => setCommitteeOpen(true)}
                />
                <MetalTag
                  label="Harambee"
                  icon={<Users className="w-3.5 h-3.5" />}
                  material="steel"
                  onTap={() => setCommitteeOpen(true)}
                />
                <MetalTag
                  label="Chama"
                  icon={<Coins className="w-3.5 h-3.5" />}
                  material="obsidian"
                  onTap={() => setChamaOpen(true)}
                />
                <MetalTag
                  label="Therapy"
                  icon={<Activity className="w-3.5 h-3.5" />}
                  material="zinc"
                  onTap={() => setWellbeingOpen(true)}
                />
                <MetalTag
                  label="Cargo"
                  icon={<Truck className="w-3.5 h-3.5" />}
                  material="steel"
                  onTap={() => setInterCountyOpen(true)}
                />
                <MetalTag
                  label="Permits"
                  icon={<FileText className="w-3.5 h-3.5" />}
                  material="brass"
                  onTap={() => setCivicGuideOpen(true)}
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
                title="EPL Fantasy"
                subtitle="Free to play · Season 3 live"
                emoji="🔥"
                badge="FREE"
                height={130}
                animationDelayMs={0}
                onTap={() => {
                  if (onNavigateTab) onNavigateTab('arena');
                  else showToast('Opening EPL Fantasy');
                }}
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
                Courier & Errands
              </h2>
              <p className="text-sm text-white/85 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Currently in transit · {wairoLocation.name}</span>
              </p>
            </div>

            {/* Actions: Track, History, Book */}
            <div className="mt-6 grid grid-cols-3 gap-2">
              <MetalTag
                label="Track"
                icon={<Search className="w-3.5 h-3.5" />}
                material="copper"
                selected={true}
                onTap={() => {
                  setWairoSheetOpen(false);
                  setWairoMiniAppOpen(true);
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
              <MetalTag
                label="Book"
                icon={<Plus className="w-3.5 h-3.5" />}
                material="copper"
                onTap={() => {
                  setWairoSheetOpen(false);
                  setCreatePostOpen(true);
                }}
              />
            </div>
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
              onOpenTelemetry={() => {}}
              onOpenLocationModal={() => {}}
              onOpenDispatchModal={() => {}}
              onOpenSDKModal={() => {}}
              selectedLocation={wairoLocation}
              activeDelivery={wairoDelivery}
            />
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

      {/* ================= MODAL: CIVIC KNOWLEDGE GUIDE ================= */}
      {civicGuideOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-2xl my-auto">
            <CivicKnowledgeGuide onClose={() => setCivicGuideOpen(false)} />
          </div>
        </div>
      )}

      {/* ================= MODAL: BRIEF AI MAYOR ================= */}
      {briefAiOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-2xl my-auto">
            <BriefAiAssistant onClose={() => setBriefAiOpen(false)} />
          </div>
        </div>
      )}

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
