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
  const [relationships, setRelationships] = useState<ObjectRelationship[]>([]);

  const [posts] = useState<BriefPost[]>(INITIAL_POSTS);
  const [likedPostIds, setLikedPostIds] = useState<string[]>([]);
  const [activeEdition, setActiveEdition] = useState<TeaEdition>(() =>
    getCurrentEdition()
  );

  const [activeTab, setActiveTab] = useState<Destination>(bootRoute.dest);
  const [homeFeedStatus, setHomeFeedStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [nearbySection, setNearbySection] = useState<NearbySection>(bootRoute.nearby);
  // The discovery experience navigation: Home, Events, Explore, Offers,
  // Places, News, Opportunities. Categories only appear when the real data
  // has meaningful rows for them.
  const [discoveryTab, setDiscoveryTab] = useState<
    'home' | 'events' | 'explore' | 'offers' | 'places' | 'news' | 'opportunities'
  >('home');
  const [moreFilters, setMoreFilters] = useState<boolean>(false);
  // --- Personal Brief ----------------------------------------------------
  // The personal layer is the same object store re-ranked per user: we keep
  // the server's ORDERED ids plus the per-row boost, and map them onto the
  // existing `objects` list — never a second object store on the client.
  const [personalState, setPersonalState] = useState<briefApi.PersonalState | null>(null);
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
  const activeWorkflowBundle = WORKFLOW_BUNDLES.find((b) =>
    (b.sections as readonly string[]).includes(workflowSection)
  ) ?? WORKFLOW_BUNDLES[0];
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

  const clearLocation = React.useCallback(() => {
    setLocError(null);
    setUserLocation(null);
    setFeedArea(null);
    setSelectedLocation('Your area');
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
  React.useEffect(() => {
    if (!personalState || personalState.saved.length === 0) return;
    setRelationships((prev) => {
      const have = new Set(prev.filter((r) => r.verb === 'saved').map((r) => r.targetId));
      const missing = personalState.saved.filter((id) => !have.has(id) && objects.some((o) => o.id === id));
      if (missing.length === 0) return prev;
      const nowIso = new Date().toISOString();
      return [
        ...prev,
        ...missing.map((id) => ({
          id: `rel_srv_${id}`,
          sourceType: 'identity' as ObjectType,
          sourceId: 'usr_me',
          verb: 'saved' as const,
          targetType: (objects.find((o) => o.id === id)?.type ?? 'knowledge') as ObjectType,
          targetId: id,
          state: 'engaged' as FlowState,
          updatedAt: nowIso
        }))
      ];
    });
  }, [personalState, objects]);

  const togglePersonalPick = (group: 'locations' | 'types' | 'topics', value: string) =>
    setPersonalPicks((p) => ({
      ...p,
      [group]: p[group].includes(value) ? p[group].filter((v) => v !== value) : [...p[group], value]
    }));

  const savePersonalBrief = async () => {
    setPersonalBusy(true);
    const res = await briefApi.putInterests(personalPicks);
    setPersonalBusy(false);
    if (!res.ok) {
      showToast(res.error ?? 'Could not save your Brief.');
      return;
    }
    setPersonalState((p) => (p ? { ...p, interests: res.data.interests } : p));
    setPersonalBriefDismissed(false);
    setPersonalPicks({ locations: [], types: [], topics: [] });
    showToast('Your Brief is set.');
    void loadPersonal();
  };

  const followOne = async (kind: 'location' | 'type' | 'topic', value: string) => {
    const res = await briefApi.followInterest(kind, value);
    if (!res.ok) { showToast(res.error ?? 'Could not follow that.'); return; }
    setPersonalState((p) => (p ? { ...p, interests: res.data.interests } : p));
    void loadPersonal();
  };

  const unfollowOne = async (kind: 'location' | 'type' | 'topic', value: string) => {
    const res = await briefApi.unfollowInterest(kind, value);
    if (!res.ok) { showToast(res.error ?? 'Could not unfollow.'); return; }
    setPersonalState((p) => (p ? { ...p, interests: res.data.interests } : p));
    void loadPersonal();
  };

  /** Unfollow an entity (venue/business/publisher/organizer/community). */
  const unfollowEntityOne = async (id: string) => {
    const res = await briefApi.unfollowEntity(id);
    if (!res.ok) { showToast(res.error ?? 'Could not unfollow.'); return; }
    setPersonalState((p) => p
      ? { ...p, followed: p.followed.filter((f) => f.id !== id) }
      : p);
    void loadPersonal();
  };

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


  const runBriefItPreview = async () => {
    if (!briefItText.trim()) return;
    setBriefItBusy(true);
    setBriefItSaved(null);
    try {
      const res = await briefApi.previewBriefIt(briefItText);
      setBriefItPreview(res.ok ? res.data : { error: res.error });
    } finally {
      setBriefItBusy(false);
    }
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
  const [pursuitDraft, setPursuitDraft] = useState<string>('');
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
  const [feedReload, setFeedReload] = useState(0);

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

  const [campaignState, setCampaignState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    data: ApiCampaign[] | null;
    error: string | null;
  }>({ status: 'idle', data: null, error: null });

  const [openCampaignId, setOpenCampaignId] = useState<string | null>(bootRoute.campaignId);
  const [campaignDetail, setCampaignDetail] = useState<ApiCampaign | null>(null);
  const [campaignRegs, setCampaignRegs] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    data: ApiRegistration[] | null;
    error: string | null;
  }>({ status: 'idle', data: null, error: null });

  const [campaignBusy, setCampaignBusy] = useState<boolean>(false);
  const [campaignActionError, setCampaignActionError] = useState<string | null>(null);

  // Create flow. `preview` is a screen, not a stored object: nothing is sent
  // to the server between 'form' and the user pressing Publish.
  const [createStep, setCreateStep] = useState<'closed' | 'form' | 'preview' | 'published'>('closed');
  const [draft, setDraft] = useState<{
    title: string;
    type: ApiCampaignType;
    description: string;
    location: string;
    startsAt: string;
    capacity: string;
    price: string;
    circleId: string;
  }>({
    title: '',
    type: 'popup',
    description: '',
    location: '',
    startsAt: '',
    capacity: '',
    price: '',
    circleId: ''
  });
  const [publishedCampaign, setPublishedCampaign] = useState<ApiCampaign | null>(null);

  // Attachable existing objects. Loaded only when the creator asks, because
  // most campaigns are something new and the list is noise until it is wanted.
  const [objectPicker, setObjectPicker] = useState<{
    open: boolean;
    status: 'idle' | 'loading' | 'ready' | 'error';
    data: any[] | null;
    error: string | null;
    selected: { id: string; title: string } | null;
  }>({ open: false, status: 'idle', data: null, error: null, selected: null });

  const loadAttachableObjects = async () => {
    setObjectPicker((p) => ({ ...p, open: true, status: 'loading', error: null }));
    const res = await briefApi.getObjects();
    if (res.ok) {
      setObjectPicker((p) => ({ ...p, status: 'ready', data: res.data, error: null }));
    } else {
      setObjectPicker((p) => ({ ...p, status: 'error', data: null, error: res.error }));
    }
  };

  // Editing an existing draft. Separate from `draft` (the create flow) so a
  // half-finished new campaign is never confused with an edit in progress.
  const [editDraft, setEditDraft] = useState<{
    title: string;
    description: string;
    location: string;
    startsAt: string;
    price: string;
    capacity: string;
  } | null>(null);

  // The Circle a campaign is attached to, if any. Read separately because the
  // campaign row carries only `circleId`; the target's progress lives on the
  // Circle and is derived there from settled transactions.
  const [campaignCircle, setCampaignCircle] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    data: ApiCircleDetail | null;
    error: string | null;
  }>({ status: 'idle', data: null, error: null });

  const loadCampaigns = async () => {
    setCampaignState((prev) => ({ ...prev, status: 'loading', error: null }));
    // Config is read alongside the list so share links are correct as soon as
    // a campaign can be shared. A failure here is not fatal: publicOrigin
    // stays null and the share UI reports that honestly.
    briefApi.getConfig().then((c) => {
      if (c.ok) setPublicOrigin(c.data.publicOrigin);
    });
    const res = await briefApi.getCampaigns();
    if (res.ok) {
      setCampaignState({ status: 'ready', data: res.data, error: null });
    } else {
      // No fallback to seeded data. An unreachable server means we say so.
      setCampaignState({ status: 'error', data: null, error: res.error });
    }
  };

  const openCampaign = async (id: string) => {
    setOpenCampaignId(id);
    setCampaignDetail(null);
    setCampaignActionError(null);
    setCampaignRegs({ status: 'loading', data: null, error: null });
    const [detail, regs] = await Promise.all([
      briefApi.getCampaign(id),
      briefApi.getCampaignRegistrations(id)
    ]);
    if (detail.ok) setCampaignDetail(detail.data);
    else setCampaignActionError(detail.error);
    if (regs.ok) setCampaignRegs({ status: 'ready', data: regs.data, error: null });
    else setCampaignRegs({ status: 'error', data: null, error: regs.error });

    // A campaign may be attached to a Circle carrying a Target. The target's
    // progress is derived on the server from settled transactions -- this only
    // reads it. Nothing here writes progress.
    if (detail.ok && detail.data.circleId) {
      setCampaignCircle({ status: 'loading', data: null, error: null });
      const circle = await briefApi.getCircle(detail.data.circleId);
      if (circle.ok) setCampaignCircle({ status: 'ready', data: circle.data, error: null });
      else setCampaignCircle({ status: 'error', data: null, error: circle.error });
    } else {
      setCampaignCircle({ status: 'idle', data: null, error: null });
    }
  };

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
  const attachObjectToCampaign = async (campaignId: string, objectId: string) => {
    setCampaignBusy(true);
    setCampaignActionError(null);
    const res = await briefApi.updateCampaign(campaignId, { objectId });
    setCampaignBusy(false);
    setObjectPicker((p) => ({ ...p, open: false, selected: null }));
    if (!res.ok) {
      setCampaignActionError(res.error);
      return;
    }
    await openCampaign(campaignId);
    showToast('Item linked');
  };

  const saveCampaignEdit = async (campaign: ApiCampaign) => {
    if (!editDraft) return;
    setCampaignBusy(true);
    setCampaignActionError(null);
    const price = editDraft.price.trim() === '' ? 0 : Number(editDraft.price);
    const capacity = editDraft.capacity.trim() === '' ? null : Number(editDraft.capacity);
    const res = await briefApi.updateCampaign(campaign.id, {
      title: editDraft.title.trim(),
      description: editDraft.description.trim(),
      location: editDraft.location.trim() === '' ? null : editDraft.location.trim(),
      startsAt: editDraft.startsAt.trim() === '' ? null : editDraft.startsAt.trim(),
      price: Number.isFinite(price) ? price : 0,
      ...(campaign.status === 'draft'
        ? { capacity: capacity !== null && Number.isFinite(capacity) ? capacity : null }
        : {})
    });
    setCampaignBusy(false);
    if (!res.ok) {
      setCampaignActionError(res.error);
      return;
    }
    setCampaignDetail(res.data);
    setEditDraft(null);
    loadCampaigns();
    showToast('Saved');
  };

  const handleRemoveCampaign = async (campaignId: string) => {
    setCampaignBusy(true);
    setCampaignActionError(null);
    try {
      const allCampaigns = campaignState.data ?? [];
      const c = allCampaigns.find((x) => x.id === campaignId) || campaignDetail;
      if (c && c.status !== 'cancelled' && c.status !== 'closed') {
        try { await briefApi.campaignAction(campaignId, 'cancel'); } catch {}
      }
      await briefApi.deleteCampaign(campaignId);
      setCampaignState((prev) => ({
        ...prev,
        data: (prev.data ?? []).filter((item) => item.id !== campaignId)
      }));
      if (c?.objectId) {
        setObjects((prev) => prev.filter((o) => o.id !== c.objectId));
      }
      setOpenCampaignId(null);
      setCampaignDetail(null);
      setEditDraft(null);
      showToast('Event removed.');
      void loadCampaigns();
      void loadObjects();
    } catch (e: any) {
      setCampaignActionError(String(e.message || e));
    } finally {
      setCampaignBusy(false);
    }
  };

  const beginEdit = (c: ApiCampaign) => {
    setCampaignActionError(null);
    setEditDraft({
      title: c.title,
      description: c.description,
      location: c.location ?? '',
      startsAt: c.startsAt ? c.startsAt.slice(0, 16) : '',
      price: c.price === 0 ? '' : String(c.price),
      capacity: c.capacity === null ? '' : String(c.capacity)
    });
  };

  /** Share uses the platform sheet where it exists, clipboard otherwise. */
  const shareCampaign = async (campaign: ApiCampaign) => {
    const link = briefApi.campaignShareLink(campaign.publicSlug, publicOrigin);
    if (!link.available) {
      showToast('No public link configured yet');
      return;
    }
    briefApi.shareCampaign(campaign.id, 'native');
    const url = link.url;
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    if (nav && typeof nav.share === 'function') {
      try {
        await nav.share({ title: campaign.title, url });
        return;
      } catch {
        // User dismissed the sheet, or the browser refused. Fall through to
        // copy rather than reporting a failure they did not cause.
      }
    }
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
      try {
        await nav.clipboard.writeText(url);
        showToast('Link copied');
        return;
      } catch {
        // fall through
      }
    }
    showToast(url);
  };

  const copyCampaignLink = async (slug: string, campaignId?: string) => {
    const link = briefApi.campaignShareLink(slug, publicOrigin);
    if (!link.available) {
      showToast('No public link configured yet');
      return;
    }
    if (campaignId) briefApi.shareCampaign(campaignId, 'link');
    const url = link.url;
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
      try {
        await nav.clipboard.writeText(url);
        showToast('Link copied');
        return;
      } catch {
        // fall through
      }
    }
    showToast(url);
  };

  const submitDraft = async () => {
    setCampaignBusy(true);
    setCampaignActionError(null);
    const capacity = draft.capacity.trim() === '' ? null : Number(draft.capacity);
    const price = draft.price.trim() === '' ? 0 : Number(draft.price);
    const res = await briefApi.createCampaign({
      title: draft.title.trim(),
      type: draft.type,
      description: draft.description.trim(),
      location: draft.location.trim() === '' ? null : draft.location.trim(),
      startsAt: draft.startsAt.trim() === '' ? null : draft.startsAt.trim(),
      capacity: capacity !== null && Number.isFinite(capacity) ? capacity : null,
      price: Number.isFinite(price) ? price : 0,
      circleId: draft.circleId === '' ? null : draft.circleId,
      // Attach an existing item when one was chosen. The server checks
      // authority and refuses if the creator may not use it.
      objectId: objectPicker.selected ? objectPicker.selected.id : null
    });
    setCampaignBusy(false);
    if (!res.ok) {
      setCampaignActionError(res.error);
      return null;
    }
    return res.data;
  };

  /**
   * Publish goes through the real transition endpoint. If the server refuses
   * the transition the campaign stays a draft on screen: there is no local
   * `status = 'live'` anywhere in this file.
   */
  const publishDraft = async () => {
    const created = await submitDraft();
    if (!created) return;
    setCampaignBusy(true);
    const res = await briefApi.campaignAction(created.id, 'publish');
    setCampaignBusy(false);
    if (!res.ok) {
      setCampaignActionError(res.error);
      return;
    }
    setPublishedCampaign(res.data);
    setCreateStep('published');
    loadCampaigns();
  };

  /**
   * The organiser confirms money actually arrived for a held spot.
   *
   * This does NOT set a registration status from the client. The server
   * creates a real transaction, settles it through the ordinary ledger state
   * machine, and promotes the registration off that settled row. The UI then
   * refetches rather than optimistically patching, so what is displayed is
   * always what the server derived.
   */
  const confirmPayment = async (campaignId: string, registrationId: string) => {
    setCampaignBusy(true);
    setCampaignActionError(null);
    const res = await briefApi.confirmRegistrationPayment(campaignId, registrationId);
    setCampaignBusy(false);
    if (!res.ok) {
      setCampaignActionError(res.error);
      return;
    }
    await openCampaign(campaignId);
    showToast('Payment confirmed');
  };

  // --- T3: the organiser authors updates the public page shows -------------
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateBody, setUpdateBody] = useState('');
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateNote, setUpdateNote] = useState<string | null>(null);

  const postUpdate = async (campaignId: string) => {
    if (!updateTitle.trim() || !updateBody.trim() || updateBusy) return;
    setUpdateBusy(true);
    setUpdateNote(null);
    const res = await briefApi.postCampaignUpdate(campaignId, {
      title: updateTitle.trim(),
      body: updateBody.trim()
    });
    setUpdateBusy(false);
    if (!res.ok) {
      setUpdateNote(res.error);
      return;
    }
    setUpdateTitle('');
    setUpdateBody('');
    setUpdateNote('Posted. It is on the public page now.');
  };

  const setRegStatus = async (
    campaignId: string,
    registrationId: string,
    status: 'checked_in' | 'no_show'
  ) => {
    setCampaignBusy(true);
    const res = await briefApi.setRegistrationStatus(campaignId, registrationId, status);
    setCampaignBusy(false);
    if (!res.ok) {
      setCampaignActionError(res.error);
      return;
    }
    // Refetch instead of patching state: the metrics block must move with it.
    openCampaign(campaignId);
  };


  // Card button. Uses the same resolver as the detail view so a given label
  // means the same thing in both places. Anything without a real destination
  // opens the detail view rather than dead-ending.
  const handlePrimaryAction = (object: BriefObject) => {
    const action = resolveAction(object);

    switch (action.kind) {
      case 'external':
      case 'map':
        window.open(action.href, '_blank', 'noopener,noreferrer');
        handleExecuteProtocolAction('discover', object, { silent: true });
        return;

      case 'phone':
        window.location.href = action.href;
        handleExecuteProtocolAction('contact', object, { silent: true });
        return;

      default:
        setSelectedObjectForDetail(object);
    }
  };

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
  const savedObjects = useMemo(
    () =>
      objects.filter((obj) =>
        relationships.some(
          (rel) => rel.targetId === obj.id && rel.verb === 'saved'
        )
      ),
    [objects, relationships]
  );


  // One graph instance over the live state. Components ask it questions
  // instead of re-deriving relationship rules inline.
  const graph = useMemo(
    () => createBriefGraph(objects, relationships),
    [objects, relationships]
  );

  const watchedIds = useMemo(
    () => new Set(relationships.filter((r) => r.verb === 'watched').map((r) => r.targetId)),
    [relationships]
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

  const handleSetPursuitStatus = (id: string, status: PursuitStatus) => {
    setPursuits((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status, lastUpdatedAt: new Date().toISOString() }
          : p
      )
    );
  };

  const handleTogglePursuitWatch = (id: string) => {
    setPursuits((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              watchChanges: !p.watchChanges,
              lastUpdatedAt: new Date().toISOString()
            }
          : p
      )
    );
  };

  const handleTogglePursuitCondition = (id: string, condition: WatchCondition) => {
    setPursuits((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const current = p.watchConditions ?? [];
        return {
          ...p,
          watchConditions: current.includes(condition)
            ? current.filter((c) => c !== condition)
            : [...current, condition],
          lastUpdatedAt: new Date().toISOString()
        };
      })
    );
  };

  const handleRemovePursuit = (id: string) => {
    setPursuits((prev) => prev.filter((p) => p.id !== id));
    showToast('Pursuit removed');
  };

  // --- Ingestion review state ------------------------------------------------
  // Candidates are parsed on demand and held here. They are NOT objects: until
  // a reviewer accepts one, nothing reaches the graph, search, or My Layer.
  const [candidates, setCandidates] = useState<IngestionCandidate[]>([]);
  const [reviewed, setReviewed] = useState<Record<string, CandidateStatus>>({});

  // Pulls the real inbound queue: messages as they actually arrived from
  // connected sources. Brief ships with no sample traffic, so on a system with
  // nothing connected this correctly finds nothing -- "no new messages" is a
  // true report about an empty queue, not a UI that failed to load.
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

    setCandidates((prev) => [...prev, ...fresh]);
    showToast(`${fresh.length} message(s) parsed for review`);
  };

  // Accepting is the ONLY path from message to object, and it is manual.
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

    setObjects((prev) => [accepted, ...prev]);
    setReviewed((prev) => ({ ...prev, [candidate.id]: 'accepted' }));
    showToast(`Published: ${accepted.title.slice(0, 40)}`);
  };

  const handleRejectCandidate = (candidate: IngestionCandidate) => {
    setReviewed((prev) => ({ ...prev, [candidate.id]: 'rejected' }));
    showToast('Discarded');
  };

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
  const [rewards, setRewards] = useState<Reward[]>(REWARD_CATALOGUE);
  const [boardMode, setBoardMode] = useState<'contributors' | 'earners'>('contributors');

  const openQuests = useMemo(
    () => quests.filter((q) => q.status === 'open'),
    [quests]
  );

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
  const [arenaBusyId, setArenaBusyId] = useState<string | null>(null);
  // The secondary game screen. null = closed; set to a game id to open the
  // match-setup surface behind a shelf tile.

  const [arenaActivity, setArenaActivity] = useState<Record<string, number>>({});
  // Challenges come from the SERVER, not a fixture: a challenge is a real,
  // persisted, attributable record. `ARENA_CHALLENGES` is gone from the state.

  // Whether real-money contests are legally available HERE. Fetched from the
  // server rather than hardcoded, because the answer depends on licensing and
  // connected payment rails, not on what the UI would like to show.
  const [arenaMoney, setArenaMoney] = useState<ArenaMoneyStatus | null>(null);
  useEffect(() => {
    briefApi.getArenaMoneyStatus().then((r) => {
      if (r.ok) setArenaMoney(r.data);
    });
  }, []);

  // The eFootball beta is the first controlled Arena test. Its counters are
  // aggregate server projections; a missing response stays visibly unavailable
  // rather than becoming a fabricated zero-population claim.
  const [arenaBetaSummary, setArenaBetaSummary] = useState<ArenaBetaSummary | null>(null);
  const [arenaBetaBusy, setArenaBetaBusy] = useState(false);
  const refreshArenaBeta = React.useCallback(async () => {
    const res = await briefApi.getArenaBeta();
    if (res.ok) setArenaBetaSummary(res.data);
  }, []);
  useEffect(() => { void refreshArenaBeta(); }, [refreshArenaBeta, sessionUser]);

  const handleJoinArenaBeta = async (segment: ArenaBetaSegment) => {
    if (!sessionUser) {
      showToast('Your account is still loading — try again in a moment.');
      return;
    }
    setArenaBetaBusy(true);
    // Preserve a real campaign source when a player arrives from a tagged
    // community/creator link; otherwise record the in-product entry point.
    const acquisitionSource = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('utm_source') ?? 'arena_beta_card'
      : 'arena_beta_card';
    const res = await briefApi.joinArenaBeta({
      segment,
      acquisitionSource
    });
    setArenaBetaBusy(false);
    if (!res.ok) {
      showToast(res.error ?? 'Could not save your pilot spot.');
      return;
    }
    await refreshArenaBeta();
    showToast(res.data.reused ? 'You are already on the pilot list.' : 'You are on the pilot list. Add your game tag to play.');
  };

  const [matches, setMatches] = useState<ArenaMatch[]>([]);

  const mapServerMatch = (m: any): ArenaMatch => ({
    id: String(m.id),
    challengeId: String(m.challengeId ?? ''),
    gameId: (SERVER_TO_CLIENT_GAME[m.gameId] ?? m.gameId) as ArenaGameId,
    playerAId: String(m.playerAId),
    playerBId: String(m.playerBId),
    playerAName: m.playerAName ? String(m.playerAName) : undefined,
    playerBName: m.playerBName ? String(m.playerBName) : undefined,
    playedAt: m.createdAt ?? m.playedAt ?? new Date().toISOString(),
    winnerPlayerId: m.winnerPlayerId ?? undefined,
    scoreLine: m.scoreLine ?? undefined,
    confirmedByA: m.confirmedByA ?? undefined,
    confirmedByB: m.confirmedByB ?? undefined,
    status: m.status,
    reportedBy: m.reportedBy ?? null
  });

  const refreshArenaMatches = React.useCallback(async () => {
    const res = await briefApi.getArenaMatches();
    if (!res.ok) return;
    setMatches(res.data.map(mapServerMatch));
  }, []);
  useEffect(() => { void refreshArenaMatches(); }, [refreshArenaMatches]);

  // Availability is the user's own switch. Defaults to the seeded record and
  // is never flipped on by Brief.
  // Arena entities come from the SERVER — real persisted rows, never a
  // fixture. The fabricated client-side economy (points ledger, gift cards,
  // fake availability/reliability, account listings, venue check-ins) is gone.
  const [arenaPlayers, setArenaPlayers] = useState<any[]>([]);
  const [arenaVenues, setArenaVenues] = useState<any[]>([]);

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

  const activeJourneys = useMemo(() => journeys.filter((j) => !j.isCompleted), [journeys]);
  const completedJourneys = useMemo(() => journeys.filter((j) => j.isCompleted), [journeys]);

  const groupArenaSignals = useMemo(() => {
    const out: { id: string; groupName: string; summary: string; at: string }[] = [];
    for (const group of visibleGroups) {
      const entries = groupIndexes[group.id] ?? [];
      for (const entry of entries) {
        const hit = detectMatchRequest(entry, ARENA_GAMES);
        if (!hit) continue;
        const game = ARENA_GAMES.find((g) => g.id === hit.gameId);
        out.push({
          id: `sig_${entry.id}`,
          groupName: group.name,
          summary: `Someone is looking for a ${game ? game.name : 'game'} match.`,
          at: entry.sentAt
        });
      }
    }
    return out;
  }, [visibleGroups, groupIndexes]);


  const handleReportMatch = async (match: ArenaMatch, winnerPlayerId: string | null) => {
    setArenaBusyId(match.id);
    const res = await briefApi.reportArenaMatch(match.id, { winnerPlayerId });
    setArenaBusyId(null);
    if (!res.ok) {
      showToast(res.error ?? 'Could not report this result.');
      return;
    }
    await refreshArenaMatches();
    showToast('Result reported. The other player still has to confirm.');
  };

  const handleConfirmMatch = async (match: ArenaMatch) => {
    setArenaBusyId(match.id);
    const res = await briefApi.confirmArenaMatch(match.id);
    setArenaBusyId(null);
    if (!res.ok) {
      showToast(res.error ?? 'Could not confirm this result.');
      return;
    }
    await refreshArenaMatches();
    if (res.data?.disputed) {
      showToast('Players disagreed. Brief does not pick a winner.');
      return;
    }
    const rw = res.data?.yourRewards;
    showToast(rw ? `Match confirmed · +${rw.xp} XP${rw.coins ? ` · +${rw.coins} Arena Coins` : ''}` : 'Result confirmed.');
  };

  // Abandon: the honest exit for a match that never happened. The server
  // decides who may abandon (and when); a refusal says why.
  const handleAbandonMatch = async (match: ArenaMatch) => {
    setArenaBusyId(match.id);
    const res = await briefApi.abandonArenaMatch(match.id, 'never started');
    setArenaBusyId(null);
    if (!res.ok) {
      showToast(res.error ?? 'Could not abandon this match.');
      return;
    }
    await refreshArenaMatches();
    showToast('Match abandoned.');
  };

  // Venues that actually host the selected game, nearest first.
  // Live activity per game: open challenges plus players checked in at a
  // venue. Drives the count on each game chip, so the selector is dynamic.
  const [savedGroupEntryIds, setSavedGroupEntryIds] = useState<string[]>([]);


  // --- Sources ---------------------------------------------------------------
  const [sources, setSources] = useState<Source[]>(INITIAL_SOURCES);

  // --- Capture ---------------------------------------------------------------
  // Pasted text runs through the ingestion parser, then waits for confirmation
  // exactly like anything else. Capture is a doorway, not a shortcut.
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
    setObjects((prev) => [newObj, ...prev.filter((o) => o.id !== newObj.id)]);

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

  const savedIdSet = useMemo(
    () => new Set(savedObjects.map((o) => o.id)),
    [savedObjects]
  );

  const relatedToSavedIds = useMemo(() => {
    const out = new Set<string>();
    for (const saved of savedObjects) {
      for (const rel of getRelatedObjects(saved)) out.add(rel.item.id);
    }
    return out;
  }, [savedObjects, objects]);

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
  const discoveryBrief = useMemo(
    () =>
      buildDiscoveryBrief({
        objects,
        area: feedArea,
        geo: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null
      }),
    [objects, feedArea, userLocation]
  );

  // --- Personal Brief derivations -----------------------------------------
  // The personal order is the server's re-ranking of the SAME objects — the
  // ids are mapped onto `objects`, never duplicated into a second store.
  const personalOrdered = useMemo(() => {
    if (!personalFeedIds) return null;
    const byId = new Map(objects.map((o) => [o.id, o]));
    const out: { object: BriefObject; boost: number; reasons: string[] }[] = [];
    for (const id of personalFeedIds) {
      const object = byId.get(id);
      if (!object) continue;
      const p = personalBoostMap[id];
      out.push({ object, boost: p?.boost ?? 0, reasons: p?.reasons ?? [] });
    }
    return out;
  }, [personalFeedIds, personalBoostMap, objects]);

  const personalInterests = personalState?.interests ?? { locations: [], types: [], topics: [] };
  const personalHasInterests = personalInterests.locations.length > 0 || personalInterests.types.length > 0 || personalInterests.topics.length > 0;

  const personalSections = useMemo(() => {
    if (!personalOrdered || personalOrdered.length === 0) return [];
    return buildPersonalSections({
      ordered: personalOrdered,
      interests: personalInterests,
      topics: personalState?.topics ?? [],
      personalized: personalHasInterests
    });
  }, [personalOrdered, personalInterests, personalState, personalHasInterests]);

  // Types that really exist in the loaded data — the onboarding chips are
  // never a hard-coded taxonomy, only what the objects themselves say.
  const availableTypes = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of objects) counts[o.type] = (counts[o.type] ?? 0) + 1;
    return Object.keys(counts) as ObjectType[];
  }, [objects]);

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

  const pendingCandidates = useMemo(
    () => candidates.filter((c) => !reviewed[c.id]),
    [candidates, reviewed]
  );


  // Computed once per render instead of on every call site in the modal.
  const relatedObjects = selectedObjectForDetail
    ? getRelatedObjects(selectedObjectForDetail)
    : [];

  const liveEdition = getCurrentEdition();

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
            availableTypes={availableTypes}
            boardMode={boardMode}
            chooseCity={chooseCity}
            clearLocation={clearLocation}
            dailyBrief={dailyBrief}
            discoveryBrief={discoveryBrief}
            discoveryTab={discoveryTab}
            editionPosts={editionPosts}
            feedArea={feedArea}
            feedReload={feedReload}
            filteredObjects={filteredObjects}
            followOne={followOne}
            handleCreatePursuit={handleCreatePursuit}
            handleExecuteProtocolAction={handleExecuteProtocolAction}
            handleMenuSelect={handleMenuSelect}
            handlePrimaryAction={handlePrimaryAction}
            handleRemovePursuit={handleRemovePursuit}
            handleSetPursuitStatus={handleSetPursuitStatus}
            handleSubmitQuest={handleSubmitQuest}
            handleTogglePursuitCondition={handleTogglePursuitCondition}
            handleTogglePursuitWatch={handleTogglePursuitWatch}
            homeFeedStatus={homeFeedStatus}
            ladder={ladder}
            likedPostIds={likedPostIds}
            liveEdition={liveEdition}
            locError={locError}
            locate={locate}
            locating={locating}
            matches={matches}
            moreFilters={moreFilters}
            nearbySection={nearbySection}
            nextStepHidden={nextStepHidden}
            noteActivation={noteActivation}
            objects={objects}
            openEntityPage={openEntityPage}
            openPostSubject={openPostSubject}
            openQuests={openQuests}
            personalBriefDismissed={personalBriefDismissed}
            personalBusy={personalBusy}
            personalHasInterests={personalHasInterests}
            personalInterests={personalInterests}
            personalPicks={personalPicks}
            personalSavedGroups={personalSavedGroups}
            personalSections={personalSections}
            personalState={personalState}
            pursuitDraft={pursuitDraft}
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
            setBoardMode={setBoardMode}
            setCaptureOpen={setCaptureOpen}
            setCollectionsOpen={setCollectionsOpen}
            setDiscoveryTab={setDiscoveryTab}
            setFirstRunOpen={setFirstRunOpen}
            setFollowingOpen={setFollowingOpen}
            setHomeFeedStatus={setHomeFeedStatus}
            setMoreFilters={setMoreFilters}
            setNearbySection={setNearbySection}
            setNextStepHidden={setNextStepHidden}
            setPersonalBriefDismissed={setPersonalBriefDismissed}
            setPursuitDraft={setPursuitDraft}
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
          />
        )}




        {/* TEA */}

        {/* MY LAYER */}

        {/* WORKFLOWS */}
        {activeTab === 'workflows' && (
          <WorkflowsScreen
            activeJourneys={activeJourneys}
            activeTab={activeTab}
            activeWorkflowBundle={activeWorkflowBundle}
            briefItBusy={briefItBusy}
            briefItPreview={briefItPreview}
            briefItSaved={briefItSaved}
            briefItText={briefItText}
            completedJourneys={completedJourneys}
            connectorStatus={connectorStatus}
            handleAcceptCandidate={handleAcceptCandidate}
            handleReceiveInbound={handleReceiveInbound}
            handleRejectCandidate={handleRejectCandidate}
            inboundBusy={inboundBusy}
            loadObjects={loadObjects}
            matches={matches}
            objects={objects}
            pendingCandidates={pendingCandidates}
            refreshConnectors={refreshConnectors}
            reviewed={reviewed}
            runBriefItPreview={runBriefItPreview}
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
      {openCampaignId && (
        <div
          className="fixed inset-0 z-50 bg-[#150826]/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overflow-hidden"
          onClick={() => {
            setOpenCampaignId(null);
            setCampaignDetail(null);
            setEditDraft(null);
            setCampaignCircle({ status: 'idle', data: null, error: null });
          }}
        >
          <div
            className="w-full max-w-lg max-h-[92vh] sm:max-h-[85vh] flex flex-col bg-[#FBFAFD] border border-[#D6CFE4] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden mb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#D6CFE4] shrink-0 flex items-start justify-between gap-3 bg-[#FBFAFD]">
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-[#251045] truncate">
                  {campaignDetail ? campaignDetail.title : 'Campaign'}
                </h2>
                {campaignDetail && (
                  <p className="text-[9px] text-[#251045]/40 mt-0.5">
                    {campaignDetail.type} &middot; {campaignDetail.status}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setOpenCampaignId(null);
                  setCampaignDetail(null);
                  setEditDraft(null);
                }}
                className="shrink-0 p-1.5 rounded-full hover:bg-[#E9E4F2] text-[#251045]/60 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
              {campaignActionError && (
                <div className="border border-red-200 bg-red-50 text-red-700 rounded-xl p-3">
                  <p className="text-[11px] font-bold break-words">
                    {campaignActionError}
                  </p>
                </div>
              )}

              {!campaignDetail && !campaignActionError && (
                <p className="text-xs text-[#251045]/60 py-6 text-center">Loading campaign...</p>
              )}

              {campaignDetail && editDraft && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">Title</label>
                    <input
                      value={editDraft.title}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, title: e.target.value } : d))}
                      className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">Description</label>
                    <textarea
                      value={editDraft.description}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, description: e.target.value } : d))}
                      rows={2}
                      className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">When</label>
                    <input
                      type="datetime-local"
                      value={editDraft.startsAt}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, startsAt: e.target.value } : d))}
                      className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">Where</label>
                    <input
                      value={editDraft.location}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, location: e.target.value } : d))}
                      className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] text-[#251045]/40 mb-1">Spots</label>
                      <input
                        inputMode="numeric"
                        disabled={campaignDetail.status !== 'draft'}
                        value={editDraft.capacity}
                        onChange={(e) => setEditDraft((d) => (d ? { ...d, capacity: e.target.value } : d))}
                        placeholder="Unlimited"
                        className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none disabled:opacity-40"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-[#251045]/40 mb-1">Price (KES)</label>
                      <input
                        inputMode="numeric"
                        value={editDraft.price}
                        onChange={(e) => setEditDraft((d) => (d ? { ...d, price: e.target.value } : d))}
                        placeholder="Free"
                        className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                      />
                    </div>
                  </div>
                  {campaignDetail.status !== 'draft' && (
                    <p className="text-[9px] text-[#251045]/40 leading-snug">
                      Spots cannot change after publishing. People have already
                      registered against this number.
                    </p>
                  )}
                </div>
              )}

              {campaignDetail && !editDraft && (
                <>
                  {campaignDetail.status !== 'draft' && (
                    <CampaignDistribution
                      compact
                      link={briefApi.campaignShareLink(campaignDetail.publicSlug, publicOrigin)}
                      title={campaignDetail.title}
                      onCopy={() => copyCampaignLink(campaignDetail.publicSlug, campaignDetail.id)}
                      onShare={(ch) => briefApi.shareCampaign(campaignDetail.id, ch)}
                      onNativeShare={() => shareCampaign(campaignDetail)}
                    />
                  )}

                  <button
                    onClick={() => beginEdit(campaignDetail)}
                    className="w-full py-2.5 rounded-xl border border-[#D6CFE4] text-[#251045] font-extrabold text-[11px] cursor-pointer hover:bg-[#F4F1FA]"
                  >
                    Edit details
                  </button>

                  {campaignDetail.status === 'draft' && (
                    <button
                      disabled={campaignBusy}
                      onClick={async () => {
                        setCampaignBusy(true);
                        setCampaignActionError(null);
                        const res = await briefApi.campaignAction(campaignDetail.id, 'publish');
                        setCampaignBusy(false);
                        if (!res.ok) { setCampaignActionError(res.error); return; }
                        setCampaignDetail(res.data);
                        loadCampaigns();
                        showToast('Published');
                      }}
                      className="w-full py-3 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-xs cursor-pointer disabled:opacity-40 hover:bg-[#000000]"
                    >
                      {campaignBusy ? 'Publishing...' : 'Publish'}
                    </button>
                  )}

                  {/* PEOPLE */}
                  <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-2">
                    <h3 className="text-[9px] text-[#251045]/40">
                      People
                    </h3>
                    <p className="text-xl font-extrabold text-[#251045]">
                      {campaignDetail.metrics.slotsTaken}
                      {campaignDetail.metrics.capacity !== null && (
                        <span className="text-[#251045]/40"> / {campaignDetail.metrics.capacity}</span>
                      )}
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {([
                        ['Registered', campaignDetail.metrics.registrations],
                        ['Checked in', campaignDetail.metrics.checkedIn],
                        [
                          'Remaining',
                          campaignDetail.metrics.remaining === null
                            ? 'Unlimited'
                            : campaignDetail.metrics.remaining
                        ],
                        ['No-show', campaignDetail.metrics.noShows]
                      ] as [string, string | number][]).map(([label, value]) => (
                        <div key={label} className="flex items-baseline justify-between gap-2">
                          <span className="text-[10px] text-[#251045]/60">{label}</span>
                          <span className="text-[11px] text-[#251045]/60">{value}</span>
                        </div>
                      ))}
                    </div>
                    {campaignDetail.metrics.capacity !== null &&
                      campaignDetail.metrics.remaining === 0 && (
                        <p className="text-[10px] font-extrabold text-[#251045]">Full</p>
                      )}
                  </div>

                  {/* MONEY */}
                  <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-2">
                    <h3 className="text-[9px] text-[#251045]/40">
                      Money
                    </h3>
                    {campaignDetail.price === 0 ? (
                      <p className="text-[11px] text-[#251045]/60">
                        This is a free campaign. No money is collected.
                      </p>
                    ) : (
                      <>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[10px] text-[#251045]/60">Settled</span>
                          <span className="text-sm font-extrabold text-[#251045]">
                            {campaignDetail.metrics.currency}{' '}
                            {campaignDetail.metrics.revenueSettled.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[10px] text-[#251045]/60">Pending</span>
                          <span className="text-sm font-extrabold text-[#251045]">
                            {campaignDetail.metrics.currency}{' '}
                            {campaignDetail.metrics.revenuePending.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[9px] text-[#251045]/40 leading-snug">
                          Pending is money that has not arrived.
                        </p>
                      </>
                    )}
                  </div>

                  {/* CAMPAIGN */}
                  <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-1">
                    <h3 className="text-[9px] text-[#251045]/40">
                      Campaign
                    </h3>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-[#251045]/60">Page loads</span>
                      <span className="text-[11px] text-[#251045]/60">
                        {campaignDetail.metrics.views}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-[#251045]/60">Different devices</span>
                      <span className="text-[11px] text-[#251045]/60">
                        {campaignDetail.metrics.viewers === null
                          ? 'Not enough data'
                          : campaignDetail.metrics.viewers}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-[#251045]/60">Times you shared</span>
                      <span className="text-[11px] text-[#251045]/60">
                        {campaignDetail.metrics.shares}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-[#251045]/60">Started registering</span>
                      <span className="text-[11px] text-[#251045]/60">
                        {campaignDetail.metrics.registrationsStarted}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-[#251045]/60">Page load to registration</span>
                      <span className="text-[11px] text-[#251045]/60">
                        {campaignDetail.metrics.conversionPct === null
                          ? 'Not enough data'
                          : `${campaignDetail.metrics.conversionPct}%`}
                      </span>
                    </div>
                    <p className="text-[9px] text-[#251045]/40 leading-snug pt-1">
                      Different devices is a rough count, not people. Times you shared counts your own taps, not how many people saw it.
                    </p>
                  </div>

                  {/* WHAT PEOPLE ARE GETTING */}
                  {campaignDetail.object && (
                    <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-1">
                      <h3 className="text-[9px] text-[#251045]/40">
                        What people get
                      </h3>
                      <p className="text-xs text-[#251045]">{campaignDetail.object.title}</p>
                      {campaignDetail.object.summary && (
                        <p className="text-[10px] text-[#251045]/60 leading-snug">
                          {campaignDetail.object.summary}
                        </p>
                      )}
                      <p className="text-[9px] text-[#251045]/40 pt-0.5">
                        {campaignDetail.object.type}
                        {campaignDetail.ownsObject === false && ' \u00b7 existing item'}
                      </p>
                      {campaignDetail.ownsObject === false && (
                        <p className="text-[9px] text-[#251045]/40 leading-snug">
                          Publishing the campaign does not change it.
                        </p>
                      )}

                      {!objectPicker.open ? (
                        <button
                          disabled={campaignBusy}
                          onClick={loadAttachableObjects}
                          className="text-[10px] text-[#251045] underline underline-offset-2 cursor-pointer disabled:opacity-40 pt-1"
                        >
                          Link a different item
                        </button>
                      ) : (
                        <div className="bg-[#F1EDF7] border border-[#D6CFE4] rounded-xl p-2 space-y-1 max-h-44 overflow-y-auto mt-1">
                          {objectPicker.status === 'loading' && (
                            <p className="text-[11px] text-[#251045]/60 p-2">Loading your items...</p>
                          )}
                          {objectPicker.status === 'error' && (
                            <p className="text-[11px] text-[#251045] p-2">
                              Couldn't load your items. {objectPicker.error}
                            </p>
                          )}
                          {objectPicker.status === 'ready' &&
                            (objectPicker.data ?? []).length === 0 && (
                              <p className="text-[11px] text-[#251045]/60 p-2">
                                Nothing else to link yet.
                              </p>
                            )}
                          {objectPicker.status === 'ready' &&
                            (objectPicker.data ?? []).slice(0, 25).map((o: any) => (
                              <button
                                key={o.id}
                                disabled={campaignBusy}
                                onClick={() => attachObjectToCampaign(campaignDetail.id, o.id)}
                                className="w-full text-left px-2 py-2 rounded-lg hover:bg-[#FBFAFD] cursor-pointer disabled:opacity-40"
                              >
                                <p className="text-[11px] text-[#251045] truncate">{o.title}</p>
                                <p className="text-[9px] text-[#251045]/40">
                                  {o.type}
                                </p>
                              </button>
                            ))}
                          <button
                            onClick={() => setObjectPicker((p) => ({ ...p, open: false }))}
                            className="w-full text-[10px] text-[#251045]/60 py-1 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TARGET */}
                  {campaignCircle.status === 'loading' && (
                    <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-1">
                      <h3 className="text-[9px] text-[#251045]/40">
                        Target
                      </h3>
                      <p className="text-[11px] text-[#251045]/60">Loading target...</p>
                    </div>
                  )}

                  {campaignCircle.status === 'error' && (
                    <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-1">
                      <h3 className="text-[9px] text-[#251045]/40">
                        Target
                      </h3>
                      <p className="text-[11px] text-[#251045]">Target unavailable.</p>
                      <p className="text-[9px] text-[#251045]/60 break-words">
                        {campaignCircle.error}
                      </p>
                    </div>
                  )}

                  {campaignCircle.status === 'ready' &&
                    campaignCircle.data &&
                    !(
                      campaignCircle.data.circle.targetValue !== null &&
                      campaignCircle.data.circle.targetValue > 0
                    ) && (
                      <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-1">
                        <h3 className="text-[9px] text-[#251045]/40">
                          Target
                        </h3>
                        <p className="text-[11px] text-[#251045]">
                          {campaignCircle.data.circle.name}
                        </p>
                        <p className="text-[10px] text-[#251045]/60">
                          No target set on this circle.
                        </p>
                      </div>
                    )}

                  {campaignCircle.status === 'ready' &&
                    campaignCircle.data &&
                    campaignCircle.data.circle.targetValue !== null &&
                    campaignCircle.data.circle.targetValue > 0 && (
                      <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-2">
                        <h3 className="text-[9px] text-[#251045]/40">
                          Target
                        </h3>
                        <p className="text-xs text-[#251045]">
                          {campaignCircle.data.circle.goal || campaignCircle.data.circle.name}
                        </p>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-extrabold text-[#251045]">
                            {campaignCircle.data.circle.currentValue.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-[#251045]/40">
                            of {campaignCircle.data.circle.targetValue.toLocaleString()}
                          </span>
                        </div>
                        {campaignCircle.data.circle.progressPct !== null && (
                          <p className="text-[10px] text-[#251045]">
                            {Math.round(campaignCircle.data.circle.progressPct)}%
                          </p>
                        )}
                        <div className="h-1.5 rounded-full bg-[#D6CFE4] overflow-hidden">
                          <div
                            className="h-full bg-[#5B2EA6]"
                            style={{
                              width: `${Math.min(100, campaignCircle.data.circle.progressPct ?? 0)}%`
                            }}
                          />
                        </div>
                        <p className="text-[9px] text-[#251045]/40 leading-snug">
                          Progress comes from settled transactions in
                          {' '}{campaignCircle.data.circle.name}, not from this campaign.
                        </p>
                      </div>
                    )}

                  {/* POST AN UPDATE (T3): the organiser's words land on the
                      public page — the loop supporters read. */}
                  <div className="space-y-2">
                    <h3 className="text-[9px] text-[#251045]/40">
                      Post an update
                    </h3>
                    <input
                      value={updateTitle}
                      onChange={(e) => setUpdateTitle(e.target.value)}
                      placeholder="Update title (e.g. Halfway there)"
                      aria-label="update title"
                      className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                    />
                    <textarea
                      value={updateBody}
                      onChange={(e) => setUpdateBody(e.target.value)}
                      placeholder="What the people supporting this should know"
                      aria-label="update body"
                      rows={3}
                      className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none resize-none"
                    />
                    <button
                      type="button"
                      disabled={updateBusy || !updateTitle.trim() || !updateBody.trim()}
                      onClick={() => void postUpdate(campaignDetail.id)}
                      className="px-4 py-2 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] text-[11px] font-extrabold cursor-pointer disabled:opacity-40"
                    >
                      {updateBusy ? 'Posting…' : 'Post update'}
                    </button>
                    {updateNote && <p className="text-[10px] text-[#251045]/60 break-words">{updateNote}</p>}
                  </div>

                  {/* REGISTRATIONS */}
                  <div className="space-y-2">
                    <h3 className="text-[9px] text-[#251045]/40">
                      Registrations
                    </h3>

                    {campaignRegs.status === 'loading' && (
                      <p className="text-[11px] text-[#251045]/60">Loading people...</p>
                    )}

                    {campaignRegs.status === 'error' && (
                      <div className="border border-[#D6CFE4] bg-[#FBFAFD] rounded-xl p-3 space-y-1">
                        <p className="text-[11px] text-[#251045]">Couldn't load registrations.</p>
                        <p className="text-[9px] text-[#251045]/60 break-words">
                          {campaignRegs.error}
                        </p>
                      </div>
                    )}

                    {campaignRegs.status === 'ready' &&
                      (campaignRegs.data ?? []).length === 0 && (
                        <p className="text-[11px] text-[#251045]/60">
                          Nobody has registered yet.
                        </p>
                      )}

                    {campaignRegs.status === 'ready' && campaignDetail.price > 0 && (
                      <AwaitingPayment
                        registrations={campaignRegs.data ?? []}
                        currency={campaignDetail.metrics.currency}
                        price={campaignDetail.price}
                        busy={campaignBusy}
                        onConfirmPayment={(regId) => confirmPayment(campaignDetail.id, regId)}
                      />
                    )}

                    {campaignRegs.status === 'ready' &&
                      (campaignRegs.data ?? []).map((r) => (
                        <div
                          key={r.id}
                          className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-xl p-3 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs text-[#251045] truncate">
                              {r.name || r.attendeeRef}
                            </p>
                            <p className="text-[9px] text-[#251045]/40 mt-0.5">
                              {r.status.replace('_', ' ')}
                            </p>
                          </div>
                          {(r.status === 'registered' || r.status === 'confirmed') && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                disabled={campaignBusy}
                                onClick={() => setRegStatus(campaignDetail.id, r.id, 'checked_in')}
                                className="px-2.5 py-1.5 rounded-lg bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-[10px] cursor-pointer disabled:opacity-40"
                              >
                                Check in
                              </button>
                              <button
                                disabled={campaignBusy}
                                onClick={() => setRegStatus(campaignDetail.id, r.id, 'no_show')}
                                className="px-2.5 py-1.5 rounded-lg border border-[#D6CFE4] text-[#251045]/60 font-extrabold text-[10px] cursor-pointer disabled:opacity-40"
                              >
                                No-show
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>

                  {(campaignDetail.status === 'published' || campaignDetail.status === 'live') && (
                    <button
                      disabled={campaignBusy}
                      onClick={async () => {
                        setCampaignBusy(true);
                        const res = await briefApi.campaignAction(campaignDetail.id, 'close');
                        setCampaignBusy(false);
                        if (!res.ok) { setCampaignActionError(res.error); return; }
                        setCampaignDetail(res.data);
                        loadCampaigns();
                      }}
                      className="w-full py-2.5 rounded-xl border border-[#D6CFE4] text-[#251045]/60 font-extrabold text-[11px] cursor-pointer disabled:opacity-40"
                    >
                      Close campaign
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Sticky Action Footer */}
            {campaignDetail && editDraft && (
              <div className="p-4 pb-safe pb-8 sm:pb-4 border-t border-[#D6CFE4] bg-[#FBFAFD] shrink-0 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    disabled={campaignBusy}
                    onClick={() => setEditDraft(null)}
                    className="flex-1 py-3 rounded-xl border border-[#D6CFE4] text-[#251045] font-extrabold text-xs cursor-pointer disabled:opacity-40 hover:bg-[#F4F1FA] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={campaignBusy || editDraft.title.trim() === ''}
                    onClick={() => saveCampaignEdit(campaignDetail)}
                    className="flex-[2] py-3 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-xs cursor-pointer disabled:opacity-40 hover:bg-[#000000] transition-colors shadow-xs"
                  >
                    {campaignBusy ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <button
                  disabled={campaignBusy}
                  onClick={() => {
                    if (window.confirm('Cancel and remove this event?')) {
                      void handleRemoveCampaign(campaignDetail.id);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 font-extrabold text-[11px] cursor-pointer hover:bg-red-100 transition-colors disabled:opacity-40"
                >
                  Cancel & Remove Event
                </button>
              </div>
            )}

            {campaignDetail && !editDraft && (
              <div className="p-4 pb-safe pb-8 sm:pb-4 border-t border-[#D6CFE4] bg-[#FBFAFD] shrink-0 flex items-center gap-2">
                <button
                  disabled={campaignBusy}
                  onClick={() => {
                    if (window.confirm('Cancel and remove this event?')) {
                      void handleRemoveCampaign(campaignDetail.id);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 font-extrabold text-[11px] cursor-pointer hover:bg-red-100 transition-colors disabled:opacity-40"
                >
                  Cancel & Remove Event
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE CAMPAIGN. Type -> details -> preview -> publish. The preview
          is a screen, not a saved object: nothing reaches the server until
          Publish, and publication itself is the real transition endpoint. */}
      {createStep !== 'closed' && (
        <div
          className="fixed inset-0 z-50 bg-[#150826]/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overflow-hidden"
          onClick={() => { if (!campaignBusy) setCreateStep('closed'); }}
        >
          <div
            className="w-full max-w-lg max-h-[92vh] sm:max-h-[85vh] flex flex-col bg-[#FBFAFD] border border-[#D6CFE4] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden mb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-[#D6CFE4] shrink-0 flex items-start justify-between gap-3 bg-[#FBFAFD]">
              <h2 className="text-base font-extrabold text-[#251045]">
                {createStep === 'form'
                  ? 'Create'
                  : createStep === 'preview'
                  ? 'Preview'
                  : 'Published'}
              </h2>
              <button
                onClick={() => { if (!campaignBusy) setCreateStep('closed'); }}
                className="shrink-0 p-1.5 rounded-full hover:bg-[#E9E4F2] text-[#251045]/60 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
              {campaignActionError && (
                <div className="border border-red-200 bg-red-50 text-red-700 rounded-xl p-3">
                  <p className="text-[10px] font-bold break-words">
                    {campaignActionError}
                  </p>
                </div>
              )}

              {createStep === 'form' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">What is it</label>
                    <div className="flex flex-wrap gap-1.5">
                      {(['popup', 'session', 'drop', 'event'] as ApiCampaignType[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => setDraft((d) => ({ ...d, type: t }))}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold border cursor-pointer transition ${
                            draft.type === t
                              ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                              : 'bg-[#FBFAFD] text-[#251045] border-[#D6CFE4]'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">Title</label>
                    <input
                      value={draft.title}
                      onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                      placeholder="Saturday plant sale"
                      className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">Description</label>
                    <textarea
                      value={draft.description}
                      onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                      rows={2}
                      placeholder="One or two lines. What should people expect?"
                      className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">
                      What people get
                    </label>
                    {objectPicker.selected ? (
                      <div className="flex items-center justify-between gap-2 bg-[#FBFAFD] border border-[#D6CFE4] rounded-xl px-3 py-2.5">
                        <p className="text-xs text-[#251045] truncate">
                          {objectPicker.selected.title}
                        </p>
                        <button
                          onClick={() =>
                            setObjectPicker((p) => ({ ...p, selected: null, open: false }))
                          }
                          className="shrink-0 text-[10px] text-[#251045]/60 underline underline-offset-2 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ) : !objectPicker.open ? (
                      <button
                        onClick={loadAttachableObjects}
                        className="w-full text-left bg-[#FBFAFD] border border-dashed border-[#D6CFE4] rounded-xl px-3 py-2.5 text-[11px] text-[#251045]/60 cursor-pointer"
                      >
                        Something new &middot; tap to link an existing item instead
                      </button>
                    ) : (
                      <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-xl p-2 space-y-1 max-h-44 overflow-y-auto">
                        {objectPicker.status === 'loading' && (
                          <p className="text-[11px] text-[#251045]/60 p-2">Loading your items...</p>
                        )}
                        {objectPicker.status === 'error' && (
                          <p className="text-[11px] text-[#251045] p-2">
                            Couldn't load your items. {objectPicker.error}
                          </p>
                        )}
                        {objectPicker.status === 'ready' &&
                          (objectPicker.data ?? []).length === 0 && (
                            <p className="text-[11px] text-[#251045]/60 p-2">
                              Nothing to link yet. Carry on and describe it above.
                            </p>
                          )}
                        {objectPicker.status === 'ready' &&
                          (objectPicker.data ?? []).slice(0, 25).map((o: any) => (
                            <button
                              key={o.id}
                              onClick={() =>
                                setObjectPicker((p) => ({
                                  ...p,
                                  selected: { id: o.id, title: o.title },
                                  open: false
                                }))
                              }
                              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#FBFAFD] cursor-pointer"
                            >
                              <p className="text-[11px] text-[#251045] truncate">{o.title}</p>
                              <p className="text-[9px] text-[#251045]/40">
                                {o.type}
                              </p>
                            </button>
                          ))}
                        <button
                          onClick={() => setObjectPicker((p) => ({ ...p, open: false }))}
                          className="w-full text-[10px] text-[#251045]/40 underline underline-offset-2 cursor-pointer py-1"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">When</label>
                    <input
                      type="datetime-local"
                      value={draft.startsAt}
                      onChange={(e) => setDraft((d) => ({ ...d, startsAt: e.target.value }))}
                      className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">Where</label>
                    <input
                      value={draft.location}
                      onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
                      placeholder="Kilimani, Nairobi"
                      className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] text-[#251045]/40 mb-1">Spots</label>
                      <input
                        inputMode="numeric"
                        value={draft.capacity}
                        onChange={(e) => setDraft((d) => ({ ...d, capacity: e.target.value }))}
                        placeholder="Unlimited"
                        className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-[#251045]/40 mb-1">Price (KES)</label>
                      <input
                        inputMode="numeric"
                        value={draft.price}
                        onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                        placeholder="Free"
                        className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {createStep === 'preview' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-[#251045]/60">
                    This is what people will see. Nothing is public yet.
                  </p>
                  <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-1.5">
                    <p className="text-[9px] text-[#251045]/40">{draft.type}</p>
                    <p className="text-sm font-extrabold text-[#251045]">{draft.title}</p>
                    {draft.description && (
                      <p className="text-[11px] text-[#251045]/60 leading-snug">{draft.description}</p>
                    )}
                    <div className="pt-1 space-y-0.5">
                      {draft.startsAt && (
                        <p className="text-[10px] text-[#251045]">
                          {draft.startsAt.replace('T', ' ')}
                        </p>
                      )}
                      {draft.location && (
                        <p className="text-[10px] text-[#251045]">{draft.location}</p>
                      )}
                      <p className="text-[10px] text-[#251045]">
                        {draft.price.trim() === '' || Number(draft.price) === 0
                          ? 'Free'
                          : `KES ${draft.price}`}
                        {draft.capacity.trim() !== '' && ` \u00b7 ${draft.capacity} spots`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {createStep === 'published' && publishedCampaign && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#251045] shrink-0" />
                    <p className="text-xs font-extrabold text-[#251045]">
                      {publishedCampaign.title} is {publishedCampaign.status}
                    </p>
                  </div>
                  <p className="text-[11px] text-[#251045]/60">
                    Share this link anywhere. Anyone who opens it can register.
                  </p>
                  {(() => {
                    const link = briefApi.campaignShareLink(
                      publishedCampaign.publicSlug,
                      publicOrigin
                    );
                    return (
                      <CampaignDistribution
                        link={link}
                        title={publishedCampaign.title}
                        onCopy={() =>
                          copyCampaignLink(publishedCampaign.publicSlug, publishedCampaign.id)
                        }
                        onShare={(ch) => briefApi.shareCampaign(publishedCampaign.id, ch)}
                        onNativeShare={() => shareCampaign(publishedCampaign)}
                      />
                    );
                  })()}
                  <button
                    onClick={() => { setCreateStep('closed'); openCampaign(publishedCampaign.id); }}
                    className="w-full text-[10px] text-[#251045]/40 underline underline-offset-2 cursor-pointer"
                  >
                    Open campaign
                  </button>
                </div>
              )}
            </div>

            {/* Sticky Action Footer */}
            {createStep === 'form' && (
              <div className="p-4 pb-safe pb-8 sm:pb-4 border-t border-[#D6CFE4] bg-[#FBFAFD] shrink-0">
                <button
                  disabled={draft.title.trim() === ''}
                  onClick={() => { setCampaignActionError(null); setCreateStep('preview'); }}
                  className="w-full py-3 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#000000] transition-colors"
                >
                  Preview
                </button>
              </div>
            )}

            {createStep === 'preview' && (
              <div className="p-4 pb-safe pb-8 sm:pb-4 border-t border-[#D6CFE4] bg-[#FBFAFD] shrink-0 flex items-center gap-2">
                <button
                  disabled={campaignBusy}
                  onClick={() => setCreateStep('form')}
                  className="px-4 py-3 rounded-xl border border-[#D6CFE4] text-[#251045] font-extrabold text-xs cursor-pointer disabled:opacity-40 hover:bg-[#F4F1FA]"
                >
                  Back
                </button>
                <button
                  disabled={campaignBusy}
                  onClick={publishDraft}
                  className="flex-1 py-3 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-xs cursor-pointer disabled:opacity-40 hover:bg-[#000000]"
                >
                  {campaignBusy ? 'Publishing...' : 'Publish'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CAPTURE: the easiest way into Brief. Quick drop or direct post creation. */}
      {captureOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#150826]/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overflow-hidden"
          onClick={handleCaptureCancel}
        >
          <div
            className="w-full max-w-lg max-h-[92vh] sm:max-h-[85vh] flex flex-col bg-[#FBFAFD] border border-[#D6CFE4] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden mb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-[#D6CFE4] shrink-0 flex items-start justify-between gap-3 bg-[#FBFAFD]">
              <div>
                <h2 className="text-xl font-extrabold text-[#251045]">
                  {captureMode === 'quick' ? 'Drop something here.' : 'Create news or post.'}
                </h2>
                <p className="text-[11px] text-[#251045]/60 mt-1">
                  {captureMode === 'quick'
                    ? 'A message, link, listing, event, opportunity or anything worth keeping.'
                    : 'Publish updates, news bulletins, opportunities or stories directly into Brief.'}
                </p>
              </div>
              <button
                onClick={handleCaptureCancel}
                className="p-2 rounded-full bg-[#F1EDF7]/80 text-[#251045] border border-[#D6CFE4] shrink-0 hover:bg-[#E9E4F2] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 pb-safe pb-8 sm:pb-5">
              {/* Mode switcher */}
              <div className="flex rounded-xl bg-[#E9E4F2] p-1 gap-1">
                <button
                  type="button"
                  onClick={() => { setCaptureMode('quick'); setCapturePreview(null); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    captureMode === 'quick' ? 'bg-[#FBFAFD] text-[#251045] shadow-xs' : 'text-[#251045]/60 hover:text-[#251045]'
                  }`}
                >
                  Quick Capture
                </button>
                <button
                  type="button"
                  onClick={() => { setCaptureMode('direct'); setCapturePreview(null); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    captureMode === 'direct' ? 'bg-[#FBFAFD] text-[#251045] shadow-xs' : 'text-[#251045]/60 hover:text-[#251045]'
                  }`}
                >
                  Post News / Update
                </button>
              </div>

              {captureMode === 'quick' ? (
                <>
                  <textarea
                    value={captureText}
                    onChange={(e) => {
                      setCaptureText(e.target.value);
                      setCapturePreview(null);
                    }}
                    rows={5}
                    placeholder="Paste or type anything (e.g. news update, meetup announcement, listing...)"
                    className="w-full bg-[#FBFAFD] border border-[#D6CFE4] rounded-xl px-3 py-2.5 text-xs text-[#251045] placeholder:text-[#251045]/40 outline-none focus:border-[#6C3EC9] resize-none"
                  />

                  {!capturePreview && (
                    <button
                      onClick={handleCaptureParse}
                      disabled={captureText.trim() === ''}
                      className={`w-full py-3 rounded-xl font-extrabold text-xs transition ${
                        captureText.trim() === ''
                          ? 'bg-[#FBFAFD] text-[#251045]/40 cursor-not-allowed border border-[#D6CFE4]'
                          : 'bg-[#5B2EA6] text-[#FFFFFF] cursor-pointer hover:bg-[#000000]'
                      }`}
                    >
                      Read it
                    </button>
                  )}

                  {/* Confirmation step. Brief shows exactly what it understood and
                      waits -- nothing is saved until the user agrees. */}
                  {capturePreview && (
                    <div className="space-y-3">
                      {!capturePreview.isObjectWorthy ? (
                        <div className="border border-[#D6CFE4] bg-[#F1EDF7] rounded-xl p-3">
                          <p className="text-[11px] font-bold text-[#251045]">
                            Brief could not make an object from this.
                          </p>
                          <p className="text-[10px] text-[#251045]/60 mt-1">
                            {capturePreview.rejectionReason}
                          </p>
                          <p className="text-[10px] text-[#251045]/40 mt-1">
                            Nothing was saved.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setCaptureMode('direct');
                              setDirectTitle(captureText.slice(0, 60));
                            }}
                            className="mt-2.5 inline-flex items-center text-[11px] font-extrabold text-[#251045] underline cursor-pointer"
                          >
                            Create directly as news or post instead →
                          </button>
                        </div>
                      ) : (
                        <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-xl p-3 space-y-2">
                          <p className="text-[9px] text-[#251045] font-bold uppercase tracking-wider">
                            {getObjectTypeMeta(capturePreview.draft.type).label}
                          </p>
                          <p className="text-sm font-extrabold text-[#251045] leading-snug">
                            {capturePreview.draft.title}
                          </p>

                          {capturePreview.extracted
                            .filter((f) => f.field !== 'title')
                            .map((f) => (
                              <div
                                key={f.field}
                                className="flex items-baseline justify-between gap-3"
                              >
                                <span className="text-[10px] text-[#251045]/60">
                                  {f.field}
                                </span>
                                <span className="text-[10px] text-[#251045]/60 truncate">
                                  {f.value}
                                </span>
                              </div>
                            ))}

                          {capturePreview.duplicates.length > 0 && (
                            <p className="text-[10px] text-[#251045]">
                              Possible duplicate of{' '}
                              {capturePreview.duplicates[0].item.title}
                            </p>
                          )}

                          <p className="text-[9px] text-[#251045]/40">
                            Unverified. Saved as your own capture.
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={handleCaptureCancel}
                          className="flex-1 py-2.5 rounded-xl bg-[#FBFAFD] border border-[#D6CFE4] text-[#251045]/60 font-bold text-[11px] cursor-pointer"
                        >
                          Discard
                        </button>
                        {capturePreview.isObjectWorthy && (
                          <button
                            onClick={() => void handleCaptureConfirm()}
                            className="flex-[2] py-2.5 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-[11px] cursor-pointer hover:bg-[#000000]"
                          >
                            Save to Brief
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Direct Post / News Creation */
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#251045]/60 mb-1">
                      Post Type
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {([
                        ['knowledge', 'News / Bulletin', 'News'],
                        ['community', 'Community Post', 'Community'],
                        ['experience', 'Event / Meetup', 'Event'],
                        ['opportunity', 'Opportunity', 'Opportunity'],
                        ['service', 'Service Offer', 'Service']
                      ] as [ObjectType, string, string][]).map(([typeVal, label, catVal]) => (
                        <button
                          key={typeVal}
                          type="button"
                          onClick={() => {
                            setDirectType(typeVal);
                            setDirectCategory(catVal);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer border ${
                            directType === typeVal
                              ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                              : 'bg-[#F1EDF7] text-[#251045]/70 border-[#D6CFE4] hover:text-[#251045]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#251045]/60 mb-1">
                      Title / Headline <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={directTitle}
                      onChange={(e) => setDirectTitle(e.target.value)}
                      placeholder="e.g. Community Tech Meetup this Saturday"
                      className="w-full bg-[#FBFAFD] border border-[#D6CFE4] rounded-xl px-3 py-2 text-xs text-[#251045] placeholder:text-[#251045]/40 outline-none focus:border-[#6C3EC9]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#251045]/60 mb-1">
                      Post Details / Content <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={captureText}
                      onChange={(e) => setCaptureText(e.target.value)}
                      rows={4}
                      placeholder="Write your news or post details here..."
                      className="w-full bg-[#FBFAFD] border border-[#D6CFE4] rounded-xl px-3 py-2 text-xs text-[#251045] placeholder:text-[#251045]/40 outline-none focus:border-[#6C3EC9] resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#251045]/60 mb-1">
                      Location / Venue (Optional)
                    </label>
                    <input
                      type="text"
                      value={directLocation}
                      onChange={(e) => setDirectLocation(e.target.value)}
                      placeholder="e.g. Alchemist Bar, Westlands, Nairobi"
                      className="w-full bg-[#FBFAFD] border border-[#D6CFE4] rounded-xl px-3 py-2 text-xs text-[#251045] placeholder:text-[#251045]/40 outline-none focus:border-[#6C3EC9]"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCaptureCancel}
                      className="flex-1 py-2.5 rounded-xl bg-[#FBFAFD] border border-[#D6CFE4] text-[#251045]/60 font-bold text-[11px] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!directTitle.trim() || !captureText.trim()}
                      onClick={() => void handleDirectPost()}
                      className={`flex-[2] py-2.5 rounded-xl font-extrabold text-[11px] transition ${
                        !directTitle.trim() || !captureText.trim()
                          ? 'bg-[#D6CFE4] text-[#251045]/40 cursor-not-allowed'
                          : 'bg-[#5B2EA6] text-[#FFFFFF] cursor-pointer hover:bg-[#000000]'
                      }`}
                    >
                      Publish to Brief
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Package 3: the dynamic ticket bar — the active gate pass, locked to
          the bottom of the screen, with inline delta alerts. */}
      <TicketBar />

      {/* DETAIL LAYER */}
      {selectedTeaSlug && (
        <TeaReader slug={selectedTeaSlug} onClose={dismissOverlay} />
      )}

      {selectedObjectForDetail && (
        <div
          className="fixed inset-0 z-50 bg-[#150826]/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overflow-hidden"
          onClick={dismissOverlay}
        >
          <div
            className="w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-[#FBFAFD] border border-[#D6CFE4] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl mb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-y-auto flex-1 pb-safe pb-8 sm:pb-5">
              {/* Hero — the cover photo, or the first real gallery image when
                  a news story has photos but no cover. */}
              {(() => {
                const heroUrl = selectedObjectForDetail.imageUrl
                  ?? selectedObjectForDetail.gallery?.[0]?.url
                  ?? null;
                if (!heroUrl) return null;
                return (
                  <div className="relative h-56 sm:h-72">
                    <img
                      src={heroUrl}
                      alt={selectedObjectForDetail.title}
                      className="w-full h-full object-cover"
                    />

                    <button
                      onClick={() => setSelectedObjectForDetail(null)}
                      className="absolute top-4 right-4 p-2 rounded-full bg-[#F1EDF7]/80 text-[#251045] border border-[#D6CFE4]"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <div className="absolute bottom-4 left-4 flex gap-2">
                      <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-[#F1EDF7]/85 text-[#251045] border border-[#D6CFE4]">
                        {selectedObjectForDetail.category}
                      </span>

                      {selectedObjectForDetail.isVerified && (
                        <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-[#5B2EA6] text-[#FFFFFF]">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Gallery — the object's other REAL source photos, opened in a
                  new tab. Never fabricated; only rows the server projected. */}
              {(() => {
                const heroUrl = selectedObjectForDetail.imageUrl
                  ?? selectedObjectForDetail.gallery?.[0]?.url
                  ?? null;
                const rest = (selectedObjectForDetail.gallery ?? [])
                  .filter((img) => img.url !== heroUrl);
                if (rest.length === 0) return null;
                return (
                  <div className="grid grid-cols-3 gap-2 px-5 pt-4">
                    {rest.slice(0, 6).map((img) => (
                      <a
                        key={img.url}
                        href={img.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={img.alt ?? 'Photo'}
                        className="block aspect-square overflow-hidden rounded-xl border border-[#D6CFE4] transition-transform hover:scale-[1.02]"
                      >
                        <img
                          src={img.url}
                          alt={img.alt ?? ''}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                );
              })()}

              {/* Without a hero image the close button and chips disappeared
                  entirely, leaving backdrop-click as the only way out. This is
                  the same control set, laid out for an imageless record. */}
              {!selectedObjectForDetail.imageUrl && !selectedObjectForDetail.gallery?.[0]?.url && (
                <div className="flex items-center justify-between gap-2 p-4 border-b border-[#D6CFE4]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-[#F1EDF7]/85 text-[#251045] border border-[#D6CFE4]">
                      {selectedObjectForDetail.category}
                    </span>

                    {selectedObjectForDetail.isVerified && (
                      <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-[#5B2EA6] text-[#FFFFFF]">
                        Verified
                      </span>
                    )}
                  </div>

                  <button
                    onClick={dismissOverlay}
                    className="p-2 rounded-full bg-[#F1EDF7]/80 text-[#251045] border border-[#D6CFE4]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Details */}
              <div className="p-5 space-y-5">

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] text-[#251045]/60">
                      {getObjectTypeMeta(selectedObjectForDetail.type).label}
                    </span>
                  </div>

                  <h2 className="text-2xl font-extrabold text-[#251045]">
                    {selectedObjectForDetail.title}
                  </h2>

                  <p className="text-sm text-[#251045] mt-2 leading-relaxed">
                    {selectedObjectForDetail.summary}
                  </p>

                  {/* News detail — publisher, publication time, relevant
                      location, and the prominent "Read original" action.
                      Headline + concise summary only: the full article lives
                      at the original link, never reproduced here. */}
                  {selectedObjectForDetail.type === 'news' && (
                    <div className="mt-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-[#251045]/60">
                        {(() => {
                          const publisher = selectedObjectForDetail.sourceNames?.[0]
                            ?? (selectedObjectForDetail.sourceCount
                              ? `${selectedObjectForDetail.sourceCount} ${selectedObjectForDetail.sourceCount === 1 ? 'source' : 'sources'}`
                              : null);
                          if (!publisher) return null;
                          return <span>From {publisher}</span>;
                        })()}
                        {(() => {
                          const stamp = selectedObjectForDetail.publishedAt
                            ?? selectedObjectForDetail.createdAt;
                          const published = getPublishedLine(selectedObjectForDetail);
                          if (!stamp) return null;
                          const d = new Date(stamp);
                          if (!Number.isFinite(d.getTime())) return null;
                          const absolute = d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
                          return (
                            <span>
                              {published ? `${published} · ` : ''}{absolute}
                            </span>
                          );
                        })()}
                        {(() => {
                          const place = selectedObjectForDetail.locationName
                            ?? selectedObjectForDetail.metadata?.area
                            ?? selectedObjectForDetail.metadata?.county;
                          if (!place) return null;
                          return <span>· {place}</span>;
                        })()}
                      </div>

                      {(() => {
                        const readUrl = selectedObjectForDetail.sourceUrl
                          ?? (selectedObjectForDetail.actionType === 'external'
                            ? selectedObjectForDetail.actionUrl
                            : null);
                        if (!readUrl) return null;
                        return (
                          <a
                            href={readUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-full bg-[#5B2EA6] px-5 py-2.5 text-[12px] font-extrabold text-[#FFFFFF] transition-opacity hover:opacity-90"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Read original
                          </a>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Facts -- generated from metadata, empty fields omitted */}
                {(() => {
                  const facts = buildKeyFacts(selectedObjectForDetail);
                  if (facts.length === 0) return null;
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      {facts.map((fact) => (
                        <div
                          key={fact.key}
                          className="bg-[#F1EDF7] border border-[#D6CFE4] rounded-xl p-3"
                        >
                          <div className="text-[10px] text-[#251045]/60">
                            {fact.label}
                          </div>
                          <div className="text-xs font-bold mt-1">
                            {fact.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Location & contact */}
                {(selectedObjectForDetail.locationName ||
                  selectedObjectForDetail.creatorName ||
                  selectedObjectForDetail.metadata?.contactPhone) && (
                  <div className="bg-[#F1EDF7] border border-[#D6CFE4] rounded-xl p-3 space-y-3">
                    {selectedObjectForDetail.locationName && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-[#251045] shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-[#251045]/60">
                            Location
                          </div>
                          <div className="text-xs font-bold">
                            {selectedObjectForDetail.locationName}
                          </div>
                          {resolveAction(selectedObjectForDetail).kind !== 'map' && (
                            <a
                              href={buildMapsHref(
                                selectedObjectForDetail.locationName
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#251045] mt-1 hover:underline"
                            >
                              Open in Maps
                              <ArrowRight className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedObjectForDetail.creatorName && (
                      <div className="flex items-start gap-2">
                        <User className="w-4 h-4 text-[#251045] shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-[#251045]/60">
                            {selectedObjectForDetail.type === 'product'
                              ? 'Seller'
                              : selectedObjectForDetail.type === 'service'
                              ? 'Provider'
                              : selectedObjectForDetail.type === 'opportunity'
                              ? 'Offered by'
                              : 'Listed by'}
                          </div>
                          <div className="text-xs font-bold">
                            {selectedObjectForDetail.creatorName}
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedObjectForDetail.metadata?.contactPhone && (
                      <div className="flex items-start gap-2">
                        <Building2 className="w-4 h-4 text-[#251045] shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-[#251045]/60">
                            Contact
                          </div>
                          <a
                            href={buildTelHref(
                              selectedObjectForDetail.metadata.contactPhone
                            )}
                            className="text-xs font-bold text-[#251045] hover:underline"
                          >
                            {selectedObjectForDetail.metadata.contactPhone}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* About this information (trust layer). One quiet block
                    answering: who said this, how recently, across how many
                    sources, is it still current, and has it been corrected.
                    Corroboration is shown as corroboration — never as truth. */}
                {(() => {
                  const subject = selectedObjectForDetail;
                  const fresh = getFreshness(subject);
                  const sourceChip = getSourceChip(subject);
                  const sourceKind = getSourceKindChip(subject);
                  const corroboration = getCorroborationLabel(subject);
                  const published = getPublishedLine(subject);
                  const life = getLifecycleBadge(subject);
                  const corrections = Array.isArray(subject.corrections) && subject.corrections.length > 0
                    ? subject.corrections
                    : null;
                  const hasTrust =
                    subject.isVerified ||
                    Boolean(fresh) ||
                    Boolean(subject.sourceUrl) ||
                    Boolean(sourceChip) ||
                    Boolean(published) ||
                    Boolean(corroboration) ||
                    Boolean(life) ||
                    Boolean(corrections) ||
                    (subject.openReportCount ?? 0) > 0;

                  if (!hasTrust) return null;

                  const CORRECTION_LABELS: Record<string, string> = {
                    title: 'Title',
                    type: 'Type',
                    summary: 'Summary',
                    category: 'Category',
                    locationName: 'Location',
                    venue: 'Venue',
                    organizer: 'Organizer',
                    dateCanonical: 'Date',
                    eventStart: 'Start time',
                    eventEnd: 'End time',
                    deadlineCanonical: 'Deadline',
                    operatingHours: 'Hours',
                    price: 'Price',
                    statusBadge: 'Status'
                  };

                  return (
                    <div className="bg-[#F1EDF7] border border-[#D6CFE4] rounded-xl px-4 py-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#251045] shrink-0" />
                        <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#251045]/60">
                          About this information
                        </span>
                        {subject.isVerified && (
                          <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[#5B2EA6] text-[#FFFFFF] shrink-0">
                            VERIFIED
                          </span>
                        )}
                      </div>

                      {/* Provider — stated when known, absence stated plainly. */}
                      <p className="text-[10px] font-bold text-[#251045]/70">
                        {subject.creatorName ? `Provider: ${subject.creatorName}` : 'Provider not stated'}
                      </p>

                      {/* Source — real names, never internal ids. */}
                      {subject.sourceNames && subject.sourceNames.length > 0 && (
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-bold text-[#251045]/80 truncate">
                            From {subject.sourceNames.slice(0, 3).join(', ')}
                          </span>
                          {sourceKind && (
                            <span className="shrink-0 rounded-full bg-[#FBFAFD] border border-[#D6CFE4] px-1.5 py-0.5 text-[8px] font-bold text-[#251045]/50">
                              {sourceKind}
                            </span>
                          )}
                          {sourceChip && sourceChip !== `Source · ${subject.sourceNames[0]}` && (
                            <span className="shrink-0 text-[9px] font-bold text-[#251045]/40">
                              {sourceChip}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Published — publication age, separate from event time. */}
                      {published && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-bold text-[#251045]/70">
                            {published}
                          </span>
                          <span className="text-[10px] text-[#251045]/40">
                            {new Date(subject.publishedAt ?? subject.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      )}

                      {/* Verification freshness — when this was last checked. */}
                      {fresh && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-bold text-[#251045]/70">
                            {fresh.label}
                          </span>
                          <span className="text-[10px] text-[#251045]/40">
                            checked {fresh.verifiedOn}
                          </span>
                        </div>
                      )}

                      {/* Corroboration — a count, explicitly not certainty. */}
                      {corroboration && (
                        <p className="text-[10px] font-bold text-[#251045]/70">
                          {corroboration}
                        </p>
                      )}

                      {/* Current status for time-sensitive content. */}
                      {life && (
                        <p className={`text-[10px] font-extrabold ${life.expired ? 'text-[#8A1E2D]' : 'text-[#251045]/70'}`}>
                          {life.label}
                        </p>
                      )}

                      {/* Operator corrections: original fact + corrected value. */}
                      {corrections && (
                        <div className="space-y-1 border-t border-[#D6CFE4]/70 pt-2">
                          {corrections.map((c) => (
                            <p key={c.id} className="text-[10px] text-[#251045]/70 leading-snug">
                              Corrected {CORRECTION_LABELS[c.field] ?? c.field}
                              {c.originalValue !== null && c.originalValue !== c.correctedValue
                                ? <> — was “{c.originalValue}”, now “{c.correctedValue}”</>
                                : <> to “{c.correctedValue}”</>}
                            </p>
                          ))}
                        </div>
                      )}

                      {/* Under review: an open user report flags this object. */}
                      {(subject.openReportCount ?? 0) > 0 && (
                        <p className="text-[10px] font-bold text-[#8A1E2D]">
                          Reported for review
                        </p>
                      )}

                      <p className="text-[10px] text-[#251045]/40 leading-snug">
                        Verification records when this was last checked. It is
                        not a guarantee of accuracy.
                      </p>

                      {subject.sourceUrl && (
                        <a
                          href={subject.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#251045] underline underline-offset-2"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Source
                        </a>
                      )}
                    </div>
                  );
                })()}

                {/* "You can..." (prompt 8). Only actions the data supports. */}
                {(() => {
                  const suggestions = getSuggestedActions(selectedObjectForDetail);
                  const extras = suggestions.filter((a) => a.kind !== 'primary');
                  if (extras.length === 0) return null;

                  return (
                    <div className="space-y-2">
                      <p className="text-[10px] text-[#251045]/40">
                        You can
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {extras.map((a) => (
                          <a
                            key={a.key}
                            href={a.href}
                            target={a.key === 'call' ? undefined : '_blank'}
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-[#FBFAFD] border border-[#D6CFE4] text-[#251045]"
                          >
                            {a.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Actions */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        handleExecuteProtocolAction(
                          'save',
                          selectedObjectForDetail
                        )
                      }
                      className="flex-1 py-3 rounded-xl bg-[#FBFAFD] border border-[#D6CFE4] text-[#251045] font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Bookmark className="w-4 h-4" />
                      Save
                    </button>

                    {(() => {
                      const action = resolveAction(selectedObjectForDetail);
                      const primaryClass =
                        'flex-[2] py-3 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer';

                      // Stays in Brief: pivot the stream sideways.
                      if (action.kind === 'internal') {
                        return (
                          <button
                            onClick={() =>
                              handlePivotToType(selectedObjectForDetail)
                            }
                            className={primaryClass}
                          >
                            {action.label}
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        );
                      }

                      // Real destination -> real link.
                      if (action.kind !== 'none') {
                        const newTab = action.kind !== 'phone';
                        return (
                          <a
                            href={action.href}
                            target={newTab ? '_blank' : undefined}
                            rel={newTab ? 'noopener noreferrer' : undefined}
                            onClick={() =>
                              handleExecuteProtocolAction(
                                action.kind === 'phone' ? 'contact' : 'discover',
                                selectedObjectForDetail,
                                { silent: true }
                              )
                            }
                            className={primaryClass}
                          >
                            {action.label}
                            <ArrowRight className="w-4 h-4" />
                          </a>
                        );
                      }

                      // No route -> say so plainly. Don't fake a transaction.
                      return (
                        <div className="flex-[2] py-3 rounded-xl bg-[#FBFAFD] border border-dashed border-[#D6CFE4] text-[#251045]/60 font-extrabold text-xs flex items-center justify-center gap-2">
                          {action.label} unavailable
                        </div>
                      );
                    })()}
                  </div>

                  <p className="text-[10px] text-[#251045]/60 text-center">
                    {getActionNote(selectedObjectForDetail)}
                  </p>

                  {/* Secondary doors (prompts 11/18/21). Subordinate to the
                      primary action, and only rendered where data supports
                      them. Watch records intent; it does not poll anything. */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleShare(selectedObjectForDetail)}
                      className="flex-1 py-2.5 rounded-xl bg-[#FBFAFD] border border-[#D6CFE4] text-[#251045]/60 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Share
                    </button>

                    <button
                      onClick={() =>
                        handleCreatePursuit(selectedObjectForDetail.title)
                      }
                      className="flex-1 py-2.5 rounded-xl bg-[#FBFAFD] border border-[#D6CFE4] text-[#251045]/60 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5" />
                      Pursue
                    </button>

                    <button
                      onClick={() => handleToggleWatch(selectedObjectForDetail)}
                      className={`flex-1 py-2.5 rounded-xl border font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer ${
                        watchedIds.has(selectedObjectForDetail.id)
                          ? 'bg-[#FBFAFD] border-[#D6CFE4] text-[#251045]'
                          : 'bg-[#FBFAFD] border-[#D6CFE4] text-[#251045]/60'
                      }`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {watchedIds.has(selectedObjectForDetail.id) ? 'Watching' : 'Watch'}
                    </button>

                    <button
                      onClick={() => setCollectionPickerFor(selectedObjectForDetail.id)}
                      className="flex-1 py-2.5 rounded-xl bg-[#FBFAFD] border border-[#6C3EC9]/50 text-[#5B2EA6] font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      Add to collection
                    </button>
                  </div>

                  {/* Add-to-collection picker (Collections brief). Renders
                      inside the object modal so organizing never leaves the
                      object. */}
                  {collectionPickerFor === selectedObjectForDetail.id && (
                    <div className="mt-3">
                      <CollectionPicker
                        objectId={selectedObjectForDetail.id}
                        onChanged={() => void loadPersonal()}
                      />
                    </div>
                  )}

                  {/* §8: the crowd-checking row. Confirm says "I know this is
                      true"; report says "this is wrong" with a reason. Both
                      are real server records, not local flags. */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void handleConfirmObject(selectedObjectForDetail)}
                      disabled={objectCheckBusy === selectedObjectForDetail.id}
                      className="flex-1 min-w-fit py-2.5 rounded-xl bg-[#FBFAFD] border border-[#D6CFE4] text-[#251045]/70 font-bold text-[11px] cursor-pointer disabled:opacity-50"
                    >
                      {objectCheckBusy === selectedObjectForDetail.id ? 'Recording…' : '✓ I can confirm this'}
                    </button>
                    <button
                      onClick={() => setReportForObject(reportForObject === selectedObjectForDetail.id ? null : selectedObjectForDetail.id)}
                      className="flex-1 min-w-fit py-2.5 rounded-xl bg-[#FBFAFD] border border-[#D6CFE4] text-[#251045]/50 font-bold text-[11px] cursor-pointer"
                    >
                      Report
                    </button>
                  </div>
                  {reportForObject === selectedObjectForDetail.id && (
                    <div className="flex flex-wrap gap-1.5">
                      {REPORT_REASONS.map((reason) => (
                        <button
                          key={reason.id}
                          onClick={() => void handleReportObject(selectedObjectForDetail, reason.id)}
                          disabled={objectCheckBusy === selectedObjectForDetail.id}
                          className="px-3 py-1.5 rounded-full border border-[#D6CFE4] text-[11px] font-bold text-[#251045]/70 cursor-pointer disabled:opacity-50"
                        >
                          {reason.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {watchedIds.has(selectedObjectForDetail.id) && (
                    <p className="text-[10px] text-[#251045]/40 text-center">
                      Brief will track changes to this record. Alerts are not live yet.
                    </p>
                  )}

                  {/* Personal Brief tuning — explicit controls the user said
                      out loud, persisted, always reversible. Shown only for a
                      signed-in caller with the personal layer loaded. */}
                  {sessionUser && personalState && (() => {
                    const rel = personalState.relevance;
                    const { sourceId: detailSourceId } = selectedObjectForDetail;
                    const buttons: { kind: 'more' | 'less' | 'not_interested' | 'hide_source'; label: string; active: boolean }[] = [
                      { kind: 'more', label: 'More like this', active: rel.more.includes(selectedObjectForDetail.id) },
                      { kind: 'less', label: 'Less like this', active: rel.less.includes(selectedObjectForDetail.id) },
                      { kind: 'not_interested', label: 'Not interested', active: rel.notInterested.includes(selectedObjectForDetail.id) },
                      ...(detailSourceId
                        ? [{ kind: 'hide_source' as const, label: 'Hide this source', active: rel.hiddenSources.includes(detailSourceId) }]
                        : [])
                    ];
                    if (buttons.length === 0) return null;
                    return (
                      <div className="border-t border-[#D6CFE4]/70 pt-3 mt-1">
                        <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#251045]/40 mb-2">
                          Tune this in your Brief
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {buttons.map((b) => (
                            <button
                              key={b.kind}
                              onClick={() => void tuneObject(b.kind, selectedObjectForDetail)}
                              className={`px-2.5 py-1.5 rounded-full border text-[10px] font-bold cursor-pointer transition ${
                                b.active
                                  ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                                  : 'bg-[#FBFAFD] text-[#251045]/60 border-[#D6CFE4] hover:border-[#6C3EC9]'
                              }`}
                            >
                              {b.active ? `✓ ${b.label}` : b.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Why this appeared (prompt 7). Every reason is computed
                    from real state, so none of them can be untrue. */}
                {(() => {
                  const reasons = getAppearanceReasons(selectedObjectForDetail, {
                    pursuits,
                    pursuitResults,
                    savedIds: savedIdSet,
                    watchedIds,
                    relatedToSavedIds
                  });
                  if (reasons.length === 0) return null;

                  return (
                    <details className="group">
                      <summary className="text-[10px] text-[#251045]/40 cursor-pointer list-none">
                        Why this appeared
                      </summary>
                      <div className="mt-2 space-y-1">
                        {reasons.map((r) => (
                          <p key={r.key} className="text-[10px] text-[#251045]/60">
                            {r.label}
                          </p>
                        ))}
                      </div>
                    </details>
                  );
                })()}

                {/* LOCAL ACTIVITY GRAPH — related content for this object.
                    Every section is a REAL relationship (structured venue /
                    organizer / business fields, provenance, or persisted
                    relationship rows); the server never keyword-matches and
                    weak links never serialize. The location edge links into
                    the public /explore/:name surface. */}
                {detailGraph && (
                  <div className="mt-6 pt-5 border-t border-[#D6CFE4]">
                    <RelatedContent
                      edges={detailGraph}
                      onOpenObject={(raw) => {
                        if (!raw?.id) return;
                        const local = objects.find((o) => o.id === String(raw.id));
                        setSelectedObjectForDetail(local ?? objectFromServer(raw));
                      }}
                      onOpenLocation={openLocationPage}
                    />
                  </div>
                )}


                {/* WHAT'S HERE (rework 4/5). The destination detail becomes a
                    mini directory: who is trading, what they sell, and a hop
                    into each vendor. Everything is read from stated graph
                    edges; when a destination has no linked vendors we say so
                    rather than inventing a line-up. */}
                {isDestinationObject(selectedObjectForDetail) && (() => {
                  const dest = selectedObjectForDetail;
                  const vendors = getDestinationVendors(dest, objects);
                  const state = getDestinationState(dest);
                  const access = getDestinationAccess(dest);
                  return (
                    <div className="mt-6 pt-5 border-t border-[#D6CFE4]">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                          <p className="text-[10px] text-[#251045]">
                            {DESTINATION_STATE_LABELS[state]}
                          </p>
                          <h3 className="text-sm font-extrabold mt-1">
                            What's here
                          </h3>
                        </div>
                        {access && (
                          <span className="text-[9px] font-extrabold text-[#251045] border border-[#D6CFE4] rounded-full px-2 py-0.5">
                            {access}
                          </span>
                        )}
                      </div>

                      {vendors.length === 0 ? (
                        <p className="text-xs text-[#251045]/60">
                          Vendor information unavailable. Brief only lists
                          traders that are actually linked to this destination.
                        </p>
                      ) : (
                        <>
                          <p className="text-[11px] text-[#251045] mb-2">
                            {vendors.length}{' '}
                            {vendors.length === 1 ? 'vendor' : 'vendors'} listed
                            here
                          </p>
                          <div className="space-y-2">
                            {vendors.map((vendor) => {
                              const offerings = getVendorOfferings(vendor, objects);
                              return (
                                <div
                                  key={vendor.id}
                                  className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-3"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs font-extrabold text-[#251045] truncate">
                                          {vendor.title}
                                        </p>
                                        {vendor.isVerified && (
                                          <span className="shrink-0 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#5B2EA6] text-[#FFFFFF]">
                                            VERIFIED
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[10px] text-[#251045]/60 mt-0.5">
                                        {vendor.category}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => setSelectedObjectForDetail(vendor)}
                                      className="shrink-0 text-[10px] font-extrabold text-[#251045] cursor-pointer"
                                    >
                                      View vendor
                                    </button>
                                  </div>

                                  {/* What they sell, only where real records exist. */}
                                  {offerings.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {offerings.map((item) => (
                                        <button
                                          key={item.id}
                                          onClick={() => setSelectedObjectForDetail(item)}
                                          className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
                                        >
                                          <span className="text-[10px] text-[#251045] truncate">
                                            {item.title}
                                          </span>
                                          {typeof item.metadata?.price === 'number' && (
                                            <span className="shrink-0 text-[10px] text-[#251045]">
                                              {item.metadata.currency || 'KES'}{' '}
                                              {item.metadata.price.toLocaleString()}
                                            </span>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* VENDOR VIEW (rework 6/7). Opening an identity shows what
                    it sells and where it can be found, so a trader discovered
                    at one popup leads to the next one instead of a dead end.
                    Contact routes through the object's own stated action --
                    Brief never invents a phone number or a shop URL. */}
                {selectedObjectForDetail.type === 'identity' && (() => {
                  const vendor = selectedObjectForDetail;
                  const offerings = getVendorOfferings(vendor, objects);
                  const appearsAt = getVendorDestinations(vendor, objects);
                  if (offerings.length === 0 && appearsAt.length === 0) return null;
                  return (
                    <div className="mt-6 pt-5 border-t border-[#D6CFE4]">
                      {appearsAt.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[10px] text-[#251045]">
                            Find them at
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {appearsAt.map((dest) => {
                              const state = getDestinationState(dest);
                              return (
                                <button
                                  key={dest.id}
                                  onClick={() => setSelectedObjectForDetail(dest)}
                                  className="w-full text-left bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-3 cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    {(state === 'live' || state === 'today') && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#5B2EA6] shrink-0" />
                                    )}
                                    <span className="text-xs text-[#251045] truncate">
                                      {dest.title}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-[#251045]/40">
                                    {DESTINATION_STATE_LABELS[state]}
                                    {dest.locationName ? ` - ${dest.locationName}` : ''}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {offerings.length > 0 && (
                        <div>
                          <p className="text-[10px] text-[#251045]">
                            What they offer
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {offerings.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => setSelectedObjectForDetail(item)}
                                className="w-full flex items-center justify-between gap-3 bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-3 text-left cursor-pointer"
                              >
                                <span className="min-w-0">
                                  <span className="block text-xs text-[#251045] truncate">
                                    {item.title}
                                  </span>
                                  <span className="block text-[9px] text-[#251045]/40">
                                    {item.category}
                                  </span>
                                </span>
                                {typeof item.metadata?.price === 'number' && (
                                  <span className="shrink-0 text-[11px] font-extrabold text-[#251045]">
                                    {item.metadata.currency || 'KES'}{' '}
                                    {item.metadata.price.toLocaleString()}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Related */}
                {relatedObjects.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-[#D6CFE4]">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-[10px] text-[#251045]">
                          Continue exploring
                        </p>
                        <h3 className="text-sm font-extrabold mt-1">
                          {getRelatedHeading(
                            selectedObjectForDetail,
                            relatedObjects
                          )}
                        </h3>
                      </div>

                      <span className="text-[10px] text-[#251045]/60 shrink-0">
                        {relatedObjects.length} nearby
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {relatedObjects.map(({ item: related, reason }) => {
                        const chip = getReasonChip(reason);
                        const distance = getDistanceLabel(related);

                        return (
                          <button
                            key={related.id}
                            onClick={() => setSelectedObjectForDetail(related)}
                            className="text-left bg-[#F1EDF7] border border-[#D6CFE4] hover:border-[#6C3EC9] rounded-xl p-3 transition group cursor-pointer"
                          >
                            <div className="flex items-start gap-3">
                              {related.imageUrl && (
                                <img
                                  src={related.imageUrl}
                                  alt=""
                                  className="w-14 h-14 rounded-lg object-cover shrink-0"
                                />
                              )}

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-[9px] text-[#251045]/60">
                                    {related.category}
                                  </p>
                                  {chip && (
                                    <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full border border-[#D6CFE4] text-[#251045]">
                                      {chip}
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs font-extrabold mt-1 line-clamp-2 group-hover:text-[#251045]">
                                  {related.title}
                                </p>

                                {related.locationName && (
                                  <p className="text-[10px] text-[#251045] mt-1 truncate">
                                    {related.locationName}
                                  </p>
                                )}

                                {distance && (
                                  <p className="text-[10px] text-[#251045]/60 mt-0.5">
                                    {distance}
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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

      <MenuSheet
        open={menuOpen}
        onClose={dismissOverlay}
        onSelect={handleMenuSelect}
        onSelectCity={chooseCity}
        selectedLocation={selectedLocation}
        canOperate={briefApi.isOperator(sessionUser)}
      />
      <AdminDesk open={adminOpen} onClose={dismissOverlay} me={sessionUser} />

      {/* ENTITY LAYER — the followable entity page and the Following surface. */}
      {entityPageId && (
        <EntityPage
          entityId={entityPageId}
          authed={Boolean(sessionUser)}
          origin={publicOrigin}
          onClose={dismissOverlay}
          onOpenObject={(raw) => {
            if (!raw?.id) return;
            const local = objects.find((o) => o.id === String(raw.id));
            setSelectedObjectForDetail(local ?? objectFromServer(raw));
          }}
          onOpenLocation={openLocationPage}
          onRequireAuth={() => showToast('Sign in to follow this.')}
          onFollowChanged={() => void loadPersonal()}
        />
      )}
      {followingOpen && (
        <FollowingSurface
          authed={Boolean(sessionUser)}
          onClose={dismissOverlay}
          onOpenObject={(raw) => {
            if (!raw?.id) return;
            const local = objects.find((o) => o.id === String(raw.id));
            setSelectedObjectForDetail(local ?? objectFromServer(raw));
          }}
          onOpenEntity={(id) => {
            setFollowingOpen(false);
            setEntityPageId(id);
          }}
          onRequireAuth={() => showToast('Sign in to follow this.')}
          onFollowChanged={() => void loadPersonal()}
        />
      )}

      {/* LOCAL ACTIVITY GRAPH — the public location discovery page. */}
      {locationName && (
        <LocationPage
          name={locationName}
          authed={Boolean(sessionUser)}
          followedLocations={personalState?.interests?.locations ?? []}
          onClose={dismissOverlay}
          onOpenObject={(raw) => {
            if (!raw?.id) return;
            const local = objects.find((o) => o.id === String(raw.id));
            setSelectedObjectForDetail(local ?? objectFromServer(raw));
          }}
          onOpenLocation={openLocationPage}
          onRequireAuth={() => showToast('Sign in to follow this area.')}
          onFollowLocation={(loc) => {
            if (!sessionUser) { showToast('Sign in to follow this area.'); return; }
            void followOne('location', loc);
          }}
        />
      )}

      {/* COLLECTIONS — the personal layer. The surface opens from the header;
          a shared /collections/:id link renders the public page directly. */}
      {collectionsOpen && (
        <CollectionsSurface
          authed={Boolean(sessionUser)}
          savedCount={(personalState?.saved ?? []).length}
          onClose={dismissOverlay}
          onOpenObject={(raw) => {
            if (!raw?.id) return;
            const local = objects.find((o) => o.id === String(raw.id));
            setSelectedObjectForDetail(local ?? objectFromServer(raw));
          }}
          onOpenSaved={() => {
            setCollectionsOpen(false);
            setActiveTab('mylayer');
            setMyLayerSection('saved');
          }}
          onChanged={() => void loadPersonal()}
        />
      )}
      {collectionRouteId && (
        <CollectionPage
          collectionId={collectionRouteId}
          mode="public"
          onClose={dismissOverlay}
          onOpenObject={(raw) => {
            if (!raw?.id) return;
            const local = objects.find((o) => o.id === String(raw.id));
            setSelectedObjectForDetail(local ?? objectFromServer(raw));
          }}
        />
      )}
      <footer className="border-t border-[#D6CFE4] mt-12 py-6 text-xs text-[#251045]/60 text-center">
        Everything Happening Around You
      </footer>

    </div>
  );
}

export default App;
