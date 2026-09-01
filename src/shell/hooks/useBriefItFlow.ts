import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as briefApi from '../../api/briefApi';

// ---------------------------------------------------------------------------
// useBriefItFlow -- extracted from App.tsx (Phase 4). Owns this slice of shell state
// + handlers; route-sync/popstate effects STAY in App (they read the returned
// setters). Interface notes are inline; verify with run-suites.sh.
// ---------------------------------------------------------------------------

export interface UseBriefItFlowParams {
  loadObjects: any;
  noteActivation: any;
  refreshConnectors: any;
}

export function useBriefItFlow(params: UseBriefItFlowParams) {
  const {
    loadObjects,
    noteActivation,
    refreshConnectors,
  } = params;

  const [briefItText, setBriefItText] = useState('');

  const [briefItPreview, setBriefItPreview] = useState<any>(null);

  const [briefItBusy, setBriefItBusy] = useState(false);

  const [briefItSaved, setBriefItSaved] = useState<string | null>(null);

  const runBriefItSave = async () => {
    setBriefItBusy(true);
    const res = await briefApi.saveBriefIt(briefItText);
    if (res.ok) {
      const result: any = res.data.result;
      setBriefItSaved(
        result?.merged
          ? 'Merged into an object Brief already had.'
          : result?.created
          ? 'Saved to Brief.'
          : result?.reason ?? 'Nothing object-worthy found.'
      );
      setBriefItPreview(null);
      setBriefItText('');
      // A capture is the "contribute" rung. The server also sees the manual
      // source membership this creates; the event just timestamps the moment.
      if (result?.created || result?.merged) noteActivation('capture_saved', {});
      void refreshConnectors();
      void loadObjects();
    } else {
      setBriefItSaved(res.error);
    }
    setBriefItBusy(false);
  };

  return {
    briefItBusy,
    briefItPreview,
    briefItSaved,
    briefItText,
    runBriefItSave,
    setBriefItBusy,
    setBriefItPreview,
    setBriefItSaved,
    setBriefItText,
  };
}
