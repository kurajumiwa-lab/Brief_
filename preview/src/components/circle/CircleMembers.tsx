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
  /**
   * Governance. Only passed when the viewer is this circle's coordinator;
   * the server refuses these calls for anybody else, so the panel never
   * shows controls that would only produce a 403.
   */
  canGovern?: boolean;
  currentUserId?: string;
  busyUserId?: string | null;
  onInvite?: (userId: string, role: Member['role']) => void;
  onRole?: (userId: string, role: Member['role']) => void;
  onRemove?: (userId: string) => void;
}

const GOV_ROLES: Member['role'][] = ['coordinator', 'contributor', 'scout', 'logistics', 'observer'];

export function CircleMembers({
  members,
  evidence,
  expandedId,
  onToggle,
  canGovern = false,
  currentUserId,
  busyUserId,
  onInvite,
  onRole,
  onRemove
}: CircleMembersProps) {
  const [inviteId, setInviteId] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<Member['role']>('contributor');
  const [confirmRemove, setConfirmRemove] = React.useState<string | null>(null);

  const handleInvite = (event: React.FormEvent) => {
    event.preventDefault();
    const id = inviteId.trim();
    if (!id || !onInvite) return;
    onInvite(id, inviteRole);
    setInviteId('');
  };

  return (
    <div>
      <h3 className="text-[11px] font-extrabold text-[#111111]/40 mb-2">
        Members
      </h3>

      {members.length === 0 && !canGovern && (
        <p className="text-xs text-[#111111]/60">No members yet.</p>
      )}
      {members.length === 0 && canGovern && (
        <p className="text-xs text-[#111111]/60">
          No members yet — invite someone below.
        </p>
      )}

      <div className="space-y-2">
        {/* Coordinator governance: invite, re-role, remove. Every action is
            server-authorised; a refusal is surfaced verbatim by the parent. */}
        {canGovern && (
          <form
            onSubmit={handleInvite}
            className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-3 space-y-2"
          >
            <p className="text-[10px] font-extrabold text-[#111111]/60">
              Invite a member
            </p>
            <div className="flex items-center gap-2">
              <input
                value={inviteId}
                onChange={(e) => setInviteId(e.target.value)}
                placeholder="member id (usr_…)"
                aria-label="invite member id"
                className="min-w-0 flex-1 px-2.5 py-1.5 rounded-xl border border-[#E5E7EB] text-[10px] text-[#111111]"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Member['role'])}
                aria-label="invite role"
                className="px-2 py-1.5 rounded-xl border border-[#E5E7EB] text-[10px] text-[#111111]"
              >
                {GOV_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r] ?? r}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!inviteId.trim() || busyUserId === 'invite'}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-[#111111] text-[#FFFFFF] font-extrabold text-[10px] cursor-pointer disabled:opacity-50"
              >
                Invite
              </button>
            </div>
          </form>
        )}

        {members.map((member) => {
            const open = expandedId === member.userId;
            const ev = evidence[member.userId];

            return (
              <div
                key={member.id}
                className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-[#111111] truncate">
                      {member.userId}
                    </p>
                    <p className="text-[9px] text-[#111111]/40 mt-0.5">
                      {ROLE_LABEL[member.role] ?? member.role}
                    </p>
                  </div>
                  <button
                    onClick={() => onToggle(member.userId)}
                    className="shrink-0 text-[10px] font-extrabold text-[#111111] cursor-pointer"
                  >
                    {open ? 'Hide' : 'Evidence'}
                  </button>
                </div>

                {/* Governance row: the coordinator can re-role or remove.
                    Self-governance is not offered here (you leave, you don't
                    remove yourself), and the server refuses it anyway. */}
                {canGovern && member.userId !== currentUserId && (
                  <div className="flex items-center gap-2 pt-1">
                    <select
                      value={member.role}
                      onChange={(e) => onRole?.(member.userId, e.target.value as Member['role'])}
                      aria-label={`role for ${member.userId}`}
                      disabled={busyUserId === member.userId}
                      className="px-2 py-1 rounded-xl border border-[#E5E7EB] text-[9px] text-[#111111] cursor-pointer disabled:opacity-50"
                    >
                      {GOV_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r] ?? r}
                        </option>
                      ))}
                    </select>
                    {confirmRemove === member.userId ? (
                      <span className="flex items-center gap-1.5 ml-auto">
                        <button
                          onClick={() => { setConfirmRemove(null); onRemove?.(member.userId); }}
                          disabled={busyUserId === member.userId}
                          className="px-2.5 py-1 rounded-xl bg-[#111111] text-[#FFFFFF] font-extrabold text-[9px] cursor-pointer disabled:opacity-50"
                        >
                          Confirm remove
                        </button>
                        <button
                          onClick={() => setConfirmRemove(null)}
                          className="px-2.5 py-1 rounded-xl border border-[#E5E7EB] font-bold text-[9px] text-[#111111]/60 cursor-pointer"
                        >
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmRemove(member.userId)}
                        disabled={busyUserId === member.userId}
                        className="ml-auto px-2.5 py-1 rounded-xl border border-[#E5E7EB] font-bold text-[9px] text-[#111111]/60 cursor-pointer disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}

                {/* Verifications: each names a specific check that happened. */}
                {member.trust.evidence.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {member.trust.evidence.map((e) => (
                      <span
                        key={e.kind}
                        className="text-[9px] px-2 py-0.5 rounded-full bg-[#FFFFFF] text-[#111111]"
                      >
                        {e.label}
                      </span>
                    ))}
                  </div>
                )}

                {open && (
                  <div className="pt-1 space-y-2 border-t border-[#E5E7EB]">
                    {/* Plain factual counts from the server. */}
                    {member.trust.facts.length > 0 && (
                      <ul className="space-y-0.5 mt-2">
                        {member.trust.facts.map((f) => (
                          <li key={f.kind} className="text-[10px] text-[#111111]/60">
                            {f.label}
                          </li>
                        ))}
                      </ul>
                    )}

                    {ev === 'loading' && (
                      <p className="text-[10px] text-[#111111]/60">Loading evidence...</p>
                    )}

                    {ev === 'error' && (
                      <p className="text-[10px] text-[#111111]">
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
                                className="text-[9px] px-2 py-0.5 rounded-full bg-[#FAFAFA] border border-[#E5E7EB] text-[#111111]/60"
                              >
                                {s.label}
                              </span>
                            ))}
                          </div>
                        )}

                        {ev.evidence.length === 0 ? (
                          <p className="text-[10px] text-[#111111]/40">
                            No recorded activity in this circle yet.
                          </p>
                        ) : (
                          <ul className="space-y-1">
                            {ev.evidence.slice(0, 10).map((item) => (
                              <li
                                key={item.signalId}
                                className="flex items-center gap-2 text-[10px] text-[#111111]/60"
                              >
                                <span className="min-w-0 truncate">{item.label}</span>
                                <span className="text-[9px] text-[#111111]/40 ml-auto shrink-0">
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
    </div>
  );
}
