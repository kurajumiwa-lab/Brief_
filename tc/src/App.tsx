import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import * as briefApi from './api/briefApi';
import {
  parsePath,
  toPath,
  objectShareUrl,
  isBriefRoute,
  explorePath,
  collectionPath,
  DEFAULT_ROUTE,
  type BriefRoute
} from './nav/routes';
import type { ArenaMoneyStatus } from './api/types';
import QRCode from 'qrcode';
import { deriveDestinationAlerts, readLastSeen, writeLastSeen, alertLabel, type DestinationAlerts } from './nav/alerts';
import { EntityPage } from './components/EntityPage';
import { FollowingSurface } from './components/FollowingSurface';
import { LocationPage } from './components/LocationPage';
import { RelatedContent } from './components/RelatedContent';
import { CollectionsSurface } from './components/CollectionsSurface';
import { CollectionPage } from './components/CollectionPage';
import { CollectionPicker } from './components/CollectionPicker';
import { EntityChip } from './components/EntityChip';
import { CampaignDistribution } from './components/CampaignDistribution';
import { AwaitingPayment } from './components/AwaitingPayment';
import { SourcesPanel } from './components/SourcesPanel';
import { ConnectedGroups } from './components/ConnectedGroups';
import { MoneyPanel } from './components/MoneyPanel';
import { ResaleDesk } from './components/ResaleDesk';
import { MyTickets } from './components/MyTickets';
import { EventResale } from './components/EventResale';
import { EventsHub } from './components/EventsHub';
import { MshikanoDesk } from './components/MshikanoDesk';
import { VerificationPanel } from './components/VerificationPanel';
import { EplDesk } from './components/EplDesk';
import { Vault } from './components/vault/Vault';
import ServiceFees from './components/ServiceFees';
import { WhatsAppShopBuilder } from './components/WhatsAppShopBuilder';
import RewardsDesk from './components/RewardsDesk';
import { CheckIn } from './components/CheckIn';
import { HostCommand } from './components/HostCommand';
import { TickerBanner, PromptBanner, JumbotronBanner } from './components/SignalBanner';
import { BracketLadder } from './components/BracketLadder';
import { TournamentCard } from './components/TournamentCard';
import { ActionsEngine } from './components/ActionsEngine';
import { Circles } from './components/Circles';
import { Marketplace } from './components/Marketplace';
import { Pursuits } from './components/Pursuits';
import { Inbox } from './components/Inbox';
import { TriageQueue } from './components/TriageQueue';
import { Quests } from './components/Quests';
import { LocationChip } from './components/LocationChip';
import type { GeoPoint } from './components/LocationChip';
import { ArenaShelf } from './components/ArenaShelf';
import { ArenaPulse, SeasonStrip } from './components/ArenaPulse';
import { MainShelf } from './components/MainShelf';
import { Onboarding } from './components/Onboarding';
import { NextStep } from './components/NextStep';
import { isSurfaceUnlocked, shouldOpenFirstRun, showsLadder, unlockHint } from './components/ladder';
import { arrivalSource, linkTokenFrom, urlWithoutArrivalParams, type ArrivalChannel } from './components/arrival';
import { ArenaBetaPilot } from './components/ArenaBetaPilot';
import type { ArenaBetaSegment, ArenaBetaSummary } from './api/types';
import { EnginePanel } from './components/EnginePanel';
import { GroupBuyPortal } from './components/GroupBuyPortal';
import { MatchQueuePanel } from './components/MatchQueuePanel';
import { TicketBar } from './components/TicketBar';
import { ArenaGameScreen } from './components/ArenaGameScreen';
import type { ArenaStakeKind } from './components/ArenaGameScreen';
import { LobbyBoard } from './components/LobbyBoard';
import { FeedComposer } from './components/FeedComposer';
import { WireSection } from './components/WireSection';
import { TeaDesk } from './components/TeaDesk';
import { CreatorCockpit } from './components/CreatorCockpit';
import { CreatorProfilePanel, OpportunitiesPanel, MessagesPanel, SubscriptionsPanel } from './components/CreatorPanels';
import { SearchResults } from './components/SearchResults';
import { YardEngineDesk } from './components/YardEngineDesk';
import type { YardSection } from './components/YardEngineDesk';
import { TeaReader } from './components/TeaReader';
import type { CircleDetail as ApiCircleDetail } from './api/briefApi';
import type {
  Campaign as ApiCampaign,
  CampaignType as ApiCampaignType,
  PublicCampaign as ApiPublicCampaign,
  Registration as ApiRegistration
} from './api/types';
import {
  Building2,
  Search,
  Sparkles,
  FolderPlus,
  Plus,
  Terminal,
  Activity,
  MapPin,
  Users,
  Briefcase,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Bookmark,
  Share2,
  Bell,
  Flag,
  MoreHorizontal,
  Clock,
  Tag,
  Megaphone,
  AlertTriangle,
  BadgePercent,
  Globe,
  Trash2,
  Circle,
  Award,
  TrendingUp,
  User,
  Store,
  Landmark,
  Sun,
  Sunset,
  CalendarDays,
  Newspaper,
  Heart,
  MessageCircle,
  ExternalLink,
  Eye,
  X,
  Menu,
  ChevronLeft
} from 'lucide-react';
import { MenuSheet } from './components/MenuSheet';
import { AdminDesk } from './components/AdminDesk';
import type { MenuTarget } from './components/MenuSheet';
import { PlayAs } from './components/PlayAs';
import type { LucideIcon } from 'lucide-react';
import {
  ROOM, HOME_MORE, SAVED_TABS, INBOX_TABS, FILTERS,
  WORKFLOW_BUNDLES, SAVED_BUNDLES, QUEUE_LABEL, QUEUE_CHIP, QUEUE_HINT
} from './ui/names';
import { MoneyBand } from './components/MoneyBand';
import { ArenaScreen } from './screens/ArenaScreen';
import { MyLayerScreen } from './screens/MyLayerScreen';
import { NearbyScreen } from './screens/NearbyScreen';
import { WorkflowsScreen } from './screens/WorkflowsScreen';
import { OverlaysShell } from './screens/OverlaysShell';
import { usePersonalLayer } from './shell/hooks/usePersonalLayer';
import { useIngestionDesk } from './shell/hooks/useIngestionDesk';
import { useArenaData } from './shell/hooks/useArenaData';
import { useCaptureFlow } from './shell/hooks/useCaptureFlow';
import { useCampaignHub } from './shell/hooks/useCampaignHub';
import {
  ALL_GROUPS,
  ARENA_GAMES,
  ActivityDot,
  CLIENT_TO_SERVER_GAME,
  DESTINATIONS,
  DESTINATION_ICONS,
  DESTINATION_STATE_LABELS,
  EXPLICIT_LINK_FLOOR,
  GROUP_MESSAGES,
  INITIAL_JOURNEYS,
  INITIAL_OBJECTS,
  INITIAL_POSTS,
  INITIAL_QUESTS,
  INITIAL_SOURCES,
  REPORT_REASONS,
  REWARD_CATALOGUE,
  SAVE_LABELS,
  SERVER_TO_CLIENT_GAME,
  TEA_EDITIONS,
  areTypesAffine,
  arenaPlayerLabel,
  bootRoute,
  briefWhenLabel,
  buildCaptureMessage,
  buildDailyBrief,
  buildDiscoveryBrief,
  buildGroupIndex,
  buildKeyFacts,
  buildMapsHref,
  buildPersonalSections,
  buildTelHref,
  campaignSlugFromPath,
  canRedeem,
  canUserAccessGroup,
  countKeywordOverlap,
  createBriefGraph,
  createDirectChallenge,
  createPursuit,
  declineChallenge,
  detectMatchRequest,
  diffObjects,
  entityChipsFor,
  extractTitle,
  formatCount,
  formatSourceDate,
  getActionNote,
  getAppearanceReasons,
  getBriefRank,
  getCardLevel,
  getCorroborationLabel,
  getCurrentEdition,
  getDestinationAccess,
  getDestinationState,
  getDestinationVendors,
  getDistanceLabel,
  getEditionMeta,
  getFreshness,
  getKeywords,
  getLifecycleBadge,
  getNextRankRequirement,
  getObjectTypeMeta,
  getPivotMessage,
  getPostKindMeta,
  getPublishedLine,
  getReasonChip,
  getRelatedHeading,
  getRelativeTime,
  getSourceChip,
  getSourceHealth,
  getSourceHealthLabel,
  getSourceKindChip,
  getSuggestedActions,
  getUnansweredQuestions,
  getVendorDestinations,
  getVendorOfferings,
  isDestinationObject,
  isResultConfirmed,
  matchExistsForChallenge,
  matchPursuit,
  objectFromServer,
  parseInboundMessage,
  resolveAction,
  runGroupCommand,
  scoreObjectForPhrase,
  suggestChallengeTime,
  summariseContribution
} from './model/core';
import type {
  ArenaChallenge,
  ArenaGameId,
  ArenaMatch,
  BriefObject,
  BriefPost,
  CandidateStatus,
  ChallengeStake,
  ChallengeStatus,
  ConnectedSource,
  Destination,
  FlowState,
  GroupAccess,
  GroupCommandResult,
  GroupKnowledgeEntry,
  IngestionCandidate,
  Journey,
  MyLayerSection,
  NearbySection,
  ObjectRelationship,
  ObjectType,
  ProtocolAction,
  Pursuit,
  PursuitMatch,
  PursuitStatus,
  Quest,
  QuestStatus,
  RelationReason,
  Reward,
  SaveLabel,
  ScoredRelation,
  Source,
  SourceType,
  TeaEdition,
  WatchCondition,
  WorkflowSection
} from './model/core';
// Public surface preserved: components import these names from '../App'.
export * from './model/core';

export function App() {
  // Public campaign links open the public page, not the app shell. Checked
  // once at render: a stranger with a link is not a Brief user.
  const publicSlug =
    typeof window !== 'undefined' && window.location
      ? campaignSlugFromPath(window.location.pathname)
      : null;
  const [objects, setObjects] = useState<BriefObject[]>(INITIAL_OBJECTS);
  const [journeys, setJourneys] = useState<Journey[]>(INITIAL_JOURNEYS);
  // Derived, never stored. Nothing can set a civic metric by hand.
  // My Activity starts empty. The two seeded relationships claimed the user
  // had "discovered" and "engaged with" specific objects they had never seen
  // -- a fabricated claim about the person using Brief, and one that pointed
  // at seed objects that no longer exist. Relationships are created by real
  // interaction from here on.

  const [posts] = useState<BriefPost[]>(INITIAL_POSTS);
  const [activeEdition, setActiveEdition] = useState<TeaEdition>(() =>
    getCurrentEdition()
  );

  const [activeTab, setActiveTab] = useState<Destination>(bootRoute.dest);
  const [homeFeedStatus, setHomeFeedStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [nearbySection, setNearbySection] = useState<NearbySection>(bootRoute.nearby);
  // The discovery experience navigation: Home, Events, Explore, Offers,
  // Places, News, Opportunities. Categories only appear when the real data
  // has meaningful rows for them.
  // --- Personal Brief ----------------------------------------------------
  // The personal layer is the same object store re-ranked per user: we keep
  // the server's ORDERED ids plus the per-row boost, and map them onto the
  // existing `objects` list — never a second object store on the client.
  const [personalFeedIds, setPersonalFeedIds] = useState<string[] | null>(null);
  const [personalBoostMap, setPersonalBoostMap] = useState<Record<string, { boost: number; reasons: string[] }>>({});
  // Onboarding is optional and never blocks: skipping just closes the card.
  const [personalBriefDismissed, setPersonalBriefDismissed] = useState(false);
  const [personalBusy, setPersonalBusy] = useState(false);
  const [personalPicks, setPersonalPicks] = useState<{ locations: string[]; types: string[]; topics: string[] }>({
    locations: [], types: [], topics: []
  });
  const [myLayerSection, setMyLayerSection] = useState<MyLayerSection>(bootRoute.mylayer);
  const [workflowSection, setWorkflowSection] = useState<WorkflowSection>(bootRoute.workflow);
  // Which bundle each desk is showing is DERIVED from the open section rather
  // than stored: a deep link, a URL change or a notification jump cannot then
  // disagree with the chips, and there is no second source of truth to sync.
  // 'queue' is the landing view: one list of everything waiting on you. A tool
  // is only one tap deeper, filed under the bundle it belongs to.
  const [workflowView, setWorkflowView] = useState<'queue' | 'screen'>(
    bootRoute.workflow !== 'active' ? 'screen' : 'queue'
  );
  const [menuOpen, setMenuOpen] = useState(false);

  // The offline queue drains itself the moment the browser says the signal is
  // back. Server-side idempotency keys make a double-flush harmless.
  React.useEffect(() => {
    const flush = () => { void briefApi.flushOfflineQueue(); };
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, []);
  const [adminOpen, setAdminOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<briefApi.AuthedUser | null>(null);

  // --- Onboarding & the service ladder ---------------------------------------
  // The ladder is DERIVED server-side from real rows; the client only holds
  // the answer and decides where it may be shown. Null means "not loaded",
  // which every ladder helper reads as "nothing is locked" — an outage must
  // never turn into a product that refuses to open.
  const [authProviders, setAuthProviders] = useState<briefApi.AuthProviders | null>(null);
  const [onboardingState, setOnboardingState] = useState<briefApi.OnboardingState | null>(null);
  const [firstRunOpen, setFirstRunOpen] = useState(false);
  const [nextStepHidden, setNextStepHidden] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const arrivalChannel: ArrivalChannel = React.useMemo(
    () =>
      typeof window === 'undefined'
        ? 'browser'
        : arrivalSource(window.location.href, window.navigator?.userAgent ?? ''),
    []
  );
  const ladder = onboardingState?.ladder ?? null;

  /** Report a step that leaves no server row of its own. Never blocks the UI. */
  const noteActivation = React.useCallback(
    (name: briefApi.ActivationEventName, meta: Record<string, unknown> = {}) => {
      void briefApi.recordActivation(name, meta).then((res) => {
        if (res.ok) {
          setOnboardingState((prev) => (prev ? { ...prev, ladder: res.data.ladder } : prev));
        }
      });
    },
    []
  );
  const [dockOn, setDockOn] = useState(true);
  const dockLastY = React.useRef(0);

  // --- Ingestion backend (real connectors) ---------------------------------
  // The client holds no tokens. It talks to the ingestion server, which owns
  // every secret. When the server is not running these panels degrade to an
  // explicit "not connected" state rather than pretending. The proxy prefix
  // lives in src/api/briefApi.ts, which is the only place that fetches.
  const [connectorStatus, setConnectorStatus] = useState<{
    online: boolean;
    checked: boolean;
    capabilities: Record<string, any> | null;
    liveSources: any[];
    stats: Record<string, any> | null;
  }>({ online: false, checked: false, capabilities: null, liveSources: [], stats: null });
  const [briefItText, setBriefItText] = useState('');
  const [briefItPreview, setBriefItPreview] = useState<any>(null);
  const [briefItBusy, setBriefItBusy] = useState(false);
  const [briefItSaved, setBriefItSaved] = useState<string | null>(null);

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

  // --- Objects from the server ----------------------------------------------
  // Brief holds no seeded objects. Everything discoverable arrives from the
  // ingestion pipeline, so this is the only way the stream gets populated.
  // A failure leaves the list empty and records why, rather than substituting
  // placeholder content.
  const [objectsLoad, setObjectsLoad] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    error: string | null;
  }>({ status: 'idle', error: null });

  // --- Session bootstrap -----------------------------------------------------
  // In production the development auth fallback is off and there is no login
  // screen, which made every write (capture, brief-it, confirm) return 401.
  // This silently provisions a real, persisted local account on first run so
  // the whole product is exercisable on the deployed site — a genuine account
  // with a real server session, not a fake. A returning device logs back in.
  /**
   * A device-only account.
   *
   * This used to run silently on every first boot, which meant the very first
   * thing Brief did for a new person was invent an anonymous identity they
   * could never move to another phone. It is now an explicit choice on the
   * first screen: "just look around on this device". Still a real server
   * account with a real session — just one with no email attached to it.
   */
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

  // What this deployment may honestly offer on the sign-in screen.
  React.useEffect(() => {
    void briefApi.getAuthProviders().then((res) => {
      if (res.ok) setAuthProviders(res.data);
    });
  }, []);

  // Onboarding state + ladder follow the session. Signed out, there is
  // nothing to load and nothing to lock.
  const refreshOnboarding = React.useCallback(async () => {
    if (!sessionUser) return;
    const res = await briefApi.getOnboarding();
    if (res.ok) setOnboardingState(res.data);
  }, [sessionUser]);

  React.useEffect(() => { void refreshOnboarding(); }, [refreshOnboarding]);

  // The ladder card renders on the Home stream, and its rungs are derived
  // server-side from REAL rows — a saved object, a confirmed one. Those rows
  // change while the app is open, so the ladder is re-read from the server
  // every time Home comes back into view. getLadder() is exactly that half:
  // the ladder alone, without dragging onboarding state along with it.
  React.useEffect(() => {
    if (!sessionUser) return;
    if (activeTab !== 'nearby') return;
    void briefApi.getLadder().then((res) => {
      if (res.ok) {
        setOnboardingState((prev) => (prev ? { ...prev, ladder: res.data } : prev));
      }
    });
  }, [sessionUser, activeTab]);

  // Seeing a populated feed is the moment Brief has shown its point. Recorded
  // once per session, and only when real rows actually arrived.
  const feedSeenRef = React.useRef(false);
  React.useEffect(() => {
    if (feedSeenRef.current) return;
    if (!sessionUser || homeFeedStatus !== 'ready') return;
    feedSeenRef.current = true;
    noteActivation('feed_seen', {});
  }, [sessionUser, homeFeedStatus, noteActivation]);

  // Attribute the visit to the link that produced it, once, when it was not
  // an ordinary browser.
  React.useEffect(() => {
    if (!sessionUser || arrivalChannel === 'browser') return;
    void briefApi.setOnboardingSource(arrivalChannel);
  }, [sessionUser, arrivalChannel]);

  // Open the first run only when there is a real reason to: no session, or a
  // session that has never answered the one question and never skipped it.
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

  // Mobile dock: hide while reading, pull the nub to bring the five tabs back.
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

  // --- Location & geo --------------------------------------------------------
  // A viewer's coarse position, for "what's around me". Set only by an
  // explicit device-location grant or a manual city tap — never inferred,
  // never fabricated. Null means "everywhere" (the global ranked feed).
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  // A named locality scope for the discovery feed (a city or district tap).
  // Null means the feed is geo- or globally scoped, never inferred.
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

  const chooseCity = React.useCallback((c: GeoPoint) => {
    setLocError(null);
    setUserLocation(c);
    // Named places scope the discovery feed by area (county/area matching),
    // which is far more precise for districts than a raw point + radius.
    setFeedArea(c.area ?? null);
    setSelectedLocation(c.label);
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

  // Personal Brief: interests, saves, controls and the personal re-ranking.
  // All private to the signed-in user; anonymous callers simply stay global.
  const loadPersonal = React.useCallback(async () => {
    if (!sessionUser) return;
    const [st, fd] = await Promise.all([
      briefApi.getPersonalState(),
      briefApi.getPersonalFeed({ limit: 60 })
    ]);
    if (st.ok) setPersonalState(st.data);
    if (fd.ok) {
      setPersonalFeedIds(fd.data.objects.map((o: any) => o.id));
      const map: Record<string, { boost: number; reasons: string[] }> = {};
      for (const o of fd.data.objects as any[]) {
        map[o.id] = o.personal ?? { boost: 0, reasons: [] };
      }
      setPersonalBoostMap(map);
    }
  }, [sessionUser]);

  React.useEffect(() => { void loadPersonal(); }, [loadPersonal]);

  // Seed server-persisted saves into the client relationship graph — the
  // durable copy, so saves survive across devices. Only ADDS missing edges;
  // the relationship graph stays the single live source for the UI.





  /** Unfollow an entity (venue/business/publisher/organizer/community). */

  /** Open an entity page from a chip or card link. */
  const openEntityPage = (id: string) => {
    setEntityPageId(id);
  };

  /** Open the public location discovery page (/explore/:name). */
  const openLocationPage = (name: string) => {
    setLocationName(name);
  };

  // An explicit relevance control, persisted. Tapping an active control
  // undoes it — the user can always change their mind.
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
    setPersonalState((p) => (p ? { ...p, relevance: res.data.relevance } : p));
    showToast(active ? 'Reverted.' : kind === 'more' ? 'More like this — saved.'
      : kind === 'less' ? 'Less like this — saved.'
        : kind === 'not_interested' ? 'Noted. Fewer of these.' : 'This source hidden for you.');
    void loadPersonal();
  };



  // Named runBriefItSave, not saveBriefIt: the latter is now the briefApi
  // binding, and shadowing it would be a trap for the next edit.
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

  // Both navs call this, so selecting a destination behaves identically on
  // desktop and mobile: you land on that destination's main section.
  // --- Destination activity alerts (the red dots on the sidebar titles) ------
  // Derived ONLY from real data: unread notifications (routed by kind) plus
  // public feed items / EPL rooms newer than the last time this viewer
  // opened that destination. First visit baselines silently; unreachable
  // services contribute zero. Never a decorative dot.
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

  const goToDestination = (id: Destination) => {
    setMenuOpen(false);
    // Opening a destination is the user SEEING it: baseline its freshness
    // clock and drop the dot immediately (notifications keep their own
    // unread state until read on the activity surface).
    writeLastSeen(id, Date.now());
    setDestinationAlerts((prev) => (prev[id] === 0 ? prev : { ...prev, [id]: 0 }));
    setCaptureOpen(false);
    setSelectedTeaSlug(null);
    setOpenCampaignId(null);
    setSelectedObjectForDetailRaw(null);
    setPendingObjectId(null);
    setActiveTab(id);
    if (id === 'nearby') setNearbySection('stream');
    if (id === 'mylayer') setMyLayerSection('saved');
    if (id === 'workflows') {
      setWorkflowSection('active');
      setWorkflowView('queue');
    }
    if (id === 'arena') setArenaSection('lobby');
  };
  const [selectedObjectType, setSelectedObjectType] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('Your area');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [architectMode, setArchitectMode] = useState<boolean>(false);
  // Seen tracking for the Daily Brief: "New" means genuinely not yet opened.
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  const [selectedObjectForDetail, setSelectedObjectForDetailRaw] = useState<BriefObject | null>(null);
  /** The object graph (related content) for the open detail modal. */
  const [detailGraph, setDetailGraph] = useState<briefApi.GraphEdge[] | null>(null);
  const [selectedTeaSlug, setSelectedTeaSlug] = useState<string | null>(bootRoute.teaSlug);
  const [pendingObjectId, setPendingObjectId] = useState<string | null>(bootRoute.objectId);
  /** The followable entity page (venue/business/publisher/organizer/community). */
  const [entityPageId, setEntityPageId] = useState<string | null>(bootRoute.entityId);
  /** The public location discovery page (/explore/:name). */
  const [locationName, setLocationName] = useState<string | null>(bootRoute.locationName);
  /** The Following surface overlay (feed + management). */
  const [followingOpen, setFollowingOpen] = useState(false);
  /** The personal Collections surface overlay. */
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  /** A shared collection page opened from /collections/:id. */
  const [collectionRouteId, setCollectionRouteId] = useState<string | null>(bootRoute.collectionId);
  /** "Add to collection" picker open inside the detail modal. */
  const [collectionPickerFor, setCollectionPickerFor] = useState<string | null>(null);

  // Opening an object marks it seen, which is what keeps the Daily Brief's
  // "New" section honest instead of showing the same items forever.
  const setSelectedObjectForDetail = (object: BriefObject | null) => {
    setSelectedObjectForDetailRaw(object);
    setPendingObjectId(object ? object.id : null);
    if (object) {
      setSeenIds((prev) => {
        if (prev.has(object.id)) return prev;
        const next = new Set(prev);
        next.add(object.id);
        return next;
      });
    }
  };
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // The spring-animated empty-state overlay ("Nothing to do here?"). Opened by
  // an explicit trigger so it never covers content unprompted; the physics is
  // the same springIntro curve the design system specifies.
  const [springOverlayOpen, setSpringOverlayOpen] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ==========================================================================
  // CAMPAIGNS (Creator Campaign Desk)
  //
  // A campaign is a distribution wrapper over an existing Brief object, so
  // this is a VIEW over the backend, not a second product. Everything shown
  // here -- counts, capacity, money -- arrives from the server on each load.
  // There is deliberately no local mutation of any metric: the only way a
  // number changes is a refetch. That is what keeps `82 / 100` honest.
  // ==========================================================================

  // Canonical public origin, from the server. Null until loaded, and null
  // when the deployment has not configured one -- in which case the UI says
  // so instead of inventing a URL from the current browser host.
  const [publicOrigin, setPublicOrigin] = useState<string | null>(null);
  const [runtimeCheck, setRuntimeCheck] = useState<'checking' | 'current' | 'old' | 'unavailable'>('checking');

  // A lightweight release handshake prevents an older API from looking like a
  // broken button later. Old deployments still return the original config, so
  // a missing contract version is a clear "update before testing" signal.
  useEffect(() => {
    let live = true;
    Promise.all([briefApi.getConfig(), briefApi.getRelease()]).then(([config, release]) => {
      if (!live) return;
      if (config.ok) setPublicOrigin(config.data.publicOrigin);
      if (release.ok) {
        setRuntimeCheck(release.data.apiContractVersion === briefApi.CLIENT_API_CONTRACT ? 'current' : 'old');
      } else {
        // A 200 config + missing release endpoint is an older server. If both
        // probes fail, this is connectivity rather than a version mismatch.
        setRuntimeCheck(config.ok ? 'old' : 'unavailable');
      }
    });
    return () => { live = false; };
  }, []);

  const {
    attachObjectToCampaign,
    beginEdit,
    campaignActionError,
    campaignBusy,
    campaignCircle,
    campaignDetail,
    campaignRegs,
    campaignState,
    confirmPayment,
    copyCampaignLink,
    createStep,
    draft,
    editDraft,
    handleRemoveCampaign,
    loadAttachableObjects,
    loadCampaigns,
    objectPicker,
    openCampaign,
    openCampaignId,
    postUpdate,
    publishDraft,
    publishedCampaign,
    saveCampaignEdit,
    setCampaignActionError,
    setCampaignBusy,
    setCampaignCircle,
    setCampaignDetail,
    setCampaignRegs,
    setCampaignState,
    setCreateStep,
    setDraft,
    setEditDraft,
    setObjectPicker,
    setOpenCampaignId,
    setPublishedCampaign,
    setRegStatus,
    setUpdateBody,
    setUpdateBusy,
    setUpdateNote,
    setUpdateTitle,
    shareCampaign,
    submitDraft,
    updateBody,
    updateBusy,
    updateNote,
    updateTitle,
  } = useCampaignHub({
    loadObjects,
    setObjects,
    publicOrigin,
    setPublicOrigin,
    showToast,
  });




  // Create flow. `preview` is a screen, not a stored object: nothing is sent
  // to the server between 'form' and the user pressing Publish.

  // Attachable existing objects. Loaded only when the creator asks, because
  // most campaigns are something new and the list is noise until it is wanted.


  // Editing an existing draft. Separate from `draft` (the create flow) so a
  // half-finished new campaign is never confused with an edit in progress.

  // The Circle a campaign is attached to, if any. Read separately because the
  // campaign row carries only `circleId`; the target's progress lives on the
  // Circle and is derived there from settled transactions.



  /**
   * Save an edit to a draft. Only the fields the server declares writable are
   * sent. Capacity is included only while the campaign is still a draft,
   * because the backend rejects it after publication.
   */
/**
   * Attach an existing Brief item to a campaign that already exists.
   *
   * The backend has supported this since Phase 7B (PATCH objectId, authorised
   * by the caller's existing access to the item's source) but nothing in the
   * UI reached it -- an item could only be linked at create time. Reuses the
   * same picker as the create flow; adds no new primitive and copies no
   * object data.
   */




  /** Share uses the platform sheet where it exists, clipboard otherwise. */



  /**
   * Publish goes through the real transition endpoint. If the server refuses
   * the transition the campaign stays a draft on screen: there is no local
   * `status = 'live'` anywhere in this file.
   */

  /**
   * The organiser confirms money actually arrived for a held spot.
   *
   * This does NOT set a registration status from the client. The server
   * creates a real transaction, settles it through the ordinary ledger state
   * machine, and promotes the registration off that settled row. The UI then
   * refetches rather than optimistically patching, so what is displayed is
   * always what the server derived.
   */

  // --- T3: the organiser authors updates the public page shows -------------




  // Card button. Uses the same resolver as the detail view so a given label
  // means the same thing in both places. Anything without a real destination
  // opens the detail view rather than dead-ending.

  // Primary action from INSIDE the detail view: retarget the stream at this
  // object's type. A navigation decision, never a simulated transaction.
  const handlePivotToType = (object: BriefObject) => {
    const others = objects.filter(
      (item) => item.type === object.type && item.id !== object.id
    ).length;

    setSelectedObjectType(object.type);
    setSearchQuery('');
    setActiveTab('nearby');
    setNearbySection('stream');
    setSelectedObjectForDetail(null);
    handleExecuteProtocolAction('discover', object, { silent: true });
    showToast(getPivotMessage(object, others));
  };

  const handleExecuteProtocolAction = (
    action: ProtocolAction,
    object: BriefObject,
    options?: { silent?: boolean }
  ) => {
    let nextState: FlowState = 'engaged';
    let verb = 'interacted_with';

    if (action === 'book' || action === 'contact' || action === 'buy') {
      nextState = 'committed';
      verb = action === 'book' ? 'booked' : action === 'buy' ? 'bought' : 'contacted';
    } else if (action === 'save') {
      nextState = 'engaged';
      verb = 'saved';
    }

    // The aha moment, reported once it has actually happened. "saved" is the
    // activation event Brief measures itself on; opening is the step before it.
    if (action === 'save') {
      noteActivation('object_saved', { objectId: object.id, type: object.type });
      // Durable copy: the same save, persisted server-side, so it survives
      // across devices. Best-effort — the local graph stays the live source.
      void briefApi.saveObjectForMe(object.id).then((r) => {
        if (r.ok) setPersonalState((p) => (p ? { ...p, saved: r.data.saved } : p));
      });
    }
    else if (action === 'discover' || action === 'read') noteActivation('object_opened', { objectId: object.id });

    setRelationships(prev => {
      const existingIdx = prev.findIndex(r => r.targetId === object.id);
      const newEdge: ObjectRelationship = {
        id: `rel_${Date.now()}`,
        sourceType: 'identity',
        sourceId: 'usr_me',
        verb,
        targetType: object.type,
        targetId: object.id,
        state: nextState,
        updatedAt: new Date().toISOString()
      };
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = newEdge;
        return updated;
      }
      return [...prev, newEdge];
    });

    const actionLabels: Record<ProtocolAction, string> = {
      discover: 'Opened',
      read: 'Opened',
      save: 'Saved',
      share: 'Shared',
      contact: 'Contact started',
      book: 'Booking',
      buy: 'Purchase',
      report: 'Reported',
      verify: 'Verification started',
      follow: 'Following',
    };

    // Callers that show their own message suppress this one.
    if (!options?.silent) {
      showToast(`${actionLabels[action]} "${object.title}".`);
    }
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
          (item) =>
            item.parentObjectId === object.id ||
            item.providerObjectId === object.id ||
            item.locationObjectId === object.id ||
            (item.relatedObjectIds ?? []).includes(object.id)
        )
        .map((item) => item.id)
    );

    const keywords = getKeywords(object);

    const scored: ScoredRelation[] = objects
      .filter((item) => item.id !== object.id)
      .map((item) => {
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
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    // Nothing scored: fall back to the physically closest objects so the
    // rail is never empty. Better a weak neighbour than a dead end.
    if (scored.length === 0) {
      return objects
        .filter((item) => item.id !== object.id)
        .map((item) => ({
          item,
          score: 0,
          reason: 'nearby' as RelationReason,
          distance: item.metadata?.distanceKm ?? Number.MAX_SAFE_INTEGER
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 4)
        .map(({ item, score, reason }) => ({ item, score, reason }));
    }

    return scored.slice(0, 4);
  };
  const {
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
  } = usePersonalLayer({
    getRelatedObjects,
    loadPersonal,
    objects,
    personalPicks,
    setPersonalBriefDismissed,
    setPersonalBusy,
    setPersonalPicks,
    showToast,
  });


  // Discovery ranking (destination rework 16). A destination happening today
  // with vendors in it outranks an old generic listing -- but this is time and
  // vendor density, never popularity. Only applied to the unfiltered browse:
  // once the user types a query, relevance wins.
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
    return [...list].sort((a, b) => weight(b) - weight(a));
  };

  const filteredObjects = useMemo(() => {
    const byType = objects.filter(
      (obj) => selectedObjectType === 'all' || obj.type === selectedObjectType
    );

    const query = searchQuery.trim().toLowerCase();
    if (query === '') return rankForDiscovery(byType);

    // Weighted match: exact title beats title prefix beats category/type,
    // which beat a summary-only hit. Ties fall back to proximity.
    // Uses the same scorer as pursuit matching -- one brain, so a phrase
    // ranks identically whether typed here or saved as a Pursuit.
    return byType
      .map((obj) => ({ obj, score: scoreObjectForPhrase(obj, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const da = a.obj.metadata?.distanceKm ?? Number.MAX_SAFE_INTEGER;
        const db = b.obj.metadata?.distanceKm ?? Number.MAX_SAFE_INTEGER;
        return da - db;
      })
      .map(({ obj }) => obj);
  }, [objects, selectedObjectType, searchQuery]);

  // STEP 4 My Layer: saved objects grouped by type, derived from the existing
  // relationships state. No parallel data structure.


  // One graph instance over the live state. Components ask it questions
  // instead of re-deriving relationship rules inline.
  const graph = useMemo(
    () => createBriefGraph(objects, relationships),
    [objects, relationships]
  );


  // Watch (prompt 21): records intent to monitor. No polling, no fake alerts --
  // diffObjects is the engine this will drive once ingestion supplies a second
  // version of a record.
  // --- §8 verify / report: the crowd-checking half of object trust ----------
  // "I was there" (confirm) and "this is wrong" (report) had server routes
  // and no buttons. Both hit the real endpoints; both show the server's own
  // answer or refusal.
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

    setRelationships((prev) => {
      if (isWatching) {
        return prev.filter(
          (r) => !(r.targetId === object.id && r.verb === 'watched')
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

  // Optional personal label on an existing saved edge (prompt 10).

  // Share (prompt 11): a plain, honest text payload. Web Share when the
  // browser offers it, clipboard otherwise. No invented links, no marketing.
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

  // --- Pursuits --------------------------------------------------------------
  // Standing intents. Matching is recomputed from live objects rather than
  // stored, so a pursuit created before an object was ingested picks it up the
  // moment that object exists.
  const [pursuits, setPursuits] = useState<Pursuit[]>([]);

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

  const handleCreatePursuit = (rawQuery: string) => {
    const query = rawQuery.trim();
    if (query === '') return;

    const existing = pursuits.find(
      (p) => p.query.toLowerCase() === query.toLowerCase()
    );
    if (existing) {
      setActiveTab('nearby');
      setNearbySection('pursuits');
      showToast('Already pursuing this');
      return;
    }

    const pursuit = createPursuit(query, new Date().toISOString());
    setPursuits((prev) => [pursuit, ...prev]);
    // Handing a query to Brief means you are done typing it. Leaving it in the
    // search box would strand the stream on an empty result set.
    setSearchQuery('');
    setActiveTab('nearby');
    setNearbySection('pursuits');
    showToast(
      pursuit.watchChanges
        ? `Watching: ${pursuit.query}`
        : `Pursuing: ${pursuit.query}`
    );
  };





  // --- Ingestion review state ------------------------------------------------
  // Candidates are parsed on demand and held here. They are NOT objects: until
  // a reviewer accepts one, nothing reaches the graph, search, or My Layer.
  const {
    candidates,
    handleAcceptCandidate,
    handleReceiveInbound,
    handleRejectCandidate,
    inboundBusy,
    reviewed,
    setCandidates,
    setInboundBusy,
    setReviewed,
  } = useIngestionDesk({
    objects,
    setObjects,
    showToast,
    connectorStatus,
  });


  // Pulls the real inbound queue: messages as they actually arrived from
  // connected sources. Brief ships with no sample traffic, so on a system with
  // nothing connected this correctly finds nothing -- "no new messages" is a
  // true report about an empty queue, not a UI that failed to load.


  // Accepting is the ONLY path from message to object, and it is manual.


  // --- Group intelligence layer ----------------------------------------------
  // Access state is live: revoking a group must immediately remove it and its
  // information, which is why groups are state rather than a constant.
  const [groups, setGroups] = useState<ConnectedSource[]>(ALL_GROUPS);
  // --- Connected sources ----------------------------------------------------
  // The groups Brief may read. Derived from the server's source rows: a
  // source with a granted membership is one the user is in, anything else is
  // only readable if it is public. Access is never assumed.
  React.useEffect(() => {
    if (!connectorStatus.online) return;
    setGroups(
      connectorStatus.liveSources
        .filter((src: any) =>
          src?.platform === 'telegram' || src?.platform === 'whatsapp')
        .map((src: any): ConnectedSource => ({
          id: src.id,
          name: src.name,
          platform: src.platform === 'telegram' ? 'telegram' : 'whatsapp',
          description: src.description ?? undefined,
          // A membership row is the only thing that proves access. Without
          // one, a private group is not readable and says so.
          access:
            src.membership?.accessGranted
              ? 'member'
              : src.accessType === 'public'
              ? 'authorised'
              : 'pending',
          // Author retention is the group's decision. The server does not
          // model it yet, so Brief assumes the privacy-preserving answer.
          retainAuthors: false,
          lastActivityAt: src.lastMessageAt ?? undefined
        }))
    );
  }, [connectorStatus.online, connectorStatus.liveSources]);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  // The ONLY list any part of the UI may iterate. Everything else is invisible.
  const visibleGroups = useMemo(
    () => groups.filter(canUserAccessGroup),
    [groups]
  );

  // Indexes are built per accessible group. An inaccessible group yields an
  // empty index by construction, so there is nothing to leak.
  const groupIndexes = useMemo(() => {
    const map: Record<string, GroupKnowledgeEntry[]> = {};
    for (const group of visibleGroups) {
      map[group.id] = buildGroupIndex(GROUP_MESSAGES, group);
    }
    return map;
  }, [visibleGroups]);

  const openGroup = useMemo(
    () => visibleGroups.find((g) => g.id === openGroupId) ?? null,
    [visibleGroups, openGroupId]
  );

  const groupIndex = useMemo(
    () => (openGroup ? groupIndexes[openGroup.id] ?? [] : []),
    [openGroup, groupIndexes]
  );



  // Saving keeps the group record intact and points back at it. Brief does not
  // claim authorship of anything a member wrote.


  // --- Participation ---------------------------------------------------------
  const [quests, setQuests] = useState<Quest[]>(INITIAL_QUESTS);
  const [discoveryTab, setDiscoveryTab] = useState<
    'home' | 'events' | 'explore' | 'offers' | 'places' | 'news' | 'opportunities'
  >('home');
  const [moreFilters, setMoreFilters] = useState<boolean>(false);
  const [pursuitDraft, setPursuitDraft] = useState<string>('');
  const [feedReload, setFeedReload] = useState(0);
  const [boardMode, setBoardMode] = useState<'contributors' | 'earners'>('contributors');

  const [rewards, setRewards] = useState<Reward[]>(REWARD_CATALOGUE);


  // The wallet is derived from settled quests only. Submitted work is visible
  // but deliberately worth nothing until reviewed.
  const myContribution = useMemo(() => summariseContribution(quests), [quests]);
  const nextRank = useMemo(() => getNextRankRequirement(myContribution), [myContribution]);

  const handleSubmitQuest = (quest: Quest) => {
    setQuests((prev) =>
      prev.map((q) =>
        q.id === quest.id
          ? { ...q, status: 'submitted' as QuestStatus, submittedAt: new Date().toISOString() }
          : q
      )
    );
    // Deliberately does NOT say "you earned N points".
    showToast('Submitted for review. Points settle only if accepted.');
  };

  const handleRedeem = (reward: Reward) => {
    const gate = canRedeem(reward, {
      settledPoints: myContribution.settledPoints,
      region: 'Nairobi'
    });
    if (!gate.allowed) {
      showToast(gate.reason);
      return;
    }
    setRewards((prev) =>
      prev.map((r) => (r.id === reward.id ? { ...r, remaining: r.remaining - 1 } : r))
    );
    showToast(`Claimed. ${reward.providerName} will honour this reward.`);
  };

  // --- Arena -----------------------------------------------------------------
  // Who the viewer is in Arena. My-layer's match views use the same id.
  const {
    arenaActivity,
    arenaBetaBusy,
    arenaBetaSummary,
    arenaBusyId,
    arenaMoney,
    arenaPlayers,
    arenaVenues,
    groupArenaSignals,
    handleAbandonMatch,
    handleConfirmMatch,
    handleJoinArenaBeta,
    handleReportMatch,
    mapServerMatch,
    matches,
    refreshArenaBeta,
    refreshArenaMatches,
    setArenaActivity,
    setArenaBetaBusy,
    setArenaBetaSummary,
    setArenaBusyId,
    setArenaMoney,
    setArenaPlayers,
    setArenaVenues,
    setMatches,
  } = useArenaData({
    groupIndexes,
    sessionUser,
    showToast,
    visibleGroups,
  });

  // The secondary game screen. null = closed; set to a game id to open the
  // match-setup surface behind a shelf tile.

  // Challenges come from the SERVER, not a fixture: a challenge is a real,
  // persisted, attributable record. `ARENA_CHALLENGES` is gone from the state.

  // Whether real-money contests are legally available HERE. Fetched from the
  // server rather than hardcoded, because the answer depends on licensing and
  // connected payment rails, not on what the UI would like to show.
  useEffect(() => {
    briefApi.getArenaMoneyStatus().then((r) => {
      if (r.ok) setArenaMoney(r.data);
    });
  }, []);

  // The eFootball beta is the first controlled Arena test. Its counters are
  // aggregate server projections; a missing response stays visibly unavailable
  // rather than becoming a fabricated zero-population claim.
  useEffect(() => { void refreshArenaBeta(); }, [refreshArenaBeta, sessionUser]);




  useEffect(() => { void refreshArenaMatches(); }, [refreshArenaMatches]);

  // Availability is the user's own switch. Defaults to the seeded record and
  // is never flipped on by Brief.
  // Arena entities come from the SERVER — real persisted rows, never a
  // fixture. The fabricated client-side economy (points ledger, gift cards,
  // fake availability/reliability, account listings, venue check-ins) is gone.

  React.useEffect(() => {
    let live = true;
    (async () => {
      const [p, v, g, rooms] = await Promise.all([
        briefApi.getArenaPlayers(),
        briefApi.getArenaVenues(),
        briefApi.getArenaGames(),
        briefApi.getLobbyRooms()
      ]);
      if (!live) return;
      if (p.ok) setArenaPlayers(p.data as any[]);
      if (v.ok) setArenaVenues(v.data as any[]);
      const counts: Record<string, number> = {};
      const bump = (key: string, n = 1) => {
        const client = SERVER_TO_CLIENT_GAME[key] ?? key;
        counts[client] = (counts[client] ?? 0) + n;
      };
      if (g.ok) {
        for (const [k, val] of Object.entries(g.data.activity ?? {})) {
          if (typeof val !== 'number' || val < 0) continue;
          const client = SERVER_TO_CLIENT_GAME[k] ?? k;
          counts[client] = Math.max(counts[client] ?? 0, val);
        }
      }
      if (rooms.ok) {
        for (const r of rooms.data as any[]) {
          if (!r?.gameId) continue;
          if (r.status === 'started' || r.status === 'closed') continue;
          bump(String(r.gameId), 1);
        }
      }
      setArenaActivity(counts);
    })();
    return () => { live = false; };
  }, []);


  const [arenaSection, setArenaSection] = useState<
    'lobby' | 'epl' | 'challenges' | 'tournaments' | 'leaderboard'
  >(bootRoute.arena);

  // Challenges addressed to this user, awaiting a decision.
  // Gaming activity detected in groups the user is ALREADY a member of.
  // Runs over the access-checked indexes, so an inaccessible group can never
  // contribute a signal.
  // Workflows secondary is derived from real Journey data, not a new store.






  // Abandon: the honest exit for a match that never happened. The server
  // decides who may abandon (and when); a refusal says why.

  // Venues that actually host the selected game, nearest first.
  // Live activity per game: open challenges plus players checked in at a
  // venue. Drives the count on each game chip, so the selector is dynamic.
  const [savedGroupEntryIds, setSavedGroupEntryIds] = useState<string[]>([]);


  // --- Sources ---------------------------------------------------------------
  const [sources, setSources] = useState<Source[]>(INITIAL_SOURCES);

  // --- Capture ---------------------------------------------------------------
  // Pasted text runs through the ingestion parser, then waits for confirmation
  // exactly like anything else. Capture is a doorway, not a shortcut.
  const {
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
  } = useCaptureFlow({
    loadObjects,
    objects,
    refreshConnectors,
    setObjects,
    showToast,
  });








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

  // The discovery-experience Daily Brief: TODAY / NEAR YOU / NOW / COMING UP
  // from real persisted rows. Only rendered when it has data.

  // --- Personal Brief derivations -----------------------------------------
  // The personal order is the server's re-ranking of the SAME objects — the
  // ids are mapped onto `objects`, never duplicated into a second store.

  const personalInterests = personalState?.interests ?? { locations: [], types: [], topics: [] };
  const personalHasInterests = personalInterests.locations.length > 0 || personalInterests.types.length > 0 || personalInterests.topics.length > 0;


  // Types that really exist in the loaded data — the onboarding chips are
  // never a hard-coded taxonomy, only what the objects themselves say.

  // The Personal Brief Saved surface: Upcoming / Active / News / Places /
  // Offers from the existing saved relationship graph. Expired or past rows
  // read as expired — they are never disguised as active.
  const personalSavedGroups = useMemo(() => {
    const nowMs = Date.now();
    const groups: { key: string; title: string; items: BriefObject[]; expired: BriefObject[] }[] = [
      { key: 'upcoming', title: 'Upcoming', items: [], expired: [] },
      { key: 'active', title: 'Active', items: [], expired: [] },
      { key: 'news', title: 'News', items: [], expired: [] },
      { key: 'places', title: 'Places', items: [], expired: [] },
      { key: 'offers', title: 'Offers', items: [], expired: [] }
    ];
    for (const o of savedObjects) {
      const t = o.temporal;
      const status = t?.status ?? '';
      const startsAt = t?.startsAt ? Date.parse(t.startsAt) : NaN;
      const deadlineAt = t?.deadlineAt ? Date.parse(t.deadlineAt) : NaN;
      const isEvent = o.type === 'experience' || o.type === 'event';
      const expired = status === 'expired' || status === 'past'
        || (Number.isFinite(deadlineAt) && deadlineAt < nowMs)
        || (isEvent && Number.isFinite(startsAt) && startsAt < nowMs);
      let group: { key: string; title: string; items: BriefObject[]; expired: BriefObject[] };
      if (isEvent) group = groups[0];                       // Upcoming
      else if (o.type === 'news' || o.type === 'announcement' || o.type === 'alert') group = groups[2]; // News
      else if (o.type === 'place' || o.type === 'business') group = groups[3];   // Places
      else if (o.type === 'offer') group = groups[4];       // Offers
      else group = groups[1];                               // Active (opportunities, services, ...)
      if (expired) group.expired.push(o); else group.items.push(o);
    }
    return groups.filter((g) => g.items.length > 0 || g.expired.length > 0);
  }, [savedObjects]);



  // Computed once per render instead of on every call site in the modal.
  const relatedObjects = selectedObjectForDetail
    ? getRelatedObjects(selectedObjectForDetail)
    : [];


  // Newest first, promoted posts kept inline rather than pinned to the top --
  // paid distribution earns a slot in the feed, not the whole masthead.
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
    const subject = objects.find((item) => item.id === post.relatedObjectId);
    if (subject) {
      setSelectedObjectForDetail(subject);
    }
  };

  const toggleLike = (post: BriefPost) => {
    setLikedPostIds((prev) =>
      prev.includes(post.id)
        ? prev.filter((id) => id !== post.id)
        : [...prev, post.id]
    );
  };

  const handleMenuSelect = (target: MenuTarget) => {
    setMenuOpen(false);
    // The operator desk is not a consumer destination and is not ladder-gated:
    // authority is the session's capabilities, checked again per call.
    if (target.tab === 'operate') {
      setAdminOpen(true);
      return;
    }
    // The ladder shapes what is OFFERED, never what is permitted: authority
    // still lives on the server. A surface whose rung has not been climbed
    // says which step opens it and points at that step instead of dropping
    // someone into a desk they have nothing to put on yet.
    //
    // Saved (Your Layer) and Actions (Workflows) are exempt by design — see
    // showsLadder(). Those two index screens list what exists; they are not a
    // shop window and never carry lock chrome.
    const section = 'section' in target ? target.section ?? null : null;
    if (!isSurfaceUnlocked(ladder, target.tab, section)) {
      const hint = unlockHint(ladder, target.tab, section);
      noteActivation('service_locked_tapped', { tab: target.tab, section, requires: hint });
      showToast(hint ? `Opens after: ${hint}` : 'Not open yet');
      setNextStepHidden(false);
      setCaptureOpen(false);
      setActiveTab('nearby');
      setNearbySection('stream');
      return;
    }
    if (target.tab === 'capture') {
      setCaptureOpen(true);
      return;
    }
    setCaptureOpen(false);
    setSelectedTeaSlug(null);
    setActiveTab(target.tab);
    if (target.tab === 'nearby') setNearbySection(target.section ?? 'stream');
    if (target.tab === 'mylayer') setMyLayerSection(target.section ?? 'saved');
    if (target.tab === 'workflows') {
      setWorkflowSection(target.section ?? 'cockpit');
      setWorkflowView(target.section ? 'screen' : 'queue');
    }
    if (target.tab === 'arena') setArenaSection(target.section ?? 'lobby');
  };

  const skipUrl = useRef(false);

  const currentRoute = useCallback((): BriefRoute => ({
    dest: activeTab,
    nearby: nearbySection,
    mylayer: myLayerSection,
    workflow: workflowSection,
    arena: arenaSection,
    objectId: selectedObjectForDetail?.id ?? pendingObjectId,
    teaSlug: selectedTeaSlug,
    campaignId: openCampaignId,
    entityId: entityPageId,
    locationName,
    collectionId: collectionRouteId,
    capture: captureOpen,
    menu: menuOpen,
    admin: adminOpen,
    landed: false
  }), [
    activeTab, nearbySection, myLayerSection, workflowSection, arenaSection,
    selectedObjectForDetail, pendingObjectId, selectedTeaSlug, openCampaignId,
    entityPageId, locationName, collectionRouteId, captureOpen, menuOpen, adminOpen
  ]);

  const writeUrl = useCallback((route: BriefRoute, mode: 'push' | 'replace') => {
    if (typeof window === 'undefined' || !window.history) return;
    const url = toPath(route);
    if (mode === 'push') window.history.pushState(route, '', url);
    else window.history.replaceState(route, '', url);
  }, []);

  const applyRoute = useCallback((route: BriefRoute) => {
    skipUrl.current = true;
    setActiveTab(route.dest);
    setNearbySection(route.nearby);
    setMyLayerSection(route.mylayer);
    setWorkflowSection(route.workflow);
    setWorkflowView(route.dest === 'workflows' && route.workflow !== 'active' ? 'screen' : 'queue');
    setArenaSection(route.arena);
    setMenuOpen(route.menu);
    setAdminOpen(route.admin);
    setCaptureOpen(route.capture);
    setSelectedTeaSlug(route.teaSlug);
    setOpenCampaignId(route.campaignId);
    setEntityPageId(route.entityId);
    setLocationName(route.locationName);
    setCollectionRouteId(route.collectionId);
    if (route.objectId) setPendingObjectId(route.objectId);
    else {
      setPendingObjectId(null);
      setSelectedObjectForDetailRaw(null);
    }
  }, []);

  const dismissOverlay = useCallback(() => {
    const st = typeof window !== 'undefined' ? window.history.state : null;
    const overlayState = isBriefRoute(st) && (st.menu || st.capture || st.admin || st.objectId || st.teaSlug || st.campaignId || st.entityId || st.locationName || st.collectionId);
    if (overlayState && !st.landed && typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
      return;
    }
    skipUrl.current = true;
    setMenuOpen(false);
    setAdminOpen(false);
    setCaptureOpen(false);
    setSelectedTeaSlug(null);
    setOpenCampaignId(null);
    setPendingObjectId(null);
    setSelectedObjectForDetailRaw(null);
    setEntityPageId(null);
    setLocationName(null);
    setCollectionRouteId(null);
    setCollectionPickerFor(null);
    writeUrl({ ...currentRoute(), menu: false, admin: false, capture: false, objectId: null, teaSlug: null, campaignId: null, entityId: null, locationName: null, collectionId: null }, 'replace');
  }, [currentRoute, writeUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    writeUrl({ ...bootRoute, landed: true }, 'replace');
    const onPop = (event: PopStateEvent) => {
      const route = isBriefRoute(event.state)
        ? event.state
        : parsePath(window.location.pathname, window.location.search);
      applyRoute(route);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [applyRoute, writeUrl]);

  useEffect(() => {
    if (skipUrl.current) {
      skipUrl.current = false;
      return;
    }
    const overlay = menuOpen || adminOpen || captureOpen || Boolean(selectedTeaSlug) || Boolean(openCampaignId) || Boolean(selectedObjectForDetail) || Boolean(pendingObjectId) || Boolean(entityPageId) || Boolean(locationName) || Boolean(collectionRouteId) || followingOpen || collectionsOpen;
    writeUrl(currentRoute(), overlay ? 'push' : 'replace');
  }, [
    activeTab, nearbySection, myLayerSection, workflowSection, arenaSection,
    menuOpen, adminOpen, captureOpen, selectedTeaSlug, openCampaignId,
    selectedObjectForDetail, pendingObjectId, entityPageId, locationName, collectionRouteId,
    followingOpen, collectionsOpen,
    currentRoute, writeUrl
  ]);

  useEffect(() => {
    const tg = (typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null);
    if (!tg?.BackButton) return;
    const show = menuOpen || captureOpen || Boolean(selectedTeaSlug) || Boolean(openCampaignId) || Boolean(selectedObjectForDetail) || Boolean(entityPageId) || Boolean(locationName) || Boolean(collectionRouteId) || followingOpen || collectionsOpen;
    try {
      if (show) tg.BackButton.show();
      else tg.BackButton.hide();
    } catch { /* Mini App host without BackButton */ }
    const handler = () => dismissOverlay();
    try { tg.BackButton.onClick(handler); } catch { /* */ }
    return () => {
      try { tg.BackButton.offClick?.(handler); } catch { /* */ }
    };
  }, [menuOpen, captureOpen, selectedTeaSlug, openCampaignId, selectedObjectForDetail, entityPageId, locationName, collectionRouteId, followingOpen, collectionsOpen, dismissOverlay]);

  useEffect(() => {
    if (!pendingObjectId) return;
    const hit = objects.find((o) => o.id === pendingObjectId);
    if (hit) {
      if (selectedObjectForDetail?.id !== hit.id) setSelectedObjectForDetailRaw(hit);
      return;
    }
    let live = true;
    briefApi.getObject(pendingObjectId).then((res) => {
      if (!live || !res.ok) return;
      setSelectedObjectForDetailRaw(objectFromServer(res.data));
    });
    return () => { live = false; };
  }, [pendingObjectId, objects, selectedObjectForDetail]);

  // The LOCAL ACTIVITY GRAPH for the open detail modal: related content from
  // real relationships only (the server never keyword-matches). Cleared when
  // the modal closes so stale edges never linger on the next object.
  useEffect(() => {
    if (!selectedObjectForDetail?.id) { setDetailGraph(null); return; }
    let live = true;
    briefApi.getObjectGraph(selectedObjectForDetail.id).then((res) => {
      if (live) setDetailGraph(res.ok ? res.data.edges : []);
    });
    return () => { live = false; };
  }, [selectedObjectForDetail?.id]);

  const isAnyModalActive = Boolean(openCampaignId) || createStep !== 'closed' || captureOpen || Boolean(selectedObjectForDetail) || Boolean(selectedTeaSlug) || Boolean(entityPageId) || Boolean(locationName) || Boolean(collectionRouteId) || followingOpen || collectionsOpen;

  // THE APP GATE (product decision 2026-08-29): NO ACCESS WITHOUT AN ACCOUNT.
  // Signed out, the app does not render at all -- no feed, no shelf, no
  // navigation, nothing in the DOM to leak. The sign-in flow IS the screen.
  // The server enforces the same rule on every data route (401
  // account_required); this is the client half.
  if (sessionChecked && !sessionUser) {
    return (
      <div className="min-h-screen bg-[#D8D2E1] text-[#251045]">
        <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
          <div className="w-full max-w-sm text-center">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#251045]/50">Brief · Nairobi</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight mt-2">
              An account opens everything
            </h1>
            <p className="mt-3 text-[12px] leading-relaxed text-[#251045]/70">
              Brief is members-only: the live feed, the Tea studio, EPL fantasy rooms,
              the marketplace and every tool behind this wall need an account.
            </p>
            <ul className="mt-4 space-y-1.5 text-left mx-auto w-fit">
              {[
                'Write and publish your own stories',
                'Open and seat EPL fantasy rooms',
                'Sell, campaign and run groups',
                'Sign in with Google, email link, or your Brief handle'
              ].map((line) => (
                <li key={line} className="flex items-start gap-2 text-[11px] leading-snug text-[#251045]/80">
                  <span aria-hidden="true" className="mt-[3px] h-1.5 w-1.5 rounded-full bg-[#5B2EA6] shrink-0" />
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[10px] leading-relaxed text-[#251045]/50">
              No real money moves on Brief yet (no payment provider connected), and
              Google sign-in activates once this deployment registers its Google
              credentials. Your Brief account — the primary registry — works today.
            </p>
          </div>
        </div>
        <Onboarding
          open
          providers={authProviders}
          state={onboardingState}
          user={sessionUser}
          channel={arrivalChannel}
          placeLabel={userLocation?.label ?? null}
          onSignedIn={(user) => {
            setSessionUser(user);
            void refreshOnboarding();
          }}
          onGuest={provisionGuest}
          onStateChange={setOnboardingState}
          onUseLocation={locate}
          onChooseCity={(city) => chooseCity(city)}
          onDone={() => {
            setFirstRunOpen(false);
            setActiveTab('nearby');
            setNearbySection('stream');
            void refreshOnboarding();
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#D8D2E1] text-[#251045] flex flex-col font-sans selection:bg-[#5B2EA6] selection:text-[#FFFFFF]">

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#5B2EA6] text-[#FFFFFF] px-4 py-2.5 rounded-xl font-extrabold shadow-2xl flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span className="text-xs">{toastMessage}</span>
        </div>
      )}

      {/* Spring-animated empty-state overlay */}
      {springOverlayOpen && (
        <>
          <div
            onClick={() => setSpringOverlayOpen(false)}
            className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[8px] transition-opacity"
          />
          <div className="brief-spring-modal fixed top-1/2 left-1/2 z-[70] w-[calc(100%-48px)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#6C3EC9]/25 bg-[#FBFAFD]/90 px-6 py-8 text-center shadow-2xl">
            <div className="text-4xl mb-4">⏳</div>
            <h3 className="text-xl font-bold mb-2">Nothing to do here?</h3>
            <p className="text-sm text-[#251045]/60 leading-relaxed mb-6">
              The current timeline is looking ultra quiet. Let's look into a
              different zone.
            </p>
            <button
              onClick={() => setSpringOverlayOpen(false)}
              className="w-full py-4 rounded-lg bg-[#FBFAFD] border border-[#6C3EC9]/30 text-[#251045] text-[15px] font-bold flex items-center justify-center gap-2 cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 hover:border-[#6C3EC9]/70 active:translate-y-0.5 active:scale-[0.96] active:border-white"
            >
              🗓️ Check a Different Time
            </button>
          </div>
        </>
      )}

      {/* Roofless: no top bar. The page opens onto the sky. Menu, capture
          and place live on the dock / shelf, not as a lid over the house. */}
      <div className="flex-1 flex w-full">

        {/* DESKTOP / TABLET RAIL. Full height now the header is gone. */}
        <nav
          aria-label="Primary"
          className="hidden md:flex flex-col shrink-0 w-[76px] hover:w-60 transition-all duration-200 border-r border-[#D6CFE4] bg-[#FBFAFD] sticky top-0 h-screen py-4 group/rail overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            title="Menu"
            aria-expanded={menuOpen}
            className={`relative flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
              menuOpen ? 'text-[#251045] bg-[#FBFAFD] font-extrabold' : 'text-[#251045] hover:text-[#251045]'
            }`}
          >
            <span
              className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r transition-all ${
                menuOpen ? 'h-7 bg-[#5B2EA6]' : 'h-0 bg-transparent'
              }`}
            />
            <Menu className="w-5 h-5 shrink-0" />
            <span className="min-w-0 opacity-0 group-hover/rail:opacity-100 transition-opacity">
              <span className="block text-[13px] font-extrabold whitespace-nowrap">Menu</span>
            </span>
          </button>
          {DESTINATIONS.map((d) => {
            const active = activeTab === d.id;
            const Icon = DESTINATION_ICONS[d.id];
            return (
              <button
                key={d.id}
                onClick={() => goToDestination(d.id)}
                title={d.label}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
                  active
                    ? 'text-[#251045] bg-[#FBFAFD] font-extrabold'
                    : 'text-[#251045] hover:text-[#251045]'
                }`}
              >
                {/* Active marker on the edge, not a heavy filled pill. */}
                <span
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r transition-all ${
                    active ? 'h-7 bg-[#5B2EA6]' : 'h-0 bg-transparent'
                  }`}
                />
                <span className="relative shrink-0">
                  <Icon className="w-5 h-5" />
                  <span className="absolute -right-1.5 -top-1.5">
                    <ActivityDot n={destinationAlerts[d.id] ?? 0} />
                  </span>
                </span>
                <span className="min-w-0 opacity-0 group-hover/rail:opacity-100 transition-opacity">
                  <span className="block text-[13px] font-extrabold whitespace-nowrap">
                    {d.label}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Main Stream. pb-24 on mobile clears the bottom bar. */}
        <main className="flex-1 min-w-0 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-6">

        {/* Main Content */}
        {/* Sub-navigation. Sections live INSIDE a destination, so the top
            bar stays five doors wide no matter how much is built. */}
        {activeTab === 'mylayer' && (
          <MyLayerScreen
            activeTab={activeTab}
            arenaBusyId={arenaBusyId}
            beginEdit={beginEdit}
            campaignBusy={campaignBusy}
            campaignState={campaignState}
            draft={draft}
            graph={graph}
            groupIndex={groupIndex}
            groupIndexes={groupIndexes}
            groups={groups}
            handleAbandonMatch={handleAbandonMatch}
            handleConfirmMatch={handleConfirmMatch}
            handleCreatePursuit={handleCreatePursuit}
            handleExecuteProtocolAction={handleExecuteProtocolAction}
            handleRemoveCampaign={handleRemoveCampaign}
            handleReportMatch={handleReportMatch}
            loadCampaigns={loadCampaigns}
            matches={matches}
            myContribution={myContribution}
            myLayerSection={myLayerSection}
            objects={objects}
            openCampaign={openCampaign}
            openGroup={openGroup}
            relationships={relationships}
            savedObjects={savedObjects}
            setActiveTab={setActiveTab}
            setCampaignActionError={setCampaignActionError}
            setCampaignBusy={setCampaignBusy}
            setCreateStep={setCreateStep}
            setDraft={setDraft}
            setMyLayerSection={setMyLayerSection}
            setObjectPicker={setObjectPicker}
            setOpenGroupId={setOpenGroupId}
            setPublishedCampaign={setPublishedCampaign}
            setSelectedObjectForDetail={setSelectedObjectForDetail}
            setWorkflowSection={setWorkflowSection}
            setWorkflowView={setWorkflowView}
            shareCampaign={shareCampaign}
            showToast={showToast}
            visibleGroups={visibleGroups}
            openGroupId={openGroupId}
            quests={quests}
            sessionUser={sessionUser}
            setGroups={setGroups}
            setPersonalState={setPersonalState}
            setRelationships={setRelationships}
            setSavedGroupEntryIds={setSavedGroupEntryIds}
          />
        )}



        {activeTab === 'nearby' && (
          <NearbyScreen
            posts={posts}
            activeEdition={activeEdition}
            activeTab={activeTab}
            arenaActivity={arenaActivity}
            chooseCity={chooseCity}
            dailyBrief={dailyBrief}
            editionPosts={editionPosts}
            feedArea={feedArea}
            filteredObjects={filteredObjects}
            followOne={followOne}
            handleCreatePursuit={handleCreatePursuit}
            handleExecuteProtocolAction={handleExecuteProtocolAction}
            handleMenuSelect={handleMenuSelect}
            handleSubmitQuest={handleSubmitQuest}
            homeFeedStatus={homeFeedStatus}
            ladder={ladder}
            likedPostIds={likedPostIds}
            locError={locError}
            locate={locate}
            locating={locating}
            matches={matches}
            nearbySection={nearbySection}
            nextStepHidden={nextStepHidden}
            noteActivation={noteActivation}
            objects={objects}
            openEntityPage={openEntityPage}
            openPostSubject={openPostSubject}
            personalBriefDismissed={personalBriefDismissed}
            personalBusy={personalBusy}
            personalHasInterests={personalHasInterests}
            personalInterests={personalInterests}
            personalPicks={personalPicks}
            personalSavedGroups={personalSavedGroups}
            personalState={personalState}
            pursuitResults={pursuitResults}
            pursuits={pursuits}
            quests={quests}
            runtimeCheck={runtimeCheck}
            savePersonalBrief={savePersonalBrief}
            searchQuery={searchQuery}
            selectedLocation={selectedLocation}
            selectedObjectType={selectedObjectType}
            sessionUser={sessionUser}
            setActiveEdition={setActiveEdition}
            setActiveTab={setActiveTab}
            setArenaSection={setArenaSection}
            setCaptureOpen={setCaptureOpen}
            setCollectionsOpen={setCollectionsOpen}
            setFirstRunOpen={setFirstRunOpen}
            setFollowingOpen={setFollowingOpen}
            setHomeFeedStatus={setHomeFeedStatus}
            setNearbySection={setNearbySection}
            setNextStepHidden={setNextStepHidden}
            setPersonalBriefDismissed={setPersonalBriefDismissed}
            setSearchQuery={setSearchQuery}
            setSelectedObjectForDetail={setSelectedObjectForDetail}
            setSelectedObjectType={setSelectedObjectType}
            setSelectedTeaSlug={setSelectedTeaSlug}
            setWorkflowSection={setWorkflowSection}
            setWorkflowView={setWorkflowView}
            showToast={showToast}
            toggleLike={toggleLike}
            togglePersonalPick={togglePersonalPick}
            unfollowEntityOne={unfollowEntityOne}
            unfollowOne={unfollowOne}
            userLocation={userLocation}
            setFeedArea={setFeedArea}
            setLocError={setLocError}
            setPursuits={setPursuits}
            setSelectedLocation={setSelectedLocation}
            setUserLocation={setUserLocation}
            personalFeedIds={personalFeedIds}
            personalBoostMap={personalBoostMap}
            boardMode={boardMode}
            discoveryTab={discoveryTab}
            feedReload={feedReload}
            moreFilters={moreFilters}
            pursuitDraft={pursuitDraft}
            setBoardMode={setBoardMode}
            setDiscoveryTab={setDiscoveryTab}
            setFeedReload={setFeedReload}
            setMoreFilters={setMoreFilters}
            setPursuitDraft={setPursuitDraft}
          />
        )}




        {/* TEA */}

        {/* MY LAYER */}

        {/* WORKFLOWS */}
        {activeTab === 'workflows' && (
          <WorkflowsScreen
            activeTab={activeTab}
            briefItBusy={briefItBusy}
            briefItPreview={briefItPreview}
            briefItSaved={briefItSaved}
            briefItText={briefItText}
            connectorStatus={connectorStatus}
            handleAcceptCandidate={handleAcceptCandidate}
            handleReceiveInbound={handleReceiveInbound}
            handleRejectCandidate={handleRejectCandidate}
            inboundBusy={inboundBusy}
            loadObjects={loadObjects}
            matches={matches}
            objects={objects}
            refreshConnectors={refreshConnectors}
            reviewed={reviewed}
            runBriefItSave={runBriefItSave}
            setBriefItPreview={setBriefItPreview}
            setBriefItSaved={setBriefItSaved}
            setBriefItText={setBriefItText}
            setWorkflowSection={setWorkflowSection}
            setWorkflowView={setWorkflowView}
            showToast={showToast}
            sources={sources}
            workflowSection={workflowSection}
            workflowView={workflowView}
            candidates={candidates}
            journeys={journeys}
            setBriefItBusy={setBriefItBusy}
          />
        )}

        {/* INTELLIGENCE */}

        {activeTab === 'arena' && (
          <ArenaScreen
            sessionUser={sessionUser}
            arenaActivity={arenaActivity}
            matches={matches}
            setMatches={setMatches}
            refreshArenaMatches={refreshArenaMatches}
            arenaBusyId={arenaBusyId}
            setArenaBusyId={setArenaBusyId}
            showToast={showToast}
            arenaSection={arenaSection}
            setArenaSection={setArenaSection}
          />
        )}






























        </main>
      </div>

      {/* MOBILE DOCK. Five tabs. Hides while you read; a pull nub brings it back. */}
      <button
        type="button"
        aria-label="Show navigation"
        onClick={() => setDockOn(true)}
        className={`md:hidden fixed bottom-0 left-1/2 z-[55] -translate-x-1/2 h-5 w-16 rounded-t-full bg-[#FBFAFD] border border-b-0 border-[#D6CFE4] cursor-pointer transition-transform ${
          dockOn || isAnyModalActive ? 'translate-y-full pointer-events-none hidden' : ''
        } ${isAnyModalActive ? 'hidden' : ''}`}
      >
        <span className="mx-auto mt-1.5 block h-1 w-8 rounded-full bg-[#D1D5DB]" />
      </button>
      <nav
        aria-label="Primary"
        className={`md:hidden fixed bottom-0 inset-x-0 z-[55] bg-[#FBFAFD]/98 backdrop-blur-xl border-t border-[#D6CFE4] flex shadow-lg transition-transform duration-200 ${
          dockOn && !isAnyModalActive ? 'translate-y-0' : 'translate-y-full hidden pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={() => { setMenuOpen((v) => !v); setDockOn(true); }}
          aria-label="Menu"
          aria-expanded={menuOpen}
          title="Menu"
          className={`flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-2 cursor-pointer transition-colors ${
            menuOpen ? 'text-[var(--brief-green)] font-bold border-t-2 border-[var(--brief-green)]' : 'text-[var(--brief-muted)]'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[12px] font-extrabold leading-none">Menu</span>
        </button>
        {DESTINATIONS.map((d) => {
          const active = activeTab === d.id;
          const Icon = DESTINATION_ICONS[d.id];
          return (
            <button
              key={d.id}
              onClick={() => goToDestination(d.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-2 cursor-pointer transition-colors ${
                active ? 'text-[var(--brief-green)] font-bold border-t-2 border-[var(--brief-green)]' : 'text-[var(--brief-muted)]'
              }`}
            >
              <span className="relative">
                <Icon className="w-5 h-5" />
                <span className="absolute -right-2 -top-1.5">
                  <ActivityDot n={destinationAlerts[d.id] ?? 0} />
                </span>
              </span>
              <span className="text-[12px] font-extrabold leading-none">
                {d.label}
              </span>
              {(destinationAlerts[d.id] ?? 0) > 0 && (
                <span className="sr-only">
                  {destinationAlerts[d.id]} update{(destinationAlerts[d.id] ?? 0) > 1 ? 's' : ''}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* CAMPAIGN DASHBOARD. Every number is server-derived. Where the
          backend does not measure something, this says so rather than
          printing a zero that looks like a measurement. */}
      <OverlaysShell
        attachObjectToCampaign={attachObjectToCampaign}
        beginEdit={beginEdit}
        campaignActionError={campaignActionError}
        campaignBusy={campaignBusy}
        campaignCircle={campaignCircle}
        campaignDetail={campaignDetail}
        campaignRegs={campaignRegs}
        captureMode={captureMode}
        captureOpen={captureOpen}
        capturePreview={capturePreview}
        captureText={captureText}
        collectionPickerFor={collectionPickerFor}
        confirmPayment={confirmPayment}
        copyCampaignLink={copyCampaignLink}
        createStep={createStep}
        detailGraph={detailGraph}
        directLocation={directLocation}
        directTitle={directTitle}
        directType={directType}
        dismissOverlay={dismissOverlay}
        draft={draft}
        editDraft={editDraft}
        graph={graph}
        handleCaptureCancel={handleCaptureCancel}
        handleCaptureConfirm={handleCaptureConfirm}
        handleCaptureParse={handleCaptureParse}
        handleConfirmObject={handleConfirmObject}
        handleCreatePursuit={handleCreatePursuit}
        handleDirectPost={handleDirectPost}
        handleExecuteProtocolAction={handleExecuteProtocolAction}
        handlePivotToType={handlePivotToType}
        handleRemoveCampaign={handleRemoveCampaign}
        handleReportObject={handleReportObject}
        handleShare={handleShare}
        handleToggleWatch={handleToggleWatch}
        loadAttachableObjects={loadAttachableObjects}
        loadCampaigns={loadCampaigns}
        loadPersonal={loadPersonal}
        locationName={locationName}
        matches={matches}
        objectCheckBusy={objectCheckBusy}
        objectPicker={objectPicker}
        objects={objects}
        openCampaign={openCampaign}
        openCampaignId={openCampaignId}
        openLocationPage={openLocationPage}
        personalState={personalState}
        postUpdate={postUpdate}
        publicOrigin={publicOrigin}
        publishDraft={publishDraft}
        publishedCampaign={publishedCampaign}
        pursuitResults={pursuitResults}
        pursuits={pursuits}
        relatedObjects={relatedObjects}
        relatedToSavedIds={relatedToSavedIds}
        reportForObject={reportForObject}
        saveCampaignEdit={saveCampaignEdit}
        savedIdSet={savedIdSet}
        selectedObjectForDetail={selectedObjectForDetail}
        selectedTeaSlug={selectedTeaSlug}
        sessionUser={sessionUser}
        setCampaignActionError={setCampaignActionError}
        setCampaignBusy={setCampaignBusy}
        setCampaignCircle={setCampaignCircle}
        setCampaignDetail={setCampaignDetail}
        setCaptureMode={setCaptureMode}
        setCapturePreview={setCapturePreview}
        setCaptureText={setCaptureText}
        setCollectionPickerFor={setCollectionPickerFor}
        setCreateStep={setCreateStep}
        setDirectCategory={setDirectCategory}
        setDirectLocation={setDirectLocation}
        setDirectTitle={setDirectTitle}
        setDirectType={setDirectType}
        setDraft={setDraft}
        setEditDraft={setEditDraft}
        setObjectPicker={setObjectPicker}
        setOpenCampaignId={setOpenCampaignId}
        setRegStatus={setRegStatus}
        setReportForObject={setReportForObject}
        setSelectedObjectForDetail={setSelectedObjectForDetail}
        setUpdateBody={setUpdateBody}
        setUpdateTitle={setUpdateTitle}
        shareCampaign={shareCampaign}
        showToast={showToast}
        sources={sources}
        tuneObject={tuneObject}
        updateBody={updateBody}
        updateBusy={updateBusy}
        updateNote={updateNote}
        updateTitle={updateTitle}
        watchedIds={watchedIds}
        chooseCity={chooseCity}
        collectionRouteId={collectionRouteId}
        collectionsOpen={collectionsOpen}
        entityPageId={entityPageId}
        followOne={followOne}
        followingOpen={followingOpen}
        handleMenuSelect={handleMenuSelect}
        menuOpen={menuOpen}
        selectedLocation={selectedLocation}
        setActiveTab={setActiveTab}
        setCollectionsOpen={setCollectionsOpen}
        setEntityPageId={setEntityPageId}
        setFollowingOpen={setFollowingOpen}
        setMyLayerSection={setMyLayerSection}
      />

      {/* CREATE CAMPAIGN. Type -> details -> preview -> publish. The preview
          is a screen, not a saved object: nothing reaches the server until
          Publish, and publication itself is the real transition endpoint. */}

      {/* CAPTURE: the easiest way into Brief. Quick drop or direct post creation. */}

      {/* Package 3: the dynamic ticket bar — the active gate pass, locked to
          the bottom of the screen, with inline delta alerts. */}
      <TicketBar />

      {/* DETAIL LAYER */}


      {/* First run. An OVERLAY, not a replacement: the feed loads behind it,
          so the screen after the flow is already warm. */}
      <Onboarding
        open={firstRunOpen}
        providers={authProviders}
        state={onboardingState}
        user={sessionUser}
        channel={arrivalChannel}
        placeLabel={userLocation?.label ?? null}
        onSignedIn={(user) => {
          setSessionUser(user);
          void refreshOnboarding();
        }}
        onGuest={provisionGuest}
        onStateChange={setOnboardingState}
        onUseLocation={locate}
        onChooseCity={(city) => chooseCity(city)}
        onDone={() => {
          setFirstRunOpen(false);
          setActiveTab('nearby');
          setNearbySection('stream');
          void refreshOnboarding();
        }}
      />

      <AdminDesk open={adminOpen} onClose={dismissOverlay} me={sessionUser} />

      {/* ENTITY LAYER — the followable entity page and the Following surface. */}

      {/* LOCAL ACTIVITY GRAPH — the public location discovery page. */}

      {/* COLLECTIONS — the personal layer. The surface opens from the header;
          a shared /collections/:id link renders the public page directly. */}
      <footer className="border-t border-[#D6CFE4] mt-12 py-6 text-xs text-[#251045]/60 text-center">
        Everything Happening Around You
      </footer>

    </div>
  );
}

export default App;
