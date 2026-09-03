import React, { useState } from 'react';
import {
  Trophy,
  Flame,
  Clock,
  Zap,
  Coins,
  Shield,
  Users,
  X,
  Sparkles,
  Award,
  Play,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

// ---------------------------------------------------------------------------
// REGIONAL TOURNAMENT & MATCH COORDINATOR (HONEST ARENA LAYER)
//
// Honest Value Promise:
// - Brief does NOT host in-game events or offer in-game card packs (only Konami can).
// - Brief connects real African players for:
//   1. Ranked Regional & County Ladders (Nairobi, Mombasa, Kisumu, Eldoret)
//   2. Staked 1v1 & Squad Matches (M-Pesa backed prize escrow)
//   3. Room Code & Gamer Tag Matchmaking
//   4. Community-run Independent Leagues & Tournaments
// ---------------------------------------------------------------------------

export interface RegionalTournament {
  id: string;
  title: string;
  region: string;
  category: 'Ranked Regional' | 'Staked Duel' | 'Co-op Squad' | 'Community Cup';
  prizePoolKes: number;
  entryFeeKes: number;
  registeredCount: number;
  maxSlots: number;
  endsIn: string;
  matchFormat: string;
  rules: string;
  status: 'registration_open' | 'live_matches' | 'concluded';
}

export const REGIONAL_TOURNAMENTS: RegionalTournament[] = [
  {
    id: 'tour_nairobi_championship',
    title: 'Nairobi eFootball Ranked Championship',
    region: 'Nairobi County',
    category: 'Ranked Regional',
    prizePoolKes: 15000,
    entryFeeKes: 200,
    registeredCount: 42,
    maxSlots: 64,
    endsIn: '3 days left',
    matchFormat: '1v1 Standard • 10 Mins • Extra Time & Penalties',
    rules: 'Best of 3 series. Match screenshots submitted for verification.',
    status: 'registration_open'
  },
  {
    id: 'tour_coastal_golden_goal',
    title: 'Coast Golden Goal Sprint',
    region: 'Mombasa / Coast',
    category: 'Staked Duel',
    prizePoolKes: 5000,
    entryFeeKes: 100,
    registeredCount: 16,
    maxSlots: 16,
    endsIn: 'Tonight • 8:00 PM',
    matchFormat: 'Sudden Death • First Goal Wins',
    rules: 'Single elimination bracket. Instant winner payout via M-Pesa.',
    status: 'live_matches'
  },
  {
    id: 'tour_lake_basin_coop',
    title: 'Lake Basin Co-op 3v3 Clash',
    region: 'Kisumu / Western',
    category: 'Co-op Squad',
    prizePoolKes: 12000,
    entryFeeKes: 300,
    registeredCount: 10,
    maxSlots: 16,
    endsIn: 'Saturday • 2:00 PM',
    matchFormat: '3v3 Co-op Lobby • 12 Mins',
    rules: 'Co-op friend match room. Squad captains coordinate in Brief chat.',
    status: 'registration_open'
  },
  {
    id: 'tour_rift_valley_cup',
    title: 'Rift Valley Independent Cup',
    region: 'Eldoret / Nakuru',
    category: 'Community Cup',
    prizePoolKes: 8000,
    entryFeeKes: 150,
    registeredCount: 28,
    maxSlots: 32,
    endsIn: 'Sunday • 4:00 PM',
    matchFormat: '1v1 Round Robin Group Stage into Top 8',
    rules: 'Open community cup organized by Rift Valley Gamers Clan.',
    status: 'registration_open'
  }
];

export function EfootballHighlightBanner({
  onOpenMatches,
  onLaunchChallenge
}: {
  onOpenMatches?: () => void;
  onLaunchChallenge?: () => void;
}) {
  const [copiedCode, setCopiedCode] = useState(false);
  const sampleRoomCode = '7492-0184';

  const handleCopyCode = () => {
    soundEngine.play('tap');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(sampleRoomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#0A0E1A] p-5 sm:p-6 text-white border border-indigo-500/30 shadow-xl">
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-black uppercase bg-[#FF5A1F] text-white">
              REGIONAL MATCHMAKING
            </span>
            <span className="text-xs text-indigo-200 font-bold flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Escrow-Backed Value Tournaments</span>
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black italic uppercase tracking-tight text-white">
            Compete for Value • Play on eFootball
          </h2>
          <p className="text-xs text-indigo-100/80 leading-relaxed">
            Brief matches you with verified regional players for ranked & staked challenges. Coordinate room codes here, play the match in your game, and settle results transparently.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/10">
              <span className="text-gray-400">Quick Match Room:</span>
              <span className="font-black text-amber-300">{sampleRoomCode}</span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="ml-1 text-white hover:text-amber-300 cursor-pointer"
                title="Copy Room Code"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <span className="text-emerald-400 font-bold">● 42 Players Looking for Matches</span>
          </div>
        </div>

        <div className="flex sm:flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              soundEngine.play('heavyTap');
              if (onLaunchChallenge) onLaunchChallenge();
            }}
            className="flex-1 sm:flex-none px-5 py-3 rounded-2xl bg-[#FF5A1F] hover:bg-[#ff6f3b] text-white font-black text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer text-center"
          >
            ⚡ Open 1v1 Staked Match
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              if (onOpenMatches) onOpenMatches();
            }}
            className="flex-1 sm:flex-none px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider border border-white/20 transition-all cursor-pointer text-center"
          >
            Browse Ranked Ladders
          </button>
        </div>
      </div>
    </div>
  );
}

export function EfootballEventsHub({
  onEnterEvent,
  onCreateCustomMatch
}: {
  onEnterEvent?: (tournament: RegionalTournament) => void;
  onCreateCustomMatch?: () => void;
}) {
  const [filter, setFilter] = useState<string>('all');
  const [selectedTournament, setSelectedTournament] = useState<RegionalTournament | null>(null);

  const filtered = REGIONAL_TOURNAMENTS.filter(t => {
    if (filter === 'ranked') return t.category === 'Ranked Regional';
    if (filter === 'staked') return t.category === 'Staked Duel';
    if (filter === 'coop') return t.category === 'Co-op Squad';
    if (filter === 'community') return t.category === 'Community Cup';
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Category Navigation Strip */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-1">
        <div className="flex items-center gap-1.5 min-w-max">
          {[
            { id: 'all', label: `All Tournaments (${REGIONAL_TOURNAMENTS.length})` },
            { id: 'ranked', label: 'Ranked Regional' },
            { id: 'staked', label: 'Staked Duels' },
            { id: 'coop', label: 'Co-op Squads' },
            { id: 'community', label: 'Community Cups' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { soundEngine.play('tap'); setFilter(tab.id); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                filter === tab.id
                  ? 'bg-[#FF5A1F] text-white shadow-sm'
                  : 'bg-[#FFFFFF] border border-[#E5E8EC] text-[#0D1117]/70 hover:text-[#0D1117]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {onCreateCustomMatch && (
          <button
            type="button"
            onClick={onCreateCustomMatch}
            className="shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-black bg-[#2563EB] text-white hover:opacity-90 transition cursor-pointer shadow-xs"
          >
            + Create Custom League
          </button>
        )}
      </div>

      {/* Grid of Tournament Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {filtered.map(t => (
          <div
            key={t.id}
            className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E5E8EC] hover:border-[#FF5A1F] transition-all shadow-xs flex flex-col justify-between space-y-3.5"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {t.region}
                </span>
                <span className="text-[10px] font-mono text-gray-500 font-bold">
                  {t.endsIn}
                </span>
              </div>

              <div>
                <h4 className="text-sm font-black text-[#0D1117] leading-tight">
                  {t.title}
                </h4>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {t.matchFormat}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
                <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[9px] text-emerald-600 block font-bold uppercase">PRIZE POOL</span>
                  <span className="font-black text-emerald-800">
                    KES {t.prizePoolKes.toLocaleString()}
                  </span>
                </div>
                <div className="p-2 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[9px] text-gray-500 block font-bold uppercase">ENTRY / SLOTS</span>
                  <span className="font-black text-[#0D1117]">
                    KES {t.entryFeeKes} · {t.registeredCount}/{t.maxSlots}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('heavyTap');
                  if (onEnterEvent) onEnterEvent(t);
                }}
                className="flex-1 py-2 rounded-xl bg-[#0D1117] hover:bg-black text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer text-center"
              >
                Join Tournament
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('tap');
                  setSelectedTournament(t);
                }}
                className="px-3 py-2 rounded-xl border border-[#E5E8EC] hover:bg-gray-50 text-[#0D1117] font-bold text-xs cursor-pointer"
              >
                Rules & Info
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Tournament Details Modal */}
      {selectedTournament && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E8EC] rounded-3xl max-w-md w-full p-6 space-y-4 text-[#0D1117] shadow-2xl relative">
            <button
              onClick={() => setSelectedTournament(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-black uppercase bg-indigo-50 text-indigo-700">
                {selectedTournament.region}
              </span>
              <h3 className="text-lg font-black text-[#0D1117] pt-1">
                {selectedTournament.title}
              </h3>
              <p className="text-xs text-gray-500">{selectedTournament.matchFormat}</p>
            </div>

            <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-2 text-xs">
              <h5 className="font-bold text-[#0D1117] uppercase tracking-wider text-[10px]">
                Rules & Verification:
              </h5>
              <p className="text-gray-700 leading-relaxed">{selectedTournament.rules}</p>
              <p className="text-indigo-700 font-bold text-[11px] pt-1 border-t border-gray-200">
                🛡️ Staked amounts are held in Brief Escrow and disbursed to the confirmed winner immediately after score validation.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('heavyTap');
                  if (onEnterEvent) onEnterEvent(selectedTournament);
                  setSelectedTournament(null);
                }}
                className="flex-1 py-3 rounded-2xl bg-[#FF5A1F] text-white text-xs font-black uppercase tracking-wider hover:bg-[#ff6f3b] transition shadow-md cursor-pointer"
              >
                Register For KES {selectedTournament.entryFeeKes}
              </button>
              <button
                type="button"
                onClick={() => setSelectedTournament(null)}
                className="px-4 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-[#0D1117] text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
