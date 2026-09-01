import React from 'react';

// ---------------------------------------------------------------------------
// ARENA GAME ICONS — inline, high-contrast vector badges.
//
// Zero external assets: every glyph is an inline SVG so no .png/.webp/.mp3 can
// ever 404. These are decorative companions to the existing lucide set, used
// where an icon needs the arena/arcade silhouette. All are aria-hidden because
// the surrounding buttons carry their own labels.
// ---------------------------------------------------------------------------

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

export const ArenaSwordsIcon: React.FC<IconProps> = ({
  size = 28,
  color = '#FF8800',
  className = ''
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
    <line x1="13" y1="19" x2="19" y2="13" />
    <line x1="16" y1="16" x2="20" y2="20" />
    <line x1="19" y1="21" x2="21" y2="19" />
  </svg>
);

export const ArenaShieldIcon: React.FC<IconProps> = ({
  size = 28,
  color = '#00E5FF',
  className = ''
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    className={className}
    aria-hidden="true"
  >
    <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm0 2.18l6 2.25v4.66c0 4.14-2.73 7.97-6 9.01-3.27-1.04-6-4.87-6-9.01V6.43l6-2.25z" />
  </svg>
);

export const ArenaTrophyIcon: React.FC<IconProps> = ({
  size = 28,
  color = '#FFD700',
  className = ''
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    className={className}
    aria-hidden="true"
  >
    <path d="M19 4h-3V2H8v2H5c-1.1 0-2 .9-2 2v2c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.76 2.7 3.11 3.31V19H8v2h8v-2h-2.5v-2.75c1.35-.61 2.48-1.81 3.11-3.31C19.08 12.63 21 10.55 21 8V6c0-1.1-.9-2-2-2zM5 8V6h3v4.62C6.31 10.15 5 9.21 5 8zm14 0c0 1.21-1.31 2.15-3 2.62V6h3v2z" />
  </svg>
);

export const ArenaChestIcon: React.FC<IconProps> = ({
  size = 28,
  color = '#22E6E0',
  className = ''
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    className={className}
    aria-hidden="true"
  >
    <path d="M20 7l-8-4-8 4 8 4 8-4zm-8 6l-8-4v8l8 4V13zm2 0v8l8-4v-8l-8 4z" />
  </svg>
);

export const ArenaPlayIcon: React.FC<IconProps> = ({
  size = 32,
  color = '#F7F7F8',
  className = ''
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    className={className}
    aria-hidden="true"
  >
    <path d="M8 5v14l11-7z" />
  </svg>
);

export const ArenaSoundToggleIcon: React.FC<{
  isMuted: boolean;
  size?: number;
  color?: string;
  className?: string;
}> = ({ isMuted, size = 24, color = '#F7F7F8', className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {isMuted ? (
      <>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </>
    ) : (
      <>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
      </>
    )}
  </svg>
);

export const ArcadeCoinIcon: React.FC<IconProps> = ({
  size = 24,
  color = '#FFD700',
  className = ''
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" fill={color} />
    <circle cx="12" cy="12" r="7" fill="none" stroke="#F7F7F8" strokeWidth="1.5" opacity="0.55" />
    <path d="M9 8h5.2c1.75 0 3.2 1.4 3.2 3.1 0 1.6-1.3 2.9-2.9 2.9H11v2H9V8zm2 1.7v2.6h3.1c.79 0 1.5-.6 1.5-1.3s-.71-1.3-1.5-1.3H11z" fill="#FF5A1F" />
  </svg>
);
