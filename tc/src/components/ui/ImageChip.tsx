import React from 'react';
import { AppPalette } from '../../styles/appPalette';
import { soundEngine } from '../../utils/SoundEngine';

export interface ImageChipProps {
  label: string;
  icon?: React.ReactNode;
  isSelected?: boolean;
  onTap: () => void;
  className?: string;
}

/**
 * ImageChip
 * Visual category / filter pill replacing standard dropdowns with iconography.
 */
export const ImageChip: React.FC<ImageChipProps> = ({
  label,
  icon,
  isSelected = false,
  onTap,
  className = ''
}) => {
  const handleClick = () => {
    soundEngine.play('tap');
    soundEngine.triggerHaptic(10);
    onTap();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer select-none active:scale-95 ${
        isSelected ? 'text-white' : 'text-[#6B7280] hover:text-[#1A1F2E]'
      } ${className}`}
      style={{
        backgroundColor: isSelected
          ? AppPalette.primary
          : 'rgba(232, 228, 221, 0.6)',
        boxShadow: isSelected
          ? `0 4px 12px rgba(11, 110, 110, 0.35)`
          : 'none'
      }}
    >
      {icon && <span className="w-4 h-4 flex items-center justify-center">{icon}</span>}
      <span>{label}</span>
    </button>
  );
};
