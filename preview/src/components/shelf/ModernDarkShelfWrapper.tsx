import React from 'react';
import { ShelfPlank } from './ShelfPlank';

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
  className?: string;
  locked?: boolean;
  unlockText?: string;
}

/**
 * Modern Dark Shelf Book/Item Card:
 * Seated physically flush on top of the shelf with high-contrast bottom contact shadow,
 * crisp borders, matte dark styling, and legibility.
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
  className = '',
  locked = false,
  unlockText,
}) => {
  return (
    <button
      type="button"
      data-shelf-item-id={id}
      onClick={onClick}
      className={`group relative shrink-0 w-[140px] sm:w-[155px] h-[195px] sm:h-[215px] rounded-[3px] overflow-hidden text-left transition-all duration-200 hover:-translate-y-1.5 focus:outline-none cursor-pointer select-none ${className}`}
      style={{
        boxShadow: DARK_SHELF_TOKENS.bookCoverContactShadow,
        filter: DARK_SHELF_TOKENS.bookCoverDropShadowFilter,
        backgroundColor: '#1E2027',
      }}
    >
      {/* Spine / Book Cover Art */}
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
            background: 'linear-gradient(135deg, #242731 0%, #17181F 100%)',
          }}
        />
      )}

      {/* Spine Shadow on Left Edge simulating a physical book fold */}
      <div
        className="absolute inset-y-0 left-0 w-2.5 pointer-events-none z-10"
        style={{
          background: 'linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      />

      {/* Dark gradient overlay for typography readability */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(15,16,19,0.2) 0%, rgba(15,16,19,0.85) 70%, rgba(15,16,19,0.98) 100%)',
        }}
      />

      {/* Top badges & indicators */}
      <div className="absolute top-2.5 left-3 right-2.5 flex items-center justify-between z-20">
        {Icon && (
          <div
            className="w-6 h-6 rounded flex items-center justify-center backdrop-blur-sm"
            style={{ backgroundColor: 'rgba(26, 27, 33, 0.85)', color: accentColor }}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
        {badge && (
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
        )}
      </div>

      {/* Seated Bottom Cover Text Info */}
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
        {(subtitle || author || unlockText) && (
          <p
            className="text-[9.5px] font-medium leading-snug mt-1 line-clamp-1"
            style={{ color: locked ? '#FBBF24' : DARK_SHELF_TOKENS.mutedText }}
          >
            {locked && unlockText ? `Opens: ${unlockText}` : (subtitle || author)}
          </p>
        )}
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
 * A single tiered shelf row where items sit flush on top of the physical ShelfPlank
 * with ambient contact drop shadows.
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

      {/* Seated Items Container */}
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
 * - Deep contact shadows under items.
 * - Modern charcoal matte aesthetic (zero brown/wood textures).
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
