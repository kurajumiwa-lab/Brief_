import React from 'react';
import { AppPalette } from '../../styles/appPalette';
import { soundEngine } from '../../utils/SoundEngine';

export interface VisualToggleOption {
  id: string | number;
  label: string;
  icon: React.ReactNode;
}

export interface VisualToggleProps {
  options: VisualToggleOption[];
  selectedIndex: number;
  onChanged: (index: number) => void;
  className?: string;
}

/**
 * VisualToggle
 * High-contrast, large-format visual category/option selector.
 * No harsh borders — clear boundary via color contrast and soft glow.
 */
export const VisualToggle: React.FC<VisualToggleProps> = ({
  options,
  selectedIndex,
  onChanged,
  className = ''
}) => {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 ${className}`}>
      {options.map((opt, idx) => {
        const isSelected = idx === selectedIndex;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              soundEngine.triggerHaptic(15);
              onChanged(idx);
            }}
            className={`flex flex-col items-center justify-center p-4 rounded-2xl transition-all duration-300 cursor-pointer select-none ${
              isSelected
                ? 'scale-[1.02]'
                : 'hover:scale-[1.01]'
            }`}
            style={{
              backgroundColor: isSelected
                ? 'rgba(11, 110, 110, 0.12)'
                : AppPalette.surface,
              boxShadow: isSelected
                ? `0 6px 16px rgba(11, 110, 110, 0.2)`
                : `0 2px 8px rgba(26, 31, 46, 0.04)`
            }}
          >
            <div
              className={`w-10 h-10 mb-2 flex items-center justify-center transition-colors ${
                isSelected ? 'text-[#0B6E6E]' : 'text-[#9CA3AF]'
              }`}
            >
              {opt.icon}
            </div>
            <span
              className={`text-xs text-center transition-colors ${
                isSelected
                  ? 'font-bold text-[#0B6E6E]'
                  : 'font-medium text-[#9CA3AF]'
              }`}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
