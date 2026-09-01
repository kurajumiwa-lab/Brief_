import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as briefApi from '../../api/briefApi';
import type { Quest, QuestStatus, Reward } from '../../model/core';
import { INITIAL_QUESTS, REWARD_CATALOGUE, canRedeem, getNextRankRequirement, summariseContribution } from '../../model/core';

// ---------------------------------------------------------------------------
// useQuestsAndRewards -- extracted from App.tsx (Phase 4). Owns this slice of shell state
// + handlers; route-sync/popstate effects STAY in App (they read the returned
// setters). Interface notes are inline; verify with run-suites.sh.
// ---------------------------------------------------------------------------

export interface UseQuestsAndRewardsParams {
  showToast: any;
}

export function useQuestsAndRewards(params: UseQuestsAndRewardsParams) {
  const {
    showToast,
  } = params;

  const [quests, setQuests] = useState<Quest[]>(INITIAL_QUESTS);

  const [rewards, setRewards] = useState<Reward[]>(REWARD_CATALOGUE);

  const myContribution = useMemo(() => summariseContribution(quests), [quests]);

  const nextRank = useMemo(() => getNextRankRequirement(myContribution), [myContribution]);

  const handleSubmitQuest = (quest: Quest) => {
    setQuests((prev) =>
      prev.map((q) =>
        q.id === quest.id
          ? { ...q, status: 'submitted' as QuestStatus, submittedAt: new Date().toISOString() }
          : q
      )
    );
    // Deliberately does NOT say "you earned N points".
    showToast('Submitted for review. Points settle only if accepted.');
  };

  const handleRedeem = (reward: Reward) => {
    const gate = canRedeem(reward, {
      settledPoints: myContribution.settledPoints,
      region: 'Nairobi'
    });
    if (!gate.allowed) {
      showToast(gate.reason);
      return;
    }
    setRewards((prev) =>
      prev.map((r) => (r.id === reward.id ? { ...r, remaining: r.remaining - 1 } : r))
    );
    showToast(`Claimed. ${reward.providerName} will honour this reward.`);
  };

  return {
    handleRedeem,
    handleSubmitQuest,
    myContribution,
    nextRank,
    quests,
    rewards,
    setQuests,
    setRewards,
  };
}
