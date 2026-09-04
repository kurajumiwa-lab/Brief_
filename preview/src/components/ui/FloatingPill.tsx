import React, { useState } from 'react';
import { AppPalette } from '../../styles/appPalette';
import { soundEngine } from '../../utils/SoundEngine';

export interface FloatingPillProps {
  icon: React.ReactNode;
  label: string;
  onTap: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * FloatingPill
 * Warm accent floating action pill replacing standard circular FABs.
 * Features a generous 56px touch target, smooth scale press, and rich shadow.
 */
export const FloatingPill: React.FC<FloatingPillProps> = ({
  icon,
  label,
  onTap,
  className = '',
  style
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = () => {
    soundEngine.play('heavyTap');
    soundEngine.triggerHaptic([25, 30, 45]);
    onTap();
  };

  return (
    <button
      type="button"
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      onClick={handleClick}
      className={`inline-flex items-center space-x-2.5 px-6 py-4 rounded-full text-white font-bold text-[15px] tracking-wide transition-all duration-150 cursor-pointer select-none ${
        isPressed ? 'scale-[0.92]' : 'hover:scale-[1.03]'
      } ${className}`}
      style={{
        backgroundColor: AppPalette.accent,
        boxShadow: `0 8px 24px rgba(232, 152, 94, 0.45), 0 2px 8px rgba(232, 152, 94, 0.25)`,
        ...style
      }}
    >
      <span className="w-6 h-6 flex items-center justify-center shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
};
