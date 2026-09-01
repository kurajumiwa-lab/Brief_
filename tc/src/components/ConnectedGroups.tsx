import React from 'react';
import { MESSAGE_CLASS_LABELS, getObjectTypeMeta } from '../App';
import type {
  BriefObject,
  ConnectedSource,
  GroupKnowledgeEntry,
  GroupCommandResult,
  GroupMessage
} from '../App';

/**
 * CONNECTED GROUPS.
 *
 * The groups Brief has been given permission to read, and the knowledge it
 * has organised out of them. Extracted from App.tsx unchanged.
 *
 * Note the primitive: these are ConnectedSources (message pipes), NOT
 * Circles. Brief has exactly one community primitive -- Circle -- and this
 * surface is deliberately not it. The retired `BriefGroup` type used to blur
 * that line; a connected WhatsApp group is a source of information, whereas a
 * Circle is a community with members, targets and economic activity.
 *
 * Access is enforced upstream in buildGroupIndex, not here: an inaccessible
 * group yields an empty index by construction, so this component cannot leak
 * something it was never given.
 */

export interface ConnectedGroupsProps {
  visibleGroups: ConnectedSource[];
  groupIndexes: Record<string, GroupKnowledgeEntry[]>;
  openGroup: ConnectedSource | null;
  setOpenGroupId: (id: string | null) => void;
  groupIndex: GroupKnowledgeEntry[];
  unansweredQuestions: GroupKnowledgeEntry[];
  handleRevokeGroup: (id: string) => void;
  handleSaveGroupEntry: (e: GroupKnowledgeEntry) => void;
  handleViewSource: (e: GroupKnowledgeEntry) => void;
  commandResult: GroupCommandResult | null;
  setCommandResult: (r: GroupCommandResult | null) => void;
  commandText: string;
  setCommandText: (v: string) => void;
  getUnansweredQuestions: (e: GroupKnowledgeEntry[]) => GroupKnowledgeEntry[];
  groupMessages: GroupMessage[];
  formatSourceDate: (iso: string) => string;
  handleRunCommand: (override?: string) => void;
  setSelectedObjectForDetail: (o: BriefObject | null) => void;
}

export function ConnectedGroups({
  visibleGroups,
  groupIndexes,
  openGroup,
  setOpenGroupId,
  groupIndex,
  unansweredQuestions,
  handleRevokeGroup,
  handleSaveGroupEntry,
  handleViewSource,
  commandResult,
  setCommandResult,
  commandText,
  setCommandText,
  getUnansweredQuestions,
  groupMessages,
  formatSourceDate,
  handleRunCommand,
  setSelectedObjectForDetail
}: ConnectedGroupsProps) {
  // Local alias so the extracted JSX keeps referring to GROUP_MESSAGES.
  const GROUP_MESSAGES = groupMessages;
  return (
    <div className="space-y-4">

      {/* YOUR GROUPS. Only groups this user is a member of or has
          explicitly authorised. Brief never suggests, discovers or
          lists groups the user has no relationship with. */}
      {!openGroup && (
        <>
          <div>
            <h2 className="text-lg font-extrabold text-[#F7F7F8]">Your chats</h2>
            <p className="text-[11px] text-[#F7F7F8]/60 leading-snug mt-1">
              Groups you're a member of where Brief can help organise
              information. Brief does not post, promote or message anyone.
            </p>
          </div>

          {visibleGroups.length === 0 && (
            <div className="border border-dashed border-[#222630] rounded-2xl p-8 text-center">
              <p className="text-xs text-[#F7F7F8]/60">No groups connected.</p>
            </div>
          )}

          {visibleGroups.map((group) => {
            const entries = groupIndexes[group.id] ?? [];
            const open = getUnansweredQuestions(entries);
            return (
              <div
                key={group.id}
                className="bg-[#12151A] border border-[#222630] rounded-2xl p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-[#F7F7F8]">
                      {group.name}
                    </p>
                    <p className="text-[9px] text-[#F7F7F8]/40 mt-0.5">
                      {group.platform} {' '}
                      {group.access === 'member' ? 'Member' : 'Authorised'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setOpenGroupId(group.id);
                      setCommandResult(null);
                    }}
                    className="shrink-0 px-3 py-1.5 rounded-xl bg-[#FF5A1F] text-[#0D0F12] font-extrabold text-[10px] cursor-pointer"
                  >
                    Open
                  </button>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="text-[10px] text-[#F7F7F8]/60">
                    {entries.length} useful items
                  </span>
                  {open.length > 0 && (
                    <span className="text-[10px] text-[#F7F7F8]">
                      {open.length} unanswered
                    </span>
                  )}
                  {group.lastActivityAt && (
                    <span className="text-[10px] text-[#F7F7F8]/40">
                      last activity {group.lastActivityAt.slice(0, 10)}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleRevokeGroup(group.id)}
                  className="text-[9px] text-[#F7F7F8]/40 underline underline-offset-2 cursor-pointer"
                >
                  Revoke Brief's access
                </button>
              </div>
            );
          })}
        </>
      )}

      {openGroup && (
        <div>
          <button
            onClick={() => {
              setOpenGroupId(null);
              setCommandResult(null);
            }}
            className="text-[10px] text-[#F7F7F8] cursor-pointer"
          >
            Back to your groups
          </button>

          <div className="flex items-center gap-2 mt-2">
            <h2 className="text-lg font-extrabold text-[#F7F7F8]">
              {openGroup.name}
            </h2>
            <span className="text-[9px] text-[#F7F7F8]/40">
              {openGroup.platform} {' '}
              {openGroup.access === 'member' ? "You're a member" : 'Authorised'}
            </span>
          </div>
          <p className="text-[11px] text-[#F7F7F8]/60 leading-snug mt-1">
            Brief has organised useful information from this group. It
            does not post, promote or message members.
          </p>
        </div>
      )}

      {/* Ask Brief. A plain question works; slash commands also work. */}
      {openGroup && (
      <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleRunCommand();
        }}
        className="flex gap-2"
      >
        <input
          value={commandText}
          onChange={(e) => setCommandText(e.target.value)}
          placeholder="Ask something about this group..."
          className="flex-1 bg-[#12151A] border border-[#222630] rounded-xl px-3 py-2.5 text-xs text-[#F7F7F8] placeholder:text-[#F7F7F8]/40 outline-none focus:border-[#222630]"
        />
        <button
          type="submit"
          className="px-4 py-2.5 rounded-xl bg-[#FF5A1F] text-[#0D0F12] font-extrabold text-[11px] cursor-pointer"
        >
          Run
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {['/brief', '/jobs', '/events', '/find solar', '/ask permit'].map((c) => (
          <button
            key={c}
            onClick={() => {
              setCommandText(c);
              handleRunCommand(c);
            }}
            className="text-[10px] px-2 py-1 rounded-full bg-[#12151A] border border-[#222630] text-[#F7F7F8] cursor-pointer"
          >
            {c}
          </button>
        ))}
      </div>

      {commandResult && (
        <div className="bg-[#12151A] border border-[#222630] rounded-2xl p-4 space-y-3">
          <p className="text-[9px] text-[#F7F7F8]">
            /{commandResult.command} {commandResult.argument}
          </p>

          {commandResult.brief && (
            <div className="space-y-2">
              <p className="text-[11px] font-extrabold text-[#F7F7F8]">
                This week in the group
              </p>
              {commandResult.brief.lines.map((line) => (
                <div
                  key={line.messageClass}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="text-[11px] text-[#F7F7F8]/60">{line.label}</span>
                  <span className="text-[11px] text-[#F7F7F8]">
                    {line.count}
                  </span>
                </div>
              ))}

              {commandResult.brief.unanswered.length > 0 && (
                <div className="pt-2 border-t border-[#222630] space-y-1">
                  <p className="text-[10px] font-bold text-[#F7F7F8]">
                    {commandResult.brief.unanswered.length} question
                    {commandResult.brief.unanswered.length === 1 ? '' : 's'} still waiting
                  </p>
                  {commandResult.brief.unanswered.map((q) => (
                    <p key={q.id} className="text-[10px] text-[#F7F7F8]/60 leading-snug">
                      {q.originalText}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {commandResult.fromGroup.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-[#F7F7F8]/40">
                From this group
              </p>
              {commandResult.fromGroup.slice(0, 6).map((entry) => (
                <div
                  key={entry.id}
                  className="bg-[#12151A] border border-[#222630] rounded-xl p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-[#F7F7F8]">
                      {MESSAGE_CLASS_LABELS[entry.messageClass]}
                    </span>
                    <span className="text-[9px] text-[#F7F7F8]/40">
                      {entry.sentAt.slice(0, 10)}
                    </span>
                  </div>

                  {/* The original message, always. Brief's reading of it
                      never stands in for what was actually said. */}
                  <p className="text-[11px] text-[#F7F7F8] leading-snug mt-1">
                    {entry.originalText}
                  </p>

                  {entry.mediaKind && entry.mediaKind !== 'message' && (
                    <p className="text-[9px] text-[#F7F7F8]/40 mt-1">
                      from {entry.mediaKind}
                      {entry.mediaAnalysisStatus === 'pending'
                        ? ' - not read yet'
                        : ''}
                    </p>
                  )}

                  {entry.mediaExtractedText &&
                    entry.mediaAnalysisStatus === 'processed' && (
                      <p className="text-[10px] text-[#F7F7F8]/60 leading-snug mt-1 pl-2 border-l-2 border-[#222630]">
                        {entry.mediaExtractedText}
                      </p>
                    )}

                  {entry.answers.map((a) => (
                    <p
                      key={a.messageId}
                      className="text-[10px] text-[#F7F7F8] leading-snug mt-1 pl-2 border-l-2 border-[#222630]"
                    >
                      {a.authorLabel ? `${a.authorLabel}: ` : ''}
                      {a.text}
                    </p>
                  ))}

                  <div className="flex items-center gap-2 mt-1">
                    {entry.authorLabel && (
                      <span className="text-[9px] text-[#F7F7F8]/40">
                        {entry.authorLabel}
                      </span>
                    )}
                    {entry.entities.map((ent) => (
                      <span
                        key={ent.field}
                        className="text-[9px] text-[#F7F7F8]/60"
                      >
                        {ent.field}: {ent.value}
                      </span>
                    ))}
                  </div>

                  {/* Provenance stays attached to the record, and the
                      saved copy lands in the user's own layer first. */}
                  <div className="flex items-center gap-3 pt-2 mt-2 border-t border-[#222630]">
                    <button
                      onClick={() => handleSaveGroupEntry(entry)}
                      className="text-[9px] font-extrabold text-[#F7F7F8] cursor-pointer"
                    >
                      Save to My Layer
                    </button>
                    <button
                      onClick={() => handleViewSource(entry)}
                      className="text-[9px] text-[#F7F7F8]/60 underline underline-offset-2 cursor-pointer"
                    >
                      View source
                    </button>
                    <span className="text-[9px] text-[#F7F7F8]/40 ml-auto">
                      From {openGroup.name}
                      {' - '}
                      {formatSourceDate(entry.source.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {commandResult.fromElsewhere.length > 0 && (
            <div className="space-y-2">
              {/* Deliberately a separate heading: a member must always be
                  able to tell what their group said from what Brief
                  knows from somewhere else. */}
              <p className="text-[10px] text-[#F7F7F8]">
                From your Brief information (not this group)
              </p>
              {commandResult.fromElsewhere.map((obj) => (
                <button
                  key={obj.id}
                  onClick={() => setSelectedObjectForDetail(obj)}
                  className="w-full text-left bg-[#12151A] border border-[#222630] hover:border-[#222630] rounded-xl p-2.5 cursor-pointer"
                >
                  <span className="text-[9px] text-[#F7F7F8]/40">
                    {getObjectTypeMeta(obj.type).label}
                  </span>
                  <p className="text-[11px] font-bold text-[#F7F7F8] mt-0.5">
                    {obj.title}
                  </p>
                </button>
              ))}
            </div>
          )}

          {commandResult.emptyNote && (
            <p className="text-[11px] text-[#F7F7F8]/60">{commandResult.emptyNote}</p>
          )}
        </div>
      )}

      {/* Unanswered questions: groups are terrible at preserving these. */}
      {unansweredQuestions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-extrabold text-[#F7F7F8]">
            {unansweredQuestions.length} questions still waiting
          </h3>
          {unansweredQuestions.map((q) => (
            <div
              key={q.id}
              className="bg-[#12151A] border border-[#222630] rounded-xl p-3"
            >
              <p className="text-[11px] text-[#F7F7F8] leading-snug">
                {q.originalText}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {q.authorLabel && (
                  <span className="text-[9px] text-[#F7F7F8]/40">{q.authorLabel}</span>
                )}
                <span className="text-[9px] text-[#F7F7F8]/40">
                  {q.sentAt.slice(0, 10)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Operational metrics only. No impressions, no engagement. */}
      <div className="border-t border-[#222630] pt-4 space-y-2">
        <h3 className="text-[11px] font-extrabold text-[#F7F7F8]/40">
          Group health
        </h3>
        {[
          ['Messages processed', GROUP_MESSAGES.filter((m) => m.groupId === openGroup.id).length],
          ['Information extracted', groupIndex.length],
          ['Questions asked', groupIndex.filter((e) => e.messageClass === 'question').length],
          ['Questions answered', groupIndex.filter((e) => e.messageClass === 'question' && e.answeredByMessageIds.length > 0).length],
          ['Still unanswered', unansweredQuestions.length]
        ].map(([label, value]) => (
          <div key={String(label)} className="flex items-baseline justify-between gap-3">
            <span className="text-[10px] text-[#F7F7F8]/60">{label}</span>
            <span className="text-[10px] text-[#F7F7F8]/60">{value}</span>
          </div>
        ))}
      </div>
      </>
      )}
    </div>
  );
}
