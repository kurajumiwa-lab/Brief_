import React, { useState, useEffect } from 'react';
import { AppPalette, AppSpacing } from '../../styles/appPalette';
import { soundEngine } from '../../utils/SoundEngine';

export interface GlassCardProps {
  children: React.ReactNode;
  padding?: string;
  elevation?: number;
  animationDelayMs?: number;
  onTap?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * GlassCard
 * Soft cream card with zero harsh borders. Depth achieved via dual ambient
 * drop shadows and subtle background tint. Supports staggered slide-up entry.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  padding,
  elevation = 2,
  animationDelayMs = 0,
  onTap,
  className = '',
  style
}) => {
  const [isVisible, setIsVisible] = useState(animationDelayMs === 0);

  useEffect(() => {
    if (animationDelayMs > 0) {
      const timer = setTimeout(() => setIsVisible(true), animationDelayMs);
      return () => clearTimeout(timer);
    }
  }, [animationDelayMs]);

  const handleClick = () => {
    if (onTap) {
      soundEngine.play('tap');
      soundEngine.triggerHaptic(12);
      onTap();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`rounded-[20px] transition-all duration-500 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      } ${onTap ? 'cursor-pointer active:scale-[0.99] hover:shadow-xl' : ''} ${className}`}
      style={{
        backgroundColor: AppPalette.surface,
        padding: padding || `${AppSpacing.md}px`,
        boxShadow: `0 8px 20px rgba(26, 31, 46, ${0.03 * elevation}), 0 2px 6px rgba(26, 31, 46, ${0.015 * elevation})`,
        ...style
      }}
    >
      {children}
    </div>
  );
};
