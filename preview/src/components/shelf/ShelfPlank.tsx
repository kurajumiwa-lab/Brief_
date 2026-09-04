import React from 'react';

export interface ShelfPlankProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 🛠️ Shelf Plank Specification:
 * - Height: 10px to 12px total thickness (default 11px)
 * - Top Lip / Border: Exactly 1px solid #3A3C44 (crisp highlight line simulating top-edge ambient light)
 * - Deck & Front Face Fill: Vertical gradient from #23252C (top deck surface) to #1A1B20 (bottom front lip)
 * - Shadow: Soft downward drop shadow `0 6px 12px rgba(0, 0, 0, 0.70)`
 * - Crisp borders: 1px–2px corner radius
 */
export const ShelfPlank: React.FC<ShelfPlankProps> = ({
  className = '',
  style
}) => {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={`w-full relative select-none pointer-events-none rounded-[1.5px] ${className}`}
      style={{
        height: '11px',
        borderTop: '1px solid #3A3C44',
        background: 'linear-gradient(180deg, #23252C 0%, #1A1B20 100%)',
        boxShadow: '0 6px 12px rgba(0, 0, 0, 0.70)',
        ...style
      }}
    />
  );
};
