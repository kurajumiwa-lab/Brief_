import React from 'react';
import { AppPalette } from '../../styles/appPalette';

export interface ShimmerCardProps {
  height?: string | number;
  width?: string | number;
  radius?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * ShimmerCard
 * Fluid shimmer placeholder replacing standard loading spinners.
 */
export const ShimmerCard: React.FC<ShimmerCardProps> = ({
  height = 120,
  width = '100%',
  radius = 16,
  className = '',
  style
}) => {
  const formattedHeight = typeof height === 'number' ? `${height}px` : height;
  const formattedWidth = typeof width === 'number' ? `${width}px` : width;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        height: formattedHeight,
        width: formattedWidth,
        borderRadius: `${radius}px`,
        backgroundColor: 'rgba(232, 228, 221, 0.45)',
        ...style
      }}
    >
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite]"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(232, 228, 221, 0) 0%, rgba(250, 250, 248, 0.7) 50%, rgba(232, 228, 221, 0) 100%)`
        }}
      />
    </div>
  );
};
