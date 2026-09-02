import React, { useState } from 'react';
import type { ArenaGame, ArenaGameId } from '../App';
import { themeFor } from './arenaTheme';
import { soundEngine } from '../utils/SoundEngine';
import { 
  Trophy, 
  Flame, 
  Clock, 
  Users, 
  Plus, 
  ArrowUpRight, 
  Shield, 
  Play, 
  Star,
  Gamepad2,
  Sparkles,
  Zap
} from 'lucide-react';
import { CustomLeagueModal, CustomLeagueTemplate } from './arena/CustomLeagueModal';

export interface ArenaShelfProps {
  games: ArenaGame[];
  activity: Record<string, number>;
  onOpen: (id: ArenaGameId) => void;
  onLaunchTemplate?: (template: CustomLeagueTemplate) => void;
}

const DEFAULT_BLENDED_TEMPLATES: CustomLeagueTemplate[] = [
  {
    id: 'tpl-golden-goal',
    title: 'Golden Goal: 1st Goal Wins',
    gameId: 'efootball',
    gameName: 'eFootball',
    format: 'Golden Goal',
    entryFeeKes: 150,
    prizePoolKes: 1200,
    maxPlayers: 8,
    openWindow: 'Registration Open',
    rules: 'Sudden death mode. First side to score takes the match immediately.',
    isPrivate: false
  },
  {
    id: 'tpl-beat-the-clock',
    title: 'Beat the Clock: 5-Min Blitz',
    gameId: 'ea_fc',
    gameName: 'EA FC 25',
    format: 'Beat the Clock',
    entryFeeKes: 200,
    prizePoolKes: 1600,
    maxPlayers: 8,
    openWindow: 'Closes in 2h',
    rules: 'High-speed match duration. Double points for clean sheets and hat-tricks.',
    isPrivate: false
  },
  {
    id: 'tpl-coop-syndicate',
    title: '2v2 Co-op Pinboard Syndicate',
    gameId: 'efootball',
    gameName: 'eFootball',
    format: '2v2 Co-op Syndicate',
    entryFeeKes: 300,
    prizePoolKes: 4800,
    maxPlayers: 16,
    openWindow: 'Weekend Special',
    rules: '2v2 squad teamplay with player bonus multipliers.',
    isPrivate: false
  },
  {
    id: 'tpl-warzone-stakes',
    title: 'Sniper Duel / 1v1 High Stakes',
    gameId: 'cod',
    gameName: 'Call of Duty Mobile',
    format: 'Custom Staked 1v1',
    entryFeeKes: 500,
    prizePoolKes: 4000,
    maxPlayers: 8,
    openWindow: 'Live Queue',
    rules: 'Sniper only / 1v1 Killhouse room. Best of 3 rounds.',
    isPrivate: false
  }
];

export function ArenaShelf({ games, activity, onOpen, onLaunchTemplate }: ArenaShelfProps) {
  const [selectedGameFilter, setSelectedGameFilter] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<CustomLeagueTemplate[]>(DEFAULT_BLENDED_TEMPLATES);

  const filteredGames = games.filter(g => {
    if (selectedGameFilter === 'all') return true;
    return g.id === selectedGameFilter;
  });

  const handleCreateLeague = (newLeague: CustomLeagueTemplate) => {
    setCustomTemplates(prev => [newLeague, ...prev]);
    if (onLaunchTemplate) onLaunchTemplate(newLeague);
  };

  return (
    <div className="space-y-6">
      
      {/* ================= SECTION 1: IMAGE-HEAVY GAMES GALLERY ================= */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#FF5A1F] animate-pulse"></span>
              <h3 className="text-xs font-black uppercase tracking-[0.18em] text-[#0D1117]">
                Games Gallery
              </h3>
            </div>
            <p className="text-[11px] text-[#0D1117]/60 mt-0.5">
              Select your game to enter its immersive arena & custom challenge hub
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              setIsCreateModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#0D1117] hover:bg-[#1E2633] text-white text-xs font-bold shadow-md cursor-pointer transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-[#FF5A1F]" />
            <span>Create Private League</span>
          </button>
        </div>

        {/* Gallery Cover Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {games.map((g) => {
            const theme = themeFor(g.id);
            const count = activity[g.id] ?? 0;
            const live = count > 0;
            return (
              <button
                key={g.id}
                type="button"
                data-game-id={g.id}
                onClick={() => {
                  soundEngine.play('tap');
                  onOpen(g.id);
                }}
                className="group relative aspect-[3/4] rounded-2xl overflow-hidden border transition-all cursor-pointer text-left shadow-md hover:scale-[1.03] duration-300"
                style={{ borderColor: live ? '#FF5A1F' : '#E5E8EC' }}
              >
                <img
                  src={theme.art}
                  alt={g.name}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(9,11,16,0.15) 0%, rgba(9,11,16,0.2) 40%, rgba(9,11,16,0.75) 75%, rgba(9,11,16,0.98) 100%)'
                  }}
                />

                {/* Top badges */}
                <div className="absolute top-2.5 left-2.5">
                  <span
                    className="text-[8px] font-extrabold tracking-[0.2em] px-1.5 py-0.5 rounded-md shadow"
                    style={{ color: '#0D1117', background: '#FF5A1F' }}
                  >
                    {theme.providerMark}
                  </span>
                </div>

                <span
                  className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold"
                  style={{
                    background: 'rgba(9,11,16,0.9)',
                    color: '#FFFFFF',
                    border: `1px solid ${live ? '#FF5A1F' : 'rgba(255,255,255,0.28)'}`
                  }}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: live ? '#FF5A1F' : 'rgba(255,255,255,0.3)' }}
                  />
                  {live ? `${count} LIVE` : 'IDLE'}
                </span>

                {/* Title & Prompt */}
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-[#FFFFFF]/75">
                    {theme.provider}
                  </p>
                  <h4 className="text-[13px] font-black leading-tight text-[#FFFFFF]">
                    {g.shortName}
                  </h4>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[9px] font-mono text-[#00BFEF] font-bold">
                      {g.modes.join(' · ')}
                    </span>
                    <span className="text-[10px] text-white group-hover:translate-x-0.5 transition-transform">
                      →
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ================= SECTION 2: BLENDED LEAGUE & CHALLENGE PLACARDS ================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-[#0D1117]">
              Live Competitions & Community Templates
            </h3>
            <p className="text-[11px] text-[#0D1117]/60 mt-0.5">
              Jump directly into custom staked tournaments, golden goal cups, and co-op syndicates
            </p>
          </div>
        </div>

        {/* Placard Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {customTemplates.map((tpl) => {
            const isStaked = tpl.entryFeeKes > 0;
            return (
              <div
                key={tpl.id}
                className="rounded-3xl bg-gradient-to-br from-[#0B1B2A] via-[#173247] to-[#0B1B2A] border border-[#173247] text-white p-4 sm:p-5 shadow-xl flex flex-col justify-between group hover:border-[#00BFEF]/50 transition-all"
              >
                {/* Top Placard Tag & Status */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-full bg-[#FF5A1F] text-white">
                      {tpl.format}
                    </span>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-black/40 text-[#00BFEF] font-bold">
                      {tpl.gameName}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 text-[10px] font-mono text-gray-300 bg-black/40 px-2 py-0.5 rounded">
                    <Clock className="w-3 h-3 text-[#FF5A1F]" />
                    <span>{tpl.openWindow}</span>
                  </div>
                </div>

                {/* Title & Rules */}
                <div className="my-2 space-y-1">
                  <h4 className="text-base font-black text-white group-hover:text-[#00BFEF] transition-colors">
                    {tpl.title}
                  </h4>
                  <p className="text-xs text-[#DCE2E6]/75 line-clamp-2">
                    {tpl.rules}
                  </p>
                </div>

                {/* Stakes & Slots Breakdown */}
                <div className="my-2.5 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-[9px] text-gray-400 block uppercase">STAKE / ENTRY:</span>
                    <span className="font-bold text-[#F58220]">
                      {isStaked ? `KES ${tpl.entryFeeKes.toLocaleString()}` : 'Free / Ranked'}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[9px] text-gray-400 block uppercase">PRIZE POOL:</span>
                    <span className="font-bold text-emerald-400">
                      {isStaked ? `KES ${tpl.prizePoolKes.toLocaleString()}` : 'Honor & Elo Points'}
                    </span>
                  </div>
                </div>

                {/* Dual Pill Buttons (Enter & Customize) */}
                <div className="pt-2 border-t border-white/10 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.play('tap');
                      onOpen(tpl.gameId as ArenaGameId);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-[#0D1117] font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-md transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Enter Lobby</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.play('tap');
                      onOpen(tpl.gameId as ArenaGameId);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-black/50 hover:bg-black/80 border border-white/15 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Rules
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      </section>

      {/* Custom League Creator Modal */}
      <CustomLeagueModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        gameId="efootball"
        gameName="eFootball"
        onCreateLeague={handleCreateLeague}
      />

    </div>
  );
}

export default ArenaShelf;
