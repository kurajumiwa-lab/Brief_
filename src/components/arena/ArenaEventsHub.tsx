import React, { useState } from 'react';
import { 
  Trophy, 
  Flame, 
  Users, 
  Sparkles, 
  Clock, 
  Gift, 
  Coins, 
  Zap, 
  CheckCircle2, 
  X, 
  ChevronRight, 
  ArrowRight,
  Shield,
  Play,
  Info,
  Layers,
  Star
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface ArenaEvent {
  id: string;
  title: string;
  category: 'Challenge Event' | 'Tour Event' | 'Co-op PvP Event' | 'Themed Event' | 'Co-op VS AI Event' | 'Challenge Event (Theme)';
  categoryColor: string;
  endsIn: string;
  description: string;
  bgGradient: string;
  bgImage?: string;
  badgeTag?: string;
  rewards: {
    label: string;
    icon: string;
    value?: string;
    color: string;
  }[];
  bonusMultiplier?: string;
  matchType: string;
  entryFeeKes?: number;
}

export const ARENA_EVENTS: ArenaEvent[] = [
  {
    id: 'beat-the-clock',
    title: 'Beat the Clock vol.1',
    category: 'Challenge Event',
    categoryColor: '#EF4444',
    endsIn: '6 day(s) 18 hr(s)',
    description: 'Score within the target time frame! Accumulate Event Points by completing high-speed blitz match challenges.',
    bgGradient: 'from-[#2D0B0B] via-[#451212] to-[#1F0707]',
    badgeTag: 'BLITZ SPEED',
    rewards: [
      { label: 'Skill Training Program', icon: '👟', value: '+1', color: '#10B981' },
      { label: 'Exp 10,000 Token', icon: '⚡', value: 'x2', color: '#F59E0B' }
    ],
    bonusMultiplier: '+150% Blitz Bonus',
    matchType: '1v1 High-Speed Blitz',
  },
  {
    id: 'golden-goal',
    title: 'Golden Goal',
    category: 'Challenge Event',
    categoryColor: '#F59E0B',
    endsIn: '4 day(s) 12 hr(s)',
    description: 'Golden Goal rules apply in this Event. The match enters sudden death: the first side to score a goal is decided as the winner.',
    bgGradient: 'from-[#1A1408] via-[#2A1F0C] to-[#0D1117]',
    badgeTag: 'SUDDEN DEATH',
    rewards: [
      { label: 'Exp 10,000 Training', icon: '🏆', value: 'x1', color: '#F59E0B' },
      { label: '50 eFootball Coins', icon: '🪙', value: '50 Coins', color: '#00BFEF' }
    ],
    bonusMultiplier: 'Sudden Death Winner Takes All',
    matchType: '1v1 Sudden Death',
  },
  {
    id: 'flexible-yugioh',
    title: 'Flexible feat. Yu-Gi-Oh! vol. 2',
    category: 'Challenge Event',
    categoryColor: '#3B82F6',
    endsIn: '13 day(s) 18 hr(s)',
    description: 'Play in stadiums with special designs made in collaboration with Yu-Gi-Oh! Trading Card Game!',
    bgGradient: 'from-[#0B172A] via-[#122847] to-[#0D1117]',
    badgeTag: 'YU-GI-OH! COLLAB',
    rewards: [
      { label: 'Goal Projection', icon: '🃏', value: 'Special HUD', color: '#8B5CF6' },
      { label: 'Kick-off Projection', icon: '✨', value: 'Unlocked', color: '#10B981' },
      { label: 'Yu-Gi-Oh! Campaign Badge', icon: '🎴', value: 'Exclusive', color: '#F59E0B' }
    ],
    bonusMultiplier: '+200% Collab Bonus',
    matchType: 'Themed Stadium Event',
  },
  {
    id: 'european-club-championship',
    title: 'European Club Championship',
    category: 'Tour Event',
    categoryColor: '#8B5CF6',
    endsIn: '6 day(s) 18 hr(s)',
    description: 'Play matches in this Event with increased Player Bonuses and Match Level Bonuses. Collect points based on match results.',
    bgGradient: 'from-[#170E2B] via-[#261545] to-[#0D1117]',
    badgeTag: 'UCL CLUBS',
    rewards: [
      { label: 'Chance Deal', icon: '🎁', value: 'x1', color: '#EC4899' },
      { label: '500 eFootball Points', icon: '🪙', value: '500 pts', color: '#00BFEF' },
      { label: '30,000 GP', icon: '💎', value: '30k GP', color: '#3B82F6' }
    ],
    bonusMultiplier: '+240% Club Multiplier',
    matchType: 'PvP & AI Tour Event',
  },
  {
    id: 'european-clubs-diwali',
    title: 'European Clubs',
    category: 'Tour Event',
    categoryColor: '#EF4444',
    endsIn: '13 day(s) 18 hr(s)',
    description: 'Compete against European elite clubs (Manchester United, Bayern, Barcelona). Field squad players from featured leagues for bonus points.',
    bgGradient: 'from-[#2D0B0B] via-[#481212] to-[#170E2B]',
    badgeTag: 'DIWALI CAMPAIGN',
    rewards: [
      { label: 'Random Booster Token', icon: '🚀', value: 'x1', color: '#10B981' },
      { label: 'Random Skill Token', icon: '👟', value: 'x1', color: '#00BFEF' },
      { label: 'Exp 10,000 Token', icon: '⚡', value: 'x2', color: '#F59E0B' }
    ],
    bonusMultiplier: '+200% Event Points',
    matchType: 'European Tour',
  },
  {
    id: 'english-clubs',
    title: 'English Clubs',
    category: 'Tour Event',
    categoryColor: '#00BFEF',
    endsIn: '6 day(s) 18 hr(s)',
    description: 'Play matches in this Event with Arsenal, Chelsea, Liverpool and Man City squads. Accumulate points towards milestone rewards.',
    bgGradient: 'from-[#0B1B2A] via-[#173247] to-[#0D1117]',
    badgeTag: 'PREMIER TOUR',
    rewards: [
      { label: 'Chance Deal', icon: '🎁', value: 'x1', color: '#EC4899' },
      { label: '500 eFootball Points', icon: '🪙', value: '500 pts', color: '#00BFEF' },
      { label: '30,000 GP', icon: '💎', value: '30k GP', color: '#3B82F6' }
    ],
    bonusMultiplier: '+180% EPL Multiplier',
    matchType: 'English Clubs Tour',
  },
  {
    id: 'spanish-clubs',
    title: 'Spanish Clubs',
    category: 'Themed Event',
    categoryColor: '#EC4899',
    endsIn: '4 day(s) 11 hr(s)',
    description: 'Event Conditions Apply: Receive rewards by completing challenges while playing PvP matches. Bonus applied for La Liga players.',
    bgGradient: 'from-[#2B0E1E] via-[#42152F] to-[#0D1117]',
    badgeTag: 'LA LIGA DERBY',
    rewards: [
      { label: 'Chance Deal Spanish 24-25', icon: '🎁', value: 'x1', color: '#EC4899' },
      { label: 'Skill Training Program', icon: '👟', value: 'x2', color: '#10B981' }
    ],
    bonusMultiplier: '+220% Spanish Multiplier',
    matchType: 'La Liga Themed PvP',
  },
  {
    id: 'national-teams',
    title: 'National Teams',
    category: 'Themed Event',
    categoryColor: '#10B981',
    endsIn: '6 day(s) 18 hr(s)',
    description: 'Represent your country in PvP challenge matches. Complete challenges to receive exclusive National Team packs.',
    bgGradient: 'from-[#0E261B] via-[#143B2A] to-[#0D1117]',
    badgeTag: 'INTERNATIONALS',
    rewards: [
      { label: 'Chance Deal National 24-25', icon: '🎁', value: 'x1', color: '#10B981' },
      { label: 'Skill Training Program', icon: '👟', value: 'x2', color: '#00BFEF' }
    ],
    bonusMultiplier: '+200% National Bonus',
    matchType: 'International PvP',
  },
  {
    id: 'teamplay-fun',
    title: 'Teamplay Fun',
    category: 'Co-op PvP Event',
    categoryColor: '#F59E0B',
    endsIn: '13 day(s) 18 hr(s)',
    description: 'Take part in an Event that you can join alone or with friends in a 2v2 or 3v3 PvP match. Look out for the Bonus Multipliers.',
    bgGradient: 'from-[#1F170A] via-[#332610] to-[#0D1117]',
    badgeTag: '2v2 / 3v3 CO-OP',
    rewards: [
      { label: 'Random Skill Token', icon: '👟', value: 'x1', color: '#10B981' },
      { label: 'Co-op Teamplay Badge', icon: '⭐', value: 'Trophy', color: '#F59E0B' }
    ],
    bonusMultiplier: '+300% Teamplay Multiplier',
    matchType: 'Co-op Multi-Player',
  },
  {
    id: 'united-team-ai',
    title: 'United Team',
    category: 'Co-op VS AI Event',
    categoryColor: '#06B6D4',
    endsIn: '13 day(s) 18 hr(s)',
    description: 'Cooperate with up to 3 friends online in AI-controlled teammates or play against the AI opponent to earn Event Points.',
    bgGradient: 'from-[#081F26] via-[#0F3540] to-[#0D1117]',
    badgeTag: 'CO-OP VS AI',
    rewards: [
      { label: 'Skill Training Program', icon: '👟', value: '+1', color: '#10B981' },
      { label: '20,000 GP', icon: '💎', value: '20k GP', color: '#00BFEF' }
    ],
    bonusMultiplier: '+150% AI Challenge',
    matchType: '3-Player Co-op vs AI',
  }
];

interface ArenaEventsHubProps {
  onEnterEvent: (event: ArenaEvent) => void;
  myTag: string | null;
}

export const ArenaEventsHub: React.FC<ArenaEventsHubProps> = ({ onEnterEvent, myTag }) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedEventForDetails, setSelectedEventForDetails] = useState<ArenaEvent | null>(null);
  const [enteringEvent, setEnteringEvent] = useState<ArenaEvent | null>(null);
  const [selectedSquad, setSelectedSquad] = useState<string>('Default Active Squad');

  const categories = [
    { id: 'all', label: 'All Live Events' },
    { id: 'Challenge Event', label: 'Challenge Events' },
    { id: 'Tour Event', label: 'Tour Events' },
    { id: 'Themed Event', label: 'Themed Clubs & Nations' },
    { id: 'Co-op PvP Event', label: 'Co-op 2v2/3v3' },
  ];

  const filteredEvents = ARENA_EVENTS.filter(e => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'Themed Event') return e.category.includes('Themed') || e.category.includes('National') || e.category.includes('Spanish');
    return e.category === activeCategory;
  });

  const handleEnter = (event: ArenaEvent) => {
    soundEngine.play('tap');
    setEnteringEvent(event);
  };

  const handleConfirmEnter = () => {
    if (!enteringEvent) return;
    soundEngine.play('cheer');
    onEnterEvent(enteringEvent);
    setEnteringEvent(null);
  };

  return (
    <div className="space-y-5">
      
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#0B1B2A] via-[#173247] to-[#0B1B2A] border border-[#173247] p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-full opacity-20 pointer-events-none bg-cover bg-right" style={{ backgroundImage: "url('/assets/arena/efootball_events_summary.jpg')" }}></div>
        
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5A1F] animate-pulse"></span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#00BFEF] font-bold">
                eFOOTBALL 2026 LIVE EVENTS & TOURS
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Featured Arena Events & Championships
            </h2>
            <p className="text-xs text-[#DCE2E6]/80 max-w-xl leading-relaxed">
              Play Challenge Events, Tour Events, and Co-op PvP to claim Chance Deals, GP, Skill Tokens, and climb the season ladder.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono px-3 py-1.5 rounded-xl bg-black/40 border border-[#00BFEF]/40 text-[#00BFEF] font-bold">
              10 Active Live Events
            </span>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex space-x-2 mt-4 overflow-x-auto pb-1 pt-2 border-t border-white/10">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                soundEngine.play('tap');
                setActiveCategory(cat.id);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-[#FF5A1F] text-white font-bold shadow-md shadow-[#FF5A1F]/30'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events Grid (Faithfully clones the cards layout & cloned backgrounds from screenshots) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredEvents.map((event) => (
          <div
            key={event.id}
            className={`rounded-3xl bg-gradient-to-br ${event.bgGradient} border border-white/10 text-white p-5 shadow-2xl flex flex-col justify-between relative overflow-hidden group hover:border-[#00BFEF]/60 transition-all`}
          >
            {/* Top Event Ribbon */}
            <div className="flex items-center justify-between mb-2 z-10">
              <span 
                className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                style={{ backgroundColor: `${event.categoryColor}25`, color: event.categoryColor, border: `1px solid ${event.categoryColor}50` }}
              >
                {event.category}
              </span>

              <div className="flex items-center space-x-1.5 text-[11px] font-mono text-gray-300 bg-black/50 px-2 py-0.5 rounded-md border border-white/5">
                <Clock className="w-3 h-3 text-[#FF5A1F]" />
                <span>Ends in: {event.endsIn}</span>
              </div>
            </div>

            {/* Event Title & Description */}
            <div className="space-y-1.5 my-2 z-10">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight leading-tight group-hover:text-[#00BFEF] transition-colors">
                  {event.title}
                </h3>
                {event.badgeTag && (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-[#FF5A1F] text-white rounded">
                    {event.badgeTag}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#DCE2E6]/80 line-clamp-2 leading-relaxed">
                {event.description}
              </p>
            </div>

            {/* Rewards Strip */}
            <div className="my-3 pt-2.5 border-t border-white/10 z-10">
              <span className="text-[10px] font-mono uppercase text-gray-400 font-bold block mb-1.5">
                Rewards:
              </span>
              <div className="flex flex-wrap gap-2">
                {event.rewards.map((r, i) => (
                  <div 
                    key={i} 
                    className="flex items-center space-x-1.5 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1 text-xs"
                  >
                    <span className="text-sm">{r.icon}</span>
                    <span className="font-semibold text-white text-[11px]">{r.label}</span>
                    {r.value && (
                      <span className="font-mono text-[10px] font-bold" style={{ color: r.color }}>
                        {r.value}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons (Enter & Details) */}
            <div className="pt-3 border-t border-white/10 flex items-center space-x-2.5 z-10">
              <button
                type="button"
                onClick={() => handleEnter(event)}
                className="flex-1 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-[#0D1117] font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-lg shadow-white/10 transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Enter</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.play('tap');
                  setSelectedEventForDetails(event);
                }}
                className="px-4 py-2.5 rounded-xl bg-black/60 hover:bg-black/90 border border-white/20 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Details
              </button>
            </div>

          </div>
        ))}
      </div>

      {/* Event Details Modal */}
      {selectedEventForDetails && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg bg-[#0B1B2A] border border-[#173247] rounded-3xl p-5 sm:p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FF5A1F] text-white font-bold uppercase">
                  {selectedEventForDetails.category}
                </span>
                <h3 className="text-xl font-black text-white mt-1">{selectedEventForDetails.title}</h3>
                <span className="text-xs text-gray-400 font-mono">Ends in: {selectedEventForDetails.endsIn}</span>
              </div>
              <button
                onClick={() => setSelectedEventForDetails(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <h4 className="font-bold text-sm text-[#00BFEF] mb-1">Event Overview & Format</h4>
                <p className="text-gray-300 leading-relaxed">{selectedEventForDetails.description}</p>
              </div>

              <div className="p-3 rounded-2xl bg-[#173247]/60 border border-white/5 space-y-2">
                <span className="font-bold text-white text-xs block">Player Bonus Multipliers:</span>
                <p className="text-[11px] text-gray-300">
                  Fielding players from featured clubs in this event grants <strong className="text-emerald-400">{selectedEventForDetails.bonusMultiplier}</strong> to match event points.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-white mb-2">Rewards Milestone Schedule</h4>
                <div className="space-y-1.5">
                  {selectedEventForDetails.rewards.map((r, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 rounded-xl bg-black/40 border border-white/5">
                      <span className="flex items-center space-x-2">
                        <span>{r.icon}</span>
                        <span>{r.label}</span>
                      </span>
                      <span className="font-mono font-bold" style={{ color: r.color }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  const ev = selectedEventForDetails;
                  setSelectedEventForDetails(null);
                  handleEnter(ev);
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF5A1F] to-[#FF8A00] hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider shadow-lg cursor-pointer"
              >
                Enter Event Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enter Event Squad Selector & Queue Modal */}
      {enteringEvent && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-[#0B1B2A] border border-[#173247] rounded-3xl p-5 sm:p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#00BFEF] font-bold uppercase">READY TO PLAY</span>
                <h3 className="text-lg font-black text-white">{enteringEvent.title}</h3>
                <span className="text-xs text-gray-400">{enteringEvent.matchType}</span>
              </div>
              <button
                onClick={() => setEnteringEvent(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 font-bold mb-1">Select Squad / Team Selection:</label>
                <select
                  value={selectedSquad}
                  onChange={(e) => setSelectedSquad(e.target.value)}
                  className="w-full bg-[#173247] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00BFEF]"
                >
                  <option value="FC Barcelona (La Liga)">FC Barcelona (La Liga Featured +220%)</option>
                  <option value="Manchester United (EPL)">Manchester United (Diwali Featured +200%)</option>
                  <option value="Arsenal FC (EPL)">Arsenal FC (Tour Bonus +180%)</option>
                  <option value="England National Squad">England National Team (International)</option>
                  <option value="AC Milan (Yu-Gi-Oh! Collab)">AC Milan Away (Yu-Gi-Oh! Special)</option>
                  <option value="Custom Dream Team">Custom Dream Team (Standard)</option>
                </select>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between text-xs font-mono">
                <span>EVENT MULTIPLIER:</span>
                <span className="text-emerald-400 font-bold">{enteringEvent.bonusMultiplier}</span>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between text-xs font-mono">
                <span>GAMER TAG:</span>
                <span className="text-[#00BFEF] font-bold">{myTag || 'Arena Guest'}</span>
              </div>
            </div>

            <div className="pt-2 flex space-x-2">
              <button
                type="button"
                onClick={() => setEnteringEvent(null)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmEnter}
                className="flex-1 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-[#0D1117] font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-lg cursor-pointer"
              >
                <span>Find Match / Launch Event</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
