import React, { useState } from 'react';
import { 
  X, 
  Bike, 
  Truck, 
  Footprints, 
  Car, 
  ArrowRight, 
  ShieldCheck, 
  Check, 
  Sparkles, 
  MapPin, 
  Zap, 
  DollarSign,
  Briefcase
} from 'lucide-react';
import { 
  LOGISTICS_SERVICES, 
  LOCATIONS, 
  WairoDelivery, 
  WairoLocation, 
  LogisticsService, 
  computeAuctionBids, 
  LogisticsType 
} from './wairoData';
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
  const [selectedService, setSelectedService] = useState<LogisticsService>(LOGISTICS_SERVICES[0]);
  const [selectedDest, setSelectedDest] = useState<WairoLocation>(currentLocation || LOCATIONS[0]);
  const [itemDescription, setItemDescription] = useState('Business Documents & Tech Assets');
  const [receiverContact, setReceiverContact] = useState('Jane Doe (+254 700 123 456)');
  const [selectedBidOption, setSelectedBidOption] = useState<'auction' | 'branded' | 'consolidated' | 'wayfarer'>('auction');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const bids = computeAuctionBids(selectedService.id, selectedDest);
  const activeBid = bids.find(b => 
    selectedBidOption === 'branded' ? b.isBrandedCompany :
    selectedBidOption === 'wayfarer' ? b.vehicleType === 'car' :
    b.matchScore >= 95
  ) || bids[0];

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    playSound('radar');

    setTimeout(() => {
      setIsSubmitting(false);
      playSound('success');

      const fare = activeBid.bidPriceKes;
      const driverTake = Math.round(fare * 0.90); // 90% payout
      const platformTake = fare - driverTake;

      const newOrder: WairoDelivery = {
        trackingId: `WR-KEN-${Math.floor(1000 + Math.random() * 9000)}-NX`,
        serviceType: selectedService.id,
        status: 'IN TRANSIT',
        progressPercent: 15,
        etaMinutes: activeBid.etaMins,
        destination: selectedDest.fullName,
        locationId: selectedDest.id,
        senderLocation: 'Nairobi CBD Central Hub',
        providerName: activeBid.companyName,
        carrierType: `${selectedService.title} (${activeBid.vehicleModel})`,
        courierName: `${activeBid.driverName} (${activeBid.isLogbookVerifiedOwner ? 'Logbook Verified' : 'Vetted Partner'})`,
        courierPhone: '+254 712 998 877',
        vehicleType: activeBid.vehicleModel,
        vehiclePlate: activeBid.plateNo,
        packageSummary: itemDescription,
        fareKes: fare,
        driverReturnKes: driverTake,
        platformFeeKes: platformTake,
        timeline: [
          { time: 'Just now', title: 'Private Auction Match Settled', desc: `Assigned: ${activeBid.companyName} (${activeBid.trustScore}% Trust)`, done: true, active: true },
          { time: 'In 3 mins', title: 'Package Collection & Seal', desc: 'Tamper-evident verification tag applied', done: false },
          { time: `In ${Math.max(5, activeBid.etaMins - 5)} mins`, title: 'Courier En Route', desc: `Transit corridor: ${selectedDest.transitCorridor}`, done: false },
          { time: `In ${activeBid.etaMins} mins`, title: 'Drop-off & OTP Settlement', desc: `Hand-off at ${selectedDest.fullName}`, done: false },
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
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white">Kenyan Logistics & Errands Dispatch</h3>
              <p className="text-xs text-[#DCE2E6]/70">Courier, Consolidated Cargo & Errands with 90% Provider Return</p>
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
          
          {/* Logistics Service Option Picker */}
          <div>
            <label className="block text-xs font-semibold text-[#DCE2E6]/80 uppercase tracking-wider mb-2">
              Select Logistics Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {LOGISTICS_SERVICES.map((srv) => {
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
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-[#00BFEF] font-bold">
                        {srv.badge}
                      </span>
                      {srv.id === 'courier' && <Bike className="w-3.5 h-3.5 text-[#F58220]" />}
                      {srv.id === 'consolidated' && <Truck className="w-3.5 h-3.5 text-[#00BFEF]" />}
                      {srv.id === 'errands' && <Footprints className="w-3.5 h-3.5 text-[#19D8F5]" />}
                      {srv.id === 'wayfarer' && <Car className="w-3.5 h-3.5 text-[#FF9D24]" />}
                    </div>
                    <h4 className="font-bold text-xs text-white leading-tight mt-1.5">{srv.title}</h4>
                    <span className="text-[11px] text-[#F58220] font-mono font-semibold block mt-0.5">
                      Base: KES {srv.baseKes}
                    </span>
                    <span className="text-[10px] text-emerald-400 block font-mono">{srv.driverSharePercent}% Provider Return</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Destination Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#DCE2E6]/80 uppercase tracking-wider mb-2">
              Drop Location (Nairobi & Inter-County)
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
                  📍 {loc.name} ({loc.county}) — {loc.fullName} • {loc.etaMins}m ETA
                </option>
              ))}
            </select>
          </div>

          {/* Private Reverse-Auction Bid Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#DCE2E6]/80 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Mathematical Private Auction Bids</span>
              <span className="text-[10px] text-[#00BFEF] font-mono">No Public Bidding Spam</span>
            </label>
            <div className="space-y-2">
              {bids.slice(0, 3).map((bid) => {
                const isChosen = activeBid.providerId === bid.providerId;
                return (
                  <div
                    key={bid.providerId}
                    onClick={() => {
                      playSound('click');
                      if (bid.isBrandedCompany) setSelectedBidOption('branded');
                      else if (bid.vehicleType === 'car') setSelectedBidOption('wayfarer');
                      else setSelectedBidOption('auction');
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isChosen 
                        ? 'bg-[#F58220]/15 border-[#F58220] shadow-md shadow-[#F58220]/20' 
                        : 'bg-[#173247]/40 border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-white">{bid.companyName}</span>
                        {bid.isLogbookVerifiedOwner && (
                          <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                            ✓ OWNER LOGBOOK
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#DCE2E6]/70 mt-0.5">{bid.vehicleModel} • {bid.driverName}</p>
                      <span className="text-[10px] font-mono text-[#00BFEF] block mt-0.5">
                        ★ {bid.trustScore}% Trust • {bid.etaMins}m ETA • {bid.insuranceCovered ? '100% Insured' : 'Standard Cover'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-mono font-bold text-white block">KES {bid.bidPriceKes}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isChosen ? 'bg-[#F58220] text-white' : 'bg-white/10 text-gray-300'}`}>
                        {isChosen ? 'SELECTED' : 'CHOOSE'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Package details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#DCE2E6]/70 mb-1">Package / Task Details</label>
              <input
                type="text"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="e.g. Legal Documents, Groceries"
                className="w-full bg-[#173247]/70 border border-[#173247] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00BFEF]"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#DCE2E6]/70 mb-1">Recipient Name & Contact</label>
              <input
                type="text"
                value={receiverContact}
                onChange={(e) => setReceiverContact(e.target.value)}
                placeholder="e.g. Maya (+254...)"
                className="w-full bg-[#173247]/70 border border-[#173247] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00BFEF]"
                required
              />
            </div>
          </div>

          {/* Fair Provider Return Breakdown (90% Payout) */}
          <div className="p-3.5 bg-gradient-to-r from-[#0B1B2A] to-[#173247] border border-[#00BFEF]/30 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono text-[#00BFEF]">Total Delivery Fare (M-Pesa)</span>
                <div className="flex items-baseline space-x-1.5">
                  <span className="text-xl font-bold font-mono text-white">KES {activeBid.bidPriceKes}</span>
                </div>
              </div>
              <div className="text-right font-mono text-xs">
                <span className="text-emerald-400 font-bold block">Rider Take: KES {Math.round(activeBid.bidPriceKes * 0.9)} (90%)</span>
                <span className="text-gray-400 text-[10px] block">Platform Fee: KES {Math.round(activeBid.bidPriceKes * 0.1)} (10%)</span>
              </div>
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
                <span>Settling Private Reverse-Auction...</span>
              </span>
            ) : (
              <span className="flex items-center space-x-2">
                <span>Confirm & Dispatch Courier</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>

          {/* ── NON-PROMISES DISCLAIMER (NEIGHBORHOOD TRUST OS) ── */}
          <p className="text-[10px] text-gray-400 text-center leading-snug px-2">
            You are booking a rider directly. Brief connects you and records the trip — resolving issues is between you and the rider, with support from your Community Champion if needed.
          </p>

        </form>

      </div>
    </div>
  );
};
