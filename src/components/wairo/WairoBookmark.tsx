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
 * Tactile, physics-based wax-seal bookmark toggle for Wairo Courier & Errands.
 * Features a gentle pendulum sway, glowing status wax-seal, and location badge.
 */
export const WairoBookmark: React.FC<WairoBookmarkProps> = ({
  status = 'IN TRANSIT',
  location = "Lang'ata",
  onTap,
  className = '',
  style
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'IN TRANSIT':
        return '#2ECC71';
      case 'PENDING':
        return '#F39C12';
      default:
        return '#95A5A6';
    }
  };

  const statusColor = getStatusColor();

  const handleClick = () => {
    soundEngine.play('tap');
    soundEngine.triggerHaptic([25, 30, 45]);
    onTap?.();
  };

  return (
    <div
      onClick={handleClick}
      className={`relative w-14 h-22 select-none cursor-pointer group animate-[sway_3.5s_easeInOut_infinite] ${className}`}
      style={{
        transformOrigin: 'top center',
        ...style
      }}
      title={`Wairo Courier & Errands (${status} • ${location})`}
      aria-label="Wairo Courier Bookmark Seal"
    >
      {/* ── The Ribbon / String ── */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-4.5 rounded-full"
        style={{
          background: 'linear-gradient(to bottom, rgba(139, 69, 19, 0.3), rgba(139, 69, 19, 1))'
        }}
      />

      {/* ── The Wax Seal ── */}
      <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-13 h-13 flex items-center justify-center">
        
        {/* Pulsing Ambient Glow */}
        <div
          className="absolute inset-0 rounded-full animate-[sealPulse_1.8s_easeInOut_infinite] pointer-events-none"
          style={{
            boxShadow: `0 0 18px 4px ${statusColor}`,
            backgroundColor: `${statusColor}22`
          }}
        />

        {/* 3D Wax Knob */}
        <div
          className="relative w-13 h-13 rounded-full flex items-center justify-center shadow-2xl transition-transform duration-200 group-hover:scale-105 active:scale-95"
          style={{
            background: 'radial-gradient(circle at 35% 35%, #E8985E 0%, #B8621F 60%, #8B4513 100%)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.45), inset 0 2px 3px rgba(255, 255, 255, 0.3), inset 0 -2px 4px rgba(0, 0, 0, 0.4)'
          }}
        >
          {/* Embossed Bicycle Icon */}
          <Bike className="w-5.5 h-5.5 text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />

          {/* Status LED Dot */}
          <div
            className="absolute bottom-1 right-1 w-3 h-3 rounded-full border border-white/40 shadow-sm"
            style={{
              backgroundColor: statusColor,
              boxShadow: `0 0 6px ${statusColor}`
            }}
          />
        </div>
      </div>

      {/* ── Tiny Location Tag Below Seal ── */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[8px] font-bold font-mono tracking-wider text-white whitespace-nowrap shadow-md"
        style={{
          backgroundColor: 'rgba(26, 31, 46, 0.88)'
        }}
      >
        {location}
      </div>
    </div>
  );
};
