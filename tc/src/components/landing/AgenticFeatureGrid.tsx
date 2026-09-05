import React from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  BookOpen, 
  Coins, 
  Truck, 
  CheckCircle2, 
  ShieldCheck,
  TrendingUp,
  Clock,
  Layers
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface AgenticFeatureCardProps {
  id: string;
  sublabel: string;
  title: string;
  description: string;
  buttonLabel: string;
  onAction?: () => void;
  renderPreview: () => React.ReactNode;
}

export interface AgenticFeatureGridProps {
  onOpenCbc?: () => void;
  onOpenChama?: () => void;
  onOpenCargo?: () => void;
  className?: string;
}

export const AgenticFeatureGrid: React.FC<AgenticFeatureGridProps> = ({
  onOpenCbc,
  onOpenChama,
  onOpenCargo,
  className = ''
}) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-5 ${className}`}>
      {/* ── CARD 1: CBC & BULK RUNS ── */}
      <div 
        className="rounded-[28px] sm:rounded-[32px] p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-lg bg-[#F4F7F2] text-[#1A1F2E]"
      >
        <div className="space-y-4">
          {/* Top Interactive Mock Window */}
          <div className="w-full aspect-[16/10] rounded-2xl bg-gradient-to-br from-[#1E3A5F] to-[#0F172A] p-3 sm:p-4 text-white shadow-inner flex flex-col justify-between overflow-hidden relative group">
            <div className="flex items-center justify-between z-10">
              <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>KICD APPROVED</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-gray-200">
                FARGO KES 50
              </span>
            </div>

            <div className="space-y-1 z-10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white">CBC Grade 7 Bundle</span>
                <span className="text-xs font-mono font-black text-[#93EE34]">KES 5,180</span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#93EE34] h-full w-[84%]" />
              </div>
              <div className="flex items-center justify-between text-[9px] text-gray-300 font-mono">
                <span>42/50 Parents Pledged</span>
                <span className="text-[#93EE34] font-bold">-28% WHOLESALE</span>
              </div>
            </div>

            {/* Subtle glow background */}
            <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-[#93EE34]/20 blur-xl pointer-events-none" />
          </div>

          <div className="space-y-1.5 pt-1">
            <span className="text-xs font-bold text-[#6B7280] tracking-wide block">
              Let your schools coordinate
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-[#0C221F] tracking-tight leading-tight">
              Agentic CBC Books
            </h3>
            <p className="text-xs sm:text-sm text-[#4B5563] leading-relaxed">
              Publish bulk orders faster and keep every classroom equipped with direct school-gate delivery automatically.
            </p>
          </div>
        </div>

        <div className="pt-6">
          <button
            type="button"
            onClick={() => {
              soundEngine.play('heavyTap');
              onOpenCbc?.();
            }}
            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#0C221F] hover:bg-[#071614] active:scale-95 text-white font-extrabold text-xs transition-all shadow-sm cursor-pointer text-center"
          >
            Let's build
          </button>
        </div>
      </div>

      {/* ── CARD 2: CHAMA TABLE BANKING ── */}
      <div 
        className="rounded-[28px] sm:rounded-[32px] p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-lg bg-[#F4F7F2] text-[#1A1F2E]"
      >
        <div className="space-y-4">
          {/* Top Interactive Mock Window */}
          <div className="w-full aspect-[16/10] rounded-2xl bg-gradient-to-br from-[#0C221F] to-[#173830] p-3 sm:p-4 text-white shadow-inner flex flex-col justify-between overflow-hidden relative">
            <div className="flex items-center justify-between z-10">
              <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-[#93EE34]/20 text-[#93EE34] text-[9px] font-mono font-bold">
                <Coins className="w-3 h-3 text-[#93EE34]" />
                <span>PEZESHA 740</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                100% REPAYMENT
              </span>
            </div>

            <div className="space-y-1 z-10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white">Rotational Table Bank</span>
                <span className="text-xs font-mono font-black text-[#93EE34]">KES 60,000</span>
              </div>
              <div className="p-2 rounded-xl bg-white/10 flex items-center justify-between text-[10px]">
                <span className="text-gray-200">Cycle 5 Payout:</span>
                <span className="font-bold text-white">Wanjiku M. (Tomorrow)</span>
              </div>
            </div>

            <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-[#93EE34]/15 blur-xl pointer-events-none" />
          </div>

          <div className="space-y-1.5 pt-1">
            <span className="text-xs font-bold text-[#6B7280] tracking-wide block">
              Turn collective trust into capital
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-[#0C221F] tracking-tight leading-tight">
              Chama Table Banking
            </h3>
            <p className="text-xs sm:text-sm text-[#4B5563] leading-relaxed">
              Continuously pool savings, issue micro-loans, and optimize rotational payouts with instant M-Pesa ledgers.
            </p>
          </div>
        </div>

        <div className="pt-6">
          <button
            type="button"
            onClick={() => {
              soundEngine.play('heavyTap');
              onOpenChama?.();
            }}
            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#0C221F] hover:bg-[#071614] active:scale-95 text-white font-extrabold text-xs transition-all shadow-sm cursor-pointer text-center"
          >
            Let's test
          </button>
        </div>
      </div>

      {/* ── CARD 3: WAIRO 47-COUNTY FREIGHT ── */}
      <div 
        className="rounded-[28px] sm:rounded-[32px] p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-lg bg-[#F4F7F2] text-[#1A1F2E]"
      >
        <div className="space-y-4">
          {/* Top Interactive Mock Window */}
          <div className="w-full aspect-[16/10] rounded-2xl bg-gradient-to-br from-[#1E1B4B] to-[#312E81] p-3 sm:p-4 text-white shadow-inner flex flex-col justify-between overflow-hidden relative">
            <div className="flex items-center justify-between z-10">
              <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-[#93EE34]/20 text-[#93EE34] text-[9px] font-mono font-bold">
                <Truck className="w-3 h-3 text-[#93EE34]" />
                <span>LORI BACKHAUL</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-gray-200">
                47 COUNTIES
              </span>
            </div>

            <div className="space-y-1 z-10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white">Nairobi ➔ Kisumu Cargo</span>
                <span className="text-xs font-mono font-black text-[#93EE34]">-50% RATE</span>
              </div>
              <div className="p-2 rounded-xl bg-white/10 flex items-center justify-between text-[10px]">
                <span className="text-gray-200">Return deadhead eliminated</span>
                <span className="font-bold text-emerald-400">Escrow Locked</span>
              </div>
            </div>

            <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-[#93EE34]/20 blur-xl pointer-events-none" />
          </div>

          <div className="space-y-1.5 pt-1">
            <span className="text-xs font-bold text-[#6B7280] tracking-wide block">
              Put freight networks to work
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-[#0C221F] tracking-tight leading-tight">
              WAIRO Cargo Freight
            </h3>
            <p className="text-xs sm:text-sm text-[#4B5563] leading-relaxed">
              Automate cross-county deliveries, eliminate empty return trips, and scale cargo freight without friction.
            </p>
          </div>
        </div>

        <div className="pt-6">
          <button
            type="button"
            onClick={() => {
              soundEngine.play('heavyTap');
              onOpenCargo?.();
            }}
            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#0C221F] hover:bg-[#071614] active:scale-95 text-white font-extrabold text-xs transition-all shadow-sm cursor-pointer text-center"
          >
            Let's automate
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgenticFeatureGrid;
