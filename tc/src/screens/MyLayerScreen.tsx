import React, { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import * as briefApi from '../api/briefApi';
import type { Campaign as ApiCampaign, CampaignType as ApiCampaignType } from '../api/types';
import { SAVED_BUNDLES, SAVED_TABS } from '../ui/names';
import type { ArenaMatch, BriefObject, ConnectedSource, Destination, GroupCommandResult, MyLayerSection, ObjectRelationship, WorkflowSection , GroupAccess, GroupKnowledgeEntry, ObjectType, Quest, SaveLabel } from '../model/core';
import { SAVE_LABELS, GROUP_MESSAGES, arenaPlayerLabel, formatSourceDate, getDistanceLabel, getUnansweredQuestions, isResultConfirmed, resolveAction , getBriefRank, runGroupCommand } from '../model/core';

import { Bookmark } from 'lucide-react';
import { Plus } from 'lucide-react';
import { Search } from 'lucide-react';
import { Share2 } from 'lucide-react';
import { Trash2 } from 'lucide-react';
import { Circles } from '../components/Circles';
import { ConnectedGroups } from '../components/ConnectedGroups';
import { CreatorProfilePanel } from '../components/CreatorPanels';
import { MessagesPanel } from '../components/CreatorPanels';
import { MyTickets } from '../components/MyTickets';
import { OpportunitiesPanel } from '../components/CreatorPanels';
import RewardsDesk from '../components/RewardsDesk';
import { SubscriptionsPanel } from '../components/CreatorPanels';
import { VerificationPanel } from '../components/VerificationPanel';


// NOTE: prop type names left as-written in App (types not yet exported): ApiCampaign, ApiCampaignType

// ---------------------------------------------------------------------------
// MY-LAYER SCREEN — extracted from App.tsx (Phase 1: JSX move; shell keeps
// the state, and the colocation pass tightens types afterwards). Section
// switching is verbatim; what each section renders did not change.
// ---------------------------------------------------------------------------

export interface MyLayerScreenProps {
  openGroupId: string | null;
  quests: Quest[];
  sessionUser: briefApi.AuthedUser | null;
  setGroups: React.Dispatch<React.SetStateAction<ConnectedSource[]>>;
  setPersonalState: React.Dispatch<React.SetStateAction<briefApi.PersonalState | null>>;
  setRelationships: React.Dispatch<React.SetStateAction<ObjectRelationship[]>>;
  setSavedGroupEntryIds: React.Dispatch<React.SetStateAction<string[]>>;
  activeTab: Destination;
  arenaBusyId: string | null;
  beginEdit: any;
  campaignBusy: boolean;
  campaignState: {
    status: 'idle' | 'loading' | 'ready' | 'error';
    data: ApiCampaign[] | null;
    error: string | null;
  };
  draft: {
    title: string;
    type: ApiCampaignType;
    description: string;
    location: string;
    startsAt: string;
    capacity: string;
    price: string;
    circleId: string;
  };
  graph: any;
  groupIndex: any;
  groupIndexes: any;
  groups: ConnectedSource[];
  handleAbandonMatch: any;
  handleConfirmMatch: any;
  handleCreatePursuit: any;
  handleExecuteProtocolAction: any;
  handleRemoveCampaign: any;
  handleReportMatch: any;
  loadCampaigns: any;
  matches: ArenaMatch[];
  myContribution: any;
  myLayerSection: MyLayerSection;
  objects: BriefObject[];
  openCampaign: any;
  openGroup: any;
  relationships: ObjectRelationship[];
  savedObjects: any;
  setActiveTab: React.Dispatch<React.SetStateAction<Destination>>;
  setCampaignActionError: React.Dispatch<React.SetStateAction<string | null>>;
  setCampaignBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setCreateStep: React.Dispatch<React.SetStateAction<'closed' | 'form' | 'preview' | 'published'>>;
  setDraft: React.Dispatch<React.SetStateAction<{
    title: string;
    type: ApiCampaignType;
    description: string;
    location: string;
    startsAt: string;
    capacity: string;
    price: string;
    circleId: string;
  }>>;
  setMyLayerSection: React.Dispatch<React.SetStateAction<MyLayerSection>>;
  setObjectPicker: React.Dispatch<React.SetStateAction<{
    open: boolean;
    status: 'idle' | 'loading' | 'ready' | 'error';
    data: any[] | null;
    error: string | null;
    selected: { id: string; title: string } | null;
  }>>;
  setOpenGroupId: React.Dispatch<React.SetStateAction<string | null>>;
  setPublishedCampaign: React.Dispatch<React.SetStateAction<ApiCampaign | null>>;
  setSelectedObjectForDetail: any;
  setWorkflowSection: React.Dispatch<React.SetStateAction<WorkflowSection>>;
  setWorkflowView: React.Dispatch<React.SetStateAction<'queue' | 'screen'>>;
  shareCampaign: any;
  showToast: any;
  visibleGroups: any;
}

export function MyLayerScreen(props: MyLayerScreenProps) {
  const {
    activeTab,
    arenaBusyId,
    beginEdit,
    campaignBusy,
    campaignState,
    draft,
    graph,
    groupIndex,
    groupIndexes,
    groups,
    handleAbandonMatch,
    handleConfirmMatch,
    handleCreatePursuit,
    handleExecuteProtocolAction,
    handleRemoveCampaign,
    handleReportMatch,
    loadCampaigns,
    matches,
    myContribution,
    myLayerSection,
    objects,
    openCampaign,
    openGroup,
    relationships,
    savedObjects,
    setActiveTab,
    setCampaignActionError,
    setCampaignBusy,
    setCreateStep,
    setDraft,
    setMyLayerSection,
    setObjectPicker,
    setOpenGroupId,
    setPublishedCampaign,
    setSelectedObjectForDetail,
    setWorkflowSection,
    setWorkflowView,
    shareCampaign,
    showToast,
    visibleGroups,
    openGroupId,
    quests,
    sessionUser,
    setGroups,
    setPersonalState,
    setRelationships,
    setSavedGroupEntryIds,
  } = props;

  // -- colocated from App (ownership pass) -----------------------------------
  const activeSavedBundle = SAVED_BUNDLES.find((b) =>
    (b.sections as readonly string[]).includes(myLayerSection)
  ) ?? SAVED_BUNDLES[0];

  const campaignsLive = (campaignState.data ?? []).filter(
    (c) => c.status === 'published' || c.status === 'live'
  );

  const campaignsDraft = (campaignState.data ?? []).filter((c) => c.status === 'draft');

  const campaignsPast = (campaignState.data ?? []).filter(
    (c) => c.status === 'closed' || c.status === 'completed' || c.status === 'cancelled'
  );

  const savedGroups = useMemo(() => {
    const order: { type: ObjectType; label: string }[] = [
      { type: 'place', label: 'Places' },
      { type: 'service', label: 'Services' },
      { type: 'opportunity', label: 'Opportunities' },
      { type: 'product', label: 'Products' },
      { type: 'experience', label: 'Events' },
      { type: 'knowledge', label: 'Information' },
      { type: 'identity', label: 'Organisations' },
      { type: 'business', label: 'Businesses' },
      { type: 'offer', label: 'Offers' },
      { type: 'news', label: 'News' },
      { type: 'alert', label: 'Alerts' },
      { type: 'announcement', label: 'Announcements' }
    ];

    return order
      .map(({ type, label }) => ({
        label,
        items: savedObjects.filter((obj: any) => obj.type === type)
      }))
      .filter(({ items }) => items.length > 0);
  }, [savedObjects]);

  const handleSetSaveLabel = (object: BriefObject, label: SaveLabel) => {
    setRelationships((prev) =>
      prev.map((r) =>
        r.targetId === object.id && r.verb === 'saved'
          ? { ...r, label: r.label === label ? undefined : label, updatedAt: new Date().toISOString() }
          : r
      )
    );
  };

  const unansweredQuestions = useMemo(
    () => getUnansweredQuestions(groupIndex),
    [groupIndex]
  );

  const handleRevokeGroup = (id: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, access: 'revoked' as GroupAccess } : g))
    );
    if (openGroupId === id) setOpenGroupId(null);
    showToast('Access revoked. Brief will stop reading this group.');
  };

  const handleSaveGroupEntry = (entry: GroupKnowledgeEntry) => {
    const group = visibleGroups.find((g: any) => g.id === entry.groupId);
    if (!group || !group.permissions?.canRetain) {
      showToast('This group does not allow saving.');
      return;
    }
    setSavedGroupEntryIds((prev) =>
      prev.includes(entry.id) ? prev : [...prev, entry.id]
    );
    showToast('Saved with its source.');
  };

  const handleViewSource = (entry: GroupKnowledgeEntry) => {
    const group = visibleGroups.find((g: any) => g.id === entry.groupId);
    // Brief states where it came from. It does not fabricate a deep link into
    // a platform that may not support one.
    showToast(
      `${entry.source.sourceType} in ${group ? group.name : 'this group'} - ` +
        `${formatSourceDate(entry.source.timestamp)}`
    );
  };

  const myRank = useMemo(() => getBriefRank(myContribution), [myContribution]);

  const pendingCount = useMemo(
    () => quests.filter((q: Quest) => q.status === 'submitted').length,
    [quests]
  );

  const CURRENT_PLAYER_ID = sessionUser?.id ?? '';

  const [commandText, setCommandText] = useState('');

  const [commandResult, setCommandResult] = useState<GroupCommandResult | null>(null);

  const handleRunCommand = (override?: string) => {
    const raw = (override ?? commandText).trim();
    if (raw === '' || !openGroup) return;

    // A bare question is treated as /ask, so members never have to learn
    // command syntax to get an answer.
    const normalised = raw.startsWith('/') ? raw : `/ask ${raw}`;

    const result = runGroupCommand(normalised, {
      entries: groupIndex,
      objects,
      savedObjects,
      now: new Date('2026-08-15T00:00:00Z')
    });

    if (!result) {
      showToast('Unknown command');
      setCommandResult(null);
      return;
    }
    setCommandResult(result);
  };

  const handleUnsave = (object: BriefObject) => {
    setRelationships((prev) =>
      prev.filter(
        (rel) => !(rel.targetId === object.id && rel.verb === 'saved')
      )
    );
    // Durable copy stays in step: the server-side save is removed too.
    void briefApi.unsaveObjectForMe(object.id).then((r) => {
      if (r.ok) setPersonalState((p) => (p ? { ...p, saved: r.data.saved } : p));
    });
    showToast(`Removed "${object.title}" from your saved things.`);
  };

  return (
    <>
{ (
          <div className="max-w-3xl mx-auto px-4 pt-3 pb-1">
            <div className="flex items-end justify-between gap-2 pb-2">
              <div className="min-w-0">
                <h1 className="text-lg font-extrabold text-[#251045] tracking-tight">
                  Your Layer — Things you've kept
                </h1>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#251045]/50 mt-0.5">
                  {activeSavedBundle.hint}
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] bg-[#E9E4F2] text-[#251045]/60 px-2.5 py-1 rounded-full">
                {activeSavedBundle.sections.length} screens
              </span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2">
              {SAVED_BUNDLES.map((bundle: any) => (
                <button
                  key={bundle.id}
                  onClick={() => setMyLayerSection(bundle.sections[0] as MyLayerSection)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold border cursor-pointer transition ${
                    activeSavedBundle.id === bundle.id
                      ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                      : 'bg-[#FBFAFD] text-[#251045] border-[#D6CFE4]'
                  }`}
                >
                  {bundle.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 border-t border-[#D6CFE4] pt-2">
              {activeSavedBundle.sections.map((id: any) => (
                <button
                  key={id}
                  onClick={() => setMyLayerSection(id as MyLayerSection)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                    myLayerSection === id
                      ? 'bg-[#5B2EA6] text-[#FFFFFF]'
                      : 'text-[#251045]/60 hover:text-[#251045] bg-[#F1EDF7]'
                  }`}
                >
                  {SAVED_TABS[id]}
                </button>
              ))}
            </div>
          </div>
        )}
        {myLayerSection === 'saved' && (
          <section className="space-y-4">
            <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Bookmark className="w-4 h-4 text-[#251045]" />
                <span className="text-[10px] text-[#251045]">
                  Your saved things
                </span>
              </div>

              <h2 className="text-xl font-extrabold">Things you've kept.</h2>

              <p className="text-xs text-[#251045] mt-1">
                {savedObjects.length > 0
                  ? `${savedObjects.length} saved across ${savedGroups.length} ${
                      savedGroups.length === 1 ? 'section' : 'sections'
                    }.`
                  : 'Your saved places, opportunities and useful information.'}
              </p>
            </div>

            {savedGroups.map((group: any) => (
              <div key={group.label}>
                <div className="flex items-baseline gap-2 mb-2 px-1">
                  <h3 className="text-[11px] font-extrabold text-[#251045]">
                    {group.label}
                  </h3>
                  <span className="text-[10px] text-[#251045]/60">
                    {group.items.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {group.items.map((obj: any) => {
                    const action = resolveAction(obj);
                    const distance = getDistanceLabel(obj);

                    return (
                      <div
                        key={obj.id}
                        className="bg-[#FBFAFD] border border-[#D6CFE4] hover:border-[#6C3EC9] rounded-2xl p-3 transition"
                      >
                        <button
                          onClick={() => setSelectedObjectForDetail(obj)}
                          className="w-full text-left cursor-pointer group"
                        >
                          <div className="flex items-start gap-3">
                            {obj.imageUrl && (
                              <img
                                src={obj.imageUrl}
                                alt=""
                                className="w-12 h-12 rounded-lg object-cover shrink-0"
                              />
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="text-[9px] text-[#251045]/60">
                                {obj.category}
                              </div>
                              <div className="text-xs font-extrabold mt-0.5 line-clamp-2 group-hover:text-[#251045]">
                                {obj.title}
                              </div>
                              {distance && (
                                <div className="text-[10px] text-[#251045]/60 mt-1">
                                  {distance}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-2 mt-3">
                          {action.kind === 'internal' || action.kind === 'none' ? (
                            <button
                              onClick={() => setSelectedObjectForDetail(obj)}
                              className="flex-1 py-2 rounded-xl bg-[#FBFAFD] border border-[#D6CFE4] text-[#251045] font-extrabold text-[11px] cursor-pointer"
                            >
                              View details
                            </button>
                          ) : (
                            <a
                              href={action.href}
                              target={action.kind === 'phone' ? undefined : '_blank'}
                              rel={
                                action.kind === 'phone'
                                  ? undefined
                                  : 'noopener noreferrer'
                              }
                              onClick={() =>
                                handleExecuteProtocolAction(
                                  action.kind === 'phone' ? 'contact' : 'discover',
                                  obj,
                                  { silent: true }
                                )
                              }
                              className="flex-1 py-2 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              {action.label}
                              <ArrowRight className="w-3 h-3" />
                            </a>
                          )}

                          <button
                            onClick={() => handleCreatePursuit(obj.title)}
                            title="Pursue similar"
                            className="p-2 rounded-xl bg-[#FBFAFD] text-[#251045] border border-[#D6CFE4] hover:border-[#6C3EC9] cursor-pointer"
                          >
                            <Search className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleUnsave(obj)}
                            title="Remove from saved"
                            className="p-2 rounded-xl bg-[#FBFAFD] text-[#251045] border border-[#D6CFE4] hover:border-[#6C3EC9] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Why this was saved (prompt 10). Optional: an
                            unlabelled save is a perfectly valid save, so this
                            is a quiet row of toggles, never a required step. */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {SAVE_LABELS.map((label) => {
                            const active = graph.savedLabel(obj.id) === label;
                            return (
                              <button
                                key={label}
                                onClick={() => handleSetSaveLabel(obj, label)}
                                className={`text-[9px] font-bold px-2 py-0.5 rounded-full border cursor-pointer transition ${
                                  active
                                    ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                                    : 'bg-transparent text-[#251045]/40 border-[#D6CFE4] hover:border-[#D6CFE4]'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Activity (prompt 19). Derived from the same relationships,
                not a second history store. Secondary to saved objects. */}
            {(() => {
              const recent = graph.activity(6);
              if (recent.length === 0) return null;

              return (
                <div className="mt-8 pt-5 border-t border-[#D6CFE4]">
                  <p className="text-[10px] text-[#251045]/40 mb-3">
                    Recent activity
                  </p>
                  <div className="space-y-1.5">
                    {recent.map((entry: any) => (
                      <button
                        key={`${entry.object.id}_${entry.verb}`}
                        onClick={() => setSelectedObjectForDetail(entry.object)}
                        className="w-full text-left flex items-center gap-2 py-1.5 cursor-pointer"
                      >
                        <span className="text-[9px] text-[#251045] w-20 shrink-0">
                          {entry.verb}
                        </span>
                        <span className="text-[11px] text-[#251045]/60 truncate">
                          {entry.object.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {savedObjects.length === 0 && (
              <div className="py-14 text-center">
                <Bookmark className="w-8 h-8 mx-auto mb-3 text-[#251045]/40" />
                <p className="font-display text-lg font-semibold text-[#251045]">Nothing kept yet.</p>
                <p className="mt-1 text-xs text-[#251045]/60">
                  Save a place or opportunity and it will sit here, quiet and waiting.
                </p>
              </div>
            )}
          </section>
        )}
        {myLayerSection === 'activity' && (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#251045]">My Activity</h2>
              <p className="text-[11px] text-[#251045]/60 leading-snug mt-1">
                What you have saved, watched and acted on.
              </p>
            </div>
            {relationships.length === 0 && (
              <p className="text-xs text-[#251045]/60">Nothing yet.</p>
            )}
            <div className="space-y-2">
              {[...relationships]
                .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
                .map((rel) => {
                  const obj = objects.find((o) => o.id === rel.targetId);
                  return (
                    <button
                      key={rel.id}
                      type="button"
                      disabled={!obj}
                      onClick={() => {
                        if (obj) setSelectedObjectForDetail(obj);
                      }}
                      className="w-full bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-3 flex items-center gap-3 text-left cursor-pointer disabled:cursor-default disabled:opacity-70"
                    >
                      <span className="text-[9px] text-[#251045] shrink-0">
                        {rel.verb}
                      </span>
                      <p className="text-xs text-[#251045] flex-1 min-w-0 truncate">
                        {obj ? obj.title : rel.targetId}
                      </p>
                      <span className="text-[9px] text-[#251045]/40 shrink-0">
                        {rel.updatedAt.slice(0, 10)}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}
        {myLayerSection === 'arena' && (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#251045]">Your Arena</h2>
              <p className="text-[11px] text-[#251045]/60 leading-snug mt-1">
                Your matches. Play is recorded when both players confirm a result.
              </p>
            </div>
            <h3 className="text-[11px] font-extrabold text-[#251045]/40">
              My Matches
            </h3>
            {matches.length === 0 && (
              <p className="text-xs text-[#251045]/60">
                No matches yet. Accept a challenge in Arena to start one.
              </p>
            )}
            <div className="space-y-2">
              {matches.map((m) => {
                const me = CURRENT_PLAYER_ID;
                const status = m.status ?? (isResultConfirmed(m) ? 'confirmed' : 'scheduled');
                const iReported = Boolean(me) && m.reportedBy === me;
                const waiting = status === 'reported' && iReported;
                const canConfirm = status === 'reported' && Boolean(me) && !iReported;
                const canReport = status === 'scheduled' && Boolean(me);
                const opponent = m.playerAId === me ? m.playerBId : m.playerAId;
                return (
                  <div key={m.id} className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-3 space-y-2">
                    <p className="text-xs text-[#251045]">
                      {arenaPlayerLabel(m.playerAId, me || null, m.playerAName)} vs {arenaPlayerLabel(m.playerBId, me || null, m.playerBName)}
                    </p>
                    <p className="text-[10px] text-[#251045]/60">
                      {status === 'confirmed'
                        ? (m.scoreLine || 'Confirmed')
                        : status === 'disputed'
                        ? 'Players disagreed. Brief does not pick a winner.'
                        : status === 'abandoned'
                        ? 'Abandoned'
                        : waiting
                        ? 'Waiting for the other player to confirm'
                        : 'Result not confirmed by both players'}
                    </p>
                    {canReport && (
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" disabled={arenaBusyId === m.id} onClick={() => void handleReportMatch(m, me)} className="px-2.5 py-1.5 rounded-lg bg-[#5B2EA6] text-[#FFFFFF] text-[10px] font-extrabold cursor-pointer disabled:opacity-40">I won</button>
                        <button type="button" disabled={arenaBusyId === m.id} onClick={() => void handleReportMatch(m, opponent ?? null)} className="px-2.5 py-1.5 rounded-lg border border-[#D6CFE4] text-[#251045] text-[10px] font-extrabold cursor-pointer disabled:opacity-40">They won</button>
                        <button type="button" disabled={arenaBusyId === m.id} onClick={() => void handleReportMatch(m, null)} className="px-2.5 py-1.5 rounded-lg border border-[#D6CFE4] text-[#251045] text-[10px] font-extrabold cursor-pointer disabled:opacity-40">Draw</button>
                        <button type="button" disabled={arenaBusyId === m.id} onClick={() => void handleAbandonMatch(m)} className="px-2.5 py-1.5 rounded-lg border border-[#D6CFE4] text-[#251045]/60 text-[10px] font-extrabold cursor-pointer disabled:opacity-40">Never happened</button>
                      </div>
                    )}
                    {canConfirm && (
                      <button type="button" disabled={arenaBusyId === m.id} onClick={() => void handleConfirmMatch(m)} className="px-3 py-1.5 rounded-lg bg-[#5B2EA6] text-[#FFFFFF] text-[10px] font-extrabold cursor-pointer disabled:opacity-40">
                        Confirm result
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {myLayerSection === 'points' && (
          <RewardsDesk
            settledPoints={myContribution.settledPoints}
            rank={myRank}
            accepted={myContribution.accepted}
            pending={pendingCount}
          />
        )}
        {myLayerSection === 'circles' && (
          <div className="max-w-3xl mx-auto px-4 py-6">
            <Circles />
          </div>
        )}
        {myLayerSection === 'groups' && (
          <ConnectedGroups
            visibleGroups={visibleGroups}
            groupIndexes={groupIndexes}
            openGroup={openGroup}
            setOpenGroupId={setOpenGroupId}
            groupIndex={groupIndex}
            unansweredQuestions={unansweredQuestions}
            handleRevokeGroup={handleRevokeGroup}
            handleSaveGroupEntry={handleSaveGroupEntry}
            handleViewSource={handleViewSource}
            commandResult={commandResult}
            setCommandResult={setCommandResult}
            commandText={commandText}
            setCommandText={setCommandText}
            getUnansweredQuestions={getUnansweredQuestions}
            groupMessages={GROUP_MESSAGES}
            formatSourceDate={formatSourceDate}
            handleRunCommand={handleRunCommand}
            setSelectedObjectForDetail={setSelectedObjectForDetail}
          />
        )}
        {myLayerSection === 'tickets' && (
          <MyTickets
            onSell={() => {
              // Selling is a Workflows → Sell act: the money side of the seat
              // lives with the rest of the money, not in the personal layer.
              setActiveTab('workflows');
              setWorkflowView('screen');
              setWorkflowSection('resale');
            }}
          />
        )}
        {myLayerSection === 'campaigns' && (
          <div className="space-y-4">

            {/* CAMPAIGNS. Create something, publish it, share one link, watch
                who turns up. Every figure below is read from the server. */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold text-[#251045]">Events</h2>
                <p className="text-[11px] text-[#251045]/60 leading-snug mt-1">
                  Things you are putting out into the world. Publish once, share
                  one link, see who registered.
                </p>
              </div>
              <button
                onClick={() => {
                  setCampaignActionError(null);
                  setPublishedCampaign(null);
                  setDraft({
                    title: '', type: 'popup', description: '', location: '',
                    startsAt: '', capacity: '', price: '', circleId: ''
                  });
                  setObjectPicker({
                    open: false, status: 'idle', data: null, error: null, selected: null
                  });
                  setCreateStep('form');
                }}
                className="shrink-0 px-3 py-2 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-[11px] cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Create
              </button>
            </div>

            {campaignState.status === 'idle' && (
              <button
                onClick={loadCampaigns}
                className="w-full border border-[#D6CFE4] rounded-2xl p-4 text-xs font-extrabold text-[#251045] cursor-pointer"
              >
                Load my campaigns
              </button>
            )}

            {campaignState.status === 'loading' && (
              <div className="border border-[#D6CFE4] rounded-2xl p-8 text-center">
                <p className="text-xs text-[#251045]/60">Loading campaigns...</p>
              </div>
            )}

            {campaignState.status === 'error' && (
              <div className="border border-[#D6CFE4] bg-[#FBFAFD] rounded-2xl p-4 space-y-2">
                <p className="text-xs text-[#251045] font-extrabold">
                  Couldn't load campaigns. Try again.
                </p>
                <p className="text-[10px] text-[#251045]/60 break-words">
                  {campaignState.error}
                </p>
                <button
                  onClick={loadCampaigns}
                  className="px-3 py-1.5 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-[10px] cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {campaignState.status === 'ready' && (campaignState.data ?? []).length === 0 && (
              <div className="border border-dashed border-[#D6CFE4] rounded-2xl p-8 text-center">
                <p className="text-xs text-[#251045]/60">You haven't created a campaign yet.</p>
              </div>
            )}

            {campaignState.status === 'ready' && campaignsLive.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[9px] text-[#251045]/40">
                  Live
                </h3>
                {campaignsLive.map((c: any) => (
                  <div
                    key={c.id}
                    className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-[#251045] truncate">{c.title}</p>
                        <p className="text-[10px] text-[#251045]/60 mt-0.5 truncate">
                          {[c.location, c.startsAt ? c.startsAt.slice(0, 16).replace('T', ' ') : null]
                            .filter(Boolean)
                            .join(' \u00b7 ') || 'No place or time set'}
                        </p>
                      </div>
                      <span className="shrink-0 text-[9px] text-[#251045]">
                        {c.status}
                      </span>
                    </div>

                    {/* Capacity is printed from server values only. */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span className="text-[11px] text-[#251045]">
                        {c.metrics.slotsTaken}
                        {c.metrics.capacity === null ? ' registered' : ` / ${c.metrics.capacity}`}
                      </span>
                      <span className="text-[11px] text-[#251045]">
                        {c.metrics.currency} {c.metrics.revenueSettled.toLocaleString()} settled
                      </span>
                      {c.metrics.revenuePending > 0 && (
                        <span className="text-[11px] text-[#251045]">
                          {c.metrics.currency} {c.metrics.revenuePending.toLocaleString()} pending
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => openCampaign(c.id)}
                        className="px-3 py-1.5 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-[10px] cursor-pointer"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => shareCampaign(c)}
                        className="px-3 py-1.5 rounded-xl border border-[#D6CFE4] text-[#251045] font-extrabold text-[10px] cursor-pointer flex items-center gap-1"
                      >
                        <Share2 className="w-3 h-3" />
                        Share
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Cancel and remove this event?')) {
                            void handleRemoveCampaign(c.id);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 text-red-600 font-extrabold text-[10px] cursor-pointer hover:bg-red-100 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {campaignState.status === 'ready' && campaignsDraft.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[9px] text-[#251045]/40">
                  Drafts
                </h3>
                {campaignsDraft.map((c: any) => (
                  <div
                    key={c.id}
                    className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-[#251045] truncate">
                        {c.title || 'Untitled'}
                      </p>
                      <p className="text-[9px] text-[#251045]/40 mt-0.5">
                        {c.type} - not published
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      <button
                        onClick={() => { openCampaign(c.id); beginEdit(c); }}
                        className="px-3 py-1.5 rounded-xl border border-[#D6CFE4] text-[#251045] font-extrabold text-[10px] cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        disabled={campaignBusy}
                        onClick={async () => {
                          setCampaignBusy(true);
                          setCampaignActionError(null);
                          const res = await briefApi.campaignAction(c.id, 'publish');
                          setCampaignBusy(false);
                          if (!res.ok) { setCampaignActionError(res.error); showToast(res.error); return; }
                          loadCampaigns();
                          showToast('Published');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-[10px] cursor-pointer disabled:opacity-40"
                      >
                        Publish
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Cancel and remove this draft?')) {
                            void handleRemoveCampaign(c.id);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 text-red-600 font-extrabold text-[10px] cursor-pointer hover:bg-red-100 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {campaignState.status === 'ready' && campaignsPast.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[9px] text-[#251045]/40">
                  Finished
                </h3>
                {campaignsPast.map((c: any) => (
                  <div
                    key={c.id}
                    className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-3 flex items-center justify-between gap-3"
                  >
                    <p className="text-xs text-[#251045]/60 truncate">{c.title}</p>
                    <div className="shrink-0 flex items-center gap-1.5">
                      <button
                        onClick={() => openCampaign(c.id)}
                        className="text-[10px] text-[#251045]/40 underline underline-offset-2 cursor-pointer"
                      >
                        {c.status}
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Remove this finished event?')) {
                            void handleRemoveCampaign(c.id);
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 text-red-600 font-extrabold text-[10px] cursor-pointer hover:bg-red-100 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {myLayerSection === 'mediakit' && (
          <div className="max-w-2xl mx-auto px-4 py-6">
            <CreatorProfilePanel />
          </div>
        )}
        {myLayerSection === 'opportunities' && (
          <div className="max-w-2xl mx-auto px-4 py-6">
            <OpportunitiesPanel />
          </div>
        )}
        {myLayerSection === 'messages' && (
          <div className="max-w-2xl mx-auto px-4 py-6">
            <MessagesPanel />
          </div>
        )}
        {myLayerSection === 'verification' && (
          <div className="max-w-3xl mx-auto px-4 py-6">
            <VerificationPanel />
          </div>
        )}
        {myLayerSection === 'subscriptions' && (
          <div className="max-w-2xl mx-auto px-4 py-6">
            <SubscriptionsPanel />
          </div>
        )}
    </>
  );
}
