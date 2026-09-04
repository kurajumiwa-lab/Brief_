import React, { useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Share2,
  MessageSquare,
  BookOpen,
  TrendingUp,
  ShieldCheck,
  Zap,
  CalendarDays,
  CheckCircle2,
  X,
  MapPin,
  Users,
  ChevronRight,
  Clock
} from 'lucide-react';
import {
  SheetMaterial,
  SHEET_MATERIALS,
  IronSheet,
  MetalTag
} from '../components/ui';
import { soundEngine } from '../utils/SoundEngine';

export interface SheetDetailScreenProps {
  material: SheetMaterial;
  title: string;
  subtitle: string;
  emoji?: string;
  badge?: string;
  heroDescription?: string;
  onClose?: () => void;
  onJoinSuccess?: () => void;
}

export const SheetDetailScreen: React.FC<SheetDetailScreenProps> = ({
  material = 'jade',
  title = 'Paid Gigs & Opportunities',
  subtitle = 'Waiter · Delivery · Cashier positions in Lang\'ata',
  emoji = '✨',
  badge = 'GIGS',
  heroDescription = 'Join a verified community hub that connects local skills with real opportunities. Learn from vetted instructors, earn a certificate, and get matched to gigs that disburse within 48 hours via M-Pesa.',
  onClose,
  onJoinSuccess
}) => {
  const [selectedSubtab, setSelectedSubtab] = useState<0 | 1 | 2>(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const palette = SHEET_MATERIALS[material] || SHEET_MATERIALS.jade;
  const subtabs = ['Overview', 'Related', 'Activity'];

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleShare = () => {
    soundEngine.play('tap');
    if (navigator.share) {
      navigator.share({
        title,
        text: `${title} on Brief Kenya: ${subtitle}`,
        url: window.location.href
      }).catch(() => {});
    } else {
      showToast('Link copied to clipboard!');
    }
  };

  const handleConfirmJoin = () => {
    soundEngine.play('victory');
    setIsJoinModalOpen(false);
    showToast(`✓ Confirmed joining "${title}"!`);
    onJoinSuccess?.();
  };

  return (
    <div
      onScroll={(e) => setScrollOffset((e.target as HTMLDivElement).scrollTop)}
      className="relative min-h-screen w-full overflow-y-auto overflow-x-hidden font-sans text-white select-none"
      style={{
        background: `linear-gradient(135deg, ${palette.highlight} 0%, ${palette.base} 40%, ${palette.shadow} 100%)`
      }}
    >
      {/* ── Diagonal Brushed Metal Texture Overlay ── */}
      <div
        className="fixed inset-0 pointer-events-none opacity-15"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            rgba(255, 255, 255, 0.15),
            rgba(255, 255, 255, 0.15) 1px,
            transparent 1px,
            transparent 4px
          )`
        }}
      />

      {/* ── Glowing Radial Orbs for 3D Depth ── */}
      <div
        className="fixed -top-24 -right-24 w-80 h-80 rounded-full pointer-events-none -z-10"
        style={{
          background: `radial-gradient(circle, ${palette.highlight}66 0%, transparent 70%)`
        }}
      />

      {/* ── Viewport Container ── */}
      <div className="max-w-xl mx-auto min-h-screen relative pb-32">
        
        {/* ================= TOP BAR ================= */}
        <header className="sticky top-0 z-40 px-4 py-3 bg-black/20 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                soundEngine.play('tap');
                onClose?.();
              }}
              className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white cursor-pointer transition-transform active:scale-90"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Parallax Fade Title */}
            <h2
              className={`font-black text-sm text-white truncate transition-opacity duration-200 ${
                scrollOffset > 100 ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {title}
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                soundEngine.play('tap');
                setIsBookmarked(!isBookmarked);
                showToast(isBookmarked ? 'Removed from saved shelf' : 'Saved to My Shelf');
              }}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isBookmarked ? 'bg-white text-[#1A1F2E]' : 'bg-white/15 text-white hover:bg-white/25'
              }`}
              aria-label="Bookmark"
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white cursor-pointer transition-all"
              aria-label="Share"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ================= HERO ZONE ================= */}
        <section className="px-6 pt-5 pb-6 space-y-4">
          {badge && (
            <div
              className="inline-block px-3.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase shadow-sm"
              style={{
                backgroundColor: palette.badgeBackground,
                color: palette.badgeText
              }}
            >
              {badge}
            </div>
          )}

          {emoji && (
            <div className="text-6xl sm:text-7xl leading-none select-none drop-shadow-md">
              {emoji}
            </div>
          )}

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black leading-tight tracking-tight drop-shadow-sm">
              {title}
            </h1>
            <p
              className="text-sm sm:text-base font-medium leading-relaxed"
              style={{ color: palette.textSecondary }}
            >
              {subtitle}
            </p>
          </div>

          {/* Meta Stats Row (Border-Free Floating Metric Chips) */}
          <div className="pt-2 flex items-center space-x-6">
            <div>
              <span className="block text-2xl font-black leading-none">{24}</span>
              <span
                className="text-[10px] font-bold tracking-wider uppercase"
                style={{ color: palette.textSecondary }}
              >
                ACTIVE
              </span>
            </div>
            <div>
              <span className="block text-2xl font-black leading-none">1.2k</span>
              <span
                className="text-[10px] font-bold tracking-wider uppercase"
                style={{ color: palette.textSecondary }}
              >
                JOINED
              </span>
            </div>
            <div>
              <span className="block text-2xl font-black leading-none">4.8</span>
              <span
                className="text-[10px] font-bold tracking-wider uppercase"
                style={{ color: palette.textSecondary }}
              >
                RATING
              </span>
            </div>
          </div>
        </section>

        {/* ================= SUB-TAB STRIP ================= */}
        <div className="px-6 py-2">
          <div
            className="p-1 rounded-full flex items-center"
            style={{ backgroundColor: `${palette.shadow}66` }}
          >
            {subtabs.map((tab, idx) => {
              const isSelected = selectedSubtab === idx;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    soundEngine.play('tap');
                    setSelectedSubtab(idx as 0 | 1 | 2);
                  }}
                  className={`flex-1 py-2.5 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer text-center ${
                    isSelected
                      ? 'shadow-md font-black text-white'
                      : 'hover:opacity-80'
                  }`}
                  style={{
                    backgroundColor: isSelected ? palette.highlight : 'transparent',
                    color: isSelected ? palette.textPrimary : palette.textSecondary
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* ================= CONTENT VIEWS ================= */}
        <main className="px-4 py-2 space-y-4">
          
          {/* ──── TAB 0: OVERVIEW ──── */}
          {selectedSubtab === 0 && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* About Card */}
              <div className="bg-[#FAFAF8] text-[#1A1F2E] p-5 rounded-[20px] shadow-xl space-y-2">
                <div className="flex items-center space-x-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: palette.base }}
                  />
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#1A1F2E]">
                    About
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#4A5568] leading-relaxed">
                  {heroDescription}
                </p>
              </div>

              {/* Subcategories MetalTag Band */}
              <div className="bg-[#FAFAF8] text-[#1A1F2E] p-5 rounded-[20px] shadow-xl space-y-3">
                <div className="flex items-center space-x-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: palette.base }}
                  />
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#1A1F2E]">
                    Explore Sub-Categories
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <MetalTag
                    label="Beginner"
                    icon={<BookOpen className="w-3.5 h-3.5" />}
                    material={material}
                    selected={true}
                  />
                  <MetalTag
                    label="Advanced"
                    icon={<TrendingUp className="w-3.5 h-3.5" />}
                    material={material}
                  />
                  <MetalTag
                    label="Certified"
                    icon={<ShieldCheck className="w-3.5 h-3.5" />}
                    material={material}
                  />
                  <MetalTag
                    label="Fast-track"
                    icon={<Zap className="w-3.5 h-3.5" />}
                    material={material}
                  />
                  <MetalTag
                    label="Weekend Cohort"
                    icon={<CalendarDays className="w-3.5 h-3.5" />}
                    material={material}
                  />
                </div>
              </div>

              {/* Featured in this Category IronSheet Grid */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center space-x-2 px-2">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-white">
                    Featured in This Category
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <IronSheet
                    material={material}
                    title="Barista Basics"
                    subtitle="Sat 9AM · 4 seats left"
                    bigNumber="4"
                    badge="GIG-READY"
                    animationDelayMs={0}
                    onTap={() => showToast('Selected Barista Basics module')}
                  />
                  <IronSheet
                    material={material}
                    title="Cashier Track"
                    subtitle="Online · Self-paced"
                    emoji="💰"
                    badge="FLEX"
                    animationDelayMs={100}
                    onTap={() => showToast('Selected Cashier Track module')}
                  />
                  <IronSheet
                    material={material}
                    title="Waiter Excellence"
                    subtitle="Mon 6PM · Live"
                    emoji="🍽️"
                    badge="LIVE"
                    animationDelayMs={200}
                    onTap={() => showToast('Selected Waiter Excellence module')}
                  />
                  <IronSheet
                    material={material}
                    title="Delivery Pro"
                    subtitle="Bike & scooter routes"
                    emoji="🛵"
                    badge="PAID"
                    animationDelayMs={300}
                    onTap={() => showToast('Selected Delivery Pro module')}
                  />
                </div>
              </div>

            </div>
          )}

          {/* ──── TAB 1: RELATED ──── */}
          {selectedSubtab === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-[#FAFAF8] text-[#1A1F2E] p-5 rounded-[20px] shadow-xl space-y-3">
                <div className="flex items-center space-x-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: palette.base }}
                  />
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#1A1F2E]">
                    People Also Follow
                  </span>
                </div>

                <div className="divide-y divide-gray-100">
                  {[
                    { emoji: '🎯', title: 'Skills Marketplace', meta: '2.4k active members' },
                    { emoji: '🎓', title: 'Certificate Track', meta: '890 certified alumni' },
                    { emoji: '🤝', title: 'Employer Direct', meta: '312 hires this month' }
                  ].map((row, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        soundEngine.play('tap');
                        showToast(`Opening ${row.title}`);
                      }}
                      className="py-3 flex items-center justify-between cursor-pointer hover:bg-black/5 rounded-xl px-2 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                          style={{ backgroundColor: `${palette.base}22` }}
                        >
                          {row.emoji}
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-[#1A1F2E]">{row.title}</h4>
                          <span className="text-[11px] text-[#6B7280]">{row.meta}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ──── TAB 2: ACTIVITY ──── */}
          {selectedSubtab === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-[#FAFAF8] text-[#1A1F2E] p-5 rounded-[20px] shadow-xl space-y-3">
                <div className="flex items-center space-x-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: palette.base }}
                  />
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#1A1F2E]">
                    Recent Activity
                  </span>
                </div>

                <div className="space-y-3 pt-1">
                  {[
                    { time: '2m ago', text: 'Jane completed Barista Basics module' },
                    { time: '18m ago', text: 'New gig posted in Lang\'ata district' },
                    { time: '1h ago', text: 'Weekend cohort filled up (30 seats)' },
                    { time: '3h ago', text: 'Certificates awarded to 12 members' }
                  ].map((act, i) => (
                    <div key={i} className="flex items-start space-x-3 text-xs">
                      <span className="w-2 h-2 rounded-full bg-[#E8985E] mt-1 shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-[#1A1F2E]">{act.text}</p>
                        <span className="text-[10px] text-[#9CA3AF] font-mono">{act.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </main>

        {/* ================= STICKY ACTION BAR ================= */}
        <div
          className="fixed bottom-0 left-0 right-0 z-40 p-4 backdrop-blur-md"
          style={{
            background: `linear-gradient(to bottom, transparent 0%, ${palette.shadow}D9 40%, ${palette.shadow} 100%)`
          }}
        >
          <div className="max-w-xl mx-auto flex items-center space-x-3">
            <button
              type="button"
              onClick={() => {
                soundEngine.play('tap');
                showToast('Opening community chat');
              }}
              className="w-13 h-13 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white cursor-pointer transition-transform active:scale-90 shrink-0"
              aria-label="Community Chat"
            >
              <MessageSquare className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.play('heavyTap');
                setIsJoinModalOpen(true);
              }}
              className="flex-1 py-4 rounded-full bg-white text-[#1A1F2E] font-black text-sm tracking-wide shadow-2xl hover:bg-white/95 transition-transform active:scale-98 cursor-pointer text-center"
              style={{ color: palette.base }}
            >
              Join Now
            </button>
          </div>
        </div>

      </div>

      {/* ================= JOIN CONFIRMATION MODAL ================= */}
      {isJoinModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex flex-col justify-end p-3 animate-fadeIn"
          onClick={() => setIsJoinModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg mx-auto rounded-[28px] p-6 text-white shadow-2xl animate-slideUp space-y-4"
            style={{
              background: `linear-gradient(135deg, ${palette.highlight} 0%, ${palette.base} 50%, ${palette.shadow} 100%)`,
              boxShadow: '0 20px 48px rgba(0, 0, 0, 0.45)'
            }}
          >
            <div className="w-10 h-1 rounded-full bg-white/30 mx-auto" />

            <div className="space-y-1">
              <span
                className="text-[10px] font-black uppercase tracking-wider"
                style={{ color: palette.textSecondary }}
              >
                YOU'RE JOINING
              </span>
              <h3 className="text-2xl font-black text-white leading-tight">
                {title}
              </h3>
            </div>

            <div className="space-y-2 py-2 text-xs font-medium text-white/90">
              <div className="flex items-center space-x-2.5">
                <CalendarDays className="w-4 h-4" style={{ color: palette.textSecondary }} />
                <span>{subtitle}</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <MapPin className="w-4 h-4" style={{ color: palette.textSecondary }} />
                <span>Nairobi · Free entry & verified stipend</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <Users className="w-4 h-4" style={{ color: palette.textSecondary }} />
                <span>24 other members confirmed</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-3">
              <button
                type="button"
                onClick={() => setIsJoinModalOpen(false)}
                className="flex-1 py-3.5 rounded-full bg-black/30 hover:bg-black/40 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Not now
              </button>

              <button
                type="button"
                onClick={handleConfirmJoin}
                className="flex-[2] py-3.5 rounded-full bg-white text-[#1A1F2E] font-black text-xs shadow-lg hover:bg-white/95 transition-transform active:scale-95 cursor-pointer"
                style={{ color: palette.base }}
              >
                Confirm ✓
              </button>
            </div>
          </div>
        </div>
      )}

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
