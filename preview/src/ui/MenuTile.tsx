import React from 'react';

// ---------------------------------------------------------------------------
// MENU TILE — the ONE tile shape for menu rows: the drawer, the settings
// group, and the You tab's grouped sections. A rounded square (12px radius)
// with a soft tint and a thin-line icon inside; a bold 15px title; a grey
// 13px description that stops at two lines. Section headers are small, grey,
// uppercase, mono.
//
// One tile shape on purpose: a menu that changes its tile from group to
// group is a menu that has to be re-learned on every screen.
// ---------------------------------------------------------------------------

export const SectionHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p
    className={`text-[11px] font-mono uppercase tracking-[0.14em] ${className}`}
    style={{ color: 'var(--color-text-muted)' }}
  >
    {children}
  </p>
);

export const MenuTile: React.FC<{
  icon: React.ReactNode;
  title: string;
  /** Grey, 13px, max two lines. What the destination holds, in the app's
      own words. Optional — a row may carry a title alone. */
  description?: string | null;
  onClick?: () => void;
  /** Marks the row the reader is standing on, without a badge or a dot. */
  active?: boolean;
  testId?: string;
  className?: string;
}> = ({ icon, title, description = null, onClick, active = false, testId, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testId ? `menu-tile-${testId}` : 'menu-tile'}
    aria-pressed={active}
    className={`w-full flex items-start gap-3 p-2.5 rounded-2xl text-left cursor-pointer transition-shadow ${className}`}
    style={{
      background: active ? 'var(--color-primary-subtle)' : 'var(--color-paper)',
      boxShadow: 'var(--room-light), var(--lift-1), inset 0 0 0 1px var(--brief-line)'
    }}
  >
    {/* The tile: 12px radius, soft tint, thin line. */}
    <span
      className="w-11 h-11 rounded-xl grid place-items-center shrink-0"
      style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}
    >
      {React.isValidElement(icon)
        ? React.cloneElement(icon as React.ReactElement<{ strokeWidth?: number }>, { strokeWidth: 1.5 })
        : icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] font-bold leading-tight" style={{ color: 'var(--color-text)' }}>
        {title}
      </span>
      {description ? (
        <span className="block text-[13px] leading-snug mt-0.5 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
          {description}
        </span>
      ) : null}
    </span>
  </button>
);

export default MenuTile;
