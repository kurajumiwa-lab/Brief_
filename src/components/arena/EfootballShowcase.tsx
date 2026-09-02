import React, { useState } from 'react';
import {
  Trophy,
  Flame,
  Clock,
  Zap,
  Gift,
  Coins,
  Shield,
  Star,
  Users,
  ChevronRight,
  Info,
  X,
  Sparkles,
  Award,
  Play,
  CheckCircle2,
  ExternalLink,
  ChevronLeft,
  RotateCcw,
  SlidersHorizontal,
  ArrowRight
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

// ---------------------------------------------------------------------------
// EFOOTBALL SHOWCASE & EVENT HUB
//
// Clones the exact eFootball mobile & console UI from reference images:
//   1. Highlight / New Season Selection Contract Pack Banner & Cards (Image 1)
//   2. 8-Grid & 6-Grid Tour & Challenge Event Cards with Rewards (Images 2 & 3)
//   3. Co-op PvP & VS AI Teamplay formation slots with color-coded pins
//   4. Interactive Pack Opening / Contract Draft Sequence with stats reveal
//   5. Event Match Conditions, Difficulty Multipliers & Reward Ladder Modal
// ---------------------------------------------------------------------------

export interface EfootballPlayer {
  id: string;
  name: string;
  rating: number;
  position: 'CF' | 'LWF' | 'RWF' | 'SS' | 'AMF' | 'CMF' | 'DMF' | 'LB' | 'RB' | 'CB' | 'GK';
  club: string;
  league: string;
  clubColor: string;
  stars: number;
  highlightTheme: 'crimson' | 'navy' | 'gold' | 'neon' | 'black';
  avatarInitials: string;
  stats: {
    speed: number;
    dribbling: number;
    finishing: number;
    passing: number;
    defense: number;
    physical: number;
  };
  cardBadge?: string;
}

export interface EfootballEvent {
  id: string;
  title: string;
  category: 'Challenge Event' | 'Tour Event' | 'Co-op PvP Event' | 'Co-op VS AI Event' | 'Themed Event' | 'Play Against Event';
  themeType: 'flame' | 'gold' | 'coop' | 'inter' | 'england' | 'barca' | 'milan' | 'arsenal';
  endsIn: string;
  description: string;
  conditions?: string;
  matchLevel?: string;
  bonusMultiplier?: string;
  rewards: {
    icon: 'skill' | 'exp' | 'chance' | 'points' | 'coins' | 'booster' | 'trophy';
    label: string;
    amount?: string;
    color: string;
  }[];
  coopSlots?: {
    color: string;
    player: string;
    club: string;
    pinLabel: string;
    avatar: string;
  }[];
  featuredClub?: string;
  bonusLabel?: string;
}

export const HIGHLIGHT_PLAYERS: EfootballPlayer[] = [
  {
    id: 'p_mbeumo',
    name: 'Bryan Mbeumo',
    rating: 95,
    position: 'CF',
    club: 'Man United',
    league: 'English League',
    clubColor: '#DA291C',
    stars: 5,
    highlightTheme: 'crimson',
    avatarInitials: 'BM',
    cardBadge: 'HOT STRIKER',
    stats: { speed: 94, dribbling: 91, finishing: 93, passing: 86, defense: 58, physical: 88 }
  },
  {
    id: 'p_shaw',
    name: 'Luke Shaw',
    rating: 93,
    position: 'LB',
    club: 'Man United',
    league: 'English League',
    clubColor: '#DA291C',
    stars: 5,
    highlightTheme: 'crimson',
    avatarInitials: 'LS',
    cardBadge: 'WINGBACK',
    stats: { speed: 89, dribbling: 84, finishing: 72, passing: 89, defense: 91, physical: 90 }
  },
  {
    id: 'p_raphinha',
    name: 'Raphinha',
    rating: 95,
    position: 'LWF',
    club: 'Barcelona',
    league: 'Spanish League',
    clubColor: '#004D98',
    stars: 5,
    highlightTheme: 'navy',
    avatarInitials: 'RP',
    cardBadge: 'TRICKSTER',
    stats: { speed: 96, dribbling: 95, finishing: 91, passing: 88, defense: 62, physical: 82 }
  },
  {
    id: 'p_dejong',
    name: 'Frenkie de Jong',
    rating: 95,
    position: 'CMF',
    club: 'Barcelona',
    league: 'Spanish League',
    clubColor: '#004D98',
    stars: 5,
    highlightTheme: 'navy',
    avatarInitials: 'FD',
    cardBadge: 'MAESTRO',
    stats: { speed: 87, dribbling: 96, finishing: 81, passing: 96, defense: 86, physical: 87 }
  },
  {
    id: 'p_bellingham',
    name: 'Jude Bellingham',
    rating: 96,
    position: 'AMF',
    club: 'Madrid',
    league: 'Spanish League',
    clubColor: '#EE8700',
    stars: 5,
    highlightTheme: 'gold',
    avatarInitials: 'JB',
    cardBadge: 'GOLDEN BOY',
    stats: { speed: 91, dribbling: 93, finishing: 94, passing: 92, defense: 88, physical: 94 }
  },
  {
    id: 'p_vandijk',
    name: 'Virgil van Dijk',
    rating: 94,
    position: 'CB',
    club: 'Liverpool',
    league: 'English League',
    clubColor: '#C8102E',
    stars: 5,
    highlightTheme: 'crimson',
    avatarInitials: 'VD',
    cardBadge: 'THE WALL',
    stats: { speed: 84, dribbling: 76, finishing: 65, passing: 85, defense: 98, physical: 97 }
  }
];

export const EFOOTBALL_EVENTS: EfootballEvent[] = [
  {
    id: 'ev_beat_clock',
    title: 'Beat the Clock vol.1',
    category: 'Play Against Event',
    themeType: 'flame',
    endsIn: '6 day(s) 18 hr(s)',
    description:
      'Completing 1, 2, 3 or more matches will earn Event Points. Accumulate Event Points to get your hands on rewards. Look out for the Bonus Multiplier!',
    conditions: 'Play Against Match Conditions Apply. Match Level: Superstar / Regular.',
    matchLevel: 'Superstar / Regular',
    bonusMultiplier: '+150% Bonus Multiplier',
    rewards: [
      { icon: 'skill', label: 'Skill Training Program', amount: '+1', color: '#00E5FF' },
      { icon: 'exp', label: 'Exp. 10,000 Training', amount: 'x2', color: '#00FF66' }
    ]
  },
  {
    id: 'ev_golden_goal',
    title: 'Golden Goal',
    category: 'Challenge Event',
    themeType: 'gold',
    endsIn: '4 day(s) 12 hr(s)',
    description:
      'Golden Goal rules apply in this Event. The match will end as soon as one side has scored a goal, with the goal-scoring side declared as the winner.',
    conditions: 'Golden Goal Rule Active. First goal scored wins instantly.',
    matchLevel: 'PvP Sudden Death',
    bonusMultiplier: 'Instant Win Reward',
    rewards: [
      { icon: 'exp', label: 'Exp. 10,000 Program', amount: 'x1', color: '#FFD700' },
      { icon: 'coins', label: 'eFootball Coins', amount: '50', color: '#FFB800' }
    ]
  },
  {
    id: 'ev_teamplay_fun',
    title: 'Teamplay Fun',
    category: 'Co-op PvP Event',
    themeType: 'coop',
    endsIn: '13 day(s) 18 hr(s)',
    description:
      'Take part in an Event that you can join alone and play a 2v2 or 3v3 PvP match. Collect Event Points and then obtain rewards. Look out for the Bonus Multiplier.',
    conditions: 'Co-op PvP 2v2 & 3v3. Match with squad or auto-matchmake.',
    matchLevel: 'Co-op PvP Lobby',
    bonusMultiplier: 'Team Cohesion Bonus',
    rewards: [
      { icon: 'skill', label: 'Skill Training Program', amount: '+1', color: '#00E5FF' },
      { icon: 'chance', label: 'Chance Deal Token', amount: 'x1', color: '#FF2A6D' }
    ],
    coopSlots: [
      { color: '#FF3B30', player: 'Striker (P1)', club: 'Arsenal', pinLabel: 'CF', avatar: 'ST' },
      { color: '#007AFF', player: 'Playmaker (P2)', club: 'Man United', pinLabel: 'AMF', avatar: 'PM' },
      { color: '#34C759', player: 'Winger (P3)', club: 'Milan', pinLabel: 'RWF', avatar: 'RW' },
      { color: '#FF9500', player: 'Anchor (P4)', club: 'Arsenal', pinLabel: 'CB', avatar: 'CB' }
    ]
  },
  {
    id: 'ev_united_team',
    title: 'United Team',
    category: 'Co-op VS AI Event',
    themeType: 'inter',
    endsIn: '5 day(s) 8 hr(s)',
    description:
      'Cooperate with up to 3 friends online in AI-controlled matches to earn Event Points. Work as a cohesive squad against elite club AI.',
    conditions: 'Co-op VS AI. Up to 3 users per team.',
    matchLevel: 'Legend AI Difficulty',
    bonusMultiplier: '+200% Team Bonus',
    rewards: [
      { icon: 'skill', label: 'Skill Training Program', amount: '+1', color: '#00E5FF' },
      { icon: 'points', label: 'eFootball Points', amount: '300', color: '#FF8800' }
    ],
    coopSlots: [
      { color: '#007AFF', player: 'Striker', club: 'Inter', pinLabel: 'CF', avatar: 'ST' },
      { color: '#FF3B30', player: 'Midfield', club: 'Inter', pinLabel: 'CMF', avatar: 'MF' },
      { color: '#FFCC00', player: 'Centerback', club: 'Inter', pinLabel: 'CB', avatar: 'DF' }
    ]
  },
  {
    id: 'ev_national_teams',
    title: 'National Teams Championship',
    category: 'Themed Event',
    themeType: 'england',
    endsIn: '8 day(s) 14 hr(s)',
    description:
      'Receive rewards by completing challenges while playing PvP matches. Complete all the challenges to receive amazing rewards. Event Conditions Apply.',
    conditions: 'National Squad Selection Only. Min 18 players from qualified nations.',
    matchLevel: 'National PvP Stage',
    bonusMultiplier: '+100% Star Multiplier',
    rewards: [
      { icon: 'skill', label: 'Skill Training Program', amount: '+2', color: '#00E5FF' },
      { icon: 'chance', label: 'National Chance Deal', amount: 'x1', color: '#FF2A6D' }
    ]
  },
  {
    id: 'ev_european_championship',
    title: 'European Club Championship',
    category: 'Tour Event',
    themeType: 'barca',
    endsIn: '6 day(s) 18 hr(s)',
    description:
      'Play matches in this Event with increased Player Bonuses and Match Level Bonuses. After each match, earn a number of points based on the total bonuses and match results.',
    conditions: 'European Clubs Squads. 100% Match Point Multiplier on Featured Stars.',
    matchLevel: 'Tour Ladder Stage 1-5',
    bonusMultiplier: 'Max +300% Bonus',
    rewards: [
      { icon: 'chance', label: 'Chance Deal', amount: 'x1', color: '#FF2A6D' },
      { icon: 'points', label: 'eFootball Points', amount: '500', color: '#FF8800' },
      { icon: 'coins', label: 'GP Reward', amount: '30,000', color: '#FFD700' }
    ]
  },
  {
    id: 'ev_english_clubs',
    title: 'English Clubs Tour',
    category: 'Tour Event',
    themeType: 'arsenal',
    endsIn: '6 day(s) 18 hr(s)',
    description:
      'Play matches in this Event with increased Player Bonuses and Match Level Bonuses. After each match, earn a number of points based on the total bonuses and match results.',
    conditions: 'English Premier League Clubs Only.',
    matchLevel: 'Tour Match Super Stage',
    bonusMultiplier: '+250% Match Bonus',
    rewards: [
      { icon: 'booster', label: 'Random Booster Token', amount: 'x1', color: '#B026FF' },
      { icon: 'skill', label: 'Random Skill Token', amount: 'x1', color: '#00E5FF' },
      { icon: 'exp', label: 'Exp. 10,000 Token', amount: 'x2', color: '#00FF66' }
    ]
  },
  {
    id: 'ev_spanish_clubs',
    title: 'Spanish Clubs Challenge',
    category: 'Challenge Event',
    themeType: 'barca',
    endsIn: '4 day(s) 21 hr(s)',
    description:
      'Receive rewards by selecting Event Points while playing against the AI. Match Level Bonuses will scale with chosen difficulty.',
    conditions: 'La Liga Clubs. Bonus multipliers for Spanish stars.',
    matchLevel: 'AI Challenge Tier 1-3',
    bonusMultiplier: '+180% Spanish Stars',
    rewards: [
      { icon: 'chance', label: 'National 29 Chance Deal', amount: 'x1', color: '#FF2A6D' },
      { icon: 'coins', label: 'eFootball Coins', amount: '50', color: '#FFD700' }
    ]
  }
];

// ---------------------------------------------------------------------------
// 1. HIGHLIGHT / NEW SEASON SELECTION CONTRACT BANNER (CLONES IMAGE 1)
// ---------------------------------------------------------------------------

export function EfootballHighlightBanner({
  onSelectContract,
  onOpenDetails
}: {
  onSelectContract?: (player: EfootballPlayer) => void;
  onOpenDetails?: () => void;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<EfootballPlayer>(HIGHLIGHT_PLAYERS[0]);
  const [drawnCount, setDrawnCount] = useState<number>(6);
  const [revealedPlayer, setRevealedPlayer] = useState<EfootballPlayer | null>(null);

  const handleDraw = () => {
    soundEngine.play('victory');
    const randomP = HIGHLIGHT_PLAYERS[Math.floor(Math.random() * HIGHLIGHT_PLAYERS.length)];
    setSelectedPlayer(randomP);
    setRevealedPlayer(randomP);
    setDrawnCount((c) => Math.min(10, c + 1));
    if (onSelectContract) onSelectContract(randomP);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1A0008] via-[#2A0512] to-[#0A1024] border-2 border-[#FF2A4D]/50 shadow-2xl p-4 sm:p-6 text-white">
      {/* Overlapping Luminous Glowing Circles (Image 1 authentic background) */}
      <div className="absolute -top-12 -left-12 w-64 h-64 bg-[#FF0033]/40 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute top-1/4 -right-16 w-80 h-80 bg-[#0066FF]/35 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 left-1/3 w-72 h-72 bg-[#FF0055]/25 rounded-full blur-2xl pointer-events-none" />

      {/* Top Header Row */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-white/20 text-white backdrop-blur-md">
              Highlight
            </span>
            <span className="flex items-center gap-1 text-[11px] font-bold text-white/90">
              <Clock className="w-3.5 h-3.5 text-[#FF334B]" />
              <span>Ends in: 1 day(s) 4 hr(s)</span>
            </span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black italic tracking-tighter uppercase text-white drop-shadow-lg pt-1">
            New Season
          </h2>
        </div>

        {/* Top Right Counter & Close */}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-black bg-black/50 border border-white/20 backdrop-blur-md text-white">
            No. of players: <strong className="text-[#00FF88]">{drawnCount}/10</strong>
          </span>
          <button
            type="button"
            onClick={() => { soundEngine.play('tap'); if (onOpenDetails) onOpenDetails(); }}
            className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer"
            title="Details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Special Cards Carousel */}
      <div className="relative z-10 my-5 overflow-x-auto no-scrollbar pb-2">
        <div className="flex items-center gap-3.5 min-w-max px-1">
          {HIGHLIGHT_PLAYERS.map((p) => {
            const isSelected = selectedPlayer.id === p.id;
            return (
              <div
                key={p.id}
                onClick={() => { soundEngine.play('tap'); setSelectedPlayer(p); }}
                className={`relative group cursor-pointer transition-all duration-300 ${
                  isSelected ? 'scale-105 -translate-y-1.5' : 'hover:scale-102 opacity-85 hover:opacity-100'
                }`}
              >
                {/* Special Card Container */}
                <div
                  className={`w-32 sm:w-36 h-48 sm:h-52 rounded-2xl overflow-hidden border-2 relative flex flex-col justify-between p-2.5 shadow-xl ${
                    p.highlightTheme === 'crimson'
                      ? 'bg-gradient-to-b from-[#33000C] via-[#550818] to-[#140005] border-[#FF2A4D] shadow-[#FF2A4D]/25'
                      : p.highlightTheme === 'navy'
                      ? 'bg-gradient-to-b from-[#041230] via-[#0A2666] to-[#010817] border-[#0077FF] shadow-[#0077FF]/25'
                      : 'bg-gradient-to-b from-[#2B1D04] via-[#593B07] to-[#140E02] border-[#FFB800] shadow-[#FFB800]/25'
                  }`}
                >
                  {/* Glowing Top Foil */}
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

                  {/* Top Bar: Rating, Position, Club */}
                  <div className="flex items-start justify-between relative z-10">
                    <div>
                      <div className="text-2xl sm:text-3xl font-black italic leading-none drop-shadow-md tracking-tighter">
                        {p.rating}
                      </div>
                      <div className="text-[11px] font-black uppercase text-white/95 tracking-wider mt-0.5">
                        {p.position}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-white/90">
                        {p.club}
                      </span>
                    </div>
                  </div>

                  {/* Player Silhouette & Avatar Center */}
                  <div className="my-auto flex flex-col items-center justify-center relative z-10">
                    <div
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner border-2 border-white/30 transform group-hover:rotate-2 transition ${
                        p.highlightTheme === 'crimson'
                          ? 'bg-gradient-to-br from-[#FF2A4D] to-[#80001A]'
                          : p.highlightTheme === 'navy'
                          ? 'bg-gradient-to-br from-[#0088FF] to-[#002B80]'
                          : 'bg-gradient-to-br from-[#FFCC00] to-[#805500]'
                      }`}
                    >
                      {p.avatarInitials}
                    </div>
                    {/* 5 Stars */}
                    <div className="flex gap-0.5 mt-1.5">
                      {[...Array(p.stars)].map((_, i) => (
                        <Star key={i} className="w-2.5 h-2.5 fill-[#FFCC00] text-[#FFCC00]" />
                      ))}
                    </div>
                  </div>

                  {/* Bottom Bar: Player Name */}
                  <div className="relative z-10 pt-1 text-center bg-black/60 -mx-2.5 -mb-2.5 py-1.5 border-t border-white/20">
                    <p className="text-[11px] font-black truncate px-1 text-white leading-tight">
                      {p.name}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footnote */}
      <p className="relative z-10 text-[10px] text-white/70 mb-4 font-medium">
        *The displayed Overall Ratings reflect the highest possible Ratings of the players.
      </p>

      {/* Bottom Actions Bar (Exact eFootball layout) */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/20">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { soundEngine.play('tap'); setSelectedPlayer(HIGHLIGHT_PLAYERS[0]); setRevealedPlayer(HIGHLIGHT_PLAYERS[0]); }}
            className="px-4 py-2 rounded-full text-xs font-black bg-white/15 hover:bg-white/25 text-white border border-white/30 transition cursor-pointer"
          >
            Product Details
          </button>
          <button
            type="button"
            onClick={() => { soundEngine.play('tap'); if (onOpenDetails) onOpenDetails(); }}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 border border-white/30 flex items-center justify-center text-white cursor-pointer"
            title="Information"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-extrabold text-white/90">
            Remaining: <strong className="text-white font-black">{10 - drawnCount}</strong>
          </span>
          <button
            type="button"
            onClick={handleDraw}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-black bg-white text-[#0D1117] hover:bg-white/90 transition shadow-xl cursor-pointer transform active:scale-95"
          >
            <span className="w-4 h-4 rounded-full bg-[#FF0055] text-white flex items-center justify-center text-[10px] font-bold">★</span>
            <span>Selection Contract</span>
          </button>
        </div>
      </div>

      {/* Pack Reveal Animation Modal */}
      {revealedPlayer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#1F080F] via-[#2D0A18] to-[#0A1026] border-2 border-[#FF2A4D] rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl relative animate-in zoom-in-95">
            <button
              onClick={() => setRevealedPlayer(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/15 hover:bg-white/30 text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FF0055] text-white">
                ★ Selection Contract Drafted
              </span>
              <h3 className="text-2xl font-black italic uppercase text-white pt-1">
                {revealedPlayer.name}
              </h3>
              <p className="text-xs text-white/70">
                {revealedPlayer.club} · {revealedPlayer.league}
              </p>
            </div>

            {/* Big Player Card Frame */}
            <div className="w-44 h-60 mx-auto rounded-3xl p-3 border-2 border-white/30 bg-gradient-to-b from-[#4A0A16] to-[#0A1026] flex flex-col justify-between shadow-2xl relative overflow-hidden">
              <div className="flex items-start justify-between relative z-10">
                <div className="text-left">
                  <div className="text-3xl font-black italic leading-none">{revealedPlayer.rating}</div>
                  <div className="text-xs font-black uppercase text-white/90">{revealedPlayer.position}</div>
                </div>
                <div className="flex gap-0.5">
                  {[...Array(revealedPlayer.stars)].map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-[#FFCC00] text-[#FFCC00]" />
                  ))}
                </div>
              </div>

              <div className="my-auto text-4xl font-black text-white/90 bg-white/10 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto border border-white/20">
                {revealedPlayer.avatarInitials}
              </div>

              <div className="bg-black/60 -mx-3 -mb-3 py-2 border-t border-white/20">
                <p className="text-xs font-black truncate text-white">{revealedPlayer.name}</p>
                <p className="text-[9px] font-extrabold text-[#00FF88] uppercase">{revealedPlayer.cardBadge}</p>
              </div>
            </div>

            {/* Radar Stats */}
            <div className="grid grid-cols-3 gap-2 text-left bg-black/40 p-3 rounded-2xl border border-white/10 text-[11px]">
              <div>
                <span className="text-white/60 block text-[9px] font-bold uppercase">Speed</span>
                <strong className="text-white font-black">{revealedPlayer.stats.speed}</strong>
              </div>
              <div>
                <span className="text-white/60 block text-[9px] font-bold uppercase">Dribble</span>
                <strong className="text-white font-black">{revealedPlayer.stats.dribbling}</strong>
              </div>
              <div>
                <span className="text-white/60 block text-[9px] font-bold uppercase">Finish</span>
                <strong className="text-white font-black">{revealedPlayer.stats.finishing}</strong>
              </div>
              <div>
                <span className="text-white/60 block text-[9px] font-bold uppercase">Pass</span>
                <strong className="text-white font-black">{revealedPlayer.stats.passing}</strong>
              </div>
              <div>
                <span className="text-white/60 block text-[9px] font-bold uppercase">Defense</span>
                <strong className="text-white font-black">{revealedPlayer.stats.defense}</strong>
              </div>
              <div>
                <span className="text-white/60 block text-[9px] font-bold uppercase">Physical</span>
                <strong className="text-white font-black">{revealedPlayer.stats.physical}</strong>
              </div>
            </div>

            <button
              onClick={() => setRevealedPlayer(null)}
              className="w-full py-3 rounded-2xl bg-white text-[#0D1117] text-xs font-black uppercase tracking-wider hover:bg-white/90 cursor-pointer shadow-lg"
            >
              Add to Squad & Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. EFOOTBALL EVENT CARD (CLONES IMAGES 2 & 3)
// ---------------------------------------------------------------------------

export function EfootballEventCard({
  event,
  onEnter,
  onDetails
}: {
  event: EfootballEvent;
  onEnter: (e: EfootballEvent) => void;
  onDetails: (e: EfootballEvent) => void;
}) {
  const getThemeStyle = (t: string) => {
    switch (t) {
      case 'flame':
        return 'from-[#330B00] via-[#5C1A00] to-[#170000] border-[#FF4400]/50';
      case 'gold':
        return 'from-[#332405] via-[#5C430B] to-[#171002] border-[#FFB800]/50';
      case 'coop':
        return 'from-[#0A1633] via-[#142D66] to-[#040A1A] border-[#0088FF]/50';
      case 'inter':
        return 'from-[#03153D] via-[#082C7A] to-[#020A1C] border-[#0066FF]/50';
      case 'england':
        return 'from-[#172338] via-[#2A4463] to-[#0D1421] border-[#4A90E2]/50';
      case 'barca':
        return 'from-[#2B0613] via-[#590D2A] to-[#120007] border-[#FF2A6D]/50';
      case 'arsenal':
        return 'from-[#330606] via-[#610D0D] to-[#170101] border-[#FF3B30]/50';
      default:
        return 'from-[#141A2B] via-[#222C47] to-[#0D101C] border-white/20';
    }
  };

  const getCategoryBadge = (cat: string) => {
    if (cat.includes('Challenge')) return 'bg-[#FF3B30] text-white';
    if (cat.includes('Tour')) return 'bg-[#007AFF] text-white';
    if (cat.includes('Co-op')) return 'bg-[#34C759] text-white';
    if (cat.includes('Themed')) return 'bg-[#FF9500] text-white';
    return 'bg-white/25 text-white';
  };

  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${getThemeStyle(
        event.themeType
      )} border-2 p-4 sm:p-5 text-white flex flex-col justify-between shadow-xl transition-all duration-200 hover:scale-[1.01] hover:shadow-2xl`}
    >
      {/* Top Tag & Time Row */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span
            className={`px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${getCategoryBadge(
              event.category
            )} shadow-sm`}
          >
            {event.category}
          </span>
          <span className="text-[10px] font-bold text-white/80 flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#FFCC00]" />
            <span>{event.endsIn}</span>
          </span>
        </div>

        {/* Title */}
        <h3 className="text-xl sm:text-2xl font-black italic tracking-tight uppercase text-white drop-shadow-md leading-tight">
          {event.title}
        </h3>

        {/* Description */}
        <p className="text-[11px] text-white/85 line-clamp-2 mt-1.5 leading-relaxed font-medium">
          {event.description}
        </p>
      </div>

      {/* Co-op Player Pin Slots (Images 2 & 3 Authentic Layout) */}
      {event.coopSlots && (
        <div className="my-3 py-2 px-3 bg-black/45 rounded-2xl border border-white/15 backdrop-blur-xs">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[9px] font-black uppercase tracking-wider text-white/70">
              Teamplay Formation Slots
            </p>
            <span className="text-[9px] font-bold text-[#00FF88]">2v2 / 3v3 PvP</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {event.coopSlots.map((slot, i) => (
              <div
                key={i}
                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/10 border"
                style={{ borderColor: slot.color }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shadow-sm"
                  style={{ backgroundColor: slot.color }}
                />
                <span className="text-[10px] font-black text-white">{slot.pinLabel}</span>
                <span className="text-[9px] font-semibold text-white/80">{slot.player}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rewards Strip */}
      <div className="mt-3 pt-3 border-t border-white/20">
        <p className="text-[9px] font-black uppercase tracking-wider text-white/70 mb-1.5">
          Rewards
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {event.rewards.map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/40 border border-white/20 text-[10px] font-bold"
            >
              {r.icon === 'skill' && <Zap className="w-3.5 h-3.5 text-[#00E5FF]" />}
              {r.icon === 'exp' && <Sparkles className="w-3.5 h-3.5 text-[#00FF66]" />}
              {r.icon === 'chance' && <Gift className="w-3.5 h-3.5 text-[#FF2A6D]" />}
              {r.icon === 'points' && <Flame className="w-3.5 h-3.5 text-[#FF8800]" />}
              {r.icon === 'coins' && <Coins className="w-3.5 h-3.5 text-[#FFD700]" />}
              {r.icon === 'booster' && <Award className="w-3.5 h-3.5 text-[#B026FF]" />}
              <span>{r.label}</span>
              {r.amount && <strong className="text-white font-black">{r.amount}</strong>}
            </div>
          ))}
        </div>
      </div>

      {/* Card Action Buttons (Enter & Details) */}
      <div className="flex items-center gap-2.5 mt-4">
        <button
          type="button"
          onClick={() => { soundEngine.play('heavyTap'); onEnter(event); }}
          className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-white text-[#0D1117] hover:bg-white/90 transition shadow-lg cursor-pointer text-center transform active:scale-98"
        >
          Enter
        </button>
        <button
          type="button"
          onClick={() => { soundEngine.play('tap'); onDetails(event); }}
          className="px-5 py-2.5 rounded-xl text-xs font-bold bg-black/60 hover:bg-black/80 text-white border border-white/25 transition cursor-pointer"
        >
          Details
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. EFOOTBALL EVENTS HUB (CLONES 8-GRID / 6-GRID HUB)
// ---------------------------------------------------------------------------

export function EfootballEventsHub({
  onEnterEvent,
  onCreateCustomMatch
}: {
  onEnterEvent?: (event: EfootballEvent) => void;
  onCreateCustomMatch?: () => void;
}) {
  const [filter, setFilter] = useState<string>('all');
  const [selectedEventModal, setSelectedEventModal] = useState<EfootballEvent | null>(null);

  const filtered = EFOOTBALL_EVENTS.filter((e) => {
    if (filter === 'challenge') return e.category.includes('Challenge') || e.category.includes('Play Against');
    if (filter === 'tour') return e.category.includes('Tour');
    if (filter === 'coop') return e.category.includes('Co-op');
    if (filter === 'themed') return e.category.includes('Themed');
    return true;
  });

  const handleEnter = (e: EfootballEvent) => {
    if (onEnterEvent) onEnterEvent(e);
  };

  return (
    <div className="space-y-4">
      {/* Category Navigation Strip */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-1">
        <div className="flex items-center gap-1.5 min-w-max">
          <button
            type="button"
            onClick={() => { soundEngine.play('tap'); setFilter('all'); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
              filter === 'all'
                ? 'bg-[#FF5A1F] text-[#0D1117] shadow-sm'
                : 'bg-[#FFFFFF] border border-[#E5E8EC] text-[#0D1117]/70 hover:text-[#0D1117]'
            }`}
          >
            All Events ({EFOOTBALL_EVENTS.length})
          </button>
          <button
            type="button"
            onClick={() => { soundEngine.play('tap'); setFilter('challenge'); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
              filter === 'challenge'
                ? 'bg-[#FF5A1F] text-[#0D1117] shadow-sm'
                : 'bg-[#FFFFFF] border border-[#E5E8EC] text-[#0D1117]/70 hover:text-[#0D1117]'
            }`}
          >
            Challenge Events
          </button>
          <button
            type="button"
            onClick={() => { soundEngine.play('tap'); setFilter('tour'); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
              filter === 'tour'
                ? 'bg-[#FF5A1F] text-[#0D1117] shadow-sm'
                : 'bg-[#FFFFFF] border border-[#E5E8EC] text-[#0D1117]/70 hover:text-[#0D1117]'
            }`}
          >
            Tour Events
          </button>
          <button
            type="button"
            onClick={() => { soundEngine.play('tap'); setFilter('coop'); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
              filter === 'coop'
                ? 'bg-[#FF5A1F] text-[#0D1117] shadow-sm'
                : 'bg-[#FFFFFF] border border-[#E5E8EC] text-[#0D1117]/70 hover:text-[#0D1117]'
            }`}
          >
            Co-op PvP
          </button>
          <button
            type="button"
            onClick={() => { soundEngine.play('tap'); setFilter('themed'); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
              filter === 'themed'
                ? 'bg-[#FF5A1F] text-[#0D1117] shadow-sm'
                : 'bg-[#FFFFFF] border border-[#E5E8EC] text-[#0D1117]/70 hover:text-[#0D1117]'
            }`}
          >
            Themed Clubs
          </button>
        </div>

        {onCreateCustomMatch && (
          <button
            type="button"
            onClick={onCreateCustomMatch}
            className="shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-black bg-[#2563EB] text-white hover:opacity-90 transition cursor-pointer shadow-xs"
          >
            + Create Lobby
          </button>
        )}
      </div>

      {/* Grid of Event Cards (Clones Images 2 & 3) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filtered.map((ev) => (
          <EfootballEventCard
            key={ev.id}
            event={ev}
            onEnter={handleEnter}
            onDetails={(e) => setSelectedEventModal(e)}
          />
        ))}
      </div>

      {/* Event Details Dialog Modal */}
      {selectedEventModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-[#101524] to-[#070A12] border-2 border-white/20 rounded-3xl max-w-lg w-full p-6 space-y-5 text-white shadow-2xl relative animate-in zoom-in-95">
            <button
              onClick={() => setSelectedEventModal(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/15 hover:bg-white/30 text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#FF3B30] text-white">
                {selectedEventModal.category}
              </span>
              <h3 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tight pt-1">
                {selectedEventModal.title}
              </h3>
              <p className="text-xs text-white/70 flex items-center gap-1.5 pt-0.5">
                <Clock className="w-3.5 h-3.5 text-[#FFCC00]" />
                <span>{selectedEventModal.endsIn}</span>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
              <p className="text-xs text-white/90 leading-relaxed font-medium">
                {selectedEventModal.description}
              </p>
              {selectedEventModal.conditions && (
                <div className="pt-2 border-t border-white/10 text-xs text-[#00E5FF] font-bold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 shrink-0" />
                  <span>{selectedEventModal.conditions}</span>
                </div>
              )}
              {selectedEventModal.bonusMultiplier && (
                <div className="text-[11px] text-[#00FF88] font-black flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 shrink-0" />
                  <span>{selectedEventModal.bonusMultiplier}</span>
                </div>
              )}
            </div>

            {/* Complete Reward Ladder */}
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-wider text-white/80">
                Reward Milestones
              </p>
              <div className="space-y-1.5">
                {selectedEventModal.rewards.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold"
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#00FF66]" />
                      <span>{r.label}</span>
                    </div>
                    <span className="text-[#FFD700] font-black">{r.amount ?? 'Claimable'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('heavyTap');
                  handleEnter(selectedEventModal);
                  setSelectedEventModal(null);
                }}
                className="flex-1 py-3.5 rounded-2xl bg-white text-[#0D1117] text-xs font-black uppercase tracking-wider hover:bg-white/90 transition shadow-xl cursor-pointer text-center"
              >
                Enter Match Event
              </button>
              <button
                type="button"
                onClick={() => setSelectedEventModal(null)}
                className="px-5 py-3.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold cursor-pointer"
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
