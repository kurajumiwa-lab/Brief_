import React, { useState, useMemo, useEffect, useCallback } from 'react';
import * as briefApi from '../api/briefApi';
import type { ArenaGameId, ArenaChallenge, ArenaMatch, ChallengeStake, ChallengeStatus } from '../model/core';
import { ARENA_GAMES, CLIENT_TO_SERVER_GAME, SERVER_TO_CLIENT_GAME } from '../model/core';
import type { ArenaStakeKind } from '../components/ArenaGameScreen';
import { PlayAs } from '../components/PlayAs';
import { ArenaPulse, SeasonStrip } from '../components/ArenaPulse';
import { ArenaShelf } from '../components/ArenaShelf';
import { ArenaGameScreen } from '../components/ArenaGameScreen';
import { MatchQueuePanel } from '../components/MatchQueuePanel';
import { EplDesk } from '../components/EplDesk';
import { LobbyBoard } from '../components/LobbyBoard';
import { EfootballHighlightBanner, EfootballEventsHub } from '../components/arena/EfootballShowcase';
import { soundEngine } from '../utils/SoundEngine';
import { ArenaSoundToggleIcon } from '../components/arena/GameIcons';
import '../styles/arenaArcade.css';

// ---------------------------------------------------------------------------
// ARENA SCREEN — colocated from App.tsx (Phase 1 extraction).
// Owns every arena-local state, loader and handler. The shell keeps what is
// genuinely shared -- session, the destination-routed arenaSection (nav and
// URL sync write it), the busy id and match list my-layer also reads, toasts
// -- and passes them in as props.
// ---------------------------------------------------------------------------

export interface ArenaScreenProps {
  sessionUser: briefApi.AuthedUser | null;
  arenaActivity: Record<string, number>;
  /** Available players (opted-in availability), from the real server. */
  arenaPlayers: any[];
  /** Real Arena venues, from the real server. */
  arenaVenues: any[];
  matches: ArenaMatch[];
  setMatches: React.Dispatch<React.SetStateAction<ArenaMatch[]>>;
  refreshArenaMatches: () => Promise<void>;
  arenaBusyId: string | null;
  setArenaBusyId: React.Dispatch<React.SetStateAction<string | null>>;
  showToast: (msg: string) => void;
  arenaSection: 'lobby' | 'epl' | 'challenges' | 'tournaments' | 'leaderboard';
  setArenaSection: (s: 'lobby' | 'epl' | 'challenges' | 'tournaments' | 'leaderboard') => void;
}

export function ArenaScreen({
  sessionUser, arenaActivity, arenaPlayers, arenaVenues, matches, setMatches, refreshArenaMatches,
  arenaBusyId, setArenaBusyId, showToast, arenaSection, setArenaSection
}: ArenaScreenProps) {
  const [soundMuted, setSoundMuted] = useState<boolean>(() => soundEngine.getMuted());
  const [arenaTestGame, setArenaTestGame] = useState<string>('efootball');
  const [arenaTestMode, setArenaTestMode] = useState<string>('1v1 Match');
  const [arenaTestStake, setArenaTestStake] = useState<ArenaStakeKind>('friendly');
  const [arenaTestFee, setArenaTestFee] = useState<string>('100');
  const [arenaTestRules, setArenaTestRules] = useState<string>('');
  const [arenaTestDuration, setArenaTestDuration] = useState<number>(120);
  const [arenaTestCreatorOpen, setArenaTestCreatorOpen] = useState<boolean>(false);
  const [arenaGameId, setArenaGameId] = useState<ArenaGameId>('efootball');
  const [openedTournament, setOpenedTournament] = useState<any | null>(null);
  const [openedStanding, setOpenedStanding] = useState<any | null>(null);
  const [arenaOpenGame, setArenaOpenGame] = useState<ArenaGameId | null>(null);
  const [playAsConfirmed, setPlayAsConfirmed] = useState(false);
  const [myGameTag, setMyGameTag] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [tagBusy, setTagBusy] = useState(false);
  const [availabilityOn, setAvailabilityOn] = useState(false);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [challenges, setChallenges] = useState<ArenaChallenge[]>([]);
  const [arenaTournaments, setArenaTournaments] = useState<any[]>([]);
  const [arenaLeaderboard, setArenaLeaderboard] = useState<any[]>([]);
  const CURRENT_PLAYER_ID = sessionUser?.id ?? '';

  const toggleSound = () => {
    const next = soundMuted ? false : true;
    soundEngine.setMuted(next);
    setSoundMuted(next);
    if (!next) soundEngine.play('tap');
  };

  React.useEffect(() => {
    if (!sessionUser) return;
    let live = true;
    (async () => {
      const [me, tags] = await Promise.all([
        briefApi.getPersonMe(),
        briefApi.getMyArenaPlayers()
      ]);
      if (!live) return;
      if (me.ok) {
        setAvailabilityOn(me.data.availability?.state === 'available');
        const tag = me.data.standing?.gameTags?.find((t) => t.gameId === (CLIENT_TO_SERVER_GAME[arenaGameId] ?? arenaGameId));
        if (tag) setMyGameTag(tag.gamerTag);
      }
      if (tags.ok) {
        const mine = (tags.data as any[]).find((p) => p.gameId === (CLIENT_TO_SERVER_GAME[arenaGameId] ?? arenaGameId));
        if (mine?.gamerTag) setMyGameTag(String(mine.gamerTag));
      }
    })();
    return () => { live = false; };
  }, [sessionUser, arenaGameId]);

  // Load the real open challenges from the server and map them onto the
  // display model. Server rows use createdBy/acceptedBy; the client model uses
  // createdByPlayerId/acceptedByPlayerId. Everything else (format, points,
  // suggested times) is a client-only convenience that stays absent for real
  // server-backed challenges rather than being invented.
  const refreshArenaChallenges = React.useCallback(async () => {
    const serverGame = CLIENT_TO_SERVER_GAME[arenaGameId] ?? arenaGameId;
    const res = await briefApi.getArenaChallenges(serverGame);
    if (!res.ok) return;
    setChallenges(res.data.map((c: any) => ({
      id: String(c.id),
      gameId: (SERVER_TO_CLIENT_GAME[c.gameId] ?? c.gameId) as ArenaGameId,
      mode: String(c.mode ?? '1v1'),
      createdByPlayerId: String(c.createdBy),
      stake: (c.stake ?? 'friendly') as ChallengeStake,
      entryFeeKes: c.entryFeeKes ?? undefined,
      openUntil: c.openUntil,
      status: (c.status ?? 'open') as ChallengeStatus,
      acceptedByPlayerId: c.acceptedBy ? String(c.acceptedBy) : undefined,
      createdAt: c.createdAt
    })));
  }, [arenaGameId]);
  useEffect(() => { void refreshArenaChallenges(); }, [refreshArenaChallenges]);

  React.useEffect(() => {
    let live = true;
    briefApi.getArenaLeaderboard(arenaGameId).then((r) => {
      if (live && r.ok) setArenaLeaderboard(r.data as any[]);
    });
    return () => { live = false; };
  }, [arenaGameId]);

  const arenaGame = useMemo(
    () => ARENA_GAMES.find((g) => g.id === arenaGameId) ?? ARENA_GAMES[0],
    [arenaGameId]
  );

  // The lobby shows open challenges for the selected game only.
  const handleAcceptChallenge = async (challenge: ArenaChallenge) => {
    // Acceptance goes through the SERVER: it creates a real match and marks
    // the challenge accepted, idempotently. A stale challenge is refused by
    // the server rather than optimistically marked accepted.
    const res = await briefApi.acceptArenaChallenge(challenge.id);
    if (!res.ok) {
      showToast(res.error ?? 'This challenge is no longer open.');
      return;
    }
    // The server's match is the record of the game. Map it onto the display
    // model so "Your matches" reflects the real, server-persisted match.
    if (res.data?.match) {
      const m = res.data.match;
      setMatches((prev) => [
        ...prev.filter((x) => x.challengeId !== challenge.id),
        {
          id: String(m.id),
          challengeId: String(m.challengeId ?? challenge.id),
          gameId: m.gameId as ArenaGameId,
          playerAId: String(m.playerAId),
          playerBId: String(m.playerBId),
          playedAt: m.createdAt ?? new Date().toISOString(),
          winnerPlayerId: m.winnerPlayerId ?? undefined,
          scoreLine: m.scoreLine ?? undefined,
          confirmedByA: m.confirmedByA ?? undefined,
          confirmedByB: m.confirmedByB ?? undefined
        }
      ]);
    }
    await refreshArenaChallenges();
    await refreshArenaMatches();
    showToast('Challenge accepted. Match created.');
  };

  const handleCancelChallenge = async (challenge: ArenaChallenge) => {
    setArenaBusyId(challenge.id);
    const res = await briefApi.cancelArenaChallenge(challenge.id);
    setArenaBusyId(null);
    if (!res.ok) {
      showToast(res.error ?? 'Could not cancel this challenge.');
      return;
    }
    await refreshArenaChallenges();
    showToast('Challenge cancelled.');
  };


  const handleCreateChallenge = async (params?: {
    gameId?: string;
    mode?: string;
    stake?: ArenaStakeKind;
    entryFeeKes?: number;
    note?: string;
    openMinutes?: number;
  }) => {
    setArenaBusyId('create');
    const gid = params?.gameId
      ? ((CLIENT_TO_SERVER_GAME as Record<string, string>)[params.gameId] ?? params.gameId)
      : ((CLIENT_TO_SERVER_GAME as Record<string, string>)[arenaGameId] ?? arenaGameId);
    const res = await briefApi.createArenaChallenge({
      gameId: gid,
      mode: params?.mode ?? arenaGame.modes[0] ?? '1v1',
      stake: params?.stake ?? 'friendly',
      entryFeeKes: params?.entryFeeKes,
      note: params?.note,
      openMinutes: params?.openMinutes ?? 120
    });
    setArenaBusyId(null);
    if (!res.ok) {
      showToast(res.error ?? 'Could not open a challenge.');
      return;
    }
    setArenaSection('challenges');
    await refreshArenaChallenges();
    showToast('Challenge opened. Anyone can accept it.');
  };

  const handleLaunchArenaTest = async () => {
    const fee = arenaTestStake === 'entry_fee' ? (Number(arenaTestFee) || 100) : undefined;
    await handleCreateChallenge({
      gameId: arenaTestGame,
      mode: arenaTestMode,
      stake: arenaTestStake,
      entryFeeKes: fee,
      note: arenaTestRules.trim() || undefined,
      openMinutes: arenaTestDuration
    });
    setArenaTestCreatorOpen(false);
    setArenaTestRules('');
    showToast('Arena test match launched!');
  };

  // Shared availability toggle used by both PlayAs and the game screen.
  const handleToggleAvailability = async () => {
    setAvailabilityBusy(true);
    const next = !availabilityOn;
    const res = await briefApi.setMyAvailability(
      next
        ? {
            state: 'available',
            gameId: CLIENT_TO_SERVER_GAME[arenaGameId] ?? arenaGameId,
            mode: '1v1',
            format: '1v1',
            window: 'tonight',
            locationKind: 'online'
          }
        : { state: 'offline' }
    );
    setAvailabilityBusy(false);
    if (!res.ok) {
      showToast(res.error ?? 'Could not update availability.');
      return;
    }
    setAvailabilityOn(res.data.state === 'available');
    setPlayAsConfirmed(true);
  };














  React.useEffect(() => {
    let live = true;
    briefApi.getArenaTournaments().then((r) => {
      if (live && r.ok) setArenaTournaments(r.data as any[]);
    });
    return () => { live = false; };
  }, []);

  return (
    <div className="arena-arcade-theme max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-[#0D1117]">Arena</h2>
            <p className="text-[11px] text-[#0D1117]/60 leading-snug mt-1">
              Gather with people to play. Not a competition — host challenges and run live match tests.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundMuted ? 'Unmute Arena sound effects' : 'Mute Arena sound effects'}
            title={soundMuted ? 'Turn sound effects on' : 'Turn sound effects off'}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#E5E8EC] bg-[#FFFFFF] px-2.5 py-2 text-[10px] font-extrabold text-[#0D1117] transition-colors hover:border-[#2563EB] cursor-pointer"
          >
            <ArenaSoundToggleIcon isMuted={soundMuted} size={16} color="#0D1117" />
            <span className="hidden sm:inline">{soundMuted ? 'Sound off' : 'Sound on'}</span>
          </button>
        </div>

        {sessionUser && (
          <div id="arena-profile">
          <PlayAs
            displayName={sessionUser.displayName || 'you'}
            handle={sessionUser.handle}
            confirmed={playAsConfirmed}
            onConfirm={() => setPlayAsConfirmed(true)}
            gameName={arenaGame.name}
            gameId={arenaGame.id}
            tagDraft={tagDraft}
            onTagDraft={setTagDraft}
            onCreateTag={async () => {
              setTagBusy(true);
              const res = await briefApi.createArenaPlayer({
                gameId: CLIENT_TO_SERVER_GAME[arenaGameId] ?? arenaGameId,
                gamerTag: tagDraft.trim()
              });
              setTagBusy(false);
              if (!res.ok) {
                showToast(res.error ?? 'Could not save that tag.');
                return;
              }
              setMyGameTag(tagDraft.trim());
              setPlayAsConfirmed(true);
              showToast('Game tag saved.');
            }}
            tagBusy={tagBusy}
            myTag={myGameTag}
            availabilityOn={availabilityOn}
            availabilityBusy={availabilityBusy}
            onToggleAvailability={() => void handleToggleAvailability()}
          />
          </div>
        )}

        <ArenaPulse />

        {/* PRIMARY GAMES GALLERY & BLENDED TEMPLATES HUB */}
        <ArenaShelf
          games={ARENA_GAMES}
          activity={arenaActivity}
          onOpen={(id) => { setArenaGameId(id); setArenaOpenGame(id); }}
          onLaunchTemplate={(tpl) => {
            showToast(`Template "${tpl.title}" selected. Opening ${tpl.gameName} lobby...`);
            setArenaGameId(tpl.gameId as ArenaGameId);
            setArenaOpenGame(tpl.gameId as ArenaGameId);
          }}
        />

        {/* Secondary screen: immersive game-specific UI surface behind a gallery card */}
        {arenaOpenGame && (
          <ArenaGameScreen
            game={ARENA_GAMES.find((g) => g.id === arenaOpenGame) ?? ARENA_GAMES[0]}
            activity={arenaActivity[arenaOpenGame] ?? 0}
            challenges={challenges.filter(
              (c) =>
                c.gameId === arenaOpenGame ||
                (SERVER_TO_CLIENT_GAME[c.gameId] ?? c.gameId) === arenaOpenGame
            )}
            myTag={myGameTag}
            availabilityOn={availabilityOn}
            availabilityBusy={availabilityBusy}
            busyId={arenaBusyId}
            myPlayerId={CURRENT_PLAYER_ID || null}
            onClose={() => setArenaOpenGame(null)}
            onCreateChallenge={(params) => void handleCreateChallenge(params)}
            onAcceptChallenge={(c) => void handleAcceptChallenge(c)}
            onCancelChallenge={(c) => void handleCancelChallenge(c)}
            onToggleAvailability={() => void handleToggleAvailability()}
            onViewLeaderboard={() => { setArenaSection('leaderboard'); setArenaOpenGame(null); }}
            onViewTournaments={() => { setArenaSection('tournaments'); setArenaOpenGame(null); }}
          />
        )}

        {/* Package 2: the high-frequency match queue */}
        <MatchQueuePanel
          gameName={arenaGame.name}
          latestChallenge={challenges.find((c) => c.status === 'open' || c.status === 'accepted') ?? challenges[0] ?? null}
          latestMatch={matches[0] ?? null}
          availabilityOn={availabilityOn}
          busy={availabilityBusy || arenaBusyId === 'create'}
          onEnterQueue={(params) => void handleCreateChallenge({ stake: params.stake, note: params.note })}
          onToggleAvailability={() => void handleToggleAvailability()}
        />

        {/* ARENA DIRECT TEST & CHALLENGE STUDIO */}
        <div className="bg-[#FFFFFF] border border-[#E5E8EC] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#FF5A1F] text-[#0D1117] text-[10px] font-black">
                  ⚡
                </span>
                <h3 className="text-[14px] font-black text-[#0D1117] tracking-tight">
                  Arena Test & Challenge Studio
                </h3>
              </div>
              <p className="text-[11px] text-[#0D1117]/60 mt-0.5">
                Configure and launch a live test match or challenge with all options listed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { soundEngine.play('tap'); setArenaTestCreatorOpen((v) => !v); }}
              className="px-3 py-1.5 rounded-xl border border-[#E5E8EC] text-[11px] font-extrabold text-[#0D1117] hover:border-[#2563EB] transition-colors cursor-pointer"
            >
              {arenaTestCreatorOpen ? 'Close' : 'Create Test'}
            </button>
          </div>

          {arenaTestCreatorOpen && (
            <div className="space-y-3 pt-3 border-t border-[#EFF1F4]">
              {/* Game Selection */}
              <div>
                <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#0D1117]/70 mb-1.5">
                  Target Game
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {ARENA_GAMES.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        soundEngine.play('tap');
                        setArenaTestGame(g.id);
                        setArenaTestMode(g.modes[0] ?? '1v1 Match');
                      }}
                      className={`px-3 py-2 rounded-xl text-left border transition-all cursor-pointer ${
                        arenaTestGame === g.id
                          ? 'bg-[#FF5A1F] text-[#0D1117] border-[#2563EB] shadow-xs'
                          : 'bg-[#F0F2F5] text-[#0D1117]/70 border-[#E5E8EC] hover:border-[#2563EB]/40'
                      }`}
                    >
                      <p className="text-[11px] font-black truncate">{g.name}</p>
                      <p className={`text-[8.5px] truncate mt-0.5 ${arenaTestGame === g.id ? 'text-[#0D1117]/70' : 'text-[#0D1117]/70'}`}>
                        {g.modes.length} modes
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode / Format Selection */}
              <div>
                <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#0D1117]/70 mb-1.5">
                  Match Format & Mode
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    ...(ARENA_GAMES.find((g) => g.id === arenaTestGame)?.modes ?? ['1v1 Match']),
                    'Beta Pilot Duel',
                    'Clan Test'
                  ]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { soundEngine.play('tap'); setArenaTestMode(m); }}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold border transition-all cursor-pointer ${
                        arenaTestMode === m
                          ? 'bg-[#FF5A1F] text-[#0D1117] border-[#2563EB]'
                          : 'bg-[#FFFFFF] text-[#0D1117]/70 border-[#E5E8EC] hover:border-[#2563EB]/40'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stake / Tier Selection */}
              <div>
                <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#0D1117]/70 mb-1.5">
                  Test Tier & Stake
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    ['friendly', 'Friendly Test', 'Free match'],
                    ['ranked', 'Ranked Challenge', 'Elo points'],
                    ['entry_fee', 'Prize Stake', 'KES fee']
                  ] as [ArenaStakeKind, string, string][]).map(([s, label, hint]) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { soundEngine.play('tap'); setArenaTestStake(s); }}
                      className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                        arenaTestStake === s
                          ? 'bg-[#FF5A1F] text-[#0D1117] border-[#2563EB]'
                          : 'bg-[#FFFFFF] text-[#0D1117]/70 border-[#E5E8EC] hover:border-[#2563EB]/40'
                      }`}
                    >
                      <p className="text-[11px] font-black">{label}</p>
                      <p className={`text-[8.5px] ${arenaTestStake === s ? 'text-[#0D1117]/70' : 'text-[#0D1117]/70'}`}>{hint}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Entry fee input if prize stake */}
              {arenaTestStake === 'entry_fee' && (
                <div>
                  <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#0D1117]/70 mb-1">
                    Entry Fee / Prize Stake (KES)
                  </label>
                  <div className="flex items-center gap-2">
                    {['50', '100', '200', '500'].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => { soundEngine.play('tap'); setArenaTestFee(amt); }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border cursor-pointer ${
                          arenaTestFee === amt
                            ? 'bg-[#FF5A1F] text-[#0D1117] border-[#2563EB]'
                            : 'bg-[#F0F2F5] text-[#0D1117]/70 border-[#E5E8EC]'
                        }`}
                      >
                        KES {amt}
                      </button>
                    ))}
                    <input
                      type="number"
                      value={arenaTestFee}
                      onChange={(e) => setArenaTestFee(e.target.value)}
                      placeholder="Amount"
                      className="w-24 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-[#E5E8EC] focus:border-[#2563EB] outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Rules / Notes */}
              <div>
                <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#0D1117]/70 mb-1">
                  Match Notes & Objectives (Optional)
                </label>
                <input
                  type="text"
                  value={arenaTestRules}
                  onChange={(e) => setArenaTestRules(e.target.value)}
                  placeholder="e.g. Test new squad, 90 mins, no extra time"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E5E8EC] focus:border-[#2563EB] outline-none"
                />
              </div>

              {/* Duration Window */}
              <div>
                <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#0D1117]/70 mb-1">
                  Time Window
                </label>
                <div className="flex gap-1.5">
                  {[
                    [30, '30m'],
                    [60, '1 hr'],
                    [120, '2 hrs'],
                    [1440, '24 hrs']
                  ].map(([mins, lbl]) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => { soundEngine.play('tap'); setArenaTestDuration(Number(mins)); }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border cursor-pointer ${
                        arenaTestDuration === mins
                          ? 'bg-[#FF5A1F] text-[#0D1117] border-[#2563EB]'
                          : 'bg-[#F0F2F5] text-[#0D1117]/70 border-[#E5E8EC]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Launch button */}
              <button
                type="button"
                disabled={arenaBusyId === 'create'}
                onClick={() => { soundEngine.play('heavyTap'); void handleLaunchArenaTest(); }}
                className="w-full py-3 rounded-xl bg-[#FF5A1F] hover:bg-[#000000] text-[#0D1117] text-xs font-black cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {arenaBusyId === 'create' ? 'Launching…' : '🚀 Launch Arena Test Match'}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {([
            ['lobby', 'Lobby'],
            ['epl', 'EPL'],
            ['challenges', `Challenges${challenges.length > 0 ? ` (${challenges.length})` : ''}`],
            ['tournaments', `Tournaments${arenaTournaments.length > 0 ? ` (${arenaTournaments.length})` : ''}`],
            ['leaderboard', 'Leaderboard']
          ] as [typeof arenaSection, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { soundEngine.play('tap'); setArenaSection(key); }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer border ${
                arenaSection === key
                  ? 'bg-[#FFFFFF] text-[#0D1117] border-[#2563EB]'
                  : 'bg-[#FFFFFF] text-[#0D1117] border-[#E5E8EC]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {arenaSection === 'epl' && (
          <EplDesk meId={sessionUser?.id ?? null} onToast={showToast} />
        )}

        {arenaSection === 'lobby' && (
          <div className="space-y-4">
            {/* eFootball Highlight Season Banner (Clones Image 1) */}
            <EfootballHighlightBanner
              onSelectContract={(player) => {
                showToast(`Drafted ${player.name} (${player.rating} ${player.position}) to your squad!`);
              }}
              onOpenDetails={() => {
                showToast('Highlight Season Details: Max overall rating reflects peak level condition.');
              }}
            />

            {/* eFootball Events & Challenge Hub (Clones Images 2 & 3) */}
            <section aria-label="eFootball Events">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#0D1117]">
                  Tournaments & Match Events
                </h3>
                <span className="text-[10px] font-bold text-[#FF5A1F]">eFootball Season Hub</span>
              </div>
              <EfootballEventsHub
                onEnterEvent={(ev) => {
                  soundEngine.play('heavyTap');
                  void handleCreateChallenge({
                    mode: ev.title,
                    stake: 'friendly',
                    note: `Event: ${ev.title} (${ev.category})`
                  });
                }}
                onCreateCustomMatch={() => setArenaSection('challenges')}
              />
            </section>

            <LobbyBoard gameId={({ pubg: 'pubg_mobile', cod: 'cod_mobile', ea_fc: 'fc_mobile' } as Record<string, string>)[arenaGameId] ?? arenaGameId} />

            {/* §18 — Nearby players: real, opted-in availability from the
                server. Filtered to the current game. Empty is honest. */}
            <section aria-label="Nearby players">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#0D1117]">Nearby players</h3>
                <span className="text-[10px] font-bold text-[#0D1117]/60">{arenaGame.name}</span>
              </div>
              {(() => {
                const serverGame = CLIENT_TO_SERVER_GAME[arenaGameId] ?? arenaGameId;
                const rows = (arenaPlayers ?? []).filter((p: any) => p?.gameId === serverGame);
                if (rows.length === 0) {
                  return <p className="text-xs text-[#0D1117]/60">No one has gone available for {arenaGame.name} right now.</p>;
                }
                return (
                  <div className="space-y-1.5">
                    {rows.slice(0, 8).map((p: any, i: number) => {
                      const meta = [p?.mode, p?.format, p?.locationKind].filter(Boolean).join(' · ');
                      return (
                        <div key={`${p?.userId ?? p?.personId ?? 'p'}_${i}`} className="flex items-center justify-between gap-2 rounded-xl bg-[#FFFFFF] border border-[#E5E8EC] px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold text-[#0D1117] truncate">{p?.displayName ?? 'Player'}</p>
                            {meta && <p className="text-[10px] text-[#0D1117]/60 truncate">{meta}</p>}
                          </div>
                          <span className="shrink-0 flex items-center gap-1 rounded-full bg-[#F0F2F5] px-2 py-0.5 text-[9px] font-extrabold text-[#16A34A]">
                            <span className="h-1 w-1 rounded-full bg-[#16A34A]" aria-hidden="true" />
                            Available
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </section>

            {/* §18 — Venues: real Arena venues from the server, filtered to the
                current game. Empty is honest — no fabricated gyms or hubs. */}
            <section aria-label="Venues">
              <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#0D1117]">Venues</h3>
              {(() => {
                const serverGame = CLIENT_TO_SERVER_GAME[arenaGameId] ?? arenaGameId;
                const rows = (arenaVenues ?? []).filter((v: any) => Array.isArray(v?.gameIds) && v.gameIds.includes(serverGame));
                if (rows.length === 0) {
                  return <p className="text-xs text-[#0D1117]/60">No venues listed for {arenaGame.name} yet.</p>;
                }
                return (
                  <div className="space-y-1.5">
                    {rows.slice(0, 6).map((v: any, i: number) => (
                      <div key={v?.id ?? `v_${i}`} className="flex items-center justify-between gap-2 rounded-xl bg-[#FFFFFF] border border-[#E5E8EC] px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-[12px] font-bold text-[#0D1117] truncate">{v?.name}</p>
                          {v?.location && <p className="text-[10px] text-[#0D1117]/60 truncate">{v.location}</p>}
                        </div>
                        {v?.contact && <span className="shrink-0 text-[10px] font-semibold text-[#0D1117]/70">{v.contact}</span>}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </section>
          </div>
        )}

        {arenaSection === 'challenges' && (
          <div className="space-y-2">
            <button
              type="button"
              disabled={arenaBusyId === 'create'}
              onClick={() => { soundEngine.play('heavyTap'); void handleCreateChallenge(); }}
              className="w-full h-10 rounded-xl bg-[#FF5A1F] text-[#0D1117] text-[12px] font-extrabold cursor-pointer disabled:opacity-40"
            >
              {arenaBusyId === 'create' ? 'Opening…' : `Open a ${arenaGame.modes[0] ?? '1v1'} challenge`}
            </button>
            {challenges.length === 0 && (
              <p className="text-xs text-[#0D1117]/60">No open challenges for {arenaGame.name} right now.</p>
            )}
            {challenges.map((c) => {
              const mine = Boolean(CURRENT_PLAYER_ID) && c.createdByPlayerId === CURRENT_PLAYER_ID;
              const expired = Boolean(c.openUntil) && c.openUntil <= new Date().toISOString();
              const taken = c.status === 'accepted' || Boolean(c.acceptedByPlayerId);
              return (
                <div key={c.id} className="bg-[#FFFFFF] border border-[#E5E8EC] rounded-2xl p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-[#0D1117]">{c.mode} · {c.stake === 'friendly' ? 'Friendly' : c.stake === 'ranked' ? 'Ranked' : 'Entry fee'}</p>
                    {c.entryFeeKes ? <p className="text-[10px] text-[#0D1117]/60">KES {c.entryFeeKes}</p> : null}
                    <p className="text-[10px] text-[#0D1117]/60 mt-0.5">
                      {mine ? 'Your challenge' : 'Open challenge'}
                      {expired ? ' · expired' : ''}
                      {taken ? ' · taken' : ''}
                    </p>
                  </div>
                  {mine ? (
                    <button
                      type="button"
                      disabled={arenaBusyId === c.id || taken || c.status === 'cancelled'}
                      onClick={() => { soundEngine.play('tap'); void handleCancelChallenge(c); }}
                      className="shrink-0 px-3 py-1.5 rounded-xl border border-[#E5E8EC] text-[#0D1117] text-[11px] font-extrabold cursor-pointer disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={arenaBusyId === c.id || expired || taken}
                      onClick={() => { soundEngine.play('heavyTap'); void handleAcceptChallenge(c); }}
                      className="shrink-0 px-3 py-1.5 rounded-xl bg-[#FF5A1F] text-[#0D1117] text-[11px] font-extrabold cursor-pointer disabled:opacity-40"
                      title={expired ? 'This challenge has expired' : taken ? 'Already accepted' : undefined}
                    >
                      Accept
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {arenaSection === 'tournaments' && (
          <div className="space-y-2">
            {arenaTournaments.filter((t) => !t.gameId || (SERVER_TO_CLIENT_GAME[t.gameId] ?? t.gameId) === arenaGameId).length === 0 && (
              <p className="text-xs text-[#0D1117]/60">No tournaments yet for {arenaGame.name}.</p>
            )}
            {arenaTournaments.filter((t) => !t.gameId || (SERVER_TO_CLIENT_GAME[t.gameId] ?? t.gameId) === arenaGameId).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { soundEngine.play('tap'); setOpenedTournament(t); }}
                className="w-full text-left bg-[#FFFFFF] border border-[#E5E8EC] rounded-2xl p-3 cursor-pointer"
              >
                <p className="text-xs font-extrabold text-[#0D1117]">{t.title}</p>
                {t.startsAt && <p className="text-[10px] text-[#0D1117]/60 mt-0.5">{t.startsAt.slice(0, 16).replace('T', ' ')}</p>}
                <p className="text-[10px] text-[#0D1117] mt-1">Open</p>
              </button>
            ))}
            {openedTournament && (
              <div className="bg-[#FFFFFF] border border-[#2563EB] rounded-2xl p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-[#0D1117]">{openedTournament.title}</p>
                    <p className="text-[10px] text-[#0D1117]/60 mt-0.5">
                      {openedTournament.status || 'open'}
                      {openedTournament.startsAt ? ` · ${String(openedTournament.startsAt).slice(0, 16).replace('T', ' ')}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { soundEngine.play('tap'); setOpenedTournament(null); }}
                    className="text-[10px] font-extrabold text-[#0D1117]/60 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                {openedTournament.maxPlayers != null && (
                  <p className="text-[11px] text-[#0D1117]/60">Cap {openedTournament.maxPlayers}</p>
                )}
                <p className="text-[11px] text-[#0D1117]/60 leading-snug">
                  Registration is not on the server yet. Brief will not pretend you can join.
                </p>
              </div>
            )}
          </div>
        )}

        {arenaSection === 'leaderboard' && (
          <div className="space-y-2">
            <SeasonStrip />
            {arenaLeaderboard.length === 0 && (
              <p className="text-xs text-[#0D1117]/60">No confirmed results yet for {arenaGame.name}.</p>
            )}
            {arenaLeaderboard.map((row, i) => (
              <button
                key={row.playerId}
                type="button"
                onClick={() => { soundEngine.play('tap'); setOpenedStanding(row); }}
                className="w-full bg-[#FFFFFF] border border-[#E5E8EC] rounded-2xl p-3 flex items-center justify-between gap-2 text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-[#0D1117]/60 w-4">{i + 1}</span>
                  <span className="text-xs font-extrabold text-[#0D1117]">{row.player}</span>
                </div>
                <span className="text-[10px] text-[#0D1117]/60">{row.won} won · {row.played} played</span>
              </button>
            ))}
            {openedStanding && (
              <div className="bg-[#FFFFFF] border border-[#2563EB] rounded-2xl p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-extrabold text-[#0D1117]">{openedStanding.player}</p>
                  <button
                    type="button"
                    onClick={() => { soundEngine.play('tap'); setOpenedStanding(null); }}
                    className="text-[10px] font-extrabold text-[#0D1117]/60 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <p className="text-[11px] text-[#0D1117]/60">
                  {openedStanding.won} won · {openedStanding.played} played
                  {typeof openedStanding.winRate === 'number' ? ` · ${Math.round(openedStanding.winRate * 100)}%` : ''}
                </p>
                <p className="text-[10px] text-[#0D1117]/60">Confirmed results only. Brief does not invent a rating.</p>
              </div>
            )}
          </div>
        )}
      </div>
  );
}
