import React from 'react';
import {
  MapPin,
  X,
  Check,
  ShieldCheck,
  Users,
  Truck,
  Sparkles
} from 'lucide-react';
import { NEIGHBORHOODS, Neighborhood } from '../../model/neighborhoods';
import { soundEngine } from '../../utils/SoundEngine';

export interface NeighborhoodPickerModalProps {
  isOpen: boolean;
  selectedId: string;
  onSelect: (neighborhood: Neighborhood) => void;
  onClose: () => void;
}

export const NeighborhoodPickerModal: React.FC<NeighborhoodPickerModalProps> = ({
  isOpen,
  selectedId,
  onSelect,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-xl my-auto rounded-3xl bg-[#1A1F2E] text-white p-5 sm:p-6 shadow-2xl space-y-5 animate-slideUp">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#00BFEF]/20 text-[#00BFEF] flex items-center justify-center font-black">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#00BFEF] font-bold block">
                3KM MICRO-ECONOMY
              </span>
              <h2 className="text-xl font-black text-white tracking-tight">
                Select Your Neighborhood
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">
          Brief connects you to active Boda stages, verified Chama circles, and local shifts right in your estate.
        </p>

        {/* Neighborhood Grid */}
        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1 no-scrollbar">
          {NEIGHBORHOODS.map((nh) => {
            const isSelected = nh.id === selectedId;
            return (
              <button
                key={nh.id}
                type="button"
                onClick={() => {
                  soundEngine.play('victory');
                  onSelect(nh);
                  onClose();
                }}
                className={`w-full p-4 rounded-2xl text-left transition-all duration-200 cursor-pointer flex items-start justify-between ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#00BFEF]/20 to-[#2563EB]/20 shadow-lg'
                    : 'bg-[#262D3D] hover:bg-[#2F374A]'
                }`}
              >
                <div className="space-y-1.5 flex-1 pr-3">
                  <div className="flex items-center space-x-2">
                    <span className="font-black text-base text-white">{nh.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-300 font-semibold">
                      {nh.county}
                    </span>
                    {isSelected && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#00BFEF] text-[#0D1117] font-black uppercase">
                        Active
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-300 font-medium">
                    {nh.tagline}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-gray-400">
                    <span className="flex items-center space-x-1 text-[#00BFEF]">
                      <Truck className="w-3.5 h-3.5" />
                      <span>{nh.stats.activeRidersCount} Boda Riders</span>
                    </span>
                    <span className="flex items-center space-x-1 text-emerald-400">
                      <Users className="w-3.5 h-3.5" />
                      <span>{nh.stats.activeChamasCount} Chamas</span>
                    </span>
                    <span className="flex items-center space-x-1 text-amber-400">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{nh.champion.name}</span>
                    </span>
                  </div>
                </div>

                <div className="shrink-0 pt-1">
                  {isSelected ? (
                    <div className="w-6 h-6 rounded-full bg-[#00BFEF] text-[#0D1117] flex items-center justify-center font-black">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-500">
                      <Sparkles className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-3.5 rounded-2xl bg-white/5 flex items-center justify-between text-xs text-gray-300">
          <span>Riders get 90% payout instantly to M-Pesa.</span>
          <span className="text-[#00BFEF] font-bold">Zero Platform Tax</span>
        </div>

      </div>
    </div>
  );
};
