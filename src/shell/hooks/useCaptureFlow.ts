import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as briefApi from '../../api/briefApi';
import type { BriefObject, IngestionCandidate, ObjectType } from '../../model/core';
import { bootRoute, buildCaptureMessage, extractTitle, parseInboundMessage } from '../../model/core';

// ---------------------------------------------------------------------------
// useCaptureFlow -- extracted from App.tsx (Phase 4). Owns this slice of shell state
// + handlers; route-sync/popstate effects STAY in App (they read the returned
// setters). Interface notes are inline; verify with run-suites.sh.
// ---------------------------------------------------------------------------

export interface UseCaptureFlowParams {
  loadObjects: any;
  objects: any;
  refreshConnectors: any;
  setObjects: any;
  showToast: any;
}

export function useCaptureFlow(params: UseCaptureFlowParams) {
  const {
    loadObjects,
    objects,
    refreshConnectors,
    setObjects,
    showToast,
  } = params;

  const [captureOpen, setCaptureOpen] = useState(bootRoute.capture);

  const [captureText, setCaptureText] = useState('');

  const [capturePreview, setCapturePreview] = useState<IngestionCandidate | null>(null);

  const [captureMode, setCaptureMode] = useState<'quick' | 'direct'>('quick');

  const [directTitle, setDirectTitle] = useState('');

  const [directType, setDirectType] = useState<ObjectType>('knowledge');

  const [directCategory, setDirectCategory] = useState('News');

  const [directLocation, setDirectLocation] = useState('');

  const handleCaptureParse = () => {
    const raw = captureText.trim();
    if (raw === '') return;
    const message = buildCaptureMessage(raw, new Date().toISOString());
    setCapturePreview(parseInboundMessage(message, objects));
  };

  const handleCaptureConfirm = async (overrideDraft?: { title?: string; type?: ObjectType; category?: string; locationName?: string }) => {
    const raw = captureText.trim();
    if (!raw) return;
    const effTitle = overrideDraft?.title || capturePreview?.draft.title || extractTitle(raw) || 'Captured Post';
    const effType = overrideDraft?.type || capturePreview?.draft.type || 'knowledge';
    const effCat = overrideDraft?.category || capturePreview?.draft.category || 'News';
    const effLoc = overrideDraft?.locationName || capturePreview?.draft.locationName || undefined;

    // Persist through the real ingestion pipeline (server-side), so a capture
    // is discoverable and survives a reload — not just a transient local row.
    const res = await briefApi.saveBriefIt(raw, {
      title: effTitle,
      type: effType,
      category: effCat,
      locationName: effLoc
    } as any);

    // Immediately inject into local state so user sees it formed right away!
    const newObj: BriefObject = {
      id: res.ok && (res.data as any)?.objectId ? (res.data as any).objectId : `cap_${Date.now()}`,
      type: effType,
      title: effTitle,
      category: effCat,
      summary: raw.replace(/\s+/g, ' ').trim().slice(0, 240),
      locationName: effLoc,
      isVerified: false,
      sourceType: 'manual',
      sourceId: 'src_manual_capture',
      ingestedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    setObjects((prev: any[]) => [newObj, ...prev.filter((o) => o.id !== newObj.id)]);

    setCaptureText('');
    setCapturePreview(null);
    setDirectTitle('');
    setDirectLocation('');
    setCaptureOpen(false);
    if (res.ok) {
      showToast('Dropped into Brief.');
      void loadObjects();
      void refreshConnectors();
    } else {
      showToast(res.error ?? 'Could not save.');
    }
  };

  const handleDirectPost = async () => {
    const raw = captureText.trim();
    const title = directTitle.trim();
    if (!raw || !title) return;
    await handleCaptureConfirm({
      title,
      type: directType,
      category: directCategory,
      locationName: directLocation.trim() || undefined
    });
  };

  const handleCaptureCancel = () => {
    setCaptureText('');
    setCapturePreview(null);
    setDirectTitle('');
    setDirectLocation('');
    setCaptureOpen(false);
  };

  return {
    captureMode,
    captureOpen,
    capturePreview,
    captureText,
    directCategory,
    directLocation,
    directTitle,
    directType,
    handleCaptureCancel,
    handleCaptureConfirm,
    handleCaptureParse,
    handleDirectPost,
    setCaptureMode,
    setCaptureOpen,
    setCapturePreview,
    setCaptureText,
    setDirectCategory,
    setDirectLocation,
    setDirectTitle,
    setDirectType,
  };
}
