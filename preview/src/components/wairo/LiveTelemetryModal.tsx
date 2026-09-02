import React, { useEffect, useRef, useState } from 'react';
import { 
  X, 
  Radio, 
  Crosshair, 
  Navigation, 
  ShieldCheck, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  Bike,
  Truck,
  DollarSign,
  TrendingUp,
  Award
} from 'lucide-react';
import { WairoDelivery, WairoLocation } from './wairoData';
import { playSound } from './wairoAudio';

interface LiveTelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDelivery: WairoDelivery;
  selectedLocation: WairoLocation;
}

export const LiveTelemetryModal: React.FC<LiveTelemetryModalProps> = ({ 
  isOpen, 
  onClose, 
  activeDelivery, 
  selectedLocation 
}) => {
  const [activeTab, setActiveTab] = useState<'radar' | 'camera' | 'telemetry'>('radar');
  const [simulatedProgress, setSimulatedProgress] = useState(activeDelivery.progressPercent || 72);
  const [speed, setSpeed] = useState(activeDelivery.speed || 48);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    playSound('open');

    const interval = setInterval(() => {
      setSpeed((prev: number) => Math.min(65, Math.max(35, Math.round(prev + (Math.random() * 4 - 2)))));
      setSimulatedProgress((prev: number) => {
        if (prev >= 98) return 98;
        return +(prev + 0.15).toFixed(1);
      });
    }, 1800);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Canvas route map animation
  useEffect(() => {
    if (!isOpen || activeTab !== 'radar') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let scanPos = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Dark space navy background
      ctx.fillStyle = '#0B1B2A';
      ctx.fillRect(0, 0, width, height);

      // Grid lines
      ctx.strokeStyle = 'rgba(0, 191, 239, 0.12)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Highway route lines (e.g. Southern Bypass / Waiyaki Way)
      ctx.strokeStyle = '#173247';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(40, height - 50);
      ctx.quadraticCurveTo(width * 0.4, 40, width - 50, height * 0.4);
      ctx.stroke();

      // Active GPS route
      ctx.strokeStyle = '#00BFEF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(40, height - 50);
      ctx.quadraticCurveTo(width * 0.4, 40, width - 50, height * 0.4);
      ctx.stroke();

      // Origin Point (CBD Hub)
      ctx.fillStyle = '#00BFEF';
      ctx.beginPath();
      ctx.arc(40, height - 50, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '10px monospace';
      ctx.fillText("Nairobi CBD Depot", 15, height - 30);

      // Destination Point (Lang'ata)
      ctx.fillStyle = '#F58220';
      ctx.beginPath();
      ctx.arc(width - 50, height * 0.4, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(selectedLocation.fullName, width - 130, height * 0.4 - 15);

      // Courier current location interpolation
      const progressFraction = simulatedProgress / 100;
      const t = progressFraction;
      const p0 = { x: 40, y: height - 50 };
      const p1 = { x: width * 0.4, y: 40 };
      const p2 = { x: width - 50, y: height * 0.4 };

      // Quadratic bezier curve interpolation
      const courierX = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
      const courierY = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;

      // Courier pulse marker
      ctx.strokeStyle = 'rgba(245, 130, 32, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(courierX, courierY, 14, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#F58220';
      ctx.beginPath();
      ctx.arc(courierX, courierY, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#19D8F5';
      ctx.fillText(`🛵 ${activeDelivery.courierName} (${speed} km/h)`, courierX + 12, courierY - 8);

      // Scanline effect
      scanPos = (scanPos + 2) % width;
      ctx.strokeStyle = 'rgba(0, 191, 239, 0.2)';
      ctx.beginPath();
      ctx.moveTo(scanPos, 0);
      ctx.lineTo(scanPos, height);
      ctx.stroke();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen, activeTab, simulatedProgress, selectedLocation, speed]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-[#0B1B2A] border border-[#173247] rounded-3xl overflow-hidden shadow-2xl flex flex-col text-white">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#173247] flex items-center justify-between bg-gradient-to-r from-[#0B1B2A] via-[#173247] to-[#0B1B2A]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#00BFEF]/20 border border-[#00BFEF]/40 flex items-center justify-center text-[#00BFEF]">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-lg text-white">Live Courier & Transit Telemetry</h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#F58220]/20 text-[#F58220] border border-[#F58220]/40 font-semibold tracking-wider">
                  GPS ACTIVE
                </span>
              </div>
              <p className="text-xs text-[#DCE2E6]/70">Corridor: {selectedLocation.transitCorridor} • OTP: 8849</p>
            </div>
          </div>

          <button 
            onClick={() => {
              playSound('click');
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* HUD Sub-Tabs */}
        <div className="flex border-b border-[#173247] bg-[#07111a] px-4 pt-2">
          <button
            onClick={() => {
              playSound('click');
              setActiveTab('radar');
            }}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === 'radar' 
                ? 'border-[#00BFEF] text-[#00BFEF] bg-[#00BFEF]/10' 
                : 'border-transparent text-[#DCE2E6]/60 hover:text-white'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>GPS Route Map</span>
          </button>
          
          <button
            onClick={() => {
              playSound('click');
              setActiveTab('camera');
            }}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === 'camera' 
                ? 'border-[#00BFEF] text-[#00BFEF] bg-[#00BFEF]/10' 
                : 'border-transparent text-[#DCE2E6]/60 hover:text-white'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Carrier Dashboard</span>
          </button>

          <button
            onClick={() => {
              playSound('click');
              setActiveTab('telemetry');
            }}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === 'telemetry' 
                ? 'border-[#00BFEF] text-[#00BFEF] bg-[#00BFEF]/10' 
                : 'border-transparent text-[#DCE2E6]/60 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Provider Economics (90%)</span>
          </button>
        </div>

        {/* Modal Main Viewport */}
        <div className="p-5 overflow-y-auto max-h-[75vh] space-y-5">
          
          {/* Main Display Box */}
          <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-[#173247] bg-[#061019] flex items-center justify-center">
            {activeTab === 'radar' && (
              <canvas 
                ref={canvasRef} 
                width={500} 
                height={280} 
                className="w-full h-full object-contain"
              />
            )}

            {activeTab === 'camera' && (
              <div className="relative w-full h-full bg-[#0B1B2A] flex items-center justify-center">
                <img 
                  src="/assets/wairo/wairo_hero.png" 
                  alt="Courier Logistics Vehicle"
                  className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-[#0B1B2A]/40 backdrop-blur-[1px]"></div>
                
                <div className="absolute inset-0 p-4 flex flex-col justify-between pointer-events-none">
                  <div className="flex justify-between items-center text-[10px] font-mono text-[#00BFEF]">
                    <div className="bg-[#0B1B2A]/90 px-2.5 py-1 rounded border border-[#00BFEF]/30 flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      <span>COURIER: {activeDelivery.courierName}</span>
                    </div>
                    <div className="bg-[#0B1B2A]/90 px-2.5 py-1 rounded border border-[#00BFEF]/30">
                      PLATE: {activeDelivery.vehiclePlate}
                    </div>
                  </div>

                  <div className="self-center flex flex-col items-center">
                    <div className="w-20 h-20 border border-[#00BFEF]/60 rounded-full flex items-center justify-center animate-pulse">
                      <Bike className="w-8 h-8 text-[#F58220]" />
                    </div>
                    <span className="text-[10px] font-mono text-[#F58220] mt-1 bg-[#0B1B2A]/80 px-2 rounded">
                      DESTINATION: {selectedLocation.name}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-mono text-[#DCE2E6]">
                    <span>STATUS: IN TRANSIT ({speed} km/h)</span>
                    <span className="text-[#00BFEF]">SECURITY CODE: OTP 8849</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'telemetry' && (
              <div className="w-full h-full p-6 flex flex-col justify-around bg-gradient-to-br from-[#0B1B2A] to-[#173247]">
                <div className="flex items-center justify-between border-b border-[#00BFEF]/20 pb-3">
                  <div className="flex items-center space-x-3">
                    <ShieldCheck className="w-7 h-7 text-[#00BFEF]" />
                    <div>
                      <h4 className="font-bold text-white text-sm">Provider Fair Economics Model</h4>
                      <p className="text-xs text-[#00BFEF]">90% Direct Driver Return vs Uber's ~72%</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-mono font-bold">
                    M-PESA B2C
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-[#DCE2E6]/60 block text-[10px]">TOTAL FARE:</span>
                    <span className="text-white font-bold">KES {activeDelivery.fareKes}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-[#DCE2E6]/60 block text-[10px]">COURIER TAKE (90%):</span>
                    <span className="text-emerald-400 font-bold">KES {activeDelivery.driverReturnKes}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-[#DCE2E6]/60 block text-[10px]">PLATFORM FEE (10%):</span>
                    <span className="text-white font-bold">KES {activeDelivery.platformFeeKes}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-[#DCE2E6]/60 block text-[10px]">VEHICLE OWNERSHIP:</span>
                    <span className="text-[#00BFEF] font-bold">Logbook Verified ✓</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Real-Time Telemetry Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#173247]/60 border border-[#00BFEF]/20 rounded-2xl p-3 flex flex-col items-center text-center">
              <span className="text-[10px] uppercase font-mono text-[#DCE2E6]/70">Transit Speed</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-[#00BFEF]">{speed} km/h</span>
              <span className="text-[10px] text-emerald-400">Road Corridor</span>
            </div>

            <div className="bg-[#173247]/60 border border-[#00BFEF]/20 rounded-2xl p-3 flex flex-col items-center text-center">
              <span className="text-[10px] uppercase font-mono text-[#DCE2E6]/70">Courier Take</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-emerald-400">90%</span>
              <span className="text-[10px] text-emerald-300">KES {activeDelivery.driverReturnKes}</span>
            </div>

            <div className="bg-[#173247]/60 border border-[#00BFEF]/20 rounded-2xl p-3 flex flex-col items-center text-center">
              <span className="text-[10px] uppercase font-mono text-[#DCE2E6]/70">Security OTP</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-[#F58220]">8849</span>
              <span className="text-[10px] text-[#FF9D24]">Release Code</span>
            </div>

            <div className="bg-[#173247]/60 border border-[#00BFEF]/20 rounded-2xl p-3 flex flex-col items-center text-center">
              <span className="text-[10px] uppercase font-mono text-[#DCE2E6]/70">ETA Arrival</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-white">{selectedLocation.etaMins} mins</span>
              <span className="text-[10px] text-[#00BFEF]">To: {selectedLocation.name}</span>
            </div>
          </div>

          {/* Delivery Timeline Progress */}
          <div className="bg-[#173247]/40 border border-[#173247] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <Clock className="w-3.5 h-3.5 text-[#00BFEF]" />
                <span>Transit Progress ({Math.round(simulatedProgress)}%)</span>
              </h4>
              <span className="text-xs text-[#F58220] font-mono font-bold">
                {selectedLocation.distanceKm} km Distance
              </span>
            </div>

            <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden border border-white/5 mb-4">
              <div 
                className="h-full bg-gradient-to-r from-[#00BFEF] via-[#19D8F5] to-[#F58220] rounded-full transition-all duration-700 shadow-lg shadow-[#00BFEF]/30"
                style={{ width: `${simulatedProgress}%` }}
              ></div>
            </div>

            <div className="space-y-3">
              {activeDelivery.timeline.map((step, idx) => (
                <div key={idx} className="flex items-start space-x-3 text-xs">
                  <div className={`mt-0.5 rounded-full p-0.5 ${step.active ? 'text-[#F58220]' : step.done ? 'text-[#00BFEF]' : 'text-gray-500'}`}>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className={`font-semibold ${step.active ? 'text-[#F58220]' : step.done ? 'text-white' : 'text-gray-400'}`}>
                        {step.title}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">{step.time}</span>
                    </div>
                    <p className="text-[11px] text-[#DCE2E6]/70">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Modal Footer CTA */}
        <div className="p-4 border-t border-[#173247] bg-[#07111a] flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-[#DCE2E6]">
            <MapPin className="w-4 h-4 text-[#F58220]" />
            <span>Drop Location: <strong className="text-white">{selectedLocation.fullName}</strong></span>
          </div>

          <button
            onClick={() => {
              playSound('click');
              alert(`OTP 8849 shared with courier rider (${activeDelivery.courierName}). Hand-off confirmed.`);
            }}
            className="px-4 py-2 rounded-xl bg-[#F58220] hover:bg-[#FF9D24] text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-[#F58220]/30 transition-all cursor-pointer"
          >
            <span>Confirm OTP Hand-off</span>
          </button>
        </div>

      </div>
    </div>
  );
};
