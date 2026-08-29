import React from 'react';
import type { Signal } from '../../api/types';

/**
 * CIRCLE ACTIVITY.
 *
 * A derived view over Signals -- there is no activity table. A Signal is only
 * written when something actually changed on the server, so this feed cannot
 * show an event that did not happen.
 *
 * If nothing has happened, this renders an empty state and stops. Activity is
 * never seeded, padded or invented to make a quiet circle look busy.
 */

/** Signal type -> how it reads in a feed. Unknown types degrade gracefully. */
const ACTIVITY_LABELS: Record<string, string> = {
  circle_created: 'Circle created',
  member_joined: 'Someone joined',
  block_added: 'Something was posted',
  task_assigned: 'Task taken on',
  task_released: 'Task released',
  task_completed: 'Task completed',
  vote_cast: 'Vote cast',
  vote_closed: 'Vote closed',
  target_progressed: 'Target progressed',
  object_created: 'Information added',
  object_updated: 'Information updated',
  duplicate_merged: 'Duplicate merged',
  source_connected: 'Source connected',
  campaign_created: 'Campaign created',
  campaign_published: 'Campaign published',
  campaign_live: 'Campaign went live',
  campaign_closed: 'Campaign closed',
  campaign_registered: 'Someone registered',
  campaign_checkin: 'Someone arrived',
  sync_completed: 'Sync completed',
  sync_failed: 'Sync failed'
};

export interface CircleActivityProps {
  signals: Signal[];
  /** Cap the list; omit to show everything provided. */
  limit?: number;
}

export function CircleActivity({ signals, limit }: CircleActivityProps) {
  const rows = limit ? signals.slice(0, limit) : signals;

  return (
    <div>
      <h3 className="text-[11px] font-extrabold text-[#251045]/40 mb-2">
        Activity
      </h3>

      {rows.length === 0 ? (
        <p className="text-xs text-[#251045]/60">
          No activity recorded yet. Actions in this circle will appear here.
        </p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((signal) => (
            <div
              key={signal.id}
              className="flex items-center gap-3 bg-[#FBFAFD] border border-[#D6CFE4] rounded-xl px-3 py-2"
            >
              <span className="text-[10px] text-[#251045] min-w-0 truncate">
                {ACTIVITY_LABELS[signal.type] ?? signal.type.replace(/_/g, ' ')}
              </span>

              {/* Attribution only where the server recorded an actor. System
                  events have none and are left unattributed rather than
                  credited to somebody. */}
              {signal.actorId && (
                <span className="text-[10px] text-[#251045]/60 shrink-0">
                  {signal.actorId}
                </span>
              )}

              <span className="text-[9px] text-[#251045]/40 shrink-0 ml-auto">
                {signal.createdAt.slice(0, 10)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
