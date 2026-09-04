import React, { useCallback, useMemo, useState } from 'react';
import { Bell, ArrowRight, Bookmark, FolderPlus, Heart, Newspaper, Plus, Search, ShieldCheck, Users, X, Sparkles } from 'lucide-react';
import * as briefApi from '../api/briefApi';
import { DESTINATION_STATE_LABELS, TEA_EDITIONS, briefWhenLabel, entityChipsFor, formatCount, getCardLevel, getDestinationState, getDestinationVendors, getDistanceLabel, getEditionMeta, getLifecycleBadge, getObjectTypeMeta, getPostKindMeta, getPublishedLine, getRelativeTime, getSourceChip, isDestinationObject, objectFromServer, resolveAction , buildDiscoveryBrief, buildPersonalSections, getCurrentEdition } from '../model/core';
import type { ObjectType , PursuitStatus, WatchCondition } from '../model/core';
import type { BriefPost } from '../model/core';
import { FILTERS, HOME_MORE } from '../ui/names';
import { showsLadder } from '../components/ladder';
import { EntityChip } from '../components/EntityChip';
import { EventsHub } from '../components/EventsHub';
import { FeedComposer } from '../components/FeedComposer';
import { LocationChip } from '../components/LocationChip';
import { MainShelf } from '../components/MainShelf';
import { Marketplace } from '../components/Marketplace';
import { MoneyBand } from '../components/MoneyBand';
import { MshikanoDesk } from '../components/MshikanoDesk';
import { NextStep } from '../components/NextStep';
import { Pursuits } from '../components/Pursuits';
import { Quests } from '../components/Quests';
import { SearchResults } from '../components/SearchResults';
import { TickerBanner } from '../components/SignalBanner';
import { TodayOpportunities } from '../components/home/TodayOpportunities';
import { CommitteeDesk } from '../components/life/CommitteeDesk';
import { WellbeingDesk } from '../components/wellbeing/WellbeingDesk';
import { BriefAiAssistant } from '../components/ai/BriefAiAssistant';
import { CivicKnowledgeGuide } from '../components/civic/CivicKnowledgeGuide';
import { ChamaDesk } from '../components/circle/ChamaDesk';
import { InterCountyDesk } from '../components/wairo/InterCountyDesk';
import { PrivateCarrierAuctionDesk } from '../components/wairo/PrivateCarrierAuctionDesk';
import { OfflineSyncQueueDesk } from '../components/offline/OfflineSyncQueueDesk';
import { UniversalCreatePostModal } from '../components/posts/UniversalCreatePostModal';
import { DiscoverScreen } from './DiscoverScreen';
import { BriefBuilderSection, WairoBookmark } from '../components/ui';
import { soundEngine } from '../utils/SoundEngine';
import type { BriefObject, Destination, NearbySection, Pursuit, Quest, TeaEdition, WorkflowSection } from '../model/core';
import type { AuthedUser, PersonalState } from '../api/briefApi';
import type { GeoPoint } from '../components/LocationChip';

// ---------------------------------------------------------------------------
// NEARBY SCREEN -- extracted from App.tsx (Phase 1: JSX move; shell keeps the
// state, colocation pass tightens types afterwards). Section switching is
// verbatim; what each section renders did not change.
// ---------------------------------------------------------------------------

export interface NearbyScreenProps {
  boardMode: 'contributors' | 'earners';
  discoveryTab: 'home' | 'events' | 'explore' | 'offers' | 'places' | 'news' | 'opportunities';
  feedReload: number;
  moreFilters: boolean;
  pursuitDraft: string;
  setBoardMode: React.Dispatch<React.SetStateAction<'contributors' | 'earners'>>;
  setDiscoveryTab: React.Dispatch<React.SetStateAction<'home' | 'events' | 'explore' | 'offers' | 'places' | 'news' | 'opportunities'>>;
  setFeedReload: React.Dispatch<React.SetStateAction<number>>;
  setMoreFilters: React.Dispatch<React.SetStateAction<boolean>>;
  setPursuitDraft: React.Dispatch<React.SetStateAction<string>>;
  personalFeedIds: string[] | null;
  personalBoostMap: Record<string, { boost: number; reasons: string[] }>;
  setFeedArea: React.Dispatch<React.SetStateAction<string | null>>;
  setLocError: React.Dispatch<React.SetStateAction<string | null>>;
  setPursuits: React.Dispatch<React.SetStateAction<Pursuit[]>>;
  setSelectedLocation: React.Dispatch<React.SetStateAction<string>>;
  setUserLocation: React.Dispatch<React.SetStateAction<GeoPoint | null>>;
  activeEdition: TeaEdition;
  activeTab: Destination;
  chooseCity: any;
  dailyBrief: any;
  editionPosts: any;
  feedArea: string | null;
  filteredObjects: any;
  followOne: any;
  handleCreatePursuit: any;
  handleExecuteProtocolAction: any;
  handleMenuSelect: any;
  handleSubmitQuest: any;
  homeFeedStatus: 'loading' | 'ready' | 'unavailable';
  ladder: any;
  likedPostIds: string[];
  locError: string | null;
  locate: any;
  locating: any;
  nearbySection: NearbySection;
  nextStepHidden: any;
  noteActivation: any;
  objects: BriefObject[];
  openEntityPage: any;
  openPostSubject: any;
posts: BriefPost[];
    personalBriefDismissed: any;
  personalBusy: any;
  personalHasInterests: any;
  personalInterests: any;
  personalPicks: { locations: string[]; types: string[]; topics: string[] };
  personalSavedGroups: any;
  personalState: briefApi.PersonalState | null;
  pursuitResults: any;
  pursuits: Pursuit[];
  quests: Quest[];
  runtimeCheck: 'checking' | 'current' | 'old' | 'unavailable';
  savePersonalBrief: any;
  searchQuery: string;
  selectedLocation: string;
  selectedObjectType: string;
  sessionUser: briefApi.AuthedUser | null;
  setActiveEdition: React.Dispatch<React.SetStateAction<TeaEdition>>;
  setActiveTab: React.Dispatch<React.SetStateAction<Destination>>;
  setCaptureOpen: any;
  setCollectionsOpen: any;
  notificationsOpen: any;
  notifUnread: any;
  setNotificationsOpen: any;
  setFirstRunOpen: any;
  setFollowingOpen: any;
  setHomeFeedStatus: React.Dispatch<React.SetStateAction<'loading' | 'ready' | 'unavailable'>>;
  setNearbySection: React.Dispatch<React.SetStateAction<NearbySection>>;
  setNextStepHidden: any;
  setPersonalBriefDismissed: any;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setSelectedObjectForDetail: any;
  setSelectedObjectType: React.Dispatch<React.SetStateAction<string>>;
  setSelectedTeaSlug: React.Dispatch<React.SetStateAction<string | null>>;
  setWorkflowSection: React.Dispatch<React.SetStateAction<WorkflowSection>>;
  setWorkflowView: React.Dispatch<React.SetStateAction<'queue' | 'screen'>>;
  showToast: any;
  toggleLike: any;
  togglePersonalPick: any;
  unfollowEntityOne: any;
  unfollowOne: any;
  userLocation: GeoPoint | null;
}

export function NearbyScreen(props: NearbyScreenProps) {
  const {
    posts,

    activeEdition,
    activeTab,
    chooseCity,
    dailyBrief,
    editionPosts,
    feedArea,
    filteredObjects,
    followOne,
    handleCreatePursuit,
    handleExecuteProtocolAction,
    handleMenuSelect,
    handleSubmitQuest,
    homeFeedStatus,
    ladder,
    likedPostIds,
    locError,
    locate,
    locating,
    nearbySection,
    nextStepHidden,
    noteActivation,
    objects,
    openEntityPage,
    openPostSubject,
    personalBriefDismissed,
    personalBusy,
    personalHasInterests,
    personalInterests,
    personalPicks,
    personalSavedGroups,
    personalState,
    pursuitResults,
    pursuits,
    quests,
    runtimeCheck,
    savePersonalBrief,
    searchQuery,
    selectedLocation,
    selectedObjectType,
    sessionUser,
    setActiveEdition,
    setActiveTab,
    setCaptureOpen,
    setCollectionsOpen,
    notificationsOpen,
    notifUnread,
    setNotificationsOpen,
    setFirstRunOpen,
    setFollowingOpen,
    setHomeFeedStatus,
    setNearbySection,
    setNextStepHidden,
    setPersonalBriefDismissed,
    setSearchQuery,
    setSelectedObjectForDetail,
    setSelectedObjectType,
    setSelectedTeaSlug,
    setWorkflowSection,
    setWorkflowView,
    showToast,
    toggleLike,
    togglePersonalPick,
    unfollowEntityOne,
    unfollowOne,
    userLocation,
    setFeedArea,
    setLocError,
    setPursuits,
    setSelectedLocation,
    setUserLocation,
    personalFeedIds,
    personalBoostMap,
    boardMode,
    discoveryTab,
    feedReload,
    moreFilters,
    pursuitDraft,
    setBoardMode,
    setDiscoveryTab,
    setFeedReload,
    setMoreFilters,
    setPursuitDraft,
  } = props;

  // -- colocated from App (ownership pass) -----------------

  // §14 — recent searches: real, user's own queries, persisted locally. Never
  // seeded with fake "popular" terms.
  const RECENT_KEY = 'brief.recentSearches.v1';
  const [recentSearches, setRecentSearches] = React.useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string').slice(0, 6) : [];
    } catch { return []; }
  });
  const [searchFocused, setSearchFocused] = React.useState(false);
  const [committeeOpen, setCommitteeOpen] = useState(false);
  const [chamaOpen, setChamaOpen] = useState(false);
  const [wellbeingOpen, setWellbeingOpen] = useState(false);
  const [briefAiOpen, setBriefAiOpen] = useState(false);
  const [civicGuideOpen, setCivicGuideOpen] = useState(false);
  const [interCountyOpen, setInterCountyOpen] = useState(false);
  const [carrierAuctionOpen, setCarrierAuctionOpen] = useState(false);
  const [offlineSyncOpen, setOfflineSyncOpen] = useState(false);
  const [createPostModalOpen, setCreatePostModalOpen] = useState(false);
  const [discoverViewOpen, setDiscoverViewOpen] = useState(false);

  const commitRecentSearch = React.useCallback((term: string) => {
    const t = term.trim();
    if (!t) return;
    setRecentSearches((prev) => {
      const next = [t, ...prev.filter((p) => p.toLowerCase() !== t.toLowerCase())].slice(0, 6);
      try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  }, []);

  // Nearby categories — derived from the REAL objects in the current feed,
  // most frequent first. Nothing invented; the chips only appear when data
  // actually has categories.
  const nearbyCategories = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of objects) {
      const c = (o as any).category;
      if (typeof c === 'string' && c.trim()) counts.set(c.trim(), (counts.get(c.trim()) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 8);
  }, [objects]);

  const clearLocation = React.useCallback(() => {
    setLocError(null);
    setUserLocation(null);
    setFeedArea(null);
    setSelectedLocation('Your area');
  }, []);



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


  const openQuests = useMemo(
    () => quests.filter((q) => q.status === 'open'),
    [quests]
  );

  const discoveryBrief = useMemo(
    () =>
      buildDiscoveryBrief({
        objects,
        area: feedArea,
        geo: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null
      }),
    [objects, feedArea, userLocation]
  );

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

  const personalSections = useMemo(() => {
    if (!personalOrdered || personalOrdered.length === 0) return [];
    return buildPersonalSections({
      ordered: personalOrdered,
      interests: personalInterests,
      topics: personalState?.topics ?? [],
      personalized: personalHasInterests
    });
  }, [personalOrdered, personalInterests, personalState, personalHasInterests]);

  const availableTypes = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of objects) counts[o.type] = (counts[o.type] ?? 0) + 1;
    return Object.keys(counts) as ObjectType[];
  }, [objects]);

  const liveEdition = getCurrentEdition();

  return (
    <>
{ (
          <div className="max-w-5xl mx-auto px-0 sm:px-4 pt-2">
            <div className="mb-5">
              <div className="flex items-center justify-between gap-3 px-1 pb-3">
                <div className="flex min-w-0 items-center gap-3">
                  {sessionUser && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('mylayer')}
                      aria-label="Your profile"
                      title="Your profile"
                      className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E8EC] bg-gradient-to-br from-[#FF5A1F] to-[#2563EB] text-[13px] font-black text-[#0D1117] shadow-md cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0"
                    >
                      {(sessionUser.displayName || sessionUser.handle || '?').charAt(0).toUpperCase()}
                    </button>
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7A8494]">Around you</p>
                    <h1 className="truncate font-display text-xl font-semibold leading-tight tracking-tight text-[#0D1117] sm:text-2xl">Home</h1>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { soundEngine.play('tap'); setDiscoverViewOpen(true); }}
                    className="px-3 py-1.5 rounded-xl bg-[#0B6E6E] hover:bg-[#14919B] text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm cursor-pointer transition-all active:scale-95"
                    title="Open 3D Discover View"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#E8985E]" />
                    <span>Discover</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { soundEngine.play('heavyTap'); setCreatePostModalOpen(true); }}
                    className="px-3 py-1.5 rounded-xl bg-[#0D1117] hover:bg-[#1E293B] text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm cursor-pointer transition-all active:scale-95"
                    title="Publish Event, Product or Announcement"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#FF5A1F]" />
                    <span>Post</span>
                  </button>

                  <LocationChip
                    label={selectedLocation}
                    locating={locating}
                    locError={locError}
                    hasLocation={Boolean(userLocation)}
                    onLocate={locate}
                    onSelectCity={chooseCity}
                    onClearLocation={clearLocation}
                  />
                </div>
              </div>
              {runtimeCheck === 'old' && (
                <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-[#2563EB] bg-[#FFFFFF] px-4 py-3">
                  <div>
                    <p className="text-[11px] font-extrabold text-[#0D1117]">Update needed before testing</p>
                    <p className="mt-1 text-[10px] leading-snug text-[#0D1117]/60">This app is newer than the API behind it. Deploy the current server so gallery, banner, and news checks use the same contract.</p>
                  </div>
                  <button type="button" onClick={() => window.location.reload()} className="shrink-0 rounded-lg bg-[#FF5A1F] px-3 py-2 text-[10px] font-extrabold text-[#0D1117]">Refresh</button>
                </div>
              )}
              {runtimeCheck === 'unavailable' && (
                <div className="mb-3 rounded-2xl border border-dashed border-[#E5E8EC] bg-[#FFFFFF] px-4 py-3">
                  <p className="text-[11px] font-extrabold text-[#0D1117]">Live services are not reachable</p>
                  <p className="mt-1 text-[10px] leading-snug text-[#0D1117]/60">The shelf still works as navigation, but live news and create actions will wait for the API. No placeholder counts are shown.</p>
                </div>
              )}
              {nearbySection === 'stream' && (
                <>
                  {/* The ladder's one card: the rung they are on and the
                      single thing that opens the next one. Home only — Saved
                      and Actions stay quiet. */}
                  {!nextStepHidden && showsLadder('nearby') && (
                    <div className="mb-3">
                      <NextStep
                        ladder={ladder}
                        onDismiss={() => setNextStepHidden(true)}
                        onAct={(rungId) => {
                          if (rungId === 'identity' || rungId === 'orient') {
                            setFirstRunOpen(true);
                            return;
                          }
                          if (rungId === 'value') {
                            setActiveTab('nearby');
                            setNearbySection('stream');
                            return;
                          }
                          if (rungId === 'contribute') {
                            setCaptureOpen(true);
                            return;
                          }
                          setActiveTab('workflows');
                          setWorkflowSection('campaigns');
                          setWorkflowView('screen');
                        }}
                      />
                    </div>
                  )}

                  {/* ================= TODAY'S OPPORTUNITIES STRIP ================= */}
                  {discoveryTab === 'home' && (
                    <div className="mb-6">
                      <TodayOpportunities
                        onSelectOpportunity={(opp) => {
                          if (opp.category === 'gigs' || opp.category === 'grants') {
                            setSelectedObjectType('opportunity');
                            setDiscoveryTab('opportunities');
                          } else if (opp.category === 'arena') {
                            setSelectedObjectType('experience');
                            setDiscoveryTab('events');
                          } else if (opp.category === 'learning') {
                            setBriefAiOpen(true);
                          } else if (opp.category === 'thrift') {
                            setSelectedObjectType('product');
                            setDiscoveryTab('explore');
                          } else if (opp.category === 'events') {
                            setSelectedObjectType('experience');
                            setDiscoveryTab('events');
                          }
                        }}
                      />
                    </div>
                  )}

                  {/* ================= TOWN CENTRE DISTRICTS & HUBS ================= */}
                  {discoveryTab === 'home' && (
                    <section className="mb-6 space-y-2.5" aria-label="Town Centre Districts">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#00BFEF] animate-pulse" />
                          <h3 className="text-xs font-black uppercase tracking-[0.16em] text-[#0D1117]">
                            Town Centre Districts & Services
                          </h3>
                        </div>
                        <span className="text-[10px] font-mono text-gray-500 font-bold">4 Live Hubs</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                        <button
                          type="button"
                          onClick={() => { soundEngine.play('heavyTap'); setCommitteeOpen(true); }}
                          className="p-3.5 rounded-2xl bg-gradient-to-br from-[#1E293B] to-[#0F172A] text-left text-white shadow-sm hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xl">🕊️</span>
                            <span className="text-[8px] font-mono uppercase bg-white/10 px-1.5 py-0.5 rounded text-white font-bold">
                              72% Funded
                            </span>
                          </div>
                          <div className="mt-2">
                            <span className="font-black text-xs block text-white leading-tight">Life-Events Hub</span>
                            <span className="text-[10px] text-gray-400 block mt-0.5">Burial & Harambee</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => { soundEngine.play('heavyTap'); setChamaOpen(true); }}
                          className="p-3.5 rounded-2xl bg-gradient-to-br from-[#311042] to-[#1E092B] text-left text-white shadow-sm hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xl">🌸</span>
                            <span className="text-[8px] font-mono uppercase bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-bold">
                              Cycle 5 (KES 60k)
                            </span>
                          </div>
                          <div className="mt-2">
                            <span className="font-black text-xs block text-white leading-tight">Chama & Table Bank</span>
                            <span className="text-[10px] text-purple-200/70 block mt-0.5">Merry-Go-Round</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => { soundEngine.play('heavyTap'); setWellbeingOpen(true); }}
                          className="p-3.5 rounded-2xl bg-gradient-to-br from-[#064E3B] to-[#022C22] text-left text-white shadow-sm hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xl">💚</span>
                            <span className="text-[8px] font-mono uppercase bg-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                              Confidential
                            </span>
                          </div>
                          <div className="mt-2">
                            <span className="font-black text-xs block text-white leading-tight">Wellbeing Hub</span>
                            <span className="text-[10px] text-emerald-200/70 block mt-0.5">Circles & Therapists</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => { soundEngine.play('heavyTap'); setInterCountyOpen(true); }}
                          className="p-3.5 rounded-2xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0A101D] text-left text-white shadow-sm hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xl">🚚</span>
                            <span className="text-[8px] font-mono uppercase bg-[#00BFEF] text-[#0D1117] px-1.5 py-0.5 rounded font-black">
                              4-County Hub
                            </span>
                          </div>
                          <div className="mt-2">
                            <span className="font-black text-xs block text-white leading-tight">Inter-County Cargo</span>
                            <span className="text-[10px] text-cyan-200/70 block mt-0.5">Mombasa • Kisumu</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => { soundEngine.play('heavyTap'); setBriefAiOpen(true); }}
                          className="p-3.5 rounded-2xl bg-gradient-to-br from-[#7C2D12] to-[#431407] text-left text-white shadow-sm hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xl">🤖</span>
                            <span className="text-[8px] font-mono uppercase bg-[#FF5A1F] text-white px-1.5 py-0.5 rounded font-bold">
                              The Mayor
                            </span>
                          </div>
                          <div className="mt-2">
                            <span className="font-black text-xs block text-white leading-tight">Town Concierge</span>
                            <span className="text-[10px] text-orange-200/70 block mt-0.5">Local Guide</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => { soundEngine.play('heavyTap'); setCivicGuideOpen(true); }}
                          className="p-3.5 rounded-2xl bg-gradient-to-br from-[#1E1B4B] to-[#0F0E2A] text-left text-white shadow-sm hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xl">🏛️</span>
                            <span className="text-[8px] font-mono uppercase bg-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded font-bold">
                              Verified
                            </span>
                          </div>
                          <div className="mt-2">
                            <span className="font-black text-xs block text-white leading-tight">Civic Guides</span>
                            <span className="text-[10px] text-indigo-200/70 block mt-0.5">Permits & Licenses</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => { soundEngine.play('heavyTap'); setCarrierAuctionOpen(true); }}
                          className="p-3.5 rounded-2xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0B1B2A] text-left text-white shadow-sm hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xl">⚖️</span>
                            <span className="text-[8px] font-mono uppercase bg-[#2563EB] text-white px-1.5 py-0.5 rounded font-bold">
                              Silent Bids
                            </span>
                          </div>
                          <div className="mt-2">
                            <span className="font-black text-xs block text-white leading-tight">Carrier Auction</span>
                            <span className="text-[10px] text-blue-200/70 block mt-0.5">Math Match Engine</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => { soundEngine.play('heavyTap'); setOfflineSyncOpen(true); }}
                          className="p-3.5 rounded-2xl bg-gradient-to-br from-[#064E3B] via-[#042F2E] to-[#022C22] text-left text-white shadow-sm hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xl">📡</span>
                            <span className="text-[8px] font-mono uppercase bg-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                              IndexedDB
                            </span>
                          </div>
                          <div className="mt-2">
                            <span className="font-black text-xs block text-white leading-tight">Offline PWA Sync</span>
                            <span className="text-[10px] text-emerald-200/70 block mt-0.5">Zero-Data Queue</span>
                          </div>
                        </button>
                      </div>
                    </section>
                  )}

                  <MainShelf
                    onSelect={handleMenuSelect}
                    ladder={ladder}
                    onLocked={(info) => {
                      noteActivation('service_locked_tapped', { card: info.cardId, requires: info.requires });
                      showToast(info.unlocksAfter ? `Opens after: ${info.unlocksAfter}` : 'Not open yet');
                    }}
                  />
                  {/* No demo seeding on Home: when production data is thin the
                      FeedComposer below renders honest, contextual empty
                      states — the no-fake-live-data rule. */}
                  {/* MY BRIEF — the personal daily-city-briefing layer. The
                      SAME persisted objects, re-ranked per user; sections
                      render only when real data backs them; onboarding is
                      skippable and never blocks the Brief. */}
                  {discoveryTab === 'home' && sessionUser && personalState && (
                    <section className="mb-8" aria-label="My Brief">
                      <BriefBuilderSection
                        initialCities={personalPicks.locations.length > 0 ? personalPicks.locations : ['Machakos', 'Kilimani', 'Westlands']}
                        initialInterests={personalPicks.topics.length > 0 ? personalPicks.topics : ['Jobs', 'Food', 'Experience']}
                        initialExpanded={!personalHasInterests && !personalBriefDismissed}
                        followedCount={(personalState.followed ?? []).length}
                        updatesCount={notifUnread}
                        onCityToggle={(city) => togglePersonalPick('locations', city)}
                        onInterestToggle={(interest) => {
                          const lc = interest.toLowerCase();
                          if (['experience', 'offer', 'place', 'event', 'opportunity'].includes(lc)) {
                            togglePersonalPick('types', lc);
                          } else {
                            togglePersonalPick('topics', interest);
                          }
                        }}
                        onSkip={() => setPersonalBriefDismissed(true)}
                        onBuildBrief={({ cities, interests }) => {
                          cities.forEach(c => { if (!personalPicks.locations.includes(c)) togglePersonalPick('locations', c); });
                          interests.forEach(i => {
                            const lc = i.toLowerCase();
                            if (['experience', 'offer', 'place', 'event', 'opportunity'].includes(lc)) {
                              if (!personalPicks.types.includes(lc)) togglePersonalPick('types', lc);
                            } else {
                              if (!personalPicks.topics.includes(i)) togglePersonalPick('topics', i);
                            }
                          });
                          void savePersonalBrief();
                        }}
                        onOpenCollections={() => setCollectionsOpen(true)}
                        onOpenFollowing={() => setFollowingOpen(true)}
                        onOpenUpdates={() => setNotificationsOpen(true)}
                      />

                      {!personalHasInterests && personalBriefDismissed && (
                        <p className="rounded-2xl border border-dashed border-[#E5E8EC] px-4 py-3 text-[11px] text-[#0D1117]/70 mt-3">
                          Your Brief is global until you follow places or topics.{' '}
                          <button
                            type="button"
                            onClick={() => setPersonalBriefDismissed(false)}
                            className="font-extrabold text-[#FF5A1F] cursor-pointer"
                          >
                            Personalize
                          </button>
                        </p>
                      )}

                      {/* FOLLOWING — the chips you follow, each with an
                          obvious unfollow; plus quick-adds for what is left. */}
                      {personalHasInterests && (
                        <div className="mb-4 flex flex-wrap items-center gap-1.5">
                          {personalInterests.locations.map((loc: any) => (
                            <button
                              key={`loc_${loc}`}
                              type="button"
                              onClick={() => void unfollowOne('location', loc)}
                              title={`Stop following ${loc}`}
                              className="flex items-center gap-1 rounded-full bg-[#FF5A1F] px-3 py-1.5 text-[11px] font-extrabold text-[#0D1117] cursor-pointer"
                            >
                              {loc} <X className="h-3 w-3" />
                            </button>
                          ))}
                          {personalInterests.types.map((t: any) => (
                            <button
                              key={`typ_${t}`}
                              type="button"
                              onClick={() => void unfollowOne('type', t)}
                              title={`Stop following ${getObjectTypeMeta(t as ObjectType).label}`}
                              className="flex items-center gap-1 rounded-full border border-[#2563EB] bg-[#F0F2F5] px-3 py-1.5 text-[11px] font-extrabold text-[#FF5A1F] cursor-pointer"
                            >
                              {getObjectTypeMeta(t as ObjectType).label} <X className="h-3 w-3" />
                            </button>
                          ))}
                          {personalInterests.topics.map((topicId: any) => {
                            const topic = personalState.topics.find((t: any) => t.id === topicId);
                            if (!topic) return null;
                            return (
                              <button
                                key={`top_${topicId}`}
                                type="button"
                                onClick={() => void unfollowOne('topic', topicId)}
                                title={`Stop following ${topic.label}`}
                                className="flex items-center gap-1 rounded-full border border-[#2563EB] bg-[#F0F2F5] px-3 py-1.5 text-[11px] font-extrabold text-[#FF5A1F] cursor-pointer"
                              >
                                {topic.label} <X className="h-3 w-3" />
                              </button>
                            );
                          })}
                          {(personalState.followed ?? []).map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => openEntityPage(f.id)}
                              title={`Open ${f.name}`}
                              className="flex items-center gap-1 rounded-full border border-[#2563EB] bg-[#EFF1F4] px-3 py-1.5 text-[11px] font-extrabold text-[#FF5A1F] cursor-pointer"
                            >
                              {f.name}
                            </button>
                          ))}
                          {(personalState.followed ?? []).map((f) => (
                            <button
                              key={`unf_${f.id}`}
                              type="button"
                              onClick={() => void unfollowEntityOne(f.id)}
                              title={`Stop following ${f.name}`}
                              className="flex items-center gap-1 rounded-full border border-dashed border-[#E5E8EC] px-2 py-1 text-[9px] font-bold text-[#0D1117]/60 cursor-pointer hover:border-[#DC2626] hover:text-[#DC2626]"
                            >
                              <X className="h-2.5 w-2.5" /> {f.kind}
                            </button>
                          ))}
                          {personalState.suggestedLocations
                            .filter((loc: any) => !personalInterests.locations.includes(loc))
                            .slice(0, 5)
                            .map((loc: any) => (
                              <button
                                key={`add_${loc}`}
                                type="button"
                                onClick={() => void followOne('location', loc)}
                                className="flex items-center gap-1 rounded-full border border-dashed border-[#E5E8EC] px-3 py-1.5 text-[11px] font-bold text-[#0D1117]/60 cursor-pointer hover:border-[#2563EB]"
                              >
                                <Plus className="h-3 w-3" /> {loc}
                              </button>
                            ))}
                          {availableTypes
                            .filter((t: any) => !personalInterests.types.includes(t))
                            .slice(0, 3)
                            .map((t: any) => (
                              <button
                                key={`addt_${t}`}
                                type="button"
                                onClick={() => void followOne('type', t)}
                                className="flex items-center gap-1 rounded-full border border-dashed border-[#E5E8EC] px-3 py-1.5 text-[11px] font-bold text-[#0D1117]/60 cursor-pointer hover:border-[#2563EB]"
                              >
                                <Plus className="h-3 w-3" /> {getObjectTypeMeta(t).label}
                              </button>
                            ))}
                        </div>
                      )}

                      {/* PERSONAL SECTIONS — YOUR BRIEF / AROUND YOU / TODAY /
                          COMING UP / FOR YOU. Only non-empty sections render,
                          and every row is a real persisted object. */}
                      {personalSections.length > 0 && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {personalSections.map((section: any) => (
                            <div
                              key={section.key}
                              className="rounded-2xl border border-[#E5E8EC] bg-[#FFFFFF] p-3"
                            >
                              <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#0D1117]/70">
                                {section.title}
                              </p>
                              <div className="mt-2 space-y-0.5">
                                {section.objects.slice(0, 4).map((obj: any) => (
                                  <button
                                    key={obj.id}
                                    type="button"
                                    onClick={() => setSelectedObjectForDetail(obj)}
                                    className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-[#EFF1F4] cursor-pointer"
                                  >
                                    {obj.imageUrl ? (
                                      <img
                                        src={obj.imageUrl}
                                        alt=""
                                        aria-hidden="true"
                                        loading="lazy"
                                        className="h-9 w-9 shrink-0 rounded-lg object-cover"
                                      />
                                    ) : (
                                      <span
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[15px]"
                                        style={{ background: '#F0F2F5', color: '#2563EB' }}
                                        aria-hidden="true"
                                      >
                                        {getObjectTypeMeta(obj.type).label.charAt(0)}
                                      </span>
                                    )}
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-[12px] font-semibold text-[#0D1117]">
                                        {obj.title}
                                      </span>
                                      {briefWhenLabel(obj) && (
                                        <span className="block truncate text-[9px] font-semibold text-[#0D1117]/55">
                                          {briefWhenLabel(obj)}
                                        </span>
                                      )}
                                      <span className="mt-0.5 flex flex-wrap gap-1">
                                        {entityChipsFor(obj).slice(0, 2).map((chip, ci) => (
                                          <EntityChip
                                            key={`${chip.kind}_${chip.name ?? chip.directId}_${ci}`}
                                            kind={chip.kind}
                                            name={chip.name}
                                            directId={chip.directId}
                                            onOpenEntity={openEntityPage}
                                          />
                                        ))}
                                      </span>
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* SAVED — grouped Upcoming / Active / News / Places /
                          Offers. Expired rows read as expired, never active. */}
                      {personalSavedGroups.length > 0 && (
                        <div className="mt-4 rounded-2xl border border-[#E5E8EC] bg-[#FFFFFF] p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <Bookmark className="h-3.5 w-3.5 text-[#0D1117]/60" />
                            <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#0D1117]/70">
                              Saved
                            </p>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            {personalSavedGroups.map((group: any) => (
                              <div key={group.key}>
                                <p className="text-[10px] font-extrabold text-[#0D1117]/70">
                                  {group.title}
                                  <span className="ml-1.5 text-[10px] font-bold text-[#0D1117]/60">
                                    {group.items.length + group.expired.length}
                                  </span>
                                </p>
                                <div className="mt-1.5 space-y-0.5">
                                  {group.items.slice(0, 3).map((obj: any) => (
                                    <button
                                      key={obj.id}
                                      type="button"
                                      onClick={() => setSelectedObjectForDetail(obj)}
                                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[#EFF1F4] cursor-pointer"
                                    >
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[11px] font-semibold text-[#0D1117]">
                                          {obj.title}
                                        </span>
                                        {briefWhenLabel(obj) && (
                                          <span className="block truncate text-[9px] font-semibold text-[#0D1117]/70">
                                            {briefWhenLabel(obj)}
                                          </span>
                                        )}
                                      </span>
                                    </button>
                                  ))}
                                  {group.expired.slice(0, 3).map((obj: any) => (
                                    <button
                                      key={obj.id}
                                      type="button"
                                      onClick={() => setSelectedObjectForDetail(obj)}
                                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[#EFF1F4] cursor-pointer opacity-60"
                                    >
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[11px] font-semibold text-[#0D1117] line-through">
                                          {obj.title}
                                        </span>
                                        <span className="block truncate text-[9px] font-bold text-[#FF5A1F]">
                                          Expired
                                        </span>
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>
                  )}

                  {/* TODAY'S BRIEF — the compact discovery summary: TODAY /
                      NEAR YOU / NOW / COMING UP, every row a real persisted
                      object. Only rendered when it has data. */}
                  {discoveryTab === 'home' && discoveryBrief.length > 0 && (
                    <section className="mb-8" aria-label="Today's Brief">
                      <h2 className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#0D1117]/60">
                        Today's Brief
                      </h2>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {discoveryBrief.map((section: any) => (
                          <div
                            key={section.key}
                            className="rounded-2xl border border-[#E5E8EC] bg-[#FFFFFF] p-3"
                          >
                            <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#0D1117]/70">
                              {section.title}
                            </p>
                            <div className="mt-2 space-y-0.5">
                              {section.objects.slice(0, 4).map((obj: any) => (
                                <button
                                  key={obj.id}
                                  type="button"
                                  onClick={() => setSelectedObjectForDetail(obj)}
                                  className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-[#EFF1F4] cursor-pointer"
                                >
                                  {obj.imageUrl ? (
                                    <img
                                      src={obj.imageUrl}
                                      alt=""
                                      aria-hidden="true"
                                      loading="lazy"
                                      className="h-9 w-9 shrink-0 rounded-lg object-cover"
                                    />
                                  ) : (
                                    <span
                                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[15px]"
                                      style={{ background: '#F0F2F5', color: '#2563EB' }}
                                      aria-hidden="true"
                                    >
                                      {getObjectTypeMeta(obj.type).label.charAt(0)}
                                    </span>
                                  )}
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[12px] font-semibold text-[#0D1117]">
                                      {obj.title}
                                    </span>
                                    {briefWhenLabel(obj) && (
                                      <span className="block truncate text-[9px] font-semibold text-[#0D1117]/55">
                                        {briefWhenLabel(obj)}
                                      </span>
                                    )}
                                    <span className="mt-0.5 flex flex-wrap gap-1">
                                      {entityChipsFor(obj).slice(0, 2).map((chip, ci) => (
                                        <EntityChip
                                          key={`${chip.kind}_${chip.name ?? chip.directId}_${ci}`}
                                          kind={chip.kind}
                                          name={chip.name}
                                          directId={chip.directId}
                                          onOpenEntity={openEntityPage}
                                        />
                                      ))}
                                    </span>
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* FEED COMPOSER — the composed, deduplicated magazine feed:
                      hero → tea → discovery → opportunities. Real server rows via
                      /api/feed; card variety by type, never a repeating grid. */}
                  <FeedComposer
                    key={feedReload}
                    typeFilter={selectedObjectType}
                    onFeedStatus={setHomeFeedStatus}
                    area={feedArea}
                    geo={userLocation ? { lat: userLocation.lat, lng: userLocation.lng, radiusKm: 40 } : null}
                    type={discoveryTab === 'events' ? 'experience'
                      : discoveryTab === 'offers' ? 'offer'
                        : discoveryTab === 'places' ? 'place'
                          : discoveryTab === 'news' ? 'news'
                            : discoveryTab === 'opportunities' ? 'opportunity'
                              : null}
                    browse={discoveryTab === 'explore'}
                    onOpen={(raw) => {
                      if (!raw?.id) return;
                      const local = objects.find((object) => object.id === String(raw.id));
                      setSelectedObjectForDetail(local ?? objectFromServer(raw));
                    }}
                    onOpenTea={(slug) => setSelectedTeaSlug(slug)}
                    onOpenTag={(tag: any) => {
                      setSearchQuery(tag);
                      setNearbySection('stream');
                    }}
                  />
                </>
              )}
            </div>
            {/* Discovery navigation — Home, Events, Explore, Offers, Places,
                News, Opportunities. A category appears only when the real
                persisted data has rows for it; nothing is ever padded to make
                a tab exist. Selecting a category scopes the feed server-side
                (type= on /api/feed); Explore is the whole catalog in one grid.
                Tea/Today/Pursuits/Quests and the remaining types live behind
                "More" so they never permanently occupy the feed. Lives in the
                OUTER nearby block so it is reachable from every section. */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {(() => {
                const counts: Record<string, number> = {};
                for (const o of objects) {
                  counts[o.type] = (counts[o.type] ?? 0) + 1;
                }
                const has = (types: string[]) => types.some((t: any) => (counts[t] ?? 0) > 0);
                const tabs = [
                  { id: 'home', label: 'Home', types: null as string[] | null },
                  { id: 'events', label: 'Events', types: ['experience', 'event'] },
                  { id: 'explore', label: 'Explore', types: null as string[] | null },
                  { id: 'offers', label: 'Offers', types: ['offer'] },
                  { id: 'places', label: 'Places', types: ['place'] },
                  { id: 'news', label: 'News', types: ['news'] },
                  { id: 'opportunities', label: 'Opportunities', types: ['opportunity'] }
                ];
                return tabs
                  .filter((tab) => !tab.types || has(tab.types))
                  .map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setDiscoveryTab(tab.id as typeof discoveryTab);
                        // Keep the legacy client-side filter in step so the
                        // fallback grid matches the tab when the composed
                        // feed is unavailable.
                        const type = tab.id === 'events' ? 'experience'
                          : tab.id === 'offers' ? 'offer'
                            : tab.id === 'places' ? 'place'
                              : tab.id === 'news' ? 'news'
                                : tab.id === 'opportunities' ? 'opportunity'
                                  : 'all';
                        setSelectedObjectType(type);
                        setNearbySection('stream');
                      }}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold border transition ${
                        nearbySection === 'stream' && discoveryTab === tab.id
                          ? 'bg-[#FF5A1F] text-[#0D1117] border-[#2563EB]'
                          : 'bg-[#FFFFFF] text-[#0D1117]/70 border-[#E5E8EC] hover:border-[#2563EB]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ));
              })()}
              <button
                onClick={() => setMoreFilters((v) => !v)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold border transition ${
                  moreFilters
                    ? 'bg-[#FF5A1F] text-[#0D1117] border-[#2563EB]'
                    : 'bg-[#FFFFFF] text-[#0D1117]/70 border-[#E5E8EC] hover:border-[#2563EB]'
                }`}
              >
                More
              </button>
            </div>

            {/* More filters — reachable from every section, not permanently
                occupying the feed. */}
            {moreFilters && (
              <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar">
                {([
                  ['tea', HOME_MORE.tea],
                  ['today', `${HOME_MORE.today}${dailyBrief.length > 0 ? ' *' : ''}`],
                  ['pursuits', `${HOME_MORE.pursuits}${pursuits.length > 0 ? ` (${pursuits.length})` : ''}`],
                  ['quests', `${HOME_MORE.quests}${openQuests.length > 0 ? ` (${openQuests.length})` : ''}`],
                  ['market', HOME_MORE.market],
                  ['events', HOME_MORE.events]
                ] as [NearbySection, string][]).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setNearbySection(id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold border cursor-pointer transition ${
                      nearbySection === id
                        ? 'bg-[#FF5A1F] text-[#0D1117] border-[#2563EB]'
                        : 'bg-[#FFFFFF] text-[#0D1117]/70 border-[#E5E8EC]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {[
                  { id: 'service', label: FILTERS.service },
                  { id: 'product', label: FILTERS.product },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => { setSelectedObjectType(filter.id); setNearbySection('stream'); }}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold border cursor-pointer transition ${
                      nearbySection === 'stream' && selectedObjectType === filter.id
                        ? 'bg-[#FF5A1F] text-[#0D1117] border-[#2563EB]'
                        : 'bg-[#FFFFFF] text-[#0D1117]/70 border-[#E5E8EC]'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {nearbySection === 'stream' && (
          <>
            {/* MONEY BAND — real asks/offers around you, density-gated. */}
            <MoneyBand
              objects={objects}
              areaHint={feedArea}
              onOpenSection={(section: any) => setNearbySection(section)}
            />


            {/* A small live rail for destinations. Keep it visual and concise. */}
            {(() => {
              const active = objects
                .filter((obj: any) => {
                  if (!isDestinationObject(obj)) return false;
                  const state = getDestinationState(obj);
                  return state === 'live' || state === 'today';
                })
                .sort((a, b) => {
                  const da = a.metadata?.distanceKm ?? Number.MAX_SAFE_INTEGER;
                  const db = b.metadata?.distanceKm ?? Number.MAX_SAFE_INTEGER;
                  return da - db;
                })
                .slice(0, 3);
              if (active.length === 0) return null;
              return (
                <section className="mx-auto mb-8 max-w-5xl">
                  <h2 className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#0D1117]/60">
                    Happening nearby
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {active.map((obj: any) => {
                      const vendors = getDestinationVendors(obj, objects);
                      return (
                        <button
                          key={obj.id}
                          type="button"
                          onClick={() => setSelectedObjectForDetail(obj)}
                          aria-label={obj.title}
                          className="group relative min-h-[170px] overflow-hidden rounded-2xl border border-[#E5E8EC] bg-[#FFFFFF] text-left transition-transform duration-200 hover:-translate-y-0.5 hover:border-[#2563EB]"
                        >
                          {obj.imageUrl ? (
                            <img
                              src={obj.imageUrl}
                              alt=""
                              aria-hidden="true"
                              loading="lazy"
                              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-[#232A36] to-[#0D1117]" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117]/90 via-[#0D1117]/10 to-transparent" />
                          <div className="absolute inset-x-3 bottom-3">
                            <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug text-[#FFFFFF]">
                              {obj.title}
                            </h3>
                            {(() => {
                              const dist = getDistanceLabel(obj);
                              const loc = obj.locationName ? String(obj.locationName).trim() : null;
                              if (!dist && !loc) return null;
                              return (
                                <p className="mt-0.5 text-[10px] font-semibold text-[#FFFFFF]/80">
                                  {[dist, loc].filter(Boolean).join(' · ')}
                                </p>
                              );
                            })()}
                            {vendors.length > 0 && (
                              <p className="mt-1 text-[10px] font-semibold text-[#FFFFFF]">
                                {vendors.length} {vendors.length === 1 ? 'vendor' : 'vendors'} inside
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })()}

            {/* Search (Local Activity Graph brief): typing a venue, business
                or organizer name surfaces the objects CONNECTED to it —
                events at the venue, offers from the business — alongside the
                matching entities themselves. Search stays object-first:
                results never hide the global stream, and the input is a
                quiet row above it. */}
            {homeFeedStatus === 'ready' && (
              <div className="mx-auto mb-4 max-w-5xl px-1">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D1117]/60" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitRecentSearch(searchQuery); }}
                    placeholder="Search venues, businesses, organizers, areas…"
                    aria-label="Search Brief"
                    className="w-full rounded-full border border-[#E5E8EC] bg-[#FFFFFF] py-2.5 pl-10 pr-10 text-[13px] font-semibold text-[#0D1117] outline-none transition-colors placeholder:text-[#0D1117]/60 focus:border-[#2563EB]"
                  />
                  {searchQuery !== '' && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#0D1117]/60 transition-colors hover:text-[#0D1117] cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </label>
                {/* §14 — the search surface: recent searches (real, yours) and
                    nearby categories (derived from the live feed), shown only
                    while the field is empty and focused. */}
                {searchQuery === '' && searchFocused && (recentSearches.length > 0 || nearbyCategories.length > 0) && (
                  <div className="mt-3 space-y-3">
                    {recentSearches.length > 0 && (
                      <div>
                        <p className="mb-1.5 px-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#0D1117]/60">Recent</p>
                        <div className="flex flex-wrap gap-1.5">
                          {recentSearches.map((term) => (
                            <button
                              key={term}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => setSearchQuery(term)}
                              className="rounded-full border border-[#E5E8EC] bg-[#FFFFFF] px-3 py-1.5 text-[12px] font-semibold text-[#0D1117]/70 transition-colors hover:border-[#2563EB] cursor-pointer"
                            >
                              {term}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {nearbyCategories.length > 0 && (
                      <div>
                        <p className="mb-1.5 px-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#0D1117]/60">Nearby categories</p>
                        <div className="flex flex-wrap gap-1.5">
                          {nearbyCategories.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => setSearchQuery(cat)}
                              className="rounded-full border border-[#E5E8EC] bg-[#F0F2F5] px-3 py-1.5 text-[12px] font-semibold text-[#0D1117]/70 transition-colors hover:border-[#FF5A1F] cursor-pointer"
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Search stays above the visual stream, but the cards themselves
                are title-first. */}
            {searchQuery.trim() !== '' && (
              <SearchResults
                query={searchQuery}
                onOpenObject={(o) => setSelectedObjectForDetail(objectFromServer(o))}
                onOpenEntity={openEntityPage}
              />
            )}

            {/* The legacy object stream is a fallback for deployments where the
                composed feed is unavailable. Keep one visual language in both
                paths: photo, title, and the one action the record supports. */}
            {(homeFeedStatus !== 'ready' || searchQuery.trim() !== '') && (
              <>
                {filteredObjects.length > 0 ? (
                  <section className="mx-auto max-w-5xl">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {filteredObjects.map((obj: any) => {
                        const destVendors = isDestinationObject(obj)
                          ? getDestinationVendors(obj, objects)
                          : [];
                        const level = getCardLevel(obj, destVendors.length);
                        const destState = getDestinationState(obj);
                        const status = level >= 2
                          ? DESTINATION_STATE_LABELS[destState]
                          : obj.metadata?.statusBadge;
                        return (
                          <div
                            key={obj.id}
                            onClick={() => setSelectedObjectForDetail(obj)}
                            className={`group relative min-h-[210px] cursor-pointer overflow-hidden rounded-2xl border bg-[#FFFFFF] transition-transform duration-200 hover:-translate-y-0.5 hover:border-[#2563EB] ${
                              level === 3 ? 'sm:col-span-2 sm:row-span-2 min-h-[270px]' : ''
                            }`}
                          >
                            {obj.imageUrl ? (
                              <img
                                src={obj.imageUrl}
                                alt=""
                                aria-hidden="true"
                                loading="lazy"
                                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                              />
                            ) : (
                              <div className="absolute inset-0 bg-gradient-to-br from-[#232A36] to-[#0D1117]" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117]/95 via-[#0D1117]/20 to-[#0D1117]/05" />
                            <div className="absolute left-3 top-3 flex max-w-[calc(100%-24px)] flex-wrap gap-1.5">
                              <span className="rounded-full bg-[#F0F2F5]/75 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#0D1117]">
                                {getObjectTypeMeta(obj.type).label}
                              </span>
                              {!obj.imageUrl && obj.category && (
                                <span className="rounded-full bg-[#F0F2F5]/75 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#0D1117]">
                                  {obj.category}
                                </span>
                              )}
                              {obj.isVerified && (
                                <span className="rounded-full bg-[#FF5A1F] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#0D1117]">
                                  VERIFIED
                                </span>
                              )}
                              {status && (
                                <span className="rounded-full bg-[#F0F2F5]/75 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#0D1117]">
                                  {status}
                                </span>
                              )}
                              {(() => {
                                const life = getLifecycleBadge(obj);
                                if (!life) return null;
                                return (
                                  <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${
                                    life.expired
                                      ? 'bg-[#0D1117]/80 text-[#FFFFFF]'
                                      : 'bg-[#F0F2F5]/75 text-[#0D1117]'
                                  }`}>
                                    {life.label}
                                  </span>
                                );
                              })()}
                            </div>
                            <div className="absolute inset-x-3 bottom-3">
                              <h3 className="line-clamp-3 pr-2 text-[14px] font-semibold leading-snug text-[#FFFFFF]">
                                {obj.title}
                              </h3>
                              {(() => {
                                const sourceChip = getSourceChip(obj);
                                const published = getPublishedLine(obj);
                                if (!sourceChip && !published) return null;
                                const bits = [sourceChip, published].filter(Boolean);
                                return (
                                  <p className="mt-1 text-[9px] font-semibold text-[#FFFFFF]/75 truncate">
                                    {bits.join(' · ')}
                                  </p>
                                );
                              })()}
                              {(() => {
                                const chips = entityChipsFor(obj);
                                if (chips.length === 0) return null;
                                return (
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    {chips.map((chip, i) => (
                                      <EntityChip
                                        key={`${chip.kind}_${chip.name ?? chip.directId}_${i}`}
                                        kind={chip.kind}
                                        name={chip.name}
                                        directId={chip.directId}
                                        onOpenEntity={openEntityPage}
                                        className="bg-[#0D1117]/70 text-[#F0F2F5] hover:bg-[#FF5A1F] hover:text-[#0D1117]"
                                      />
                                    ))}
                                  </div>
                                );
                              })()}
                              {level === 3 && destVendors.length > 0 && (
                                <p className="mt-1 text-[10px] font-semibold text-[#0D1117]">
                                  {destVendors.length} {destVendors.length === 1 ? 'vendor' : 'vendors'} inside
                                </p>
                              )}
                              <div className="mt-2 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (level === 3 && destVendors.length > 0) {
                                      setSelectedObjectForDetail(obj);
                                    } else {
                                      handlePrimaryAction(obj);
                                    }
                                  }}
                                  className="rounded-full border border-[#2563EB]/70 bg-[#F0F2F5]/60 px-2.5 py-1 text-[10px] font-bold text-[#0D1117]/80 transition-colors hover:bg-[#FF5A1F] hover:text-[#0D1117]"
                                >
                                  {level === 3 && destVendors.length > 0 ? "See what's here" : resolveAction(obj).label}
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Save ${obj.title}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleExecuteProtocolAction('save', obj);
                                  }}
                                  className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E8EC]/35 bg-[#F0F2F5]/60 text-[#0D1117] transition-colors hover:border-[#2563EB] hover:text-[#0D1117]"
                                >
                                  <Bookmark className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : (
                  <section className="mx-auto max-w-5xl py-10 text-center">
                    {searchQuery.trim() !== '' ? (
                      <>
                        <h2 className="text-base font-semibold text-[#0D1117]">Nothing nearby</h2>
                        <button
                          type="button"
                          onClick={() => handleCreatePursuit(searchQuery)}
                          className="mt-4 rounded-full border border-[#2563EB]/60 px-4 py-2 text-[11px] font-bold text-[#0D1117]"
                        >
                          Keep pursuing
                        </button>
                      </>
                    ) : (
                      <>
                        <h2 className="text-base font-semibold text-[#0D1117]">Nothing nearby</h2>
                        <div className="mt-4 flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCaptureOpen(true)}
                            className="rounded-full bg-[#FF5A1F] px-4 py-2 text-[11px] font-bold text-[#0D1117]"
                          >
                            Add
                          </button>
                        </div>
                      </>
                    )}
                  </section>
                )}
              </>
            )}
          </>
        )}
        {nearbySection === 'tea' && (
          <section className="space-y-4">
            <div className="bg-[#FFFFFF] border border-[#E5E8EC] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Newspaper className="w-4 h-4 text-[#0D1117]" />
                <span className="text-[10px] text-[#0D1117]">
                  Tea
                </span>
              </div>

              <h2 className="text-xl font-extrabold">
                What people are talking about
              </h2>

              <p className="text-xs text-[#0D1117] mt-1">
                News, notices and neighbourhood chatter, alongside the
                directory. Posts link back to the places they are about.
              </p>
            </div>

            {/* Ticker (§5.2): a scrolling strip of live topics, each a door. */}
            <TickerBanner
              items={objects.slice(0, 12).map((o: any) => ({
                id: o.id,
                label: o.title,
                accent: o.category === 'Offer' || o.category === 'Opportunity' ? 'var(--tea)' : undefined
              }))}
              onOpen={(id) => {
                const obj = objects.find((o: any) => o.id === id);
                if (obj) setSelectedObjectForDetail(obj);
              }}
            />

            {/* Edition switcher */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {TEA_EDITIONS.map(({ edition, label, Icon }) => {
                const isActive = edition === activeEdition;
                const count = posts.filter((p: any) => p.edition === edition).length;

                return (
                  <button
                    key={edition}
                    onClick={() => setActiveEdition(edition)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 border transition cursor-pointer ${
                      isActive
                        ? 'bg-[#FF5A1F] text-[#0D1117] border-[#2563EB]'
                        : 'bg-[#FFFFFF] text-[#0D1117]/70 border-[#E5E8EC] hover:border-[#2563EB]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px] font-extrabold whitespace-nowrap">
                      {label}
                    </span>
                    <span
                      className={`text-[10px] ${
                        isActive ? 'text-[#0D1117]/70' : 'text-[#0D1117]/60'
                      }`}
                    >
                      {count}
                    </span>
                    {edition === liveEdition && !isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A1F] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] text-[#0D1117]/60 px-1">
              <span className="font-extrabold">
                {getEditionMeta(activeEdition).label}
              </span>
              <span>
                {activeEdition === liveEdition
                  ? 'Live now'
                  : getEditionMeta(activeEdition).window}
              </span>
            </div>

            {/* Posts */}
            {editionPosts.map((post: any) => {
              const kindMeta = getPostKindMeta(post.kind);
              const subject = objects.find(
                (item) => item.id === post.relatedObjectId
              );
              const isLiked = likedPostIds.includes(post.id);

              return (
                <article
                  key={post.id}
                  className={`bg-[#FFFFFF] border rounded-2xl p-4 ${
                    post.isPromoted ? 'border-[#2563EB]' : 'border-[#E5E8EC]'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border bg-[#F0F2F5] ${kindMeta.tone}`}
                    >
                      {kindMeta.label}
                    </span>

                    <span className="text-[11px] font-bold text-[#0D1117]">
                      {post.authorName}
                    </span>

                    {post.authorIsVerified && (
                      <ShieldCheck className="w-3 h-3 text-[#0D1117] shrink-0" />
                    )}

                    <span className="text-[10px] text-[#0D1117]/60">
                      {getRelativeTime(post.publishedAt)}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-[#0D1117] leading-snug">
                    {post.title}
                  </h3>

                  <p className="text-xs text-[#0D1117] mt-1.5 leading-relaxed">
                    {post.body}
                  </p>

                  {post.isPromoted && (
                    <p className="text-[10px] text-[#0D1117] mt-2">
                      Paid distribution by {post.promotedBy}.
                    </p>
                  )}

                  {subject && (
                    <button
                      onClick={() => openPostSubject(post)}
                      className="mt-3 w-full flex items-center gap-2 bg-[#F0F2F5] border border-[#E5E8EC] hover:border-[#2563EB] rounded-xl p-2.5 transition cursor-pointer group text-left"
                    >
                      {subject.imageUrl && (
                        <img
                          src={subject.imageUrl}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover shrink-0"
                        />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] text-[#0D1117]/60">
                          About this {getObjectTypeMeta(subject.type).label}
                        </div>
                        <div className="text-[11px] font-extrabold truncate group-hover:text-[#0D1117]">
                          {subject.title}
                        </div>
                      </div>

                      <ArrowRight className="w-3.5 h-3.5 text-[#0D1117] shrink-0" />
                    </button>
                  )}

                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#E5E8EC]">
                    <button
                      onClick={() => toggleLike(post)}
                      className={`flex items-center gap-1.5 text-[11px] font-bold cursor-pointer transition ${
                        isLiked ? 'text-[#0D1117]' : 'text-[#0D1117]/60 hover:text-[#0D1117]'
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`}
                      />
                      {formatCount(post.reactionsCount + (isLiked ? 1 : 0))}
                    </button>

                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#0D1117]/60">
                      No discussion yet
                    </span>

                    {post.tags && post.tags.length > 0 && (
                      <span className="ml-auto text-[10px] text-[#0D1117]/60 truncate">
                        {post.tags.map((tag: any) => `#${tag}`).join(' ')}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}

            {editionPosts.length === 0 && (
              <div className="py-16 text-center border border-dashed border-[#E5E8EC] rounded-2xl">
                <Newspaper className="w-8 h-8 mx-auto mb-3 text-[#0D1117]/60" />
                <p className="text-sm font-bold">No tea in this edition yet.</p>
              </div>
            )}
          </section>
        )}
        {nearbySection === 'quests' && (
          <Quests
            quests={quests}
            boardMode={boardMode}
            setBoardMode={setBoardMode}
            handleSubmitQuest={handleSubmitQuest}
            setActiveTab={setActiveTab}
          />
        )}
        {nearbySection === 'events' && (
          <div className="max-w-3xl mx-auto px-4 py-6">
            <EventsHub />
          </div>
        )}
        {nearbySection === 'market' && (
          <div className="max-w-3xl mx-auto px-4 py-6">
            <Marketplace />
          </div>
        )}
        {nearbySection === 'mshikano' && (
          <MshikanoDesk />
        )}
        {nearbySection === 'today' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#0D1117]">Today</h2>
              <p className="text-[11px] text-[#0D1117]/60 leading-snug mt-1">
                Only what relates to your pursuits, saved and watched things.
              </p>
            </div>

            {dailyBrief.length === 0 && (
              <div className="border border-dashed border-[#E5E8EC] rounded-2xl p-8 text-center">
                <p className="text-xs text-[#0D1117]/60">Nothing to report.</p>
                <p className="text-[10px] text-[#0D1117]/60 mt-1">
                  Save something, or start a pursuit, and this fills itself in.
                </p>
              </div>
            )}

            {dailyBrief.map((section: any) => (
              <div key={section.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-extrabold text-[#0D1117]">
                    {section.title}
                  </h3>
                  <span className="text-[10px] text-[#0D1117]/60">
                    {section.objects.length + section.pursuits.length}
                  </span>
                </div>

                {section.objects.map((obj: any) => (
                  <button
                    key={obj.id}
                    onClick={() => setSelectedObjectForDetail(obj)}
                    className="w-full text-left bg-[#FFFFFF] border border-[#E5E8EC] hover:border-[#E5E8EC] rounded-xl p-3 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] text-[#0D1117]/60">
                        {getObjectTypeMeta(obj.type).label}
                      </span>
                      {getDistanceLabel(obj) && (
                        <span className="text-[9px] text-[#0D1117]/60">
                          {getDistanceLabel(obj)}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] font-bold text-[#0D1117] leading-snug mt-0.5">
                      {obj.title}
                    </p>
                    {obj.metadata?.statusBadge && (
                      <p className="text-[10px] text-[#0D1117] mt-0.5">
                        {obj.metadata.statusBadge}
                      </p>
                    )}
                  </button>
                ))}

                {section.pursuits.map((pursuit: any) => (
                  <button
                    key={pursuit.id}
                    onClick={() => { setActiveTab('nearby'); setNearbySection('pursuits'); }}
                    className="w-full text-left bg-[#FFFFFF] border border-[#E5E8EC] rounded-xl p-3 cursor-pointer"
                  >
                    <p className="text-[11px] text-[#0D1117]/60">{pursuit.query}</p>
                    <p className="text-[9px] text-[#0D1117]/60 mt-0.5">
                      Nothing useful yet. Brief is still looking.
                    </p>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        {nearbySection === 'pursuits' && (
          <Pursuits
            pursuits={pursuits}
            pursuitResults={pursuitResults}
            pursuitDraft={pursuitDraft}
            setPursuitDraft={setPursuitDraft}
            handleCreatePursuit={handleCreatePursuit}
            handleRemovePursuit={handleRemovePursuit}
            handleSetPursuitStatus={handleSetPursuitStatus}
            handleTogglePursuitWatch={handleTogglePursuitWatch}
            handleTogglePursuitCondition={handleTogglePursuitCondition}
            setSelectedObjectForDetail={setSelectedObjectForDetail}
          />
        )}

        {/* ================= MODAL: LIFE-EVENTS COMMITTEE HUB ================= */}
        {committeeOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-2xl my-auto">
              <CommitteeDesk
                onClose={() => setCommitteeOpen(false)}
                onOpenVendor={(vendor) => {
                  setCommitteeOpen(false);
                  showToast(`Opening ${vendor} profile in town directory`);
                }}
              />
            </div>
          </div>
        )}

        {/* ================= MODAL: CHAMA & TABLE BANKING HUB ================= */}
        {chamaOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-2xl my-auto">
              <ChamaDesk
                onClose={() => setChamaOpen(false)}
                onOpenCircle={() => {
                  setChamaOpen(false);
                  showToast('Opening Chama circle details');
                }}
              />
            </div>
          </div>
        )}

        {/* ================= MODAL: EMOTIONAL WELLBEING HUB ================= */}
        {wellbeingOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-2xl my-auto">
              <WellbeingDesk
                onClose={() => setWellbeingOpen(false)}
                onBookTherapist={(doc) => {
                  showToast(`Booking request sent to ${doc}`);
                }}
              />
            </div>
          </div>
        )}

        {/* ================= MODAL: INTER-COUNTY CARGO & TRAVELER MATCHING ================= */}
        {interCountyOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-3xl my-auto">
              <InterCountyDesk
                onClose={() => setInterCountyOpen(false)}
                onBookingComplete={(bkg) => {
                  showToast(`Cargo booking ${bkg.id} placed! Escrow secured via M-Pesa.`);
                }}
              />
            </div>
          </div>
        )}

        {/* ================= MODAL: PRIVATE CARRIER REVERSE AUCTION ================= */}
        {carrierAuctionOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-3xl my-auto">
              <PrivateCarrierAuctionDesk
                onClose={() => setCarrierAuctionOpen(false)}
                onDispatchSelected={(carrier) => {
                  showToast(`Assigned ${carrier.carrierName} for KES ${carrier.bidPriceKes}`);
                }}
              />
            </div>
          </div>
        )}

        {/* ================= MODAL: OFFLINE PWA INDEXEDDB SYNC ================= */}
        {offlineSyncOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-3xl my-auto">
              <OfflineSyncQueueDesk
                onClose={() => setOfflineSyncOpen(false)}
                onActionSynced={(act) => {
                  showToast(`Reconciled offline mutation ${act.title}`);
                }}
              />
            </div>
          </div>
        )}

        {/* ================= MODAL: 3D DISCOVER VIEW ================= */}
        {discoverViewOpen && (
          <div className="fixed inset-0 z-50 bg-[#F0EDE8] overflow-y-auto animate-fadeIn">
            <div className="sticky top-3 left-3 z-50 p-3">
              <button
                type="button"
                onClick={() => { soundEngine.play('tap'); setDiscoverViewOpen(false); }}
                className="px-3.5 py-1.5 rounded-full bg-[#1A1F2E] text-white text-xs font-bold shadow-xl flex items-center space-x-1.5 cursor-pointer hover:bg-black transition-colors"
              >
                <X className="w-4 h-4" />
                <span>Exit Discover</span>
              </button>
            </div>
            <DiscoverScreen />
          </div>
        )}

        {/* ================= MODAL: UNIVERSAL CREATE POST ================= */}
        {createPostModalOpen && (
          <UniversalCreatePostModal
            isOpen={createPostModalOpen}
            onClose={() => setCreatePostModalOpen(false)}
            onPostCreated={(post) => {
              showToast(`Published ${post.type.toUpperCase()}: "${post.title}"`);
            }}
          />
        )}

        {/* ================= MODAL: BRIEF AI ASSISTANT ================= */}
        {briefAiOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-2xl my-auto">
              <BriefAiAssistant
                onClose={() => setBriefAiOpen(false)}
                onOpenCardAction={(type) => {
                  setBriefAiOpen(false);
                  if (type === 'civic') setCivicGuideOpen(true);
                  else if (type === 'vendor') showToast(`Opening verified vendor details`);
                  else if (type === 'event') {
                    setSelectedObjectType('experience');
                    setDiscoveryTab('events');
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* ================= MODAL: CIVIC KNOWLEDGE GUIDE ================= */}
        {civicGuideOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-2xl my-auto">
              <CivicKnowledgeGuide
                onClose={() => setCivicGuideOpen(false)}
                onAction={(act) => {
                  showToast(`${act} recorded`);
                }}
              />
            </div>
          </div>
        )}
    </>
  );
}
