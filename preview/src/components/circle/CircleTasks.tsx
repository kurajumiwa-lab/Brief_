import React from 'react';
import type { Block, MemberRole } from '../../api/types';

/**
 * CIRCLE TASKS.
 *
 * Tasks are Blocks of type 'task'; their state is hydrated server-side onto
 * `block.task`. This component groups them by status and offers the actions
 * the caller's role permits.
 *
 * Hiding a button is presentation, NOT security. Every action here is also
 * enforced by the server, which rejects the request outright -- an observer
 * who forges a call still gets a 403. The role checks below exist so the UI
 * doesn't offer something that will fail, not to protect the data.
 *
 * Empty states are honest: a circle with no tasks says so rather than
 * displaying invented placeholder work.
 */

const OPERATIONAL: MemberRole[] = ['coordinator', 'contributor', 'scout', 'logistics'];

export interface CircleTasksProps {
  blocks: Block[];
  /** The viewing user. Used to tell "my work" from everyone else's. */
  currentUserId: string;
  /** The viewer's role in THIS circle, or null when not a member. */
  myRole: MemberRole | null;
  busyId: string | null;
  onAssign: (blockId: string) => void;
  onRelease: (blockId: string) => void;
  onComplete: (blockId: string) => void;
}

export function CircleTasks({
  blocks,
  currentUserId,
  myRole,
  busyId,
  onAssign,
  onRelease,
  onComplete
}: CircleTasksProps) {
  const tasks = blocks.filter((b) => b.type === 'task');

  const open = tasks.filter((t) => (t.task?.status ?? 'open') === 'open');
  const assigned = tasks.filter((t) => t.task?.status === 'assigned');
  const completed = tasks.filter((t) => t.task?.status === 'completed');

  const canOperate = myRole !== null && OPERATIONAL.includes(myRole);
  const isCoordinator = myRole === 'coordinator';

  if (tasks.length === 0) {
    return (
      <div>
        <Heading>Tasks</Heading>
        <p className="text-xs text-[#111111]/60">No tasks in this circle.</p>
      </div>
    );
  }

  const row = (task: Block) => {
    const state = task.task;
    const mine = state?.assigneeId === currentUserId;
    const busy = busyId === task.id;

    return (
      <div
        key={task.id}
        className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-3 space-y-2"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs text-[#111111] min-w-0">{task.content}</p>
          <span
            className={`shrink-0 text-[9px] px-2 py-0.5 rounded-full ${
              state?.status === 'completed'
                ? 'bg-[#FFFFFF] text-[#111111]'
                : state?.status === 'assigned'
                ? 'bg-[#FFFFFF] text-[#111111]'
                : 'bg-[#E5E7EB] text-[#111111]/60'
            }`}
          >
            {state?.status ?? 'open'}
          </span>
        </div>

        {/* Who holds it. Stated plainly; never inferred. */}
        {state?.status === 'assigned' && (
          <p className="text-[10px] text-[#111111]/40">
            {mine ? 'Assigned to you' : `Assigned to ${state.assigneeId}`}
          </p>
        )}
        {state?.status === 'completed' && (
          <p className="text-[10px] text-[#111111]/40">
            Completed by {state.completedBy ?? 'unknown'}
            {state.completedAt ? ` on ${state.completedAt.slice(0, 10)}` : ''}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {state?.status === 'open' && canOperate && (
            <button
              onClick={() => onAssign(task.id)}
              disabled={busy}
              className="px-3 py-1.5 rounded-xl bg-[#111111] text-[#FFFFFF] font-extrabold text-[10px] cursor-pointer disabled:opacity-50"
            >
              {busy ? 'Working...' : 'Take this on'}
            </button>
          )}

          {state?.status === 'assigned' && (mine || isCoordinator) && (
            <>
              <button
                onClick={() => onComplete(task.id)}
                disabled={busy}
                className="px-3 py-1.5 rounded-xl bg-[#111111] text-[#FFFFFF] font-extrabold text-[10px] cursor-pointer disabled:opacity-50"
              >
                {busy ? 'Working...' : 'Mark complete'}
              </button>
              <button
                onClick={() => onRelease(task.id)}
                disabled={busy}
                className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] border border-[#E5E7EB] text-[#111111] font-extrabold text-[10px] cursor-pointer disabled:opacity-50"
              >
                Release
              </button>
            </>
          )}
        </div>

        {/* An observer is told why, rather than shown a button that 403s. */}
        {state?.status === 'open' && myRole === 'observer' && (
          <p className="text-[10px] text-[#111111]/40">
            Observers cannot take on tasks.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <Heading>Tasks</Heading>

      {open.length > 0 && (
        <div className="space-y-2">
          <SubHeading>Open &middot; {open.length}</SubHeading>
          {open.map(row)}
        </div>
      )}

      {assigned.length > 0 && (
        <div className="space-y-2">
          <SubHeading>In progress &middot; {assigned.length}</SubHeading>
          {assigned.map(row)}
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-2">
          <SubHeading>Completed &middot; {completed.length}</SubHeading>
          {completed.map(row)}
        </div>
      )}
    </div>
  );
}

const Heading = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[11px] font-extrabold text-[#111111]/40">
    {children}
  </h3>
);

const SubHeading = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] text-[#111111]/40">{children}</p>
);
