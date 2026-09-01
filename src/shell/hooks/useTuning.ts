import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as briefApi from '../../api/briefApi';
import type { BriefObject } from '../../model/core';

// ---------------------------------------------------------------------------
// useTuning -- extracted from App.tsx (Phase 4). Owns this slice of shell state
// + handlers; route-sync/popstate effects STAY in App (they read the returned
// setters). Interface notes are inline; verify with run-suites.sh.
// ---------------------------------------------------------------------------

export interface UseTuningParams {
  loadPersonal: any;
  personalState: any;
  setPersonalState: any;
  showToast: any;
}

export function useTuning(params: UseTuningParams) {
  const {
    loadPersonal,
    personalState,
    setPersonalState,
    showToast,
  } = params;

  const tuneObject = async (kind: 'more' | 'less' | 'not_interested' | 'hide_source', object: BriefObject) => {
    const list = personalState?.relevance ?? { more: [], less: [], notInterested: [], hiddenSources: [] };
    const active = kind === 'hide_source'
      ? list.hiddenSources.includes(object.sourceId ?? '')
      : kind === 'not_interested'
        ? list.notInterested.includes(object.id)
        : list[kind].includes(object.id);
    const res = active
      ? await briefApi.unsetRelevanceControl(kind, kind === 'hide_source' ? { sourceId: object.sourceId } : { objectId: object.id })
      : await briefApi.setRelevanceControl(kind, kind === 'hide_source' ? { sourceId: object.sourceId } : { objectId: object.id });
    if (!res.ok) { showToast(res.error ?? 'Could not record that.'); return; }
    setPersonalState((p: any) => (p ? { ...p, relevance: res.data.relevance } : p));
    showToast(active ? 'Reverted.' : kind === 'more' ? 'More like this — saved.'
      : kind === 'less' ? 'Less like this — saved.'
        : kind === 'not_interested' ? 'Noted. Fewer of these.' : 'This source hidden for you.');
    void loadPersonal();
  };

  return {
    tuneObject,
  };
}
