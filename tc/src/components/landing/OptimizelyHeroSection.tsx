import React from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Compass, 
  MapPin, 
  Truck, 
  Coins, 
  BookOpen, 
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface OptimizelyHeroSectionProps {
  locationName?: string;
  onExploreWard?: () => void;
  onOpenCargo?: () => void;
  onOpenChama?: () => void;
  onOpenCbc?: () => void;
  className?: string;
}

export const OptimizelyHeroSection: React.FC<OptimizelyHeroSectionProps> = ({
  locationName = "Lang'ata",
  onExploreWard,
  onOpenCargo,
  onOpenChama,
  onOpenCbc,
  className = ''
}) => {
  return (
    <section
      className={`relative w-full rounded-[32px] sm:rounded-[36px] overflow-hidden p-6 sm:p-10 lg:p-12 text-white shadow-2xl ${className}`}
      style={{
        background: 'linear-gradient(175deg, #1A3E34 0%, #0C221F 55%, #081714 100%)'
      }}
    >
      {/* ── AMBIENT ATMOSPHERIC BACKDROP GLOW ── */}
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#93EE34]/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-72 h-72 rounded-full bg-[#14919B]/20 blur-3xl pointer-events-none" />

      {/* ── TOP PILL BADGE ── */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-bold text-white shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#93EE34] animate-pulse" />
          <span>Brief Hyper-Local OS · {locationName} Ward</span>
        </div>

        <span className="hidden sm:inline-block text-[11px] font-mono text-[#93EE34] font-bold">
          47 COUNTIES READY
        </span>
      </div>

      {/* ── 3D STACKED SIGNATURE HEADLINE ── */}
      <div className="relative z-10 my-8 sm:my-10 space-y-2">
        <h1
          className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.02] uppercase"
          style={{
            color: '#93EE34',
            textShadow: '0 2px 0 #6DB822, 0 4px 0 #4C8215, 0 6px 0 #2E520B, 0 8px 16px rgba(0,0,0,0.6)'
          }}
        >
          You're free
          <span className="block text-white mt-1">to grow.</span>
        </h1>
      </div>

      {/* ── FLOATING VALUE CARD & ACTION PILLS ── */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
        {/* Left Sub-Card */}
        <div className="lg:col-span-7 space-y-4">
          <p className="text-sm sm:text-base text-gray-200 leading-relaxed font-medium max-w-lg">
            Brief gives you automated tools, verified 47-county freight, and Chama table banking right where your community lives. Zero agency friction.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                soundEngine.play('heavyTap');
                onExploreWard?.();
              }}
              className="px-6 py-3 rounded-full bg-[#93EE34] hover:bg-[#83D62D] active:scale-95 text-[#0C221F] font-black text-xs sm:text-sm shadow-lg flex items-center space-x-2 transition-all cursor-pointer"
            >
              <span>Let's grow</span>
              <ArrowRight className="w-4 h-4 text-[#0C221F]" />
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.play('tap');
                onOpenCargo?.();
              }}
              className="px-5 py-3 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs sm:text-sm backdrop-blur-md transition-all flex items-center space-x-2 cursor-pointer"
            >
              <Truck className="w-4 h-4 text-[#93EE34]" />
              <span>WAIRO Cargo Freight</span>
            </button>
          </div>
        </div>

        {/* Right Live Status Strip */}
        <div className="lg:col-span-5 flex flex-col gap-2">
          <div 
            onClick={() => {
              soundEngine.play('tap');
              onOpenChama?.();
            }}
            className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/10 transition-all cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#93EE34]/20 flex items-center justify-center text-[#93EE34]">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-white">Chama Table Bank</h4>
                <p className="text-[10px] text-gray-300">Pezesha score 740 · Cycle 5 Live</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>

          <div 
            onClick={() => {
              soundEngine.play('tap');
              onOpenCbc?.();
            }}
            className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/10 transition-all cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-400/20 flex items-center justify-center text-sky-300">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-white">CBC PTA Bulk Runs</h4>
                <p className="text-[10px] text-gray-300">KICD Grade 7 · -28% Wholesale</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default OptimizelyHeroSection;
