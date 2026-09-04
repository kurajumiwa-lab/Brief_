import React from 'react';

export interface PulseGlowProps {
  children: React.ReactNode;
  glowColor?: string;
  className?: string;
  shape?: 'circle' | 'rounded' | 'pill';
  style?: React.CSSProperties;
}

/**
 * PulseGlow
 * Ambient pulsing glow wrapper for high-priority CTA buttons, indicators, and highlights.
 */
export const PulseGlow: React.FC<PulseGlowProps> = ({
  children,
  glowColor = '#0B6E6E',
  className = '',
  shape = 'circle',
  style
}) => {
  const borderRadiusStyle =
    shape === 'circle'
      ? 'rounded-full'
      : shape === 'pill'
      ? 'rounded-full'
      : 'rounded-2xl';

  return (
    <div
      className={`relative inline-flex items-center justify-center ${borderRadiusStyle} ${className}`}
      style={style}
    >
      <div
        className={`absolute inset-0 ${borderRadiusStyle} animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] pointer-events-none -z-10`}
        style={{
          boxShadow: `0 0 24px 4px ${glowColor}`,
          opacity: 0.4
        }}
      />
      {children}
    </div>
  );
};
