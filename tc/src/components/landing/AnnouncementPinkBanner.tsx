import React from 'react';
import { Sparkles, ArrowRight, CalendarDays, Users } from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface AnnouncementPinkBannerProps {
  tag?: string;
  title?: string;
  buttonText?: string;
  onAction?: () => void;
  className?: string;
}

export const AnnouncementPinkBanner: React.FC<AnnouncementPinkBannerProps> = ({
  tag = 'LIVE WARD RUNS',
  title = 'Save your spot at Ward Chama & CBC Bulk Runs',
  buttonText = 'Register now',
  onAction,
  className = ''
}) => {
  return (
    <div
      className={`relative w-full rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 transition-all duration-300 hover:shadow-md ${className}`}
      style={{
        backgroundColor: '#FCE3EA', // Signature Optimizely soft pastel pink
        color: '#1A1F2E'
      }}
    >
      <div className="flex items-center space-x-3 min-w-0">
        <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-[#1A1F2E] text-white flex items-center space-x-1 shadow-sm">
          <Sparkles className="w-3 h-3 text-[#93EE34]" />
          <span>{tag}</span>
        </span>
        <span className="text-xs sm:text-sm font-extrabold text-[#1A1F2E] tracking-tight truncate sm:whitespace-normal">
          {title}
        </span>
      </div>

      <button
        type="button"
        onClick={() => {
          soundEngine.play('heavyTap');
          onAction?.();
        }}
        className="shrink-0 w-full sm:w-auto px-5 py-2.5 rounded-full bg-[#0C221F] hover:bg-[#071614] active:scale-95 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-sm cursor-pointer"
      >
        <span>{buttonText}</span>
        <ArrowRight className="w-3.5 h-3.5 text-[#93EE34]" />
      </button>
    </div>
  );
};

export default AnnouncementPinkBanner;
