import React, { useState } from 'react';
import { 
  Search, 
  Bell, 
  User, 
  MapPin, 
  ChevronDown, 
  ArrowUpRight, 
  Rocket, 
  Plane, 
  Box, 
  Home, 
  ClipboardList, 
  Send, 
  Mail, 
  ChevronRight,
  QrCode, 
  Volume2, 
  VolumeX, 
  Code
} from 'lucide-react';
import { WairoDelivery, WairoLocation, SERVICES, MOCK_ORDERS, MOCK_MESSAGES, WairoMessage } from './wairoData';
import { playSound, toggleSound } from './wairoAudio';

interface WairoMiniAppProps {
  onOpenTelemetry: () => void;
  onOpenLocationModal: () => void;
  onOpenDispatchModal: () => void;
  onOpenSDKModal: () => void;
  selectedLocation: WairoLocation;
  activeDelivery: WairoDelivery;
  isMiniView?: boolean;
  onCloseMiniView?: () => void;
}

export const WairoMiniApp: React.FC<WairoMiniAppProps> = ({ 
  onOpenTelemetry, 
  onOpenLocationModal, 
  onOpenDispatchModal, 
  onOpenSDKModal,
  selectedLocation, 
  activeDelivery,
  isMiniView = false,
  onCloseMiniView
}) => {
  const [activeTab, setActiveTab] = useState<'home' | 'orders' | 'deliver' | 'messages' | 'account'>('home');
  const [messages, setMessages] = useState<WairoMessage[]>(MOCK_MESSAGES);
  const [newMessageText, setNewMessageText] = useState('');
  const [soundOn, setSoundOn] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(2);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);

  const handleSoundToggle = () => {
    const next = toggleSound();
    setSoundOn(next);
    if (next) playSound('click');
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;

    playSound('click');
    const userMsg: WairoMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      name: 'You (Drop Hub)',
      role: 'Client',
      avatar: '👤',
      time: 'Just now',
      text: newMessageText,
    };

    setMessages(prev => [...prev, userMsg]);
    const userQuery = newMessageText;
    setNewMessageText('');

    setTimeout(() => {
      playSound('message');
      let replyText = `Captain Kael here: Roger that on "${userQuery}". Approaching ${selectedLocation.name} corridor at 84 km/h. Landing beacon active.`;
      if (userQuery.toLowerCase().includes('eta') || userQuery.toLowerCase().includes('time')) {
        replyText = `Telemetry indicates ${selectedLocation.etaMins} minutes remaining until touchdown at ${selectedLocation.fullName}.`;
      } else if (userQuery.toLowerCase().includes('package') || userQuery.toLowerCase().includes('order')) {
        replyText = `Your shipment (${activeDelivery.packageSummary}) is sealed inside Pod 4 with active NFC beacon.`;
      }

      setMessages(prev => [...prev, {
        id: `pilot-${Date.now()}`,
        sender: 'pilot',
        name: 'Captain Kael',
        role: 'Quantum Express Pilot',
        avatar: '👨‍🚀',
        time: 'Just now',
        text: replyText,
      }]);
    }, 1000);
  };

  return (
    <div className="relative w-full h-full bg-[#F3F5F4] text-[#0B1B2A] flex flex-col font-sans select-none overflow-hidden rounded-[38px] shadow-2xl border border-[#DCE2E6]">
      
      {/* Phone Status Bar */}
      <div className="pt-3 px-6 pb-2 flex items-center justify-between text-[#0B1B2A] text-xs font-semibold tracking-tight z-20">
        <span className="font-mono text-[13px] font-bold">10:09</span>
        
        {/* Dynamic Island Pill */}
        <div className="w-24 h-5 bg-[#0B1B2A] rounded-full flex items-center justify-center px-2 space-x-1.5 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#00BFEF] animate-pulse"></span>
          <span className="text-[9px] font-mono text-white font-bold tracking-wider">WAIRO LIVE</span>
        </div>

        {/* Status Icons */}
        <div className="flex items-center space-x-1.5 text-[11px]">
          <span>5G</span>
          <div className="w-4 h-2 border border-[#0B1B2A] rounded-sm p-0.5 flex items-center">
            <div className="w-full h-full bg-[#0B1B2A] rounded-2xs"></div>
          </div>
        </div>
      </div>

      {/* Mini App Top Header Bar */}
      <div className="px-5 py-2.5 flex items-center justify-between bg-[#F3F5F4] border-b border-[#DCE2E6]/60 z-20">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => {
              playSound('click');
              setActiveTab('account');
            }}
            className="w-9 h-9 rounded-full bg-white border border-[#DCE2E6] flex items-center justify-center shadow-xs text-[#0B1B2A] hover:bg-[#DCE2E6]/40 transition-colors cursor-pointer"
          >
            <User className="w-4 h-4 text-[#0B1B2A]" />
          </button>
          
          {/* Stylized Brand Logo */}
          <div 
            onClick={() => {
              playSound('click');
              setActiveTab('home');
            }}
            className="cursor-pointer flex items-center space-x-1"
          >
            <span className="text-xl font-black tracking-tighter text-[#0B1B2A] lowercase font-mono">
              wai<span className="text-[#00BFEF]">ro</span>
            </span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center space-x-2">
          {/* Sound Toggle */}
          <button
            onClick={handleSoundToggle}
            title={soundOn ? 'Sound FX Enabled' : 'Muted'}
            className="w-8 h-8 rounded-full bg-white border border-[#DCE2E6] flex items-center justify-center text-[#0B1B2A] hover:bg-[#DCE2E6]/40 transition-colors cursor-pointer"
          >
            {soundOn ? <Volume2 className="w-3.5 h-3.5 text-[#00BFEF]" /> : <VolumeX className="w-3.5 h-3.5 text-gray-400" />}
          </button>

          {/* Search Button */}
          <button 
            onClick={() => {
              playSound('click');
              setShowSearchModal(true);
            }}
            className="w-8 h-8 rounded-full bg-white border border-[#DCE2E6] flex items-center justify-center text-[#0B1B2A] hover:bg-[#DCE2E6]/40 transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-[#0B1B2A]" />
          </button>

          {/* Notification Bell with Badge */}
          <button 
            onClick={() => {
              playSound('click');
              setShowNotificationsModal(true);
              setUnreadNotifications(0);
            }}
            className="relative w-8 h-8 rounded-full bg-white border border-[#DCE2E6] flex items-center justify-center text-[#0B1B2A] hover:bg-[#DCE2E6]/40 transition-colors cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5 text-[#0B1B2A]" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#F58220] text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                {unreadNotifications}
              </span>
            )}
          </button>

          {/* If embedded in mini-drawer mode, show dock */}
          {isMiniView && onCloseMiniView && (
            <button
              onClick={onCloseMiniView}
              className="px-2 py-1 bg-[#0B1B2A] text-white text-xs font-bold rounded-lg ml-1"
            >
              Dock
            </button>
          )}
        </div>
      </div>

      {/* Main Scrollable App Canvas */}
      <div className="flex-1 overflow-y-auto px-5 pt-3 pb-24 space-y-4">
        
        {/* ================= VIEW: HOME TAB ================= */}
        {activeTab === 'home' && (
          <div className="space-y-4">
            
            {/* Top Location Selector Chip */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  playSound('click');
                  onOpenLocationModal();
                }}
                className="flex items-center space-x-2 bg-[#F58220] hover:bg-[#FF9D24] text-white px-4 py-2 rounded-full font-bold text-xs shadow-md shadow-[#F58220]/25 transition-all cursor-pointer group"
              >
                <MapPin className="w-3.5 h-3.5 text-white" />
                <span>{selectedLocation.name}</span>
                <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
              </button>

              <div className="flex items-center space-x-1.5 text-[11px] font-mono text-[#173247]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="font-semibold">{selectedLocation.etaMins}m Corridor Lock</span>
              </div>
            </div>

            {/* Main Punchy Typography Hero */}
            <div className="pt-1">
              <h1 className="text-[26px] sm:text-[28px] font-black text-[#0B1B2A] leading-[1.1] tracking-tight">
                Quantum-Speed Delivery.<br />
                <span className="text-[#0B1B2A]/80 font-bold">Effortless Living.</span>
              </h1>
            </div>

            {/* 3 Horizontal Service Cards */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {SERVICES.slice(0, 3).map((service, idx) => (
                <div
                  key={service.id}
                  onClick={() => {
                    playSound('click');
                    onOpenDispatchModal();
                  }}
                  className="bg-[#0B1B2A] hover:bg-[#173247] rounded-2xl p-3 text-white flex flex-col justify-between border border-[#173247] shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer min-h-[145px]"
                >
                  <div className="flex justify-between items-start">
                    <div className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center text-[#00BFEF]">
                      {idx === 0 && <Rocket className="w-4 h-4 text-[#F58220]" />}
                      {idx === 1 && <Plane className="w-4 h-4 text-[#00BFEF]" />}
                      {idx === 2 && <Box className="w-4 h-4 text-[#19D8F5]" />}
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#DCE2E6]/60" />
                  </div>

                  <div className="mt-2">
                    <h3 className="text-xs font-bold leading-snug">{service.title}</h3>
                    <p className="text-[9px] text-[#DCE2E6]/70 line-clamp-2 mt-1 leading-tight font-sans">
                      {service.shortDesc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Large Active Delivery Hero Card */}
            <div className="relative rounded-[28px] bg-gradient-to-br from-[#0B1B2A] via-[#173247] to-[#0B1B2A] border border-[#173247] text-white p-4 sm:p-5 shadow-2xl overflow-hidden group">
              
              <div className="flex items-center space-x-3 sm:space-x-4">
                
                {/* Character Portrait */}
                <div className="relative w-24 sm:w-28 h-32 sm:h-36 rounded-2xl overflow-hidden border border-[#00BFEF]/40 shadow-lg bg-[#061019] flex-shrink-0">
                  <img 
                    src="/assets/wairo/wairo_mobile_ui.png" 
                    alt="Wairo Astronaut Pilot"
                    className="w-full h-full object-cover object-top scale-125 translate-y-1"
                  />
                  <div className="absolute bottom-1 left-1 right-1 bg-black/70 backdrop-blur-xs rounded-md px-1.5 py-0.5 text-[8px] font-mono text-[#00BFEF] text-center font-bold">
                    PILOT KAEL
                  </div>
                </div>

                {/* Delivery Information & Telemetry */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <h2 className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight">
                    Your Current<br />
                    <span className="text-[#00BFEF]">Wairo</span> Delivery
                  </h2>

                  <div className="pt-0.5">
                    <span className="text-[10px] uppercase font-mono text-[#DCE2E6]/70 block">Status:</span>
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#00BFEF] animate-ping"></span>
                      <span className="text-xs font-black font-mono tracking-wider text-[#00BFEF]">
                        {activeDelivery.status}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden border border-white/5">
                    <div 
                      className="h-full bg-gradient-to-r from-[#00BFEF] to-[#19D8F5] rounded-full transition-all duration-700"
                      style={{ width: `${activeDelivery.progressPercent}%` }}
                    ></div>
                  </div>

                  {/* Destination */}
                  <div className="pt-0.5">
                    <span className="text-[10px] uppercase font-mono text-[#DCE2E6]/70 block">Destination:</span>
                    <span className="text-xs font-bold text-white truncate block">
                      {selectedLocation.fullName || activeDelivery.destination}
                    </span>
                  </div>

                  {/* Track Live CTA Button */}
                  <div className="pt-1">
                    <button
                      onClick={() => {
                        playSound('radar');
                        onOpenTelemetry();
                      }}
                      className="w-full py-2 px-3.5 rounded-xl bg-[#F58220] hover:bg-[#FF9D24] text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-lg shadow-[#F58220]/30 transition-all cursor-pointer"
                    >
                      <span>Track Live</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Quick Dispatch Action Banner */}
            <div className="p-4 rounded-2xl bg-white border border-[#DCE2E6] flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#00BFEF]/15 text-[#00BFEF] flex items-center justify-center">
                  <Rocket className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#0B1B2A]">Need something delivered?</h4>
                  <p className="text-[10px] text-[#173247]/70">Dispatch a drone to any Nairobi sector</p>
                </div>
              </div>

              <button
                onClick={() => {
                  playSound('click');
                  onOpenDispatchModal();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-[#0B1B2A] hover:bg-[#173247] text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                Send Now
              </button>
            </div>

          </div>
        )}

        {/* ================= VIEW: ORDERS TAB ================= */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0B1B2A]">Your Delivery Activity</h2>
              <span className="text-xs font-mono text-[#F58220] font-bold">3 Shipments</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#0B1B2A] text-white border border-[#173247] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00BFEF]/20 text-[#00BFEF] font-bold">
                  ACTIVE FLIGHT • {activeDelivery.trackingId}
                </span>
                <span className="text-xs text-[#F58220] font-bold">ETA: {selectedLocation.etaMins} mins</span>
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">{activeDelivery.packageSummary}</h4>
                <p className="text-xs text-[#DCE2E6]/70">{selectedLocation.fullName}</p>
              </div>
              <button
                onClick={() => {
                  playSound('radar');
                  onOpenTelemetry();
                }}
                className="w-full py-2 bg-[#F58220] text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <span>View Full Telemetry & Radar</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#173247]/70">Completed Drops</h3>
              {MOCK_ORDERS.filter(o => !o.isLive).map((order) => (
                <div key={order.id} className="p-3.5 rounded-2xl bg-white border border-[#DCE2E6] flex items-center justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">
                      ✓
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-gray-500">{order.id} • {order.date}</span>
                      <h5 className="font-bold text-xs text-[#0B1B2A]">{order.items}</h5>
                      <span className="text-[11px] text-gray-600">{order.destination}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-[#0B1B2A]">KES {order.costKes}</span>
                    <span className="block text-[10px] text-emerald-600 font-semibold">{order.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= VIEW: DELIVER TAB ================= */}
        {activeTab === 'deliver' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0B1B2A] to-[#173247] text-white space-y-2">
              <span className="text-[10px] uppercase font-mono text-[#00BFEF]">Instant Air Transport</span>
              <h2 className="text-base font-bold">Book Aerial Courier Pod</h2>
              <p className="text-xs text-[#DCE2E6]/70">Sub-orbital drone corridor delivery across Nairobi.</p>
              <button
                onClick={() => {
                  playSound('click');
                  onOpenDispatchModal();
                }}
                className="mt-2 w-full py-2.5 rounded-xl bg-[#F58220] hover:bg-[#FF9D24] text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg cursor-pointer"
              >
                <Rocket className="w-4 h-4" />
                <span>Launch New Dispatch Form</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= VIEW: MESSAGES TAB ================= */}
        {activeTab === 'messages' && (
          <div className="flex flex-col h-[420px] space-y-3">
            <div className="flex items-center justify-between border-b border-[#DCE2E6] pb-2">
              <div className="flex items-center space-x-2">
                <span className="text-lg">👨‍🚀</span>
                <div>
                  <h4 className="font-bold text-xs text-[#0B1B2A]">Captain Kael & AI Comms</h4>
                  <span className="text-[10px] text-emerald-600 font-mono">● Encrypted Channel</span>
                </div>
              </div>
              <button
                onClick={() => {
                  playSound('radar');
                  onOpenTelemetry();
                }}
                className="text-[10px] font-mono text-[#00BFEF] hover:underline"
              >
                HUD Live
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 p-1">
              {messages.map((m) => {
                const isUser = m.sender === 'user';
                return (
                  <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl p-3 text-xs ${
                      isUser 
                        ? 'bg-[#F58220] text-white rounded-br-xs' 
                        : 'bg-[#0B1B2A] text-white rounded-bl-xs border border-[#173247]'
                    }`}>
                      <div className="flex items-center justify-between text-[10px] opacity-75 mb-1">
                        <span>{m.name}</span>
                        <span>{m.time}</span>
                      </div>
                      <p className="leading-relaxed">{m.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSendMessage} className="flex items-center space-x-2 pt-2 border-t border-[#DCE2E6]">
              <input
                type="text"
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                placeholder="Message hover pilot..."
                className="flex-1 bg-white border border-[#DCE2E6] rounded-xl px-3 py-2 text-xs text-[#0B1B2A] focus:outline-none focus:border-[#00BFEF]"
              />
              <button
                type="submit"
                className="p-2.5 rounded-xl bg-[#0B1B2A] text-white hover:bg-[#173247] transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* ================= VIEW: ACCOUNT TAB ================= */}
        {activeTab === 'account' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#0B1B2A] text-white border border-[#173247] space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#00BFEF] to-[#F58220] flex items-center justify-center text-xl font-bold text-white shadow-md">
                  W
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Wairo Prime Member</h3>
                  <p className="text-[11px] text-[#00BFEF] font-mono">ID: #WR-NAIROBI-8849</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  playSound('click');
                  onOpenSDKModal();
                }}
                className="w-full p-3.5 rounded-2xl bg-white border border-[#00BFEF]/40 hover:border-[#00BFEF] flex items-center justify-between text-left transition-colors cursor-pointer group shadow-xs"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-[#00BFEF]/15 text-[#00BFEF] flex items-center justify-center">
                    <Code className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-[#0B1B2A]">Embed Wairo in Another WebApp</h5>
                    <p className="text-[10px] text-gray-500">Get React SDK, iFrame, or CDN Script</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ================= BOTTOM NAVIGATION BAR DOCK ================= */}
      <div className="absolute bottom-0 left-0 right-0 bg-[#F3F5F4] border-t border-[#DCE2E6] px-4 py-2 flex items-center justify-around z-30 shadow-lg">
        {[
          { id: 'home', label: 'Home', icon: Home },
          { id: 'orders', label: 'Orders', icon: ClipboardList },
          { id: 'deliver', label: 'Deliver', icon: Rocket },
          { id: 'messages', label: 'Messages', icon: Mail },
          { id: 'account', label: 'Account', icon: User },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                playSound('click');
                setActiveTab(tab.id as any);
              }}
              className={`flex flex-col items-center justify-center py-1 px-3 relative transition-all cursor-pointer ${
                isActive ? 'text-[#0B1B2A]' : 'text-[#0B1B2A]/50 hover:text-[#0B1B2A]/80'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {isActive && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#00BFEF] animate-ping"></span>
                )}
              </div>
              <span className={`text-[10px] mt-1 font-semibold ${isActive ? 'font-bold text-[#0B1B2A]' : ''}`}>
                {tab.label}
              </span>
              
              {isActive && (
                <span className="absolute -bottom-2 w-7 h-1 bg-[#F58220] rounded-full"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notifications Modal */}
      {showNotificationsModal && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0B1B2A] border border-[#173247] rounded-2xl p-4 w-full max-w-xs text-white space-y-3">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <span className="font-bold text-xs text-white">Notifications</span>
              <button 
                onClick={() => setShowNotificationsModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="p-2 rounded bg-[#173247] border-l-2 border-[#F58220]">
                <span className="font-bold text-[#F58220] block">Corridor Cleared</span>
                <span className="text-[11px] text-gray-300">Hover-drone 5Y-WRO cleared for {selectedLocation.name} airspace.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Modal */}
      {showSearchModal && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0B1B2A] border border-[#173247] rounded-2xl p-4 w-full max-w-xs text-white space-y-3">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <span className="font-bold text-xs text-white">Search Wairo Hub</span>
              <button 
                onClick={() => setShowSearchModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search drops, orders, locations..."
              className="w-full bg-[#173247] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00BFEF]"
            />
          </div>
        </div>
      )}

    </div>
  );
};
