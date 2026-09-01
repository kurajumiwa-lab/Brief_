import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as briefApi from '../../api/briefApi';
import { getKeywords, areTypesAffine, countKeywordOverlap, EXPLICIT_LINK_FLOOR } from '../../model/core';
// EXPLICIT_LINK_FLOOR travels with the function that uses it (was module-local in App).
import type { FlowState, ObjectRelationship, ObjectType , ScoredRelation , BriefObject , RelationReason } from '../../model/core';

// ---------------------------------------------------------------------------
// usePersonalLayer -- extracted from App.tsx (Phase 4). Owns this slice of shell state
// + handlers; route-sync/popstate effects STAY in App (they read the returned
// setters). Interface notes are inline; verify with run-suites.sh.
// ---------------------------------------------------------------------------

export interface UsePersonalLayerParams {
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

  const getRelatedObjects = (object: BriefObject): ScoredRelation[] => {
    const explicit = new Set(
      [
        object.parentObjectId,
        object.providerObjectId,
        object.locationObjectId,
        ...(object.relatedObjectIds ?? [])
      ].filter(Boolean) as string[]
    );

    // Objects that point AT this one are just as meaningful as ones it
    // points to -- a place should surface the vendors located there.
    const inbound = new Set(
      objects
        .filter(
          (item: any) =>
            item.parentObjectId === object.id ||
            item.providerObjectId === object.id ||
            item.locationObjectId === object.id ||
            (item.relatedObjectIds ?? []).includes(object.id)
        )
        .map((item: any) => item.id)
    );

    const keywords = getKeywords(object);

    const scored: ScoredRelation[] = objects
      .filter((item: any) => item.id !== object.id)
      .map((item: any) => {
        let score = 0;
        let reason: RelationReason = 'similar';

        // 1. Explicit, curated links outrank everything inferred -- and must
        //    do so unconditionally. The inferred signals below (2-8) can sum
        //    to roughly 24, so a flat +20 was not actually a guarantee: a
        //    coincidentally similar object could outrank a real, curated
        //    relationship. EXPLICIT_LINK_FLOOR sits above every reachable
        //    inferred total, so a stated relationship can never be buried by
        //    keyword noise. The smaller per-kind bonus only orders explicit
        //    links against each other.
        if (explicit.has(item.id) || inbound.has(item.id)) {
          const isProvider =
            item.id === object.providerObjectId ||
            item.providerObjectId === object.id;
          const isLocation =
            item.id === object.locationObjectId ||
            item.locationObjectId === object.id;

          score += EXPLICIT_LINK_FLOOR;

          if (isProvider) {
            // Who sells or operates this is the most actionable hop.
            score += 12;
            reason = 'provider';
          } else if (isLocation) {
            score += 8;
            reason = 'location';
          } else {
            score += 4;
            reason = 'linked';
          }
        }

        // 2. Same category.
        if (item.category === object.category) score += 6;

        // 3. Same type.
        if (item.type === object.type) score += 3;

        // 4. Complementary type for this object's errand.
        if (item.type !== object.type && areTypesAffine(object.type, item.type)) {
          score += 2;
          if (reason === 'similar') reason = 'complementary';
        }

        // 5. Shared location text.
        if (item.locationName && object.locationName) {
          const a = item.locationName.toLowerCase();
          const b = object.locationName.toLowerCase();
          if (a.includes(b.split(',')[0]) || b.includes(a.split(',')[0])) {
            score += 4;
            if (reason === 'similar') reason = 'nearby';
          }
        }

        // 6. Same operator / vendor.
        if (
          item.creatorName &&
          object.creatorName &&
          item.creatorName === object.creatorName
        ) {
          score += 4;
          if (reason === 'similar') reason = 'provider';
        }

        // 7. Keyword overlap across title, category and summary.
        const overlap = countKeywordOverlap(keywords, getKeywords(item));
        if (overlap > 0) score += Math.min(overlap, 3);

        // 8. Proximity nudge -- never decisive, only breaks ties.
        const distance = item.metadata?.distanceKm;
        if (distance !== undefined) score += Math.max(0, 2 - distance / 2);

        return { item, score, reason };
      })
      .filter(({ score }: any) => score > 0)
      .sort((a: any, b: any) => b.score - a.score);

    // Nothing scored: fall back to the physically closest objects so the
    // rail is never empty. Better a weak neighbour than a dead end.
    if (scored.length === 0) {
      return objects
        .filter((item: any) => item.id !== object.id)
        .map((item: any) => ({
          item,
          score: 0,
          reason: 'nearby' as RelationReason,
          distance: item.metadata?.distanceKm ?? Number.MAX_SAFE_INTEGER
        }))
        .sort((a: any, b: any) => a.distance - b.distance)
        .slice(0, 4)
        .map(({ item, score, reason }: any) => ({ item, score, reason }));
    }

    return scored.slice(0, 4);
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
    getRelatedObjects,
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
