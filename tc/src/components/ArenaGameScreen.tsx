import React, { useState } from 'react';
import type { ArenaGame, ArenaChallenge } from '../App';
import { themeFor } from './arenaTheme';
import { soundEngine } from '../utils/SoundEngine';
import { 
  Trophy, 
  Flame, 
  Clock, 
  Users, 
  Plus, 
  Shield, 
  Play, 
  Star, 
  CheckCircle2, 
  Zap, 
  DollarSign, 
  Sparkles,
  ArrowRight,
  ChevronLeft,
  X,
  MessageSquare,
  Radio,
  Share2,
  Lock,
  Hash
} from 'lucide-react';
import { CustomLeagueModal } from './arena/CustomLeagueModal';

export type ArenaStakeKind = 'friendly' | 'ranked' | 'entry_fee';

export interface ArenaGameScreenProps {
  game: ArenaGame;
  activity: number;
  challenges: ArenaChallenge[];
  myTag: string | null;
  availabilityOn: boolean;
  availabilityBusy: boolean;
  busyId: string | null;
  myPlayerId: string | null;
  onClose: () => void;
  onCreateChallenge: (params: {
    mode: string;
    stake: ArenaStakeKind;
    entryFeeKes?: number;
    note?: string;
    openMinutes: number;
  }) => void;
  onAcceptChallenge: (c: ArenaChallenge) => void;
  onCancelChallenge: (c: ArenaChallenge) => void;
  onToggleAvailability: () => void;
  onViewLeaderboard: () => void;
  onViewTournaments: () => void;
}

const WINDOWS: { label: string; minutes: number }[] = [
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '4 hours', minutes: 240 },
  { label: 'Today', minutes: 360 }
];

const STAKES: { id: ArenaStakeKind; label: string; hint: string }[] = [
  { id: 'friendly', label: 'Friendly', hint: 'Play for fun · Room code duel' },
  { id: 'ranked', label: 'Ranked', hint: 'Counts towards African Leaderboard' },
  { id: 'entry_fee', label: 'Staked (KES)', hint: 'Agreed match stake' }
];

export function ArenaGameScreen({
  game,
  activity,
  challenges,
  myTag,
  availabilityOn,
  availabilityBusy,
  busyId,
  myPlayerId,
  onClose,
  onCreateChallenge,
  onAcceptChallenge,
  onCancelChallenge,
  onToggleAvailability,
  onViewLeaderboard,
  onViewTournaments
}: ArenaGameScreenProps) {
  const theme = themeFor(game.id);
  const [mode, setMode] = useState<string>(game.modes[0] ?? '1v1');
  const [stake, setStake] = useState<ArenaStakeKind>('friendly');
  const [entryFee, setEntryFee] = useState<string>('100');
  const [roomNote, setRoomNote] = useState<string>('');
  const [windowMinutes, setWindowMinutes] = useState<number>(120);
  const [isLeagueModalOpen, setIsLeagueModalOpen] = useState<boolean>(false);
  const [selectedPlacardForDetails, setSelectedPlacardForDetails] = useState<any | null>(null);

  const feeNum = Number(entryFee);
  const feeValid = Number.isFinite(feeNum) && Number.isInteger(feeNum) && feeNum > 0;
  const creating = busyId === 'create';
  const canCreate = !creating && (stake !== 'entry_fee' || feeValid);

  // Placard Cards tailored to community challenges
  const communityPlacards = [
    {
      id: 'golden-goal',
      title: 'Golden Goal: Sudden Death Duel',
      tag: 'COMMUNITY PLACARD',
      tagColor: '#F59E0B',
      endsIn: '4 day(s) 12 hr(s)',
      bgGradient: 'from-[#1A1408] via-[#2A1F0C] to-[#0D1117]',
      desc: 'First player to score a goal wins immediately. Room code shared in Brief chat upon acceptance.',
      rewards: ['🏆 +40 Elo', '🪙 Winner Takes Pot', 'Rank Badge'],
      multiplier: 'Sudden Death Rules',
      defaultMode: '1v1',
      defaultStake: 'ranked' as ArenaStakeKind,
    },
    {
      id: 'beat-the-clock',
      title: 'Beat the Clock: 5-Min Blitz',
      tag: 'CLAN BLITZ',
      tagColor: '#EF4444',
      endsIn: '6 day(s) 18 hr(s)',
      bgGradient: 'from-[#2D0B0B] via-[#451212] to-[#1F0707]',
      desc: 'Score within the high-intensity blitz window. Clean sheets and hat-tricks grant double community rep.',
      rewards: ['⚡ Blitz Rep', '👟 Clan Trophy', 'KES 1,200 Stakes'],
      multiplier: '+150% Blitz Bonus',
      defaultMode: '1v1',
      defaultStake: 'entry_fee' as ArenaStakeKind,
      defaultFee: 150,
    },
    {
      id: 'coop-pinboard',
      title: '2v2 Co-op Clan Syndicate',
      tag: '2v2 CO-OP SQUAD',
      tagColor: '#00BFEF',
      endsIn: '13 day(s) 18 hr(s)',
      bgGradient: 'from-[#0B1B2A] via-[#173247] to-[#0D1117]',
      desc: 'Join alone or with a clan partner. Coordinate 2v2 co-op squad room invites directly in Brief.',
      rewards: ['⭐ Co-op Pin', '💎 30k Clan Rep', 'Leaderboard +60'],
      multiplier: '+200% Team Multiplier',
      defaultMode: '2v2',
      defaultStake: 'friendly' as ArenaStakeKind,
    },
    {
      id: 'african-derby',
      title: `${game.shortName} Nairobi Derby League`,
      tag: 'REGIONAL LEAGUE',
      tagColor: '#EC4899',
      endsIn: '5 day(s) 6 hr(s)',
      bgGradient: 'from-[#2B0E1E] via-[#42152F] to-[#0D1117]',
      desc: `Weekly regional tournament for African players in ${game.name}. Staked and ranked duel lobbies open.`,
      rewards: ['🎁 Derby Cup', '🪙 500 Pts', 'KES 2,500 Pool'],
      multiplier: '+220% Derby Stakes',
      defaultMode: game.modes[0] ?? '1v1',
      defaultStake: 'entry_fee' as ArenaStakeKind,
      defaultFee: 250,
    }
  ];

  const handleCreate = () => {
    if (!canCreate) return;
    soundEngine.play('heavyTap');
    onCreateChallenge({
      mode,
      stake,
      entryFeeKes: stake === 'entry_fee' ? feeNum : undefined,
      note: roomNote.trim() ? roomNote.trim() : undefined,
      openMinutes: windowMinutes
    });
  };

  const handleLaunchPlacard = (p: typeof communityPlacards[0]) => {
    soundEngine.play('heavyTap');
    onCreateChallenge({
      mode: p.defaultMode,
      stake: p.defaultStake,
      entryFeeKes: p.defaultFee,
      note: `${p.title} - ${p.tag}`,
      openMinutes: 120
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#F7F8FA] text-[#0D1117]"
      role="dialog"
      aria-modal="true"
      aria-label={`${game.name} Arena Stage`}
    >
      
      {/* ================= HERO STAGE (SHOUTS THE GAME'S UI & DISCORD COMMUNITY IDENTITY) ================= */}
      <div className="relative h-60 sm:h-64 overflow-hidden shadow-xl">
        <img src={theme.art} alt={game.name} className="absolute inset-0 h-full w-full object-cover scale-105" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(11,27,42,0.7) 0%, rgba(11,27,42,0.3) 35%, rgba(11,27,42,0.85) 75%, rgba(11,27,42,0.98) 100%)'
          }}
        />

        {/* Top bar */}
        <div className="relative flex items-center justify-between px-4 sm:px-6 pt-4 z-10">
          <button
            type="button"
            onClick={() => { soundEngine.play('tap'); onClose(); }}
            className="flex items-center space-x-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold bg-black/60 hover:bg-black/80 text-white border border-white/20 backdrop-blur-md cursor-pointer transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Gaming Hubs</span>
          </button>

          <div className="flex items-center space-x-2">
            <span className="rounded-full px-3 py-1 text-[10px] font-mono font-black tracking-wider bg-[#FF5A1F] text-white shadow-md">
              {activity > 0 ? `${activity} IN LOBBY` : 'COMMUNITY READY'}
            </span>
          </div>
        </div>

        {/* Title block */}
        <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 pb-4 z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <span className="text-[10px] font-black tracking-[0.2em] px-2 py-0.5 rounded-md bg-[#FF5A1F] text-white uppercase shadow">
              {theme.providerMark} • AFRICAN COMMUNITY HUB
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-1">
              {game.name}
            </h2>
          </div>

          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => {
                soundEngine.play('tap');
                setIsLeagueModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-white text-[#0D1117] font-black text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-lg hover:bg-gray-100 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#FF5A1F]" />
              <span>Create Tournament Room</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= MAIN CONTAINER ================= */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        
        {/* Identity & Room Coordinator Bar */}
        <div className="rounded-2xl bg-white border border-[#E5E8EC] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 font-bold block">
              YOUR GAMER TAG (DISCORD FOR AFRICA SYNC):
            </span>
            <span className="text-base font-black text-[#0D1117]">
              {myTag ? `🎮 ${myTag}` : 'No Tag Linked — Tap "Play As" on Lobby to set'}
            </span>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Opponents copy your tag to invite you in-game (PSN / Xbox / Mobile ID).
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              disabled={availabilityBusy}
              onClick={() => { soundEngine.play('tap'); onToggleAvailability(); }}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all cursor-pointer ${
                availabilityOn
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20'
                  : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
              }`}
            >
              {availabilityBusy ? 'Updating…' : availabilityOn ? '● Ready for Duels' : 'Go Online to Match'}
            </button>
          </div>
        </div>

        {/* ================= GAME-SPECIFIC PLACARD CARDS ================= */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.18em] text-[#0D1117]">
                Live Community Challenge Placards
              </h3>
              <p className="text-[11px] text-[#0D1117]/60">
                Lifted challenge templates: Golden Goal, Speed Blitz & Squad Pinboards
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {communityPlacards.map((placard) => (
              <div
                key={placard.id}
                className={`rounded-3xl bg-gradient-to-br ${placard.bgGradient} border border-white/10 text-white p-5 shadow-xl flex flex-col justify-between group hover:border-[#00BFEF]/50 transition-all`}
              >
                {/* Top Ribbon */}
                <div className="flex items-center justify-between mb-2">
                  <span 
                    className="text-[9px] font-mono font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
                    style={{ backgroundColor: `${placard.tagColor}25`, color: placard.tagColor, border: `1px solid ${placard.tagColor}50` }}
                  >
                    {placard.tag}
                  </span>

                  <div className="flex items-center space-x-1 text-[10px] font-mono text-gray-300 bg-black/50 px-2 py-0.5 rounded">
                    <Clock className="w-3 h-3 text-[#FF5A1F]" />
                    <span>{placard.endsIn}</span>
                  </div>
                </div>

                {/* Title & Desc */}
                <div className="my-2 space-y-1">
                  <h4 className="text-lg font-black text-white group-hover:text-[#00BFEF] transition-colors">
                    {placard.title}
                  </h4>
                  <p className="text-xs text-[#DCE2E6]/80 line-clamp-2">
                    {placard.desc}
                  </p>
                </div>

                {/* Rewards */}
                <div className="my-2 pt-2 border-t border-white/10 flex flex-wrap gap-1.5">
                  {placard.rewards.map((r, i) => (
                    <span key={i} className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-black/40 text-gray-200 border border-white/5">
                      {r}
                    </span>
                  ))}
                </div>

                {/* Dual Pill Buttons (Enter Room & Details) */}
                <div className="pt-3 border-t border-white/10 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleLaunchPlacard(placard)}
                    className="flex-1 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-[#0D1117] font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-md transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Enter Room</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.play('tap');
                      setSelectedPlacardForDetails(placard);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-black/50 hover:bg-black/80 border border-white/20 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Rules
                  </button>
                </div>

              </div>
            ))}
          </div>
        </section>

        {/* ================= MATCHROOM COMPOSER (STAKED / RANKED / FRIENDLY) ================= */}
        <div className="rounded-3xl bg-white border border-[#E5E8EC] p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#EFF1F4] pb-3">
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.16em] text-[#0D1117]">
                Open a Matchroom in #{game.shortName.toLowerCase()}-hub
              </h3>
              <p className="text-[11px] text-[#0D1117]/60">
                Coordinate duel format, KES stakes, and share your room invite
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-[#FF5A1F]">
              {mode} • {STAKES.find((s) => s.id === stake)?.label}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Mode Selector */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1.5">
                Game Mode
              </label>
              <div className="flex flex-wrap gap-1.5">
                {game.modes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { soundEngine.play('tap'); setMode(m); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      mode === m ? 'bg-[#FF5A1F] text-white border-[#FF5A1F]' : 'bg-gray-50 border-gray-200 text-gray-700'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Stake Selector */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1.5">
                Stake Type
              </label>
              <div className="flex flex-wrap gap-1.5">
                {STAKES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { soundEngine.play('tap'); setStake(s.id); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      stake === s.id ? 'bg-[#0D1117] text-white border-[#0D1117]' : 'bg-gray-50 border-gray-200 text-gray-700'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Staked Entry Fee Picker */}
          {stake === 'entry_fee' && (
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-gray-500 block">Agreed Stake per Player</span>
                <div className="flex items-center space-x-1 mt-1">
                  <span className="font-mono text-sm font-bold text-gray-500">KES</span>
                  <input
                    type="number"
                    value={entryFee}
                    onChange={(e) => setEntryFee(e.target.value)}
                    className="w-24 bg-white border border-gray-300 rounded-lg px-2.5 py-1 text-sm font-mono font-bold text-[#0D1117] focus:outline-none focus:border-[#FF5A1F]"
                  />
                </div>
              </div>

              <div className="flex space-x-1.5">
                {[100, 200, 500, 1000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => { soundEngine.play('tap'); setEntryFee(String(val)); }}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-white border border-gray-200 hover:border-[#FF5A1F] cursor-pointer"
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Room PIN / Note */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
              Room Note & Invite Code (e.g. "PS5 Nairobi / Room Code #4920")
            </label>
            <input
              type="text"
              maxLength={80}
              value={roomNote}
              onChange={(e) => setRoomNote(e.target.value)}
              placeholder="e.g. Host on PS5, room code 8849, 10-min match"
              className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-[#0D1117] focus:outline-none focus:border-[#FF5A1F]"
            />
          </div>

          {/* Open Window */}
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase">Room Open For:</span>
            {WINDOWS.map((w) => (
              <button
                key={w.minutes}
                type="button"
                onClick={() => { soundEngine.play('tap'); setWindowMinutes(w.minutes); }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                  windowMinutes === w.minutes ? 'bg-[#FF5A1F] text-white border-[#FF5A1F]' : 'bg-gray-50 border-gray-200 text-gray-600'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>

          {/* Submit Action */}
          <button
            type="button"
            disabled={!canCreate}
            onClick={handleCreate}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#FF5A1F] to-[#FF8A00] hover:brightness-110 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-[#FF5A1F]/25 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {creating ? (
              <span>Opening Matchroom…</span>
            ) : stake === 'entry_fee' ? (
              <span>Open Staked {mode} Matchroom (KES {feeValid ? feeNum : '—'})</span>
            ) : (
              <span>Open {stake === 'ranked' ? 'Ranked' : 'Friendly'} {mode} Duel</span>
            )}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* ================= OPEN MATCHES & ROOM INVITES ================= */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-[0.16em] text-[#0D1117]">
              Open Matchrooms ({challenges.length})
            </h3>
          </div>

          {challenges.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white border border-[#E5E8EC] text-center text-xs text-gray-500">
              No open matchrooms in #{game.shortName.toLowerCase()}-hub right now. Open a room or launch a placard template above!
            </div>
          ) : (
            <div className="space-y-2">
              {challenges.map((c) => {
                const mine = Boolean(myPlayerId) && c.createdByPlayerId === myPlayerId;
                const busy = busyId === c.id;
                return (
                  <div
                    key={c.id}
                    className="rounded-2xl bg-white border border-[#E5E8EC] p-3.5 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-[#0D1117]">{c.mode}</span>
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          c.stake === 'entry_fee' ? 'bg-[#FF5A1F]/15 text-[#FF5A1F]' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {c.stake === 'entry_fee' ? `STAKED KES ${c.entryFeeKes}` : c.stake.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-500 block mt-0.5">
                        {mine ? 'Your open matchroom' : 'Challenger ready in room'}
                      </span>
                    </div>

                    <div>
                      {mine ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => { soundEngine.play('tap'); onCancelChallenge(c); }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-100 cursor-pointer"
                        >
                          Close Room
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => { soundEngine.play('heavyTap'); onAcceptChallenge(c); }}
                          className="px-4 py-1.5 rounded-xl bg-[#0D1117] hover:bg-[#1E2633] text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
                        >
                          Join & Duel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Placard Details Modal */}
      {selectedPlacardForDetails && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-[#0B1B2A] border border-[#173247] rounded-3xl p-5 text-white space-y-4 shadow-2xl">
            <div className="flex justify-between items-start border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FF5A1F] text-white font-bold">
                  {selectedPlacardForDetails.tag}
                </span>
                <h3 className="text-xl font-black text-white mt-1">{selectedPlacardForDetails.title}</h3>
              </div>
              <button
                onClick={() => setSelectedPlacardForDetails(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">{selectedPlacardForDetails.desc}</p>

            <div className="p-3 bg-[#173247] rounded-2xl space-y-1 text-xs">
              <span className="font-bold text-white block">Room Coordination & Rules:</span>
              <span className="text-[#00BFEF] font-mono">{selectedPlacardForDetails.multiplier}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                const p = selectedPlacardForDetails;
                setSelectedPlacardForDetails(null);
                handleLaunchPlacard(p);
              }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF5A1F] to-[#FF8A00] text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              Enter Room & Challenge
            </button>
          </div>
        </div>
      )}

      {/* Custom League Creator Modal */}
      <CustomLeagueModal
        isOpen={isLeagueModalOpen}
        onClose={() => setIsLeagueModalOpen(false)}
        gameId={game.id}
        gameName={game.name}
        onCreateLeague={(league) => {
          onCreateChallenge({
            mode: league.format,
            stake: league.entryFeeKes > 0 ? 'entry_fee' : 'ranked',
            entryFeeKes: league.entryFeeKes > 0 ? league.entryFeeKes : undefined,
            note: `${league.title} (${league.format}) - KES ${league.entryFeeKes}`,
            openMinutes: 240
          });
        }}
      />

    </div>
  );
}

export default ArenaGameScreen;
