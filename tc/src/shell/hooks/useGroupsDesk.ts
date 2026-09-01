import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as briefApi from '../../api/briefApi';
import type { ConnectedSource, GroupKnowledgeEntry } from '../../model/core';
import { ALL_GROUPS, GROUP_MESSAGES, buildGroupIndex, canUserAccessGroup } from '../../model/core';

// ---------------------------------------------------------------------------
// useGroupsDesk -- extracted from App.tsx (Phase 4). Owns this slice of shell state
// + handlers; route-sync/popstate effects STAY in App (they read the returned
// setters). Interface notes are inline; verify with run-suites.sh.
// ---------------------------------------------------------------------------

export interface UseGroupsDeskParams {

}

export function useGroupsDesk(params: UseGroupsDeskParams) {
  const {

  } = params;

  const [groups, setGroups] = useState<ConnectedSource[]>(ALL_GROUPS);

  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  const visibleGroups = useMemo(
    () => groups.filter(canUserAccessGroup),
    [groups]
  );

  const groupIndexes = useMemo(() => {
    const map: Record<string, GroupKnowledgeEntry[]> = {};
    for (const group of visibleGroups) {
      map[group.id] = buildGroupIndex(GROUP_MESSAGES, group);
    }
    return map;
  }, [visibleGroups]);

  const openGroup = useMemo(
    () => visibleGroups.find((g) => g.id === openGroupId) ?? null,
    [visibleGroups, openGroupId]
  );

  const groupIndex = useMemo(
    () => (openGroup ? groupIndexes[openGroup.id] ?? [] : []),
    [openGroup, groupIndexes]
  );

  return {
    groupIndex,
    groupIndexes,
    groups,
    openGroup,
    openGroupId,
    setGroups,
    setOpenGroupId,
    visibleGroups,
  };
}
