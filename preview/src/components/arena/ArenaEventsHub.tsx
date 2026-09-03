import React, { useState } from 'react';
import { 
  Trophy, 
  Flame, 
  Users, 
  Sparkles, 
  Clock, 
  Coins, 
  Zap, 
  CheckCircle2, 
  X, 
  Play, 
  ShieldCheck,
  MapPin,
  ArrowRight
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface RegionalTournamentEvent {
  id: string;
  title: string;
  category: 'Ranked Regional' | 'Staked Duel' | 'Co-op Squad' | 'Community Cup';
  categoryColor: string;
  region: string;
  endsIn: string;
  description: string;
  bgGradient: string;
  badgeTag: string;
  prizePoolKes: number;
  entryFeeKes: number;
  matchType: string;
  registeredCount: number;
  maxSlots: number;
}

export const REGIONAL_EVENTS: RegionalTournamentEvent[] = [
  {
    id: 'nairobi-ranked-championship',
    title: 'Nairobi County Ranked Championship',
    category: 'Ranked Regional',
    categoryColor: '#2563EB',
    region: 'Nairobi County',
    endsIn: '3 days left',
    description: 'Competitive 1v1 county ladder. Win matches, climb the Nairobi Elo leaderboard, and qualify for the seasonal finals.',
    bgGradient: 'from-[#0B1B2A] via-[#173247] to-[#0D1117]',
    badgeTag: 'NAIROBI DIV 1',
    prizePoolKes: 15000,
    entryFeeKes: 200,
    matchType: '1v1 Standard (10 Mins • Extra Time & Penalties)',
    registeredCount: 42,
    maxSlots: 64
  },
  {
    id: 'coast-golden-goal-duel',
    title: 'Coast Golden Goal Sprint Duel',
    category: 'Staked Duel',
    categoryColor: '#FF5A1F',
    region: 'Mombasa / Coast',
    endsIn: 'Tonight • 8:00 PM',
    description: 'Sudden death stakes: the first player to score wins the match and claims the escrow prize pool.',
    bgGradient: 'from-[#2B0E1E] via-[#42152F] to-[#0D1117]',
    badgeTag: 'SUDDEN DEATH',
    prizePoolKes: 5000,
    entryFeeKes: 100,
    matchType: '1v1 Sudden Death Golden Goal',
    registeredCount: 16,
    maxSlots: 16
  },
  {
    id: 'lake-basin-coop-clash',
    title: 'Lake Basin Co-op 3v3 Syndicate',
    category: 'Co-op Squad',
    categoryColor: '#10B981',
    region: 'Kisumu / Western',
    endsIn: 'Saturday • 2:00 PM',
    description: 'Squad up with 2 clan teammates. Co-op room matchmaking with synchronized voice chat coordination.',
    bgGradient: 'from-[#0E261B] via-[#143B2A] to-[#0D1117]',
    badgeTag: '3v3 SQUAD',
    prizePoolKes: 12000,
    entryFeeKes: 300,
    matchType: '3v3 Co-op Clan Lobby (12 Mins)',
    registeredCount: 10,
    maxSlots: 16
  },
  {
    id: 'rift-valley-open-cup',
    title: 'Rift Valley Community Open Cup',
    category: 'Community Cup',
    categoryColor: '#8B5CF6',
    region: 'Eldoret / Nakuru',
    endsIn: 'Sunday • 4:00 PM',
    description: 'Community-organized open bracket tournament hosted by the Rift Valley Esports League.',
    bgGradient: 'from-[#170E2B] via-[#261545] to-[#0D1117]',
    badgeTag: 'COMMUNITY',
    prizePoolKes: 8000,
    entryFeeKes: 150,
    matchType: '1v1 Group Stage into Top 8 Playoffs',
    registeredCount: 28,
    maxSlots: 32
  }
];

interface ArenaEventsHubProps {
  onEnterEvent: (event: RegionalTournamentEvent) => void;
  myTag: string | null;
}

export const ArenaEventsHub: React.FC<ArenaEventsHubProps> = ({ onEnterEvent, myTag }) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<RegionalTournamentEvent | null>(null);

  const categories = [
    { id: 'all', label: `All Tournaments (${REGIONAL_EVENTS.length})` },
    { id: 'Ranked Regional', label: 'Ranked Regional' },
    { id: 'Staked Duel', label: 'Staked Duels' },
    { id: 'Co-op Squad', label: 'Co-op Squads' },
    { id: 'Community Cup', label: 'Community Cups' },
  ];

  const filteredEvents = REGIONAL_EVENTS.filter(e => {
    if (activeCategory === 'all') return true;
    return e.category === activeCategory;
  });

  const handleEnter = (event: RegionalTournamentEvent) => {
    soundEngine.play('victory');
    onEnterEvent(event);
  };

  return (
    <div className="space-y-5">
      
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#0B1B2A] via-[#173247] to-[#0B1B2A] border border-[#173247] p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5A1F] animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5A1F] font-bold">
                REGIONAL COMPETITIVE TOURNAMENTS
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              African Regional Ladders & Staked Match Hub
            </h2>
            <p className="text-xs text-[#DCE2E6]/80 leading-relaxed">
              Compete for real value. Join county tournaments, challenge rivals to staked 1v1s, or create independent clan leagues with M-Pesa prize pool escrow.
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-black/40 border border-white/10 rounded-2xl p-3 text-xs font-mono">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-[10px] text-gray-400 block font-bold">ESCROW SECURED</span>
              <span className="text-white font-bold">Instant M-Pesa Payouts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Filter Strip */}
      <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-1">
        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => {
              soundEngine.play('tap');
              setActiveCategory(c.id);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeCategory === c.id
                ? 'bg-[#FF5A1F] text-white shadow-md font-black'
                : 'bg-[#FFFFFF] border border-[#E5E8EC] text-[#0D1117]/70 hover:border-[#2563EB]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredEvents.map(event => (
          <div
            key={event.id}
            className={`group relative rounded-3xl p-5 border border-[#E5E8EC] bg-white text-[#0D1117] shadow-sm hover:shadow-xl hover:border-[#FF5A1F] transition-all flex flex-col justify-between space-y-4`}
          >
            <div>
              {/* Category Pill & EndsIn */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {event.region}
                  </span>
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase bg-gray-100 text-gray-700">
                    {event.badgeTag}
                  </span>
                </div>

                <div className="flex items-center space-x-1 text-[11px] font-mono text-gray-500">
                  <Clock className="w-3.5 h-3.5 text-[#F58220]" />
                  <span>{event.endsIn}</span>
                </div>
              </div>

              {/* Event Title & Description */}
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black text-[#0D1117] tracking-tight leading-snug">
                  {event.title}
                </h3>
                <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                  {event.description}
                </p>
              </div>

              {/* Prize & Entry Stats */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100 font-mono text-xs">
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[9px] text-emerald-600 block uppercase font-bold">PRIZE POOL</span>
                  <span className="font-black text-emerald-800 text-sm">
                    KES {event.prizePoolKes.toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[9px] text-gray-500 block uppercase font-bold">ENTRY / SLOTS</span>
                  <span className="font-black text-[#0D1117] text-sm">
                    KES {event.entryFeeKes} · {event.registeredCount}/{event.maxSlots}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-gray-100 flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleEnter(event)}
                className="flex-1 py-2.5 rounded-xl bg-[#0D1117] hover:bg-black text-white font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-md transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Join Tournament</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.play('tap');
                  setSelectedEvent(event);
                }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-[#0D1117] font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Rules & Format
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white border border-[#E5E8EC] rounded-3xl p-5 sm:p-6 text-[#0D1117] space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold uppercase">
                  {selectedEvent.region}
                </span>
                <h3 className="text-xl font-black text-[#0D1117] mt-1">{selectedEvent.title}</h3>
                <span className="text-xs text-gray-500 font-mono">Ends in: {selectedEvent.endsIn}</span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <h4 className="font-bold text-sm text-[#0D1117] mb-1">Match Format & Rules</h4>
                <p className="text-gray-600 leading-relaxed">{selectedEvent.matchType}</p>
                <p className="text-gray-600 leading-relaxed mt-1">{selectedEvent.description}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100 space-y-1">
                <span className="font-bold text-indigo-900 text-xs block">Fair-Play Escrow Guarantee:</span>
                <p className="text-[11px] text-indigo-800 leading-relaxed">
                  Stakes and prize pools are held securely by Brief. Scores are confirmed by both players or verified via match screenshots.
                </p>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => {
                  const ev = selectedEvent;
                  setSelectedEvent(null);
                  handleEnter(ev);
                }}
                className="flex-1 py-3 rounded-xl bg-[#FF5A1F] hover:bg-[#ff6f3b] text-white font-bold text-xs uppercase tracking-wider shadow-lg cursor-pointer"
              >
                Register For KES {selectedEvent.entryFeeKes}
              </button>
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#0D1117] font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
