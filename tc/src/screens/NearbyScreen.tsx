import React from 'react';
import { ArrowRight, Bookmark, FolderPlus, Heart, Newspaper, Plus, Search, ShieldCheck, Users, X } from 'lucide-react';
import * as briefApi from '../api/briefApi';
import { DESTINATION_STATE_LABELS, TEA_EDITIONS, briefWhenLabel, entityChipsFor, formatCount, getCardLevel, getDestinationState, getDestinationVendors, getDistanceLabel, getEditionMeta, getLifecycleBadge, getObjectTypeMeta, getPostKindMeta, getPublishedLine, getRelativeTime, getSourceChip, isDestinationObject, objectFromServer, resolveAction } from '../model/core';
import type { ObjectType } from '../model/core';
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
import type { ArenaMatch, BriefObject, Destination, NearbySection, Pursuit, Quest, TeaEdition, WorkflowSection } from '../model/core';
import type { AuthedUser, PersonalState } from '../api/briefApi';
import type { GeoPoint } from '../components/LocationChip';

// ---------------------------------------------------------------------------
// NEARBY SCREEN -- extracted from App.tsx (Phase 1: JSX move; shell keeps the
// state, colocation pass tightens types afterwards). Section switching is
// verbatim; what each section renders did not change.
// ---------------------------------------------------------------------------

export interface NearbyScreenProps {
  activeEdition: TeaEdition;
  activeTab: Destination;
  arenaActivity: Record<string, number>;
  availableTypes: any;
  boardMode: 'contributors' | 'earners';
  chooseCity: any;
  clearLocation: any;
  dailyBrief: any;
  discoveryBrief: any;
  discoveryTab: 'home' | 'events' | 'explore' | 'offers' | 'places' | 'news' | 'opportunities';
  editionPosts: any;
  feedArea: string | null;
  feedReload: any;
  filteredObjects: any;
  followOne: any;
  handleCreatePursuit: any;
  handleExecuteProtocolAction: any;
  handleMenuSelect: any;
  handlePrimaryAction: any;
  handleRemovePursuit: any;
  handleSetPursuitStatus: any;
  handleSubmitQuest: any;
  handleTogglePursuitCondition: any;
  handleTogglePursuitWatch: any;
  homeFeedStatus: 'loading' | 'ready' | 'unavailable';
  ladder: any;
  likedPostIds: string[];
  liveEdition: any;
  locError: string | null;
  locate: any;
  locating: any;
  matches: ArenaMatch[];
  moreFilters: boolean;
  nearbySection: NearbySection;
  nextStepHidden: any;
  noteActivation: any;
  objects: BriefObject[];
  openEntityPage: any;
  openPostSubject: any;
  openQuests: any;
posts: BriefPost[];
    personalBriefDismissed: any;
  personalBusy: any;
  personalHasInterests: any;
  personalInterests: any;
  personalPicks: { locations: string[]; types: string[]; topics: string[] };
  personalSavedGroups: any;
  personalSections: any;
  personalState: briefApi.PersonalState | null;
  pursuitDraft: string;
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
  setArenaSection: React.Dispatch<React.SetStateAction<'lobby' | 'epl' | 'challenges' | 'tournaments' | 'leaderboard'>>;
  setBoardMode: React.Dispatch<React.SetStateAction<'contributors' | 'earners'>>;
  setCaptureOpen: any;
  setCollectionsOpen: any;
  setDiscoveryTab: React.Dispatch<React.SetStateAction<'home' | 'events' | 'explore' | 'offers' | 'places' | 'news' | 'opportunities'>>;
  setFirstRunOpen: any;
  setFollowingOpen: any;
  setHomeFeedStatus: React.Dispatch<React.SetStateAction<'loading' | 'ready' | 'unavailable'>>;
  setMoreFilters: React.Dispatch<React.SetStateAction<boolean>>;
  setNearbySection: React.Dispatch<React.SetStateAction<NearbySection>>;
  setNextStepHidden: any;
  setPersonalBriefDismissed: any;
  setPursuitDraft: React.Dispatch<React.SetStateAction<string>>;
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
    arenaActivity,
    availableTypes,
    boardMode,
    chooseCity,
    clearLocation,
    dailyBrief,
    discoveryBrief,
    discoveryTab,
    editionPosts,
    feedArea,
    feedReload,
    filteredObjects,
    followOne,
    handleCreatePursuit,
    handleExecuteProtocolAction,
    handleMenuSelect,
    handlePrimaryAction,
    handleRemovePursuit,
    handleSetPursuitStatus,
    handleSubmitQuest,
    handleTogglePursuitCondition,
    handleTogglePursuitWatch,
    homeFeedStatus,
    ladder,
    likedPostIds,
    liveEdition,
    locError,
    locate,
    locating,
    matches,
    moreFilters,
    nearbySection,
    nextStepHidden,
    noteActivation,
    objects,
    openEntityPage,
    openPostSubject,
    openQuests,
    personalBriefDismissed,
    personalBusy,
    personalHasInterests,
    personalInterests,
    personalPicks,
    personalSavedGroups,
    personalSections,
    personalState,
    pursuitDraft,
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
    setArenaSection,
    setBoardMode,
    setCaptureOpen,
    setCollectionsOpen,
    setDiscoveryTab,
    setFirstRunOpen,
    setFollowingOpen,
    setHomeFeedStatus,
    setMoreFilters,
    setNearbySection,
    setNextStepHidden,
    setPersonalBriefDismissed,
    setPursuitDraft,
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
  } = props;
  return (
    <>
{ (
          <div className="max-w-5xl mx-auto px-0 sm:px-4 pt-2">
            <div className="mb-5">
              <div className="flex items-center justify-between gap-3 px-1 pb-3">
                <h1 className="font-display text-2xl font-semibold tracking-tight text-[#251045]">Home</h1>
                <div className="flex items-center gap-2">
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
                <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-[#6C3EC9] bg-[#FBFAFD] px-4 py-3">
                  <div>
                    <p className="text-[11px] font-extrabold text-[#251045]">Update needed before testing</p>
                    <p className="mt-1 text-[10px] leading-snug text-[#251045]/60">This app is newer than the API behind it. Deploy the current server so gallery, banner, and news checks use the same contract.</p>
                  </div>
                  <button type="button" onClick={() => window.location.reload()} className="shrink-0 rounded-lg bg-[#5B2EA6] px-3 py-2 text-[10px] font-extrabold text-[#FFFFFF]">Refresh</button>
                </div>
              )}
              {runtimeCheck === 'unavailable' && (
                <div className="mb-3 rounded-2xl border border-dashed border-[#D6CFE4] bg-[#FBFAFD] px-4 py-3">
                  <p className="text-[11px] font-extrabold text-[#251045]">Live services are not reachable</p>
                  <p className="mt-1 text-[10px] leading-snug text-[#251045]/60">The shelf still works as navigation, but live news and create actions will wait for the API. No placeholder counts are shown.</p>
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
                  <MainShelf
                    onSelect={handleMenuSelect}
                    playOpenCount={arenaActivity.efootball ?? null}
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
                      <div className="mb-3 flex items-center justify-between gap-2 px-1">
                        <h2 className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#251045]/60">
                          My Brief
                        </h2>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCollectionsOpen(true)}
                            className="flex items-center gap-1.5 rounded-full border border-[#D6CFE4] bg-[#FBFAFD] px-3 py-1 text-[10px] font-extrabold text-[#251045]/60 cursor-pointer hover:border-[#6C3EC9]"
                          >
                            <FolderPlus className="h-3 w-3" />
                            Collections
                          </button>
                          <button
                            type="button"
                            onClick={() => setFollowingOpen(true)}
                            className="flex items-center gap-1.5 rounded-full border border-[#D6CFE4] bg-[#FBFAFD] px-3 py-1 text-[10px] font-extrabold text-[#251045]/60 cursor-pointer hover:border-[#6C3EC9]"
                          >
                            <Users className="h-3 w-3" />
                            Following
                            {(personalState.followed ?? []).length > 0 && (
                              <span className="rounded-full bg-[#5B2EA6] px-1.5 text-[9px] font-extrabold text-white">
                                {(personalState.followed ?? []).length}
                              </span>
                            )}
                          </button>
                          {personalHasInterests && (
                            <button
                              type="button"
                              onClick={() => setPersonalBriefDismissed(false)}
                              className="rounded-full border border-[#D6CFE4] bg-[#FBFAFD] px-3 py-1 text-[10px] font-extrabold text-[#251045]/60 cursor-pointer hover:border-[#6C3EC9]"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </div>

                      {/* ONBOARDING — where + what, as chips. Skipping closes
                          the card; the Brief stays fully global until then. */}
                      {!personalHasInterests && !personalBriefDismissed && (
                        <div className="rounded-2xl border border-[#D6CFE4] bg-[#FBFAFD] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-extrabold text-[#251045]">
                                Make this your Brief
                              </h3>
                              <p className="mt-0.5 text-[11px] text-[#251045]/55">
                                Your daily city briefing: the same Brief feed,
                                ordered around the places and things you follow.
                                Skip anytime — nothing is blocked.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPersonalBriefDismissed(true)}
                              className="shrink-0 rounded-full border border-[#D6CFE4] px-3 py-1 text-[10px] font-extrabold text-[#251045]/50 cursor-pointer"
                            >
                              Skip
                            </button>
                          </div>

                          <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#251045]/45">
                            Where do you want your Brief?
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {personalState.suggestedLocations.map((loc: any) => (
                              <button
                                key={loc}
                                type="button"
                                onClick={() => togglePersonalPick('locations', loc)}
                                className={`rounded-full border px-3 py-1.5 text-[11px] font-bold cursor-pointer transition ${
                                  personalPicks.locations.includes(loc)
                                    ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                                    : 'bg-[#FBFAFD] text-[#251045]/70 border-[#D6CFE4] hover:border-[#6C3EC9]'
                                }`}
                              >
                                {loc}
                              </button>
                            ))}
                          </div>

                          <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#251045]/45">
                            What do you care about?
                          </p>
                          {availableTypes.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {availableTypes.map((t: any) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => togglePersonalPick('types', t)}
                                  className={`rounded-full border px-3 py-1.5 text-[11px] font-bold cursor-pointer transition ${
                                    personalPicks.types.includes(t)
                                      ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                                      : 'bg-[#FBFAFD] text-[#251045]/70 border-[#D6CFE4] hover:border-[#6C3EC9]'
                                  }`}
                                >
                                  {getObjectTypeMeta(t).label}
                                </button>
                              ))}
                            </div>
                          )}
                          {personalState.topics.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {personalState.topics.slice(0, 8).map((topic) => (
                                <button
                                  key={topic.id}
                                  type="button"
                                  onClick={() => togglePersonalPick('topics', topic.id)}
                                  className={`rounded-full border px-3 py-1.5 text-[11px] font-bold cursor-pointer transition ${
                                    personalPicks.topics.includes(topic.id)
                                      ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                                      : 'bg-[#FBFAFD] text-[#251045]/70 border-[#D6CFE4] hover:border-[#6C3EC9]'
                                  }`}
                                >
                                  {topic.label}
                                </button>
                              ))}
                            </div>
                          )}

                          <div className="mt-4 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void savePersonalBrief()}
                              disabled={personalBusy || (personalPicks.locations.length === 0 && personalPicks.types.length === 0 && personalPicks.topics.length === 0)}
                              className="rounded-full bg-[#5B2EA6] px-4 py-2 text-[11px] font-extrabold text-[#FFFFFF] cursor-pointer disabled:opacity-40"
                            >
                              {personalBusy ? 'Saving…' : 'Build my Brief'}
                            </button>
                            <span className="text-[10px] text-[#251045]/40">
                              Pick anything, or skip — your feed stays global.
                            </span>
                          </div>
                        </div>
                      )}

                      {!personalHasInterests && personalBriefDismissed && (
                        <p className="rounded-2xl border border-dashed border-[#D6CFE4] px-4 py-3 text-[11px] text-[#251045]/50">
                          Your Brief is global until you follow places or topics.{' '}
                          <button
                            type="button"
                            onClick={() => setPersonalBriefDismissed(false)}
                            className="font-extrabold text-[#5B2EA6] cursor-pointer"
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
                              className="flex items-center gap-1 rounded-full bg-[#5B2EA6] px-3 py-1.5 text-[11px] font-extrabold text-[#FFFFFF] cursor-pointer"
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
                              className="flex items-center gap-1 rounded-full border border-[#6C3EC9] bg-[#F1EDF7] px-3 py-1.5 text-[11px] font-extrabold text-[#5B2EA6] cursor-pointer"
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
                                className="flex items-center gap-1 rounded-full border border-[#6C3EC9] bg-[#F1EDF7] px-3 py-1.5 text-[11px] font-extrabold text-[#5B2EA6] cursor-pointer"
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
                              className="flex items-center gap-1 rounded-full border border-[#6C3EC9] bg-[#E9E0F5] px-3 py-1.5 text-[11px] font-extrabold text-[#5B2EA6] cursor-pointer"
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
                              className="flex items-center gap-1 rounded-full border border-dashed border-[#D6CFE4] px-2 py-1 text-[9px] font-bold text-[#251045]/40 cursor-pointer hover:border-[#C0392B] hover:text-[#C0392B]"
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
                                className="flex items-center gap-1 rounded-full border border-dashed border-[#D6CFE4] px-3 py-1.5 text-[11px] font-bold text-[#251045]/45 cursor-pointer hover:border-[#6C3EC9]"
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
                                className="flex items-center gap-1 rounded-full border border-dashed border-[#D6CFE4] px-3 py-1.5 text-[11px] font-bold text-[#251045]/45 cursor-pointer hover:border-[#6C3EC9]"
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
                              className="rounded-2xl border border-[#D6CFE4] bg-[#FBFAFD] p-3"
                            >
                              <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#251045]/50">
                                {section.title}
                              </p>
                              <div className="mt-2 space-y-0.5">
                                {section.objects.slice(0, 4).map((obj: any) => (
                                  <button
                                    key={obj.id}
                                    type="button"
                                    onClick={() => setSelectedObjectForDetail(obj)}
                                    className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-[#E9E4F2] cursor-pointer"
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
                                        style={{ background: '#F1EDF7', color: '#6C3EC9' }}
                                        aria-hidden="true"
                                      >
                                        {getObjectTypeMeta(obj.type).label.charAt(0)}
                                      </span>
                                    )}
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-[12px] font-semibold text-[#251045]">
                                        {obj.title}
                                      </span>
                                      {briefWhenLabel(obj) && (
                                        <span className="block truncate text-[9px] font-semibold text-[#251045]/55">
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
                        <div className="mt-4 rounded-2xl border border-[#D6CFE4] bg-[#FBFAFD] p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <Bookmark className="h-3.5 w-3.5 text-[#251045]/60" />
                            <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#251045]/50">
                              Saved
                            </p>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            {personalSavedGroups.map((group: any) => (
                              <div key={group.key}>
                                <p className="text-[10px] font-extrabold text-[#251045]/70">
                                  {group.title}
                                  <span className="ml-1.5 text-[10px] font-bold text-[#251045]/40">
                                    {group.items.length + group.expired.length}
                                  </span>
                                </p>
                                <div className="mt-1.5 space-y-0.5">
                                  {group.items.slice(0, 3).map((obj: any) => (
                                    <button
                                      key={obj.id}
                                      type="button"
                                      onClick={() => setSelectedObjectForDetail(obj)}
                                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[#E9E4F2] cursor-pointer"
                                    >
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[11px] font-semibold text-[#251045]">
                                          {obj.title}
                                        </span>
                                        {briefWhenLabel(obj) && (
                                          <span className="block truncate text-[9px] font-semibold text-[#251045]/50">
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
                                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[#E9E4F2] cursor-pointer opacity-60"
                                    >
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[11px] font-semibold text-[#251045] line-through">
                                          {obj.title}
                                        </span>
                                        <span className="block truncate text-[9px] font-bold text-[#B45309]">
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
                      <h2 className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#251045]/60">
                        Today's Brief
                      </h2>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {discoveryBrief.map((section: any) => (
                          <div
                            key={section.key}
                            className="rounded-2xl border border-[#D6CFE4] bg-[#FBFAFD] p-3"
                          >
                            <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#251045]/50">
                              {section.title}
                            </p>
                            <div className="mt-2 space-y-0.5">
                              {section.objects.slice(0, 4).map((obj: any) => (
                                <button
                                  key={obj.id}
                                  type="button"
                                  onClick={() => setSelectedObjectForDetail(obj)}
                                  className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-[#E9E4F2] cursor-pointer"
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
                                      style={{ background: '#F1EDF7', color: '#6C3EC9' }}
                                      aria-hidden="true"
                                    >
                                      {getObjectTypeMeta(obj.type).label.charAt(0)}
                                    </span>
                                  )}
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[12px] font-semibold text-[#251045]">
                                      {obj.title}
                                    </span>
                                    {briefWhenLabel(obj) && (
                                      <span className="block truncate text-[9px] font-semibold text-[#251045]/55">
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
                          ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                          : 'bg-[#FBFAFD] text-[#251045] border-[#D6CFE4] hover:border-[#6C3EC9]'
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
                    ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                    : 'bg-[#FBFAFD] text-[#251045]/60 border-[#D6CFE4] hover:border-[#6C3EC9]'
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
                        ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                        : 'bg-[#FBFAFD] text-[#251045] border-[#D6CFE4]'
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
                        ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                        : 'bg-[#FBFAFD] text-[#251045] border-[#D6CFE4]'
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
                  <h2 className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#251045]/60">
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
                          className="group relative min-h-[170px] overflow-hidden rounded-2xl border border-[#D6CFE4] bg-[#FBFAFD] text-left transition-transform duration-200 hover:-translate-y-0.5 hover:border-[#6C3EC9]"
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
                            <div className="absolute inset-0 bg-gradient-to-br from-[#3A2169] to-[#2A1657]" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#150826]/90 via-[#150826]/10 to-transparent" />
                          <div className="absolute inset-x-3 bottom-3">
                            <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug text-[#FFFFFF]">
                              {obj.title}
                            </h3>
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
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#251045]/40" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search venues, businesses, organizers, areas…"
                    aria-label="Search Brief"
                    className="w-full rounded-full border border-[#D6CFE4] bg-[#FBFAFD] py-2.5 pl-10 pr-10 text-[13px] font-semibold text-[#251045] outline-none transition-colors placeholder:text-[#251045]/35 focus:border-[#6C3EC9]"
                  />
                  {searchQuery !== '' && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#251045]/40 transition-colors hover:text-[#251045] cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </label>
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
                            className={`group relative min-h-[210px] cursor-pointer overflow-hidden rounded-2xl border bg-[#FBFAFD] transition-transform duration-200 hover:-translate-y-0.5 hover:border-[#6C3EC9] ${
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
                              <div className="absolute inset-0 bg-gradient-to-br from-[#3A2169] to-[#2A1657]" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#150826]/95 via-[#150826]/20 to-[#150826]/05" />
                            <div className="absolute left-3 top-3 flex max-w-[calc(100%-24px)] flex-wrap gap-1.5">
                              <span className="rounded-full bg-[#F1EDF7]/75 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#251045]">
                                {getObjectTypeMeta(obj.type).label}
                              </span>
                              {!obj.imageUrl && obj.category && (
                                <span className="rounded-full bg-[#F1EDF7]/75 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#251045]">
                                  {obj.category}
                                </span>
                              )}
                              {obj.isVerified && (
                                <span className="rounded-full bg-[#5B2EA6] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#FFFFFF]">
                                  VERIFIED
                                </span>
                              )}
                              {status && (
                                <span className="rounded-full bg-[#F1EDF7]/75 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#251045]">
                                  {status}
                                </span>
                              )}
                              {(() => {
                                const life = getLifecycleBadge(obj);
                                if (!life) return null;
                                return (
                                  <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${
                                    life.expired
                                      ? 'bg-[#150826]/80 text-[#FFFFFF]'
                                      : 'bg-[#F1EDF7]/75 text-[#251045]'
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
                                        className="bg-[#150826]/70 text-[#F1EDF7] hover:bg-[#5B2EA6] hover:text-white"
                                      />
                                    ))}
                                  </div>
                                );
                              })()}
                              {level === 3 && destVendors.length > 0 && (
                                <p className="mt-1 text-[10px] font-semibold text-[#FFFFFF]">
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
                                  className="rounded-full border border-[#6C3EC9]/70 bg-[#F1EDF7]/60 px-2.5 py-1 text-[10px] font-bold text-[#251045] transition-colors hover:bg-[#5B2EA6] hover:text-[#FFFFFF]"
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
                                  className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#D6CFE4]/35 bg-[#F1EDF7]/60 text-[#251045] transition-colors hover:border-[#6C3EC9] hover:text-[#251045]"
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
                        <h2 className="text-base font-semibold text-[#251045]">Nothing nearby</h2>
                        <button
                          type="button"
                          onClick={() => handleCreatePursuit(searchQuery)}
                          className="mt-4 rounded-full border border-[#6C3EC9]/60 px-4 py-2 text-[11px] font-bold text-[#251045]"
                        >
                          Keep pursuing
                        </button>
                      </>
                    ) : (
                      <>
                        <h2 className="text-base font-semibold text-[#251045]">Nothing nearby</h2>
                        <div className="mt-4 flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCaptureOpen(true)}
                            className="rounded-full bg-[#5B2EA6] px-4 py-2 text-[11px] font-bold text-[#FFFFFF]"
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
            <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Newspaper className="w-4 h-4 text-[#251045]" />
                <span className="text-[10px] text-[#251045]">
                  Tea
                </span>
              </div>

              <h2 className="text-xl font-extrabold">
                What people are talking about
              </h2>

              <p className="text-xs text-[#251045] mt-1">
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
                        ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                        : 'bg-[#FBFAFD] text-[#251045] border-[#D6CFE4] hover:border-[#6C3EC9]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px] font-extrabold whitespace-nowrap">
                      {label}
                    </span>
                    <span
                      className={`text-[10px] ${
                        isActive ? 'text-[#FFFFFF]/70' : 'text-[#251045]/60'
                      }`}
                    >
                      {count}
                    </span>
                    {edition === liveEdition && !isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5B2EA6] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] text-[#251045]/60 px-1">
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
                  className={`bg-[#FBFAFD] border rounded-2xl p-4 ${
                    post.isPromoted ? 'border-[#6C3EC9]' : 'border-[#D6CFE4]'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border bg-[#F1EDF7] ${kindMeta.tone}`}
                    >
                      {kindMeta.label}
                    </span>

                    <span className="text-[11px] font-bold text-[#251045]">
                      {post.authorName}
                    </span>

                    {post.authorIsVerified && (
                      <ShieldCheck className="w-3 h-3 text-[#251045] shrink-0" />
                    )}

                    <span className="text-[10px] text-[#251045]/60">
                      {getRelativeTime(post.publishedAt)}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-[#251045] leading-snug">
                    {post.title}
                  </h3>

                  <p className="text-xs text-[#251045] mt-1.5 leading-relaxed">
                    {post.body}
                  </p>

                  {post.isPromoted && (
                    <p className="text-[10px] text-[#251045] mt-2">
                      Paid distribution by {post.promotedBy}.
                    </p>
                  )}

                  {subject && (
                    <button
                      onClick={() => openPostSubject(post)}
                      className="mt-3 w-full flex items-center gap-2 bg-[#F1EDF7] border border-[#D6CFE4] hover:border-[#6C3EC9] rounded-xl p-2.5 transition cursor-pointer group text-left"
                    >
                      {subject.imageUrl && (
                        <img
                          src={subject.imageUrl}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover shrink-0"
                        />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] text-[#251045]/60">
                          About this {getObjectTypeMeta(subject.type).label}
                        </div>
                        <div className="text-[11px] font-extrabold truncate group-hover:text-[#251045]">
                          {subject.title}
                        </div>
                      </div>

                      <ArrowRight className="w-3.5 h-3.5 text-[#251045] shrink-0" />
                    </button>
                  )}

                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#D6CFE4]">
                    <button
                      onClick={() => toggleLike(post)}
                      className={`flex items-center gap-1.5 text-[11px] font-bold cursor-pointer transition ${
                        isLiked ? 'text-[#251045]' : 'text-[#251045]/60 hover:text-[#251045]'
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`}
                      />
                      {formatCount(post.reactionsCount + (isLiked ? 1 : 0))}
                    </button>

                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#251045]/60">
                      No discussion yet
                    </span>

                    {post.tags && post.tags.length > 0 && (
                      <span className="ml-auto text-[10px] text-[#251045]/60 truncate">
                        {post.tags.map((tag: any) => `#${tag}`).join(' ')}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}

            {editionPosts.length === 0 && (
              <div className="py-16 text-center border border-dashed border-[#D6CFE4] rounded-2xl">
                <Newspaper className="w-8 h-8 mx-auto mb-3 text-[#251045]/60" />
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
            setArenaSection={setArenaSection}
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
              <h2 className="text-lg font-extrabold text-[#251045]">Today</h2>
              <p className="text-[11px] text-[#251045]/60 leading-snug mt-1">
                Only what relates to your pursuits, saved and watched things.
              </p>
            </div>

            {dailyBrief.length === 0 && (
              <div className="border border-dashed border-[#D6CFE4] rounded-2xl p-8 text-center">
                <p className="text-xs text-[#251045]/60">Nothing to report.</p>
                <p className="text-[10px] text-[#251045]/40 mt-1">
                  Save something, or start a pursuit, and this fills itself in.
                </p>
              </div>
            )}

            {dailyBrief.map((section: any) => (
              <div key={section.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-extrabold text-[#251045]">
                    {section.title}
                  </h3>
                  <span className="text-[10px] text-[#251045]/60">
                    {section.objects.length + section.pursuits.length}
                  </span>
                </div>

                {section.objects.map((obj: any) => (
                  <button
                    key={obj.id}
                    onClick={() => setSelectedObjectForDetail(obj)}
                    className="w-full text-left bg-[#FBFAFD] border border-[#D6CFE4] hover:border-[#D6CFE4] rounded-xl p-3 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] text-[#251045]/40">
                        {getObjectTypeMeta(obj.type).label}
                      </span>
                      {getDistanceLabel(obj) && (
                        <span className="text-[9px] text-[#251045]/60">
                          {getDistanceLabel(obj)}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] font-bold text-[#251045] leading-snug mt-0.5">
                      {obj.title}
                    </p>
                    {obj.metadata?.statusBadge && (
                      <p className="text-[10px] text-[#251045] mt-0.5">
                        {obj.metadata.statusBadge}
                      </p>
                    )}
                  </button>
                ))}

                {section.pursuits.map((pursuit: any) => (
                  <button
                    key={pursuit.id}
                    onClick={() => { setActiveTab('nearby'); setNearbySection('pursuits'); }}
                    className="w-full text-left bg-[#FBFAFD] border border-[#D6CFE4] rounded-xl p-3 cursor-pointer"
                  >
                    <p className="text-[11px] text-[#251045]/60">{pursuit.query}</p>
                    <p className="text-[9px] text-[#251045]/40 mt-0.5">
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
    </>
  );
}
