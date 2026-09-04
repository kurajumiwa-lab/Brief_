import React, { useState, useEffect } from 'react';
import { soundEngine } from '../../utils/SoundEngine';

export type SheetMaterial = 'copper' | 'steel' | 'brass' | 'zinc' | 'obsidian' | 'jade';

export interface SheetPaletteConfig {
  base: string;
  highlight: string;
  shadow: string;
  textPrimary: string;
  textSecondary: string;
  badgeBackground: string;
  badgeText: string;
}

export const SHEET_MATERIALS: Record<SheetMaterial, SheetPaletteConfig> = {
  // COPPER — warm, welcoming (Community, Life-Events)
  copper: {
    base: '#B8621F',
    highlight: '#D4823A',
    shadow: '#7A3E0F',
    textPrimary: '#FFFFFF',
    textSecondary: '#FFE4CC',
    badgeBackground: '#7A3E0F',
    badgeText: '#FFE4CC',
  },
  // STEEL — professional (Cargo, Business)
  steel: {
    base: '#2D3548',
    highlight: '#4A5568',
    shadow: '#1A1F2E',
    textPrimary: '#FFFFFF',
    textSecondary: '#B8C0D0',
    badgeBackground: '#4A9EFF',
    badgeText: '#FFFFFF',
  },
  // BRASS — premium (Verified, Civic)
  brass: {
    base: '#8B7355',
    highlight: '#B89968',
    shadow: '#5C4A38',
    textPrimary: '#FFFFFF',
    textSecondary: '#F0E4D0',
    badgeBackground: '#5C4A38',
    badgeText: '#F0E4D0',
  },
  // ZINC — cool, calm (Wellbeing)
  zinc: {
    base: '#1E4D3F',
    highlight: '#2E6B58',
    shadow: '#0F2E24',
    textPrimary: '#FFFFFF',
    textSecondary: '#B8D4C8',
    badgeBackground: '#52C795',
    badgeText: '#0F2E24',
  },
  // OBSIDIAN — mystery, exclusive (Chama, Silent)
  obsidian: {
    base: '#1A0F2E',
    highlight: '#2E1A4A',
    shadow: '#0A0518',
    textPrimary: '#FFFFFF',
    textSecondary: '#C8B8E0',
    badgeBackground: '#9B59B6',
    badgeText: '#FFFFFF',
  },
  // JADE — growth, learning (Free, Skills)
  jade: {
    base: '#0B6E6E',
    highlight: '#14919B',
    shadow: '#064545',
    textPrimary: '#FFFFFF',
    textSecondary: '#B8E0E0',
    badgeBackground: '#14919B',
    badgeText: '#FFFFFF',
  },
};

export interface IronSheetProps {
  material: SheetMaterial;
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  emoji?: string;
  badge?: string;
  bigNumber?: string;
  height?: number | string;
  animationDelayMs?: number;
  onTap?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * IronSheet
 * Tactile brushed-metal card component.
 * Features realistic metallic gradients, subtle diagonal brushed streaks,
 * and high-contrast typography.
 */
export const IronSheet: React.FC<IronSheetProps> = ({
  material,
  title,
  subtitle,
  icon,
  emoji,
  badge,
  bigNumber,
  height = 160,
  animationDelayMs = 0,
  onTap,
  className = '',
  style
}) => {
  const [isVisible, setIsVisible] = useState(animationDelayMs === 0);
  const palette = SHEET_MATERIALS[material] || SHEET_MATERIALS.copper;

  useEffect(() => {
    if (animationDelayMs > 0) {
      const timer = setTimeout(() => setIsVisible(true), animationDelayMs);
      return () => clearTimeout(timer);
    }
  }, [animationDelayMs]);

  const handleClick = () => {
    if (onTap) {
      soundEngine.play('tap');
      soundEngine.triggerHaptic(15);
      onTap();
    }
  };

  const formattedHeight = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      onClick={handleClick}
      className={`relative rounded-[20px] overflow-hidden select-none transition-all duration-500 ease-out group ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      } ${onTap ? 'cursor-pointer active:scale-[0.98] hover:scale-[1.01]' : ''} ${className}`}
      style={{
        height: formattedHeight,
        background: `linear-gradient(135deg, ${palette.highlight} 0%, ${palette.base} 50%, ${palette.shadow} 100%)`,
        boxShadow: `0 8px 24px ${palette.shadow}66, 0 2px 6px ${palette.shadow}33`,
        ...style
      }}
    >
      {/* Diagonal Brushed-Metal Texture Overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            rgba(255, 255, 255, 0.15),
            rgba(255, 255, 255, 0.15) 1px,
            transparent 1px,
            transparent 4px
          )`
        }}
      />

      {/* Content Container */}
      <div className="relative z-10 h-full p-4 sm:p-5 flex flex-col justify-between">
        
        {/* Top Row: Icon / Emoji / Big Number + Badge */}
        <div className="flex items-start justify-between">
          <div>
            {bigNumber ? (
              <span
                className="text-4xl font-black leading-none tracking-tighter"
                style={{ color: palette.textPrimary }}
              >
                {bigNumber}
              </span>
            ) : emoji ? (
              <span className="text-3xl leading-none">{emoji}</span>
            ) : icon ? (
              <div className="w-8 h-8 flex items-center justify-center text-white">
                {icon}
              </div>
            ) : null}
          </div>

          {badge && (
            <div
              className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider shadow-sm"
              style={{
                backgroundColor: palette.badgeBackground,
                color: palette.badgeText
              }}
            >
              {badge}
            </div>
          )}
        </div>

        {/* Bottom Section: Title & Subtitle */}
        <div className="space-y-1">
          <h3
            className="text-lg sm:text-xl font-extrabold leading-tight tracking-tight drop-shadow-sm"
            style={{ color: palette.textPrimary }}
          >
            {title}
          </h3>
          <p
            className="text-xs font-medium line-clamp-2 leading-relaxed"
            style={{ color: palette.textSecondary }}
          >
            {subtitle}
          </p>
        </div>

      </div>
    </div>
  );
};
