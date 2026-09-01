import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as briefApi from '../../api/briefApi';
import type { BriefObject, BriefPost, PursuitMatch } from '../../model/core';
import { buildDailyBrief, getDestinationState, getDestinationVendors, isDestinationObject, matchPursuit, scoreObjectForPhrase } from '../../model/core';

// ---------------------------------------------------------------------------
// useDiscoveryFeed -- extracted from App.tsx (Phase 4). Owns this slice of shell state
// + handlers; route-sync/popstate effects STAY in App (they read the returned
// setters). Interface notes are inline; verify with run-suites.sh.
// ---------------------------------------------------------------------------

export interface UseDiscoveryFeedParams {
  savedIdSet: Set<string>;
  posts: any[];
  activeEdition: any;
  objects: any;
  pursuits: any;
  searchQuery: any;
  seenIds: any;
  selectedObjectType: any;
  setLikedPostIds: any;
  setSelectedObjectForDetail: any;
  watchedIds: any;
}

export function useDiscoveryFeed(params: UseDiscoveryFeedParams) {
  const {
    activeEdition,
    objects,
    pursuits,
    searchQuery,
    seenIds,
    selectedObjectType,
    setLikedPostIds,
    setSelectedObjectForDetail,
    watchedIds,
    posts,
    savedIdSet,
  } = params;

  const rankForDiscovery = (list: BriefObject[]): BriefObject[] => {
    const weight = (obj: BriefObject): number => {
      if (!isDestinationObject(obj)) return 0;
      const state = getDestinationState(obj);
      const vendors = getDestinationVendors(obj, objects).length;
      let score = 0;
      if (state === 'live') score += 40;
      else if (state === 'today') score += 30;
      else if (state === 'upcoming') score += 15;
      else if (state === 'ended') return 0;
      score += Math.min(vendors, 6) * 4;
      if (obj.isVerified) score += 3;
      const km = obj.metadata?.distanceKm;
      if (typeof km === 'number' && km <= 2) score += 4;
      return score;
    };
    return [...list].sort((a: any, b: any) => weight(b) - weight(a));
  };

  const filteredObjects = useMemo(() => {
    const byType = objects.filter(
      (obj: any) => selectedObjectType === 'all' || obj.type === selectedObjectType
    );

    const query = searchQuery.trim().toLowerCase();
    if (query === '') return rankForDiscovery(byType);

    // Weighted match: exact title beats title prefix beats category/type,
    // which beat a summary-only hit. Ties fall back to proximity.
    // Uses the same scorer as pursuit matching -- one brain, so a phrase
    // ranks identically whether typed here or saved as a Pursuit.
    return byType
      .map((obj: any) => ({ obj, score: scoreObjectForPhrase(obj, query) }))
      .filter(({ score }: any) => score > 0)
      .sort((a: any, b: any) => {
        if (b.score !== a.score) return b.score - a.score;
        const da = a.obj.metadata?.distanceKm ?? Number.MAX_SAFE_INTEGER;
        const db = b.obj.metadata?.distanceKm ?? Number.MAX_SAFE_INTEGER;
        return da - db;
      })
      .map(({ obj }: any) => obj);
  }, [objects, selectedObjectType, searchQuery]);

  const pursuitResults = useMemo(() => {
    const map: Record<string, PursuitMatch[]> = {};
    for (const pursuit of pursuits) {
      map[pursuit.id] =
        pursuit.status === 'active' || pursuit.status === 'paused'
          ? matchPursuit(pursuit, objects)
          : [];
    }
    return map;
  }, [pursuits, objects]);

  const dailyBrief = useMemo(
    () =>
      buildDailyBrief({
        objects,
        pursuits,
        pursuitResults,
        savedIds: savedIdSet,
        watchedIds,
        seenIds
      }),
    [objects, pursuits, pursuitResults, savedIdSet, watchedIds, seenIds]
  );

  const editionPosts = useMemo(
    () =>
      posts
        .filter((post) => post.edition === activeEdition)
        .sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() -
            new Date(a.publishedAt).getTime()
        ),
    [posts, activeEdition]
  );

  const openPostSubject = (post: BriefPost) => {
    const subject = objects.find((item: any) => item.id === post.relatedObjectId);
    if (subject) {
      setSelectedObjectForDetail(subject);
    }
  };

  const toggleLike = (post: BriefPost) => {
    setLikedPostIds((prev: any[]) =>
      prev.includes(post.id)
        ? prev.filter((id: any) => id !== post.id)
        : [...prev, post.id]
    );
  };

  return {
    dailyBrief,
    editionPosts,
    filteredObjects,
    openPostSubject,
    pursuitResults,
    rankForDiscovery,
    toggleLike,
  };
}
