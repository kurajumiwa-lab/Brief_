import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as briefApi from '../../api/briefApi';
import { linkTokenFrom, urlWithoutArrivalParams } from '../../components/arrival';
import { shouldOpenFirstRun } from '../../components/ladder';

// ---------------------------------------------------------------------------
// useSessionBoot -- extracted from App.tsx (Phase 4). Owns this slice of shell state
// + handlers; route-sync/popstate effects STAY in App (they read the returned
// setters). Interface notes are inline; verify with run-suites.sh.
// ---------------------------------------------------------------------------

export interface UseSessionBootParams {
  activeTab: any;
  arrivalChannel: any;
  dockLastY: any;
  feedSeenRef: any;
  homeFeedStatus: any;
  menuOpen: any;
  noteActivation: any;
  setDockOn: any;
}

export function useSessionBoot(params: UseSessionBootParams) {
  const {
    activeTab,
    arrivalChannel,
    dockLastY,
    feedSeenRef,
    homeFeedStatus,
    menuOpen,
    noteActivation,
    setDockOn,
  } = params;

  const [sessionUser, setSessionUser] = useState<briefApi.AuthedUser | null>(null);

  const [authProviders, setAuthProviders] = useState<briefApi.AuthProviders | null>(null);

  const [onboardingState, setOnboardingState] = useState<briefApi.OnboardingState | null>(null);

  const [firstRunOpen, setFirstRunOpen] = useState(false);

  const [nextStepHidden, setNextStepHidden] = useState(false);

  const [sessionChecked, setSessionChecked] = useState(false);

  const provisionGuest = React.useCallback(async (): Promise<briefApi.AuthedUser | null> => {
    let handle = '';
    try { handle = window.localStorage.getItem('brief_local_handle') ?? ''; } catch { /* private mode */ }
    if (!handle) {
      handle = 'local' + Math.random().toString(36).slice(2, 10);
      try { window.localStorage.setItem('brief_local_handle', handle); } catch { /* private mode */ }
    }
    const password = 'brief-local-pass';
    const reg = await briefApi.register(handle, password, 'Local');
    if (reg.ok) {
      setSessionUser(reg.data);
      return reg.data;
    }
    // Handle already exists from a prior visit: log back in.
    const logged = await briefApi.login(handle, password);
    if (logged.ok) {
      setSessionUser(logged.data);
      return logged.data;
    }
    return null;
  }, []);

  const bootstrapSession = React.useCallback(async () => {
    // Inside a Telegram Mini App, the user's real identity is the signed
    // initData — bind it to a Brief account rather than minting an anonymous
    // local identity. Telegram is a DOOR, not a requirement: nobody outside
    // the Mini App is ever asked for it.
    if (briefApi.isTelegramMiniApp()) {
      const tg = (window as any)?.Telegram?.WebApp;
      try {
        tg?.ready?.();
        tg?.expand?.();
      } catch { /* SDK not fully loaded */ }
      const init = await briefApi.telegramInit(String(tg.initData));
      if (init.ok) {
        setSessionUser(init.data);
        setSessionChecked(true);
        return;
      }
      // initData rejected (stale/bad) — fall through to the ordinary path so
      // the app still renders, just without the Telegram identity.
    }

    // Arrived from a link that already knows who this is.
    //
    // The honest version of "the in-app browser identifies the email": the
    // link carries a token THIS server signed for that address, and the server
    // re-verifies the signature before it means anything. A bare ?email= in a
    // URL is not an identity and is ignored. Nothing here reads a device
    // account — no browser exposes that.
    const linkToken = typeof window === 'undefined' ? null : linkTokenFrom(window.location.href);
    if (linkToken) {
      const viaLink = await briefApi.continueFromLinkToken(linkToken, arrivalChannel);
      if (viaLink.ok) {
        setSessionUser(viaLink.data);
        setSessionChecked(true);
        // Burn the parameter so a reload or a forwarded URL cannot replay it.
        try {
          window.history.replaceState({}, '', urlWithoutArrivalParams(window.location.href));
        } catch { /* history blocked */ }
        return;
      }
    }

    const me = await briefApi.whoAmI();
    if (me.ok) {
      setSessionUser(me.data);
      setSessionChecked(true);
      return;
    }
    // 401 means the server wants a real identity. It no longer gets one
    // invented for it: the first-run flow opens and the person chooses
    // Google, a handle, or a device-only account.
    setSessionChecked(true);
    if (me.status === 401) setFirstRunOpen(true);
  }, [arrivalChannel]);

  React.useEffect(() => { void bootstrapSession(); }, [bootstrapSession]);

  React.useEffect(() => {
    void briefApi.getAuthProviders().then((res) => {
      if (res.ok) setAuthProviders(res.data);
    });
  }, []);

  const refreshOnboarding = React.useCallback(async () => {
    if (!sessionUser) return;
    const res = await briefApi.getOnboarding();
    if (res.ok) setOnboardingState(res.data);
  }, [sessionUser]);

  React.useEffect(() => { void refreshOnboarding(); }, [refreshOnboarding]);

  React.useEffect(() => {
    if (!sessionUser) return;
    if (activeTab !== 'nearby') return;
    void briefApi.getLadder().then((res) => {
      if (res.ok) {
        setOnboardingState((prev) => (prev ? { ...prev, ladder: res.data } : prev));
      }
    });
  }, [sessionUser, activeTab]);

  React.useEffect(() => {
    if (feedSeenRef.current) return;
    if (!sessionUser || homeFeedStatus !== 'ready') return;
    feedSeenRef.current = true;
    noteActivation('feed_seen', {});
  }, [sessionUser, homeFeedStatus, noteActivation]);

  React.useEffect(() => {
    if (!sessionUser || arrivalChannel === 'browser') return;
    void briefApi.setOnboardingSource(arrivalChannel);
  }, [sessionUser, arrivalChannel]);

  React.useEffect(() => {
    if (!sessionChecked) return;
    if (firstRunOpen) return;
    if (!sessionUser) return;
    if (!onboardingState) return;
    if (
      shouldOpenFirstRun({
        signedIn: true,
        goal: onboardingState.profile?.goal,
        finishedAt: onboardingState.profile?.finishedAt,
        skippedAt: onboardingState.profile?.skippedAt
      })
    ) {
      setFirstRunOpen(true);
    }
  }, [sessionChecked, sessionUser, onboardingState, firstRunOpen]);

  React.useEffect(() => {
    const onScroll = () => {
      const y = typeof window === 'undefined' ? 0 : window.scrollY;
      if (menuOpen || activeTab === 'arena') {
        setDockOn(true);
        dockLastY.current = y;
        return;
      }
      if (y > dockLastY.current + 10 && y > 48) setDockOn(false);
      else if (y < dockLastY.current - 10) setDockOn(true);
      dockLastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [menuOpen, activeTab]);

  React.useEffect(() => {
    // Menu is a screen: keep the five-tab dock up while it is open.
    if (menuOpen) setDockOn(true);
  }, [menuOpen]);

  const ladder = onboardingState?.ladder ?? null;

  return {
    ladder,
    authProviders,
    bootstrapSession,
    firstRunOpen,
    nextStepHidden,
    onboardingState,
    provisionGuest,
    refreshOnboarding,
    sessionChecked,
    sessionUser,
    setAuthProviders,
    setFirstRunOpen,
    setNextStepHidden,
    setOnboardingState,
    setSessionChecked,
    setSessionUser,
  };
}
