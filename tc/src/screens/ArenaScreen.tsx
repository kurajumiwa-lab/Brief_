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
  sessionUser, arenaActivity, matches, setMatches, refreshArenaMatches,
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
            <h2 className="text-lg font-extrabold text-[#F7F7F8]">Arena</h2>
            <p className="text-[11px] text-[#F7F7F8]/60 leading-snug mt-1">
              Gather with people to play. Not a competition — host challenges and run live match tests.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundMuted ? 'Unmute Arena sound effects' : 'Mute Arena sound effects'}
            title={soundMuted ? 'Turn sound effects on' : 'Turn sound effects off'}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#222630] bg-[#12151A] px-2.5 py-2 text-[10px] font-extrabold text-[#F7F7F8] transition-colors hover:border-[#22E6E0] cursor-pointer"
          >
            <ArenaSoundToggleIcon isMuted={soundMuted} size={16} color="#F7F7F8" />
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

        <ArenaShelf
          games={ARENA_GAMES}
          activity={arenaActivity}
          onOpen={(id) => { setArenaGameId(id); setArenaOpenGame(id); }}
        />

        {/* Secondary screen: the match-setup surface behind a shelf tile. */}
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
        <div className="bg-[#12151A] border border-[#222630] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#FF5A1F] text-[#0D0F12] text-[10px] font-black">
                  ⚡
                </span>
                <h3 className="text-[14px] font-black text-[#F7F7F8] tracking-tight">
                  Arena Test & Challenge Studio
                </h3>
              </div>
              <p className="text-[11px] text-[#F7F7F8]/60 mt-0.5">
                Configure and launch a live test match or challenge with all options listed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { soundEngine.play('tap'); setArenaTestCreatorOpen((v) => !v); }}
              className="px-3 py-1.5 rounded-xl border border-[#222630] text-[11px] font-extrabold text-[#F7F7F8] hover:border-[#22E6E0] transition-colors cursor-pointer"
            >
              {arenaTestCreatorOpen ? 'Close' : 'Create Test'}
            </button>
          </div>

          {arenaTestCreatorOpen && (
            <div className="space-y-3 pt-3 border-t border-[#1D2027]">
              {/* Game Selection */}
              <div>
                <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#F7F7F8]/70 mb-1.5">
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
                          ? 'bg-[#FF5A1F] text-[#0D0F12] border-[#22E6E0] shadow-xs'
                          : 'bg-[#171A20] text-[#F7F7F8]/70 border-[#222630] hover:border-[#22E6E0]/40'
                      }`}
                    >
                      <p className="text-[11px] font-black truncate">{g.name}</p>
                      <p className={`text-[8.5px] truncate mt-0.5 ${arenaTestGame === g.id ? 'text-[#F7F7F8]/70' : 'text-[#F7F7F8]/70'}`}>
                        {g.modes.length} modes
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode / Format Selection */}
              <div>
                <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#F7F7F8]/70 mb-1.5">
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
                          ? 'bg-[#FF5A1F] text-[#0D0F12] border-[#22E6E0]'
                          : 'bg-[#12151A] text-[#F7F7F8]/70 border-[#222630] hover:border-[#22E6E0]/40'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stake / Tier Selection */}
              <div>
                <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#F7F7F8]/70 mb-1.5">
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
                          ? 'bg-[#FF5A1F] text-[#0D0F12] border-[#22E6E0]'
                          : 'bg-[#12151A] text-[#F7F7F8]/70 border-[#222630] hover:border-[#22E6E0]/40'
                      }`}
                    >
                      <p className="text-[11px] font-black">{label}</p>
                      <p className={`text-[8.5px] ${arenaTestStake === s ? 'text-[#F7F7F8]/70' : 'text-[#F7F7F8]/70'}`}>{hint}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Entry fee input if prize stake */}
              {arenaTestStake === 'entry_fee' && (
                <div>
                  <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#F7F7F8]/70 mb-1">
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
                            ? 'bg-[#FF5A1F] text-[#0D0F12] border-[#22E6E0]'
                            : 'bg-[#171A20] text-[#F7F7F8]/70 border-[#222630]'
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
                      className="w-24 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-[#222630] focus:border-[#22E6E0] outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Rules / Notes */}
              <div>
                <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#F7F7F8]/70 mb-1">
                  Match Notes & Objectives (Optional)
                </label>
                <input
                  type="text"
                  value={arenaTestRules}
                  onChange={(e) => setArenaTestRules(e.target.value)}
                  placeholder="e.g. Test new squad, 90 mins, no extra time"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#222630] focus:border-[#22E6E0] outline-none"
                />
              </div>

              {/* Duration Window */}
              <div>
                <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#F7F7F8]/70 mb-1">
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
                          ? 'bg-[#FF5A1F] text-[#0D0F12] border-[#22E6E0]'
                          : 'bg-[#171A20] text-[#F7F7F8]/70 border-[#222630]'
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
                className="w-full py-3 rounded-xl bg-[#FF5A1F] hover:bg-[#000000] text-[#0D0F12] text-xs font-black cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-2"
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
                  ? 'bg-[#12151A] text-[#F7F7F8] border-[#22E6E0]'
                  : 'bg-[#12151A] text-[#F7F7F8] border-[#222630]'
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
          <LobbyBoard gameId={({ pubg: 'pubg_mobile', cod: 'cod_mobile', ea_fc: 'fc_mobile' } as Record<string, string>)[arenaGameId] ?? arenaGameId} />
        )}

        {arenaSection === 'challenges' && (
          <div className="space-y-2">
            <button
              type="button"
              disabled={arenaBusyId === 'create'}
              onClick={() => { soundEngine.play('heavyTap'); void handleCreateChallenge(); }}
              className="w-full h-10 rounded-xl bg-[#FF5A1F] text-[#0D0F12] text-[12px] font-extrabold cursor-pointer disabled:opacity-40"
            >
              {arenaBusyId === 'create' ? 'Opening…' : `Open a ${arenaGame.modes[0] ?? '1v1'} challenge`}
            </button>
            {challenges.length === 0 && (
              <p className="text-xs text-[#F7F7F8]/60">No open challenges for {arenaGame.name} right now.</p>
            )}
            {challenges.map((c) => {
              const mine = Boolean(CURRENT_PLAYER_ID) && c.createdByPlayerId === CURRENT_PLAYER_ID;
              const expired = Boolean(c.openUntil) && c.openUntil <= new Date().toISOString();
              const taken = c.status === 'accepted' || Boolean(c.acceptedByPlayerId);
              return (
                <div key={c.id} className="bg-[#12151A] border border-[#222630] rounded-2xl p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-[#F7F7F8]">{c.mode} · {c.stake === 'friendly' ? 'Friendly' : c.stake === 'ranked' ? 'Ranked' : 'Entry fee'}</p>
                    {c.entryFeeKes ? <p className="text-[10px] text-[#F7F7F8]/60">KES {c.entryFeeKes}</p> : null}
                    <p className="text-[10px] text-[#F7F7F8]/60 mt-0.5">
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
                      className="shrink-0 px-3 py-1.5 rounded-xl border border-[#222630] text-[#F7F7F8] text-[11px] font-extrabold cursor-pointer disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={arenaBusyId === c.id || expired || taken}
                      onClick={() => { soundEngine.play('heavyTap'); void handleAcceptChallenge(c); }}
                      className="shrink-0 px-3 py-1.5 rounded-xl bg-[#FF5A1F] text-[#0D0F12] text-[11px] font-extrabold cursor-pointer disabled:opacity-40"
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
              <p className="text-xs text-[#F7F7F8]/60">No tournaments yet for {arenaGame.name}.</p>
            )}
            {arenaTournaments.filter((t) => !t.gameId || (SERVER_TO_CLIENT_GAME[t.gameId] ?? t.gameId) === arenaGameId).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { soundEngine.play('tap'); setOpenedTournament(t); }}
                className="w-full text-left bg-[#12151A] border border-[#222630] rounded-2xl p-3 cursor-pointer"
              >
                <p className="text-xs font-extrabold text-[#F7F7F8]">{t.title}</p>
                {t.startsAt && <p className="text-[10px] text-[#F7F7F8]/60 mt-0.5">{t.startsAt.slice(0, 16).replace('T', ' ')}</p>}
                <p className="text-[10px] text-[#F7F7F8] mt-1">Open</p>
              </button>
            ))}
            {openedTournament && (
              <div className="bg-[#12151A] border border-[#22E6E0] rounded-2xl p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-[#F7F7F8]">{openedTournament.title}</p>
                    <p className="text-[10px] text-[#F7F7F8]/60 mt-0.5">
                      {openedTournament.status || 'open'}
                      {openedTournament.startsAt ? ` · ${String(openedTournament.startsAt).slice(0, 16).replace('T', ' ')}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { soundEngine.play('tap'); setOpenedTournament(null); }}
                    className="text-[10px] font-extrabold text-[#F7F7F8]/60 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                {openedTournament.maxPlayers != null && (
                  <p className="text-[11px] text-[#F7F7F8]/60">Cap {openedTournament.maxPlayers}</p>
                )}
                <p className="text-[11px] text-[#F7F7F8]/60 leading-snug">
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
              <p className="text-xs text-[#F7F7F8]/60">No confirmed results yet for {arenaGame.name}.</p>
            )}
            {arenaLeaderboard.map((row, i) => (
              <button
                key={row.playerId}
                type="button"
                onClick={() => { soundEngine.play('tap'); setOpenedStanding(row); }}
                className="w-full bg-[#12151A] border border-[#222630] rounded-2xl p-3 flex items-center justify-between gap-2 text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-[#F7F7F8]/60 w-4">{i + 1}</span>
                  <span className="text-xs font-extrabold text-[#F7F7F8]">{row.player}</span>
                </div>
                <span className="text-[10px] text-[#F7F7F8]/60">{row.won} won · {row.played} played</span>
              </button>
            ))}
            {openedStanding && (
              <div className="bg-[#12151A] border border-[#22E6E0] rounded-2xl p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-extrabold text-[#F7F7F8]">{openedStanding.player}</p>
                  <button
                    type="button"
                    onClick={() => { soundEngine.play('tap'); setOpenedStanding(null); }}
                    className="text-[10px] font-extrabold text-[#F7F7F8]/60 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <p className="text-[11px] text-[#F7F7F8]/60">
                  {openedStanding.won} won · {openedStanding.played} played
                  {typeof openedStanding.winRate === 'number' ? ` · ${Math.round(openedStanding.winRate * 100)}%` : ''}
                </p>
                <p className="text-[10px] text-[#F7F7F8]/60">Confirmed results only. Brief does not invent a rating.</p>
              </div>
            )}
          </div>
        )}
      </div>
  );
}
