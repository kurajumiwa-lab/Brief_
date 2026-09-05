import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface AgenticCalloutBannerProps {
  titleLine1?: string;
  titleLine2?: string;
  description?: string;
  buttonLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const AgenticCalloutBanner: React.FC<AgenticCalloutBannerProps> = ({
  titleLine1 = 'Yes, you can coordinate here.',
  titleLine2 = 'And the rest!',
  description = "If you thought Brief was just for estate alerts, think again. We're the community operating system that gives you all tools you need to create, save, and optimize every local connection.",
  buttonLabel = 'Take me to the platform',
  onAction,
  className = ''
}) => {
  return (
    <section
      className={`w-full rounded-[32px] p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-5 bg-[#F4F7F2] text-[#0C221F] ${className}`}
    >
      <div className="space-y-1 max-w-2xl">
        <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.08] text-[#0C221F]">
          {titleLine1}
          <span className="block text-[#0C221F]">{titleLine2}</span>
        </h2>
      </div>

      <p className="max-w-xl text-sm sm:text-base text-[#4B5563] leading-relaxed">
        {description}
      </p>

      <div className="pt-2">
        <button
          type="button"
          onClick={() => {
            soundEngine.play('heavyTap');
            onAction?.();
          }}
          className="px-7 py-3.5 rounded-full bg-[#0C221F] hover:bg-[#071614] active:scale-95 text-white font-black text-xs sm:text-sm transition-all shadow-md flex items-center space-x-2 cursor-pointer"
        >
          <span>{buttonLabel}</span>
          <ArrowRight className="w-4 h-4 text-[#93EE34]" />
        </button>
      </div>
    </section>
  );
};

export default AgenticCalloutBanner;
