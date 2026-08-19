import React from 'react';
import type { Member, MemberEvidence } from '../../api/types';

/**
 * CIRCLE MEMBERS + EVIDENCE.
 *
 * TRUST IS EVIDENCE, NEVER A SCORE.
 *
 * There is deliberately no percentage, rating, star count, reliability index
 * or hidden ranking anywhere in this component. A member is described by
 * things that actually happened -- verifications that were recorded, tasks
 * they completed, votes they cast, when they joined -- each of which is
 * checkable and contestable in a way a number never is.
 *
 * A member with no history shows no evidence. That is the honest answer, not
 * a gap to fill with a default rating.
 */

const ROLE_LABEL: Record<string, string> = {
  coordinator: 'Coordinator',
  contributor: 'Contributor',
  scout: 'Scout',
  logistics: 'Logistics',
  observer: 'Observer'
};

export interface CircleMembersProps {
  members: Member[];
  /** Evidence per userId, loaded on demand when a member is expanded. */
  evidence: Record<string, MemberEvidence | 'loading' | 'error'>;
  expandedId: string | null;
  onToggle: (userId: string) => void;
}

export function CircleMembers({
  members,
  evidence,
  expandedId,
  onToggle
}: CircleMembersProps) {
  return (
    <div>
      <h3 className="text-[11px] font-extrabold text-[#4B5162] mb-2">
        Members
      </h3>

      {members.length === 0 ? (
        <p className="text-xs text-[#8A93A6]">No members yet.</p>
      ) : (
        <div className="space-y-2">
          {members.map((member) => {
            const open = expandedId === member.userId;
            const ev = evidence[member.userId];

            return (
              <div
                key={member.id}
                className="bg-[#10141C] border border-[#232A38] rounded-2xl p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-[#F3F1E7] truncate">
                      {member.userId}
                    </p>
                    <p className="text-[9px] text-[#4B5162] mt-0.5">
                      {ROLE_LABEL[member.role] ?? member.role}
                    </p>
                  </div>
                  <button
                    onClick={() => onToggle(member.userId)}
                    className="shrink-0 text-[10px] font-extrabold text-[#43D17A] cursor-pointer"
                  >
                    {open ? 'Hide' : 'Evidence'}
                  </button>
                </div>

                {/* Verifications: each names a specific check that happened. */}
                {member.trust.evidence.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {member.trust.evidence.map((e) => (
                      <span
                        key={e.kind}
                        className="text-[9px] px-2 py-0.5 rounded-full bg-[#10141C] text-[#43D17A]"
                      >
                        {e.label}
                      </span>
                    ))}
                  </div>
                )}

                {open && (
                  <div className="pt-1 space-y-2 border-t border-[#232A38]">
                    {/* Plain factual counts from the server. */}
                    {member.trust.facts.length > 0 && (
                      <ul className="space-y-0.5 mt-2">
                        {member.trust.facts.map((f) => (
                          <li key={f.kind} className="text-[10px] text-[#8A93A6]">
                            {f.label}
                          </li>
                        ))}
                      </ul>
                    )}

                    {ev === 'loading' && (
                      <p className="text-[10px] text-[#8A93A6]">Loading evidence...</p>
                    )}

                    {ev === 'error' && (
                      <p className="text-[10px] text-[#E8A33D]">
                        Couldn't load this member's history.
                      </p>
                    )}

                    {ev && ev !== 'loading' && ev !== 'error' && (
                      <>
                        {ev.summary.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {ev.summary.map((s) => (
                              <span
                                key={s.kind}
                                className="text-[9px] px-2 py-0.5 rounded-full bg-[#090B10] border border-[#232A38] text-[#8A93A6]"
                              >
                                {s.label}
                              </span>
                            ))}
                          </div>
                        )}

                        {ev.evidence.length === 0 ? (
                          <p className="text-[10px] text-[#4B5162]">
                            No recorded activity in this circle yet.
                          </p>
                        ) : (
                          <ul className="space-y-1">
                            {ev.evidence.slice(0, 10).map((item) => (
                              <li
                                key={item.signalId}
                                className="flex items-center gap-2 text-[10px] text-[#8A93A6]"
                              >
                                <span className="min-w-0 truncate">{item.label}</span>
                                <span className="text-[9px] text-[#4B5162] ml-auto shrink-0">
                                  {item.at.slice(0, 10)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
