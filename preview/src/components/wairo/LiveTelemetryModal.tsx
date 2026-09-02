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
  Volume2
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
  const [simulatedProgress, setSimulatedProgress] = useState(activeDelivery.progressPercent || 68);
  const [altitude, setAltitude] = useState(activeDelivery.altitude || 128);
  const [speed, setSpeed] = useState(activeDelivery.speed || 84);
  const [battery, setBattery] = useState(activeDelivery.battery || 89);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    playSound('open');

    const interval = setInterval(() => {
      setAltitude(prev => Math.min(160, Math.max(90, Math.round(prev + (Math.random() * 4 - 2)))));
      setSpeed(prev => Math.min(96, Math.max(72, Math.round(prev + (Math.random() * 3 - 1.5)))));
      setSimulatedProgress(prev => {
        if (prev >= 98) return 98;
        return +(prev + 0.15).toFixed(1);
      });
    }, 1800);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Canvas radar animation
  useEffect(() => {
    if (!isOpen || activeTab !== 'radar') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let angle = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(centerX, centerY) - 15;

      // Clear with deep space navy
      ctx.fillStyle = '#0B1B2A';
      ctx.fillRect(0, 0, width, height);

      // Draw radar background circles
      ctx.strokeStyle = 'rgba(0, 191, 239, 0.2)';
      ctx.lineWidth = 1;
      for (let r = radius * 0.25; r <= radius; r += radius * 0.25) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw crosshairs
      ctx.beginPath();
      ctx.moveTo(centerX - radius, centerY);
      ctx.lineTo(centerX + radius, centerY);
      ctx.moveTo(centerX, centerY - radius);
      ctx.lineTo(centerX, centerY + radius);
      ctx.stroke();

      // Draw flight path line
      ctx.strokeStyle = 'rgba(245, 130, 32, 0.6)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(centerX - 90, centerY + 60);
      ctx.quadraticCurveTo(centerX - 20, centerY - 40, centerX + 80, centerY - 60);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw destination waypoint (Lang'ata)
      ctx.fillStyle = '#F58220';
      ctx.beginPath();
      ctx.arc(centerX + 80, centerY - 60, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '10px monospace';
      ctx.fillText(selectedLocation.name || "Lang'ata", centerX + 90, centerY - 55);

      // Draw origin
      ctx.fillStyle = '#00BFEF';
      ctx.beginPath();
      ctx.arc(centerX - 90, centerY + 60, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText("Hub Alpha", centerX - 120, centerY + 75);

      // Draw Drone current position
      const progressFraction = simulatedProgress / 100;
      const droneX = (centerX - 90) + (centerX + 80 - (centerX - 90)) * progressFraction;
      const droneY = (centerY + 60) + (centerY - 60 - (centerY + 60)) * progressFraction;

      // Drone pulsing ring
      ctx.strokeStyle = 'rgba(0, 191, 239, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(droneX, droneY, 12, 0, Math.PI * 2);
      ctx.stroke();

      // Drone center dot
      ctx.fillStyle = '#19D8F5';
      ctx.beginPath();
      ctx.arc(droneX, droneY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Drone label
      ctx.fillStyle = '#19D8F5';
      ctx.fillText("⚡ 5Y-WRO", droneX + 12, droneY - 10);

      // Radar Sweep line
      angle += 0.035;
      const sweepX = centerX + radius * Math.cos(angle);
      const sweepY = centerY + radius * Math.sin(angle);

      // Sweep gradient sector
      const sweepGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      sweepGradient.addColorStop(0, 'rgba(0, 191, 239, 0.35)');
      sweepGradient.addColorStop(1, 'rgba(0, 191, 239, 0.0)');

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, angle - 0.5, angle);
      ctx.closePath();
      ctx.fillStyle = sweepGradient;
      ctx.fill();

      // Main sweep line
      ctx.strokeStyle = '#00BFEF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(sweepX, sweepY);
      ctx.stroke();
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen, activeTab, simulatedProgress, selectedLocation]);

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
                <h3 className="font-bold text-lg text-white">Live Quantum Telemetry</h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#F58220]/20 text-[#F58220] border border-[#F58220]/40 font-semibold tracking-wider">
                  LIVE STREAM
                </span>
              </div>
              <p className="text-xs text-[#DCE2E6]/70">Drone 5Y-WRO • Sector Corridor: {selectedLocation.droneCorridor}</p>
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
            <span>Airspace Radar</span>
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
            <span>Pilot Optical Cam</span>
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
            <span>Quantum Security</span>
          </button>
        </div>

        {/* Modal Main Viewport */}
        <div className="p-5 overflow-y-auto max-h-[75vh] space-y-5">
          
          {/* Main Visual Display */}
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
                  src="/assets/wairo/wairo_mobile_ui.png" 
                  alt="Pilot Camera HUD"
                  className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-[#0B1B2A]/40 backdrop-blur-[1px]"></div>
                
                {/* HUD Overlay Graphics */}
                <div className="absolute inset-0 p-4 flex flex-col justify-between pointer-events-none">
                  <div className="flex justify-between items-center text-[10px] font-mono text-[#00BFEF]">
                    <div className="bg-[#0B1B2A]/90 px-2.5 py-1 rounded border border-[#00BFEF]/30 flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                      <span>LIVE FEED // 4K OPTICAL</span>
                    </div>
                    <div className="bg-[#0B1B2A]/90 px-2.5 py-1 rounded border border-[#00BFEF]/30">
                      GRID: {selectedLocation.coordinates}
                    </div>
                  </div>

                  {/* Crosshair Target */}
                  <div className="self-center flex flex-col items-center">
                    <div className="w-20 h-20 border border-[#00BFEF]/60 rounded-full flex items-center justify-center animate-pulse">
                      <div className="w-3 h-3 bg-[#F58220] rounded-full"></div>
                    </div>
                    <span className="text-[10px] font-mono text-[#F58220] mt-1 bg-[#0B1B2A]/80 px-2 rounded">
                      DESTINATION LOCK: {selectedLocation.name}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-mono text-[#DCE2E6]">
                    <span>PILOT: CAPTAIN KAEL</span>
                    <span className="text-[#00BFEF]">STABILIZER: 100% OK</span>
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
                      <h4 className="font-bold text-white text-sm">Quantum Encryption Handshake</h4>
                      <p className="text-xs text-[#00BFEF]">4096-bit AES Elliptic Curve Key</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-[#00BFEF]/20 text-[#00BFEF] rounded-full text-xs font-mono font-bold">
                    VERIFIED SECURE
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-[#DCE2E6]/60 block text-[10px]">DROP ZONE AUTH:</span>
                    <span className="text-white font-bold">NFC Handshake Confirmed</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-[#DCE2E6]/60 block text-[10px]">CORRIDOR RADAR:</span>
                    <span className="text-emerald-400 font-bold">No Bird / Drone Conflict</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-[#DCE2E6]/60 block text-[10px]">BAROMETRIC SENSOR:</span>
                    <span className="text-white font-bold">1013.25 hPa (Optimal)</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-[#DCE2E6]/60 block text-[10px]">ESTIMATED WIND:</span>
                    <span className="text-[#00BFEF] font-bold">4 kts South-East</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Real-Time Telemetry Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#173247]/60 border border-[#00BFEF]/20 rounded-2xl p-3 flex flex-col items-center text-center">
              <span className="text-[10px] uppercase font-mono text-[#DCE2E6]/70">Altitude</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-[#00BFEF]">{altitude} m</span>
              <span className="text-[10px] text-emerald-400">Above Ground Level</span>
            </div>

            <div className="bg-[#173247]/60 border border-[#00BFEF]/20 rounded-2xl p-3 flex flex-col items-center text-center">
              <span className="text-[10px] uppercase font-mono text-[#DCE2E6]/70">Air Speed</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-[#F58220]">{speed} km/h</span>
              <span className="text-[10px] text-[#FF9D24]">Cruising Mode</span>
            </div>

            <div className="bg-[#173247]/60 border border-[#00BFEF]/20 rounded-2xl p-3 flex flex-col items-center text-center">
              <span className="text-[10px] uppercase font-mono text-[#DCE2E6]/70">Battery Pack</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-emerald-400">{battery}%</span>
              <span className="text-[10px] text-emerald-300">Dual Li-Solid Core</span>
            </div>

            <div className="bg-[#173247]/60 border border-[#00BFEF]/20 rounded-2xl p-3 flex flex-col items-center text-center">
              <span className="text-[10px] uppercase font-mono text-[#DCE2E6]/70">ETA Arrival</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-white">{selectedLocation.etaMins} mins</span>
              <span className="text-[10px] text-[#00BFEF]">Target: {selectedLocation.name}</span>
            </div>
          </div>

          {/* Delivery Timeline Progress */}
          <div className="bg-[#173247]/40 border border-[#173247] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <Clock className="w-3.5 h-3.5 text-[#00BFEF]" />
                <span>Flight Route Progress ({Math.round(simulatedProgress)}%)</span>
              </h4>
              <span className="text-xs text-[#F58220] font-mono font-bold">
                {selectedLocation.distanceKm} km Total Distance
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
              playSound('radar');
              alert(`Sounding precision landing beacon at ${selectedLocation.fullName}! Hover-drone aligned.`);
            }}
            className="px-4 py-2 rounded-xl bg-[#F58220] hover:bg-[#FF9D24] text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-[#F58220]/30 transition-all cursor-pointer"
          >
            <span>Activate Drop Beacon</span>
            <Radio className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
