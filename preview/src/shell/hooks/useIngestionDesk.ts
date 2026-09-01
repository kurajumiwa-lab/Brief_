import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as briefApi from '../../api/briefApi';
import type { BriefObject, CandidateStatus, IngestionCandidate, SourceType } from '../../model/core';
import { parseInboundMessage } from '../../model/core';

// ---------------------------------------------------------------------------
// useIngestionDesk -- extracted from App.tsx (Phase 4). Owns this slice of shell state
// + handlers; route-sync/popstate effects STAY in App (they read the returned
// setters). Interface notes are inline; verify with run-suites.sh.
// ---------------------------------------------------------------------------

export interface UseIngestionDeskParams {
  connectorStatus: any;
  objects: any;
  setObjects: any;
  showToast: any;
}

export function useIngestionDesk(params: UseIngestionDeskParams) {
  const {
    objects,
    setObjects,
    showToast,
    connectorStatus,
  } = params;

  const [candidates, setCandidates] = useState<IngestionCandidate[]>([]);

  const [reviewed, setReviewed] = useState<Record<string, CandidateStatus>>({});

  const [inboundBusy, setInboundBusy] = useState(false);

  const handleReceiveInbound = async () => {
    setInboundBusy(true);
    // Only unprocessed messages: anything already turned into an object is not
    // waiting on a reviewer, and re-parsing it would invite a duplicate.
    //
    // Sources are fetched alongside them because a message's channel and
    // label live on its source row. Reusing whatever happened to be cached
    // would mean provenance renders only if the user had visited the Sources
    // panel first -- so a draft would silently lose its origin.
    const [res, srcRes] = await Promise.all([
      briefApi.getRawItems({ status: 'pending' }),
      briefApi.getSources()
    ]);
    setInboundBusy(false);

    if (!res.ok) {
      showToast(`Could not reach the inbox: ${res.error}`);
      return;
    }

    const knownSources: any[] = srcRes.ok ? srcRes.data : connectorStatus.liveSources;

    const known = new Set(candidates.map((c) => c.message.id));
    const CHANNELS: SourceType[] = ['telegram', 'whatsapp', 'web', 'rss', 'api', 'manual'];
    const sourceFor = (sourceId: string) =>
      knownSources.find((s: any) => s?.id === sourceId) ?? null;
    const labelFor = (sourceId: string) => sourceFor(sourceId)?.name ?? sourceId;
    // The channel is whatever the source says it is. An unrecognised platform
    // falls back to 'manual' rather than being guessed into a specific network.
    const channelFor = (sourceId: string): SourceType => {
      const raw = sourceFor(sourceId);
      const claimed = (raw?.platform ?? raw?.type ?? '').toLowerCase();
      return CHANNELS.find((c) => c === claimed) ?? 'manual';
    };

    const fresh = res.data
      .filter((item) => !known.has(item.id))
      .map((item) =>
        parseInboundMessage(
          {
            id: item.id,
            channel: channelFor(item.sourceId),
            sourceId: item.sourceId,
            sourceLabel: labelFor(item.sourceId),
            text: item.text,
            receivedAt: item.publishedAt ?? item.retrievedAt ?? item.createdAt ?? new Date().toISOString(),
            sourceUrl: item.rawUrl ?? undefined
          },
          objects
        )
      );

    if (fresh.length === 0) {
      showToast('No new messages');
      return;
    }

    setCandidates((prev: any[]) => [...prev, ...fresh]);
    showToast(`${fresh.length} message(s) parsed for review`);
  };

  const handleAcceptCandidate = (candidate: IngestionCandidate) => {
    const accepted: BriefObject = { ...candidate.draft };

    // Apply suggested links only on acceptance -- a reviewer confirming the
    // parse is what makes a proposed edge real.
    for (const link of candidate.suggestedLinks) {
      if (link.relation === 'locationObjectId' && !accepted.locationObjectId) {
        accepted.locationObjectId = link.objectId;
      } else if (link.relation === 'relatedObjectIds') {
        accepted.relatedObjectIds = [
          ...(accepted.relatedObjectIds ?? []),
          link.objectId
        ];
      }
    }

    setObjects((prev: any[]) => [accepted, ...prev]);
    setReviewed((prev: any) => ({ ...prev, [candidate.id]: 'accepted' }));
    showToast(`Published: ${accepted.title.slice(0, 40)}`);
  };

  const handleRejectCandidate = (candidate: IngestionCandidate) => {
    setReviewed((prev: any) => ({ ...prev, [candidate.id]: 'rejected' }));
    showToast('Discarded');
  };

  return {
    candidates,
    handleAcceptCandidate,
    handleReceiveInbound,
    handleRejectCandidate,
    inboundBusy,
    reviewed,
    setCandidates,
    setInboundBusy,
    setReviewed,
  };
}
