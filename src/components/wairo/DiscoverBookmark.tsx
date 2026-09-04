import React from 'react';
import { Sparkles } from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface DiscoverBookmarkProps {
  label?: string;
  onTap?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * DiscoverBookmark
 * Tactile, elegant cloth ribbon bookmark (hanging from the top page edge)
 * with signature jade-green fabric string, golden star seal, and sway animation.
 */
export const DiscoverBookmark: React.FC<DiscoverBookmarkProps> = ({
  label = 'Discover',
  onTap,
  className = '',
  style
}) => {
  const handleClick = () => {
    soundEngine.play('tap');
    soundEngine.triggerHaptic([20, 25, 40]);
    onTap?.();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`relative w-12 sm:w-14 h-20 select-none cursor-pointer group animate-[sway_4s_easeInOut_infinite] focus:outline-none ${className}`}
      style={{
        transformOrigin: 'top center',
        ...style
      }}
      title="Open 3D Discover Universe"
      aria-label="Discover 3D Bookmark Ribbon"
    >
      {/* ── The Jade Cloth String / Ribbon ── */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-1 sm:w-1.5 h-4 rounded-full transition-transform duration-300 group-hover:scale-y-110"
        style={{
          background: 'linear-gradient(to bottom, rgba(11, 110, 110, 0.4) 0%, rgba(11, 110, 110, 1) 100%)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
        }}
      />

      {/* ── The Emerald-Teal Wax & Star Seal ── */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 sm:w-11 h-10 sm:h-11 flex items-center justify-center">
        
        {/* Ambient Glow */}
        <div
          className="absolute inset-0 rounded-full animate-pulse pointer-events-none"
          style={{
            boxShadow: '0 0 14px 2px rgba(20, 145, 155, 0.35)',
            backgroundColor: 'rgba(20, 145, 155, 0.15)'
          }}
        />

        {/* 3D Wax Knob in Jade / Teal Material */}
        <div
          className="relative w-10 sm:w-11 h-10 sm:h-11 rounded-full flex items-center justify-center shadow-xl transition-transform duration-200 group-hover:scale-105 active:scale-95"
          style={{
            background: 'radial-gradient(circle at 35% 35%, #14919B 0%, #0B6E6E 60%, #044343 100%)',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.35), inset 0 2px 3px rgba(255, 255, 255, 0.35), inset 0 -2px 3px rgba(0, 0, 0, 0.4)'
          }}
        >
          {/* Embossed Golden Star / Sparkles Icon */}
          <Sparkles className="w-4 sm:w-5 h-4 sm:h-5 text-[#FBBF24] drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]" />

          {/* Tiny Ambient Star Sparkle in Top Corner */}
          <div
            className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-300 shadow-sm animate-ping"
            style={{ opacity: 0.8 }}
          />
          <div
            className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-300 shadow-sm"
          />
        </div>
      </div>

      {/* Screenreader Accessible Label */}
      <span className="sr-only">{label}</span>
    </button>
  );
};

export default DiscoverBookmark;
