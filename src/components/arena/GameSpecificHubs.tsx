import React, { useState } from 'react';
import { 
  Crosshair, 
  Shield, 
  Zap, 
  Users, 
  MapPin, 
  Trophy, 
  Radio, 
  Play, 
  Check, 
  Flame, 
  Sparkles,
  Lock,
  Target
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

// ==========================================
// 1. CALL OF DUTY MOBILE TACTICAL OPS HUB
// ==========================================
export const CodCustomRoomHub: React.FC<{
  onLaunchCustomDuel: (mode: string, note: string) => void;
}> = ({ onLaunchCustomDuel }) => {
  const [selectedWeaponClass, setSelectedWeaponClass] = useState<'sniper' | 'cdl' | 'smg' | 'all'>('sniper');
  const [selectedMap, setSelectedMap] = useState<string>('Killhouse');
  const [healthRule, setHealthRule] = useState<'100' | '150'>('100');

  const maps = ['Killhouse', 'Nuketown', 'Crash', 'Standoff', 'Raid', 'Isolated BR'];
  const clans = [
    { name: 'Nairobi Phantoms', tag: '[NBO]', rank: '#1 Kenya', members: '18 Active', elo: 1840 },
    { name: 'Mombasa Ghosts', tag: '[MSA]', rank: '#3 Coastal', members: '12 Active', elo: 1720 },
    { name: 'Rift Valley Snipers', tag: '[RVS]', rank: '#5 Rift', members: '15 Active', elo: 1680 }
  ];

  return (
    <div className="space-y-4 rounded-3xl bg-[#0D1117] border border-red-500/20 p-5 text-white shadow-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-500">
            <Crosshair className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-white">
              COD Tactical Loadout & Room Coordinator
            </h3>
            <p className="text-[10px] text-gray-400">
              Configure competitive CDL rules, weapon restrictions & private room lobbies
            </p>
          </div>
        </div>
        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-red-500 text-white">
          ACTIVISION CDL SYNC
        </span>
      </div>

      {/* Weapon Restriction Selector */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-mono text-gray-400 uppercase font-bold">
          Weapon Class Restrictions:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: 'sniper', label: 'Bolt-Action Sniper Only', desc: 'DL Q33 / Locus / Koshka (Quickscope)' },
            { id: 'cdl', label: 'CDL Competitive Rules', desc: 'No Operators / No Persistence' },
            { id: 'smg', label: 'SMG / Shotgun Rush', desc: 'CQB Close Quarters' },
            { id: 'all', label: 'Unrestricted Arsenal', desc: 'Full Loadout & Scorestreaks' }
          ].map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                soundEngine.play('tap');
                setSelectedWeaponClass(w.id as any);
              }}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                selectedWeaponClass === w.id
                  ? 'bg-red-500/20 border-red-500 text-white'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              <span className="text-xs font-bold block">{w.label}</span>
              <span className="text-[9px] text-gray-400 block mt-0.5">{w.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Map & Health Settings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div>
          <label className="text-[10px] font-mono text-gray-400 uppercase font-bold block mb-1">
            Arena Map:
          </label>
          <div className="flex flex-wrap gap-1.5">
            {maps.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  soundEngine.play('tap');
                  setSelectedMap(m);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border cursor-pointer ${
                  selectedMap === m
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-white/5 border-white/10 text-gray-400'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-mono text-gray-400 uppercase font-bold block mb-1">
            Player Health Setting:
          </label>
          <div className="flex space-x-2">
            {[
              { id: '100', label: '100 HP (Standard Multi)' },
              { id: '150', label: '150 HP (CDL / Tactical)' }
            ].map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  soundEngine.play('tap');
                  setHealthRule(h.id as any);
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-mono font-bold border cursor-pointer ${
                  healthRule === h.id
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-white/5 border-white/10 text-gray-400'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Match Launch Bar */}
      <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="text-[11px] text-gray-400">
          Selected: <b className="text-white">{selectedMap}</b> • <b className="text-red-400">{selectedWeaponClass.toUpperCase()}</b> • <b className="text-white">{healthRule} HP</b>
        </div>
        <button
          type="button"
          onClick={() => {
            soundEngine.play('heavyTap');
            onLaunchCustomDuel(
              `1v1 ${selectedWeaponClass === 'sniper' ? 'Sniper' : 'Custom'} (${selectedMap})`,
              `COD Room on ${selectedMap} | ${selectedWeaponClass.toUpperCase()} | ${healthRule} HP`
            );
          }}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-lg shadow-red-600/30 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Launch COD Duel Room</span>
        </button>
      </div>

      {/* African COD Clan Scrim Board */}
      <div className="pt-3 border-t border-white/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-gray-400 uppercase font-bold flex items-center space-x-1">
            <Users className="w-3 h-3 text-red-500" />
            <span>Active African COD Clans Ready to Scrim:</span>
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {clans.map((c) => (
            <div key={c.tag} className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-red-400">{c.tag} {c.name}</span>
                <span className="text-[10px] text-gray-400 block">{c.rank} • {c.members}</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-400">{c.elo} Elo</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. PUBG MOBILE BATTLE ZONE HUB
// ==========================================
export const PubgCustomRoomHub: React.FC<{
  onLaunchCustomDuel: (mode: string, note: string) => void;
}> = ({ onLaunchCustomDuel }) => {
  const [perspective, setPerspective] = useState<'TPP' | 'FPP'>('TPP');
  const [selectedMap, setSelectedMap] = useState<string>('Erangel');
  const [dropMode, setDropMode] = useState<string>('Solo Staked Drop');

  const maps = ['Erangel', 'Livik', 'Miramar', 'Sanhok', 'Warehouse TDM'];

  return (
    <div className="space-y-4 rounded-3xl bg-[#0D1117] border border-amber-500/20 p-5 text-white shadow-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-500">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-white">
              PUBG Battle Zone & Room Coordinator
            </h3>
            <p className="text-[10px] text-gray-400">
              Custom Erangel drops, 4v4 Warehouse duels & Squad kill races
            </p>
          </div>
        </div>
        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500 text-[#0D1117]">
          KRAFTON SERVER SYNC
        </span>
      </div>

      {/* Perspective & Match Mode Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-mono text-gray-400 uppercase font-bold block mb-1">
            Camera Perspective:
          </label>
          <div className="flex space-x-2">
            {['TPP', 'FPP'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  soundEngine.play('tap');
                  setPerspective(p as any);
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold border cursor-pointer ${
                  perspective === p
                    ? 'bg-amber-500 text-[#0D1117] border-amber-500'
                    : 'bg-white/5 border-white/10 text-gray-400'
                }`}
              >
                {p} Mode
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-mono text-gray-400 uppercase font-bold block mb-1">
            PUBG Match Format:
          </label>
          <select
            value={dropMode}
            onChange={(e) => setDropMode(e.target.value)}
            className="w-full bg-[#173247] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
          >
            <option value="Solo Staked Drop">Solo Staked Drop (Last Survivor Takes Pot)</option>
            <option value="4v4 TDM Warehouse">4v4 TDM Warehouse (First to 40 Kills)</option>
            <option value="Squad Kill Race">Squad Kill Race (Combined Kills)</option>
            <option value="Miramar Sniper Arena">Miramar Sniper Arena (Bolt-Action)</option>
          </select>
        </div>
      </div>

      {/* Map Selector */}
      <div>
        <label className="text-[10px] font-mono text-gray-400 uppercase font-bold block mb-1">
          Battleground Map:
        </label>
        <div className="flex flex-wrap gap-1.5">
          {maps.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                soundEngine.play('tap');
                setSelectedMap(m);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border cursor-pointer ${
                selectedMap === m
                  ? 'bg-amber-500 text-[#0D1117] border-amber-500 font-black'
                  : 'bg-white/5 border-white/10 text-gray-400'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Launch CTA */}
      <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="text-[11px] text-gray-400">
          Configuration: <b className="text-white">{perspective}</b> • <b className="text-amber-400">{selectedMap}</b> • <b className="text-white">{dropMode}</b>
        </div>
        <button
          type="button"
          onClick={() => {
            soundEngine.play('heavyTap');
            onLaunchCustomDuel(
              dropMode,
              `PUBG Room on ${selectedMap} | ${perspective} | ${dropMode}`
            );
          }}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#0D1117] text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-lg shadow-amber-500/30 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Launch PUBG Matchroom</span>
        </button>
      </div>
    </div>
  );
};

// ==========================================
// 3. EA SPORTS FC 25 ULTIMATE MATCH HUB
// ==========================================
export const EaFcCustomMatchHub: React.FC<{
  onLaunchCustomDuel: (mode: string, note: string) => void;
}> = ({ onLaunchCustomDuel }) => {
  const [platform, setPlatform] = useState<string>('PS5 / Cross-play');
  const [matchLength, setMatchLength] = useState<string>('6 Min Halves');
  const [squadType, setSquadType] = useState<'fut' | 'authentic' | 'clubs'>('fut');

  return (
    <div className="space-y-4 rounded-3xl bg-[#0D1117] border border-cyan-500/20 p-5 text-white shadow-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-white">
              EA FC 25 Console & PC Duel Coordinator
            </h3>
            <p className="text-[10px] text-gray-400">
              Cross-play PS5/Xbox matchrooms, FUT Champions gauntlet & Pro Clubs
            </p>
          </div>
        </div>
        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500 text-[#0D1117]">
          EA SPORTS CROSSPLAY
        </span>
      </div>

      {/* Squad / Game Type Selector */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { id: 'fut', label: 'Ultimate Team (FUT)', desc: '90-min ranked squad battle' },
          { id: 'authentic', label: 'Authentic Clubs (Seasons)', desc: 'Real 2025/26 rosters only' },
          { id: 'clubs', label: 'Pro Clubs 2v2 / 3v3', desc: 'Virtual Pro squad teamplay' }
        ].map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              setSquadType(s.id as any);
            }}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              squadType === s.id
                ? 'bg-cyan-500/20 border-cyan-500 text-white'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
            }`}
          >
            <span className="text-xs font-bold block">{s.label}</span>
            <span className="text-[9px] text-gray-400 block mt-0.5">{s.desc}</span>
          </button>
        ))}
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-mono text-gray-400 uppercase font-bold block mb-1">
            Platform / Network:
          </label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full bg-[#173247] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
          >
            <option value="PS5 / Cross-play">PlayStation 5 (Cross-play ON)</option>
            <option value="Xbox Series X/S">Xbox Series X/S</option>
            <option value="PC EA App">PC EA App / Steam</option>
            <option value="PS4 Legacy">PS4 Legacy</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-mono text-gray-400 uppercase font-bold block mb-1">
            Half Length & Defense:
          </label>
          <div className="flex space-x-2">
            {['6 Min Halves', '8 Min Halves'].map((len) => (
              <button
                key={len}
                type="button"
                onClick={() => {
                  soundEngine.play('tap');
                  setMatchLength(len);
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold border cursor-pointer ${
                  matchLength === len
                    ? 'bg-cyan-500 text-[#0D1117] border-cyan-500'
                    : 'bg-white/5 border-white/10 text-gray-400'
                }`}
              >
                {len}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Launch CTA */}
      <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="text-[11px] text-gray-400">
          Match Terms: <b className="text-cyan-400">{squadType.toUpperCase()}</b> • <b className="text-white">{platform}</b> • <b className="text-white">{matchLength}</b>
        </div>
        <button
          type="button"
          onClick={() => {
            soundEngine.play('heavyTap');
            onLaunchCustomDuel(
              `1v1 ${squadType === 'fut' ? 'FUT' : squadType === 'authentic' ? 'Seasons' : 'Pro Clubs'}`,
              `EA FC Room: ${platform} | ${matchLength} | ${squadType.toUpperCase()} | Tactical Defense`
            );
          }}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-[#0D1117] text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-lg shadow-cyan-500/30 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Launch EA FC Matchroom</span>
        </button>
      </div>
    </div>
  );
};

// ==========================================
// 4. EA SPORTS FC MOBILE ARENA HUB
// ==========================================
export const FcMobileCustomHub: React.FC<{
  onLaunchCustomDuel: (mode: string, note: string) => void;
}> = ({ onLaunchCustomDuel }) => {
  const [mobileMode, setMobileMode] = useState<'vsa' | 'h2h' | 'manager'>('h2h');
  const [ovrCap, setOvrCap] = useState<string>('No Cap (Open OVR)');

  return (
    <div className="space-y-4 rounded-3xl bg-[#0D1117] border border-pink-500/20 p-5 text-white shadow-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-white">
              FC Mobile Duel & Squad Coordinator
            </h3>
            <p className="text-[10px] text-gray-400">
              VS Attack 90-sec sprints, Head to Head duels & Manager Mode
            </p>
          </div>
        </div>
        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-pink-500 text-white">
          FC MOBILE SYNC
        </span>
      </div>

      {/* FC Mobile Mode Selection */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { id: 'vsa', label: 'VS Attack (VSA)', desc: '90-Sec Scenario Sprint' },
          { id: 'h2h', label: 'Head to Head (H2H)', desc: '90-Min Real-time Mobile' },
          { id: 'manager', label: 'Manager Mode', desc: 'Tactics Auto-Simulation' }
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              setMobileMode(m.id as any);
            }}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              mobileMode === m.id
                ? 'bg-pink-500/20 border-pink-500 text-white'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
            }`}
          >
            <span className="text-xs font-bold block">{m.label}</span>
            <span className="text-[9px] text-gray-400 block mt-0.5">{m.desc}</span>
          </button>
        ))}
      </div>

      {/* OVR Cap & Server Selector */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-mono text-gray-400 uppercase font-bold block mb-1">
            Team Rating (OVR) Cap:
          </label>
          <select
            value={ovrCap}
            onChange={(e) => setOvrCap(e.target.value)}
            className="w-full bg-[#173247] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
          >
            <option value="No Cap (Open OVR)">No Cap (Open OVR)</option>
            <option value="100 Max OVR">100 Max OVR (Balanced Duel)</option>
            <option value="105 Max OVR">105 Max OVR (Gold Squads)</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-mono text-gray-400 uppercase font-bold block mb-1">
            Regional Server:
          </label>
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-emerald-400 font-bold flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Africa (Low Latency Nairobi Hub)</span>
          </div>
        </div>
      </div>

      {/* Launch CTA */}
      <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="text-[11px] text-gray-400">
          Match Type: <b className="text-pink-400">{mobileMode.toUpperCase()}</b> • <b className="text-white">{ovrCap}</b>
        </div>
        <button
          type="button"
          onClick={() => {
            soundEngine.play('heavyTap');
            onLaunchCustomDuel(
              `1v1 ${mobileMode.toUpperCase()}`,
              `FC Mobile: ${mobileMode.toUpperCase()} | ${ovrCap} | Regional Africa Server`
            );
          }}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-lg shadow-pink-600/30 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Launch FC Mobile Matchroom</span>
        </button>
      </div>
    </div>
  );
};
