import { deriveDestinationAlerts, readLastSeen, writeLastSeen, alertLabel, type DestinationAlerts } from '../../nav/alerts';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as briefApi from '../../api/briefApi';

// ---------------------------------------------------------------------------
// useAlertsPulse -- extracted from App.tsx (Phase 4). Owns this slice of shell state
// + handlers; route-sync/popstate effects STAY in App (they read the returned
// setters). Interface notes are inline; verify with run-suites.sh.
// ---------------------------------------------------------------------------

export interface UseAlertsPulseParams {

}

export function useAlertsPulse(params: UseAlertsPulseParams) {
  const {

  } = params;

  const [destinationAlerts, setDestinationAlerts] = useState<DestinationAlerts>({ nearby: 0, arena: 0, mylayer: 0, workflows: 0 });

  const alertsTick = React.useRef(0);

  React.useEffect(() => {
    let cancelled = false;
    const derive = async () => {
      const tick = ++alertsTick.current;
      const [notifRes, roomsRes, feedRes] = await Promise.all([
        briefApi.getNotifications(true).catch(() => null),
        briefApi.listEplRooms().catch(() => null),
        briefApi.getPublicFeed({}).catch(() => null)
      ]);
      if (cancelled || tick !== alertsTick.current) return;
      const feed = (feedRes && feedRes.ok ? feedRes.data?.feed : null) ?? null;
      const feedItems = feed
        ? [
            ...(Array.isArray(feed.hero) ? feed.hero : []),
            ...(Array.isArray(feed.discovery) ? feed.discovery : []),
            ...(Array.isArray(feed.opportunities) ? feed.opportunities : []),
            ...(Array.isArray(feed.more) ? feed.more : []),
            ...(Array.isArray(feed.moreTea) ? feed.moreTea : []),
            ...(feed.tea ? [feed.tea] : [])
          ]
        : [];
      const lastSeen = {
        nearby: readLastSeen('nearby'),
        arena: readLastSeen('arena')
      };
      setDestinationAlerts(deriveDestinationAlerts({
        notifications: notifRes && notifRes.ok ? notifRes.data?.notifications ?? [] : null,
        rooms: roomsRes && roomsRes.ok ? roomsRes.data ?? [] : null,
        feedItems,
        lastSeen
      }));
    };
    void derive();
    const interval = window.setInterval(() => { void derive(); }, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void derive(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return {
    alertsTick,
    destinationAlerts,
    setDestinationAlerts,
  };
}
