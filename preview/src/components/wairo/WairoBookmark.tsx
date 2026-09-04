import React from 'react';
import { Bike } from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface WairoBookmarkProps {
  status?: 'IN TRANSIT' | 'IDLE' | 'PENDING' | string;
  location?: string;
  onTap?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * WairoBookmark
 * Tactile, small bookmark-style knob (max 56x88) with copper wax seal,
 * bike icon, pulsing status dot, and top ribbon.
 */
export const WairoBookmark: React.FC<WairoBookmarkProps> = ({
  status = 'IN TRANSIT',
  location = "Lang'ata",
  onTap,
  className = '',
  style
}) => {
  const isTransit = status === 'IN TRANSIT' || status === 'active';
  const statusColor = isTransit ? '#10B981' : '#9CA3AF'; // Green = active, Gray = idle

  const handleClick = () => {
    soundEngine.play('tap');
    soundEngine.triggerHaptic([25, 30, 45]);
    onTap?.();
  };

  return (
    <div
      onClick={handleClick}
      className={`relative w-14 h-20 select-none cursor-pointer group animate-[sway_3.5s_easeInOut_infinite] ${className}`}
      style={{
        transformOrigin: 'top center',
        ...style
      }}
      title={`WAIRO · Courier & Errands (${status} • ${location})`}
      aria-label="Wairo Courier Bookmark Seal"
    >
      {/* ── The Ribbon / String ── */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-3.5 rounded-full"
        style={{
          background: 'linear-gradient(to bottom, rgba(184, 98, 31, 0.4), rgba(184, 98, 31, 1))'
        }}
      />

      {/* ── The Copper Wax Seal Badge ── */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-11 h-11 flex items-center justify-center">
        
        {/* Pulsing Ambient Glow */}
        <div
          className="absolute inset-0 rounded-full animate-pulse pointer-events-none"
          style={{
            boxShadow: `0 0 12px 2px ${statusColor}44`,
            backgroundColor: `${statusColor}18`
          }}
        />

        {/* 3D Wax Knob in Copper Material */}
        <div
          className="relative w-11 h-11 rounded-full flex items-center justify-center shadow-xl transition-transform duration-200 group-hover:scale-105 active:scale-95"
          style={{
            background: 'radial-gradient(circle at 35% 35%, #E8985E 0%, #B8621F 60%, #8B4513 100%)',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.35), inset 0 2px 3px rgba(255, 255, 255, 0.35), inset 0 -2px 3px rgba(0, 0, 0, 0.4)'
          }}
        >
          {/* Embossed Bicycle Icon */}
          <Bike className="w-5 h-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />

          {/* Tiny Status LED Dot in Corner */}
          <div
            className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full shadow-sm animate-ping"
            style={{
              backgroundColor: statusColor,
              opacity: isTransit ? 0.75 : 0
            }}
          />
          <div
            className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full shadow-sm"
            style={{
              backgroundColor: statusColor,
              boxShadow: `0 0 5px ${statusColor}`
            }}
          />
        </div>
      </div>

      {/* Hidden/accessible location string for tests & screenreaders */}
      <span className="sr-only text-[0px] opacity-0">{location}</span>
    </div>
  );
};
