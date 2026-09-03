import React, { useState } from 'react';
import { 
  Search, 
  Bell, 
  User, 
  MapPin, 
  ChevronDown, 
  ArrowUpRight, 
  Bike, 
  Truck, 
  Footprints, 
  Car, 
  Home, 
  ClipboardList, 
  Send, 
  Mail, 
  ChevronRight,
  ShieldCheck, 
  Volume2, 
  VolumeX, 
  Code,
  TrendingUp,
  Award,
  CheckCircle2,
  DollarSign,
  Briefcase,
  Radio
} from 'lucide-react';
import { 
  WairoDelivery, 
  WairoLocation, 
  WairoMessage,
  LOGISTICS_SERVICES, 
  MOCK_ORDERS, 
  MOCK_MESSAGES, 
  computeAuctionBids, 
  LogisticsType 
} from './wairoData';
import { playSound, toggleSound } from './wairoAudio';

interface WairoMiniAppProps {
  onOpenTelemetry: () => void;
  onOpenLocationModal: () => void;
  onOpenDispatchModal: () => void;
  onOpenSDKModal: () => void;
  onOpenUssdSim?: () => void;
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
  onOpenUssdSim,
  selectedLocation, 
  activeDelivery,
  isMiniView = false,
  onCloseMiniView
}) => {
  const [activeTab, setActiveTab] = useState<'home' | 'orders' | 'deliver' | 'messages' | 'partner'>('home');
  const [messages, setMessages] = useState<WairoMessage[]>(MOCK_MESSAGES);
  const [newMessageText, setNewMessageText] = useState('');
  const [soundOn, setSoundOn] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(2);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [selectedLogisticsType, setSelectedLogisticsType] = useState<LogisticsType>('courier');

  const auctionBids = computeAuctionBids(selectedLogisticsType, selectedLocation);

  const handleSoundToggle = () => {
    const next = toggleSound();
    setSoundOn(next);
    if (next) playSound('click');
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;

    playSound('click');
    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user' as const,
      name: 'You (Client)',
      role: 'Sender / Recipient',
      avatar: '👤',
      time: 'Just now',
      text: newMessageText,
    };

    setMessages(prev => [...prev, userMsg]);
    const userQuery = newMessageText;
    setNewMessageText('');

    setTimeout(() => {
      playSound('message');
      let replyText = `Erick Mwangi (Courier): Nimekupata! Approaching ${selectedLocation.name} via Southern Bypass. ETA ni ${selectedLocation.etaMins} mins. OTP ni 8849.`;
      if (userQuery.toLowerCase().includes('fare') || userQuery.toLowerCase().includes('price') || userQuery.toLowerCase().includes('mpesa')) {
        replyText = `Fare ni KES ${activeDelivery.fareKes}. Payout ya KES ${activeDelivery.driverReturnKes} (90%) itatumwa kwa M-Pesa ukithibitisha OTP.`;
      }

      setMessages(prev => [...prev, {
        id: `pilot-${Date.now()}`,
        sender: 'pilot' as const,
        name: 'Erick Mwangi (Verified Rider)',
        role: 'Courier Partner (90% Payout)',
        avatar: '🛵',
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
        <div className="w-28 h-5 bg-[#0B1B2A] rounded-full flex items-center justify-center px-2 space-x-1.5 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#00BFEF] animate-pulse"></span>
          <span className="text-[9px] font-mono text-white font-bold tracking-wider">WAIRO LOGISTICS</span>
        </div>

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
              setActiveTab('partner');
            }}
            className="w-9 h-9 rounded-full bg-white border border-[#DCE2E6] flex items-center justify-center shadow-xs text-[#0B1B2A] hover:bg-[#DCE2E6]/40 transition-colors cursor-pointer"
            title="Courier & Driver Partner Portal"
          >
            <User className="w-4 h-4 text-[#0B1B2A]" />
          </button>
          
          <div 
            onClick={() => {
              playSound('click');
              setActiveTab('home');
            }}
            className="cursor-pointer flex flex-col items-start"
          >
            <span className="text-xl font-black tracking-tighter text-[#0B1B2A] lowercase font-mono leading-none">
              wai<span className="text-[#00BFEF]">ro</span>
            </span>
            <span className="text-[8px] font-mono font-extrabold uppercase text-[#F58220] tracking-wider">
              Kenyan Logistics & Errands
            </span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleSoundToggle}
            title={soundOn ? 'Sound FX Enabled' : 'Muted'}
            className="w-8 h-8 rounded-full bg-white border border-[#DCE2E6] flex items-center justify-center text-[#0B1B2A] hover:bg-[#DCE2E6]/40 transition-colors cursor-pointer"
          >
            {soundOn ? <Volume2 className="w-3.5 h-3.5 text-[#00BFEF]" /> : <VolumeX className="w-3.5 h-3.5 text-gray-400" />}
          </button>

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

          {isMiniView && onCloseMiniView && (
            <button
              onClick={onCloseMiniView}
              className="px-2 py-1 bg-[#0B1B2A] text-white text-xs font-bold rounded-lg ml-1 cursor-pointer"
            >
              Dock
            </button>
          )}
        </div>
      </div>

      {/* Main Scrollable Canvas */}
      <div className="flex-1 overflow-y-auto px-5 pt-3 pb-24 space-y-4">
        
        {/* ================= VIEW: HOME TAB ================= */}
        {activeTab === 'home' && (
          <div className="space-y-4">
            
            {/* Location Selector Chip */}
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
                <span className="font-semibold">{selectedLocation.zone}</span>
              </div>
            </div>

            {/* Marketplace Headline */}
            <div className="pt-1">
              <h1 className="text-[24px] sm:text-[26px] font-black text-[#0B1B2A] leading-[1.1] tracking-tight">
                Kenyan Courier & Errands.<br />
                <span className="text-[#00BFEF] font-bold">Better Returns for Providers.</span>
              </h1>
              <p className="text-xs text-[#173247]/80 mt-1 leading-relaxed">
                Choose private branded carriers, consolidated cargo, or verified owner-operator couriers.
              </p>
            </div>

            {/* 4 Category Pill Switcher */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {LOGISTICS_SERVICES.map((srv) => {
                const isSelected = selectedLogisticsType === srv.id;
                return (
                  <button
                    key={srv.id}
                    onClick={() => {
                      playSound('click');
                      setSelectedLogisticsType(srv.id);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#0B1B2A] text-white border-[#00BFEF] shadow-lg shadow-[#00BFEF]/20'
                        : 'bg-white border-[#DCE2E6] text-[#0B1B2A] hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        isSelected ? 'bg-[#00BFEF]/20 text-[#00BFEF]' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {srv.badge}
                      </span>
                      {srv.id === 'courier' && <Bike className="w-4 h-4 text-[#F58220]" />}
                      {srv.id === 'consolidated' && <Truck className="w-4 h-4 text-[#00BFEF]" />}
                      {srv.id === 'errands' && <Footprints className="w-4 h-4 text-[#19D8F5]" />}
                      {srv.id === 'wayfarer' && <Car className="w-4 h-4 text-[#FF9D24]" />}
                    </div>

                    <div className="mt-2">
                      <h3 className="font-bold text-xs leading-tight">{srv.title}</h3>
                      <div className="flex items-center justify-between mt-1 text-[10px] font-mono">
                        <span className={isSelected ? 'text-[#F58220] font-bold' : 'text-[#0B1B2A] font-bold'}>
                          From KES {srv.baseKes}
                        </span>
                        <span className="text-emerald-500 font-semibold">{srv.driverSharePercent}% Payout</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Delivery Card with Live Route & Provider Breakdown */}
            <div className="relative rounded-[28px] bg-gradient-to-br from-[#0B1B2A] via-[#173247] to-[#0B1B2A] border border-[#173247] text-white p-4 sm:p-5 shadow-2xl overflow-hidden group">
              
              <div className="flex items-start justify-between border-b border-white/10 pb-3 mb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#00BFEF]/20 border border-[#00BFEF]/40 flex items-center justify-center text-[#00BFEF]">
                    <Bike className="w-4 h-4 text-[#F58220]" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-[#00BFEF] font-bold block">ACTIVE SHIPMENT • {activeDelivery.trackingId}</span>
                    <h3 className="font-bold text-sm text-white">{activeDelivery.carrierType}</h3>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-mono text-emerald-400 font-bold block">90% RIDER PAYOUT</span>
                  <span className="text-xs text-[#F58220] font-mono font-bold">KES {activeDelivery.fareKes} Total</span>
                </div>
              </div>

              {/* Rider & Route Telemetry */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center bg-black/30 p-2.5 rounded-xl border border-white/5">
                  <div>
                    <span className="text-[10px] text-gray-400 block font-mono">ASSIGNED COURIER:</span>
                    <span className="font-bold text-white flex items-center space-x-1">
                      <span>{activeDelivery.courierName}</span>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 inline" />
                    </span>
                    <span className="text-[10px] text-[#00BFEF] font-mono">{activeDelivery.vehicleType} • {activeDelivery.vehiclePlate}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 block font-mono">STATUS:</span>
                    <span className="text-[#00BFEF] font-mono font-bold">{activeDelivery.status} ({activeDelivery.etaMinutes}m ETA)</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-gradient-to-r from-[#00BFEF] to-[#F58220] rounded-full transition-all duration-700"
                    style={{ width: `${activeDelivery.progressPercent}%` }}
                  ></div>
                </div>

                {/* CTA Action */}
                <div className="pt-1 flex gap-2">
                  <button
                    onClick={() => {
                      playSound('radar');
                      onOpenTelemetry();
                    }}
                    className="flex-1 py-2 rounded-xl bg-[#F58220] hover:bg-[#FF9D24] text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-lg shadow-[#F58220]/30 transition-all cursor-pointer"
                  >
                    <span>Track Live Route</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      playSound('click');
                      setActiveTab('messages');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Call / Chat</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Mathematical Reverse-Auction Matcher Showcase */}
            <div className="p-4 rounded-2xl bg-white border border-[#DCE2E6] space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#0B1B2A] flex items-center space-x-1.5">
                    <span>Mathematical Auction Engine</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-100 text-[#00BFEF] font-bold">
                      PRIVATE BIDS
                    </span>
                  </h4>
                  <p className="text-[10px] text-gray-600">
                    Optimal algorithmic matches for {selectedLocation.name} (Calculated via trust, rate & vehicle ownership score)
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {auctionBids.slice(0, 3).map((bid) => (
                  <div 
                    key={bid.providerId}
                    className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between hover:border-[#00BFEF] transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-xs text-[#0B1B2A]">{bid.companyName}</span>
                        {bid.insuranceCovered && (
                          <span className="text-[9px] px-1 rounded bg-emerald-100 text-emerald-700 font-bold">
                            ✓ INSURED
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-600 block">{bid.vehicleModel} • Driver: {bid.driverName}</span>
                      <span className="text-[9px] font-mono text-[#00BFEF] font-bold">
                        ★ {bid.trustScore}% Trust Score • {bid.etaMins}m ETA
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-[#F58220] block">
                        KES {bid.bidPriceKes}
                      </span>
                      <button
                        onClick={() => {
                          playSound('click');
                          onOpenDispatchModal();
                        }}
                        className="mt-1 px-2.5 py-1 rounded-lg bg-[#0B1B2A] hover:bg-[#173247] text-white text-[10px] font-bold cursor-pointer"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Provider Payout Proposition Banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#0B1B2A] to-[#173247] text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#F58220]/20 text-[#F58220] flex items-center justify-center font-bold">
                  90%
                </div>
                <div>
                  <h5 className="font-bold text-xs">Drive / Ride with Wairo</h5>
                  <p className="text-[10px] text-[#DCE2E6]/70">Earn 90% payout on every drop via M-Pesa</p>
                </div>
              </div>

              <button
                onClick={() => {
                  playSound('click');
                  setActiveTab('partner');
                }}
                className="px-3 py-1.5 rounded-xl bg-[#F58220] hover:bg-[#FF9D24] text-white font-bold text-xs cursor-pointer"
              >
                Join Fleet
              </button>
            </div>

          </div>
        )}

        {/* ================= VIEW: ORDERS TAB ================= */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0B1B2A]">Delivery Receipts & History</h2>
              <span className="text-xs font-mono text-[#F58220] font-bold">3 Trips</span>
            </div>

            <div className="space-y-2.5">
              {MOCK_ORDERS.map((order) => (
                <div key={order.id} className="p-3.5 rounded-2xl bg-white border border-[#DCE2E6] space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-gray-500">{order.id} • {order.date}</span>
                      <h4 className="font-bold text-xs text-[#0B1B2A]">{order.items}</h4>
                      <p className="text-[11px] text-gray-600">{order.destination}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-[#0B1B2A]">KES {order.costKes}</span>
                      <span className="block text-[10px] font-bold font-mono" style={{ color: order.statusColor }}>
                        {order.status}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] font-mono text-gray-600">
                    <span>Provider: <strong className="text-[#0B1B2A]">{order.provider}</strong></span>
                    <span className="text-emerald-600">Rider Take: KES {order.driverTakeKes} (90%)</span>
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
              <span className="text-[10px] uppercase font-mono text-[#00BFEF]">Instant Dispatch</span>
              <h2 className="text-base font-bold">Post Parcel or Errand Request</h2>
              <p className="text-xs text-[#DCE2E6]/70">
                Private registered companies and owner-operator couriers will submit algorithmic bids in seconds.
              </p>
              <button
                onClick={() => {
                  playSound('click');
                  onOpenDispatchModal();
                }}
                className="mt-2 w-full py-2.5 rounded-xl bg-[#F58220] hover:bg-[#FF9D24] text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg cursor-pointer"
              >
                <span>Launch New Dispatch Form</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= VIEW: MESSAGES TAB ================= */}
        {activeTab === 'messages' && (
          <div className="flex flex-col h-[420px] space-y-3">
            <div className="flex items-center justify-between border-b border-[#DCE2E6] pb-2">
              <div className="flex items-center space-x-2">
                <span className="text-lg">🛵</span>
                <div>
                  <h4 className="font-bold text-xs text-[#0B1B2A]">Erick Mwangi (Courier Partner)</h4>
                  <span className="text-[10px] text-emerald-600 font-mono">● Active Delivery Comms</span>
                </div>
              </div>
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
                placeholder="Message your courier rider..."
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

        {/* ================= VIEW: PARTNER PORTAL TAB ================= */}
        {activeTab === 'partner' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#0B1B2A] text-white border border-[#173247] space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#00BFEF] to-[#F58220] flex items-center justify-center text-xl font-bold text-white shadow-md">
                  🇰🇪
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Courier & Carrier Hub</h3>
                  <p className="text-[11px] text-[#00BFEF] font-mono">Kenya Logistics Partner Registry</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs font-mono">
                <div className="p-2 rounded-xl bg-black/30">
                  <span className="text-gray-400 block text-[10px]">DRIVER PAYOUT:</span>
                  <span className="text-[#F58220] font-bold">90% of Fare</span>
                </div>
                <div className="p-2 rounded-xl bg-black/30">
                  <span className="text-gray-400 block text-[10px]">DISBURSEMENT:</span>
                  <span className="text-emerald-400 font-bold">Instant M-Pesa</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-[#DCE2E6] space-y-2 text-xs">
              <h4 className="font-bold text-[#0B1B2A] flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Vehicle & Logbook Ownership Boost</span>
              </h4>
              <p className="text-gray-600 text-[11px] leading-relaxed">
                Riders and drivers who own their motorbike, car, or van with a verified logbook receive priority matching in the private reverse-auction script and reduced platform deductions.
              </p>
            </div>

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
                  <h5 className="font-bold text-xs text-[#0B1B2A]">Embed Wairo in Any E-Commerce WebApp</h5>
                  <p className="text-[10px] text-gray-500">React SDK, iFrame, or CDN Script</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {onOpenUssdSim && (
              <button
                type="button"
                onClick={() => {
                  playSound('click');
                  onOpenUssdSim();
                }}
                className="w-full p-3.5 rounded-2xl bg-white border border-emerald-500/40 hover:border-emerald-500 flex items-center justify-between text-left transition-colors cursor-pointer group shadow-xs"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-[#0B1B2A]">Simulate 2G USSD (*483*88#) & SMS</h5>
                    <p className="text-[10px] text-gray-500">For non-smartphone couriers & feature phones</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>
        )}

      </div>

      {/* ================= BOTTOM NAVIGATION BAR DOCK ================= */}
      <div className="absolute bottom-0 left-0 right-0 bg-[#F3F5F4] border-t border-[#DCE2E6] px-4 py-2 flex items-center justify-around z-30 shadow-lg">
        {[
          { id: 'home', label: 'Home', icon: Home },
          { id: 'orders', label: 'Orders', icon: ClipboardList },
          { id: 'deliver', label: 'Book', icon: Bike },
          { id: 'messages', label: 'Comms', icon: Mail },
          { id: 'partner', label: 'Partner', icon: Briefcase },
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
                <span className="font-bold text-[#F58220] block">Private Bid Settled</span>
                <span className="text-[11px] text-gray-300">SwiftLink Rider Erick Mwangi assigned (98.4% Trust).</span>
              </div>
              <div className="p-2 rounded bg-[#173247] border-l-2 border-[#00BFEF]">
                <span className="font-bold text-[#00BFEF] block">Consolidated Batch Ready</span>
                <span className="text-[11px] text-gray-300">Nairobi ➔ Mombasa highway van departs at 2:00 PM.</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
