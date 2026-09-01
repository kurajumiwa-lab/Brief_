import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as briefApi from '../../api/briefApi';
import type { ArenaGameId, ArenaMatch } from '../../model/core';
import { ARENA_GAMES, SERVER_TO_CLIENT_GAME, detectMatchRequest } from '../../model/core';
import type { ArenaBetaSegment, ArenaBetaSummary, ArenaMoneyStatus } from '../../api/types';

// ---------------------------------------------------------------------------
// useArenaData -- extracted from App.tsx (Phase 4). Owns this slice of shell state
// + handlers; route-sync/popstate effects STAY in App (they read the returned
// setters). Interface notes are inline; verify with run-suites.sh.
// ---------------------------------------------------------------------------

export interface UseArenaDataParams {
  groupIndexes: any;
  sessionUser: any;
  showToast: any;
  visibleGroups: any;
}

export function useArenaData(params: UseArenaDataParams) {
  const {
    groupIndexes,
    sessionUser,
    showToast,
    visibleGroups,
  } = params;

  const [arenaBusyId, setArenaBusyId] = useState<string | null>(null);

  const [arenaActivity, setArenaActivity] = useState<Record<string, number>>({});

  const [arenaMoney, setArenaMoney] = useState<ArenaMoneyStatus | null>(null);

  const [arenaBetaSummary, setArenaBetaSummary] = useState<ArenaBetaSummary | null>(null);

  const [arenaBetaBusy, setArenaBetaBusy] = useState(false);

  const refreshArenaBeta = React.useCallback(async () => {
    const res = await briefApi.getArenaBeta();
    if (res.ok) setArenaBetaSummary(res.data);
  }, []);

  const handleJoinArenaBeta = async (segment: ArenaBetaSegment) => {
    if (!sessionUser) {
      showToast('Your account is still loading — try again in a moment.');
      return;
    }
    setArenaBetaBusy(true);
    // Preserve a real campaign source when a player arrives from a tagged
    // community/creator link; otherwise record the in-product entry point.
    const acquisitionSource = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('utm_source') ?? 'arena_beta_card'
      : 'arena_beta_card';
    const res = await briefApi.joinArenaBeta({
      segment,
      acquisitionSource
    });
    setArenaBetaBusy(false);
    if (!res.ok) {
      showToast(res.error ?? 'Could not save your pilot spot.');
      return;
    }
    await refreshArenaBeta();
    showToast(res.data.reused ? 'You are already on the pilot list.' : 'You are on the pilot list. Add your game tag to play.');
  };

  const [matches, setMatches] = useState<ArenaMatch[]>([]);

  const mapServerMatch = (m: any): ArenaMatch => ({
    id: String(m.id),
    challengeId: String(m.challengeId ?? ''),
    gameId: (SERVER_TO_CLIENT_GAME[m.gameId] ?? m.gameId) as ArenaGameId,
    playerAId: String(m.playerAId),
    playerBId: String(m.playerBId),
    playerAName: m.playerAName ? String(m.playerAName) : undefined,
    playerBName: m.playerBName ? String(m.playerBName) : undefined,
    playedAt: m.createdAt ?? m.playedAt ?? new Date().toISOString(),
    winnerPlayerId: m.winnerPlayerId ?? undefined,
    scoreLine: m.scoreLine ?? undefined,
    confirmedByA: m.confirmedByA ?? undefined,
    confirmedByB: m.confirmedByB ?? undefined,
    status: m.status,
    reportedBy: m.reportedBy ?? null
  });

  const refreshArenaMatches = React.useCallback(async () => {
    const res = await briefApi.getArenaMatches();
    if (!res.ok) return;
    setMatches(res.data.map(mapServerMatch));
  }, []);

  const [arenaPlayers, setArenaPlayers] = useState<any[]>([]);

  const [arenaVenues, setArenaVenues] = useState<any[]>([]);

  const groupArenaSignals = useMemo(() => {
    const out: { id: string; groupName: string; summary: string; at: string }[] = [];
    for (const group of visibleGroups) {
      const entries = groupIndexes[group.id] ?? [];
      for (const entry of entries) {
        const hit = detectMatchRequest(entry, ARENA_GAMES);
        if (!hit) continue;
        const game = ARENA_GAMES.find((g) => g.id === hit.gameId);
        out.push({
          id: `sig_${entry.id}`,
          groupName: group.name,
          summary: `Someone is looking for a ${game ? game.name : 'game'} match.`,
          at: entry.sentAt
        });
      }
    }
    return out;
  }, [visibleGroups, groupIndexes]);

  const handleReportMatch = async (match: ArenaMatch, winnerPlayerId: string | null) => {
    setArenaBusyId(match.id);
    const res = await briefApi.reportArenaMatch(match.id, { winnerPlayerId });
    setArenaBusyId(null);
    if (!res.ok) {
      showToast(res.error ?? 'Could not report this result.');
      return;
    }
    await refreshArenaMatches();
    showToast('Result reported. The other player still has to confirm.');
  };

  const handleConfirmMatch = async (match: ArenaMatch) => {
    setArenaBusyId(match.id);
    const res = await briefApi.confirmArenaMatch(match.id);
    setArenaBusyId(null);
    if (!res.ok) {
      showToast(res.error ?? 'Could not confirm this result.');
      return;
    }
    await refreshArenaMatches();
    if (res.data?.disputed) {
      showToast('Players disagreed. Brief does not pick a winner.');
      return;
    }
    const rw = res.data?.yourRewards;
    showToast(rw ? `Match confirmed · +${rw.xp} XP${rw.coins ? ` · +${rw.coins} Arena Coins` : ''}` : 'Result confirmed.');
  };

  const handleAbandonMatch = async (match: ArenaMatch) => {
    setArenaBusyId(match.id);
    const res = await briefApi.abandonArenaMatch(match.id, 'never started');
    setArenaBusyId(null);
    if (!res.ok) {
      showToast(res.error ?? 'Could not abandon this match.');
      return;
    }
    await refreshArenaMatches();
    showToast('Match abandoned.');
  };

  return {
    arenaActivity,
    arenaBetaBusy,
    arenaBetaSummary,
    arenaBusyId,
    arenaMoney,
    arenaPlayers,
    arenaVenues,
    groupArenaSignals,
    handleAbandonMatch,
    handleConfirmMatch,
    handleJoinArenaBeta,
    handleReportMatch,
    mapServerMatch,
    matches,
    refreshArenaBeta,
    refreshArenaMatches,
    setArenaActivity,
    setArenaBetaBusy,
    setArenaBetaSummary,
    setArenaBusyId,
    setArenaMoney,
    setArenaPlayers,
    setArenaVenues,
    setMatches,
  };
}
