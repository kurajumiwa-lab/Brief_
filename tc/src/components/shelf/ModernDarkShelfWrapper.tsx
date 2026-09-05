import React, { useState, useRef } from 'react';
import { ShelfPlank } from './ShelfPlank';
import { soundEngine } from '../../utils/SoundEngine';
import { ShieldCheck } from 'lucide-react';

export const DARK_SHELF_TOKENS = {
  canvasBase: '#0F1013',
  ambientTop: '#1A1B21',
  shelfTopLip: '#3A3C44',
  shelfDeckSurface: '#23252C',
  shelfFrontLip: '#1A1B20',
  shelfDropShadow: '0 6px 12px rgba(0, 0, 0, 0.70)',
  bookCoverContactShadow: '0 6px 10px rgba(0, 0, 0, 0.85)',
  bookCoverDropShadowFilter: 'drop-shadow(0 6px 8px rgba(0, 0, 0, 0.85))',
  mutedText: '#7D818F',
} as const;

export interface DarkShelfBookCardProps {
  id: string;
  title: string;
  subtitle?: string;
  category?: string;
  author?: string;
  badge?: string;
  badgeColor?: string;
  accentColor?: string;
  image?: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  onLongPress?: () => void;
  className?: string;
  locked?: boolean;
  unlockText?: string;
  
  // High-Signal 3-Token Microcopy & Zero-CLS Placeholders
  gradeToken?: string;
  kicdApproved?: boolean;
  wairoDeliveryToken?: string;
  priceKes?: number;
  dominantColor?: string;
  isElevated?: boolean;
  isDimmed?: boolean;
  onDirectBuy?: () => void;
  onChamaSplit?: () => void;
}

/**
 * Modern Dark Shelf Book/Item Card:
 * - Seated physically flush on top of the shelf with high-contrast bottom contact shadow.
 * - 4-Tier Asset Pipeline: 6-char dominant color swatch (0ms paint / 0 CLS) + 3D spine fold edge shading.
 * - 3-Token High-Signal Microcopy: [ KICD ✓ ] [ G4 • CORE ] [ WAIRO 48h ] KES 480.
 * - Bottom-aligned to anchor securely to the 1px highlight shelf deck regardless of book aspect ratio.
 */
export const DarkShelfBookCard: React.FC<DarkShelfBookCardProps> = ({
  id,
  title,
  subtitle,
  category,
  author,
  badge,
  badgeColor = '#E8985E',
  accentColor = '#E8985E',
  image,
  icon: Icon,
  onClick,
  onLongPress,
  className = '',
  locked = false,
  unlockText,
  gradeToken,
  kicdApproved,
  wairoDeliveryToken,
  priceKes,
  dominantColor = '#1E2027',
  isElevated = false,
  isDimmed = false,
  onDirectBuy,
  onChamaSplit
}) => {
  const timerRef = useRef<any>(null);
  const isLongPressRef = useRef(false);

  const handleTouchStart = () => {
    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      soundEngine.play('tap');
      soundEngine.triggerHaptic([25, 35, 50]);
      onLongPress?.();
    }, 450);
  };

  const handleTouchEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    soundEngine.play('tap');
    onClick?.();
  };

  return (
    <button
      type="button"
      data-shelf-item-id={id}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      className={`group relative shrink-0 w-[140px] sm:w-[155px] h-[195px] sm:h-[215px] rounded-[3px] overflow-hidden text-left transition-all duration-300 focus:outline-none cursor-pointer select-none ${
        isElevated 
          ? 'scale-105 -translate-y-2.5 z-30 ring-2 ring-[#E8985E]/60 shadow-2xl' 
          : isDimmed 
          ? 'opacity-35 scale-95' 
          : 'hover:-translate-y-1.5'
      } ${className}`}
      style={{
        boxShadow: DARK_SHELF_TOKENS.bookCoverContactShadow,
        filter: DARK_SHELF_TOKENS.bookCoverDropShadowFilter,
        backgroundColor: dominantColor,
      }}
    >
      {/* 1. Dominant Color Swatch Background (0ms Paint / Zero-CLS) */}
      <div 
        className="absolute inset-0 transition-opacity duration-300"
        style={{ backgroundColor: dominantColor }}
      />

      {/* 2. Cover Art Image (Lazy loaded over dominant swatch) */}
      {image ? (
        <img
          src={image}
          alt={title}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${dominantColor} 0%, #17181F 100%)`,
          }}
        />
      )}

      {/* 3. Physical 3D Spine Fold Affordance (Left Edge 2.5px Gradient Shadow) */}
      <div
        className="absolute inset-y-0 left-0 w-3 pointer-events-none z-10"
        style={{
          background: 'linear-gradient(90deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.2) 65%, rgba(0,0,0,0) 100%)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
        }}
      />

      {/* 4. Contrast Scrim Overlay for Typographic Hierarchy */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(15,16,19,0.25) 0%, rgba(15,16,19,0.75) 60%, rgba(15,16,19,0.98) 100%)',
        }}
      />

      {/* Top badges & High-Signal Pill Tokens */}
      <div className="absolute top-2.5 left-3 right-2.5 flex items-center justify-between z-20">
        {Icon ? (
          <div
            className="w-6 h-6 rounded flex items-center justify-center backdrop-blur-sm shadow-sm"
            style={{ backgroundColor: 'rgba(26, 27, 33, 0.90)', color: accentColor }}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
        ) : kicdApproved ? (
          <div
            className="px-1.5 py-0.5 rounded-[3px] bg-amber-500/20 text-amber-300 flex items-center space-x-0.5 text-[7.5px] font-black uppercase tracking-wider border border-amber-400/30"
          >
            <ShieldCheck className="w-2.5 h-2.5 text-amber-400" />
            <span>KICD ✓</span>
          </div>
        ) : (
          <div />
        )}

        {gradeToken ? (
          <span
            className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-[3px] bg-[#1F232D] text-[#7D818F] border border-white/10"
          >
            {gradeToken}
          </span>
        ) : badge ? (
          <span
            className="ml-auto text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-[2px]"
            style={{
              backgroundColor: 'rgba(15, 16, 19, 0.92)',
              color: badgeColor,
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>

      {/* Seated Bottom Cover Text & Microcopy */}
      <div className="absolute inset-x-3 bottom-2.5 z-20">
        {category && (
          <p
            className="text-[8px] font-black uppercase tracking-[0.15em] line-clamp-1 mb-0.5"
            style={{ color: accentColor }}
          >
            {category}
          </p>
        )}
        
        <h4 className="text-xs font-black text-white leading-tight line-clamp-2">
          {title}
        </h4>

        {/* 3-Token High-Signal Strip (Price / WAIRO / Progress) */}
        {priceKes ? (
          <div className="mt-1.5 flex items-center justify-between pt-1 border-t border-white/10">
            <span className="text-[10.5px] font-black text-amber-300">
              KES {priceKes.toLocaleString()}
            </span>
            {wairoDeliveryToken && (
              <span className="text-[7.5px] font-mono font-bold text-cyan-300 bg-cyan-950/60 px-1 py-0.2 rounded">
                {wairoDeliveryToken}
              </span>
            )}
          </div>
        ) : (subtitle || author || unlockText) ? (
          <p
            className="text-[9.5px] font-medium leading-snug mt-1 line-clamp-1"
            style={{ color: locked ? '#FBBF24' : DARK_SHELF_TOKENS.mutedText }}
          >
            {locked && unlockText ? `Opens: ${unlockText}` : (subtitle || author)}
          </p>
        ) : null}
      </div>
    </button>
  );
};

export interface ShelfRowProps {
  label?: string;
  countLabel?: string;
  actionButton?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  plankClassName?: string;
}

/**
 * A single tiered shelf row where items sit flush on top of the physical ShelfPlank.
 * Pinned with `items-end` to guarantee CBC books of varying physical aspect ratios sit firmly on the deck.
 */
export const ShelfRow: React.FC<ShelfRowProps> = ({
  label,
  countLabel,
  actionButton,
  children,
  className = '',
  plankClassName = '',
}) => {
  return (
    <div className={`relative flex flex-col mb-7 last:mb-1 ${className}`}>
      {/* Row Category Header */}
      {(label || countLabel || actionButton) && (
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center space-x-2">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: '#E8985E' }}
            />
            {label && (
              <span
                className="text-xs font-bold tracking-wider uppercase text-white"
              >
                {label}
              </span>
            )}
            {countLabel && (
              <span
                className="text-[11px] font-medium"
                style={{ color: DARK_SHELF_TOKENS.mutedText }}
              >
                ({countLabel})
              </span>
            )}
          </div>
          {actionButton && <div>{actionButton}</div>}
        </div>
      )}

      {/* Seated Items Container - Bottom-Anchored to Shelf Deck Lip */}
      <div className="relative z-10 w-full flex items-end overflow-x-auto no-scrollbar scroll-smooth space-x-3.5 pb-0 pt-2 px-1">
        {children}
      </div>

      {/* Physical Shelf Plank underneath the seated items */}
      <ShelfPlank className={`mt-0 z-0 ${plankClassName}`} />
    </div>
  );
};

export interface ModernDarkShelfWrapperProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  badge?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 🎨 Modern Dark Shelf UI Container:
 * - Ambient dark radial gradient: #1A1B21 at top-center transitioning to #0F1013 at base.
 * - Flat-bevel slate-dark shelf planks with 1px #3A3C44 highlight lip.
 * - Bottom-anchored card alignment for physical stability on the deck.
 * - Deep baked contact shadows under items (low-end GPU optimized).
 */
export const ModernDarkShelfWrapper: React.FC<ModernDarkShelfWrapperProps> = ({
  children,
  title,
  subtitle,
  badge,
  className = '',
  style,
}) => {
  return (
    <div
      className={`relative w-full rounded-2xl p-4 sm:p-6 overflow-hidden text-white ${className}`}
      style={{
        background: `radial-gradient(120% 80% at 50% 0%, ${DARK_SHELF_TOKENS.ambientTop} 0%, ${DARK_SHELF_TOKENS.canvasBase} 100%)`,
        backgroundColor: DARK_SHELF_TOKENS.canvasBase,
        ...style,
      }}
    >
      {/* Optional Top Shelf Header */}
      {(title || subtitle || badge) && (
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#23252C]/70">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#E8985E]" />
              {title && (
                <h2 className="text-sm font-black tracking-widest uppercase text-white">
                  {title}
                </h2>
              )}
            </div>
            {subtitle && (
              <p
                className="text-xs font-normal mt-0.5 ml-4"
                style={{ color: DARK_SHELF_TOKENS.mutedText }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {badge && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{
                backgroundColor: 'rgba(58, 60, 68, 0.5)',
                color: '#E8985E',
              }}
            >
              {badge}
            </span>
          )}
        </div>
      )}

      {/* Shelf Body Rows & Content */}
      <div className="relative w-full space-y-2">{children}</div>
    </div>
  );
};

export default ModernDarkShelfWrapper;
