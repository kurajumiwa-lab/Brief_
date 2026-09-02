import React, { useState } from 'react';
import { X, Rocket, ArrowRight, Zap } from 'lucide-react';
import { SERVICES, LOCATIONS, WairoDelivery, WairoLocation, WairoService } from './wairoData';
import { playSound } from './wairoAudio';

interface DispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDispatchSuccess: (newOrder: WairoDelivery) => void;
  currentLocation: WairoLocation;
}

export const DispatchModal: React.FC<DispatchModalProps> = ({
  isOpen,
  onClose,
  onDispatchSuccess,
  currentLocation,
}) => {
  const [selectedService, setSelectedService] = useState<WairoService>(SERVICES[0]);
  const [selectedDest, setSelectedDest] = useState<WairoLocation>(currentLocation || LOCATIONS[0]);
  const [itemDescription, setItemDescription] = useState('Brief Information Pod & Tech Assets');
  const [receiverName, setReceiverName] = useState('Nairobi Metro Hub (+254...)');
  const [prioritySpeed, setPrioritySpeed] = useState<'standard' | 'turbo'>('turbo');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    playSound('radar');

    setTimeout(() => {
      setIsSubmitting(false);
      playSound('success');

      const newOrder: WairoDelivery = {
        trackingId: `WR-${Math.floor(1000 + Math.random() * 9000)}-NX`,
        status: 'IN TRANSIT',
        progressPercent: 12,
        etaMinutes: selectedDest.etaMins,
        destination: selectedDest.fullName,
        locationId: selectedDest.id,
        pilotName: selectedService.id === 'quantum-express' ? 'Captain Kael' : 'Autonomous Drone AI-7',
        pilotCallsign: 'Hover Pilot Active',
        droneId: selectedService.id === 'quantum-express' ? 'Hyper-Hovercraft MK-IV' : 'Vortex-X4 Quad',
        serviceType: selectedService.title,
        packageSummary: itemDescription,
        altitude: 140,
        speed: 88,
        battery: 100,
        quantumLink: '100% SECURE',
        departedTime: 'Just Now',
        estimatedArrival: `in ${selectedDest.etaMins} mins`,
        timeline: [
          { time: 'Just now', title: 'Order Dispatched', desc: 'Loaded into secure aerial transport pod', done: true, active: true },
          { time: 'In 2 mins', title: 'Ascending to Corridor', desc: `Air Corridor ${selectedDest.droneCorridor}`, done: false },
          { time: `In ${selectedDest.etaMins - 2} mins`, title: 'Cruising to Dropzone', desc: `Approaching ${selectedDest.name}`, done: false },
          { time: `In ${selectedDest.etaMins} mins`, title: 'Touchdown & Drop Hand-off', desc: `Precision descent at ${selectedDest.fullName}`, done: false },
        ],
      };

      onDispatchSuccess(newOrder);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-[#0B1B2A] border border-[#173247] rounded-3xl overflow-hidden shadow-2xl flex flex-col text-white">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#173247] flex items-center justify-between bg-gradient-to-r from-[#0B1B2A] via-[#173247] to-[#0B1B2A]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#F58220]/20 border border-[#F58220]/40 flex items-center justify-center text-[#F58220]">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white">Dispatch Quantum Drone</h3>
              <p className="text-xs text-[#DCE2E6]/70">On-demand aerial courier within Nairobi airspace</p>
            </div>
          </div>
          <button
            onClick={() => {
              playSound('click');
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleDispatch} className="p-5 max-h-[72vh] overflow-y-auto space-y-4">
          
          {/* Service Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#DCE2E6]/80 uppercase tracking-wider mb-2">
              Select Courier Vessel
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {SERVICES.slice(0, 3).map((srv) => {
                const isSelected = selectedService.id === srv.id;
                return (
                  <button
                    type="button"
                    key={srv.id}
                    onClick={() => {
                      playSound('click');
                      setSelectedService(srv);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#00BFEF]/15 border-[#00BFEF] shadow-lg shadow-[#00BFEF]/20'
                        : 'bg-[#173247]/40 border-white/5 hover:border-white/20'
                    }`}
                  >
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 text-[#00BFEF] font-bold block w-max mb-1.5">
                      {srv.badge}
                    </span>
                    <h4 className="font-bold text-xs text-white leading-tight">{srv.title}</h4>
                    <span className="text-[11px] text-[#F58220] font-mono font-semibold block mt-1">
                      KES {srv.priceKes}
                    </span>
                    <span className="text-[10px] text-[#DCE2E6]/60 block">{srv.speed}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Destination Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#DCE2E6]/80 uppercase tracking-wider mb-2">
              Destination Dropzone
            </label>
            <select
              value={selectedDest.id}
              onChange={(e) => {
                const found = LOCATIONS.find(l => l.id === e.target.value);
                if (found) setSelectedDest(found);
              }}
              className="w-full bg-[#173247]/70 border border-[#173247] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#00BFEF] transition-colors"
            >
              {LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.id} className="bg-[#0B1B2A] text-white">
                  📍 {loc.name} — {loc.fullName} ({loc.etaMins} mins ETA • {loc.distanceKm} km)
                </option>
              ))}
            </select>
          </div>

          {/* Package details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#DCE2E6]/70 mb-1">Package Contents</label>
              <input
                type="text"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="e.g. Verified Goods"
                className="w-full bg-[#173247]/70 border border-[#173247] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00BFEF]"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#DCE2E6]/70 mb-1">Receiver Contact</label>
              <input
                type="text"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                placeholder="e.g. (+254...)"
                className="w-full bg-[#173247]/70 border border-[#173247] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00BFEF]"
                required
              />
            </div>
          </div>

          {/* Speed toggle */}
          <div className="p-3.5 bg-[#173247]/40 border border-white/5 rounded-2xl flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2.5">
              <Zap className="w-4 h-4 text-[#F58220]" />
              <div>
                <span className="font-bold text-white block">Quantum Priority Flight</span>
                <span className="text-[11px] text-[#DCE2E6]/60">Zero-latency corridor clearance</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                playSound('click');
                setPrioritySpeed(prev => prev === 'turbo' ? 'standard' : 'turbo');
              }}
              className={`px-3 py-1 rounded-full font-mono text-[11px] font-bold transition-all cursor-pointer ${
                prioritySpeed === 'turbo'
                  ? 'bg-[#F58220] text-white shadow-md shadow-[#F58220]/30'
                  : 'bg-white/10 text-gray-300'
              }`}
            >
              {prioritySpeed === 'turbo' ? '⚡ TURBO ACTIVE' : 'STANDARD'}
            </button>
          </div>

          {/* Cost Summary */}
          <div className="p-3.5 bg-gradient-to-r from-[#0B1B2A] to-[#173247] border border-[#00BFEF]/30 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-mono text-[#00BFEF]">Total Flight Fare</span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-xl font-bold font-mono text-white">KES {selectedService.priceKes}</span>
                <span className="text-xs text-[#DCE2E6]/60 font-mono">(${selectedService.priceUsd} USD)</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-emerald-400 block font-mono">✓ Carbon Neutral</span>
              <span className="text-xs text-[#F58220] font-bold">{selectedDest.etaMins} Min Delivery</span>
            </div>
          </div>

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#F58220] to-[#FF9D24] hover:brightness-110 text-white font-bold text-sm shadow-xl shadow-[#F58220]/30 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center space-x-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Locking Air Corridor...</span>
              </span>
            ) : (
              <span className="flex items-center space-x-2">
                <span>Confirm & Dispatch Hover-Drone</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>

        </form>

      </div>
    </div>
  );
};
