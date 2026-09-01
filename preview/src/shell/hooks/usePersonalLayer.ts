import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as briefApi from '../../api/briefApi';
import type { FlowState, ObjectRelationship, ObjectType } from '../../model/core';

// ---------------------------------------------------------------------------
// usePersonalLayer -- extracted from App.tsx (Phase 4). Owns this slice of shell state
// + handlers; route-sync/popstate effects STAY in App (they read the returned
// setters). Interface notes are inline; verify with run-suites.sh.
// ---------------------------------------------------------------------------

export interface UsePersonalLayerParams {
  getRelatedObjects: any;
  loadPersonal: any;
  objects: any;
  personalPicks: any;
  setPersonalBriefDismissed: any;
  setPersonalBusy: any;
  setPersonalPicks: any;
  showToast: any;
}

export function usePersonalLayer(params: UsePersonalLayerParams) {
  const {
    getRelatedObjects,
    loadPersonal,
    objects,
    personalPicks,
    setPersonalBriefDismissed,
    setPersonalBusy,
    setPersonalPicks,
    showToast,
  } = params;

  const [relationships, setRelationships] = useState<ObjectRelationship[]>([]);

  const [likedPostIds, setLikedPostIds] = useState<string[]>([]);

  const [personalState, setPersonalState] = useState<briefApi.PersonalState | null>(null);

  React.useEffect(() => {
    if (!personalState || personalState.saved.length === 0) return;
    setRelationships((prev) => {
      const have = new Set(prev.filter((r) => r.verb === 'saved').map((r) => r.targetId));
      const missing = personalState.saved.filter((id) => !have.has(id) && objects.some((o: any) => o.id === id));
      if (missing.length === 0) return prev;
      const nowIso = new Date().toISOString();
      return [
        ...prev,
        ...missing.map((id) => ({
          id: `rel_srv_${id}`,
          sourceType: 'identity' as ObjectType,
          sourceId: 'usr_me',
          verb: 'saved' as const,
          targetType: (objects.find((o: any) => o.id === id)?.type ?? 'knowledge') as ObjectType,
          targetId: id,
          state: 'engaged' as FlowState,
          updatedAt: nowIso
        }))
      ];
    });
  }, [personalState, objects]);

  const togglePersonalPick = (group: 'locations' | 'types' | 'topics', value: string) =>
    setPersonalPicks((p: any) => ({
      ...p,
      [group]: p[group].includes(value) ? p[group].filter((v: any) => v !== value) : [...p[group], value]
    }));

  const savePersonalBrief = async () => {
    setPersonalBusy(true);
    const res = await briefApi.putInterests(personalPicks);
    setPersonalBusy(false);
    if (!res.ok) {
      showToast(res.error ?? 'Could not save your Brief.');
      return;
    }
    setPersonalState((p) => (p ? { ...p, interests: res.data.interests } : p));
    setPersonalBriefDismissed(false);
    setPersonalPicks({ locations: [], types: [], topics: [] });
    showToast('Your Brief is set.');
    void loadPersonal();
  };

  const followOne = async (kind: 'location' | 'type' | 'topic', value: string) => {
    const res = await briefApi.followInterest(kind, value);
    if (!res.ok) { showToast(res.error ?? 'Could not follow that.'); return; }
    setPersonalState((p) => (p ? { ...p, interests: res.data.interests } : p));
    void loadPersonal();
  };

  const unfollowOne = async (kind: 'location' | 'type' | 'topic', value: string) => {
    const res = await briefApi.unfollowInterest(kind, value);
    if (!res.ok) { showToast(res.error ?? 'Could not unfollow.'); return; }
    setPersonalState((p) => (p ? { ...p, interests: res.data.interests } : p));
    void loadPersonal();
  };

  const unfollowEntityOne = async (id: string) => {
    const res = await briefApi.unfollowEntity(id);
    if (!res.ok) { showToast(res.error ?? 'Could not unfollow.'); return; }
    setPersonalState((p) => p
      ? { ...p, followed: p.followed.filter((f) => f.id !== id) }
      : p);
    void loadPersonal();
  };

  const savedObjects = useMemo(
    () =>
      objects.filter((obj: any) =>
        relationships.some(
          (rel) => rel.targetId === obj.id && rel.verb === 'saved'
        )
      ),
    [objects, relationships]
  );

  const watchedIds = useMemo(
    () => new Set(relationships.filter((r) => r.verb === 'watched').map((r) => r.targetId)),
    [relationships]
  );

  const savedIdSet = useMemo(
    () => new Set<string>(savedObjects.map((o: any) => o.id)),
    [savedObjects]
  );

  const relatedToSavedIds = useMemo(() => {
    const out = new Set<string>();
    for (const saved of savedObjects) {
      for (const rel of getRelatedObjects(saved)) out.add(rel.item.id);
    }
    return out;
  }, [savedObjects, objects]);

  return {
    followOne,
    likedPostIds,
    personalState,
    relatedToSavedIds,
    relationships,
    savePersonalBrief,
    savedIdSet,
    savedObjects,
    setLikedPostIds,
    setPersonalState,
    setRelationships,
    togglePersonalPick,
    unfollowEntityOne,
    unfollowOne,
    watchedIds,
  };
}
