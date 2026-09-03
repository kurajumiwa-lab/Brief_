import React, { useState } from 'react';
import {
  Trophy,
  Users,
  Search,
  Bell,
  Radio,
  Sparkles,
  Truck,
  Car,
  Bike,
  Flame,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Plus,
  X,
  Phone,
  Package,
  Clock,
  Layers,
  ChevronRight,
  ChevronDown,
  Database,
  ArrowRight,
  Lock,
  Zap,
  Award,
  Wallet,
  Menu,
  RotateCcw
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';
import { OneXbetSlipDrawer, SlipItem } from './OneXbetSlipDrawer';
import { OneXbetMatchTracker, LiveMatchTrackerData } from './OneXbetMatchTracker';
import '../../styles/oneXbetTheme.css';

export interface OneXbetWrapperProps {
  onOpenClassicApp?: () => void;
  onOpenUssdSim?: () => void;
  onOpenInterCounty?: () => void;
  onOpenCarrierAuction?: () => void;
  onOpenOfflineSync?: () => void;
  onOpenChama?: () => void;
  onOpenArenaClan?: () => void;
  onOpenCivicGuide?: () => void;
  onOpenMayorAi?: () => void;
  selectedCounty?: string;
  onSelectCounty?: (county: string) => void;
}

export function OneXbetWrapper({
  onOpenClassicApp,
  onOpenUssdSim,
  onOpenInterCounty,
  onOpenCarrierAuction,
  onOpenOfflineSync,
  onOpenChama,
  onOpenArenaClan,
  onOpenCivicGuide,
  onOpenMayorAi,
  selectedCounty = 'Nairobi',
  onSelectCounty
}: OneXbetWrapperProps) {
  const [activeNavTab, setActiveNavTab] = useState<'sports' | 'live' | 'slip' | 'history' | 'menu'>('sports');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [balanceKes, setBalanceKes] = useState<number>(3450);

  // Brief Slip state
  const [slipItems, setSlipItems] = useState<SlipItem[]>([
    {
      id: 'item-1',
      category: 'arena_stake',
      matchTitle: 'EA FC 24: Kevo Ghost vs SwahiliNinja',
      selectionName: 'Kevo Ghost (Win)',
      oddsMultiplier: 1.85,
      stakeKes: 250
    }
  ]);
  const [isSlipDrawerOpen, setIsSlipDrawerOpen] = useState(false);

  // Live Match Tracker state
  const [activeTrackerMatch, setActiveTrackerMatch] = useState<LiveMatchTrackerData | null>(null);

  // Sample Live Matches data
  const liveMatches: LiveMatchTrackerData[] = [
    {
      id: 'match-efc-1',
      gameTitle: 'EA FC 24 Mobile • Nairobi Derby',
      roomCode: 'EFC-9941',
      team1: { name: 'Kevo Ghost [NBO]', tag: '#1 Nairobi', score: 2, avatar: '🦁' },
      team2: { name: 'SwahiliNinja [MSA]', tag: '#2 Coastal', score: 1, avatar: '🦈' },
      minute: 68,
      matchEvent: 'Dangerous Attack',
      attackVectorX: 74,
      attackVectorY: 42,
      possessionTeam: 1,
      stakePotKes: 1800
    },
    {
      id: 'match-pubg-2',
      gameTitle: 'PUBG Mobile • 4v4 Scrims Warehouse',
      roomCode: 'PBG-7712',
      team1: { name: 'Mombasa Sharks', tag: '[MSA]', score: 18, avatar: '🌊' },
      team2: { name: 'Eldoret Titans', tag: '[ELD]', score: 16, avatar: '⚡' },
      minute: 12,
      matchEvent: 'Shot on Target',
      attackVectorX: 52,
      attackVectorY: 60,
      possessionTeam: 1,
      stakePotKes: 900
    }
  ];

  const handleAddOddsToSlip = (
    category: SlipItem['category'],
    matchTitle: string,
    selectionName: string,
    oddsMultiplier: number
  ) => {
    soundEngine.play('heavyTap');
    const existingIndex = slipItems.findIndex(i => i.matchTitle === matchTitle && i.selectionName === selectionName);
    if (existingIndex >= 0) {
      setSlipItems(prev => prev.filter((_, i) => i !== existingIndex));
      return;
    }

    const newItem: SlipItem = {
      id: `slip-${Date.now()}`,
      category,
      matchTitle,
      selectionName,
      oddsMultiplier,
      stakeKes: 250
    };
    setSlipItems(prev => [newItem, ...prev]);
  };

  const isSelectionInSlip = (matchTitle: string, selectionName: string) => {
    return slipItems.some(i => i.matchTitle === matchTitle && i.selectionName === selectionName);
  };

  return (
    <div className="onex-app-shell flex flex-col pb-24 select-none">
      
      {/* ================= 1XBET TOP APP BAR ================= */}
      <header className="bg-[#07121E] border-b border-[#203A60] px-4 py-3 sticky top-0 z-40 flex items-center justify-between shadow-lg">
        
        {/* Brand Logo & County Selector */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-[#11233B] px-3 py-1.5 rounded-xl border border-[#203A60]">
            <span className="font-mono font-black text-xs text-[#00BFEF] tracking-tighter">1X</span>
            <span className="font-mono font-black text-xs text-white tracking-tight">BRIEF</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#00D26A] animate-pulse" />
          </div>

          <div className="hidden sm:flex items-center space-x-1 bg-[#0D1C2E] px-2.5 py-1 rounded-xl border border-[#203A60] text-xs font-mono">
            <span className="text-gray-400">Hub:</span>
            <span className="font-bold text-white">{selectedCounty}</span>
          </div>
        </div>

        {/* Search, Balance Pill & Classic Switcher */}
        <div className="flex items-center space-x-2">
          
          {/* M-Pesa Balance Pill */}
          <div className="flex items-center space-x-1.5 bg-[#11233B] border border-[#203A60] px-3 py-1.5 rounded-xl text-xs font-mono">
            <Wallet className="w-3.5 h-3.5 text-[#00D26A]" />
            <span className="font-bold text-white">KES {balanceKes.toLocaleString()}</span>
            <button
              type="button"
              onClick={() => {
                soundEngine.play('reward');
                setBalanceKes(prev => prev + 500);
              }}
              className="bg-[#00D26A] hover:bg-[#00ba5e] text-[#07121E] px-1.5 py-0.2 rounded font-black text-[10px] cursor-pointer"
              title="Top up M-Pesa"
            >
              +TOPUP
            </button>
          </div>

          {/* Classic Brief UI Toggle */}
          {onOpenClassicApp && (
            <button
              type="button"
              onClick={() => { soundEngine.play('tap'); onOpenClassicApp(); }}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-[10px] font-bold cursor-pointer transition-colors flex items-center space-x-1"
              title="Switch to Classic Brief View"
            >
              <RotateCcw className="w-3 h-3 text-[#00BFEF]" />
              <span className="hidden sm:inline">Classic Brief</span>
            </button>
          )}

        </div>
      </header>

      {/* ================= 1XBET SPORTS & CATEGORY RIBBON ================= */}
      <div className="bg-[#0D1C2E] border-b border-[#203A60] px-4 py-2.5 overflow-x-auto flex items-center space-x-2 scrollbar-none">
        {[
          { id: 'all', label: '⚽ Top Sports & Hubs', count: 12 },
          { id: 'arena', label: '🎮 Esports 1v1 & Scrims', action: onOpenArenaClan },
          { id: 'wairo', label: '🛵 Wairo Silent Auction', action: onOpenCarrierAuction },
          { id: 'intercounty', label: '🚚 Inter-County Cargo', action: onOpenInterCounty },
          { id: 'chama', label: '🌸 Chama Merry-Go-Round', action: onOpenChama },
          { id: 'ussd', label: '📻 2G USSD (*483*88#)', action: onOpenUssdSim },
          { id: 'offline', label: '💾 Offline PWA Sync', action: onOpenOfflineSync },
          { id: 'civic', label: '🏛️ Civic Guides', action: onOpenCivicGuide }
        ].map(cat => (
          <button
            key={cat.id}
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              setActiveCategory(cat.id);
              cat.action?.();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeCategory === cat.id
                ? 'bg-[#00BFEF] text-[#07121E] font-black shadow-md shadow-[#00BFEF]/30'
                : 'bg-[#162B48] text-gray-200 hover:bg-[#1C3558] border border-[#203A60]'
            }`}
          >
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* ================= MAIN CONTENT CANVAS ================= */}
      <main className="max-w-4xl w-full mx-auto p-4 sm:p-5 space-y-6">
        
        {/* ================= SECTION 1: 1XBET LIVE IN-PLAY MATCHES ================= */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <h2 className="font-mono font-black text-sm uppercase tracking-wider text-white">
                Live In-Play Esports & Matchmaking
              </h2>
            </div>
            <span className="text-[10px] font-mono text-[#00BFEF] font-bold">2 Live Matches</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {liveMatches.map(match => (
              <div
                key={match.id}
                className="bg-[#11233B] border border-[#203A60] rounded-2xl p-4 space-y-3 shadow-lg relative overflow-hidden"
              >
                {/* Header: Game & Live Minute */}
                <div className="flex items-center justify-between border-b border-[#203A60] pb-2 text-xs">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] font-mono text-gray-400">{match.gameTitle}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => { soundEngine.play('tap'); setActiveTrackerMatch(match); }}
                    className="text-[10px] font-mono text-[#00BFEF] hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    <span>2D Pitch Tracker</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Contenders & Score */}
                <div className="flex items-center justify-between py-1">
                  <div className="space-y-1 w-5/12">
                    <span className="font-black text-xs text-white block truncate">{match.team1.name}</span>
                    <span className="text-[10px] font-mono text-gray-400 block">{match.team1.tag}</span>
                  </div>

                  <div className="flex flex-col items-center justify-center px-2">
                    <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.2 rounded">
                      LIVE {match.minute}'
                    </span>
                    <span className="text-xl font-black font-mono text-white tracking-widest mt-0.5">
                      {match.team1.score} : {match.team2.score}
                    </span>
                  </div>

                  <div className="space-y-1 w-5/12 text-right">
                    <span className="font-black text-xs text-white block truncate">{match.team2.name}</span>
                    <span className="text-[10px] font-mono text-gray-400 block">{match.team2.tag}</span>
                  </div>
                </div>

                {/* 1xBet Style 3-Way Odds Boxes (1, X, 2) */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {[
                    { label: '1 (Team 1)', odds: 1.85 },
                    { label: 'X (Draw/Ref)', odds: 3.20 },
                    { label: '2 (Team 2)', odds: 2.10 }
                  ].map(od => {
                    const isSelected = isSelectionInSlip(match.gameTitle, od.label);
                    return (
                      <button
                        key={od.label}
                        type="button"
                        onClick={() => handleAddOddsToSlip('arena_stake', match.gameTitle, od.label, od.odds)}
                        className={`onex-odds-btn ${isSelected ? 'selected' : ''}`}
                      >
                        <span className="text-[9px] text-gray-400 uppercase font-mono block">{od.label}</span>
                        <span className="text-xs font-black text-amber-400 font-mono block mt-0.5">{od.odds.toFixed(2)}</span>
                      </button>
                    );
                  })}
                </div>

              </div>
            ))}
          </div>
        </section>

        {/* ================= SECTION 2: WAIRO CARRIER SILENT AUCTION ODDS ================= */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Truck className="w-4 h-4 text-[#00BFEF]" />
              <h2 className="font-mono font-black text-sm uppercase tracking-wider text-white">
                Carrier Reverse-Auction • High-Speed Dispatch Rates
              </h2>
            </div>
            <button
              type="button"
              onClick={() => { soundEngine.play('tap'); onOpenCarrierAuction?.(); }}
              className="text-[10px] font-mono text-[#00BFEF] hover:underline cursor-pointer"
            >
              Open Full Auction Desk ➔
            </button>
          </div>

          <div className="bg-[#11233B] border border-[#203A60] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-300">
              <span>Route: <strong>CBD Kencom ➔ Westlands Sarit</strong> (3.4 km • Express)</span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded font-bold">
                90% Provider Return Locked
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {[
                { name: 'GreenWheels Boda (EV)', price: 'KES 220', odds: 1.95, tag: 'Fastest 12m' },
                { name: 'SwiftLink Express (150cc)', price: 'KES 200', odds: 2.15, tag: 'Lowest Fare' },
                { name: 'Fargo Van (1 Ton)', price: 'KES 480', odds: 1.60, tag: 'Insured Cargo' }
              ].map(opt => {
                const isSelected = isSelectionInSlip('Wairo Carrier Dispatch', opt.name);
                return (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => handleAddOddsToSlip('wairo_courier', 'Wairo Carrier Dispatch', opt.name, opt.odds)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#00BFEF] text-[#07121E] border-[#00BFEF]'
                        : 'bg-[#0D1C2E] border-[#203A60] text-white hover:border-[#00BFEF]'
                    }`}
                  >
                    <div>
                      <span className="text-[9px] font-mono uppercase text-emerald-400 font-bold block">{opt.tag}</span>
                      <span className="font-bold text-xs block mt-0.5">{opt.name}</span>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/10 font-mono">
                      <span className="text-xs font-black">{opt.price}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        isSelected ? 'bg-[#07121E] text-white' : 'bg-[#162B48] text-amber-400'
                      }`}>
                        {opt.odds}x
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ================= SECTION 3: TOWN HUBS & CHAMA DESKS ================= */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          
          {/* Chama Desk Card */}
          <div className="p-4 rounded-2xl bg-[#11233B] border border-[#203A60] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-lg">🌸</span>
                <h3 className="font-black text-xs text-white">Kilimani Chama (Cycle 5)</h3>
              </div>
              <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-500/20 px-2 py-0.5 rounded">
                Pot: KES 60k
              </span>
            </div>
            <p className="text-[11px] text-gray-300">Beneficiary: Grace Wanjiku. Back rotational Merry-Go-Round cycle.</p>
            
            <button
              type="button"
              onClick={() => handleAddOddsToSlip('chama_pot', 'Kilimani Chama (Cycle 5)', 'Monthly Contribution (KES 5,500)', 1.0)}
              className="w-full py-2 rounded-xl bg-[#0D1C2E] hover:bg-[#162B48] border border-[#203A60] hover:border-[#00BFEF] text-white font-mono font-bold text-xs flex items-center justify-between px-3 cursor-pointer transition-all"
            >
              <span>Contribute via Slip</span>
              <span className="text-emerald-400">KES 5,500 ➔</span>
            </button>
          </div>

          {/* Inter-County Desk Card */}
          <div className="p-4 rounded-2xl bg-[#11233B] border border-[#203A60] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-lg">🚚</span>
                <h3 className="font-black text-xs text-white">Inter-County Cargo Corridor</h3>
              </div>
              <span className="text-[10px] font-mono text-[#00BFEF] font-bold bg-[#00BFEF]/20 px-2 py-0.5 rounded">
                Mombasa Road
              </span>
            </div>
            <p className="text-[11px] text-gray-300">Nairobi ➔ Mombasa Daily Trunk. Verified Logbook Drivers.</p>
            
            <button
              type="button"
              onClick={() => { soundEngine.play('tap'); onOpenInterCounty?.(); }}
              className="w-full py-2 rounded-xl bg-[#0D1C2E] hover:bg-[#162B48] border border-[#203A60] hover:border-[#00BFEF] text-white font-mono font-bold text-xs flex items-center justify-between px-3 cursor-pointer transition-all"
            >
              <span>View 4-County Routes</span>
              <span className="text-[#00BFEF]">From KES 500 ➔</span>
            </button>
          </div>

        </section>

      </main>

      {/* ================= 1XBET FLOATING BRIEF SLIP BADGE ================= */}
      {slipItems.length > 0 && (
        <button
          type="button"
          onClick={() => { soundEngine.play('heavyTap'); setIsSlipDrawerOpen(true); }}
          className="fixed bottom-16 right-4 z-40 onex-slip-badge px-4 py-2.5 rounded-full font-mono font-black text-xs flex items-center space-x-2 shadow-2xl cursor-pointer hover:scale-105 active:scale-95 transition-all"
        >
          <span>📝 Brief Slip</span>
          <span className="bg-[#07121E] text-white px-2 py-0.5 rounded-full text-[10px]">
            {slipItems.length}
          </span>
        </button>
      )}

      {/* ================= 1XBET 5-TAB BOTTOM NAVIGATION DOCK ================= */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#07121E] border-t border-[#203A60] px-4 py-2 flex items-center justify-around text-[10px] font-mono">
        {[
          { id: 'sports', label: 'Sports', icon: Trophy },
          { id: 'live', label: 'Live Radar', icon: Radio, count: 2 },
          { id: 'slip', label: 'Slip', icon: Package, count: slipItems.length, action: () => setIsSlipDrawerOpen(true) },
          { id: 'history', label: 'Ledger', icon: Database, action: onOpenOfflineSync },
          { id: 'menu', label: 'All Desks', icon: Menu, action: onOpenArenaClan }
        ].map(item => {
          const Icon = item.icon;
          const isActive = activeNavTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                soundEngine.play('tap');
                setActiveNavTab(item.id as any);
                item.action?.();
              }}
              className={`flex flex-col items-center space-y-1 py-1 px-2.5 rounded-xl cursor-pointer transition-all relative ${
                isActive ? 'text-[#00BFEF] font-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="relative">
                <Icon className="w-4 h-4" />
                {item.count !== undefined && item.count > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-[#FF3366] text-white text-[8px] font-black px-1 rounded-full">
                    {item.count}
                  </span>
                )}
              </div>
              <span className="text-[9px] uppercase tracking-wider">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ================= SLIP DRAWER MODAL ================= */}
      <OneXbetSlipDrawer
        isOpen={isSlipDrawerOpen}
        onClose={() => setIsSlipDrawerOpen(false)}
        items={slipItems}
        onRemoveItem={(id) => setSlipItems(prev => prev.filter(i => i.id !== id))}
        onClearSlip={() => setSlipItems([])}
        onUpdateStake={(id, amt) => setSlipItems(prev => prev.map(i => i.id === id ? { ...i, stakeKes: amt } : i))}
        onPlaceBet={(stake) => {
          setBalanceKes(prev => Math.max(0, prev - stake));
          setTimeout(() => {
            setSlipItems([]);
            setIsSlipDrawerOpen(false);
          }, 2000);
        }}
      />

      {/* ================= LIVE 2D PITCH MATCH TRACKER MODAL ================= */}
      {activeTrackerMatch && (
        <OneXbetMatchTracker
          match={activeTrackerMatch}
          onClose={() => setActiveTrackerMatch(null)}
          onOpenVoice={() => onOpenArenaClan?.()}
        />
      )}

    </div>
  );
}
