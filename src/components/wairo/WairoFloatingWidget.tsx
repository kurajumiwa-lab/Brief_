import React, { useState } from 'react';
import { 
  Bike, 
  X, 
  Smartphone, 
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  MapPin,
  Sparkles
} from 'lucide-react';
import { WairoMiniApp } from './WairoMiniApp';
import { LiveTelemetryModal } from './LiveTelemetryModal';
import { LocationModal } from './LocationModal';
import { DispatchModal } from './DispatchModal';
import { EmbedSDKModal } from './EmbedSDKModal';
import { UssdSimulatorDesk } from '../offline/UssdSimulatorDesk';
import { InterCountyDesk } from './InterCountyDesk';
import { PrivateCarrierAuctionDesk } from './PrivateCarrierAuctionDesk';
import { OfflineSyncQueueDesk } from '../offline/OfflineSyncQueueDesk';
import { LOCATIONS, INITIAL_ACTIVE_DELIVERY, WairoLocation, WairoDelivery } from './wairoData';
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
  const [isUssdOpen, setIsUssdOpen] = useState(false);
  const [isInterCountyOpen, setIsInterCountyOpen] = useState(false);
  const [isCarrierAuctionOpen, setIsCarrierAuctionOpen] = useState(false);
  const [isOfflineSyncOpen, setIsOfflineSyncOpen] = useState(false);

  const handleSelectLocation = (loc: WairoLocation) => {
    setSelectedLocation(loc);
    setActiveDelivery(prev => ({
      ...prev,
      destination: loc.fullName,
      locationId: loc.id,
      etaMinutes: loc.etaMins,
    }));
  };

  return (
    <aside aria-label="Wairo Kenyan Marketplace Logistics Companion" data-wairo-widget="true">
      
      {/* ================= REFINED NATIVE RIGHT-EDGE PILL ================= */}
      {/* Soft rounded squircle, subtle gray border, ambient shadow, clean light theme */}
      {!isOpen && (
        <div 
          style={{ 
            position: 'fixed', 
            right: 0, 
            top: '48%', 
            transform: 'translateY(-50%)', 
            zIndex: 42 
          }}
        >
          <button
            type="button"
            onClick={() => {
              playSound('open');
              setIsOpen(true);
            }}
            title="Open Wairo Courier & Errands Companion"
            style={{
              boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.06), 0px 2px 6px rgba(0, 0, 0, 0.04)'
            }}
            className="group flex items-center bg-white/95 hover:bg-white text-[#0D1117] pl-3.5 pr-2.5 py-3 rounded-l-2xl border-l border-y border-r-0 border-[#E5E8EC] backdrop-blur-md transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98] hover:border-[#FF5A1F]/40 cursor-pointer"
          >
            {/* Soft Courier Icon Container */}
            <div className="w-8 h-8 rounded-xl bg-[#F0F2F5] group-hover:bg-[#FFF3EC] flex items-center justify-center mr-2.5 shrink-0 transition-colors">
              <Bike className="w-4 h-4 text-[#FF5A1F]" />
            </div>

            {/* Typography & Status Hierarchy */}
            <div className="flex flex-col items-start text-left pr-1">
              <div className="flex items-center space-x-1.5 mb-0.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#0D1117]">
                  WAIRO
                </span>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                  90/10 Payout
                </span>
              </div>
              
              <span className="text-xs font-extrabold text-[#0D1117]/85 leading-snug">
                Courier & Errands
              </span>
              
              {/* Secondary Status Row with Soft Live Pulse Dot */}
              <div className="flex items-center space-x-1.5 mt-1 text-[9.5px] font-mono text-[#0D1117]/55">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="truncate max-w-[130px]">
                  Courier & Errands Only • {selectedLocation.name}
                </span>
              </div>
            </div>

            {/* Subtle Expansion Chevron */}
            <div className="ml-1.5 text-[#0D1117]/40 group-hover:text-[#FF5A1F] group-hover:-translate-x-0.5 transition-all">
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
            zIndex: 45,
            boxShadow: '0px 20px 48px rgba(0, 0, 0, 0.12), 0px 4px 12px rgba(0, 0, 0, 0.06)'
          }} 
          className="w-[94vw] sm:w-[410px] rounded-3xl flex flex-col overflow-hidden border border-[#E5E8EC] bg-white animate-in slide-in-from-right-4 duration-300"
        >
          <div className="relative w-full h-full flex flex-col">
            
            {/* Top drawer header controls */}
            <div className="absolute top-3 right-3 z-50 flex items-center space-x-1.5 bg-white/90 backdrop-blur-md border border-[#E5E8EC] p-1 rounded-full shadow-sm">
              <button
                type="button"
                onClick={() => setIsFullPhoneMode(true)}
                title="Expand to Full Smartphone View"
                className="text-gray-500 hover:text-[#0D1117] p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  playSound('click');
                  setIsOpen(false);
                }}
                title="Dock back to right edge tab"
                className="text-gray-500 hover:text-[#0D1117] p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <WairoMiniApp 
              onOpenTelemetry={() => setIsTelemetryOpen(true)}
              onOpenLocationModal={() => setIsLocationModalOpen(true)}
              onOpenDispatchModal={() => setIsDispatchModalOpen(true)}
              onOpenSDKModal={() => setIsSDKModalOpen(true)}
              onOpenUssdSim={() => setIsUssdOpen(true)}
              onOpenInterCounty={() => setIsInterCountyOpen(true)}
              onOpenCarrierAuction={() => setIsCarrierAuctionOpen(true)}
              onOpenOfflineSync={() => setIsOfflineSyncOpen(true)}
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
        <div 
          style={{ position: 'fixed', inset: 0, zIndex: 50 }} 
          className="bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="relative w-[380px] sm:w-[412px] h-[780px] sm:h-[840px] bg-[#0D1117] rounded-[48px] p-3 shadow-2xl border-4 border-gray-800 ring-8 ring-black/40 flex flex-col">
            
            {/* Top Close / Dock back */}
            <button
              type="button"
              onClick={() => setIsFullPhoneMode(false)}
              className="absolute -top-10 right-0 px-3.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
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
                onOpenUssdSim={() => setIsUssdOpen(true)}
                onOpenInterCounty={() => setIsInterCountyOpen(true)}
                onOpenCarrierAuction={() => setIsCarrierAuctionOpen(true)}
                onOpenOfflineSync={() => setIsOfflineSyncOpen(true)}
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

      {/* ================= USSD / SMS SIMULATOR MODAL ================= */}
      {isUssdOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} className="bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-auto">
            <UssdSimulatorDesk onClose={() => setIsUssdOpen(false)} />
          </div>
        </div>
      )}

      {/* ================= INTER-COUNTY CARGO MODAL ================= */}
      {isInterCountyOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} className="bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-auto">
            <InterCountyDesk onClose={() => setIsInterCountyOpen(false)} />
          </div>
        </div>
      )}

      {/* ================= CARRIER REVERSE AUCTION MODAL ================= */}
      {isCarrierAuctionOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} className="bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-auto">
            <PrivateCarrierAuctionDesk onClose={() => setIsCarrierAuctionOpen(false)} />
          </div>
        </div>
      )}

      {/* ================= OFFLINE SYNC QUEUE MODAL ================= */}
      {isOfflineSyncOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} className="bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-auto">
            <OfflineSyncQueueDesk onClose={() => setIsOfflineSyncOpen(false)} />
          </div>
        </div>
      )}
    </aside>
  );
};

export { WairoBookmark } from './WairoBookmark';
