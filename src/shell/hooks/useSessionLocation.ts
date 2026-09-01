import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as briefApi from '../../api/briefApi';
import type { GeoPoint } from '../../components/LocationChip';
import { objectFromServer } from '../../model/core';

// ---------------------------------------------------------------------------
// useSessionLocation -- extracted from App.tsx (Phase 4). Owns this slice of shell state
// + handlers; route-sync/popstate effects STAY in App (they read the returned
// setters). Interface notes are inline; verify with run-suites.sh.
// ---------------------------------------------------------------------------

export interface UseSessionLocationParams {
  activeTab: any;
  setObjects: any;
  setSelectedLocation: any;
  workflowSection: any;
}

export function useSessionLocation(params: UseSessionLocationParams) {
  const {
    activeTab,
    setObjects,
    setSelectedLocation,
    workflowSection,
  } = params;

  const [connectorStatus, setConnectorStatus] = useState<{
    online: boolean;
    checked: boolean;
    capabilities: Record<string, any> | null;
    liveSources: any[];
    stats: Record<string, any> | null;
  }>({ online: false, checked: false, capabilities: null, liveSources: [], stats: null });

  const refreshConnectors = React.useCallback(async () => {
    // Everything goes through briefApi: one API layer, one set of response
    // guards, no fetch() outside src/api (spec 4). Capabilities/status that
    // fail their shape guard degrade to null exactly as before.
    const [srcRes, capRes, statRes] = await Promise.all([
      briefApi.getSources(),
      briefApi.getConnectorCapabilities(),
      briefApi.getIngestStatus()
    ]);

    if (!srcRes.ok) {
      // A dead connector server must never break Brief (spec 30).
      setConnectorStatus((prev) => ({ ...prev, online: false, checked: true }));
      return;
    }

    setConnectorStatus({
      online: true,
      checked: true,
      capabilities: capRes.ok ? capRes.data : null,
      liveSources: srcRes.data,
      stats: statRes.ok ? statRes.data : null
    });
  }, []);

  React.useEffect(() => {
    // Connector state (capabilities + live stats) backs both the Sources tab
    // AND the Actions dashboard's pipeline/ingest cards, so refresh it for any
    // workflows view — not just Sources.
    if (activeTab === 'workflows') {
      void refreshConnectors();
    }
  }, [activeTab, workflowSection, refreshConnectors]);

  const [objectsLoad, setObjectsLoad] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    error: string | null;
  }>({ status: 'idle', error: null });

  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);

  const [feedArea, setFeedArea] = useState<string | null>(null);

  const [locating, setLocating] = useState(false);

  const [locError, setLocError] = useState<string | null>(null);

  const locate = React.useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setLocError('This browser has no location service — tap a city instead.');
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: 'your location'
        });
        // A precise device fix scopes the feed by distance; it is not a
        // named area.
        setFeedArea(null);
        setSelectedLocation('your location');
      },
      () => {
        setLocating(false);
        setLocError('Location unavailable — tap a city instead.');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }, []);

  const loadObjects = React.useCallback(async (loc?: { lat: number; lng: number }) => {
    setObjectsLoad({ status: 'loading', error: null });
    // The ranked discovery feed: freshness + trust + engagement, server-derived.
    // When a location is set, it is also geo-scoped (distanceKm per object).
    const res = await briefApi.discoverObjects(loc ? { lat: loc.lat, lng: loc.lng, radiusKm: 40 } : {});
    if (res.ok) {
      setObjects((res.data as any[]).map(objectFromServer));
      setObjectsLoad({ status: 'ready', error: null });
    } else {
      setObjects([]);
      setObjectsLoad({ status: 'error', error: res.error });
    }
  }, []);

  React.useEffect(() => {
    void loadObjects(userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : undefined);
  }, [loadObjects, userLocation]);

  return {
    connectorStatus,
    feedArea,
    loadObjects,
    locError,
    locate,
    locating,
    objectsLoad,
    refreshConnectors,
    setConnectorStatus,
    setFeedArea,
    setLocError,
    setLocating,
    setObjectsLoad,
    setUserLocation,
    userLocation,
  };
}
