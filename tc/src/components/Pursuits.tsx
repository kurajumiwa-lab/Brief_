import React from 'react';
import { Trash2 } from 'lucide-react';
import { getObjectTypeMeta, getDistanceLabel, WATCH_CONDITION_LABELS } from '../App';
import type {
  BriefObject,
  Pursuit,
  PursuitMatch,
  PursuitStatus,
  WatchCondition
} from '../App';

/**
 * PURSUITS -- standing intents.
 *
 * "find cheap solar lights near kilimani" is kept as an ongoing pursuit and
 * matched against objects as they arrive. Extracted from App.tsx with
 * behaviour and styling unchanged.
 *
 * Matches are evidence-based: a pursuit only matches an object when the
 * matcher can point at why. Nothing is fabricated to make a pursuit look
 * productive -- a pursuit with no matches says so.
 */

export interface PursuitsProps {
  pursuits: Pursuit[];
  pursuitResults: Record<string, PursuitMatch[]>;
  pursuitDraft: string;
  setPursuitDraft: React.Dispatch<React.SetStateAction<string>>;
  handleCreatePursuit: (rawQuery: string) => void;
  handleRemovePursuit: (id: string) => void;
  handleSetPursuitStatus: (id: string, status: Pursuit['status']) => void;
  handleTogglePursuitWatch: (id: string) => void;
  handleTogglePursuitCondition: (id: string, condition: WatchCondition) => void;
  setSelectedObjectForDetail: (o: BriefObject | null) => void;
}

export function Pursuits({
  pursuits,
  pursuitResults,
  pursuitDraft,
  setPursuitDraft,
  handleCreatePursuit,
  handleRemovePursuit,
  handleSetPursuitStatus,
  handleTogglePursuitWatch,
  handleTogglePursuitCondition,
  setSelectedObjectForDetail
}: PursuitsProps) {
  return (
    <div className="space-y-4">

      <div>
        <h2 className="text-lg font-extrabold text-[#F3F1E7]">Alerts</h2>
        <p className="text-[11px] text-[#8A93A6] leading-snug mt-1">
          Things you have asked Brief to find or keep an eye on. Brief
          searches only what it already holds, so results grow as more
          information arrives.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleCreatePursuit(pursuitDraft);
          setPursuitDraft('');
        }}
        className="flex gap-2"
      >
        <input
          value={pursuitDraft}
          onChange={(e) => setPursuitDraft(e.target.value)}
          placeholder="find a plumber near me"
          className="flex-1 bg-[#10141C] border border-[#232A38] rounded-xl px-3 py-2.5 text-xs text-[#F3F1E7] placeholder-[#4B5162] outline-none focus:border-[#232A38]"
        />
        <button
          type="submit"
          className="px-4 py-2.5 rounded-xl bg-[#43D17A] text-[#090B10] font-extrabold text-[11px] cursor-pointer"
        >
          Search
        </button>
      </form>

      {pursuits.length === 0 && (
        <div className="border border-dashed border-[#232A38] rounded-2xl p-8 text-center">
          <p className="text-xs text-[#8A93A6]">Nothing being pursued yet.</p>
          <p className="text-[10px] text-[#4B5162] mt-1">
            Ask for something above, or start one from any object.
          </p>
        </div>
      )}

      {pursuits.map((pursuit) => {
        const results = pursuitResults[pursuit.id] ?? [];
        const dormant =
          pursuit.status === 'completed' || pursuit.status === 'archived';

        return (
          <div
            key={pursuit.id}
            className="bg-[#10141C] border border-[#232A38] rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-[#F3F1E7] leading-snug">
                  {pursuit.query}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] text-[#8A93A6]">
                    {pursuit.status}
                  </span>
                  {pursuit.watchChanges && (
                    <span className="text-[9px] text-[#43D17A]">
                      watching
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleRemovePursuit(pursuit.id)}
                title="Remove pursuit"
                className="shrink-0 p-2 rounded-xl bg-[#10141C] text-[#43D17A] border border-[#232A38] hover:border-[#43D17A] cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {!dormant && (
              <>
                <p className="text-[10px] text-[#4B5162]">
                  {results.length > 0
                    ? `${results.length} match${results.length === 1 ? '' : 'es'} in Brief`
                    : 'Nothing matching yet'}
                </p>

                {/* Saying "I don't know yet" is a feature, not a
                    failure state. Brief never pads this with guesses. */}
                {results.length === 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-[#8A93A6]">
                      Nothing useful yet.
                    </p>
                    <p className="text-[10px] text-[#8A93A6] leading-snug">
                      Keep this pursuit open and Brief can match new
                      information later.
                    </p>
                    {!pursuit.watchChanges && (
                      <button
                        onClick={() => handleTogglePursuitWatch(pursuit.id)}
                        className="px-3 py-1.5 rounded-full bg-[#10141C] border border-[#232A38] text-[#43D17A] font-extrabold text-[10px] cursor-pointer"
                      >
                        Keep watching
                      </button>
                    )}
                  </div>
                )}

                {results.length > 0 && (
                  <div className="space-y-1.5">
                    {results.slice(0, 4).map((match) => {
                      const distance = getDistanceLabel(match.item);
                      return (
                        <button
                          key={match.item.id}
                          onClick={() => setSelectedObjectForDetail(match.item)}
                          className="w-full text-left bg-[#10141C] border border-[#232A38] hover:border-[#232A38] rounded-xl p-2.5 cursor-pointer transition"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] text-[#4B5162]">
                              {getObjectTypeMeta(match.item.type).label}
                            </span>
                            {distance && (
                              <span className="text-[9px] text-[#8A93A6]">
                                {distance}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-bold text-[#F3F1E7] leading-snug mt-0.5">
                            {match.item.title}
                          </p>
                          {match.item.metadata?.statusBadge && (
                            <p className="text-[9px] text-[#43D17A] mt-0.5">
                              {match.item.metadata.statusBadge}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            <div className="flex flex-wrap gap-1.5 pt-1">
              {(['active', 'paused', 'completed', 'archived'] as PursuitStatus[]).map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => handleSetPursuitStatus(pursuit.id, status)}
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full border cursor-pointer transition ${
                      pursuit.status === status
                        ? 'bg-[#43D17A] text-[#090B10] border-[#43D17A]'
                        : 'bg-transparent text-[#4B5162] border-[#232A38] hover:border-[#232A38]'
                    }`}
                  >
                    {status}
                  </button>
                )
              )}

              <button
                onClick={() => handleTogglePursuitWatch(pursuit.id)}
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full border cursor-pointer transition ${
                  pursuit.watchChanges
                    ? 'bg-[#10141C] text-[#43D17A] border-[#232A38]'
                    : 'bg-transparent text-[#4B5162] border-[#232A38] hover:border-[#232A38]'
                }`}
              >
                watch changes
              </button>
            </div>

            {/* Which changes matter (prompt 5). Model + matching only --
                nothing is monitoring in the background yet. */}
            {pursuit.watchChanges && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[9px] text-[#4B5162]">
                  Tell me about
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(WATCH_CONDITION_LABELS) as WatchCondition[]).map(
                    (condition) => {
                      const on = (pursuit.watchConditions ?? []).includes(
                        condition
                      );
                      return (
                        <button
                          key={condition}
                          onClick={() =>
                            handleTogglePursuitCondition(pursuit.id, condition)
                          }
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border cursor-pointer transition ${
                            on
                              ? 'bg-[#10141C] text-[#43D17A] border-[#232A38]'
                              : 'bg-transparent text-[#4B5162] border-[#232A38] hover:border-[#232A38]'
                          }`}
                        >
                          {WATCH_CONDITION_LABELS[condition]}
                        </button>
                      );
                    }
                  )}
                </div>
                <p className="text-[9px] text-[#4B5162]">
                  Alerts are not live yet. Brief records what matters to you.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
