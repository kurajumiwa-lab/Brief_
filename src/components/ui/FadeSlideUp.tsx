import React, { useState, useEffect } from 'react';

export interface FadeSlideUpProps {
  children: React.ReactNode;
  delayMs?: number;
  durationMs?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * FadeSlideUp
 * Micro-animation wrapper that fades in and slides up on mount.
 * Uses easeOutCubic curve equivalent for physics-based entrance.
 */
export const FadeSlideUp: React.FC<FadeSlideUpProps> = ({
  children,
  delayMs = 0,
  durationMs = 500,
  className = '',
  style
}) => {
  const [mounted, setMounted] = useState(delayMs === 0);

  useEffect(() => {
    if (delayMs > 0) {
      const timer = setTimeout(() => setMounted(true), delayMs);
      return () => clearTimeout(timer);
    }
  }, [delayMs]);

  return (
    <div
      className={`transition-all ${
        mounted
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-3 pointer-events-none'
      } ${className}`}
      style={{
        transitionDuration: `${durationMs}ms`,
        transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)', // easeOutCubic
        ...style
      }}
    >
      {children}
    </div>
  );
};
