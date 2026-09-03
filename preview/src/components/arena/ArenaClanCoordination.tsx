import React, { useState } from 'react';
import {
  Trophy,
  Users,
  Radio,
  Volume2,
  VolumeX,
  Phone,
  MessageSquare,
  Copy,
  Check,
  Play,
  Flame,
  Sparkles,
  X,
  DollarSign,
  Send,
  ArrowRight,
  ShieldCheck,
  Award,
  ChevronRight,
  Share2,
  AlertTriangle,
  Clock,
  Layers
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface ClanRoster {
  id: string;
  name: string;
  tag: string;
  badgeColor: string;
  county: string;
  gameSpecialty: string;
  membersCount: number;
  rank: number;
  eloRating: number;
  isRecruiting: boolean;
  voiceChannelActive: boolean;
  members: { name: string; tag: string; role: 'Leader' | 'Co-Captain' | 'Pro' | 'Member'; isOnline: boolean; isSpeaking?: boolean }[];
}

export interface StakedDuel {
  id: string;
  challenger: string;
  opponent?: string;
  game: string;
  gameMode: string;
  roomCode: string;
  stakeAmountKes: number;
  prizePoolKes: number;
  status: 'open' | 'active_match' | 'awaiting_results' | 'disputed' | 'settled';
  createdAt: string;
}

export interface TournamentBracketMatch {
  id: string;
  round: 'Quarterfinals' | 'Semifinals' | 'Finals';
  player1: string;
  player2: string;
  score1?: number;
  score2?: number;
  winner?: string;
  status: 'upcoming' | 'live' | 'completed';
}

const INITIAL_CLANS: ClanRoster[] = [
  {
    id: 'clan-nbo-phantoms',
    name: 'Nairobi Phantoms',
    tag: '[NBO]',
    badgeColor: '#2563EB',
    county: 'Nairobi (Westlands)',
    gameSpecialty: 'COD Mobile & EA FC 24',
    membersCount: 24,
    rank: 1,
    eloRating: 1940,
    isRecruiting: true,
    voiceChannelActive: true,
    members: [
      { name: 'Kevo Ghost', tag: '[NBO] Kevo', role: 'Leader', isOnline: true, isSpeaking: true },
      { name: 'SlickStriker', tag: '[NBO] Slick', role: 'Co-Captain', isOnline: true },
      { name: 'AlphaSniper', tag: '[NBO] Alpha', role: 'Pro', isOnline: true },
      { name: 'MatatuKing', tag: '[NBO] Matatu', role: 'Member', isOnline: false }
    ]
  },
  {
    id: 'clan-msa-sharks',
    name: 'Mombasa Cyber-Sharks',
    tag: '[MSA]',
    badgeColor: '#00BFEF',
    county: 'Mombasa (Nyali)',
    gameSpecialty: 'PUBG Mobile & Free Fire',
    membersCount: 18,
    rank: 2,
    eloRating: 1880,
    isRecruiting: true,
    voiceChannelActive: true,
    members: [
      { name: 'SwahiliNinja', tag: '[MSA] Ninja', role: 'Leader', isOnline: true },
      { name: 'CoastalViper', tag: '[MSA] Viper', role: 'Co-Captain', isOnline: true, isSpeaking: true },
      { name: 'JazaTank', tag: '[MSA] Jaza', role: 'Member', isOnline: true }
    ]
  },
  {
    id: 'clan-eld-vipers',
    name: 'Eldoret Rift Titans',
    tag: '[ELD]',
    badgeColor: '#16A34A',
    county: 'Eldoret (Rupa)',
    gameSpecialty: 'eFootball & EA FC 24',
    membersCount: 15,
    rank: 3,
    eloRating: 1810,
    isRecruiting: false,
    voiceChannelActive: false,
    members: [
      { name: 'Kiprono Champ', tag: '[ELD] Kip', role: 'Leader', isOnline: true },
      { name: 'RiftMaestro', tag: '[ELD] Maestro', role: 'Pro', isOnline: false }
    ]
  }
];

const INITIAL_STAKED_DUELS: StakedDuel[] = [
  {
    id: 'duel-efc-801',
    challenger: 'Kevo Ghost',
    opponent: 'SwahiliNinja',
    game: 'EA FC 24 Mobile',
    gameMode: '1v1 Standard (10 Mins)',
    roomCode: 'EFC-9941',
    stakeAmountKes: 500,
    prizePoolKes: 900,
    status: 'active_match',
    createdAt: '10 mins ago'
  },
  {
    id: 'duel-pubg-402',
    challenger: 'CoastalViper',
    game: 'PUBG Mobile',
    gameMode: '4v4 TDM Warehouse',
    roomCode: 'PBG-7712',
    stakeAmountKes: 250,
    prizePoolKes: 450,
    status: 'open',
    createdAt: '2 mins ago'
  },
  {
    id: 'duel-cod-319',
    challenger: 'AlphaSniper',
    game: 'Call of Duty Mobile',
    gameMode: '1v1 Sniper Killhouse',
    roomCode: 'COD-1884',
    stakeAmountKes: 1000,
    prizePoolKes: 1800,
    status: 'open',
    createdAt: 'Just now'
  }
];

const INITIAL_BRACKET: TournamentBracketMatch[] = [
  { id: 'm1', round: 'Quarterfinals', player1: 'Kevo Ghost', player2: 'Otieno_FC', score1: 3, score2: 1, winner: 'Kevo Ghost', status: 'completed' },
  { id: 'm2', round: 'Quarterfinals', player1: 'SwahiliNinja', player2: 'Kiprono Champ', score1: 2, score2: 4, winner: 'Kiprono Champ', status: 'completed' },
  { id: 'm3', round: 'Quarterfinals', player1: 'AlphaSniper', player2: 'MwangiPro', score1: 0, score2: 0, status: 'live' },
  { id: 'm4', round: 'Quarterfinals', player1: 'CoastalViper', player2: 'SlickStriker', score1: 0, score2: 0, status: 'upcoming' },
  { id: 'm5', round: 'Semifinals', player1: 'Kevo Ghost', player2: 'Kiprono Champ', status: 'upcoming' },
  { id: 'm6', round: 'Semifinals', player1: 'TBD', player2: 'TBD', status: 'upcoming' },
  { id: 'm7', round: 'Finals', player1: 'TBD', player2: 'TBD', status: 'upcoming' }
];

export function ArenaClanCoordination({
  onClose,
  onJoinMatch
}: {
  onClose?: () => void;
  onJoinMatch?: (duel: StakedDuel) => void;
}) {
  const [activeTab, setActiveTab] = useState<'clans' | 'staked' | 'bracket' | 'rooms'>('clans');
  const [clans, setClans] = useState<ClanRoster[]>(INITIAL_CLANS);
  const [selectedClan, setSelectedClan] = useState<ClanRoster>(INITIAL_CLANS[0]);
  const [stakedDuels, setStakedDuels] = useState<StakedDuel[]>(INITIAL_STAKED_DUELS);
  const [bracketMatches, setBracketMatches] = useState<TournamentBracketMatch[]>(INITIAL_BRACKET);

  // Voice Chat Simulator State
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [activeVoiceRoom, setActiveVoiceRoom] = useState<string>('Nairobi Scrim Lobbies #1');

  // Room Code Generator State
  const [selectedGameForRoom, setSelectedGameForRoom] = useState<string>('EA FC 24');
  const [generatedRoomCode, setGeneratedRoomCode] = useState<string>('EFC-8821');
  const [copiedNotification, setCopiedNotification] = useState<string>('');

  // Staked Match Creation Form
  const [isCreateDuelOpen, setIsCreateDuelOpen] = useState(false);
  const [newDuelGame, setNewDuelGame] = useState('EA FC 24');
  const [newDuelStake, setNewDuelStake] = useState<number>(250);

  const handleCopyCode = (code: string) => {
    soundEngine.play('tap');
    navigator.clipboard?.writeText(code);
    setCopiedNotification(`Copied room code: ${code}`);
    setTimeout(() => setCopiedNotification(''), 2500);
  };

  const handleCreateStakedDuel = (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.play('victory');

    const randomCode = `${newDuelGame.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newDuel: StakedDuel = {
      id: `duel-${Date.now()}`,
      challenger: 'You (Host)',
      game: newDuelGame,
      gameMode: '1v1 Competitive Rules',
      roomCode: randomCode,
      stakeAmountKes: newDuelStake,
      prizePoolKes: Math.round(newDuelStake * 1.8),
      status: 'open',
      createdAt: 'Just now'
    };

    setStakedDuels(prev => [newDuel, ...prev]);
    setIsCreateDuelOpen(false);
    setActiveTab('staked');
  };

  const handleJoinStakedDuel = (duel: StakedDuel) => {
    soundEngine.play('heavyTap');
    setStakedDuels(prev =>
      prev.map(d =>
        d.id === duel.id
          ? { ...d, opponent: 'You', status: 'active_match' }
          : d
      )
    );
    onJoinMatch?.(duel);
  };

  const handleConfirmDuelWinner = (duelId: string, winner: 'challenger' | 'opponent') => {
    soundEngine.play('victory');
    setStakedDuels(prev =>
      prev.map(d =>
        d.id === duelId
          ? { ...d, status: 'settled' }
          : d
      )
    );
  };

  return (
    <div className="bg-[#0D1117] border border-white/10 rounded-3xl overflow-hidden shadow-2xl text-white max-w-4xl mx-auto">
      
      {/* ================= HEADER ================= */}
      <div className="bg-gradient-to-br from-[#0F172A] via-[#111827] to-[#0A0D14] p-5 sm:p-6 border-b border-white/10 relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full bg-[#FF5A1F] text-white uppercase tracking-wider">
                DISCORD FOR AFRICA • ESPORTS ARCHITECTURE
              </span>
              <span className="text-xs text-indigo-300 font-bold flex items-center space-x-1">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>African Clans, Scrims & M-Pesa Staked Duels</span>
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black mt-2 text-white tracking-tight flex items-center space-x-2">
              <span>Arena Clan Hub & Matchmaking</span>
              <Flame className="w-5 h-5 text-amber-400" />
            </h2>
            <p className="text-xs text-gray-300 mt-0.5 max-w-xl">
              Authentic community matchmaking, room code sharing, clan voice channels, and escrow-backed 1v1 challenge matches.
            </p>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={() => { soundEngine.play('tap'); onClose(); }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-1.5 mt-5 border-t border-white/10 pt-3 overflow-x-auto">
          {[
            { id: 'clans', label: 'African Clans & Voice' },
            { id: 'staked', label: 'M-Pesa Staked Duels', count: stakedDuels.filter(d => d.status === 'open').length },
            { id: 'bracket', label: 'County Tournament Brackets' },
            { id: 'rooms', label: 'Room Code Coordinator' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { soundEngine.play('tap'); setActiveTab(tab.id as any); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                activeTab === tab.id
                  ? 'bg-white text-[#0D1117] shadow-md font-black'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-[#FF5A1F] text-white">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {copiedNotification && (
        <div className="bg-emerald-500 text-[#0D1117] font-bold text-xs px-4 py-2 text-center animate-fadeIn">
          {copiedNotification}
        </div>
      )}

      {/* ================= TAB 1: CLANS & VOICE COMMS ================= */}
      {activeTab === 'clans' && (
        <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          
          {/* Left Column: Clan Directory */}
          <div className="md:col-span-5 space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-bold block">
              Top Ranked African Clans
            </span>

            <div className="space-y-2">
              {clans.map(clan => (
                <button
                  key={clan.id}
                  type="button"
                  onClick={() => { soundEngine.play('tap'); setSelectedClan(clan); }}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
                    selectedClan.id === clan.id
                      ? 'bg-white/10 border-white/40 shadow-lg'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-black text-xs text-white">{clan.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-bold">
                        {clan.tag}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-black text-amber-400">
                      #{clan.rank} • {clan.eloRating} Elo
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-gray-400">
                    <span>{clan.county}</span>
                    <span>{clan.membersCount} Members</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Selected Clan Details & Discord Voice Lounge */}
          <div className="md:col-span-7 space-y-4">
            
            {/* Clan Banner Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/30 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-black text-white">{selectedClan.name}</h3>
                  <p className="text-xs text-blue-200">{selectedClan.gameSpecialty}</p>
                </div>
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                  {selectedClan.isRecruiting ? 'Recruiting Open' : 'Roster Full'}
                </span>
              </div>

              {/* Discord-like Voice Channel Bar */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span className="font-bold text-xs text-white">Voice: {activeVoiceRoom}</span>
                  </div>

                  {/* Mic & Deafen Controls */}
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => { soundEngine.play('tap'); setIsMicMuted(!isMicMuted); }}
                      className={`px-2 py-1 rounded-lg border text-[10px] font-bold font-mono transition-colors cursor-pointer flex items-center space-x-1 ${
                        isMicMuted ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-white/10 border-white/20 text-emerald-400'
                      }`}
                      title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
                    >
                      <span>🎤</span>
                      <span>{isMicMuted ? 'MUTED' : 'LIVE'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { soundEngine.play('tap'); setIsDeafened(!isDeafened); }}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        isDeafened ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-white/10 border-white/20 text-white'
                      }`}
                      title={isDeafened ? 'Undeafen Voice' : 'Deafen Voice'}
                    >
                      {isDeafened ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Active Voice Speakers */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {selectedClan.members.map(member => (
                    <div
                      key={member.name}
                      className={`p-2 rounded-lg border flex items-center space-x-2 text-xs ${
                        member.isSpeaking
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/40'
                          : 'border-white/5 bg-white/5 text-gray-300'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${member.isOnline ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                      <span className="font-bold text-[11px] truncate">{member.tag}</span>
                      {member.isSpeaking && <span className="text-[9px] font-mono text-emerald-400">🎤</span>}
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* ================= TAB 2: M-PESA STAKED DUELS ================= */}
      {activeTab === 'staked' && (
        <div className="p-5 sm:p-6 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-sm uppercase tracking-wider text-white">
                M-Pesa Staked Challenge Lobbies
              </h3>
              <p className="text-[11px] text-gray-400">Escrow protected 1v1 and squad duels. Winner takes 90% pot.</p>
            </div>

            <button
              type="button"
              onClick={() => { soundEngine.play('tap'); setIsCreateDuelOpen(true); }}
              className="px-3.5 py-1.5 rounded-xl bg-[#FF5A1F] hover:bg-[#ff6f3b] text-white font-bold text-xs flex items-center space-x-1.5 shadow-md cursor-pointer transition-all"
            >
              <span>+ Create Challenge</span>
            </button>
          </div>

          {/* Staked Duels Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {stakedDuels.map(duel => (
              <div
                key={duel.id}
                className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-[#00BFEF] font-bold uppercase">{duel.game}</span>
                    <h4 className="font-black text-sm text-white">{duel.gameMode}</h4>
                    <span className="text-[10px] text-gray-400">By {duel.challenger} • {duel.createdAt}</span>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-black font-mono text-amber-400 block">
                      KES {duel.prizePoolKes}
                    </span>
                    <span className="text-[9px] text-gray-400 font-mono">Entry: KES {duel.stakeAmountKes}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 font-mono">
                    <span className="text-gray-400 text-[10px]">ROOM CODE:</span>
                    <span className="font-bold text-emerald-400">{duel.roomCode}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(duel.roomCode)}
                    className="text-[10px] text-gray-300 hover:text-white flex items-center space-x-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </button>
                </div>

                {duel.status === 'open' && (
                  <button
                    type="button"
                    onClick={() => handleJoinStakedDuel(duel)}
                    className="w-full py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-md transition-all"
                  >
                    <span>Accept Challenge (Stake KES {duel.stakeAmountKes})</span>
                  </button>
                )}

                {duel.status === 'active_match' && (
                  <div className="space-y-2">
                    <span className="text-[10px] text-amber-400 font-bold block text-center animate-pulse">
                      ● Match in Progress in Room {duel.roomCode}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleConfirmDuelWinner(duel.id, 'challenger')}
                        className="py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                      >
                        I Won Match
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirmDuelWinner(duel.id, 'opponent')}
                        className="py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-bold text-[10px] cursor-pointer"
                      >
                        Opponent Won
                      </button>
                    </div>
                  </div>
                )}

                {duel.status === 'settled' && (
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-center font-bold text-[11px] border border-emerald-500/30">
                    ✓ Match Settled & Payout Disbursed via M-Pesa
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ================= TAB 3: TOURNAMENT BRACKET ================= */}
      {activeTab === 'bracket' && (
        <div className="p-5 sm:p-6 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-sm uppercase tracking-wider text-white">
                Nairobi County EA FC 24 Invitational
              </h3>
              <p className="text-[11px] text-gray-400">8-Player Single Elimination • Prize Pool: KES 15,000</p>
            </div>
            <span className="text-[10px] font-mono bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-bold">
              Quarterfinals Active
            </span>
          </div>

          {/* Interactive Bracket Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
            
            {/* Round 1: Quarterfinals */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono text-gray-400 uppercase font-bold block">Quarterfinals</span>
              {bracketMatches.filter(m => m.round === 'Quarterfinals').map(m => (
                <div key={m.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${m.winner === m.player1 ? 'text-amber-400 font-bold' : 'text-gray-300'}`}>
                      {m.player1}
                    </span>
                    <span className="font-mono text-xs">{m.score1 !== undefined ? m.score1 : '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${m.winner === m.player2 ? 'text-amber-400 font-bold' : 'text-gray-300'}`}>
                      {m.player2}
                    </span>
                    <span className="font-mono text-xs">{m.score2 !== undefined ? m.score2 : '-'}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Round 2: Semifinals */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono text-gray-400 uppercase font-bold block">Semifinals</span>
              {bracketMatches.filter(m => m.round === 'Semifinals').map(m => (
                <div key={m.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">{m.player1}</span>
                    <span className="font-mono text-xs">-</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">{m.player2}</span>
                    <span className="font-mono text-xs">-</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Round 3: Championship Finals */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono text-amber-400 uppercase font-bold block">Grand Final 🏆</span>
              {bracketMatches.filter(m => m.round === 'Finals').map(m => (
                <div key={m.id} className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{m.player1}</span>
                    <span className="font-mono text-xs">TBD</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{m.player2}</span>
                    <span className="font-mono text-xs">TBD</span>
                  </div>
                  <div className="pt-2 border-t border-white/10 text-center">
                    <span className="text-[10px] font-mono text-amber-400 font-black">1st Place: KES 10,000 + Trophy</span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* ================= TAB 4: ROOM CODE COORDINATOR ================= */}
      {activeTab === 'rooms' && (
        <div className="p-5 sm:p-6 space-y-4 text-xs max-w-lg mx-auto">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <h4 className="font-black text-sm text-white flex items-center space-x-2">
              <Share2 className="w-4 h-4 text-[#00BFEF]" />
              <span>Instant Cross-Title Room Code Generator</span>
            </h4>
            <p className="text-[11px] text-gray-300">
              Create and broadcast private match room codes to your WhatsApp group, SMS, or Brief clan feed in seconds.
            </p>

            <div className="space-y-2">
              <label className="font-bold text-gray-400">Select Game</label>
              <select
                value={selectedGameForRoom}
                onChange={(e) => {
                  setSelectedGameForRoom(e.target.value);
                  setGeneratedRoomCode(`${e.target.value.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`);
                }}
                className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#2563EB]"
              >
                <option value="EA FC 24 Mobile">EA FC 24 Mobile</option>
                <option value="PUBG Mobile">PUBG Mobile</option>
                <option value="Call of Duty Mobile">Call of Duty Mobile</option>
                <option value="eFootball 2026">eFootball 2026</option>
                <option value="Free Fire MAX">Free Fire MAX</option>
              </select>
            </div>

            <div className="p-3 rounded-xl bg-black/60 border border-white/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-gray-400 uppercase block">Shareable Room Code</span>
                <span className="text-lg font-black font-mono tracking-widest text-emerald-400">{generatedRoomCode}</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopyCode(generatedRoomCode)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= CREATE STAKED DUEL MODAL ================= */}
      {isCreateDuelOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/20 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl text-xs text-white">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-[#FF5A1F] font-bold uppercase">M-Pesa Escrow Match</span>
                <h3 className="font-black text-base text-white">Create Staked 1v1 Challenge</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateDuelOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStakedDuel} className="space-y-3">
              <div className="space-y-1">
                <label className="font-bold text-gray-300">Select Game</label>
                <select
                  value={newDuelGame}
                  onChange={(e) => setNewDuelGame(e.target.value)}
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#2563EB]"
                >
                  <option value="EA FC 24 Mobile">EA FC 24 Mobile</option>
                  <option value="Call of Duty Mobile">Call of Duty Mobile</option>
                  <option value="PUBG Mobile">PUBG Mobile</option>
                  <option value="eFootball 2026">eFootball 2026</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-300">Entry Stake (KES)</label>
                <select
                  value={newDuelStake}
                  onChange={(e) => setNewDuelStake(Number(e.target.value))}
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#2563EB]"
                >
                  <option value={100}>KES 100 (Winner takes KES 180)</option>
                  <option value={250}>KES 250 (Winner takes KES 450)</option>
                  <option value={500}>KES 500 (Winner takes KES 900)</option>
                  <option value={1000}>KES 1,000 (Winner takes KES 1,800)</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] space-y-1">
                <span className="font-bold block">Fair Play Escrow Guarantee:</span>
                <p>Both players deposit entry stake into Brief M-Pesa Escrow. Funds are released instantly upon mutual score confirmation.</p>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-2xl bg-[#FF5A1F] hover:bg-[#ff6f3b] text-white font-black text-xs shadow-md cursor-pointer transition-all"
              >
                Deposit Stake & Launch Challenge
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
