import React, { useState } from 'react';
import { 
  Trophy, 
  Flame, 
  Users, 
  Clock, 
  Shield, 
  X, 
  Check, 
  Sparkles, 
  ArrowRight,
  DollarSign,
  Lock,
  Globe
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface CustomLeagueTemplate {
  id: string;
  title: string;
  gameId: string;
  gameName: string;
  format: 'Knockout Cup' | 'Golden Goal' | 'Beat the Clock' | 'Round Robin League' | '2v2 Co-op Syndicate' | 'Custom Staked 1v1';
  entryFeeKes: number;
  prizePoolKes: number;
  maxPlayers: number;
  openWindow: string;
  rules: string;
  isPrivate: boolean;
  passcode?: string;
}

interface CustomLeagueModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  gameName: string;
  onCreateLeague: (league: CustomLeagueTemplate) => void;
}

export const CustomLeagueModal: React.FC<CustomLeagueModalProps> = ({
  isOpen,
  onClose,
  gameId,
  gameName,
  onCreateLeague
}) => {
  const [leagueTitle, setLeagueTitle] = useState(`${gameName} Private Championship`);
  const [format, setFormat] = useState<CustomLeagueTemplate['format']>('Knockout Cup');
  const [stakeType, setStakeType] = useState<'free' | 'staked'>('staked');
  const [entryFee, setEntryFee] = useState<number>(200);
  const [maxPlayers, setMaxPlayers] = useState<number>(8);
  const [customRules, setCustomRules] = useState<string>('Standard 6-min match, extra time + penalties enabled.');
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [passcode, setPasscode] = useState<string>('8849');

  if (!isOpen) return null;

  const prizePool = stakeType === 'staked' ? entryFee * maxPlayers : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.play('victory');

    const newLeague: CustomLeagueTemplate = {
      id: `league-${Date.now()}`,
      title: leagueTitle,
      gameId,
      gameName,
      format,
      entryFeeKes: stakeType === 'staked' ? entryFee : 0,
      prizePoolKes: prizePool,
      maxPlayers,
      openWindow: 'Registration Open',
      rules: customRules,
      isPrivate,
      passcode: isPrivate ? passcode : undefined
    };

    onCreateLeague(newLeague);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-[#0B1B2A] border border-[#173247] rounded-3xl overflow-hidden shadow-2xl flex flex-col text-white max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#173247] flex items-center justify-between bg-gradient-to-r from-[#0B1B2A] via-[#173247] to-[#0B1B2A]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FF5A1F]/20 border border-[#FF5A1F]/40 flex items-center justify-center text-[#FF5A1F]">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base sm:text-lg text-white">Create Private League / Template</h3>
              </div>
              <p className="text-xs text-[#DCE2E6]/70">For {gameName} • Custom Rules, Stakes & Ladders</p>
            </div>
          </div>
          <button
            onClick={() => {
              soundEngine.play('tap');
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          
          {/* League Title */}
          <div>
            <label className="block text-xs font-semibold text-[#DCE2E6]/80 uppercase tracking-wider mb-1">
              League / Challenge Title
            </label>
            <input
              type="text"
              value={leagueTitle}
              onChange={(e) => setLeagueTitle(e.target.value)}
              className="w-full bg-[#173247] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#00BFEF]"
              required
            />
          </div>

          {/* Tournament Format Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#DCE2E6]/80 uppercase tracking-wider mb-1.5">
              Select Competition Template
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'Knockout Cup', label: 'Knockout Cup', hint: 'Single Elimination' },
                { id: 'Golden Goal', label: 'Golden Goal', hint: '1st Goal Wins' },
                { id: 'Beat the Clock', label: 'Beat the Clock', hint: 'Speed Blitz 1v1' },
                { id: 'Round Robin League', label: 'Season League', hint: 'Points Table' },
                { id: '2v2 Co-op Syndicate', label: 'Co-op 2v2', hint: 'Squad Pinboards' },
                { id: 'Custom Staked 1v1', label: 'Staked Duel', hint: 'High-Stakes 1v1' },
              ].map((f) => {
                const isSelected = format === f.id;
                return (
                  <button
                    type="button"
                    key={f.id}
                    onClick={() => {
                      soundEngine.play('tap');
                      setFormat(f.id as any);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#FF5A1F] text-white border-[#FF5A1F] shadow-md shadow-[#FF5A1F]/30'
                        : 'bg-[#173247]/40 border-white/5 text-[#DCE2E6]/80 hover:bg-[#173247]'
                    }`}
                  >
                    <span className="font-bold text-xs block leading-tight">{f.label}</span>
                    <span className="text-[10px] opacity-75 block">{f.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stake & Prize Pool */}
          <div className="p-3.5 bg-black/40 border border-white/10 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Entry Stakes & Prize Pool</span>
              <div className="flex space-x-1.5">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('tap');
                    setStakeType('free');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    stakeType === 'free' ? 'bg-[#00BFEF] text-[#0B1B2A]' : 'bg-white/10 text-gray-300'
                  }`}
                >
                  Ranked / Free
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('tap');
                    setStakeType('staked');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    stakeType === 'staked' ? 'bg-[#FF5A1F] text-white' : 'bg-white/10 text-gray-300'
                  }`}
                >
                  Staked (KES)
                </button>
              </div>
            </div>

            {stakeType === 'staked' && (
              <div className="flex items-center justify-between pt-1">
                <div>
                  <label className="text-[10px] font-mono text-gray-400 block">ENTRY PER PLAYER:</label>
                  <div className="flex items-center space-x-1">
                    <span className="font-mono text-xs text-gray-400">KES</span>
                    <input
                      type="number"
                      value={entryFee}
                      onChange={(e) => setEntryFee(Math.max(50, Number(e.target.value)))}
                      className="w-24 bg-[#173247] border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-mono text-emerald-400 block">TOTAL PRIZE POOL:</span>
                  <span className="text-base font-mono font-black text-white">KES {prizePool.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Max Players & Access */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] text-[#DCE2E6]/70 mb-1">Max Players / Slots</label>
              <select
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="w-full bg-[#173247] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value={4}>4 Players (Semi-Finals)</option>
                <option value={8}>8 Players (Quarter-Finals)</option>
                <option value={16}>16 Players (Full Bracket)</option>
                <option value={32}>32 Players (Grand Tournament)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-[#DCE2E6]/70 mb-1">Access Privacy</label>
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('tap');
                  setIsPrivate(prev => !prev);
                }}
                className={`w-full py-2 px-3 rounded-xl border flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  isPrivate 
                    ? 'bg-[#FF5A1F]/20 border-[#FF5A1F] text-[#FF5A1F] font-bold' 
                    : 'bg-white/5 border-white/10 text-gray-300'
                }`}
              >
                {isPrivate ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                <span>{isPrivate ? 'Private Passcode' : 'Public Lobby'}</span>
              </button>
            </div>
          </div>

          {isPrivate && (
            <div>
              <label className="block text-[11px] text-[#DCE2E6]/70 mb-1">League PIN / Passcode</label>
              <input
                type="text"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="4-digit PIN"
                className="w-full bg-[#173247] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>
          )}

          {/* Rules / Conditions */}
          <div>
            <label className="block text-[11px] text-[#DCE2E6]/70 mb-1">Custom Match Rules</label>
            <textarea
              rows={2}
              value={customRules}
              onChange={(e) => setCustomRules(e.target.value)}
              className="w-full bg-[#173247] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            />
          </div>

          {/* Submit CTA */}
          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#FF5A1F] to-[#FF8A00] hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-xl shadow-[#FF5A1F]/30 transition-all cursor-pointer"
          >
            <span>Publish League to Arena Hub</span>
            <ArrowRight className="w-4 h-4" />
          </button>

        </form>

      </div>
    </div>
  );
};
