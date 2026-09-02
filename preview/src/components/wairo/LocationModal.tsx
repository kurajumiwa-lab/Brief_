import React, { useState } from 'react';
import { X, MapPin, Navigation, Clock, Check, Sparkles, Truck } from 'lucide-react';
import { LOCATIONS, WairoLocation } from './wairoData';
import { playSound } from './wairoAudio';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLocation: WairoLocation;
  onSelectLocation: (location: WairoLocation) => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  selectedLocation,
  onSelectLocation,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'nairobi' | 'intercounty'>('all');

  if (!isOpen) return null;

  const filteredLocations = LOCATIONS.filter(l => {
    if (filterMode === 'nairobi') return !l.isInterCounty;
    if (filterMode === 'intercounty') return l.isInterCounty;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-[#0B1B2A] border border-[#173247] rounded-3xl overflow-hidden shadow-2xl flex flex-col text-white">
        
        {/* Header */}
        <div className="p-4 border-b border-[#173247] flex items-center justify-between bg-gradient-to-r from-[#0B1B2A] to-[#173247]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-[#F58220]/20 border border-[#F58220]/40 flex items-center justify-center text-[#F58220]">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Select Drop Location</h3>
              <p className="text-[11px] text-[#DCE2E6]/60">Nairobi Metro & Inter-County Corridors</p>
            </div>
          </div>
          <button
            onClick={() => {
              playSound('click');
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex px-4 pt-3 space-x-2 text-xs">
          {[
            { id: 'all', label: 'All Corridors' },
            { id: 'nairobi', label: 'Nairobi Metro' },
            { id: 'intercounty', label: 'Inter-County Transit' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                playSound('click');
                setFilterMode(tab.id as any);
              }}
              className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                filterMode === tab.id
                  ? 'bg-[#00BFEF] text-[#0B1B2A] font-bold'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Location List */}
        <div className="p-4 max-h-[55vh] overflow-y-auto space-y-2.5">
          {filteredLocations.map((loc) => {
            const isSelected = selectedLocation.id === loc.id;
            return (
              <button
                key={loc.id}
                onClick={() => {
                  playSound('click');
                  onSelectLocation(loc);
                  onClose();
                }}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between group cursor-pointer ${
                  isSelected
                    ? 'bg-[#F58220]/15 border-[#F58220] shadow-md shadow-[#F58220]/20'
                    : 'bg-[#173247]/40 border-white/5 hover:border-[#00BFEF]/40 hover:bg-[#173247]/80'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className={`mt-0.5 w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold ${
                    isSelected ? 'bg-[#F58220] text-white' : 'bg-white/10 text-[#00BFEF]'
                  }`}>
                    {isSelected ? <Check className="w-4 h-4" /> : loc.isInterCounty ? <Truck className="w-3.5 h-3.5" /> : <Navigation className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-white">{loc.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-black/40 text-[#DCE2E6]/80 font-mono">
                        {loc.county}
                      </span>
                    </div>
                    <p className="text-xs text-[#DCE2E6]/70 mt-0.5">{loc.fullName}</p>
                    <div className="flex items-center space-x-3 text-[10px] font-mono text-[#00BFEF] mt-1">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-[#F58220]" />
                        <span>{loc.etaMins} mins ETA</span>
                      </span>
                      <span>•</span>
                      <span>{loc.distanceKm} km transit</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                    isSelected ? 'bg-[#F58220] text-white' : 'bg-[#00BFEF]/20 text-[#00BFEF]'
                  }`}>
                    {isSelected ? 'ACTIVE' : 'SELECT'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="p-3.5 bg-[#07111a] border-t border-[#173247] flex items-center justify-between text-xs text-[#DCE2E6]/80">
          <span className="flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#00BFEF]" />
            <span>Courier & Consolidated freight matching active</span>
          </span>
        </div>

      </div>
    </div>
  );
};
