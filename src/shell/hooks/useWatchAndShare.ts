import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as briefApi from '../../api/briefApi';
import { objectShareUrl } from '../../nav/routes';
import type { BriefObject, FlowState, ObjectType } from '../../model/core';
import { getLifecycleBadge, getPublishedLine, getSourceChip, resolveAction } from '../../model/core';

// ---------------------------------------------------------------------------
// useWatchAndShare -- extracted from App.tsx (Phase 4). Owns this slice of shell state
// + handlers; route-sync/popstate effects STAY in App (they read the returned
// setters). Interface notes are inline; verify with run-suites.sh.
// ---------------------------------------------------------------------------

export interface UseWatchAndShareParams {
  loadObjects: any;
  publicOrigin: any;
  setRelationships: any;
  showToast: any;
  watchedIds: any;
}

export function useWatchAndShare(params: UseWatchAndShareParams) {
  const {
    loadObjects,
    publicOrigin,
    setRelationships,
    showToast,
    watchedIds,
  } = params;

  const [detailGraph, setDetailGraph] = useState<briefApi.GraphEdge[] | null>(null);

  const [objectCheckBusy, setObjectCheckBusy] = useState<string | null>(null);

  const [reportForObject, setReportForObject] = useState<string | null>(null);

  const handleConfirmObject = async (object: BriefObject) => {
    setObjectCheckBusy(object.id);
    const res = await briefApi.confirmObject(object.id);
    setObjectCheckBusy(null);
    if (!res.ok) {
      showToast(res.error ?? 'Could not record your confirmation.');
      return;
    }
    showToast(`Confirmed — ${res.data.confirmationCount} confirmation${res.data.confirmationCount === 1 ? '' : 's'} on record.`);
    await loadObjects();
  };

  const handleReportObject = async (object: BriefObject, reason: string) => {
    setObjectCheckBusy(object.id);
    const res = await briefApi.reportObject(object.id, reason);
    setObjectCheckBusy(null);
    setReportForObject(null);
    if (!res.ok) {
      showToast(res.error ?? 'Could not record your report.');
      return;
    }
    showToast('Reported. A moderator sees it; the record stays up until then.');
  };

  const handleToggleWatch = (object: BriefObject) => {
    const isWatching = watchedIds.has(object.id);

    setRelationships((prev: any[]) => {
      if (isWatching) {
        return prev.filter(
          (r: any) => !(r.targetId === object.id && r.verb === 'watched')
        );
      }
      return [
        ...prev,
        {
          id: `rel_watch_${object.id}`,
          sourceType: 'identity' as ObjectType,
          sourceId: 'usr_me',
          verb: 'watched',
          targetType: object.type,
          targetId: object.id,
          state: 'engaged' as FlowState,
          updatedAt: new Date().toISOString()
        }
      ];
    });

    showToast(
      isWatching
        ? `Stopped watching ${object.title}`
        : `Watching ${object.title} for changes`
    );
  };

  const handleShare = async (object: BriefObject) => {
    const action = resolveAction(object);
    const origin = publicOrigin || (typeof window !== 'undefined' ? window.location.origin : null);
    const shareUrl = objectShareUrl(origin, object.id);
    // Trust layer: a shared object carries its source, freshness and current
    // status, so an expired offer is never shared as active and a cancelled
    // event is never shared as confirmed.
    const sourceChip = getSourceChip(object);
    const published = getPublishedLine(object);
    const life = getLifecycleBadge(object);
    const statusLine = life
      ? (life.expired ? `Status: ${life.label}` : `Status: ${life.label}`)
      : null;
    const sourceLine = sourceChip
      ? sourceChip.replace(/^Source · /, 'Source: ').replace(/^Sources · /, 'Sources: ')
      : null;
    const lines = [
      object.title,
      object.category,
      object.locationName ? `Location: ${object.locationName}` : null,
      sourceLine,
      published ? published : null,
      statusLine,
      action.kind !== 'none' ? `Action: ${action.label}` : null,
      shareUrl ? shareUrl : null,
      !shareUrl && object.sourceUrl ? `Source: ${object.sourceUrl}` : null
    ].filter(Boolean) as string[];

    const payload = lines.join('\n');
    const nav = navigator as Navigator & {
      share?: (data: { title: string; text: string; url?: string }) => Promise<void>;
    };

    try {
      if (typeof nav.share === 'function') {
        await nav.share({ title: object.title, text: payload, url: shareUrl ?? undefined });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
        showToast(shareUrl ? 'Link copied' : 'Copied to clipboard');
        return;
      }
      showToast('Sharing unavailable on this device');
    } catch {
      // A user dismissing the share sheet is not an error worth shouting about.
    }
  };

  return {
    detailGraph,
    handleConfirmObject,
    handleReportObject,
    handleShare,
    handleToggleWatch,
    objectCheckBusy,
    reportForObject,
    setDetailGraph,
    setObjectCheckBusy,
    setReportForObject,
  };
}
