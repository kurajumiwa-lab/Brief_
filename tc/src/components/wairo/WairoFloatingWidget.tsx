import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Bike, 
  Truck, 
  Footprints, 
  Car, 
  X, 
  Smartphone, 
  ArrowUpRight, 
  Radio, 
  CheckCircle2, 
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  MapPin
} from 'lucide-react';
import { WairoMiniApp } from './WairoMiniApp';
import { LiveTelemetryModal } from './LiveTelemetryModal';
import { LocationModal } from './LocationModal';
import { DispatchModal } from './DispatchModal';
import { EmbedSDKModal } from './EmbedSDKModal';
import { LOCATIONS, INITIAL_ACTIVE_DELIVERY, WairoLocation, WairoDelivery, LogisticsType } from './wairoData';
import { playSound } from './wairoAudio';

export const WairoFloatingWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullPhoneMode, setIsFullPhoneMode] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<WairoLocation>(LOCATIONS[0]);
  const [activeDelivery, setActiveDelivery] = useState<WairoDelivery>(INITIAL_ACTIVE_DELIVERY);

  // Modals
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [isSDKModalOpen, setIsSDKModalOpen] = useState(false);

  const handleSelectLocation = (loc: WairoLocation) => {
    setSelectedLocation(loc);
    setActiveDelivery(prev => ({
      ...prev,
      destination: loc.fullName,
      locationId: loc.id,
      etaMinutes: loc.etaMins,
    }));
  };

  // Auto-progress simulated delivery
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveDelivery(prev => {
        if (prev.progressPercent >= 98) return prev;
        return {
          ...prev,
          progressPercent: Math.min(98, +(prev.progressPercent + 0.15).toFixed(1)),
        };
      });
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <aside aria-label="Wairo Kenyan Marketplace Logistics Companion" data-wairo-widget="true">
      
      {/* ================= MINIMALIST RIGHT-EDGE NOTE-TAB TOGGLE ================= */}
      {/* Docked neatly on the right screen edge like a sticky note edit tab.
          Never overlaps or tampers with the bottom navigation bar. */}
      {!isOpen && (
        <div 
          style={{ 
            position: 'fixed', 
            right: 0, 
            top: '45%', 
            transform: 'translateY(-50%)', 
            zIndex: 42 
          }}
        >
          <button
            onClick={() => {
              playSound('open');
              setIsOpen(true);
            }}
            title="Open Wairo Courier, Consolidated Cargo & Errands Marketplace"
            className="group flex items-center bg-[#0B1B2A] hover:bg-[#173247] text-white pl-3 pr-2 py-3 rounded-l-2xl border-l-2 border-y-2 border-r-0 border-[#00BFEF] shadow-2xl transition-all duration-300 hover:pl-4 cursor-pointer"
          >
            {/* Minimal glowing status pip & orange note accent */}
            <div className="flex flex-col items-center mr-2 space-y-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00BFEF] animate-pulse"></span>
              <div className="w-1.5 h-6 bg-[#F58220] rounded-full"></div>
            </div>

            {/* Vertical / Compact Note Label */}
            <div className="flex flex-col items-start text-left">
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#00BFEF] font-extrabold">
                  WAIRO
                </span>
                <span className="text-[9px] px-1 rounded bg-[#F58220] text-white font-bold font-mono">
                  90pct PAYOUT
                </span>
              </div>
              <span className="text-xs font-bold text-white leading-tight">
                Courier & Errands
              </span>
              <span className="text-[9px] text-[#DCE2E6]/70 font-mono mt-0.5">
                📍 {selectedLocation.name} • {activeDelivery.status}
              </span>
            </div>

            {/* Chevron prompt */}
            <div className="ml-2 text-[#00BFEF] group-hover:-translate-x-1 transition-transform">
              <ChevronLeft className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* ================= EXPANDED SLIDE-OUT DRAWER ================= */}
      {isOpen && !isFullPhoneMode && (
        <div 
          style={{ 
            position: 'fixed', 
            right: '12px', 
            top: '60px', 
            bottom: '72px', 
            zIndex: 45 
          }} 
          className="w-[94vw] sm:w-[410px] shadow-2xl flex flex-col"
        >
          <div className="relative w-full h-full flex flex-col">
            
            {/* Top drawer controls */}
            <div className="absolute -top-3.5 right-4 z-50 flex items-center space-x-1.5 bg-[#0B1B2A] border border-[#173247] px-2 py-0.5 rounded-full shadow-lg">
              <button
                onClick={() => setIsFullPhoneMode(true)}
                title="Expand to Full Smartphone Canvas"
                className="text-[#00BFEF] hover:text-white p-1 cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  playSound('click');
                  setIsOpen(false);
                }}
                title="Dock back to right edge tab"
                className="text-gray-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <WairoMiniApp 
              onOpenTelemetry={() => setIsTelemetryOpen(true)}
              onOpenLocationModal={() => setIsLocationModalOpen(true)}
              onOpenDispatchModal={() => setIsDispatchModalOpen(true)}
              onOpenSDKModal={() => setIsSDKModalOpen(true)}
              selectedLocation={selectedLocation}
              activeDelivery={activeDelivery}
              isMiniView={true}
              onCloseMiniView={() => setIsOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ================= FULL MODAL SMARTPHONE VIEW ================= */}
      {isOpen && isFullPhoneMode && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} className="bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-[380px] sm:w-[412px] h-[780px] sm:h-[840px] bg-[#0B1B2A] rounded-[50px] p-3 shadow-2xl border-4 border-[#173247] ring-8 ring-black/40 flex flex-col">
            
            {/* Top Close / Dock back */}
            <button
              onClick={() => setIsFullPhoneMode(false)}
              className="absolute -top-10 right-0 px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <span>Dock to Right Edge Tab</span>
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="relative w-full h-full rounded-[40px] overflow-hidden bg-[#F3F5F4]">
              <WairoMiniApp 
                onOpenTelemetry={() => setIsTelemetryOpen(true)}
                onOpenLocationModal={() => setIsLocationModalOpen(true)}
                onOpenDispatchModal={() => setIsDispatchModalOpen(true)}
                onOpenSDKModal={() => setIsSDKModalOpen(true)}
                selectedLocation={selectedLocation}
                activeDelivery={activeDelivery}
              />
            </div>
          </div>
        </div>
      )}

      {/* ================= INTEGRATED MODALS ================= */}
      <LiveTelemetryModal 
        isOpen={isTelemetryOpen} 
        onClose={() => setIsTelemetryOpen(false)}
        activeDelivery={activeDelivery}
        selectedLocation={selectedLocation}
      />

      <LocationModal 
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        selectedLocation={selectedLocation}
        onSelectLocation={handleSelectLocation}
      />

      <DispatchModal 
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        onDispatchSuccess={(newOrder) => {
          setActiveDelivery(newOrder);
          const found = LOCATIONS.find(l => l.id === newOrder.locationId);
          if (found) setSelectedLocation(found);
        }}
        currentLocation={selectedLocation}
      />

      <EmbedSDKModal 
        isOpen={isSDKModalOpen}
        onClose={() => setIsSDKModalOpen(false)}
      />
    </aside>
  );
};
