import React from 'react';
import { SheetMaterial, SHEET_MATERIALS } from './IronSheet';
import { soundEngine } from '../../utils/SoundEngine';

export interface MetalTagProps {
  label: string;
  icon?: React.ReactNode;
  material: SheetMaterial;
  selected?: boolean;
  onTap?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * MetalTag
 * Small brushed-metal category/filter tag that slides out from or complements IronSheet cards.
 */
export const MetalTag: React.FC<MetalTagProps> = ({
  label,
  icon,
  material,
  selected = false,
  onTap,
  className = '',
  style
}) => {
  const palette = SHEET_MATERIALS[material] || SHEET_MATERIALS.copper;

  const handleClick = () => {
    if (onTap) {
      soundEngine.play('tap');
      soundEngine.triggerHaptic(10);
      onTap();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-full text-xs font-bold tracking-wide transition-all duration-200 select-none cursor-pointer active:scale-95 ${
        selected ? 'text-white shadow-md' : 'hover:opacity-90'
      } ${className}`}
      style={{
        background: selected
          ? `linear-gradient(135deg, ${palette.highlight} 0%, ${palette.base} 100%)`
          : `linear-gradient(135deg, ${palette.base}26 0%, ${palette.base}14 100%)`,
        color: selected ? palette.textPrimary : palette.base,
        boxShadow: selected ? `0 4px 12px ${palette.shadow}44` : 'none',
        ...style
      }}
    >
      {icon && <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">{icon}</span>}
      <span>{label}</span>
    </button>
  );
};
