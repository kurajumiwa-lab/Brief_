import React from 'react';
import { Heart, ShieldCheck, Users, Sparkles, ArrowRight } from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface WelcomingMatProps {
  onOpenSolidarity?: () => void;
  onOpenWellbeing?: () => void;
  className?: string;
}

/**
 * WelcomingMat
 * A quiet, dignified, and socially respectful doorstep card for family solidarity,
 * private mutual aid, and confidential wellbeing circles.
 * Keeps sensitive life struggles away from noisy spotlights while making them
 * gently and warmly accessible.
 */
export const WelcomingMat: React.FC<WelcomingMatProps> = ({
  onOpenSolidarity,
  onOpenWellbeing,
  className = ''
}) => {
  return (
    <section aria-label="Community Welcoming Mat & Mutual Aid" className={`w-full my-6 ${className}`}>
      <div className="rounded-[24px] bg-gradient-to-br from-[#FAF8F5] via-[#F5F2EC] to-[#EFECE5] p-5 sm:p-6 shadow-sm">
        
        {/* Doorstep Header */}
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.05]">
          <div className="flex items-center space-x-2">
            <span className="text-base">🕊️</span>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-[#1A1F2E]">
                Welcoming Mat · Mutual Aid & Solidarity
              </h3>
              <p className="text-[11px] text-[#78716C] font-medium">
                Discreet family support, confidential circles & quiet community relief
              </p>
            </div>
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-stone-200/70 text-stone-700">
            Confidential
          </span>
        </div>

        {/* Quiet Doorstep Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          
          {/* Option 1: Family Solidarity & Harambee */}
          <button
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              onOpenSolidarity?.();
            }}
            className="p-4 rounded-2xl bg-white/90 hover:bg-white text-left transition-all duration-200 shadow-sm cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xl">🕊️</span>
                <span className="text-[9px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                  Family Circle
                </span>
              </div>
              <h4 className="text-xs font-black text-[#1A1F2E] mt-2 group-hover:text-[#B8621F] transition-colors">
                Family & Life Support Desk
              </h4>
              <p className="text-[11px] text-[#78716C] mt-0.5 leading-snug">
                Organize family tasks, private harambees, and respectful memorial arrangements with clan members.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-black/[0.03] flex items-center justify-between text-[11px] font-bold text-[#B8621F]">
              <span>Open Private Support Desk</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* Option 2: Confidential Wellbeing & Support Circles */}
          <button
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              onOpenWellbeing?.();
            }}
            className="p-4 rounded-2xl bg-white/90 hover:bg-white text-left transition-all duration-200 shadow-sm cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xl">💚</span>
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Safe & Anonymous
                </span>
              </div>
              <h4 className="text-xs font-black text-[#1A1F2E] mt-2 group-hover:text-emerald-700 transition-colors">
                Wellbeing & Listening Circles
              </h4>
              <p className="text-[11px] text-[#78716C] mt-0.5 leading-snug">
                Private peer listening spaces, certified counseling referrals, and safe mutual aid support.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-black/[0.03] flex items-center justify-between text-[11px] font-bold text-emerald-700">
              <span>Enter Confidential Space</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

        </div>

        {/* Welcoming reassurance footnote */}
        <p className="text-[10px] text-stone-400 mt-3 text-center font-medium">
          Always private to your invited circle. Never published to the public neighborhood feed.
        </p>

      </div>
    </section>
  );
};

export default WelcomingMat;
